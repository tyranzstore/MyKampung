// SIMULATOR PANCING LAUT (v0.1) — Malaysian saltwater fishing from the jetty or Pak Mat's boat.
//  • World: kampung shore with the wooden jetty (TYRANZ jeti_kayu.glb), open sea with islands, coral reefs and a
//    real seabed mesh (shallow → reef → deep), animated waves, day/night cycle and changing weather.
//  • Boat: drive with the joystick (throttle/steer), chase camera, anchor (sauh.glb) to fish, rod holders, upgrades.
//  • Techniques: casting (jetty or boat) and bottom fishing — fully working; jigging and trolling — first version.
//  • Fight: hook set (STRIKE), reel, adjustable drag, line tension, fish stamina & runs, rod bend, line break, escape.
//  • Catch screen: Malay name, 3D model, length, weight, rarity, RM value. Sell (coins) or release.
// Mechanics live here in JavaScript; GLBs are only models. Only saltwater species are used.
import { $, clamp, sfx, S, save, checkDaily, toast, loopSound, boatEngine, seaAmbience, musicDuck } from './core.js';
import { FISH, RARITY, fishLen } from './minigames.js';
import { makeOcean, shoreWaves } from './ocean.js';
import { skinFish } from './fishskin.js';
import { loadPack } from './models.js';
import { earn, spend, fmtRM, balance } from './wallet.js';

const hyp = Math.hypot, rnd = Math.random;
// ------------------------------------------------------------ species (habitat, depth, bait, technique, behaviour)
// zones: c = cetek (shallow), k = karang (reef), s = sederhana (medium), d = dalam (deep)
// behaviour: rock = dives for rocks (line can be cut), run = long fast runs, jump = jumps, heavy = slow heavy pull, burst = short bursts
const SP = (id, bm, en, rar, kg, rmKg, zones, depth, bait, tech, time, beh, str, spd, cond = .013) => ({ id, bm, en, model: 'fish_' + id, rar, kg, rm: rmKg, zones, depth, bait, tech, time, beh, str, spd, cond });
// length from weight, W(g) = cond · L(cm)³ — chunky groupers/rays high, slim barracuda/sailfish low
export const seaLen = (sp, kg) => Math.round(Math.cbrt(kg * 1000 / sp.cond));
export const SEA_FISH = [
  SP('Kerapu', 'Ikan Kerapu', 'Grouper', 'jarang', [1.5, 12], 45, 'ks', [5, 35], { udang: .9, sotong: 1, umpan: 1, gewang: .45 }, { bottom: 1, cast: .6, jig: .9, troll: 0 }, { night: 1.2 }, 'rock', 1.15, .8, .016),
  SP('Merah', 'Ikan Merah', 'Red snapper', 'jarang', [1.2, 8], 38, 'kd', [14, 60], { udang: .8, sotong: 1, umpan: .7, gewang: .3 }, { bottom: 1, cast: .3, jig: .8, troll: 0 }, { night: 1.45 }, 'heavy', 1, .9),
  SP('Jenahak', 'Ikan Jenahak', 'Golden snapper', 'jarang', [1, 7], 40, 'ks', [9, 45], { udang: 1, sotong: .9, umpan: .6, gewang: .35 }, { bottom: 1, cast: .4, jig: .7, troll: 0 }, { night: 1.5 }, 'rock', .95, .95),
  SP('Tenggiri', 'Ikan Tenggiri', 'Spanish mackerel', 'jarang', [2, 12], 40, 'sd', [0, 30], { udang: .1, sotong: .3, umpan: 1, gewang: 1 }, { bottom: .15, cast: .9, jig: .7, troll: 1.3 }, { dawn: 1.6, dusk: 1.5 }, 'run', .9, 1.45, .008),
  SP('Gerepoh', 'Ikan Gerepoh', 'Giant trevally', 'epik', [3, 15], 18, 'kc', [0, 22], { udang: .2, sotong: .3, umpan: .9, gewang: 1.2 }, { bottom: .3, cast: 1.2, jig: .9, troll: .8 }, { dawn: 1.3, day: 1.1 }, 'rock', 1.45, 1.25),
  SP('Talang', 'Ikan Talang', 'Queenfish', 'luar', [1, 6], 16, 'cs', [0, 15], { udang: .4, sotong: .3, umpan: 1, gewang: 1 }, { bottom: .3, cast: 1, jig: .6, troll: 1 }, { day: 1.15 }, 'jump', .8, 1.2, .01),
  SP('Pari', 'Ikan Pari', 'Stingray', 'luar', [3, 25], 15, 'cs', [2, 25], { udang: 1, sotong: .9, umpan: .4, gewang: 0 }, { bottom: 1.2, cast: .5, jig: 0, troll: 0 }, {}, 'heavy', 1.25, .5, .03),
  SP('Alu-Alu', 'Ikan Alu-Alu', 'Barracuda', 'luar', [1, 8], 14, 'ks', [0, 20], { udang: 0, sotong: .2, umpan: .8, gewang: 1.2 }, { bottom: .1, cast: 1.1, jig: .7, troll: 1.1 }, { day: 1.1 }, 'burst', .75, 1.5, .005),
  SP('Tongkol', 'Ikan Tongkol', 'Longtail tuna', 'luar', [1.5, 8], 15, 'ds', [0, 40], { udang: .1, sotong: .3, umpan: .9, gewang: 1 }, { bottom: .2, cast: .8, jig: 1, troll: 1.2 }, { day: 1.1 }, 'run', 1.1, 1.3),
  SP('Layaran', 'Ikan Layaran', 'Sailfish', 'legenda', [15, 45], 25, 'd', [0, 20], { udang: 0, sotong: .2, umpan: 1, gewang: .9 }, { bottom: 0, cast: .6, jig: .2, troll: 1.4 }, { day: 1.2 }, 'jump', 1.6, 1.7, .0045),
  // everyday saltwater bites so the line is never quiet (existing models)
  SP('Kembung', 'Ikan Kembung', 'Indian mackerel', 'biasa', [.15, .45], 14, 'cs', [0, 20], { udang: .8, sotong: .6, umpan: .5, gewang: .6 }, { bottom: .5, cast: 1, jig: 1, troll: .6 }, { day: 1.1 }, 'burst', .35, 1),
  SP('Kerisi', 'Ikan Kerisi', 'Threadfin bream', 'biasa', [.15, .5], 12, 'sk', [6, 40], { udang: 1, sotong: .8, umpan: .3, gewang: .1 }, { bottom: 1, cast: .5, jig: .4, troll: 0 }, {}, 'burst', .35, .9),
  SP('Gelama', 'Ikan Gelama', 'Croaker', 'biasa', [.2, .7], 10, 'cs', [2, 20], { udang: 1, sotong: .7, umpan: .3, gewang: .1 }, { bottom: 1, cast: .6, jig: .2, troll: 0 }, { night: 1.2 }, 'heavy', .4, .7),
  SP('Jebong', 'Ikan Jebong', 'Triggerfish', 'luar', [.4, 1.4], 12, 'k', [4, 30], { udang: .9, sotong: 1, umpan: .4, gewang: .3 }, { bottom: 1, cast: .5, jig: .6, troll: 0 }, { day: 1.1 }, 'rock', .55, .9),
];
export const BAITS = { udang: { bm: 'Udang', en: 'Prawn', ic: '🦐' }, sotong: { bm: 'Sotong', en: 'Squid', ic: '🦑' }, umpan: { bm: 'Umpan hidup', en: 'Live bait', ic: '🐟' }, gewang: { bm: 'Gewang', en: 'Lure / jig', ic: '🪝' } };
export const RODS = [{ bm: 'Joran Asas', line: 9, drag: 10, cast: 32, reel: 1, spool: 120, price: 0 }, { bm: 'Joran Pro', line: 16, drag: 18, cast: 44, reel: 1.25, spool: 180, price: 400 }, { bm: 'Joran Laut Dalam', line: 30, drag: 33, cast: 52, reel: 1.5, spool: 260, price: 1200 }];
export const ENGINES = [{ bm: 'Enjin 15 kk', top: 7, price: 0 }, { bm: 'Enjin 30 kk', top: 10, price: 500 }, { bm: 'Enjin 60 kk', top: 14, price: 1500 }];
export const FINDERS = [{ bm: 'Tiada sonar', price: 0 }, { bm: 'Sonar Asas', price: 300 }, { bm: 'Sonar Pro', price: 900 }];
export function seaSave() { const s = (S.sea ||= {}); s.rod ??= 0; s.engine ??= 0; s.finder ??= 0; s.best ??= {}; s.caught ??= 0; s.sold ??= 0; return s; }

// ------------------------------------------------------------ world shape (shore at z = 18, sea toward -z)
const SHORE = 18, ISLANDS = [{ x: -95, z: -125, r: 20 }, { x: 115, z: -175, r: 26 }, { x: 165, z: -62, r: 15 }];
const REEFS = [{ x: -55, z: -70, r: 34 }, { x: 72, z: -98, r: 28 }, { x: 150, z: -95, r: 22 }, { x: -110, z: -160, r: 26 }];
const BOUND = { x0: -230, x1: 230, z0: -300, z1: 15 };
function noise2(x, z) { return Math.sin(x * .07 + z * .05) * .6 + Math.sin(x * .021 - z * .033) * .9 + Math.cos(z * .09 + x * .013) * .4; }
export function depthAt(x, z) {
  if (z > SHORE) return 0;
  let d = .6 + (SHORE - z) * .14 + Math.max(0, -z - 105) * .22 + noise2(x, z) * .8;
  for (const r of REEFS) { const q = hyp(x - r.x, z - r.z) / r.r; if (q < 1.3) d = Math.min(d, 6.5 + q * q * 8 + noise2(x * 3, z * 3) * 1.2); }
  for (const i of ISLANDS) { const q = hyp(x - i.x, z - i.z) / i.r; if (q < 2.4) d = Math.min(d, Math.max(.2, (q - 1) * 7)); }
  return clamp(d, .3, 70);
}
export function zoneAt(x, z) {
  const d = depthAt(x, z); for (const r of REEFS) if (hyp(x - r.x, z - r.z) < r.r) return 'k';
  return d < 6 ? 'c' : d > 28 ? 'd' : 's';
}
export const ZONE = { c: { bm: 'Cetek', en: 'Shallows', col: '#7fd6ff' }, k: { bm: 'Terumbu Karang', en: 'Coral reef', col: '#ff9f80' }, s: { bm: 'Sederhana', en: 'Mid-water', col: '#5fb0ff' }, d: { bm: 'Laut Dalam', en: 'Deep sea', col: '#3a6cff' } };

// ------------------------------------------------------------ bite model
function timeKey(h) { return h < 5 || h >= 20 ? 'night' : h < 8 ? 'dawn' : h >= 17.5 ? 'dusk' : 'day'; }
export function biteWeights({ zone, depth, bottom, bait, tech, hour, weather }) {
  const tk = timeKey(hour), out = [];
  for (const f of SEA_FISH) {
    if (!f.zones.includes(zone)) continue;
    const [d0, d1] = f.depth, inRange = depth >= d0 - 1 && depth <= d1 + 2; if (!inRange) continue;
    const pelagic = f.depth[0] === 0 && f.beh !== 'rock' && f.beh !== 'heavy'; // surface/midwater hunters ignore baits lying on the bottom
    if (bottom && pelagic && depth > 6) continue;
    let w = RARITY[f.rar].w * (f.bait[bait] || 0) * (f.tech[tech] || 0) * (f.time[tk] || (tk === 'night' && !f.time.night ? .6 : 1));
    w *= weather === 'hujan' ? 1.15 : weather === 'ribut' ? .55 : weather === 'mendung' ? 1.08 : 1;
    if (w > 0) out.push([f, w]);
  }
  return out;
}

// ============================================================ SCENE
export function seaFishScene({ T, environment, Sparks, palm, stiltHouse, putModel, mulberry32, makeHero }) {
  return function SeaFish3D(K, api, opts, M = {}) {
    checkDaily(); const sv = seaSave(), rod0 = () => RODS[sv.rod], r = mulberry32(21);
    const scene = new T.Scene(); const sun = environment(K, scene, { sky: 0x8fd0f0, shadow: 24, fogNear: 140, fogFar: 520 });
    const hemi = scene.children.find(o => o.isHemisphereLight); sun.shadow && sun.shadow.camera && Object.assign(sun.shadow.camera, { far: 160 }); if (sun.target) scene.add(sun.target);
    // ---------- sea surface, seabed, shore
    const ocean = makeOcean(T, { w: 760, h: 760, seg: .22, amp: .38, shoreY: -(SHORE + 150), shoreFade: 40, deep: 0x0a4570, shallow: 0x2fb2cf, repeat: 70 }); ocean.mesh.position.set(0, 0, -150); scene.add(ocean.mesh);
    const shore = shoreWaves(T, scene, { segs: [[-250, 250]], shoreZ: SHORE + .4, seaward: -1, reach: 4, period: 7, width: 1.6 });
    const bedG = new T.PlaneGeometry(760, 760, 150, 150); const bedCol = [];
    { const pa = bedG.attributes.position, c = new T.Color();
      if (pa && pa.count) { for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), z = -pa.getY(i) - 150, d = depthAt(x, z); pa.setZ(i, -d); const k = clamp(d / 50, 0, 1), reef = zoneAt(x, z) === 'k'; c.setRGB(.86 - k * .45 + (reef ? .05 : 0), .8 - k * .4 - (reef ? .1 : 0), .62 - k * .25); bedCol.push(c.r, c.g, c.b); }
        bedG.setAttribute('color', new T.Float32BufferAttribute(bedCol, 3)); bedG.computeVertexNormals(); } }
    const bed = new T.Mesh(bedG, new T.MeshStandardMaterial({ vertexColors: true, roughness: 1 })); bed.rotation.x = -Math.PI / 2; bed.position.set(0, -.02, -150); scene.add(bed);
    const underSky = K.mesh(new T.PlaneGeometry(760, 760), new T.MeshBasicMaterial({ color: 0x6fc3df, transparent: true, opacity: .55, side: T.BackSide, depthWrite: false }), 0, -.05, -150, scene, false); underSky.rotation.x = -Math.PI / 2; underSky.visible = false; // the water surface seen from below
    K.box(520, .4, 14, K.mat(0xefdcaa, { roughness: 1 }), 0, -.1, SHORE + 7, scene, false); K.box(520, .4, 70, K.mat(0x6aae4c), 0, .02, SHORE + 49, scene, false);
    // kampung on the shore
    for (const [x, w, roof] of [[-26, 0xc48a58, 0x8a4b33], [-12, 0x7fb3a6, 0x5d4037], [16, 0xe0c9a6, 0x9d3b2c], [30, 0xb7d3a8, 0x8a4b33]]) stiltHouse(K, scene, x, SHORE + 22, { wall: w, roof });
    for (let i = 0; i < 26; i++) { const x = -110 + i * 9 + (r() - .5) * 4; if (Math.abs(x) < 5) continue; palm(K, scene, x, SHORE + 3 + r() * 8, 1.1 + r() * .4, r); }
    // islands
    for (const i of ISLANDS) { K.mesh(new T.CylinderGeometry(i.r * 1.15, i.r * 1.45, 2.4, 22), K.mat(0xefdcaa, { roughness: 1 }), i.x, -.8, i.z, scene, false);
      const hill = K.mesh(new T.SphereGeometry(i.r, 18, 10), K.mat(0x4f9a43, { roughness: .95 }), i.x, -i.r * .55, i.z, scene, false); hill.scale.y = .62;
      for (let k = 0; k < 8; k++) { const a = k / 8 * 6.28 + r(), rr = i.r * (.75 + r() * .3); palm(K, scene, i.x + Math.cos(a) * rr, i.z + Math.sin(a) * rr, 1.3 + r() * .5, r); } }
    // reef dressing on the seabed (seen with the underwater camera) + marker buoys on the surface
    const CORALS = ['sea/karang_cabang', 'sea/karang_otak', 'sea/kipas_laut', 'sea/batu_laut'], buoys = [];
    for (const rf of REEFS) { for (let k = 0; k < 22; k++) { const a = r() * 6.28, rr = Math.sqrt(r()) * rf.r, x = rf.x + Math.cos(a) * rr, z = rf.z + Math.sin(a) * rr, d = depthAt(x, z);
        const key = CORALS[k % 4], o = putModel(M, key, scene, x, z, { h: key === 'sea/batu_laut' ? 1.2 + r() * 1.6 : .8 + r() * 1.4, ry: r() * 6, y: -d - .1 });
        if (!o) K.mesh(new T.IcosahedronGeometry(.6 + r() * .6, 0), K.mat([0xff7a59, 0xf6c445, 0xb36bd4, 0x7f8c8d][k % 4]), x, -d + .3, z, scene, false); }
      const b = K.group(rf.x, 0, rf.z - rf.r * .4, scene); K.cyl(.35, .45, 1, K.mat(0xe74c3c), 0, .3, 0, b, 10); K.cyl(.04, .04, 1.6, K.mat(0x333333), 0, 1.4, 0, b, 6); K.box(.6, .4, .03, K.mat(0xffffff), .3, 2, 0, b); buoys.push(b); }
    for (const [x, z] of [[-30, -120], [40, -135], [0, -170]]) { const b = K.group(x, 0, z, scene); K.cyl(.35, .45, 1, K.mat(0xf1c40f), 0, .3, 0, b, 10); K.cyl(.04, .04, 1.6, K.mat(0x333333), 0, 1.4, 0, b, 6); buoys.push(b); }
    // ---------- jetty (TYRANZ jeti_kayu.glb tiled out to sea) + lamps
    const JET = { x: 0, z0: SHORE + 1, z1: -2.5, top: 1.6 };
    { const segL = 5.4, n = Math.ceil((JET.z0 - JET.z1) / segL); let made = 0;
      for (let k = 0; k < n; k++) { const o = putModel(M, 'sea/jeti_kayu', scene, 0, JET.z0 - segL * (k + .5), { len: segL, y: -.35 }); if (o) { made++; const bb = new T.Box3().setFromObject(o); JET.top = bb.max.y; } }
      if (!made) { K.box(3, .2, JET.z0 - JET.z1, K.mat(0x8d6e4c), 0, 1.5, (JET.z0 + JET.z1) / 2, scene); for (let z = JET.z1; z < JET.z0; z += 2.5) for (const x of [-1.3, 1.3]) K.cyl(.12, .12, 3, K.mat(0x6d4c41), x, 0, z, scene, 6); JET.top = 1.6; } }
    const lampM = new T.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xffd27a, emissiveIntensity: 0 });
    for (const z of [JET.z1 + 1, (JET.z0 + JET.z1) / 2]) for (const x of [-1.5, 1.5]) { K.cyl(.05, .05, 2.4, K.mat(0x4a3b2c), x, JET.top + 1.2, z, scene, 6); K.ball(.16, lampM, x, JET.top + 2.45, z, scene); }
    // ---------- boat (TYRANZ fishing boat), anchor, rod holders, lantern
    const boat = { x: 4.2, z: 2.5, yaw: 0, v: 0, anchored: true, docked: true, troll: false };
    const boatG = K.group(boat.x, 0, boat.z, scene), hull = K.group(0, 0, 0, boatG);
    let boatModel = putModel(M, 'fboat', hull, 0, 0, { scale: 1, ry: Math.PI, y: -.45 }); // sits with ~.45 m draught; the ocean shader dips the water under the hull
    if (boatModel) for (const nm of ['hauler-mount', 'hauler', 'hauler-weed']) { const o = boatModel.getObjectByName(nm); if (o) o.visible = false; }
    if (!boatModel) { K.box(2.4, 1, 6.6, K.mat(0xf4f1e6), 0, .2, 0, hull); K.box(2.5, .2, 6.7, K.mat(0x2e86de), 0, .75, 0, hull); }
    const STAND = new T.Vector3(.5, 0, -1.4); let deckY = .8;
    if (boatModel && T.Raycaster) { boatG.updateMatrixWorld(true); let best = null;
      for (let z = -2.6; z <= 2.6; z += .2) for (const x of [.35, .55]) { const rc = new T.Raycaster(new T.Vector3(boat.x + x, 12, boat.z + z), new T.Vector3(0, -1, 0)); const h = rc.intersectObject(boatModel, true)[0];
        if (h && h.point.y > .15 && h.point.y < 2.2 && (!best || h.point.y < best.y - .05 || (Math.abs(h.point.y - best.y) <= .05 && z < best.z))) best = { x, z, y: h.point.y }; }
      if (best) { STAND.set(best.x, 0, best.z); deckY = best.y; } }
    const bb0 = new T.Box3().setFromObject(hull), HALF = { w: Math.max(1.1, (bb0.max.x - bb0.min.x) / 2), l: Math.max(2.5, (bb0.max.z - bb0.min.z) / 2) };
    for (const x of [-.75, .75]) { const h = K.cyl(.035, .03, .45, K.mat(0x95a5a6), x, deckY + .2, HALF.l * .82, hull, 6); h.rotation.x = -.5; const spare = putModel(M, 'sea/joran', hull, x, HALF.l * .82 + .1, { h: 2.4, y: deckY + .05 }); if (spare) spare.rotation.x = -.5; } // rod holders at the stern
    const anchor = K.group(0, deckY + .1, -HALF.l * .9, hull); const anc = putModel(M, 'sea/sauh', anchor, 0, 0, { h: .9 }) || K.box(.5, .8, .1, K.mat(0x333333), 0, .4, 0, anchor);
    const ropeGeo = new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3()]); const rope = new T.Line(ropeGeo, new T.LineBasicMaterial({ color: 0xc8b28a })); scene.add(rope); rope.visible = false;
    const lantern = new T.PointLight(0xffc97a, 0, 18, 1.6); lantern.position.set(0, deckY + 2, 0); boatG.add(lantern);
    // ---------- player, rod (TYRANZ joran_pancing.glb, bent in code), line, bait
    const hero = (makeHero(K, M, 1.62, .9) || {}).g || (() => { const g = new T.Group(); K.cyl(.22, .22, 1.2, K.mat(0x2e86de), 0, .9, 0, g); K.ball(.2, K.mat(0xc68a5a), 0, 1.65, 0, g); return g; })(); scene.add(hero);
    const rodPivot = new T.Group(); scene.add(rodPivot); const rodTilt = new T.Group(); rodTilt.rotation.x = .95; rodPivot.add(rodTilt);
    const ROD_L = 2.6, rodGeo = [];
    { const tmp = putModel(M, 'sea/joran', rodTilt, 0, 0, { h: ROD_L });
      if (tmp && tmp.updateMatrixWorld) { rodTilt.updateMatrixWorld(true); const inv = new T.Matrix4().copy(rodTilt.matrixWorld).invert(), parts = [];
        tmp.traverse(o => { if (o.isMesh && o.geometry && o.geometry.attributes && o.geometry.attributes.position && !/rod_[34]/.test(o.name || '') && !/rod_[34]/.test((o.parent && o.parent.name) || '')) parts.push(o); });
        for (const o of parts) { const g = o.geometry.clone(); g.applyMatrix4(new T.Matrix4().multiplyMatrices(inv, o.matrixWorld)); const m = new T.Mesh(g, o.material); m.castShadow = true; rodTilt.add(m); }
        rodTilt.remove(tmp); }
      if (!rodTilt.children.length) K.mesh(new T.CylinderGeometry(.012, .03, ROD_L, 6, 12).translate(0, ROD_L / 2, 0), K.mat(0x222222), 0, 0, 0, rodTilt, false); }
    rodTilt.children.forEach(o => { if (o.isMesh && o.geometry.attributes && o.geometry.attributes.position) rodGeo.push({ o, base: Float32Array.from(o.geometry.attributes.position.array) }); });
    const tipLocal = new T.Vector3(0, ROD_L, 0), tipW = new T.Vector3();
    // spinning reel ("mesin") under the rod: handle cranks, rotor spins, spool slips backwards when the drag gives line, bail opens to cast
    const RM = { body: K.mat(0x2b2f36, { metalness: .6, roughness: .35 }), gold: K.mat(0xd4a017, { metalness: .8, roughness: .3 }), line: K.mat(0xf2f2f2, { roughness: .6 }), knob: K.mat(0x1b1b1b), wire: K.mat(0xc9ced6, { metalness: .9, roughness: .25 }) };
    const reel = new T.Group(); reel.position.set(0, ROD_L * .175, 0); rodTilt.add(reel);
    K.box(.016, .07, .05, RM.body, 0, 0, .03, reel);                                   // foot + stem
    K.mesh(new T.CylinderGeometry(.034, .034, .06, 14), RM.body, 0, -.012, .085, reel);  // gearbox
    const rotor = new T.Group(); rotor.position.set(0, .03, .085); reel.add(rotor); K.mesh(new T.CylinderGeometry(.04, .036, .03, 14), RM.body, 0, 0, 0, rotor);
    const bail = new T.Group(); bail.position.set(0, .03, 0); rotor.add(bail); { const b = K.mesh(new T.TorusGeometry(.046, .0035, 4, 14, Math.PI), RM.wire, 0, 0, 0, bail); b.rotation.x = Math.PI / 2; }
    const spool = new T.Group(); spool.position.set(0, .07, .085); reel.add(spool); K.mesh(new T.CylinderGeometry(.04, .04, .008, 16), RM.gold, 0, .022, 0, spool); K.mesh(new T.CylinderGeometry(.03, .03, .04, 12), RM.gold, 0, 0, 0, spool);
    const wrap = K.mesh(new T.CylinderGeometry(.037, .037, .034, 16), RM.line, 0, 0, 0, spool); K.box(.004, .036, .006, K.mat(0x8a8a8a), .037, 0, 0, spool); // line on the spool + a mark so the spin reads
    const handle = new T.Group(); handle.position.set(.04, -.012, .085); reel.add(handle); K.box(.006, .075, .012, RM.body, .012, .036, 0, handle);
    const crankKnob = K.mesh(new T.CylinderGeometry(.011, .011, .03, 10), RM.knob, .032, .07, 0, handle); crankKnob.rotation.z = Math.PI / 2;
    const RL = { crank: 0, rotor: 0, spool: 0, bail: 0 };
    // first-person forearms + hands (only drawn in first person; the hero model is hidden there)
    const skinM = K.mat(0xc68a5a), sleeveM = K.mat(0x2e86de), UPV = new T.Vector3(0, 1, 0);
    function mkArm() { const g = new T.Group(); scene.add(g); const fa = K.mesh(new T.CylinderGeometry(.03, .038, 1, 8), skinM, 0, .5, 0, g, false); const sl = K.mesh(new T.CylinderGeometry(.05, .05, .32, 8), sleeveM, 0, .02, 0, g, false); const hand = K.box(.07, .05, .09, skinM, 0, 0, 0, scene, false); g.visible = hand.visible = false; return { g, fa, sl, hand }; }
    const arms = [mkArm(), mkArm()], av = [new T.Vector3(), new T.Vector3(), new T.Vector3(), new T.Vector3(), new T.Vector3()];
    function placeArm(A, elbow, hand, on) { A.g.visible = A.hand.visible = on; if (!on) return; const d = av[4].copy(hand).sub(elbow), len = d.length() || .01; A.g.position.copy(elbow); A.g.quaternion.setFromUnitVectors(UPV, d.multiplyScalar(1 / len)); A.fa.scale.set(1, len, 1); A.fa.position.y = len / 2; A.hand.position.copy(hand); A.hand.quaternion.copy(A.g.quaternion); }
    // line drawn as a curve: sags when slack, straight when tight
    const LN = 20, linePts = Array.from({ length: LN }, () => new T.Vector3());
    function bendRod(b) { // b: 0..1 — curve the blank toward the line: tip forward and down
      for (const g of rodGeo) { const pa = g.o.geometry.attributes.position, base = g.base;
        for (let i = 0; i < pa.count; i++) { const y = base[i * 3 + 1], t = clamp(y / ROD_L, 0, 1); pa.setXYZ(i, base[i * 3], y - b * t * t * .35 * ROD_L, base[i * 3 + 2] + b * t * t * .55 * ROD_L); }
        pa.needsUpdate = true; }
      tipLocal.set(0, ROD_L - b * .35 * ROD_L, b * .55 * ROD_L);
    }
    const lineGeo = new T.BufferGeometry().setFromPoints(Array.from({ length: 20 }, () => new T.Vector3())); const line = new T.Line(lineGeo, new T.LineBasicMaterial({ color: 0xf5f5f5, transparent: true, opacity: .85 })); scene.add(line); line.frustumCulled = false;
    const bobber = K.ball(.09, K.mat(0xff5533, { emissive: 0x551100 }), 0, -50, 0, scene); const sinker = K.ball(.05, K.mat(0x777777), 0, -50, 0, scene);
    const splash = new Sparks(scene, 300, 0xffffff, .2), rain = new Sparks(scene, 900, 0xcfe6ff, .1);
    // hooked / showcase fish model
    let fishObj = null; const fishHolder = new T.Group(); scene.add(fishHolder); fishHolder.visible = false;
    // Most fish models live in the GLB pack assets/packs/fish_hd (ids fish_<Name>, loaded on demand; putModel finds them
    // once loaded). They are already textured, so the painted skin (skinFish) is applied to legacy models only.
    loadPack('fish_hd');
    const isLegacy = (sp) => !!M[sp.model];
    function setFishModel(sp, kg) { if (fishObj) fishHolder.remove(fishObj); fishObj = putModel(M, sp.model, fishHolder, 0, 0, { len: fishLen(kg) }) || (() => { const g = new T.Group(); const m = K.ball(.3, K.mat(0x9aa7b5), 0, 0, 0, g); m.scale.set(1.6, .7, .5); return g; })(); if (isLegacy(sp)) try { skinFish(fishObj, sp.id); } catch { } fishObj.position.y = 0; }

    // ---------- fish living around the bait: drawn from the species that can bite here (zone, depth, bait, time, weather)
    const ambG = new T.Group(); scene.add(ambG); const amb = []; const motes = new Sparks(scene, 260, 0xd8f3ff, .045);
    function ambClear() { for (const f of amb) ambG.remove(f.o); amb.length = 0; }
    function ambSpawn(sp, kg, far) {
      const L = clamp(seaLen(sp, kg) / 100, .18, 2.4), o = putModel(M, sp.model, ambG, 0, 0, { len: L }) || (() => { const g = new T.Group(); const m = K.ball(.25, K.mat(0x9aa7b5), 0, 0, 0, g); m.scale.set(L * 2, .6, .45); ambG.add(g); return g; })();
      if (isLegacy(sp)) try { skinFish(o, sp.id); } catch { }
      const low = sp.beh === 'rock' || sp.beh === 'heavy';
      const f = { o, sp, L, low, r: far ? 7 + rnd() * 3 : 1.4 + rnd() * 3.6, ang: rnd() * 6.28, w: (.22 + rnd() * .3) * (rnd() < .5 ? -1 : 1) * (.6 + sp.spd * .4), dy: (rnd() - .5) * 1.8, ph: rnd() * 6, mode: 'swim', x: F.bx, y: -F.bd, z: F.bz, hx: 1, hz: 0, fade: 0 };
      f.x = F.bx + Math.cos(f.ang) * f.r; f.z = F.bz + Math.sin(f.ang) * f.r; amb.push(f); return f;
    }
    function ambFill() {
      const zone = zoneAt(F.bx, F.bz), seabed = depthAt(F.bx, F.bz);
      const pool = biteWeights({ zone, depth: F.bd, bottom: F.bd >= seabed - .6, bait: F.bait, tech: F.tech === 'jig' ? 'jig' : F.tech, hour: W.hour, weather: W.weather })
        .concat(biteWeights({ zone, depth: Math.min(seabed - .5, Math.max(1, F.bd)), bottom: true, bait: 'udang', tech: 'bottom', hour: W.hour, weather: W.weather }).map(([sp, w]) => [sp, w * .4]));
      const tot = pool.reduce((a, p) => a + p[1], 0); if (!tot) return;
      const n = Math.min(8, 3 + Math.round(rnd() * 2) + (zone === 'k' ? 2 : 0) + (W.weather === 'hujan' ? 1 : 0));
      for (let k = 0; k < n; k++) { let x = rnd() * tot; for (const [sp, w] of pool) { x -= w; if (x <= 0) { ambSpawn(sp, sp.kg[0] + (sp.kg[1] - sp.kg[0]) * Math.pow(rnd(), 2)); break; } } }
    }
    function ambUpdate(dt) {
      const waiting = mode !== 'drive' && ['sinking', 'wait', 'nibble', 'bite', 'fight'].includes(F.st);
      if (!waiting) { if (amb.length) ambClear(); return; }
      if (!amb.length && F.st === 'wait') ambFill();
      const seabed = depthAt(F.bx, F.bz);
      // the fish that is about to bite comes in from the group (or from further out)
      if ((F.st === 'nibble' || F.st === 'bite') && F.fish && !amb.some(f => f.mode === 'take')) { let f = amb.find(f => f.sp.id === F.fish.sp.id && f.mode === 'swim'); if (!f) f = ambSpawn(F.fish.sp, F.fish.kg, true); f.mode = 'take'; }
      if (F.st === 'wait' || F.st === 'sinking') for (const f of amb) if (f.mode === 'take') f.mode = 'swim'; // it spat the bait
      if (F.st === 'fight') for (const f of amb) if (f.mode !== 'flee') { f.mode = f.mode === 'take' ? 'gone' : 'flee'; if (f.mode === 'gone') f.o.visible = false; }
      for (let i = amb.length - 1; i >= 0; i--) { const f = amb[i]; let tx, ty, tz, sp = 1.6 * (.6 + f.sp.spd * .4);
        if (f.mode === 'swim') { f.ang += f.w * dt / Math.max(1, f.r * .5); tx = F.bx + Math.cos(f.ang) * f.r; tz = F.bz + Math.sin(f.ang) * f.r;
          ty = f.low ? -seabed + .35 + f.L * .2 + Math.max(0, f.dy) * .3 : -F.bd + f.dy + Math.sin(t * .5 + f.ph) * .35; }
        else if (f.mode === 'take') { const bite = F.st === 'bite', peck = bite ? 0 : Math.abs(Math.sin(t * 7 + f.ph)) * .35;
          const dx = f.x - F.bx, dz = f.z - F.bz, d = hyp(dx, dz) || 1; tx = F.bx + dx / d * (f.L * .5 + .04 + peck); tz = F.bz + dz / d * (f.L * .5 + .04 + peck); ty = -F.bd; sp = bite ? 7 : 2.2; }
        else if (f.mode === 'flee') { const dx = f.x - F.bx, dz = f.z - F.bz, d = hyp(dx, dz) || 1; tx = f.x + dx / d * 6; tz = f.z + dz / d * 6; ty = f.y - .5; sp = 5; f.fade += dt; if (f.fade > 2.5) { ambG.remove(f.o); amb.splice(i, 1); continue; } }
        else { ambG.remove(f.o); amb.splice(i, 1); continue; }
        ty = clamp(ty, -seabed + .15 + f.L * .15, -.35);
        const vx = tx - f.x, vy = ty - f.y, vz = tz - f.z, dl = hyp(vx, vz), step = Math.min(1, sp * dt / Math.max(.001, hyp(dl, vy)));
        f.x += vx * step; f.y += vy * step; f.z += vz * step;
        if (dl > .02 && f.mode !== 'take') { f.hx += (vx / dl - f.hx) * Math.min(1, dt * 4); f.hz += (vz / dl - f.hz) * Math.min(1, dt * 4); }
        if (f.mode === 'take') { const dx = F.bx - f.x, dz = F.bz - f.z, d = hyp(dx, dz) || 1; f.hx = dx / d; f.hz = dz / d; } // nose to the bait
        f.o.position.set(f.x, f.y - f.L * .12, f.z); f.o.rotation.set(0, Math.atan2(-f.hz, f.hx) + Math.sin(t * (6 + f.sp.spd * 4) + f.ph) * .12, Math.sin(t * 1.3 + f.ph) * .05); }
    }

    // ---------- state
    const W = { hour: opts.hour ?? 7.5, weather: 'cerah', wTimer: 160 + r() * 120, wind: 0 };
    const F = { st: 'idle', tech: 'cast', bait: 'udang', power: 0, aimYaw: 0, bx: 0, bz: 0, bd: 0, bdT: 0, vx: 0, vz: 0, vy: 0, wait: 0, nib: 0, fish: null, fight: null, drag: .5, uwWait: true, uwFight: false, reel: false, reelFast: false, msg: '', msgT: 0, jig: 0, slack: 0, over: 0, landed: [], camUnder: false, sold: 0 };
    let mode = 'jetty'; // 'jetty' | 'boat' (anchored) | 'drive'
    const st = { t: 0, underBlend: 0 };
    const hasMsg = (m, d = 2) => { F.msg = m; F.msgT = d; };
    // ---------- HUD + controls overlay
    const root = document.createElement('div'); root.className = 'f3 sf'; root.innerHTML = `
      <div class="sfTop"><span class="chip zone"></span><span class="chip depth"></span><span class="chip time"></span><span class="chip wx"></span></div>
      <button class="f3Pause" aria-label="Menu">❚❚</button>
      <div class="sfEq chip"></div>
      <canvas class="sfSonar" width="220" height="110"></canvas>
      <div class="sfFight" hidden><div class="tbar"><b></b><i class="lim"></i></div><div class="finfo"></div></div>
      <div class="f3Msg"></div>
      <div class="f3Stick"><div class="f3Base"><div class="f3Knob"></div></div></div>
      <div class="sfBtns"></div>
      <div class="f3Over" hidden></div>`;
    $('game').append(root); $('game').classList.add('f3mode');
    const q = (s) => root.querySelector(s), btnBox = q('.sfBtns'), over = q('.f3Over'), sonar = q('.sfSonar'), sctx = sonar.getContext('2d');
    // joystick (drive: throttle+steer; fishing: aim left/right)
    const stick = q('.f3Stick'), base = q('.f3Base'), knob = q('.f3Knob'); let sid = null, sx0 = 0, sy0 = 0; const R = 38, joy = { x: 0, y: 0 };
    const sMove = (e) => { const dx = e.clientX - sx0, dy = e.clientY - sy0, d = hyp(dx, dy), k = d > R ? R / d : 1; knob.style.transform = `translate(${dx * k}px,${dy * k}px)`; let m = Math.min(1, d / R); m = m < .12 ? 0 : (m - .12) / .88; joy.x = d ? dx / d * m : 0; joy.y = d ? dy / d * m : 0; };
    const sDown = (e) => { e.preventDefault(); if (sid !== null) return; sid = e.pointerId; stick.setPointerCapture(e.pointerId); const rc = stick.getBoundingClientRect(); sx0 = clamp(e.clientX, rc.left + R + 6, rc.right - R - 6); sy0 = clamp(e.clientY, rc.top + R + 6, rc.bottom - R - 6); base.style.left = `${sx0 - rc.left}px`; base.style.top = `${sy0 - rc.top}px`; base.classList.add('on'); sMove(e); };
    const sMv = (e) => { if (e.pointerId === sid) { e.preventDefault(); sMove(e); } };
    const sUp = (e) => { if (e.pointerId !== sid) return; sid = null; joy.x = joy.y = 0; knob.style.transform = ''; base.classList.remove('on'); base.style.left = base.style.top = ''; };
    stick.addEventListener('pointerdown', sDown); stick.addEventListener('pointermove', sMv); stick.addEventListener('pointerup', sUp); stick.addEventListener('pointercancel', sUp);
    const noG = (e) => e.preventDefault(); root.addEventListener('touchmove', noG, { passive: false });
    // context buttons (rebuilt only when the set changes); hold-type buttons report down/up
    let btnKey = '';
    const BTN = {
      cast: ['🎣', 'LEMPAR', 'Cast', 'hold'], drop: ['⬇️', 'TURUN', 'Drop', 'tap'], bait: ['', 'UMPAN', 'Bait', 'tap'], board: ['🚤', 'NAIK BOT', 'Board', 'tap'], jetty: ['🪵', 'KE JETI', 'To jetty', 'tap'],
      anchorUp: ['⚓', 'ANGKAT SAUH', 'Raise anchor', 'tap'], anchorDown: ['⚓', 'LABUH', 'Anchor', 'tap'], troll: ['〰️', 'TUNDA', 'Troll', 'tap'], trollOff: ['✋', 'TARIK TALI', 'Lure in', 'tap'],
      reel: ['🌀', 'KARAU', 'Reel', 'hold'], strike: ['⚡', 'SENTAP!', 'Strike', 'tap'], jig: ['↕️', 'JIG', 'Jig', 'tap'], dragDn: ['−', 'DRAG', 'Drag −', 'tap'], dragUp: ['+', 'DRAG', 'Drag +', 'tap'], gaff: ['🪝', 'GANCO!', 'Gaff', 'tap'], under: ['🤿', 'KAMERA', 'Underwater', 'tap'], fast: ['⏩', 'LAJU', 'Fast reel', 'tap'],
    };
    function setButtons(list) {
      const key = list.join(',') + '|' + F.bait; if (key === btnKey) return; btnKey = key;
      btnBox.innerHTML = list.map(k => { const [ic, bm, en] = BTN[k]; return `<button data-k="${k}" class="sb sb-${k}"><i>${k === 'bait' ? BAITS[F.bait].ic : ic}</i><b>${bm}</b><small>${en}</small>${k === 'cast' ? '<span class="pw"><b></b></span>' : ''}</button>`; }).join('');
      btnBox.querySelectorAll('button').forEach(b => { const k = b.dataset.k; let pid = null;
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); pid = e.pointerId; try { b.setPointerCapture(e.pointerId); } catch { } b.classList.add('on'); press(k, true); });
        const up = (e) => { if (pid !== e.pointerId) return; pid = null; b.classList.remove('on'); press(k, false); };
        b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up); });
    }
    function press(k, on) {
      if (paused || F.st === 'catch') return;
      if ((k === 'cast' || k === 'drop') && on && mode === 'drive') { hasMsg('Labuh sauh dulu · Anchor first (or TUNDA to troll)', 1.4); return; }
      if (k === 'cast') { if (on && F.st === 'idle') { F.st = 'charge'; F.power = 0; F.tech = 'cast'; } else if (!on && F.st === 'charge') doCast(); }
      else if (k === 'reel') { F.reel = on; }
      else if (!on) return;
      else if (k === 'drop' && F.st === 'idle') doDrop();
      else if (k === 'bait') { const ks = Object.keys(BAITS); F.bait = ks[(ks.indexOf(F.bait) + 1) % ks.length]; sfx.tap(); hasMsg(`${BAITS[F.bait].ic} ${BAITS[F.bait].bm} · ${BAITS[F.bait].en}`, 1.3); btnKey = ''; }
      else if (k === 'strike') strike();
      else if (k === 'gaff') gaff();
      else if (k === 'jig') jig();
      else if (k === 'dragDn') { F.drag = clamp(F.drag - .1, .1, 1); sfx.tap(); }
      else if (k === 'dragUp') { F.drag = clamp(F.drag + .1, .1, 1); sfx.tap(); }
      else if (k === 'fast') { F.reelFast = !F.reelFast; sfx.tap(); hasMsg(F.reelFast ? 'Karau laju · Fast reel' : 'Karau biasa · Normal reel', 1); }
      else if (k === 'under') { if (F.st === 'fight') F.uwFight = !F.uwFight; else F.uwWait = !F.uwWait; sfx.tap(); hasMsg((F.st === 'fight' ? F.uwFight : F.uwWait) ? '🤿 Kamera bawah air · Underwater cam' : (F.st === 'fight' ? '👀 Pandangan orang pertama · First person' : '🎣 Pandangan joran · Rod view'), 1); }
      else if (k === 'board') { if (F.st !== 'idle') return; mode = 'boat'; boat.anchored = true; sfx.tap(); hasMsg('Naik bot · On the boat — ANGKAT SAUH untuk belayar', 2.2); }
      else if (k === 'jetty') { if (F.st !== 'idle') return; mode = 'jetty'; sfx.tap(); }
      else if (k === 'anchorUp') { if (F.st !== 'idle') return; boat.anchored = false; boat.docked = false; mode = 'drive'; ancT = -1; sfx.pull(); hasMsg('Belayar! Kayu bedik: gerak & pusing', 2); }
      else if (k === 'anchorDown') { if (Math.abs(boat.v) > 1.5) { hasMsg('Perlahankan bot dulu · Slow down first', 1.5); return; } boat.v = 0; boat.anchored = true; boat.troll = false; mode = 'boat'; ancT = 0; F.st = 'idle'; sfx.splash(); hasMsg(`Berlabuh · Anchored — ${depthAt(boat.x, boat.z).toFixed(0)} m`, 2); }
      else if (k === 'troll') { if (F.bait !== 'gewang' && F.bait !== 'umpan') { F.bait = 'gewang'; btnKey = ''; } boat.troll = true; F.st = 'troll'; F.tech = 'troll'; F.bd = 1.5; hasMsg('Menunda gewang · Trolling — kekal 3–7 m/s', 2); sfx.splash(); }
      else if (k === 'trollOff') { boat.troll = false; F.st = 'idle'; F.fish = null; }
    }
    // keyboard: WASD/arrows (drive/aim), C/Space cast(hold), R reel(hold), F strike, J jig, B bait, X drop, [ ] drag, U underwater, P pause
    const keys = new Set();
    const onKey = (e) => { if (!root.isConnected) return; const d = e.type === 'keydown'; const c = e.code;
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(c)) { e.preventDefault(); d ? keys.add(c) : keys.delete(c); return; }
      if (e.repeat) return; const map = { KeyG: 'gaff', Space: 'cast', KeyC: 'cast', KeyR: 'reel', KeyF: 'strike', KeyJ: 'jig', KeyB: 'bait', KeyX: 'drop', BracketLeft: 'dragDn', BracketRight: 'dragUp', KeyU: 'under', KeyT: 'troll' };
      if (map[c]) { e.preventDefault(); press(map[c], d); } else if (d && (c === 'KeyP' || c === 'Escape')) togglePause(); };
    addEventListener('keydown', onKey); addEventListener('keyup', onKey);
    // pause / shop / exit
    let paused = false;
    q('.f3Pause').onclick = () => { sfx.tap(); togglePause(); };
    function togglePause() { paused = !paused; over.hidden = !paused; if (paused) menu(); }
    function menu() {
      const row = (label, arr, key) => { const lvl = sv[key], nx = arr[lvl + 1]; return `<div class="sfShop"><span>${label}: <b>${arr[lvl].bm}</b></span>${nx ? `<button class="f3B small" data-up="${key}">⬆ ${nx.bm} · ${fmtRM(nx.price)}</button>` : '<em>MAKS</em>'}</div>`; };
      over.innerHTML = `<div class="f3Card"><h2>PANCING LAUT</h2><p class="muted">💵 ${fmtRM(balance())} · Tangkapan · Catches ${sv.caught}${opts.practice ? ' · Latihan (tiada jualan)' : ''}</p>
        <div class="f3Set">${row('🎣 Joran', RODS, 'rod')}${row('🚤 Enjin', ENGINES, 'engine')}${row('📡 Sonar', FINDERS, 'finder')}</div>
        <div class="f3Row"><button class="f3B primary" data-o="resume">▶ Teruskan</button><button class="f3B" data-o="exit">🏠 Kembali ke Kampung</button></div></div>`;
      over.querySelectorAll('[data-up]').forEach(b => b.onclick = () => { const k = b.dataset.up, arr = k === 'rod' ? RODS : k === 'engine' ? ENGINES : FINDERS, nx = arr[sv[k] + 1]; if (!nx) return; const r = spend(nx.price, `pancing: ${nx.bm}`); if (!r.ok) { sfx.bad(); toast(`Duit tak cukup — kurang ${fmtRM(r.short || 0)}`, 'Not enough money'); return; } sv[k]++; save(); menu(); });
      over.querySelector('[data-o="resume"]').onclick = () => { sfx.tap(); togglePause(); };
      over.querySelector('[data-o="exit"]').onclick = () => exit();
    }
    function exit() { const kg = F.landed.reduce((a, f) => a + f.kg, 0); api.finish({ stars: F.landed.length >= 5 ? 3 : F.landed.length >= 2 ? 2 : F.landed.length ? 1 : 0, caught: F.landed.length, kg, sold: F.sold, res: F.landed.length ? 'ok' : 'quit', fish: F.landed.map(f => ({ id: f.sp.id, bm: f.sp.bm, kg: f.kg, rm: f.rm, rar: f.sp.rar })) }); }

    // ---------- fishing actions
    function anglerPos() { // where the rod hand is (world) and which way the angler faces
      if (mode === 'jetty') return { x: JET.x, y: JET.top, z: JET.z1 + .6, yaw: F.aimYaw };
      const c = Math.cos(boat.yaw), s = Math.sin(boat.yaw), lx = STAND.x, lz = STAND.z;
      return { x: boat.x + lx * c - lz * s, y: deckY + bob.y, z: boat.z + lx * s + lz * c, yaw: boat.yaw + F.aimYaw + (mode === 'drive' ? Math.PI : Math.PI / 2) };
    }
    function doCast() {
      const a = anglerPos(), dist = 4 + F.power * rod0().cast, fx = Math.sin(a.yaw), fz = -Math.cos(a.yaw);
      F.tx = a.x + fx * dist; F.tz = a.z + fz * dist; F.bx = a.x; F.bz = a.z; F.by = a.y + 2.2; F.st = 'flying'; F.baitGone = false; F.flyT = 0; F.flyDur = .55 + dist * .022; F.bd = 0; F.tech = 'cast'; sfx.swish();
    }
    function doDrop() { const a = anglerPos(), fx = Math.sin(a.yaw), fz = -Math.cos(a.yaw); F.bx = a.x + fx * 1.2; F.bz = a.z + fz * 1.2; F.bd = 0; F.st = 'sinking'; F.baitGone = false; F.tech = 'bottom'; sfx.splash(); splashAt(F.bx, F.bz, 20); }
    function splashAt(x, z, n) { for (let k = 0; k < n; k++) splash.add(x, .1, z, (rnd() - .5) * 2.5, 1.5 + rnd() * 2, (rnd() - .5) * 2.5, .6); }
    function jig() { if (!['wait', 'sinking'].includes(F.st)) return; if (F.bait !== 'gewang') { hasMsg('Jig perlukan gewang · Jigging needs a lure', 1.3); return; } F.jig = 1; F.bd = Math.max(.5, F.bd - 1.6); F.tech = F.tech === 'bottom' ? 'jig' : F.tech; sfx.swish(); rodKick = .5; }
    let rodKick = 0;
    function strike() {
      if (F.st === 'bite') { // hook set!
        const f = F.fish; F.st = 'fight'; F.fight = mkFight(f); sfx.snap(); musicDuck(true); rodKick = 1;
        const ff = F.fight, power = Math.pow(f.kg, .72) * f.sp.str * 1.6; ff.big = power > rod0().line * 1.05; if (ff.big) { ff.stam = 1.25; hasMsg('⚠️ IKAN TERLALU BESAR! Longgarkan drag & jaga tali · Fish too big!', 2.6); sfx.bad(); } else hasMsg('KENA! · HOOKED!', 1.4); return; }
      if (F.st === 'gaff') return gaff();
      if (F.st === 'nibble') { F.nib = 0; if (rnd() < .6) { F.fish = null; F.st = 'wait'; F.wait = 3 + rnd() * 4; hasMsg('Terlalu awal — ikan lari · Too early', 1.5); if (rnd() < .4) { F.baitGone = true; hasMsg('Umpan dicuri! · Bait stolen — karau & ganti', 2); } } else hasMsg('Sabar… · Patience…', 1); sfx.bad(); return; }
      if (F.st === 'wait' || F.st === 'sinking') { rodKick = .4; sfx.swish(); }
    }
    function mkFight(f) { const sp = f.sp; return { sp, kg: f.kg, stam: 1, dist: Math.max(4, hyp(F.bx - anglerPos().x, F.bz - anglerPos().z)), depth: Math.max(.5, F.bd), dir: rnd() * 6.28, run: 0, runT: 1 + rnd() * 2, pull: 0, tension: 0, jumpT: 0, rockT: 0, x: F.bx, z: F.bz }; }
    // pick the fish that bites from the weighted pool
    function rollBite() {
      const zone = zoneAt(F.bx, F.bz), seabed = depthAt(F.bx, F.bz), bottom = F.bd >= seabed - .6;
      const pool = biteWeights({ zone, depth: F.bd, bottom, bait: F.baitGone ? 'none' : F.bait, tech: F.tech === 'jig' ? 'jig' : F.tech, hour: W.hour, weather: W.weather });
      const tot = pool.reduce((a, p) => a + p[1], 0); if (!tot) return null;
      let x = rnd() * tot; for (const [sp, w] of pool) { x -= w; if (x <= 0) { const k = Math.pow(rnd(), 1.6), kg = +(sp.kg[0] + (sp.kg[1] - sp.kg[0]) * k).toFixed(2); return { sp, kg }; } }
      return null;
    }
    function land() {
      const f = F.fight, sp = f.sp, len = seaLen(sp, f.kg), rm = Math.round(f.kg * sp.rm * 100) / 100, rr = RARITY[sp.rar];
      const prev = sv.best[sp.id] || 0, pb = f.kg > prev;
      F.st = 'catch'; F.catch = { sp, kg: f.kg, rm, len, pb }; musicDuck(false); sfx.good(); if (sp.rar === 'epik' || sp.rar === 'legenda') sfx.cheer && sfx.cheer();
      setFishModel(sp, f.kg); fishHolder.visible = true;
      if (!opts.practice) { const log = S.fishLog || (S.fishLog = {}), e = log[sp.id]; F.catch.isNew = !e; log[sp.id] = { n: (e ? e.n : 0) + 1, max: Math.max(e ? e.max || 0 : 0, f.kg) }; save(); }
      over.hidden = false; over.classList.add('sfCatchWrap');
      over.innerHTML = `<div class="sfCatch"><div class="kick" style="color:${rr.col}">${'★'.repeat(rr.stars)} ${rr.bm.toUpperCase()} · ${rr.en}</div>${F.catch.isNew ? '<div class="fcTag">✨ Spesies baru! · New species!</div>' : ''}<h2>${sp.bm}</h2><p class="en">${sp.en}</p>
        <dl><dt>Panjang · Length</dt><dd>${len} cm</dd><dt>Berat · Weight</dt><dd>${f.kg.toFixed(2)} kg${pb && prev ? ' <em>REKOD!</em>' : ''}</dd><dt>Nilai · Value</dt><dd>RM ${rm.toFixed(2)}</dd></dl>
        <div class="f3Row"><button class="f3B primary" data-c="sell">💰 Simpan & Jual${opts.practice ? '' : ` (+${fmtRM(coinsFor(rm))})`}</button><button class="f3B" data-c="release">🌊 Lepas · Release</button></div></div>`;
      over.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { const c = b.dataset.c; sfx.tap();
        if (pb) sv.best[sp.id] = f.kg; sv.caught++;
        if (c === 'sell') { const coins = opts.practice ? 0 : coinsFor(rm); if (coins) { earn(coins, `jual ${sp.bm}`); F.sold += coins; sv.sold += coins; checkDailyCoins(coins); sfx.coin(); } F.landed.push({ sp, kg: f.kg, rm }); }
        else { S.spirit = Math.min(100, (S.spirit || 0) + 1); hasMsg('Ikan dilepaskan 🌊 · Released — semangat +1', 1.6); F.landed.push({ sp, kg: f.kg, rm: 0 }); }
        save(); over.hidden = true; over.classList.remove('sfCatchWrap'); fishHolder.visible = false; F.st = 'idle'; F.fish = null; F.fight = null; });
    }
    const SELL_CAP = 500; // RM a day from fish sales (the jetty wholesaler pays 60% of market value)
    function coinsFor(rm) { const used = (S.daily && S.daily.seaCoins) || 0; return Math.max(0, Math.min(Math.round(rm * .6), SELL_CAP - used)); }
    function checkDailyCoins(c) { S.daily.seaCoins = ((S.daily && S.daily.seaCoins) || 0) + c; }
    function lose(why, kind = 'slack') { hasMsg(why, 2.4); musicDuck(false); F.reel = false; F.baitGone = false; F.fish = null;
      if (!F.fight) { sfx.bad(); F.st = 'idle'; return; }
      F.st = 'lost'; F.lostK = kind; F.lostT = 1.9; F.lostD = F.lostT; rodKick = 0;
      if (kind === 'snap' || kind === 'cut' || kind === 'spool') { sfx.snap(); setTimeout(() => sfx.bad(), 250); } else { sfx.splash(); setTimeout(() => sfx.bad(), 200); } }
    function startLanding() { const f = F.fight; if (f.kg >= 6) { F.st = 'gaff'; F.gaffT = 1.7 + (f.big ? 0 : .4); hasMsg('🪝 GANCO SEKARANG! · GAFF IT!', 1.6); sfx.bite(); } else { F.st = 'landing'; F.landT = 0; sfx.splash(); splashAt(F.bx, F.bz, 25); } }
    function gaff() { if (F.st !== 'gaff') return; F.st = 'landing'; F.landT = 0; sfx.snap(); sfx.splash(); splashAt(F.bx, F.bz, 40); hasMsg('Dapat! · Got it!', 1); }

    // ---------- environment: day/night + weather
    const SKY = { day: new T.Color(0x8fd0f0), dusk: new T.Color(0xf3a46b), night: new T.Color(0x0c1733), storm: new T.Color(0x5d6d7e), under: new T.Color(0x0e4e6e) };
    const skyC = new T.Color(), bgC = new T.Color(), WX = { cerah: ['☀️', 'Cerah', 'Clear', .3], mendung: ['☁️', 'Mendung', 'Cloudy', .45], hujan: ['🌧️', 'Hujan', 'Rain', .6], ribut: ['⛈️', 'Ribut', 'Storm', .95] };
    function envUpdate(dt) {
      W.hour = (W.hour + dt / 30) % 24; W.wTimer -= dt;
      if (W.wTimer <= 0) { const opts2 = ['cerah', 'cerah', 'mendung', 'mendung', 'hujan', 'ribut']; W.weather = opts2[Math.floor(rnd() * opts2.length)]; W.wTimer = 120 + rnd() * 160; hasMsg(`Cuaca: ${WX[W.weather][0]} ${WX[W.weather][1]} · ${WX[W.weather][2]}`, 2); }
      const h = W.hour, night = h < 5 || h >= 20 ? 1 : h < 6.5 ? 1 - (h - 5) / 1.5 : h >= 18.5 ? (h - 18.5) / 1.5 : 0, warm = h >= 16.5 && h < 19.5 ? 1 - Math.abs(h - 18) / 1.5 : h >= 5.5 && h < 7.5 ? 1 - Math.abs(h - 6.5) : 0;
      const storm = W.weather === 'ribut' ? 1 : W.weather === 'hujan' ? .7 : W.weather === 'mendung' ? .4 : 0;
      skyC.copy(SKY.day).lerp(SKY.dusk, clamp(warm, 0, 1) * .8).lerp(SKY.storm, storm * .7).lerp(SKY.night, clamp(night, 0, 1) * .92);
      scene.background = bgC; if (st.underBlend > .5) { bgC.copy(SKY.under); scene.fog.color.copy(SKY.under); scene.fog.near = 2; scene.fog.far = 38; }
      else { bgC.copy(skyC); scene.fog.color.copy(skyC); scene.fog.near = 140 - storm * 80; scene.fog.far = 520 - storm * 280; }
      const ang = (h - 6) / 12 * Math.PI, fa = mode === 'drive' ? boat : anglerPos(); sun.position.set(fa.x + Math.cos(ang) * 40, Math.max(8, Math.sin(ang) * 60), fa.z + 20); if (sun.target) sun.target.position.set(fa.x, 0, fa.z); sun.intensity = (1 - night) * (2.4 - storm * 1.3) + .1; if (hemi) hemi.intensity = .45 + (1 - night) * (1.3 - storm * .4);
      sun.color.setHex(warm > .3 ? 0xffc48a : 0xfff1d6);
      lampM.emissiveIntensity = night * 1.6; lantern.intensity = night * 6;
      ocean.uniforms.uAmp.value = .3 + storm * .55; W.wind = storm;
      if (storm > .5 && st.underBlend < .5) { const a = anglerPos(); for (let k = 0; k < (storm > .9 ? 18 : 9); k++) rain.add(a.x + (rnd() - .5) * 40, 14 + rnd() * 6, a.z + (rnd() - .5) * 40 - 8, -2 * W.wind, -26, 0, .7); }
      return { night };
    }

    // ---------- main update helpers
    const bob = { y: 0, roll: 0, pitch: 0 }; let ancT = -1, engine = null, reelS = null, ambience = null, t = 0;
    try { ambience = seaAmbience(); } catch { ambience = null; }
    function boatUpdate(dt) {
      const top = ENGINES[sv.engine].top; let thr = 0, steer = 0;
      if (mode === 'drive') { const kx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0), ky = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0); steer = kx || joy.x; thr = -(ky || joy.y); }
      const want = thr > 0 ? thr * top : thr * top * .35; boat.v += (want - boat.v) * Math.min(1, dt * (thr ? .7 : .45));
      if (boat.troll) boat.v = clamp(boat.v, -2, 7.5);
      boat.yaw += steer * dt * (.45 + Math.min(1, Math.abs(boat.v) / 4) * .55) * (boat.v >= -.2 ? 1 : -1);
      const fx = Math.sin(boat.yaw), fz = -Math.cos(boat.yaw); boat.x += fx * boat.v * dt; boat.z += fz * boat.v * dt;
      // keep out of land, islands and the jetty
      boat.x = clamp(boat.x, BOUND.x0, BOUND.x1); boat.z = clamp(boat.z, BOUND.z0, BOUND.z1);
      for (const i of ISLANDS) { const dx = boat.x - i.x, dz = boat.z - i.z, d = hyp(dx, dz), rr = i.r * 1.3 + 3; if (d < rr) { boat.x = i.x + dx / d * rr; boat.z = i.z + dz / d * rr; boat.v *= .3; } }
      if (Math.abs(boat.x) < 1.6 + HALF.w && boat.z > JET.z1 - HALF.l && boat.z < JET.z0) { boat.x = Math.sign(boat.x || 1) * (1.6 + HALF.w); boat.v *= .5; }
      const sea = .25 + W.wind * .6; bob.y = Math.sin(t * 1.3) * .09 * sea * 2; bob.roll = Math.sin(t * .9 + 1) * .05 * sea * 2 - (mode === 'drive' ? steer * Math.min(1, Math.abs(boat.v) / 6) * .08 : 0); bob.pitch = Math.sin(t * 1.1) * .03 * sea * 2 + (mode === 'drive' ? -clamp(boat.v / top, -1, 1) * .05 : 0);
      boatG.position.set(boat.x, bob.y, boat.z); boatG.rotation.set(bob.pitch, -boat.yaw, bob.roll, 'YXZ');
      // wake
      if (Math.abs(boat.v) > 1.5) for (let k = 0; k < Math.min(6, Math.abs(boat.v)); k++) splash.add(boat.x - fx * HALF.l + (rnd() - .5) * 1.4, .1, boat.z - fz * HALF.l + (rnd() - .5) * 1.4, (rnd() - .5) * 1.5, .6 + rnd(), (rnd() - .5) * 1.5, .7);
      if (mode === 'drive' && !engine) { try { engine = boatEngine(); } catch { engine = null; } }
      if (mode !== 'drive' && engine) { engine.stop && engine.stop(); engine = null; }
      if (engine && engine.set) engine.set(clamp(.05 + Math.abs(boat.v) / top * .8 + Math.abs(thr) * .2, .05, 1));
      // reel clicks / drag screech
      const reeling = F.reel && ['wait', 'nibble', 'fight'].includes(F.st);
      if (reeling && !reelS) { try { reelS = loopSound('scrub'); } catch { reelS = null; } } else if (!reeling && reelS) { reelS.stop && reelS.stop(); reelS = null; }
      if (reelS && reelS.set) reelS.set(F.reelFast ? .1 : .07);
      // anchor drop / raise animation + rope
      const seabed = depthAt(boat.x, boat.z);
      if (ancT >= 0) { ancT = Math.min(1, ancT + dt * .8); anchor.position.y = deckY + .1 - ancT * (seabed + deckY + .1); rope.visible = true; }
      else { anchor.position.y += (deckY + .1 - anchor.position.y) * Math.min(1, dt * 3); rope.visible = anchor.position.y < deckY - .2; }
      if (rope.visible) { const a = new T.Vector3(0, deckY + .5, -HALF.l * .9).applyMatrix4(hull.matrixWorld), b = anchor.getWorldPosition(new T.Vector3()); ropeGeo.setFromPoints([a, b]); }
    }
    function fishingUpdate(dt) {
      const a = anglerPos(), seabed = depthAt(F.bx, F.bz);
      if (F.st === 'charge') F.power = Math.min(1, F.power + dt / 1.1);
      if (F.st === 'flying') { F.flyT += dt; const k = Math.min(1, F.flyT / F.flyDur); F.bx = a.x + (F.tx - a.x) * k; F.bz = a.z + (F.tz - a.z) * k; F.by = (a.y + 2.2) * (1 - k) + Math.sin(k * Math.PI) * (2 + F.power * 4);
        if (k >= 1) { F.st = 'sinking'; F.bd = 0; sfx.splash(); splashAt(F.bx, F.bz, 25); if (depthAt(F.bx, F.bz) < .25) { lose('Tersangkut di pantai · Snagged on the beach'); } } }
      if (F.st === 'sinking') { const sink = F.bait === 'gewang' ? 1.6 : 2.4; F.bd = Math.min(seabed - .15, F.bd + sink * dt); if (F.bd >= seabed - .2) { F.st = 'wait'; F.wait = 2 + rnd() * 4; } else if (rnd() < dt * .25) { F.wait = 0; F.st = 'wait'; } }
      // retrieve (reeling while waiting): lure swims back — predators like a moving lure
      if ((F.st === 'wait' || F.st === 'nibble') && F.reel) { const dx = a.x - F.bx, dz = a.z - F.bz, d = hyp(dx, dz), sp = (F.reelFast ? 3.6 : 2.1) * rod0().reel;
        if (d < 2.5 && F.bd < 2.5) { F.st = 'idle'; F.baitGone = false; sfx.pop(); return; }
        if (d > .5) { F.bx += dx / d * sp * dt; F.bz += dz / d * sp * dt; } F.bd = Math.max(.4, F.bd - sp * .35 * dt); if (F.bait === 'gewang' && F.tech !== 'bottom') F.tech = 'cast'; if (F.st === 'nibble' && rnd() < dt) { F.st = 'wait'; F.fish = null; } }
      if (F.jig > 0) { F.jig -= dt; if (F.jig <= 0 && F.st === 'wait') F.bd = Math.min(seabed - .15, F.bd + 1.2); }
      if (F.st === 'wait' && !F.reel) F.bd = Math.min(seabed - .15, F.bd + .8 * dt);
      // bites: waiting → nibbles → the take (STRIKE window)
      if (F.st === 'wait' || F.st === 'troll') {
        F.wait -= dt * (F.jig > 0 ? 2.2 : 1) * (F.reel && F.bait === 'gewang' ? 1.7 : 1) * (FINDERS[sv.finder] ? 1 + sv.finder * .1 : 1);
        if (F.st === 'troll') { F.bx = boat.x - Math.sin(boat.yaw) * 22; F.bz = boat.z + Math.cos(boat.yaw) * 22; F.bd = 1.5; if (Math.abs(boat.v) < 2.5 || Math.abs(boat.v) > 8) F.wait = Math.max(F.wait, 1); }
        if (F.wait <= 0) { const b = rollBite(); F.wait = 3 + rnd() * 5; if (b) { F.fish = b;
          if (F.st === 'troll') { F.st = 'bite'; F.biteT = 1.6; boat.troll = false; hasMsg('🎣 SAMBAR! Tekan SENTAP!', 1.5); sfx.bite(); } else { F.st = 'nibble'; F.nib = .8 + rnd() * 1.8; } } }
      }
      if (F.st === 'nibble') { F.nib -= dt; if (rnd() < dt * 4) { rodKick = .18; sfx.tap(); } if (F.nib <= 0) { F.st = 'bite'; F.biteT = .9 + (opts.assist === false ? 0 : .35); sfx.bite(); rodKick = .8; hasMsg('⚡ SENTAP SEKARANG! · STRIKE!', 1); } }
      if (F.st === 'bite') { F.biteT -= dt; rodKick = Math.max(rodKick, .5); if (F.biteT <= 0) { F.fish = null; F.st = F.tech === 'troll' ? 'idle' : 'wait'; F.wait = 3 + rnd() * 4; hasMsg('Terlepas… terlambat · Too late', 1.6); if (rnd() < .5) F.baitGone = true; } }
      if (F.st === 'fight') fightUpdate(dt, a);
      if (F.st === 'gaff') { F.gaffT -= dt; F.bd = .15; if (rnd() < dt * 14) splash.add(F.bx + (rnd() - .5) * .8, .1, F.bz + (rnd() - .5) * .8, (rnd() - .5) * 3, 1.5 + rnd() * 2, (rnd() - .5) * 3, .6); if (rnd() < dt * 3) sfx.splash();
        if (F.gaffT <= 0) lose('Meronta & terlepas di tepi bot! · It shook free at the side', 'thrown'); }
      if (F.st === 'landing') { F.landT += dt / 1.5; if (F.landT >= 1) land(); }
      if (F.st === 'lost') { F.lostT -= dt; if (F.lostK === 'spool' && F.fight) F.fight.dist += 30 * dt; if (F.lostT <= 0) { F.st = 'idle'; F.fight = null; } }
    }
    // the fight: fish pull vs drag; reeling gains line; tension must stay between slack and the line's breaking strain
    function fightUpdate(dt, a) {
      const f = F.fight, sp = f.sp, rod = rod0(), dragKg = F.drag * rod.drag, pace = sp.spd;
      f.runT -= dt; if (f.runT <= 0) { const tired = f.stam < .25; f.run = tired ? 0 : rnd() < (sp.beh === 'run' ? .65 : sp.beh === 'burst' ? .55 : .4) ? 1 : 0; if (f.run) f.shockT = .35; f.runT = f.run ? (sp.beh === 'run' ? 2 + rnd() * 3 : sp.beh === 'burst' ? .6 + rnd() * .8 : 1.2 + rnd() * 1.6) : 1 + rnd() * 2; f.dir += (rnd() - .5) * 2.2; }
      const size = Math.pow(f.kg, .72) * sp.str, pull = size * (.55 + .45 * f.stam) * (f.run ? 1.6 + pace * .4 : .7) * (.9 + Math.sin(t * 7) * .1);
      const reelPull = F.reel ? (F.reelFast ? 1.25 : .85) * rod.reel : 0;
      let tension; // kg on the line
      f.took = pull > dragKg; f.age = (f.age || 0) + dt;
      if (f.took) { const slip = Math.min(3.5, (pull - dragKg) / Math.max(.4, size) * 1.2 * pace); f.dist += slip * dt; tension = dragKg * (F.reel ? 1.25 : 1.05); if (rnd() < dt * 8) sfx.tap(); }
      else { tension = pull + reelPull * dragKg * .35; if (F.reel) f.dist -= (F.reelFast ? 3 : 2) * rod.reel * dt * (1 - pull / dragKg * .5); }
      if (f.shockT > 0) { f.shockT -= dt; tension += size * .7 * Math.max(0, f.shockT / .35); } // head-shake / run start: shock load before the drag starts to slip
      f.tension = tension; const T01 = tension / rod.line;
      // stamina drains with time and tension
      f.stam = Math.max(0, f.stam - dt * (.02 + T01 * .09 + (f.took ? .03 : 0)) * (f.age > 60 ? 2 : 1) / Math.max(.6, Math.pow(f.kg, .25) * sp.str * .7));
      // fish moves underwater (for the underwater camera): pelagics near the surface, bottom fish dive
      const seabed = depthAt(f.x, f.z), wantD = sp.beh === 'rock' || sp.beh === 'heavy' ? seabed - .4 : Math.min(seabed - .5, 1.5 + (1 - f.stam) * 2);
      f.depth += (wantD - f.depth) * Math.min(1, dt * (f.run ? 1.2 : .4)); const dx = f.x - a.x, dz = f.z - a.z, d = hyp(dx, dz) || 1, lateral = Math.sin(f.dir) * (f.run ? 3 : 1.2);
      const horiz = Math.sqrt(Math.max(1, f.dist * f.dist - f.depth * f.depth)); f.x = a.x + dx / d * horiz + (-dz / d) * lateral * dt; f.z = a.z + dz / d * horiz + (dx / d) * lateral * dt;
      // jumps (queenfish, sailfish)
      if (sp.beh === 'jump' && f.run && f.stam > .3 && rnd() < dt * .5) { f.jumpT = .9; splashAt(f.x, f.z, 30); sfx.splash(); hasMsg('Ikan melompat! · Jump! — kurangkan tegang', 1.2); }
      if (f.jumpT > 0) { f.jumpT -= dt; if (T01 > .8 && rnd() < dt * 1.5) return lose('Mata kail tercabut masa lompat · Thrown the hook', 'thrown'); }
      // rock dives: reef fish cut the line on the rocks unless you keep pressure on
      if (sp.beh === 'rock' && f.depth > seabed - 1.2 && zoneAt(f.x, f.z) === 'k') { f.rockT += dt * (f.took && f.run ? 1 : T01 < .2 ? .5 : F.reel ? -1.3 : -.6); f.rockT = Math.max(0, f.rockT); if (f.rockT > 5) return lose('Tali putus — tersangkut karang! · Cut off on the reef', 'cut'); if (f.rockT > 1.5 && rnd() < dt) hasMsg('Ia lari ke karang! Tambah tekanan!', 1); }
      if (T01 >= 1) { F.over += dt; if (F.over > .25) return lose(`TALI PUTUS! · Line snapped (${rod.line} kg)`, 'snap'); } else F.over = Math.max(0, F.over - dt);
      if (T01 < .07) { F.slack += dt; if (F.slack > 2.6) return lose('Tali kendur — ikan terlepas · Slack line, fish got off', 'slack'); } else F.slack = 0;
      if (f.dist > rod.spool) return lose('Tali habis — ikan terlalu besar! · Spooled', 'spool');
      if (f.dist > rod.spool * .8 && !f.warnSpool) { f.warnSpool = true; hasMsg('⚠️ Tali hampir habis! · Line nearly gone!', 1.6); sfx.bad(); } else if (f.dist < rod.spool * .6) f.warnSpool = false;
      F.bx = f.x; F.bz = f.z; F.bd = f.depth;
      if (f.dist < 2.6) startLanding();
    }

    // ---------- camera rig (own smoothing; framework snaps)
    const view = { pos: new T.Vector3(0, JET.top + 3, JET.z1 + 7), look: new T.Vector3(0, 1, -20), halfW: 10, halfH: 6, snap: true };
    const cp = view.pos.clone(), cl = view.look.clone(), tp = new T.Vector3(), tl = new T.Vector3();
    function cam(dt, k = 3, fov = 50) { const a1 = st.snap ? 1 : 1 - Math.exp(-dt * k); st.snap = false; cp.lerp(tp, a1); cl.lerp(tl, a1); view.pos.copy(cp); view.look.copy(cl); const d = cp.distanceTo(cl); view.halfH = d * Math.tan(fov * Math.PI / 360); view.halfW = view.halfH * 1.6; }

    // ---------- HUD painting
    let hudT = 0;
    function hud(dt, env) {
      hudT -= dt; const a = anglerPos(), x = mode === 'drive' ? boat.x : F.st === 'idle' || F.st === 'charge' ? a.x : F.bx, z = mode === 'drive' ? boat.z : F.st === 'idle' || F.st === 'charge' ? a.z : F.bz, zn = ZONE[zoneAt(x, z)], d = depthAt(x, z);
      if (hudT <= 0) { hudT = .2;
        q('.zone').innerHTML = `<i style="background:${zn.col}"></i>${zn.bm}`; q('.depth').textContent = `⬇ ${d.toFixed(1)} m`;
        const hh = Math.floor(W.hour), mm = Math.floor((W.hour - hh) * 60); q('.time').textContent = `${env.night > .5 ? '🌙' : '🕐'} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; q('.wx').textContent = `${WX[W.weather][0]} ${WX[W.weather][1]}`;
        q('.sfEq').innerHTML = `🎣 ${rod0().bm} · ${BAITS[F.bait].ic} ${BAITS[F.bait].bm} · Drag <b>${Math.round(F.drag * rod0().drag)} kg</b>${mode === 'drive' ? ` · 🚤 ${Math.abs(boat.v * 1.94).toFixed(0)} knot` : ''}`;
        drawSonar(x, z, d); }
      const fb = q('.sfFight'); fb.hidden = !(F.st === 'fight' || F.st === 'gaff'); root.classList.toggle('catching', F.st === 'catch');
      if (F.st === 'fight' || F.st === 'gaff') { const f = F.fight, T01 = clamp(f.tension / rod0().line, 0, 1.1); fb.querySelector('.tbar b').style.height = `${Math.min(1, T01) * 100}%`; fb.querySelector('.tbar b').style.background = T01 > .85 ? '#e74c3c' : T01 > .6 ? '#f1c40f' : T01 < .1 ? '#95a5a6' : '#2ecc71';
        fb.querySelector('.tbar .lim').style.bottom = `${clamp(F.drag * rod0().drag / rod0().line, 0, 1) * 100}%`;
        fb.querySelector('.finfo').innerHTML = `<b>${f.tension.toFixed(1)} kg</b> tegang<br>⬇ ${f.depth.toFixed(1)} m · 📏 ${f.dist.toFixed(0)} m<br>🧵 <span style="color:${f.dist > rod0().spool * .8 ? '#ff7a6a' : 'inherit'}">${Math.max(0, rod0().spool - f.dist).toFixed(0)} m</span> tali${f.big ? ' · <em>BESAR!</em>' : ''}<br>💪 ${'▮'.repeat(clamp(Math.ceil(f.stam * 5), 0, 5))}${'▯'.repeat(5 - clamp(Math.ceil(f.stam * 5), 0, 5))}${f.run ? '<br><em>LARI!</em>' : ''}`; }
      const m = q('.f3Msg'); if (F.msgT > 0) { F.msgT -= dt; if (m.textContent !== F.msg) m.textContent = F.msg; m.classList.add('show'); } else m.classList.remove('show');
      // buttons for the current situation
      let list;
      if (['catch', 'lost', 'landing'].includes(F.st)) list = [];
      else if (F.st === 'gaff') list = ['gaff'];
      else if (F.st === 'fight') list = ['reel', 'dragDn', 'dragUp', 'fast', 'under'];
      else if (mode === 'drive') list = boat.troll || F.st === 'troll' ? ['trollOff', 'anchorDown'] : F.st === 'bite' ? ['strike'] : F.st === 'fight' ? ['reel', 'dragDn', 'dragUp', 'fast', 'under'] : ['anchorDown', 'troll', ...(hyp(boat.x - 3.5, boat.z - 2) < 9 ? ['jetty'] : [])];
      else if (F.st === 'idle' || F.st === 'charge') list = ['cast', 'drop', 'bait', mode === 'jetty' ? 'board' : 'anchorUp', ...(mode === 'boat' && hyp(boat.x - 3.5, boat.z - 2) < 9 ? ['jetty'] : [])];
      else if (F.st === 'fight') list = ['reel', 'dragDn', 'dragUp', 'fast', 'under'];
      else if (F.st === 'nibble' || F.st === 'bite') list = ['strike', 'reel', 'under'];
      else list = ['reel', ...(F.bait === 'gewang' ? ['jig'] : []), 'strike', 'under'];
      setButtons(list);
      const sb = btnBox.querySelector('.sb-strike'); if (sb) sb.classList.toggle('hot', F.st === 'bite'); const gb = btnBox.querySelector('.sb-gaff'); if (gb) gb.classList.add('hot');
      const pw = btnBox.querySelector('.sb-cast .pw b'); if (pw) { pw.style.height = `${F.st === 'charge' ? F.power * 100 : 0}%`; }
      stick.style.visibility = mode === 'drive' || F.st === 'idle' || F.st === 'charge' ? 'visible' : 'hidden';
    }
    let sonarX = 0; const sonarHist = [];
    function drawSonar(x, z, d) {
      const lvl = sv.finder, w = sonar.width, h = sonar.height; sonarHist.push({ d, blips: lvl ? biteWeights({ zone: zoneAt(x, z), depth: d * .7, bottom: false, bait: 'umpan', tech: 'cast', hour: W.hour, weather: W.weather }).concat(biteWeights({ zone: zoneAt(x, z), depth: d - .5, bottom: true, bait: 'sotong', tech: 'bottom', hour: W.hour, weather: W.weather })) : [] }); if (sonarHist.length > 44) sonarHist.shift();
      sctx.fillStyle = 'rgba(4,16,30,.86)'; sctx.fillRect(0, 0, w, h); const maxD = 60;
      sonarHist.forEach((s, i) => { const xx = i * 5, yy = 14 + s.d / maxD * (h - 20); const g = sctx.createLinearGradient(0, yy, 0, h); g.addColorStop(0, '#c98b4a'); g.addColorStop(1, '#5a3a1e'); sctx.fillStyle = g; sctx.fillRect(xx, yy, 5, h - yy);
        if (lvl) for (const [sp, wt] of s.blips) if (((i * 7 + sp.id.length * 13) % 9) < Math.min(8, wt / 3)) { const fy = 14 + clamp(((sp.depth[0] + Math.min(s.d, sp.depth[1])) / 2) / maxD, 0, 1) * (h - 22); sctx.fillStyle = lvl > 1 ? RARITY[sp.rar].col : '#ffe066'; sctx.beginPath(); sctx.arc(xx + 2.5, fy, 2.2 + Math.min(2, wt / 12), 0, 7); sctx.fill(); } });
      sctx.fillStyle = '#fff'; sctx.font = '800 11px system-ui'; sctx.fillText(lvl ? `SONAR · ${d.toFixed(1)} m` : `${d.toFixed(1)} m · Tiada sonar`, 6, 12);
      if (F.st !== 'idle' && F.st !== 'catch' && F.st !== 'charge' && F.st !== 'flying') { const by = 14 + clamp(F.bd / maxD, 0, 1) * (h - 20); sctx.fillStyle = '#ff5533'; sctx.fillRect(w - 10, by - 2, 8, 4); sctx.fillText('🪝', w - 26, by + 4); }
    }

    // ---------- tutorial text in the step line (shown on the framework card before play)
    api.tools([]); api.step('Pancing Laut', 'Sea fishing');
    hasMsg('Selamat datang ke jeti! LEMPAR atau TURUN umpan · NAIK BOT untuk ke laut', 3.5);
    const tmpV = new T.Vector3();
    return {
      scene, view, ray() { return { ok: false }; }, down() {}, move() {}, up() {},
      timerText: () => `🐟 ${F.landed.length}`,
      dbg: () => ({ amb: amb.map(f => f.sp.id + ':' + f.mode), view: st.vKey, mode, st: F.st, bait: F.bait, tech: F.tech, bd: F.bd, bx: F.bx, bz: F.bz, zone: zoneAt(F.bx, F.bz), boat: { x: boat.x, z: boat.z, v: boat.v, anchored: boat.anchored }, fight: F.fight && { sp: F.fight.sp.id, kg: F.fight.kg, dist: F.fight.dist, tension: F.fight.tension, stam: F.fight.stam }, landed: F.landed.length, hour: W.hour, weather: W.weather, catch: F.catch && F.catch.sp.id }),
      sim: { press, F, boat, W, SEA_FISH, setMode: (m) => { mode = m; }, depthAt, zoneAt, rollBite, land },
      update(dt, p, camera) {
        const tut = document.getElementById('gTut'); if (paused || (tut && !tut.hidden)) return;
        if (camera && camera.far !== 650) { camera.far = 650; camera.near = .15; }
        t += dt; st.t += dt; const env = envUpdate(dt);
        // joystick aims the cast while fishing (left/right)
        if (mode !== 'drive' && (F.st === 'idle' || F.st === 'charge')) { const kx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0); F.aimYaw = clamp(F.aimYaw + (kx || joy.x) * dt * 1.2, -1.2, 1.2); }
        boatUpdate(dt); fishingUpdate(dt); ambUpdate(dt);
        const under = mode !== 'drive' && F.st !== 'troll' && ((F.uwWait && ['sinking', 'wait', 'nibble', 'bite'].includes(F.st)) || (F.uwFight && F.st === 'fight'));
        const fp = ['fight', 'gaff', 'landing', 'lost'].includes(F.st) && !!F.fight && !under; // fight in first person, like UFS
        // angler + rod placement
        const a = anglerPos(); hero.position.set(a.x, a.y, a.z); hero.rotation.y = -a.yaw + Math.PI;
        if (mode === 'drive') { hero.position.set(boat.x - Math.sin(boat.yaw) * HALF.l * .55, deckY + bob.y, boat.z + Math.cos(boat.yaw) * HALF.l * .55); hero.rotation.y = -boat.yaw + Math.PI; }
        if (['fight', 'bite', 'gaff', 'landing', 'lost'].includes(F.st)) { const fy = Math.atan2(F.bx - hero.position.x, -(F.bz - hero.position.z)); hero.rotation.y = -fy + Math.PI; }
        hero.visible = !fp;
        rodPivot.visible = mode !== 'drive' || ['troll', 'fight', 'bite', 'gaff', 'landing', 'lost'].includes(F.st);
        const hy = hero.rotation.y, hx = hero.position.x - Math.cos(hy) * .28, hz = hero.position.z + Math.sin(hy) * .28; // right hand
        rodPivot.position.set(hx - Math.sin(hy) * (fp ? -.2 : 0), hero.position.y + (fp ? 1.15 : 1.05), hz - Math.cos(hy) * (fp ? -.2 : 0)); rodPivot.rotation.y = hy;
        rodKick = Math.max(0, rodKick - dt * 2.5);
        // ----- rod: bend from line tension, pumping while you reel a big fish, spring-back when the line goes
        const ff = F.fight, fightLike = ['fight', 'gaff', 'landing', 'lost'].includes(F.st) && !!ff, T01 = ff ? clamp(ff.tension / rod0().line, 0, 1.2) : 0;
        let bend = F.st === 'charge' ? -F.power * .4 : 0, pitch = .95 - (F.st === 'charge' ? F.power * 1.2 : 0);
        if (F.st === 'flying') pitch = .95 + Math.min(1, F.flyT * 4) * .25; // follow-through after the cast
        if (F.st === 'fight') { st.pump = F.reel ? (st.pump || 0) + dt * 2.3 : (st.pump || 0); const lift = F.reel && T01 > .25 ? (.5 + .5 * Math.sin(st.pump)) * .32 : .12;
          bend = T01 * .95 + (ff.run ? Math.sin(t * 23) * .04 : 0); pitch = .62 - lift + (ff.run ? .08 : 0) + Math.sin(t * 2) * .03; }
        else if (F.st === 'gaff') { bend = .7 + Math.sin(t * 17) * .12; pitch = .45 + Math.sin(t * 9) * .05; }
        else if (F.st === 'landing') { bend = .55 * (1 - F.landT) + .25; pitch = .55 - F.landT * .45; }
        else if (F.st === 'lost') { const k = F.lostT / F.lostD; bend = F.lostK === 'slack' || F.lostK === 'thrown' ? .3 * k * k : Math.sin((1 - k) * 34) * k * k * .7; pitch = .62 - (F.lostK === 'snap' || F.lostK === 'cut' || F.lostK === 'spool' ? Math.sin(Math.min(1, (1 - k) * 6) * Math.PI) * .35 : 0); }
        else if (F.st === 'nibble' || F.st === 'bite') bend = rodKick * .5 + Math.sin(t * 30) * rodKick * .1;
        else bend += rodKick * .5 + Math.sin(t * 30) * rodKick * .1;
        bendRod(clamp(bend, -.4, 1.15)); rodTilt.rotation.x += (pitch - rodTilt.rotation.x) * Math.min(1, dt * 10);
        // ----- reel: crank turns while reeling, rotor x5.2, spool slips back when the drag gives line, bail open for the cast
        const reeling = F.reel && ['wait', 'nibble', 'bite', 'sinking', 'fight'].includes(F.st), took = F.st === 'fight' && ff.took;
        const crankV = reeling ? (F.reelFast ? 17 : 11) * (took ? .45 : 1) : F.st === 'landing' ? 9 : 0;
        RL.crank += crankV * dt; RL.rotor += crankV * 5.2 * dt;
        RL.spool += (took ? -(ff.pull > 0 ? 28 : 20) : F.st === 'flying' ? -60 : F.st === 'lost' && F.lostK === 'spool' ? -90 : 0) * dt;
        RL.bail += (((F.st === 'charge' || F.st === 'flying') ? 1 : 0) - RL.bail) * Math.min(1, dt * 12);
        handle.rotation.x = RL.crank; rotor.rotation.y = RL.rotor; spool.rotation.y = RL.spool; bail.rotation.y = RL.bail * 2.4;
        const out = ff ? clamp(ff.dist / rod0().spool, 0, 1) : 0; wrap.scale.set(1 - out * .45, 1, 1 - out * .45);
        if (took && rnd() < dt * 22) sfx.tap(); // drag clicks
        rodTilt.updateMatrixWorld(true); tipW.copy(tipLocal).applyMatrix4(rodTilt.matrixWorld);
        // ----- bobber / sinker
        const inWater = !['idle', 'charge', 'catch', 'landing', 'lost'].includes(F.st);
        const by = F.st === 'flying' ? F.by : -F.bd; bobber.visible = inWater && !['fight', 'gaff'].includes(F.st) && F.bait !== 'gewang' && F.tech !== 'bottom'; bobber.position.set(F.bx, .05 + Math.sin(t * 2) * .03 - (F.st === 'bite' ? .15 : F.st === 'nibble' ? Math.abs(Math.sin(t * 18)) * .06 : 0), F.bz);
        sinker.visible = inWater && F.st !== 'flying' && F.st !== 'gaff'; sinker.position.set(F.bx, by, F.bz);
        // ----- hooked fish: underwater during the fight, thrashing at the surface for the gaff, lifted out on the landing
        if (fightLike && F.st !== 'lost') { fishHolder.visible = true; if (!fishObj || fishHolder.userData.id !== ff.sp.id) { setFishModel(ff.sp, ff.kg); fishHolder.userData.id = ff.sp.id; }
          if (F.st === 'fight') { fishHolder.position.set(F.bx, -F.bd, F.bz); fishHolder.rotation.set(0, Math.atan2(-(F.bz - a.z), F.bx - a.x) + Math.sin(t * 6) * .25, Math.sin(t * 9) * .1);
            if (ff.jumpT > 0) { fishHolder.position.y = Math.sin(ff.jumpT / .9 * Math.PI) * 1.8; fishHolder.rotation.z = (1 - ff.jumpT / .9) * 2.4 - 1.2; } }
          else if (F.st === 'gaff') { fishHolder.position.set(F.bx + Math.sin(t * 11) * .15, -.12 + Math.abs(Math.sin(t * 7)) * .25, F.bz + Math.cos(t * 13) * .15); fishHolder.rotation.set(Math.sin(t * 15) * .5, Math.atan2(-(F.bz - a.z), F.bx - a.x) + Math.sin(t * 9) * .6, Math.sin(t * 12) * .4); }
          else { const k = F.landT, e = k * k * (3 - 2 * k), hp = hero.position, fy = Math.atan2(F.bx - hp.x, -(F.bz - hp.z)), hx2 = hp.x + Math.sin(fy) * .75, hz2 = hp.z - Math.cos(fy) * .75, hy2 = hp.y + 1.25;
            fishHolder.position.set(F.bx + (hx2 - F.bx) * e, Math.max(-.1, (-.1) + (hy2 + .1) * e + Math.sin(e * Math.PI) * 1.1), F.bz + (hz2 - F.bz) * e);
            fishHolder.rotation.set(0, -fy + Math.PI / 2, Math.PI / 2 * Math.min(1, k * 2.5) + Math.sin(t * 19) * .45 * (1 - k * .6)); if (k < .25 && rnd() < dt * 20) splash.add(F.bx, .1, F.bz, (rnd() - .5) * 2, 2 + rnd() * 2, (rnd() - .5) * 2, .6); } }
        else if (F.st !== 'catch') fishHolder.visible = false;
        // ----- line: tip → (sagging curve) → water entry → down to the bait/fish
        line.visible = inWater || F.st === 'charge' || F.st === 'landing' || (F.st === 'lost' && F.lostT > .2);
        if (line.visible) {
          let ex = F.bx, ey = F.st === 'flying' ? F.by : .02, ez = F.bz, sag, under2 = F.st !== 'flying' && F.st !== 'gaff';
          if (F.st === 'landing') { const fp2 = fishHolder.position; ex = fp2.x; ey = fp2.y + .25; ez = fp2.z; under2 = false; }
          if (F.st === 'gaff') { ey = .05; }
          const span = Math.hypot(ex - tipW.x, ez - tipW.z, ey - tipW.y);
          if (F.st === 'fight' || F.st === 'gaff') sag = (1 - clamp(T01 * 2.2, 0, 1)) * span * .07 + .02;
          else if (F.st === 'landing') sag = .03;
          else if (F.st === 'lost') { const k = 1 - F.lostT / F.lostD; if (F.lostK === 'snap' || F.lostK === 'cut' || F.lostK === 'spool') { // the broken end whips back and drifts down
              const back = Math.min(1, k * 2.5); ex = tipW.x + (F.bx - tipW.x) * (1 - back) * .25 + Math.sin(k * 20) * .3; ez = tipW.z + (F.bz - tipW.z) * (1 - back) * .25; ey = tipW.y - 1.5 - k * 2.2; sag = .6; under2 = false; }
            else sag = span * .18; }
          else sag = span * (F.st === 'flying' ? .04 : .1);
          for (let i = 0; i < LN; i++) { const u = i / (LN - 1), last = under2 && i === LN - 1, uu = under2 ? Math.min(1, i / (LN - 2)) : u;
            if (last) { linePts[i].set(F.bx, by, F.bz); continue; }
            linePts[i].set(tipW.x + (ex - tipW.x) * uu, tipW.y + (ey - tipW.y) * uu - Math.sin(uu * Math.PI) * sag + (F.st === 'lost' ? Math.sin(uu * 14 + t * 20) * .05 : 0), tipW.z + (ez - tipW.z) * uu); }
          lineGeo.setFromPoints(linePts); line.material.color.setHex(F.st === 'fight' && T01 > .85 ? 0xff6655 : 0xf5f5f5); }
        // cameras
        underSky.visible = under; st.underBlend = under ? 1 : 0; const vKey = F.st === 'catch' ? 'c' : under ? 'u' : fp ? 'f' : 'o'; if (vKey !== st.vKey) { st.snap = !!st.vKey && (vKey === 'u' || st.vKey === 'u' || vKey === 'f'); st.vKey = vKey; }
        if (F.st === 'catch') { // showcase: fish rotates in front of the angler, card on the right
          // trophy pose: the angler turns to the camera and holds the fish across the chest; the camera frames them on the left, card on the right
          const yaw = a.yaw, fx = Math.sin(yaw), fz = -Math.cos(yaw), rx = -Math.cos(yaw), rz = -Math.sin(yaw); // f: angler faces camera; r: camera's right
          const L = fishObj ? fishLen(F.catch.kg) : .6, d = 2.6 + L * 1.1, asp = (camera && camera.aspect) || 1.8, off = clamp(.37 * .38 * d * asp, .35, 1.6);
          rodPivot.visible = false;
          fishHolder.position.set(a.x + fx * .42, a.y + 1.12 + Math.sin(t * 2) * .02, a.z + fz * .42); fishHolder.rotation.set(0, Math.PI - yaw, .12 + Math.sin(t * 7) * .05 * Math.max(0, Math.sin(t * .8)));
          tp.set(a.x + fx * d + rx * .25, a.y + 1.45 + L * .15, a.z + fz * d + rz * .25); tl.set(a.x + rx * off, a.y + 1.05, a.z + rz * off); cam(dt, 4, 42);
        } else if (under) { // underwater: behind the bait, looking back along the line so the fish around it are in view
          const dx = F.bx - a.x, dz = F.bz - a.z, d = hyp(dx, dz) || 1, ux = dx / d, uz = dz / d, seabed = depthAt(F.bx, F.bz);
          tp.set(F.bx - ux * 3.6 - uz * 1.4, clamp(-F.bd + .8, -seabed + .5, -.4), F.bz - uz * 3.6 + ux * 1.4); tl.set(F.bx + ux * .8, -F.bd + .1, F.bz + uz * .8); cam(dt, 3, 64);
          for (let k = 0; k < 3; k++) motes.add(tp.x + (rnd() - .5) * 9, tp.y + (rnd() - .5) * 4, tp.z + (rnd() - .5) * 9, (rnd() - .5) * .1, (rnd() - .5) * .06, (rnd() - .5) * .1, 3 + rnd() * 2);
        } else if (fp) { // first person: eye above the rod hand, looking down the line to where it cuts the water
          const hp = hero.position, fy = Math.atan2(F.bx - hp.x, -(F.bz - hp.z)), fx = Math.sin(fy), fz = -Math.cos(fy), T01 = clamp(F.fight.tension / rod0().line, 0, 1.2), sh = Math.max(0, T01 - .55) * .06;
          tp.set(hp.x + fx * .1 - fz * .05 + (rnd() - .5) * sh, hp.y + 1.6 + (rnd() - .5) * sh, hp.z + fz * .1 + fx * .05 + (rnd() - .5) * sh);
          const near = Math.min(hyp(F.bx - hp.x, F.bz - hp.z), 30); tl.set(hp.x + fx * near, (F.fight.jumpT > 0 ? .8 : -.6) - near * .02, hp.z + fz * near);
          if (F.st === 'gaff') tl.set(F.bx, -.3, F.bz);
          else if (F.st === 'landing') tl.copy(fishHolder.position).y -= .1;
          else if (F.st === 'lost') { const k = 1 - F.lostT / F.lostD; if (F.lostK === 'snap' || F.lostK === 'cut' || F.lostK === 'spool') { tl.y += Math.sin(Math.min(1, k * 5) * Math.PI) * 1.2; tp.y += Math.sin(Math.min(1, k * 5) * Math.PI) * .08; } }
          cam(dt, F.st === 'lost' ? 9 : 5, 62);
          if (F.fight.run && F.fight.depth < 2.5 && rnd() < dt * 12) splash.add(F.bx + (rnd() - .5), .1, F.bz + (rnd() - .5), (rnd() - .5) * 2, 1 + rnd() * 1.5, (rnd() - .5) * 2, .5);
        }
        else if (mode === 'drive') { const fx = Math.sin(boat.yaw), fz = -Math.cos(boat.yaw), sp = clamp(Math.abs(boat.v) / 10, 0, 1); tp.set(boat.x - fx * (11 + sp * 4), 5 + sp * 1.5, boat.z - fz * (11 + sp * 4)); tl.set(boat.x + fx * 8, 1, boat.z + fz * 8); cam(dt, 2.6, 52); }
        else { const fx = Math.sin(a.yaw), fz = -Math.cos(a.yaw), far = ['wait', 'nibble', 'bite', 'sinking', 'fight', 'flying'].includes(F.st), side = .9;
          const lx = far ? F.bx : a.x + fx * 12, lz = far ? F.bz : a.z + fz * 12;
          tp.set(a.x - fx * 4.2 + fz * -side, a.y + 2.8, a.z - fz * 4.2 - fx * -side); tl.set(lx * .6 + (a.x + fx * 10) * .4, F.st === 'fight' ? -.5 : .4, lz * .6 + (a.z + fz * 10) * .4); cam(dt, 2.8, 50); }
        // first-person hands: right hand grips the rod by the reel foot, left hand turns the reel handle
        { const show = fp && F.st !== 'catch';
          if (show) { const fw = av[0].copy(cl).sub(cp).normalize(), rt = av[1].crossVectors(fw, UPV).normalize(), up2 = av[2].crossVectors(rt, fw);
            const grip = new T.Vector3(0, ROD_L * .14, .02); rodTilt.localToWorld(grip); const kn = crankKnob.getWorldPosition(new T.Vector3());
            const eR = av[3].copy(cp).addScaledVector(rt, .3).addScaledVector(up2, -.46).addScaledVector(fw, .12); placeArm(arms[0], eR, grip, true);
            const eL = new T.Vector3().copy(cp).addScaledVector(rt, -.12).addScaledVector(up2, -.5).addScaledVector(fw, .2); placeArm(arms[1], eL, kn, true); }
          else { placeArm(arms[0], null, null, false); placeArm(arms[1], null, null, false); } }
        { const U = ocean.uniforms; if (U.uHole) { const h = U.uHole.value, dd = U.uHoleDir.value; h.x = boat.x - ocean.mesh.position.x; h.y = -(boat.z - ocean.mesh.position.z); h.z = HALF.l * .96; h.w = HALF.w * .9; dd.x = Math.sin(boat.yaw); dd.y = Math.cos(boat.yaw); } }
        ocean.update(t, scene.background); shore(t); splash.update(dt, -9); rain.update(dt, -14); motes.update(dt, 0); motes.pts.visible = under;
        for (const b of buoys) { b.position.y = Math.sin(t * 1.4 + b.position.x) * .15; b.rotation.z = Math.sin(t + b.position.z) * .1; }
        hud(dt, env);
        api.progress(Math.min(.999, F.landed.length / 5));
      },
      stop() {
        removeEventListener('keydown', onKey); removeEventListener('keyup', onKey);
        stick.removeEventListener('pointerdown', sDown); stick.removeEventListener('pointermove', sMv); stick.removeEventListener('pointerup', sUp); stick.removeEventListener('pointercancel', sUp); root.removeEventListener('touchmove', noG);
        engine && engine.stop && engine.stop(); reelS && reelS.stop && reelS.stop(); ambience && ambience.stop && ambience.stop(); musicDuck(false);
        root.remove(); $('game').classList.remove('f3mode'); save();
      },
    };
  };
}
