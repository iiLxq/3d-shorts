// [gus lab] Gus contract for the World lab (docs/lab/paper-v2/PLAN.md).
//   const gus = buildGus({ method: "replacement" });   scene.add(gus.root);
//   per frame: gus.setPose("idle" | {...}); gus.setExpression("alarmed", 1); gus.update(frame, camera);
// Optional but recommended: gus.setCameraTrack((f) => cameraAtFrame(f), shotStartFrame) so the camera-responsive
// lean is deterministic when frames render out of order. Without it, update() keeps a history and is exact
// only for sequential rendering from the shot start.
import * as THREE from "three";
import { Figure, VARIANTS, Variant, MOUTHS, PIN_MATS } from "./figure";
import { POSES, PoseName, PoseData, mixPose, EXPRS, ExprName, ExprData, mixExpr } from "./poses";
import { GYRO_DEFAULT, GyroOpts, CamSample, camSample, leanFromTrack, Lean, wrap } from "./gyro";
import type { Look } from "./paint";
import { deg, clamp } from "./kit";

export type GusExpr = ExprName;
export type GusPose = PoseName | Partial<PoseData> | PoseData;
export type GusMethod = "replacement" | "vfold";
export interface GusOpts {
  view?: "auto" | "front" | "threeQuarter" | "profile";
  method?: GusMethod;
  variant?: "A" | "B";
  gyro?: Partial<GyroOpts> | false;  // camera-responsive body (default on)
  fold?: number;                      // V-fold half angle (rad), default 22 deg
  flip?: number;                      // 0 = hard replacement pop; otherwise a 4-frame paper flip (needs setCameraTrack)
  autoBlink?: boolean;
  onTwos?: boolean;                   // gyro + blink stepped on 2s (match a Gus animated on 2s)
}
export interface Gus {
  root: THREE.Group;
  setPose(p: GusPose, w?: number): void;
  setExpression(e: GusExpr | ExprData, w?: number): void;
  update(frame: number, camera: THREE.Camera): void;
  setState(s: 0 | 1 | 2): void;
  lampAnchor: THREE.Object3D;
  setCameraTrack(fn: ((frame: number) => THREE.Camera) | null, refFrame?: number): void;
  debug: { view: string; theta: number; lean: Lean; soles: THREE.Vector3[]; mirrored: boolean };
  figures: Figure[];
}

const LOOKS: Look[] = ["blueprint", "xray", "solid"];
const THR = [22.5 * deg, 67.5 * deg];
const HYST = 3 * deg;
type VKey = "front" | "threeQuarter+" | "threeQuarter-" | "profile+" | "profile-";
/** Replacement view for an angle, with hysteresis around the thresholds (keeps the current view inside the band). */
function viewKey(theta: number, prev: VKey | null): VKey {
  const a = Math.abs(theta), sg = theta < 0 ? "-" : "+";
  const raw = (b0: number, b1: number): VKey => (a < b0 ? "front" : a < b1 ? (`threeQuarter${sg}` as VKey) : (`profile${sg}` as VKey));
  if (!prev) return raw(THR[0], THR[1]);
  const pv = prev.replace(/[+-]/, "");
  const b0 = pv === "front" ? THR[0] + HYST : THR[0] - HYST;
  const b1 = pv === "profile" ? THR[1] - HYST : THR[1] + HYST;
  const k = raw(b0, b1);
  return k;
}

class GusImpl implements Gus {
  root = new THREE.Group();
  lampAnchor = new THREE.Object3D();
  figures: Figure[] = [];
  sets: Partial<Record<"front" | "threeQuarter" | "profile" | "vfold", Figure>> = {};
  pose: PoseData = { ...POSES.idle };
  expr: ExprData = { ...EXPRS.neutral };
  state: 0 | 1 | 2 = 2;
  gyro: GyroOpts | null;
  track: ((f: number) => THREE.Camera) | null = null;
  refFrame = 0;
  hist = new Map<number, CamSample>();
  lastFrame = -999;
  lastKey: VKey | null = null;
  debug = { view: "front", theta: 0, lean: { yaw: 0, pitch: 0, roll: 0 }, soles: [] as THREE.Vector3[], mirrored: false };
  o: GusOpts;
  v: Variant;
  private inv = new THREE.Matrix4();

  constructor(o: GusOpts) {
    this.o = o;
    this.v = VARIANTS[o.variant ?? "A"];
    this.gyro = o.gyro === false ? null : { ...GYRO_DEFAULT, ...(o.gyro ?? {}) };
    const add = (k: keyof GusImpl["sets"], f: Figure) => { this.sets[k] = f; this.figures.push(f); this.root.add(f.root); f.root.visible = false; };
    if ((o.method ?? "replacement") === "vfold") add("vfold", new Figure({ view: "front", fold: o.fold ?? 22 * deg, variant: this.v }));
    else {
      const view = o.view ?? "auto";
      for (const k of ["front", "threeQuarter", "profile"] as const) if (view === "auto" || view === k) add(k, new Figure({ view: k, variant: this.v }));
    }
    this.root.add(this.lampAnchor);
    this.setState(2);
  }
  setPose(p: GusPose, w = 1) {
    const base = typeof p === "string" ? POSES[p] : { ...POSES.idle, ...p };
    this.pose = w >= 1 ? { ...base } : mixPose(POSES.idle, base, w);
  }
  setExpression(e: GusExpr | ExprData, w = 1) {
    const t = typeof e === "string" ? EXPRS[e] : e;
    this.expr = w >= 1 ? { ...t } : mixExpr(EXPRS.neutral, t, w);
  }
  setCameraTrack(fn: ((frame: number) => THREE.Camera) | null, refFrame = 0) { this.track = fn; this.refFrame = refFrame; }
  setState(s: 0 | 1 | 2) {
    this.state = s;
    for (const f of this.figures) {
      f.cards.forEach((c) => c.setLook(LOOKS[s]));
      f.pins.forEach((pg) => pg.traverse((m) => {
        if (!(m instanceof THREE.Mesh)) return;
        m.userData.mat ??= m.material;
        m.material = s === 0 ? PIN_MATS.pinBP : (m.userData.mat as THREE.Material);
      }));
      f.root.traverse((m) => { if (m.userData.ao) m.visible = s === 2; });
    }
  }

  private sample(cam: THREE.Camera): CamSample {
    cam.updateMatrixWorld();
    const p = new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld).applyMatrix4(this.inv);
    const d = new THREE.Vector3(); cam.getWorldDirection(d); d.transformDirection(this.inv);
    return camSample([p.x, p.y, p.z], [d.x, d.y, d.z], 1.2);
  }
  private cache = new Map<number, CamSample>();
  private trackSample(f: number) {
    f = Math.max(this.refFrame, f);
    let c = this.cache.get(f);
    if (!c) { c = this.sample(this.track!(f)); this.cache.set(f, c); }
    return c;
  }
  private trackLean(frame: number): Lean {
    if (!this.gyro) return { yaw: 0, pitch: 0, roll: 0 };
    return leanFromTrack((k) => this.trackSample(frame - k), this.trackSample(this.refFrame), this.gyro);
  }
  /** Deterministic replacement-view timeline from the camera track: hysteresis + a 4-frame paper flip (0.7, 0.3 | 0.3, 0.7). */
  private trackView(frame: number): { key: VKey; squash: number } {
    const start = Math.max(this.refFrame, frame - 90);
    const keys = new Map<number, VKey>();
    let prev: VKey | null = null;
    for (let f = start; f <= frame + 2; f++) {
      const th = wrap(this.trackSample(f).az - this.trackLean(f).yaw);
      prev = viewKey(th, prev); keys.set(f, prev);
    }
    const k0 = keys.get(frame)!;
    let squash = 1;
    if (keys.get(frame + 1) !== k0) squash = 0.3; else if (keys.get(frame + 2) !== k0) squash = 0.7;
    const kp = keys.get(frame - 1), kpp = keys.get(frame - 2);
    if (kp !== undefined && kp !== k0) squash = Math.min(squash, 0.3); else if (kpp !== undefined && kpp !== k0) squash = Math.min(squash, 0.7);
    return { key: k0, squash };
  }
  private lean(frame: number, camera: THREE.Camera): Lean {
    if (this.track) return this.trackLean(frame);
    if (!this.gyro) return { yaw: 0, pitch: 0, roll: 0 };
    const cur = this.sample(camera);
    if (frame !== this.lastFrame + 1 && frame !== this.lastFrame) { this.hist.clear(); this.refFrame = frame; }
    this.hist.set(frame, cur); this.lastFrame = frame;
    const at = (k: number) => this.hist.get(Math.max(this.refFrame, frame - k)) ?? cur;
    return leanFromTrack(at, this.hist.get(this.refFrame)!, this.gyro);
  }

  update(frame: number, camera: THREE.Camera) {
    this.root.updateWorldMatrix(true, false);
    this.inv.copy(this.root.matrixWorld).invert();
    this.cache.clear();
    const gf = this.o.onTwos ? Math.floor(frame / 2) * 2 : frame;
    const lean = this.lean(gf, camera);
    const cs = this.sample(camera);
    // which way the camera looks at the upper body
    const theta = wrap(cs.az - lean.yaw);
    let fig: Figure, rotY = 0, mirror = false, squash = 1, view = "vfold";
    if (this.sets.vfold) { fig = this.sets.vfold; }
    else {
      const avail = (["front", "threeQuarter", "profile"] as const).filter((k) => this.sets[k]);
      let key: VKey;
      if (this.track && avail.length > 1) { const tv = this.trackView(gf); key = tv.key; if (this.o.flip !== 0) squash = tv.squash; }
      else { key = viewKey(theta, frame === this.lastFrame + 1 || frame === this.lastFrame ? this.lastKey : null); }
      this.lastKey = key;
      let k = key.replace(/[+-]/, "") as "front" | "threeQuarter" | "profile";
      if (!this.sets[k]) k = avail[0];
      view = k; fig = this.sets[k]!;
      const ang = k === "front" ? 0 : k === "threeQuarter" ? 45 * deg : 90 * deg;
      mirror = key.endsWith("-") && k !== "front";
      rotY = mirror ? -ang : ang;
    }
    for (const f of this.figures) f.root.visible = f === fig;
    fig.root.rotation.y = rotY;
    fig.root.scale.x = (mirror ? -1 : 1) * squash;
    this.applyPose(fig, this.pose, lean, rotY, mirror);
    this.applyExpr(fig, this.blinked(this.expr, gf));
    // lamp anchor follows the visible drawing's headlamp
    fig.root.updateMatrixWorld(true);
    const m = new THREE.Matrix4().copy(this.inv).multiply(fig.lamp.matrixWorld);
    m.decompose(this.lampAnchor.position, this.lampAnchor.quaternion, new THREE.Vector3());
    this.lastFrame = frame;
    this.debug = { view, theta, lean, soles: fig.soles.map((s) => new THREE.Vector3().setFromMatrixPosition(s.matrixWorld)), mirrored: mirror };
  }

  private blinked(e: ExprData, f: number): ExprData {
    if (this.o.autoBlink === false) return e;
    // seeded schedule: a blink every 70-130 frames, 5-frame cut-out lid slide
    let start = 17, i = 0;
    while (start + 5 < f) { i++; start += 70 + ((i * 7919) % 61); }
    const k = f - start;
    const curve = [0.55, 1, 1, 0.7, 0.35];
    if (k < 0 || k >= curve.length) return e;
    return { ...e, lid: Math.max(e.lid, curve[k] * 1.0 + (1 - curve[k]) * e.lid) };
  }

  private applyPose(fig: Figure, P: PoseData, lean: Lean, rotY: number, mirror: boolean) {
    const v = fig.v, view = fig.view, fold = fig.fold;
    const prof = view === "profile", tq = view === "threeQuarter";
    const c = Math.SQRT1_2;
    // body-frame gyro lean -> this drawing's local frame (conjugate by the drawing's yaw and mirror)
    const qb = new THREE.Quaternion().setFromEuler(new THREE.Euler(lean.pitch, lean.yaw, lean.roll, "YXZ"));
    const qs = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
    const ql = qs.clone().invert().multiply(qb).multiply(qs);
    if (mirror) { ql.y = -ql.y; ql.z = -ql.z; }
    // pelvis: shift toward the stance; roll of the gyro shifts the hips against it (weight over the feet)
    const side = P.px - lean.roll * 0.18;
    const px = prof ? -P.pz : tq ? c * side - c * P.pz : side;
    fig.pelvis.position.set(px, v.hipY + P.py, 0);
    fig.pelvis.rotation.set(0, 0, prof ? 0 : tq ? P.sway * c : P.sway);
    // torso
    const tz = prof ? P.pitch : tq ? c * (P.lean + P.pitch) : P.lean;
    const tx = prof ? P.lean * 0.6 : tq ? 0.5 * P.pitch : P.pitch;
    const qp = new THREE.Quaternion().setFromEuler(new THREE.Euler(tx, 0, tz));
    fig.torso.quaternion.copy(ql).multiply(qp);
    fig.torso.scale.y = 1 + 0.008 * P.breathe;
    fig.torso.position.y = 0.004 * P.breathe;
    // head
    fig.head.rotation.set(prof ? P.neck * 0.6 : tq ? 0.5 * P.nod : P.nod, 0, prof ? P.nod : tq ? c * (P.neck + P.nod) : P.neck);
    // arms
    for (const s of [1, -1]) {
      const L = s > 0;
      const abd = L ? P.shAL : P.shAR, flex = L ? P.shFL : P.shFR, el = L ? P.elL : P.elR, wr = L ? P.wrL : P.wrR;
      const curl = L ? P.curlL : P.curlR, th = L ? P.thumbL : P.thumbR;
      let sz: number, ez: number, wz: number;
      if (prof) { sz = -flex - 0.25 * abd; ez = -el; wz = -wr; }
      else if (tq) { sz = s > 0 ? c * abd - c * flex : -c * abd - c * flex; ez = -el; wz = -wr; }
      else {
        // front drawing: a forward raise reads as a partial lift; the forearm flexes up to the face or in to the belly
        const up = L ? P.hUpL : P.hUpR;
        sz = s * (abd + 0.3 * flex); ez = s * el * (1 - 0.35 * Math.min(1, flex)) * (2 * up - 1); wz = -s * wr;
      }
      fig.j["sh" + s].rotation.z = sz; fig.j["el" + s].rotation.z = ez; fig.j["wr" + s].rotation.z = wz;
      const h = fig.hands[s];
      const fist = curl > 0.8;
      h.straight.visible = !fist; h.fist.visible = fist;
      h.fingers.rotation.z = h.din * (fist ? 0.2 : curl * 1.05);
      h.thumb.rotation.z = -h.din * th * 0.6;
    }
    // legs: planar 2-bone IK to locked feet
    const sway = fig.pelvis.rotation.z;
    for (const s of [1, -1]) {
      const hip = fig.j["hip" + s], knee = fig.j["knee" + s], ankle = fig.j["ankle" + s];
      const fx = s > 0 ? P.footLx : P.footRx, fz = s > 0 ? P.footLz : P.footRz;
      const restX = hip.position.x + (prof || tq ? 0 : s * (v.stance - v.legX) * Math.cos(fold));
      const ax = restX + (prof ? -fz : tq ? c * fx - c * fz : fx);
      const ay = v.ankleH;
      const cs2 = Math.cos(sway), sn = Math.sin(sway);
      const Hx = fig.pelvis.position.x + hip.position.x * cs2, Hy = fig.pelvis.position.y + hip.position.x * sn;
      const dx = ax - Hx, dy = ay - Hy, d = Math.hypot(dx, dy);
      const L1 = v.thigh, L2 = v.shin;
      const base = Math.atan2(dy, dx);
      const dd = Math.min(d, L1 + L2 - 1e-5); void dd;
      const alpha = Math.acos(clamp((L1 * L1 + dd * dd - L2 * L2) / (2 * L1 * dd), -1, 1));
      if (prof || tq) {
        // side drawings: real knee bend, knees forward (-x)
        const tA = base - alpha;
        const Kx = Hx + L1 * Math.cos(tA), Ky = Hy + L1 * Math.sin(tA);
        const sA = Math.atan2(ay - Ky, ax - Kx);
        hip.rotation.z = tA + Math.PI / 2 - sway; hip.scale.y = 1;
        knee.rotation.z = sA - tA; ankle.scale.y = 1;
      } else {
        // front drawing: the knee bends toward the lens, so the leg foreshortens instead of bowing sideways.
        // Straight hip->ankle, length scaled to reach the planted foot exactly (feet never float or slide).
        const k = d / (L1 + L2);
        hip.rotation.z = base + Math.PI / 2 - sway; hip.scale.y = k;
        knee.rotation.z = 0; ankle.scale.y = 1 / k;
      }
      ankle.rotation.z = -(sway + hip.rotation.z + knee.rotation.z);
    }
    fig.hammer.rotation.z = P.tool - 0.6 * (fig.torso.rotation.z) + 0.4 * P.px;
  }

  private applyExpr(fig: Figure, E: ExprData) {
    const prof = fig.view === "profile";
    for (const e of fig.eyes) {
      e.lidU.position.y = -E.lid * e.h * 1.12;
      e.lidL.position.y = E.lidL * e.h * 0.62;
      e.ball.position.set(E.gx * (prof ? 0.004 : 0.0085), E.gy * 0.0045, 0);
      e.pupil.scale.set(E.pupil, E.pupil, 1);
    }
    for (const b of fig.brows) {
      const lift = prof ? (E.browL + E.browR) / 2 : b.s > 0 ? E.browL : E.browR;
      b.g.position.y = b.y0 + lift;
      b.g.rotation.z = prof ? -E.browIn : -b.s * E.browIn;
    }
    const seen = new Set<THREE.Object3D>();
    for (const id of MOUTHS) { const m = fig.mouths[id]; if (m && !seen.has(m)) { m.visible = false; seen.add(m); } }
    const mm = fig.mouths[E.mouth]; if (mm) mm.visible = true;
    const halves = fig.stache.userData.halves as THREE.Object3D[] | undefined;
    if (halves) halves.forEach((h) => (h.position.y = E.stache)); else fig.stache.position.y = E.stache;
    fig.smileLines.forEach((s) => (s.visible = E.cheek > 0.5));
  }
}

export function buildGus(opts: GusOpts = {}): Gus { return new GusImpl(opts); }
export { VARIANTS, POSES, EXPRS };
