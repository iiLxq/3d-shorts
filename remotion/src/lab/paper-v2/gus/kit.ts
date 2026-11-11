// [gus lab] Shape + print helpers for the v2 puppet (paper craft, no halftone on faces).
import * as THREE from "three";
import { Painter, Pt, PaperStock } from "./paint";

export const deg = Math.PI / 180;
export const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const sstep = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** Closed Catmull-Rom resample: organic hand-cut outlines from a few control points. */
export function smooth(pts: Pt[], n = 6, closed = true): Pt[] {
  const out: Pt[] = [];
  const N = pts.length;
  const at = (i: number) => (closed ? pts[(i + N) % N] : pts[clamp(i, 0, N - 1)]);
  const last = closed ? N : N - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  if (!closed) out.push(pts[N - 1]);
  return out;
}
/** Mirror a half outline (x >= 0, listed bottom-centre -> top-centre) into a full closed outline. */
export function mirrorHalf(half: Pt[]): Pt[] {
  const back = half.slice(1, -1).reverse().map(([x, y]) => [-x, y] as Pt);
  return [...half, ...back];
}
/** Half card (x>=0 side, s=+1) or its mirror (s=-1), closed along x=0. */
export function halfPoly(half: Pt[], s: 1 | -1): Pt[] {
  const pts = half.map(([x, y]) => [s * x, y] as Pt);
  return s > 0 ? pts : pts.reverse();
}
export function shapeOf(pts: Pt[], holes: Pt[][] = []) {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  for (const h of holes) {
    const p = new THREE.Path();
    h.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
    p.closePath();
    s.holes.push(p);
  }
  return s;
}
export function ellipsePts(cx: number, cy: number, rx: number, ry: number, n = 32, a0 = 0): Pt[] {
  return Array.from({ length: n }, (_, i) => { const a = a0 + (i / n) * Math.PI * 2; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as Pt; });
}
export function rectPts(x0: number, y0: number, x1: number, y1: number, r = 0): Pt[] {
  if (r <= 0) return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const c: Pt[] = [[x1 - r, y0 + r], [x1 - r, y1 - r], [x0 + r, y1 - r], [x0 + r, y0 + r]];
  const out: Pt[] = [];
  const a0 = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
  c.forEach(([cx, cy], i) => { for (let k = 0; k <= 4; k++) { const a = a0[i] + (k / 4) * (Math.PI / 2); out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } });
  return out;
}
export function transform(pts: Pt[], sx = 1, sy = 1, dx = 0, dy = 0): Pt[] { return pts.map(([x, y]) => [x * sx + dx, y * sy + dy]); }
/** Seeded hand-cut jitter (small). */
export function jitter(pts: Pt[], amt: number, seed: number): Pt[] {
  let a = (seed * 9301 + 49297) % 233280;
  const r = () => { a = (a * 9301 + 49297) % 233280; return a / 233280; };
  return pts.map(([x, y]) => [x + (r() - 0.5) * amt, y + (r() - 0.5) * amt]);
}
/** Sutherland-Hodgman clip of a polygon against the half plane f(p) >= 0 (f linear-ish). */
export function clipHalf(pts: Pt[], f: (p: Pt) => number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const fa = f(a), fb = f(b);
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) { const t = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
}
/** Max |x| of a closed outline at height y (for strips cut to a piece's edge). */
export function halfWidthAt(pts: Pt[], y: number) {
  let w = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    if ((a[1] - y) * (b[1] - y) <= 0 && a[1] !== b[1]) { const t = (y - a[1]) / (b[1] - a[1]); w = Math.max(w, Math.abs(a[0] + (b[0] - a[0]) * t)); }
  }
  return w;
}

// ---------------------------------------------------------------- print helpers (solid look only for soft fills)
export const solid = (p: Painter) => p.look === "solid";
/** Linear-gradient wash clipped to pts (printed volume, not halftone). */
export function wash(p: Painter, pts: Pt[], a: Pt, b: Pt, stops: [number, string][]) {
  if (!solid(p)) return;
  const g = p.g; g.save(); p.path(pts); g.clip();
  const gr = g.createLinearGradient(a[0], a[1], b[0], b[1]);
  stops.forEach(([t, c]) => gr.addColorStop(t, c));
  g.fillStyle = gr; g.fill(); g.restore();
}
/** Radial soft spot (blush, shadow pools). */
export function spot(p: Painter, pts: Pt[] | null, cx: number, cy: number, r: number, c0: string, c1: string, sy = 1) {
  if (!solid(p)) return;
  const g = p.g; g.save();
  if (pts) { p.path(pts); g.clip(); }
  g.translate(cx, cy); g.scale(1, sy);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
  gr.addColorStop(0, c0); gr.addColorStop(1, c1);
  g.fillStyle = gr; g.fillRect(-r, -r, 2 * r, 2 * r); g.restore();
}
/** Stitch line (dashed) that also draws as a fine dashed line in blueprint. */
export function stitch(p: Painter, pts: Pt[], color = "rgba(30,20,10,0.45)", w = 0.0016, dash = 0.008) {
  p.stroke(pts, color, w, false, [dash, dash * 0.7]);
}
/** Fine speckle (paper flecks, stubble), solid look only, low contrast. */
export function speckle(p: Painter, pts: Pt[], n: number, r: number, color: string, seed: number, mask?: (x: number, y: number) => number) {
  if (!solid(p)) return;
  const g = p.g; g.save(); p.path(pts); g.clip();
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  pts.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
  let a = seed * 7919 + 13;
  const rr = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
  g.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const x = x0 + rr() * (x1 - x0), y = y0 + rr() * (y1 - y0);
    if (mask && rr() > mask(x, y)) continue;
    g.beginPath(); g.arc(x, y, r * (0.6 + rr() * 0.8), 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

// ---------------------------------------------------------------- stocks (white card cores everywhere)
export const ST: Record<string, PaperStock> = {
  amber: { base: "#FFB020", mottle: 0.025, core: "#fff6e2" },
  amberD: { base: "#f2a414", mottle: 0.03, core: "#fff6e2" },
  navy: { base: "#1f2a42", mottle: 0.04, core: "#e9ecf2" },
  tape: { base: "#d7dbda", mottle: 0.03, core: "#ffffff" },
  trouser: { base: "#323c51", mottle: 0.04, core: "#eef0f4" },
  pad: { base: "#232a39", mottle: 0.04, core: "#eef0f4" },
  skin: { base: "#cf9876", mottle: 0.025, core: "#fbeee4" },
  lid: { base: "#c48b6b", mottle: 0.02, core: "#fbeee4" },
  hair: { base: "#4b3d33", mottle: 0.05, core: "#f2e9df" },
  grey: { base: "#a49d94", mottle: 0.05, core: "#ffffff" },
  stache: { base: "#3e3029", mottle: 0.05, core: "#f2e9df" },
  boot: { base: "#7b5536", mottle: 0.05, core: "#f4e7d6" },
  sole: { base: "#2b2724", mottle: 0.04, core: "#e8e2da" },
  helmet: { base: "#ece6d7", mottle: 0.035, core: "#ffffff" },
  white: { base: "#f3efe6", mottle: 0.02, core: "#ffffff" },
  iris: { base: "#6a4a2c", mottle: 0.03, core: "#ffffff" },
  pupil: { base: "#17110d", mottle: 0.0, core: "#ffffff" },
  mouth: { base: "#3d1a19", mottle: 0.02, core: "#fbeee4" },
  leather: { base: "#5b3f2a", mottle: 0.05, core: "#f4e7d6" },
  black: { base: "#25272b", mottle: 0.03, core: "#e6e6e6" },
  kraft: { base: "#a97f55", mottle: 0.07, flecks: ["#6d4a2c", "#c9a77d"], core: "#ecdcc4" },
  steel: { base: "#7c8794", mottle: 0.04, core: "#f0f2f4" },
  wood: { base: "#9a6a3f", mottle: 0.05, core: "#f4e7d6" },
  lens: { base: "#fff3d6", mottle: 0.0, core: "#ffffff" },
};
