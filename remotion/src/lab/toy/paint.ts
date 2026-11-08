// Code-painted textures (Canvas2D), deterministic via seeded RNG. Each painter draws a colour canvas and a
// matching height canvas (bump) so grooves, pits and seams line up with their colour.
import * as THREE from "three";

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Draw = (g: CanvasRenderingContext2D, w: number, h: number) => void;
const cache = new Map<string, THREE.CanvasTexture>();

export function canvas(w: number, h: number, draw: Draw) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  draw(g, w, h);
  return c;
}

export function tex(key: string, c: HTMLCanvasElement | (() => HTMLCanvasElement), color = true, repeat: [number, number] = [1, 1]) {
  const hit = cache.get(key);
  if (hit) return hit;
  const cv = typeof c === "function" ? c() : c;
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8;
  t.needsUpdate = true;
  cache.set(key, t);
  return t;
}

const hex2 = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
function shade(hex: string, k: number) {
  const c = new THREE.Color(hex);
  return `#${hex2(c.r * 255 * k)}${hex2(c.g * 255 * k)}${hex2(c.b * 255 * k)}`;
}
function rgba(r: number, g: number, b: number, a: number) { return `rgba(${r | 0},${g | 0},${b | 0},${a})`; }

function blotches(g: CanvasRenderingContext2D, w: number, h: number, R: () => number, n: number, rmin: number, rmax: number, light: string, dark: string, amax: number) {
  for (let i = 0; i < n; i++) {
    const x = R() * w, y = R() * h, r = rmin + R() * (rmax - rmin);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const col = R() < 0.5 ? light : dark;
    gr.addColorStop(0, col.replace("A", String(amax * (0.4 + 0.6 * R()))));
    gr.addColorStop(1, col.replace("A", "0"));
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
}

function speckle(g: CanvasRenderingContext2D, w: number, h: number, R: () => number, n: number, cols: string[], smax = 2) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = cols[Math.floor(R() * cols.length)];
    const s = 0.6 + R() * smax;
    g.fillRect(R() * w, R() * h, s, s);
  }
}

// ---------------------------------------------------------------- concrete (cast, formwork lines, tie holes, stains)
// Covers wM x hM metres. Returns colour + bump + roughness textures.
export function concrete(key: string, seed: number, wM: number, hM: number, pxm = 300, base = "#8C877D") {
  const w = Math.round(wM * pxm), h = Math.round(hM * pxm);
  const R1 = rng(seed), R2 = rng(seed);
  const panel = 1.2 * pxm;
  const ties: [number, number][] = [];
  for (let x = panel / 2; x < w; x += panel / 2) for (let y = panel * 0.25; y < h; y += panel / 2) ties.push([x + (R1() - 0.5) * 6, y + (R1() - 0.5) * 6]);
  const stains: [number, number, number, number][] = [];
  for (let i = 0; i < 16; i++) stains.push([R1() * w, R1() * h * 0.9, 6 + R1() * 40, 0.25 + R1() * 0.6]);
  const col = canvas(w, h, (g) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    // pour bands: each formwork lift slightly different tone, darker toward its bottom
    for (let y = 0, i = 0; y < h; y += panel, i++) {
      g.fillStyle = i % 2 ? "rgba(255,248,235,0.05)" : "rgba(30,25,20,0.05)";
      g.fillRect(0, y, w, panel);
      const gr = g.createLinearGradient(0, y + panel * 0.55, 0, y + panel);
      gr.addColorStop(0, "rgba(20,16,12,0)"); gr.addColorStop(1, "rgba(20,16,12,0.16)");
      g.fillStyle = gr; g.fillRect(0, y, w, panel);
    }
    blotches(g, w, h, R2, 140, 30, 260, "rgba(255,250,240,A)", "rgba(25,20,15,A)", 0.13);
    speckle(g, w, h, R2, w * h / 40, ["rgba(40,36,32,0.35)", "rgba(230,225,215,0.3)", "rgba(90,84,76,0.4)"], 1.8);
    // formwork seams
    g.strokeStyle = "rgba(25,20,16,0.45)"; g.lineWidth = 2.2;
    for (let y = panel; y < h; y += panel) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + (R2() - 0.5) * 3); g.stroke(); }
    g.strokeStyle = "rgba(25,20,16,0.28)"; g.lineWidth = 1.6;
    for (let x = panel; x < w; x += panel) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (R2() - 0.5) * 3, h); g.stroke(); }
    // tie holes: dark core + pale grout ring
    for (const [x, y] of ties) {
      g.fillStyle = "rgba(200,195,185,0.55)"; g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill();
      g.fillStyle = "rgba(35,30,26,0.85)"; g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill();
      // rust tear below some ties
      if (R2() < 0.35) {
        const gr = g.createLinearGradient(0, y, 0, y + 90);
        gr.addColorStop(0, "rgba(120,60,25,0.35)"); gr.addColorStop(1, "rgba(120,60,25,0)");
        g.fillStyle = gr; g.fillRect(x - 2.5, y, 5, 90);
      }
    }
    // water stains: vertical streaks with ragged edges
    for (const [x, y, sw, a] of stains) {
      const len = h * (0.15 + R2() * 0.35);
      for (let k = 0; k < 14; k++) {
        const xx = x + (R2() - 0.5) * sw, ww = 1 + R2() * sw * 0.25;
        const gr = g.createLinearGradient(0, y, 0, y + len * (0.4 + R2() * 0.6));
        gr.addColorStop(0, `rgba(38,33,26,${0.16 * a})`); gr.addColorStop(1, "rgba(38,33,26,0)");
        g.fillStyle = gr; g.fillRect(xx, y, ww, len);
      }
      // efflorescence (pale) at the stain head
      g.fillStyle = `rgba(235,232,222,${0.18 * a})`;
      g.fillRect(x - sw * 0.6, y - 3, sw * 1.2, 5);
    }
  });
  const bump = canvas(w, h, (g) => {
    g.fillStyle = "#808080"; g.fillRect(0, 0, w, h);
    blotches(g, w, h, R1, 80, 40, 220, "rgba(255,255,255,A)", "rgba(0,0,0,A)", 0.12);
    speckle(g, w, h, R1, w * h / 30, ["rgba(0,0,0,0.5)", "rgba(255,255,255,0.35)", "rgba(40,40,40,0.4)"], 2.2);
    g.strokeStyle = "rgba(0,0,0,0.8)"; g.lineWidth = 3;
    for (let y = panel; y < h; y += panel) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.lineWidth = 2;
    for (let x = panel; x < w; x += panel) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (const [x, y] of ties) { g.fillStyle = "#000"; g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill(); }
  });
  return {
    map: tex(key + ":c", col, true),
    bump: tex(key + ":b", bump, false),
  };
}

// ---------------------------------------------------------------- concrete block wall (CMU 0.4 x 0.2 m)
export function blockWall(key: string, seed: number, wM: number, hM: number, pxm = 300, base = "#7E7A72") {
  const w = Math.round(wM * pxm), h = Math.round(hM * pxm);
  const bw = 0.4 * pxm, bh = 0.2 * pxm, mortar = 0.012 * pxm;
  const R = rng(seed), Rb = rng(seed + 7);
  const blocks: [number, number, number][] = [];
  for (let r = 0, y = 0; y < h; y += bh, r++) for (let x = r % 2 ? -bw / 2 : 0; x < w; x += bw) blocks.push([x, y, R()]);
  const col = canvas(w, h, (g) => {
    g.fillStyle = shade(base, 0.72); g.fillRect(0, 0, w, h); // mortar colour
    for (const [x, y, v] of blocks) {
      g.fillStyle = shade(base, 0.9 + v * 0.2);
      g.fillRect(x + mortar / 2, y + mortar / 2, bw - mortar, bh - mortar);
      // face shading: lighter top edge, darker bottom edge (painted lips)
      g.fillStyle = "rgba(255,250,240,0.10)"; g.fillRect(x + mortar / 2, y + mortar / 2, bw - mortar, 3);
      g.fillStyle = "rgba(20,15,10,0.16)"; g.fillRect(x + mortar / 2, y + bh - mortar / 2 - 4, bw - mortar, 4);
    }
    speckle(g, w, h, Rb, w * h / 25, ["rgba(30,28,25,0.35)", "rgba(220,215,205,0.28)", "rgba(80,76,70,0.4)"], 1.6);
    blotches(g, w, h, Rb, 90, 40, 260, "rgba(255,248,236,A)", "rgba(22,18,14,A)", 0.12);
    for (let i = 0; i < 10; i++) {
      const x = Rb() * w, y = Rb() * h * 0.7, len = h * (0.1 + Rb() * 0.3), sw = 8 + Rb() * 30;
      for (let k = 0; k < 10; k++) {
        const gr = g.createLinearGradient(0, y, 0, y + len);
        gr.addColorStop(0, "rgba(35,30,22,0.12)"); gr.addColorStop(1, "rgba(35,30,22,0)");
        g.fillStyle = gr; g.fillRect(x + (Rb() - 0.5) * sw, y, 1 + Rb() * 5, len);
      }
    }
    // grime gradient toward bottom of texture tile = toward each floor slab
    const gr = g.createLinearGradient(0, h * 0.75, 0, h);
    gr.addColorStop(0, "rgba(15,12,10,0)"); gr.addColorStop(1, "rgba(15,12,10,0.22)");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const bump = canvas(w, h, (g) => {
    g.fillStyle = "#3a3a3a"; g.fillRect(0, 0, w, h);
    for (const [x, y, v] of blocks) {
      g.fillStyle = `rgb(${150 + v * 30 | 0},${150 + v * 30 | 0},${150 + v * 30 | 0})`;
      g.fillRect(x + mortar / 2 + 1, y + mortar / 2 + 1, bw - mortar - 2, bh - mortar - 2);
    }
    speckle(g, w, h, R, w * h / 18, ["rgba(0,0,0,0.5)", "rgba(255,255,255,0.3)"], 2);
  });
  return { map: tex(key + ":c", col, true), bump: tex(key + ":b", bump, false) };
}

// ---------------------------------------------------------------- brushed / machined metal roughness (streaks along U)
export function brushed(key: string, seed: number, w = 512, h = 512, base = 120, spread = 70) {
  const R = rng(seed);
  return tex(key, canvas(w, h, (g) => {
    g.fillStyle = `rgb(${base},${base},${base})`; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const y = R() * h, v = base + (R() - 0.5) * spread, a = 0.15 + R() * 0.35;
      g.fillStyle = `rgba(${v | 0},${v | 0},${v | 0},${a})`;
      g.fillRect(R() * w - 60, y, 40 + R() * 260, 0.6 + R() * 1.4);
    }
    blotches(g, w, h, R, 25, 20, 90, "rgba(200,200,200,A)", "rgba(40,40,40,A)", 0.2);
  }), false);
}

// ---------------------------------------------------------------- vinyl paint: soft brush strokes for the figures
export function vinylPaint(key: string, seed: number) {
  const R = rng(seed), w = 512, h = 512;
  return tex(key, canvas(w, h, (g) => {
    g.fillStyle = "#808080"; g.fillRect(0, 0, w, h);
    g.lineCap = "round";
    for (let i = 0; i < 900; i++) {
      const x = R() * w, y = R() * h, a = R() * Math.PI, l = 20 + R() * 70;
      const v = 128 + (R() - 0.5) * 70;
      g.strokeStyle = `rgba(${v | 0},${v | 0},${v | 0},${0.08 + R() * 0.12})`;
      g.lineWidth = 3 + R() * 9;
      g.beginPath(); g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (R() - 0.5) * 15, y + Math.sin(a) * l * 0.5 + (R() - 0.5) * 15, x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
      // wrap copies so the tile is seamless
      for (const [dx, dy] of [[w, 0], [-w, 0], [0, h], [0, -h]]) {
        if (x + dx > -80 && x + dx < w + 80 && y + dy > -80 && y + dy < h + 80) {
          g.beginPath(); g.moveTo(x + dx, y + dy); g.lineTo(x + dx + Math.cos(a) * l, y + dy + Math.sin(a) * l); g.stroke();
        }
      }
    }
    speckle(g, w, h, R, 6000, ["rgba(0,0,0,0.12)", "rgba(255,255,255,0.12)"], 1.2);
  }), false, [2, 2]);
}

// ---------------------------------------------------------------- galvanised checker plate (car roof)
export function checkerPlate(key: string, seed: number, wM: number, hM: number, pxm = 360) {
  const w = Math.round(wM * pxm), h = Math.round(hM * pxm);
  const R = rng(seed);
  const pitch = 0.03 * pxm;
  const lentil = (g: CanvasRenderingContext2D, fill: string) => {
    g.fillStyle = fill;
    for (let j = 0, y = 0; y < h + pitch; y += pitch, j++) for (let i = 0, x = 0; x < w + pitch; x += pitch, i++) {
      g.save(); g.translate(x + (j % 2 ? pitch / 2 : 0), y);
      g.rotate((i + j) % 2 ? Math.PI / 4 : -Math.PI / 4);
      g.beginPath(); g.ellipse(0, 0, pitch * 0.42, pitch * 0.11, 0, 0, Math.PI * 2); g.fill();
      g.restore();
    }
  };
  const col = canvas(w, h, (g) => {
    g.fillStyle = "#8D959C"; g.fillRect(0, 0, w, h);
    blotches(g, w, h, R, 160, 10, 120, "rgba(225,230,235,A)", "rgba(30,32,35,A)", 0.22);
    lentil(g, "rgba(210,216,222,0.55)");
    // oil + boot scuffs
    for (let i = 0; i < 30; i++) {
      const x = R() * w, y = R() * h, r = 15 + R() * 80;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, "rgba(28,24,20,0.30)"); gr.addColorStop(1, "rgba(28,24,20,0)");
      g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    speckle(g, w, h, R, w * h / 30, ["rgba(20,20,20,0.3)", "rgba(240,240,240,0.25)"], 1.4);
  });
  const bump = canvas(w, h, (g) => { g.fillStyle = "#404040"; g.fillRect(0, 0, w, h); lentil(g, "#e0e0e0"); });
  return { map: tex(key + ":c", col, true), bump: tex(key + ":b", bump, false) };
}

// ---------------------------------------------------------------- painted steel with chipped edges + grime
export function paintedSteel(key: string, seed: number, base: string, w = 512, h = 512) {
  const R = rng(seed);
  const col = canvas(w, h, (g) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    blotches(g, w, h, R, 70, 10, 110, "rgba(255,255,255,A)", "rgba(10,10,12,A)", 0.12);
    // chips: bare metal flecks with darker rim
    for (let i = 0; i < 90; i++) {
      const x = R() * w, y = R() * h, r = 1 + R() * 4;
      g.fillStyle = "rgba(20,18,16,0.5)"; g.beginPath(); g.arc(x, y, r + 1.2, 0, Math.PI * 2); g.fill();
      g.fillStyle = "rgba(170,172,175,0.9)"; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    // drips of grime downward (texture v = up)
    for (let i = 0; i < 24; i++) {
      const x = R() * w, y = R() * h, len = 30 + R() * 160;
      const gr = g.createLinearGradient(0, y, 0, y + len);
      gr.addColorStop(0, "rgba(25,20,15,0.25)"); gr.addColorStop(1, "rgba(25,20,15,0)");
      g.fillStyle = gr; g.fillRect(x, y, 1 + R() * 3, len);
    }
    speckle(g, w, h, R, 9000, ["rgba(0,0,0,0.15)", "rgba(255,255,255,0.1)"], 1.3);
  });
  return tex(key, col, true);
}

// ---------------------------------------------------------------- wire rope strands
export function rope(key: string) {
  const w = 64, h = 256;
  const col = canvas(w, h, (g) => {
    g.fillStyle = "#6c7076"; g.fillRect(0, 0, w, h);
    for (let i = -8; i < 24; i++) {
      const y0 = i * 16;
      const gr = g.createLinearGradient(0, y0, 0, y0 + 16);
      gr.addColorStop(0, "#2b2e32"); gr.addColorStop(0.35, "#b7bcc2"); gr.addColorStop(0.7, "#7b8086"); gr.addColorStop(1, "#2b2e32");
      g.save(); g.transform(1, 0.55, 0, 1, 0, 0); g.fillStyle = gr; g.fillRect(0, y0, w, 16); g.restore();
    }
  });
  return tex(key, col, true);
}

// ---------------------------------------------------------------- stencil / decal text (transparent)
export function stencil(key: string, lines: string[], opts: { w?: number; h?: number; color?: string; font?: string; size?: number; bg?: string; border?: boolean; seed?: number } = {}) {
  const w = opts.w ?? 512, h = opts.h ?? 256, R = rng(opts.seed ?? 3);
  const col = canvas(w, h, (g) => {
    if (opts.bg) { g.fillStyle = opts.bg; g.fillRect(0, 0, w, h); }
    g.fillStyle = opts.color ?? "#ECE8DE";
    g.strokeStyle = opts.color ?? "#ECE8DE";
    const size = opts.size ?? Math.floor(h / (lines.length + 0.6));
    g.font = opts.font ?? `800 ${size}px "Inter Display", "Inter", sans-serif`;
    g.textAlign = "center"; g.textBaseline = "middle";
    g.shadowColor = opts.color ?? "#ECE8DE"; g.shadowBlur = 2.5; // overspray
    lines.forEach((t, i) => g.fillText(t, w / 2, h / 2 + (i - (lines.length - 1) / 2) * size * 1.08));
    if (opts.border) { g.lineWidth = size * 0.09; g.strokeRect(size * 0.15, size * 0.15, w - size * 0.3, h - size * 0.3); }
    g.shadowBlur = 0;
    // stencil bridges: thin vertical cuts through each line (gives the sprayed-stencil read)
    g.globalCompositeOperation = "destination-out";
    lines.forEach((t, i) => {
      const y = h / 2 + (i - (lines.length - 1) / 2) * size * 1.08;
      const tw = g.measureText(t).width, n = t.length;
      for (let k = 0; k < n; k++) {
        if (t[k] === " ") continue;
        const cx = w / 2 - tw / 2 + (k + 0.5) * (tw / n);
        g.fillRect(cx - size * 0.035, y - size * 0.05, size * 0.07, size * 0.1);
      }
    });
    // worn paint: erase speckles
    for (let i = 0; i < w * h / 90; i++) { g.globalAlpha = 0.3 + R() * 0.7; const s = 0.8 + R() * 2.5; g.fillRect(R() * w, R() * h, s, s); }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  });
  return tex(key, col, true);
}

// ---------------------------------------------------------------- blueprint grid (cyan on navy) for walls
export function gridTex(key: string, pxm = 128) {
  const w = pxm * 2, h = pxm * 2;
  return tex(key, canvas(w, h, (g) => {
    g.fillStyle = "#000"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(255,255,255,0.35)"; g.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const p = (i / 10) * w;
      g.beginPath(); g.moveTo(p, 0); g.lineTo(p, h); g.stroke();
      g.beginPath(); g.moveTo(0, p); g.lineTo(w, p); g.stroke();
    }
    g.strokeStyle = "rgba(255,255,255,1)"; g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, w - 3, h - 3);
  }), false);
}

// Soft radial blob (contact shadows / light pools).
export function radial(key: string, inner = 0, falloff = 1.0) {
  return tex(key, canvas(256, 256, (g) => {
    const gr = g.createRadialGradient(128, 128, inner * 128, 128, 128, 128);
    for (let i = 0; i <= 10; i++) { const t = i / 10; gr.addColorStop(t, `rgba(255,255,255,${Math.pow(1 - t, 1.6 * falloff)})`); }
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  }), false);
}

export { rgba };
