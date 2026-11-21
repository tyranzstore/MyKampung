// GLB pack indexer, packAsset validation and the legacy-pack exclusion. Run: node test/packs/packs.test.mjs
// Builds throw-away packs in a temp folder from GLBs already in the repo (nothing in assets/ is changed).
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { buildIndex, legacyKeys, stringify } from '../../tools/index_packs.mjs';
import { checkGlb, parseGlb, SPECS } from '../../tools/check_glb.mjs';

const ROOT = new URL('../..', import.meta.url).pathname, A = (p) => join(ROOT, 'assets', p);
const tmp = mkdtempSync(join(tmpdir(), 'mkpacks-')), packs = join(tmp, 'packs');
const put = (rel, src) => { const p = join(packs, rel); mkdirSync(join(p, '..'), { recursive: true }); src.startsWith?.('/') ? copyFileSync(src, p) : writeFileSync(p, src); }; // a path copies a repo file, anything else is written as content
// a GLB that asks for Draco: same file with "extensionsRequired" added to its JSON chunk
function withDraco(buf) {
  const { json, bin } = parseGlb(buf); json.extensionsUsed = ['KHR_draco_mesh_compression']; json.extensionsRequired = ['KHR_draco_mesh_compression'];
  let j = Buffer.from(JSON.stringify(json)); j = Buffer.concat([j, Buffer.alloc((4 - j.length % 4) % 4, 0x20)]);
  const b = bin ? Buffer.concat([bin, Buffer.alloc((4 - bin.length % 4) % 4)]) : null, len = 12 + 8 + j.length + (b ? 8 + b.length : 0), out = Buffer.alloc(len);
  out.writeUInt32LE(0x46546c67, 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(len, 8); out.writeUInt32LE(j.length, 12); out.writeUInt32LE(0x4e4f534a, 16); j.copy(out, 20);
  if (b) { out.writeUInt32LE(b.length, 20 + j.length); out.writeUInt32LE(0x004e4942, 24 + j.length); b.copy(out, 28 + j.length); }
  return out;
}
put('demo/sedan.glb', A('cars/sedan.glb')); put('demo/Textures/colormap.png', A('cars/Textures/colormap.png')); // external texture, kept as exported
put('demo/props/bench.glb', A('kaykit/bench.glb')); put('demo/props/citybits_texture.png', A('kaykit/citybits_texture.png'));
put('demo/hero.glb', A('tyranz/Hero.glb'));
put('demo/pack.json', JSON.stringify({ name: 'Demo', category: 'vehicles', models: { 'props/bench': { id: 'demo/bench', scale: 2, rotation: [0, 90, 0] } } }));
put('broken/nofile.glb', A('kaykit/bench.glb'));                         // its texture is missing
put('broken/draco.glb', withDraco(readFileSync(A('tyranz/Hero.glb'))));   // compression the game cannot decode
put('broken/notglb.glb', Buffer.from('hello'));
put('city/Car.glb', A('tyranz/Hero.glb'));                                // id "city/Car" is a legacy key (models2.json)
put('dupe/x.glb', A('tyranz/Hero.glb')); put('dupe/pack.json', JSON.stringify({ models: { x: { id: 'DEMO/sedan' } } })); // case-insensitive clash
put('bad name/y.glb', A('tyranz/Hero.glb'));

const legacy = await legacyKeys(ROOT);
const { index, problems } = buildIndex(packs, { legacy });
const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('legacy keys are read from MODEL_FILES and models2.json (nothing repacked)', () => {
  assert.ok(legacy.has('palm1') && legacy.has('hero') && legacy.has('city/Car')); assert.ok(legacy.size >= 250, String(legacy.size));
});
test('models get unique ids, paths, categories, sizes, deps and pack.json metadata', () => {
  const d = index.packs.demo; assert.equal(d.name, 'Demo');
  assert.deepEqual(Object.keys(d.models).sort(), ['demo/bench', 'demo/hero', 'demo/sedan']);
  const s = d.models['demo/sedan'];
  assert.equal(s.path, 'assets/packs/demo/sedan.glb'); assert.equal(s.category, 'vehicles'); assert.equal(s.bytes, readFileSync(A('cars/sedan.glb')).length);
  assert.deepEqual(s.deps, ['Textures/colormap.png']); assert.equal(s.valid, true);
  const b = d.models['demo/bench']; assert.equal(b.category, 'props'); assert.equal(b.scale, 2); assert.deepEqual(b.rotation, [0, 90, 0]); assert.equal(b.valid, true);
});
test('a missing external texture, Draco and a non-GLB file fail validation but stay listed (valid: false)', () => {
  const m = index.packs.broken.models;
  assert.equal(m['broken/nofile'].valid, false); assert.match(m['broken/nofile'].problems.join(), /missing external file/);
  assert.equal(m['broken/draco'].valid, false); assert.match(m['broken/draco'].problems.join(), /Draco/);
  assert.equal(m['broken/notglb'].valid, false);
});
test('collisions with legacy keys and between packs (any case) are refused', () => {
  assert.equal(index.packs.city.models['city/Car'].valid, false); assert.match(index.packs.city.models['city/Car'].problems.join(), /legacy/);
  assert.equal(index.packs.dupe.models['DEMO/sedan'].valid, false); assert.match(index.packs.dupe.models['DEMO/sedan'].problems.join(), /collides/);
  assert.ok(!index.packs['bad name']); assert.ok(problems.some((p) => p.startsWith('bad name')));
});
test('output is deterministic (no timestamps), so CI only commits real changes', () => {
  assert.equal(stringify(buildIndex(packs, { legacy }).index), stringify(index));
});
test('packAsset profile: any shape, external files allowed when present; other profiles unchanged', () => {
  const sedan = readFileSync(A('cars/sedan.glb')), dir = A('cars');
  assert.equal(checkGlb(sedan, SPECS.packAsset, { resolve: (u) => readFileSync(join(dir, u)) }).ok, true);
  assert.equal(checkGlb(sedan, SPECS.packAsset).ok, false, 'no resolver: the texture counts as missing');
  assert.equal(checkGlb(sedan, SPECS.staticNpc).results.find((r) => r.id === 'embedded').level, 'FAIL', 'NPC profiles still require embedded data');
});
test('CLI: --check fails when the index is stale and passes once written; --strict fails on problems', () => {
  const out = join(tmp, 'index.json'), cli = join(ROOT, 'tools/index_packs.mjs'), run = (...a) => spawnSync('node', [cli, '--dir', packs, '--out', out, ...a], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(run('--check').status, 1); assert.equal(run().status, 0); assert.equal(run('--check').status, 0); assert.equal(run('--strict').status, 1);
  assert.deepEqual(JSON.parse(readFileSync(out, 'utf8')), index);
});
test('the committed assets/packs/index.json is up to date', () => {
  assert.equal(spawnSync('node', [join(ROOT, 'tools/index_packs.mjs'), '--check'], { cwd: ROOT, encoding: 'utf8' }).status, 0);
});
test('build_models.py skips assets/packs and keeps its output for everything else', () => {
  const py = spawnSync('python3', ['--version']); if (py.status !== 0) return console.log('  (python3 not found: skipped)');
  const w = join(tmp, 'legacy'); mkdirSync(join(w, 'assets/nature'), { recursive: true }); mkdirSync(join(w, 'assets/packs/demo'), { recursive: true }); mkdirSync(join(w, 'assets/packsX'), { recursive: true });
  writeFileSync(join(w, 'assets/nature/Tree.glb'), 'A'); writeFileSync(join(w, 'assets/packs/demo/x.glb'), 'B'); writeFileSync(join(w, 'assets/packs/index.json'), '{}'); writeFileSync(join(w, 'assets/packsX/y.glb'), 'C');
  execFileSync('python3', ['-I', join(ROOT, 'tools/build_models.py')], { cwd: w });
  assert.equal(readFileSync(join(w, 'assets/models.json'), 'utf8'), '{"nature/Tree":"QQ==","packsX/y":"Qw=="}');
});

let pass = 0;
for (const [name, fn] of tests) { try { await fn(); pass++; console.log('PASS', name); } catch (e) { console.log('FAIL', name, '\n ', e.message); process.exitCode = 1; } }
rmSync(tmp, { recursive: true, force: true });
console.log(`\n${pass}/${tests.length} passed`);
