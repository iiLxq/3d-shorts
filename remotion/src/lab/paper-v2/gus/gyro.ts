// [gus lab] Camera-responsive body ("gyroscopic pivot"). Pure math, no scene access: runs in the browser and in node.
// The upper body (from the hips; feet stay planted) turns / leans by a fraction of the camera's angular change,
// filtered by a critically damped spring. The spring is evaluated as its impulse response (FIR over the camera
// track), so every frame is deterministic and can be rendered out of order:
//   w(k) ∝ k·e^(−k/τ),  τ = lag/2  →  mean delay = lag frames, step response 1 − (1 + t/τ)e^(−t/τ) (no overshoot).
export interface CamSample { az: number; el: number; pan: number; tilt: number }
export interface GyroOpts {
  gain: number;      // fraction of camera angular change (0.10–0.20)
  lag: number;       // mean spring delay, frames (8–12)
  yawLim: number; pitchLim: number; rollLim: number; // soft clamps (rad)
  rollGain: number;  // frames of orbit velocity turned into a bank (inertia), scaled by gain/0.15
  panShare: number;  // how much a pan/tilt (camera aiming off Gus) counts vs an orbit
}
export const GYRO_DEFAULT: GyroOpts = { gain: 0.15, lag: 10, yawLim: 12 * Math.PI / 180, pitchLim: 6 * Math.PI / 180, rollLim: 3.5 * Math.PI / 180, rollGain: 3, panShare: 0.5 };
export interface Lean { yaw: number; pitch: number; roll: number }

export const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Camera angles in Gus's root frame. pos/dir already in Gus space; pivot = chest height. */
export function camSample(pos: [number, number, number], dir: [number, number, number], pivotY = 1.2): CamSample {
  const rx = pos[0], ry = pos[1] - pivotY, rz = pos[2];
  const az = Math.atan2(rx, rz), h = Math.hypot(rx, rz), el = Math.atan2(ry, h);
  const toG = Math.atan2(-rx, -rz), dirAz = Math.atan2(dir[0], dir[2]);
  const pan = wrap(dirAz - toG);
  const tilt = Math.asin(Math.max(-1, Math.min(1, dir[1] / Math.hypot(dir[0], dir[1], dir[2])))) - Math.atan2(-ry, h);
  return { az, el, pan, tilt };
}

export function kernel(lag: number): number[] {
  const tau = lag / 2, K = Math.ceil(lag * 4), w: number[] = [];
  let sum = 0;
  for (let k = 0; k <= K; k++) { const v = k * Math.exp(-k / tau); w.push(v); sum += v; }
  return w.map((v) => v / sum);
}
const soft = (x: number, lim: number) => lim * Math.tanh(x / lim);

/** Target (unfiltered) response for one camera sample vs the reference (rest) sample. */
export function target(c: CamSample, prev: CamSample, ref: CamSample, o: GyroOpts): Lean {
  const dAz = wrap(c.az - ref.az), dEl = c.el - ref.el;
  return {
    yaw: o.gain * (dAz + o.panShare * wrap(c.pan - ref.pan)),
    pitch: -o.gain * (dEl + o.panShare * (c.tilt - ref.tilt)),
    roll: -o.rollGain * (o.gain / 0.15) * wrap(c.az - prev.az),
  };
}
/** Lean at the current frame from a sampler: at(k) = camera sample k frames ago (k ≥ 0). */
export function leanFromTrack(at: (k: number) => CamSample, ref: CamSample, o: GyroOpts = GYRO_DEFAULT): Lean {
  const w = kernel(o.lag);
  const out = { yaw: 0, pitch: 0, roll: 0 };
  for (let k = 0; k < w.length; k++) {
    if (!w[k]) continue;
    const t = target(at(k), at(k + 1), ref, o);
    out.yaw += w[k] * t.yaw; out.pitch += w[k] * t.pitch; out.roll += w[k] * t.roll;
  }
  return { yaw: soft(out.yaw, o.yawLim), pitch: soft(out.pitch, o.pitchLim), roll: soft(out.roll, o.rollLim) };
}
