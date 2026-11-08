// "Ray Calder", elevator technician: a cut-out rig of code-drawn parts in the engraving ink language.
// Each part is a Canvas2D drawing in DATA channels (R = engraved ink lines, G = amber spot coverage,
// B = albedo, A = silhouette) + a pillow normal map from a distance transform, so the scene's own
// lights + shadow maps decide where the shader hatches him (he sits in the world's light).
// Proportions: 5.4 heads (head chin-crown 0.33 m, 1.79 m to crown, 1.84 m with helmet).
import * as THREE from "three";
import { inkMat, KIND, SPOT } from "./ink";

type V = [number, number];
export type Expr = "calm" | "alarmed" | "relieved" | "blink";

// ---------------------------------------------------------------- drawing helpers
function crPts(pts: V[], closed: boolean, n = 10): V[] {
  const out: V[] = []; const N = pts.length;
  const get = (i: number) => closed ? pts[(i + N) % N] : pts[Math.max(0, Math.min(N - 1, i))];
  const segs = closed ? N : N - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((j) => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)) as V);
    }
  }
  if (!closed) out.push(pts[N - 1]);
  return out;
}

class Pen {
  c: HTMLCanvasElement; g: CanvasRenderingContext2D;
  constructor(public bb: [number, number, number, number], public ppm: number) {
    this.c = document.createElement("canvas");
    this.c.width = Math.ceil((bb[2] - bb[0]) * ppm); this.c.height = Math.ceil((bb[3] - bb[1]) * ppm);
    this.g = this.c.getContext("2d", { willReadFrequently: true })!;
    this.g.lineJoin = "round"; this.g.lineCap = "round";
  }
  P(p: V): V { return [(p[0] - this.bb[0]) * this.ppm, (this.bb[3] - p[1]) * this.ppm]; }
  private path(pts: V[], closed: boolean) {
    const g = this.g; g.beginPath();
    pts.forEach((p, i) => { const q = this.P(p); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); });
    if (closed) g.closePath();
  }
  // base fill: albedo + amber spot coverage (overwrites)
  base(ctrl: V[], albedo: number, spot = 0, smooth = true) {
    const g = this.g; g.globalCompositeOperation = "source-over";
    g.fillStyle = `rgb(0,${Math.round(spot * 255)},${Math.round(albedo * 255)})`;
    this.path(smooth ? crPts(ctrl, true) : ctrl, true); g.fill();
  }
  // engraved ribbon: width swells from w0 to w1 (metres) with tapered ends
  ink(ctrl: V[], w0: number, w1 = w0, opt: { closed?: boolean; taper?: number; a?: number } = {}) {
    const pts = ctrl.length > 2 ? crPts(ctrl, !!opt.closed, 8) : ctrl;
    if (opt.closed) pts.push(pts[0]);
    const n = pts.length; if (n < 2) return;
    const L: V[] = [], R: V[] = [];
    const tp = opt.taper ?? 0.18;
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      const t = i / (n - 1);
      const tap = opt.closed || tp <= 0 ? 1 : Math.pow(Math.min(1, t / tp, (1 - t) / tp), 0.55);
      const w = (w0 + (w1 - w0) * t) * Math.max(0.12, tap) * 0.5;
      L.push([pts[i][0] - dy * w, pts[i][1] + dx * w]); R.push([pts[i][0] + dy * w, pts[i][1] - dx * w]);
    }
    const g = this.g; g.globalCompositeOperation = "lighter";
    g.fillStyle = `rgba(255,0,0,${opt.a ?? 1})`;
    this.path([...L, ...R.reverse()], true); g.fill();
  }
  solid(ctrl: V[], smooth = true, a = 1) {
    const g = this.g; g.globalCompositeOperation = "lighter"; g.fillStyle = `rgba(255,0,0,${a})`;
    this.path(smooth ? crPts(ctrl, true) : ctrl, true); g.fill();
  }
  dot(p: V, r: number, a = 1) {
    const g = this.g; g.globalCompositeOperation = "lighter"; g.fillStyle = `rgba(255,0,0,${a})`;
    const q = this.P(p); g.beginPath(); g.arc(q[0], q[1], r * this.ppm, 0, Math.PI * 2); g.fill();
  }
  // erase ink to paper (keeps albedo/spot given)
  clear(ctrl: V[], albedo: number, spot = 0, smooth = true) { this.base(ctrl, albedo, spot, smooth); }
  ell(c: V, rx: number, ry: number, n = 20): V[] { return Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return [c[0] + Math.cos(a) * rx, c[1] + Math.sin(a) * ry] as V; }); }
  // parallel engraved shading lines clipped to a shape (light-independent "drawn" shading, e.g. hair)
  lines(ctrl: V[], ang: number, sp: number, w: number, a = 1) {
    const g = this.g; g.save(); this.path(crPts(ctrl, true), true); g.clip();
    const [x0, y0, x1, y1] = this.bb; const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; const R = Math.hypot(x1 - x0, y1 - y0);
    const d: V = [Math.cos(ang), Math.sin(ang)], nrm: V = [-d[1], d[0]];
    for (let s = -R; s <= R; s += sp) {
      const p0: V = [cx + nrm[0] * s - d[0] * R, cy + nrm[1] * s - d[1] * R], p1: V = [cx + nrm[0] * s + d[0] * R, cy + nrm[1] * s + d[1] * R];
      this.ink([p0, p1], w, w, { taper: 0, a });
    }
    g.restore();
  }
}

// pillow normal map from the silhouette (chamfer distance transform)
function normalCanvas(src: HTMLCanvasElement, Rm: number, ppm: number, flat = 0.85): HTMLCanvasElement {
  const w = src.width, h = src.height;
  const a = src.getContext("2d")!.getImageData(0, 0, w, h).data;
  const INF = 1e9; const d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = a[i * 4 + 3] > 100 ? INF : 0;
  const s1 = 1, s2 = 1.414;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (!d[i]) continue; let v = d[i];
    if (x > 0) v = Math.min(v, d[i - 1] + s1); if (y > 0) v = Math.min(v, d[i - w] + s1);
    if (x > 0 && y > 0) v = Math.min(v, d[i - w - 1] + s2); if (x < w - 1 && y > 0) v = Math.min(v, d[i - w + 1] + s2);
    if (x === 0 || y === 0 || x === w - 1) v = Math.min(v, 1);
    d[i] = v;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x; if (!d[i]) continue; let v = d[i];
    if (x < w - 1) v = Math.min(v, d[i + 1] + s1); if (y < h - 1) v = Math.min(v, d[i + w] + s1);
    if (x < w - 1 && y < h - 1) v = Math.min(v, d[i + w + 1] + s2); if (x > 0 && y < h - 1) v = Math.min(v, d[i + w - 1] + s2);
    d[i] = v;
  }
  const R = Rm * ppm; const H = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) { const t = Math.min(1, d[i] / R); H[i] = Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t))) * R * flat; }
  const out = document.createElement("canvas"); out.width = w; out.height = h;
  const og = out.getContext("2d")!; const im = og.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    const hx = (H[y * w + Math.min(w - 1, x + 1)] - H[y * w + Math.max(0, x - 1)]) * 0.5;
    const hy = (H[Math.min(h - 1, y + 1) * w + x] - H[Math.max(0, y - 1) * w + x]) * 0.5;
    let nx = -hx, ny = hy, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    im.data[i * 4] = (nx * 0.5 + 0.5) * 255; im.data[i * 4 + 1] = (ny * 0.5 + 0.5) * 255; im.data[i * 4 + 2] = (nz * 0.5 + 0.5) * 255; im.data[i * 4 + 3] = 255;
  }
  og.putImageData(im, 0, 0);
  return out;
}

// ---------------------------------------------------------------- the drawings
const W = { out: 0.0075, mid: 0.0052, fine: 0.0038, hair: 0.003 };
const ALB = { skin: 0.86, jacket: 0.82, tape: 1.0, glove: 0.42, trousers: 0.30, boot: 0.22, helmet: 0.95, belt: 0.28, steel: 0.55 };

function drawTorso(p: Pen) {
  const sil: V[] = [[-0.2, -0.08], [-0.212, 0.16], [-0.225, 0.34], [-0.236, 0.46], [-0.19, 0.525], [-0.075, 0.555], [0.075, 0.555], [0.19, 0.525], [0.236, 0.46], [0.225, 0.34], [0.212, 0.16], [0.2, -0.08], [0, -0.09]];
  p.base(sil, ALB.jacket, 1);
  // reflective tape: two hoops + braces over the shoulders (paper white, no spot)
  const band = (y: number) => [[-0.215, y], [0, y - 0.006], [0.215, y], [0.217, y + 0.042], [0, y + 0.036], [-0.217, y + 0.042]] as V[];
  for (const y of [0.075, 0.2]) { p.clear(band(y), ALB.tape, 0, false); p.ink(band(y).slice(0, 3), W.fine); p.ink(band(y).slice(3), W.fine); }
  for (const s of [-1, 1]) {
    const br: V[] = [[s * 0.085, 0.242], [s * 0.125, 0.242], [s * 0.15, 0.548], [s * 0.11, 0.553]];
    p.clear(br, ALB.tape, 0, false); p.ink([br[0], br[3]], W.fine); p.ink([br[1], br[2]], W.fine);
  }
  // collar + neck opening
  p.base([[-0.075, 0.555], [-0.1, 0.595], [-0.04, 0.585], [0, 0.55], [0.04, 0.585], [0.1, 0.595], [0.075, 0.555]], ALB.jacket, 1, false);
  p.ink([[-0.075, 0.553], [-0.1, 0.594], [-0.04, 0.584], [0.0, 0.548]], W.mid);
  p.ink([[0.0, 0.548], [0.04, 0.584], [0.1, 0.594], [0.075, 0.553]], W.mid);
  // zip placket
  p.ink([[0.004, 0.548], [0.006, 0.3], [0.004, -0.03]], W.mid, W.mid, { taper: 0.05 });
  for (let y = 0.0; y < 0.53; y += 0.022) p.ink([[-0.004, y], [0.016, y + 0.004]], W.hair, W.hair, { taper: 0 });
  // chest pocket (screen-left) with flap + pen
  p.ink([[-0.165, 0.38], [-0.06, 0.383], [-0.058, 0.3], [-0.163, 0.297]], W.fine, W.fine, { closed: true, taper: 0 });
  p.ink([[-0.168, 0.385], [-0.055, 0.388], [-0.062, 0.355], [-0.161, 0.352]], W.fine, W.fine, { closed: true, taper: 0 });
  p.solid([[-0.09, 0.39], [-0.083, 0.39], [-0.083, 0.43], [-0.09, 0.43]], false);
  // folds (crisp engraved creases)
  p.ink([[-0.19, 0.44], [-0.15, 0.4], [-0.135, 0.33]], W.fine, W.hair);
  p.ink([[0.19, 0.45], [0.155, 0.41], [0.14, 0.34]], W.fine, W.hair);
  p.ink([[-0.17, 0.02], [-0.12, 0.05], [-0.06, 0.045]], W.fine, W.hair);
  p.ink([[0.17, 0.03], [0.11, 0.055]], W.fine, W.hair);
  p.ink([[0.05, 0.27], [0.11, 0.25], [0.15, 0.27]], W.hair, W.hair);
  p.ink(sil, W.out, W.out, { closed: true });
  drawBelt(p, -0.03);
}

function drawBelt(p: Pen, dy: number) {
  const Y = (y: number) => y + dy;
  const belt: V[] = [[-0.215, Y(0.012)], [0, Y(0.0)], [0.215, Y(0.012)], [0.215, Y(0.062)], [0, Y(0.052)], [-0.215, Y(0.062)]];
  p.base(belt, ALB.belt, 0, false);
  p.ink(belt, W.mid, W.mid, { closed: true, taper: 0 });
  p.ink([[-0.2, Y(0.024)], [0, Y(0.013)], [0.2, Y(0.024)]], W.hair, W.hair, { taper: 0, a: 0.6 });
  const bk: V[] = [[-0.028, Y(0.004)], [0.028, Y(0.004)], [0.028, Y(0.058)], [-0.028, Y(0.058)]];
  p.clear(bk, ALB.steel, 0, false); p.ink(bk, W.fine, W.fine, { closed: true, taper: 0 });
  for (const s of [-1, 1]) {
    const x = s * 0.165;
    const po: V[] = [[x - 0.05, Y(0.05)], [x + 0.05, Y(0.05)], [x + 0.056, Y(-0.13)], [x, Y(-0.148)], [x - 0.056, Y(-0.13)]];
    p.base(po, ALB.belt + 0.12, 0, false); p.ink(po, W.mid, W.mid, { closed: true, taper: 0 });
    p.ink([[x - 0.05, Y(0.022)], [x, Y(0.0)], [x + 0.05, Y(0.022)]], W.fine);
    p.ink([[x - 0.035, Y(-0.06)], [x + 0.035, Y(-0.065)]], W.hair, W.hair, { a: 0.7 });
  }
  const hm: V[] = [[0.225, Y(-0.0)], [0.245, Y(-0.0)], [0.255, Y(-0.2)], [0.235, Y(-0.2)]];
  p.base(hm, 0.75, 0, false); p.ink(hm, W.fine, W.fine, { closed: true, taper: 0 });
  const hh: V[] = [[0.205, Y(0.02)], [0.27, Y(0.02)], [0.27, Y(0.055)], [0.205, Y(0.055)]];
  p.base(hh, ALB.steel, 0, false); p.ink(hh, W.fine, W.fine, { closed: true, taper: 0 });
}

function drawPelvis(p: Pen) {
  const tr: V[] = [[-0.17, 0.05], [-0.175, -0.07], [-0.15, -0.13], [0, -0.15], [0.15, -0.13], [0.175, -0.07], [0.17, 0.05]];
  p.base(tr, ALB.trousers);
  p.ink([[0.0, -0.06], [0.0, -0.15]], W.fine);
  p.ink(tr, W.out, W.out, { closed: true });
}
function drawHead(p: Pen, ex: Expr) {
  const cx = -0.012;
  // neck
  p.base([[-0.055, -0.01], [0.055, -0.01], [0.06, 0.12], [-0.06, 0.12]], ALB.skin, 0, false);
  p.ink([[-0.055, 0.0], [-0.058, 0.09]], W.mid); p.ink([[0.055, 0.0], [0.058, 0.08]], W.mid);
  p.lines([[0.0, -0.01], [0.055, -0.01], [0.058, 0.07], [0.0, 0.06]], 1.9, 0.009, W.hair, 0.6);
  // ears
  for (const s of [-1, 1]) {
    const ear: V[] = [[s * 0.112, 0.21], [s * 0.138, 0.215], [s * 0.142, 0.175], [s * 0.128, 0.142], [s * 0.108, 0.145]];
    p.base(ear, ALB.skin); p.ink(ear, W.mid, W.mid, { closed: true });
    p.ink([[s * 0.13, 0.2], [s * 0.122, 0.175], [s * 0.126, 0.156]], W.hair);
  }
  const head: V[] = [[-0.118, 0.27], [-0.121, 0.19], [-0.112, 0.125], [-0.086, 0.078], [-0.042, 0.05], [0.0, 0.044], [0.037, 0.051], [0.08, 0.078], [0.106, 0.124], [0.116, 0.19], [0.114, 0.275], [0.088, 0.345], [0.0, 0.378], [-0.09, 0.345]];
  p.base(head, ALB.skin);
  // hair: cropped dark sides under the helmet (drawn engraving lines)
  for (const s of [-1, 1]) {
    const hr: V[] = [[s * 0.118, 0.29], [s * 0.121, 0.215], [s * 0.104, 0.205], [s * 0.098, 0.27]];
    p.lines(hr, 1.35, 0.0055, W.hair * 1.2, 0.95);
  }
  // stubble: sparse stipple on jaw (screen-right = shadow side denser)
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 140; i++) {
    const x = -0.09 + rnd() * 0.19, y = 0.06 + rnd() * 0.06;
    const inJaw = Math.hypot((x - 0.0) / 0.11, (y - 0.115) / 0.07) < 1 && !(Math.abs(x - cx) < 0.04 && y > 0.08);
    if (inJaw) p.dot([x, y], 0.0011 + (x > 0 ? 0.0003 : 0), 0.6);
  }
  // cheek / jaw structure lines
  p.ink([[0.083, 0.16], [0.09, 0.12], [0.075, 0.09]], W.hair, W.hair);
  p.ink([[-0.095, 0.15], [-0.098, 0.115]], W.hair, W.hair);
  // ---- face by expression ----
  const eyeY = 0.198, eL: V = [cx - 0.047, eyeY], eR: V = [cx + 0.051, eyeY];
  const E = {
    calm: { bIn: 0.0, bOut: 0.0, open: 0.72, pup: 0.0115, look: [-0.006, -0.002] as V, mouth: "smile" },
    alarmed: { bIn: 0.03, bOut: 0.018, open: 1.18, pup: 0.0082, look: [0.0, 0.004] as V, mouth: "o" },
    relieved: { bIn: 0.014, bOut: -0.006, open: 0.0, pup: 0.011, look: [0, 0] as V, mouth: "exhale" },
    blink: { bIn: 0.0, bOut: 0.0, open: 0.05, pup: 0.011, look: [0, 0] as V, mouth: "smile" },
  }[ex];
  for (const [e, s] of [[eL, -1], [eR, 1]] as [V, number][]) {
    const wx = s < 0 ? 0.027 : 0.025; const hy = 0.0135 * E.open;
    if (E.open > 0.2) {
      const eyeShape: V[] = [[e[0] - wx, e[1]], [e[0] - wx * 0.4, e[1] + hy], [e[0] + wx * 0.45, e[1] + hy * 0.95], [e[0] + wx, e[1] + 0.001], [e[0] + wx * 0.35, e[1] - hy * 0.75], [e[0] - wx * 0.45, e[1] - hy * 0.75]];
      p.clear(eyeShape, 1.0, 0);
      // iris + pupil (+ paper catch-light up-left = key light side)
      const ic: V = [e[0] + E.look[0], e[1] + E.look[1] - 0.001];
      const ir = Math.min(0.0118, hy * 1.02 + 0.002);
      p.g.save(); p.g.beginPath(); crPts(eyeShape, true).forEach((q, i) => { const r = p.P(q); if (i) p.g.lineTo(r[0], r[1]); else p.g.moveTo(r[0], r[1]); }); p.g.closePath(); p.g.clip();
      p.dot(ic, ir, 0.55); p.dot(ic, E.pup * (ex === "alarmed" ? 0.75 : 0.9));
      p.g.restore();
      p.clear(p.ell([ic[0] - 0.004, ic[1] + 0.004], 0.0028, 0.0028, 10), 1.0, 0, false);
      // upper lid: heavy engraved line + crease, lower lid fine
      p.ink([eyeShape[0], eyeShape[1], eyeShape[2], eyeShape[3]], W.mid * 1.25, W.fine);
      p.ink([eyeShape[3], eyeShape[4], eyeShape[5], eyeShape[0]], W.hair, W.hair);
      p.ink([[e[0] - wx * 0.8, e[1] + hy + 0.007], [e[0] + wx * 0.1, e[1] + hy + 0.0105], [e[0] + wx * 0.85, e[1] + hy + 0.006]], W.hair, W.hair);
      if (ex === "alarmed") p.ink([[e[0] - wx * 0.6, e[1] - hy - 0.004], [e[0] + wx * 0.5, e[1] - hy - 0.004]], W.hair, W.hair);
    } else {
      // closed lids: relieved = soft downward arcs; blink = flat line
      const k = ex === "relieved" ? -0.006 : 0.0;
      p.ink([[e[0] - wx, e[1] + 0.001], [e[0], e[1] + k], [e[0] + wx, e[1] + 0.002]], W.mid * 1.2, W.fine);
      p.ink([[e[0] - wx * 0.6, e[1] - 0.006 + k], [e[0] + wx * 0.5, e[1] - 0.007 + k]], W.hair, W.hair, { a: 0.7 });
    }
    // brow: thick, tapered, the main acting line
    const bi = E.bIn, bo = E.bOut; const by = e[1] + 0.03;
    const inner: V = [e[0] - s * wx * 1.05 * -1, by + bi]; // inner end is towards the nose
    const pts: V[] = s < 0
      ? [[e[0] - wx * 1.15, by - 0.004 + bo], [e[0] - wx * 0.2, by + 0.006 + (bi + bo) * 0.5], [e[0] + wx * 0.95, by + bi]]
      : [[e[0] - wx * 0.95, by + bi], [e[0] + wx * 0.2, by + 0.006 + (bi + bo) * 0.5], [e[0] + wx * 1.15, by - 0.004 + bo]];
    void inner;
    p.ink(pts, s < 0 ? 0.004 : 0.011, s < 0 ? 0.011 : 0.004, { taper: 0.12 });
  }
  if (ex === "alarmed") { // forehead + between-brow worry lines
    p.ink([[cx - 0.04, 0.262], [cx, 0.266], [cx + 0.045, 0.262]], W.hair, W.hair);
    p.ink([[cx - 0.006, 0.232], [cx - 0.004, 0.248]], W.hair, W.hair); p.ink([[cx + 0.008, 0.232], [cx + 0.007, 0.247]], W.hair, W.hair);
  }
  // nose (3/4: bridge line on shadow side, nostril, tip)
  p.ink([[cx + 0.012, 0.188], [cx + 0.016, 0.16], [cx + 0.02, 0.138]], W.fine, W.hair);
  p.ink([[cx - 0.014, 0.133], [cx - 0.004, 0.124], [cx + 0.012, 0.126], [cx + 0.024, 0.133]], W.mid, W.fine);
  p.dot([cx - 0.008, 0.128], 0.0032, 0.9); p.dot([cx + 0.014, 0.129], 0.0027, 0.9);
  p.lines([[cx + 0.016, 0.185], [cx + 0.03, 0.17], [cx + 0.03, 0.135], [cx + 0.02, 0.135]], 1.3, 0.0045, W.hair, 0.5);
  // nasolabial
  p.ink([[cx + 0.035, 0.135], [cx + 0.044, 0.105]], W.hair, W.hair, { a: 0.8 });
  p.ink([[cx - 0.03, 0.134], [cx - 0.04, 0.106]], W.hair, W.hair, { a: 0.6 });
  // mouth
  const my = 0.092;
  if (E.mouth === "smile") {
    p.ink([[cx - 0.03, my + 0.004], [cx - 0.01, my - 0.002], [cx + 0.012, my - 0.002], [cx + 0.031, my + 0.006]], W.mid, W.fine);
    p.ink([[cx - 0.012, my - 0.014], [cx + 0.014, my - 0.014]], W.hair, W.hair, { a: 0.7 });
  } else if (E.mouth === "o") {
    const m: V[] = p.ell([cx + 0.001, my - 0.006], 0.019, 0.024, 16);
    p.solid(m, true, 1); p.clear(p.ell([cx + 0.001, my + 0.011], 0.012, 0.004, 10), 1.0, 0); // teeth
    p.ink(m, W.mid, W.mid, { closed: true });
    p.ink([[cx - 0.01, my - 0.038], [cx + 0.012, my - 0.038]], W.hair, W.hair, { a: 0.7 });
  } else {
    // exhale: small pursed "o" pushed to one side + puffed cheek line
    const m: V[] = p.ell([cx + 0.006, my - 0.002], 0.009, 0.0075, 12);
    p.solid(m, true, 1);
    p.ink([[cx + 0.03, 0.115], [cx + 0.04, 0.095], [cx + 0.032, 0.075]], W.hair, W.hair);
    // breath puff (engraved curls) off to the side
    p.ink([[cx + 0.03, my - 0.006], [cx + 0.055, my - 0.002], [cx + 0.07, my - 0.012], [cx + 0.064, my - 0.022]], W.hair, W.hair, { a: 0.8 });
    // sweat drop on the temple
    const sd: V[] = [[0.098, 0.255], [0.104, 0.236], [0.098, 0.226], [0.092, 0.236]];
    p.clear(sd, 1.0, 0); p.ink(sd, W.hair, W.hair, { closed: true }); p.dot([0.096, 0.233], 0.002, 0.8);
  }
  p.ink(head, W.out, W.out, { closed: true });
}

function drawHelmet(p: Pen) {
  const dome: V[] = [[-0.152, 0.262], [-0.14, 0.33], [-0.1, 0.405], [0, 0.44], [0.1, 0.405], [0.14, 0.33], [0.152, 0.262]];
  const brim: V[] = [[-0.165, 0.268], [-0.15, 0.248], [0, 0.238], [0.15, 0.248], [0.165, 0.268], [0, 0.262]];
  p.base([...dome, [0.152, 0.262], [-0.152, 0.262]], ALB.helmet, 0, false);
  p.base(brim, ALB.helmet * 0.92, 0, false);
  p.ink(dome, W.out, W.out, { taper: 0.05 });
  p.ink(brim, W.mid, W.mid, { closed: true, taper: 0 });
  // ridge + side rib
  p.ink([[-0.005, 0.44], [-0.008, 0.30]], W.fine, W.mid);
  p.ink([[-0.07, 0.425], [-0.09, 0.3]], W.hair, W.fine); p.ink([[0.065, 0.428], [0.085, 0.3]], W.hair, W.fine);
  // lamp clip + headlamp housing
  p.base([[-0.04, 0.275], [0.03, 0.275], [0.03, 0.345], [-0.04, 0.345]], 0.4, 0, false);
  p.ink([[-0.04, 0.275], [0.03, 0.275], [0.03, 0.345], [-0.04, 0.345]], W.mid, W.mid, { closed: true, taper: 0 });
  p.clear(p.ell([-0.005, 0.31], 0.022, 0.022), 1.0, 0, false);
  p.ink(p.ell([-0.005, 0.31], 0.022, 0.022), W.mid, W.mid, { closed: true });
  p.ink([[-0.02, 0.31], [0.01, 0.31]], W.hair, W.hair, { a: 0.5 });
}

function drawUpperArm(p: Pen) {
  const s: V[] = [[-0.058, 0.03], [0.058, 0.03], [0.054, -0.15], [0.048, -0.3], [-0.048, -0.3], [-0.054, -0.15]];
  p.base(s, ALB.jacket, 1);
  const b: V[] = [[-0.054, -0.12], [0.054, -0.12], [0.052, -0.158], [-0.053, -0.158]];
  p.clear(b, ALB.tape, 0, false); p.ink([b[0], b[1]], W.fine); p.ink([b[2], b[3]], W.fine);
  p.ink([[-0.02, -0.22], [0.0, -0.25], [0.03, -0.24]], W.hair, W.hair);
  p.ink(s, W.out, W.out, { closed: true });
}
function drawForearm(p: Pen) {
  const s: V[] = [[-0.05, 0.02], [0.05, 0.02], [0.044, -0.13], [0.04, -0.235], [-0.04, -0.235], [-0.045, -0.13]];
  p.base(s, ALB.jacket, 1);
  const cf: V[] = [[-0.041, -0.2], [0.041, -0.2], [0.042, -0.24], [-0.042, -0.24]];
  p.base(cf, ALB.jacket * 0.9, 1, false); p.ink([cf[0], cf[1]], W.fine);
  p.ink([[-0.03, -0.06], [0.0, -0.08], [0.025, -0.07]], W.hair, W.hair);
  p.ink(s, W.out, W.out, { closed: true });
}
function drawHand(p: Pen, wrench: boolean) {
  // work glove: palm + 4 finger divisions + thumb; big (1.2x) for readability
  const s: V[] = [[-0.042, 0.01], [0.042, 0.01], [0.05, -0.06], [0.046, -0.12], [0.03, -0.155], [-0.025, -0.158], [-0.045, -0.12], [-0.05, -0.06]];
  p.base(s, ALB.glove);
  p.ink([[-0.04, -0.005], [0.04, -0.005]], W.fine);
  for (const x of [-0.018, 0.004, 0.025]) p.ink([[x, -0.085], [x + 0.001, -0.15]], W.hair, W.hair);
  const th: V[] = [[-0.045, -0.03], [-0.07, -0.06], [-0.075, -0.095], [-0.06, -0.1], [-0.044, -0.075]];
  p.base(th, ALB.glove); p.ink(th, W.mid, W.mid, { closed: true });
  p.ink(s, W.out, W.out, { closed: true });
  if (wrench) {
    const wr: V[] = [[-0.012, -0.05], [0.012, -0.05], [0.012, -0.33], [-0.012, -0.33]];
    p.base(wr, ALB.steel + 0.15, 0, false);
    p.ink(wr, W.mid, W.mid, { closed: true, taper: 0 });
    const jaw: V[] = [[-0.03, -0.33], [0.03, -0.33], [0.035, -0.375], [0.012, -0.385], [0.012, -0.36], [-0.012, -0.36], [-0.012, -0.385], [-0.035, -0.375]];
    p.base(jaw, ALB.steel + 0.15, 0, false); p.ink(jaw, W.mid, W.mid, { closed: true, taper: 0 });
    p.ink([[0.004, -0.07], [0.005, -0.31]], W.hair, W.hair, { a: 0.6 });
    // re-draw fingers over the handle
    p.base([[-0.04, -0.05], [0.045, -0.05], [0.045, -0.12], [-0.04, -0.12]], ALB.glove, 0, false);
    p.ink([[-0.04, -0.05], [0.045, -0.05], [0.045, -0.12], [-0.04, -0.12]], W.fine, W.fine, { closed: true, taper: 0 });
    for (const y of [-0.068, -0.086, -0.104]) p.ink([[-0.03, y], [0.04, y]], W.hair, W.hair);
  }
}
function drawThigh(p: Pen) {
  const s: V[] = [[-0.092, 0.04], [0.092, 0.04], [0.082, -0.2], [0.07, -0.42], [-0.07, -0.42], [-0.084, -0.2]];
  p.base(s, ALB.trousers);
  const pk: V[] = [[0.0, -0.14], [0.06, -0.14], [0.058, -0.26], [0.002, -0.26]];
  p.ink(pk, W.fine, W.fine, { closed: true, taper: 0 }); p.ink([[0.0, -0.165], [0.06, -0.165]], W.hair);
  p.ink([[-0.05, -0.05], [-0.02, -0.1], [-0.03, -0.18]], W.hair, W.hair);
  p.ink(s, W.out, W.out, { closed: true });
}
function drawShin(p: Pen) {
  const s: V[] = [[-0.072, 0.03], [0.072, 0.03], [0.066, -0.2], [0.062, -0.37], [-0.062, -0.37], [-0.066, -0.2]];
  p.base(s, ALB.trousers);
  const kp: V[] = [[-0.07, 0.035], [0.07, 0.035], [0.066, -0.09], [-0.066, -0.09]];
  p.base(kp, 0.5, 0); p.ink(kp, W.mid, W.mid, { closed: true });
  p.ink([[-0.05, -0.02], [0.05, -0.02]], W.hair, W.hair); p.ink([[-0.05, -0.055], [0.05, -0.055]], W.hair, W.hair);
  p.ink([[-0.054, -0.34], [0.054, -0.34]], W.fine);
  p.ink(s, W.out, W.out, { closed: true });
}
function drawBoot(p: Pen) {
  const s: V[] = [[-0.058, 0.02], [0.058, 0.02], [0.065, -0.05], [0.07, -0.085], [-0.1, -0.085], [-0.105, -0.06], [-0.08, -0.04]];
  p.base(s, ALB.boot);
  p.base([[-0.108, -0.068], [0.072, -0.068], [0.072, -0.095], [-0.108, -0.095]], 0.15, 0, false);
  p.ink([[-0.108, -0.068], [0.072, -0.068]], W.fine, W.fine, { taper: 0 });
  for (let x = -0.1; x < 0.07; x += 0.016) p.ink([[x, -0.075], [x + 0.006, -0.093]], W.hair, W.hair, { taper: 0 });
  for (const y of [0.0, -0.02, -0.04]) p.ink([[-0.03, y], [0.02, y - 0.004]], W.hair, W.hair);
  p.ink([[-0.105, -0.06], [-0.07, -0.03], [-0.04, -0.04]], W.fine);
  p.ink([...s, [-0.108, -0.095], [0.072, -0.095]], W.out, W.out, { closed: false, taper: 0.02 });
}

// ---------------------------------------------------------------- rig
type PartDef = { name: string; parent?: string; pivot: V; bb: [number, number, number, number]; z: number; ppm: number; R: number; ang: number; draw: (p: Pen, ex: Expr) => void; exprs?: boolean };

const PARTS: PartDef[] = [
  { name: "thighL", pivot: [-0.088, -0.02], bb: [-0.1, -0.43, 0.1, 0.05], z: 0.01, ppm: 700, R: 0.08, ang: 82, draw: drawThigh },
  { name: "shinL", parent: "thighL", pivot: [0, -0.41], bb: [-0.08, -0.38, 0.08, 0.045], z: 0.005, ppm: 700, R: 0.06, ang: 84, draw: drawShin },
  { name: "bootL", parent: "shinL", pivot: [0, -0.36], bb: [-0.115, -0.1, 0.08, 0.03], z: 0.006, ppm: 800, R: 0.05, ang: 10, draw: drawBoot },
  { name: "thighR", pivot: [0.088, -0.02], bb: [-0.1, -0.43, 0.1, 0.05], z: 0.012, ppm: 700, R: 0.08, ang: 98, draw: drawThigh },
  { name: "shinR", parent: "thighR", pivot: [0, -0.41], bb: [-0.08, -0.38, 0.08, 0.045], z: 0.005, ppm: 700, R: 0.06, ang: 96, draw: drawShin },
  { name: "bootR", parent: "shinR", pivot: [0, -0.36], bb: [-0.115, -0.1, 0.08, 0.03], z: 0.006, ppm: 800, R: 0.05, ang: 10, draw: drawBoot },
  { name: "torso", pivot: [0, 0.02], bb: [-0.25, -0.2, 0.28, 0.61], z: 0.03, ppm: 700, R: 0.17, ang: 32, draw: drawTorso },
  { name: "pelvis", pivot: [0, 0], bb: [-0.19, -0.17, 0.19, 0.07], z: 0.02, ppm: 700, R: 0.12, ang: 28, draw: drawPelvis },
  { name: "head", parent: "torso", pivot: [0, 0.525], bb: [-0.15, -0.02, 0.15, 0.39], z: 0.02, ppm: 1500, R: 0.11, ang: 38, draw: drawHead, exprs: true },
  { name: "helmet", parent: "head", pivot: [0, 0], bb: [-0.17, 0.23, 0.17, 0.45], z: 0.012, ppm: 1300, R: 0.12, ang: 20, draw: drawHelmet },
  { name: "uArmL", parent: "torso", pivot: [-0.205, 0.465], bb: [-0.07, -0.31, 0.07, 0.045], z: 0.03, ppm: 700, R: 0.05, ang: 80, draw: drawUpperArm },
  { name: "fArmL", parent: "uArmL", pivot: [0, -0.285], bb: [-0.06, -0.25, 0.06, 0.035], z: 0.004, ppm: 700, R: 0.045, ang: 80, draw: drawForearm },
  { name: "handL", parent: "fArmL", pivot: [0, -0.225], bb: [-0.085, -0.17, 0.06, 0.02], z: 0.004, ppm: 900, R: 0.04, ang: 60, draw: (p) => drawHand(p, false) },
  { name: "uArmR", parent: "torso", pivot: [0.205, 0.465], bb: [-0.07, -0.31, 0.07, 0.045], z: 0.03, ppm: 700, R: 0.05, ang: 100, draw: drawUpperArm },
  { name: "fArmR", parent: "uArmR", pivot: [0, -0.285], bb: [-0.06, -0.25, 0.06, 0.035], z: 0.004, ppm: 700, R: 0.045, ang: 100, draw: drawForearm },
  { name: "handR", parent: "fArmR", pivot: [0, -0.225], bb: [-0.085, -0.4, 0.06, 0.02], z: 0.004, ppm: 900, R: 0.04, ang: 120, draw: (p) => drawHand(p, true) },
];

export type Pose = Record<string, number> & { rootY?: number; rootX?: number };
export const POSES: Record<string, Pose> = {
  idle: { torso: 0.025, head: -0.07, uArmL: -0.13, fArmL: -0.08, handL: -0.05, uArmR: 0.15, fArmR: 0.38, handR: 0.12, thighL: -0.05, shinL: 0.03, bootL: 0.02, thighR: 0.08, shinR: -0.05, bootR: -0.03, rootY: 0 },
  alarm: { torso: -0.05, head: 0.14, uArmL: -1.25, fArmL: -0.55, handL: -0.3, uArmR: 1.15, fArmR: 0.6, handR: 0.25, thighL: -0.2, shinL: 0.36, bootL: -0.16, thighR: 0.2, shinR: -0.36, bootR: 0.16, rootY: -0.02 },
  relieved: { torso: 0.05, head: -0.12, uArmL: -0.3, fArmL: 2.45, handL: 0.15, uArmR: 0.14, fArmR: 0.25, handR: 0.1, thighL: -0.08, shinL: 0.08, bootL: 0, thighR: 0.08, shinR: -0.08, bootR: 0, rootY: -0.01 },
};

export function blendPose(a: Pose, b: Pose, t: number): Pose {
  const o: Pose = {} as Pose;
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) (o as any)[k] = ((a as any)[k] ?? 0) + (((b as any)[k] ?? 0) - ((a as any)[k] ?? 0)) * t;
  return o;
}

type Built = { def: PartDef; tex: Partial<Record<Expr, THREE.CanvasTexture>>; nrm: THREE.CanvasTexture; geo: THREE.PlaneGeometry };
let CACHE: Built[] | null = null;
function buildParts(): Built[] {
  if (CACHE) return CACHE;
  CACHE = PARTS.map((def) => {
    const exprs: Expr[] = def.exprs ? ["calm", "alarmed", "relieved", "blink"] : ["calm"];
    const tex: Built["tex"] = {}; let nrm: THREE.CanvasTexture | null = null;
    for (const ex of exprs) {
      const p = new Pen(def.bb, def.ppm); def.draw(p, ex);
      const t = new THREE.CanvasTexture(p.c); t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4; t.premultiplyAlpha = false;
      tex[ex] = t;
      if (!nrm) { const n = new THREE.CanvasTexture(normalCanvas(p.c, def.R, def.ppm)); n.colorSpace = THREE.NoColorSpace; nrm = n; }
    }
    const [x0, y0, x1, y1] = def.bb;
    const geo = new THREE.PlaneGeometry(x1 - x0, y1 - y0); geo.translate((x0 + x1) / 2, (y0 + y1) / 2, 0);
    return { def, tex, nrm: nrm!, geo };
  });
  return CACHE;
}

export class Figure {
  root = new THREE.Group();   // placed at hip height on the floor; yaw toward camera
  shadow = new THREE.Group(); // invisible twin, yawed toward the key light, casts the shadow
  joints: Record<string, THREE.Group> = {}; sj: Record<string, THREE.Group> = {};
  headMat: THREE.MeshPhongMaterial | null = null; headTex: Built["tex"] = {};
  lampAnchor = new THREE.Object3D();
  constructor() {
    const parts = buildParts();
    for (const twin of [false, true]) {
      const J: Record<string, THREE.Group> = {};
      for (const b of parts) {
        const g = new THREE.Group(); g.position.set(b.def.pivot[0], b.def.pivot[1], b.def.z);
        const [x0, y0, x1, y1] = b.def.bb;
        const t0 = b.tex.calm!;
        let mesh: THREE.Mesh;
        if (!twin) {
          const m = inkMat({ kind: KIND.char, map: t0, normalMap: b.nrm, alphaTest: 0.5, albedo: 1, angle: b.def.ang, uvScale: [x1 - x0, y1 - y0], side: THREE.DoubleSide, spot: SPOT.amber, shininess: 18, spec: 0.08 });
          mesh = new THREE.Mesh(b.geo, m);
          if (b.def.exprs) { this.headMat = m; this.headTex = b.tex; }
        } else {
          const m = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide });
          mesh = new THREE.Mesh(b.geo, m); mesh.castShadow = true;
          mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: t0, alphaTest: 0.5, side: THREE.DoubleSide });
        }
        mesh.renderOrder = 2;
        g.add(mesh); J[b.def.name] = g;
      }
      for (const b of parts) (b.def.parent ? J[b.def.parent] : (twin ? this.shadow : this.root)).add(J[b.def.name]);
      if (twin) this.sj = J; else this.joints = J;
    }
    this.lampAnchor.position.set(-0.005, 0.31, 0.03);
    this.joints.helmet.add(this.lampAnchor);
  }
  setPose(p: Pose) {
    for (const J of [this.joints, this.sj]) for (const k in J) J[k].rotation.z = (p as any)[k] ?? 0;
    this.root.userData.dy = p.rootY ?? 0;
  }
  setExpr(ex: Expr) { if (this.headMat) { const t = this.headTex[ex]; if (t && this.headMat.map !== t) { this.headMat.map = t; } } }
  // world placement: feet on floorY at (x,z); faces camera (yaw only); shadow twin faces the light
  place(x: number, floorY: number, z: number, camPos: THREE.Vector3, lightPos: THREE.Vector3) {
    const y = floorY + 0.86 + (this.root.userData.dy ?? 0);
    this.root.position.set(x, y, z); this.shadow.position.set(x, y, z);
    this.root.rotation.y = Math.atan2(camPos.x - x, camPos.z - z);
    this.shadow.rotation.y = Math.atan2(lightPos.x - x, lightPos.z - z);
  }
  feet(): THREE.Vector3[] {
    this.root.updateMatrixWorld(true);
    return ["bootL", "bootR"].map((k) => new THREE.Vector3(-0.015, -0.085, 0).applyMatrix4(this.joints[k].matrixWorld));
  }
}
