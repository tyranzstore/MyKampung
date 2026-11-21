// Isometric town: tiles, buildings, people, camera, tap detection, day/night.
import { clamp, lerp, mulberry32 } from './core.js';

const HW = 32, HH = 16, N = 30;
const P = (i, j, z = 0) => ({ x: (i - j) * HW, y: (i + j) * HH - z });
const toTile = (x, y) => ({ i: (x / HW + y / HH) / 2, j: (y / HH - x / HW) / 2 });
const L = (a, b, t) => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = n >> 8 & 255, b = n & 255;
  const f = amt < 0 ? 0 : 255, p = Math.abs(amt);
  r = Math.round((f - r) * p + r); g = Math.round((f - g) * p + g); b = Math.round((f - b) * p + b);
  return `rgb(${r},${g},${b})`;
}

// ------------------------------------------------------------ world layout
const YARDS = {
  abah: { i0: 7, j0: 11, i1: 12, j1: 14 },
  ani: { i0: 9, j0: 23, i1: 13, j1: 26 },
  abu: { i0: 21, j0: 27, i1: 26, j1: 30 },
};
const PADI = { i0: 2, j0: 20, i1: 9, j1: 29 };
function baseTile(i, j) {
  if (j < 3) return 'water';
  if (i >= 9 && i < 11 && j < 5) return 'plank';
  if (j < 5) return 'sand';
  if (i >= 14 && i < 16) return 'road';
  if (i >= 3 && j >= 16 && j < 18) return 'road';
  if (i >= PADI.i0 && i < PADI.i1 && j >= PADI.j0 && j < PADI.j1) return 'padi';
  for (const [id, y] of Object.entries(YARDS)) if (i >= y.i0 && i < y.i1 && j >= y.j0 && j < y.j1) return 'yard:' + id;
  return 'grass';
}

export const NPCS = {
  abah: { name: 'Tok Abah', initial: 'TA', color: '#c27f12', i: 12.6, j: 10.2, look: { shirt: '#f4f1e6', pants: '#3d5a80', skin: '#b5794b', songkok: true, beard: true } },
  kiah: { name: 'Nek Ma', initial: 'NM', color: '#b24f7c', i: 19.2, j: 12.2, look: { shirt: '#e88bb0', pants: '#7a3f8f', skin: '#c78b5a', tudung: '#7a3f8f' } },
  din: { name: 'Pok Wan', initial: 'PW', color: '#2b7a66', i: 17.4, j: 21.2, look: { shirt: '#2e86de', pants: '#2d3a4a', skin: '#a8703e', hair: '#222', cap: '#e74c3c' } },
  amin: { name: 'Amin', initial: 'A', color: '#e74c3c', i: 12.6, j: 18.8, look: { shirt: '#e74c3c', pants: '#2d3a4a', skin: '#c08050', hair: '#1c1c1c', kid: true } },
  hassan: { name: 'Pak Hassan', initial: 'PH', color: '#6b8e23', i: 8.6, j: 19.2, look: { shirt: '#8d6e63', pants: '#4e342e', skin: '#9c6b44', cap: '#d9b36c' } },
  lim: { name: 'Uncle Lim', initial: 'UL', color: '#c0392b', i: 17.3, j: 8.3, look: { shirt: '#ecf0f1', pants: '#34495e', skin: '#e0b08a', hair: '#333' } },
  ani: { name: 'Cikgu Aqilah', initial: 'CQ', color: '#8e44ad', i: 13.4, j: 22.5, look: { shirt: '#a3cbe8', pants: '#2c3e50', skin: '#c78b5a', tudung: '#1f6f9c' } },
  abu: { name: 'Pok Ajis', initial: 'PA', color: '#2c3e50', i: 25.6, j: 26.2, look: { shirt: '#95a5a6', pants: '#2c3e50', skin: '#a8703e', songkok: true } },
  kaklong: { name: 'Kak Long', initial: 'KL', color: '#d35400', i: 24.6, j: 4.3, look: { shirt: '#f6a5c0', pants: '#6c3483', skin: '#c68a5a', tudung: '#d35400' } },
  mat: { name: 'Pak Mat', initial: 'PM', color: '#d35400', i: 11.7, j: 4.4, look: { shirt: '#f39c12', pants: '#34495e', skin: '#8d5a34', cap: '#ecf0f1', beard: true } },
};
const VILLAGER_LOOKS = [
  { shirt: '#27ae60', pants: '#34495e', skin: '#c68a5a', hair: '#222' },
  { shirt: '#f1c40f', pants: '#5d4037', skin: '#a8703e', songkok: true },
  { shirt: '#9b59b6', pants: '#9b59b6', skin: '#d39a6a', tudung: '#16a085' },
  { shirt: '#e67e22', pants: '#2c3e50', skin: '#b5794b', hair: '#333', cap: '#2980b9' },
  { shirt: '#ecf0f1', pants: '#7f8c8d', skin: '#c08050', tudung: '#c0392b' },
  { shirt: '#3498db', pants: '#2c3e50', skin: '#c68a5a', hair: '#111', kid: true },
];

// ------------------------------------------------------------ drawing primitives
let bb = null; // bbox tracker for the object currently being drawn
function track(p) { if (!bb) return; bb.x0 = Math.min(bb.x0, p.x); bb.x1 = Math.max(bb.x1, p.x); bb.y0 = Math.min(bb.y0, p.y); bb.y1 = Math.max(bb.y1, p.y); }
function poly(c, pts, fill, stroke, lw = 1) {
  c.beginPath(); pts.forEach((p, k) => { k ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y); track(p); }); c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
}
function line(c, a, b, col, lw = 1) { c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.strokeStyle = col; c.lineWidth = lw; c.stroke(); track(a); track(b); }
function prism(c, i, j, w, d, z, h, top, left, right, edge = 'rgba(0,0,0,.18)') {
  const B = P(i + w, j, z), C = P(i + w, j + d, z), D = P(i, j + d, z), up = (p) => ({ x: p.x, y: p.y - h });
  poly(c, [D, C, up(C), up(D)], left, edge);
  poly(c, [B, C, up(C), up(B)], right, edge);
  poly(c, [P(i, j, z + h), up(B), up(C), up(D)], top, edge);
}
// quads on visible faces. left face runs D→C (the +j side), right face runs B→C (the +i side)
function faceQuad(c, i, j, w, d, z, h, side, u0, u1, v0, v1, fill, stroke) {
  const a = side === 'L' ? P(i, j + d, z) : P(i + w, j, z), b = P(i + w, j + d, z);
  const q = (u, v) => { const p = L(a, b, u); return { x: p.x, y: p.y - v * h }; };
  poly(c, [q(u0, v0), q(u1, v0), q(u1, v1), q(u0, v1)], fill, stroke);
  const m = q((u0 + u1) / 2, (v0 + v1) / 2); return m;
}
function shadowBlob(c, i, j, w, d) { poly(c, [P(i, j + .15), P(i + w + .35, j + .15), P(i + w + .35, j + d + .4), P(i, j + d + .4)], 'rgba(20,40,20,.16)'); }

// ------------------------------------------------------------ static objects
function drawHouse(c, o, flags, glows) {
  const { i, j, w, d } = o, z = o.stilt || 0, h = o.h || 42, rh = o.rh || 30, ov = .22;
  let wall = o.wall, roof = o.roof;
  const broken = o.id === 'house_abah' && !flags.abahRepaired;
  if (o.id === 'house_abah' && flags.abahRepaired) { wall = flags.houseColor || wall; roof = '#c7d1d6'; }
  shadowBlob(c, i, j, w, d);
  if (z) {
    poly(c, [P(i, j + d), P(i + w, j + d), P(i + w, j), P(i + w, j, z), P(i + w, j + d, z), P(i, j + d, z)], 'rgba(40,30,20,.25)');
    for (const [pi, pj] of [[i, j + d], [i + w / 2, j + d], [i + w, j + d], [i + w, j + d / 2], [i + w, j]]) line(c, P(pi, pj), P(pi, pj, z), '#6b4a33', 4);
    prism(c, i - .08, j - .08, w + .16, d + .16, z - 4, 4, '#8a6242', '#7c5941', '#6b4a33');
  }
  prism(c, i, j, w, d, z, h, shade(wall, -.1), shade(wall, -.04), shade(wall, -.2));
  // plank lines
  for (let v = .14; v < 1; v += .14) {
    for (const side of ['L', 'R']) {
      const a = side === 'L' ? P(i, j + d, z + v * h) : P(i + w, j, z + v * h); line(c, a, P(i + w, j + d, z + v * h), 'rgba(0,0,0,.07)', 1);
    }
  }
  if (broken) for (const [u, v, s] of [[.08, .55, .12], [.62, .25, .1], [.3, .78, .08]]) faceQuad(c, i, j, w, d, z, h, 'L', u, u + s, v, v + .16, 'rgba(235,225,200,.85)');
  // windows + door
  const win = '#2d4a52';
  for (const u of (o.door ? [.1, .7] : [.15, .45, .72])) {
    const m = faceQuad(c, i, j, w, d, z, h, 'L', u, u + .17, .38, .74, win, '#5a3b26'); glows.push(m);
    faceQuad(c, i, j, w, d, z, h, 'L', u - .07, u, .38, .74, broken && u < .2 ? 'rgba(0,0,0,0)' : shade(wall, -.35));
  }
  if (o.door) faceQuad(c, i, j, w, d, z, h, 'L', .42, .58, 0, .8, '#5a3b26', '#3e2817');
  glows.push(faceQuad(c, i, j, w, d, z, h, 'R', .38, .62, .38, .74, win, '#5a3b26'));
  if (broken) faceQuad(c, i, j, w, d, z, h, 'R', .62, .7, .2, .6, shade(wall, -.35)); // hanging shutter
  // roof (ridge along i; gable visible on the right face)
  const zt = z + h;
  const A = P(i - ov, j - ov, zt), B = P(i + w + ov, j - ov, zt), C = P(i + w + ov, j + d + ov, zt), D = P(i - ov, j + d + ov, zt);
  const Ra = P(i - ov, j + d / 2, zt + rh), Rb = P(i + w + ov, j + d / 2, zt + rh);
  poly(c, [A, B, Rb, Ra], shade(roof, -.3), 'rgba(0,0,0,.2)');
  poly(c, [P(i + w, j, zt), P(i + w, j + d, zt), P(i + w, j + d / 2, zt + rh * .82)], shade(wall, -.12), 'rgba(0,0,0,.15)');
  poly(c, [D, C, Rb, Ra], roof, 'rgba(0,0,0,.25)');
  for (let u = .06; u < 1; u += .06) line(c, L(D, C, u), L(Ra, Rb, u), 'rgba(0,0,0,.09)', 1);
  line(c, Ra, Rb, shade(roof, -.4), 3);
  if (broken) {
    for (const [u, v] of [[.18, .35], [.55, .5], [.78, .25]]) {
      const q = (uu, vv) => L(L(D, C, uu), L(Ra, Rb, uu), vv);
      poly(c, [q(u, v), q(u + .1, v), q(u + .1, v + .25), q(u, v + .25)], '#1d1712');
      poly(c, [q(u - .03, v - .06), q(u + .14, v - .06), q(u + .14, v - .01), q(u - .03, v - .01)], '#a0522d');
    }
  }
  if (o.door && z) { // stairs down the front
    for (let k = 0; k < 4; k++) prism(c, i + w * .42, j + d + .05 + k * .22, w * .16, .24, z - (k + 1) * (z / 4), 4, '#9a6b44', '#8a5f3c', '#6b4a33');
  }
}
function drawShop(c, o, glows) {
  const { i, j, w, d } = o, h = 60;
  shadowBlob(c, i, j, w, d);
  prism(c, i, j, w, d, 0, h, '#d6cbb8', shade(o.wall, 0), shade(o.wall, -.18));
  faceQuad(c, i, j, w, d, 0, h, 'L', 0, 1, .44, .5, '#c9bba3'); // ledge
  for (let k = 0; k < 3; k++) {
    faceQuad(c, i, j, w, d, 0, h, 'L', .06 + k * .32, .32 + k * .32, 0, .4, k === 1 ? '#3b2a20' : '#46636b', '#2a1d16');
    glows.push(faceQuad(c, i, j, w, d, 0, h, 'L', .08 + k * .32, .3 + k * .32, .58, .85, '#2d4a52', '#fff'));
  }
  faceQuad(c, i, j, w, d, 0, h, 'L', .02, .98, .4, .46, o.awning);
  prism(c, i - .05, j - .05, w + .1, d + .1, h, 6, '#bfb29c', '#cdbfa8', '#a99c86');
}
function drawWarung(c, o) {
  const { i, j, w, d } = o;
  shadowBlob(c, i, j, w, d);
  prism(c, i + .2, j + .2, w - .4, d - .9, 0, 34, '#9a6b44', '#b07e52', '#8a5f3c'); // back wall
  for (const [pi, pj] of [[i, j + d], [i + w, j + d], [i + w, j], [i, j]]) line(c, P(pi, pj), P(pi, pj, 46), '#6b4a33', 3);
  prism(c, i + .2, j + d - .7, w - .4, .5, 0, 16, '#e8dcc4', '#c79a62', '#a8794a'); // counter
  for (let k = 0; k < 4; k++) { const p = P(i + .5 + k * .6, j + d - .45, 18); poly(c, [{ x: p.x - 4, y: p.y }, { x: p.x + 4, y: p.y }, { x: p.x + 4, y: p.y - 9 }, { x: p.x - 4, y: p.y - 9 }], ['#e74c3c', '#f1c40f', '#27ae60', '#e67e22'][k]); }
  // slanted zinc roof
  poly(c, [P(i - .2, j - .2, 52), P(i + w + .2, j - .2, 52), P(i + w + .2, j + d + .3, 40), P(i - .2, j + d + .3, 40)], '#a9b8bd', 'rgba(0,0,0,.25)');
  for (let u = 0; u <= 1; u += .125) { const a = L(P(i - .2, j + d + .3, 40), P(i + w + .2, j + d + .3, 40), u); line(c, a, { x: a.x + (P(i, j - .2).x - P(i, j + d + .3).x), y: a.y + (P(i, j - .2, 52).y - P(i, j + d + .3, 40).y) }, 'rgba(0,0,0,.08)'); }
  for (let u = 0; u < 1; u += .1) { const a = L(P(i - .2, j + d + .3, 40), P(i + w + .2, j + d + .3, 40), u), b = L(P(i - .2, j + d + .3, 40), P(i + w + .2, j + d + .3, 40), u + .1); poly(c, [a, b, { x: b.x, y: b.y + 8 }, { x: a.x, y: a.y + 8 }], Math.round(u * 10) % 2 ? '#fff' : '#d35400'); }
  // tables & stools
  for (const [ti, tj] of [[i + .6, j + d + .9], [i + 1.9, j + d + 1.1]]) {
    prism(c, ti, tj, .5, .5, 10, 3, '#f5f5f5', '#ddd', '#ccc'); line(c, P(ti + .25, tj + .25, 0), P(ti + .25, tj + .25, 10), '#888', 2);
    for (const [si, sj] of [[-.35, .1], [.75, .1]]) { const p = P(ti + si, tj + sj, 0); c.fillStyle = '#e74c3c'; c.beginPath(); c.ellipse(p.x, p.y - 7, 5, 2.5, 0, 0, 7); c.fill(); line(c, p, { x: p.x, y: p.y - 7 }, '#555', 1.5); }
  }
}
function drawCarIso(c, i, j, col, axis = 'i') {
  const w = axis === 'i' ? 1 : .55, d = axis === 'i' ? .55 : 1;
  poly(c, [P(i - .05, j + .05), P(i + w + .1, j + .05), P(i + w + .1, j + d + .12), P(i - .05, j + d + .12)], 'rgba(0,0,0,.18)');
  prism(c, i, j, w, d, 3, 9, shade(col, .1), shade(col, -.05), shade(col, -.25));
  const ci = axis === 'i' ? i + .25 : i + .05, cj = axis === 'i' ? j + .05 : j + .25;
  prism(c, ci, cj, axis === 'i' ? .5 : .45, axis === 'i' ? .45 : .5, 12, 7, shade(col, .2), '#36505a', '#2a4049');
}
function drawCarwash(c, o, flags, glows) {
  const { i, j, w, d } = o, h = 48;
  shadowBlob(c, i, j, w, d);
  prism(c, i, j, w, d, 0, h, '#e9eef2', '#4aa3d8', '#3384b5');
  faceQuad(c, i, j, w, d, 0, h, 'L', .12, .88, 0, .78, flags.carwashOpen ? '#2a3a44' : '#4b5b63', '#1d2a31');
  if (!flags.carwashOpen) for (let v = .1; v < .78; v += .09) faceQuad(c, i, j, w, d, 0, h, 'L', .12, .88, v, v + .04, '#6c7c84');
  glows.push(faceQuad(c, i, j, w, d, 0, h, 'R', .3, .7, .4, .75, '#2d4a52', '#fff'));
  prism(c, i - .05, j - .05, w + .1, d + .1, h, 5, '#f1c40f', '#f39c12', '#d68910');
  // bubbles decoration
  for (const [u, s] of [[.1, 9], [.22, 6], [.82, 7], [.93, 10]]) { const p = L(P(i, j + d, h + 8), P(i + w, j + d, h + 8), u); c.fillStyle = 'rgba(255,255,255,.95)'; c.strokeStyle = '#7fc8f8'; c.lineWidth = 1.5; c.beginPath(); c.arc(p.x, p.y - s, s, 0, 7); c.fill(); c.stroke(); track({ x: p.x, y: p.y - 2 * s }); }
  drawCarIso(c, i + .6, j + d + .5, flags.carwashOpen ? '#c0392b' : '#8e8e8e');
}
function drawSurau(c, o) {
  const { i, j, w, d } = o, h = 40;
  shadowBlob(c, i, j, w, d);
  prism(c, i, j, w, d, 0, h, '#ffffff', '#f4f1e6', '#d9d4c5');
  for (const u of [.12, .42, .72]) faceQuad(c, i, j, w, d, 0, h, 'L', u, u + .16, .2, .78, '#2e7d5b', '#1e5a40');
  const zt = h, ov = .15, apex = P(i + w / 2, j + d / 2, zt + 34);
  const A = P(i - ov, j - ov, zt), B = P(i + w + ov, j - ov, zt), C = P(i + w + ov, j + d + ov, zt), D = P(i - ov, j + d + ov, zt);
  poly(c, [B, C, apex], '#1e8a5c', 'rgba(0,0,0,.2)'); poly(c, [D, C, apex], '#27a56e', 'rgba(0,0,0,.2)');
  // minaret
  const mi = i + w + .2, mj = j + d - .4;
  prism(c, mi, mj, .4, .4, 0, 78, '#fff', '#f4f1e6', '#d9d4c5');
  const top = P(mi + .2, mj + .2, 78); c.fillStyle = '#f1c40f'; c.beginPath(); c.ellipse(top.x, top.y - 4, 9, 9, 0, Math.PI, 0); c.fill(); track({ x: top.x, y: top.y - 18 });
  line(c, { x: top.x, y: top.y - 12 }, { x: top.x, y: top.y - 20 }, '#c49a00', 2);
}
function drawBalai(c, o) { drawHouse(c, { ...o, stilt: 0, h: 36, rh: 26, door: true }, {}, []); }
function palm(c, i, j, s, r) {
  const b = P(i + .5, j + .5), lean = (r() - .5) * 26, top = { x: b.x + lean, y: b.y - 70 * s };
  c.fillStyle = 'rgba(20,40,20,.15)'; c.beginPath(); c.ellipse(b.x + lean * .6 + 10, b.y + 2, 22 * s, 8 * s, 0, 0, 7); c.fill();
  c.strokeStyle = '#8a6a4a'; c.lineWidth = 6 * s; c.lineCap = 'round'; c.beginPath(); c.moveTo(b.x, b.y); c.quadraticCurveTo(b.x + lean * .1, b.y - 40 * s, top.x, top.y); c.stroke();
  track(b); track(top);
  for (let k = 0; k < 8; k++) {
    const a = k / 8 * Math.PI * 2 + r() * .3, len = (30 + r() * 10) * s, ex = top.x + Math.cos(a) * len, ey = top.y + Math.sin(a) * len * .45 + 14 * s;
    c.strokeStyle = k % 2 ? '#2f8f3a' : '#3fa34a'; c.lineWidth = 6 * s; c.beginPath(); c.moveTo(top.x, top.y); c.quadraticCurveTo((top.x + ex) / 2, top.y - 14 * s, ex, ey); c.stroke();
    track({ x: ex, y: ey - 14 * s });
  }
  c.fillStyle = '#6b7f2a'; for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(top.x - 4 + k * 4, top.y + 4, 3.2 * s, 0, 7); c.fill(); }
  c.lineCap = 'butt';
}
function tree(c, i, j, s, r) {
  const b = P(i + .5, j + .5);
  c.fillStyle = 'rgba(20,40,20,.16)'; c.beginPath(); c.ellipse(b.x + 6, b.y + 2, 20 * s, 8 * s, 0, 0, 7); c.fill();
  line(c, b, { x: b.x, y: b.y - 22 * s }, '#7a5236', 6 * s);
  const cols = ['#2e7d42', '#3b9e52', '#348f4a'];
  for (let k = 0; k < 5; k++) { c.fillStyle = cols[k % 3]; const x = b.x + Math.cos(k * 1.3) * 10 * s, y = b.y - 34 * s + Math.sin(k * 1.3) * 6 * s - (k === 4 ? 10 * s : 0); c.beginPath(); c.arc(x, y, 14 * s, 0, 7); c.fill(); track({ x, y: y - 14 * s }); }
  if (r() > .5) { c.fillStyle = '#d8342c'; for (let k = 0; k < 6; k++) { c.beginPath(); c.arc(b.x + (r() - .5) * 30 * s, b.y - 30 * s + (r() - .5) * 20 * s, 2.2, 0, 7); c.fill(); } }
}
function bush(c, i, j, r) {
  const b = P(i + .5, j + .5); const cols = ['#3b9e52', '#4caf50', '#2e7d42'];
  for (let k = 0; k < 3; k++) { c.fillStyle = cols[k]; c.beginPath(); c.arc(b.x - 7 + k * 7, b.y - 6 - (k === 1 ? 4 : 0), 8, 0, 7); c.fill(); }
  if (r() > .4) { c.fillStyle = ['#f6a5ad', '#fff', '#f1c40f'][Math.floor(r() * 3)]; for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(b.x - 10 + r() * 20, b.y - 12 + r() * 8, 2, 0, 7); c.fill(); } }
}
function lamp(c, i, j) { const b = P(i, j); line(c, b, { x: b.x, y: b.y - 40 }, '#4a5560', 2.5); line(c, { x: b.x, y: b.y - 40 }, { x: b.x + 8, y: b.y - 42 }, '#4a5560', 2.5); c.fillStyle = '#fff6c8'; c.fillRect(b.x + 5, b.y - 43, 7, 4); return { x: b.x + 8, y: b.y - 39 }; }
function drawJetty(c, flags) {
  for (let k = 0; k < 6; k++) for (const pi of [9, 11]) { const b = P(pi, k * .9); line(c, { x: b.x, y: b.y + 10 }, b, '#6b4a33', 3); }
  // boat
  const b = P(11.6, 1.2);
  poly(c, [{ x: b.x - 34, y: b.y - 6 }, { x: b.x + 30, y: b.y - 22 }, { x: b.x + 24, y: b.y - 8 }, { x: b.x - 26, y: b.y + 8 }], '#2e86de', '#1b4f72');
  poly(c, [{ x: b.x - 30, y: b.y - 10 }, { x: b.x + 28, y: b.y - 26 }, { x: b.x + 30, y: b.y - 22 }, { x: b.x - 34, y: b.y - 6 }], '#f1c40f');
  prism(c, 11.4, .9, .5, .4, 6, 14, '#fff', '#ecf0f1', '#bdc3c7');
}

// ------------------------------------------------------------ people (drawn every frame)
export function drawPerson(c, x, y, look, t = 0, walking = false, scale = 1) {
  const s = (look.kid ? .75 : 1) * scale, sw = walking ? Math.sin(t * 10) * 3 * s : 0;
  c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(x, y, 7 * s, 3 * s, 0, 0, 7); c.fill();
  c.lineCap = 'round';
  c.strokeStyle = look.pants; c.lineWidth = 3.4 * s;
  c.beginPath(); c.moveTo(x - 2 * s, y - 10 * s); c.lineTo(x - 2 * s + sw, y - 1); c.moveTo(x + 2 * s, y - 10 * s); c.lineTo(x + 2 * s - sw, y - 1); c.stroke();
  if (look.tudung || look.songkok && look.beard) { c.fillStyle = look.pants; c.beginPath(); c.moveTo(x - 5 * s, y - 13 * s); c.lineTo(x + 5 * s, y - 13 * s); c.lineTo(x + 6 * s, y - 2 * s); c.lineTo(x - 6 * s, y - 2 * s); c.fill(); }
  c.fillStyle = look.shirt; c.beginPath(); c.roundRect(x - 5.5 * s, y - 22 * s, 11 * s, 12 * s, 3 * s); c.fill();
  c.strokeStyle = look.shirt; c.lineWidth = 3 * s; c.beginPath(); c.moveTo(x - 5 * s, y - 20 * s); c.lineTo(x - 7 * s - sw * .6, y - 12 * s); c.moveTo(x + 5 * s, y - 20 * s); c.lineTo(x + 7 * s + sw * .6, y - 12 * s); c.stroke();
  c.fillStyle = look.skin; c.beginPath(); c.arc(x, y - 27 * s, 5.2 * s, 0, 7); c.fill();
  if (look.tudung) { c.fillStyle = look.tudung; c.beginPath(); c.arc(x, y - 27.5 * s, 6.2 * s, Math.PI * .95, Math.PI * 2.05); c.lineTo(x + 6.5 * s, y - 19 * s); c.lineTo(x - 6.5 * s, y - 19 * s); c.closePath(); c.fill(); c.fillStyle = look.skin; c.beginPath(); c.arc(x, y - 26.5 * s, 3.6 * s, 0, 7); c.fill(); }
  else if (look.songkok) { c.fillStyle = '#15151a'; c.fillRect(x - 5 * s, y - 34.5 * s, 10 * s, 5 * s); }
  else if (look.cap) { c.fillStyle = look.cap; c.beginPath(); c.arc(x, y - 29 * s, 5.4 * s, Math.PI, 0); c.fill(); c.fillRect(x, y - 30 * s, 8 * s, 2 * s); }
  else if (look.hair) { c.fillStyle = look.hair; c.beginPath(); c.arc(x, y - 28.5 * s, 5.4 * s, Math.PI * 1.05, Math.PI * 1.95); c.fill(); }
  if (look.beard) { c.fillStyle = '#eee'; c.beginPath(); c.arc(x, y - 24 * s, 3 * s, 0, Math.PI); c.fill(); }
  c.fillStyle = '#1a1a1a'; c.fillRect(x - 2.2 * s, y - 28 * s, 1.2 * s, 1.4 * s); c.fillRect(x + 1 * s, y - 28 * s, 1.2 * s, 1.4 * s);
  c.lineCap = 'butt';
}

// ------------------------------------------------------------ the town
export function createTown(canvas, hooks) {
  const ctx = canvas.getContext('2d');
  const isTouch = matchMedia('(pointer:coarse)').matches;
  const SS = isTouch ? 1.25 : 1.6;
  const OX = 1010, OY = 190, W = 2020, H = 1180;
  const stat = document.createElement('canvas'); stat.width = W * SS; stat.height = H * SS; const sc = stat.getContext('2d');
  let objects = [], glows = [], lamps = [];
  const water = [];

  const OBJ = [
    { id: 'house_abah', kind: 'house', i: 8, j: 8, w: 3, d: 3, stilt: 16, wall: '#c48a58', roof: '#8a4b33', door: true, label: 'Rumah Tok Abah' },
    { id: 'house_ani', kind: 'house', i: 10, j: 20, w: 3, d: 3, stilt: 14, wall: '#a9d8b8', roof: '#b24a3c', door: true, label: 'Rumah Cikgu Aqilah' },
    { id: 'house_abu', kind: 'house', i: 22, j: 24, w: 3, d: 3, stilt: 14, wall: '#8fc1d4', roof: '#4f6f8f', door: true, label: 'Rumah Pok Ajis' },
    { id: 'house_x1', kind: 'house', i: 3, j: 9, w: 3, d: 3, stilt: 14, wall: '#f3d08a', roof: '#9d433c', door: true },
    { id: 'house_x2', kind: 'house', i: 25, j: 14, w: 3, d: 2, stilt: 12, wall: '#f4e6cb', roof: '#8a4b33', door: true },
    { id: 'house_x3', kind: 'house', i: 3, j: 13, w: 2, d: 2, stilt: 12, wall: '#e8b4b8', roof: '#4f6f8f', door: true },
    { id: 'kedai', kind: 'shop', i: 18, j: 5, w: 3, d: 2, wall: '#f6e7b8', awning: '#e74c3c', label: 'Kedai Runcit' },
    { id: 'warung', kind: 'warung', i: 18, j: 9, w: 3, d: 2, label: 'Warung Nek Ma' },
    { id: 'carwash', kind: 'carwash', i: 18, j: 19, w: 3, d: 2, label: 'Pok Wan Car Wash' },
    { id: 'surau', kind: 'surau', i: 23, j: 7, w: 3, d: 3, label: 'Surau' },
    { id: 'balai', kind: 'balai', i: 24, j: 19, w: 4, d: 2, wall: '#f4f1e6', roof: '#2e7d5b', label: 'Balai Raya' },
  ];

  const occupied = new Set();
  for (const o of OBJ) for (let a = Math.floor(o.i) - 1; a < o.i + o.w + 1; a++) for (let b = Math.floor(o.j) - 1; b < o.j + o.d + 2; b++) occupied.add(a * 100 + b);

  function build() {
    const flags = hooks.flags();
    sc.setTransform(SS, 0, 0, SS, OX * SS, OY * SS);
    sc.clearRect(-OX, -OY, W, H);
    // backdrop: sea beyond the map edge
    sc.fillStyle = '#4fb3d9'; sc.fillRect(-OX, -OY, W, H);
    poly(sc, [P(0, 0), P(N, 0), P(N, N), P(0, N)], '#6aae4c');
    water.length = 0;
    // tiles
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const t = baseTile(i, j), pts = [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)], chk = (i + j) % 2;
      let col = chk ? '#7cc35a' : '#76bc54';
      if (t === 'water') { col = chk ? '#4fb3d9' : '#4aaed4'; water.push([i, j]); }
      else if (t === 'sand') col = chk ? '#f1dca0' : '#ecd597';
      else if (t === 'road') col = '#8a8f98';
      else if (t === 'plank') col = chk ? '#b98a5a' : '#ad7f50';
      else if (t === 'padi') col = flags.padiState === 'ripe' ? (chk ? '#d9b84a' : '#d1ae40') : flags.padiState === 'cut' ? (chk ? '#b8a46a' : '#ad9a60') : (chk ? '#9cbf68' : '#94b860');
      else if (t.startsWith('yard:')) { const id = t.slice(5); col = flags.yardsCut.includes(id) ? (chk ? '#93d46e' : '#86c962') : (chk ? '#4f9a3c' : '#4a9238'); }
      poly(sc, pts, col, 'rgba(0,0,0,.045)');
      if (t === 'plank') for (let k = 1; k < 4; k++) line(sc, P(i, j + k / 4), P(i + 1, j + k / 4), 'rgba(0,0,0,.15)');
      if (t === 'padi') for (let k = 1; k < 4; k++) line(sc, P(i + k / 4, j), P(i + k / 4, j + 1), 'rgba(40,90,20,.35)', 1.5);
      if (t.startsWith('yard:') && !flags.yardsCut.includes(t.slice(5))) {
        const r = mulberry32(i * 31 + j); sc.strokeStyle = '#3a7d2a'; sc.lineWidth = 1.4;
        for (let k = 0; k < 9; k++) { const p = P(i + r(), j + r()); sc.beginPath(); sc.moveTo(p.x, p.y); sc.lineTo(p.x + (r() - .5) * 4, p.y - 7 - r() * 5); sc.stroke(); }
      } else if (t.startsWith('yard:')) { for (let k = 0; k < 2; k++) line(sc, P(i, j + k * .5 + .25), P(i + 1, j + k * .5 + .25), 'rgba(255,255,255,.13)', 2); }
      if (t === 'sand' && j === 3) line(sc, P(i, 3), P(i + 1, 3), 'rgba(255,255,255,.8)', 2.5);
    }
    // road markings + kerbs
    for (let j = 5; j < N; j += 1) if (j < 16 || j > 17) { if (j % 2) line(sc, P(15, j + .2), P(15, j + .8), '#fff', 2); }
    for (let i = 3; i < N; i++) if (i < 14 || i > 15) { if (i % 2) line(sc, P(i + .2, 17), P(i + .8, 17), '#fff', 2); }
    line(sc, P(14, 5), P(14, 16), '#c9c9c9', 2); line(sc, P(16, 5), P(16, 16), '#c9c9c9', 2);
    // padi field fence + lock
    // objects (sorted back-to-front)
    const r = mulberry32(77);
    const decor = [];
    for (let i = 0; i < N; i++) for (let j = 3; j < N; j++) {
      const t = baseTile(i, j); if (occupied.has(i * 100 + j)) continue;
      const v = r();
      if (t === 'sand' && v < .35) decor.push({ kind: 'palm', i, j, s: .9 + r() * .3 });
      else if (t === 'grass' && v < .07) decor.push({ kind: 'palm', i, j, s: .8 + r() * .3 });
      else if (t === 'grass' && v < .12) decor.push({ kind: 'tree', i, j, s: .8 + r() * .3 });
      else if (t === 'grass' && v < .2) decor.push({ kind: 'bush', i, j });
    }
    const lampSpots = [];
    for (let j = 6; j < N; j += 4) lampSpots.push({ kind: 'lamp', i: 13.85, j });
    for (let i = 5; i < N; i += 5) lampSpots.push({ kind: 'lamp', i, j: 18.1 });
    const all = [...OBJ, ...decor, ...lampSpots].map(o => ({ ...o, depth: o.i + (o.w || 1) + o.j + (o.d || 1) }));
    all.sort((a, b) => a.depth - b.depth);
    objects = []; glows = []; lamps = [];
    drawJetty(sc, flags);
    for (const o of all) {
      bb = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
      const rr = mulberry32(Math.round(o.i * 97 + o.j * 13));
      if (o.kind === 'house') drawHouse(sc, o, flags, glows);
      else if (o.kind === 'shop') drawShop(sc, o, glows);
      else if (o.kind === 'warung') drawWarung(sc, o);
      else if (o.kind === 'carwash') drawCarwash(sc, o, flags, glows);
      else if (o.kind === 'surau') drawSurau(sc, o);
      else if (o.kind === 'balai') drawBalai(sc, o);
      else if (o.kind === 'palm') palm(sc, o.i, o.j, o.s, rr);
      else if (o.kind === 'tree') tree(sc, o.i, o.j, o.s, rr);
      else if (o.kind === 'bush') bush(sc, o.i, o.j, rr);
      else if (o.kind === 'lamp') lamps.push(lamp(sc, o.i, o.j));
      if (o.id) objects.push({ id: o.id, label: o.label, bb, depth: o.depth, o });
      bb = null;
    }
    // padi scarecrow
    const sp = P(5.5, 24.5); line(sc, sp, { x: sp.x, y: sp.y - 30 }, '#7a5236', 3); line(sc, { x: sp.x - 12, y: sp.y - 22 }, { x: sp.x + 12, y: sp.y - 22 }, '#7a5236', 3);
    sc.fillStyle = '#e1b84f'; sc.beginPath(); sc.arc(sp.x, sp.y - 32, 6, 0, 7); sc.fill(); sc.fillStyle = '#c0392b'; sc.fillRect(sp.x - 6, sp.y - 26, 12, 9);
    // Pantai Miami corner: keropok lekor stall, umbrellas and a small Jambatan Angkat
    { const st = P(23.6, 3.6); sc.fillStyle = '#b07e52'; sc.fillRect(st.x - 18, st.y - 16, 36, 14); sc.fillStyle = '#d35400'; sc.beginPath(); sc.moveTo(st.x - 24, st.y - 16); sc.lineTo(st.x, st.y - 30); sc.lineTo(st.x + 24, st.y - 16); sc.fill(); sc.fillStyle = '#fff'; sc.font = '800 8px system-ui'; sc.textAlign = 'center'; sc.fillText('LEKOR', st.x, st.y - 6);
      for (const [i, j, c] of [[21.4, 1.4, '#e74c3c'], [22.4, 1.1, '#f1c40f'], [25.6, 1.3, '#2e86de']]) { const u = P(i, j); line(sc, u, { x: u.x, y: u.y - 16 }, '#ddd', 2); sc.fillStyle = c; sc.beginPath(); sc.moveTo(u.x - 12, u.y - 14); sc.lineTo(u.x, u.y - 22); sc.lineTo(u.x + 12, u.y - 14); sc.fill(); }
      const tw = (i, j) => { const p = P(i, j); sc.fillStyle = '#efe7d4'; sc.fillRect(p.x - 5, p.y - 58, 10, 58); sc.fillStyle = '#2c8c99'; sc.beginPath(); sc.moveTo(p.x - 7, p.y - 58); sc.lineTo(p.x, p.y - 70); sc.lineTo(p.x + 7, p.y - 58); sc.fill(); sc.fillStyle = '#d4a437'; sc.fillRect(p.x - 6, p.y - 40, 12, 3); return p; };
      const a = tw(28.4, 1.2), b = tw(28.4, 2.8), c2 = tw(29.4, 1.2), d = tw(29.4, 2.8); line(sc, { x: a.x, y: a.y - 46 }, { x: b.x, y: b.y - 46 }, '#4f88a8', 4); line(sc, { x: c2.x, y: c2.y - 46 }, { x: d.x, y: d.y - 46 }, '#4f88a8', 4);
      line(sc, P(27.4, 2), P(30.4, 2), '#9a948a', 5); }
  }

  // ------------------------------------------------------------ places & anchors
  const AREAS = {
    yard_abah: YARDS.abah, yard_ani: YARDS.ani, yard_abu: YARDS.abu, padi: PADI,
    jeti: { i0: 9, j0: 0, i1: 12.5, j1: 5 },
    pantai: { i0: 21, j0: 0, i1: 26.5, j1: 4.6 }, jambatan: { i0: 27.5, j0: 0, i1: 30, j1: 4 }, // 1-tile gap: the bridge stands apart in the corner
  };
  function anchor(id) {
    if (NPCS[id]) { const p = P(NPCS[id].i, NPCS[id].j); return { x: p.x, y: p.y - 42 }; }
    if (AREAS[id]) { const a = AREAS[id]; const p = P((a.i0 + a.i1) / 2, (a.j0 + a.j1) / 2); return { x: p.x, y: p.y - 18 }; }
    const o = objects.find(o => o.id === id); if (o) return { x: (o.bb.x0 + o.bb.x1) / 2, y: o.bb.y0 - 8 };
    return null;
  }

  // ------------------------------------------------------------ walkers & cars
  const rnd = mulberry32(5);
  const walkers = VILLAGER_LOOKS.map((look, k) => ({ look, axis: k % 2 ? 'i' : 'j', lane: k % 2 ? 16.5 + (k % 4 ? .7 : -.3) : 14.3 + (k % 4 ? 1.4 : 0), pos: 6 + rnd() * 20, dir: rnd() > .5 ? 1 : -1, speed: .5 + rnd() * .3, pause: 0, id: 'villager' + k }));
  const cars = [{ lane: 14.55, pos: 0, dir: 1, col: '#2e86de' }, { lane: 15.05, pos: 18, dir: -1, col: '#f1c40f' }];
  function walkerPos(w) { return w.axis === 'j' ? [w.lane, w.pos] : [w.pos, w.lane]; }

  // ------------------------------------------------------------ camera & input
  const cam = { x: P(10, 10).x, y: P(10, 10).y, z: isTouch ? .95 : 1.15, tx: null, ty: null, tz: null };
  const pointers = new Map(); let pinch = null, downInfo = null;
  let cw = 0, ch = 0, dpr = 1;
  function resize() { dpr = Math.min(devicePixelRatio || 1, 2); cw = canvas.clientWidth; ch = canvas.clientHeight; canvas.width = cw * dpr; canvas.height = ch * dpr; }
  addEventListener('resize', resize); resize();
  const toWorld = (sx, sy) => ({ x: (sx - cw / 2) / cam.z + cam.x, y: (sy - ch / 2) / cam.z + cam.y });
  function clampCam() { cam.z = clamp(cam.z, .45, 2.4); cam.x = clamp(cam.x, -900, 900); cam.y = clamp(cam.y, 40, 980); }
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
    if (pointers.size === 1) downInfo = { x: e.offsetX, y: e.offsetY, t: performance.now(), moved: 0 };
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: cam.z }; downInfo = null; }
    cam.tx = null;
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId); if (!p) return;
    const dx = e.offsetX - p.x, dy = e.offsetY - p.y; p.x = e.offsetX; p.y = e.offsetY;
    if (pointers.size === 2 && pinch) { const [a, b] = [...pointers.values()]; cam.z = pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d; clampCam(); return; }
    if (downInfo) downInfo.moved += Math.abs(dx) + Math.abs(dy);
    cam.x -= dx / cam.z; cam.y -= dy / cam.z; clampCam();
  });
  const up = (e) => {
    if (!pointers.has(e.pointerId)) return; pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (downInfo && pointers.size === 0 && downInfo.moved < 10 && performance.now() - downInfo.t < 600) tap(e.offsetX, e.offsetY);
    if (pointers.size === 0) downInfo = null;
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault(); const before = toWorld(e.offsetX, e.offsetY);
    cam.z *= Math.exp(-e.deltaY * .0015); clampCam();
    const after = toWorld(e.offsetX, e.offsetY); cam.x += before.x - after.x; cam.y += before.y - after.y; clampCam(); cam.tx = null;
  }, { passive: false });

  function tap(sx, sy) {
    const w = toWorld(sx, sy);
    // people first
    let best = null, bd = 22;
    for (const [id, n] of Object.entries(NPCS)) { if (!hooks.npcVisible(id)) continue; const p = P(n.i, n.j); const d = Math.hypot(w.x - p.x, w.y - (p.y - 16)); if (d < bd) { bd = d; best = { type: 'npc', id }; } }
    for (const v of walkers) { const [i, j] = walkerPos(v), p = P(i, j); const d = Math.hypot(w.x - p.x, w.y - (p.y - 14)); if (d < bd) { bd = d; best = { type: 'villager', id: v.id, walker: v }; } }
    if (!best) {
      const hits = objects.filter(o => w.x >= o.bb.x0 && w.x <= o.bb.x1 && w.y >= o.bb.y0 && w.y <= o.bb.y1).sort((a, b) => b.depth - a.depth);
      // prefer the building whose footprint is nearest the tap
      if (hits.length) best = { type: 'place', id: hits[0].id };
    }
    if (!best) {
      const t = toTile(w.x, w.y);
      for (const [id, a] of Object.entries(AREAS)) if (t.i >= a.i0 && t.i < a.i1 && t.j >= a.j0 && t.j < a.j1) best = { type: 'place', id };
    }
    hooks.onTap(best);
  }

  function focus(id, zoom) {
    const a = anchor(id); if (!a) return;
    cam.tx = a.x; cam.ty = a.y + 30; cam.tz = zoom || Math.max(cam.z, 1.1);
    pulseId = id; pulseT = 3.5;
  }
  let pulseId = null, pulseT = 0;

  // ------------------------------------------------------------ time of day
  function timeOfDay() {
    const d = new Date(); let h = d.getHours() + d.getMinutes() / 60;
    if (hooks.flags().alwaysDay) h = 11;
    let tint = null, night = 0;
    if (h >= 19.5 || h < 5.5) { tint = 'rgba(25,30,85,.55)'; night = 1; }
    else if (h >= 18.5) { const k = (h - 18.5); tint = `rgba(${lerp(230, 25, k) | 0},${lerp(120, 30, k) | 0},${lerp(60, 85, k) | 0},${lerp(.25, .55, k)})`; night = k; }
    else if (h >= 17) { tint = `rgba(240,140,60,${(h - 17) / 1.5 * .25})`; }
    else if (h < 7) { const k = (h - 5.5) / 1.5; tint = `rgba(${lerp(25, 255, k) | 0},${lerp(30, 170, k) | 0},${lerp(85, 120, k) | 0},${lerp(.5, .1, k)})`; night = 1 - k; }
    return { h, tint, night };
  }

  // ------------------------------------------------------------ per-frame render
  let t = 0;
  function frame(dt) {
    t += dt;
    if (cam.tx !== null) { const k = Math.min(1, dt * 4); cam.x = lerp(cam.x, cam.tx, k); cam.y = lerp(cam.y, cam.ty, k); cam.z = lerp(cam.z, cam.tz, k); if (Math.hypot(cam.x - cam.tx, cam.y - cam.ty) < 1) cam.tx = null; }
    pulseT = Math.max(0, pulseT - dt);
    // walkers
    for (const v of walkers) {
      if (v.pause > 0) { v.pause -= dt; continue; }
      v.pos += v.dir * v.speed * dt;
      const [lo, hi] = v.axis === 'j' ? [6, 29] : [4, 29];
      if (v.pos < lo || v.pos > hi) { v.dir *= -1; v.pos = clamp(v.pos, lo, hi); }
      if (rnd() < dt * .08) v.pause = 1 + rnd() * 3;
    }
    for (const car of cars) { car.pos += car.dir * 2.2 * dt; if (car.pos > 31) car.pos = 4; if (car.pos < 4) car.pos = 31; }

    const c = ctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.fillStyle = '#4fb3d9'; c.fillRect(0, 0, cw, ch);
    c.setTransform(dpr * cam.z, 0, 0, dpr * cam.z, dpr * (cw / 2 - cam.x * cam.z), dpr * (ch / 2 - cam.y * cam.z));
    c.drawImage(stat, -OX, -OY, W, H);
    // water sparkle
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.5;
    for (const [i, j] of water) { const ph = (t * .6 + i * .37 + j * .71) % 1, p = P(i + ph, j + .5); c.globalAlpha = Math.sin(ph * Math.PI) * .8; c.beginPath(); c.moveTo(p.x - 6, p.y); c.lineTo(p.x + 6, p.y); c.stroke(); }
    c.globalAlpha = 1;
    // cars
    for (const car of cars) drawCarIso(c, car.lane, car.pos, car.col, 'j');
    // people (sorted by depth)
    const ppl = [];
    for (const [id, n] of Object.entries(NPCS)) if (hooks.npcVisible(id)) ppl.push({ i: n.i, j: n.j, look: n.look, walking: false, id });
    for (const v of walkers) { const [i, j] = walkerPos(v); ppl.push({ i, j, look: v.look, walking: v.pause <= 0 }); }
    ppl.sort((a, b) => a.i + a.j - b.i - b.j);
    for (const p of ppl) { const q = P(p.i, p.j); drawPerson(c, q.x, q.y, p.look, t + p.i, p.walking); }
    // cloud shadows
    const tod = timeOfDay();
    if (!tod.night) { c.fillStyle = 'rgba(20,40,60,.07)'; for (let k = 0; k < 3; k++) { const x = ((t * 8 + k * 700) % 2200) - 1100, y = 200 + k * 260; c.beginPath(); c.ellipse(x, y, 160, 60, 0, 0, 7); c.ellipse(x + 90, y + 20, 110, 45, 0, 0, 7); c.fill(); } }
    // night tint + lights
    if (tod.tint) {
      c.save(); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.globalCompositeOperation = 'multiply'; c.fillStyle = tod.tint; c.fillRect(0, 0, cw, ch); c.restore();
    }
    if (tod.night > .2) {
      c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = tod.night;
      for (const g of [...lamps.map(p => [p, 60]), ...glows.map(p => [p, 18])]) {
        const [p, r] = g, gr = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        gr.addColorStop(0, 'rgba(255,200,110,.55)'); gr.addColorStop(1, 'rgba(255,200,110,0)'); c.fillStyle = gr; c.fillRect(p.x - r, p.y - r, r * 2, r * 2);
      }
      c.restore();
    }
    // markers & labels
    const marks = hooks.markers();
    c.textAlign = 'center'; c.textBaseline = 'middle';
    if (cam.z > .7) for (const o of objects) if (o.label) {
      const a = anchor(o.id); c.font = '700 11px system-ui'; const tw = c.measureText(o.label).width + 14;
      c.fillStyle = 'rgba(23,59,54,.82)'; c.beginPath(); c.roundRect(a.x - tw / 2, a.y + 2, tw, 18, 9); c.fill(); c.fillStyle = '#fff'; c.fillText(o.label, a.x, a.y + 11.5);
    }
    for (const m of marks) {
      const a = anchor(m.id); if (!a) continue; const bob = Math.sin(t * 4 + a.x) * 3, y = a.y - 16 + bob;
      if (m.type === 'mission') { c.fillStyle = '#ffd452'; c.strokeStyle = '#1d2a24'; c.lineWidth = 2.5; c.beginPath(); c.arc(a.x, y, 13, 0, 7); c.fill(); c.stroke(); c.fillStyle = '#1d2a24'; c.font = '900 17px system-ui'; c.fillText('!', a.x, y + 1); }
      else { const col = m.type === 'job' ? '#16a085' : m.type === 'act' ? '#2e86de' : m.type === 'done' ? '#27ae60' : '#6c7a80'; c.font = '800 11px system-ui'; const tw = c.measureText(m.text).width + 16; c.fillStyle = col; c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.roundRect(a.x - tw / 2, y - 10, tw, 20, 10); c.fill(); c.stroke(); c.fillStyle = '#fff'; c.fillText(m.text, a.x, y + .5); }
    }
    if (pulseId && pulseT > 0) {
      const a = anchor(pulseId); if (a) { const y = a.y - 50 + Math.sin(t * 8) * 8; c.fillStyle = '#ffd452'; c.strokeStyle = '#1d2a24'; c.lineWidth = 3; c.beginPath(); c.moveTo(a.x, y + 22); c.lineTo(a.x - 16, y); c.lineTo(a.x - 7, y); c.lineTo(a.x - 7, y - 18); c.lineTo(a.x + 7, y - 18); c.lineTo(a.x + 7, y); c.lineTo(a.x + 16, y); c.closePath(); c.fill(); c.stroke(); }
    }
    return tod;
  }

  build();
  return { rebuild: build, frame, focus, cam, anchor, timeOfDay, zoomBy(f) { cam.z *= f; clampCam(); cam.tx = null; } };
}
