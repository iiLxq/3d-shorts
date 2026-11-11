// [gus lab] Gus v2 pose + expression data and the acting clips (idle weight shift, alarm recoil, relieved exhale).
// L = character's left (+x). Angles in radians, offsets in metres. Poses are view-independent ("semantic"):
// api.ts maps them onto each replacement drawing (front: abduction in plane; profile: flexion in plane).
import type { MouthId } from "./figure";
import { clamp, lerp, sstep } from "./kit";

export interface PoseData {
  px: number; py: number; pz: number; sway: number;          // pelvis shift (side / up / forward), pelvis roll
  lean: number; pitch: number; breathe: number;             // torso roll (+ toward L), pitch (+ forward), chest breath -1..1
  neck: number; nod: number;                                // head roll, head pitch (+ down)
  shAL: number; shFL: number; elL: number; wrL: number; curlL: number; thumbL: number;
  shAR: number; shFR: number; elR: number; wrR: number; curlR: number; thumbR: number;
  footLx: number; footLz: number; footRx: number; footRz: number; // planted foot offsets (IK keeps them locked)
  tool: number;
  hUpL: number; hUpR: number;   // front drawing: forearm flexes up toward the face (1) or toward the belly (0)
}
export type PoseName = "idle" | "idleShift" | "alarmAnticip" | "alarmRecoil" | "alarmHold" | "brace" | "relievedInhale" | "relievedExhale" | "relieved" | "lookUp";
const Z: PoseData = {
  px: 0, py: -0.003, pz: 0, sway: 0, lean: 0, pitch: 0, breathe: 0, neck: 0, nod: 0.02,
  shAL: 0.07, shFL: 0.05, elL: 0.16, wrL: 0.04, curlL: 0.35, thumbL: 0.2,
  shAR: 0.07, shFR: 0.05, elR: 0.16, wrR: 0.04, curlR: 0.35, thumbR: 0.2,
  footLx: 0, footLz: 0.03, footRx: 0, footRz: -0.03, tool: 0, hUpL: 0, hUpR: 0,
};
const P = (o: Partial<PoseData>): PoseData => ({ ...Z, ...o });
export const POSES: Record<PoseName, PoseData> = {
  idle: Z,
  // weight on the left leg: pelvis over it, left hip up, torso counter-leans, head re-levels
  idleShift: P({ px: 0.026, py: -0.007, sway: 0.05, lean: -0.045, neck: 0.025, shAL: 0.05, shAR: 0.1, elL: 0.12, elR: 0.22 }),
  alarmAnticip: P({ py: -0.03, pitch: 0.1, nod: 0.12, shAL: 0.12, shAR: 0.12, shFL: 0.15, shFR: 0.15, elL: 0.45, elR: 0.45, curlL: 0.7, curlR: 0.7, thumbL: 0.1, thumbR: 0.1 }),
  alarmRecoil: P({ hUpL: 1, hUpR: 1, py: -0.014, pz: -0.03, pitch: -0.16, nod: -0.13, shAL: 0.3, shAR: 0.28, shFL: 0.55, shFR: 0.5, elL: 2.35, elR: 2.25, wrL: -0.3, wrR: -0.3, curlL: -0.15, curlR: -0.1, thumbL: 0.7, thumbR: 0.7, tool: 0.3 }),
  alarmHold: P({ hUpL: 1, hUpR: 1, py: -0.022, pz: -0.02, pitch: -0.09, nod: -0.05, shAL: 0.27, shAR: 0.25, shFL: 0.48, shFR: 0.45, elL: 2.32, elR: 2.25, wrL: -0.22, wrR: -0.22, curlL: 0.05, curlR: 0.1, thumbL: 0.55, thumbR: 0.55 }),
  brace: P({ py: -0.07, pitch: 0.12, shAL: 0.3, shAR: 0.3, shFL: 0.6, shFR: 0.6, elL: 1.0, elR: 1.0, curlL: 1, curlR: 1 }),
  relievedInhale: P({ py: 0.002, pitch: -0.07, breathe: 1, nod: -0.1, shAL: 0.1, shAR: 0.1, elL: 0.2, elR: 0.2, curlL: 0.3, curlR: 0.3 }),
  relievedExhale: P({ py: -0.03, pitch: 0.11, breathe: -1, nod: 0.24, shAL: 0.03, shAR: 0.03, shFL: 0.0, shFR: 0.0, elL: 0.08, elR: 0.08, curlL: 0.15, curlR: 0.15 }),
  // relief: hand on the chest
  relieved: P({ py: -0.012, pitch: 0.03, nod: 0.06, shAR: 0.12, shFR: 1.0, elR: 2.45, wrR: 0.25, curlR: 0.25, thumbR: 0.3, shAL: 0.05, elL: 0.12, curlL: 0.3 }),
  lookUp: P({ pitch: -0.08, nod: -0.25, shAL: 0.06, shAR: 0.06 }),
};
export function mixPose(a: PoseData, b: PoseData, t: number): PoseData {
  const o = { ...a };
  (Object.keys(a) as (keyof PoseData)[]).forEach((k) => { o[k] = lerp(a[k], b[k], t); });
  return o;
}
export function mirrorPose(p: PoseData): PoseData {
  return { ...p, px: -p.px, sway: -p.sway, lean: -p.lean, neck: -p.neck,
    shAL: p.shAR, shFL: p.shFR, elL: p.elR, wrL: p.wrR, curlL: p.curlR, thumbL: p.thumbR,
    shAR: p.shAL, shFR: p.shFL, elR: p.elL, wrR: p.wrL, curlR: p.curlL, thumbR: p.thumbL, hUpL: p.hUpR, hUpR: p.hUpL,
    footLx: -p.footRx, footLz: p.footRz, footRx: -p.footLx, footRz: p.footLz };
}

// ---------------------------------------------------------------- expressions
export interface ExprData {
  lid: number; lidL: number; gx: number; gy: number; pupil: number;
  browL: number; browR: number; browIn: number; mouth: MouthId; stache: number; cheek: number;
}
export type ExprName = "neutral" | "focused" | "curious" | "alarmed" | "terrified" | "wincing" | "relieved" | "smiling";
export const EXPR_NAMES: ExprName[] = ["neutral", "focused", "curious", "alarmed", "terrified", "wincing", "relieved", "smiling"];
export const EXPRS: Record<ExprName, ExprData> = {
  neutral: { lid: 0.16, lidL: 0.1, gx: 0, gy: 0, pupil: 1, browL: 0, browR: 0, browIn: 0, mouth: "neutral", stache: 0, cheek: 0 },
  focused: { lid: 0.4, lidL: 0.32, gx: 0, gy: -0.35, pupil: 0.92, browL: -0.004, browR: -0.004, browIn: -0.3, mouth: "firm", stache: -0.002, cheek: 0 },
  curious: { lid: 0.16, lidL: 0.05, gx: 0.45, gy: 0.25, pupil: 1.05, browL: 0.011, browR: -0.001, browIn: 0.06, mouth: "pursed", stache: 0.002, cheek: 0 },
  alarmed: { lid: -0.15, lidL: 0, gx: 0, gy: 0.1, pupil: 0.74, browL: 0.011, browR: 0.011, browIn: 0.24, mouth: "open", stache: 0.006, cheek: 0 },
  terrified: { lid: -0.25, lidL: 0, gx: 0, gy: 0, pupil: 0.55, browL: 0.014, browR: 0.014, browIn: 0.46, mouth: "scream", stache: 0.008, cheek: 0 },
  wincing: { lid: 0.94, lidL: 0.62, gx: 0, gy: 0, pupil: 1, browL: -0.007, browR: -0.007, browIn: -0.36, mouth: "clench", stache: 0.007, cheek: 1 },
  relieved: { lid: 0.58, lidL: 0.16, gx: 0, gy: -0.2, pupil: 1, browL: 0.004, browR: 0.004, browIn: 0.26, mouth: "exhale", stache: -0.002, cheek: 0 },
  smiling: { lid: 0.28, lidL: 0.52, gx: 0, gy: 0, pupil: 1.05, browL: 0.004, browR: 0.004, browIn: 0.05, mouth: "grin", stache: 0.004, cheek: 1 },
};
export function mixExpr(a: ExprData, b: ExprData, t: number): ExprData {
  const o = { ...a } as ExprData;
  for (const k of ["lid", "lidL", "gx", "gy", "pupil", "browL", "browR", "browIn", "stache", "cheek"] as const) o[k] = lerp(a[k], b[k], t);
  o.mouth = t < 0.5 ? a.mouth : b.mouth; // cut-outs swap, they do not morph
  return o;
}

// ---------------------------------------------------------------- acting clips (local frame f -> pose + expression)
const ease = (t: number) => sstep(0, 1, t);
/** back-ease with overshoot: 0 -> ~1.12 -> 1 */
const over = (t: number, k = 1.9) => { t = clamp(t, 0, 1); const u = t - 1; return 1 + (k + 1) * u * u * u + k * u * u; };
export interface Act { pose: PoseData; expr: ExprData }

export function actIdle(f: number): Act {
  const w = 0.5 + 0.5 * Math.sin((f / 110) * Math.PI * 2 - 0.6);
  const ws = ease(w);
  let pose = mixPose(POSES.idleShift, mirrorPose(POSES.idleShift), ws);
  pose = { ...pose, breathe: Math.sin((f / 78) * Math.PI * 2) };
  // arms follow the weight shift a few frames late (secondary), small, close to the body (no airplane arms)
  const lagW = 0.5 + 0.5 * Math.sin(((f - 7) / 110) * Math.PI * 2 - 0.6);
  pose.shAL += 0.02 * (lagW - 0.5); pose.shAR -= 0.02 * (lagW - 0.5);
  pose.nod += 0.015 * Math.sin((f / 78) * Math.PI * 2 + 1);
  // gaze: holds, then quick saccades
  const g = [[0, 0], [0.35, 0.05], [0.35, 0.05], [-0.2, -0.1], [0, 0]];
  const seg = Math.floor(f / 24) % g.length, tt = clamp(((f % 24) - 0) / 3, 0, 1);
  const a = g[seg], b = g[(seg + 1) % g.length];
  const expr = { ...EXPRS.neutral, gx: lerp(a[0], b[0], f % 24 > 20 ? ease((f % 24 - 20) / 4) : 0) * (tt ? 1 : 1), gy: lerp(a[1], b[1], f % 24 > 20 ? ease((f % 24 - 20) / 4) : 0) };
  return { pose, expr };
}
export function actAlarm(f: number, from: Act): Act {
  // 0-6 anticipation ("huh?") | 6-11 recoil with overshoot | 11-26 settle | hold with a decaying tremble
  let pose: PoseData, expr: ExprData;
  if (f < 6) {
    const t = ease(f / 6);
    pose = mixPose(from.pose, POSES.alarmAnticip, t);
    expr = mixExpr(from.expr, EXPRS.focused, Math.min(1, t * 1.4));
  } else if (f < 26) {
    const t = over((f - 6) / 7);
    pose = mixPose(POSES.alarmAnticip, POSES.alarmRecoil, t);
    if (f >= 13) pose = mixPose(pose, POSES.alarmHold, ease((f - 13) / 13));
    expr = f < 8 ? EXPRS.alarmed : f < 24 ? EXPRS.terrified : EXPRS.alarmed;
  } else {
    pose = { ...POSES.alarmHold };
    expr = EXPRS.alarmed;
  }
  const tr = f > 9 ? 0.012 * Math.exp(-(f - 9) / 14) * Math.sin(f * 2.3) : 0;
  pose = { ...pose, lean: pose.lean + tr, shAL: pose.shAL + tr * 1.5, shAR: pose.shAR - tr * 1.5, breathe: f > 8 ? Math.sin(f * 0.45) * 0.6 : pose.breathe };
  return { pose, expr };
}
export function actRelief(f: number, from: Act): Act {
  // 0-10 inhale (shoulders up, head back) | 10-28 long exhale + slump | 28-45 settle into hand-on-chest, smile
  let pose: PoseData, expr: ExprData;
  if (f < 10) {
    const t = ease(f / 10);
    pose = mixPose(from.pose, POSES.relievedInhale, t);
    expr = mixExpr(from.expr, { ...EXPRS.relieved, mouth: "neutral", lid: 0.2 }, t);
  } else if (f < 28) {
    const t = 1 - Math.pow(1 - clamp((f - 10) / 18, 0, 1), 2.4); // fast out, long tail: an exhale
    pose = mixPose(POSES.relievedInhale, POSES.relievedExhale, t);
    expr = { ...EXPRS.relieved, lid: lerp(0.4, 0.9, t) };
  } else {
    const t = ease((f - 28) / 17);
    pose = mixPose(POSES.relievedExhale, POSES.relieved, t);
    expr = f < 34 ? { ...EXPRS.relieved, lid: lerp(0.9, 0.6, ease((f - 28) / 6)) } : mixExpr(EXPRS.relieved, EXPRS.smiling, ease((f - 34) / 6));
  }
  return { pose, expr };
}
/** 150-frame showcase: idle 0-59, alarm 60-104, relief 105-149. onTwos holds every pose for two frames. */
export function actShowcase(f: number, onTwos = false): Act {
  if (onTwos) f = Math.floor(f / 2) * 2;
  if (f < 60) return actIdle(f);
  const idleEnd = actIdle(59);
  if (f < 105) return actAlarm(f - 60, idleEnd);
  return actRelief(f - 105, actAlarm(44, idleEnd));
}
