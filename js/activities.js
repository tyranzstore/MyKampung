// Map activities: futsal penalties, beach volleyball, photo booth, drag race, night market.
// Each has a shared "core" (rules, scoring, progress) used by both the 3D first-person scene (minigames3d.js)
// and the 2D canvas fallback here.
import { $, clamp, sfx, toast, mulberry32 } from './core.js';

const VW = 1000, VH = 600;
const rnd = Math.random;
const starsBy = (v, a, b) => (v <= a ? 3 : v <= b ? 2 : 1);

// small overlay panel inside the game screen (power meters, scoreboards, the market counter)
export function actHud(id = 'actHud') {
  let el = $(id); if (!el) { el = document.createElement('div'); el.id = id; el.className = 'actHud'; $('game').append(el); }
  el.hidden = false;
  return { el, html(h) { if (el._h !== h) { el.innerHTML = h; el._h = h; } }, remove() { el.remove(); } };
}
export function meter(label, f, zone) {
  return `<div class="meter"><span>${label}</span><div class="mBar">${zone ? `<i class="zone" style="left:${zone[0] * 100}%;width:${(zone[1] - zone[0]) * 100}%"></i>` : ''}<b style="width:${clamp(f, 0, 1) * 100}%"></b></div></div>`;
}

// ============================================================ 1. FUTSAL — sepakan penalti
export function futsalCore(api, opts, fx = {}) {
  const GOALS = 5, PERFECT = .72;
  const S = { st: 'aim', aim: { x: 0, y: .9 }, power: 0, dir: 1, goals: 0, shots: 0, ball: null, keeper: { x: 0, vx: 0, dive: 0, guess: 0, react: 0 }, msg: '', msgT: 0, wait: 0 };
  const hud = actHud();
  const draw = () => hud.html(`<div class="score">⚽ ${S.goals} / ${GOALS} gol · ${S.shots} tendangan</div>${S.st === 'charge' ? meter('Kuasa · Power', S.power, [PERFECT - .1, PERFECT + .1]) : ''}${S.msg ? `<div class="big">${S.msg}</div>` : ''}`);
  api.step('Halakan sasaran ke gol, tekan & tahan untuk kuasa, lepas untuk tendang', 'Aim at the goal, press & hold for power, release to shoot');
  const setAim = (p) => { S.aim.x = clamp(p.x, -2.6, 2.6); S.aim.y = clamp(p.y, .1, 3); };
  function shoot() {
    S.shots++; S.st = 'fly'; const err = Math.abs(S.power - PERFECT), spread = .08 + Math.max(0, err - .1) * 2.2;
    const tx = S.aim.x + (rnd() - .5) * spread * 2, ty = Math.max(.08, S.aim.y + (rnd() - .5) * spread + (S.power - PERFECT) * 1.3);
    const dur = (err < .1 ? .5 : .66) - S.power * .1;
    S.ball = { t: 0, dur, tx, ty }; const k = S.keeper, skill = .22 + S.goals * .05;
    k.react = .14 + rnd() * .1; k.guess = rnd() < skill ? tx : (rnd() - .5) * 2.4; k.dive = 0;
    sfx.hammer && sfx.hammer(); fx.kick && fx.kick(S.ball); draw();
  }
  function result() {
    const b = S.ball, k = S.keeper, inGoal = Math.abs(b.tx) < 1.45 && b.ty < 1.95;
    const saved = inGoal && Math.abs(k.x - b.tx) < .62 + (b.ty < 1 ? .15 : 0) && b.ty < 1.9;
    let r;
    if (!inGoal) { r = 'miss'; S.msg = b.ty >= 1.95 ? 'Melambung! · Over the bar!' : 'Terlepas! · Wide!'; sfx.bad(); }
    else if (saved) { r = 'save'; S.msg = 'Diselamatkan! · Saved!'; sfx.bad(); }
    else { r = 'goal'; S.goals++; S.msg = 'GOL!!'; sfx.good(); api.progress(S.goals / GOALS); }
    fx.result && fx.result(r, b); S.st = 'result'; S.wait = 1.4; draw();
  }
  return {
    S,
    down(p) { if (S.st !== 'aim') return; setAim(p); S.st = 'charge'; S.power = 0; S.dir = 1; S.msg = ''; },
    move(p) { if (S.st === 'aim' || S.st === 'charge') setAim(p); },
    up() { if (S.st === 'charge') shoot(); },
    update(dt) {
      if (S.st === 'charge') { S.power += S.dir * dt * 1.1; if (S.power >= 1) { S.power = 1; S.dir = -1; } if (S.power <= 0) { S.power = 0; S.dir = 1; } draw(); }
      const k = S.keeper;
      if (S.st === 'fly') {
        const b = S.ball; b.t += dt; k.react -= dt;
        if (k.react <= 0) { const want = clamp(k.guess, -1.3, 1.3), d = want - k.x; k.vx = Math.sign(d) * Math.min(Math.abs(d) / dt, 5.5); k.x += k.vx * dt; k.dive = Math.min(1, k.dive + dt * 5) * Math.sign(d || 1); }
        if (b.t >= b.dur) result();
      } else if (S.st === 'result') { S.wait -= dt; if (S.wait <= 0) {
        if (S.goals >= GOALS) { S.st = 'done'; const st = starsBy(S.shots, 6, 9); setTimeout(() => api.finish({ stars: st, goals: S.goals, shots: S.shots }), 300); }
        else { S.st = 'aim'; S.ball = null; k.x = 0; k.dive = 0; S.msg = ''; fx.reset && fx.reset(); draw(); } } }
      else if (S.st === 'aim') { k.x = Math.sin(performance.now() / 500) * .25; }
    },
    ballPos() { const b = S.ball; if (!b) return { x: 0, y: .11, z: 6 }; const s = clamp(b.t / b.dur, 0, 1); return { x: b.tx * s, y: .11 + (b.ty - .11) * s + Math.sin(s * Math.PI) * .25, z: 6 * (1 - s) }; },
    stop() { hud.remove(); },
  };
}
export function Futsal(api, opts) {
  // front view of the goal: goal plane x -2.6..2.6 -> 140..860, y 0..3 -> 470..110
  const X = (x) => 500 + x * 138, Y = (y) => 470 - y * 120, iX = (px) => (px - 500) / 138, iY = (py) => (470 - py) / 120;
  const core = futsalCore(api, opts);
  const toG = (p) => ({ x: iX(p.x), y: iY(p.y) });
  return {
    dbg: () => ({ ...core.S }),
    down(p) { core.down(toG(p)); }, move(p) { core.move(toG(p)); }, up(p) { core.up(toG(p)); },
    update(dt) { core.update(dt); },
    draw(c) {
      c.fillStyle = '#1d3b5c'; c.fillRect(0, 0, VW, VH); c.fillStyle = '#2c6fb0'; c.fillRect(0, 470, VW, 130); c.fillStyle = '#e67e22'; c.fillRect(0, 520, VW, 80);
      c.strokeStyle = '#fff'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 470); c.lineTo(VW, 470); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 1; for (let x = X(-1.5); x <= X(1.5); x += 14) { c.beginPath(); c.moveTo(x, Y(2)); c.lineTo(x, Y(0)); c.stroke(); } for (let y = Y(2); y <= Y(0); y += 14) { c.beginPath(); c.moveTo(X(-1.5), y); c.lineTo(X(1.5), y); c.stroke(); }
      c.strokeStyle = '#fff'; c.lineWidth = 9; c.beginPath(); c.moveTo(X(-1.5), Y(0)); c.lineTo(X(-1.5), Y(2)); c.lineTo(X(1.5), Y(2)); c.lineTo(X(1.5), Y(0)); c.stroke();
      const k = core.S.keeper, kx = X(k.x), lean = k.dive * .5;
      c.save(); c.translate(kx, Y(0)); c.rotate(lean); c.fillStyle = '#f1c40f'; c.fillRect(-26, -150, 52, 80); c.fillStyle = '#222'; c.fillRect(-22, -70, 18, 70); c.fillRect(4, -70, 18, 70); c.fillStyle = '#c68a5a'; c.beginPath(); c.arc(0, -168, 20, 0, 7); c.fill(); c.fillStyle = '#f1c40f'; c.fillRect(-62, -150, 36, 14); c.fillRect(26, -150, 36, 14); c.restore();
      const b = core.ballPos(), sc = 1 + b.z * .35;
      c.fillStyle = '#fff'; c.beginPath(); c.arc(X(b.x), Y(b.y) + b.z * 18, 13 * sc, 0, 7); c.fill(); c.fillStyle = '#222'; c.beginPath(); c.arc(X(b.x), Y(b.y) + b.z * 18, 5 * sc, 0, 7); c.fill();
      if (core.S.st === 'aim' || core.S.st === 'charge') { const a = core.S.aim; c.strokeStyle = '#ffd452'; c.lineWidth = 3; c.beginPath(); c.arc(X(a.x), Y(a.y), 22, 0, 7); c.moveTo(X(a.x) - 32, Y(a.y)); c.lineTo(X(a.x) + 32, Y(a.y)); c.moveTo(X(a.x), Y(a.y) - 32); c.lineTo(X(a.x), Y(a.y) + 32); c.stroke(); }
    },
    stop() { core.stop(); },
  };
}

// ============================================================ 2. BOLA TAMPAR PANTAI
// your half: z 0 (net) .. 8 (baseline, towards the camera); x -4..4. Opponent half: z -8..0.
export function volleyCore(api, opts, fx = {}) {
  const GOAL = 10;
  const S = { me: { x: 0, z: 5.5 }, tgt: { x: 0, z: 5.5 }, opp: { x: 0, z: -5 }, ball: null, hits: 0, misses: 0, st: 'serve', wait: 1.2, cool: 0, msg: 'Lawan akan servis…', side: 0 };
  const hud = actHud();
  const draw = () => hud.html(`<div class="score">🏐 ${S.hits} / ${GOAL} pukulan · ❌ ${S.misses}</div>${S.msg ? `<div class="big small">${S.msg}</div>` : ''}`);
  draw();
  api.step('Ketik/seret di pasir untuk bergerak ke bayang bola · ketik bila bola masuk bulatan hijau', 'Tap/drag on the sand to move under the ball · tap when the ball is inside the green ring');
  const fly = (a, l, T, H) => { S.ball = { a: { ...a }, l: { ...l }, T, H, t: 0 }; S.side = l.z > 0 ? 1 : -1; };
  const pos = () => { const b = S.ball; if (!b) return null; const s = clamp(b.t / b.T, 0, 1); return { x: b.a.x + (b.l.x - b.a.x) * s, z: b.a.z + (b.l.z - b.a.z) * s, y: b.a.y * (1 - s) + 4 * b.H * s * (1 - s), s }; };
  function serve() { const hard = Math.min(1, S.hits / GOAL); fly({ x: (rnd() - .5) * 4, y: 2.6, z: -7 }, { x: (rnd() - .5) * (4.5 + hard * 1.5), z: 2 + rnd() * (3.5 + hard) }, 1.75 - hard * .35, 4.2); S.st = 'play'; S.msg = ''; draw(); fx.serve && fx.serve(); }
  const reach = () => { const p = pos(); if (!p || S.side !== 1) return false; return Math.hypot(p.x - S.me.x, p.z - S.me.z) < 1.05 && p.y > .35 && p.y < 2.7; };
  function hit() {
    const p = pos(); S.hits++; sfx.good(); api.progress(S.hits / GOAL); fx.hit && fx.hit(p);
    const land = { x: (rnd() - .5) * 6, z: -2.5 - rnd() * 4.5 }; fly({ x: p.x, y: p.y, z: p.z }, land, 1.45, 3.6 + rnd()); draw();
    if (S.hits >= GOAL) { S.st = 'done'; S.msg = 'Hebat!'; draw(); setTimeout(() => api.finish({ stars: starsBy(S.misses, 1, 3), hits: S.hits }), 1200); }
  }
  return {
    S, pos, reach,
    down(p) { if (S.st === 'done') return; if (S.st === 'play' && S.cool <= 0 && reach()) return hit(); if (S.st === 'play' && S.side === 1) { const b = pos(); if (b && b.y < 2.9 && Math.hypot(b.x - S.me.x, b.z - S.me.z) < 2.2 && S.cool <= 0) { S.cool = .35; S.msg = 'Belum! Tunggu dalam bulatan'; draw(); } } S.tgt.x = clamp(p.x, -4.2, 4.2); S.tgt.z = clamp(p.y, .8, 8.5); },
    move(p, down) { if (down) { S.tgt.x = clamp(p.x, -4.2, 4.2); S.tgt.z = clamp(p.y, .8, 8.5); } },
    up() {},
    update(dt) {
      S.cool -= dt; const m = S.me, d = Math.hypot(S.tgt.x - m.x, S.tgt.z - m.z), sp = 5.2 * dt;
      if (d > .01) { const k = Math.min(1, sp / d); m.x += (S.tgt.x - m.x) * k; m.z += (S.tgt.z - m.z) * k; }
      if (S.st === 'serve') { S.wait -= dt; if (S.wait <= 0) serve(); return; }
      if (S.st !== 'play') { if (S.ball) S.ball.t += dt; return; }
      const b = S.ball; b.t += dt;
      if (S.side === -1) { const o = S.opp; o.x += clamp(b.l.x - o.x, -dt * 5, dt * 5); o.z += clamp(b.l.z - o.z, -dt * 5, dt * 5);
        if (b.t >= b.T * .93) { const hard = Math.min(1, S.hits / GOAL); const p = pos(); fx.oppHit && fx.oppHit(p); fly({ x: p.x, y: p.y, z: p.z }, { x: (rnd() - .5) * (4.5 + hard * 2), z: 1.8 + rnd() * (4 + hard * 1.2) }, 1.6 - hard * .35, 3.4 + rnd()); } }
      else if (b.t >= b.T) { S.misses++; sfx.bad(); S.st = 'serve'; S.wait = 1.4; S.msg = 'Bola jatuh! · Missed!'; fx.miss && fx.miss(pos()); draw(); }
    },
    stop() { hud.remove(); },
  };
}
export function Volley(api, opts) {
  // top-down court: x -5..5 -> 200..800, z -9..9 -> 40..580
  const X = (x) => 500 + x * 60, Z = (z) => 310 + z * 30, iX = (px) => (px - 500) / 60, iZ = (py) => (py - 310) / 30;
  const core = volleyCore(api, opts); let down = false;
  const toC = (p) => ({ x: iX(p.x), y: iZ(p.y) });
  return {
    dbg: () => ({ ...core.S, land: core.S.ball && core.S.ball.l, ball: core.pos(), reach: core.reach() }),
    down(p) { down = true; core.down(toC(p)); }, move(p) { core.move(toC(p), down); }, up() { down = false; },
    update(dt) { core.update(dt); },
    draw(c) {
      c.fillStyle = '#2f8fc4'; c.fillRect(0, 0, VW, VH); c.fillStyle = '#f0dca6'; c.fillRect(120, 0, 760, VH);
      c.strokeStyle = '#1f6fd1'; c.lineWidth = 4; c.strokeRect(X(-4), Z(-8), 480, 480);
      c.fillStyle = '#333'; c.fillRect(X(-4.6), Z(0) - 3, 552, 6); c.fillStyle = '#fff'; c.fillRect(X(-4.6), Z(0) - 1, 552, 2);
      const o = core.S.opp; c.fillStyle = '#c0392b'; c.beginPath(); c.arc(X(o.x), Z(o.z), 16, 0, 7); c.fill();
      const m = core.S.me; c.fillStyle = '#2e86de'; c.beginPath(); c.arc(X(m.x), Z(m.z), 16, 0, 7); c.fill(); c.strokeStyle = core.reach() ? '#2ecc71' : 'rgba(255,255,255,.6)'; c.lineWidth = 3; c.beginPath(); c.arc(X(m.x), Z(m.z), 63, 0, 7); c.stroke();
      const b = core.pos(); if (b) { c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(X(b.x), Z(b.z), 14, 9, 0, 0, 7); c.fill(); c.fillStyle = '#ffd452'; c.beginPath(); c.arc(X(b.x), Z(b.z) - b.y * 26, 12 + b.y * 1.5, 0, 7); c.fill(); c.strokeStyle = '#2e86de'; c.lineWidth = 2; c.stroke(); }
    },
    stop() { core.stop(); },
  };
}

// ============================================================ 3. BOOTH FOTO — Jambatan Angkat
export const POSES = [['✌️', 'Peace'], ['👋', 'Lambai · Wave'], ['💪', 'Gaya kuat · Strong'], ['🫶', 'Hati · Heart']];
export const TIMES = [['☀️', 'Siang · Day'], ['🌅', 'Senja · Sunset'], ['🌙', 'Malam · Night']];
export function photoCore(api, opts, fx = {}) {
  const GOAL = 3;
  const S = { st: 'pose', pose: 0, time: 1, pan: { x: 0, y: 0 }, zoom: 1, photos: [], score: 0, count: 0, drag: null };
  const hud = actHud();
  function tools() {
    if (S.st === 'pose') api.tools(POSES.map(([ic, n], k) => ({ html: `<b>${ic}</b><span>${n.split(' ·')[0]}</span>`, sel: k === S.pose, on: () => { S.pose = k; sfx.tap(); fx.pose && fx.pose(k); tools(); } })).concat([{ html: '<b>➡️</b><span>Seterusnya</span>', on: () => { S.st = 'time'; sfx.tap(); step(); } }]));
    else if (S.st === 'time') api.tools(TIMES.map(([ic, n], k) => ({ html: `<b>${ic}</b><span>${n.split(' ·')[0]}</span>`, sel: k === S.time, on: () => { S.time = k; sfx.tap(); fx.time && fx.time(k); tools(); } })).concat([{ html: '<b>➡️</b><span>Seterusnya</span>', on: () => { S.st = 'frame'; sfx.tap(); step(); } }]));
    else if (S.st === 'frame') api.tools([{ html: '<b>➖</b><span>Zum keluar</span>', on: () => { S.zoom = clamp(S.zoom - .15, .7, 1.6); } }, { html: '<b>➕</b><span>Zum masuk</span>', on: () => { S.zoom = clamp(S.zoom + .15, .7, 1.6); } }, { html: '<b>📸</b><span>Snap!</span>', on: () => snap() }]);
    else api.tools([]);
  }
  function step() {
    const n = S.photos.length + 1;
    if (S.st === 'pose') api.step(`Foto ${n}/${GOAL}: pilih gaya`, `Photo ${n}/${GOAL}: choose a pose`);
    else if (S.st === 'time') api.step(`Foto ${n}/${GOAL}: pilih waktu — malam, lampu menara menyala!`, 'Choose the time of day — at night the towers light up!');
    else if (S.st === 'frame') api.step('Seret untuk susun gambar: letak jambatan dalam kotak kuning, kemudian 📸', 'Drag to frame the shot: put the bridge inside the yellow box, then 📸');
    tools();
  }
  function snap() {
    if (S.st !== 'frame') return; S.st = 'count'; S.count = 3; api.tools([]); sfx.tap();
    const tick = () => { if (S.count > 1) { S.count--; sfx.tap(); setTimeout(tick, 650); } else { S.count = 0; shoot(); } }; setTimeout(tick, 650);
  }
  function shoot() {
    try { S.score = fx.score ? fx.score() : .8; } catch { S.score = .7; } sfx.good();
    fx.capture((url) => {
      S.photos.push({ url, score: S.score }); api.progress(S.photos.length / GOAL); S.st = 'show';
      const stars = S.score > .8 ? 3 : S.score > .5 ? 2 : 1;
      hud.html(`<div class="photoCard"><img src="${url}" alt="foto"><div class="pcRow"><b>${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</b> <span>Susunan · Framing ${Math.round(S.score * 100)}%</span></div><div class="pcRow"><a class="pcBtn" download="MyKampung-JambatanAngkat-${S.photos.length}.png" href="${url}">⬇️ Simpan · Save</a><button class="pcBtn primary" id="pcNext">${S.photos.length >= GOAL ? 'Siap · Done' : 'Foto seterusnya ➡️'}</button></div></div>`);
      $('pcNext').onclick = () => { sfx.tap(); hud.html('');
        if (S.photos.length >= GOAL) { S.st = 'done'; const avg = S.photos.reduce((a, p) => a + p.score, 0) / S.photos.length; api.finish({ stars: avg > .8 ? 3 : avg > .55 ? 2 : 1, photos: S.photos.length }); }
        else { S.st = 'pose'; S.pan = { x: (rnd() - .5) * 2, y: (rnd() - .5) * 1 }; step(); fx.reset && fx.reset(); } };
    });
  }
  step(); fx.time && setTimeout(() => fx.time(S.time), 0);
  return {
    S, snap,
    down(p) { if (S.st === 'frame') S.drag = { x: p.sx, y: p.sy, px: S.pan.x, py: S.pan.y }; },
    move(p) { if (S.st === 'frame' && S.drag && p.down) { S.pan.x = clamp(S.drag.px - (p.sx - S.drag.x) * .012, -4, 4); S.pan.y = clamp(S.drag.py + (p.sy - S.drag.y) * .008, -2, 2); } },
    up() { S.drag = null; },
    update() { hud.el.dataset.count = S.count || ''; if (S.st === 'count') hud.html(`<div class="countdown">${S.count}</div>`); },
    stop() { hud.remove(); },
  };
}
export function Photo(api, opts) {
  let ptr = { sx: 0, sy: 0, down: false }, flash = 0, sky = 1;
  const SK = [['#8fd0f0', '#cfeefa'], ['#f39c6b', '#f6d48a'], ['#0d1b3a', '#2b3d66']];
  let canvas = null;
  const core = photoCore(api, opts, {
    time(k) { sky = k; },
    score() { const bx = 640 - core.S.pan.x * 90 * core.S.zoom, by = 250 + core.S.pan.y * 60; const d = Math.hypot((bx - 640) / 160, (by - 230) / 110); return clamp(1 - d * .6, 0, 1); },
    capture(cb) { flash = 1; setTimeout(() => cb(($('gcv') || canvas).toDataURL('image/png')), 60); },
  });
  return {
    dbg: () => ({ ...core.S }),
    down(p) { ptr = { sx: p.x, sy: p.y, down: true }; core.down(ptr); }, move(p) { ptr = { sx: p.x, sy: p.y, down: p.down }; core.move(ptr); }, up() { ptr.down = false; core.up(); },
    update(dt) { core.update(dt); flash = Math.max(0, flash - dt * 3); },
    draw(c) {
      const z = core.S.zoom, ox = -core.S.pan.x * 90 * z, oy = core.S.pan.y * 60;
      const g = c.createLinearGradient(0, 0, 0, 380); g.addColorStop(0, SK[sky][0]); g.addColorStop(1, SK[sky][1]); c.fillStyle = g; c.fillRect(0, 0, VW, VH);
      c.save(); c.translate(500 + ox, 300 + oy); c.scale(z, z); c.translate(-500, -300);
      c.fillStyle = sky === 2 ? '#123a5a' : '#2f8fc4'; c.fillRect(-400, 380, 1800, 400);
      const tower = (x, h) => { c.fillStyle = sky === 2 ? '#c9b98f' : '#f1ead9'; c.fillRect(x - 14, 380 - h, 28, h); c.fillStyle = '#2c8c99'; c.beginPath(); c.moveTo(x - 20, 380 - h); c.lineTo(x, 380 - h - 34); c.lineTo(x + 20, 380 - h); c.fill(); if (sky === 2) { c.fillStyle = '#ffd88a'; for (let k = 0; k < 9; k++) c.fillRect(x - 8, 380 - h + 12 + k * 18, 16, 8); } };
      tower(560, 230); tower(610, 220); tower(690, 220); tower(740, 230);
      c.fillStyle = '#4f88a8'; c.fillRect(560, 210, 50, 14); c.fillRect(690, 210, 50, 14); c.fillStyle = '#d9d3c4'; c.fillRect(300, 352, 260, 10); c.fillRect(740, 352, 300, 10);
      c.save(); c.translate(610, 352); c.rotate(-.7); c.fillRect(0, 0, 40, 10); c.restore(); c.save(); c.translate(690, 352); c.rotate(.7 + Math.PI); c.fillRect(0, -10, 40, 10); c.restore();
      c.restore();
      c.fillStyle = '#f0dca6'; c.fillRect(0, 470, VW, 130);
      c.font = '120px system-ui'; c.textAlign = 'center'; c.fillText('🧑', 300, 520); c.font = '60px system-ui'; c.fillText(POSES[core.S.pose][0], 370, 430);
      c.strokeStyle = '#fff'; c.lineWidth = 10; c.strokeRect(20, 20, VW - 40, VH - 40); c.fillStyle = '#fff'; c.font = '800 22px system-ui'; c.fillText('PANTAI MIAMI · KUALA TERENGGANU', 500, VH - 32);
      if (core.S.st === 'frame') { c.setLineDash([12, 8]); c.strokeStyle = '#ffd452'; c.lineWidth = 4; c.strokeRect(480, 120, 320, 220); c.setLineDash([]); }
      if (flash) { c.fillStyle = `rgba(255,255,255,${flash})`; c.fillRect(0, 0, VW, VH); }
    },
    stop() { core.stop(); },
  };
}

// ============================================================ 4. LUMBA DRAG 402 m
export function dragCore(api, opts, fx = {}) {
  const LEN = 402, TOP = [16, 29, 41, 52, 62], ACC = [9.8, 7.4, 5.4, 4, 3];
  const curve = (r) => .5 + .5 * Math.sin(Math.min(1, r / .9) * Math.PI / 2); // power climbs to a peak just below the red line
  const car = () => ({ x: 0, v: 0, g: 0, rpm: .25, shift: 0, t: 0, done: false, et: 0 });
  const S = { st: 'stage', lights: 0, lt: 0, green: 0, greenDelay: .3 + rnd() * .7, aiReact: .2 + rnd() * .12, aiShift: .88 + rnd() * .06, me: car(), ai: car(), react: 0, perfect: 0, early: 0, late: 0, msg: '', foul: false, limiter: 0 };
  const hud = actHud();
  api.step('Tunggu lampu hijau, kemudian ketik untuk mula! · Ketik untuk tukar gear bila jarum dalam zon hijau', 'Wait for the green light, then tap to launch! · Tap to shift when the needle is in the green zone');
  function stepCar(c, dt, auto) {
    if (c.done) return; c.t += dt;
    if (c.shift > 0) { c.shift -= dt; c.v += .2 * dt; }
    else { const r = c.v / TOP[c.g]; c.rpm = clamp(r, .18, 1.02); const a = c.rpm >= 1 ? 0 : ACC[c.g] * curve(c.rpm) * (auto ? .985 : 1); c.v += a * dt; if (c.rpm >= 1 && c === S.me) S.limiter += dt; }
    if (auto && c.g < 4 && c.rpm > auto && c.shift <= 0) { c.g++; c.shift = .2; }
    c.x += c.v * dt; if (c.x >= LEN) { c.done = true; c.et = c.t - (c.x - LEN) / Math.max(1, c.v); }
  }
  function shift() {
    const c = S.me; if (c.g >= 4 || c.shift > 0) return; const r = c.rpm;
    let q; if (r >= .84 && r <= .97) { q = 'perfect'; S.perfect++; c.shift = .15; S.msg = 'TUKAR SEMPURNA!'; sfx.good(); } else if (r < .84) { q = 'early'; S.early++; c.shift = .32; S.msg = 'Terlalu awal'; sfx.tap(); } else { q = 'late'; S.late++; c.shift = .22; S.msg = 'Lambat!'; sfx.tap(); }
    c.g++; fx.shift && fx.shift(q);
  }
  const draw = () => {
    const c = S.me, L = S.lights;
    const tree = `<div class="tree">${[0, 1, 2].map(k => `<i class="${L > k && L < 4 ? 'amber' : ''}"></i>`).join('')}<i class="${L >= 4 ? 'go' : ''}"></i></div>`;
    hud.html(`${S.st === 'stage' || S.st === 'lights' ? tree : ''}<div class="dash"><div class="tach"><b style="transform:rotate(${-120 + c.rpm * 240}deg)"></b><i class="red"></i><i class="grn"></i><span>${c.g + 1}</span></div><div class="dinfo"><b>${Math.round(c.v * 3.6)}</b> km/j<br><small>${Math.round(c.x)} / ${LEN} m</small></div></div>${S.msg ? `<div class="big small">${S.msg}</div>` : ''}`);
  };
  draw();
  return {
    S, LEN,
    down() {
      if (S.st === 'stage') { S.st = 'lights'; S.lt = 0; S.msg = ''; return; }
      if (S.st === 'lights') { S.foul = true; S.msg = 'Lompat lampu! +0.5s'; sfx.bad(); return; }
      if (S.st === 'go') { S.st = 'race'; S.react = S.lt - S.green + (S.foul ? .5 : 0); S.msg = `Reaksi ${S.react.toFixed(2)}s`; sfx.good(); fx.launch && fx.launch(); return; }
      if (S.st === 'race') shift();
    },
    move() {}, up() {},
    update(dt) {
      if (S.st === 'stage') { S.msg = 'Ketik untuk mula · Tap to stage'; draw(); return; }
      S.lt += dt;
      if (S.st === 'lights') { S.lights = Math.min(3, Math.floor(S.lt / .55)); if (S.lt > 1.65 + S.greenDelay) { S.st = 'go'; S.lights = 4; S.green = S.lt; sfx.star && sfx.star(2); } }
      if (S.st === 'lights' || S.st === 'go') S.me.rpm = .35 + Math.sin(S.lt * 9) * .05;
      if (S.green && S.lt - S.green > S.aiReact) stepCar(S.ai, dt, S.aiShift);
      if (S.st === 'race') { stepCar(S.me, dt, 0); api.progress(Math.min(.999, S.me.x / LEN)); fx.move && fx.move(); if (S.me.done) {
        S.st = 'finish'; const ai = S.ai; while (!ai.done) stepCar(ai, 1 / 60, S.aiShift);
        const et = S.me.et + S.react, aet = ai.et + S.aiReact, win = et < aet; S.win = win; S.et = et; S.aet = aet;
        S.msg = win ? `MENANG! ${et.toFixed(2)}s` : `Kalah tipis… ${et.toFixed(2)}s vs ${aet.toFixed(2)}s`; win ? sfx.good() : sfx.bad(); api.progress(1);
        setTimeout(() => api.finish({ stars: win && S.react < .4 && S.perfect >= 3 ? 3 : win ? 2 : 1, et, win, trap: Math.round(S.me.v * 3.6) }), 1800); } }
      draw();
    },
    stop() { hud.remove(); },
  };
}
export function Drag(api, opts) {
  const core = dragCore(api, opts);
  return {
    dbg: () => ({ st: core.S.st, rpm: core.S.me.rpm, g: core.S.me.g, x: core.S.me.x, lights: core.S.lights }),
    down() { core.down(); }, move() {}, up() {},
    update(dt) { core.update(dt); },
    draw(c) {
      const me = core.S.me, ai = core.S.ai, cam = me.x;
      c.fillStyle = '#7cc6ee'; c.fillRect(0, 0, VW, 300); c.fillStyle = '#5d8a3c'; c.fillRect(0, 260, VW, 40); c.fillStyle = '#3d3f44'; c.fillRect(0, 300, VW, 300);
      for (let m = Math.floor((cam - 20) / 10) * 10; m < cam + 60; m += 10) { const x = 200 + (m - cam) * 16; c.fillStyle = '#ddd'; c.fillRect(x, 448, 60, 6); if (m % 100 === 0 && m >= 0) { c.fillStyle = '#fff'; c.font = '800 16px system-ui'; c.fillText(`${m}m`, x, 290); } }
      const fx = 200 + (core.LEN - cam) * 16; c.fillStyle = '#fff'; c.fillRect(fx, 300, 8, 300); c.fillStyle = '#222'; c.fillRect(fx - 30, 220, 68, 30); c.fillStyle = '#fff'; c.fillText('FINISH', fx - 26, 241);
      const carD = (x, y, col) => { c.fillStyle = col; c.beginPath(); c.roundRect(x - 70, y - 30, 140, 34, 10); c.fill(); c.fillRect(x - 40, y - 52, 70, 26); c.fillStyle = '#222'; for (const wx of [x - 42, x + 42]) { c.beginPath(); c.arc(wx, y + 4, 16, 0, 7); c.fill(); } };
      carD(200 + (ai.x - cam) * 16, 400, '#c0392b'); carD(200, 520, '#f1c40f');
    },
    stop() { core.stop(); },
  };
}

// ============================================================ 5. PASAR MALAM — peniaga atau pembeli
export const FOODS = [
  { id: 'satay', bm: 'Satay', ic: '🍢', price: 1, unit: 'cucuk' }, { id: 'tebu', bm: 'Air Tebu', ic: '🥤', price: 3, unit: 'cawan' },
  { id: 'lekor', bm: 'Keropok Lekor', ic: '🍤', price: 5, unit: 'pek' }, { id: 'apam', bm: 'Apam Balik', ic: '🥞', price: 4, unit: 'keping' },
  { id: 'murtabak', bm: 'Murtabak', ic: '🫓', price: 6, unit: 'keping' }, { id: 'jagung', bm: 'Jagung Bakar', ic: '🌽', price: 2, unit: 'batang' },
];
const F = Object.fromEntries(FOODS.map(f => [f.id, f]));
const NAMES = ['Kak Ros', 'Abang Joe', 'Mak Teh', 'Adik Mira', 'Pak Leh', 'Uncle Raju', 'Cik Siti', 'Abang Hafiz'];
export function marketCore(api, opts, fx = {}) {
  const S = { st: 'role', role: null, served: 0, goal: 6, mistakes: 0, earned: 0, tips: 0, cust: null, tray: {}, change: 0, pay: 0, patience: 1,
    // buyer
    list: [], wallet: [], bought: [], stall: 0, bargained: {}, paying: null, spent: 0 };
  const hud = actHud('mkt'); hud.el.className = 'actHud mkt';
  const sum = (o) => Object.entries(o).reduce((a, [id, q]) => a + F[id].price * q, 0);
  const same = (a, b) => { const k = new Set([...Object.keys(a), ...Object.keys(b)]); for (const id of k) if ((a[id] || 0) !== (b[id] || 0)) return false; return true; };
  const rm = (n) => `RM${n}`;
  function newCustomer() {
    const order = {}, n = 1 + Math.floor(rnd() * Math.min(3, 1 + S.served / 2));
    while (Object.keys(order).length < n) { const f = FOODS[Math.floor(rnd() * FOODS.length)]; order[f.id] = f.id === 'satay' ? 5 + Math.floor(rnd() * 6) : 1 + Math.floor(rnd() * 2); }
    const total = sum(order), pay = [5, 10, 20, 50].find(v => v >= total + (rnd() < .3 ? 0 : 1)) || 50;
    S.cust = { name: NAMES[Math.floor(rnd() * NAMES.length)], order, total, pay: rnd() < .15 ? total : pay, mood: 1 }; S.tray = {}; S.change = 0; S.st = 'order'; S.patience = 1;
    fx.customer && fx.customer(S.cust); render();
  }
  function startBuyer() {
    const ids = FOODS.map(f => f.id).sort(() => rnd() - .5).slice(0, 4); S.list = ids.map(id => ({ id, q: id === 'satay' ? 5 : 1 })); S.wallet = [10, 5, 5, 1, 1, 1];
    S.goal = S.list.length; S.st = 'shop'; S.stall = 0; fx.stall && fx.stall(0); render();
  }
  const listTotal = () => S.list.reduce((a, it) => a + F[it.id].price * it.q, 0);
  function render() {
    if (S.st === 'role') return hud.html(`<div class="mCard"><h3>🏮 Pasar Malam</h3><p>Nak jadi apa malam ni? · What will you be tonight?</p><div class="mRow"><button class="mBig" data-r="seller">🧑‍🍳<b>Peniaga</b><small>Seller — layan pelanggan, kira baki</small></button><button class="mBig" data-r="buyer">🛍️<b>Pembeli</b><small>Buyer — beli ikut senarai & bajet</small></button></div></div>`), bind();
    if (S.role === 'seller') {
      const c = S.cust; if (!c) return hud.html('');
      const order = Object.entries(c.order).map(([id, q]) => `<span class="chip">${F[id].ic} ${q} ${F[id].bm}</span>`).join('');
      const tray = Object.entries(S.tray).filter(([, q]) => q).map(([id, q]) => `<span class="chip">${F[id].ic}×${q}</span>`).join('') || '<small>Dulang kosong · Empty tray</small>';
      if (S.st === 'order') hud.html(`<div class="mTop"><div class="bubble"><b>${c.name}:</b> ${order}<div class="pat"><i style="width:${S.patience * 100}%"></i></div></div><div class="till">💰 ${rm(S.earned)} · 👥 ${S.served}/${S.goal}</div></div>
        <div class="mBot"><div class="tray">${tray}</div><div class="mRow">${FOODS.map(f => `<button class="food" data-f="${f.id}">${f.ic}<b>${f.bm}</b><small>${rm(f.price)}</small></button>`).join('')}</div><div class="mRow"><button class="mBtn" data-a="clear">🗑️ Kosongkan</button><button class="mBtn primary" data-a="give">🤲 Serah · Hand over</button></div></div>`);
      else if (S.st === 'change') { const due = c.pay - c.total;
        hud.html(`<div class="mTop"><div class="bubble"><b>${c.name}</b> bayar <b class="note">${rm(c.pay)}</b> untuk ${rm(c.total)}. ${due ? `Baki? · Change?` : 'Duit cukup-cukup!'}<div class="pat"><i style="width:${S.patience * 100}%"></i></div></div><div class="till">💰 ${rm(S.earned)} · 👥 ${S.served}/${S.goal}</div></div>
        <div class="mBot"><div class="tray">Baki diberi · Change given: <b>${rm(S.change)}</b></div><div class="mRow">${[1, 5, 10, 20].map(v => `<button class="money" data-m="${v}">${rm(v)}</button>`).join('')}<button class="mBtn" data-a="reset">↩️ Semula</button><button class="mBtn primary" data-a="pay">✅ Beri baki</button></div></div>`); }
      return bind();
    }
    if (S.role === 'buyer') {
      const f = FOODS[S.stall], need = S.list.find(it => it.id === f.id && !S.bought.includes(it.id)), cash = S.wallet.reduce((a, b) => a + b, 0);
      const list = S.list.map(it => `<li class="${S.bought.includes(it.id) ? 'done' : ''}">${F[it.id].ic} ${it.q} ${F[it.id].unit} ${F[it.id].bm}</li>`).join('');
      const price = f.price * (f.id === 'satay' ? 5 : 1) - (S.bargained[f.id] === 'ok' ? 1 : 0);
      if (S.st === 'shop') hud.html(`<div class="mTop"><div class="bubble"><b>Senarai · List</b><ul class="slist">${list}</ul></div><div class="till">👛 ${S.wallet.map(rm).join(' ')} = <b>${rm(cash)}</b></div></div>
        <div class="mBot"><div class="stallName"><button class="mBtn" data-a="prev">◀</button><b>${f.ic} Gerai ${f.bm}</b> — ${rm(price)} ${f.id === 'satay' ? '/ 5 cucuk' : '/ ' + f.unit}${S.bargained[f.id] === 'ok' ? ' <small>(lepas tawar)</small>' : ''}<button class="mBtn" data-a="next">▶</button></div>
        <div class="mRow"><button class="mBtn" data-a="haggle" ${S.bargained[f.id] ? 'disabled' : ''}>🤝 Tawar · Bargain</button><button class="mBtn primary" data-a="buy">🛒 Beli · Buy</button></div></div>`);
      else if (S.st === 'pay') { const p = S.paying, given = p.notes.reduce((a, b) => a + b, 0);
        hud.html(`<div class="mTop"><div class="bubble">Harga · Price <b>${rm(p.price)}</b>. Pilih duit dari dompet · Pick money from your wallet.</div><div class="till">Bayar · Paying: <b>${rm(given)}</b></div></div>
        <div class="mBot"><div class="mRow">${S.wallet.map((v, k) => `<button class="money" data-w="${k}">${rm(v)}</button>`).join('') || '<small>Dompet kosong!</small>'}</div><div class="mRow"><button class="mBtn" data-a="cancel">↩️ Batal</button><button class="mBtn primary" data-a="paynow">💵 Bayar</button></div></div>`); }
      return bind();
    }
  }
  function bind() {
    hud.el.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { sfx.tap(); S.role = b.dataset.r; api.tools([]); if (S.role === 'seller') { api.step('Ikut pesanan, serah makanan, kemudian beri baki yang tepat', 'Follow the order, hand over the food, then give the exact change'); newCustomer(); } else { api.step('Beli semua barang dalam senarai. Cuba tawar harga!', 'Buy everything on the list. Try bargaining!'); startBuyer(); } fx.role && fx.role(S.role); });
    hud.el.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { const id = b.dataset.f; S.tray[id] = (S.tray[id] || 0) + 1; sfx.pop(); fx.serve && fx.serve(id); render(); });
    hud.el.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { S.change += +b.dataset.m; sfx.coin ? sfx.coin() : sfx.pop(); render(); });
    hud.el.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { const k = +b.dataset.w; S.paying.notes.push(S.wallet[k]); S.wallet.splice(k, 1); sfx.pop(); render(); });
    hud.el.querySelectorAll('[data-a]').forEach(b => b.onclick = () => act(b.dataset.a));
  }
  function act(a) {
    sfx.tap(); const c = S.cust;
    if (a === 'clear') { S.tray = {}; }
    else if (a === 'give') { if (same(S.tray, c.order)) { if (c.pay === c.total) return paid(); S.st = 'change'; S.change = 0; fx.pay && fx.pay(c.pay); } else { S.mistakes++; sfx.bad(); toast('Pesanan tak sama! Semak semula.', "That's not the order! Check again."); S.tray = {}; } }
    else if (a === 'reset') S.change = 0;
    else if (a === 'pay') { if (S.change === c.pay - c.total) return paid(); S.mistakes++; sfx.bad(); toast(S.change < c.pay - c.total ? 'Baki tak cukup!' : 'Baki terlebih!', S.change < c.pay - c.total ? 'Not enough change!' : 'Too much change!'); S.change = 0; }
    else if (a === 'prev' || a === 'next') { S.stall = (S.stall + (a === 'next' ? 1 : FOODS.length - 1)) % FOODS.length; fx.stall && fx.stall(S.stall); }
    else if (a === 'haggle') { const f = FOODS[S.stall]; if (rnd() < .6) { S.bargained[f.id] = 'ok'; toast('“Okay lah, kurang seringgit.”', '"Okay, one ringgit off."'); sfx.good(); } else { S.bargained[f.id] = 'no'; toast('“Harga tetap, dik.”', '"Fixed price, kid."'); } }
    else if (a === 'buy') { const f = FOODS[S.stall], price = f.price * (f.id === 'satay' ? 5 : 1) - (S.bargained[f.id] === 'ok' ? 1 : 0); if (S.bought.includes(f.id)) { toast('Dah beli yang ni', 'Already bought this'); } else { S.paying = { id: f.id, price, notes: [] }; S.st = 'pay'; } }
    else if (a === 'cancel') { S.wallet.push(...S.paying.notes); S.wallet.sort((x, y) => y - x); S.paying = null; S.st = 'shop'; }
    else if (a === 'paynow') { const p = S.paying, given = p.notes.reduce((x, y) => x + y, 0);
      if (given < p.price) { sfx.bad(); toast('Duit tak cukup!', 'Not enough money!'); }
      else { let ch = given - p.price; for (const v of [10, 5, 1]) while (ch >= v) { S.wallet.push(v); ch -= v; } S.wallet.sort((x, y) => y - x); S.spent += p.price;
        const onList = S.list.some(it => it.id === p.id); S.bought.push(p.id); if (!onList) { S.mistakes++; toast('Eh, ni tak ada dalam senarai!', "Oops, that wasn't on the list!"); } else { sfx.good(); const got = S.bought.filter(id => S.list.some(it => it.id === id)).length; api.progress(got / S.goal); fx.bought && fx.bought(p.id);
          if (got >= S.goal) { S.st = 'done'; const left = S.wallet.reduce((x, y) => x + y, 0), haggled = Object.values(S.bargained).includes('ok'); hud.html(`<div class="mCard"><h3>Semua dah beli! 🎉</h3><p>Belanja · Spent ${rm(S.spent)} · Baki · Left ${rm(left)}</p></div>`); setTimeout(() => api.finish({ stars: S.mistakes === 0 && haggled ? 3 : S.mistakes <= 1 ? 2 : 1, spent: S.spent }), 1400); return; } }
        S.paying = null; S.st = 'shop'; } }
    render();
  }
  function paid() {
    const c = S.cust, fast = S.patience > .5; S.served++; S.earned += c.total; if (fast) { S.tips++; S.earned += 1; }
    sfx.good(); api.progress(S.served / S.goal); fx.paid && fx.paid(fast); toast(fast ? `${c.name}: “Terima kasih! Simpan baki seringgit.”` : `${c.name}: “Terima kasih.”`, fast ? 'Thanks! Keep RM1 as a tip.' : 'Thanks.');
    if (S.served >= S.goal) { S.st = 'done'; hud.html(`<div class="mCard"><h3>Gerai tutup! 🎉</h3><p>Jualan · Sales ${rm(S.earned)} · Tip ${S.tips}</p></div>`); setTimeout(() => api.finish({ stars: S.mistakes === 0 ? 3 : S.mistakes <= 2 ? 2 : 1, earned: S.earned }), 1400); return; }
    S.cust = null; render(); setTimeout(newCustomer, 900);
  }
  api.step('Pilih: jadi peniaga atau pembeli', 'Choose: be a seller or a buyer'); render();
  return {
    S, act, pick(role) { S.role = role; if (role === 'seller') newCustomer(); else startBuyer(); },
    down() {}, move() {}, up() {},
    update(dt) { if (S.role === 'seller' && (S.st === 'order' || S.st === 'change')) { const before = S.patience; S.patience = Math.max(0, S.patience - dt / 30); const bar = hud.el.querySelector('.pat i'); if (bar) bar.style.width = `${S.patience * 100}%`; if (before > 0 && S.patience <= 0) toast('Cepat sikit, dik!', 'Hurry up!'); } },
    stop() { hud.remove(); },
  };
}
export function Market(api, opts) {
  let role = null, stall = 0, cust = null, t = 0;
  const core = marketCore(api, opts, { role(r) { role = r; }, stall(k) { stall = k; }, customer(c) { cust = c; } });
  return {
    dbg: () => ({ ...core.S }),
    down() {}, move() {}, up() {},
    update(dt) { t += dt; core.update(dt); },
    draw(c) {
      c.fillStyle = '#0d1530'; c.fillRect(0, 0, VW, VH);
      for (let k = 0; k < 40; k++) { c.fillStyle = `hsl(${(k * 47) % 360},90%,${60 + Math.sin(t * 3 + k) * 15}%)`; c.beginPath(); c.arc(25 * k, 40 + Math.sin(k) * 10, 5, 0, 7); c.fill(); }
      for (let k = 0; k < 3; k++) { const x = 120 + k * 290; c.fillStyle = ['#c0392b', '#2e86de', '#27ae60'][k]; c.beginPath(); c.moveTo(x - 20, 150); c.lineTo(x + 120, 90); c.lineTo(x + 260, 150); c.fill(); c.fillStyle = '#5d4037'; c.fillRect(x, 260, 240, 90); c.fillStyle = '#ffeaa7'; c.font = '44px system-ui'; c.textAlign = 'center'; c.fillText(FOODS[(stall + k) % FOODS.length].ic, x + 120, 240); }
      if (role === 'seller' && cust) { c.font = '120px system-ui'; c.fillText('🧑', 500, 470); }
    },
    stop() { core.stop(); },
  };
}

// ============================================================ 6. MALL — misi beli-belah (find the things on your list, then pay)
export const MALL_ITEMS = [
  { id: 'roti', bm: 'Roti', en: 'Bread', ic: '🍞', price: 4, model: 'shop/display-bread' }, { id: 'buah', bm: 'Buah-buahan', en: 'Fruit', ic: '🍎', price: 8, model: 'shop/display-fruit' },
  { id: 'tin', bm: 'Makanan tin', en: 'Tinned food', ic: '🥫', price: 6, model: 'shop/display-cans' }, { id: 'bunga', bm: 'Bunga', en: 'Flowers', ic: '💐', price: 12, model: 'shop/display-flowers' },
  { id: 'baju', bm: 'Baju raya', en: 'Clothes', ic: '👕', price: 25, model: 'shop/clothing-rack' }, { id: 'kotak', bm: 'Bijirin', en: 'Cereal', ic: '📦', price: 9, model: 'shop/shelf-boxes' },
  { id: 'beg', bm: 'Beg', en: 'Bags', ic: '👜', price: 15, model: 'shop/shelf-bags' }, { id: 'ais', bm: 'Ais krim', en: 'Ice cream', ic: '🍦', price: 5, model: 'shop/freezers-standing' },
  { id: 'gacha', bm: 'Mainan gacha', en: 'Gacha toy', ic: '🎁', price: 3, model: 'shop/gacha-machine' }, { id: 'kain', bm: 'Kain pelikat', en: 'Sarong', ic: '🧣', price: 18, model: 'shop/clothing-table' },
];
export function mallCore(api, opts, fx = {}) {
  const S = { list: MALL_ITEMS.slice().sort(() => rnd() - .5).slice(0, 5).map(i => i.id), got: [], mistakes: 0, st: 'shop', total: 0 };
  const hud = actHud(); const I = Object.fromEntries(MALL_ITEMS.map(i => [i.id, i]));
  const draw = () => hud.html(`<div class="score">🛒 ${S.list.map(id => `<span style="opacity:${S.got.includes(id) ? .45 : 1}">${S.got.includes(id) ? '✅' : I[id].ic} ${I[id].bm}</span>`).join(' · ')}</div>${S.st === 'pay' ? `<div class="big small">Jumlah RM${S.total} — pergi ke kaunter 💳</div>` : ''}`);
  api.step('Cari barang dalam senarai: seret untuk pusing, ketik rak untuk ambil', 'Find the things on your list: drag to look around, tap a shelf to pick it up'); draw();
  return {
    S, I,
    pick(id) {
      if (S.st === 'done') return;
      if (id === 'kaunter') { if (S.st !== 'pay') { toast('Cari semua barang dulu!', 'Find everything first!'); return; } S.st = 'done'; sfx.coin ? sfx.coin() : sfx.good(); api.progress(1); fx.paid && fx.paid(); hud.html(`<div class="big small">Terima kasih! Jumlah RM${S.total} 🧾</div>`); const t = api.elapsed(); setTimeout(() => api.finish({ stars: S.mistakes === 0 && t < 90 ? 3 : S.mistakes <= 2 ? 2 : 1, total: S.total }), 1200); return; }
      if (!I[id]) return;
      if (S.got.includes(id)) { toast('Dah ambil yang ni', 'Already got this'); return; }
      if (!S.list.includes(id)) { S.mistakes++; sfx.bad(); toast(`${I[id].bm} tak ada dalam senarai`, `${I[id].en} isn't on your list`); return; }
      S.got.push(id); S.total += I[id].price; sfx.good(); fx.got && fx.got(id); api.progress(S.got.length / (S.list.length + 1));
      if (S.got.length === S.list.length) { S.st = 'pay'; api.step('Semua dah ada! Ketik kaunter bayaran 💳', 'Got everything! Tap the checkout counter 💳'); fx.pay && fx.pay(); }
      draw();
    },
    stop() { hud.remove(); },
  };
}
export function Mall(api, opts) {
  const core = mallCore(api, opts); const cells = [...MALL_ITEMS.map(i => i.id), 'kaunter'];
  const cellAt = (x, y) => { const c = Math.floor((x - 40) / 186), r = Math.floor((y - 120) / 220); const k = r * 5 + c; return c >= 0 && c < 5 && r >= 0 && r < 2 ? cells[k] : (y > 560 ? 'kaunter' : null); };
  return {
    dbg: () => ({ ...core.S }),
    down(p) { const id = cellAt(p.x, p.y); if (id) core.pick(id); }, move() {}, up() {},
    update() {},
    draw(c) {
      c.fillStyle = '#f4efe6'; c.fillRect(0, 0, VW, VH); c.fillStyle = '#8e44ad'; c.fillRect(0, 0, VW, 90); c.fillStyle = '#fff'; c.font = '900 34px system-ui'; c.textAlign = 'center'; c.fillText('DAMAI CITY MALL', 500, 58);
      c.textBaseline = 'middle';
      MALL_ITEMS.forEach((it, k) => { const x = 40 + (k % 5) * 186, y = 120 + Math.floor(k / 5) * 220, got = core.S.got.includes(it.id); c.fillStyle = got ? '#d5f5e3' : '#fff'; c.beginPath(); c.roundRect(x + 6, y + 6, 172, 200, 14); c.fill(); c.font = '80px system-ui'; c.fillText(it.ic, x + 92, y + 90); c.fillStyle = '#333'; c.font = '700 18px system-ui'; c.fillText(it.bm, x + 92, y + 170); });
      c.fillStyle = core.S.st === 'pay' ? '#27ae60' : '#95a5a6'; c.beginPath(); c.roundRect(300, 560, 400, 36, 10); c.fill(); c.fillStyle = '#fff'; c.font = '800 18px system-ui'; c.fillText('💳 KAUNTER BAYARAN · CHECKOUT', 500, 578); c.textBaseline = 'alphabetic';
    },
    stop() { core.stop(); },
  };
}

export const ACTIVITIES = {
  futsal: { bm: 'Futsal', en: 'Futsal penalties', ic: '⚽', place: 'futsal', title: 'Sepakan Penalti Futsal' },
  volley: { bm: 'Bola Tampar Pantai', en: 'Beach volleyball 2v2', ic: '🏐', place: 'volley', title: 'Bola Tampar Pantai 2v2' },
  photo: { bm: 'Studio Foto 3D', en: '3D photo studio', ic: '📸', place: 'photo', title: 'Simulator Foto 3D' },
  drag: { bm: 'Lumba Drag', en: 'Drag race', ic: '🏁', place: 'drag', title: 'Lumba Drag 402m' },
  market: { bm: 'Pasar Malam', en: 'Night market', ic: '🏮', place: 'pasar', title: 'Pasar Malam' },
  mall: { bm: 'Beli-belah di Mall', en: 'Mall shopping', ic: '🛍️', place: 'mall', title: 'Misi Beli-belah · Damai City Mall' },
  karaoke: { bm: 'Karaoke', en: 'Karaoke night', ic: '🎤', place: 'balai', title: 'Karaoke Balai Raya' },
};
