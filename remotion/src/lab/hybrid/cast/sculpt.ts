// [hybrid/cast] Geometry helpers forked from lab/toy/sculpt.ts: "sculpts" are superellipsoids with taper/lean/displacement,
// so every body/clothing part has a designed, bevelled silhouette. Added: ribbon() (surface-following strips: seams, stripes).
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

export type SculptOpts = {
  r: [number, number, number]; // half extents x, y, z (m)
  e1?: number; // vertical squareness (1 = round, 0.3 = boxy)
  e2?: number; // horizontal squareness
  taperTop?: number; // x/z scale at the top (y = +ry)
  taperBot?: number;
  taperTopZ?: number; // separate z taper (defaults to taperTop)
  taperBotZ?: number;
  leanTop?: [number, number]; // x/z offset of the top relative to the bottom (m)
  bulge?: number; // belly bulge (z) at mid height
  flatBack?: number; // 0..1 flatten the -z side
  disp?: (d: THREE.Vector3, p: THREE.Vector3) => number; // extra radial displacement (m) along the unit direction
  seg?: [number, number];
  theta?: [number, number]; // partial: thetaStart, thetaLength (polar, 0 = +y)
  phi?: [number, number]; // partial: phiStart, phiLength
  inflate?: number; // uniform outward offset (m), for raised bands that follow the same surface
};

const sgn = (v: number) => (v < 0 ? -1 : 1);

export function sculptPoint(d: THREE.Vector3, o: SculptOpts, out = new THREE.Vector3()) {
  const e1 = o.e1 ?? 1, e2 = o.e2 ?? 1;
  const ax = Math.abs(d.x), ay = Math.abs(d.y), az = Math.abs(d.z);
  const f = Math.pow(Math.pow(ax, 2 / e2) + Math.pow(az, 2 / e2), e2 / e1) + Math.pow(ay, 2 / e1);
  const t = Math.pow(f, -e1 / 2);
  out.set(d.x * t * o.r[0], d.y * t * o.r[1], d.z * t * o.r[2]);
  const k = (out.y / o.r[1] + 1) / 2; // 0 bottom .. 1 top
  const sx = THREE.MathUtils.lerp(o.taperBot ?? 1, o.taperTop ?? 1, k);
  const sz = THREE.MathUtils.lerp(o.taperBotZ ?? o.taperBot ?? 1, o.taperTopZ ?? o.taperTop ?? 1, k);
  out.x *= sx; out.z *= sz;
  if (o.bulge) out.z += sgn(out.z) * o.bulge * Math.sin(Math.PI * k) * (out.z > 0 ? 1 : 0.4) * Math.abs(d.z);
  if (o.flatBack && out.z < 0) out.z *= 1 - o.flatBack;
  if (o.leanTop) { out.x += o.leanTop[0] * k; out.z += o.leanTop[1] * k; }
  const extra = (o.disp ? o.disp(d, out) : 0) + (o.inflate ?? 0);
  if (extra) out.addScaledVector(d, extra);
  return out;
}

export function sculpt(o: SculptOpts) {
  const [ws, hs] = o.seg ?? [40, 28];
  const g = new THREE.SphereGeometry(1, ws, hs, o.phi?.[0] ?? 0, o.phi?.[1] ?? Math.PI * 2, o.theta?.[0] ?? 0, o.theta?.[1] ?? Math.PI);
  const p = g.getAttribute("position") as THREE.BufferAttribute;
  const d = new THREE.Vector3(), q = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    d.set(p.getX(i), p.getY(i), p.getZ(i)).normalize();
    sculptPoint(d, o, q);
    p.setXYZ(i, q.x, q.y, q.z);
  }
  g.computeVertexNormals();
  fixSeamNormals(g);
  return g;
}

// SphereGeometry duplicates vertices along the phi seam and at the poles; average their normals so no crease shows.
export function fixSeamNormals(g: THREE.BufferGeometry) {
  const p = g.getAttribute("position") as THREE.BufferAttribute;
  const n = g.getAttribute("normal") as THREE.BufferAttribute;
  const key = (i: number) => `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`;
  const acc = new Map<string, THREE.Vector3>();
  for (let i = 0; i < p.count; i++) {
    const k = key(i);
    const v = acc.get(k) ?? new THREE.Vector3();
    v.x += n.getX(i); v.y += n.getY(i); v.z += n.getZ(i);
    acc.set(k, v);
  }
  for (let i = 0; i < p.count; i++) {
    const v = acc.get(key(i))!.clone().normalize();
    n.setXYZ(i, v.x, v.y, v.z);
  }
  n.needsUpdate = true;
  return g;
}

export function rbox(w: number, h: number, d: number, r: number, seg = 3) {
  const g = new RoundedBoxGeometry(w, h, d, seg, Math.min(r, Math.min(w, h, d) / 2 - 1e-4));
  return g;
}

// Extrude a 2D profile (in x/y, metres) along +z by `len`, with bevel.
export function extrude(shape: THREE.Shape, len: number, bevel = 0.003, bevelSeg = 2, curveSeg = 8) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(1e-4, len - 2 * bevel), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel,
    bevelOffset: -bevel, bevelSegments: bevelSeg, curveSegments: curveSeg,
  });
  g.translate(0, 0, bevel);
  return g;
}

export function roundedRectShape(w: number, h: number, r: number, cx = 0, cy = 0) {
  const s = new THREE.Shape();
  const x0 = cx - w / 2, y0 = cy - h / 2;
  s.moveTo(x0 + r, y0);
  s.lineTo(x0 + w - r, y0); s.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r);
  s.lineTo(x0 + w, y0 + h - r); s.quadraticCurveTo(x0 + w, y0 + h, x0 + w - r, y0 + h);
  s.lineTo(x0 + r, y0 + h); s.quadraticCurveTo(x0, y0 + h, x0, y0 + h - r);
  s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
}

export function tube(points: THREE.Vector3[], r: number, seg = 64, radial = 10, closed = false) {
  const c = new THREE.CatmullRomCurve3(points, closed, "centripetal");
  return new THREE.TubeGeometry(c, seg, r, radial, closed);
}

export function helix(r: number, pitch: number, turns: number, wire: number) {
  const pts: THREE.Vector3[] = [];
  const n = Math.ceil(turns * 24);
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * turns * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * r, (i / n) * turns * pitch, Math.sin(a) * r));
  }
  return tube(pts, wire, n, 8);
}

// Hex bolt head + washer, centred on origin, axis +y (head sits on y = 0 plane).
export function boltGeo(s = 0.012) {
  const head = new THREE.CylinderGeometry(s, s, s * 0.7, 6);
  head.translate(0, s * 0.35 + s * 0.18, 0);
  const washer = new THREE.CylinderGeometry(s * 1.45, s * 1.45, s * 0.18, 16);
  washer.translate(0, s * 0.09, 0);
  const stud = new THREE.CylinderGeometry(s * 0.45, s * 0.45, s * 0.5, 8);
  stud.translate(0, s * 0.35 + s * 0.18 + s * 0.6, 0);
  return mergeGeometries([head.toNonIndexed(), washer.toNonIndexed(), stud.toNonIndexed()])!;
}

export function merge(gs: THREE.BufferGeometry[]) {
  const norm = gs.map((g) => {
    let q = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(q.attributes)) if (!["position", "normal", "uv"].includes(k)) q.deleteAttribute(k);
    if (!q.getAttribute("uv")) {
      q = q.clone();
      q.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(q.getAttribute("position").count * 2), 2));
    }
    return q;
  });
  return mergeGeometries(norm)!;
}

// Slice a (world-baked) geometry with planes y = c (in the geometry's local frame, along axis), returning segment
// endpoints [x0,y0,z0,x1,y1,z1,...] for blueprint contour lines.
export function sliceContours(g: THREE.BufferGeometry, levels: number[], axis: 0 | 1 | 2 = 1) {
  const p = g.getAttribute("position") as THREE.BufferAttribute;
  const idx = g.index;
  const tri = idx ? idx.count / 3 : p.count / 3;
  const out: number[] = [];
  const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  for (let t = 0; t < tri; t++) {
    for (let k = 0; k < 3; k++) {
      const i = idx ? idx.getX(t * 3 + k) : t * 3 + k;
      v[k].set(p.getX(i), p.getY(i), p.getZ(i));
    }
    for (const c of levels) {
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k < 3; k++) {
        const a = v[k], b = v[(k + 1) % 3];
        const da = a.getComponent(axis) - c, db = b.getComponent(axis) - c;
        if ((da < 0 && db >= 0) || (da >= 0 && db < 0)) pts.push(a.clone().lerp(b, da / (da - db)));
      }
      if (pts.length === 2) out.push(pts[0].x, pts[0].y, pts[0].z, pts[1].x, pts[1].y, pts[1].z);
    }
  }
  return out;
}

// Raised band that follows a sculpt's surface between two heights (stripes, belts, cuffs, hems). From lab/toy/figure.ts.
export function band(o: SculptOpts, y0: number, y1: number, inflate: number, seg = 48, rows = 4) {
  const pos: number[] = [], idx: number[] = [], uv: number[] = [];
  const d = new THREE.Vector3(), p = new THREE.Vector3();
  const findDir = (phi: number, y: number) => {
    let lo = 0.02, hi = Math.PI - 0.02;
    for (let i = 0; i < 28; i++) {
      const th = (lo + hi) / 2;
      d.set(Math.sin(th) * Math.sin(phi), Math.cos(th), Math.sin(th) * Math.cos(phi));
      sculptPoint(d, o, p);
      if (p.y > y) lo = th; else hi = th;
    }
    return d.clone();
  };
  for (let r = 0; r <= rows; r++) {
    const y = THREE.MathUtils.lerp(y0, y1, r / rows);
    for (let s = 0; s <= seg; s++) {
      const phi = (s / seg) * Math.PI * 2;
      const dd = findDir(phi, y);
      sculptPoint(dd, { ...o, inflate: (o.inflate ?? 0) + inflate * (r === 0 || r === rows ? 0.55 : 1) }, p);
      pos.push(p.x, p.y, p.z); uv.push(s / seg, r / rows);
    }
  }
  for (let r = 0; r < rows; r++) for (let s = 0; s < seg; s++) {
    const a = r * (seg + 1) + s, b = a + 1, c = a + seg + 1, e = c + 1;
    idx.push(a, c, b, b, c, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Surface-following ribbon over a sculpt along a polyline of unit directions (seams, braces stripes, piping).
 *  `width` across the path, `lift` above the surface (m). Slerps between the given directions for a smooth path. */
export function ribbon(o: SculptOpts, dirs: THREE.Vector3[], width: number, lift = 0.004, steps = 10) {
  const pts: THREE.Vector3[] = [], nrm: THREE.Vector3[] = [];
  const q = new THREE.Vector3();
  for (let i = 0; i < dirs.length - 1; i++) {
    const a = dirs[i].clone().normalize(), b = dirs[i + 1].clone().normalize();
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      const d = a.clone().lerp(b, t).normalize();
      pts.push(sculptPoint(d, o, q).clone().addScaledVector(d, lift));
      nrm.push(d);
    }
  }
  const dl = dirs[dirs.length - 1].clone().normalize();
  pts.push(sculptPoint(dl, o, q).clone().addScaledVector(dl, lift)); nrm.push(dl);
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const tan = pts[Math.min(pts.length - 1, i + 1)].clone().sub(pts[Math.max(0, i - 1)]).normalize();
    const side = tan.clone().cross(nrm[i]).normalize().multiplyScalar(width / 2);
    const a = pts[i].clone().add(side), b = pts[i].clone().sub(side);
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z); uv.push(0, i / (pts.length - 1), 1, i / (pts.length - 1));
  }
  for (let i = 0; i < pts.length - 1; i++) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // make the strip face outward (along the surface direction)
  const n0 = new THREE.Vector3().fromBufferAttribute(g.getAttribute("normal") as THREE.BufferAttribute, 0);
  if (n0.dot(nrm[0]) < 0) {
    const ix = g.index!.array as Uint16Array | Uint32Array;
    for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
    g.computeVertexNormals();
  }
  return g;
}

/** tapered capsule along -y from y=0 to y=-len (limb segment), radii r0 at the top and r1 at the bottom, x/z aspect */
export function limbGeo(len: number, r0: number, r1: number, o: { aspect?: number; bulge?: number; flatBack?: number; leanZ?: number; seg?: [number, number]; e?: number } = {}) {
  const asp = o.aspect ?? 1;
  const ry = len / 2 + (r0 + r1) / 4;
  const g = sculpt({
    r: [r0 * asp, ry, r0], e1: o.e ?? 0.62, e2: 0.92, taperTop: 1, taperBot: r1 / r0, seg: o.seg ?? [28, 22],
    flatBack: o.flatBack, leanTop: o.leanZ ? [0, o.leanZ] : undefined,
    disp: o.bulge ? (d) => o.bulge! * Math.exp(-Math.pow((d.y - 0.35) / 0.35, 2)) * Math.max(0, 0.4 + 0.6 * Math.abs(d.z)) : undefined,
  });
  g.translate(0, -len / 2, 0);
  return g;
}
