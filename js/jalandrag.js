// TYRANZ: JALAN DRAG (v0.1) — drag racing mini-game: 3D garage (inspect, buy vehicles, parts, paint, vinyls, tuning)
// and Quick Race vs AI over 1/8, 1/4 or 1/2 mile with burnout box, staging, christmas tree, reaction time, launch rpm,
// manual / auto gearbox, nitrous, wheelspin and results paid in RM through the game wallet.
// Physics: dragphys.js (fixed timestep 1/240 s). Data / economy: dragdata.js. Vehicles: dragcars.js.
import { $, clamp, sfx, S, save, toast, loopSound, musicDuck } from './core.js';
import { DT, DIST, newState, step, launch, shiftRpm, driver } from './dragphys.js';
import { VEHICLES, CAR_IDS, BIKE_IDS, PARTS, PAINTS, PAINT_PRICE, PAINT_METAL, VINYLS, NEONS, NEON_PRICE, buyNeon, garage, buildSpec, perf, partPrice, slotsFor, buyVehicle, buyPart, buyPaint, buyVinyl, setTune, makeOpponent, payout, DIFF, BASE_PAY } from './dragdata.js';
import { buildVehicle } from './dragcars.js';
import { spend, earn, fmtRM, balance } from './wallet.js';

const W = { spend: (n, why, key) => spend(n, why, key) };
const TRACK_LEN = 1250, LANE = 2.7, GX = 600; // garage set lives at x = 600

export function jalanDragScene({ T, environment, Sparks, palm, putModel, textPlane, mulberry32 }) {
  return function JalanDrag3D(K, api, opts, M = {}) {
    const g = garage(S); save();
    const scene = new T.Scene(); const sun = environment(K, scene, { sky: 0x9fd6ee, shadow: 16, fogNear: 160, fogFar: 700 }); if (sun.target) scene.add(sun.target);
    const hemi = scene.children.find(o => o.isHemisphereLight);
    const r = mulberry32(77);
    // ================================================= TRACK
    const asph = K.canvasTex(256, 256); { const x = asph.x; x.fillStyle = '#3a3d43'; x.fillRect(0, 0, 256, 256); for (let k = 0; k < 3500; k++) { const v = 40 + Math.random() * 45; x.fillStyle = `rgb(${v},${v},${v + 4})`; x.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); } asph.t.wrapS = asph.t.wrapT = T.RepeatWrapping; asph.t.repeat && asph.t.repeat.set(2, 120); }
    K.mesh(new T.BoxGeometry(14, .1, TRACK_LEN + 60), new T.MeshStandardMaterial({ map: asph.t, roughness: .9 }), 0, -.05, -TRACK_LEN / 2 + 30, scene, false);
    K.mesh(new T.BoxGeometry(260, .1, TRACK_LEN + 300), K.mat(0x6a9a48), 0, -.13, -TRACK_LEN / 2 + 30, scene, false);
    // launch pad (darker rubbered area) + burnout box (wet)
    K.box(14, .02, 60, K.mat(0x26282c, { roughness: .7 }), 0, .005, -25, scene, false);
    const wetM = new T.MeshStandardMaterial({ color: 0x1d2a33, roughness: .08, metalness: .3 }); for (const s of [-1, 1]) K.box(4, .02, 6, wetM, s * LANE, .012, 13, scene, false);
    const white = K.mat(0xffffff), yellow = K.mat(0xf1c40f);
    K.box(.2, .02, TRACK_LEN, yellow, 0, .015, -TRACK_LEN / 2, scene, false); for (const x of [-6.6, 6.6]) K.box(.15, .02, TRACK_LEN, white, x, .015, -TRACK_LEN / 2, scene, false);
    K.box(12, .02, .4, white, 0, .016, 0, scene, false);
    for (const x of [-7.3, 7.3]) for (let z = 20; z > -TRACK_LEN; z -= 6) K.box(.5, .9, 5.9, K.mat(Math.round(z / 6) % 2 ? 0xdcdcdc : 0xc0392b), x, .45, z, scene, false);
    const marks = [[18.29, '60ft'], [100.58, '330ft'], [201.17, '1/8'], [304.8, '1000ft'], [402.34, '1/4'], [804.67, '1/2']];
    for (const [m, t] of marks) { const b = textPlane(K, t, 2.4, 1, { bg: '#f1c40f', fg: '#111', px: 90 }); b.position.set(-8.6, 1.4, -m); b.rotation.y = Math.PI / 2 - .25; scene.add(b); K.box(.1, 1, .1, K.mat(0x444444), -8.6, .5, -m, scene, false); }
    // finish gantries (only the chosen distance's is lit during a race)
    const gantries = {}; for (const [id, d] of Object.entries(DIST)) { const gg = K.group(0, 0, -d.m, scene); for (const x of [-7.6, 7.6]) K.box(.4, 6.4, .4, K.mat(0x444444), x, 3.2, 0, gg); const s = textPlane(K, `TAMAT · FINISH  ${d.bm}`, 15.6, 1.3, { bg: '#c0392b', px: 70 }); s.position.y = 6; s.rotation.y = 0; gg.add(s); const s2 = s.clone(); s2.rotation.y = Math.PI; gg.add(s2);
      for (let k = 0; k < 14; k++) K.box(1, .02, .5, K.mat(k % 2 ? 0xffffff : 0x111111), -6.5 + k, .018, 0, gg, false); gantries[id] = gg; }
    { const gg = K.group(0, 0, 2, scene); for (const x of [-7.6, 7.6]) K.box(.4, 6.4, .4, K.mat(0x444444), x, 3.2, 0, gg); const s = textPlane(K, 'JALAN DRAG · TYRANZ', 15.6, 1.3, { bg: '#1f6f9c', px: 70 }); s.position.y = 6; s.rotation.y = Math.PI; gg.add(s); }
    // grandstands + crowd + lights + scenery
    for (let k = 0; k < 4; k++) putModel(M, 'race/Stands', scene, -14, 4 - k * 13, { len: 12, ry: Math.PI / 2 }) || K.box(6, 3, 12, K.mat(0x9aa4ad), -14, 1.5, 4 - k * 13, scene);
    const crowdM = [0xe74c3c, 0xf1c40f, 0x3498db, 0xecf0f1, 0x27ae60, 0xff6fb5].map(c => K.mat(c)), crowd = [];
    for (let k = 0; k < 120; k++) { const row = k % 5, b = K.box(.4, .7, .4, crowdM[k % 6], 12 + row * .9, .9 + row * .55, 8 - Math.floor(k / 5) * 1.5, scene, false); crowd.push(b); }
    for (let r2 = 0; r2 < 5; r2++) K.box(.9, .45, 38, K.mat(0x8f99a3), 12 + r2 * .9, .45 + r2 * .55, -10, scene, false);
    const poleM = new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2c0, emissiveIntensity: 0 });
    for (let z = -30; z > -TRACK_LEN; z -= 45) for (const x of [-10, 10]) { K.cyl(.12, .15, 9, K.mat(0x777777), x, 4.5, z, scene, 6); K.box(1.6, .35, .7, poleM, x * .92, 9, z, scene, false); }
    for (let z = 30; z > -TRACK_LEN; z -= 28) for (const x of [-22 - r() * 30, 22 + r() * 30]) palm(K, scene, x, z, 1 + r() * .5, r);
    for (let z = -60; z > -900; z -= 90) putModel(M, 'race/Flag', scene, 8.4, z, { h: 3 });
    // christmas tree: pre-stage, stage, 3 amber, green, red for each lane
    const tree = K.group(0, 0, -1, scene); K.box(.35, 3.4, .3, K.mat(0x222222), 0, 1.7, 0, tree); K.box(1.4, 3.2, .25, K.mat(0x1b1b1b), 0, 3.1, 0, tree);
    const bulb = (c) => new T.MeshStandardMaterial({ color: 0x222222, emissive: c, emissiveIntensity: 0 });
    const TL = { pre: [bulb(0xfff2b0), bulb(0xfff2b0)], stg: [bulb(0xfff2b0), bulb(0xfff2b0)], amb: [0, 1, 2].map(() => [bulb(0xffa000), bulb(0xffa000)]), grn: [bulb(0x22ff55), bulb(0x22ff55)], red: [bulb(0xff2222), bulb(0xff2222)] };
    const rows = [['pre', 4.35], ['stg', 4.05], ['amb0', 3.6], ['amb1', 3.2], ['amb2', 2.8], ['grn', 2.35], ['red', 1.95]];
    for (const [name, y] of rows) for (const s of [0, 1]) { const m = name.startsWith('amb') ? TL.amb[+name[3]][s] : TL[name][s]; K.ball(.12, m, (s ? 1 : -1) * .38, y, .15, tree); K.ball(.12, m, (s ? 1 : -1) * .38, y, -.15, tree); }
    const treeSet = (sel) => { for (const k of ['pre', 'stg', 'grn', 'red']) for (const s of [0, 1]) TL[k][s].emissiveIntensity = sel[k] && sel[k][s] ? 2.4 : 0; for (let a = 0; a < 3; a++) for (const s of [0, 1]) TL.amb[a][s].emissiveIntensity = sel.amb > a && !sel.grn ? 2.4 : 0; };
    // ================================================= GARAGE (separate set at x = GX): dark showroom, soft boxes, glossy floor, turntable
    const gar = K.group(GX, 0, 0, scene);
    { const floorM = new T.MeshStandardMaterial({ color: 0x15181d, roughness: .22, metalness: .5 });
      K.mesh(new T.BoxGeometry(30, .1, 30), floorM, 0, -.05, 0, gar, false);
      for (let k = -3; k <= 3; k++) K.box(.04, .005, 30, K.mat(0x2a2f37), k * 4, .002, 0, gar, false);
      const wallM = K.mat(0x23272e, { roughness: .8 }); K.box(30, 9, .3, wallM, 0, 4.5, -10, gar, false); for (const x of [-12, 12]) K.box(.3, 9, 30, wallM, x, 4.5, 0, gar, false);
      const stripe = new T.MeshStandardMaterial({ color: 0xc0392b, emissive: 0xc0392b, emissiveIntensity: .5 }); K.box(30, .12, .05, stripe, 0, 2.2, -9.84, gar, false);
      const sign = textPlane(K, 'BENGKEL TYRANZ', 8, 1, { bg: '#0f1115', fg: '#ffffff', px: 96 }); sign.position.set(0, 5.4, -9.8); gar.add(sign);
      // tool chests, tyre stacks and a lift in the background
      for (const x of [-9.5, -7.6]) { K.box(1.7, 1.1, .7, K.mat(0xc0392b, { metalness: .4, roughness: .35 }), x, .55, -9.3, gar); for (let d = 0; d < 4; d++) K.box(1.6, .02, .02, K.mat(0xd0d0d0, { metalness: .8 }), x, .22 + d * .24, -8.94, gar, false); }
      for (const [x, z] of [[9.2, -8.6], [10.2, -7.4]]) for (let k = 0; k < 5; k++) { const t2 = K.mesh(new T.TorusGeometry(.34, .14, 8, 18), K.mat(0x121212, { roughness: .9 }), x, .15 + k * .28, z, gar); t2.rotation.x = Math.PI / 2; }
      for (const x of [6.5, 8.5]) K.box(.25, 3.4, .25, K.mat(0x3c76c2, { metalness: .5 }), x, 1.7, -8.6, gar);
      // soft boxes (bright panels that the clear-coat reflects)
      const soft = new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.6 });
      for (const [x, z] of [[-3, -1.5], [3, -1.5], [-3, 2.5], [3, 2.5]]) { K.box(2.4, .06, .9, soft, x, 6.2, z, gar, false); }
      const key = new T.SpotLight ? new T.SpotLight(0xffffff, 140, 30, .7, .6, 1.4) : new T.PointLight(0xffffff, 60, 30); key.position.set(4, 7, 5); gar.add(key); if (key.target) { key.target.position.set(0, 0, 0); gar.add(key.target); }
      const fill = new T.PointLight(0x9fc7ff, 22, 20, 1.6); fill.position.set(-5, 4, 3); gar.add(fill);
      const rim = new T.PointLight(0xff9a5a, 18, 18, 1.6); rim.position.set(0, 3, -6); gar.add(rim);
      K.mesh(new T.CylinderGeometry(3.3, 3.4, .12, 48), K.mat(0x2a2f36, { metalness: .7, roughness: .25 }), 0, .06, 0, gar, false);
      const ring = new T.MeshStandardMaterial({ color: 0xffd452, emissive: 0xffb300, emissiveIntensity: .8 }); const rg = K.mesh(new T.TorusGeometry(3.35, .03, 6, 64), ring, 0, .12, 0, gar, false); rg.rotation.x = Math.PI / 2; }
    const turn = K.group(0, .12, 0, gar);
    // environment map for reflections on paint and chrome (sky above, a bright horizon band, dark floor)
    { const c = K.canvasTex(512, 256), x = c.x, gr = x.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#9fc9ef'); gr.addColorStop(.45, '#e8f2fb'); gr.addColorStop(.5, '#ffffff'); gr.addColorStop(.53, '#5b636c'); gr.addColorStop(1, '#202428'); x.fillStyle = gr; x.fillRect(0, 0, 512, 256);
      x.fillStyle = 'rgba(255,255,255,.95)'; for (let k = 0; k < 6; k++) x.fillRect(20 + k * 85, 40, 46, 22);
      c.t.mapping = T.EquirectangularReflectionMapping; scene.environment = c.t; if ('environmentIntensity' in scene) scene.environmentIntensity = .9; }
    // ================================================= VEHICLES
    let show = null, showId = null; // garage display
    // try-before-you-buy: R.pv holds a previewed (not yet bought) item; the car on the turntable shows it, nothing is saved
    const cfgFor = (id) => { const base = g.cars[id] || newPreview(id); if (!R.pv || R.pv.id !== id) return base; const c2 = { ...base, parts: { ...base.parts } }; R.pv.apply(c2); return c2; };
    const keyOf = (id, c) => id + JSON.stringify([c.parts, c.paint, c.metal, c.vinyl, c.neon, c.height]);
    let showKey = '';
    function rebuildShow() {
      if (show) { turn.remove(show.root); disposeTree(show.root); } const id = viewId(), c = cfgFor(id);
      show = buildVehicle(T, K, id, c); turn.add(show.root); showId = id; showKey = keyOf(id, c); show.root.position.z = 0;
    }
    function clearPv() { R.pv = null; R.confirm = null; }
    const newPreview = (id) => ({ parts: Object.fromEntries(Object.keys(PARTS).map(s => [s, 0])), own: {}, paint: VEHICLES[id].color, metal: false, vinyl: 'none', vinyls: {}, height: 0, final: 1, spread: 1, launchRpm: 0 });
    function disposeTree(o) { o.traverse(m => { if (m.geometry) m.geometry.dispose(); if (m.material && !m.material.userData?.shared) for (const mm of [].concat(m.material)) { if (mm.map) mm.map.dispose(); } }); }
    // ================================================= EFFECTS
    const smoke = new Sparks(scene, 700, 0xe6e6e6, 1.1), fire = new Sparks(scene, 160, 0xffa020, .35), nosFx = new Sparks(scene, 200, 0x7a5cff, .45);
    const skidM = new T.MeshBasicMaterial({ color: 0x0b0b0b, transparent: true, opacity: .55, depthWrite: false }), skids = []; let skidI = 0;
    for (let k = 0; k < 160; k++) { const m = K.mesh(new T.PlaneGeometry(.26, .5), skidM, 0, .02, 999, scene, false); m.rotation.x = -Math.PI / 2; skids.push(m); }
    const skid = (x, z, w) => { const m = skids[skidI = (skidI + 1) % skids.length]; m.position.set(x, .021, z); m.scale.x = w / .26; };
    let quality = 1, frameAvg = 1 / 60;
    // ================================================= STATE
    const R = { mode: 'garage', tab: null, cat: g.cat, browse: { car: g.sel.car, bike: g.sel.bike }, confirm: null, cam: g.view, night: false };
    function viewId() { return R.browse[R.cat]; }
    let race = null;
    // ================================================= DOM
    const root = document.createElement('div'); root.className = 'f3 jd'; $('game').append(root); $('game').classList.add('f3mode');
    root.innerHTML = `<button class="f3Pause" aria-label="Menu">❚❚</button><div class="jdWallet"></div><div class="jdMain"></div><div class="f3Msg"></div><div class="f3Over" hidden></div>`;
    const q = (s) => root.querySelector(s), main = q('.jdMain'), over = q('.f3Over');
    const wallet = () => { q('.jdWallet').innerHTML = `💵 <b>${fmtRM(balance())}</b>`; };
    let msgT = 0; const msg = (m, d = 1.6, cls = '') => { const e = q('.f3Msg'); e.textContent = m; e.className = 'f3Msg show ' + cls; msgT = d; };
    // ----------------------------------------------- GARAGE UI (clean: car in the middle, top bar, bottom dock, one side drawer at a time)
    const DOCK = [['parts', '🔧', 'Prestasi', 'Upgrades'], ['style', '🎨', 'Gaya', 'Customise'], ['tune', '⚙️', 'Tala', 'Tuning'], ['dealer', '🏪', 'Pengedar', 'Dealer']];
    function garageUI() {
      R.mode = 'garage'; wallet(); const id = viewId(), V = VEHICLES[id], own = !!g.cars[id], c = g.cars[id] || newPreview(id), cfg = cfgFor(id), pf = perf(id, cfg), pb = perf(id, c);
      if (!show || showKey !== keyOf(id, cfg)) rebuildShow();
      const dl = (a, b, lower, dp = 0) => { const d = a - b; if (Math.abs(d) < (dp ? .005 : .5)) return ''; const good = lower ? d < 0 : d > 0; return `<em class="${good ? 'up' : 'dn'}">${d > 0 ? '▲' : '▼'}${Math.abs(d).toFixed(dp)}</em>`; };
      const drawer = R.tab ? drawerHTML(id, c, own) : '';
      main.innerHTML = `
        <div class="jdTitle"><b>${V.bm}</b><small>${V.en} · ${V.drive === 'F' ? 'FWD' : V.drive === 'A' ? 'AWD' : 'RWD'}${V.stockTurbo ? ' · Turbo' : ''}</small></div>
        <div class="jdSeg">${[['car', '🚗', 'Kereta'], ['bike', '🏍️', 'Motor']].map(([k, ic, l]) => `<button class="${R.cat === k ? 'on' : ''}" data-cat="${k}">${ic} ${l}</button>`).join('')}</div>
        <div class="jdSpecs ${R.pv ? 'pv' : ''}"><div><small>KUASA</small><b>${pf.hp}</b><i>hp</i>${dl(pf.hp, pb.hp)}</div><div><small>BERAT</small><b>${pf.kg}</b><i>kg</i>${dl(pf.kg, pb.kg, true)}</div><div><small>¼ BATU</small><b>${pf.et.toFixed(2)}</b><i>s</i>${dl(pf.et, pb.et, true, 2)}</div><div><small>LAJU</small><b>${pf.trap.toFixed(0)}</b><i>km/j</i>${dl(pf.trap, pb.trap)}</div></div>
        ${R.tab === 'dealer' ? `<button class="jdArrow l" data-nav="-1">‹</button><button class="jdArrow r" data-nav="1">›</button>` : ''}
        <div class="jdDock">${DOCK.map(([k, ic, bm, en]) => `<button class="${R.tab === k ? 'on' : ''}" data-tab="${k}"><i>${ic}</i><b>${bm}</b></button>`).join('')}<button data-exit="1"><i>🚪</i><b>Keluar</b></button></div>
        ${own ? `<button class="jdRace" data-tab="race"><b>LUMBA</b><small>RACE ▶</small></button>` : ''}
        ${drawer}`;
      root.classList.toggle('jdDrawerOpen', !!R.tab);
      main.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => { sfx.tap(); R.cat = b.dataset.cat; g.cat = R.cat; R.browse[R.cat] = g.sel[R.cat]; clearPv(); if (R.tab === 'dealer') R.tab = null; save(); garageUI(); });
      main.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => { sfx.tap(); const ids = R.cat === 'car' ? CAR_IDS : BIKE_IDS, n = ids[(ids.indexOf(id) + +b.dataset.nav + ids.length) % ids.length]; R.browse[R.cat] = n; clearPv(); garageUI(); });
      main.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { sfx.tap(); const k = b.dataset.tab; R.tab = R.tab === k ? null : k; clearPv(); if (R.tab !== 'dealer' && !g.cars[viewId()]) R.browse[R.cat] = g.sel[R.cat]; garageUI(); });
      const cl = main.querySelector('[data-close]'); if (cl) cl.onclick = () => { sfx.tap(); R.tab = null; clearPv(); if (!g.cars[viewId()]) R.browse[R.cat] = g.sel[R.cat]; garageUI(); };
      main.querySelector('[data-exit]').onclick = () => exit();
      bindPanel(id, c);
    }
    function fail(res) { sfx.bad(); if (res.reason === 'funds') msg(`Duit tak cukup — kurang ${fmtRM(res.short || 0)}`, 2, 'bad'); else if (res.reason === 'owned') msg('Dah dimiliki', 1.4); else msg('Tak boleh', 1.4, 'bad'); }
    const TITLES = { race: ['🏁 Persediaan Lumba', 'Race setup'], parts: ['🔧 Prestasi', 'Performance parts'], style: ['🎨 Gaya', 'Paint, wraps & parts'], tune: ['⚙️ Tala', 'Tuning'], dealer: ['🏪 Pengedar', 'Vehicle dealer'] };
    function drawerHTML(id, c, own) { const [bm, en] = TITLES[R.tab]; return `<div class="jdDrawer"><div class="hd"><b>${bm}</b><small>${en}</small><button data-close="1">✕</button></div><div class="bd">${panel(id, c, own)}</div>${R.tab === 'race' && own ? `<button class="jdGo" data-race="1">MULA LUMBA ▶</button>` : ''}${R.pv ? `<div class="jdBuy"><div><small>👁 PRATONTON · PREVIEW</small><b>${R.pv.label}</b></div><button class="cancel" data-pvcancel="1">✕</button><button class="buy" data-pvbuy="1">BELI ${fmtRM(R.pv.price)}</button></div>` : ''}</div>`; }
    const chip = (on, attr, label, sub = '', cls = '') => `<button class="chip ${on ? 'on' : ''} ${cls}" ${attr}><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</button>`;
    function panel(id, c, own) {
      const V = VEHICLES[id];
      if (R.tab === 'dealer') { const ids = R.cat === 'car' ? CAR_IDS : BIKE_IDS;
        return `<div class="jdList">${ids.map(v => { const o = !!g.cars[v], P2 = perf(v, g.cars[v] || newPreview(v)); return `<button class="row ${v === id ? 'on' : ''}" data-pick="${v}"><span><b>${VEHICLES[v].bm}</b><small>${VEHICLES[v].en} · ${P2.hp} hp · ${P2.et.toFixed(2)}s</small></span><em>${o ? (g.sel[R.cat] === v ? '✔ Dipilih' : 'Milik') : fmtRM(VEHICLES[v].price)}</em></button>`; }).join('')}</div>
          <div class="jdAct">${own ? (g.sel[R.cat] === id ? '<span class="ok">✔ Kenderaan semasa · Current</span>' : `<button class="jdB" data-sel="1">Guna kenderaan ini · Use</button>`) : `<button class="jdB buy ${R.confirm === 'veh' ? 'sure' : ''}" data-buyveh="1">${R.confirm === 'veh' ? 'Sah beli? ' : 'Beli '}${fmtRM(V.price)}</button>`}</div>`; }
      if (!own) return '<p class="muted">Pilih kenderaan anda dahulu. · Select an owned vehicle.</p>';
      if (R.tab === 'race') { const pay = Math.round(BASE_PAY[g.dist] * DIFF[g.diff].pay), best = g.stats.best[`${id}:${g.dist}`];
        return `<div class="grp"><small>Jarak · Distance</small><div class="chips">${Object.entries(DIST).map(([k, d]) => chip(g.dist === k, `data-dist="${k}"`, d.bm)).join('')}</div></div>
          <div class="grp"><small>Lawan · Opponent</small><div class="chips">${Object.entries(DIFF).map(([k, d]) => chip(g.diff === k, `data-diff="${k}"`, d.bm, `×${d.pay}`)).join('')}</div></div>
          <div class="grp two"><div><small>Gearbox</small><div class="chips">${chip(g.gearbox === 'manual', 'data-gb="manual"', 'Manual')}${chip(g.gearbox === 'auto', 'data-gb="auto"', 'Auto')}</div></div><div><small>Masa · Time</small><div class="chips">${chip(!R.night, 'data-time="day"', '☀️')}${chip(R.night, 'data-time="night"', '🌙')}</div></div></div>
          <div class="sum"><span>Hadiah menang</span><b>${fmtRM(pay)}</b></div><div class="sum dim"><span>Rekod ${DIST[g.dist].bm}</span><b>${best ? best.toFixed(3) + 's' : '—'}</b></div><div class="sum dim"><span>Menang</span><b>${g.stats.wins}/${g.stats.races}</b></div>`; }
      if (R.tab === 'parts' || R.tab === 'style') {
        const list = R.tab === 'parts' ? ['engine', 'turbo', 'exhaust', 'trans', 'tyres', 'nitrous', 'swing', 'launch'] : ['rims', 'body', 'spoiler', 'susp'];
        let html = slotsFor(id).filter(s => list.includes(s)).map(s => { const P = PARTS[s]; return `<div class="grp"><small>${P.ic} ${P.bm} · ${P.en}</small><div class="chips">${P.tiers.map((t, i) => { const owned = i === 0 || c.own[`${s}:${i}`], on = (c.parts[s] || 0) === i, conf = R.confirm === `${s}:${i}`;
          const pv = R.pv && R.pv.key === `part:${s}:${i}`; return chip(on && !(R.pv && R.pv.slot === s), `data-part="${s}:${i}" title="${t.en || ''}"`, t.bm, pv ? '👁 ' + fmtRM(partPrice(id, s, i)) : on ? '✔ dipasang' : owned ? 'pasang' : fmtRM(partPrice(id, s, i)), `${owned ? 'own' : 'price'} ${pv ? 'pv' : ''}`); }).join('')}</div></div>`; }).join('');
        if (R.tab === 'style') {
          html = `<div class="grp"><small>🎨 Cat · Paint — ${fmtRM(PAINT_PRICE)} · metalik ${fmtRM(PAINT_METAL)}</small><div class="sws">${PAINTS.map(p => `<button class="sw ${(R.pv && R.pv.type === 'paint' ? R.pv.color === p : c.paint === p) ? 'on' : ''} ${R.pv && R.pv.type === 'paint' && R.pv.color === p ? 'pv' : ''}" data-paint="${p}" style="background:${p}"></button>`).join('')}</div><label class="met"><input type="checkbox" data-metal ${(R.metal ?? c.metal) ? 'checked' : ''}> Metalik · Metallic</label></div>
            <div class="grp"><small>🏷️ Pelekat · Wrap & decals</small><div class="chips">${Object.entries(VINYLS).map(([k, v]) => { const o = k === 'none' || c.vinyls[k], conf = R.confirm === 'vinyl:' + k; const pv = R.pv && R.pv.key === 'vinyl:' + k; return chip(c.vinyl === k && !(R.pv && R.pv.type === 'vinyl'), `data-vinyl="${k}"`, v.bm, pv ? '👁 ' + fmtRM(v.price) : c.vinyl === k ? '✔' : o ? 'pakai' : fmtRM(v.price), `${o ? 'own' : 'price'} ${pv ? 'pv' : ''}`); }).join('')}</div></div>
            <div class="grp"><small>💡 Neon bawah · Underglow ${c.own.neon ? '' : '— ' + fmtRM(NEON_PRICE)}</small><div class="sws">${chip(!c.neon, 'data-neon=""', 'Tiada')}${NEONS.map(n => `<button class="sw ${(R.pv && R.pv.type === 'neon' ? R.pv.color === n : c.neon === n) ? 'on' : ''} ${R.pv && R.pv.type === 'neon' && R.pv.color === n ? 'pv' : ''}" data-neon="${n}" style="background:${n};box-shadow:0 0 10px ${n}"></button>`).join('')}</div></div>` + html; }
        return html; }
      if (R.tab === 'tune') { const P = buildSpec(id, c);
        const sl = (k, lab, min, max, stp, val, ok, need, fmt) => `<div class="grp tune ${ok ? '' : 'lock'}"><small>${lab}</small><div class="tr"><input type="range" min="${min}" max="${max}" step="${stp}" value="${val}" data-tune="${k}" ${ok ? '' : 'disabled'}><b>${fmt(val)}</b></div>${ok ? '' : `<em>🔒 Perlu ${need}</em>`}</div>`;
        return sl('height', '🔩 Tinggi badan · Ride height', -6, 4, 1, c.height || 0, c.parts.susp >= 1, 'Suspensi Laras', v => `${v > 0 ? '+' : ''}${v} cm`)
          + sl('final', '⚙️ Final drive', .85, 1.2, .01, c.final || 1, c.parts.trans >= 1, 'Gearbox Sport', v => `${(VEHICLES[id].final * v).toFixed(2)}`)
          + sl('spread', '📶 Jarak gear · Gear spread', .85, 1.15, .01, c.spread || 1, c.parts.trans >= 2, 'Gearbox Lumba', v => `${Math.round((v - 1) * 100)}%`)
          + sl('launchRpm', '🚦 RPM lancar · Launch rpm', P.idle + 500, P.limiter - 300, 50, c.launchRpm || Math.round(P.peakRpm * .8), c.parts.launch >= 1, 'Launch Control', v => `${Math.round(v)}`)
          + `<p class="muted">Nisbah · Ratios: ${P.gears.map(x => (x * P.final).toFixed(2)).join(' · ')}<br>Final tinggi = pecutan kuat · Final rendah = laju akhir tinggi.</p>`; }
      return '';
    }
    function bindPanel(id, c) {
      const P = main.querySelector('.jdDrawer'); if (!P) return;
      P.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => { sfx.tap(); R.browse[R.cat] = b.dataset.pick; clearPv(); garageUI(); });
      const sel = P.querySelector('[data-sel]'); if (sel) sel.onclick = () => { sfx.good(); g.sel[R.cat] = id; save(); garageUI(); };
      const bv = P.querySelector('[data-buyveh]'); if (bv) bv.onclick = () => { if (R.confirm !== 'veh') { R.confirm = 'veh'; sfx.tap(); return garageUI(); } const res = buyVehicle(g, id, W); R.confirm = null; if (res.ok) { g.sel[R.cat] = id; save(); sfx.good(); msg(`${VEHICLES[id].bm} milik anda!`, 1.8, 'good'); showId = null; } else fail(res); garageUI(); };
      P.querySelectorAll('[data-dist]').forEach(b => b.onclick = () => { sfx.tap(); g.dist = b.dataset.dist; save(); garageUI(); });
      P.querySelectorAll('[data-diff]').forEach(b => b.onclick = () => { sfx.tap(); g.diff = b.dataset.diff; save(); garageUI(); });
      P.querySelectorAll('[data-gb]').forEach(b => b.onclick = () => { sfx.tap(); g.gearbox = b.dataset.gb; save(); garageUI(); });
      P.querySelectorAll('[data-time]').forEach(b => b.onclick = () => { sfx.tap(); R.night = b.dataset.time === 'night'; garageUI(); });
      const go = main.querySelector('[data-race]'); if (go) go.onclick = () => { sfx.tap(); if (!g.cars[id]) return; clearPv(); g.sel[R.cat] = id; save(); startRace(); };
      // tap an item you don't own → preview it on the car (free); BELI in the bar (or tap it again) buys and fits it for good
      const setPv = (pv) => { if (R.pv && R.pv.key === pv.key) return buyPv(); R.pv = { id, ...pv }; sfx.tap(); garageUI(); };
      const done = (res, okMsg) => { if (res.ok) { save(); clearPv(); sfx.good(); if (okMsg) msg(okMsg, 1.4, 'good'); } else fail(res); garageUI(); };
      const buyPv = () => { if (!R.pv) return; const pv = R.pv; done(pv.buy(), `${pv.label} — dibeli!`); };
      const pb = P.querySelector('[data-pvbuy]'); if (pb) pb.onclick = buyPv;
      const pc = P.querySelector('[data-pvcancel]'); if (pc) pc.onclick = () => { sfx.tap(); clearPv(); garageUI(); };
      P.querySelectorAll('[data-part]').forEach(b => b.onclick = () => { const [s2, ti] = b.dataset.part.split(':'), i = +ti, owned = i === 0 || c.own[`${s2}:${i}`];
        if (owned) { const res = buyPart(g, id, s2, i, W); clearPv(); if (res.ok) { save(); sfx.tap(); } else fail(res); return garageUI(); }
        setPv({ type: 'part', slot: s2, key: `part:${s2}:${i}`, label: `${PARTS[s2].bm}: ${PARTS[s2].tiers[i].bm}`, price: partPrice(id, s2, i), apply: (c2) => { c2.parts[s2] = i; }, buy: () => buyPart(g, id, s2, i, W) }); });
      const met = P.querySelector('[data-metal]'); if (met) met.onchange = () => { R.metal = met.checked; const col = R.pv && R.pv.type === 'paint' ? R.pv.color : c.paint; if (col === c.paint && R.metal === c.metal) clearPv(); else paintPv(col); garageUI(); };
      const paintPv = (col) => { const m = R.metal ?? c.metal; R.pv = { id, type: 'paint', color: col, key: `paint:${col}:${m}`, label: `Cat ${m ? 'metalik' : 'kilat'}`, price: m ? PAINT_METAL : PAINT_PRICE, apply: (c2) => { c2.paint = col; c2.metal = m; }, buy: () => buyPaint(g, id, col, m, W) }; };
      P.querySelectorAll('[data-paint]').forEach(b => b.onclick = () => { const col = b.dataset.paint, m = R.metal ?? c.metal; if (c.paint === col && c.metal === m) { clearPv(); sfx.tap(); return garageUI(); }
        if (R.pv && R.pv.key === `paint:${col}:${m}`) return buyPv(); paintPv(col); sfx.tap(); garageUI(); });
      P.querySelectorAll('[data-vinyl]').forEach(b => b.onclick = () => { const v = b.dataset.vinyl, own = v === 'none' || c.vinyls[v];
        if (own) { const res = buyVinyl(g, id, v, W); clearPv(); if (res.ok) { save(); sfx.tap(); } else fail(res); return garageUI(); }
        setPv({ type: 'vinyl', key: 'vinyl:' + v, label: `Pelekat ${VINYLS[v].bm}`, price: VINYLS[v].price, apply: (c2) => { c2.vinyl = v; }, buy: () => buyVinyl(g, id, v, W) }); });
      P.querySelectorAll('[data-neon]').forEach(b => b.onclick = () => { const n = b.dataset.neon;
        if (!n || c.own.neon) { const res = buyNeon(g, id, n, W); clearPv(); if (res.ok) { save(); sfx.tap(); } else fail(res); return garageUI(); }
        setPv({ type: 'neon', color: n, key: 'neon:' + n, label: 'Kit neon bawah', price: NEON_PRICE, apply: (c2) => { c2.neon = n; }, buy: () => buyNeon(g, id, n, W) }); });
      P.querySelectorAll('[data-tune]').forEach(inp => { const lab = inp.nextElementSibling; inp.oninput = () => { setTune(g, id, inp.dataset.tune, +inp.value); }; inp.onchange = () => { save(); if (inp.dataset.tune === 'height') showId = null; garageUI(); }; });
    }
    // ----------------------------------------------- RACE
    function startRace() {
      const cat = R.cat, id = g.sel[cat], c = g.cars[id];
      const P = buildSpec(id, c), opp = makeOpponent(g, cat, g.dist, g.diff);
      const me = { id, c, P, S: newState(P), v: buildVehicle(T, K, id, c, { number: 7 }), lane: -LANE, react: null, foul: false, perfect: 0, early: 0, late: 0, lastLimiter: 0 };
      const ai = { id: opp.id, c: opp.c, P: opp.P, S: newState(opp.P), v: buildVehicle(T, K, opp.id, opp.c, { number: 3 + Math.floor(Math.random() * 90) }), lane: LANE, name: opp.name, react: opp.react, drv: driver(opp.P, opp.q), q: opp.q };
      for (const x of [me, ai]) { scene.add(x.v.root); x.L = x.v.root.userData.dims.L; x.z0 = x.L / 2 - .1; x.v.root.position.set(x.lane, 0, 14); }
      for (const [k, gg] of Object.entries(gantries)) gg.visible = k === g.dist;
      race = { me, ai, dist: DIST[g.dist].m, distId: g.dist, phase: 'intro', t: 0, tree: 0, green: 0, acc: 0, gas: 0, shiftUp: false, shiftDown: false, nos: false, burn: false, done: false, finishT: 0, auto: g.gearbox === 'auto', results: null, cam: R.cam, camT: 0 };
      setNight(R.night); R.mode = 'race'; turn.visible = false; buildRaceHUD(); msg('Kotak burnout', 1.4);
      try { race.eng = loopSound('engine'); } catch { race.eng = null; } musicDuck(true);
    }
    function setNight(n) { scene.background.setHex(n ? 0x0b1430 : 0x9fd6ee); scene.fog.color.setHex(n ? 0x0b1430 : 0x9fd6ee); sun.intensity = n ? .25 : 2.4; if (hemi) hemi.intensity = n ? .55 : 1.9; poleM.emissiveIntensity = n ? 2.2 : 0; }
    function endRace() { if (!race) return; for (const x of [race.me, race.ai]) { scene.remove(x.v.root); disposeTree(x.v.root); } race.eng && race.eng.stop && race.eng.stop(); race = null; musicDuck(false); setNight(false); turn.visible = true; for (const s of skids) s.position.z = 999; R.cam = R.cam; garageUI(); }
    function buildRaceHUD() {
      const me = race.me;
      main.innerHTML = `<div class="jdBar"><span class="nm me">${VEHICLES[me.id].bm}</span><div class="trk"><i class="me"></i><i class="ai"></i></div><span class="nm ai">${race.ai.name}</span></div>
        <div class="jdLights"><i class="pre"></i><i class="stg"></i><i class="a0"></i><i class="a1"></i><i class="a2"></i><i class="gr"></i><b class="rt"></b></div>
        <button class="jdStage" data-b="stage">KE GARISAN ▶</button>
        <button class="jdCam" data-b="cam">📷</button>
        <canvas class="jdTach" width="320" height="200"></canvas>
        <div class="jdLeft"><button class="jb nos" data-b="nos" ${me.P.nos ? '' : 'hidden'}><i>💜</i><b>NITRO</b><small class="nosLeft"></small></button><button class="jb dn" data-b="dn"><b>▼</b></button>
          <button class="jb main" data-b="main"><i class="ic">🔥</i><b class="lb">BURNOUT</b><small class="sb">tahan · hold</small></button></div>
        <div class="jdPedal"><b>GAS</b><i></i><small></small></div>`;
      tachCtx = main.querySelector('.jdTach').getContext('2d');
      const ped = main.querySelector('.jdPedal'); let pid = null;
      const pset = (e) => { const rc = ped.getBoundingClientRect(); race && (race.gas = clamp(.45 + .65 * (e.clientY - rc.top) / rc.height, .45, 1)); };
      ped.addEventListener('pointerdown', (e) => { e.preventDefault(); pid = e.pointerId; try { ped.setPointerCapture(pid); } catch { } ped.classList.add('on'); pset(e); });
      ped.addEventListener('pointermove', (e) => { if (e.pointerId === pid) pset(e); });
      const pup = (e) => { if (e.pointerId !== pid) return; pid = null; ped.classList.remove('on'); if (race) race.gas = 0; };
      ped.addEventListener('pointerup', pup); ped.addEventListener('pointercancel', pup);
      main.querySelectorAll('[data-b]').forEach(b => { const k = b.dataset.b; let bp = null;
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); bp = e.pointerId; try { b.setPointerCapture(bp); } catch { } b.classList.add('on'); press(k, true); });
        const up = (e) => { if (e.pointerId !== bp) return; bp = null; b.classList.remove('on'); press(k, false); }; b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); });
    }
    let tachCtx = null;
    // the big left button changes with the phase: BURNOUT (hold) → LANCAR (hold, release on green) → GEAR ▲
    function press(k, on) {
      if (!race || paused) return;
      if (k === 'main') k = race.phase === 'burnout' ? 'burn' : 'up';
      if (k === 'burn') { race.burn = on && race.phase === 'burnout'; return; }
      if (k === 'up') { const me = race.me;
        if (race.phase === 'tree' && !me.S.launched) { if (on) { race.held = true; } else if (race.held) { race.held = false; doLaunch(); } return; }
        if (on && race.phase === 'run' && !race.auto && me.S.launched) race.shiftUp = true; return; }
      if (!on) return;
      if (k === 'stage' && race.phase === 'burnout') { race.phase = 'staging'; race.t = 0; race.burn = false; sfx.tap(); msg('Masuk garisan…', 1.2); }
      else if (k === 'up2') { if (race.phase === 'run' && !race.auto) race.shiftUp = true; }
      else if (k === 'dn') { if (race.phase === 'run' && !race.auto) race.shiftDown = true; }
      else if (k === 'nos') { if (race.phase === 'run' && race.me.S.launched) race.nos = true; }
      else if (k === 'cam') { const order = ['chase', 'side', 'line']; R.cam = order[(order.indexOf(R.cam) + 1) % 3]; g.view = R.cam; race.camT = 0; sfx.tap(); }
    }
    function doLaunch() {
      const me = race.me; if (me.S.launched) return;
      const t = race.tree; if (!race.green || t < race.green) { me.foul = true; msg('LAMPU MERAH!', 2, 'bad'); sfx.bad(); }
      me.react = t - (race.green || t); launch(me.P, me.S); race.phase = 'run'; race.camT = 0;
      if (!me.foul) { const rt = me.react; msg(`RT ${rt.toFixed(3)}${rt < .1 ? ' · SEMPURNA!' : rt < .2 ? ' · Bagus' : ''}`, 1.2, rt < .1 ? 'good' : ''); }
      for (let k = 0; k < 40; k++) smokeAt(me, 1.4);
    }
    let redSide = [false, false]; const treeRed = (s) => { redSide[s] = true; };
    // keyboard
    const keys = { gas: false };
    const onKey = (e) => { if (!root.isConnected) return; const d = e.type === 'keydown'; const c = e.code;
      if (c === 'KeyW' || c === 'ArrowUp') { e.preventDefault(); keys.gas = d; if (race) race.gas = d ? 1 : 0; return; }
      if (c === 'Space' || c === 'ArrowRight' || c === 'KeyE') { e.preventDefault(); if (!e.repeat) press('up', d); return; }
      if (e.repeat || !d) { if (c === 'KeyB') press('burn', false); return; }
      if (false) { } else if (c === 'ArrowLeft' || c === 'KeyQ') press('dn', true); else if (c === 'KeyN') press('nos', true); else if (c === 'KeyB') press('burn', true); else if (c === 'KeyC') press('cam', true); else if (c === 'Enter') press('stage', true); else if (c === 'KeyP' || c === 'Escape') togglePause(); };
    addEventListener('keydown', onKey); addEventListener('keyup', onKey);
    // pause
    let paused = false; q('.f3Pause').onclick = () => { sfx.tap(); togglePause(); };
    function togglePause() { paused = !paused; over.hidden = !paused; if (!paused) return;
      over.innerHTML = `<div class="f3Card"><h2>JALAN DRAG</h2><p class="muted">💵 ${fmtRM(balance())}</p><div class="f3Row"><button class="f3B primary" data-o="r">▶ Teruskan</button>${race ? '<button class="f3B" data-o="g">🔧 Batal ke Garaj</button>' : ''}<button class="f3B" data-o="x">🏠 Kembali ke Kampung</button></div></div>`;
      over.querySelector('[data-o="r"]').onclick = () => togglePause(); const gb = over.querySelector('[data-o="g"]'); if (gb) gb.onclick = () => { togglePause(); endRace(); };
      over.querySelector('[data-o="x"]').onclick = () => { paused = false; exit(); }; }
    function exit() { api.finish({ stars: 0, res: 'quit', races: sess.races, wins: sess.wins, earned: sess.earned }); }
    const sess = { races: 0, wins: 0, earned: 0 };
    // ----------------------------------------------- race loop
    function smokeAt(x, n = 1) { const P = x.P, z = x.v.root.position.z, rearZ = P.bike ? z + x.L * .35 : x.P.drive === 'F' ? z - x.L * .3 : z + x.L * .3, xs = P.bike ? [0] : [-.7, .7];
      for (let k = 0; k < n * quality; k++) for (const dx of xs) smoke.add(x.lane + dx + (Math.random() - .5) * .4, .25, rearZ + (Math.random() - .5) * .5, (Math.random() - .5) * 1.6, .8 + Math.random() * 1.6, 1 + Math.random() * 2.5, 1.6 + Math.random()); }
    function exhaustFx(x, kind) { for (const p of x.v.exhausts) { const wx = x.lane + p.x, wy = p.y, wz = x.v.root.position.z + p.z; if (kind === 'nos') nosFx.add(wx, wy, wz, (Math.random() - .5) * .4, (Math.random() - .3) * .4, 3 + Math.random() * 3, .25); else fire.add(wx, wy, wz, (Math.random() - .5) * .5, Math.random() * .5, 2 + Math.random() * 2, .18); } }
    function raceUpdate(dt) {
      const rc = race, me = rc.me, ai = rc.ai; rc.t += dt;
      if (rc.phase === 'intro') { if (rc.t > 1.8) { rc.phase = 'burnout'; rc.t = 0; msg('Tahan BURNOUT + GAS · panaskan tayar', 2.2); } }
      if (rc.phase === 'burnout') { if (rc.t > 1 && rc.t < 3.5) { aiInput(ai, true); } if (rc.t > 14) { rc.phase = 'staging'; rc.t = 0; } }
      if (rc.phase === 'staging') { const k = Math.min(1, rc.t / 2.6); for (const x of [me, ai]) x.v.root.position.z = 14 + (x.z0 - 14) * (k * k * (3 - 2 * k)); if (k >= 1) { rc.phase = 'tree'; rc.tree = 0; rc.green = 0; rc.amberAt = 1.6 + Math.random() * 1.2; msg('Tahan LANCAR + GAS · lepas bila HIJAU', 2); } }
      if (rc.phase === 'tree' || rc.phase === 'run') { rc.tree += dt; if (!rc.green && rc.tree >= rc.amberAt + 1.5) { rc.green = rc.amberAt + 1.5; sfx.star && sfx.star(2); } if (rc.phase === 'tree' && rc.green && rc.tree > rc.green + 4 && !me.S.launched) { rc.held = false; doLaunch(); } }
      // AI launch
      if (rc.green && !ai.S.launched && rc.tree >= rc.green + ai.react) { ai.S.rpm = ai.P.bestLaunch; launch(ai.P, ai.S); }
      // fixed-step physics for both
      rc.acc = Math.min(rc.acc + dt, .25);
      while (rc.acc >= DT) { rc.acc -= DT;
        const inMe = { gas: rc.gas || (keys.gas ? 1 : 0), burnout: rc.phase === 'burnout' && rc.burn, nos: rc.nos, shiftUp: rc.shiftUp, shiftDown: rc.shiftDown };
        if (me.S.launched && rc.auto && me.S.shiftT <= 0 && me.S.gear < me.P.gears.length && me.S.rpm >= shiftRpm(me.P, me.S.gear) * .985) inMe.shiftUp = true;
        if (me.S.done) { inMe.gas = 0; inMe.nos = false; }
        const sh = me.S.gear; step(me.P, me.S, inMe); if (me.S.shiftedThisStep && inMe.shiftUp && !rc.auto) gradeShift(me, sh); rc.shiftUp = rc.shiftDown = false;
        if (me.S.launched) me.S.burnout = false;
        if (ai.S.launched) { const inp = ai.S.done ? { gas: 0 } : ai.drv.input(ai.S); step(ai.P, ai.S, inp); } else step(ai.P, ai.S, aiInput(ai, rc.phase === 'burnout' && rc.t > 1 && rc.t < 3.5));
        for (const x of [me, ai]) if (x.S.launched && !x.S.done && x.S.x >= rc.dist) { const over = x.S.x - rc.dist; x.S.done = true; x.S.et = x.S.t - over / Math.max(1, x.S.v); x.S.trap = x.S.v; }
      }
      if (me.S.limiterT > me.lastLimiter + .25 && !rc.auto) { me.lastLimiter = me.S.limiterT; msg('TUKAR GEAR!', .5, 'bad'); }
      // after the finish: brake and coast
      for (const x of [me, ai]) if (x.S.done) { x.S.v = Math.max(0, x.S.v - 9 * dt); x.S.x += x.S.v * dt; }
      if (me.S.done && !rc.results && (ai.S.done || rc.tree > rc.green + 60 || ai.S.t > me.S.et + 8)) results();
      // visuals
      for (const x of [me, ai]) { x.v.root.position.z = x.z0 - x.S.x; x.v.update(dt, x.S);
        if (x.S.slip || (rc.phase === 'burnout' && x.S.spin > 5)) { smokeAt(x, x.S.spin > 20 ? 2 : 1); if (x.S.launched && Math.random() < .5) skid(x.lane + (x.P.bike ? 0 : -.7), x.v.root.position.z + (x.P.drive === 'F' ? -x.L * .3 : x.L * .3), x.P.bike ? .14 : .28), x.P.bike || skid(x.lane + .7, x.v.root.position.z + (x.P.drive === 'F' ? -x.L * .3 : x.L * .3), .28); }
        if (x.S.nosOn) exhaustFx(x, 'nos'); else if ((x.S.shiftedThisStep || (x.S.shiftT > 0 && Math.random() < .3)) && x.c.parts.exhaust >= 1) exhaustFx(x, 'fire');
        if (x.S.rpm > x.P.limiter - 150 && Math.random() < .3 && x.c.parts.exhaust >= 2) exhaustFx(x, 'fire'); }
      // tree lights
      const amb = rc.phase === 'tree' && rc.tree >= rc.amberAt ? Math.min(3, Math.floor((rc.tree - rc.amberAt) / .5) + 1) : 0;
      treeSet({ pre: [rc.phase !== 'intro' && rc.phase !== 'burnout', rc.phase !== 'intro' && rc.phase !== 'burnout'], stg: [rc.phase === 'tree' || rc.phase === 'run', rc.phase === 'tree' || rc.phase === 'run'], amb: rc.green ? 0 : amb, grn: rc.green && rc.tree >= rc.green ? [!me.foul, true] : null, red: [me.foul, false] });
      // engine sound
      if (rc.eng && rc.eng.set) rc.eng.set(rc.phase === 'intro' ? .04 : .15, (me.P.bike ? 70 : 40) + me.S.rpm / me.P.limiter * (me.P.bike ? 260 : 200));
      // crowd
      if (rc.phase === 'run') for (let k = 0; k < crowd.length; k += 3) crowd[k].position.y = .9 + (k % 5) * .55 + Math.abs(Math.sin(t * 9 + k)) * .15;
      raceHUD();
    }
    function aiInput(x, burning) { return { gas: burning ? .85 : (race.phase === 'tree' ? clamp((x.P.bestLaunch - x.P.idle) / (x.P.limiter - x.P.idle), 0, 1) : .2), burnout: burning }; }
    function gradeShift(x, from) { const best = shiftRpm(x.P, from), rpm = x.S.shifts[x.S.shifts.length - 1].rpm * x.P.limiter;
      if (rpm >= best * .95 && rpm < x.P.limiter - 40) { x.perfect++; msg('SEMPURNA!', .6, 'good'); sfx.good(); } else if (rpm < best * .95) { x.early++; msg('Awal', .5); } else { x.late++; msg('Lewat', .5, 'bad'); } }
    function raceHUD() {
      const rc = race, me = rc.me, S2 = me.S, P = me.P, ph = rc.phase;
      const tr = main.querySelector('.jdBar .trk'); if (tr) { tr.querySelector('.me').style.left = `${clamp(S2.x / rc.dist, 0, 1) * 100}%`; tr.querySelector('.ai').style.left = `${clamp(rc.ai.S.x / rc.dist, 0, 1) * 100}%`; }
      const L = main.querySelector('.jdLights'); if (L) { const amb = ph === 'tree' && rc.tree >= rc.amberAt && !rc.green ? Math.min(3, Math.floor((rc.tree - rc.amberAt) / .5) + 1) : 0, green = rc.green && rc.tree >= rc.green;
        L.querySelector('.pre').className = 'pre' + (ph !== 'intro' && ph !== 'burnout' ? ' on' : ''); L.querySelector('.stg').className = 'stg' + (ph === 'tree' || ph === 'run' || ph === 'done' ? ' on' : '');
        for (let a = 0; a < 3; a++) L.querySelector('.a' + a).className = 'a' + a + (amb > a ? ' on' : ''); L.querySelector('.gr').className = 'gr' + (green ? (me.foul ? ' red' : ' on') : me.foul ? ' red' : '');
        L.querySelector('.rt').textContent = me.react !== null ? (me.foul ? 'MERAH' : me.react.toFixed(3)) : ''; }
      root.classList.toggle('jdBurn', ph === 'burnout'); root.classList.toggle('jdRun', ph === 'run');
      const mb = main.querySelector('.jb.main'); if (mb) { const st = ph === 'burnout' ? ['🔥', 'BURNOUT', 'tahan + GAS'] : !S2.launched ? ['🚦', 'LANCAR', rc.held ? 'lepas bila HIJAU' : 'tahan · hold'] : rc.auto ? ['⚙️', 'AUTO', `gear ${S2.gear}`] : ['▲', 'GEAR', `gear ${S2.gear}`];
        if (mb.dataset.st !== st[1] + st[2]) { mb.dataset.st = st[1] + st[2]; mb.querySelector('.ic').textContent = st[0]; mb.querySelector('.lb').textContent = st[1]; mb.querySelector('.sb').textContent = st[2]; }
        const best = S2.gear ? shiftRpm(P, Math.max(1, S2.gear)) : 0; mb.classList.toggle('hot', (ph === 'tree' && rc.green && rc.tree >= rc.green && !S2.launched) || (ph === 'run' && !rc.auto && S2.locked && S2.rpm >= best * .97 && S2.gear < P.gears.length)); mb.classList.toggle('held', !!rc.held); }
      const nl = main.querySelector('.nosLeft'); if (nl && P.nos) nl.textContent = S2.nosUsed ? 'habis' : S2.nosOn ? `${(P.nos.dur - S2.nos).toFixed(1)}s` : 'sedia';
      const gas = rc.gas || (keys.gas ? 1 : 0), pd = main.querySelector('.jdPedal i'); if (pd) pd.style.height = `${gas * 100}%`; const ps = main.querySelector('.jdPedal small'); if (ps) ps.textContent = `${Math.round(gas * 100)}%`;
      if (tachCtx) drawTach(tachCtx, me);
    }
    function drawTach(x, me) { // compact round tach: green shift band, red line, shift lights, gear, speed, boost & tyre temp
      const S2 = me.S, P = me.P, w = 320, h = 200, cx = 160, cy = 118, R0 = 86; x.clearRect(0, 0, w, h);
      x.fillStyle = 'rgba(6,9,14,.72)'; x.beginPath(); x.arc(cx, cy, R0 + 18, 0, 7); x.fill();
      const A = (f) => Math.PI * (.75 + f * 1.5), max = P.limiter * 1.06, best = S2.gear ? shiftRpm(P, Math.max(1, S2.gear)) : (P.bestLaunch || P.peakRpm);
      x.lineWidth = 9; x.lineCap = 'butt'; x.strokeStyle = 'rgba(255,255,255,.14)'; x.beginPath(); x.arc(cx, cy, R0, A(0), A(1)); x.stroke();
      x.strokeStyle = '#2ecc71'; x.beginPath(); x.arc(cx, cy, R0, A(best * .95 / max), A(Math.min(best * 1.01, P.limiter) / max)); x.stroke();
      x.strokeStyle = '#e74c3c'; x.beginPath(); x.arc(cx, cy, R0, A(P.limiter / max), A(1)); x.stroke();
      x.fillStyle = 'rgba(255,255,255,.75)'; x.font = '700 12px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle';
      for (let k = 0; k <= Math.floor(max / 1000); k++) { const a = A(k * 1000 / max); x.fillText(k, cx + Math.cos(a) * (R0 - 17), cy + Math.sin(a) * (R0 - 17)); }
      const a = A(clamp(S2.rpm / max, 0, 1)); x.strokeStyle = '#ff4d2e'; x.lineWidth = 3.5; x.lineCap = 'round'; x.beginPath(); x.moveTo(cx - Math.cos(a) * 10, cy - Math.sin(a) * 10); x.lineTo(cx + Math.cos(a) * (R0 - 2), cy + Math.sin(a) * (R0 - 2)); x.stroke();
      const f = S2.rpm / best, flash = f > .985 && Math.floor(t * 14) % 2; for (let k = 0; k < 5; k++) { const on = f > .86 + k * .03; x.fillStyle = flash ? '#3aa0ff' : on ? (k < 2 ? '#2ecc71' : k < 4 ? '#f1c40f' : '#e74c3c') : 'rgba(255,255,255,.12)'; x.beginPath(); x.arc(cx - 44 + k * 22, cy - 46, 5.5, 0, 7); x.fill(); }
      x.fillStyle = '#ffd452'; x.font = '900 40px system-ui'; x.fillText(S2.launched ? (S2.shiftT > 0 ? '–' : S2.gear) : 'N', cx, cy - 4);
      x.fillStyle = '#fff'; x.font = '900 20px system-ui'; x.fillText(`${Math.round(S2.v * 3.6)}`, cx, cy + 34); x.font = '700 9px system-ui'; x.fillStyle = 'rgba(255,255,255,.7)'; x.fillText('KM/J', cx, cy + 50);
      const bar = (lx, label, v, col) => { x.textAlign = 'left'; x.font = '800 9px system-ui'; x.fillStyle = 'rgba(255,255,255,.7)'; x.fillText(label, lx, 176); x.fillStyle = 'rgba(255,255,255,.15)'; x.fillRect(lx, 183, 54, 6); x.fillStyle = col; x.fillRect(lx, 183, 54 * clamp(v, 0, 1), 6); };
      bar(14, 'TAYAR', S2.temp / 1.5, S2.temp > 1.35 ? '#e74c3c' : S2.temp > .75 ? '#2ecc71' : '#f39c12'); if (P.turbo) bar(252, 'BOOST', S2.boost, '#00d2ff'); else if (P.nos) bar(252, 'NITRO', S2.nosUsed ? 0 : 1 - S2.nos / P.nos.dur, '#8a5bff');
      x.textAlign = 'center'; if (S2.slip) { x.fillStyle = '#ff7a6a'; x.font = '900 11px system-ui'; x.fillText('PUSING RODA', cx, 192); } else if (P.bike && S2.pitch > .2) { x.fillStyle = '#ffd452'; x.font = '900 11px system-ui'; x.fillText('WHEELIE', cx, 192); } else if (S2.launched) { x.fillStyle = '#fff'; x.font = '800 11px system-ui'; x.fillText(`${S2.t.toFixed(2)}s · ${Math.round(S2.x)}m`, cx, 192); }
    }
    function results() {
      const rc = race, me = rc.me, ai = rc.ai; if (rc.results) return;
      if (!ai.S.done) { // finish the AI's run quickly
        for (let i = 0; i < 240 * 40 && !ai.S.done; i++) { step(ai.P, ai.S, ai.drv.input(ai.S)); if (ai.S.x >= rc.dist) { ai.S.done = true; ai.S.et = ai.S.t; ai.S.trap = ai.S.v; } } }
      const meTot = me.foul ? 99 : me.react + me.S.et, aiTot = ai.react + ai.S.et, win = !me.foul && meTot < aiTot;
      const bk = `${me.id}:${rc.distId}`, prevBest = g.stats.best[bk] || 0, pb = !me.foul && (!prevBest || me.S.et < prevBest);
      if (pb) g.stats.best[bk] = me.S.et; g.stats.races++; if (win) g.stats.wins++; sess.races++; if (win) sess.wins++;
      const pay = payout({ win, dist: rc.distId, diff: g.diff, react: me.foul ? null : me.react, perfectShifts: me.perfect, pb: pb && !!prevBest, foul: me.foul });
      if (pay.total && !opts.practice) { earn(pay.total, `jalan drag ${rc.distId}`); sess.earned += pay.total; }
      save(); rc.results = { win, pay }; rc.phase = 'done'; win ? sfx.good() : sfx.bad(); if (win) sfx.cheer && sfx.cheer();
      const row = (l, a, b) => `<tr><td>${l}</td><td>${a}</td><td>${b}</td></tr>`;
      over.hidden = false; over.classList.add('jdRes');
      over.innerHTML = `<div class="f3Card jdResult ${win ? 'win' : 'loss'}"><div class="kick">${DIST[rc.distId].bm.toUpperCase()} · ${DIFF[g.diff].bm.toUpperCase()}</div><h2>${me.foul ? 'LAMPU MERAH!' : win ? '🏆 MENANG!' : 'KALAH'}</h2>
        <table><tr><th></th><th>${VEHICLES[me.id].bm} (anda)</th><th>${ai.name}</th></tr>
        ${row('Reaksi · RT', me.foul ? '<b class="bad">MERAH</b>' : me.react.toFixed(3), ai.react.toFixed(3))}${row('60 ft', (me.S.t60 || 0).toFixed(3), (ai.S.t60 || 0).toFixed(3))}
        ${row('ET', me.S.et.toFixed(3) + (pb ? ' <em>REKOD</em>' : ''), ai.S.et.toFixed(3))}${row('Laju akhir · Trap', `${Math.round(me.S.trap * 3.6)} km/j`, `${Math.round(ai.S.trap * 3.6)} km/j`)}${row('Jumlah · Total', me.foul ? '—' : meTot.toFixed(3), aiTot.toFixed(3))}</table>
        <p class="muted">Tukar gear: ${me.perfect} sempurna · ${me.early} awal · ${me.late} lewat${me.S.maxSpin > 15 ? ' · banyak pusing roda — cuba RPM lancar lebih rendah atau tayar lebih baik' : ''}</p>
        <ul class="jdPay">${pay.items.map(([l, v]) => `<li><span>${l}</span><b>${v ? '+' + fmtRM(v) : '—'}</b></li>`).join('')}<li class="tot"><span>Jumlah · Total${opts.practice ? ' (latihan: tiada bayaran)' : ''}</span><b>${fmtRM(opts.practice ? 0 : pay.total)}</b></li></ul>
        <div class="f3Row"><button class="f3B primary" data-r="again">🔁 Lumba Lagi</button><button class="f3B" data-r="garage">🔧 Garaj</button></div></div>`;
      over.querySelector('[data-r="again"]').onclick = () => { sfx.tap(); over.hidden = true; over.classList.remove('jdRes'); endRace(); startRace(); };
      over.querySelector('[data-r="garage"]').onclick = () => { sfx.tap(); over.hidden = true; over.classList.remove('jdRes'); endRace(); };
    }
    // ================================================= CAMERA
    const view = { pos: new T.Vector3(GX + 6, 2.2, 7), look: new T.Vector3(GX, .8, 0), halfW: 4, halfH: 2.5, snap: true };
    const cp = view.pos.clone(), cl = view.look.clone(), tp = new T.Vector3(), tl = new T.Vector3();
    let orbit = .7, orbitV = 0, dragX = null, t = 0;
    function cam(dt, k, fov) { const a = 1 - Math.exp(-dt * k); cp.lerp(tp, a); cl.lerp(tl, a); view.pos.copy(cp); view.look.copy(cl); const d = cp.distanceTo(cl); view.halfH = d * Math.tan(fov * Math.PI / 360); view.halfW = view.halfH * 1.5; }
    function camUpdate(dt) {
      if (!race) { // garage orbit: drag to rotate, slow auto spin
        if (dragX === null) orbit += dt * .15 + orbitV * dt; orbitV *= Math.exp(-dt * 3); turn.rotation.y = orbit;
        // 3/4 front view; with a drawer open the car is framed in the free space on the left
        const dims = show ? show.root.userData.dims : { L: 4, H: 1.4 }, dist = dims.L * 1.05 + 2.4, asp = Math.max(1, (window.innerWidth || 1) / Math.max(1, window.innerHeight));
        tp.set(GX - dist * .62, dims.H * .55 + .75, -dist * .78); const dx = -tp.x + GX, dz = -tp.z, dl = Math.hypot(dx, dz), rx = -dz / dl, rz = dx / dl, sh = R.tab ? dist * .2 * asp : 0;
        tl.set(GX + rx * sh, dims.H * .32, rz * sh); cam(dt, 4, 42); return; }
      const rc = race, me = rc.me, z = me.v.root.position.z, sp = me.S.v;
      let mode = rc.phase === 'intro' || rc.phase === 'staging' ? 'line' : rc.phase === 'burnout' ? 'burn' : rc.phase === 'tree' ? 'line' : rc.phase === 'done' ? 'orbit' : R.cam;
      if (rc.phase === 'run' && me.S.t < .6 && R.cam === 'line') mode = 'line';
      if (mode === 'line') { tp.set(me.lane + 2.3, .8, z - me.L / 2 - 4.6); tl.set(me.lane + .4, .75, z + .3); cam(dt, rc.phase === 'run' ? 1.5 : 3, 46); }
      else if (mode === 'burn') { tp.set(me.lane + 3.4, 1.15, z - 3.6); tl.set(me.lane, .6, z + me.L * .25); cam(dt, 3, 50); }
      else if (mode === 'side') { tp.set(-6.6, 1.25, z + .8); tl.set(me.lane + .6, .75, z - 1.2); cam(dt, 6, 48); }
      else if (mode === 'orbit') { const a = t * .4; tp.set(me.lane + Math.cos(a) * 7, 2.2, z + Math.sin(a) * 7); tl.set(me.lane, .8, z); cam(dt, 2.5, 48); }
      else { const back = 6.2 + Math.min(4, sp * .05), shk = rc.phase === 'run' ? (me.S.slip || me.S.nosOn ? .05 : .01) * Math.min(1, sp / 20 + .4) : 0; tp.set(me.lane * .6 + (Math.random() - .5) * shk, 2.1 + Math.min(1, sp * .012) + (Math.random() - .5) * shk, z + me.L / 2 + back); tl.set(me.lane * .4, .9, z - 14 - sp * .3); cam(dt, 8, 50 + Math.min(14, sp * .18)); }
      if (sun.target) { sun.position.set(me.lane - 10, 22, z + 12); sun.target.position.set(me.lane, 0, z - 8); }
    }
    garageUI();
    return {
      scene, view, ray() { return { ok: false }; },
      down(p) { if (!race) { dragX = p.sx; orbitV = 0; } }, move(p) { if (!race && dragX !== null && p.down) { const d = p.sx - dragX; dragX = p.sx; orbit += d * .012; orbitV = d * .6; } }, up() { dragX = null; },
      timerText: () => race ? (race.me.S.launched ? `${race.me.S.t.toFixed(2)}s` : '🚦') : fmtRM(balance()),
      dbg: () => ({ mode: R.mode, cat: R.cat, view: viewId(), phase: race && race.phase, me: race && { x: race.me.S.x, v: race.me.S.v, rpm: race.me.S.rpm, gear: race.me.S.gear, launched: race.me.S.launched, done: race.me.S.done, et: race.me.S.et, react: race.me.react, foul: race.me.foul, temp: race.me.S.temp, spin: race.me.S.spin }, ai: race && { x: race.ai.S.x, et: race.ai.S.et, done: race.ai.S.done }, results: race && race.results, quality }),
      sim: { g, press, startRace, endRace, race: () => race, R, garageUI, results },
      update(dt, p, camera) {
        if (camera && camera.far < 900) { camera.far = 900; camera.near = .1; }
        const tut = document.getElementById('gTut'); if (paused || (tut && !tut.hidden)) return;
        t += dt; frameAvg += (dt - frameAvg) * .05; if (frameAvg > 1 / 26 && quality > .4) { quality = .4; sun.castShadow = false; } // adaptive quality: fewer particles, no shadows
        if (race) raceUpdate(dt);
        camUpdate(dt); smoke.update(dt, -.6); fire.update(dt, 0); nosFx.update(dt, 0);
        if (msgT > 0) { msgT -= dt; if (msgT <= 0) q('.f3Msg').classList.remove('show'); }
      },
      stop() { removeEventListener('keydown', onKey); removeEventListener('keyup', onKey); if (race) { race.eng && race.eng.stop && race.eng.stop(); } musicDuck(false); root.remove(); $('game').classList.remove('f3mode'); save(); },
    };
  };
}
