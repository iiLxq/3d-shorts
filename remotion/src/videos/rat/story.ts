// Timeline for "The Plane's Secret Windmill". All times are VIDEO seconds from vo/words.json.
// Every value is a pure function of t (deterministic per frame).
import * as THREE from "three";
import { RAT_PIVOT, COCKPIT, YOKE_POS } from "./plane";

export const FPS = 30;
export const GEAR_H = 5.1;
export const END_CUT = 57.45; // white-flash cut from the present-day climb back into the opening blueprint // fuselage centre height above ground on its main gear
export const DURATION = 58.5;
export const FRAMES = Math.round(DURATION * FPS); // 1755

// ---------- easing ----------
export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const smooth = (x: number) => { x = clamp(x); return x * x * (3 - 2 * x); };
export const smoother = (x: number) => { x = clamp(x); return x * x * x * (x * (x * 6 - 15) + 10); };
export const easeIn = (x: number) => clamp(x) ** 2;
export const easeOut = (x: number) => 1 - (1 - clamp(x)) ** 2;
export const lin = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
export const bump = (t: number, a: number, b: number) => (t < a || t > b ? 0 : Math.sin(((t - a) / (b - a)) * Math.PI));
export const lerp = THREE.MathUtils.lerp;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const vl = (a: THREE.Vector3, b: THREE.Vector3, k: number) => a.clone().lerp(b, k);

// ---------- types ----------
export type Cam = { pos: THREE.Vector3; look: THREE.Vector3; fov: number; roll: number };
export type Label = { text: string; anchor: THREE.Vector3; x: number; y: number; color: "cyan" | "green" | "red"; a: number };
export type Look = "blueprint" | "xray" | "solid" | "sepia";
export type State = {
  t: number; shot: number; cam: Cam;
  scene: "plane" | "pinwheel";
  bg: "blueprint" | "xray" | "sky" | "sepia";
  lines: number;      // cyan blueprint lines 0..1
  fill: number;       // blueprint navy fill 0..1
  xray: number;       // x-ray shell 0..1
  printZ: number;     // SOLID visible where world z < printZ (-1e6 = none, 1e6 = all)
  inner: number;      // interior (hydraulics, cockpit, RAT bay) visibility 0..1
  sepia: number; flash: number; vignette: number;
  engines: number;    // 1 = running glow, 0 = dead
  hatch: number;      // 0 closed .. 1 open
  rat: number;        // 0 stowed .. 1 deployed (overshoot allowed)
  ratGlow: number;    // safety-green highlight
  propAng: number; propBlur: number;
  hydFill: number;    // fraction of hydraulic lines lit
  hydCol: "cyan" | "green" | "dim";
  hydPulse: number;
  arrows: number;     // red force arrows on the tail 0..1
  screens: number;    // screens on (0..6, fractional = flicker)
  yokeArrows: number; yokePull: number; hands: number;
  rock: number;       // shot 3: rock fall progress (-1 = hidden)
  glide: number;      // shot 4: glide triangle progress (-1 = hidden)
  speed: number;      // speed lines / cloud speed
  planePos: THREE.Vector3; planeRot: THREE.Euler;
  gear: number; noseGear: number; ground: "none" | "farm" | "runway"; groundY: number;
  sparks: number;     // landing sparks intensity
  meter: number; meterGreen: number; meterA: number;
  labels: Label[];
  stamp: number;      // 1983 stamp progress (-1 hidden)
  gauge: number;      // fuel gauge overlay (-1 hidden), else needle 0..1
  kg: number;         // LB->KG flip 0..1
  gliderGhost: number;
  pin: number;        // pinwheel spin speed 0..1
  freeze: boolean;
  ghost: number;      // blueprint shell see-through (shows the stowed RAT)
};

// ---------- key beats ----------
export const B = {
  die: 1.85, windmill: 3.24, rock: 7.44, glides: 8.28, ten: 9.42, down: 11.43, power: 13.92, dark: 15.39,
  hydraulic: 18.54, draining: 20.16, heavier: 22.10, heres: 22.97, pops: 25.16, propeller: 26.41,
  drops: 27.07, wind: 27.75, LOCK: 28.15, spins: 28.73, pump: 29.84, pushes: 30.47, back: 31.39,
  steering: 33.28, pinwheel: 34.54, speed: 37.23, y1983: 38.22, dry: 41.37, kilograms: 44.73,
  luckily: 45.64, glider: 47.07, unluckily: 48.09, race: 50.54, landed: 51.45, injuries: 53.11,
  plane: 53.95, years: 56.88,
};

// shot boundaries
export const SHOTS = [0, 2.4, 5.1, 8.1, 12.0, 14.6, 15.95, 19.8, 21.15, 22.9, 24.05, 26.0, 28.15, 28.65, 30.25, 33.2, 34.35, 37.95, 41.0, 43.45, 45.5, 47.95, 51.2, 53.65, 58.5];
export const shotAt = (t: number) => { let i = 0; while (i < SHOTS.length - 2 && t >= SHOTS[i + 1]) i++; return i; };

// ---------- mechanism timelines (story time s) ----------
const hatchAt = (s: number) => smoother(lin(s, B.pops - 0.05, B.pops + 0.22));
const ratAt = (s: number) => {
  // swing down from "drops" to LOCK, small overshoot + settle
  const k = lin(s, B.drops, B.LOCK);
  const base = easeIn(k) * 0.55 + smoother(k) * 0.45;
  const settle = s > B.LOCK ? 0.06 * Math.sin((s - B.LOCK) * 28) * Math.exp(-(s - B.LOCK) * 9) : 0;
  return base + settle;
};
const propAt = (s: number) => {
  // windmilling angle: slow before lock, spins up to ~11 rad/s (cap ~12 to avoid wagon-wheel)
  if (s < B.drops) return 0;
  const w0 = 1.5, w1 = 11;
  const ramp = (x: number) => (x < 0 ? 0 : x);
  const a = s - B.drops;
  const up = ramp(s - B.LOCK);
  return w0 * a + (w1 - w0) * (up - (1 - Math.exp(-up * 1.2)) / 1.2);
};

function meterAt(t: number) {
  const pts: [number, number][] = [[12.0, 0], [B.power, 0.25], [B.dark, 0.45], [B.draining, 0.65], [B.heavier, 0.9], [B.LOCK - 0.01, 0.97]];
  let m = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, va] = pts[i], [b, vb] = pts[i + 1];
    if (t >= a && t <= b) m = lerp(va, vb, smooth((t - a) / (b - a)));
  }
  if (t > B.LOCK - 0.01) m = 0.97;
  if (t >= B.LOCK) m = 0.97 * (1 - easeOut(lin(t, B.LOCK, B.LOCK + 0.18))) + 0.08 * easeOut(lin(t, B.LOCK, B.LOCK + 0.18));
  const green = t >= B.LOCK ? 1 : 0;
  const a = smooth(lin(t, 11.6, 12.4)) * (1 - smooth(lin(t, 30.2, 31.0)));
  return { m, green, a };
}

// ---------- cameras ----------
function orbitCam(look: THREE.Vector3, dist: number, yawDeg: number, pitchDeg: number, fov: number, roll = 0): Cam {
  const y = THREE.MathUtils.degToRad(yawDeg), p = THREE.MathUtils.degToRad(pitchDeg);
  const pos = V(Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p)).multiplyScalar(dist).add(look);
  return { pos, look: look.clone(), fov, roll };
}
function glideCam(a: Cam, b: Cam, k: number): Cam {
  return { pos: vl(a.pos, b.pos, k), look: vl(a.look, b.look, k), fov: lerp(a.fov, b.fov, k), roll: lerp(a.roll, b.roll, k) };
}
// every hold creeps: push toward look by `rate` fraction per frame
function creep(c: Cam, frames: number, rate = 0.0025): Cam {
  const k = 1 - Math.pow(1 - rate, frames);
  return { ...c, pos: vl(c.pos, c.look, k * 0.6) };
}

const CENTER = V(0, -0.5, 1);
// over-the-shoulder from the right seat onto the captain and yoke
const PILOT_CAM: Cam = { pos: V(0.95, COCKPIT.eyeY + 0.5, COCKPIT.z + 0.75), look: V(-0.5, COCKPIT.eyeY - 0.3, COCKPIT.z - 0.35), fov: 55, roll: 0 };
export function stateLanding(t: number) { const k = lin(t, 51.2, 53.4); const zz = lerp(-120, 15, 1 - (1 - k) * (1 - k)); return V(0, 0, -zz); }
export const OPEN_CAM = (t: number) => creep(orbitCam(V(0, -0.5, -7), 80, -30, -14, 40, 0.42), (t - 0) * FPS, 0.0045);

function camFor(shot: number, t: number): Cam {
  const f = (t - SHOTS[shot]) * FPS; // frames into shot
  const k = (t - SHOTS[shot]) / (SHOTS[shot + 1] - SHOTS[shot]);
  switch (shot) {
    case 0: return OPEN_CAM(t);
    case 1: return glideCam(orbitCam(V(0, -1.5, 2), 46, -48, -26, 40), orbitCam(RAT_PIVOT.clone().add(V(0, -0.3, 0.8)), 10.5, -55, -24, 40), smoother(k));
    case 2: return creep(orbitCam(V(-4, -6, -12), 82, -42, 2, 40), f);
    case 3: return creep(orbitCam(V(0, -24, -2), 170, 90, 2, 40), f, 0.0012);
    case 4: return glideCam(orbitCam(CENTER, 96, -146, 14, 40, -0.3), orbitCam(V(0, 0, -2), 80, -152, 12, 40, -0.3), smoother(k));
    case 5: return creep({ pos: V(0.0, COCKPIT.eyeY + 0.35, COCKPIT.z + 1.5), look: V(0, 0.05, COCKPIT.z - 0.8), fov: 50, roll: 0 }, f, 0.004);
    case 6: return glideCam(orbitCam(V(0, 0, -4), 64, -128, 30, 42), orbitCam(V(0, 1, 6), 56, -142, 26, 42), smoother(k));
    case 7: return creep(orbitCam(V(0, 3, 21), 26, -125, 12, 46), f);
    case 8: return creep(PILOT_CAM, f, 0.006);
    case 9: return glideCam(orbitCam(V(0, -1, 2), 38, -40, -20, 42), orbitCam(RAT_PIVOT.clone().add(V(0, -0.6, 0)), 9.5, -35, -22, 40), smoother(k));
    case 10: return creep(orbitCam(RAT_PIVOT.clone().add(V(0, -0.6, 0.6)), 14, 58, -20, 40), f);
    case 11: return glideCam(orbitCam(RAT_PIVOT.clone().add(V(0, -1.1, 0.6)), 7.5, 70, -10, 40), orbitCam(RAT_PIVOT.clone().add(V(0, -1.4, 0.2)), 6.2, 86, -6, 40), smoother(k));
    case 12: return creep(camFor(11, SHOTS[12] - 1e-3), f, 0.0035); // freeze-frame hold with a slow push
    case 13: return glideCam(orbitCam(RAT_PIVOT.clone().add(V(0, -1.4, 0)), 5.2, 30, -6, 40), orbitCam(RAT_PIVOT.clone().add(V(0, -1.5, 0)), 4.6, 50, -4, 40), smoother(k));
    case 14: return glideCam(orbitCam(V(0, 1, 2), 64, -138, 24, 42), orbitCam(V(0, 2, 12), 50, -155, 20, 44), smoother(k));
    case 15: return creep(PILOT_CAM, f, 0.004);
    case 16: return creep({ pos: V(2.7, 2.05, -1.7), look: V(0.85, 1.85, 0.05), fov: 42, roll: 0 }, f, 0.003);
    case 17: return creep(orbitCam(CENTER, 120, -55, -10, 36), f, 0.0015);
    case 18: return creep({ pos: V(0.0, COCKPIT.eyeY + 0.25, COCKPIT.z + 0.7), look: V(0, 0.1, COCKPIT.z - 0.8), fov: 50, roll: 0 }, f, 0.003);
    case 19: return creep({ pos: V(0.0, COCKPIT.eyeY + 0.25, COCKPIT.z + 0.7), look: V(0, 0.1, COCKPIT.z - 0.8), fov: 50, roll: 0 }, f, 0.004);
    case 20: return creep(PILOT_CAM, f, 0.003);
    case 21: return creep({ pos: V(6, 22, 70), look: V(0, -60, -320), fov: 42, roll: 0 }, f, 0.002);
    case 22: { const p = stateLanding(t); return { pos: V(-15, 2.6, -48), look: V(p.x, 3.6, p.z - 8), fov: 40, roll: 0 }; }
    case 23: {
      if (t < END_CUT) return creep(orbitCam(V(0, 0, -2), 120, -52, -6, 38, -0.22), f, 0.002);
      return glideCam(orbitCam(V(0, -0.5, -7), 96, -44, -10, 40, 0.42), OPEN_CAM(0), smoother(lin(t, END_CUT, 58.45)));
    }
  }
  return OPEN_CAM(t);
}

// ---------- labels ----------
function labelsFor(shot: number, t: number): Label[] {
  const a = (t0: number, t1: number) => smooth(lin(t, t0, t0 + 0.3)) * (1 - smooth(lin(t, t1 - 0.25, t1)));
  switch (shot) {
    case 0: return [{ text: "FL410 · 2 ENGINES", anchor: V(0, 2.6, -18), x: 120, y: 330, color: "cyan", a: a(0.15, 2.4) }];
    case 1: return [{ text: "RAT · STOWED", anchor: RAT_PIVOT.clone(), x: 140, y: 420, color: "cyan", a: a(2.9, 5.1) }];
    case 6: return [{ text: "HYDRAULICS · FLIGHT CONTROLS", anchor: V(0.3, -1.2, 4), x: 140, y: 360, color: "cyan", a: a(16.4, 19.8) }];
    case 7: return [{ text: "PRESSURE LOW", anchor: V(0, 6, 22.5), x: 160, y: 380, color: "red", a: a(20.3, 21.15) }];
    case 11: return [{ text: "RAT · DEPLOYED", anchor: RAT_PIVOT.clone().add(V(0, -1.9, 0)), x: 150, y: 400, color: "green", a: a(27.6, 28.65) }];
    case 14: return [{ text: "PRESSURE RESTORED", anchor: V(0, 6, 22.5), x: 160, y: 380, color: "green", a: a(31.4, 33.2) }];
  }
  return [];
}

// ---------- state ----------
export function stateAt(tVideo: number): State {
  const shot = shotAt(tVideo);
  // freeze (shot 12) and slow-mo replay (shot 13) remap story time
  let s = tVideo;
  let freeze = false;
  if (shot === 12) { s = B.LOCK; freeze = true; }
  if (shot === 13) s = B.drops + 0.55 + (tVideo - SHOTS[13]) * 0.62; // ~1.6x slow-mo replay of the swing + lock + spin-up
  const t = tVideo;

  const st: State = {
    t, shot, cam: camFor(shot, t), scene: "plane", bg: "blueprint",
    lines: 1, fill: 1, xray: 0, printZ: -1e6, inner: 0,
    sepia: 0, flash: 0, vignette: 0.85,
    engines: 1 - smooth(lin(t, B.die - 0.05, B.die + 0.5)) * (0.75 + 0.25 * Math.sin(t * 40)) * 1,
    hatch: hatchAt(s), rat: ratAt(s), ratGlow: s >= B.LOCK ? 1 : smooth(lin(s, B.drops, B.LOCK)) * 0.4,
    propAng: propAt(s), propBlur: smooth(lin(s, B.LOCK + 0.2, B.LOCK + 1.4)),
    hydFill: 0, hydCol: "cyan", hydPulse: bump(t, B.hydraulic - 0.1, B.hydraulic + 0.5), arrows: 0,
    screens: 6, yokeArrows: 0, yokePull: 0, hands: 0,
    rock: -1, glide: -1, speed: 1,
    planePos: V(0, 0, 0), planeRot: new THREE.Euler(0, 0, 0),
    gear: 0, noseGear: 0, ground: "none", groundY: -3000, sparks: 0,
    meter: 0, meterGreen: 0, meterA: 0, labels: labelsFor(shot, t),
    stamp: -1, gauge: -1, kg: 0, gliderGhost: 0, pin: 0, freeze, ghost: 0,
  };
  if (t > B.die + 0.5) st.engines = 0.12;

  // looks per section
  if (t < 12.0) { st.bg = "blueprint"; }
  else if (t < 22.9) {
    const x = smooth(lin(t, 12.6, B.power + 0.2));
    st.bg = x > 0.5 ? "xray" : "blueprint";
    st.lines = 1 - x * 0.85; st.fill = 1 - x; st.xray = x; st.inner = x;
  } else if (t < 37.95) {
    // print sweep nose->tail between "Here's" and ~24.0; interior fades
    st.bg = "sky";
    st.xray = 1 - smooth(lin(t, 22.9, 24.0));
    st.inner = Math.max(st.xray, t >= 30.25 && t < 33.2 ? 1 : 0);
    st.printZ = lerp(-30, 32, smoother(lin(t, B.heres, 24.0)));
    st.lines = 1; st.fill = 1;
    if (t >= 33.2 && t < 34.35) st.inner = 1;
  } else if (t < 53.65) {
    st.bg = "sepia"; st.sepia = 1; st.printZ = 1e6; st.lines = 0; st.fill = 0;
  } else {
    // present day (solid), then a white-flash cut back into the opening blueprint so the Short loops
    if (t < END_CUT) { st.bg = "sky"; st.printZ = 1e6; st.lines = 0; st.fill = 0; }
    else { st.bg = "blueprint"; st.printZ = -1e6; st.lines = 1; st.fill = 1; }
    st.engines = 1;
  }

  // shot specifics
  if (shot === 2) { st.rock = lin(t, 5.6, 8.0); st.planePos = V(0, 0, -(t - 5.1) * 5); }
  if (shot === 3) st.glide = lin(t, B.glides, B.down + 0.3);
  if (shot >= 4 && shot <= 9) { st.screens = 6 - 6 * lin(t, 14.85, B.dark); }
  if (shot >= 5 && shot <= 9) {
    st.hydFill = 1 - 0.85 * smooth(lin(t, B.draining, B.heavier));
    st.hydCol = t > B.draining + 0.6 ? "dim" : "cyan";
  }
  if (shot === 6 || shot === 7) st.hydFill = Math.min(st.hydFill, lin(t, 15.95, 18.9) + (t > B.draining ? 0 : 0));
  if (shot === 7) st.arrows = smooth(lin(t, B.draining, B.draining + 0.6));
  if (shot === 8) { st.hands = 1; st.yokeArrows = smooth(lin(t, 21.3, B.heavier + 0.2)); st.yokePull = smooth(lin(t, 21.3, 22.8)); st.cam.roll = THREE.MathUtils.degToRad(4.5) * smooth(lin(t, 21.2, 21.8)); st.hydFill = 0.1; st.hydCol = "dim"; st.screens = 0; }
  if (shot === 9) { st.hydFill = 0.1; st.hydCol = "dim"; }
  if (shot === 14) { st.bg = "xray"; st.printZ = -1e6; st.xray = 1; st.lines = 0.15; st.fill = 0; st.inner = 1; st.hydCol = "green"; st.hydFill = smooth(lin(t, B.pushes - 0.2, B.back + 0.2)); st.arrows = 0; }
  if (shot === 15) { st.hands = 1; st.yokePull = 1 - smooth(lin(t, B.steering, B.steering + 0.8)); st.screens = 0; st.hydCol = "green"; st.hydFill = 1; st.cam.roll = THREE.MathUtils.degToRad(4.5) * (1 - smooth(lin(t, B.steering, B.steering + 0.9))); }
  if (shot === 16) { st.scene = "pinwheel"; st.pin = smooth(lin(t, 34.4, B.speed)); }
  if (shot >= 9 && shot <= 15) st.speed = 1.6;

  // history
  if (shot === 17) { st.stamp = lin(t, B.y1983 - 0.05, B.y1983 + 0.25); st.flash = Math.max(0, 1 - (t - 37.95) / 0.35); st.ground = "farm"; st.planePos = V(0, 0, 0); st.engines = 0.12; }
  if (shot === 18) { st.gauge = 1 - smooth(lin(t, 41.0, B.dry + 0.1)); st.engines = 0.12; }
  if (shot === 19) { st.gauge = 0; st.kg = smooth(lin(t, B.kilograms - 0.1, B.kilograms + 0.15)); }
  if (shot === 20) { st.hands = 1; st.gliderGhost = smooth(lin(t, B.glider - 0.2, B.glider + 0.4)) * (1 - smooth(lin(t, 47.6, 47.95))); }
  if (shot === 21) { st.ground = "runway"; st.groundY = -lerp(260, 120, lin(t, 47.95, 51.2)); st.planePos = V(0, 0, 0); }
  if (shot === 22) {
    st.ground = "runway"; st.gear = 1; st.noseGear = 0;
    const k = lin(t, 51.2, 53.4);
    st.groundY = 0;
    const zz = -stateLanding(t).z; void k; // decelerating along the runway (-Z = forward)
    const touched = t > 51.55;
    st.planePos = V(0, touched ? GEAR_H : lerp(GEAR_H + 6, GEAR_H, smooth(lin(t, 51.2, 51.55))), -zz);
    st.planeRot = new THREE.Euler(0.06, 0, 0); // nose up on the flare
    if (touched) { const d = smooth(lin(t, 51.6, 52.0)); st.planePos.y = GEAR_H - 0.9 * d; st.planeRot = new THREE.Euler(lerp(0.06, -0.085, d), 0, 0); }
    st.sparks = touched ? 1 - smooth(lin(t, 52.6, 53.6)) : 0;
    st.engines = 0.12;
  }
  if (shot >= 23) { st.rat = 0; st.hatch = 0; st.ratGlow = 0; st.propBlur = 0; }
  if (shot === 5 || shot === 8 || shot === 15) st.inner = 0;
  if (shot === 1) st.ghost = 1;
  if (shot === 23) {
    st.flash = Math.max(0, 1 - (t - 53.65) / 0.3);
    if (t < END_CUT) { st.planeRot = new THREE.Euler(0.1, 0, 0); st.planePos = V(0, 0, 0); }
    else st.flash = Math.max(0, 0.9 * (1 - (t - END_CUT) / 0.22));
  }
  if (shot === 0) st.planePos = V(0, 0.35 * Math.sin(t * 2.6), 0); // gentle bob: first frames already move (0 at t=0, so the loop still matches)

  const m = meterAt(t); st.meter = m.m; st.meterGreen = m.green; st.meterA = m.a;
  if (shot === 0 && t < 0.4) st.flash = 0;
  return st;
}
