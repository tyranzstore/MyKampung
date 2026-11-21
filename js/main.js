import { $, S, save, wipe, saveStatus, keepSaveSafe, exportSave, parseSave, importSave, checkDaily, audioInit, setMuted, sfx, toast, dialog, modal, ui, wantMusic, setMusic } from './core.js';
import { createTown, NPCS } from './town.js';
import { createTown3D } from './town3d.js';
import { runGame, FISH, RARITY } from './minigames.js';
import { runGame3D, has3D } from './minigames3d.js';
import { ACTIVITIES } from './activities.js';
import { earn, fmtRM, balance } from './wallet.js';
import { runKaraoke } from './karaoke.js';

const TOWN = 'Kampung Seri Damai';
checkDaily();

// ------------------------------------------------------------ chapters & missions
// S.chapter = current chapter (1-based), S.mission = mission index inside it.
const CHAPTERS = [
  { n: 1, bm: 'Pulang ke Kampung', en: 'Coming Home', missions: [
    { bm: 'Sembang dengan Tok Abah', en: 'Talk to Tok Abah', target: 'abah' },
    { bm: 'Tebas laman Tok Abah', en: "Cut the grass in Tok Abah's yard", target: 'yard_abah' },
    { bm: 'Baiki rumah Tok Abah', en: "Repair Tok Abah's house", target: 'house_abah' },
    { bm: 'Jumpa Nek Ma di warung', en: 'Meet Nek Ma at her stall', target: 'kiah' },
    { bm: 'Cuci kereta di kedai Pok Wan', en: "Wash a car at Pok Wan's shop", target: 'carwash' },
    { bm: 'Kembali kepada Tok Abah', en: 'Go back to Tok Abah', target: 'abah' },
  ] },
  { n: 2, bm: 'Musim Menuai', en: 'Harvest Season', missions: [
    { bm: 'Sembang dengan Tok Abah', en: 'Talk to Tok Abah', target: 'abah' },
    { bm: 'Jumpa Pak Hassan di sawah', en: 'Meet Pak Hassan at the padi field', target: 'hassan' },
    { bm: 'Tuai padi Pak Hassan', en: "Harvest Pak Hassan's padi", target: 'padi' },
    { bm: 'Jual beras kepada Uncle Lim', en: 'Sell the rice to Uncle Lim', target: 'lim' },
    { bm: 'Jemput orang kampung ke kenduri', en: 'Invite the villagers to the feast', target: 'invite', count: () => S.invited.length, of: 3 },
    { bm: 'Kenduri kesyukuran di sawah', en: 'Thanksgiving feast at the padi field', target: 'hassan' },
  ], intro: ['Musim menuai dah tiba! Padi di sawah dah menguning dan orang baru muncul di kampung.', 'Harvest season has arrived! The padi has turned gold and new faces have appeared in the village.'] },
  { n: 3, bm: 'Turun ke Laut', en: 'Out to Sea', missions: [
    { bm: 'Sembang dengan Tok Abah', en: 'Talk to Tok Abah', target: 'abah' },
    { bm: 'Jumpa Pak Mat di jeti', en: 'Meet Pak Mat at the jetty', target: 'mat' },
    { bm: 'Baiki bot Pak Mat', en: "Fix Pak Mat's boat", target: 'jeti' },
    { bm: 'Turun ke laut — memancing', en: 'Head out to sea — go fishing', target: 'jeti' },
    { bm: 'Jual ikan kepada Nek Ma', en: 'Sell the fish to Nek Ma', target: 'kiah' },
    { bm: 'Kembali kepada Pak Mat', en: 'Go back to Pak Mat', target: 'mat' },
  ], intro: ['Angin laut bertiup. Jeti nelayan yang lama sunyi kini dibuka semula — dan seorang nelayan tua sedang menunggu.', 'A sea breeze is blowing. The quiet old fishing jetty is open again — and an old fisherman is waiting.'] },
  { n: 4, bm: 'Pantai Miami', en: 'Miami Beach', missions: [
    { bm: 'Sembang dengan Tok Abah', en: 'Talk to Tok Abah', target: 'abah' },
    { bm: 'Jumpa Kak Long di gerai keropok lekor', en: "Meet Kak Long at her keropok lekor stall", target: 'kaklong' },
    { bm: 'Bersihkan Pantai Miami', en: 'Clean up Pantai Miami', target: 'pantai' },
    { bm: 'Tengok Jambatan Angkat naik', en: 'Watch the drawbridge open', target: 'jambatan' },
    { bm: 'Kembali kepada Kak Long', en: 'Go back to Kak Long', target: 'kaklong' },
  ], intro: ['Jalan baru ke Pantai Miami dah dibuka. Di hujung pantai, Jambatan Angkat berdiri megah di muara sungai.', 'A new road to Pantai Miami has opened. At the far end of the beach, the drawbridge stands proudly over the river mouth.'] },
  { n: 5, bm: 'Pesta Kampung', en: 'Village Festival', missions: [
    { bm: 'Sembang dengan Tok Abah', en: 'Talk to Tok Abah', target: 'abah' },
    { bm: 'Jumpa Pak Ajis di Balai Raya', en: 'Meet Pak Ajis at the community hall', target: 'balai' },
    { bm: 'Beli barang pesta di Damai City Mall', en: 'Buy festival supplies at Damai City Mall', target: 'mall' },
    { bm: 'Bantu Nek Ma masak untuk kenduri', en: 'Help Nek Ma cook for the feast', target: 'kiah' },
    { bm: 'Karaoke di Balai Raya', en: 'Sing karaoke at the community hall', target: 'balai' },
    { bm: 'Malam pesta bersama Tok Abah', en: 'Festival night with Tok Abah', target: 'abah' },
  ], intro: ['Kampung dah hidup semula! Orang kampung nak buat Pesta Kampung di Balai Raya — dengan kenduri, karaoke dan bunga api.', 'The village is alive again! The villagers want to hold a Village Festival at the community hall — with a feast, karaoke and fireworks.'] },
];
const NEXT = { n: 6, bm: 'Balik Raya', en: 'Home for Raya', teaser: 'Lemang, pelita dan rumah terbuka. · Lemang, oil lamps and open house.' };
const INVITE = ['amin', 'ani', 'abu'];
const AJIS = NPCS.abu; // Pak Ajis leads the festival committee
function fireworks() { if (town.fireworks) town.fireworks(14); toast('🎆 Bunga api di langit Kampung Seri Damai!', 'Fireworks over Kampung Seri Damai!'); sfx.cheer && sfx.cheer(); }
// save migration: older saves only knew chapter 1
if (!S.chapter) S.chapter = 1;
if (!S.invited) S.invited = [];
if (S.chapter === 1 && S.chapterDone) { S.chapter = 2; S.mission = 0; S.chapterDone = false; S.newChapter = true; save(); }
if (!S.catch) S.catch = [];
if (S.introSeen === undefined) { if (S.chapter === 3 && S.mission === 0) S.newChapter = true; S.introSeen = S.chapter; } // saves that finished Bab 2 before Bab 3 existed get the Bab 3 intro
if (S.chapter === 4 && S.mission === 0 && !S.seenB4) { S.newChapter = true; S.seenB4 = true; save(); }
if (S.chapter === 5 && S.mission === 0 && !S.seenB5) { S.newChapter = true; S.seenB5 = true; save(); } // saves that finished Bab 4 before Bab 5 existed get the Bab 5 intro // saves that finished Bab 3 before Bab 4 existed get the Bab 4 intro
const chap = () => CHAPTERS[S.chapter - 1];
const cur = () => { const c = chap(); return c ? c.missions[S.mission] : null; };
const done = (ch, m) => S.chapter > ch || (S.chapter === ch && S.mission > m); // has mission m of chapter ch been completed?
const at = (ch, m) => S.chapter === ch && S.mission === m;
const targetOf = (m) => m.target === 'invite' ? (INVITE.find(id => !S.invited.includes(id)) || 'hassan') : m.target;

const LINES = {
  abah0: [['Eh, cucu dah balik! Lama Tok tunggu.', "Oh, you're back! I've waited so long."],
    ['Sejak budak-budak muda pergi bandar, kampung ni makin sunyi.', 'Since the young ones left for the city, the village has gone quiet.'],
    ['Rumput laman Tok pun dah paras lutut. Tolong tebaskan, ya?', 'Even my yard grass is knee-high. Could you cut it for me?']],
  abah2: [['Kemas dah laman! Tapi tengoklah rumah Tok ni…', 'The yard looks neat! But look at my house…'],
    ['Cat dah mengelupas, zink bumbung pun bocor.', 'The paint is peeling and the zinc roof leaks.'],
    ['Ketik rumah Tok untuk mula baiki.', 'Tap my house to start the repairs.']],
  abah3: [['MasyaAllah, cantiknya rumah Tok! Macam baru.', 'Wow, my house looks brand new!'],
    ['Pergilah jumpa Nek Ma di warung. Dia ada cerita.', 'Go see Nek Ma at her stall. She has news.']],
  kiah: [['Ya Allah, kamu dah besar! Duduk, minum teh dulu.', "Goodness, you've grown! Sit, have some tea."],
    ['Pok Wan kat kedai cuci kereta tu sakit pinggang. Kereta pelanggan bersusun.', "Pok Wan at the car wash hurt his back. Cars are piling up."],
    ['Tolong dia sekejap? Kedai dia di simpang jalan, sebelah kanan.', "Could you help him? His shop is at the crossroads, on the right."]],
  din: [['Berkilat! Macam kereta baru keluar kedai.', 'Spotless! Like it just left the showroom.'],
    ['Esok datang lagi. Ada saja kereta nak dicuci — Pok Wan bayar upah.', "Come back tomorrow. There's always a car to wash — I'll pay you."]],
  abah5: [['Satu kampung bercakap pasal kamu hari ni.', 'The whole village is talking about you today.'],
    ['Kampung ni boleh hidup balik kalau orang muda macam kamu ada.', 'This village can come alive again with young people like you.'],
    ['Esok musim menuai. Sawah padi tu tunggu kamu!', "Tomorrow is harvest season. The padi fields are waiting for you!"]],
  // ---- Bab 2
  abah_b2: [['Assalamualaikum, cucu. Tengok sawah tu — dah menguning!', 'Peace be upon you. Look at the field — it has turned gold!'],
    ['Pak Hassan tanam padi tu seorang diri. Anak-anak dia semua kerja di bandar.', 'Pak Hassan planted it all by himself. His children all work in the city.'],
    ['Dia dah tak larat nak tuai seorang. Pergilah tolong dia di sawah.', "He can't harvest it alone anymore. Go and help him at the field."]],
  hassan1: [['Ha, ni cucu Tok Abah yang orang kampung puji tu!', "Ah, so you're Tok Abah's grandchild everyone is praising!"],
    ['Dah lama tak ada orang muda turun sawah. Pak Hassan tuai cara lama — guna sabit.', "It's been ages since young folk came to the field. I harvest the old way — with a sickle."],
    ['Tuai rumpun padi, kumpul berkas atas tikar, lepas tu banting dalam tong. Ketik sawah untuk mula!', 'Cut the clumps, gather the bundles on the mat, then thresh them in the tub. Tap the field to start!']],
  hassan2: [['Alhamdulillah, berkat! Penuh tong tu dengan padi.', 'Thank God, what a blessing! The tub is full of grain.'],
    ['Lepas dikisar, dapatlah beras. Bawa ke kedai Uncle Lim — dia beli dengan harga elok.', "Once milled, that's our rice. Take it to Uncle Lim's shop — he pays a fair price."]],
  lim: [['Wah, beras baru dari sawah Pak Hassan? Wangi betul!', "Wow, new rice from Pak Hassan's field? It smells wonderful!"],
    ['Uncle beli semua, ya. Beras kampung, orang bandar pun cari.', 'I\'ll buy it all. Even city folk look for kampung rice.'],
    ['Eh, Nek Ma cakap Pak Hassan nak buat kenduri kesyukuran. Pergilah jemput orang kampung!', 'Oh, Nek Ma says Pak Hassan is holding a thanksgiving feast. Go invite the villagers!']],
  inv_amin: [['Kenduri? Ada ayam masak merah tak? Amin datang!', "A feast? Will there be chicken masak merah? I'm coming!"]],
  inv_ani: [['Terima kasih jemput Cikgu. Nanti Cikgu bawa kuih seri muka, ya.', "Thank you for inviting me. I'll bring some kuih seri muka."]],
  inv_abu: [['InsyaAllah, Pak Ajis datang lepas Asar. Bawa gitar sekali!', "God willing, I'll come after Asar prayers. I'll bring my guitar!"]],
  hassan5: [['Ramai betul yang datang! Dah lama sawah ni tak meriah macam ni.', "So many people came! It's been years since this field was this lively."],
    ['Terima kasih, nak. Kau dah hidupkan semula semangat bertani kampung ni.', "Thank you, child. You've brought farming back to life in this village."],
    ['Mulai esok, datanglah tuai padi bila-bila. Pak Hassan bayar upah!', "From tomorrow, come and harvest any time. I'll pay you for it!"]],
  // ---- Bab 3
  abah_b3: [['Cucu, Tok ada kawan lama — Pak Mat, nelayan di jeti.', 'Grandchild, I have an old friend — Pak Mat, the fisherman at the jetty.'],
    ['Dulu sepuluh bot turun ke laut setiap subuh. Sekarang tinggal bot dia seorang.', 'Ten boats used to go out every dawn. Now only his is left.'],
    ['Bot dia pun dah bocor. Pergilah jumpa dia di jeti.', "And his boat is leaking. Go and see him at the jetty."]],
  mat1: [['Hah, cucu Abah! Mari, mari. Tengok bot Pak Mat ni…', "Ah, Abah's grandchild! Come here. Look at my boat…"],
    ['Penuh teritip, papan pun dah berlubang. Dah sebulan tak turun laut.', "Covered in barnacles and the planks have holes. I haven't been to sea for a month."],
    ['Kikis teritip, tampal lubang, cat semula. Ketik jeti untuk mula!', 'Scrape the barnacles, patch the holes, repaint it. Tap the jetty to start!']],
  mat2: [['MasyaAllah, cantiknya! Bot Pak Mat macam baru keluar limbungan.', 'Beautiful! My boat looks fresh out of the boatyard.'],
    ['Air pasang dah naik. Naik bot, kita ke tengah laut!', "The tide is in. Hop on the boat, we're heading out to sea!"],
    ['Pantai untuk ikan harian, terumbu karang untuk ikan jarang, laut dalam kalau berani — tuna sirip kuning ada di sana!', 'The shallows for everyday fish, the reef for rare ones, the deep sea if you dare — yellowfin tuna live out there!'],
    ['Ketik jeti bila dah sedia.', "Tap the jetty when you're ready."]],
  mat3: [['Rezeki laut! Banyak juga kau dapat.', "The sea's bounty! You caught quite a lot."],
    ['Bawa ikan ni ke warung Nek Ma. Dia selalu cari ikan segar untuk ikan bakar.', 'Take these to Nek Ma. She always wants fresh fish for her ikan bakar.']],
  kiah3: [['Ikan segar dari laut kita sendiri! Dah lama Nek tak dapat ikan macam ni.', "Fresh fish from our own sea! I haven't had fish like this in ages."],
    ['Malam ni Nek buat ikan bakar. Orang kampung mesti datang ramai!', "Tonight I'll make ikan bakar. The whole village will come!"]],
  kiah3b: [['Eh, Pak Mat ada cerita nak beritahu kamu. Pergilah ke jeti.', 'Oh, Pak Mat has something to tell you. Go to the jetty.']],
  abah_b5: [['Cucu, kampung kita dah lain sekarang. Sawah menguning, jeti riuh, pantai bersih — semua sebab kamu.', 'Grandchild, our village is different now. The padi is golden, the jetty is busy, the beach is clean — all because of you.'],
    ['Orang kampung nak buat Pesta Kampung di Balai Raya Sabtu ni. Pak Ajis jadi ketua jawatankuasa.', 'The villagers want to hold a Village Festival at the community hall this Saturday. Pak Ajis is leading the committee.'],
    ['Pergilah ke Balai Raya, tolong dia. Ketik Balai Raya di peta.', 'Go to the community hall and help him. Tap the Balai Raya on the map.']],
  ajis1: [['Hah, sampai pun! Pak Ajis dah lama tunggu. Balai ni dah dihias sikit — tapi barang pesta tak cukup lagi.', "Ah, you're here! I've been waiting. The hall is half decorated — but we still need supplies."],
    ['Pergi ke Damai City Mall, beli barang dalam senarai. Lepas tu tolong Nek Ma masak untuk kenduri.', 'Go to Damai City Mall and buy what is on the list. Then help Nek Ma cook for the feast.'],
    ['Malam nanti ada karaoke — Pak Ajis main gitar, kamu menyanyi!', "Tonight there's karaoke — I'll play guitar and you'll sing!"]],
  mall5: [['Lengkap! Pelita, kain rentang, pinggan, minuman — semua ada.', 'All done! Lamps, banners, plates, drinks — everything.'], ['Sekarang pergi ke warung Nek Ma. Dia perlukan tangan tambahan di dapur.', "Now go to Nek Ma's stall. She needs an extra pair of hands in the kitchen."]],
  kiah5: [['Kenduri besar malam ni! Nasi minyak, ayam masak merah, satay, apam balik…', "A big feast tonight! Nasi minyak, ayam masak merah, satay, apam balik…"], ['Tolong Nek layan pelanggan di gerai makanan pesta. Cepat dan tepat, ya!', 'Help me serve customers at the festival food stalls. Quick and correct!']],
  kiah5b: [['Sedap! Semua orang kenyang. Pergilah ke Balai Raya — karaoke dah nak mula!', "Delicious! Everyone's full. Go to the community hall — karaoke is about to start!"]],
  ajis2: [['Pentas dah siap, lampu dah menyala. Lagu kita malam ni: "Kampung Kita" — lagu yang Pak Ajis tulis sendiri.', 'The stage is ready and the lights are on. Our song tonight: "Kampung Kita" — a song I wrote myself.'],
    ['Ketik lajur bila not sampai ke garisan. Rendah, tengah, tinggi. Jangan malu!', "Tap the lane when a note reaches the line. Low, middle, high. Don't be shy!"]],
  ajis3: [['Wah, sorak orang kampung sampai ke laut! Kamu memang bintang kampung.', 'Wow, the cheers reached the sea! You really are the village star.'], ['Tok Abah tunggu kamu di rumah — dia ada sesuatu nak cakap.', 'Tok Abah is waiting for you at home — he has something to say.']],
  abah5: [['Cucu… Tok dengar kamu menyanyi tadi. Sampai Tok menitis air mata.', 'Grandchild… I heard you singing earlier. It brought tears to my eyes.'],
    ['Dulu kampung ni sunyi. Orang muda semua ke bandar. Sekarang tengoklah — semua orang balik, semua orang ketawa.', 'This village used to be quiet. The young ones all left for the city. Now look — everyone came back, everyone is laughing.'],
    ['Tengok langit tu — bunga api! Pesta Kampung Seri Damai yang pertama dalam dua puluh tahun.', "Look at the sky — fireworks! Kampung Seri Damai's first festival in twenty years."],
    ['Terima kasih, cucu. Kamu wira kampung kita.', 'Thank you, grandchild. You are our village hero.']],
  abah_b4: [['Cucu, jalan baru ke Pantai Miami dah siap. Dari situ nampak Jambatan Angkat!', 'Grandchild, the new road to Pantai Miami is finished. You can see the drawbridge from there!'],
    ['Kawan lama Tok, Kak Long, berniaga keropok lekor tepi pantai. Pergilah jumpa dia — ikut jalan ke timur.', 'My old friend Kak Long sells keropok lekor by the beach. Go and see her — take the road east.']],
  kaklong1: [['Eh, cucu Tok Abah ke ni? Mari, mari! Kak Long jual keropok lekor paling rangup sekuala!', "Oh, are you Tok Abah's grandchild? Come, come! I sell the crispiest keropok lekor around!"],
    ['Tapi tengoklah pantai ni… botol, tin, beg plastik, bekas polistirena merata-rata. Penyu pun tak nak naik bertelur.', "But look at this beach… bottles, cans, plastic bags, styrofoam everywhere. Even the turtles won't come up to nest."],
    ['Tolong Kak Long bersihkan? Ingat: botol plastik, tin dan kaca masuk tong biru KITAR SEMULA. Yang lain masuk tong SAMPAH AM.', 'Will you help me clean it? Remember: plastic bottles, cans and glass go in the blue RECYCLING bin. Everything else goes in GENERAL WASTE.']],
  kaklong2: [['Masya-Allah, bersihnya! Ni baru Pantai Miami yang Kak Long kenal dulu.', "Masya-Allah, so clean! Now this is the Pantai Miami I remember."],
    ['Kejap lagi Jambatan Angkat nak naik — Pak Mat nak bawa bot dia keluar ke laut ikut muara. Pergilah tengok dekat jambatan!', "The drawbridge is about to open — Pak Mat is taking his boat out to sea through the river mouth. Go and watch it from the bridge!"]],
  bridge: [['Tengok tu! Jambatan Angkat ni jambatan angkat yang pertama di Malaysia — malah di Asia Tenggara.', "Look at that! This is the first drawbridge in Malaysia — in all of Southeast Asia, in fact."],
    ['Reka bentuknya diilhamkan daripada Tower Bridge di London. Empat menara tinggi, dan setiap pasang disambung jambatan langit di atas.', "Its design was inspired by London's Tower Bridge. Four tall towers, and each pair is joined by a skybridge up top."],
    ['Bila kapal atau bot besar nak lalu, dua bahagian tengah jambatan terangkat ke atas. Hebat, kan?', 'When a ship or big boat needs to pass, the two middle sections lift up. Amazing, right?']],
  kaklong3: [['Hah, macam mana? Cantik, kan? Waktu malam lagi cantik — lampu menara menyala.', "So, what did you think? Beautiful, right? It's even prettier at night when the towers light up."],
    ['Nah, keropok lekor panas dengan sos cili untuk kamu. Datanglah selalu tolong jaga pantai — Kak Long bayar!', "Here, hot keropok lekor with chilli sauce for you. Come and help keep the beach clean any time — I'll pay you!"]],
  mat5: [['Cucu, tengok tu — anak-anak muda datang ke jeti nak belajar memancing!', 'Look — the young ones are coming to the jetty to learn fishing!'],
    ['Dah lama jeti ni tak riuh macam ni. Kau bawa balik semangat laut kampung kita.', "This jetty hasn't been this lively in years. You brought back our village's love for the sea."],
    ['Datanglah memancing bila-bila. Hasil tangkapan, Pak Mat beli!', "Come fishing any time. I'll buy whatever you catch!"]],
};
const IDLE = {
  abah: [['Jalan elok-elok, cucu.', 'Walk carefully, grandchild.'], ['Dulu Tok bina rumah ni dengan tangan Tok sendiri.', 'I built this house with my own hands.']],
  kiah: [['Nak teh tarik? Nanti Nek buatkan.', "Want teh tarik? I'll make you one."], ['Nasi lemak Nek paling sedap sekampung!', 'My nasi lemak is the best in the village!']],
  din: [['Aduh, pinggang ni…', 'Oh, my back…'], ['Kereta bersih, hati pun senang.', 'Clean car, happy heart.']],
  amin: [['Abang, Kakak, jom main bola petang nanti!', "Let's play football this evening!"], ['Bila besar, Amin nak jadi wira kampung!', 'When I grow up, I want to be a village hero!']],
  hassan: [['Padi ni macam anak — kena jaga hari-hari.', 'Padi is like a child — you tend it every day.'], ['Bila hujan turun, sawah ni hijau semula.', 'When the rain comes, this field turns green again.']],
  lim: [['Mari, mari! Gula, tepung, minyak — semua ada!', 'Come, come! Sugar, flour, oil — I have everything!'], ['Uncle buka kedai ni sejak tahun 1985.', "I've run this shop since 1985."]],
  ani: [['Jangan lupa membaca, ya!', "Don't forget to read!"], ['Murid-murid Cikgu dulu semua dah besar.', 'All my old pupils are grown up now.']],
  kaklong: [['Keropok lekor! Panas-panas, rangup-rangup!', 'Keropok lekor! Hot and crispy!'], ['Petang-petang ramai orang main wau kat pantai ni.', 'In the evenings lots of people fly wau kites on this beach.'], ['Jangan buang sampah merata, ya!', "Don't litter, okay!"]],
  mat: [['Laut ni guru yang paling sabar.', 'The sea is the most patient teacher.'], ['Subuh esok angin elok. Ikan mesti banyak.', 'The wind will be good at dawn. Plenty of fish.']],
  abu: [['Petang-petang Pak Ajis main gitar di beranda.', 'In the evenings I play guitar on the verandah.'], ['Rumah Pak Ajis ni dah tiga generasi.', 'This house has been in my family for three generations.']],
};
const GREETS = [['Assalamualaikum!', 'Peace be upon you!'], ['Panas betul hari ni.', "It's really hot today."], ['Dah makan?', 'Have you eaten?'], ['Eh, anak siapa ni? Oh, cucu Tok Abah!', "Whose kid is this? Oh, Tok Abah's grandchild!"], ['Petang nanti ada gotong-royong.', "There's a community clean-up this evening."]];
const RANKS = [[0, 'Budak Baru'], [8, 'Anak Kampung'], [20, 'Geng Kampung'], [40, 'Wira Kampung'], [70, 'Ketua Belia']];
const rank = () => RANKS.filter(([n]) => S.stars >= n).pop()[1];

const padiState = () => S.chapter < 2 ? 'green' : (done(2, 2) && S.daily.padiDone) || (at(2, 3) || at(2, 4) || at(2, 5)) ? 'cut' : 'ripe';
const flags = () => ({
  abahRepaired: done(1, 2), houseColor: S.houseColor, carwashOpen: done(1, 3),
  yardsCut: [...(done(1, 1) ? ['abah'] : []), ...S.daily.yards], padiOpen: S.chapter >= 2, padiState: padiState(), alwaysDay: S.timeMode === 'day',
  jetiOpen: S.chapter >= 3, boatFixed: done(3, 2), boatColor: S.boatColor, festival: S.chapter >= 5, festivalDone: done(5, 5),
});
const dailyOpen = () => done(1, 1) && S.daily.count < 3;
const NEW_NPCS = ['hassan', 'lim', 'ani', 'abu'];
const npcVisible = (id) => id === 'kaklong' ? S.chapter >= 4 : id === 'mat' ? S.chapter >= 3 : !NEW_NPCS.includes(id) || S.chapter >= 2;
function markers() {
  const m = [], c = cur();
  if (c) {
    if (c.target === 'invite') INVITE.filter(id => !S.invited.includes(id)).forEach(id => m.push({ id, type: 'mission' }));
    else m.push({ id: c.target, type: 'mission' });
  }
  if (dailyOpen()) {
    for (const y of ['ani', 'abu']) if (!S.daily.yards.includes(y)) m.push({ id: 'house_' + y, type: 'job', text: '💼 RM40' });
    if (done(1, 4) && c?.target !== 'carwash') m.push({ id: 'carwash', type: 'job', text: '💼 RM40' });
    if (done(2, 5) && !S.daily.padiDone) m.push({ id: 'padi', type: 'job', text: '💼 RM50' });
    if (done(3, 5) && !S.daily.fishDone) m.push({ id: 'jeti', type: 'job', text: '💼 RM50' });
    if (done(4, 4) && !S.daily.beachDone) m.push({ id: 'pantai', type: 'job', text: '💼 RM50' });
  }
  if (S.chapter < 2) m.push({ id: 'padi', type: 'lock', text: '🔒2' });
  if (S.chapter < 3) m.push({ id: 'jeti', type: 'lock', text: '🔒3' });
  if (S.chapter < 4) m.push({ id: 'pantai', type: 'lock', text: '🔒4' });
  if (S.chapter >= 4) for (const [k, a] of Object.entries(ACTIVITIES)) if (!(S.daily.act || {})[k] && (k !== 'karaoke' || done(5, 4))) m.push({ id: a.place, type: 'act', text: a.ic });
  if (S.chapter < 5) m.push({ id: 'balai', type: 'lock', text: '🔒5' });
  if (!done(1, 3)) m.push({ id: 'carwash', type: 'lock', text: '🔒' });
  return m;
}

// ------------------------------------------------------------ HUD
function hud() {
  $('coins').textContent = `💵 ${fmtRM(balance())}`;
  $('stars').textContent = `⭐ ${S.stars}`;
  $('rank').textContent = rank();
  $('spiritFill').style.width = `${S.spirit}%`; $('spiritTxt').textContent = `${S.spirit}%`;
  const c = cur(), ch = chap();
  if (!c) { $('mChap').textContent = `BAB ${NEXT.n} · ${NEXT.bm.toUpperCase()}`; $('mBm').textContent = `Bab ${NEXT.n} akan datang!`; $('mEn').textContent = `Chapter ${NEXT.n} is coming soon. Keep doing daily jobs!`; $('mProg').textContent = ''; }
  else {
    $('mChap').textContent = `BAB ${ch.n} · ${ch.bm.toUpperCase()}`; $('showBtn').textContent = '➤ Tunjuk misi';
    $('mBm').textContent = c.bm + (c.of ? ` (${c.count()}/${c.of})` : ''); $('mEn').textContent = c.en; $('mProg').textContent = `${S.mission}/${ch.missions.length}`;
  }
  $('showBtn').hidden = !c;
  $('dailyBtn').textContent = done(1, 1) ? `💼 Kerja ${S.daily.count}/3` : '💼 Kerja 🔒';
}
function bump(id) { const e = $(id); e.classList.remove('bump'); void e.offsetWidth; e.classList.add('bump'); }
function addCoins(n, why = '') { earn(n, why); bump('coins'); hud(); } // all rewards are paid in RM through the wallet
function addStars(n) { const before = rank(); S.stars += n; bump('stars'); if (rank() !== before) setTimeout(() => toast(`Gelaran baru: ${rank()}!`, 'New title unlocked!'), 900); }
function showMission() { const c = cur(); if (c) { toast(`Misi: ${c.bm}`, c.en); town.focus(targetOf(c)); } }

// ------------------------------------------------------------ town
const heroAt = () => { const c = cur(); if (!c) return 'house_abah'; const id = targetOf(c); return { jeti: 'mat', padi: 'hassan', carwash: 'din', yard_abah: 'abah', house_abah: 'abah', pantai: 'kaklong', jambatan: 'kaklong' }[id] || id; };
const townHooks = { flags, markers, onTap, npcVisible, heroAt };
let town = null;
if (S.gfx !== '2d' && has3D()) {
  try { $('town3d').hidden = false; $('town').hidden = true; town = await createTown3D($('town3d'), townHooks); }
  catch (e) { console.warn('3D town failed, using 2D', e); window.__town3dError = String(e && e.stack || e); $('town3d').hidden = true; $('town').hidden = false; setTimeout(() => toast('Peta 3D gagal — guna 2D', String(e && e.message || e).slice(0, 120)), 800); town = null; }
}
if (!town) { $('town').hidden = false; town = createTown($('town'), townHooks); }
$('loading').hidden = true;

function advance(delay = 400) {
  S.mission++; S.spirit = Math.min(100, S.spirit + 5); save(); town.rebuild(); hud();
  setTimeout(showMission, delay);
}

async function resultScreen(title, res, coins, extra = '') {
  const st = [0, 1, 2].map(k => `<span class="${k < res.stars ? 'on' : ''}">★</span>`).join('');
  [0, 1, 2].slice(0, res.stars).forEach(k => setTimeout(() => sfx.star(k), 100));
  await modal({ kicker: 'SIAP! · DONE!', title, html: `<div class="bigstars">${st}</div><p class="reward">+${fmtRM(coins)} &nbsp; +${res.stars} ⭐</p><p class="muted">Masa · Time: ${Math.round(res.time)}s</p>${extra}`, buttons: [['Teruskan · Continue', 'ok', true]] });
}

async function playGame(kind, opts = {}) {
  if (kind === 'karaoke') { ui.busy = true; audioInit(); wantMusic(null); const res = await runKaraoke(opts); ui.busy = false; wantMusic('kampung'); if (!res) { toast('Tak apa, cuba lagi nanti.', 'No worries, try again later.'); return null; } const prev = S.best.karaoke || 0; if (res.stars > prev) S.best.karaoke = res.stars; return res; }
  ui.busy = true; audioInit(); wantMusic(['fish', 'seafish', 'boat', 'beach', 'volley', 'photo'].includes(kind) ? 'laut' : 'kampung');
  let res;
  if (S.gfx !== '2d' && has3D()) {
    try { toast('Memuatkan 3D…', 'Loading 3D…'); res = await runGame3D(kind, opts); }
    catch (e) { console.warn('3D unavailable, using 2D', e && e.stack); $('game').hidden = true; $('game').classList.remove('is3d'); if (kind === 'seafish' || kind === 'jalandrag') { ui.busy = false; wantMusic('kampung'); need3D(); return null; } toast('3D tak dapat dimuatkan — guna 2D', "Couldn't load 3D — using 2D"); res = await runGame(kind, opts); }
  } else if (kind === 'seafish' || kind === 'jalandrag') { ui.busy = false; wantMusic('kampung'); if (kind === 'seafish') need3D(); return null; } else res = await runGame(kind, opts);
  ui.busy = false; wantMusic('kampung');
  if (!res) { toast('Tak apa, cuba lagi nanti.', 'No worries, try again later.'); return null; }
  const prev = S.best[kind] || 0; if (res.stars > prev) S.best[kind] = res.stars;
  return res;
}

async function missionGame(kind) {
  const res = await playGame(kind); if (!res) return;
  const coins = 60 + res.stars * 15;
  addCoins(coins, 'misi ' + kind); addStars(res.stars);
  if (kind === 'repair' && res.color) S.houseColor = res.color;
  if (kind === 'padi') { S.rice = 20; S.daily.padiDone = true; }
  if (kind === 'boat' && res.color) S.boatColor = res.color;
  if (kind === 'fish') S.catch = res.fish || [];
  S.mission++; S.spirit = Math.min(100, S.spirit + 5); save(); town.rebuild(); hud();
  const title = { grass: 'Laman Tok Abah dah kemas!', repair: 'Rumah Tok Abah macam baru!', carwash: 'Kereta berkilat!', padi: 'Padi dah dituai!', boat: 'Bot Pak Mat macam baru!', fish: 'Rezeki laut!', beach: 'Pantai bersih!', mall: 'Barang pesta lengkap!', market: 'Kenduri meriah!', karaoke: 'Bintang karaoke!' }[kind];
  await resultScreen(title, res, coins, kind === 'padi' ? `<p class="reward">🌾 ${res.kg || 20} kg padi → 20 kg beras</p>` : kind === 'fish' ? catchHtml(res.fish) : '');
  if (kind === 'grass') await dialog(NPCS.abah, LINES.abah2);
  if (kind === 'repair') { town.focus('house_abah'); await dialog(NPCS.abah, LINES.abah3); }
  if (kind === 'carwash') { await dialog(NPCS.din, LINES.din); toast('Kerja cuci kereta harian dibuka!', 'Daily car wash jobs unlocked!'); }
  if (kind === 'padi') { town.focus('hassan'); await dialog(NPCS.hassan, LINES.hassan2); }
  if (kind === 'boat') { town.focus('mat'); await dialog(NPCS.mat, LINES.mat2); }
  if (kind === 'fish') { town.focus('mat'); await dialog(NPCS.mat, LINES.mat3); }
  if (kind === 'beach') { town.focus('kaklong'); await dialog(NPCS.kaklong, LINES.kaklong2); }
  if (kind === 'mall') { town.focus('kiah'); await dialog(AJIS, LINES.mall5); }
  if (kind === 'market') { town.focus('balai'); await dialog(NPCS.kiah, LINES.kiah5b); }
  if (kind === 'karaoke') { town.focus('abah'); await dialog(AJIS, LINES.ajis3); }
  showMission();
}

function catchHtml(list = []) {
  const rows = list.map(f => { const rr = RARITY[f.rar] || RARITY.biasa; return `<li><b style="color:${rr.col}">${'★'.repeat(rr.stars)}</b> ${f.bm} <small>${f.kg.toFixed(2)} kg · RM ${(f.rm || 0).toFixed(2)}</small></li>`; }).join('');
  const rm = list.reduce((a, f) => a + (f.rm || 0), 0);
  return `<ul class="catchList">${rows}</ul><p class="muted">Jumlah anggaran · Total est.: <b>RM ${rm.toFixed(2)}</b></p>`;
}
const fishValue = (list = []) => list.reduce((a, f) => a + Math.min(200, Math.round(f.rm || 0)), 0); // 1 coin per RM, max 200 per fish
async function dailyJob(kind, yard) {
  checkDaily();
  if (!dailyOpen()) return toast('Dah cukup kerja hari ni. Datang esok!', "That's enough work for today. Come back tomorrow!");
  const res = await playGame(kind, { seed: Date.now() % 1000, goal: kind === 'fish' ? 4 : undefined }); if (!res) return;
  let coins = (kind === 'padi' || kind === 'fish' || kind === 'beach' ? 50 : 40) + res.stars * 10 + (kind === 'fish' ? Math.min(150, Math.max(10, Math.round(fishValue(res.fish) / 2))) : 0); S.daily.count++; if (yard) S.daily.yards.push(yard); if (kind === 'padi') S.daily.padiDone = true; if (kind === 'fish') S.daily.fishDone = true; if (kind === 'beach') S.daily.beachDone = true;
  let extra = '';
  if (S.daily.count === 3) { coins += 60; extra = '<p class="reward">🎉 Semua kerja hari ni siap! Bonus +RM60</p>'; }
  addCoins(coins, 'kerja ' + kind); addStars(res.stars); save(); town.rebuild(); hud();
  await resultScreen({ padi: 'Sawah dah dituai!', carwash: 'Satu lagi kereta berkilat!', fish: 'Pak Mat beli semua ikan!' }[kind] || 'Laman jiran dah kemas!', res, coins, (kind === 'fish' ? catchHtml(res.fish) : '') + extra);
}

async function finishChapter(n) {
  const ch = CHAPTERS[n - 1], next = CHAPTERS[n] || NEXT;
  S.spirit = Math.min(100, S.spirit + 10); addCoins([150, 200, 250, 300][n - 1] || 300, 'bab ' + n); addStars(3);
  S.chapter = n + 1; S.mission = 0; S.chapterDone = false; S.introSeen = n + 1; save(); town.rebuild(); hud(); sfx.good();
  const soon = !CHAPTERS[n];
  await modal({ kicker: `BAB ${n} SELESAI · CHAPTER ${n} COMPLETE`, title: ch.bm, html: `<div class="bigstars"><span class="on">★</span><span class="on">★</span><span class="on">★</span></div><p class="reward">+${fmtRM([150, 200, 250, 300][n - 1] || 300)} &nbsp; +3 ⭐ &nbsp; Semangat kampung +10%</p>`
    + (n === 2 ? '<p>🌾 Kerja harian baru: <b>Tuai padi</b> di sawah Pak Hassan (+RM50).<br><small>New daily job: harvest padi at Pak Hassan\'s field.</small></p>' : '')
    + (n === 3 ? '<p>🎣 Kerja harian baru: <b>Memancing</b> di jeti Pak Mat (+RM50).<br><small>New daily job: go fishing at Pak Mat\'s jetty.</small></p>' : '')
    + (n === 4 ? '<p>🏖️ Kerja harian baru: <b>Bersih pantai</b> untuk Kak Long (+RM50).<br><small>New daily job: clean Pantai Miami for Kak Long.</small></p>' : '')
    + `<p class="muted"><b>Bab ${next.n} · ${next.bm}</b> ${soon ? '— akan datang! · coming soon!<br>' + NEXT.teaser : '— dibuka sekarang! · unlocked now!'}</p>`,
    buttons: [[soon ? 'Hebat! · Awesome!' : `Mula Bab ${next.n} · Start`, 'ok', true]] });
  if (!soon && next.intro) await modal({ kicker: 'BAB BARU · NEW CHAPTER', title: `Bab ${next.n} · ${next.bm}`, html: `<p>${next.intro[0]}</p><p class="muted">${next.intro[1]}</p>`, buttons: [['Jom! · Let\'s go!', 'ok', true]] });
  if (n === 3) S.seenB4 = true;
  if (!soon) showMission();
}

async function talk(id) {
  const n = NPCS[id], c = cur();
  // ---- Bab 1
  if (id === 'abah' && at(1, 0)) { await dialog(n, LINES.abah0); return advance(); }
  if (id === 'kiah' && at(1, 3)) { await dialog(n, LINES.kiah); return advance(); }
  if (id === 'din' && at(1, 4)) return dialog(n, [['Tolong Pok Wan cuci kereta ni, ya? Ketik kedai untuk mula.', 'Help me wash this car? Tap the shop to start.']]);
  if (id === 'abah' && at(1, 5)) { await dialog(n, LINES.abah5); return finishChapter(1); }
  // ---- Bab 2
  if (id === 'abah' && at(2, 0)) { await dialog(n, LINES.abah_b2); return advance(); }
  if (id === 'hassan' && at(2, 1)) { await dialog(n, LINES.hassan1); return advance(); }
  if (id === 'hassan' && at(2, 2)) return missionGame('padi');
  if (id === 'lim' && at(2, 3)) {
    await dialog(n, LINES.lim.slice(0, 2)); addCoins(60, 'jual beras'); S.rice = 0;
    await modal({ kicker: 'JUAL BERAS · SELL RICE', title: '20 kg beras', html: '<p class="reward">20 kg × RM3 = +RM60</p><p class="muted">Uncle Lim beli semua beras Pak Hassan. · Uncle Lim buys all of Pak Hassan\'s rice.</p>', buttons: [['OK', 'ok', true]] });
    await dialog(n, LINES.lim.slice(2)); S.invited = []; return advance();
  }
  if (INVITE.includes(id) && at(2, 4) && !S.invited.includes(id)) {
    await dialog(n, LINES['inv_' + id]); S.invited.push(id); sfx.pop(); save(); hud();
    if (S.invited.length >= INVITE.length) { toast('Semua dah dijemput! Pergi ke sawah.', "Everyone's invited! Head to the padi field."); return advance(900); }
    return toast(`Dijemput ${S.invited.length}/3`, `Invited ${S.invited.length}/3`);
  }
  if (id === 'hassan' && at(2, 5)) { await dialog(n, LINES.hassan5); return finishChapter(2); }
  // ---- Bab 3
  if (id === 'abah' && at(3, 0)) { await dialog(n, LINES.abah_b3); return advance(); }
  if (id === 'mat' && at(3, 1)) { await dialog(n, LINES.mat1); return advance(); }
  if (id === 'mat' && at(3, 2)) return missionGame('boat');
  if (id === 'mat' && at(3, 3)) return missionGame('fish');
  if (id === 'kiah' && at(3, 4)) {
    await dialog(n, LINES.kiah3); const list = S.catch.length ? S.catch : [{ id: 'kembung', bm: 'Ikan Kembung', kg: 1.5 }];
    const val = Math.max(45, fishValue(list)); addCoins(val, 'jual ikan'); S.catch = [];
    await modal({ kicker: 'JUAL IKAN · SELL FISH', title: `${list.length} ekor ikan segar`, html: catchHtml(list) + `<p class="reward">+${fmtRM(val)}</p><p class="muted">Nek Ma beli semua untuk ikan bakar malam ni. · Nek Ma buys them all for tonight's ikan bakar.</p>`, buttons: [['OK', 'ok', true]] });
    await dialog(n, LINES.kiah3b); return advance();
  }
  if (id === 'mat' && at(3, 5)) { await dialog(n, LINES.mat5); return finishChapter(3); }
  // ---- Bab 4 · Pantai Miami
  // ---- Bab 5
  if (id === 'abah' && at(5, 0)) { await dialog(n, LINES.abah_b5); advance(); town.focus('balai'); return; }
  if (id === 'kiah' && at(5, 3)) { await dialog(n, LINES.kiah5); return missionGame('market'); }
  if (id === 'abah' && at(5, 5)) { await dialog(n, LINES.abah5); fireworks(); return finishChapter(5); }
  if (id === 'abah' && at(4, 0)) { await dialog(n, LINES.abah_b4); advance(); town.focus('kaklong'); return; }
  if (id === 'kaklong' && at(4, 1)) { await dialog(n, LINES.kaklong1); advance(); town.focus('pantai'); return; }
  if (id === 'kaklong' && at(4, 2)) { await dialog(n, [LINES.kaklong1[2]]); return missionGame('beach'); }
  if (id === 'kaklong' && at(4, 3)) { await dialog(n, [LINES.kaklong2[1]]); town.focus('jambatan'); return; }
  if (id === 'kaklong' && at(4, 4)) { await dialog(n, LINES.kaklong3); return finishChapter(4); }
  // ---- otherwise: hint or small talk
  if (c && targetOf(c) === id) return dialog(n, [[c.bm + '.', c.en]]);
  const pool = IDLE[id] || GREETS; await dialog(n, [pool[Math.floor(Math.random() * pool.length)]]);
}

// the drawbridge lifts, Pak Mat's boat sails out under it, then it comes down again
async function watchBridge() {
  if (!at(4, 3)) { if (town.openBridge) { town.focus('jambatan', .8); town.openBridge(); toast('Jambatan Angkat sedang naik!', 'The drawbridge is lifting!'); } else toast('Jambatan Angkat', 'Kuala Terengganu Drawbridge'); return; }
  ui.busy = true; town.focus('jambatan', .8);
  if (town.openBridge) { toast('Jambatan Angkat sedang naik…', 'The drawbridge is lifting…'); await new Promise(res => { const to = setTimeout(res, 16000); town.openBridge(() => { clearTimeout(to); res(); }); setTimeout(() => toast('Itu bot Pak Mat!', "That's Pak Mat's boat!"), 4500); }); }
  ui.busy = false; addStars(1); await dialog(NPCS.kaklong, LINES.bridge); advance(); town.focus('kaklong');
}

// ---- PERLAWANAN 3V3: separate reward slot (once a day: win 30, draw 15, loss 5) and lifetime stats in S.futsal
function futsalStats() { return (S.futsal ||= { played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, best: null }); }
async function futsalMatch() {
  checkDaily(); let paidNow = 0;
  const res = await playGame('futsal3v3', {
    matchTime: window.__f3MatchTime, // test hook only; undefined = the normal 3-minute match
    onMatch(r) {
      const f = futsalStats(); f.played++; f.gf += r.us; f.ga += r.them; if (r.res === 'win') f.wins++; else if (r.res === 'draw') f.draws++; else f.losses++;
      if (!f.best || r.us - r.them > f.best.us - f.best.them || (r.us - r.them === f.best.us - f.best.them && r.us > f.best.us)) f.best = { us: r.us, them: r.them };
      let msg = '';
      if (!(S.daily.act || {}).futsal3v3) { const c = r.res === 'win' ? 80 : r.res === 'draw' ? 40 : 15; (S.daily.act ||= {}).futsal3v3 = true; addCoins(c, 'futsal 3v3'); paidNow += c; S.spirit = Math.min(100, S.spirit + 2); msg = `+${c} 🪙 ganjaran hari ni · today's reward`; }
      else msg = 'Ganjaran hari ni dah diambil · Already rewarded today';
      save(); hud(); return msg;
    },
  });
  if (!res || res.res === 'quit') { save(); return; }
  town.rebuild && town.rebuild(); const f = futsalStats();
  await resultScreen(res.res === 'win' ? 'MENANG! · Victory!' : res.res === 'draw' ? 'SERI · Draw' : 'KALAH · Defeat', res, paidNow, `<p class="reward">⚽ MYKAMPUNG ${res.us} - ${res.them} LAWAN · ${res.matches} perlawanan</p><p class="muted">Rekod · Record: ${f.wins}M ${f.draws}S ${f.losses}K · ${f.gf} gol</p>`);
}

// ---- SIMULATOR PANCING LAUT: free-roam sea fishing from the jetty / boat (3D only). Coins come from selling fish in-game (daily cap).
function need3D() { modal({ kicker: '🎣 SIMULATOR PANCING LAUT', title: 'Perlukan grafik 3D', body: 'Simulator ini hanya ada dalam mod 3D. Tukar di Menu → Grafik: 3D. · This simulator needs 3D graphics — switch in Menu → Graphics.', buttons: [['OK', 'ok', true]] }); }
async function seaFishing(practice = false) {
  checkDaily();
  if (!practice && !done(3, 5)) return modal({ kicker: '🔒 Bab 3 · Turun ke Laut', title: 'Simulator Pancing Laut', body: 'Siapkan Bab 3 dengan Pak Mat dulu. · Finish Chapter 3 with Pak Mat first.', buttons: [['OK', 'ok', true]] });
  if (S.gfx === '2d' || !has3D()) return need3D();
  const res = await playGame('seafish', { practice }); if (!res) return;
  save(); hud(); town.rebuild && town.rebuild();
  if (!res.caught) return toast('Laut tenang hari ni. Cuba lagi!', 'Quiet sea today. Try again!');
  await resultScreen('Rezeki laut!', res, 0, `<p class="reward">🐟 ${res.caught} ekor · ${res.kg.toFixed(1)} kg${res.sold ? ` · +${fmtRM(res.sold)} dijual` : ''}</p>` + catchHtml((res.fish || []).map(f => ({ ...f, n: 0 }))));
}

// ---- JALAN DRAG: drag racing mini-game (3D only). Prize money is paid into the RM wallet during the session.
async function jalanDrag(practice = false) {
  checkDaily();
  if (S.gfx === '2d' || !has3D()) return modal({ kicker: '🏁 JALAN DRAG', title: 'Perlukan grafik 3D', body: 'Jalan Drag hanya ada dalam mod 3D. Tukar di Menu → Grafik: 3D. · Jalan Drag needs 3D graphics.', buttons: [['OK', 'ok', true]] });
  const res = await playGame('jalandrag', { practice }); save(); hud(); town.rebuild && town.rebuild(); town.focus && town.focus('drag', .9); // back where the player was
  if (res && res.races) toast(`Jalan Drag: ${res.wins}/${res.races} menang · +${fmtRM(res.earned || 0)}`, `${res.wins}/${res.races} wins`);
}

// ---- map activities: free play any time from Bab 4, with a small reward once a day each
async function activity(kind) {
  const a = ACTIVITIES[kind]; checkDaily(); const paid = !(S.daily.act || {})[kind];
  if (S.chapter < 4) return modal({ kicker: '🔒 Bab 4 · Pantai Miami', title: a.title, body: 'Dibuka bila kau sampai ke Pantai Miami dalam Bab 4. · Opens when you reach Pantai Miami in Chapter 4.', buttons: [['OK', 'ok', true]] });
  if (kind === 'karaoke' && !done(5, 4)) return modal({ kicker: '🔒 Bab 5', title: '🎤 Karaoke Balai Raya', body: 'Dibuka selepas misi karaoke dalam Bab 5. · Opens after the Bab 5 karaoke mission.', buttons: [['OK', 'ok', true]] });
  if (kind === 'drag') { // the drag strip: the new Jalan Drag (garage + races for RM) or the original quick 402 m race
    const c = await modal({ kicker: 'LITAR DRAG', title: '🏁 Pilih · Choose', html: `<p><b>1. Jalan Drag</b> — garaj, kereta & motosikal, alat ganti, lumba lawan AI untuk RM. <small>Garage, cars & bikes, upgrades, races for RM.</small></p><p><b>2. Drag Klasik 402 m</b> — lumba ringkas asal. <small>The original quick race.</small></p>`, buttons: [['🏎️ Jalan Drag', 'jd', true], ['🚗 Klasik', 'classic'], ['Nanti · Later', 'ok']] });
    if (c === 'jd') return jalanDrag();
    if (c !== 'classic') return;
  }
  if (kind === 'futsal') { // the Gelanggang Futsal offers two independent modes
    const f = futsalStats(), mode = await modal({ kicker: 'GELANGGANG FUTSAL', title: '⚽ Pilih mod · Choose a mode', html: `<p><b>1. Sepakan Penalti</b> — cabaran penalti asal. <small>The original penalty challenge.</small></p><p><b>2. Perlawanan 3v3</b> — perlawanan futsal jalanan 3 minit. <small>A 3-minute street futsal match.</small></p><p class="muted">Rekod 3v3 · Record: ${f.played} main · ${f.wins}M ${f.draws}S ${f.losses}K · ${f.gf} gol${f.best ? ` · Terbaik ${f.best.us}-${f.best.them}` : ''}</p>`, buttons: [['🥅 Sepakan Penalti', 'pen', true], ['🏟️ Perlawanan 3v3', 'match', true], ['Nanti · Later', 'no']] });
    if (mode === 'match') return futsalMatch();
    if (mode !== 'pen') return;
  }
  const go = await modal({ kicker: `AKTIVITI · ${a.en.toUpperCase()}`, title: `${a.ic} ${a.title}`, body: paid ? 'Ganjaran hari ni: RM25 + RM10 setiap bintang. Jom main?' : 'Ganjaran hari ni dah dapat — main untuk seronok! · Already rewarded today — play for fun!', buttons: [['Jom! · Play', 'go', true], ['Nanti · Later', 'no']] });
  if (go !== 'go') return;
  const res = await playGame(kind); if (!res || res.res === 'quit') return;
  let coins = 0; if (paid) { coins = 25 + res.stars * 10; (S.daily.act ||= {})[kind] = true; addCoins(coins, 'aktiviti ' + kind); S.spirit = Math.min(100, S.spirit + 2); } save(); hud(); town.rebuild && town.rebuild();
  const extra = kind === 'drag' ? `<p class="reward">${res.win ? '🏆 Menang' : '🏁 Kalah'} · ${res.et ? res.et.toFixed(2) : '-'}s · ${res.trap || 0} km/j</p>` : kind === 'futsal' ? `<p class="reward">⚽ Sepakan penalti: MYKAMPUNG ${res.us ?? res.goals} - ${res.them ?? 0} LAWAN</p>` : kind === 'volley' && res.us !== undefined ? `<p class="reward">🏐 KAMPUNG ${res.us} – ${res.them} PANTAI · ${res.res === 'win' ? 'Menang!' : 'Kalah'}</p>` : kind === 'photo' && res.photos !== undefined ? `<p class="reward">📸 ${res.photos} foto disimpan ke galeri</p>` : kind === 'market' && res.earned !== undefined ? `<p class="reward">💰 Jualan RM${res.earned}</p>` : '';
  await resultScreen({ futsal: res.res === 'win' ? 'Juara penalti!' : res.res === 'loss' ? 'Kalah penalti' : 'GOL! Hebat!', volley: res.res === 'win' ? 'Juara voli pantai!' : res.res === 'loss' ? 'Kalah tipis — cuba lagi!' : 'Rally hebat!', photo: 'Foto cantik!', drag: res.win ? 'Juara drag!' : 'Lumba tamat!', karaoke: 'Karaoke meriah!', market: 'Pasar malam meriah!' }[kind], res, coins, extra);
}

async function jobPrompt(title, pay) { return (await modal({ kicker: 'KERJA HARI NI · DAILY JOB', title, body: `Upah ${fmtRM(pay)} + bonus RM10 setiap bintang. Nak buat sekarang?`, buttons: [['Jom! · Go!', 'go', true], ['Nanti · Later', 'no']] })) === 'go'; }

async function onTap(hit) {
  if (ui.busy || !hit) return;
  audioInit(); sfx.tap();
  if (hit.type === 'npc') return talk(hit.id);
  if (hit.type === 'villager') return dialog({ name: 'Orang kampung', initial: '☺', color: '#16a085' }, [GREETS[Math.floor(Math.random() * GREETS.length)]]);
  const id = hit.id;
  if (id === 'house_abah' || id === 'yard_abah') {
    if (at(1, 1)) return missionGame('grass');
    if (at(1, 2)) return missionGame('repair');
    if (at(1, 0)) { town.focus('abah'); return toast('Sembang dengan Tok Abah dulu', 'Talk to Tok Abah first'); }
    return toast('Rumah Tok Abah', "Tok Abah's house");
  }
  if (/^(house|yard)_(ani|abu)$/.test(id)) {
    const y = id.split('_')[1];
    if (at(2, 4) && !S.invited.includes(y)) return talk(y);
    if (!done(1, 1)) return toast('Jiran belum perlukan bantuan', "The neighbours don't need help yet");
    if (S.daily.yards.includes(y)) return toast('Laman ni dah kemas hari ni', 'This yard is already done today');
    if (await jobPrompt(y === 'ani' ? 'Tebas laman Cikgu Aqilah' : 'Tebas laman Pak Ajis', 40)) return dailyJob('grass', y);
    return;
  }
  if (id === 'carwash') {
    if (!done(1, 3)) return toast('Kedai tutup. Pok Wan sakit pinggang.', 'Closed. Pok Wan hurt his back.');
    if (at(1, 4)) return missionGame('carwash');
    if (await jobPrompt('Cuci kereta pelanggan', 40)) return dailyJob('carwash');
    return;
  }
  if (id === 'padi') {
    if (S.chapter < 2) return modal({ kicker: '🔒 Bab 2 · Musim Menuai', title: 'Sawah Padi', body: 'Padi masih hijau. Akan dibuka dalam Bab 2. · The padi is still green. Opens in Chapter 2.', buttons: [['OK', 'ok', true]] });
    if (at(2, 0)) return toast('Padi dah menguning! Sembang dengan Tok Abah dulu.', 'The padi is ripe! Talk to Tok Abah first.');
    if (at(2, 1)) { town.focus('hassan'); return toast('Jumpa Pak Hassan dulu', 'Meet Pak Hassan first'); }
    if (at(2, 2)) return missionGame('padi');
    if (done(2, 5)) { if (S.daily.padiDone) return toast('Sawah dah dituai hari ni. Esok padi masak semula!', 'Already harvested today. It ripens again tomorrow!'); if (await jobPrompt('Tuai padi sawah Pak Hassan', 50)) return dailyJob('padi'); return; }
    return toast('Sawah Pak Hassan', "Pak Hassan's padi field");
  }
  if (id === 'jeti') {
    if (S.chapter < 3) return modal({ kicker: '🔒 Bab 3 · Turun ke Laut', title: 'Jeti Nelayan', body: 'Memancing, baiki bot dan jual ikan. Akan dibuka dalam Bab 3.', buttons: [['OK', 'ok', true]] });
    if (at(3, 0)) { town.focus('abah'); return toast('Sembang dengan Tok Abah dulu', 'Talk to Tok Abah first'); }
    if (at(3, 1)) return talk('mat');
    if (at(3, 2)) return missionGame('boat');
    if (at(3, 3)) return missionGame('fish');
    if (done(3, 5)) {
      const c = await modal({ kicker: 'JETI NELAYAN', title: '🎣 Nak buat apa?', html: `<p><b>1. Kerja harian</b> — memancing untuk Pak Mat (RM50). ${S.daily.fishDone ? '✓ <small>Dah siap hari ni</small>' : ''}</p><p><b>2. Simulator Pancing Laut</b> — bawa bot ke laut, pancing 10 spesies laut Malaysia. <small>Sea fishing simulator.</small></p>`, buttons: [['🐟 Kerja harian', 'job'], ['🚤 Pancing Laut', 'sea', true], ['Tutup', 'ok']] });
      if (c === 'sea') return seaFishing();
      if (c !== 'job') return;
      if (S.daily.fishDone) return toast('Dah memancing hari ni. Ikan datang lagi esok!', 'Already fished today. The fish return tomorrow!'); if (await jobPrompt('Memancing di jeti Pak Mat', 50)) return dailyJob('fish'); return; }
    return toast('Jeti Nelayan', 'Fishing jetty');
  }
  if (id === 'pantai' || id === 'lekor' || id === 'jambatan') {
    if (S.chapter < 4) return modal({ kicker: '🔒 Bab 4 · Pantai Miami', title: id === 'jambatan' ? 'Jambatan Angkat' : 'Pantai Miami', body: 'Pantai, keropok lekor dan Jambatan Angkat. Akan dibuka dalam Bab 4. · The beach, keropok lekor and the drawbridge. Opens in Chapter 4.', buttons: [['OK', 'ok', true]] });
    if (id === 'lekor') return talk('kaklong');
    if (id === 'jambatan') return watchBridge();
    if (at(4, 0)) { town.focus('abah'); return toast('Sembang dengan Tok Abah dulu', 'Talk to Tok Abah first'); }
    if (at(4, 1)) return talk('kaklong');
    if (at(4, 2)) return missionGame('beach');
    if (done(4, 4)) { if (S.daily.beachDone) return toast('Pantai dah bersih hari ni. Esok datang lagi!', 'The beach is clean today. Come back tomorrow!'); if (await jobPrompt('Bersih Pantai Miami untuk Kak Long', 50)) return dailyJob('beach'); return; }
    return toast('Pantai Miami', 'Miami Beach, Kuala Nerus');
  }
  const INFO = {
    taman: ['🌳 Taman Rekreasi', 'Taman permainan, kolam itik, gazebo dan air pancut. Tempat keluarga bersantai petang-petang. · A playground, duck pond, gazebo and fountain — where families relax in the evening.'],
    sekolah: ['🏫 SK Seri Damai', 'Sekolah rendah baru di Bandar Baru. Bas sekolah kuning menunggu di tepi padang. · The new primary school in Bandar Baru, with its yellow school bus by the field.'],
    skate: ['🛹 Taman Luncur', 'Ramp dan tangga untuk budak-budak papan luncur. · Ramps and steps for the skateboard kids.'],
    taman_ria: ['🎡 Taman Ria', 'Roda Ferris, gerai hot dog dan ais krim. Paling meriah waktu malam! · Ferris wheel, hot dog and ice cream stands — liveliest at night!'],
    kedai_bandar: ['🏬 Deretan Kedai Bandar Baru', 'Kedai, ATM dan perhentian bas di jalan utama Bandar Baru. · Shops, an ATM and the bus stop on Bandar Baru\'s main road.'],
  };
  if (INFO[id]) { if (town.focus) town.focus(id, 1); return modal({ kicker: 'BANDAR BARU', title: INFO[id][0], body: INFO[id][1], buttons: [['OK', 'ok', true]] }); }
  if (id === 'balai') {
    if (S.chapter < 5) return modal({ kicker: '🔒 Bab 5 · Pesta Kampung', title: 'Balai Raya', body: 'Karaoke, kenduri dan pesta kampung. Dibuka dalam Bab 5. · Opens in Chapter 5.', buttons: [['OK', 'ok', true]] });
    if (at(5, 0)) { town.focus('abah'); return toast('Sembang dengan Tok Abah dulu', 'Talk to Tok Abah first'); }
    if (at(5, 1)) { await dialog(AJIS, LINES.ajis1); advance(); town.focus('mall'); return; }
    if (at(5, 2) || at(5, 3)) return dialog(AJIS, [[cur().bm + ' dulu, ya.', cur().en + ' first.']]);
    if (at(5, 4)) { await dialog(AJIS, LINES.ajis2); return missionGame('karaoke'); }
  }
  if (id === 'mall' && at(5, 2)) { await dialog(AJIS, [['Ini senarai barang pesta. Beli semua, ya!', "Here's the festival shopping list. Get everything!"]]); return missionGame('mall'); }
  const ACT = Object.entries(ACTIVITIES).find(([, a]) => a.place === id);
  if (ACT) return activity(ACT[0]);
  if (id === 'warung') return talk('kiah');
  if (id === 'kedai') return S.chapter >= 2 ? talk('lim') : toast('Kedai Runcit', 'Beli barang dan perhiasan rumah — akan datang.');
  const LOCK = {};
  if (LOCK[id]) { const [t, k, b] = LOCK[id]; return modal({ kicker: '🔒 ' + k, title: t, body: b + ' Akan dibuka dalam bab akan datang.', buttons: [['OK', 'ok', true]] }); }
  if (id === 'surau') return toast('Surau', 'Tempat orang kampung berkumpul selepas solat.');
}

// ------------------------------------------------------------ HUD buttons & menus
$('showBtn').onclick = () => { sfx.tap(); const c = cur(); if (c) town.focus(targetOf(c)); };
$('missionCard').onclick = (e) => {
  if (e.target.closest('button')) return; sfx.tap();
  if (!$('missionCard').classList.contains('open')) { $('missionCard').classList.add('open'); clearTimeout(window.__mcT); window.__mcT = setTimeout(() => $('missionCard').classList.remove('open'), 5000); return; } // first tap expands, second opens the mission book
  $('missionCard').classList.remove('open');
  const ch = chap() || CHAPTERS[CHAPTERS.length - 1], finished = !chap();
  const rows = ch.missions.map((m, k) => { const d = finished || k < S.mission; return `<li class="${d ? 'done' : k === S.mission ? 'cur' : ''}"><b>${d ? '✓' : k + 1}</b><span>${m.bm}<small>${m.en}</small></span></li>`; }).join('');
  const past = CHAPTERS.filter(c => c.n < (finished ? CHAPTERS.length + 1 : S.chapter) && c !== ch).map(c => `Bab ${c.n} · ${c.bm} ✓`).join(' · ');
  modal({ kicker: 'BUKU MISI · MISSION BOOK', title: `Bab ${ch.n} · ${ch.bm}`, html: `<ol class="mlist">${rows}</ol>${past ? `<p class="muted small">${past}</p>` : ''}${finished ? `<p class="muted small">Bab ${NEXT.n} · ${NEXT.bm} — akan datang</p>` : ''}`, buttons: [['Tutup · Close', 'ok', true]] });
};
$('dailyBtn').onclick = () => {
  sfx.tap(); checkDaily(); hud();
  if (!done(1, 1)) return toast('Siapkan misi "Tebas laman Tok Abah" dulu', "Finish cutting Tok Abah's yard first");
  if (S.daily.count >= 3) return toast('Semua kerja hari ni siap! Datang esok.', 'All done for today! Come back tomorrow.');
  const next = ['ani', 'abu'].find(y => !S.daily.yards.includes(y));
  town.focus(next ? 'house_' + next : done(2, 5) && !S.daily.padiDone ? 'padi' : done(3, 5) && !S.daily.fishDone ? 'jeti' : 'carwash');
  toast('Cari tanda KERJA di peta', 'Look for the KERJA (job) tags on the map');
};
$('zIn').onclick = () => town.zoomBy(1.25); $('zOut').onclick = () => town.zoomBy(.8);
$('muteBtn').onclick = () => { audioInit(); setMuted(!S.muted); $('muteBtn').textContent = S.muted ? '🔇' : '🔊'; };
$('muteBtn').textContent = S.muted ? '🔇' : '🔊';
$('fsBtn').onclick = () => { try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); } catch {} };
$('menuBtn').onclick = async () => {
  sfx.tap();
  const v = await modal({ kicker: 'MENU', title: 'MyKampung', html: `<p class="muted">Gelaran · Title: <b>${rank()}</b> · ⭐ ${S.stars} · 💵 ${fmtRM(balance())}</p>`, buttons: [['Cara main · How to play', 'help'], ['🎉 Aktiviti · Activities', 'acts'], ['Latihan mini game · Practice', 'practice'], [S.timeMode === 'day' ? 'Masa: sentiasa siang' : 'Masa: ikut jam sebenar', 'time'], ['🐟 Buku Ikan · Fish book', 'fishbook'], [S.music === false ? '🎵 Muzik: tutup → buka' : '🎵 Muzik: buka → tutup', 'music'], [S.gfx === '2d' ? 'Grafik: 2D (ringan) → tukar 3D' : 'Grafik: 3D → tukar 2D (ringan)', 'gfx'], ['💾 Simpanan · Save backup', 'savedata'], ['Kredit · Credits', 'credits'], ['Mula semula · Restart', 'reset'], ['Tutup · Close', 'ok', true]] });
  if (v === 'help') return howTo();
  if (v === 'music') { setMusic(S.music === false); toast(S.music === false ? 'Muzik ditutup' : 'Muzik dibuka', S.music === false ? 'Music off' : 'Music on'); return; }
  if (v === 'acts') {
    const k = await modal({ kicker: 'AKTIVITI · ACTIVITIES', title: 'Nak buat apa hari ni?', body: S.chapter < 4 ? 'Aktiviti dibuka dalam Bab 4 (Pantai Miami). · Activities open in Chapter 4.' : 'Setiap aktiviti beri ganjaran sekali sehari. · Each activity pays once a day.', buttons: [...Object.entries(ACTIVITIES).map(([id, a]) => [`${a.ic} ${a.bm}${(S.daily.act || {})[id] ? ' ✓' : ''}`, id]), ['🎣 Pancing Laut', 'seafish'], ['🏎️ Jalan Drag', 'jalandrag'], ['Tutup · Close', 'ok', true]] });
    if (k === 'seafish') { if (town.focus) town.focus('jeti', .9); return seaFishing(); }
    if (k === 'jalandrag') { if (S.chapter < 4) return activity('drag'); if (town.focus) town.focus('drag', .9); return jalanDrag(); }
    if (ACTIVITIES[k]) { if (town.focus) town.focus(ACTIVITIES[k].place, .9); return activity(k); }
    return;
  }
  if (v === 'fishbook') {
    const log = S.fishLog || {}, got = FISH.filter(f => log[f.id]).length;
    const order = ['biasa', 'luar', 'jarang', 'epik', 'legenda'];
    const rows = FISH.slice().sort((a, b) => order.indexOf(a.rar) - order.indexOf(b.rar)).map(f => { const e = log[f.id], rr = RARITY[f.rar];
      return `<li class="${e ? '' : 'locked'}"><b style="color:${rr.col}">${'★'.repeat(rr.stars)}</b> ${e ? f.bm : '???'} <small>${e ? `${f.en} · ${e.n}× · max ${e.max.toFixed(2)} kg` : rr.bm}</small></li>`; }).join('');
    return modal({ kicker: 'BUKU IKAN · FISH BOOK', title: `${got}/${FISH.length} spesies`, html: `<ul class="catchList book">${rows}</ul><p class="muted small">Pergi memancing di jeti Pak Mat untuk lengkapkan buku. · Go fishing at Pak Mat's jetty to fill the book.</p>`, buttons: [['Tutup · Close', 'ok', true]] });
  }
  if (v === 'credits') return modal({ kicker: 'KREDIT · CREDITS', title: 'MyKampung', html: `<ul class="credits">
    <li><b>3D models:</b> Kenney — City Kit (Suburban), City Kit (Roads), Car Kit, Building Kit (CC0) · kenney.nl</li>
    <li><b>Nature models:</b> Ultimate Nature Pack by Quaternius (CC0) · quaternius.com</li>
    <li><b>Props, nature &amp; tools:</b> KayKit City Builder Bits, Forest Nature Pack, RPG Tools Bits by Kay Lousberg (CC0) · kaylousberg.com</li>
    <li><b>Furniture &amp; warung items:</b> KayKit Furniture Bits, Restaurant Bits by Kay Lousberg (CC0)</li>
    <li><b>Rowboats:</b> Low Poly Sea Assets by Atomic Realm (atomicrealm.itch.io)</li>
    <li><b>Scooter, bicycle &amp; small car:</b> HHG Game Development 3D Models Kit by Hyper Hollow Games (hyperhollowgames.net/3d-models-kit)</li>
    <li><b>Main character, backpack brush cutter, fishing boat, bus, airliner &amp; 30 Malaysian sea fish:</b> TYRANZ</li>
    <li><b>Bandar Baru &amp; activities:</b> Kenney Mini Characters &amp; Mini Shop (CC0); Low Poly Playground &amp; Park, School, Sports and Market Packs by reodesuxz; City Pack, Race Kit, Pretty Park Set, Ultimate Food Pack, Mini Skate Kit and Animals (Poly Pizza / Quaternius-style low-poly packs supplied by the game's owner)</li>
    <li><b>Engine:</b> three.js (MIT)</li></ul>`, buttons: [['OK', 'ok', true]] });
  if (v === 'practice') {
    const g = await modal({ kicker: 'LATIHAN · PRACTICE', title: 'Pilih mini game', body: 'Main sesuka hati — tiada upah, kemajuan tidak berubah. Play freely: no rewards, your progress is unchanged.', buttons: [['🌿 Tebas Laman', 'grass'], ['🏠 Baiki Rumah', 'repair'], ['🚗 Cuci Kereta', 'carwash'], ['🌾 Tuai Padi', 'padi'], ['🛶 Baiki Bot', 'boat'], ['🎣 Memancing', 'fish'], ['🏖️ Bersih Pantai', 'beach'], ['🚤 Pancing Laut', 'seafish'], ['🏎️ Jalan Drag', 'jalandrag'], ...Object.entries(ACTIVITIES).map(([k, a]) => [`${a.ic} ${a.bm}`, k]), ['🏟️ Futsal 3v3', 'futsal3v3'], ['Tutup · Close', 'ok', true]] });
    if (g === 'ok') return;
    if (g === 'seafish') return seaFishing(true);
    if (g === 'jalandrag') return jalanDrag(true);
    const best = { ...S.best }; const res = await playGame(g, { seed: Date.now() % 1000, practice: true }); S.best = best;
    if (res) await modal({ kicker: 'LATIHAN · PRACTICE', title: 'Bagus!', html: `<div class="bigstars">${[0, 1, 2].map(k => `<span class="${k < res.stars ? 'on' : ''}">★</span>`).join('')}</div><p class="muted">Masa · Time: ${Math.round(res.time)}s</p>`, buttons: [['OK', 'ok', true]] });
    return;
  }
  if (v === 'time') { S.timeMode = S.timeMode === 'day' ? 'real' : 'day'; save(); toast(S.timeMode === 'day' ? 'Sentiasa siang' : 'Ikut jam sebenar', S.timeMode === 'day' ? 'Always daytime' : 'Follows your real clock'); return; }
  if (v === 'gfx') { S.gfx = S.gfx === '2d' ? '3d' : '2d'; save(); location.reload(); return; }
  if (v === 'savedata') return saveMenu();
  if (v === 'reset') { const c = await modal({ title: 'Mula semula?', body: 'Semua kemajuan akan hilang. All progress will be lost.', buttons: [['Ya, padam · Yes, erase', 'yes'], ['Batal · Cancel', 'no', true]] }); if (c === 'yes') { wipe(); location.reload(); } }
};
// ------------------------------------------------------------ save backup: export to a file, import from a file
async function saveMenu() {
  let picked = null;
  const p = modal({ kicker: '💾 SIMPANAN · SAVE BACKUP', title: 'Simpan kemajuan anda', html: `<p>Muat turun fail simpanan untuk elak kemajuan hilang (tukar telefon, padam data pelayar). <small class="muted">Download a save file so your progress is never lost (new phone, cleared browser data).</small></p>
    <p class="muted small">Bab ${S.chapter} · ⭐ ${S.stars} · ${fmtRM(balance())}. Foto galeri tidak termasuk. · Gallery photos are not included.</p>
    <div class="btns"><label class="fileBtn">📂 Import fail · Import file<input id="saveFile" type="file" accept=".json,application/json,text/plain" hidden></label></div>`,
    buttons: [['⬇️ Eksport · Export', 'export', true], ['Tutup · Close', 'ok']] });
  const inp = $('saveFile');
  inp.onchange = () => { picked = inp.files && inp.files[0]; if (picked) $('mBtns').lastChild.click(); };
  const v = await p;
  if (v === 'export') {
    try {
      const blob = new Blob([exportSave()], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = `mykampung-save-${new Date().toISOString().slice(0, 10)}.json`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast('💾 Fail simpanan dimuat turun', 'Save file downloaded — keep it somewhere safe');
    } catch { toast('Eksport gagal', 'Export failed'); }
    return;
  }
  if (!picked) return;
  let text = ''; try { text = await picked.text(); } catch {}
  const r = parseSave(text);
  if (!r.ok) return modal({ kicker: '💾 IMPORT', title: 'Fail tidak sah', body: 'Ini bukan fail simpanan MyKampung. Kemajuan anda tidak berubah. · This is not a MyKampung save file. Your progress is unchanged.', buttons: [['OK', 'ok', true]] });
  const d = r.data;
  const c = await modal({ kicker: '💾 IMPORT', title: 'Ganti kemajuan?', html: `<p>Fail ini: <b>Bab ${d.chapter}</b> · ⭐ ${d.stars || 0} · ${fmtRM(d.coins)}</p><p>Sekarang: <b>Bab ${S.chapter}</b> · ⭐ ${S.stars} · ${fmtRM(balance())}</p><p class="muted">Kemajuan sekarang akan diganti. · Your current progress will be replaced by this file.</p>`, buttons: [['Ya, import · Yes, import', 'yes'], ['Batal · Cancel', 'no', true]] });
  if (c !== 'yes') return;
  if (importSave(d)) location.reload(); else toast('Import gagal', 'Import failed — storage is full or blocked');
}
function howTo() {
  return modal({ kicker: 'CARA MAIN · HOW TO PLAY', title: 'Selamat datang!', html: `<ul class="help">
    <li><b>Peta</b> — seret untuk alih, cubit / roda tetikus / butang + − untuk zum. <small>Drag to pan, pinch or scroll to zoom.</small></li>
    <li><b>Kad misi</b> (atas kiri) — tunjuk apa nak buat. Ketik untuk Buku Misi. <small>The mission card shows what to do next.</small></li>
    <li><b>➤ Tunjuk tempat</b> — bawa peta ke tempat misi. <small>Jumps the map to your mission.</small></li>
    <li><b>Tanda</b>: <span class="tag y">!</span> misi, <span class="tag g">KERJA</span> kerja harian, <span class="tag k">🔒</span> belum dibuka. <small>Markers: mission, daily job, locked.</small></li>
    <li><b>Kerja hari ni</b> — 3 kerja sehari, RM40–50 setiap satu + RM10 setiap bintang, siap semua +RM60. <small>3 daily jobs paid in Ringgit, +RM60 bonus for all three.</small></li>
    <li><b>Bintang</b> naikkan gelaran kau. Mini game boleh ulang — tak ada kalah. <small>Stars raise your title. No losing, replay anytime.</small></li>
    <li><b>Jam</b> ikut masa sebenar — kampung ada pagi, petang dan malam. <small>The clock follows real time.</small></li></ul>`, buttons: [['Faham! · Got it!', 'ok', true]] });
}

// clock
function clock() {
  const d = new Date(), h = d.getHours(), m = String(d.getMinutes()).padStart(2, '0');
  const part = h < 12 ? 'pagi' : h < 14 ? 'tgh' : h < 19 ? 'ptg' : 'mlm';
  const icon = S.timeMode === 'day' ? '☀️' : (h >= 19 || h < 6) ? '🌙' : h >= 17 ? '🌇' : '☀️';
  $('clock').textContent = `${icon} ${((h + 11) % 12) + 1}:${m} ${part}`;
}
setInterval(() => { clock(); const before = S.daily.date; checkDaily(); if (before !== S.daily.date) { town.rebuild(); hud(); } }, 5000); clock();

// ------------------------------------------------------------ title & loop
async function start() {
  audioInit(); $('title').hidden = true; sfx.good(); wantMusic('kampung'); keepSaveSafe();
  if (saveStatus() === 'restored') setTimeout(() => toast('💾 Simpanan dipulihkan', 'Your save was damaged and has been restored from the backup'), 3000); // after the mission toast
  if (!S.started) {
    S.started = true; save();
    await modal({ kicker: TOWN.toUpperCase(), title: 'Pulang ke Kampung', html: '<p>Bertahun-tahun kau merantau di bandar. Hari ni kau pulang — tapi kampung dah lain. Kedai tutup, laman semak, orang muda tak ada.</p><p class="muted">You spent years working in the city. Today you are back — but the village has changed. Shops closed, yards overgrown, the young people gone.</p><p><b>Hidupkan semula ' + TOWN + '!</b></p>', buttons: [['Jom mula · Let\'s go', 'ok', true]] });
    await howTo();
  }
  if (S.newChapter && chap()) {
    S.newChapter = false; S.introSeen = S.chapter; save();
    const [bm, en] = chap().intro || ['', ''];
    await modal({ kicker: 'BAB BARU · NEW CHAPTER', title: `Bab ${S.chapter} · ${chap().bm}`, html: `<p>${bm}</p><p class="muted">${en}</p>`, buttons: [['Jom! · Let\'s go!', 'ok', true]] });
  }
  showMission();
}
$('playBtn').textContent = S.started ? 'Sambung · Continue' : 'Main · Play';
$('playBtn').onclick = start;
hud();

let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (!$('game').hidden) return; // the mini-game has the screen
  town.frame(dt);
}
requestAnimationFrame(loop);
window.__town = { S, get town() { return town; }, onTap, CHAPTERS, playGame, cur };
