// [hybrid/set, owned by the Set & Mechanism TD] Modular set kit: world-scaled box UVs, code-painted gouache textures
// that are specific to sets (enamel car panels, landing doors, polished rail steel, wire rope, gunmetal housings,
// counterweight filler plates, stencilled floor numbers) and small geometry helpers. Shared look (gouache material,
// brand colours, concrete/brick/roof painters) comes read-only from ../look.
import * as THREE from "three";
import { canvas, toTex, rng, hsl, hexToRgb, rgbToHsl } from "../look/paint";

// ---------- texture cache + painterly helpers (local copies; look/paint keeps its own private) ----------
const cache = new Map<string, THREE.Texture>();
const memo = (k: string, f: () => THREE.Texture) => { if (!cache.has(k)) cache.set(k, f()); return cache.get(k)!; };
const wrap = (S: number, f: (ox: number, oy: number) => void) => { for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) f(ox, oy); };

function blotch(g: CanvasRenderingContext2D, r: () => number, S: number, cols: string[], n: number, a: number, b: number) {
  for (let i = 0; i < n; i++) {
    const x = r() * S, y = r() * S, rad = a + r() * (b - a), col = cols[Math.floor(r() * cols.length)];
    wrap(S, (ox, oy) => {
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
      gr.addColorStop(0, col); gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr; g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
    });
  }
}
function strokes(g: CanvasRenderingContext2D, r: () => number, S: number, hex: string, n: number, ang: number, len: number, wid: number, vl: number) {
  const [h, s, l] = rgbToHsl(...hexToRgb(hex));
  g.lineCap = "round";
  for (let i = 0; i < n; i++) {
    const x = r() * S, y = r() * S, a = ang + (r() - 0.5) * 0.5, L = len * (0.5 + r());
    g.strokeStyle = hsl(h + (r() - 0.5) * 12, s + (r() - 0.5) * 0.1, l + (r() - 0.5) * 2 * vl, 0.2 + r() * 0.3);
    g.lineWidth = wid * (0.5 + r());
    wrap(S, (ox, oy) => { g.beginPath(); g.moveTo(x + ox - Math.cos(a) * L, y + oy - Math.sin(a) * L); g.lineTo(x + ox + Math.cos(a) * L, y + oy + Math.sin(a) * L); g.stroke(); });
  }
}
function chalk(g: CanvasRenderingContext2D, r: () => number, S: number, n: number, light: string) {
  for (let i = 0; i < n; i++) { g.fillStyle = light; g.globalAlpha = 0.04 + r() * 0.1; const s = 1 + r() * 2.2; g.fillRect(r() * S, r() * S, s, s * (0.4 + r())); }
  g.globalAlpha = 1;
}
function field(key: string, S: number, base: string, seed: number, draw: (g: CanvasRenderingContext2D, r: () => number, S: number) => void) {
  return memo(key, () => {
    const c = canvas(S, S), g = c.getContext("2d")!, r = rng(seed);
    g.fillStyle = base; g.fillRect(0, 0, S, S); draw(g, r, S);
    return toTex(c, { repeat: [1, 1], aniso: 8 });
  });
}

/** car enamel: warm cream-grey (catches the warm key, contrasts the cool shaft), panel seams, rivets, grime at the seams */
export const enamelTex = () => field("set-enamel", 512, "#8E8877", 101, (g, r, S) => {
  strokes(g, r, S, "#948D7A", 500, Math.PI / 2, 26, 7, 0.05);
  blotch(g, r, S, ["rgba(60,58,70,0.25)", "rgba(170,160,135,0.2)"], 22, 30, 120);
  const x = S / 2;
  g.fillStyle = "rgba(38,36,46,0.75)"; g.fillRect(x - 2, 0, 4, S);
  g.fillStyle = "rgba(210,200,175,0.35)"; g.fillRect(x + 2, 0, 2, S);
  for (let y = 12; y < S; y += 42) { g.fillStyle = "rgba(220,212,190,0.55)"; g.beginPath(); g.arc(x - 12, y, 3, 0, 7); g.arc(x + 13, y, 3, 0, 7); g.fill(); }
  for (let i = 0; i < 10; i++) { const xx = x + (r() - 0.5) * 12, L = 40 + r() * 140; const gr = g.createLinearGradient(0, 0, 0, L); gr.addColorStop(0, "rgba(50,44,50,0.4)"); gr.addColorStop(1, "rgba(50,44,50,0)"); g.fillStyle = gr; g.fillRect(xx, r() * S, 3 + r() * 5, L); }
  chalk(g, r, S, 2500, "#E6DFC8");
});

/** landing door leaf: painted steel blue-grey, horizontal brush, darker kick band at the bottom, hand grime */
export const doorTex = () => field("set-door", 512, "#56666E", 111, (g, r, S) => {
  strokes(g, r, S, "#5A6A72", 600, 0.02, 30, 6, 0.05);
  blotch(g, r, S, ["rgba(30,36,52,0.3)", "rgba(140,150,150,0.18)"], 20, 30, 120);
  g.fillStyle = "rgba(28,34,46,0.55)"; g.fillRect(0, S * 0.86, S, S * 0.14);
  g.fillStyle = "rgba(170,176,170,0.3)"; g.fillRect(0, S * 0.86, S, 3);
  blotch(g, r, S, ["rgba(30,28,36,0.35)"], 6, 10, 40);
  chalk(g, r, S, 2500, "#D0D8D8");
});

/** guide rail: blued steel with machined bright stripes running lengthwise (u = across, v = along) */
export const railTex = () => field("set-rail", 256, "#6C7C8C", 121, (g, r, S) => {
  strokes(g, r, S, "#7A8A98", 500, Math.PI / 2, 40, 3, 0.1);
  for (let i = 0; i < 18; i++) { g.fillStyle = `rgba(220,230,240,${0.08 + r() * 0.18})`; g.fillRect(r() * S, 0, 1 + r() * 3, S); }
  blotch(g, r, S, ["rgba(30,30,44,0.3)", "rgba(110,80,70,0.15)"], 10, 10, 50);
  chalk(g, r, S, 900, "#E0E8F0");
});

/** wire rope: diagonal strands (u = along, v = around) */
export const ropeTex = () => memo("set-rope", () => {
  const W = 64, H = 64, c = canvas(W, H), g = c.getContext("2d")!, r = rng(131);
  g.fillStyle = "#6F7A84"; g.fillRect(0, 0, W, H);
  for (let k = -8; k < 16; k++) {
    const x0 = k * 8;
    g.strokeStyle = "rgba(200,212,222,0.75)"; g.lineWidth = 2.4; g.beginPath(); g.moveTo(x0, 0); g.lineTo(x0 + H, H); g.stroke();
    g.strokeStyle = "rgba(30,36,50,0.7)"; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x0 + 5, 0); g.lineTo(x0 + 5 + H, H); g.stroke();
  }
  for (let i = 0; i < 80; i++) { g.fillStyle = `rgba(240,240,230,${r() * 0.2})`; g.fillRect(r() * W, r() * H, 1, 1); }
  return toTex(c, { repeat: [1, 1] });
});

/** gunmetal housing: dark blue-grey, chipped edges, machined bright lines */
export const gunTex = () => field("set-gun", 256, "#3A4452", 141, (g, r, S) => {
  strokes(g, r, S, "#3E4856", 300, 0.0, 22, 4, 0.06);
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(190,200,210,${0.2 + r() * 0.35})`; g.fillRect(r() * S, r() * S, 2 + r() * 6, 1 + r() * 2); }
  chalk(g, r, S, 900, "#C8D2DC");
});

/** counterweight filler plates: stacked horizontal slabs */
export const cwTex = () => field("set-cw", 256, "#4A5258", 151, (g, r, S) => {
  for (let k = 0; k < 8; k++) {
    const y = k * S / 8;
    g.fillStyle = hsl(205, 0.08, 0.28 + r() * 0.06); g.fillRect(0, y + 2, S, S / 8 - 4);
    g.fillStyle = "rgba(14,18,28,0.8)"; g.fillRect(0, y + S / 8 - 3, S, 3);
    g.fillStyle = "rgba(180,190,190,0.3)"; g.fillRect(0, y + 2, S, 2);
  }
  chalk(g, r, S, 800, "#C0C8C8");
});

/** toolbox / small kit: slate blue enamel (never brand red/green/amber/cyan) */
export const slateTex = () => field("set-slate", 256, "#3F5670", 161, (g, r, S) => {
  strokes(g, r, S, "#46607A", 300, 0.0, 20, 5, 0.06);
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(200,205,210,${0.2 + r() * 0.3})`; g.fillRect(r() * S, r() * S, 2 + r() * 5, 1 + r() * 2); }
  chalk(g, r, S, 700, "#D8E0E8");
});

/** stencilled number (pale paint, sprayed edges, stencil bridges) on a transparent canvas */
export function stencilTex(text: string, color = "#E2DCCB") {
  return memo(`set-stencil-${text}-${color}`, () => {
    const W = 512, H = 256, c = canvas(W, H), g = c.getContext("2d")!, r = rng(text.length * 31 + text.charCodeAt(0));
    g.clearRect(0, 0, W, H);
    g.font = "900 210px 'DejaVu Sans Condensed','DejaVu Sans',sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = color; g.globalAlpha = 0.22; g.filter = "blur(5px)"; g.fillText(text, W / 2, H / 2 + 8); // overspray
    g.filter = "none"; g.globalAlpha = 0.92; g.fillText(text, W / 2, H / 2 + 8);
    g.globalCompositeOperation = "destination-out";
    g.fillStyle = "rgba(0,0,0,1)";
    for (let i = 0; i < text.length; i++) g.fillRect(W / 2 - text.length * 60 + i * 120 + 52, H / 2 - 10, 14, 30); // bridges
    for (let i = 0; i < 900; i++) { g.globalAlpha = r() * 0.6; g.fillRect(r() * W, r() * H, 1 + r() * 3, 1 + r() * 2); } // worn paint
    g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
    return toTex(c, { aniso: 8 });
  });
}

export const repTex = (t: THREE.Texture, x: number, y: number) => { const c = t.clone(); c.wrapS = c.wrapT = THREE.RepeatWrapping; c.repeat.set(x, y); c.needsUpdate = true; return c; };

/** BoxGeometry whose UVs are scaled by face size / tile (metres), so a repeating texture keeps one density on every face */
export function boxGeo(w: number, h: number, d: number, tile = 1) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  // face order +x,-x,+y,-y,+z,-z; 4 verts each (1 segment)
  const dims: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile); }
  uv.needsUpdate = true;
  return g;
}

/** a capped tube along a polyline (used for ropes; uv.x scaled to metres / tile so the strand texture keeps its pitch) */
export function polyTube(pts: THREE.Vector3[], radius: number, radial = 6, tile = 0.06) {
  const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
  let L = 0; for (let i = 1; i < pts.length; i++) L += pts[i].distanceTo(pts[i - 1]);
  const seg = Math.max(2, Math.min(80, Math.round(L / 0.05)));
  const g = new THREE.TubeGeometry(curve, seg, radius, radial, false);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * L / tile);
  return g;
}

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
