// Frame -> scene description for every TOY composition (hero, faces, states, motion).
import * as THREE from "three";
import { Pose, Expr, EXPR, POSES, blendPose } from "./figure";
import { LookState } from "./states";
import { clamp01, smoother, lerp } from "./palette";

export const FPS = 30;
type V3 = [number, number, number];

export type Spec = {
  look: LookState;
  cam: { pos: V3; look: V3; fov: number; roll?: number };
  camRel?: "face"; // camera given relative to the head (pos/look are offsets)
  focus: "head" | "gear" | V3;
  lensK: number; tilt: number;
  pose: Pose; expr: Expr; blink: number; figYaw: number;
  carY: number; ropeUp: number; ropeSway: number; snapped: boolean;
  jaw: number; jawGlow: number; lever: number;
  alarm: number; flash: number; shake: V3;
  sparks: { at: "hitch" | "jaw"; t: number }[];
  labels: boolean; arrows: boolean; cone: number;
  seed: number;
};

const base = (): Spec => ({
  look: "solid",
  cam: { pos: [-1.35, 2.3, 7.0], look: [-0.42, 1.05, -0.3], fov: 33 },
  focus: "head", lensK: 26, tilt: 5,
  pose: POSES.work, expr: EXPR.calm, blink: 0, figYaw: -0.3,
  carY: 0, ropeUp: 0, ropeSway: 0, snapped: false,
  jaw: 0, jawGlow: 0.25, lever: 0,
  alarm: 0.15, flash: 0, shake: [0, 0, 0],
  sparks: [], labels: false, arrows: false, cone: 1, seed: 0,
});

export function heroSpec(): Spec { return base(); }

export function stateSpec(i: number): Spec {
  const s = base();
  s.look = (["blueprint", "xray", "solid"] as LookState[])[i] ?? "solid";
  if (s.look === "blueprint") { s.labels = true; s.lensK = 10; s.tilt = 2; s.cone = 0; }
  if (s.look === "xray") { s.arrows = true; s.alarm = 0.8; s.expr = EXPR.alarm; s.pose = blendPose(POSES.work, POSES.alarm, 0.6); s.lensK = 14; s.tilt = 3; }
  return s;
}

export function faceSpec(i: number): Spec {
  const s = base();
  const k = (["calm", "alarm", "relief"] as const)[i] ?? "calm";
  s.camRel = "face";
  s.cam = { pos: [0.6, 0.12, 1.75], look: [0.0, -0.02, 0], fov: 26 };
  s.figYaw = 0.25;
  s.expr = EXPR[k];
  s.pose = k === "calm" ? POSES.face : k === "alarm" ? POSES.faceAlarm : POSES.faceRelief;
  s.lensK = 34; s.tilt = 0;
  s.alarm = k === "alarm" ? 1.0 : 0.05;
  s.jawGlow = k === "relief" ? 2.2 : 0.25;
  s.cone = 0.6;
  return s;
}

// ---------------------------------------------------------------- motion test: 90 frames
const F_SNAP = 30, F_TRIP = 52, F_CLAMP = 62, G = 7.0;
const fallY = (f: number) => {
  if (f < F_SNAP) return f > 22 ? 0.004 * Math.sin(f * 2.7) * (f - 22) / 8 : 0;
  const tc = (F_CLAMP - F_SNAP) / FPS;
  const t = (Math.min(f, F_CLAMP) - F_SNAP) / FPS;
  let y = -0.5 * G * t * t;
  if (f > F_CLAMP) {
    const v = G * tc, dt = (f - F_CLAMP) / FPS, tau = 0.035;
    y = -0.5 * G * tc * tc - v * tau * (1 - Math.exp(-dt / tau)) + 0.03 * Math.exp(-dt / 0.14) * Math.sin(2 * Math.PI * dt / 0.2);
  }
  return y;
};
const easeOutBack = (t: number) => { const c1 = 1.70158, c3 = c1 + 1; t = clamp01(t); return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const decay = (f: number, f0: number, len: number) => (f < f0 ? 0 : Math.exp(-(f - f0) / len));

export function motionSpec(f: number): Spec {
  const s = base();
  s.seed = f;
  // camera: slow eased push-in from establishing to the figure + gear, following the car with lag
  const k = smoother(f / 89);
  let lag = 0; for (let i = 0; i <= f; i++) lag += (fallY(i) - lag) * 0.55;
  const p0: V3 = [-1.35, 2.3, 7.0], p1: V3 = [-1.25, 1.3, 4.6];
  const l0: V3 = [-0.42, 1.05, -0.3], l1: V3 = [-0.72, 0.62, -0.1];
  s.cam = {
    pos: [lerp(p0[0], p1[0], k), lerp(p0[1], p1[1], k) + lag, lerp(p0[2], p1[2], k)],
    look: [lerp(l0[0], l1[0], k), lerp(l0[1], l1[1], k) + lag, lerp(l0[2], l1[2], k)],
    fov: lerp(33, 32, k),
  };
  s.carY = fallY(f);
  // ropes: after the snap the free ends are yanked upward by the falling counterweight
  if (f >= F_SNAP) {
    const t = (f - F_SNAP) / FPS;
    s.snapped = true;
    s.ropeUp = 0.5 * 11 * t * t + 0.4 * t;
    s.ropeSway = 0.05 * Math.sin(t * 19) * Math.exp(-t * 2.2);
  }
  // governor trips, lever lifts the wedges, jaws bite the rail
  s.lever = smoother((f - F_TRIP) / 5) * 0.55;
  s.jaw = f >= F_CLAMP ? 1 : Math.pow(clamp01((f - (F_TRIP + 3)) / (F_CLAMP - F_TRIP - 3)), 2);
  s.jawGlow = 0.25 + (f >= F_CLAMP ? 2.0 + 5.5 * decay(f, F_CLAMP, 4) : 0);
  s.flash = f >= F_CLAMP ? [0.42, 0.22, 0.1, 0.04][f - F_CLAMP] ?? 0 : 0;
  // alarm beacon pulses from the reaction until just after the clamp
  const on = clamp01((f - 32) / 2) * (1 - clamp01((f - F_CLAMP - 4) / 8));
  s.alarm = 0.12 + on * (0.55 + 0.45 * Math.sin(f * 0.95));
  // camera shake: small at the snap, bigger at the clamp, decaying
  const sh = 0.012 * decay(f, F_SNAP, 4) + 0.03 * decay(f, F_CLAMP, 5);
  s.shake = [sh * Math.sin(f * 2.1), sh * Math.sin(f * 2.9 + 1), 0];
  // acting
  const breath = 0.015 * Math.sin(f * 0.21);
  let pose = blendPose(POSES.work, { ...POSES.work, spine: [-0.02 + breath, 0.18, 0.03], head: [-0.38 - breath, 0.28, 0.08] }, 1);
  if (f >= F_SNAP + 1) pose = blendPose(pose, POSES.alarm, easeOutBack((f - F_SNAP - 1) / 6));
  if (f >= 40) pose = blendPose(pose, POSES.brace, smoother((f - 40) / 10));
  if (f >= F_CLAMP) pose = { ...pose, lift: (pose.lift ?? 0) - 0.04 * Math.sin(Math.PI * clamp01((f - F_CLAMP) / 6)) };
  if (f >= 74) pose = blendPose(pose, POSES.relief, 0.85 * smoother((f - 74) / 12));
  s.pose = pose;
  s.expr = f < F_SNAP + 1 ? EXPR.calm : f < 76 ? EXPR.alarm : EXPR.relief;
  if (f >= F_SNAP + 1 && f < F_SNAP + 4) s.expr = { ...EXPR.alarm, lidU: lerp(EXPR.calm.lidU, EXPR.alarm.lidU, (f - F_SNAP) / 3) };
  if (f >= 76 && f < 82) {
    const t = smoother((f - 76) / 6);
    s.expr = { ...EXPR.relief, lidU: lerp(EXPR.alarm.lidU, EXPR.relief.lidU, t), lidL: lerp(EXPR.alarm.lidL, EXPR.relief.lidL, t), browY: lerp(EXPR.alarm.browY, EXPR.relief.browY, t), browTilt: lerp(EXPR.alarm.browTilt, EXPR.relief.browTilt, t), mouth: t < 0.5 ? "alarm" : "relief" };
  }
  s.blink = [12, 13, 14, 15].includes(f) ? [0.5, 1, 1, 0.5][f - 12] : [F_CLAMP, F_CLAMP + 1, F_CLAMP + 2].includes(f) ? [0.7, 1, 0.5][f - F_CLAMP] : 0;
  s.sparks = [];
  if (f >= F_SNAP && f < F_SNAP + 14) s.sparks.push({ at: "hitch", t: (f - F_SNAP) / FPS });
  if (f >= F_CLAMP - 2 && f < F_CLAMP + 22) s.sparks.push({ at: "jaw", t: (f - F_CLAMP + 2) / FPS });
  s.lensK = 26; s.tilt = 5;
  return s;
}

export const SPEC = {
  hero: () => heroSpec(),
  faces: (f: number) => faceSpec(f),
  states: (f: number) => stateSpec(f),
  motion: (f: number) => motionSpec(f),
};

export const vec = (v: V3) => new THREE.Vector3(...v);
