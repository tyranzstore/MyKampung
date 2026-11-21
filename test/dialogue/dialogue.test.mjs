// NPC dialogue checks: run with `node test/dialogue/dialogue.test.mjs` from the project root.
// Reads the dialogue tables straight from js/main.js (plain data), so no browser is needed.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync('js/main.js', 'utf8'), town = readFileSync('js/town.js', 'utf8');
function table(name, open = '{', close = '\n};') {
  const a = main.indexOf(`const ${name} = ${open}`); assert.ok(a >= 0, `${name} not found`);
  const b = main.indexOf(close, a); const src = main.slice(a + `const ${name} = `.length, b + close.length - 1);
  return { src, value: new Function(`return ${src}`)() };
}
const LINES = table('LINES'), IDLE = table('IDLE'), GREETS = table('GREETS', '[', '];');
const npcIds = [...town.matchAll(/^  (\w+): \{ name: '([^']+)'/gm)].map(m => m[1]);
const all = [...Object.values(LINES.value).flat(), ...Object.values(IDLE.value).flat(), ...GREETS.value];
const MAX = 130; // characters per line: about three lines in the dialogue box on a phone

const tests = []; const test = (name, fn) => tests.push([name, fn]);

test('no dialogue key is defined twice (a duplicate silently replaces the first)', () => {
  for (const t of [LINES, IDLE]) { const keys = [...t.src.matchAll(/^  (\w+): \[/gm)].map(m => m[1]); assert.deepEqual(keys.filter((k, i) => keys.indexOf(k) !== i), []); }
});
test('every LINES key the story uses exists', () => {
  const used = [...new Set([...main.matchAll(/LINES\.(\w+)/g)].map(m => m[1]))];
  for (const k of used) assert.ok(LINES.value[k], `LINES.${k} is used but not defined`);
  assert.ok(main.includes("LINES['inv_' + id]"));
  for (const id of ['amin', 'ani', 'abu']) assert.ok(LINES.value['inv_' + id], 'inv_' + id);
});
test('every line is a [Malay, English] pair of short, non-empty strings', () => {
  for (const l of all) {
    assert.ok(Array.isArray(l) && l.length === 2, JSON.stringify(l));
    for (const s of l) { assert.equal(typeof s, 'string'); assert.ok(s.trim().length > 0, JSON.stringify(l)); assert.ok(s.length <= MAX, `${s.length} chars: ${s}`); }
  }
});
test('no em or en dashes in dialogue (house style: commas, full stops, ellipses)', () => {
  for (const l of all) for (const s of l) assert.equal(/[—–]/.test(s), false, s);
});
test('gameplay instructions are all still there', () => {
  const bm = all.map(l => l[0]).join('\n');
  for (const p of ['Ketik rumah Tok untuk mula baiki', 'Ketik sawah untuk mula', 'Ketik jeti untuk mula', 'Ketik jeti bila dah sedia', 'Ketik Balai Raya di peta', 'Ketik lajur', 'KITAR SEMULA', 'SAMPAH AM', 'Damai City Mall', 'Uncle Lim', 'Nek Ma'])
    assert.ok(bm.includes(p), `missing instruction/place: ${p}`);
});
test('chapter 1 and chapter 5 endings are different conversations', () => {
  const k1 = (main.match(/at\(1, 5\)\) \{ await dialog\(n, LINES\.(\w+)\)/) || [])[1], k5 = (main.match(/at\(5, 5\)\) \{ await dialog\(n, LINES\.(\w+)\)/) || [])[1];
  assert.ok(k1 && k5); assert.notEqual(k1, k5);
  assert.equal(/bunga api|nyanyi/i.test(LINES.value[k1].map(l => l[0]).join(' ')), false, 'chapter 1 ending must not talk about the festival');
  assert.match(LINES.value[k5].map(l => l[0]).join(' '), /bunga api/);
});
test('small talk exists only for NPCs that are in the game, and every NPC has some', () => {
  for (const id of Object.keys(IDLE.value)) assert.ok(npcIds.includes(id), `IDLE.${id} has no NPC`);
  for (const id of npcIds) assert.ok(IDLE.value[id] && IDLE.value[id].length >= 2, `NPC ${id} needs at least 2 small-talk lines`);
});
test('names stay consistent: Pok Ajis, not Pak Ajis', () => { for (const l of all) for (const s of l) assert.equal(s.includes('Pak Ajis'), false, s); });

let fail = 0;
for (const [name, fn] of tests) { try { await fn(); console.log('PASS', name); } catch (e) { fail++; console.log('FAIL', name, '\n   ', e.message.split('\n')[0]); } }
console.log(`\n${tests.length - fail}/${tests.length} passed`);
process.exit(fail ? 1 : 0);
