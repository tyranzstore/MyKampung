// Futsal 3D: stylised footballers with procedural animation, the TYRANZ kampung arena, the 3v3 match scene
// (low follow camera) and the penalty shootout (third-person camera, diving keeper, 5 rounds + sudden death).
// Created through futsalScenes(deps) so it can share the 3D mini-game framework's helpers without circular imports.
import { $, clamp, sfx, save } from './core.js';
import { f3Session, F3, f3Settings } from './futsal3v3.js';

const hyp = Math.hypot, rnd = Math.random;

export function futsalScenes({ T, environment, Sparks, palm, stiltHouse, putModel, mulberry32 }) {
  const { L, W, GW, GH } = F3;

  // ============================================================ FOOTBALLER (jointed, ~1.78 m)
  function numTex(K, n, col) { const c = K.canvasTex(128, 128); c.x.clearRect(0, 0, 128, 128); c.x.fillStyle = col; c.x.font = '900 92px system-ui'; c.x.textAlign = 'center'; c.x.textBaseline = 'middle'; c.x.fillText(String(n), 64, 70); c.t.needsUpdate = true; return c.t; }
  function makeFooty(K, look) {
    const m = (c, o) => K.mat(c, { roughness: .7, ...o });
    const skin = m(look.skin), shirt = m(look.shirt, { roughness: .55 }), shorts = m(look.shorts), sock = m(look.sock), boot = m(look.boot, { roughness: .35 }), hairM = m(look.hair || 0x1a1a1a, { roughness: .9 }), trim = m(look.trim || 0xffffff);
    const g = new T.Group(), roll = new T.Group(); g.add(roll);
    const hips = new T.Group(); hips.position.y = .93; roll.add(hips);
    const pelvis = K.mesh(new T.CapsuleGeometry(.155, .1, 4, 10), shorts, 0, 0, 0, hips); pelvis.scale.set(1.3, 1, .95);
    const torso = new T.Group(); torso.position.y = .1; hips.add(torso);
    const chest = K.mesh(new T.CapsuleGeometry(.19, .3, 5, 12), shirt, 0, .27, 0, torso); chest.scale.set(1.25, 1, .78);
    K.mesh(new T.TorusGeometry(.085, .018, 6, 14), trim, 0, .53, 0, torso, false).rotation.x = Math.PI / 2;
    if (look.num !== undefined) { const t = numTex(K, look.num, look.numCol || '#fff'); for (const s of [-1, 1]) { const p = K.mesh(new T.PlaneGeometry(.22, .22), new T.MeshBasicMaterial({ map: t, transparent: true }), 0, .3, s * .158, torso, false); if (s < 0) p.rotation.y = Math.PI; } }
    const neck = K.cyl(.05, .055, .08, skin, 0, .56, 0, torso, 8); neck.castShadow = false;
    const head = new T.Group(); head.position.y = .7; torso.add(head);
    const skull = K.mesh(new T.SphereGeometry(.125, 16, 12), skin, 0, 0, 0, head); skull.scale.set(.95, 1.08, 1);
    const hair = K.mesh(new T.SphereGeometry(.132, 14, 8, 0, Math.PI * 2, 0, Math.PI * .55), hairM, 0, .02, -.01, head); hair.castShadow = false;
    for (const s of [-1, 1]) { K.mesh(new T.SphereGeometry(.018, 8, 6), m(0x111111), s * .045, .02, .115, head, false); K.mesh(new T.SphereGeometry(.028, 8, 6), skin, s * .125, 0, 0, head, false); }
    K.mesh(new T.ConeGeometry(.02, .05, 6), skin, 0, -.02, .13, head, false).rotation.x = Math.PI / 2;
    const arm = (s) => { const sh = new T.Group(); sh.position.set(s * .27, .45, 0); torso.add(sh);
      K.mesh(new T.CapsuleGeometry(.055, .1, 3, 8), shirt, 0, -.07, 0, sh); K.mesh(new T.CapsuleGeometry(.045, .14, 3, 8), skin, 0, -.2, 0, sh, false);
      const el = new T.Group(); el.position.y = -.3; sh.add(el); K.mesh(new T.CapsuleGeometry(.04, .16, 3, 8), skin, 0, -.12, 0, el, false); K.mesh(new T.SphereGeometry(.05, 8, 6), look.glove ? m(look.glove) : skin, 0, -.25, .01, el, false);
      return { sh, el }; };
    const leg = (s) => { const hp = new T.Group(); hp.position.set(s * .1, -.04, 0); hips.add(hp);
      K.mesh(new T.CapsuleGeometry(.085, .1, 3, 8), shorts, 0, -.07, 0, hp); K.mesh(new T.CapsuleGeometry(.07, .2, 3, 8), skin, 0, -.24, 0, hp);
      const kn = new T.Group(); kn.position.y = -.42; hp.add(kn); K.mesh(new T.CapsuleGeometry(.062, .26, 3, 8), sock, 0, -.2, 0, kn);
      const ft = K.mesh(new T.BoxGeometry(.1, .075, .25), boot, 0, -.44, .05, kn); ft.geometry.translate(0, 0, 0);
      return { hp, kn }; };
    const f = { g, roll, hips, torso, head, armL: arm(-1), armR: arm(1), legL: leg(-1), legR: leg(1), phase: rnd() * 6, lean: 0, bob: 0 };
    return f;
  }
  // procedural animation: idle, walk, run, sprint, dribble, pass, shoot, poke/slide tackle, skill, turn lean, celebrations
  function animFooty(f, s, dt) {
    const sp = s.speed || 0, A = Math.min(1.05, sp / 6.5) * (s.sprint ? 1.12 : 1);
    f.phase += dt * (sp > .2 ? 4.2 + sp * 1.25 : 2);
    const ph = f.phase, sw = Math.sin(ph) * A, kne = Math.max(0, -Math.cos(ph));
    let hipL = -sw * .85, hipR = sw * .85, knL = Math.max(0, Math.cos(ph)) * A * 1.3 + .05, knR = kne * A * 1.3 + .05;
    let shL = sw * .8, shR = -sw * .8, elL = -.3 - A * .9, elR = -.3 - A * .9, armZL = .12, armZR = -.12;
    let leanX = sp * .028 + (s.has ? .06 : 0) + (s.sprint ? .08 : 0), hipY = .93 - Math.abs(Math.cos(ph)) * .045 * A, rollZ = clamp(-(s.turn || 0) * sp * .012, -.32, .32), y = 0, headX = 0;
    if (sp < .2) { const br = Math.sin(ph * .8) * .02; shL = br; shR = -br; hipL = hipR = 0; knL = knR = .06; leanX = .02; hipY = .93 + br * .3; elL = elR = -.25; }
    const a = s.act;
    if (a) {
      const k = clamp(a.t / a.dur, 0, 1);
      if (a.type === 'pass' || a.type === 'shoot') { // wind-up then strike (contact ~ 35-45 % through)
        const big = a.type === 'shoot' ? 1.35 : .85, w = k < .35 ? k / .35 : k < .55 ? 1 - (k - .35) / .2 * 2 : -1 + (k - .55) / .45;
        hipR = w * big; knR = k < .35 ? k / .35 * 1.4 : Math.max(0, 1.4 - (k - .35) * 5); hipL = -.15; knL = .25; leanX = a.type === 'shoot' ? -.12 + k * .25 : .05; shL = -.6; armZL = .9; armZR = -.5; shR = .4;
      } else if (a.type === 'slide') { const e = Math.sin(Math.min(1, k * 1.3) * Math.PI * .5); hipY = .93 - e * .55; leanX = -e * .95; hipR = -e * 1.45; knR = .05; hipL = -e * .6; knL = e * 1.6; shL = shR = e * .9; armZL = e * .9; armZR = -e * .9; }
      else if (a.type === 'poke') { const e = Math.sin(k * Math.PI); hipR = -e * 1.2; knR = .1; hipL = .2; knL = .5 * e; leanX = .15 * e; shL = -.4 * e; armZL = .6 * e; }
      else if (a.type === 'skill') { const e = Math.sin(k * Math.PI); hipR = -e * .6; f.roll.position.x = Math.sin(k * Math.PI * 2) * .12; rollZ += e * .35 * (a.side || 1); }
    } else f.roll.position.x = 0;
    if (s.stun > 0) { rollZ += Math.sin(s.t * 26) * .12; headX = .2; }
    if (s.celebrate > 0) { // jump + arms up, alternating with an "aeroplane" run
      const c = s.celebrate, jump = Math.abs(Math.sin(c * 6.5));
      if ((s.cel || 0) % 2 === 0) { y = jump * .42; shL = shR = 0; armZL = 2.7; armZR = -2.7; elL = elR = -.2; knL = knR = jump * .9; hipL = hipR = -jump * .4; }
      else { armZL = 1.45; armZR = -1.45; elL = elR = 0; rollZ = Math.sin(c * 3) * .35; }
    }
    const L1 = (v, t, k = 14) => v + (t - v) * Math.min(1, dt * k);
    f.legL.hp.rotation.x = L1(f.legL.hp.rotation.x, hipL, 20); f.legR.hp.rotation.x = L1(f.legR.hp.rotation.x, hipR, 20);
    f.legL.kn.rotation.x = L1(f.legL.kn.rotation.x, knL, 20); f.legR.kn.rotation.x = L1(f.legR.kn.rotation.x, knR, 20);
    f.armL.sh.rotation.x = L1(f.armL.sh.rotation.x, shL); f.armR.sh.rotation.x = L1(f.armR.sh.rotation.x, shR);
    f.armL.sh.rotation.z = L1(f.armL.sh.rotation.z, -armZL); f.armR.sh.rotation.z = L1(f.armR.sh.rotation.z, -armZR); // positive armZL / negative armZR = away from the body
    f.armL.el.rotation.x = L1(f.armL.el.rotation.x, elL); f.armR.el.rotation.x = L1(f.armR.el.rotation.x, elR);
    f.hips.rotation.x = L1(f.hips.rotation.x, leanX, 10); f.hips.position.y = L1(f.hips.position.y, hipY, 18); f.roll.rotation.z = L1(f.roll.rotation.z, rollZ, 8);
    f.head.rotation.x = L1(f.head.rotation.x, headX - leanX * .5, 8); f.roll.position.y = L1(f.roll.position.y, y, 22);
  }
  const KIT = {
    home: { shirt: 0x1f7ae0, shorts: 0xffffff, sock: 0x1f7ae0, boot: 0xffd452, trim: 0xffd452, numCol: '#ffffff' },
    away: { shirt: 0xd63031, shorts: 0x1c1c1c, sock: 0xd63031, boot: 0xffffff, trim: 0x1c1c1c, numCol: '#ffffff' },
    keeper: { shirt: 0x27ae60, shorts: 0x1c1c1c, sock: 0x27ae60, boot: 0x111111, trim: 0xf1c40f, glove: 0xf39c12, numCol: '#1c1c1c' },
    keeperAway: { shirt: 0xf1c40f, shorts: 0x2d3436, sock: 0xf1c40f, boot: 0x111111, trim: 0x2d3436, glove: 0x2ecc71, numCol: '#1c1c1c' },
  };
  const SKINS = [0xc68a5a, 0xa8703e, 0x8d5a34, 0xe0b08a];

  // ============================================================ ARENA
  function ribbon(pts, w, mat, y = .061) { // flat line strip in x/z (used for curved court markings)
    const pos = [], idx = [];
    for (let i = 0; i < pts.length; i++) { const [x, z] = pts[i], [x2, z2] = pts[Math.min(i + 1, pts.length - 1)], [x0, z0] = pts[Math.max(i - 1, 0)]; let dx = x2 - x0, dz = z2 - z0; const d = hyp(dx, dz) || 1; dx /= d; dz /= d; pos.push(x - dz * w / 2, y, z + dx * w / 2, x + dz * w / 2, y, z - dx * w / 2); if (i) idx.push(i * 2 - 2, i * 2 - 1, i * 2, i * 2 - 1, i * 2 + 1, i * 2); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return new T.Mesh(g, mat);
  }
  const arc = (cx, cz, r, a0, a1, n = 24) => { const p = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; p.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); } return p; };
  function buildArena(K, scene, M, { crowdN = 46 } = {}) {
    const r = mulberry32(7);
    // ground + apron
    K.box(140, .2, 100, K.mat(0x6aae4c), 0, -.12, 0, scene, false);
    K.box(L * 2 + 9, .06, W * 2 + 9, K.mat(0x4b4e55, { roughness: .95 }), 0, -.02, 0, scene, false);
    K.box(L * 2 + 2.4, .06, W * 2 + 2.4, K.mat(0xe67e22, { roughness: .55 }), 0, .01, 0, scene, false);
    // court surface: sports-court texture with subtle panels and a TYRANZ centre logo
    const ct = K.canvasTex(1024, 600); { const x = ct.x; x.fillStyle = '#2a6db0'; x.fillRect(0, 0, 1024, 600); for (let k = 0; k < 16; k++) { x.fillStyle = k % 2 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.035)'; x.fillRect(k * 64, 0, 64, 600); } for (let k = 0; k < 2500; k++) { x.fillStyle = `rgba(255,255,255,${Math.random() * .03})`; x.fillRect(Math.random() * 1024, Math.random() * 600, 2, 2); }
      x.save(); x.translate(512, 300); x.globalAlpha = .16; x.fillStyle = '#ffffff'; x.font = '900 86px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('TYRANZ', 0, -6); x.font = '800 24px system-ui'; x.fillText('KAMPUNG SERI DAMAI', 0, 48); x.restore(); }
    ct.t.needsUpdate = true;
    const court = K.mesh(new T.BoxGeometry(L * 2, .06, W * 2), new T.MeshStandardMaterial({ map: ct.t, roughness: .38, metalness: .05 }), 0, .02, 0, scene, false); court.receiveShadow = true;
    // markings (futsal: halfway, centre circle r3, penalty areas r6 from each post joined by a straight line, 6 m and 10 m spots, corner arcs)
    const lm = new T.MeshBasicMaterial({ color: 0xffffff }), add = (pts, w = .08) => { try { scene.add(ribbon(pts, w, lm)); } catch (e) { /* very old WebGL stacks: skip curved markings */ } };
    add([[-L, -W], [L, -W], [L, W], [-L, W], [-L, -W]]); add([[0, -W], [0, W]]); add(arc(0, 0, 3, 0, Math.PI * 2, 48));
    for (const s of [-1, 1]) { const gx = s * L;
      // futsal penalty area: quarter circles of 6 m round each post joined by a straight line (clipped to our narrower court)
      const loc = [...arc(0, GW, 6, Math.PI / 2, Math.PI, 18), ...arc(0, -GW, 6, Math.PI, Math.PI * 1.5, 18)].filter(([, z]) => Math.abs(z) <= W);
      add(loc.map(([x, z]) => [gx + s * x, z]));
      for (const d of [6, 10]) { const c = K.mesh(new T.CircleGeometry(.1, 14), lm, gx - s * d, .062, 0, scene, false); c.rotation.x = -Math.PI / 2; }
      for (const cz of [-W, W]) add(arc(gx, cz, .4, s > 0 ? (cz > 0 ? Math.PI : Math.PI / 2) : (cz > 0 ? -Math.PI / 2 : 0), s > 0 ? (cz > 0 ? Math.PI * 1.5 : Math.PI) : (cz > 0 ? 0 : Math.PI / 2), 6), .06);
      for (const zz of [-W, W]) for (const d of [5, 10]) add([[gx - s * d, zz], [gx - s * d, zz + (zz > 0 ? -.3 : .3)]], .06); // substitution-zone marks
    }
    const cm = K.mesh(new T.CircleGeometry(.1, 14), lm, 0, .062, 0, scene, false); cm.rotation.x = -Math.PI / 2;
    // goals: thick white frame, netting with depth and a slight sag
    const netT = K.canvasTex(128, 128); netT.x.strokeStyle = 'rgba(255,255,255,.95)'; netT.x.lineWidth = 2.5; for (let k = 0; k <= 128; k += 12.8) { netT.x.beginPath(); netT.x.moveTo(k, 0); netT.x.lineTo(k, 128); netT.x.moveTo(0, k); netT.x.lineTo(128, k); netT.x.stroke(); } netT.t.wrapS = netT.t.wrapT = T.RepeatWrapping; netT.t.repeat.set(6, 4); netT.t.needsUpdate = true;
    const netM = new T.MeshStandardMaterial({ map: netT.t, transparent: true, side: T.DoubleSide, depthWrite: false, alphaTest: .15, roughness: 1 });
    const frame = K.mat(0xffffff, { roughness: .25 }), redM = K.mat(0xd63031);
    const nets = [];
    for (const s of [-1, 1]) { const g = K.group(s * L, 0, 0, scene);
      for (const z of [-GW, GW]) { K.box(.08, GH, .08, frame, s * .04, GH / 2, z, g); for (let k = 0; k < 4; k++) K.box(.085, .2, .085, redM, s * .04, .2 + k * .5, z, g, false); }
      K.box(.08, .08, GW * 2 + .08, frame, s * .04, GH, 0, g);
      const n = K.group(0, 0, 0, g);
      const back = new T.PlaneGeometry(GW * 2, GH, 8, 6); { const pa = back.attributes.position; if (pa && pa.count) for (let i = 0; i < pa.count; i++) { const u = pa.getX(i) / GW, v = (pa.getY(i) + GH / 2) / GH; pa.setZ(i, -(1 - u * u) * .12 * (1 - v * .5)); } back.computeVertexNormals(); }
      const bk = K.mesh(back, netM, s * 1, GH * .5, 0, n, false); bk.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
      for (const z of [-GW, GW]) { const sd = K.mesh(new T.PlaneGeometry(1, GH), netM, s * .5, GH / 2, z, n, false); }
      const top = K.mesh(new T.PlaneGeometry(1, GW * 2), netM, s * .5, GH - .02, 0, n, false); top.rotation.x = Math.PI / 2; top.rotation.z = Math.PI / 2;
      for (const z of [-GW, GW]) K.box(.04, .04, .04, frame, s * 1, 0, z, g); K.box(.04, .04, GW * 2, frame, s * 1, .02, 0, g);
      nets.push({ n, s }); }
    // boards with LED-style ads (local sponsors + TYRANZ), chain-link cage behind the far side and ends (near side stays low for the camera)
    const ads = ['TYRANZ', 'MYKAMPUNG', 'WARUNG NEK MA', 'POK WAN CAR WASH', 'TYRANZ', 'KEROPOK LEKOR KAK LONG', 'DAMAI CITY MALL', 'TYRANZ'];
    const adCols = ['#111827', '#1f6f9c', '#b24f7c', '#2b7a66', '#111827', '#d35400', '#8e44ad', '#111827'];
    const adTex = (txt, bg) => { const c = K.canvasTex(512, 64); c.x.fillStyle = bg; c.x.fillRect(0, 0, 512, 64); c.x.fillStyle = txt === 'TYRANZ' ? '#ffd452' : '#ffffff'; c.x.font = `900 ${txt.length > 14 ? 30 : 40}px system-ui`; c.x.textAlign = 'center'; c.x.textBaseline = 'middle'; c.x.fillText(txt, 256, 34); c.t.needsUpdate = true; return c.t; };
    const boardLen = (L * 2 + 2) / 4;
    for (let i = 0; i < 4; i++) { const t = adTex(ads[i], adCols[i]); const b = K.mesh(new T.BoxGeometry(boardLen - .1, .7, .1), [K.mat(0x333333), K.mat(0x333333), K.mat(0x333333), K.mat(0x333333), new T.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: .35 }), K.mat(0x333333)], -L - 1 + boardLen * (i + .5), .35, -W - 1, scene); }
    for (let i = 0; i < 4; i++) { const t = adTex(ads[4 + i], adCols[4 + i]); K.mesh(new T.BoxGeometry(boardLen - .1, .45, .1), [K.mat(0x333333), K.mat(0x333333), K.mat(0x333333), K.mat(0x333333), new T.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: .35 }), new T.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: .35 })], -L - 1 + boardLen * (i + .5), .22, W + 1, scene); }
    for (const s of [-1, 1]) { const t = adTex('TYRANZ', '#111827'); const b = K.mesh(new T.BoxGeometry(.1, .7, W * 2 + 2), K.mat(0x1f6f9c), s * (L + 1.15), .35, 0, scene); }
    const fenceT = K.canvasTex(128, 128); { const x = fenceT.x; x.strokeStyle = 'rgba(200,206,212,.85)'; x.lineWidth = 2.5; for (let k = -128; k < 256; k += 14) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k + 128, 128); x.moveTo(k + 128, 0); x.lineTo(k, 128); x.stroke(); } } fenceT.t.wrapS = fenceT.t.wrapT = T.RepeatWrapping; fenceT.t.repeat.set(14, 2.4); fenceT.t.needsUpdate = true;
    const fenceM = new T.MeshStandardMaterial({ map: fenceT.t, transparent: true, alphaTest: .2, side: T.DoubleSide, depthWrite: false });
    K.mesh(new T.PlaneGeometry(L * 2 + 2.3, 3.4), fenceM, 0, 2.4, -W - 1.05, scene, false);
    const endFence = {}; for (const s of [-1, 1]) { const f = K.mesh(new T.PlaneGeometry(W * 2 + 2.2, 3.4), fenceM, s * (L + 1.2), 2.4, 0, scene, false); f.rotation.y = Math.PI / 2; endFence[s] = f; }
    const postM = K.mat(0x7f8c8d, { metalness: .4, roughness: .4 });
    for (let x = -L - 1.1; x <= L + 1.15; x += 3.3) K.cyl(.05, .05, 4.1, postM, x, 2.05, -W - 1.1, scene, 6);
    for (const s of [-1, 1]) for (let z = -W - 1; z <= W + 1.05; z += 3.4) K.cyl(.05, .05, 4.1, postM, s * (L + 1.2), 2.05, z, scene, 6);
    K.box(L * 2 + 2.4, .06, .06, postM, 0, 4.1, -W - 1.1, scene, false);
    // floodlights with glowing heads
    const glow = (() => { const c = K.canvasTex(64, 64), g = c.x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,250,220,1)'); g.addColorStop(1, 'rgba(255,250,220,0)'); c.x.fillStyle = g; c.x.fillRect(0, 0, 64, 64); c.t.needsUpdate = true; return c.t; })();
    for (const [x, z] of [[-L - 2.5, -W - 2.6], [L + 2.5, -W - 2.6], [-L - 2.5, W + 3], [L + 2.5, W + 3]]) {
      K.cyl(.12, .18, 10, postM, x, 5, z, scene, 8); const hd = K.group(x, 10.1, z, scene); hd.lookAt(0, 0, 0);
      K.box(1.8, .9, .25, K.mat(0x2d3436), 0, 0, 0, hd); for (let i = 0; i < 6; i++) K.box(.42, .3, .05, K.mat(0xffffff, { emissive: 0xfff6d8, emissiveIntensity: 1.4 }), -.6 + (i % 3) * .6, i < 3 ? .2 : -.2, .14, hd, false);
      const s = new T.Sprite(new T.SpriteMaterial({ map: glow, transparent: true, depthWrite: false, opacity: .8 })); s.scale.set(4, 4, 1); s.position.set(x, 10.1, z); scene.add(s); }
    const fl = new T.DirectionalLight(0xfff4e0, .6); fl.position.set(-6, 12, 10); scene.add(fl);
    // bleachers + instanced crowd along the far side
    for (let k = 0; k < 4; k++) K.box(L * 2 + 2, .4 + k * .45, .8, K.mat([0x95a5a6, 0x7f8c8d][k % 2]), 0, (.4 + k * .45) / 2, -W - 2 - k * .8, scene);
    const bodyG = new T.CapsuleGeometry(.2, .35, 3, 8), headG = new T.SphereGeometry(.13, 10, 8);
    const bodies = new T.InstancedMesh(bodyG, new T.MeshStandardMaterial({ roughness: .8 }), crowdN), heads = new T.InstancedMesh(headG, new T.MeshStandardMaterial({ roughness: .8 }), crowdN);
    const crowd = [], dm = new T.Object3D(), col = new T.Color(), CC = [0xe74c3c, 0xf1c40f, 0x3498db, 0xecf0f1, 0x27ae60, 0x1f7ae0, 0xff7f50];
    for (let i = 0; i < crowdN; i++) { const row = i % 4, x = -L + .4 + (Math.floor(i / 4) / (crowdN / 4)) * (L * 2 - .8) + (r() - .5) * .5, y = .4 + row * .45 + .38, z = -W - 2 - row * .8; crowd.push({ x, y, z, ph: r() * 6 });
      if (bodies.setColorAt) { bodies.setColorAt(i, col.setHex(CC[i % CC.length])); heads.setColorAt(i, col.setHex(SKINS[i % 4])); } }
    scene.add(bodies); scene.add(heads);
    const setCrowd = (t, cheer) => { for (let i = 0; i < crowd.length; i++) { const c = crowd[i], j = cheer ? Math.abs(Math.sin(t * 8 + c.ph)) * .28 : Math.sin(t * 1.5 + c.ph) * .02;
      dm.position.set(c.x, c.y + j, c.z); dm.updateMatrix(); bodies.setMatrixAt(i, dm.matrix); dm.position.y += .42; dm.updateMatrix(); heads.setMatrixAt(i, dm.matrix); }
      bodies.instanceMatrix.needsUpdate = true; heads.instanceMatrix.needsUpdate = true; };
    setCrowd(0, false);
    // kampung surroundings
    stiltHouse(K, scene, -11, -W - 12, { wall: 0xc48a58 }); stiltHouse(K, scene, 10, -W - 13.5, { wall: 0x7fb3a6, roof: 0x5d4037 });
    for (const [x, z, sc] of [[-L - 6, -4, 1.2], [L + 6, -6, 1.1], [-L - 7, 6, 1], [L + 7.5, 5, 1.15], [-3, -W - 9, 1.1], [17, -W - 8, 1], [-19, -W - 6, 1.1]]) palm(K, scene, x, z, sc, r);
    for (let i = 0; i < 30; i++) { const f = K.mesh(new T.ConeGeometry(.2, .36, 3), K.mat([0xe74c3c, 0xf1c40f, 0x2e86de, 0x27ae60][i % 4]), -L - 1 + i * ((L * 2 + 2) / 29), 4 - Math.sin(i / 29 * Math.PI) * .35, -W - 1.12, scene, false); f.rotation.x = Math.PI; }
    const ban = (() => { const c = K.canvasTex(1024, 96); c.x.fillStyle = '#111827'; c.x.fillRect(0, 0, 1024, 96); c.x.fillStyle = '#ffd452'; c.x.font = '900 52px system-ui'; c.x.textAlign = 'center'; c.x.textBaseline = 'middle'; c.x.fillText('TYRANZ · GELANGGANG FUTSAL KAMPUNG SERI DAMAI', 512, 52); c.t.needsUpdate = true; return new T.Mesh(new T.PlaneGeometry(16, 1.4), new T.MeshBasicMaterial({ map: c.t })); })(); ban.position.set(0, 5, -W - 4.9); scene.add(ban); K.box(16.4, 1.6, .1, K.mat(0x2d3436), 0, 5, -W - 5, scene, false);
    return { nets, setCrowd, endFence };
  }
  function ballMesh(K, scene, M) {
    const ball = new T.Group(); scene.add(ball);
    const bm = putModel(M, 'sport/soccer_ball', ball, 0, -F3.R * 1.15, { h: F3.R * 2.3 });
    if (!bm) { const t = K.canvasTex(256, 128); t.x.fillStyle = '#fff'; t.x.fillRect(0, 0, 256, 128); t.x.fillStyle = '#111'; for (let k = 0; k < 12; k++) { const cx = (k % 6) * 46 + (Math.floor(k / 6) % 2) * 23, cy = 32 + Math.floor(k / 6) * 64; t.x.beginPath(); for (let a = 0; a < 5; a++) t.x.lineTo(cx + Math.cos(a * 1.2566) * 13, cy + Math.sin(a * 1.2566) * 13); t.x.fill(); } t.t.needsUpdate = true; K.mesh(new T.SphereGeometry(F3.R * 1.15, 20, 14), new T.MeshStandardMaterial({ map: t.t, roughness: .45 }), 0, 0, 0, ball); }
    const shadow = K.mesh(new T.CircleGeometry(.17, 18), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .32, depthWrite: false }), 0, .066, 0, scene, false); shadow.rotation.x = -Math.PI / 2;
    const ax = new T.Vector3(), q = T.Quaternion ? new T.Quaternion() : null;
    return { ball, shadow, place(x, y, z, vx, vz, dt) { ball.position.set(x, y, z); const sp = hyp(vx, vz); if (sp > .05 && q && ball.quaternion) { ax.set(vz, 0, -vx).normalize(); q.setFromAxisAngle(ax, -sp * dt / F3.R); ball.quaternion.premultiply(q); } shadow.position.set(x, .066, z); shadow.scale.setScalar(1 + y * .45); shadow.material.opacity = .32 / (1 + y * .8); } };
  }
  // camera helper: exponential smoothing on our own pos/look (framework told to snap) + FOV from distance
  function camRig(view, fovDeg) { const pos = view.pos.clone(), look = view.look.clone(); return { pos, look, apply(tp, tl, dt, k = 3.2, fov = fovDeg) { const a = 1 - Math.exp(-dt * k); pos.lerp(tp, a); look.lerp(tl, a); view.pos.copy(pos); view.look.copy(look); const d = pos.distanceTo(look); view.halfH = d * Math.tan(fov * Math.PI / 360); view.halfW = view.halfH * 1.55; }, cut(tp, tl) { pos.copy(tp); look.copy(tl); } }; }

  // ============================================================ 3V3 MATCH SCENE
  function match(K, api, opts, M = {}) {
    const scene = new T.Scene(); environment(K, scene, { sky: 0x9fd4ee, shadow: 17, fogNear: 70, fogFar: 160 });
    const arena = buildArena(K, scene, M);
    let cheer = 0, t = 0, celCount = 0;
    const conf = new Sparks(scene, 400, 0xffe066, .14);
    const ses = f3Session(api, opts, {
      goal(team) { const n = arena.nets.find(q => q.s === (team === 0 ? 1 : -1)); if (n) n.kick = 1; for (let k = 0; k < 120; k++) conf.add((team === 0 ? 1 : -1) * L, 1 + rnd(), (rnd() - .5) * 3, (rnd() - .5) * 6, 3 + rnd() * 4, (rnd() - .5) * 6, 1.8); cheer = team === 0 ? 3.5 : .6; celCount++; },
      post() { cheer = Math.max(cheer, .8); },
    });
    const core = ses.core, Mm = core.M, set = f3Settings();
    const figs = Mm.players.map(p => { const f = makeFooty(K, { ...(p.team ? KIT.away : KIT.home), skin: SKINS[(p.k + p.team) % 4], hair: [0x1a1a1a, 0x3b2314, 0x111111][p.k], num: p.num }); scene.add(f.g); return f; });
    const ringM = new T.MeshBasicMaterial({ color: 0xffd452, transparent: true, opacity: .95, depthWrite: false });
    const ctlRing = K.mesh(new T.RingGeometry(.48, .62, 36), ringM, 0, .075, 0, scene, false); ctlRing.rotation.x = -Math.PI / 2; ctlRing.renderOrder = 3;
    const dirTick = K.mesh(new T.ConeGeometry(.12, .3, 3), ringM, 0, .076, 0, scene, false); dirTick.rotation.x = -Math.PI / 2;
    const marker = K.mesh(new T.ConeGeometry(.13, .26, 12), new T.MeshBasicMaterial({ color: 0xffd452 }), 0, 2.4, 0, scene, false); marker.rotation.x = Math.PI;
    const passRing = K.mesh(new T.RingGeometry(.35, .45, 24), new T.MeshBasicMaterial({ color: 0x7cf0ff, transparent: true, opacity: .7, depthWrite: false }), 0, .074, 0, scene, false); passRing.rotation.x = -Math.PI / 2;
    const B3 = ballMesh(K, scene, M);
    const view = { pos: new T.Vector3(0, 6.5, 10), look: new T.Vector3(0, .6, 0), halfW: 6, halfH: 4, snap: true };
    const rig = camRig(view, 46); let lead = 1;
    return {
      scene, view, core, ray() { return { ok: false }; }, down() {}, move() {}, up() {}, timerText: ses.timerText,
      dbg: () => ({ st: Mm.st, score: Mm.score, clock: Mm.clock, ctl: Mm.ctl, charge: Mm.charge, cam: { x: view.pos.x, y: view.pos.y, z: view.pos.z }, ball: { x: Mm.ball.x, z: Mm.ball.z, y: Mm.ball.y, owner: Mm.ball.owner && Mm.ball.owner.id }, players: Mm.players.map(p => ({ x: p.x, z: p.z, team: p.team, act: p.act && p.act.type })) }),
      update(dt) {
        t += dt; ses.tick(dt); const B = Mm.ball, c = Mm.players[Mm.ctl];
        Mm.players.forEach((p, i) => { const f = figs[i]; f.g.position.set(p.x, 0, p.z); f.g.rotation.y = Math.PI / 2 - p.dir;
          animFooty(f, { speed: hyp(p.vx, p.vz), sprint: p.sprinting, has: B.owner === p, act: p.act ? { ...p.act, side: Math.sign(p.turn) || 1 } : null, turn: p.turn, stun: p.stun, celebrate: p.celebrate, cel: celCount + p.k, t }, dt); });
        // camera: frames the controlled player and the ball, leans toward the attacking direction, pulls back when they are far apart
        const own = B.owner ? B.owner.team : Mm.poss; lead += ((own === 0 ? 1 : -.6) - lead) * Math.min(1, dt * 1.5);
        const fx = c.x * .55 + B.x * .45 + lead * 2.2, fz = c.z * .55 + B.z * .45;
        const spread = hyp(c.x - B.x, c.z - B.z), zk = set.zoom * (1 + clamp((spread - 3) / 14, 0, .35)) * (Mm.st === 'goal' ? .85 : 1);
        const cx = clamp(fx, -L + 3.5, L - 3.5), cz = clamp(fz, -W + 2.5, W - 1.5);
        rig.apply(new T.Vector3(cx - lead * .6, 5.4 * zk + .6, cz * .3 + 8.4 * zk), new T.Vector3(cx + lead * .4, .7, cz * .85 - .8), dt, Mm.st === 'kickoff' ? 6 : 3.4);
        ctlRing.position.set(c.x, .075, c.z); ctlRing.scale.setScalar(1 + Math.sin(t * 6) * .05); ringM.color.setHex(Mm.charge >= 0 ? 0xff7f50 : 0xffd452);
        dirTick.position.set(c.x + Math.cos(c.dir) * .78, .076, c.z + Math.sin(c.dir) * .78); dirTick.rotation.z = -c.dir - Math.PI / 2;
        marker.position.set(c.x, 2.25 + Math.sin(t * 5) * .06, c.z); marker.rotation.y = t * 2;
        const pt = Mm.passTo && !B.owner && B.last === 0 ? Mm.passTo : null; passRing.visible = !!pt; if (pt) passRing.position.set(pt.x, .074, pt.z);
        B3.place(B.x, B.y, B.z, B.vx, B.vz, dt);
        for (const n of arena.nets) { n.kick = Math.max(0, (n.kick || 0) - dt * 1.3); n.n.scale.x = 1 + Math.sin(n.kick * Math.PI) * .4; }
        cheer = Math.max(0, cheer - dt); arena.setCrowd(t, cheer > 0); conf.update(dt, -4);
      },
      stop() { ses.stop(); },
    };
  }

  // ============================================================ PENALTY SHOOTOUT
  function penalty(K, api, opts, M = {}) {
    const scene = new T.Scene(); environment(K, scene, { sky: 0x9fd4ee, shadow: 17, fogNear: 70, fogFar: 160 });
    const arena = buildArena(K, scene, M);
    const SPOT = L - 6, set = f3Settings(), ASS = [1, .7, .45][set.assist];
    const taker = makeFooty(K, { ...KIT.home, skin: SKINS[0], hair: 0x1a1a1a, num: 10 });
    const rival = makeFooty(K, { ...KIT.away, skin: SKINS[2], hair: 0x111111, num: 9 });
    const gkThem = makeFooty(K, { ...KIT.keeperAway, skin: SKINS[1], hair: 0x111111, num: 1 });
    const gkUs = makeFooty(K, { ...KIT.keeper, skin: SKINS[3], hair: 0x3b2314, num: 1 });
    for (const f of [taker, rival, gkThem, gkUs]) scene.add(f.g);
    const B3 = ballMesh(K, scene, M), conf = new Sparks(scene, 300, 0xffe066, .14);
    // aiming reticle on the goal plane
    const retM = new T.MeshBasicMaterial({ color: 0xffd452, transparent: true, opacity: .95, depthTest: false });
    const ret = K.group(L - .02, 1, 0, scene); ret.rotation.y = -Math.PI / 2; K.mesh(new T.RingGeometry(.14, .19, 32), retM, 0, 0, 0, ret, false); K.box(.5, .025, .01, retM, 0, 0, 0, ret, false); K.box(.025, .5, .01, retM, 0, 0, 0, ret, false); ret.renderOrder = 6;
    const S2 = { ball: { x: L - 6, y: F3.R, z: 0, vx: 0, vy: 0, vz: 0 }, round: 1, turn: 'us', us: [], them: [], ph: 'intro', t: 0, aim: { z: .6, y: .7 }, power: -1, kick: null, gk: null, rec: [], replayT: 0, choice: null, msg: '', result: null };
    const view = { pos: new T.Vector3(SPOT - 4, 1.8, .9), look: new T.Vector3(L, 1, 0), halfW: 4, halfH: 3, snap: true }; const rig = camRig(view, 40);
    // ---- HUD / controls overlay
    const root = document.createElement('div'); root.className = 'f3 pk'; root.innerHTML = `
      <div class="f3Score"><b class="t0">MYKAMPUNG</b><span class="dots d0"></span><span class="sc">0 - 0</span><span class="dots d1"></span><b class="t1">LAWAN</b></div>
      <div class="f3Clock rnd">P1</div><button class="f3Pause" aria-label="Jeda · Pause">❚❚</button>
      <div class="f3Msg"></div><div class="pkHint"></div>
      <div class="pkAim"></div>
      <div class="pkDive" hidden><button data-d="-1">◀<small>KIRI</small></button><button data-d="0">▲<small>TENGAH</small></button><button data-d="1">▶<small>KANAN</small></button></div>
      <div class="f3Btns pkBtns"><button data-b="S" class="bB"><i>⚽</i><small>TENDANG</small><span class="pw"><b></b></span></button></div>
      <div class="f3Over" hidden></div>`;
    $('game').append(root); $('game').classList.add('f3mode');
    const q = (s) => root.querySelector(s);
    let drag = null; const aimEl = q('.pkAim'), shootEl = q('.pkBtns .bB'), diveEl = q('.pkDive'), over = q('.f3Over');
    const onAimDown = (e) => { if (S2.ph !== 'aim') return; e.preventDefault(); drag = { id: e.pointerId, x: e.clientX, y: e.clientY, z: S2.aim.z, yy: S2.aim.y }; aimEl.setPointerCapture(e.pointerId); };
    const onAimMove = (e) => { if (!drag || e.pointerId !== drag.id) return; const k = 3.2 / Math.max(260, aimEl.clientWidth * .5); S2.aim.z = clamp(drag.z + (e.clientX - drag.x) * k, -GW - .4, GW + .4); S2.aim.y = clamp(drag.yy - (e.clientY - drag.y) * k, .12, GH + .35); };
    const onAimUp = (e) => { if (drag && e.pointerId === drag.id) drag = null; };
    aimEl.addEventListener('pointerdown', onAimDown); aimEl.addEventListener('pointermove', onAimMove); aimEl.addEventListener('pointerup', onAimUp); aimEl.addEventListener('pointercancel', onAimUp);
    let shootId = null;
    const shootDown = (e) => { e && (e.preventDefault(), e.stopPropagation()); if (S2.ph !== 'aim' || S2.power >= 0) return; S2.power = 0; shootEl.classList.add('on'); if (e) { shootId = e.pointerId; try { shootEl.setPointerCapture(e.pointerId); } catch {} } };
    const shootUp = (e) => { if (e && shootId !== null && e.pointerId !== shootId) return; shootId = null; shootEl.classList.remove('on'); if (S2.ph === 'aim' && S2.power >= 0) startKick('us', S2.aim.z, S2.aim.y, Math.max(.12, S2.power)); };
    shootEl.addEventListener('pointerdown', shootDown); shootEl.addEventListener('pointerup', shootUp); shootEl.addEventListener('pointercancel', shootUp); shootEl.addEventListener('lostpointercapture', shootUp);
    const diveBtns = [...diveEl.querySelectorAll('button')], onDive = (e) => { e.preventDefault(); chooseDive(+e.currentTarget.dataset.d); }; diveBtns.forEach(b => b.addEventListener('pointerdown', onDive));
    const keys = new Set();
    const onKey = (e) => { if (!root.isConnected) return; const down = e.type === 'keydown';
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS'].includes(e.code)) { e.preventDefault(); down ? keys.add(e.code) : keys.delete(e.code);
        if (down && S2.ph === 'defend') chooseDive({ ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1, ArrowUp: 0, KeyW: 0, ArrowDown: 0, KeyS: 0 }[e.code]); return; }
      if (e.code === 'Space' || e.code === 'KeyK') { e.preventDefault(); if (e.repeat) return; down ? shootDown() : shootUp(); }
      if (down && (e.code === 'KeyP' || e.code === 'Escape')) pause(!S2.paused); };
    addEventListener('keydown', onKey); addEventListener('keyup', onKey);
    const noGesture = (e) => e.preventDefault(); root.addEventListener('touchmove', noGesture, { passive: false });
    const pauseBtn = q('.f3Pause'); pauseBtn.onclick = () => { sfx.tap(); pause(!S2.paused); };
    function pause(on) { if (S2.ph === 'end') return; S2.paused = on; over.hidden = !on; if (on) { over.innerHTML = `<div class="f3Card"><h2>DIJEDA · PAUSED</h2><div class="f3Row"><button class="f3B primary" data-o="resume">▶ Teruskan</button><button class="f3B" data-o="exit">🏠 Kembali ke Kampung</button></div></div>`; bindOver(); } }
    function bindOver() { over.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { sfx.tap(); const o = b.dataset.o; if (o === 'resume') pause(false); else if (o === 'replay') restart(); else if (o === 'exit') exit(); }); }
    const dots = (arr) => { const n = Math.max(5, arr.length + (arr.length >= 5 ? 0 : 0)); let h = ''; for (let i = 0; i < Math.max(5, arr.length); i++) h += `<i class="${arr[i] === 'G' ? 'g' : arr[i] === 'X' ? 'x' : ''}"></i>`; return h; };
    const goals = (a) => a.filter(v => v === 'G').length;
    function hud() { q('.d0').innerHTML = dots(S2.us); q('.d1').innerHTML = dots(S2.them); q('.sc').textContent = `${goals(S2.us)} - ${goals(S2.them)}`; q('.rnd').textContent = S2.round > 5 ? `MATI MENGEJUT · ${S2.round}` : `PUSINGAN ${S2.round}/5`;
      const m = q('.f3Msg'); m.textContent = S2.msg; m.classList.toggle('show', !!S2.msg); m.classList.toggle('goal', S2.msg.startsWith('GOL'));
      q('.pkHint').textContent = S2.ph === 'aim' ? 'Seret untuk bidik · Drag to aim — tahan TENDANG untuk kuasa · hold SHOOT for power' : S2.ph === 'defend' ? 'Pilih arah terjun! · Choose where to dive!' : S2.ph === 'replay' ? 'ULANG TAYANG · REPLAY (ketik untuk langkau)' : '';
      q('.pkHint').classList.toggle('show', !!q('.pkHint').textContent); diveEl.hidden = !(S2.turn === 'them' && ['defend', 'runup', 'flight'].includes(S2.ph) && S2.choice === null); shootEl.parentElement.style.visibility = S2.ph === 'aim' ? 'visible' : 'hidden'; aimEl.style.pointerEvents = S2.ph === 'aim' ? 'auto' : S2.ph === 'replay' ? 'auto' : 'none';
      q('.bB .pw').style.opacity = S2.power >= 0 ? 1 : 0; q('.bB .pw b').style.height = `${Math.max(0, S2.power) * 100}%`; }
    aimEl.addEventListener('click', () => { if (S2.ph === 'replay') S2.replayT = 99; });
    // ---- shootout flow
    const gkFor = () => S2.turn === 'us' ? gkThem : gkUs, shooterFor = () => S2.turn === 'us' ? taker : rival;
    function setupKick() {
      hud.last = ''; S2.kick = null; S2.gk = { z: 0, side: 0, h: 0, d: 0, react: 0, go: false, stay: false }; S2.choice = null; S2.power = -1; S2.rec = []; S2.t = 0;
      const sh = shooterFor(), gk = gkFor(); taker.g.visible = S2.turn === 'us'; rival.g.visible = S2.turn === 'them'; gkThem.g.visible = S2.turn === 'us'; gkUs.g.visible = S2.turn === 'them';
      sh.g.position.set(RUN.x, 0, RUN.z); sh.g.rotation.y = Math.PI / 2 - .55; gk.g.position.set(L - .35, 0, 0); gk.g.rotation.y = -Math.PI / 2; gk.roll.rotation.z = 0;
      B3.place(SPOT, F3.R, 0, 0, 0, 0); S2.ball = { x: SPOT, y: F3.R, z: 0, vx: 0, vy: 0, vz: 0 };
      if (S2.turn === 'us') { S2.ph = 'aim'; S2.msg = ''; rig.cut(CAM.aimP, CAM.aimL); }
      else { S2.ph = 'defend'; S2.msg = ''; S2.aiRun = 1.6 + rnd() * .5; rig.cut(CAM.keepP, CAM.keepL); }
      hud();
    }
    function startKick(who, tz, ty, power) {
      // shot error grows with too much (or too little) power; aim assist narrows it
      const err = (.06 + Math.max(0, power - .85) * 1.6 + Math.max(0, .3 - power) * .6) * (who === 'us' ? ASS : 1);
      const az = tz + (rnd() - .5) * 2 * err, ay = Math.max(.1, ty + (rnd() - .5) * 2 * err + (power > .93 ? .35 : 0));
      S2.kick = { who, tz: az, ty: ay, power, run: who === 'us' ? .42 : 0, t: 0, contact: false, out: null };
      S2.ph = 'runup'; S2.power = -1; hud();
    }
    function contact() {
      const k = S2.kick, sp = 12 + k.power * 13, dist = hyp(L - SPOT, k.tz), T0 = dist / sp;
      k.contact = true; k.T = T0; k.t = 0; sfx.kick();
      S2.ball = { x: SPOT, y: F3.R, z: 0, vx: (L - SPOT) / T0, vz: k.tz / T0, vy: (k.ty - F3.R + 4.9 * T0 * T0) / T0, curve: (rnd() - .5) * .4 };
      const g = S2.gk;
      if (S2.turn === 'us') { // AI keeper: reads harder-to-read shots less often, sometimes guesses wrong
        const read = rnd() < .3 + (1 - k.power) * .35, sideOf = Math.abs(k.tz) < .45 ? 0 : Math.sign(k.tz);
        g.side = read ? sideOf : [-1, 0, 1][Math.floor(rnd() * 3)]; g.h = read ? (k.ty > 1.15 ? 1 : 0) : rnd() < .5 ? 1 : 0; g.react = .1 + rnd() * .12; g.go = true;
      } else { if (S2.choice === null) { g.side = 0; g.react = .05; g.go = false; } else { g.react = .05; g.go = true; } g.h = k.ty > 1.1 ? 1 : 0; if (S2.choice === null) { g.lateGo = true; } } // our keeper height is auto-matched (assist)
    }
    function chooseDive(d) { if (!['defend', 'runup', 'flight'].includes(S2.ph)) return; if (S2.choice !== null || S2.turn !== 'them') return; S2.choice = d; S2.gk.side = -d; S2.choiceAt = S2.kick && S2.kick.contact ? 1 : 0; if (S2.ph === 'flight') { S2.gk.react = .12; S2.gk.go = true; } sfx.tap(); hud(); }
    // keeper body segment (feet → hands) in the goal plane; the ball is saved if it passes within reach of it
    function gkSeg(g) { const ang = g.side * g.d * 1.25, lift = g.d * (g.side ? .15 + g.h * .55 : .35), base = g.z, len = g.side ? 2.05 : 2.25; return { ax: base, ay: lift, bx: base + Math.sin(ang) * len * (g.side ? 1 : 0), by: lift + Math.cos(ang) * len, w: g.side ? .3 : .4 }; }
    function resolve() {
      const k = S2.kick, b = S2.ball, g = S2.gk; let out;
      if (Math.abs(b.z) > GW + .08 || b.y > GH + .06) out = 'miss';
      else if (Math.abs(Math.abs(b.z) - GW) < .065 || Math.abs(b.y - GH) < .06) out = 'post';
      else { const s = gkSeg(g), dx = s.bx - s.ax, dy = s.by - s.ay, L2 = dx * dx + dy * dy || 1, tt = clamp(((b.z - s.ax) * dx + (b.y - s.ay) * dy) / L2, 0, 1); const d = hyp(b.z - (s.ax + dx * tt), b.y - (s.ay + dy * tt)); out = d < s.w + .11 ? 'save' : 'goal'; }
      k.out = out; (S2.turn === 'us' ? S2.us : S2.them).push(out === 'goal' ? 'G' : 'X');
      const ours = S2.turn === 'us';
      if (out === 'goal') { S2.msg = ours ? 'GOL!!!' : 'LAWAN JARING…'; ours ? (sfx.good(), sfx.cheer()) : sfx.bad(); const n = arena.nets.find(n => n.s === 1); n.kick = 1; if (ours) for (let i = 0; i < 90; i++) conf.add(L, 1 + rnd(), (rnd() - .5) * 3, (rnd() - .5) * 5, 3 + rnd() * 4, (rnd() - .5) * 5, 1.6); S2.cheer = ours ? 3 : 0; }
      else if (out === 'save') { S2.msg = ours ? 'DISELAMATKAN! · SAVED' : 'SELAMAT! HEBAT! · GREAT SAVE'; ours ? sfx.bad() : (sfx.good(), sfx.cheer()); S2.cheer = ours ? 0 : 2.5; b.vx = -Math.abs(b.vx) * .35; b.vz = (rnd() - .5) * 6; b.vy = 2.5; }
      else if (out === 'post') { S2.msg = 'KENA TIANG! · POST'; sfx.hammer(); b.vx = -Math.abs(b.vx) * .5; b.vy = 1.5; }
      else { S2.msg = ours ? 'TERLEPAS · MISSED' : 'LAWAN TERSASAR · THEY MISSED'; ours ? sfx.bad() : sfx.good(); }
      S2.ph = 'outcome'; S2.t = 0; hud();
    }
    function decided() { const n = Math.max(S2.us.length, S2.them.length), a = goals(S2.us), b = goals(S2.them), ru = Math.max(0, 5 - S2.us.length), rt = Math.max(0, 5 - S2.them.length);
      if (S2.us.length <= 5 && S2.them.length <= 5) { if (a + ru < b || b + rt < a) return true; if (S2.us.length === 5 && S2.them.length === 5) return a !== b; return false; }
      return S2.us.length === S2.them.length && a !== b; }
    function next() {
      S2.msg = '';
      if (S2.turn === 'us') S2.turn = 'them'; else { S2.turn = 'us'; S2.round++; }
      if (decided() || S2.round > 12) return finishShootout();
      setupKick();
    }
    function finishShootout() {
      const a = goals(S2.us), b = goals(S2.them), res = a > b ? 'win' : a < b ? 'loss' : 'draw'; S2.ph = 'end'; S2.result = { us: a, them: b, res, rounds: S2.round };
      sfx.whistle && sfx.whistle(true); if (res === 'win') sfx.cheer();
      over.hidden = false; over.innerHTML = `<div class="f3Card end ${res}"><div class="kick">SEPAKAN PENALTI TAMAT · SHOOTOUT OVER</div><h2>${res === 'win' ? 'MENANG!' : res === 'loss' ? 'KALAH' : 'SERI'}</h2><div class="f3Big">MYKAMPUNG <b>${a} - ${b}</b> LAWAN</div><p class="muted">${S2.round > 5 ? 'Diputuskan dengan mati mengejut · Decided in sudden death' : '5 pusingan · 5 rounds'}</p><div class="f3Row"><button class="f3B primary" data-o="replay">🔁 MAIN LAGI</button><button class="f3B" data-o="exit">🏠 KEMBALI KE KAMPUNG</button></div></div>`; bindOver(); hud();
      api.progress(1);
    }
    function restart() { over.hidden = true; S2.us = []; S2.them = []; S2.round = 1; S2.turn = 'us'; S2.result = null; S2.done = (S2.done || 0); setupKick(); }
    function exit() { const r = S2.result || { us: goals(S2.us), them: goals(S2.them), res: 'quit' }; api.finish({ stars: r.res === 'win' ? (S2.round > 5 ? 2 : 3) : r.res === 'quit' ? 0 : 1, us: r.us, them: r.them, res: r.res, goals: r.us, shots: S2.us.length }); }
    api.tools([]); api.step('Sepakan Penalti', 'Penalty shootout');
    S2.ph = 'intro'; S2.t = 0; S2.msg = 'SEPAKAN PENALTI · 5 PUSINGAN';
    const tmpP = new T.Vector3(), tmpL = new T.Vector3(); let t = 0;
    const RUN = { x: SPOT - 1.7, z: -1.15 }; // run-up start: behind-left of the ball, out of the camera's line to the goal
    const CAM = { aimP: new T.Vector3(SPOT - 6.5, 2.7, 0), aimL: new T.Vector3(L, .95, 0), keepP: new T.Vector3(L + 5.6, 4.1, 0), keepL: new T.Vector3(SPOT - .6, .45, 0) };
    function poseGk(f, g, dt) { // keeper: ready stance, then a dive along the goal line (or a jump when staying central)
      f.g.position.z = g.z; f.roll.rotation.z = -g.side * g.d * 1.25; f.roll.position.y = g.side ? g.d * (.15 + g.h * .5) * Math.sin(Math.min(1, g.d) * Math.PI * .9) : g.d * .35;
      const up = g.d > 0 ? 2.8 : .9; f.armL.sh.rotation.z = -up; f.armR.sh.rotation.z = up; f.armL.sh.rotation.x = f.armR.sh.rotation.x = g.d > 0 ? 0 : -.6;
      f.hips.position.y = .9 - (g.d > 0 ? 0 : .12); f.legL.kn.rotation.x = f.legR.kn.rotation.x = g.d > 0 ? .3 : .55; f.legL.hp.rotation.x = f.legR.hp.rotation.x = g.d > 0 ? -.2 : -.35; f.hips.rotation.x = g.d > 0 ? 0 : .25;
    }
    return {
      scene, view, ray() { return { ok: false }; }, down() {}, move() {}, up() {},
      timerText: () => `⚽ ${goals(S2.us)}-${goals(S2.them)}`,
      dbg: () => ({ ph: S2.ph, turn: S2.turn, round: S2.round, us: S2.us.join(''), them: S2.them.join(''), aim: S2.aim, power: S2.power, out: S2.kick && S2.kick.out, gk: S2.gk && { side: S2.gk.side, d: S2.gk.d }, cam: { x: view.pos.x, y: view.pos.y, z: view.pos.z } }),
      shoot(z, y, p) { if (S2.ph !== 'aim') return false; S2.aim.z = z; S2.aim.y = y; startKick('us', z, y, p); return true; }, dive: chooseDive,
      update(dt) {
        t += dt; const tut = document.getElementById('gTut'); if (S2.paused || (tut && !tut.hidden)) return;
        S2.t += dt; const realDt = dt;
        if (keys.size && S2.ph === 'aim') { const k = 1.8 * dt; if (keys.has('ArrowLeft') || keys.has('KeyA')) S2.aim.z -= k; if (keys.has('ArrowRight') || keys.has('KeyD')) S2.aim.z += k; if (keys.has('ArrowUp') || keys.has('KeyW')) S2.aim.y += k; if (keys.has('ArrowDown') || keys.has('KeyS')) S2.aim.y -= k; S2.aim.z = clamp(S2.aim.z, -GW - .4, GW + .4); S2.aim.y = clamp(S2.aim.y, .12, GH + .35); }
        if (S2.power >= 0) S2.power = Math.min(1, S2.power + dt / .9);
        if (S2.ph === 'intro' && S2.t > 1.3) { S2.msg = ''; setupKick(); }
        const sh = shooterFor(), gk = gkFor(), g = S2.gk || { z: 0, side: 0, d: 0, h: 0 };
        // opponent run-up (their kick): pick a spot, maybe shade it
        if (S2.ph === 'defend') { S2.aiRun -= dt; if (S2.aiRun <= 0) { const tz = (rnd() < .5 ? -1 : 1) * (.5 + rnd() * .85) * (rnd() < .15 ? .2 : 1), ty = .25 + rnd() * 1.4; startKick('them', tz, ty, .55 + rnd() * .35); S2.kick.run = .55; } }
        // run-up → contact
        if (S2.ph === 'runup') { const k = S2.kick; k.t += dt; const f = clamp(k.t / Math.max(.01, k.run), 0, 1);
          sh.g.position.set(RUN.x + f * (SPOT - .32 - RUN.x), 0, RUN.z + f * (-.14 - RUN.z)); sh.g.rotation.y = Math.PI / 2 - .55 + f * .4;
          if (f >= 1 && !k.contact) { contact(); sh.kickT = 0; S2.ph = 'flight'; } }
        if (sh.kickT !== undefined) { sh.kickT += dt; if (sh.kickT > .5) sh.kickT = undefined; }
        animFooty(sh, { speed: S2.ph === 'runup' ? 5 : 0, act: sh.kickT !== undefined ? { type: 'shoot', t: .2 + sh.kickT, dur: .7 } : S2.ph === 'aim' && S2.power >= 0 ? { type: 'shoot', t: S2.power * .18, dur: .7 } : null, t }, dt);
        // ball flight + keeper dive
        if (S2.ph === 'flight') { const k = S2.kick, b = S2.ball; k.t += dt; if (S2.choice !== null && S2.turn === 'them' && hud.last !== 'f') { hud.last = 'f'; hud(); }
          if (g.lateGo && !g.go && k.t > .18) { g.go = true; g.react = 0; }
          if (g.go) { g.react -= dt; if (g.react <= 0) { g.d = Math.min(1, g.d + dt / (g.side ? .42 : .3)); g.z = g.side * g.d * (.35 + g.h * .15); } }
          b.vy -= 9.8 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; const a = b.curve * dt, vx = b.vx; b.vz += b.curve * b.vx * dt * .2;
          S2.rec.push([b.x, b.y, b.z, g.side, g.d, g.z, g.h]);
          if (b.x >= L - .05) resolve(); }
        else if (S2.ph === 'outcome') { const b = S2.ball; if (S2.kick.out === 'goal') { b.vx *= Math.exp(-6 * dt); if (b.x > L + .8) { b.x = L + .8; b.vx = 0; } } b.vy -= 9.8 * dt; b.x = Math.min(L + .85, b.x + b.vx * dt); b.y += b.vy * dt; b.z += b.vz * dt; if (b.y < F3.R) { b.y = F3.R; b.vy = Math.abs(b.vy) * .4; } if (Math.abs(b.z) > W - .2) b.vz *= -.6;
          g.d = Math.min(1, g.d + dt * 2); S2.rec.push([b.x, b.y, b.z, g.side, g.d, g.z, g.h]);
          if (S2.t > 1.5) { S2.ph = 'replay'; S2.replayT = 0; S2.msg = ''; hud(); } }
        else if (S2.ph === 'replay') { S2.replayT += dt * .5; const i = Math.min(S2.rec.length - 1, Math.floor(S2.replayT * 60)); const r = S2.rec[i];
          if (r) { S2.ball.x = r[0]; S2.ball.y = r[1]; S2.ball.z = r[2]; g.side = r[3]; g.d = r[4]; g.z = r[5]; g.h = r[6]; }
          if (S2.replayT * 60 >= S2.rec.length + 20 || S2.replayT > 2.4) next(); }
        poseGk(gk, g, dt);
        const b = S2.ball; B3.place(b.x, Math.max(F3.R, b.y), b.z, b.vx || 0, b.vz || 0, S2.ph === 'replay' ? dt * .5 : dt);
        // reticle
        ret.visible = S2.ph === 'aim'; ret.position.set(L - .02, S2.aim.y, S2.aim.z); ret.scale.setScalar(S2.power >= 0 ? 1 - S2.power * .35 + (S2.power > .85 ? Math.sin(t * 40) * .06 : 0) : 1); retM.color.setHex(S2.power > .85 ? 0xff5533 : 0xffd452);
        // camera
        if (S2.ph === 'aim' || S2.ph === 'intro') rig.apply(CAM.aimP, tmpL.set(L, .95, S2.aim.z * .12), dt, 3, 38);
        else if (S2.ph === 'runup' || S2.ph === 'flight' || S2.ph === 'outcome') { if (S2.turn === 'us') rig.apply(tmpP.set(SPOT - 6 + (S2.ph === 'runup' ? 0 : 1.4), 2.55, 0), tmpL.set(L, 1, b.z * .4), dt, 2.6, 38); else rig.apply(CAM.keepP, tmpL.set(SPOT - 1 + (b.x - SPOT) * .4, .6, b.z * .35), dt, 3, 42); }
        else if (S2.ph === 'replay') { if (S2.replayT < .05) rig.cut(tmpP.set(L - 3.2, 1.25, 5.6), tmpL.set(L - .6, .95, b.z * .3)); rig.apply(tmpP.set(L - 3.2 + S2.replayT * .6, 1.25, 5.6 - S2.replayT * .4), tmpL.set(b.x * .3 + (L - .6) * .7, .95, b.z * .3), dt, 2); }
        else if (S2.ph === 'defend') rig.apply(CAM.keepP, CAM.keepL, dt, 3, 42);
        else if (S2.ph === 'end') rig.apply(tmpP.set(L - 7, 3.2, 6), tmpL.set(L, 1, 0), dt, 1.2);
        arena.endFence[1].visible = !(S2.turn === 'them' && ['defend', 'runup', 'flight', 'outcome'].includes(S2.ph)); // keeper camera sits behind this fence
        for (const n of arena.nets) { n.kick = Math.max(0, (n.kick || 0) - dt * 1.3); n.n.scale.x = 1 + Math.sin(n.kick * Math.PI) * .45; }
        S2.cheer = Math.max(0, (S2.cheer || 0) - dt); arena.setCrowd(t, S2.cheer > 0); conf.update(dt, -4);
        if (S2.msgT !== S2.msg) { S2.msgT = S2.msg; hud(); } if (S2.power >= 0 || S2.ph === 'aim') { q('.bB .pw').style.opacity = S2.power >= 0 ? 1 : 0; q('.bB .pw b').style.height = `${Math.max(0, S2.power) * 100}%`; }
        api.progress(Math.min(.999, (S2.us.length + S2.them.length) / 10));
      },
      stop() {
        removeEventListener('keydown', onKey); removeEventListener('keyup', onKey);
        aimEl.removeEventListener('pointerdown', onAimDown); aimEl.removeEventListener('pointermove', onAimMove); aimEl.removeEventListener('pointerup', onAimUp); aimEl.removeEventListener('pointercancel', onAimUp);
        shootEl.removeEventListener('pointerdown', shootDown); shootEl.removeEventListener('pointerup', shootUp); shootEl.removeEventListener('pointercancel', shootUp); shootEl.removeEventListener('lostpointercapture', shootUp);
        diveBtns.forEach(b => b.removeEventListener('pointerdown', onDive)); root.removeEventListener('touchmove', noGesture);
        root.remove(); $('game').classList.remove('f3mode');
      },
    };
  }
  return { match, penalty, makeFooty, animFooty };
}
