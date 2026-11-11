// Post chain for the paper set "photographed with a real lens":
//   RenderPass -> LensBlur (thin-lens gather, own pass) -> meter overlay (in-lens card, after the blur) ->
//   Bloom + hue-preserving shoulder tone map + Grade (brand-protected S-curve and split, navy lift, LOCAL flash)
//   + SheetComposite (v2 paper transitions: cyanotype page peel, vellum lay-over) drawn on the output.
import * as THREE from "three";
import {
  EffectComposer, RenderPass, EffectPass, Effect, EffectAttribute, BloomEffect, BlendFunction, KernelSize,
} from "postprocessing";
import { untone, BRAND } from "./paint";

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

// Display-referred grade after tone mapping. v2: the S-curve and split tone fade out on saturated pixels
// (brand protect), so brand hexes that land exactly after the tone curve stay exact; navy (never black) lift;
// LOCAL glow around one screen point (the jaws) instead of v1's full-frame white wash.
const gradeFrag = /* glsl */ `
uniform float uWarm; uniform float uVig; uniform vec3 uLift; uniform vec3 uVigCol; uniform float uContrast;
uniform vec2 uFlashUV; uniform float uFlashR, uFlashAmt; uniform vec3 uFlashCol; uniform float uExpo;
vec3 toneCurve(vec3 c) {
  float pk = max(max(c.r, c.g), c.b);
  if (pk <= 0.8) return c;
  float np = 0.8 + 0.2 * (1.0 - exp(-(pk - 0.8) / 0.2));
  return c * (np / pk);
}
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 hdr = max(inputColor.rgb, 0.0) * uExpo;
  vec2 dq = (uv - uFlashUV) * vec2(aspect, 1.0);
  hdr += uFlashCol * uFlashAmt * exp(-dot(dq, dq) / max(uFlashR * uFlashR, 1e-6));
  vec3 c = toneCurve(hdr);
  vec3 s = pow(max(c, 0.0), vec3(1.0 / 2.2));
  float y = dot(s, vec3(0.2126, 0.7152, 0.0722));
  float mx = max(s.r, max(s.g, s.b)), mn = min(s.r, min(s.g, s.b));
  float prot = 1.0 - smoothstep(0.55, 0.74, (mx - mn) / max(mx, 1e-4));
  vec3 sc = s + prot * uContrast * (s - 0.5) * (1.0 - abs(2.0 * s - 1.0)) * 0.6;
  float wH = smoothstep(0.45, 1.0, y), wS = 1.0 - smoothstep(0.0, 0.5, y);
  sc += prot * uWarm * (wH * vec3(0.025, 0.008, -0.03) + wS * vec3(-0.014, -0.002, 0.034));
  sc += (1.0 - smoothstep(0.0, 0.3, y)) * uLift;
  vec2 q = uv - 0.5; q.x *= 0.75;
  float v = smoothstep(0.42, 0.95, length(q) * 1.2);
  sc = mix(sc, uVigCol, v * uVig);
  outputColor = vec4(pow(max(sc, 0.0), vec3(2.2)), inputColor.a);
}`;
export class GradeEffect extends Effect {
  constructor() {
    super("GradeEffect", gradeFrag, {
      blendFunction: BlendFunction.SET,
      uniforms: new Map<string, THREE.Uniform>([
        ["uWarm", new THREE.Uniform(1)], ["uVig", new THREE.Uniform(0.2)], ["uLift", new THREE.Uniform(new THREE.Color(0.028, 0.045, 0.09))], ["uVigCol", new THREE.Uniform(new THREE.Color(0.05, 0.08, 0.16))],
        ["uContrast", new THREE.Uniform(0.5)], ["uExpo", new THREE.Uniform(1.12)],
        ["uFlashUV", new THREE.Uniform(new THREE.Vector2(0.5, 0.5))], ["uFlashR", new THREE.Uniform(0.1)], ["uFlashAmt", new THREE.Uniform(0)], ["uFlashCol", new THREE.Uniform(untone(BRAND.green))],
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
  overlayPass: RenderPass | null = null;
  constructor(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, overlay?: { scene: THREE.Scene; camera: THREE.Camera }) {
    this.composer = new EffectComposer(gl, { frameBufferType: THREE.HalfFloatType, multisampling: 0 });
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);
    this.lens = new LensBlurEffect(40);
    this.composer.addPass(new EffectPass(camera, this.lens));
    if (overlay) {
      this.overlayPass = new RenderPass(overlay.scene, overlay.camera);
      this.overlayPass.clearPass.setClearFlags(false, true, false);
      this.overlayPass.ignoreBackground = true;
      this.composer.addPass(this.overlayPass);
    }
    this.bloom = new BloomEffect({ blendFunction: BlendFunction.ADD, intensity: 0.6, luminanceThreshold: 0.85, luminanceSmoothing: 0.2, mipmapBlur: false, kernelSize: KernelSize.LARGE, resolutionScale: 0.5 });
    this.grade = new GradeEffect();
    const fin = new EffectPass(camera, this.bloom, this.grade);
    fin.dithering = true;
    this.composer.addPass(fin);
  }
  setSize(w: number, h: number) { this.composer.setSize(w, h, false); }
  render() { this.composer.render(); }
  /** local glow at a world point (null = off). radius in px @1920 */
  flash(cam: THREE.Camera, world: THREE.Vector3 | null, amount = 0, radiusPx = 220, hex: string = BRAND.green) {
    const g = this.grade.uniforms;
    if (!world || amount <= 0) { g.get("uFlashAmt")!.value = 0; return; }
    const v = world.clone().project(cam);
    (g.get("uFlashUV")!.value as THREE.Vector2).set(v.x * 0.5 + 0.5, v.y * 0.5 + 0.5);
    g.get("uFlashR")!.value = radiusPx / 1920; g.get("uFlashAmt")!.value = v.z < 1 ? amount : 0;
    g.get("uFlashCol")!.value = untone(hex);
  }
}

// ---------------------------------------------------------------------------------------- paper transitions
// The two looks are rendered one after the other; the first ("sheet" = A) is copied from the canvas, the second
// (B) stays in the canvas, then this pass draws the sheet over B with paper physics in screen space:
//   mode 0  PEEL: A is a cyanotype print peeling off from a corner around a cylinder (front, back side with faint
//           show-through, lit by the scene key direction), with a soft contact shadow on B.
//   mode 1  SLIDE: A is a vellum sheet whose edge slides across the frame (bright cut edge, soft shadow on B).
const sheetFrag = /* glsl */ `
precision highp float;
uniform sampler2D tA; uniform vec2 uRes; uniform float uMode, uL, uR, uEdge0, uEdge1, uTilt;
uniform vec2 uO, uD; uniform vec3 uBack;
varying vec2 vUv;
bool inside(vec2 p) { return p.x >= 0.0 && p.x <= 1.0 && p.y >= 0.0 && p.y <= 1.0; }
void main() {
  vec2 asp = vec2(uRes.x / uRes.y, 1.0);
  vec2 p = vUv;
  if (uMode < 0.5) {
    vec2 P = p * asp, O = uO * asp;          // isotropic coords
    float u = dot(P - O, uD);                  // distance from the peel corner along the travel direction
    float dist = uL - u;                       // > 0: on the corner side of the fold line
    vec4 outc = vec4(0.0);
    float sh = 0.0;
    if (dist > uR) {
      // uncovered: B shows; shadow of the curl falls just beyond the cylinder
      sh = 0.55 * exp(-(dist - uR) / (uR * 1.6));
      gl_FragColor = vec4(0.0, 0.02, 0.06, sh);
      return;
    }
    if (dist > 0.0) {
      float ph1 = asin(clamp(dist / uR, -1.0, 1.0));
      float ph2 = 3.14159265 - ph1;
      float u2 = uL - uR * ph2;               // original coordinate of the upper (flipped) layer
      vec2 q2 = (P + uD * (u2 - u)) / asp;
      if (inside(q2)) {
        vec3 a = texture2D(tA, vec2(q2.x, q2.y)).rgb;
        float lit = 0.5 + 0.55 * cos(ph2 - 0.9);
        vec3 back = mix(uBack, uBack * 0.8 + a * 0.2, 0.25) * lit;
        gl_FragColor = vec4(back, 1.0); return;
      }
      float u1 = uL - uR * ph1;
      vec2 q1 = (P + uD * (u1 - u)) / asp;
      if (inside(q1)) {
        vec3 a = texture2D(tA, q1).rgb * (0.75 + 0.25 * cos(ph1));
        gl_FragColor = vec4(a, 1.0); return;
      }
      gl_FragColor = vec4(0.0); return;
    }
    // flat region: flipped layer lying on top?
    float u3 = uL - (3.14159265 * uR + (u - uL));
    vec2 q3 = (P + uD * (u3 - u)) / asp;
    if (inside(q3)) {
      vec3 a = texture2D(tA, q3).rgb;
      float lit = 0.9 - 0.15 * smoothstep(0.0, uR * 4.0, u - uL);
      gl_FragColor = vec4(mix(uBack, uBack * 0.8 + a * 0.2, 0.25) * lit, 1.0); return;
    }
    vec3 a = texture2D(tA, p).rgb;
    // contact shadow of the lifted layer onto the flat sheet near the fold
    float s2 = 0.35 * exp(-(u - uL) / (uR * 0.9)) * step(0.0, u - uL);
    gl_FragColor = vec4(a * (1.0 - s2), 1.0);
    return;
  }
  // SLIDE: sheet covers where e0 < s < e1 (s = tilted vertical coordinate, 0 top .. 1 bottom)
  float s = (1.0 - p.y) + (p.x - 0.5) * uTilt;
  float inA = step(uEdge0, s) * step(s, uEdge1);
  if (inA > 0.5) {
    vec3 a = texture2D(tA, p).rgb;
    float e = min(s - uEdge0, uEdge1 - s);
    float rim = (1.0 - smoothstep(0.0, 0.004, e)) * 0.55;  // the vellum cut edge catches light
    float lift = 1.0 - smoothstep(0.0, 0.03, e);           // the edge lifts off a little: lighter, milkier
    a = mix(a, vec3(0.86, 0.93, 0.97), rim + 0.08 * lift);
    gl_FragColor = vec4(a, 1.0);
  } else {
    float d = s < uEdge0 ? uEdge0 - s : s - uEdge1;
    float sh = 0.3 * exp(-d / 0.012);
    if (uEdge0 <= 0.0001 && s < uEdge0) sh = 0.0;
    if (uEdge1 >= 0.9999 && s > uEdge1) sh = 0.0;
    gl_FragColor = vec4(0.0, 0.02, 0.06, sh);
  }
}`;
export class SheetComposite {
  scene = new THREE.Scene();
  cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  mat: THREE.ShaderMaterial;
  texA: THREE.FramebufferTexture | null = null;
  constructor() {
    this.mat = new THREE.ShaderMaterial({
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
      fragmentShader: sheetFrag, transparent: true, depthTest: false, depthWrite: false,
      uniforms: {
        tA: { value: null }, uRes: { value: new THREE.Vector2(1080, 1920) }, uMode: { value: 0 }, uL: { value: 0 }, uR: { value: 0.08 },
        uEdge0: { value: 0 }, uEdge1: { value: 1 }, uTilt: { value: 0.06 }, uO: { value: new THREE.Vector2(1, 0) }, uD: { value: new THREE.Vector2(-0.6, 0.8) },
        uBack: { value: new THREE.Color(0.93, 0.9, 0.82) },
      },
    });
    const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat); q.frustumCulled = false; this.scene.add(q);
  }
  /** copy the current canvas (the finished look A) */
  grab(gl: THREE.WebGLRenderer) {
    const sz = gl.getDrawingBufferSize(new THREE.Vector2());
    if (!this.texA || this.texA.image.width !== sz.x || this.texA.image.height !== sz.y) {
      this.texA?.dispose();
      this.texA = new THREE.FramebufferTexture(sz.x, sz.y);
      this.texA.minFilter = this.texA.magFilter = THREE.LinearFilter;
    }
    gl.setRenderTarget(null);
    gl.copyFramebufferToTexture(this.texA);
    this.mat.uniforms.uRes.value.set(sz.x, sz.y);
  }
  draw(gl: THREE.WebGLRenderer) {
    this.mat.uniforms.tA.value = this.texA;
    const ac = gl.autoClear; gl.autoClear = false;
    gl.setRenderTarget(null);
    gl.render(this.scene, this.cam);
    gl.autoClear = ac;
  }
}
