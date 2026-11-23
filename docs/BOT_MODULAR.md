# Bot modular — Limbungan Bot

Sistem naik taraf bot: satu badan (`assets/packs/bot/hull_lv1.glb`) dan enam slot komponen dengan empat tahap setiap satu.
Status: Limbungan Bot (pratonton, beli, pasang, tanggal, laras) siap. **Belum disambung** kepada Pancing Laut dan Jelajah Kail.

## Buka
Butang **🛠️ Bot** di bar bawah peta. 3D sahaja. Untuk menguji dengan duit: Menu → Simpanan → import `docs/ujian/simpanan-limbungan.json` (RM20,000; menggantikan simpanan pelayar itu, jadi guna tetingkap Incognito).

## Fail
| Fail | Peranan |
|---|---|
| `js/boatparts.js` | Data: slot, tahap, harga, nilai, keperluan, titik lampiran, saiz pemegang tempat, bahagian terbina |
| `js/boatrules.js` | Peraturan tulen (ujian: `node test/boat/boatrules.test.mjs`) |
| `js/boatbuilder.js` | Pemasang 3D: badan, komponen, pemegang tempat, sorok bahagian terbina, pilih slot |
| `js/boatyard.js`, `boatyard.css` | Adegan bengkel dan antara muka |
| `assets/packs/bot/` | GLB badan dan komponen; `pack.json` |

## Muat naik komponen (tanpa Blender)
1. Namakan fail `<slot>_lv<tahap>.glb`: `engine`, `steering`, `propeller`, `seat`, `fishing`, `accessory`; tahap 1–4. Contoh: `engine_lv2.glb`.
2. Muat naik ke `assets/packs/bot/` di GitHub (branch, bukan `main`). CI menyemak fail (`packAsset`: tekstur ≤ 2048 px, tanpa Draco/Meshopt/KTX2) dan mengemas kini `assets/packs/index.json`.
3. Tekstur lebih besar: `python3 tools/glb_resize_textures.py asal.glb assets/packs/bot/engine_lv2.glb --max 1024`.
4. Buka Limbungan Bot. Kotak **SEMENTARA** diganti model sebenar secara automatik; tiada kod perlu diubah.

Model diskala supaya muat dalam `size` slot (atau `size` tahap itu) dan asalnya ialah **tengah bawah** kotak sempadannya.

## Laras titik lampiran (pemilik sahaja)
Buka permainan dengan `?laras=1` di hujung alamat (atau `localStorage.mynegeri_owner = '1'`). Dalam limbungan tekan **🛠**:
- gelangsar X/Y/Z (unit badan: panjang bot = 1), pusingan X/Y/Z (darjah), skala;
- amaran jika kotak komponen bertindih dengan bahagian terbina badan atau komponen lain;
- **Salin konfigurasi** memberi baris `offset: { pos, rot, scale }` untuk ditampal pada tahap itu dalam `js/boatparts.js`.
Pelarasan disimpan pada pelayar itu sahaja (`mynegeri_bot_tune`) sehingga ditampal ke konfigurasi.

## Bahagian terbina badan bot
Badan ialah satu mesh dengan 58 "pulau" segi tiga. Pulau yang disenaraikan di `builtins` disorok semasa dimuat (fail tidak diubah):
- **Stereng asal** (3 pulau, 2,440 segi tiga): disorok bila stereng bukan tahap 1.
- **Panel berkusyen dan rel atas konsol**: kekal (keputusan pemilik); tiada slot menyoroknya.
- **Badan, dek, bangku, penutup petak**: satu pulau; tidak boleh diasingkan.
- Enjin dan kipas tiada dalam model.

## Peraturan
- Tahap 1 percuma dan terpasang. Beli ikut urutan. Beli tidak memasang; pasang dan tanggal percuma.
- Keserasian: enjin Lv3 perlu stereng Lv2; enjin Lv4 perlu stereng Lv3 dan kipas Lv2; kipas Lv3/Lv4 perlu enjin Lv2/Lv3; peralatan pancing Lv4 perlu tempat duduk Lv2. Bahagian yang diperlukan bahagian lain tidak boleh ditanggal dahulu.
- Bayaran melalui `wallet.spend()` dengan kunci sekali beli `bot:<slot>:<tahap>`; kunci yang sudah dibayar dipulihkan tanpa caj.
- Enjin 30 kk / 60 kk yang dibeli dalam Pancing Laut (`S.sea.engine`) dimiliki di sini tanpa caj. Medan lama tidak diubah.
- Simpanan: `S.sea.bot = { hull, owned, equipped }`, medan tambahan.

## Imbangan
Semua harga dan nilai ialah nombor dalam `js/boatparts.js`. Ujian hanya mensyaratkan tahap 1 percuma, harga menaik dan nilai tidak menurun.

## Had
- Semakan pertindihan guna kotak sejajar paksi dan mengabaikan pusingan: anggap ia amaran, sahkan dengan mata.
- Semua komponen masih pemegang tempat sehingga GLB dimuat naik.
- Statistik bot belum memberi kesan dalam permainan (langkah seterusnya).
