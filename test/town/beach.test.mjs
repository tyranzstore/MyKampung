// Pantai Miami layout: zones keep clear sand between them and the Jambatan Angkat stands alone at the far east edge.
// Run with `node test/town/beach.test.mjs` from the project root. Checks the BEACH table that drives placement.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.matchMedia = () => ({ matches: false });
const { BEACH, BRIDGE_SPAN } = await import('../../js/town3d.js');

const rect = (b) => ({ x0: b.x - b.w / 2, x1: b.x + b.w / 2, z0: b.z - b.d / 2, z1: b.z + b.d / 2 });
const gap = (a, b) => Math.hypot(Math.max(0, a.x0 - b.x1, b.x0 - a.x1), Math.max(0, a.z0 - b.z1, b.z0 - a.z1));
const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('every required zone exists (ids unchanged)', () => {
  for (const id of ['lekor', 'pasar', 'futsal', 'volley', 'photo', 'wakaf', 'sign']) assert.ok(BEACH[id], id);
});
test('at least 6 units of clear space between any two zones', () => {
  const e = Object.entries(BEACH);
  for (let i = 0; i < e.length; i++) for (let j = i + 1; j < e.length; j++) {
    const g = gap(rect(e[i][1]), rect(e[j][1])); assert.ok(g >= 6, `${e[i][0]} - ${e[j][0]}: ${g.toFixed(2)}`);
  }
});
test('beach zones stay on the sand, off the coast road (z -10..-7)', () => {
  for (const [id, b] of Object.entries(BEACH)) { const r = rect(b); assert.ok(r.z1 <= -10 || r.z0 >= -7, id); if (r.z1 <= -10) assert.ok(r.z0 > -24.3, id + ' in the sea'); }
});
test('the bridge has 25 units of empty space around it and nothing within 15 of its towers', () => {
  const span = { x0: BRIDGE_SPAN.x0, x1: BRIDGE_SPAN.x1, z0: BRIDGE_SPAN.z - 3.5, z1: BRIDGE_SPAN.z + 3.5 };
  const mid = (BRIDGE_SPAN.x0 + BRIDGE_SPAN.x1) / 2, towers = { x0: mid - 3.2, x1: mid + 3.2, z0: span.z0, z1: span.z1 };
  for (const [id, b] of Object.entries(BEACH)) { assert.ok(gap(rect(b), span) >= 25, id); assert.ok(gap(rect(b), towers) >= 15, id); }
});
test('the bridge sits at the far east edge with a walkable margin, and the camera can reach it', () => {
  const src = readFileSync(new URL('../../js/town3d.js', import.meta.url), 'utf8');
  const EAST = +src.match(/const EAST = (\d+)/)[1];
  assert.ok(EAST - BRIDGE_SPAN.x1 >= 25 + 8, 'margin east of the bridge');
  assert.ok(Math.max(...Object.values(BEACH).map((b) => b.x + b.w / 2)) < BRIDGE_SPAN.x0 - 25, 'all zones west of the bridge');
  assert.match(src, /clamp\(target\.x, WEST \+ 2, EAST - 8\)/);
});
test('the 2D map keeps the same place ids', () => {
  const src = readFileSync(new URL('../../js/town.js', import.meta.url), 'utf8');
  assert.match(src, /pantai: \{ i0:/); assert.match(src, /jambatan: \{ i0:/);
});

let pass = 0;
for (const [name, fn] of tests) { try { await fn(); pass++; console.log('PASS', name); } catch (e) { console.log('FAIL', name, '\n ', e.message); process.exitCode = 1; } }
console.log(`\n${pass}/${tests.length} passed`);
