// [hybrid/set] Standalone test harness for buildShaft(): one renderer per page, every frame a pure function of
// (comp, frame). Minimal post (bloom on HDR practicals + a light grade) so the set can be judged on its own;
// the real grade/DOF lives in ../look (post) and ../shots (engine) later.
import * as THREE from "three";
import { EffectComposer, RenderPass, EffectPass, BloomEffect, Effect, BlendFunction } from "postprocessing";
import { initShared, gouache, lin, BRAND } from "../look/shade";
import { buildShaft, Shaft, RAIL, GEAR_Y, BLADE_Z, SLING_Z } from "./shaft";
import { clamp01, smooth } from "./kit";

export type SetComp = "establish" | "gear" | "snap" | "states";
const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };

class Grade extends Effect {
  constructor() {
    super("SetGrade", /* glsl */ `
      uniform float uVig; uniform vec3 uLift; uniform float uState;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
        vec3 c = inputColor.rgb;
        float m = max(max(c.r, c.g), c.b);
        if (m > 1.0) c = mix(c / m, vec3(1.0), smoothstep(1.0, 4.0, m));
        float y = dot(c, vec3(0.2126, 0.7152, 0.0722));
        if (uState > 1.5) c *= mix(vec3(0.97, 1.0, 1.05), vec3(1.04, 1.0, 0.96), smoothstep(0.05, 0.5, y));
        vec2 q = (uv - 0.5) * vec2(0.85, 1.0);
        c *= 1.0 - uVig * smoothstep(0.3, 0.8, length(q));
        c += uLift * (1.0 - smoothstep(0.0, 0.22, y));
        outputColor = vec4(c, inputColor.a);
      }`, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, THREE.Uniform>([["uVig", new THREE.Uniform(0.15)], ["uLift", new THREE.Uniform(lin(BRAND.navy).multiplyScalar(0.5))], ["uState", new THREE.Uniform(2)]]),
    });
  }
}

type Cam = { pos: THREE.Vector3; look: THREE.Vector3; fov: number; roll?: number; carSpace?: boolean };
export type SetFrame = { state: 0 | 1 | 2; cam: Cam; carY: number; clamp: number; glow?: number; sparks: number; snap: number; alarm: number; force: number; t: number; labels: boolean };

// medium "establishing" framing: roof + figure centre/left of centre, gear lower right, ropes + landing above
const MED: Cam = { pos: new THREE.Vector3(0.25, 1.75, 3.7), look: new THREE.Vector3(0.5, 0.45, -0.6), fov: 40, carSpace: true };

export function frameAt(comp: SetComp, f: number): SetFrame {
  const F: SetFrame = { state: 2, cam: { ...MED, pos: MED.pos.clone(), look: MED.look.clone() }, carY: 0, clamp: 0, sparks: -1, snap: 0, alarm: 0, force: 0, t: 2 + f / 30, labels: false };
  if (comp === "establish") {
    if (f === 1) F.cam = { pos: new THREE.Vector3(0.45, 0.95, 2.4), look: new THREE.Vector3(-0.05, 4.6, -1.0), fov: 52, carSpace: true };
    return F;
  }
  if (comp === "states") {
    F.state = ([0, 1, 2] as const)[Math.min(2, f)];
    F.labels = f === 0;
    if (f === 1) { F.force = 1; F.alarm = 0.7; F.clamp = 0.35; }
    return F;
  }
  if (comp === "gear") {
    // car already falling at 2.6 m/s; governor trips at f12, jaws travel f12-24 (ease-in), bite f24,
    // deceleration over 9 f with a small rebound; camera rides the car (rail slides up through frame, then stops)
    const TRIP = 12, BITE = 24, v0 = 2.6;
    const tt = (n: number) => n / 30;
    let y = 0;
    for (let k = 1; k <= f; k++) { const vk = k <= BITE ? v0 : v0 * Math.max(0, 1 - glide((k - BITE) / 9)); y -= vk / 30; }
    if (f > BITE) y += 0.012 * Math.sin((f - BITE) * 0.9) * Math.exp(-(f - BITE) / 5);
    F.carY = y;
    const u = clamp01((f - TRIP) / (BITE - TRIP));
    F.clamp = u * u;
    F.glow = f < BITE ? 0.1 * smooth(0.6, 1, F.clamp) : 0.65 + 0.6 * Math.exp(-(f - BITE) / 6);
    F.sparks = f >= BITE - 1 ? tt(f - BITE + 1) : -1;
    const push = glide(f / 44);
    const d = 1.6 - 0.15 * push;
    F.cam = { pos: new THREE.Vector3(RAIL.x - 0.05, GEAR_Y + 0.1, BLADE_Z + d), look: new THREE.Vector3(RAIL.x - 0.03, GEAR_Y - 0.03, BLADE_Z), fov: 38, carSpace: true };
    if (f >= BITE && f < BITE + 10) { const n = f - BITE; const a = 0.006 * (n % 2 ? -1 : 1) * Math.pow(1 - n / 10, 1.5); F.cam.look.y += a; F.cam.pos.y += a * 0.5; }
    return F;
  }
  // snap: medium-close on the roof + ropes; ropes part at f10, alarm f12, car drops from f16 (camera follows with lag)
  const SNAP = 10, DROP = 16;
  F.cam = { pos: new THREE.Vector3(-0.7, 1.6, 3.2), look: new THREE.Vector3(0.15, 1.75, -0.94), fov: 46, carSpace: false };
  F.snap = f >= SNAP ? (f - SNAP + 0.5) / 30 : 0;
  F.alarm = f < SNAP + 2 ? 0 : 0.55 + 0.45 * Math.max(0, Math.sin((f - SNAP - 2) * 0.6));
  const td = Math.max(0, f - DROP) / 30;
  F.carY = -0.5 * 6.5 * td * td;
  if (f >= SNAP && f < DROP + 2) F.carY += 0.02 * Math.sin((f - SNAP) * 1.3) * Math.exp(-(f - SNAP) / 4); // rope-release jolt
  const follow = F.carY * 0.72;
  F.cam.pos.y += follow; F.cam.look.y += follow;
  if (f >= SNAP && f < SNAP + 10) { const n = f - SNAP; const a = 0.012 * (n % 2 ? -1 : 1) * Math.pow(1 - n / 10, 1.5); F.cam.look.x += a; F.cam.roll = a * 0.5; }
  return F;
}

export class SetEngine {
  renderer: THREE.WebGLRenderer; composer: EffectComposer; camera: THREE.PerspectiveCamera; scene: THREE.Scene; shaft: Shaft; grade: Grade; bloom: BloomEffect; standin: THREE.Mesh;
  constructor(public cvs: HTMLCanvasElement, public W: number, public H: number, dpr: number) {
    initShared();
    const r = new THREE.WebGLRenderer({ canvas: cvs, antialias: false, preserveDrawingBuffer: true, stencil: false });
    r.setPixelRatio(dpr); r.setSize(W, H, false);
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.NoToneMapping;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = r;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, W / H, 0.05, 120);
    this.shaft = buildShaft();
    this.scene.add(this.shaft.group);
    // stand-in figure: 1.75 m amber capsule on the roof (scale reference only)
    const mat = gouache({ color: BRAND.amber, brushScale: 2, rim: 0.4, xray: 0 });
    this.standin = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 1.35, 6, 16), mat);
    this.standin.castShadow = true; this.standin.receiveShadow = true;
    this.standin.position.copy(this.shaft.charSpot).setY(this.shaft.carRoofY + 0.875);
    this.shaft.car.add(this.standin);
    const bw = Math.round(W * dpr), bh = Math.round(H * dpr);
    this.composer = new EffectComposer(r, { frameBufferType: THREE.HalfFloatType, multisampling: 4 });
    this.composer.setSize(W, H, false);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new BloomEffect({ blendFunction: BlendFunction.ADD, mipmapBlur: true, luminanceThreshold: 0.9, luminanceSmoothing: 0.25, intensity: 0.8, radius: 0.7 });
    this.grade = new Grade();
    this.composer.addPass(new EffectPass(this.camera, this.bloom, this.grade));
    this.shaft.setViewport(bw, bh, 42);
  }

  render(comp: SetComp, frame: number) {
    const F = frameAt(comp, frame), S = this.shaft;
    S.setState(F.state);
    S.setTime(F.t);
    S.setCarDrop(F.carY);
    S.setGearClamp(F.clamp);
    if (F.glow !== undefined) S.setGearGlow(F.glow);
    S.setSparks(F.sparks);
    S.setRopeSnap(F.snap);
    S.setAlarm(F.alarm);
    S.setForce(F.force);
    this.renderer.setClearColor(F.state === 0 ? lin(BRAND.navy) : lin("#1d3a4c"), 1);
    const cam = this.camera, pos = F.cam.pos.clone(), look = F.cam.look.clone();
    if (F.cam.carSpace) { pos.y += F.carY; look.y += F.carY; }
    cam.position.copy(pos); cam.fov = F.cam.fov;
    const fwd = look.clone().sub(pos).normalize();
    cam.up.set(0, 1, 0).applyAxisAngle(fwd, F.cam.roll ?? 0); cam.lookAt(look);
    cam.near = 0.05; cam.far = 120; cam.updateProjectionMatrix();
    S.setViewport(Math.round(this.W * this.renderer.getPixelRatio()), Math.round(this.H * this.renderer.getPixelRatio()), F.cam.fov);
    this.grade.uniforms.get("uState")!.value = F.state;
    this.grade.uniforms.get("uVig")!.value = F.state === 0 ? 0.08 : 0.15;
    this.bloom.intensity = F.state === 0 ? 0.6 : 0.8;
    this.scene.updateMatrixWorld(true);
    this.composer.render();
    return { labels: F.labels ? this.project() : null };
  }

  project() {
    const out: Record<string, [number, number]> = {};
    for (const p of this.shaft.patent) {
      const o = this.shaft.anchors[p.key]; if (!o) continue;
      const v = new THREE.Vector3(); o.getWorldPosition(v); v.project(this.camera);
      if (v.z > 1) continue;
      out[p.key] = [(v.x * 0.5 + 0.5) * this.W, (-v.y * 0.5 + 0.5) * this.H];
    }
    return out;
  }
}
export { SLING_Z };
