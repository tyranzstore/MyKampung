// JELAJAH KAIL — pure rules (no THREE, no DOM, no clock, no Math.random).
// Every function that needs chance takes `rng` (a () => [0,1) such as mulberry32(seed)), so the same seed gives the same result.
// Rendering reads this state and never owns the rules. Tests: test/fish/*.test.mjs

// ------------------------------------------------------------ spots (names are original)
export const SPOTS = [
  { id: 'tasik', bm: 'Tasik Tenang', en: 'Calm Lake', water: 'tawar', maxDepth: 12, need: 0, sell: 1 },
  { id: 'sungai', bm: 'Sungai Lembayung', en: 'Dusk River', water: 'tawar', maxDepth: 9, need: 4, from: 'tasik', sell: 1.15 },
  { id: 'terumbu', bm: 'Terumbu Mentari', en: 'Sunrise Reef', water: 'masin', maxDepth: 35, need: 4, from: 'sungai', sell: 1.3 },
  { id: 'dalam', bm: 'Perairan Dalam', en: 'Deep Waters', water: 'masin', maxDepth: 70, need: 4, from: 'terumbu', sell: 1.5 },
];
export const spotById = (id) => SPOTS.find((s) => s.id === id) || null;

export const BAITS = {
  cacing: { bm: 'Cacing', en: 'Worm' }, udang: { bm: 'Udang', en: 'Prawn' }, sotong: { bm: 'Sotong', en: 'Squid' },
  umpan: { bm: 'Umpan hidup', en: 'Live bait' }, gewang: { bm: 'Gewang', en: 'Lure' },
};
// RM per cast; the lure is reusable so it is free (and bites less often on most species)
export const BAIT_COST = { cacing: 1, udang: 2, sotong: 3, umpan: 4, gewang: 0 };
export const BAIT_ORDER = ['cacing', 'udang', 'sotong', 'umpan', 'gewang'];
export const RARITY_PTS = { biasa: 1, luar: 3, jarang: 6, epik: 12, legenda: 25 };

// ------------------------------------------------------------ species
// spots: where it lives · depth [min,max] m · bait weights · time bonuses · weather bonuses
// str = pull strength (1 = average), spd = how fast it runs, kg = [min,max], rm = RM per kg, rar = rarity key of RARITY_PTS
// no freshwater GLBs ship in this repo: the four lake/river species borrow an existing body and get their own painted skin (fishskin.js)
export const BODY_OF = { Tilapia: 'fish_Kerisi', Keli: 'fish_Senangin', Haruan: 'fish_Alu', Sebarau: 'fish_Selar_Kuning' };
const F = (id, bm, en, rar, spots, depth, kg, rm, bait, time, weather, str, spd) => ({ id, bm, en, model: BODY_OF[id] || 'fish_' + id, rar, spots, depth, kg, rm, bait, time, weather, str, spd });
export const KAIL_FISH = [
  F('Tilapia', 'Ikan Tilapia', 'Tilapia', 'biasa', ['tasik'], [0, 6], [.2, 1.2], 8, { cacing: 1, udang: .5, umpan: .2, gewang: .2 }, { day: 1.2 }, { cerah: 1.1 }, .5, .8),
  F('Keli', 'Ikan Keli', 'Catfish', 'biasa', ['tasik', 'sungai'], [1, 10], [.3, 2.5], 9, { cacing: 1, udang: .7, umpan: .5, gewang: .1 }, { night: 1.5 }, { hujan: 1.2 }, .6, .6),
  F('Haruan', 'Ikan Haruan', 'Snakehead', 'luar', ['tasik', 'sungai'], [0, 5], [.4, 3], 18, { cacing: .5, udang: .3, umpan: 1, gewang: 1.2 }, { dawn: 1.3, dusk: 1.3 }, { mendung: 1.2 }, .9, 1),
  F('Sebarau', 'Ikan Sebarau', 'Hampala barb', 'jarang', ['tasik', 'sungai'], [2, 9], [.5, 4], 30, { cacing: .2, udang: .6, umpan: 1, gewang: 1.1 }, { dawn: 1.4, day: 1.1 }, { cerah: 1.1 }, 1.1, 1.3),
  F('Siakap', 'Ikan Siakap', 'Barramundi', 'epik', ['sungai', 'terumbu'], [1, 12], [1.5, 14], 35, { cacing: .1, udang: .6, umpan: 1.1, gewang: 1 }, { dusk: 1.5, night: 1.2 }, { hujan: 1.3 }, 1.4, 1.2),
  F('Kerisi', 'Ikan Kerisi', 'Threadfin bream', 'biasa', ['sungai', 'terumbu'], [3, 30], [.15, .6], 12, { cacing: .6, udang: 1, sotong: .8, umpan: .3, gewang: .1 }, {}, {}, .4, .9),
  F('Jebong', 'Ikan Jebong', 'Triggerfish', 'luar', ['terumbu'], [4, 28], [.4, 1.5], 12, { udang: .9, sotong: 1, umpan: .4, gewang: .3 }, { day: 1.1 }, {}, .6, .9),
  F('Kerapu', 'Ikan Kerapu', 'Grouper', 'jarang', ['terumbu'], [6, 35], [1.5, 12], 45, { udang: .9, sotong: 1, umpan: 1, gewang: .45 }, { night: 1.2 }, {}, 1.2, .8),
  F('Jenahak', 'Ikan Jenahak', 'Golden snapper', 'jarang', ['terumbu'], [8, 35], [1, 7], 40, { udang: 1, sotong: .9, umpan: .6, gewang: .35 }, { night: 1.5 }, {}, 1, .95),
  F('Gerepoh', 'Ikan Gerepoh', 'Giant trevally', 'epik', ['terumbu', 'dalam'], [0, 25], [3, 15], 18, { udang: .2, sotong: .3, umpan: .9, gewang: 1.2 }, { dawn: 1.3, day: 1.1 }, {}, 1.4, 1.5),
  F('Merah', 'Ikan Merah', 'Red snapper', 'jarang', ['dalam'], [20, 65], [1.2, 8], 38, { udang: .8, sotong: 1, umpan: .7, gewang: .3 }, { night: 1.45 }, {}, 1, .9),
  F('Tenggiri', 'Ikan Tenggiri', 'Spanish mackerel', 'jarang', ['dalam'], [0, 40], [2, 12], 40, { sotong: .3, umpan: 1, gewang: 1 }, { dawn: 1.6, dusk: 1.5 }, { cerah: 1.1 }, 1.2, 1.5),
  F('Tongkol', 'Ikan Tongkol', 'Longtail tuna', 'luar', ['dalam'], [0, 50], [1.5, 8], 15, { umpan: .9, gewang: 1 }, { day: 1.1 }, {}, 1.1, 1.3),
  F('Layaran', 'Ikan Layaran', 'Sailfish', 'legenda', ['dalam'], [0, 25], [15, 45], 25, { sotong: .2, umpan: 1, gewang: .9 }, { day: 1.2 }, { cerah: 1.1 }, 1.7, 1.7),
];
export const fishById = (id) => KAIL_FISH.find((f) => f.id === id) || null;
export const fishAt = (spotId) => KAIL_FISH.filter((f) => f.spots.includes(spotId));

// ------------------------------------------------------------ tackle (RM prices; three tiers each, tier 0 is free)
export const TACKLE = {
  rod: [{ bm: 'Joran Buluh', line: 8, reel: 1, price: 0 }, { bm: 'Joran Fiber', line: 14, reel: 1.25, price: 350 }, { bm: 'Joran Karbon', line: 24, reel: 1.5, price: 1100 }],
  line: [{ bm: 'Tali Biasa', mul: 1, price: 0 }, { bm: 'Tali Anyam', mul: 1.2, price: 250 }, { bm: 'Tali Fluorokarbon', mul: 1.45, price: 800 }],
  hook: [{ bm: 'Kail Asas', ring: 1, price: 0 }, { bm: 'Kail Tajam', ring: 1.2, price: 200 }, { bm: 'Kail Presisi', ring: 1.4, price: 650 }],
  cooler: [{ bm: 'Bekas Kecil', cap: 4, price: 0 }, { bm: 'Peti Sederhana', cap: 8, price: 300 }, { bm: 'Peti Besar', cap: 14, price: 900 }],
};
export const TACKLE_KEYS = Object.keys(TACKLE);
export const tackleKey = (slot, tier) => `kail:${slot}:${tier}`;

// ------------------------------------------------------------ save slice (adds fields only; old saves keep everything)
export const kailDefaults = () => ({ spots: { tasik: true }, log: {}, cooler: [], tackle: { rod: 0, line: 0, hook: 0, cooler: 0 }, points: 0, best: {}, caught: 0, sold: 0, released: 0, spot: 'tasik', bait: 'cacing', depth: 3, day: { date: '', rm: 0 } });
// S.sea.kail — created on first use, missing fields filled, existing values never touched
export function kailSave(S) {
  const sea = (S.sea ||= {}); const k = (sea.kail ||= kailDefaults()); const d = kailDefaults();
  for (const key of Object.keys(d)) if (k[key] === undefined || k[key] === null || typeof k[key] !== typeof d[key] || Array.isArray(k[key]) !== Array.isArray(d[key])) k[key] = d[key];
  for (const t of TACKLE_KEYS) { const v = k.tackle[t]; if (!Number.isInteger(v) || v < 0 || v >= TACKLE[t].length) k.tackle[t] = 0; }
  if (typeof k.day.date !== 'string' || !Number.isFinite(k.day.rm) || k.day.rm < 0) k.day = { date: '', rm: 0 };
  if (!BAITS[k.bait]) k.bait = 'cacing'; if (!Number.isFinite(k.depth) || k.depth < 0) k.depth = 3;
  k.spots.tasik = true; if (!spotById(k.spot) || !k.spots[k.spot]) k.spot = 'tasik';
  return k;
}
export function tackleStats(kail) {
  const t = kail.tackle, rod = TACKLE.rod[t.rod], line = TACKLE.line[t.line], hook = TACKLE.hook[t.hook], cooler = TACKLE.cooler[t.cooler];
  return { lineStrength: rod.line * line.mul, reel: rod.reel, ring: hook.ring, cap: cooler.cap };
}
// the next tier of a slot, or null when maxed
export const nextTier = (kail, slot) => { const n = kail.tackle[slot] + 1; return n < TACKLE[slot].length ? { tier: n, ...TACKLE[slot][n], key: tackleKey(slot, n) } : null; };

// ------------------------------------------------------------ progress
export const speciesInSpot = (kail, spotId) => fishAt(spotId).filter((f) => kail.log[f.id] && kail.log[f.id].spots && kail.log[f.id].spots[spotId]).length;
// a spot opens once the previous one has `need` different species in the log
export function unlockedSpots(kail) {
  const out = ['tasik'];
  for (const s of SPOTS.slice(1)) if (kail.spots[s.id] || speciesInSpot(kail, s.from) >= s.need) out.push(s.id); else break;
  return out;
}
export function refreshUnlocks(kail) {
  const open = unlockedSpots(kail), fresh = [];
  for (const id of open) if (!kail.spots[id]) { kail.spots[id] = true; fresh.push(id); }
  return fresh;
}

// ------------------------------------------------------------ bites
export const timeKey = (h) => (h < 5 || h >= 20 ? 'night' : h < 8 ? 'dawn' : h >= 17.5 ? 'dusk' : 'day');
// weight of each species for this cast: 0 when it cannot be there. ctx = { spot, depth, bait, hour, weather }
export function biteWeights(ctx) {
  const tk = timeKey(ctx.hour), out = [];
  for (const f of fishAt(ctx.spot)) {
    if (ctx.depth < f.depth[0] || ctx.depth > f.depth[1]) continue;
    const b = f.bait[ctx.bait] || 0; if (b <= 0) continue;
    const rare = { biasa: 1, luar: .6, jarang: .35, epik: .18, legenda: .08 }[f.rar];
    out.push({ f, w: b * rare * (f.time[tk] || 1) * (f.weather[ctx.weather] || 1) });
  }
  return out;
}
export function pickBite(rng, ctx) {
  const ws = biteWeights(ctx), total = ws.reduce((a, x) => a + x.w, 0); if (total <= 0) return null;
  let r = rng() * total; for (const x of ws) { r -= x.w; if (r <= 0) return x.f; } return ws[ws.length - 1].f;
}
// seconds until something bites (longer for night/rain is not modelled — keep waiting short on a phone)
export const biteDelay = (rng, ctx) => (ctx.weather === 'ribut' ? 9 : 3) + rng() * 6;
export const rollWeight = (rng, f) => { const t = rng() * rng(); const r = (rng() + t) / 2; return Math.round((f.kg[0] + (f.kg[1] - f.kg[0]) * r * r) * 100) / 100; };
export const weightFrac = (f, kg) => (f.kg[1] === f.kg[0] ? 0 : Math.max(0, Math.min(1, (kg - f.kg[0]) / (f.kg[1] - f.kg[0]))));
export const lengthCm = (f, kg) => Math.round(Math.cbrt((kg * 1000) / (f.rar === 'legenda' ? .0045 : .014)));

// ------------------------------------------------------------ strike ring: r goes 1 -> 0 over `win` seconds
export const ringWindow = (ring = 1) => 1.3 * ring;
export const ringRadius = (t, win) => Math.max(0, 1 - t / win);
// t = seconds since the ring appeared (negative = struck before the bite). Returns 'early' | 'good' | 'perfect' | 'late'
export function judgeStrike(t, ring = 1) {
  const win = ringWindow(ring); if (t < 0) return 'early'; if (t >= win) return 'late';
  const r = ringRadius(t, win); return r > .45 ? 'early' : r > .2 ? 'good' : 'perfect';
}

// ------------------------------------------------------------ fight
// state: { dist m, stamina 0..1, tension 0..1+, phase 'run'|'rest', phaseT s, slackT, overT, status }
// status: 'fighting' | 'landed' | 'snapped' | 'escaped'
export function startFight(rng, f, kg, strike, stats) {
  const frac = weightFrac(f, kg);
  return { fish: f.id, kg, power: f.str * (4 + 10 * frac), dist: 6 + frac * 14 + rng() * 4, stamina: strike === 'perfect' ? .75 : strike === 'good' ? .9 : 1,
    tension: .4, phase: 'rest', phaseT: .8 + rng() * .8, slackT: 0, overT: 0, status: 'fighting', line: stats.lineStrength, reel: stats.reel, spd: f.spd, t: 0 };
}
export const tensionZone = (t) => (t < .25 ? 'slack' : t < .7 ? 'safe' : t < .9 ? 'warn' : 'danger');
// one step. reeling = player holds the reel. dt in seconds (callers clamp to <= .1)
export function fightStep(st, reeling, dt, rng) {
  if (st.status !== 'fighting') return st;
  st.t += dt; st.phaseT -= dt;
  if (st.phaseT <= 0) { // fish alternates between runs and rests; tired fish rest longer
    st.phase = st.phase === 'rest' ? 'run' : 'rest';
    st.phaseT = st.phase === 'run' ? .9 + rng() * 1.3 : (1 + rng() * 1.2) * (1 + (1 - st.stamina) * 1.5);
  }
  const eff = .35 + .65 * st.stamina, pull = st.power * eff * (st.phase === 'run' ? 1.35 : .45);
  const raw = pull + (reeling ? 3 * st.reel : 0) * (st.phase === 'rest' ? .5 : 1);
  const target = raw / st.line;
  st.tension += (target - st.tension) * Math.min(1, dt * 6);
  const zone = tensionZone(st.tension);
  if (reeling && zone !== 'danger') st.dist -= 1.25 * st.reel * (1 - st.stamina * .45) * dt * (st.phase === 'run' ? .35 : 1);
  if (st.phase === 'run') st.dist += (.6 + st.spd) * eff * dt * (reeling ? .5 : 1.6);
  if (zone === 'safe' || zone === 'warn') st.stamina = Math.max(0, st.stamina - dt * (zone === 'warn' ? .09 : .05) * (st.phase === 'run' ? 1.4 : 1));
  else if (zone === 'slack') st.stamina = Math.min(1, st.stamina + dt * .03);
  st.overT = st.tension >= 1 ? st.overT + dt : Math.max(0, st.overT - dt * 2);
  st.slackT = zone === 'slack' && !reeling ? st.slackT + dt : Math.max(0, st.slackT - dt);
  if (st.tension >= 1.3 || st.overT > .35) st.status = 'snapped';
  else if (st.slackT > 2.2) st.status = 'escaped';
  else if (st.dist <= 1) { st.dist = 1; st.status = 'landed'; }
  else if (st.dist > 60) st.status = 'escaped';
  return st;
}

// ------------------------------------------------------------ catch, cooler, money
export const sellValue = (f, kg, spotId) => Math.max(1, Math.round(kg * f.rm * (spotById(spotId) ? spotById(spotId).sell : 1)));
export const releasePoints = (f, kg) => Math.round(RARITY_PTS[f.rar] * (1 + weightFrac(f, kg)));
export const coolerFree = (kail) => TACKLE.cooler[kail.tackle.cooler].cap - kail.cooler.length;
// record a landed fish in the log. returns { isNew, record }
export function logCatch(kail, f, kg, spotId) {
  const e = kail.log[f.id], isNew = !e || !e.spots || !e.spots[spotId], record = !e || kg > e.max;
  const spots = { ...(e && e.spots ? e.spots : {}), [spotId]: true };
  kail.log[f.id] = { n: (e ? e.n : 0) + 1, max: record ? kg : e.max, spots };
  kail.best[f.id] = Math.max(kail.best[f.id] || 0, kg); kail.caught++;
  return { isNew, record, unlocked: refreshUnlocks(kail) };
}
// keep a fish in the cooler. false when full
export function keepFish(kail, f, kg, spotId) { if (coolerFree(kail) <= 0) return false; kail.cooler.push({ id: f.id, kg, spot: spotId }); return true; }
// sell the whole cooler: returns RM to pay (caller pays through wallet.earn). Cooler is emptied.
export function sellCooler(kail) {
  let rm = 0; for (const c of kail.cooler) { const f = fishById(c.id); if (f) rm += sellValue(f, c.kg, c.spot); }
  kail.sold += kail.cooler.length; kail.cooler = []; return rm;
}
export function releaseFish(kail, f, kg) { const p = releasePoints(f, kg); kail.points += p; kail.released++; return p; }

// ------------------------------------------------------------ daily income limit (keeps the shared RM wallet balanced)
export const DAILY_FULL_RM = 800, OVER_RATE = .2;
// how much RM to pay for a sale of `rm` on `date` (YYYY-M-D). Full price up to DAILY_FULL_RM a day, then OVER_RATE. Updates kail.day.
export function payout(kail, date, rm) {
  if (kail.day.date !== date) kail.day = { date, rm: 0 };
  const room = Math.max(0, DAILY_FULL_RM - kail.day.rm), full = Math.min(rm, room), over = rm - full;
  const pay = Math.round(full + over * OVER_RATE); kail.day.rm += full; return { pay, capped: over > 0 };
}
// depth steps the player can choose at a spot
export const depthStep = (spotId) => (spotById(spotId).maxDepth > 20 ? 2 : 1);
export const clampDepth = (spotId, d) => Math.max(0, Math.min(spotById(spotId).maxDepth, Math.round(d)));
