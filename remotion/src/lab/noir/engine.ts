// Imperative three.js engine for the GOUACHE lab: one renderer + scene per page, every frame is a pure function of
// (composition, frame). Post: bloom (mip blur, threshold on HDR practicals) -> GouacheGrade (hot-core bleach,
// navy-lifted blacks, warm/cool split, vignette, paper tooth, flash).
import * as THREE from "three";
import { EffectComposer, RenderPass, EffectPass, BloomEffect, Effect, BlendFunction } from "postprocessing";
import { initShared, U, lin, BRAND } from "./shade";
import { buildWorld, World, CHAR_POS, RAIL_Z, RAIL_X, GEAR_Y } from "./world";
import { buildRig, Rig, applyPose, POSES, mixPose, setVariant, Pose } from "./character";
import { canvas, rng, toTex } from "./paint";

const DEBUG = false;
export type Comp = "hero" | "faces" | "states" | "motion";

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
const ease = (f: number, a: number, b: number) => glide((f - a) / (b - a));
const backOut = (u: number) => { const x = clamp01(u), s = 1.4; return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };

function paperTooth() {
  const S = 256, c = canvas(S, S), g = c.getContext("2d")!, r = rng(808);
  const img = g.createImageData(S, S);
  for (let i = 0; i < S * S; i++) { const v = 128 + (r() - 0.5) * 60; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  g.globalAlpha = 0.25; g.filter = "blur(1px)"; g.drawImage(c, 0, 0);
  const t = toTex(c, { srgb: false, repeat: [1, 1] }); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

class GouacheGrade extends Effect {
  constructor(tooth: THREE.Texture) {
    super("GouacheGrade", /* glsl */ `
      uniform sampler2D uTooth; uniform vec2 uRes; uniform float uVig; uniform float uFlash; uniform vec3 uFlashCol; uniform vec3 uLift; uniform float uState;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
        vec3 c = inputColor.rgb;
        float m = max(max(c.r, c.g), c.b);
        if (m > 1.0) c = mix(c / m, vec3(1.0), smoothstep(1.0, 4.0, m)); // hot cores bleach, never hue-clip
        float y = dot(c, vec3(0.2126, 0.7152, 0.0722));
        // warm highlights / cool shadows (solid only), saturation kept
        if (uState > 1.5) {
          c *= mix(vec3(0.97, 1.0, 1.06), vec3(1.04, 1.0, 0.95), smoothstep(0.05, 0.5, y));
        }
        // paper tooth: gouache sits on paper
        float t = texture2D(uTooth, uv * uRes / 256.0).r - 0.5;
        c *= 1.0 + t * 0.07;
        // vignette (~0.82 corners)
        vec2 q = (uv - 0.5) * vec2(0.85, 1.0);
        c *= 1.0 - uVig * smoothstep(0.25, 0.75, length(q));
        // lifted navy floor: no pure black anywhere
        c = c * (1.0 - uLift.b * 0.0) + uLift * (1.0 - smoothstep(0.0, 0.25, y));
        c = mix(c, uFlashCol, uFlash);
        outputColor = vec4(c, inputColor.a);
      }`, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, THREE.Uniform>([
        ["uTooth", new THREE.Uniform(tooth)], ["uRes", new THREE.Uniform(new THREE.Vector2(540, 960))], ["uVig", new THREE.Uniform(0.2)],
        ["uFlash", new THREE.Uniform(0)], ["uFlashCol", new THREE.Uniform(new THREE.Color(1, 1, 1))], ["uLift", new THREE.Uniform(lin(BRAND.navy).multiplyScalar(0.55))],
        ["uState", new THREE.Uniform(2)],
      ]),
    });
  }
}

export type Frame = {
  state: number; pose: Pose; expr: string; handF: string; handN: string;
  cam: { pos: THREE.Vector3; look: THREE.Vector3; fov: number; roll: number };
  carY: number; jaw: number; jawGlow: number; beacon: number; flash: number; flashCol: THREE.Color; spark: number; snap: number; t: number;
  headAim: number; // 0 = down at the gear, 1 = up at the ropes
  labels: boolean;
};

// camera presets (car space)
const HERO = { pos: new THREE.Vector3(1.2, 1.2, 2.9), look: new THREE.Vector3(-0.52, 1.12, -0.4), fov: 50 };

export function frameAt(comp: Comp, f: number): Frame {
  const base: Frame = {
    state: 2, pose: { ...POSES.idle }, expr: "calm", handF: "relax", handN: "grip",
    cam: { pos: HERO.pos.clone(), look: HERO.look.clone(), fov: HERO.fov, roll: 0 },
    carY: 0, jaw: 0, jawGlow: 0.12, beacon: 0.25, flash: 0, flashCol: new THREE.Color(1, 1, 1), spark: -1, snap: 0, t: 2.0, headAim: 0, labels: false,
  };
  if (comp === "hero") return base;
  if (comp === "states") { base.state = [0, 1, 2][Math.min(2, f)]; base.labels = f === 0; if (f === 1) { base.beacon = 0.9; base.headAim = 1; base.expr = "alarm"; base.pose = { ...POSES.alarm }; base.handF = "splay"; base.handN = "splay"; } return base; }
  if (comp === "faces") {
    const k = ["calm", "alarm", "relief"][Math.min(2, f)];
    base.expr = k;
    base.pose = { ...(k === "calm" ? POSES.idle : k === "alarm" ? POSES.alarm : POSES.relief) };
    if (k === "alarm") { base.handF = "splay"; base.handN = "splay"; base.beacon = 1; base.headAim = 1; }
    if (k === "relief") { base.jaw = 1; base.jawGlow = 0.8; base.handN = "relax"; }
    base.cam.fov = 40; // the face camera is placed by the engine relative to the eye anchor
    return base;
  }
  // ---------- motion: 90 f ----------
  const fr = base; fr.t = 2 + f / 30;
  // slow eased push-in along the view axis (+ a slight rise), whole clip
  const push = glide(f / 89);
  const MP = new THREE.Vector3(1.05, 1.62, 2.35), ML = new THREE.Vector3(-0.42, 0.98, -0.25);
  const dir = MP.clone().sub(ML);
  fr.cam.pos = ML.clone().add(dir.multiplyScalar(1 - 0.17 * push)); fr.cam.pos.y += 0.06 * push;
  fr.cam.look = ML.clone(); fr.cam.fov = 46;
  // beats
  const ALARM = 22, SNAP = 40, CLAMP = 58, RELIEF = 72;
  fr.beacon = f < ALARM ? 0.15 : 0.5 + 0.5 * Math.max(0, Math.sin((f - ALARM) * 0.55));
  if (f >= RELIEF) fr.beacon *= 1 - 0.6 * ease(f, RELIEF, 89);
  // character
  const idle = { ...POSES.idle };
  let p: Pose = idle;
  if (f >= ALARM + 2) p = mixPose(idle, POSES.alarm, backOut((f - ALARM - 2) / 9));
  if (f >= SNAP + 1) p = mixPose(POSES.alarm, POSES.brace, backOut((f - SNAP - 1) / 8));
  if (f >= CLAMP) { p = { ...POSES.brace }; const k = f - CLAMP; p.rootY -= 4 * Math.exp(-k / 3) * Math.sin(Math.min(k, 3) / 3 * Math.PI / 2 + 0.01) * (k < 9 ? 1 : 0); }
  if (f >= RELIEF) p = mixPose(POSES.brace, POSES.relief, glide((f - RELIEF) / 14));
  p = { ...p };
  p.breathe = 0.006 * Math.sin(f / 30 * Math.PI * 2 * (f < ALARM ? 0.28 : 0.75));
  p.head += 1.2 * Math.sin(f * 0.21);
  // secondary: the hands lag the arms on the alarm and snap reactions
  const lag = (f0: number) => (f >= f0 ? 10 * Math.exp(-(f - f0) / 4) * Math.sin((f - f0) * 0.7) : 0);
  p.handF += lag(ALARM + 4) + lag(SNAP + 2); p.handN -= lag(ALARM + 5) * 0.8;
  fr.pose = p;
  fr.headAim = f < ALARM + 2 ? 0 : glide((f - ALARM - 2) / 8);
  if (f >= RELIEF) fr.headAim = 1 - 0.7 * glide((f - RELIEF) / 14);
  fr.expr = f < ALARM + 2 ? (f >= 10 && f < 13 ? "blink" : "calm") : f < ALARM + 3 ? "blink" : f < RELIEF + 4 ? "alarm" : f < RELIEF + 6 ? "blink" : "relief";
  fr.handF = f >= ALARM + 3 && f < RELIEF + 6 ? "splay" : "relax";
  fr.handN = f >= ALARM + 3 && f < RELIEF + 6 ? "splay" : f >= RELIEF + 6 ? "relax" : "grip";
  // the drop: rope snaps, free-fall-ish until the jaws bite; tiny shudder at the alarm
  if (f >= SNAP) fr.snap = (f - SNAP) / 30;
  const td = Math.max(0, Math.min(f, CLAMP) - SNAP) / 30;
  fr.carY = -0.5 * 3.2 * td * td;
  if (f > ALARM && f < ALARM + 8) fr.carY += 0.006 * Math.sin((f - ALARM) * 2.8) * (1 - (f - ALARM) / 8);
  // jaws: ride up the taper the last 4 frames before the clamp, glow peaks on the clamp frame then settles
  fr.jaw = f < CLAMP - 4 ? 0 : clamp01((f - (CLAMP - 4)) / 4);
  fr.jawGlow = f < CLAMP ? 0.12 + 0.5 * fr.jaw : 0.9 + 2.4 * Math.exp(-(f - CLAMP) / 5);
  if (f >= CLAMP && f < CLAMP + 4) { fr.flash = [0.55, 0.32, 0.16, 0.06][f - CLAMP]; fr.flashCol = new THREE.Color(lin("#c8ffe0")); }
  fr.spark = f >= CLAMP - 1 ? (f - CLAMP + 1) / 30 : -1;
  // camera rides the car with lag (the car sinks in frame), clamp kick decays in 7 f
  const camFollow = fr.carY * 0.82;
  fr.cam.pos.y += camFollow; fr.cam.look.y += camFollow;
  if (f >= CLAMP && f < CLAMP + 8) { const n = f - CLAMP; const a = 0.022 * (n % 2 ? -1 : 1) * Math.pow(1 - n / 8, 1.5); fr.cam.look.y += a; fr.cam.roll = a * 0.4; }
  return fr;
}

export class NoirEngine {
  renderer: THREE.WebGLRenderer; composer: EffectComposer; camera: THREE.PerspectiveCamera; w: World; rig: Rig; grade: GouacheGrade; bloom: BloomEffect;
  W: number; H: number;
  constructor(public cvs: HTMLCanvasElement, W: number, H: number, dpr: number) {
    this.W = W; this.H = H;
    initShared();
    const r = new THREE.WebGLRenderer({ canvas: cvs, antialias: false, preserveDrawingBuffer: true, powerPreference: "high-performance", stencil: false });
    r.setPixelRatio(dpr); r.setSize(W, H, false);
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.NoToneMapping;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = r;
    this.camera = new THREE.PerspectiveCamera(46, W / H, 0.05, 120);
    this.w = buildWorld();
    this.rig = buildRig();
    this.rig.root.position.copy(CHAR_POS);
    this.w.car.add(this.rig.root);
    const bw = Math.round(W * dpr), bh = Math.round(H * dpr);
    this.composer = new EffectComposer(r, { frameBufferType: THREE.HalfFloatType, multisampling: 4 });
    this.composer.setSize(W, H, false);
    this.composer.addPass(new RenderPass(this.w.scene, this.camera));
    this.bloom = new BloomEffect({ blendFunction: BlendFunction.ADD, mipmapBlur: true, luminanceThreshold: 0.9, luminanceSmoothing: 0.25, intensity: 0.85, radius: 0.72 });
    this.grade = new GouacheGrade(paperTooth());
    (this.grade.uniforms.get("uRes")!.value as THREE.Vector2).set(bw, bh);
    this.composer.addPass(new EffectPass(this.camera, this.bloom, this.grade));
    this.w.lineMats.forEach((m) => m.resolution.set(bw, bh));
    this.w.moteMat.uniforms.uPx.value = bh / (2 * Math.tan((46 / 2) * Math.PI / 180));
    this.w.sparkMat.uniforms.uPx.value = this.w.moteMat.uniforms.uPx.value;
  }

  render(comp: Comp, frame: number) {
    const F = frameAt(comp, frame), w = this.w, rig = this.rig;
    const st = F.state;
    U.uState.value = st;
    this.grade.uniforms.get("uState")!.value = st;
    // visibility per state
    w.bpOnly.forEach((o) => (o.visible = st === 0));
    w.xrayOnly.forEach((o) => (o.visible = st === 1));
    w.notXray.forEach((o) => (o.visible = st !== 1));
    w.notBp.forEach((o) => (o.visible = st !== 0));
    w.ropes.forEach((rp) => (rp.mesh.visible = st !== 0));
    this.renderer.setClearColor(st === 0 ? lin(BRAND.navy) : lin("#1d3a4c"), 1);
    // car, jaws, glow
    w.car.position.y = F.carY;
    w.jaws.forEach((j) => { const b = j.userData.base as THREE.Vector3; j.position.set(b.x, b.y + 0.045 * F.jaw, b.z - j.userData.zs * 0.019 * F.jaw); });
    w.jawMat.emissiveIntensity = st === 0 ? 0 : F.jawGlow;
    w.jawLight.intensity = st === 2 ? 0.6 * F.jawGlow : 0;
    // practicals
    const bk = F.beacon;
    (w.beaconMesh.material as THREE.MeshBasicMaterial).color.copy(lin(BRAND.red)).multiplyScalar(st === 0 ? 0.0 : 0.6 + 2.6 * bk);
    w.beacon.intensity = st !== 0 ? 2.6 * Math.max(0, bk - 0.2) : 0;
    ((w.beaconMesh.userData.halo as THREE.Sprite).material as THREE.SpriteMaterial).color.copy(lin(BRAND.red)).multiplyScalar(st === 0 ? 0 : 0.5 * bk);
    w.slitMats.forEach((m) => m.color.copy(st === 0 ? lin(BRAND.cyan).multiplyScalar(1.0) : lin("#bfeaf2").multiplyScalar(3.2)));
    w.key.intensity = st !== 0 ? 6 : 0; w.slit.intensity = st !== 0 ? 2.6 : 0; w.slit2.intensity = st !== 0 ? 2.2 : 0;
    w.beams.forEach((m) => (m.uniforms.uT.value = F.t * 30));
    w.hazeMats.forEach((m) => (m.uniforms.uT.value = F.t * 30));
    w.moteMat.uniforms.uT.value = F.t; w.moteMat.uniforms.uCarY.value = 0;
    w.lampCone.visible = st === 2 && comp !== "faces";
    (w.car.userData.cabLight as THREE.PointLight).intensity = st === 1 ? 3 : 0;
    w.hazeMats.forEach((m) => (m.uniforms.uK.value = (m.userData.k ??= m.uniforms.uK.value) * (st === 1 ? 0.35 : 1)));
    w.beams.forEach((m) => (m.uniforms.uI.value = (m.userData.k ??= m.uniforms.uI.value) * (st === 1 ? 0.4 : 1)));
    this.camera.updateMatrixWorld();
    w.sparkMat.uniforms.uAge.value = st === 2 ? F.spark : -1;
    w.sparkMat.uniforms.uO.value.set(-(RAIL_X - 0.08), GEAR_Y + 0.1, RAIL_Z + 0.05);
    // rope snap: rope 2 breaks above the car; the upper end recoils up, the lower end slumps
    this.ropes(F.snap);
    // character
    rig.root.rotation.y = 0;
    applyPose(rig, F.pose);
    const mode = st === 0 ? "bp" : "solid";
    for (const p of Object.values(rig.parts)) {
      if (!Object.keys(p.variants).length) continue;
      const k = p.def.name === "head" ? F.expr : p.def.name === "handF" ? F.handF : p.def.name === "handN" ? F.handN : Object.keys(p.variants)[0];
      setVariant(p, k, mode);
    }
    rig.contact.visible = st === 2;
    // camera
    const cam = this.camera;
    if (comp === "faces") {
      w.car.updateMatrixWorld(true);
      const eye = new THREE.Vector3(); rig.eyeAnchor.getWorldPosition(eye);
      const look = eye.clone().add(new THREE.Vector3(0.04, -0.17, 0));
      cam.position.copy(look).add(new THREE.Vector3(0.5, 0.12, 1.12));
      cam.fov = 40; cam.up.set(0, 1, 0); cam.lookAt(look);
    } else {
      const pos = F.cam.pos.clone(), look = F.cam.look.clone();
      if (comp !== "motion") { pos.y += F.carY; look.y += F.carY; }
      cam.position.copy(pos); cam.fov = F.cam.fov;
      const fwd = look.clone().sub(pos).normalize(); cam.up.set(0, 1, 0).applyAxisAngle(fwd, F.cam.roll); cam.lookAt(look);
    }
    cam.near = 0.05; cam.far = 120; cam.updateProjectionMatrix();
    // character faces the camera azimuth (a 2.5D cut-out must never go edge-on)
    w.car.updateMatrixWorld(true);
    const cp = cam.position.clone(); w.car.worldToLocal(cp);
    rig.root.rotation.y = Math.atan2(cp.x - CHAR_POS.x, cp.z - CHAR_POS.z) - (comp === "faces" ? 0.15 : 0.45); // turned between camera and key lamp
    rig.root.updateMatrixWorld(true);
    // headlamp: from the helmet toward the gear (calm) or up the ropes (alarm)
    const hp = new THREE.Vector3(); rig.lampAnchor.getWorldPosition(hp);
    const gearT = new THREE.Vector3(-RAIL_X + 0.1, GEAR_Y + w.car.position.y, RAIL_Z + 0.1);
    const upT = new THREE.Vector3(-0.2, 3.6 + w.car.position.y, RAIL_Z);
    const tgt = gearT.clone().lerp(upT, F.headAim);
    w.car.worldToLocal(hp); w.car.worldToLocal(tgt);
    w.head.position.copy(hp); w.head.target.position.copy(tgt);
    w.head.intensity = st !== 0 ? 3.2 : 0;
    const hd = tgt.clone().sub(hp).normalize();
    w.headCone.position.copy(hp).addScaledVector(hd, 0.22); w.headCone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), tgt.clone().sub(hp).normalize());
    w.headCone.visible = st === 2 && comp !== "faces";
    w.arrows.forEach((a) => { const p = new THREE.Vector3(); a.getWorldPosition(p); a.rotation.y = Math.atan2(cam.position.x - p.x, cam.position.z - p.z); });
    if ((globalThis as any).__NOIR_DBG !== false && DEBUG) { w.hazeMats.forEach((m) => (m.uniforms.uK.value = 0)); w.beams.forEach((m) => (m.uniforms.uI.value = 0)); U.uFogDen.value = 0.0001; U.uShadeLo.value.setRGB(0, 0, 0); U.uShadeHi.value.setRGB(0, 0, 0); w.slit.intensity = 0; w.slit2.intensity = 0; w.head.intensity = 0; }
    // grade
    this.grade.uniforms.get("uFlash")!.value = F.flash;
    (this.grade.uniforms.get("uFlashCol")!.value as THREE.Color).copy(F.flashCol);
    this.grade.uniforms.get("uVig")!.value = st === 0 ? 0.12 : 0.2;
    this.bloom.intensity = st === 0 ? 0.6 : 0.85;
    this.composer.render();
    return { labels: F.labels ? this.labelAnchors() : null, state: st };
  }

  ropeGeoCache: THREE.BufferGeometry | null = null;
  ropes(snap: number) {
    const rp = this.w.ropes[1];
    if (snap <= 0) return;
    const x = rp.x, z = RAIL_Z, B = 2.3; // break height above the hitch
    const t = snap;
    // lower piece: slumps and curls over toward the camera
    const low: THREE.Vector3[] = [];
    for (let i = 0; i <= 16; i++) {
      const u = i / 16, y = 0.58 + u * (B - 0.58);
      const sag = Math.min(1, t * 2.2) * u * u;
      low.push(new THREE.Vector3(x + sag * 0.35 + Math.sin(u * 7 + t * 18) * 0.04 * sag, y - sag * (B - 0.7) * 0.9, z + sag * 0.45));
    }
    // upper piece: recoils up with a travelling whip
    const up: THREE.Vector3[] = [];
    const rise = Math.min(4, t * 9);
    for (let i = 0; i <= 24; i++) {
      const u = i / 24, y = B + rise + u * 14;
      const amp = 0.28 * Math.exp(-u * 3) * Math.sin(u * 14 - t * 30) * Math.exp(-t * 2);
      up.push(new THREE.Vector3(x + amp, y, z + amp * 0.6));
    }
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(low), 32, 0.011, 6, false);
    const g2 = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(up), 40, 0.011, 6, false);
    const merged = mergeTwo(g, g2);
    rp.mesh.geometry.dispose(); rp.mesh.geometry = merged;
  }

  labelAnchors() {
    const out: Record<string, [number, number]> = {};
    for (const [k, o] of Object.entries(this.w.anchors)) {
      const v = new THREE.Vector3(); o.getWorldPosition(v); v.project(this.camera);
      out[k] = [(v.x * 0.5 + 0.5) * this.W, (-v.y * 0.5 + 0.5) * this.H];
    }
    const v = new THREE.Vector3(); this.rig.eyeAnchor.getWorldPosition(v); v.project(this.camera);
    out.tech = [(v.x * 0.5 + 0.5) * this.W, (-v.y * 0.5 + 0.5) * this.H];
    return out;
  }
}

function mergeTwo(a: THREE.BufferGeometry, b: THREE.BufferGeometry) {
  const g = new THREE.BufferGeometry();
  for (const name of ["position", "normal", "uv"]) {
    const A = a.getAttribute(name) as THREE.BufferAttribute, B = b.getAttribute(name) as THREE.BufferAttribute;
    const arr = new Float32Array(A.array.length + B.array.length); arr.set(A.array as Float32Array); arr.set(B.array as Float32Array, A.array.length);
    g.setAttribute(name, new THREE.BufferAttribute(arr, A.itemSize));
  }
  const ia = a.getIndex()!, ib = b.getIndex()!, n = a.getAttribute("position").count;
  const idx = new Uint32Array(ia.count + ib.count); idx.set(ia.array as ArrayLike<number>); for (let i = 0; i < ib.count; i++) idx[ia.count + i] = (ib.array as ArrayLike<number>)[i] + n;
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}
