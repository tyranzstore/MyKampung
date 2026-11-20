// BOLA TAMPAR PANTAI 3D (v2) — arcade 2v2 beach volleyball at Pantai Miami.
// You (the TYRANZ hero, posed procedurally) + an AI teammate vs two AI opponents. Rally scoring to 7 / 11 / 21, win by 2.
// Fixed-timestep ball physics (gravity, spin, swept net & ground collision — no tunnelling), max 3 contacts per side,
// block counts as a touch (beach rule), out of bounds / antenna / net faults, serve rotation inside each team.
// Controls: joystick (left) to move · one context button: SERVIS (hold & release) / TERIMA / SET / REJAM · LOMPAT/BLOK · SELAM.
import { $, clamp, sfx, S, save, seaAmbience, musicDuck } from './core.js';
import { makePosableHero, runPose, POSES } from './heropose.js';

const COURT = { hx: 4, hz: 8 }, NET = 2.24, BR = .11, GRAV = 9.0, DT = 1 / 120;
export const VB_DIFF = {
  mudah: { bm: 'Mudah', en: 'Easy', react: .45, speed: 4.4, err: .9, spike: .3, block: .1, serve: .55 },
  biasa: { bm: 'Biasa', en: 'Normal', react: .25, speed: 5.3, err: .5, spike: .65, block: .35, serve: .7 },
  sukar: { bm: 'Sukar', en: 'Hard', react: .12, speed: 6.1, err: .22, spike: .9, block: .6, serve: .85 },
};
const TEAM = [{ bm: 'KAMPUNG', col: 0xffd452, css: '#ffd452' }, { bm: 'PANTAI', col: 0xff6b5b, css: '#ff6b5b' }];

export function volleyScene({ T, environment, Sparks, palm, putModel, putAnimated, makeOcean, shoreWaves, textPlane, mulberry32 }) {
  return function Volley2(K, api, opts, M = {}) {
    const r = mulberry32(51);
    const scene = new T.Scene(); const sun = environment(K, scene, { sky: 0x8fd0f0, shadow: 14, fogNear: 60, fogFar: 170 });
    sun.position.set(-10, 22, 12); sun.intensity = 2.6; if (sun.target) scene.add(sun.target);
    // ================================================= BEACH + COURT
    const sand = K.canvasTex(512, 512); { const x = sand.x; x.fillStyle = '#efdcaa'; x.fillRect(0, 0, 512, 512); for (let k = 0; k < 9000; k++) { const v = 205 + Math.random() * 40; x.fillStyle = `rgba(${v},${v - 22},${v - 70},.5)`; x.fillRect(Math.random() * 512, Math.random() * 512, 2, 2); } for (let k = 0; k < 40; k++) { x.strokeStyle = 'rgba(180,150,100,.15)'; x.beginPath(); x.ellipse(Math.random() * 512, Math.random() * 512, 30 + Math.random() * 40, 6, Math.random() * 3, 0, 7); x.stroke(); } sand.t.wrapS = sand.t.wrapT = T.RepeatWrapping; sand.t.repeat && sand.t.repeat.set(10, 8); sand.t.needsUpdate = true; }
    K.mesh(new T.BoxGeometry(90, .2, 70), new T.MeshStandardMaterial({ map: sand.t, roughness: 1 }), 0, -.1, 4, scene, false);
    const ocean = makeOcean(T, { w: 300, h: 160, seg: .5, amp: .35, shoreY: -54, shoreFade: 14, deep: 0x0b4f78, shallow: 0x35b6cf, sky: 0xcdeefa, repeat: 30 }); ocean.mesh.position.set(0, -.06, -82); scene.add(ocean.mesh);
    const shore = shoreWaves(T, scene, { segs: [[-45, 45]], shoreZ: -28, seaward: -1, reach: 5, period: 6, width: 1.6, n: 4 });
    const tape = K.mat(0xffffff, { roughness: .6 }); const L = (w, d, x, z) => K.box(w, .025, d, tape, x, .01, z, scene, false);
    L(8.1, .1, 0, 8); L(8.1, .1, 0, -8); L(.1, 16.1, -4, 0); L(.1, 16.1, 4, 0); L(8, .05, 0, 0);
    // net: posts, a meshed net texture, white top band, antennas
    for (const x of [-4.7, 4.7]) { K.cyl(.07, .07, 2.7, K.mat(0x2e86de), x, 1.35, 0, scene, 10); K.box(.3, .1, .3, K.mat(0x2e86de), x, .05, 0, scene); }
    const netT = K.canvasTex(512, 64); { const x = netT.x; x.clearRect(0, 0, 512, 64); x.strokeStyle = 'rgba(20,20,20,.9)'; x.lineWidth = 2; for (let i = 0; i <= 512; i += 10) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 64); x.stroke(); } for (let j = 0; j <= 64; j += 10) { x.beginPath(); x.moveTo(0, j); x.lineTo(512, j); x.stroke(); } netT.t.needsUpdate = true; }
    K.mesh(new T.PlaneGeometry(9.4, .95), new T.MeshBasicMaterial({ map: netT.t, transparent: true, side: T.DoubleSide, alphaTest: .25, depthWrite: false }), 0, NET - .5, 0, scene, false);
    K.box(9.4, .07, .03, K.mat(0xffffff), 0, NET - .03, 0, scene, false); K.box(9.4, .05, .03, K.mat(0x1f6fd1), 0, NET - .98, 0, scene, false);
    for (const x of [-4, 4]) { K.cyl(.012, .012, .9, K.mat(0xff3b30), x, NET + .4, 0, scene, 6); for (let k = 0; k < 4; k++) K.cyl(.014, .014, .1, K.mat(0xffffff), x, NET + .1 + k * .22, 0, scene, 6); }
    // scenery: palms, umbrellas, spectators on wooden bleachers, flags, a referee stand
    for (let k = 0; k < 14; k++) { const s = k % 2 ? 1 : -1; palm(K, scene, s * (11 + r() * 12), -14 + k * 3 + r() * 2, 1.1 + r() * .4, r); }
    for (const [x, z, c] of [[-9, 10, 0xe74c3c], [9.5, 11, 0x2ecc71], [-10, -6, 0xf1c40f], [10, -4, 0x9b59b6]]) { K.cyl(.04, .04, 2.3, K.mat(0xdddddd), x, 1.15, z, scene, 6); K.mesh(new T.ConeGeometry(1.5, .6, 10), K.mat(c), x, 2.4, z, scene); }
    const crowd = []; const cm = [0xe74c3c, 0xf1c40f, 0x3498db, 0xecf0f1, 0x27ae60, 0xff8fb1, 0x8e44ad].map(c => K.mat(c));
    for (const sx of [-1, 1]) { for (let row = 0; row < 3; row++) K.box(.8, .4 + row * .45, 12, K.mat(0x9c7b55), sx * (7.6 + row * .8), .2 + row * .22, 0, scene, false);
      for (let k = 0; k < 30; k++) { const row = k % 3, b = K.group(sx * (7.6 + row * .8), .4 + row * .45, -5.5 + Math.floor(k / 3) * 1.2 + r() * .3, scene); K.box(.36, .55, .3, cm[k % cm.length], 0, .3, 0, b); K.ball(.15, K.mat(0xc68a5a), 0, .7, 0, b); crowd.push({ b, ph: r() * 6, y: b.position.y }); } }
    { const st = K.group(-5.4, 0, 0, scene); K.box(.8, 1.6, .8, K.mat(0x8d6e63), 0, .8, 0, st); K.box(1, .1, 1, K.mat(0x6d4c41), 0, 1.65, 0, st); }
    const sign = textPlane(K, 'PANTAI MIAMI · BOLA TAMPAR PANTAI', 12, 1, { bg: '#d35400', px: 90 }); sign.position.set(0, 3.6, -11.5); scene.add(sign);
    for (const x of [-6, 6]) K.cyl(.06, .06, 3.5, K.mat(0x777777), x, 1.75, -11.5, scene, 6);
    // footprints / landing marks (pooled decals) and sand particles
    const fpM = new T.MeshBasicMaterial({ color: 0xb59366, transparent: true, opacity: .5, depthWrite: false }), prints = []; let fpI = 0;
    for (let k = 0; k < 90; k++) { const m = K.mesh(new T.CircleGeometry ? new T.CircleGeometry(.1, 8) : new T.PlaneGeometry(.15, .15), fpM, 0, .012, 999, scene, false); m.rotation.x = -Math.PI / 2; m.scale.set(1, 1.7, 1); prints.push(m); }
    const footprint = (x, z, big) => { const m = prints[fpI = (fpI + 1) % prints.length]; m.position.set(x, .012, z); m.scale.set(big ? 3 : 1, big ? 3 : 1.7, 1); };
    const sandFx = new Sparks(scene, 260, 0xe6cf9a, .12), hitFx = new Sparks(scene, 120, 0xffffff, .14);
    // ================================================= BALL + MARKERS
    const ballTex = K.canvasTex(128, 64); { const x = ballTex.x; ['#ffd452', '#2e86de', '#ffffff'].forEach((c, i) => { x.fillStyle = c; x.fillRect(0, i * 22, 128, 22); }); ballTex.t.needsUpdate = true; }
    const ball = K.mesh(new T.SphereGeometry(BR, 18, 12), new T.MeshStandardMaterial({ map: ballTex.t, roughness: .45 }), 0, 2, 6, scene); ball.castShadow = true;
    const shadow = K.mesh(new T.CircleGeometry ? new T.CircleGeometry(.16, 16) : new T.PlaneGeometry(.3, .3), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .3, depthWrite: false }), 0, .015, 0, scene, false); shadow.rotation.x = -Math.PI / 2;
    const ringG = new T.TorusGeometry(.45, .04, 6, 28), landM = new T.MeshBasicMaterial({ color: 0xffd452, transparent: true, opacity: .9, depthWrite: false });
    const land = K.mesh(ringG, landM, 0, .03, 0, scene, false); land.rotation.x = Math.PI / 2;
    const spotM = new T.MeshBasicMaterial({ color: 0x2ecc71, transparent: true, opacity: .55, depthWrite: false }); const spot = K.mesh(new T.CircleGeometry ? new T.CircleGeometry(.55, 20) : new T.PlaneGeometry(1, 1), spotM, 0, .02, 0, scene, false); spot.rotation.x = -Math.PI / 2;
    const dots = []; for (let k = 0; k < 14; k++) dots.push(K.mesh(new T.SphereGeometry(.035, 6, 4), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .7 }), 0, -10, 0, scene, false));
    // ================================================= PLAYERS
    const hero = makePosableHero(T, K, M, putModel, 1.8);
    function mkAI(key, team) { const a = putAnimated(M, key, scene, 0, 0, { h: 1.75, anim: 'idle' }); const g = a ? a.obj : (() => { const g = new T.Group(); K.cyl(.25, .25, 1.4, K.mat(TEAM[team].col), 0, .7, 0, g); K.ball(.22, K.mat(0xc68a5a), 0, 1.6, 0, g); scene.add(g); return g; })(); return { a, g }; }
    const P = []; // 0 = you, 1 = teammate, 2/3 = opponents
    const mk = (i, team, model) => { const ring = K.mesh(new T.TorusGeometry(.42, .035, 5, 24), new T.MeshBasicMaterial({ color: TEAM[team].col, transparent: true, opacity: .8 }), 0, .025, 0, scene, false); ring.rotation.x = Math.PI / 2;
      return { i, team, x: 0, z: 0, y: 0, vy: 0, face: team ? 0 : Math.PI, act: null, actT: 0, dive: 0, react: 0, tx: 0, tz: 0, ring, ...model, phase: 0, moving: 0 }; };
    { const h = hero ? { g: hero.g, hero } : mkAI('chars/male-c', 0); scene.add(h.g); P.push(mk(0, 0, h)); }
    P.push(mk(1, 0, mkAI('chars/male-a', 0))); P.push(mk(2, 1, mkAI('chars/female-a', 1))); P.push(mk(3, 1, mkAI('chars/male-e', 1)));
    const sideOf = (team) => team === 0 ? 1 : -1; // z sign of each team's half
    // ================================================= MATCH STATE
    const cfg = { diff: S.vbDiff in VB_DIFF ? S.vbDiff : 'biasa', to: S.vbTo || 11, assist: S.vbAssist !== false, cam: S.vbCam || 'dynamic', trail: S.vbTrail !== false };
    const G = { st: 'menu', score: [0, 0], serveTeam: 0, server: [0, 2], touches: 0, touchTeam: -1, lastTouch: null, lastTeam: -1, rally: 0, msg: '', ptT: 0, winner: -1, serveCharge: 0, charging: false, chargeDir: 1, slow: 0, shake: 0, served: false, set: null, attacker: null, spikeWin: null, pressed: 0 };
    const B = { p: new T.Vector3(0, 2, 6), v: new T.Vector3(), spin: 0, live: false, held: true };
    let acc = 0, t = 0;
    // ---------------- prediction (same integrator as the simulation)
    function stepBall(p, v, spin, dt, real) {
      const p0x = p.x, p0y = p.y, p0z = p.z;
      v.y -= GRAV * dt; v.x += spin * v.z * .02 * dt; // a little side-spin curve
      p.x += v.x * dt; p.y += v.y * dt; p.z += v.z * dt;
      // net: swept test on the z = 0 plane
      if ((p0z > 0) !== (p.z > 0) && p0z !== 0) { const f = p0z / (p0z - p.z), yc = p0y + (p.y - p0y) * f, xc = p0x + (p.x - p0x) * f;
        if (Math.abs(xc) > 4 + BR && real) { /* outside the antenna — judged when it lands */ }
        if (yc < NET + BR && Math.abs(xc) < 4.75) { p.z = p0z > 0 ? BR + .01 : -BR - .01; v.z = -v.z * .2; v.x *= .5; v.y = Math.min(v.y, 0) * .4; if (real) { sfx.tap(); netShake = .5; } return 'net'; }
        if (real) return 'cross'; }
      if (p.y <= BR) { p.y = BR; return 'ground'; }
      return null;
    }
    const pv = new T.Vector3(), vv = new T.Vector3();
    function predict(untilY = BR, sideZ = 0) { // where/when the ball comes down to height untilY (on side sideZ if given)
      pv.copy(B.p); vv.copy(B.v); let tt = 0; const pts = [];
      for (let i = 0; i < 900; i++) { const ev = stepBall(pv, vv, B.spin, DT * 2, false); tt += DT * 2; if (i % 6 === 0) pts.push(pv.clone());
        if (vv.y < 0 && pv.y <= untilY && (!sideZ || Math.sign(pv.z) === sideZ)) return { x: pv.x, z: pv.z, y: pv.y, t: tt, pts };
        if (ev === 'ground') return { x: pv.x, z: pv.z, y: BR, t: tt, pts, ground: true }; }
      return { x: pv.x, z: pv.z, y: pv.y, t: tt, pts };
    }
    // launch the ball from p to land at (tx, ty, tz) with apex height apexH
    function lob(tx, tz, apexH, ty = BR) { const y0 = B.p.y, top = Math.max(apexH, y0 + .3, ty + .3), vy = Math.sqrt(2 * GRAV * (top - y0)), T1 = vy / GRAV, T2 = Math.sqrt(2 * (top - ty) / GRAV), Tt = T1 + T2; B.v.set((tx - B.p.x) / Tt, vy, (tz - B.p.z) / Tt); }
    function drive(tx, tz, speed, ty = BR) { const dx = tx - B.p.x, dz = tz - B.p.z, dh = Math.hypot(dx, dz), Tt = Math.max(.25, dh / speed), vy = (ty - B.p.y + .5 * GRAV * Tt * Tt) / Tt; B.v.set(dx / Tt, vy, dz / Tt); }
    // ---------------- contacts
    function touch(pl, kind, q = 1) {
      const team = pl.team, sz = sideOf(team), oz = -sz;
      if (G.touchTeam !== team) { G.touchTeam = team; G.touches = 0; }
      (G.log ||= []).push(`${kind}:${pl.i}@${B.p.x.toFixed(1)},${B.p.y.toFixed(1)},${B.p.z.toFixed(1)} q${q.toFixed(2)}`); if (G.log.length > 300) G.log.shift();
      G.touches++; G.lastTouch = pl; G.lastTeam = team; B.spin = 0; G.rally++;
      const d = VB_DIFF[team === 0 && pl.i === 0 ? 'biasa' : team === 0 ? 'biasa' : cfg.diff], e = (pl.i === 0 ? (1.05 - q) * .9 : d.err) * (r() - .5) * 2;
      const mate = P.find(o => o.team === team && o !== pl);
      if (kind === 'bump') { // pass to the partner near the net
        const tx = clamp((mate ? mate.x * .4 : 0) + e, -3, 3), tz = sz * (2.0 + Math.abs(e) * .4); lob(tx, tz, 4.2 + q * .4, 1.6); G.set = { by: mate, to: pl }; sfx.pop(); }
      else if (kind === 'set') { const atk = G.set && G.set.to && G.set.to !== pl ? G.set.to : mate; const ax = clamp((atk ? atk.x : 0) * .8 + e * .5, -2.8, 2.8), az = sz * 1.3; lob(ax, az, 5.0, 2.9); G.attacker = atk; G.spikeAt = { x: ax, z: az }; sfx.pop(); }
      else if (kind === 'spike') { const aim = pl.aim || { x: (r() - .5) * 5, z: oz * (3 + r() * 4) }; const sp = 15 + q * 8; drive(clamp(aim.x, -3.7, 3.7) + e * .6, clamp(aim.z, -7.6, 7.6), sp); B.spin = (r() - .5) * 2; hitFx.add(B.p.x, B.p.y, B.p.z, 0, 0, 0, .3); for (let k = 0; k < 16; k++) hitFx.add(B.p.x, B.p.y, B.p.z, (r() - .5) * 4, (r() - .5) * 4, (r() - .5) * 4, .4); sfx.kick(); G.shake = q > .9 ? .45 : .2; if (q > .9) { G.slow = .5; } G.attacker = null; }
      else if (kind === 'shot') { const tx = (r() - .5) * 5, tz = oz * (3 + r() * 4); lob(tx, tz, 4.5); sfx.pop(); G.attacker = null; }
      else if (kind === 'serve') { const pw = q, tx = clamp(pl.aimX ?? (r() - .5) * 5, -3.8, 3.8), tz = oz * (2 + pw * 5.2); if (pw > .85) drive(tx, tz + oz * (pw > .97 ? 1.6 : 0), 15 + pw * 6); else lob(tx, tz - oz * (pw < .2 ? 6 : 0), 4.2 + pw * 1.5); B.spin = (r() - .5) * (pw > .85 ? 3 : 1); sfx.kick(); G.touchTeam = 1 - team; G.touches = 0; }
      if (kind !== 'serve' && G.touches >= 3 && !(kind === 'spike' || kind === 'shot')) { /* third touch must go over — the AI always attacks on 3 */ }
    }
    // ---------------- rally flow
    function serveSetup() {
      G.st = 'serve'; B.live = false; B.held = true; G.touches = 0; G.touchTeam = -1; G.rally = 0; G.attacker = null; G.set = null; G.serveCharge = 0; G.charging = false; G.served = false;
      const tm = G.serveTeam, srv = P[G.server[tm]], sz = sideOf(tm);
      for (const p of P) { const s = sideOf(p.team); p.x = (p.i % 2 ? 1.8 : -1.8); p.z = s * 4.6; p.y = 0; p.dive = 0; p.act = null; p.face = p.team ? 0 : Math.PI; }
      srv.x = srv.i % 2 ? 1.5 : -1.5; srv.z = sz * 8.9; const mate = P.find(o => o.team === tm && o !== srv); mate.z = sz * 2.4; mate.x = -srv.x * .8;
      B.p.set(srv.x + .25, 1.2, srv.z - sz * .3); B.v.set(0, 0, 0);
      if (srv.i === 0) say(`SERVIS anda — tahan & lepas · Your serve`, 1.8); else G.aiServeT = 1.0 + r() * .8;
    }
    function doServe(srv, power) { B.held = false; B.live = true; B.p.set(srv.x, 2.6, srv.z); if (power > .85) srv.vy = 3.6; touch(srv, 'serve', power); G.st = 'rally'; G.served = true; }
    function point(winTeam, why) {
      if (G.st !== 'rally') return; (G.log ||= []).push(`POINT→${winTeam} (${why}) ball ${B.p.x.toFixed(1)},${B.p.z.toFixed(1)} touches ${G.touches}/${G.touchTeam}`); G.st = 'point'; B.live = false; G.score[winTeam]++; G.ptT = 1.8;
      say(`${why} · ${winTeam === 0 ? 'Mata untuk KAMPUNG!' : 'Mata untuk PANTAI'}`, 1.7); winTeam === 0 ? (sfx.good(), sfx.cheer && sfx.cheer()) : sfx.bad();
      for (const c of crowd) c.jump = winTeam === 0 ? 1 : .3;
      if (G.serveTeam !== winTeam) { const ids = winTeam === 0 ? [0, 1] : [2, 3]; G.server[winTeam] = G.server[winTeam] === ids[0] ? ids[1] : ids[0]; } G.serveTeam = winTeam; // side-out: rotate the server
      const [a, b] = G.score; if ((a >= cfg.to || b >= cfg.to) && Math.abs(a - b) >= 2) { G.winner = a > b ? 0 : 1; G.ptT = 2.2; }
    }
    function judgeLanding() { const inside = Math.abs(B.p.x) <= COURT.hx + BR && Math.abs(B.p.z) <= COURT.hz + BR, sideTeam = B.p.z > 0 ? 0 : 1;
      footprint(B.p.x, B.p.z, true); for (let k = 0; k < 20; k++) sandFx.add(B.p.x, .1, B.p.z, (r() - .5) * 2, 1 + r() * 1.5, (r() - .5) * 2, .6);
      if (inside) point(1 - sideTeam, 'Bola jatuh dalam gelanggang'); else point(G.lastTeam >= 0 ? 1 - G.lastTeam : 1 - sideTeam, 'Bola keluar · Out'); }
    // ---------------- who plays the ball
    function receiverFor(team, pr) { const tm = P.filter(p => p.team === team); if (G.touchTeam === team && G.touches === 1 && G.set && G.set.by && G.set.by.team === team) return G.set.by; if (G.touchTeam === team && G.touches === 2 && G.attacker) return G.attacker;
      return tm.reduce((a, b) => Math.hypot(a.x - pr.x, a.z - pr.z) <= Math.hypot(b.x - pr.x, b.z - pr.z) ? a : b); }
    const reach = (p) => p.i === 0 ? (cfg.assist ? 1.55 : 1.25) : 1.25;
    // ================================================= HUD
    const root = document.createElement('div'); root.className = 'f3 vb'; root.innerHTML = `
      <div class="vbScore"><span class="t0">KAMPUNG</span><b class="s0">0</b><i class="sv0">🏐</i><em>–</em><i class="sv1">🏐</i><b class="s1">0</b><span class="t1">PANTAI</span><small class="mp"></small></div>
      <button class="f3Pause" aria-label="Menu">❚❚</button><button class="vbCam">🎥</button>
      <div class="f3Msg"></div>
      <div class="f3Stick"><div class="f3Base"><div class="f3Knob"></div></div></div>
      <div class="vbBtns"><div class="vbMeter"><i></i><b class="ok"></b></div><div class="vbTiming"><i class="zone"></i><b class="mk"></b></div>
        <button class="vbDive" hidden><i>🤿</i><b>SELAM</b></button><button class="vbJump"><i>⤒</i><b>BLOK</b></button><button class="vbAct"><i>🏐</i><b>SERVIS</b></button></div>
      <div class="f3Over" hidden></div>`;
    $('game').append(root); $('game').classList.add('f3mode');
    const q = (s) => root.querySelector(s), over = q('.f3Over'), actB = q('.vbAct'), jumpB = q('.vbJump'), diveB = q('.vbDive');
    let msgT = 0; function say(m, d = 1.4) { const e = q('.f3Msg'); e.textContent = m; e.classList.add('show'); msgT = d; }
    const stick = q('.f3Stick'), base = q('.f3Base'), knob = q('.f3Knob'); let sid = null, sx0 = 0, sy0 = 0; const RAD = 38, joy = { x: 0, y: 0 };
    const sMove = (e) => { const dx = e.clientX - sx0, dy = e.clientY - sy0, d = Math.hypot(dx, dy), k = d > RAD ? RAD / d : 1; knob.style.transform = `translate(${dx * k}px,${dy * k}px)`; let m = Math.min(1, d / RAD); m = m < .1 ? 0 : (m - .1) / .9; joy.x = d ? dx / d * m : 0; joy.y = d ? dy / d * m : 0; };
    stick.addEventListener('pointerdown', (e) => { e.preventDefault(); if (sid !== null) return; sid = e.pointerId; stick.setPointerCapture(sid); const rc = stick.getBoundingClientRect(); sx0 = clamp(e.clientX, rc.left + RAD + 6, rc.right - RAD - 6); sy0 = clamp(e.clientY, rc.top + RAD + 6, rc.bottom - RAD - 6); base.style.left = `${sx0 - rc.left}px`; base.style.top = `${sy0 - rc.top}px`; base.classList.add('on'); sMove(e); });
    stick.addEventListener('pointermove', (e) => { if (e.pointerId === sid) sMove(e); });
    const sUp = (e) => { if (e.pointerId !== sid) return; sid = null; joy.x = joy.y = 0; knob.style.transform = ''; base.classList.remove('on'); base.style.left = base.style.top = ''; };
    stick.addEventListener('pointerup', sUp); stick.addEventListener('pointercancel', sUp);
    const hold = (b, fn) => { let id = null; b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); id = e.pointerId; try { b.setPointerCapture(id); } catch { } b.classList.add('on'); fn(true); }); const up = (e) => { if (e.pointerId !== id) return; id = null; b.classList.remove('on'); fn(false); }; b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); };
    hold(actB, (on) => action(on)); hold(jumpB, (on) => on && jump(P[0], true)); hold(diveB, (on) => on && dive(P[0]));
    const keys = new Set(); const onKey = (e) => { if (!root.isConnected) return; const c = e.code; if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(c)) { e.preventDefault(); e.type === 'keydown' ? keys.add(c) : keys.delete(c); return; }
      if (e.repeat) return; const d = e.type === 'keydown'; if (c === 'Space' || c === 'KeyJ') { e.preventDefault(); action(d); } else if (d && c === 'KeyK') jump(P[0], true); else if (d && c === 'KeyL') dive(P[0]); else if (d && c === 'KeyC') q('.vbCam').click(); else if (d && (c === 'KeyP' || c === 'Escape')) togglePause(); };
    addEventListener('keydown', onKey); addEventListener('keyup', onKey);
    let paused = false; q('.f3Pause').onclick = () => { sfx.tap(); togglePause(); };
    const CAMS = { dynamic: 'Dinamik', fixed: 'Tetap', wide: 'Luas' };
    q('.vbCam').onclick = () => { const ks = Object.keys(CAMS); cfg.cam = ks[(ks.indexOf(cfg.cam) + 1) % ks.length]; S.vbCam = cfg.cam; save(); sfx.tap(); say(`Kamera: ${CAMS[cfg.cam]}`, 1); };
    function togglePause() { if (G.st === 'menu' || G.st === 'end') return; paused = !paused; over.hidden = !paused; if (!paused) return;
      over.innerHTML = `<div class="f3Card"><h2>BOLA TAMPAR PANTAI</h2><p class="muted">${G.score[0]} – ${G.score[1]} · sasaran ${cfg.to}</p><div class="f3Set"><label>Mod pemula (bantuan) <input type="checkbox" data-s="assist" ${cfg.assist ? 'checked' : ''}></label><label>Laluan bola <input type="checkbox" data-s="trail" ${cfg.trail ? 'checked' : ''}></label></div>
        <div class="f3Row"><button class="f3B primary" data-o="r">▶ Teruskan</button><button class="f3B" data-o="x">🚪 Keluar</button></div></div>`;
      over.querySelectorAll('[data-s]').forEach(i => i.onchange = () => { cfg[i.dataset.s] = i.checked; S.vbAssist = cfg.assist; S.vbTrail = cfg.trail; save(); });
      over.querySelector('[data-o="r"]').onclick = () => togglePause(); over.querySelector('[data-o="x"]').onclick = () => { paused = false; $('gClose').click(); }; }
    function menu() { over.hidden = false; over.innerHTML = `<div class="f3Card vbMenu"><div class="kick">PANTAI MIAMI · 2 LAWAN 2</div><h2>🏐 Bola Tampar Pantai</h2>
      <div class="vbOpt"><span>Lawan</span>${Object.entries(VB_DIFF).map(([k, d]) => `<button class="f3B ${cfg.diff === k ? 'primary' : ''}" data-d="${k}">${d.bm}</button>`).join('')}</div>
      <div class="vbOpt"><span>Mata</span>${[7, 11, 21].map(n => `<button class="f3B ${cfg.to === n ? 'primary' : ''}" data-to="${n}">${n}</button>`).join('')}</div>
      <label class="vbChk"><input type="checkbox" data-a ${cfg.assist ? 'checked' : ''}> Mod pemula: bantuan kedudukan & masa · Beginner assist</label>
      <p class="muted">Kayu bedik: gerak · Butang besar: SERVIS / TERIMA / SET / REJAM · BLOK dekat jaring · SELAM bila bola jauh</p>
      <div class="f3Row"><button class="f3B primary" data-go="1">MULA ▶</button></div></div>`;
      over.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { cfg.diff = b.dataset.d; S.vbDiff = cfg.diff; save(); sfx.tap(); menu(); });
      over.querySelectorAll('[data-to]').forEach(b => b.onclick = () => { cfg.to = +b.dataset.to; S.vbTo = cfg.to; save(); sfx.tap(); menu(); });
      over.querySelector('[data-a]').onchange = (e) => { cfg.assist = e.target.checked; S.vbAssist = cfg.assist; save(); };
      over.querySelector('[data-go]').onclick = () => { sfx.good(); over.hidden = true; G.score = [0, 0]; G.serveTeam = 0; G.server = [0, 2]; serveSetup(); }; }
    // ---------------- human actions
    let buffered = 0;
    function action(on) {
      if (paused || G.st === 'menu' || G.st === 'end') return; const me = P[0];
      if (G.st === 'serve' && G.serveTeam === 0 && G.server[0] === 0) { if (on && !G.charging) { G.charging = true; G.serveCharge = 0; G.chargeDir = 1; } else if (!on && G.charging) { G.charging = false; me.aimX = joy.x * 3.6; doServe(me, G.serveCharge); q('.vbMeter').classList.remove('show'); } return; }
      if (!on || G.st !== 'rally') return;
      const role = myRole(); if (role === 'spike') { if (me.y > .05 || me.act === 'spikeUp') return; if (B.v.y < 0 && B.p.y < 2.1) { buffered = t; tryHit(me, true); return; } const early = G.idealJump ? G.idealJump - t : 0;
        G.spikePress = t; if (cfg.assist && early > .04 && early < .7) { G.jumpAt = G.idealJump; G.spikePress = G.idealJump - early * .25; return; } jump(me, false, true); return; }
      buffered = t; tryHit(me, true);
    }
    function tryHit(pl, human) { // bump / set when the ball is within reach (forgiving window in beginner mode)
      if (!B.live || pl.act === 'dive' && pl.dive > .6) return false; const d = Math.hypot(B.p.x - pl.x, B.p.z - pl.z), h = B.p.y - pl.y;
      const lo = .25, hi = human && cfg.assist ? 2.4 : 2.1; if (d > reach(pl) + (pl.act === 'dive' ? 1.2 : 0) || h < lo || h > hi || B.v.y > 2 && h > 1.2) return false;
      if (Math.sign(B.p.z) !== sideOf(pl.team)) return false;
      const team = pl.team, n = G.touchTeam === team ? G.touches : 0; if (n >= 3) return false;
      const kind = n === 0 ? 'bump' : n === 1 ? 'set' : 'shot'; const q2 = human ? clamp(1 - Math.max(0, Math.abs(h - 1.1) - .55) * .6 - Math.max(0, d - .6) * .15, .35, 1) : 1;
      pl.act = kind === 'set' ? 'set' : 'bump'; pl.actT = .45; touch(pl, kind, q2); if (human) { say(kind === 'bump' ? 'TERIMA!' : kind === 'set' ? 'SET!' : 'Pukul!', .6); buffered = 0; } return true;
    }
    function jump(pl, block, spike) { if (pl.y > .02 || pl.dive > 0) return; pl.vy = spike ? 4.3 : 3.9; pl.act = block ? 'block' : spike ? 'spikeUp' : 'jump'; pl.actT = .9; if (pl.i === 0) sfx.swish(); }
    function dive(pl) { if (pl.dive > 0 || pl.y > .02 || G.st !== 'rally') return; const pr = G.pred; if (!pr) return; const dx = pr.x - pl.x, dz = pr.z - pl.z, d = Math.hypot(dx, dz) || 1; pl.dive = 1.1; pl.diveV = { x: dx / d * 6.5, z: dz / d * 6.5 }; pl.act = 'dive'; pl.face = Math.atan2(dx, dz); sfx.swish(); for (let k = 0; k < 24; k++) sandFx.add(pl.x, .1, pl.z, (r() - .5) * 2, .5 + r(), (r() - .5) * 2, .7); }
    function myRole() { if (G.st !== 'rally' || !B.live) return 'none'; const pr = G.pred; if (!pr) return 'none';
      if (Math.sign(pr.z) === sideOf(0) || Math.sign(B.p.z) === sideOf(0)) { const rc = receiverFor(0, pr); if (G.touchTeam === 0 && G.touches === 2 && G.attacker === P[0]) return 'spike'; if (rc === P[0]) return G.touchTeam === 0 && G.touches === 1 ? 'set' : 'bump'; return 'wait'; } return 'defend'; }
    // ================================================= AI
    function aiThink(pl, dt) {
      const d = VB_DIFF[pl.team === 0 ? 'biasa' : cfg.diff], sz = sideOf(pl.team), pr = G.pred;
      let tx = pl.x, tz = pl.z;
      if (G.st === 'serve') { if (G.serveTeam === pl.team && G.server[pl.team] === pl.i) { G.aiServeT -= dt; if (G.aiServeT <= 0) { pl.aimX = (r() - .5) * 6; doServe(pl, clamp(d.serve + (r() - .5) * .3, .3, .96)); } } return; }
      if (G.st !== 'rally' || !B.live) { tx = pl.i % 2 ? 1.8 : -1.8; tz = sz * 4.6; }
      else if (pr && (Math.sign(pr.z) === sz || Math.sign(B.p.z) === sz)) { const rc = receiverFor(pl.team, pr);
        if (rc === pl) { if (G.touchTeam === pl.team && G.touches === 2 && G.attacker === pl) { // attacker: run in and jump to meet the set
            const at = G.spikeAt || { x: pl.x, z: sz * 1.3 }; tx = at.x; tz = at.z + sz * .35; const hitT = predictHeight(3.0); if (hitT !== null && hitT < .36 && pl.y < .02 && Math.hypot(pl.x - tx, pl.z - tz) < 1.4) jump(pl, false, true);
          } else { const cp = G.contact || pr; tx = cp.x; tz = cp.z; } }
        else { // partner: go to the net to set, or cover
          if (G.touchTeam === pl.team && G.touches >= 1) { tx = pl.x * .5; tz = sz * 2.6; } else { tx = (pl.i % 2 ? 1.8 : -1.8); tz = sz * 3.4; } } }
      else if (pr) { // ball on the other side: block the attacker or defend
        const opAtk = G.attacker; if (opAtk && G.touches === 2 && r() < d.block * dt * 3 && pl === P.filter(p => p.team === pl.team).reduce((a, b) => Math.abs(a.x - opAtk.x) < Math.abs(b.x - opAtk.x) ? a : b)) { pl.wantBlock = opAtk; }
        if (pl.wantBlock && G.attacker === pl.wantBlock) { tx = pl.wantBlock.x; tz = sz * .55; if (pl.wantBlock.y > .25 && pl.y < .02) jump(pl, true); } else { pl.wantBlock = null; tx = (pl.i % 2 ? 1.6 : -1.6); tz = sz * 4.4; } }
      pl.react -= dt; if (pl.react > 0) return; pl.tx = tx; pl.tz = tz;
    }
    function predictHeight(h) { pv.copy(B.p); vv.copy(B.v); let tt = 0; for (let i = 0; i < 400; i++) { stepBall(pv, vv, B.spin, DT * 2, false); tt += DT * 2; if (vv.y < 0 && pv.y <= h) return tt; if (pv.y <= BR) return null; } return null; }
    // ================================================= SIMULATION STEP (fixed)
    function sim(dt) {
      if (G.st === 'serve' && G.charging) { G.serveCharge += G.chargeDir * dt / 1.1; if (G.serveCharge >= 1) { G.serveCharge = 1; G.chargeDir = -1; } if (G.serveCharge <= 0) { G.serveCharge = 0; G.chargeDir = 1; } }
      if (G.jumpAt && t >= G.jumpAt) { G.jumpAt = 0; if (G.attacker === P[0]) jump(P[0], false, true); }
      // players
      for (const p of P) { const sp = p.i === 0 ? 5.6 : VB_DIFF[p.team === 0 ? 'biasa' : cfg.diff].speed;
        let mx = 0, mz = 0;
        if (p.dive > 0) { p.dive -= dt; const k = p.dive > .55 ? 1 : 0; p.x += p.diveV.x * dt * k; p.z += p.diveV.z * dt * k; if (p.dive > .55 && G.st === 'rally') tryHit(p, p.i === 0); if (p.dive <= 0) p.act = null; }
        else if (p.i === 0 && G.st !== 'serve' && G.st !== 'point') { const kx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0), ky = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
          mx = kx || joy.x; mz = ky || joy.y; // camera sits behind our team: up on the stick = toward the net (−z)
          if (cfg.assist && !mx && !mz && G.st === 'rally') { const role = myRole(), cp = role === 'spike' ? G.spikeAt && { x: G.spikeAt.x, z: G.spikeAt.z + .35 } : (role === 'bump' || role === 'set') ? (G.contact || G.pred) : null; if (cp) { const dx = cp.x - p.x, dz = cp.z - p.z, dd = Math.hypot(dx, dz); if (dd > .25 && dd < 3.5) { mx = dx / dd * Math.min(1, dd); mz = dz / dd * Math.min(1, dd); } } }
          const m = Math.hypot(mx, mz); if (m > 1) { mx /= m; mz /= m; } p.x += mx * sp * dt; p.z += mz * sp * dt; }
        else if (p.i !== 0 && G.st !== 'serve') { const dx = p.tx - p.x, dz = p.tz - p.z, dd = Math.hypot(dx, dz); if (dd > .08) { const s2 = Math.min(dd, sp * dt); p.x += dx / dd * s2; p.z += dz / dd * s2; mx = dx / dd; mz = dz / dd; } }
        p.moving = Math.hypot(mx, mz);
        // stay on your own half (with a little room past the lines)
        const sz = sideOf(p.team); p.x = clamp(p.x, -6, 6); p.z = sz > 0 ? clamp(p.z, .35, 11) : clamp(p.z, -11, -.35);
        // jump physics
        if (p.y > 0 || p.vy > 0) { p.vy -= 13 * dt; p.y = Math.max(0, p.y + p.vy * dt); if (p.y === 0) { p.vy = 0; footprint(p.x, p.z, true); if (p.act === 'block' || p.act === 'spikeUp' || p.act === 'spikeHit' || p.act === 'jump') p.act = null; } }
        if (p.actT > 0) { p.actT -= dt; if (p.actT <= 0 && (p.act === 'bump' || p.act === 'set')) p.act = null; }
        // spikes: hit at the top of the jump
        if (p.act === 'spikeUp' && B.live && p.y > .15 && G.attacker === p) { const hx = p.x, hz = p.z - sideOf(p.team) * .2, hy = p.y + 2.35; const d = Math.hypot(B.p.x - hx, B.p.z - hz), dy = B.p.y - hy;
          if (d < 1.2 && dy > -.8 && dy < .5) { const dd = VB_DIFF[p.team === 0 ? 'biasa' : cfg.diff]; let qq = r() < dd.spike ? .75 + r() * .25 : .5; if (p.i === 0) { const err = Math.abs((G.spikePress || t) - (G.idealJump || t)); qq = err < .08 ? 1 : err < .18 ? .8 : .5; p.aim = { x: clamp(B.p.x + joy.x * 3.5, -3.6, 3.6), z: -sideOf(p.team) * (joy.y > .3 ? 2.5 : joy.y < -.3 ? 7.2 : 5) }; if (qq >= 1) say('REJAMAN SEMPURNA!', .9); }
            else { const opp = P.filter(o => o.team !== p.team), gapX = Math.abs(opp[0].x - opp[1].x) > 2 ? (opp[0].x + opp[1].x) / 2 : (opp[0].x > 0 ? -2.8 : 2.8); p.aim = cfg.diff === 'sukar' || p.team === 0 ? { x: gapX, z: -sideOf(p.team) * (3 + r() * 4.5) } : null; }
            p.act = 'spikeHit'; p.actT = .35; touch(p, qq < .6 ? 'shot' : 'spike', qq); } }
        // footprints while running
        if (p.moving > .3 && p.y === 0 && Math.random() < dt * 6) footprint(p.x + (Math.random() - .5) * .2, p.z, false);
      }
      // ball
      if (B.held) { const srv = P[G.server[G.serveTeam]]; B.p.set(srv.x + .25, 1.15 + Math.sin(t * 3) * .03, srv.z - sideOf(srv.team) * .3); return; }
      if (!B.live) return;
      const ev = stepBall(B.p, B.v, B.spin, dt, true);
      if (ev === 'cross') { (G.log ||= []).push(`cross→${B.p.z > 0 ? 0 : 1} y${B.p.y.toFixed(1)}`); if (Math.abs(B.p.x) > 4 + BR) { point(1 - G.lastTeam, 'Bola di luar antena · Outside the antenna'); return; }
        // block check: an airborne defender with hands above the net next to the ball
        const defTeam = B.p.z > 0 ? 0 : 1; for (const p of P) if (p.team === defTeam && p.act === 'block' && p.y > .2 && Math.abs(p.x - B.p.x) < .8 && Math.abs(p.z) < 1.2 && B.p.y < p.y + 2.85 && B.p.y > NET - .1) {
          B.p.z = -Math.sign(B.p.z) * (BR + .02); { const back = -Math.sign(B.p.z) || 1; B.v.set((r() - .5) * 1.6, 1.2 + r() * 1.5, back * (2 + r() * 2.5)); } G.touchTeam = defTeam; G.touches = 1; G.lastTeam = defTeam; G.lastTouch = p; sfx.kick(); say(defTeam === 0 ? 'BLOK! 🧱' : 'Diblok!', .9); G.shake = .25; for (let k = 0; k < 14; k++) hitFx.add(B.p.x, B.p.y, 0, (r() - .5) * 3, (r() - .5) * 3, (r() - .5) * 3, .4); break; }
        G.touchTeam = B.p.z > 0 ? 0 : 1; G.touches = 0; G.attacker = null; G.set = null; for (const p of P) p.react = VB_DIFF[p.team === 0 ? 'biasa' : cfg.diff].react; }
      if (ev === 'ground') { judgeLanding(); return; }
      if (B.p.y > 18 || Math.abs(B.p.z) > 30) { point(1 - G.lastTeam, 'Keluar'); return; }
      // AI and assisted contacts
      for (const p of P) { if (p.i === 0) { if (buffered && t - buffered < .35) tryHit(p, true); continue; } if (p.act === 'spikeUp' || p.act === 'block') continue;
        const pr = G.pred; if (!pr) continue; const sz = sideOf(p.team); if (Math.sign(B.p.z) !== sz) continue; const rc = receiverFor(p.team, pr); if (rc !== p) continue;
        if (G.touchTeam === p.team && G.touches === 2 && G.attacker === p) { if (p.y < .02 && B.p.y < 2.0 && B.v.y < 0) tryHit(p, false); continue; }
        if (B.v.y < 0 && B.p.y < 1.25) tryHit(p, false); }
    }
    // ================================================= CAMERA
    const view = { pos: new T.Vector3(0, 6.5, 16), look: new T.Vector3(0, 1, -1), halfW: 9, halfH: 5.6, snap: true };
    const cp = view.pos.clone(), cl = view.look.clone(), tp = new T.Vector3(), tl = new T.Vector3(); let netShake = 0;
    function cam(dt) {
      const bx = B.p.x, bz = B.p.z;
      if (cfg.cam === 'fixed') { tp.set(0, 7.2, 16.5); tl.set(0, .9, -1.2); }
      else if (cfg.cam === 'wide') { tp.set(0, 11.5, 19.5); tl.set(0, 0, -1.6); }
      else { const near = bz > 0 ? 1 : 0, zoom = G.st === 'serve' ? (G.serveTeam === 0 ? -1.2 : .8) : 0; tp.set(bx * .3 + P[0].x * .15, 5.6 + near * .6 + (G.slow > 0 ? -.8 : 0), 14.2 + zoom - near * .6 + (G.slow > 0 ? -2.2 : 0)); tl.set(bx * .35, 1.1 + B.p.y * .12, clamp(bz * .35 - 1.2, -5, 3)); }
      if (G.st === 'end') { const a = t * .3; tp.set(Math.sin(a) * 6 + P[0].x, 3, Math.cos(a) * 6 + P[0].z); tl.set(P[0].x, 1.2, P[0].z); }
      const k = 1 - Math.exp(-dt * (cfg.cam === 'dynamic' ? 2.6 : 5)); cp.lerp(tp, k); cl.lerp(tl, k);
      const sh = G.shake > 0 ? G.shake * .15 : 0; view.pos.set(cp.x + (Math.random() - .5) * sh, cp.y + (Math.random() - .5) * sh, cp.z); view.look.copy(cl);
      const d = cp.distanceTo(cl), fov = cfg.cam === 'wide' ? 52 : 46; view.halfH = d * Math.tan(fov * Math.PI / 360); view.halfW = view.halfH * 1.6;
    }
    // ================================================= RENDER STATE (models, markers, HUD)
    function renderPlayers(dt) {
      for (const p of P) { const g = p.g; g.position.set(p.x, p.y, p.z);
        // face the ball in play, otherwise the net
        const want = B.live || B.held ? Math.atan2(B.p.x - p.x, B.p.z - p.z) : (p.team ? 0 : Math.PI); if (p.dive <= 0) p.face += (((want - p.face + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 8);
        g.rotation.set(p.dive > 0 ? Math.min(1.25, (1.1 - p.dive) * 4) * (p.dive > .3 ? 1 : p.dive / .3) : 0, p.face, 0, 'YXZ');
        p.ring.position.set(p.x, .03, p.z); p.ring.scale.setScalar(p.i === 0 ? 1.15 : 1); p.ring.material.opacity = p.i === 0 ? .95 : .55;
        if (p.hero) { p.phase += dt * (6 + p.moving * 6); let pose;
          if (G.st === 'end') pose = POSES[G.winner === 0 ? 'win' : 'sad'].p;
          else if (p.dive > 0) pose = POSES.dive.p; else if (p.act === 'block') pose = POSES.block.p; else if (p.act === 'spikeUp') pose = POSES.spikeUp.p; else if (p.act === 'spikeHit') pose = POSES.spikeHit.p;
          else if (p.act === 'set') pose = POSES.set.p; else if (p.act === 'bump') pose = POSES.bump.p; else if (G.st === 'serve' && G.server[0] === 0 && G.serveTeam === 0) pose = G.charging ? POSES.spikeUp.p : POSES.ready.p;
          else if (p.moving > .1) pose = runPose(p.phase, p.moving, 0); else pose = POSES.ready.p;
          if (pose !== p.lastPose || p.moving > .1) { p.hero.live(pose); p.lastPose = pose; } }
        else if (p.a) { p.a.play(p.moving > .1 ? 'walk' : 'idle'); p.a.update(dt * (p.moving > .1 ? 1.6 : 1)); g.rotation.x += p.act === 'bump' ? .35 : p.act === 'set' ? -.15 : 0; } }
    }
    // ================================================= LOOP
    let amb = null; try { amb = seaAmbience(); musicDuck(true); } catch { amb = null; }
    let lastHud = 0; menu();
    return {
      scene, view, ray() { return { ok: false }; }, down() {}, move() {}, up() {},
      timerText: () => `${G.score[0]}–${G.score[1]}`,
      dbg: () => ({ st: G.st, score: G.score.slice(), serveTeam: G.serveTeam, server: G.server.slice(), touches: G.touches, touchTeam: G.touchTeam, rally: G.rally, ball: { x: +B.p.x.toFixed(2), y: +B.p.y.toFixed(2), z: +B.p.z.toFixed(2), live: B.live }, role: myRole(), me: { x: +P[0].x.toFixed(2), z: +P[0].z.toFixed(2) }, winner: G.winner, cfg }),
      sim: { G, B, P, cfg, action, jump, dive, serveSetup, joy },
      update(dt0, ptr, camera) {
        if (camera && camera.far < 300) { camera.far = 300; }
        const tut = document.getElementById('gTut'); if (paused || (tut && !tut.hidden)) return;
        dt0 *= G.speed || 1; let dt = Math.min(dt0, .05 * (G.speed || 1)); if (G.slow > 0) { G.slow -= dt0; dt *= .35; } t += dt; G.shake = Math.max(0, G.shake - dt0);
        if (G.st === 'menu') { cam(dt0); return; }
        acc += dt; while (acc >= DT) { acc -= DT; sim(DT); }
        // predictions for markers + AI (every frame is cheap enough at 2× step)
        if (B.live) { G.pred = predict(BR); const sz = Math.sign(G.pred.z); G.contact = predict(1.0, sz) || G.pred; } else G.pred = null;
        for (const p of P) if (p.i !== 0) aiThink(p, dt);
        // ideal spike timing for the human attacker (meter)
        const role = myRole(); if (role === 'spike') { const hitT = predictHeight(3.0); G.idealJump = hitT !== null ? t + hitT - .33 : null; } else G.jumpAt = 0;
        // point → next rally / match end
        if (G.st === 'point') { G.ptT -= dt0; if (G.ptT <= 0) { if (G.winner >= 0) { G.st = 'end'; endMatch(); } else serveSetup(); } }
        // visuals
        ball.position.copy(B.p); ball.rotation.x += B.v.z * dt * 3; ball.rotation.z -= B.v.x * dt * 3; shadow.position.set(B.p.x, .015, B.p.z); shadow.scale.setScalar(clamp(1 - B.p.y / 14, .35, 1));
        land.visible = !!G.pred; if (G.pred) { land.position.set(G.pred.x, .03, G.pred.z); const out = Math.abs(G.pred.x) > COURT.hx || Math.abs(G.pred.z) > COURT.hz; landM.color.setHex(out ? 0xff4d4d : G.pred.z > 0 ? 0xffd452 : 0xffffff); land.scale.setScalar(1 + Math.sin(t * 8) * .06); }
        const showSpot = role === 'bump' || role === 'set' || role === 'spike'; spot.visible = showSpot; if (showSpot) { const c = role === 'spike' ? G.spikeAt && { x: G.spikeAt.x, z: G.spikeAt.z + .35 } : G.contact; if (c) { spot.position.set(c.x, .02, c.z); const ok = Math.hypot(P[0].x - c.x, P[0].z - c.z) < reach(P[0]); spotM.color.setHex(ok ? 0x2ecc71 : 0xffa94d); } }
        const showTrail = cfg.trail && G.pred && B.live; dots.forEach((d, i) => { const pt = showTrail && G.pred.pts[i + 1]; d.visible = !!pt; if (pt) d.position.copy(pt); });
        renderPlayers(dt0); sandFx.update(dt, -6); hitFx.update(dt, 0);
        for (const c of crowd) { c.jump = Math.max(0, (c.jump || 0) - dt0 * .6); c.b.position.y = c.y + Math.abs(Math.sin(t * 9 + c.ph)) * .25 * c.jump; }
        ocean.update(t, scene.background); shore(t);
        if (sun.target) { sun.position.set(B.p.x - 10, 22, 12); sun.target.position.set(0, 0, 0); }
        cam(dt0);
        // HUD (throttled)
        if (t - lastHud > .05) { lastHud = t; hud(role); }
        if (msgT > 0 && (msgT -= dt0) <= 0) q('.f3Msg').classList.remove('show');
      },
      stop() { removeEventListener('keydown', onKey); removeEventListener('keyup', onKey); amb && amb.stop && amb.stop(); musicDuck(false); root.remove(); $('game').classList.remove('f3mode'); },
    };
    function hud(role) {
      q('.s0').textContent = G.score[0]; q('.s1').textContent = G.score[1]; q('.sv0').style.visibility = G.serveTeam === 0 ? 'visible' : 'hidden'; q('.sv1').style.visibility = G.serveTeam === 1 ? 'visible' : 'hidden';
      const mp = [0, 1].find(k => G.score[k] >= cfg.to - 1 && G.score[k] > G.score[1 - k]); q('.mp').textContent = mp !== undefined && G.st !== 'end' ? `MATA PERLAWANAN · ${TEAM[mp].bm}` : `ke ${cfg.to}`;
      const mine = G.st === 'serve' && G.serveTeam === 0 && G.server[0] === 0;
      const lab = mine ? ['🏐', G.charging ? 'LEPAS!' : 'SERVIS'] : role === 'bump' ? ['🙌', 'TERIMA'] : role === 'set' ? ['👐', 'SET'] : role === 'spike' ? ['💥', 'REJAM'] : ['🏐', '—'];
      actB.querySelector('i').textContent = lab[0]; actB.querySelector('b').textContent = lab[1]; actB.classList.toggle('dim', lab[1] === '—');
      const m = q('.vbMeter'); m.classList.toggle('show', mine); if (mine) { m.querySelector('i').style.height = `${G.serveCharge * 100}%`; m.classList.toggle('jumpS', G.serveCharge > .85); }
      const tm = q('.vbTiming'); const showT = role === 'spike' && G.idealJump; tm.classList.toggle('show', !!showT); if (showT) { const left = G.idealJump - t; tm.querySelector('.mk').style.left = `${clamp(50 - left * 60, 0, 100)}%`; }
      jumpB.classList.toggle('hot', role === 'defend' && G.attacker && G.attacker.team === 1 && Math.abs(P[0].z) < 2.2);
      const far = G.st === 'rally' && (role === 'bump' || role === 'set') && G.contact && G.pred && Math.hypot(P[0].x - G.contact.x, P[0].z - G.contact.z) > reach(P[0]) && G.pred.t < 1.0; diveB.hidden = !far;
    }
    function endMatch() { const win = G.winner === 0, [a, b] = G.score, stars = win ? (a - b >= 4 ? 3 : 2) : 1; win ? (sfx.good(), sfx.cheer && sfx.cheer()) : sfx.bad(); for (const c of crowd) c.jump = win ? 3 : .5;
      setTimeout(() => { over.hidden = false; over.innerHTML = `<div class="f3Card ${win ? 'win' : 'loss'}"><div class="kick">BOLA TAMPAR PANTAI · ${VB_DIFF[cfg.diff].bm.toUpperCase()}</div><h2>${win ? '🏆 KAMPUNG MENANG!' : 'PANTAI MENANG'}</h2><p class="big">${a} – ${b}</p><div class="bigstars">${[0, 1, 2].map(k => `<span class="${k < stars ? 'on' : ''}">★</span>`).join('')}</div><div class="f3Row"><button class="f3B primary" data-e="ok">Teruskan ▶</button><button class="f3B" data-e="again">🔁 Main lagi</button></div></div>`;
        over.querySelector('[data-e="ok"]').onclick = () => api.finish({ stars, res: win ? 'win' : 'loss', us: a, them: b, hits: G.rally });
        over.querySelector('[data-e="again"]').onclick = () => { over.hidden = true; G.score = [0, 0]; G.winner = -1; G.serveTeam = 0; serveSetup(); }; }, 1800); }
  };
}
