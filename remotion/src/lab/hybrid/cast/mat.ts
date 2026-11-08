// [hybrid/cast] Character paint material = the shared look/ gouache() material (object-anchored brush + tooth, painted
// value steps, brand lock for the amber jacket) + cast-specific patches:
//  1. the skull material paints the face (face.ts) into diffuseColor before lighting, so the face is lit/shadowed like
//     the sculpted head and turns with it;
//  2. per-character signature state via the look's per-material lock (uLock): BLUEPRINT = the look's navy paper + cyan
//     face ink (+ our outline hull in the lab), X-RAY = coloured RESIN (the person stays amber, additive Fresnel glaze
//     so the cyan skeleton inside shows through), SOLID = gouache. Unlocked (-1) the character follows the global
//     U.uState like every set piece.
// The look/ shader is read-only: our patches are string inserts that no-op if the look renames a chunk.
import * as THREE from "three";
import { gouache, BRAND, GouacheOpts } from "../look/shade";
import { FACE_FRAG_PARS, FACE_VERT, FACE_VERT_PARS, FaceUniforms } from "./face";

export type CastUniforms = { uResinA: { value: number } };

export type CharMatOpts = {
  rim?: number; brush?: number; brushScale?: number; emissive?: string; emissiveIntensity?: number;
  spec?: number; gloss?: number; metal?: number;
  face?: FaceUniforms;  // skull only
};

export function charMat(cu: CastUniforms, color: string, o: CharMatOpts = {}) {
  const isBrand = Object.values(BRAND).includes(color.toUpperCase() as never) || Object.values(BRAND).includes(color as never);
  const opts: GouacheOpts = {
    color, rim: o.rim ?? 0.4, brush: o.brush ?? 0.55, brushScale: o.brushScale ?? 7.0,
    emissive: o.emissive, emissiveIntensity: o.emissiveIntensity, xray: 0, bpFill: 1, anchor: "object",
    spec: o.spec, gloss: o.gloss, metal: o.metal, tooth: 0.05,
  };
  if (isBrand) Object.assign(opts, { brand: color, brush: 0.5, rim: 0.25 });
  const m = gouache(opts);
  // flag-sync with the look: in X-RAY these meshes are see-through shells (transparent, no depth write, double side)
  if (m.userData.look) m.userData.look.resin = 1;
  const base = m.onBeforeCompile;
  const face = o.face;
  m.onBeforeCompile = (s, r) => {
    base.call(m, s, r);
    Object.assign(s.uniforms, cu);
    if (face) Object.assign(s.uniforms, face);
    const hasOP = s.vertexShader.includes("varying vec3 vOP");
    s.vertexShader = s.vertexShader
      .replace("#include <common>", `#include <common>\n${hasOP ? "" : "varying vec3 vOP; varying vec3 vON;"}\n${face ? FACE_VERT_PARS : ""}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${hasOP ? "" : "vOP = position; vON = normal;"}\n${face ? FACE_VERT : ""}`);
    let f = s.fragmentShader;
    const fHasOP = f.includes("varying vec3 vOP");
    f = f.replace("#include <lights_pars_begin>", `${fHasOP ? "" : "varying vec3 vOP; varying vec3 vON;"} uniform float uResinA;\n${face ? FACE_FRAG_PARS : "float gInk = 0.0;"}\n#include <lights_pars_begin>`);
    if (face) f = f.replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb = paintFace(diffuseColor.rgb, vOP);");
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
  m.customProgramCacheKey = () => `cast2-${face ? "face" : "body"}`;
  return m;
}

/** lock a character material to a state (-1 = follow the global look state) */
export function lockMat(m: THREE.MeshLambertMaterial, s: number) {
  const u = m.userData.u as { uLock?: { value: number } } | undefined;
  if (u?.uLock) u.uLock.value = s;
  if (m.userData.look) m.userData.look.lock = s;
}

/** blueprint outline hull (inverted hull, constant world width), cyan; visible in BLUEPRINT only */
export function hullMat(color: THREE.Color, width: number) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { uCol: { value: color }, uW: { value: width } },
    vertexShader: `uniform float uW; void main(){ vec3 p = position + normalize(normal) * uW; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `uniform vec3 uCol; void main(){ gl_FragColor = vec4(uCol, 1.0); }`,
  });
}
