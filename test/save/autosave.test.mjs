// Autosave tests: run with `node test/save/autosave.test.mjs` from the project root.
// core.js reads the save when it is imported, so every case imports a fresh copy (?a=N) over a fake localStorage.
import assert from 'node:assert/strict';

const KEY = 'tkh_town_v1', BAK = KEY + '_bak';
function fakeStorage(init = {}) {
  const m = new Map(Object.entries(init)); const s = { m, writes: 0, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { s.writes++; m.set(k, String(v)); }, removeItem: (k) => m.delete(k) };
  return s;
}
// a fake browser: one interval slot, visibility + pagehide listeners
function fakeEnv() {
  const env = { timers: [], docL: {}, winL: {}, visibilityState: 'visible' };
  env.setInterval = (fn, ms) => { env.timers.push({ fn, ms }); return env.timers.length; };
  env.document = { get visibilityState() { return env.visibilityState; }, addEventListener: (t, fn) => (env.docL[t] ||= []).push(fn) };
  env.addEventListener = (t, fn) => (env.winL[t] ||= []).push(fn);
  env.tick = () => env.timers.forEach(t => t.fn());
  env.hide = () => { env.visibilityState = 'hidden'; (env.docL.visibilitychange || []).forEach(f => f()); };
  env.pagehide = () => (env.winL.pagehide || []).forEach(f => f());
  return env;
}
let n = 0;
async function fresh(init = {}) { globalThis.localStorage = fakeStorage(init); const core = await import(`../../js/core.js?a=${++n}`); return { core, ls: globalThis.localStorage }; }
const tests = []; const test = (name, fn) => tests.push([name, fn]);
const disk = (ls, k = KEY) => JSON.parse(ls.getItem(k));

// a save from the live game (v2.0) — no saveVersion, no savedAt
const OLD = { started: true, coins: 1234, stars: 57, spirit: 80, chapter: 5, mission: 2, chapterDone: false, invited: ['amin', 'ani', 'abu'], rice: 3,
  houseColor: '#c0392b', best: { grass: 3 }, daily: { date: '2026-11-20', count: 1, yards: [] }, muted: false, timeMode: 'real', gfx: '3d', visited: {},
  fishLog: { kembung: { n: 4, max: 0.31 } }, owned: { 'veh:lekiu': 1 }, drag: { cur: 'lekiu' }, seenB5: true, introSeen: 5 };
// a very old save from before chapters and the wallet existed
const ANCIENT = { started: true, coins: 40, stars: 6, spirit: 30, mission: 3, houseColor: null, best: {}, daily: { date: '', count: 0, yards: [] }, muted: false };

// ---------------------------------------------------------------- autosave timer
test('autosave runs every 30 seconds and starts only once (no duplicate timers)', async () => {
  const { core } = await fresh({ [KEY]: JSON.stringify(OLD) }); const env = fakeEnv();
  assert.equal(core.startAutosave(env), true);
  assert.equal(core.startAutosave(env), false);
  assert.equal(env.timers.length, 1); assert.equal(env.timers[0].ms, 30000);
  assert.equal((env.docL.visibilitychange || []).length, 1); assert.equal((env.winL.pagehide || []).length, 1);
});

test('autosave writes only when the game state changed', async () => {
  const { core, ls } = await fresh({ [KEY]: JSON.stringify(OLD) }); const env = fakeEnv(); core.startAutosave(env);
  env.tick(); const w1 = ls.writes; assert.ok(w1 >= 1, 'first tick writes (adds saveVersion)');
  env.tick(); env.tick(); assert.equal(ls.writes, w1, 'nothing changed → no writes');
  core.S.coins += 10; env.tick(); assert.ok(ls.writes > w1); assert.equal(disk(ls).coins, 1244);
});

test('the save carries a savedAt time that moves forward on each real write', async () => {
  const { core, ls } = await fresh({ [KEY]: JSON.stringify(OLD) });
  core.save(); const a = disk(ls).savedAt; assert.ok(a > 0);
  await new Promise(r => setTimeout(r, 5)); core.S.stars++; core.save(); assert.ok(disk(ls).savedAt > a);
});

test('calling save() many times with no change writes once', async () => {
  const { core, ls } = await fresh({ [KEY]: JSON.stringify(OLD) });
  for (let i = 0; i < 50; i++) core.save();
  assert.ok(ls.writes <= 2, `writes: ${ls.writes}`); // main + first backup
});

// ---------------------------------------------------------------- page visibility
test('hiding the tab saves straight away', async () => {
  const { core, ls } = await fresh({ [KEY]: JSON.stringify(OLD) }); const env = fakeEnv(); core.startAutosave(env); env.tick();
  core.S.coins = 5000; env.hide(); assert.equal(disk(ls).coins, 5000);
});
test('closing the page (pagehide) saves straight away', async () => {
  const { core, ls } = await fresh({ [KEY]: JSON.stringify(OLD) }); const env = fakeEnv(); core.startAutosave(env);
  core.S.mission = 4; env.pagehide(); assert.equal(disk(ls).mission, 4);
});

// ---------------------------------------------------------------- "Tersimpan ✓" indicator
test('the saved indicator is throttled and never shown for background saves', async () => {
  const { core } = await fresh({ [KEY]: JSON.stringify(OLD) }); const env = fakeEnv(); core.startAutosave(env);
  for (let i = 0; i < 10; i++) { core.S.coins++; core.save(); }
  assert.equal(core.saveStats().shown, 1, 'ten quick saves → one indicator');
  core.S.coins++; env.hide(); assert.equal(core.saveStats().shown, 1, 'hidden-tab save shows nothing');
});
test('no indicator before the player presses Play / Continue', async () => {
  const { core } = await fresh({ [KEY]: JSON.stringify(OLD) });
  core.S.coins++; core.save(); assert.equal(core.saveStats().shown, 0);
});

// ---------------------------------------------------------------- never overwrite real progress
test('a default (not started) state never overwrites a saved game', async () => {
  const { core, ls } = await fresh({ [KEY]: JSON.stringify(OLD) });
  core.S.started = false; core.S.coins = 0; core.S.chapter = 1;
  assert.equal(core.save(), false); assert.equal(disk(ls).coins, 1234);
});
test('incomplete state (broken coins or chapter) is never written', async () => {
  const { core, ls } = await fresh({ [KEY]: JSON.stringify(OLD) });
  core.S.coins = NaN; assert.equal(core.save(), false); assert.equal(disk(ls).coins, 1234);
  core.S.coins = 10; core.S.chapter = undefined; assert.equal(core.save(), false); assert.equal(disk(ls).chapter, 5);
});
test('after Restart nothing (not even closing the page) writes the old progress back', async () => {
  const { core, ls } = await fresh({ [KEY]: JSON.stringify(OLD) }); const env = fakeEnv(); core.startAutosave(env);
  core.wipe(); env.pagehide(); env.hide(); env.tick(); core.save();
  assert.equal(ls.getItem(KEY), null); assert.equal(ls.getItem(BAK), null);
});
test('after Import, closing the page does not overwrite the imported save', async () => {
  const { core, ls } = await fresh({ [KEY]: JSON.stringify(OLD) }); const env = fakeEnv(); core.startAutosave(env);
  core.importSave({ ...OLD, coins: 9, chapter: 2 }); env.pagehide(); core.S.coins = 1; core.save();
  assert.equal(disk(ls).coins, 9);
});
test('a newer save from another tab is not overwritten by this tab', async () => {
  const { core, ls } = await fresh({ [KEY]: JSON.stringify({ ...OLD, savedAt: 1000 }) });
  ls.m.set(KEY, JSON.stringify({ ...OLD, coins: 7777, savedAt: Date.now() + 60000 })); // other tab saved later
  core.S.coins = 1; assert.equal(core.save(), false); assert.equal(disk(ls).coins, 7777);
  assert.equal(core.newerOnDisk(), true, 'Continue should reload to pick up the newer save');
});
test('newerOnDisk() is false for this tab\'s own saves', async () => {
  const { core } = await fresh({ [KEY]: JSON.stringify(OLD) }); core.S.coins++; core.save();
  assert.equal(core.newerOnDisk(), false);
});

// ---------------------------------------------------------------- recovery & corrupted data
test('a corrupted save restores the backup and keeps the broken copy aside', async () => {
  const { core, ls } = await fresh({ [KEY]: '{"coins":12', [BAK]: JSON.stringify(OLD) });
  assert.equal(core.saveStatus(), 'restored'); assert.equal(core.S.coins, 1234);
  assert.equal(ls.getItem(KEY + '_damaged'), '{"coins":12');
});
test('a save with impossible values (coins null) counts as damaged', async () => {
  const { core } = await fresh({ [KEY]: JSON.stringify({ ...OLD, coins: null }), [BAK]: JSON.stringify(OLD) });
  assert.equal(core.saveStatus(), 'restored'); assert.equal(core.S.coins, 1234);
});
test('corrupted save and no backup: the game starts fresh but the broken copy is kept', async () => {
  const { core, ls } = await fresh({ [KEY]: 'garbage' });
  assert.equal(core.saveStatus(), 'damaged'); assert.equal(core.S.started, false);
  assert.equal(ls.getItem(KEY + '_damaged'), 'garbage');
});
test('a damaged save with a savedAt inside it does not block future saves', async () => {
  const { core, ls } = await fresh({ [KEY]: '{"coins":5,"savedAt":99999999999999,"chap' });
  core.S.started = true; assert.equal(core.save(), true); assert.equal(disk(ls).started, true);
});
test('storage that throws on every call never crashes the game', async () => {
  globalThis.localStorage = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('SecurityError'); }, removeItem() { throw new Error('x'); } };
  const core = await import(`../../js/core.js?a=${++n}`); const env = fakeEnv();
  assert.equal(core.S.started, false);
  core.S.started = true; assert.equal(core.save(), false);
  core.startAutosave(env); env.tick(); env.hide(); env.pagehide(); core.wipe(); core.keepSaveSafe();
});
test('storage full (quota) keeps the old save and reports failure', async () => {
  const { core, ls } = await fresh({ [KEY]: JSON.stringify(OLD) });
  ls.setItem = () => { throw new Error('QuotaExceededError'); };
  core.S.coins = 1; assert.equal(core.save(), false); assert.equal(disk(ls).coins, 1234);
});

// ---------------------------------------------------------------- backward compatibility
test('a v2.0 save (no version, no savedAt) loads with every field unchanged', async () => {
  const { core } = await fresh({ [KEY]: JSON.stringify(OLD) });
  for (const [k, v] of Object.entries(OLD)) assert.deepEqual(core.S[k], v, k);
});
test('a very old save without chapter loads, and later saves keep its fields', async () => {
  const { core, ls } = await fresh({ [KEY]: JSON.stringify(ANCIENT) });
  assert.equal(core.saveStatus(), 'ok'); assert.equal(core.S.coins, 40); assert.equal(core.S.mission, 3);
  assert.equal(core.save(), true); const d = disk(ls); assert.equal(d.coins, 40); assert.equal(d.stars, 6); assert.equal(d.chapter, 1);
});
test('export still round-trips and the export file has no stale savedAt problems', async () => {
  const { core } = await fresh({ [KEY]: JSON.stringify(OLD) }); core.save();
  const p = core.parseSave(core.exportSave()); assert.equal(p.ok, true); assert.equal(p.data.coins, 1234);
});

let fail = 0;
for (const [name, fn] of tests) { try { await fn(); console.log('PASS', name); } catch (e) { fail++; console.log('FAIL', name, '\n   ', e.message.split('\n')[0]); } }
console.log(`\n${tests.length - fail}/${tests.length} passed`);
process.exit(fail ? 1 : 0);
