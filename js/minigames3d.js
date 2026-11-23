// 3D mini-games (Three.js): tebas laman, baiki rumah, cuci kereta.
// Works with mouse and touch: every pointer is raycast into the scene.
import { $, clamp, lerp, sfx, loopSound, toast, mulberry32, boatEngine, seaAmbience, musicDuck } from './core.js';
import { Grid, progressBar, beachCore, TRASH, BINS, setupHelp, pauseWhenHidden, hideTutorial, fishCore, boatCore, drawHull, HULL, halfW, SPOTS, RARITY, fishLen, showFishCard, hideFishCard } from './minigames.js';
import { loadModels, putModel, putAnimated, isShared } from './models.js';
import { initSkins, skinFish } from './fishskin.js';
import { makeOcean, shoreWaves } from './ocean.js';
import { futsalScenes } from './futsal3d.js';
import { seaFishScene } from './seafish.js';
import { kailScene } from './kail.js';
import { jalanDragScene } from './jalandrag.js';
import { mallScene } from './mall2.js';
import { volleyScene } from './volley3d.js';
import { photoScene } from './photo3d.js';
import { volleyCore, photoCore, dragCore, marketCore, mallCore, MALL_ITEMS, ACTIVITIES, POSES, FOODS } from './activities.js';

let T = null, renderer = null;
const isTouch = matchMedia('(pointer:coarse)').matches;
export function has3D() {
  try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch { return false; }
}
export async function load3D() { if (!T) { T = await import('three'); initSkins(T); } return T; }
const starsFor = (v, a, b) => (v <= a ? 3 : v <= b ? 2 : 1);

// ------------------------------------------------------------ building kit
function kit() {
  const mats = {};
  const K = {
    mat(c, o = {}) { const k = c + JSON.stringify(o); return mats[k] || (mats[k] = new T.MeshStandardMaterial({ color: c, roughness: .85, ...o })); },
    mesh(geo, m, x = 0, y = 0, z = 0, parent, cast = true) { const o = new T.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = cast; o.receiveShadow = true; parent.add(o); return o; },
    box(w, h, d, m, x, y, z, parent, cast = true) { return K.mesh(new T.BoxGeometry(w, h, d), m, x, y, z, parent, cast); },
    cyl(rt, rb, h, m, x, y, z, parent, seg = 12) { return K.mesh(new T.CylinderGeometry(rt, rb, h, seg), m, x, y, z, parent); },
    ball(r, m, x, y, z, parent) { return K.mesh(new T.SphereGeometry(r, 16, 12), m, x, y, z, parent); },
    group(x = 0, y = 0, z = 0, parent) { const g = new T.Group(); g.position.set(x, y, z); parent.add(g); return g; },
    canvasTex(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return { c, x: c.getContext('2d'), t }; },
  };
  return K;
}
function environment(K, scene, { sky = 0x9fd6ee, shadow = 14, fogNear = 30, fogFar = 80 } = {}) {
  scene.background = new T.Color(sky); scene.fog = new T.Fog(sky, fogNear, fogFar);
  scene.add(new T.HemisphereLight(0xffffff, 0x6a8a5a, 1.9));
  const sun = new T.DirectionalLight(0xfff1d6, 2.4); sun.position.set(-8, 16, 10); sun.castShadow = true;
  const s = isTouch ? 1024 : 2048; sun.shadow.mapSize.set(s, s); sun.shadow.bias = -.0004;
  Object.assign(sun.shadow.camera, { left: -shadow, right: shadow, top: shadow, bottom: -shadow, near: 1, far: 60 });
  scene.add(sun); return sun;
}
function palm(K, parent, x, z, s = 1, rnd = Math.random) {
  const g = K.group(x, 0, z, parent); g.rotation.y = rnd() * 6;
  let px = 0, py = 0; const lean = .25 + rnd() * .3, trunk = K.mat(0x8a6a4a);
  for (let i = 0; i < 6; i++) {
    const h = 1.1 * s, a = lean * i * .09, r = .22 * s * (1 - i * .07);
    const m = K.cyl(r * .9, r, h + .05, trunk, px + Math.sin(a) * h / 2, py + Math.cos(a) * h / 2, 0, g, 7); m.rotation.z = -a;
    px += Math.sin(a) * h; py += Math.cos(a) * h;
  }
  for (let k = 0; k < 8; k++) {
    const piv = new T.Group(); piv.position.set(px, py, 0); piv.rotation.y = k * Math.PI / 4; g.add(piv);
    const tilt = new T.Group(); tilt.rotation.x = .4 + rnd() * .25; piv.add(tilt);
    K.box(.5 * s, .05, 2.7 * s, K.mat(k % 2 ? 0x2f8f3a : 0x3fa34a), 0, 0, 1.35 * s, tilt);
  }
  for (let k = 0; k < 3; k++) K.ball(.18 * s, K.mat(0x6b7f2a), px + Math.cos(k * 2.1) * .28, py - .22, Math.sin(k * 2.1) * .28, g);
  return g;
}
function stiltHouse(K, parent, x, z, { w = 10, d = 6, wall = 0xc48a58, roof = 0x8a4b33, stilt = 1.6, h = 3.2 } = {}) {
  const g = K.group(x, 0, z, parent), post = K.mat(0x6b4a33);
  for (const px of [-w / 2 + .3, 0, w / 2 - .3]) for (const pz of [-d / 2 + .3, d / 2 - .3]) K.cyl(.14, .16, stilt, post, px, stilt / 2, pz, g, 8);
  K.box(w + .4, .25, d + .4, K.mat(0x7c5941), 0, stilt, 0, g);
  K.box(w, h, d, K.mat(wall), 0, stilt + h / 2 + .12, 0, g);
  const top = stilt + h + .12, sl = Math.hypot(d / 2 + .5, 1.8), ang = Math.atan2(1.8, d / 2 + .5);
  for (const s of [-1, 1]) { const r = K.box(w + 1, .18, sl, K.mat(roof), 0, top + .9, s * (d / 4 + .25), g); r.rotation.x = s * ang; }
  for (const px of [-w / 3, w / 3]) K.box(1.1, 1, .08, K.mat(0x2d4a52), px, stilt + h * .55, d / 2 + .02, g);
  K.box(1.2, 2.1, .08, K.mat(0x5a3b26), 0, stilt + 1.2, d / 2 + .02, g);
  return g;
}
function fitCamera(cam, aspect, halfW, halfH, dist) {
  const v = Math.max(halfH, halfW / aspect); cam.aspect = aspect; cam.fov = 2 * Math.atan(v / dist) * 180 / Math.PI; cam.updateProjectionMatrix();
}
class Sparks {
  constructor(scene, n, color, size) {
    this.n = n; this.pos = new Float32Array(n * 3).fill(-100); this.vel = new Float32Array(n * 3); this.life = new Float32Array(n); this.i = 0;
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(this.pos, 3));
    this.pts = new T.Points(g, new T.PointsMaterial({ color, size, transparent: true, depthWrite: false, opacity: .95 }));
    this.pts.frustumCulled = false; scene.add(this.pts);
  }
  add(x, y, z, vx, vy, vz, life = .7) { const i = this.i = (this.i + 1) % this.n; this.pos.set([x, y, z], i * 3); this.vel.set([vx, vy, vz], i * 3); this.life[i] = life; }
  update(dt, g = -9) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue; this.life[i] -= dt;
      if (this.life[i] <= 0) { this.pos[i * 3 + 1] = -100; continue; }
      this.vel[i * 3 + 1] += g * dt; for (let a = 0; a < 3; a++) this.pos[i * 3 + a] += this.vel[i * 3 + a] * dt;
    }
    this.pts.geometry.attributes.position.needsUpdate = true;
  }
}
function arrowMesh(K, scene) {
  const g = new T.Group(); scene.add(g);
  const m = K.mat(0xffd452, { emissive: 0x8a6400, emissiveIntensity: .5 });
  const c = K.mesh(new T.ConeGeometry(.28, .5, 16), m, 0, 0, 0, g, false); c.rotation.x = Math.PI;
  K.mesh(new T.CylinderGeometry(.1, .1, .4, 10), m, 0, .42, 0, g, false);
  return g;
}

// ------------------------------------------------------------ first-person helpers
// The player's own arms reach from the bottom corners of the screen to whatever the hands hold.
const SKIN = 0xb07a55, SLEEVE = 0x1f1f22;
function fpAnchor(camera, sx, sy = -1.12, dist = .5) {
  camera.updateMatrixWorld(); const v = new T.Vector3(sx, sy, .5).unproject(camera).sub(camera.position).normalize();
  return camera.position.clone().addScaledVector(v, dist);
}
function makeArm(K, scene) {
  const g = new T.Group(); scene.add(g); g.visible = false;
  const fg = new T.CylinderGeometry(.03, .04, 1, 10); fg.translate(0, .5, 0);
  const fore = K.mesh(fg, K.mat(SKIN), 0, 0, 0, g, false);
  const sg = new T.CylinderGeometry(.05, .055, 1, 10); sg.translate(0, .5, 0);
  const sleeve = K.mesh(sg, K.mat(SLEEVE), 0, 0, 0, g, false);
  const hand = K.ball(.045, K.mat(SKIN), 0, 1, 0, g); hand.castShadow = false; hand.scale.set(1.1, 1.25, .9);
  const up = new T.Vector3(0, 1, 0), d = new T.Vector3();
  return { g, set(from, to) { g.visible = false; return; /* first-person arms switched off (player feedback: distracting) */ if (!from || !to) { g.visible = false; return; } d.copy(to).sub(from); const L = Math.max(.05, d.length()); g.visible = true; g.position.copy(from); g.quaternion.setFromUnitVectors(up, d.divideScalar(L)); fore.scale.y = L; sleeve.scale.y = Math.min(.12, L * .2); hand.position.y = L; }, hide() { g.visible = false; } };
}
function fpArms(K, scene) { return { L: makeArm(K, scene), R: makeArm(K, scene) }; }
// right hand follows the pointer a little in front of the eyes (for tapping things)
function reachTo(camera, world, max = 1.1) { const d = world.clone().sub(camera.position), L = d.length(); return L > max ? camera.position.clone().addScaledVector(d, max / L) : world; }

// ------------------------------------------------------------ framework
export async function runGame3D(kind, opts = {}) {
  await load3D();
  let M = {}; try { M = await loadModels(); } catch {}
  const cv = $('gcv3'), ov = $('game');
  if (!renderer) {
    renderer = new T.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
    renderer.outputColorSpace = T.SRGBColorSpace; renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  }
  // fishing scenes use filmic (ACES) tone mapping like the town; other mini-games keep their original look
  { const filmic = kind === 'kail' || kind === 'seafish' || kind === 'fish'; renderer.toneMapping = filmic ? T.ACESFilmicToneMapping : T.NoToneMapping; renderer.toneMappingExposure = filmic ? 1.12 : 1; }
  ov.hidden = false; ov.classList.add('is3d');
  return new Promise((resolve) => {
    let alive = true, last = performance.now(), lw = 0, lh = 0;
    const tStart = performance.now(); let paused = 0, pauseAt = 0;
    const ptr = { x: 0, y: 0, lx: 0, ly: 0, mv: 0, sx: 0, sy: 0, sh: 1, down: false, on: false, hit: null };
    const bar = progressBar(); let finishing = false, shotCb = null;
    const api = {
      get renderer() { return renderer; }, // scenes may tune tone mapping / pixel ratio; they must restore it in stop()
      capture(cb) { shotCb = cb; },
      step(bm, en) { $('gStep').innerHTML = ''; $('gStep').append(bm); const s = document.createElement('small'); s.textContent = en; $('gStep').append(s); },
      progress(f) { bar.progress(f); },
      tools(list) { const t = $('gTools'); t.innerHTML = ''; for (const it of list) { const b = document.createElement('button'); b.innerHTML = it.html; if (it.sel) b.classList.add('sel'); if (it.on) b.onclick = () => it.on(b); else b.disabled = true; t.append(b); } },
      elapsed() { const n = performance.now(); return (n - tStart - paused - (pauseAt ? n - pauseAt : 0)) / 1000; },
      pause(on) { if (on) { if (!pauseAt) pauseAt = performance.now(); } else if (pauseAt) { paused += performance.now() - pauseAt; pauseAt = 0; } },
      isPaused: () => !!pauseAt,
      finish(result) { if (!alive) return; const time = api.elapsed(); bar.full(); finishing = true; setTimeout(() => { if (!alive) return; alive = false; cleanup(); resolve({ ...result, time }); }, 700); },
    };
    $('gTitle').textContent = ({ grass: 'Tebas Laman', repair: 'Baiki Rumah', carwash: 'Cuci Kereta', padi: 'Tuai Padi', boat: 'Baiki Bot', fish: 'Memancing', beach: 'Bersih Pantai', futsal3v3: 'Perlawanan 3v3 · Futsal', seafish: 'Simulator Pancing Laut', kail: 'Jelajah Kail', jalandrag: 'Jalan Drag' }[kind] || (ACTIVITIES[kind] || {}).title);
    $('gTools').innerHTML = ''; bar.reset();
    const K = kit();
    const game = { grass: Grass3D, repair: Repair3D, carwash: CarWash3D, padi: Padi3D, boat: Boat3D, fish: Fish3D, beach: Beach3D, futsal: Futsal3D, volley: VolleyV2, photo: PhotoV2, drag: Drag3D, market: Market3D, mall: MallV2, futsal3v3: Futsal3v3_3D, seafish: SeaFish3D, kail: Kail3D, jalandrag: JalanDrag3D }[kind](K, api, opts, M);
    window.__mg = game; setupHelp(kind, api); const unHide = pauseWhenHidden(api);
    const camera = new T.PerspectiveCamera(50, 1, .1, 200);
    const curPos = game.view.pos.clone(), curLook = game.view.look.clone();
    const rc = new T.Raycaster(), ndc = new T.Vector2();
    function cast(e) {
      const r = cv.getBoundingClientRect();
      ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      rc.setFromCamera(ndc, camera);
      const h = game.ray(rc);
      ptr.sx = e.clientX - r.left; ptr.sy = e.clientY - r.top; ptr.sh = r.height; ptr.hit = h ? h.hit : null;
      if (h && h.ok !== false) { if (!ptr.on) { ptr.lx = h.x; ptr.ly = h.y; } ptr.x = h.x; ptr.y = h.y; ptr.on = true; } else ptr.on = false;
    }
    const down = (e) => { e.preventDefault(); if (finishing) return; cv.setPointerCapture(e.pointerId); cast(e); ptr.down = true; framesDown = 0; upPending = false; ptr.lx = ptr.x; ptr.ly = ptr.y; game.down && game.down(ptr); };
    const move = (e) => { cast(e); game.move && game.move(ptr); };
    let framesDown = 0, upPending = false;
    const doUp = () => { upPending = false; if (!ptr.down) return; ptr.down = false; game.up && game.up(ptr); };
    const up = () => { if (!ptr.down) return; if (framesDown < 1) { upPending = true; return; } doUp(); };
    cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    $('gClose').onclick = () => { if (!alive) return; alive = false; cleanup(); resolve(null); };
    window.__mg3 = { ptr, inject(type, x, y, extra = {}) { Object.assign(ptr, { x, y, on: true, hit: null }, extra); if (type === 'down') { ptr.down = true; ptr.lx = x; ptr.ly = y; game.down && game.down(ptr); } else if (type === 'move') game.move && game.move(ptr); else doUp(); } };
    function cleanup() {
      ov.hidden = true; hideTutorial(); ov.classList.remove('is3d'); game.stop && game.stop(); unHide();
      cv.removeEventListener('pointerdown', down); cv.removeEventListener('pointermove', move); cv.removeEventListener('pointerup', up); cv.removeEventListener('pointercancel', up);
      game.scene.traverse((o) => {
        if (o.geometry && !isShared(o.geometry)) o.geometry.dispose(); // shared = model cache, reused by the town and the next game
        if (o.material) for (const m of [].concat(o.material)) { if (m.map && !isShared(m.map)) m.map.dispose(); if (!isShared(m)) m.dispose(); }
      });
    }
    function loop(now) {
      if (!alive) return; requestAnimationFrame(loop); bar.tick();
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      const w = cv.clientWidth, h = cv.clientHeight;
      if (w !== lw || h !== lh) { renderer.setPixelRatio(Math.min(devicePixelRatio || 1, isTouch ? 1.5 : 2)); renderer.setSize(w, h, false); lw = w; lh = h; }
      ptr.mv = ptr.down && ptr.on ? Math.min(game.mvCap || 1e9, Math.hypot(ptr.x - ptr.lx, ptr.y - ptr.ly)) : 0;
      game.update(dt, ptr, camera);
      ptr.lx = ptr.x; ptr.ly = ptr.y;
      if (ptr.down) framesDown++;
      if (upPending) doUp();
      const k = game.view.snap ? 1 : Math.min(1, dt * (game.view.speed || 3.5)); curPos.lerp(game.view.pos, k); curLook.lerp(game.view.look, k);
      camera.position.copy(curPos); camera.lookAt(curLook);
      fitCamera(camera, w / Math.max(1, h), game.view.halfW, game.view.halfH, curPos.distanceTo(curLook));
      renderer.render(game.scene, camera);
      if (shotCb) { const cb = shotCb; shotCb = null; let url = ''; try { url = cv.toDataURL('image/png'); } catch {} cb(url); }
      $('gTimer').textContent = game.timerText ? game.timerText() : `⏱ ${Math.floor(api.elapsed())}s`;
    }
    requestAnimationFrame(loop);
  });
}

// ------------------------------------------------------------ 1. TEBAS LAMAN (3D)
function Grass3D(K, api, opts, M = {}) {
  const scene = new T.Scene(); environment(K, scene, { shadow: 13 });
  const r = mulberry32(opts.seed || 3);
  K.box(70, .2, 70, K.mat(0x6aae4c), 0, -.1, 0, scene, false);
  K.box(19, .04, 10, K.mat(0x6b8f3a), 0, .01, 0, scene, false);
  K.box(70, .05, 4, K.mat(0xd9bf8f), 0, .02, 8.5, scene, false);
  stiltHouse(K, scene, 0, -8.5, { wall: 0xc48a58 });
  for (const [x, z, s] of [[-12, -6, 1.2], [12.5, -5, 1.1], [-13, 4, 1], [13, 3, 1.15], [-6, -13, 1], [7, -14, 1.1]]) palm(K, scene, x, z, s, r);
  for (let k = -9; k <= 9; k += 1.5) for (const z of [-5, 5]) { if (z === 5 && Math.abs(k) < 2) continue; K.box(.12, .8, .12, K.mat(0xa7835a), k, .4, z, scene); }
  for (const z of [-5, 5]) for (const y of [.35, .7]) K.box(18, .06, .06, K.mat(0xa7835a), 0, y, z, scene);

  // grass: instanced blades, 4 per grid cell
  const grid = new Grid(-9, -4.5, 18, 9, 46, 24, 1);
  for (let k = 0; k < grid.v.length; k++) grid.v[k] = .75 + r() * .25;
  const BL = 4, n = grid.v.length * BL;
  const bladeGeo = new T.ConeGeometry(.07, .6, 3); bladeGeo.translate(0, .3, 0);
  const blades = new T.InstancedMesh(bladeGeo, new T.MeshStandardMaterial({ roughness: .9 }), n);
  blades.castShadow = !isTouch; scene.add(blades);
  const off = []; const dummy = new T.Object3D(), col = new T.Color();
  for (let i = 0; i < n; i++) { off.push([(r() - .5) * .38, (r() - .5) * .36, r() * 6, (r() - .5) * .5, (r() - .5) * .5]); blades.setColorAt(i, col.setHSL(.26 + r() * .06, .55, .28 + r() * .12)); }
  const dirty = new Set();
  function setCell(k) {
    const h = grid.v[k], [cx, cz] = grid.center(k), s = h > .2 ? .35 + h * 1.05 : .14;
    for (let b = 0; b < BL; b++) { const o = off[k * BL + b]; dummy.position.set(cx + o[0], 0, cz + o[1]); dummy.rotation.set(o[3] * (h > .2 ? 1 : .2), o[2], o[4] * (h > .2 ? 1 : .2)); dummy.scale.set(1, s, 1); dummy.updateMatrix(); blades.setMatrixAt(k * BL + b, dummy.matrix); }
  }
  for (let k = 0; k < grid.v.length; k++) setCell(k);

  // brush cutter (start phase)
  const machine = K.group(0, 0, 7.4, scene);
  const orange = K.mat(0xe67e22, { roughness: .5 });
  K.box(1.3, .85, .9, orange, 1.2, .75, 0, machine);
  K.box(1.1, .25, .95, K.mat(0xc0601a), 1.2, .25, 0, machine);
  K.box(.5, .32, .04, K.mat(0x222222), 1.45, .95, .47, machine);
  const fuelFill = K.box(.44, .26, .05, K.mat(0xf6c343, { emissive: 0x6a4a00, emissiveIntensity: .4 }), 1.45, .83, .48, machine); fuelFill.scale.y = .01;
  const bulb = K.mesh(new T.SphereGeometry(.17, 16, 12), new T.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: .75, roughness: .2 }), .78, .85, .5, machine);
  bulb.userData.pick = 'bulb';
  const cord = K.box(.03, .03, .03, K.mat(0xdddddd), 2.05, .95, 0, machine);
  const grip = K.box(.5, .14, .16, K.mat(0x222222), 2.1, .95, .25, machine); grip.userData.pick = 'grip';
  const shaftM = K.mat(0x9a9a9a, { metalness: .6, roughness: .35 });
  const s0 = K.mesh(new T.CylinderGeometry(.06, .06, 4.2, 10), shaftM, -.9, .5, -.4, machine); s0.rotation.z = Math.PI / 2 - .22; s0.rotation.y = .2;
  K.cyl(.38, .38, .1, K.mat(0x333333), -2.95, .12, -.8, machine, 20);
  // red jerry can (tong minyak) with embossed X panels, three-bar handle and a spout
  const can = K.group(3.3, 0, 6.3, scene); can.userData.pick = 'can';
  { const red = K.mat(0xc62828, { roughness: .38 }), dark = K.mat(0x8e1b1b, { roughness: .5 }), c = K.group(0, 0, 0, can); c.scale.setScalar(1.5);
    K.box(.36, .46, .17, red, 0, .23, 0, c); K.box(.37, .04, .18, dark, 0, .02, 0, c);
    for (const sd of [-1, 1]) for (const a of [.9, -.9]) { const x = K.box(.32, .022, .012, dark, 0, .23, sd * .088, c); x.rotation.z = a; }
    K.box(.28, .035, .05, dark, -.03, .53, 0, c); for (const x of [-.15, -.03, .09]) K.box(.03, .07, .05, dark, x, .48, 0, c);
    const sp = K.cyl(.032, .04, .13, K.mat(0x2a2a2a), .14, .51, 0, c, 10); sp.rotation.z = -.55;
    const cp = K.cyl(.045, .045, .04, K.mat(0xf1c40f, { roughness: .4 }), .175, .565, 0, c, 10); cp.rotation.z = -.55; }
  const SPOUT = new T.Vector3(.2, .6, 0).multiplyScalar(1.5); // spout tip in can space

  putModel(M, 'shovel', scene, -3.6, 8.2, { h: 1.5, ry: .4 }); putModel(M, 'rope', scene, -2.4, 8.6, { h: .45 }); putModel(M, 'bucket', scene, 5.2, 8.4, { h: .7 });
  for (const [x, z, k] of [[-11, 7, 'fbush1'], [10.5, 7.5, 'fbush3'], [-7, 10, 'fgrass1'], [7, 10.5, 'fgrass3'], [-12.5, -3, 'ftree2'], [13, -2, 'ftree4']]) putModel(M, k, scene, x, z, { h: k.startsWith('ftree') ? 5 : k.startsWith('fbush') ? 1.2 : .6, ry: x });
  // trimmer (cut phase)
  const trimmer = K.group(0, 0, 0, scene); trimmer.visible = false;
  K.cyl(.36, .36, .12, K.mat(0x333333), 0, .15, 0, trimmer, 20);
  const spin = new T.Group(); spin.position.y = .1; trimmer.add(spin);
  K.box(1.5, .02, .04, K.mat(0xffd452, { emissive: 0x6a5000 }), 0, 0, 0, spin);
  K.box(.04, .02, 1.5, K.mat(0xffd452, { emissive: 0x6a5000 }), 0, 0, 0, spin);
  const guard = K.mesh(new T.CylinderGeometry(.6, .6, .05, 20, 1, false, 0, Math.PI), orange, 0, .32, 0, trimmer);
  guard.rotation.y = Math.PI;
  const shaftGeo = new T.CylinderGeometry(.06, .06, 1, 10); shaftGeo.rotateX(Math.PI / 2); shaftGeo.translate(0, 0, .5);
  const shaft = K.mesh(shaftGeo, shaftM, 0, .3, 0, trimmer); shaft.scale.z = 7;
  const engineBack = K.box(.8, .5, .6, orange, 0, 0, 0, trimmer);
  const clips = new Sparks(scene, 400, 0x4f9a3c, .1);

  // TYRANZ backpack brush cutter: lying on the grass for the start-up, then worn (first-person) while cutting
  let G0 = new T.Vector3(2.1, .95, .25), C0 = new T.Vector3(2.05, .95, 0), FY = .7, BULB = new T.Vector3(.78, .85, .5);
  const groundModel = putModel(M, 'cutter', machine, 1.5, -.15, { scale: 1, ry: Math.PI });
  if (groundModel) {
    for (const c of [...machine.children]) if (c !== groundModel && ![bulb, grip, cord, fuelFill].includes(c)) c.visible = false;
    machine.updateMatrixWorld(true);
    const ctr = (n) => { const o = groundModel.getObjectByName(n); if (!o) return null; const b = new T.Box3().setFromObject(o); return machine.worldToLocal(b.getCenter(new T.Vector3())); };
    const sp = ctr('starter_pump'), tank = ctr('white_fuel_tank'), grill = ctr('engine_orange_cover');
    if (sp) { sp.z += .08; BULB.copy(sp); bulb.position.copy(sp); bulb.geometry.scale(.65, .65, .65); }
    if (tank) { fuelFill.position.set(tank.x, tank.y, tank.z + .27); FY = tank.y - .1; fuelFill.scale.y = .01; }
    if (grill) { G0.set(grill.x + .05, grill.y - .08, grill.z + .4); C0.copy(G0).add(new T.Vector3(.05, 0, -.3)); grip.position.copy(G0); cord.position.copy(C0); }
  }
  // prep details: sight gauge, choke lever, fuel cap, exhaust, longer grass around the machine
  let CAP = new T.Vector3(1.6, 1.25, 0), EXH = new T.Vector3(.4, .6, .2), ENG = new T.Vector3(1.2, .6, 0), capObj = null, capHome = null;
  const choke = K.group(1.0, .75, .35, machine); { const kb = K.box(.05, .2, .05, K.mat(0x202020), 0, .1, 0, choke); K.box(.12, .05, .07, K.mat(0xe74c3c, { roughness: .4 }), 0, .2, 0, choke); kb.castShadow = false; }
  const gaugeGlass = K.box(.5, .32, .03, new T.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: .35, roughness: .1 }), 0, 0, 0, machine, false);
  if (groundModel) {
    const ctr2 = (n) => { const o = groundModel.getObjectByName(n); if (!o) return null; const b = new T.Box3().setFromObject(o); return machine.worldToLocal(b.getCenter(new T.Vector3())); };
    const cap = ctr2('fuel_cap'), cover = ctr2('engine_orange_cover'), grl = ctr2('engine_front_black_grill');
    if (cap) CAP.copy(cap); if (cover) { ENG.copy(cover); choke.position.set(cover.x + .12, cover.y + .16, cover.z + .3); } if (grl) EXH.copy(grl);
    capObj = groundModel.getObjectByName('fuel_cap'); if (capObj) capHome = capObj.position.clone();
  }
  gaugeGlass.position.copy(fuelFill.position).add(new T.Vector3(0, .04, -.01));
  { const tuft = new T.InstancedMesh(bladeGeo, new T.MeshStandardMaterial({ roughness: .9 }), 260), d = new T.Object3D(), c = new T.Color();
    for (let i = 0; i < 260; i++) { const a = r() * 6.28, u = 1 + r() * 2.2; let zz = Math.sin(a) * u * .8; if (zz > .9) zz = -zz * .6; d.position.set(Math.cos(a) * u * 1.4, 0, zz); d.rotation.set((r() - .5) * .5, r() * 6, (r() - .5) * .5); d.scale.set(.7, .35 + r() * .55, .7); d.updateMatrix(); tuft.setMatrixAt(i, d.matrix); tuft.setColorAt(i, c.setHSL(.25 + r() * .07, .55, .27 + r() * .14)); }
    tuft.position.set(ENG.x, 0, ENG.z); machine.add(tuft);
    const lawn = K.mesh(new T.CircleGeometry(3.4, 40), K.mat(0x5f9e3c, { roughness: 1 }), ENG.x - .4, .06, ENG.z, machine, false); lawn.rotation.x = -Math.PI / 2; lawn.scale.set(1.25, .8, 1); }
  const canHome = machine.localToWorld(ENG.clone().setY(0).add(new T.Vector3(1.05, 0, .3))); can.position.copy(canHome); can.rotation.y = -.5;
  const smoke = new Sparks(scene, 140, 0x9a9a9a, .22), fuelDrops = new Sparks(scene, 160, 0xf3b62b, .05);
  const wornRig = K.group(0, 0, 0, scene); wornRig.visible = false; const wornPivot = K.group(0, 0, 0, wornRig); wornPivot.rotation.z = -.46;
  const wornModel = putModel(M, 'cutter', wornPivot, 0, 0, { scale: 1 });
  const gripL = new T.Vector3(1.96, .74, -.37), gripR = new T.Vector3(1.96, .74, .37);
  if (wornModel) {
    const C = wornModel.children[0].position.clone().negate(); // putModel re-centres the model: raw coords → wrap coords
    wornModel.position.set(-(3.3 - C.x), -(.37 - C.y), 0); gripL.sub(C); gripR.sub(C); // put the blade hub at the pivot
    wornModel.traverse((o) => { if (o.isMesh && /^(backpack|frame_leg|engine|vent|white_fuel|tank_strap|fuel_cap|starter|flexible|motor_side|orange_engine|cutting_blade|cutting_hub|cutting_spindle|orange_cutting_guard)/.test(o.name)) o.visible = false; });
    for (const c of [shaft, engineBack]) c.visible = false;
  }
  const arms = fpArms(K, scene);
  const me = { x: 0, z: 4.3, yaw: 0 }, REACH = 1.65, head = new T.Vector3(0, 0, 4.3 - REACH), lastHead = head.clone();
  let hintT = 0, hintCell = null;
  // bag & piles
  // black rubbish bag: a wrinkled glossy plastic sack that stands open, fills up, then gets knotted
  const bag = K.group(7.3, 0, 2.6, scene); bag.visible = false; bag.userData.pick = 'bag';
  const plastic = new T.MeshStandardMaterial({ color: 0x121316, roughness: .26, metalness: .05, side: T.DoubleSide });
  const bagBody = K.mesh(new T.BufferGeometry(), plastic, 0, 0, 0, bag);
  const bagGrass = new T.InstancedMesh(bladeGeo, new T.MeshStandardMaterial({ roughness: .9 }), 70); bag.add(bagGrass); bagGrass.visible = false;
  { const d = new T.Object3D(), c = new T.Color(); for (let i = 0; i < 70; i++) { const a = r() * 6.28, u = Math.sqrt(r()) * .42; d.position.set(Math.cos(a) * u, 0, Math.sin(a) * u); d.rotation.set(.6 + r() * .9, r() * 6.28, 0); d.scale.set(1, .45 + r() * .4, 1); d.updateMatrix(); bagGrass.setMatrixAt(i, d.matrix); bagGrass.setColorAt(i, c.setHSL(.24 + r() * .07, .5, .26 + r() * .12)); } }
  const knot = K.group(0, 0, 0, bag); knot.visible = false;
  K.ball(.11, plastic, 0, 0, 0, knot).scale.set(1.2, .9, 1.1);
  for (const sd of [-1, 1]) { const ear = K.mesh(new T.ConeGeometry(.13, .42, 7), plastic, sd * .13, .17, 0, knot); ear.scale.set(1, 1, .35); ear.rotation.z = -sd * .75; ear.rotation.y = sd * .3; }
  function bagShape(fill, tied) {
    const H = .78 + fill * .55, R = .4 + fill * .2, pts = [];
    for (let i = 0; i <= 26; i++) {
      const y = H * i / 26, k = y / H; let rr;
      if (k < .1) rr = R * Math.sin((k / .1) * Math.PI / 2) * .96;           // rounded bottom
      else if (k < .72) rr = R * (1 + (tied ? .14 : .1) * Math.sin((k - .1) / .62 * Math.PI)); // bulging body
      else rr = tied ? R * Math.max(.07, 1 - ((k - .72) / .28) ** .55 * .95)     // gathered neck
        : R * (1 - (k - .72) * (fill < .5 ? .9 : .5));                          // open, slightly slumped mouth
      pts.push(new T.Vector2(Math.max(.002, rr), y));
    }
    if (!tied) { const top = pts[pts.length - 1]; pts.push(new T.Vector2(top.x * 1.12, H + .05), new T.Vector2(top.x * 1.18, H - .08)); } // folded-over rim
    const g = new T.LatheGeometry(pts, 44), pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) { // creases and crinkles of thin plastic, stronger towards the top
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), a = Math.atan2(z, x), k = y / H;
      const w = .045 * Math.sin(a * 7 + y * 9) + .025 * Math.sin(a * 13 - y * 17) + .06 * k * k * Math.sin(a * 11 + 1.3) * (tied ? 1.6 : 1) + .015 * Math.sin(a * 23 + y * 31);
      const f = 1 + w; pos.setXYZ(i, x * f, y + .02 * Math.sin(a * 5) * k, z * f);
    }
    g.computeVertexNormals(); bagBody.geometry.dispose(); bagBody.geometry = g;
    bagGrass.visible = !tied && fill > 0; bagGrass.position.y = H * (.55 + .35 * fill); bagGrass.scale.setScalar(.7 + fill * .5);
    knot.visible = tied; knot.position.y = H + .02;
  }
  bagShape(0, false);
  let piles = [];
  // a raked heap of the same grass blades that were just cut (lying every which way, a few dry ones)
  function grassPile(x, z) {
    const g = K.group(x, 0, z, scene), N = 150, d = new T.Object3D(), c = new T.Color();
    const base = K.ball(.62, K.mat(0x4a7a2e, { roughness: 1 }), 0, .02, 0, g); base.scale.set(1.15, .3, .9);
    const im = new T.InstancedMesh(bladeGeo, new T.MeshStandardMaterial({ roughness: .9 }), N); im.castShadow = !isTouch; g.add(im);
    for (let i = 0; i < N; i++) {
      const a = r() * 6.28, u = Math.sqrt(r()), rx = Math.cos(a) * u * .78, rz = Math.sin(a) * u * .62, top = (1 - u * u) * .32;
      d.position.set(rx, top * (.35 + r() * .65), rz); d.rotation.set(1.05 + r() * .8, r() * 6.28, (r() - .5) * .6); d.scale.set(1, .5 + r() * .45, 1); d.updateMatrix(); im.setMatrixAt(i, d.matrix);
      im.setColorAt(i, r() < .12 ? c.setHSL(.15 + r() * .04, .45, .45) : c.setHSL(.25 + r() * .07, .55, .26 + r() * .14));
    }
    return g;
  }
  const arrow = arrowMesh(K, scene);
  const ground = new T.Plane(new T.Vector3(0, 1, 0), 0), hitPt = new T.Vector3();
  const pickables = [bulb, grip, can, bag];

  // first-person views: standing over the machine, then at the edge of the yard
  const START_VIEW = { pos: new T.Vector3(1.2, 1.8, 10.7), look: new T.Vector3(1.2, .3, 7.3), halfW: 3.7, halfH: 1.9 };
  const CUT_VIEW = { pos: new T.Vector3(0, 1.7, 7.6), look: new T.Vector3(0, 0, 1.4), halfW: 7.5, halfH: 4 };
  const YARD_VIEW = { pos: new T.Vector3(1, 17, 5.2), look: new T.Vector3(1, 0, .5), halfW: 9.8, halfH: 5.8 }; // top view to gather the heaps into the bag
  const view = { ...START_VIEW, pos: START_VIEW.pos.clone(), look: START_VIEW.look.clone() };
  const setView = (v) => { view.pos.copy(v.pos); view.look.copy(v.look); view.halfW = v.halfW; view.halfH = v.halfH; };

  let phase = 'fuel', fuel = .06, filling = false, primes = 0, squish = 0, pulls = 0, pullStart = null, engine = null, held = null, bagFill = 0, t = 0;
  let pourK = 0, chokeClosed = false, chokeK = 0, running = 0, cordK = 0, spilled = 0;
  // close-up "start the cutter" view + side panel (steps, fuel gauge, buttons, pull-cord slider)
  const PREP = (() => { const e = machine.localToWorld(ENG.clone()); return { pos: e.clone().add(new T.Vector3(-1.05, 1.25, 3.1)), look: e.clone().add(new T.Vector3(.3, -.1, 0)) }; })();
  view.pos.copy(PREP.pos); view.look.copy(PREP.look); view.halfW = 1.45; view.halfH = .9;
  const PSTEPS = [['fuel', 'Isi minyak', 'Fuel'], ['primer', 'Pam primer', 'Primer'], ['choke', 'Tutup choke', 'Close choke'], ['pull', 'Tarik tali', 'Pull cord'], ['open', 'Buka choke', 'Open choke']];
  const SAY = { fuel: 'Mesin lama Tok ni. Minyak dah kering — isi dulu, cu.', primer: 'Picit bulb tu sampai nampak minyak naik.', choke: 'Enjin sejuk, kena tutup choke dulu.', pull: 'Tarik laju dan panjang. Jangan takut!', open: 'Dah hidup! Cepat buka choke, nanti mati.' };
  const SAY_EN = { fuel: "It's my old machine. The tank is dry — fill it first.", primer: 'Squeeze the bulb until you see fuel come up.', choke: 'A cold engine needs the choke closed first.', pull: "Pull fast and long. Don't be shy!", open: "It's running! Open the choke quick or it'll stall." };
  const panel = document.createElement('div'); panel.id = 'prep'; $('game').append(panel);
  const say = document.createElement('div'); say.id = 'prepSay'; $('game').append(say);
  const btn = (id, txt, cls = '') => `<button id="${id}" class="pBtn ${cls}">${txt}</button>`;
  function renderPanel() {
    const k = PSTEPS.findIndex(s => s[0] === phase);
    const chips = PSTEPS.map(([id, bm], i) => `<span class="${i < k ? 'ok' : i === k ? 'on' : ''}">${i < k ? '✓' : i + 1}. ${bm}</span>`).join('');
    let body = '';
    if (phase === 'fuel') body = `<div class="pRow"><div class="pGauge"><i class="band"></i><b id="pFuel"></b><em id="pPct"></em></div><div class="pCol"><p>Petrol campur minyak 2T. Isi sampai <b>garis hijau</b> — jangan tumpah!<small>2-stroke fuel mix. Fill to the green band — don't spill!</small></p>${btn('pPour', 'Tahan untuk tuang · Hold to pour')}${btn('pNext', 'Cukup, seterusnya · Next', 'alt')}</div></div>`;
    else if (phase === 'primer') body = `<p>Picit bulb primer sampai minyak naik (<b id="pPrime">${primes}/4</b>).<small>Squeeze the primer bulb until fuel shows (${primes}/4). You can also tap the bulb.</small></p>${btn('pSq', 'Picit primer · Squeeze')}`;
    else if (phase === 'choke') body = `<p>Enjin sejuk perlukan choke. Tolak tuas ke <b>TUTUP</b>.<small>A cold engine needs the choke. Push the lever to CLOSED.</small></p>${btn('pChoke', 'Choke: BUKA → TUTUP')}`;
    else if (phase === 'pull') body = `<div class="pRow"><div class="pTrack" id="pTrack"><b id="pT">T</b></div><div class="pCol"><p>Seret pemegang <b>ke bawah</b>, laju dan panjang!<small>Drag the handle all the way down, fast!</small></p><p class="pMini">Tarikan · Pulls: <b id="pPulls">${pulls}</b>/2 &nbsp; Choke: <b>${chokeClosed ? 'TUTUP' : 'BUKA'}</b></p></div></div>`;
    else if (phase === 'open') body = `<p>Enjin hidup tapi tersedak-sedak. <b>Buka choke</b> sekarang!<small>It's running but sputtering. Open the choke now!</small></p>${btn('pOpen', 'Choke: TUTUP → BUKA', 'hot')}`;
    panel.innerHTML = `<div class="pKick">SEDIA MESIN RUMPUT · START THE CUTTER</div><div class="pChips">${chips}</div>${body}`;
    { const hd = document.querySelector('#game .gHead'); say.style.setProperty('--hdr', `${hd ? hd.offsetHeight + 6 : 120}px`); }
    say.innerHTML = `<b>TOK ABAH</b>${SAY[phase] || ''}<small>${SAY_EN[phase] || ''}</small>`;
    const $$ = (id) => panel.querySelector('#' + id);
    if (phase === 'fuel') { const pour = $$('pPour'); const on = (e) => { e.preventDefault(); filling = true; pour.classList.add('down'); }, off = () => { filling = false; pour.classList.remove('down'); };
      pour.addEventListener('pointerdown', on); for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) pour.addEventListener(ev, off);
      $$('pNext').onclick = () => { if (fuel < .8) { sfx.bad(); toast('Belum cukup — isi sampai garis hijau', 'Not enough — fill up to the green band'); return; } filling = false; sfx.good(); go('primer'); }; }
    if (phase === 'primer') $$('pSq').onclick = () => prime();
    if (phase === 'choke') $$('pChoke').onclick = () => { chokeClosed = true; sfx.tap(); sfx.pop(); setTimeout(() => go('pull'), 350); };
    if (phase === 'open') $$('pOpen').onclick = () => { chokeClosed = false; running = 2; sfx.good(); engine && engine.set(.13, 78); toast('Enjin hidup elok!', 'The engine runs smooth!'); setTimeout(() => { if (phase === 'open') startCut(); }, 1100); };
    if (phase === 'pull') { const tr = $$('pTrack'), hd = $$('pT'); let st = null;
      const pos = (e) => { const b = tr.getBoundingClientRect(); return clamp((e.clientY - b.top - 22) / (b.height - 44), 0, 1); };
      tr.addEventListener('pointerdown', (e) => { e.preventDefault(); tr.setPointerCapture(e.pointerId); st = { t: performance.now(), y0: pos(e) }; });
      tr.addEventListener('pointermove', (e) => { if (!st) return; cordK = Math.max(0, pos(e) - st.y0); hd.style.transform = `translateY(${cordK * (tr.clientHeight - 44)}px)`; });
      const end = () => { if (!st) return; const dur = (performance.now() - st.t) / 1000, fr = cordK; st = null; hd.style.transform = ''; cordK = 0; doPull(fr, dur); };
      tr.addEventListener('pointerup', end); tr.addEventListener('pointercancel', end); }
    updateFuelUI();
  }
  function updateFuelUI() { const f = panel.querySelector('#pFuel'), pc = panel.querySelector('#pPct'); if (f) f.style.height = `${Math.min(1, fuel) * 100}%`; if (pc) pc.textContent = `${Math.round(Math.min(1, fuel) * 100)}%`; }
  function go(ph) { phase = ph; renderPanel(); const k = PSTEPS.findIndex(s => s[0] === ph); api.progress(k / PSTEPS.length); api.step(`${k + 1}. ${PSTEPS[k][1]}`, PSTEPS[k][2]); }
  function prime() { if (phase !== 'primer') return; primes++; squish = 1; sfx.pop(); const e = panel.querySelector('#pPrime'); if (e) e.textContent = `${primes}/4`; if (primes >= 4) { sfx.good(); setTimeout(() => go('choke'), 400); } }
  function puff(n, big) { const w = machine.localToWorld(EXH.clone()); for (let k = 0; k < n; k++) smoke.add(w.x + (Math.random() - .5) * .2, w.y, w.z + (Math.random() - .5) * .2, -.6 - Math.random() * .8, .6 + Math.random() * (big ? 1.4 : .6), (Math.random() - .5) * .6, big ? 1.4 : .8); }
  function doPull(fr, dur) {
    if (fr > .8 && dur < .75) {
      pulls++; sfx.pull(); puff(10, false);
      if (pulls === 1) { sfx.cough(); toast('Batuk… hampir! Tarik sekali lagi!', 'It coughed… almost! Pull once more!'); renderPanel(); }
      else { sfx.cough(); puff(30, true); running = 1; engine = loopSound('engine'); engine.set(.13, 55); go('open'); }
    } else if (fr > .1) { sfx.cough(); toast(fr <= .8 ? 'Tarik lebih panjang!' : 'Lagi laju!', fr <= .8 ? 'Pull further down!' : 'Faster!'); }
  }
  renderPanel(); go('fuel');

  function startCut() {
    phase = 'cut'; panel.remove(); say.remove(); machine.visible = false; can.visible = false; trimmer.visible = true; wornRig.visible = !!wornModel; setView(CUT_VIEW); api.progress(0);
    if (!engine) engine = loopSound('engine'); engine.set(.12, 70);
    api.step('Tekan & seret — mesin ikut jari kau, kau pun berjalan', 'Press & drag — the cutter follows your finger and you walk with it');
  }
  return {
    scene, view, mvCap: 2.5,
    ray(rc) {
      const hits = rc.intersectObjects(pickables.filter(o => o.visible && (o.parent ? o.parent.visible : true)), true);
      let hit = null; if (hits.length) { let o = hits[0].object; while (o && !o.userData.pick) o = o.parent; hit = o ? o.userData.pick : null; }
      const ok = rc.ray.intersectPlane(ground, hitPt);
      return { x: ok ? hitPt.x : 0, y: ok ? hitPt.z : 0, ok: !!ok, hit };
    },
    dbg: () => { let near = null, bd = 1e9; for (let k = 0; k < grid.v.length; k++) if (grid.v[k] > .2) { const [x, z] = grid.center(k), d = Math.hypot(x - head.x, z - head.z); if (d < bd) { bd = d; near = { x, z }; } }
      return { phase, head: { x: head.x, z: head.z }, near, left: grid.frac(v => v > .2), piles: piles.map(p => ({ x: p.position.x, y: p.position.z, done: !p.visible })), bag: { x: bag.position.x, y: bag.position.z } }; },
    down(p) {
      if (phase === 'primer' && p.hit === 'bulb') prime();
      else if (phase === 'pull' && p.hit === 'grip') pullStart = { sy: p.sy, t: performance.now() };
      else if (phase === 'bag') { let best = null, bd = 1.3; for (const pl of piles) if (pl.visible) { const d = Math.hypot(p.x - pl.position.x, p.y - pl.position.z); if (d < bd) { bd = d; best = pl; } } if (best) { held = best; sfx.tap(); } }
      else if (phase === 'tie' && (p.hit === 'bag' || Math.hypot(p.x - bag.position.x, p.y - bag.position.z) < 1.6)) {
        phase = 'done'; bagShape(1, true); sfx.bag(); sfx.good(); const tt = api.elapsed(); setTimeout(() => api.finish({ stars: starsFor(tt, 55, 85) }), 900);
      }
    },
    move(p) {
      if (pullStart) { const d = clamp((p.sy - pullStart.sy) / p.sh * 3, 0, 1.6); grip.position.set(G0.x + d * .3, G0.y - d * .2, G0.z + d); cord.scale.set(1, 1, 1 + d * 30); cord.position.set(C0.x + d * .15, C0.y - d * .1, C0.z + (G0.z - C0.z + d) / 2); }
      if (held) held.position.set(p.x, .45, p.y);
    },
    up(p) {
      if (pullStart) {
        const frac = (p.sy - pullStart.sy) / p.sh, dur = (performance.now() - pullStart.t) / 1000; pullStart = null;
        grip.position.copy(G0); cord.scale.set(1, 1, 1); cord.position.copy(C0);
        doPull(frac > .18 ? .9 : frac * 4, dur);
      }
      if (held) {
        if (Math.hypot(held.position.x - bag.position.x, held.position.z - bag.position.z) < 1.9) {
          held.visible = false; bagFill++; sfx.bag(); bagShape(bagFill / piles.length, false); api.progress(bagFill / piles.length);
          if (bagFill === piles.length) { phase = 'tie'; api.step('Ketik beg untuk ikat', 'Tap the bag to tie it up'); }
        } else held.position.y = 0;
        held = null;
      }
    },
    update(dt, p, cam) {
      t += dt;
      // --- start-up animation: pouring, cap, gauge, choke lever, cord, vibration, smoke
      pourK = clamp(pourK + (filling && phase === 'fuel' ? dt * 3 : -dt * 3), 0, 1);
      if (filling && phase === 'fuel' && pourK > .8) {
        fuel += dt * .42; if (Math.random() < .6) { const tip = can.localToWorld(SPOUT.clone()); fuelDrops.add(tip.x, tip.y, tip.z, (Math.random() - .5) * .2, -.5, (Math.random() - .5) * .2, .35); }
        if (fuel > 1) { fuel = .96; spilled++; filling = false; panel.querySelector('#pPour')?.classList.remove('down'); sfx.bad(); toast('Tumpah! Isi sampai garis hijau saja', 'Spilled! Only fill to the green band'); const cw = machine.localToWorld(CAP.clone()); for (let k = 0; k < 30; k++) fuelDrops.add(cw.x, cw.y, cw.z, (Math.random() - .5) * 2, 1 + Math.random(), (Math.random() - .5) * 2, .6); }
        updateFuelUI();
      }
      { const capW = machine.localToWorld(CAP.clone()); can.rotation.set(0, -.5 * (1 - pourK), -1.15 * pourK); can.position.copy(canHome); can.updateMatrixWorld(true);
        if (pourK > 0) { const tip = can.localToWorld(SPOUT.clone()), want = capW.clone().add(new T.Vector3(0, .32, 0)); can.position.add(want.sub(tip).multiplyScalar(pourK)); } }
      if (capObj && capHome) { capObj.position.copy(capHome).add(new T.Vector3(0, .25 * pourK, 0)); capObj.rotation.x = pourK * .8; }
      fuelFill.scale.y = Math.max(.01, Math.min(1, fuel)); fuelFill.position.y = FY + .13 * Math.min(1, fuel);
      chokeK += ((chokeClosed ? 1 : 0) - chokeK) * Math.min(1, dt * 10); choke.rotation.z = chokeK * 1.1;
      if (phase === 'pull' || pullStart) { const k = pullStart ? .6 : cordK; grip.position.set(G0.x - k * .3, G0.y - k * .25, G0.z + k * 1.1); cord.scale.set(1, 1, 1 + k * 34); cord.position.set(C0.x - k * .15, C0.y - k * .12, C0.z + (G0.z - C0.z + k * 1.1) / 2); }
      if (running && machine.visible) { machine.position.x = Math.sin(t * 70) * (running === 1 ? .018 : .008); if (Math.random() < (running === 1 ? .5 : .15)) puff(1, running === 1); if (running === 1 && engine) engine.set(.12 + Math.sin(t * 9) * .05, 50 + Math.sin(t * 7) * 12); }
      smoke.update(dt, 1.2); fuelDrops.update(dt, -9);
      { const pc = bulb.material; pc.color.setRGB(1, 1 - Math.min(primes, 4) * .07, 1 - Math.min(primes, 4) * .2); }
      // keep the machine to the left of the panel (landscape) or above it (portrait)
      if (phase !== 'cut' && !['bag', 'tie', 'done'].includes(phase) && cam) {
        const asp = cam.aspect || 1, fwd = PREP.look.clone().sub(PREP.pos).normalize(), right = new T.Vector3().crossVectors(fwd, new T.Vector3(0, 1, 0)).normalize(), up = new T.Vector3().crossVectors(right, fwd);
        const off = right.multiplyScalar(asp > 1 ? .7 : 0).add(up.multiplyScalar(asp > 1 ? 0 : -.6));
        view.pos.copy(PREP.pos).add(off); view.look.copy(PREP.look).add(off); view.halfW = asp > 1 ? 2.1 : 1.5; view.halfH = asp > 1 ? 1.15 : 1.45;
      }
      squish = Math.max(0, squish - dt * 5); bulb.scale.set(1 + squish * .2, 1 - squish * .45, 1 + squish * .2);
      if (phase === 'cut') {
        // first person: walk so the cutter head follows the finger, turning towards it
        if (p.down && p.on) {
          const dx = p.x - me.x, dz = p.y - me.z, L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L;
          const want = Math.atan2(-ux, -uz); let dy = want - me.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
          me.yaw += clamp(dy, -2.6 * dt, 2.6 * dt);
          const tx = p.x - ux * REACH, tz = p.y - uz * REACH, mx = tx - me.x, mz = tz - me.z, mL = Math.hypot(mx, mz), sp = Math.min(mL, 3.2 * dt);
          if (mL > 1e-3) { me.x += mx / mL * sp; me.z += mz / mL * sp; }
          me.x = clamp(me.x, -8.5, 8.5); me.z = clamp(me.z, -4.2, 4.5);
        }
        const fx = -Math.sin(me.yaw), fz = -Math.cos(me.yaw);
        lastHead.copy(head); head.set(me.x + fx * REACH, 0, me.z + fz * REACH);
        trimmer.position.copy(head); trimmer.rotation.y = me.yaw; wornRig.position.set(head.x, .06, head.z); wornRig.rotation.y = me.yaw + Math.PI / 2;
        spin.rotation.y += dt * 40;
        Object.assign(view, { halfW: 3.1, halfH: 2 }); view.pos.set(me.x - fx * .45, 1.78, me.z - fz * .45); view.look.set(head.x + fx * .35, 0, head.z + fz * .35);
        if (cam) { if (wornModel) { wornRig.updateMatrixWorld(true); arms.L.set(fpAnchor(cam, -.5), wornModel.localToWorld(gripL.clone())); arms.R.set(fpAnchor(cam, .5), wornModel.localToWorld(gripR.clone())); } else { arms.L.hide(); arms.R.set(fpAnchor(cam, .5), head.clone().setY(.5)); } }
        const hm = lastHead.distanceTo(head);
        let cutting = false;
        if (p.down) grid.seg(lastHead.x, lastHead.z, head.x, head.z, 1.05, (k) => {
          if (grid.v[k] > .2) { grid.v[k] -= dt * 9 + hm * 1.25; cutting = true; dirty.add(k);
            if (Math.random() < .2) { const [x, z] = grid.center(k); clips.add(x, .4, z, (Math.random() - .5) * 5, 2 + Math.random() * 3, (Math.random() - .5) * 5, .7); } }
        });
        engine && engine.set(.12, cutting ? 110 : p.down ? 85 : 70);
        const f = grid.frac(v => v <= .2); api.progress(f / .96);
        if (f >= .96) {
          phase = 'bag'; engine && engine.stop(); engine = null; trimmer.visible = false; wornRig.visible = false; setView(YARD_VIEW);
          for (let k = 0; k < grid.v.length; k++) if (grid.v[k] > .15) { grid.v[k] = .15; dirty.add(k); }
          for (let k = 0; k < 6; k++) {
            piles.push(grassPile(-6.5 + (k % 3) * 5 + r() * 1.5, -2 + Math.floor(k / 3) * 3.6 + r() * .8));
          }
          bag.visible = true; api.progress(0); sfx.good();
          api.step('Seret longgok rumput ke dalam plastik hitam', 'Drag the grass piles into the black bag');
        }
      }
      if (dirty.size) { for (const k of dirty) setCell(k); dirty.clear(); blades.instanceMatrix.needsUpdate = true; }
      clips.update(dt);
      // hint arrow
      if (phase === 'cut' && (hintT -= dt) <= 0) { hintT = .5; let bd = 1e9; hintCell = null; for (let k = 0; k < grid.v.length; k++) if (grid.v[k] > .2) { const [x, z] = grid.center(k), d = Math.hypot(x - head.x, z - head.z); if (d < bd) { bd = d; hintCell = bd > 2.6 ? [x, 1.2, z] : null; } } }
      const bw = machine.localToWorld(BULB.clone()), gw = machine.localToWorld(G0.clone());
      const target = phase === 'primer' ? [bw.x, bw.y + .45, bw.z] : phase === 'choke' ? (() => { const c = choke.getWorldPosition(new T.Vector3()); return [c.x, c.y + .45, c.z]; })() : phase === 'tie' ? [bag.position.x, 2.4, bag.position.z] : phase === 'cut' ? hintCell : null;
      if (['bag', 'tie', 'done'].includes(phase)) { arms.L.hide(); arms.R.hide(); }
      else if (phase !== 'cut' && cam) {
        if (pourK > .05) { arms.R.set(fpAnchor(cam, .5), can.localToWorld(new T.Vector3(-.05, .95, 0))); arms.L.set(fpAnchor(cam, -.3), can.localToWorld(new T.Vector3(.25, .3, .2))); }
        else if (pullStart || cordK > .02) { arms.R.set(fpAnchor(cam, .5), grip.getWorldPosition(new T.Vector3())); arms.L.hide(); }
        else if (squish > .05) { arms.R.set(fpAnchor(cam, .45), bulb.getWorldPosition(new T.Vector3())); arms.L.hide(); }
        else if (phase === 'choke' && chokeK > .05 && chokeK < .95 || phase === 'open' && chokeK > .05) { arms.R.set(fpAnchor(cam, .45), choke.getWorldPosition(new T.Vector3())); arms.L.hide(); }
        else { arms.R.hide(); arms.L.hide(); } }
      arrow.visible = !!target; if (target) { arrow.position.set(target[0], target[1] + Math.sin(t * 5) * .12, target[2]); arrow.scale.setScalar(phase === 'cut' || phase === 'tie' ? 1 : .32); }
      if (phase === 'tie' || phase === 'done') bag.rotation.z = Math.sin(t * 8) * .03;
    },
    stop() { engine && engine.stop(); panel.remove(); say.remove(); },
  };
}

// ------------------------------------------------------------ 2. BAIKI RUMAH (3D)
const PAINTS = ['#c48a58', '#7fb7a4', '#f2d37a', '#e8a0a8', '#8fb4e3'];
function Repair3D(K, api, opts, M = {}) {
  const scene = new T.Scene(); environment(K, scene, { shadow: 16, fogFar: 90 });
  const r = mulberry32(9);
  K.box(80, .2, 80, K.mat(0x77b968), 0, -.1, 0, scene, false);
  for (const [x, z, s] of [[-12, 2, 1.3], [12, 1, 1.2], [-16, -8, 1.1], [16, -9, 1.2]]) palm(K, scene, x, z, s, r);
  // house body (front face is the textured wall plane)
  const PX = 50, WW = 720, WH = 400, ww = WW / PX, wh = WH / PX; // 14.4 x 8 units
  const wallY0 = 2, wood = K.mat(0xa87a50);
  K.box(ww - .05, wh, 6, wood, 0, wallY0 + wh / 2, -3.01, scene);
  K.box(ww + .8, .35, 7, K.mat(0x7c5941), 0, wallY0 - .17, -3, scene);
  for (const x of [-7, -3.5, 0, 3.5, 7]) for (const z of [.1, -6]) K.cyl(.18, .2, 2, K.mat(0x6b4a33), x, 1, z, scene, 8);
  for (let k = 0; k < 5; k++) K.box(2, .16, .5, K.mat(0x9a6b44), 5.2, .3 + k * .38, 2.3 - k * .45, scene);
  // wall texture
  const W = K.canvasTex(WW, WH);
  const woodC = document.createElement('canvas'); woodC.width = WW; woodC.height = WH; { const x = woodC.getContext('2d'); x.fillStyle = '#b07e52'; x.fillRect(0, 0, WW, WH); for (let y = 0; y < WH; y += 25) { x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(0, y, WW, 2); x.fillStyle = 'rgba(255,255,255,.05)'; x.fillRect(0, y + 3, WW, 3); } for (let k = 0; k < 60; k++) { x.fillStyle = 'rgba(60,30,10,.08)'; x.fillRect((k * 131) % WW, (k * 47) % WH, 30, 2); } }
  const WIN = { x: 270, y: 90, w: 180, h: 170 };
  const inWin = (x, y) => x > WIN.x && x < WIN.x + WIN.w && y > WIN.y && y < WIN.y + WIN.h;
  const old = new Grid(0, 0, WW, WH, 36, 20, 1, (x, y) => !inWin(x, y));
  const paint = new Grid(0, 0, WW, WH, 36, 20, 0, (x, y) => !inWin(x, y));
  for (let k = 0; k < old.v.length; k++) old.v[k] = .6 + r() * .4;
  const wallMesh = K.mesh(new T.PlaneGeometry(ww, wh), new T.MeshStandardMaterial({ map: W.t, roughness: .8 }), 0, wallY0 + wh / 2, .005, scene, false);
  // window (3D)
  const toW = (px, py) => [px / PX - ww / 2, wallY0 + wh - py / PX];
  const [wcx, wcy] = toW(WIN.x + WIN.w / 2, WIN.y + WIN.h / 2), wW = WIN.w / PX, wH = WIN.h / PX;
  K.box(wW, wH, .05, K.mat(0x2d4a52, { roughness: .2, metalness: .3 }), wcx, wcy, .03, scene);
  const frameM = K.mat(0x5a3b26);
  for (const [w, h, x, y] of [[wW + .3, .18, 0, wH / 2], [wW + .3, .18, 0, -wH / 2], [.18, wH, -wW / 2, 0], [.18, wH, wW / 2, 0], [.1, wH, 0, 0]]) K.box(w, h, .16, frameM, wcx + x, wcy + y, .08, scene);
  const shutL = K.box(wW / 2, wH, .08, K.mat(0x7c5941), wcx - wW * .78, wcy, .1, scene);
  const shutR = K.box(wW / 2, wH, .08, K.mat(0x7c5941), wcx + wW * .9, wcy - .35, .25, scene); shutR.rotation.z = -.5; shutR.rotation.y = -.5;
  let color = PAINTS[1], wallDirty = true;
  function drawWall() {
    const x = W.x; x.drawImage(woodC, 0, 0);
    for (let k = 0; k < old.v.length; k++) {
      if (!old.m[k]) continue; const [cx, cy] = old.center(k);
      if (paint.v[k] > 0) { x.globalAlpha = paint.v[k]; x.fillStyle = color; x.fillRect(cx - 10.5, cy - 10.5, 21, 21); }
      if (old.v[k] > .05) { x.globalAlpha = old.v[k] * .92; x.fillStyle = (k * 7) % 5 ? '#a9bfc8' : '#93aab4'; x.fillRect(cx - 10.5, cy - 10.5, 21, 21); }
    }
    x.globalAlpha = 1;
    if (phase === 'scrape') { x.strokeStyle = 'rgba(60,60,60,.35)'; x.lineWidth = 1.2; for (let k = 0; k < 40; k++) { const px = (k * 173) % WW, py = (k * 97) % WH; x.beginPath(); x.moveTo(px, py); x.lineTo(px + 18, py + 7); x.lineTo(px + 26, py - 4); x.stroke(); } }
    W.t.needsUpdate = true; wallDirty = false;
  }
  // roof (interactive in the zinc phase)
  const RW = 18, RH = 6.5, RPX = 50, ANG = -.55;
  const roof = K.group(0, 12.6, -.7, scene); roof.rotation.x = ANG;
  const R = K.canvasTex(RW * RPX, RH * RPX);
  const HOLES = [[-5.5, .4], [-.5, .9], [4.5, -.1]].map(([x, y]) => ({ x, y, sheet: null, nails: [] }));
  { const x = R.x; for (let i = 0; i < RW * RPX; i += 12) { x.fillStyle = (i / 12) % 2 ? '#8c5a3a' : '#a0663f'; x.fillRect(i, 0, 12, RH * RPX); }
    x.fillStyle = 'rgba(120,60,30,.4)'; for (let k = 0; k < 22; k++) { x.beginPath(); x.ellipse((k * 131) % (RW * RPX), (k * 71) % (RH * RPX), 40, 18, 0, 0, 7); x.fill(); }
    for (const h of HOLES) { const cx = (h.x + RW / 2) * RPX, cy = (RH / 2 - h.y) * RPX; x.fillStyle = '#140f0b'; x.beginPath(); x.roundRect(cx - 70, cy - 50, 140, 100, 14); x.fill(); }
    R.t.needsUpdate = true; }
  K.mesh(new T.PlaneGeometry(RW, RH), new T.MeshStandardMaterial({ map: R.t, roughness: .7, metalness: .2, side: T.DoubleSide }), 0, 0, 0, roof, false);
  const back = K.group(0, 12.6, -4.1, scene); back.rotation.x = -ANG; K.box(RW, RH, .1, K.mat(0x7a4a2a), 0, 0, 0, back);
  K.cyl(.25, .25, RW, K.mat(0x6b3a22), 0, 15.35, -2.4, scene).rotation.z = Math.PI / 2;
  { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute([0, 10, .6, 0, 10, -5.4, 0, 15.2, -2.4], 3)); g.computeVertexNormals();
    for (const x of [-ww / 2 + .02, ww / 2 - .02]) K.mesh(g.clone(), K.mat(0x9a6b44, { side: T.DoubleSide }), x, 0, 0, scene); }
  const zincTex = (() => { const z = K.canvasTex(128, 128); for (let i = 0; i < 128; i += 10) { z.x.fillStyle = (i / 10) % 2 ? '#b8c3c9' : '#e8eef1'; z.x.fillRect(i, 0, 10, 128); } z.t.needsUpdate = true; return z.t; })();
  const zincM = new T.MeshStandardMaterial({ map: zincTex, metalness: .65, roughness: .3 });
  const STACK = { x: 7.6, y: -1.2 };
  const stack = []; for (let k = 0; k < 3; k++) { const s = K.box(2.4, 2.8, .06, zincM, STACK.x, STACK.y, .08 + k * .08, roof); stack.push(s); }
  const ringM = new T.MeshBasicMaterial({ color: 0xf1c40f });
  const ring = K.mesh(new T.TorusGeometry(1, .06, 8, 32), ringM, 0, 0, .1, roof, false); ring.visible = false;
  const hammer = K.group(0, 0, 0, roof); hammer.visible = false;
  const hm = putModel(M, 'hammer', hammer, 0, 0, { h: 1.8 });
  if (hm) { hm.rotation.x = Math.PI / 2; } else { K.box(.12, .12, 1.4, K.mat(0x8a5a32), 0, 0, .7, hammer); K.box(.5, .25, .3, K.mat(0x777777, { metalness: .7, roughness: .3 }), 0, 0, 1.4, hammer); }
  for (const [k, x, hh] of [['bucket', -6.4, .75], ['saw', -5.4, .22], ['plane', -4.5, .3], ['mallet', 3.6, .3], ['wrench', 4.3, .12], ['trowel', 6.3, .18]]) putModel(M, k, scene, x, .28, { h: hh, ry: x, y: 2.03 });
  // tools on the wall
  const scraper = K.group(0, 0, 0, scene); K.box(1.2, .2, .05, K.mat(0x9aa4a8, { metalness: .7, roughness: .3 }), 0, 0, 0, scraper); K.box(.3, 1.2, .25, K.mat(0xc0392b), 0, -.7, .1, scraper);
  const roller = K.group(0, 0, 0, scene); roller.visible = false;
  const rollM = new T.MeshStandardMaterial({ color, roughness: .9 });
  const rl = K.mesh(new T.CylinderGeometry(.3, .3, 1.6, 16), rollM, 0, 0, .1, roller); rl.rotation.z = Math.PI / 2;
  K.box(.08, 1.4, .08, K.mat(0x555555), .8, -.7, .3, roller); K.box(.18, 1.2, .18, K.mat(0x333333), .8, -1.9, .4, roller);
  const flecks = new Sparks(scene, 300, 0xa9bfc8, .12);
  const nailParts = new Sparks(scene, 120, 0xffd452, .15);
  const roofPlane = new T.Plane(), hp = new T.Vector3();
  roof.updateMatrixWorld(true);
  { const nrm = new T.Vector3(0, 0, 1).applyQuaternion(roof.quaternion); roofPlane.setFromNormalAndCoplanarPoint(nrm, roof.position); }
  const roofN = roofPlane.normal.clone();
  // first person: standing on the scaffold in front of the wall, then up on the roof
  const WALL_VIEW = { pos: new T.Vector3(1.2, 6.1, 9.8), look: new T.Vector3(0, 5.9, 0), halfW: 8.2, halfH: 4.9 };
  const ZINC_VIEW = { pos: roof.position.clone().addScaledVector(roofN, 8.5).add(new T.Vector3(.8, 0, 0)), look: roof.position.clone(), halfW: 9.6, halfH: 4.4 };
  const arms = fpArms(K, scene);
  const view = { pos: WALL_VIEW.pos.clone(), look: WALL_VIEW.look.clone(), halfW: WALL_VIEW.halfW, halfH: WALL_VIEW.halfH };

  let phase = 'scrape', scrub = null, misses = 0, t = 0, carry = null, swing = 0;
  api.step('Kikis cat lama — seret pengikis', 'Scrape off the old paint — drag the scraper');
  const swatchTools = () => api.tools(PAINTS.map(c => ({ html: `<span class="sw" style="background:${c}"></span>`, sel: c === color, on: () => { color = c; rollM.color.set(c); wallDirty = true; sfx.tap(); swatchTools(); } })));
  const ringR = () => .25 + .55 * (.5 + .5 * Math.sin(t * 4.2));
  const activeNail = () => { for (const h of HOLES) if (h.sheet) for (const n of h.nails) if (!n.done) return n; return null; };
  function placeSheet(h) {
    h.sheet = K.box(3.4, 2.6, .06, zincM, h.x, h.y, .06, roof);
    for (const dx of [-1.1, 1.1]) {
      const g = K.group(h.x + dx, h.y, .32, roof);
      const sh = K.mesh(new T.CylinderGeometry(.04, .04, .5, 8), K.mat(0x888888, { metalness: .8 }), 0, 0, 0, g); sh.rotation.x = Math.PI / 2;
      const hd = K.mesh(new T.CylinderGeometry(.13, .13, .05, 12), K.mat(0x666666, { metalness: .8 }), 0, 0, .25, g); hd.rotation.x = Math.PI / 2;
      h.nails.push({ g, x: h.x + dx, y: h.y, done: false, flash: 0 });
    }
    stack.pop().visible = false;
  }
  function checkZinc() {
    const total = HOLES.length * 2, done = HOLES.reduce((a, h) => a + h.nails.filter(n => n.done).length, 0);
    api.progress(done / total);
    if (done === total) { sfx.good(); phase = 'done'; ring.visible = false; setTimeout(() => api.finish({ stars: misses <= 1 ? 3 : misses <= 3 ? 2 : 1, color }), 900); }
  }
  return {
    scene, view, mvCap: 120,
    ray(rc) {
      if (phase === 'scrape' || phase === 'paint') {
        const h = rc.intersectObject(wallMesh)[0];
        if (!h) return { ok: false };
        return { x: h.uv.x * WW, y: (1 - h.uv.y) * WH, ok: true };
      }
      if (!rc.ray.intersectPlane(roofPlane, hp)) return { ok: false };
      const l = roof.worldToLocal(hp.clone()); return { x: l.x, y: l.y, ok: true };
    },
    dbg: () => ({ phase, holes: HOLES.map(h => ({ x: h.x, y: h.y, sheet: !!h.sheet })), stack: STACK, active: (() => { const n = activeNail(); return n ? { x: n.x, y: n.y } : null; })(), ringR: ringR() }),
    down(p) {
      if (phase !== 'zinc') return;
      const n = activeNail();
      if (n && Math.hypot(p.x - n.x, p.y - n.y) < .8) {
        hammer.visible = true; hammer.position.set(n.x + .3, n.y - .2, 1.6); swing = .18;
        if (ringR() < .42) { n.done = true; n.g.position.z = .07; sfx.hammer(); for (let k = 0; k < 10; k++) { const w = roof.localToWorld(new T.Vector3(n.x, n.y, .2)); nailParts.add(w.x, w.y, w.z, (Math.random() - .5) * 3, 2 + Math.random() * 2, (Math.random() - .5) * 3, .4); } checkZinc(); }
        else { misses++; n.flash = .5; sfx.bad(); toast('Bengkok! Tunggu bulatan hijau', 'Bent! Wait for the green ring'); }
        return;
      }
      if (!carry && HOLES.some(h => !h.sheet) && Math.hypot(p.x - STACK.x, p.y - STACK.y) < 2) { carry = K.box(3.4, 2.6, .06, zincM, p.x, p.y, .5, roof); sfx.tap(); }
    },
    move(p) { if (carry) carry.position.set(p.x, p.y, .5); },
    up() {
      if (!carry) return;
      const h = HOLES.find(h => !h.sheet && Math.hypot(carry.position.x - h.x, carry.position.y - h.y) < 2.2);
      roof.remove(carry); carry.geometry.dispose(); carry = null;
      if (h) { placeSheet(h); sfx.pop(); api.step('Ketik paku masa bulatan jadi hijau', 'Tap each nail when the ring turns green'); } else sfx.tap();
    },
    update(dt, p, cam) {
      t += dt;
      const onWall = phase === 'scrape' || phase === 'paint';
      if (cam) {
        if (onWall && p.on) { const tool = phase === 'scrape' ? scraper : roller; arms.R.set(fpAnchor(cam, .5), tool.localToWorld(new T.Vector3(phase === 'scrape' ? 0 : .8, phase === 'scrape' ? -1.1 : -2.3, .2))); arms.L.hide(); }
        else if (phase === 'zinc' && carry) { const a = roof.localToWorld(new T.Vector3(carry.position.x - 1.2, carry.position.y - 1, .4)), b = roof.localToWorld(new T.Vector3(carry.position.x + 1.2, carry.position.y - 1, .4)); arms.L.set(fpAnchor(cam, -.5), a); arms.R.set(fpAnchor(cam, .5), b); }
        else if (phase === 'zinc' && hammer.visible) { arms.R.set(fpAnchor(cam, .5), hammer.getWorldPosition(new T.Vector3())); arms.L.hide(); }
        else { arms.L.hide(); arms.R.hide(); }
      }
      if (onWall && p.on) {
        const [wx, wy] = toW(p.x, p.y);
        const tool = phase === 'scrape' ? scraper : roller; tool.position.set(wx, wy, .35 + (p.down ? 0 : .3));
        tool.rotation.z = phase === 'scrape' ? -.35 : 0; if (phase === 'paint' && p.down) rl.rotation.x += p.mv * .02;
      }
      if (!p.down && scrub) { scrub.stop(); scrub = null; }
      if (phase === 'scrape' && p.down && p.on) {
        const mv = p.mv; if (!scrub) scrub = loopSound('scrub'); scrub.set(Math.min(.25, mv * .02));
        old.seg(p.lx, p.ly, p.x, p.y, 36, (k) => { if (old.v[k] > 0) { old.v[k] = Math.max(0, old.v[k] - (dt * 1.2 + mv * .012)); wallDirty = true;
          if (Math.random() < .06) { const [cx, cy] = old.center(k), [wx, wy] = toW(cx, cy); flecks.add(wx, wy, .2, (Math.random() - .5) * 2, 0, 1 + Math.random() * 2, .9); } } });
        const f = old.frac(v => v < .08); api.progress(f / .96);
        if (f >= .96) { phase = 'paint'; for (let k = 0; k < old.v.length; k++) old.v[k] = 0; wallDirty = true; scraper.visible = false; roller.visible = true; api.progress(0); sfx.good(); api.step('Pilih warna, kemudian seret untuk cat', 'Pick a colour, then drag to paint'); swatchTools(); }
      } else if (phase === 'paint' && p.down && p.on) {
        paint.seg(p.lx, p.ly, p.x, p.y, 38, (k) => { paint.v[k] = Math.min(1, paint.v[k] + dt * 5 + p.mv * .03); wallDirty = true; });
        const f = paint.frac(v => v > .85); api.progress(f / .96);
        if (f >= .96) {
          for (let k = 0; k < paint.v.length; k++) if (paint.m[k]) paint.v[k] = 1; wallDirty = true; drawWall();
          phase = 'zinc'; roller.visible = false; api.tools([]); api.progress(0); sfx.good();
          shutR.rotation.set(0, 0, 0); shutR.position.set(wcx + wW * .78, wcy, .1);
          Object.assign(view, { halfW: ZINC_VIEW.halfW, halfH: ZINC_VIEW.halfH }); view.pos.copy(ZINC_VIEW.pos); view.look.copy(ZINC_VIEW.look);
          api.step('Seret zink baru (kanan) ke lubang di bumbung', 'Drag the new zinc sheets (right) over the roof holes');
        }
      }
      if (wallDirty) drawWall();
      if (phase === 'zinc') {
        const n = activeNail();
        ring.visible = !!n;
        if (n) { const rr = ringR(); ring.position.set(n.x, n.y, .1); ring.scale.setScalar(rr); n.flash = Math.max(0, n.flash - dt); ringM.color.set(n.flash > 0 ? 0xe74c3c : rr < .42 ? 0x2ecc71 : 0xf1c40f); }
      }
      if (swing > 0) { swing -= dt; hammer.rotation.x = -1.2 + (1 - swing / .18) * 1.2; if (swing <= 0) setTimeout(() => { hammer.visible = false; }, 120); }
      flecks.update(dt, -6); nailParts.update(dt);
    },
    stop() { scrub && scrub.stop(); },
  };
}

// ------------------------------------------------------------ 3. CUCI KERETA (3D)
function CarWash3D(K, api, opts, M = {}) {
  const scene = new T.Scene(); environment(K, scene, { sky: 0xd9e4ea, shadow: 8, fogNear: 20, fogFar: 50 });
  const r = mulberry32(opts.seed || 21);
  // bay
  const floor = K.canvasTex(256, 256); for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { floor.x.fillStyle = (i + j) % 2 ? '#b9c4ca' : '#aab6bd'; floor.x.fillRect(i * 32, j * 32, 32, 32); } floor.t.wrapS = floor.t.wrapT = T.RepeatWrapping; floor.t.repeat.set(5, 4); floor.t.needsUpdate = true;
  K.mesh(new T.BoxGeometry(20, .1, 14), new T.MeshStandardMaterial({ map: floor.t, roughness: .5 }), 0, -.05, 0, scene, false);
  K.box(20, 7, .3, K.mat(0x4aa3d8), 0, 3.5, -4.5, scene, false);
  const sign = K.canvasTex(1024, 128); sign.x.fillStyle = '#1f6f9c'; sign.x.fillRect(0, 0, 1024, 128); sign.x.fillStyle = '#fff'; sign.x.font = '900 64px system-ui'; sign.x.textAlign = 'center'; sign.x.textBaseline = 'middle'; sign.x.fillText('POK WAN CAR WASH', 512, 66); sign.t.needsUpdate = true;
  K.mesh(new T.PlaneGeometry(8, 1), new T.MeshBasicMaterial({ map: sign.t }), 0, 4.6, -4.3, scene, false);
  for (const x of [-6, 6]) { K.box(.5, 6, .5, K.mat(0xe9eef2), x, 3, -2, scene); const b = K.cyl(.55, .55, 2.6, K.mat(0x2e86de, { roughness: .9 }), x * .9, 1.4, -3.2, scene, 16); b.castShadow = false; }
  for (const x of [-4, 4]) { K.cyl(.35, .3, .6, K.mat(0xe74c3c), x, .3, 2.6, scene); }
  K.box(16, .3, .6, K.mat(0xe9eef2), 0, 6, -1, scene);
  putModel(M, 'bucket', scene, -3.4, 2.2, { h: .75, ry: .5 }); putModel(M, 'bucket', scene, 3.6, 2.5, { h: .75, ry: 2 }); putModel(M, 'boxA', scene, -6.5, -3, { h: 1, ry: .4 }); putModel(M, 'hydrant', scene, 7, 1.5, { h: 1 });
  const bayLight = new T.PointLight(0xffffff, 8, 18, 1.4); bayLight.position.set(0, 5, 2); scene.add(bayLight);
  // car (faces +x, the side facing the camera is +z)
  const carCol = new T.Color(opts.color || ['#c0392b', '#2e86de', '#27ae60', '#f39c12'][Math.floor(r() * 4)]);
  const car = K.group(0, 0, 0, scene);
  const paintM = new T.MeshStandardMaterial({ color: carCol, metalness: .35, roughness: .35 });
  // side profile of the car (x along the car, y up), extruded across its width
  const PROF = [[-2.3, .35], [2.3, .35], [2.38, .62], [2.32, .92], [2.1, 1.04], [1.25, 1.14], [1.0, 1.4], [.62, 1.84], [.45, 1.88], [-1.05, 1.9], [-1.25, 1.85], [-1.72, 1.28], [-2.2, 1.14], [-2.36, .95], [-2.38, .62]];
  const prof = new T.Shape(PROF.map(([x, y]) => new T.Vector2(x, y)));
  const bodyGeo = new T.ExtrudeGeometry(prof, { depth: 1.8, bevelEnabled: true, bevelSize: .06, bevelThickness: .06, bevelSegments: 3, curveSegments: 4 });
  bodyGeo.translate(0, 0, -.9);
  K.mesh(bodyGeo, paintM, 0, 0, 0, car);
  const glass = K.mat(0x22343d, { roughness: .1, metalness: .4 });
  const WINS = [[[1.08, 1.2], [.6, 1.76], [-.12, 1.78], [-.12, 1.2]], [[-.28, 1.2], [-.28, 1.79], [-1.02, 1.8], [-1.5, 1.24]]];
  const glass2 = K.mat(0x22343d, { roughness: .1, metalness: .4, side: T.DoubleSide });
  for (const w of WINS) for (const z of [.963, -.963]) K.mesh(new T.ShapeGeometry(new T.Shape(w.map(([x, y]) => new T.Vector2(x, y)))), glass2, 0, 0, z, car, false);
  const slab = (a, b) => { const [x1, y1] = a, [x2, y2] = b, len = Math.hypot(x2 - x1, y2 - y1); const m = K.box(len * .92, .03, 1.6, glass, (x1 + x2) / 2, (y1 + y2) / 2 + .012, 0, car, false); m.rotation.z = Math.atan2(y2 - y1, x2 - x1); };
  slab([1.25, 1.16], [.62, 1.86]); slab([-1.25, 1.87], [-1.72, 1.3]);
  for (const [x, z] of [[1.45, .92], [-1.45, .92], [1.45, -.92], [-1.45, -.92]]) { const w = K.cyl(.42, .42, .3, K.mat(0x1d1d1d), x, .42, z, car, 24); w.rotation.x = Math.PI / 2; const hb = K.cyl(.22, .22, .32, K.mat(0xc8c8c8, { metalness: .85, roughness: .25 }), x, .42, z, car, 16); hb.rotation.x = Math.PI / 2; }
  for (const z of [.6, -.6]) { K.box(.06, .16, .42, K.mat(0xffeaa7, { emissive: 0xffd27a, emissiveIntensity: .7 }), 2.39, .8, z, car); K.box(.06, .16, .38, K.mat(0xe74c3c, { emissive: 0x8a1a10 }), -2.41, .82, z, car); }
  K.box(.18, .18, 1.9, K.mat(0x2a2a2a), 2.4, .44, 0, car); K.box(.18, .18, 1.9, K.mat(0x2a2a2a), -2.42, .44, 0, car);
  // dirt overlay: a canvas mapped onto the near side of the car
  const PPU = 200, X0 = -2.4, Y1 = 1.95, CW = Math.round(4.8 * PPU), CH = Math.round((Y1 - .3) * PPU);
  const O = K.canvasTex(CW, CH);
  const profPath = new Path2D(); PROF.forEach(([x, y], k) => { const px = (x - X0) * PPU, py = (Y1 - y) * PPU; k ? profPath.lineTo(px, py) : profPath.moveTo(px, py); }); profPath.closePath();
  const mctx = document.createElement('canvas').getContext('2d');
  const inCar = (x, y) => mctx.isPointInPath(profPath, x, y);
  const ovGeo = new T.ShapeGeometry(prof); { const pos = ovGeo.attributes.position, uv = ovGeo.attributes.uv; for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - X0) / 4.8, (pos.getY(i) - .3) / (Y1 - .3)); uv.needsUpdate = true; }
  const bodyP = K.mesh(ovGeo, new T.MeshStandardMaterial({ map: O.t, transparent: true, depthWrite: false, roughness: .6 }), 0, 0, .968, car, false);
  const sidePlane = new T.Plane(new T.Vector3(0, 0, 1), -.968), sideHit = new T.Vector3();
  const dust = new Grid(0, 0, CW, CH, 46, 16, 1, inCar), foam = new Grid(0, 0, CW, CH, 46, 16, 0, inCar), wet = new Grid(0, 0, CW, CH, 46, 16, 0, inCar);
  const mud = []; while (mud.length < 6) { const x = 60 + r() * (CW - 120), y = 30 + r() * (CH - 60); if (inCar(x, y) && inCar(x - 35, y) && inCar(x + 35, y) && inCar(x, y - 25) && inCar(x, y + 25)) mud.push({ x, y, r: 26 + r() * 16, v: 1 }); }
  const blob = document.createElement('canvas'); blob.width = blob.height = 44;
  { const g = blob.getContext('2d'), gr = g.createRadialGradient(22, 22, 4, 22, 22, 22); gr.addColorStop(0, 'rgba(155,122,82,.9)'); gr.addColorStop(1, 'rgba(155,122,82,0)'); g.fillStyle = gr; g.fillRect(0, 0, 44, 44); }
  let dirtyO = true;
  function drawOverlay() {
    const x = O.x; x.clearRect(0, 0, CW, CH);
    x.save(); x.clip(profPath);
    for (let k = 0; k < dust.v.length; k++) { if (!dust.m[k] || dust.v[k] <= .02) continue; const [cx, cy] = dust.center(k); x.globalAlpha = Math.min(1, dust.v[k] * .75); x.drawImage(blob, cx - 22, cy - 22, 44, 44); }
    x.globalAlpha = 1;
    for (let k = 0; k < dust.v.length; k++) { if (!dust.m[k]) continue; const [cx, cy] = dust.center(k);
      if (wet.v[k] > .05 && step >= 3) { x.globalAlpha = wet.v[k] * .8; x.fillStyle = '#eaf7ff'; x.beginPath(); x.arc(cx - 4 + (k % 3) * 3, cy - 3, 3, 0, 7); x.arc(cx + 5, cy + 4 - (k % 2) * 4, 2.2, 0, 7); x.fill(); } }
    for (const m of mud) if (m.v > 0) { x.globalAlpha = m.v; x.fillStyle = '#5d4027'; x.beginPath(); x.ellipse(m.x, m.y, m.r, m.r * .7, .3, 0, 7); x.fill(); x.fillStyle = '#7a5636'; x.beginPath(); x.ellipse(m.x - 7, m.y - 5, m.r * .5, m.r * .3, .3, 0, 7); x.fill(); }
    for (let k = 0; k < foam.v.length; k++) { if (!foam.m[k] || foam.v[k] < .05) continue; const [cx, cy] = foam.center(k); x.globalAlpha = Math.min(1, foam.v[k] + .2); x.fillStyle = '#fff'; x.beginPath(); x.arc(cx + ((k * 5) % 9) - 4, cy + ((k * 3) % 7) - 3, 5 + foam.v[k] * 8, 0, 7); x.fill(); }
    x.globalAlpha = 1; x.restore(); O.t.needsUpdate = true; dirtyO = false;
  }
  const toW = (px, py) => new T.Vector3(px / PPU + X0, Y1 - py / PPU, .97);
  // tools
  const hose = K.group(0, 0, 0, scene); K.box(.22, .55, .22, K.mat(0xf1c40f, { roughness: .5 }), 0, -.3, .5, hose); K.mesh(new T.CylinderGeometry(.07, .1, .6, 12), K.mat(0x2e86de, { roughness: .4 }), 0, 0, .25, hose).rotation.x = Math.PI / 2;
  const bottle = K.group(0, 0, 0, scene); K.cyl(.2, .2, .6, K.mat(0xe8a0d0, { roughness: .4 }), 0, 0, .4, bottle); K.cyl(.08, .08, .2, K.mat(0xffffff), 0, .4, .4, bottle);
  const sponge = K.group(0, 0, 0, scene); K.box(.7, .45, .3, K.mat(0xf6d743, { roughness: 1 }), 0, 0, .15, sponge);
  const cloth = K.group(0, 0, 0, scene); K.box(.8, .6, .08, K.mat(0x3fa9f5, { roughness: 1 }), 0, 0, .05, cloth);
  const toolsByStep = [hose, bottle, sponge, hose, cloth];
  const water = new Sparks(scene, 500, 0xaee0ff, .07), suds = new Sparks(scene, 200, 0xffffff, .14), shine = new Sparks(scene, 80, 0xfff6c8, .2);
  const STEPS = [['Bilas', 'Rinse', '🚿'], ['Sabun', 'Soap', '🧴'], ['Sental', 'Scrub', '🧽'], ['Bilas', 'Rinse', '🚿'], ['Lap', 'Dry', '🧻']];
  const TIPS = [['Bilas habuk dengan air', 'Rinse off the dust'], ['Sapu sabun ke seluruh kereta', 'Spread soap over the whole car'], ['Sental tompok lumpur (gosok berulang-ulang)', 'Scrub the mud spots (rub back and forth)'], ['Bilas semua buih', 'Rinse off all the foam'], ['Lap sampai kering berkilat', 'Wipe it dry until it shines']];
  let step = 0, hoseS = null, scrub = null, spinT = 0, t = 0;
  const view = { pos: new T.Vector3(.7, 1.65, 5.6), look: new T.Vector3(0, 1.0, 0), halfW: 3.7, halfH: 1.9 }; // first person, standing beside the car
  const arms = fpArms(K, scene);
  const setStep = () => { api.tools(STEPS.map(([bm, en, ic], k) => ({ html: `<b>${ic}</b><span>${k + 1}. ${bm}</span>`, sel: k === step }))); api.step(...TIPS[step]); api.progress(0); toolsByStep.forEach((o, k) => { o.visible = k === step; }); };
  setStep();
  function completeStep(k) {
    const all = (g, v) => { for (let i = 0; i < g.v.length; i++) if (g.m[i]) g.v[i] = v; };
    if (k === 0) { all(dust, 0); all(wet, 1); } else if (k === 1) all(foam, 1); else if (k === 2) mud.forEach(m => { m.v = 0; }); else if (k === 3) { all(foam, 0); all(wet, 1); } else if (k === 4) all(wet, 0);
    dirtyO = true;
  }
  const next = () => { completeStep(step); sfx.good(); step++; if (step >= STEPS.length) { toolsByStep.forEach(o => { o.visible = false; }); spinT = 1.6; paintM.roughness = .15; const tt = api.elapsed(); setTimeout(() => api.finish({ stars: starsFor(tt, 50, 80) }), 1700); } else setStep(); };
  return {
    scene, view, mvCap: 140,
    ray(rc) {
      if (!rc.ray.intersectPlane(sidePlane, sideHit)) return { ok: false };
      const px = (sideHit.x - X0) * PPU, py = (Y1 - sideHit.y) * PPU;
      return { x: px, y: py, ok: px > -60 && px < CW + 60 && py > -60 && py < CH + 60 };
    },
    dbg: () => ({ step, mud: mud.map(m => ({ x: m.x, y: m.y, v: m.v })) }),
    update(dt, p, cam) {
      t += dt;
      const mv = p.mv, isHose = step === 0 || step === 3;
      if (cam) { const tool = toolsByStep[step]; if (tool && tool.visible && p.on) { arms.R.set(fpAnchor(cam, .5), tool.localToWorld(new T.Vector3(0, isHose ? -.5 : 0, isHose ? .45 : .25))); if (step === 2 || step === 4) arms.L.set(fpAnchor(cam, -.45), tool.localToWorld(new T.Vector3(-.3, 0, .25))); else arms.L.hide(); } else { arms.R.hide(); arms.L.hide(); } }
      if (step < STEPS.length && p.on) {
        const w = toW(p.x, p.y), tool = toolsByStep[step];
        tool.position.copy(w).add(new T.Vector3(isHose ? .25 : 0, isHose ? .3 : 0, isHose ? .75 : .02 + (p.down ? 0 : .25)));
        if (step === 2 && p.down) tool.rotation.z = Math.sin(t * 20) * .2;
      }
      if (isHose && p.down && p.on) {
        if (!hoseS) hoseS = loopSound('water'); hoseS.set(.18);
        const w = toW(p.x, p.y); for (let k = 0; k < 6; k++) water.add(w.x + (Math.random() - .5) * .1, w.y + .05, w.z + 1.05, (Math.random() - .5) * 1.2, (Math.random() - .5) * .8, -6 - Math.random() * 2, .2);
        for (let k = 0; k < 2; k++) water.add(w.x + (Math.random() - .5) * .6, w.y, w.z + .05, (Math.random() - .5) * .5, -1, .5, .5);
      } else if (hoseS) { hoseS.stop(); hoseS = null; }
      if ((step === 2 || step === 4) && p.down) { if (!scrub) scrub = loopSound('scrub'); scrub.set(Math.min(.2, mv * .015)); } else if (scrub) { scrub.stop(); scrub = null; }
      if (p.down && p.on && step < STEPS.length) {
        const R = 56;
        if (step === 0) { dust.seg(p.lx, p.ly, p.x, p.y, R, k => { dust.v[k] = Math.max(0, dust.v[k] - dt * 3 - mv * .01); wet.v[k] = 1; }); dirtyO = true; const f = dust.frac(v => v < .12); api.progress(f / .96); if (f >= .96) next(); }
        else if (step === 1) { foam.seg(p.lx, p.ly, p.x, p.y, R, k => { foam.v[k] = Math.min(1, foam.v[k] + dt * 3.5 + mv * .012); }); dirtyO = true; if (Math.random() < .4) { const w = toW(p.x, p.y); suds.add(w.x, w.y, w.z + .2, (Math.random() - .5), 1, .6, .5); } const f = foam.frac(v => v > .7); api.progress(f / .96); if (f >= .96) next(); }
        else if (step === 2) { for (const m of mud) if (m.v > 0 && Math.hypot(p.x - m.x, p.y - m.y) < m.r + 36) { m.v = Math.max(0, m.v - mv * .005); dirtyO = true; } const f = mud.filter(m => m.v < .08).length / mud.length; api.progress(f); if (f >= 1) next(); }
        else if (step === 3) { foam.seg(p.lx, p.ly, p.x, p.y, R, k => { foam.v[k] = Math.max(0, foam.v[k] - dt * 3.5 - mv * .012); wet.v[k] = 1; }); dirtyO = true; const f = foam.frac(v => v < .12); api.progress(f / .96); if (f >= .96) next(); }
        else if (step === 4) { wet.seg(p.lx, p.ly, p.x, p.y, R, k => { wet.v[k] = Math.max(0, wet.v[k] - (dt * .8 + mv * .008)); }); dirtyO = true; const f = wet.frac(v => v < .12); api.progress(f / .96); if (f >= .96) next(); }
      }
      if (dirtyO) drawOverlay();
      if (spinT > 0) {
        spinT -= dt; car.rotation.y += dt * 4;
        if (Math.random() < .5) shine.add((Math.random() - .5) * 4.4, .5 + Math.random() * 1.5, (Math.random() - .5) * 2, 0, .6, 0, .6);
        if (spinT <= 0) car.rotation.y = 0;
      }
      water.update(dt, -9); suds.update(dt, -2); shine.update(dt, 0);
    },
    stop() { hoseS && hoseS.stop(); scrub && scrub.stop(); },
  };
}

// ------------------------------------------------------------ 4. TUAI PADI (3D) — sabit, kumpul berkas, banting padi
function Padi3D(K, api, opts, M = {}) {
  const scene = new T.Scene(); environment(K, scene, { sky: 0xa8d8ee, shadow: 14, fogNear: 35, fogFar: 95 });
  const r = mulberry32(opts.seed || 33);
  // muddy field, bunds, hills, hut, palms
  K.box(80, .2, 80, K.mat(0x7da24a), 0, -.1, 0, scene, false);
  K.box(20, .06, 11, K.mat(0x8a7a48, { roughness: .4 }), 0, .01, 0, scene, false);
  for (const z of [-5.7, 5.7]) K.box(21, .35, .7, K.mat(0x6f8a3c), 0, .17, z, scene, false);
  for (const x of [-10.3, 10.3]) K.box(.7, .35, 11.4, K.mat(0x6f8a3c), x, .17, 0, scene, false);
  for (let k = 0; k < 7; k++) { const s = K.ball(8 + r() * 6, K.mat(k % 2 ? 0x4f8a3c : 0x5c9a46, { flatShading: true }), -40 + k * 13, -2, -38 - r() * 8, scene); s.scale.y = .5; s.castShadow = false; }
  stiltHouse(K, scene, -13, -9, { w: 5, d: 4, wall: 0xc9a46a, roof: 0x8a6a3a, stilt: 1.4, h: 2.4 });
  for (const [x, z, s] of [[14, -8, 1.2], [16, 2, 1.1], [-16, 3, 1], [12, -14, 1]]) palm(K, scene, x, z, s, r);
  // far padi (static, green-gold)
  { const g = new T.ConeGeometry(.12, .9, 4); g.translate(0, .45, 0);
    const n = 900, im = new T.InstancedMesh(g, new T.MeshStandardMaterial({ color: 0xc9b24a, roughness: .9 }), n), d = new T.Object3D();
    for (let k = 0; k < n; k++) { const side = k % 2 ? 1 : -1; d.position.set((r() - .5) * 60, 0, side > 0 ? 7 + r() * 8 : -7 - r() * 14); if (Math.abs(d.position.x) < 11 && Math.abs(d.position.z) < 7) d.position.z += side * 8; d.rotation.set((r() - .5) * .3, r() * 3, (r() - .5) * .3); d.scale.setScalar(.8 + r() * .5); d.updateMatrix(); im.setMatrixAt(k, d.matrix); }
    scene.add(im); }
  // scarecrow
  { const g = K.group(-8.8, 0, -6.6, scene); K.cyl(.06, .06, 2.2, K.mat(0x7a5236), 0, 1.1, 0, g, 6); K.box(1.6, .08, .08, K.mat(0x7a5236), 0, 1.7, 0, g); K.box(.6, .7, .3, K.mat(0xc0392b), 0, 1.5, 0, g); K.ball(.28, K.mat(0xe1b84f), 0, 2.3, 0, g); K.cyl(.5, .5, .06, K.mat(0xd9b36c), 0, 2.5, 0, g, 12); }
  // ripe padi clumps: 4 rows x 6
  const clumps = [];
  const stalkGeo = new T.ConeGeometry(.05, 1.3, 4); stalkGeo.translate(0, .65, 0);
  const headGeo = new T.SphereGeometry(.09, 6, 4); headGeo.scale(1, 2.2, 1);
  const PER = 14, rows = 4, cols = 6, n = rows * cols;
  const stalks = new T.InstancedMesh(stalkGeo, new T.MeshStandardMaterial({ color: 0xc9a83a, roughness: .85 }), n * PER);
  const heads = new T.InstancedMesh(headGeo, new T.MeshStandardMaterial({ color: 0xe8c45a, roughness: .8 }), n * PER);
  stalks.castShadow = heads.castShadow = !isTouch; scene.add(stalks, heads);
  const dm = new T.Object3D(), off = [], cutCol = new T.Color(.78, .74, .6), white = new T.Color(1, 1, 1);
  for (let i = 0; i < n * PER; i++) stalks.setColorAt(i, white);
  for (let c = 0; c < n; c++) {
    const x = -7.5 + (c % cols) * 3 + (r() - .5) * .4, z = -3 + Math.floor(c / cols) * 2 + (r() - .5) * .3;
    clumps.push({ x, z, cut: false, t: 0 });
    for (let k = 0; k < PER; k++) off.push([(r() - .5) * .7, (r() - .5) * .7, (r() - .5) * .35, r() * 6, .85 + r() * .3]);
  }
  function setClump(c) {
    const cl = clumps[c], lay = Math.min(1, cl.t);
    for (let k = 0; k < PER; k++) {
      const o = off[c * PER + k], i = c * PER + k;
      dm.position.set(cl.x + o[0] * (1 - lay * .3), lay * .05, cl.z + o[1]); dm.rotation.set(o[2] + lay * 1.45, o[3] * (1 - lay) + lay * .2, 0); dm.scale.set(1, o[4] * (1 - lay * .35), 1); dm.updateMatrix();
      stalks.setMatrixAt(i, dm.matrix);
      // grain head at the top of the stalk, drooping
      const top = new T.Vector3(0, 1.3 * o[4] * (1 - lay * .35), 0).applyEuler(dm.rotation).add(dm.position);
      dm.position.copy(top); dm.rotation.set(o[2] + .5 + lay, o[3], 0); dm.scale.setScalar(cl.gone ? 0 : 1 - lay * .45); dm.updateMatrix(); heads.setMatrixAt(i, dm.matrix);
      if (cl.cut) stalks.setColorAt(i, cutCol);
    }
    stalks.instanceMatrix.needsUpdate = heads.instanceMatrix.needsUpdate = true; if (stalks.instanceColor) stalks.instanceColor.needsUpdate = true;
  }
  for (let c = 0; c < n; c++) setClump(c);
  // sickle (sabit)
  const sabit = K.group(0, 1, 0, scene);
  K.cyl(.06, .07, .7, K.mat(0x7a4a2a), 0, -.35, 0, sabit, 8);
  const blade = K.mesh(new T.TorusGeometry(.42, .045, 6, 18, Math.PI * 1.25), K.mat(0xd7dde0, { metalness: .8, roughness: .25 }), .38, .05, 0, sabit); blade.rotation.z = -.3;
  sabit.rotation.x = -1.1;
  // mat (tikar), bundles, tong
  const TIKAR = { x: -6.5, z: 6.6 }, TONG = { x: 6.5, z: 6.8 };
  K.box(3.6, .04, 2.4, K.mat(0xd9b36c), TIKAR.x, .04, TIKAR.z, scene, false);
  for (let k = 0; k < 5; k++) K.box(3.6, .045, .14, K.mat(0xb2473b), TIKAR.x, .045, TIKAR.z - 1 + k * .5, scene, false);
  const tong = K.group(TONG.x, 0, TONG.z, scene);
  const wood = K.mat(0x8a5a32);
  K.box(2.6, .15, 1.8, wood, 0, .08, 0, tong); for (const [w, d, x, z] of [[2.6, .14, 0, .83], [2.6, .14, 0, -.83], [.14, 1.8, 1.23, 0], [.14, 1.8, -1.23, 0]]) K.box(w, 1.1, d, wood, x, .6, z, tong);
  K.box(2.6, .1, .3, K.mat(0x6b4a2a), 0, 1.2, -.83, tong);
  const grainFill = K.box(2.3, .1, 1.5, K.mat(0xe2c25a, { roughness: .9 }), 0, .2, 0, tong); grainFill.scale.y = .01; grainFill.visible = false;
  const bundles = [];
  const bundleGeo = new T.CylinderGeometry(.22, .3, 1.2, 8);
  function makeBundle(x, z) {
    const g = K.group(x, .25, z, scene); const b = K.mesh(bundleGeo, K.mat(0xc9a83a), 0, 0, 0, g); b.rotation.z = Math.PI / 2;
    K.mesh(new T.TorusGeometry(.26, .04, 6, 12), K.mat(0x7a4a2a), 0, 0, 0, g).rotation.y = Math.PI / 2;
    for (let k = 0; k < 5; k++) K.ball(.1, K.mat(0xe8c45a), .6 + Math.random() * .1, (Math.random() - .5) * .3, (Math.random() - .5) * .3, g);
    return g;
  }
  // timing meter for banting (3D bar above the tong)
  const meter = K.group(TONG.x, 3.4, TONG.z, scene); meter.visible = false;
  K.box(3, .3, .1, K.mat(0x22343d), 0, 0, 0, meter);
  const zone = K.box(.7, .32, .12, K.mat(0x2ecc71, { emissive: 0x1a7a40, emissiveIntensity: .5 }), 0, 0, .01, meter);
  const mark = K.box(.08, .5, .14, K.mat(0xffd452, { emissive: 0x8a6a00, emissiveIntensity: .6 }), 0, 0, .03, meter);
  const held = makeBundle(TONG.x, TONG.z); held.visible = false;
  const chaff = new Sparks(scene, 300, 0xd8c070, .09), grain = new Sparks(scene, 400, 0xf1d36b, .1);
  const arrow = arrowMesh(K, scene);
  const ground = new T.Plane(new T.Vector3(0, 1, 0), 0), hp = new T.Vector3();
  const stalkPlane = new T.Plane(new T.Vector3(0, 1, 0), -.75), bundlePlane = new T.Plane(new T.Vector3(0, 1, 0), -.3); // aim where the player sees the stalks/bundles
  // first person: standing on the bund at the edge of the field, then at the threshing tub
  const FIELD_VIEW = { pos: new T.Vector3(0, 5.2, 13.5), look: new T.Vector3(0, 0, -1.5), halfW: 13.5, halfH: 6.2 }; // zoomed out: the whole field, hut and sickle in view // higher, so the field fills the screen
  const TONG_VIEW = { pos: new T.Vector3(TONG.x + 1.5, 2.9, TONG.z + 2.3), look: new T.Vector3(TONG.x - .1, .95, TONG.z - .35), halfW: 2.5, halfH: 1.55 }; // from the side, so the bundle doesn't block the tub
  meter.position.set(TONG.x, 2.05, TONG.z - .7); meter.scale.setScalar(.75);
  const arms = fpArms(K, scene);
  const view = { pos: FIELD_VIEW.pos.clone(), look: FIELD_VIEW.look.clone(), halfW: FIELD_VIEW.halfW, halfH: FIELD_VIEW.halfH };
  const setView = (v) => { view.pos.copy(v.pos); view.look.copy(v.look); view.halfW = v.halfW; view.halfH = v.halfH; };
  let phase = 'tuai', cutN = 0, onMat = 0, slams = 0, good = 0, t = 0, swing = 0, zoneW = .75, lastSwish = 0;
  const SLAMS = 8;
  api.step('Seret sabit merentasi rumpun padi untuk menuai', 'Swipe the sickle across the padi clumps to harvest');
  return {
    scene, view, mvCap: 3,
    ray(rc) { const pl = phase === 'tuai' ? stalkPlane : phase === 'kumpul' ? bundlePlane : ground; const ok = rc.ray.intersectPlane(pl, hp); return { x: ok ? hp.x : 0, y: ok ? hp.z : 0, ok: !!ok }; },
    dbg: () => ({ phase, clumps: clumps.map(c => ({ x: c.x, z: c.z, cut: c.cut })), bundles: bundles.filter(b => !b.collected).map(b => ({ x: b.g.position.x, z: b.g.position.z })), markX: mark.position.x, zoneW, slams, good }),
    down(p) {
      if (phase === 'kumpul') {
        let best = null, bd = 1.3; for (const b of bundles) if (!b.collected && !b.flying) { const d = Math.hypot(p.x - b.g.position.x, p.y - b.g.position.z); if (d < bd) { bd = d; best = b; } }
        if (best) { best.flying = 0; best.from = best.g.position.clone(); best.to = new T.Vector3(TIKAR.x - 1.2 + (onMat % 4) * .8, .25 + Math.floor(onMat / 4) * .35, TIKAR.z - .5 + (onMat % 2) * .6); sfx.pop(); }
      } else if (phase === 'banting' && swing <= 0) {
        swing = .45; slams++; let misses = slams - good;
        const hit = Math.abs(mark.position.x) < zoneW / 2;
        if (hit) { good++; misses = slams - good; sfx.hammer(); for (let k = 0; k < 40; k++) grain.add(TONG.x + (Math.random() - .5) * 1.2, 1.4, TONG.z + (Math.random() - .5) * .6, (Math.random() - .5) * 3, 2 + Math.random() * 2, (Math.random() - .5) * 2, .8); zoneW = Math.max(.45, zoneW - .04); }
        else { sfx.bad(); for (let k = 0; k < 10; k++) grain.add(TONG.x, 1.4, TONG.z, (Math.random() - .5) * 2, 1.5, (Math.random() - .5) * 2, .6); toast('Kurang tepat! Tunggu tanda dalam zon hijau', 'Off timing! Wait for the marker in the green zone'); }
        grainFill.visible = good > 0; grainFill.scale.y = Math.max(.01, good / SLAMS * 5); grainFill.position.y = .15 + grainFill.scale.y * .05;
        api.progress(good / SLAMS);
        if (good >= SLAMS) { phase = 'done'; sfx.good(); toast('Tong penuh! · The tub is full!', ''); setTimeout(() => api.finish({ stars: misses <= 1 ? 3 : misses <= 4 ? 2 : 1, kg: 20 }), 1300); }
      }
    },
    update(dt, p, cam) {
      t += dt;
      if (cam) {
        if (phase === 'tuai' && p.on) { arms.R.set(fpAnchor(cam, .5), sabit.localToWorld(new T.Vector3(0, -.62, 0))); arms.L.hide(); }
        else if (phase === 'banting' || phase === 'done') { held.updateMatrixWorld(true); arms.L.set(fpAnchor(cam, -.45), held.localToWorld(new T.Vector3(-.55, 0, .1))); arms.R.set(fpAnchor(cam, .45), held.localToWorld(new T.Vector3(-.35, 0, -.1))); }
        else { arms.L.hide(); arms.R.hide(); }
      }
      if (phase === 'tuai') {
        if (p.on) { sabit.position.set(p.x, .9, p.y); sabit.rotation.y = Math.sin(t * 3) * .1 + (p.down ? Math.atan2(p.x - p.lx, p.y - p.ly) : 0) * .3; }
        if (p.down && p.on && p.mv > .04) {
          if (t - lastSwish > .18) { sfx.swish(); lastSwish = t; }
          const ax = p.lx, az = p.ly, bx = p.x, bz = p.y, dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1e-6;
          clumps.forEach((cl, c) => {
            if (cl.cut) return; const u = clamp(((cl.x - ax) * dx + (cl.z - az) * dz) / L2, 0, 1), ex = ax + u * dx - cl.x, ez = az + u * dz - cl.z;
            if (ex * ex + ez * ez < .95 * .95) { cl.cut = true; cutN++; for (let k = 0; k < 12; k++) chaff.add(cl.x, .8, cl.z, (Math.random() - .5) * 4, 2 + Math.random() * 2, (Math.random() - .5) * 4, .7); api.progress(cutN / n); }
          });
        }
        clumps.forEach((cl, c) => { if (cl.cut && cl.t < 1) { cl.t = Math.min(1, cl.t + dt * 4); setClump(c); } });
        if (cutN >= n && clumps.every(c => c.t >= 1)) {
          phase = 'kumpul'; sabit.visible = false; sfx.good(); api.progress(0);
          for (let k = 0; k < n; k += 2) { const a = clumps[k], b = clumps[k + 1]; const g = makeBundle((a.x + b.x) / 2, (a.z + b.z) / 2); g.rotation.y = r() * 6; bundles.push({ g, collected: false }); }
          clumps.forEach((cl, c) => { cl.gone = true; setClump(c); });
          stalks.material.color.set(0xa08a3a);
          api.step('Ketik setiap berkas padi untuk kumpul di atas tikar', 'Tap each padi bundle to gather it onto the mat');
        }
      } else if (phase === 'kumpul') {
        for (const b of bundles) if (b.flying !== undefined && !b.collected) {
          b.flying = Math.min(1, b.flying + dt * 2.5); const f = b.flying;
          b.g.position.lerpVectors(b.from, b.to, f); b.g.position.y += Math.sin(f * Math.PI) * 2.2;
          if (f >= 1) { b.collected = true; onMat++; api.progress(onMat / bundles.length); }
        }
        if (onMat >= bundles.length) {
          phase = 'banting'; setView(TONG_VIEW); meter.visible = true; held.visible = true; api.progress(0);
          api.step('Ketik bila tanda kuning masuk zon hijau — banting padi!', 'Tap when the yellow marker is in the green zone — thresh the padi!');
        }
      } else if (phase === 'banting' || phase === 'done') {
        mark.position.x = Math.sin(t * (2.4 + good * .18)) * 1.35; zone.scale.x = zoneW / .7;
        if (swing > 0) swing -= dt;
        const s = Math.max(0, swing) / .45, raise = s > .5 ? (1 - s) * 2 : s * 2; // slam down then lift
        held.position.set(TONG.x - .1, 1.25 + (1 - raise) * 1.0, TONG.z + .3);
        held.rotation.set(0, 0, (swing > 0 ? (1 - raise) : 1) * -1.1 + .2);
        if (swing <= 0) { held.position.y = 2.1 + Math.sin(t * 3) * .04; held.rotation.z = -.9; }
      }
      chaff.update(dt); grain.update(dt);
      const target = phase === 'kumpul' ? (() => { const b = bundles.find(b => !b.collected && b.flying === undefined); return b ? [b.g.position.x, 1.6, b.g.position.z] : null; })() : null;
      arrow.visible = !!target; if (target) arrow.position.set(target[0], target[1] + Math.sin(t * 5) * .12, target[2]);
    },
  };
}

// ------------------------------------------------------------ shared sea scenery (Bab 3)
function seaScene(K, scene, M, r) {
  const ocean = makeOcean(T, { w: 240, h: 160, seg: .7, amp: .16, deep: 0x0b4f78, shallow: 0x2a9fc4, sky: 0xcdeefa, repeat: 26 }); ocean.mesh.position.set(0, -.08, -40); scene.add(ocean.mesh);
  const i1 = K.ball(1, K.mat(0x3f8f3f), -26, -1.2, -58, scene); i1.scale.set(16, 6, 7);
  const i2 = K.ball(1, K.mat(0x4a9a48), 30, -1.2, -64, scene); i2.scale.set(14, 4.5, 7);
  for (const [x, z] of [[-24, -52], [-29, -55], [27, -59]]) palm(K, scene, x, z, 1.1, r);
  const glints = new T.Group(); scene.add(glints);
  for (let k = 0; k < 40; k++) { const m = K.box(.6 + r() * .8, .01, .06, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .45 }), (r() - .5) * 30, .02, -2 - r() * 26, glints, false); m.userData.ph = r() * 6; }
  return (t) => { ocean.update(t, scene.background); for (const g of glints.children) { g.material.opacity = .45 * Math.max(0, Math.sin(t * 1.3 + g.userData.ph)); g.position.x += .003; if (g.position.x > 15) g.position.x = -15; } };
}

// ------------------------------------------------------------ 5. BAIKI BOT (3D)
function Boat3D(K, api, opts, M = {}) {
  const scene = new T.Scene(); environment(K, scene, { sky: 0xa6dcf2, shadow: 9, fogNear: 30, fogFar: 85 });
  const r = mulberry32(opts.seed || 51);
  K.mesh(new T.BoxGeometry(90, .4, 30), K.mat(0xf1dca0, { roughness: 1 }), 0, -.18, 3, scene, false);
  const waves = seaScene(K, scene, M, r);
  for (const [x, z, s] of [[-10, -4, 1.2], [10.5, -6, 1.15], [-11, 5.5, 1], [11.5, 4.5, 1.1]]) palm(K, scene, x, z, s, r);
  putModel(M, 'rowboat', scene, -7.5, -13, { len: 3.6, ry: .5, y: -.2 }); putModel(M, 'rowboat', scene, 6.5, -15, { len: 3.2, ry: -.7, y: -.2 });
  putModel(M, 'rope', scene, -5.6, 2.6, { h: .45 }); putModel(M, 'bucket', scene, -5.2, 3.6, { h: .7, ry: 1 }); putModel(M, 'saw', scene, 3.2, 3.4, { h: .2, ry: .6 }); putModel(M, 'mallet', scene, 2.2, 3.1, { h: .3, ry: 2 });
  // upturned hull on two trestles
  const TOP = 1.0, DEPTH = .55, shape = new T.Shape(), pts = [];
  for (let x = HULL.L0; x <= HULL.L1 + 1e-6; x += .1) pts.push([x, halfW(x)]);
  shape.moveTo(pts[0][0], pts[0][1]); for (const [x, y] of pts.slice(1)) shape.lineTo(x, y); for (const [x, y] of pts.slice().reverse()) shape.lineTo(x, -y);
  const body = new T.ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: false, curveSegments: 4 }); body.rotateX(-Math.PI / 2);
  K.mesh(body, K.mat(0x6e5236), 0, TOP - DEPTH, 0, scene);
  const H = K.canvasTex(HULL.CW, HULL.CH);
  const capGeo = new T.ShapeGeometry(shape, 4); { const pos = capGeo.attributes.position, uv = capGeo.attributes.uv; for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - HULL.L0) / (HULL.L1 - HULL.L0), (pos.getY(i) + 1.4) / 2.8); } capGeo.rotateX(-Math.PI / 2);
  K.mesh(capGeo, new T.MeshStandardMaterial({ map: H.t, transparent: true, roughness: .8 }), 0, TOP + .01, 0, scene, false);
  for (const tx of [-2, 2]) { K.box(.3, .16, 3, K.mat(0x7a5236), tx, TOP - DEPTH - .08, 0, scene); for (const z of [-1.2, 1.2]) for (const dx of [-.3, .3]) { const l = K.box(.12, TOP - DEPTH - .1, .12, K.mat(0x7a5236), tx + dx, (TOP - DEPTH - .1) / 2, z, scene); l.rotation.z = dx * .5; } }
  // patch planks on a crate
  const SX = HULL.STACK.px / HULL.PPU + HULL.L0, SZ = HULL.STACK.py / HULL.PPU - 1.4;
  K.box(1.1, TOP - .08, 1, K.mat(0x8a5a32), SX, (TOP - .08) / 2, SZ, scene);
  const plankM = K.mat(0xc09060), stack = [];
  for (let k = 0; k < 3; k++) stack.push(K.box(.92, .05, .56, plankM, SX, TOP + k * .06, SZ, scene));
  // tools
  const scraper = K.group(0, 0, 0, scene); K.box(.9, .05, .2, K.mat(0x9aa4a8, { metalness: .7, roughness: .3 }), 0, 0, 0, scraper); K.box(.16, .16, .9, K.mat(0xc0392b), 0, .15, .5, scraper); scraper.rotation.x = .5;
  const brush = K.group(0, 0, 0, scene); brush.visible = false; const bristle = K.box(.8, .12, .3, K.mat(0x2e86de), 0, 0, 0, brush); K.box(.6, .1, .3, K.mat(0xd9b36c), 0, .12, 0, brush); K.box(.1, .1, .9, K.mat(0x8a5a32), 0, .2, .55, brush); brush.rotation.x = .4;
  const carry = K.box(.92, .05, .56, plankM, 0, 0, 0, scene); carry.visible = false;
  const flecks = new Sparks(scene, 300, 0xd9d4c5, .1), shine = new Sparks(scene, 80, 0xfff6c8, .2);
  const arrow = arrowMesh(K, scene);
  const plane = new T.Plane(new T.Vector3(0, 1, 0), -TOP), hp = new T.Vector3();
  const toW = (px, py) => [px / HULL.PPU + HULL.L0, py / HULL.PPU - 1.4];
  let dirty = true, t = 0;
  const core = boatCore(api, opts, () => { dirty = true; });
  const S = core.S;
  const view = { pos: new T.Vector3(.5, 2.6, 3.5), look: new T.Vector3(.5, .95, .05), halfW: 4.5, halfH: 2.4 }; // first person, leaning over the upturned hull
  const arms = fpArms(K, scene);
  return {
    scene, view, mvCap: 120,
    ray(rc) { if (!rc.ray.intersectPlane(plane, hp)) return { ok: false }; const px = (hp.x - HULL.L0) * HULL.PPU, py = (hp.z + 1.4) * HULL.PPU; return { x: px, y: py, ok: px > -150 && px < HULL.CW + 250 && py > -150 && py < HULL.CH + 150 }; },
    dbg: () => ({ phase: S.phase, holes: S.holes, stack: HULL.STACK }),
    down(p) { core.down(p); }, move(p) { core.move(p); }, up() { core.up(); },
    update(dt, p, cam) {
      t += dt; waves(t);
      const was = S.phase; core.update(dt, p);
      if (cam) {
        if (scraper.visible) { arms.R.set(fpAnchor(cam, .5), scraper.localToWorld(new T.Vector3(0, .2, .85))); arms.L.hide(); }
        else if (brush.visible) { arms.R.set(fpAnchor(cam, .5), brush.localToWorld(new T.Vector3(0, .2, .95))); arms.L.hide(); }
        else if (S.carry) { arms.L.set(fpAnchor(cam, -.45), carry.localToWorld(new T.Vector3(-.42, 0, .2))); arms.R.set(fpAnchor(cam, .45), carry.localToWorld(new T.Vector3(.42, 0, .2))); }
        else { arms.L.hide(); arms.R.hide(); }
      }
      if (S.phase === 'scrape' && p.down && p.on && p.mv > 2 && Math.random() < .5) { const [wx, wz] = toW(p.x, p.y); flecks.add(wx, TOP + .1, wz, (Math.random() - .5) * 2, 1.5, (Math.random() - .5) * 2, .6); }
      if (was !== S.phase && S.phase === 'done') for (let k = 0; k < 40; k++) shine.add((Math.random() - .5) * 6, TOP + .2, (Math.random() - .5) * 2, (Math.random() - .5), 2 + Math.random() * 2, (Math.random() - .5), 1);
      if (dirty) { drawHull(H.x, S); H.t.needsUpdate = true; dirty = false; }
      const [wx, wz] = toW(p.x, p.y);
      scraper.visible = S.phase === 'scrape' && p.on; brush.visible = S.phase === 'paint' && p.on;
      if (scraper.visible) scraper.position.set(wx, TOP + (p.down ? .12 : .4), wz);
      if (brush.visible) { brush.position.set(wx, TOP + (p.down ? .1 : .4), wz); bristle.material.color.set(S.color); }
      carry.visible = !!S.carry; if (S.carry) { const [cx, cz] = toW(S.carry.x, S.carry.y); carry.position.set(cx, TOP + .35, cz); }
      const left = S.holes.filter(h => !h.patched).length - (S.carry ? 1 : 0);
      stack.forEach((m, k) => { m.visible = S.phase === 'scrape' || (S.phase === 'patch' && k < left); });
      let target = null;
      if (S.phase === 'patch') { if (S.carry) { const h = S.holes.find(h => !h.patched); if (h) { const [hx, hz] = toW(h.px, h.py); target = [hx, TOP + .9, hz]; } } else target = [SX, TOP + 1, SZ]; }
      arrow.visible = !!target; if (target) arrow.position.set(target[0], target[1] + Math.sin(t * 5) * .12, target[2]);
      flecks.update(dt, -6); shine.update(dt, -3);
    },
    stop() { core.stop(); },
  };
}

// ------------------------------------------------------------ 6. MEMANCING (3D): sail out on Pak Mat's boat, then fish from the deck
function makeAngler(K, look) {
  const g = new T.Group(), body = new T.Group(); g.add(body); body.scale.setScalar(.88);
  const m = (c) => K.mat(c);
  const legs = []; for (const lx of [-.13, .13]) { const p = K.group(lx, .82, 0, body); K.mesh(new T.CapsuleGeometry(.095, .5, 3, 8), m(look.pants), 0, -.4, 0, p); legs.push(p); }
  K.mesh(new T.CapsuleGeometry(.24, .42, 4, 12), m(look.shirt), 0, 1.16, 0, body);
  const vest = K.mesh(new T.CapsuleGeometry(.262, .22, 4, 12), m(0xff7a1a), 0, 1.22, 0, body); vest.scale.z = .96;
  const arms = []; for (const ax of [-.33, .33]) { const p = K.group(ax, 1.43, 0, body); K.mesh(new T.CapsuleGeometry(.075, .38, 3, 8), m(look.shirt), 0, -.24, 0, p); K.ball(.085, m(look.skin), 0, -.5, 0, p); arms.push(p); }
  K.ball(.26, m(look.skin), 0, 1.8, 0, body);
  for (const ex of [-.09, .09]) K.ball(.035, m(0x1a1a1a), ex, 1.83, .235, body);
  K.mesh(new T.TorusGeometry(.07, .015, 6, 12, Math.PI), m(0x6b2b1f), 0, 1.72, .24, body).rotation.z = Math.PI;
  K.mesh(new T.SphereGeometry(.275, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), m(look.cap), 0, 1.86, 0, body);
  K.box(.27, .03, .24, m(look.cap), 0, 1.88, .25, body);
  return { g, body, arms, legs };
}
// TYRANZ main character (static mesh, 1 unit tall). For the catch pose the arms are bent forward by
// deforming the arm vertices around the shoulders, so the hands come together in front of the chest.
function makeHero(K, M, h = 1.45, armUp = 0) {
  const g = new T.Group(), body = new T.Group(); g.add(body);
  const m = putModel(M, 'hero', body, 0, 0, { h }); if (!m) return null;
  if (armUp) m.traverse((o) => {
    if (!o.isMesh) return; const geo = o.geometry = o.geometry.clone(), pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      if (Math.abs(x) < .135 || y < .3) continue;
      const w = clamp((.585 - y) / .09, 0, 1); if (!w) continue;
      const a = -armUp * w, dy = y - .56, c = Math.cos(a), sn = Math.sin(a);
      pos.setXYZ(i, x - Math.sign(x) * .045 * w, .56 + dy * c - z * sn, dy * sn + z * c);
    }
    pos.needsUpdate = true; geo.computeVertexNormals();
  });
  return { g, body, arms: [new T.Group(), new T.Group()], hero: true, h };
}
function textSprite(K, text, col) {
  const c = K.canvasTex(512, 128); c.x.fillStyle = 'rgba(16,40,48,.85)'; c.x.beginPath(); c.x.roundRect(4, 14, 504, 100, 50); c.x.fill(); c.x.strokeStyle = col; c.x.lineWidth = 8; c.x.stroke();
  c.x.fillStyle = '#fff'; c.x.font = '800 54px system-ui'; c.x.textAlign = 'center'; c.x.textBaseline = 'middle'; c.x.fillText(text, 256, 66); c.t.needsUpdate = true;
  const s = new T.Sprite(new T.SpriteMaterial({ map: c.t, depthTest: false })); s.scale.set(8, 2, 1); s.renderOrder = 5; return s;
}
function Fish3D(K, api, opts, M = {}) {
  const scene = new T.Scene(); const sun = environment(K, scene, { sky: 0xa6dcf2, shadow: 14, fogNear: 60, fogFar: 140 });
  const r = mulberry32(opts.seed || 61);
  const waves = seaScene(K, scene, M, r);
  // shore + jetty where the trip starts
  const plank = K.mat(0xa77b4f), postM = K.mat(0x5d3f2a);
  for (let z = 1; z < 18; z += .62) K.box(3, .12, .56, plank, 0, .6, z + .3, scene);
  for (let z = 1.2; z < 18; z += 2.4) for (const x of [-1.4, 1.4]) K.cyl(.12, .12, 2.2, postM, x, -.3, z, scene, 6);
  K.mesh(new T.BoxGeometry(80, .6, 30), K.mat(0xf1dca0, { roughness: 1 }), 0, .1, 31, scene, false);
  for (const [x, z, s] of [[-8, 18, 1.3], [-13, 20, 1.1], [9, 19, 1.2], [15, 21, 1]]) palm(K, scene, x, z, s, r);
  putModel(M, 'rowboat', scene, -4, 8, { len: 3.6, ry: .3, y: -.2 }); putModel(M, 'bucket', scene, -.8, 3, { h: .55, y: .66 });
  // spots: buoys with labels
  const SPOT_POS = { pantai: new T.Vector3(-13, 0, -16), karang: new T.Vector3(15, 0, -30), dalam: new T.Vector3(-3, 0, -52) };
  const SPOT_COL = { pantai: 0x2ecc71, karang: 0xa55eea, dalam: 0x2e86de };
  const buoys = {};
  for (const [id, p] of Object.entries(SPOT_POS)) { const g = K.group(p.x, 0, p.z, scene); K.cyl(.45, .6, 1.2, K.mat(SPOT_COL[id], { roughness: .4 }), 0, .3, 0, g, 14); K.cyl(.05, .05, 2, K.mat(0x333333), 0, 1.6, 0, g, 6); K.box(.8, .5, .04, K.mat(0xffd452), .4, 2.3, 0, g);
    const lab = textSprite(K, SPOTS[id].bm, '#' + SPOT_COL[id].toString(16).padStart(6, '0')); lab.position.set(0, 4.2, 0); g.add(lab); buoys[id] = g; }
  // Pak Mat's fishing boat (TYRANZ) — bow faces -z inside boatG
  const DOCK = new T.Vector3(3.3, 0, 5.5);
  const boatG = K.group(DOCK.x, 0, DOCK.z, scene), hull = K.group(0, 0, 0, boatG);
  let boatModel = putModel(M, 'fboat', hull, 0, 0, { scale: 1, ry: Math.PI, y: -.95 });
  if (boatModel) for (const nm of ['hauler-mount', 'hauler', 'hauler-weed']) { const o = boatModel.getObjectByName(nm); if (o) o.visible = false; } // the net-hauler arm sat right in the angler's line of sight
  if (!boatModel) { K.box(2.4, 1, 6.6, K.mat(0xf4f1e6), 0, .2, 0, hull); K.box(2.5, .2, 6.7, K.mat(0x2e86de), 0, .75, 0, hull); }
  // deck height under the angler, measured from the model
  // find open deck (not the cabin roof): sample along the starboard side and take the lowest floor above the waterline, preferring the bow
  const STAND = new T.Vector3(.5, 0, -1.6);
  let deckY = .75;
  if (boatModel) { boatG.updateMatrixWorld(true); let best = null;
    for (let z = -2.6; z <= 2.6; z += .2) for (const x of [.35, .55]) { const rc = new T.Raycaster(new T.Vector3(DOCK.x + x, 12, DOCK.z + z), new T.Vector3(0, -1, 0)); const h = rc.intersectObject(boatModel, true)[0];
      if (h && h.point.y > .15 && h.point.y < 2.2 && (!best || h.point.y < best.y - .05 || (Math.abs(h.point.y - best.y) <= .05 && z < best.z))) best = { x, z, y: h.point.y }; }
    if (best) { STAND.set(best.x, 0, best.z); deckY = best.y; } }
  // where the eyes are while sailing: up at the bow, looking ahead
  let BOW_EYE = new T.Vector3(0, deckY + 1.5, -2.2);
  if (boatModel) { boatG.updateMatrixWorld(true); const bb = new T.Box3().setFromObject(boatModel); BOW_EYE = new T.Vector3(0, deckY + 1.55, bb.min.z - DOCK.z + 1.1); }
  // the player (TYRANZ hero) is only seen in the map view and the catch pose — everything else is first person
  const angler = makeHero(K, M, 1.45, 1.25) || makeAngler(K, { shirt: 0x2e86de, pants: 0x2d3a4a, skin: 0xc08050, cap: 0xe74c3c });
  angler.g.position.set(STAND.x, deckY, STAND.z); angler.g.rotation.y = Math.PI / 2; boatG.add(angler.g);
  if (!angler.hero) { angler.arms[0].rotation.x = -1.15; angler.arms[1].rotation.x = -1.15; }
  // rod in the player's own hands (first person)
  const rod = K.group(0, 0, 0, scene), ROD_LEN = 2.6;
  { const geo = new T.CylinderGeometry(.01, .028, ROD_LEN, 8); geo.rotateX(Math.PI / 2); geo.translate(0, 0, ROD_LEN / 2); K.mesh(geo, K.mat(0x2b2b2b), 0, 0, 0, rod, false);
    const reel = K.cyl(.05, .05, .06, K.mat(0xc0c6ca, { metalness: .6, roughness: .3 }), 0, -.08, .28, rod, 12); reel.rotation.z = Math.PI / 2; }
  const tipLocal = new T.Vector3(0, 0, ROD_LEN), tip = new T.Vector3();
  const arms = fpArms(K, scene);
  // fishing rig: placed at the anchored boat, local -z = out to sea on the boat's right side
  const rig = K.group(0, 0, 0, scene);
  const shadowM = new T.MeshBasicMaterial({ color: 0x0a3550, transparent: true, opacity: .45, depthWrite: false });
  const shadows = []; const shadowFor = (k) => { while (shadows.length <= k) { const g = new T.Group(); const mm = new T.Mesh(new T.CircleGeometry(.5, 20), shadowM.clone()); mm.rotation.x = -Math.PI / 2; mm.scale.set(1.3, .42, 1); g.add(mm); const tl = new T.Mesh(new T.CircleGeometry(.25, 3), mm.material); tl.rotation.x = -Math.PI / 2; tl.position.x = -.7; g.add(tl); g.position.y = .03; rig.add(g); shadows.push(g); } return shadows[k]; };
  const rings = []; for (let k = 0; k < 8; k++) { const mm = K.mesh(new T.RingGeometry(.9, 1, 32), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }), 0, .04, 0, rig, false); mm.rotation.x = -Math.PI / 2; mm.userData = { t: 1, s: 1 }; rings.push(mm); }
  let ri = 0; const ring = (x, z, s) => { const mm = rings[ri = (ri + 1) % rings.length]; mm.position.x = x; mm.position.z = z; mm.userData = { t: 0, s }; };
  const spray = new Sparks(scene, 260, 0xe8f6ff, .12), wake = new Sparks(scene, 260, 0xffffff, .18), glitter = new Sparks(scene, 120, 0xfff3b0, .06);
  const lineGeo = new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3()]);
  const lineM = new T.LineBasicMaterial({ color: 0xffffff }); const line = new T.Line(lineGeo, lineM); line.frustumCulled = false; scene.add(line);
  const bob = K.group(0, 0, 0, rig); K.ball(.15, K.mat(0xe74c3c, { roughness: .4 }), 0, .07, 0, bob); K.ball(.13, K.mat(0xffffff, { roughness: .4 }), 0, -.03, 0, bob); K.cyl(.02, .02, .3, K.mat(0xe74c3c), 0, .3, 0, bob, 6);
  const alertG = K.group(0, 0, 0, rig); alertG.visible = false; const am = K.mat(0xe74c3c, { emissive: 0x8a1010, emissiveIntensity: .6 }); K.box(.16, .55, .16, am, 0, .45, 0, alertG); K.ball(.1, am, 0, 0, 0, alertG);
  const aimRing = K.mesh(new T.RingGeometry(.45, .6, 32), new T.MeshBasicMaterial({ color: 0xffd452, transparent: true, opacity: .9, depthWrite: false }), 0, .05, 0, rig, false); aimRing.rotation.x = -Math.PI / 2; aimRing.visible = false;
  const pullArrow = K.group(0, 0, 0, rig); pullArrow.visible = false; { const pm = K.mat(0xffd452, { emissive: 0x8a6400, emissiveIntensity: .6 }); const c = K.mesh(new T.ConeGeometry(.35, .6, 3), pm, .6, 0, 0, pullArrow, false); c.rotation.z = -Math.PI / 2; K.box(.8, .16, .16, pm, 0, 0, 0, pullArrow, false); }
  const jump = K.group(0, -50, 0, rig); let jumpT = 0, jumpModel = null;
  const hold = angler.hero ? K.group(0, .5 * angler.h, .3 * angler.h, angler.body) : K.group(0, 1.22, .62, angler.body); let holdModel = null;
  const fishModel = (kind, parent, len) => { const mm = putModel(M, kind.model, parent, 0, 0, { len }); if (mm) { skinFish(mm, kind.id); const sz = mm.userData.size; if (sz) mm.position.y = -sz.y * mm.scale.y / 2; return mm; }
    const g = K.group(0, 0, 0, parent); const bd = K.ball(.5, K.mat(0x5f8fb0), 0, 0, 0, g); bd.scale.set(len, len * .35, len * .2); return g; };
  // airliner passing high overhead now and then
  const plane = putModel(M, 'airliner', scene, 0, -400, { len: 26, y: 46 }); let planeT = 6;
  // ---------------------------------------------------------- underwater: after the cast we follow the bait down and watch the fish take it
  const SKY_BG = scene.background.clone(), SKY_FOG = scene.fog, UNDER_BG = new T.Color(0x0e5b70), UNDER_FOG = new T.Fog(0x0e5b70, 1.2, 22);
  const under = K.group(0, 0, 0, rig); under.visible = false;
  const HOOK_D = -1.8, BED_Y = -7;
  { const st = K.canvasTex(256, 256); st.x.fillStyle = '#cdb98e'; st.x.fillRect(0, 0, 256, 256);
    for (let k = 0; k < 3000; k++) { st.x.fillStyle = r() < .5 ? 'rgba(90,70,40,.12)' : 'rgba(255,250,230,.12)'; st.x.fillRect(r() * 256, r() * 256, 2, 2); }
    st.x.strokeStyle = 'rgba(120,95,55,.25)'; st.x.lineWidth = 3; for (let y = 8; y < 256; y += 22) { st.x.beginPath(); for (let x = 0; x <= 256; x += 8) { const yy = y + Math.sin(x / 18) * 4; x ? st.x.lineTo(x, yy) : st.x.moveTo(x, yy); } st.x.stroke(); }
    st.t.wrapS = st.t.wrapT = T.RepeatWrapping; st.t.repeat.set(10, 10); st.t.needsUpdate = true;
    const bed = K.mesh(new T.PlaneGeometry(80, 80), new T.MeshStandardMaterial({ map: st.t, roughness: 1 }), 0, BED_Y, -8, under, false); bed.rotation.x = -Math.PI / 2; }
  const reef = K.group(0, 0, 0, under);
  function buildReef(kind) {
    while (reef.children.length) reef.remove(reef.children[0]);
    const rockM = K.mat(0x5d6a6b, { roughness: 1 }), cols = kind === 'karang' ? [0xff7a59, 0xf6c445, 0xb36bd4, 0x4fd1c5, 0xff9fb2, 0x7bd389] : [0x6f8f5a, 0x8aa36b, 0x5f7a4d];
    for (let k = 0; k < 26; k++) { const x = (r() - .5) * 26, z = -2 - r() * 22; const rk = K.ball(.5 + r() * 1.2, rockM, x, BED_Y + .2, z, reef); rk.scale.set(1 + r(), .5 + r() * .5, 1 + r()); }
    const n = kind === 'karang' ? 90 : kind === 'pantai' ? 40 : 14;
    for (let k = 0; k < n; k++) { const x = (r() - .5) * 24, z = -1 - r() * 20, c = K.mat(cols[Math.floor(r() * cols.length)], { roughness: .7 });
      if (kind === 'pantai') { const h = .6 + r() * 1.4; const b = K.box(.06, h, .02, c, x, BED_Y + h / 2, z, reef, false); b.rotation.z = (r() - .5) * .4; }       // seagrass
      else if (r() < .5) { const h = .5 + r() * 1.2; const t = K.mesh(new T.ConeGeometry(.12 + r() * .2, h, 6), c, x, BED_Y + h / 2, z, reef); t.rotation.z = (r() - .5) * .5; } // branching coral
      else { const b = K.ball(.25 + r() * .45, c, x, BED_Y + .2, z, reef); b.scale.y = .6; }                                                                       // brain / table coral
    }
  }
  const shaftM = new T.MeshBasicMaterial({ color: 0xcff6ff, transparent: true, opacity: .07, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });
  const shafts = []; for (let k = 0; k < 9; k++) { const sh = K.mesh(new T.PlaneGeometry(.8 + r() * 1.4, 14), shaftM, (r() - .5) * 14, -5, -2 - r() * 14, under, false); sh.rotation.set(0, r() * 3, .25 + r() * .15); shafts.push(sh); }
  const motes = (() => { const n = 260, pos = new Float32Array(n * 3); for (let k = 0; k < n; k++) pos.set([(r() - .5) * 14, -r() * 6.5, -r() * 16], k * 3); const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); const pts = new T.Points(g, new T.PointsMaterial({ color: 0xdff6ff, size: .035, transparent: true, opacity: .55, depthWrite: false })); pts.frustumCulled = false; under.add(pts); return pts; })();
  const bubbles = new Sparks(scene, 160, 0xe8fbff, .07);
  // terminal tackle: sinker, hook and a bait shrimp
  const tackle = K.group(0, HOOK_D, 0, under);
  { const steel = K.mat(0xc9d1d6, { metalness: .9, roughness: .25 });
    K.ball(.045, K.mat(0x6d7275, { metalness: .5, roughness: .4 }), 0, .55, 0, tackle);
    const hk = K.mesh(new T.TorusGeometry(.06, .008, 6, 18, Math.PI * 1.35), steel, 0, -.02, 0, tackle, false); hk.rotation.z = Math.PI * .85;
    K.cyl(.007, .007, .16, steel, .06, .06, 0, tackle, 6);
    const shrimp = K.group(.02, -.06, 0, tackle); const pink = K.mat(0xf2a083, { roughness: .5 });
    for (let k = 0; k < 5; k++) { const sg = K.ball(.032 - k * .004, pink, Math.cos(k * .5) * .06 - .03, Math.sin(k * .5) * .05 - .04, 0, shrimp); sg.scale.set(1.3, 1, 1); } }
  const legGeo = new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3()]); const leader = new T.Line(legGeo, new T.LineBasicMaterial({ color: 0xe8f4f8, transparent: true, opacity: .8 })); leader.frustumCulled = false; under.add(leader);
  const alertU = K.group(0, 0, 0, under); alertU.visible = false; K.box(.09, .3, .09, am, 0, .25, 0, alertU); K.ball(.055, am, 0, 0, 0, alertU);
  const fishU = []; // one 3D fish per fish in the core, rebuilt when the species changes
  function fishMesh(k, f) {
    let g = fishU[k];
    if (!g) { g = K.group(0, 0, 0, under); fishU[k] = g; }
    if (g.userData.kind !== f.kind.id || g.userData.kg !== f.kg) { while (g.children.length) g.remove(g.children[0]); fishModel(f.kind, g, fishLen(f.kg)); g.userData.kind = f.kind.id; g.userData.kg = f.kg; }
    if (f.depth === undefined) f.depth = -1 - Math.random() * 3.6;
    return g;
  }
  let isUnder = false, underT = 0, hookT = 0, lastSt = '';
  function setUnder(on) {
    isUnder = on; under.visible = on; scene.background.copy(on ? UNDER_BG : SKY_BG); scene.fog = on ? UNDER_FOG : SKY_FOG;
    for (const g of shadows) g.visible = !on && anchored;
    if (on) { if (!reef.children.length) buildReef(Object.keys(SPOTS).find(k => SPOTS[k] === S.spot) || 'pantai'); sfx.splash(); }
    else fishView();
  }
  // ---------------------------------------------------------- HUD (DOM)
  let hud = $('fishHud'); if (!hud) { hud = document.createElement('div'); hud.id = 'fishHud'; $('game').append(hud); }
  hud.innerHTML = '<div class="fhRow" id="fhPow"><span>KUASA · POWER</span><i><b></b></i></div><div class="fhRow" id="fhTen"><span>TEGANGAN · TENSION</span><i class="zones"><b></b></i></div><div class="fhRow" id="fhSta"><span>TENAGA IKAN · FISH STAMINA</span><i><b></b></i></div><div id="fhRun"></div><div id="fhCount"></div>';
  hud.hidden = false;
  // ---------------------------------------------------------- core
  const core = fishCore(api, opts, {
    sail: (id) => startSail(id),
    splash: (x, z) => { const w = rig.localToWorld(new T.Vector3(x, .1, z)); for (let k = 0; k < 18; k++) spray.add(w.x, w.y, w.z, (Math.random() - .5) * 2, 2 + Math.random() * 1.5, (Math.random() - .5) * 2, .6); ring(x, z, 1); },
    ripple: (x, z, s) => ring(x, z, s),
    hook: (h) => { if (jumpModel) { jump.remove(jumpModel); jumpModel = null; } jumpModel = fishModel(h.kind, jump, fishLen(h.kg)); if (isUnder) { hookT = 1.1; toast('Kena! Ikan dah terkait!', 'Hooked it!'); } },
    run: () => { const h = core.S.hooked; if (h && (RARITY[h.kind.rar].stars >= 2 || Math.random() < .35)) jumpT = .8; },
    caught: (p) => { const w = rig.localToWorld(new T.Vector3(core.S.bob.x, .1, core.S.bob.z)); for (let k = 0; k < 24; k++) spray.add(w.x, w.y, w.z, (Math.random() - .5) * 2.5, 2.5 + Math.random() * 2, (Math.random() - .5) * 2.5, .7); startPose(p); },
    resume: () => endPose(),
  });
  const S = core.S;
  const sea = seaAmbience();
  // ---------------------------------------------------------- views
  const view = { pos: new T.Vector3(5, 21, 30), look: new T.Vector3(0, 0, -16), halfW: 21, halfH: 13 };
  const setV = (pos, look, hw, hh) => { view.pos.copy(pos); view.look.copy(look); view.halfW = hw; view.halfH = hh; };
  const rigV = (x, y, z) => rig.localToWorld(new T.Vector3(x, y, z));
  const fishView = () => setV(rigV(0, deckY + 1.45, -.45), rigV(0, -.5, -8.5), 8, 4.6); // the angler's own eyes, leaning on the rail
  let mode = S.spot ? 'fish' : 'choose', sail = null, engine = null, poseT = 0, anchored = false;
  function anchorAt(pos, heading) {
    boatG.position.set(pos.x, 0, pos.z); boatG.rotation.y = heading; boatG.updateMatrixWorld(true);
    const a = angler.g.getWorldPosition(new T.Vector3()); rig.position.set(a.x, 0, a.z); rig.rotation.y = heading - Math.PI / 2; rig.updateMatrixWorld(true);
    anchored = true; for (const b of Object.values(buoys)) b.visible = false; fishView();
  }
  if (S.spot) { const id = Object.keys(SPOTS).find(k => SPOTS[k] === S.spot) || 'pantai'; anchorAt(SPOT_POS[id], 0); }
  function startSail(id) {
    const P0 = DOCK.clone(), P2 = SPOT_POS[id].clone().add(new T.Vector3(3, 0, 3)), P1 = new T.Vector3(DOCK.x, 0, DOCK.z - 14);
    const L = P0.distanceTo(P1) + P1.distanceTo(P2); sail = { P0, P1, P2, t: 0, dur: clamp(L / 8, 3.5, 7.5) }; mode = 'sail';
    for (const [k, b] of Object.entries(buoys)) b.visible = k === id;
    engine = boatEngine(); engine.set(.05); musicDuck(true); toast('Jom turun ke laut!', "Let's head out to sea!");
  }
  const bez = (s, k) => { const a = 1 - k; return new T.Vector3(a * a * s.P0.x + 2 * a * k * s.P1.x + k * k * s.P2.x, 0, a * a * s.P0.z + 2 * a * k * s.P1.z + k * k * s.P2.z); };
  function startPose(p) {
    mode = 'pose'; poseT = 0; rod.visible = false; line.visible = false; bob.visible = false;
    if (holdModel) { hold.remove(holdModel); holdModel = null; }
    holdModel = fishModel(p.kind, hold, clamp(fishLen(p.kg) * 1.25, .75, 1.6)); api.step(`${p.bm}!`, `${p.en} — ${p.kg.toFixed(2)} kg`);
    angler.g.visible = true; arms.L.hide(); arms.R.hide();
    const hh = angler.hero ? angler.h : 1.8; setV(rigV(0, deckY + hh * .72, -hh * 2.1), rigV(-hh * .5, deckY + hh * .55, 0), hh * 1.35, hh * .78);
    setTimeout(() => { if (core.S.st === 'pose') showFishCard(p, opts, () => core.next()); }, 650);
  }
  function endPose() {
    mode = 'fish'; rod.visible = true; line.visible = true; bob.visible = true;
    if (holdModel) { hold.remove(holdModel); holdModel = null; }
    angler.g.visible = false; fishView();
  }
  const waterPl = new T.Plane(new T.Vector3(0, 1, 0), 0), hp = new T.Vector3();
  let t = 0, reelS = null;
  const show = (id, on, f) => { const e = $(id); if (!e) return; e.style.display = on ? '' : 'none'; if (on && f !== undefined) e.querySelector('b').style.width = `${clamp(f, 0, 1) * 100}%`; };
  return {
    scene, view, mvCap: 3,
    ray(rc) {
      if (!rc.ray.intersectPlane(waterPl, hp)) return { ok: false };
      if (mode === 'choose') return { x: hp.x, y: hp.z, ok: true };
      const l = rig.worldToLocal(hp.clone()); return { x: l.x, y: l.z, ok: true };
    },
    dbg: () => ({ mode, st: S.st, tension: S.tension, stamina: S.stamina, run: S.run, side: S.side, catches: S.catches.length, miss: S.miss, power: S.power, fishes: S.fishes.map(f => ({ x: f.x, z: f.z, mode: f.mode, rar: f.kind.rar })), deckY }),
    choose: (id) => core.choose(id), next: () => { hideFishCard(); core.next(); },
    down(p) {
      if (mode === 'choose') { let best = null, bd = 9; for (const [id, v] of Object.entries(SPOT_POS)) { const d = Math.hypot(p.x - v.x, p.y - v.z); if (d < bd) { bd = d; best = id; } } if (best) core.choose(best); return; }
      if (mode === 'fish') core.down(p.x, p.y);
    },
    move(p) { if (mode === 'fish' && p.down) core.move(p.x); },
    up() { if (mode === 'fish') core.up(); },
    update(dt, p, cam) {
      t += dt; waves(t);
      if (mode === 'choose') angler.g.visible = true;
      // sailing out
      if (mode === 'sail' && sail) {
        sail.t += dt; const k = Math.min(1, sail.t / sail.dur), e = k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
        const pos = bez(sail, e), ahead = bez(sail, Math.min(1, e + .02)), dir = ahead.clone().sub(pos);
        const head = dir.lengthSq() > 1e-6 ? Math.atan2(-dir.x, -dir.z) : boatG.rotation.y;
        boatG.position.set(pos.x, 0, pos.z); boatG.rotation.y = head; hull.rotation.x = -.06 * Math.sin(k * Math.PI);
        const fwd = new T.Vector3(-Math.sin(head), 0, -Math.cos(head));
        boatG.updateMatrixWorld(true); const eye = boatG.localToWorld(BOW_EYE.clone());
        setV(eye, eye.clone().addScaledVector(fwd, 9).add(new T.Vector3(0, -1.6, 0)), 6.4, 3.6); angler.g.visible = false;
        for (let q = 0; q < 3; q++) { const s = pos.clone().addScaledVector(fwd, -3.3); wake.add(s.x + (Math.random() - .5) * 1.4, .1, s.z + (Math.random() - .5) * .6, (Math.random() - .5) * 1.2, 1 + Math.random(), (Math.random() - .5) * 1.2, .7); }
        { const tb = Object.values(buoys).find(b => b.visible); if (tb) { const d = tb.position.distanceTo(pos); tb.children[tb.children.length - 1].visible = d > 14; if (d < 9) tb.visible = false; } }
        if (engine) engine.set(clamp(Math.min(sail.t * .8, (1 - k) * 3.5), .05, 1));
        if (k >= 1) { engine && engine.stop(); engine = null; musicDuck(false); hull.rotation.x = 0; anchorAt(pos, head); mode = 'fish'; toast('Sauh dilabuh! Masa memancing.', 'Anchor down! Time to fish.'); core.begin(); }
      }
      if (mode === 'choose') { for (const b of Object.values(buoys)) b.children[0].position.y = .3 + Math.sin(t * 2 + b.position.x) * .1; }
      // gentle bobbing at anchor
      if (mode !== 'sail') { hull.position.y = Math.sin(t * 1.3) * .05; hull.rotation.z = Math.sin(t * .9) * .025; }
      core.update(dt, mode === 'fish' && p.down);
      if (S.st === 'reel' && p.down) { if (!reelS) reelS = loopSound('scrub'); reelS.set(.08); } else if (reelS) { reelS.stop(); reelS = null; }
      // ---- underwater view: dive with the bait, watch the fish take it, see the hook set
      if (S.st !== lastSt) { if (S.st === 'wait' && lastSt === 'fly') underT = .35; lastSt = S.st; }
      if (underT > 0) { underT -= dt; if (underT <= 0 && mode === 'fish' && (S.st === 'wait' || S.st === 'bite')) setUnder(true); }
      if (hookT > 0) { hookT -= dt; if (hookT <= 0 && isUnder) setUnder(false); }
      if (isUnder && hookT <= 0 && !['wait', 'bite'].includes(S.st)) setUnder(false);
      if (isUnder) {
        const b0 = S.bob, Hk = new T.Vector3(b0.x, HOOK_D, b0.z), hooked = hookT > 0 && S.hooked;
        if (hooked) Hk.add(new T.Vector3(Math.sin(t * 23) * .12, Math.sin(t * 17) * .08, -.2 * (1.1 - hookT)));
        setV(rigV(b0.x + 1.6, HOOK_D + .45, b0.z + 3.1), rigV(b0.x - .25, HOOK_D - .1, b0.z - .4), 2.5, 1.45);
        tackle.position.copy(Hk); tackle.rotation.z = Math.sin(t * 1.7) * .15;
        const lp2 = legGeo.attributes.position; lp2.setXYZ(0, b0.x, -b0.dip * .6, b0.z); lp2.setXYZ(1, Hk.x, Hk.y + .55, Hk.z); lp2.needsUpdate = true;
        S.fishes.forEach((f, k) => {
          const g = fishMesh(k, f); const len = fishLen(f.kg), dir = new T.Vector3(Math.cos(f.h), 0, Math.sin(f.h)); let y = f.depth;
          if (f.mode === 'suitor' || f.mode === 'hooked') {
            const d = Math.hypot(f.x - b0.x, f.z - .35 - b0.z); f.depth += (HOOK_D - f.depth) * Math.min(1, dt * 1.5); y = f.depth;
            if (d < 1.4 || f.mode === 'hooked') { const lunge = S.st === 'bite' ? .1 + Math.sin(t * 20) * .05 : S.nibbles ? Math.max(0, Math.sin(t * 9)) * .07 : 0; const toHook = new T.Vector3(f.x - b0.x, 0, f.z - b0.z).normalize();
              const head = Hk.clone().addScaledVector(toHook, .03 - lunge); g.position.copy(head).addScaledVector(toHook.clone(), len * .45); g.rotation.set(0, -Math.atan2(-toHook.z, -toHook.x), hooked ? Math.sin(t * 30) * .45 : 0);
              if (hooked && Math.random() < .5) { const w = rig.localToWorld(head.clone()); bubbles.add(w.x, w.y, w.z, (Math.random() - .5) * .6, .8 + Math.random(), (Math.random() - .5) * .6, 1); }
              return; }
          }
          g.position.set(f.x, y + Math.sin(t * 1.3 + k) * .08, f.z); g.rotation.set(0, -f.h + Math.sin(t * 6 + k) * .12, 0); g.visible = f.fade > .2;
        });
        for (let k = S.fishes.length; k < fishU.length; k++) if (fishU[k]) fishU[k].visible = false;
        alertU.visible = S.st === 'bite'; if (alertU.visible) { alertU.position.set(Hk.x, Hk.y + .35, Hk.z); alertU.scale.setScalar(1 + Math.sin(t * 20) * .12); }
        if (Math.random() < .08) { const w = rig.localToWorld(Hk.clone()); bubbles.add(w.x, w.y + .5, w.z, 0, .5, 0, 2); }
        for (const sh of shafts) sh.material.opacity = .05 + Math.sin(t * .7 + sh.position.x) * .025;
        motes.position.y = Math.sin(t * .3) * .1;
      }
      bubbles.update(dt, 1.5);
      // shadows, float, line
      S.fishes.forEach((f, k) => { const g = shadowFor(k); g.position.x = f.x; g.position.z = f.z; g.rotation.y = -f.h; g.scale.setScalar(f.size); g.children[0].material.opacity = (RARITY[f.kind.rar].stars >= 3 ? .6 : .42) * f.fade; g.visible = anchored && !isUnder; });
      for (let k = S.fishes.length; k < shadows.length; k++) shadows[k].visible = false;
      // first-person rod: gripped low on the right, pointing out to sea; bends with tension, swings to the side you pull
      const fpRod = (mode === 'fish') && !isUnder && cam;
      rod.visible = !!fpRod;
      if (fpRod) {
        const grip = fpAnchor(cam, .6, -1.02, .8);
        const aim = rigV(S.st === 'reel' ? S.side * 1.5 + .6 : 1.1, deckY + 1.55 + (S.st === 'charge' ? S.power * 1.4 : 0) - (S.st === 'reel' ? S.tension * .9 : 0), -2.8);
        rod.position.copy(grip); rod.lookAt(aim); rod.updateMatrixWorld(true);
        arms.R.set(fpAnchor(cam, .95, -1.25, .6), rod.localToWorld(new T.Vector3(0, -.03, .02))); arms.L.set(fpAnchor(cam, .35, -1.25, .6), rod.localToWorld(new T.Vector3(0, -.02, .28)));
      } else if (mode !== 'pose') { arms.L.hide(); arms.R.hide(); }
      if (isUnder) { arms.L.hide(); arms.R.hide(); }
      tip.copy(tipLocal); rod.localToWorld(tip);
      const b = S.bob, out = ['fly', 'wait', 'bite', 'reel'].includes(S.st);
      if (out) { bob.position.set(b.x, b.y - b.dip + .02 + Math.sin(t * 2.4) * .02, b.z); bob.visible = true; }
      else { const lt = rig.worldToLocal(tip.clone()); bob.position.set(lt.x, lt.y - .45, lt.z); bob.visible = mode === 'fish'; }
      const bw = rig.localToWorld(bob.position.clone());
      const lp = lineGeo.attributes.position; lp.setXYZ(0, tip.x, tip.y, tip.z); lp.setXYZ(1, bw.x, bw.y + .15, bw.z); lp.needsUpdate = true;
      line.visible = mode === 'fish'; angler.g.visible = mode === 'choose' || mode === 'pose';
      lineM.color.set(S.st === 'reel' && S.tension > .8 ? 0xff5050 : 0xffffff);
      alertG.visible = S.st === 'bite'; if (alertG.visible) { alertG.position.set(b.x, .9 + Math.sin(t * 14) * .08, b.z); alertG.scale.setScalar(1 + Math.sin(t * 20) * .1); }
      aimRing.visible = S.st === 'charge' && !!S.preview; if (aimRing.visible) { aimRing.position.x = S.preview.x; aimRing.position.z = S.preview.z; aimRing.scale.setScalar(.8 + S.power * .6); }
      pullArrow.visible = S.st === 'reel' && !!S.run; if (pullArrow.visible) { pullArrow.position.set(b.x - S.run * 1.6, 1.2, b.z); pullArrow.rotation.y = S.run > 0 ? Math.PI : 0; pullArrow.scale.setScalar(1 + Math.sin(t * 12) * .12); }
      // fish leaping during the fight
      if (jumpT > 0 && S.st === 'reel') { jumpT -= dt; const k = 1 - jumpT / .8; jump.position.set(b.x, Math.sin(k * Math.PI) * 1.4 - .1, b.z); jump.rotation.set(0, -Math.atan2(S.dir ? S.dir.z : -1, S.dir ? S.dir.x : 0), Math.sin(k * Math.PI * 2) * .6); if (jumpT <= 0) { ring(b.x, b.z, 1); const w = rig.localToWorld(new T.Vector3(b.x, .1, b.z)); for (let q = 0; q < 12; q++) spray.add(w.x, w.y, w.z, (Math.random() - .5) * 2, 2, (Math.random() - .5) * 2, .5); } }
      else jump.position.y = -50;
      // pose: proud angler with the catch
      if (mode === 'pose') { poseT += dt; angler.body.position.y = Math.abs(Math.sin(poseT * 4)) * .05 * Math.max(0, 1 - poseT / 2); hold.rotation.y = Math.sin(t * 7) * .12; hold.rotation.z = Math.sin(t * 9) * .05;
        if (poseT < 2.5 && Math.random() < .3) { const w = hold.getWorldPosition(new T.Vector3()); glitter.add(w.x + (Math.random() - .5) * 1.6, w.y - .1 + Math.random() * .3, w.z + (Math.random() - .5) * .4, 0, .5, 0, .7); } }
      else angler.body.position.y = 0;
      for (const mm of rings) { const u = mm.userData; if (u.t < 1) { u.t += dt * .9; mm.scale.setScalar(.2 + u.t * 1.4 * u.s); mm.material.opacity = (1 - u.t) * .8; } else mm.material.opacity = 0; }
      if (plane) { planeT -= dt; if (planeT <= 0) { planeT = 28; plane.userData.f = 0; } if (plane.userData.f !== undefined) { plane.userData.f += dt / 16; const f = plane.userData.f; plane.position.set(-160 + f * 320, 46, -90 + f * 40); plane.rotation.y = Math.atan2(320, 40); if (f >= 1) { plane.userData.f = undefined; plane.position.z = -400; } } }
      spray.update(dt); wake.update(dt, -4); glitter.update(dt, -1);
      // HUD
      const fishing = mode === 'fish';
      show('fhPow', fishing && S.st === 'charge', S.power);
      show('fhTen', fishing && S.st === 'reel', S.tension); show('fhSta', fishing && S.st === 'reel', S.stamina);
      const run = $('fhRun'); if (run) { run.textContent = isUnder && S.st === 'bite' ? 'Ikan sambar umpan — KETIK SEKARANG! · Tap now!' : isUnder && S.st === 'wait' ? (S.nibbles ? 'Ikan mencuit umpan… tunggu! · Nibbling… wait!' : '') : fishing && S.st === 'reel' && S.run ? (S.run > 0 ? '⬅ Tarik ke kiri! · Pull left!' : 'Tarik ke kanan! · Pull right! ➡') : ''; }
      const cnt = $('fhCount'); if (cnt) cnt.textContent = anchored ? `🐟 ${S.catches.length}/${S.GOAL} · ${S.spot ? S.spot.bm : ''}` : '';
    },
    stop() { reelS && reelS.stop(); engine && engine.stop(); sea.stop(); musicDuck(false); hideFishCard(); scene.fog = SKY_FOG; const h = $('fishHud'); if (h) h.hidden = true; },
  };
}


// ------------------------------------------------------------ 7. BERSIH PANTAI (3D) — Pantai Miami with the Jambatan Angkat behind
function Beach3D(K, api, opts, M = {}) {
  const scene = new T.Scene(); environment(K, scene, { sky: 0x8fd0f0, shadow: 9, fogNear: 40, fogFar: 140 });
  const r = mulberry32(opts.seed || 44);
  const sandTex = K.canvasTex(256, 256); { const x = sandTex.x; x.fillStyle = '#efdcaa'; x.fillRect(0, 0, 256, 256); for (let k = 0; k < 3000; k++) { x.fillStyle = `rgba(${150 + r() * 80},${120 + r() * 70},${70 + r() * 50},${.15 + r() * .25})`; x.fillRect(r() * 256, r() * 256, 1.5, 1.5); } for (let k = 0; k < 14; k++) { x.strokeStyle = 'rgba(190,160,110,.25)'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, k * 19); x.bezierCurveTo(80, k * 19 + 6, 170, k * 19 - 6, 256, k * 19); x.stroke(); } }
  sandTex.t.wrapS = sandTex.t.wrapT = T.RepeatWrapping; sandTex.t.repeat.set(10, 10); sandTex.t.needsUpdate = true;
  K.mesh(new T.BoxGeometry(80, .2, 40), new T.MeshStandardMaterial({ map: sandTex.t, roughness: 1 }), 0, -.1, 8, scene, false);
  const wet = K.mesh(new T.PlaneGeometry(80, 3), new T.MeshStandardMaterial({ color: 0xc9b07c, roughness: .35 }), 0, .005, -11, scene, false); wet.rotation.x = -Math.PI / 2;
  const ocean = makeOcean(T, { w: 260, h: 140, seg: .6, amp: .35, shoreY: -58.5, shoreFade: 16, deep: 0x0b4f78, shallow: 0x35b6cf, sky: 0xcdeefa, repeat: 30 }); ocean.mesh.position.set(0, -.06, -70); scene.add(ocean.mesh);
  const shore = shoreWaves(T, scene, { segs: [[-40, 40]], shoreZ: -11.6, seaward: -1, reach: 5, period: 6, width: 1.6, n: 4 });
  const foam = K.mesh(new T.PlaneGeometry(80, .7), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .8 }), 0, .03, -12, scene, false); foam.rotation.x = -Math.PI / 2;
  // Jambatan Angkat on the horizon: four towers, skybridges, raised bascule leaves
  const br = K.group(40, 0, -72, scene); br.rotation.y = -.5; br.scale.setScalar(1.15); // far along the coast, as in the village const cream = K.mat(0xf1ead9), teal = K.mat(0x2c8c99), gold = K.mat(0xd4a437);
  for (const tx of [-3.2, 3.2]) { for (const tz of [-2.4, 2.4]) { K.box(1.8, 15, 1.8, cream, tx, 7.5, tz, br); const rf = K.mesh(new T.ConeGeometry(1.5, 2.8, 4), teal, tx, 16.4, tz, br); rf.rotation.y = Math.PI / 4; K.box(1.9, .2, 1.9, gold, tx, 10, tz, br); } K.box(1.3, 1.3, 4.8, K.mat(0x4f88a8), tx, 12.8, 0, br); }
  K.box(30, .5, 3.6, K.mat(0xd9d3c4), -19, 2, 0, br); K.box(30, .5, 3.6, K.mat(0xd9d3c4), 19, 2, 0, br);
  for (const [x, d] of [[-2.4, 1], [2.4, -1]]) { const leaf = K.box(2.6, .4, 3.4, K.mat(0xd9d3c4), x + d * 1.1, 2.9, 0, br); leaf.rotation.z = d * .9; }
  // beach dressing
  for (let k = 0; k < 8; k++) palm(K, scene, -18 + k * 5 + (r() - .5) * 2, 12 + r() * 4, 1.1 + r() * .3, r);
  for (const [x, z, col] of [[-9, -3, 0xe74c3c], [9.5, -4, 0xf1c40f], [-12, 4, 0x2e86de]]) { K.cyl(.05, .05, 2.2, K.mat(0xdddddd), x, 1.1, z, scene, 6); K.mesh(new T.ConeGeometry(1.5, .6, 10), K.mat(col), x, 2.25, z, scene); }
  const kite = K.group(-8, 12, -20, scene); { const sh = new T.Shape(); sh.moveTo(0, 1.4); sh.quadraticCurveTo(2, .8, 1.8, -.1); sh.quadraticCurveTo(.7, .2, .3, -.4); sh.lineTo(.7, -1.4); sh.quadraticCurveTo(0, -1, -.7, -1.4); sh.lineTo(-.3, -.4); sh.quadraticCurveTo(-.7, .2, -1.8, -.1); sh.quadraticCurveTo(-2, .8, 0, 1.4); K.mesh(new T.ShapeGeometry(sh), K.mat(0xe74c3c, { side: T.DoubleSide }), 0, 0, 0, kite, false); }
  // bins
  const binG = {}, binM = {};
  for (const [id, x] of [['kitar', -2.2], ['am', 2.2]]) {
    const g = K.group(x, 0, 2.3, scene), hex = parseInt(BINS[id].col.slice(1), 16); binM[id] = K.mat(hex, { roughness: .55, emissive: hex, emissiveIntensity: 0 });
    K.mesh(new T.CylinderGeometry(.62, .52, 1.15, 24, 1, true), binM[id], 0, .58, 0, g).material.side = T.DoubleSide;
    K.cyl(.52, .52, .04, K.mat(0x222222), 0, .05, 0, g, 24); const rim = K.mesh(new T.TorusGeometry(.62, .05, 8, 28), K.mat(0x333333), 0, 1.15, 0, g); rim.rotation.x = Math.PI / 2;
    const lab = K.canvasTex(256, 96); lab.x.fillStyle = '#ffffff'; lab.x.fillRect(0, 0, 256, 96); lab.x.fillStyle = BINS[id].col; lab.x.font = '900 34px system-ui'; lab.x.textAlign = 'center'; lab.x.fillText(BINS[id].bm, 128, 46); lab.x.font = '700 22px system-ui'; lab.x.fillText((id === 'kitar' ? '♻ ' : '') + BINS[id].en, 128, 80); lab.t.needsUpdate = true;
    const lm = K.mesh(new T.CylinderGeometry(.6, .57, .38, 24, 1, true, -.9, 1.8), new T.MeshBasicMaterial({ map: lab.t }), 0, .7, 0, g, false); lm.scale.set(1.04, 1, 1.04);
    binG[id] = g;
  }
  // rubbish meshes
  const make = (kind) => { const g = new T.Group(); scene.add(g); let m;
    if (kind === 'botol') { m = K.cyl(.09, .09, .42, K.mat(0x9fd8f0, { transparent: true, opacity: .7, roughness: .15 }), 0, 0, 0, g, 12); K.cyl(.045, .045, .08, K.mat(0x2e86de), 0, .25, 0, m, 8); K.cyl(.092, .092, .12, K.mat(0xe74c3c), 0, .02, 0, m, 12); }
    else if (kind === 'tin') { m = K.cyl(.075, .075, .24, K.mat(0xc0392b, { metalness: .6, roughness: .35 }), 0, 0, 0, g, 14); K.cyl(.072, .072, .02, K.mat(0xcccccc, { metalness: .8, roughness: .3 }), 0, .125, 0, m, 14); }
    else if (kind === 'kaca') { m = K.cyl(.1, .1, .36, K.mat(0x2e8b57, { transparent: true, opacity: .75, roughness: .1, metalness: .2 }), 0, 0, 0, g, 12); K.cyl(.035, .06, .16, K.mat(0x2e8b57, { transparent: true, opacity: .75, roughness: .1 }), 0, .26, 0, m, 10); }
    else if (kind === 'beg') { m = K.mesh(new T.IcosahedronGeometry(.22, 1), K.mat(0xf4f4f4, { transparent: true, opacity: .85, roughness: .7 }), 0, 0, 0, g); const pa = m.geometry.attributes.position; if (pa) for (let i = 0; i < pa.count; i++) pa.setXYZ(i, pa.getX(i) * (1 + Math.sin(i * 7.3) * .25), pa.getY(i) * .35, pa.getZ(i) * (1 + Math.cos(i * 3.1) * .25)); m.geometry.computeVertexNormals(); }
    else if (kind === 'straw') { m = K.cyl(.018, .018, .38, K.mat(0xff5aa5), 0, 0, 0, g, 6); }
    else if (kind === 'poli') { m = K.box(.36, .12, .26, K.mat(0xfafafa, { roughness: 1 }), 0, 0, 0, g); K.box(.36, .02, .26, K.mat(0xf0f0f0), 0, .09, -.1, m).rotation.x = -.5; }
    else { m = K.box(.24, .025, .12, K.mat([0xf39c12, 0x9b59b6, 0x1abc9c][Math.floor(Math.random() * 3)], { roughness: .4, metalness: .3 }), 0, 0, 0, g); }
    if (kind === 'botol' || kind === 'tin' || kind === 'kaca' || kind === 'straw') m.rotation.z = Math.PI / 2;
    g.userData.lie = kind === 'beg' ? .07 : kind === 'poli' ? .06 : kind === 'balut' ? .015 : kind === 'straw' ? .02 : kind === 'tin' ? .075 : kind === 'kaca' ? .1 : .09; return g; };
  const into = [];
  const core = beachCore(api, opts, { area: [-4.4, -2.9, 4.4, .9], bins: { kitar: [-2.2, 2.3, .85], am: [2.2, 2.3, .85] }, grab: .6 }, {
    into(o, b) { into.push({ o, t: 0, from: o.mesh.position.clone(), to: binG[b].position.clone().setY(1.6) }); binM[b].emissiveIntensity = .5; setTimeout(() => { binM[b].emissiveIntensity = 0; }, 260); },
  });
  for (const o of core.items) { o.mesh = make(o.kind); o.mesh.rotation.y = o.rot; }
  // crabs scuttling on the sand
  const crabs = [0, 1, 2, 3].map(k => { const g = K.group(-5 + k * 3.3, 0, -4 + (k % 2) * 3.5, scene), m = K.mat(0xe4572e, { roughness: .6 }); if (putModel(M, 'animals/Crab', g, 0, 0, { h: .28 })) return { g, vx: 0, vz: 0, t: 0 };
    const b = K.ball(.13, m, 0, .08, 0, g); b.scale.set(1.3, .5, 1); for (const s of [-1, 1]) { K.ball(.05, m, s * .2, .1, -.12, g); for (let l = 0; l < 3; l++) { const leg = K.box(.14, .02, .02, m, s * .17, .05, -.06 + l * .07, g); leg.rotation.z = s * -.5; } K.ball(.02, K.mat(0x111111), s * .05, .16, -.1, g); }
    return { g, vx: 0, vz: 0, t: 0 }; });
  const view = { pos: new T.Vector3(0, 3.3, 5.6), look: new T.Vector3(0, 0, -.6), halfW: 5.1, halfH: 3.1 };
  const ring = K.mesh(new T.RingGeometry(.42, .5, 32), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .7, depthWrite: false }), 0, .02, 0, scene, false); ring.rotation.x = -Math.PI / 2; ring.visible = false;
  const arms = fpArms(K, scene), plane = new T.Plane(new T.Vector3(0, 1, 0), 0), hit = new T.Vector3(); let t = 0;
  return {
    scene, view,
    ray(rc) { if (!rc.ray.intersectPlane(plane, hit)) return { ok: false }; return { x: clamp(hit.x, -6, 6), y: clamp(hit.z, -4, 3.4) }; },
    down(p) { core.down(p); }, move(p) { core.move(p); }, up(p) { core.up(p); },
    dbg: () => ({ items: core.items.map(o => ({ x: o.x, y: o.y, kind: o.kind, st: o.st, bin: TRASH[o.kind].bin })), bins: core.bins, ...core.stats() }),
    update(dt, p, cam) {
      t += dt; core.update(dt);
      ocean.update(t, scene.background); shore(t);
      foam.position.z = -12 + Math.sin(t * .8) * .6; foam.material.opacity = .5 + Math.sin(t * .8) * .3;
      kite.position.y = 12 + Math.sin(t * .9) * .6; kite.rotation.z = Math.sin(t * 1.3) * .25;
      for (const o of core.items) { if (o.st === 'bin') continue; const m = o.mesh;
        if (o.st === 'held') m.position.lerp(new T.Vector3(o.x, .55, o.y), Math.min(1, dt * 18));
        else { const sh = o.fly ? Math.sin(o.fly * 10) * .15 * o.fly : 0; m.position.set(o.x + sh, m.userData.lie + (o.fly ? Math.sin(o.fly * Math.PI) * .6 : 0), o.y); } }
      for (let k = into.length - 1; k >= 0; k--) { const it = into[k]; it.t += dt * 2.6; const f = Math.min(1, it.t); it.o.mesh.position.lerpVectors(it.from, it.to, f); it.o.mesh.position.y += Math.sin(f * Math.PI) * .7 - (f >= 1 ? 0 : 0); it.o.mesh.rotation.x += dt * 6; if (f >= 1) { it.o.mesh.visible = false; into.splice(k, 1); } }
      for (const c of crabs) { c.t -= dt; if (c.t <= 0) { c.vx = (Math.random() - .5) * 1.6; c.vz = (Math.random() - .5) * .4; c.t = .6 + Math.random() * 2.2; if (Math.random() < .35) { c.vx = 0; c.vz = 0; } } c.g.position.x = clamp(c.g.position.x + c.vx * dt, -7, 7); c.g.position.z = clamp(c.g.position.z + c.vz * dt, -6, 1.2); c.g.position.y = c.vx ? Math.abs(Math.sin(t * 22)) * .015 : 0; }
      if (cam && p.on) { const h = core.held, tgt = h ? h.mesh.position.clone().add(new T.Vector3(0, .12, 0)) : new T.Vector3(p.x, p.down ? .1 : .35, p.y); arms.R.set(fpAnchor(cam, .55), reachTo(cam, tgt, 1.3)); arms.L.hide(); ring.visible = true; ring.position.set(p.x, .02, p.y); ring.scale.setScalar(p.down ? .8 : 1); } else { arms.R.hide(); arms.L.hide(); ring.visible = false; }
    },
  };
}

// ============================================================ ACTIVITIES (3D, first person)
function makeAthlete(K, look) {
  const g = new T.Group(), body = new T.Group(); g.add(body); body.scale.setScalar(.92);
  const m = (c) => K.mat(c);
  const legs = []; for (const lx of [-.13, .13]) { const p = K.group(lx, .82, 0, body); K.mesh(new T.CapsuleGeometry(.095, .5, 3, 8), m(look.skin), 0, -.42, 0, p); K.mesh(new T.CapsuleGeometry(.105, .16, 3, 8), m(look.pants), 0, -.08, 0, p); K.box(.16, .08, .26, m(look.shoe || 0xffffff), 0, -.78, .05, p); legs.push(p); }
  K.mesh(new T.CapsuleGeometry(.24, .42, 4, 12), m(look.shirt), 0, 1.16, 0, body);
  const arms = []; for (const ax of [-.33, .33]) { const p = K.group(ax, 1.43, 0, body); K.mesh(new T.CapsuleGeometry(.075, .38, 3, 8), m(look.skin), 0, -.24, 0, p); K.ball(.085, m(look.glove || look.skin), 0, -.5, 0, p); arms.push(p); }
  K.ball(.26, m(look.skin), 0, 1.8, 0, body);
  for (const ex of [-.09, .09]) K.ball(.035, m(0x1a1a1a), ex, 1.83, .235, body);
  if (look.hair) K.mesh(new T.SphereGeometry(.275, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), m(look.hair), 0, 1.84, -.02, body);
  if (look.num) { const t = K.canvasTex(128, 128); t.x.fillStyle = '#fff'; t.x.font = '900 90px system-ui'; t.x.textAlign = 'center'; t.x.fillText(look.num, 64, 100); t.t.needsUpdate = true; K.mesh(new T.PlaneGeometry(.3, .3), new T.MeshBasicMaterial({ map: t.t, transparent: true }), 0, 1.22, .25, body, false); }
  return { g, body, arms, legs };
}
function textPlane(K, text, w, h, { bg = '#1f6f9c', fg = '#fff', font = 900, px = 64 } = {}) {
  const c = K.canvasTex(1024, Math.round(1024 * h / w)); c.x.fillStyle = bg; c.x.fillRect(0, 0, c.c.width, c.c.height); c.x.fillStyle = fg; c.x.font = `${font} ${px}px system-ui`; c.x.textAlign = 'center'; c.x.textBaseline = 'middle'; c.x.fillText(text, 512, c.c.height / 2 + 4); c.t.needsUpdate = true;
  return new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: c.t, transparent: bg === 'transparent' }));
}
function bridgeFar(K, parent, x, z, ry = 0, s = 1, night) {
  const br = K.group(x, 0, z, parent); br.rotation.y = ry; br.scale.setScalar(s); const cream = K.mat(0xf1ead9), teal = K.mat(0x2c8c99), gold = K.mat(0xd4a437);
  const win = new T.MeshStandardMaterial({ color: 0x4f88a8, emissive: 0xffd88a, emissiveIntensity: 0, roughness: .4 });
  for (const tx of [-3.2, 3.2]) { for (const tz of [-2.4, 2.4]) { K.box(1.8, 15, 1.8, cream, tx, 7.5, tz, br); for (let k = 0; k < 7; k++) K.box(1.84, .7, 1.4, win, tx, 2 + k * 1.8, tz, br); const rf = K.mesh(new T.ConeGeometry(1.5, 2.8, 4), teal, tx, 16.4, tz, br); rf.rotation.y = Math.PI / 4; K.box(1.9, .2, 1.9, gold, tx, 10, tz, br); } K.box(1.3, 1.3, 4.8, win, tx, 12.8, 0, br); }
  K.box(30, .5, 3.6, K.mat(0xd9d3c4), -19, 2, 0, br); K.box(30, .5, 3.6, K.mat(0xd9d3c4), 19, 2, 0, br);
  const leaves = [[-2.4, 1], [2.4, -1]].map(([lx, d]) => { const p = K.group(lx + d * -1.2 + d * 1.2 - d * 0, 2, 0, br); p.position.x = d > 0 ? -3.2 + .9 : 3.2 - .9; const l = K.box(2.6, .4, 3.4, K.mat(0xd9d3c4), d * 1.3, 0, 0, p); return { p, d }; });
  return { br, win, leaves };
}

// ---------------------------------------------------------- BOLA TAMPAR PANTAI
function Volley3D(K, api, opts, M = {}) {
  const scene = new T.Scene(); environment(K, scene, { sky: 0x8fd0f0, shadow: 12, fogNear: 50, fogFar: 160 });
  const r = mulberry32(opts.seed || 51);
  const sand = K.canvasTex(256, 256); { const x = sand.x; x.fillStyle = '#efdcaa'; x.fillRect(0, 0, 256, 256); for (let k = 0; k < 3000; k++) { x.fillStyle = `rgba(${150 + r() * 80},${120 + r() * 70},${70 + r() * 50},${.2 + r() * .2})`; x.fillRect(r() * 256, r() * 256, 1.5, 1.5); } } sand.t.wrapS = sand.t.wrapT = T.RepeatWrapping; sand.t.repeat.set(12, 12); sand.t.needsUpdate = true;
  K.mesh(new T.BoxGeometry(80, .2, 60), new T.MeshStandardMaterial({ map: sand.t, roughness: 1 }), 0, -.1, 4, scene, false);
  const ocean = makeOcean(T, { w: 300, h: 160, seg: .5, amp: .35, shoreY: -54, shoreFade: 14, deep: 0x0b4f78, shallow: 0x35b6cf, sky: 0xcdeefa, repeat: 30 }); ocean.mesh.position.set(0, -.06, -80); scene.add(ocean.mesh);
  const shore = shoreWaves(T, scene, { segs: [[-40, 40]], shoreZ: -25.8, seaward: -1, reach: 5, period: 6, width: 1.6, n: 4 });
  const tape = K.mat(0x1f6fd1); const L = (w, d, x, z) => K.box(w, .02, d, tape, x, .005, z, scene, false);
  L(8, .08, 0, 8); L(8, .08, 0, -8); L(.08, 16, -4, 0); L(.08, 16, 4, 0);
  for (const x of [-4.6, 4.6]) K.cyl(.06, .06, 2.6, K.mat(0xdddddd), x, 1.3, 0, scene, 10);
  const netT = K.canvasTex(512, 64); netT.x.fillStyle = 'rgba(0,0,0,0)'; netT.x.clearRect(0, 0, 512, 64); netT.x.strokeStyle = '#222'; netT.x.lineWidth = 2; for (let k = 0; k <= 512; k += 10) { netT.x.beginPath(); netT.x.moveTo(k, 0); netT.x.lineTo(k, 64); netT.x.stroke(); } for (let k = 0; k <= 64; k += 10) { netT.x.beginPath(); netT.x.moveTo(0, k); netT.x.lineTo(512, k); netT.x.stroke(); } netT.x.fillStyle = '#1f6fd1'; netT.x.fillRect(0, 0, 512, 8); netT.t.needsUpdate = true;
  K.mesh(new T.PlaneGeometry(9.2, .9), new T.MeshBasicMaterial({ map: netT.t, transparent: true, side: T.DoubleSide, alphaTest: .2 }), 0, 1.98, 0, scene, false);
  const bf = bridgeFar(K, scene, 50, -84, -.6, 1.3); // farther: the town bridge now stands far from the beach
  for (let k = 0; k < 9; k++) palm(K, scene, -22 + k * 5.5 + (r() - .5) * 2, 18 + r() * 5, 1.1 + r() * .3, r);
  for (const [x, z] of [[-9, -6], [10, 4]]) { K.cyl(.05, .05, 2.2, K.mat(0xdddddd), x, 1.1, z, scene, 6); K.mesh(new T.ConeGeometry(1.5, .6, 10), K.mat(x < 0 ? 0xe74c3c : 0xf1c40f), x, 2.25, z, scene); }
  const opp = makeAthlete(K, { shirt: 0xc0392b, pants: 0x1c1c1c, skin: 0x8d5a34, hair: 0x111111, num: '7' }); opp.g.rotation.y = 0; scene.add(opp.g);
  const mate = makeAthlete(K, { shirt: 0xc0392b, pants: 0x1c1c1c, skin: 0xc68a5a, hair: 0x2b1b10, num: '3' }); mate.g.position.set(2.5, 0, -5.5); scene.add(mate.g);
  const ballT = K.canvasTex(256, 128); { const x = ballT.x; for (let k = 0; k < 6; k++) { x.fillStyle = ['#ffd452', '#2e86de', '#ffffff'][k % 3]; x.fillRect(k * 43, 0, 43, 128); } } ballT.t.needsUpdate = true;
  const ball = new T.Group(); ball.position.y = -5; scene.add(ball); { const bm = putModel(M, 'sport/volleyball', ball, 0, -.14, { h: .28 }); if (!bm) K.mesh(new T.SphereGeometry(.14, 24, 16), new T.MeshStandardMaterial({ map: ballT.t, roughness: .5 }), 0, 0, 0, ball); }
  for (let k = 0; k < 2; k++) { const c = putModel(M, 'animals/Crab', scene, -6 + k * 13, 9 + k, { h: .25, ry: k }); } putModel(M, 'park/ice_cream_cart', scene, -11, 11, { h: 1.6, ry: .6 });
  const shadow = K.mesh(new T.CircleGeometry(.2, 20), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .3, depthWrite: false }), 0, .01, 0, scene, false); shadow.rotation.x = -Math.PI / 2;
  const ringM = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .7, depthWrite: false });
  const ring = K.mesh(new T.RingGeometry(.95, 1.05, 40), ringM, 0, .02, 0, scene, false); ring.rotation.x = -Math.PI / 2;
  const puff = new Sparks(scene, 160, 0xf3e2ae, .1);
  const core = volleyCore(api, opts, { miss(p) { if (p) for (let k = 0; k < 30; k++) puff.add(p.x, .05, p.z, (Math.random() - .5) * 3, 1 + Math.random() * 2, (Math.random() - .5) * 3, .7); } });
  const view = { pos: new T.Vector3(0, 2.6, 8.5), look: new T.Vector3(0, .9, -2), halfW: 5.4, halfH: 3.3, speed: 6 };
  const plane = new T.Plane(new T.Vector3(0, 1, 0), 0), hp = new T.Vector3(); let t = 0;
  return {
    scene, view,
    ray(rc) { if (!rc.ray.intersectPlane(plane, hp)) return { ok: false }; return { x: hp.x, y: hp.z }; },
    down(p) { core.down(p); }, move(p) { core.move(p, p.down); }, up() { core.up(); },
    dbg: () => ({ ...core.S, land: core.S.ball && core.S.ball.l, ball: core.pos(), reach: core.reach() }),
    update(dt) {
      t += dt; core.update(dt); ocean.update(t, scene.background); shore(t); puff.update(dt, -6);
      const S = core.S, m = S.me, b = core.pos();
      view.pos.set(m.x * .85, 2.5, m.z + 2.6); view.look.set(m.x * .5 + (b ? b.x * .3 : 0), .9, m.z - 6);
      ring.position.set(m.x, .02, m.z); ringM.color.setHex(core.reach() ? 0x2ecc71 : 0xffffff); ring.scale.setScalar(core.reach() ? 1 + Math.sin(t * 14) * .05 : 1);
      opp.g.position.set(S.opp.x, 0, S.opp.z); opp.g.rotation.y = 0; const swing = S.side === 1 ? 2.8 : .6; opp.arms[0].rotation.x = -swing; opp.arms[1].rotation.x = -swing;
      mate.g.position.x = 2.5 + Math.sin(t * .8) * .5;
      if (b) { ball.position.set(b.x, Math.max(.14, b.y), b.z); ball.rotation.x += dt * 8; shadow.position.set(b.x, .01, b.z); shadow.scale.setScalar(1 + b.y * .15); shadow.visible = true; } else { ball.position.y = -5; shadow.visible = false; }
    },
    stop() { core.stop(); },
  };
}

// ---------------------------------------------------------- BOOTH FOTO JAMBATAN ANGKAT
function Photo3D(K, api, opts, M = {}) {
  const scene = new T.Scene(); const sun = environment(K, scene, { sky: 0x8fd0f0, shadow: 10, fogNear: 60, fogFar: 200 });
  const hemi = scene.children.find(o => o.isHemisphereLight);
  const r = mulberry32(opts.seed || 61);
  K.mesh(new T.BoxGeometry(60, .2, 30), new T.MeshStandardMaterial({ color: 0xefdcaa, roughness: 1 }), 0, -.1, 6, scene, false);
  const ocean = makeOcean(T, { w: 300, h: 200, seg: .45, amp: .3, shoreY: -95, shoreFade: 14, deep: 0x0b4f78, shallow: 0x35b6cf, repeat: 30 }); ocean.mesh.position.set(0, -.06, -104); scene.add(ocean.mesh);
  const shore = shoreWaves(T, scene, { segs: [[-30, 30]], shoreZ: -8.8, seaward: -1, reach: 4, period: 6.5, width: 1.4 });
  const bf = bridgeFar(K, scene, 9, -52, -.15, 1.5); // farther and larger: same framing, more distance
  const city = []; for (let k = 0; k < 8; k++) { const h = 6 + r() * 10; city.push(K.box(4, h, 4, new T.MeshStandardMaterial({ color: 0xd8d4cc, emissive: 0xffd88a, emissiveIntensity: 0 }), 26 + k * 5, h / 2, -70 - r() * 10, scene, false)); }
  for (let k = 0; k < 5; k++) palm(K, scene, -16 + k * 3 + r(), -4 - r() * 3, 1.1, r);
  // the booth arch around the player (seen as a frame at the edge of the photo)
  const sign = textPlane(K, 'PANTAI MIAMI · KUALA TERENGGANU', 6, .7, { bg: '#d35400' }); sign.position.set(0, 4.3, 3); scene.add(sign);
  // the player (TYRANZ hero) — one mesh per pose, arms raised to different heights
  const ARM = [.7, 1.5, 1.05, .85];
  const heroes = ARM.map((a) => { const h = makeHero(K, M, 1.65, a) || (() => { const p = makeAthlete(K, { shirt: 0x2e86de, pants: 0x2c3e50, skin: 0xc68a5a, hair: 0x111111 }); return p.g; })(); h.position.set(-1.7, 0, 1.6); h.rotation.y = .35; h.visible = false; scene.add(h); return h; });
  const emoji = K.canvasTex(128, 128); const em = new T.Sprite(new T.SpriteMaterial({ map: emoji.t, transparent: true })); em.scale.set(.6, .6, .6); em.position.set(-1.1, 1.9, 1.8); scene.add(em);
  const setPose = (k) => { heroes.forEach((h, i) => { h.visible = i === k; }); emoji.x.clearRect(0, 0, 128, 128); emoji.x.font = '96px system-ui'; emoji.x.textAlign = 'center'; emoji.x.textBaseline = 'middle'; emoji.x.fillText(POSES[k][0], 64, 70); emoji.t.needsUpdate = true; };
  setPose(0);
  const LOOK = [[0x8fd0f0, 0xffffff, 2.4, 1.9, 0, 0xcdeefa], [0xf3a46b, 0xffb070, 1.8, 1.2, .35, 0xf7c99a], [0x0c1733, 0x8fa8ff, .35, .5, 1, 0x2b3d66]];
  const setTime = (k) => { const [sky, sc, si, hi, glow, oc] = LOOK[k]; scene.background = new T.Color(sky); scene.fog.color.setHex(sky); sun.color.setHex(sc); sun.intensity = si; if (hemi) hemi.intensity = hi; bf.win.emissiveIntensity = glow * 1.4; for (const c of city) c.material.emissiveIntensity = glow * .5; ocean.uniforms.uSky.value.setHex(oc); };
  let camRef = null, flash = 0;
  const core = photoCore(api, opts, {
    pose: setPose, time: setTime,
    score() { if (!camRef) return .7; const p = new T.Vector3(6, 9, -42).project(camRef), h = heroes[0].position.clone().setY(1.2).project(camRef);
      const d = Math.hypot((p.x - .35) / .45, (p.y - .18) / .45); const heroIn = Math.abs(h.x) < .95 && Math.abs(h.y) < .95; return clamp(1 - d * .55, 0, 1) * (heroIn ? 1 : .6); },
    capture(cb) { flash = 1; api.capture((url) => composePhoto(url, cb)); },
    reset() {},
  });
  function composePhoto(url, cb) {
    if (!url) return cb('');
    const img = new Image(); img.onload = () => { const W = 1200, H = Math.round(W * img.height / img.width), c = document.createElement('canvas'); c.width = W + 60; c.height = H + 150; const x = c.getContext('2d');
      x.fillStyle = '#fffaf0'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 30, 30, W, H); x.fillStyle = '#d35400'; x.font = '900 40px system-ui'; x.textAlign = 'center'; x.fillText('JAMBATAN ANGKAT · PANTAI MIAMI', c.width / 2, H + 85); x.fillStyle = '#555'; x.font = '600 24px system-ui'; x.fillText(`MyKampung · ${new Date().toLocaleDateString('ms-MY')}`, c.width / 2, H + 125); cb(c.toDataURL('image/jpeg', .9)); };
    img.onerror = () => cb(url); img.src = url;
  }
  const view = { pos: new T.Vector3(0, 1.6, 7), look: new T.Vector3(0, 3.5, -30), halfW: 26, halfH: 15, speed: 8 };
  const guide = document.createElement('div'); guide.className = 'photoGuide'; $('game').append(guide);
  const flashEl = document.createElement('div'); flashEl.className = 'photoFlash'; $('game').append(flashEl);
  let t = 0;
  return {
    scene, view,
    ray() { return { x: 0, y: 0 }; },
    down(p) { core.down(p); }, move(p) { core.move(p); }, up() { core.up(); },
    dbg: () => ({ ...core.S, score: camRef ? core.S && null : null }),
    update(dt, p, cam) {
      camRef = cam; t += dt; core.update(dt); ocean.update(t, null); shore(t);
      const S = core.S, z = S.zoom; view.pos.set(S.pan.x * .6, 1.6, 7); view.look.set(S.pan.x * 3, 3.5 + S.pan.y * 3, -30); view.halfW = 26 / z; view.halfH = 15 / z;
      guide.hidden = S.st !== 'frame'; flash = Math.max(0, flash - dt * 2.5); flashEl.style.opacity = flash;
      const leafK = (Math.sin(t * .35) + 1) / 2; for (const l of bf.leaves) l.p.rotation.z = l.d * leafK * 1.1;
      em.position.y = 1.9 + Math.sin(t * 2) * .05;
    },
    stop() { core.stop(); guide.remove(); flashEl.remove(); },
  };
}

// ---------------------------------------------------------- LUMBA DRAG 402 m
function Drag3D(K, api, opts, M = {}) {
  const scene = new T.Scene(); environment(K, scene, { sky: 0x9fd6ee, shadow: 20, fogNear: 120, fogFar: 420 });
  const asphT = K.canvasTex(256, 256); { const x = asphT.x; x.fillStyle = '#3b3e44'; x.fillRect(0, 0, 256, 256); for (let k = 0; k < 4000; k++) { const v = 40 + Math.random() * 50; x.fillStyle = `rgb(${v},${v},${v + 4})`; x.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5); } x.fillStyle = 'rgba(20,20,20,.5)'; x.fillRect(40, 0, 50, 256); x.fillRect(166, 0, 50, 256); } asphT.t.wrapS = asphT.t.wrapT = T.RepeatWrapping; asphT.t.repeat.set(1, 60); asphT.t.needsUpdate = true;
  K.mesh(new T.BoxGeometry(12, .1, 560), new T.MeshStandardMaterial({ map: asphT.t, roughness: .85 }), 0, -.05, -230, scene, false);
  K.mesh(new T.BoxGeometry(200, .1, 600), K.mat(0x6a9a48), 0, -.12, -230, scene, false);
  const white = K.mat(0xffffff); K.box(.15, .02, 520, white, 0, .01, -230, scene, false); for (const x of [-5.7, 5.7]) K.box(.15, .02, 520, white, x, .01, -230, scene, false);
  for (const x of [-6.4, 6.4]) for (let z = 10; z > -470; z -= 4) K.box(.4, .8, 3.9, K.mat((Math.round(z / 4) % 2) ? 0xd9d9d9 : 0xc0392b), x, .4, z, scene);
  K.box(12, .02, .6, white, 0, .012, 0, scene, false); K.box(12, .02, .8, K.mat(0x111111), 0, .012, -402, scene, false);
  for (let k = 0; k < 12; k++) K.box(.5, .02, .5, K.mat(k % 2 ? 0xffffff : 0x111111), -5.5 + k, .015, -402, scene, false);
  const gantry = (z, text, col) => { K.box(.4, 6, .4, K.mat(0x444444), -6.8, 3, z, scene); K.box(.4, 6, .4, K.mat(0x444444), 6.8, 3, z, scene); const s = textPlane(K, text, 13.6, 1.4, { bg: col }); s.position.set(0, 6, z); scene.add(s); s.material.side = T.DoubleSide; };
  gantry(-2, 'MULA · START', '#27ae60'); gantry(-404, 'TAMAT · FINISH  402m', '#c0392b');
  for (let m = 100; m < 402; m += 100) { const b = textPlane(K, `${m}m`, 2, 1, { bg: '#f1c40f', fg: '#111' }); b.position.set(-8, 1.2, -m); b.rotation.y = Math.PI / 2 - .3; scene.add(b); K.box(.1, 1, .1, K.mat(0x555555), -8, .5, -m, scene); }
  // grandstand and crowd near the start
  for (let r2 = 0; r2 < 5; r2++) K.box(30, .5, 1, K.mat(0x9aa4ad), 12 + r2 * .9, .3 + r2 * .55, -8, scene).rotation.y = Math.PI / 2;
  const crowdM = [0xe74c3c, 0xf1c40f, 0x3498db, 0xecf0f1, 0x27ae60].map(c => K.mat(c));
  for (let k = 0; k < 90; k++) K.box(.4, .7, .4, crowdM[k % 5], 12 + (k % 5) * .9, .9 + (k % 5) * .55, -22 + Math.floor(k / 5) * 1.6, scene);
  for (let z = -40; z > -460; z -= 40) { K.cyl(.12, .14, 7, K.mat(0x777777), 8, 3.5, z, scene, 8); K.box(1.4, .3, .6, K.mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: .4 }), 7.4, 7, z, scene); }
  for (let k = 0; k < 3; k++) putModel(M, 'race/Stands', scene, -11, -30 - k * 12, { len: 10, ry: Math.PI / 2 }); for (let z = -60; z > -400; z -= 60) putModel(M, 'race/Flag', scene, 7.5, z, { h: 3 }); putModel(M, 'race/Banner', scene, -7, -1, { h: 2.5 });
  // christmas tree start lights
  const treeG = K.group(0, 0, -1.2, scene); K.box(.3, 2.4, .3, K.mat(0x222222), 0, 1.2, 0, treeG);
  const lampM = [0, 1, 2, 3].map(k => new T.MeshStandardMaterial({ color: k < 3 ? 0x553b00 : 0x0b3d14, emissive: k < 3 ? 0xffb300 : 0x2ecc71, emissiveIntensity: 0 }));
  const lamps = lampM.map((m, k) => { const l = K.ball(.13, m, 0, 2.6 + (3 - k) * .32, .15, treeG); return l; }); K.box(.5, 1.5, .2, K.mat(0x222222), 0, 3.05, 0, treeG);
  // rival car
  const rival = putModel(M, 'hatch', scene, 2.8, 0, { len: 4.2, ry: Math.PI, tint: 0xc0392b }) || putModel(M, 'sedan', scene, 2.8, 0, { len: 4.4, ry: Math.PI }) || K.box(1.8, 1.3, 4.2, K.mat(0xc0392b), 2.8, .65, 0, scene);
  // cockpit (follows the camera): hood, dashboard with a live tach, steering wheel
  const cockpit = K.group(0, 0, 0, scene);
  K.box(1.9, .45, 2.6, K.mat(0xf1c40f, { metalness: .4, roughness: .3 }), .15, .5, -2.4, cockpit);
  K.box(.08, .03, 2.4, K.mat(0x111111), .15, .74, -2.4, cockpit);
  K.box(2.1, .22, .45, K.mat(0x1c1c1c), .15, .78, -.95, cockpit);
  const tach = K.canvasTex(256, 256);
  const wheel = K.mesh(new T.TorusGeometry(.17, .025, 8, 24), K.mat(0x111111), 0, .82, -.62, cockpit, false); wheel.rotation.x = -.5;
  function drawTach(rpm, gear, kmh) { const x = tach.x; x.clearRect(0, 0, 256, 256); x.fillStyle = '#0d0d0d'; x.beginPath(); x.arc(128, 128, 124, 0, 7); x.fill();
    const A = (f) => Math.PI * (.75 + f * 1.5); x.lineWidth = 16; x.strokeStyle = '#2ecc71'; x.beginPath(); x.arc(128, 128, 100, A(.84), A(.97)); x.stroke(); x.strokeStyle = '#e74c3c'; x.beginPath(); x.arc(128, 128, 100, A(.97), A(1.02)); x.stroke();
    x.strokeStyle = '#fff'; x.lineWidth = 3; for (let k = 0; k <= 10; k++) { const a = A(k / 10); x.beginPath(); x.moveTo(128 + Math.cos(a) * 88, 128 + Math.sin(a) * 88); x.lineTo(128 + Math.cos(a) * 110, 128 + Math.sin(a) * 110); x.stroke(); }
    const a = A(clamp(rpm, 0, 1.02)); x.strokeStyle = '#ff5533'; x.lineWidth = 6; x.beginPath(); x.moveTo(128, 128); x.lineTo(128 + Math.cos(a) * 100, 128 + Math.sin(a) * 100); x.stroke();
    x.fillStyle = '#ffd452'; x.font = '900 64px system-ui'; x.textAlign = 'center'; x.fillText(gear, 128, 200); x.fillStyle = '#fff'; x.font = '700 26px system-ui'; x.fillText(`${kmh} km/j`, 128, 100); tach.t.needsUpdate = true; }
  const smoke = new Sparks(scene, 300, 0xdddddd, .5);
  let engine = null, t = 0, shake = 0;
  const core = dragCore(api, opts, { launch() { shake = .4; for (let k = 0; k < 60; k++) smoke.add(-1.4 + Math.random() * 3, .3, 1.5, (Math.random() - .5) * 3, Math.random() * 2, 2 + Math.random() * 3, 1.4); }, shift(q) { shake = q === 'perfect' ? .15 : .3; } });
  try { engine = loopSound('engine'); } catch { engine = null; }
  const view = { pos: new T.Vector3(-1.25, 1.25, 0), look: new T.Vector3(-1.25, 1.05, -30), halfW: 22, halfH: 12.5, snap: true };
  return {
    scene, view,
    ray() { return { x: 0, y: 0 }; },
    down() { core.down(); }, move() {}, up() {},
    dbg: () => ({ st: core.S.st, rpm: core.S.me.rpm, g: core.S.me.g, x: core.S.me.x, lights: core.S.lights }),
    update(dt) {
      t += dt; core.update(dt); const S = core.S, me = S.me, ai = S.ai;
      shake = Math.max(0, shake - dt); const sh = (Math.random() - .5) * (shake * .06 + me.v * .0006);
      const z = -me.x; cockpit.position.set(-1.4, 0, z); view.pos.set(-1.25 + sh, 1.25 + sh, z); view.look.set(-1.25, 1.05, z - 30);
      if (rival) rival.position.z = -ai.x;
      for (let k = 0; k < 4; k++) lampM[k].emissiveIntensity = (k < 3 ? S.lights > k && S.lights < 4 : S.lights >= 4) ? 2.2 : 0;
      drawTach(me.rpm, me.g + 1, Math.round(me.v * 3.6));
      if (engine && engine.set) engine.set(S.st === 'stage' ? .05 : .14, 45 + me.rpm * 200);
      smoke.update(dt, 1.2);
    },
    stop() { core.stop(); engine && engine.stop(); },
  };
}

// ---------------------------------------------------------- PASAR MALAM
function Market3D(K, api, opts, M = {}) {
  const scene = new T.Scene(); const sun = environment(K, scene, { sky: 0x0d1530, shadow: 10, fogNear: 18, fogFar: 55 }); sun.intensity = .25;
  const hemi = scene.children.find(o => o.isHemisphereLight); if (hemi) { hemi.intensity = .55; hemi.color.setHex(0x8899ff); }
  K.mesh(new T.BoxGeometry(60, .1, 30), K.mat(0x3a3a40, { roughness: .95 }), 0, -.05, 0, scene, false);
  const STALL = 4.6, cols = [0xc0392b, 0x2e86de, 0x27ae60, 0xf39c12, 0x8e44ad, 0x16a085];
  const foodSprite = (ic) => { const c = K.canvasTex(128, 128); c.x.font = '100px system-ui'; c.x.textAlign = 'center'; c.x.textBaseline = 'middle'; c.x.fillText(ic, 64, 72); c.t.needsUpdate = true; const s = new T.Sprite(new T.SpriteMaterial({ map: c.t, transparent: true })); return s; };
  FOODS.forEach((f, k) => {
    const g = K.group(k * STALL, 0, -2.2, scene); const col = cols[k % cols.length];
    for (const x of [-1.9, 1.9]) for (const z of [-1.2, 1.2]) K.cyl(.05, .05, 2.6, K.mat(0xdddddd), x, 1.3, z, g, 6);
    const stripes = K.canvasTex(256, 64); for (let i = 0; i < 8; i++) { stripes.x.fillStyle = i % 2 ? '#ffffff' : '#' + col.toString(16).padStart(6, '0'); stripes.x.fillRect(i * 32, 0, 32, 64); } stripes.t.needsUpdate = true;
    const roof = K.mesh(new T.BoxGeometry(4.2, .12, 2.8), new T.MeshStandardMaterial({ map: stripes.t, roughness: .7 }), 0, 2.62, 0, g); roof.rotation.x = -.12;
    K.box(3.8, .95, .9, K.mat(0x6d4c41), 0, .48, .9, g); K.box(3.9, .06, 1, K.mat(0xf3eee2), 0, .98, .9, g);
    const sign = textPlane(K, `${f.bm.toUpperCase()}  RM${f.price}`, 3.6, .5, { bg: '#' + col.toString(16).padStart(6, '0'), px: 70 }); sign.position.set(0, 2.25, 1.35); g.add(sign);
    for (let i = 0; i < 3; i++) { const s = foodSprite(f.ic); s.scale.set(.55, .55, .55); s.position.set(-1 + i, 1.3, .9); g.add(s); }
    if (k % 2) putModel(M, 'stove', g, 1.2, -.4, { h: .9 }); else putModel(M, 'potStew', g, -1.2, -.4, { h: .5 });
    for (let i = 0; i < 9; i++) { const b = K.ball(.06, new T.MeshBasicMaterial({ color: [0xffd452, 0xff6b6b, 0x7bed9f, 0x70a1ff][i % 4] }), -2 + i * .5, 2.55 - Math.sin(i / 8 * Math.PI) * .25, 1.42, g); b.castShadow = false; }
  });
  for (let k = 0; k < 3; k++) { const l = new T.PointLight(0xffc27a, 14, 14, 1.4); l.position.set(k * STALL * 2.5, 3, 0); scene.add(l); }
  putModel(M, 'market/stall_fruit', scene, -4.6, -2, { h: 2.6, ry: .2 }); putModel(M, 'market/food_cart', scene, 6 * STALL - 1, -1.5, { h: 1.8, ry: -.3 }); for (let k = 0; k < 4; k++) putModel(M, 'market/lamp_post', scene, -2.3 + k * STALL * 1.6, 2, { h: 3.2 }); putModel(M, 'market/crate_oranges', scene, 2.3, -.4, { h: .5 }); putModel(M, 'market/barrel_open', scene, 11.6, -.4, { h: .8 });
  const lights = []; for (let i = 0; i < 70; i++) { const b = K.ball(.05, new T.MeshBasicMaterial({ color: new T.Color().setHSL(i / 70, .9, .65) }), -4 + i * .45, 4 + Math.sin(i * .5) * .3, 2.5, scene); b.castShadow = false; lights.push(b); }
  const crowd = []; for (let k = 0; k < 10; k++) { const p = makeAthlete(K, { shirt: cols[k % 6], pants: 0x2c3e50, skin: [0xc68a5a, 0xa8703e, 0xe0b08a][k % 3], hair: 0x1c1c1c }); p.g.position.set(-3 + k * 2.6, 0, 3.5 + (k % 2) * 1.5); p.g.rotation.y = k % 2 ? Math.PI / 2 : -Math.PI / 2; scene.add(p.g); crowd.push({ p, v: (k % 2 ? 1 : -1) * (.6 + Math.random() * .5) }); }
  const cust = makeAthlete(K, { shirt: 0xe84393, pants: 0x2d3436, skin: 0xc68a5a, hair: 0x1c1c1c }); cust.g.visible = false; scene.add(cust.g);
  let role = null, stall = 0, custT = 0, t = 0;
  const core = marketCore(api, opts, {
    role(r) { role = r; }, stall(k) { stall = k; },
    customer() { cust.g.visible = true; custT = 0; cust.g.position.set(stall * STALL - 6, 0, 1.4); cust.body.children[1] && null; },
    paid() { custT = -1; },
  });
  const view = { pos: new T.Vector3(1.5 * STALL, 2.4, 7.5), look: new T.Vector3(1.5 * STALL, 1.4, -2), halfW: 5.4, halfH: 3, speed: 4 };
  return {
    scene, view,
    ray() { return { x: 0, y: 0 }; },
    down() {}, move() {}, up() {},
    dbg: () => ({ ...core.S }),
    update(dt) {
      t += dt; core.update(dt);
      if (role === 'seller') { const sx = stall * STALL; view.pos.set(sx, 1.65, -2.4); view.look.set(sx, 1.35, 3); view.halfW = 3.6; view.halfH = 2.1;
        if (custT >= 0) { custT += dt; const want = sx, cx = cust.g.position.x; cust.g.position.x = cx + clamp(want - cx, -dt * 3, dt * 3); cust.g.position.z = .7; cust.g.rotation.y = Math.PI + (Math.abs(want - cx) > .05 ? Math.sign(want - cx) * -Math.PI / 2 : 0); }
        else { cust.g.position.x += dt * 3; cust.g.rotation.y = Math.PI / 2; if (cust.g.position.x > stall * STALL + 8) cust.g.visible = false; } }
      else if (role === 'buyer') { const sx = stall * STALL; view.pos.set(sx, 1.65, 4.4); view.look.set(sx, 1.3, -2); view.halfW = 4; view.halfH = 2.4; }
      else { view.pos.set(2.5 * STALL, 3.2, 10); view.look.set(2.5 * STALL, 1.3, -2); view.halfW = 9; view.halfH = 5; }
      for (const c of crowd) { c.p.g.position.x += c.v * dt; if (c.p.g.position.x > 6 * STALL) c.p.g.position.x = -4; if (c.p.g.position.x < -4) c.p.g.position.x = 6 * STALL; c.p.legs[0].rotation.x = Math.sin(t * 6 + c.v) * .4; c.p.legs[1].rotation.x = -Math.sin(t * 6 + c.v) * .4; }
      for (let i = 0; i < lights.length; i++) lights[i].material.color.setHSL(((i / 70) + t * .05) % 1, .9, .55 + Math.sin(t * 4 + i) * .15);
    },
    stop() { core.stop(); },
  };
}


// ---------------------------------------------------------- DAMAI CITY MALL — misi beli-belah (look around, tap the shelves)
function Mall3D(K, api, opts, M = {}) {
  const scene = new T.Scene(); environment(K, scene, { sky: 0xf3efe8, shadow: 12, fogNear: 30, fogFar: 70 });
  const tile = K.canvasTex(256, 256); { const x = tile.x; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#efe9df' : '#e2dccf'; x.fillRect(i * 64, j * 64, 64, 64); } x.strokeStyle = 'rgba(0,0,0,.06)'; for (let k = 0; k <= 256; k += 64) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k, 256); x.moveTo(0, k); x.lineTo(256, k); x.stroke(); } } tile.t.wrapS = tile.t.wrapT = T.RepeatWrapping; tile.t.repeat.set(10, 10); tile.t.needsUpdate = true;
  K.mesh(new T.CylinderGeometry(14, 14, .1, 48), new T.MeshStandardMaterial({ map: tile.t, roughness: .35 }), 0, -.05, 0, scene, false);
  const wall = K.mesh(new T.CylinderGeometry(14, 14, 9, 48, 1, true), new T.MeshStandardMaterial({ color: 0xf8f4ec, side: T.BackSide, roughness: .9 }), 0, 4.5, 0, scene, false);
  K.mesh(new T.CylinderGeometry(14, 14, .2, 48), K.mat(0xffffff), 0, 9, 0, scene, false);
  const sky = K.mesh(new T.CircleGeometry(5, 32), new T.MeshBasicMaterial({ color: 0xd6efff }), 0, 8.88, 0, scene, false); sky.rotation.x = Math.PI / 2;
  K.mesh(new T.TorusGeometry(7, .25, 8, 48), K.mat(0x8e44ad), 0, 4.2, 0, scene, false).rotation.x = Math.PI / 2;
  K.mesh(new T.CylinderGeometry(7.2, 7.2, .15, 48, 1, true), K.mat(0xffffff, { side: T.DoubleSide }), 0, 4.05, 0, scene, false);
  for (let k = 0; k < 4; k++) { const l = new T.PointLight(0xfff2dd, 16, 22, 1.4); l.position.set(Math.cos(k * 1.57) * 6, 7.5, Math.sin(k * 1.57) * 6); scene.add(l); }
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; K.cyl(.3, .3, 9, K.mat(0xdcd6c8), Math.cos(a) * 9.6, 4.5, Math.sin(a) * 9.6, scene, 12); }
  const pick = [];
  const label = (it) => { const c = K.canvasTex(512, 160); c.x.fillStyle = '#8e44ad'; c.x.beginPath(); c.x.roundRect(8, 8, 496, 144, 28); c.x.fill(); c.x.fillStyle = '#fff'; c.x.font = '900 64px system-ui'; c.x.textAlign = 'center'; c.x.textBaseline = 'middle'; c.x.fillText(`${it.ic} ${it.bm}`, 256, 84); c.t.needsUpdate = true; const s = new T.Sprite(new T.SpriteMaterial({ map: c.t, transparent: true })); s.scale.set(1.8, .56, 1); return s; };
  const items = [...MALL_ITEMS, { id: 'kaunter', bm: 'Kaunter', ic: '💳', model: 'shop/cash-register' }];
  const groups = {}; let cashier = null;
  items.forEach((it, k) => {
    const a = k / items.length * Math.PI * 2, R = 6.2, g = K.group(Math.sin(a) * R, 0, -Math.cos(a) * R, scene); g.rotation.y = -a; groups[it.id] = g;
    K.box(2.6, .08, 1.8, K.mat(it.id === 'kaunter' ? 0x27ae60 : 0xd9cbb5), 0, .04, 0, g, false);
    const m = putModel(M, it.model, g, 0, 0, { h: it.id === 'kaunter' ? 1.1 : it.id === 'gacha' ? 1.6 : 1.7 }) || K.box(1.6, 1.4, .8, K.mat([0xe67e22, 0x2e86de, 0x27ae60, 0xc0392b][k % 4]), 0, .7, 0, g);
    if (it.id === 'kaunter') { K.box(2.2, 1, .8, K.mat(0x34495e), 0, .5, .25, g); const e = putAnimated(M, 'shop/character-employee', g, 0, -.7, { h: 1.6, anim: 'idle' }); if (e) cashier = e; }
    const lb = label(it); lb.position.set(0, 2.6, 0); g.add(lb); g.userData.lb = lb;
    g.traverse(o => { if (o.isMesh || o.isSprite) { o.userData.pickId = it.id; pick.push(o); } });
    const hit = K.box(2.6, 2.6, 1.8, new T.MeshBasicMaterial({ visible: false }), 0, 1.3, 0, g, false); hit.userData.pickId = it.id; pick.push(hit);
  });
  const shoppers = []; const CH = ['chars/male-a', 'chars/female-a', 'chars/male-c', 'chars/female-c'];
  for (let k = 0; k < 4; k++) { const a = putAnimated(M, CH[k], scene, 0, 0, { h: 1.55, anim: 'walk' }); if (a) shoppers.push({ a, ang: k * 1.6, r: 9.6 - (k % 2) * .9, sp: (k % 2 ? 1 : -1) * .12 }); }
  const cart = putModel(M, 'shop/shopping-cart', scene, Math.sin(.29) * 4.4, -Math.cos(.29) * 4.4, { h: .9, ry: 2.4 });
  const glow = new Sparks(scene, 120, 0xffe066, .12);
  let yaw = 0, drag = null, t = 0, wantYaw = 0;
  const core = mallCore(api, opts, {
    got(id) { const g = groups[id]; if (!g) return; const p = g.position; for (let k = 0; k < 40; k++) glow.add(p.x, 1.5, p.z, (Math.random() - .5) * 2, 1 + Math.random() * 2, (Math.random() - .5) * 2, .9); g.userData.lb.material.opacity = .45; },
    pay() { const g = groups.kaunter; wantYaw = Math.atan2(g.position.x, -g.position.z); },
  });
  const view = { pos: new T.Vector3(0, 1.75, 0), look: new T.Vector3(0, 1.3, -5), halfW: 4.8, halfH: 3, snap: true };
  const rcHit = { id: null };
  return {
    scene, view,
    ray(rc) { const h = rc.intersectObjects(pick, false)[0]; rcHit.id = h ? h.object.userData.pickId : null; return { x: 0, y: 0, hit: rcHit.id }; },
    down(p) { drag = { sx: p.sx, yaw, moved: 0, id: p.hit }; },
    move(p) { if (drag && p.down) { drag.moved = Math.max(drag.moved, Math.abs(p.sx - drag.sx)); yaw = drag.yaw - (p.sx - drag.sx) * .006; wantYaw = yaw; } },
    up() { if (drag && drag.moved < 10 && drag.id) core.pick(drag.id); drag = null; },
    dbg: () => ({ ...core.S }),
    pickId: (id) => core.pick(id),
    update(dt) {
      t += dt; if (!drag) yaw += (wantYaw - yaw) * Math.min(1, dt * 3);
      view.look.set(Math.sin(yaw) * 5, 1.25, -Math.cos(yaw) * 5);
      for (const s2 of shoppers) { s2.ang += s2.sp * dt; s2.a.obj.position.set(Math.sin(s2.ang) * s2.r, 0, -Math.cos(s2.ang) * s2.r); s2.a.obj.rotation.y = -s2.ang + (s2.sp > 0 ? -Math.PI / 2 : Math.PI / 2) + Math.PI; s2.a.update(dt); }
      cashier && cashier.update(dt);
      for (const g of Object.values(groups)) g.userData.lb.position.y = 2.6 + Math.sin(t * 2 + g.position.x) * .05;
      glow.update(dt, -3);
    },
    stop() { core.stop(); },
  };
}




// ---------------------------------------------------------- FUTSAL (penalty shootout + 3v3 match) — scenes live in futsal3d.js
let FUT = null;
const fut = () => FUT || (FUT = futsalScenes({ T, environment, Sparks, palm, stiltHouse, putModel, mulberry32 }));
const futSafe = (fn) => { try { return fn(); } catch (e) { document.querySelectorAll('#game .f3').forEach(el => el.remove()); $('game').classList.remove('f3mode'); throw e; } }; // never leave a half-built HUD behind if 3D fails
let SEA = null; const sea = () => SEA || (SEA = seaFishScene({ T, environment, Sparks, palm, stiltHouse, putModel, mulberry32, makeHero }));
let MALL2 = null; const mall2 = () => MALL2 || (MALL2 = mallScene({ T, environment, Sparks, putModel, putAnimated, textPlane, makeHero, mulberry32 }));
function MallV2(K, api, opts, M = {}) { return futSafe(() => mall2()(K, api, opts, M)); } // Damai City Mall v2 (supermarket). The old Mall3D stays below as reference.
let JD = null; const jd = () => JD || (JD = jalanDragScene({ T, environment, Sparks, palm, putModel, textPlane, mulberry32 }));
let VB2 = null; const vb2 = () => VB2 || (VB2 = volleyScene({ T, environment, Sparks, palm, putModel, putAnimated, makeOcean, shoreWaves, textPlane, mulberry32 }));
function VolleyV2(K, api, opts, M = {}) { return futSafe(() => vb2()(K, api, opts, M)); } // 2v2 beach volleyball v2 (old Volley3D kept below as reference)
let PH2 = null; const ph2 = () => PH2 || (PH2 = photoScene({ T, environment, Sparks, palm, stiltHouse, bridgeFar, putModel, putAnimated, makeOcean, shoreWaves, textPlane, mulberry32 }));
function PhotoV2(K, api, opts, M = {}) { return futSafe(() => ph2()(K, api, opts, M)); } // 3D photo simulator v2 (old Photo3D kept below)
function JalanDrag3D(K, api, opts, M = {}) { return futSafe(() => jd()(K, api, opts, M)); }
function SeaFish3D(K, api, opts, M = {}) { return futSafe(() => sea()(K, api, opts, M)); }
let KAIL = null; const kail3 = () => KAIL || (KAIL = kailScene({ T, environment, Sparks, palm, stiltHouse, putModel, mulberry32, makeOcean, makeHero }));
function Kail3D(K, api, opts, M = {}) { return futSafe(() => kail3()(K, api, opts, M)); } // Jelajah Kail (Fasa 1)
function Futsal3D(K, api, opts, M = {}) { return futSafe(() => fut().penalty(K, api, opts, M)); }
function Futsal3v3_3D(K, api, opts, M = {}) { return futSafe(() => fut().match(K, api, opts, M)); }
