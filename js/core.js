// Core helpers: save data, audio synth, DOM UI (toast, dialog, modal)
export const $ = (id) => document.getElementById(id);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

// ------------------------------------------------------------ save
// The save lives in localStorage under KEY (unchanged since v0.1, so every old save still loads).
// Safety net: a backup copy under BAK, a version number (saveVersion), export/import from the Menu,
// and a request for persistent storage so the browser is less likely to clear it.
const KEY = 'tkh_town_v1', BAK = KEY + '_bak';
export const SAVE_VERSION = 2; // 1 = saves from before versions existed; 2 = adds saveVersion + backup
export const DEFAULTS = () => ({
  started: false, coins: 0, stars: 0, spirit: 10, chapter: 1, mission: 0, chapterDone: false, invited: [], rice: 0,
  houseColor: null, best: {}, daily: { date: '', count: 0, yards: [] },
  muted: false, timeMode: 'real', gfx: '3d', visited: {}, saveVersion: SAVE_VERSION,
});
const isObj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
// null = nothing stored, undefined = stored but damaged (or storage unreadable)
function read(k) { try { const s = localStorage.getItem(k); if (s == null) return null; const o = JSON.parse(s); return isObj(o) ? o : undefined; } catch { return undefined; } }
let status = 'new'; // 'new' | 'ok' | 'restored' — how this session's save was loaded
function load() {
  const main = read(KEY); if (main) { status = 'ok'; return main; }
  if (main === undefined) { const b = read(BAK); if (b) { status = 'restored'; try { localStorage.setItem(KEY, JSON.stringify(b)); } catch {} return b; } }
  return null;
}
// upgrade an older save in place: only ever ADD fields, never remove or rename player data
function migrate(o) { if (!(o.saveVersion >= SAVE_VERSION)) o.saveVersion = SAVE_VERSION; return o; }
export const S = migrate(Object.assign(DEFAULTS(), load() || {}));
export const saveStatus = () => status;
let lastBak = 0, warned = false;
export function save() {
  let ok = false;
  try {
    const s = JSON.stringify(S); localStorage.setItem(KEY, s); ok = true;
    if (Date.now() - lastBak > 60000) { localStorage.setItem(BAK, s); lastBak = Date.now(); } // backup at most once a minute
  } catch {}
  if (!ok && !warned && typeof document !== 'undefined') { warned = true; setTimeout(() => toast('⚠️ Kemajuan tidak dapat disimpan', 'Progress could not be saved. Menu → Simpanan to export a backup.'), 0); }
  return ok;
}
export function wipe() { try { localStorage.removeItem(KEY); localStorage.removeItem(BAK); } catch {} }
// ask the browser not to clear our storage (best effort; some browsers decide on their own)
export function keepSaveSafe() { try { navigator.storage && navigator.storage.persist && navigator.storage.persist().catch(() => {}); } catch {} }
// export file: { game, kind, version, exported, data }
export function exportSave() { return JSON.stringify({ game: 'MyKampung', kind: 'save', version: SAVE_VERSION, exported: new Date().toISOString(), data: S }); }
// accepts an export file or a raw save; checks it really is a MyKampung save before anything is replaced
export function parseSave(text) {
  let o; try { o = JSON.parse(text); } catch { return { ok: false, reason: 'json' }; }
  if (isObj(o) && 'game' in o) { if (o.game !== 'MyKampung' || !isObj(o.data)) return { ok: false, reason: 'game' }; o = o.data; }
  if (!isObj(o)) return { ok: false, reason: 'shape' };
  const num = (v, min) => typeof v === 'number' && Number.isFinite(v) && v >= min;
  if (!num(o.coins, 0) || !num(o.chapter, 1) || (o.stars !== undefined && !num(o.stars, 0))) return { ok: false, reason: 'shape' };
  return { ok: true, data: o };
}
// replace the save with an imported one; the current save is kept aside under KEY_preimport
export function importSave(data) {
  try {
    const cur = localStorage.getItem(KEY); if (cur) localStorage.setItem(KEY + '_preimport', cur);
    const s = JSON.stringify(migrate({ ...data })); localStorage.setItem(KEY, s); localStorage.setItem(BAK, s); return true;
  } catch { return false; }
}
export function checkDaily() { if (S.daily.date !== today()) { S.daily = { date: today(), count: 0, yards: [] }; save(); } }

// ------------------------------------------------------------ audio (WebAudio synth, no files)
let ac = null, master = null, noiseBuf = null;
export function audioInit() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = S.muted ? 0 : .5; master.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate); const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch { ac = null; }
}
export function setMuted(m) { S.muted = m; if (master) master.gain.value = m ? 0 : .5; save(); }
function tone(f, d = .12, type = 'sine', v = .2, f2 = 0, delay = 0) {
  if (!ac) return; const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  o.connect(g).connect(master); o.start(t); o.stop(t + d + .05);
}
function noise(d = .1, v = .2, freq = 800, delay = 0, type = 'lowpass') {
  if (!ac) return; const t = ac.currentTime + delay, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = noiseBuf; f.type = type; f.frequency.value = freq;
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  s.connect(f).connect(g).connect(master); s.start(t, Math.random()); s.stop(t + d + .05);
}
export const sfx = {
  tap() { tone(660, .06, 'triangle', .12); },
  coin() { tone(988, .1, 'square', .08); tone(1319, .25, 'square', .08, 0, .08); },
  pop() { tone(500, .1, 'sine', .15, 900); },
  talk() { tone(380 + Math.random() * 160, .06, 'square', .04); },
  good() { [523, 659, 784, 1047].forEach((f, i) => tone(f, .22, 'triangle', .16, 0, i * .1)); },
  bad() { tone(220, .25, 'sawtooth', .1, 110); },
  hammer() { noise(.06, .45, 1200); tone(180, .08, 'triangle', .3, 80); },
  cough() { noise(.25, .35, 300); tone(70, .2, 'sawtooth', .2, 40); },
  pull() { noise(.15, .2, 2000, 0, 'bandpass'); },
  bag() { noise(.3, .3, 600); },
  star(i) { tone(880 * (1 + i * .25), .3, 'triangle', .15, 0, i * .25); },
  swish() { noise(.08, .08, 3000, 0, 'highpass'); },
  splash() { noise(.35, .3, 900); tone(300, .15, 'sine', .08, 120); },
  bite() { tone(880, .08, 'square', .12); tone(1175, .12, 'square', .12, 0, .09); },
  snap() { tone(1400, .05, 'square', .15, 300); noise(.12, .3, 2500, 0, 'highpass'); },
  kick() { noise(.05, .5, 900); tone(130, .08, 'sine', .35, 60); },
  whistle(long) { tone(2900, long ? .9 : .35, 'sine', .11, 2750); tone(3050, long ? .9 : .35, 'triangle', .04, 2900); },
  cheer() { noise(1.4, .16, 1300, 0, 'bandpass'); noise(1.1, .1, 2400, .15, 'bandpass'); },
};
// continuous sounds: engine / water / scrub
export function loopSound(kind) {
  if (!ac) return { set() {}, stop() {} };
  const g = ac.createGain(); g.gain.value = 0; g.connect(master);
  let src, f;
  if (kind === 'engine') {
    src = ac.createOscillator(); src.type = 'sawtooth'; src.frequency.value = 55;
    f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700; src.connect(f).connect(g);
  } else {
    src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = kind === 'water' ? 1800 : 900; f.Q.value = .7; src.connect(f).connect(g);
  }
  src.start();
  return {
    set(level, pitch) { g.gain.setTargetAtTime(level, ac.currentTime, .05); if (pitch && src.frequency) src.frequency.setTargetAtTime(pitch, ac.currentTime, .08); },
    stop() { try { g.gain.setTargetAtTime(0, ac.currentTime, .05); src.stop(ac.currentTime + .3); } catch {} },
  };
}

// ------------------------------------------------------------ UI
let toastTimer;
export function toast(msg, sub = '') {
  const t = $('toast'); t.innerHTML = ''; t.append(msg);
  if (sub) { const s = document.createElement('small'); s.textContent = sub; t.append(s); }
  t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}
export const ui = { busy: false }; // true while a dialog, modal or mini-game is open

// dialogue: lines = [[bm, en], ...]; resolves when finished
export function dialog(who, lines) {
  return new Promise((resolve) => {
    ui.busy = true; let i = 0; const box = $('dialog');
    $('dlgAvatar').style.background = who.color || '#e6a32c'; $('dlgAvatar').textContent = who.initial || who.name[0];
    $('dlgName').textContent = who.name;
    const show = () => { $('dlgBm').textContent = lines[i][0]; $('dlgEn').textContent = lines[i][1] || ''; sfx.talk(); };
    const next = (e) => {
      if (e) e.preventDefault(); i++;
      if (i < lines.length) return show();
      box.hidden = true; box.removeEventListener('pointerdown', next); removeEventListener('keydown', key); ui.busy = false; resolve();
    };
    const key = (e) => { if (['Enter', ' ', 'e', 'E'].includes(e.key)) next(e); };
    box.hidden = false; show(); box.addEventListener('pointerdown', next); addEventListener('keydown', key);
  });
}

// modal with buttons; resolves to the chosen button value
export function modal({ title, kicker = '', body = '', html = '', buttons = [['OK', 'ok', true]] }) {
  return new Promise((resolve) => {
    ui.busy = true; const m = $('modal');
    $('mKicker').textContent = kicker; $('mTitle').textContent = title;
    const b = $('mBody'); b.innerHTML = ''; if (html) b.innerHTML = html; else b.textContent = body;
    const bb = $('mBtns'); bb.innerHTML = '';
    for (const [label, val, primary] of buttons) {
      const btn = document.createElement('button'); btn.textContent = label; if (primary) btn.className = 'primary';
      btn.onclick = () => { sfx.tap(); m.hidden = true; ui.busy = false; resolve(val); };
      bb.append(btn);
    }
    m.hidden = false;
  });
}

// ------------------------------------------------------------ boat engine (procedural, from recorded-engine principles)
// A small fishing-boat motor is a train of exhaust pulses: each firing is a short pressure burst that rings
// through the exhaust/hull. We render one loop of pulses (with natural timing/strength jitter) through
// resonant filters into a buffer, then speed the loop up for throttle. Water wash, prop hiss and hull slaps
// are separate layers.
let engineBuf = null;
async function buildEngineBuffer() {
  if (engineBuf || !ac) return engineBuf;
  const sr = 22050, secs = 2.4, f0 = 13.5; // ~810 rpm single-cylinder "tuk-tuk-tuk" idle
  const oc = new OfflineAudioContext(1, sr * secs, sr);
  const src = oc.createBufferSource(), raw = oc.createBuffer(1, sr * secs, sr), d = raw.getChannelData(0);
  const n = Math.round(secs * f0), step = sr * secs / n; // whole number of pulses so the loop is seamless
  for (let k = 0; k < n; k++) {
    const at = Math.floor(k * step + (Math.random() - .5) * step * .06), amp = .75 + Math.random() * .35;
    for (let i = 0; i < 900; i++) { const j = at + i; if (j < 0 || j >= d.length) continue; const e = Math.exp(-i / 160);
      d[j] += amp * e * (Math.sin(i / sr * 2 * Math.PI * 70) * .9 + (Math.random() * 2 - 1) * .55); }
  }
  src.buffer = raw;
  const lp = oc.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100; lp.Q.value = .7;
  const body = oc.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 140; body.Q.value = 2.2; body.gain.value = 9;   // hull/exhaust boom
  const pipe = oc.createBiquadFilter(); pipe.type = 'peaking'; pipe.frequency.value = 420; pipe.Q.value = 3; pipe.gain.value = 5;     // muffler ring
  src.connect(body).connect(pipe).connect(lp).connect(oc.destination); src.start();
  engineBuf = await oc.startRendering();
  const ch = engineBuf.getChannelData(0); let mx = 0; for (const v of ch) mx = Math.max(mx, Math.abs(v)); for (let i = 0; i < ch.length; i++) ch[i] /= mx || 1;
  return engineBuf;
}
export function boatEngine() {
  if (!ac) return { set() {}, stop() {} };
  const out = ac.createGain(); out.gain.value = 0; out.connect(master);
  let eng = null, thr = 0, alive = true;
  buildEngineBuffer().then((b) => { if (!alive || !b) return; eng = ac.createBufferSource(); eng.buffer = b; eng.loop = true; const g = ac.createGain(); g.gain.value = .9; eng.connect(g).connect(out); eng.start(); setT(thr); });
  // propeller / water wash: noise through a band that opens with speed
  const wash = ac.createBufferSource(); wash.buffer = noiseBuf; wash.loop = true;
  const wf = ac.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 500; wf.Q.value = .6; const wg = ac.createGain(); wg.gain.value = 0;
  wash.connect(wf).connect(wg).connect(out); wash.start();
  const whine = ac.createOscillator(); whine.type = 'sawtooth'; const whf = ac.createBiquadFilter(); whf.type = 'bandpass'; whf.frequency.value = 900; whf.Q.value = 4; const whg = ac.createGain(); whg.gain.value = 0;
  whine.connect(whf).connect(whg).connect(out); whine.start();
  let slapT = null; const slap = () => { if (!alive) return; const k = thr; noise(.18, .06 + k * .12, 260 + Math.random() * 120); slapT = setTimeout(slap, (k > .3 ? 260 : 900) + Math.random() * 500); }; slap();
  function setT(k) {
    thr = k; const now = ac.currentTime;
    if (eng) eng.playbackRate.setTargetAtTime(1 + k * 2.4, now, .25);            // ~810 → ~2800 rpm
    out.gain.setTargetAtTime(.32 + k * .18, now, .15);
    wg.gain.setTargetAtTime(.04 + k * .22, now, .3); wf.frequency.setTargetAtTime(400 + k * 900, now, .3);
    whine.frequency.setTargetAtTime(110 + k * 160, now, .3); whg.gain.setTargetAtTime(k * .025, now, .3);
  }
  return { set: setT, stop() { alive = false; clearTimeout(slapT); out.gain.setTargetAtTime(0, ac.currentTime, .25); setTimeout(() => { try { eng && eng.stop(); wash.stop(); whine.stop(); out.disconnect(); } catch {} }, 900); } };
}
// gentle sea: swelling surf, small lapping against the hull, a gull now and then
export function seaAmbience() {
  if (!ac) return { stop() {} };
  const out = ac.createGain(); out.gain.value = 0; out.connect(master); out.gain.setTargetAtTime(.5, ac.currentTime, 1);
  const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 520; const g = ac.createGain(); g.gain.value = .05;
  const lfo = ac.createOscillator(); lfo.frequency.value = .11; const lg = ac.createGain(); lg.gain.value = .04; lfo.connect(lg).connect(g.gain); lfo.start();
  s.connect(f).connect(g).connect(out); s.start();
  let alive = true, t1 = null, t2 = null;
  const lap = () => { if (!alive) return; noise(.25, .035, 700 + Math.random() * 400); t1 = setTimeout(lap, 700 + Math.random() * 1600); }; lap();
  const gull = () => { if (!alive) return; tone(1300, .18, 'sine', .025, 900); tone(1250, .22, 'sine', .02, 820, .25); t2 = setTimeout(gull, 9000 + Math.random() * 12000); }; t2 = setTimeout(gull, 4000);
  return { stop() { alive = false; clearTimeout(t1); clearTimeout(t2); out.gain.setTargetAtTime(0, ac.currentTime, .4); setTimeout(() => { try { s.stop(); lfo.stop(); out.disconnect(); } catch {} }, 1500); } };
}

// ------------------------------------------------------------ music: original kampung tunes, played live by a tiny synth band
// gambus-like plucks for the melody, bonang/gong chimes, a bass and a kompang/gendang groove.
const NOTE = (n) => { const m = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 }; const r = /^([A-G]#?)(\d)$/.exec(n); return 440 * 2 ** ((m[r[1]] + (+r[2] + 1) * 12 - 69) / 12); };
const SONGS = {
  // "Petang di Kampung" — bright, 4/4 at 104 bpm, eighth-note grid (8 per bar)
  kampung: { step: 60 / 104 / 2, per: 8, drum: 'D.PDDP.P', chords: ['C3', 'F2', 'G2', 'C3', 'A2', 'F2', 'G2', 'C3', 'A2', 'E2', 'F2', 'G2', 'C3', 'F2', 'G2', 'C3'],
    mel: [
      'E5 G5 A5 G5 E5 . D5 C5', 'A4 C5 D5 C5 A4 . C5 .', 'B4 D5 G5 F5 E5 D5 B4 .', 'C5 . E5 G5 C6 . . .',
      'A4 C5 E5 A5 G5 E5 C5 .', 'F5 E5 D5 C5 A4 . C5 D5', 'E5 D5 B4 G4 A4 B4 D5 .', 'C5 . G4 . C5 . . .',
      'A5 . G5 E5 G5 . E5 D5', 'E5 . G#4 B4 E5 . D5 .', 'C5 D5 F5 A5 G5 F5 D5 C5', 'B4 . D5 . G5 . F5 .',
      'E5 G5 C6 . A5 G5 E5 .', 'F5 . A5 . G5 F5 D5 .', 'E5 D5 C5 B4 D5 . G4 .', 'C5 . . E5 C5 . . .'],
    chime: [0, 4] },
  // "Angin Laut" — lilting 6/8, A minor, for the sea and the boat
  laut: { step: 60 / 80 / 3, per: 6, drum: 'D..p..', chords: ['A2', 'G2', 'F2', 'E2', 'A2', 'G2', 'F2', 'E2'],
    mel: ['A4 . C5 E5 . D5', 'B4 . D5 G5 . E5', 'A5 . G5 F5 E5 D5', 'E5 . . G#4 . B4', 'C5 . E5 A5 . G5', 'G5 . E5 D5 . B4', 'C5 D5 E5 F5 E5 D5', 'E5 . . A4 . .'],
    chime: [0, 3], pad: true },
};
let mus = null;
function musicOut() { if (!mus.out) { mus.out = ac.createGain(); mus.out.gain.value = 0; mus.out.connect(master); } return mus.out; }
function pluck(f, t, d, v, out) { // gambus-ish: bright attack, quick body decay, slight pitch bend in
  const o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain(), lp = ac.createBiquadFilter();
  o.type = 'triangle'; o2.type = 'sawtooth'; o.frequency.setValueAtTime(f * 1.012, t); o.frequency.exponentialRampToValueAtTime(f, t + .04); o2.frequency.value = f * 2.003;
  const g2 = ac.createGain(); g2.gain.value = .18; lp.type = 'lowpass'; lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(700, t + d);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  o.connect(lp); o2.connect(g2).connect(lp); lp.connect(g).connect(out); o.start(t); o2.start(t); o.stop(t + d + .05); o2.stop(t + d + .05);
}
function chime(f, t, v, out) { // bonang: sine + inharmonic partial, long ring
  for (const [m, a, d] of [[1, 1, 1.6], [2.76, .25, .6], [5.4, .08, .3]]) { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = f * m; g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v * a, t + .005); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g).connect(out); o.start(t); o.stop(t + d + .05); }
}
function bass(f, t, d, v, out) { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g).connect(out); o.start(t); o.stop(t + d + .05); }
function drum(kind, t, out) {
  if (kind === 'D') { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(58, t + .16); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.5, t + .004); g.gain.exponentialRampToValueAtTime(.0001, t + .28); o.connect(g).connect(out); o.start(t); o.stop(t + .32); }
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noiseBuf; f.type = 'bandpass';
  f.frequency.value = kind === 'D' ? 300 : kind === 'P' ? 1700 : 2600; f.Q.value = kind === 'D' ? 1 : 2.5; const v = kind === 'D' ? .12 : kind === 'P' ? .32 : .12, d = kind === 'D' ? .08 : .07;
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); s.connect(f).connect(g).connect(out); s.start(t, Math.random()); s.stop(t + d + .02);
}
function schedule() {
  if (!mus || !mus.song || !ac) return;
  const sg = SONGS[mus.song], out = musicOut();
  while (mus.next < ac.currentTime + .25) {
    const t = mus.next, i = mus.i, bar = Math.floor(i / sg.per) % sg.mel.length, pos = i % sg.per;
    const note = sg.mel[bar].split(' ')[pos]; if (note && note !== '.') pluck(NOTE(note), t, sg.per === 6 ? .7 : .45, .16, out);
    const ch = NOTE(sg.chords[bar % sg.chords.length]);
    if (pos === 0) bass(ch, t, sg.step * (sg.per === 6 ? 2.8 : 3.6), .22, out);
    if (sg.per === 8 && pos === 4) bass(ch * 1.5, t, sg.step * 3.6, .16, out);
    if (sg.per === 6 && pos === 3) bass(ch * 1.5, t, sg.step * 2.8, .14, out);
    if (sg.chime.includes(pos) && (bar % 2 === 0 || pos === 0)) chime(ch * 4 * (pos ? 1.5 : 1), t, .045, out);
    const dk = sg.drum[pos]; if (dk && dk !== '.') drum(dk, t, out);
    if (sg.per === 8 && pos % 2 === 1) drum('s', t, out); // shaker on the off-beats
    if (sg.pad && pos === 0 && bar % 2 === 0) { const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noiseBuf; f.type = 'lowpass'; f.frequency.value = 420; g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.05, t + 1.2); g.gain.exponentialRampToValueAtTime(.0001, t + 3.4); s.connect(f).connect(g).connect(out); s.start(t, Math.random()); s.stop(t + 3.5); }
    mus.i++; mus.next += sg.step * (pos % 2 === 0 ? 1.04 : .96); // a little swing
  }
}
export function playMusic(song) {
  if (!ac) return; if (!mus) mus = { song: null, i: 0, next: 0, out: null, timer: null, level: .55 };
  if (S.music === false) song = null;
  if (mus.song === song) return;
  const out = musicOut(), now = ac.currentTime;
  out.gain.cancelScheduledValues(now); out.gain.setTargetAtTime(0, now, .3);
  clearInterval(mus.timer); mus.song = null;
  if (!song) return;
  setTimeout(() => { if (!ac) return; mus.song = song; mus.i = 0; mus.next = ac.currentTime + .1; out.gain.setTargetAtTime(mus.level, ac.currentTime, .6); mus.timer = setInterval(schedule, 60); schedule(); }, 700);
}
export function musicDuck(on) { if (mus && mus.out && ac) mus.out.gain.setTargetAtTime(on ? mus.level * .4 : mus.level, ac.currentTime, .4); }
export function setMusic(on) { S.music = on; save(); if (mus) { const s = mus.want; playMusic(on ? (s || 'kampung') : null); } }
export function wantMusic(song) { if (!mus) mus = { song: null, i: 0, next: 0, out: null, timer: null, level: .55 }; mus.want = song; playMusic(song); }
