// HERO POSER — poses the player's own TYRANZ hero model (the same GLB the village uses) without a skeleton.
// The hero mesh is a single static mesh (height 1.0 in model units, facing +z, character's left = +x), so we
// "skin" it procedurally: every vertex is assigned to a body part (head, torso, upper/lower arm, thigh/shin) with
// soft weights near the joints, and each pose is a set of joint rotations applied on the CPU.
// Used by the 3D photo simulator (12+ poses) and the beach volleyball player (run, bump, set, spike, block, dive…).
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// joint angles (radians). Arms: f = raise forward, s = raise sideways, e = elbow bend, t = twist about the arm.
// Legs: h = hip forward, k = knee bend. Body: lean (forward), twist (yaw), side (roll); head: y (yaw), p (nod), r (tilt). y = drop in model units.
export const NEUTRAL = { L: { f: 0, s: .08, e: .1, t: 0 }, R: { f: 0, s: .08, e: .1, t: 0 }, LL: { h: 0, k: 0 }, RL: { h: 0, k: 0 }, lean: 0, twist: 0, side: 0, head: { y: 0, p: 0, r: 0 }, y: 0 };
const P = (o) => deepMerge(clone(NEUTRAL), o);
export const POSES = {
  casual: { bm: 'Santai', en: 'Casual', ic: '🧍', p: P({ L: { s: .12, e: .2 }, R: { s: .1, e: .3 }, RL: { h: .08 }, side: .04, head: { r: .06 } }) },
  peace: { bm: 'Peace', en: 'Peace sign', ic: '✌️', p: P({ R: { f: 1.9, s: .35, e: 2.0, t: -.3 }, L: { s: .15, e: .2 }, head: { r: -.12 }, side: -.04 }) },
  wave: { bm: 'Lambai', en: 'Waving', ic: '👋', p: P({ R: { f: .3, s: 2.5, e: .5 }, L: { s: .1 }, head: { r: .1, y: .1 } }) },
  strong: { bm: 'Kuat', en: 'Flexing', ic: '💪', p: P({ L: { s: 1.45, e: 1.9, t: 1.5 }, R: { s: 1.45, e: 1.9, t: 1.5 }, LL: { h: .1 }, RL: { h: -.05 } }) },
  heart: { bm: 'Hati', en: 'Heart hands', ic: '🫶', p: P({ L: { f: 2.3, s: -.25, e: 1.6 }, R: { f: 2.3, s: -.25, e: 1.6 }, head: { r: .1 } }) },
  thumbs: { bm: 'Bagus!', en: 'Thumbs up', ic: '👍', p: P({ R: { f: 1.2, s: .2, e: 1.5, t: .2 }, L: { s: .1, e: .15 }, head: { y: -.1 } }) },
  hips: { bm: 'Cekak pinggang', en: 'Hands on hips', ic: '🙆', p: P({ L: { s: .75, e: 1.9, t: -1.1, f: -.2 }, R: { s: .75, e: 1.9, t: -1.1, f: -.2 }, LL: { h: .05 }, RL: { h: -.05 }, head: { p: -.08 } }) },
  sit: { bm: 'Duduk', en: 'Sitting', ic: '🪑', p: P({ LL: { h: 1.45, k: 1.45 }, RL: { h: 1.5, k: 1.5 }, L: { f: .5, e: .6, s: .1 }, R: { f: .5, e: .6, s: .1 }, y: -.165, lean: -.05 }) },
  jump: { bm: 'Lompat', en: 'Jumping', ic: '🤸', p: P({ L: { s: 2.7, e: .2 }, R: { s: 2.7, e: .2 }, LL: { h: .5, k: 1.2 }, RL: { h: .2, k: 1.0 }, head: { p: -.15 }, y: .22 }) },
  shoulder: { bm: 'Toleh bahu', en: 'Over the shoulder', ic: '↩️', p: P({ twist: .55, head: { y: .9, r: .08 }, L: { s: .12, e: .3, f: -.1 }, R: { f: .4, s: -.1, e: 1.2 } }) },
  funny: { bm: 'Lucu', en: 'Funny pose', ic: '🤪', p: P({ L: { s: 2.2, e: 1.8, t: 1.2 }, R: { f: .5, s: 1.0, e: 1.5, t: -.8 }, LL: { h: .9, k: 1.6 }, side: .15, head: { r: .35, p: .1 } }) },
  salam: { bm: 'Salam', en: 'Malay greeting', ic: '🙏', p: P({ L: { f: 1.25, s: -.2, e: 1.35 }, R: { f: 1.25, s: -.2, e: 1.35 }, lean: .12, head: { p: .2 } }) },
  // volleyball / action states (not in the photo pose list)
  ready: { p: P({ L: { f: .7, s: -.15, e: .5 }, R: { f: .7, s: -.15, e: .5 }, LL: { h: .55, k: .9 }, RL: { h: .55, k: .9 }, lean: .3, y: -.06 }) },
  bump: { p: P({ L: { f: .95, s: -.32, e: 0 }, R: { f: .95, s: -.32, e: 0 }, LL: { h: .7, k: 1.1 }, RL: { h: .7, k: 1.1 }, lean: .35, y: -.09 }) },
  set: { p: P({ L: { f: 2.85, s: .25, e: 1.1 }, R: { f: 2.85, s: .25, e: 1.1 }, LL: { h: .25, k: .5 }, RL: { h: .25, k: .5 }, head: { p: -.35 } }) },
  spikeUp: { p: P({ R: { f: 2.6, s: .5, e: 1.9, t: .3 }, L: { f: 2.4, s: .2, e: .4 }, LL: { h: .6, k: 1.3 }, RL: { h: .3, k: 1.1 }, lean: -.25, twist: -.35, head: { p: -.3 } }) },
  spikeHit: { p: P({ R: { f: 1.4, s: .3, e: .1 }, L: { f: .6, s: .2, e: .6 }, LL: { h: .5, k: 1.0 }, RL: { h: .5, k: .8 }, lean: .35, twist: .3 }) },
  block: { p: P({ L: { f: 3.05, s: .12, e: 0 }, R: { f: 3.05, s: .12, e: 0 }, LL: { h: .1, k: .3 }, RL: { h: .1, k: .3 } }) },
  dive: { p: P({ L: { f: 2.9, s: .2, e: .05 }, R: { f: 2.9, s: .2, e: .05 }, LL: { h: -.3, k: .3 }, RL: { h: -.35, k: .2 }, head: { p: -.5 } }) }, // the volleyball code tips the whole body forward
  win: { p: P({ L: { s: 2.8, e: .15 }, R: { s: 2.8, e: .15 }, head: { p: -.25 } }) },
  sad: { p: P({ L: { s: .05, f: .15 }, R: { s: .05, f: .15 }, lean: .3, head: { p: .5 } }) },
};
export const PHOTO_POSES = ['peace', 'wave', 'strong', 'heart', 'thumbs', 'casual', 'hips', 'sit', 'jump', 'shoulder', 'funny', 'salam'];
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function deepMerge(a, b) { for (const k in b) { if (b[k] && typeof b[k] === 'object') a[k] = deepMerge(a[k] || {}, b[k]); else a[k] = b[k]; } return a; }
export function lerpPose(a, b, k) { const o = {}; for (const key in a) { if (typeof a[key] === 'object') o[key] = lerpPose(a[key], b[key], k); else o[key] = a[key] + ((b[key] ?? a[key]) - a[key]) * k; } return o; }
// running / side-step cycles (phase in radians)
export function runPose(ph, amt = 1, side = 0) { const s = Math.sin(ph), c = Math.cos(ph); return P({ L: { f: -s * .7 * amt, s: .12, e: .9 }, R: { f: s * .7 * amt, s: .12, e: .9 }, LL: { h: s * .65 * amt + side * .2, k: Math.max(0, -c) * .9 * amt }, RL: { h: -s * .65 * amt - side * .2, k: Math.max(0, c) * .9 * amt }, lean: .15 * amt, side: side * .12, y: -Math.abs(s) * .02 * amt }); }

// Make a posable copy of the hero. Returns { g, setPose(p), pose, h } or null if the hero model is missing.
export function makePosableHero(T, K, M, putModel, h = 1.65) {
  const g = new T.Group(), body = new T.Group(); g.add(body);
  const m = putModel(M, 'hero', body, 0, 0, { h }); if (!m) return null;
  const meshes = []; m.traverse(o => { if (o.isMesh && o.geometry && o.geometry.attributes.position) { o.geometry = o.geometry.clone(); meshes.push(o); } });
  const parts = meshes.map(o => {
    const pa = o.geometry.attributes.position, n = pa.count, base = Float32Array.from(pa.array), info = new Float32Array(n * 6); // part, wUpper, wLower, wTorso, wHead, side
    for (let i = 0; i < n; i++) { const x = base[i * 3], y = base[i * 3 + 1], ax = Math.abs(x), sd = x >= 0 ? 1 : -1; let part = 0, w1 = 0, w2 = 0;
      if (y > .33 && y < .665 && ax > .128) { part = 1; w1 = ax > .158 || y < .575 ? 1 : smooth(.128, .158, ax) * smooth(.665, .575, y) + (1 - smooth(.665, .575, y)) * smooth(.128, .158, ax); w1 = clamp(w1, 0, 1); w2 = smooth(.515, .465, y); } // arm (upper → lower)
      else if (y < .345) { part = 2; w1 = smooth(.345, .3, y); w2 = smooth(.2, .15, y); } // leg (thigh → shin)
      const wT = smooth(.3, .37, y), wH = smooth(.7, .76, y);
      info.set([part, w1, w2, wT, wH, sd], i * 6); }
    return { o, pa, base, info, n };
  });
  const tmp = new T.Vector3(), out = new T.Vector3();
  const rot = (x, y, z, order = 'XYZ') => new T.Matrix4().makeRotationFromEuler(new T.Euler(x, y, z, order));
  const about = (R, px, py, pz) => new T.Matrix4().makeTranslation(px, py, pz).multiply(R).multiply(new T.Matrix4().makeTranslation(-px, -py, -pz));
  let normT = 0;
  function setPose(p, normals = true) {
    const A = {}, E = {}, H = {}, Kn = {};
    for (const sd of [1, -1]) { const a = sd > 0 ? p.L : p.R, l = sd > 0 ? p.LL : p.RL;
      A[sd] = about(new T.Matrix4().multiply(rot(0, 0, sd * a.s)).multiply(rot(-a.f, 0, 0)).multiply(rot(0, sd * (a.t || 0), 0)), sd * .165, .615, 0);
      E[sd] = about(rot(-a.e, 0, 0), sd * .19, .49, 0);
      H[sd] = about(rot(-l.h, 0, 0), sd * .07, .33, 0); Kn[sd] = about(rot(l.k, 0, 0), sd * .07, .17, 0); }
    const TOR = about(rot(p.lean, p.twist, -p.side, 'YXZ'), 0, .33, 0), HEAD = about(rot(p.head.p, p.head.y, -p.head.r, 'YXZ'), 0, .73, 0);
    for (const pt of parts) { const { pa, base, info, n } = pt, arr = pa.array;
      for (let i = 0; i < n; i++) { const j = i * 6, part = info[j], w1 = info[j + 1], w2 = info[j + 2], wT = info[j + 3], wH = info[j + 4], sd = info[j + 5];
        tmp.set(base[i * 3], base[i * 3 + 1], base[i * 3 + 2]);
        if (part === 1) { if (w2 > 0) { out.copy(tmp).applyMatrix4(E[sd]); tmp.lerp(out, w2); } if (w1 > 0) { out.copy(tmp).applyMatrix4(A[sd]); tmp.lerp(out, w1); } }
        else if (part === 2) { if (w2 > 0) { out.copy(tmp).applyMatrix4(Kn[sd]); tmp.lerp(out, w2); } if (w1 > 0) { out.copy(tmp).applyMatrix4(H[sd]); tmp.lerp(out, w1); } }
        if (wH > 0) { out.copy(tmp).applyMatrix4(HEAD); tmp.lerp(out, wH); }
        if (wT > 0 && part !== 2) { out.copy(tmp).applyMatrix4(TOR); tmp.lerp(out, wT); }
        arr[i * 3] = tmp.x; arr[i * 3 + 1] = tmp.y + (p.y || 0); arr[i * 3 + 2] = tmp.z; }
      pa.needsUpdate = true; if (normals) pt.o.geometry.computeVertexNormals(); if (pt.o.geometry.boundingSphere) pt.o.geometry.boundingSphere = null; }
    api.pose = p;
  }
  // smooth transitions between poses
  let from = clone(NEUTRAL), to = clone(NEUTRAL), k = 1, dur = .3;
  const api = { g, body, h, pose: clone(NEUTRAL), setPose,
    go(p, d = .3) { from = clone(api.pose); to = clone(typeof p === 'string' ? POSES[p].p : p); k = 0; dur = d; },
    update(dt) { if (k >= 1) return false; k = Math.min(1, k + dt / dur); const e = k * k * (3 - 2 * k); setPose(lerpPose(from, to, e), k >= 1 || (normT++ % 3 === 0)); return true; },
    live(p) { k = 1; setPose(p, (normT++ % 4) === 0); }, // per-frame procedural animation (running etc.)
  };
  setPose(clone(NEUTRAL));
  return api;
}
