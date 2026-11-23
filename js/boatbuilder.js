// BOT MODULAR — 3D assembly. Puts the hull and the installed components together from boatrules.layout().
// • The hull GLB is never changed: built-in parts are hidden by drawing the hull with a shorter index list (a private copy of
//   the index; vertex data is the cached model's).
// • A component whose GLB is not in assets/packs/bot/ yet is drawn as a striped box labelled SEMENTARA (placeholder).
// • Everything lives in "hull units" under one group that is scaled to the hull's real length, so anchors scale with the boat.
import * as R from './boatrules.js';

export function makeBoatBuilder({ T, getModel }) {
  const islandCache = new WeakMap();
  const islandsOf = (geo) => { let i = islandCache.get(geo); if (!i) { i = R.findIslands(geo.attributes.position.array, geo.index.array); islandCache.set(geo, i); } return i; };
  // hazard-stripe texture + materials shared by every placeholder of one builder
  const stripe = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#f5c518'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#1c1c1c'; for (let i = -64; i < 128; i += 32) { x.beginPath(); x.moveTo(i, 64); x.lineTo(i + 16, 64); x.lineTo(i + 80, 0); x.lineTo(i + 64, 0); x.fill(); }
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; return t; })();
  const phMat = new T.MeshStandardMaterial({ map: stripe, transparent: true, opacity: .62, roughness: .8, depthWrite: false });
  const edgeMat = new T.LineBasicMaterial({ color: 0x1c1c1c }), pickMat = new T.MeshBasicMaterial({ visible: false }), selMat = new T.LineBasicMaterial({ color: 0xffd452, depthTest: false, transparent: true });
  function labelSprite(l1, l2) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 96; const x = c.getContext('2d');
    x.fillStyle = 'rgba(20,20,20,.88)'; x.beginPath(); x.roundRect(2, 2, 252, 92, 14); x.fill(); x.strokeStyle = '#f5c518'; x.lineWidth = 4; x.stroke();
    x.textAlign = 'center'; x.fillStyle = '#f5c518'; x.font = '900 30px system-ui,sans-serif'; x.fillText(l1, 128, 40); x.fillStyle = '#fff'; x.font = '700 24px system-ui,sans-serif'; x.fillText(l2, 128, 76);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; const s = new T.Sprite(new T.SpriteMaterial({ map: t, depthTest: false, transparent: true })); s.renderOrder = 6; s.userData.own = true; return s;
  }
  const rad = (d) => d * Math.PI / 180;

  // cfg: boat configuration (boatparts.js). Returns the boat object and functions to update it.
  function create(cfg = R.BOAT) {
    const boat = new T.Group(); boat.scale.setScalar(cfg.hull.lengthM);
    const src = getModel(cfg.hull.model); let hullObj = null, hm = null, srcGeo = null, ownGeo = null, islands = null, hiddenKey = '';
    const parts = new T.Group(), picks = new T.Group(), sel = new T.Group(); let info = { placeholders: 0, models: 0, triangles: 0, hullLoaded: !!src };
    if (src) {
      hullObj = src.clone(true); boat.add(hullObj);
      hullObj.traverse((o) => { if (o.isMesh && o.geometry.index && (!hm || o.geometry.attributes.position.count > hm.geometry.attributes.position.count)) hm = o; });
      if (hm) { srcGeo = hm.geometry; islands = islandsOf(srcGeo); hm.add(parts, picks, sel); } else boat.add(parts, picks, sel); // children of the hull mesh = exactly the GLB's own coordinates
    } else { // hull file missing: a marked stand-in so the screen is never empty
      const g = new T.Mesh(new T.BoxGeometry(1, .2, .4), phMat); g.position.y = .1; g.userData.own = true; boat.add(g); const s = labelSprite('SEMENTARA', 'Badan bot'); s.scale.set(.3, .11, 1); s.position.set(0, .34, 0); boat.add(s); boat.add(parts, picks, sel);
    }
    function clear(g) { for (const o of [...g.children]) { g.remove(o); o.traverse((q) => { if (q.userData.own) { q.geometry && q.geometry.dispose(); if (q.material && q.material.map && q.isSprite) q.material.map.dispose(); if (q.isSprite) q.material.dispose(); } }); } }
    function setHidden(names) {
      if (!hm || !islands) return; const key = names.slice().sort().join(','); if (key === hiddenKey) return; hiddenKey = key;
      if (ownGeo) { ownGeo.dispose(); ownGeo = null; }
      if (!names.length) { hm.geometry = srcGeo; return; }
      const drop = R.hiddenTriangles(islands, names, cfg), si = srcGeo.index.array, out = new si.constructor(si.length - drop.size * 3); let k = 0;
      for (let t = 0; t < si.length / 3; t++) if (!drop.has(t)) { out[k++] = si[t * 3]; out[k++] = si[t * 3 + 1]; out[k++] = si[t * 3 + 2]; }
      ownGeo = new T.BufferGeometry(); for (const n of Object.keys(srcGeo.attributes)) ownGeo.setAttribute(n, srcGeo.attributes[n]); ownGeo.setIndex(new T.BufferAttribute(out, 1));
      ownGeo.boundingBox = srcGeo.boundingBox; ownGeo.boundingSphere = srcGeo.boundingSphere; hm.geometry = ownGeo;
    }
    const boxGeo = (s, k = 1) => { const g = new T.BoxGeometry(s[0] * k, s[1] * k, s[2] * k); g.translate(0, s[1] * k / 2, 0); return g; }; // origin at the bottom centre, like a normalised GLB
    // bot: the configuration to show ({ equipped }). tunes: adjust-mode deltas. selected: slot to outline. labels: show placeholder labels.
    function apply(bot, { tunes = {}, selected = null, labels = true } = {}) {
      setHidden(R.hiddenBuiltins(bot, cfg)); clear(parts); clear(picks); clear(sel);
      info = { placeholders: 0, models: 0, triangles: hm ? hm.geometry.index.count / 3 : 12, hullLoaded: !!src, missing: [] };
      for (const it of R.layout(bot, tunes, cfg)) {
        const d = cfg.slots[it.slot], a = it.kind === 'model' ? it.anchor : R.anchorFor(it.slot, Math.max(1, it.level), null, cfg), size = it.size || d.size;
        if (it.kind === 'model') {
          const g = new T.Group(); g.position.set(...a.pos); g.rotation.set(rad(a.rot[0]), rad(a.rot[1]), rad(a.rot[2])); g.userData = { slot: it.slot, level: it.level };
          const m = getModel(it.model);
          if (m) { const c = m.clone(true), sz = m.userData.size, k = Math.min(size[0] / sz.x, size[1] / sz.y, size[2] / sz.z) * a.scale; c.scale.setScalar(k); g.add(c); info.models++; c.traverse((o) => { if (o.isMesh) info.triangles += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; }); }
          else { const bg = boxGeo(size, a.scale), b = new T.Mesh(bg, phMat); b.userData.own = true; b.renderOrder = 4; g.add(b); const e = new T.LineSegments(new T.EdgesGeometry(bg), edgeMat); e.userData.own = true; g.add(e);
            if (labels) { const s = labelSprite('SEMENTARA', `${d.bm} Lv${it.level}`); s.scale.set(.16, .06, 1); s.position.set(0, size[1] * a.scale + .045, 0); g.add(s); }
            g.userData.placeholder = true; info.placeholders++; info.missing.push(it.model); info.triangles += 12; }
          parts.add(g);
        }
        // invisible box for tapping the slot (also for built-in, stock and empty slots)
        const wb = it.kind === 'builtin' && cfg.builtins[it.builtin] ? cfg.builtins[it.builtin].box : null;
        const pg = wb ? (() => { const g = new T.BoxGeometry(wb[1][0] - wb[0][0], wb[1][1] - wb[0][1], wb[1][2] - wb[0][2]); g.translate((wb[0][0] + wb[1][0]) / 2, (wb[0][1] + wb[1][1]) / 2, (wb[0][2] + wb[1][2]) / 2); return g; })() : (() => { const g = boxGeo(size.map((v) => Math.max(v, .05)), a.scale * 1.15); g.translate(...a.pos); return g; })();
        const p = new T.Mesh(pg, pickMat); p.userData = { slot: it.slot, own: true }; picks.add(p);
        if (selected === it.slot) { const e = new T.LineSegments(new T.EdgesGeometry(pg), selMat); e.userData.own = true; e.renderOrder = 7; sel.add(e); }
      }
      return info;
    }
    return {
      object: boat, apply, cfg, get info() { return info; }, get islands() { return islands; },
      // slot under a ray (THREE.Raycaster), or null
      pick(raycaster) { boat.updateMatrixWorld(true); const h = raycaster.intersectObjects(picks.children, false)[0]; return h ? h.object.userData.slot : null; },
      // world position of a slot's anchor (for camera focus)
      slotWorld(slot, level, out = new T.Vector3()) { const a = R.anchorFor(slot, Math.max(1, level), null, cfg); out.set(...a.pos); out.y += (cfg.slots[slot].size[1] || 0) / 2; boat.updateMatrixWorld(true); return (hm || boat).localToWorld(out); },
      dispose() { clear(parts); clear(picks); clear(sel); if (ownGeo) ownGeo.dispose(); boat.removeFromParent(); },
    };
  }
  return { create, dispose() { stripe.dispose(); phMat.dispose(); edgeMat.dispose(); pickMat.dispose(); selMat.dispose(); } };
}
