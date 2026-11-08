// [hybrid/look, owned by the Look TD; forked from lab/noir] Lamplit Gouache shading.
// A patched MeshLambertMaterial (three's lights + shadow maps still do the work) whose direct light is remapped into
// painted value steps. Step thresholds are broken by a brush field ANCHORED TO THE OBJECT (or world) - never animated,
// so it cannot swim or boil. Shadows are coloured (teal low / violet high, never black). Painted specular steps give
// real glints on metal / wet / plastic; brand-locked materials land exactly on the brand hex in their top lit step.
// The same shader carries the three signature states through shared uniforms (see setLookState / setSweep):
//   uState 0 = BLUEPRINT (navy paper + cyan line work; post ink draws the lines), 1 = X-RAY (glaze, or clear resin
//   for shells with opts.resin), 2 = SOLID gouache. A world-space print sweep blends uState -> uState2.
// API is additive only: gouache(opts), U, BRAND, lin, initShared(), glazeMaterial, beamMaterial, cardLineMaterial
// keep their old behaviour; new: brandMat, setLookState, setSweep, lookMaterials.
import * as THREE from "three";
import { brushTex, paperTex } from "./paint";
import { BRAND as BRAND_, untone, brandPaint } from "./colors";

export const lin = (hex: string) => new THREE.Color(hex); // THREE.Color(hex) is converted sRGB->linear
export const BRAND = BRAND_;

// shared uniforms (one object -> every gouache material, the post ink and the beams see the same state)
export const U = {
  uState: { value: 2 },
  uBrush: { value: null as THREE.Texture | null },
  uPaper: { value: null as THREE.Texture | null },
  uShadeLo: { value: lin("#173a46") }, // teal, low in the shaft
  uShadeHi: { value: lin("#2b2547") }, // violet, high in the shaft
  uFogCol: { value: lin("#1d3a4c") },
  uFogHi: { value: lin("#2a3555") },
  uFogDen: { value: 0.045 },
  uRimCol: { value: lin("#9fe3f2") },
  uRimDir: { value: new THREE.Vector2(0.6, 0.5) },
  uNavy: { value: untone(BRAND.navy) },
  uCyan: { value: untone(BRAND.cyan) },
  uXrayDim: { value: 0.35 },
  // --- additive (look v2) ---
  uState2: { value: 2 },                                   // sweep target state
  uSweepOn: { value: 0 },                                  // 1 = print sweep active
  uSweep: { value: new THREE.Vector4(0, 1, 0, -100) },     // plane: points with dot(n,p) < w show uState2
  uSweepSoft: { value: 0.06 },                             // half width of the blend band (m)
  uSweepGlow: { value: 0.55 },                             // cyan "print head" glow on the band
  uShadeFloor: { value: 0.10 },                            // shadow pigment floor: dark albedos never go black
  uShadeK: { value: 1.15 },                                // shadow (indirect) strength
};
export function initShared() {
  U.uBrush.value = brushTex();
  U.uPaper.value = paperTex();
}

export type GouacheOpts = {
  map?: THREE.Texture; color?: string; normalMap?: THREE.Texture; normalScale?: number;
  card?: boolean;       // painted cut-out (uv brush space, rim from the normal map)
  rim?: number;         // rim strength
  grid?: number;        // blueprint grid strength (walls)
  brush?: number;       // ramp-threshold breakup
  brushScale?: number;  // brush texture repeats per metre (world) or per card
  emissive?: string; emissiveIntensity?: number;
  transparent?: boolean; side?: THREE.Side;
  bpFill?: number;      // how much of the blueprint navy fill shows (0 = invisible in blueprint)
  xray?: number;        // 0: keep painted in X-RAY, 1: dim to glaze
  // --- additive (look v2) ---
  anchor?: "object" | "world"; // brush/tooth space. object (default) = moves with the mesh, world = continuous across set pieces
  spec?: number;        // painted specular step strength 0..1 (metal 0.8-1, wet/plastic 0.7-0.9, fabric 0)
  gloss?: number;       // specular exponent (20 broad sheen .. 200 tight glint)
  specTh?: number;      // light energy where the glint step sits (lower = bigger glints)
  metal?: number;       // 0..1 painted environment reflection + darker diffuse
  resin?: number;       // 0..1: in X-RAY this mesh becomes a clear resin shell (transparent, Fresnel edge)
  brand?: string;       // brand hex: the top lit step lands exactly on it (use brandMat / colors.brandPaint)
  brandFloor?: number;  // brand: minimum value step (0.85 = self-lit "glow" surfaces)
  tint?: number;        // how much the light hue tints the paint (1 default, brand materials ignore it at the top step)
  lock?: 0 | 1 | 2;     // always render in this state (ignores uState / sweep)
  tooth?: number;       // object-anchored pigment granulation (default 0.06)
  shoulder?: number;    // overbright hot-spot step (1 default; 0 for matte)
  fog?: number;         // haze multiplier (1 default)
  bpLine?: number;      // blueprint Fresnel fill strength (1 default)
};

const RAMP = /* glsl */ `
float paintRamp(float x, float sh){
  // three painted value steps (top step total 1.06); the hot-spot shoulder is hotSpot() below
  return 0.30*smoothstep(0.04,0.07,x) + 0.36*smoothstep(0.23,0.29,x) + 0.40*smoothstep(0.63,0.72,x);
}
// lamp hot spot: where the irradiance is strongest the paint is mixed toward the light colour (opaque pale pool)
float hotSpot(float x){ return smoothstep(1.0, 1.7, x); }`;

const LAMBERT_PARS = /* glsl */ `
varying vec3 vViewPosition;
struct LambertMaterial { vec3 diffuseColor; float specularStrength; };
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
  float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
  vec3 irradiance = dotNL * directLight.color;
  reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
  if (uSpec > 0.0) {
    vec3 H = normalize(directLight.direction + geometryViewDir);
    float nh = saturate(dot(geometryNormal, H));
    gSpec += directLight.color * pow(nh, uGloss) * smoothstep(0.0, 0.2, dotNL);
  }
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
  reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct RE_Direct_Lambert
#define RE_IndirectDiffuse RE_IndirectDiffuse_Lambert
`;

/** every gouache material, for state flag syncing (transparent resin / bpFill) */
export const lookMaterials = new Set<THREE.MeshLambertMaterial>();

function patch(src: string, find: string, repl: string) {
  if (!src.includes(find)) throw new Error(`gouache: shader chunk "${find}" not found (three changed?)`);
  return src.replace(find, repl);
}

export function gouache(o: GouacheOpts = {}) {
  const m = new THREE.MeshLambertMaterial({
    color: o.color ?? "#ffffff",
    emissive: o.emissive ?? "#000000", emissiveIntensity: o.emissiveIntensity ?? 1,
    transparent: o.transparent ?? false, side: o.side ?? THREE.FrontSide,
  });
  if (o.map) m.map = o.map;
  if (o.normalMap) m.normalMap = o.normalMap;
  if (o.normalMap) m.normalScale.set(o.normalScale ?? 1, o.normalScale ?? 1);
  const local = {
    uCard: { value: o.card ? 1 : 0 }, uRim: { value: o.rim ?? 0.35 }, uGrid: { value: o.grid ?? 0 },
    uBrushAmt: { value: o.brush ?? 0.7 }, uBrushScale: { value: o.brushScale ?? 0.9 },
    uBpFill: { value: o.bpFill ?? 1 }, uXray: { value: o.xray ?? 1 },
    uAnchor: { value: (o.anchor ?? "object") === "object" && !o.card ? 1 : 0 },
    uSpec: { value: o.spec ?? 0 }, uGloss: { value: o.gloss ?? 40 }, uSpecTh: { value: o.specTh ?? 0.6 },
    uMetal: { value: o.metal ?? 0 }, uResin: { value: o.resin ?? 0 },
    uBrandOn: { value: o.brand ? 1 : 0 }, uBrandCol: { value: o.brand ? untone(o.brand) : new THREE.Color(0, 0, 0) },
    uBrandFloor: { value: o.brandFloor ?? 0 },
    uTint: { value: o.tint ?? 1 }, uLock: { value: o.lock ?? -1 }, uTooth: { value: o.tooth ?? 0.06 },
    uShoulder: { value: o.shoulder ?? 1 }, uFogK: { value: o.fog ?? 1 }, uBpLine: { value: o.bpLine ?? 1 },
  };
  m.userData.u = local;
  m.userData.look = { resin: o.resin ?? 0, bpFill: o.bpFill ?? 1, transparent: m.transparent, side: m.side, depthWrite: m.depthWrite, lock: o.lock ?? -1 };
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, U, local);
    let vs = s.vertexShader;
    vs = patch(vs, "#include <common>", "#include <common>\nvarying vec3 vWP; varying vec3 vWN; varying vec2 vUv2; varying vec3 vOP; varying vec3 vON;");
    vs = patch(vs, "#include <project_vertex>", `#include <project_vertex>
        vec4 wp4 = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wp4 = instanceMatrix * wp4;
        #endif
        vWP = (modelMatrix * wp4).xyz;
        vWN = normalize((vec4(transformedNormal, 0.0) * viewMatrix).xyz);
        vec3 osc = vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), length(modelMatrix[2].xyz));
        vOP = position * osc; vON = normal; vUv2 = uv;`);
    s.vertexShader = vs;
    let fs = s.fragmentShader;
    fs = patch(fs, "#include <common>", `#include <common>
        varying vec3 vWP; varying vec3 vWN; varying vec2 vUv2; varying vec3 vOP; varying vec3 vON;
        uniform float uState, uState2, uSweepOn, uSweepSoft, uSweepGlow; uniform vec4 uSweep;
        uniform float uCard, uRim, uGrid, uBrushAmt, uBrushScale, uFogDen, uBpFill, uXray, uXrayDim;
        uniform float uAnchor, uSpec, uGloss, uSpecTh, uMetal, uResin, uBrandOn, uBrandFloor, uTint, uLock, uTooth, uShoulder, uFogK, uBpLine, uShadeFloor, uShadeK;
        uniform vec3 uBrandCol;
        uniform sampler2D uBrush, uPaper;
        uniform vec3 uShadeLo, uShadeHi, uFogCol, uFogHi, uRimCol, uNavy, uCyan;
        uniform vec2 uRimDir;
        vec3 gSpec = vec3(0.0);
        ${RAMP}
        float lumv(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
        vec2 domUV(vec3 P, vec3 N){ vec3 a = abs(N); return (a.x > a.y && a.x > a.z) ? P.zy : (a.y > a.z ? P.xz : P.xy); }
        float brushAt(vec3 P, vec3 Nn){
          if (uCard > 0.5) return texture2D(uBrush, vUv2 * uBrushScale).r;
          vec3 n = abs(Nn); n = n * n; n = n * n; n /= (n.x + n.y + n.z);   // sharp triplanar blend (no muddy cross-fades)
          vec3 p = P * uBrushScale;
          return texture2D(uBrush, p.zy).r * n.x + texture2D(uBrush, p.xz + 0.37).r * n.y + texture2D(uBrush, p.xy + 0.71).r * n.z;
        }`);
    fs = patch(fs, "#include <lights_lambert_pars_fragment>", LAMBERT_PARS);
    fs = patch(fs, "#include <aomap_fragment>", `#include <aomap_fragment>
        vec3 aP = uAnchor > 0.5 ? vOP : vWP;
        vec3 aN = normalize(uAnchor > 0.5 ? vON : vWN);
        float bn = brushAt(aP, aN);
        float tooth = uTooth > 0.0 ? texture2D(uBrush, domUV(aP, aN) * uBrushScale * 5.3 + 0.19).r : 0.5;
        vec3 specOut = vec3(0.0);
        {
          vec3 alb = max(diffuseColor.rgb, vec3(0.004));
          vec3 irr = reflectedLight.directDiffuse / (alb * RECIPROCAL_PI);
          float L = lumv(irr);
          float Lb = L * (1.0 + (bn - 0.5) * uBrushAmt) + (bn - 0.5) * 0.02 * uBrushAmt;
          float q = paintRamp(Lb, uShoulder * (1.0 - uBrandOn));
          vec3 hue = irr / max(L, 1e-4);
          hue = mix(vec3(1.0), hue, smoothstep(0.0, 0.03, L) * uTint);
          float hk = smoothstep(-3.0, 4.0, vWP.y);
          vec3 shadeCol = mix(uShadeLo, uShadeHi, hk);
          vec3 ind = reflectedLight.indirectDiffuse + (alb * (0.6 + 0.3 * bn) + uShadeFloor) * shadeCol * uShadeK * (uCard > 0.5 ? 1.9 : 1.0);
          float hot = hotSpot(Lb) * uShoulder * (1.0 - uBrandOn);
          vec3 dir = alb * hue * q * (1.0 + 0.25 * hot);
          dir = mix(dir, mix(hue, vec3(1.0), 0.45) * (0.84 + 0.2 * lumv(alb)), hot * 0.72);
          if (uBrandOn > 0.5) {
            // brand lock: top step = exact brand colour whatever the light colour; lower steps fall into the shade
            float v = max(clamp(q / 1.06, 0.0, 1.0), uBrandFloor);
            vec3 lit = uBrandCol * mix(hue, vec3(1.0), 0.5 + 0.5 * v);
            dir = mix(ind, lit, v);
            ind = vec3(0.0);
          }
          if (uMetal > 0.0) {
            // painted environment: dark shaft below, lamp-lit haze above, one painted strip-light streak
            vec3 Vw = normalize(vWP - cameraPosition);
            vec3 Rw = reflect(Vw, normalize(vWN));
            float up = Rw.y + (bn - 0.5) * 0.25;
            vec3 env = mix(shadeCol * 2.0, uFogHi * 3.2 + vec3(0.03), smoothstep(-0.2, 0.35, up));
            env += vec3(0.62, 0.56, 0.48) * smoothstep(0.07, 0.0, abs(up - 0.5));
            dir *= 1.0 - 0.6 * uMetal;
            ind = ind * (1.0 - 0.4 * uMetal) + env * (0.35 + 0.65 * alb) * uMetal;
          }
          reflectedLight.directDiffuse = dir;
          reflectedLight.indirectDiffuse = ind;
          if (uSpec > 0.0) {
            // painted specular: a hard-edged glint step + a broad sheen step, edges broken by the brush field
            float E = lumv(gSpec);
            float sb = 1.0 + (bn - 0.5) * 0.6;
            float g1 = smoothstep(uSpecTh * 0.85, uSpecTh * 0.97, E * sb);          // glint core (near white)
            float g2 = smoothstep(uSpecTh * 0.42, uSpecTh * 0.50, E * sb) * 0.30;   // inner sheen step
            float g3 = smoothstep(uSpecTh * 0.18, uSpecTh * 0.24, E * sb) * 0.12;   // outer sheen step
            vec3 sh = mix(vec3(1.0), gSpec / max(E, 1e-4), 0.3);
            specOut = clamp(sh * (g1 * 0.56 + g2 + g3) * uSpec, 0.0, 0.98);
          }
        }`);
    fs = patch(fs, "#include <opaque_fragment>", `#include <opaque_fragment>
        {
          vec3 V = normalize(vViewPosition);
          vec3 N = normalize(normal);
          float fr = pow(1.0 - clamp(abs(dot(N, V)), 0.0, 1.0), 2.5);
          float side = uCard > 0.5 ? clamp(dot(normalize(N.xy + 1e-4), uRimDir) * 0.8 + 0.35, 0.0, 1.0) * smoothstep(0.02, 0.25, length(N.xy)) : 1.0;
          vec3 solid = gl_FragColor.rgb + uRimCol * fr * uRim * side * (0.7 + 0.6 * bn);
          // pigment variation + object-anchored tooth (static: gouache is never perfectly flat)
          solid *= mix(0.94 + 0.12 * bn, 0.975 + 0.05 * bn, uBrandOn) * (1.0 + (tooth - 0.5) * uTooth * (1.0 - 0.5 * uBrandOn));
          solid += specOut * (1.0 - min(solid, vec3(1.0)));   // screen-blend glint: never exceeds white
          // atmosphere: distance + height haze (lifted teal, never black)
          float d = length(vWP - cameraPosition);
          float f = (1.0 - exp(-pow(d * uFogDen, 1.6))) * uFogK * mix(1.0, 0.3, uBrandOn);
          vec3 fogc = mix(uFogCol, uFogHi, smoothstep(-4.0, 8.0, vWP.y));
          solid = mix(solid, fogc, f);
          float a0 = gl_FragColor.a;
          float sA = uLock > -0.5 ? uLock : uState;
          float sB = uLock > -0.5 ? uLock : uState2;
          float k = 0.0, head = 0.0;
          if (uSweepOn > 0.5 && uLock < -0.5) {
            float sd = dot(uSweep.xyz, vWP) - uSweep.w;
            k = smoothstep(uSweepSoft, -uSweepSoft, sd);
            head = exp(-pow(sd / max(uSweepSoft * 0.5, 1e-3), 2.0)) * (1.0 - fr * 0.5);
          }
          bool needBP = sA < 0.5 || (k > 0.0 && sB < 0.5);
          bool needXR = (sA > 0.5 && sA < 1.5) || (k > 0.0 && sB > 0.5 && sB < 1.5);
          vec3 xr = solid; float aX = a0;
          if (needXR) {
            float lum = lumv(solid);
            vec3 glaze = uNavy * 1.1 + lum * vec3(0.10, 0.30, 0.42) * uXrayDim;
            glaze += uCyan * (pow(fr, 1.5) * 0.55 + 0.02) * (0.6 + 0.8 * bn);
            xr = mix(solid, glaze, uXray);
            if (uResin > 0.0) {
              // clear resin shell: navy-cyan tint, bright Fresnel edge, glints; mostly see-through face-on
              float e = pow(fr, 1.3);
              vec3 rc = uNavy * 0.6 + uCyan * (0.05 + e * 0.9) * (0.75 + 0.5 * bn) + specOut;
              float ra = clamp(0.13 + e * 0.8 + lumv(specOut) * 0.8, 0.0, 1.0);
              xr = mix(xr, rc, uResin); aX = mix(a0, ra, uResin);
            }
          }
          vec3 bp = solid; float aB = a0;
          if (needBP) {
            vec3 wn = normalize(vWN);
            bp = texture2D(uPaper, domUV(aP, aN) * 0.35).rgb;
            vec3 gp = vWP * 4.0;
            vec3 gw = fwidth(gp);
            vec3 gl = 1.0 - smoothstep(vec3(0.0), gw * 1.2, abs(fract(gp - 0.5) - 0.5));
            vec3 gw2 = fwidth(vWP);
            vec3 gl2 = 1.0 - smoothstep(vec3(0.0), gw2 * 1.8, abs(fract(vWP - 0.5) - 0.5));
            vec3 an = abs(wn);
            float grid = an.z > 0.5 ? max(gl.x, gl.y) * 0.3 + max(gl2.x, gl2.y) * 0.5 : an.x > 0.5 ? max(gl.z, gl.y) * 0.3 + max(gl2.z, gl2.y) * 0.5 : max(gl.x, gl.z) * 0.3 + max(gl2.x, gl2.z) * 0.5;
            bp += uCyan * (grid * uGrid * 0.55 + fr * 0.10 * uBpLine + 0.012);
            bp = mix(bp, uCyan * 0.18 + uNavy, smoothstep(6.0, 22.0, d) * 0.6); // cyan haze glow far away
            aB = a0 * uBpFill;
          }
          vec3 cA = sA < 0.5 ? bp : (sA < 1.5 ? xr : solid);
          float aA = sA < 0.5 ? aB : (sA < 1.5 ? aX : a0);
          vec3 cB = sB < 0.5 ? bp : (sB < 1.5 ? xr : solid);
          float aBB = sB < 0.5 ? aB : (sB < 1.5 ? aX : a0);
          gl_FragColor = vec4(mix(cA, cB, k) + uCyan * head * uSweepGlow, mix(aA, aBB, k));
        }`);
    fs = fs.replace("#include <fog_fragment>", "");
    s.fragmentShader = fs;
  };
  m.customProgramCacheKey = () => `gouache2-${o.card ? 1 : 0}`;
  lookMaterials.add(m);
  syncOne(m);
  return m;
}

/** brand-locked gouache material (see colors.brandPaint for the kinds) */
export function brandMat(hex: string, extra: Parameters<typeof brandPaint>[1] = {}) {
  return gouache(brandPaint(hex, extra));
}

// ---------------------------------------------------------------- states
const involves = (s: number) => Math.round(U.uState.value) === s || (U.uSweepOn.value > 0.5 && Math.round(U.uState2.value) === s);
function syncOne(m: THREE.MeshLambertMaterial) {
  const L = m.userData.look as { resin: number; bpFill: number; transparent: boolean; side: THREE.Side; depthWrite: boolean; lock: number };
  if (!L) return;
  const inv = (s: number) => (L.lock >= 0 ? L.lock === s : involves(s));
  const resinOn = L.resin > 0 && inv(1);
  const fillOff = L.bpFill < 1 && inv(0);
  const tr = L.transparent || resinOn || fillOff;
  const side = resinOn ? THREE.DoubleSide : L.side;
  const dw = resinOn ? false : L.depthWrite;
  if (m.transparent !== tr || m.side !== side) m.needsUpdate = true;
  m.transparent = tr; m.side = side; m.depthWrite = dw;
}
/** sync transparent/depthWrite/side of resin shells and bpFill<1 materials with the current state */
export function syncLookFlags() { lookMaterials.forEach(syncOne); }
/** set the signature state for every gouache material (and the post ink, which reads U) */
export function setLookState(s: 0 | 1 | 2) {
  U.uState.value = s; U.uState2.value = s; U.uSweepOn.value = 0;
  syncLookFlags();
}
/**
 * Print sweep between two states. Points with dot(normal, p) < offset show `to`; the band (±soft m) glows cyan.
 * e.g. BLUEPRINT -> SOLID rising from the floor: setSweep(0, 2, { offset: y }) with offset animated upward.
 * Pass null to end the sweep (the state stays `from`; call setLookState(to) when the sweep has passed everything).
 */
export function setSweep(from: 0 | 1 | 2, to: 0 | 1 | 2, plane: { offset: number; normal?: THREE.Vector3; soft?: number; glow?: number } | null) {
  U.uState.value = from; U.uState2.value = to;
  if (!plane) { U.uSweepOn.value = 0; syncLookFlags(); return; }
  const n = (plane.normal ?? new THREE.Vector3(0, 1, 0)).clone().normalize();
  U.uSweep.value.set(n.x, n.y, n.z, plane.offset);
  U.uSweepSoft.value = plane.soft ?? 0.06;
  U.uSweepGlow.value = plane.glow ?? 0.55;
  U.uSweepOn.value = 1;
  syncLookFlags();
}

/** X-RAY shell: translucent glaze with a Fresnel edge, the edge broken by brush texture */
export function glazeMaterial(tint = BRAND.cyan, strength = 1) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { uTint: { value: lin(tint) }, uK: { value: strength }, uBrush: U.uBrush },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; vW = position; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uTint; uniform float uK; uniform sampler2D uBrush; varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){ float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        float b = texture2D(uBrush, vW.xy*1.3 + vW.z*0.7).r;
        float e = pow(f, 2.2) * (0.6 + 0.8*b);
        gl_FragColor = vec4(uTint * (0.035 + e * 0.75) * uK, 1.0); }`,
  });
}

/** additive light volume (cone/sheet): brighter along its axis, faded at ends and at grazing angles, painted noise.
 *  Noise is anchored to the cone's uv; uT scrolls it - keep uT constant within a shot (temporal stability). */
export function beamMaterial(color: string, intensity: number, o: { noise?: THREE.Texture; axisFade?: number; scroll?: number } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { uCol: { value: lin(color) }, uI: { value: intensity }, uNoise: { value: o.noise ?? null }, uT: { value: 0 }, uState: U.uState, uCyan: U.uCyan },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv = uv; vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = -mv.xyz; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uCol; uniform float uI; uniform sampler2D uNoise; uniform float uT; uniform float uState; uniform vec3 uCyan;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        float face = abs(dot(normalize(vN), normalize(vV)));
        float along = 1.0 - vUv.y;            // cone: source at the top (uv.y = 1), 0 -> 1 along the beam
        float a = pow(1.0 - along, 1.6) * smoothstep(0.0, 0.06, along);
        a *= smoothstep(0.05, 0.6, face) * (0.4 + 0.6 * face);
        float n = texture2D(uNoise, vec2(vUv.x * 3.0 + uT * 0.02, vUv.y * 0.8 - uT * 0.035)).r;
        float n2 = texture2D(uNoise, vec2(vUv.x * 0.7 - uT * 0.013, vUv.y * 1.6 + 0.3)).r;
        a *= 0.35 + 1.6 * n + 0.8 * n2;
        vec3 c = uState < 0.5 ? uCyan * 0.8 : uCol;
        gl_FragColor = vec4(c * a * uI, 1.0);
      }`,
  });
}

/** blueprint card: navy fill (from the painted alpha) + cyan under-drawing lines */
export function cardLineMaterial(paint: THREE.Texture, line: THREE.Texture) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: true,
    uniforms: { uMap: { value: paint }, uLine: { value: line }, uNavy: U.uNavy, uCyan: U.uCyan },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform sampler2D uMap; uniform sampler2D uLine; uniform vec3 uNavy; uniform vec3 uCyan; varying vec2 vUv;
      void main(){ float a = texture2D(uMap, vUv).a; float l = texture2D(uLine, vUv).a;
        if (a < 0.02 && l < 0.02) discard;
        vec3 c = mix(uNavy * 1.25, uCyan * 1.05, l);
        gl_FragColor = vec4(c, max(a * 0.92, l)); }`,
  });
}
