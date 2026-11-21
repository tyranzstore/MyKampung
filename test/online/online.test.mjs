// Online foundation logic against a fake Supabase client (no network, no real backend).
// Run with `node test/online/online.test.mjs` from the project root. This does NOT prove the real backend works.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
globalThis.location = { href: 'https://example.test/index.html#x' };
const on = await import('../../js/online.js');

function fake({ user = { id: 'u1', email: 'a@b.c' }, row = null, rpc = true, sub = 'SUBSCRIBED', presence = {} } = {}) {
  const calls = [];
  const ch = { handlers: [], tracked: null, on(t, f, cb) { this.handlers.push(cb); return this; }, presenceState: () => presence,
    subscribe(cb) { cb(sub); this.handlers.forEach((h) => h()); return this; }, async track(m) { this.tracked = m; calls.push(['track', m]); }, async untrack() { calls.push(['untrack']); } };
  return { calls, ch,
    auth: { async getSession() { return { data: { session: user ? { user } : null } }; }, async signInWithOtp(a) { calls.push(['otp', a]); return {}; }, async signOut() { calls.push(['signout']); } },
    from: (t) => ({ select: () => ({ eq: (k, v) => ({ maybeSingle: async () => { calls.push(['select', t, k, v]); return { data: row }; } }) }) }),
    async rpc(n, a) { calls.push(['rpc', n, a]); return { data: rpc }; },
    channel(name, opts) { calls.push(['channel', name, opts]); return ch; }, removeChannel() { calls.push(['remove']); } };
}
const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('disabled until both config values are set; config ships empty', () => {
  assert.equal(on.onlineConfigured({ supabaseUrl: '', supabaseAnonKey: '' }), false);
  assert.equal(on.onlineConfigured({ supabaseUrl: 'http://x.supabase.co', supabaseAnonKey: 'x'.repeat(40) }), false);
  assert.equal(on.onlineConfigured({ supabaseUrl: 'https://abcd.supabase.co', supabaseAnonKey: 'x'.repeat(40) }), true);
  assert.equal(on.onlineConfigured(), false, 'js/online-config.js must ship empty');
  assert.doesNotMatch(readFileSync(new URL('../../js/online-config.js', import.meta.url), 'utf8'), /service_role['"]?\s*:/);
});

test('cloudPlan never replaces local progress on its own', () => {
  const t = Date.parse('2026-11-20T10:00:00Z');
  assert.equal(on.cloudPlan({ started: true, savedAt: t }, null), 'upload');
  assert.equal(on.cloudPlan({ started: false, savedAt: 0 }, null), 'nothing');
  assert.equal(on.cloudPlan({ started: true, savedAt: t }, { saved_at: new Date(t + 500).toISOString() }), 'same');
  assert.equal(on.cloudPlan({ started: true, savedAt: t }, { saved_at: new Date(t + 60e3).toISOString() }), 'offer-download');
  assert.equal(on.cloudPlan({ started: true, savedAt: t + 60e3 }, { saved_at: new Date(t).toISOString() }), 'upload');
  assert.equal(on.cloudPlan({ started: false, savedAt: t + 60e3 }, { saved_at: new Date(t).toISOString() }), 'offer-download', 'fresh install never uploads over a cloud game');
});

test('magic-link sign-in validates the email and redirects back without the hash', async () => {
  const f = fake(); on.setClientForTest(f);
  assert.deepEqual(await on.signIn('not-an-email'), { ok: false, reason: 'email' });
  assert.equal((await on.signIn('a@b.co')).ok, true);
  assert.equal(f.calls.find((c) => c[0] === 'otp')[1].options.emailRedirectTo, 'https://example.test/index.html');
});

test('pushCloud refuses from an outdated tab, when signed out, or with nothing to save', async () => {
  on.setClientForTest(fake());
  assert.equal((await on.pushCloud({ started: true, savedAt: 1 }, { stale: true })).reason, 'stale-tab');
  assert.equal((await on.pushCloud({ started: false, savedAt: 1 })).reason, 'nothing');
  on.setClientForTest(fake({ user: null }));
  assert.equal((await on.pushCloud({ started: true, savedAt: 1 })).reason, 'signed-out');
});

test('pushCloud sends the save through put_save and reports when the server kept a newer one', async () => {
  let f = fake(); on.setClientForTest(f);
  const S = { started: true, savedAt: Date.parse('2026-11-20T10:00:00Z'), saveVersion: 2, coins: 5 };
  assert.deepEqual(await on.pushCloud(S), { ok: true, applied: true });
  const c = f.calls.find((x) => x[0] === 'rpc'); assert.equal(c[1], 'put_save'); assert.equal(c[2].p_saved_at, '2026-11-20T10:00:00.000Z'); assert.equal(c[2].p_data, S);
  on.setClientForTest(fake({ rpc: false })); assert.deepEqual(await on.pushCloud(S), { ok: true, applied: false });
});

test('pullCloud reads only the signed-in player row', async () => {
  const f = fake({ row: { data: { coins: 1 }, saved_at: 'x' } }); on.setClientForTest(f);
  const r = await on.pullCloud(); assert.equal(r.ok, true); assert.deepEqual(f.calls.find((c) => c[0] === 'select').slice(1), ['saves', 'user_id', 'u1']);
});

test('sanitizeMember strips markup, clamps numbers and drops unknown fields', () => {
  const m = on.sanitizeMember({ id: 'x', name: '<img src=x onerror=alert(1)>Ali'.repeat(3), chapter: 1e9, stars: -5, place: 'balai', email: 'leak@x' });
  assert.ok(!/[<>]/.test(m.name)); assert.ok(m.name.length <= 24); assert.equal(m.chapter, 99); assert.equal(m.stars, 0); assert.equal('email' in m, false);
  assert.equal(on.sanitizeMember(null).name, 'Pemain');
});

test('joinRoom validates the code, uses a private channel keyed by user id and tracks sanitized presence', async () => {
  const f = fake({ presence: { u2: [{ id: 'u2', name: 'Siti', chapter: 3, stars: 10 }], bad: [{ name: 'no id' }] } }); on.setClientForTest(f);
  assert.equal((await on.joinRoom('bad code', {}, () => {})).reason, 'code');
  let got = null; const r = await on.joinRoom('ABC234', { name: 'Ali', chapter: 2, stars: 7, id: 'spoofed' }, (l) => { got = l; });
  assert.equal(r.ok, true); assert.equal(on.roomCode(), 'ABC234');
  const ch = f.calls.find((c) => c[0] === 'channel'); assert.equal(ch[1], 'room:ABC234'); assert.equal(ch[2].config.private, true); assert.equal(ch[2].config.presence.key, 'u1');
  assert.equal(f.ch.tracked.id, 'u1', 'presence id comes from the session, not the caller');
  assert.deepEqual(got.map((m) => m.name), ['Siti']);
  await on.leaveRoom(); assert.equal(on.roomCode(), null); assert.ok(f.calls.some((c) => c[0] === 'untrack'));
});

test('joinRoom reports a failed subscription and leaves no room behind', async () => {
  on.setClientForTest(fake({ sub: 'CHANNEL_ERROR' }));
  assert.deepEqual(await on.joinRoom('ABCD', {}, () => {}), { ok: false, reason: 'CHANNEL_ERROR' }); assert.equal(on.roomCode(), null);
});

test('room codes are valid and the schema enables RLS with a newer-wins put_save', () => {
  for (let k = 0; k < 50; k++) assert.match(on.newRoomCode(), on.ROOM_RE);
  const sql = readFileSync(new URL('../../backend/supabase/schema.sql', import.meta.url), 'utf8');
  assert.match(sql, /alter table public\.saves enable row level security/);
  assert.match(sql, /where public\.saves\.saved_at < excluded\.saved_at/);
  assert.match(sql, /security invoker/); assert.match(sql, /revoke all on function public\.put_save.*from public, anon/);
});

let pass = 0;
for (const [name, fn] of tests) { try { await fn(); pass++; console.log('PASS', name); } catch (e) { console.log('FAIL', name, '\n ', e.message); process.exitCode = 1; } }
console.log(`\n${pass}/${tests.length} passed`);
