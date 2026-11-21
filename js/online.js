// Online foundation: email sign-in, cloud save and synchronized rooms, on Supabase (Auth + Postgres + Realtime).
// Nothing loads or connects until js/online-config.js is filled in. The local save stays the source of truth:
// cloud data is only applied when the player confirms, through core.js importSave (old save kept aside, then reload).
import { ONLINE } from './online-config.js';

const SDK = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
let sb = null, room = null;
export const onlineConfigured = (cfg = ONLINE) => /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(cfg.supabaseUrl || '') && (cfg.supabaseAnonKey || '').length > 20;
export function setClientForTest(c) { sb = c; room = null; }
async function client() {
  if (sb) return sb;
  if (!onlineConfigured()) throw new Error('online not configured');
  const { createClient } = await import(SDK);
  sb = createClient(ONLINE.supabaseUrl, ONLINE.supabaseAnonKey, { auth: { persistSession: true, detectSessionInUrl: true, storageKey: 'mykampung_auth' } });
  return sb;
}

// ---------------------------------------------------------------- auth (magic link: no passwords to store or leak)
export const validEmail = (e) => typeof e === 'string' && e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
export async function signIn(email) {
  if (!validEmail(email)) return { ok: false, reason: 'email' };
  const { error } = await (await client()).auth.signInWithOtp({ email, options: { emailRedirectTo: location.href.split('#')[0] } });
  return error ? { ok: false, reason: error.message } : { ok: true };
}
export async function currentUser() { const { data } = await (await client()).auth.getSession(); return (data && data.session && data.session.user) || null; }
export async function signOut() { await leaveRoom(); await (await client()).auth.signOut(); }

// ---------------------------------------------------------------- cloud save
// What to do with a local save (savedAt in ms) and the cloud row ({ saved_at, data } or null).
// Never replaces the local save on its own: a newer cloud save is only *offered*.
export function cloudPlan(local, cloud) {
  const lAt = +local.savedAt || 0, cAt = cloud ? Date.parse(cloud.saved_at) || 0 : 0;
  if (!cloud) return local.started ? 'upload' : 'nothing';
  if (Math.abs(lAt - cAt) < 1000) return 'same';
  if (cAt > lAt) return 'offer-download';
  return local.started ? 'upload' : 'offer-download'; // a fresh install never uploads over a real cloud game
}
export async function pullCloud() {
  const c = await client(), u = await currentUser(); if (!u) return { ok: false, reason: 'signed-out' };
  const { data, error } = await c.from('saves').select('data, saved_at, save_version').eq('user_id', u.id).maybeSingle();
  return error ? { ok: false, reason: error.message } : { ok: true, row: data || null };
}
// upload the local save; the server keeps whichever is newer (put_save refuses older data), so an old phone can't overwrite
export async function pushCloud(S, { stale = false } = {}) {
  if (stale) return { ok: false, reason: 'stale-tab' };   // an outdated tab must not upload old progress
  if (!S.started || !S.savedAt) return { ok: false, reason: 'nothing' };
  const c = await client(), u = await currentUser(); if (!u) return { ok: false, reason: 'signed-out' };
  const { data, error } = await c.rpc('put_save', { p_data: S, p_saved_at: new Date(S.savedAt).toISOString(), p_version: S.saveVersion || 0 });
  return error ? { ok: false, reason: error.message } : { ok: true, applied: data !== false };
}

// ---------------------------------------------------------------- rooms (Realtime presence: who is here, and where)
export const ROOM_RE = /^[A-Z0-9]{4,8}$/;
export const newRoomCode = (rnd = Math.random) => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(rnd() * 32)]).join('');
// presence comes from other players' browsers: untrusted. Keep only known fields, short strings, sane numbers.
export function sanitizeMember(raw) {
  const o = raw && typeof raw === 'object' ? raw : {};
  const str = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, '').slice(0, n);
  const int = (v, lo, hi) => { const x = Math.floor(+v); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : lo; };
  return { id: str(o.id, 40), name: str(o.name, 24) || 'Pemain', chapter: int(o.chapter, 1, 99), stars: int(o.stars, 0, 1e6), place: str(o.place, 24) };
}
export async function joinRoom(code, me, onMembers) {
  if (!ROOM_RE.test(code)) return { ok: false, reason: 'code' };
  const c = await client(), u = await currentUser(); if (!u) return { ok: false, reason: 'signed-out' };
  await leaveRoom();
  // private channel: the realtime.messages RLS policy in schema.sql only lets signed-in players join
  const ch = c.channel('room:' + code, { config: { private: true, presence: { key: u.id } } });
  ch.on('presence', { event: 'sync' }, () => {
    const list = Object.values(ch.presenceState()).map((metas) => sanitizeMember(metas[0])).filter((m) => m.id);
    onMembers(list);
  });
  const status = await new Promise((res) => ch.subscribe((s) => { if (s === 'SUBSCRIBED' || s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') res(s); }));
  if (status !== 'SUBSCRIBED') { c.removeChannel(ch); return { ok: false, reason: status }; }
  room = { ch, code, me: { ...sanitizeMember({ ...me, id: u.id }) } };
  await ch.track(room.me);
  return { ok: true, code };
}
export async function updatePresence(patch) { if (!room) return; room.me = sanitizeMember({ ...room.me, ...patch }); await room.ch.track(room.me); }
export async function leaveRoom() { if (!room) return; const r = room; room = null; try { await r.ch.untrack(); } catch {} try { (await client()).removeChannel(r.ch); } catch {} }
export const roomCode = () => (room ? room.code : null);
