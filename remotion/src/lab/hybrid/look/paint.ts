// [hybrid/look, owned by the Look TD] Gouache painting kit (look v2: strokes are more opaque => crisper): seeded RNG, colour helpers, a Canvas2D "painter" that fills shapes with opaque,
// slightly chalky gouache (flat field + brush strokes + dry-brush scumble + darker-hue edge), and the
// code-painted textures of the shaft. Everything is deterministic (seeded) so every frame/worker matches.
import * as THREE from "three";

export const rng = (seed: number) => {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
};

// ---------- colour ----------
export type HSL = [number, number, number];
export function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHsl(r: number, g: number, b: number): HSL {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return [h * 360, s, l];
}
export const hsl = (h: number, s: number, l: number, a = 1) =>
  `hsla(${((h % 360) + 360) % 360},${Math.max(0, Math.min(100, s * 100))}%,${Math.max(0, Math.min(100, l * 100))}%,${a})`;
/** shift a hex colour: dh degrees, ds/dl absolute */
export function shade(hex: string, dl: number, ds = 0, dh = 0, a = 1) {
  const [h, s, l] = rgbToHsl(...hexToRgb(hex));
  return hsl(h + dh, s + ds, l + dl, a);
}
/** "edge" colour: darker, more saturated version of the same hue, nudged cool (painted edge, never black) */
export const edgeOf = (hex: string, k = 1) => shade(hex, -0.2 * k, 0.12 * k, 8 * k);

// ---------- canvas ----------
export function canvas(w: number, h: number) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  return c;
}
export function toTex(c: HTMLCanvasElement, opts: { srgb?: boolean; repeat?: [number, number]; aniso?: number } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = opts.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = opts.aniso ?? 4;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...opts.repeat); }
  t.needsUpdate = true;
  return t;
}

export type Pt = [number, number];
/** closed smooth path through points (quadratic through midpoints) */
export function smoothPath(g: CanvasRenderingContext2D | Path2D, pts: Pt[], closed = true) {
  const n = pts.length;
  if (n < 3) { g.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach((p) => g.lineTo(p[0], p[1])); return; }
  if (!closed) {
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < n - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      g.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    g.lineTo(pts[n - 1][0], pts[n - 1][1]);
    return;
  }
  const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = mid(pts[n - 1], pts[0]);
  g.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) {
    const m = mid(pts[i], pts[(i + 1) % n]);
    g.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
  }
  g.closePath();
}

/**
 * Painter in a design space (e.g. body centimetres, y up). mode "paint" = gouache; mode "line" = the
 * cyanotype under-drawing (every shape is stroked instead of filled; texture strokes are skipped).
 */
export class Painter {
  g: CanvasRenderingContext2D;
  r: () => number;
  constructor(public c: HTMLCanvasElement, public mode: "paint" | "line", public x0: number, public y1: number, public ppu: number, seed = 1) {
    this.g = c.getContext("2d")!;
    this.r = rng(seed);
    this.g.lineJoin = "round"; this.g.lineCap = "round";
  }
  X = (x: number) => (x - this.x0) * this.ppu;
  Y = (y: number) => (this.y1 - y) * this.ppu;
  /** design-space points -> canvas path, optionally roughened (painted edge wobble) */
  path(pts: Pt[], rough = 0.25, closed = true) {
    const p = new Path2D();
    const q: Pt[] = pts.map(([x, y]) => [this.X(x) + (this.r() - 0.5) * rough * this.ppu, this.Y(y) + (this.r() - 0.5) * rough * this.ppu]);
    smoothPath(p, q, closed);
    return p;
  }
  /** opaque gouache fill: base + directional strokes + scumble + darker-hue edge */
  fill(pts: Pt[], base: string, o: { strokes?: number; ang?: number; var?: number; edge?: number; rough?: number; lineW?: number; scumble?: number; hi?: string; hiDir?: Pt } = {}) {
    const g = this.g, p = this.path(pts, o.rough ?? 0.25);
    if (this.mode === "line") {
      if ((o.lineW ?? 1) <= 0) return p;
      g.save(); g.strokeStyle = "#fff"; g.lineWidth = Math.max(1.6, 0.42 * this.ppu * (o.lineW ?? 1)); g.stroke(p); g.restore();
      return p;
    }
    g.save();
    g.fillStyle = base; g.fill(p);
    g.clip(p);
    // bbox
    let mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9;
    pts.forEach(([x, y]) => { mnx = Math.min(mnx, this.X(x)); mxx = Math.max(mxx, this.X(x)); mny = Math.min(mny, this.Y(y)); mxy = Math.max(mxy, this.Y(y)); });
    const w = mxx - mnx, h = mxy - mny, area = w * h;
    // highlight wash (painted form light), from hiDir side
    if (o.hi) {
      const d = o.hiDir ?? [-1, 1];
      const cx = (mnx + mxx) / 2 + d[0] * w * 0.35, cy = (mny + mxy) / 2 - d[1] * h * 0.35;
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.8);
      gr.addColorStop(0, o.hi); gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr; g.fillRect(mnx, mny, w, h);
    }
    const n = o.strokes ?? Math.min(400, Math.round(area / (this.ppu * this.ppu * 4)) + 6);
    const ang = o.ang ?? 0.6, v = o.var ?? 0.05;
    const [hh, ss, ll] = base.startsWith("#") ? rgbToHsl(...hexToRgb(base)) : [0, 0, 0.5];
    for (let i = 0; i < n; i++) {
      const x = mnx + this.r() * w, y = mny + this.r() * h;
      const len = (0.6 + this.r() * 1.8) * this.ppu * 2.2, a = ang + (this.r() - 0.5) * 0.5;
      g.strokeStyle = hsl(hh + (this.r() - 0.5) * 8, ss + (this.r() - 0.5) * 0.1, ll + (this.r() - 0.5) * 2 * v, 0.28 + this.r() * 0.3);
      g.lineWidth = (0.35 + this.r() * 0.9) * this.ppu;
      g.beginPath(); g.moveTo(x - Math.cos(a) * len, y - Math.sin(a) * len);
      g.quadraticCurveTo(x + (this.r() - 0.5) * len * 0.4, y + (this.r() - 0.5) * len * 0.4, x + Math.cos(a) * len, y + Math.sin(a) * len);
      g.stroke();
    }
    // dry-brush scumble: light chalky specks (gouache tooth)
    const sc = o.scumble ?? 0.5;
    if (sc > 0) {
      const m = Math.round(area / (this.ppu * this.ppu) * 0.9 * sc);
      for (let i = 0; i < m; i++) {
        g.fillStyle = hsl(hh, ss * 0.6, Math.min(0.95, ll + 0.12 + this.r() * 0.1), 0.10 + this.r() * 0.12);
        const s = (0.12 + this.r() * 0.3) * this.ppu;
        g.fillRect(mnx + this.r() * w, mny + this.r() * h, s, s * (0.5 + this.r()));
      }
    }
    // darker-hue edge (painted contour, not ink)
    const e = o.edge ?? 1;
    if (e > 0 && base.startsWith("#")) {
      g.strokeStyle = edgeOf(base, 1); g.globalAlpha = 0.85 * Math.min(1, e);
      g.lineWidth = 0.55 * this.ppu * e; g.stroke(p);
      g.globalAlpha = 0.35; g.lineWidth = 1.3 * this.ppu * e; g.stroke(p);
    }
    g.restore();
    return p;
  }
  /** soft painted shadow/light wash inside a region (multiply-like via alpha) */
  wash(pts: Pt[], color: string, rough = 0.5) {
    if (this.mode === "line") return;
    const g = this.g; g.save(); g.fillStyle = color; g.fill(this.path(pts, rough)); g.restore();
  }
  /** a single brush stroke along points */
  stroke(pts: Pt[], color: string, w: number, o: { line?: boolean; alpha?: number } = {}) {
    const g = this.g;
    if (this.mode === "line") {
      if (!o.line) return;
      g.save(); g.strokeStyle = "#fff"; g.lineWidth = Math.max(1.6, 0.4 * this.ppu); g.beginPath();
      smoothPath(g, pts.map(([x, y]) => [this.X(x), this.Y(y)] as Pt), false); g.stroke(); g.restore(); return;
    }
    g.save(); g.strokeStyle = color; g.globalAlpha = o.alpha ?? 1; g.lineWidth = w * this.ppu; g.beginPath();
    smoothPath(g, pts.map(([x, y]) => [this.X(x) + (this.r() - 0.5) * 0.1 * this.ppu, this.Y(y)] as Pt), false); g.stroke(); g.restore();
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, rot: number, color: string, line = false) {
    const g = this.g;
    g.save(); g.beginPath(); g.ellipse(this.X(cx), this.Y(cy), rx * this.ppu, ry * this.ppu, rot, 0, Math.PI * 2);
    if (this.mode === "line") { if (line) { g.strokeStyle = "#fff"; g.lineWidth = Math.max(1.6, 0.4 * this.ppu); g.stroke(); } }
    else { g.fillStyle = color; g.fill(); }
    g.restore();
  }
}

/** tangent-space normal map from a painted card: pillow from blurred alpha + a little painted relief */
export function normalFromCanvas(src: HTMLCanvasElement, radius: number, strength = 2.2, relief = 0.35) {
  const w = src.width, h = src.height;
  const d = src.getContext("2d")!.getImageData(0, 0, w, h).data;
  let a = new Float32Array(w * h), lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) { a[i] = d[i * 4 + 3] / 255; lum[i] = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) / 255 * a[i]; }
  const blur = (f: Float32Array, r: number) => {
    const t = new Float32Array(w * h), o = new Float32Array(w * h);
    for (let y = 0; y < h; y++) { let s = 0; for (let x = -r; x <= r; x++) s += f[y * w + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) { t[y * w + x] = s / (2 * r + 1); s += f[y * w + Math.min(w - 1, x + r + 1)] - f[y * w + Math.max(0, x - r)]; } }
    for (let x = 0; x < w; x++) { let s = 0; for (let y = -r; y <= r; y++) s += t[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) { o[y * w + x] = s / (2 * r + 1); s += t[Math.min(h - 1, y + r + 1) * w + x] - t[Math.max(0, y - r) * w + x]; } }
    return o;
  };
  let hgt = blur(blur(a, radius), radius);
  for (let i = 0; i < w * h; i++) hgt[i] = Math.sqrt(Math.max(0, hgt[i]));
  const lb = blur(lum, 2);
  const out = canvas(w, h), og = out.getContext("2d")!, img = og.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, xl = y * w + Math.max(0, x - 1), xr = y * w + Math.min(w - 1, x + 1), yu = Math.max(0, y - 1) * w + x, yd = Math.min(h - 1, y + 1) * w + x;
    const dx = (hgt[xr] - hgt[xl]) * radius * strength * 0.5 + (lb[xr] - lb[xl]) * relief * 6;
    const dy = (hgt[yd] - hgt[yu]) * radius * strength * 0.5 + (lb[yd] - lb[yu]) * relief * 6;
    let nx = -dx, ny = dy, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    img.data[i * 4] = (nx * 0.5 + 0.5) * 255; img.data[i * 4 + 1] = (ny * 0.5 + 0.5) * 255; img.data[i * 4 + 2] = (nz * 0.5 + 0.5) * 255; img.data[i * 4 + 3] = 255;
  }
  og.putImageData(img, 0, 0);
  void a; a = new Float32Array(0); lum = new Float32Array(0);
  return out;
}

// ---------- environment textures ----------
const cache = new Map<string, THREE.Texture>();
const memo = (k: string, f: () => THREE.Texture) => { if (!cache.has(k)) cache.set(k, f()); return cache.get(k)!; };

/** tileable brush-stroke field (grey), used to break up light-ramp thresholds and as haze noise */
export const brushTex = () => memo("brush", () => {
  const S = 512, c = canvas(S, S), g = c.getContext("2d")!, r = rng(7);
  g.fillStyle = "#808080"; g.fillRect(0, 0, S, S);
  g.lineCap = "round";
  for (let i = 0; i < 900; i++) {
    const x = r() * S, y = r() * S, len = 14 + r() * 46, a = 0.5 + (r() - 0.5) * 0.9, v = Math.round(60 + r() * 140);
    g.strokeStyle = `rgba(${v},${v},${v},${0.5 + r() * 0.4})`; g.lineWidth = 4 + r() * 12; // opaque gouache strokes: crisp breakup edges
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
      g.beginPath(); g.moveTo(x + ox - Math.cos(a) * len, y + oy - Math.sin(a) * len);
      g.quadraticCurveTo(x + ox + (r() - 0.5) * 10, y + oy + (r() - 0.5) * 10, x + ox + Math.cos(a) * len, y + oy + Math.sin(a) * len); g.stroke();
    }
  }
  return toTex(c, { srgb: false, repeat: [1, 1] });
});

/** soft cloudy noise (tileable) for haze sheets */
export const hazeTex = () => memo("haze", () => {
  const S = 256, c = canvas(S, S), g = c.getContext("2d")!, r = rng(11);
  g.fillStyle = "#000"; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 260; i++) {
    const x = r() * S, y = r() * S, rad = 10 + r() * 50, v = r();
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
      gr.addColorStop(0, `rgba(255,255,255,${0.10 * v})`); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
    }
  }
  // vertical wisps (rising dust)
  g.lineCap = "round";
  for (let i = 0; i < 70; i++) {
    const x = r() * S, y = r() * S, len = 30 + r() * 90;
    g.strokeStyle = `rgba(255,255,255,${0.05 + r() * 0.06})`; g.lineWidth = 3 + r() * 9;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { g.beginPath(); g.moveTo(x + ox, y + oy); g.quadraticCurveTo(x + ox + 12, y + oy - len / 2, x + ox - 4, y + oy - len); g.stroke(); }
  }
  return toTex(c, { srgb: false, repeat: [1, 1] });
});

function painterlyField(key: string, S: number, base: string, seed: number, draw: (g: CanvasRenderingContext2D, r: () => number, S: number) => void, repeat: [number, number]) {
  return memo(key, () => {
    const c = canvas(S, S), g = c.getContext("2d")!, r = rng(seed);
    g.fillStyle = base; g.fillRect(0, 0, S, S);
    draw(g, r, S);
    return toTex(c, { repeat, aniso: 8 });
  });
}
const wrapDraw = (S: number, f: (ox: number, oy: number) => void) => { for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) f(ox, oy); };

function blotches(g: CanvasRenderingContext2D, r: () => number, S: number, cols: string[], n: number, rmin: number, rmax: number) {
  for (let i = 0; i < n; i++) {
    const x = r() * S, y = r() * S, rad = rmin + r() * (rmax - rmin), col = cols[Math.floor(r() * cols.length)];
    wrapDraw(S, (ox, oy) => {
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
      gr.addColorStop(0, col); gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr; g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
    });
  }
}
function strokesField(g: CanvasRenderingContext2D, r: () => number, S: number, hex: string, n: number, ang: number, len: number, wid: number, vl: number) {
  const [h, s, l] = rgbToHsl(...hexToRgb(hex));
  g.lineCap = "round";
  for (let i = 0; i < n; i++) {
    const x = r() * S, y = r() * S, a = ang + (r() - 0.5) * 0.6, L = len * (0.5 + r());
    g.strokeStyle = hsl(h + (r() - 0.5) * 14, s + (r() - 0.5) * 0.12, l + (r() - 0.5) * 2 * vl, 0.42 + r() * 0.4); // opaque, crisp-edged strokes (look v2)
    g.lineWidth = wid * (0.5 + r());
    wrapDraw(S, (ox, oy) => { g.beginPath(); g.moveTo(x + ox - Math.cos(a) * L, y + oy - Math.sin(a) * L); g.quadraticCurveTo(x + ox + (r() - 0.5) * 8, y + oy + (r() - 0.5) * 8, x + ox + Math.cos(a) * L, y + oy + Math.sin(a) * L); g.stroke(); });
  }
}
function chalk(g: CanvasRenderingContext2D, r: () => number, S: number, n: number, light: string) {
  for (let i = 0; i < n; i++) { g.fillStyle = light; g.globalAlpha = 0.05 + r() * 0.12; const s = 1 + r() * 2.5; g.fillRect(r() * S, r() * S, s, s * (0.4 + r())); }
  g.globalAlpha = 1;
}

/** board-formed concrete: cool grey-green, form-board bands, tie holes, water stains, painted chalkiness */
export const concreteTex = () => painterlyField("concrete", 1024, "#6E7C7E", 21, (g, r, S) => {
  blotches(g, r, S, ["rgba(86,98,104,0.55)", "rgba(132,140,132,0.45)", "rgba(96,92,104,0.45)", "rgba(150,146,128,0.25)"], 70, 40, 220);
  strokesField(g, r, S, "#74828A", 900, 0.02, 40, 9, 0.07);
  // form-board seams every 1/4 (horizontal) - dark tinted bands with a lit lip
  for (let k = 0; k < 4; k++) {
    const y = (k + 0.5) * S / 4 + (r() - 0.5) * 6;
    g.fillStyle = "rgba(40,52,62,0.55)"; g.fillRect(0, y, S, 5);
    g.fillStyle = "rgba(170,176,166,0.25)"; g.fillRect(0, y + 5, S, 3);
  }
  // tie holes
  for (let k = 0; k < 4; k++) for (let j = 0; j < 4; j++) {
    const x = (j + 0.5) * S / 4, y = (k + 0.15) * S / 4;
    g.fillStyle = "rgba(30,38,50,0.8)"; g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill();
    g.fillStyle = "rgba(160,166,160,0.3)"; g.beginPath(); g.arc(x + 2, y + 3, 6, 0, 3.14); g.fill();
  }
  // vertical water/rust stains (sepia-violet, not orange)
  for (let i = 0; i < 26; i++) {
    const x = r() * S, y0 = r() * S, L = 80 + r() * 300, w = 6 + r() * 26;
    const gr = g.createLinearGradient(0, y0, 0, y0 + L);
    gr.addColorStop(0, "rgba(70,62,72,0.45)"); gr.addColorStop(1, "rgba(70,62,72,0)");
    g.fillStyle = gr; wrapDraw(S, (ox, oy) => g.fillRect(x + ox, y0 + oy, w, L));
  }
  chalk(g, r, S, 9000, "#D8DCCF");
}, [1, 1]);

/** painted brick: muted umber-violet bricks, cool mortar, per-brick jitter, darker seams, chalky tops */
export const brickTex = () => painterlyField("brick", 1024, "#5A5F66", 33, (g, r, S) => {
  const rows = 16, cols = 4, bh = S / rows, bw = S / cols;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols + 1; x++) {
    const ox = (y % 2) * bw / 2, X = x * bw - ox, Y = y * bh;
    const l = 0.30 + r() * 0.12, h = 340 + r() * 26, s = 0.10 + r() * 0.08; // muted umber-violet: red is reserved for danger
    g.fillStyle = hsl(h, s, l); g.fillRect(X + 4, Y + 4, bw - 8, bh - 8);
    // painted strokes on the brick
    for (let k = 0; k < 14; k++) {
      g.strokeStyle = hsl(h + (r() - 0.5) * 16, s, l + (r() - 0.5) * 0.12, 0.35); g.lineWidth = 3 + r() * 7;
      const yy = Y + 6 + r() * (bh - 12); g.beginPath(); g.moveTo(X + 6 + r() * 20, yy); g.lineTo(X + bw - 10 - r() * 20, yy + (r() - 0.5) * 6); g.stroke();
    }
    g.fillStyle = hsl(h, s * 0.6, l + 0.12, 0.35); g.fillRect(X + 6, Y + 5, bw - 12, 3); // lit top lip
    g.fillStyle = "rgba(25,22,40,0.45)"; g.fillRect(X + 4, Y + bh - 7, bw - 8, 3);       // shaded under-lip
  }
  blotches(g, r, S, ["rgba(40,46,64,0.35)", "rgba(120,110,96,0.18)"], 40, 60, 200);
  chalk(g, r, S, 7000, "#D6D0C4");
}, [1, 1]);

/** painted steel: blue-grey, vertical brushed streaks, chips, oily patches */
export const steelTex = (key = "steel", base = "#4E5C6A", seed = 5) => painterlyField(key, 512, base, seed, (g, r, S) => {
  strokesField(g, r, S, base, 700, Math.PI / 2, 30, 4, 0.08);
  blotches(g, r, S, ["rgba(20,24,40,0.35)", "rgba(150,160,170,0.18)"], 30, 20, 90);
  for (let i = 0; i < 140; i++) { g.fillStyle = `rgba(190,196,200,${0.15 + r() * 0.3})`; g.fillRect(r() * S, r() * S, 1 + r() * 4, 1 + r() * 2); }
  chalk(g, r, S, 2000, "#C8D0D8");
}, [1, 1]);

/** car roof sheet: dusty grey-teal paint, footprints, oil, a pale walkway band */
export const roofTex = () => painterlyField("roof", 1024, "#56676A", 41, (g, r, S) => {
  blotches(g, r, S, ["rgba(70,84,88,0.5)", "rgba(110,118,112,0.35)", "rgba(40,44,60,0.4)"], 60, 30, 160);
  strokesField(g, r, S, "#5E6E72", 1100, 0.15, 36, 8, 0.07);
  // checker tread dimples
  for (let y = 0; y < S; y += 32) for (let x = (y / 32) % 2 * 16; x < S; x += 32) {
    g.save(); g.translate(x, y); g.rotate(((x + y) / 32) % 2 ? 0.7 : -0.7);
    g.fillStyle = "rgba(30,38,52,0.35)"; g.fillRect(-9, -2, 18, 4); g.fillStyle = "rgba(170,178,170,0.2)"; g.fillRect(-9, -3, 18, 1.5); g.restore();
  }
  // oil stain + boot scuffs
  blotches(g, r, S, ["rgba(20,22,38,0.55)"], 5, 40, 110);
  for (let i = 0; i < 30; i++) { g.save(); g.translate(r() * S, r() * S); g.rotate(r() * 6); g.fillStyle = "rgba(150,150,140,0.16)"; g.beginPath(); g.ellipse(0, 0, 28, 11, 0, 0, 7); g.fill(); g.restore(); }
  chalk(g, r, S, 9000, "#D2D6CC");
}, [1, 1]);

/** car side panel: deep green-teal enamel with vertical panel seams and rivets */
export const panelTex = () => painterlyField("panel", 1024, "#2F5452", 51, (g, r, S) => {
  strokesField(g, r, S, "#335A57", 800, Math.PI / 2, 50, 10, 0.06);
  blotches(g, r, S, ["rgba(20,30,46,0.35)", "rgba(90,120,110,0.22)"], 40, 40, 200);
  for (let k = 0; k < 3; k++) {
    const x = (k + 0.5) * S / 3;
    g.fillStyle = "rgba(14,24,34,0.7)"; g.fillRect(x - 3, 0, 6, S);
    g.fillStyle = "rgba(130,170,160,0.3)"; g.fillRect(x + 3, 0, 3, S);
    for (let y = 16; y < S; y += 48) { g.fillStyle = "rgba(160,190,180,0.5)"; g.beginPath(); g.arc(x - 14, y, 3.5, 0, 7); g.arc(x + 16, y, 3.5, 0, 7); g.fill(); }
  }
  chalk(g, r, S, 5000, "#B8D0C4");
}, [1, 1]);

/** cyanotype paper: navy with mottled pigment and a faint wash texture */
export const paperTex = () => painterlyField("paper", 512, "#0B1A33", 61, (g, r, S) => {
  blotches(g, r, S, ["rgba(20,44,80,0.45)", "rgba(6,14,30,0.5)", "rgba(30,60,96,0.25)"], 80, 20, 120);
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(120,170,220,${r() * 0.05})`; g.fillRect(r() * S, r() * S, 1.5, 1.5); }
}, [1, 1]);

/** soft bokeh disc (hexagonal-ish aperture with a brighter rim) */
export const bokehTex = () => memo("bokeh", () => {
  const S = 128, c = canvas(S, S), g = c.getContext("2d")!;
  g.translate(S / 2, S / 2);
  const poly = (rad: number) => { g.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.3; g[i ? "lineTo" : "moveTo"](Math.cos(a) * rad, Math.sin(a) * rad); } g.closePath(); };
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, 58);
  gr.addColorStop(0, "rgba(255,255,255,0.55)"); gr.addColorStop(0.82, "rgba(255,255,255,0.7)"); gr.addColorStop(0.95, "rgba(255,255,255,0.95)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; poly(58); g.fill();
  return toTex(c, { srgb: false });
});

/** soft round sprite */
export const dotTex = () => memo("dot", () => {
  const S = 64, c = canvas(S, S), g = c.getContext("2d")!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,0.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  return toTex(c, { srgb: false });
});

/** painted glowing arrow stroke (white; tinted in shader): a loaded brush that thins at the tail */
export const arrowTex = () => memo("arrow", () => {
  const W = 256, H = 1024, c = canvas(W, H), g = c.getContext("2d")!, r = rng(91);
  g.lineCap = "round";
  // shaft: several overlapping dry strokes, tail -> head (top -> bottom)
  for (let k = 0; k < 9; k++) {
    g.strokeStyle = `rgba(255,255,255,${0.35 + r() * 0.4})`;
    g.lineWidth = 26 + r() * 22;
    g.beginPath(); g.moveTo(W / 2 + (r() - 0.5) * 14, 60 + r() * 50);
    g.bezierCurveTo(W / 2 + 18 + (r() - 0.5) * 20, 330, W / 2 - 16 + (r() - 0.5) * 20, 600, W / 2 + (r() - 0.5) * 8, 760);
    g.stroke();
  }
  // head: two loaded strokes
  for (let k = 0; k < 4; k++) {
    g.strokeStyle = `rgba(255,255,255,${0.5 + r() * 0.4})`; g.lineWidth = 30 + r() * 16;
    g.beginPath(); g.moveTo(34 + r() * 10, 690 + r() * 16); g.quadraticCurveTo(W / 2 - 20, 840, W / 2, 960); g.stroke();
    g.beginPath(); g.moveTo(W - 34 - r() * 10, 690 + r() * 16); g.quadraticCurveTo(W / 2 + 20, 840, W / 2, 960); g.stroke();
  }
  // bristle gaps
  g.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(0,0,0,${0.3 + r() * 0.5})`; g.lineWidth = 1 + r() * 3; const x = W / 2 + (r() - 0.5) * 50; g.beginPath(); g.moveTo(x, 40 + r() * 200); g.lineTo(x + (r() - 0.5) * 20, 500 + r() * 250); g.stroke(); }
  return toTex(c, { srgb: false });
});
