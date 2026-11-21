// MyKampung — shared 3D model loader (used by the town and the mini-games).
// Models come from model packs (Kenney, Quaternius, KayKit: CC0; HHG: free with credit) packed into assets/models.json.
let T, GLTFLoader;

// ------------------------------------------------------------ model packs (Kenney CC0, Quaternius CC0, HHG — see credits)
export const MODEL_FILES = {
  palm1: 'nature/PalmTree_1', palm2: 'nature/PalmTree_2', palm3: 'nature/PalmTree_3', palm4: 'nature/PalmTree_4',
  tree1: 'nature/CommonTree_1', tree2: 'nature/CommonTree_2', tree3: 'nature/CommonTree_3', tree4: 'nature/CommonTree_4',
  bush1: 'nature/Bush_1', bush2: 'nature/Bush_2', berry1: 'nature/BushBerries_1', berry2: 'nature/BushBerries_2',
  flowers: 'nature/Flowers', plant1: 'nature/Plant_1', plant3: 'nature/Plant_3', plant5: 'nature/Plant_5',
  rock1: 'nature/Rock_1', rock2: 'nature/Rock_2', rockm: 'nature/Rock_Moss_1', grass1: 'nature/Grass', grass2: 'nature/Grass_2', stump: 'nature/TreeStump',
  sedan: 'cars/sedan', taxi: 'cars/taxi', police: 'cars/police', van: 'cars/van', suv: 'cars/suv', hatch: 'cars/hatchback-sports', delivery: 'cars/delivery', cone: 'cars/cone', crate: 'cars/box',
  lamp: 'roads/light_curved',
  fence: 'suburban/fence_wide', ktree: 'suburban/tree_large', ktreeS: 'suburban/tree_small',
  house4: 'suburban/house_type04', house7: 'suburban/house_type07', house12: 'suburban/house_type12',
  scooter: 'hhg/Scooter', bicycle: 'hhg/Bicycle',
  // KayKit (CC0): City Builder Bits, Forest Nature Pack, RPG Tools Bits
  bench: 'kaykit/bench', hydrant: 'kaykit/firehydrant', trashA: 'kaykit/trash_A', trashB: 'kaykit/trash_B', dumpster: 'kaykit/dumpster', boxA: 'kaykit/box_A', boxB: 'kaykit/box_B',
  watertower: 'kaykit/watertower', tlight: 'kaykit/trafficlight_A', wagon: 'kaykit/car_stationwagon',
  fbush1: 'kaykit/Bush_1_A_Color1', fbush2: 'kaykit/Bush_1_C_Color1', fbush3: 'kaykit/Bush_2_A_Color1', fbush4: 'kaykit/Bush_2_C_Color1', fbush5: 'kaykit/Bush_4_A_Color1',
  fgrass1: 'kaykit/Grass_1_A_Color1', fgrass2: 'kaykit/Grass_1_B_Color1', fgrass3: 'kaykit/Grass_2_A_Color1', fgrass4: 'kaykit/Grass_2_C_Color1',
  frock1: 'kaykit/Rock_1_A_Color1', frock2: 'kaykit/Rock_2_A_Color1', frock3: 'kaykit/Rock_3_C_Color1', ftree1: 'kaykit/Tree_1_A_Color1', ftree2: 'kaykit/Tree_2_A_Color1', ftree3: 'kaykit/Tree_3_A_Color1', ftree4: 'kaykit/Tree_4_A_Color1',
  rtable: 'kaykit/r_table_round_A_decorated', rchair: 'kaykit/r_chair_A',
  crateCarrot: 'kaykit/r_crate_carrots', crateOnion: 'kaykit/r_crate_onions', crateTomato: 'kaykit/r_crate_tomatoes', cratePotato: 'kaykit/r_crate_potatoes', crateLettuce: 'kaykit/r_crate_lettuce',
  stove: 'kaykit/r_stove_single_countertop', potStew: 'kaykit/r_pot_A_stew', stewPot: 'kaykit/r_stew_pot', jarA: 'kaykit/r_jar_A_large', jarB: 'kaykit/r_jar_B_medium', menu: 'kaykit/r_menu',
  woodChair: 'kaykit/f_chair_A_wood', rug: 'kaykit/f_rug_rectangle_stripes_A', standLamp: 'kaykit/f_lamp_standing', lowTable: 'kaykit/f_table_low',
  rowboat: 'sea/RowBoat1',
  // TYRANZ models (supplied by the game's owner): fishing boat, bus, airliner and 30 Malaysian sea fish
  hero: 'tyranz/Hero', cutter: 'tyranz/Grass_Cutter',
  fboat: 'tyranz/Fishing_Boat', bus: 'tyranz/Passenger_Bus', airliner: 'tyranz/Airliner',
  'fish_Kembung': 'fish/Ikan_Kembung', 'fish_Selar_Kuning': 'fish/Ikan_Selar_Kuning', 'fish_Cencaru': 'fish/Ikan_Cencaru', 'fish_Selayang': 'fish/Ikan_Selayang', 'fish_Tamban': 'fish/Ikan_Tamban', 'fish_Bilis': 'fish/Ikan_Bilis', 'fish_Tenggiri': 'fish/Ikan_Tenggiri', 'fish_Tongkol': 'fish/Ikan_Tongkol', 'fish_Tuna_Sirip_Kuning': 'fish/Ikan_Tuna_Sirip_Kuning', 'fish_Alu-Alu': 'fish/Ikan_Alu-Alu', 'fish_Kerapu': 'fish/Ikan_Kerapu', 'fish_Kerapu_Bara': 'fish/Ikan_Kerapu_Bara', 'fish_Jenahak': 'fish/Ikan_Jenahak', 'fish_Merah': 'fish/Ikan_Merah', 'fish_Siakap': 'fish/Ikan_Siakap', 'fish_Kerisi': 'fish/Ikan_Kerisi', 'fish_Bawal_Putih': 'fish/Ikan_Bawal_Putih', 'fish_Bawal_Hitam': 'fish/Ikan_Bawal_Hitam', 'fish_Bawal_Emas': 'fish/Ikan_Bawal_Emas', 'fish_Pari': 'fish/Ikan_Pari', 'fish_Senangin': 'fish/Ikan_Senangin', 'fish_Kurau': 'fish/Ikan_Kurau', 'fish_Gelama': 'fish/Ikan_Gelama', 'fish_Gerut-Gerut': 'fish/Ikan_Gerut-Gerut', 'fish_Talang': 'fish/Ikan_Talang', 'fish_Belanak': 'fish/Ikan_Belanak', 'fish_Sebelah': 'fish/Ikan_Sebelah', 'fish_Jebong': 'fish/Ikan_Jebong', 'fish_Dengkis': 'fish/Ikan_Dengkis', 'fish_Biji_Nangka': 'fish/Ikan_Biji_Nangka',
  hammer: 'kaykit/hammer', nail: 'kaykit/nail', bucket: 'kaykit/bucket_metal', shovel: 'kaykit/shovel', saw: 'kaykit/saw', axe: 'kaykit/axe', rope: 'kaykit/rope_bundle_A', lantern: 'kaykit/lantern', trowel: 'kaykit/trowel', plane: 'kaykit/handplane', mallet: 'kaykit/mallet', wrench: 'kaykit/wrench_A',
};
let cache = null, skClone = null;
export function loadModels(onProgress) { if (!cache) cache = loadAll(onProgress); return cache; }
async function loadAll(onProgress) {
  T = await import('three');
  try { ({ GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js')); } catch { return {}; }
  const M = {};
  const loader = new GLTFLoader(); let done = 0; let keys = Object.keys(MODEL_FILES);
  // all models are packed into one JSON file (base64 GLB) so they load in a single request
  try { ({ clone: skClone } = await import('three/addons/utils/SkeletonUtils.js')); } catch { skClone = null; }
  let pack = {}, pack2 = {};
  // pack 1: town, kampung and sea models; pack 2: Bandar Baru (mall, park, school, skate park, fun fair), shop interior, characters, animals
  const [r1, r2] = await Promise.allSettled([fetch('assets/models.json').then(r => r.json()), fetch('assets/models2.json').then(r => r.json())]);
  if (r1.status === 'fulfilled') pack = r1.value; else { console.warn('model pack failed', r1.reason); return M; }
  if (r2.status === 'fulfilled') { pack2 = r2.value; for (const k of Object.keys(pack2)) { MODEL_FILES[k] = k; pack[k] = pack2[k]; } }
  onProgress && onProgress(.35); keys = Object.keys(MODEL_FILES);
  const b64 = (s) => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; };
  await Promise.all(keys.map(async (k) => {
    try {
      const file = MODEL_FILES[k]; if (!pack[file]) throw new Error('missing ' + file);
      const g = await loader.parseAsync(b64(pack[file]), `assets/${file.split('/')[0]}/`);
      const inner = g.scene, box = new T.Box3().setFromObject(inner), c = box.getCenter(new T.Vector3());
      inner.position.sub(new T.Vector3(c.x, box.min.y, c.z));
      const wrap = new T.Group(); wrap.add(inner); wrap.userData.size = box.getSize(new T.Vector3()); wrap.userData.anims = g.animations || []; let sk = false; inner.traverse(o => { if (o.isSkinnedMesh) sk = true; }); wrap.userData.skinned = sk;
      inner.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material && o.material.metalness === 1 && !o.material.map) { o.material = o.material.clone(); o.material.metalness = .25; o.material.roughness = .45; } } }); // glTF default material is fully metallic → black without an env map
      M[k] = wrap;
    } catch (e) { console.warn('model failed', k, e); }
    onProgress && onProgress(.35 + .65 * (++done / keys.length));
  }));
  return M;
}
// Load one GLB that is NOT in the model packs (e.g. a detailed NPC), on demand and only once per URL.
// Resolves to a wrapped model ready for putModel-style cloning (feet on y=0, centred, userData.size),
// or null if anything fails — callers keep their current representation in that case.
const glbCache = new Map();
export function loadGLB(url) {
  if (!glbCache.has(url)) glbCache.set(url, (async () => {
    try {
      if (!T) T = await import('three');
      const { GLTFLoader: L } = await import('three/addons/loaders/GLTFLoader.js');
      const g = await new L().loadAsync(url);
      const inner = g.scene, box = new T.Box3().setFromObject(inner), c = box.getCenter(new T.Vector3());
      inner.position.sub(new T.Vector3(c.x, box.min.y, c.z));
      const wrap = new T.Group(); wrap.add(inner); wrap.userData.size = box.getSize(new T.Vector3()); wrap.userData.anims = g.animations || [];
      inner.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      return wrap;
    } catch (e) { console.warn('model failed', url, e); return null; }
  })());
  return glbCache.get(url);
}

// clone a model: size by height (h), by longest side (len) or by factor (scale)
export function putModel(M, key, parent, x, z, { h, len, scale, ry = 0, y = 0, face, tint } = {}) {
  const src = M[key]; if (!src) return null;
  const sz = src.userData.size, k = scale || (h ? h / sz.y : len ? len / Math.max(sz.x, sz.z) : 1);
  const c = src.userData.skinned && skClone ? skClone(src) : src.clone(true); c.userData = { ...src.userData }; c.scale.setScalar(k); c.position.set(x, y, z); c.rotation.y = ry;
  if (face === 'x') c.children[0].rotation.y = Math.PI / 2;
  if (tint) c.traverse((o) => { if (o.isMesh && /enamel|paint|body/i.test(o.material.name)) { o.material = o.material.clone(); o.material.color.set(tint); } }); // vehicles modelled facing +z; our code drives them along +x
  parent.add(c); return c;
}


// an animated character/animal: returns { obj, mixer, play(name), update(dt) } or null
export function putAnimated(M, key, parent, x, z, opts = {}) {
  const obj = putModel(M, key, parent, x, z, opts); if (!obj) return null;
  const anims = (M[key] && M[key].userData.anims) || []; let mixer = null, cur = null;
  try { if (anims.length && T.AnimationMixer) mixer = new T.AnimationMixer(obj); } catch { mixer = null; }
  const play = (name) => { if (!mixer) return; const clip = anims.find(a => a.name === name || (a.name || '').toLowerCase().includes(name)); if (!clip || cur === clip) return; const act = mixer.clipAction(clip); act.reset().fadeIn(.2).play(); if (cur) mixer.clipAction(cur).fadeOut(.2); cur = clip; };
  play(opts.anim || 'idle');
  return { obj, mixer, play, update(dt) { mixer && mixer.update(dt); } };
}
