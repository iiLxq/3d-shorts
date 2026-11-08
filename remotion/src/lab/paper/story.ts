// Shot states for the lab: board stills (hero / states / faces) and the 90-frame motion test.
import * as THREE from "three";
import { FrameState, Cam } from "./world";
import { Pose, Expr, POSE0, EXPR, mixPose } from "./puppet";
import { Look } from "./paint";

export const FPS = 30;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
const lerpV = (a: THREE.Vector3, b: THREE.Vector3, t: number) => a.clone().lerp(b, t);

export const HEAD = V(-0.15, 1.52, 0.4);   // Gus's face (car at rest)
export interface Shot extends FrameState { focusAt: THREE.Vector3; flash: number }

const HERO_CAM = (): Cam => ({ pos: V(-0.6, 2.5, 4.4), target: V(0.35, 0.95, -0.5), fov: 42, focus: 0, blur: 9 });

const POSES: Record<string, Pose> = {
  idle: POSE0,
  alarmed: { ...POSE0, lift: 0.0, lean: -0.05, neck: 0.06, headTilt: -0.05, sL: -2.3, eL: -0.9, wL: -0.3, sR: 2.2, eR: 1.0, wR: 0.3, hL: -0.18, kL: 0.12, fL: 0.1, hR: 0.2, kR: -0.15, fR: -0.1, tool: 0.5 },
  brace: { ...POSE0, lift: -0.05, lean: 0.04, neck: -0.04, headTilt: 0.04, sL: -1.2, eL: -1.3, wL: 0.2, sR: 1.3, eR: 1.4, wR: -0.2, hL: -0.32, kL: 0.5, fL: 0.12, hR: 0.32, kR: -0.5, fR: -0.12, tool: -0.4 },
  relieved: { ...POSE0, lift: -0.012, lean: 0.03, neck: 0.1, headTilt: 0.1, sL: -0.06, eL: 0.05, sR: 0.5, eR: 2.1, wR: 0.25, hL: -0.05, kL: 0.03, hR: 0.06, kR: -0.03, tool: 0 },
};

function base(look: Look, cam: Cam, pose: Pose, expr: Expr, focusAt: THREE.Vector3, yaw = 0.06): Shot {
  return { look, t: 0, cam, pose, expr, yaw, carY: 0, snap: -1, clamp: 0, clampT: -1, alarm: 0, arrows: 0, focusAt, flash: 0 };
}

/** Board frames: 0 hero SOLID, 1 BLUEPRINT, 2 X-RAY, 3 calm, 4 alarmed, 5 relieved. */
export function boardShot(f: number): Shot {
  if (f <= 2) {
    const look: Look = f === 0 ? "solid" : f === 1 ? "blueprint" : "xray";
    const s = base(look, HERO_CAM(), POSES.idle, { ...EXPR.calm, py: 0.012, px: 0.008 }, HEAD.clone());
    if (look === "xray") { s.arrows = 1; s.alarm = 0.6; s.pose = mixPose(POSES.idle, POSES.alarmed, 0.35); s.expr = EXPR.alarmed; }
    if (look === "blueprint") s.cam.blur = 6;
    return s;
  }
  const which = ["calm", "alarmed", "relieved"][f - 3];
  const cam: Cam = { pos: V(-0.42, 1.74, 1.86), target: V(-0.13, 1.44, 0.4), fov: 32, focus: 0, blur: 14 };
  const s = base("solid", cam, POSES[which === "calm" ? "idle" : which], EXPR[which], HEAD.clone(), -0.05);
  if (which === "alarmed") s.alarm = 0.8;
  if (which === "relieved") { s.clamp = 1; s.clampT = 3; }
  return s;
}

/** 90-frame motion test: push-in, idle -> rope snap -> alarm -> fall -> jaws clamp (flash) -> settle/relief. */
export const SNAP_F = 34, CLAMP_F = 58;
export function motionShot(f: number): Shot {
  const t = f / FPS;
  // character animates on 2s, camera on 1s
  const fc = Math.floor(f / 2) * 2, tc = fc / FPS;
  const ts = (f - SNAP_F) / FPS, tsc = (fc - SNAP_F) / FPS;
  // car fall: free fall from SNAP+2 to CLAMP, then a damped jolt
  const tf0 = (SNAP_F + 2) / FPS, tcl = CLAMP_F / FPS;
  const dropAt = (tt: number) => {
    if (tt < tf0) return 0;
    if (tt < tcl) return -4.0 * (tt - tf0) ** 2;
    const d = -4.0 * (tcl - tf0) ** 2, u = tt - tcl;
    return d - 0.09 * Math.exp(-u * 7) * Math.sin(u * 26);
  };
  const carY = dropAt(t);
  // pose / expression timeline (on 2s)
  let pose: Pose = { ...POSES.idle }, expr: Expr = { ...EXPR.calm, py: 0.012, px: 0.008 };
  const breath = Math.sin(tc * 2.6);
  pose.lift = 0.004 * breath; pose.neck = 0.03 * Math.sin(tc * 1.3); pose.sL += 0.03 * breath; pose.sR -= 0.03 * breath;
  if (fc >= 16 && fc <= 20) expr.lid = fc === 18 ? 3 : 2;              // blink
  if (fc >= 24 && fc < SNAP_F + 2) { expr.px = 0.012; expr.py = 0.016; pose.neck = 0.07; }   // glances up at the ropes
  if (tsc >= 0) {
    // reaction 2 frames after the snap, overshoot then hold
    const k = clamp01((fc - SNAP_F - 2) / 6);
    const os = k < 1 ? glide(k) * 1.18 : 1 + 0.18 * Math.exp(-(fc - SNAP_F - 8) / 3) * Math.cos((fc - SNAP_F - 8) * 0.9);
    pose = mixPose(pose, POSES.alarmed, os);
    if (fc >= SNAP_F + 2) expr = { ...EXPR.alarmed };
    if (fc >= SNAP_F + 2 && fc < SNAP_F + 4) expr = { ...EXPR.alarmed, mouth: "o", lid: 0 };
    // free-fall float
    if (f > SNAP_F + 2 && f < CLAMP_F) pose.lift += 0.05 * clamp01((f - SNAP_F - 2) / 10);
  }
  if (fc >= CLAMP_F) {
    const u = fc - CLAMP_F;
    const k = clamp01(u / 4);
    pose = mixPose(pose, POSES.brace, k < 1 ? glide(k) : 1 - 0.0);
    if (u > 14) pose = mixPose(POSES.brace, POSES.relieved, glide((u - 14) / 10));
    expr = u > 18 ? { ...EXPR.relieved } : u > 14 ? { ...EXPR.relieved, lid: 2, mouth: "o" } : { ...EXPR.alarmed, small: u > 6 ? false : true, mouth: "alarm" };
  }
  // camera: eased push-in along the view axis, follows the car with a 2-frame lag, kick on the clamp
  const c0 = HERO_CAM();
  const end = { pos: V(-0.5, 2.3, 3.9), target: V(0.42, 0.92, -0.45) };
  const k = glide(t / 3.0);
  const pos = lerpV(c0.pos, end.pos, k), target = lerpV(c0.target, end.target, k);
  const lagY = dropAt(Math.max(0, t - 2 / FPS)) * 0.92 + carY * 0.08;
  pos.y += lagY; target.y += lagY;
  let roll = 0;
  if (f >= CLAMP_F) {
    const u = f - CLAMP_F, kick = (u % 2 ? -1 : 1) * Math.pow(Math.max(0, 1 - u / 8), 1.5);
    target.y += 0.035 * kick; roll = 0.006 * kick;
  }
  const s = base("solid", { pos, target, fov: 42 - 1.5 * k, focus: 0, blur: 9, roll }, pose, expr, HEAD.clone().add(V(0, carY, 0)), 0.06 - 0.03 * k);
  s.t = t; s.carY = carY; s.snap = ts;
  s.clamp = f >= CLAMP_F - 1 ? clamp01((f - CLAMP_F + 2) / 2) : 0;
  s.clampT = f >= CLAMP_F ? (f - CLAMP_F) / FPS : -1;
  s.alarm = ts >= 0 ? (f < CLAMP_F + 10 ? 0.55 + 0.45 * Math.sin(ts * 14) : Math.max(0, 1 - (f - CLAMP_F - 10) / 12) * 0.6) : 0;
  s.flash = f === CLAMP_F ? 0.55 : f === CLAMP_F + 1 ? 0.28 : f === CLAMP_F + 2 ? 0.1 : 0;
  return s;
}
