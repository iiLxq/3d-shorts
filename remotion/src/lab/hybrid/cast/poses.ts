// [hybrid/cast] Pose data + the cast's MOTION LANGUAGE as reusable clips.
// Conventions (character faces +z, L = character's left = +x):
//   x rot: + bends forward (spine/chest/neck/head), head - = looks up; arm x - = swings forward; elbow x - = bends.
//   y rot: + turns toward the character's left.   z rot: shoulderL + = arm out, shoulderR - = arm out; clavL + / clavR - = shrug.
// Legs are solved by IK to planted feet unless `plant: false`, so poses only move the pelvis (lift/sway/shift) and the
// knees bend by themselves: feet never slide or float.
import * as THREE from "three";

export type JointName =
  | "hips" | "spine" | "chest" | "neck" | "head"
  | "clavL" | "shoulderL" | "elbowL" | "wristL" | "clavR" | "shoulderR" | "elbowR" | "wristR"
  | "hipL" | "kneeL" | "ankleL" | "hipR" | "kneeR" | "ankleR";
export const JOINTS: JointName[] = [
  "hips", "spine", "chest", "neck", "head", "clavL", "shoulderL", "elbowL", "wristL", "clavR", "shoulderR", "elbowR", "wristR",
  "hipL", "kneeL", "ankleL", "hipR", "kneeR", "ankleR",
];
export type Rot = [number, number, number];
/** finger curls [thumb, index, middle, ring, pinky] (rad, + = toward the palm) + spread (0..1) */
export type HandCurl = { c: [number, number, number, number, number]; spread: number };
export type HandShape = "relax" | "grip" | "fist" | "splay" | "point" | "flat" | "claw";
export const HANDS: Record<HandShape, HandCurl> = {
  relax: { c: [0.25, 0.32, 0.45, 0.55, 0.68], spread: 0.15 },
  grip: { c: [0.85, 1.35, 1.45, 1.5, 1.5], spread: 0.0 },
  fist: { c: [1.05, 1.75, 1.8, 1.8, 1.75], spread: 0.0 },
  splay: { c: [-0.15, -0.08, -0.05, 0.0, 0.06], spread: 1.0 },
  point: { c: [0.85, 0.0, 1.55, 1.6, 1.55], spread: 0.1 },
  flat: { c: [0.05, 0.04, 0.05, 0.08, 0.1], spread: 0.08 },
  claw: { c: [0.35, 0.65, 0.7, 0.75, 0.8], spread: 0.7 },
};

export type Pose = Partial<Record<JointName, Rot>> & {
  lift?: number; sway?: number; shift?: number; // pelvis offset (m): down(-)/up, toward +x, toward +z
  plant?: boolean;                               // default true: legs by IK to the stance
  stance?: number;                               // stance width scale (1 = hip width)
  footL?: [number, number, number]; footR?: [number, number, number]; // per-foot [dx, dz, yaw] offsets (m, rad)
  heelL?: number; heelR?: number;                // heel lift (m), toe stays down
  handL?: HandShape | HandCurl; handR?: HandShape | HandCurl;
  reachL?: [number, number, number]; reachR?: [number, number, number]; // optional palm IK target, root space (m)
  reachW?: number;                               // weight of the reach targets (0..1)
};

const lerp = THREE.MathUtils.lerp;
const asCurl = (h: HandShape | HandCurl | undefined): HandCurl => (h === undefined ? HANDS.relax : typeof h === "string" ? HANDS[h] : h);
export function mixHand(a: HandShape | HandCurl | undefined, b: HandShape | HandCurl | undefined, t: number): HandCurl {
  const A = asCurl(a), B = asCurl(b);
  return { c: A.c.map((v, i) => lerp(v, B.c[i], t)) as HandCurl["c"], spread: lerp(A.spread, B.spread, t) };
}
const l3 = (a: number[] | undefined, b: number[] | undefined, t: number) => [0, 1, 2].map((i) => lerp(a?.[i] ?? 0, b?.[i] ?? 0, t)) as Rot;

/** blend two poses; t may leave 0..1 (overshoot / anticipation extrapolate the motion) */
export function mixPose(a: Pose, b: Pose, t: number): Pose {
  const o: Pose = {};
  for (const j of JOINTS) if (a[j] || b[j]) o[j] = l3(a[j], b[j], t);
  for (const k of ["lift", "sway", "shift", "heelL", "heelR"] as const) o[k] = lerp(a[k] ?? 0, b[k] ?? 0, t);
  o.stance = lerp(a.stance ?? 1, b.stance ?? 1, t);
  o.footL = l3(a.footL, b.footL, t); o.footR = l3(a.footR, b.footR, t);
  o.handL = mixHand(a.handL, b.handL, THREE.MathUtils.clamp(t, 0, 1));
  o.handR = mixHand(a.handR, b.handR, THREE.MathUtils.clamp(t, 0, 1));
  o.plant = (t < 0.5 ? a.plant : b.plant) ?? true;
  const wa = a.reachL || a.reachR ? (a.reachW ?? 1) : 0, wb = b.reachL || b.reachR ? (b.reachW ?? 1) : 0;
  if (a.reachL || b.reachL) o.reachL = l3(a.reachL ?? b.reachL, b.reachL ?? a.reachL, t);
  if (a.reachR || b.reachR) o.reachR = l3(a.reachR ?? b.reachR, b.reachR ?? a.reachR, t);
  o.reachW = lerp(wa, wb, THREE.MathUtils.clamp(t, 0, 1));
  return o;
}

/** mirror a pose left <-> right (weight shifts, alternate takes) */
export function mirrorPose(p: Pose): Pose {
  const o: Pose = { ...p };
  const sw = (r?: Rot): Rot | undefined => (r ? [r[0], -r[1], -r[2]] : undefined);
  for (const j of JOINTS) {
    const m = j.endsWith("L") ? j.slice(0, -1) + "R" : j.endsWith("R") ? j.slice(0, -1) + "L" : j;
    o[m as JointName] = sw(p[j]);
  }
  o.sway = -(p.sway ?? 0);
  o.footL = p.footR ? [-p.footR[0], p.footR[1], -p.footR[2]] : undefined; o.footR = p.footL ? [-p.footL[0], p.footL[1], -p.footL[2]] : undefined;
  o.heelL = p.heelR; o.heelR = p.heelL; o.handL = p.handR; o.handR = p.handL;
  o.reachL = p.reachR ? [-p.reachR[0], p.reachR[1], p.reachR[2]] : undefined; o.reachR = p.reachL ? [-p.reachL[0], p.reachL[1], p.reachL[2]] : undefined;
  return o;
}

// ------------------------------------------------------------------ the pose library (model-sheet scale: 1.8 m adult)
export const POSES = {
  /** model-sheet stance for turnarounds: relaxed A, never a T */
  stand: {
    lift: -0.012, stance: 1.05, footL: [0.0, 0.0, 0.08], footR: [0.0, 0.0, -0.08],
    chest: [0.02, 0, 0], head: [0.02, 0, 0],
    shoulderL: [0.04, 0, 0.2], shoulderR: [0.04, 0, -0.2], elbowL: [-0.2, 0, 0], elbowR: [-0.2, 0, 0],
    wristL: [0, 0, -0.08], wristR: [0, 0, 0.08], handL: "relax", handR: "relax",
  } as Pose,
  /** calm idle: weight on the right leg (contrapposto), relaxed arms, looking ahead-down at the work */
  idle: {
    lift: -0.02, sway: -0.03, stance: 1.15, footL: [0.03, 0.08, 0.2], footR: [0, -0.02, -0.12],
    hips: [0, -0.06, -0.05], spine: [0.04, 0.03, 0.03], chest: [0.03, 0.04, 0.04], neck: [0.06, 0, -0.03], head: [0.12, 0.1, -0.04],
    clavL: [0, 0, -0.03], clavR: [0, 0, 0.02],
    shoulderL: [-0.12, 0.1, 0.16], elbowL: [-0.55, 0.0, 0], wristL: [0.1, 0, -0.15],
    shoulderR: [0.1, -0.15, -0.2], elbowR: [-0.3, 0, 0], wristR: [0, 0, 0.12], handL: "relax", handR: "relax",
  } as Pose,
  /** look up at a sound above: weight back, chest opens, head tips back, one hand lifts */
  lookUp: {
    lift: -0.03, sway: -0.01, shift: -0.02, stance: 1.15, footL: [0.03, 0.08, 0.2], footR: [0, -0.02, -0.12],
    hips: [-0.04, -0.04, -0.02], spine: [-0.05, 0.02, 0.0], chest: [-0.12, 0.06, 0.0], neck: [-0.22, 0.04, 0], head: [-0.42, 0.12, 0.05],
    clavL: [0, 0, 0.05], clavR: [0, 0, -0.05],
    shoulderL: [-0.35, 0.1, 0.32], elbowL: [-0.9, 0.0, 0], wristL: [0.2, 0, -0.2],
    shoulderR: [0.15, -0.1, -0.25], elbowR: [-0.25, 0, 0], handL: "claw", handR: "relax",
  } as Pose,
  /** alarm recoil: knees bend, torso leans back away from the threat, shoulders shrug, both arms up and out */
  alarm: {
    lift: -0.14, shift: -0.04, stance: 1.55, footL: [0.04, 0.1, 0.3], footR: [-0.02, -0.05, -0.25],
    hips: [-0.12, 0, 0], spine: [-0.06, 0, 0], chest: [-0.1, 0, 0], neck: [-0.12, 0, 0], head: [-0.32, 0, 0],
    clavL: [0, 0, 0.22], clavR: [0, 0, -0.22],
    shoulderL: [-1.15, 0.25, 0.85], elbowL: [-1.35, 0.0, 0], wristL: [-0.35, 0, -0.2],
    shoulderR: [-1.15, -0.25, -0.85], elbowR: [-1.35, 0.0, 0], wristR: [-0.35, 0, 0.2], handL: "splay", handR: "splay",
  } as Pose,
  /** brace: low crouch, weight forward over the feet, both hands gripping a rail at chest height in front */
  brace: {
    lift: -0.26, shift: -0.06, stance: 1.75, footL: [0.04, 0.12, 0.35], footR: [-0.03, -0.12, -0.3],
    hips: [0.32, 0, 0], spine: [0.12, 0, 0], chest: [0.06, 0, 0], neck: [-0.1, 0, 0], head: [-0.3, 0, 0],
    clavL: [0, 0, 0.08], clavR: [0, 0, -0.08],
    shoulderL: [-1.1, 0.1, 0.2], elbowL: [-0.7, 0, 0], shoulderR: [-1.1, -0.1, -0.2], elbowR: [-0.7, 0, 0],
    handL: "grip", handR: "grip",
    reachL: [0.13, 1.0, 0.42], reachR: [-0.13, 1.0, 0.42], reachW: 1,
  } as Pose,
  /** relieved exhale: shoulders drop, chest sinks, head tips back then settles, a hand to the chest */
  relief: {
    lift: -0.03, sway: 0.02, stance: 1.3, footL: [0.03, 0.06, 0.2], footR: [0, -0.03, -0.15],
    hips: [0.02, 0.04, 0.03], spine: [0.08, 0, -0.02], chest: [0.1, 0.05, -0.03], neck: [-0.05, 0, 0], head: [-0.16, 0.08, 0.1],
    clavL: [0, 0, -0.06], clavR: [0, 0, 0.06],
    shoulderL: [0.1, 0.1, 0.12], elbowL: [-0.18, 0, 0], wristL: [0, 0, -0.1],
    shoulderR: [-0.6, -0.3, -0.12], elbowR: [-1.9, 0.0, 0], wristR: [0.15, 0, 0.1],
    handL: "relax", handR: "flat",
    reachR: [0.02, 1.33, 0.2], reachW: 1,
  } as Pose,
} satisfies Record<string, Pose>;
export type PoseName = keyof typeof POSES;

// ------------------------------------------------------------------ easing + clip evaluation
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const EASE = {
  linear: (u: number) => clamp01(u),
  /** smootherstep: holds and camera-like glides */
  glide: (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); },
  /** fast attack with overshoot (reactions): peaks ~1.1 then settles */
  backOut: (u: number) => { const x = clamp01(u), s = 1.6; return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); },
  /** ease-out (snappy start, soft landing) */
  out: (u: number) => 1 - Math.pow(1 - clamp01(u), 3),
  /** ease-in (anticipation into a drop) */
  in: (u: number) => Math.pow(clamp01(u), 2.2),
  /** anticipation: dips back ~8 % first, then goes */
  antic: (u: number) => { const x = clamp01(u); return x < 0.25 ? -0.08 * Math.sin((x / 0.25) * Math.PI) : EASE.backOut((x - 0.25) / 0.75); },
};
export type EaseName = keyof typeof EASE;
export type Key<T> = { f: number; v: T; ease?: EaseName };

/** evaluate a keyed clip at frame f (the ease of the TARGET key shapes the segment) */
export function keyed<T>(keys: Key<T>[], f: number, mix: (a: T, b: T, t: number) => T): T {
  if (f <= keys[0].f) return keys[0].v;
  for (let i = 1; i < keys.length; i++) {
    if (f <= keys[i].f) {
      const a = keys[i - 1], b = keys[i];
      return mix(a.v, b.v, EASE[b.ease ?? "glide"]((f - a.f) / (b.f - a.f)));
    }
  }
  return keys[keys.length - 1].v;
}

// ------------------------------------------------------------------ additive motion layers (the "never frozen" rules)
const add3 = (r: Rot | undefined, d: Rot): Rot => [(r?.[0] ?? 0) + d[0], (r?.[1] ?? 0) + d[1], (r?.[2] ?? 0) + d[2]];
/** breathing: 4.2 s cycle at rest (faster when scared), chest + clavicles, head counter-motion */
export function breathe(p: Pose, tSec: number, amt = 1, rate = 1): Pose {
  const b = Math.sin(tSec * Math.PI * 2 * (rate / 4.2));
  return {
    ...p,
    chest: add3(p.chest, [-0.014 * b * amt, 0, 0]), neck: add3(p.neck, [0.008 * b * amt, 0, 0]),
    clavL: add3(p.clavL, [0, 0, 0.012 * b * amt]), clavR: add3(p.clavR, [0, 0, -0.012 * b * amt]),
    lift: (p.lift ?? 0) + 0.002 * b * amt,
  };
}
/** idle drift: slow weight shift + head micro-sway (two incommensurate sines, no visible loop) */
export function drift(p: Pose, tSec: number, amt = 1): Pose {
  const a = Math.sin(tSec * 0.9 + 0.4), c = Math.sin(tSec * 1.37 + 1.1);
  return {
    ...p, sway: (p.sway ?? 0) + 0.008 * a * amt,
    hips: add3(p.hips, [0, 0, -0.012 * a * amt]), chest: add3(p.chest, [0, 0.01 * c * amt, 0.01 * a * amt]),
    head: add3(p.head, [0.012 * c * amt, 0.02 * a * amt, 0]),
  };
}
/** fear tremble: small fast shake on head/hands, `amt` should decay over ~12 frames */
export function tremble(p: Pose, f: number, amt: number): Pose {
  if (amt <= 0) return p;
  const n = (k: number) => Math.sin(f * 2.9 + k * 1.7) * 0.6 + Math.sin(f * 4.3 + k) * 0.4;
  return {
    ...p, head: add3(p.head, [0.02 * n(1) * amt, 0.015 * n(2) * amt, 0]),
    wristL: add3(p.wristL, [0.06 * n(3) * amt, 0, 0.05 * n(4) * amt]), wristR: add3(p.wristR, [0.06 * n(5) * amt, 0, 0.05 * n(6) * amt]),
    chest: add3(p.chest, [0.01 * n(7) * amt, 0, 0]),
  };
}
