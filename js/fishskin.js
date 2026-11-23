// Realistic-looking skins for the 30 TYRANZ fish models.
// The models are a simple body ellipsoid + flat fins with flat vertex colours; here we
// give the body smooth normals, a slightly slimmer tail, side-projected UVs and a painted
// texture per species (countershading, scales, lateral line, gill cover and the markings
// that identify each fish), made semi-translucent fins and glossy eyes.
// Colours/markings follow FishBase / FAO species sheets for Malaysian fish.
let T = null;
export function initSkins(three) { T = three; }

// back / mid / belly colours, scale size (0 = smooth skin), sheen (metalness), fin colour, markings
const SP = {
  Kembung: { back: '#2f6a78', mid: '#a9c3c2', belly: '#eef1ee', scale: 2, sheen: .45, fin: '#7d8f7a', gold: .25,
    marks: [['hstripe', .74, .018, '#304a50', .5], ['hstripe', .82, .018, '#304a50', .5], ['hstripe', .9, .016, '#304a50', .45], ['blotch', .7, .36, .028, '#111']] },
  Selar_Kuning: { back: '#2a7090', mid: '#a8cbd6', belly: '#f4f6f6', scale: 2, sheen: .5, fin: '#e2c35a',
    marks: [['hstripe', .62, .07, '#f2c230', .9, .1, .9], ['blotch', .8, .74, .03, '#151515']] },
  Cencaru: { back: '#3b6c76', mid: '#b4c9c4', belly: '#e9eeea', scale: 2, sheen: .45, fin: '#c9b55a',
    marks: [['hstripe', .47, .03, '#4a4f45', .55, .02, .62], ['blotch', .82, .7, .032, '#161616']] },
  Selayang: { back: '#3c5f88', mid: '#a9bfd2', belly: '#eff2f5', scale: 2, sheen: .5, fin: '#b9c4cc', marks: [['blotch', .82, .72, .022, '#1b1b1b']] },
  Tamban: { back: '#2b5d74', mid: '#9fc0c9', belly: '#f3f5f5', scale: 3, sheen: .55, fin: '#c9d2d4', marks: [['hstripe', .56, .02, '#d9b75a', .45]] },
  Bilis: { back: '#a8b6b2', mid: '#d8e0de', belly: '#f6f8f7', scale: 0, sheen: .4, fin: '#e6ecea', translucent: true, marks: [['hstripe', .5, .09, '#f4f8fa', .95], ['hstripe', .5, .03, '#c2ccd0', .6]] },
  Gerepoh: { back: '#4b5661', mid: '#a7b0b6', belly: '#e6e9eb', scale: 2, sheen: .45, fin: '#2a3036' },
  Layaran: { back: '#17305a', mid: '#4f78a8', belly: '#eef2f6', scale: 0, sheen: .5, fin: '#1f56b0', marks: [['vbars', 16, '#a9d1f2', .35, .9, .05, .01, .55, .2, .85]] },
  Tenggiri: { back: '#2a4c70', mid: '#a6bacb', belly: '#eef1f3', scale: 0, sheen: .55, fin: '#5b6f84', marks: [['vbars', 42, '#3d5774', .35, .97, .04, .007, .55, .12, .9]] },
  Tongkol: { back: '#1c2c55', mid: '#7f8ea8', belly: '#eef1f4', scale: 0, sheen: .55, fin: '#2b3a5c',
    marks: [['wavy', 12, '#16224a', .68, .99, .1, .55], ['spots', 5, '#151515', .012, .02, .2, .36, null, .62, .76]] },
  Tuna_Sirip_Kuning: { back: '#122248', mid: '#5f7395', belly: '#e9edf2', scale: 0, sheen: .6, fin: '#f0c21c', marks: [['hstripe', .56, .05, '#e7c03a', .65, .08, .92]] },
  'Alu-Alu': { back: '#4d6164', mid: '#a9b6b4', belly: '#ecefee', scale: 2, sheen: .45, fin: '#c8b25a', marks: [['chevron', 16, '#3b4b4e', .45, .92, .35]] },
  Kerapu: { back: '#76674a', mid: '#a09272', belly: '#e6dcc6', scale: 3, sheen: .1, fin: '#7a6a4c',
    marks: [['vbars', 5, '#4d4231', .3, .98, .06, .05, .25, .15, .8], ['spots', 260, '#c0622a', .006, .012, .08, 1, null, .05, .97]] },
  Kerapu_Bara: { back: '#a8331f', mid: '#c9472f', belly: '#e88a6c', scale: 2, sheen: .12, fin: '#c03a28',
    marks: [['spots', 230, '#55c8f5', .006, .011, .28, 1, '#0d3550', .05, .97]] },
  Jenahak: { back: '#93623a', mid: '#c99a63', belly: '#ecd2a8', scale: 4, sheen: .2, fin: '#c69a5c', scaleDots: '#6b4426', marks: [['blotch', .45, .62, .05, '#2a2420']] },
  Merah: { back: '#a92f25', mid: '#d0574a', belly: '#f2b2a4', scale: 4, sheen: .25, fin: '#c23a30' },
  Tilapia: { back: '#59604a', mid: '#9aa487', belly: '#d9ddc9', scale: 4, sheen: .3, fin: '#a8554a', marks: [['hstripe', .62, .03, '#6c6f55', .5]] },
  Keli: { back: '#2e3330', mid: '#4f5650', belly: '#a9aea4', scale: 0, sheen: .2, fin: '#2b302d' },
  Haruan: { back: '#34382a', mid: '#5b5f44', belly: '#b8b99a', scale: 3, sheen: .15, fin: '#3d4130', marks: [['hstripe', .5, .05, '#22251b', .55]] },
  Sebarau: { back: '#59655a', mid: '#b4bbaa', belly: '#eef0e6', scale: 3, sheen: .45, fin: '#c8573a', marks: [['blotch', .82, .62, .03, '#1b1b1b']] },
  Siakap: { back: '#56666a', mid: '#a9b4b4', belly: '#e9eceb', scale: 6, sheen: .35, fin: '#6d7470' },
  Kerisi: { back: '#d6879c', mid: '#e9b7c3', belly: '#f5ecef', scale: 3, sheen: .3, fin: '#e6a9b8',
    marks: [['hstripe', .48, .03, '#f1c84b', .85], ['hstripe', .32, .025, '#f1c84b', .8], ['hstripe', .7, .02, '#f1c84b', .55]] },
  Bawal_Putih: { back: '#aeb8c0', mid: '#d9dfe3', belly: '#f6f7f8', scale: 1, sheen: .6, fin: '#d2d8dc', speckle: '#8d98a2' },
  Bawal_Hitam: { back: '#25292f', mid: '#454b53', belly: '#8a9099', scale: 2, sheen: .3, fin: '#2b2f35' },
  Bawal_Emas: { back: '#c9a22c', mid: '#e8cf62', belly: '#f8ec9e', scale: 2, sheen: .45, fin: '#f0c72a',
    marks: [['vbars', 9, '#1f1d17', .05, 1, .015, .028, .75, .08, .92, true]] },
  Pari: { back: '#7d6f58', mid: '#8f8066', belly: '#eee6d8', scale: 0, sheen: .1, fin: '#7d6f58', top: true, marks: [['mottle', '#5a4e3d', 60, .35], ['spots', 70, '#a89878', .01, .025, 0, 1, null, 0, 1]] },
  Senangin: { back: '#8a989a', mid: '#c8d0d0', belly: '#f2f4f3', scale: 4, sheen: .45, fin: '#d9c27a' },
  Kurau: { back: '#a59a72', mid: '#d3cba7', belly: '#f3eedb', scale: 4, sheen: .4, fin: '#e2c766' },
  Gelama: { back: '#8b8665', mid: '#c3bd98', belly: '#efe8d4', scale: 3, sheen: .35, fin: '#c9b46e', marks: [['oblique', 14, '#6e6a4e', .5, .95, .25]] },
  'Gerut-Gerut': { back: '#7a868b', mid: '#b7c0c2', belly: '#ecefef', scale: 4, sheen: .3, fin: '#8a9296', marks: [['spots', 120, '#363d42', .006, .011, .35, .98, null, .1, .9]] },
  Talang: { back: '#3b6b84', mid: '#a9c4cf', belly: '#f1f4f5', scale: 0, sheen: .55, fin: '#c9b55a', marks: [['row', 7, '#26343b', .66, .2, .78, .03]] },
  Belanak: { back: '#536569', mid: '#a7b4b3', belly: '#e8ecec', scale: 6, sheen: .35, fin: '#7b8784', marks: [['hstripe', .66, .02, '#465558', .4], ['hstripe', .76, .02, '#465558', .4], ['hstripe', .86, .02, '#465558', .4]] },
  Sebelah: { back: '#77684e', mid: '#8b7b5e', belly: '#a69677', scale: 1, sheen: .08, fin: '#76674d', flat: true, marks: [['mottle', '#5a4c36', 70, .4], ['spots', 90, '#c2b391', .008, .018, 0, 1, null, 0, 1]] },
  Jebong: { back: '#6b6758', mid: '#8a8573', belly: '#c9c4b0', scale: 1, sheen: .1, fin: '#6b6758', marks: [['spots', 160, '#e9e6da', .005, .01, .15, 1, null, .05, .95], ['saddle', 3, '#d9d3bf', .3]] },
  Dengkis: { back: '#78764f', mid: '#a09d73', belly: '#d9d6b6', scale: 1, sheen: .12, fin: '#8a8660', marks: [['spots', 200, '#f1efdf', .005, .01, .1, .98, null, .05, .95]] },
  Biji_Nangka: { back: '#d4968a', mid: '#e8c0b4', belly: '#f6ede8', scale: 3, sheen: .3, fin: '#e7b2a2', marks: [['hstripe', .5, .04, '#f0c040', .85]] },
};

const hexRGB = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; };
function rnd(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const W = 512, H = 256;
// canvas: x = tail (0) → head (W), y = top/back (0) → belly (H)
function paint(id) {
  const s = SP[id] || SP.Kembung, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  const r = rnd([...id].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7));
  const X = (u) => u * W, Y = (v) => (1 - v) * H; // u along the fish (0 tail, 1 head), v height (0 belly, 1 back)
  // countershading
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, s.back); g.addColorStop(.3, s.back); g.addColorStop(.52, s.mid); g.addColorStop(.72, s.belly); g.addColorStop(1, s.belly);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  if (s.gold) { const gg = x.createLinearGradient(0, H * .35, 0, H * .65); gg.addColorStop(0, 'rgba(201,170,80,0)'); gg.addColorStop(.5, `rgba(201,170,80,${s.gold})`); gg.addColorStop(1, 'rgba(201,170,80,0)'); x.fillStyle = gg; x.fillRect(0, 0, W, H); }
  // soft iridescent sheen band
  { const sg = x.createLinearGradient(0, H * .3, 0, H * .7); sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(.5, `rgba(220,240,255,${.12 + s.sheen * .2})`); sg.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = sg; x.fillRect(0, 0, W, H); }
  // fine noise so nothing looks flat
  for (let k = 0; k < 2200; k++) { x.fillStyle = r() < .5 ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.05)'; x.fillRect(r() * W, r() * H, 1 + r() * 2, 1 + r() * 2); }
  // markings
  for (const m of s.marks || []) {
    const [type] = m;
    if (type === 'hstripe') { const [, v, w, col, a, u0 = .05, u1 = .95] = m; x.globalAlpha = a; x.fillStyle = col; x.beginPath();
      for (let u = u0; u <= u1 + 1e-6; u += .02) { const vv = v + Math.sin(u * 3) * .01; u === u0 ? x.moveTo(X(u), Y(vv + w / 2)) : x.lineTo(X(u), Y(vv + w / 2)); }
      for (let u = u1; u >= u0 - 1e-6; u -= .02) x.lineTo(X(u), Y(v + Math.sin(u * 3) * .01 - w / 2)); x.closePath(); x.filter = 'blur(1px)'; x.fill(); x.filter = 'none'; }
    else if (type === 'blotch') { const [, u, v, rr, col] = m; const gr = x.createRadialGradient(X(u), Y(v), 0, X(u), Y(v), rr * W); gr.addColorStop(0, col); gr.addColorStop(.7, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.globalAlpha = .9; x.fillStyle = gr; x.beginPath(); x.ellipse(X(u), Y(v), rr * W, rr * W * .8, 0, 0, 7); x.fill(); }
    else if (type === 'vbars') { const [, n, col, v0, v1, amp, w, a, u0 = .1, u1 = .9, alt] = m; x.globalAlpha = a; x.strokeStyle = col; x.lineCap = 'round';
      for (let k = 0; k < n; k++) { const u = u0 + (u1 - u0) * (k + .5) / n; x.lineWidth = (alt && k % 2 ? w * .45 : w) * W; x.beginPath();
        for (let v = v0; v <= v1 + 1e-6; v += .04) { const uu = u + Math.sin(v * 14 + k) * amp; v === v0 ? x.moveTo(X(uu), Y(v)) : x.lineTo(X(uu), Y(v)); } x.stroke(); } }
    else if (type === 'wavy') { const [, n, col, v0, v1, u0, u1] = m; x.globalAlpha = .75; x.strokeStyle = col; x.lineWidth = 3;
      for (let k = 0; k < n; k++) { const u = u0 + (u1 - u0) * k / n; x.beginPath(); for (let t = 0; t <= 1.0001; t += .05) { const uu = u + t * .12, vv = v0 + (v1 - v0) * t; const ww = Math.sin(t * 18 + k) * .008; t === 0 ? x.moveTo(X(uu + ww), Y(vv)) : x.lineTo(X(uu + ww), Y(vv)); } x.stroke(); } }
    else if (type === 'chevron') { const [, n, col, v0, v1, a] = m; x.globalAlpha = a; x.strokeStyle = col; x.lineWidth = 6;
      for (let k = 0; k < n; k++) { const u = .1 + .8 * k / n; x.beginPath(); x.moveTo(X(u + .03), Y(v1)); x.lineTo(X(u), Y((v0 + v1) / 2)); x.lineTo(X(u + .03), Y(v0)); x.stroke(); } }
    else if (type === 'oblique') { const [, n, col, v0, v1, a] = m; x.globalAlpha = a; x.strokeStyle = col; x.lineWidth = 2;
      for (let k = 0; k < n; k++) { const u = .05 + .9 * k / n; x.beginPath(); x.moveTo(X(u), Y(v0)); x.lineTo(X(u + .06), Y(v1)); x.stroke(); } }
    else if (type === 'spots') { const [, n, col, r0, r1, v0, v1, ring, u0 = .05, u1 = .95] = m;
      for (let k = 0; k < n; k++) { const u = u0 + r() * (u1 - u0), v = v0 + r() * (v1 - v0), rr = (r0 + r() * (r1 - r0)) * W;
        if (ring) { x.globalAlpha = .6; x.fillStyle = ring; x.beginPath(); x.arc(X(u), Y(v), rr * 1.45, 0, 7); x.fill(); }
        x.globalAlpha = .9; x.fillStyle = col; x.beginPath(); x.arc(X(u), Y(v), rr, 0, 7); x.fill(); } }
    else if (type === 'mottle') { const [, col, n, a] = m; x.globalAlpha = a; x.fillStyle = col; x.filter = 'blur(6px)';
      for (let k = 0; k < n; k++) { x.beginPath(); x.ellipse(r() * W, r() * H, 8 + r() * 26, 6 + r() * 18, r() * 3, 0, 7); x.fill(); } x.filter = 'none'; }
    else if (type === 'row') { const [, n, col, v, u0, u1, rr] = m; x.globalAlpha = .8; x.fillStyle = col;
      for (let k = 0; k < n; k++) { const u = u0 + (u1 - u0) * k / (n - 1); x.beginPath(); x.ellipse(X(u), Y(v + (k % 2 ? -.06 : .04)), rr * W * 1.3, rr * W, 0, 0, 7); x.fill(); } }
    else if (type === 'saddle') { const [, n, col, a] = m; x.globalAlpha = a; x.fillStyle = col; x.filter = 'blur(4px)';
      for (let k = 0; k < n; k++) { const u = .25 + .5 * k / (n - 1); x.beginPath(); x.ellipse(X(u), Y(.93), 22, 30, 0, 0, 7); x.fill(); } x.filter = 'none'; }
  }
  x.globalAlpha = 1;
  // scales: overlapping arcs, dark rim + light crown
  if (s.scale > 0) {
    const sz = 4 + s.scale * 3;
    for (let row = 0, yy = 0; yy < H + sz; row++, yy += sz * .62) for (let xx = (row % 2) * sz / 2 - sz; xx < W + sz; xx += sz) {
      x.globalAlpha = .13; x.strokeStyle = '#000'; x.lineWidth = 1; x.beginPath(); x.arc(xx, yy, sz * .55, .15 * Math.PI, .85 * Math.PI); x.stroke();
      x.globalAlpha = .07; x.strokeStyle = '#fff'; x.beginPath(); x.arc(xx, yy - 1.5, sz * .45, 1.15 * Math.PI, 1.85 * Math.PI); x.stroke();
      if (s.scaleDots) { x.globalAlpha = .35; x.fillStyle = s.scaleDots; x.fillRect(xx - 1, yy - 1, 2, 2); }
    }
    x.globalAlpha = 1;
  }
  if (s.speckle) { x.fillStyle = s.speckle; for (let k = 0; k < 500; k++) { x.globalAlpha = .25; x.fillRect(r() * W, r() * H * .6, 1.5, 1.5); } x.globalAlpha = 1; }
  if (!s.top) {
    // lateral line
    x.globalAlpha = .35; x.strokeStyle = '#1d2a2e'; x.lineWidth = 1.5; x.beginPath(); for (let u = .04; u <= .82; u += .02) { const v = .64 + Math.sin(u * Math.PI) * .06; u <= .041 ? x.moveTo(X(u), Y(v)) : x.lineTo(X(u), Y(v)); } x.stroke();
    // gill cover (operculum) and darker snout
    x.globalAlpha = .28; x.strokeStyle = '#1b1b1b'; x.lineWidth = 3; x.beginPath(); x.ellipse(X(.98), Y(.52), W * .2, H * .36, 0, Math.PI * .72, Math.PI * 1.28); x.stroke();
    const hg = x.createLinearGradient(X(.85), 0, X(1), 0); hg.addColorStop(0, 'rgba(0,0,0,0)'); hg.addColorStop(1, 'rgba(0,0,0,.18)'); x.globalAlpha = 1; x.fillStyle = hg; x.fillRect(X(.85), 0, W * .15, H);
  }
  x.globalAlpha = 1;
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t;
}

const cache = new Map();
function materialsFor(id) {
  if (cache.has(id)) return cache.get(id);
  const s = SP[id] || SP.Kembung;
  const body = new T.MeshStandardMaterial({ map: paint(id), roughness: .38 - s.sheen * .15, metalness: s.sheen * .5, transparent: !!s.translucent, opacity: s.translucent ? .9 : 1 });
  const fin = new T.MeshStandardMaterial({ color: s.fin, emissive: s.fin, emissiveIntensity: .25, roughness: .55, metalness: .05, transparent: true, opacity: .8, side: T.DoubleSide, depthWrite: false });
  const eye = new T.MeshStandardMaterial({ color: 0x0b0d10, roughness: .08, metalness: .3 });
  const m = { body, fin, eye, spec: s }; cache.set(id, m); return m;
}
function prepBody(geo, top) {
  if (geo.userData.skinned) return; geo.userData.skinned = true;
  geo.computeBoundingBox(); const b = geo.boundingBox, pos = geo.attributes.position, n = pos.count, uv = new Float32Array(n * 2);
  const L = b.max.x - b.min.x, Hh = b.max.y - b.min.y, D = b.max.z - b.min.z;
  for (let i = 0; i < n; i++) {
    let px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i); const t = (px - b.min.x) / L;
    if (!top) { const k = t < .4 ? .62 + .38 * Math.sin(t / .4 * Math.PI / 2) : 1; py *= k; pz *= k; pos.setXYZ(i, px, py, pz); } // slimmer tail stalk
    uv[i * 2] = t; uv[i * 2 + 1] = top ? (pz - b.min.z) / D : (py - b.min.y * (top ? 1 : 1)) / Hh;
  }
  geo.setAttribute('uv', new T.BufferAttribute(uv, 2)); pos.needsUpdate = true;
  if (geo.attributes.color) geo.deleteAttribute('color');
  geo.computeVertexNormals();
}
// apply the skin to a fish model instance (any clone of a TYRANZ fish)
export function skinFish(root, id) {
  if (!T || !root) return root;
  const m = materialsFor(id), meshes = [];
  root.traverse((o) => { if (o.isMesh) meshes.push(o); });
  if (!meshes.length) return root;
  const size = (o) => { o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox; return (b.max.x - b.min.x) * (b.max.y - b.min.y + .01) * (b.max.z - b.min.z + .01); };
  let body = meshes[0], best = -1; for (const o of meshes) { const v = size(o); if (v > best) { best = v; body = o; } }
  for (const o of meshes) {
    const n = o.geometry.attributes.position.count;
    if (o === body) { prepBody(o.geometry, m.spec.top); o.material = m.body; continue; }
    const col = o.geometry.attributes.color, c0 = col ? col.getX(0) + col.getY(0) + col.getZ(0) : 1;
    const dark = !!col && c0 / 3 < .2 && n > 100;
    if (dark) { if (!o.geometry.userData.n) { o.geometry.computeVertexNormals(); o.geometry.userData.n = 1; } o.material = m.eye; }
    else if (n === 42) o.visible = false;                  // painted-on markings replace the little marker blobs
    else { if (!o.geometry.userData.n) { o.geometry.computeVertexNormals(); o.geometry.userData.n = 1; } o.material = m.fin; } // fins had no normals → rendered black
  }
  return root;
}
export const hasSkin = (id) => !!SP[id];
