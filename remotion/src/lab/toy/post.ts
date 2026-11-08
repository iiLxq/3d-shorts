// Post chain: RenderPass -> MacroLens (depth CoC + tilt band, own pass) -> Bloom + Neutral tone map + Grade.
// Grade = gentle S-curve, lifted blacks (no pure black), cool shadows / warm highlights, vignette, light grain.
import * as THREE from "three";
import { EffectComposer, RenderPass, EffectPass, Effect, EffectAttribute, BlendFunction, BloomEffect, ToneMappingEffect, ToneMappingMode } from "postprocessing";

const lensFrag = /* glsl */ `
uniform float uFocus;   // focus distance (m, view depth)
uniform float uK;       // CoC px at 1920 tall per dioptre difference
uniform float uMax;     // max CoC px at 1920
uniform float uTilt;    // extra CoC px from the screen-y tilt band
uniform float uTiltC;   // band centre (uv.y)
uniform float uTiltW;   // band half width (uv)
uniform float uScale;   // buffer height / 1920

float cocAt(vec2 uv){
  float z = -getViewZ(readDepth(uv));
  float c = uK * abs(1.0 / max(z, 0.05) - 1.0 / uFocus);
  c += uTilt * smoothstep(uTiltW, uTiltW + 0.35, abs(uv.y - uTiltC));
  return min(c, uMax) * uScale;
}
void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor){
  float zc = -getViewZ(depth);
  float cc = cocAt(uv);
  if (cc < 0.6) { outputColor = inputColor; return; }
  vec3 acc = inputColor.rgb; float wsum = 1.0;
  const int N = 40;
  for (int i = 1; i < N; i++){
    float r = sqrt(float(i) / float(N)) * cc;
    float a = float(i) * 2.39996323;
    vec2 o = vec2(cos(a), sin(a)) * r * texelSize;
    vec2 su = uv + o;
    float sz = -getViewZ(readDepth(su));
    float sc = cocAt(su);
    // nearer + sharper samples must not bleed into a blurred background
    float w = sz < zc - 0.05 ? clamp(sc / cc, 0.0, 1.0) : 1.0;
    w *= smoothstep(r - 1.0, r + 0.5, max(sc, cc * 0.6));
    acc += texture2D(inputBuffer, su).rgb * w; wsum += w;
  }
  outputColor = vec4(acc / wsum, inputColor.a);
}`;

export class MacroLens extends Effect {
  constructor() {
    super("MacroLens", lensFrag, {
      attributes: EffectAttribute.DEPTH | EffectAttribute.CONVOLUTION,
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, THREE.Uniform>([
        ["uFocus", new THREE.Uniform(5)], ["uK", new THREE.Uniform(30)], ["uMax", new THREE.Uniform(18)],
        ["uTilt", new THREE.Uniform(0)], ["uTiltC", new THREE.Uniform(0.5)], ["uTiltW", new THREE.Uniform(0.2)], ["uScale", new THREE.Uniform(0.5)],
      ]),
    });
  }
  set(p: { focus: number; k: number; max?: number; tilt?: number; tiltC?: number; tiltW?: number; scale: number }) {
    const u = this.uniforms;
    u.get("uFocus")!.value = p.focus; u.get("uK")!.value = p.k; u.get("uMax")!.value = p.max ?? 18;
    u.get("uTilt")!.value = p.tilt ?? 0; u.get("uTiltC")!.value = p.tiltC ?? 0.5; u.get("uTiltW")!.value = p.tiltW ?? 0.2; u.get("uScale")!.value = p.scale;
  }
}

const gradeFrag = /* glsl */ `
uniform float uVig; uniform float uGrain; uniform float uSeed; uniform float uLift;
uniform vec3 uShadowTint; uniform vec3 uHiTint; uniform float uContrast; uniform float uSat; uniform float uFlash; uniform vec3 uFlashCol;
float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 toS(vec3 c){ return pow(max(c, 0.0), vec3(1.0/2.2)); }
vec3 toL(vec3 c){ return pow(max(c, 0.0), vec3(2.2)); }
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
  vec3 c = toS(inputColor.rgb);
  float y = dot(c, vec3(0.2126, 0.7152, 0.0722));
  // S-curve around 0.45
  c = c + uContrast * (c - 0.45) * max(vec3(0.0), 1.0 - abs(c - 0.45) * 1.9);
  // split tone: cool shadows, warm highlights (zero-luma tints)
  float wS = 1.0 - smoothstep(0.0, 0.5, y), wH = smoothstep(0.45, 1.0, y);
  c += uShadowTint * wS + uHiTint * wH;
  // saturation (mids)
  float y2 = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(y2), c, uSat);
  // vignette (elliptical, portrait)
  vec2 d = (uv - 0.5) * vec2(1.0, 1.25);
  c *= 1.0 - uVig * smoothstep(0.32, 0.85, length(d));
  // lifted blacks (toe), never pure black
  c = uLift + c * (1.0 - uLift);
  // grain (luma-weighted, deterministic per frame)
  float n = h12(uv * resolution + uSeed * 91.7) - 0.5;
  c += n * uGrain * (0.4 + 0.6 * (1.0 - abs(y - 0.5) * 2.0));
  c = mix(c, uFlashCol, uFlash);
  outputColor = vec4(toL(clamp(c, 0.0, 1.0)), inputColor.a);
}`;

export class Grade extends Effect {
  constructor() {
    super("ToyGrade", gradeFrag, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, THREE.Uniform>([
        ["uVig", new THREE.Uniform(0.22)], ["uGrain", new THREE.Uniform(0.025)], ["uSeed", new THREE.Uniform(0)], ["uLift", new THREE.Uniform(0.018)],
        ["uShadowTint", new THREE.Uniform(new THREE.Vector3(-0.012, 0.0, 0.025))], ["uHiTint", new THREE.Uniform(new THREE.Vector3(0.02, 0.008, -0.02))],
        ["uContrast", new THREE.Uniform(0.12)], ["uSat", new THREE.Uniform(1.08)], ["uFlash", new THREE.Uniform(0)], ["uFlashCol", new THREE.Uniform(new THREE.Vector3(1, 1, 1))],
      ]),
    });
  }
  set(p: Partial<{ vig: number; grain: number; seed: number; lift: number; contrast: number; sat: number; flash: number; shadow: [number, number, number]; hi: [number, number, number]; flashCol: [number, number, number] }>) {
    const u = this.uniforms;
    if (p.vig !== undefined) u.get("uVig")!.value = p.vig;
    if (p.grain !== undefined) u.get("uGrain")!.value = p.grain;
    if (p.seed !== undefined) u.get("uSeed")!.value = p.seed;
    if (p.lift !== undefined) u.get("uLift")!.value = p.lift;
    if (p.contrast !== undefined) u.get("uContrast")!.value = p.contrast;
    if (p.sat !== undefined) u.get("uSat")!.value = p.sat;
    if (p.flash !== undefined) u.get("uFlash")!.value = p.flash;
    if (p.shadow) (u.get("uShadowTint")!.value as THREE.Vector3).set(...p.shadow);
    if (p.hi) (u.get("uHiTint")!.value as THREE.Vector3).set(...p.hi);
    if (p.flashCol) (u.get("uFlashCol")!.value as THREE.Vector3).set(...p.flashCol);
  }
}

export type Post = { composer: EffectComposer; lens: MacroLens; bloom: BloomEffect; grade: Grade; lensPass: EffectPass };

export function makePost(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, msaa: number): Post {
  const composer = new EffectComposer(gl, { frameBufferType: THREE.HalfFloatType, multisampling: msaa });
  composer.addPass(new RenderPass(scene, camera));
  const lens = new MacroLens();
  const lensPass = new EffectPass(camera, lens);
  composer.addPass(lensPass);
  const bloom = new BloomEffect({ mipmapBlur: true, luminanceThreshold: 1.0, luminanceSmoothing: 0.3, intensity: 0.7, radius: 0.7, levels: 6 });
  const tone = new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL });
  const grade = new Grade();
  composer.addPass(new EffectPass(camera, bloom, tone, grade));
  return { composer, lens, bloom, grade, lensPass };
}
