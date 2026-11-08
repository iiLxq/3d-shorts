// [hybrid/cast] Character paint material = the shared look/ gouache() material (object-anchored brush + tooth, painted
// value steps, brand lock for the amber jacket) + cast-specific patches:
//  1. the skull material paints the face (face.ts) into diffuseColor before lighting, so the face is lit/shadowed like
//     the sculpted head and turns with it; a "bounce" term lifts the brow/eye band under a helmet peak (headlamp
//     bounce off the cream shell, the classic cinematographer's eye light);
//  2. CLOTH: painted fabric folds. Skinned garments carry a per-vertex fold coordinate (aFold, garment.ts); the shader
//     turns it into object-anchored fold strokes (elbow/knee creases, waist rumples, armpit drag lines, gravity drape)
//     by bending the shading normal, so folds fall into the painted value steps (the brand-locked amber keeps its top
//     step exactly on #FFB020; the folds and the shadow plane go warm amber-brown via uWarm). Creases deepen with the
//     live joint bends (uBendA/B, set by setPose);
//  3. HAIR: painted strand strokes along meridians that converge on a point (the bun / the crown), clump grooves dark,
//     strand ridges with a painted sheen;
//  4. per-character signature state via the look's per-material lock (uLock): BLUEPRINT = the look's navy paper + cyan
//     face ink (+ our outline hull in the lab), X-RAY = coloured RESIN (the person stays amber, additive Fresnel glaze
//     so the cyan skeleton inside shows through), SOLID = gouache.
// The look/ shader is read-only: our patches are string inserts that no-op if the look renames a chunk.
import * as THREE from "three";
import { gouache, BRAND, GouacheOpts } from "../look/shade";
import { FACE_FRAG_PARS, FACE_VERT, FACE_VERT_PARS, FaceUniforms } from "./face";

export type CastUniforms = { uResinA: { value: number }; uBendA: { value: THREE.Vector4 }; uBendB: { value: THREE.Vector4 } };
export const castUniforms = (): CastUniforms => ({ uResinA: { value: 0.85 }, uBendA: { value: new THREE.Vector4() }, uBendB: { value: new THREE.Vector4() } });

export type CharMatOpts = {
  rim?: number; brush?: number; brushScale?: number; emissive?: string; emissiveIntensity?: number;
  spec?: number; gloss?: number; metal?: number; specTh?: number; hot?: number; tooth?: number;
  face?: FaceUniforms;  // skull only
  jaw?: FaceUniforms;   // follows the jaw drop (beard volume pieces)
  fold?: number;        // painted fold strength (cloth; geometry must carry aFold, zero = none)
  warm?: [string, number]; // warm shadow pigment (linear mix into the look's teal/violet shade colour)
  strand?: { k: number; n: number; focus: THREE.Vector3; light?: string }; // hair strands converging on focus (object space)
  bounce?: number;      // face only: brow/eye band fill
};

const FOLD_PARS = /* glsl */ `
varying vec4 vFold; uniform vec4 uBendA, uBendB; uniform float uFoldK;
float bendOf(float id){
  if (id < 0.5) return uBendA.x; if (id < 1.5) return uBendA.y; if (id < 2.5) return uBendA.z; if (id < 3.5) return uBendA.w;
  if (id < 4.5) return uBendB.x; return 0.0;
}
float gCrease = 0.0;
// fold height field (m): negative = valley. F = (u along the part from the crease, angle (0 = crease side), id, mask)
float foldH(vec4 F, vec3 P){
  if (F.w < 0.01) return 0.0;
  float u = F.x, a = F.y, b = bendOf(F.z);
  float n1 = texture2D(uBrush, P.xy * 2.3 + P.z * 1.3 + 0.17).r - 0.5;
  float n2 = texture2D(uBrush, P.zy * 1.7 + 0.53).r - 0.5;
  float h = 0.0, cr = 0.0;
  if (F.z < 3.5) {
    // limb crease: 3 curved strokes wrapping the inner side, deeper and tighter with the bend
    float side = cos(a);
    float wrap = smoothstep(-0.35, 0.7, side);
    for (int i = 0; i < 3; i++) {
      float fi = float(i) - 1.0;
      float c = fi * (0.03 - 0.008 * b) + 0.014 * sin(a * 1.6 + fi * 2.0) * (0.6 + n2) + n1 * 0.012;
      float d = (u - c) / (0.0055 + 0.004 * (1.0 - b));
      float k = exp(-d * d) * wrap * (0.35 + 0.9 * b) * (1.0 - 0.35 * abs(fi));
      h -= k; cr = max(cr, k);
    }
    // back of the bend: one soft stretch ridge
    h += 0.35 * b * exp(-pow(u / 0.03, 2.0)) * smoothstep(0.2, -0.8, side);
    // gravity drape: long diagonal low-relief folds along the whole part (static, object anchored)
    float dr = sin(u * 22.0 + a * 2.0 + n1 * 4.0);
    float dm = smoothstep(0.55, 0.95, dr) * (0.5 + n2);
    h -= 0.4 * dm; cr = max(cr, dm * 0.5);
  } else if (F.z < 4.5) {
    // torso: waist rumples just above the hem/belt (deeper when the spine flexes) + a few hanging drag lines
    float rz = exp(-pow((u - 0.05) / 0.07, 2.0));
    float wav = sin(u * 95.0 + sin(a * 3.0 + n1 * 3.0) * 1.6 + n2 * 2.0);
    float rm = smoothstep(0.35, 0.95, wav) * rz * (0.5 + 0.8 * b) * (0.7 + n1);
    h -= rm; cr = max(cr, rm);
    // armpit drag lines: radiate from the armpits down/in across the chest and back
    for (int s = 0; s < 2; s++) {
      float sg = s == 0 ? 1.0 : -1.0;
      vec2 q = vec2((a - sg * 1.35) * 0.17 * sg, u - uBendB.w);
      float r = length(q);
      float th = atan(q.y, -q.x);
      float st = sin(th * 7.0 + n1 * 2.5);
      float am = smoothstep(0.6, 0.98, st) * smoothstep(0.015, 0.04, r) * (1.0 - smoothstep(0.08, 0.16, r)) * step(q.y, 0.02);
      h -= am * 0.9; cr = max(cr, am * 0.8);
    }
    float dr = sin(a * 9.0 + n1 * 3.0 + u * 4.0);
    float dm = smoothstep(0.75, 0.98, dr) * smoothstep(0.32, 0.05, u) * 0.6;
    h -= dm; cr = max(cr, dm * 0.4);
  }
  gCrease = clamp(cr, 0.0, 1.0) * F.w;
  return h * 0.004 * uFoldK * F.w;
}
vec3 foldNormal(vec3 surf_pos, vec3 surf_norm, float hh, float faceDir){
  vec3 sx = dFdx(surf_pos), sy = dFdy(surf_pos);
  vec2 dh = vec2(dFdx(hh), dFdy(hh));
  vec3 R1 = cross(sy, surf_norm), R2 = cross(surf_norm, sx);
  float det = dot(sx, R1) * faceDir;
  vec3 g = sign(det) * (dh.x * R1 + dh.y * R2);
  return normalize(abs(det) * surf_norm - g);
}`;

const STRAND_PARS = /* glsl */ `
uniform vec4 uStrand; uniform vec3 uStrandF; uniform vec3 uStrandL;
float strandField(vec3 P){
  vec3 d = normalize(P - uStrandF);
  vec3 ax = normalize(-uStrandF);
  vec3 t1 = normalize(cross(ax, vec3(0.0, 0.0, 1.0) + vec3(0.001)));
  vec3 t2 = cross(ax, t1);
  float phi = atan(dot(d, t2), dot(d, t1));
  float n = texture2D(uBrush, P.xy * 3.0 + P.z * 2.0).r - 0.5;
  return sin(phi * uStrand.y + n * 3.5 + length(P - uStrandF) * 18.0 * n);
}`;

export function charMat(cu: CastUniforms, color: string, o: CharMatOpts = {}) {
  const isBrand = Object.values(BRAND).includes(color.toUpperCase() as never) || Object.values(BRAND).includes(color as never);
  const opts: GouacheOpts = {
    color, rim: o.rim ?? 0.4, brush: o.brush ?? 0.55, brushScale: o.brushScale ?? 7.0,
    emissive: o.emissive, emissiveIntensity: o.emissiveIntensity, xray: 0, bpFill: 1, anchor: "object",
    spec: o.spec, gloss: o.gloss, metal: o.metal, tooth: o.tooth ?? 0.05, specTh: o.specTh, hot: o.hot,
  };
  if (isBrand) Object.assign(opts, { brand: color, brush: 0.5, rim: 0.25 });
  const m = gouache(opts);
  // flag-sync with the look: in X-RAY these meshes are see-through shells (transparent, no depth write, double side)
  if (m.userData.look) m.userData.look.resin = 1;
  const base = m.onBeforeCompile;
  const face = o.face, jaw = o.face ?? o.jaw, fold = (o.fold ?? 0) > 0, strand = o.strand;
  const local = {
    uFoldK: { value: o.fold ?? 0 },
    uWarm: { value: new THREE.Vector4(...(o.warm ? new THREE.Color(o.warm[0]).toArray() : [0, 0, 0]), o.warm?.[1] ?? 0) },
    uStrand: { value: new THREE.Vector4(strand?.k ?? 0, strand?.n ?? 0, 0, 0) },
    uStrandF: { value: strand?.focus.clone() ?? new THREE.Vector3(0, 1, 0) },
    uStrandL: { value: new THREE.Color(strand?.light ?? "#6a5446") },
    uBounce: { value: o.bounce ?? 0 },
  };
  m.userData.cast = local;
  m.onBeforeCompile = (s, r) => {
    base.call(m, s, r);
    Object.assign(s.uniforms, cu, local);
    if (jaw) Object.assign(s.uniforms, jaw);
    const hasOP = s.vertexShader.includes("varying vec3 vOP");
    s.vertexShader = s.vertexShader
      .replace("#include <common>", `#include <common>\n${hasOP ? "" : "varying vec3 vOP; varying vec3 vON;"}\n${jaw ? FACE_VERT_PARS : ""}\n${fold ? "attribute vec4 aFold; varying vec4 vFold;" : ""}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${hasOP ? "" : "vOP = position; vON = normal;"}\n${jaw ? FACE_VERT : ""}\n${fold ? "vFold = aFold;" : ""}`);
    let f = s.fragmentShader;
    const fHasOP = f.includes("varying vec3 vOP");
    f = f.replace("#include <lights_pars_begin>", `${fHasOP ? "" : "varying vec3 vOP; varying vec3 vON;"} uniform float uResinA; uniform vec4 uWarm; uniform float uBounce;\n${face ? FACE_FRAG_PARS : "float gInk = 0.0; float gBounce = 0.0;"}\n${fold ? FOLD_PARS : ""}\n${strand ? STRAND_PARS : ""}\n#include <lights_pars_begin>`);
    // warm shadow pigment (amber jacket: the shadow plane is a warm amber-brown, not the scene teal)
    f = f.replace("vec3 shadeCol = mix(uShadeLo, uShadeHi, hk);", "vec3 shadeCol = mix(mix(uShadeLo, uShadeHi, hk), uWarm.rgb, uWarm.a);");
    if (face) f = f.replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb = paintFace(diffuseColor.rgb, vOP);");
    if (strand) f = f.replace("#include <color_fragment>", `#include <color_fragment>
      { float sf = strandField(vOP);
        diffuseColor.rgb *= 1.0 - uStrand.x * 0.3 * smoothstep(0.4, 0.95, -sf);
        diffuseColor.rgb = mix(diffuseColor.rgb, uStrandL, uStrand.x * 0.35 * smoothstep(0.7, 0.98, sf)); }`);
    if (fold) {
      // crease pigment: the valleys are painted a touch darker (brand: only the shadow plane, the top step stays exact)
      f = f.replace("#include <color_fragment>", "#include <color_fragment>\nfloat gFH = foldH(vFold, vOP); diffuseColor.rgb *= 1.0 - 0.22 * gCrease;");
      f = f.replace("#include <normal_fragment_maps>", "#include <normal_fragment_maps>\nnormal = foldNormal(-vViewPosition, normal, gFH, faceDirection);");
    }
    if (face) f = f.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * gBounce * uBounce;");
    const st = f.includes("uLock") ? "(uLock > -0.5 ? uLock : uState)" : "uState";
    f = f.replace("#include <tonemapping_fragment>", `{
        float cs = ${st};
        vec3 Vv = normalize(vViewPosition); vec3 Nn = normalize(normal);
        float frc = pow(1.0 - clamp(abs(dot(Nn, Vv)), 0.0, 1.0), 2.0);
        if (cs < 0.5) {
          gl_FragColor.rgb = mix(gl_FragColor.rgb, uCyan * 1.15, clamp(gInk, 0.0, 1.0) * 0.9);
        } else if (cs < 1.5) {
          vec3 tint = diffuseColor.rgb;
          vec3 c = tint * (0.07 + 0.8 * frc) + uCyan * pow(frc, 3.0) * 0.3;
          c = mix(c, tint * 0.3 + uCyan * 0.3, clamp(gInk, 0.0, 1.0) * 0.8);
          gl_FragColor = vec4(c, uResinA * (0.35 + 0.65 * frc));
        }
      }
      #include <tonemapping_fragment>`);
    s.fragmentShader = f;
  };
  m.customProgramCacheKey = () => `cast3-${face ? "face" : jaw ? "jaw" : "body"}-${fold ? "fold" : ""}-${strand ? "hair" : ""}`;
  return m;
}

/** lock a character material to a state (-1 = follow the global look state) */
export function lockMat(m: THREE.MeshLambertMaterial, s: number) {
  const u = m.userData.u as { uLock?: { value: number } } | undefined;
  if (u?.uLock) u.uLock.value = s;
  if (m.userData.look) m.userData.look.lock = s;
}

/** blueprint outline hull (inverted hull, constant world width), cyan; visible in BLUEPRINT only. Skinning-aware. */
export function hullMat(color: THREE.Color, width: number) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { uCol: { value: color }, uW: { value: width } },
    vertexShader: `#include <common>
      #include <skinning_pars_vertex>
      uniform float uW;
      void main(){
        #include <skinbase_vertex>
        #include <beginnormal_vertex>
        #include <skinnormal_vertex>
        #include <begin_vertex>
        #include <skinning_vertex>
        transformed += normalize(objectNormal) * uW;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
      }`,
    fragmentShader: `uniform vec3 uCol; void main(){ gl_FragColor = vec4(uCol, 1.0); }`,
  });
}
