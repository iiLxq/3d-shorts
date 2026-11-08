// [hybrid/look, owned by the Look TD] Lamplit Gouache post stack.
//   RenderPass (MSAA) -> INK (depth 2nd-difference contours: darker-hue paint edge in SOLID, cyan line in BLUEPRINT /
//   X-RAY; follows the print sweep) -> BGBLUR (cheap depth-gated background blur, 12 taps, far side only) ->
//   BLOOM (mip blur, ADD, threshold 1.0 = practicals / hot cores only) + GRADE (warm/cool split with brand protect,
//   hot-core bleach, navy floor, LOCAL flash, light vignette, static grain).
// Every pixel size is given in px at 1080x1920 and scaled to the real buffer, so a 0.5 preview (dpr 0.5) and the final
// look the same. SHARPEN (luma, halo-limited) runs first in the final pass. Render the buffer at the Remotion scale: renderer.setPixelRatio(outputDpr()).
import * as THREE from "three";
import { EffectComposer, RenderPass, EffectPass, BloomEffect, Effect, EffectAttribute, BlendFunction } from "postprocessing";
import { DEFAULT_GRADE, GradeParams, untone, BRAND } from "./colors";
import { U } from "./shade";

/** device pixel ratio = Remotion --scale (headless Chrome deviceScaleFactor). 0.5 stills => true 540x960 buffer. */
export const outputDpr = () => (typeof window !== "undefined" && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1);

export type PostOpts = {
  preview: boolean;      // fast look check: MSAA off, blur off (ink, bloom, grade stay)
  msaa: number;          // 0 | 2 | 4 (final)
  ink: boolean; inkWidth: number; inkStrength: number; inkLo: number; inkHi: number; inkFade: [number, number];
  dof: boolean; focus: number; focusRange: number; dofMaxPx: number;
  bloom: boolean; bloomThreshold: number; bloomSmoothing: number; bloomIntensity: number; bloomRadius: number;
  grade: boolean; gradeParams: GradeParams; vignette: number;
  grain: number; grainPx: number; grainSeed: number; // grain amount (0 = off), cell size px@1080, seed (keep per shot)
  sharpen: number; sharpenLimit: number;              // luma-only, halo-limited crispness (0 = off)
};
export const POST_DEFAULTS: PostOpts = {
  preview: false, msaa: 4,
  ink: true, inkWidth: 2.0, inkStrength: 0.75, inkLo: 0.0012, inkHi: 0.006, inkFade: [14, 40],
  dof: true, focus: 4, focusRange: 1.0, dofMaxPx: 8,
  bloom: true, bloomThreshold: 1.0, bloomSmoothing: 0.08, bloomIntensity: 0.9, bloomRadius: 0.62,
  grade: true, gradeParams: DEFAULT_GRADE, vignette: 0.2,
  grain: 0.012, grainPx: 2.5, grainSeed: 1,
  sharpen: 0.7, sharpenLimit: 0.06,
};

const u = (v: unknown) => new THREE.Uniform(v);

class InkEffect extends Effect {
  constructor() {
    super("GouacheInk", /* glsl */ `
      uniform float uInkW, uInkK, uInkLo, uInkHi, uFadeN, uFadeF;
      uniform float uState, uState2, uSweepOn, uSweepSoft; uniform vec4 uSweep;
      uniform vec3 uCyan, uInkTint;
      uniform mat4 uInvProj, uCamWorld;
      float Wd(vec2 p){ return 1.0 / max(-getViewZ(readDepth(p)), 1e-4); }
      float edgeAt(vec2 uv, float Wc, vec2 o){
        vec2 ox = vec2(o.x, 0.0), oy = vec2(0.0, o.y), od = o * 0.7071, oe = vec2(o.x, -o.y) * 0.7071;
        float s1 = (Wd(uv + ox) + Wd(uv - ox) - 2.0 * Wc) / Wc;
        float s2 = (Wd(uv + oy) + Wd(uv - oy) - 2.0 * Wc) / Wc;
        float s3 = (Wd(uv + od) + Wd(uv - od) - 2.0 * Wc) / Wc;
        float s4 = (Wd(uv + oe) + Wd(uv - oe) - 2.0 * Wc) / Wc;
        float sn = min(min(s1, s2), min(s3, s4));
        float sp = max(max(s1, s2), max(s3, s4));
        float e = smoothstep(uInkLo, uInkHi, -sn);                                   // silhouettes (near side) + convex creases
        e = max(e, 0.6 * smoothstep(uInkLo * 1.5, uInkHi * 1.5, sp) * (1.0 - smoothstep(0.03, 0.08, sp))); // concave folds/contacts
        return e;
      }
      vec3 inkFor(float s, vec3 c, float e, float eg){
        if (s < 0.5) return mix(c, uCyan, e) + uCyan * 0.22 * eg;        // blueprint: cyan line + soft glow
        if (s < 1.5) return mix(c, uCyan * 0.8, e * 0.75);                 // x-ray: dimmer cyan line
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        vec3 dk = mix(vec3(l), c, 1.25) * uInkTint;                        // solid: darker, richer, cooler hue of the paint
        return mix(c, max(dk, vec3(0.0)), e * uInkK);
      }
      void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor){
        if (depth >= 0.999999) { outputColor = inputColor; return; }
        float zc = max(-getViewZ(depth), 1e-4);
        float Wc = 1.0 / zc;
        float e = edgeAt(uv, Wc, texelSize * uInkW) * (1.0 - smoothstep(uFadeN, uFadeF, zc));
        float sA = uState, sB = uState2, k = 0.0;
        if (uSweepOn > 0.5) {
          vec4 vp = uInvProj * vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0); vp /= vp.w;
          vec3 wp = (uCamWorld * vec4(vp.xyz, 1.0)).xyz;
          k = smoothstep(uSweepSoft, -uSweepSoft, dot(uSweep.xyz, wp) - uSweep.w);
        }
        float eg = 0.0;
        if (sA < 0.5 || (k > 0.0 && sB < 0.5)) eg = edgeAt(uv, Wc, texelSize * uInkW * 2.5);
        vec3 cA = inkFor(sA, inputColor.rgb, e, eg);
        vec3 cB = k > 0.0 ? inkFor(sB, inputColor.rgb, e, eg) : cA;
        outputColor = vec4(mix(cA, cB, k), inputColor.a);
      }`, {
      attributes: EffectAttribute.DEPTH,
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, THREE.Uniform>([
        ["uInkW", u(1)], ["uInkK", u(0.75)], ["uInkLo", u(0.0012)], ["uInkHi", u(0.006)], ["uFadeN", u(14)], ["uFadeF", u(40)],
        ["uState", u(2)], ["uState2", u(2)], ["uSweepOn", u(0)], ["uSweepSoft", u(0.1)], ["uSweep", u(new THREE.Vector4())],
        ["uCyan", u(untone(BRAND.cyan))], ["uInkTint", u(new THREE.Vector3(0.52, 0.56, 0.70))],
        ["uInvProj", u(new THREE.Matrix4())], ["uCamWorld", u(new THREE.Matrix4())],
      ]),
    });
  }
}

class BgBlurEffect extends Effect {
  constructor() {
    super("GouacheBgBlur", /* glsl */ `
      uniform float uFocus, uRange, uMaxPx;
      float cocAt(float z){ return clamp((z - uFocus - uRange) / max(z, 1e-3) * 3.0, 0.0, 1.0); }
      void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor){
        float c0 = cocAt(-getViewZ(depth));
        if (c0 < 0.02) { outputColor = inputColor; return; }
        vec3 acc = inputColor.rgb; float ws = 1.0; float R = c0 * uMaxPx;
        for (int i = 0; i < 12; i++) {
          float fi = float(i);
          float r = sqrt((fi + 0.5) / 12.0) * R, a = fi * 2.39996323;
          vec2 p = uv + vec2(cos(a), sin(a)) * r * texelSize;
          float w = smoothstep(0.0, 0.25, cocAt(-getViewZ(readDepth(p))));   // gather only from background: no subject halos
          acc += texture2D(inputBuffer, p).rgb * w; ws += w;
        }
        outputColor = vec4(acc / ws, inputColor.a);
      }`, {
      attributes: EffectAttribute.DEPTH | EffectAttribute.CONVOLUTION,
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, THREE.Uniform>([["uFocus", u(4)], ["uRange", u(1)], ["uMaxPx", u(4)]]),
    });
  }
}

class SharpenEffect extends Effect {
  constructor() {
    super("GouacheSharpen", /* glsl */ `
      uniform float uAmt, uLim, uR;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
        const vec3 LW = vec3(0.2126, 0.7152, 0.0722);
        vec2 t = texelSize * uR;
        vec3 b = texture2D(inputBuffer, uv + t).rgb + texture2D(inputBuffer, uv - t).rgb
               + texture2D(inputBuffer, uv + vec2(t.x, -t.y)).rgb + texture2D(inputBuffer, uv + vec2(-t.x, t.y)).rgb;
        b *= 0.25;
        vec3 c = inputColor.rgb;
        // unsharp mask on sqrt-luma (perceptual), clamped: crisp painted edges without halos or colour fringes
        float yc = sqrt(max(dot(c, LW), 0.0)), yb = sqrt(max(dot(b, LW), 0.0));
        float yn = max(yc + clamp((yc - yb) * uAmt, -uLim, uLim), 0.0);
        c *= (yn * yn) / max(yc * yc, 1e-6);
        outputColor = vec4(c, inputColor.a);
      }`, {
      attributes: EffectAttribute.CONVOLUTION,
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, THREE.Uniform>([["uAmt", u(0.7)], ["uLim", u(0.06)], ["uR", u(1)]]),
    });
  }
}

class GradeEffect extends Effect {
  constructor() {
    super("GouacheGrade2", /* glsl */ `
      uniform float uExpo, uSplit, uSplitLo, uSplitHi, uProtLo, uProtHi, uLiftY, uBleachLo, uBleachHi, uGradeOn;
      uniform vec3 uWarm, uCool, uLift;
      uniform float uVig;
      uniform vec2 uFlashUV; uniform float uFlashR, uFlashAmt; uniform vec3 uFlashCol;
      uniform float uGrain, uGrainPx, uSeed;
      float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); vec2 s = vec2(uSeed * 17.31, uSeed * 7.77);
        return mix(mix(h12(i + s), h12(i + s + vec2(1, 0)), f.x), mix(h12(i + s + vec2(0, 1)), h12(i + s + vec2(1, 1)), f.x), f.y); }
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
        vec3 c = inputColor.rgb;
        const vec3 LW = vec3(0.2126, 0.7152, 0.0722);
        if (uGradeOn > 0.5) {
          c *= uExpo;
          float y = dot(c, LW);
          float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
          float prot = 1.0 - smoothstep(uProtLo, uProtHi, (mx - mn) / max(mx, 1e-5));
          c *= 1.0 + prot * uSplit * (mix(uCool, uWarm, smoothstep(uSplitLo, uSplitHi, y)) - 1.0);
        }
        // LOCAL flash: a glow around one screen point (the jaws), never a full-frame wash
        vec2 dq = (uv - uFlashUV) * vec2(aspect, 1.0);
        c += uFlashCol * uFlashAmt * exp(-dot(dq, dq) / max(uFlashR * uFlashR, 1e-6));
        if (uGradeOn > 0.5) {
          float mx = max(c.r, max(c.g, c.b));
          if (mx > uBleachLo) { float t = smoothstep(uBleachLo, uBleachHi, mx); c = mix(c / mx, vec3(1.0), t); }  // hot cores bleach, never hue-clip
          c += uLift * (1.0 - smoothstep(0.0, uLiftY, dot(c, LW)));                                                // navy floor, no pure black
        }
        vec2 q = (uv - 0.5) * 2.0;
        c *= 1.0 - uVig * smoothstep(0.55, 1.45, length(q));
        if (uGrain > 0.0) {
          vec2 gp = gl_FragCoord.xy / uGrainPx;
          float g = vnoise(gp) * 0.65 + vnoise(gp * 2.03 + 11.0) * 0.35 - 0.5;   // static per seed: no boil
          c *= 1.0 + g * uGrain * 2.0;
        }
        outputColor = vec4(c, inputColor.a);
      }`, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, THREE.Uniform>([
        ["uExpo", u(1)], ["uSplit", u(1)], ["uSplitLo", u(0.015)], ["uSplitHi", u(0.3)], ["uProtLo", u(0.55)], ["uProtHi", u(0.85)],
        ["uLiftY", u(0.006)], ["uBleachLo", u(1)], ["uBleachHi", u(4)], ["uGradeOn", u(1)],
        ["uWarm", u(new THREE.Vector3(1, 1, 1))], ["uCool", u(new THREE.Vector3(1, 1, 1))], ["uLift", u(new THREE.Vector3())],
        ["uVig", u(0.2)], ["uFlashUV", u(new THREE.Vector2(0.5, 0.5))], ["uFlashR", u(0.1)], ["uFlashAmt", u(0)], ["uFlashCol", u(new THREE.Color(1, 1, 1))],
        ["uGrain", u(0)], ["uGrainPx", u(2)], ["uSeed", u(1)],
      ]),
    });
  }
}

export type Post = {
  composer: EffectComposer; opts: PostOpts;
  /** render one frame (call after camera/scene updates) */
  render(): void;
  /** change options; structural changes (msaa, bloom on/off) rebuild the chain */
  set(o: Partial<PostOpts>): void;
  /** local flash at a world point (or null = off). radiusPx at 1080x1920. amount: added linear light at the centre */
  flash(world: THREE.Vector3 | null, amount?: number, radiusPx?: number, color?: string): void;
  /** background blur focus (camera distance, m) and the in-focus depth range behind it */
  focus(dist: number, range?: number): void;
  setSize(w: number, h: number): void;
  dispose(): void;
  /** ms of the last render() */
  lastMs: number;
};

export function createPost(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, opts: Partial<PostOpts> = {}): Post {
  const o: PostOpts = { ...POST_DEFAULTS, ...opts, gradeParams: { ...DEFAULT_GRADE, ...(opts.gradeParams ?? {}) } };
  const ink = new InkEffect(), blur = new BgBlurEffect(), grade = new GradeEffect(), sharp = new SharpenEffect();
  let bloom: BloomEffect | null = null;
  let composer!: EffectComposer, inkPass!: EffectPass, blurPass!: EffectPass, finalPass!: EffectPass;
  let flashWorld: THREE.Vector3 | null = null, flashAmt = 0, flashR = 200, flashCol = untone(BRAND.green);

  const build = () => {
    composer?.dispose();
    const ms = o.preview ? 0 : o.msaa;
    composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: ms });
    composer.addPass(new RenderPass(scene, camera));
    inkPass = new EffectPass(camera, ink);
    blurPass = new EffectPass(camera, blur);
    bloom = o.bloom ? new BloomEffect({ blendFunction: BlendFunction.ADD, mipmapBlur: true, luminanceThreshold: o.bloomThreshold, luminanceSmoothing: o.bloomSmoothing, intensity: o.bloomIntensity, radius: o.bloomRadius, levels: 7 }) : null;
    const fx: Effect[] = [];
    if (o.sharpen > 0) fx.push(sharp);
    if (bloom) fx.push(bloom);
    fx.push(grade);
    finalPass = new EffectPass(camera, ...fx);
    finalPass.dithering = true;
    composer.addPass(inkPass); composer.addPass(blurPass); composer.addPass(finalPass);
    sync();
  };
  const bufH = () => renderer.getDrawingBufferSize(new THREE.Vector2()).y;
  const sync = () => {
    const px = bufH() / 1920;
    inkPass.enabled = o.ink; blurPass.enabled = o.dof && !o.preview;
    const iu = ink.uniforms;
    iu.get("uInkW")!.value = Math.max(0.75, o.inkWidth * px); iu.get("uInkK")!.value = o.inkStrength;
    iu.get("uInkLo")!.value = o.inkLo; iu.get("uInkHi")!.value = o.inkHi; iu.get("uFadeN")!.value = o.inkFade[0]; iu.get("uFadeF")!.value = o.inkFade[1];
    const bu = blur.uniforms;
    bu.get("uFocus")!.value = o.focus; bu.get("uRange")!.value = o.focusRange; bu.get("uMaxPx")!.value = o.dofMaxPx * px;
    const g = grade.uniforms, p = o.gradeParams;
    g.get("uGradeOn")!.value = o.grade ? 1 : 0;
    g.get("uExpo")!.value = p.expo; g.get("uSplit")!.value = p.split; g.get("uSplitLo")!.value = p.splitLo; g.get("uSplitHi")!.value = p.splitHi;
    g.get("uProtLo")!.value = p.protLo; g.get("uProtHi")!.value = p.protHi; g.get("uLiftY")!.value = p.liftY;
    g.get("uBleachLo")!.value = p.bleachLo; g.get("uBleachHi")!.value = p.bleachHi;
    (g.get("uWarm")!.value as THREE.Vector3).fromArray(p.warm); (g.get("uCool")!.value as THREE.Vector3).fromArray(p.cool); (g.get("uLift")!.value as THREE.Vector3).fromArray(p.lift);
    g.get("uVig")!.value = o.vignette;
    sharp.uniforms.get("uAmt")!.value = o.sharpen; sharp.uniforms.get("uLim")!.value = o.sharpenLimit; sharp.uniforms.get("uR")!.value = Math.max(1, 2 * px);
    g.get("uGrain")!.value = o.grain; g.get("uGrainPx")!.value = Math.max(1, o.grainPx * px); g.get("uSeed")!.value = o.grainSeed;
  };
  build();

  const post: Post = {
    get composer() { return composer; },
    opts: o,
    lastMs: 0,
    render() {
      const t0 = performance.now();
      camera.updateMatrixWorld();
      const iu = ink.uniforms;
      iu.get("uState")!.value = U.uState.value; iu.get("uState2")!.value = U.uState2.value;
      iu.get("uSweepOn")!.value = U.uSweepOn.value; iu.get("uSweepSoft")!.value = U.uSweepSoft.value;
      (iu.get("uSweep")!.value as THREE.Vector4).copy(U.uSweep.value);
      (iu.get("uCyan")!.value as THREE.Color).copy(U.uCyan.value);
      (iu.get("uInvProj")!.value as THREE.Matrix4).copy(camera.projectionMatrixInverse);
      (iu.get("uCamWorld")!.value as THREE.Matrix4).copy(camera.matrixWorld);
      const g = grade.uniforms;
      if (flashWorld && flashAmt > 0) {
        const v = flashWorld.clone().project(camera);
        (g.get("uFlashUV")!.value as THREE.Vector2).set(v.x * 0.5 + 0.5, v.y * 0.5 + 0.5);
        g.get("uFlashR")!.value = flashR / 1920; g.get("uFlashAmt")!.value = v.z < 1 ? flashAmt : 0;
        (g.get("uFlashCol")!.value as THREE.Color).copy(flashCol);
      } else g.get("uFlashAmt")!.value = 0;
      composer.render();
      post.lastMs = performance.now() - t0;
    },
    set(n) {
      const structural = (n.sharpen !== undefined && (n.sharpen > 0) !== (o.sharpen > 0)) || (n.msaa !== undefined && n.msaa !== o.msaa) || (n.bloom !== undefined && n.bloom !== o.bloom) || (n.preview !== undefined && n.preview !== o.preview)
        || n.bloomThreshold !== undefined || n.bloomIntensity !== undefined || n.bloomRadius !== undefined || n.bloomSmoothing !== undefined;
      Object.assign(o, n);
      if (n.gradeParams) o.gradeParams = { ...DEFAULT_GRADE, ...n.gradeParams };
      if (structural) build(); else sync();
    },
    flash(world, amount = 1, radiusPx = 200, color: string = BRAND.green) {
      flashWorld = world ? world.clone() : null; flashAmt = amount; flashR = radiusPx; flashCol = untone(color);
    },
    focus(dist, range) { o.focus = dist; if (range !== undefined) o.focusRange = range; sync(); },
    setSize(w, h) { composer.setSize(w, h, false); sync(); },
    dispose() { composer.dispose(); },
  };
  return post;
}
