// LIMBUNGAN BOT — the boat workshop: 3D preview of the player's boat, six upgrade slots with four levels each,
// buy / install / remove with compatibility checks, live statistics, and an owner-only mode for adjusting attachment points.
// Rules live in boatrules.js (tested in Node), data in boatparts.js, 3D assembly in boatbuilder.js. This file is scene + UI only.
import { $, clamp, sfx, S, save } from './core.js';
import { getModel, loadPack, isShared } from './models.js';
import { balance, owns as walletOwns, spend, fmtRM } from './wallet.js';
import * as R from './boatrules.js';
import { makeBoatBuilder } from './boatbuilder.js';

if (typeof document !== 'undefined' && !document.getElementById('byCss')) { const l = document.createElement('link'); l.id = 'byCss'; l.rel = 'stylesheet'; l.href = 'boatyard.css'; document.head.append(l); }

const STATS = [['speed', 'Laju', (v) => `${v} m/s`], ['turn', 'Kemudi', (v) => `×${v}`], ['accel', 'Pecutan', (v) => `×${v}`], ['cooler', 'Muatan', (v) => `+${v} ekor`], ['line', 'Tali', (v) => `×${v}`], ['bite', 'Gigitan', (v) => `×${v}`]];
const STAT_FMT = Object.fromEntries(STATS.map(([k, n, f]) => [k, { n, f }]));
const TUNE_KEY = 'mynegeri_bot_tune';
const isOwner = () => { try { return /[?&]laras=1/.test(location.search) || localStorage.getItem('mynegeri_owner') === '1'; } catch { return false; } };
const loadTunes = () => { try { const o = JSON.parse(localStorage.getItem(TUNE_KEY) || '{}'); return o && typeof o === 'object' ? o : {}; } catch { return {}; } };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function boatYardScene({ T, environment, makeOcean, palm, mulberry32 }) {
  return function BoatYard3D(K, api) {
    const cfg = R.BOAT, bot = R.botSave(S, cfg), owner = isOwner(), tunes = loadTunes(), wallet = { balance, owns: walletOwns, spend };
    const RD = api.renderer, prevTM = RD ? { tm: RD.toneMapping, ex: RD.toneMappingExposure } : null; if (RD) { RD.toneMapping = T.ACESFilmicToneMapping; RD.toneMappingExposure = 1.05; }
    const v3 = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z), r = mulberry32(7);
    let alive = true;

    // ---------------------------------------------------------------- workshop: an open timber boat shed on the waterfront
    const scene = new T.Scene(), sun = environment(K, scene, { sky: 0xffe3b8, shadow: 9, fogNear: 70, fogFar: 195 });
    const hemi = scene.children.find((o) => o.isHemisphereLight); if (hemi) { hemi.intensity = 1.25; hemi.color.set(0xfff0dc); }
    sun.color.set(0xffdcae); sun.intensity = 2.3; sun.position.set(11, 9, 10); if (sun.target) { sun.target.position.set(0, 1, 0); scene.add(sun.target); } if (sun.shadow && sun.shadow.camera) Object.assign(sun.shadow.camera, { far: 60 });
    for (const [x, z] of [[-3.5, -2.5], [3.5, -2.5]]) { const p = new T.PointLight(0xffc27a, 34, 15); p.position.set(x, 5.4, z); scene.add(p); }
    { // sky: vertical gradient on a dome
      const g = new T.SphereGeometry(165, 20, 12), p = g.attributes.position, col = new Float32Array(p.count * 3), top = new T.Color(0x5f9fd8), bot2 = new T.Color(0xffe3b8), c = new T.Color();
      for (let i = 0; i < p.count; i++) { c.copy(bot2).lerp(top, Math.pow(clamp((p.getY(i) / 165 + .02) / .55, 0, 1), .65)); col.set([c.r, c.g, c.b], i * 3); }
      g.setAttribute('color', new T.BufferAttribute(col, 3)); const m = new T.Mesh(g, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide, fog: false, depthWrite: false })); m.position.y = -6; m.renderOrder = -3; m.frustumCulled = false; scene.add(m);
    }
    let ocean = null; try { ocean = makeOcean(T, { w: 300, h: 300, seg: .2, amp: .1, rough: .32, deep: 0x0d5a78, shallow: 0x2f9fb0, sky: 0xcfe4ea, repeat: 40 }); ocean.mesh.position.set(0, -1.05, 0); scene.add(ocean.mesh); } catch { ocean = null; }
    const tex = (w, h, draw, rx = 1, ry = 1) => { const c = K.canvasTex(w, h); draw(c.x, w, h); c.t.wrapS = c.t.wrapT = T.RepeatWrapping; c.t.repeat.set(rx, ry); c.t.needsUpdate = true; return c.t; };
    const plankT = (rx, ry) => tex(256, 256, (x) => { const g = mulberry32(11); for (let pl = 0; pl < 4; pl++) { const x0 = pl * 64, sh = 205 + Math.floor(g() * 35); x.fillStyle = `rgb(${sh},${sh - 16},${sh - 38})`; x.fillRect(x0, 0, 64, 256);
      for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(${g() < .5 ? '70,48,28' : '255,240,215'},${.05 + g() * .12})`; x.fillRect(x0 + 2 + g() * 60, g() * 256, 1 + g() * 1.5, 30 + g() * 140); }
      x.fillStyle = 'rgba(30,20,12,.6)'; x.fillRect(x0, 0, 2, 256); x.fillStyle = 'rgba(255,245,225,.16)'; x.fillRect(x0 + 2, 0, 1, 256); } }, rx, ry);
    const zincT = tex(128, 64, (x) => { for (let i = 0; i < 16; i++) { const gr = x.createLinearGradient(i * 8, 0, i * 8 + 8, 0); gr.addColorStop(0, '#8d9498'); gr.addColorStop(.5, '#dfe4e6'); gr.addColorStop(1, '#8d9498'); x.fillStyle = gr; x.fillRect(i * 8, 0, 8, 64); } x.fillStyle = 'rgba(120,70,40,.18)'; for (let i = 0; i < 30; i++) x.fillRect(Math.random() * 128, Math.random() * 64, 3 + Math.random() * 9, 2); }, 10, 3);
    const M = (c, o) => K.mat(c, o), wood = new T.MeshStandardMaterial({ color: 0xb98a5c, map: plankT(6, 1.6), roughness: .8 }), floorM = new T.MeshStandardMaterial({ color: 0xa88562, map: plankT(7, 5), roughness: .62 }), dark = M(0x5a4330, { roughness: .95 });
    const deco = new T.Group(); scene.add(deco);
    K.box(17, .3, 13, floorM, 0, -.15, 0, deco); for (const x of [-8, -4, 0, 4, 8]) for (const z of [-6, 0, 6]) K.cyl(.2, .22, 1.6, dark, x, -.9, z, deco, 7);
    const wallB = K.mesh(new T.PlaneGeometry(17, 6.6), wood, 0, 3.3, -6.4, deco, false), wallL = K.mesh(new T.PlaneGeometry(13, 6.6), wood, -8.4, 3.3, 0, deco, false); wallL.rotation.y = Math.PI / 2; void wallB;
    { const a = Math.atan2(2.2, 7), L = Math.hypot(2.2, 7), zm = new T.MeshStandardMaterial({ color: 0xc9cdd0, map: zincT, roughness: .5, metalness: .3 });
      const b = K.mesh(new T.PlaneGeometry(18.4, L), zm, 0, 7.7, -3.5, deco, false); b.rotation.x = Math.PI / 2 - a; const f = K.mesh(new T.PlaneGeometry(18.4, L), zm, 0, 7.7, 3.5, deco, false); f.rotation.x = Math.PI / 2 + a; b.castShadow = f.castShadow = false; }
    for (const x of [-8.2, -4.1, 0, 4.1, 8.2]) { K.box(.22, .3, 13.4, dark, x, 6.6, 0, deco, false); K.box(.18, 2.2, .18, dark, x, 7.7, 0, deco, false); }
    for (const [x, z] of [[8.2, 6.4], [8.2, 0], [8.2, -6.4], [0, 6.4], [-8.2, 6.4]]) K.cyl(.17, .2, 6.6, dark, x, 3.3, z, deco, 8);
    { // carved eave board (papan cantik) along the open front and side
      const t = tex(128, 64, (x) => { x.clearRect(0, 0, 128, 64); x.fillStyle = '#f3e7cf'; x.fillRect(0, 0, 128, 22); for (let i = 0; i < 4; i++) { const cx = i * 32 + 16; x.beginPath(); x.moveTo(cx - 16, 22); x.quadraticCurveTo(cx - 14, 48, cx, 62); x.quadraticCurveTo(cx + 14, 48, cx + 16, 22); x.fill(); x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.arc(cx, 34, 5, 0, 6.3); x.fill(); x.beginPath(); x.arc(cx - 9, 14, 2.6, 0, 6.3); x.arc(cx + 9, 14, 2.6, 0, 6.3); x.fill(); x.globalCompositeOperation = 'source-over'; } }, 14, 1);
      const m = new T.MeshStandardMaterial({ map: t, alphaTest: .5, side: T.DoubleSide, roughness: .8 }); K.mesh(new T.PlaneGeometry(16.6, .7), m, 0, 6.2, 6.42, deco, false); const s2 = K.mesh(new T.PlaneGeometry(12.9, .7), m, 8.22, 6.2, 0, deco, false); s2.rotation.y = Math.PI / 2; }
    { // signboard
      const t = tex(512, 128, (x) => { x.fillStyle = '#143a4a'; x.fillRect(0, 0, 512, 128); x.strokeStyle = '#f1c40f'; x.lineWidth = 8; x.strokeRect(8, 8, 496, 112); x.fillStyle = '#fff'; x.textAlign = 'center'; x.font = '900 54px system-ui,sans-serif'; x.fillText('LIMBUNGAN BOT', 256, 66); x.fillStyle = '#f1c40f'; x.font = '700 26px system-ui,sans-serif'; x.fillText('MYNegeri · baik pulih & naik taraf', 256, 104); });
      K.mesh(new T.PlaneGeometry(6, 1.5), new T.MeshStandardMaterial({ map: t, roughness: .6 }), 0, 5.3, -6.34, deco, false); }
    // workbench, tool board, shelves with paint tins, drums, tyres, rope, lifebuoys, nets, lanterns, bunting
    K.box(3.6, .12, .9, M(0x8a6a4a), -5.2, 1, -5.7, deco); for (const x of [-6.8, -3.6]) K.box(.12, 1, .8, dark, x, .5, -5.7, deco); K.box(3.4, 1.5, .06, M(0x3b4a52), -5.2, 2.3, -6.3, deco, false);
    for (let i = 0; i < 7; i++) K.box(.08 + r() * .08, .5 + r() * .5, .04, M([0xc0392b, 0x95a5a6, 0xf1c40f, 0x7f8c8d][i % 4]), -6.6 + i * .46, 2.3, -6.24, deco, false);
    K.box(3, .08, .5, dark, 5, 2.2, -6.1, deco); K.box(3, .08, .5, dark, 5, 3.2, -6.1, deco); for (let i = 0; i < 8; i++) K.cyl(.15, .15, .34, M([0x2e86de, 0xe74c3c, 0xf1c40f, 0x27ae60, 0xecf0f1][i % 5], { roughness: .4 }), 3.8 + (i % 4) * .78, i < 4 ? 2.42 : 3.42, -6.1, deco, 10);
    for (const [x, z, c] of [[-7.4, -4.6, 0x2471a3], [-7.5, -3.6, 0xc0392b], [-6.6, -4.9, 0x1e8449]]) { K.cyl(.32, .32, .95, M(c, { roughness: .5, metalness: .3 }), x, .48, z, deco, 14); K.cyl(.33, .33, .04, M(0x222222), x, .7, z, deco, 14); }
    const tyre = (x, y, z, rx, ry) => { const t = K.mesh(new T.TorusGeometry(.34, .13, 8, 16), M(0x1d1d1f, { roughness: .9 }), x, y, z, deco); t.rotation.set(rx, ry, 0); };
    tyre(-7.3, .14, 2.6, Math.PI / 2, 0); tyre(-7.3, .4, 2.6, Math.PI / 2, 0); tyre(-7.2, .5, 3.7, 0, Math.PI / 2 + .3); tyre(8.2, 1.5, 6.4, 0, 0); tyre(8.2, 1.5, 0, 0, Math.PI / 2);
    for (let i = 0; i < 4; i++) { const c = K.mesh(new T.TorusGeometry(.3, .045, 6, 16), M(0xc8a56a), 6.6, .06 + i * .085, -4.6, deco); c.rotation.x = Math.PI / 2; }
    for (const x of [-2.2, 2.2]) { const b = K.mesh(new T.TorusGeometry(.36, .1, 8, 18), M(0xff6b2c, { roughness: .6 }), x, 3.4, -6.28, deco, false); for (let k = 0; k < 4; k++) { const w = K.box(.2, .24, .24, M(0xffffff), x + Math.cos(k * 1.5708) * .36, 3.4 + Math.sin(k * 1.5708) * .36, -6.28, deco, false); w.rotation.z = k * 1.5708; } void b; }
    { const n = K.mesh(new T.PlaneGeometry(4.5, 3, 18, 12), new T.MeshStandardMaterial({ color: 0x2f6f66, wireframe: true }), -8.32, 3.4, 2.2, deco, false); n.rotation.y = Math.PI / 2; }
    const glow = M(0xffd27a, { emissive: 0xffa030, emissiveIntensity: 2 }); for (const [x, z] of [[-3.5, -2.5], [3.5, -2.5], [-3.5, 3], [3.5, 3]]) { K.cyl(.012, .012, .9, dark, x, 6.1, z, deco, 4); K.cyl(.16, .1, .2, M(0x2d3436), x, 5.6, z, deco, 8); K.ball(.09, glow, x, 5.5, z, deco); }
    { const cols = [0xc0392b, 0xf1c40f, 0x1f4e9c, 0xffffff], g = new T.ConeGeometry(.16, .34, 3); for (let i = 0; i < 26; i++) { const x = -7.8 + i * .62, f = K.mesh(g, new T.MeshStandardMaterial({ color: cols[i % 4], side: T.DoubleSide, roughness: .8 }), x, 5.72 - Math.sin(i / 25 * Math.PI) * .32, 6.36, deco, false); f.rotation.x = Math.PI; f.scale.z = .08; } }
    // slip rails running out to the water, and the cradle the boat sits on
    for (const z of [-.75, .75]) K.box(19, .14, .16, M(0x6b6f73, { metalness: .5, roughness: .5 }), 3.5, .07, z, deco);
    for (const x of [-1.5, 1.3]) { K.box(.26, .24, 2.3, dark, x, .26, 0, deco); for (const s of [-1, 1]) { const c = K.box(.24, .34, .46, M(0x8a6a4a), x, .47, s * .78, deco); c.rotation.x = s * .6; } }
    // land behind the shed with a few palms; sea on the open sides
    K.box(120, 1.6, 50, M(0x4f8a52, { roughness: 1 }), -10, -1.1, -32, deco, false); K.box(40, 1.6, 60, M(0xd9c79a, { roughness: 1 }), -29, -1.15, 6, deco, false);
    for (let i = 0; i < 9; i++) palm(K, deco, -34 + i * 8 + r() * 4, -12 - r() * 12, 1.2 + r() * .5, r); for (let i = 0; i < 4; i++) palm(K, deco, -13 - r() * 8, -3 + i * 5 + r() * 2, 1.1 + r() * .4, r);
    // merge the static workshop into one mesh per material
    (function merge(root) {
      root.updateMatrixWorld(true); const by = new Map(), gone = [];
      root.traverse((o) => { if (!o.isMesh || !o.geometry || isShared(o.geometry) || Array.isArray(o.material) || o.material.wireframe) return; const a = o.geometry.attributes; if (!a.position || !a.normal || !a.uv) return; let L = by.get(o.material); if (!L) by.set(o.material, L = []); L.push(o); });
      for (const [mat, list] of by) { if (list.length < 2) continue; let n = 0; const parts = list.map((o) => { const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); g.applyMatrix4(o.matrixWorld); n += g.attributes.position.count; return g; });
        const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2); let k = 0; for (const g of parts) { P.set(g.attributes.position.array, k * 3); N.set(g.attributes.normal.array, k * 3); U.set(g.attributes.uv.array, k * 2); k += g.attributes.position.count; g.dispose(); }
        const mg = new T.BufferGeometry(); mg.setAttribute('position', new T.BufferAttribute(P, 3)); mg.setAttribute('normal', new T.BufferAttribute(N, 3)); mg.setAttribute('uv', new T.BufferAttribute(U, 2));
        const m = new T.Mesh(mg, mat); m.castShadow = list.some((o) => o.castShadow); m.receiveShadow = true; gone.push(...list); root.add(m); }
      for (const o of gone) { o.parent && o.parent.remove(o); o.geometry.dispose(); }
    })(deco);

    // ---------------------------------------------------------------- the boat
    const KEEL = .52, builder = makeBoatBuilder({ T, getModel }); let boat = null, loaded = false;
    const sel = { slot: 'engine', level: bot.equipped.engine || 1 };
    const shown = () => ({ equipped: { ...bot.equipped, [sel.slot]: sel.level } }); // what the preview shows: the installed boat with the chosen level in the chosen slot
    const previewing = () => sel.level !== bot.equipped[sel.slot];

    // ---------------------------------------------------------------- camera: orbit with inertia, zoom, gentle focus on the chosen slot
    const cam = { yaw: .72, pitch: .22, dist: 8.8, vyaw: 0, auto: false, target: v3(0, 1.45, 0), want: v3(0, 1.45, 0), cur: null };
    const view = { pos: v3(8, 4.5, 9), look: v3(0, 1.4, 0), halfW: 0, halfH: 4, snap: true };
    const cv = $('gcv3'), pts = new Map(); let drag = null, pinch = null; const rc = new T.Raycaster(), ndc = new T.Vector2(), tmp = v3();
    const portrait = () => cv.clientHeight > cv.clientWidth;
    const lim = () => (portrait() ? [12, 22] : [6.5, 15]);
    function pDown(e) { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 1) drag = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 }; else if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), dist: cam.dist }; drag = null; } cam.auto = false; }
    function pMove(e) { const p = pts.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (pts.size === 1 && drag) { const now = performance.now(), el = Math.max(8, now - (drag.last || drag.t)); drag.last = now; cam.yaw -= dx * .0065; cam.pitch = clamp(cam.pitch + dy * .0045, .06, .62); cam.vyaw = clamp(cam.vyaw * .5 + (-dx * .0065) / (el / 1000) * .5, -2.5, 2.5); drag.moved += Math.abs(dx) + Math.abs(dy); }
      else if (pts.size === 2 && pinch) { const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (d > 10) cam.dist = clamp(pinch.dist * pinch.d / d, ...lim()); } }
    function pUp(e) { const had = pts.size; pts.delete(e.pointerId); if (had === 1 && drag) { if (drag.moved < 9 && performance.now() - drag.t < 420) tap(e); else if (Math.abs(cam.vyaw) < .25 || performance.now() - (drag.last || 0) > 90) cam.vyaw = 0; } if (pts.size < 2) pinch = null; if (!pts.size) drag = null; }
    function wheel(e) { e.preventDefault(); cam.dist = clamp(cam.dist * Math.exp(e.deltaY * .0012), ...lim()); cam.auto = false; }
    function tap(e) { if (!boat || !cam.cur) return; const b = cv.getBoundingClientRect(); ndc.set((e.clientX - b.left) / b.width * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1); rc.setFromCamera(ndc, cam.cur); const s = boat.pick(rc); if (s) { sfx.tap(); choose(s); } }
    cv.addEventListener('pointerdown', pDown); cv.addEventListener('pointermove', pMove); cv.addEventListener('pointerup', pUp); cv.addEventListener('pointercancel', pUp); cv.addEventListener('wheel', wheel, { passive: false });

    // ---------------------------------------------------------------- HUD
    const root = document.createElement('div'); root.className = 'f3 by'; root.innerHTML = `
      <div class="byTop"><button class="byX" data-a="exit" aria-label="Keluar">✕</button><div class="byTitle"><b>Limbungan Bot</b><small>${esc(cfg.hull.bm)}</small></div><span class="byRM"></span></div>
      <div class="byTools"><button data-a="z+" aria-label="Zum masuk">＋</button><button data-a="z-" aria-label="Zum keluar">－</button><button data-a="spin" aria-label="Pusing automatik">⟳</button>${owner ? '<button data-a="tune" aria-label="Laras titik lampiran">🛠</button>' : ''}</div>
      <div class="byCats"></div><div class="byStats"></div><div class="byPanel"></div>
      <div class="byTune" hidden></div><div class="byBadge" hidden>PRATONTON</div><div class="byHint">Seret untuk pusing · cubit atau ＋／－ untuk zum · ketik bahagian bot</div><div class="f3Msg"></div>`;
    $('game').append(root); $('game').classList.add('f3mode');
    const q = (s) => root.querySelector(s), msgEl = q('.f3Msg'); let msgT = 0, tuneOpen = false;
    function say(a, b = '', ms = 1900) { msgEl.innerHTML = `${esc(a)}${b ? `<small>${esc(b)}</small>` : ''}`; msgEl.classList.add('show'); clearTimeout(msgT); msgT = setTimeout(() => msgEl.classList.remove('show'), ms); }
    const slotName = (s) => cfg.slots[s].bm, lvName = (s, l) => (l > 0 ? `${cfg.slots[s].levels[l - 1].bm}` : 'Kosong');
    const fmtStat = (k, v) => STAT_FMT[k].f(v);
    function render() {
      const now = R.boatStats(bot, cfg), nxt = R.boatStats(shown(), cfg), d = cfg.slots[sel.slot], eq = bot.equipped[sel.slot], L = d.levels[sel.level - 1];
      q('.byRM').textContent = `💵 ${fmtRM(balance())}`; q('.byBadge').hidden = !previewing();
      q('.byCats').innerHTML = R.SLOT_KEYS.map((s) => `<button data-a="cat" data-s="${s}" class="${s === sel.slot ? 'on' : ''}"><i>${cfg.slots[s].ic}</i><b>${esc(cfg.slots[s].short || slotName(s))}</b><em>${bot.equipped[s] ? 'Lv' + bot.equipped[s] : '—'}</em></button>`).join('');
      q('.byStats').innerHTML = STATS.map(([k, n]) => { const a = now[k], b = nxt[k], ch = b > a ? 'up' : b < a ? 'down' : ''; return `<div class="${ch}"><small>${n}</small><b>${ch ? `${fmtStat(k, a)} → ${fmtStat(k, b)}` : fmtStat(k, a)}</b></div>`; }).join('');
      const rows = d.levels.map((lv, i) => { const n = i + 1, own = R.owns(bot, sel.slot, n), st = eq === n ? 'DIPASANG' : own ? 'DIMILIKI' : n > 1 && !R.owns(bot, sel.slot, n - 1) ? `🔒 ${fmtRM(lv.price)}` : fmtRM(lv.price);
        return `<button data-a="lv" data-l="${n}" class="${n === sel.level ? 'on' : ''} ${eq === n ? 'eq' : own ? 'own' : ''}"><i>Lv${n}</i><b>${esc(lv.bm)}</b><em>${st}</em></button>`; }).join('');
      const curV = eq > 0 ? d.levels[eq - 1].value : now[d.stat], newV = L.value, ch = newV > curV ? 'up' : newV < curV ? 'down' : 'same', diff = Math.round((newV - curV) * 100) / 100;
      const cmp = `<div class="byCmp ${ch}"><small>${STAT_FMT[d.stat].n}</small><span>${fmtStat(d.stat, curV)}</span><i>→</i><b>${fmtStat(d.stat, newV)}</b><em>${ch === 'same' ? 'sama' : (diff > 0 ? '+' : '') + diff}</em></div>`;
      const warns = [], own = R.owns(bot, sel.slot, sel.level), miss = R.missingFor(bot, sel.slot, sel.level, cfg);
      for (const m of miss) warns.push(`Perlu <b>${esc(slotName(m.slot))} Lv${m.level}</b> dipasang dahulu (sekarang ${m.have ? 'Lv' + m.have : 'kosong'}).`);
      if (eq === sel.level) for (const dpt of R.dependents(bot, sel.slot, 0, cfg)) warns.push(`<b>${esc(slotName(dpt.slot))} Lv${dpt.level}</b> bergantung pada bahagian ini.`);
      else if (own && eq > sel.level) for (const dpt of R.dependents(bot, sel.slot, sel.level, cfg)) warns.push(`Turun ke Lv${sel.level} tidak boleh: <b>${esc(slotName(dpt.slot))} Lv${dpt.level}</b> perlukan tahap lebih tinggi.`);
      let act;
      if (eq === sel.level) { const c = R.canEquip(bot, sel.slot, 0, cfg); act = `<button data-a="unequip" ${c.ok ? '' : 'disabled'}>Tanggal</button>`; }
      else if (own) { const c = R.canEquip(bot, sel.slot, sel.level, cfg); act = `<button class="primary" data-a="equip" ${c.ok ? '' : 'disabled'}>Pasang</button>`; }
      else { const c = R.canBuy(bot, sel.slot, sel.level, balance(), cfg), free = walletOwns(R.partKey(sel.slot, sel.level)); if (c.reason === 'order') warns.push(`Beli <b>Lv${c.need}</b> dahulu.`); if (c.reason === 'funds' && !free) warns.push(`Kurang <b>${fmtRM(c.short)}</b>.`);
        act = `<button class="primary" data-a="buy" ${c.ok || (free && c.reason !== 'order') ? '' : 'disabled'}>${free ? 'Ambil semula (sudah dibayar)' : `Beli · ${fmtRM(L.price)}`}</button>`; }
      const item = R.layout(shown(), tunes, cfg).find((x) => x.slot === sel.slot), ph = item.kind === 'model' && !getModel(item.model);
      const note = !loaded ? 'Memuatkan model bot…' : item.kind === 'builtin' ? 'Bahagian asal pada badan bot.' : item.kind === 'stock' ? 'Bahagian asal pada badan bot; tiada komponen tambahan.' : ph ? `Model 3D belum dimuat naik. Kotak berjalur <b>SEMENTARA</b> ditunjukkan (<code>${esc(item.model)}.glb</code>).` : '';
      q('.byPanel').innerHTML = `<div class="byHd"><b>${d.ic} ${esc(d.bm)}</b><span>${eq ? 'Dipasang: ' + esc(lvName(sel.slot, eq)) : 'Slot kosong'}</span></div><div class="byLv">${rows}</div>${cmp}
        ${warns.length ? `<div class="byWarn">${warns.map((w) => `<p>⚠ ${w}</p>`).join('')}</div>` : ''}<div class="byAct">${act}${previewing() ? '<button data-a="back">Lihat yang dipasang</button>' : ''}</div>${note ? `<p class="byNote">${note}</p>` : ''}`;
      if (tuneOpen) renderTune();
    }
    function rebuild() { if (boat) boat.apply(shown(), { tunes, selected: sel.slot, labels: true }); if (boat) boat.slotWorld(sel.slot, sel.level, tmp), cam.want.set(tmp.x * .3, 1.45 + (tmp.y - 1.45) * .25, tmp.z * .3); render(); }
    function choose(slot, level) { sel.slot = slot; sel.level = level || bot.equipped[slot] || R.highestOwned(bot, slot) || 1; rebuild(); }
    const WHY = { funds: 'Duit tidak cukup', order: 'Beli tahap sebelumnya dahulu', owned: 'Sudah dimiliki', notOwned: 'Belum dimiliki', requires: 'Bahagian lain perlu dinaik taraf dahulu', needed: 'Bahagian lain bergantung padanya', same: 'Sudah dipasang', unknown: 'Tidak dikenali', invalid: 'Jumlah tidak sah' };
    function act(a, ds = {}) {
      if (a === 'exit') { $('gClose').click(); return; }
      if (a === 'z+' || a === 'z-') { cam.dist = clamp(cam.dist * (a === 'z+' ? .84 : 1.19), ...lim()); return; }
      if (a === 'spin') { cam.auto = !cam.auto; cam.vyaw = 0; return; }
      if (a === 'cat') return choose(ds.s);
      if (a === 'lv') { sel.level = Number(ds.l); return rebuild(); }
      if (a === 'back') { sel.level = bot.equipped[sel.slot] || 1; return rebuild(); }
      if (a === 'buy') { const rr = R.purchase(bot, sel.slot, sel.level, wallet, cfg); if (!rr.ok) { sfx.bad(); say(WHY[rr.reason] || 'Tidak berjaya'); return render(); } save(); sfx.good(); say(rr.restored ? 'Diambil semula ✓' : 'Dibeli ✓', rr.restored ? 'Tiada bayaran: sudah dibayar sebelum ini' : `−${fmtRM(rr.charged)} · tekan Pasang untuk memasangnya`, 2600); return rebuild(); }
      if (a === 'equip' || a === 'unequip') { const rr = a === 'equip' ? R.equip(bot, sel.slot, sel.level, cfg) : R.unequip(bot, sel.slot, cfg); if (!rr.ok) { sfx.bad(); say(WHY[rr.reason] || 'Tidak berjaya'); return render(); } save(); sfx.pop(); say(a === 'equip' ? 'Dipasang ✓' : 'Ditanggalkan', `${slotName(sel.slot)} · ${lvName(sel.slot, bot.equipped[sel.slot])}`); if (a === 'unequip') sel.level = R.highestOwned(bot, sel.slot) || 1; return rebuild(); }
      if (a === 'tune') { tuneOpen = !tuneOpen; q('.byTune').hidden = !tuneOpen; root.classList.toggle('tuning', tuneOpen); return render(); }
      if (a === 'tune-reset') { delete tunes[`${sel.slot}:${sel.level}`]; storeTunes(); return rebuild(); }
      if (a === 'tune-copy') { const txt = tuneExport(); try { navigator.clipboard && navigator.clipboard.writeText(txt).catch(() => {}); } catch { } const ta = q('.byTune textarea'); if (ta) { ta.hidden = false; ta.value = txt; ta.select(); } say('Disalin', 'Tampal dalam js/boatparts.js', 2200); }
    }
    root.addEventListener('click', (e) => { const b = e.target.closest('[data-a]'); if (!b || b.disabled) return; e.stopPropagation(); if (!['z+', 'z-'].includes(b.dataset.a)) sfx.tap(); act(b.dataset.a, b.dataset); });

    // ---------------------------------------------------------------- owner-only: adjust the attachment point of the shown component
    const AX = [['px', 'X (haluan +)', -.3, .3, .002], ['py', 'Y (atas +)', -.3, .3, .002], ['pz', 'Z (kanan +)', -.3, .3, .002], ['rx', 'Pusing X°', -180, 180, 1], ['ry', 'Pusing Y°', -180, 180, 1], ['rz', 'Pusing Z°', -180, 180, 1], ['sc', 'Skala', .2, 4, .01]];
    const storeTunes = () => { try { localStorage.setItem(TUNE_KEY, JSON.stringify(tunes)); } catch { } };
    const tuneOf = (key) => { const t = tunes[key] || {}; return { px: (t.pos || [0, 0, 0])[0], py: (t.pos || [0, 0, 0])[1], pz: (t.pos || [0, 0, 0])[2], rx: (t.rot || [0, 0, 0])[0], ry: (t.rot || [0, 0, 0])[1], rz: (t.rot || [0, 0, 0])[2], sc: t.scale || 1 }; };
    // ready-to-paste `offset` for each tuned level (existing offset + adjustment)
    function tuneExport() {
      const rnd = (v) => Math.round(v * 1000) / 1000, out = [];
      for (const [key, t] of Object.entries(tunes)) { const [s, l] = key.split(':'), L = R.levelOf(cfg, s, Number(l)); if (!L) continue; const o = L.offset || {}, add = (a, b) => [0, 1, 2].map((i) => rnd(((a || [0, 0, 0])[i] || 0) + ((b || [0, 0, 0])[i] || 0)));
        out.push(`// ${s} Lv${l} (${L.bm})\noffset: { pos: [${add(o.pos, t.pos).join(', ')}], rot: [${add(o.rot, t.rot).join(', ')}], scale: ${rnd((o.scale || 1) * (t.scale || 1))} },`); }
      return out.join('\n') || '// tiada pelarasan';
    }
    function renderTune() {
      const el = q('.byTune'), key = `${sel.slot}:${sel.level}`, item = R.layout(shown(), tunes, cfg).find((x) => x.slot === sel.slot);
      if (item.kind !== 'model') { el.innerHTML = `<b>Laras titik lampiran</b><p>${esc(slotName(sel.slot))} Lv${sel.level} ialah bahagian asal badan bot; tiada apa untuk dilaras. Pilih tahap lain.</p>`; return; }
      const t = tuneOf(key), a = item.anchor, bad = boat && boat.islands ? R.overlaps(boat.islands, shown(), tunes, cfg).filter((o) => o.slot === sel.slot) : [], clash = R.partClashes(shown(), tunes, cfg).filter((p) => p.includes(sel.slot));
      const keep = el.querySelector('textarea'), kept = keep && !keep.hidden ? keep.value : '';
      el.innerHTML = `<b>Laras: ${esc(slotName(sel.slot))} Lv${sel.level}</b>${AX.map(([k, n, mn, mx, st]) => `<label><span>${n}</span><input type="range" data-k="${k}" min="${mn}" max="${mx}" step="${st}" value="${t[k]}"><output>${Math.round(t[k] * 1000) / 1000}</output></label>`).join('')}
        <p class="abs">pos [${a.pos.map((v) => v.toFixed(3)).join(', ')}] · rot [${a.rot.join(', ')}] · skala ${a.scale.toFixed(2)}</p>
        ${bad.length ? `<p class="warn">⚠ Bertindih dengan ${bad[0].parts} bahagian terbina badan bot.</p>` : ''}${clash.length ? `<p class="warn">⚠ Bertindih dengan komponen: ${clash.map((p) => esc(slotName(p.find((s) => s !== sel.slot)))).join(', ')}.</p>` : ''}${!bad.length && !clash.length ? '<p class="ok">✓ Tiada pertindihan dikesan (semakan kotak).</p>' : ''}
        <div class="row"><button data-a="tune-reset">Set semula</button><button class="primary" data-a="tune-copy">Salin konfigurasi</button></div><textarea readonly rows="4" ${kept ? '' : 'hidden'}>${esc(kept)}</textarea>`;
    }
    q('.byTune').addEventListener('input', (e) => { const k = e.target.dataset.k; if (!k) return; const key = `${sel.slot}:${sel.level}`, t = tuneOf(key); t[k] = Number(e.target.value); tunes[key] = { pos: [t.px, t.py, t.pz], rot: [t.rx, t.ry, t.rz], scale: t.sc }; storeTunes(); if (boat) boat.apply(shown(), { tunes, selected: sel.slot, labels: true }); e.target.nextElementSibling.textContent = Math.round(t[k] * 1000) / 1000;
      const a = R.anchorFor(sel.slot, sel.level, tunes[key], cfg), p = q('.byTune .abs'); if (p) p.textContent = `pos [${a.pos.map((v) => v.toFixed(3)).join(', ')}] · rot [${a.rot.join(', ')}] · skala ${a.scale.toFixed(2)}`; });
    q('.byTune').addEventListener('change', () => renderTune());
    const onKey = (e) => { if (e.key === 'Escape') act('exit'); else if (e.key === '+' || e.key === '=') act('z+'); else if (e.key === '-') act('z-'); };
    addEventListener('keydown', onKey);

    render(); say('Memuatkan bot…', '', 1500);
    loadPack('bot').then(() => { if (!alive) return; boat = builder.create(cfg); boat.object.position.y = KEEL; scene.add(boat.object); loaded = true; rebuild(); if (!boat.info.hullLoaded) say('Badan bot tidak dapat dimuat', 'Pemegang tempat ditunjukkan', 2600); });

    return {
      scene, view,
      ray() { return null; },
      update(dt, ptr, camera) {
        cam.cur = camera; if (ocean) ocean.update(performance.now() / 1000, scene.background);
        if (cam.auto) cam.yaw += dt * .35; else if (!drag && cam.vyaw) { cam.yaw += cam.vyaw * dt; cam.vyaw *= Math.pow(.02, dt); if (Math.abs(cam.vyaw) < .02) cam.vyaw = 0; }
        const [mn, mx] = lim(); cam.dist = clamp(cam.dist, mn, mx); cam.target.lerp(cam.want, Math.min(1, dt * 4));
        const pt = portrait(), cp = Math.cos(cam.pitch), look = view.look.copy(cam.target);
        if (pt) look.y -= cam.dist * .2; else look.addScaledVector(tmp.set(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)), cam.dist * .17); // keep the boat clear of the panel
        view.pos.set(look.x + Math.sin(cam.yaw) * cp * cam.dist, look.y + Math.sin(cam.pitch) * cam.dist, look.z + Math.cos(cam.yaw) * cp * cam.dist);
        view.halfH = cam.dist * Math.tan((pt ? 29 : 20) * Math.PI / 180); view.halfW = 0; void ptr;
      },
      timerText: () => '',
      stop() {
        alive = false; clearTimeout(msgT); removeEventListener('keydown', onKey);
        cv.removeEventListener('pointerdown', pDown); cv.removeEventListener('pointermove', pMove); cv.removeEventListener('pointerup', pUp); cv.removeEventListener('pointercancel', pUp); cv.removeEventListener('wheel', wheel);
        if (boat) boat.dispose(); builder.dispose(); if (RD && prevTM) { RD.toneMapping = prevTM.tm; RD.toneMappingExposure = prevTM.ex; }
        root.remove(); $('game').classList.remove('f3mode'); save();
      },
      dbg: () => ({ sel: { ...sel }, bot, owner, tunes, loaded, info: boat ? boat.info : null, cam: { yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist }, render: RD ? { calls: RD.info.render.calls, tris: RD.info.render.triangles, tex: RD.info.memory.textures } : null }),
      _do: act, _choose: choose,
    };
  };
}
