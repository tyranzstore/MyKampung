// Modular boat rules, configuration and hull file: run with `node test/boat/boatrules.test.mjs` from the project root.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as R from '../../js/boatrules.js';
import { checkGlb, SPECS, imageSize } from '../../tools/check_glb.mjs';

const { BOAT, SLOT_KEYS, MAX_LEVEL } = R;
const tests = []; const test = (n, f) => tests.push([n, f]);
const HULL = new URL('../../assets/packs/bot/hull_lv1.glb', import.meta.url);
const fresh = () => R.botSave({});
const ownAll = (b) => { for (const s of SLOT_KEYS) b.owned[s] = [1, 2, 3, 4]; return b; };
// minimal GLB reader: first mesh primitive's positions and indices, plus the embedded images
function readHull() {
  const b = readFileSync(HULL), jl = b.readUInt32LE(12), j = JSON.parse(b.subarray(20, 20 + jl).toString('utf8')), bin = 20 + jl + 8;
  const acc = (i) => { const a = j.accessors[i], bv = j.bufferViews[a.bufferView], off = bin + (bv.byteOffset || 0) + (a.byteOffset || 0), n = { SCALAR: 1, VEC2: 2, VEC3: 3 }[a.type] * a.count;
    const out = a.componentType === 5126 ? new Float32Array(n) : new Uint32Array(n); for (let k = 0; k < n; k++) out[k] = a.componentType === 5126 ? b.readFloatLE(off + k * 4) : a.componentType === 5125 ? b.readUInt32LE(off + k * 4) : b.readUInt16LE(off + k * 2); return out; };
  const p = j.meshes[0].primitives[0], images = (j.images || []).map((im) => { const bv = j.bufferViews[im.bufferView]; return imageSize(b.subarray(bin + (bv.byteOffset || 0), bin + (bv.byteOffset || 0) + bv.byteLength)); });
  return { json: j, buf: b, pos: acc(p.attributes.POSITION), idx: acc(p.indices), images };
}
let hullCache = null; const hull = () => hullCache || (hullCache = (() => { const h = readHull(); h.islands = R.findIslands(h.pos, h.idx); return h; })());

// ------------------------------------------------------------ configuration
test('config is valid: six slots, four levels each, level 1 free, prices rise', () => {
  assert.deepEqual(R.validateConfig(), []);
  assert.deepEqual(SLOT_KEYS, ['engine', 'steering', 'propeller', 'seat', 'fishing', 'accessory']); assert.equal(MAX_LEVEL, 4);
  for (const s of SLOT_KEYS) { const L = BOAT.slots[s].levels; assert.equal(L.length, 4); assert.equal(L[0].price, 0); for (let i = 1; i < 4; i++) assert.ok(L[i].price > L[i - 1].price && L[i].value >= L[i - 1].value, s); }
});
test('validateConfig reports broken data', () => {
  const c = structuredClone(BOAT); c.slots.engine.levels[1].price = -5; c.slots.seat.levels.pop(); c.slots.fishing.anchor.pos = [0, 0]; c.builtins.wheel.box = [[1, 1, 1], [0, 0, 0]]; c.slots.propeller.levels[2].requires = { nope: 2 };
  const bad = R.validateConfig(c); for (const k of ['engine L2: price', 'seat: needs 4 levels', 'fishing: anchor', 'builtin wheel: box', 'propeller L3: requires nope 2']) assert.ok(bad.includes(k), k + ' in ' + bad.join(' | '));
});
test('names are bilingual and no forbidden reference name is used', () => {
  const txt = JSON.stringify(BOAT); assert.ok(!/Geng Pekan|Pekan Pusaka|Kuala Pusaka|Dinar|Ah Seng|Arus Kencana|Anak Alur|Dinamo|Kenyir|Rajang|Semporna|Mekong|Amazon|Lofoten|Hokkaido/i.test(txt));
  for (const s of SLOT_KEYS) for (const L of BOAT.slots[s].levels) assert.ok(L.bm && L.en);
});
test('model ids and wallet keys follow the naming rule', () => { assert.equal(R.modelId('engine', 3), 'bot/engine_lv3'); assert.equal(R.partKey('seat', 2), 'bot:seat:2'); assert.equal(R.levelOf(BOAT, 'engine', 0), null); assert.equal(R.levelOf(BOAT, 'engine', 5), null); });

// ------------------------------------------------------------ save
test('fresh save: level 1 owned and equipped in every slot', () => { const b = fresh(); for (const s of SLOT_KEYS) { assert.deepEqual(b.owned[s], [1]); assert.equal(b.equipped[s], 1); } assert.equal(b.hull, 'hull_lv1'); });
test('an old save keeps every field; the boat slice is only added', () => {
  const S = { coins: 777, chapter: 5, fishLog: { a: 1 }, owned: { 'veh:lekiu': 1 }, sea: { rod: 2, engine: 1, finder: 2, best: { x: 3 }, kail: { points: 9 } } }, before = JSON.stringify(S);
  const b = R.botSave(S), after = structuredClone(S); delete after.sea.bot; assert.equal(JSON.stringify(after), before); assert.equal(S.sea.engine, 1); assert.equal(S.sea.finder, 2);
  assert.equal(JSON.stringify(R.botSave(S)), JSON.stringify(b)); // idempotent
});
test('broken boat data is repaired without losing valid purchases', () => {
  const S = { sea: { bot: { owned: { engine: [3, 2, 2, 9, 'x'], seat: 'bad' }, equipped: { engine: 4, steering: -1, seat: 2 } } } }, b = R.botSave(S);
  assert.deepEqual(b.owned.engine, [1, 2, 3]); assert.deepEqual(b.owned.seat, [1]); assert.equal(b.equipped.engine, 1); assert.equal(b.equipped.steering, 1); assert.equal(b.equipped.seat, 1); assert.equal(b.equipped.fishing, 1);
  assert.equal(R.botSave({ sea: { bot: [] } }).equipped.engine, 1);
});
test('an empty slot (0) survives a reload', () => { const S = {}; const b = R.botSave(S); R.unequip(b, 'accessory'); assert.equal(R.botSave(JSON.parse(JSON.stringify(S))).equipped.accessory, 0); });

// ------------------------------------------------------------ buying
test('buy in order, with enough money, once', () => {
  const b = fresh();
  assert.deepEqual(R.canBuy(b, 'engine', 2, 600), { ok: true, price: 600, key: 'bot:engine:2' });
  assert.deepEqual(R.canBuy(b, 'engine', 2, 599), { ok: false, reason: 'funds', short: 1 });
  assert.equal(R.canBuy(b, 'engine', 3, 99999).reason, 'order'); assert.equal(R.canBuy(b, 'engine', 1, 99999).reason, 'owned'); assert.equal(R.canBuy(b, 'engine', 5, 99999).reason, 'unknown'); assert.equal(R.canBuy(b, 'nope', 1, 9).reason, 'unknown');
  assert.ok(R.addOwned(b, 'engine', 2)); assert.ok(!R.addOwned(b, 'engine', 2)); assert.deepEqual(b.owned.engine, [1, 2]); assert.equal(R.highestOwned(b, 'engine'), 2);
  assert.equal(R.canBuy(b, 'engine', 2, 99999).reason, 'owned'); assert.equal(b.equipped.engine, 1); // buying does not install
});

// ------------------------------------------------------------ install / remove / compatibility
test('install needs ownership and compatible parts', () => {
  const b = ownAll(fresh());
  assert.equal(R.canEquip(fresh(), 'engine', 2).reason, 'notOwned');
  const r = R.equip(b, 'engine', 3); assert.equal(r.reason, 'requires'); assert.deepEqual(r.missing, [{ slot: 'steering', level: 2, have: 1 }]); assert.equal(b.equipped.engine, 1);
  assert.ok(R.equip(b, 'steering', 2).ok); assert.ok(R.equip(b, 'engine', 3).ok); assert.equal(b.equipped.engine, 3);
  assert.equal(R.equip(b, 'engine', 3).reason, 'same'); assert.equal(R.equip(b, 'engine', 7).reason, 'unknown');
});
test('a part other parts depend on cannot be removed or downgraded first', () => {
  const b = ownAll(fresh()); R.equip(b, 'steering', 2); R.equip(b, 'engine', 3);
  const r = R.unequip(b, 'steering'); assert.equal(r.reason, 'needed'); assert.deepEqual(r.by, [{ slot: 'engine', level: 3 }]); assert.equal(b.equipped.steering, 2);
  assert.equal(R.equip(b, 'steering', 1).reason, 'needed'); assert.ok(R.equip(b, 'steering', 3).ok);
  assert.ok(R.equip(b, 'engine', 1).ok); assert.ok(R.unequip(b, 'steering').ok); assert.equal(b.equipped.steering, 0);
});
test('every level of every slot can be reached (no dead ends in the requirements)', () => {
  const b = ownAll(fresh()); let moved = true, guard = 0;
  while (moved && guard++ < 50) { moved = false; for (const s of SLOT_KEYS) if (b.equipped[s] < 4 && R.equip(b, s, b.equipped[s] + 1).ok) moved = true; }
  for (const s of SLOT_KEYS) assert.equal(b.equipped[s], 4, s);
});
test('remove then reinstall any slot on a basic boat', () => { const b = fresh(); for (const s of SLOT_KEYS) { assert.ok(R.unequip(b, s).ok, s); assert.equal(b.equipped[s], 0); assert.ok(R.equip(b, s, 1).ok); } });

// ------------------------------------------------------------ effects
test('stats follow the installed parts; no engine means paddling', () => {
  const b = ownAll(fresh()), s0 = R.boatStats(b); assert.deepEqual(s0, { speed: 7, turn: 1, accel: 1, cooler: 0, line: 1, bite: 1 });
  R.equip(b, 'seat', 4); R.equip(b, 'fishing', 3); R.equip(b, 'engine', 2); const s1 = R.boatStats(b); assert.equal(s1.speed, 9); assert.equal(s1.cooler, 6); assert.equal(s1.line, 1.2);
  R.unequip(b, 'engine'); assert.equal(R.boatStats(b).speed, 2); R.unequip(b, 'accessory'); assert.equal(R.boatStats(b).bite, 1);
});

// ------------------------------------------------------------ layout and anchors
test('layout: built-in, model and empty slots; hidden built-ins follow the configuration', () => {
  const b = ownAll(fresh()); let L = R.layout(b); assert.equal(L.find((x) => x.slot === 'steering').kind, 'builtin'); assert.equal(L.find((x) => x.slot === 'seat').builtin, 'seatBack'); assert.equal(L.find((x) => x.slot === 'engine').model, 'bot/engine_lv1');
  assert.deepEqual(R.hiddenBuiltins(b), []);
  R.equip(b, 'steering', 2); R.unequip(b, 'seat'); L = R.layout(b); assert.equal(L.find((x) => x.slot === 'steering').model, 'bot/steering_lv2'); assert.equal(L.find((x) => x.slot === 'seat').kind, 'empty');
  assert.deepEqual(R.hiddenBuiltins(b).sort(), ['seatBack', 'wheel']);
});
test('anchor = slot anchor + level offset + tuning; scale multiplies', () => {
  const a = R.anchorFor('accessory', 3); assert.deepEqual(a.pos.map((v) => +v.toFixed(3)), [-.05, .33, 0]); assert.equal(a.scale, 1);
  const t = R.anchorFor('engine', 2, { pos: [.01, 0, -.02], rot: [0, 90, 0], scale: 1.5 }); assert.deepEqual(t.pos.map((v) => +v.toFixed(3)), [-.51, .2, -.02]); assert.deepEqual(t.rot, [0, 90, 0]); assert.equal(t.scale, 1.5);
  assert.equal(R.anchorFor('nope', 1), null);
  const L = R.layout(ownAll(fresh()), { 'engine:1': { pos: [0, .05, 0] } }); assert.equal(+L.find((x) => x.slot === 'engine').anchor.pos[1].toFixed(3), .25);
});
test('every anchor sits on or near the hull (within its bounding box plus a margin)', () => {
  for (const s of SLOT_KEYS) for (let lv = 1; lv <= 4; lv++) { const p = R.anchorFor(s, lv).pos; assert.ok(p[0] >= -.62 && p[0] <= .55 && p[1] >= 0 && p[1] <= .5 && Math.abs(p[2]) <= .22, `${s} L${lv} ${p}`); }
});

// ------------------------------------------------------------ the hull file
test('hull GLB passes the mobile pack check with no warnings and a texture of 1024 px or less', () => {
  const h = hull(), res = checkGlb(h.buf, SPECS.packAsset), fails = res.results.filter((c) => c.level === 'FAIL'), warns = res.results.filter((c) => c.level === 'WARN');
  assert.deepEqual(fails, []); assert.deepEqual(warns, []); assert.equal(h.images.length, 1); assert.ok(Math.max(h.images[0].w, h.images[0].h) <= 1024);
  assert.ok(h.buf.length < 2 * 1024 * 1024); assert.equal(h.idx.length / 3, 9858); // geometry untouched by the texture resize
});
test('hull is listed in the pack index as a valid model', () => {
  const idx = JSON.parse(readFileSync(new URL('../../assets/packs/index.json', import.meta.url), 'utf8')), m = idx.packs.bot.models[BOAT.hull.model];
  assert.ok(m && m.valid === true && m.path === 'assets/packs/bot/hull_lv1.glb');
});
test('hull splits into separate parts; the hull shell itself is the largest and is never hidden', () => {
  const { islands } = hull(); assert.equal(islands.length, 58); assert.equal(islands[0].count, 2812);
  assert.equal(islands.reduce((a, i) => a + i.count, 0), 9858);
  for (const n of Object.keys(BOAT.builtins)) assert.ok(!R.builtinIslands(islands, n).includes(islands[0]), n);
});
test('built-in wheel and backrest are found as whole parts and can be hidden', () => {
  const { islands } = hull(), wheel = R.builtinIslands(islands, 'wheel'), seat = R.builtinIslands(islands, 'seatBack');
  assert.equal(wheel.length, 3); assert.equal(wheel.reduce((a, i) => a + i.count, 0), 2132 + 192 + 116);
  assert.equal(seat.length, 16); assert.equal(seat.reduce((a, i) => a + i.count, 0), 488 + 262 + 175 + 96 + 84 + 84 + 10 * 36);
  const none = R.hiddenTriangles(islands, []), both = R.hiddenTriangles(islands, ['wheel', 'seatBack']); assert.equal(none.size, 0); assert.equal(both.size, 2440 + 1549);
  const wset = new Set(wheel.flatMap((i) => [...i.tris])), sset = new Set(seat.flatMap((i) => [...i.tris])); for (const t of wset) assert.ok(!sset.has(t)); // no part is claimed twice
});
test('findIslands on a tiny mesh: two triangles sharing an edge are one part, a far triangle is another', () => {
  const pos = [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 5, 5, 5, 6, 5, 5, 5, 6, 5, /* duplicate of vertex 1 (UV seam) */ 1, 0, 0], idx = [0, 1, 2, 7, 3, 2, 4, 5, 6];
  const isl = R.findIslands(pos, idx); assert.equal(isl.length, 2); assert.equal(isl[0].count, 2); assert.deepEqual(isl[1].min, [5, 5, 5]); assert.deepEqual([...isl[1].tris], [2]);
});

let failed = 0;
for (const [name, fn] of tests) { try { await fn(); console.log('PASS', name); } catch (e) { failed++; console.log('FAIL', name, '\n', e && e.message); } }
console.log(`${tests.length - failed}/${tests.length} passed`); if (failed) process.exit(1);
