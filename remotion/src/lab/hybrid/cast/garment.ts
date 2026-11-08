// [hybrid/cast] Garment geometry + skinning helpers (polish pass v2).
// - loft(): a garment/limb body as a stack of superellipse cross-sections (front/back depth, squareness, offsets),
//   interpolated with a cardinal spline, so a jacket can be boxier than the body, a sleeve can bunch at the elbow and
//   flare into a rolled cuff, trousers can be baggy with a hem over the boot. Surface queries (at/frame/band/ribbon)
//   place pockets, tape, seams and straps exactly on the cloth.
// - skinned(): binds a geometry (in a joint's rest frame or root space) to the character skeleton with smooth
//   per-vertex weights, so sleeves and trouser legs bend as one piece of fabric (no ball joints, no tube segments),
//   plus a per-vertex fold attribute (aFold) the cloth shader turns into painted fold strokes that deepen with bends.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type Sec = {
  y: number;      // height of the section (m, along the part axis)
  rx: number;     // half width
  rzF: number;    // front depth (+z)
  rzB?: number;   // back depth (-z), defaults to rzF
  e?: number;     // squareness exponent (1 = ellipse, 0.5 = boxy)
  cx?: number; cz?: number; // section centre offset
};

const KEYS = ["rx", "rzF", "rzB", "e", "cx", "cz"] as const;
type K = (typeof KEYS)[number];
const val = (s: Sec, k: K) => (k === "rzB" ? s.rzB ?? s.rzF : k === "e" ? s.e ?? 1 : k === "cx" ? s.cx ?? 0 : k === "cz" ? s.cz ?? 0 : s[k]);

export type LoftDisp = (y: number, a: number) => number; // radial offset (m) at (height, angle)
export class Loft {
  secs: Sec[]; y0: number; y1: number; disp?: LoftDisp;
  constructor(secs: Sec[], disp?: LoftDisp) {
    this.secs = [...secs].sort((p, q) => p.y - q.y);
    this.y0 = this.secs[0].y; this.y1 = this.secs[this.secs.length - 1].y; this.disp = disp;
  }
  /** interpolated section parameters at height y (cardinal spline over non-uniform y, clamped) */
  sec(y: number): Required<Sec> {
    const S = this.secs, n = S.length;
    const yy = Math.min(this.y1, Math.max(this.y0, y));
    let i = 0; while (i < n - 2 && yy > S[i + 1].y) i++;
    const a = S[i], b = S[i + 1], h = Math.max(1e-6, b.y - a.y), t = (yy - a.y) / h;
    const pm = S[Math.max(0, i - 1)], pn = S[Math.min(n - 1, i + 2)];
    const o = { y } as Required<Sec>;
    for (const k of KEYS) {
      const p0 = val(a, k), p1 = val(b, k);
      const m0 = i > 0 ? ((p1 - val(pm, k)) / Math.max(1e-6, b.y - pm.y)) * h * 0.8 : 0;
      const m1 = i < n - 2 ? ((val(pn, k) - p0) / Math.max(1e-6, pn.y - a.y)) * h * 0.8 : 0;
      const t2 = t * t, t3 = t2 * t;
      (o as Record<string, number>)[k] = (2 * t3 - 3 * t2 + 1) * p0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * p1 + (t3 - t2) * m1;
    }
    return o;
  }
  /** surface point at height y and angle a (0 = front +z, +pi/2 = +x side) */
  at(y: number, a: number, out = new THREE.Vector3()) {
    const s = this.sec(y), sa = Math.sin(a), ca = Math.cos(a), e = Math.max(0.2, s.e);
    const x = Math.sign(sa) * Math.pow(Math.abs(sa), e) * Math.max(0, s.rx);
    const z = Math.sign(ca) * Math.pow(Math.abs(ca), e) * Math.max(0, ca >= 0 ? s.rzF : s.rzB);
    out.set(x + s.cx, y, z + s.cz);
    if (this.disp) { const d = this.disp(y, a); out.x += sa * d; out.z += ca * d; }
    return out;
  }
  /** outward normal at (y, a) by finite differences */
  normal(y: number, a: number) {
    const e = 1e-3, p = this.at(y, a);
    const pa = this.at(y, a + e).sub(p), py = this.at(y + e, a).sub(p);
    const n = pa.cross(py).normalize();
    const out = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
    if (n.dot(out) < 0) n.negate();
    if (!Number.isFinite(n.x)) return out;
    return n;
  }
  /** position + orientation (+z = outward normal, +y ~ up the part) for decorations */
  frame(y: number, a: number, lift = 0, roll = 0) {
    const p = this.at(y, a), n = this.normal(y, a);
    let x = new THREE.Vector3(0, 1, 0).cross(n); if (x.lengthSq() < 1e-6) x = new THREE.Vector3(1, 0, 0); x.normalize();
    const yv = n.clone().cross(x).normalize();
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, yv, n));
    if (roll) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), roll));
    return { p: p.addScaledVector(n, lift), q, n };
  }
}

/** loft -> indexed geometry. rows along y, cols around. caps close the ends with a fan. */
export function loftGeo(L: Loft, o: { y0?: number; y1?: number; rows?: number; cols?: number; capTop?: boolean; capBot?: boolean; a0?: number; a1?: number; inflate?: number } = {}) {
  const y0 = o.y0 ?? L.y0, y1 = o.y1 ?? L.y1, rows = o.rows ?? 24, cols = o.cols ?? 32;
  const a0 = o.a0 ?? -Math.PI, a1 = o.a1 ?? Math.PI, full = Math.abs(a1 - a0 - Math.PI * 2) < 1e-6;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const p = new THREE.Vector3();
  for (let r = 0; r <= rows; r++) {
    const y = THREE.MathUtils.lerp(y0, y1, r / rows);
    for (let c = 0; c <= cols; c++) {
      const a = THREE.MathUtils.lerp(a0, a1, c / cols);
      L.at(y, a, p);
      if (o.inflate) { const n = L.normal(y, a); p.addScaledVector(n, o.inflate); }
      pos.push(p.x, p.y, p.z); uv.push(c / cols, r / rows);
    }
  }
  const W = cols + 1;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const a = r * W + c, b = a + 1, d = a + W, e = d + 1;
    idx.push(a, b, d, b, e, d);
  }
  const cap = (yy: number, top: boolean) => {
    const s = L.sec(yy);
    const ci = pos.length / 3; pos.push(s.cx, yy + (top ? 1 : -1) * 0.0005, s.cz); uv.push(0.5, top ? 1 : 0);
    const base = top ? rows * W : 0;
    for (let c = 0; c < cols; c++) { const a = base + c, b = a + 1; if (top) idx.push(a, b, ci); else idx.push(b, a, ci); }
  };
  if (full && o.capTop) cap(y1, true);
  if (full && o.capBot) cap(y0, false);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  if (full) seamNormals(g, W, rows);
  return g;
}

function seamNormals(g: THREE.BufferGeometry, W: number, rows: number) {
  const n = g.getAttribute("normal") as THREE.BufferAttribute;
  for (let r = 0; r <= rows; r++) {
    const a = r * W, b = a + W - 1;
    const x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b), l = Math.hypot(x, y, z) || 1;
    n.setXYZ(a, x / l, y / l, z / l); n.setXYZ(b, x / l, y / l, z / l);
  }
}

/** raised band following the loft between two heights (tape hoops, hems, cuffs). Rounded edge rows. */
export function loftBand(L: Loft, y0: number, y1: number, lift: number, cols = 48, rows = 4) {
  const base = L.disp;
  const prof = (y: number) => { const t = (y - y0) / (y1 - y0); return lift * (0.45 + 0.55 * Math.sin(Math.PI * Math.min(1, Math.max(0, t)))); };
  const B = new Loft(L.secs, (y, a) => (base ? base(y, a) : 0));
  const g = loftGeo(B, { y0, y1, rows, cols, inflate: 0 });
  // push rows out with a rounded profile
  const p = g.getAttribute("position") as THREE.BufferAttribute;
  for (let r = 0; r <= rows; r++) {
    const y = THREE.MathUtils.lerp(y0, y1, r / rows);
    for (let c = 0; c <= cols; c++) {
      const i = r * (cols + 1) + c, a = THREE.MathUtils.lerp(-Math.PI, Math.PI, c / cols);
      const n = L.normal(y, a), d = prof(y);
      p.setXYZ(i, p.getX(i) + n.x * d, p.getY(i) + n.y * d, p.getZ(i) + n.z * d);
    }
  }
  g.computeVertexNormals(); seamNormals(g, cols + 1, rows);
  return g;
}

/** surface ribbon along a path of (y, a) points (seams, tape braces, straps, lapels). width across, lift above. */
export function loftRibbon(L: Loft, path: [number, number][], width: number, lift = 0.003, steps = 10, thick = 0) {
  const pts: THREE.Vector3[] = [], nrm: THREE.Vector3[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    for (let k = 0; k < steps; k++) {
      const t = k / steps, y = THREE.MathUtils.lerp(path[i][0], path[i + 1][0], t), a = THREE.MathUtils.lerp(path[i][1], path[i + 1][1], t);
      const n = L.normal(y, a); pts.push(L.at(y, a).addScaledVector(n, lift)); nrm.push(n);
    }
  }
  const [yl, al] = path[path.length - 1]; const nl = L.normal(yl, al); pts.push(L.at(yl, al).addScaledVector(nl, lift)); nrm.push(nl);
  return stripGeo(pts, nrm, width, thick);
}

/** strip (optionally with thickness: a flat bar with rounded-ish sides) through points with given normals */
export function stripGeo(pts: THREE.Vector3[], nrm: THREE.Vector3[], width: number | ((t: number) => number), thick = 0) {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const N = pts.length, wf = typeof width === "number" ? () => width : width;
  const layers = thick > 0 ? 4 : 2;
  for (let i = 0; i < N; i++) {
    const tan = pts[Math.min(N - 1, i + 1)].clone().sub(pts[Math.max(0, i - 1)]).normalize();
    const side = tan.clone().cross(nrm[i]).normalize().multiplyScalar(wf(i / (N - 1)) / 2);
    const v = i / (N - 1);
    const a = pts[i].clone().add(side), b = pts[i].clone().sub(side);
    if (thick > 0) {
      const up = nrm[i].clone().multiplyScalar(thick);
      const c = b.clone().sub(up.clone().multiplyScalar(0.0)), d = a.clone();
      // a(top-left) b(top-right) then bottom (pushed in)
      const a2 = a.clone().sub(up).addScaledVector(side, -0.15), b2 = b.clone().sub(up).addScaledVector(side, 0.15);
      void c; void d;
      pos.push(a2.x, a2.y, a2.z, a.x, a.y, a.z, b.x, b.y, b.z, b2.x, b2.y, b2.z);
      uv.push(0, v, 0.15, v, 0.85, v, 1, v);
    } else {
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z); uv.push(0, v, 1, v);
    }
  }
  for (let i = 0; i < N - 1; i++) for (let l = 0; l < layers - 1; l++) {
    const a = i * layers + l, b = a + 1, c = a + layers, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // face outward
  const n0 = new THREE.Vector3().fromBufferAttribute(g.getAttribute("normal") as THREE.BufferAttribute, Math.min(1, pos.length / 3 - 1));
  if (n0.dot(nrm[0]) < 0) {
    const ix = g.index!.array as Uint16Array | Uint32Array;
    for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
    g.computeVertexNormals();
  }
  return g;
}

/** place a geometry with a position/quaternion (returns a transformed clone) */
export function placed(g: THREE.BufferGeometry, p: THREE.Vector3, q?: THREE.Quaternion, sc?: THREE.Vector3) {
  const m = new THREE.Matrix4().compose(p, q ?? new THREE.Quaternion(), sc ?? new THREE.Vector3(1, 1, 1));
  return g.clone().applyMatrix4(m);
}

/** merge keeping an index (position/normal/uv only) */
export function mergeIdx(gs: THREE.BufferGeometry[]) {
  const norm = gs.map((g0) => {
    const g = g0.clone();
    for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k);
    if (!g.getAttribute("uv")) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.getAttribute("position").count * 2), 2));
    if (!g.getAttribute("normal")) g.computeVertexNormals();
    if (!g.index) { const n = g.getAttribute("position").count; g.setIndex([...Array(n).keys()]); }
    g.morphAttributes = {};
    return g;
  });
  return mergeGeometries(norm)!;
}

// ------------------------------------------------------------------ skinning
export type Weights = [number, number][]; // [boneIndex, weight]
export type FoldFn = (p: THREE.Vector3) => [number, number, number, number]; // (u along part from crease, angle, crease id, mask)

/** add skin + fold attributes to a geometry whose positions are in the frame where wf/ff are defined */
export function addSkin(g: THREE.BufferGeometry, wf: (p: THREE.Vector3) => Weights, ff?: FoldFn) {
  const p = g.getAttribute("position") as THREE.BufferAttribute, n = p.count;
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), fo = new Float32Array(n * 4);
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(p, i);
    const w = wf(v).filter((e) => e[1] > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = w.reduce((s, e) => s + e[1], 0) || 1;
    w.forEach((e, k) => { si[i * 4 + k] = e[0]; sw[i * 4 + k] = e[1] / sum; });
    if (!w.length) sw[i * 4] = 1;
    if (ff) { const f = ff(v); fo.set(f, i * 4); }
  }
  g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(sw, 4));
  g.setAttribute("aFold", new THREE.Float32BufferAttribute(fo, 4));
  return g;
}

export const sstep = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
