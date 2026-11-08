// ENGRAVING look: every surface is a patched MeshPhongMaterial whose lit result is turned into
// ink coverage (engraved hatching) instead of a colour. Output is a 2-target MRT:
//   out0 = (key-ink coverage, spot coverage, spot id / 8, glow)
//   out1 = (view normal * .5 + .5, view depth in metres)  -> contour/crease pass + hidden lines
// Hatching is anchored in OBJECT space (no "shower door") and picks a power-of-two line period per
// pixel from screen derivatives, cross-fading odd lines, so on-screen spacing stays ~uPeriod px at any
// distance (tonal-art-map style, analytic AA). Tone -> line WIDTH (engraver's swelling line), then a
// 2nd and 3rd direction for cross-hatch / near-solid.
import * as THREE from "three";

export const SPOT = { none: 0, cyan: 1, red: 2, green: 3, amber: 4, light: 5 } as const;
export const KIND = { plain: 0, brick: 1, concrete: 2, metal: 3, plate: 4, rope: 5, solid: 6, char: 7, paint: 8, paper: 9 } as const;
export const XROLE = { env: 0, shell: 1, hero: 2, xonly: 3 } as const;

// Shared uniforms (one object, referenced by every material).
export const U = {
  uPx: { value: 0.5 },          // buffer height / 1920
  uPeriod: { value: 17.0 },     // hatch period in 1080-wide px
  uExposure: { value: 2.6 },
  uBp: { value: 0 },            // blueprint mix
  uXr: { value: 0 },            // x-ray mix
  uFeet: { value: [new THREE.Vector3(0, -99, 0), new THREE.Vector3(0, -99, 0)] },
  uFadeY: { value: new THREE.Vector2(3.2, 9.5) }, // darkness ramp up the shaft (world y)
  uFadeYLo: { value: new THREE.Vector2(-1.2, -6.0) }, // and down the shaft
  uRedK: { value: 1.0 },        // how strongly red light prints as red spot ink
};

export type InkOpts = {
  albedo?: number; angle?: number; kind?: number; spot?: number; spotAmt?: number; glow?: number;
  shininess?: number; spec?: number; xrole?: number; uvScale?: [number, number]; section?: boolean;
  contact?: boolean; map?: THREE.Texture; normalMap?: THREE.Texture; alphaTest?: number;
  side?: THREE.Side; hatchK?: number; panel?: number;
};

const VERT_DECL = /* glsl */ `
varying vec3 vObjP; varying vec3 vObjN; varying vec3 vWorldP; varying vec2 vUv0;
`;
const VERT_BODY = /* glsl */ `
vObjP = transformed; vObjN = objectNormal; vWorldP = (modelMatrix * vec4(transformed, 1.0)).xyz; vUv0 = uv;
`;

const FRAG_DECL = /* glsl */ `
layout(location = 1) out highp vec4 gND;
varying vec3 vObjP; varying vec3 vObjN; varying vec3 vWorldP; varying vec2 vUv0;
uniform float uPx, uPeriod, uExposure, uBp, uXr, uRedK;
uniform vec3 uFeet[2];
uniform vec2 uFadeY, uFadeYLo;
uniform float uAngle, uKind, uSpot, uSpotAmt, uGlow, uXrole, uSection, uContact, uHatchK, uPanel;
uniform vec2 uUvScale;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ return 0.55*vnoise(p) + 0.3*vnoise(p*2.03+7.1) + 0.15*vnoise(p*4.1+3.3); }
// anti-aliased line of width w px at pixel distance d
float aaLine(float d, float w){ float we = max(w, 1.0); return clamp(we*0.5 + 0.5 - d, 0.0, 1.0) * (w / we); }
// one hatch direction. s = surface coordinate (m) across the lines, g = |grad s| in m/px (from caller,
// computed in uniform control flow), cov = target ink coverage 0..1
float hatchL(float s, float g, float cov){
  float P = uPeriod * uPx;       // px in the current buffer (uPx = buffer/1920, period given @1080 w)
  float L = log2(P * g / 0.0005);
  float lv = floor(L); float f = L - lv;
  float per = 0.0005 * exp2(lv);
  float t = s / per; float k = floor(t + 0.5);
  float dpx = abs(t - k) * per / g;
  float odd = mod(k, 2.0);
  float w = cov * P * 1.05 * mix(1.0, 1.0 - smoothstep(0.0, 1.0, f), odd);
  return aaLine(dpx, w);
}
// fixed-period (world) line set, e.g. mortar joints or panel seams: distance in m -> px
float seam(float s, float per, float g, float wpx){ float d = abs(fract(s/per + 0.5) - 0.5) * per / g; return aaLine(d, wpx); }
`;

const FRAG_END = /* glsl */ `
{
  vec3 Lout = gl_FragColor.rgb;
  float lum = dot(Lout, vec3(0.2126, 0.7152, 0.0722));
  float T = 1.0 - exp(-uExposure * lum);
  float D = clamp(1.0 - T, 0.0, 1.0);
  vec3 Pq = vObjP; vec3 Nq = normalize(vObjN);
  vec2 q; vec3 aN = abs(Nq);
  bool isUv = (uKind == 5.0 || uKind == 7.0 || uKind == 9.0);
  if (isUv) q = vUv0 * uUvScale;
  else if (aN.x >= aN.y && aN.x >= aN.z) q = vec2(Pq.z, Pq.y);
  else if (aN.y >= aN.z) q = vec2(Pq.x, Pq.z);
  else q = vec2(Pq.x, Pq.y);
  // gradients of the surface coords (uniform control flow)
  vec2 qx = dFdx(q), qy = dFdy(q);
  float gq = max(max(length(vec2(qx.x, qy.x)), length(vec2(qx.y, qy.y))), 1e-6);
  float ink = 0.0; float extraD = 0.0;
  float spotCov = uSpotAmt; float spotId = uSpot;
  vec4 cTex = vec4(0.0);
  // ---- material texture (engraved, light-independent marks + albedo variation) ----
  if (uKind == 1.0) { // brick, 65+10 mm courses, 215+10 mm bricks
    float hb = 0.075; float row = floor(q.y / hb);
    float bx = q.x / 0.225 + mod(row, 2.0) * 0.5; float col = floor(bx);
    float r = h21(vec2(row, col));
    extraD += (r - 0.5) * 0.22 + (fbm(q * 1.3) - 0.5) * 0.25;
    float mort = max(seam(q.y, hb, gq, 1.4 * uPx), seam(bx * 0.225, 0.225, gq, 1.2 * uPx) * step(0.12, fract(q.y/hb)) * step(fract(q.y/hb), 0.88));
    ink = max(ink, mort * (0.35 + 0.65 * smoothstep(0.15, 0.6, T)));
    if (r > 0.93) extraD += 0.18; // soot-dark bricks
  } else if (uKind == 2.0) { // board-formed concrete: panel seams + tie holes + stains
    extraD += (fbm(q * vec2(0.7, 0.35)) - 0.5) * 0.35 + (fbm(q * 4.0) - 0.5) * 0.12;
    float sm = max(seam(q.y, 1.2, gq, 1.6 * uPx), seam(q.x, 1.8, gq, 1.3 * uPx));
    vec2 th = abs(fract(q / vec2(0.6, 0.6) + 0.5) - 0.5) * 0.6; float tie = 1.0 - smoothstep(0.010, 0.016, length(th));
    // board grain: faint horizontal lines every 0.15 m
    float grain = seam(q.y + 0.03 * sin(q.x * 3.0), 0.15, gq, 0.8 * uPx) * 0.45;
    ink = max(ink, max(sm, tie) * (0.4 + 0.6 * T) + grain * T);
  } else if (uKind == 3.0) { // metal: rolled steel, slight mill streaks along length
    extraD += (vnoise(q * vec2(40.0, 2.0)) - 0.5) * 0.12;
  } else if (uKind == 4.0) { // diamond tread plate
    vec2 c = q / 0.045; vec2 cell = floor(c); vec2 fq = fract(c) - 0.5;
    float flip = mod(cell.x + cell.y, 2.0);
    vec2 rr = flip > 0.5 ? vec2(fq.x + fq.y, fq.x - fq.y) : vec2(fq.x - fq.y, fq.x + fq.y);
    float boss = 1.0 - smoothstep(0.06, 0.11, abs(rr.y)) ; boss *= 1.0 - smoothstep(0.25, 0.32, abs(rr.x));
    ink = max(ink, boss * 0.75 * (0.35 + 0.65 * T));
    extraD += (fbm(q * 3.0) - 0.5) * 0.15;
  } else if (uKind == 5.0) { // wire rope: helical strands (uv: u around, v along)
    float strand = seam(q.x * 0.9 + q.y * 0.55, 0.012, max(gq, 1e-6), 1.0 * uPx);
    ink = max(ink, strand * 0.85);
  } else if (uKind == 6.0) { // solid ink (hidden lines, lettering)
    ink = 1.0;
  } else if (uKind == 7.0 || uKind == 9.0) { // drawn figure / decal: R = ink, G = spot, B = albedo, A = alpha
#ifdef USE_MAP
    cTex = texture2D(map, vUv0);
#endif
    ink = max(ink, cTex.r);
    if (uKind == 7.0) { spotCov = cTex.g; spotId = cTex.g > 0.02 ? 4.0 : 0.0; }
    extraD += (1.0 - cTex.b) * 0.0;
  } else if (uKind == 8.0) { // painted steel panels: seams every uPanel m + rivets
    if (uPanel > 0.0) {
      float sx = seam(q.x, uPanel, gq, 1.4 * uPx);
      vec2 rv = abs(fract(vec2(q.x / uPanel + 0.5, q.y / 0.25)) - 0.5) * vec2(uPanel, 0.25);
      float riv = 1.0 - smoothstep(0.006, 0.011, length(vec2(abs(rv.x) - 0.03, rv.y)));
      ink = max(ink, max(sx, riv * 0.8));
    }
    extraD += (fbm(q * 2.0) - 0.5) * 0.10;
  }
  // section cut faces (patent convention: 45 deg section lining), front faces of the walls
  float s45 = (q.x + q.y) * 0.7071;
  float gs = max(length(vec2(dFdx(s45), dFdy(s45))), 1e-6);
  if (uSection > 0.5 && Nq.z > 0.9) {
    ink = max(ink, seam(s45, 0.06, gs, 1.6 * uPx));
    D = 0.2; extraD = 0.0;
  }
  // contact darkening under the feet
  if (uContact > 0.5) {
    for (int i = 0; i < 2; i++) {
      vec2 dxz = (vWorldP.xz - uFeet[i].xz) / vec2(0.20, 0.14);
      float r2 = dot(dxz, dxz);
      extraD += 0.55 * exp(-r2 * 1.6) * step(abs(vWorldP.y - uFeet[i].y), 0.25);
    }
  }
  // night: the shaft disappears into dark above and below
  float fade = smoothstep(uFadeY.x, uFadeY.y, vWorldP.y) + smoothstep(uFadeYLo.x, uFadeYLo.y, vWorldP.y);
  D = clamp(D * uHatchK + extraD * (1.0 - 0.6 * D) + fade * 0.75, 0.0, 1.0);
  // ---- hatching ----
  float a0 = radians(uAngle);
  vec2 d1 = vec2(cos(a0), sin(a0));
  vec2 d2 = vec2(cos(a0 + 1.15), sin(a0 + 1.15));
  vec2 d3 = vec2(cos(a0 - 0.95), sin(a0 - 0.95));
  float s1 = dot(q, d1), s2 = dot(q, d2), s3 = dot(q, d3);
  float g1 = max(length(vec2(dFdx(s1), dFdy(s1))), 1e-7);
  float g2 = max(length(vec2(dFdx(s2), dFdy(s2))), 1e-7);
  float g3 = max(length(vec2(dFdx(s3), dFdy(s3))), 1e-7);
  float bp = uBp;
  float c1 = smoothstep(0.08, 0.70, D) * 0.42;
  float c2 = smoothstep(0.50, 0.88, D) * 0.36 * (1.0 - bp);
  float c3 = smoothstep(0.80, 1.00, D) * 0.50 * (1.0 - bp);
  c1 *= mix(1.0, 0.22, bp) * mix(1.0, smoothstep(0.45, 0.9, D), bp);
  float h = 1.0 - (1.0 - hatchL(s1, g1, c1)) * (1.0 - hatchL(s2, g2, c2)) * (1.0 - hatchL(s3, g3, c3));
  ink = 1.0 - (1.0 - ink) * (1.0 - h);
  // blueprint: faint drafting grid anchored on the object (0.5 m)
  if (bp > 0.0 && !isUv) {
    float gr = max(seam(q.x, 0.5, gq, 1.0 * uPx), seam(q.y, 0.5, gq, 1.0 * uPx));
    ink = max(ink, gr * 0.35 * bp);
  }
  // x-ray: environment ghosts (lighter engraving), shells vanish (their dashed edges are separate meshes)
  if (uXr > 0.0) {
    if (uXrole == 0.0) ink *= mix(1.0, 0.42, uXr);
    if (uXrole == 1.0 && uXr > 0.5) discard;
  } else if (uXrole == 3.0) discard;
  // coloured light prints as spot ink: red alarm light -> red wash on un-inked surfaces
  float redness = max(0.0, Lout.r - max(Lout.g, Lout.b) * 1.15) * uExposure;
  float redCov = smoothstep(0.08, 0.6, redness) * 0.55 * uRedK * (1.0 - bp);
  if (redCov > spotCov * 0.8 && uSpot < 0.5) { spotCov = redCov; spotId = 2.0; }
  if (bp > 0.5) { spotCov *= (uSpot == 3.0 || uSpot == 2.0) ? 1.0 : 0.0; }
  gl_FragColor = vec4(clamp(ink, 0.0, 1.0), clamp(spotCov, 0.0, 1.0), spotId / 8.0, uGlow);
  vec3 gn = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  gND = vec4(gn * 0.5 + 0.5, vViewPosition.z);
}
`;

let matId = 0;
export function inkMat(o: InkOpts = {}): THREE.MeshPhongMaterial {
  const a = o.albedo ?? 0.6;
  const m = new THREE.MeshPhongMaterial({
    color: new THREE.Color(a, a, a),
    specular: new THREE.Color(o.spec ?? 0.05, o.spec ?? 0.05, o.spec ?? 0.05),
    shininess: o.shininess ?? 12,
    side: o.side ?? THREE.FrontSide,
    alphaTest: o.alphaTest ?? 0,
    map: o.map ?? null,
    normalMap: o.normalMap ?? null,
  });
  const own = {
    uAngle: { value: o.angle ?? 30 }, uKind: { value: o.kind ?? KIND.plain }, uSpot: { value: o.spot ?? 0 },
    uSpotAmt: { value: o.spotAmt ?? 0 }, uGlow: { value: o.glow ?? 0 }, uXrole: { value: o.xrole ?? XROLE.env },
    uSection: { value: o.section ? 1 : 0 }, uContact: { value: o.contact ? 1 : 0 }, uHatchK: { value: o.hatchK ?? 1 },
    uUvScale: { value: new THREE.Vector2(...(o.uvScale ?? [1, 1])) }, uPanel: { value: o.panel ?? 0 },
  };
  (m.userData as any).u = own;
  const id = ++matId;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U, own);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\n" + VERT_DECL)
      .replace("#include <project_vertex>", "#include <project_vertex>\n" + VERT_BODY);
    let fs = sh.fragmentShader
      .replace("#include <common>", "#include <common>\n" + FRAG_DECL)
      .replace("#include <dithering_fragment>", "#include <dithering_fragment>\n" + FRAG_END);
    // drawn figures: the map holds data channels, not colour -> albedo from B, alpha from A
    fs = fs.replace("#include <map_fragment>", `
#ifdef USE_MAP
  vec4 mTex = texture2D(map, vMapUv);
  diffuseColor.rgb *= 0.08 + 0.92 * mTex.b * mTex.b;
  diffuseColor.a *= mTex.a;
#endif`);
    if (!fs.includes("gND = vec4")) throw new Error("engraving: phong chunk changed");
    sh.fragmentShader = fs;
  };
  m.customProgramCacheKey = () => "engr" + (o.map ? "m" : "") + (o.normalMap ? "n" : "") + (o.alphaTest ? "a" : "");
  void id;
  return m;
}

export function setU(m: THREE.Material, k: string, v: number) {
  const u = (m.userData as any).u; if (u && u[k]) u[k].value = v;
}
