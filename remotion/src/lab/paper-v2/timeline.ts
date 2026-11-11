// PaperV2Test timeline: every value is a pure function of the output frame f (30 fps, 300 frames).
//   f = screen time (camera, meter, transitions)   S = story time (set, ropes, mechanism, Gus)
// Shots (planned cuts only):  A 0-149 case file -> pop-up -> BLUEPRINT -> peel (match: same framing) -> SOLID snap
//                             B 150-261 frayed-cord macro -> vellum X-RAY dive -> side-on jaw macro, bite, freeze, replay
//                             C 262-299 relief wide.
import * as THREE from "three";
import { Frame, Cam, CALLOUTS, GEAR, SH } from "./set";
import { Pose, Expr, POSE0, EXPR, mixPose } from "./puppet";
import { Look } from "./paint";

export const FPS = 30, N = 300;
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
export const smooth = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
/** paper spring: eased rise with a small damped overshoot (card memory) */
const spring = (u: number) => { if (u <= 0) return 0; if (u >= 1.6) return 1; const e = glide(Math.min(1, u)); return u < 1 ? e : 1 + 0.035 * Math.sin((u - 1) * 10) * Math.exp(-(u - 1) * 6); };

export const T = {
  COVER: [20, 44], WALL: [30, 58], SIDE: [40, 64], POP: [46, 70],
  METER_IN: [66, 78],
  PEEL: [98, 122],
  CREAK: 128, SNAP: 140, LURCH: 146,
  CUT1: 150,
  XRAY_IN: [160, 176], XRAY_OUT: [190, 204],
  TRIP: 198, BITE: 212,
  FREEZE: [214, 229], REWIND: [229, 235], SLOW: [235, 254], RAMP: [254, 262],
  CUT2: 262,
} as const;

/** story time S(f) */
export function story(f: number): number {
  if (f <= T.FREEZE[0]) return f;
  if (f <= T.FREEZE[1]) return T.FREEZE[0];
  if (f <= T.REWIND[1]) return T.FREEZE[0] - 8 * glide((f - T.REWIND[0]) / (T.REWIND[1] - T.REWIND[0]));
  const s0 = T.FREEZE[0] - 8;
  if (f <= T.SLOW[1]) return s0 + 0.35 * (f - T.SLOW[0]);
  const s1 = s0 + 0.35 * (T.SLOW[1] - T.SLOW[0]);
  const rr = (1 - 0.35) / (T.RAMP[1] - T.RAMP[0]);
  if (f <= T.RAMP[1]) { const d = f - T.RAMP[0]; return s1 + 0.35 * d + 0.5 * rr * d * d; }
  const s2 = s1 + 0.35 * (T.RAMP[1] - T.RAMP[0]) + 0.5 * rr * (T.RAMP[1] - T.RAMP[0]) ** 2;
  return s2 + (f - T.RAMP[1]);
}

// ------------------------------------------------------------------------------------------- mechanism (story)
const VMAX = 0.018;
function fallV(S: number) {
  if (S < T.LURCH + 6) return 0;
  const v = VMAX * glide((S - T.LURCH - 6) / 22);
  if (S < T.TRIP) return v;
  return v * (1 - glide((S - T.TRIP) / (T.BITE - T.TRIP)));   // progressive gear: the wedges drag the car to a stop
}
export function carY(S: number): number {
  let y = 0;
  if (S >= T.SNAP) y += 0.01 * Math.sin((S - T.SNAP) * 1.2) * Math.exp(-(S - T.SNAP) / 4);
  if (S >= T.LURCH) {
    y += -0.06 * glide((S - T.LURCH) / 5);
    let acc = 0; const s0 = T.LURCH + 6;
    for (let s = s0; s < S; s += 0.25) acc += fallV(s + 0.125) * Math.min(0.25, S - s);
    y -= acc;
    if (S >= T.BITE) y += 0.006 * Math.sin((S - T.BITE) * 0.9) * Math.exp(-(S - T.BITE) / 5);
  }
  return y;
}
export const clampAt = (S: number) => (S < T.TRIP ? 0 : S >= T.BITE ? 1 : Math.pow((S - T.TRIP) / (T.BITE - T.TRIP), 2));
export const glowAt = (S: number) => (S < T.BITE - 3 ? 0 : S < T.BITE ? 0.3 * (S - T.BITE + 3) / 3 : 0.25 + 0.75 * Math.exp(-(S - T.BITE) / 7)) * (1 - smooth(T.BITE + 30, T.BITE + 60, S));
export function alarmAt(S: number) {
  if (S < T.SNAP + 2) return 0;
  const p = 0.5 + 0.5 * Math.max(0, Math.sin((S - T.SNAP - 2) * 0.55));
  return S < T.BITE + 4 ? p : p * (1 - smooth(T.BITE + 4, T.BITE + 30, S));
}

// ------------------------------------------------------------------------------------------- meter (screen)
export function meterAt(f: number): number {
  if (f >= T.BITE) { const d = f - T.BITE; return 0.06 + 0.035 * Math.exp(-d / 6) * Math.sin(d * 0.9 + 0.6); }
  let m = 0.1 + 0.01 * Math.sin(f * 0.21);
  m += 0.06 * smooth(T.CREAK, T.CREAK + 10, f);
  m += 0.3 * glide((f - T.SNAP) / 8);
  m += 0.14 * glide((f - T.LURCH) / 8);
  m += 0.32 * glide((f - 160) / (T.BITE - 4 - 160));
  if (f > T.SNAP) m += 0.012 * Math.sin(f * 1.7) * smooth(T.SNAP, T.SNAP + 10, f);
  return clamp01(m);
}

// ------------------------------------------------------------------------------------------- camera (monotone cubic keys)
type K = { f: number; pos: [number, number, number]; look: [number, number, number]; fov: number; blur: number; focus: [number, number, number] };
function mono(keys: K[], f: number, get: (k: K) => number) {
  const n = keys.length;
  if (f <= keys[0].f) return get(keys[0]);
  if (f >= keys[n - 1].f) return get(keys[n - 1]);
  let i = 0; while (i < n - 2 && f > keys[i + 1].f) i++;
  const sec = (j: number) => (get(keys[j + 1]) - get(keys[j])) / (keys[j + 1].f - keys[j].f);
  const tan = (j: number) => {
    if (j === 0 || j === n - 1) return 0;               // shots start and end at rest (eased in/out)
    const d0 = sec(j - 1), d1 = sec(j); if (d0 * d1 <= 0) return 0;
    const h0 = keys[j].f - keys[j - 1].f, h1 = keys[j + 1].f - keys[j].f;
    return 3 * (h0 + h1) / ((2 * h1 + h0) / d0 + (h1 + 2 * h0) / d1);
  };
  const k0 = keys[i], k1 = keys[i + 1], h = k1.f - k0.f, u = clamp01((f - k0.f) / h);
  const m0 = tan(i) * h, m1 = tan(i + 1) * h, u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * get(k0) + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * get(k1) + (u3 - u2) * m1;
}
const B_POS: [number, number, number] = [0.42, 1.7, 5.7], B_LOOK: [number, number, number] = [-0.12, 1.2, -0.3];
const SHOT_A: K[] = [
  { f: 0, pos: [0.35, -3.55, 8.3], look: [0.0, -5.16, 5.95], fov: 34, blur: 14, focus: [0.0, -5.16, 5.9] },        // macro: FAIL-SAFE FILES stamp
  { f: 14, pos: [0.33, -3.45, 8.4], look: [0.0, -5.16, 5.92], fov: 34, blur: 13, focus: [0.0, -5.16, 5.9] },
  { f: 42, pos: [0.4, 3.6, 14.2], look: [0.0, -3.0, 2.2], fov: 40, blur: 6, focus: [0.0, -4.5, 3.0] },                // the whole case file
  { f: 66, pos: [0.6, 2.6, 9.6], look: [-0.05, 0.6, -0.4], fov: 40, blur: 6, focus: [-0.1, 1.2, 0.3] },             // pop-up stands
  { f: 98, pos: B_POS, look: B_LOOK, fov: 40, blur: 8, focus: [-0.44, 1.4, 0.3] },                                   // BLUEPRINT hold
  { f: 122, pos: [0.38, 1.5, 4.85], look: [-0.12, 1.3, -0.3], fov: 40, blur: 9, focus: [-0.44, 1.45, 0.3] },        // peel done (same axis)
  { f: 149, pos: [0.36, 1.38, 4.4], look: [-0.12, 1.45, -0.3], fov: 40, blur: 9, focus: [-0.44, 1.5, 0.3] },        // creep, ropes above Gus
];
const SHOT_B: K[] = [   // car space
  { f: 150, pos: [0.78, 1.05, 0.95], look: [0.02, 1.45, -0.1], fov: 38, blur: 13, focus: [0.04, 1.2, -0.02] },     // macro: frayed cords whip over the crosshead
  { f: 166, pos: [0.82, 0.98, 0.92], look: [0.1, 1.25, -0.1], fov: 38, blur: 13, focus: [0.04, 1.0, -0.02] },
  { f: 188, pos: [0.42, 0.72, 0.85], look: [1.0, 0.3, -0.02], fov: 34, blur: 11, focus: [1.05, 0.3, 0.0] },          // X-RAY dive over the roof edge
  { f: 208, pos: [-0.04, 0.32, -0.035], look: [1.2, 0.27, -0.035], fov: 31, blur: 11, focus: [1.0, 0.25, 0.0] },     // side-on jaw macro
  { f: 261, pos: [0.02, 0.32, -0.035], look: [1.2, 0.27, -0.035], fov: 31, blur: 11, focus: [1.0, 0.25, 0.0] },
];
const SHOT_C: K[] = [   // car space
  { f: 262, pos: [0.4, 1.45, 4.15], look: [-0.15, 1.15, -0.3], fov: 41, blur: 9, focus: [-0.44, 1.4, 0.3] },
  { f: 299, pos: [0.36, 1.4, 3.85], look: [-0.16, 1.17, -0.3], fov: 41, blur: 9, focus: [-0.44, 1.4, 0.3] },
];
export function camAt(f: number): { cam: Cam; shot: "A" | "B" | "C" } {
  const S = story(f);
  const keys = f < T.CUT1 ? SHOT_A : f < T.CUT2 ? SHOT_B : SHOT_C;
  const shot = f < T.CUT1 ? "A" : f < T.CUT2 ? "B" : "C";
  const g = (w: "pos" | "look" | "focus", i: number) => mono(keys, f, (k) => k[w][i]);
  const pos = V(g("pos", 0), g("pos", 1), g("pos", 2)), target = V(g("look", 0), g("look", 1), g("look", 2)), focus = V(g("focus", 0), g("focus", 1), g("focus", 2));
  if (shot !== "A") { const cy = carY(S); pos.y += cy; target.y += cy; focus.y += cy; }
  // lurch: one small decaying sway (not a flip-sign kick)
  if (shot === "A" && f >= T.LURCH) { const n = f - T.LURCH; const s = 0.012 * Math.exp(-n / 4) * Math.sin(n * 0.9); target.y += s; }
  if (shot === "A" && f >= T.LURCH) { const cy = carY(S); target.y += cy * 0.6; pos.y += cy * 0.45; focus.y += cy; }
  return { cam: { pos, target, fov: mono(keys, f, (k) => k.fov), blur: mono(keys, f, (k) => k.blur), focus }, shot };
}

// ------------------------------------------------------------------------------------------- blueprint callouts (printed on the cyanotype back wall)
(() => {
  if (CALLOUTS.length) return;
  const C = V(...B_POS), zw = SH.zb + 0.002;
  const onWall = (p: THREE.Vector3) => { const t = (zw - C.z) / (p.z - C.z); return C.clone().lerp(p, t); };
  const add = (text: string, part: THREE.Vector3, at: [number, number]) => { const w = onWall(part); CALLOUTS.push({ text, at, to: [w.x, w.y], size: 0.15 }); };
  add("SAFETY GEAR", V(GEAR.x - 0.02, GEAR.y + 0.3, 0.12), [0.62, 0.72]);
  add("HOIST ROPES ×4", V(0.04, 2.3, -0.02), [0.62, 2.62]);
  add("GUIDE RAIL", V(1.12, 2.4, 0.0), [0.62, 3.25]);
})();

// ------------------------------------------------------------------------------------------- Gus (story, on 2s)
const POSES: Record<string, Pose> = {
  idle: POSE0,
  look: { ...POSE0, neck: 0.1, headTilt: -0.18, sR: 0.3, eR: -0.4 },
  alarmed: { ...POSE0, lift: 0.0, lean: -0.05, neck: 0.06, headTilt: -0.12, sL: -2.3, eL: -0.9, wL: -0.3, sR: 2.2, eR: 1.0, wR: 0.3, hL: -0.18, kL: 0.12, fL: 0.1, hR: 0.2, kR: -0.15, fR: -0.1, tool: 0.5 },
  brace: { ...POSE0, lift: -0.05, lean: 0.04, neck: -0.04, headTilt: 0.04, sL: -1.2, eL: -1.3, wL: 0.2, sR: 1.3, eR: 1.4, wR: -0.2, hL: -0.32, kL: 0.5, fL: 0.12, hR: 0.32, kR: -0.5, fR: -0.12, tool: -0.4 },
  relieved: { ...POSE0, lift: -0.012, lean: 0.03, neck: 0.1, headTilt: 0.1, sL: -0.06, eL: 0.05, sR: 0.5, eR: 2.1, wR: 0.25, hL: -0.05, kL: 0.03, hR: 0.06, kR: -0.03, tool: 0 },
};
function gusAt(S: number): { pose: Pose; expr: Expr } {
  const s = Math.floor(S / 2) * 2, tc = s / FPS;
  let pose: Pose = { ...POSES.idle };
  let expr: Expr = { ...EXPR.calm, py: 0.008, px: 0.008 };
  const br = Math.sin(tc * 2.6);
  pose.lift = 0.004 * br; pose.sL += 0.03 * br; pose.sR -= 0.03 * br;
  if (s >= 104 && s <= 108) expr.lid = s === 106 ? 3 : 2;
  if (s >= T.CREAK) { pose = mixPose(pose, POSES.look, glide((s - T.CREAK) / 8)); expr = { ...expr, py: 0.018, px: 0.004, browL: 0.2, browR: -0.2 }; }
  if (s >= T.SNAP + 2) {
    const k = clamp01((s - T.SNAP - 2) / 6);
    const os = k < 1 ? glide(k) * 1.15 : 1 + 0.15 * Math.exp(-(s - T.SNAP - 8) / 3) * Math.cos((s - T.SNAP - 8) * 0.9);
    pose = mixPose(pose, POSES.alarmed, os);
    expr = s < T.SNAP + 4 ? { ...EXPR.alarmed, mouth: "o", lid: 0 } : { ...EXPR.alarmed };
  }
  if (s >= T.LURCH + 4) pose = mixPose(pose, POSES.brace, glide((s - T.LURCH - 4) / 8));
  if (s >= T.BITE) {
    const u = s - T.BITE;
    if (u > 10) pose = mixPose(POSES.brace, POSES.relieved, glide((u - 10) / 14));
    expr = u > 16 ? { ...EXPR.relieved } : u > 10 ? { ...EXPR.relieved, lid: 2, mouth: "o" } : { ...EXPR.alarmed, small: u < 5, mouth: "alarm" };
  }
  return { pose, expr };
}

// ------------------------------------------------------------------------------------------- per-frame state + transition plan
export type Plan = { a: Frame; b?: Frame; mode?: 0 | 1; L?: number; e0?: number; e1?: number; meter: { level: number; show: number }; flash: number; S: number; shot: string };
const UMAX = Math.hypot(0.5625, 1);
export function frameAt(f: number): Plan {
  const S = story(f);
  const { cam, shot } = camAt(f);
  const { pose, expr } = gusAt(S);
  const base = (look: Look): Frame => ({
    look, cam, pose, expr, yaw: 0.05,
    carY: carY(S), snap: (S - T.SNAP) / FPS, clamp: clampAt(S), clampT: S >= T.BITE ? (S - T.BITE) / FPS : -1, glow: glowAt(S),
    alarm: alarmAt(S), arrows: look === "xray" ? smooth(T.XRAY_IN[0], T.XRAY_IN[1], f) : 0, tags: glide((f - T.PEEL[1] + 4) / 10),
    cover: glide((f - T.COVER[0]) / (T.COVER[1] - T.COVER[0])),
    wall: spring((f - T.WALL[0]) / (T.WALL[1] - T.WALL[0])),
    side: spring((f - T.SIDE[0]) / (T.SIDE[1] - T.SIDE[0])),
    pop: spring((f - T.POP[0]) / (T.POP[1] - T.POP[0])),
    callouts: 1, opening: 1 - smooth(40, 74, f), gearLamp: f >= T.CUT1 && f < T.CUT2 ? smooth(170, 190, f) : 0,
  });
  const meter = { level: meterAt(f), show: glide((f - T.METER_IN[0]) / (T.METER_IN[1] - T.METER_IN[0])) };
  const flash = S >= T.BITE ? 0.9 * Math.exp(-(S - T.BITE) / 5) : 0;
  const p: Plan = { a: base("solid"), meter, flash, S, shot };
  if (f < T.PEEL[0]) p.a = base("blueprint");
  else if (f < T.PEEL[1]) { p.a = base("blueprint"); p.b = base("solid"); p.mode = 0; const R = 0.13; p.L = -0.02 + (UMAX + R + 0.08) * glide((f - T.PEEL[0]) / (T.PEEL[1] - T.PEEL[0])); }
  else if (f >= T.XRAY_IN[0] && f < T.XRAY_IN[1]) { p.a = base("xray"); p.b = base("solid"); p.mode = 1; p.e0 = -0.01; p.e1 = glide((f - T.XRAY_IN[0]) / (T.XRAY_IN[1] - T.XRAY_IN[0])) * 1.08; }
  else if (f >= T.XRAY_IN[1] && f < T.XRAY_OUT[0]) p.a = base("xray");
  else if (f >= T.XRAY_OUT[0] && f < T.XRAY_OUT[1]) { p.a = base("xray"); p.b = base("solid"); p.mode = 1; p.e1 = 1.01; p.e0 = glide((f - T.XRAY_OUT[0]) / (T.XRAY_OUT[1] - T.XRAY_OUT[0])) * 1.08; }
  return p;
}
export { SH };
