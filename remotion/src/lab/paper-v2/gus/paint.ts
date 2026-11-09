// [gus lab copy of ../paint.ts: independent of the World lab]
// PAPER concept: code-painted card prints. One drawing per piece, three looks:
//   solid     = offset-printed colour card (halftone shading, slight misregistration, fibres)
//   blueprint = cyanotype: Prussian-blue paper, the same drawing as white/cyan printed lines
//   xray      = tracing vellum: pale translucent sheet, graphite + cyan pencil lines
import * as THREE from "three";

export type Look = "solid" | "blueprint" | "xray";

// ---------- deterministic rng ----------
export function rng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- brand colours ----------
export const BRAND = { navy: "#0B1A33", cyan: "#35D7FF", red: "#FF3B3B", green: "#39FF88", amber: "#FFB020" };
export const PRUSSIAN = "#123d7c";   // cyanotype paper
export const PRUSSIAN_D = "#0d2c5c";
export const BP_LINE = "#e8f8ff";    // printed blueprint line (white with a cyan cast)

// ---------- hue-preserving shoulder tone map (GLSL twin in post.ts) + exact inversion ----------
// Linear below 0.8; above, the max channel rolls off toward 1.0 and all channels scale together (no desaturation),
// so brand colours with a 255 channel (#FF3B3B, #39FF88, #35D7FF, #FFB020) land exactly on screen.
export const TONE_K = 0.8;
export function toneCurve(c: number[]) {
  const pk = Math.max(c[0], c[1], c[2]);
  if (pk <= TONE_K) return c;
  const np = TONE_K + (1 - TONE_K) * (1 - Math.exp(-(pk - TONE_K) / (1 - TONE_K)));
  return c.map((v) => (v * np) / pk);
}
/** Linear scene colour that lands on `hex` (sRGB) after the tone curve. */
export function untone(hex: string, gain = 1) {
  const t = new THREE.Color(hex); // linear
  const c = [t.r, t.g, t.b];
  const tp = Math.min(Math.max(c[0], c[1], c[2]), 0.998);
  let s = 1;
  if (tp > TONE_K) s = (TONE_K - (1 - TONE_K) * Math.log(1 - (tp - TONE_K) / (1 - TONE_K))) / tp;
  return new THREE.Color(c[0] * s * gain, c[1] * s * gain, c[2] * s * gain);
}

// ---------- canvas helpers ----------
export function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(4, Math.round(w)); c.height = Math.max(4, Math.round(h));
  return c;
}
export function tex(c: HTMLCanvasElement, srgb = true, repeat = false) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Paper fibre / tooth bump tile (grey, seamless). Used as bumpMap on every card.
let _fiber: HTMLCanvasElement | null = null;
export function fiberCanvas() {
  if (_fiber) return _fiber;
  const N = 512, c = canvas(N, N), g = c.getContext("2d")!, r = rng(7);
  g.fillStyle = "#808080"; g.fillRect(0, 0, N, N);
  // soft cloud (formation of the sheet)
  for (let i = 0; i < 160; i++) {
    const x = r() * N, y = r() * N, rad = 10 + r() * 50, v = r() < 0.5 ? 0 : 255;
    for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) {
      const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad);
      gr.addColorStop(0, `rgba(${v},${v},${v},0.06)`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`);
      g.fillStyle = gr; g.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2);
    }
  }
  // fibres
  g.lineCap = "round";
  for (let i = 0; i < 2600; i++) {
    const x = r() * N, y = r() * N, a = r() * Math.PI * 2, l = 4 + r() * 22, v = r() < 0.55 ? 255 : 0;
    g.strokeStyle = `rgba(${v},${v},${v},${0.05 + r() * 0.12})`; g.lineWidth = 0.6 + r() * 1.1;
    for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) {
      g.beginPath(); g.moveTo(x + dx, y + dy);
      g.quadraticCurveTo(x + dx + Math.cos(a + 0.6) * l * 0.5, y + dy + Math.sin(a + 0.6) * l * 0.5, x + dx + Math.cos(a) * l, y + dy + Math.sin(a) * l);
      g.stroke();
    }
  }
  // tooth speckle
  const id = g.getImageData(0, 0, N, N), d = id.data;
  for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 26; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(id, 0, 0);
  _fiber = c;
  return c;
}
const _fiberTex = new Map<string, THREE.Texture>();
/** Fibre bump texture repeating every `period` metres over a piece of size w x h (uv 0..1). */
export function fiberTex(w: number, h: number, period = 0.28) {
  const rx = Math.max(1, Math.round((w / period) * 4) / 4), ry = Math.max(1, Math.round((h / period) * 4) / 4);
  const key = `${rx}x${ry}`;
  let t = _fiberTex.get(key);
  if (!t) { t = tex(fiberCanvas(), false, true); t.repeat.set(rx, ry); _fiberTex.set(key, t); }
  return t;
}

// ---------- Painter: one drawing, three looks ----------
export type Pt = [number, number];
export interface PaperStock { base: string; mottle: number; flecks?: string[]; core: string }
export const STOCK: Record<string, PaperStock> = {
  white: { base: "#ece4d3", mottle: 0.05, core: "#f7f2e7" },
  kraft: { base: "#a97f55", mottle: 0.09, flecks: ["#6d4a2c", "#c9a77d"], core: "#d9be98" },
  grey: { base: "#7f7b74", mottle: 0.08, flecks: ["#5d5953", "#a19c93", "#8a6f55"], core: "#c4beb2" },
  board: { base: "#5f5c58", mottle: 0.09, flecks: ["#47443f", "#86827a"], core: "#b1aa9d" },
  steel: { base: "#56677a", mottle: 0.05, core: "#d5dbe0" },
  amber: { base: BRAND.amber, mottle: 0.04, core: "#fff1cf" },
  slate: { base: "#36435a", mottle: 0.05, core: "#cfd3da" },
  skin: { base: "#d39a74", mottle: 0.04, core: "#f6dcc7" },
  brown: { base: "#5a3d2a", mottle: 0.05, core: "#d8bea1" },
  green: { base: "#3fbf78", mottle: 0.03, core: "#e6fff0" },
};

export class Painter {
  g: CanvasRenderingContext2D;
  look: Look;
  px: number; // canvas px per metre
  r: () => number;
  ink: string; // blueprint line colour (white-cyan; amber for the person, green for the fail-safe)
  constructor(g: CanvasRenderingContext2D, look: Look, px: number, seed: number, ink = BP_LINE) {
    this.g = g; this.look = look; this.px = px; this.r = rng(seed); this.ink = ink;
  }
  get bp() { return this.look === "blueprint"; }
  get xr() { return this.look === "xray"; }
  lw(m: number) { return m; } // widths are given in metres (canvas is in metre space)
  path(pts: Pt[], close = true) {
    const g = this.g; g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    if (close) g.closePath();
  }
  /** Filled shape. solid: colour fill; blueprint: white key line; xray: faint wash + pencil line. */
  shape(pts: Pt[], color: string, opts: { line?: number; lineColor?: string; alpha?: number; bpFill?: number } = {}) {
    const g = this.g, line = opts.line ?? 0.006;
    this.path(pts);
    if (this.bp) {
      if (opts.bpFill) { g.globalAlpha = opts.bpFill; g.fillStyle = this.ink; g.fill(); g.globalAlpha = 1; }
      g.strokeStyle = this.ink; g.lineWidth = line; g.lineJoin = "round"; g.stroke();
    } else if (this.xr) {
      g.fillStyle = "rgba(60,90,110,0.07)"; g.fill();
      g.strokeStyle = "rgba(40,120,160,0.75)"; g.lineWidth = line * 0.8; g.stroke();
    } else {
      g.globalAlpha = opts.alpha ?? 1; g.fillStyle = color; g.fill(); g.globalAlpha = 1;
      if (opts.lineColor) { g.strokeStyle = opts.lineColor; g.lineWidth = line; g.stroke(); }
    }
  }
  rect(x: number, y: number, w: number, h: number, color: string, opts: { line?: number; lineColor?: string; alpha?: number; bpFill?: number } = {}) {
    this.shape([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], color, opts);
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, color: string, opts: { line?: number; lineColor?: string; alpha?: number; bpFill?: number } = {}) {
    const pts: Pt[] = [];
    for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
    this.shape(pts, color, opts);
  }
  stroke(pts: Pt[], color: string, w: number, close = false, dash?: number[]) {
    const g = this.g; this.path(pts, close);
    g.setLineDash(dash ?? []);
    g.strokeStyle = this.bp ? this.ink : this.xr ? "rgba(40,110,150,0.8)" : color;
    g.lineWidth = this.bp ? Math.max(w, 0.004) : w; g.lineCap = "round"; g.lineJoin = "round"; g.stroke();
    g.setLineDash([]);
  }
  /** Stencil / printed text. y = baseline, size in metres. */
  text(s: string, x: number, y: number, size: number, color: string, opts: { align?: CanvasTextAlign; font?: string; weight?: number; spacing?: number; rot?: number } = {}) {
    const g = this.g; g.save();
    // canvas is in metre space; fonts need real px, so undo the scale locally
    g.translate(x, y); g.scale(1 / this.px, -1 / this.px); if (opts.rot) g.rotate(-opts.rot);
    g.font = `${opts.weight ?? 800} ${Math.max(1, size * this.px)}px ${opts.font ?? "'Inter Display', Inter, sans-serif"}`;
    g.textAlign = opts.align ?? "left"; g.textBaseline = "alphabetic";
    g.fillStyle = this.bp ? this.ink : this.xr ? "rgba(40,90,120,0.85)" : color;
    if (opts.spacing) (g as unknown as { letterSpacing: string }).letterSpacing = `${opts.spacing * this.px}px`;
    g.fillText(s, 0, 0);
    g.restore();
  }
  /** Halftone print shading inside pts. shade(x,y) in 0..1 = ink coverage. */
  halftone(pts: Pt[], shade: (x: number, y: number) => number, color: string, cell = 0.012, angle = 0.26) {
    if (this.bp) return this.hatch(pts, shade, cell * 1.6);
    if (this.xr) return;
    const g = this.g; g.save(); this.path(pts); g.clip();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    pts.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.hypot(x1 - x0, y1 - y0) / 2 + cell;
    const ca = Math.cos(angle), sa = Math.sin(angle);
    g.fillStyle = color;
    for (let u = -R; u <= R; u += cell) for (let v = -R; v <= R; v += cell) {
      const x = cx + u * ca - v * sa, y = cy + u * sa + v * ca;
      if (x < x0 - cell || x > x1 + cell || y < y0 - cell || y > y1 + cell) continue;
      const s = Math.max(0, Math.min(1, shade(x, y)));
      if (s < 0.03) continue;
      const rad = cell * 0.56 * Math.sqrt(s);
      g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }
  /** Blueprint stand-in for halftone: sparse parallel hatching where shade is high. */
  hatch(pts: Pt[], shade: (x: number, y: number) => number, gap = 0.02) {
    const g = this.g; g.save(); this.path(pts); g.clip();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    pts.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
    g.strokeStyle = this.ink; g.globalAlpha = 0.35; g.lineWidth = gap * 0.12;
    for (let k = x0 - (y1 - y0); k < x1; k += gap) {
      // segment along a 45 deg line, drawn only where shade > 0.45
      const steps = 24; let on = false;
      g.beginPath();
      for (let i = 0; i <= steps; i++) {
        const t = i / steps, x = k + (y1 - y0) * t, y = y0 + (y1 - y0) * t;
        const s = shade(x, y) > 0.45;
        if (s && !on) { g.moveTo(x, y); on = true; } else if (s && on) g.lineTo(x, y); else on = false;
      }
      g.stroke();
    }
    g.globalAlpha = 1;
    g.restore();
  }
  /** Rivet / split-pin print dots. */
  rivets(pts: Pt[], r = 0.008, color = "#2b3440") {
    for (const [x, y] of pts) {
      if (this.bp) { this.g.beginPath(); this.g.arc(x, y, r, 0, Math.PI * 2); this.g.strokeStyle = this.ink; this.g.lineWidth = r * 0.45; this.g.stroke(); continue; }
      if (this.xr) { this.g.beginPath(); this.g.arc(x, y, r * 0.8, 0, Math.PI * 2); this.g.fillStyle = "rgba(40,110,150,0.6)"; this.g.fill(); continue; }
      const g = this.g;
      g.beginPath(); g.arc(x + r * 0.25, y - r * 0.25, r, 0, Math.PI * 2); g.fillStyle = "rgba(0,0,0,0.35)"; g.fill();
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = color; g.fill();
      g.beginPath(); g.arc(x - r * 0.3, y + r * 0.3, r * 0.4, 0, Math.PI * 2); g.fillStyle = "rgba(255,255,255,0.45)"; g.fill();
    }
  }
}

/** Base sheet for a look: colour + mottling + flecks (solid), cyanotype wash (blueprint), vellum (xray). */
export function paperBase(g: CanvasRenderingContext2D, W: number, H: number, stock: PaperStock, look: Look, seed: number) {
  const r = rng(seed * 31 + 5);
  if (look === "blueprint") {
    g.fillStyle = PRUSSIAN; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 26; i++) {
      const x = r() * W, y = r() * H, rad = (0.15 + r() * 0.4) * Math.max(W, H);
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      const c = r() < 0.5 ? "13,44,92" : "30,82,150";
      gr.addColorStop(0, `rgba(${c},0.25)`); gr.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }
    return;
  }
  if (look === "xray") {
    g.fillStyle = "#dfe9ee"; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 14; i++) {
      const x = r() * W, y = r() * H, rad = (0.2 + r() * 0.5) * Math.max(W, H);
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, "rgba(255,255,255,0.25)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }
    return;
  }
  g.fillStyle = stock.base; g.fillRect(0, 0, W, H);
  const m = stock.mottle;
  for (let i = 0; i < 30; i++) {
    const x = r() * W, y = r() * H, rad = (0.1 + r() * 0.35) * Math.max(W, H);
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    const v = r() < 0.5 ? "0,0,0" : "255,250,240";
    gr.addColorStop(0, `rgba(${v},${m})`); gr.addColorStop(1, `rgba(${v},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }
  if (stock.flecks) {
    const n = Math.round((W * H) / 900);
    for (let i = 0; i < n; i++) {
      g.fillStyle = stock.flecks[Math.floor(r() * stock.flecks.length)];
      g.globalAlpha = 0.25 + r() * 0.5;
      const s = 0.6 + r() * 1.8;
      g.fillRect(r() * W, r() * H, s, s * (0.5 + r()));
    }
    g.globalAlpha = 1;
  }
}
