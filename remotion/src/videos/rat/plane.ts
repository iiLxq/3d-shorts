// Procedural wide-body twinjet (generic, no livery/branding), built in meters.
// Axes: nose toward -Z, Y up, right wing toward +X. Origin = fuselage centre at the wing root.
import * as THREE from "three";

export type Part = {
  name: string;
  geo: THREE.BufferGeometry;
  role: "shell" | "wing" | "tail" | "engine" | "inner" | "rat" | "hatch" | "hyd" | "cockpit";
  color: THREE.ColorRepresentation; // SOLID albedo
};

const L = 48.5; // length
const R = 2.52; // fuselage radius
export const NOSE_Z = -L * 0.5 + 1.5;
export const TAIL_Z = L * 0.5 + 1.5;

// ---------- fuselage: rings along Z with radius r(z) and centre-line y(z) ----------
function fuselageProfile(u: number) {
  // u 0 = nose tip, 1 = tail tip
  const z = THREE.MathUtils.lerp(NOSE_Z, TAIL_Z, u);
  let r = R, y = 0;
  if (u < 0.12) {
    const k = u / 0.12; // nose: ellipsoid cap, slightly drooped
    r = R * Math.sqrt(1 - (1 - k) * (1 - k));
    y = -0.35 * (1 - k);
  } else if (u > 0.74) {
    const k = (u - 0.74) / 0.26; // tail cone tapers and rises
    r = R * (1 - 0.86 * Math.pow(k, 1.15));
    y = 1.55 * Math.pow(k, 1.4);
  }
  return { z, r, y };
}

export function fuselage(): THREE.BufferGeometry {
  const NU = 96, NV = 40;
  const pos: number[] = [], idx: number[] = [];
  for (let i = 0; i <= NU; i++) {
    const u = i / NU;
    const { z, r, y } = fuselageProfile(u);
    for (let j = 0; j <= NV; j++) {
      const a = (j / NV) * Math.PI * 2;
      // slightly taller than wide; flatter belly
      const sx = Math.cos(a) * r;
      let sy = Math.sin(a) * r * 1.04;
      if (sy < 0) sy *= 0.94;
      pos.push(sx, sy + y, z);
    }
  }
  for (let i = 0; i < NU; i++)
    for (let j = 0; j < NV; j++) {
      const a = i * (NV + 1) + j, b = a + NV + 1;
      // windscreen opening: skip quads in the upper front of the nose
      const zc = pos[a * 3 + 2], yc = pos[a * 3 + 1], xc = pos[a * 3];
      if (zc > -21.7 && zc < -20.1 && yc > 0.45 && Math.abs(xc) < 1.35) continue;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ---------- lifting surfaces: loft of airfoil sections ----------
type Sec = { le: THREE.Vector3; chord: number; t: number; twistUp?: number };
function airfoil(n = 14) {
  // closed airfoil outline in (x along chord 0..1, y thickness), NACA-ish
  const top: [number, number][] = [], bot: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const x = 0.5 - 0.5 * Math.cos((i / n) * Math.PI);
    const yt = 5 * 0.12 * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
    top.push([x, yt]); bot.push([x, -yt * 0.7]);
  }
  return [...top, ...bot.reverse().slice(1, -1)];
}
const AF = airfoil();

// vertical=false: span along X, thickness along Y. vertical=true: span along Y, thickness along X.
function loft(secs: Sec[], vertical = false): THREE.BufferGeometry {
  const pos: number[] = [], idx: number[] = [];
  const M = AF.length;
  secs.forEach((s) => {
    for (const [x, y] of AF) {
      const cz = s.le.z + x * s.chord;
      const th = y * s.t * s.chord;
      if (!vertical) pos.push(s.le.x, s.le.y + th + (s.twistUp ?? 0) * x, cz);
      else pos.push(s.le.x + th, s.le.y, cz);
    }
  });
  for (let k = 0; k < secs.length - 1; k++)
    for (let i = 0; i < M; i++) {
      const a = k * M + i, b = k * M + ((i + 1) % M), c = a + M, d = b + M;
      idx.push(a, c, b, b, c, d);
    }
  // tip cap (fan)
  const base = (secs.length - 1) * M;
  for (let i = 1; i < M - 1; i++) idx.push(base, base + i, base + i + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const ng = g.toNonIndexed();
  ng.computeVertexNormals();
  return ng;
}

function mirrorX(g: THREE.BufferGeometry) {
  const m = g.clone();
  m.applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1));
  // fix winding
  const p = m.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i += 3) {
    const ax = p.getX(i + 1), ay = p.getY(i + 1), az = p.getZ(i + 1);
    p.setXYZ(i + 1, p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2));
    p.setXYZ(i + 2, ax, ay, az);
  }
  m.computeVertexNormals();
  return m;
}

const SWEEP = Math.tan(THREE.MathUtils.degToRad(31.5));
const DIH = Math.tan(THREE.MathUtils.degToRad(6));
export function wingRight() {
  const rootLE = new THREE.Vector3(1.6, -1.55, -5.2);
  const sec = (x: number, chord: number, t: number): Sec => ({
    le: new THREE.Vector3(x, rootLE.y + (x - rootLE.x) * DIH, rootLE.z + (x - rootLE.x) * SWEEP),
    chord, t,
  });
  return loft([sec(1.6, 10.2, 1.0), sec(8.6, 6.4, 0.9), sec(23.8, 2.2, 0.75)]);
}
export function hstabRight() {
  const y = 1.15, z0 = 18.6;
  const s = Math.tan(THREE.MathUtils.degToRad(34));
  return loft([
    { le: new THREE.Vector3(0.6, y, z0), chord: 5.6, t: 0.8 },
    { le: new THREE.Vector3(9.3, y + 9.3 * 0.12, z0 + 8.7 * s), chord: 1.9, t: 0.7 },
  ]);
}
export function vstab() {
  const z0 = 16.8, s = Math.tan(THREE.MathUtils.degToRad(40));
  return loft([
    { le: new THREE.Vector3(0, 2.2, z0), chord: 8.2, t: 0.8 },
    { le: new THREE.Vector3(0, 11.8, z0 + 9.6 * s), chord: 2.9, t: 0.7 },
  ], true);
}

// ---------- engines ----------
export const ENGINE_X = 7.9;
export function nacelle(x: number) {
  const pts: THREE.Vector2[] = [];
  const N = 24;
  for (let i = 0; i <= N; i++) {
    const u = i / N; // along length
    const r = 1.32 * (u < 0.08 ? 0.86 + 1.75 * u : 1 - 0.32 * Math.pow(Math.max(0, u - 0.45) / 0.55, 1.6));
    pts.push(new THREE.Vector2(r, u * 6.4));
  }
  const g = new THREE.LatheGeometry(pts, 36);
  g.rotateX(Math.PI / 2);
  const y = -1.55 + (x - 1.6) * DIH - 1.75;
  const z = -5.2 + (x - 1.6) * SWEEP - 4.4;
  g.translate(x, y, z);
  return g;
}
export function pylon(x: number) {
  const y = -1.55 + (x - 1.6) * DIH;
  const g = new THREE.BoxGeometry(0.35, 1.3, 6.2);
  g.translate(x, y - 0.75, -5.2 + (x - 1.6) * SWEEP - 1.6);
  return g;
}
export function engineFace(x: number) {
  // front fan disc (shows on solid, dark)
  const g = new THREE.CircleGeometry(1.12, 32);
  g.rotateY(Math.PI);
  const y = -1.55 + (x - 1.6) * DIH - 1.75;
  g.translate(x, y, -5.2 + (x - 1.6) * SWEEP - 4.4 + 0.05);
  return g;
}

// ---------- wing-to-body fairing + belly ----------
export function fairing() {
  const g = new THREE.SphereGeometry(1, 32, 16);
  g.scale(2.7, 1.25, 12.5);
  g.translate(0, -2.0, 0.6);
  return g;
}

// ---------- RAT (ram air turbine) ----------
// Bay under the right side of the belly fairing, aft of the wing.
export const RAT_PIVOT = new THREE.Vector3(1.35, -2.75, 5.6);
export const RAT_STRUT = 1.9;
export function ratParts() {
  // built at origin, strut pointing along -Y (deployed). Group is rotated about X at RAT_PIVOT.
  const strut = new THREE.CylinderGeometry(0.11, 0.14, RAT_STRUT, 14);
  strut.translate(0, -RAT_STRUT / 2, 0);
  const hub = new THREE.SphereGeometry(0.26, 20, 14);
  hub.scale(1, 1, 1.6);
  hub.translate(0, -RAT_STRUT, -0.18);
  const gen = new THREE.CylinderGeometry(0.22, 0.22, 0.75, 18);
  gen.rotateX(Math.PI / 2);
  gen.translate(0, -RAT_STRUT, 0.25);
  return { strut, hub, gen };
}
export function ratBlades() {
  // two blades around Z axis, at origin (spun, then placed at the hub)
  const b = new THREE.BoxGeometry(0.15, 0.68, 0.035);
  b.translate(0, 0.46, 0);
  b.rotateY(0.35);
  const b2 = b.clone();
  b2.rotateZ(Math.PI);
  const g = new THREE.BufferGeometry();
  const merged = mergeSimple([b, b2]);
  g.copy(merged);
  return g;
}
export function hatchDoor() {
  const g = new THREE.BoxGeometry(0.85, 0.05, 2.3);
  g.translate(0.42, 0, 1.15); // hinge along its inner (x=0) edge, starting at pivot z
  return g;
}

// ---------- hydraulic lines (inside the fuselage) ----------
export function hydraulicPaths(): THREE.Vector3[][] {
  const y = -1.2;
  return [
    // cockpit -> main line along the belly -> up into the tail -> rudder/elevators
    [new THREE.Vector3(0, -0.4, -20.6), new THREE.Vector3(0.3, y, -14), new THREE.Vector3(0.3, y, 4),
     new THREE.Vector3(0.3, -0.6, 14), new THREE.Vector3(0.2, 1.4, 19.5), new THREE.Vector3(0, 6.0, 22.5)],
    [new THREE.Vector3(0.3, -0.6, 14), new THREE.Vector3(2.5, 1.3, 20.6), new THREE.Vector3(7.0, 2.2, 24.6)],
    [new THREE.Vector3(0.3, -0.6, 14), new THREE.Vector3(-2.5, 1.3, 20.6), new THREE.Vector3(-7.0, 2.2, 24.6)],
    // RAT pump -> centre system junction
    [new THREE.Vector3(RAT_PIVOT.x, RAT_PIVOT.y + 0.2, RAT_PIVOT.z), new THREE.Vector3(0.9, -1.6, 5.0), new THREE.Vector3(0.3, y, 4)],
    // out to the wings (ailerons)
    [new THREE.Vector3(0.3, y, 0), new THREE.Vector3(6, -1.0, 4.2), new THREE.Vector3(18, 0.1, 13.2)],
    [new THREE.Vector3(0.3, y, 0), new THREE.Vector3(-6, -1.0, 4.2), new THREE.Vector3(-18, 0.1, 13.2)],
  ];
}

// ---------- cockpit interior (simplified, readable from inside) ----------
export const COCKPIT = { z: -19.8, eyeY: 0.55 };
export function cockpitParts() {
  const panel = new THREE.BoxGeometry(2.6, 0.75, 0.5);
  panel.translate(0, 0.0, COCKPIT.z - 1.05);
  const glare = new THREE.BoxGeometry(2.6, 0.12, 0.6);
  glare.translate(0, 0.42, COCKPIT.z - 1.1);
  const screens: THREE.BufferGeometry[] = [];
  const xs = [-1.0, -0.55, -0.12, 0.12, 0.55, 1.0];
  xs.forEach((x) => {
    const s = new THREE.PlaneGeometry(0.36, 0.3);
    s.translate(x, 0.05, COCKPIT.z - 0.79);
    screens.push(s);
  });
  return { panel, glare, screens, xs };
}
export const YOKE_POS = new THREE.Vector3(-0.55, -0.18, COCKPIT.z - 0.45);
export function yokeGeo() {
  const col = new THREE.CylinderGeometry(0.035, 0.045, 0.6, 10);
  col.translate(0, -0.3, 0);
  const bar = new THREE.TorusGeometry(0.17, 0.025, 8, 24, Math.PI);
  bar.rotateZ(Math.PI);
  bar.translate(0, 0.02, 0);
  return mergeSimple([col, bar]);
}

// ---------- tiny merge helper (non-indexed, positions + normals) ----------
export function mergeSimple(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const ps: number[] = [], ns: number[] = [];
  geos.forEach((g0) => {
    const g = g0.index ? g0.toNonIndexed() : g0;
    if (!g.getAttribute("normal")) g.computeVertexNormals();
    ps.push(...(g.getAttribute("position").array as Float32Array));
    ns.push(...(g.getAttribute("normal").array as Float32Array));
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(ps, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(ns, 3));
  return out;
}

export function buildPlane(): Part[] {
  const wr = wingRight();
  const hr = hstabRight();
  return [
    { name: "fuselage", geo: fuselage(), role: "shell", color: "#eef1f5" },
    { name: "fairing", geo: fairing(), role: "shell", color: "#c9ced6" },
    { name: "wingR", geo: wr, role: "wing", color: "#d5d9df" },
    { name: "wingL", geo: mirrorX(wr), role: "wing", color: "#d5d9df" },
    { name: "hstabR", geo: hr, role: "tail", color: "#d5d9df" },
    { name: "hstabL", geo: mirrorX(hr), role: "tail", color: "#d5d9df" },
    { name: "vstab", geo: vstab(), role: "tail", color: "#e6e9ee" },
    { name: "nacR", geo: nacelle(ENGINE_X), role: "engine", color: "#b9bfc8" },
    { name: "nacL", geo: nacelle(-ENGINE_X), role: "engine", color: "#b9bfc8" },
    { name: "pylR", geo: pylon(ENGINE_X), role: "engine", color: "#aab0b9" },
    { name: "pylL", geo: pylon(-ENGINE_X), role: "engine", color: "#aab0b9" },
  ];
}
