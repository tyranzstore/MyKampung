#!/usr/bin/env node
// GLB validator for TYRANZ: Kampung Heroes characters. No dependencies (Node 18+).
//
//   node tools/check_glb.mjs assets/tyranz/TokAbah.glb            # human-readable report, exit 1 on FAIL
//   node tools/check_glb.mjs assets/tyranz/TokAbah.glb --json     # machine-readable
//   node tools/check_glb.mjs some.glb --profile npc               # another profile (see SPECS)
//
// It reads the binary glTF directly (no three.js), so it runs in CI and on any machine.
// It checks what can be checked automatically; facing direction and looks still need a manual check in the game.
// See docs/TOKABAH_GLB.md for the full asset spec given to the artist.
import { readFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

// ------------------------------------------------------------ specs (one place; the docs quote these numbers)
const NPC = {
  label: 'Semi-realistic village NPC (mobile)',
  fileTargetMB: 1.5, fileMaxMB: 2.5,
  trisTarget: 10000, trisMax: 15000,
  drawCallsTarget: 3, drawCallsMax: 4,          // mesh primitives = draw calls (before the shadow pass)
  materialsTarget: 3, materialsMax: 4,
  jointsMin: 15, jointsTarget: 60, jointsMax: 65,
  texTarget: 1024, texMax: 2048, imagesMax: 4,  // pixels on the longest side; number of images
  gpuTexTargetMB: 12, gpuTexMaxMB: 16,          // estimated GPU memory of all textures (RGBA8 + mipmaps)
  morphTargetsWarn: 8,
  heightMin: 1.55, heightMax: 1.85,             // metres, standing bind pose
  feetTolerance: 0.05, centreTolerance: 0.30,   // metres: lowest point at y≈0, model centred on the origin
  rootMotionMax: 0.10,                          // metres of horizontal root travel allowed inside any clip
  requiredClips: { idle: [2, 10], walk: [0.5, 2], talk: [2, 8], sit: [2, 10] }, // name: [min, max] seconds
  optionalClips: ['sit_down', 'stand_up', 'wave'],
  // three r170 GLTFLoader as set up in js/models.js has no Draco/Meshopt/KTX2 decoders
  bannedExtensions: ['KHR_draco_mesh_compression', 'EXT_meshopt_compression', 'KHR_texture_basisu'],
};
// staticNpc: a detailed but unrigged NPC (e.g. Pok Ajis, made in Tripo). Same size/texture/memory limits; no rig or
// clips required (the game never invents animations for it), and any height is accepted because the game scales it.
export const SPECS = {
  tokabah: { ...NPC, label: 'Tok Abah (semi-realistic NPC)' },
  npc: NPC,
  staticNpc: { ...NPC, label: 'Static village NPC (no rig, mobile)', requireRig: false, requiredClips: {}, heightAnyScale: true },
  // packAsset: any model in a GLB pack (assets/packs): props, buildings, vehicles, characters. Any shape and size (the game
  // normalises and scales), rig optional, any clip names, external textures/.bin allowed if the files exist next to it.
  packAsset: { ...NPC, label: 'GLB pack asset (mobile)', fileTargetMB: 2, fileMaxMB: 8, trisTarget: 20000, trisMax: 60000, drawCallsTarget: 10, drawCallsMax: 40,
    materialsTarget: 8, materialsMax: 24, imagesMax: 12, gpuTexTargetMB: 16, gpuTexMaxMB: 48, jointsMin: 1, jointsMax: 128, jointsTarget: 80,
    requireRig: false, requiredClips: {}, anyShape: true, anyClips: true, allowExternal: true },
};

// ------------------------------------------------------------ GLB container
export function parseGlb(buf) {
  if (buf.length < 20 || buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a binary glTF (.glb) file');
  if (buf.readUInt32LE(4) !== 2) throw new Error(`glTF version ${buf.readUInt32LE(4)} (need 2)`);
  let off = 12, json = null, bin = null;
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32LE(off), type = buf.readUInt32LE(off + 4), data = buf.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(data.toString('utf8').replace(/\0+$/, '').trimEnd());
    else if (type === 0x004e4942) bin = data;
    off += 8 + len;
  }
  if (!json) throw new Error('GLB has no JSON chunk');
  return { json, bin };
}

// ------------------------------------------------------------ small math (column-major 4x4, like glTF)
const I4 = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function mul(a, b) { const o = new Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; }
function trs(n) {
  if (n.matrix) return n.matrix.slice();
  const [x, y, z, w] = n.rotation || [0, 0, 0, 1], [sx, sy, sz] = n.scale || [1, 1, 1], [tx, ty, tz] = n.translation || [0, 0, 0];
  return [(1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
    2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0, tx, ty, tz, 1];
}
const apply = (m, [x, y, z]) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
const scaleOf = (m) => Math.cbrt(Math.abs(m[0] * (m[5] * m[10] - m[6] * m[9]) - m[4] * (m[1] * m[10] - m[2] * m[9]) + m[8] * (m[1] * m[6] - m[2] * m[5]))) || 1;

// ------------------------------------------------------------ accessors
const COMP = { 5120: [1, 'getInt8'], 5121: [1, 'getUint8'], 5122: [2, 'getInt16'], 5123: [2, 'getUint16'], 5125: [4, 'getUint32'], 5126: [4, 'getFloat32'] };
const NCOMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
function readAccessor(json, bin, i) {
  const a = json.accessors[i]; if (!a || a.bufferView === undefined || !bin) return null;
  const bv = json.bufferViews[a.bufferView], [size, fn] = COMP[a.componentType], n = NCOMP[a.type];
  const stride = bv.byteStride || size * n, base = (bv.byteOffset || 0) + (a.byteOffset || 0);
  const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength), out = [];
  for (let k = 0; k < a.count; k++) { const e = []; for (let c = 0; c < n; c++) e.push(dv[fn](base + k * stride + c * size, true)); out.push(e); }
  return out;
}

// ------------------------------------------------------------ image size from the file header (PNG / JPEG / WebP)
export function imageSize(b) {
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { type: 'png', w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    for (let o = 2; o + 9 < b.length;) { if (b[o] !== 0xff) { o++; continue; } const m = b[o + 1], L = b.readUInt16BE(o + 2);
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { type: 'jpeg', w: b.readUInt16BE(o + 7), h: b.readUInt16BE(o + 5) }; o += 2 + L; }
    return { type: 'jpeg', w: 0, h: 0 };
  }
  if (b.length >= 30 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const f = b.toString('ascii', 12, 16);
    if (f === 'VP8 ') return { type: 'webp', w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
    if (f === 'VP8L') { const v = b.readUInt32LE(21); return { type: 'webp', w: (v & 0x3fff) + 1, h: ((v >> 14) & 0x3fff) + 1 }; }
    if (f === 'VP8X') return { type: 'webp', w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
  }
  return { type: 'unknown', w: 0, h: 0 };
}

// ------------------------------------------------------------ the check
// opts.resolve(uri) -> Buffer|null reads an external file referenced by the GLB (packAsset); null = missing.
export function checkGlb(buf, spec = SPECS.tokabah, opts = {}) {
  const R = [], add = (level, id, msg) => R.push({ level, id, msg });
  const stats = { bytes: buf.length };
  let json, bin;
  try { ({ json, bin } = parseGlb(buf)); } catch (e) { add('FAIL', 'format', e.message); return { ok: false, results: R, stats }; }
  const nodes = json.nodes || [], meshes = json.meshes || [], skins = json.skins || [], anims = json.animations || [];

  // file size
  const mb = buf.length / 1048576; stats.fileMB = +mb.toFixed(2);
  add(mb > spec.fileMaxMB ? 'FAIL' : mb > spec.fileTargetMB ? 'WARN' : 'PASS', 'file-size', `${mb.toFixed(2)} MB (target ≤ ${spec.fileTargetMB} MB, max ${spec.fileMaxMB} MB)`);

  // extensions the game's loader cannot decode
  const used = json.extensionsUsed || [], req = json.extensionsRequired || [];
  const banned = [...new Set([...used, ...req])].filter(e => spec.bannedExtensions.includes(e));
  add(banned.length ? 'FAIL' : 'PASS', 'extensions', banned.length ? `unsupported compression: ${banned.join(', ')} — export without Draco/Meshopt/KTX2` : `ok${used.length ? ' (' + used.join(', ') + ')' : ''}`);

  // embedded resources only
  const external = [...(json.buffers || []).filter((b, i) => b.uri && !(i === 0 && !b.uri) && !b.uri.startsWith('data:')).map(b => b.uri), ...(json.images || []).filter(im => im.uri && !im.uri.startsWith('data:')).map(im => im.uri)];
  if (spec.allowExternal) { const missing = external.filter(u => !opts.resolve || !opts.resolve(u)); stats.external = external;
    add(missing.length ? 'FAIL' : 'PASS', 'embedded', missing.length ? `missing external file(s): ${missing.join(', ')}` : external.length ? `external files present: ${external.join(', ')}` : 'all data embedded'); }
  else add(external.length ? 'FAIL' : 'PASS', 'embedded', external.length ? `external files referenced: ${external.join(', ')} — embed everything in the .glb` : 'all data embedded');

  // world matrices
  const parent = new Array(nodes.length).fill(-1); nodes.forEach((n, i) => (n.children || []).forEach(c => { parent[c] = i; }));
  const world = new Array(nodes.length);
  const W = (i) => world[i] || (world[i] = parent[i] < 0 ? trs(nodes[i]) : mul(W(parent[i]), trs(nodes[i])));
  const depth = (i) => (parent[i] < 0 ? 0 : 1 + depth(parent[i]));

  // geometry: triangles, draw calls, morph targets, influences, bounds
  let tris = 0, prims = 0, morphs = 0, joints1 = false, skinnedPrims = 0;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  nodes.forEach((n, ni) => {
    if (n.mesh === undefined) return; const mesh = meshes[n.mesh]; if (!mesh) return;
    let M = W(ni);
    if (n.skin !== undefined && skins[n.skin]) { // skinned: bind-shape = jointWorld · inverseBind (identical for every joint in bind pose)
      const sk = skins[n.skin], j0 = sk.joints[0], ibm = sk.inverseBindMatrices !== undefined ? readAccessor(json, bin, sk.inverseBindMatrices) : null;
      M = ibm ? mul(W(j0), ibm[0]) : W(j0);
    }
    for (const p of mesh.primitives) {
      prims++; const mode = p.mode ?? 4, pa = json.accessors[p.attributes.POSITION];
      const count = p.indices !== undefined ? json.accessors[p.indices].count : pa.count;
      tris += mode === 4 ? Math.floor(count / 3) : (mode === 5 || mode === 6) ? Math.max(0, count - 2) : 0;
      morphs = Math.max(morphs, (p.targets || []).length);
      if (p.attributes.JOINTS_1 !== undefined) joints1 = true;
      if (p.attributes.JOINTS_0 !== undefined && p.attributes.WEIGHTS_0 !== undefined && n.skin !== undefined) skinnedPrims++;
      if (pa.min && pa.max) for (const cx of [pa.min[0], pa.max[0]]) for (const cy of [pa.min[1], pa.max[1]]) for (const cz of [pa.min[2], pa.max[2]]) {
        const v = apply(M, [cx, cy, cz]); for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], v[k]); hi[k] = Math.max(hi[k], v[k]); } }
    }
  });
  Object.assign(stats, { triangles: tris, drawCalls: prims, morphTargets: morphs });
  add(tris > spec.trisMax ? 'FAIL' : tris > spec.trisTarget ? 'WARN' : tris === 0 ? 'FAIL' : 'PASS', 'triangles', `${tris.toLocaleString('en')} (target ≤ ${spec.trisTarget.toLocaleString('en')}, max ${spec.trisMax.toLocaleString('en')})`);
  add(prims > spec.drawCallsMax ? 'FAIL' : prims > spec.drawCallsTarget ? 'WARN' : 'PASS', 'draw-calls', `${prims} mesh primitive(s) (target ≤ ${spec.drawCallsTarget}, max ${spec.drawCallsMax})`);
  const mats = (json.materials || []).length; stats.materials = mats;
  add(mats > spec.materialsMax ? 'FAIL' : mats > spec.materialsTarget ? 'WARN' : 'PASS', 'materials', `${mats} (target ≤ ${spec.materialsTarget}, max ${spec.materialsMax})`);
  if (morphs > spec.morphTargetsWarn) add('WARN', 'morph-targets', `${morphs} morph targets on one mesh — costly on phones; prefer a jaw bone for talking`);

  // dimensions: Y-up, metres, feet on the ground, centred
  if (lo[0] !== Infinity) {
    const size = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]]; stats.size = size.map(v => +v.toFixed(3));
    // upright: taller than deep, and not much narrower than tall (a T-pose arm span is about the body height)
    if (spec.anyShape) add(size.every(v => v >= 0) && Math.max(...size) > 0 ? 'PASS' : 'FAIL', 'size', `${stats.size.join(' × ')} units (the game normalises and scales it)`);
    else {
    const up = size[1] > size[2] * 1.5 && size[1] >= size[0] * 0.8;
    add(up ? 'PASS' : 'FAIL', 'y-up', up ? 'standing upright (Y-up)' : `model is lying down or not Y-up (size x/y/z = ${stats.size.join(' / ')} m)`);
    const metres = size[1] >= spec.heightMin && size[1] <= spec.heightMax;
    if (spec.heightAnyScale) add(size[1] > 0 && metres ? 'PASS' : size[1] > 0 ? 'WARN' : 'FAIL', 'height', `${size[1].toFixed(2)} units${metres ? ' (metres)' : ' — not in metres; the game must set his height in code'}`);
    else add(metres ? 'PASS' : 'FAIL', 'height', `${size[1].toFixed(2)} m (need ${spec.heightMin}–${spec.heightMax} m; export in metres)`);
    add(Math.abs(lo[1]) > spec.feetTolerance ? 'WARN' : 'PASS', 'origin-feet', `lowest point y = ${lo[1].toFixed(3)} m (origin should be at the feet)`);
    const cx = (lo[0] + hi[0]) / 2, cz = (lo[2] + hi[2]) / 2;
    add(Math.hypot(cx, cz) > spec.centreTolerance ? 'WARN' : 'PASS', 'origin-centre', `centre x/z = ${cx.toFixed(2)} / ${cz.toFixed(2)} m (should be about 0 / 0)`);
    }
  } else add('FAIL', 'height', 'could not measure the model (POSITION min/max missing)');

  // rig
  const jointSet = new Set(skins.flatMap(s => s.joints)); stats.joints = jointSet.size; stats.skins = skins.length;
  if ((!skins.length || !skinnedPrims) && spec.requireRig === false) add('PASS', 'rig', 'static model (no rig required; no animations will be played)');
  else if (!skins.length || !skinnedPrims) add('FAIL', 'rig', 'no skinned mesh — the character must be rigged (skin with JOINTS_0 / WEIGHTS_0)');
  else {
    const j = jointSet.size;
    add(j > spec.jointsMax || j < spec.jointsMin ? 'FAIL' : j > spec.jointsTarget ? 'WARN' : 'PASS', 'rig', `${skins.length} skin, ${j} joints (need ${spec.jointsMin}–${spec.jointsMax}, target ≤ ${spec.jointsTarget})`);
    add(joints1 ? 'FAIL' : 'PASS', 'influences', joints1 ? 'more than 4 bone influences per vertex (JOINTS_1) — limit to 4' : 'max 4 bone influences per vertex');
  }

  // textures
  const imgs = (json.images || []).map((im, i) => {
    let b = null;
    if (im.bufferView !== undefined && bin) { const bv = json.bufferViews[im.bufferView]; b = bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength); }
    else if (im.uri && im.uri.startsWith('data:')) b = Buffer.from(im.uri.split(',')[1] || '', 'base64');
    else if (im.uri && spec.allowExternal && opts.resolve) b = opts.resolve(im.uri);
    return { i, name: im.name || `image ${i}`, ...(b ? imageSize(b) : { type: 'external', w: 0, h: 0 }) };
  });
  stats.textures = imgs.map(t => `${t.name} ${t.w}×${t.h} ${t.type}`);
  const gpu = imgs.reduce((s, t) => s + t.w * t.h * 4 * 4 / 3, 0) / 1048576; stats.gpuTextureMB = +gpu.toFixed(1);
  add(imgs.length > spec.imagesMax ? 'FAIL' : 'PASS', 'texture-count', `${imgs.length} image(s) (max ${spec.imagesMax})`);
  for (const t of imgs) {
    const big = Math.max(t.w, t.h), pot = (v) => v > 0 && (v & (v - 1)) === 0;
    if (t.type === 'unknown' || t.type === 'external') add('FAIL', 'texture-format', `${t.name}: ${t.type} image (use PNG, JPEG or WebP, embedded)`);
    else if (big > spec.texMax) add('FAIL', 'texture-size', `${t.name}: ${t.w}×${t.h} (max ${spec.texMax})`);
    else if (big > spec.texTarget) add('WARN', 'texture-size', `${t.name}: ${t.w}×${t.h} (target ≤ ${spec.texTarget})`);
    else add(pot(t.w) && pot(t.h) ? 'PASS' : 'WARN', 'texture-size', `${t.name}: ${t.w}×${t.h} ${t.type}${pot(t.w) && pot(t.h) ? '' : ' (not a power of two)'}`);
  }
  add(gpu > spec.gpuTexMaxMB ? 'FAIL' : gpu > spec.gpuTexTargetMB ? 'WARN' : 'PASS', 'texture-memory', `≈ ${gpu.toFixed(1)} MB on the GPU (target ≤ ${spec.gpuTexTargetMB} MB, max ${spec.gpuTexMaxMB} MB)`);

  // animations: exact names, lengths, in place
  const names = anims.map(a => a.name || ''); stats.clips = names;
  const dup = names.filter((n, i) => names.indexOf(n) !== i);
  if (dup.length) add('FAIL', 'clips', `duplicate clip names: ${[...new Set(dup)].join(', ')}`);
  const rootJoint = [...jointSet].sort((a, b) => depth(a) - depth(b))[0];
  for (const [want, [tMin, tMax]] of Object.entries(spec.requiredClips)) {
    const a = anims.find(x => x.name === want);
    if (!a) { const near = names.find(n => n.toLowerCase().replace(/[^a-z_]/g, '').includes(want)); add('FAIL', `clip:${want}`, `missing clip "${want}"${near ? ` (found "${near}" — rename it to exactly "${want}")` : ''}`); continue; }
    let dur = 0; for (const s of a.samplers) { const inp = json.accessors[s.input]; dur = Math.max(dur, inp.max ? inp.max[0] : 0); }
    add(dur < tMin || dur > tMax ? 'WARN' : 'PASS', `clip:${want}`, `${dur.toFixed(2)} s${dur < tMin || dur > tMax ? ` (expected ${tMin}–${tMax} s)` : ''}`);
    // in place: the top-most animated joint may not travel sideways
    const ch = a.channels.filter(c => c.target.path === 'translation' && c.target.node !== undefined && (jointSet.has(c.target.node) || c.target.node === rootJoint))
      .sort((p, q) => depth(p.target.node) - depth(q.target.node))[0];
    if (ch) { const v = readAccessor(json, bin, a.samplers[ch.sampler].output) || []; const k = parent[ch.target.node] >= 0 ? scaleOf(W(parent[ch.target.node])) : 1;
      const rx = v.length ? (Math.max(...v.map(p => p[0])) - Math.min(...v.map(p => p[0]))) * k : 0, rz = v.length ? (Math.max(...v.map(p => p[2])) - Math.min(...v.map(p => p[2]))) * k : 0;
      if (Math.max(rx, rz) > spec.rootMotionMax) add('FAIL', `in-place:${want}`, `"${want}" moves the root ${Math.max(rx, rz).toFixed(2)} m sideways — export it in place (no root motion)`); }
  }
  const extra = names.filter(n => !(n in spec.requiredClips) && !spec.optionalClips.includes(n));
  if (extra.length && !spec.anyClips) add('WARN', 'clips', `extra clips not used by the game: ${extra.join(', ')}`);

  // tidy file
  if ((json.cameras || []).length || (json.extensions && json.extensions.KHR_lights_punctual)) add('WARN', 'extras', 'file contains cameras or lights — remove them');
  if ((json.scenes || []).length > 1) add('WARN', 'extras', `${json.scenes.length} scenes — export one`);

  return { ok: !R.some(r => r.level === 'FAIL'), results: R, stats };
}

// ------------------------------------------------------------ CLI
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const args = process.argv.slice(2), pi = args.indexOf('--profile'), profile = pi >= 0 ? args[pi + 1] : 'tokabah', file = args.find((a, i) => !a.startsWith('--') && i !== pi + 1);
  if (!file) { console.log(`usage: node tools/check_glb.mjs <file.glb> [--profile ${Object.keys(SPECS).join('|')}] [--json]`); process.exit(2); }
  if (!existsSync(file)) { console.log(`not found: ${file}`); process.exit(2); }
  if (!SPECS[profile]) { console.log(`unknown profile "${profile}" (have: ${Object.keys(SPECS).join(', ')})`); process.exit(2); }
  const dir = dirname(file), res = checkGlb(readFileSync(file), SPECS[profile], { resolve: (u) => { const f = join(dir, decodeURIComponent(u)); return existsSync(f) ? readFileSync(f) : null; } });
  if (args.includes('--json')) console.log(JSON.stringify({ file, profile, ...res }, null, 1));
  else {
    console.log(`\n${file} — ${SPECS[profile].label}\n`);
    for (const r of res.results) console.log(`  ${r.level === 'PASS' ? 'PASS' : r.level === 'WARN' ? 'WARN' : 'FAIL'}  ${r.id.padEnd(16)} ${r.msg}`);
    const f = res.results.filter(r => r.level === 'FAIL').length, w = res.results.filter(r => r.level === 'WARN').length;
    console.log(`\n${res.ok ? 'READY' : 'NOT READY'} — ${f} fail, ${w} warning(s). Facing (+Z), look and animation quality still need a check in the game.\n`);
  }
  process.exit(res.ok ? 0 : 1);
}
