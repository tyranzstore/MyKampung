// PERLAWANAN 3V3 — arcade street futsal for the Gelanggang Futsal.
// Everything here is renderer-independent:
//   matchCore()   rules, ball physics (spring dribble, spin/curve, bounce, rebounds, deflections), possession,
//                 passing (ground + through balls), charged shots synced to the kick animation, timing-based tackles,
//                 player AI (support runs, spacing, lane closing, marking, goal guard), kickoffs, timer, scoring
//   f3Controls()  compact HUD + translucent joystick + action buttons (multitouch) + keyboard + pause/settings/results
//   f3Session()   per-match flow shared by the 3D scene (futsal3d.js) and the 2D fallback below
import { $, clamp, sfx, S, save } from './core.js';

export const F3 = { L: 12, W: 7, GW: 1.5, GH: 2.0, MATCH: 180, R: .11 };
const TEAM = ['MYKAMPUNG', 'LAWAN'];
const hyp = Math.hypot, rnd = Math.random;
const fmt = (t) => { t = Math.max(0, Math.ceil(t)); return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
function segDist(px, pz, ax, az, bx, bz) { const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1; const t = clamp(((px - ax) * dx + (pz - az) * dz) / L2, 0, 1); return hyp(px - (ax + dx * t), pz - (az + dz * t)); }
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

// player-tunable settings, saved with the game (S.f3set)
export function f3Settings() { const s = (S.f3set ||= {}); s.zoom ??= 1; s.assist ??= 1; s.dead ??= .14; return s; }
const ASSIST = [{ pass: .55, shot: 1, name: 'Mati · Off' }, { pass: 1, shot: .65, name: 'Biasa · Normal' }, { pass: 1.6, shot: .4, name: 'Kuat · Strong' }];

// ============================================================ MATCH CORE
export function matchCore(opts = {}, fx = {}) {
  const { L, W, GW, GH } = F3, set = f3Settings();
  const NUMS = [[7, 10, 4], [9, 8, 5]];
  const mk = (team, k) => ({ id: team * 3 + k, team, k, num: NUMS[team][k], x: 0, z: 0, vx: 0, vz: 0, dir: team ? Math.PI : 0, turn: 0, stam: 1, kickCD: 0, tackleCD: 0, stun: 0, skillT: 0, skillCD: 0, act: null, pending: null, celebrate: 0, think: 0, wx: 0, wz: 0, sprinting: false });
  const M = {
    st: 'kickoff', t: 0, clock: opts.matchTime || F3.MATCH, len: opts.matchTime || F3.MATCH, score: [0, 0], players: [0, 1, 2, 3, 4, 5].map(i => mk(i < 3 ? 0 : 1, i % 3)),
    ball: { x: 0, z: 0, y: F3.R, vx: 0, vz: 0, vy: 0, owner: null, last: 0, spin: 0, curve: 0, touch: 0 },
    ctl: 0, kickTeam: 0, wait: 1.6, paused: false, msg: '', msgT: 0, stats: { shots: [0, 0], passes: [0, 0], tackles: [0, 0] },
    input: { x: 0, z: 0, sprint: false }, charge: -1, passHold: -1, runTo: null, poss: 0,
  };
  const P = M.players, B = M.ball;
  const mates = (p) => P.filter(q => q.team === p.team && q !== p), foes = (p) => P.filter(q => q.team !== p.team);
  const sgn = (team) => team === 0 ? 1 : -1;
  const say = (m, t = 1.6) => { M.msg = m; M.msgT = t; fx.msg && fx.msg(m); };
  const setAct = (p, type, dur) => { p.act = { type, t: 0, dur }; };

  function kickoff(team) {
    M.st = 'kickoff'; M.wait = 1.4; M.kickTeam = team; M.runTo = null;
    const spots = [[[-.55, 0], [-4.5, -3.2], [-6.5, 2.6]], [[-3.6, 0], [-6.2, -3.2], [-7.6, 3]]];
    for (const p of P) { const s = sgn(p.team), sp = spots[p.team === team ? 0 : 1][p.k]; p.x = sp[0] * s; p.z = sp[1]; p.vx = p.vz = 0; p.dir = p.team ? Math.PI : 0; p.stun = p.celebrate = p.skillT = 0; p.kickCD = 0; p.act = null; p.pending = null; }
    B.x = 0; B.z = 0; B.y = F3.R; B.vx = B.vz = B.vy = 0; B.owner = null; B.curve = 0;
    if (team === 0) M.ctl = 0;
  }
  function reset() { M.score = [0, 0]; M.clock = M.len; M.t = 0; M.stats = { shots: [0, 0], passes: [0, 0], tackles: [0, 0] }; M.result = null; kickoff(0); say('SEPAK MULA!', 1.2); }
  reset();

  // ------------------------------------------------------------ ball actions (the ball leaves the foot on the contact frame of the kick animation)
  function release(p, vx, vz, vy = 0, curve = 0) { B.owner = null; B.vx = vx; B.vz = vz; B.vy = vy; B.curve = curve; B.last = p.team; p.kickCD = .3; B.spin = hyp(vx, vz); sfx.kick && sfx.kick(); fx.kick && fx.kick(p); }
  function queue(p, type, dur, delay, fn) { if (p.pending) return; setAct(p, type, dur); p.pending = { t: delay, fn }; }
  function pickReceiver(p, hx, hz, assist) {
    let best = null, bs = -1e9;
    for (const m of mates(p)) {
      const dx = m.x - p.x, dz = m.z - p.z, d = hyp(dx, dz) || 1, align = (dx * hx + dz * hz) / d;
      if (assist < .8 && align < .5) continue;
      let block = 0; for (const f of foes(p)) block += Math.max(0, 1.4 - segDist(f.x, f.z, p.x, p.z, m.x, m.z));
      const sc = align * 3.2 / assist - d * .07 - block * 2 + (m.x - p.x) * sgn(p.team) * .06;
      if (sc > bs) { bs = sc; best = m; }
    }
    return best;
  }
  function passFrom(p, dirX, dirZ, through = false, assist = 1) {
    const dl = hyp(dirX, dirZ), hx = dl > .2 ? dirX / dl : Math.cos(p.dir), hz = dl > .2 ? dirZ / dl : Math.sin(p.dir);
    const m = pickReceiver(p, hx, hz, assist);
    if (!m) { // no one in that direction: knock it into space
      queue(p, 'pass', .34, .12, () => release(p, hx * 9, hz * 9, 0)); return true;
    }
    let tx, tz;
    if (through) { const s = sgn(p.team); tx = clamp(m.x + s * 3.6, -L + 1, L - 1); tz = clamp(m.z * .8 + (m.vz || 0) * .3, -W + 1, W - 1); M.runTo = { id: m.id, x: tx, z: tz, t: 2.2 }; }
    else { tx = m.x + m.vx * .3; tz = m.z + m.vz * .3; }
    const dx = tx - p.x, dz = tz - p.z, d = hyp(dx, dz) || 1, sp = clamp(d * 1.45 + (through ? 4 : 5.5), 7.5, 15.5);
    queue(p, 'pass', .34, .12, () => { const ddx = tx - p.x, ddz = tz - p.z, dd = hyp(ddx, ddz) || 1; release(p, ddx / dd * sp, ddz / dd * sp, d > 10 ? 2.3 : 0); M.stats.passes[p.team]++; if (p.team === 0) M.passTo = m; });
    return true;
  }
  function shootFrom(p, power, aimZ, curve = 0, assist = .65) {
    const s = sgn(p.team), gx = s * L;
    queue(p, 'shoot', .45, .16, () => {
      const d = hyp(gx - p.x, p.z);
      let tz = aimZ !== undefined ? aimZ : (() => { // aim away from the nearest defender to the goal
        const guard = foes(p).sort((a, b) => Math.abs(a.x - gx) - Math.abs(b.x - gx))[0]; return guard && Math.abs(guard.x - gx) < 4 ? -Math.sign(guard.z || rnd() - .5) * (GW - .35) : -Math.sign(p.z || rnd() - .5) * (GW - .4); })();
      const spread = (.14 + Math.max(0, power - .85) * 2 + d * .022) * (p.team === 0 ? assist : 1.15);
      tz += (rnd() - .5) * 2 * spread;
      const dx = gx - p.x, dz = tz - p.z, dd = hyp(dx, dz) || 1, sp = 11.5 + power * 12;
      const loft = .35 + power * 2 + (power > .94 ? 2.4 : 0) + (rnd() - .5) * .5;
      release(p, dx / dd * sp, dz / dd * sp, loft, curve); M.stats.shots[p.team]++; fx.shot && fx.shot(p, power);
    });
  }
  // tackles are resolved over time: the tackler lunges and wins the ball only if the foot actually reaches it
  function tackle(p, ai) {
    if (p.tackleCD > 0 || p.stun > 0 || p.act) return false;
    const slide = !ai ? p.sprinting : rnd() < .25;
    p.tackleCD = ai ? 1.6 : .7; setAct(p, slide ? 'slide' : 'poke', slide ? .7 : .38);
    const c = B.owner; if (c && c.team !== p.team) p.dir = Math.atan2(B.z - p.z, B.x - p.x);
    return true;
  }
  function resolveTackle(p) {
    const a = p.act; if (!a || (a.type !== 'slide' && a.type !== 'poke') || a.won) return;
    const reach = a.type === 'slide' ? .95 : .7, fxp = p.x + Math.cos(p.dir) * reach * .7, fzp = p.z + Math.sin(p.dir) * reach * .7;
    const c = B.owner; if (!c || c.team === p.team) { if (!c && hyp(fxp - B.x, fzp - B.z) < .5 && B.y < .5) { B.owner = p; B.last = p.team; a.won = true; if (p.team === 0) M.ctl = p.id; } return; }
    if (a.t > a.dur * .75) return;
    if (hyp(fxp - B.x, fzp - B.z) < (a.type === 'slide' ? .62 : .5)) {
      a.won = true;
      if (c.skillT > 0 && rnd() < .8) { p.stun = .5; return; } // skill move beats the tackle
      const front = Math.abs(angDiff(Math.atan2(p.z - c.z, p.x - c.x), c.dir)) < 1.2;
      const ok = rnd() < (front ? .85 : .6) * (p.team === 1 ? .62 : 1);
      if (!ok) { p.stun = a.type === 'slide' ? .7 : .35; return; }
      M.stats.tackles[p.team]++; c.stun = .55; c.kickCD = .45; sfx.hammer();
      if (a.type === 'poke' && rnd() < .6) { B.owner = p; B.last = p.team; if (p.team === 0) M.ctl = p.id; }
      else { B.owner = null; B.vx = Math.cos(p.dir) * 4 + (rnd() - .5) * 2; B.vz = Math.sin(p.dir) * 4 + (rnd() - .5) * 2; B.vy = .8; B.last = p.team; }
      fx.tackle && fx.tackle(p, true);
    }
  }
  function skill(p) { if (p.skillCD > 0) return; p.skillT = .55; p.skillCD = 4; const side = rnd() < .5 ? -1 : 1; p.dir += side * .75; setAct(p, 'skill', .45); fx.skill && fx.skill(p); }

  // ------------------------------------------------------------ human input
  const act = {
    passDown() { const p = P[M.ctl]; if (M.st !== 'play') return; if (B.owner === p) M.passHold = 0; else tackle(p, false); },
    passUp() { const p = P[M.ctl]; if (M.passHold >= 0 && B.owner === p && M.st === 'play') passFrom(p, M.input.x, M.input.z, M.passHold > .28, ASSIST[set.assist].pass); M.passHold = -1; },
    shootDown() { const p = P[M.ctl]; if (M.st !== 'play') return; if (B.owner === p) M.charge = 0; else switchCtl(); },
    shootUp() { const p = P[M.ctl]; if (M.charge >= 0 && B.owner === p && M.st === 'play') { const ix = M.input.x, iz = M.input.z; const aim = Math.abs(iz) > .25 ? clamp(iz * 1.4, -1, 1) * (GW - .3) : undefined; const curve = clamp(-iz * sgn(0) * 2.2, -2.5, 2.5) * (Math.abs(iz) > .25 ? 1 : 0); shootFrom(p, clamp(M.charge, .15, 1), aim, curve, ASSIST[set.assist].shot); } M.charge = -1; },
    skill() { const p = P[M.ctl]; if (M.st === 'play') skill(p); },
    switch: () => switchCtl(),
    // legacy names (used by older callers/tests)
    pass() { this.passDown(); this.passUp(); },
  };
  function switchCtl() { let best = M.ctl, bd = 1e9; for (const p of P) if (p.team === 0 && p.id !== M.ctl) { const d = hyp(p.x - B.x, p.z - B.z); if (d < bd) { bd = d; best = p.id; } } M.ctl = best; sfx.tap(); fx.switch && fx.switch(best); }

  // ------------------------------------------------------------ AI
  function aiTeam(team) {
    const s = sgn(team), my = P.filter(p => p.team === team), opp = P.filter(p => p.team !== team);
    const owner = B.owner, ownGoalX = -s * L;
    const pred = { x: B.x + B.vx * .35, z: B.z + B.vz * .35 };
    const free = my.filter(p => !(team === 0 && p.id === M.ctl));
    const roles = new Map();
    if (owner && owner.team === team) {
      // attack: one forward run into space, one support option; never on top of each other or the carrier
      const lane = owner.z > 0 ? -1 : 1;
      const spots = [[clamp(owner.x + s * 5, -L + 1.5, L - 1.2), lane * 3.8], [clamp(owner.x - s * 2.6, -L + 1.5, L - 1.5), clamp(owner.z + (owner.z > 0 ? -1 : 1) * 2.6, -W + 1, W - 1)]];
      for (const sp of spots) for (const f of opp) { const d = hyp(f.x - sp[0], f.z - sp[1]); if (d < 1.8) { sp[1] = clamp(sp[1] + (sp[1] > f.z ? 1 : -1) * (1.8 - d), -W + 1, W - 1); } } // step out of a marker's shadow
      const sup = free.filter(p => p !== owner);
      sup.sort((a, b) => hyp(a.x - spots[0][0], a.z - spots[0][1]) - hyp(b.x - spots[0][0], b.z - spots[0][1]));
      sup.forEach((p, i) => roles.set(p, M.runTo && M.runTo.id === p.id ? { kind: 'run', x: M.runTo.x, z: M.runTo.z } : { kind: 'support', x: spots[i] ? spots[i][0] : owner.x, z: spots[i] ? spots[i][1] : 0 }));
      if (!(team === 0 && owner.id === M.ctl)) roles.set(owner, { kind: 'carry' });
    } else if (owner) {
      // defence: one presser, one goal guard, one lane-closing marker
      const pool = free.slice(); let presser = null;
      pool.sort((a, b) => hyp(a.x - owner.x, a.z - owner.z) - hyp(b.x - owner.x, b.z - owner.z));
      if (team === 1) presser = pool.shift();
      else { const h = P[M.ctl], hd = hyp(h.x - owner.x, h.z - owner.z); if (pool[0] && hyp(pool[0].x - owner.x, pool[0].z - owner.z) < hd - 3.5) presser = pool.shift(); }
      if (presser) roles.set(presser, { kind: 'press' });
      pool.sort((a, b) => Math.abs(a.x - ownGoalX) - Math.abs(b.x - ownGoalX));
      if (pool[0]) roles.set(pool[0], { kind: 'guard' });
      if (pool[1]) { const threats = opp.filter(o => o !== owner).sort((a, b) => Math.abs(a.x - ownGoalX) - Math.abs(b.x - ownGoalX)); roles.set(pool[1], { kind: 'mark', who: threats[0] }); }
    } else {
      const cands = team === 0 ? my : free; let ch = null, cd = 1e9;
      for (const p of cands) { const d = hyp(p.x - pred.x, p.z - pred.z) + (p.stun > 0 ? 4 : 0); if (d < cd) { cd = d; ch = p; } }
      for (const p of free) roles.set(p, p === ch ? { kind: 'chase' } : { kind: 'shape' });
    }
    for (const [p, r] of roles) brain(p, r, s, ownGoalX, pred);
  }
  function brain(p, r, s, ownGoalX, pred) {
    const base = p.team === 1 ? 4.7 : 5; let tx = p.x, tz = p.z, sp = base * .85; p.sprinting = false;
    if (r.kind === 'carry') {
      if (p.pending) { p.wx = p.wz = 0; return; }
      p.think -= M.dt; const gx = s * L, dG = hyp(gx - p.x, p.z), fo = foes(p);
      const near = fo.reduce((m, f) => Math.min(m, hyp(f.x - p.x, f.z - p.z)), 1e9);
      if (p.think <= 0) {
        p.think = .25 + rnd() * .2;
        const lane = fo.reduce((m, f) => Math.min(m, segDist(f.x, f.z, p.x, p.z, gx, 0)), 1e9);
        if (dG < 4.5 || (dG < 9.5 && lane > 1 && rnd() < .5) || (dG < 7 && rnd() < .2)) { shootFrom(p, .55 + rnd() * .3, undefined, (rnd() - .5) * 2); return; }
        if (near < 1.8 && rnd() < .7) { passFrom(p, s, 0, rnd() < .3, 1.2); return; }
        if (dG > 10 && rnd() < .12) { passFrom(p, s, 0, true, 1.2); return; }
        if (near < 1.4 && p.skillCD <= 0 && rnd() < .25) skill(p);
      }
      let dx = gx - p.x, dz = -p.z * .45; const dl = hyp(dx, dz) || 1; dx /= dl; dz /= dl;
      for (const f of fo) { const ax = p.x - f.x, az = p.z - f.z, d = hyp(ax, az); if (d < 3) { dx += ax / d * (3 - d) * .4; dz += az / d * (3 - d) * .75; } }
      tx = p.x + dx * 3; tz = p.z + dz * 3; sp = base * (near > 3 ? 1.15 : .95); p.sprinting = near > 3;
    } else if (r.kind === 'run') { tx = r.x; tz = r.z; sp = base * 1.3; p.sprinting = true; }
    else if (r.kind === 'support') { tx = r.x; tz = r.z; sp = base * (hyp(tx - p.x, tz - p.z) > 4 ? 1.15 : .85); }
    else if (r.kind === 'press') { const o = B.owner, gx = ownGoalX, d = hyp(gx - o.x, o.z) || 1; tx = o.x + (gx - o.x) / d * .7; tz = o.z + (-o.z) / d * .7; sp = base * 1.08;
      const dd = hyp(o.x - p.x, o.z - p.z); if (dd < 1.25 && p.tackleCD <= 0 && rnd() < M.dt * 2.2) tackle(p, true); }
    else if (r.kind === 'guard') { const bx = B.x - ownGoalX, bz = B.z, d = hyp(bx, bz) || 1; tx = ownGoalX + bx / d * 2.3; tz = bz / d * 2.3; sp = base * 1.05; }
    else if (r.kind === 'mark') { const o = r.who; if (o) { const gx = ownGoalX, d = hyp(gx - o.x, o.z) || 1; const lx = o.x + (gx - o.x) / d * 1.1, lz = o.z + (-o.z) / d * 1.1; tx = lx + (B.x - lx) * .3; tz = lz + (B.z - lz) * .3; } sp = base * .98; } // between the man and the ball: closes the passing lane
    else if (r.kind === 'chase') { tx = pred.x; tz = pred.z; sp = base * 1.12; p.sprinting = true; }
    else { const k = p.k, sx = sgn(p.team); tx = clamp(B.x * .55 - sx * (k === 0 ? 1.5 : 4.5), -L + 1, L - 1); tz = k === 1 ? -3.4 : k === 2 ? 3.4 : clamp(B.z * .5, -2, 2); sp = base * .85; }
    // spacing: keep 3 m from team-mates so they never cluster
    for (const m of mates(p)) { const ax = tx - m.x, az = tz - m.z, d = hyp(ax, az); if (d < 3 && d > .01 && r.kind !== 'chase' && r.kind !== 'press') { tx += ax / d * (3 - d) * .6; tz += az / d * (3 - d) * .6; } }
    tx = clamp(tx, -L + .5, L - .5); tz = clamp(tz, -W + .5, W - .5);
    steer(p, tx - p.x, tz - p.z, sp);
  }
  function steer(p, dx, dz, sp) { const d = hyp(dx, dz); if (d < .15) { p.wx = 0; p.wz = 0; return; } const k = Math.min(1, d / .9); p.wx = dx / d * sp * k; p.wz = dz / d * sp * k; }

  // ------------------------------------------------------------ simulation
  function step(dt) {
    M.dt = dt;
    for (const p of P) { p.kickCD -= dt; p.tackleCD -= dt; p.stun -= dt; p.skillT -= dt; p.skillCD -= dt; p.celebrate -= dt;
      if (p.act) { p.act.t += dt; if (p.act.t >= p.act.dur) p.act = null; }
      if (p.pending) { p.pending.t -= dt; if (p.pending.t <= 0) { const f = p.pending.fn; p.pending = null; if (B.owner === p) f(); } } }
    for (const p of P) { p.wx = 0; p.wz = 0; }
    if (M.runTo) { M.runTo.t -= dt; if (M.runTo.t <= 0) M.runTo = null; }
    if (M.st === 'play') {
      const h = P[M.ctl], ix = M.input.x, iz = M.input.z, il = hyp(ix, iz);
      h.sprinting = M.input.sprint && h.stam > .05 && il > .1; const top = h.skillT > 0 ? 8.4 : h.sprinting ? 7.3 : 5.3;
      if (il > .05) { const k = Math.min(1, il); h.wx = ix / il * top * k; h.wz = iz / il * top * k; }
      if (h.skillT > 0 && il <= .05) { h.wx = Math.cos(h.dir) * 8.4; h.wz = Math.sin(h.dir) * 8.4; }
      h.stam = clamp(h.stam + (h.sprinting ? -.26 : .15) * dt, 0, 1);
      aiTeam(0); aiTeam(1);
      if (M.charge >= 0) M.charge = Math.min(1, M.charge + dt / .85);
      if (M.passHold >= 0) M.passHold += dt;
    }
    for (const p of P) {
      let wx = p.wx, wz = p.wz;
      if (p.stun > 0) { wx *= .1; wz *= .1; }
      if (p.pending) { wx *= .35; wz *= .35; }
      if (p.act && (p.act.type === 'slide' || p.act.type === 'poke')) { const f = p.act.type === 'slide' ? Math.max(0, 1 - p.act.t / p.act.dur) * 9 : (p.act.t < .2 ? 6 : 0); wx = Math.cos(p.dir) * f; wz = Math.sin(p.dir) * f; }
      if (B.owner === p) { wx *= .92; wz *= .92; }
      const acc = (p.act && p.act.type === 'slide' ? 60 : 30) * dt; p.vx += clamp(wx - p.vx, -acc, acc); p.vz += clamp(wz - p.vz, -acc, acc);
      p.x += p.vx * dt; p.z += p.vz * dt; p.x = clamp(p.x, -L + .35, L - .35); p.z = clamp(p.z, -W + .35, W - .35);
      const sp = hyp(p.vx, p.vz); const old = p.dir;
      if (sp > .35 && !(p.act && (p.act.type === 'slide' || p.act.type === 'poke'))) { const want = Math.atan2(p.vz, p.vx); p.dir += angDiff(want, p.dir) * Math.min(1, dt * (B.owner === p ? 10 : 13)); }
      p.turn = angDiff(p.dir, old) / Math.max(dt, 1e-3);
      resolveTackle(p);
    }
    for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) { const a = P[i], b = P[j], dx = b.x - a.x, dz = b.z - a.z, d = hyp(dx, dz); if (d < .75 && d > 1e-4) { const push = (.75 - d) / 2; a.x -= dx / d * push; a.z -= dz / d * push; b.x += dx / d * push; b.z += dz / d * push; } }
    // ball
    if (B.owner) {
      // spring dribble: the ball is nudged ahead with each stride and chased by the carrier
      const o = B.owner, spd = hyp(o.vx, o.vz), ahead = .45 + Math.min(.5, spd * .07) + Math.max(0, Math.sin(M.t * (6 + spd * 1.6))) * Math.min(.25, spd * .04);
      const tx = o.x + Math.cos(o.dir) * ahead, tz = o.z + Math.sin(o.dir) * ahead, k = Math.min(1, dt * 16);
      const nx = B.x + (tx - B.x) * k, nz = B.z + (tz - B.z) * k; B.vx = (nx - B.x) / dt; B.vz = (nz - B.z) / dt; B.x = nx; B.z = nz; B.y = F3.R; B.vy = 0; B.spin = hyp(B.vx, B.vz); B.curve = 0;
    } else {
      B.vy -= 9.8 * dt; B.x += B.vx * dt; B.z += B.vz * dt; B.y += B.vy * dt;
      if (B.curve && B.y > F3.R + .02) { const a = B.curve * dt * .12, c = Math.cos(a), s2 = Math.sin(a), vx = B.vx; B.vx = vx * c - B.vz * s2; B.vz = vx * s2 + B.vz * c; }
      if (B.y < F3.R) { B.y = F3.R; if (B.vy < -1.2) { B.vy = -B.vy * .5; B.vx *= .9; B.vz *= .9; fx.bounce && fx.bounce(); } else B.vy = 0; B.curve *= .5; }
      const fr = B.y <= F3.R + .01 ? Math.exp(-.95 * dt) : Math.exp(-.06 * dt); B.vx *= fr; B.vz *= fr; B.spin = hyp(B.vx, B.vz);
      if (M.st === 'play' && Math.abs(B.x) > L + F3.R && Math.abs(B.z) < GW - F3.R && B.y < GH) goal(B.x > 0 ? 0 : 1);
      for (const gx of [-L, L]) for (const pz of [-GW, GW]) { const dx = B.x - gx, dz = B.z - pz, d = hyp(dx, dz); if (d < .17 && B.y < GH) { const nx = dx / d, nz = dz / d, vn = B.vx * nx + B.vz * nz; if (vn < 0) { B.vx -= 1.7 * vn * nx; B.vz -= 1.7 * vn * nz; sfx.hammer(); fx.post && fx.post(); } } }
      if (Math.abs(B.x - Math.sign(B.x) * L) < .2 && Math.abs(B.z) < GW && B.y > GH - .1 && B.y < GH + .15 && B.vy < 0) { B.vy = Math.abs(B.vy) * .5; B.vx *= -.5; } // crossbar
      if (Math.abs(B.x) > L - F3.R && !(Math.abs(B.z) < GW && B.y < GH)) { B.x = Math.sign(B.x) * (L - F3.R); B.vx = -B.vx * .7; fx.wall && fx.wall(); }
      if (Math.abs(B.x) > L + .9) { B.x = Math.sign(B.x) * (L + .9); B.vx *= -.2; }
      if (Math.abs(B.z) > W - F3.R) { B.z = Math.sign(B.z) * (W - F3.R); B.vz = -B.vz * .7; fx.wall && fx.wall(); }
      if (Math.abs(B.x) > L && Math.abs(B.z) > GW - F3.R) B.z = Math.sign(B.z) * (GW - F3.R);
      if (M.st === 'play' && B.y < 1.1) {
        let best = null, bd = .6;
        for (const p of P) {
          const d = hyp(p.x - B.x, p.z - B.z); if (d > .9) continue;
          const fast = hyp(B.vx, B.vz);
          if (p.kickCD > 0 || p.stun > 0) { // body block: a fast ball bounces off a player who isn't controlling it
            if (d < .38 && fast > 7 && p.kickCD <= 0 && B.last !== p.team) { const nx = (B.x - p.x) / (d || 1), nz = (B.z - p.z) / (d || 1), vn = B.vx * nx + B.vz * nz; if (vn < 0) { B.vx = (B.vx - 1.6 * vn * nx) * .5; B.vz = (B.vz - 1.6 * vn * nz) * .5; } }
            continue; }
          if (B.y > .75 && d > .4) continue;
          if (d < bd) { if (fast > 12.5 && p.team !== B.last && rnd() < .45) { const nx = (B.x - p.x) / (d || 1), nz = (B.z - p.z) / (d || 1); B.vx = nx * fast * .35 + B.vx * .2; B.vz = nz * fast * .35 + B.vz * .2; p.kickCD = .2; continue; } bd = d; best = p; }
        }
        if (best) { if (B.last !== best.team) M.poss = best.team; B.owner = best; B.last = best.team; if (best.team === 0 && best.id !== M.ctl) { M.ctl = best.id; fx.switch && fx.switch(best.id); } if (M.runTo && M.runTo.id === best.id) M.runTo = null; fx.touch && fx.touch(best); }
      }
    }
    if (M.st === 'kickoff') { M.wait -= dt; if (M.wait <= 0) { M.st = 'play'; const k = P.find(p => p.team === M.kickTeam && p.k === 0); B.owner = k; B.last = k.team; if (k.team === 0) M.ctl = k.id; sfx.whistle && sfx.whistle(); } }
    else if (M.st === 'play') { M.clock -= dt; M.t += dt; if (M.clock <= 0) end(); }
    else if (M.st === 'goal') { M.wait -= dt; if (M.wait <= 0) { if (M.clock <= 0) end(); else kickoff(1 - M.scoredBy); } }
    if (M.msgT > 0) { M.msgT -= dt; if (M.msgT <= 0) M.msg = ''; }
  }
  function goal(team) {
    M.score[team]++; M.st = 'goal'; M.wait = 3; M.scoredBy = team; B.owner = null; B.vx *= .25; B.vz *= .25; B.curve = 0;
    const scorer = P.filter(p => p.team === team).sort((a, b) => hyp(a.x - B.x, a.z - B.z) - hyp(b.x - B.x, b.z - B.z))[0]; M.scorer = scorer;
    for (const p of P) { if (p.team === team) p.celebrate = 2.8; p.act = null; p.pending = null; }
    say(team === 0 ? 'GOL!!!' : 'LAWAN JARING…', 2.4);
    if (team === 0) { sfx.good(); sfx.cheer && sfx.cheer(); } else sfx.bad();
    fx.goal && fx.goal(team, scorer);
  }
  function end() {
    if (M.st === 'end') return; M.st = 'end'; sfx.whistle && sfx.whistle(true);
    const [a, b] = M.score; M.result = { us: a, them: b, res: a > b ? 'win' : a < b ? 'loss' : 'draw', shots: M.stats.shots[0] };
    fx.end && fx.end(M.result);
  }
  return {
    M, act, reset, switchCtl,
    update(dt) { if (M.paused || M.st === 'end') return; const n = dt > .022 ? 2 : 1; for (let i = 0; i < n; i++) step(dt / n); },
    clockText: () => fmt(M.clock), teams: TEAM,
  };
}

// ============================================================ HUD + CONTROLS (DOM overlay inside #game; removed on destroy)
const ICON = { pass: '➜', shoot: '⚽', sprint: '⚡', skill: '✦', tackle: '⛌', switch: '⇄', burst: '✦' };
export function f3Controls(core, { onPause, onReplay, onExit } = {}) {
  const M = core.M, set = f3Settings(), root = document.createElement('div'); root.id = 'f3Ctl'; root.className = 'f3';
  root.innerHTML = `
    <div class="f3Score"><b class="t0">MYKAMPUNG</b><span class="sc">0 - 0</span><b class="t1">LAWAN</b></div>
    <div class="f3Clock">03:00</div>
    <button class="f3Pause" aria-label="Jeda · Pause">❚❚</button>
    <div class="f3Msg"></div>
    <div class="f3Stick"><div class="f3Base"><div class="f3Knob"></div></div></div>
    <div class="f3Btns">
      <button data-b="A" class="bA"><i>➜</i><small>PAS</small></button>
      <button data-b="B" class="bB"><i>⚽</i><small>TENDANG</small><span class="pw"><b></b></span></button>
      <button data-b="C" class="bC"><i>⚡</i><small>LARI</small></button>
      <button data-b="D" class="bD"><i>✦</i><small>SKIL</small><em class="cd"></em></button>
    </div>
    <div class="f3Over" hidden></div>`;
  $('game').append(root); $('game').classList.add('f3mode');
  const q = (s) => root.querySelector(s);
  const stick = q('.f3Stick'), base = q('.f3Base'), knob = q('.f3Knob');
  let stickId = null, sx0 = 0, sy0 = 0; const R = 38;
  const joy = { x: 0, z: 0 }, keys = new Set();
  function stickMove(e) { const dx = e.clientX - sx0, dy = e.clientY - sy0, d = hyp(dx, dy), k = d > R ? R / d : 1; knob.style.transform = `translate(${dx * k}px,${dy * k}px)`; let m = Math.min(1, d / R); m = m < set.dead ? 0 : (m - set.dead) / (1 - set.dead); joy.x = d ? dx / d * m : 0; joy.z = d ? dy / d * m : 0; }
  const onStickDown = (e) => { e.preventDefault(); if (stickId !== null) return; stickId = e.pointerId; stick.setPointerCapture(e.pointerId); const r = stick.getBoundingClientRect(); sx0 = clamp(e.clientX, r.left + R + 6, r.right - R - 6); sy0 = clamp(e.clientY, r.top + R + 6, r.bottom - R - 6); base.style.left = `${sx0 - r.left}px`; base.style.top = `${sy0 - r.top}px`; base.classList.add('on'); stickMove(e); };
  const onStickMove = (e) => { if (e.pointerId === stickId) { e.preventDefault(); stickMove(e); } };
  const onStickUp = (e) => { if (e.pointerId !== stickId) return; stickId = null; joy.x = joy.z = 0; knob.style.transform = ''; base.classList.remove('on'); base.style.left = ''; base.style.top = ''; };
  stick.addEventListener('pointerdown', onStickDown); stick.addEventListener('pointermove', onStickMove); stick.addEventListener('pointerup', onStickUp); stick.addEventListener('pointercancel', onStickUp);
  const held = { A: false, B: false, C: false, D: false };
  const press = (b, on) => {
    if (held[b] === on) return; held[b] = on; q(`.b${b}`).classList.toggle('on', on);
    if (M.paused || M.st === 'end') return;
    if (b === 'A') on ? core.act.passDown() : core.act.passUp();
    if (b === 'B') on ? core.act.shootDown() : core.act.shootUp();
    if (b === 'D' && on) core.act.skill();
  };
  const btnHandlers = [];
  root.querySelectorAll('.f3Btns button').forEach((el) => {
    const b = el.dataset.b; let pid = null;
    const dn = (e) => { e.preventDefault(); e.stopPropagation(); pid = e.pointerId; try { el.setPointerCapture(e.pointerId); } catch {} press(b, true); };
    const up = (e) => { if (pid !== e.pointerId) return; pid = null; press(b, false); };
    el.addEventListener('pointerdown', dn); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
    btnHandlers.push([el, dn, up]);
  });
  // block browser gestures (pinch zoom, double-tap zoom, pull-to-refresh) while the match is open
  const noGesture = (e) => e.preventDefault();
  root.addEventListener('touchmove', noGesture, { passive: false }); root.addEventListener('gesturestart', noGesture);
  const pauseBtn = q('.f3Pause'), over = q('.f3Over');
  const opt = (k, labels) => `<button class="f3B small" data-s="${k}">${labels[k === 'zoom' ? [.8, 1, 1.25].indexOf(set.zoom) : k === 'assist' ? set.assist : [.08, .14, .24].indexOf(set.dead)] || ''}</button>`;
  function settingsHtml() { return `<div class="f3Set"><label>📷 Kamera · Camera ${opt('zoom', ['Dekat · Close', 'Sederhana · Medium', 'Jauh · Far'])}</label><label>🎯 Bantuan bidikan · Aim assist ${opt('assist', ASSIST.map(a => a.name))}</label><label>🕹️ Zon mati · Dead zone ${opt('dead', ['Kecil · Small', 'Sederhana · Medium', 'Besar · Large'])}</label></div>`; }
  function pause(on) { if (M.st === 'end') return; M.paused = on; onPause && onPause(on); over.hidden = !on; if (on) { over.innerHTML = `<div class="f3Card"><h2>DIJEDA · PAUSED</h2><p>${TEAM[0]} ${M.score[0]} - ${M.score[1]} ${TEAM[1]} · ${core.clockText()}</p>${settingsHtml()}<div class="f3Row"><button class="f3B primary" data-o="resume">▶ Teruskan · Resume</button><button class="f3B" data-o="exit">🏠 Kembali ke Kampung</button></div></div>`; bindOver(); } }
  pauseBtn.onclick = () => { sfx.tap(); pause(!M.paused); };
  function bindOver() {
    over.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { sfx.tap(); const o = b.dataset.o; if (o === 'resume') pause(false); else if (o === 'replay') { over.hidden = true; onReplay && onReplay(); } else if (o === 'exit') { onExit && onExit(); } });
    over.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { sfx.tap(); const k = b.dataset.s;
      if (k === 'zoom') set.zoom = { .8: 1, 1: 1.25, 1.25: .8 }[set.zoom] || 1; else if (k === 'assist') set.assist = (set.assist + 1) % 3; else set.dead = { .08: .14, .14: .24, .24: .08 }[set.dead] || .14;
      save(); over.querySelector('.f3Set').outerHTML = settingsHtml(); bindOver(); });
  }
  function showEnd(r) {
    const head = r.res === 'win' ? 'MENANG!' : r.res === 'loss' ? 'KALAH' : 'SERI';
    over.hidden = false; over.innerHTML = `<div class="f3Card end ${r.res}"><div class="kick">PERLAWANAN TAMAT · FULL TIME</div><h2>${head} <small>${r.res === 'win' ? 'You win' : r.res === 'loss' ? 'You lost' : 'Draw'}</small></h2><div class="f3Big">${TEAM[0]} <b>${r.us} - ${r.them}</b> ${TEAM[1]}</div><p class="muted">Tendangan ${M.stats.shots[0]}-${M.stats.shots[1]} · Hantaran ${M.stats.passes[0]}-${M.stats.passes[1]} · Tekel ${M.stats.tackles[0]}-${M.stats.tackles[1]}</p>${r.reward ? `<p class="reward">${r.reward}</p>` : ''}<div class="f3Row"><button class="f3B primary" data-o="replay">🔁 MAIN LAGI</button><button class="f3B" data-o="exit">🏠 KEMBALI KE KAMPUNG</button></div></div>`; bindOver();
  }
  const KEY = { KeyW: 'u', ArrowUp: 'u', KeyS: 'd', ArrowDown: 'd', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' };
  const onKey = (e) => {
    if (!root.isConnected) return; const down = e.type === 'keydown';
    if (KEY[e.code]) { e.preventDefault(); down ? keys.add(KEY[e.code]) : keys.delete(KEY[e.code]); return; }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { held.C = down; q('.bC').classList.toggle('on', down); return; }
    if (e.repeat) return;
    if (e.code === 'KeyJ' || e.code === 'Space') { e.preventDefault(); press('A', down); }
    else if (e.code === 'KeyK') press('B', down);
    else if (e.code === 'KeyL') press('D', down);
    else if (down && (e.code === 'KeyP' || e.code === 'Escape')) pause(!M.paused);
  };
  addEventListener('keydown', onKey); addEventListener('keyup', onKey);
  let lastHud = '';
  return {
    root, pause, showEnd,
    sync() {
      const kx = (keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0), kz = (keys.has('d') ? 1 : 0) - (keys.has('u') ? 1 : 0), kl = hyp(kx, kz) || 1;
      // the camera looks along -z with +x to the right, so screen directions map straight onto the pitch
      M.input.x = kx ? kx / kl : joy.x; M.input.z = kz ? kz / kl : joy.z; M.input.sprint = held.C;
      const p = M.players[M.ctl], has = M.ball.owner === p;
      const h = `${M.score[0]}|${M.score[1]}|${core.clockText()}|${has}|${M.msg}|${Math.round(Math.max(0, M.charge) * 20)}|${Math.round(Math.max(0, M.passHold) * 10)}|${p.skillCD > 0 ? Math.ceil(p.skillCD) : 0}|${M.st}`;
      if (h !== lastHud) { lastHud = h;
        q('.sc').textContent = `${M.score[0]} - ${M.score[1]}`; q('.f3Clock').textContent = core.clockText(); q('.f3Clock').classList.toggle('low', M.clock < 30);
        const lab = (b, ic, t) => { const el = q(`.b${b}`); el.querySelector('i').textContent = ic; el.querySelector('small').textContent = t; };
        if (has) { lab('A', M.passHold > .28 ? '⇢' : ICON.pass, M.passHold > .28 ? 'TEMBUS' : 'PAS'); lab('B', ICON.shoot, 'TENDANG'); lab('D', ICON.skill, 'SKIL'); }
        else { lab('A', ICON.tackle, 'TEKEL'); lab('B', ICON.switch, 'TUKAR'); lab('D', ICON.burst, 'PECUT'); }
        q('.bB .pw').style.opacity = M.charge >= 0 ? 1 : 0; q('.bB .pw b').style.height = `${Math.max(0, M.charge) * 100}%`;
        q('.bD').classList.toggle('cool', p.skillCD > 0); q('.bD .cd').textContent = p.skillCD > 0 ? Math.ceil(p.skillCD) : '';
        const m = q('.f3Msg'); m.textContent = M.msg; m.classList.toggle('show', !!M.msg); m.classList.toggle('goal', M.msg.startsWith('GOL'));
      }
    },
    destroy() {
      removeEventListener('keydown', onKey); removeEventListener('keyup', onKey);
      stick.removeEventListener('pointerdown', onStickDown); stick.removeEventListener('pointermove', onStickMove); stick.removeEventListener('pointerup', onStickUp); stick.removeEventListener('pointercancel', onStickUp);
      for (const [el, dn, up] of btnHandlers) { el.removeEventListener('pointerdown', dn); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); el.removeEventListener('lostpointercapture', up); }
      root.removeEventListener('touchmove', noGesture); root.removeEventListener('gesturestart', noGesture);
      root.remove(); $('game').classList.remove('f3mode');
    },
  };
}

// ============================================================ session (shared by 3D and 2D renderers)
export function f3Session(api, opts, fx = {}) {
  const matches = []; let ctl = null;
  const core = matchCore(opts, { ...fx, end(r) { matches.push(r); let reward = ''; try { reward = opts.onMatch ? opts.onMatch(r) || '' : ''; } catch (e) { console.warn(e); } ctl && ctl.showEnd({ ...r, reward }); fx.end && fx.end(r); } });
  const finish = () => {
    const r = matches[matches.length - 1] || { us: core.M.score[0], them: core.M.score[1], res: 'none' };
    const w = matches.filter(m => m.res === 'win').length, d = matches.filter(m => m.res === 'draw').length;
    api.finish({ stars: r.res === 'win' ? (r.us - r.them >= 2 ? 3 : 2) : r.res === 'draw' ? 2 : 1, us: r.us, them: r.them, res: r.res, matches: matches.length, wins: w, draws: d });
  };
  ctl = f3Controls(core, {
    onReplay() { core.reset(); fx.reset && fx.reset(); },
    onExit() { if (!matches.length) api.finish({ stars: 0, us: core.M.score[0], them: core.M.score[1], res: 'quit', matches: 0 }); else finish(); },
  });
  api.tools([]); api.step('Perlawanan 3v3', '3v3 match');
  return {
    core, ctl,
    tick(dt) { const tut = document.getElementById('gTut'); ctl.sync(); if (tut && !tut.hidden) return; core.update(dt); },
    timerText: () => `⏱ ${core.clockText()}`,
    stop() { ctl.destroy(); },
  };
}

// ============================================================ 2D FALLBACK (top-down)
export function Futsal3v3(api, opts) {
  const ses = f3Session(api, opts); const { M } = ses.core; const { L, W, GW } = F3;
  const X = (x) => 500 + x * 38, Z = (z) => 300 + z * 38;
  return {
    dbg: () => ({ st: M.st, score: M.score, clock: M.clock, ctl: M.ctl, ball: { x: M.ball.x, z: M.ball.z, owner: M.ball.owner && M.ball.owner.id }, players: M.players.map(p => ({ x: p.x, z: p.z, team: p.team })) }),
    core: ses.core, down() {}, move() {}, up() {},
    update(dt) { ses.tick(dt); }, timerText: ses.timerText,
    draw(c) {
      c.fillStyle = '#20402f'; c.fillRect(0, 0, 1000, 600);
      c.fillStyle = '#e67e22'; c.fillRect(X(-L) - 24, Z(-W) - 24, L * 76 + 48, W * 76 + 48); c.fillStyle = '#2c6fb0'; c.fillRect(X(-L), Z(-W), L * 76, W * 76);
      c.strokeStyle = '#fff'; c.lineWidth = 3; c.strokeRect(X(-L), Z(-W), L * 76, W * 76); c.beginPath(); c.moveTo(X(0), Z(-W)); c.lineTo(X(0), Z(W)); c.stroke(); c.beginPath(); c.arc(X(0), Z(0), 3 * 38, 0, 7); c.stroke();
      for (const s of [-1, 1]) { c.beginPath(); c.arc(X(s * L), Z(0), 6 * 38, s > 0 ? Math.PI / 2 : -Math.PI / 2, s > 0 ? Math.PI * 1.5 : Math.PI / 2); c.stroke(); c.fillStyle = '#ecf0f1'; c.fillRect(s > 0 ? X(L) : X(-L) - 26, Z(-GW), 26, GW * 76); }
      for (const p of M.players) {
        if (p.team === 0 && p.id === M.ctl) { c.strokeStyle = '#ffd452'; c.lineWidth = 4; c.beginPath(); c.arc(X(p.x), Z(p.z), 21, 0, 7); c.stroke(); }
        c.fillStyle = p.team ? '#c0392b' : '#2e86de'; c.beginPath(); c.arc(X(p.x), Z(p.z) - (p.celebrate > 0 ? Math.abs(Math.sin(p.celebrate * 8)) * 8 : 0), 15, 0, 7); c.fill();
        c.fillStyle = '#fff'; c.font = '800 13px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(p.num, X(p.x), Z(p.z));
        c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 2; c.beginPath(); c.moveTo(X(p.x), Z(p.z)); c.lineTo(X(p.x + Math.cos(p.dir) * .6), Z(p.z + Math.sin(p.dir) * .6)); c.stroke();
      }
      const b = M.ball; c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(X(b.x), Z(b.z), 8, 5, 0, 0, 7); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(X(b.x), Z(b.z) - b.y * 30, 7 + b.y * 2, 0, 7); c.fill(); c.strokeStyle = '#222'; c.lineWidth = 1.5; c.stroke(); c.textBaseline = 'alphabetic';
    },
    stop() { ses.stop(); },
  };
}
