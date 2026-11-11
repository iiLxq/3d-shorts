// [gus lab] Camera paths for the gyro test (pure: used by LabRoot and by the node plot script).
import { camSample, CamSample } from "./gyro";
export interface CamPose { pos: [number, number, number]; dir: [number, number, number]; fov: number }
export interface GyroTest { name: string; at: (k: number) => CamPose }
const sst = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
const D = Math.PI / 180;
export function orbitPose(target: [number, number, number], az: number, el: number, dist: number, pan = 0, tilt = 0, fov = 28): CamPose {
  const a = az * D, e = el * D;
  const pos: [number, number, number] = [target[0] + Math.sin(a) * Math.cos(e) * dist, target[1] + Math.sin(e) * dist, target[2] + Math.cos(a) * Math.cos(e) * dist];
  let dx = target[0] - pos[0], dy = target[1] - pos[1], dz = target[2] - pos[2];
  const n = Math.hypot(dx, dy, dz); dx /= n; dy /= n; dz /= n;
  // pan (yaw about world up) then tilt (pitch)
  let yaw = Math.atan2(dx, dz) + pan * D, pitch = Math.asin(dy) + tilt * D;
  return { pos, dir: [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)], fov };
}
const u = (k: number) => sst((k - 6) / 40); // 6 f hold, 40 f move, 14 f settle
export const GYRO_TESTS: GyroTest[] = [
  { name: "pan", at: (k) => orbitPose([0, 1.15, 0], 12, 3, 4.6, -3 + 6 * u(k), 0) },
  { name: "tilt", at: (k) => orbitPose([0, 1.1, 0], 12, -2 + 28 * u(k), 4.6) },
  { name: "orbit", at: (k) => orbitPose([0, 1.1, 0], -32 + 64 * u(k), 4, 4.6) },
];
export const sampleOf = (p: CamPose): CamSample => camSample(p.pos, p.dir, 1.2);
