// Pure function (mode, frame) -> everything the frame needs. No hidden state.
import * as THREE from "three";
import { POSES, blendPose, Pose, Expr } from "./figure";
import { WorldState } from "./scene";
import { PrintLook } from "./engine";

export type Mode = "hero" | "faces" | "states" | "motion";
export type Cam = { pos: THREE.Vector3; look: THREE.Vector3; fov: number; roll: number };
export type Frame = { cam: Cam; ws: WorldState; look: PrintLook; pose: Pose; expr: Expr; meter: number; meterGreen: boolean; labels: number; fig: string; stamp: number };

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const sstep = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const smoother = (t: number) => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };

export const HERO: Cam = { pos: V(1.05, 2.0, 3.9), look: V(-0.5, 0.6, -0.4), fov: 50, roll: 0 };
const FACE: Cam = { pos: V(-0.72, 1.74, 1.62), look: V(0.18, 1.55, 0.12), fov: 27, roll: 0 };

function baseWS(): WorldState {
  return { drop: 0, jaw: 0, jawGlow: 0.25, alarm: 0.55, snap: -1, xr: 0, arrows: 0, lampOn: 1, headAim: V(-1.25, 0.5, 0.0), ropeShiver: 0, t: 0 };
}
const solidLook = (): PrintLook => ({ bp: 0, xr: 0, flash: 0, flashGreen: 0, glowK: 1, vignette: 0.16 });

export function frameAt(mode: Mode, f: number): Frame {
  const ws = baseWS();
  let cam: Cam = { ...HERO };
  let look = solidLook();
  let pose = POSES.idle; let expr: Expr = "calm";
  let meter = 0.35, meterGreen = false, labels = 0, fig = "", stamp = 0;
  if (mode === "hero") { fig = "FIG. 1"; }
  if (mode === "faces") {
    cam = FACE; ws.alarm = 0.35; look.focus = [2.25, 3.4, 0.85];
    expr = (["calm", "alarmed", "relieved"] as Expr[])[Math.min(2, f)];
    pose = f === 1 ? POSES.alarm : f === 2 ? POSES.relieved : POSES.idle;
    if (f === 1) { ws.alarm = 1; ws.headAim = V(0.2, 6, -0.3); }
    if (f === 2) { ws.alarm = 0; ws.jaw = 1; ws.jawGlow = 0.6; }
  }
  if (mode === "states") {
    const s = Math.min(2, f);
    labels = 1;
    if (s === 0) { look = { ...look, bp: 1, vignette: 0.1, glowK: 1.3 }; ws.alarm = 0; ws.jawGlow = 0; fig = "FIG. 1"; meter = 0.15; }
    if (s === 1) { look = { ...look, xr: 1 }; ws.xr = 1; ws.arrows = 1; ws.alarm = 0.9; expr = "alarmed"; pose = POSES.alarm; ws.headAim = V(0.2, 6, -0.3); fig = "FIG. 2"; meter = 0.8; }
    if (s === 2) { ws.jaw = 1; ws.jawGlow = 0.85; ws.alarm = 0.3; expr = "relieved"; pose = POSES.relieved; fig = "FIG. 3"; meter = 0; meterGreen = true; }
  }
  if (mode === "motion") {
    const t = f / 30; ws.t = t;
    // events (frames): creak 22, reaction 26-34, snap 40, free fall 40-58, clamp 58
    const SNAP = 40, CLAMP = 58;
    ws.ropeShiver = f >= 22 && f < SNAP ? 0.004 * sstep(22, 30, f) : 0;
    ws.alarm = f < 22 ? 0.25 : 0.55 + 0.45 * Math.max(0, Math.sin((f - 22) * 0.55));
    const react = sstep(26, 33, f);
    const anticip = f >= 24 && f < 27 ? -0.25 * Math.sin(((f - 24) / 3) * Math.PI) : 0;
    const over = f >= 33 && f < 40 ? 0.08 * Math.sin(((f - 33) / 7) * Math.PI) : 0;
    pose = blendPose(POSES.idle, POSES.alarm, clamp(react + anticip * 0 + over));
    if (anticip) pose = { ...pose, rootY: (pose.rootY ?? 0) + anticip * 0.05 };
    // breathing in idle
    pose = { ...pose, torso: pose.torso + 0.012 * Math.sin(t * 3.1), head: pose.head + 0.015 * Math.sin(t * 3.1 + 0.6) };
    expr = f < 26 ? "calm" : "alarmed";
    if (f === 26 || f === 12) expr = "blink";
    if (f >= 80) expr = "relieved";
    if (f >= 80) pose = blendPose(pose, POSES.relieved, sstep(80, 89, f));
    ws.headAim = f < 26 ? V(-1.25, 0.45, 0.0) : V(0.15, 6, -0.2);
    if (f >= SNAP) ws.snap = (f - SNAP) / 30;
    // car: free fall (reduced g for readability), then the clamp with a 3 cm rebound
    if (f >= SNAP && f < CLAMP) { const tt = (f - SNAP) / 30; ws.drop = 0.5 * 4.2 * tt * tt; }
    const dropAtClamp = 0.5 * 4.2 * Math.pow((CLAMP - SNAP) / 30, 2);
    if (f >= CLAMP) { const tt = (f - CLAMP) / 30; ws.drop = dropAtClamp + 0.03 * Math.exp(-tt * 9) * Math.sin(tt * 30); }
    ws.jaw = f < CLAMP - 2 ? 0 : sstep(CLAMP - 2, CLAMP, f);
    ws.jawGlow = f < CLAMP ? 0.2 : 0.25 + 0.75 * Math.exp(-(f - CLAMP) / 14);
    look.flash = f === CLAMP ? 0.6 : f === CLAMP + 1 ? 0.3 : f === CLAMP + 2 ? 0.1 : 0;
    look.flashGreen = 0.6;
    if (f >= SNAP && f < SNAP + 2) { look.flash = f === SNAP ? 0.35 : 0.12; look.flashGreen = 0; }
    // danger meter: rises with the creak, peaks in the fall, crashes green on the clamp frame
    meter = f < 22 ? 0.12 : f < CLAMP ? 0.12 + 0.86 * sstep(22, CLAMP - 1, f) : 0.06;
    meterGreen = f >= CLAMP;
    // camera: one-axis eased push-in (whole clip), tracks 60 % of the drop, impact shake decays in 9 f
    const k = smoother(f / 89);
    const P0 = HERO.pos, P1 = V(0.75, 1.65, 3.25);
    const L0 = HERO.look, L1 = V(-0.55, 0.62, -0.35);
    const pos = P0.clone().lerp(P1, k), lk = L0.clone().lerp(L1, k);
    pos.y -= ws.drop * 0.6; lk.y -= ws.drop * 0.6;
    if (f >= CLAMP) { const s = Math.exp(-(f - CLAMP) / 4) * 0.025; pos.y += s * Math.sin((f - CLAMP) * 2.3); lk.y += s * 0.5 * Math.sin((f - CLAMP) * 2.3 + 1); }
    cam = { pos, look: lk, fov: HERO.fov, roll: 0 };
    stamp = 0;
  }
  return { cam, ws, look, pose, expr, meter, meterGreen, labels, fig, stamp };
}

export function makeCamera(c: Cam, aspect: number) {
  const cam = new THREE.PerspectiveCamera(c.fov, aspect, 0.1, 60);
  cam.position.copy(c.pos);
  const fwd = c.look.clone().sub(c.pos).normalize();
  cam.up.set(0, 1, 0).applyAxisAngle(fwd, c.roll);
  cam.lookAt(c.look); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  return cam;
}
