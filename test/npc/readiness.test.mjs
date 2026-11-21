// Tok Abah integration-readiness checks: run with `node test/npc/readiness.test.mjs` from the project root.
// Safe to run before the new model exists: it then reports "waiting for asset" and checks that nothing uses it yet.
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { checkGlb, SPECS } from '../../tools/check_glb.mjs';

const ASSET = 'assets/tyranz/TokAbah.glb';
const src = (f) => readFileSync(f, 'utf8');
const jsFiles = readdirSync('js').filter(f => f.endsWith('.js')).map(f => join('js', f));
const tests = []; const test = (name, fn) => tests.push([name, fn]);
const notes = [];

test('TokAbah.glb: validated if supplied, otherwise reported as waiting', () => {
  if (!existsSync(ASSET)) { notes.push(`${ASSET} not supplied yet — waiting for the asset (current Tok Abah stays)`); return; }
  const r = checkGlb(readFileSync(ASSET), SPECS.tokabah);
  const f = r.results.filter(x => x.level === 'FAIL').map(x => `${x.id}: ${x.msg}`);
  assert.equal(r.ok, true, `TokAbah.glb is not ready:\n  ${f.join('\n  ')}`);
  notes.push(`${ASSET} passes the validator (${r.stats.triangles} tris, ${r.stats.joints} joints, ${r.stats.fileMB} MB)`);
});

test('the game does not load TokAbah.glb before a validated file exists', () => {
  const users = jsFiles.filter(f => /TokAbah(\.glb)?['"`]/.test(src(f)) || /tyranz\/TokAbah/.test(src(f)));
  if (!users.length) return;
  assert.ok(existsSync(ASSET), `${users.join(', ')} reference TokAbah.glb but ${ASSET} is missing`);
  assert.equal(checkGlb(readFileSync(ASSET), SPECS.tokabah).ok, true, `${users.join(', ')} reference TokAbah.glb but it fails validation`);
});

test('the current Tok Abah is still in the game (2D and 3D) and the story still talks to him', () => {
  assert.match(src('js/town.js'), /abah:\s*\{\s*name:\s*'Tok Abah'/);
  assert.match(src('js/town3d.js'), /NPCS3D = \{[\s\S]*?abah:\s*\{/);
  assert.match(src('js/town3d.js'), /function makePerson\(/);
  const main = src('js/main.js');
  assert.match(main, /async function talk\(id\)/);
  assert.ok((main.match(/id === 'abah'/g) || []).length >= 5, 'Tok Abah story branches in talk()');
});

test('the integration points Phase 1 will use still exist', () => {
  const models = src('js/models.js'), town = src('js/town3d.js'), main = src('js/main.js');
  for (const fn of ['loadModels', 'putModel', 'putAnimated']) assert.match(models, new RegExp(`export (async )?function ${fn}\\(`), `models.js exports ${fn}`);
  assert.match(models, /AnimationMixer/); assert.match(models, /SkeletonUtils/);
  assert.match(town, /npcs\[id\] = p/, 'town3d keeps NPCs in npcs{}');
  assert.match(town, /userData\.npc = id/, 'NPC tap detection uses userData.npc');
  assert.match(town, /function updateLife\(dt\)/, 'per-frame animation hook');
  assert.match(main, /if \(hit\.type === 'npc'\) return talk\(hit\.id\)/, 'tap-to-talk (must be preserved)');
});

test('the spec matches the loader: three r170 with no Draco / Meshopt / KTX2 decoders', () => {
  assert.match(src('index.html'), /three@0\.170\.0/, 'three.js version in the import map');
  const all = jsFiles.map(src).join('\n');
  for (const dec of ['DRACOLoader', 'KTX2Loader', 'MeshoptDecoder', 'setDRACOLoader', 'setKTX2Loader', 'setMeshoptDecoder'])
    assert.equal(all.includes(dec), false, `${dec} is now used — update bannedExtensions in tools/check_glb.mjs`);
  assert.deepEqual(SPECS.tokabah.bannedExtensions.sort(), ['EXT_meshopt_compression', 'KHR_draco_mesh_compression', 'KHR_texture_basisu']);
});

test('the validator reads every GLB already in the repo without crashing', () => {
  const glbs = []; const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (f.endsWith('.glb')) glbs.push(p); } }; walk('assets');
  assert.ok(glbs.length > 50, `found ${glbs.length} GLB files`);
  for (const g of glbs) { const r = checkGlb(readFileSync(g), SPECS.npc); assert.ok(Array.isArray(r.results) && r.results.length > 5, g); assert.equal(r.results.some(x => x.id === 'format'), false, `${g} could not be parsed`); }
  notes.push(`validator read ${glbs.length} existing GLB files`);
});

test('the validator rejects the current static hero as a Tok Abah model (no rig, no clips)', () => {
  const r = checkGlb(readFileSync('assets/tyranz/Hero.glb'), SPECS.tokabah), f = r.results.filter(x => x.level === 'FAIL').map(x => x.id);
  assert.equal(r.ok, false);
  for (const id of ['rig', 'clip:idle', 'clip:walk', 'clip:talk', 'clip:sit']) assert.ok(f.includes(id), id);
});

test('canonical NPC names: matches are present; differences are reported, not renamed', () => {
  const canonical = ['Tok Abah', 'Nek Ma', 'Pok Wan', 'Pok Ajis', 'Mok Ngoh', 'Mok Yah', 'Cikgu Eby', 'Yaya', 'Seola', 'Taeyang'];
  const names = [...src('js/town.js').matchAll(/(\w+):\s*\{\s*name:\s*'([^']+)'/g)].map(m => ({ id: m[1], name: m[2] }));
  for (const n of ['Tok Abah', 'Nek Ma', 'Pok Wan']) assert.ok(names.some(x => x.name === n), n);
  const missing = canonical.filter(c => !names.some(x => x.name === c)), extra = names.filter(x => !canonical.includes(x.name)).map(x => `${x.name} (${x.id})`);
  notes.push(`canonical names not in the game yet: ${missing.join(', ')}`);
  notes.push(`game names not in the canonical list: ${extra.join(', ')}`);
});

let fail = 0;
for (const [name, fn] of tests) { try { await fn(); console.log('PASS', name); } catch (e) { fail++; console.log('FAIL', name, '\n   ', e.message.split('\n').join('\n    ')); } }
if (notes.length) console.log('\nNotes:\n  - ' + notes.join('\n  - '));
console.log(`\n${tests.length - fail}/${tests.length} passed`);
process.exit(fail ? 1 : 0);
