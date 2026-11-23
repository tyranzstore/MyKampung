# Grafik — audit dan naik taraf (Fasa 1 dan 2)

## Audit (apa yang ada sebelum ini)
- three.js 0.170.0 melalui import map; satu `WebGLRenderer` dikongsi semua mini game 3D (`js/minigames3d.js`), `antialias: true`.
- Output sRGB sudah betul (`outputColorSpace = SRGBColorSpace`). Tiada tone mapping, tiada environment map.
- Cahaya: satu `HemisphereLight` + satu `DirectionalLight` dengan bayang PCF lembut (1024 px pada telefon, 2048 px desktop).
- Bahan: `MeshStandardMaterial` satu warna tanpa tekstur untuk hampir semua bentuk binaan kod.
- Nisbah piksel: maks 1.5 pada skrin sentuh, 2 pada desktop. Tiada pilihan kualiti.
- Bandar (`town3d.js`) dan mini game lain guna laluan yang sama.

## Fasa 2 — adegan memancing (Jelajah Kail)
Semua perubahan berskop adegan: tone mapping dan nisbah piksel dipulihkan bila keluar, jadi mini game lain tidak berubah.
- Tone mapping ACES Filmic, exposure 1.12.
- Pencahayaan berasaskan imej: kubah langit bergradien ditukar kepada environment map (PMREM), jadi air dan kayu basah memantulkan warna langit.
- Air: normal map riak janaan kod (128 px, berulang), bergerak; roughness rendah; ombak bucu halus; laluan kilau matahari; gelang riak bila umpan jatuh atau ikan melawan.
- Tekstur janaan kod (256 px ke bawah): papan kayu berurat dan berbuku, genting bumbung. Dipakai pada jeti, wakaf dan rumah atas air.
- Suasana tetap bagi setiap tempat (pagi keemasan, senja, tengah hari, laut lepas); jam sebenar hanya mengubah ikan yang menggigit.
- Kamera rendah di belakang pemancing yang duduk; kamera pergelutan dan kamera tangkapan berasingan.
- Joran lima segmen yang melentur ikut tegangan, kekili berpusing, pelampung bercahaya.
- Bar tegangan bergradien dengan penanda.

## Pratetap kualiti (☰ → Grafik)
| | Rendah | Sederhana | Tinggi |
|---|---|---|---|
| Nisbah piksel maks | 1 | 1.5 | 2 |
| Bayang | tiada | ada | ada |
| Pantulan langit (env map) | tiada | ada | ada |
| Ombak bucu | tiada | ada | ada |
Lalai: Sederhana pada skrin sentuh, Tinggi pada desktop. Disimpan dalam `S.gfxQ` (medan tambahan).

## Ukuran (Chrome tanpa kepala, GL perisian, 844×390, `renderer.info`)
Draw call sebelum penggabungan hiasan statik: 437 / 445 / 167 / 64.

| Tempat | Draw call | Segi tiga (Tinggi/Sederhana) | Segi tiga (Rendah) | FPS perisian T / S / R |
|---|---|---|---|---|
| Tasik Tenang | 50 | 61,868 | 56,336 | 7.2 / 6.8 / 11.6 |
| Sungai Lembayung | 49 | 60,336 | 54,804 | 7.2 / 6.4 / 11.2 |
| Terumbu Mentari | 42 | 40,661 | 35,129 | 7.6 / 7.6 / 14.8 |
| Perairan Dalam | 26 | 30,793 | 25,261 | 9.2 / 9.2 / 16.4 |

Bajet: ~100 draw call, 150k segi tiga — dipatuhi. FPS di atas ialah **GL perisian pada pelayan ujian, bukan telefon**. Tiada ukuran telefon sebenar lagi.

## Tambahan selepas kelulusan audit
- Tone mapping ACES kini ditetapkan di `runGame3D` untuk tiga adegan memancing (`kail`, `seafish`, `fish`); mini game lain kekal tanpa tone mapping seperti asal.
- Sederhana/Tinggi guna lautan dikongsi `ocean.js` (ombak Gerstner, pantulan langit, buih); Rendah guna satah ringkas.
- Pemancing ialah model hero TYRANZ sebenar; figura duduk hanya sandaran jika model gagal dimuat.
- Jelajah Kail tidak lagi jatuh ke mod 2D jika 3D gagal; ia tunjuk mesej "Perlukan grafik 3D".

## Had
- Tiada tekstur foto atau model beresolusi tinggi: semua tekstur dijana kod, jadi rupa ialah "low-poly bertekstur", bukan fotorealistik.
- Tiada pantulan air sebenar (planar/SSR); pantulan datang daripada warna langit sahaja.
- `js/gfx.js` dikongsi belum dibuat: langit, environment dan tekstur masih di dalam `js/kail.js`. Pancing Laut dan Memancing hanya dapat tone mapping, bukan langit atau tekstur baharu.
- Tiada LOD atau tekstur termampat (KTX2 dilarang oleh CI repo).
- Bandar, watak dan mini game lain belum disentuh (Fasa 3 dan 4).
- Sedikit pertambahan kiraan geometri setiap kali bertukar tempat (kira-kira 10) masih perlu dijejak.

## Fasa 2.1 — penghalusan rupa
- **Air:** kilau dan pantulan dikurangkan (roughness 0.34, tiada metalness, pantulan langit 0.35, laluan kilau lebih sempit dan pudar); warna dalam lebih gelap; ketinggian ombak berbeza bagi setiap tempat; exposure adegan kail 1.0.
- **Pokok kelapa:** batang melengkung dan tirus dengan gelang, pelepah melengkung berbulu (tekstur alfa), buah kelapa; tiga varian bentuk, ketinggian dan putaran rawak terkawal; dilukis dengan `InstancedMesh` (2 draw call bagi setiap varian).
- **Rumah kampung:** bumbung gabel curam dengan papan pemeleh dan tunjuk langit, serambi berpagar, tangga, tingkap berbingkai dengan daun tingkap, pintu, rumah dapur sisi; lebar, tinggi, warna dan putaran berbeza. Tiada GLB rumah kampung dalam repo (hanya rumah suburban Kenney), jadi ini masih binaan kod.
- **Langit:** cakera matahari lebih kecil dan hangat, sinaran lembut jejari, awan bergerak yang diwarnakan ikut suasana.
- **Persembahan:** joran di tangan hero; ujian baharu memastikan setiap spesies menunjuk model yang wujud. Ujian itu menemui pepijat: Haruan menunjuk kunci `fish_Alu` yang tidak wujud (kini `fish_Alu-Alu`).
- **Padanan model ikan:** 10 daripada 14 spesies guna model sendiri. Tilapia, Keli, Haruan dan Sebarau meminjam badan ikan lain dengan kulit sendiri kerana tiada GLB air tawar.

| Tempat | Draw call | Segi tiga (T/S) | Segi tiga (R) | FPS perisian T / S / R |
|---|---|---|---|---|
| Tasik Tenang | 53 | 54,302 | 48,770 | 6.0 / 6.4 / 10.4 |
| Sungai Lembayung | 51 | 52,842 | 47,310 | 6.0 / 6.0 / 10.4 |
| Terumbu Mentari | 51 | 36,129 | 30,597 | 7.2 / 7.2 / 13.2 |
| Perairan Dalam | 35 | 30,941 | 25,409 | 8.4 / 8.4 / 14.8 |

FPS ialah GL perisian pada pelayan ujian, bukan telefon.
