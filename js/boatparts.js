// BOT MODULAR — configuration (data only). Edit numbers here; rules are in boatrules.js, 3D assembly in boatbuilder.js.
//
// Units: "hull units". The hull GLB is 1 unit long (x: -0.5 stern .. +0.5 bow), y up, z across (+z = starboard when facing the bow).
// The builder scales the whole boat to hull.lengthM metres, so every anchor below scales with it.
//
// Component models are separate GLB files in assets/packs/bot/, named <slot>_lv<level>.glb (for example engine_lv2.glb).
// They are found through the pack index (id "bot/<slot>_lv<level>"). Until a file is uploaded the game shows a clearly
// marked placeholder box of the slot's `size`. No config change is needed when a real GLB arrives.
//
// anchor: { pos: [x, y, z], rot: [rx, ry, rz] in degrees, scale } — where the component's origin sits on the hull.
// A level may add `offset` (same shape) on top of its slot anchor. Fine-tune both in the Boat Yard's adjust mode.
export const BOAT = {
  version: 1,
  hull: { id: 'hull_lv1', model: 'bot/hull_lv1', lengthM: 5.2, bow: '+x', bm: 'Badan Bot Lv1', en: 'Boat hull Lv1' },

  // Parts moulded into the hull GLB that are separate "islands" of triangles, so the builder can hide them at load time
  // without touching the file. box = [[minX, minY, minZ], [maxX, maxY, maxZ]]: every island that lies fully inside is hidden.
  // shownAt: the built-in part is shown only while that slot is at exactly this level (level 1 = the factory part).
  builtins: {
    wheel: { bm: 'Stereng asal', en: 'Factory wheel', slot: 'steering', shownAt: 1, box: [[-.2, .19, -.058], [-.1, .31, .05]] },
    seatBack: { bm: 'Sandar asal', en: 'Factory backrest', slot: 'seat', shownAt: 1, box: [[-.095, .255, -.07], [-.045, .36, .07]] },
  },

  slots: {
    engine: {
      bm: 'Enjin', en: 'Engine', ic: '⚙️', stat: 'speed', unit: 'm/s',
      anchor: { pos: [-.52, .2, 0], rot: [0, 0, 0], scale: 1 }, size: [.12, .2, .1],
      levels: [
        { bm: 'Enjin 15 kk', en: '15 hp outboard', price: 0, value: 7 },
        { bm: 'Enjin 30 kk', en: '30 hp outboard', price: 600, value: 9 },
        { bm: 'Enjin 60 kk', en: '60 hp outboard', price: 1800, value: 11.5, requires: { steering: 2 } },
        { bm: 'Enjin 115 kk', en: '115 hp outboard', price: 4500, value: 14, requires: { steering: 3, propeller: 2 } },
      ],
    },
    steering: {
      bm: 'Stereng', en: 'Steering', ic: '🛞', stat: 'turn', unit: '×',
      anchor: { pos: [-.165, .258, -.006], rot: [0, 0, 0], scale: 1 }, size: [.05, .09, .09],
      levels: [
        { bm: 'Stereng asal', en: 'Factory wheel', price: 0, value: 1, builtin: 'wheel' },
        { bm: 'Stereng sukan', en: 'Sport wheel', price: 350, value: 1.15 },
        { bm: 'Stereng hidraulik', en: 'Hydraulic helm', price: 1100, value: 1.3 },
        { bm: 'Stereng kuasa', en: 'Power steering', price: 2600, value: 1.5 },
      ],
    },
    propeller: {
      bm: 'Kipas', en: 'Propeller', ic: '🌀', stat: 'accel', unit: '×',
      anchor: { pos: [-.56, .04, 0], rot: [0, 0, 0], scale: 1 }, size: [.03, .07, .07],
      levels: [
        { bm: 'Kipas aluminium', en: 'Aluminium prop', price: 0, value: 1 },
        { bm: 'Kipas 4 bilah', en: '4-blade prop', price: 300, value: 1.15 },
        { bm: 'Kipas keluli', en: 'Stainless prop', price: 950, value: 1.3, requires: { engine: 2 } },
        { bm: 'Kipas lumba', en: 'Race prop', price: 2200, value: 1.5, requires: { engine: 3 } },
      ],
    },
    seat: {
      bm: 'Tempat duduk', en: 'Seats', ic: '💺', stat: 'cooler', unit: 'ekor',
      anchor: { pos: [-.07, .262, 0], rot: [0, 0, 0], scale: 1 }, size: [.05, .09, .13],
      levels: [
        { bm: 'Sandar asal', en: 'Factory backrest', price: 0, value: 0, builtin: 'seatBack' },
        { bm: 'Kerusi berkusyen', en: 'Cushioned seat', price: 400, value: 2 },
        { bm: 'Kerusi kapten', en: 'Captain seat', price: 1200, value: 4 },
        { bm: 'Kerusi pancing pusing', en: 'Swivel fishing chair', price: 2800, value: 6 },
      ],
    },
    fishing: {
      bm: 'Peralatan pancing', en: 'Fishing gear', ic: '🎣', stat: 'line', unit: '×',
      anchor: { pos: [.12, .2, -.17], rot: [0, 0, 0], scale: 1 }, size: [.05, .1, .04],
      levels: [
        { bm: 'Pemegang joran', en: 'Rod holder', price: 0, value: 1 },
        { bm: 'Rak joran berkembar', en: 'Twin rod rack', price: 450, value: 1.1 },
        { bm: 'Kekili elektrik', en: 'Electric reel station', price: 1400, value: 1.2 },
        { bm: 'Stesen pancing laut dalam', en: 'Deep-sea fighting station', price: 3200, value: 1.35, requires: { seat: 2 } },
      ],
    },
    accessory: {
      bm: 'Aksesori', en: 'Accessories', ic: '🔦', stat: 'bite', unit: '×',
      anchor: { pos: [.3, .21, 0], rot: [0, 0, 0], scale: 1 }, size: [.06, .06, .06],
      levels: [
        { bm: 'Pelampung keselamatan', en: 'Life ring', price: 0, value: 1 },
        { bm: 'Lampu sorot', en: 'Spotlight', price: 300, value: 1.05 },
        { bm: 'Kanopi', en: 'Canopy', price: 1000, value: 1.1, offset: { pos: [-.35, .12, 0] } },
        { bm: 'Menara radar', en: 'Radar arch', price: 2400, value: 1.15, offset: { pos: [-.42, .14, 0] } },
      ],
    },
  },
};
export const SLOT_KEYS = Object.keys(BOAT.slots);
export const MAX_LEVEL = 4;
