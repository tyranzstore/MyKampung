// KARAOKE BALAI RAYA — Bab 5 rhythm mini-game (DOM + WebAudio, works in both 2D and 3D modes).
// The song "Kampung Kita" is original to this game (melody and lyrics). Notes fall in three lanes (low / mid / high pitch);
// tap the lane as a note reaches the line and your voice sings that syllable. Perfect ±70 ms, Good ±140 ms.
import { $, clamp, sfx, S, save, musicDuck } from './core.js';

// [syllable, lane 0..2, beats]; '|' starts a new lyric line. English shown under each line.
const SONG = { bm: 'Kampung Kita', bpm: 104, lines: [
  ['Di ba-wah la-ngit kam-pung ki-ta', 'Under our village sky', [0, 1, 1, 2, 1, 0, 1, 2, 2]],
  ['Pe-li-ta me-nya-la sa-yup ma-ta', 'Oil lamps glowing as far as the eye can see', [1, 1, 2, 1, 0, 1, 2, 1, 0, 0]],
  ['Ma-ri ber-kum-pul tu-a dan mu-da', 'Come together, old and young', [2, 1, 0, 1, 2, 1, 1, 2, 2, 1]],
  ['Pes-ta ma-lam i-ni mi-lik ki-ta', "Tonight's festival belongs to us", [0, 1, 1, 2, 2, 1, 0, 1, 1, 0]],
  ['Kam-pung ki-ta, kam-pung ki-ta', 'Our village, our village', [1, 2, 2, 1, 1, 2, 2, 1]],
  ['Ha-ti ki-ta sa-tu se-la-ma-nya', 'Our hearts are one forever', [0, 1, 2, 1, 1, 2, 2, 1, 0, 0]],
] };
const LANE_NOTES = [[220, 247, 262], [294, 330, 349], [392, 440, 494]]; // A3..B4 — each lane picks within its range

export function runKaraoke(opts = {}) {
  return new Promise((resolve) => {
    let ac = null; try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { ac = null; }
    const master = ac ? ac.createGain() : null; if (master) { master.gain.value = S.muted ? 0 : .5; master.connect(ac.destination); }
    musicDuck(true);
    // ---- build the chart
    const beat = 60 / SONG.bpm, notes = [], lines = []; let t = 3.2; // lead-in
    SONG.lines.forEach(([txt, en, lanes], li) => {
      const syl = txt.replace(/ /g, ' -').split('-'), start = t; const items = [];
      syl.forEach((s, k) => { const lane = lanes[k % lanes.length], dur = (k === syl.length - 1 ? 2 : 1) * beat * (s.endsWith(' ') ? 1 : .75);
        const n = { t, lane, s: s.trim(), w: s, li, k, hit: null, f: LANE_NOTES[lane][(k + li) % 3] }; notes.push(n); items.push(n); t += dur; });
      lines.push({ txt, en, start, end: t, items }); t += beat * 2;
    });
    const END = t + 1.5;
    // ---- DOM
    const el = document.createElement('div'); el.id = 'karaoke'; document.body.append(el);
    el.innerHTML = `<div class="kStage"><div class="kLights"><i></i><i></i><i></i></div><div class="kBanner">🎤 KARAOKE BALAI RAYA · PESTA KAMPUNG</div>
      <div class="kSinger">🧑‍🎤</div><div class="kBand"><span>🎸<small>Pok Ajis</small></span><span>🥁</span><span>🎹</span></div><div class="kCrowd"></div></div>
      <div class="kTop"><button class="kX" aria-label="Keluar">✕</button><div class="kSong">♪ ${SONG.bm} <small>lagu asal · original song</small></div><div class="kScore"><b>0</b><small>markah</small></div><div class="kCombo"></div></div>
      <div class="kLyric"><div class="bm"></div><div class="en"></div></div>
      <div class="kHwy"><div class="lanes"><i></i><i></i><i></i></div><div class="notes"></div><div class="line"></div>
        <div class="pads"><button data-l="0"><b>♩</b><small>Rendah</small></button><button data-l="1"><b>♪</b><small>Tengah</small></button><button data-l="2"><b>♫</b><small>Tinggi</small></button></div></div>
      <div class="kJudge"></div><div class="kMeter"><i></i></div><div class="kIntro">Ketik lajur bila not sampai garisan · Tap the lane as each note reaches the line<br><b>Sedia…</b></div>`;
    const q = (s) => el.querySelector(s), notesEl = q('.notes'), crowd = q('.kCrowd');
    crowd.innerHTML = Array.from({ length: 18 }, (_, i) => `<span style="--d:${(i % 5) * .13}s">${['🙋', '👨‍🦳', '👩', '🧕', '👦', '👧', '👴', '👵', '🧑'][i % 9]}</span>`).join('');
    const nodes = notes.map(n => { const d = document.createElement('div'); d.className = 'kn l' + n.lane; d.textContent = n.s; notesEl.append(d); return d; });
    // ---- audio: backing (bass + chords + soft drums) and the "voice" for hit notes
    const now = () => ac ? ac.currentTime : performance.now() / 1000; const T0 = now() + .3;
    function tone(f, at, dur, type = 'sine', vol = .12) { if (!ac) return; const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(vol, at + .02); g.gain.exponentialRampToValueAtTime(.001, at + dur); o.connect(g).connect(master); o.start(at); o.stop(at + dur + .05); }
    function noise(at, dur, vol, hp) { if (!ac) return; const b = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length); const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); f.type = 'highpass'; f.frequency.value = hp; g.gain.value = vol; s.buffer = b; s.connect(f).connect(g).connect(master); s.start(at); }
    const CH = [[110, 165, 220, 277], [147, 220, 294, 370], [98, 147, 196, 247], [110, 165, 220, 277]]; // A, D, G, A
    if (ac) for (let b = 0, tt = 0; tt < END; b++, tt += beat) { const at = T0 + tt, c = CH[Math.floor(b / 4) % 4]; if (b % 2 === 0) tone(c[0], at, beat * .9, 'triangle', .18); if (b % 4 === 0) c.slice(1).forEach(f => tone(f, at, beat * 3.6, 'sine', .035)); noise(at, .05, b % 2 ? .05 : .09, b % 2 ? 6000 : 1500); }
    // ---- input
    let score = 0, combo = 0, best = 0, perfect = 0, good = 0, miss = 0, meter = .5, done = false, judgeT = 0;
    const judge = (txt, cls) => { const j = q('.kJudge'); j.textContent = txt; j.className = 'kJudge show ' + cls; judgeT = .45; };
    function hit(lane) {
      if (done) return; const tt = now() - T0; const pad = q(`.pads [data-l="${lane}"]`); pad.classList.add('on'); setTimeout(() => pad.classList.remove('on'), 90);
      let bestN = null, bd = 1; for (const n of notes) { if (n.hit !== null || n.lane !== lane) continue; const d = Math.abs(n.t - tt); if (d < bd) { bd = d; bestN = n; } if (n.t - tt > .3) break; }
      if (!bestN || bd > .14) { combo = 0; meter = Math.max(0, meter - .02); return; }
      const p = bd <= .07; bestN.hit = p ? 2 : 1; p ? perfect++ : good++; combo++; best = Math.max(best, combo); score += (p ? 100 : 60) + Math.min(combo, 30) * 3; meter = Math.min(1, meter + (p ? .04 : .025));
      tone(bestN.f * 2, ac ? ac.currentTime : 0, .35, 'triangle', .14); tone(bestN.f * 4, ac ? ac.currentTime : 0, .2, 'sine', .03);
      judge(p ? 'SEMPURNA!' : 'BAGUS', p ? 'p' : 'g'); nodes[notes.indexOf(bestN)].classList.add('hit');
    }
    el.querySelectorAll('.pads button').forEach(b => b.addEventListener('pointerdown', (e) => { e.preventDefault(); hit(+b.dataset.l); }));
    const KEYS = { KeyA: 0, KeyJ: 0, ArrowLeft: 0, KeyS: 1, KeyK: 1, ArrowDown: 1, KeyD: 2, KeyL: 2, ArrowRight: 2 };
    const onKey = (e) => { if (e.repeat) return; if (KEYS[e.code] !== undefined) { e.preventDefault(); hit(KEYS[e.code]); } else if (e.code === 'Escape') quit(); };
    addEventListener('keydown', onKey);
    q('.kX').onclick = () => quit();
    function quit() { finish(true); }
    // ---- loop
    const LEAD = 2.0; // seconds a note takes to fall
    let raf = 0, last = now();
    function loop() {
      if (done) return; raf = requestAnimationFrame(loop);
      const tt = now() - T0, dt = Math.min(.05, now() - last); last = now();
      const H = q('.kHwy').clientHeight, lineY = H - 74;
      notes.forEach((n, i) => { const d = nodes[i], y = lineY - (n.t - tt) / LEAD * lineY; if (y < -30 || (n.hit !== null && tt - n.t > .25)) { d.style.display = 'none'; } else { d.style.display = ''; d.style.transform = `translateY(${y}px)`; }
        if (n.hit === null && tt - n.t > .16) { n.hit = 0; miss++; combo = 0; meter = Math.max(0, meter - .05); judge('TERLEPAS', 'm'); d.classList.add('miss'); } });
      // lyric: current line with sung syllables highlighted
      const li = lines.findIndex(L => tt < L.end + .6); const L = lines[li < 0 ? lines.length - 1 : li];
      if (L && tt > L.start - 1.6) { q('.kLyric .bm').innerHTML = L.items.map(n => `<span class="${n.hit === 2 || n.hit === 1 ? 'sung' : n.hit === 0 ? 'miss' : tt >= n.t - .05 ? 'now' : ''}">${n.w.replace(/ $/, '&nbsp;')}</span>`).join(''); q('.kLyric .en').textContent = L.en; }
      q('.kScore b').textContent = score; q('.kCombo').textContent = combo >= 5 ? `${combo} kombo!` : ''; q('.kMeter i').style.width = `${meter * 100}%`;
      el.classList.toggle('hype', meter > .75); if (judgeT > 0 && (judgeT -= dt) <= 0) q('.kJudge').classList.remove('show');
      q('.kIntro').style.opacity = tt < 2.6 ? 1 : 0;
      if (tt > END) finish(false);
    }
    loop();
    function finish(quitting) {
      if (done) return; done = true; cancelAnimationFrame(raf); removeEventListener('keydown', onKey);
      const total = notes.length, acc = (perfect + good * .8) / total;
      const stars = quitting ? 0 : acc >= .85 ? 3 : acc >= .6 ? 2 : 1;
      try { master && master.gain.setTargetAtTime(0, ac.currentTime, .2); setTimeout(() => ac && ac.close(), 600); } catch { }
      musicDuck(false);
      if (quitting) { el.remove(); return resolve(null); }
      sfx.good(); if (stars === 3 && sfx.cheer) sfx.cheer();
      el.insertAdjacentHTML('beforeend', `<div class="kEnd"><div class="card"><div class="kick">KARAOKE · ${SONG.bm.toUpperCase()}</div><h2>${stars === 3 ? '🌟 Bintang Kampung!' : stars === 2 ? '👏 Sedap suara!' : '🙂 Boleh tahan!'}</h2>
        <p class="big">${score} markah · ${Math.round(acc * 100)}%</p><p class="muted">Sempurna ${perfect} · Bagus ${good} · Terlepas ${miss} · Kombo terbaik ${best}</p><button class="go">Teruskan · Continue</button></div></div>`);
      q('.kEnd .go').onclick = () => { sfx.tap(); el.remove(); resolve({ stars, score, acc, time: END }); };
    }
  });
}
