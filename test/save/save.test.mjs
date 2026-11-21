// Save-data safety tests: run with `node test/save/save.test.mjs` from the project root.
// core.js reads the save when it is imported, so every case imports a fresh copy (?case=N) over a fake localStorage.
import assert from 'node:assert/strict';

const KEY = 'tkh_town_v1', BAK = KEY + '_bak';
function fakeStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
let n = 0;
async function fresh(init) { globalThis.localStorage = fakeStorage(init); return { core: await import(`../../js/core.js?case=${++n}`), ls: globalThis.localStorage }; }
const tests = [];
const test = (name, fn) => tests.push([name, fn]);

// a save made by the current live game (v2.0), before save versions existed
const OLD = { started: true, coins: 1234, stars: 57, spirit: 80, chapter: 5, mission: 2, chapterDone: false, invited: ['amin', 'ani', 'abu'], rice: 3,
  houseColor: '#c0392b', best: { grass: 3, fish: 2 }, daily: { date: '2026-11-20', count: 1, yards: [] }, muted: false, timeMode: 'real', gfx: '3d', visited: { pantai: 1 },
  fishLog: { kembung: { n: 4, max: 0.31 } }, owned: { 'veh:lekiu': 1 }, ledger: [{ t: 1, kind: 'earn', amt: 50, why: 'x' }], drag: { cur: 'lekiu' }, seenB5: true, introSeen: 5 };

test('an existing save loads with every field unchanged', async () => {
  const { core } = await fresh({ [KEY]: JSON.stringify(OLD) });
  for (const [k, v] of Object.entries(OLD)) assert.deepEqual(core.S[k], v, k);
  assert.equal(core.saveStatus(), 'ok');
});

test('the save gets a version number and keeps all old fields when saved', async () => {
  const { core, ls } = await fresh({ [KEY]: JSON.stringify(OLD) });
  assert.equal(core.save(), true);
  const back = JSON.parse(ls.getItem(KEY));
  assert.equal(back.saveVersion, core.SAVE_VERSION);
  for (const [k, v] of Object.entries(OLD)) assert.deepEqual(back[k], v, k);
});

test('saving also writes a backup copy', async () => {
  const { core, ls } = await fresh({ [KEY]: JSON.stringify(OLD) });
  core.save();
  assert.equal(JSON.parse(ls.getItem(BAK)).coins, 1234);
});

test('a damaged save is recovered from the backup', async () => {
  const { core, ls } = await fresh({ [KEY]: '{"coins":12', [BAK]: JSON.stringify(OLD) });
  assert.equal(core.S.coins, 1234); assert.equal(core.S.chapter, 5);
  assert.equal(core.saveStatus(), 'restored');
  assert.equal(JSON.parse(ls.getItem(KEY)).coins, 1234, 'the repaired save is written back');
});

test('a save that is not an object counts as damaged', async () => {
  const { core } = await fresh({ [KEY]: '"oops"', [BAK]: JSON.stringify(OLD) });
  assert.equal(core.S.coins, 1234);
});

test('a brand-new player starts from the defaults (no backup restore)', async () => {
  const { core } = await fresh({});
  assert.equal(core.S.started, false); assert.equal(core.S.coins, 0);
  assert.equal(core.saveStatus(), 'new');
});

test('Restart (wipe) removes the save and the backup, so it really restarts', async () => {
  const { core, ls } = await fresh({ [KEY]: JSON.stringify(OLD) });
  core.save(); core.wipe();
  assert.equal(ls.getItem(KEY), null); assert.equal(ls.getItem(BAK), null);
});

test('save() reports failure instead of hiding it', async () => {
  const { core, ls } = await fresh({ [KEY]: JSON.stringify(OLD) });
  ls.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.equal(core.save(), false);
});

test('export → import round-trips the whole save', async () => {
  const { core } = await fresh({ [KEY]: JSON.stringify(OLD) });
  const text = core.exportSave();
  const p = core.parseSave(text);
  assert.equal(p.ok, true);
  for (const [k, v] of Object.entries(OLD)) assert.deepEqual(p.data[k], v, k);
});

test('import accepts a raw save as well as an export file', async () => {
  const { core } = await fresh({});
  assert.equal(core.parseSave(JSON.stringify(OLD)).ok, true);
});

test('import rejects files that are not MyKampung saves', async () => {
  const { core } = await fresh({});
  for (const bad of ['', 'hello', '[]', '{}', '{"coins":"lots","chapter":1}', '{"coins":-5,"chapter":1}', '{"coins":5,"chapter":0}', JSON.stringify({ game: 'Other', data: {} })])
    assert.equal(core.parseSave(bad).ok, false, bad);
});

test('import keeps the old save aside and writes the new one plus its backup', async () => {
  const { core, ls } = await fresh({ [KEY]: JSON.stringify(OLD) });
  const other = { ...OLD, coins: 9, chapter: 2 };
  assert.equal(core.importSave(other), true);
  assert.equal(JSON.parse(ls.getItem(KEY)).coins, 9);
  assert.equal(JSON.parse(ls.getItem(BAK)).coins, 9);
  assert.equal(JSON.parse(ls.getItem(KEY + '_preimport')).coins, 1234);
});

let fail = 0;
for (const [name, fn] of tests) { try { await fn(); console.log('PASS', name); } catch (e) { fail++; console.log('FAIL', name, '\n   ', e.message); } }
console.log(`\n${tests.length - fail}/${tests.length} passed`);
process.exit(fail ? 1 : 0);
