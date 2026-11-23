// JALAN DRAG — vehicles, parts, economy and the player's garage (pure data + rules; no DOM, testable in node).
// All vehicles are original and fictional (Malaysian-inspired names). Every part changes the physics spec and/or the look.
import { bestLaunch, simulate, DIST } from './dragphys.js';

// base specs. torque Nm @ peakRpm, mass kg incl. rider/driver, cdA m², front = static weight on the front axle
export const VEHICLES = {
  tuah: { cat: 'car', bm: 'Tuah Mini', en: 'Compact hatchback', body: 'hatch', drive: 'F', mass: 900, front: .62, wb: 2.4, cgH: .52, torque: 122, peakRpm: 4300, idle: 900, limiter: 6900, gears: [3.4, 1.95, 1.33, 1.03, .82], final: 4.25, r: .29, cdA: .68, price: 0, color: '#f1c40f' },
  jebat: { cat: 'car', bm: 'Jebat 1.8', en: 'Family sedan', body: 'sedan', drive: 'F', mass: 1180, front: .6, wb: 2.6, cgH: .53, torque: 182, peakRpm: 4400, idle: 850, limiter: 6900, gears: [3.3, 1.9, 1.3, 1.0, .8], final: 4.1, r: .31, cdA: .66, price: 2800, color: '#2e86de' },
  lekiu: { cat: 'car', bm: 'Lekiu GT', en: 'Sports coupe', body: 'coupe', drive: 'R', mass: 1330, front: .53, wb: 2.55, cgH: .48, torque: 285, peakRpm: 4900, idle: 900, limiter: 7600, gears: [3.6, 2.2, 1.55, 1.2, 1.0, .82], final: 3.9, r: .32, cdA: .6, price: 7500, color: '#c0392b' },
  kasturi: { cat: 'car', bm: 'Kasturi RS', en: 'Performance sedan (AWD turbo)', body: 'rs', drive: 'A', mass: 1560, front: .58, wb: 2.7, cgH: .5, torque: 340, peakRpm: 3800, idle: 900, limiter: 7100, gears: [3.5, 2.1, 1.45, 1.1, .9, .75], final: 4.0, r: .33, cdA: .64, price: 14500, color: '#1b1b1b', stockTurbo: true },
  kapcai: { cat: 'bike', bm: 'Kapcai 135', en: 'Underbone motorcycle', body: 'kapcai', drive: 'R', mass: 182, front: .44, wb: 1.24, cgH: .62, torque: 12.2, peakRpm: 7000, idle: 1500, limiter: 10200, gears: [2.83, 1.88, 1.42, 1.17, 1.0], final: 8.9, r: .28, cdA: .48, price: 0, color: '#e74c3c', bike: true },
  lekir: { cat: 'bike', bm: 'Lekir 250R', en: 'Sport motorcycle', body: 'sport', drive: 'R', mass: 235, front: .48, wb: 1.38, cgH: .6, torque: 23.5, peakRpm: 10000, idle: 1600, limiter: 13500, gears: [2.75, 1.95, 1.55, 1.29, 1.1, .96], final: 9.4, r: .3, cdA: .42, price: 5200, color: '#27ae60', bike: true },
};
export const CAR_IDS = ['tuah', 'jebat', 'lekiu', 'kasturi'], BIKE_IDS = ['kapcai', 'lekir'];

// parts: tier 0 is stock (free). `only` limits a slot to cars or bikes. price in RM (scaled per vehicle class below)
export const PARTS = {
  engine: { bm: 'Enjin', en: 'Engine', ic: '🔧', tiers: [{ bm: 'Stok', price: 0 }, { bm: 'Tahap 1', en: 'Stage 1 (intake + ECU)', price: 600, tq: .12 }, { bm: 'Tahap 2', en: 'Stage 2 (cams + head)', price: 1500, tq: .25, rev: 300 }, { bm: 'Tahap 3', en: 'Stage 3 (forged internals)', price: 3600, tq: .42, rev: 700 }] },
  turbo: { only: 'car', bm: 'Turbo', en: 'Turbocharger', ic: '🌀', tiers: [{ bm: 'Tiada', price: 0 }, { bm: 'Turbo Kecil', en: 'Small turbo — quick spool', price: 1400, gain: .32, rpm: 2600, lag: .45 }, { bm: 'Turbo Besar', en: 'Big turbo — more boost, more lag', price: 3200, gain: .68, rpm: 3800, lag: 1.0 }] },
  exhaust: { bm: 'Ekzos', en: 'Exhaust', ic: '💨', tiers: [{ bm: 'Stok', price: 0 }, { bm: 'Ekzos Sport', en: 'Sport exhaust', price: 350, tq: .04, kg: -3 }, { bm: 'Straight-Pipe', en: 'Straight pipe (loud!)', price: 900, tq: .08, kg: -7 }] },
  trans: { bm: 'Gearbox', en: 'Transmission', ic: '⚙️', tiers: [{ bm: 'Stok', price: 0, shift: .36 }, { bm: 'Gearbox Sport', en: 'Faster shifts · final-drive tuning', price: 800, shift: .2 }, { bm: 'Gearbox Lumba', en: 'Race dog-box · full ratio tuning', price: 2300, shift: .09 }] },
  tyres: { bm: 'Tayar', en: 'Tyres', ic: '🛞', tiers: [{ bm: 'Tayar Jalan', price: 0, mu: 1.0 }, { bm: 'Tayar Sport', en: 'Sport tyres', price: 300, mu: 1.12 }, { bm: 'Drag Radial', en: 'Drag radials', price: 950, mu: 1.3 }, { bm: 'Slik Lumba', en: 'Racing slicks', price: 1900, mu: 1.45 }] },
  nitrous: { bm: 'Nitro', en: 'Nitrous', ic: '🔥', tiers: [{ bm: 'Tiada', price: 0 }, { bm: 'Nitro 35', en: '35-shot (4 s)', price: 500, add: .25, dur: 4 }, { bm: 'Nitro 75', en: '75-shot (4.5 s)', price: 1250, add: .45, dur: 4.5 }, { bm: 'Nitro 125', en: '125-shot (5 s)', price: 2600, add: .7, dur: 5 }] },
  rims: { bm: 'Rim', en: 'Wheels', ic: '⭕', tiers: [{ bm: 'Rim Stok', price: 0, style: 'steel' }, { bm: 'Bintang 5', en: '5-spoke alloys (−4 kg)', price: 250, style: 'spoke5', kg: -4 }, { bm: 'Jejaring', en: 'Mesh rims (−6 kg)', price: 420, style: 'mesh', kg: -6 }, { bm: 'Drag Lite', en: 'Drag wheels (−10 kg)', price: 850, style: 'drag', kg: -10 }] },
  body: { only: 'car', bm: 'Body Kit', en: 'Body kit', ic: '🚘', tiers: [{ bm: 'Stok', price: 0 }, { bm: 'Kit Jalanan', en: 'Street kit (−3% drag)', price: 700, cd: -.03, kg: 8 }, { bm: 'Kit Lebar', en: 'Wide-body kit (−5% drag)', price: 1700, cd: -.05, kg: 15 }] },
  spoiler: { only: 'car', bm: 'Spoiler', en: 'Spoiler', ic: '🪽', tiers: [{ bm: 'Tiada', price: 0 }, { bm: 'Lip Spoiler', en: 'Lip spoiler (−1% drag)', price: 220, cd: -.01 }, { bm: 'Sayap GT', en: 'GT wing (+downforce, +3% drag)', price: 680, cd: .03, cl: .45 }] },
  swing: { only: 'bike', bm: 'Swingarm', en: 'Swingarm', ic: '📏', tiers: [{ bm: 'Stok', price: 0 }, { bm: 'Swingarm Panjang', en: 'Extended swingarm (less wheelie)', price: 650, wb: .18 }, { bm: 'Wheelie Bar', en: 'Extended + wheelie bar', price: 1300, wb: .3, cg: -.04 }] },
  susp: { bm: 'Suspensi', en: 'Suspension', ic: '🔩', tiers: [{ bm: 'Stok', price: 0 }, { bm: 'Suspensi Laras', en: 'Adjustable height (−6 … +4 cm)', price: 450 }] },
  launch: { bm: 'Kawalan Lancar', en: 'Launch control', ic: '🚦', tiers: [{ bm: 'Tiada', price: 0 }, { bm: 'Launch Control', en: 'Holds the revs at your set rpm', price: 400 }] },
};
export const SLOTS = Object.keys(PARTS);
export const PAINTS = ['#f1c40f', '#e74c3c', '#2e86de', '#27ae60', '#ecf0f1', '#1b1b1b', '#8e44ad', '#e67e22', '#16a085', '#ff6fb5', '#95a5a6', '#00d2ff'];
export const PAINT_PRICE = 120, PAINT_METAL = 220;
export const NEON_PRICE = 380, NEONS = ['#00e5ff', '#ff2bd6', '#39ff14', '#ffd400', '#ff3b3b', '#8a5bff'];
export const VINYLS = { none: { bm: 'Tiada', price: 0 }, stripes: { bm: 'Jalur Lumba', en: 'Racing stripes', price: 150 }, flames: { bm: 'Api', en: 'Flames', price: 260 }, batik: { bm: 'Batik', en: 'Batik pattern', price: 320 }, number: { bm: 'Nombor Lumba', en: 'Race number', price: 100 }, tyranz: { bm: 'Pelekat TYRANZ', en: 'TYRANZ decal', price: 180 } };
// part prices scale with the vehicle's class (a Stage 3 for a supercar costs more than for a kapcai)
export const CLASS_MUL = { tuah: .8, jebat: 1, lekiu: 1.4, kasturi: 1.9, kapcai: .6, lekir: 1.1 };
export const partPrice = (vid, slot, tier) => Math.round(PARTS[slot].tiers[tier].price * CLASS_MUL[vid] / 10) * 10;
export const slotsFor = (vid) => SLOTS.filter(s => !PARTS[s].only || PARTS[s].only === VEHICLES[vid].cat);

// ---------------------------------------------------------------- the player's garage (inside the main save S.drag)
export function garage(S) {
  const g = (S.drag ||= {});
  g.cars ||= {}; g.sel ||= { car: 'tuah', bike: 'kapcai' }; g.cat ||= 'car'; g.stats ||= { races: 0, wins: 0, best: {} }; g.dist ||= 'quarter'; g.diff ||= 'sederhana'; g.gearbox ||= 'manual'; g.view ||= 'chase';
  for (const id of ['tuah', 'kapcai']) if (!g.cars[id]) g.cars[id] = newCar(id); // starters are free
  return g;
}
export function newCar(id) { const V = VEHICLES[id]; return { parts: Object.fromEntries(SLOTS.map(s => [s, 0])), own: {}, paint: V.color, metal: false, vinyl: 'none', vinyls: { none: 1 }, height: 0, final: 1, spread: 1, launchRpm: 0 }; }
export const key = (vid, what) => `drag:${vid}:${what}`;

// purchases go through the injected wallet { spend(amount, why, key) → {ok, reason} }
export function buyVehicle(g, vid, W) {
  if (g.cars[vid]) return { ok: false, reason: 'owned' };
  const r = W.spend(VEHICLES[vid].price, `kenderaan ${VEHICLES[vid].bm}`, key(vid, 'vehicle')); if (!r.ok) return r;
  g.cars[vid] = newCar(vid); return { ok: true };
}
export function buyPart(g, vid, slot, tier, W) {
  const c = g.cars[vid]; if (!c) return { ok: false, reason: 'novehicle' }; if (!slotsFor(vid).includes(slot) || !PARTS[slot].tiers[tier]) return { ok: false, reason: 'invalid' };
  if (tier === 0 || c.own[`${slot}:${tier}`]) { c.parts[slot] = tier; return { ok: true, equipped: true } }
  const r = W.spend(partPrice(vid, slot, tier), `${VEHICLES[vid].bm}: ${PARTS[slot].tiers[tier].bm}`, key(vid, `${slot}:${tier}`)); if (!r.ok) return r;
  c.own[`${slot}:${tier}`] = 1; c.parts[slot] = tier; return { ok: true };
}
export function buyPaint(g, vid, color, metal, W) {
  const c = g.cars[vid]; if (!c) return { ok: false, reason: 'novehicle' }; if (!PAINTS.includes(color)) return { ok: false, reason: 'invalid' };
  if (c.paint === color && c.metal === !!metal) return { ok: true, same: true };
  const r = W.spend(metal ? PAINT_METAL : PAINT_PRICE, `cat ${VEHICLES[vid].bm}`); if (!r.ok) return r; // paint jobs are consumable (no key)
  c.paint = color; c.metal = !!metal; return { ok: true };
}
export function buyNeon(g, vid, color, W) { // neon underglow kit: buy once, then switch colours / off for free
  const c = g.cars[vid]; if (!c || (color && !NEONS.includes(color))) return { ok: false, reason: 'invalid' };
  if (!c.own.neon && color) { const r = W.spend(NEON_PRICE, `neon ${VEHICLES[vid].bm}`, key(vid, 'neon')); if (!r.ok) return r; c.own.neon = 1; }
  c.neon = color || null; return { ok: true };
}
export function buyVinyl(g, vid, v, W) {
  const c = g.cars[vid]; if (!c || !VINYLS[v]) return { ok: false, reason: 'invalid' };
  if (c.vinyls[v]) { c.vinyl = v; return { ok: true, equipped: true }; }
  const r = W.spend(VINYLS[v].price, `pelekat ${VINYLS[v].bm}`, key(vid, `vinyl:${v}`)); if (!r.ok) return r;
  c.vinyls[v] = 1; c.vinyl = v; return { ok: true };
}
// tuning sliders: only available with the right parts
export function setTune(g, vid, what, val) {
  const c = g.cars[vid]; if (!c) return false;
  if (what === 'height') { if (!c.parts.susp) return false; c.height = Math.max(-6, Math.min(4, Math.round(val))); }
  else if (what === 'final') { if (c.parts.trans < 1) return false; c.final = Math.max(.85, Math.min(1.2, +val)); }
  else if (what === 'spread') { if (c.parts.trans < 2) return false; c.spread = Math.max(.85, Math.min(1.15, +val)); }
  else if (what === 'launchRpm') { if (!c.parts.launch) return false; c.launchRpm = Math.max(0, +val); }
  else return false;
  return true;
}

// ---------------------------------------------------------------- build the physics spec from base + parts + tune
export function buildSpec(vid, c) {
  const V = VEHICLES[vid], p = c.parts, T = (s) => PARTS[s].tiers[p[s] || 0] || {};
  let tq = 1 + (T('engine').tq || 0) + (T('exhaust').tq || 0), kg = (T('exhaust').kg || 0) + (T('rims').kg || 0) + (T('body').kg || 0), cd = 1 + (T('body').cd || 0) + (T('spoiler').cd || 0);
  const h = c.height || 0; cd *= 1 + h * .004; // lower = slipperier
  const rev = T('engine').rev || 0, tb = V.bike ? null : (p.turbo ? T('turbo') : V.stockTurbo ? { gain: .38, rpm: 2600, lag: .55 } : null);
  // gear ratios: final drive scaled; spread stretches the gaps between gears around 3rd
  const gears = V.gears.map((r, i) => r * Math.pow(c.spread || 1, (V.gears.length / 2 - i) * .25));
  const P = {
    id: vid, bike: !!V.bike, drive: V.drive, mass: V.mass + kg, front: V.front, wb: V.wb + (T('swing').wb || 0), cgH: Math.max(.3, V.cgH + h * .006 + (T('swing').cg || 0)),
    torque: V.torque * tq, peakRpm: V.peakRpm + rev * .5, idle: V.idle, limiter: V.limiter + rev, gears, final: V.final * (c.final || 1), r: V.r, eff: V.bike ? .9 : .86,
    cdA: V.cdA * cd, clA: T('spoiler').cl || 0, crr: .014, mu: (T('tyres').mu || 1) * (V.bike ? .95 : 1), wheelI: V.bike ? .35 : 1.4 - (T('rims').kg || 0) * -.03, engI: V.bike ? .02 : .16,
    shiftTime: T('trans').shift || .36, clutchTime: V.bike ? .3 : .38, turbo: tb, nos: p.nitrous ? { add: T('nitrous').add, dur: T('nitrous').dur } : null,
    launchCtl: p.launch && c.launchRpm ? c.launchRpm : 0,
  };
  return P;
}
// performance index: simulated ideal 1/4-mile ET (cached per build)
const piCache = new Map();
export function perf(vid, c) {
  const k = vid + JSON.stringify([c.parts, c.height, c.final, c.spread]); if (piCache.has(k)) return piCache.get(k);
  const P = buildSpec(vid, c); P.bestLaunch = bestLaunch(P); const s = simulate(P, DIST.quarter.m, 1, () => .5);
  const res = { et: s.et, trap: s.trap * 3.6, hp: Math.round(P.torque * P.peakRpm / 7023 * (P.turbo ? 1 + P.turbo.gain * .8 : 1)), kg: Math.round(P.mass), P };
  piCache.set(k, res); return res;
}

// ---------------------------------------------------------------- AI opponents: same category, matched to the player's build
export const DIFF = { mudah: { bm: 'Mudah', en: 'Easy', et: 1.07, react: [.28, .42], q: .55, pay: .7 }, sederhana: { bm: 'Sederhana', en: 'Medium', et: 1.0, react: [.17, .3], q: .8, pay: 1 }, sukar: { bm: 'Sukar', en: 'Hard', et: .95, react: [.1, .2], q: .95, pay: 1.6 } };
const RIVALS = ['Abang Jamal', 'Kak Ros', 'Din Turbo', 'Taeyang', 'Muthu Laju', 'Wan Kapcai', 'Pak Cik Lim', 'Siti Nitro', 'Budak Rempit'];
export function makeOpponent(g, cat, dist, diff, rnd = Math.random) {
  const me = g.sel[cat], mePI = perf(me, g.cars[me]), D = DIFF[diff], target = mePI.et * D.et * (1 + (rnd() - .5) * .03);
  const ids = cat === 'car' ? CAR_IDS : BIKE_IDS;
  // pick the cheapest base that can reach the target with parts, then tune its torque to match
  let best = null;
  for (const id of ids) { const c = newCar(id); const st = perf(id, c).et; if (!best || Math.abs(st - target) < Math.abs(best.st - target) || (st > target && best.st < target)) best = { id, st }; }
  const id = best.id, c = newCar(id);
  const order = ['tyres', 'engine', 'exhaust', 'trans', 'turbo', 'nitrous', 'engine', 'tyres', 'engine', 'turbo', 'nitrous', 'trans', 'swing', 'tyres'];
  for (const s of order) { if (perf(id, c).et <= target) break; if (!slotsFor(id).includes(s)) continue; const n = PARTS[s].tiers.length; if (c.parts[s] < n - 1) c.parts[s]++; }
  const P = buildSpec(id, c); let lo = .6, hi = 1.6; // torque trim to land on the target ET
  for (let i = 0; i < 9; i++) { const m = (lo + hi) / 2, Q = { ...P, torque: P.torque * m }; Q.bestLaunch = bestLaunch(Q); if (simulate(Q, DIST.quarter.m, 1, () => .5).et > target) lo = m; else hi = m; }
  P.torque *= (lo + hi) / 2; P.bestLaunch = bestLaunch(P);
  c.paint = ['#c0392b', '#2e86de', '#8e44ad', '#16a085', '#e67e22', '#ecf0f1', '#1b1b1b'][Math.floor(rnd() * 7)]; c.vinyl = ['none', 'stripes', 'number', 'flames'][Math.floor(rnd() * 4)];
  return { id, c, P, name: RIVALS[Math.floor(rnd() * RIVALS.length)], react: D.react[0] + rnd() * (D.react[1] - D.react[0]), q: D.q, targetEt: target };
}

// ---------------------------------------------------------------- prize money (RM)
export const BASE_PAY = { eighth: 80, quarter: 140, half: 220 };
export function payout({ win, dist, diff, react, perfectShifts, pb, foul }) {
  const base = Math.round(BASE_PAY[dist] * DIFF[diff].pay);
  const items = [];
  if (foul) { items.push(['Lompat lampu · Red light', 0]); return { items, total: 0 }; }
  items.push([win ? 'Hadiah menang · Win' : 'Duit minyak · Entry', win ? base : Math.round(base * .15)]);
  if (react !== null && react < .1) items.push(['Lancar sempurna · Perfect launch (<0.100)', 25]);
  else if (react !== null && react < .2) items.push(['Lancar baik · Good launch', 10]);
  if (perfectShifts) items.push([`Tukar gear sempurna ×${perfectShifts}`, perfectShifts * 5]);
  if (pb) items.push(['Rekod peribadi · Personal best', 30]);
  return { items, total: items.reduce((a, i) => a + i[1], 0) };
}
