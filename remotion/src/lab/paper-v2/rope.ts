// Paper-cord hoist ropes: deterministic verlet chains. Every frame re-simulates from the snap (pure function of
// story time), so stills, out-of-order renders and the slow-mo replay all agree.
//   upper piece: hangs from the top sheave, recoils up (released stretch), overshoots slack, falls back and swings.
//   lower piece: hangs from the car hitch, whips down, folds over the crosshead and drapes on the car top.
import * as THREE from "three";

export type V3 = [number, number, number];
export interface Collider { kind: "plane" | "box" | "capsule"; a: V3; b?: V3; r?: number }
export interface RopeSpec {
  x: number; z: number;          // rope line
  top: number;                   // sheave anchor y (world)
  hitch: number;                 // hitch y on the car (car-local)
  breakY: number;                // world y of the break at the snap
  seed: number;
}
const SEG = 0.055, SUB = 8, ITER = 10, G = -9.8;

function rng(seed: number) { let a = seed >>> 0 || 1; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; }

interface Chain { p: Float64Array; q: Float64Array; n: number; pinned: (i: number) => V3 | null }

function makeChain(a: V3, b: V3): Chain {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const n = Math.max(3, Math.round(len / SEG) + 1);
  const p = new Float64Array(n * 3), q = new Float64Array(n * 3);
  for (let i = 0; i < n; i++) { const t = i / (n - 1); for (let k = 0; k < 3; k++) p[i * 3 + k] = q[i * 3 + k] = a[k] + (b[k] - a[k]) * t; }
  return { p, q, n, pinned: () => null };
}

/** state of one rope at `ts` seconds after the snap (ts < 0 = intact). carY(t) = car offset at t seconds after snap. */
export function ropeState(spec: RopeSpec, ts: number, carYAt: (t: number) => number, colliders: (t: number) => Collider[]): { intact: boolean; upper: THREE.Vector3[]; lower: THREE.Vector3[] } {
  const hitchW = (t: number): V3 => [spec.x, spec.hitch + carYAt(t), spec.z];
  if (ts < 0) {
    const h = hitchW(0);
    return { intact: true, upper: [new THREE.Vector3(spec.x, spec.top, spec.z), new THREE.Vector3(...h)], lower: [] };
  }
  const r = rng(spec.seed);
  const top: V3 = [spec.x, spec.top, spec.z];
  const up = makeChain(top, [spec.x, spec.breakY, spec.z]);          // index 0 pinned at the sheave
  const lo = makeChain(hitchW(0), [spec.x, spec.breakY, spec.z]);    // index 0 pinned at the hitch
  const dt = 1 / 30 / SUB;
  // released stretch: each point's initial velocity grows toward the free end (recoil), plus a lateral whip
  const kick = (c: Chain, dir: number, speed: number, lat: number) => {
    const wx = (r() - 0.5) * 2 * lat, wz = (r() - 0.3) * 2 * lat;
    for (let i = 1; i < c.n; i++) {
      const u = i / (c.n - 1), j = i * 3;
      const s = speed * u * u;
      c.q[j] = c.p[j] - (wx * u * u * u) * dt;
      c.q[j + 1] = c.p[j + 1] - dir * s * dt;
      c.q[j + 2] = c.p[j + 2] - (wz * u * u * u) * dt;
    }
  };
  kick(up, +1, 5.5 + r() * 1.5, 1.4);
  kick(lo, -1, 2.2 + r() * 0.8, 1.8);
  const steps = Math.max(0, ts * 30 * SUB);
  const nFull = Math.floor(steps);
  const restUp = SEG * 1.0, restLo = SEG * 1.0;
  let prevUp: Float64Array | null = null, prevLo: Float64Array | null = null;
  const step = (k: number) => {
    const t = (k + 1) * dt;
    const cols = colliders(t);
    const h = hitchW(t);
    for (const [c, rest, pin] of [[up, restUp, top], [lo, restLo, h]] as [Chain, number, V3][]) {
      const P = c.p, Q = c.q;
      for (let i = 1; i < c.n; i++) {
        const j = i * 3;
        for (let a = 0; a < 3; a++) {
          const v = (P[j + a] - Q[j + a]) * (c === up ? 0.992 : 0.986);
          Q[j + a] = P[j + a];
          P[j + a] += v + (a === 1 ? G * dt * dt : 0);
        }
      }
      P[0] = pin[0]; P[1] = pin[1]; P[2] = pin[2];
      for (let it = 0; it < ITER; it++) {
        for (let i = 0; i < c.n - 1; i++) {
          const a = i * 3, b = a + 3;
          const dx = P[b] - P[a], dy = P[b + 1] - P[a + 1], dz = P[b + 2] - P[a + 2];
          const d = Math.hypot(dx, dy, dz) || 1e-9, diff = (d - rest) / d;
          const wa = i === 0 ? 0 : 0.5, wb = i === 0 ? 1 : 0.5;
          P[a] += dx * diff * wa; P[a + 1] += dy * diff * wa; P[a + 2] += dz * diff * wa;
          P[b] -= dx * diff * wb; P[b + 1] -= dy * diff * wb; P[b + 2] -= dz * diff * wb;
        }
        // paper cord bending stiffness (i, i+2), weak
        for (let i = 0; i < c.n - 2; i++) {
          const a = i * 3, b = a + 6;
          const dx = P[b] - P[a], dy = P[b + 1] - P[a + 1], dz = P[b + 2] - P[a + 2];
          const d = Math.hypot(dx, dy, dz) || 1e-9;
          if (d >= rest * 1.7) continue;
          const diff = ((d - rest * 1.7) / d) * 0.12;
          const wa = i === 0 ? 0 : 0.5, wb = i === 0 ? 1 : 0.5;
          P[a] += dx * diff * wa; P[a + 1] += dy * diff * wa; P[a + 2] += dz * diff * wa;
          P[b] -= dx * diff * wb; P[b + 1] -= dy * diff * wb; P[b + 2] -= dz * diff * wb;
        }
        if (c === lo) for (let i = 1; i < c.n; i++) collide(P, i * 3, cols);
        else for (let i = 1; i < c.n; i++) { const j = i * 3; P[j] = Math.max(-1.22, Math.min(1.22, P[j])); P[j + 2] = Math.max(-1.08, Math.min(1.2, P[j + 2])); }
        P[0] = pin[0]; P[1] = pin[1]; P[2] = pin[2];
      }
      // friction on contact: kill tangential velocity of lower points resting on something
      if (c === lo) for (let i = 1; i < c.n; i++) { const j = i * 3; if (touching(P, j, cols)) { for (let a = 0; a < 3; a++) Q[j + a] = P[j + a] - (P[j + a] - Q[j + a]) * 0.35; } }
    }
  };
  for (let k = 0; k < nFull; k++) step(k);
  const frac = steps - nFull;
  if (frac > 1e-6) { prevUp = up.p.slice(); prevLo = lo.p.slice(); step(nFull); }
  const out = (c: Chain, prev: Float64Array | null) => {
    const v: THREE.Vector3[] = [];
    for (let i = 0; i < c.n; i++) {
      const j = i * 3;
      if (prev) v.push(new THREE.Vector3(prev[j] + (c.p[j] - prev[j]) * frac, prev[j + 1] + (c.p[j + 1] - prev[j + 1]) * frac, prev[j + 2] + (c.p[j + 2] - prev[j + 2]) * frac));
      else v.push(new THREE.Vector3(c.p[j], c.p[j + 1], c.p[j + 2]));
    }
    return v;
  };
  return { intact: false, upper: out(up, prevUp), lower: out(lo, prevLo) };
}

const RAD = 0.024;
function collide(P: Float64Array, j: number, cols: Collider[]) {
  for (const c of cols) {
    if (c.kind === "plane") { // horizontal floor at a[1] within x/z extents b
      const [x0, y, z0] = c.a, [x1, , z1] = c.b!;
      if (P[j] > x0 && P[j] < x1 && P[j + 2] > z0 && P[j + 2] < z1 && P[j + 1] < y + RAD && P[j + 1] > y - 0.3) P[j + 1] = y + RAD;
    } else if (c.kind === "box") {
      const a = c.a, b = c.b!;
      const x = P[j], y = P[j + 1], z = P[j + 2];
      if (x > a[0] - RAD && x < b[0] + RAD && y > a[1] - RAD && y < b[1] + RAD && z > a[2] - RAD && z < b[2] + RAD) {
        // push out along the smallest penetration axis
        const d = [x - (a[0] - RAD), b[0] + RAD - x, y - (a[1] - RAD), b[1] + RAD - y, z - (a[2] - RAD), b[2] + RAD - z];
        let m = 0; for (let k = 1; k < 6; k++) if (d[k] < d[m]) m = k;
        if (m === 0) P[j] = a[0] - RAD; else if (m === 1) P[j] = b[0] + RAD; else if (m === 2) P[j + 1] = a[1] - RAD; else if (m === 3) P[j + 1] = b[1] + RAD; else if (m === 4) P[j + 2] = a[2] - RAD; else P[j + 2] = b[2] + RAD;
      }
    } else { // vertical capsule: a = base centre, b[1] = top y, r
      const a = c.a, r = c.r! + RAD;
      if (P[j + 1] < a[1] || P[j + 1] > c.b![1]) continue;
      const dx = P[j] - a[0], dz = P[j + 2] - a[2], d = Math.hypot(dx, dz);
      if (d < r && d > 1e-6) { P[j] = a[0] + dx / d * r; P[j + 2] = a[2] + dz / d * r; }
    }
  }
}
function touching(P: Float64Array, j: number, cols: Collider[]) {
  for (const c of cols) {
    if (c.kind === "plane" && Math.abs(P[j + 1] - (c.a[1] + RAD)) < 0.004 && P[j] > c.a[0] && P[j] < c.b![0] && P[j + 2] > c.a[2] && P[j + 2] < c.b![2]) return true;
    if (c.kind === "box" && Math.abs(P[j + 1] - (c.b![1] + RAD)) < 0.004 && P[j] > c.a[0] && P[j] < c.b![0] && P[j + 2] > c.a[2] && P[j + 2] < c.b![2]) return true;
  }
  return false;
}
