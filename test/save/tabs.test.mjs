// Multiple-tab conflict tests: run with `node test/save/tabs.test.mjs` from the project root.
// Each "tab" is a fresh copy of core.js (?tab=N) sharing one fake localStorage, like two browser tabs on one site.
import assert from 'node:assert/strict';

const KEY = 'tkh_town_v1';
let store;
function newStore(init = {}) {
  const m = new Map(Object.entries(init));
  store = { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  globalThis.localStorage = store;
}
// a fake browser window for one tab: timer, visibility, pagehide/pageshow and storage events
function fakeEnv() {
  const env = { timers: [], docL: {}, winL: {}, visibilityState: 'visible' };
  env.setInterval = (fn) => { env.timers.push(fn); return env.timers.length; };
  env.document = { get visibilityState() { return env.visibilityState; }, addEventListener: (t, fn) => (env.docL[t] ||= []).push(fn) };
  env.addEventListener = (t, fn) => (env.winL[t] ||= []).push(fn);
  env.tick = () => env.timers.forEach(f => f());
  env.hide = () => { env.visibilityState = 'hidden'; (env.docL.visibilitychange || []).forEach(f => f()); };
  env.show = () => { env.visibilityState = 'visible'; (env.docL.visibilitychange || []).forEach(f => f()); };
  env.pagehide = () => (env.winL.pagehide || []).forEach(f => f());
  env.storage = (key, newValue) => (env.winL.storage || []).forEach(f => f({ key, newValue }));
  return env;
}
let n = 0;
async function tab() { const core = await import(`../../js/core.js?tab=${++n}`); const env = fakeEnv(); core.startAutosave(env); const seen = []; core.onStale(() => seen.push(1)); return { core, env, seen }; }
const disk = () => JSON.parse(store.getItem(KEY));
const tests = []; const test = (name, fn) => tests.push([name, fn]);
const SAVE = { started: true, coins: 100, stars: 5, spirit: 40, chapter: 2, mission: 1, best: {}, daily: { date: '2026-11-21', count: 0, yards: [] }, savedAt: 1000 };

test('a single tab is never marked outdated (saves, ticks, hide/show, pagehide)', async () => {
  newStore({ [KEY]: JSON.stringify(SAVE) }); const A = await tab();
  for (let i = 0; i < 5; i++) { A.core.S.coins += 10; A.core.save(); A.env.tick(); A.env.hide(); A.env.show(); A.env.pagehide(); }
  assert.equal(A.core.isStale(), false); assert.equal(A.seen.length, 0); assert.equal(disk().coins, 150);
});

test('another tab saves → the storage event marks this tab outdated at once', async () => {
  newStore({ [KEY]: JSON.stringify(SAVE) }); const A = await tab(); const B = await tab();
  B.core.S.coins = 500; assert.equal(B.core.save(), true);
  A.env.storage(KEY, store.getItem(KEY));
  assert.equal(A.core.isStale(), true); assert.equal(A.seen.length, 1);
  assert.equal(B.core.isStale(), false, 'the newer tab carries on normally');
});

test('outdated tab becoming visible is detected even if the storage event was missed', async () => {
  newStore({ [KEY]: JSON.stringify(SAVE) }); const A = await tab(); const B = await tab();
  B.core.S.coins = 500; B.core.save(); // no storage event delivered to A
  assert.equal(A.core.isStale(), false); A.env.show();
  assert.equal(A.core.isStale(), true); assert.equal(A.seen.length, 1);
});

test('whichever tab saved last wins: an earlier background save makes the other tab the outdated one', async () => {
  newStore({ [KEY]: JSON.stringify(SAVE) }); const A = await tab(); const B = await tab();
  A.core.S.coins = 200; A.env.hide();             // A saves when the player switches away
  B.core.S.coins = 500; assert.equal(B.core.save(), false);
  assert.equal(B.core.isStale(), true); assert.equal(B.seen.length, 1); assert.equal(disk().coins, 200);
});

test('the 30 s autosave of an outdated tab detects the conflict and writes nothing', async () => {
  newStore({ [KEY]: JSON.stringify(SAVE) }); const A = await tab(); const B = await tab();
  B.core.S.coins = 500; B.core.save(); A.core.S.coins = 999; A.env.tick();
  assert.equal(A.core.isStale(), true); assert.equal(disk().coins, 500);
});

test('an outdated tab can never save again: save(), timer, hide, pagehide', async () => {
  newStore({ [KEY]: JSON.stringify(SAVE) }); const A = await tab(); const B = await tab();
  B.core.S.coins = 500; B.core.save(); A.env.storage(KEY, store.getItem(KEY));
  A.core.S.coins = 7; A.core.S.mission = 9;
  assert.equal(A.core.save(), false); A.env.tick(); A.env.hide(); A.env.pagehide();
  assert.equal(disk().coins, 500); assert.equal(disk().mission, 1);
});

test('the warning is raised only once (no stacked pop-ups)', async () => {
  newStore({ [KEY]: JSON.stringify(SAVE) }); const A = await tab(); const B = await tab();
  B.core.S.coins = 500; B.core.save();
  A.env.storage(KEY, store.getItem(KEY)); A.env.show(); A.env.tick(); A.core.save(); A.env.storage(KEY, store.getItem(KEY));
  assert.equal(A.seen.length, 1);
});

test('a listener added after the conflict is still told (pop-up can never be missed)', async () => {
  newStore({ [KEY]: JSON.stringify(SAVE) }); const A = await tab(); const B = await tab();
  B.core.S.coins = 500; B.core.save(); A.env.show(); let late = 0; A.core.onStale(() => late++);
  assert.equal(late, 1);
});

test('Restart in another tab (save removed) marks this tab outdated so it cannot write the old game back', async () => {
  newStore({ [KEY]: JSON.stringify(SAVE) }); const A = await tab(); const B = await tab();
  B.core.wipe(); A.env.storage(KEY, null);
  assert.equal(A.core.isStale(), true); A.core.S.coins = 1; A.core.save(); A.env.pagehide();
  assert.equal(store.getItem(KEY), null);
});

test('Import in another tab marks this tab outdated', async () => {
  newStore({ [KEY]: JSON.stringify(SAVE) }); const A = await tab(); const B = await tab();
  B.core.importSave({ ...SAVE, coins: 42 }); A.env.storage(KEY, store.getItem(KEY));
  assert.equal(A.core.isStale(), true); assert.equal(disk().coins, 42);
});

test('storage events for other keys, or saves that are not newer, are ignored', async () => {
  newStore({ [KEY]: JSON.stringify(SAVE) }); const A = await tab();
  A.core.S.coins = 300; A.core.save();
  A.env.storage(KEY + '_bak', 'x'); A.env.storage('mk_other', '1'); A.env.storage(KEY, store.getItem(KEY));
  assert.equal(A.core.isStale(), false);
});

test('recovery: "Muat Semula" (reload) loads the newest progress and saving works again', async () => {
  newStore({ [KEY]: JSON.stringify(SAVE) }); const A = await tab(); const B = await tab();
  B.core.S.coins = 500; B.core.S.mission = 2; B.core.save(); A.env.show(); assert.equal(A.core.isStale(), true);
  const A2 = await tab(); // the reloaded page
  assert.equal(A2.core.S.coins, 500); assert.equal(A2.core.S.mission, 2); assert.equal(A2.core.isStale(), false);
  A2.core.S.coins = 650; assert.equal(A2.core.save(), true); assert.equal(disk().coins, 650);
  B.env.show(); assert.equal(B.core.isStale(), true, 'now the other tab is the outdated one');
});

test('the newest tab keeps autosaving normally while the old tab is blocked', async () => {
  newStore({ [KEY]: JSON.stringify(SAVE) }); const A = await tab(); const B = await tab();
  B.core.S.coins = 500; B.core.save(); A.env.storage(KEY, store.getItem(KEY));
  for (let i = 0; i < 3; i++) { B.core.S.coins += 1; B.env.tick(); }
  assert.equal(disk().coins, 503); assert.equal(B.core.isStale(), false);
});

let fail = 0;
for (const [name, fn] of tests) { try { await fn(); console.log('PASS', name); } catch (e) { fail++; console.log('FAIL', name, '\n   ', e.message.split('\n')[0]); } }
console.log(`\n${tests.length - fail}/${tests.length} passed`);
process.exit(fail ? 1 : 0);
