// Render engine for the ENGRAVING concept (raw three.js, no R3F): one MRT scene pass -> glow mip ->
// print composite (paper + key ink + contour/crease lines + 4 spot inks with misregistration + glow).
import * as THREE from "three";
import { U } from "./ink";

export type PrintLook = {
  bp: number;            // 0 = warm paper engraving, 1 = cyanotype blueprint
  xr: number;            // x-ray amount (dashed hidden lines are geometry; here: lighter paper tone)
  flash: number;         // white/green flash on impact
  flashGreen: number;    // 0 white, 1 green-tinted flash
  glowK: number;         // global glow multiplier
  vignette: number;      // corner darkening 0..1 (target corner/centre ~0.85)
  sepia?: number;
  focus?: [number, number, number]; // [depth m where fading starts, depth of full fade, strength]
};

const FS_TRI = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const COMMON = /* glsl */ `
uniform sampler2D tA; uniform sampler2D tN; uniform vec2 uRes; uniform float uPx; uniform float uBp;
vec3 spotCol(float id){
  if (id < 0.5) return vec3(1.0, 0.95, 0.84);
  if (id < 1.5) return vec3(0.208, 0.843, 1.0);   // #35D7FF cyan
  if (id < 2.5) return vec3(1.0, 0.231, 0.231);   // #FF3B3B red
  if (id < 3.5) return vec3(0.224, 1.0, 0.533);   // #39FF88 green
  if (id < 4.5) return vec3(1.0, 0.690, 0.125);   // #FFB020 amber
  return vec3(1.0, 0.95, 0.84);
}`;

// Downsample (1/4) the emissive glow: colour from the spot id; in blueprint the cyan lines glow too.
const DOWN = /* glsl */ `
${COMMON}
varying vec2 vUv;
void main(){
  vec3 acc = vec3(0.0); vec2 px = 1.0 / uRes;
  for (int j = -1; j <= 2; j++) for (int i = -1; i <= 2; i++) {
    vec4 a = texture2D(tA, vUv + (vec2(float(i), float(j)) - 0.5) * px);
    float id = floor(a.b * 8.0 + 0.5);
    acc += spotCol(id) * a.a;
    acc += vec3(0.30, 0.85, 1.0) * a.r * 0.30 * uBp;
  }
  gl_FragColor = vec4(acc / 16.0, 1.0);
}`;

const BLUR = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;
void main(){
  float w[5]; w[0]=0.227027; w[1]=0.1945946; w[2]=0.1216216; w[3]=0.054054; w[4]=0.016216;
  vec3 c = texture2D(tSrc, vUv).rgb * w[0];
  for (int i = 1; i < 5; i++){ c += texture2D(tSrc, vUv + uDir * float(i)).rgb * w[i]; c += texture2D(tSrc, vUv - uDir * float(i)).rgb * w[i]; }
  gl_FragColor = vec4(c, 1.0);
}`;

const COMP = /* glsl */ `
${COMMON}
uniform sampler2D tG1; uniform sampler2D tG2;
uniform float uXr, uFlash, uFlashGreen, uGlowK, uVig, uSepia; uniform vec3 uFocus;
uniform vec2 uOff[5];
varying vec2 vUv;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
vec4 nd(vec2 uv){ vec4 t = texture2D(tN, uv); if (t.a <= 0.0) t.a = 1e4; return t; }
void main(){
  vec2 px = 1.0 / uRes;
  vec2 fc = vUv * uRes / uPx;   // 1080-space pixel coords (paper is resolution independent)
  vec4 A = texture2D(tA, vUv);
  // ---- contour & crease lines from normal/depth (near side of a depth jump only) ----
  vec4 c0 = nd(vUv);
  float sil = 0.0, cre = 0.0;
  float rS = 3.2 * uPx, rC = 1.6 * uPx;
  for (int i = 0; i < 8; i++) {
    float an = float(i) * 0.785398;
    vec2 dv = vec2(cos(an), sin(an));
    vec4 s = nd(vUv + dv * rS * px);
    float rel = (s.a - c0.a) / c0.a;
    sil += smoothstep(0.035, 0.09, rel);
    vec4 sc = nd(vUv + dv * rC * px);
    float relc = abs(sc.a - c0.a) / c0.a;
    float turn = 1.0 - dot(sc.xyz * 2.0 - 1.0, c0.xyz * 2.0 - 1.0);
    cre += smoothstep(0.18, 0.45, turn) * (1.0 - smoothstep(0.03, 0.08, relc));
  }
  float edge = max(clamp(sil * 0.42, 0.0, 1.0), clamp(cre * 0.3, 0.0, 0.85));
  // ---- paper ----
  float mott = vn(fc * 0.012) * 0.6 + vn(fc * 0.045) * 0.4;
  float fib = 0.0;
  { vec2 p = fc * vec2(0.07, 0.016); vec2 ip = floor(p); float r = h21(ip);
    vec2 f = fract(p) - vec2(0.5, 0.5); float on = step(0.86, r);
    fib = on * (1.0 - smoothstep(0.02, 0.09, abs(f.y + 0.25 * sin(f.x * 6.0 + r * 9.0)))) * (1.0 - smoothstep(0.3, 0.5, abs(f.x))); }
  vec3 paperW = vec3(0.945, 0.910, 0.835) * (0.975 + 0.035 * mott) - fib * vec3(0.05, 0.05, 0.03);
  paperW = mix(paperW, vec3(0.90, 0.88, 0.83), uXr * 0.35);
  vec3 navy = vec3(0.043, 0.102, 0.20);           // #0B1A33
  vec3 paperB = navy * (0.94 + 0.12 * mott) + fib * vec3(0.01, 0.03, 0.05);
  vec3 paper = mix(paperW, paperB, uBp);
  // aerial perspective (engraver's convention): far planes print lighter, never blurrier
  float far = smoothstep(uFocus.x, uFocus.y, c0.a) * uFocus.z;
  // ---- spot inks (each plate slightly misregistered), drawn opaque so brand hex lands exactly ----
  vec3 col = paper;
  for (int k = 1; k <= 4; k++) {
    vec4 a = texture2D(tA, vUv + uOff[k] * px * uPx);
    float id = floor(a.b * 8.0 + 0.5);
    float cov = (abs(id - float(k)) < 0.5) ? a.g : 0.0;
    // ink density varies a little with the paper (letterpress)
    cov *= (0.93 + 0.07 * mott) * (1.0 - 0.55 * far);
    col = mix(col, spotCol(float(k)), clamp(cov, 0.0, 1.0));
  }
  // ---- key ink (navy on paper / cyan-white on blueprint) with a touch of spread ----
  float ink = max(A.r, edge);
  float inkN = (texture2D(tA, vUv + vec2(px.x, 0.0)).r + texture2D(tA, vUv - vec2(px.x, 0.0)).r + texture2D(tA, vUv + vec2(0.0, px.y)).r + texture2D(tA, vUv - vec2(0.0, px.y)).r) * 0.25;
  ink = max(ink, inkN * 0.18);
  ink *= (0.92 + 0.08 * mott) * (1.0 - 0.72 * far);
  vec3 keyInk = mix(navy * 0.92, vec3(0.80, 0.97, 1.0), uBp);
  // over a spot colour the key ink reads as a dark overprint of that colour
  vec3 over = mix(keyInk, keyInk * 0.55 + col * 0.12, (1.0 - uBp) * step(0.01, distance(col, paper)));
  col = mix(col, over, clamp(ink, 0.0, 1.0));
  // ---- glow (fluorescent ink + light) ----
  vec3 g = texture2D(tG1, vUv).rgb * 1.4 + texture2D(tG2, vUv).rgb * 1.6;
  col = 1.0 - (1.0 - col) * (1.0 - clamp(g * uGlowK, 0.0, 1.0));
  // emissive cores
  float id0 = floor(A.b * 8.0 + 0.5);
  col = mix(col, mix(spotCol(id0), vec3(1.0), 0.35), clamp(A.a * 0.85, 0.0, 1.0));
  // ---- vignette (lifted, never black) ----
  vec2 vq = (vUv - 0.5) * vec2(0.9, 1.0);
  float v = 1.0 - uVig * smoothstep(0.25, 0.85, length(vq) * 1.3);
  col *= v;
  col = mix(col, vec3(dot(col, vec3(0.3, 0.59, 0.11))) * vec3(1.08, 0.95, 0.75), uSepia);
  // ---- flash ----
  vec3 fcol = mix(vec3(1.0, 0.99, 0.95), vec3(0.75, 1.0, 0.85), uFlashGreen);
  col = mix(col, fcol, clamp(uFlash, 0.0, 1.0));
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export class Engine {
  renderer: THREE.WebGLRenderer;
  rt: THREE.WebGLRenderTarget;
  g1: THREE.WebGLRenderTarget; g1b: THREE.WebGLRenderTarget; g2: THREE.WebGLRenderTarget; g2b: THREE.WebGLRenderTarget;
  quad: THREE.Mesh; qs: THREE.Scene; qc: THREE.OrthographicCamera;
  mDown: THREE.ShaderMaterial; mBlur: THREE.ShaderMaterial; mComp: THREE.ShaderMaterial;
  w: number; h: number;
  constructor(canvas: HTMLCanvasElement, w: number, h: number) {
    this.w = w; this.h = h;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, alpha: false });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(w, h, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.rt = new THREE.WebGLRenderTarget(w, h, { count: 2, type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true });
    const mk = (d: number) => new THREE.WebGLRenderTarget(Math.ceil(w / d), Math.ceil(h / d), { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
    this.g1 = mk(4); this.g1b = mk(4); this.g2 = mk(12); this.g2b = mk(12);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    const common = { tA: { value: this.rt.textures[0] }, tN: { value: this.rt.textures[1] }, uRes: { value: new THREE.Vector2(w, h) }, uPx: U.uPx, uBp: U.uBp };
    this.mDown = new THREE.ShaderMaterial({ uniforms: { ...common }, vertexShader: FS_TRI, fragmentShader: DOWN, depthTest: false, depthWrite: false });
    this.mBlur = new THREE.ShaderMaterial({ uniforms: { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } }, vertexShader: FS_TRI, fragmentShader: BLUR, depthTest: false, depthWrite: false });
    const off = [[0, 0], [1.3, -0.9], [-1.1, 1.0], [0.9, 1.2], [-1.2, -0.7]].map(([x, y]) => new THREE.Vector2(x, y));
    this.mComp = new THREE.ShaderMaterial({
      uniforms: { ...common, tG1: { value: this.g1.texture }, tG2: { value: this.g2.texture }, uXr: { value: 0 }, uFlash: { value: 0 }, uFlashGreen: { value: 0 }, uGlowK: { value: 1 }, uVig: { value: 0.15 }, uSepia: { value: 0 }, uFocus: { value: new THREE.Vector3(50, 60, 0) }, uOff: { value: off } },
      vertexShader: FS_TRI, fragmentShader: COMP, depthTest: false, depthWrite: false,
    });
    this.quad = new THREE.Mesh(geo, this.mDown);
    this.quad.frustumCulled = false;
    this.qs = new THREE.Scene(); this.qs.add(this.quad);
    this.qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    U.uPx.value = h / 1920;
  }
  private pass(m: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = m; this.renderer.setRenderTarget(target); this.renderer.render(this.qs, this.qc);
  }
  private blur(src: THREE.WebGLRenderTarget, tmp: THREE.WebGLRenderTarget, r: number) {
    this.mBlur.uniforms.tSrc.value = src.texture; this.mBlur.uniforms.uDir.value.set(r / src.width, 0); this.pass(this.mBlur, tmp);
    this.mBlur.uniforms.tSrc.value = tmp.texture; this.mBlur.uniforms.uDir.value.set(0, r / src.height); this.pass(this.mBlur, src);
  }
  render(scene: THREE.Scene, camera: THREE.Camera, look: PrintLook) {
    U.uBp.value = look.bp; U.uXr.value = look.xr;
    const r = this.renderer;
    r.setRenderTarget(this.rt);
    r.setClearColor(0x000000, 0);
    r.clear(true, true, true);
    r.render(scene, camera);
    // glow chain
    this.mDown.uniforms.uRes.value.set(this.w, this.h);
    this.pass(this.mDown, this.g1);
    this.blur(this.g1, this.g1b, 1.4);
    // second, wider level from the first
    this.mBlur.uniforms.tSrc.value = this.g1.texture; this.mBlur.uniforms.uDir.value.set(0, 0);
    this.pass(this.mBlur, this.g2);
    this.blur(this.g2, this.g2b, 1.6);
    const c = this.mComp.uniforms;
    c.uXr.value = look.xr; c.uFlash.value = look.flash; c.uFlashGreen.value = look.flashGreen; c.uGlowK.value = look.glowK; c.uVig.value = look.vignette; c.uSepia.value = look.sepia ?? 0;
    const fo = look.focus ?? [6.5, 14, 0.45]; c.uFocus.value.set(fo[0], fo[1], fo[2]);
    this.pass(this.mComp, null);
  }
}
