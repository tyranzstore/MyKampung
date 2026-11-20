// Mini-games: tebas laman (grass), baiki rumah (repair), cuci kereta (car wash).
// Each runs in a full-screen overlay on a 1000x600 virtual canvas.
import { $, clamp, lerp, sfx, loopSound, toast, mulberry32, S, save } from './core.js';
import { Futsal, Volley, Photo, Drag, Market, Mall, ACTIVITIES } from './activities.js';
import { Futsal3v3 } from './futsal3v3.js';

const VW = 1000, VH = 600;

export class Grid {
  constructor(x, y, w, h, cols, rows, init, maskFn) {
    Object.assign(this, { x, y, w, h, cols, rows, cw: w / cols, chh: h / rows });
    this.v = new Float32Array(cols * rows).fill(init); this.m = new Uint8Array(cols * rows).fill(1); this.n = cols * rows;
    if (maskFn) { this.n = 0; for (let k = 0; k < cols * rows; k++) { const [cx, cy] = this.center(k); this.m[k] = maskFn(cx, cy) ? 1 : 0; this.n += this.m[k]; } }
  }
  center(k) { return [this.x + (k % this.cols + .5) * this.cw, this.y + (Math.floor(k / this.cols) + .5) * this.chh]; }
  each(px, py, r, fn) {
    const c0 = Math.max(0, Math.floor((px - r - this.x) / this.cw)), c1 = Math.min(this.cols - 1, Math.floor((px + r - this.x) / this.cw));
    const r0 = Math.max(0, Math.floor((py - r - this.y) / this.chh)), r1 = Math.min(this.rows - 1, Math.floor((py + r - this.y) / this.chh));
    for (let rr = r0; rr <= r1; rr++) for (let cc = c0; cc <= c1; cc++) {
      const k = rr * this.cols + cc; if (!this.m[k]) continue; const [cx, cy] = this.center(k);
      if ((cx - px) ** 2 + (cy - py) ** 2 <= r * r) fn(k);
    }
  }
  seg(x0, y0, x1, y1, r, fn) {
    const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1e-6;
    const c0 = Math.max(0, Math.floor((Math.min(x0, x1) - r - this.x) / this.cw)), c1 = Math.min(this.cols - 1, Math.floor((Math.max(x0, x1) + r - this.x) / this.cw));
    const r0 = Math.max(0, Math.floor((Math.min(y0, y1) - r - this.y) / this.chh)), r1 = Math.min(this.rows - 1, Math.floor((Math.max(y0, y1) + r - this.y) / this.chh));
    for (let rr = r0; rr <= r1; rr++) for (let cc = c0; cc <= c1; cc++) {
      const k = rr * this.cols + cc; if (!this.m[k]) continue; const [cx, cy] = this.center(k);
      const t = Math.max(0, Math.min(1, ((cx - x0) * dx + (cy - y0) * dy) / L2)), ex = x0 + t * dx - cx, ey = y0 + t * dy - cy;
      if (ex * ex + ey * ey <= r * r) fn(k);
    }
  }
  frac(test) { let ok = 0; for (let k = 0; k < this.v.length; k++) if (this.m[k] && test(this.v[k])) ok++; return this.n ? ok / this.n : 1; }
}


// ------------------------------------------------------------ how-to-play signs (shown before each mini-game, and from the ? button)
const TUTORIAL = {
  grass: ['Tebas Laman', [['⛽', 'Tahan butang untuk tuang minyak sampai garis hijau', 'Hold the button to pour fuel up to the green band'], ['🔴', 'Picit primer 4 kali, kemudian tutup choke', 'Squeeze the primer 4 times, then close the choke'], ['🪢', 'Seret pemegang T ke bawah laju-laju (2 kali), kemudian buka choke', 'Drag the T handle down fast (twice), then open the choke'], ['🌿', 'Tekan & seret untuk tebas — kau berjalan ikut mesin', 'Press & drag to cut — you walk with the cutter'], ['🗑️', 'Seret longgok rumput ke plastik hitam, kemudian ketik plastik untuk ikat', 'Drag the grass heaps into the black bag, then tap the bag to tie it']]],
  repair: ['Baiki Rumah', [['🧽', 'Seret pengikis untuk kikis cat lama', 'Drag the scraper to remove the old paint'], ['🎨', 'Pilih warna di bawah, kemudian seret untuk cat', 'Pick a colour below, then drag to paint'], ['🔩', 'Seret zink baru ke lubang di bumbung', 'Drag new zinc sheets over the roof holes'], ['🔨', 'Ketik setiap paku bila bulatan jadi hijau', 'Tap each nail when the ring turns green']]],
  carwash: ['Cuci Kereta', [['🚿', 'Seret hos untuk bilas habuk', 'Drag the hose to rinse off the dust'], ['🧴', 'Sapu sabun ke seluruh kereta', 'Spread soap over the whole car'], ['🧽', 'Gosok tompok lumpur berulang-ulang', 'Rub the mud spots back and forth'], ['🚿', 'Bilas semua buih', 'Rinse off all the foam'], ['🧻', 'Lap sampai kering berkilat', 'Wipe it dry until it shines']]],
  padi: ['Tuai Padi', [['🌾', 'Seret sabit merentasi rumpun padi', 'Swipe the sickle across the padi clumps'], ['👐', 'Ketik setiap berkas untuk kumpul ke tikar', 'Tap each bundle to gather it onto the mat'], ['🪵', 'Ketik bila penanda kuning dalam zon hijau — 8 kali untuk penuhkan tong', 'Tap when the yellow marker is in the green zone — 8 good hits fill the tub']]],
  boat: ['Baiki Bot', [['🪨', 'Seret pengikis untuk buang teritip & lumut', 'Drag the scraper to remove barnacles & moss'], ['🪵', 'Seret papan tampal dari peti ke setiap lubang', 'Drag a wooden patch from the crate onto each hole'], ['🎨', 'Pilih warna, kemudian cat seluruh bot', 'Pick a colour, then paint the whole boat']]],
  beach: ['Bersih Pantai', [['🖐️', 'Tekan sampah di pasir dan seret', 'Press a piece of rubbish on the sand and drag it'], ['♻️', 'Botol plastik, tin dan kaca → tong biru KITAR SEMULA', 'Plastic bottles, cans and glass → blue RECYCLING bin'], ['🗑️', 'Beg plastik, straw, polistirena dan pembalut → tong hijau SAMPAH AM', 'Plastic bags, straws, styrofoam and wrappers → green GENERAL WASTE bin'], ['🦀', 'Salah tong = sampah melantun balik. Kutip semua untuk siap!', 'Wrong bin = it bounces back. Pick up everything to finish!']]],
  futsal: ['Sepakan Penalti', [['🎯', 'Seret di skrin untuk gerakkan sasaran dalam gol', 'Drag on the screen to move the target in the goal'], ['💪', 'Tahan TENDANG untuk kuasa, lepas untuk sepak — terlalu kuat = tersasar', 'Hold SHOOT for power, release to kick — too much power = wild'], ['🧤', 'Giliran lawan: pilih KIRI / TENGAH / KANAN untuk terjun', "Their turn: pick LEFT / CENTRE / RIGHT to dive"], ['🏆', '5 pusingan, mati mengejut jika seri', '5 rounds, sudden death if level']]],
  volley: ['Bola Tampar Pantai 2v2', [['🕹️', 'Kayu bedik kiri: bergerak. Mod pemula bawa anda ke bulatan hijau', 'Left stick moves you. Beginner mode guides you to the green spot'], ['🏐', 'SERVIS: tahan, lepas bila meter tinggi (kuning = servis lompat)', 'SERVE: hold and release; yellow zone = jump serve'], ['🙌', 'TERIMA / SET bila bola sampai di bulatan hijau', 'RECEIVE / SET when the ball reaches the green spot'], ['💥', 'REJAM: tekan bila penanda masuk zon hijau. Kayu bedik untuk arah', 'SPIKE: press when the marker hits the green zone; stick aims'], ['🧱', 'BLOK di jaring · SELAM bila bola jauh', 'BLOCK at the net · DIVE for far balls']]],
  photo: ['Simulator Foto 3D', [['👆', 'Seret: putar kamera · Cubit: zum · 2 jari: alih · Ketik: fokus', 'Drag: orbit · Pinch: zoom · Two fingers: pan · Tap: focus'], ['✌️', 'Pilih gaya di bawah · ⟲ ⟳ pusing watak', 'Pick a pose below · ⟲ ⟳ rotates your hero'], ['📍', 'Tukar lokasi & waktu di atas · 🎛️ untuk penapis & bingkai', 'Change place & time at the top · 🎛️ for filters & frames'], ['📸', 'Snap → Simpan ke galeri. Siapkan misi foto untuk RM', 'Snap → Save to the gallery. Complete photo missions for RM']]],
  drag: ['Lumba Drag 402m', [['🚦', 'Ketik untuk mula, tunggu 3 lampu kuning…', 'Tap to stage, wait for the 3 amber lights…'], ['🟢', 'Ketik tepat bila lampu hijau — jangan lompat lampu!', 'Tap right on green — no jump starts!'], ['⚙️', 'Ketik untuk tukar gear bila jarum dalam zon hijau', 'Tap to shift when the needle is in the green zone'], ['🏁', 'Kalahkan pelumba merah ke garisan 402m', 'Beat the red car to the 402 m line']]],
  market: ['Pasar Malam', [['🧑‍🍳', 'Peniaga: ikut pesanan, serah makanan, beri baki tepat — layan 6 pelanggan', 'Seller: follow the order, hand over food, give exact change — serve 6 customers'], ['🛍️', 'Pembeli: beli 4 barang dalam senarai dengan duit dalam dompet', 'Buyer: buy the 4 things on your list with your wallet'], ['🤝', 'Cuba tawar harga — kadang-kadang dapat kurang seringgit!', 'Try bargaining — sometimes you get RM1 off!']]],
  mall: ['Misi Beli-belah', [['📝', 'Lihat senarai barang di atas', 'Check your shopping list at the top'], ['👆', 'Seret ke kiri/kanan untuk pusing dalam mall', 'Drag left/right to look around the mall'], ['🛒', 'Ketik rak yang betul untuk ambil barang', 'Tap the right shelf to pick up each item'], ['💳', 'Bila semua dah ada, ketik kaunter untuk bayar', 'When you have everything, tap the checkout to pay']]],
  futsal3v3: ['Perlawanan 3v3', [['🕹️', 'Kayu bedik kiri untuk gerak (WASD)', 'Left joystick to move (WASD)'], ['➜', 'PAS (J): ketik = hantaran, tahan = bola tembus', 'PASS (J): tap = pass, hold = through ball'], ['⚽', 'TENDANG (K): tahan untuk kuasa, arah kayu bedik = sudut & lengkung', 'SHOOT (K): hold for power, stick direction = corner & curve'], ['⚡', 'LARI (Shift) · SKIL (L) pusingan · Bertahan: TEKEL / TUKAR', 'SPRINT (Shift) · SKILL (L) feint · Defending: TACKLE / SWITCH']]],
  jalandrag: ['Jalan Drag', [['🔧', 'Garaj: pilih kenderaan, beli & pasang alat ganti dengan RM', 'Garage: pick a vehicle, buy and fit parts with RM'], ['🔥', 'Kotak burnout: tahan BURNOUT + GAS untuk panaskan tayar', 'Burnout box: hold BURNOUT + GAS to heat the tyres'], ['🚦', 'Tahan GAS untuk RPM lancar. Bila lampu HIJAU tekan LANCAR!', 'Hold GAS for launch rpm. On GREEN press LAUNCH!'], ['▲', 'Tukar gear bila lampu biru berkelip (manual)', 'Shift up when the blue lights flash (manual)'], ['💜', 'NITRO untuk tolakan tambahan · Nitrous for extra push', 'Win races to earn RM']]],
  seafish: ['Simulator Pancing Laut', [['🎣', 'LEMPAR: tahan untuk kuasa, lepas untuk lempar · TURUN: umpan terus ke dasar', 'CAST: hold for power, release · DROP: bottom-fish straight down'], ['🦐', 'UMPAN: tukar udang, sotong, umpan hidup atau gewang', 'BAIT: prawn, squid, live bait or lure'], ['⚡', 'Bila hujung joran sentap kuat — tekan SENTAP!', 'When the rod tip slams down — press STRIKE!'], ['🌀', 'Tahan KARAU. Jaga meter tegang: merah = tali putus, kelabu = ikan lepas', 'Hold REEL. Watch tension: red snaps the line, grey lets the fish off'], ['⚖️', 'DRAG −/+: ikan besar tarik tali bila tarikan > drag', 'DRAG −/+: big fish take line when they pull harder than the drag'], ['🚤', 'NAIK BOT → ANGKAT SAUH, kayu bedik untuk belayar, LABUH untuk memancing, TUNDA untuk trolling', 'BOARD → RAISE ANCHOR, joystick to sail, ANCHOR to fish, TROLL to drag a lure']]],
  fish: ['Memancing', [['📍', 'Pilih tempat: Pantai, Terumbu Karang atau Laut Dalam', 'Choose a spot: Shallows, Coral reef or Deep sea'], ['🎯', 'Tekan & tahan untuk kuasa, seret untuk arah, lepas untuk lempar', 'Press & hold for power, drag to aim, release to cast'], ['🐟', 'Kamera ikut umpan ke dasar laut — tunggu ikan mencuit, ketik bila ia sambar umpan', 'The camera follows the bait underwater — wait through the nibbles, tap when the fish takes it'], ['🎣', 'Tahan untuk gulung, lepas bila tali jadi merah', 'Hold to reel, let go when the line turns red'], ['↔️', 'Bila ikan lari, seret ke arah bertentangan', 'When the fish runs, drag the opposite way']]],
};
export function tutorial(kind, api, auto) {
  const d = TUTORIAL[kind]; if (!d) return;
  const seen = S.tutSeen || (S.tutSeen = {});
  if (auto && seen[kind]) return;
  let el = $('gTut'); if (!el) { el = document.createElement('div'); el.id = 'gTut'; $('game').append(el); }
  el.innerHTML = `<div class="tutCard"><div class="kick">CARA MAIN · HOW TO PLAY</div><h2>${d[0]}</h2><ol>${d[1].map(([ic, bm, en], k) => `<li><i>${ic}</i><b>${k + 1}</b><span>${bm}<small>${en}</small></span></li>`).join('')}</ol>
    <button id="tutGo">Mula! · Start!</button><p class="tutNote">Ketik <b>?</b> di atas untuk lihat semula · Tap <b>?</b> above to see this again</p></div>`;
  const hd = document.querySelector('#game .gHead'); el.style.top = `${hd ? hd.offsetHeight : 56}px`;
  el.hidden = false; api.pause && api.pause(true);
  $('tutGo').onclick = () => { sfx.tap(); el.hidden = true; seen[kind] = true; save(); api.pause && api.pause(false); };
}
export function setupHelp(kind, api) {
  const b = $('gHelp'); if (b) { b.hidden = !TUTORIAL[kind]; b.onclick = () => { sfx.tap(); tutorial(kind, api, false); }; }
  tutorial(kind, api, true);
}
export function hideTutorial() { const el = $('gTut'); if (el) el.hidden = true; }

// ------------------------------------------------------------ progress bar: a finished step always shows a full 100% bar before it resets
export function progressBar() {
  let shown = 0, hold = 0, pending = null;
  const set = (f) => { shown = f; const b = $('gBar'), t = $('gPct'); if (b) { b.style.width = `${f * 100}%`; b.classList.toggle('full', f >= 1); } if (t) t.textContent = `${Math.floor(f * 100 + 1e-6)}%`; };
  return {
    progress(f) { f = clamp(f || 0, 0, 1); const now = performance.now();
      if (f === 0 && shown > .3 && now >= hold) { set(1); hold = now + 650; pending = 0; return; }
      if (now < hold) { pending = f; return; } set(f); },
    tick() { if (pending !== null && performance.now() >= hold) { const f = pending; pending = null; set(f); } },
    full() { pending = null; hold = 0; set(1); },
    reset() { pending = null; hold = 0; set(0); },
  };
}

// ------------------------------------------------------------ framework
export function runGame(kind, opts = {}) {
  return new Promise((resolve) => {
    const ov = $('game'), cv = $('gcv'), c = cv.getContext('2d');
    ov.hidden = false;
    let scale = 1, offX = 0, offY = 0, dpr = 1, alive = true, tStart = performance.now(), last = performance.now(), paused = 0, pauseAt = 0;
    const ptr = { x: 0, y: 0, down: false, px: 0, py: 0, lx: 0, ly: 0, mv: 0, moved: 0 };
    function fit() {
      dpr = Math.min(devicePixelRatio || 1, 2); const w = cv.clientWidth, h = cv.clientHeight; cv.width = w * dpr; cv.height = h * dpr;
      scale = Math.min(w / VW, h / VH); offX = (w - VW * scale) / 2; offY = (h - VH * scale) / 2;
    }
    fit(); addEventListener('resize', fit);
    const toV = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left - offX) / scale, y: (e.clientY - r.top - offY) / scale }; };
    const bar = progressBar(); let finishing = false;
    const api = {
      step(bm, en) { $('gStep').innerHTML = ''; $('gStep').append(bm); const s = document.createElement('small'); s.textContent = en; $('gStep').append(s); },
      progress(f) { bar.progress(f); },
      tools(list) { const t = $('gTools'); t.innerHTML = ''; for (const it of list) { const b = document.createElement('button'); b.innerHTML = it.html; if (it.sel) b.classList.add('sel'); if (it.on) b.onclick = () => it.on(b); else b.disabled = true; t.append(b); } },
      elapsed() { const n = performance.now(); return (n - tStart - paused - (pauseAt ? n - pauseAt : 0)) / 1000; },
      pause(on) { if (on) { if (!pauseAt) pauseAt = performance.now(); } else if (pauseAt) { paused += performance.now() - pauseAt; pauseAt = 0; } },
      finish(result) { if (!alive) return; const time = api.elapsed(); bar.full(); finishing = true; setTimeout(() => { if (!alive) return; alive = false; cleanup(); resolve({ ...result, time }); }, 700); },
    };
    $('gTitle').textContent = ({ grass: 'Tebas Laman', repair: 'Baiki Rumah', carwash: 'Cuci Kereta', padi: 'Tuai Padi', boat: 'Baiki Bot', fish: 'Memancing', beach: 'Bersih Pantai', futsal3v3: 'Perlawanan 3v3 · Futsal' }[kind] || (ACTIVITIES[kind] || {}).title);
    $('gTools').innerHTML = ''; bar.reset();
    const game = { grass: Grass, repair: Repair, carwash: CarWash, padi: Padi, boat: Boat, fish: Fishing, beach: Beach, futsal: Futsal, volley: Volley, photo: Photo, drag: Drag, market: Market, mall: Mall, futsal3v3: Futsal3v3 }[kind](api, opts);
    window.__mg = game; setupHelp(kind, api);
    const down = (e) => { e.preventDefault(); if (finishing) return; cv.setPointerCapture(e.pointerId); const p = toV(e); Object.assign(ptr, p, { down: true, px: p.x, py: p.y, lx: p.x, ly: p.y, mv: 0, moved: 0 }); framesDown = 0; upPending = false; game.down && game.down(ptr); };
    const move = (e) => { const p = toV(e); ptr.px = ptr.x; ptr.py = ptr.y; ptr.x = p.x; ptr.y = p.y; if (ptr.down) ptr.moved += Math.hypot(ptr.x - ptr.px, ptr.y - ptr.py); game.move && game.move(ptr); };
    let framesDown = 0, upPending = false;
    const doUp = () => { upPending = false; if (!ptr.down) return; ptr.down = false; game.up && game.up(ptr); };
    const upE = () => { if (!ptr.down) return; if (framesDown < 1) { upPending = true; return; } doUp(); };
    cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', upE); cv.addEventListener('pointercancel', upE);
    $('gClose').onclick = () => { if (!alive) return; alive = false; cleanup(); resolve(null); };
    function cleanup() {
      ov.hidden = true; hideTutorial(); removeEventListener('resize', fit); game.stop && game.stop();
      cv.removeEventListener('pointerdown', down); cv.removeEventListener('pointermove', move); cv.removeEventListener('pointerup', upE); cv.removeEventListener('pointercancel', upE);
    }
    function loop(now) {
      if (!alive) return; requestAnimationFrame(loop); bar.tick();
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      ptr.mv = ptr.down ? Math.min(120, Math.hypot(ptr.x - ptr.lx, ptr.y - ptr.ly)) : 0;
      game.update(dt, ptr);
      ptr.lx = ptr.x; ptr.ly = ptr.y;
      if (ptr.down) framesDown++;
      if (upPending) doUp();
      c.setTransform(dpr, 0, 0, dpr, 0, 0); c.fillStyle = '#183d36'; c.fillRect(0, 0, cv.width, cv.height);
      c.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offX, dpr * offY);
      c.save(); c.beginPath(); c.roundRect(0, 0, VW, VH, 18); c.clip(); game.draw(c); c.restore();
      $('gTimer').textContent = game.timerText ? game.timerText() : `⏱ ${Math.floor(api.elapsed())}s`;
    }
    requestAnimationFrame(loop);
  });
}

function particles() {
  const list = [];
  return {
    add(x, y, vx, vy, col, life = .7, size = 3) { if (list.length < 400) list.push({ x, y, vx, vy, col, life, max: life, size }); },
    update(dt, g = 600) { for (let i = list.length - 1; i >= 0; i--) { const p = list[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += g * dt; if (p.life <= 0) list.splice(i, 1); } },
    draw(c) { for (const p of list) { c.globalAlpha = clamp(p.life / p.max, 0, 1); c.fillStyle = p.col; c.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); } c.globalAlpha = 1; },
  };
}
const starsFor = (v, a, b) => (v <= a ? 3 : v <= b ? 2 : 1);

// ------------------------------------------------------------ 1. TEBAS LAMAN
function Grass(api, opts) {
  const r = mulberry32(opts.seed || 3);
  let phase = 'fuel', fuel = 0, fuelAnim = 0, primes = 0, squish = 0, pulls = 0, cord = 0, pullStart = null, engine = null, running = 0;
  const grid = new Grid(40, 90, 920, 480, 46, 24, 1);
  for (let k = 0; k < grid.v.length; k++) grid.v[k] = .75 + r() * .25;
  const parts = particles();
  let piles = [], held = null, bagFill = 0, tied = false, cutDone = 0;
  const BAG = { x: 900, y: 500 };
  const M = { x: 500, y: 300 }; // machine anchor
  const can = { x: 840, y: 440 }, bulb = { x: M.x + 30, y: M.y + 10 }, grip = { x: M.x + 150, y: M.y - 10 };
  api.step('Isi minyak dulu — ketik tin minyak', 'Fill the fuel first — tap the fuel can');

  function drawYard(c) {
    c.fillStyle = '#6aae4c'; c.fillRect(0, 0, VW, VH);
    c.fillStyle = '#9a6b44'; c.fillRect(0, 0, VW, 70);
    for (let x = 0; x < VW; x += 26) { c.fillStyle = x % 52 ? '#8a5f3c' : '#a87a50'; c.fillRect(x, 0, 24, 62); }
    c.fillStyle = '#6b4a33'; for (const x of [120, 480, 860]) c.fillRect(x, 60, 14, 30);
    // grass
    const tall = new Path2D(), mid = new Path2D(); c.lineWidth = 2.2;
    for (let k = 0; k < grid.v.length; k++) {
      const h = grid.v[k], [x, y] = grid.center(k);
      if (h > .2) { const p = h > .6 ? tall : mid, len = 6 + h * 20, sw = Math.sin(k * 1.7) * 4; p.moveTo(x - 5, y + 9); p.lineTo(x - 5 + sw, y + 9 - len); p.moveTo(x + 4, y + 9); p.lineTo(x + 4 - sw * .7, y + 9 - len * .85); p.moveTo(x, y + 9); p.lineTo(x + sw * .4, y + 9 - len * .7); }
    }
    c.fillStyle = '#93d46e'; for (let k = 0; k < grid.v.length; k++) if (grid.v[k] <= .2) { const [x, y] = grid.center(k); c.fillRect(x - 10, y - 9, 20, 20); }
    c.strokeStyle = '#4f9a3c'; c.stroke(mid); c.strokeStyle = '#2f7a2a'; c.stroke(tall);
  }
  function drawMachine(c) {
    const { x, y } = M;
    c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(x + 40, y + 150, 260, 26, 0, 0, 7); c.fill();
    c.strokeStyle = '#888'; c.lineWidth = 10; c.beginPath(); c.moveTo(x + 60, y + 30); c.lineTo(x - 260, y + 140); c.stroke();
    c.fillStyle = '#444'; c.beginPath(); c.arc(x - 262, y + 142, 26, 0, 7); c.fill(); c.fillStyle = '#e67e22'; c.fillRect(x - 280, y + 118, 30, 14);
    c.fillStyle = '#e67e22'; c.beginPath(); c.roundRect(x - 20, y - 40, 160, 110, 22); c.fill();
    c.fillStyle = '#c0601a'; c.beginPath(); c.roundRect(x, y + 40, 120, 26, 8); c.fill();
    // fuel tank window
    c.fillStyle = '#333'; c.beginPath(); c.roundRect(x + 70, y - 28, 56, 34, 8); c.fill();
    c.fillStyle = '#f6c343'; c.fillRect(x + 74, y + 2 - 26 * fuel, 48, 26 * fuel);
    // primer bulb
    c.fillStyle = 'rgba(255,255,255,.75)'; c.strokeStyle = '#999'; c.lineWidth = 2; c.beginPath(); c.ellipse(bulb.x, bulb.y, 16 - squish * 5, 14 - squish * 6, 0, 0, 7); c.fill(); c.stroke();
    if (primes) { c.fillStyle = 'rgba(246,195,67,.8)'; c.beginPath(); c.ellipse(bulb.x, bulb.y + 4, 12 * Math.min(1, primes / 3), 7 * Math.min(1, primes / 3), 0, 0, 7); c.fill(); }
    // cord + grip
    const gy = grip.y + cord;
    c.strokeStyle = '#ddd'; c.lineWidth = 2; c.beginPath(); c.moveTo(grip.x - 10, grip.y); c.lineTo(grip.x, gy); c.stroke();
    c.fillStyle = phase === 'pull' ? '#ffd452' : '#222'; c.beginPath(); c.roundRect(grip.x - 26, gy - 6, 52, 16, 8); c.fill();
    if (running) { c.fillStyle = 'rgba(180,180,180,.5)'; for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(x - 30 - k * 14, y - 30 - k * 12 + Math.sin(performance.now() / 90 + k) * 4, 8 + k * 3, 0, 7); c.fill(); } }
    // fuel can
    c.save(); c.translate(can.x, can.y); c.rotate(-fuelAnim * .8);
    c.fillStyle = '#c0392b'; c.beginPath(); c.roundRect(-40, -50, 80, 100, 10); c.fill(); c.fillStyle = '#922b21'; c.fillRect(-20, -66, 22, 18); c.fillStyle = '#fff'; c.font = '800 13px system-ui'; c.textAlign = 'center'; c.fillText('MINYAK', 0, 6);
    c.restore();
    if (phase === 'fuel' || phase === 'primer' || phase === 'pull') {
      const target = phase === 'fuel' ? can : phase === 'primer' ? bulb : { x: grip.x, y: grip.y + 30 };
      const b = Math.sin(performance.now() / 160) * 6;
      c.fillStyle = '#ffd452'; c.strokeStyle = '#1d2a24'; c.lineWidth = 3; c.beginPath(); const ty = target.y - (phase === 'pull' ? -50 : 70) + b;
      if (phase === 'pull') { c.moveTo(target.x, ty + 24); c.lineTo(target.x - 16, ty); c.lineTo(target.x - 7, ty); c.lineTo(target.x - 7, ty - 24); c.lineTo(target.x + 7, ty - 24); c.lineTo(target.x + 7, ty); c.lineTo(target.x + 16, ty); }
      else { c.moveTo(target.x, ty + 24); c.lineTo(target.x - 16, ty); c.lineTo(target.x + 16, ty); }
      c.closePath(); c.fill(); c.stroke();
    }
  }
  return {
    dbg: () => ({ phase, piles, BAG, can, bulb, grip }),
    down(p) {
      if (phase === 'fuel' && Math.hypot(p.x - can.x, p.y - can.y) < 70 && !fuelAnim) { fuelAnim = .001; sfx.pop(); }
      else if (phase === 'primer' && Math.hypot(p.x - bulb.x, p.y - bulb.y) < 40) { primes++; squish = 1; sfx.pop(); if (primes >= 3) { phase = 'pull'; api.step('Tarik tali laju-laju ke bawah!', 'Yank the cord down — fast!'); } }
      else if (phase === 'pull' && Math.hypot(p.x - grip.x, p.y - grip.y) < 60) pullStart = { y: p.y, t: performance.now() };
      else if (phase === 'bag') { for (const pl of piles) if (!pl.done && Math.hypot(p.x - pl.x, p.y - pl.y) < 46) { held = pl; sfx.tap(); break; } }
      else if (phase === 'tie' && Math.hypot(p.x - BAG.x, p.y - BAG.y) < 80) { tied = true; sfx.bag(); sfx.good(); const t = api.elapsed(); setTimeout(() => api.finish({ stars: starsFor(t, 55, 85) }), 700); phase = 'done'; }
    },
    move(p) { if (pullStart) cord = clamp(p.y - pullStart.y, 0, 220); if (held) { held.x = p.x; held.y = p.y; } },
    up(p) {
      if (pullStart) {
        const dist = p.y - pullStart.y, dur = (performance.now() - pullStart.t) / 1000; pullStart = null; cord = 0;
        if (dist > 150 && dur < .5) {
          pulls++; sfx.pull();
          if (pulls === 1) { sfx.cough(); toast('Hampir! Tarik lagi!', 'Almost! Pull again!'); }
          else { running = 1; phase = 'cut'; engine = loopSound('engine'); engine.set(.12, 70); api.step('Tekan & seret untuk tebas rumput', 'Press and drag to cut the grass'); }
        } else if (dist > 40) { sfx.cough(); toast('Lagi laju!', 'Faster!'); }
      }
      if (held) {
        if (Math.hypot(held.x - BAG.x, held.y - BAG.y) < 90) { held.done = true; bagFill++; sfx.bag(); api.progress(bagFill / piles.length); if (bagFill === piles.length) { phase = 'tie'; api.step('Ketik beg untuk ikat', 'Tap the bag to tie it up'); } }
        held = null;
      }
    },
    update(dt, p) {
      if (fuelAnim) { fuelAnim = Math.min(1, fuelAnim + dt * 1.6); fuel = Math.min(1, fuel + dt * .9); if (fuel >= 1 && phase === 'fuel') { phase = 'primer'; fuelAnim = 0; api.step('Pam primer 3 kali', 'Press the primer bulb 3 times'); } }
      squish = Math.max(0, squish - dt * 5);
      if (phase === 'cut') {
        let cutting = false;
        const mv = p.mv;
        if (p.down) grid.seg(p.lx, p.ly, p.x, p.y, 46, (k) => { if (grid.v[k] > .2) { grid.v[k] -= dt * 9 + mv * .025; cutting = true; if (Math.random() < .25) { const [x, y] = grid.center(k); parts.add(x, y, (Math.random() - .5) * 300, -150 - Math.random() * 200, Math.random() > .5 ? '#3a8a2a' : '#7cc35a', .6, 4); } } });
        engine && engine.set(.12, cutting ? 110 : p.down ? 85 : 70);
        const f = grid.frac(v => v <= .2); api.progress(f / .96);
        if (f >= .96) {
          phase = 'bag'; engine && engine.stop(); engine = null; running = 0; cutDone = api.elapsed();
          for (let k = 0; k < grid.v.length; k++) grid.v[k] = Math.min(grid.v[k], .15);
          piles = []; for (let k = 0; k < 6; k++) piles.push({ x: 120 + (k % 3) * 220 + r() * 60, y: 200 + Math.floor(k / 3) * 190 + r() * 40, done: false });
          api.progress(0); api.step('Masukkan longgok rumput ke dalam plastik hitam', 'Drag the grass piles into the black bag'); sfx.good();
        }
      }
      parts.update(dt);
    },
    draw(c) {
      drawYard(c);
      if (phase === 'fuel' || phase === 'primer' || phase === 'pull') { c.fillStyle = 'rgba(24,61,54,.35)'; c.fillRect(0, 0, VW, VH); drawMachine(c); }
      if (phase === 'cut') {
        const p = { x: lastP.x, y: lastP.y };
        c.strokeStyle = '#888'; c.lineWidth = 9; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x + 190, p.y + 180); c.stroke();
        c.fillStyle = '#e67e22'; c.beginPath(); c.roundRect(p.x + 170, p.y + 160, 70, 50, 12); c.fill();
        c.save(); c.translate(p.x, p.y); c.rotate(performance.now() / 30); c.strokeStyle = '#ffd452'; c.lineWidth = 3; c.beginPath(); c.moveTo(-40, 0); c.lineTo(40, 0); c.moveTo(0, -40); c.lineTo(0, 40); c.stroke(); c.restore();
        c.fillStyle = '#333'; c.beginPath(); c.arc(p.x, p.y, 13, 0, 7); c.fill();
      }
      if (phase === 'bag' || phase === 'tie' || phase === 'done') {
        for (const pl of piles) if (!pl.done) { c.fillStyle = '#5b9a3a'; c.beginPath(); c.ellipse(pl.x, pl.y, 40, 22, 0, 0, 7); c.fill(); c.fillStyle = '#7fbf4f'; c.beginPath(); c.ellipse(pl.x - 6, pl.y - 6, 26, 13, 0, 0, 7); c.fill(); }
        const s = 1 + bagFill * .07;
        c.fillStyle = '#1b1b1f'; c.beginPath(); c.ellipse(BAG.x, BAG.y, 60 * s, 70 * s, 0, 0, 7); c.fill();
        c.fillStyle = '#2a2a30'; c.beginPath(); c.ellipse(BAG.x - 14, BAG.y - 20, 20 * s, 30 * s, 0, 0, 7); c.fill();
        if (tied) { c.fillStyle = '#f1c40f'; c.fillRect(BAG.x - 18, BAG.y - 76 * s, 36, 10); }
        else { c.strokeStyle = '#000'; c.lineWidth = 4; c.beginPath(); c.ellipse(BAG.x, BAG.y - 66 * s, 44, 10, 0, 0, 7); c.stroke(); }
      }
      parts.draw(c);
    },
    stop() { engine && engine.stop(); },
  };
}
const lastP = { x: 500, y: 300 };
function trackPointer(e) {
  const cv = document.getElementById('gcv'); if (!cv || cv.offsetParent === null) return;
  const r = cv.getBoundingClientRect(), s = Math.min(r.width / VW, r.height / VH), ox = (r.width - VW * s) / 2, oy = (r.height - VH * s) / 2;
  lastP.x = (e.clientX - r.left - ox) / s; lastP.y = (e.clientY - r.top - oy) / s;
}
addEventListener('pointermove', trackPointer, true);
addEventListener('pointerdown', trackPointer, true);

// ------------------------------------------------------------ 2. BAIKI RUMAH
const PAINTS = ['#c48a58', '#7fb7a4', '#f2d37a', '#e8a0a8', '#8fb4e3'];
function Repair(api) {
  const WALL = { x: 140, y: 70, w: 720, h: 400 }, WIN = { x: 410, y: 160, w: 180, h: 170 };
  const inWin = (x, y) => x > WIN.x && x < WIN.x + WIN.w && y > WIN.y && y < WIN.y + WIN.h;
  const old = new Grid(WALL.x, WALL.y, WALL.w, WALL.h, 36, 20, 1, (x, y) => !inWin(x, y));
  const paint = new Grid(WALL.x, WALL.y, WALL.w, WALL.h, 36, 20, 0, (x, y) => !inWin(x, y));
  const r = mulberry32(9); for (let k = 0; k < old.v.length; k++) old.v[k] = .6 + r() * .4;
  const parts = particles();
  let phase = 'scrape', color = PAINTS[1], scrub = null, misses = 0, t = 0;
  const holes = [{ x: 260, y: 280 }, { x: 500, y: 250 }, { x: 740, y: 290 }].map(h => ({ ...h, sheet: false, nails: [{ dx: -50, dy: 0, done: false, flash: 0 }, { dx: 50, dy: 0, done: false, flash: 0 }] }));
  let carry = null;
  const STACK = { x: 930, y: 470 };
  api.step('Kikis cat lama — seret pengikis', 'Scrape off the old paint — drag the scraper');
  const swatchTools = () => api.tools(PAINTS.map(col => ({ html: `<span class="sw" style="background:${col}"></span>`, sel: col === color, on: (b) => { color = col; sfx.tap(); swatchTools(); } })));

  function drawWall(c) {
    c.fillStyle = '#9fd3e8'; c.fillRect(0, 0, VW, VH);
    c.fillStyle = '#77b968'; c.fillRect(0, 500, VW, 100);
    c.fillStyle = '#b07e52'; c.fillRect(WALL.x, WALL.y, WALL.w, WALL.h);
    for (let y = WALL.y; y < WALL.y + WALL.h; y += 25) { c.fillStyle = 'rgba(0,0,0,.1)'; c.fillRect(WALL.x, y, WALL.w, 2); }
    // painted / old layers
    for (let k = 0; k < old.v.length; k++) {
      if (!old.m[k]) continue; const [x, y] = old.center(k);
      if (paint.v[k] > 0) { c.globalAlpha = paint.v[k]; c.fillStyle = color; c.fillRect(x - 10.5, y - 10.5, 21, 21); }
      if (old.v[k] > .05) { c.globalAlpha = old.v[k] * .9; c.fillStyle = (k * 7) % 5 ? '#a9bfc8' : '#93aab4'; c.fillRect(x - 10.5, y - 10.5, 21, 21); }
    }
    c.globalAlpha = 1;
    if (phase === 'scrape') { c.strokeStyle = 'rgba(60,60,60,.35)'; c.lineWidth = 1.2; for (let k = 0; k < 40; k++) { const x = WALL.x + (k * 173) % WALL.w, y = WALL.y + (k * 97) % WALL.h; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 18, y + 7); c.lineTo(x + 26, y - 4); c.stroke(); } }
    c.fillStyle = '#2d4a52'; c.fillRect(WIN.x, WIN.y, WIN.w, WIN.h); c.strokeStyle = '#5a3b26'; c.lineWidth = 10; c.strokeRect(WIN.x, WIN.y, WIN.w, WIN.h);
    c.beginPath(); c.moveTo(WIN.x + WIN.w / 2, WIN.y); c.lineTo(WIN.x + WIN.w / 2, WIN.y + WIN.h); c.stroke();
    c.fillStyle = '#6b4a33'; c.fillRect(WALL.x - 20, WALL.y + WALL.h, WALL.w + 40, 16);
    for (const x of [WALL.x, WALL.x + WALL.w / 2, WALL.x + WALL.w]) c.fillRect(x - 8, WALL.y + WALL.h + 16, 16, 30);
  }
  function drawRoof(c) {
    c.fillStyle = '#9fd3e8'; c.fillRect(0, 0, VW, VH);
    c.fillStyle = '#8a6242'; c.beginPath(); c.moveTo(80, 470); c.lineTo(920, 470); c.lineTo(840, 110); c.lineTo(160, 110); c.closePath(); c.fill();
    for (let x = 0; x <= 1; x += .04) { const a = lerp(80, 920, x), b = lerp(160, 840, x); c.strokeStyle = x * 25 % 2 < 1 ? '#8c5a3a' : '#a0663f'; c.lineWidth = 12; c.beginPath(); c.moveTo(a, 470); c.lineTo(b, 110); c.stroke(); }
    c.fillStyle = 'rgba(120,60,30,.35)'; for (let k = 0; k < 14; k++) { c.beginPath(); c.ellipse(140 + (k * 131) % 720, 150 + (k * 71) % 290, 30, 16, 0, 0, 7); c.fill(); }
    for (const h of holes) {
      if (!h.sheet) { c.fillStyle = '#1d1712'; c.beginPath(); c.roundRect(h.x - 70, h.y - 50, 140, 100, 10); c.fill(); }
      else {
        c.fillStyle = '#d4dde2'; c.fillRect(h.x - 85, h.y - 60, 170, 120);
        for (let x = -85; x < 85; x += 12) { c.fillStyle = (x / 12) % 2 ? '#b8c3c9' : '#e8eef1'; c.fillRect(h.x + x, h.y - 60, 6, 120); }
        for (const n of h.nails) {
          const nx = h.x + n.dx, ny = h.y + n.dy;
          if (n.done) { c.fillStyle = '#555'; c.beginPath(); c.arc(nx, ny, 7, 0, 7); c.fill(); continue; }
          if (n !== activeNail()) { c.fillStyle = '#999'; c.beginPath(); c.arc(nx, ny, 4, 0, 7); c.fill(); continue; }
          const rr = ringR(); const green = rr < 22;
          c.strokeStyle = n.flash > 0 ? '#e74c3c' : green ? '#2ecc71' : '#f1c40f'; c.lineWidth = 5; c.beginPath(); c.arc(nx, ny, rr, 0, 7); c.stroke();
          c.strokeStyle = 'rgba(46,204,113,.35)'; c.lineWidth = 2; c.beginPath(); c.arc(nx, ny, 18, 0, 7); c.stroke();
          c.fillStyle = '#777'; c.fillRect(nx - 2, ny - 26, 4, 22); c.beginPath(); c.arc(nx, ny - 26, 6, 0, 7); c.fill();
        }
      }
    }
    // sheet stack
    for (let k = 0; k < holes.filter(h => !h.sheet).length - (carry ? 1 : 0); k++) { c.fillStyle = k % 2 ? '#c9d3d8' : '#e1e8eb'; c.fillRect(STACK.x - 60, STACK.y - k * 10, 110, 30); }
    c.fillStyle = '#fff'; c.font = '700 13px system-ui'; c.textAlign = 'center'; c.fillText('ZINK BARU', STACK.x - 5, STACK.y + 50);
    if (carry) { c.globalAlpha = .9; c.fillStyle = '#d4dde2'; c.fillRect(carry.x - 85, carry.y - 60, 170, 120); for (let x = -85; x < 85; x += 12) { c.fillStyle = '#b8c3c9'; c.fillRect(carry.x + x, carry.y - 60, 6, 120); } c.globalAlpha = 1; }
  }
  const ringR = () => 16 + 24 * (.5 + .5 * Math.sin(t * 4.2));
  const activeNail = () => { for (const h of holes) if (h.sheet) for (const n of h.nails) if (!n.done) return n; return null; };
  function holeOf(n) { return holes.find(h => h.nails.includes(n)); }

  return {
    dbg: () => ({ phase, holes, ringR: ringR(), active: activeNail(), STACK }),
    down(p) {
      if (phase === 'zinc') {
        const n = activeNail();
        if (n) { const h = holeOf(n); if (Math.hypot(p.x - (h.x + n.dx), p.y - (h.y + n.dy)) < 45) {
          if (ringR() < 22) { n.done = true; sfx.hammer(); parts.add(h.x + n.dx, h.y + n.dy, 0, -80, '#ffd452', .4, 6); checkZinc(); }
          else { misses++; n.flash = .5; sfx.bad(); toast('Bengkok! Tunggu bulatan hijau', 'Bent! Wait for the green ring'); }
          return; } }
        if (!carry && holes.some(h => !h.sheet) && Math.hypot(p.x - STACK.x, p.y - STACK.y) < 90) { carry = { x: p.x, y: p.y }; sfx.tap(); }
      }
    },
    move(p) { if (carry) { carry.x = p.x; carry.y = p.y; } },
    up() {
      if (carry) {
        const h = holes.find(h => !h.sheet && Math.hypot(carry.x - h.x, carry.y - h.y) < 90);
        if (h) { h.sheet = true; sfx.pop(); api.step('Ketik paku masa bulatan jadi hijau', 'Tap each nail when the ring turns green'); } else sfx.tap();
        carry = null;
      }
    },
    update(dt, p) {
      t += dt;
      for (const h of holes) for (const n of h.nails) n.flash = Math.max(0, n.flash - dt);
      if (!p.down) { if (scrub) { scrub.stop(); scrub = null; } }
      if (phase === 'scrape' && p.down) {
        const mv = p.mv;
        if (!scrub) scrub = loopSound('scrub'); scrub.set(Math.min(.25, mv * .02));
        old.seg(p.lx, p.ly, p.x, p.y, 36, (k) => { if (old.v[k] > 0) { old.v[k] = Math.max(0, old.v[k] - (dt * 1.2 + mv * .012)); if (Math.random() < .08) { const [x, y] = old.center(k); parts.add(x, y, (Math.random() - .5) * 120, -40, '#a9bfc8', .7, 5); } } });
        const f = old.frac(v => v < .08); api.progress(f / .96);
        if (f >= .96) { phase = 'paint'; for (let k = 0; k < old.v.length; k++) old.v[k] = 0; api.progress(0); sfx.good(); api.step('Pilih warna, kemudian seret untuk cat', 'Pick a colour, then drag to paint'); swatchTools(); }
      } else if (phase === 'paint' && p.down) {
        const mv = p.mv;
        paint.seg(p.lx, p.ly, p.x, p.y, 38, (k) => { paint.v[k] = Math.min(1, paint.v[k] + dt * 5 + mv * .03); });
        const f = paint.frac(v => v > .85); api.progress(f / .96);
        if (f >= .96) { for (let k = 0; k < paint.v.length; k++) if (paint.m[k]) paint.v[k] = 1; phase = 'zinc'; api.tools([]); api.progress(0); sfx.good(); api.step('Seret zink baru ke lubang di bumbung', 'Drag new zinc sheets over the roof holes'); }
      }
      parts.update(dt, 300);
    },
    draw(c) {
      if (phase === 'zinc') drawRoof(c); else drawWall(c);
      const p = lastP;
      if (phase === 'scrape') { c.fillStyle = '#7f8c8d'; c.fillRect(p.x - 30, p.y - 6, 60, 10); c.fillStyle = '#c0392b'; c.fillRect(p.x - 8, p.y + 4, 16, 50); }
      if (phase === 'paint') { c.fillStyle = color; c.beginPath(); c.roundRect(p.x - 40, p.y - 14, 80, 28, 10); c.fill(); c.strokeStyle = '#555'; c.lineWidth = 4; c.beginPath(); c.moveTo(p.x, p.y + 14); c.lineTo(p.x, p.y + 30); c.lineTo(p.x + 20, p.y + 70); c.stroke(); }
      parts.draw(c);
    },
    stop() { scrub && scrub.stop(); },
  };
  function checkZinc() {
    const total = holes.length * 2, done = holes.reduce((a, h) => a + h.nails.filter(n => n.done).length, 0);
    api.progress(done / total);
    if (done === total) { sfx.good(); phase = 'done'; setTimeout(() => api.finish({ stars: misses <= 1 ? 3 : misses <= 3 ? 2 : 1, color }), 600); }
  }
}

// ------------------------------------------------------------ 3. CUCI KERETA
function CarWash(api, opts) {
  const body = new Path2D();
  body.moveTo(150, 400); body.lineTo(160, 330); body.quadraticCurveTo(180, 300, 260, 290); body.lineTo(350, 285);
  body.quadraticCurveTo(410, 200, 480, 195); body.lineTo(650, 195); body.quadraticCurveTo(700, 200, 760, 280);
  body.lineTo(830, 300); body.quadraticCurveTo(860, 320, 860, 370); body.lineTo(855, 400); body.closePath();
  const tmp = document.createElement('canvas').getContext('2d');
  const inCar = (x, y) => tmp.isPointInPath(body, x, y);
  const dust = new Grid(140, 190, 730, 220, 48, 16, 1, inCar), foam = new Grid(140, 190, 730, 220, 48, 16, 0, inCar), wet = new Grid(140, 190, 730, 220, 48, 16, 0, inCar);
  const r = mulberry32(opts.seed || 21);
  const mud = []; while (mud.length < 6) { const x = 180 + r() * 640, y = 230 + r() * 160; if (inCar(x, y)) mud.push({ x, y, r: 22 + r() * 14, v: 1 }); }
  const STEPS = [['Bilas', 'Rinse', '🚿'], ['Sabun', 'Soap', '🧴'], ['Sental', 'Scrub', '🧽'], ['Bilas', 'Rinse', '🚿'], ['Lap', 'Dry', '🧻']];
  let step = 0, hose = null, scrub = null, shine = 0;
  const parts = particles();
  const col = opts.color || ['#c0392b', '#2e86de', '#27ae60', '#f39c12'][Math.floor(r() * 4)];
  const setStep = () => {
    api.tools(STEPS.map(([bm, en, ic], k) => ({ html: `<b>${ic}</b><span>${k + 1}. ${bm}</span>`, sel: k === step })));
    const tips = ['Bilas habuk dengan air', 'Sapu sabun ke seluruh kereta', 'Sental tompok lumpur (gosok berulang-ulang)', 'Bilas semua buih', 'Lap sampai kering berkilat'];
    const en = ['Rinse off the dust', 'Spread soap over the whole car', 'Scrub the mud spots (rub back and forth)', 'Rinse off all the foam', 'Wipe it dry until it shines'];
    api.step(tips[step], en[step]); api.progress(0);
  };
  setStep();
  const next = () => {
    const all = (g, v) => { for (let i = 0; i < g.v.length; i++) if (g.m[i]) g.v[i] = v; };
    if (step === 0) { all(dust, 0); all(wet, 1); } else if (step === 1) all(foam, 1); else if (step === 2) mud.forEach(m => { m.v = 0; }); else if (step === 3) { all(foam, 0); all(wet, 1); } else if (step === 4) all(wet, 0);
    sfx.good(); step++; if (step >= STEPS.length) { shine = 1; const t = api.elapsed(); setTimeout(() => api.finish({ stars: starsFor(t, 50, 80) }), 900); } else setStep(); };

  return {
    dbg: () => ({ step, mud }),
    update(dt, p) {
      const mv = p.mv;
      const isHose = step === 0 || step === 3;
      if (isHose && p.down) { if (!hose) hose = loopSound('water'); hose.set(.18); for (let k = 0; k < 3; k++) parts.add(p.x + (Math.random() - .5) * 20, p.y - 40, (Math.random() - .5) * 140, 260 + Math.random() * 120, 'rgba(160,215,255,.9)', .35, 3); }
      else if (hose) { hose.stop(); hose = null; }
      if ((step === 2 || step === 4) && p.down) { if (!scrub) scrub = loopSound('scrub'); scrub.set(Math.min(.2, mv * .015)); } else if (scrub) { scrub.stop(); scrub = null; }
      if (!p.down || step >= STEPS.length) return parts.update(dt, 400);
      const R = 46;
      if (step === 0) { dust.seg(p.lx, p.ly, p.x, p.y, R, k => { dust.v[k] = Math.max(0, dust.v[k] - dt * 3 - mv * .012); wet.v[k] = 1; }); const f = dust.frac(v => v < .12); api.progress(f / .96); if (f >= .96) next(); }
      else if (step === 1) { foam.seg(p.lx, p.ly, p.x, p.y, R, k => { foam.v[k] = Math.min(1, foam.v[k] + dt * 3.5 + mv * .015); }); if (Math.random() < .3) parts.add(p.x, p.y, (Math.random() - .5) * 80, -60, 'rgba(255,255,255,.9)', .5, 6); const f = foam.frac(v => v > .7); api.progress(f / .96); if (f >= .96) next(); }
      else if (step === 2) { for (const m of mud) if (m.v > 0 && Math.hypot(p.x - m.x, p.y - m.y) < m.r + 30) m.v = Math.max(0, m.v - mv * .006); const f = mud.filter(m => m.v < .08).length / mud.length; api.progress(f); if (f >= 1) next(); }
      else if (step === 3) { foam.seg(p.lx, p.ly, p.x, p.y, R, k => { foam.v[k] = Math.max(0, foam.v[k] - dt * 3.5 - mv * .015); wet.v[k] = 1; }); const f = foam.frac(v => v < .12); api.progress(f / .96); if (f >= .96) next(); }
      else if (step === 4) { wet.seg(p.lx, p.ly, p.x, p.y, R, k => { wet.v[k] = Math.max(0, wet.v[k] - (dt * .8 + mv * .01)); }); const f = wet.frac(v => v < .12); api.progress(f / .96); if (f >= .96) next(); }
      parts.update(dt, 400);
    },
    draw(c) {
      c.fillStyle = '#d9e4ea'; c.fillRect(0, 0, VW, VH);
      c.fillStyle = '#9aa7ae'; c.fillRect(0, 450, VW, 150); c.fillStyle = '#4aa3d8'; c.fillRect(0, 0, VW, 40);
      c.fillStyle = '#fff'; c.font = '900 18px system-ui'; c.textAlign = 'center'; c.fillText('POK WAN CAR WASH', VW / 2, 27);
      c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(505, 455, 370, 20, 0, 0, 7); c.fill();
      c.fillStyle = col; c.fill(body);
      c.save(); c.clip(body);
      c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(140, 300, 730, 18);
      c.fillStyle = '#2d4a52'; c.beginPath(); c.moveTo(370, 285); c.quadraticCurveTo(420, 215, 480, 212); c.lineTo(560, 212); c.lineTo(560, 285); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(580, 212); c.lineTo(645, 212); c.quadraticCurveTo(690, 220, 735, 285); c.lineTo(580, 285); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 2; c.beginPath(); c.moveTo(570, 212); c.lineTo(570, 400); c.moveTo(370, 290); c.lineTo(370, 400); c.stroke();
      for (let k = 0; k < dust.v.length; k++) { if (!dust.m[k]) continue; const [x, y] = dust.center(k);
        if (dust.v[k] > .02) { c.globalAlpha = dust.v[k] * .6; c.fillStyle = '#9b7a52'; c.fillRect(x - 8, y - 7.5, 16, 15); }
        if (wet.v[k] > .05 && step >= 3) { c.globalAlpha = wet.v[k] * .7; c.fillStyle = '#e8f6ff'; c.beginPath(); c.arc(x - 3 + (k % 3) * 2, y - 2, 2.4, 0, 7); c.arc(x + 4, y + 3 - (k % 2) * 3, 1.8, 0, 7); c.fill(); }
      }
      c.globalAlpha = 1;
      for (const m of mud) if (m.v > 0) { c.globalAlpha = m.v; c.fillStyle = '#5d4027'; c.beginPath(); c.ellipse(m.x, m.y, m.r, m.r * .7, .3, 0, 7); c.fill(); c.fillStyle = '#7a5636'; c.beginPath(); c.ellipse(m.x - 6, m.y - 4, m.r * .5, m.r * .3, .3, 0, 7); c.fill(); }
      c.globalAlpha = 1;
      for (let k = 0; k < foam.v.length; k++) { if (!foam.m[k] || foam.v[k] < .05) continue; const [x, y] = foam.center(k); c.globalAlpha = Math.min(1, foam.v[k] + .2); c.fillStyle = '#fff'; c.beginPath(); c.arc(x + ((k * 5) % 7) - 3, y + ((k * 3) % 5) - 2, 4 + foam.v[k] * 6, 0, 7); c.fill(); }
      c.globalAlpha = 1; c.restore();
      c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 3; c.stroke(body);
      for (const wx of [290, 720]) { c.fillStyle = '#222'; c.beginPath(); c.arc(wx, 400, 50, 0, 7); c.fill(); c.fillStyle = '#bbb'; c.beginPath(); c.arc(wx, 400, 24, 0, 7); c.fill(); }
      c.fillStyle = '#ffeaa7'; c.fillRect(838, 330, 18, 14); c.fillStyle = '#e74c3c'; c.fillRect(152, 335, 12, 16);
      if (shine) { c.fillStyle = '#fff'; for (let k = 0; k < 6; k++) { const x = 220 + k * 110, y = 250 + (k % 2) * 80, s = 10 + Math.sin(performance.now() / 120 + k) * 6; c.beginPath(); c.moveTo(x, y - s); c.lineTo(x + s * .3, y); c.lineTo(x, y + s); c.lineTo(x - s * .3, y); c.fill(); c.beginPath(); c.moveTo(x - s, y); c.lineTo(x, y + s * .3); c.lineTo(x + s, y); c.lineTo(x, y - s * .3); c.fill(); } }
      parts.draw(c);
      // tool at pointer
      const p = lastP, isHose = step === 0 || step === 3;
      c.font = '44px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle';
      if (step < STEPS.length) c.fillText(isHose ? '🚿' : STEPS[step][2], p.x, p.y - (isHose ? 50 : 0));
      c.textBaseline = 'alphabetic';
    },
    stop() { hose && hose.stop(); scrub && scrub.stop(); },
  };
}

// ------------------------------------------------------------ 4. TUAI PADI (2D fallback)
function Padi(api, opts) {
  const r = mulberry32(opts.seed || 33), parts = particles();
  const clumps = []; for (let c = 0; c < 24; c++) clumps.push({ x: 140 + (c % 6) * 145 + (r() - .5) * 20, y: 140 + Math.floor(c / 6) * 85 + (r() - .5) * 14, cut: false });
  const bundles = []; let phase = 'tuai', cut = 0, onMat = 0, slams = 0, good = 0, t = 0, swing = 0, zoneW = .2;
  const MAT = { x: 150, y: 520 }, TONG = { x: 820, y: 500 };
  api.step('Seret sabit merentasi rumpun padi untuk menuai', 'Swipe the sickle across the padi clumps to harvest');
  return {
    down(p) {
      if (phase === 'kumpul') { const b = bundles.find(b => !b.done && Math.hypot(p.x - b.x, p.y - b.y) < 45); if (b) { b.done = true; onMat++; sfx.pop(); api.progress(onMat / bundles.length); if (onMat === bundles.length) { phase = 'banting'; api.progress(0); api.step('Ketik bila tanda kuning dalam zon hijau!', 'Tap when the yellow marker is in the green zone!'); } } }
      else if (phase === 'banting' && swing <= 0) {
        swing = .4; slams++; const m = .5 + Math.sin(t * (2.4 + good * .18)) * .45;
        if (Math.abs(m - .5) < zoneW / 2) { good++; sfx.hammer(); for (let k = 0; k < 30; k++) parts.add(TONG.x, TONG.y - 40, (Math.random() - .5) * 300, -200 - Math.random() * 200, '#f1d36b', .8, 5); zoneW = Math.max(.12, zoneW - .01); } else sfx.bad();
        api.progress(good / 8); if (good >= 8) { const misses = slams - good; phase = 'done'; sfx.good(); setTimeout(() => api.finish({ stars: misses <= 1 ? 3 : misses <= 4 ? 2 : 1, kg: 20 }), 900); }
      }
    },
    update(dt, p) {
      t += dt; swing = Math.max(0, swing - dt);
      if (phase === 'tuai' && p.down && p.mv > 3) {
        for (const c of clumps) { if (c.cut) continue; const dx = p.x - p.lx, dy = p.y - p.ly, L2 = dx * dx + dy * dy || 1, u = clamp(((c.x - p.lx) * dx + (c.y - p.ly) * dy) / L2, 0, 1), ex = p.lx + u * dx - c.x, ey = p.ly + u * dy - c.y;
          if (ex * ex + ey * ey < 45 * 45) { c.cut = true; cut++; sfx.swish(); for (let k = 0; k < 8; k++) parts.add(c.x, c.y, (Math.random() - .5) * 200, -150, '#d8c070', .6, 4); api.progress(cut / 24); } }
        if (cut >= 24) { phase = 'kumpul'; sfx.good(); api.progress(0); for (let k = 0; k < 24; k += 2) bundles.push({ x: (clumps[k].x + clumps[k + 1].x) / 2, y: (clumps[k].y + clumps[k + 1].y) / 2, done: false }); api.step('Ketik setiap berkas padi untuk kumpul', 'Tap each padi bundle to gather it'); }
      }
      parts.update(dt);
    },
    draw(c) {
      c.fillStyle = '#9ccf6a'; c.fillRect(0, 0, VW, 90); c.fillStyle = '#8a7a48'; c.fillRect(0, 90, VW, 510);
      if (phase === 'tuai') for (const cl of clumps) { if (cl.cut) { c.fillStyle = '#a08a3a'; c.fillRect(cl.x - 25, cl.y + 10, 50, 8); continue; } c.strokeStyle = '#c9a83a'; c.lineWidth = 3; for (let k = -4; k <= 4; k++) { c.beginPath(); c.moveTo(cl.x + k * 3, cl.y + 25); c.quadraticCurveTo(cl.x + k * 6, cl.y - 20, cl.x + k * 9 + 6, cl.y - 30); c.stroke(); } c.fillStyle = '#e8c45a'; for (let k = -4; k <= 4; k += 2) { c.beginPath(); c.ellipse(cl.x + k * 9 + 6, cl.y - 32, 4, 9, .4, 0, 7); c.fill(); } }
      if (phase === 'kumpul') for (const b of bundles) if (!b.done) { c.fillStyle = '#c9a83a'; c.beginPath(); c.roundRect(b.x - 35, b.y - 14, 70, 28, 12); c.fill(); c.fillStyle = '#7a4a2a'; c.fillRect(b.x - 4, b.y - 15, 8, 30); }
      c.fillStyle = '#d9b36c'; c.fillRect(MAT.x - 100, MAT.y - 40, 200, 80); c.fillStyle = '#c9a83a'; for (let k = 0; k < onMat; k++) c.fillRect(MAT.x - 90 + (k % 4) * 45, MAT.y - 30 + Math.floor(k / 4) * 22, 40, 14);
      c.fillStyle = '#8a5a32'; c.fillRect(TONG.x - 110, TONG.y - 60, 220, 120); c.fillStyle = '#e2c25a'; c.fillRect(TONG.x - 95, TONG.y + 50 - good * 12, 190, good * 12);
      if (phase === 'banting' || phase === 'done') {
        const bx = 300, bw = 400, by = 300; c.fillStyle = '#22343d'; c.fillRect(bx, by, bw, 30); c.fillStyle = '#2ecc71'; c.fillRect(bx + bw * (.5 - zoneW / 2), by, bw * zoneW, 30);
        const m = .5 + Math.sin(t * (2.4 + good * .18)) * .45; c.fillStyle = '#ffd452'; c.fillRect(bx + bw * m - 4, by - 8, 8, 46);
        c.save(); c.translate(TONG.x - 60, TONG.y - 90); c.rotate(swing > 0 ? .3 : -1); c.fillStyle = '#c9a83a'; c.fillRect(0, -15, 140, 30); c.restore();
      }
      if (phase === 'tuai') { const p = lastP; c.strokeStyle = '#d7dde0'; c.lineWidth = 6; c.beginPath(); c.arc(p.x + 20, p.y, 26, -2.4, .6); c.stroke(); c.fillStyle = '#7a4a2a'; c.fillRect(p.x - 4, p.y + 10, 10, 50); }
      parts.draw(c);
    },
  };
}

// ============================================================ BAB 3 · TURUN KE LAUT
// shared data + logic (the 3D versions render the same state)
// ---- 30 Malaysian sea fish (TYRANZ models). rm = estimated market price per kg (RM); spots: p = pantai, k = karang, d = laut dalam
export const RARITY = {
  biasa: { bm: 'Biasa', en: 'Common', col: '#9aa5ab', stars: 1, w: 55, str: .5, bite: 1.15 },
  luar: { bm: 'Luar Biasa', en: 'Uncommon', col: '#2ecc71', stars: 2, w: 28, str: .7, bite: 1 },
  jarang: { bm: 'Jarang', en: 'Rare', col: '#3498db', stars: 3, w: 12, str: .9, bite: .9 },
  epik: { bm: 'Epik', en: 'Epic', col: '#a55eea', stars: 4, w: 4, str: 1.1, bite: .8 },
  legenda: { bm: 'Legenda', en: 'Legendary', col: '#f5b700', stars: 5, w: 1.2, str: 1.35, bite: .7 },
};
const F = (file, en, rar, kg0, kg1, rm, spots) => ({ id: file, model: 'fish_' + file, bm: 'Ikan ' + file.replace(/_/g, ' '), en, rar, kg: [kg0, kg1], rm, spots });
export const FISH = [
  F('Kembung', 'Indian mackerel', 'biasa', .15, .4, 14, 'pk'), F('Selar_Kuning', 'Yellowstripe scad', 'biasa', .12, .35, 12, 'p'),
  F('Cencaru', 'Torpedo scad', 'biasa', .2, .5, 10, 'pk'), F('Selayang', 'Round scad', 'biasa', .12, .3, 9, 'p'),
  F('Tamban', 'Sardine', 'biasa', .06, .15, 8, 'p'), F('Bilis', 'Anchovy', 'biasa', .02, .06, 30, 'p'),
  F('Gelama', 'Croaker', 'biasa', .2, .6, 10, 'p'), F('Belanak', 'Mullet', 'biasa', .3, .8, 10, 'p'),
  F('Kerisi', 'Threadfin bream', 'biasa', .15, .4, 12, 'k'), F('Biji_Nangka', 'Goatfish', 'biasa', .1, .3, 15, 'k'),
  F('Siakap', 'Barramundi', 'luar', 1, 3.5, 28, 'p'), F('Bawal_Hitam', 'Black pomfret', 'luar', .4, 1.2, 30, 'p'),
  F('Sebelah', 'Flounder', 'luar', .3, 1, 25, 'p'), F('Tongkol', 'Longtail tuna', 'luar', 1.5, 4, 15, 'd'),
  F('Alu-Alu', 'Barracuda', 'luar', 1, 3, 14, 'kd'), F('Pari', 'Stingray', 'luar', 2, 8, 15, 'd'),
  F('Gerut-Gerut', 'Grunter', 'luar', .5, 1.5, 20, 'k'), F('Talang', 'Queenfish', 'luar', 1, 4, 16, 'kd'),
  F('Jebong', 'Triggerfish', 'luar', .4, 1.2, 12, 'k'), F('Dengkis', 'Rabbitfish', 'luar', .2, .6, 25, 'k'),
  F('Bawal_Putih', 'Silver pomfret', 'jarang', .3, .8, 70, 'p'), F('Senangin', 'Fourfinger threadfin', 'jarang', .8, 2.5, 45, 'p'),
  F('Kerapu', 'Grouper', 'jarang', 1.5, 5, 45, 'k'), F('Jenahak', 'Golden snapper', 'jarang', 1, 4, 40, 'kd'),
  F('Merah', 'Red snapper', 'jarang', 1.2, 4, 38, 'kd'), F('Tenggiri', 'Spanish mackerel', 'jarang', 2, 6, 40, 'd'),
  F('Kerapu_Bara', 'Coral trout', 'epik', 1, 3, 90, 'k'), F('Bawal_Emas', 'Golden trevally', 'epik', 1, 4, 45, 'kd'),
  F('Kurau', 'Indian threadfin', 'epik', 2, 8, 60, 'd'), F('Tuna_Sirip_Kuning', 'Yellowfin tuna', 'legenda', 12, 35, 30, 'd'),
  F('Gerepoh', 'Giant trevally', 'epik', 3, 15, 18, 'k'), F('Layaran', 'Sailfish', 'legenda', 15, 45, 25, 'd'), // new models for the sea-fishing simulator
];
export const SPOTS = {
  pantai: { key: 'p', bm: 'Pantai', en: 'Shallows', note: 'Dekat · ikan harian', icon: '🏖️', boost: 1 },
  karang: { key: 'k', bm: 'Terumbu Karang', en: 'Coral reef', note: 'Ikan karang · lebih jarang', icon: '🪸', boost: 1.8 },
  dalam: { key: 'd', bm: 'Laut Dalam', en: 'Deep sea', note: 'Jauh · ikan besar & legenda', icon: '🌊', boost: 2.6 },
};
export const fishLen = (kg) => clamp(.32 + Math.cbrt(kg) * .42, .28, 1.7); // display length (m) for a fish of this weight
export const rmOf = (f) => Math.round(f.kg * (FISH.find(k => k.id === f.id) || FISH[0]).rm * 100) / 100;
const STEP = {
  aim: ['Tekan & tahan untuk kuasa lontaran, lepas untuk lempar (seret untuk arah)', 'Press & hold to power the cast, release to throw (drag to aim)'],
  wait: ['Tunggu… ketik bila ikan sambar umpan!', 'Wait… tap when the fish takes the bait!'],
  reel: ['Tahan untuk gulung · seret ke arah bertentangan bila ikan lari!', 'Hold to reel · drag the opposite way when the fish runs!'],
};
// One state machine for 2D and 3D. Coordinates are local to the angler: x right, z towards the player; J = rod tip over the water.
export function fishCore(api, opts, fx = {}) {
  const r = mulberry32(opts.seed || 41), GOAL = opts.goal || 5;
  const R = { x0: -7, x1: 7, z0: -15, z1: -3.2 }, J = { x: 0, z: -1.2 };
  const rnd = (a, b) => a + r() * (b - a);
  let spot = SPOTS[opts.spot] || null;
  function pickKind() {
    const list = FISH.filter(f => f.spots.includes(spot.key)); let tot = 0;
    const w = list.map(f => { const x = RARITY[f.rar].w * (f.rar === 'biasa' ? 1 : spot.boost); tot += x; return x; });
    let t = r() * tot; for (let i = 0; i < list.length; i++) if ((t -= w[i]) <= 0) return list[i]; return list[0];
  }
  const newFish = (far) => { const kind = pickKind(), kg = Math.round(rnd(...kind.kg) * 100) / 100;
    return { kind, kg, x: rnd(R.x0, R.x1), z: far ? rnd(R.z0, R.z0 + 3) : rnd(R.z0, R.z1 - 1), tx: 0, tz: 0, h: r() * 6, mode: 'roam', t: 0, size: .55 + Math.min(1.3, Math.cbrt(kg) * .5), fade: far ? 0 : 1, retarget: 0 }; };
  const S = { st: spot ? 'aim' : 'choose', spot, bob: { x: J.x, z: J.z, y: 0, dip: 0 }, from: null, to: null, ft: 0, suitor: null, need: 1, nibbles: 0, nibT: 0, biteT: 0, waitT: 0,
    power: 0, ct: 0, aimX: 0, preview: null, tension: 0, stamina: 1, run: 0, runT: 2, slack: 0, side: 0, hooked: null, dist: 0, dir: null,
    catches: [], miss: 0, pose: null, fishes: [], J, R, GOAL, t: 0 };
  const say = (bm, en) => toast(bm, en);
  function begin() { S.fishes = []; for (let k = 0; k < 8; k++) S.fishes.push(newFish(false)); S.st = 'aim'; api.step(...STEP.aim); api.tools([]); api.progress(0); }
  function choose(id) { spot = S.spot = SPOTS[id]; S.st = 'sail'; api.tools([]); api.step(`Belayar ke ${spot.bm}…`, `Sailing to the ${spot.en.toLowerCase()}…`); sfx.good(); if (fx.sail) fx.sail(id); else begin(); }
  if (!spot) { api.step('Pilih tempat memancing', 'Choose where to fish'); api.tools(Object.entries(SPOTS).map(([id, s]) => ({ html: `<b>${s.icon}</b><span>${s.bm}<small style="display:block;opacity:.75;font-size:10px">${s.note}</small></span>`, on: () => choose(id) }))); }
  else begin();
  function release(f) { if (!f) return; f.mode = 'flee'; f.t = 0; const a = Math.atan2(f.z - S.bob.z, f.x - S.bob.x) || r() * 6; f.tx = clamp(S.bob.x + Math.cos(a) * 6, R.x0, R.x1); f.tz = clamp(S.bob.z + Math.sin(a) * 6, R.z0, R.z1); }
  const target = () => { const dx = S.aimX - J.x, dz = -9, L = Math.hypot(dx, dz), d = 3.5 + S.power * 10.5; return { x: clamp(J.x + dx / L * d, R.x0, R.x1), z: clamp(J.z + dz / L * d, R.z0, R.z1) }; };
  function hook() {
    const f = S.suitor; S.hooked = { f, kind: f.kind, kg: f.kg, rar: RARITY[f.kind.rar] };
    S.st = 'reel'; S.tension = .3; S.stamina = 1; S.slack = 0; S.run = 0; S.runT = rnd(.6, 1.4); f.mode = 'hooked';
    const dx = S.bob.x - J.x, dz = S.bob.z - J.z; S.dist = Math.hypot(dx, dz); S.dir = { x: dx / S.dist, z: dz / S.dist };
    sfx.pull(); fx.hook && fx.hook(S.hooked); api.step(...STEP.reel); api.progress(S.catches.length / GOAL);
  }
  function lost(why) {
    S.miss++; if (why === 'snap') { sfx.snap(); say('Tali putus! Lepaskan bila tali merah', 'The line snapped! Let go when it turns red'); } else { sfx.bad(); say('Ikan terlepas — tali terlalu longgar', 'It slipped off — the line was too slack'); }
    const f = S.hooked.f; f.mode = 'roam'; release(f); S.hooked = null; S.suitor = null; S.st = 'aim'; S.tension = 0; S.run = 0; api.step(...STEP.aim); fx.lost && fx.lost(why);
  }
  function down(x, z) {
    if (S.st === 'aim') { S.st = 'charge'; S.ct = 0; S.power = 0; S.aimX = clamp(x, R.x0, R.x1); return; }
    if (S.st === 'wait') {
      if (S.suitor && S.nibbles > 0) { S.miss++; sfx.bad(); say('Terlalu awal! Tunggu pelampung tenggelam', 'Too early! Wait for the float to sink'); release(S.suitor); S.suitor = null; S.nibbles = 0; S.waitT = 0; return; }
      S.st = 'aim'; if (S.suitor) { S.suitor.mode = 'roam'; S.suitor = null; } api.step(...STEP.aim); return; // reel the float back in to recast
    }
    if (S.st === 'bite') hook();
  }
  function move(x) {
    if (S.st === 'charge') S.aimX = clamp(x, R.x0, R.x1);
    if (S.st === 'reel') S.side = clamp((x - J.x) / 3.5, -1, 1);
  }
  function up() {
    if (S.st !== 'charge') return;
    S.to = target(); S.from = { x: J.x, z: J.z }; S.st = 'fly'; S.ft = 0; S.preview = null; sfx.swish();
  }
  function next() { // called by the catch card
    if (S.st !== 'pose') return; S.pose = null;
    if (S.catches.length >= GOAL) { S.st = 'done'; sfx.good(); const kg = Math.round(S.catches.reduce((a, c) => a + c.kg, 0) * 100) / 100, rm = Math.round(S.catches.reduce((a, c) => a + c.rm, 0) * 100) / 100; setTimeout(() => api.finish({ stars: S.miss <= 1 ? 3 : S.miss <= 3 ? 2 : 1, fish: S.catches, kg, rm }), 300); }
    else { S.st = 'aim'; api.step(...STEP.aim); fx.resume && fx.resume(); }
  }
  function update(dt, holding) {
    if (opts.practice && S.st === 'reel') { holding = S.tension < .6; S.side = -S.run; } /*DEBUGREEL*/
    S.t += dt; const b = S.bob;
    for (const f of S.fishes) {
      f.fade = Math.min(1, f.fade + dt);
      if (f.mode === 'hooked') continue;
      if (f.mode === 'suitor') { f.tx = b.x; f.tz = b.z + .35; }
      else if (f.mode === 'flee') { f.t += dt; if (f.t > 2) f.mode = 'roam'; }
      else if ((f.retarget -= dt) <= 0) { f.retarget = rnd(2, 5); f.tx = rnd(R.x0, R.x1); f.tz = rnd(R.z0, R.z1 - .5); }
      const dx = f.tx - f.x, dz = f.tz - f.z, d = Math.hypot(dx, dz), sp = f.mode === 'flee' ? 3 : f.mode === 'suitor' ? 1.5 : .6;
      if (d > .05) { const s = Math.min(d, sp * dt) / d; f.x += dx * s; f.z += dz * s; f.h = Math.atan2(dz, dx); }
    }
    if (S.st !== 'bite') b.dip = Math.max(0, b.dip - dt * 1.2);
    if (S.st === 'aim' || S.st === 'charge' || S.st === 'pose' || S.st === 'choose' || S.st === 'sail') { b.x = J.x; b.z = J.z; b.y = 0; }
    if (S.st === 'charge') { S.ct += dt; S.power = (1 - Math.cos(S.ct * 2.4)) / 2; S.preview = target(); }
    else if (S.st === 'fly') {
      S.ft += dt; const k = Math.min(1, S.ft / .7);
      b.x = lerp(S.from.x, S.to.x, k); b.z = lerp(S.from.z, S.to.z, k); b.y = Math.sin(k * Math.PI) * 3;
      if (k >= 1) { b.y = 0; S.st = 'wait'; S.waitT = 0; sfx.splash(); fx.splash && fx.splash(b.x, b.z); api.step(...STEP.wait); }
    } else if (S.st === 'wait') {
      S.waitT += dt;
      if (!S.suitor) {
        let best = null, bd = S.waitT > 1.8 ? 1e9 : 3.5;
        for (const f of S.fishes) { if (f.mode !== 'roam') continue; const d = Math.hypot(f.x - b.x, f.z - b.z); if (d < bd) { bd = d; best = f; } }
        if (best) {
          if (bd > 4.5) { const a = r() * 6.28; best.x = clamp(b.x + Math.cos(a) * 3.4, R.x0, R.x1); best.z = clamp(b.z - Math.abs(Math.sin(a)) * 3.4, R.z0, R.z1); best.fade = 0; }
          best.mode = 'suitor'; S.suitor = best; S.need = 1 + Math.floor(r() * 3); S.nibbles = 0; S.nibT = rnd(.3, .7);
        }
      } else if (Math.hypot(S.suitor.x - b.x, S.suitor.z - .35 - b.z) < .55 && (S.nibT -= dt) <= 0) {
        if (S.nibbles < S.need) { S.nibbles++; b.dip = .12; sfx.tap(); S.nibT = rnd(.55, 1.05); fx.ripple && fx.ripple(b.x, b.z, .5); }
        else { S.st = 'bite'; S.biteT = RARITY[S.suitor.kind.rar].bite * (opts.practice ? 25 : 1); /*DEBUGBITE*/ b.dip = .45; sfx.bite(); fx.ripple && fx.ripple(b.x, b.z, 1); fx.bite && fx.bite(); }
      }
    } else if (S.st === 'bite') {
      S.biteT -= dt; b.dip = .45;
      if (S.biteT <= 0) { S.miss++; sfx.bad(); say('Terlepas! Ketik cepat bila pelampung tenggelam', 'Missed! Tap quickly when the float sinks'); release(S.suitor); S.suitor = null; S.nibbles = 0; S.st = 'wait'; S.waitT = 0; b.dip = 0; api.step(...STEP.wait); }
    } else if (S.st === 'reel') {
      const h = S.hooked, str = h.rar.str * (.85 + Math.min(.5, h.kg / 20));
      // the fish makes runs to the left or right; pulling the rod the opposite way wins the fight
      if (S.run) { if ((S.runT -= dt) <= 0) { S.run = 0; S.runT = rnd(1.2, 2.6) / str; } }
      else if ((S.runT -= dt) <= 0) { S.run = r() < .5 ? -1 : 1; S.runT = rnd(.9, 1.7) * (.6 + S.stamina * .6); fx.ripple && fx.ripple(b.x, b.z, .9); fx.run && fx.run(S.run); }
      const opp = S.run && S.side * S.run < -.25, same = S.run && S.side * S.run > .25, pull = .45 + S.stamina * .55;
      if (holding) {
        S.tension += dt * (.26 + (S.run ? (opp ? .2 : same ? 1.5 : .85) * str * pull : 0));
        S.dist -= dt * (S.run ? (opp ? .7 : .12) : 1.5) * (1.2 - .65 * S.stamina);
        S.stamina = Math.max(0, S.stamina - dt * (S.run ? (opp ? .26 : .05) : .11) / str);
      } else { S.tension -= .9 * dt; if (S.run) S.dist += .7 * str * pull * dt; }
      S.tension = Math.max(0, S.tension); S.dist = Math.min(S.dist, 15);
      if (S.tension >= 1) return lost('snap');
      if (S.tension < .1) S.slack += dt; else S.slack = 0;
      if (S.slack > 2.8) return lost('slack');
      const sideOff = S.run ? S.run * 1.2 * Math.min(1, S.stamina + .3) : Math.sin(S.t * 3) * .15;
      b.x = J.x + S.dir.x * S.dist + sideOff; b.z = J.z + S.dir.z * S.dist; b.dip = S.run ? .32 : .15;
      h.f.x = b.x; h.f.z = b.z + .2; h.f.h = Math.atan2(S.dir.z, S.dir.x) + (S.run ? S.run * .9 : Math.sin(S.t * 9) * .4);
      if (S.dist <= 1) {
        const c = { id: h.kind.id, bm: h.kind.bm, en: h.kind.en, kg: h.kg, rar: h.kind.rar }; c.rm = rmOf(c);
        S.catches.push(c); S.pose = { ...c, kind: h.kind, n: S.catches.length }; sfx.coin();
        S.fishes[S.fishes.indexOf(h.f)] = newFish(true); S.hooked = null; S.suitor = null; S.tension = 0; S.run = 0; S.st = 'pose';
        api.progress(S.catches.length / GOAL); fx.caught && fx.caught(S.pose);
      }
    }
  }
  return { S, down, move, up, update, next, begin, choose };
}

// catch card: the fish details shown to the right of the posing angler
export function showFishCard(p, opts, onNext) {
  let el = $('fishCard'); if (!el) { el = document.createElement('div'); el.id = 'fishCard'; $('game').append(el); }
  const rr = RARITY[p.rar], stars = '★'.repeat(rr.stars) + '☆'.repeat(5 - rr.stars);
  let tag = '';
  if (!opts.practice) {
    const log = S.fishLog || (S.fishLog = {}), e = log[p.id];
    tag = !e ? '<div class="fcTag">✨ Spesies baru! · New species!</div>' : p.kg > e.max ? '<div class="fcTag">🏆 Rekod baru! · New record!</div>' : '';
    log[p.id] = { n: (e ? e.n : 0) + 1, max: Math.max(e ? e.max : 0, p.kg) }; save();
  }
  el.style.setProperty('--rc', rr.col);
  el.innerHTML = `<div class="fcKick">TANGKAPAN ${p.n}/${opts.goal || 5} · CATCH</div>
    <div class="fcRar"><b>${rr.bm}</b> <span>${stars}</span></div>
    <h3>${p.bm}</h3><div class="fcEn">${p.en}</div>${tag}
    <dl><dt>Berat · Weight</dt><dd>${p.kg.toFixed(2)} kg</dd>
    <dt>Anggaran harga · Est. price</dt><dd>RM ${p.rm.toFixed(2)}</dd>
    <dt>Kelangkaan · Rarity</dt><dd style="color:${rr.col}">${rr.bm} · ${rr.en}</dd></dl>
    <button id="fcNext">${p.n >= (opts.goal || 5) ? 'Siap! · Done!' : 'Teruskan memancing · Keep fishing'}</button>`;
  el.hidden = false; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  $('fcNext').onclick = () => { sfx.tap(); el.hidden = true; onNext(); };
}
export function hideFishCard() { const el = $('fishCard'); if (el) el.hidden = true; }

// boat hull outline (top view of an upturned perahu), in world units; canvas is 100 px per unit
export const HULL = { L0: -3.6, L1: 3.6, CW: 720, CH: 280, PPU: 100, STACK: { px: 830, py: 140 },
  HOLES: [{ px: 170, py: 115 }, { px: 360, py: 175 }, { px: 545, py: 118 }] };
export const halfW = (x) => x < .4 ? 1.05 + .27 * (x - HULL.L0) / (.4 - HULL.L0) : 1.32 * Math.sqrt(Math.max(0, 1 - ((x - .4) / (HULL.L1 - .4)) ** 2));
export const inHull = (px, py, m = .06) => { const x = px / HULL.PPU + HULL.L0, z = py / HULL.PPU - HULL.CH / HULL.PPU / 2; return x > HULL.L0 && x < HULL.L1 && Math.abs(z) < halfW(x) - m; };
export const BOATC = ['#2e86de', '#e74c3c', '#27ae60', '#f39c12', '#8e44ad'];
// one state machine for both renderers: scrape barnacles → patch holes → paint
export function boatCore(api, opts, onDirty) {
  const r = mulberry32(opts.seed || 51);
  const old = new Grid(0, 0, HULL.CW, HULL.CH, 48, 18, 1, (x, y) => inHull(x, y));
  const paint = new Grid(0, 0, HULL.CW, HULL.CH, 48, 18, 0, (x, y) => inHull(x, y));
  for (let k = 0; k < old.v.length; k++) old.v[k] = .65 + r() * .35;
  const holes = HULL.HOLES.map(h => ({ ...h, patched: false }));
  const S = { phase: 'scrape', old, paint, holes, carry: null, color: BOATC[0], t: 0, scrub: null };
  api.step('Kikis teritip & lumut — seret pengikis', 'Scrape off the barnacles & moss — drag the scraper');
  const swatches = () => api.tools(BOATC.map(c => ({ html: `<span class="sw" style="background:${c}"></span>`, sel: c === S.color, on: () => { S.color = c; sfx.tap(); swatches(); onDirty(); } })));
  return {
    S,
    down(p) { if (S.phase === 'patch' && !S.carry && holes.some(h => !h.patched) && Math.hypot(p.x - HULL.STACK.px, p.y - HULL.STACK.py) < 85) { S.carry = { x: p.x, y: p.y }; sfx.tap(); } },
    move(p) { if (S.carry) { S.carry.x = p.x; S.carry.y = p.y; } },
    up() {
      if (!S.carry) return; const c = S.carry; S.carry = null;
      const h = holes.find(h => !h.patched && Math.hypot(c.x - h.px, c.y - h.py) < 75);
      if (!h) { sfx.tap(); return; }
      h.patched = true; sfx.hammer(); setTimeout(() => sfx.hammer(), 160); onDirty(h);
      const n = holes.filter(h => h.patched).length; api.progress(n / holes.length);
      if (n === holes.length) { S.phase = 'paint'; api.progress(0); sfx.good(); api.step('Pilih warna, kemudian cat seluruh bot', 'Pick a colour, then paint the whole boat'); swatches(); }
    },
    update(dt, p) {
      S.t += dt;
      if (!p.down && S.scrub) { S.scrub.stop(); S.scrub = null; }
      if (S.phase === 'scrape' && p.down && p.on !== false) {
        if (!S.scrub) S.scrub = loopSound('scrub'); S.scrub.set(Math.min(.25, p.mv * .02));
        old.seg(p.lx, p.ly, p.x, p.y, 40, (k) => { if (old.v[k] > 0) { old.v[k] = Math.max(0, old.v[k] - (dt * 1.3 + p.mv * .014)); onDirty(null, k); } });
        const f = old.frac(v => v < .08); api.progress(f / .96);
        if (f >= .96) { for (let k = 0; k < old.v.length; k++) old.v[k] = 0; onDirty(); S.phase = 'patch'; api.progress(0); sfx.good(); api.step('Seret papan tampal (kanan) ke setiap lubang', 'Drag a wooden patch (right) onto each hole'); }
      } else if (S.phase === 'paint' && p.down && p.on !== false) {
        paint.seg(p.lx, p.ly, p.x, p.y, 42, (k) => { paint.v[k] = Math.min(1, paint.v[k] + dt * 5 + p.mv * .03); onDirty(null, k); });
        const f = paint.frac(v => v > .85); api.progress(f / .96);
        if (f >= .96) { for (let k = 0; k < paint.v.length; k++) if (paint.m[k]) paint.v[k] = 1; onDirty(); S.phase = 'done'; api.tools([]); sfx.good(); toast('Bot Pak Mat macam baru!', "Pak Mat's boat looks brand new!"); const tt = api.elapsed(); setTimeout(() => api.finish({ stars: starsFor(tt, 70, 110), color: S.color }), 1500); }
      }
    },
    stop() { S.scrub && S.scrub.stop(); },
  };
}
// draws the hull surface (planks, patches, paint, barnacles, holes) into a 720x280 canvas context
export function drawHull(x, S) {
  const { CW, CH } = HULL;
  x.clearRect(0, 0, CW, CH);
  x.save(); x.beginPath();
  for (let px = 0; px <= CW; px += 8) { const w = halfW(px / 100 + HULL.L0) * 100; px === 0 ? x.moveTo(px, CH / 2 - w) : x.lineTo(px, CH / 2 - w); }
  for (let px = CW; px >= 0; px -= 8) x.lineTo(px, CH / 2 + halfW(px / 100 + HULL.L0) * 100);
  x.closePath(); x.fillStyle = '#8d7356'; x.fill(); x.clip();
  for (let y = 0; y < CH; y += 26) { x.fillStyle = 'rgba(0,0,0,.16)'; x.fillRect(0, y, CW, 2); x.fillStyle = 'rgba(255,255,255,.06)'; x.fillRect(0, y + 3, CW, 4); }
  x.fillStyle = '#6b5238'; x.fillRect(0, CH / 2 - 7, CW, 14); // keel
  for (const h of S.holes) if (h.patched) { x.fillStyle = '#c09060'; x.beginPath(); x.roundRect(h.px - 46, h.py - 28, 92, 56, 6); x.fill(); x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 2; x.stroke(); x.fillStyle = '#555'; for (const [dx, dy] of [[-36, -18], [36, -18], [-36, 18], [36, 18]]) { x.beginPath(); x.arc(h.px + dx, h.py + dy, 3.5, 0, 7); x.fill(); } }
  const { old, paint } = S;
  for (let k = 0; k < paint.v.length; k++) { if (!paint.m[k] || paint.v[k] <= 0) continue; const [cx, cy] = paint.center(k); x.globalAlpha = paint.v[k]; x.fillStyle = S.color; x.fillRect(cx - 8, cy - 8.5, 16, 17); }
  x.globalAlpha = 1;
  if (S.phase === 'done') { x.fillStyle = 'rgba(255,255,255,.9)'; x.fillRect(0, CH / 2 - 5, CW, 10); }
  for (let k = 0; k < old.v.length; k++) {
    if (!old.m[k] || old.v[k] <= .05) continue; const [cx, cy] = old.center(k), v = old.v[k];
    x.globalAlpha = v * .55; x.fillStyle = '#56723f'; x.fillRect(cx - 8, cy - 8.5, 16, 17);
    x.globalAlpha = Math.min(1, v * 1.2); x.fillStyle = (k * 7) % 3 ? '#e2ddcf' : '#c9c2ae';
    x.beginPath(); x.arc(cx - 3 + (k % 3) * 2, cy - 2, 2 + v * 3, 0, 7); x.arc(cx + 4, cy + 3 - (k % 2) * 4, 1.5 + v * 2.5, 0, 7); x.fill();
    x.fillStyle = '#6d6656'; x.beginPath(); x.arc(cx - 3 + (k % 3) * 2, cy - 2, 1 + v, 0, 7); x.fill();
  }
  x.globalAlpha = 1;
  for (const h of S.holes) if (!h.patched) { x.fillStyle = '#1a120c'; x.beginPath(); x.ellipse(h.px, h.py, 30, 17, .2, 0, 7); x.fill(); x.strokeStyle = '#4a3420'; x.lineWidth = 4; x.stroke(); }
  x.restore();
}

// ------------------------------------------------------------ 5. BAIKI BOT (2D fallback)
function Boat(api, opts) {
  const OX = 70, OY = 170, cv = document.createElement('canvas'); cv.width = HULL.CW; cv.height = HULL.CH; const hx = cv.getContext('2d');
  let dirty = true; const parts = particles();
  const core = boatCore(api, opts, () => { dirty = true; });
  const S = core.S, toP = (p) => ({ ...p, x: p.x - OX, y: p.y - OY, lx: p.lx - OX, ly: p.ly - OY });
  return {
    dbg: () => ({ phase: S.phase, holes: S.holes }),
    down(p) { core.down(toP(p)); }, move(p) { core.move(toP(p)); }, up() { core.up(); },
    update(dt, p) { core.update(dt, toP(p)); parts.update(dt); },
    draw(c) {
      c.fillStyle = '#f1dca0'; c.fillRect(0, 0, VW, VH); c.fillStyle = '#4fb3d9'; c.fillRect(0, 0, VW, 90); c.fillStyle = 'rgba(255,255,255,.5)'; for (let k = 0; k < 12; k++) c.fillRect((k * 97 + performance.now() / 30) % VW, 30 + (k % 3) * 20, 40, 3);
      c.fillStyle = 'rgba(0,0,0,.15)'; c.beginPath(); c.ellipse(OX + 360, OY + 160, 380, 130, 0, 0, 7); c.fill();
      for (const sx of [OX + 160, OX + 560]) { c.fillStyle = '#7a5236'; c.fillRect(sx - 12, OY - 30, 24, HULL.CH + 60); }
      if (dirty) { drawHull(hx, S); dirty = false; }
      c.drawImage(cv, OX, OY);
      // patch stack
      const st = { x: OX + HULL.STACK.px, y: OY + HULL.STACK.py };
      c.fillStyle = '#8a5a32'; c.fillRect(st.x - 60, st.y - 45, 120, 90);
      if (S.phase === 'patch') for (let k = 0; k < S.holes.filter(h => !h.patched).length - (S.carry ? 1 : 0); k++) { c.fillStyle = '#c09060'; c.fillRect(st.x - 46, st.y - 28 - k * 8, 92, 56); c.strokeStyle = 'rgba(0,0,0,.3)'; c.strokeRect(st.x - 46, st.y - 28 - k * 8, 92, 56); }
      if (S.carry) { c.fillStyle = '#c09060'; c.fillRect(OX + S.carry.x - 46, OY + S.carry.y - 28, 92, 56); }
      if (S.phase === 'patch' && !S.carry) { const b = Math.sin(performance.now() / 150) * 6; c.fillStyle = '#ffd452'; c.beginPath(); c.moveTo(st.x, st.y - 60 + b); c.lineTo(st.x - 14, st.y - 84 + b); c.lineTo(st.x + 14, st.y - 84 + b); c.fill(); }
      const p = lastP;
      if (S.phase === 'scrape') { c.fillStyle = '#7f8c8d'; c.fillRect(p.x - 30, p.y - 6, 60, 10); c.fillStyle = '#c0392b'; c.fillRect(p.x - 8, p.y + 4, 16, 50); }
      if (S.phase === 'paint') { c.fillStyle = S.color; c.beginPath(); c.roundRect(p.x - 30, p.y - 12, 60, 24, 6); c.fill(); c.fillStyle = '#8a5a32'; c.fillRect(p.x - 6, p.y + 12, 12, 50); }
      parts.draw(c);
    },
    stop() { core.stop(); },
  };
}

// ------------------------------------------------------------ 6. MEMANCING (2D fallback, top view from the boat)
function Fishing(api, opts) {
  const sx = (x) => 500 + x * 62, sy = (z) => 470 + z * 30, wx = (px) => (px - 500) / 62, wz = (py) => (py - 470) / 30;
  const ripples = [], parts = particles();
  const core = fishCore(api, opts, {
    splash: (x, z) => { for (let k = 0; k < 14; k++) parts.add(sx(x), sy(z), (Math.random() - .5) * 160, -120 - Math.random() * 80, '#e8f6ff', .5, 4); ripples.push({ x, z, t: 0, s: 1 }); },
    ripple: (x, z, s) => ripples.push({ x, z, t: 0, s }),
    caught: (p) => showFishCard(p, opts, () => core.next()),
  });
  const S = core.S;
  return {
    dbg: () => ({ st: S.st, tension: S.tension, stamina: S.stamina, run: S.run, side: S.side, catches: S.catches.length, miss: S.miss, fishes: S.fishes.map(f => ({ x: f.x, z: f.z, mode: f.mode })) }),
    choose: (id) => core.choose(id), next: () => { hideFishCard(); core.next(); },
    down(p) { core.down(wx(p.x), wz(p.y)); }, move(p) { if (p.down) core.move(wx(p.x)); }, up() { core.up(); },
    update(dt, p) { core.update(dt, p.down); parts.update(dt); for (let i = ripples.length - 1; i >= 0; i--) if ((ripples[i].t += dt) > 1) ripples.splice(i, 1); },
    draw(c) {
      const g = c.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, '#1f7fb4'); g.addColorStop(1, '#4fb3d9'); c.fillStyle = g; c.fillRect(0, 0, VW, VH);
      c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 2; for (let k = 0; k < 24; k++) { const x = (k * 137 + performance.now() / 40) % (VW + 60) - 30, y = (k * 71) % 500 + 20; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 15, y - 5, x + 30, y); c.stroke(); }
      for (const f of S.fishes) { c.save(); c.globalAlpha = .4 * f.fade; c.translate(sx(f.x), sy(f.z)); c.rotate(f.h); c.fillStyle = '#0a3550'; c.beginPath(); c.ellipse(0, 0, 30 * f.size, 10 * f.size, 0, 0, 7); c.fill(); c.beginPath(); c.moveTo(-26 * f.size, 0); c.lineTo(-42 * f.size, -11 * f.size); c.lineTo(-42 * f.size, 11 * f.size); c.fill(); c.restore(); }
      for (const rp of ripples) { c.globalAlpha = 1 - rp.t; c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.ellipse(sx(rp.x), sy(rp.z), 10 + rp.t * 50 * rp.s, 5 + rp.t * 25 * rp.s, 0, 0, 7); c.stroke(); }
      c.globalAlpha = 1;
      // the boat's bow at the bottom
      c.fillStyle = '#f4f1e6'; c.beginPath(); c.moveTo(380, 600); c.quadraticCurveTo(500, 470, 620, 600); c.fill(); c.strokeStyle = '#2e86de'; c.lineWidth = 8; c.stroke();
      const tip = { x: sx(S.J.x), y: sy(S.J.z) }, b = S.bob, bx = sx(b.x), by = sy(b.z) - b.y * 40;
      if (S.preview) { c.strokeStyle = 'rgba(255,255,255,.7)'; c.setLineDash([6, 8]); c.beginPath(); c.moveTo(tip.x, tip.y); c.lineTo(sx(S.preview.x), sy(S.preview.z)); c.stroke(); c.setLineDash([]); c.beginPath(); c.ellipse(sx(S.preview.x), sy(S.preview.z), 22, 11, 0, 0, 7); c.stroke(); }
      const out = ['fly', 'wait', 'bite', 'reel'].includes(S.st);
      if (out) { c.strokeStyle = S.st === 'reel' && S.tension > .8 ? '#ff6b6b' : '#fff'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(tip.x, tip.y); c.lineTo(bx, by); c.stroke();
        const s = 1 - b.dip; c.fillStyle = '#e74c3c'; c.beginPath(); c.arc(bx, by - 2, 9 * s + 2, Math.PI, 0); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(bx, by - 2, 9 * s + 2, 0, Math.PI); c.fill(); }
      if (S.st === 'bite') { c.fillStyle = '#e74c3c'; c.font = '900 54px system-ui'; c.textAlign = 'center'; c.fillText('!', bx, by - 26); }
      c.strokeStyle = '#3b2a1e'; c.lineWidth = 6; c.beginPath(); c.moveTo(560 + S.side * 40, 600); c.lineTo(tip.x + S.side * 30, tip.y); c.stroke();
      c.textAlign = 'center'; c.font = '800 20px system-ui';
      if (S.st === 'charge') { c.fillStyle = '#22343d'; c.fillRect(300, 24, 400, 20); c.fillStyle = '#ffd452'; c.fillRect(300, 24, 400 * S.power, 20); c.fillStyle = '#fff'; c.fillText('KUASA · POWER', 500, 70); }
      if (S.st === 'reel') {
        const mx = 300, mw = 400; c.fillStyle = '#22343d'; c.fillRect(mx, 24, mw, 20); c.fillStyle = '#2ecc71'; c.fillRect(mx + mw * .1, 24, mw * .7, 20); c.fillStyle = '#e74c3c'; c.fillRect(mx + mw * .8, 24, mw * .2, 20); c.fillStyle = '#ffd452'; c.fillRect(mx + mw * S.tension - 4, 18, 8, 32);
        c.fillStyle = '#22343d'; c.fillRect(mx, 56, mw, 10); c.fillStyle = '#f39c12'; c.fillRect(mx, 56, mw * S.stamina, 10);
        if (S.run) { c.fillStyle = '#fff'; c.font = '900 30px system-ui'; c.fillText(S.run > 0 ? '⬅ Tarik ke kiri!' : 'Tarik ke kanan! ➡', 500, 110); }
      }
      c.fillStyle = '#fff'; c.font = '800 26px system-ui'; c.textAlign = 'left'; c.fillText(`🐟 ${S.catches.length}/${S.GOAL}`, 24, 576);
      parts.draw(c);
    },
    stop() { hideFishCard(); },
  };
}


// ------------------------------------------------------------ 7. BERSIH PANTAI — shared rules (2D and 3D)
export const TRASH = {
  botol: { bm: 'Botol plastik', en: 'Plastic bottle', bin: 'kitar', ic: '🧴' },
  tin: { bm: 'Tin minuman', en: 'Drink can', bin: 'kitar', ic: '🥫' },
  kaca: { bm: 'Botol kaca', en: 'Glass bottle', bin: 'kitar', ic: '🍾' },
  beg: { bm: 'Beg plastik', en: 'Plastic bag', bin: 'am', ic: '🛍️' },
  straw: { bm: 'Straw', en: 'Straw', bin: 'am', ic: '🥤' },
  poli: { bm: 'Bekas polistirena', en: 'Styrofoam box', bin: 'am', ic: '🍱' },
  balut: { bm: 'Pembalut makanan', en: 'Food wrapper', bin: 'am', ic: '🍬' },
};
export const BINS = { kitar: { bm: 'KITAR SEMULA', en: 'Recycling', col: '#1f6fd1' }, am: { bm: 'SAMPAH AM', en: 'General waste', col: '#2e8b57' } };
// area [x0,y0,x1,y1] where rubbish lies, bins {kitar:[x,y,r], am:[x,y,r]}, grab = pick radius; fx hooks for the renderer
export function beachCore(api, opts, { area, bins, grab, n = 14 }, fx = {}) {
  const r = mulberry32(opts.seed || 44), kinds = Object.keys(TRASH), items = [];
  for (let k = 0; k < n; k++) { let x, y, tries = 0; do { x = area[0] + r() * (area[2] - area[0]); y = area[1] + r() * (area[3] - area[1]); } while (tries++ < 30 && items.some(o => Math.hypot(o.x - x, o.y - y) < grab * 1.3));
    items.push({ id: k, kind: kinds[(k * 3 + Math.floor(r() * 7)) % kinds.length], x, y, hx: x, hy: y, rot: r() * 6.28, st: 'sand', fly: 0 }); }
  let held = null, ok = 0, wrong = 0, over = null, finished = false;
  api.step('Seret sampah ke tong yang betul', 'Drag each piece of rubbish into the right bin');
  const tools = () => api.tools([{ html: `<b>♻️</b><span>Kitar semula</span>`, sel: over === 'kitar' }, { html: `<b>🗑️</b><span>Sampah am</span>`, sel: over === 'am' }, { html: `<b>🧹</b><span>${ok}/${n}</span>` }]);
  tools();
  const binAt = (x, y) => { for (const [id, [bx, by, br]] of Object.entries(bins)) if (Math.hypot(x - bx, y - by) < br) return id; return null; };
  return {
    items, bins, get held() { return held; }, get over() { return over; }, stats: () => ({ ok, wrong, n }),
    down(p) { if (finished) return; let best = null, bd = grab; for (const o of items) if (o.st === 'sand') { const d = Math.hypot(o.x - p.x, o.y - p.y); if (d < bd) { bd = d; best = o; } } if (best) { held = best; best.st = 'held'; sfx.pop(); fx.pick && fx.pick(best); } },
    move(p) { if (!held) return; held.x = p.x; held.y = p.y; const b = binAt(p.x, p.y); if (b !== over) { over = b; tools(); } },
    up(p) {
      if (!held) return; const o = held; held = null; const b = binAt(o.x, o.y); over = null;
      if (b && TRASH[o.kind].bin === b) { o.st = 'bin'; o.bin = b; ok++; sfx.good(); fx.into && fx.into(o, b); api.progress(ok / n); tools();
        if (ok >= n && !finished) { finished = true; const t = api.elapsed(); api.step('Pantai bersih! Terima kasih!', 'The beach is clean! Thank you!'); setTimeout(() => api.finish({ stars: wrong === 0 && t < 90 ? 3 : wrong <= 2 ? 2 : 1, wrong }), 1300); } }
      else if (b) { wrong++; sfx.bad(); o.st = 'sand'; o.fly = 1; o.fx = o.x; o.fy = o.y; o.x = o.hx; o.y = o.hy; const T2 = TRASH[o.kind]; toast(`${T2.bm} → ${BINS[T2.bin].bm}`, `${T2.en} goes in the ${BINS[T2.bin].en.toLowerCase()} bin`); fx.wrong && fx.wrong(o, b); tools(); }
      else { o.st = 'sand'; o.hx = o.x; o.hy = o.y; fx.drop && fx.drop(o); }
    },
    update(dt) { for (const o of items) if (o.fly > 0) o.fly = Math.max(0, o.fly - dt * 2.2); },
  };
}
function Beach(api, opts) {
  const core = beachCore(api, opts, { area: [60, 250, 940, 440], bins: { kitar: [330, 535, 75], am: [670, 535, 75] }, grab: 48 });
  const r = mulberry32(7), crabs = [0, 1, 2].map(k => ({ x: 150 + k * 320, y: 300 + k * 50, vx: (k % 2 ? 1 : -1) * 40, t: r() * 5 })); let t = 0, lp = { x: 500, y: 300 };
  return {
    dbg: () => ({ items: core.items.map(o => ({ x: o.x, y: o.y, kind: o.kind, st: o.st, bin: TRASH[o.kind].bin })), bins: core.bins, ...core.stats() }),
    down(p) { lp = { ...p }; core.down(p); }, move(p) { lp = { ...p }; core.move(p); }, up(p) { core.up(p); },
    update(dt) { t += dt; core.update(dt); for (const c of crabs) { c.t -= dt; if (c.t < 0) { c.vx = (Math.random() - .5) * 120; c.t = 1 + Math.random() * 2; } c.x = clamp(c.x + c.vx * dt, 40, 960); } },
    draw(c) {
      const sky = c.createLinearGradient(0, 0, 0, 160); sky.addColorStop(0, '#7cc6ee'); sky.addColorStop(1, '#cfeefa'); c.fillStyle = sky; c.fillRect(0, 0, VW, 160);
      // Jambatan Angkat in the distance
      c.fillStyle = '#e9e1cf'; for (const x of [760, 800, 860, 900]) { c.fillRect(x, 40, 16, 110); c.fillStyle = '#2c8c99'; c.beginPath(); c.moveTo(x - 3, 40); c.lineTo(x + 8, 22); c.lineTo(x + 19, 40); c.fill(); c.fillStyle = '#e9e1cf'; }
      c.fillRect(776, 62, 24, 7); c.fillRect(876, 62, 24, 7); c.fillRect(680, 128, 300, 8);
      c.fillStyle = '#2f8fc4'; c.fillRect(0, 140, VW, 70); c.fillStyle = 'rgba(255,255,255,.8)'; for (let k = 0; k < 12; k++) c.fillRect(((k * 97 + t * 30) % 1060) - 40, 160 + (k % 3) * 14, 40, 3);
      const sand = c.createLinearGradient(0, 200, 0, VH); sand.addColorStop(0, '#f3e2ae'); sand.addColorStop(1, '#e2c98a'); c.fillStyle = sand; c.beginPath(); c.moveTo(0, 210 + Math.sin(t) * 4); for (let x = 0; x <= VW; x += 50) c.lineTo(x, 208 + Math.sin(t + x * .02) * 5); c.lineTo(VW, VH); c.lineTo(0, VH); c.fill();
      for (const cr of crabs) { c.fillStyle = '#e4572e'; c.beginPath(); c.ellipse(cr.x, cr.y, 14, 9, 0, 0, 7); c.fill(); c.strokeStyle = '#c0392b'; c.lineWidth = 2; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(cr.x + s * 10, cr.y); c.lineTo(cr.x + s * 20, cr.y - 8); c.stroke(); } }
      for (const [id, [bx, by]] of Object.entries(core.bins)) { const B = BINS[id], hl = core.over === id; c.fillStyle = B.col; c.beginPath(); c.roundRect(bx - 60, by - 55, 120, 110, 10); c.fill(); if (hl) { c.strokeStyle = '#fff'; c.lineWidth = 5; c.stroke(); } c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(bx - 64, by - 62, 128, 14); c.fillStyle = '#fff'; c.font = '800 15px system-ui'; c.textAlign = 'center'; c.fillText(B.bm, bx, by + 8); c.font = '30px system-ui'; c.fillText(id === 'kitar' ? '♻️' : '🗑️', bx, by - 16); }
      c.textAlign = 'center'; c.textBaseline = 'middle';
      for (const o of core.items) { if (o.st === 'bin') continue; const held = o.st === 'held', sh = o.fly ? Math.sin(o.fly * 9) * 8 * o.fly : 0; c.font = `${held ? 46 : 38}px system-ui`; c.save(); c.translate(o.x + sh, o.y); if (!held) c.rotate(Math.sin(o.rot) * .5); c.fillText(TRASH[o.kind].ic, 0, 0); c.restore(); }
      c.textBaseline = 'alphabetic';
    },
  };
}
