// Regression: buildYard() crashed on rebuild ("reading 'dispose'") because it called .geometry.dispose() on a THREE.Group.
// Run with `node test/town/yard.test.mjs` from the project root. Uses small stand-ins for three.js objects (no deps).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }; // core.js reads the save on import
globalThis.matchMedia = () => ({ matches: false }); // town3d.js checks for touch on import
const { disposeOwned } = await import('../../js/town3d.js');

const res = (name) => ({ name, disposed: 0, dispose() { this.disposed++; } });
const node = (props = {}, children = []) => ({ ...props, children, traverse(f) { f(this); for (const c of this.children) c.traverse(f); } });
const tests = [];
const test = (name, fn) => tests.push([name, fn]);

// shape of a yard: Group > base plane mesh (own geo, own material with a shared texture) + instanced grass (shared blade geo)
function yard() {
  const tex = res('grassTexture'), blade = res('bladeGeo');
  const base = node({ isMesh: true, geometry: res('plane'), material: { ...res('baseMat'), map: tex } });
  const im = node({ isMesh: true, isInstancedMesh: true, geometry: blade, material: res('grassMat'), ...res('im') });
  const g = node({ isGroup: true }, [base, im]); // a Group has no geometry: the old code crashed here
  return { g, tex, blade, base, im };
}

test('old code path crashes on a Group (documents the bug)', () => {
  const { g, blade } = yard();
  assert.throws(() => { g.geometry !== blade && g.geometry.dispose(); }, /dispose/);
});

test('disposeOwned frees owned geometry, materials and instance buffers without throwing', () => {
  const { g, base, im } = yard();
  disposeOwned(g, new Set());
  assert.equal(base.geometry.disposed, 1); assert.equal(base.material.disposed, 1);
  assert.equal(im.material.disposed, 1); assert.equal(im.disposed, 1);
});

test('shared blade geometry and shared textures survive', () => {
  const { g, blade, tex } = yard();
  disposeOwned(g, new Set([blade]));
  assert.equal(blade.disposed, 0); assert.equal(tex.disposed, 0);
});

test('material arrays and meshes without material are handled', () => {
  const a = res('a'), b = res('b');
  const g = node({}, [node({ isMesh: true, geometry: res('g'), material: [a, b] }), node({ isMesh: true, geometry: res('h') })]);
  disposeOwned(g); assert.equal(a.disposed + b.disposed, 2);
});

test('rebuilding a yard twice disposes each old group once and never the shared blade', () => {
  const blade = res('bladeGeo'), keep = new Set([blade]); let prev = null, freed = [];
  for (let k = 0; k < 3; k++) {
    if (prev) disposeOwned(prev, keep);
    const m = node({ isMesh: true, geometry: res('p' + k), material: res('m' + k) });
    prev = node({ isGroup: true }, [m, node({ isMesh: true, isInstancedMesh: true, geometry: blade, material: res('im' + k), ...res('i' + k) })]);
    freed.push(m);
  }
  assert.deepEqual(freed.map((m) => m.geometry.disposed), [1, 1, 0]);
  assert.equal(blade.disposed, 0);
});

test('buildYard uses disposeOwned and no longer touches .geometry on the yard group', () => {
  const src = readFileSync(new URL('../../js/town3d.js', import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('function buildYard'), src.indexOf('ground.add(g); yardMeshes[id] = g;'));
  assert.match(body, /disposeOwned\(yardMeshes\[id\], yardShared\)/);
  assert.doesNotMatch(body, /yardMeshes\[id\]\.geometry/);
});

let pass = 0;
for (const [name, fn] of tests) { try { await fn(); pass++; console.log('PASS', name); } catch (e) { console.log('FAIL', name, '\n ', e.message); process.exitCode = 1; } }
console.log(`\n${pass}/${tests.length} passed`);
