// JELAJAH KAIL (Fasa 1) — four fishing spots: lake, river, reef, deep water. Rendering and HUD only:
// every rule (bites, strike ring, fight, cooler, money, unlocks, save slice) lives in fishrules.js and is tested in Node.
import { $, clamp, sfx, S, save, checkDaily, toast, today, seaAmbience, musicDuck } from './core.js';
import { RARITY } from './minigames.js';
import { skinFish } from './fishskin.js';
import { isShared } from './models.js';
import { earn, spend, balance, fmtRM } from './wallet.js';
import * as R from './fishrules.js';

// colours per spot (docs/kail_style.json)
const STY = {
  tasik: { top: 0x6f9fd0, bot: 0xffd9a8, water: 0x4f9d8f, ground: 0x3f7a58, accent: 0xe58fb0, op: .9, cast: [.3, -6], sunC: 0xffd9a6, discC: 0xffe9b8, cloud: 0xfff1dc, sunI: 2.1, hemiI: 1.55, hemiC: 0xfff0dc, sunAt: [-26, 22], lamp: 0 },
  sungai: { top: 0x4a3f7a, bot: 0xff8f52, water: 0x5c6f78, ground: 0x4a6b3a, accent: 0xffb347, op: .93, cast: [.3, -6.5], sunC: 0xff9a58, discC: 0xffd9a0, cloud: 0xffb48a, sunI: 2.6, hemiI: 1.3, hemiC: 0xffd2b0, sunAt: [20, 12], lamp: 16 },
  terumbu: { top: 0x2f93d6, bot: 0x9fdcf0, water: 0x1fa9bd, ground: 0xefdcaa, accent: 0xff7a59, op: .7, cast: [.9, -7], sunC: 0xfff6e0, sunI: 2.6, hemiI: 1.9, hemiC: 0xffffff },
  dalam: { top: 0x2c68ad, bot: 0xa9cdea, water: 0x0f4f86, ground: 0x5a6672, accent: 0xf1c40f, op: .9, cast: [.9, -8], sunC: 0xfff1d6, sunI: 2.4, hemiI: 1.8, hemiC: 0xffffff },
};
const WX = { cerah: { bm: 'Cerah', en: 'Clear', ic: '☀️', lit: 1 }, mendung: { bm: 'Mendung', en: 'Cloudy', ic: '⛅', lit: .72 }, hujan: { bm: 'Hujan', en: 'Rain', ic: '🌧️', lit: .55 } };
const ITEM_NAME = { rod: 'Joran', line: 'Tali', hook: 'Kail', cooler: 'Penyejuk' };
const fmtKg = (k) => (k < 1 ? `${Math.round(k * 1000)} g` : `${k.toFixed(2)} kg`);

export function kailScene({ T, environment, Sparks, palm, stiltHouse, putModel, mulberry32, makeOcean, makeHero }) {
  return function Kail3D(K, api, opts, M = {}) {
    checkDaily();
    const practice = !!opts.practice;
    const kail = practice ? (() => { const k = R.kailSave({}); for (const s of R.SPOTS) k.spots[s.id] = true; return k; })() : R.kailSave(S);
    const hour = S.timeMode === 'day' ? 12 : new Date().getHours() + new Date().getMinutes() / 60;
    const weather = (() => { const d = new Date(), r = mulberry32(d.getFullYear() * 372 + (d.getMonth() + 1) * 31 + d.getDate())(); return r < .6 ? 'cerah' : r < .85 ? 'mendung' : 'hujan'; })();
    let seed = (Date.now() ^ 0x9e3779b9) >>> 0; const rng = () => { seed = (seed + 1) >>> 0; return mulberry32(Math.imul(seed, 2654435761) >>> 0)(); };
    let stats = R.tackleStats(kail);
    const UP = new T.Vector3(0, 1, 0), v3 = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);

    // ---------------------------------------------------------------- scene
    // Each spot has a fixed mood (docs/kail_style.json). The real clock only changes which fish bite, so the view is never dull at night.
    const scene = new T.Scene(), sun = environment(K, scene, { sky: 0xffb070, shadow: 13, fogNear: 45, fogFar: 175 });
    const hemi = scene.children.find((o) => o.isHemisphereLight);
    if (sun.shadow && sun.shadow.camera) Object.assign(sun.shadow.camera, { far: 90 }); if (sun.target) scene.add(sun.target);
    const lamp = new T.PointLight(0xffb060, 0, 16); lamp.position.set(-5, 2.6, 4); scene.add(lamp);
    // sky dome (vertical gradient), sun disc with glow, glitter path on the water
    const domeG = new T.SphereGeometry(165, 20, 12); domeG.setAttribute('color', new T.Float32BufferAttribute(new Float32Array(domeG.attributes.position.count * 3), 3));
    const dome = new T.Mesh(domeG, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide, fog: false, depthWrite: false })); dome.position.set(0, -6, -10); dome.renderOrder = -3; dome.frustumCulled = false; scene.add(dome);
    const cA = new T.Color(), cB = new T.Color(), cC = new T.Color();
    function setSky(top, bot) { const p = domeG.attributes.position, c = domeG.attributes.color; cA.set(top); cB.set(bot); for (let i = 0; i < p.count; i++) { const k = Math.pow(clamp((p.getY(i) / 165 + .02) / .55, 0, 1), .65); cC.copy(cB).lerp(cA, k); c.setXYZ(i, cC.r, cC.g, cC.b); } c.needsUpdate = true; }
    const sunDisc = new T.Mesh(new T.CircleGeometry(5, 28), new T.MeshBasicMaterial({ color: 0xfff2c8, fog: false, depthWrite: false })), blobT = (() => { const c = K.canvasTex(128, 128), gr = c.x.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.55)'); gr.addColorStop(.6, 'rgba(255,255,255,.14)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.x.fillStyle = gr; c.x.fillRect(0, 0, 128, 128); c.t.needsUpdate = true; return c.t; })(), sunGlow = new T.Mesh(new T.PlaneGeometry(90, 90), new T.MeshBasicMaterial({ map: blobT, color: 0xffb060, fog: false, transparent: true, opacity: .7, depthWrite: false, blending: T.AdditiveBlending }));
    const cloudT = (() => { const c = K.canvasTex(256, 96), x = c.x, g = mulberry32(5); for (let i = 0; i < 16; i++) { const cx = 30 + g() * 196, cy = 40 + g() * 26, rr = 18 + g() * 26, gr = x.createRadialGradient(cx, cy, 0, cx, cy, rr); gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(cx - rr, cy - rr, rr * 2, rr * 2); } c.t.needsUpdate = true; return c.t; })();
    const clouds = Array.from({ length: 7 }, (_, i) => { const g = mulberry32(i * 37 + 3), m = new T.Mesh(new T.PlaneGeometry(70 + g() * 50, 16 + g() * 12), new T.MeshBasicMaterial({ map: cloudT, transparent: true, opacity: .8, fog: false, depthWrite: false })); m.position.set(-130 + i * 44 + g() * 20, 24 + g() * 34, -156); m.renderOrder = -1; m.userData.vx = .25 + g() * .35; scene.add(m); return m; });
    sunGlow.renderOrder = -2; sunDisc.renderOrder = -1; scene.add(sunGlow, sunDisc);
    const gl = K.canvasTex(64, 256); { const x = gl.x, gr = mulberry32(77); for (let i = 0; i < 260; i++) { const y = gr() * 256, k = y / 256, w = 3 + gr() * (6 + k * 34); x.fillStyle = `rgba(255,${200 + Math.floor(gr() * 40)},${130 + Math.floor(gr() * 60)},${(.75 - k * .5) * (.4 + gr() * .6)})`; x.fillRect(32 - w / 2 + (gr() - .5) * (4 + k * 22), y, w, 1 + gr() * 1.6); } gl.t.wrapT = T.RepeatWrapping; gl.t.needsUpdate = true; }
    const glitterG = new T.Group(), glitter = new T.Mesh(new T.PlaneGeometry(5, 120), new T.MeshBasicMaterial({ map: gl.t, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false })); glitter.rotation.x = -Math.PI / 2; glitterG.add(glitter); scene.add(glitterG);
    const waterG = new T.PlaneGeometry(260, 220, 44, 40); waterG.rotateX(-Math.PI / 2);
    const wBase = Float32Array.from(waterG.attributes.position.array), waterM = new T.MeshStandardMaterial({ color: STY.tasik.water, roughness: .22, metalness: .15, transparent: true, opacity: .92 });
    const water = new T.Mesh(waterG, waterM); water.position.set(0, 0, -70); water.receiveShadow = true; scene.add(water);
    // Medium / High: the game's shared ocean (Gerstner waves, ripple normals, sky reflection, foam). Low keeps the cheap plane above.
    let ocean = null; try { if (makeOcean) { ocean = makeOcean(T, { w: 260, h: 220, seg: .28, amp: .1, rough: .16, repeat: 34, opacity: .93 }); ocean.mesh.position.set(0, 0, -70); ocean.mesh.visible = false; scene.add(ocean.mesh); } } catch { ocean = null; }
    const splash = new Sparks(scene, 70, 0xffffff, .13);

    // ---------------------------------------------------------------- rendering quality (Low / Medium / High) — measured, see docs/GRAFIK.md
    const GFX = { low: { bm: 'Rendah', en: 'Low', pr: 1, shadow: false, env: false, waves: false, nrm: .2 }, med: { bm: 'Sederhana', en: 'Medium', pr: 1.5, shadow: true, env: true, waves: true, nrm: .32 }, high: { bm: 'Tinggi', en: 'High', pr: 2, shadow: true, env: true, waves: true, nrm: .4 } };
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer:coarse)').matches;
    let gq = GFX[S.gfxQ] ? S.gfxQ : coarse ? 'med' : 'high', wantPR = 1;
    const RD = api.renderer, prev = RD ? { tm: RD.toneMapping, ex: RD.toneMappingExposure } : null;
    if (RD) { RD.toneMapping = T.ACESFilmicToneMapping; RD.toneMappingExposure = 1; }
    // procedural textures (512 px or less): timber planks, roof tiles, water ripples (normal map)
    const texRep = (t, x, y) => { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(x, y); t.needsUpdate = true; return t; };
    const woodT = (() => { const c = K.canvasTex(256, 256), x = c.x, g = mulberry32(11); x.fillStyle = '#c9b89e'; x.fillRect(0, 0, 256, 256);
      for (let pl = 0; pl < 4; pl++) { const y0 = pl * 64, sh = 200 + Math.floor(g() * 40); x.fillStyle = `rgb(${sh},${sh - 14},${sh - 34})`; x.fillRect(0, y0, 256, 64);
        for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(${g() < .5 ? '70,48,28' : '255,240,215'},${.05 + g() * .12})`; x.fillRect(g() * 256, y0 + 2 + g() * 60, 30 + g() * 140, 1 + g() * 1.5); }
        for (let k = 0; k < 2; k++) if (g() < .7) { const kx = g() * 256, ky = y0 + 14 + g() * 36; for (let rr = 7; rr > 1; rr -= 2) { x.strokeStyle = `rgba(60,40,24,${.12 + (7 - rr) * .04})`; x.beginPath(); x.ellipse(kx, ky, rr * 1.8, rr, 0, 0, 6.3); x.stroke(); } }
        x.fillStyle = 'rgba(30,20,12,.55)'; x.fillRect(0, y0, 256, 2); x.fillStyle = 'rgba(255,245,225,.18)'; x.fillRect(0, y0 + 2, 256, 1); const sx = g() * 256; x.fillStyle = 'rgba(30,20,12,.5)'; x.fillRect(sx, y0, 2, 64); }
      return texRep(c.t, 1, 1); })();
    const roofT = (() => { const c = K.canvasTex(128, 128), x = c.x, g = mulberry32(13); for (let row = 0; row < 8; row++) { const y0 = row * 16, gr = x.createLinearGradient(0, y0, 0, y0 + 16); gr.addColorStop(0, '#ffffff'); gr.addColorStop(.75, '#c9c2bc'); gr.addColorStop(1, '#6d625c'); x.fillStyle = gr; x.fillRect(0, y0, 128, 16);
        for (let k = 0; k < 8; k++) { const xx = k * 16 + (row % 2) * 8; x.fillStyle = `rgba(40,28,24,${.25 + g() * .2})`; x.fillRect(xx, y0, 1.5, 16); x.fillStyle = `rgba(${g() < .5 ? '40,60,40' : '90,70,60'},${g() * .16})`; x.fillRect(xx + 2, y0 + 2, 12, 12); } }
      return texRep(c.t, 6, 3); })();
    const nrmT = (() => { const N = 128, cv = document.createElement('canvas'); cv.width = cv.height = N; const x = cv.getContext('2d'), im = x.createImageData(N, N), g = mulberry32(17), W = Array.from({ length: 9 }, () => [1 + Math.floor(g() * 5), 1 + Math.floor(g() * 5), g() * 6.28, .5 + g()]);
      const hgt = (u, v) => { let s2 = 0; for (const [a, b, ph, am] of W) s2 += Math.sin((u * a + v * b) * 6.2832 + ph) * am / (a + b); return s2; };
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const u = i / N, v = j / N, e = 1 / N, dx = (hgt(u + e, v) - hgt(u - e, v)) * 5, dy = (hgt(u, v + e) - hgt(u, v - e)) * 5, l = Math.hypot(dx, dy, 1), o = (j * N + i) * 4; im.data[o] = (-dx / l * .5 + .5) * 255; im.data[o + 1] = (-dy / l * .5 + .5) * 255; im.data[o + 2] = (1 / l * .5 + .5) * 255; im.data[o + 3] = 255; }
      x.putImageData(im, 0, 0); const t = new T.CanvasTexture(cv); t.anisotropy = 4; return texRep(t, 58, 50); })();
    waterM.normalMap = nrmT; waterM.roughness = .34; waterM.metalness = 0; waterM.envMapIntensity = .35;
    const own = (m) => { m.userData.own = true; return m; };
    const woodMat = (col, rx, ry, o = {}) => { const t = woodT.clone(); texRep(t, rx, ry); return own(new T.MeshStandardMaterial({ color: col, map: t, roughness: .78, ...o })); };
    // image-based lighting from the sky gradient, so water and wet timber pick up the sky colour
    let pm = null, envRT = null; const envScene = new T.Scene(); envScene.add(new T.Mesh(domeG, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide, fog: false })));
    function updateEnv() { if (envRT) { envRT.dispose(); envRT = null; } scene.environment = null; if (!RD || !GFX[gq].env || !T.PMREMGenerator) return; try { pm = pm || new T.PMREMGenerator(RD); envRT = pm.fromScene(envScene, 0, .1, 400); scene.environment = envRT.texture; if ('environmentIntensity' in scene) scene.environmentIntensity = .55; } catch { scene.environment = null; } }
    function applyGfx() { const q = GFX[gq]; wantPR = Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, q.pr); if (RD) { RD.setPixelRatio(wantPR); const cv = RD.domElement; RD.setSize(cv.clientWidth, cv.clientHeight, false); } sun.castShadow = q.shadow; waterM.normalScale.set(q.nrm, q.nrm); const useO = !!ocean && q.waves; if (ocean) ocean.mesh.visible = useO; water.visible = !useO; }
    // expanding rings where the bait or a fish breaks the surface
    const rings = Array.from({ length: 4 }, () => { const m = new T.Mesh(new T.RingGeometry(.82, 1, 28), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m); return { m, t: 9 }; }); let ringI = 0;
    function ripple(x, z) { const r2 = rings[ringI = (ringI + 1) % rings.length]; r2.t = 0; r2.m.position.set(x, .06, z); r2.m.visible = true; }

    // ---------------------------------------------------------------- spot dressing (rebuilt when the player travels)
    let dress = null, spot = R.spotById(kail.spot), anglerG = null, boatBob = null;
    function clearDress() {
      if (!dress) return; scene.remove(dress);
      dress.traverse((o) => { if (o.geometry && !isShared(o.geometry) && !o.geometry.userData.keepGeo) o.geometry.dispose(); if (o.material && o.material.userData && o.material.userData.own) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); dress = null; boatBob = null;
    }
    const glowM = () => K.mat(0xffd27a, { emissive: 0xffa030, emissiveIntensity: 1.8 });
    // seated angler: songkok, cream shirt, checked sampin, white shoes, folding stool. Origin = deck surface under the stool.
    function makeAngler(parent, x, y, z) {
      const g = K.group(x, y, z, parent), skin = K.mat(0xb07a55), shirt = K.mat(0xe9dcc2), dark = K.mat(0x26262b), wood = K.mat(0x9a6b3f);
      for (const [sx, sz] of [[-.2, -.16], [.2, -.16], [-.2, .16], [.2, .16]]) { const l = K.cyl(.025, .025, .5, wood, sx, .23, sz, g, 5); l.rotation.z = sx > 0 ? -.25 : .25; } K.box(.5, .05, .4, K.mat(0x5a4632), 0, .47, 0, g);
      K.box(.46, .2, .36, K.mat(0x55606e), 0, .58, 0, g); K.box(.48, .1, .38, K.mat(0xd8d8d8), 0, .56, 0, g);            // hips + sampin band
      const torso = K.box(.5, .62, .28, shirt, 0, .98, .03, g); torso.rotation.x = -.12; K.box(.07, .7, .3, dark, .06, .98, .03, g).rotation.set(-.12, 0, .55); // bag strap
      K.ball(.16, skin, 0, 1.44, -.02, g); K.cyl(.165, .165, .15, dark, 0, 1.58, -.02, g, 12);                                // head + songkok
      for (const sx of [-.13, .13]) { K.box(.17, .15, .5, dark, sx, .58, -.3, g); K.box(.14, .5, .15, dark, sx, .32, -.52, g); K.box(.15, .1, .3, K.mat(0xf2f2f2), sx, .05, -.58, g); }
      for (const sx of [-.28, .28]) { const a = K.box(.11, .11, .5, shirt, sx * .85, 1.02, -.24, g); a.rotation.x = .35; a.rotation.y = sx > 0 ? .25 : -.25; K.ball(.07, skin, sx * .45, .96, -.5, g); }
      return g;
    }
    function boatAt(x, z, ry, len, col = 0x2e86de) { const o = putModel(M, 'rowboat', dress, x, z, { len, ry }); if (!o) { const b = K.group(x, 0, z, dress); b.rotation.y = ry; K.box(len * .32, .45, len, K.mat(0x8a5a3a), 0, .12, 0, b); K.box(len * .34, .1, len * 1.02, K.mat(col), 0, .38, 0, b); } }
    function kampung(id, r) { // pier with a roofed hut (wakaf), village on stilts across the water, boats, palms
      const wood = woodMat(0xa88562, 2, 2), dark = K.mat(0x5d4632, { roughness: 1 }), wet = woodMat(0x8f7052, 3, 2.4, { roughness: .38, metalness: .05 }), roofM = (c) => { const t = roofT.clone(); texRep(t, 6, 3); return own(new T.MeshStandardMaterial({ color: c, map: t, roughness: .7 })); };
      K.box(4.2, .3, 9, wet, .2, .3, 5.2, dress); for (const x of [-1.8, 2.2]) for (const z of [1, 4.4, 8.6]) K.cyl(.13, .15, 2.4, dark, x, -.7, z, dress, 6);
      for (let k = 0; k < 9; k++) K.box(4.2, .02, .07, dark, .2, .46, .9 + k, dress, false);
      for (const [x, z] of [[1.9, 1], [-1.5, 1.1]]) { K.cyl(.2, .22, .9, dark, x, .85, z, dress, 8); const rp = K.mesh(new T.TorusGeometry(.23, .05, 6, 12), K.mat(0xc8a56a), x, .95, z, dress, false); rp.rotation.x = Math.PI / 2; }
      // wakaf on the left
      K.box(5, .3, 6.5, wood, -7.1, .3, 5.6, dress); for (const x of [-9.3, -4.9]) for (const z of [2.7, 8.5]) { K.cyl(.12, .14, 2.4, dark, x, -.7, z, dress, 6); K.cyl(.1, .1, 2.9, dark, x, 1.9, z, dress, 6); }
      for (const s of [-1, 1]) { const rf = K.box(5.8, .14, 4, roofM(0xa8553c), -7.1, 3.9, 5.6 + s * 1.7, dress); rf.rotation.x = s * .45; } K.box(5.8, .12, .3, K.mat(0x5a2a1d), -7.1, 4.62, 5.6, dress);
      K.box(4.4, .08, .08, dark, -7.1, 1.25, 2.7, dress); K.box(2.2, .1, 1, wood, -8, 1.05, 7, dress); for (const x of [-8.8, -7.2]) K.box(.1, .6, .9, dark, x, .75, 7, dress);
      for (const [x, z] of [[-5.1, 2.9], [-9.1, 2.9]]) { K.cyl(.01, .01, .5, dark, x, 3.05, z, dress, 4); K.box(.22, .3, .22, glowM(), x, 2.7, z, dress, false); }
      // gear beside the angler
      K.box(.9, .5, .55, K.mat(0x2e6fd0), -1, .7, 5.5, dress); K.box(.94, .12, .59, K.mat(0xf4f4f4), -1, 1.01, 5.5, dress);
      K.box(.6, .22, .36, K.mat(0x7f8c8d), -1.15, .56, 4.5, dress); K.box(.6, .04, .36, K.mat(0x95a5a6), -1.15, .78, 4.3, dress).rotation.x = -.9;
      const net = K.mesh(new T.CylinderGeometry(.34, .26, .45, 10, 1, true), new T.MeshStandardMaterial({ color: 0x3a3a3a, wireframe: true }), -.75, .68, 6.6, dress, false); void net;
      // far bank, kampung on stilts with lit windows, palms, hills
      const bankC = id === 'sungai' ? 0x2c3a2a : 0x3c6a48; K.box(260, 1.4, 50, K.mat(bankC, { roughness: 1 }), 0, -.35, -84, dress, false);
      const walls = [0xc48a58, 0x9fb7a6, 0xd9c29a, 0xb98a6a, 0x8fa9b8], roofs = [0x8a3f2c, 0x6b3a2a, 0x9d4a33];
      const HM = { walls: [woodMat(0xc9935f, 3, 2), woodMat(0xa9bfae, 3, 2), woodMat(0xe0c79c, 3, 2), woodMat(0x9a6f4c, 3, 2)], roofs: [roofM(0xb0563c), roofM(0x8a4a38), roofM(0x6f5a4c)], trim: K.mat(0xf1e6cf, { roughness: .8 }), dark, shutter: K.mat(id === 'sungai' ? 0x3e5a52 : 0x4f7a6a, { roughness: .8 }), glow: id === 'sungai' ? glowM() : K.mat(0x2b3a40, { roughness: .3, metalness: .2 }) };
      { let hx = -70; for (let i = 0; i < 6; i++) { hx += 11 + r() * 5; kampungHouse(hx, -50 - r() * 7, r, HM, i); } }
      for (let i = 0; i < 20; i++) palm2(-82 + i * 8.6 + r() * 6, -60 - r() * 13, 1.15 + r() * .75); for (const [px, pz] of [[-13, 9], [-15.5, 2], [9, 11]]) palm2(px, pz, 1.2 + r() * .3);
      const hillM = K.mat(id === 'sungai' ? 0x4a4460 : 0x5f8a80, { roughness: 1 });
      for (let i = 0; i < 7; i++) { const h = K.mesh(new T.SphereGeometry(16 + r() * 12, 14, 8), hillM, -90 + i * 30 + r() * 8, -5, -112 - r() * 14, dress, false); h.scale.y = .38 + r() * .3; }
      boatAt(10, -24, .5, 4.6); boatAt(-13, -32, -1.1, 4, 0xe74c3c); boatAt(20, -46, 1.9, 5, 0x27ae60);
      if (id === 'tasik') for (let i = 0; i < 12; i++) { const x = (r() - .5) * 34, z = -3 - r() * 16; K.cyl(.5, .5, .03, K.mat(0x3f8f4a), x, .04, z, dress, 8); if (i % 3 === 0) K.ball(.12, K.mat(STY.tasik.accent), x, .13, z, dress); }
      if (id === 'sungai') { // a lifting bridge far downriver, seen as a dusk silhouette
        const bm = K.mat(0x3a3350, { roughness: 1 }), lit = glowM(), bx = 44, bz = -104;
        K.box(70, .9, 2.4, bm, bx, 5.2, bz, dress, false); for (let k = 0; k < 9; k++) K.box(1.2, 6, 2, bm, bx - 32 + k * 8, 2.2, bz, dress, false);
        for (const tx of [bx - 8, bx + 8]) for (const tz of [bz - 1.6, bz + 1.6]) { K.box(1.8, 15, 1.8, bm, tx, 12, tz, dress, false); const c = K.mesh(new T.ConeGeometry(1.5, 4, 4), bm, tx, 21.5, tz, dress, false); c.rotation.y = Math.PI / 4; K.box(.5, .7, .1, lit, tx, 15, tz + .95, dress, false); }
        K.box(16, .7, 2, bm, bx, 14.5, bz, dress, false);
        for (let i = 0; i < 10; i++) K.cyl(.03, .03, 1.4 + r(), K.mat(0x5d8a3a), 3 + r() * 5, .5, 7 + r() * 4, dress, 4);
      }
    }
    // ---------------------------------------------------------------- coconut palms: curved tapered trunk + feathered, drooping fronds.
    // Three shape variants, drawn with instancing (2 draw calls per variant however many palms there are).
    const frondT = (() => { const c = K.canvasTex(64, 256), x = c.x, g = mulberry32(23); x.clearRect(0, 0, 64, 256);
      for (let y = 2; y < 250; y += 5) { const k = y / 256, w = 31 * Math.pow(Math.sin(Math.PI * Math.pow(k, .75)), .6), sh = 70 + Math.floor(g() * 50), len = 13 + k * 6;
        for (const s of [-1, 1]) { x.fillStyle = `rgb(${Math.floor(sh * .55)},${sh + 55},${Math.floor(sh * .5)})`; x.beginPath(); x.moveTo(32, y); x.lineTo(32 + s * w, y + len); x.lineTo(32 + s * w * .2, y + 6.2); x.lineTo(32, y + 4.4); x.fill(); } }
      x.fillStyle = '#b9c46a'; x.fillRect(31, 0, 2, 250); return c.t; })();
    const frondM = new T.MeshStandardMaterial({ map: frondT, alphaTest: .45, side: T.DoubleSide, roughness: .75 }), trunkM = new T.MeshStandardMaterial({ vertexColors: true, roughness: .92 });
    function palmGeo(seed) {
      const g = mulberry32(seed), geoOf = (P, U, I, C) => { const q = new T.BufferGeometry(); q.setAttribute('position', new T.Float32BufferAttribute(P, 3)); q.setAttribute('uv', new T.Float32BufferAttribute(U, 2)); if (C) q.setAttribute('color', new T.Float32BufferAttribute(C, 3)); q.setIndex(I); q.computeVertexNormals(); q.userData.keepGeo = true; return q; };
      const H = 5.2 + g() * 2.4, bend = .5 + g() * 1.3, RS = 7, ST = 9, P = [], U = [], I = [], C = [];
      for (let i = 0; i <= ST; i++) { const t = i / ST, y = t * H, cx = bend * t * t, rad = .26 * (1 - t * .58) + (i === 0 ? .1 : 0), sh = i % 2 ? .8 : 1; for (let k = 0; k <= RS; k++) { const a = k / RS * 6.2832; P.push(cx + Math.cos(a) * rad, y, Math.sin(a) * rad); U.push(k / RS, t * 6); C.push(.5 * sh, .4 * sh, .3 * sh); } }
      for (let i = 0; i < ST; i++) for (let k = 0; k < RS; k++) { const a = i * (RS + 1) + k, b = a + RS + 1; I.push(a, b, a + 1, a + 1, b, b + 1); }
      for (let n = 0; n < 4; n++) { const a0 = n * 1.7 + g(), ox = bend + Math.cos(a0) * .26, oz = Math.sin(a0) * .26, oy = H - .28, base = P.length / 3, R2 = .17; // coconuts (octahedra)
        for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) { P.push(ox + dx * R2, oy + dy * R2, oz + dz * R2); U.push(0, 0); C.push(.35, .42, .16); }
        for (const [a, b, c2] of [[0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0], [4, 3, 0], [1, 3, 4], [5, 3, 1], [0, 3, 5]]) I.push(base + a, base + b, base + c2); }
      const trunk = geoOf(P, U, I, C), FP = [], FU = [], FI = [], nF = 11 + Math.floor(g() * 3), SEG = 7;
      for (let f = 0; f < nF; f++) { const yaw = f / nF * 6.2832 + g() * .5, lift = [.62, .2, -.22][f % 3] + (g() - .5) * .28, L = 2.7 + g() * 1, W = .5 + g() * .14, cs = Math.cos(yaw), sn = Math.sin(yaw), base = FP.length / 3;
        for (let i = 0; i <= SEG; i++) { const t = i / SEG, rr = Math.cos(lift) * t * L * (1 - .12 * t), yy = Math.sin(lift) * t * L - .44 * t * t * L, e = -.16 * W - .1 * W * t;
          for (const s of [-1, 0, 1]) { const lx = s * W, ly = yy + (s ? e : 0); FP.push(bend + lx * cs + rr * sn, H - .05 + ly, -lx * sn + rr * cs); FU.push(.5 + s * .5, 1 - t); } }
        for (let i = 0; i < SEG; i++) { const a = base + i * 3; FI.push(a, a + 1, a + 4, a, a + 4, a + 3, a + 1, a + 2, a + 5, a + 1, a + 5, a + 4); } }
      return { trunk, frond: geoOf(FP, FU, FI, null) };
    }
    const PALMS = [palmGeo(31), palmGeo(47), palmGeo(59)]; let palmList = [];
    const palm2 = (x, z, s = 1) => palmList.push([x, z, s]);
    function flushPalms(r) {
      const m4 = new T.Matrix4(), q = new T.Quaternion(), pv = v3(), sv = v3();
      for (let v = 0; v < 3; v++) { const L = palmList.filter((_, i) => i % 3 === v); if (!L.length) continue;
        for (const [geo, mat] of [[PALMS[v].trunk, trunkM], [PALMS[v].frond, frondM]]) { const im = new T.InstancedMesh(geo, mat, L.length); im.castShadow = true; im.receiveShadow = false; im.frustumCulled = false;
          L.forEach(([x, z, s], i) => { const rr = mulberry32(Math.floor(x * 13 + z * 7 + 99))(); q.setFromAxisAngle(UP, rr * 6.2832); pv.set(x, -.15, z); sv.set(s, s * (.9 + rr * .25), s); im.setMatrixAt(i, m4.compose(pv, q, sv)); }); im.instanceMatrix.needsUpdate = true; dress.add(im); } }
      palmList = []; void r;
    }
    // ---------------------------------------------------------------- kampung house on stilts: steep gable roof with barge boards (papan pemeleh),
    // serambi with railing and stairs, shuttered windows, optional kitchen annex (rumah dapur). Built from shared materials, then merged.
    function gableRoof(parent, mat, w, halfD, rh, x, y, z) { const gq2 = new T.CylinderGeometry(1, 1, w, 3, 1); gq2.rotateZ(Math.PI / 2); gq2.rotateX(-Math.PI / 2); gq2.scale(1, rh / 1.5, halfD / .866); return K.mesh(gq2, mat, x, y + rh / 3, z, parent); }
    function kampungHouse(x, z, r, HM, i) {
      const g = K.group(x, 0, z, dress); g.rotation.y = (r() - .5) * .22; const w = 7.5 + r() * 3.5, d = 5.6 + r() * 1, st = 1.5 + r() * .5, h = 2.9 + r() * .3, wallM = HM.walls[i % HM.walls.length], roofMt = HM.roofs[i % HM.roofs.length], trim = HM.trim, dark = HM.dark, top = st + h, rh = 2.3 + r() * .6, hd = d / 2 + .8;
      for (let px = 0; px < 4; px++) for (const pz of [-d / 2 + .3, d / 2 - .3]) K.cyl(.13, .15, st, dark, -w / 2 + .35 + px * (w - .7) / 3, st / 2, pz, g, 6);
      K.box(w + .5, .22, d + .5, dark, 0, st, 0, g); K.box(w, h, d, wallM, 0, st + h / 2 + .1, 0, g);
      gableRoof(g, roofMt, w + 1.5, hd, rh, 0, top + .1, 0);
      const sl = Math.hypot(hd, rh), ang = Math.atan2(rh, hd); for (const ex of [-(w + 1.5) / 2, (w + 1.5) / 2]) for (const s of [-1, 1]) { const b = K.box(.1, .22, sl + .25, trim, ex, top + .12 + rh / 2, s * hd / 2, g); b.rotation.x = s * ang; }
      for (const ex of [-(w + 1.5) / 2, (w + 1.5) / 2]) K.box(.12, .7, .12, trim, ex, top + rh + .35, 0, g);
      const nW = w > 9.5 ? 3 : 2, door = (r() < .5 ? -1 : 1) * w * .28;
      for (let k = 0; k < nW; k++) { const wx = -w / 2 + (k + .8) * w / (nW + .6); if (Math.abs(wx - door) < 1.3) continue; K.box(1.3, 1.45, .08, trim, wx, st + h * .56, d / 2 + .02, g); K.box(1.05, 1.2, .06, HM.glow, wx, st + h * .56, d / 2 + .06, g, false); for (const s of [-1, 1]) { const sh = K.box(.5, 1.2, .05, HM.shutter, wx + s * .78, st + h * .56, d / 2 + .16, g); sh.rotation.y = s * .5; } K.box(1.4, .08, .22, dark, wx, st + h * .56 - .78, d / 2 + .1, g); }
      K.box(1.25, 2.15, .08, trim, door, st + 1.2, d / 2 + .02, g); K.box(1.02, 1.95, .08, HM.shutter, door, st + 1.12, d / 2 + .06, g);
      // serambi + stairs
      const sw = w * .62, sx = door * .6; K.box(sw, .18, 2.1, dark, sx, st, d / 2 + 1.05, g); for (const px of [-sw / 2 + .12, sw / 2 - .12]) { K.cyl(.09, .1, st, dark, sx + px, st / 2, d / 2 + 1.95, g, 6); K.cyl(.07, .07, 2.3, dark, sx + px, st + 1.15, d / 2 + 1.95, g, 6); }
      K.box(sw, .08, .08, trim, sx, st + .95, d / 2 + 2.02, g); for (let k = 0; k < 7; k++) { const bx = sx - sw / 2 + .3 + k * (sw - .6) / 6; if (Math.abs(bx - door) < .7) continue; K.box(.06, .9, .06, trim, bx, st + .5, d / 2 + 2.02, g); }
      const lean = K.box(sw + .5, .1, 2.6, roofMt, sx, st + 2.45, d / 2 + 1.15, g); lean.rotation.x = .28;
      for (let k = 0; k < 4; k++) K.box(1.1, .12, .34, dark, door, st - .2 - k * (st / 4.4), d / 2 + 2.3 + k * .34, g);
      if (i % 3 !== 1) { const aw = w * .45, ad = d * .7, ax = (i % 2 ? 1 : -1) * (w / 2 + aw / 2 - .1), ah = h * .82; // rumah dapur
        for (const pz of [-ad / 2 + .25, ad / 2 - .25]) K.cyl(.12, .14, st, dark, ax + (i % 2 ? 1 : -1) * (aw / 2 - .3), st / 2, pz - .6, g, 6);
        K.box(aw, ah, ad, HM.walls[(i + 1) % HM.walls.length], ax, st + ah / 2 + .1, -.6, g); gableRoof(g, HM.roofs[(i + 1) % HM.roofs.length], aw + 1, ad / 2 + .6, rh * .7, ax, st + ah + .1, -.6);
        K.box(.95, 1.1, .08, trim, ax, st + ah * .58, ad / 2 - .58, g); K.box(.75, .9, .06, HM.glow, ax, st + ah * .58, ad / 2 - .54, g, false); }
      return g;
    }
    // merge the static dressing into one mesh per material (hundreds of draw calls -> a few dozen)
    function mergeStatic(root) {
      root.updateMatrixWorld(true); const by = new Map(), gone = [];
      root.traverse((o) => { if (!o.isMesh || o.isInstancedMesh || !o.geometry || isShared(o.geometry) || Array.isArray(o.material)) return; const a = o.geometry.attributes; if (!a.position || !a.normal || !a.uv) return;
        for (let q = o.parent; q; q = q.parent) if (q === boatBob || q.userData.keep) return; let L = by.get(o.material); if (!L) by.set(o.material, L = []); L.push(o); });
      for (const [mat, list] of by) { if (list.length < 2) continue; let n = 0; const parts = list.map((o) => { const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); g.applyMatrix4(o.matrixWorld); n += g.attributes.position.count; return g; });
        const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2); let k = 0;
        for (const g of parts) { P.set(g.attributes.position.array, k * 3); N.set(g.attributes.normal.array, k * 3); U.set(g.attributes.uv.array, k * 2); k += g.attributes.position.count; g.dispose(); }
        const mg = new T.BufferGeometry(); mg.setAttribute('position', new T.BufferAttribute(P, 3)); mg.setAttribute('normal', new T.BufferAttribute(N, 3)); mg.setAttribute('uv', new T.BufferAttribute(U, 2));
        const m = new T.Mesh(mg, mat); m.castShadow = list.some((o) => o.castShadow); m.receiveShadow = true; m.userData.merged = true; gone.push(...list); root.add(m); }
      for (const o of gone) { o.parent && o.parent.remove(o); o.geometry.dispose(); }
    }
    function buildSpot(id) {
      clearDress(); spot = R.spotById(id); const st = STY[id], r = mulberry32(id.length * 977 + 5); dress = new T.Group(); scene.add(dress);
      scene.background.set(st.bot); scene.fog.color.set(st.bot); setSky(st.top, st.bot); waterM.color.set(st.water); waterM.opacity = st.op; if (ocean) { cA.set(st.water); ocean.uniforms.uShallow.value.copy(cA).lerp(cB.set(st.bot), .1); ocean.uniforms.uDeep.value.copy(cA).multiplyScalar(.42); ocean.mat.roughness = .34; ocean.mat.metalness = 0; ocean.mat.envMapIntensity = .35; ocean.mat.normalScale.set(.42, .42); ocean.uniforms.uSky.value.copy(cA).lerp(cB, id === 'tasik' || id === 'sungai' ? .38 : .6); ocean.uniforms.uAmp.value = id === 'dalam' ? .26 : id === 'terumbu' ? .15 : id === 'sungai' ? .07 : .05; ocean.mat.opacity = Math.max(st.op, .8); ocean.mat.transparent = true; }
      sun.color.set(st.sunC); sun.intensity = st.sunI; updateEnv(); if (hemi) { hemi.intensity = st.hemiI * (scene.environment ? .62 : 1); hemi.color.set(st.hemiC); }
      for (const c of clouds) c.material.color.set(st.cloud || 0xffffff);
      const lowSun = !!st.sunAt; sunDisc.visible = sunGlow.visible = glitterG.visible = lowSun; lamp.intensity = st.lamp || 0;
      if (lowSun) { const [sx, sy] = st.sunAt; sunDisc.scale.setScalar(sy > 16 ? .42 : .62); sunGlow.scale.setScalar(sy > 16 ? .7 : 1); sunGlow.material.opacity = sy > 16 ? .5 : .75; sunDisc.position.set(sx, sy, -150); sunGlow.position.set(sx, sy, -151); sunDisc.material.color.set(st.discC); sunGlow.material.color.set(st.sunC); glitter.material.color.set(st.sunC);
        sun.position.set(sx * .35, 8, -26); sun.target.position.set(0, 0, 5); glitterG.position.set(sx * .5 - 1, .09, -52); glitterG.rotation.y = -Math.atan2(sx + 2, 120); }
      else { sun.position.set(-8, 16, 10); sun.target.position.set(0, 0, 0); }
      const onBoat = id === 'terumbu' || id === 'dalam'; let deck = .85;
      if (!onBoat) kampung(id, r);
      else { // fishing boat, side-on: wheelhouse to the left, open deck under the angler
        boatBob = K.group(-.6, 0, 4.6, dress);
        const hull = putModel(M, 'fboat', boatBob, 0, 0, { scale: 1, ry: Math.PI / 2, y: -.45 });
        if (!hull) { K.box(6.6, 1, 2.6, K.mat(0xf4f1e6), 0, .2, 0, boatBob); K.box(6.7, .2, 2.7, K.mat(0x2e86de), 0, .75, 0, boatBob); }
        else if (T.Raycaster) { boatBob.updateMatrixWorld(true); const h = new T.Raycaster(v3(1.3, 12, 4.6), v3(0, -1, 0)).intersectObject(hull, true).find((x) => x.point.y > .1 && x.point.y < 2.2); if (h) deck = h.point.y; }
        const hills = K.mat(st.ground, { roughness: 1 });
        for (let i = 0; i < 6; i++) { const h = K.mesh(new T.SphereGeometry(14 + r() * 10, 14, 8), hills, -80 + i * 32 + r() * 8, -5, -120 - r() * 14, dress, false); h.scale.y = .4 + r() * .3; }
      }
      const ax = onBoat ? 1.3 : .2, ay = onBoat ? deck : .45, az = onBoat ? 4.6 : 4.4; let hero = null; try { hero = makeHero ? (makeHero(K, M, 1.5, 1.2) || {}).g || null : null; } catch { hero = null; }
      if (hero) { anglerG = K.group(ax, ay, az, dress); hero.rotation.y = Math.PI; hero.userData.keep = true; anglerG.add(hero); hero.traverse((o) => { if (o.isMesh) o.castShadow = true; }); ROD0.set(ax, ay + .9, az - .3); }
      else { anglerG = makeAngler(dress, ax, ay, az); ROD0.set(ax + .12, ay + .96, az - .52); }
      if (id === 'terumbu') {
        K.box(90, .2, 60, K.mat(st.ground, { roughness: 1 }), 0, -3.2, -20, dress, false);
        const C = ['sea/karang_cabang', 'sea/karang_otak', 'sea/kipas_laut', 'sea/batu_laut'];
        for (let k = 0; k < 16; k++) { const x = (r() - .5) * 26, z = -2 - r() * 22, key = C[k % 4], o = putModel(M, key, dress, x, z, { h: .8 + r() * 1.2, ry: r() * 6, y: -3.1 }); if (!o) K.mesh(new T.IcosahedronGeometry(.5 + r() * .5, 0), K.mat([0xff7a59, 0xf6c445, 0xb36bd4, 0x7f8c8d][k % 4]), x, -2.8, z, dress, false); }
        const isl = K.mesh(new T.SphereGeometry(12, 14, 8), K.mat(0xefdcaa, { roughness: 1 }), 30, -4, -44, dress, false); isl.scale.y = .42; for (let i = 0; i < 7; i++) palm2(23 + r() * 14, -41 - r() * 7, .9 + r() * .5);
      } else if (id === 'dalam') {
        const isl = K.mesh(new T.SphereGeometry(7, 14, 8), K.mat(0x4f9a43, { roughness: 1 }), 26, -3.6, -48, dress, false); isl.scale.y = .6; palm2(26, -48, 1.1); palm2(23.5, -47, .85); palm2(28.5, -49.5, .95);
        const b = K.group(-7, 0, -14, dress); K.cyl(.35, .45, 1, K.mat(0xe74c3c), 0, .3, 0, b, 10); K.cyl(.04, .04, 1.6, K.mat(0x333333), 0, 1.4, 0, b, 6); boatAt(-22, -40, .8, 5, 0xf1c40f);
      }
      flushPalms(r); mergeStatic(dress);
      F.depth = R.clampDepth(id, kail.depth);
    }

    // rod (two bendable segments), line, bobber, fish shadow, caught-fish holder
    const RSEG = 5, RLEN = .56, rodSegs = Array.from({ length: RSEG }, (_, i) => K.mesh(new T.CylinderGeometry(.045 - (i + 1) * .007, .045 - i * .007, 1, 6), K.mat(i < 2 ? 0x26262b : 0xd8a24a, { roughness: .5 }), 0, 0, 0, scene, false)), rodPts = Array.from({ length: RSEG + 1 }, () => v3());
    const reel = K.mesh(new T.CylinderGeometry(.07, .07, .09, 10), K.mat(0x9aa5ab, { metalness: .7, roughness: .3 }), 0, 0, 0, scene, false); reel.rotation.z = Math.PI / 2;
    const ROD0 = v3(.3, 1.4, 3.9), LINE_N = 14, linePts = Array.from({ length: LINE_N }, () => v3()), lineGeo = new T.BufferGeometry().setFromPoints(linePts);
    const line = new T.Line(lineGeo, new T.LineBasicMaterial({ color: 0xf5f5f5 })); line.frustumCulled = false; scene.add(line);
    const bobber = K.group(0, 0, -6, scene); K.ball(.12, K.mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: .5 }), 0, 0, 0, bobber); K.cyl(.0, .12, .16, K.mat(0xff3b2f, { emissive: 0xff2a1a, emissiveIntensity: .9 }), 0, .1, 0, bobber, 8); bobber.children[0].castShadow = false;
    const shadow = new T.Mesh(new T.CircleGeometry(.5, 20), new T.MeshBasicMaterial({ color: 0x06141c, transparent: true, opacity: .4, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.visible = false; scene.add(shadow);
    const holder = K.group(0, 0, 0, scene); holder.visible = false; let heldObj = null, heldId = '';
    function showFish(f, kg) {
      if (heldId === f.id && heldObj) return; if (heldObj) holder.remove(heldObj); heldId = f.id;
      const len = clamp(.32 + Math.cbrt(kg) * .42, .3, 1.5); heldObj = putModel(M, f.model, holder, 0, 0, { len });
      if (heldObj) { try { skinFish(heldObj, f.id); } catch { } } else { heldObj = K.mesh(new T.SphereGeometry(.2, 12, 8), K.mat(0xc9d2d6), 0, 0, 0, holder, false); heldObj.scale.set(2.2, 1, .8); }
    }

    // tackle shop (built on first visit, far from the water so the camera can fly there)
    let shop = null; const SHOP_X = 90;
    function buildShop() {
      shop = new T.Group(); shop.position.set(SHOP_X, 0, 0); scene.add(shop); shop.items = [];
      K.box(30, .2, 12, K.mat(0xd9c9a3, { roughness: 1 }), 9, -.1, 0, shop, false); K.box(30, 4.5, .3, K.mat(0x7f6a52), 9, 2.2, -2.2, shop, false);
      for (let s = 0; s < R.TACKLE_KEYS.length; s++) {
        const slot = R.TACKLE_KEYS[s]; K.box(7, .18, 1.6, K.mat(0x8a6a4a), s * 6, 1, 0, shop); const row = [];
        for (let t = 0; t < 3; t++) {
          const m = new T.MeshStandardMaterial({ color: 0xffffff, roughness: .5, emissive: 0x000000 }), g = K.group(s * 6 - 2 + t * 2, 1.1, 0, shop); let col;
          if (slot === 'rod') { col = [0x8a5a2b, 0x2a9d8f, 0x222831][t]; m.color.setHex(col); const c = K.mesh(new T.CylinderGeometry(.03, .06, 2.2 + t * .3, 6), m, 0, 1.3, 0, g, false); c.rotation.z = .35; K.ball(.14 + t * .02, m, .1, .25, .1, g); }
          else if (slot === 'line') { col = [0xf2f2f2, 0xf39c12, 0x74b9ff][t]; m.color.setHex(col); K.cyl(.34, .34, .3 + t * .1, m, 0, .22, 0, g, 14); K.cyl(.1, .1, .5, K.mat(0x555555), 0, .22, 0, g, 6); }
          else if (slot === 'hook') { col = [0x9aa5ab, 0xcfd8dc, 0xffd452][t]; m.color.setHex(col); m.metalness = .8; m.roughness = .25; const h = K.mesh(new T.TorusGeometry(.28 + t * .05, .045, 8, 18, Math.PI * 1.4), m, 0, .45, 0, g, false); h.rotation.z = 2.2; K.cyl(.03, .03, .45, m, .22, .8, 0, g, 6); }
          else { col = [0xe74c3c, 0x2e86de, 0x27ae60][t]; m.color.setHex(col); K.box(.9 + t * .35, .6 + t * .2, .6 + t * .2, m, 0, .3 + t * .1, 0, g); K.box(.95 + t * .35, .12, .65 + t * .2, K.mat(0xf2f2f2), 0, .65 + t * .2, 0, g); }
          row.push({ g, m }); } shop.items.push(row); }
    }

    // ---------------------------------------------------------------- state
    const F = { st: 'idle', ui: null, t: 0, wait: 0, nib: false, ringT: 0, sp: null, kg: 0, fight: null, reeling: false, strikeRes: '', catch: null, depth: kail.depth, msgT: 0, landed: [], sold: 0, shelf: 0, camMode: 'play', spooked: 0, hit: 0 };
    const view = { pos: v3(2.2, 2.35, 9.2), look: v3(-.2, 1.35, -9), halfW: 12, halfH: 8.8, speed: 3 };
    const ctx = () => ({ spot: spot.id, depth: F.depth, bait: kail.bait, hour, weather });

    // ---------------------------------------------------------------- HUD
    const root = document.createElement('div'); root.className = 'f3 kl';
    root.innerHTML = `
      <div class="klTop"><span class="chip c-spot"></span><span class="chip c-time"></span><span class="chip c-rm"></span><span class="chip c-cool"></span></div>
      <button class="f3Pause klMenu" aria-label="Menu">☰</button>
      <div class="klRing" hidden><i></i><b></b></div>
      <div class="klFight" hidden><div class="tbar"><b></b><i class="l1"></i><i class="l2"></i></div><div class="finfo"></div><div class="sbar"><b></b></div></div>
      <canvas class="klUw" width="132" height="168"></canvas>
      <div class="f3Msg"></div>
      <div class="klCtl"><div class="klSet"><div class="klDepth"><button data-a="d-" aria-label="Lebih cetek">−</button><span></span><button data-a="d+" aria-label="Lebih dalam">+</button></div><button class="klBait" data-a="bait"></button><div class="klHint"></div></div><button class="klAct" data-a="act"></button></div>
      <div class="klPanel" hidden></div>`;
    $('game').append(root); $('game').classList.add('f3mode');
    const q = (s) => root.querySelector(s), panel = q('.klPanel'), act = q('.klAct'), msgEl = q('.f3Msg'), uw = q('.klUw'), ux = uw.getContext('2d');
    const ring = q('.klRing'), fightBox = q('.klFight'), tbar = fightBox.querySelector('.tbar b'), sbar = fightBox.querySelector('.sbar b');
    let msgTimer = 0;
    function say(bm, en = '', ms = 1800) { msgEl.innerHTML = `${bm}${en ? `<small>${en}</small>` : ''}`; msgEl.classList.add('show'); clearTimeout(msgTimer); msgTimer = setTimeout(() => msgEl.classList.remove('show'), ms); }
    function chips() {
      q('.c-spot').textContent = `📍 ${spot.bm}`; q('.c-time').textContent = `${WX[weather].ic} ${WX[weather].bm} · ${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.floor((hour % 1) * 60)).padStart(2, '0')}`;
      q('.c-rm').textContent = practice ? '🎓 Latihan' : `💵 ${fmtRM(balance())}`; q('.c-cool').textContent = `🧊 ${kail.cooler.length}/${stats.cap}`;
    }
    function controls() {
      const can = R.biteWeights(ctx()).length, bt = R.BAITS[kail.bait];
      q('.klDepth span').textContent = `${F.depth} m`; q('.klBait').innerHTML = `${bt.bm}<small>${R.BAIT_COST[kail.bait] ? `RM${R.BAIT_COST[kail.bait]}` : 'percuma'}</small>`;
      q('.klHint').textContent = can ? `${can} spesies boleh gigit` : 'Tiada ikan di sini — ubah dalam/umpan';
      q('.klSet').classList.toggle('lock', F.st !== 'idle');
      const L = { idle: ['LABUH', 'Cast'], wait: ['ANGKAT', 'Lift'], strike: ['SENTAP!', 'Strike'], fight: ['KARAU', 'Hold to reel'], catch: ['', ''] }[F.st] || ['', ''];
      act.innerHTML = L[0] ? `${L[0]}<small>${L[1]}</small>` : ''; act.hidden = !L[0] || !!F.ui; act.classList.toggle('flash', F.st === 'strike' || (F.st === 'wait' && F.nib));
    }

    // ---------------------------------------------------------------- panels
    function openPanel(html, cls = '') { panel.className = `klPanel ${cls}`; panel.innerHTML = html; panel.hidden = false; F.ui = cls || 'panel'; root.classList.add('busy'); controls(); }
    function closePanel() { panel.hidden = true; F.ui = null; root.classList.remove('busy'); F.camMode = F.st === 'catch' ? 'catch' : 'play'; controls(); }
    const bi = (bm, en) => `${bm} <small>${en}</small>`;
    function menuPanel() {
      openPanel(`<div class="card"><h2>Jelajah Kail <small>Fishing journey</small></h2><p class="muted">${bi(spot.bm, spot.en)}</p>
        <button data-a="map">🗺️ ${bi('Peta tempat', 'Map')}</button><button data-a="shop">🛒 ${bi('Kedai kelengkapan', 'Tackle shop')}</button><button data-a="log">📖 ${bi('Log spesies', 'Species log')}</button>
        <button data-a="sell">💰 ${bi(`Jual penyejuk (${kail.cooler.length})`, 'Sell cooler')}</button><button data-a="gfx">🎨 ${bi(`Grafik: ${GFX[gq].bm}`, `Graphics: ${GFX[gq].en}`)}</button><button data-a="exit">🚪 ${bi('Keluar', 'Leave')}</button><button class="primary" data-a="close">${bi('Sambung', 'Resume')}</button></div>`);
    }
    function mapPanel() {
      const open = R.unlockedSpots(kail), cards = R.SPOTS.map((s) => {
        const ok = open.includes(s.id) || kail.spots[s.id], prev = s.from ? R.spotById(s.from) : null, n = prev ? R.speciesInSpot(kail, prev.id) : 0;
        return `<div class="spot ${ok ? '' : 'lock'} ${s.id === spot.id ? 'here' : ''}"><b>${s.bm}</b><small>${s.en} · ${s.water === 'tawar' ? 'air tawar' : 'air masin'} · maks ${s.maxDepth} m</small>
          ${ok ? `<button data-a="go" data-id="${s.id}">${s.id === spot.id ? 'Di sini' : 'Pergi · Go'}</button>` : `<em>🔒 Tangkap ${s.need} spesies di ${prev.bm} (${n}/${s.need})</em>`}</div>`; }).join('');
      openPanel(`<div class="card wide"><h2>Peta <small>Map</small></h2><div class="spots">${cards}</div><button class="primary" data-a="menu">${bi('Kembali', 'Back')}</button></div>`);
    }
    function logPanel() {
      const body = R.SPOTS.map((s) => `<h3>${s.bm} <small>${R.speciesInSpot(kail, s.id)}/${R.fishAt(s.id).length}</small></h3><ul>${R.fishAt(s.id).map((f) => { const e = kail.log[f.id], got = e && e.spots && e.spots[s.id]; return `<li class="${got ? 'got' : ''}"><b style="color:${RARITY[f.rar].col}">${'★'.repeat(RARITY[f.rar].stars)}</b> ${got ? `${f.bm} <small>×${e.n} · rekod ${fmtKg(e.max)}</small>` : '???'}</li>`; }).join('')}</ul>`).join('');
      openPanel(`<div class="card wide"><h2>Log spesies <small>Species log</small></h2><p class="muted">⭐ ${kail.points} mata kedudukan · ${kail.caught} tangkapan</p><div class="logs">${body}</div><button class="primary" data-a="menu">${bi('Kembali', 'Back')}</button></div>`);
    }
    function shopPanel() {
      const slot = R.TACKLE_KEYS[F.shelf], cur = kail.tackle[slot], nx = R.nextTier(kail, slot), c = R.TACKLE[slot][cur];
      const det = (it) => ('line' in it && 'reel' in it ? `tali ${it.line}${slot === 'rod' ? ` · gulung ×${it.reel}` : ''}` : 'mul' in it ? `kekuatan ×${it.mul}` : 'ring' in it ? `tetingkap sentap ×${it.ring}` : `muat ${it.cap} ekor`);
      openPanel(`<div class="shopBar"><button data-a="shelf" data-d="-1">◀</button><div><b>${ITEM_NAME[slot]}</b> <small>rak ${F.shelf + 1}/4</small><br>Ada: <b>${c.bm}</b> <small>${det(c)}</small>
        ${nx ? `<br>Seterusnya: <b>${nx.bm}</b> <small>${det(nx)}</small>` : '<br><b>Tahap tertinggi ✓</b>'}</div>
        ${nx ? `<button class="primary" data-a="buy">Beli RM${nx.price}</button>` : ''}<button data-a="shelf" data-d="1">▶</button><button data-a="menu">✕</button></div>`, 'shop');
      F.camMode = 'shop'; if (!shop) buildShop();
    }
    function cardPanel() {
      const c = F.catch, rr = RARITY[c.f.rar], rm = R.sellValue(c.f, c.kg, spot.id), full = R.coolerFree(kail) <= 0;
      openPanel(`<div class="card catchCard"><div class="tags">${c.isNew ? '<span class="tag n">BARU · NEW</span>' : ''}${c.record ? '<span class="tag r">REKOD</span>' : ''}</div>
        <h2>${c.f.bm}</h2><p class="muted">${c.f.en}</p><p><b style="color:${rr.col}">${'★'.repeat(rr.stars)}</b> ${rr.bm}</p>
        <p>📏 ${R.lengthCm(c.f, c.kg)} cm · ⚖️ ${fmtKg(c.kg)}</p><p class="reward">💵 ~RM${rm}</p>
        <button class="primary" data-a="keep" ${full ? 'disabled' : ''}>🧊 ${bi('Simpan', `Keep (${kail.cooler.length}/${stats.cap})`)}</button>
        <button data-a="release">🌊 ${bi('Lepas', `+${R.releasePoints(c.f, c.kg)} mata`)}</button>${full ? `<button data-a="sellkeep">💰 ${bi('Jual penyejuk dahulu', 'Sell cooler first')}</button>` : ''}</div>`, 'catch');
      F.camMode = 'catch';
    }

    // ---------------------------------------------------------------- actions
    function sellCooler() {
      if (!kail.cooler.length) return say('Penyejuk kosong', 'Cooler is empty', 1400);
      const n = kail.cooler.length, rm = R.sellCooler(kail); let pay = 0, capped = false;
      if (!practice) { const p = R.payout(kail, today(), rm); pay = p.pay; capped = p.capped; if (pay > 0) earn(pay, 'jual ikan kail'); F.sold += pay; save(); }
      F.landed.forEach((l) => { if (l.kept) l.kept = false; });
      say(practice ? `${n} ekor dijual (latihan)` : `+${fmtRM(pay)} 💰`, capped ? 'Had harian — harga turun · daily limit, lower price' : `${n} fish sold`, 2400); chips();
    }
    function cast() {
      const cost = R.BAIT_COST[kail.bait];
      if (!R.biteWeights(ctx()).length) return say('Tiada ikan di sini', 'Change depth or bait', 1800);
      if (!practice && cost > 0) { const r = spend(cost, 'umpan kail'); if (!r.ok) return say('Duit tak cukup', 'Not enough RM — try the lure', 1800); }
      const c = ctx(); F.sp = R.pickBite(rng, c); F.kg = R.rollWeight(rng, F.sp); F.wait = R.biteDelay(rng, c); F.nib = false; F.st = 'wait'; F.spooked = 0;
      kail.depth = F.depth; sfx.splash(); const st = STY[spot.id]; ripple(st.cast[0], st.cast[1]); bobber.position.set(st.cast[0], 0, st.cast[1]); for (let i = 0; i < 10; i++) splash.add(st.cast[0], .05, st.cast[1], (rng() - .5) * 1.6, 1.5 + rng() * 1.5, (rng() - .5) * 1.6, .6);
      controls(); chips();
    }
    function lift() { F.st = 'idle'; F.nib = false; controls(); }
    function spook(why) {
      sfx.bad(); if (rng() < .4) { say('Umpan hilang!', 'The bait is gone', 1600); F.st = 'idle'; F.nib = false; } else { say(why, 'The fish got scared', 1500); F.wait = Math.max(F.wait, 0) + 3; F.nib = false; F.st = 'wait'; }
      controls();
    }
    function strike() {
      if (F.st === 'wait') return spook('Terlalu awal!');
      if (F.st !== 'strike') return;
      const j = R.judgeStrike(F.ringT, stats.ring); ring.hidden = true;
      if (j === 'early') { F.st = 'wait'; return spook('Terlalu awal!'); }
      F.strikeRes = j; F.fight = R.startFight(rng, F.sp, F.kg, j, stats); F.st = 'fight'; F.reeling = false; sfx.snap(); F.camMode = 'fight';
      say(j === 'perfect' ? 'TEPAT! 🎯' : 'Kena! 🎣', j === 'perfect' ? 'Perfect strike' : 'Hooked', 1200); controls();
    }
    function endFight(kind) {
      fightBox.hidden = true; shadow.visible = false; F.reeling = false; F.camMode = 'play';
      if (kind === 'snapped') { sfx.snap(); say('Tali putus! 💥', 'Line snapped — raise tackle or reel gently', 2200); F.st = 'idle'; }
      else if (kind === 'escaped') { sfx.bad(); say('Ikan terlepas', 'It got away — keep the line tight', 2000); F.st = 'idle'; }
      else land();
      controls(); chips();
    }
    function land() {
      const f = R.fishById(F.fight.fish), kg = F.fight.kg, res = R.logCatch(kail, f, kg, spot.id);
      if (!practice) { const lg = (S.fishLog ||= {}), e = lg[f.id]; lg[f.id] = { n: (e ? e.n : 0) + 1, max: Math.max(e ? e.max : 0, kg) }; }
      F.catch = { f, kg, ...res }; F.st = 'catch'; sfx.good(); showFish(f, kg); holder.visible = true;
      if (res.unlocked.length) { const s = R.spotById(res.unlocked[0]); setTimeout(() => say(`Tempat baru: ${s.bm}! 🗺️`, 'New spot unlocked', 2600), 700); }
      if (!practice) save(); cardPanel();
    }
    function finishCatch(kept) {
      const c = F.catch; F.landed.push({ id: c.f.id, bm: c.f.bm, kg: c.kg, rm: kept ? R.sellValue(c.f, c.kg, spot.id) : 0, rar: c.f.rar, kept });
      holder.visible = false; F.catch = null; F.st = 'idle'; closePanel(); chips(); if (!practice) save();
    }
    function exit() {
      const kg = F.landed.reduce((a, f) => a + f.kg, 0);
      api.finish({ stars: F.landed.length >= 5 ? 3 : F.landed.length >= 2 ? 2 : F.landed.length ? 1 : 0, caught: F.landed.length, kg, sold: F.sold, res: F.landed.length ? 'ok' : 'quit', fish: F.landed.map((f) => ({ id: f.id, bm: f.bm, kg: f.kg, rm: f.rm, rar: f.rar })) });
    }
    function doAction(a, d = {}) {
      sfx.tap();
      if (a === 'act') { if (F.st === 'idle') cast(); else if (F.st === 'wait' && !F.nib) lift(); else strike(); }
      else if (a === 'd-' || a === 'd+') { if (F.st !== 'idle') return; F.depth = R.clampDepth(spot.id, F.depth + (a === 'd+' ? 1 : -1) * R.depthStep(spot.id)); kail.depth = F.depth; controls(); }
      else if (a === 'bait') { if (F.st !== 'idle') return; kail.bait = R.BAIT_ORDER[(R.BAIT_ORDER.indexOf(kail.bait) + 1) % R.BAIT_ORDER.length]; controls(); }
      else if (a === 'menu') { F.camMode = 'play'; menuPanel(); }
      else if (a === 'close') closePanel();
      else if (a === 'map') mapPanel(); else if (a === 'log') logPanel();
      else if (a === 'shop') { if (practice) { say('Kedai ditutup dalam latihan', 'Shop closed in practice', 1600); return; } F.shelf = 0; shopPanel(); }
      else if (a === 'shelf') { F.shelf = (F.shelf + Number(d.d) + 4) % 4; shopPanel(); }
      else if (a === 'buy') { const slot = R.TACKLE_KEYS[F.shelf], nx = R.nextTier(kail, slot); if (!nx) return; const r = spend(nx.price, `kail ${slot}`, nx.key); if (!r.ok) return say(r.reason === 'funds' ? 'Duit tak cukup' : 'Sudah dimiliki', r.reason === 'funds' ? `Need RM${r.short} more` : 'Already owned', 1800); kail.tackle[slot] = nx.tier; stats = R.tackleStats(kail); save(); sfx.good(); say(`${nx.bm} dibeli! ✓`, 'Bought', 1600); chips(); shopPanel(); }
      else if (a === 'sell') { sellCooler(); menuPanel(); }
      else if (a === 'gfx') { gq = { low: 'med', med: 'high', high: 'low' }[gq]; S.gfxQ = gq; applyGfx(); buildSpot(spot.id); if (!practice) save(); menuPanel(); }
      else if (a === 'exit') exit();
      else if (a === 'go') { if (F.st !== 'idle') lift(); kail.spot = d.id; buildSpot(d.id); for (let i = 0; i < R.BAIT_ORDER.length && !R.biteWeights(ctx()).length; i++) kail.bait = R.BAIT_ORDER[(R.BAIT_ORDER.indexOf(kail.bait) + 1) % R.BAIT_ORDER.length]; say(`📍 ${spot.bm}`, spot.en, 1800); closePanel(); chips(); }
      else if (a === 'keep') { if (R.keepFish(kail, F.catch.f, F.catch.kg, spot.id)) finishCatch(true); else say('Penyejuk penuh', 'Cooler is full', 1400); }
      else if (a === 'release') { const pts = R.releaseFish(kail, F.catch.f, F.catch.kg); if (!practice) S.spirit = Math.min(100, (S.spirit || 0) + 1); say(`Dilepaskan 🌊 +${pts} mata`, 'Released', 1500); finishCatch(false); }
      else if (a === 'sellkeep') { sellCooler(); cardPanel(); }
      controls();
    }
    root.addEventListener('click', (e) => { const b = e.target.closest('[data-a]'); if (!b || b.dataset.a === 'act' || b.disabled) return; e.stopPropagation(); doAction(b.dataset.a, b.dataset); });
    root.querySelector('.klMenu').addEventListener('click', (e) => { e.stopPropagation(); if (F.ui) return; sfx.tap(); menuPanel(); });
    act.addEventListener('pointerdown', (e) => { e.preventDefault(); if (F.st === 'fight') { F.reeling = true; } else doAction('act'); });
    const reelOff = () => { F.reeling = false; };
    act.addEventListener('pointerup', reelOff); act.addEventListener('pointerleave', reelOff); act.addEventListener('pointercancel', reelOff);
    const onKey = (e) => {
      const down = e.type === 'keydown'; if (e.repeat) return;
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'r' || e.key === 'R') { if (F.ui) return; e.preventDefault(); if (F.st === 'fight') F.reeling = down; else if (down) doAction('act'); }
      else if (down && !F.ui) { if (e.key === 'ArrowUp') doAction('d-'); else if (e.key === 'ArrowDown') doAction('d+'); else if (e.key === 'b' || e.key === 'B') doAction('bait'); else if (e.key === 'Escape') menuPanel(); }
    };
    addEventListener('keydown', onKey); addEventListener('keyup', onKey);
    const ambience = seaAmbience(); musicDuck(true);

    // ---------------------------------------------------------------- inset: what is happening under the water
    const uwFish = Array.from({ length: 6 }, (_, i) => ({ x: rng() * 132, y: rng(), v: 6 + rng() * 10, pick: i }));
    function drawUW(dt) {
      const W = 132, H = 168, st = STY[spot.id], top = 10, bot = H - 14, yOf = (d) => top + (d / spot.maxDepth) * (bot - top), hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
      const g = ux.createLinearGradient(0, 0, 0, H); g.addColorStop(0, hex(waterM.color.getHex())); g.addColorStop(1, '#06202e'); ux.fillStyle = g; ux.fillRect(0, 0, W, H);
      ux.fillStyle = 'rgba(255,255,255,.55)'; ux.fillRect(0, top - 2, W, 2); ux.fillStyle = hex(spot.id === 'terumbu' ? 0xefdcaa : 0x6b5a3c); ux.fillRect(0, bot, W, H - bot);
      const here = R.fishAt(spot.id);
      for (const u of uwFish) { u.x += u.v * dt * (u.pick % 2 ? 1 : -1); if (u.x > W + 20) u.x = -20; if (u.x < -20) u.x = W + 20; const f = here[u.pick % here.length]; if (!f) continue; const y = yOf(clamp(f.depth[0] + (f.depth[1] - f.depth[0]) * (.3 + u.y * .4), 0, spot.maxDepth)); fishShape(u.x, y, 7 + Math.min(8, f.kg[1]), RARITY[f.rar].col, u.pick % 2 ? 1 : -1, .5); }
      const bx = W / 2, by = yOf(F.depth); ux.strokeStyle = 'rgba(255,255,255,.7)'; ux.beginPath(); ux.moveTo(bx, top); ux.lineTo(bx, by); ux.stroke();
      ux.fillStyle = F.st === 'idle' ? '#bbb' : '#ffd452'; ux.beginPath(); ux.arc(bx, by, 3.5, 0, 6.3); ux.fill();
      if ((F.st === 'wait' || F.st === 'strike') && F.sp) { const k = F.st === 'strike' ? 1 : clamp(1 - F.wait / 4, 0, 1), fx = F.st === 'strike' ? bx + 9 : -10 + (bx + 9 + 10) * k + (F.nib ? Math.sin(F.t * 16) * 2 : 0); fishShape(fx, by + Math.sin(F.t * 3) * 2, 9 + Math.min(10, F.kg), RARITY[F.sp.rar].col, 1, 1); }
      if (F.st === 'fight' && F.fight) { const fx = clamp(bx + (F.fight.dist / 30) * 40 * Math.sin(F.t * 1.3), 12, W - 12), fy = clamp(by + Math.sin(F.t * 2.2) * 14, top + 6, bot - 6); fishShape(fx, fy, 10 + Math.min(10, F.kg), RARITY[R.fishById(F.fight.fish).rar].col, fx > bx ? -1 : 1, 1); }
    }
    function fishShape(x, y, s, col, dir, a) { ux.globalAlpha = a; ux.fillStyle = col; ux.beginPath(); ux.ellipse(x, y, s, s * .42, 0, 0, 6.3); ux.fill(); ux.beginPath(); ux.moveTo(x - dir * s * .8, y); ux.lineTo(x - dir * s * 1.5, y - s * .4); ux.lineTo(x - dir * s * 1.5, y + s * .4); ux.fill(); ux.globalAlpha = 1; }

    // ---------------------------------------------------------------- per-frame helpers
    const tipW = v3(), dir1 = v3(), dir2 = v3(), tmpA = v3();
    function placeSeg(m, a, b) { tmpA.copy(b).sub(a); const L = tmpA.length() || .01; m.position.copy(a).addScaledVector(tmpA, .5); m.scale.set(1, L, 1); m.quaternion.setFromUnitVectors(UP, tmpA.normalize()); }
    applyGfx(); buildSpot(spot.id); chips(); controls(); say(`📍 ${spot.bm}`, spot.en, 2200);

    return {
      scene, view,
      ray() { return null; },
      down() { if (F.ui) return; if (F.st === 'strike' || (F.st === 'wait' && F.nib)) strike(); },
      update(dt, ptr, camera) {
        dt = Math.min(dt, .05); F.t += dt; const t = F.t, amp = weather === 'hujan' ? .16 : .09;
        nrmT.offset.set(t * .012, t * .02); for (const r2 of rings) if (r2.t < 1.4) { r2.t += dt; const k = r2.t / 1.4; r2.m.scale.setScalar(.3 + k * 2.6); r2.m.material.opacity = (1 - k) * .55; if (k >= 1) r2.m.visible = false; }
        if (RD && Math.abs(RD.getPixelRatio() - wantPR) > .01) applyGfx();
        if (ocean && ocean.mesh.visible) ocean.update(t, null);
        else if (GFX[gq].waves && Math.floor(t * 30) % 2 === 0) { const p = waterG.attributes.position; for (let i = 0; i < p.count; i++) { const x = wBase[i * 3], z = wBase[i * 3 + 2]; p.setY(i, Math.sin(x * .3 + t * 1.2) * amp + Math.cos(z * .25 + t * .9) * amp * .7); } p.needsUpdate = true; waterG.computeVertexNormals(); }
        if (glitterG.visible) { gl.t.offset.y = (t * .035) % 1; glitter.material.opacity = .26 + Math.sin(t * 2.3) * .05; }
        for (const c of clouds) { c.position.x += c.userData.vx * dt; if (c.position.x > 170) c.position.x = -170; }
        if (boatBob) { boatBob.rotation.z = Math.sin(t * 1.1) * .02; boatBob.position.y = Math.sin(t * 1.4) * .05; }
        const busy = !!F.ui && F.ui !== 'catch', st = STY[spot.id];
        if (!busy) {
          if (F.st === 'wait') { F.wait -= dt; if (!F.nib && F.wait < 1.4) { F.nib = true; controls(); } if (F.wait <= 0) { F.st = 'strike'; F.ringT = 0; ring.hidden = false; sfx.bite(); controls(); ripple(bobber.position.x, bobber.position.z); for (let i = 0; i < 8; i++) splash.add(bobber.position.x, .05, bobber.position.z, (rng() - .5) * 1.2, 1.2 + rng(), (rng() - .5) * 1.2, .5); } }
          else if (F.st === 'strike') { F.ringT += dt; const win = R.ringWindow(stats.ring); if (F.ringT >= win) { ring.hidden = true; sfx.bad(); say('Terlambat! Ikan lari', 'Too late', 1600); F.st = 'idle'; controls(); } else { const r = R.ringRadius(F.ringT, win); ring.firstElementChild.style.transform = `scale(${.25 + r * 1.1})`; ring.classList.toggle('hot', r <= .45); } }
          else if (F.st === 'fight') {
            const fs = R.fightStep(F.fight, F.reeling, dt, rng); if (rng() < dt * 22 && F.reeling) sfx.pull();
            if (fs.phase === 'run' && rng() < dt * 1.6) ripple(bobber.position.x, bobber.position.z);
            if (fs.phase === 'run' && rng() < dt * 6) splash.add(bobber.position.x, .05, bobber.position.z, (rng() - .5) * 2, 1.5 + rng() * 1.5, (rng() - .5) * 2, .5);
            if (fs.status !== 'fighting') endFight(fs.status);
          }
        }
        // bobber / shadow / rod / line
        const cast0 = st.cast, nib = F.st === 'wait' && F.nib;
        let bx = cast0[0], bz = cast0[1], by = Math.sin(t * 2) * .03;
        if (F.st === 'fight' && F.fight) { const d = clamp(F.fight.dist, 1, 40) / 40, run = F.fight.phase === 'run'; bz = 3.2 + (cast0[1] - 3.2) * (.15 + d * .85); bx = cast0[0] + Math.sin(t * 2.3) * clamp(F.fight.dist, 0, 20) * (run ? .16 : .07); by = Math.sin(t * 9) * .02; }
        if (nib || F.st === 'strike') by -= Math.abs(Math.sin(t * 14)) * (F.st === 'strike' ? .2 : .1);
        bobber.position.set(bx, by, bz); bobber.visible = ['wait', 'strike', 'fight'].includes(F.st);
        shadow.visible = F.st === 'fight' && !!F.fight; if (shadow.visible) { const f = R.fishById(F.fight.fish); shadow.position.set(bx, -.04, bz); shadow.scale.set(.5 + Math.min(1.6, F.kg * .12) + .3, 1, (.5 + Math.min(1.6, F.kg * .12)) * .5 + .15); shadow.rotation.z = Math.sin(t * 3); void f; }
        const yaw = Math.atan2(bx - ROD0.x, -(bz - ROD0.z)), tens = F.st === 'fight' && F.fight ? clamp(F.fight.tension, 0, 1.2) : 0, p0 = F.st === 'idle' || F.st === 'catch' ? .7 : .95 + tens * .1, bend = F.st === 'idle' || F.st === 'catch' ? .1 : .22 + tens * 1.15 + (F.st === 'strike' ? .25 : 0);
        rodPts[0].copy(ROD0); for (let i = 0; i < RSEG; i++) { const pp = p0 - Math.pow((i + .5) / RSEG, 1.6) * bend; dir1.set(Math.sin(yaw) * Math.cos(pp), Math.sin(pp), -Math.cos(yaw) * Math.cos(pp)); rodPts[i + 1].copy(rodPts[i]).addScaledVector(dir1, RLEN); placeSeg(rodSegs[i], rodPts[i], rodPts[i + 1]); }
        tipW.copy(rodPts[RSEG]); if (F.st === 'fight' && F.reeling) tipW.y += Math.sin(t * 40) * .01; reel.position.copy(rodPts[0]).addScaledVector(dir2.subVectors(rodPts[1], rodPts[0]), .35); reel.position.y -= .09; if (F.reeling) reel.rotation.x += dt * 14;
        const inWater = bobber.visible; line.visible = inWater; if (inWater) { const span = tipW.distanceTo(bobber.position), sag = (F.st === 'fight' ? (1 - clamp(tens * 1.6, 0, 1)) : .8) * span * .08 + .02; for (let i = 0; i < LINE_N; i++) { const u = i / (LINE_N - 1); linePts[i].set(tipW.x + (bx - tipW.x) * u, tipW.y + (by + .1 - tipW.y) * u - Math.sin(u * Math.PI) * sag, tipW.z + (bz - tipW.z) * u); } lineGeo.setFromPoints(linePts); line.material.color.setHex(F.st === 'fight' && tens > .9 ? 0xff6655 : 0xf5f5f5); }
        // caught fish showcase
        if (F.st === 'catch') { holder.position.set(anglerG.position.x - .55, anglerG.position.y + 1.45 + Math.sin(t * 2) * .03, anglerG.position.z - .6); holder.rotation.set(0, t * .9, .15 + Math.sin(t * 6) * .04); }
        splash.update(dt, -9);
        // HUD
        if (F.st === 'fight' && F.fight) { fightBox.hidden = false; const tn = F.fight.tension; tbar.style.left = `${clamp(tn / 1.1, 0, 1) * 100}%`; tbar.className = R.tensionZone(tn); sbar.style.width = `${F.fight.stamina * 100}%`; fightBox.querySelector('.finfo').textContent = `${Math.round(F.fight.dist)} m · ${F.fight.phase === 'run' ? 'IKAN LARI! ⚠️' : 'tarik…'}${tn < .25 ? ' · kendur!' : ''}`; } else fightBox.hidden = true;
        drawUW(dt); api.progress(Math.min(.999, Object.keys(kail.log).length / R.KAIL_FISH.length));
        // camera
        const cm = F.ui === 'shop' ? 'shop' : F.camMode;
        if (cm === 'shop' && shop) { view.pos.set(SHOP_X + F.shelf * 6, 2.9, 6); view.look.set(SHOP_X + F.shelf * 6, 2.1, 0); view.speed = 4; view.halfW = 3.6; view.halfH = 2.3; }
        else { const A = anglerG.position;
          if (cm === 'catch') { view.pos.set(A.x + .1, A.y + 1.75, A.z + 3); view.look.set(A.x + .75, A.y + 1.4, A.z - .6); view.speed = 4; view.halfW = 2.4; view.halfH = 1.4; }
          else if (cm === 'fight') { view.pos.set(A.x + 1.5, A.y + 2.1, A.z + 3.4); view.look.set(A.x - .4 + bx * .3, A.y + .3, -9); view.speed = 3; view.halfW = 11; view.halfH = 8.2; }
          else { view.pos.set(A.x + 1.6, A.y + 2.1, A.z + 3.6); view.look.set(A.x - .6, A.y + .7, -9); view.speed = 3; view.halfW = 12; view.halfH = 8.8; } }
        void camera; void ptr;
      },
      stop() {
        removeEventListener('keydown', onKey); removeEventListener('keyup', onKey); clearTimeout(msgTimer);
        ambience && ambience.stop && ambience.stop(); musicDuck(false); if (RD && prev) { RD.toneMapping = prev.tm; RD.toneMappingExposure = prev.ex; RD.setPixelRatio(Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, coarse ? 1.5 : 2)); const cv = RD.domElement; RD.setSize(cv.clientWidth, cv.clientHeight, false); } if (envRT) envRT.dispose(); if (pm) pm.dispose(); scene.environment = null; root.remove(); $('game').classList.remove('f3mode'); if (!practice) save();
      },
      dbg: () => ({ gfx: gq, pr: wantPR, info: RD ? { calls: RD.info.render.calls, tris: RD.info.render.triangles, tex: RD.info.memory.textures, geo: RD.info.memory.geometries } : null, st: F.st, ui: F.ui, spot: spot.id, depth: F.depth, bait: kail.bait, sp: F.sp && F.sp.id, kg: F.kg, wait: F.wait, nib: F.nib, ringT: F.ringT, fight: F.fight && { ...F.fight }, kail, landed: F.landed.length, sold: F.sold }),
      _do: doAction, _F: F,
    };
  };
}
