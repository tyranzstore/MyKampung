// Multiplayer server tests: run with `node test/mp/server.test.mjs` from the project root
// (needs `cd server && npm install` once). Starts the real server in-process on a free port and connects
// real WebSocket clients (Node's built-in WebSocket).
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createServer, verifyJwt } from '../../server/index.js';

const SECRET = 'test-secret-not-real';
const jwt = (sub, expSec = 3600, secret = SECRET) => { const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url'); const h = b({ alg: 'HS256', typ: 'JWT' }), p = b({ sub, exp: Math.floor(Date.now() / 1000) + expSec }); return `${h}.${p}.${crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url')}`; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function client(port) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`), msgs = [], waiters = [];
  ws.onmessage = (e) => { const m = JSON.parse(e.data); msgs.push(m); for (const w of [...waiters]) if (w.f(m)) { waiters.splice(waiters.indexOf(w), 1); w.res(m); } };
  const c = {
    ws, msgs, closed: new Promise(r => { ws.onclose = (e) => r(e.code); }),
    open: new Promise((r, j) => { ws.onopen = r; ws.onerror = j; }),
    send: (m) => ws.send(JSON.stringify(m)),
    next: (t, f = () => true, ms = 2000) => { const hit = msgs.find(m => m.t === t && f(m)); if (hit) { msgs.splice(msgs.indexOf(hit), 1); return Promise.resolve(hit); } return new Promise((res, rej) => { const w = { f: (m) => m.t === t && f(m) && (msgs.splice(msgs.indexOf(m), 1), true), res }; waiters.push(w); setTimeout(() => rej(new Error(`timeout waiting for ${t}`)), ms); }); },
  };
  return c;
}
async function join(port, hello) { const c = client(port); await c.open; c.send({ t: 'hello', ...hello }); return c; }

const tests = []; const test = (n, fn) => tests.push([n, fn]);
let srv;
const fresh = async (o = {}) => { if (srv) await srv.close(); srv = await createServer({ port: 0, jwtSecret: SECRET, graceMs: 400, tickMs: 50, ...o }); return srv.port; };

test('two players in one room see each other and their names', async () => {
  const port = await fresh(); const a = await join(port, { name: 'Ali<script>', x: 1, z: 2 }); const wa = await a.next('welcome');
  const b = await join(port, { name: 'Siti' }); const wb = await b.next('welcome');
  assert.equal(wb.players.length, 1); assert.equal(wb.players[0].name, 'Aliscript', 'name sanitised'); assert.deepEqual([wb.players[0].x, wb.players[0].z], [1, 2]);
  const j = await a.next('join'); assert.equal(j.p.name, 'Siti'); assert.notEqual(wa.id, wb.id);
});
test('movement is synchronised to the other player', async () => {
  const port = await fresh(); const a = await join(port, { name: 'A' }); const { id } = await a.next('welcome'); const b = await join(port, { name: 'B' }); await b.next('welcome');
  await sleep(120); a.send({ t: 'move', x: .8, z: .4 });
  const mv = await b.next('moves', m => m.ps.some(p => p.id === id)); const p = mv.ps.find(p => p.id === id); assert.deepEqual([p.x, p.z], [.8, .4]);
});
test('teleporting is refused: the server clamps the step and corrects the client', async () => {
  const port = await fresh(); const a = await join(port, { name: 'A' }); const { id } = await a.next('welcome'); const b = await join(port, { name: 'B' }); await b.next('welcome');
  a.send({ t: 'move', x: 60, z: 60 }); const fix = await a.next('pos');
  assert.ok(Math.hypot(fix.x, fix.z) < 3, `corrected to ${fix.x},${fix.z}`);
  const mv = await b.next('moves', m => m.ps.some(p => p.id === id)); assert.ok(Math.hypot(mv.ps[0].x, mv.ps[0].z) < 3);
});
test('positions are kept inside the village bounds and junk is ignored', async () => {
  const port = await fresh(); const a = await join(port, { name: 'A', x: 9999, z: -9999 }); await a.next('welcome'); const b = await join(port, { name: 'B' }); const wb = await b.next('welcome');
  assert.deepEqual([wb.players[0].x, wb.players[0].z], [74, -30]);
  a.send({ t: 'move', x: 'NaN', z: null }); a.send('not json'); await sleep(150); assert.equal(srv.rooms.get('kampung').size, 2);
});
test('emotes: allowed ones are broadcast, others ignored, spam is rate-limited', async () => {
  const port = await fresh(); const a = await join(port, { name: 'A' }); const { id } = await a.next('welcome'); const b = await join(port, { name: 'B' }); await b.next('welcome');
  a.send({ t: 'emote', e: '<img>' }); a.send({ t: 'emote', e: '👋' }); a.send({ t: 'emote', e: '🎉' });
  const e = await b.next('emote'); assert.deepEqual([e.id, e.e], [id, '👋']); await sleep(200);
  assert.equal(b.msgs.filter(m => m.t === 'emote').length, 0, 'second emote inside 800 ms is dropped');
});
test('room capacity: the player over the limit is refused; other rooms are separate', async () => {
  const port = await fresh({ roomCap: 2 }); const a = await join(port, { name: 'A' }); await a.next('welcome'); const b = await join(port, { name: 'B' }); await b.next('welcome');
  const c = await join(port, { name: 'C' }); const err = await c.next('error'); assert.equal(err.code, 'full'); assert.equal(await c.closed, 4003);
  const d = await join(port, { name: 'D', room: 'pantai' }); const wd = await d.next('welcome'); assert.equal(wd.players.length, 0);
});
test('reconnection: same id and place inside the grace period, others never see a leave', async () => {
  const port = await fresh(); const a = await join(port, { name: 'A' }); const wa = await a.next('welcome'); const b = await join(port, { name: 'B' }); await b.next('welcome');
  await sleep(120); a.send({ t: 'move', x: 1, z: 1 }); await sleep(100); a.ws.close(); await sleep(100);
  const a2 = await join(port, { name: 'A', resume: wa.resume }); const w2 = await a2.next('welcome'); assert.equal(w2.id, wa.id); assert.equal(w2.resumed, true);
  await sleep(500); assert.equal(b.msgs.some(m => m.t === 'leave'), false);
});
test('a player who does not come back is removed after the grace period', async () => {
  const port = await fresh(); const a = await join(port, { name: 'A' }); const { id } = await a.next('welcome'); const b = await join(port, { name: 'B' }); await b.next('welcome');
  a.ws.close(); const l = await b.next('leave', () => true, 1500); assert.equal(l.id, id);
  const late = await join(port, { name: 'A', resume: 'expired' }); const w = await late.next('welcome'); assert.notEqual(w.id, id);
});
test('accounts: valid Supabase-style JWT accepted; forged, expired or missing (when guests are off) refused', async () => {
  assert.equal(verifyJwt(jwt('user-1'), SECRET).sub, 'user-1');
  assert.equal(verifyJwt(jwt('user-1', 3600, 'wrong'), SECRET), null); assert.equal(verifyJwt(jwt('user-1', -10), SECRET), null); assert.equal(verifyJwt('a.b.c', SECRET), null);
  const port = await fresh({ allowGuests: false }); const a = await join(port, { name: 'A', token: jwt('u1') }); assert.equal((await a.next('welcome')).account, true);
  const g = await join(port, { name: 'G' }); assert.equal((await g.next('error')).code, 'auth');
  const f = await join(port, { name: 'F', token: jwt('u2', 3600, 'forged') }); assert.equal((await f.next('error')).code, 'auth');
});
test('economy: the daily reward is decided by the server, once per day, accounts only', async () => {
  const port = await fresh(); const g = await join(port, { name: 'G' }); await g.next('welcome');
  g.send({ t: 'claim', kind: 'daily' }); assert.equal((await g.next('claim')).reason, 'account');
  const a = await join(port, { name: 'A', token: jwt('u1') }); await a.next('welcome');
  a.send({ t: 'claim', kind: 'daily', amount: 99999, wallet: 1e9 }); const c1 = await a.next('claim');
  assert.equal(c1.ok, true); assert.equal(c1.reward, 20); assert.equal(c1.wallet, 20, 'client-supplied amount and wallet ignored');
  a.send({ t: 'claim', kind: 'daily' }); const c2 = await a.next('claim'); assert.equal(c2.ok, false); assert.equal(c2.reason, 'claimed'); assert.equal(c2.wallet, 20);
  a.send({ t: 'claim', kind: 'money' }); assert.equal((await a.next('claim')).reason, 'kind');
  assert.equal(srv.profiles.u1.wallet, 20);
});
test('cloud save: accounts only, validated, and loads back unchanged', async () => {
  const port = await fresh(); const a = await join(port, { name: 'A', token: jwt('u1') }); await a.next('welcome');
  a.send({ t: 'save', data: { coins: -5, chapter: 1 } }); assert.equal((await a.next('saved')).ok, false);
  const data = { started: true, coins: 1234, chapter: 4, mission: 1, stars: 57 }; a.send({ t: 'save', data }); assert.equal((await a.next('saved')).ok, true);
  a.send({ t: 'load' }); const l = await a.next('cloud'); assert.deepEqual(l.save.data, data);
  const g = await join(port, { name: 'G' }); await g.next('welcome'); g.send({ t: 'save', data }); assert.equal((await g.next('saved')).reason, 'account');
});
test('one avatar per account: logging in again replaces the old connection', async () => {
  const port = await fresh(); const a = await join(port, { name: 'A', token: jwt('u1') }); await a.next('welcome');
  const a2 = await join(port, { name: 'A', token: jwt('u1') }); await a2.next('welcome'); assert.equal(await a.closed, 4009); assert.equal(srv.rooms.get('kampung').size, 1);
});
test('message flood closes the connection', async () => {
  const port = await fresh(); const a = await join(port, { name: 'A' }); await a.next('welcome');
  for (let i = 0; i < 60; i++) a.send({ t: 'ping' }); assert.equal(await a.closed, 4008);
});

let fail = 0;
for (const [n, fn] of tests) { try { await fn(); console.log('PASS', n); } catch (e) { fail++; console.log('FAIL', n, '\n   ', e.message.split('\n')[0]); } }
if (srv) await srv.close();
console.log(`\n${tests.length - fail}/${tests.length} passed`);
process.exit(fail ? 1 : 0);
