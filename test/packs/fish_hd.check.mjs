// HD fish (assets/packs/malaysia-fish-hd) in the real game, in Chromium via Playwright. Local only, like browser.check.mjs:
//   THREE_DIR=/path/to/node_modules/three node test/packs/fish_hd.check.mjs
// Checks that no HD fish is downloaded at startup, and that both fishing games put HD models in their scene on demand.
// Skips (exit 0) when Playwright or THREE_DIR is missing.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const ROOT = new URL('../..', import.meta.url).pathname, THREE = process.env.THREE_DIR, PACK = 'malaysia-fish-hd';
let chromium; try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch { try { ({ chromium } = await import('playwright')); } catch {} }
if (!chromium || !THREE || !existsSync(join(THREE, 'build/three.module.js'))) { console.log('SKIP: needs Playwright and THREE_DIR (three@0.170.0)'); process.exit(0); }

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.glb': 'model/gltf-binary' };
const srv = createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]), f = join(ROOT, normalize(u === '/' ? '/index.html' : u));
  if (!existsSync(f) || statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); r.end(readFileSync(f));
}).listen(0);
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 900, height: 500 }, serviceWorkers: 'block' });
await ctx.route(/cdn\.jsdelivr\.net\/npm\/three@0\.170\.0\/(.*)/, (r) => { const f = join(THREE, r.request().url().split('three@0.170.0/')[1]); existsSync(f) ? r.fulfill({ path: f, contentType: 'text/javascript' }) : r.fulfill({ status: 404 }); });
await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());

// open the game and start one mini-game in practice mode (nothing is saved); returns the page and the HD files it requested
async function open(kind) {
  const p = await ctx.newPage(), reqs = [], errs = []; p.on('pageerror', (e) => errs.push(e.message));
  p.on('request', (q) => { if (q.url().includes(`/assets/packs/${PACK}/`)) reqs.push(q.url().split('/').pop()); });
  await p.goto(`http://localhost:${srv.address().port}/index.html`); await p.waitForFunction('window.__town', null, { timeout: 60000 });
  await p.waitForTimeout(1500); assert.deepEqual(reqs, [], 'HD fish must not be requested at startup');
  await p.evaluate((k) => { window.__town.playGame(k, { practice: true }); }, kind);
  await p.waitForFunction('window.__mg && window.__mg.dbg', null, { timeout: 60000 });
  await p.evaluate(() => { const bs = document.querySelectorAll('#gTut button'); bs.length && bs[bs.length - 1].click(); }); // "Mula!"
  return { p, reqs, errs };
}
// HD species whose geometry is in the running game's scene and visible: { id: visible mesh count }
const hdInScene = (p) => p.evaluate(async (PACK) => {
  const m = await import('/js/models.js'), idx = await m.loadPackIndex(), geos = new Map(), seen = {};
  for (const id of Object.keys(idx.packs[PACK].models)) { const src = m.getModel(id); if (src) src.traverse((o) => o.geometry && geos.set(o.geometry.uuid, id.split('Ikan_')[1])); }
  window.__mg.scene.traverse((o) => { if (!o.geometry || !geos.has(o.geometry.uuid)) return; for (let q = o; q; q = q.parent) if (!q.visible) return; const id = geos.get(o.geometry.uuid); seen[id] = (seen[id] || 0) + 1; });
  return seen; }, PACK);

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('Pancing Laut: fish around the bait, the hooked fish and the catch showcase use HD models', async () => {
  const { p, reqs, errs } = await open('seafish');
  await p.evaluate(() => window.__mg.sim.press('drop', true));
  await p.waitForFunction('window.__mg.dbg().amb.length > 0', null, { timeout: 60000 });
  const ids = await p.evaluate(() => [...new Set(window.__mg.dbg().amb.map((s) => s.split(':')[0]))]);
  const want = ids.filter((id) => ['Kerapu', 'Merah', 'Jenahak', 'Talang', 'Pari', 'Kembung', 'Kerisi', 'Gelama'].includes(id));
  if (want.length) { await p.waitForTimeout(4000); const seen = await hdInScene(p); assert.ok(want.some((id) => seen[id]), `ambient ${want} should be HD, scene has ${JSON.stringify(seen)}`); }
  await p.evaluate(() => { const s = window.__mg.sim; s.F.fish = { sp: s.SEA_FISH.find((x) => x.id === 'Kerapu'), kg: 6 }; s.F.st = 'bite'; s.press('strike', true); });
  await p.waitForTimeout(4000); assert.ok((await hdInScene(p)).Kerapu, 'hooked Kerapu is HD during the fight');
  await p.evaluate(() => window.__mg.sim.land()); await p.waitForTimeout(1500);
  assert.ok((await hdInScene(p)).Kerapu, 'catch showcase shows HD Kerapu');
  assert.ok(reqs.length <= want.length + 1, `only the species in play are downloaded, got ${reqs}`);
  // a species without an HD file keeps its legacy model
  await p.evaluate(async () => { const m = await import('/js/models.js'); if (m.hdFish('Tenggiri') !== null) throw new Error('Tenggiri has no HD model'); });
  assert.deepEqual(errs, []); await p.close();
});
test('Memancing (jetty): swimming fish and the landed fish use HD models', async () => {
  const { p, reqs, errs } = await open('fish');
  await p.evaluate(() => window.__mg.choose('pantai'));
  let seenAny = {}, catches = 0;
  for (let k = 0; k < 400 && !(catches && Object.keys(seenAny).length); k++) { // cast, hook on the bite; practice mode reels by itself
    const d = await p.evaluate(() => { const g = window.__mg, d = g.dbg(); if (d.mode === 'fish') { if (d.st === 'aim') { g.down({ x: 0, y: -8, down: true }); setTimeout(() => g.up(), 500); } else if (d.st === 'bite') g.down({ x: 0, y: -8, down: true }); else if (d.st === 'pose') setTimeout(() => g.next(), 1500); } return d; });
    catches = d.catches; Object.assign(seenAny, await hdInScene(p)); await p.waitForTimeout(400);
  }
  assert.ok(Object.keys(seenAny).length, `HD fish visible in the jetty game (requested ${reqs})`);
  assert.deepEqual(errs, []); await p.close();
});

let pass = 0;
for (const [name, fn] of tests) { try { await fn(); pass++; console.log('PASS', name); } catch (e) { console.log('FAIL', name, '\n ', e.message); process.exitCode = 1; } }
console.log(`\n${pass}/${tests.length} passed`);
await b.close(); srv.close();
