// JALAN DRAG — procedural low-poly vehicles. Every installed part shows: paint (gloss / metallic), vinyls, rims, tyre width,
// body kits, spoilers, exhaust tips, turbo scoop + intercooler, Stage-3 hood bulge, nitrous decal, ride height, swingarm /
// wheelie bar on bikes. Vehicles face −Z. To use a production GLB later, set VEHICLE_GLB[id] to a model key: the body is then
// taken from the GLB and wheels named wheel-* are spun (the procedural wheels are skipped).
import { VEHICLES, PARTS } from './dragdata.js';
export const VEHICLE_GLB = {}; // e.g. { tuah: 'cars/hatchback-sports' }

// body designs (side view, x: rear − → front +): proper wheel arches cut into the body, a narrower glasshouse on top
// (tumblehome), rounded (bevelled) edges, clear-coated paint, real wheel/tyre profiles. Proportions follow real cars of each class.
const BODIES = {
  hatch: { L: 3.72, W: 1.7, wb: 2.42, belt: .93, hoodF: .76, cowlX: .74, roofF: .08, roofR: -1.26, roofY: 1.45, deckX: -1.6, tailY: 1.02, cabW: 1.42, hatch: true },
  sedan: { L: 4.52, W: 1.78, wb: 2.64, belt: .9, hoodF: .74, cowlX: 1.0, roofF: .36, roofR: -.86, roofY: 1.43, deckX: -1.52, tailY: .99, cabW: 1.48 },
  coupe: { L: 4.42, W: 1.86, wb: 2.6, belt: .82, hoodF: .64, cowlX: .76, roofF: .02, roofR: -.78, roofY: 1.27, deckX: -1.86, tailY: .9, cabW: 1.5 },
  rs: { L: 4.64, W: 1.86, wb: 2.7, belt: .92, hoodF: .74, cowlX: 1.06, roofF: .4, roofR: -.86, roofY: 1.44, deckX: -1.52, tailY: 1.0, cabW: 1.52 },
};
function vinylTex(K, kind, paint, num = 7) {
  const c = K.canvasTex(512, 128), x = c.x; x.clearRect(0, 0, 512, 128);
  const dark = ['#1b1b1b', '#2e86de', '#8e44ad', '#c0392b', '#16a085'].includes(paint), ink = dark ? '#ffffff' : '#111111';
  if (kind === 'stripes') { x.fillStyle = ink; x.fillRect(0, 34, 512, 14); x.fillRect(0, 58, 512, 8); }
  else if (kind === 'flames') { const g = x.createLinearGradient(0, 0, 512, 0); g.addColorStop(0, '#ffde3b'); g.addColorStop(.5, '#ff7b00'); g.addColorStop(1, 'rgba(220,30,0,0)'); x.fillStyle = g;
    x.beginPath(); x.moveTo(0, 20); for (let i = 0; i <= 8; i++) { const px = 40 + i * 55; x.quadraticCurveTo(px - 10, 40 + (i % 2) * 30, px + 20, 30 + Math.sin(i) * 18); } x.lineTo(470, 64); for (let i = 8; i >= 0; i--) { const px = 40 + i * 55; x.quadraticCurveTo(px + 5, 100 - (i % 2) * 20, px - 25, 104); } x.lineTo(0, 108); x.closePath(); x.fill(); }
  else if (kind === 'batik') { for (let i = 0; i < 22; i++) { const cx = 20 + i * 23, cy = 64 + Math.sin(i * 1.7) * 26; x.strokeStyle = i % 2 ? '#d4a017' : ink; x.lineWidth = 4; x.beginPath(); x.ellipse(cx, cy, 10, 18, i * .6, 0, 7); x.stroke(); x.fillStyle = i % 2 ? '#c0392b' : '#d4a017'; x.beginPath(); x.arc(cx, cy, 4, 0, 7); x.fill(); } }
  else if (kind === 'number') { x.fillStyle = '#ffffff'; x.beginPath(); x.arc(256, 64, 52, 0, 7); x.fill(); x.fillStyle = '#111'; x.font = '900 70px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(num), 256, 68); }
  else if (kind === 'tyranz') { x.fillStyle = ink; x.font = 'italic 900 68px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('TYRANZ', 256, 66); x.fillRect(90, 100, 332, 6); }
  c.t.needsUpdate = true; return c.t;
}

function wheel(T, K, r, w, style, mats, front) {
  const g = new T.Group(), spin = new T.Group(); g.add(spin);
  const rr = r * (style === 'drag' ? .6 : .66);
  // tyre with a rounded shoulder (lathe) + sidewall
  const tp = [[rr, -w / 2], [r - .035, -w / 2], [r - .006, -w / 2 + .03], [r, -w / 2 + .06], [r, w / 2 - .06], [r - .006, w / 2 - .03], [r - .035, w / 2], [rr, w / 2]].map(([x, y]) => new T.Vector2(x, y));
  const tyre = K.mesh(T.LatheGeometry ? new T.LatheGeometry(tp, 22) : new T.CylinderGeometry(r, r, w, 22), mats.tyre, 0, 0, 0, spin); tyre.rotation.z = Math.PI / 2;
  // brake disc + caliper (caliper does not spin)
  const disc = K.mesh(new T.CylinderGeometry(rr * .78, rr * .78, .03, 20), K.mat(0x8d949b, { metalness: .8, roughness: .35 }), 0, 0, 0, spin); disc.rotation.z = Math.PI / 2;
  K.box(.06, rr * .55, rr * .4, mats.caliper, 0, rr * .45, rr * .38, g);
  const s = 1, rim = new T.Group(); rim.position.x = w / 2 - .04; spin.add(rim);
  const face = style === 'steel' ? mats.steel : style === 'drag' ? mats.black : mats.chrome;
  const barrel = K.mesh(new T.CylinderGeometry(rr, rr, w - .06, 22, 1, true), face, -w / 2 + .07, 0, 0, rim); barrel.rotation.z = Math.PI / 2;
  const lip = K.mesh(new T.TorusGeometry(rr, .012, 6, 24), mats.chrome, .01, 0, 0, rim); lip.rotation.y = Math.PI / 2;
  if (style === 'steel') { const d = K.mesh(new T.CylinderGeometry(rr * .96, rr * .96, .02, 20), face, -.03, 0, 0, rim); d.rotation.z = Math.PI / 2; for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2, h = K.mesh(new T.CylinderGeometry(rr * .1, rr * .1, .025, 8), mats.dark, -.025, Math.cos(a) * rr * .62, Math.sin(a) * rr * .62, rim); h.rotation.z = Math.PI / 2; } }
  else { const n = style === 'spoke5' ? 5 : style === 'mesh' ? 12 : 6;
    for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2, len = style === 'drag' ? rr * .9 : rr * .92, sp = K.box(.03, len, style === 'mesh' ? .018 : style === 'drag' ? .03 : .07, face, -.02, 0, 0, rim); sp.rotation.x = a; sp.position.set(-.02, Math.cos(a) * len / 2, Math.sin(a) * len / 2);
      if (style === 'mesh') { const sp2 = sp.clone(); sp2.rotation.x = a + .5; rim.add(sp2); } } }
  const hub = K.mesh(new T.CylinderGeometry(rr * .2, rr * .22, .05, 10), style === 'drag' ? mats.chrome : face, -.01, 0, 0, rim); hub.rotation.z = Math.PI / 2;
  return { g, spin, r, front };
}
function plateTex(T, K) { const c = K.canvasTex(256, 64); c.x.fillStyle = '#111'; c.x.fillRect(0, 0, 256, 64); c.x.fillStyle = '#fff'; c.x.font = '900 40px system-ui'; c.x.textAlign = 'center'; c.x.textBaseline = 'middle'; c.x.fillText('TKH 2026', 128, 34); c.t.needsUpdate = true; return new T.MeshStandardMaterial({ map: c.t, roughness: .5 }); }
export function buildVehicle(T, K, vid, c, opts = {}) {
  const V = VEHICLES[vid], P = c.parts, root = new T.Group(), body = new T.Group(); root.add(body);
  const paint = T.MeshPhysicalMaterial ? new T.MeshPhysicalMaterial({ color: c.paint, metalness: c.metal ? .55 : .05, roughness: c.metal ? .32 : .4, clearcoat: 1, clearcoatRoughness: .06 }) : new T.MeshStandardMaterial({ color: c.paint, metalness: c.metal ? .65 : .12, roughness: .35 });
  const mats = { tyre: K.mat(0x1d1d1d, { roughness: .95 }), steel: K.mat(0x8a9097, { metalness: .4, roughness: .5 }), chrome: K.mat(0xdfe4ea, { metalness: .9, roughness: .2 }), black: K.mat(0x151515, { metalness: .5, roughness: .4 }),
    dark: K.mat(0x2b2b2b), glass: K.mat(0x101820, { metalness: .9, roughness: .05 }), trim: K.mat(0x0d0d0d, { roughness: .4 }), seam: K.mat(0x111111), grille: K.mat(0x0e0e0e, { roughness: .6 }), under: K.mat(0x0a0a0a, { roughness: 1 }), caliper: K.mat(0xd62d20, { roughness: .4 }), mark: K.mat(0xf2f2f2), kit: K.mat(0x202020, { roughness: .6 }), light: new T.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xfff2c0, emissiveIntensity: .6 }),
    brake: new T.MeshStandardMaterial({ color: 0x5a0000, emissive: 0xff1a1a, emissiveIntensity: .3 }) };
  const wheels = [], exhausts = [], H = (c.height || 0) / 100;
  const tier = (s) => P[s] || 0;
  if (!V.bike) {
    const B = BODIES[V.body], Lh = B.L / 2, wide = tier('body') === 2 ? .1 : 0, W = B.W + wide, bt = .06, r0 = V.r, aR = r0 + .09, sill = .27;
    const rx = -B.wb / 2, fx = B.wb / 2; // axle positions in profile space
    const sh = new T.Shape(); sh.moveTo(-Lh + .08, sill); sh.lineTo(rx - aR, sill); sh.absarc(rx, r0 + .02, aR, Math.PI, 0, true); sh.lineTo(fx - aR, sill); sh.absarc(fx, r0 + .02, aR, Math.PI, 0, true);
    sh.lineTo(Lh - .1, sill); sh.quadraticCurveTo(Lh + .04, sill, Lh + .04, .46); sh.lineTo(Lh + .03, .6); sh.quadraticCurveTo(Lh + .01, B.hoodF, Lh - .3, B.hoodF + .03); sh.lineTo(B.cowlX, B.belt);
    sh.lineTo(B.deckX, B.belt); if (!B.hatch) sh.lineTo(-Lh + .14, B.tailY); else sh.lineTo(-Lh + .1, B.tailY); sh.quadraticCurveTo(-Lh - .03, B.tailY, -Lh - .03, B.tailY - .16); sh.lineTo(-Lh - .04, .44); sh.quadraticCurveTo(-Lh - .04, sill, -Lh + .08, sill);
    const ext = (shape, w, bevel) => { const g = new T.ExtrudeGeometry(shape, { depth: w, bevelEnabled: !!bevel, bevelThickness: bevel || 0, bevelSize: bevel ? bevel * .8 : 0, bevelSegments: 3, curveSegments: 14 }); g.translate(0, 0, -w / 2); g.rotateY(Math.PI / 2); return g; };
    K.mesh(ext(sh, W - 2 * bt, bt), paint, 0, 0, 0, body);
    // glasshouse: painted roof/pillars + glass band
    const cab = new T.Shape(); cab.moveTo(B.cowlX + .04, B.belt - .02); cab.quadraticCurveTo(B.cowlX - .2, B.roofY - .06, B.roofF, B.roofY); cab.quadraticCurveTo((B.roofF + B.roofR) / 2, B.roofY + .03, B.roofR, B.roofY);
    cab.quadraticCurveTo(B.deckX + (B.hatch ? .05 : .25), B.roofY - .06, B.deckX, B.belt - .02); cab.lineTo(B.cowlX + .04, B.belt - .02);
    K.mesh(ext(cab, B.cabW - .1, .05), paint, 0, 0, 0, body);
    const gl = new T.Shape(); gl.moveTo(B.cowlX - .02, B.belt + .03); gl.quadraticCurveTo(B.cowlX - .2, B.roofY - .1, B.roofF - .02, B.roofY - .07); gl.lineTo(B.roofR + .03, B.roofY - .07); gl.quadraticCurveTo(B.deckX + (B.hatch ? .07 : .26), B.roofY - .12, B.deckX + .06, B.belt + .03); gl.lineTo(B.cowlX - .02, B.belt + .03);
    K.mesh(ext(gl, B.cabW + .01, 0), mats.glass, 0, 0, 0, body, false);
    const pz = (B.roofF + B.roofR) / 2 + .12, sideZ = B.cabW / 2 + .012; // B-pillars, door shut lines, handles, mirrors
    for (const s of [-1, 1]) { K.box(.012, B.roofY - B.belt - .08, .1, mats.trim, s * sideZ, (B.roofY + B.belt) / 2, -pz, body, false);
      for (const x of [B.cowlX - .12, pz - .06]) K.box(.01, B.belt - sill - .18, .012, mats.seam, s * (W / 2 + .001), (B.belt + sill) / 2 + .02, -x, body, false);
      K.box(.02, .03, .12, mats.chrome, s * (W / 2 + .006), B.belt - .12, -(pz + .25), body, false);
      const m = K.box(.08, .09, .16, paint, s * (W / 2 + .07), B.belt + .1, -(B.cowlX - .12), body); K.box(.01, .07, .12, mats.glass, s * (W / 2 + .11), B.belt + .1, -(B.cowlX - .12), body, false); }
    // lights, grille, plates, bumpers
    for (const s of [-1, 1]) { const hl = K.box(.36, .1, .12, mats.light, s * (W / 2 - .3), .68, -Lh + .05, body, false); hl.rotation.x = .25; K.box(.38, .07, .05, mats.brake, s * (W / 2 - .28), B.tailY - .14, Lh + .02, body, false); }
    K.box(W * .42, .16, .04, mats.grille, 0, .52, -Lh - .02, body, false); K.box(W * .42, .015, .045, mats.chrome, 0, .6, -Lh - .025, body, false); K.box(W * .6, .1, .04, mats.grille, 0, .33, -Lh - .02, body, false);
    const plate = plateTex(T, K); for (const [z, y] of [[-Lh - .035, .42], [Lh + .045, .5]]) K.mesh(new T.PlaneGeometry(.5, .12), plate, 0, y, z, body, false).rotation.y = z > 0 ? 0 : Math.PI;
    K.box(W - .2, .16, B.L - 1.1, mats.under, 0, .3, 0, body, false); // underbody so you can't see through
    for (const z of [rx, fx]) K.box(W - .26, aR * 1.6, aR * 2, mats.under, 0, r0 + .05, -z, body, false); // wheel-arch liners
    // vinyls on both doors (+ bonnet & roof stripes)
    if (c.vinyl && c.vinyl !== 'none') { const tex = vinylTex(K, c.vinyl, c.paint, opts.number || 7), vm = new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
      for (const s of [-1, 1]) { const pl = K.mesh(new T.PlaneGeometry(B.wb * .82, .3), vm, s * (W / 2 + .004), .56, 0, body, false); pl.rotation.y = s * Math.PI / 2; }
      if (c.vinyl === 'stripes') { const sm = K.mat(['#1b1b1b', '#2e86de', '#8e44ad', '#c0392b'].includes(c.paint) ? 0xffffff : 0x111111); K.box(.34, .006, Lh - B.cowlX + .2, sm, 0, B.hoodF + .1, -(Lh + B.cowlX) / 2, body, false); K.box(.34, .006, B.roofF - B.roofR, sm, 0, B.roofY + .055, -(B.roofF + B.roofR) / 2, body, false); } }
    // body kits
    if (tier('body') >= 1) { K.box(W * .98, .05, .26, mats.kit, 0, .24, -Lh - .06, body); for (const s of [-1, 1]) K.box(.07, .1, B.wb - aR * 2 - .1, mats.kit, s * (W / 2 + .01), .27, 0, body); K.box(W * .9, .08, .1, mats.kit, 0, .3, Lh + .05, body); for (let k = -2; k <= 2; k++) K.box(.02, .1, .2, mats.kit, k * .18, .3, Lh + .02, body); }
    if (tier('body') === 2) for (const s of [-1, 1]) for (const z of [rx, fx]) { const fl = K.mesh(new T.TorusGeometry(aR + .02, .05, 6, 12, Math.PI), paint, s * (W / 2 - .02), r0 + .02, -z, body); fl.rotation.y = Math.PI / 2; }
    // spoilers
    const spX = B.hatch ? B.roofR + .02 : -Lh + .2, spY = B.hatch ? B.roofY : B.tailY;
    if (tier('spoiler') === 1) { const lp = K.box(B.hatch ? B.cabW - .1 : W * .82, .04, .2, B.hatch ? paint : mats.kit, 0, spY + .03, -spX + .06, body); lp.rotation.x = -.15; }
    if (tier('spoiler') === 2) { for (const s of [-.4, .4]) K.box(.04, .34, .1, mats.kit, s * W, spY + .17, -spX + .12, body); const w = K.box(W * .98, .035, .34, mats.kit, 0, spY + .36, -spX + .16, body); w.rotation.x = -.14; for (const s of [-1, 1]) K.box(.02, .16, .4, paint, s * W * .49, spY + .37, -spX + .16, body); }
    // turbo: hood scoop + intercooler; stage 3: power bulge
    if (tier('turbo') || V.stockTurbo) { const sc = K.box(.5, .08, .55, paint, 0, B.hoodF + .1, -(Lh - .75), body); sc.rotation.x = .07; K.box(.42, .05, .02, mats.grille, 0, B.hoodF + .12, -(Lh - .5), body, false); K.box(W * .5, .18, .03, K.mat(0x9aa3ab, { metalness: .7, roughness: .3 }), 0, .44, -Lh - .03, body, false); }
    if (tier('engine') === 3) { const bl = K.box(.75, .06, 1.0, paint, 0, B.hoodF + .07, -(Lh - .9), body); bl.rotation.x = .06; }
    if (tier('nitrous')) for (const s of [-1, 1]) { const tex = K.canvasTex(128, 64); tex.x.fillStyle = '#5a2dff'; tex.x.fillRect(0, 10, 128, 44); tex.x.fillStyle = '#fff'; tex.x.font = 'italic 900 36px system-ui'; tex.x.textAlign = 'center'; tex.x.fillText('NOS', 64, 46); tex.t.needsUpdate = true;
      const pl = K.mesh(new T.PlaneGeometry(.26, .13), new T.MeshBasicMaterial({ map: tex.t, transparent: true, polygonOffset: true, polygonOffsetFactor: -3 }), s * (W / 2 + .005), .74, B.wb / 2 - .35, body, false); pl.rotation.y = s * Math.PI / 2; }
    // neon underglow
    if (c.neon) { const nm = new T.MeshBasicMaterial({ color: c.neon, transparent: true, opacity: .55, depthWrite: false }); const ng = K.mesh(new T.PlaneGeometry(W + .5, B.L + .2), nm, 0, .02, 0, root, false); ng.rotation.x = -Math.PI / 2; ng.renderOrder = 1; root.userData.neon = ng; }
    // exhaust tips
    const ex = tier('exhaust'), er = [.035, .05, .065][ex], xs = ex === 2 ? [-.3, .3] : ex === 1 ? [W / 2 - .45, W / 2 - .6] : [W / 2 - .45];
    for (const x of xs) { const tip = K.mesh(new T.CylinderGeometry(er, er * .9, .2, 12), mats.chrome, x, .28, Lh + .04, body); tip.rotation.x = Math.PI / 2; K.mesh(new T.CircleGeometry ? new T.CircleGeometry(er * .8, 10) : new T.PlaneGeometry(er, er), mats.under, x, .28, Lh + .141, body, false); exhausts.push(new T.Vector3(x, .28, Lh + .15)); }
    // wheels (wider + bigger on the driven axle with drag radials / slicks)
    const t = tier('tyres'), style = PARTS.rims.tiers[tier('rims')].style;
    for (const front of [true, false]) { const driven = V.drive === 'A' || (V.drive === 'F') === front, w = .22 + (driven ? [0, .02, .07, .1][t] : 0), r = V.r * (driven && t >= 2 ? 1.03 : 1);
      for (const s of [-1, 1]) { const wh = wheel(T, K, r, w, style, mats, front); wh.g.position.set(s * (W / 2 - w / 2 + .01 + wide * .4), r, front ? -fx : -rx); wh.g.rotation.y = s < 0 ? Math.PI : 0; root.add(wh.g); wh.driven = driven; wh.side = s; wheels.push(wh); } }
    body.position.y = H + .02;
    root.userData.dims = { L: B.L, W, H: B.roofY + .1 };
  } else {
    // ------------------------------------------------ motorbikes (kapcai underbone / sport) with rider
    const sport = V.body === 'sport', wb = (V.wb + (PARTS.swing.tiers[tier('swing')].wb || 0)), r = V.r, t = tier('tyres'), style = PARTS.rims.tiers[tier('rims')].style;
    const fw = wheel(T, K, r, .09, style, mats, true), rw = wheel(T, K, r * (t >= 2 ? 1.03 : 1), .11 + [0, .01, .04, .06][t], style, mats, false);
    // the bike pivots about the rear contact patch (wheelies): root → pivot at the rear axle
    const rz = wb - V.wb / 2, piv = new T.Group(); piv.position.set(0, 0, rz); root.add(piv); body.position.set(0, 0, -rz); piv.add(body); // pivot = rear contact patch
    fw.g.position.set(0, r, -V.wb / 2); rw.g.position.set(0, rw.r, -V.wb / 2 + wb); body.add(fw.g); body.add(rw.g); fw.driven = false; rw.driven = true; wheels.push(fw, rw);
    const frameM = K.mat(0x2b2b2b, { metalness: .5, roughness: .4 });
    // fork + handlebars
    const fork = K.box(.05, .7, .05, mats.chrome, 0, r + .35, -V.wb / 2 + .1, body); fork.rotation.x = -.42; K.box(.62, .04, .04, frameM, 0, r + .7, -V.wb / 2 + .28, body);
    if (sport) { // fairing, tank, tail
      const fs = new T.Shape(); [[-.55, .55], [-.05, .5], [.3, .72], [.5, 1.05], [.38, 1.12], [.05, .95], [-.25, .9], [-.6, .82]].forEach(([x, y], i) => i ? fs.lineTo(x, y) : fs.moveTo(x, y));
      const g = new T.ExtrudeGeometry(fs, { depth: .36, bevelEnabled: false }); g.translate(0, 0, -.18); g.rotateY(Math.PI / 2); K.mesh(g, paint, 0, 0, -.08, body);
      K.box(.3, .2, .5, paint, 0, .98, .1, body); K.box(.26, .1, .5, K.mat(0x111111), 0, .95, .48, body); const tail = K.box(.22, .16, .45, paint, 0, 1.0, .82, body); tail.rotation.x = -.25;
      K.box(.3, .14, .03, mats.glass, 0, 1.13, -.62, body).rotation.x = -.6;
    } else { // kapcai: legshield, step-through backbone, seat over the tank, front basket
      K.box(.42, .55, .06, paint, 0, .62, -.42, body).rotation.x = .25; const bb = K.box(.12, .1, .75, frameM, 0, .55, -.05, body); bb.rotation.x = .35;
      K.box(.34, .3, .62, paint, 0, .72, .38, body); K.box(.3, .1, .64, K.mat(0x111111), 0, .92, .38, body); K.box(.2, .12, .25, paint, 0, .98, -.62, body);
    }
    K.box(.12, .1, .06, mats.light, 0, sport ? .95 : .98, sport ? -.63 : -.75, body, false); K.box(.14, .05, .04, mats.brake, 0, sport ? 1.02 : .9, sport ? 1.05 : .72, body, false);
    // engine + swingarm
    K.box(.3, .3, .4, K.mat(0x555b62, { metalness: .6 }), 0, .45, 0, body); const sa = K.box(.06, .06, wb - V.wb * .45, frameM, .12, r + .02, -V.wb / 2 + wb - (wb - V.wb * .45) / 2, body);
    if (tier('swing') === 2) { K.box(.04, .04, .7, frameM, 0, .22, -V.wb / 2 + wb + .4, body); for (const s of [-.12, .12]) K.mesh(new T.CylinderGeometry(.05, .05, .04, 10), mats.black, s, .06, -V.wb / 2 + wb + .74, body).rotation.z = Math.PI / 2; }
    // exhaust
    const ex = tier('exhaust'); const pipe = K.mesh(new T.CylinderGeometry([.04, .055, .07][ex], [.035, .045, .05][ex], [.5, .55, .62][ex], 10), ex ? mats.chrome : mats.dark, .17, .42, .45, body); pipe.rotation.x = Math.PI / 2 - .25; exhausts.push(new T.Vector3(.17, .48, .78 - V.wb / 2 + V.wb / 2));
    if (tier('nitrous')) { const b = K.mesh(new T.CylinderGeometry(.06, .06, .38, 10), K.mat(0x5a2dff, { metalness: .5 }), -.2, .58, .25, body); b.rotation.x = Math.PI / 2; }
    // vinyl on the tank / fairing sides
    if (c.vinyl && c.vinyl !== 'none') { const tex = vinylTex(K, c.vinyl, c.paint, opts.number || 7), vm = new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
      for (const s of [-1, 1]) { const pl = K.mesh(new T.PlaneGeometry(.75, .22), vm, s * (sport ? .19 : .18), sport ? .78 : .72, sport ? -.15 : .36, body, false); pl.rotation.y = s * Math.PI / 2; } }
    // rider (team colours follow the paint)
    const suit = K.mat(c.paint), skin = K.mat(0xc68a5a), helm = K.mat(0xf2f2f2, { metalness: .3, roughness: .3 }), rider = new T.Group(); body.add(rider); rider.position.set(0, 0, 0);
    const lean = sport ? .9 : .35; const torso = K.box(.34, .55, .22, suit, 0, 1.2 + (sport ? -.05 : .05), sport ? .1 : .3, rider); torso.rotation.x = -lean;
    K.ball(.15, helm, 0, sport ? 1.42 : 1.55, sport ? -.18 : .12, rider); K.box(.2, .06, .1, mats.glass, 0, sport ? 1.43 : 1.56, sport ? -.32 : -.02, rider, false);
    for (const s of [-1, 1]) { const arm = K.box(.08, .08, .5, suit, s * .22, sport ? 1.15 : 1.22, sport ? -.25 : -.05, rider); arm.rotation.x = sport ? -.4 : -.15; const leg = K.box(.11, .11, .5, K.mat(0x23262b), s * .17, .82, .45, rider); leg.rotation.x = .9; K.box(.08, .08, .08, skin, s * .26, 1.07, sport ? -.48 : -.3, rider); }
    root.userData.piv = piv; root.userData.dims = { L: wb + .6, W: .7, H: 1.6 };
  }
  root.userData.wheels = wheels;
  // ---- per-frame animation from the physics state
  let squat = 0, bounce = 0, bv = 0;
  function update(dt, s) {
    for (const w of wheels) w.spin.rotation.x -= (w.side < 0 ? -1 : 1) * ((s.v || 0) / w.r + (w.driven ? (s.spin || 0) : 0)) * dt;
    if (!V.bike) { // squat under acceleration, dive under braking, small suspension bounce
      const target = clamp((s.a || 0) * .012, -.05, .07); bv += ((target - squat) * 60 - bv * 9) * dt; squat += bv * dt; bounce = Math.sin((s.t || 0) * 18) * Math.min(.008, (s.v || 0) * .0004);
      body.rotation.x = squat; body.position.y = H + .04 + bounce - Math.abs(squat) * .2;
    } else { root.userData.piv.rotation.x = s.pitch || 0; body.rotation.z = Math.sin((s.t || 0) * 3) * .01; }
  }
  return { root, body, wheels, exhausts, update, paint };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
