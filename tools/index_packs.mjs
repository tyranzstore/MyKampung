#!/usr/bin/env node
// Index GLB asset packs: finds every .glb under assets/packs/<packId>/, validates it with tools/check_glb.mjs
// (profile packAsset) and writes assets/packs/index.json for js/models.js loadPack(). No dependencies (Node 18+).
//
//   node tools/index_packs.mjs            # update assets/packs/index.json
//   node tools/index_packs.mjs --check    # exit 1 if index.json is out of date (CI)
//   node tools/index_packs.mjs --strict   # exit 1 if any model fails validation or an id collides
//   --dir <packs dir> --out <index file>  # other locations (tests)
//
// Optional assets/packs/<packId>/pack.json (you write it; the indexer only reads it):
//   { "name": "Pasar props", "category": "props",
//     "models": { "Stall_A": { "id": "pasar/stall", "category": "market", "scale": 0.01, "rotation": [0, 90, 0] } } }
// keys of "models" are file paths inside the pack without ".glb" (e.g. "Stall_A" or "stalls/Stall_A").
// Model ids default to "<packId>/<file path without .glb>". External textures/.bin next to the .glb are kept where they are
// and listed under "deps"; the browser loads them relative to the .glb, exactly as exported.
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkGlb, parseGlb, SPECS } from './check_glb.mjs';

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.\-/]*$/;
const posix = (p) => p.split(sep).join('/');
function walk(d) { return readdirSync(d).sort().flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; }); }

// keys the legacy loader already uses (MODEL_FILES + assets/models2.json): pack ids may never shadow them
export async function legacyKeys(root = '.') {
  const keys = new Set();
  try { const { MODEL_FILES } = await import(pathToFileURL(join(root, 'js/models.js')).href); Object.keys(MODEL_FILES).forEach((k) => keys.add(k)); } catch {}
  try { Object.keys(JSON.parse(readFileSync(join(root, 'assets/models2.json'), 'utf8'))).forEach((k) => keys.add(k)); } catch {}
  return keys;
}

export function buildIndex(dir, { legacy = new Set(), urlBase = 'assets/packs' } = {}) {
  const index = { version: 1, packs: {} }, problems = [], seen = new Map(); // lower-case id -> where
  if (!existsSync(dir)) return { index, problems };
  for (const packId of readdirSync(dir).sort()) {
    const pdir = join(dir, packId); if (!statSync(pdir).isDirectory()) continue;
    if (!ID_RE.test(packId) || packId.includes('/')) { problems.push(`${packId}: pack folder name may only use letters, digits, _ . -`); continue; }
    let meta = {};
    if (existsSync(join(pdir, 'pack.json'))) try { meta = JSON.parse(readFileSync(join(pdir, 'pack.json'), 'utf8')); } catch (e) { problems.push(`${packId}/pack.json: ${e.message}`); }
    const pack = { name: meta.name || packId, category: meta.category || 'misc', models: {} };
    for (const f of walk(pdir).filter((p) => p.toLowerCase().endsWith('.glb'))) {
      const rel = posix(relative(pdir, f)).slice(0, -4), m = (meta.models || {})[rel] || {};
      const id = m.id || `${packId}/${rel}`, where = `${packId}/${rel}.glb`, entry = { path: `${urlBase}/${packId}/${rel}.glb`, file: where };
      entry.category = m.category || (rel.includes('/') ? rel.split('/')[0] : pack.category);
      const buf = readFileSync(f); entry.bytes = buf.length;
      if (m.scale !== undefined) { if (typeof m.scale === 'number' && m.scale > 0) entry.scale = m.scale; else problems.push(`${where}: scale must be a positive number`); }
      if (m.rotation !== undefined) { if (Array.isArray(m.rotation) && m.rotation.length === 3 && m.rotation.every(Number.isFinite)) entry.rotation = m.rotation; else problems.push(`${where}: rotation must be [x, y, z] in degrees`); }
      const bad = [];
      if (!ID_RE.test(id)) bad.push(`id "${id}" has characters other than letters, digits, _ . - /`);
      if (legacy.has(id)) bad.push(`id "${id}" is already a legacy model key`);
      const lk = id.toLowerCase(); if (seen.has(lk)) bad.push(`id "${id}" collides with ${seen.get(lk)}`); else seen.set(lk, where);
      // external dependencies stay where the exporter put them; record and check them
      const fdir = dirname(f), resolve = (u) => { // relative files inside this pack folder only (no URLs, no escaping the pack)
        if (/^[a-z][a-z0-9+.-]*:/i.test(u) || u.startsWith('/')) return null;
        const p = join(fdir, decodeURIComponent(u)), r = posix(relative(pdir, p)); if (r.startsWith('..')) return null;
        return existsSync(p) && statSync(p).isFile() ? readFileSync(p) : null; };
      try { const { json } = parseGlb(buf); const deps = [...(json.buffers || []), ...(json.images || [])].map((x) => x.uri).filter((u) => u && !u.startsWith('data:'));
        if (deps.length) entry.deps = [...new Set(deps)].sort(); } catch {}
      const res = checkGlb(buf, SPECS.packAsset, { resolve });
      Object.assign(entry, { triangles: res.stats.triangles || 0, valid: res.ok && !bad.length });
      const fails = res.results.filter((r) => r.level === 'FAIL').map((r) => `${r.id}: ${r.msg}`), warns = res.results.filter((r) => r.level === 'WARN').length;
      if (warns) entry.warnings = warns;
      if (fails.length || bad.length) { entry.problems = [...bad, ...fails]; problems.push(...entry.problems.map((p) => `${where}: ${p}`)); }
      pack.models[id] = entry;
    }
    if (Object.keys(pack.models).length) index.packs[packId] = pack;
  }
  return { index, problems };
}

export const stringify = (index) => JSON.stringify(index, null, 1) + '\n';

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const a = process.argv.slice(2), opt = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
  const dir = opt('--dir', 'assets/packs'), out = opt('--out', join(dir, 'index.json'));
  const { index, problems } = buildIndex(dir, { legacy: await legacyKeys('.') });
  const text = stringify(index), old = existsSync(out) ? readFileSync(out, 'utf8') : '';
  const n = Object.values(index.packs).reduce((s, p) => s + Object.keys(p.models).length, 0);
  console.log(`${Object.keys(index.packs).length} pack(s), ${n} model(s)`);
  for (const p of problems) console.log('  PROBLEM ' + p);
  if (a.includes('--check')) { if (text !== old) { console.log(`${out} is out of date: run node tools/index_packs.mjs`); process.exit(1); } }
  else if (text !== old) { writeFileSync(out, text); console.log('wrote ' + out); } else console.log(out + ' is up to date');
  if (a.includes('--strict') && problems.length) process.exit(1);
}
