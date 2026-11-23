// BOT MODULAR — pure rules (no THREE, no DOM, no clock). Tests: test/boat/boatrules.test.mjs
// Data comes from boatparts.js (passed in as `cfg`, so tests can use their own). Levels are 1..4; 0 = slot empty (removed).
import { BOAT, SLOT_KEYS, MAX_LEVEL } from './boatparts.js';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const vec3 = (v) => Array.isArray(v) && v.length === 3 && v.every(isNum);
export const partKey = (slot, level) => `bot:${slot}:${level}`;
// pack model id a component GLB is published under (assets/packs/bot/<slot>_lv<level>.glb)
export const modelId = (slot, level) => `bot/${slot}_lv${level}`;
export const levelOf = (cfg, slot, level) => (cfg.slots[slot] && level >= 1 ? cfg.slots[slot].levels[level - 1] || null : null);

// ------------------------------------------------------------ config check: returns a list of problems (empty = valid)
export function validateConfig(cfg = BOAT) {
  const bad = [], slots = Object.keys(cfg.slots || {});
  if (!cfg.hull || typeof cfg.hull.model !== 'string' || !(cfg.hull.lengthM > 0)) bad.push('hull: needs model and lengthM');
  for (const s of slots) {
    const d = cfg.slots[s];
    if (!d.bm || !d.en) bad.push(`${s}: bm/en names`);
    if (!d.anchor || !vec3(d.anchor.pos) || !vec3(d.anchor.rot) || !(d.anchor.scale > 0)) bad.push(`${s}: anchor`);
    if (!vec3(d.size) || d.size.some((v) => v <= 0)) bad.push(`${s}: placeholder size`);
    if (!Array.isArray(d.levels) || d.levels.length !== MAX_LEVEL) { bad.push(`${s}: needs ${MAX_LEVEL} levels`); continue; }
    d.levels.forEach((L, i) => {
      if (!L.bm || !L.en) bad.push(`${s} L${i + 1}: names`);
      if (!Number.isInteger(L.price) || L.price < 0) bad.push(`${s} L${i + 1}: price`);
      if (i === 0 && L.price !== 0) bad.push(`${s} L1 must be free`);
      if (i > 0 && !(L.price > d.levels[i - 1].price)) bad.push(`${s} L${i + 1}: price must rise`);
      if (!isNum(L.value) || (i > 0 && L.value < d.levels[i - 1].value)) bad.push(`${s} L${i + 1}: value must not fall`);
      if (L.builtin && !(cfg.builtins && cfg.builtins[L.builtin])) bad.push(`${s} L${i + 1}: unknown builtin ${L.builtin}`);
      if (L.offset && L.offset.pos && !vec3(L.offset.pos)) bad.push(`${s} L${i + 1}: offset.pos`);
      for (const [rs, rl] of Object.entries(L.requires || {})) { if (!cfg.slots[rs] || rs === s || !(rl >= 1 && rl <= MAX_LEVEL)) bad.push(`${s} L${i + 1}: requires ${rs} ${rl}`); }
    });
  }
  for (const [name, b] of Object.entries(cfg.builtins || {})) {
    if (!cfg.slots[b.slot]) bad.push(`builtin ${name}: slot`);
    if (!Array.isArray(b.box) || !vec3(b.box[0]) || !vec3(b.box[1]) || b.box[0].some((v, i) => v >= b.box[1][i])) bad.push(`builtin ${name}: box`);
  }
  return bad;
}

// ------------------------------------------------------------ save slice S.sea.bot (adds fields only)
export function botDefaults(cfg = BOAT) {
  const owned = {}, equipped = {}; for (const s of Object.keys(cfg.slots)) { owned[s] = [1]; equipped[s] = 1; }
  return { hull: cfg.hull.id, owned, equipped };
}
// created on first use; missing or broken fields are repaired; nothing else in the save is touched
export function botSave(S, cfg = BOAT) {
  const sea = (S.sea ||= {}), d = botDefaults(cfg); let b = sea.bot; if (!b || typeof b !== 'object' || Array.isArray(b)) b = sea.bot = d;
  if (typeof b.hull !== 'string') b.hull = d.hull;
  if (!b.owned || typeof b.owned !== 'object' || Array.isArray(b.owned)) b.owned = {};
  if (!b.equipped || typeof b.equipped !== 'object' || Array.isArray(b.equipped)) b.equipped = {};
  for (const s of Object.keys(cfg.slots)) {
    let o = Array.isArray(b.owned[s]) ? b.owned[s].filter((v) => Number.isInteger(v) && v >= 1 && v <= MAX_LEVEL) : [];
    if (!o.includes(1)) o.push(1); b.owned[s] = [...new Set(o)].sort((x, y) => x - y);
    const e = b.equipped[s]; if (!Number.isInteger(e) || e < 0 || e > MAX_LEVEL || (e > 0 && !b.owned[s].includes(e))) b.equipped[s] = 1;
  }
  return b;
}
export const owns = (bot, slot, level) => !!(bot.owned[slot] && bot.owned[slot].includes(level));
export const highestOwned = (bot, slot) => Math.max(0, ...(bot.owned[slot] || []));

// ------------------------------------------------------------ buy (in order: level N needs level N-1)
// reasons: 'unknown' | 'owned' | 'order' | 'funds'
export function canBuy(bot, slot, level, balance, cfg = BOAT) {
  const L = levelOf(cfg, slot, level); if (!L) return { ok: false, reason: 'unknown' };
  if (owns(bot, slot, level)) return { ok: false, reason: 'owned' };
  if (level > 1 && !owns(bot, slot, level - 1)) return { ok: false, reason: 'order', need: level - 1 };
  if (!(balance >= L.price)) return { ok: false, reason: 'funds', short: L.price - Math.max(0, balance || 0) };
  return { ok: true, price: L.price, key: partKey(slot, level) };
}
// record a purchase the wallet has already charged
export function addOwned(bot, slot, level, cfg = BOAT) { if (!levelOf(cfg, slot, level) || owns(bot, slot, level)) return false; bot.owned[slot].push(level); bot.owned[slot].sort((x, y) => x - y); return true; }

// ------------------------------------------------------------ compatibility
// what a level still needs on this boat: [{ slot, level, have }]
export function missingFor(bot, slot, level, cfg = BOAT) {
  const L = levelOf(cfg, slot, level), out = []; if (!L) return out;
  for (const [rs, rl] of Object.entries(L.requires || {})) if ((bot.equipped[rs] || 0) < rl) out.push({ slot: rs, level: rl, have: bot.equipped[rs] || 0 });
  return out;
}
// equipped parts that would stop working if `slot` dropped to `level`: [{ slot, level }]
export function dependents(bot, slot, level, cfg = BOAT) {
  const out = [];
  for (const s of Object.keys(cfg.slots)) { if (s === slot) continue; const L = levelOf(cfg, s, bot.equipped[s]); const need = L && L.requires && L.requires[slot]; if (need && level < need) out.push({ slot: s, level: bot.equipped[s] }); }
  return out;
}
// reasons: 'unknown' | 'notOwned' | 'requires' (missing: [...]) | 'needed' (by: [...]) | 'same'
export function canEquip(bot, slot, level, cfg = BOAT) {
  if (!cfg.slots[slot] || !Number.isInteger(level) || level < 0 || level > MAX_LEVEL) return { ok: false, reason: 'unknown' };
  if (bot.equipped[slot] === level) return { ok: false, reason: 'same' };
  if (level > 0 && !owns(bot, slot, level)) return { ok: false, reason: 'notOwned' };
  const miss = level > 0 ? missingFor(bot, slot, level, cfg) : []; if (miss.length) return { ok: false, reason: 'requires', missing: miss };
  const by = dependents(bot, slot, level, cfg); if (by.length) return { ok: false, reason: 'needed', by };
  return { ok: true };
}
export function equip(bot, slot, level, cfg = BOAT) { const r = canEquip(bot, slot, level, cfg); if (r.ok) bot.equipped[slot] = level; return r; }
export const unequip = (bot, slot, cfg = BOAT) => equip(bot, slot, 0, cfg);

// ------------------------------------------------------------ what the boat does
// { speed, turn, accel, cooler, line, bite } — an empty slot gives its level-1 value (the boat still works), except speed: no engine = paddling
export function boatStats(bot, cfg = BOAT) {
  const out = {};
  for (const s of Object.keys(cfg.slots)) { const d = cfg.slots[s], lv = bot.equipped[s] || 0; out[d.stat] = lv > 0 ? d.levels[lv - 1].value : s === 'engine' ? 2 : d.levels[0].value; }
  return out;
}

// ------------------------------------------------------------ where things go
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
// final transform of a slot's component in hull units: slot anchor + level offset + tuning ({ pos, rot, scale } deltas from adjust mode)
export function anchorFor(slot, level, tune = null, cfg = BOAT) {
  const d = cfg.slots[slot]; if (!d) return null; const L = levelOf(cfg, slot, level) || {}, o = L.offset || {}, t = tune || {};
  return { pos: add3(add3(d.anchor.pos, o.pos || [0, 0, 0]), t.pos || [0, 0, 0]), rot: add3(add3(d.anchor.rot, o.rot || [0, 0, 0]), t.rot || [0, 0, 0]), scale: d.anchor.scale * (o.scale || 1) * (t.scale || 1) };
}
// what to draw in each slot: { slot, level, kind: 'empty' | 'builtin' | 'model', model, anchor, size }
export function layout(bot, tunes = {}, cfg = BOAT) {
  return Object.keys(cfg.slots).map((s) => { const lv = bot.equipped[s] || 0, L = levelOf(cfg, s, lv);
    if (!L) return { slot: s, level: 0, kind: 'empty' };
    if (L.builtin) return { slot: s, level: lv, kind: 'builtin', builtin: L.builtin };
    return { slot: s, level: lv, kind: 'model', model: modelId(s, lv), anchor: anchorFor(s, lv, tunes[`${s}:${lv}`], cfg), size: cfg.slots[s].size }; });
}
// names of built-in hull parts to hide for this configuration
export function hiddenBuiltins(bot, cfg = BOAT) {
  return Object.entries(cfg.builtins || {}).filter(([, b]) => (bot.equipped[b.slot] || 0) !== b.shownAt).map(([n]) => n);
}

// ------------------------------------------------------------ hull geometry: separate "islands" of triangles
// positions: flat [x,y,z,...]; indices: flat triangle list. Vertices at the same place are welded first (GLB exporters split them at UV seams).
// Returns [{ tris: Uint32Array of triangle numbers, count, min: [x,y,z], max: [x,y,z] }] sorted by size, largest first.
export function findIslands(positions, indices, weld = 20000) {
  const nV = positions.length / 3, ids = new Map(), w = new Int32Array(nV); let n = 0;
  for (let i = 0; i < nV; i++) { const k = `${Math.round(positions[i * 3] * weld)},${Math.round(positions[i * 3 + 1] * weld)},${Math.round(positions[i * 3 + 2] * weld)}`; let id = ids.get(k); if (id === undefined) { id = n++; ids.set(k, id); } w[i] = id; }
  const par = new Int32Array(n); for (let i = 0; i < n; i++) par[i] = i;
  const find = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  const nT = indices.length / 3; for (let t = 0; t < nT; t++) { const a = find(w[indices[t * 3]]), b = find(w[indices[t * 3 + 1]]), c = find(w[indices[t * 3 + 2]]); par[b] = a; par[c] = a; }
  const groups = new Map();
  for (let t = 0; t < nT; t++) { const r = find(w[indices[t * 3]]); let g = groups.get(r); if (!g) groups.set(r, g = { list: [], min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }); g.list.push(t);
    for (let k = 0; k < 3; k++) { const v = indices[t * 3 + k]; for (let a = 0; a < 3; a++) { const p = positions[v * 3 + a]; if (p < g.min[a]) g.min[a] = p; if (p > g.max[a]) g.max[a] = p; } } }
  return [...groups.values()].map((g) => ({ tris: Uint32Array.from(g.list), count: g.list.length, min: g.min, max: g.max })).sort((a, b) => b.count - a.count);
}
const inside = (isl, box) => isl.min.every((v, a) => v >= box[0][a]) && isl.max.every((v, a) => v <= box[1][a]);
// islands that belong to a built-in part (never the largest island: that is the hull itself)
export function builtinIslands(islands, name, cfg = BOAT) { const b = cfg.builtins && cfg.builtins[name]; return b ? islands.filter((isl, i) => i > 0 && inside(isl, b.box)) : []; }
// triangle numbers to drop for a list of hidden built-in names
export function hiddenTriangles(islands, names, cfg = BOAT) { const out = new Set(); for (const n of names) for (const isl of builtinIslands(islands, n, cfg)) for (const t of isl.tris) out.add(t); return out; }

export { BOAT, SLOT_KEYS, MAX_LEVEL };
