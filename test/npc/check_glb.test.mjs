// GLB validator tests: run with `node test/npc/check_glb.test.mjs` from the project root.
// Builds small synthetic .glb files in memory (a rigged box "character") and checks every rule.
import assert from 'node:assert/strict';
import { checkGlb, imageSize, SPECS } from '../../tools/check_glb.mjs';

// ---------------------------------------------------------------- tiny GLB builder
function png(w, h) { const b = Buffer.alloc(33); b.writeUInt32BE(0x89504e47, 0); b.writeUInt32BE(0x0d0a1a0a, 4); b.writeUInt32BE(13, 8); b.write('IHDR', 12, 'ascii'); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); return b; }
function jpeg(w, h) { return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8, h >> 8, h & 255, w >> 8, w & 255, 3, 0, 0, 0]); }
function webp(w, h) { const b = Buffer.alloc(30); b.write('RIFF', 0, 'ascii'); b.write('WEBP', 8, 'ascii'); b.write('VP8X', 12, 'ascii'); b.writeUIntLE(w - 1, 24, 3); b.writeUIntLE(h - 1, 27, 3); return b; }
/**
 * opts: tris, height, width, depth, joints, clips {name: [seconds, rootTravelZ]}, images [Buffer], materials, prims,
 *       ext [extensionsUsed], noSkin, joints1, morphs, minY, scale (armature scale), externalImage, offsetX
 */
function makeGlb(o = {}) {
  const P = { tris: 8000, height: 1.68, width: 0.5, depth: 0.3, joints: 40, materials: 2, prims: 2, scale: 1, minY: 0, offsetX: 0,
    clips: { idle: [4, 0], walk: [1, 0], talk: [3, 0], sit: [4, 0] }, images: [png(1024, 1024)], ...o };
  const chunks = []; let len = 0; const bufferViews = [], accessors = [];
  const push = (buf, target) => { while (len % 4) { chunks.push(Buffer.alloc(1)); len++; } bufferViews.push({ buffer: 0, byteOffset: len, byteLength: buf.length, ...(target ? { target } : {}) }); chunks.push(buf); len += buf.length; return bufferViews.length - 1; };
  const f32 = (arr) => Buffer.from(new Float32Array(arr).buffer);
  const s = P.scale, x0 = (-P.width / 2 + P.offsetX) / s, x1 = (P.width / 2 + P.offsetX) / s, y0 = P.minY / s, y1 = (P.minY + P.height) / s, z0 = -P.depth / 2 / s, z1 = P.depth / 2 / s;
  // geometry per primitive: 4 vertices, index buffer repeating one triangle to reach the triangle count
  const meshes = [], perPrim = Math.ceil(P.tris / P.prims);
  const pos = f32([x0, y0, z0, x1, y0, z0, x1, y1, z1, x0, y1, z1]);
  const posAcc = accessors.push({ bufferView: push(pos, 34962), componentType: 5126, count: 4, type: 'VEC3', min: [x0, y0, z0], max: [x1, y1, z1] }) - 1;
  const jAcc = accessors.push({ bufferView: push(Buffer.from(new Uint8Array(16).buffer), 34962), componentType: 5121, count: 4, type: 'VEC4' }) - 1;
  const wAcc = accessors.push({ bufferView: push(f32([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]), 34962), componentType: 5126, count: 4, type: 'VEC4' }) - 1;
  const prims = [];
  for (let p = 0; p < P.prims; p++) {
    const idx = new Uint16Array(perPrim * 3); for (let k = 0; k < idx.length; k++) idx[k] = [0, 1, 2][k % 3];
    const iAcc = accessors.push({ bufferView: push(Buffer.from(idx.buffer), 34963), componentType: 5123, count: idx.length, type: 'SCALAR' }) - 1;
    const attributes = { POSITION: posAcc, ...(P.noSkin ? {} : { JOINTS_0: jAcc, WEIGHTS_0: wAcc }), ...(P.joints1 ? { JOINTS_1: jAcc, WEIGHTS_1: wAcc } : {}) };
    prims.push({ attributes, indices: iAcc, material: p % P.materials, ...(P.morphs ? { targets: Array.from({ length: P.morphs }, () => ({ POSITION: posAcc })) } : {}) });
  }
  meshes.push({ primitives: prims });
  // nodes: 0 = armature (scale), 1..J = joint chain, J+1 = skinned mesh
  const nodes = [{ name: 'Armature', scale: [s, s, s], children: [1, P.joints + 1] }];
  for (let j = 0; j < P.joints; j++) nodes.push({ name: j === 0 ? 'Hips' : 'Bone' + j, ...(j + 1 < P.joints ? { children: [j + 2] } : {}) });
  nodes.push({ name: 'Body', mesh: 0, ...(P.noSkin ? {} : { skin: 0 }) });
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const ibm = accessors.push({ bufferView: push(f32(Array.from({ length: P.joints }, () => I).flat())), componentType: 5126, count: P.joints, type: 'MAT4' }) - 1;
  const skins = P.noSkin ? [] : [{ joints: Array.from({ length: P.joints }, (_, j) => j + 1), inverseBindMatrices: ibm }];
  const animations = Object.entries(P.clips).map(([name, [dur, travel]]) => {
    const tAcc = accessors.push({ bufferView: push(f32([0, dur])), componentType: 5126, count: 2, type: 'SCALAR', min: [0], max: [dur] }) - 1;
    const vAcc = accessors.push({ bufferView: push(f32([0, 1, 0, 0, 1, travel / s])), componentType: 5126, count: 2, type: 'VEC3' }) - 1;
    return { name, samplers: [{ input: tAcc, output: vAcc }], channels: [{ sampler: 0, target: { node: 1, path: 'translation' } }] };
  });
  const images = P.images.map((b, i) => (P.externalImage ? { uri: 'tex' + i + '.png' } : { bufferView: push(b), mimeType: 'image/png' }));
  const json = { asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes, meshes, skins, animations, accessors, bufferViews,
    materials: Array.from({ length: P.materials }, (_, i) => ({ name: 'm' + i, pbrMetallicRoughness: images.length ? { baseColorTexture: { index: 0 } } : {} })),
    textures: images.map((_, i) => ({ source: i })), images, ...(P.ext ? { extensionsUsed: P.ext, extensionsRequired: P.ext } : {}) };
  while (len % 4) { chunks.push(Buffer.alloc(1)); len++; }
  const bin = Buffer.concat(chunks); json.buffers = [{ byteLength: bin.length }];
  let js = Buffer.from(JSON.stringify(json)); js = Buffer.concat([js, Buffer.alloc((4 - js.length % 4) % 4, 0x20)]);
  const pad = Buffer.alloc(P.padBytes || 0);
  const binAll = Buffer.concat([bin, pad]); json.buffers[0].byteLength = binAll.length;
  js = Buffer.from(JSON.stringify(json)); js = Buffer.concat([js, Buffer.alloc((4 - js.length % 4) % 4, 0x20)]);
  const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + binAll.length, 8);
  const ch = (type, data) => { const h = Buffer.alloc(8); h.writeUInt32LE(data.length, 0); h.writeUInt32LE(type, 4); return Buffer.concat([h, data]); };
  return Buffer.concat([head, ch(0x4e4f534a, js), ch(0x004e4942, binAll)]);
}
const run = (o) => checkGlb(makeGlb(o), SPECS.tokabah);
const level = (res, id) => res.results.filter(r => r.id === id).map(r => r.level);
const fails = (res) => res.results.filter(r => r.level === 'FAIL').map(r => r.id);

const tests = []; const test = (name, fn) => tests.push([name, fn]);

test('a model that meets the spec is READY with no failures', () => {
  const r = run(); assert.equal(r.ok, true, JSON.stringify(fails(r))); assert.deepEqual(fails(r), []);
  assert.equal(r.stats.triangles, 8000); assert.equal(r.stats.joints, 40); assert.deepEqual(r.stats.clips, ['idle', 'walk', 'talk', 'sit']);
});
test('not a GLB file → FAIL', () => { const r = checkGlb(Buffer.from('{"asset":{"version":"2.0"}}')); assert.equal(r.ok, false); assert.deepEqual(fails(r), ['format']); });

test('triangles: ≤10k pass, 10k–15k warn, >15k fail', () => {
  assert.deepEqual(level(run({ tris: 10000 }), 'triangles'), ['PASS']);
  assert.deepEqual(level(run({ tris: 12000 }), 'triangles'), ['WARN']);
  assert.deepEqual(level(run({ tris: 15002 }), 'triangles'), ['FAIL']);
});
test('file size: >1.5 MB warn, >2.5 MB fail', () => {
  assert.deepEqual(level(run({ padBytes: 1.7 * 1048576 }), 'file-size'), ['WARN']);
  assert.deepEqual(level(run({ padBytes: 2.6 * 1048576 }), 'file-size'), ['FAIL']);
});
test('draw calls and materials: >3 warn, >4 fail', () => {
  assert.deepEqual(level(run({ prims: 4, materials: 4 }), 'draw-calls'), ['WARN']);
  assert.deepEqual(level(run({ prims: 5, materials: 5 }), 'materials'), ['FAIL']);
});

test('rig: unrigged model fails', () => { const r = run({ noSkin: true }); assert.ok(fails(r).includes('rig')); });
test('rig: too few (<15) or too many (>65) joints fail; 61–65 warns', () => {
  assert.deepEqual(level(run({ joints: 10 }), 'rig'), ['FAIL']);
  assert.deepEqual(level(run({ joints: 70 }), 'rig'), ['FAIL']);
  assert.deepEqual(level(run({ joints: 63 }), 'rig'), ['WARN']);
});
test('rig: more than 4 bone influences per vertex fails', () => { assert.deepEqual(level(run({ joints1: true }), 'influences'), ['FAIL']); });

test('clips: each of idle, walk, talk, sit is required', () => {
  for (const c of ['idle', 'walk', 'talk', 'sit']) { const clips = { idle: [4, 0], walk: [1, 0], talk: [3, 0], sit: [4, 0] }; delete clips[c]; assert.ok(fails(run({ clips })).includes('clip:' + c), c); }
});
test('clips: wrong case or Mixamo-style names fail with a rename hint', () => {
  const r = run({ clips: { Idle: [4, 0], 'mixamo.com|Walk': [1, 0], talk: [3, 0], sit: [4, 0] } });
  const idle = r.results.find(x => x.id === 'clip:idle'), walk = r.results.find(x => x.id === 'clip:walk');
  assert.equal(idle.level, 'FAIL'); assert.match(idle.msg, /rename it to exactly "idle"/);
  assert.equal(walk.level, 'FAIL'); assert.match(walk.msg, /mixamo\.com\|Walk/);
});
test('clips: optional sit_down / stand_up / wave are fine; unknown extra clips warn; duplicates fail', () => {
  const ok = run({ clips: { idle: [4, 0], walk: [1, 0], talk: [3, 0], sit: [4, 0], sit_down: [1, 0], stand_up: [1, 0], wave: [2, 0] } });
  assert.equal(ok.ok, true); assert.equal(ok.results.some(x => x.id === 'clips'), false);
  assert.deepEqual(level(run({ clips: { idle: [4, 0], walk: [1, 0], talk: [3, 0], sit: [4, 0], dance: [3, 0] } }), 'clips'), ['WARN']);
});
test('clips: lengths outside the expected range warn', () => { assert.deepEqual(level(run({ clips: { idle: [4, 0], walk: [5, 0], talk: [3, 0], sit: [4, 0] } }), 'clip:walk'), ['WARN']); });
test('clips: root motion (walk travels 1.2 m) fails; in-place passes', () => {
  const r = run({ clips: { idle: [4, 0], walk: [1, 1.2], talk: [3, 0], sit: [4, 0] } });
  assert.ok(fails(r).includes('in-place:walk'));
  assert.equal(fails(run()).includes('in-place:walk'), false);
});
test('clips: root motion is measured in metres even under a 0.01 armature scale (FBX export)', () => {
  assert.ok(fails(run({ scale: 0.01, clips: { idle: [4, 0], walk: [1, 0.8], talk: [3, 0], sit: [4, 0] } })).includes('in-place:walk'));
  assert.equal(run({ scale: 0.01 }).ok, true, 'a correctly scaled FBX-style export still passes');
});

test('size: height must be 1.55–1.85 m; centimetre exports (168 m) fail', () => {
  assert.deepEqual(level(run({ height: 1.68 }), 'height'), ['PASS']);
  assert.deepEqual(level(run({ height: 1.2 }), 'height'), ['FAIL']);
  assert.deepEqual(level(run({ height: 168, width: 50, depth: 30 }), 'height'), ['FAIL']);
});
test('size: a model lying down (Z-up export) fails; a T-pose (arms as wide as height) passes', () => {
  assert.deepEqual(level(run({ height: 0.3, depth: 1.7 }), 'y-up'), ['FAIL']);
  assert.deepEqual(level(run({ width: 1.75 }), 'y-up'), ['PASS']);
});
test('origin: feet below/above the ground or off-centre warn', () => {
  assert.deepEqual(level(run({ minY: -0.85 }), 'origin-feet'), ['WARN']);
  assert.deepEqual(level(run({ offsetX: 0.6 }), 'origin-centre'), ['WARN']);
});

test('textures: 1024 pass, 2048 warn, 4096 fail; more than 4 images fail', () => {
  assert.deepEqual(level(run({ images: [png(1024, 1024)] }), 'texture-size'), ['PASS']);
  assert.deepEqual(level(run({ images: [png(2048, 2048)] }), 'texture-size'), ['WARN']);
  assert.deepEqual(level(run({ images: [png(4096, 4096)] }), 'texture-size'), ['FAIL']);
  assert.deepEqual(level(run({ images: [1, 2, 3, 4, 5].map(() => png(256, 256)) }), 'texture-count'), ['FAIL']);
});
test('textures: GPU memory over 16 MB fails (e.g. four 2048² maps)', () => {
  assert.deepEqual(level(run({ images: [1, 2, 3, 4].map(() => png(2048, 2048)) }), 'texture-memory'), ['FAIL']);
  assert.deepEqual(level(run({ images: [png(1024, 1024), png(1024, 1024), png(512, 512)] }), 'texture-memory'), ['PASS']);
});
test('textures: external (not embedded) images fail', () => { assert.ok(fails(run({ externalImage: true })).includes('embedded')); });
test('image headers: PNG, JPEG and WebP sizes are read correctly', () => {
  assert.deepEqual(imageSize(png(512, 256)), { type: 'png', w: 512, h: 256 });
  assert.deepEqual(imageSize(jpeg(1024, 768)), { type: 'jpeg', w: 1024, h: 768 });
  assert.deepEqual(imageSize(webp(2048, 1024)), { type: 'webp', w: 2048, h: 1024 });
});

test('compression the game cannot decode (Draco, Meshopt, KTX2) fails', () => {
  for (const e of ['KHR_draco_mesh_compression', 'EXT_meshopt_compression', 'KHR_texture_basisu']) assert.deepEqual(level(run({ ext: [e] }), 'extensions'), ['FAIL'], e);
  assert.deepEqual(level(run({ ext: ['KHR_texture_transform', 'EXT_texture_webp'] }), 'extensions'), ['PASS']);
});
test('staticNpc profile: an unrigged model with no clips passes; size and texture limits still apply', () => {
  const st = (o) => checkGlb(makeGlb(o), SPECS.staticNpc);
  const r = st({ noSkin: true, clips: {} });
  assert.equal(r.ok, true, JSON.stringify(fails(r))); assert.deepEqual(level(r, 'rig'), ['PASS']);
  assert.deepEqual(level(st({ noSkin: true, clips: {}, height: 1 }), 'height'), ['WARN'], 'normalised height is a warning, the game scales it');
  assert.deepEqual(level(st({ noSkin: true, clips: {}, height: 1.68 }), 'height'), ['PASS']);
  assert.ok(fails(st({ noSkin: true, clips: {}, images: [png(4096, 4096)] })).includes('texture-size'));
  assert.ok(fails(st({ noSkin: true, clips: {}, tris: 16000 })).includes('triangles'));
  assert.ok(fails(st({ noSkin: true, clips: {}, padBytes: 2.6 * 1048576 })).includes('file-size'));
  assert.equal(run({ noSkin: true, clips: {} }).ok, false, 'the Tok Abah profile still requires a rig and clips');
});
test('many morph targets warn (prefer a jaw bone)', () => { assert.deepEqual(level(run({ morphs: 12 }), 'morph-targets'), ['WARN']); });

let fail = 0;
for (const [name, fn] of tests) { try { await fn(); console.log('PASS', name); } catch (e) { fail++; console.log('FAIL', name, '\n   ', e.message.split('\n')[0]); } }
console.log(`\n${tests.length - fail}/${tests.length} passed`);
process.exit(fail ? 1 : 0);
