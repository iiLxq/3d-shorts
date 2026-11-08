// Post chain for the paper set "photographed with a real lens":
//   RenderPass -> LensBlur (thin-lens gather, own pass) -> Bloom + Neutral tone map + Grade (warm hi / cool lo, lifted vignette)
import * as THREE from "three";
import {
  EffectComposer, RenderPass, EffectPass, Effect, EffectAttribute, BloomEffect, ToneMappingEffect, ToneMappingMode, BlendFunction, KernelSize,
} from "postprocessing";

const lensFrag = /* glsl */ `
uniform float uFocus;   // focus distance (m, along view axis)
uniform float uCInf;    // CoC at infinity in px at 1920 high
uniform float uMax;     // max CoC px (buffer px)
uniform float uScale;   // buffer height / 1920
bool badf(float x) { return (floatBitsToUint(x) & 0x7fffffffu) >= 0x7f800000u; }
vec3 safe3(vec3 c) { return (badf(c.r) || badf(c.g) || badf(c.b)) ? vec3(0.0) : clamp(c, vec3(0.0), vec3(64.0)); }
float cocSigned(float d) {
  float z = max(-getViewZ(d), 1e-3);
  float c = uCInf * uScale * (1.0 - uFocus / z);
  c = c < 0.0 ? c * 1.25 : c;   // near field a bit stronger (macro)
  return clamp(c, -uMax, uMax);
}
void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  vec3 ic = safe3(inputColor.rgb);
  float c0s = cocSigned(depth);
  float c0 = abs(c0s);
  float z0 = -getViewZ(depth);
  // probe for blurred foreground that should spill over this pixel
  float R = c0;
  for (int i = 0; i < 12; i++) {
    float a = float(i) * 0.5236;
    float rr = (i < 6 ? 0.5 : 1.0) * uMax;
    vec2 suv = uv + vec2(cos(a), sin(a)) * rr * texelSize;
    float cs = cocSigned(readDepth(suv));
    if (cs < 0.0 && -cs > rr * 0.9) R = max(R, -cs);
  }
  if (R < 0.6) { outputColor = vec4(ic, 1.0); return; }
  vec3 acc = vec3(0.0); float n = 0.0;
  for (int i = 0; i < TAPS; i++) {
    float fi = float(i) + 0.5;
    float r = sqrt(fi / float(TAPS)) * R;
    float a = fi * 2.39996323;
    vec2 suv = uv + vec2(cos(a), sin(a)) * r * texelSize;
    float sd = readDepth(suv);
    float cs = cocSigned(sd);
    float zs = -getViewZ(sd);
    float reach = abs(cs);
    if (zs > z0) reach = min(reach, c0);            // background never spreads over nearer pixels
    float w = clamp(reach - r + 1.0, 0.0, 1.0);
    acc += mix(ic, safe3(texture2D(inputBuffer, suv).rgb), w);
    n += 1.0;
  }
  outputColor = vec4(acc / n, 1.0);
}`;

export class LensBlurEffect extends Effect {
  constructor(taps = 40) {
    super("LensBlurEffect", lensFrag, {
      attributes: EffectAttribute.DEPTH | EffectAttribute.CONVOLUTION,
      defines: new Map([["TAPS", String(taps)]]),
      uniforms: new Map<string, THREE.Uniform>([
        ["uFocus", new THREE.Uniform(5)], ["uCInf", new THREE.Uniform(10)], ["uMax", new THREE.Uniform(10)], ["uScale", new THREE.Uniform(0.5)],
      ]),
    });
  }
  set(focus: number, cInf: number, bufH: number) {
    const s = bufH / 1920;
    this.uniforms.get("uFocus")!.value = focus;
    this.uniforms.get("uCInf")!.value = cInf;
    this.uniforms.get("uScale")!.value = s;
    this.uniforms.get("uMax")!.value = Math.max(1, 22 * s);
  }
}

// Display-referred grade after tone mapping: gentle S, split tone (warm highs, cool lows), lifted navy vignette, flash.
const gradeFrag = /* glsl */ `
uniform float uWarm; uniform float uVig; uniform vec3 uLift; uniform vec3 uVigCol; uniform float uFlash; uniform vec3 uFlashCol; uniform float uContrast;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = inputColor.rgb;
  vec3 s = pow(max(c, 0.0), vec3(1.0 / 2.2));        // to display-ish gamma
  float y = dot(s, vec3(0.2126, 0.7152, 0.0722));
  // soft S-curve around mid grey
  float k = uContrast;
  vec3 sc = s + k * (s - 0.5) * (1.0 - abs(2.0 * s - 1.0)) * 0.6;
  // split tone
  float wH = smoothstep(0.45, 1.0, y), wS = 1.0 - smoothstep(0.0, 0.5, y);
  sc += uWarm * (wH * vec3(0.025, 0.008, -0.03) + wS * vec3(-0.012, 0.0, 0.03));
  // lifted, navy-tinted blacks (no crushed black)
  sc += (1.0 - smoothstep(0.0, 0.4, y)) * uLift;
  // vignette toward lifted navy (never black)
  vec2 q = uv - 0.5; q.x *= 0.75;
  float v = smoothstep(0.42, 0.95, length(q) * 1.2);
  sc = mix(sc, uVigCol, v * uVig);
  sc = mix(sc, uFlashCol, uFlash);
  outputColor = vec4(pow(max(sc, 0.0), vec3(2.2)), inputColor.a);
}`;
export class GradeEffect extends Effect {
  constructor() {
    super("GradeEffect", gradeFrag, {
      blendFunction: BlendFunction.SET,
      uniforms: new Map<string, THREE.Uniform>([
        ["uWarm", new THREE.Uniform(1)], ["uVig", new THREE.Uniform(0.22)], ["uLift", new THREE.Uniform(new THREE.Color(0.035, 0.05, 0.085))], ["uVigCol", new THREE.Uniform(new THREE.Color(0.06, 0.1, 0.18))],
        ["uFlash", new THREE.Uniform(0)], ["uFlashCol", new THREE.Uniform(new THREE.Color(1, 1, 1))], ["uContrast", new THREE.Uniform(0.35)],
      ]),
    });
  }
}

export class Post {
  composer: EffectComposer;
  lens: LensBlurEffect;
  bloom: BloomEffect;
  grade: GradeEffect;
  renderPass: RenderPass;
  constructor(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, msaa = 0) {
    this.composer = new EffectComposer(gl, { frameBufferType: THREE.HalfFloatType, multisampling: msaa });
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);
    this.lens = new LensBlurEffect(40);
    this.composer.addPass(new EffectPass(camera, this.lens));
    this.bloom = new BloomEffect({ blendFunction: BlendFunction.ADD, intensity: 0.7, luminanceThreshold: 0.82, luminanceSmoothing: 0.25, mipmapBlur: false, kernelSize: KernelSize.LARGE, resolutionScale: 0.5 });
    const tm = new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL });
    this.grade = new GradeEffect();
    this.composer.addPass(new EffectPass(camera, this.bloom, tm, this.grade));
  }
  setSize(w: number, h: number) { this.composer.setSize(w, h, false); }
  render() { this.composer.render(); }
}
