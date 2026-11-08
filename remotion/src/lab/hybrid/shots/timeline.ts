// [hybrid/shots] HyTest timeline: every value is a pure function of the output frame f (30 fps, 300 frames).
// Two clocks:
//   f = screen time (camera, overlays, meter, shakes)      S = story time (set, mechanism, Rafa)
// S == f until the freeze; then 0.5 s freeze, 6 f rewind, slow-mo replay of the bite, ramp back to 1x.
import * as THREE from "three";
import { POSES, EXPR, EASE, mixPose, mirrorPose, mixFace, keyed, breathe, drift, tremble } from "../cast/api";
import type { Pose, FaceParams, Key } from "../cast/api";

export const FPS = 30, N = 300;
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
export const smooth = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = THREE.MathUtils.lerp;

// ------------------------------------------------------------------------------------------- beat sheet (frames)
export const T = {
  BP_END: 44,            // pure BLUEPRINT plate 0-44 (callouts draw on 3-30, fade 34-46)
  SWEEP_BP: [44, 74],    // print sweep BLUEPRINT -> SOLID, rising from the car bottom to above the ropes
  CREAK: 86,             // Rafa hears the rope above, looks up
  SNAP: 104,             // ropes part (story)
  LURCH: 110,            // car lurches (story)
  XRAY: [142, 164],      // sweep SOLID -> X-RAY, top down, while the camera starts down the rail
  TRAVEL: [128, 206],    // camera travel: Rafa medium -> gear insert
  FORCE: [150, 160, 184, 194], // red force arrow in / out
  SOLID: [190, 206],     // print sweep X-RAY -> SOLID up through the gear (before the bite)
  TRIP: 198,             // governor trips, wedges start to ride up (story)
  BITE: 210,             // clamp frame: jaws bite, meter crashes to green
  FREEZE: [212, 227],    // 0.5 s freeze (screen)
  REWIND: [227, 233],    // story rewinds 7 frames
  SLOW: [233, 250],      // slow-mo replay at 0.35x (replay bite on screen ~f247)
  RAMP: [250, 260],      // 0.35x -> 1x
  BACK: [220, 298],      // glide back to Rafa (eases in under the slow-mo replay)
} as const;

/** story time S(f) */
export function story(f: number): number {
  if (f <= T.FREEZE[0]) return f;
  if (f <= T.FREEZE[1]) return T.FREEZE[0];
  if (f <= T.REWIND[1]) return T.FREEZE[0] - 7 * glide((f - T.REWIND[0]) / (T.REWIND[1] - T.REWIND[0]));
  const s0 = T.FREEZE[0] - 7;                          // 205
  if (f <= T.SLOW[1]) return s0 + 0.35 * (f - T.SLOW[0]);
  const s1 = s0 + 0.35 * (T.SLOW[1] - T.SLOW[0]);       // 210.95
  const rr = (1 - 0.35) / (T.RAMP[1] - T.RAMP[0]);
  if (f <= T.RAMP[1]) { const d = f - T.RAMP[0]; return s1 + 0.35 * d + 0.5 * rr * d * d; }
  const s2 = s1 + 0.35 * 10 + 0.5 * rr * 100;           // ~217.7
  return s2 + (f - T.RAMP[1]);
}

// ------------------------------------------------------------------------------------------- set / mechanism (story)
const VMAX = 0.016; // m per story frame while falling (0.48 m/s: readable, keeps background flow under the speed cap)
function fallV(S: number) {
  if (S < T.LURCH + 8) return 0;
  const v = VMAX * glide((S - T.LURCH - 8) / 30);
  if (S < T.BITE) return v;
  const vb = VMAX * glide((T.BITE - T.LURCH - 8) / 30);
  return vb * (1 - glide((S - T.BITE) / 6));
}
/** car y offset (world m) */
export function carY(S: number): number {
  let y = 0;
  if (S >= T.SNAP && S < T.LURCH + 6) y += 0.012 * Math.sin((S - T.SNAP) * 1.3) * Math.exp(-(S - T.SNAP) / 4); // rope-release jolt
  if (S >= T.LURCH) {
    const u = (S - T.LURCH) / 6;
    y += -0.1 * EASE.out(u) + 0.014 * Math.sin((S - T.LURCH) * 1.1) * Math.exp(-(S - T.LURCH) / 4) * smooth(0, 2, S - T.LURCH);
    // integrate the fall (4 substeps / frame, deterministic)
    const s0 = T.LURCH + 8; let acc = 0;
    for (let s = s0; s < S; s += 0.25) acc += fallV(s + 0.125) * Math.min(0.25, S - s);
    y -= acc;
    if (S >= T.BITE) y += 0.008 * Math.sin((S - T.BITE) * 0.9) * Math.exp(-(S - T.BITE) / 5); // stop rebound
  }
  return y;
}
export const clampAt = (S: number) => (S < T.TRIP ? 0 : S >= T.BITE ? 1 : Math.pow((S - T.TRIP) / (T.BITE - T.TRIP), 2));
export const glowAt = (S: number) => (S < T.BITE ? 0.1 * smooth(0.6, 1, clampAt(S)) : 0.45 + 0.45 * Math.exp(-(S - T.BITE) / 6));
export const sparksAt = (S: number) => (S >= T.BITE - 1 ? (S - T.BITE + 1) / FPS : -1);
export const flashAt = (S: number) => (S >= T.BITE ? 0.55 * Math.exp(-(S - T.BITE) / 3.5) : 0);
export const snapAt = (S: number) => (S >= T.SNAP ? (S - T.SNAP + 0.5) / FPS : 0);
export function alarmAt(S: number) {
  if (S < T.SNAP + 2) return 0;
  const p = 0.55 + 0.45 * Math.max(0, Math.sin((S - T.SNAP - 2) * 0.6));
  return S < T.BITE + 4 ? p : p * (1 - smooth(T.BITE + 4, T.BITE + 34, S));
}
export const forceAt = (f: number) => smooth(T.FORCE[0], T.FORCE[1], f) * (1 - smooth(T.FORCE[2], T.FORCE[3], f));

// ------------------------------------------------------------------------------------------- look state (screen)
export type StateAt = { shaft: 0 | 1 | 2; sweep?: { from: 0 | 1 | 2; to: 0 | 1 | 2; offset: number; dir: 1 | -1; p: number } };
export function stateAt(f: number, cy: number): StateAt {
  if (f < T.SWEEP_BP[0]) return { shaft: 0 };
  if (f < T.SWEEP_BP[1]) {
    const p = glide((f - T.SWEEP_BP[0]) / (T.SWEEP_BP[1] - T.SWEEP_BP[0]));
    return { shaft: 2, sweep: { from: 0, to: 2, offset: lerp(-2.8, 4.2, p), dir: 1, p } };
  }
  if (f < T.XRAY[0]) return { shaft: 2 };
  if (f < T.XRAY[1]) {
    const p = glide((f - T.XRAY[0]) / (T.XRAY[1] - T.XRAY[0]));
    const yTop = 3.4 + cy, yBot = -1.6 + cy;           // X-RAY grows downward from above the ropes
    return { shaft: p < 0.45 ? 2 : 1, sweep: { from: 2, to: 1, offset: -lerp(yTop, yBot, p), dir: -1, p } };
  }
  if (f < T.SOLID[0]) return { shaft: 1 };
  if (f < T.SOLID[1]) {
    const p = glide((f - T.SOLID[0]) / (T.SOLID[1] - T.SOLID[0]));
    return { shaft: p < 0.5 ? 1 : 2, sweep: { from: 1, to: 2, offset: lerp(-1.0, 0.5, p) + cy, dir: 1, p } };
  }
  return { shaft: 2 };
}

// ------------------------------------------------------------------------------------------- danger meter (screen)
/** 0..1, rises green -> red with the threat, crashes to green on the clamp frame */
export function meterAt(f: number): number {
  if (f >= T.BITE) {
    const d = f - T.BITE;
    // the crash IS the clamp frame: green from f = BITE on, a small decaying bounce at the bottom
    return 0.07 + 0.04 * Math.exp(-d / 6) * Math.sin(d * 0.9 + 0.6);
  }
  let m = 0.1 + 0.012 * Math.sin(f * 0.21);
  m += 0.08 * smooth(T.CREAK, T.CREAK + 10, f);
  m += 0.3 * EASE.backOut(clamp01((f - T.SNAP) / 8));
  m += 0.14 * EASE.out(clamp01((f - T.LURCH) / 6));
  m += 0.3 * glide((f - 138) / (T.BITE - 4 - 138));
  if (f > T.SNAP) m += 0.012 * Math.sin(f * 1.7) * smooth(T.SNAP, T.SNAP + 10, f);
  return clamp01(m);
}
/** blueprint callouts: draw-on 0..1 and opacity */
export const calloutAt = (f: number) => ({ draw: glide((f - 3) / 27), alpha: 1 - smooth(34, 46, f) });

// ------------------------------------------------------------------------------------------- camera (screen)
// Keys are in car space blended with `follow` (0 = world, 1 = rides the car). Channels are interpolated with a
// non-uniform Catmull-Rom (C1: velocity continuous through keys, so a move flows into the next creep, never stops dead).
export type CamKey = { f: number; pos: [number, number, number]; look: [number, number, number]; fov: number };
export const CAM: CamKey[] = [
  { f: 0, pos: [0.30, 3.30, 7.4], look: [0.10, 0.45, -0.8], fov: 40 },      // BLUEPRINT patent plate, high, pushing down the shaft
  { f: 74, pos: [0.22, 1.85, 5.3], look: [-0.10, 0.95, -0.6], fov: 40 },    // print sweep done: medium-wide, descending
  { f: 104, pos: [0.30, 1.24, 4.35], look: [-0.20, 1.30, -0.6], fov: 40 },  // low 3/4 from the right on Rafa, ropes above
  { f: 120, pos: [0.33, 1.13, 4.08], look: [-0.18, 1.24, -0.6], fov: 40 },  // creep through the snap + lurch, travel eases in
  { f: 176, pos: [0.98, 0.40, 2.95], look: [0.95, -0.30, -0.88], fov: 36 }, // crane down/right (X-RAY): roof edge-on, gear through the gap
  { f: 206, pos: [0.965, -0.27, 0.5], look: [0.98, -0.43, -0.9], fov: 34 },  // dolly in: side-on insert, jaws above the caption band
  { f: 220, pos: [0.967, -0.275, 0.445], look: [0.98, -0.43, -0.9], fov: 34 }, // slow push through bite + freeze
  { f: 256, pos: [0.86, 0.32, 2.25], look: [0.72, -0.08, -0.70], fov: 38 },  // pull back along the lens axis under the slow-mo replay
  { f: 298, pos: [0.36, 1.20, 3.55], look: [-0.10, 1.00, -0.5], fov: 42 },    // crane up/back: relieved Rafa, full figure
  { f: 300, pos: [0.357, 1.20, 3.49], look: [-0.10, 1.00, -0.5], fov: 42 },  // settle creep
];
/** monotone cubic (Fritsch-Carlson weighted harmonic tangents): C1, never overshoots a key, a channel that reverses
 *  direction stops at that key; a creep next to a fast move makes the move ease in/out by itself. */
function cr(keys: CamKey[], f: number, get: (k: CamKey) => number) {
  const n = keys.length;
  if (f <= keys[0].f) { const a = keys[0], b = keys[1]; return get(a) + (get(b) - get(a)) / (b.f - a.f) * (f - a.f); }
  if (f >= keys[n - 1].f) { const a = keys[n - 2], b = keys[n - 1]; return get(b) + (get(b) - get(a)) / (b.f - a.f) * (f - b.f); }
  let i = 0; while (i < n - 2 && f > keys[i + 1].f) i++;
  const sec = (j: number) => (get(keys[j + 1]) - get(keys[j])) / (keys[j + 1].f - keys[j].f);
  const tan = (j: number) => {
    if (j === 0) return sec(0);
    if (j === n - 1) return sec(n - 2);
    const d0 = sec(j - 1), d1 = sec(j); if (d0 * d1 <= 0) return 0;
    const h0 = keys[j].f - keys[j - 1].f, h1 = keys[j + 1].f - keys[j].f;
    return 3 * (h0 + h1) / ((2 * h1 + h0) / d0 + (h1 + 2 * h0) / d1);
  };
  const k0 = keys[i], k1 = keys[i + 1];
  const h = k1.f - k0.f, u = clamp01((f - k0.f) / h);
  const m0 = tan(i) * h, m1 = tan(i + 1) * h;
  const u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * get(k0) + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * get(k1) + (u3 - u2) * m1;
}
/** camera-follow weight: world until the lurch, then catches up with the car over 26 f */
export const followAt = (f: number) => glide((f - (T.LURCH + 1)) / 26);
/** decaying shake (damped sine, period ~5 f, gone within 12 f) */
function shake(f: number, at: number, amp: number) {
  const n = f - at; if (n < 0 || n > 14) return 0;
  return amp * Math.exp(-n / 3.6) * Math.sin(n * 1.25);
}
export type CamAt = { pos: THREE.Vector3; look: THREE.Vector3; fov: number; follow: number; roll: number };
export function camAt(f: number): CamAt {
  const g = (i: number, w: "pos" | "look") => cr(CAM, f, (k) => k[w][i]);
  const pos = new THREE.Vector3(g(0, "pos"), g(1, "pos"), g(2, "pos"));
  const look = new THREE.Vector3(g(0, "look"), g(1, "look"), g(2, "look"));
  const fov = cr(CAM, f, (k) => k.fov);
  // shakes: snap (small), lurch (main), bite (insert, short), replay bite (half)
  const s = shake(f, T.SNAP, 0.006) + shake(f, T.LURCH, 0.03) + shake(f, T.BITE, 0.006) + shake(f, 247, 0.0015);
  look.y += s; pos.y += s * 0.35;
  const roll = shake(f, T.LURCH + 1, 0.012);
  return { pos, look, fov, follow: followAt(f), roll };
}
/** DOF focus target in car space: Rafa's chest/head -> gear -> Rafa */
export function focusAt(f: number): { w: number } { return { w: smooth(140, 190, f) * (1 - smooth(245, 285, f)) }; }

// ------------------------------------------------------------------------------------------- Rafa (story)
const WORK: Pose = { ...POSES.idle, head: [0.3, 0.22, -0.04], neck: [0.12, 0.05, -0.03] };
const DIP: Pose = mixPose(POSES.lookUp, { ...POSES.lookUp, lift: -0.07, chest: [0.1, 0.04, 0.04], head: [0.05, 0.1, 0], clavL: [0, 0, -0.06], clavR: [0, 0, 0.06] }, 1);
const CROUCH: Pose = mixPose(POSES.alarm, { ...POSES.brace, reachL: undefined, reachR: undefined, reachW: 0, head: [-0.25, 0, 0] }, 0.55);
const JOLT: Pose = { ...CROUCH, lift: -0.3, chest: [0.12, 0, 0], head: [0.05, 0, 0] };
const RELIEF: Pose = mirrorPose(POSES.relief);              // left hand to the chest; the right stays on the rail
const SETTLE: Pose = mixPose(RELIEF, POSES.idle, 0.2);
const POSE_KEYS: Key<Pose>[] = [
  { f: 0, v: WORK }, { f: T.CREAK, v: WORK }, { f: T.CREAK + 12, v: POSES.lookUp, ease: "glide" },
  { f: T.SNAP + 1, v: POSES.lookUp }, { f: T.SNAP + 4, v: DIP, ease: "out" },
  { f: T.SNAP + 12, v: POSES.alarm, ease: "backOut" },
  { f: T.LURCH + 12, v: CROUCH, ease: "backOut" },
  { f: T.BITE, v: CROUCH }, { f: T.BITE + 4, v: JOLT, ease: "out" }, { f: T.BITE + 12, v: CROUCH, ease: "glide" },
  { f: 240, v: RELIEF, ease: "glide" }, { f: 262, v: SETTLE, ease: "glide" },
];
const FACE_KEYS: Key<FaceParams>[] = [
  { f: 0, v: EXPR.focused }, { f: T.CREAK + 2, v: EXPR.focused }, { f: T.CREAK + 10, v: EXPR.curious, ease: "glide" },
  { f: T.SNAP + 1, v: EXPR.curious }, { f: T.SNAP + 4, v: EXPR.alarmed, ease: "out" }, { f: T.SNAP + 10, v: EXPR.terrified, ease: "backOut" },
  { f: T.BITE, v: EXPR.terrified }, { f: T.BITE + 4, v: EXPR.wincing, ease: "out" }, { f: 226, v: EXPR.alarmed, ease: "glide" },
  { f: 236, v: EXPR.relieved, ease: "glide" }, { f: 258, v: mixFace(EXPR.relieved, EXPR.smiling, 0.55), ease: "glide" },
];
const BLINKS = [40, 160, 229];
export type RafaAt = { pose: Pose; face: FaceParams; blink: number; gaze: [number, number]; lampAim: number };
export function rafaAt(S: number): RafaAt {
  const t = S / FPS;
  let p = keyed(POSE_KEYS, S, mixPose);
  const scared = S >= T.SNAP && S < 232;
  p = breathe(p, t, S > 226 ? 1.8 : 1, scared ? 2.4 : 1);
  p = drift(p, t, S < T.SNAP ? 1 : S > 236 ? 0.6 : 0.15);
  p = tremble(p, Math.round(S), S >= T.LURCH + 4 && S < T.LURCH + 40 ? 0.9 * Math.exp(-(S - T.LURCH - 4) / 9) : 0);
  const face = keyed(FACE_KEYS, S, mixFace);
  let blink = 0;
  for (const b of BLINKS) { const d = S - b; if (d >= 0 && d < 4) blink = Math.max(blink, [0.5, 1, 0.7, 0.15][Math.floor(d)]); }
  const gaze: [number, number] = S < T.CREAK + 4 ? [0.1, -0.45] : S < T.BITE + 2 ? [0.0, 0.5] : S < 232 ? [0.05, 0.0] : [0.0, 0.2];
  return { pose: p, face, blink, gaze, lampAim: 0 };
}
