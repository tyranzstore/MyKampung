// Ocean surface shared by the town map and the sea mini-games.
// A lit MeshStandardMaterial patched with Gerstner waves (displacement + analytic normals),
// a scrolling ripple normal map, sky reflection at grazing angles and foam on the wave crests.
// shoreWaves() adds breaking-wave foam bands that roll up a beach and fade.

let NM = null;
function rippleNormalMap(T) {
  if (NM) return NM;
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'), img = x.createImageData(S, S);
  // height field from a few periodic sine octaves (tiles seamlessly), then central differences -> normals
  const H = new Float32Array(S * S), TAU = Math.PI * 2;
  const waves = []; let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 14; k++) waves.push([1 + Math.floor(rnd() * 6), Math.floor(rnd() * 7) - 3, rnd() * TAU, .35 / (1 + k * .35)]);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { let h = 0; for (const [a, b, p, amp] of waves) h += Math.sin(TAU * (a * i + b * j) / S + p) * amp; H[j * S + i] = h; }
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const dx = H[j * S + (i + 1) % S] - H[j * S + (i + S - 1) % S], dy = H[((j + 1) % S) * S + i] - H[((j + S - 1) % S) * S + i];
    let nx = -dx * 2.2, ny = -dy * 2.2, nz = 1; const L = Math.hypot(nx, ny, nz); nx /= L; ny /= L; nz /= L;
    const o = (j * S + i) * 4; img.data[o] = (nx * .5 + .5) * 255; img.data[o + 1] = (ny * .5 + .5) * 255; img.data[o + 2] = (nz * .5 + .5) * 255; img.data[o + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  NM = new T.CanvasTexture(c); NM.wrapS = NM.wrapT = T.RepeatWrapping;
  return NM;
}

// w,h: size; seg: grid density (segments per unit); shoreY: local-y of the shoreline (waves fade to calm towards it, flat beyond it); amp: open-sea wave height
export function makeOcean(T, { w = 200, h = 200, seg = .5, deep = 0x0d4f7a, shallow = 0x2aa6c9, sky = 0xbfe6f7, amp = .22, shoreY = null, shoreFade = 10, rough = .18, repeat = 18, opacity = 1 } = {}) {
  const geo = new T.PlaneGeometry(w, h, Math.max(2, Math.round(w * seg)), Math.max(2, Math.round(h * seg)));
  const nm = rippleNormalMap(T), map = nm.clone ? nm.clone() : nm; if (map.repeat) map.repeat.set(repeat * w / 200, repeat * h / 200); map.needsUpdate = true;
  const mat = new T.MeshStandardMaterial({ color: shallow, roughness: rough, metalness: .05, normalMap: map, transparent: opacity < 1, opacity });
  if (mat.normalScale && mat.normalScale.set) mat.normalScale.set(.55, .55);
  const U = { uTime: { value: 0 }, uAmp: { value: amp }, uShore: { value: shoreY === null ? -1e6 : shoreY }, uFade: { value: shoreFade }, uDeep: { value: new T.Color(deep) }, uShallow: { value: new T.Color(shallow) }, uSky: { value: new T.Color(sky) }, uHole: { value: { x: 0, y: 0, z: 0, w: 0, isVector4: true } }, uHoleDir: { value: { x: 0, y: 1, isVector2: true } } };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
uniform float uTime, uAmp, uShore, uFade; uniform vec4 uHole; uniform vec2 uHoleDir; varying float vCrest; varying float vCalm;
// one Gerstner wave: dir, steepness, wavelength; accumulates offset, tangent and binormal
void gw(vec2 dir, float steep, float L, vec2 p, float A, inout vec3 off, inout vec3 tg, inout vec3 bn) {
  float k = 6.28318 / L, c = sqrt(9.8 / k); vec2 d = normalize(dir); float f = k * (dot(d, p) - c * uTime * .55), a = A * steep / k * 6.0;
  a = min(a, A); float q = steep;
  off += vec3(d.x * q * a * cos(f), d.y * q * a * cos(f), a * sin(f));
  tg += vec3(-d.x * d.x * q * k * a * sin(f), -d.x * d.y * q * k * a * sin(f), d.x * k * a * cos(f));
  bn += vec3(-d.x * d.y * q * k * a * sin(f), -d.y * d.y * q * k * a * sin(f), d.y * k * a * cos(f));
}`)
      .replace('#include <beginnormal_vertex>', `
  vec2 p0 = position.xy;
  float calm = clamp((p0.y - uShore) / uFade, 0.0, 1.0); calm = calm * calm * (3.0 - 2.0 * calm); vCalm = calm;
  float A = uAmp * (0.12 + 0.88 * calm);
  // optional boat hole: waves calm down around the hull and the surface dips under it, so water never shows through the deck
  float hin = 0.0;
  if (uHole.w > 0.0) { vec2 dp = p0 - uHole.xy; float hu = dot(dp, uHoleDir) / uHole.z, hv = dot(dp, vec2(-uHoleDir.y, uHoleDir.x)) / uHole.w, he = hu * hu + hv * hv;
    hin = 1.0 - smoothstep(.7, 1.0, he); A *= mix(.15, 1.0, smoothstep(1.0, 4.0, he)); }
  vec3 off = vec3(0.0), tg = vec3(1.0, 0.0, 0.0), bn = vec3(0.0, 1.0, 0.0);
  gw(vec2(0.2, 1.0), .55, 11.0, p0, A, off, tg, bn);
  gw(vec2(-0.7, 1.0), .45, 6.5, p0, A * .6, off, tg, bn);
  gw(vec2(0.9, 0.6), .4, 3.7, p0, A * .35, off, tg, bn);
  gw(vec2(-0.3, -1.0), .35, 2.2, p0, A * .2, off, tg, bn);
  vec3 gPos = vec3(position.xy + off.xy * (1.0 - hin), position.z + off.z - hin * .9);
  vCrest = off.z / max(A, 1e-4);
  vec3 objectNormal = normalize(cross(tg, bn));
  #ifdef USE_TANGENT
  vec3 objectTangent = vec3(tangent.xyz);
  #endif`)
      .replace('#include <begin_vertex>', 'vec3 transformed = gPos;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform vec3 uDeep, uShallow, uSky; uniform float uTime; varying float vCrest; varying float vCalm;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
  diffuseColor.rgb = mix(uShallow, uDeep, clamp(vCalm * .75 + .1 - vCrest * .12, 0.0, 1.0));`)
      .replace('#include <opaque_fragment>', `
  { vec3 vd = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(vViewPosition);
    float fres = pow(1.0 - clamp(dot(normalize(normal), vd), 0.0, 1.0), 3.0);
    outgoingLight = mix(outgoingLight, uSky * (0.55 + 0.45 * length(outgoingLight)), clamp(fres * .6 + .08, 0.0, .7));
    float foam = smoothstep(.85, 1.45, vCrest) * (.3 + .7 * vCalm);
    #ifdef USE_NORMALMAP
    vec3 nmS = texture2D(normalMap, vNormalMapUv * 1.7).xyz; foam *= smoothstep(.52, .78, nmS.x * .6 + nmS.y * .4);
    #endif
    outgoingLight = mix(outgoingLight, vec3(.93, .97, 1.0), clamp(foam, 0.0, 1.0) * .45); }
  #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'ocean-v2';
  const mesh = new T.Mesh(geo, mat); mesh.rotation.x = -Math.PI / 2; mesh.receiveShadow = true;
  let skyNow = null;
  return {
    mesh, mat, uniforms: U,
    update(t, skyColor) {
      U.uTime.value = t;
      if (map.offset) { map.offset.x = (t * .012) % 1; map.offset.y = (t * .02) % 1; }
      if (skyColor && skyColor.isColor && skyColor !== skyNow) U.uSky.value.copy(skyColor);
    },
  };
}

// Breaking waves: white foam bands that roll in towards a straight beach line and fade on the sand.
// segs: [[x0, x1]] spans along x; shoreZ: world z of the waterline; seaward = -1 when the sea lies at smaller z.
export function shoreWaves(T, parent, { segs, shoreZ, seaward = -1, y = .02, n = 3, period = 6.5, reach = 3.2, width = 1.1 }) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.35, 'rgba(255,255,255,.95)'); g.addColorStop(.55, 'rgba(255,255,255,.75)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 128);
  for (let k = 0; k < 160; k++) { x.fillStyle = `rgba(255,255,255,${Math.random() * .6})`; x.beginPath(); x.arc(Math.random() * 64, 40 + Math.random() * 50, 1 + Math.random() * 2.5, 0, 7); x.fill(); }
  const tex = new T.CanvasTexture(c); if (tex.wrapS !== undefined) tex.wrapS = T.RepeatWrapping;
  const bands = [];
  for (const [x0, x1] of segs) for (let k = 0; k < n; k++) {
    const L = x1 - x0, m = new T.Mesh(new T.PlaneGeometry(L, width, Math.max(1, Math.round(L / 2)), 1), new T.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, y, shoreZ); m.renderOrder = 2; parent.add(m);
    if (m.material.map && m.material.map.repeat) { m.material.map = tex; }
    bands.push({ m, ph: k / n + (x0 * .013) % 1, wob: Math.random() * 6 });
  }
  return (t) => {
    for (const b of bands) {
      const f = ((t / period + b.ph) % 1 + 1) % 1; // 0 -> far out, 1 -> washed up
      const e = 1 - Math.pow(1 - f, 2.2);
      b.m.position.z = shoreZ + seaward * reach * (1 - e) + seaward * -.25;
      b.m.material.opacity = Math.min(1, f * 4) * (1 - Math.pow(f, 3)) * .85;
      b.m.scale.y = .7 + f * .9;
      b.m.position.x += Math.sin(t * .7 + b.wob) * .002;
    }
  };
}
