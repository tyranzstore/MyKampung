// Mini-game clock pauses while the page is hidden. Run with `node test/minigames/pause.test.mjs` from the project root.
import assert from 'node:assert/strict';
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.matchMedia = () => ({ matches: false });
globalThis.addEventListener = () => {}; globalThis.document = { addEventListener() {}, getElementById: () => null }; // browser globals touched on import
const { pauseWhenHidden } = await import('../../js/minigames.js');

function fakeDoc() { const ls = new Set(); return { hidden: false, ls, addEventListener: (t, f) => ls.add(f), removeEventListener: (t, f) => ls.delete(f), fire(h) { this.hidden = h; for (const f of ls) f(); } }; }
function fakeApi() { let p = false; return { log: [], isPaused: () => p, pause(on) { this.log.push(on); p = on; } }; }
const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('hiding pauses and showing resumes', () => {
  const d = fakeDoc(), a = fakeApi(); pauseWhenHidden(a, d);
  d.fire(true); assert.equal(a.isPaused(), true); d.fire(false); assert.equal(a.isPaused(), false);
});
test('a pause made by the tutorial card is not undone when the page comes back', () => {
  const d = fakeDoc(), a = fakeApi(); pauseWhenHidden(a, d);
  a.pause(true); d.fire(true); d.fire(false); assert.equal(a.isPaused(), true); assert.deepEqual(a.log, [true]);
});
test('cleanup removes the listener', () => {
  const d = fakeDoc(), a = fakeApi(); const off = pauseWhenHidden(a, d); off();
  assert.equal(d.ls.size, 0); d.fire(true); assert.equal(a.isPaused(), false);
});

let pass = 0;
for (const [name, fn] of tests) { try { await fn(); pass++; console.log('PASS', name); } catch (e) { console.log('FAIL', name, '\n ', e.message); process.exitCode = 1; } }
console.log(`\n${pass}/${tests.length} passed`);
