// DAMAI CITY MALL v2.0 — supermarket shopping simulator (Misi Beli-Belah).
// Walk in, take a trolley, push it down real aisles (6 departments), pick the items on your list off the shelves,
// park at the checkout, watch the cashier scan everything and pay. Shoppers wander the aisles and queue at the tills.
// Layout: store x∈[-15,15], z∈[-11,11] (entrance on the +z side). All collision is 2D (circles vs. rectangles).
import { $, clamp, sfx, S, save, toast, musicDuck } from './core.js';
import { fmtRM } from './wallet.js';

export const MALL_CFG = { // difficulty presets (configurable)
  mudah: { bm: 'Mudah', en: 'Easy', items: 3, time: 180 },
  biasa: { bm: 'Biasa', en: 'Normal', items: 5, time: 300 },
  sukar: { bm: 'Sukar', en: 'Hard', items: 8, time: 420 },
};
export const DEPTS = {
  fresh: { bm: 'Pasar Segar', en: 'Fresh Market', ic: '🥬', col: '#27ae60' },
  grocery: { bm: 'Barangan Runcit', en: 'Grocery', ic: '🥫', col: '#e67e22' },
  fashion: { bm: 'Fesyen', en: 'Fashion', ic: '👗', col: '#8e44ad' },
  toys: { bm: 'Mainan', en: 'Toys', ic: '🧸', col: '#e84393' },
  frozen: { bm: 'Makanan Sejuk Beku', en: 'Frozen Food', ic: '🧊', col: '#2e86de' },
  house: { bm: 'Barangan Rumah', en: 'Household', ic: '🧴', col: '#16a085' },
};
// rows of double-sided shelves (x = centre line, from z0 to z1); aisles between them are 2.6 m wide (trolley friendly)
const ROWS = [{ x: -6.2, z0: -8, z1: 1 }, { x: -2.6, z0: -8, z1: 1 }, { x: 1.0, z0: -8, z1: 1 }, { x: 4.6, z0: -8, z1: 1 }];
const LV = [.42, .9, 1.38]; // shelf levels (product base heights)
const sideSpot = (r, side, z, lv) => ({ x: ROWS[r].x + side * .5, y: LV[lv], z, face: side }); // face: +1 = faces +x
// catalogue: every product has a department, a fixed place (aisle / shelf / level) and an interaction target
export const PRODUCTS = [
  { id: 'epal', bm: 'Epal merah', en: 'Red apples', ic: '🍎', dept: 'fresh', price: 6, shape: 'fruit', col: '#d63031', spot: { x: -11.6, y: .95, z: -5.2, face: 1, stand: true } },
  { id: 'pisang', bm: 'Pisang', en: 'Bananas', ic: '🍌', dept: 'fresh', price: 4, shape: 'fruit', col: '#f9ca24', spot: { x: -11.6, y: .95, z: -1.6, face: 1, stand: true } },
  { id: 'sayur', bm: 'Sayur kangkung', en: 'Water spinach', ic: '🥬', dept: 'fresh', price: 3, shape: 'veg', col: '#2ecc71', spot: { x: -11.6, y: .95, z: 2.0, face: 1, stand: true } },
  { id: 'ikan', bm: 'Ikan kembung', en: 'Mackerel', ic: '🐟', dept: 'fresh', price: 12, shape: 'fish', col: '#7f8fa6', spot: { x: -13.9, y: .95, z: -8.3, face: 1 } },
  { id: 'ayam', bm: 'Ayam segar', en: 'Fresh chicken', ic: '🍗', dept: 'fresh', price: 15, shape: 'meat', col: '#f8c291', spot: { x: -13.9, y: .95, z: -5.9, face: 1 } },
  { id: 'beras', bm: 'Beras 5 kg', en: 'Rice 5 kg', ic: '🍚', dept: 'grocery', price: 18, shape: 'sack', col: '#f5f6fa', spot: sideSpot(0, 1, -6.5, 0) },
  { id: 'mee', bm: 'Mi segera', en: 'Instant noodles', ic: '🍜', dept: 'grocery', price: 5, shape: 'box', col: '#e84118', spot: sideSpot(0, 1, -2.5, 1) },
  { id: 'sardin', bm: 'Sardin tin', en: 'Canned sardines', ic: '🥫', dept: 'grocery', price: 7, shape: 'can', col: '#c23616', spot: sideSpot(1, -1, -5.5, 1) },
  { id: 'air', bm: 'Air minuman', en: 'Drinks', ic: '🧃', dept: 'grocery', price: 3, shape: 'bottle', col: '#00a8ff', spot: sideSpot(1, -1, -1.5, 2) },
  { id: 'sabun', bm: 'Sabun basuh', en: 'Detergent', ic: '🧺', dept: 'house', price: 14, shape: 'jug', col: '#0097e6', spot: sideSpot(2, 1, -6.0, 0) },
  { id: 'mandi', bm: 'Sabun mandi', en: 'Bath soap', ic: '🧼', dept: 'house', price: 4, shape: 'box', col: '#fd79a8', spot: sideSpot(2, 1, -2.8, 1) },
  { id: 'pencuci', bm: 'Pencuci lantai', en: 'Floor cleaner', ic: '🧴', dept: 'house', price: 9, shape: 'bottle', col: '#44bd32', spot: sideSpot(3, -1, -4.5, 1) },
  { id: 'aiskrim', bm: 'Ais krim', en: 'Ice cream', ic: '🍦', dept: 'frozen', price: 8, shape: 'tub', col: '#ff9ff3', spot: { x: -2.2, y: .95, z: -9.7, face: 0, chest: true } },
  { id: 'nugget', bm: 'Nuget ayam', en: 'Frozen nuggets', ic: '🍗', dept: 'frozen', price: 11, shape: 'box', col: '#f6b93b', spot: { x: 2.6, y: .95, z: -9.7, face: 0, chest: true } },
  { id: 'baju', bm: 'Baju raya', en: 'Raya outfit', ic: '👘', dept: 'fashion', price: 45, shape: 'cloth', col: '#6c5ce7', spot: { x: 10.4, y: .95, z: -7.2, face: 0, rack: true } },
  { id: 'kasut', bm: 'Kasut', en: 'Shoes', ic: '👟', dept: 'fashion', price: 35, shape: 'shoe', col: '#2d3436', spot: { x: 14.2, y: .9, z: -4.0, face: -1 } },
  { id: 'songkok', bm: 'Songkok', en: 'Songkok cap', ic: '🎩', dept: 'fashion', price: 20, shape: 'hat', col: '#1e272e', spot: { x: 14.2, y: 1.38, z: -6.4, face: -1 } },
  { id: 'gacha', bm: 'Mainan gacha', en: 'Gacha toy', ic: '🎁', dept: 'toys', price: 3, shape: 'capsule', col: '#ff7675', spot: { x: 9.6, y: .0, z: 0.4, face: 0, gacha: true } },
  { id: 'patung', bm: 'Anak patung', en: 'Doll', ic: '🪆', dept: 'toys', price: 22, shape: 'toybox', col: '#fd79a8', spot: { x: 14.2, y: .9, z: 1.2, face: -1 } },
  { id: 'permainan', bm: 'Permainan papan', en: 'Board game', ic: '🎲', dept: 'toys', price: 28, shape: 'toybox', col: '#0984e3', spot: { x: 14.2, y: .42, z: 3.0, face: -1 } },
];
const P = Object.fromEntries(PRODUCTS.map(p => [p.id, p]));

export function mallScene({ T, environment, Sparks, putModel, putAnimated, textPlane, makeHero, mulberry32 }) {
  return function Mall2(K, api, opts, M = {}) {
    const r = mulberry32(31);
    const scene = new T.Scene(); const sun = environment(K, scene, { sky: 0xeef1f4, shadow: 18, fogNear: 30, fogFar: 70 });
    sun.position.set(6, 20, 8); if (sun.target) scene.add(sun.target); sun.intensity = 1.2;
    const hemi = scene.children.find(o => o.isHemisphereLight); if (hemi) hemi.intensity = 2.1;
    const rects = []; // collision rectangles {x0,x1,z0,z1}
    const block = (x, z, w, d) => rects.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
    // ================================================= SHELL: floor, walls, ceiling, entrance
    const tile = K.canvasTex(256, 256); { const x = tile.x; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#f2efe9' : '#e6e2da'; x.fillRect(i * 64, j * 64, 64, 64); } x.strokeStyle = 'rgba(0,0,0,.07)'; for (let k = 0; k <= 256; k += 64) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k, 256); x.moveTo(0, k); x.lineTo(256, k); x.stroke(); } tile.t.wrapS = tile.t.wrapT = T.RepeatWrapping; tile.t.repeat && tile.t.repeat.set(15, 11); tile.t.needsUpdate = true; }
    K.mesh(new T.BoxGeometry(30, .1, 22), new T.MeshStandardMaterial({ map: tile.t, roughness: .25, metalness: .05 }), 0, -.05, 0, scene, false);
    K.box(40, .1, 14, K.mat(0x8f8f8f), 0, -.06, 18, scene, false); // car park outside
    const wallM = K.mat(0xf7f3ea, { roughness: .9 }), trimM = K.mat(0x8e44ad);
    K.box(30, 4.6, .3, wallM, 0, 2.3, -11.15, scene, false); for (const x of [-15.15, 15.15]) K.box(.3, 4.6, 22, wallM, x, 2.3, 0, scene, false);
    for (const [x0, x1] of [[-15, -6], [-2, 9], [13, 15]]) { K.box(x1 - x0, 4.6, .3, wallM, (x0 + x1) / 2, 2.3, 11.15, scene, false); block((x0 + x1) / 2, 11.15, x1 - x0, .4); }
    for (const x of [-4, 11]) { K.box(4, 1.4, .3, wallM, x, 3.9, 11.15, scene, false); const gl = K.box(4, 3.2, .06, new T.MeshStandardMaterial({ color: 0x9fd3f0, transparent: true, opacity: .25, roughness: .05 }), x, 1.6, 11.6, scene, false); }
    block(0, -11.15, 30, .4); block(-15.15, 0, .4, 22); block(15.15, 0, .4, 22);
    K.box(30.4, .25, .35, trimM, 0, 4.5, -11, scene, false); K.box(30.4, .25, .35, trimM, 0, 4.5, 11, scene, false);
    const ceil = K.mesh(new T.BoxGeometry(30, .1, 22), K.mat(0xffffff), 0, 4.65, 0, scene, false);
    const panelM = new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.1 });
    for (let x = -12; x <= 12; x += 4) for (let z = -8; z <= 8; z += 4) K.box(2.4, .04, .5, panelM, x, 4.58, z, scene, false);
    const doorSign = (x, t, c) => { const s = textPlane(K, t, 3.6, .6, { bg: c, px: 120 }); s.position.set(x, 3.9, 11.33); scene.add(s); const s2 = s.clone(); s2.position.z = 10.97; s2.rotation.y = Math.PI; scene.add(s2); };
    doorSign(-4, 'MASUK · ENTRANCE', '#27ae60'); doorSign(11, 'KELUAR · EXIT', '#c0392b');
    { const big = textPlane(K, 'DAMAI CITY MALL · PASARAYA', 12, 1.1, { bg: '#8e44ad', px: 110 }); big.position.set(0, 5.4, 11.4); scene.add(big); K.box(30.6, 1.6, .3, K.mat(0x6c3483), 0, 5.4, 11.25, scene, false); }
    // ================================================= PRODUCTS (instanced decorative stock + individual mission stock)
    const labelMat = new Map();
    function packMat(p) { if (labelMat.has(p.id)) return labelMat.get(p.id); const c = K.canvasTex(128, 128), x = c.x; x.fillStyle = p.col; x.fillRect(0, 0, 128, 128); x.fillStyle = 'rgba(255,255,255,.85)'; x.fillRect(0, 70, 128, 34); x.font = '64px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(p.ic, 64, 38); x.fillStyle = '#222'; x.font = '900 20px system-ui'; x.fillText(p.bm.split(' ')[0].toUpperCase(), 64, 88); c.t.needsUpdate = true; const m = new T.MeshStandardMaterial({ map: c.t, roughness: .55 }); labelMat.set(p.id, m); return m; }
    const GEO = {
      box: [new T.BoxGeometry(.22, .3, .1), .15], can: [new T.CylinderGeometry(.06, .06, .12, 12), .06], bottle: [new T.CylinderGeometry(.05, .06, .3, 10), .15], jug: [new T.BoxGeometry(.18, .3, .12), .15],
      sack: [new T.BoxGeometry(.34, .44, .16), .22], fruit: [new T.SphereGeometry(.07, 10, 8), .07], veg: [new T.CylinderGeometry(.07, .05, .3, 7), .15], fish: [new T.SphereGeometry(.12, 10, 6), .04], meat: [new T.BoxGeometry(.24, .07, .18), .035],
      tub: [new T.CylinderGeometry(.09, .08, .12, 14), .06], cloth: [new T.BoxGeometry(.32, .08, .26), .04], shoe: [new T.BoxGeometry(.3, .12, .18), .06], hat: [new T.CylinderGeometry(.11, .12, .12, 14), .06],
      capsule: [new T.SphereGeometry(.07, 10, 8), .07], toybox: [new T.BoxGeometry(.26, .34, .1), .17],
    };
    GEO.fish[0].scale && GEO.fish[0].scale(1.6, .45, .55);
    function unit(p) { const [g, half] = GEO[p.shape]; const m = new T.Mesh(g, p.shape === 'fruit' || p.shape === 'capsule' || p.shape === 'fish' || p.shape === 'veg' || p.shape === 'meat' ? K.mat(p.col, { roughness: .5 }) : packMat(p)); m.castShadow = true; m.userData.half = half; return m; }
    // decorative stock: many units per type via InstancedMesh (one draw call per type)
    const deco = {}; const addDeco = (p, x, y, z, ry = 0) => (deco[p.id] ||= []).push([x, y, z, ry]);
    // ================================================= FIXTURES
    const shelfM = K.mat(0xdfe4ea, { metalness: .4, roughness: .45 }), backM = K.mat(0xb2bec3), woodM = K.mat(0xc8a27a);
    function shelfRow(R) { const len = R.z1 - R.z0, cz = (R.z0 + R.z1) / 2; K.box(.08, 1.9, len, backM, R.x, .95, cz, scene); for (const y of [.12, ...LV.map(v => v - .03), 1.85]) K.box(1.0, .05, len, shelfM, R.x, y, cz, scene, false); for (const z of [R.z0, R.z1]) K.box(1.02, 1.95, .06, shelfM, R.x, .97, z, scene); K.box(1.0, .14, len, K.mat(0x34495e), R.x, .07, cz, scene, false); block(R.x, cz, 1.1, len + .1); }
    ROWS.forEach(shelfRow);
    // aisle stock: fill both faces of every row with products from the department of that face
    const faceStock = [[['beras', 'mee', 'air'], ['beras', 'mee', 'sardin']], [['sardin', 'air', 'mee'], ['beras', 'mee', 'air']], [['mandi', 'sabun', 'pencuci'], ['sabun', 'mandi', 'pencuci']], [['pencuci', 'mandi', 'sabun'], ['permainan', 'patung', 'permainan']]];
    ROWS.forEach((R, ri) => [-1, 1].forEach((side, si) => { const pool = faceStock[ri][si]; LV.forEach((y, li) => { for (let z = R.z0 + .3; z < R.z1 - .2; z += .34) { const p = P[pool[(li + Math.floor((z - R.z0) / 2.3)) % pool.length]]; const [, h] = GEO[p.shape]; addDeco(p, R.x + side * .32, y + h, z, side > 0 ? Math.PI / 2 : -Math.PI / 2); } }); }));
    // fresh market: produce stands (GLB display-fruit when available) + fish & meat counters on ice
    for (const [z, id] of [[-5.2, 'epal'], [-1.6, 'pisang'], [2.0, 'sayur']]) { const g = K.group(-12.2, 0, z, scene); if (!putModel(M, 'shop/display-fruit', g, 0, 0, { h: 1.2, ry: Math.PI / 2 })) { K.box(1.2, .8, 2.4, woodM, 0, .4, 0, g); } K.box(1.1, .12, 2.3, K.mat(0x7a5a3a), .1, .85, 0, g, false); block(-12.2, z, 1.4, 2.6);
      for (let k = 0; k < 18; k++) addDeco(P[id], -12.4 + (k % 3) * .26, .98 + Math.floor(k / 9) * .1, z - .9 + Math.floor(k / 3) % 6 * .32); }
    for (const [z, id] of [[-8.3, 'ikan'], [-5.9, 'ayam']]) { K.box(1.3, .9, 2.2, K.mat(0xecf0f1, { metalness: .3 }), -14.3, .45, z, scene); K.box(1.1, .06, 2.0, K.mat(0xdff6ff, { roughness: .2 }), -14.3, .93, z, scene, false); K.box(1.3, .5, .05, new T.MeshStandardMaterial({ color: 0xbfe9ff, transparent: true, opacity: .35 }), -13.65, 1.2, z, scene, false); block(-14.3, z, 1.5, 2.3);
      for (let k = 0; k < 8; k++) addDeco(P[id], -14.5 + (k % 2) * .3, .99, z - .8 + Math.floor(k / 2) * .45, .3); }
    // frozen: chest freezers + upright freezers along the north wall
    for (const x of [-4.4, -2.2, .4, 2.6]) { K.box(2.0, .85, 1.1, K.mat(0xffffff), x, .42, -10.2, scene); K.box(1.9, .05, 1.0, new T.MeshStandardMaterial({ color: 0xbfe9ff, transparent: true, opacity: .4, roughness: .05 }), x, .87, -10.2, scene, false); block(x, -10.2, 2.1, 1.2);
      for (let k = 0; k < 10; k++) addDeco(P[x < 0 ? 'aiskrim' : 'nugget'], x - .75 + (k % 5) * .37, .78, -10.45 + Math.floor(k / 5) * .4); }
    for (const x of [-12, -9.6, 7.4, 9.8]) { if (!putModel(M, 'shop/freezers-standing', scene, x, -10.5, { h: 2.1 })) { K.box(2.2, 2.1, .8, K.mat(0xdfe6e9), x, 1.05, -10.5, scene); } block(x, -10.5, 2.3, .9); }
    // fashion: clothing racks, a table and a mannequin; shoes and songkok on the east wall shelf
    for (const [x, z] of [[10.4, -7.2], [10.4, -4.6]]) { if (!putModel(M, 'shop/clothing-rack', scene, x, z, { h: 1.7 })) { K.box(1.6, 1.6, .5, K.mat(0x9b59b6), x, .8, z, scene); } block(x, z, 1.8, .7); }
    putModel(M, 'shop/mannequin', scene, 12.4, -8.8, { h: 1.75 }); block(12.4, -8.8, .7, .7);
    putModel(M, 'shop/clothing-table', scene, 12.2, -2.8, { h: .9 }) || K.box(1.6, .8, 1, woodM, 12.2, .4, -2.8, scene); block(12.2, -2.8, 1.6, 1.1);
    const wallShelf = (z0, z1) => { const cz = (z0 + z1) / 2, len = z1 - z0; K.box(.6, 1.9, len, backM, 14.65, .95, cz, scene); for (const y of [.12, ...LV.map(v => v - .03)]) K.box(.6, .05, len, shelfM, 14.4, y, cz, scene, false); block(14.5, cz, .8, len); };
    wallShelf(-9.6, -2.2); wallShelf(-.6, 4.4);
    for (let z = -9.2; z < -2.6; z += .42) { addDeco(P.kasut, 14.4, .9 + .06, z, -Math.PI / 2); addDeco(P.songkok, 14.4, 1.38 + .06, z, 0); addDeco(P.baju, 14.4, .42 + .04, z, 0); }
    for (let z = -.3; z < 4.2; z += .4) { addDeco(P.patung, 14.4, .9 + .17, z, -Math.PI / 2); addDeco(P.permainan, 14.4, .42 + .17, z, -Math.PI / 2); addDeco(P.patung, 14.4, 1.38 + .17, z, -Math.PI / 2); }
    // toys: gacha machines
    for (const [x, z] of [[9.6, .4], [10.9, .4], [12.2, .4]]) { if (!putModel(M, 'shop/gacha-machine', scene, x, z, { h: 1.5 })) { K.box(.9, 1.5, .8, K.mat(0xe84393), x, .75, z, scene); } block(x, z, 1.0, .9); }
    // checkout counters (3) with registers + cashiers; lane 1 is the player's
    const COUNTERS = [3.2, 6.6, 10.0], cashiers = [];
    for (const x of COUNTERS) { K.box(.9, .95, 2.8, K.mat(0x34495e), x, .47, 6.4, scene); K.box(.95, .05, 2.85, K.mat(0x95a5a6, { metalness: .5 }), x, .97, 6.4, scene, false); const belt = K.box(.6, .02, 1.6, K.mat(0x222222), x, 1.0, 5.7, scene, false);
      putModel(M, 'shop/cash-register', scene, x, 7.1, { h: .45, ry: -Math.PI / 2, y: .97 }) || K.box(.4, .3, .4, K.mat(0x2d3436), x, 1.15, 7.1, scene); block(x, 6.4, 1.0, 2.9);
      const sgn = textPlane(K, `KAUNTER ${COUNTERS.indexOf(x) + 1}`, 1.4, .35, { bg: '#27ae60', px: 90 }); sgn.position.set(x, 2.4, 6.4); scene.add(sgn); K.cyl(.03, .03, 1.4, K.mat(0x777777), x, 1.7, 6.4, scene, 6);
      const e = putAnimated(M, 'shop/character-employee', scene, x + .85, 6.9, { h: 1.6, anim: 'idle', ry: -Math.PI / 2 }); if (e) cashiers.push(e); else K.box(.4, 1.5, .3, K.mat(0x27ae60), x + .85, .75, 6.9, scene); block(x + .85, 6.9, .6, .6); }
    const LANE = { x: COUNTERS[0] - .95, z: 6.0 }; // the player's trolley parks here
    const laneMark = K.box(1.1, .012, 3.0, new T.MeshBasicMaterial({ color: 0x2ecc71, transparent: true, opacity: .35 }), LANE.x, .012, 6.3, scene, false); laneMark.visible = false;
    // trolley bay near the entrance
    K.box(3.6, .02, 2, K.mat(0x2e86de, { roughness: .6 }), -10, .011, 8.9, scene, false); { const s = textPlane(K, '🛒 TROLI · TROLLEYS', 2.6, .4, { bg: '#2e86de', px: 90 }); s.position.set(-10, 2.3, 10.4); s.rotation.y = Math.PI; scene.add(s); }
    // department signs hanging from the ceiling
    const sign = (d, x, z, ry = 0) => { const D = DEPTS[d]; const s = textPlane(K, `${D.ic} ${D.bm.toUpperCase()}`, 3.4, .55, { bg: D.col, px: 100 }); s.position.set(x, 3.6, z); s.rotation.y = ry; scene.add(s); const s2 = s.clone(); s2.rotation.y = ry + Math.PI; s2.position.z += ry ? 0 : -.02; scene.add(s2); for (const dx of [-1.2, 1.2]) K.cyl(.012, .012, .7, K.mat(0x777777), x + (ry ? 0 : dx), 4.25, z + (ry ? dx : 0), scene, 4); };
    sign('fresh', -12.5, -2, Math.PI / 2); sign('grocery', -4.4, 1.8); sign('grocery', -.8, 1.8); sign('house', 2.8, 1.8); sign('frozen', 0, -8.9); sign('fashion', 11.5, -5.5, Math.PI / 2); sign('toys', 11.5, 2.2, Math.PI / 2);
    // aisle number boards at the aisle ends
    [[-4.4, 'LORONG 1 · Runcit'], [-.8, 'LORONG 2 · Runcit'], [2.8, 'LORONG 3 · Rumah']].forEach(([x, t]) => { const b = textPlane(K, t, 1.9, .3, { bg: '#2d3436', px: 80 }); b.position.set(x, 2.35, 1.25); b.rotation.y = 0; scene.add(b); });
    // decor: plants by the doors, promo stands
    for (const x of [-7, -1, 8, 14]) { K.cyl(.3, .25, .5, K.mat(0x8d6e63), x, .25, 10.3, scene, 10); K.ball(.45, K.mat(0x27ae60), x, .85, 10.3, scene); block(x, 10.3, .7, .7); }
    { const s = textPlane(K, 'PROMOSI RAYA · 20% OFF', 2.4, .5, { bg: '#e74c3c', px: 90 }); s.position.set(-.5, 1.6, 4.0); scene.add(s); K.box(2.4, .9, .5, K.mat(0xf1c40f), -.5, .45, 4.0, scene); block(-.5, 4.0, 2.5, .6); for (let k = 0; k < 10; k++) addDeco(P.air, -1.5 + k * .22, .9 + .15, 4.0); }
    // instanced decorative stock
    const dm = new T.Object3D(); for (const [id, list] of Object.entries(deco)) { const u = unit(P[id]); const im = T.InstancedMesh ? new T.InstancedMesh(u.geometry, u.material, list.length) : null; if (!im) continue; list.forEach(([x, y, z, ry], i) => { dm.position.set(x, y, z); dm.rotation.set(0, ry + (r() - .5) * .2, 0); dm.updateMatrix(); im.setMatrixAt(i, dm.matrix); }); im.castShadow = true; scene.add(im); }
    // ================================================= MISSION STOCK (individual, pickable units at each product's spot)
    const stock = {}; // id → [{mesh, taken}]
    for (const p of PRODUCTS) { const s = p.spot, [, h] = GEO[p.shape], arr = (stock[p.id] = []);
      for (let k = 0; k < 4; k++) { const m = unit(p); const off = (k - 1.5) * .26; const x = s.face ? s.x + s.face * -.18 : s.x + off, z = s.face ? s.z + off : s.z + (s.chest ? -.1 : .2);
        m.position.set(s.gacha ? s.x - .2 + k * .12 : x, (s.gacha ? 1.0 : s.y) + h, s.gacha ? s.z + .55 : z); m.rotation.y = s.face ? s.face * Math.PI / 2 : 0; scene.add(m); arr.push({ m, taken: false }); } }
    const ringM = new T.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: .8, depthWrite: false });
    const ring = K.mesh(new T.TorusGeometry(.55, .04, 6, 32), ringM, 0, 0, 0, scene, false); ring.rotation.x = Math.PI / 2; ring.visible = false;
    const beacon = K.mesh(new T.ConeGeometry(.12, .3, 8), new T.MeshBasicMaterial({ color: 0xffd452 }), 0, 0, 0, scene, false); beacon.rotation.x = Math.PI; beacon.visible = false;
    // ================================================= TROLLEY (procedural, with rolling wheels and swivelling front casters)
    function makeTrolley(col = 0x95a5a6, simple = false) {
      const g = new T.Group(), body = new T.Group(); g.add(body); const wire = K.mat(col, { metalness: .7, roughness: .3 }), red = K.mat(0xc0392b);
      if (simple) { // background trolleys: a handful of meshes instead of ~45 (draw-call budget)
        K.box(.56, .42, .82, K.mat(col, { metalness: .6, roughness: .35, transparent: true, opacity: .55 }), 0, .76, 0, body, false); K.box(.66, .05, .05, red, 0, 1.0, .53, body); K.box(.44, .04, .82, wire, 0, .16, 0, body, false);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.box(.04, .12, .12, K.mat(0x222222), sx * .2, .07, sz * .34, body, false); return { g, body, wheels: [], cargo: new T.Group(), n: 0 }; }
      // basket (open box of thin bars), handle, frame; local −z is the front
      const bw = .56, bl = .82, bh = .42, by = .55;
      K.box(bw, .02, bl, wire, 0, by, 0, body, false);
      for (const sx of [-1, 1]) { K.box(.02, bh, bl, wire, sx * bw / 2, by + bh / 2, 0, body, false); for (let k = 1; k < 5; k++) K.box(.012, .012, bl, wire, sx * bw / 2, by + k * bh / 5, 0, body, false); }
      for (const sz of [-1, 1]) { K.box(bw, bh, .02, wire, 0, by + bh / 2, sz * bl / 2, body, false); for (let k = 1; k < 4; k++) K.box(bw, .012, .012, wire, 0, by + k * bh / 4, sz * bl / 2, body, false); }
      K.box(bw + .1, .05, .05, red, 0, 1.0, bl / 2 + .12, body); for (const sx of [-1, 1]) { const h = K.box(.03, .5, .03, wire, sx * (bw / 2 + .02), .8, bl / 2 + .06, body, false); h.rotation.x = -.35; }
      K.box(.04, .04, bl, wire, -.2, .16, 0, body, false); K.box(.04, .04, bl, wire, .2, .16, 0, body, false); K.box(bw * .9, .02, bl * .7, wire, 0, .22, .05, body, false);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const leg = K.box(.025, .42, .025, wire, sx * .2, .34, sz * .32, body, false); }
      const wheels = []; for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const piv = new T.Group(); piv.position.set(sx * .2, .07, sz * .34); body.add(piv); const w = K.mesh(new T.CylinderGeometry(.065, .065, .04, 12), K.mat(0x222222), 0, 0, 0, piv); w.rotation.z = Math.PI / 2; const hub = K.box(.045, .02, .02, K.mat(0xdddddd), 0, 0, 0, w, false); wheels.push({ piv, w, front: sz < 0 }); }
      const cargo = new T.Group(); cargo.position.y = by + .02; body.add(cargo);
      return { g, body, wheels, cargo, n: 0 };
    }
    const trolley = makeTrolley(); trolley.g.position.set(-9.4, 0, 8.4); trolley.g.rotation.y = 0; scene.add(trolley.g);
    const TR = { x: -9.4, z: 8.4, yaw: 0, held: false, v: 0, steer: 0, roll: 0 }; // yaw 0 → front faces −z
    for (let k = 0; k < 4; k++) { const t2 = makeTrolley(0x95a5a6, true); t2.g.position.set(-11.6 + k * .28, 0, 9.6); t2.g.rotation.y = Math.PI; scene.add(t2.g); } block(-11.2, 9.6, 1.4, 1.1);
    // ================================================= PLAYER
    const heroW = makeHero(K, M, 1.6, 1.05), hero = heroW ? heroW.g : (() => { const g = new T.Group(); K.cyl(.2, .22, 1.1, K.mat(0x2e86de), 0, .85, 0, g); K.ball(.18, K.mat(0xc68a5a), 0, 1.55, 0, g); return g; })(); scene.add(hero);
    const PL = { x: -7.6, z: 9.4, yaw: 0, v: 0 }; // yaw: direction faced (0 → −z)
    // ================================================= NPC SHOPPERS (waypoints, browse, queue at counters 2 and 3)
    const WP = [[-8.2, 3.2], [-8.2, -9.2], [-4.4, -9.2], [-4.4, -3.5], [-4.4, 3.2], [-.8, 3.2], [-.8, -3.5], [-.8, -9.2], [2.8, -9.2], [2.8, -3.5], [2.8, 3.2], [6.6, 3.2], [6.6, -3.0], [7.2, -9.0], [11.6, -1.5], [11.6, -6.0], [-10.4, -3.5], [-10.4, 3.4], [-2, 8.6], [5.6, 8.8]];
    const near = (a, b) => Math.hypot(WP[a][0] - WP[b][0], WP[a][1] - WP[b][1]);
    const LINKS = WP.map((w, i) => WP.map((v, j) => j).filter(j => j !== i && near(i, j) < 7.2 && clearLine(WP[i], WP[j])));
    function clearLine(a, b) { for (let k = 1; k < 10; k++) { const x = a[0] + (b[0] - a[0]) * k / 10, z = a[1] + (b[1] - a[1]) * k / 10; if (rects.some(R => x > R.x0 - .3 && x < R.x1 + .3 && z > R.z0 - .3 && z < R.z1 + .3)) return false; } return true; }
    const npcs = [], CH = ['chars/male-a', 'chars/female-a', 'chars/male-c', 'chars/female-c', 'chars/male-e', 'chars/female-e'];
    const lowEnd = (navigator.hardwareConcurrency || 4) <= 4 || /Android [4-8]/.test(navigator.userAgent), NPC_N = lowEnd ? 4 : 7;
    for (let k = 0; k < NPC_N; k++) { const a = putAnimated(M, CH[k % CH.length], scene, 0, 0, { h: 1.6, anim: 'walk' }); const o = a ? a.obj : (() => { const g = new T.Group(); K.cyl(.2, .2, 1.4, K.mat([0xe17055, 0x0984e3, 0x00b894][k % 3]), 0, .7, 0, g); scene.add(g); return g; })();
      const w = Math.floor(r() * WP.length), n = { a, o, x: WP[w][0], z: WP[w][1], to: w, from: w, wait: r() * 3, mode: 'walk', yaw: 0, basket: null, cart: null };
      if (k % 3 === 0) { n.cart = makeTrolley(0xb2bec3, true); scene.add(n.cart.g); } else if (k % 3 === 1) { n.basket = K.box(.35, .2, .25, K.mat(0xe74c3c), 0, 0, 0, scene, false); }
      npcs.push(n); }
    const QUEUE = [[COUNTERS[1] - .95, 4.0], [COUNTERS[1] - .95, 2.9], [COUNTERS[2] - .95, 4.0], [COUNTERS[2] - .95, 2.9]], qUsed = [null, null, null, null];
    function npcUpdate(n, dt) {
      if (n.wait > 0) { n.wait -= dt; n.a && n.a.play('idle'); if (n.wait <= 0 && n.mode === 'queue') { qUsed[n.q] = null; n.mode = 'walk'; n.to = 18 + (n.q < 2 ? 0 : 1); } return; }
      const tx = n.mode === 'queue' ? QUEUE[n.q][0] : WP[n.to][0], tz = n.mode === 'queue' ? QUEUE[n.q][1] : WP[n.to][1], dx = tx - n.x, dz = tz - n.z, d = Math.hypot(dx, dz);
      const pd = Math.hypot(PL.x - n.x, PL.z - n.z) < 1.3 || Math.hypot(TR.x - n.x, TR.z - n.z) < 1.3; // give way to the player
      if (pd) { n.a && n.a.play('idle'); n.yaw = Math.atan2(PL.x - n.x, PL.z - n.z); return; }
      n.a && n.a.play('walk');
      if (d < .15) { if (n.mode === 'queue') { n.wait = 4 + r() * 5; return; }
        n.from = n.to; const opts2 = LINKS[n.to]; if (r() < .12) { const q = qUsed.findIndex(v => !v); if (q >= 0) { qUsed[q] = n; n.q = q; n.mode = 'queue'; return; } }
        n.to = opts2.length ? opts2[Math.floor(r() * opts2.length)] : Math.floor(r() * WP.length); if (r() < .45) { n.wait = 1.5 + r() * 3; n.lookShelf = true; } return; }
      const sp = 1.05 * dt; n.x += dx / d * Math.min(sp, d); n.z += dz / d * Math.min(sp, d); n.yaw = Math.atan2(dx, dz);
    }
    // ================================================= MISSION STATE
    const diffKey = opts.diff || (S.mallDiff in MALL_CFG ? S.mallDiff : 'biasa');
    const G = { st: 'choose', cfg: MALL_CFG[diffKey], diff: diffKey, list: [], got: {}, t: 0, left: 0, items: [], scanI: 0, paid: false, nav: true, near: null, listOpen: false };
    function setupList() { const pool = PRODUCTS.slice().sort(() => r() - .5); G.list = []; const depts = new Set();
      for (const p of pool) { if (G.list.length >= G.cfg.items) break; if (depts.has(p.dept) && depts.size < 6 && G.list.length < 6) continue; depts.add(p.dept); G.list.push({ id: p.id, qty: G.cfg.items >= 8 && r() < .25 ? 2 : 1 }); }
      while (G.list.length < G.cfg.items) { const p = pool.find(q => !G.list.some(l => l.id === q.id)); G.list.push({ id: p.id, qty: 1 }); }
      G.left = G.cfg.time; G.got = Object.fromEntries(G.list.map(l => [l.id, 0])); }
    const need = () => G.list.filter(l => G.got[l.id] < l.qty);
    const allGot = () => need().length === 0;
    // ================================================= HUD (compact)
    const root = document.createElement('div'); root.className = 'f3 ml'; root.innerHTML = `
      <button class="f3Pause" aria-label="Menu">❚❚</button>
      <div class="mlPanel"><div class="row1"><b>🛒 Misi Beli-Belah</b><span class="tm"></span></div><div class="row2"><span class="pg"></span><span class="ct"></span><button class="lb">📋 Senarai</button><button class="nv on" title="Navigasi">🧭</button></div><ul class="ls"></ul></div>
      <div class="mlNear"></div>
      <div class="f3Stick"><div class="f3Base"><div class="f3Knob"></div></div></div>
      <div class="mlBtns"><button class="mlRel" hidden><i>✋</i><small>Lepas troli</small></button><button class="mlAct" hidden><i></i><b></b></button></div>
      <div class="mlReceipt" hidden></div>
      <div class="f3Msg"></div><div class="f3Over" hidden></div>`;
    $('game').append(root); $('game').classList.add('f3mode');
    const q = (s) => root.querySelector(s), over = q('.f3Over'), act = q('.mlAct'), rel = q('.mlRel'), panel = q('.mlPanel');
    let msgT = 0; const msg = (m, d = 1.6) => { const e = q('.f3Msg'); e.textContent = m; e.classList.add('show'); msgT = d; };
    q('.lb').onclick = () => { sfx.tap(); G.listOpen = !G.listOpen; panel.classList.toggle('open', G.listOpen); };
    q('.nv').onclick = () => { sfx.tap(); G.nav = !G.nav; q('.nv').classList.toggle('on', G.nav); };
    function drawList() {
      const done = G.list.filter(l => G.got[l.id] >= l.qty).length; q('.pg').textContent = `✔ ${done}/${G.list.length}`; q('.ct').textContent = `🧺 ${trolley.n}`;
      q('.ls').innerHTML = G.list.map(l => { const p = P[l.id], ok = G.got[l.id] >= l.qty; return `<li class="${ok ? 'ok' : ''}"><i>${ok ? '✔' : p.ic}</i><span>${p.bm}${l.qty > 1 ? ` ×${l.qty}` : ''}<small>${DEPTS[p.dept].ic} ${DEPTS[p.dept].bm}</small></span><em>${fmtRM(p.price * l.qty)}</em></li>`; }).join('') + (allGot() ? '<li class="go"><i>💳</i><span>Pergi ke kaunter 1<small>Go to checkout 1</small></span></li>' : '');
    }
    // joystick
    const stick = q('.f3Stick'), base = q('.f3Base'), knob = q('.f3Knob'); let sid = null, sx0 = 0, sy0 = 0; const RAD = 38, joy = { x: 0, y: 0 };
    const sMove = (e) => { const dx = e.clientX - sx0, dy = e.clientY - sy0, d = Math.hypot(dx, dy), k = d > RAD ? RAD / d : 1; knob.style.transform = `translate(${dx * k}px,${dy * k}px)`; let m = Math.min(1, d / RAD); m = m < .12 ? 0 : (m - .12) / .88; joy.x = d ? dx / d * m : 0; joy.y = d ? dy / d * m : 0; };
    stick.addEventListener('pointerdown', (e) => { e.preventDefault(); if (sid !== null) return; sid = e.pointerId; stick.setPointerCapture(sid); const rc = stick.getBoundingClientRect(); sx0 = clamp(e.clientX, rc.left + RAD + 6, rc.right - RAD - 6); sy0 = clamp(e.clientY, rc.top + RAD + 6, rc.bottom - RAD - 6); base.style.left = `${sx0 - rc.left}px`; base.style.top = `${sy0 - rc.top}px`; base.classList.add('on'); sMove(e); });
    stick.addEventListener('pointermove', (e) => { if (e.pointerId === sid) sMove(e); });
    const sUp = (e) => { if (e.pointerId !== sid) return; sid = null; joy.x = joy.y = 0; knob.style.transform = ''; base.classList.remove('on'); base.style.left = base.style.top = ''; };
    stick.addEventListener('pointerup', sUp); stick.addEventListener('pointercancel', sUp);
    const keys = new Set(); const onKey = (e) => { if (!root.isConnected) return; const c = e.code; if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(c)) { e.preventDefault(); e.type === 'keydown' ? keys.add(c) : keys.delete(c); return; }
      if (e.type !== 'keydown' || e.repeat) return; if (c === 'Space' || c === 'KeyE' || c === 'Enter') { e.preventDefault(); act.hidden || act.click(); } else if (c === 'KeyQ') rel.hidden || rel.click(); else if (c === 'KeyL') q('.lb').click(); else if (c === 'KeyP' || c === 'Escape') togglePause(); };
    addEventListener('keydown', onKey); addEventListener('keyup', onKey);
    // pause / exit
    let paused = false; q('.f3Pause').onclick = () => { sfx.tap(); togglePause(); };
    function togglePause() { if (G.st === 'choose' || G.st === 'end') return; paused = !paused; over.hidden = !paused; if (!paused) return;
      over.innerHTML = `<div class="f3Card"><h2>DAMAI CITY MALL</h2><p class="muted">Misi ${G.cfg.bm} · ${need().length} barang lagi</p><div class="f3Row"><button class="f3B primary" data-o="r">▶ Teruskan</button><button class="f3B" data-o="x">🚪 Keluar</button></div></div>`;
      over.querySelector('[data-o="r"]').onclick = () => togglePause(); over.querySelector('[data-o="x"]').onclick = () => { paused = false; $('gClose').click(); }; }
    // difficulty chooser
    function chooser() { over.hidden = false; over.innerHTML = `<div class="f3Card mlChoose"><div class="kick">DAMAI CITY MALL · PASARAYA</div><h2>🛒 Misi Beli-Belah</h2><p class="muted">Ambil troli, cari barang dalam senarai, bayar di kaunter. · Take a trolley, find the items, pay at the checkout.</p>
      <div class="f3Row">${Object.entries(MALL_CFG).map(([k, c]) => `<button class="f3B ${k === diffKey ? 'primary' : ''}" data-d="${k}"><b>${c.bm}</b><br><small>${c.items} barang · ${Math.round(c.time / 60)} min</small></button>`).join('')}</div></div>`;
      over.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { sfx.good(); G.diff = b.dataset.d; G.cfg = MALL_CFG[G.diff]; S.mallDiff = G.diff; save(); over.hidden = true; start(); }); }
    function start() { setupList(); G.st = 'shop'; drawList(); msg('Ambil troli di pintu masuk · Grab a trolley by the entrance', 2.6); api.progress(0); }
    // ---------------- interactions
    function nearestTarget() { let best = null, bd = 1.9; for (const l of need()) { const p = P[l.id], st = stock[l.id].find(s => !s.taken); if (!st) continue; const s = p.spot, ax = s.x + (s.face || 0) * .9, az = s.z + (s.face ? 0 : s.chest ? .9 : s.gacha ? 1.1 : .8); const d = Math.hypot(PL.x - ax, PL.z - az); if (d < bd) { bd = d; best = { p, st, ax, az }; } } return best; }
    function nearTrolley() { return !TR.held && Math.hypot(PL.x - (TR.x - Math.sin(TR.yaw) * .85), PL.z - (TR.z + Math.cos(TR.yaw) * .85)) < 1.5; }
    function grabTrolley() { const bx = TR.x - Math.sin(TR.yaw) * .85, bz = TR.z + Math.cos(TR.yaw) * .85; if (hitsAny(bx, bz, .3)) { sfx.bad(); msg('Tak boleh pegang dari sini · No room behind the trolley', 1.4); return; } PL.x = bx; PL.z = bz; PL.yaw = TR.yaw; camYaw = TR.yaw; TR.held = true; sfx.tap(); msg('Tolak troli dengan kayu bedik · Push with the joystick', 1.8); }
    function releaseTrolley() { TR.held = false; TR.v = 0; sfx.tap(); }
    rel.onclick = () => { if (TR.held) releaseTrolley(); };
    act.onclick = () => {
      if (paused || G.st !== 'shop') return; const k = act.dataset.k;
      if (k === 'grab') grabTrolley();
      else if (k === 'pick') pick();
      else if (k === 'pay') checkout();
    };
    let flying = []; const belt = [];
    function pick() {
      const t = G.near; if (!t) return; if (Math.hypot(TR.x - PL.x, TR.z - PL.z) > 4.5) { sfx.bad(); msg('Bawa troli dekat dulu · Bring your trolley closer', 1.6); return; }
      if (t.st.taken) return; t.st.taken = true; G.got[t.p.id]++; sfx.pop(); // remove from the shelf → into the trolley (arc)
      const m = t.st.m, slot = trolley.n++, from = m.position.clone(); flying.push({ m, from, t: 0, slot, p: t.p }); G.items.push(t.p); drawList();
      const l = G.list.find(x => x.id === t.p.id); msg(`${t.p.ic} ${t.p.bm} · ${fmtRM(t.p.price)}${G.got[t.p.id] >= l.qty ? ' ✔' : ` (${G.got[t.p.id]}/${l.qty})`}`, 1.4);
      api.progress(G.list.reduce((a, x) => a + Math.min(G.got[x.id], x.qty), 0) / (G.list.reduce((a, x) => a + x.qty, 0) + 1));
      if (allGot()) { msg('Semua dah ada! Ke KAUNTER 1 · All found! Go to checkout 1', 2.6); laneMark.visible = true; sfx.good(); }
    }
    function slotPos(i) { return new T.Vector3(-.15 + (i % 3) * .15, .06 + Math.floor(i / 9) * .12, -.25 + Math.floor(i / 3) % 3 * .25); }
    // ---------------- checkout: park in lane 1, items scanned one by one, itemised receipt, payment
    function inLane() { return Math.abs(TR.x - LANE.x) < .9 && TR.z > 4.6 && TR.z < 8.2; }
    function checkout() { if (!allGot()) return; G.st = 'scan'; releaseTrolley(); TR.x = LANE.x; TR.z = 5.6; TR.yaw = Math.PI; PL.x = LANE.x; PL.z = 4.5; PL.yaw = Math.PI; G.scanI = 0; G.scanT = .6; laneMark.visible = false; const rc = q('.mlReceipt'); rc.hidden = false; drawReceipt(); }
    function drawReceipt() { const rc = q('.mlReceipt'), items = G.items.slice(0, G.scanI), tot = items.reduce((a, p) => a + p.price, 0);
      rc.innerHTML = `<div class="hd">🧾 DAMAI CITY MALL<small>Kaunter 1 · ${new Date().toLocaleDateString('ms-MY')}</small></div><ul>${items.map(p => `<li><span>${p.ic} ${p.bm}</span><b>${fmtRM(p.price)}</b></li>`).join('')}</ul>
        <div class="tot"><span>JUMLAH</span><b>${fmtRM(tot)}</b></div>${G.scanI >= G.items.length && G.st === 'scan' ? `<p class="muted">Dibayar dengan bajet jawatankuasa · Paid with the committee budget</p><button class="f3B primary" data-pay="1">💳 Bayar ${fmtRM(tot)}</button>` : `<p class="muted">Mengimbas… ${G.scanI}/${G.items.length}</p>`}`;
      const pb = rc.querySelector('[data-pay]'); if (pb) pb.onclick = () => { sfx.coin(); G.st = 'end'; G.total = tot; finishMission(); }; }
    function finishMission(timeout) {
      const used = G.cfg.time - G.left, frac = G.left / G.cfg.time, stars = timeout ? 0 : frac > .5 ? 3 : frac > .2 ? 2 : 1;
      over.hidden = false; over.innerHTML = `<div class="f3Card"><div class="kick">MISI BELI-BELAH · ${G.cfg.bm.toUpperCase()}</div><h2>${timeout ? '⏰ Masa tamat!' : '🛍️ Siap membeli-belah!'}</h2>
        <div class="bigstars">${[0, 1, 2].map(k => `<span class="${k < stars ? 'on' : ''}">★</span>`).join('')}</div><p class="muted">${timeout ? 'Cuba lagi — barang belum lengkap. · Time ran out.' : `Masa ${Math.floor(used / 60)}:${String(Math.floor(used % 60)).padStart(2, '0')} · ${G.items.length} barang · ${fmtRM(G.total)}`}</p>
        <div class="f3Row">${timeout ? '<button class="f3B primary" data-e="retry">🔁 Cuba lagi</button><button class="f3B" data-e="quit">🚪 Keluar</button>' : '<button class="f3B primary" data-e="ok">Teruskan ▶</button>'}</div></div>`;
      const b = (k) => over.querySelector(`[data-e="${k}"]`);
      if (b('ok')) b('ok').onclick = () => api.finish({ stars, total: G.total, items: G.items.length, diff: G.diff });
      if (b('retry')) b('retry').onclick = () => { over.hidden = true; resetRun(); start(); };
      if (b('quit')) b('quit').onclick = () => $('gClose').click();
    }
    function resetRun() { for (const arr of Object.values(stock)) for (const s of arr) { s.taken = false; scene.add(s.m); } for (const f of flying) f.m.parent && f.m.parent.remove(f.m); flying = []; trolley.cargo.clear && trolley.cargo.clear(); trolley.n = 0; G.items = []; q('.mlReceipt').hidden = true;
      for (const p of PRODUCTS) stock[p.id].forEach((s, k) => { const sp = p.spot, [, h] = GEO[p.shape], off = (k - 1.5) * .26; s.m.position.set(sp.gacha ? sp.x - .2 + k * .12 : sp.face ? sp.x + sp.face * -.18 : sp.x + off, (sp.gacha ? 1.0 : sp.y) + h, sp.gacha ? sp.z + .55 : sp.face ? sp.z + off : sp.z + (sp.chest ? -.1 : .2)); s.m.rotation.set(0, sp.face ? sp.face * Math.PI / 2 : 0, 0); });
      TR.x = -9.4; TR.z = 8.4; TR.yaw = 0; TR.held = false; PL.x = -7.6; PL.z = 9.4; PL.yaw = 0; camYaw = 0; belt.forEach(b => scene.remove(b)); belt.length = 0; }
    // ================================================= MOVEMENT + COLLISION
    const hitsAny = (x, z, rad) => { if (x < -14.7 + rad || x > 14.7 - rad || z < -10.8 + rad) return true; if (z > 10.7 - rad && !((x > -6 && x < -2) || (x > 9 && x < 13))) return true; if (z > 12.5) return true; return rects.some(R => x > R.x0 - rad && x < R.x1 + rad && z > R.z0 - rad && z < R.z1 + rad); };
    const trolleyPts = (x, z, yaw) => { const fx = Math.sin(yaw), fz = -Math.cos(yaw); return [[x + fx * .25, z + fz * .25], [x - fx * .2, z - fz * .2]]; }; // two circles along the trolley
    function tryMove(nx, nz, nyaw) { // player + trolley as one body when holding
      if (TR.held) { const tx = nx + Math.sin(nyaw) * .85, tz = nz - Math.cos(nyaw) * .85; // trolley centre 0.85 m ahead of the player
        const ok = !hitsAny(nx, nz, .3) && trolleyPts(tx, tz, nyaw).every(([a, b]) => !hitsAny(a, b, .33)); if (ok) { PL.x = nx; PL.z = nz; PL.yaw = nyaw; TR.x = tx; TR.z = tz; TR.yaw = nyaw; } return ok; }
      if (!hitsAny(nx, nz, .3) && Math.hypot(nx - TR.x, nz - TR.z) > .6) { PL.x = nx; PL.z = nz; return true; } return false;
    }
    function movement(dt) {
      const kx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0), ky = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
      const ix = kx || joy.x, iy = ky || joy.y;
      if (TR.held) { // trolley: stick up/down = push/pull, left/right = steer; slower while turning
        const thr = -iy, steer = ix; TR.steer += (steer - TR.steer) * Math.min(1, dt * 6);
        const want = thr * 2.3 * (1 - Math.abs(TR.steer) * .35); TR.v += (want - TR.v) * Math.min(1, dt * (thr ? 3 : 5));
        const nyaw = PL.yaw + TR.steer * dt * (.9 + Math.abs(TR.v) * .35) * (TR.v >= -.05 ? 1 : -1) * (Math.abs(TR.v) > .05 || Math.abs(thr) > .1 ? 1 : .6);
        const nx = PL.x + Math.sin(nyaw) * TR.v * dt, nz = PL.z - Math.cos(nyaw) * TR.v * dt;
        if (!tryMove(nx, nz, nyaw)) { if (!tryMove(PL.x, PL.z, nyaw) && Math.abs(TR.v) > .8) sfx.tap(); TR.v *= .3; }
        PL.v = Math.abs(TR.v); TR.roll += TR.v * dt / .065;
      } else { const m = Math.min(1, Math.hypot(ix, iy)); if (m > .05) { // free walk relative to the camera
          const cy = camYaw, wx = ix * Math.cos(cy) + (-iy) * Math.sin(cy), wz = ix * Math.sin(cy) - (-iy) * Math.cos(cy); const yaw = Math.atan2(wx, -wz); PL.yaw = lerpAng(PL.yaw, yaw, Math.min(1, dt * 10));
          const sp = 3.0 * m * dt, nx = PL.x + Math.sin(yaw) * sp, nz = PL.z - Math.cos(yaw) * sp; if (!tryMove(nx, nz, PL.yaw)) { tryMove(nx, PL.z, PL.yaw) || tryMove(PL.x, nz, PL.yaw); } PL.v = 3 * m; } else PL.v = 0; }
    }
    const lerpAng = (a, b, k) => { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * k; };
    // ================================================= CAMERA (third person, never outside the walls)
    const view = { pos: new T.Vector3(-8, 3, 13), look: new T.Vector3(-8, 1, 8), halfW: 4, halfH: 2.5, snap: true };
    const cp = view.pos.clone(), cl = view.look.clone(); let camYaw = 0;
    function cam(dt) {
      if (G.st === 'scan' || G.st === 'end') { const tp = new T.Vector3(LANE.x - 2.4, 2.6, 4.2), tl = new T.Vector3(COUNTERS[0], 1.0, 6.4); cp.lerp(tp, 1 - Math.exp(-dt * 3)); cl.lerp(tl, 1 - Math.exp(-dt * 3)); }
      else { if (PL.v > .3 || TR.held) camYaw = lerpAng(camYaw, PL.yaw, Math.min(1, dt * (TR.held ? 3 : 1.4)));
        const dist = TR.held ? 4.6 : 4.0, h = TR.held ? 2.9 : 2.6; let bx = PL.x - Math.sin(camYaw) * dist, bz = PL.z + Math.cos(camYaw) * dist;
        // camera collision: pull in until the camera is inside the store and not inside a fixture
        for (let k = 0; k < 8 && (bx < -14.6 || bx > 14.6 || bz < -10.7 || (bz > 10.6 && PL.z < 10.4) || rects.some(R => bx > R.x0 && bx < R.x1 && bz > R.z0 && bz < R.z1 && R.x1 - R.x0 < 3)); k++) { bx = PL.x + (bx - PL.x) * .8; bz = PL.z + (bz - PL.z) * .8; }
        const tp = new T.Vector3(bx, h, bz), tl = new T.Vector3(PL.x + Math.sin(camYaw) * 2.2, 1.0, PL.z - Math.cos(camYaw) * 2.2); cp.lerp(tp, 1 - Math.exp(-dt * 5)); cl.lerp(tl, 1 - Math.exp(-dt * 6)); }
      view.pos.copy(cp); view.look.copy(cl); const d = cp.distanceTo(cl); view.halfH = d * Math.tan(56 * Math.PI / 360); view.halfW = view.halfH * 1.5;
      if (sun.target) { sun.position.set(PL.x + 6, 20, PL.z + 8); sun.target.position.set(PL.x, 0, PL.z); }
    }
    // ================================================= LOOP
    let t = 0, frameAvg = 1 / 60, quality = 1;
    chooser();
    return {
      scene, view, ray() { return { ok: false }; }, down() {}, move() {}, up() {},
      timerText: () => G.st === 'shop' ? `⏱ ${Math.floor(G.left / 60)}:${String(Math.floor(G.left % 60)).padStart(2, '0')}` : '🛒',
      dbg: () => ({ st: G.st, diff: G.diff, list: G.list.map(l => `${l.id}:${G.got[l.id]}/${l.qty}`), pl: { x: +PL.x.toFixed(2), z: +PL.z.toFixed(2), yaw: +PL.yaw.toFixed(2) }, tr: { x: +TR.x.toFixed(2), z: +TR.z.toFixed(2), held: TR.held, n: trolley.n }, near: G.near && G.near.p.id, left: Math.round(G.left), act: act.hidden ? '' : act.dataset.k, npcs: npcs.length }),
      sim: { G, PL, TR, P, stock, joy, grabTrolley, releaseTrolley, pick, checkout, tryMove, inLane, act, LANE },
      update(dt, p, camera) {
        if (camera && camera.far < 120) { camera.far = 120; camera.near = .08; }
        const tut = document.getElementById('gTut'); if (paused || (tut && !tut.hidden)) return;
        t += dt; frameAvg += (dt - frameAvg) * .05; if (frameAvg > 1 / 26 && quality > .5) { quality = .5; sun.castShadow = false; for (let k = NPC_N - 1; k >= 3; k--) { npcs[k].o.visible = false; if (npcs[k].cart) npcs[k].cart.g.visible = false; } } // adaptive quality
        if (G.st === 'shop') { G.left -= dt; if (G.left <= 0) { G.left = 0; G.st = 'end'; finishMission(true); } movement(dt); }
        // trolley pose: wheels roll, front casters swivel toward the steering
        trolley.g.position.set(TR.x, 0, TR.z); trolley.g.rotation.y = -TR.yaw; for (const w of trolley.wheels) { w.w.rotation.x = TR.roll; w.piv.rotation.y = w.front ? -TR.steer * .6 : 0; }
        // hero: behind the handle when pushing (arms forward), otherwise walking
        hero.position.set(PL.x, Math.abs(Math.sin(t * 9)) * (PL.v > .2 ? .04 : 0), PL.z); hero.rotation.y = -PL.yaw + Math.PI;
        // items flying into the trolley
        for (let i = flying.length - 1; i >= 0; i--) { const f = flying[i]; f.t = Math.min(1, f.t + dt * 1.8); const to = slotPos(f.slot).applyMatrix4(trolley.cargo.matrixWorld); f.m.position.lerpVectors(f.from, to, f.t); f.m.position.y += Math.sin(f.t * Math.PI) * .6; f.m.rotation.y += dt * 6;
          if (f.t >= 1) { trolley.cargo.add(f.m); f.m.position.copy(slotPos(f.slot)); f.m.rotation.set(0, (f.slot % 2) * .6, 0); flying.splice(i, 1); } }
        trolley.g.updateMatrixWorld(true);
        // context action button + target highlight
        G.near = null; let k = '', label = '', ic = '';
        if (G.st === 'shop') { if (!TR.held && nearTrolley()) { k = 'grab'; label = 'Ambil Troli'; ic = '🛒'; }
          const n = nearestTarget(); if (n) { G.near = n; k = 'pick'; label = 'Ambil Barang'; ic = n.p.ic; }
          if (allGot() && inLane()) { k = 'pay'; label = 'Bayar di Kaunter'; ic = '💳'; } }
        act.hidden = !k; act.dataset.k = k; if (k) { act.querySelector('i').textContent = ic; act.querySelector('b').textContent = label; }
        rel.hidden = !TR.held || G.st !== 'shop';
        const nr = q('.mlNear'); if (G.near) { nr.innerHTML = `<b>${G.near.p.ic} ${G.near.p.bm}</b><span>${fmtRM(G.near.p.price)} · ${DEPTS[G.near.p.dept].bm}</span>`; nr.classList.add('show'); } else nr.classList.remove('show');
        // navigation: ring on the next target's shelf + beacon; arrow points from the player
        let tgt = null; if (G.st === 'shop') { if (allGot()) tgt = { x: LANE.x, z: 6.3, y: 0 }; else { let bd = 1e9; for (const l of need()) { const sp = P[l.id].spot, d = Math.hypot(sp.x - PL.x, sp.z - PL.z); if (d < bd) { bd = d; tgt = sp; } } } }
        ring.visible = beacon.visible = !!(tgt && G.nav); if (tgt && G.nav) { const ax = tgt.x + (tgt.face || 0) * .9, az = tgt.z + (tgt.face ? 0 : tgt.chest ? .9 : tgt.gacha ? 1.1 : (allGot() ? 0 : .8)); ring.position.set(ax, .03, az); ring.scale.setScalar(1 + Math.sin(t * 4) * .08); beacon.position.set(tgt.x, (tgt.y || 0) + 1.1 + Math.sin(t * 3) * .1, tgt.z); beacon.rotation.y += dt * 2; }
        // NPCs
        for (const n of npcs) { if (!n.o.visible) continue; npcUpdate(n, dt); n.o.position.set(n.x, 0, n.z); n.o.rotation.y = n.yaw; n.a && n.a.update(dt);
          if (n.cart) { const cx = n.x + Math.sin(n.yaw) * .8, cz = n.z + Math.cos(n.yaw) * .8; n.cart.g.position.set(cx, 0, cz); n.cart.g.rotation.y = n.yaw + Math.PI; }
          if (n.basket) n.basket.position.set(n.x + Math.cos(n.yaw) * .28, .75, n.z - Math.sin(n.yaw) * .28); }
        for (const c of cashiers) c.update(dt);
        // checkout scanning
        if (G.st === 'scan') { G.scanT -= dt; if (G.scanT <= 0 && G.scanI < G.items.length) { G.scanI++; G.scanT = .55; sfx.bite(); const m = trolley.cargo.children[trolley.cargo.children.length - 1]; if (m) { trolley.cargo.remove(m); m.position.set(COUNTERS[0] - .05, 1.12, 5.0); scene.add(m); belt.push(m); } drawReceipt(); } }
        for (const b of belt) if (b.position.z < 7.4) b.position.z += dt * 1.1; // along the belt, past the scanner
        cam(dt);
        if (msgT > 0 && (msgT -= dt) <= 0) q('.f3Msg').classList.remove('show');
        if (Math.floor(t * 4) !== Math.floor((t - dt) * 4)) drawList();
      },
      stop() { removeEventListener('keydown', onKey); removeEventListener('keyup', onKey); root.remove(); $('game').classList.remove('f3mode'); save(); },
    };
  };
}
