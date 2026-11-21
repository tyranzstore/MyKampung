// MyKampung — 3D isometric town (Three.js).
// Same interface as the 2D town (createTown) so main.js can use either.
// Static scenery is built from simple parts, then "baked" (merged) into a few draw calls so it runs well on phones.
import { clamp, lerp, mulberry32 } from './core.js';
import { loadModels, putModel, putAnimated, loadGLB, isShared } from './models.js';
import { makeOcean, shoreWaves } from './ocean.js';

let T, mergeGeometries, GLTFLoader;
export async function load3DTown() {
  T = await import('three');
  ({ mergeGeometries } = await import('three/addons/utils/BufferGeometryUtils.js'));
  try { ({ GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js')); } catch { GLTFLoader = null; }
  return T;
}

const N = 30, TS = 2; // tiles per side, world units per tile
const W = (i, j) => [(i - N / 2) * TS, (j - N / 2) * TS];
const isTouch = matchMedia('(pointer:coarse)').matches;

// same layout ids as the 2D town (missions refer to these)
const YARDS = { abah: { i0: 7, j0: 11, i1: 12, j1: 14 }, ani: { i0: 9, j0: 23, i1: 13, j1: 26 }, abu: { i0: 21, j0: 27, i1: 26, j1: 30 } };
const PADI = { i0: 2, j0: 20, i1: 9, j1: 29 };
const AREAS = { yard_abah: YARDS.abah, yard_ani: YARDS.ani, yard_abu: YARDS.abu, padi: PADI, jeti: { i0: 9, j0: 0, i1: 12.5, j1: 5 }, pantai: { i0: 30.5, j0: 2.5, i1: 41.5, j1: 9.3 } };
// east of the kampung: Pantai Miami (Seberang Takir) and the river mouth with the Jambatan Angkat
const RIVER = { x0: 55, x1: 61 }, BR = { z: -8.5, y: 1.6, w: 3 };

export const NPCS3D = {
  abah: { i: 12.6, j: 10.4, look: { shirt: 0xf4f1e6, pants: 0x3d5a80, skin: 0xb5794b, songkok: true, beard: true, sarong: true } },
  kiah: { i: 19.4, j: 12.0, look: { shirt: 0xe88bb0, pants: 0x7a3f8f, skin: 0xc78b5a, tudung: 0x7a3f8f, sarong: true } },
  din: { i: 17.2, j: 21.4, look: { shirt: 0x2e86de, pants: 0x2d3a4a, skin: 0xa8703e, hair: 0x222222, cap: 0xe74c3c } },
  amin: { i: 12.6, j: 18.8, look: { shirt: 0xe74c3c, pants: 0x2d3a4a, skin: 0xc08050, hair: 0x1c1c1c, kid: true } },
  hassan: { i: 8.6, j: 19.2, look: { shirt: 0x8d6e63, pants: 0x4e342e, skin: 0x9c6b44, cap: 0xd9b36c } },
  lim: { i: 17.3, j: 8.3, look: { shirt: 0xecf0f1, pants: 0x34495e, skin: 0xe0b08a, hair: 0x333333 } },
  ani: { i: 13.4, j: 22.5, look: { shirt: 0xa3cbe8, pants: 0x2c3e50, skin: 0xc78b5a, tudung: 0x1f6f9c, sarong: true } },
  abu: { i: 21.3, j: 26.4, look: { shirt: 0x95a5a6, pants: 0x2c3e50, skin: 0xa8703e, songkok: true } },
  kaklong: { i: 36.75, j: 8.5, look: { shirt: 0xf6a5c0, pants: 0x6c3483, skin: 0xc68a5a, tudung: 0xd35400, sarong: true } },
  mat: { i: 11.7, j: 4.4, look: { shirt: 0xf39c12, pants: 0x34495e, skin: 0x8d5a34, cap: 0xecf0f1, beard: true } },
};
const VILLAGERS = [
  { shirt: 0x27ae60, pants: 0x34495e, skin: 0xc68a5a, hair: 0x222222 }, { shirt: 0xf1c40f, pants: 0x5d4037, skin: 0xa8703e, songkok: true },
  { shirt: 0x9b59b6, pants: 0x9b59b6, skin: 0xd39a6a, tudung: 0x16a085, sarong: true }, { shirt: 0xe67e22, pants: 0x2c3e50, skin: 0xb5794b, hair: 0x333333, cap: 0x2980b9 },
  { shirt: 0xecf0f1, pants: 0x7f8c8d, skin: 0xc08050, tudung: 0xc0392b, sarong: true }, { shirt: 0x3498db, pants: 0x2c3e50, skin: 0xc68a5a, hair: 0x111111, kid: true },
  { shirt: 0xd35400, pants: 0x2c3e50, skin: 0xb07040, hair: 0x111111 }, { shirt: 0x16a085, pants: 0x34495e, skin: 0xc68a5a, tudung: 0xf39c12, sarong: true },
];

// ------------------------------------------------------------ textures (drawn in code)
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
function noiseFill(x, w, h, base, spread, n, size, rnd) {
  x.fillStyle = base; x.fillRect(0, 0, w, h);
  for (let k = 0; k < n; k++) { const v = (rnd() - .5) * spread; x.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${Math.abs(v)})`; x.fillRect(rnd() * w, rnd() * h, size * (.5 + rnd()), size * (.5 + rnd())); }
}
function makeTextures() {
  const r = mulberry32(11);
  return {
    grass: canvasTex(256, 256, (x, w, h) => { noiseFill(x, w, h, '#ffffff', .16, 2200, 3, r); for (let k = 0; k < 400; k++) { x.strokeStyle = `rgba(0,60,0,${.05 + r() * .08})`; x.beginPath(); const px = r() * w, py = r() * h; x.moveTo(px, py); x.lineTo(px + (r() - .5) * 4, py - 4 - r() * 6); x.stroke(); } }, [24, 24]),
    asphalt: canvasTex(256, 256, (x, w, h) => noiseFill(x, w, h, '#ffffff', .12, 3000, 2, r), [10, 10]),
    sand: canvasTex(256, 256, (x, w, h) => noiseFill(x, w, h, '#ffffff', .12, 2500, 2, r), [8, 8]),
    planks: canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 16) { x.fillStyle = 'rgba(0,0,0,.16)'; x.fillRect(0, y, w, 2); x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(0, y + 2, w, 2); for (let k = 0; k < 3; k++) { x.fillStyle = `rgba(0,0,0,${r() * .06})`; x.fillRect(r() * w, y + 4, 30 + r() * 40, 10); } } }),
    zinc: canvasTex(128, 128, (x, w, h) => { for (let i = 0; i < w; i += 8) { const g = x.createLinearGradient(i, 0, i + 8, 0); g.addColorStop(0, '#9aa3a8'); g.addColorStop(.5, '#e9eef0'); g.addColorStop(1, '#9aa3a8'); x.fillStyle = g; x.fillRect(i, 0, 8, h); } }),
    rust: canvasTex(128, 128, (x, w, h) => { for (let i = 0; i < w; i += 8) { const g = x.createLinearGradient(i, 0, i + 8, 0); g.addColorStop(0, '#6e4630'); g.addColorStop(.5, '#a8775a'); g.addColorStop(1, '#6e4630'); x.fillStyle = g; x.fillRect(i, 0, 8, h); } x.fillStyle = 'rgba(140,60,20,.45)'; for (let k = 0; k < 18; k++) { x.beginPath(); x.ellipse(r() * w, r() * h, 6 + r() * 14, 4 + r() * 8, 0, 0, 7); x.fill(); } }),
    tiles: canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#c4502f'; x.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 12) { x.fillStyle = 'rgba(0,0,0,.22)'; x.fillRect(0, y + 9, w, 3); for (let i = (y / 12) % 2 * 8; i < w; i += 16) { x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(i, y, 2, 10); x.fillStyle = `rgba(255,200,160,${r() * .15})`; x.fillRect(i + 2, y + 1, 12, 6); } } }),
    attap: canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#9c7a4a'; x.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 8) for (let i = 0; i < w; i += 3) { x.fillStyle = `rgba(${60 + r() * 60},${40 + r() * 40},20,${.3 + r() * .4})`; x.fillRect(i, y, 2, 6 + r() * 4); } }),
    floorTiles: canvasTex(64, 64, (x, w, h) => { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#d9cdb5' : '#b9a98c'; x.fillRect(i * 16, j * 16, 16, 16); } }),
    padi: canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#7fae4a'; x.fillRect(0, 0, w, h); for (let i = 0; i < w; i += 8) { x.fillStyle = 'rgba(30,70,20,.25)'; x.fillRect(i, 0, 3, h); } }, [6, 6]),
  };
}
function signTex(text, bg, fg = '#fff', sub = '') {
  return canvasTex(512, 128, (x, w, h) => {
    x.fillStyle = bg; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = 6; x.strokeRect(6, 6, w - 12, h - 12);
    x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
    let s = 64; x.font = `900 ${s}px system-ui, sans-serif`; while (x.measureText(text).width > w - 40 && s > 20) { s -= 4; x.font = `900 ${s}px system-ui, sans-serif`; }
    x.fillText(text, w / 2, sub ? 52 : 66); if (sub) { x.font = '700 24px system-ui'; x.globalAlpha = .85; x.fillText(sub, w / 2, 100); }
  });
}

// ------------------------------------------------------------ builder: simple parts, baked later
// Free the GPU resources a subtree owns. Geometries/materials in `keep` are shared and survive.
// Textures are never disposed here: they come from the shared texture set (X) and are reused on rebuild.
export function disposeOwned(root, keep = new Set()) {
  root.traverse((o) => {
    if (o.isInstancedMesh) o.dispose(); // instance matrix/colour buffers only, not geometry or material
    if (o.geometry && !keep.has(o.geometry)) o.geometry.dispose();
    for (const m of [].concat(o.material || [])) if (!keep.has(m)) m.dispose();
  });
}
function kit(root) {
  const mats = new Map();
  const K = {
    vc(color, o = {}) { const k = 'vc' + color + JSON.stringify(o); if (!mats.has(k)) { const m = new T.MeshStandardMaterial({ color, roughness: .82, ...o }); m.userData.vc = !o.emissive && !o.transparent; mats.set(k, m); } return mats.get(k); },
    tex(map, color = 0xffffff, o = {}) { const k = map.uuid + color + JSON.stringify(o); if (!mats.has(k)) mats.set(k, new T.MeshStandardMaterial({ map, color, roughness: .8, ...o })); return mats.get(k); },
    add(geo, m, x, y, z, p = root, cast = true) { const o = new T.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = cast; o.receiveShadow = true; p.add(o); return o; },
    box(w, h, d, m, x, y, z, p, cast) { return K.add(new T.BoxGeometry(w, h, d), m, x, y, z, p, cast); },
    cyl(rt, rb, h, m, x, y, z, p, seg = 10) { return K.add(new T.CylinderGeometry(rt, rb, h, seg), m, x, y, z, p); },
    ball(r, m, x, y, z, p, d = 1) { return K.add(new T.IcosahedronGeometry(r, d), m, x, y, z, p); },
    group(x = 0, y = 0, z = 0, p = root, ry = 0) { const g = new T.Group(); g.position.set(x, y, z); g.rotation.y = ry; p.add(g); return g; },
  };
  return K;
}
// merge every static mesh under `root` into one mesh per material (vertex-coloured materials share one)
function bake(root, scene) {
  root.updateMatrixWorld(true);
  const buckets = new Map(), vcMat = new T.MeshStandardMaterial({ vertexColors: true, roughness: .82 });
  const keep = [];
  root.traverse((o) => {
    if (!o.isMesh || o.userData.noBake) return;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    const srcColor = o.material.vertexColors && g.attributes.color ? g.attributes.color : null;
    if (!g.attributes.normal) g.computeVertexNormals();
    for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(a) || (a === 'color')) { if (a !== 'color') g.deleteAttribute(a); }
    if (!g.attributes.uv) g.setAttribute('uv', new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.applyMatrix4(o.matrixWorld);
    const m = o.material, vc = m.userData.vc || (!m.map && !m.transparent && m.emissive && m.emissive.getHex() === 0 && m.side !== T.DoubleSide);
    if (vc) { const n = g.attributes.position.count, col = new Float32Array(n * 3), src = srcColor; for (let i = 0; i < n; i++) { const f = src ? [src.getX(i), src.getY(i), src.getZ(i)] : [1, 1, 1]; col.set([m.color.r * f[0], m.color.g * f[1], m.color.b * f[2]], i * 3); } g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); }
    if (g.attributes.color && !vc) g.deleteAttribute('color');
    if (vc && srcColor === null && g.attributes.color && g.attributes.color.itemSize !== 3) g.deleteAttribute('color');
    const key = (vc ? 'vc' : m.uuid) + (o.castShadow ? 's' : 'n');
    if (!buckets.has(key)) buckets.set(key, { mat: vc ? vcMat : m, cast: o.castShadow, geos: [] });
    buckets.get(key).geos.push(g);
  });
  root.traverse((o) => { if (o.isMesh && o.userData.noBake) keep.push(o); });
  const out = new T.Group();
  for (const b of buckets.values()) {
    if (!b.mat.userData.vc && b.mat === vcMat) { /* noop */ }
    const hasColor = b.mat === vcMat;
    const geos = b.geos.map(g => { if (!hasColor && g.attributes.color) g.deleteAttribute('color'); return g; });
    const merged = mergeGeometries(geos, false); geos.forEach(g => g.dispose());
    const mesh = new T.Mesh(merged, b.mat); mesh.castShadow = b.cast; mesh.receiveShadow = true; out.add(mesh);
  }
  for (const o of keep) { o.updateMatrixWorld(true); const c = o.clone(); c.matrixAutoUpdate = false; c.matrix.copy(o.matrixWorld); out.add(c); }
  scene.add(out);
  return out;
}

// ------------------------------------------------------------ prefab pieces
function stiltHouse(K, X, o) {
  const { w, d } = o, s = 1.4, h = 2.6, wall = o.wall, roof = o.roof || 'zinc';
  const g = K.group(o.x, 0, o.z, undefined, o.ry || 0);
  const post = K.vc(0x5d3f2a), trim = K.vc(0x7c5941), planks = K.tex(X.planks, wall);
  for (const px of [-w / 2 + .2, -w / 6, w / 6, w / 2 - .2]) for (const pz of [-d / 2 + .2, d / 2 - .2]) K.cyl(.11, .13, s, post, px, s / 2, pz, g, 7);
  K.box(w + .3, .18, d + .3, trim, 0, s, 0, g);
  K.box(w, h, d, planks, 0, s + h / 2 + .09, 0, g);
  // verandah on the front (+z) with railing and stairs
  const vd = 1.1; K.box(w * .7, .14, vd, trim, -w * .1, s, d / 2 + vd / 2 + .1, g);
  for (let k = 0; k <= 8; k++) K.box(.05, .5, .05, K.vc(0xf4efe4), -w * .45 + k * (w * .7 / 8), s + .32, d / 2 + vd + .05, g);
  K.box(w * .7, .06, .07, K.vc(0xf4efe4), -w * .1, s + .58, d / 2 + vd + .05, g);
  for (let k = 0; k < 5; k++) K.box(.9, .08, .3, trim, w * .32, s - (k + 1) * (s / 5) + .04, d / 2 + .35 + k * .28, g);
  // windows, shutters, door
  const win = o.glow, shutter = K.vc(o.shutter || 0x6b4a33);
  for (const px of [-w / 3, w / 3 - .4]) { K.box(.7, .75, .06, win, px, s + 1.5, d / 2 + .02, g).userData.noBake = false; K.box(.32, .75, .05, shutter, px - .55, s + 1.5, d / 2 + .05, g); K.box(.32, .75, .05, shutter, px + .55, s + 1.5, d / 2 + .05, g); K.box(.82, .07, .1, K.vc(0xf4efe4), px, s + 1.1, d / 2 + .05, g); }
  K.box(.75, 1.7, .06, K.vc(0x4a2f1c), w * .1, s + .95, d / 2 + .03, g);
  for (const pz of [-d / 4, d / 4]) K.box(.06, .7, .6, win, w / 2 + .02, s + 1.5, pz, g);
  // roof: gable with overhang, ridge along x
  const ov = .45, rise = 1.25, half = d / 2 + ov, sl = Math.hypot(half, rise), ang = Math.atan2(rise, half);
  const rm = roof === 'attap' ? K.tex(X.attap) : roof === 'tiles' ? K.tex(X.tiles) : roof === 'rust' ? K.tex(X.rust) : K.tex(X.zinc, o.roofTint || 0xffffff, { metalness: .3, roughness: .5 });
  for (const sgn of [-1, 1]) { const r = K.box(w + ov * 2, .1, sl, rm, 0, s + h + .18 + rise / 2, sgn * half / 2, g); r.rotation.x = sgn * ang; }
  const tri = new T.Shape([new T.Vector2(-d / 2, 0), new T.Vector2(d / 2, 0), new T.Vector2(0, rise)]);
  const tg = new T.ExtrudeGeometry(tri, { depth: .08, bevelEnabled: false });
  for (const sx of [-w / 2, w / 2 - .08]) { const m = K.add(tg, planks, sx, s + h + .18, 0, g); m.rotation.y = Math.PI / 2; m.position.x = sx + (sx < 0 ? 0 : .08); }
  K.box(w + ov * 2 + .1, .12, .14, K.vc(0x4a2f1c), 0, s + h + .2 + rise, 0, g);
  if (o.broken) {
    for (const [px, pz] of [[-w / 4, .5], [w / 5, 1.0], [w / 3, -.6]]) { const p = K.box(.7, .12, .55, K.vc(0x1b1410), px, s + h + .18 + rise / 2 + .05, pz, g); p.rotation.x = pz > 0 ? ang : -ang; }
    for (const [px, py] of [[-w / 2.6, 1.0], [w / 4, 2.0], [-.2, 2.1]]) K.box(.55, .35, .04, K.vc(0xe8e0cc), px, s + py, d / 2 + .03, g);
  }
  return g;
}
function shophouseRow(K, X, x0, z0, units, gl) {
  const ry = 0, uw = 4.6, d = 5.2, h1 = 3.0, h2 = 2.5;
  const g = K.group(x0, 0, z0, undefined, ry);
  const signs = [];
  units.forEach((u, k) => {
    const cx = k * uw + uw / 2, col = K.tex(X.planks, u.wall), plain = K.vc(u.wall);
    K.box(uw, h1, d - 1.3, plain, cx, h1 / 2, -.65, g); // ground floor (recessed for the five-foot way)
    K.box(uw, .12, 1.4, K.tex(X.floorTiles, 0xffffff), cx, .06, d / 2 - .7, g); // five-foot way
    for (const px of [-uw / 2 + .2, uw / 2 - .2]) K.box(.32, h1, .32, K.vc(0xf4efe4), cx + px, h1 / 2, d / 2 - .2, g);
    K.box(uw, h2, d, plain, cx, h1 + h2 / 2, 0, g); // upper floor overhangs the walkway
    K.box(uw + .05, .25, d + .05, K.vc(0xf4efe4), cx, h1 + .1, 0, g);
    for (const wx of [-1.2, 0, 1.2]) { // upper windows with louvred shutters
      K.box(.7, 1.15, .06, gl, cx + wx, h1 + 1.3, d / 2 + .02, g);
      K.box(.86, .1, .12, K.vc(0xf4efe4), cx + wx, h1 + 1.92, d / 2 + .05, g); K.box(.86, .1, .12, K.vc(0xf4efe4), cx + wx, h1 + .68, d / 2 + .05, g);
      for (let l = 0; l < 5; l++) K.box(.3, .05, .1, K.vc(u.shutter), cx + wx - .2, h1 + .85 + l * .2, d / 2 + .06, g);
    }
    // shop front: open shutters with goods
    K.box(uw - .7, h1 - .9, .06, K.vc(0x2b2420), cx, (h1 - .9) / 2 + .12, d / 2 - 1.3, g);
    for (let s = 0; s < 6; s++) K.box(.42, .4, .3, K.vc([0xe74c3c, 0xf1c40f, 0x27ae60, 0x3498db, 0xe67e22, 0xecf0f1][(s + k) % 6]), cx - 1.3 + s * .52, .4 + (s % 2) * .45, d / 2 - 1.5, g);
    // signboard + awning
    const sg = K.add(new T.PlaneGeometry(uw - .4, .85), new T.MeshStandardMaterial({ map: signTex(u.sign, u.signBg, u.signFg || '#fff', u.sub || ''), roughness: .6 }), cx, h1 - .45, d / 2 - 1.28, g, false); sg.userData.noBake = true; signs.push(sg);
    const aw = K.box(uw, .06, 1.1, K.vc(u.awning), cx, h1 - .02, d / 2 + .25, g); aw.rotation.x = .25;
    // clay tile roof (ridge along the row)
    const rise = 1.0, half = d / 2 + .3, sl = Math.hypot(half, rise), ang = Math.atan2(rise, half);
    for (const sgn of [-1, 1]) { const r = K.box(uw + .02, .1, sl, K.tex(X.tiles), cx, h1 + h2 + rise / 2 + .05, sgn * half / 2, g); r.rotation.x = sgn * ang; }
    K.box(.3, .5, d + .4, K.vc(0xf4efe4), k * uw, h1 + h2 + .25, 0, g); // party wall
  });
  K.box(.3, .5, d + .4, K.vc(0xf4efe4), units.length * uw, h1 + h2 + .25, 0, g);
  return { g, w: units.length * uw, d };
}
function warung(K, X, x, z, M = {}) {
  const g = K.group(x, 0, z);
  const post = K.vc(0x6b4a33);
  K.box(5.6, .12, 4, K.tex(X.floorTiles, 0xffffff), 0, .06, 0, g);
  for (const px of [-2.6, 2.6]) for (const pz of [-1.8, 1.8]) K.cyl(.09, .09, 2.8, post, px, 1.4, pz, g, 6);
  const rf = K.box(6.4, .1, 4.8, K.tex(X.zinc, 0xffffff, { metalness: .3, roughness: .5 }), 0, 2.95, 0, g); rf.rotation.x = -.12;
  K.box(5.4, 1.4, .3, K.tex(X.planks, 0xb07e52), 0, .7, -1.8, g);
  K.box(3.4, 1, .6, K.vc(0xc79a62), -.8, .5, -1.1, g); K.box(3.6, .08, .75, K.vc(0xf0e6d2), -.8, 1.04, -1.1, g);
  for (let k = 0; k < 4; k++) K.cyl(.13, .13, .32, K.vc([0xe74c3c, 0xf1c40f, 0x27ae60, 0xe67e22][k]), -2.2 + k * .8, 1.24, -1.2, g, 8);
  if (M.rtable) {
    for (const [tx, tz] of [[-1.3, .8], [1.4, .8]]) { putModel(M, 'rtable', g, tx, tz, { len: 1.25 }); for (const a of [0, 2.1, 4.2]) putModel(M, 'rchair', g, tx + Math.sin(a) * .85, tz + Math.cos(a) * .85, { h: .85, ry: a + Math.PI }); }
    putModel(M, 'stove', g, -2.1, -1.1, { len: .7, y: 1.08 }); putModel(M, 'potStew', g, -2.1, -1.1, { h: .35, y: 1.16 }); putModel(M, 'stewPot', g, -.9, -1.1, { h: .4, y: 1.08 });
    putModel(M, 'jarA', g, .2, -1.15, { h: .35, y: 1.08 }); putModel(M, 'jarB', g, .5, -1.0, { h: .28, y: 1.08 }); putModel(M, 'menu', g, 2.9, 1.9, { h: 1.1, ry: -.6 });
  } else for (const [tx, tz] of [[-1.3, .7], [1.3, .7]]) {
    K.box(1.3, .06, .8, K.vc(0xd9443a), tx, .78, tz, g); K.box(1.2, .07, .7, K.vc(0xffffff), tx, .8, tz, g);
    for (const lx of [-.5, .5]) for (const lz of [-.3, .3]) K.box(.05, .76, .05, post, tx + lx, .38, tz + lz, g);
    for (const sz of [-.65, .65]) K.box(1.1, .06, .3, K.vc(0x9a6b44), tx, .45, tz + sz, g);
  }
  // umbrella
  K.cyl(.04, .04, 2.2, K.vc(0xdddddd), 3.4, 1.1, 1.6, g, 6);
  const um = K.add(new T.ConeGeometry(1.2, .5, 8), K.vc(0xf39c12), 3.4, 2.3, 1.6, g); um.rotation.y = .3;
  const um2 = K.add(new T.ConeGeometry(1.21, .5, 8, 1, true, 0, Math.PI / 2), K.vc(0x2e86de, { side: T.DoubleSide }), 3.4, 2.3, 1.6, g); um2.userData.noBake = false;
  return g;
}
function carwash(K, X, x, z, open, gl) {
  const g = K.group(x, 0, z);
  K.box(6, 3.2, 4, K.vc(0x4aa3d8), 0, 1.6, 0, g);
  K.box(6.2, .3, 4.2, K.vc(0xf1c40f), 0, 3.35, 0, g);
  K.box(3.6, 2.4, .06, K.vc(open ? 0x22313a : 0x8a9aa2), -.6, 1.2, 2.02, g);
  if (!open) for (let k = 0; k < 10; k++) K.box(3.6, .04, .08, K.vc(0x6c7c84), -.6, .2 + k * .23, 2.06, g);
  K.box(1, .9, .06, gl, 2.1, 1.7, 2.02, g);
  for (const [bx, by, br] of [[-2.6, 3.8, .35], [-2.1, 3.7, .22], [2.4, 3.8, .3], [2.0, 3.65, .18]]) K.ball(br, K.vc(0xffffff), bx, by, 1.8, g, 1);
  return g;
}
function surau(K, X, x, z) {
  const g = K.group(x, 0, z);
  K.box(5.6, .3, 5.6, K.vc(0xd9d4c5), 0, .15, 0, g);
  K.box(5, 2.6, 5, K.vc(0xf7f4ea), 0, 1.6, 0, g);
  for (const px of [-1.5, 0, 1.5]) K.box(.7, 1.5, .06, K.vc(0x2e7d5b), px, 1.6, 2.52, g);
  const r1 = K.add(new T.ConeGeometry(4.2, 1.6, 4), K.vc(0x1e8a5c), 0, 3.7, 0, g); r1.rotation.y = Math.PI / 4;
  const r2 = K.add(new T.ConeGeometry(2.4, 1.2, 4), K.vc(0x27a56e), 0, 4.9, 0, g); r2.rotation.y = Math.PI / 4;
  K.add(new T.SphereGeometry(.55, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), K.vc(0xf1c40f, { metalness: .5, roughness: .35 }), 0, 5.45, 0, g);
  K.box(.8, 6.5, .8, K.vc(0xf7f4ea), 3.1, 3.25, 2.1, g);
  K.add(new T.SphereGeometry(.5, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), K.vc(0xf1c40f, { metalness: .5, roughness: .35 }), 3.1, 6.5, 2.1, g);
  return g;
}
function palm(K, x, z, s, r) {
  const g = K.group(x, 0, z, undefined, r() * 6.3);
  let px = 0, py = 0; const lean = .3 + r() * .35, trunk = K.vc(0x8a6a4a);
  for (let i = 0; i < 7; i++) {
    const h = .75 * s, a = lean * i * .08, rad = .17 * s * (1 - i * .06);
    const m = K.cyl(rad * .92, rad, h + .04, trunk, px + Math.sin(a) * h / 2, py + Math.cos(a) * h / 2, 0, g, 6); m.rotation.z = -a;
    px += Math.sin(a) * h; py += Math.cos(a) * h;
  }
  const fg = new T.BoxGeometry(.38 * s, .04, 2.1 * s); fg.translate(0, 0, 1.05 * s);
  for (let k = 0; k < 9; k++) {
    const piv = new T.Group(); piv.position.set(px, py, 0); piv.rotation.y = k / 9 * Math.PI * 2 + r() * .3; g.add(piv);
    const m = K.add(fg, K.vc(k % 2 ? 0x2f8f3a : 0x46a84c), 0, 0, 0, piv); m.rotation.x = .45 + r() * .35;
  }
  for (let k = 0; k < 3; k++) K.ball(.14 * s, K.vc(0x6b7f2a), px + Math.cos(k * 2.1) * .2, py - .15, Math.sin(k * 2.1) * .2, g, 0);
  return g;
}
function roundTree(K, x, z, s, r, fruit) {
  const g = K.group(x, 0, z);
  K.cyl(.16 * s, .24 * s, 1.6 * s, K.vc(0x6b4a33), 0, .8 * s, 0, g, 7);
  const cols = [0x2e7d42, 0x3b9e52, 0x348f4a, 0x4caf50];
  for (let k = 0; k < 6; k++) { const a = k * 1.1, rr = (1 + r() * .35) * s; K.ball(rr, K.vc(cols[k % 4], { flatShading: true }), Math.cos(a) * .7 * s, (2.2 + (k % 3) * .4) * s, Math.sin(a) * .7 * s, g, 0); }
  if (fruit) for (let k = 0; k < 10; k++) { const a = r() * 6.3; K.ball(.09, K.vc(0xd8342c), Math.cos(a) * 1.3 * s, (2 + r()) * s, Math.sin(a) * 1.3 * s, g, 0); }
  return g;
}
function bush(K, x, z, r) {
  const g = K.group(x, 0, z), cols = [0x3b9e52, 0x2e7d42, 0x4caf50];
  for (let k = 0; k < 3; k++) K.ball(.4 + r() * .2, K.vc(cols[k], { flatShading: true }), (k - 1) * .4, .35, (r() - .5) * .3, g, 0);
  if (r() > .4) { const fc = [0xf6a5ad, 0xffffff, 0xf1c40f, 0xe74c3c][Math.floor(r() * 4)]; for (let k = 0; k < 6; k++) K.ball(.07, K.vc(fc), (r() - .5) * 1.1, .55 + r() * .25, (r() - .5) * .6, g, 0); }
  return g;
}
function scooter(K, x, z, ry, col) {
  const g = K.group(x, 0, z, undefined, ry), blk = K.vc(0x1d1d1d);
  for (const wz of [-.45, .45]) { const w = K.cyl(.2, .2, .1, blk, 0, .2, wz, g, 12); w.rotation.z = Math.PI / 2; }
  K.box(.28, .3, .75, K.vc(col), 0, .45, -.05, g); K.box(.3, .12, .5, blk, 0, .66, -.15, g);
  K.box(.24, .55, .12, K.vc(col), 0, .55, .38, g); K.box(.55, .05, .05, K.vc(0x888888), 0, .88, .4, g);
  K.box(.12, .1, .06, K.vc(0xfff3c4), 0, .78, .46, g);
  return g;
}
function carModel(K, col, police) {
  const g = new T.Group();
  const prof = [[-1.1, .2], [1.1, .2], [1.15, .45], [1.0, .58], [.5, .62], [.3, .95], [-.55, .97], [-.85, .62], [-1.12, .55], [-1.15, .4]];
  const geo = new T.ExtrudeGeometry(new T.Shape(prof.map(([a, b]) => new T.Vector2(a, b))), { depth: .9, bevelEnabled: true, bevelSize: .04, bevelThickness: .04, bevelSegments: 2 });
  geo.translate(0, 0, -.45);
  K.add(geo, K.vc(col, { metalness: .3, roughness: .35 }), 0, 0, 0, g);
  const glass = K.vc(0x22343d, { roughness: .15 });
  for (const sz of [-.47, .47]) K.box(1.0, .26, .02, glass, -.1, .8, sz, g);
  K.box(.04, .3, .8, glass, .42, .8, 0, g);
  for (const [wx, wz] of [[.7, .47], [-.7, .47], [.7, -.47], [-.7, -.47]]) { const w = K.cyl(.2, .2, .14, K.vc(0x1d1d1d), wx, .2, wz, g, 12); w.rotation.x = Math.PI / 2; }
  if (police) { K.box(.25, .08, .5, K.vc(0x2e5bd8), -.1, 1.02, -.13, g); K.box(.25, .08, .26, K.vc(0xe74c3c), -.1, 1.02, .25, g); K.box(2.2, .1, .02, K.vc(0x2e5bd8), 0, .4, .5, g); }
  return g;
}
function lampPost(K, x, z, ry) {
  const g = K.group(x, 0, z, undefined, ry);
  K.cyl(.06, .08, 3.4, K.vc(0x4a5560), 0, 1.7, 0, g, 6); K.box(.08, .08, .9, K.vc(0x4a5560), 0, 3.35, .4, g);
  K.box(.3, .1, .4, K.vc(0xfff6c8, { emissive: 0xffe9a0, emissiveIntensity: .2 }), 0, 3.28, .8, g);
  return g;
}

// ------------------------------------------------------------ people (not baked: they move)
function makePerson(K, look) {
  const g = new T.Group(), s = look.kid ? .72 : 1;
  const body = new T.Group(); body.scale.setScalar(s); g.add(body);
  const add = (geo, col, x, y, z, p = body) => { const m = new T.Mesh(geo, K.vc(col)); m.position.set(x, y, z); m.castShadow = true; p.add(m); return m; };
  const legs = []; for (const lx of [-.12, .12]) { const p = new T.Group(); p.position.set(lx, .55, 0); body.add(p); add(new T.CapsuleGeometry(.08, .32, 3, 6), look.pants, 0, -.26, 0, p); legs.push(p); }
  if (look.sarong) add(new T.CylinderGeometry(.22, .27, .5, 10), look.pants, 0, .32, 0);
  add(new T.CapsuleGeometry(.22, .34, 4, 10), look.shirt, 0, .86, 0);
  const arms = []; for (const ax of [-.3, .3]) { const p = new T.Group(); p.position.set(ax, 1.05, 0); body.add(p); add(new T.CapsuleGeometry(.065, .32, 3, 6), look.shirt, 0, -.2, 0, p); add(new T.SphereGeometry(.07, 8, 6), look.skin, 0, -.42, 0, p); arms.push(p); }
  add(new T.SphereGeometry(.24, 16, 12), look.skin, 0, 1.38, 0);
  for (const ex of [-.08, .08]) add(new T.SphereGeometry(.03, 6, 4), 0x1a1a1a, ex, 1.4, .21);
  if (look.tudung) { add(new T.SphereGeometry(.27, 16, 12, Math.PI * .72, Math.PI * 1.56), look.tudung, 0, 1.39, 0).material = K.vc(look.tudung, { side: T.DoubleSide }); add(new T.ConeGeometry(.34, .32, 12, 1, true), look.tudung, 0, 1.12, 0).material = K.vc(look.tudung, { side: T.DoubleSide }); }
  else if (look.songkok) add(new T.CylinderGeometry(.22, .22, .16, 14), 0x15151a, 0, 1.6, 0);
  else if (look.cap) { add(new T.SphereGeometry(.25, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), look.cap, 0, 1.45, 0); add(new T.BoxGeometry(.24, .03, .2), look.cap, 0, 1.47, .22); }
  else if (look.hair) add(new T.SphereGeometry(.255, 14, 10, 0, Math.PI * 2, 0, Math.PI * .55), look.hair, 0, 1.4, -.02);
  if (look.beard) add(new T.SphereGeometry(.13, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 0xeeeeee, 0, 1.32, .12);
  return { g, legs, arms, body };
}

// ------------------------------------------------------------ the town
export async function createTown3D(canvas, hooks) {
  await load3DTown();
  const prog = document.getElementById('loadProg');
  const M = await loadModels((f) => { if (prog) prog.style.width = `${Math.round(f * 100)}%`; });
  const X = makeTextures();
  const towerTex = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 256; const x = c.getContext('2d'); x.fillStyle = '#e9e3d4'; x.fillRect(0, 0, 128, 256);
    for (let r = 0; r < 16; r++) for (let k = 0; k < 4; k++) { x.fillStyle = (r * 7 + k * 3) % 5 ? '#4f88a8' : '#2f6684'; x.fillRect(10 + k * 29, 8 + r * 15.5, 20, 10); }
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; return t; })();
  const mallGlass = new T.MeshStandardMaterial({ color: 0x5dade2, roughness: .15, metalness: .3, emissive: 0xffe0a0, emissiveIntensity: 0 }); let mallSign = null;
  function textPanel(text, w, h, bg, glow) { const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * h / w); const x = c.getContext('2d'); x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#fff'; x.font = `900 ${Math.round(c.height * .62)}px system-ui`; x.textAlign = 'center'; x.textBaseline = 'middle'; let fs = Math.round(c.height * .62); while (x.measureText(text).width > c.width * .92 && fs > 10) { fs -= 4; x.font = `900 ${fs}px system-ui`; } x.fillText(text, 512, c.height / 2 + 4);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshStandardMaterial({ map: t, emissive: glow ? 0xffffff : 0x000000, emissiveMap: glow ? t : null, emissiveIntensity: glow ? .2 : 0, roughness: .6 })); m.userData.noBake = true; return m; }
  const towerGlass = new T.MeshStandardMaterial({ map: towerTex, roughness: .5, emissive: 0xffd88a, emissiveMap: towerTex, emissiveIntensity: 0 }), cityGlass = new T.MeshStandardMaterial({ map: towerTex, color: 0xe8e4dc, roughness: .6, emissive: 0xffd88a, emissiveMap: towerTex, emissiveIntensity: 0 });
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene();
  const SEA = new T.Color(0x3fa7d0); scene.background = SEA.clone();
  const hemi = new T.HemisphereLight(0xfdf6e8, 0x5b7a4a, 1.6); scene.add(hemi);
  const sun = new T.DirectionalLight(0xfff0d0, 2.6); sun.castShadow = true;
  const sm = isTouch ? 2048 : 4096; sun.shadow.mapSize.set(sm, sm); sun.shadow.bias = -.0003; sun.shadow.normalBias = .02;
  Object.assign(sun.shadow.camera, { left: -38, right: 38, top: 38, bottom: -38, near: 1, far: 140 });
  sun.position.set(-25, 50, 18); scene.add(sun); scene.add(sun.target);
  const glowMat = new T.MeshStandardMaterial({ color: 0x2d4a52, emissive: 0xffc46b, emissiveIntensity: 0, roughness: .2, metalness: .2 });

  // ground layers
  const ground = new T.Group(); scene.add(ground);
  const gk = kit(ground); let padiIM = null;
  const [mx0, mz0] = W(0, 0), size = N * TS;
  // the sea: Gerstner-wave ocean, calm at the beach and choppier offshore (sea lies at world z < -24.4)
  const ocean = makeOcean(T, { w: 420, h: 420, seg: .62, amp: .24, shoreY: 24.6, shoreFade: 14, deep: 0x0b4a72, shallow: 0x2fb0cf, sky: 0xcdeefa, repeat: 40 });
  ocean.mesh.position.set(12, -.14, 0); ground.add(ocean.mesh);
  const shore1 = shoreWaves(T, ground, { segs: [[-30, 54.8], [61.2, 80]], shoreZ: -24.35, seaward: -1, reach: 3.6, period: 7 });
  const shore2 = shoreWaves(T, ground, { segs: [[-30, 80]], shoreZ: 72.6, seaward: 1, reach: 2.6, period: 8, n: 2 });
  const shore = (t) => { shore1(t); shore2(t); };
  const grass = gk.add(new T.PlaneGeometry(size, size - 5 * TS), new T.MeshStandardMaterial({ map: X.grass, color: 0x79bd57, roughness: .95 }), 0, 0, 2.5 * TS, ground, false); grass.rotation.x = -Math.PI / 2;
  const sand = gk.add(new T.PlaneGeometry(size, 2 * TS + .6), new T.MeshStandardMaterial({ map: X.sand, color: 0xf1dca0, roughness: 1 }), 0, .005, mz0 + 4 * TS - .3, ground, false); sand.rotation.x = -Math.PI / 2;
  const foam = gk.add(new T.PlaneGeometry(size, .35), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .75 }), 0, .01, mz0 + 3 * TS - .1, ground, false); foam.rotation.x = -Math.PI / 2;
  const asph = new T.MeshStandardMaterial({ map: X.asphalt, color: 0x5d6168, roughness: .9 });
  const road = (i0, j0, i1, j1) => { const [a, b] = W(i0, j0), [c, d] = W(i1, j1); const m = gk.add(new T.PlaneGeometry(c - a, d - b), asph, (a + c) / 2, .02, (b + d) / 2, ground, false); m.rotation.x = -Math.PI / 2; };
  road(14, 5, 16, N); road(3, 16, N, 18);
  { // east extension: grass and Pantai Miami beach either side of the river mouth
    const plane = (x0, z0, x1, z1, m, y) => { const g = gk.add(new T.PlaneGeometry(x1 - x0, z1 - z0), m, (x0 + x1) / 2, y, (z0 + z1) / 2, ground, false); g.rotation.x = -Math.PI / 2; return g; };
    const gm = new T.MeshStandardMaterial({ map: X.grass, color: 0x79bd57, roughness: .95 }), sm = new T.MeshStandardMaterial({ map: X.sand, color: 0xf3e2ae, roughness: 1 });
    plane(30, -11, RIVER.x0, 30, gm, 0); plane(RIVER.x1, -11, 80, 30, gm, 0);
    plane(30, -24.3, RIVER.x0, -11, sm, .005); plane(RIVER.x1, -24.3, 80, -11, sm, .005);
    plane(30, -24.45, RIVER.x0, -24.1, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .75 }), .01); plane(RIVER.x1, -24.45, 80, -24.1, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .75 }), .01);
    // Bandar Baru: new land south of the kampung (z 30..69) with a sandy south shore
    plane(-30, 30, 80, 69, gm, 0); plane(-30, 69, 80, 72.5, sm, .005);
    const roadW = (x0, z0, x1, z1) => { const m = gk.add(new T.PlaneGeometry(x1 - x0, z1 - z0), asph, (x0 + x1) / 2, .021, (z0 + z1) / 2, ground, false); m.rotation.x = -Math.PI / 2; return m; };
    roadW(-2, 30, 2, 44); roadW(-30, 44, 80, 48); roadW(38, 6, 42, 44); roadW(30.5, 48, 33.5, 61.5); roadW(6, 48, 9, 49.4); roadW(27, 48, 30, 49.4);
    const dash = new T.MeshBasicMaterial({ color: 0xffffff }); for (let x = -28; x < 80; x += 3) { const d = gk.add(new T.PlaneGeometry(1.4, .14), dash, x, .025, 46, ground, false); d.rotation.x = -Math.PI / 2; }
    const lot = gk.add(new T.PlaneGeometry(24, 10.5), new T.MeshStandardMaterial({ color: 0x55585e, roughness: .95 }), 18, .018, 54.5, ground, false); lot.rotation.x = -Math.PI / 2;
    for (let x = 7; x <= 29; x += 2.75) for (const z0 of [51.6, 57.4]) { const l = gk.add(new T.PlaneGeometry(.1, 3.2), dash, x, .024, z0, ground, false); l.rotation.x = -Math.PI / 2; }
    const plaza = gk.add(new T.PlaneGeometry(26, 2.4), new T.MeshStandardMaterial({ color: 0xd8cfc0, roughness: .9 }), 18, .022, 42.8, ground, false); plaza.rotation.x = -Math.PI / 2;
    road(30, 16, 36, 18); road(34, 10, 36, 16); road(34, 10, 38.5, 11.5); road(49.75, 10, 54, 11.5);
    for (const x of [RIVER.x0 - .15, RIVER.x1 + .15]) gk.box(.4, .5, 54, new T.MeshStandardMaterial({ color: 0x8d8a82, roughness: 1 }), x, .05, 3, ground, false); // river walls
  }
  const lineM = new T.MeshBasicMaterial({ color: 0xf5f5f0 });
  for (let j = 5; j < N; j += 1.5) if (j < 15.5 || j > 18) { const [x, z] = W(15, j); gk.add(new T.PlaneGeometry(.12, 1), lineM, x, .03, z + .5, ground, false).rotation.x = -Math.PI / 2; }
  for (let i = 3; i < N; i += 1.5) if (i < 13.5 || i > 16) { const [x, z] = W(i, 17); const m = gk.add(new T.PlaneGeometry(1, .12), lineM, x + .5, .03, z, ground, false); m.rotation.x = -Math.PI / 2; }
  const kerbM = new T.MeshStandardMaterial({ color: 0xd8d4cc, roughness: .9 });
  for (const [i0, j0, i1, j1] of [[13.85, 5, 14, 16], [16, 5, 16.15, 16], [3, 15.85, 14, 16], [16, 15.85, N, 16], [3, 18, 14, 18.15], [16, 18, N, 18.15], [13.85, 18, 14, N], [16, 18, 16.15, N]]) { const [a, b] = W(i0, j0), [c, d] = W(i1, j1); gk.box(c - a, .12, d - b, kerbM, (a + c) / 2, .06, (b + d) / 2, ground, false); }
  // padi
  { const [a, b] = W(PADI.i0, PADI.j0), [c, d] = W(PADI.i1, PADI.j1); const p = gk.add(new T.PlaneGeometry(c - a, d - b), new T.MeshStandardMaterial({ map: X.padi, color: 0xffffff, roughness: .8 }), (a + c) / 2, .025, (b + d) / 2, ground, false); p.rotation.x = -Math.PI / 2;
    const tg = new T.ConeGeometry(.12, .7, 4); tg.translate(0, .35, 0);
    const n = 1100, im = new T.InstancedMesh(tg, new T.MeshStandardMaterial({ color: 0x9cc34a, roughness: .9 }), n), dm = new T.Object3D(), rr = mulberry32(4); padiIM = im;
    for (let k = 0; k < n; k++) { dm.position.set(a + .3 + (k % 22) * ((c - a - .6) / 21), .02, b + .3 + Math.floor(k / 22) * ((d - b - .6) / 49)); dm.rotation.set((rr() - .5) * .4, rr() * 3, (rr() - .5) * .4); dm.scale.setScalar(.8 + rr() * .5); dm.updateMatrix(); im.setMatrixAt(k, dm.matrix); }
    ground.add(im); }
  // padi looks: green (growing), ripe (gold), cut (stubble)
  function setPadi(state) { if (!padiIM) return; padiIM.material.color.set(state === 'ripe' ? 0xd9b13a : state === 'cut' ? 0xa8945c : 0x9cc34a); padiIM.scale.y = state === 'cut' ? .25 : state === 'ripe' ? 1.15 : 1; }
  // yards (tall grass instanced; rebuilt when cut)
  const yardMeshes = {};
  const bladeGeo = new T.ConeGeometry(.07, .9, 3); bladeGeo.translate(0, .45, 0);
  const yardShared = new Set([bladeGeo]);
  function buildYard(id, cut) {
    if (yardMeshes[id]) { ground.remove(yardMeshes[id]); disposeOwned(yardMeshes[id], yardShared); } // old yard is a Group: free each child, keep the shared blade
    const y = YARDS[id], [a, b] = W(y.i0, y.j0), [c, d] = W(y.i1, y.j1), g = new T.Group();
    const base = gk.add(new T.PlaneGeometry(c - a, d - b), new T.MeshStandardMaterial({ map: X.grass, color: cut ? 0x9ad66f : 0x5f9a3c, roughness: .95 }), (a + c) / 2, .015, (b + d) / 2, g, false); base.rotation.x = -Math.PI / 2;
    if (!cut) {
      const n = 700, im = new T.InstancedMesh(bladeGeo, new T.MeshStandardMaterial({ color: 0x6aa03c, roughness: .9 }), n), dm = new T.Object3D(), rr = mulberry32(id.length * 7);
      for (let k = 0; k < n; k++) { dm.position.set(a + rr() * (c - a), 0, b + rr() * (d - b)); dm.rotation.set((rr() - .5) * .6, rr() * 3, (rr() - .5) * .6); dm.scale.set(1, .6 + rr() * .7, 1); dm.updateMatrix(); im.setMatrixAt(k, dm.matrix); im.setColorAt(k, new T.Color().setHSL(.22 + rr() * .06, .45, .3 + rr() * .15)); }
      g.add(im);
    } else { for (let k = 0; k < (d - b) / .8; k++) { const s = gk.add(new T.PlaneGeometry(c - a, .4), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .1 }), (a + c) / 2, .02, b + .4 + k * .8, g, false); s.rotation.x = -Math.PI / 2; } }
    ground.add(g); yardMeshes[id] = g;
  }

  // ------------------------------------------------------------ static scenery (baked)
  let baked = null, pickBoxes = [], signsList = [], lamps = [];
  const objects = {}; // id -> { box: Box3, label }
  function buildStatic() {
    const flags = hooks.flags();
    if (baked) { scene.remove(baked); baked.traverse(o => { if (o.isMesh && o.geometry && !isShared(o.geometry)) o.geometry.dispose(); }); }
    for (const b of pickBoxes) scene.remove(b);
    pickBoxes = []; lamps = [];
    const root = new T.Group(); const K = kit(root); const r = mulberry32(77);
    const place = (id, label, group, i, j, w, d) => {
      group.updateMatrixWorld(true); const box = new T.Box3().setFromObject(group);
      objects[id] = { box, label };
      const s = box.getSize(new T.Vector3()), c = box.getCenter(new T.Vector3());
      const hit = new T.Mesh(new T.BoxGeometry(s.x, s.y, s.z), new T.MeshBasicMaterial({ visible: false })); hit.position.copy(c); hit.userData.id = id; scene.add(hit); pickBoxes.push(hit);
    };
    const ctr = (i, j, w, d) => { const [x, z] = W(i + w / 2, j + d / 2); return [x, z]; };
    const houses = [
      ['house_abah', 'Rumah Tok Abah', 8, 8, 3, 3, { wall: flags.abahRepaired ? (parseInt((flags.houseColor || '#c48a58').slice(1), 16)) : 0xb98a62, roof: flags.abahRepaired ? 'zinc' : 'rust', broken: !flags.abahRepaired }],
      ['house_ani', 'Rumah Cikgu Aqilah', 10, 20, 3, 3, { wall: 0xa9d8b8, roof: 'zinc', roofTint: 0xc0d9e8 }],
      ['house_abu', 'Rumah Pok Ajis', 22, 24, 3, 3, { wall: 0x8fc1d4, roof: 'tiles' }],
      [null, null, 3, 9, 3, 3, { wall: 0xf3d08a, roof: 'attap' }], [null, null, 3, 13, 2.5, 2.5, { wall: 0xe8b4b8, roof: 'zinc' }], [null, null, 24, 25.5, 0, 0, null],
    ];
    for (const [id, label, i, j, w, d, o] of houses) {
      if (!o) continue; const [x, z] = ctr(i, j, w, d);
      const g = stiltHouse(K, X, { x, z, w: w * TS - .6, d: d * TS - 1.6, glow: glowMat, ...o });
      if (id) place(id, label, g);
    }
    // shophouse row along the main lane (north side), facing the road
    { const [x0, z0] = W(16.9, 6.3);
      const row = shophouseRow(K, X, x0, z0, [
        { wall: 0xf6e7b8, shutter: 0x2e7d5b, sign: 'KEDAI RUNCIT', sub: 'SERI DAMAI · TOPUP', signBg: '#2e8b57', awning: 0x2e8b57 },
        { wall: 0xf4c7b8, shutter: 0x8e44ad, sign: 'GUNTING RAMBUT', sub: 'GAYA TERKINI', signBg: '#d9443a', awning: 0xd9443a },
        { wall: 0xbfe3e0, shutter: 0x1f6f9c, sign: 'FARMASI', sub: 'UBAT · VITAMIN', signBg: '#1f6f9c', awning: 0x1f6f9c },
      ], glowMat);
      place('kedai', 'Deretan Kedai', row.g); signsList.push(row.g);
      for (let k = 0; k < 7; k++) if (!putModel(M, 'scooter', root, x0 + 1.2 + k * 1.75, z0 + 4.3, { len: 1.45, ry: Math.PI + (r() - .5) * .35, tint: [0xd9443a, 0x2e86de, 0xf1c40f, 0x66aa8c, 0xe74c3c, 0x2a2a2a, 0xe67e22][k] })) scooter(K, x0 + 1.2 + k * 1.75, z0 + 4.2, Math.PI + (r() - .5) * .3, [0xd9443a, 0x2e86de, 0xf1c40f, 0x27ae60, 0xe74c3c, 0x1d1d1d, 0xe67e22][k]);
    }
    { const [x, z] = ctr(18, 9, 3, 2); place('warung', 'Warung Nek Ma', warung(K, X, x, z - .6, M)); }
    { const [x, z] = ctr(18, 19, 3, 2); const g = carwash(K, X, x, z, flags.carwashOpen, glowMat); place('carwash', 'Pok Wan Car Wash', g);
      if (!putModel(M, flags.carwashOpen ? 'hatch' : 'sedan', root, x - .6, z + 3.4, { len: 2.6 })) { const c = carModel(K, flags.carwashOpen ? 0xc0392b : 0x8e8e8e); c.position.set(x - .6, 0, z + 3.4); c.rotation.y = Math.PI / 2; root.add(c); } }
    { const [x, z] = ctr(23, 6, 3, 3); place('surau', 'Surau', surau(K, X, x + 1, z)); }
    { const [x, z] = ctr(24, 19, 4, 2); place('balai', 'Balai Raya', stiltHouse(K, X, { x, z, w: 7.4, d: 3.4, wall: 0xf4f1e6, roof: 'tiles', glow: glowMat })); }
    if (flags.festival) { const [x, z] = ctr(24, 19, 4, 2); // Bab 5: festival dressing — bunting, pelita torches and a little stage with speakers
      const cols = [0xe74c3c, 0xf1c40f, 0x2e86de, 0x27ae60, 0xffffff];
      for (const [px, pz] of [[-4.6, -2.6], [4.6, -2.6], [-4.6, 3.2], [4.6, 3.2]]) K.cyl(.07, .08, 3.6, K.vc(0x6d4c41), x + px, 1.8, z + pz, root, 6);
      for (const [ax, az, bx, bz] of [[-4.6, 3.2, 4.6, 3.2], [-4.6, -2.6, -4.6, 3.2], [4.6, -2.6, 4.6, 3.2]]) for (let k = 1; k < 16; k++) { const u = k / 16, sag = Math.sin(u * Math.PI) * .7; K.box(.28, .32, .04, K.vc(cols[k % 5]), x + ax + (bx - ax) * u, 3.4 - sag, z + az + (bz - az) * u, root, false); }
      for (let k = 0; k < 6; k++) { const px = x - 5.5 + k * 2.2, pz = z + 4.4; K.cyl(.05, .06, 1.4, K.vc(0x8d6e63), px, .7, pz, root, 6); K.box(.18, .22, .18, glowMat, px, 1.5, pz, root, false); }
      K.box(3.4, .4, 1.8, K.vc(0x8d6e63), x, .2, z + 5.6, root); for (const sx of [-1.9, 1.9]) K.box(.5, .9, .45, K.vc(0x222222), x + sx, .85, z + 5.6, root); }
    // jetty + boats
    { const [x, z] = W(9, 0); for (let k = 0; k < 5; k++) K.box(4, .12, 1.8, K.vc(0xa77b4f), x + 2, .25, z + k * 1.9 + .9, root); for (let k = 0; k < 6; k++) for (const px of [0, 4]) K.cyl(.1, .1, 1, K.vc(0x5d3f2a), x + px, -.2, z + k * 1.8, root, 6);
      if (!M.rowboat) for (const [bx, bz, col] of [[x + 6, z + 2.4, 0x2e86de], [x - 2.2, z + 1.2, 0xe74c3c]]) { const b = K.group(bx, 0, bz, root, .4); K.box(1.1, .45, 3.4, K.vc(col), 0, .1, 0, b); K.box(1.15, .12, 3.45, K.vc(0xf1c40f), 0, .38, 0, b); K.box(.7, .5, .8, K.vc(0xffffff), 0, .6, -.4, b); } }
    // padi scarecrow + hut
    { const [x, z] = W(5.5, 24.5); K.cyl(.05, .05, 1.8, K.vc(0x7a5236), x, .9, z, root, 5); K.box(1.2, .06, .06, K.vc(0x7a5236), x, 1.4, z, root); K.box(.45, .5, .2, K.vc(0xc0392b), x, 1.3, z, root); K.ball(.2, K.vc(0xe1b84f), x, 1.85, z, root, 1);
      const [hx, hz] = W(7.5, 21); stiltHouse(K, X, { x: hx, z: hz, w: 2.6, d: 2, wall: 0xc9a46a, roof: 'attap', glow: glowMat }); }
    // well, bus stop, fences, lamps, trees
    { const [x, z] = W(13, 6.5); K.cyl(.8, .85, .8, K.vc(0xb8b3a8), x, .4, z, root, 14); K.cyl(.65, .65, .82, K.vc(0x1d3b4a), x, .41, z, root, 14); for (const s of [-1, 1]) K.box(.1, 1.6, .1, K.vc(0x6b4a33), x + s * .7, 1.2, z, root); K.box(1.6, .1, .1, K.vc(0x6b4a33), x, 2, z, root); }
    { const [x, z] = W(17, 18.4); K.box(3, .08, 1.2, K.vc(0x2e86de), x + 1.5, 2.3, z + .5, root); for (const px of [.1, 2.9]) K.box(.08, 2.3, .08, K.vc(0x888888), x + px, 1.15, z + .9, root); K.box(2.8, .08, .45, K.vc(0x9a6b44), x + 1.5, .5, z + .5, root); }
    const lampAt = (x, z, ry) => { const m = putModel(M, 'lamp', root, x, z, { h: 3.6, ry }); if (m) { m.userData.lampHead = new T.Vector3(0, 3.4, .55); lamps.push(m); } else lamps.push(lampPost(K, x, z, ry)); };
    for (let j = 6; j < N; j += 3.5) { const [x, z] = W(13.8, j); lampAt(x, z, Math.PI / 2); }
    for (let i = 4; i < N; i += 4.5) { if (i > 13 && i < 17) continue; const [x, z] = W(i, 18.3); lampAt(x, z, Math.PI); }
    // white picket fences around the kampung yards (gap left for the path)
    const fenceLine = (i0, j0, i1, j1, gapAt) => { const [a, b] = W(i0, j0), [c, d] = W(i1, j1), len = Math.hypot(c - a, d - b), n = Math.max(1, Math.round(len / 2.9)), ry = Math.atan2(-(d - b), c - a);
      for (let k = 0; k < n; k++) { const t0 = (k + .5) / n; if (gapAt !== undefined && Math.abs(t0 - gapAt) < .5 / n + .02) continue; putModel(M, 'fence', root, lerp(a, c, t0), lerp(b, d, t0), { len: len / n + .05, ry }); } };
    for (const [id, gap] of [['abah', .5], ['ani', .45], ['abu', .5]]) { const y = YARDS[id]; fenceLine(y.i0, y.j1, y.i1, y.j1, gap); fenceLine(y.i0, y.j0, y.i0, y.j1); fenceLine(y.i1, y.j0, y.i1, y.j1); }
    // brick houses (rumah batu) on the edge of the kampung
    { let [x, z] = W(27.6, 12.6); putModel(M, 'house7', root, x, z, { len: 6.4 }); putModel(M, 'ktree', root, x + 3.6, z + 2, { h: 4 });
      [x, z] = W(18.6, 26.4); putModel(M, 'house12', root, x, z, { len: 6.2 }); putModel(M, 'ktreeS', root, x - 3.8, z + 1.5, { h: 3 });
      [x, z] = W(27.8, 22.8); putModel(M, 'house4', root, x, z, { len: 6, ry: Math.PI / 2 }); }
    // KayKit street furniture, water tower, traffic lights, tools on Tok Abah's verandah
    { let [x, z] = W(1.4, 17.2); putModel(M, 'watertower', root, x, z, { h: 7.5 });
      [x, z] = W(13.6, 15.6); putModel(M, 'tlight', root, x, z, { h: 3.4, ry: Math.PI / 4 }); [x, z] = W(16.4, 18.4); putModel(M, 'tlight', root, x, z, { h: 3.4, ry: -Math.PI * 3 / 4 });
      [x, z] = W(17.4, 18.9); putModel(M, 'bench', root, x + 1.4, z + .5, { len: 2, ry: Math.PI });
      [x, z] = W(20.9, 11.6); putModel(M, 'bench', root, x, z, { len: 1.8 });
      [x, z] = W(16.9, 15.85); putModel(M, 'hydrant', root, x, z, { h: .8 });
      [x, z] = W(23.8, 15.9); putModel(M, 'trashA', root, x, z, { h: .9 }); putModel(M, 'trashB', root, x + .7, z, { h: .9 });
      [x, z] = W(24.2, 4.6); putModel(M, 'dumpster', root, x, z, { len: 2.2, ry: Math.PI });
      [x, z] = W(17.1, 10.4); putModel(M, 'boxA', root, x, z, { h: .7, ry: .3 }); putModel(M, 'boxB', root, x + .5, z + .4, { h: .55, ry: 1 });
      [x, z] = W(10.2, 11.4); const tools = [['bucket', .45], ['shovel', .95], ['axe', .5], ['rope', .16], ['saw', .3], ['mallet', .35]];
      tools.forEach(([k, hh], n) => putModel(M, k, root, x - 1.6 + n * .55, z + (n % 2) * .35, { h: hh, ry: n * .9 }));
      [x, z] = W(8.6, 10.95); putModel(M, 'lantern', root, x, z, { h: .5, y: 1.55 });
      [x, z] = W(26.2, 18.6); putModel(M, 'wagon', root, x, z, { len: 2.7, face: 'x' }); }
    // KayKit restaurant/furniture: produce crates at the kedai runcit, Tok Abah's verandah, rowboats at the jetty
    { let [x, z] = W(16.9, 6.3); ['crateCarrot', 'crateTomato', 'crateOnion', 'cratePotato', 'crateLettuce'].forEach((k, n) => putModel(M, k, root, x + .55 + (n % 3) * .75, z + 2.05 + Math.floor(n / 3) * .45, { len: .62, ry: (n - 2) * .08 }));
      [x, z] = W(9.5, 9.5); const vy = 1.55, vz = z + 2.85;
      putModel(M, 'rug', root, x - .6, vz, { len: 2.2, y: vy }); putModel(M, 'woodChair', root, x - 1.8, vz - .05, { h: .9, y: vy, ry: Math.PI * .85 }); putModel(M, 'woodChair', root, x + .5, vz - .05, { h: .9, y: vy, ry: -Math.PI * .85 });
      putModel(M, 'lowTable', root, x - .65, vz, { len: .7, y: vy }); putModel(M, 'standLamp', root, x - 2.5, vz - .35, { h: 1.5, y: vy }); }
    { const [jx, jz] = W(9, 0);
      // Pak Mat's boat: upturned on the sand until Bab 3 repairs it, then afloat by the jetty in its new colour
      const pm = flags.boatFixed ? (putModel(M, 'fboat', root, jx + 6.3, jz + 2.4, { len: 4.4, ry: Math.PI + .35, y: -.7 }) || putModel(M, 'rowboat', root, jx + 6.2, jz + 2.6, { len: 3.8, ry: .4, y: -.25 })) : (() => { const [bx, bz] = W(7.3, 3.9); const b = putModel(M, 'rowboat', root, bx, bz, { len: 3.4, ry: .15, y: .62 }); if (b) b.rotation.z = Math.PI; return b; })();
      if (pm) { putModel(M, 'rowboat', root, jx - 2.3, jz + 1.4, { len: 3.4, ry: -.3, y: -.25 }); putModel(M, 'rowboat', root, jx + 7.8, jz + 6.2, { len: 3.2, ry: 1.2, y: -.25 }); } }
    // parked vehicles & props
    { let [x, z] = W(25.2, 18.5); putModel(M, 'suv', root, x, z, { len: 2.6, face: 'x' }); [x, z] = W(23.4, 18.5); putModel(M, 'delivery', root, x, z, { len: 2.8, face: 'x', ry: Math.PI });
      [x, z] = W(17.3, 11.9); putModel(M, 'bicycle', root, x, z, { len: 1.4, ry: 1.2 }); putModel(M, 'bicycle', root, x + .7, z + .5, { len: 1.4, ry: 1.4 });
      [x, z] = W(19.5, 18.6); for (let k = 0; k < 3; k++) putModel(M, 'cone', root, x + k * .7, z + .2, { h: .55 });
      [x, z] = W(21.6, 9.4); for (let k = 0; k < 3; k++) putModel(M, 'crate', root, x + (k % 2) * .5, z + k * .4, { h: .45, ry: k }); }
    const occ = (i, j) => (i >= 13.5 && i < 16.5) || (j >= 15.5 && j < 18.5 && i >= 3) || [[6, 7, 14, 15.5], [9, 19, 14, 27], [21, 23, 27, 30], [2, 8, 7, 16], [16, 4, 30, 15], [17, 18, 22, 23], [23, 18, 29, 22], [2, 19, 10, 30], [8, 0, 13, 5], [16, 4.5, 24.5, 9.2], [12, 5, 14, 8], [25, 10, 30, 15], [16, 24, 21, 29], [26, 21, 30, 25], [22, 18, 27, 19.5], [0, 15.5, 3, 19]].some(([a, b, c, d]) => i >= a && i < c && j >= b && j < d);
    for (let i = 0; i < N; i += 1) for (let j = 3; j < N; j += 1) {
      if (occ(i, j)) continue; const v = r(), [x, z] = W(i + .5, j + .5), jx = (r() - .5) * 1.2, jz = (r() - .5) * 1.2;
      const P = (key, o) => putModel(M, key, root, x + jx, z + jz, { ry: r() * 6.3, ...o });
      if (j < 5) { if (v < .45) { if (!P('palm' + (1 + Math.floor(r() * 4)), { h: 5.5 + r() * 2.5 })) palm(K, x + jx, z + jz, .9 + r() * .4, r); } else if (v < .55) P('rock' + (1 + Math.floor(r() * 2)), { h: .5 + r() * .4 }); }
      else if (v < .06) { if (!P('palm' + (1 + Math.floor(r() * 4)), { h: 5.5 + r() * 2.5 })) palm(K, x + jx, z + jz, .9 + r() * .4, r); }
      else if (v < .11) { if (!P(['tree1', 'tree2', 'tree4', 'ktree', 'ftree1', 'ftree2', 'ftree3', 'ftree4'][Math.floor(r() * 8)], { h: 3.6 + r() * 1.8 })) roundTree(K, x + jx, z + jz, .8 + r() * .35, r, r() > .6); }
      else if (v < .2) { if (!P(['bush1', 'berry1', 'plant5', 'fbush1', 'fbush2', 'fbush3', 'fbush4', 'fbush5'][Math.floor(r() * 8)], { h: .8 + r() * .5 })) bush(K, x + jx, z + jz, r); }
      else if (v < .34) P(['fgrass1', 'fgrass2', 'fgrass3', 'fgrass4', 'flowers', 'grass1'][Math.floor(r() * 6)], { h: .4 + r() * .35 });
      else if (v < .355) P(['frock1', 'frock2', 'frock3'][Math.floor(r() * 3)], { h: .35 + r() * .3 });
      else if (v < .32) P(['stump', 'rockm', 'frock2'][Math.floor(r() * 3)], { h: .45 });
    }
    // ---- Jambatan Angkat (Kuala Terengganu Drawbridge): four tall towers in pairs joined by skybridges, bascule span over the river mouth
    { const cream = K.vc(0xf1ead9), gold = K.vc(0xd4a437), teal = K.vc(0x2c8c99), glass = towerGlass, deckM = K.vc(0xd9d3c4), asp = K.vc(0x4f5359), pierM = K.vc(0xb9b4a8);
      const g = K.group(0, 0, 0, root), z = BR.z, y = BR.y, hw = BR.w / 2;
      const ramp = (x0, x1, y0, y1) => { const L = Math.hypot(x1 - x0, y1 - y0), a = Math.atan2(y1 - y0, x1 - x0); for (const [m, h, w, dy] of [[deckM, .35, BR.w + .4, -.2], [asp, .06, BR.w, 0]]) { const b = K.box(L, h, w, m, (x0 + x1) / 2, (y0 + y1) / 2 + dy, z, g); b.rotation.z = a; } };
      ramp(46.5, 53, 0, y); ramp(53, 56.6, y, y); ramp(59.4, 63, y, y); ramp(63, 69.5, y, 0);
      for (const [x0, x1] of [[53, 56.6], [59.4, 63]]) for (const zz of [z - hw - .15, z + hw + .15]) K.box(x1 - x0, .5, .08, K.vc(0xe9e4d6), (x0 + x1) / 2, y + .3, zz, g);
      for (let x = 48; x <= 68; x += 2.5) if (x < 56.4 || x > 59.6) K.cyl(.35, .4, y + .6, pierM, x, (y - .6) / 2, z, g, 10);
      for (const tx of [55.6, 60.4]) {
        K.box(2.2, .8, BR.w + 3.8, pierM, tx, .2, z, g); // pier
        for (const sz of [-1, 1]) { const zz = z + sz * (hw + .95);
          K.box(1.5, 12, 1.5, cream, tx, 6, zz, g); K.box(1.56, 11, .02, glass, tx, 6.4, zz + .76, g, false); K.box(1.56, 11, .02, glass, tx, 6.4, zz - .76, g, false); K.box(.02, 11, 1.56, glass, tx + .76, 6.4, zz, g, false); K.box(.02, 11, 1.56, glass, tx - .76, 6.4, zz, g, false);
          for (const hy of [.4, 4, 8, 12]) K.box(1.66, .18, 1.66, gold, tx, hy, zz, g);
          const roof = K.add(new T.ConeGeometry(1.25, 2.4, 4), teal, tx, 13.3, zz, g); roof.rotation.y = Math.PI / 4;
          K.cyl(.05, .05, 1.4, gold, tx, 15.1, zz, g, 6); K.ball(.14, gold, tx, 15.85, zz, g, 1); }
        K.box(1.1, 1, BR.w + 2.2, glass, tx, 10.8, z, g); K.box(1.2, .14, BR.w + 2.3, gold, tx, 10.25, z, g); K.box(1.2, .14, BR.w + 2.3, gold, tx, 11.35, z, g); // skybridge
      }
      place('jambatan', 'Jambatan Angkat', g); }
    // ---- Pantai Miami: beach, wakaf, umbrellas, sign, keropok lekor stall, palms; city towers across the river
    { const [sx, sz] = W(36.5, 7.2); place('lekor', 'Keropok Lekor Kak Long', warung(K, X, sx, sz, M)); }
    for (let k = 0; k < 9; k++) { const x = 31.5 + k * 2.6 + (r() - .5), z = -12.2 - r() * 1.4; if ((x > 34.5 && x < 38.5) || (x > 39.5 && x < 47)) continue; if (!putModel(M, 'palm' + (1 + k % 4), root, x, z, { h: 6 + r() * 2.5, ry: r() * 6 })) palm(K, x, z, 1, r); }
    for (const [x, z] of [[33, -15.5], [37.5, -16.2], [52.8, -18]]) { const wk = K.group(x, 0, z, root); for (const [px, pz] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) K.cyl(.09, .09, 2.1, K.vc(0x7a4a2a), px, 1.05, pz, wk, 6); K.box(2.6, .12, 2.6, K.vc(0x9a6b44), 0, .5, 0, wk); const rf = K.add(new T.ConeGeometry(2.3, 1.2, 4), K.vc(0x9d3b2c), 0, 2.6, 0, wk); rf.rotation.y = Math.PI / 4; }
    for (let k = 0; k < 7; k++) { const x = [32, 35, 38, 50.5, 53.5, 33.5, 36.5][k] + (r() - .5), z = k > 4 ? -22.5 : -19 - r() * 2.5, col = [0xe74c3c, 0xf1c40f, 0x2e86de, 0x27ae60, 0xff7a1a, 0x9b59b6, 0xecf0f1][k];
      K.cyl(.04, .04, 1.9, K.vc(0xdddddd), x, .95, z, root, 6); const um = K.add(new T.ConeGeometry(1.1, .45, 8), K.vc(col), x, 2, z, root); um.castShadow = true;
      const tw = K.box(.6, .04, 1.4, K.vc([0xffffff, 0xe8a0a8, 0x8fb4e3][k % 3]), x + .9, .03, z + .2, root, false); tw.rotation.y = r(); }
    { const sg = new T.Group(); sg.position.set(36.6, 0, -12.6); sg.rotation.y = Math.PI / 4; root.add(sg);
      const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#ffffff'; x.font = '900 92px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.strokeStyle = '#1f6f9c'; x.lineWidth = 14; x.strokeText('PANTAI MIAMI', 256, 66); x.fillText('PANTAI MIAMI', 256, 66);
      const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; const m = new T.Mesh(new T.PlaneGeometry(6, 1.5), new T.MeshBasicMaterial({ map: t, transparent: true, side: T.DoubleSide })); m.position.y = 1.4; m.userData.noBake = true; sg.add(m);
      for (const px of [-2.6, 2.6]) K.box(.12, 1.2, .12, K.vc(0x555555), px, .6, 0, sg); }
    // ---- activities: night market, futsal court, drag strip, beach volleyball, photo booth
    { const g = K.group(34.2, 0, -2.6, root); const cols = [0xc0392b, 0x2e86de, 0x27ae60, 0xf39c12];
      K.box(6.4, .03, 6.6, K.vc(0x55565c), 0, .03, 0, g, false);
      for (let k = 0; k < 4; k++) { const sx = -2.2 + (k % 2) * 4.4 * .5 * 2 - (k % 2) * 2.2, sz = -2 + Math.floor(k / 2) * 4; const s2 = K.group(k % 2 ? 1.6 : -1.6, 0, sz, g);
        for (const [px, pz] of [[-1, -.7], [1, -.7], [-1, .7], [1, .7]]) K.cyl(.04, .04, 2, K.vc(0xdddddd), px, 1, pz, s2, 6);
        const rf = K.add(new T.ConeGeometry(1.6, .7, 4), K.vc(cols[k]), 0, 2.3, 0, s2); rf.rotation.y = Math.PI / 4; K.box(2, .7, .6, K.vc(0x6d4c41), 0, .35, .5, s2); K.box(2.1, .05, .7, K.vc(0xf3eee2), 0, .72, .5, s2);
        for (let i = 0; i < 3; i++) K.box(.3, .2, .3, K.vc([0xe67e22, 0xf1c40f, 0xe74c3c][i]), -.6 + i * .6, .85, .5, s2); }
      for (let i = 0; i < 16; i++) K.ball(.07, glowMat, -3 + i * .4, 2.6 + Math.sin(i / 15 * Math.PI) * -.3, 0, g);
      const sg = K.box(3.2, .6, .1, K.vc(0x8e44ad), 0, 3.1, 0, g); place('pasar', 'Pasar Malam', g); }
    { const g = K.group(48.5, 0, -2, root); K.box(10, .06, 6.2, K.vc(0x2c6fb0), 0, .04, 0, g, false); K.box(10.6, .05, 6.8, K.vc(0xe67e22), 0, .02, 0, g, false);
      K.box(.06, .01, 6.2, K.vc(0xffffff), 0, .075, 0, g, false); for (const sx of [-1, 1]) { K.box(.06, .01, 6.2, K.vc(0xffffff), sx * 4.98, .075, 0, g, false); K.box(.25, 1, 1.6, K.vc(0xffffff), sx * 5.05, .5, 0, g); }
      for (const sx of [-1, 1]) for (const zz of [-3.4, 3.4]) K.box(10.6, 1.2, .05, K.vc(0x7f8c8d), 0, .6, zz, g, false);
      for (const [x, z] of [[-5.4, -3.4], [5.4, -3.4], [-5.4, 3.4], [5.4, 3.4]]) { K.cyl(.08, .08, 5, K.vc(0x95a5a6), x, 2.5, z, g, 6); K.box(.8, .2, .4, glowMat, x, 5, z, g); }
      place('futsal', 'Gelanggang Futsal', g); }
    { const g = K.group(53, 0, 64.6, root); K.box(26, .05, 5.2, K.vc(0x3b3e44), 0, .03, 0, g, false); K.box(26, .01, .12, K.vc(0xffffff), 0, .06, 0, g, false);
      for (let x = -13; x < 13; x += 1) for (const zz of [-2.75, 2.75]) K.box(.95, .5, .3, K.vc(Math.round(x) % 2 ? 0xd9d9d9 : 0xc0392b), x + .5, .25, zz, g);
      for (const xx of [-11.5, 11.5]) { K.box(.3, 3.4, .3, K.vc(0x444444), xx, 1.7, -2.8, g); K.box(.3, 3.4, .3, K.vc(0x444444), xx, 1.7, 2.8, g); K.box(.3, .7, 5.9, K.vc(xx < 0 ? 0x27ae60 : 0xc0392b), xx, 3.4, 0, g); }
      for (let k = 0; k < 6; k++) K.box(.12, .02, .5, K.vc(k % 2 ? 0x111111 : 0xffffff), 11.5, .065, -2 + k * .8, g, false);
      for (let r2 = 0; r2 < 3; r2++) K.box(10, .4 + r2 * .5, .8, K.vc(0x9aa4ad), -4, (.4 + r2 * .5) / 2, 3.8 + r2 * .8, g);
      if (!putModel(M, 'hatch', g, -9.5, -1.2, { len: 3.4, ry: -Math.PI / 2, tint: 0xf1c40f })) K.box(3, 1, 1.5, K.vc(0xf1c40f), -9.5, .5, -1.2, g);
      if (!putModel(M, 'sedan', g, -9.5, 1.2, { len: 3.4, ry: -Math.PI / 2, tint: 0xc0392b })) K.box(3, 1, 1.5, K.vc(0xc0392b), -9.5, .5, 1.2, g);
      place('drag', 'Litar Drag 402m', g); }
    { const g = K.group(44, 0, -21, root); const tape = K.vc(0x1f6fd1); for (const zz of [-2.5, 2.5]) K.box(8, .02, .08, tape, 0, .03, zz, g, false); for (const xx of [-4, 4]) K.box(.08, .02, 5, tape, xx, .03, 0, g, false);
      for (const zz of [-2.9, 2.9]) K.cyl(.05, .05, 2.4, K.vc(0xdddddd), 0, 1.2, zz, g, 6); K.box(.04, .8, 5.8, K.vc(0x222222), 0, 1.9, 0, g); K.box(.05, .08, 5.8, K.vc(0xffffff), 0, 2.3, 0, g);
      K.ball(.16, K.vc(0xffd452), -1.8, .16, .6, g); place('volley', 'Bola Tampar Pantai', g); }
    { const g = K.group(51.6, 0, -13.2, root); g.rotation.y = -Math.PI / 2; const fr = K.vc(0xd35400);
      for (const sx of [-1.1, 1.1]) K.box(.2, 2.6, .2, fr, sx, 1.3, 0, g); K.box(2.6, .45, .22, fr, 0, 2.7, 0, g); K.box(2.2, .06, 1.2, K.vc(0xf3eee2), 0, .03, .6, g, false);
      K.cyl(.03, .03, 1.4, K.vc(0x222222), 0, .7, 2.2, g, 6); K.box(.3, .2, .2, K.vc(0x111111), 0, 1.5, 2.2, g);
      place('photo', 'Booth Foto Jambatan Angkat', g); }
    // ================= BANDAR BARU =================  (the iso camera sees the +x and +z faces, so fronts face +z)
    const P = (key, x, z, o = {}) => putModel(M, key, root, x, z, o);
    // ---- Damai City Mall (north of the avenue, facade on z = 41.8)
    { const g = K.group(18, 0, 36.8, root); const wall = K.vc(0xefe9dd), trim = K.vc(0x8e44ad);
      K.box(24, 8, 10, wall, 0, 4, 0, g); K.box(24.6, .5, 10.6, trim, 0, 8.25, 0, g); K.box(8, 3, 7, K.vc(0xdcd6c8), -6, 9.5, -1, g); K.box(8.4, .35, 7.4, trim, -6, 11.1, -1, g);
      for (let k = 0; k < 2; k++) K.box(22, 2.6, .12, mallGlass, 0, 2 + k * 3.4, 5.02, g, false);
      for (let x = -10.5; x <= 10.5; x += 3) K.box(.25, 7.6, .3, K.vc(0xd0c9bb), x, 3.8, 5.1, g);
      K.box(.12, 6, 9, mallGlass, 12.02, 4, 0, g, false);
      K.box(7, .35, 2.6, K.vc(0xffffff), 0, 3.4, 6.3, g); for (const x of [-3.2, 3.2]) K.cyl(.14, .14, 3.3, K.vc(0xbdc3c7), x, 1.65, 7.4, g, 8);
      K.box(4, 2.6, .1, K.vc(0x1e272e), 0, 1.3, 5.1, g, false);
      for (let i = 0; i < 6; i++) { K.box(.03, 1, .7, K.vc([0xe74c3c, 0x2e86de, 0xf1c40f][i % 3]), -10 + i * 4, 9.5, 5.4, g); K.cyl(.04, .04, 2, K.vc(0xdddddd), -10 + i * 4 - .02, 9, 5.4, g, 6); }
      const sg = textPanel('DAMAI CITY MALL', 13, 2, '#8e44ad', true); sg.position.set(18, 7, 42.05); root.add(sg); mallSign = sg.material;
      const cin = textPanel('PAWAGAM · CINEMA', 6, .9, '#2d3436', true); cin.position.set(12, 10.1, 39.3); root.add(cin);
      place('mall', 'Damai City Mall', g); }
    P('pretty/Fountain', 9, 43, { h: 1.5 }); for (const x of [6.5, 13.5, 22.5, 29.5]) P('city/Planter', x, 43.2, { len: 1.8 }); for (const x of [26]) P('city/Bench', x, 43.1, { len: 1.6 });
    // car park south of the avenue
    { const cars = ['city/Car', 'city/Van', 'sedan', 'taxi', 'suv', 'hatch', 'city/Car', 'police']; for (let k = 0; k < 14; k++) { if (r() < .25) continue; const row = k < 7 ? 0 : 1, x = 8.4 + (k % 7) * 2.75 + .4, z = row ? 57.4 : 51.6; P(cars[k % cars.length], x, z, { len: 2.3, ry: row ? Math.PI : 0 }); }
      for (const x of [6.5, 18, 29.5]) { if (!P('lamp', x, 54.5, { h: 3.4 })) K.cyl(.06, .06, 3, K.vc(0x777777), x, 1.5, 54.5, root, 6); }
      const pk = textPanel('P  PARKING', 2.6, .7, '#2e86de'); pk.position.set(5.5, 2.2, 49.6); root.add(pk); K.cyl(.05, .05, 2, K.vc(0x777777), 5.5, 1, 49.5, root, 6); }
    // ---- Taman Rekreasi (park & playground), south of the avenue
    { const g = K.group(-17, 0, 55, root); K.box(22, .04, 11, K.vc(0x7cc35a), 0, .02, 0, g, false);
      const pond = K.add(new T.CircleGeometry(2.6, 28), new T.MeshStandardMaterial({ color: 0x3fa7d0, roughness: .2 }), -6.5, .05, 1.5, g, false); pond.rotation.x = -Math.PI / 2;
      P('park/pond_ducks', -23.5, 56.5, { len: 5 });
      for (const [k, x, z, o, h] of [['park/slide', -11, 51.6, {}, 2.2], ['park/swing_set', -14.6, 51.6, {}, 2.4], ['park/seesaw', -12, 57.6, { ry: .5 }, 1], ['park/merry_go_round', -15.8, 57.8, {}, 1.1], ['park/climbing_frame', -19, 51.8, {}, 2], ['park/spring_rider', -9, 56, {}, 1], ['park/sandbox', -9.5, 52.4, {}, .5], ['park/gazebo', -26.4, 58.4, { ry: .4 }, 3.4], ['park/picnic_table', -21, 58.8, {}, .9], ['park/ice_cream_cart', -7.4, 58.6, {}, 1.4], ['park/park_sign', -6.6, 50, {}, 1.4], ['park/fountain', -19.5, 55.4, {}, 1.4]])
        if (!P(k, x, z, { h, ...o })) K.box(1, h, 1, K.vc(0xe67e22), x, h / 2, z, root);
      for (const [x, z] of [[-27, 50.5], [-27, 54], [-6.8, 53.6], [-14, 60], [-24, 60.2]]) P('pretty/TreeLarge', x, z, { h: 4.5 + r() * 1.5, ry: r() * 6 }) || palm(K, x, z, 1, r);
      for (const [x, z] of [[-13, 54.2], [-22, 54.6]]) P('park/park_bench', x, z, { h: .9, ry: Math.PI / 2 }); for (const x of [-25, -17, -9]) P('park/park_lamp', x, 49.6, { h: 2.8 });
      place('taman', 'Taman Rekreasi', g); }
    // ---- Sekolah Kebangsaan Seri Damai, north of the avenue
    { const g = K.group(-17, 0, 37, root); K.box(22, .04, 12, K.vc(0x6fb34f), 0, .02, 0, g, false);
      if (!P('school/school_building', -21, 35.5, { len: 11 })) K.box(10, 4, 5, K.vc(0xf6e58d), -21, 2, 35.5, root);
      P('school/flagpole', -14.5, 41.6, { h: 4.5 }); P('school/school_bus', -26, 41.2, { len: 5, ry: Math.PI / 2 }); P('school/school_sign', -9.5, 42.6, { h: 1.6 });
      K.box(9, .03, 6, K.vc(0x58a83c), 5.5, .045, -1.5, g, false); for (const sx of [1, 10]) K.box(.12, 1.6, 2, K.vc(0xffffff), sx, .8, -1.5, g);
      const sch = textPanel('SEKOLAH KEBANGSAAN SERI DAMAI', 7, .8, '#1f6f9c'); sch.position.set(-21, 5.6, 39.2); root.add(sch);
      place('sekolah', 'Sekolah Kebangsaan Seri Damai', g); }
    // ---- Skate park
    { const g = K.group(50, 0, 37, root); K.box(9, .08, 9, K.vc(0xb2b7bd), 0, .04, 0, g, false);
      if (!P('skate/Kit', 50, 36, { len: 7.5 })) K.box(3, 1, 2, K.vc(0x95a5a6), -2, .5, 0, g);
      P('skate/Steps', 47, 40, { len: 2 }); P('skate/Platform', 53, 40.2, { len: 2.4 }); place('skate', 'Taman Luncur · Skate Park', g); }
    // ---- Taman Ria (fun fair) with a Ferris wheel, south of the avenue
    { const g = K.group(42, 0, 54.5, root); K.box(15, .05, 8, K.vc(0xe8d9b5), 0, .03, 0, g, false);
      if (!P('race/Ferris', 42, 55.5, { h: 12, ry: -Math.PI / 4 })) K.add(new T.TorusGeometry(5, .15, 6, 32), K.vc(0xe74c3c), 42, 6.2, 55.5, root);
      P('park/hot_dog_stand', 36.5, 57.6, { h: 2 }); P('park/ice_cream_cart', 47.5, 57.6, { h: 1.4 }); P('market/food_cart', 37.5, 51.6, { h: 1.6 });
      for (let i = 0; i < 10; i++) K.ball(.12, glowMat, 35.5 + i * 1.4, 3 + Math.sin(i / 9 * Math.PI) * .4, 58.4, root);
      place('taman_ria', 'Taman Ria · Roda Ferris', g); }
    // ---- shop lots, bus stop, traffic lights, street trees
    { [['city/BuildingRedCorner', 62.5], ['city/BuildingRed', 68], ['city/BuildingGreen', 73.4], ['city/BrownBuilding', 78.4]].forEach(([k, x]) => { if (!P(k, x, 38, { len: 5.4 })) K.box(5, 6, 5, K.vc(0xd35400), x, 3, 38, root); });
      P('city/BusStop', 22, 49.4, { len: 3 }); P('city/ATM', 60, 42.8, { h: 1.6 }); P('city/Billboard', 32, 39, { h: 5, ry: Math.PI * .75 });
      for (const [x, z, ry] of [[2.6, 43.4, 0], [-2.6, 48.6, Math.PI], [42.6, 43.4, 0], [37.4, 48.6, Math.PI]]) P('city/TrafficLight', x, z, { h: 3.6, ry });
      for (let x = -26; x < 80; x += 9) if (x < -4 || x > 34) P('city/Tree', x, 49.2, { h: 2.6 }); place('kedai_bandar', 'Deretan Kedai Bandar Baru', K.group(70, 3, 38, root)); }
    for (const [x, z, h, w] of [[66, 2, 9, 4], [71, 8, 13, 4.5], [65.5, 14, 7, 5], [72, 20, 11, 4], [66.5, 24, 6, 5], [73, -2, 8, 3.5]]) { const b = K.box(w, h, w, cityGlass, x, h / 2, z, root); b.userData.glowTex = true; K.box(w + .2, .3, w + .2, K.vc(0x8d99a6), x, h + .15, z, root); }
    for (let k = 0; k < 6; k++) { const x = 63 + r() * 14, z = -13 - r() * 9; if (!putModel(M, 'palm' + (1 + k % 4), root, x, z, { h: 6 + r() * 2, ry: r() * 6 })) palm(K, x, z, 1, r); }
    baked = bake(root, scene);
    for (const id of Object.keys(YARDS)) buildYard(id, flags.yardsCut.includes(id));
  }

  // ------------------------------------------------------------ people & traffic
  const kp = kit(scene);
  const npcs = {};
  for (const [id, n] of Object.entries(NPCS3D)) { const p = makePerson(kp, n.look); const [x, z] = W(n.i, n.j); p.g.position.set(x, 0, z); p.g.rotation.y = Math.PI * .25; p.g.userData.npc = id; scene.add(p.g); npcs[id] = p; }
  // Detailed NPC models (static GLB, not rigged) replace an NPC's simple figure once loaded, in the background.
  // The simple figure is only hidden, never removed: if loading fails it simply stays. Same group, so position,
  // visibility, tapping, markers and the hero's walk target are unchanged. Models face +Z like the simple figures.
  // abu stands at i 21.3 / j 26.4 (NPCS3D): his old spot (25.6 / 26.2) was hidden behind a tree from the village camera.
  const NPC_MODELS = { abu: { url: 'assets/characters/pok_ajis/PokAjis.glb', h: 1.6 } }; // Pok Ajis
  const later = (f) => (window.requestIdleCallback ? requestIdleCallback(f, { timeout: 2500 }) : setTimeout(f, 1200));
  for (const [id, spec] of Object.entries(NPC_MODELS)) later(() => loadGLB(spec.url).then((src) => {
    const p = npcs[id]; if (!src || !p || p.model) return;
    const m = src.clone(true); m.scale.setScalar(spec.h / Math.max(.01, src.userData.size.y));
    for (const c of p.body.children) c.visible = false;
    p.body.add(m); p.model = m; // inside body: keeps the gentle idle bob; no skeletal animation is invented
  }));
  const rnd = mulberry32(5);
  const walkers = VILLAGERS.map((look, k) => { const p = makePerson(kp, look); scene.add(p.g); return { p, axis: k % 2 ? 'i' : 'j', lane: k % 2 ? (k % 4 === 1 ? 15.75 : 18.35) : (k % 4 === 0 ? 13.7 : 16.3), pos: 6 + rnd() * 20, dir: rnd() > .5 ? 1 : -1, speed: .35 + rnd() * .2, pause: 0, id: 'villager' + k }; });
  const traffic = (key, fallbackCol, police) => { const tmp = new T.Group(); const m = putModel(M, key, tmp, 0, 0, { len: 2.5, face: 'x' }); if (m) { tmp.remove(m); return m; } return carModel(kp, fallbackCol, police); };
  const cars = [{ m: traffic('sedan', 0x2e86de), lane: 14.55, pos: 6, dir: 1 }, { m: traffic('police', 0xffffff, true), lane: 15.45, pos: 20, dir: -1 }, { m: traffic('taxi', 0xf1c40f), lane: 16.55, pos: 25, dir: 1, axis: 'i' }, { m: traffic('van', 0xecf0f1), lane: 17.45, pos: 12, dir: -1, axis: 'i' }, { m: traffic('wagon', 0x27ae60), lane: 14.55, pos: 22, dir: 1 }];
  for (const c of cars) scene.add(c.m);
  // TYRANZ bus on the main road (stops at the bus shelter) and an airliner overhead now and then
  { const tmp = new T.Group(); const b = putModel(M, 'bus', tmp, 0, 0, { len: 5.2, face: 'x' }); if (b) { tmp.remove(b); cars.push({ m: b, lane: 17.45, pos: 27, dir: -1, axis: 'i', bus: true, wait: 0 }); scene.add(b); } }
  // Bandar Baru people (animated Kenney mini characters) and animals around the map
  const life = [];
  { const CH = ['chars/male-a', 'chars/female-a', 'chars/male-c', 'chars/female-c', 'chars/male-e', 'chars/female-e'];
    const paths = [[[4, 43.7], [31, 43.7]], [[31, 48.7], [-28, 48.7]], [[-27, 49.6], [-27, 60], [-7, 60], [-7, 49.6]], [[46, 32.5], [46, 42.6], [55, 42.6], [55, 32.5]], [[33.5, 50], [50, 50]], [[60, 43.6], [79, 43.6]]];
    for (let k = 0; k < 10; k++) { const path = paths[k % paths.length], a = putAnimated(M, CH[k % CH.length], scene, path[0][0], path[0][1], { h: 1.55, anim: 'walk' }); if (!a) break;
      life.push({ a, path, seg: 0, f: (k * .37) % 1, speed: 1.1 + (k % 3) * .2, kind: 'walker' }); }
    const emp = putAnimated(M, 'shop/character-employee', scene, 19.8, 42.6, { h: 1.55, anim: 'idle' }); if (emp) life.push({ a: emp, kind: 'idle' });
    const ani = (key, x, z, h, wander, ry = 0) => { const o = putModel(M, key, scene, x, z, { h, ry }); if (o) life.push({ o, home: [x, z], wander, kind: 'animal', t: Math.random() * 5, tgt: [x, z] }); return o; };
    const [ax, az] = W(12.6, 10.4); for (let k = 0; k < 4; k++) ani('animals/Chicken', ax + 2 + k * .8, az + 3 + (k % 2), .45, 2.2);
    const [wx, wz] = W(19.4, 12); ani('animals/Cat', wx + 2.2, wz + 2.4, .35, 1.2); ani('animals/Cat', -2.5, 26, .35, 1.5); ani('animals/Dog', 4, 18, .55, 2.5);
    for (let k = 0; k < 3; k++) ani('animals/Duck', -23.5 + (k - 1) * .9, 56.5 + (k % 2) * .6, .4, 1.4);
    ani('animals/Crab', 40, -21.5, .3, 2); ani('animals/Crab', 46, -22.8, .3, 2); ani('animals/Turtle', 34.5, -23.2, .45, .8, 2.4);
    ani('animals/Goat', -24, 29.4, .9, 1.6); ani('animals/Goat', -21.5, 29.6, .8, 1.6);
    ani('animals/Rabbit', -12, 58.5, .35, 2); ani('animals/Bird', -18, 52, .3, 1.5); }
  function updateLife(dt) {
    for (const L of life) {
      if (L.kind === 'walker') { const P0 = L.path[L.seg], P1 = L.path[(L.seg + 1) % L.path.length], dx = P1[0] - P0[0], dz = P1[1] - P0[1], len = Math.hypot(dx, dz) || 1;
        L.f += L.speed * dt / len; if (L.f >= 1) { L.f = 0; L.seg = (L.seg + 1) % L.path.length; if (L.path.length === 2 && L.seg === 1) { L.path = [L.path[1], L.path[0]]; L.seg = 0; } }
        L.a.obj.position.set(P0[0] + dx * L.f, 0, P0[1] + dz * L.f); L.a.obj.rotation.y = Math.atan2(dx, dz); L.a.update(dt); }
      else if (L.kind === 'idle') L.a.update(dt);
      else { L.t -= dt; const o = L.o; if (L.t <= 0) { L.t = 1.5 + Math.random() * 3; L.tgt = [L.home[0] + (Math.random() - .5) * 2 * L.wander, L.home[1] + (Math.random() - .5) * 2 * L.wander]; }
        const dx = L.tgt[0] - o.position.x, dz = L.tgt[1] - o.position.z, d = Math.hypot(dx, dz);
        if (d > .05) { const st = Math.min(d, dt * .8); o.position.x += dx / d * st; o.position.z += dz / d * st; o.rotation.y = Math.atan2(dx, dz); o.position.y = Math.abs(Math.sin(performance.now() / 90)) * .03; } else o.position.y = 0; }
    }
  }
  const plane = putModel(M, 'airliner', scene, 0, -500, { len: 20, y: 38 }); let planeT = 12, planeF = -1;
  // drawbridge leaves (animated), a boat that sails under when it opens, and wau kites over Pantai Miami
  const leafM = new T.MeshStandardMaterial({ color: 0xd9d3c4, roughness: .8 }), leafRoad = new T.MeshStandardMaterial({ color: 0x4f5359, roughness: .9 });
  const leaves = [[56.6, 1], [59.4, -1]].map(([hx, dir]) => { const p = new T.Group(); p.position.set(hx, BR.y, BR.z); scene.add(p);
    const a = new T.Mesh(new T.BoxGeometry(1.4, .35, BR.w + .4), leafM); a.position.set(dir * .7, -.2, 0); a.castShadow = true; p.add(a);
    const b = new T.Mesh(new T.BoxGeometry(1.4, .06, BR.w), leafRoad); b.position.set(dir * .7, 0, 0); p.add(b);
    for (const zz of [-BR.w / 2 - .15, BR.w / 2 + .15]) { const rl = new T.Mesh(new T.BoxGeometry(1.4, .5, .08), leafM); rl.position.set(dir * .7, .3, zz); p.add(rl); }
    return { p, dir }; });
  const riverBoat = (() => { const tmp = new T.Group(); const m = putModel(M, 'fboat', tmp, 0, 0, { len: 4.2, y: -.6 }) || putModel(M, 'rowboat', tmp, 0, 0, { len: 3.4, y: -.2 }); if (m) { tmp.remove(m); scene.add(m); m.visible = false; } return m; })();
  const bridge = { st: 'down', k: 0, t: 25, boatZ: 0, cb: null };
  function openBridge(cb) { if (bridge.st === 'down') { bridge.st = 'opening'; bridge.cb = cb || null; } else if (cb) bridge.cb = cb; }
  const waus = [[38, -25, 11, 0xe74c3c], [45, -27, 13, 0xf1c40f], [50, -24, 9.5, 0x27ae60]].map(([x, z, h, col]) => { const g = new T.Group(); g.position.set(x, h, z); scene.add(g);
    const shp = new T.Shape(); shp.moveTo(0, 1.1); shp.quadraticCurveTo(1.6, .6, 1.4, -.1); shp.quadraticCurveTo(.6, .15, .25, -.35); shp.lineTo(.6, -1.1); shp.quadraticCurveTo(0, -.75, -.6, -1.1); shp.lineTo(-.25, -.35); shp.quadraticCurveTo(-.6, .15, -1.4, -.1); shp.quadraticCurveTo(-1.6, .6, 0, 1.1);
    const m = new T.Mesh(new T.ShapeGeometry(shp), new T.MeshStandardMaterial({ color: col, side: T.DoubleSide, roughness: .6 })); m.rotation.y = Math.PI / 4; g.add(m);
    const lg = new T.BufferGeometry().setFromPoints([new T.Vector3(0, 0, 0), new T.Vector3(-3, -h + .8, 11)]); g.add(new T.Line(lg, new T.LineBasicMaterial({ color: 0x555555 }))); return { g, h, ph: x }; });
  // the player (TYRANZ hero) waits beside the current mission
  const hero = (() => { const tmp = new T.Group(); const m = putModel(M, 'hero', tmp, 0, 0, { h: 1.5 }); if (!m) return null; tmp.remove(m); scene.add(m); m.visible = false; return m; })();
  let heroGoal = null, heroWalk = 0;
  function heroSpot() {
    const id = hooks.heroAt && hooks.heroAt(); if (!id) return null;
    if (npcs[id] && npcs[id].g.visible !== false) { const p = npcs[id].g.position; return new T.Vector3(p.x + 1.15, 0, p.z + 1.15); }
    const o = objects[id]; if (o) { const c = o.box.getCenter(new T.Vector3()); return new T.Vector3(c.x + .8, 0, o.box.max.z + .9); }
    const a = anchorWorld(id); return a ? new T.Vector3(a.x + 1.6, 0, a.z + 1.6) : null;
  }

  // ------------------------------------------------------------ camera & input
  const cam = new T.OrthographicCamera(-10, 10, 10, -10, -200, 400);
  const ISO = new T.Vector3(1, 1.25, 1).normalize(), target = new T.Vector3();
  let zoom = isTouch ? .95 : 1.15, goal = null;
  const view = { get z() { return zoom; } };
  let cw = 0, ch = 0;
  // shortcut: one-time check, slow phones drop to 1x pixels; upgrade to continuous quality tiers if needed
  let maxDpr = isTouch ? 1.75 : 2; const perf = { t: 0, n: 0, done: !isTouch };
  function checkPerf(dt) { if (perf.done || t < 3) return; perf.t += dt; perf.n++; if (perf.t < 4) return; perf.done = true;
    if (perf.t / perf.n > 1 / 35 && maxDpr > 1) { maxDpr = 1; resize(); } } // under ~35 fps: render fewer pixels
  function resize() { cw = canvas.clientWidth; ch = canvas.clientHeight; renderer.setPixelRatio(Math.min(devicePixelRatio || 1, maxDpr)); renderer.setSize(cw, ch, false); }
  addEventListener('resize', resize); resize();
  const VIEW_H = 26; // world units visible vertically at zoom 1
  function updateCam() {
    const hh = VIEW_H / 2 / zoom, hw = hh * cw / Math.max(1, ch);
    Object.assign(cam, { left: -hw, right: hw, top: hh, bottom: -hh }); cam.updateProjectionMatrix();
    cam.position.copy(target).addScaledVector(ISO, 120); cam.lookAt(target);
    sun.position.copy(target).add(new T.Vector3(-25, 50, 18)); sun.target.position.copy(target);
  }
  const clampT = () => { target.x = clamp(target.x, -30, 74); target.z = clamp(target.z, -30, 70); zoom = clamp(zoom, .45, 2.6); };
  const right = new T.Vector3(1, 0, -1).normalize(), fwd = new T.Vector3(-1, 0, -1).normalize(), pitch = Math.asin(ISO.y);
  function panBy(dx, dy) { const wpp = VIEW_H / zoom / ch; target.addScaledVector(right, -dx * wpp).addScaledVector(fwd, dy * wpp / Math.sin(pitch)); clampT(); }
  const pointers = new Map(); let pinch = null, downInfo = null;
  canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY }); goal = null;
    if (pointers.size === 1) downInfo = { x: e.offsetX, y: e.offsetY, t: performance.now(), moved: 0 };
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: zoom, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; downInfo = null; } });
  canvas.addEventListener('pointermove', (e) => { const p = pointers.get(e.pointerId); if (!p) return; const dx = e.offsetX - p.x, dy = e.offsetY - p.y; p.x = e.offsetX; p.y = e.offsetY;
    if (pointers.size === 2 && pinch) { const [a, b] = [...pointers.values()]; zoom = pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, pinch.d); clampT();
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2; panBy(mx - pinch.mx, my - pinch.my); pinch.mx = mx; pinch.my = my; return; } // two-finger drag also pans (follows the midpoint)
    if (downInfo) downInfo.moved += Math.abs(dx) + Math.abs(dy); panBy(dx, dy); });
  const up = (e) => { if (!pointers.has(e.pointerId)) return; pointers.delete(e.pointerId); if (pointers.size < 2) pinch = null;
    if (downInfo && pointers.size === 0 && downInfo.moved < 10 && performance.now() - downInfo.t < 600) tap(e.offsetX, e.offsetY); if (pointers.size === 0) downInfo = null; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoom *= Math.exp(-e.deltaY * .0015); clampT(); goal = null; }, { passive: false });
  const rc = new T.Raycaster(), ndc = new T.Vector2(), gp = new T.Plane(new T.Vector3(0, 1, 0), 0), hp = new T.Vector3();
  function tap(sx, sy) {
    ndc.set(sx / cw * 2 - 1, -(sy / ch) * 2 + 1); rc.setFromCamera(ndc, cam);
    const people = [...Object.values(npcs).filter(p => p.g.visible).map(p => p.g), ...walkers.map(w => w.p.g)];
    let hit = rc.intersectObjects(people, true)[0];
    if (hit) { let o = hit.object; while (o && !o.userData.npc && !o.userData.walker) o = o.parent; if (o && o.userData.npc && hooks.npcVisible(o.userData.npc)) return hooks.onTap({ type: 'npc', id: o.userData.npc }); if (o && o.userData.walker) if (o) return hooks.onTap({ type: 'villager', id: o.userData.walker }); }
    // forgiving NPC pick: nearest NPC on the ground within 1.4 units
    if (rc.ray.intersectPlane(gp, hp)) { let best = null, bd = 1.4; for (const [id, p] of Object.entries(npcs)) { const d = Math.hypot(hp.x - p.g.position.x, hp.z - p.g.position.z); if (d < bd && hooks.npcVisible(id)) { bd = d; best = id; } } if (best) return hooks.onTap({ type: 'npc', id: best }); }
    hit = rc.intersectObjects(pickBoxes, false)[0];
    if (hit) return hooks.onTap({ type: 'place', id: hit.object.userData.id });
    if (rc.ray.intersectPlane(gp, hp)) { const ti = hp.x / TS + N / 2, tj = hp.z / TS + N / 2; for (const [id, a] of Object.entries(AREAS)) if (ti >= a.i0 && ti < a.i1 && tj >= a.j0 && tj < a.j1) return hooks.onTap({ type: 'place', id }); }
    hooks.onTap(null);
  }
  walkers.forEach(w => { w.p.g.userData.walker = w.id; });

  // ------------------------------------------------------------ labels & markers (DOM, crisp on every screen)
  const layer = document.getElementById('labels');
  const els = new Map();
  function el(key, cls, html) { let e = els.get(key); if (!e) { e = document.createElement('div'); layer.append(e); els.set(key, e); } if (e._c !== cls) { e.className = cls; e._c = cls; } if (e._h !== html) { e.innerHTML = html; e._h = html; } e._seen = true; return e; }
  const v3 = new T.Vector3();
  function anchorWorld(id) {
    if (npcs[id]) return v3.copy(npcs[id].g.position).setY(2.1);
    if (AREAS[id]) { const a = AREAS[id], [x, z] = W((a.i0 + a.i1) / 2, (a.j0 + a.j1) / 2); return v3.set(x, .8, z); }
    const o = objects[id]; if (o) { o.box.getCenter(v3); v3.y = o.box.max.y + .3; return v3; }
    return null;
  }
  function toScreen(v) { const p = v.clone().project(cam); return { x: (p.x + 1) / 2 * cw, y: (1 - p.y) / 2 * ch, vis: p.z < 1 && p.x > -1.2 && p.x < 1.2 && p.y > -1.2 && p.y < 1.2 }; }
  function anchor(id) { const w = anchorWorld(id); return w ? toScreen(w) : null; }
  let pulseId = null, pulseT = 0; const hudRects = { t: 0, r: [], ox: 0, oy: 0 };
  function focus(id, z) { const w = anchorWorld(id); if (!w) return; goal = { x: w.x, z: w.z, zoom: z ? z * 1.1 : Math.max(zoom, 1.25) }; pulseId = id; pulseT = 3.5; }

  // ------------------------------------------------------------ day / night
  function timeOfDay() {
    const d = new Date(); let h = d.getHours() + d.getMinutes() / 60; if (hooks.flags().alwaysDay) h = 11;
    let night = 0, warm = 0;
    if (h >= 19.5 || h < 5.5) night = 1; else if (h >= 18.5) { night = h - 18.5; warm = 1 - night; } else if (h >= 17) warm = (h - 17) / 1.5; else if (h < 7) { night = 1 - (h - 5.5) / 1.5; warm = 1 - night; }
    return { h, night, warm };
  }
  const glowSprites = []; const glowTex = canvasTex(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,210,130,.9)'); g.addColorStop(1, 'rgba(255,210,130,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });
  function lampGlows() {
    for (const s of glowSprites) scene.remove(s); glowSprites.length = 0;
    for (const l of lamps) { l.updateMatrixWorld(true); const p = (l.userData.lampHead ? l.userData.lampHead.clone().divideScalar(l.scale.x) : new T.Vector3(0, 3.2, .8)).applyMatrix4(l.matrixWorld);
      const s = new T.Mesh(new T.PlaneGeometry(6, 6), new T.MeshBasicMaterial({ map: glowTex, transparent: true, blending: T.AdditiveBlending, depthWrite: false })); s.rotation.x = -Math.PI / 2; s.position.set(p.x, .06, p.z); scene.add(s); glowSprites.push(s); }
  }
  const DAYC = new T.Color(0xfdf6e8), WARMC = new T.Color(0xffc48a), NIGHTC = new T.Color(0x6f7fc0), tmpC = new T.Color();

  // ------------------------------------------------------------ frame
  let t = 0;
  function frame(dt) {
    t += dt;
    if (goal) { const k = Math.min(1, dt * 4); target.x = lerp(target.x, goal.x, k); target.z = lerp(target.z, goal.z, k); zoom = lerp(zoom, goal.zoom, k); if (Math.hypot(target.x - goal.x, target.z - goal.z) < .02) goal = null; }
    pulseT = Math.max(0, pulseT - dt);
    // people
    for (const [id, p] of Object.entries(npcs)) { p.g.visible = hooks.npcVisible(id); p.body.position.y = Math.abs(Math.sin(t * 2 + p.g.position.x)) * .03; p.arms[0].rotation.x = Math.sin(t * 1.6 + p.g.position.z) * .15; }
    for (const w of walkers) {
      if (w.pause > 0) { w.pause -= dt; w.p.legs.forEach(l => { l.rotation.x *= .8; }); }
      else { w.pos += w.dir * w.speed * dt; const [lo, hi] = w.axis === 'j' ? [6, 29] : [4, 29]; if (w.pos < lo || w.pos > hi) { w.dir *= -1; w.pos = clamp(w.pos, lo, hi); } if (rnd() < dt * .06) w.pause = 1 + rnd() * 3;
        const sw = Math.sin(t * 7 + w.lane) * .5; w.p.legs[0].rotation.x = sw; w.p.legs[1].rotation.x = -sw; w.p.arms[0].rotation.x = -sw * .7; w.p.arms[1].rotation.x = sw * .7; }
      const [x, z] = w.axis === 'j' ? W(w.lane, w.pos) : W(w.pos, w.lane); w.p.g.position.set(x, 0, z);
      w.p.g.rotation.y = w.axis === 'j' ? (w.dir > 0 ? 0 : Math.PI) : (w.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    }
    for (const c of cars) { if (c.bus) { const was = c.pos; if (c.wait > 0) c.wait -= dt; else c.pos += c.dir * 1.3 * dt; if (was > 18.6 && c.pos <= 18.6) c.wait = 4; } else c.pos += c.dir * 1.6 * dt; if (c.pos > 31) c.pos = 4; if (c.pos < 4) c.pos = 31;
      const [x, z] = c.axis === 'i' ? W(c.pos, c.lane) : W(c.lane, c.pos); c.m.position.set(x, 0, z); c.m.rotation.y = c.axis === 'i' ? (c.dir > 0 ? 0 : Math.PI) : (c.dir > 0 ? -Math.PI / 2 : Math.PI / 2); }
    if (hero) {
      if (!heroGoal || (t % 1 < dt)) heroGoal = heroSpot() || heroGoal;
      if (heroGoal) { if (!hero.visible) { hero.position.copy(heroGoal); hero.visible = true; }
        const d = heroGoal.clone().sub(hero.position); d.y = 0; const L = d.length();
        if (L > .05) { if (L > 25) hero.position.copy(heroGoal); else { hero.position.addScaledVector(d, Math.min(1, 4 * dt / L)); hero.rotation.y = Math.atan2(d.x, d.z); heroWalk += dt * 10; hero.position.y = Math.abs(Math.sin(heroWalk)) * .08; } }
        else { hero.position.y = 0; hero.rotation.y = lerp(hero.rotation.y, Math.PI / 4, Math.min(1, dt * 3)); hero.scale.y = hero.scale.x * (1 + Math.sin(t * 2.2) * .012); } }
    }
    // drawbridge cycle: open, a boat sails under, close (also on demand for the story)
    if (bridge.st === 'down' && (bridge.t -= dt) <= 0) bridge.st = 'opening';
    if (bridge.st === 'opening') { bridge.k = Math.min(1, bridge.k + dt / 3.5); if (bridge.k >= 1) { bridge.st = 'open'; bridge.boatZ = -34; if (riverBoat) riverBoat.visible = true; } }
    else if (bridge.st === 'open') { bridge.boatZ += dt * 6.5; if (riverBoat) riverBoat.position.set(58, -.6, bridge.boatZ); if (bridge.boatZ > 22) { bridge.st = 'closing'; if (riverBoat) riverBoat.visible = false; if (bridge.cb) { const c = bridge.cb; bridge.cb = null; c(); } } }
    else if (bridge.st === 'closing') { bridge.k = Math.max(0, bridge.k - dt / 3.5); if (bridge.k <= 0) { bridge.st = 'down'; bridge.t = bridge.cb ? 0 : 80; } }
    for (const l of leaves) l.p.rotation.z = l.dir * bridge.k * 1.2;
    updateLife(dt); updateFw(dt);
    if (hooks.flags().festivalDone && (fwNight -= dt) <= 0) { fwNight = 25 + rnd() * 20; const h = new Date().getHours(); if ((h >= 20 || h < 1) && !hooks.flags().alwaysDay) fireworks(3); } // festival nights
    for (const w of waus) { w.g.position.y = w.h + Math.sin(t * .9 + w.ph) * .6; w.g.rotation.z = Math.sin(t * 1.3 + w.ph) * .25; }
    if (plane) { if (planeF < 0 && (planeT -= dt) <= 0) planeF = 0; if (planeF >= 0) { planeF += dt / 14; plane.position.set(-70 + planeF * 140, 38, 40 - planeF * 110); plane.rotation.y = Math.atan2(140, -110); if (planeF >= 1) { planeF = -1; planeT = 40; plane.position.z = -500; } } }
    // light
    const tod = timeOfDay();
    tmpC.copy(DAYC).lerp(WARMC, tod.warm * .8).lerp(NIGHTC, tod.night);
    hemi.color.copy(tmpC); hemi.intensity = lerp(1.6, .55, tod.night);
    sun.color.copy(tmpC); sun.intensity = lerp(2.6, .25, tod.night) * (1 - tod.warm * .25);
    glowMat.emissiveIntensity = tod.night * 1.6 + tod.warm * .3; towerGlass.emissiveIntensity = cityGlass.emissiveIntensity = tod.night * .9; mallGlass.emissiveIntensity = tod.night * .8; if (mallSign) mallSign.emissiveIntensity = .2 + tod.night * .9;
    for (const s of glowSprites) { s.visible = tod.night > .15; s.material.opacity = tod.night; }
    scene.background.copy(SEA).lerp(new T.Color(0x0c1a33), tod.night * .8); ocean.update(t, scene.background); shore(t);
    updateCam();
    checkPerf(dt); renderer.render(scene, cam);
    // labels & markers
    for (const e of els.values()) e._seen = false;
    // declutter: place markers by priority, skip any that would overlap one already placed or sit under the HUD
    if (!hudRects.t || t - hudRects.t > .5) { hudRects.t = t; hudRects.r = ['hudL', 'hudB', 'hudR', 'zoom'].map(id => document.getElementById(id)).filter(Boolean).map(e => e.getBoundingClientRect()); const lr = layer.getBoundingClientRect(); hudRects.ox = lr.left; hudRects.oy = lr.top; }
    const placed = [], free = (x, y, w, h) => { const X = x + hudRects.ox, Y = y + hudRects.oy; for (const r of hudRects.r) if (X + w / 2 > r.left - 4 && X - w / 2 < r.right + 4 && Y + h / 2 > r.top - 4 && Y - h / 2 < r.bottom + 4) return false; for (const p of placed) if (Math.abs(p.x - x) < (p.w + w) / 2 + 3 && Math.abs(p.y - y) < (p.h + h) / 2 + 3) return false; placed.push({ x, y, w, h }); return true; };
    const cand = [];
    for (const m of hooks.markers()) { const a = anchor(m.id); if (!a || !a.vis) continue; const pr = m.type === 'mission' ? 0 : m.type === 'job' ? 1 : m.type === 'act' ? 2 : 3;
      cand.push({ pr, key: 'mk' + m.id + m.type, cls: 'mk ' + m.type, html: m.type === 'mission' ? '!' : m.text, x: a.x, y: a.y - 24 + (m.type === 'mission' ? Math.sin(t * 4 + a.x) * 3 : 0), w: m.type === 'mission' ? 30 : m.type === 'act' ? 28 : (m.text.length * 6.5 + 18), h: m.type === 'mission' ? 30 : 22, c: true }); }
    if (zoom > 1.05) for (const [id, o] of Object.entries(objects)) { if (!o.label) continue; const a = anchor(id); if (a && a.vis) cand.push({ pr: 4, key: 'lb' + id, cls: 'mk lbl', html: o.label, x: a.x, y: a.y + 14, w: o.label.length * 6 + 18, h: 20, c: true }); }
    cand.sort((p, q) => p.pr - q.pr);
    for (const c of cand) if (free(c.x, c.y, c.w, c.h)) el(c.key, c.cls, c.html).style.transform = `translate(${c.x}px,${c.y}px) translate(-50%,-50%)`;
    if (pulseId && pulseT > 0) { const a = anchor(pulseId); if (a) el('pulse', 'mk pulse', '⬇').style.transform = `translate(${a.x}px,${a.y - 70 + Math.sin(t * 8) * 8}px) translate(-50%,-50%)`; }
    for (const [k, e] of els) if (!e._seen) { e.remove(); els.delete(k); }
    return tod;
  }

  // Bab 5 fireworks: coloured bursts over the Balai Raya (also on festival nights after the chapter)
  const fw = []; const fwGeo = new T.SphereGeometry(.18, 6, 4);
  function fireworks(n = 10) { const a = AREAS.balai || { i0: 24, i1: 28, j0: 19, j1: 21 }; const [cx, cz] = W((a.i0 + a.i1) / 2, (a.j0 + a.j1) / 2);
    for (let b = 0; b < n; b++) setTimeout(() => { const col = [0xff4d4d, 0xffd452, 0x4dd2ff, 0x7dff9a, 0xff7ae0][b % 5], ox = cx + (rnd() - .5) * 14, oz = cz + (rnd() - .5) * 10, oy = 14 + rnd() * 6;
      for (let k = 0; k < 26; k++) { const m = new T.Mesh(fwGeo, new T.MeshBasicMaterial({ color: col, transparent: true })); const th = rnd() * 6.28, ph = rnd() * 3.14, sp = 5 + rnd() * 3; m.position.set(ox, oy, oz); scene.add(m); fw.push({ m, v: new T.Vector3(Math.sin(ph) * Math.cos(th) * sp, Math.cos(ph) * sp, Math.sin(ph) * Math.sin(th) * sp), life: 1.8 }); } }, b * 450); }
  function updateFw(dt) { for (let i = fw.length - 1; i >= 0; i--) { const f = fw[i]; f.life -= dt; f.v.y -= 4 * dt; f.v.multiplyScalar(1 - dt * .8); f.m.position.addScaledVector(f.v, dt); f.m.material.opacity = Math.max(0, f.life / 1.8); if (f.life <= 0) { scene.remove(f.m); f.m.material.dispose(); fw.splice(i, 1); } } }
  let fwNight = 0;
  function rebuild() { buildStatic(); lampGlows(); setPadi(hooks.flags().padiState); }
  rebuild();
  // initial view
  { const w = W(11, 12); target.set(w[0], 0, w[1]); }
  return {
    rebuild, frame, focus, anchor, timeOfDay, is3D: true, openBridge, fireworks, bridgeState: () => bridge.st,
    npcModel: (id) => !!(npcs[id] && npcs[id].model), // true once a detailed model replaced the simple figure
    zoomBy(f) { zoom *= f; clampT(); goal = null; },
    cam: view,
    hide(v) { canvas.style.visibility = v ? 'hidden' : 'visible'; layer.style.visibility = v ? 'hidden' : 'visible'; },
  };
}
