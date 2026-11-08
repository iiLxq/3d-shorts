// TOY / Precision Miniature — palette + tone-map inversion.
// Brand colours are fixed (CLAUDE.md signature style). untone() finds the linear scene value that lands on the
// exact on-screen sRGB hex after Khronos PBR Neutral tone mapping (our own port of the published formula).
import * as THREE from "three";

export const BRAND = {
  navy: "#0B1A33",
  cyan: "#35D7FF",
  red: "#FF3B3B",
  green: "#39FF88",
  amber: "#FFB020",
};

// Toy universe paint chart (sRGB). Everything that is not a brand meaning colour stays desaturated or warm-neutral
// so the brand accents own the chroma.
export const PAINT = {
  jacket: "#F2A21A", // amber hi-vis vinyl (lit by a warm lamp it lands on #FFB020-ish)
  jacketShade: "#B8720E",
  reflective: "#C9CED3",
  pants: "#2E3644",
  joint: "#565B63", // satin grey ball joints
  glove: "#3B3F46",
  boot: "#6E4A2C",
  sole: "#1E1C1B",
  leather: "#5B3920",
  skin: "#C48461",
  skinBlush: "#C86A55",
  hair: "#3A2618",
  helmet: "#ECE7DC",
  eyeWhite: "#F3EFE6",
  iris: "#4A2E1C",
  mouth: "#4A1712",
  teeth: "#F1ECE1",
  tongue: "#B3483F",
  steelPaint: "#3E4B5A", // machinery blue-grey
  steelDark: "#2A2F35",
  galv: "#9AA3AB",
  concrete: "#8C877D",
  block: "#7E7A72",
  carPanel: "#B9B4A6",
  door: "#6F7A82",
};

export function srgbToLin(c: number) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function neutral(c: [number, number, number]): [number, number, number] {
  const start = 0.8 - 0.04, desat = 0.15;
  let [r, g, b] = c;
  const x = Math.min(r, g, b);
  const off = x < 0.08 ? x - 6.25 * x * x : 0.04;
  r -= off; g -= off; b -= off;
  const peak = Math.max(r, g, b);
  if (peak < start) return [r, g, b];
  const d = 1 - start;
  const np = 1 - (d * d) / (peak + d - start);
  r *= np / peak; g *= np / peak; b *= np / peak;
  const gg = 1 - 1 / (desat * (peak - np) + 1);
  return [r + (np - r) * gg, g + (np - g) * gg, b + (np - b) * gg];
}

const untoneCache = new Map<string, THREE.Color>();
// Linear-light colour that displays as `hex` after Neutral tone mapping (exposure 1).
export function untone(hex: string): THREE.Color {
  const hit = untoneCache.get(hex);
  if (hit) return hit.clone();
  const c = new THREE.Color(hex); // three converts hex (sRGB) to linear working space
  const t: [number, number, number] = [c.r, c.g, c.b];
  let x: [number, number, number] = [...t];
  for (let i = 0; i < 80; i++) {
    const y = neutral(x);
    x = [0, 1, 2].map((k) => Math.max(0, x[k] + (t[k] - y[k]))) as [number, number, number];
  }
  const out = new THREE.Color(x[0], x[1], x[2]);
  untoneCache.set(hex, out);
  return out.clone();
}

// Emissive HDR version of a brand colour (for bloom). k > 1 pushes it over the bloom threshold.
export function hdr(hex: string, k: number) {
  return untone(hex).multiplyScalar(k);
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const smoother = (t: number) => {
  t = clamp01(t);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
