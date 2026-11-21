// SIMULATOR FOTO 3D (v2) — the TYRANZ hero, procedurally posed, in seven MyKampung locations.
// Orbit camera (1-finger rotate · pinch zoom · 2-finger pan · tap to focus), 12 poses, rotate the hero, selfie / full body / group,
// countdown, flash, grid, 9:16 / 1:1 / 16:9 crop, live filters, background blur, frames, location stamp, TYRANZ watermark,
// a gallery stored in IndexedDB (favourite, delete, export, share) and photo missions paid in RM through the wallet.
import { $, clamp, sfx, S, save, toast } from './core.js';
import { earn, fmtRM } from './wallet.js';
import { makePosableHero, POSES, PHOTO_POSES } from './heropose.js';

export const PH_LOCS = {
  jambatan: { bm: 'Jambatan Angkat', en: 'Drawbridge', ic: '🌉', stamp: 'JAMBATAN ANGKAT · KUALA TERENGGANU' },
  pantai: { bm: 'Pantai Miami', en: 'Miami Beach', ic: '🏖️', stamp: 'PANTAI MIAMI' },
  kampung: { bm: 'Kampung', en: 'Village', ic: '🏡', stamp: 'KAMPUNG KITA' },
  voli: { bm: 'Gelanggang Voli', en: 'Volleyball court', ic: '🏐', stamp: 'GELANGGANG VOLI PANTAI' },
  mall: { bm: 'Damai City Mall', en: 'Mall', ic: '🛍️', stamp: 'DAMAI CITY MALL' },
  taman: { bm: 'Taman Rekreasi', en: 'Park', ic: '🌳', stamp: 'TAMAN REKREASI' },
  bandar: { bm: 'Jalan Bandar', en: 'Town street', ic: '🏙️', stamp: 'JALAN BANDAR' },
};
export const PH_MISSIONS = [
  { id: 'jambatan', bm: 'Foto di Jambatan Angkat', en: 'Photo at the drawbridge', rm: 40 },
  { id: 'pose3', bm: '3 gaya berbeza', en: 'Three different poses', rm: 40 },
  { id: 'sunset', bm: 'Senja di Pantai Miami', en: 'Beach sunset', rm: 50 },
  { id: 'npc', bm: 'Bergambar dengan kawan', en: 'Photo with an NPC', rm: 40 },
  { id: 'travel', bm: 'Koleksi kembara: 7 lokasi', en: 'Travel collection: all 7 places', rm: 150 },
];
const TIMES = { day: { ic: '☀️', bm: 'Siang', sky: 0x8fd0f0, sun: 0xffffff, si: 2.4, hi: 1.8, fog: 0xcdeefa }, sunset: { ic: '🌅', bm: 'Senja', sky: 0xf3a46b, sun: 0xffb070, si: 1.8, hi: 1.1, fog: 0xf7c99a }, night: { ic: '🌙', bm: 'Malam', sky: 0x0c1733, sun: 0x8fa8ff, si: .45, hi: .55, fog: 0x1b2950 } };
const ASPECTS = { '9:16': 9 / 16, '1:1': 1, '16:9': 16 / 9 };
const FILTERS = { asli: { bm: 'Asli', b: 1, c: 1, w: 0, g: 0 }, cerah: { bm: 'Cerah', b: 1.12, c: 1.05, w: .1, g: 0 }, hangat: { bm: 'Hangat', b: 1.03, c: 1.05, w: .5, g: 0 }, sejuk: { bm: 'Sejuk', b: 1, c: 1.05, w: -.5, g: 0 }, hitam: { bm: 'H&P', b: 1.02, c: 1.2, w: 0, g: 1 }, vintaj: { bm: 'Vintaj', b: 1.05, c: .9, w: .35, g: .35 } };
const FRAMES = { tiada: 'Tiada', polaroid: 'Polaroid', filem: 'Filem', kampung: 'Batik' };
const LIMIT = 40;

// ------------------------------------------------------------ gallery (IndexedDB, with an in-memory fallback)
const DB = (() => { let db = null, mem = [], memId = 1, failed = false;
  const open = () => new Promise((res) => { if (db || failed) return res(db); try { const rq = indexedDB.open('mk_photos', 1); rq.onupgradeneeded = () => rq.result.createObjectStore('photos', { keyPath: 'id', autoIncrement: true }); rq.onsuccess = () => res(db = rq.result); rq.onerror = () => { failed = true; res(null); }; } catch { failed = true; res(null); } });
  const tx = async (mode, fn) => { const d = await open(); if (!d) return fn(null); return new Promise((res) => { const t = d.transaction('photos', mode), st = t.objectStore('photos'); let out; Promise.resolve(fn(st)).then(v => out = v); t.oncomplete = () => res(out); t.onerror = () => res(null); }); };
  const req = (r) => new Promise((res) => { r.onsuccess = () => res(r.result); r.onerror = () => res(null); });
  return {
    get persistent() { return !!db && !failed; },
    async all() { const v = await tx('readonly', (st) => st ? req(st.getAll()) : mem.slice()); return (v || []).sort((a, b) => b.date - a.date); },
    async add(p) { await tx('readwrite', (st) => { if (st) return req(st.add(p)); mem.push({ ...p, id: memId++ }); }); await this.trim(); },
    async put(p) { await tx('readwrite', (st) => { if (st) return req(st.put(p)); const i = mem.findIndex(m => m.id === p.id); if (i >= 0) mem[i] = p; }); },
    async del(id) { await tx('readwrite', (st) => { if (st) return req(st.delete(id)); mem = mem.filter(m => m.id !== id); }); },
    async trim() { const all = await this.all(); if (all.length <= LIMIT) return 0; const drop = all.filter(p => !p.fav).sort((a, b) => a.date - b.date).slice(0, all.length - LIMIT); for (const p of drop) await this.del(p.id); return drop.length; },
  }; })();
export const photoDB = DB;

export function photoScene({ T, environment, Sparks, palm, stiltHouse, bridgeFar, putModel, putAnimated, makeOcean, shoreWaves, textPlane, mulberry32 }) {
  return function Photo2(K, api, opts, M = {}) {
    const r = mulberry32(77);
    const scene = new T.Scene(); const sun = environment(K, scene, { sky: 0x8fd0f0, shadow: 9, fogNear: 50, fogFar: 190 });
    const hemi = scene.children.find(o => o.isHemisphereLight); sun.position.set(-6, 14, 10);
    const pm = (S.photoMissions ||= { done: {}, poses: [], locs: [] }); pm.done ||= {}; pm.poses ||= []; pm.locs ||= [];
    const cfg = { loc: opts.loc && PH_LOCS[opts.loc] ? opts.loc : 'jambatan', time: 'day', aspect: '9:16', timer: 0, flash: true, grid: true, filter: 'asli', bright: 1, contrast: 1, warm: 0, bw: false, blur: false, frame: 'tiada', stamp: true, mark: true, mode: 'full', pose: 'peace', camH: 0 };
    let shots = 0;
    // ================================================= LOCATIONS (built on first visit)
    const sandM = new T.MeshStandardMaterial({ color: 0xefdcaa, roughness: 1 }), grassM = new T.MeshStandardMaterial({ color: 0x6fae4a, roughness: 1 });
    const ocean = makeOcean(T, { w: 300, h: 200, seg: .45, amp: .3, shoreY: -95, shoreFade: 14, deep: 0x0b4f78, shallow: 0x35b6cf, repeat: 30 }); ocean.mesh.position.set(0, -.06, -104); scene.add(ocean.mesh);
    const shoreG = new T.Group(); scene.add(shoreG); const shore = shoreWaves(T, shoreG, { segs: [[-30, 30]], shoreZ: -8.8, seaward: -1, reach: 4, period: 6.5, width: 1.4 });
    const lamps = []; // emissive bits that glow at night
    const glow = (c) => { const m = new T.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0 }); lamps.push(m); return m; };
    const tree = (g, x, z, s = 1) => { K.cyl(.12 * s, .16 * s, 1.6 * s, K.mat(0x7a5232), x, .8 * s, z, g, 7); K.ball(.9 * s, K.mat(0x3f8f3a), x, 2.1 * s, z, g); K.ball(.6 * s, K.mat(0x4fa046), x + .4 * s, 2.5 * s, z + .2, g); };
    const lampPost = (g, x, z) => { K.cyl(.05, .06, 3.2, K.mat(0x333333), x, 1.6, z, g, 6); K.ball(.18, glow(0xffe2a0), x, 3.25, z, g); };
    const BUILD = {
      jambatan(g) { K.mesh(new T.BoxGeometry(60, .2, 30), sandM, 0, -.1, 6, g, false); const bf = bridgeFar(K, g, 9, -52, -.15, 1.5); g.userData.bf = bf; for (let k = 0; k < 5; k++) palm(K, g, -16 + k * 3 + r(), -4 - r() * 3, 1.1, r); for (let k = 0; k < 8; k++) { const h = 6 + r() * 10; K.box(4, h, 4, glow(0xd8d4cc), 26 + k * 5, h / 2, -70 - r() * 10, g); } return { sea: true, yaw: .25, sunset: true }; },
      pantai(g) { K.mesh(new T.BoxGeometry(60, .2, 30), sandM, 0, -.1, 6, g, false); for (let k = 0; k < 9; k++) palm(K, g, -18 + k * 4.4 + r(), -3 - r() * 4, 1 + r() * .4, r); for (const [x, z, c] of [[-3.2, -1.5, 0xe74c3c], [3.5, -2.2, 0x3498db]]) { K.cyl(.04, .04, 2.3, K.mat(0xdddddd), x, 1.15, z, g, 6); K.mesh(new T.ConeGeometry(1.4, .55, 10), K.mat(c), x, 2.35, z, g); K.box(1.8, .03, .9, K.mat(c === 0xe74c3c ? 0xf1c40f : 0xffffff), x + .4, .02, z + 1, g, false); }
        const sign = textPlane(K, 'PANTAI MIAMI', 4, .7, { bg: '#d35400' }); sign.position.set(-6, 2.6, -2); g.add(sign); K.cyl(.05, .05, 2.4, K.mat(0x8d6e63), -7.6, 1.2, -2, g, 6); K.cyl(.05, .05, 2.4, K.mat(0x8d6e63), -4.4, 1.2, -2, g, 6); return { sea: true, yaw: -.2 }; },
      kampung(g) { K.mesh(new T.BoxGeometry(60, .2, 60), grassM, 0, -.1, 0, g, false); K.box(1.4, .02, 30, K.mat(0xc9a877), 0, .01, -6, g, false); stiltHouse(K, g, -5.5, -8, { w: 8, d: 6 }); stiltHouse(K, g, 6, -11, { w: 7, d: 5, wall: 0xd9a066 }); for (let k = 0; k < 7; k++) palm(K, g, -14 + k * 4.5 + r(), -16 - r() * 4, 1.1, r);
        for (let k = -6; k < 7; k++) { K.box(.08, .7, .08, K.mat(0xf5f5f5), k * .9, .35, -3, g); } K.box(12, .06, .06, K.mat(0xf5f5f5), 0, .55, -3, g); for (const x of [-3, 3]) lampPost(g, x, -2.5); return { yaw: 0 }; },
      voli(g) { K.mesh(new T.BoxGeometry(60, .2, 40), sandM, 0, -.1, 0, g, false); const w = K.mat(0xffffff); K.box(8.1, .02, .1, w, 0, .01, -1, g, false); K.box(8.1, .02, .1, w, 0, .01, -17, g, false); K.box(.1, .02, 16, w, -4, .01, -9, g, false); K.box(.1, .02, 16, w, 4, .01, -9, g, false);
        for (const x of [-4.7, 4.7]) K.cyl(.07, .07, 2.7, K.mat(0x2e86de), x, 1.35, -9, g, 8); K.box(9.4, .9, .02, new T.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: .45 }), 0, 1.78, -9, g, false); K.box(9.4, .07, .04, w, 0, 2.22, -9, g, false);
        K.ball(.11, K.mat(0xffd452), .7, .11, .6, g); for (let k = 0; k < 6; k++) palm(K, g, (k % 2 ? 1 : -1) * (8 + r() * 4), -4 - k * 3, 1.1, r); return { sea: true, yaw: .35 }; },
      mall(g) { const tile = K.canvasTex(256, 256); { const x = tile.x; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#e9e4da' : '#f6f2ea'; x.fillRect(i * 64, j * 64, 64, 64); } tile.t.wrapS = tile.t.wrapT = T.RepeatWrapping; tile.t.repeat && tile.t.repeat.set(10, 10); tile.t.needsUpdate = true; }
        K.mesh(new T.BoxGeometry(30, .2, 30), new T.MeshStandardMaterial({ map: tile.t, roughness: .35, metalness: .05 }), 0, -.1, -5, g, false); K.box(30, .2, 30, K.mat(0xf2efe8), 0, 6, -5, g, false); K.box(30, 6, .2, K.mat(0xe7dccb), 0, 3, -16, g, false); for (const x of [-12, 12]) K.box(.2, 6, 30, K.mat(0xe7dccb), x, 3, -5, g, false);
        const cols = [0xe74c3c, 0x27ae60, 0xf39c12, 0x2980b9, 0x8e44ad]; for (let k = 0; k < 5; k++) { const x = -9 + k * 4.5; K.box(3.6, 3, .3, glow(cols[k]), x, 1.8, -15.6, g); K.box(3.8, .5, .4, K.mat(0x333333), x, 3.5, -15.5, g); }
        const sign = textPlane(K, 'DAMAI CITY MALL', 6, .8, { bg: '#1f6f9c' }); sign.position.set(0, 4.5, -15.4); g.add(sign); for (let k = 0; k < 6; k++) K.box(1.2, .06, 1.2, glow(0xfff4d6), -7.5 + k * 3, 5.88, -6, g, false);
        for (const x of [-6, 6]) { K.cyl(.6, .7, .8, K.mat(0xc8b79a), x, .4, -4, g, 12); K.ball(.7, K.mat(0x3f8f3a), x, 1.3, -4, g); } return { indoor: true, yaw: 0 }; },
      taman(g) { K.mesh(new T.BoxGeometry(60, .2, 60), grassM, 0, -.1, 0, g, false); K.cyl(3.5, 3.5, .03, K.mat(0xd8c9a8), 0, .02, -.5, g, 24); for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2 + .3; tree(g, Math.sin(a) * (9 + r() * 4), -6 + Math.cos(a) * (6 + r() * 3), .9 + r() * .4); }
        K.cyl(1.4, 1.6, .5, K.mat(0xbfbfbf), 3.2, .25, -5, g, 18); K.cyl(1.2, 1.2, .1, new T.MeshStandardMaterial({ color: 0x4fb7e0, roughness: .1 }), 3.2, .5, -5, g, 18); K.cyl(.15, .2, 1.2, K.mat(0xbfbfbf), 3.2, .9, -5, g, 8);
        K.box(1.8, .08, .5, K.mat(0x8d6e63), -3, .45, -3, g); K.box(1.8, .5, .08, K.mat(0x8d6e63), -3, .75, -3.25, g); for (let k = 0; k < 40; k++) K.ball(.08, K.mat([0xff6b8b, 0xffd452, 0xffffff, 0xb56bff][k % 4]), -6 + r() * 12, .1, -2 - r() * 2.5, g); for (const x of [-4.5, 4.5]) lampPost(g, x, -1.5); return { yaw: -.15 }; },
      bandar(g) { K.mesh(new T.BoxGeometry(80, .2, 60), K.mat(0x9a9a9a), 0, -.1, 0, g, false); K.box(80, .02, 7, K.mat(0x3b3e44), 0, .01, -8, g, false); for (let x = -36; x < 40; x += 4) K.box(2, .02, .15, K.mat(0xffffff), x, .025, -8, g, false);
        const fac = [0xf3d7a6, 0xa8d5e2, 0xf7b7a3, 0xc3e8bd, 0xe8c3e0, 0xf5e6a3]; for (let k = 0; k < 9; k++) { const x = -16 + k * 4, h = 6 + (k % 3); K.box(3.9, h, 4, K.mat(fac[k % fac.length]), x, h / 2, -16, g); K.box(3.9, .25, 1.2, K.mat(0x8a4b33), x, 3, -13.6, g); for (const wy of [4.5, 6]) if (wy < h) K.box(1, .8, .05, glow(0xffe2a0), x, wy, -13.98, g, false); K.box(2.4, 1.8, .05, glow(0xfff4d6), x, 1.1, -13.98, g, false); }
        for (let k = 0; k < 6; k++) lampPost(g, -15 + k * 6, -4); const sign = textPlane(K, 'KEDAI KOPI TYRANZ', 3.6, .6, { bg: '#c0392b' }); sign.position.set(0, 3.6, -13.4); g.add(sign); return { yaw: .2 }; },
    };
    const LOC = {}; function showLoc(k) { if (!LOC[k]) { const g = new T.Group(); scene.add(g); LOC[k] = { g, ...BUILD[k](g) }; } for (const key in LOC) LOC[key].g.visible = key === k; const L = LOC[k]; ocean.mesh.visible = shoreG.visible = !!L.sea; cfg.loc = k; orbit.yaw = L.yaw || 0; applyTime(); }
    function applyTime() { const L = LOC[cfg.loc], tm = TIMES[L && L.indoor ? 'day' : cfg.time]; scene.background = new T.Color(L && L.indoor ? 0xf3efe6 : tm.sky); scene.fog.color.copy(scene.background); sun.color.setHex(tm.sun); sun.intensity = L && L.indoor ? 1.4 : tm.si; if (hemi) hemi.intensity = L && L.indoor ? 2.2 : tm.hi;
      const night = cfg.time === 'night' && !(L && L.indoor); for (const m of lamps) m.emissiveIntensity = night ? 1.1 : L && L.indoor ? .5 : 0; if (L && L.g.userData.bf && L.g.userData.bf.win) { const w = L.g.userData.bf.win; for (const m of [].concat(w)) if (m && m.emissiveIntensity !== undefined) m.emissiveIntensity = night ? 1 : 0; } }
    // ================================================= SUBJECTS
    const heroP = makePosableHero(T, K, M, putModel, 1.65); const hero = heroP ? heroP.g : (() => { const g = new T.Group(); K.cyl(.22, .22, 1.2, K.mat(0x2e86de), 0, .75, 0, g); K.ball(.22, K.mat(0xc68a5a), 0, 1.5, 0, g); return g; })(); scene.add(hero);
    if (heroP) heroP.setPose(POSES[cfg.pose].p, true);
    let heroRot = 0, npc = null; const npcSpot = new T.Vector3(.75, 0, -.1);
    function setMode(m) { cfg.mode = m; if (m === 'group' && !npc) { const a = putAnimated(M, 'chars/female-a', scene, npcSpot.x, npcSpot.z, { h: 1.6, anim: 'idle' }); npc = a || { obj: (() => { const g = new T.Group(); K.cyl(.2, .2, 1.1, K.mat(0xe67e22), 0, .7, 0, g); K.ball(.2, K.mat(0xc68a5a), 0, 1.4, 0, g); g.position.copy(npcSpot); scene.add(g); return g; })(), update() {} }; }
      if (npc) npc.obj.visible = m === 'group'; hero.position.x = m === 'group' ? -.45 : 0; Object.assign(orbit.want, m === 'selfie' ? { dist: 1.25, ty: 1.42, pitch: .06, tx: hero.position.x } : m === 'group' ? { dist: 4.6, ty: .95, pitch: .1, tx: .15 } : { dist: 3.9, ty: .9, pitch: .12, tx: 0 }); orbit.yaw = LOC[cfg.loc] ? LOC[cfg.loc].yaw || 0 : 0; orbit.tz = 0; }
    // ================================================= ORBIT CAMERA
    const orbit = { yaw: 0, pitch: .12, dist: 3.9, tx: 0, ty: .9, tz: 0, want: { dist: 3.9, ty: .9, pitch: .12, tx: 0 }, ease: 1 };
    const view = { pos: new T.Vector3(0, 1.4, 4), look: new T.Vector3(0, .9, 0), halfW: 1, halfH: 1, snap: true };
    const FOV = 40; let camRef = null;
    function applyOrbit() { const o = orbit, cp = Math.cos(o.pitch); view.look.set(o.tx, o.ty + cfg.camH * .5, o.tz); view.pos.set(o.tx + Math.sin(o.yaw) * cp * o.dist, Math.max(.15, o.ty + cfg.camH + Math.sin(o.pitch) * o.dist), o.tz + Math.cos(o.yaw) * cp * o.dist); const d = view.pos.distanceTo(view.look); view.halfH = d * Math.tan(FOV * Math.PI / 360); view.halfW = 0; }
    // multi-touch on the 3D canvas (the framework's own single-pointer handlers stay attached; this game ignores them)
    const cv = $('gcv3'), pts = new Map(); let gesture = null, tapStart = null;
    const pd = (e) => { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); orbit.ease = 0; if (pts.size === 1) tapStart = { x: e.clientX, y: e.clientY, t: performance.now() }; else tapStart = null; gesture = null; };
    const pmv = (e) => { const p = pts.get(e.pointerId); if (!p) return; const nx = e.clientX, ny = e.clientY;
      if (pts.size === 1) { const dx = nx - p.x, dy = ny - p.y; orbit.yaw -= dx * .008; orbit.pitch = clamp(orbit.pitch + dy * .006, -.35, 1.25); if (tapStart && Math.hypot(nx - tapStart.x, ny - tapStart.y) > 8) tapStart = null; }
      else if (pts.size === 2) { const [a, b] = [...pts.values()], d0 = Math.hypot(a.x - b.x, a.y - b.y), mx0 = (a.x + b.x) / 2, my0 = (a.y + b.y) / 2; p.x = nx; p.y = ny; const [a2, b2] = [...pts.values()], d1 = Math.hypot(a2.x - b2.x, a2.y - b2.y), mx1 = (a2.x + b2.x) / 2, my1 = (a2.y + b2.y) / 2;
        if (d0 > 10) orbit.dist = clamp(orbit.dist * d0 / d1, .7, 9); const s = orbit.dist / Math.max(200, cv.clientHeight) * 1.1; orbit.tx -= Math.cos(orbit.yaw) * (mx1 - mx0) * s; orbit.tz += Math.sin(orbit.yaw) * (mx1 - mx0) * s; orbit.ty = clamp(orbit.ty + (my1 - my0) * s, .1, 3); return; }
      p.x = nx; p.y = ny; };
    const pu = (e) => { if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId); if (tapStart && performance.now() - tapStart.t < 300) focusAt(e.clientX, e.clientY); tapStart = null; };
    const wheel = (e) => { e.preventDefault(); orbit.dist = clamp(orbit.dist * (1 + Math.sign(e.deltaY) * .1), .7, 9); };
    cv.addEventListener('pointerdown', pd); cv.addEventListener('pointermove', pmv); cv.addEventListener('pointerup', pu); cv.addEventListener('pointercancel', pu); cv.addEventListener('wheel', wheel, { passive: false });
    const rc = new T.Raycaster(), ndc = new T.Vector2(); let focusPt = null;
    function focusAt(x, y) { const rect = cv.getBoundingClientRect(); showFocus(x - rect.left, y - rect.top); if (!camRef) return; ndc.set((x - rect.left) / rect.width * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1); rc.setFromCamera(ndc, camRef);
      const targets = [hero, npc && npc.obj, LOC[cfg.loc] && LOC[cfg.loc].g].filter(Boolean); const hit = (rc.intersectObjects ? rc.intersectObjects(targets, true) : [])[0];
      if (hit && hit.distance < 14) { focusPt = hit.point.clone(); orbit.want = { dist: orbit.dist, ty: clamp(hit.point.y, .2, 2.5), pitch: orbit.pitch, tx: hit.point.x }; orbit.wantZ = hit.point.z; orbit.ease = 1; sfx.tap(); } }
    // ================================================= HUD
    const root = document.createElement('div'); root.className = 'f3 ph'; root.innerHTML = `
      <div class="phFrame"><i class="g1"></i><i class="g2"></i><i class="g3"></i><i class="g4"></i></div><div class="phFocus"></div><div class="phCount"></div><div class="phFlash"></div>
      <div class="phTop"><button class="phChip" data-a="loc"></button><button class="phChip" data-a="time"></button><span class="phTip">Seret: putar · Cubit: zum · 2 jari: alih · Ketik: fokus</span><span class="sp"></span><button class="phIco" data-a="miss" aria-label="Misi">🎯</button><button class="phIco" data-a="gal" aria-label="Galeri">🖼️<b class="n"></b></button><button class="phIco" data-a="set" aria-label="Tetapan">🎛️</button><button class="phIco" data-a="done" aria-label="Selesai">✓</button></div>
      <div class="phLeft"><button data-m="full">🧍<b>Penuh</b></button><button data-m="selfie">🤳<b>Selfie</b></button><button data-m="group">👫<b>Kawan</b></button><span class="phRot"><button data-r="-1">⟲</button><button data-r="1">⟳</button></span><label class="phH"><input type="range" min="-1" max="1.6" step=".05" value="0" aria-label="Tinggi kamera"></label></div>
      <div class="phPoses"></div>
      <div class="phRight"><button class="phChip sm" data-a="aspect"></button><button class="phShutter" aria-label="Ambil gambar"><i></i></button><button class="phChip sm" data-a="timer"></button></div>
      <div class="phSheet" hidden></div><div class="f3Over" hidden></div>`;
    $('game').append(root); $('game').classList.add('f3mode');
    const q = (s) => root.querySelector(s), sheet = q('.phSheet'), over = q('.f3Over');
    const poseBar = q('.phPoses'); poseBar.innerHTML = PHOTO_POSES.map(k => `<button data-p="${k}" class="${k === cfg.pose ? 'on' : ''}"><i>${POSES[k].ic}</i><b>${POSES[k].bm}</b></button>`).join('');
    poseBar.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { cfg.pose = b.dataset.p; if (heroP) heroP.go(cfg.pose, .4); poseBar.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); sfx.pop(); });
    root.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { setMode(b.dataset.m); sfx.tap(); paintHud(); });
    let rotHold = 0; root.querySelectorAll('[data-r]').forEach(b => { b.onpointerdown = (e) => { e.preventDefault(); rotHold = +b.dataset.r; heroRot += rotHold * .26; }; b.onpointerup = b.onpointercancel = b.onpointerleave = () => rotHold = 0; });
    q('.phH input').oninput = (e) => { cfg.camH = +e.target.value; };
    root.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { sfx.tap(); const a = b.dataset.a;
      if (a === 'loc') openLoc(); else if (a === 'time') { const ks = Object.keys(TIMES); cfg.time = ks[(ks.indexOf(cfg.time) + 1) % ks.length]; applyTime(); paintHud(); }
      else if (a === 'aspect') { const ks = Object.keys(ASPECTS); cfg.aspect = ks[(ks.indexOf(cfg.aspect) + 1) % ks.length]; paintHud(); } else if (a === 'timer') { const ks = [0, 3, 5, 10]; cfg.timer = ks[(ks.indexOf(cfg.timer) + 1) % ks.length]; paintHud(); }
      else if (a === 'set') openSet(); else if (a === 'gal') openGallery(); else if (a === 'miss') openMissions(); else if (a === 'done') finish(); });
    q('.phShutter').onclick = () => shoot();
    const onKey = (e) => { if (!root.isConnected || e.repeat) return; if (e.code === 'Space' && over.hidden && sheet.hidden) { e.preventDefault(); shoot(); } else if (e.code === 'ArrowLeft') heroRot -= .26; else if (e.code === 'ArrowRight') heroRot += .26; else if (e.code === 'Escape') { sheet.hidden = true; } };
    addEventListener('keydown', onKey);
    function paintHud() { const L = PH_LOCS[cfg.loc], tm = TIMES[cfg.time]; q('[data-a="loc"]').innerHTML = `${L.ic} ${L.bm} ▾`; q('[data-a="time"]').innerHTML = `${tm.ic} ${tm.bm}`; q('[data-a="time"]').disabled = !!(LOC[cfg.loc] && LOC[cfg.loc].indoor);
      q('[data-a="aspect"]').textContent = cfg.aspect; q('[data-a="timer"]').textContent = cfg.timer ? `⏱ ${cfg.timer}s` : '⏱ 0'; root.querySelectorAll('[data-m]').forEach(b => b.classList.toggle('on', b.dataset.m === cfg.mode));
      root.classList.toggle('grid', cfg.grid); layoutFrame(); const f = FILTERS[cfg.filter]; cv.style.filter = cssFilter(f); }
    const cssFilter = (f) => { const b = cfg.bright * f.b, c = cfg.contrast * f.c, w = clamp(cfg.warm + f.w, -1, 1), g = cfg.bw ? 1 : f.g; return `brightness(${b.toFixed(2)}) contrast(${c.toFixed(2)}) ${w > 0 ? `sepia(${(w * .45).toFixed(2)}) saturate(${(1 + w * .25).toFixed(2)})` : w < 0 ? `hue-rotate(${(w * 18).toFixed(0)}deg) saturate(${(1 + w * .1).toFixed(2)})` : ''} grayscale(${g})`; };
    let frameRect = { x: 0, y: 0, w: 1, h: 1 };
    function layoutFrame() { const W = root.clientWidth || innerWidth, H = root.clientHeight || innerHeight, a = ASPECTS[cfg.aspect], pad = 8; let h = H - pad * 2, w = h * a; if (w > W - pad * 2) { w = W - pad * 2; h = w / a; } frameRect = { x: (W - w) / 2, y: (H - h) / 2, w, h }; const fr = q('.phFrame'); Object.assign(fr.style, { left: `${frameRect.x}px`, top: `${frameRect.y}px`, width: `${w}px`, height: `${h}px` }); }
    addEventListener('resize', layoutFrame);
    // ---------------- sheets
    function openLoc() { sheet.hidden = false; sheet.innerHTML = `<div class="phSh"><h3>📍 Lokasi · Location</h3><div class="phGrid">${Object.entries(PH_LOCS).map(([k, L]) => `<button data-l="${k}" class="${k === cfg.loc ? 'on' : ''}"><i>${L.ic}</i><b>${L.bm}</b><small>${L.en}${pm.locs.includes(k) ? ' · ✓' : ''}</small></button>`).join('')}</div><button class="f3B" data-x>Tutup</button></div>`;
      sheet.querySelectorAll('[data-l]').forEach(b => b.onclick = () => { showLoc(b.dataset.l); setMode(cfg.mode); sheet.hidden = true; sfx.good(); paintHud(); }); sheet.querySelector('[data-x]').onclick = () => sheet.hidden = true; }
    function openSet() { sheet.hidden = false; const chips = (obj, key) => Object.entries(obj).map(([k, v]) => `<button data-${key}="${k}" class="${cfg[key] === k ? 'on' : ''}">${typeof v === 'string' ? v : v.bm}</button>`).join('');
      sheet.innerHTML = `<div class="phSh wide"><h3>🎛️ Kamera & Penapis</h3>
        <div class="phRowL"><span>Penapis</span><div class="chips">${chips(FILTERS, 'filter')}</div></div>
        <div class="phRowL"><span>Kecerahan</span><input type="range" min=".6" max="1.5" step=".02" value="${cfg.bright}" data-v="bright"></div>
        <div class="phRowL"><span>Kontras</span><input type="range" min=".6" max="1.6" step=".02" value="${cfg.contrast}" data-v="contrast"></div>
        <div class="phRowL"><span>Sejuk ↔ Hangat</span><input type="range" min="-1" max="1" step=".05" value="${cfg.warm}" data-v="warm"></div>
        <div class="phRowL"><span>Bingkai</span><div class="chips">${chips(FRAMES, 'frame')}</div></div>
        <div class="phToggles">${[['bw', 'Hitam putih'], ['blur', 'Kabur latar'], ['grid', 'Grid 1/3'], ['flash', 'Denyar'], ['stamp', 'Teks lokasi'], ['mark', 'Tera TYRANZ']].map(([k, l]) => `<label><input type="checkbox" data-t="${k}" ${cfg[k] ? 'checked' : ''}> ${l}</label>`).join('')}</div>
        <button class="f3B primary" data-x>Siap</button></div>`;
      sheet.querySelectorAll('[data-filter]').forEach(b => b.onclick = () => { cfg.filter = b.dataset.filter; openSet(); paintHud(); }); sheet.querySelectorAll('[data-frame]').forEach(b => b.onclick = () => { cfg.frame = b.dataset.frame; openSet(); });
      sheet.querySelectorAll('[data-v]').forEach(i => i.oninput = () => { cfg[i.dataset.v] = +i.value; paintHud(); }); sheet.querySelectorAll('[data-t]').forEach(i => i.onchange = () => { cfg[i.dataset.t] = i.checked; paintHud(); }); sheet.querySelector('[data-x]').onclick = () => sheet.hidden = true; }
    function openMissions() { sheet.hidden = false; const prog = { jambatan: pm.done.jambatan ? 1 : 0, pose3: Math.min(3, pm.poses.length) + '/3', sunset: pm.done.sunset ? 1 : 0, npc: pm.done.npc ? 1 : 0, travel: pm.locs.length + '/7' };
      sheet.innerHTML = `<div class="phSh"><h3>🎯 Misi Foto</h3>${PH_MISSIONS.map(m => `<div class="phMis ${pm.done[m.id] ? 'ok' : ''}"><b>${pm.done[m.id] ? '✅' : '⬜'} ${m.bm}</b><small>${m.en} · ${typeof prog[m.id] === 'string' ? prog[m.id] : ''}</small><em>${fmtRM(m.rm)}</em></div>`).join('')}<p class="muted">Simpan foto ke galeri untuk mengira misi.</p><button class="f3B" data-x>Tutup</button></div>`; sheet.querySelector('[data-x]').onclick = () => sheet.hidden = true; }
    // ================================================= SHOOTING
    let busy = false, countT = 0, flashT = 0, focusT = 0;
    function showFocus(x, y) { const f = q('.phFocus'); f.style.left = `${x}px`; f.style.top = `${y}px`; f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); focusT = .6; }
    function shoot() { if (busy || !over.hidden) return; sheet.hidden = true; busy = true; if (cfg.timer) { countT = cfg.timer; lastSec = cfg.timer + 1; } else snap(); }
    let lastSec = 0;
    function snap() { const fr = frameRect; showFocus(fr.x + fr.w / 2, fr.y + fr.h * .45); setTimeout(() => { sfx.snap(); if (cfg.flash) flashT = 1; root.classList.add('shooting'); api.capture((url) => { root.classList.remove('shooting'); develop(url).then(preview, (e) => { console.warn('photo develop failed', e); preview(null); }); }); }, 260); }
    const loadImg = (url) => new Promise((res) => { if (!url) return res(null); const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = url; });
    function subjectBox() { // where the subject sits on screen (0..1), for the background-blur mask
      if (!camRef) return { x: .5, y: .55, rx: .2, ry: .4 }; const p0 = new T.Vector3(hero.position.x, 0, hero.position.z).project(camRef), p1 = new T.Vector3(hero.position.x, 1.75, hero.position.z).project(camRef);
      const extra = cfg.mode === 'group' ? .16 : 0, cx = cfg.mode === 'group' ? (hero.position.x + npcSpot.x) / 2 : hero.position.x, pc = new T.Vector3(cx, .9, 0).project(camRef);
      return { x: (pc.x + 1) / 2, y: (1 - pc.y) / 2, rx: Math.abs(p1.y - p0.y) * .22 + extra, ry: Math.abs(p1.y - p0.y) * .32 }; }
    async function develop(url) {
      const im = await loadImg(url), sb = subjectBox();
      const W = root.clientWidth || innerWidth, H = root.clientHeight || innerHeight, a = ASPECTS[cfg.aspect];
      const long = 1440, OW = a >= 1 ? long : Math.round(long * a), OH = a >= 1 ? Math.round(long / a) : long;
      const c = document.createElement('canvas'); c.width = OW; c.height = OH; const x = c.getContext('2d'); if (!x) return null;
      if (im) { const sx = im.width / W, sy = im.height / H, cx0 = frameRect.x * sx, cy0 = frameRect.y * sy, cw = frameRect.w * sx, ch = frameRect.h * sy; x.drawImage(im, cx0, cy0, cw, ch, 0, 0, OW, OH);
        if (cfg.blur) { // soft background: a down-scaled copy stretched back up, with the sharp subject on top inside a feathered ellipse
          const sm = document.createElement('canvas'); sm.width = Math.max(8, OW >> 4); sm.height = Math.max(8, OH >> 4); const sx2 = sm.getContext('2d'); sx2.drawImage(c, 0, 0, sm.width, sm.height); const sharp = document.createElement('canvas'); sharp.width = OW; sharp.height = OH; const shx = sharp.getContext('2d'); shx.drawImage(c, 0, 0);
          x.imageSmoothingEnabled = true; x.drawImage(sm, 0, 0, OW, OH); const mx = ((sb.x * W) - frameRect.x) / frameRect.w * OW, my = ((sb.y * H) - frameRect.y) / frameRect.h * OH, rx = sb.rx * W / frameRect.w * OW * 1.25, ry = sb.ry * H / frameRect.h * OH * 1.35;
          const mask = document.createElement('canvas'); mask.width = OW; mask.height = OH; const mk = mask.getContext('2d'); const gr = mk.createRadialGradient(0, 0, 0, 0, 0, 1); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(.72, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); mk.save(); mk.translate(mx, my); mk.scale(Math.max(1, rx), Math.max(1, ry)); mk.fillStyle = gr; mk.beginPath(); mk.arc(0, 0, 1, 0, 7); mk.fill(); mk.restore();
          mk.globalCompositeOperation = 'source-in'; mk.drawImage(sharp, 0, 0); x.drawImage(mask, 0, 0); } }
      else { const gr = x.createLinearGradient(0, 0, 0, OH); gr.addColorStop(0, '#8fd0f0'); gr.addColorStop(1, '#efdcaa'); x.fillStyle = gr; x.fillRect(0, 0, OW, OH); }
      grade(x, OW, OH);
      // frame + stamps
      let out = c; if (cfg.frame !== 'tiada') { const b = Math.round(OW * .045), bb = cfg.frame === 'polaroid' ? Math.round(OH * .14) : b; out = document.createElement('canvas'); out.width = OW + b * 2; out.height = OH + b + bb; const o = out.getContext('2d');
        if (cfg.frame === 'polaroid') { o.fillStyle = '#fffaf0'; o.fillRect(0, 0, out.width, out.height); } else if (cfg.frame === 'filem') { o.fillStyle = '#111'; o.fillRect(0, 0, out.width, out.height); o.fillStyle = '#f2e6c9'; for (let y = b * .6; y < out.height; y += b * 1.1) { o.fillRect(b * .3, y, b * .4, b * .55); o.fillRect(out.width - b * .7, y, b * .4, b * .55); } }
        else { o.fillStyle = '#7b2d26'; o.fillRect(0, 0, out.width, out.height); o.strokeStyle = '#f1c40f'; o.lineWidth = b * .12; for (let k = 0; k < out.width + out.height; k += b * .9) { o.beginPath(); o.arc(k % out.width, k < out.width ? b * .5 : out.height - b * .5, b * .3, 0, 7); o.stroke(); } }
        o.drawImage(c, b, b); if (cfg.frame === 'polaroid' && cfg.stamp) { o.fillStyle = '#c0392b'; o.font = `900 ${Math.round(bb * .26)}px system-ui`; o.textAlign = 'center'; o.fillText(PH_LOCS[cfg.loc].stamp, out.width / 2, OH + b + bb * .45); o.fillStyle = '#7f8c8d'; o.font = `600 ${Math.round(bb * .16)}px system-ui`; o.fillText(new Date().toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' }), out.width / 2, OH + b + bb * .72); } }
      const o = out.getContext('2d'), u = Math.round(OW / 40);
      if (cfg.stamp && cfg.frame !== 'polaroid') { o.font = `900 ${u * 1.1}px system-ui`; o.textAlign = 'left'; o.fillStyle = 'rgba(0,0,0,.4)'; const ox = cfg.frame === 'tiada' ? u : Math.round(OW * .045) + u, oy = (cfg.frame === 'tiada' ? OH : OH + Math.round(OW * .045)) - u * 1.2; o.fillText(`📍 ${PH_LOCS[cfg.loc].stamp}`, ox + 2, oy + 2); o.fillStyle = '#fff'; o.fillText(`📍 ${PH_LOCS[cfg.loc].stamp}`, ox, oy); }
      if (cfg.mark) { o.font = `900 ${u * .95}px system-ui`; o.textAlign = 'right'; o.fillStyle = 'rgba(255,255,255,.85)'; o.strokeStyle = 'rgba(0,0,0,.35)'; o.lineWidth = 3; const tx = out.width - (cfg.frame === 'tiada' ? u : Math.round(OW * .045) + u), ty = (cfg.frame === 'tiada' ? u * 1.8 : Math.round(OW * .045) + u * 1.8); o.strokeText('TYRANZ · MyKampung', tx, ty); o.fillText('TYRANZ · MyKampung', tx, ty); }
      let data = ''; try { data = out.toDataURL('image/jpeg', .86); } catch { data = ''; }
      return { data, w: out.width, h: out.height, real: !!im };
    }
    function grade(x, w, h) { // brightness / contrast / warm-cool / black & white, done on pixels so it works on every browser
      const f = FILTERS[cfg.filter], b = cfg.bright * f.b, c = cfg.contrast * f.c, wm = clamp(cfg.warm + f.w, -1, 1), g = cfg.bw ? 1 : f.g; if (b === 1 && c === 1 && !wm && !g) return;
      let img; try { img = x.getImageData(0, 0, w, h); } catch { return; } const d = img.data, rW = 1 + wm * .12, bW = 1 - wm * .12;
      for (let i = 0; i < d.length; i += 4) { let R = d[i] * b, G = d[i + 1] * b, Bv = d[i + 2] * b; R = (R - 128) * c + 128; G = (G - 128) * c + 128; Bv = (Bv - 128) * c + 128; R *= rW; Bv *= bW; if (g) { const L = R * .3 + G * .59 + Bv * .11; R += (L - R) * g; G += (L - G) * g; Bv += (L - Bv) * g; } d[i] = R; d[i + 1] = G; d[i + 2] = Bv; }
      x.putImageData(img, 0, 0); }
    let current = null;
    function preview(ph) { busy = false; if (!ph || !ph.data) { toast('Kamera gagal', 'Capture failed — cuba lagi'); return; } current = { data: ph.data, loc: cfg.loc, pose: cfg.pose, time: cfg.time, npc: cfg.mode === 'group', date: Date.now(), fav: false, aspect: cfg.aspect };
      over.hidden = false; over.innerHTML = `<div class="f3Card phPrev"><img src="${ph.data}" alt="Foto"><div class="phMeta">${PH_LOCS[cfg.loc].ic} ${PH_LOCS[cfg.loc].bm} · ${POSES[cfg.pose].bm} · ${cfg.aspect}</div><div class="f3Row"><button class="f3B" data-o="retake">↺ Ambil semula</button><button class="f3B primary" data-o="save">💾 Simpan</button><button class="f3B" data-o="share">📤 Kongsi</button></div></div>`;
      over.querySelector('[data-o="retake"]').onclick = () => { over.hidden = true; current = null; sfx.tap(); };
      over.querySelector('[data-o="save"]').onclick = async () => { await keep(current); over.hidden = true; };
      over.querySelector('[data-o="share"]').onclick = async () => { const p = current; await keep(p); await sharePhoto(p); over.hidden = true; }; }
    async function keep(p) { if (!p || p.saved) return; p.saved = true; await DB.add({ data: p.data, loc: p.loc, pose: p.pose, time: p.time, npc: p.npc, date: p.date, fav: false, aspect: p.aspect }); shots++; api.progress(Math.min(1, shots / 3)); sfx.coin(); toast('Disimpan ke galeri 🖼️', DB.persistent ? 'Saved to gallery' : 'Saved (session only — storage unavailable)'); missions(p); paintCount(); }
    function missions(p) { if (!pm.poses.includes(p.pose)) pm.poses.push(p.pose); if (!pm.locs.includes(p.loc)) pm.locs.push(p.loc); const got = [];
      const chk = (id, ok) => { if (ok && !pm.done[id]) { pm.done[id] = Date.now(); const m = PH_MISSIONS.find(x => x.id === id); earn(m.rm, `Misi foto: ${m.bm}`); got.push(m); } };
      chk('jambatan', p.loc === 'jambatan'); chk('pose3', pm.poses.length >= 3); chk('sunset', p.loc === 'pantai' && p.time === 'sunset'); chk('npc', p.npc); chk('travel', pm.locs.length >= 7); save();
      got.forEach((m, i) => setTimeout(() => { sfx.star(1); toast(`🎯 Misi selesai: ${m.bm}`, `+${fmtRM(m.rm)} · ${m.en}`); }, 700 + i * 1400)); }
    const dl = (p) => { const a = document.createElement('a'); a.href = p.data; a.download = `MyKampung-${p.loc}-${new Date(p.date).toISOString().slice(0, 10)}-${p.id || 'foto'}.jpg`; document.body.append(a); a.click(); a.remove(); };
    async function sharePhoto(p) { try { const blob = await (await fetch(p.data)).blob(), file = new File([blob], `MyKampung-${p.loc}.jpg`, { type: 'image/jpeg' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'MyKampung', text: `${PH_LOCS[p.loc].bm} · TYRANZ MyKampung` }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
      dl(p); toast('Dimuat turun', 'Sharing not supported here — downloaded instead'); }
    async function paintCount() { const all = await DB.all(); const n = q('[data-a="gal"] .n'); if (n) n.textContent = all.length || ''; }
    async function openGallery(focusId) { const all = await DB.all(); sheet.hidden = false;
      sheet.innerHTML = `<div class="phSh wide gal"><h3>🖼️ Galeri <small>${all.length}/${LIMIT}${DB.persistent ? '' : ' · sesi sahaja'}</small></h3>${all.length ? `<div class="phThumbs">${all.map(p => `<button data-id="${p.id}"><img src="${p.data}" alt="" loading="lazy">${p.fav ? '<i>♥</i>' : ''}</button>`).join('')}</div>` : '<p class="muted">Belum ada foto. Ambil gambar dan tekan Simpan.</p>'}<p class="muted">Had ${LIMIT} foto — foto lama yang bukan kegemaran dipadam automatik.</p><button class="f3B" data-x>Tutup</button></div>`;
      sheet.querySelectorAll('[data-id]').forEach(b => b.onclick = () => viewPhoto(all.find(p => p.id === +b.dataset.id))); sheet.querySelector('[data-x]').onclick = () => sheet.hidden = true; }
    function viewPhoto(p) { if (!p) return; over.hidden = false; const d = new Date(p.date);
      over.innerHTML = `<div class="f3Card phPrev"><img src="${p.data}" alt="Foto"><div class="phMeta">${PH_LOCS[p.loc] ? PH_LOCS[p.loc].ic + ' ' + PH_LOCS[p.loc].bm : p.loc} · ${d.toLocaleDateString('ms-MY')} ${d.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' })}</div>
        <div class="f3Row"><button class="f3B" data-o="fav">${p.fav ? '♥ Kegemaran' : '♡ Gemar'}</button><button class="f3B" data-o="dl">⬇️ Eksport</button><button class="f3B" data-o="share">📤</button><button class="f3B" data-o="del">🗑️</button><button class="f3B primary" data-o="x">✕</button></div></div>`;
      const o = (k) => over.querySelector(`[data-o="${k}"]`);
      o('fav').onclick = async () => { p.fav = !p.fav; await DB.put(p); viewPhoto(p); openGallery(); }; o('dl').onclick = () => dl(p); o('share').onclick = () => sharePhoto(p);
      o('del').onclick = async () => { if (o('del').dataset.sure) { await DB.del(p.id); over.hidden = true; openGallery(); paintCount(); sfx.tap(); } else { o('del').dataset.sure = 1; o('del').textContent = 'Padam? ✓'; } }; o('x').onclick = () => over.hidden = true; }
    function finish() { const stars = shots >= 5 ? 3 : shots >= 2 ? 2 : 1; if (!shots) { toast('Simpan sekurang-kurangnya 1 foto', 'Save at least one photo first'); return; } api.finish({ stars, photos: shots }); }
    // ================================================= START
    showLoc(cfg.loc); setMode('full'); orbit.dist = orbit.want.dist; orbit.ty = orbit.want.ty; orbit.pitch = orbit.want.pitch; paintHud(); paintCount(); applyOrbit();
    let t = 0;
    return {
      scene, view, ray() { return { ok: false }; }, down() {}, move() {}, up() {},
      timerText: () => `📸 ${shots}`,
      dbg: () => ({ loc: cfg.loc, time: cfg.time, pose: cfg.pose, mode: cfg.mode, aspect: cfg.aspect, orbit: { yaw: +orbit.yaw.toFixed(2), pitch: +orbit.pitch.toFixed(2), dist: +orbit.dist.toFixed(2) }, shots, busy, missions: { ...pm.done }, heroRot: +heroRot.toFixed(2), posable: !!heroP }),
      sim: { cfg, orbit, shoot, showLoc, setMode, DB, keep, get current() { return current; }, heroP },
      update(dt, ptr, camera) {
        camRef = camera; if (camera && camera.far < 300) camera.far = 300; t += dt;
        if (heroP) heroP.update(dt); if (rotHold) heroRot += rotHold * dt * 2; hero.rotation.y = heroRot; if (npc && npc.update && npc.obj.visible) { npc.obj.rotation.y = -.35; npc.update(dt); }
        if (orbit.ease) { const k = 1 - Math.exp(-dt * 6), w = orbit.want; orbit.dist += (w.dist - orbit.dist) * k; orbit.ty += (w.ty - orbit.ty) * k; orbit.pitch += (w.pitch - orbit.pitch) * k; orbit.tx += (w.tx - orbit.tx) * k; orbit.tz += ((orbit.wantZ ?? 0) - orbit.tz) * k; if (Math.abs(w.dist - orbit.dist) < .01 && Math.abs(w.tx - orbit.tx) < .01) { orbit.ease = 0; orbit.wantZ = undefined; } }
        applyOrbit();
        ocean.update(t, scene.background); shore(t); const L = LOC[cfg.loc]; if (L && L.g.userData.bf && L.g.userData.bf.leaves) { const lk = (Math.sin(t * .35) + 1) / 2; for (const l of L.g.userData.bf.leaves) l.p.rotation.z = l.d * lk * 1.1; }
        if (countT > 0) { countT -= dt; const s = Math.ceil(countT), el = q('.phCount'); if (s !== lastSec) { lastSec = s; el.textContent = s > 0 ? s : ''; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go'); if (s > 0) sfx.tap(); } if (countT <= 0) { el.textContent = ''; snap(); } }
        if (flashT > 0) { flashT = Math.max(0, flashT - dt * 3); q('.phFlash').style.opacity = flashT; }
      },
      stop() { cv.removeEventListener('pointerdown', pd); cv.removeEventListener('pointermove', pmv); cv.removeEventListener('pointerup', pu); cv.removeEventListener('pointercancel', pu); cv.removeEventListener('wheel', wheel); removeEventListener('keydown', onKey); removeEventListener('resize', layoutFrame); cv.style.filter = ''; root.remove(); $('game').classList.remove('f3mode'); },
    };
  };
}
