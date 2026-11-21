// MyKampung multiplayer room server. Authoritative for: who is in a room, positions (speed/bounds checked),
// emotes, and server-side economy actions (daily reward). Never accepts an RM balance from a client.
//
//   cd server && npm install && PORT=8787 node index.js
//
// Env: PORT, ROOM_CAP (10), ALLOW_GUESTS (1), SUPABASE_JWT_SECRET (HS256 secret, for accounts), DATA_FILE (JSON store).
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { WebSocketServer } from 'ws';
import { claimDaily } from '../js/progress.js';

export const EMOTES = ['👋', '😄', '👍', '🎉', '❤️', '🙏'];
const BOUNDS = { x0: -30, x1: 74, z0: -30, z1: 70 }; // same as the village camera limits (js/town3d.js)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const cleanName = (n) => String(n || '').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 16) || 'Pemain';
const cleanRoom = (r) => String(r || 'kampung').replace(/[^a-z0-9-]/gi, '').slice(0, 24).toLowerCase() || 'kampung';

// Supabase access tokens (legacy HS256 JWT secret). Returns the payload (with sub) or null.
export function verifyJwt(token, secret, now = Date.now()) {
  try {
    const [h, p, sig] = String(token).split('.'); if (!h || !p || !sig || !secret) return null;
    const head = JSON.parse(Buffer.from(h, 'base64url')); if (head.alg !== 'HS256') return null;
    const want = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url');
    if (want.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(sig))) return null;
    const pl = JSON.parse(Buffer.from(p, 'base64url'));
    if (!pl.sub || (pl.exp && pl.exp * 1000 < now)) return null;
    return pl;
  } catch { return null; }
}

// A minimal cloud save is an object with sane coins/chapter (same rule as js/core.js parseSave).
function validSave(d) { return d && typeof d === 'object' && !Array.isArray(d) && Number.isFinite(d.coins) && d.coins >= 0 && Number.isFinite(d.chapter) && d.chapter >= 1; }

export function createServer(opt = {}) {
  const o = { port: 8787, roomCap: 10, allowGuests: true, jwtSecret: '', dataFile: '', graceMs: 30000, tickMs: 100, maxSpeed: 9, now: () => Date.now(), ...opt };
  const rooms = new Map(); // room -> Map(id -> player)
  const byResume = new Map(); // resume token -> player (only while connected or in the grace period)
  // profiles: userId -> { login, wallet, ledger, save }. File-backed for a single small server; use the Supabase tables in docs/MULTIPLAYER.md for production.
  let profiles = {}; try { if (o.dataFile && fs.existsSync(o.dataFile)) profiles = JSON.parse(fs.readFileSync(o.dataFile, 'utf8')); } catch { profiles = {}; }
  let saveT = null; const persist = () => { if (!o.dataFile || saveT) return; saveT = setTimeout(() => { saveT = null; try { fs.writeFileSync(o.dataFile + '.tmp', JSON.stringify(profiles)); fs.renameSync(o.dataFile + '.tmp', o.dataFile); } catch (e) { console.error('save failed', e.message); } }, 500); };
  const profile = (uid) => (profiles[uid] ||= { wallet: 0, ledger: [], login: {} });

  const http_ = http.createServer((req, res) => {
    if (req.url === '/health') { let n = 0; for (const r of rooms.values()) n += r.size; res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ ok: true, rooms: rooms.size, players: n })); }
    res.writeHead(404); res.end();
  });
  const wss = new WebSocketServer({ server: http_, maxPayload: 70 * 1024 });
  const send = (ws, m) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };
  const pub = (p) => ({ id: p.id, name: p.name, x: p.x, z: p.z });
  const broadcast = (room, m, except) => { for (const p of (rooms.get(room) || new Map()).values()) if (p !== except && p.ws) send(p.ws, m); };
  function leave(p) { const r = rooms.get(p.room); if (!r || !r.has(p.id)) return; r.delete(p.id); byResume.delete(p.resume); if (!r.size) rooms.delete(p.room); broadcast(p.room, { t: 'leave', id: p.id }); }

  wss.on('connection', (ws) => {
    let me = null, count = 0, win = o.now();
    ws.isAlive = true; ws.on('pong', () => { ws.isAlive = true; });
    ws.on('message', (raw) => {
      const t = o.now(); if (t - win > 1000) { win = t; count = 0; } if (++count > 40) return ws.close(4008, 'flood');
      let m; try { m = JSON.parse(raw); } catch { return; } if (!m || typeof m !== 'object') return;
      if (m.t === 'ping') return send(ws, { t: 'pong' });
      if (m.t === 'hello') {
        if (me) return;
        const back = m.resume && byResume.get(m.resume);
        if (back && back.room === cleanRoom(m.room)) { // reconnection inside the grace period: same id and position
          clearTimeout(back.dropT); back.ws = ws; me = back;
          return send(ws, { t: 'welcome', id: me.id, resume: me.resume, room: me.room, cap: o.roomCap, account: !!me.uid, resumed: true, players: [...rooms.get(me.room).values()].filter(p => p !== me).map(pub) });
        }
        let uid = null;
        if (m.token) { const pl = verifyJwt(m.token, o.jwtSecret); if (!pl) return send(ws, { t: 'error', code: 'auth' }), ws.close(4001, 'auth'); uid = pl.sub; }
        else if (!o.allowGuests) return send(ws, { t: 'error', code: 'auth' }), ws.close(4001, 'auth');
        const room = cleanRoom(m.room), r = rooms.get(room) || new Map();
        if (r.size >= o.roomCap) return send(ws, { t: 'error', code: 'full', cap: o.roomCap }), ws.close(4003, 'full');
        if (uid) for (const p of r.values()) if (p.uid === uid) { clearTimeout(p.dropT); if (p.ws && p.ws !== ws) p.ws.close(4009, 'replaced'); leave(p); } // one avatar per account
        rooms.set(room, r);
        const x = clamp(Number(m.x) || 0, BOUNDS.x0, BOUNDS.x1), z = clamp(Number(m.z) || 0, BOUNDS.z0, BOUNDS.z1);
        me = { id: crypto.randomUUID().slice(0, 8), resume: crypto.randomBytes(16).toString('hex'), uid, room, name: cleanName(m.name), x, z, at: t, ws, dirty: false, lastEmote: 0 };
        r.set(me.id, me); byResume.set(me.resume, me);
        send(ws, { t: 'welcome', id: me.id, resume: me.resume, room, cap: o.roomCap, account: !!uid, players: [...r.values()].filter(p => p !== me).map(pub) });
        return broadcast(room, { t: 'join', p: pub(me) }, me);
      }
      if (!me) return;
      if (m.t === 'move') {
        let x = Number(m.x), z = Number(m.z); if (!Number.isFinite(x) || !Number.isFinite(z)) return;
        x = clamp(x, BOUNDS.x0, BOUNDS.x1); z = clamp(z, BOUNDS.z0, BOUNDS.z1);
        const dt = Math.max(.05, (t - me.at) / 1000), max = o.maxSpeed * dt + .5, d = Math.hypot(x - me.x, z - me.z);
        if (d > max) { x = me.x + (x - me.x) * max / d; z = me.z + (z - me.z) * max / d; send(ws, { t: 'pos', x, z }); } // too fast: server position wins
        me.x = x; me.z = z; me.at = t; me.dirty = true; return;
      }
      if (m.t === 'emote') { if (!EMOTES.includes(m.e) || t - me.lastEmote < 800) return; me.lastEmote = t; return broadcast(me.room, { t: 'emote', id: me.id, e: m.e }); }
      if (m.t === 'claim') {
        if (m.kind !== 'daily') return send(ws, { t: 'claim', ok: false, reason: 'kind' });
        if (!me.uid) return send(ws, { t: 'claim', ok: false, reason: 'account' }); // guests have no persistent identity to rate-limit
        const pr = profile(me.uid), res = claimDaily(pr, t);
        if (res.ok) { pr.wallet += res.reward; pr.ledger.push({ t, kind: 'daily', amt: res.reward }); if (pr.ledger.length > 100) pr.ledger.shift(); persist(); }
        return send(ws, { t: 'claim', ...res, wallet: pr.wallet });
      }
      if (m.t === 'save') {
        if (!me.uid) return send(ws, { t: 'saved', ok: false, reason: 'account' });
        if (!validSave(m.data) || JSON.stringify(m.data).length > 64 * 1024) return send(ws, { t: 'saved', ok: false, reason: 'invalid' });
        profile(me.uid).save = { data: m.data, at: t }; persist(); return send(ws, { t: 'saved', ok: true, at: t });
      }
      if (m.t === 'load') { if (!me.uid) return send(ws, { t: 'cloud', ok: false, reason: 'account' }); const s = profile(me.uid).save; return send(ws, { t: 'cloud', ok: true, save: s || null }); }
    });
    ws.on('close', () => { if (!me || me.ws !== ws) return; me.ws = null; const p = me; p.dropT = setTimeout(() => leave(p), o.graceMs); });
  });

  // 10 Hz position broadcast (only players that moved), and heartbeat for dead connections
  const tick = setInterval(() => { for (const [room, r] of rooms) { const moved = [...r.values()].filter(p => p.dirty); if (!moved.length) continue; moved.forEach(p => { p.dirty = false; }); broadcast(room, { t: 'moves', ps: moved.map(pub) }); } }, o.tickMs);
  const beat = setInterval(() => { for (const ws of wss.clients) { if (!ws.isAlive) { ws.terminate(); continue; } ws.isAlive = false; ws.ping(); } }, 15000);

  return new Promise((resolve) => http_.listen(o.port, () => resolve({
    port: http_.address().port, rooms, profiles,
    close: () => new Promise((res) => { clearInterval(tick); clearInterval(beat); for (const r of rooms.values()) for (const p of r.values()) clearTimeout(p.dropT); wss.clients.forEach(c => c.terminate()); wss.close(); http_.close(() => res()); }),
  })));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const e = process.env;
  createServer({ port: +e.PORT || 8787, roomCap: +e.ROOM_CAP || 10, allowGuests: e.ALLOW_GUESTS !== '0', jwtSecret: e.SUPABASE_JWT_SECRET || '', dataFile: e.DATA_FILE || '' })
    .then(s => console.log(`MyKampung server on :${s.port} (room cap ${+e.ROOM_CAP || 10}, guests ${e.ALLOW_GUESTS !== '0' ? 'on' : 'off'}, accounts ${e.SUPABASE_JWT_SECRET ? 'on' : 'off'})`));
}
