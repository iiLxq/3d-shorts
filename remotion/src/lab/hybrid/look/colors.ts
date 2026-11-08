// [hybrid/look, owned by the Look TD] Exact brand colours through the Lamplit Gouache pipeline.
//
// Pipeline (linear light): material -> MSAA resolve -> ink -> background blur -> bloom (ADD, threshold 1.0)
// -> grade (gradeLinear below, mirrored 1:1 in post.ts GLSL) -> sRGB encode.
// A brand hex must land on screen exactly where the material says "this is the brand colour" (the top lit step of
// a brand-locked gouache material, an unlit line, an emissive core below the bloom threshold). untone() inverts the
// grade numerically (damped fixed-point, like the reference repo's PBR-Neutral inversion) so materials can target the
// pre-grade linear value that lands on the hex. The grade protects saturated colours (split-tone weight -> 0 above
// saturation ~0.85), so for our five brand hexes untone() is ~identity; it still matters for exposure changes and
// for less saturated "house" colours (helmet cream, skin, paper).
//
// Pure module: no import of shade.ts/post.ts (they import this). brandPaint() returns GouacheOpts (type-only
// import), shade.ts brandMat() turns that into a material.
import * as THREE from "three";
import type { GouacheOpts } from "./shade";

export const BRAND = {
  navy: "#0B1A33", cyan: "#35D7FF", red: "#FF3B3B", green: "#39FF88", amber: "#FFB020",
} as const;
/** colour-code roles (never reassigned) */
export const ROLE = {
  structure: BRAND.cyan, danger: BRAND.red, failsafe: BRAND.green, person: BRAND.amber, paper: BRAND.navy,
} as const;

export type RGB = [number, number, number];
const LUM: RGB = [0.2126, 0.7152, 0.0722];
const dot = (a: RGB, b: RGB) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sstep = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export const s2l = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
export const l2s = (v: number) => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(Math.max(0, v), 1 / 2.4) - 0.055);
export function hexToSrgb(hex: string): RGB {
  const n = parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
export const hexToLin = (hex: string): RGB => hexToSrgb(hex).map(s2l) as RGB;

// ---------------------------------------------------------------- grade (mirrored in post.ts GLSL)
export type GradeParams = {
  expo: number;                 // exposure multiplier before everything
  split: number;                // warm/cool split strength (0 = off)
  warm: RGB; cool: RGB;         // multipliers for highlights / shadows
  splitLo: number; splitHi: number; // linear luminance range of the shadow -> highlight blend
  protLo: number; protHi: number;   // saturation range over which the split fades out (brand protect)
  lift: RGB;                    // navy floor added to near-black pixels (linear)
  liftY: number;                // luminance below which the lift fades in
  bleachLo: number; bleachHi: number; // hot cores (max channel > 1) normalise and bleach to white, never hue-clip
};
export const DEFAULT_GRADE: GradeParams = {
  expo: 1.0, split: 1.0,
  warm: [1.045, 1.0, 0.93], cool: [0.93, 0.99, 1.10],
  splitLo: 0.015, splitHi: 0.30,
  protLo: 0.55, protHi: 0.85,
  lift: hexToLin(BRAND.navy).map((v) => v * 0.75) as RGB,
  liftY: 0.006,
  bleachLo: 1.0, bleachHi: 4.0,
};

/** the colour part of the post grade (no vignette / grain / flash, i.e. screen centre), linear in -> linear out */
export function gradeLinear(c: RGB, p: GradeParams = DEFAULT_GRADE): RGB {
  let r = c[0] * p.expo, g = c[1] * p.expo, b = c[2] * p.expo;
  let y = dot([r, g, b], LUM);
  let mx = Math.max(r, g, b); const mn = Math.min(r, g, b);
  const sat = (mx - mn) / Math.max(mx, 1e-5);
  const prot = 1 - sstep(p.protLo, p.protHi, sat);
  const k = sstep(p.splitLo, p.splitHi, y);
  const w = prot * p.split;
  r *= 1 + w * (p.cool[0] + (p.warm[0] - p.cool[0]) * k - 1);
  g *= 1 + w * (p.cool[1] + (p.warm[1] - p.cool[1]) * k - 1);
  b *= 1 + w * (p.cool[2] + (p.warm[2] - p.cool[2]) * k - 1);
  mx = Math.max(r, g, b);
  if (mx > p.bleachLo) {
    const t = sstep(p.bleachLo, p.bleachHi, mx);
    r = (r / mx) * (1 - t) + t; g = (g / mx) * (1 - t) + t; b = (b / mx) * (1 - t) + t;
  }
  y = dot([r, g, b], LUM);
  const lw = 1 - sstep(0, p.liftY, y);
  return [r + p.lift[0] * lw, g + p.lift[1] * lw, b + p.lift[2] * lw];
}

/** linear pre-grade value that the grade maps onto the target (hex or linear RGB). Damped fixed point, 80 its. */
export function untoneLin(target: RGB, p: GradeParams = DEFAULT_GRADE): RGB {
  const x: RGB = [...target];
  for (let i = 0; i < 80; i++) {
    const g = gradeLinear(x, p);
    for (let j = 0; j < 3; j++) x[j] = Math.max(0, x[j] + 0.85 * (target[j] - g[j]));
  }
  return x;
}
const outCache = new Map<string, THREE.Color>();
/** THREE.Color (linear) that lands exactly on `hex` after the default grade. Use for unlit/emissive brand elements. */
export function untone(hex: string, p: GradeParams = DEFAULT_GRADE): THREE.Color {
  const key = p === DEFAULT_GRADE ? hex : "";
  if (key && outCache.has(key)) return outCache.get(key)!.clone();
  const v = untoneLin(hexToLin(hex), p);
  const c = new THREE.Color().setRGB(v[0], v[1], v[2], THREE.LinearSRGBColorSpace);
  if (key) outCache.set(key, c.clone());
  return c;
}
/** alias: brand colour for lines, arrows, labels-in-3D, emissive cores (≤ 1.0 so it does not bloom) */
export const brandOut = (hex: string) => untone(hex);

/**
 * Brand-locked gouache recipe: the top lit value step lands exactly on `hex` (whatever the key/practical colour),
 * lower steps keep the hue and fall into the coloured gouache shadow. Returns GouacheOpts: pass to gouache(), or
 * use shade.ts brandMat(hex, extra) which does it for you.
 *   kind "fabric" (jacket, default), "enamel" (painted metal, small glint), "plastic" (wet/plastic glint), "glow" (lit
 *   from inside: the surface is the brand colour everywhere it faces the camera, emissive hot core via `glow`).
 */
export function brandPaint(hex: string, extra: GouacheOpts & { kind?: "fabric" | "enamel" | "plastic" | "glow" } = {}): GouacheOpts {
  const { kind = "fabric", ...rest } = extra;
  const base: GouacheOpts = { color: hex, brand: hex, brush: 0.5, rim: 0.25, xray: 0 };
  if (kind === "enamel") Object.assign(base, { spec: 0.75, gloss: 60, specTh: 0.55 });
  if (kind === "plastic") Object.assign(base, { spec: 0.9, gloss: 110, specTh: 0.45 });
  if (kind === "glow") Object.assign(base, { brandFloor: 0.85, xray: 0, spec: 0.4, gloss: 40 });
  return { ...base, ...rest };
}

// ---------------------------------------------------------------- measurement helpers (QA, docs)
export function linToLab(c: RGB): RGB {
  const X = 0.4124 * c[0] + 0.3576 * c[1] + 0.1805 * c[2];
  const Y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const Z = 0.0193 * c[0] + 0.1192 * c[1] + 0.9505 * c[2];
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fx = f(X / 0.95047), fy = f(Y), fz = f(Z / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
/** CIEDE2000 */
export function deltaE00(l1: RGB, l2: RGB): number {
  const [L1, a1, b1] = l1, [L2, a2, b2] = l2, rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const h = (b: number, a: number) => { const v = Math.atan2(b, a) / rad; return v < 0 ? v + 360 : v; };
  const h1p = h(b1, a1p), h2p = h(b2, a2p);
  const dLp = L2 - L1, dCp = C2p - C1p;
  let dhp = h2p - h1p; if (C1p * C2p === 0) dhp = 0; else if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360;
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad);
  const Lbp = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2;
  let hbp = h1p + h2p; if (C1p * C2p !== 0) { hbp = Math.abs(h1p - h2p) > 180 ? (h1p + h2p + (h1p + h2p < 360 ? 360 : -360)) / 2 : (h1p + h2p) / 2; }
  const T = 1 - 0.17 * Math.cos((hbp - 30) * rad) + 0.24 * Math.cos(2 * hbp * rad) + 0.32 * Math.cos((3 * hbp + 6) * rad) - 0.2 * Math.cos((4 * hbp - 63) * rad);
  const dTh = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2), Sc = 1 + 0.045 * Cbp, Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(2 * dTh * rad) * Rc;
  return Math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh));
}
/** self-check: ΔE00 between hex and what the grade makes of untone(hex) (should be < 0.5) */
export function gradeRoundTrip(hex: string): number {
  const t = hexToLin(hex);
  return deltaE00(linToLab(t), linToLab(gradeLinear(untoneLin(t))));
}
