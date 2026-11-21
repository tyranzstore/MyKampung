// Runtime check of js/models.js GLB packs in a real browser (Chromium via Playwright). Local only: needs Playwright and a
// three@0.170.0 package folder (the game loads three from a CDN; this serves it locally instead).
//   THREE_DIR=/path/to/node_modules/three node test/packs/browser.check.mjs
// Skips (exit 0) when Playwright or THREE_DIR is missing, so it is safe to run anywhere.
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { buildIndex, legacyKeys } from '../../tools/index_packs.mjs';

const ROOT = new URL('../..', import.meta.url).pathname, THREE = process.env.THREE_DIR;
let chromium; try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch { try { ({ chromium } = await import('playwright')); } catch {} }
if (!chromium || !THREE || !existsSync(join(THREE, 'build/three.module.js'))) { console.log('SKIP: needs Playwright and THREE_DIR (three@0.170.0)'); process.exit(0); }

// fixture packs (same kind as packs.test.mjs) plus a hand-made entry that collides with the legacy key "palm1"
const tmp = mkdtempSync(join(tmpdir(), 'mkbrowser-')), packs = join(tmp, 'packs'), A = (p) => join(ROOT, 'assets', p);
const put = (rel, src) => { const p = join(packs, rel); mkdirSync(join(p, '..'), { recursive: true }); typeof src === 'string' && src.startsWith('/') ? copyFileSync(src, p) : writeFileSync(p, src); };
put('demo/sedan.glb', A('cars/sedan.glb')); put('demo/Textures/colormap.png', A('cars/Textures/colormap.png'));
put('demo/props/bench.glb', A('kaykit/bench.glb')); put('demo/props/citybits_texture.png', A('kaykit/citybits_texture.png'));
put('demo/pack.json', JSON.stringify({ models: { 'props/bench': { id: 'demo/bench', scale: 2, rotation: [0, 90, 0] } } }));
put('broken/nofile.glb', A('kaykit/bench.glb'));
const { index } = buildIndex(packs, { legacy: await legacyKeys(ROOT) });
index.packs.sneaky = { name: 'sneaky', category: 'misc', models: { palm1: { path: 'assets/packs/demo/sedan.glb', valid: true } } }; // runtime must refuse
index.packs.gone = { name: 'gone', category: 'misc', models: { 'gone/x': { path: 'assets/packs/gone/x.glb', valid: true } } };       // 404 handled
writeFileSync(join(packs, 'index.json'), JSON.stringify(index));

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.glb': 'model/gltf-binary' };
const srv = createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]), f = u.startsWith('/assets/packs/') ? join(packs, u.slice('/assets/packs/'.length)) : join(ROOT, normalize(u));
  if (!existsSync(f) || statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); r.end(readFileSync(f));
}).listen(0);
const port = srv.address().port, b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' }), p = await ctx.newPage();
const errs = [], packReqs = []; p.on('pageerror', (e) => errs.push(e.message));
p.on('request', (q) => { if (q.url().includes('/assets/packs/')) packReqs.push(q.url()); });
await ctx.route(/cdn\.jsdelivr\.net\/npm\/three@0\.170\.0\/(.*)/, (r) => { const f = join(THREE, r.request().url().split('three@0.170.0/')[1]); existsSync(f) ? r.fulfill({ path: f, contentType: 'text/javascript' }) : r.fulfill({ status: 404 }); });
const tests = [];
const test = (name, fn) => tests.push([name, fn]);
try {
  await p.goto(`http://localhost:${port}/index.html`); await p.waitForTimeout(800); await p.click('#playBtn');
  await p.waitForFunction(() => window.__town && window.__town.town && window.__town.town.is3D, null, { timeout: 60000 }); await p.waitForTimeout(1500);
  const startReqs = packReqs.length;
  console.log('legacy models loaded:', await p.evaluate(async () => Object.keys(await (await import('/js/models.js')).loadModels()).length));
  const r = await p.evaluate(async () => {
    const m = await import('/js/models.js'), M = await m.loadModels(), out = { legacyCount: Object.keys(M).length };
    out.palmSame = m.getModel('palm1') === M.palm1;
    const demo = await m.loadPack('demo'); out.demo = demo; out.again = (await m.loadPack('demo')) === demo;
    const s = m.getModel('demo/sedan'), bench = m.getModel('demo/bench'), lb = M.bench;
    out.sedanSize = s && s.userData.size.toArray(); out.sedanTex = (() => { let w = 0; s.traverse((o) => { if (o.material && o.material.map && o.material.map.image) w = o.material.map.image.width; }); return w; })();
    out.benchScaled = bench && lb && [bench.userData.size.x / lb.userData.size.z, bench.userData.size.z / lb.userData.size.x, bench.userData.size.y / lb.userData.size.y];
    const T = await import('three'), g = new T.Group();
    out.put = !!m.putModel(M, 'demo/sedan', g, 1, 2, { len: 3 }); out.putLen = (() => { const bx = new T.Box3().setFromObject(g); const v = bx.getSize(new T.Vector3()); return Math.max(v.x, v.z); })();
    out.anim = m.putAnimated(M, 'demo/bench', g, 0, 0, { h: 1 }); out.anim = !!(out.anim && out.anim.obj && out.anim.mixer === null);
    out.legacyPut = !!m.putModel(M, 'palm1', g, 0, 0, { h: 5 });
    out.broken = await m.loadPack('broken'); out.unknown = await m.loadPack('nope');
    out.sneaky = await m.loadPack('sneaky'); out.palmStill = m.getModel('palm1') === M.palm1;
    out.gone = await m.loadPack('gone');
    out.loaded = m.loadedPacks(); out.unloaded = m.unloadPack('demo'); out.after = m.getModel('demo/sedan'); out.reload = (await m.loadPack('demo')).models.length;
    return out;
  });
  test('no GLB pack is requested while the game starts', () => assert.equal(startReqs, 0, packReqs.join()));
  test('legacy models load as before, keys unchanged', () => { assert.ok(r.legacyCount >= 250, String(r.legacyCount)); assert.ok(r.palmSame); assert.ok(r.legacyPut); });
  test('loadPack loads valid models once (cached promise)', () => { assert.deepEqual(r.demo.models.sort(), ['demo/bench', 'demo/sedan']); assert.equal(r.demo.ok, true); assert.ok(r.again); });
  test('normalised like legacy models; external texture loaded as exported', () => { assert.ok(r.sedanSize.every((v) => v > 0)); assert.equal(r.sedanTex, 512); });
  test('manifest scale and rotation are applied (bench x2, turned 90°)', () => r.benchScaled.forEach((k) => assert.ok(Math.abs(k - 2) < .02, String(r.benchScaled))));
  test('putModel / putAnimated accept pack ids', () => { assert.ok(r.put); assert.ok(Math.abs(r.putLen - 3) < .05, String(r.putLen)); assert.ok(r.anim); });
  test('invalid models, unknown packs and 404s fail gracefully', () => {
    assert.equal(r.broken.ok, false); assert.deepEqual(r.broken.models, []); assert.match(r.broken.skipped[0].reason, /validation/);
    assert.equal(r.unknown.ok, false); assert.equal(r.unknown.error, 'unknown pack'); assert.equal(r.gone.ok, false); assert.equal(r.gone.skipped.length, 1);
  });
  test('a pack id equal to a legacy key never replaces the legacy model', () => { assert.equal(r.sneaky.models.length, 0); assert.match(r.sneaky.skipped[0].reason, /legacy/); assert.ok(r.palmStill); });
  test('unloadPack forgets the models; loading again works', () => { assert.equal(r.unloaded, 2); assert.equal(r.after, null); assert.equal(r.reload, 2); });
  test('no page errors', () => assert.deepEqual(errs, []));
} finally { await b.close(); srv.close(); rmSync(tmp, { recursive: true, force: true }); }

let pass = 0;
for (const [name, fn] of tests) { try { await fn(); pass++; console.log('PASS', name); } catch (e) { console.log('FAIL', name, '\n ', e.message); process.exitCode = 1; } }
console.log(`\n${pass}/${tests.length} passed`);
