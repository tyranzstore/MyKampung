import { $, S, save, wipe, saveStatus, keepSaveSafe, startAutosave, newerOnDisk, onStale, isStale, audioPause, exportSave, parseSave, importSave, checkDaily, audioInit, setMuted, sfx, toast, dialog, modal, ui, wantMusic, setMusic } from './core.js';
import { createTown, NPCS } from './town.js';
import { createTown3D } from './town3d.js';
import { runGame, FISH, RARITY } from './minigames.js';
import { runGame3D, has3D } from './minigames3d.js';
import { ACTIVITIES } from './activities.js';
import { earn, fmtRM, balance } from './wallet.js';
import { ACHIEVEMENTS, newAchievements, claimDaily, myDay } from './progress.js';
import { connect as netConnect, serverUrl } from './net.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
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
    { bm: 'Jumpa Pok Ajis di Balai Raya', en: 'Meet Pok Ajis at the community hall', target: 'balai' },
    { bm: 'Beli barang pesta di Damai City Mall', en: 'Buy festival supplies at Damai City Mall', target: 'mall' },
    { bm: 'Bantu Nek Ma masak untuk kenduri', en: 'Help Nek Ma cook for the feast', target: 'kiah' },
    { bm: 'Karaoke di Balai Raya', en: 'Sing karaoke at the community hall', target: 'balai' },
    { bm: 'Malam pesta bersama Tok Abah', en: 'Festival night with Tok Abah', target: 'abah' },
  ], intro: ['Kampung dah hidup semula! Orang kampung nak buat Pesta Kampung di Balai Raya — dengan kenduri, karaoke dan bunga api.', 'The village is alive again! The villagers want to hold a Village Festival at the community hall — with a feast, karaoke and fireworks.'] },
];
const NEXT = { n: 6, bm: 'Balik Raya', en: 'Home for Raya', teaser: 'Lemang, pelita dan rumah terbuka. · Lemang, oil lamps and open house.' };
const INVITE = ['amin', 'ani', 'abu'];
const AJIS = NPCS.abu; // Pok Ajis leads the festival committee
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
  // ---- Bab 1 · Tok Abah (warm, a little nostalgic, calls the player "cucu"), Nek Ma (feeds everyone), Pok Wan (car wash, bad back)
  abah0: [['Eh, cucu Tok dah balik! Lama Tok tunggu, tau.', "Hey, you're home! I've been waiting a long time, you know."],
    ['Sejak orang muda pindah ke bandar, kampung ni sunyi sangat.', 'Since the young people moved to the city, the village has gone so quiet.'],
    ['Rumput laman Tok pun dah sampai lutut. Tolong tebaskan, boleh?', 'My yard grass is up to my knees now. Can you cut it for me?']],
  abah2: [['Haa, kemas dah laman! Tapi cuba tengok rumah Tok ni…', 'There, the yard looks tidy! But take a look at my house…'],
    ['Cat dah mengelupas, zink pun bocor. Hujan sikit, basah satu rumah.', 'The paint is peeling and the zinc roof leaks. A bit of rain and the whole house gets wet.'],
    ['Ketik rumah Tok untuk mula baiki.', 'Tap my house to start the repairs.']],
  abah3: [['MasyaAllah, cantiknya rumah Tok! Macam baru siap.', 'MasyaAllah, my house looks brand new!'],
    ['Pergi jumpa Nek Ma di warung. Dia ada cerita nak kongsi.', "Go and see Nek Ma at her warung. She's got news for you."]],
  kiah: [['Ya Allah, besarnya kamu! Duduk dulu, Nek buatkan teh.', "Goodness, look how you've grown! Sit down, I'll make you some tea."],
    ['Kesian Pok Wan, sakit pinggang. Kereta orang dah beratur depan kedai dia.', 'Poor Pok Wan has hurt his back, and cars are lining up outside his shop.'],
    ['Tolong dia sekejap? Kedai dia di simpang jalan, sebelah kanan.', 'Could you give him a hand? His shop is at the junction, on the right.']],
  din: [['Fuh, berkilat! Macam baru keluar showroom.', 'Wow, spotless! Like it just rolled out of the showroom.'],
    ['Esok datang lagi, ya. Kereta tak pernah habis. Pok Wan bayar upah, jangan risau.', "Come again tomorrow. There's always another car, and I'll pay you, don't worry."]],
  abah5: [['Satu kampung sebut nama kamu hari ni.', 'The whole village has been talking about you today.'],
    ['Kalau ada orang muda macam kamu, kampung ni boleh hidup balik.', 'With young people like you around, this village can come back to life.'],
    ['Esok musim menuai. Sawah padi tu tunggu kamu!', 'Harvest season starts tomorrow. The padi field is waiting for you!']],
  // ---- Bab 2 · Pak Hassan (old-school padi farmer), Uncle Lim (shopkeeper since 1985, mixes in English)
  abah_b2: [['Assalamualaikum, cucu. Tengok sawah tu, dah kuning macam emas!', 'Assalamualaikum, grandchild. Look at the field, it has turned gold!'],
    ['Pak Hassan tanam semua tu seorang diri. Anak-anak dia kerja di bandar.', 'Pak Hassan planted all of it by himself. His children work in the city.'],
    ['Dia dah tak larat nak tuai seorang. Pergilah tolong dia di sawah.', "He can't manage the harvest alone anymore. Go and help him at the field."]],
  hassan1: [['Ha, ni cucu Tok Abah yang orang kampung puji tu!', "Ah, so you're the grandchild of Tok Abah everyone keeps praising!"],
    ['Lama dah tak ada orang muda turun sawah. Pak Hassan tuai cara lama, guna sabit.', "Young people haven't come down to the field in ages. I still harvest the old way, with a sickle."],
    ['Potong rumpun padi, kumpul atas tikar, lepas tu banting dalam tong. Ketik sawah untuk mula!', 'Cut the clumps, gather them on the mat, then thresh them in the tub. Tap the field to start!']],
  hassan2: [['Alhamdulillah, penuh tong! Ini rezeki tahun ni.', "Alhamdulillah, the tub is full! That's this year's blessing."],
    ['Lepas dikisar, jadilah beras. Bawa ke kedai Uncle Lim, dia bagi harga elok.', "Once it's milled, that's our rice. Take it to Uncle Lim's shop. He'll give you a fair price."]],
  lim: [['Wah, beras baru dari sawah Pak Hassan? Wangi betul ah!', "Wah, new rice from Pak Hassan's field? It smells so good!"],
    ['Uncle ambil semua. Beras kampung, orang KL pun cari tau.', "I'll take all of it. Even people in KL go looking for kampung rice."],
    ['Eh, Nek Ma cakap Pak Hassan nak buat kenduri kesyukuran. Pergi jemput orang kampung!', 'Oh, Nek Ma says Pak Hassan is having a thanksgiving feast. Go and invite the villagers!']],
  inv_amin: [['Kenduri? Ada ayam masak merah tak? Amin confirm datang!', "A feast? Is there ayam masak merah? I'm definitely coming!"]],
  inv_ani: [['Terima kasih jemput Cikgu. Nanti Cikgu bawa kuih seri muka, ya.', "Thank you for inviting me. I'll bring some kuih seri muka."]],
  inv_abu: [['InsyaAllah, lepas Asar Pok Ajis sampai. Gitar pun Pok bawa!', "InsyaAllah, I'll be there after Asar. I'm bringing my guitar too!"]],
  hassan5: [['Ramainya orang datang! Lama dah sawah ni tak meriah macam ni.', "So many people came! This field hasn't been this lively in years."],
    ['Terima kasih, nak. Kamu buat orang kampung sayang sawah semula.', 'Thank you, nak. You made the village love the padi field again.'],
    ['Mulai esok, datanglah tuai bila-bila. Pak Hassan bayar upah!', "From tomorrow, come and harvest any time. I'll pay you!"]],
  // ---- Bab 3 · Pak Mat (quiet fisherman, talks about the sea)
  abah_b3: [['Cucu, Tok ada kawan lama, Pak Mat. Dia nelayan di jeti.', 'Grandchild, I have an old friend, Pak Mat. He fishes from the jetty.'],
    ['Dulu sepuluh bot keluar ke laut setiap subuh. Sekarang tinggal bot dia sorang.', 'Ten boats used to head out every dawn. Now his is the only one left.'],
    ['Bot dia pun dah bocor. Pergilah jumpa dia di jeti.', 'And now his boat is leaking. Go and see him at the jetty.']],
  mat1: [['Hah, cucu Abah! Mari, mari. Tengok bot Pak Mat ni…', "Ah, Abah's grandchild! Come over here. Have a look at my boat…"],
    ['Penuh teritip, papan pun dah berlubang. Dah sebulan Pak Mat tak turun laut.', "It's covered in barnacles and the planks have holes. I haven't been to sea for a month."],
    ['Kikis teritip, tampal lubang, cat semula. Ketik jeti untuk mula!', 'Scrape off the barnacles, patch the holes, then repaint. Tap the jetty to start!']],
  mat2: [['MasyaAllah, cantiknya! Macam bot baru keluar limbungan.', 'MasyaAllah, beautiful! It looks fresh out of the boatyard.'],
    ['Air dah pasang. Jom naik bot, kita ke tengah laut!', "The tide's in. Hop on, we're heading out to sea!"],
    ['Tepi pantai ikan biasa, terumbu ikan jarang. Laut dalam ada tuna sirip kuning, kalau berani!', "The shallows have everyday fish and the reef has rare ones. Out in the deep there's yellowfin tuna, if you dare!"],
    ['Ketik jeti bila dah sedia.', "Tap the jetty when you're ready."]],
  mat3: [['Rezeki laut! Banyak juga kau dapat.', 'The sea was generous! You caught quite a lot.'],
    ['Bawa ikan ni ke warung Nek Ma. Dia sokmo cari ikan segar untuk ikan bakar.', 'Take these to Nek Ma. She is always after fresh fish for her ikan bakar.']],
  kiah3: [['Ikan segar dari laut kita sendiri! Lama dah Nek tak dapat ikan macam ni.', "Fresh fish from our own sea! I haven't had fish like this in a long time."],
    ['Malam ni Nek buat ikan bakar. Mesti ramai orang datang!', "Tonight I'm making ikan bakar. Everyone's going to show up!"]],
  kiah3b: [['Eh, Pak Mat ada benda nak cakap dengan kamu. Pergilah ke jeti.', 'Oh, Pak Mat has something to tell you. Go to the jetty.']],
  // ---- Bab 5 · Pok Ajis (festival committee leader, guitarist, writes songs)
  abah_b5: [['Cucu, kampung kita dah lain. Sawah kuning, jeti riuh, pantai bersih. Semua sebab kamu.', 'Grandchild, our village has changed. The padi is golden, the jetty is busy and the beach is clean. All because of you.'],
    ['Sabtu ni orang kampung nak buat Pesta Kampung di Balai Raya. Pok Ajis ketua jawatankuasa.', 'This Saturday the villagers are holding a Village Festival at the Balai Raya. Pok Ajis is in charge of the committee.'],
    ['Pergilah ke Balai Raya, tolong dia. Ketik Balai Raya di peta.', 'Go to the Balai Raya and help him. Tap the Balai Raya on the map.']],
  ajis1: [['Hah, sampai pun! Pok dah lama tunggu. Balai dah dihias sikit, tapi barang pesta tak cukup lagi.', "Ah, there you are! I've been waiting. The hall is half decorated, but we're still short on supplies."],
    ['Pergi Damai City Mall, beli semua dalam senarai. Lepas tu tolong Nek Ma masak untuk kenduri.', 'Head to Damai City Mall and buy everything on the list. Then help Nek Ma cook for the feast.'],
    ['Malam nanti karaoke. Pok Ajis main gitar, kamu nyanyi!', "Tonight is karaoke night. I'll play the guitar and you'll sing!"]],
  mall5: [['Cukup semua! Pelita, kain rentang, pinggan, air. Settle!', 'Got everything! Lamps, banners, plates, drinks. All sorted!'],
    ['Sekarang pergi warung Nek Ma. Dia perlukan orang tolong di dapur.', "Now go to Nek Ma's warung. She needs a hand in the kitchen."]],
  kiah5: [['Kenduri besar malam ni! Nasi minyak, ayam masak merah, satay, apam balik…', 'Big feast tonight! Nasi minyak, ayam masak merah, satay, apam balik…'],
    ['Tolong Nek layan orang di gerai makanan. Cepat, tapi jangan salah order, ya!', "Help me serve people at the food stalls. Be quick, but don't mix up the orders!"]],
  kiah5b: [['Sedap! Semua orang dah kenyang. Pergi Balai Raya cepat, karaoke dah nak mula!', "Delicious! Everyone's full. Hurry to the Balai Raya, karaoke is about to start!"]],
  ajis2: [['Pentas siap, lampu pun dah menyala. Lagu kita malam ni "Kampung Kita". Pok Ajis tulis sendiri, tau!', 'The stage is ready and the lights are on. Tonight\'s song is "Kampung Kita". I wrote it myself, you know!'],
    ['Ketik lajur bila not sampai garisan. Rendah, tengah, tinggi. Jangan malu-malu!', "Tap the lane when a note reaches the line. Low, middle, high. Don't be shy!"]],
  ajis3: [['Wah, sorak orang kampung sampai ke laut! Kamu memang bintang kampung.', 'Wow, you could hear the cheering all the way to the sea! You really are the village star.'],
    ['Tok Abah tunggu kamu di rumah. Ada benda dia nak cakap.', 'Tok Abah is waiting for you at home. He has something to tell you.']],
  abah_fest: [['Cucu… Tok dengar kamu nyanyi tadi. Menitis air mata Tok.', 'Grandchild… I heard you singing just now. It brought tears to my eyes.'],
    ['Dulu kampung ni sunyi, orang muda semua ke bandar. Sekarang tengok, semua dah balik, semua ketawa.', 'This village used to be so quiet, with the young people all gone to the city. Now look, everyone is back and laughing.'],
    ['Tengok langit tu, bunga api! Pesta pertama Kampung Seri Damai dalam dua puluh tahun.', "Look at the sky, fireworks! Kampung Seri Damai's first festival in twenty years."],
    ['Terima kasih, cucu. Kamu wira kampung kita.', 'Thank you, grandchild. You are our village hero.']],
  // ---- Bab 4 · Kak Long (chatty keropok lekor seller who loves her beach)
  abah_b4: [['Cucu, jalan baru ke Pantai Miami dah siap. Dari situ nampak Jambatan Angkat!', 'Grandchild, the new road to Pantai Miami is finished. You can see the drawbridge from there!'],
    ['Kawan lama Tok, Kak Long, jual keropok lekor tepi pantai. Pergilah jumpa dia, ikut jalan ke timur.', 'My old friend Kak Long sells keropok lekor by the beach. Go and see her. Take the road east.']],
  kaklong1: [['Eh, cucu Tok Abah ke ni? Mari, mari! Keropok lekor Kak Long paling rangup sekuala, tau!', "Oh, you're Tok Abah's grandchild? Come, come! My keropok lekor is the crispiest in town!"],
    ['Tapi tengoklah pantai ni… botol, tin, plastik, polistirena merata. Penyu pun tak nak naik bertelur.', "But look at this beach… bottles, cans, plastic and styrofoam everywhere. Even the turtles won't come ashore to nest."],
    ['Tolong Kak Long kutip? Botol plastik, tin dan kaca masuk tong biru KITAR SEMULA. Lain-lain masuk SAMPAH AM.', 'Help me clean up? Plastic bottles, cans and glass go in the blue RECYCLING bin. Everything else goes in GENERAL WASTE.']],
  kaklong2: [['MasyaAllah, bersihnya! Ni baru Pantai Miami yang Kak Long kenal.', 'MasyaAllah, so clean! Now this is the Pantai Miami I remember.'],
    ['Kejap lagi Jambatan Angkat naik. Pak Mat nak bawa bot keluar ikut muara. Pergi tengok dekat jambatan!', 'The drawbridge is about to lift. Pak Mat is taking his boat out through the river mouth. Go and watch from the bridge!']],
  bridge: [['Tengok tu! Inilah jambatan angkat pertama di Malaysia, malah di Asia Tenggara.', 'Look at that! This is the first drawbridge in Malaysia, and in all of Southeast Asia too.'],
    ['Rekaannya ikut Tower Bridge di London. Empat menara, setiap pasang bersambung dengan jambatan langit.', "The design was inspired by London's Tower Bridge. Four towers, and each pair is joined by a skybridge."],
    ['Bila kapal besar nak lalu, dua bahagian tengah tu terangkat. Best, kan?', 'When a big ship needs to pass, the two middle sections lift up. Cool, right?']],
  kaklong3: [['Hah, macam mana? Cantik, kan? Malam lagi cantik, lampu menara menyala.', "So, what do you think? Pretty, right? It's even nicer at night when the towers light up."],
    ['Nah, keropok lekor panas dengan sos cili. Datanglah selalu tolong jaga pantai, Kak Long bayar!', "Here, hot keropok lekor with chilli sauce. Come and help look after the beach any time. I'll pay you!"]],
  mat5: [['Cucu, tengok tu! Budak-budak muda datang jeti nak belajar memancing!', 'Look over there! Young people are coming to the jetty to learn how to fish!'],
    ['Lama dah jeti ni tak riuh macam ni. Kau yang bawa balik semangat laut kampung kita.', "This jetty hasn't been this lively in years. You brought the sea back to our village."],
    ['Datanglah memancing bila-bila. Apa kau dapat, Pak Mat beli!', "Come fishing any time. Whatever you catch, I'll buy!"]],
};
const IDLE = {
  abah: [['Jalan elok-elok, cucu. Jangan lari, nanti jatuh.', "Walk carefully, grandchild. Don't run or you'll trip."], ['Rumah ni Tok bina dengan tangan sendiri. Kayu cengal, tahan lama!', 'I built this house with my own hands. Cengal wood, built to last!'], ['Dah solat? Nanti singgah surau dengan Tok.', 'Have you prayed yet? Come to the surau with me later.']],
  kiah: [['Nak teh tarik? Kejap, Nek buatkan.', "Want some teh tarik? Hang on, I'll make you one."], ['Nasi lemak Nek paling sedap sekampung. Tanyalah sesiapa!', 'My nasi lemak is the best in the village. Ask anyone!'], ['Makan dulu, baru kerja. Perut kosong mana boleh!', "Eat first, then work. You can't work on an empty stomach!"]],
  din: [['Aduh, pinggang ni… Dah tua agaknya.', 'Ouch, my back… Must be getting old.'], ['Kereta bersih, hati pun senang.', 'Clean car, happy heart.'], ['Sabun ada, span ada, air ada. Jom, bos!', "Soap, sponge, water, all ready. Let's go, boss!"]],
  amin: [['Abang, Kakak, jom main bola petang nanti!', 'Want to play football this evening?'], ['Bila besar, Amin nak jadi wira kampung!', 'When I grow up, I want to be a village hero!'], ['Tadi Amin nampak penyu kat Pantai Miami!', 'I saw a turtle at Pantai Miami earlier!']],
  hassan: [['Padi ni macam anak, kena jaga hari-hari.', 'Padi is like a child. You have to look after it every day.'], ['Hujan turun nanti, sawah ni hijau balik.', 'Once the rain comes, this field will turn green again.']],
  lim: [['Mari, mari! Gula, tepung, minyak, semua ada!', 'Come, come! Sugar, flour, cooking oil, I have it all!'], ['Uncle buka kedai ni dari tahun 1985 lagi, tau.', "I've been running this shop since 1985, you know."], ['Hari ni ada diskaun. Tapi untuk you saja, ah!', 'Discount today. Just for you, okay!']],
  ani: [['Jangan lupa membaca, ya. Sehari satu bab pun cukup!', "Don't forget to read. Even one chapter a day is enough!"], ['Murid-murid Cikgu dulu semua dah besar panjang.', 'All my old pupils are grown up now.'], ['Good job! Cikgu bangga dengan kamu.', "Good job! I'm proud of you."]],
  kaklong: [['Keropok lekor! Panas-panas, rangup-rangup!', 'Keropok lekor! Hot and crispy!'], ['Petang-petang ramai orang main wau kat pantai ni.', 'Lots of people fly wau kites on this beach in the evening.'], ['Jangan buang sampah merata, ya! Kesian penyu.', "Don't litter, okay! Think of the turtles."]],
  mat: [['Laut ni cikgu paling sabar.', 'The sea is the most patient teacher there is.'], ['Esok subuh angin elok. Mesti banyak ikan.', "The wind will be good at dawn tomorrow. Should be plenty of fish."]],
  abu: [['Petang-petang Pok Ajis petik gitar di beranda. Singgahlah!', 'In the evenings I play guitar on the verandah. Drop by!'], ['Rumah Pok Ajis ni dah tiga generasi, tau.', 'This house has been in my family for three generations.'], ['Ada lagu baru dalam kepala ni. Nanti Pok nyanyikan!', "There's a new song in my head. I'll sing it for you sometime!"]],
  // new villagers (v2.1): Cikgu Eby (teacher at SK Seri Damai), Mok Ngoh (sells kuih: warung in the morning, pasar malam at night),
  // Mok Yah (tailor at the shop row), Yaya, Seola and Taeyang (schoolchildren: Taman Ria, the playground and the futsal court after school)
  eby: [['Selamat pagi! Dah siap kerja sekolah?', 'Good morning! Finished your homework?'], ['Murid Cikgu pandai-pandai belaka. Cikgu bangga!', "My pupils are all so clever. I'm proud of them!"], ['Petang nanti Cikgu bawa budak-budak ke taman.', "This afternoon I'm taking the kids to the park."]],
  ngoh: [['Kuih! Kuih! Seri muka, karipap, kuih lapis. Mari beli!', 'Kuih! Seri muka, curry puffs, layer cake. Come and buy!'], ['Mok Ngoh bangun pukul empat pagi nak buat kuih ni, tau.', 'I get up at four in the morning to make these, you know.'], ['Malam nanti Mok Ngoh jual di pasar malam. Datanglah!', "Tonight I'm selling at the pasar malam. Do come!"]],
  yah: [['Nak tempah baju kurung untuk Raya? Mok Yah jahitkan.', 'Want a baju kurung made for Raya? I can sew it.'], ['Kain ni songket Terengganu. Cantik, kan?', 'This is Terengganu songket. Lovely, right?'], ['Lepas Maghrib Mok Yah ke surau. Jumpa di sana!', "After Maghrib I go to the surau. See you there!"]],
  yaya: [['Aiskrim ni sedap gila! Nak sikit?', 'This ice cream is so good! Want some?'], ['Lepas sekolah Yaya main kat Taman Ria.', 'After school I play at Taman Ria.'], ['Bila besar Yaya nak jadi doktor!', 'When I grow up I want to be a doctor!']],
  seola: [['Hai! Jom main buaian kat taman!', "Hi! Let's play on the swings at the park!"], ['Seola suka melukis bot nelayan kat jeti.', 'I like drawing the fishing boats at the jetty.'], ['Cikgu Eby kata lukisan Seola cantik!', 'Cikgu Eby says my drawings are pretty!']],
  taeyang: [['Jom futsal! Taeyang jaga gol, awak sepak!', "Let's play futsal! I'll be in goal, you shoot!"], ['Nombor 46 ni nombor bertuah Taeyang.', 'Number 46 is my lucky number.'], ['Petang ni ada perlawanan di gelanggang. Datang sorak, ya!', "There's a match at the court this afternoon. Come and cheer!"]],
};
const GREETS = [['Assalamualaikum!', 'Peace be upon you!'], ['Panas terik hari ni, kan?', "Scorching today, isn't it?"], ['Dah makan?', 'Have you eaten?'], ['Eh, anak siapa ni? Oh, cucu Tok Abah!', "Whose child is this? Oh, Tok Abah's grandchild!"], ['Petang nanti gotong-royong, jangan lupa!', "Community clean-up this evening, don't forget!"], ['Jom minum kopi kat warung Nek Ma!', "Let's grab a coffee at Nek Ma's warung!"]];
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
function addStars(n) { const before = rank(); S.stars += n; save(); bump('stars'); if (rank() !== before) setTimeout(() => toast(`Gelaran baru: ${rank()}!`, 'New title unlocked!'), 900); }
function showMission() { const c = cur(); if (c) { toast(`Misi: ${c.bm}`, c.en); town.focus(targetOf(c)); } }

// ------------------------------------------------------------ town
const heroAt = () => { const c = cur(); if (!c) return 'house_abah'; const id = targetOf(c); return { jeti: 'mat', padi: 'hassan', carwash: 'din', yard_abah: 'abah', house_abah: 'abah', pantai: 'kaklong', jambatan: 'kaklong' }[id] || id; };
const townHooks = { flags, markers, onTap, npcVisible, heroAt, npcName: (id) => (NPCS[id] || {}).name || '' };
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
  if (kind === 'karaoke') { ui.busy = true; audioInit(); wantMusic(null); const res = await runKaraoke(opts); ui.busy = false; wantMusic('kampung'); if (!res) { toast('Tak apa, cuba lagi nanti.', 'No worries, try again later.'); return null; } const prev = S.best.karaoke || 0; if (res.stars > prev) S.best.karaoke = res.stars; if (!opts.practice) save(); return res; }
  ui.busy = true; audioInit(); wantMusic(['fish', 'seafish', 'boat', 'beach', 'volley', 'photo'].includes(kind) ? 'laut' : 'kampung');
  let res;
  if (S.gfx !== '2d' && has3D()) {
    try { toast('Memuatkan 3D…', 'Loading 3D…'); res = await runGame3D(kind, opts); }
    catch (e) { console.warn('3D unavailable, using 2D', e && e.stack); $('game').hidden = true; $('game').classList.remove('is3d'); if (kind === 'seafish' || kind === 'jalandrag') { ui.busy = false; wantMusic('kampung'); need3D(); return null; } toast('3D tak dapat dimuatkan — guna 2D', "Couldn't load 3D — using 2D"); res = await runGame(kind, opts); }
  } else if (kind === 'seafish' || kind === 'jalandrag') { ui.busy = false; wantMusic('kampung'); if (kind === 'seafish') need3D(); return null; } else res = await runGame(kind, opts);
  ui.busy = false; wantMusic('kampung');
  if (!res) { toast('Tak apa, cuba lagi nanti.', 'No worries, try again later.'); return null; }
  const prev = S.best[kind] || 0; if (res.stars > prev) S.best[kind] = res.stars;
  if (!opts.practice) save(); // mini-game result saved straight away (practice restores S.best afterwards)
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
  const n = NPCS[id], c = cur(); if (n && !(S.talked || {})[id]) { (S.talked ||= {})[id] = 1; save(); }
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
  if (id === 'abah' && at(5, 5)) { await dialog(n, LINES.abah_fest); fireworks(); return finishChapter(5); }
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
  if (hit.type === 'ground') { if (town.walkTo) town.walkTo(hit.x, hit.z); return; }
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
    if (await jobPrompt(y === 'ani' ? 'Tebas laman Cikgu Aqilah' : 'Tebas laman Pok Ajis', 40)) return dailyJob('grass', y);
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
  const v = await modal({ kicker: 'MENU', title: 'MyKampung', html: `<p class="muted">Gelaran · Title: <b>${rank()}</b> · ⭐ ${S.stars} · 💵 ${fmtRM(balance())}</p>`, buttons: [['Cara main · How to play', 'help'], ['🎉 Aktiviti · Activities', 'acts'], ['Latihan mini game · Practice', 'practice'], [S.timeMode === 'day' ? 'Masa: sentiasa siang' : 'Masa: ikut jam sebenar', 'time'], ['🐟 Buku Ikan · Fish book', 'fishbook'], [S.music === false ? '🎵 Muzik: tutup → buka' : '🎵 Muzik: buka → tutup', 'music'], [S.gfx === '2d' ? 'Grafik: 2D (ringan) → tukar 3D' : 'Grafik: 3D → tukar 2D (ringan)', 'gfx'], ['🌐 Online', 'online'], ['🏆 Pencapaian · Achievements', 'ach'], ['💾 Simpanan · Save backup', 'savedata'], ['Kredit · Credits', 'credits'], ['Mula semula · Restart', 'reset'], ['Tutup · Close', 'ok', true]] });
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
  if (v === 'online') return onlineMenu();
  if (v === 'ach') return achievementsMenu();
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
  return confirmImport(r.data);
}
async function confirmImport(d) {
  const c = await modal({ kicker: '💾 IMPORT', title: 'Ganti kemajuan?', html: `<p>Fail ini: <b>Bab ${d.chapter}</b> · ⭐ ${d.stars || 0} · ${fmtRM(d.coins)}</p><p>Sekarang: <b>Bab ${S.chapter}</b> · ⭐ ${S.stars} · ${fmtRM(balance())}</p><p class="muted">Kemajuan sekarang akan diganti. · Your current progress will be replaced by this file.</p>`, buttons: [['Ya, import · Yes, import', 'yes'], ['Batal · Cancel', 'no', true]] });
  if (c !== 'yes') return;
  if (importSave(d)) location.reload(); else toast('Import gagal', 'Import failed — storage is full or blocked');
}

// ------------------------------------------------------------ achievements & daily login (js/progress.js)
function checkAchievements() {
  for (const a of newAchievements(S)) { (S.ach ||= {})[a.id] = Date.now(); addCoins(a.rm, 'pencapaian ' + a.id); toast(`🏆 ${a.bm} · +${fmtRM(a.rm)}`, a.en); }
}
function achievementsMenu() {
  const got = S.ach || {}, rows = ACHIEVEMENTS.map(a => `<li class="${got[a.id] ? '' : 'locked'}">${got[a.id] ? '🏆' : '🔒'} <b>${a.bm}</b> <small>${a.en} · ${fmtRM(a.rm)}</small></li>`).join('');
  return modal({ kicker: 'PENCAPAIAN · ACHIEVEMENTS', title: `${Object.keys(got).length}/${ACHIEVEMENTS.length}`, html: `<ul class="catchList book">${rows}</ul><p class="muted small">Log masuk harian: ${(S.login || {}).streak || 0} hari berturut-turut. · Daily login streak.</p>`, buttons: [['Tutup · Close', 'ok', true]] });
}
function dailyLogin() {
  if (net && net.state.status === 'online' && netAccount) return; // online accounts claim through the server
  const r = claimDaily(S); if (!r.ok) { if (r.reason === 'clock') toast('Jam peranti tidak betul', 'Your device clock looks wrong, daily reward skipped'); return; }
  addCoins(r.reward, 'harian'); save(); toast(`🎁 Hadiah harian +${fmtRM(r.reward)}`, `Daily reward · day ${r.streak} streak`); checkAchievements();
}

// ------------------------------------------------------------ nearby Talk button (tap-to-talk still works)
setInterval(() => {
  const b = $('talkBtn'); if (!b) return; const id = !ui.busy && $('game').hidden && town.nearNpc ? town.nearNpc() : null;
  b.hidden = !id; if (id && b.dataset.id !== id) { b.dataset.id = id; b.textContent = `💬 Cakap · ${NPCS[id] ? NPCS[id].name : ''}`; }
}, 300);
$('talkBtn').onclick = () => { const id = $('talkBtn').dataset.id; if (id) onTap({ type: 'npc', id }); };

// ------------------------------------------------------------ online village (js/net.js + server/)
let net = null, netAccount = false;
function netChip() { const c = $('netChip'); if (!net) { c.hidden = true; $('emoteBtn').hidden = true; return; } c.hidden = false; const n = net.state.players.size + 1;
  c.textContent = net.state.status === 'online' ? `🌐 ${n}/${net.cap || 10}` : net.state.status === 'offline' ? '🌐 ✕' : '🌐 …'; $('emoteBtn').hidden = net.state.status !== 'online'; }
async function supabaseLogin() {
  const email = (prompt('E-mel untuk log masuk · Email to sign in') || '').trim(); if (!/^\S+@\S+\.\S+$/.test(email)) return null;
  const h = { apikey: SUPABASE_ANON_KEY, 'content-type': 'application/json' };
  const r1 = await fetch(`${SUPABASE_URL}/auth/v1/otp`, { method: 'POST', headers: h, body: JSON.stringify({ email, create_user: true }) }).catch(() => null);
  if (!r1 || !r1.ok) { toast('Gagal hantar kod', 'Could not send the code'); return null; }
  const code = (prompt('Masukkan kod dari e-mel · Enter the code from your email') || '').trim(); if (!code) return null;
  const r2 = await fetch(`${SUPABASE_URL}/auth/v1/verify`, { method: 'POST', headers: h, body: JSON.stringify({ type: 'email', email, token: code }) }).catch(() => null);
  const j = r2 && r2.ok ? await r2.json() : null; if (!j || !j.access_token) { toast('Kod salah', 'Wrong code'); return null; }
  try { sessionStorage.setItem('mk_token', j.access_token); } catch { } return j.access_token;
}
function goOnline(name, token) {
  S.playerName = name; save(); netAccount = !!token;
  net = netConnect({ name, token, getPos: () => town.heroPos && town.heroPos(), on: {
    status: () => netChip(),
    welcome: (m) => { net.cap = m.cap; netAccount = m.account; toast(m.resumed ? '🌐 Bersambung semula' : '🌐 Anda dalam talian!', m.resumed ? 'Reconnected' : `Room "${m.room}" · ${m.players.length + 1}/${m.cap}`); if (m.account && !m.resumed) net.claimDaily(); },
    players: (list) => { town.setRemotes && town.setRemotes(list); netChip(); },
    emote: (id, e) => town.remoteEmote && town.remoteEmote(id, e),
    pos: (x, z) => town.walkTo && town.walkTo(x, z),
    error: (code) => toast(code === 'full' ? 'Bilik penuh' : code === 'auth' ? 'Log masuk diperlukan' : 'Ralat talian', code === 'full' ? 'The room is full, try later' : code === 'auth' ? 'Please sign in' : code),
    claim: (m) => { if (m.ok && (S.login || {}).day !== myDay(Date.now())) { S.login = { day: myDay(Date.now()), lastTs: Date.now(), streak: m.streak }; addCoins(m.reward, 'harian online'); save(); toast(`🎁 Hadiah harian +${fmtRM(m.reward)}`, `Daily reward (server) · day ${m.streak}`); checkAchievements(); } },
    saved: (m) => toast(m.ok ? '☁️ Disimpan ke awan' : 'Simpanan awan gagal', m.ok ? 'Saved to the cloud' : m.reason),
    cloud: (m) => { if (!m.ok || !m.save) return toast('Tiada simpanan awan', 'No cloud save yet'); const r = parseSave(JSON.stringify(m.save.data)); if (r.ok) confirmImport(r.data); },
  } });
  netChip();
}
async function onlineMenu() {
  if (!serverUrl()) return modal({ kicker: '🌐 ONLINE', title: 'Belum tersedia', body: 'Server multiplayer belum disediakan untuk laman ini. Permainan offline berjalan seperti biasa. · The multiplayer server is not configured for this site yet; offline play works as usual.', buttons: [['OK', 'ok', true]] });
  if (net && net.state.status !== 'offline') {
    const v = await modal({ kicker: '🌐 ONLINE', title: `${net.state.players.size + 1} pemain · players`, body: netAccount ? 'Akaun: kemajuan boleh disimpan ke awan. · Signed in: cloud save available.' : 'Tetamu: log masuk untuk simpanan awan dan hadiah server. · Guest: sign in for cloud save and server rewards.', buttons: [['😄 Emote', 'emote', true], ...(netAccount ? [['☁️ Simpan ke awan', 'up'], ['☁️ Muat dari awan', 'down']] : []), ['Putus · Disconnect', 'off'], ['Tutup', 'ok']] });
    if (v === 'emote') return emoteMenu(); if (v === 'up') return net.saveCloud(JSON.parse(exportSave()).data); if (v === 'down') return net.loadCloud();
    if (v === 'off') { net.close(); net = null; town.setRemotes && town.setRemotes([]); netChip(); }
    return;
  }
  const v = await modal({ kicker: '🌐 ONLINE', title: 'Main bersama', html: `<p>Nama · Name: <input id="mpName" maxlength="16" value="${String(S.playerName || '').replace(/[^\p{L}\p{N} _-]/gu, '')}" style="font:inherit;padding:6px;border-radius:8px;border:1px solid #ccc;width:60%"></p><p class="muted small">Pemain lain nampak nama dan watak anda di kampung. Simpanan anda kekal dalam peranti ini. · Other players see your name and hero. Your save stays on this device.</p>`, buttons: [['Main sebagai tetamu · Guest', 'guest', true], ...(SUPABASE_URL ? [['Log masuk · Sign in', 'login']] : []), ['Batal', 'no']] });
  const name = ((document.getElementById('mpName') || {}).value || S.playerName || 'Pemain').trim().slice(0, 16) || 'Pemain';
  if (v === 'guest') return goOnline(name, '');
  if (v === 'login') { let tok = ''; try { tok = sessionStorage.getItem('mk_token') || ''; } catch { } tok = tok || await supabaseLogin(); if (tok) goOnline(name, tok); }
}
async function emoteMenu() {
  const e = await modal({ kicker: '😄 EMOTE', title: 'Pilih emote', buttons: ['👋', '😄', '👍', '🎉', '❤️', '🙏'].map(x => [x, x]).concat([['Tutup', 'ok', true]]) });
  if (e && e !== 'ok' && net) { net.emote(e); town.heroEmote && town.heroEmote(e); }
}
$('netChip').onclick = () => onlineMenu(); $('emoteBtn').onclick = () => emoteMenu();
setInterval(checkAchievements, 5000);

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
  if (newerOnDisk()) return location.reload(); // another tab saved later: load that save instead of this page's older copy
  audioInit(); $('title').hidden = true; sfx.good(); wantMusic('kampung'); keepSaveSafe(); startAutosave();
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
  setTimeout(dailyLogin, 3500);
  if (saveStatus() === 'restored') setTimeout(() => toast('💾 Simpanan dipulihkan', 'Your save was damaged and has been restored from the backup'), 2800); // after the mission toast
}
// ------------------------------------------------------------ outdated tab: another tab saved newer progress
// Blocking pop-up above everything (mini-games and karaoke included). This tab no longer saves (core.js);
// the only way on is "Muat Semula", which reloads the latest save.
function showStaleTab() {
  if ($('staleTab')) return;
  ui.busy = true; audioPause();
  const o = document.createElement('div'); o.id = 'staleTab'; o.className = 'overlay'; o.setAttribute('role', 'alertdialog'); o.setAttribute('aria-modal', 'true');
  o.innerHTML = `<div class="card"><div class="kick">⚠️ TAB LAIN · ANOTHER TAB</div><h2>Muat semula permainan</h2><p>Permainan dibuka di tab lain. Kemajuan terbaru telah disimpan di sana.</p><p class="muted small">The game is open in another tab and your latest progress was saved there. Reload to continue from it.</p><div class="btns"><button id="staleReload" class="primary">Muat Semula</button></div></div>`;
  document.body.append(o); const b = $('staleReload'); b.onclick = () => location.reload(); b.focus();
}
onStale(showStaleTab);
// keyboard play (WASD, J/K/L…) is blocked too while the pop-up is up; Enter/Space still press "Muat Semula"
addEventListener('keydown', (e) => { if (isStale() && e.target.id !== 'staleReload') { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
addEventListener('keyup', (e) => { if (isStale()) e.stopImmediatePropagation(); }, true);

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
