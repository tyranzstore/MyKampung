// JALAN DRAG — vehicle physics (pure JS, no DOM / three.js, so it runs in node tests too).
// Fixed timestep, longitudinal model: engine torque curve (+turbo spool, +nitrous) → clutch → gearbox → driven wheels,
// traction limited by the load on the driven axle (static weight + weight transfer + rear downforce) × tyre grip × tyre temp.
// If the drive force exceeds the grip the wheels spin: force falls to kinetic grip and the extra torque spins the wheels up
// (wheel + drivetrain inertia), which also revs the engine. Aero drag ½ρCdAv², rolling resistance, rev limiter, shift time.
// Bikes: when weight transfer unloads the front, the bike wheelies — acceleration is capped and the excess lifts the nose.
export const DT = 1 / 240, G = 9.81, RHO = 1.2;
export const DIST = { eighth: { m: 201.17, bm: '1/8 batu', en: '1/8 mile' }, quarter: { m: 402.34, bm: '1/4 batu', en: '1/4 mile' }, half: { m: 804.67, bm: '1/2 batu', en: '1/2 mile' } };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// torque curve: rises from idle to the peak, holds, then falls toward the red line
export function torqueAt(P, rpm) {
  const r = clamp(rpm, P.idle, P.limiter), pk = P.peakRpm;
  const shape = r < pk ? .62 + .38 * Math.sin((r - P.idle) / Math.max(1, pk - P.idle) * Math.PI / 2) : 1 - .3 * Math.pow((r - pk) / Math.max(1, P.limiter - pk), 1.6);
  return P.torque * shape;
}

export function newState(P) {
  return { x: 0, v: 0, a: 0, rpm: P.idle, gear: 0, shiftT: 0, nextGear: 0, clutch: 0, launchRpm: P.idle, launched: false, done: false, t: 0, et: 0, trap: 0,
    spin: 0, slip: false, boost: 0, nos: 0, nosOn: false, nosUsed: false, temp: .3, pitch: 0, wheelieT: 0, limiterT: 0, shifts: [], maxSpin: 0, speed60: 0, t60: 0, t330: 0, shiftedThisStep: false };
}

// one fixed step. input: { gas 0..1, nos bool, burnout bool (brake held), shiftUp, shiftDown (edge), auto }
export function step(P, S, input, dt = DT) {
  S.shiftedThisStep = false;
  const gas = clamp(input.gas || 0, 0, 1);
  // ---- turbo spool (lag) and tyre temperature
  const spoolTarget = P.turbo ? gas * clamp((S.rpm - P.turbo.rpm) / 1600, 0, 1) : 0;
  S.boost += (spoolTarget - S.boost) * Math.min(1, dt / (P.turbo ? P.turbo.lag : 1));
  S.temp = Math.max(.3, S.temp - dt * .015 + (S.spin > 3 ? Math.min(S.spin, 60) * dt * .006 : 0));
  // ---- nitrous
  if (input.nos && P.nos && !S.nosUsed && S.launched && !S.nosOn) S.nosOn = true;
  if (S.nosOn) { S.nos += dt; if (S.nos >= P.nos.dur) { S.nosOn = false; S.nosUsed = true; } }
  const nosMul = S.nosOn ? 1 + P.nos.add : 1, boostMul = 1 + (P.turbo ? P.turbo.gain * S.boost : 0);
  const engT = (rpm) => (rpm >= P.limiter ? 0 : torqueAt(P, rpm) * boostMul * nosMul);
  // ---- before the launch: free revving in neutral (or a burnout against the brake)
  if (!S.launched) {
    if (input.burnout && P.burnout !== false) { // brake on the undriven wheels, driven wheels spin up
      const target = P.idle + gas * (P.limiter - P.idle) * .8; S.rpm += (target - S.rpm) * Math.min(1, dt * 6); S.spin = gas * 45; S.slip = gas > .2;
    } else { const target = gas > 0 ? Math.min(P.idle + gas * (P.limiter - P.idle), P.launchCtl || P.limiter) : P.idle; S.rpm += (target - S.rpm) * Math.min(1, dt * (gas > 0 ? 7 : 3)); S.spin = Math.max(0, S.spin - dt * 60); S.slip = false; }
    if (S.rpm >= P.limiter - 30) S.rpm = P.limiter - 200 * Math.random();
    return S;
  }
  S.t += dt;
  // ---- gear changes
  if (S.shiftT > 0) { S.shiftT -= dt; if (S.shiftT <= 0) { S.gear = S.nextGear; } }
  else if (input.shiftUp && S.gear < P.gears.length && S.locked) { S.nextGear = S.gear + 1; S.shiftT = P.shiftTime; S.shifts.push({ from: S.gear, rpm: S.rpm / P.limiter }); S.shiftedThisStep = true; }
  else if (input.shiftDown && S.gear > 1) { S.nextGear = S.gear - 1; S.shiftT = P.shiftTime; S.shiftedThisStep = true; }
  const g = Math.max(1, S.gear), ratio = P.gears[g - 1] * P.final, wheelR = P.r;
  // ---- loads: static + transfer + downforce
  const W = P.mass * G, down = .5 * RHO * (P.clA || 0) * S.v * S.v;
  let front = W * P.front - P.mass * S.a * P.cgH / P.wb, rear = W * (1 - P.front) + P.mass * S.a * P.cgH / P.wb + down;
  front = Math.max(0, front);
  const load = P.drive === 'F' ? front : P.drive === 'A' ? front + rear : rear;
  const tempGrip = 1 + .12 * Math.exp(-Math.pow((S.temp - 1) / .35, 2)) - (S.temp > 1.4 ? (S.temp - 1.4) * .2 : 0);
  const mu = P.mu * tempGrip, Fmax = mu * load, Fkin = Fmax * .84; S.Fmax = Fmax;
  // ---- engine / clutch
  const wheelRpm = (S.v / wheelR + S.spin) * ratio * 30 / Math.PI;
  let Tw = 0;
  if (!S.locked) { // clutch slipping after the launch: engine held near the launch rpm (sags a little) until the wheels catch up
    S.clutch = Math.min(1, S.clutch + dt / P.clutchTime);
    S.rpm = Math.max(wheelRpm, S.launchRpm * (1 - .22 * S.clutch), P.idle);
    Tw = S.shiftT > 0 ? 0 : engT(S.rpm) * gas * ratio * P.eff * (.35 + .65 * S.clutch);
    if (S.clutch >= 1 && wheelRpm >= S.rpm - 30) S.locked = true;
  } else {
    S.rpm = Math.max(P.idle * .8, wheelRpm);
    Tw = S.shiftT > 0 ? 0 : engT(S.rpm) * gas * ratio * P.eff;
    if (S.rpm >= P.limiter) S.limiterT += dt;
  }
  // ---- traction
  S.TwFull = gas > 0 ? Tw / gas : engT(S.rpm) * ratio * P.eff; // wheel torque at full throttle (used by the AI's throttle control)
  const Fwant = Tw / wheelR, Ieff = P.wheelI + P.engI * ratio * ratio;
  let F;
  if (Fwant <= Fmax && S.spin <= .05) { F = Fwant; S.spin = 0; S.slip = false; }
  else { F = Fkin; S.spin = Math.max(0, S.spin + (Tw - Fkin * wheelR) / Ieff * dt); S.slip = S.spin > .05; if (S.spin <= 0) { S.spin = 0; S.slip = false; } }
  S.maxSpin = Math.max(S.maxSpin, S.spin);
  // ---- resistance and acceleration
  const drag = .5 * RHO * P.cdA * S.v * S.v, roll = P.crr * W * (S.v > .1 ? 1 : 0);
  const mEff = P.mass + Ieff / (wheelR * wheelR) * .15; // part of the drivetrain inertia shows up as extra mass
  let a = (F - drag - roll) / mEff;
  // bikes: wheelie when the front unloads
  if (P.bike) { const aMax = G * P.front * P.wb / P.cgH; if (a > aMax) { S.pitch = Math.min(1.2, S.pitch + (a - aMax) * dt * .9); S.wheelieT += dt; a = aMax; } else S.pitch = Math.max(0, S.pitch - dt * 1.4);
    if (S.pitch > .55) { a *= .6; } } // too much wheelie: the rider rolls off
  S.a = a; S.v = Math.max(0, S.v + a * dt); S.x += S.v * dt;
  if (!S.t60 && S.x >= 18.29) S.t60 = S.t; if (!S.t330 && S.x >= 100.58) S.t330 = S.t;
  return S;
}

// launch (clutch dump) — records the rpm the engine was held at
export function launch(P, S) { if (S.launched) return; S.launched = true; S.launchRpm = Math.max(S.rpm, P.idle * 1.3); S.gear = 1; S.clutch = 0; S.locked = false; }

// best shift point: where the next gear gives more wheel torque than staying (simple scan), capped below the limiter
export function shiftRpm(P, g) {
  if (g >= P.gears.length) return P.limiter; const r1 = P.gears[g - 1], r2 = P.gears[g];
  for (let rpm = P.peakRpm; rpm < P.limiter; rpm += 50) { const after = rpm * r2 / r1; if (torqueAt(P, after) * r2 > torqueAt(P, rpm) * r1) return rpm; }
  return P.limiter - 120;
}

// AI / ideal driver: runs a whole race from the launch with given reaction and quality (0 = sloppy, 1 = perfect)
export function driver(P, quality = 1, rnd = Math.random) {
  const shiftPts = P.gears.map((_, i) => shiftRpm(P, i + 1) * (1 - (1 - quality) * (.04 + rnd() * .06)));
  return {
    launchRpm: P.bestLaunch || P.peakRpm * .9,
    input(S) {
      const sp = shiftPts[Math.max(0, S.gear - 1)];
      // feather the throttle to the grip limit; a sloppier driver overshoots and spins
      let gas = 1; if (S.Fmax && S.TwFull > 0) gas = clamp(S.Fmax * P.r * (1.01 + (1 - quality) * .6) / S.TwFull, .25, 1); if (S.spin > 4) gas = Math.min(gas, .7);
      if (P.bike && S.pitch > .35) gas = .55;
      return { gas, nos: P.nos && S.gear >= 2 && S.shiftT <= 0, shiftUp: S.shiftT <= 0 && S.gear < P.gears.length && S.rpm >= sp };
    },
  };
}
// full simulated run (used for AI and to rate builds). Returns { et, trap, t60 }
export function simulate(P, distM, quality = 1, rnd = Math.random, launchRpm) {
  const S = newState(P), d = driver(P, quality, rnd); S.rpm = launchRpm || d.launchRpm; launch(P, S);
  for (let i = 0; i < 240 * 60 && S.x < distM; i++) { const xp = S.x, tp = S.t; step(P, S, d.input(S)); if (S.x >= distM) { const k = (distM - xp) / Math.max(1e-6, S.x - xp); S.et = tp + (S.t - tp) * k; S.trap = S.v; } }
  return { et: S.et || 99, trap: S.trap, t60: S.t60 };
}
// best launch rpm for this build (quick scan over 60 ft time)
export function bestLaunch(P) {
  let best = P.peakRpm, bt = 1e9;
  for (let r = P.idle + 600; r <= Math.min(P.limiter - 200, P.launchCtl || 1e9); r += (P.limiter - P.idle) / 18) { const s = simulate(P, 18.29, 1, () => .5, r); if (s.et < bt) { bt = s.et; best = r; } }
  return best;
}
