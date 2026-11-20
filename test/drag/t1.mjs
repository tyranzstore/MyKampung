import { VEHICLES, newCar, perf, buildSpec, makeOpponent, garage, buyPart, buyVehicle, payout } from '../../js/dragdata.js';
import { simulate, DIST, shiftRpm } from '../../js/dragphys.js';
for (const id of Object.keys(VEHICLES)) { const c = newCar(id); const p = perf(id, c); const s8 = simulate(p.P, DIST.eighth.m), s2 = simulate(p.P, DIST.half.m);
  console.log(id.padEnd(8), 'hp', p.hp, 'kg', p.kg, '1/4', p.et.toFixed(2), 'trap', p.trap.toFixed(0), '1/8', s8.et.toFixed(2), '1/2', s2.et.toFixed(2), 'top1/2', (s2.trap*3.6).toFixed(0), '60ft', s8.t60.toFixed(2), 'launch', Math.round(p.P.bestLaunch)); }
// upgrades
const c = newCar('lekiu'); console.log('lekiu stock', perf('lekiu', c).et.toFixed(2));
for (const [s, t] of [['tyres', 3], ['engine', 3], ['turbo', 2], ['nitrous', 3], ['trans', 2]]) { c.parts[s] = t; console.log(' +', s, t, perf('lekiu', c).et.toFixed(2), perf('lekiu', c).hp); }
const k = newCar('kapcai'); for (const [s,t] of [['engine',3],['tyres',3],['swing',2],['nitrous',3]]) { k.parts[s]=t; console.log(' kap +', s, perf('kapcai', k).et.toFixed(2)); }
// economy
const S = { coins: 3000 }, owned = {}; const W = { spend(n, why, key) { if (key && owned[key]) return { ok: false, reason: 'owned' }; if (S.coins < n) return { ok: false, reason: 'funds' }; S.coins -= n; if (key) owned[key] = 1; return { ok: true }; } };
const g = garage(S); console.log(buyPart(g, 'tuah', 'engine', 1, W), S.coins, buyPart(g, 'tuah', 'engine', 1, W), S.coins, buyPart(g,'tuah','engine',0,W), buyPart(g, 'tuah', 'engine', 1, W), S.coins);
console.log(buyVehicle(g, 'lekiu', W), buyVehicle(g, 'jebat', W), S.coins, buyVehicle(g,'jebat',W));
let t0 = Date.now(); for (const d of ['mudah', 'sederhana', 'sukar']) { const o = makeOpponent(g, 'car', 'quarter', d); console.log(d, o.id, o.name, 'target', o.targetEt.toFixed(2), 'got', simulate(o.P, DIST.quarter.m, o.q).et.toFixed(2)); } console.log('opp ms', Date.now() - t0);
console.log(payout({ win: true, dist: 'quarter', diff: 'sukar', react: .08, perfectShifts: 3, pb: true }));
