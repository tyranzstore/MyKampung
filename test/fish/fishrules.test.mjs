// Jelajah Kail rules: run with `node test/fish/fishrules.test.mjs` from the project root.
import assert from 'node:assert/strict';
import * as R from '../../js/fishrules.js';

// same algorithm as core.js mulberry32 (core.js reads localStorage on import, so the test keeps its own copy)
const mulberry32 = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const tests = []; const test = (n, f) => tests.push([n, f]);
const ctx = (o = {}) => ({ spot: 'tasik', depth: 4, bait: 'cacing', hour: 12, weather: 'cerah', ...o });

test('four spots in order, each opens from the previous one', () => {
  assert.deepEqual(R.SPOTS.map((s) => s.id), ['tasik', 'sungai', 'terumbu', 'dalam']);
  R.SPOTS.slice(1).forEach((s, i) => assert.equal(s.from, R.SPOTS[i].id));
});
test('every spot has at least 4 species and every species has a valid rarity and model name', () => {
  for (const s of R.SPOTS) assert.ok(R.fishAt(s.id).length >= 4, s.id);
  for (const f of R.KAIL_FISH) { assert.ok(R.RARITY_PTS[f.rar], f.id); assert.equal(f.model, R.BODY_OF[f.id] || 'fish_' + f.id); assert.match(f.model, /^fish_[A-Za-z_]+$/); assert.ok(f.kg[0] < f.kg[1]); }
});
test('forbidden reference names never appear in the data', () => {
  const bad = /Kenyir|Rajang|Semporna|Mekong|Amazon|Lofoten|Hokkaido|Geng Pekan|Pekan Pusaka|Kuala Pusaka|Dinar|Ah Seng|Arus Kencana|Anak Alur|Dinamo|Futsal Jalanan|Ekspedisi Pancing|Log selam/i;
  assert.ok(!bad.test(JSON.stringify([R.SPOTS, R.KAIL_FISH, R.TACKLE, R.BAITS])));
});
test('same seed gives the same bites, weights and fight', () => {
  const run = (seed) => { const r = mulberry32(seed), f = R.pickBite(r, ctx()), kg = R.rollWeight(r, f), st = R.startFight(r, f, kg, 'good', R.tackleStats(R.kailSave({}))); for (let i = 0; i < 80; i++) R.fightStep(st, i % 3 !== 0, .05, r); return JSON.stringify([f.id, kg, st]); };
  assert.equal(run(7), run(7)); assert.notEqual(run(7), run(8));
});
test('pickBite respects depth, bait and spot; returns null when nothing can bite', () => {
  const r = mulberry32(1);
  for (let i = 0; i < 300; i++) { const f = R.pickBite(r, ctx({ spot: 'dalam', depth: 40, bait: 'gewang' })); assert.ok(f.spots.includes('dalam')); assert.ok(f.depth[0] <= 40 && f.depth[1] >= 40); assert.ok((f.bait.gewang || 0) > 0); }
  assert.equal(R.pickBite(r, ctx({ spot: 'tasik', depth: 60 })), null);
  assert.equal(R.pickBite(r, ctx({ bait: 'tiada' })), null);
});
test('time of day and weather shift the odds', () => {
  const w = (o) => R.biteWeights(ctx({ depth: 4, bait: 'cacing', ...o })).find((x) => x.f.id === 'Keli').w;
  assert.ok(w({ hour: 23 }) > w({ hour: 12 })); assert.ok(w({ weather: 'hujan' }) > w({ weather: 'cerah' }));
});
test('rolled weights stay inside the species range and rare fish are rarer', () => {
  const r = mulberry32(3); const f = R.fishById('Layaran');
  for (let i = 0; i < 200; i++) { const kg = R.rollWeight(r, f); assert.ok(kg >= f.kg[0] && kg <= f.kg[1]); }
  const cnt = { Tilapia: 0, Sebarau: 0 }; for (let i = 0; i < 4000; i++) { const x = R.pickBite(r, ctx({ depth: 5, bait: 'umpan' })); if (cnt[x.id] !== undefined) cnt[x.id]++; }
  assert.ok(cnt.Tilapia + cnt.Sebarau > 0);
});
test('strike ring: early, good, perfect, late', () => {
  assert.equal(R.judgeStrike(-.1), 'early'); assert.equal(R.judgeStrike(.1), 'early');
  assert.equal(R.judgeStrike(.8), 'good'); assert.equal(R.judgeStrike(1.1), 'perfect'); assert.equal(R.judgeStrike(1.4), 'late');
  assert.ok(R.ringRadius(0, 1.3) === 1 && R.ringRadius(2, 1.3) === 0);
  assert.ok(R.ringWindow(1.4) > R.ringWindow(1)); // better hook, longer window
});
test('fighting without reeling for long: fish escapes or tires but never lands', () => {
  const r = mulberry32(5), f = R.fishById('Haruan'), st = R.startFight(r, f, 1.5, 'good', R.tackleStats(R.kailSave({})));
  for (let i = 0; i < 2000 && st.status === 'fighting'; i++) R.fightStep(st, false, .05, r);
  assert.notEqual(st.status, 'landed');
});
test('a small fish on a good rod is landed by steady reeling', () => {
  const k = R.kailSave({}); k.tackle.rod = 2; const r = mulberry32(9), f = R.fishById('Tilapia'), st = R.startFight(r, f, .4, 'perfect', R.tackleStats(k));
  for (let i = 0; i < 4000 && st.status === 'fighting'; i++) R.fightStep(st, true, .05, r);
  assert.equal(st.status, 'landed');
});
test('a huge fish on the weakest rod snaps the line', () => {
  const r = mulberry32(11), f = R.fishById('Layaran'), st = R.startFight(r, f, 40, 'good', R.tackleStats(R.kailSave({})));
  for (let i = 0; i < 4000 && st.status === 'fighting'; i++) R.fightStep(st, true, .05, r);
  assert.equal(st.status, 'snapped');
});
test('tension zones and staying slack too long lets the fish go', () => {
  assert.deepEqual([.1, .5, .8, .95].map(R.tensionZone), ['slack', 'safe', 'warn', 'danger']);
  const st = { fish: 'x', power: 0, dist: 20, stamina: 1, tension: 0, phase: 'rest', phaseT: 99, slackT: 0, overT: 0, status: 'fighting', line: 10, reel: 1, spd: 0, t: 0 };
  for (let i = 0; i < 100 && st.status === 'fighting'; i++) R.fightStep(st, false, .05, () => .5);
  assert.equal(st.status, 'escaped');
});
test('finished fights never move again', () => {
  const st = { status: 'landed', dist: 1 }; const before = JSON.stringify(st); R.fightStep(st, true, .05, () => .5); assert.equal(JSON.stringify(st), before);
});
test('save slice: fresh, idempotent, fills missing fields, repairs broken ones, never touches other save data', () => {
  const S = { coins: 99, sea: { rod: 2, caught: 5, best: { x: 1 } }, fishLog: { a: 1 } };
  const k = R.kailSave(S); assert.deepEqual(Object.keys(k).sort(), Object.keys(R.kailDefaults()).sort());
  assert.equal(S.coins, 99); assert.equal(S.sea.rod, 2); assert.deepEqual(S.sea.best, { x: 1 }); assert.deepEqual(S.fishLog, { a: 1 });
  const again = JSON.stringify(R.kailSave(S)); assert.equal(again, JSON.stringify(k));
  S.sea.kail.tackle.rod = 99; S.sea.kail.cooler = 'bad'; S.sea.kail.spot = 'nowhere'; S.sea.kail.points = 12;
  const fixed = R.kailSave(S); assert.equal(fixed.tackle.rod, 0); assert.deepEqual(fixed.cooler, []); assert.equal(fixed.spot, 'tasik'); assert.equal(fixed.points, 12);
});
test('spots open in order by species caught in the previous spot', () => {
  const k = R.kailSave({}); assert.deepEqual(R.unlockedSpots(k), ['tasik']);
  const tasik = R.fishAt('tasik'); for (const f of tasik.slice(0, 3)) R.logCatch(k, f, f.kg[0], 'tasik'); assert.ok(!k.spots.sungai);
  const res = R.logCatch(k, tasik[3], tasik[3].kg[0], 'tasik'); assert.deepEqual(res.unlocked, ['sungai']); assert.ok(k.spots.sungai && !k.spots.terumbu);
  assert.deepEqual(R.refreshUnlocks(k), []);
});
test('a later spot never opens by skipping an earlier one', () => {
  const k = R.kailSave({}); for (const f of R.fishAt('terumbu')) R.logCatch(k, f, f.kg[0], 'terumbu');
  assert.deepEqual(R.unlockedSpots(k), ['tasik']);
});
test('log keeps counts, records and per-spot species', () => {
  const k = R.kailSave({}), f = R.fishById('Keli');
  let a = R.logCatch(k, f, 1, 'tasik'); assert.ok(a.isNew && a.record);
  a = R.logCatch(k, f, .5, 'tasik'); assert.ok(!a.isNew && !a.record);
  a = R.logCatch(k, f, 2, 'sungai'); assert.ok(a.isNew && a.record);
  assert.equal(k.log.Keli.n, 3); assert.equal(k.log.Keli.max, 2); assert.equal(k.caught, 3);
});
test('cooler: limit, sell pays by weight and spot, then empties', () => {
  const k = R.kailSave({}), f = R.fishById('Keli'); assert.equal(R.coolerFree(k), 4);
  for (let i = 0; i < 4; i++) assert.ok(R.keepFish(k, f, 1, 'tasik')); assert.ok(!R.keepFish(k, f, 1, 'tasik')); assert.equal(R.coolerFree(k), 0);
  const rm = R.sellCooler(k); assert.equal(rm, 4 * R.sellValue(f, 1, 'tasik')); assert.ok(rm > 0 && Number.isInteger(rm));
  assert.deepEqual(k.cooler, []); assert.equal(k.sold, 4); assert.equal(R.sellCooler(k), 0);
  assert.ok(R.sellValue(f, 1, 'dalam') > R.sellValue(f, 1, 'tasik'));
});
test('release gives points, more for rare and heavy', () => {
  const k = R.kailSave({}), a = R.fishById('Tilapia'), b = R.fishById('Layaran');
  assert.ok(R.releaseFish(k, b, 40) > R.releaseFish(k, a, .2)); assert.equal(k.released, 2); assert.ok(k.points > 0);
});
test('tackle: tiers raise stats, next tier shows price, max tier gives null', () => {
  const k = R.kailSave({}); const base = R.tackleStats(k);
  k.tackle.rod = 2; k.tackle.line = 1; k.tackle.hook = 2; k.tackle.cooler = 2; const up = R.tackleStats(k);
  assert.ok(up.lineStrength > base.lineStrength && up.reel > base.reel && up.ring > base.ring && up.cap > base.cap);
  k.tackle.rod = 0; const n = R.nextTier(k, 'rod'); assert.equal(n.tier, 1); assert.equal(n.price, 350); assert.equal(n.key, 'kail:rod:1');
  k.tackle.rod = 2; assert.equal(R.nextTier(k, 'rod'), null);
});
test('bait costs: every bait priced, lure free', () => { for (const b of R.BAIT_ORDER) assert.ok(b in R.BAIT_COST && b in R.BAITS); assert.equal(R.BAIT_COST.gewang, 0); });
test('daily payout: full price up to the limit, 20% above, resets next day', () => {
  const k = R.kailSave({}); let p = R.payout(k, '2026-11-23', 500); assert.deepEqual(p, { pay: 500, capped: false });
  p = R.payout(k, '2026-11-23', 500); assert.equal(p.pay, 300 + 40); assert.ok(p.capped);
  p = R.payout(k, '2026-11-23', 100); assert.equal(p.pay, 20);
  p = R.payout(k, '2026-11-24', 100); assert.deepEqual(p, { pay: 100, capped: false });
});
test('depth helpers stay inside the spot', () => { assert.equal(R.clampDepth('tasik', 99), 12); assert.equal(R.clampDepth('tasik', -3), 0); assert.equal(R.depthStep('dalam'), 2); assert.equal(R.depthStep('tasik'), 1); });
test('save repair covers bait, depth and daily record', () => { const S = { sea: { kail: { bait: 'x', depth: -4, day: { date: 5, rm: 'a' } } } }; const k = R.kailSave(S); assert.equal(k.bait, 'cacing'); assert.equal(k.depth, 3); assert.deepEqual(k.day, { date: '', rm: 0 }); });

let failed = 0;
for (const [name, fn] of tests) { try { await fn(); console.log('PASS', name); } catch (e) { failed++; console.log('FAIL', name, '\n', e && e.message); } }
console.log(`${tests.length - failed}/${tests.length} passed`); if (failed) process.exit(1);
