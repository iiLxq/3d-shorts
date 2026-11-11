// Card pieces: a THREE.Shape extruded to real card thickness. Front face carries a printed canvas
// (Painter), cut edges show the lighter paper core. Every card holds a material set per look.
import * as THREE from "three";
import { Look, Painter, PaperStock, Pt, STOCK, BP_LINE, BRAND, canvas, tex, paperBase, fiberTex, fiberCanvas as fiberTexCanvas, untone } from "./paint";

export type Role = "shell" | "structure" | "mech" | "person" | "fx" | "light";
export interface CardOpts {
  stock?: keyof typeof STOCK | PaperStock;
  thick?: number;
  seed?: number;
  px?: number;          // canvas px per metre
  maxPx?: number;
  role?: Role;
  print?: (p: Painter, pts: Pt[], b: Bounds) => void;
  inset?: boolean;      // print a thin inset key line
  bump?: number;
  rough?: number;
  metal?: number;       // foil card
  emissive?: THREE.Color; // solid-look emissive tint multiplier on the print (lamps)
  shadow?: boolean;
  /** tiled print (big walls): uv = local xy / size, seamless tile painted once per look */
  tile?: { size: number; key: string; paint: (p: Painter, size: number) => void };
  /** embossed relief: draw grey heights (#808080 = flat, lighter = raised) in metre space; becomes the bump map */
  relief?: (h: Painter, pts: Pt[], b: Bounds) => void;
  reliefPx?: number;
  /** this card ignores the global look (case-file folder, cutting mat, props outside the diorama) */
  lock?: Look;
  /** edge (cut core) brightness multiplier: cores catch the raking key */
  edge?: number;
}
const _tiles = new Map<string, THREE.Texture>();
export interface Bounds { x0: number; y0: number; x1: number; y1: number; w: number; h: number }

const REG: Card[] = [];
export function allCards() { return REG; }
export function setLookAll(look: Look) { REG.forEach((c) => c.setLook(c.o.lock ?? look)); }

export function shapeFromPts(pts: Pt[]) {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return s;
}
export function roundRect(x: number, y: number, w: number, h: number, r: number) {
  const s = new THREE.Shape();
  r = Math.min(r, w / 2, h / 2);
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
export function ellipseShape(cx: number, cy: number, rx: number, ry: number, n = 40) {
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
  return shapeFromPts(pts);
}
/** Slightly imperfect hand-cut outline: jitter a polygon's points (seeded, small). */
export function handCut(pts: Pt[], amt: number, seed: number): Pt[] {
  let a = seed * 9301 + 49297;
  const r = () => { a = (a * 9301 + 49297) % 233280; return a / 233280; };
  return pts.map(([x, y]) => [x + (r() - 0.5) * amt, y + (r() - 0.5) * amt]);
}

function stockOf(s: CardOpts["stock"]): PaperStock {
  if (!s) return STOCK.white;
  return typeof s === "string" ? STOCK[s] : s;
}

const INK_FOR: Record<Role, string> = {
  shell: BP_LINE, structure: BP_LINE, mech: "#7dffb6", person: "#ffc966", fx: BP_LINE, light: BP_LINE,
};

export class Card {
  mesh: THREE.Mesh;
  geo: THREE.ExtrudeGeometry;
  b: Bounds;
  pts: Pt[];
  o: CardOpts;
  mats = new Map<Look, THREE.Material[]>();
  look: Look | null = null;
  glow = 0; // extra emissive (fail-safe flash, lamps)
  _relief?: THREE.Texture | null;
  constructor(shape: THREE.Shape, o: CardOpts = {}) {
    this.o = o;
    const thick = o.thick ?? 0.012;
    this.geo = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: true, bevelThickness: 0, bevelSize: 0, bevelOffset: 0, bevelSegments: 1, curveSegments: 10 });
    this.geo.translate(0, 0, -thick);
    this.pts = shape.getPoints(10).map((v) => [v.x, v.y] as Pt);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    this.pts.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
    this.b = { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
    // cap uvs = bounds-normalised
    const pos = this.geo.getAttribute("position") as THREE.BufferAttribute;
    const uv = this.geo.getAttribute("uv") as THREE.BufferAttribute;
    const g0 = this.geo.groups[0];
    for (let i = g0.start; i < g0.start + g0.count; i++) {
      if (o.tile) uv.setXY(i, pos.getX(i) / o.tile.size, pos.getY(i) / o.tile.size);
      else uv.setXY(i, (pos.getX(i) - x0) / this.b.w, (pos.getY(i) - y0) / this.b.h);
    }
    uv.needsUpdate = true;
    this.mesh = new THREE.Mesh(this.geo, []);
    this.mesh.castShadow = o.shadow ?? true;
    this.mesh.receiveShadow = true;
    REG.push(this);
  }
  private paintTile(look: Look) {
    const o = this.o, tl = o.tile!;
    const key = `${tl.key}:${look}`;
    let t = _tiles.get(key);
    if (t) return t;
    const k = (o.px ?? 900);
    const W = Math.round(tl.size * k);
    const c = canvas(W, W), g = c.getContext("2d")!;
    paperBase(g, W, W, stockOf(o.stock), look, o.seed ?? 1);
    g.setTransform(k, 0, 0, -k, 0, W);
    tl.paint(new Painter(g, look, k, o.seed ?? 1, INK_FOR[o.role ?? "shell"]), tl.size);
    t = tex(c, true, true);
    _tiles.set(key, t);
    return t;
  }
  private paint(look: Look) {
    const o = this.o, b = this.b;
    if (o.tile) return this.paintTile(look);
    const pxm = o.px ?? 900, maxPx = o.maxPx ?? 1024;
    const k = Math.min(pxm, maxPx / Math.max(b.w, b.h));
    const W = Math.ceil(b.w * k) + 2, H = Math.ceil(b.h * k) + 2;
    const c = canvas(W, H), g = c.getContext("2d")!;
    const stock = stockOf(o.stock);
    paperBase(g, W, H, stock, look, o.seed ?? 1);
    g.setTransform(k, 0, 0, -k, -b.x0 * k + 1, b.y1 * k + 1);
    const p = new Painter(g, look, k, o.seed ?? 1, INK_FOR[o.role ?? "shell"]);
    o.print?.(p, this.pts, b);
    if (o.inset !== false) {
      // printed border just inside the cut: tone-on-tone in solid, white key line in blueprint
      const ins = Math.min(b.w, b.h) * 0.035 + 0.003;
      const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
      const sx = (b.w - 2 * ins) / b.w, sy = (b.h - 2 * ins) / b.h;
      const pin: Pt[] = this.pts.map(([x, y]) => [cx + (x - cx) * sx, cy + (y - cy) * sy]);
      if (look === "blueprint") p.stroke(pin, "", Math.max(0.0035, ins * 0.18), true);
      else if (look === "solid") p.stroke(pin, "rgba(0,0,0,0.10)", Math.max(0.002, ins * 0.12), true);
    }
    return tex(c);
  }
  setLook(look: Look) {
    if (this.look === look) return;
    this.look = look;
    let m = this.mats.get(look);
    if (!m) { m = this.makeMats(look); this.mats.set(look, m); }
    this.mesh.material = m;
    const role = this.o.role ?? "shell";
    this.mesh.castShadow = (this.o.shadow ?? true) && !(look === "xray" && role === "shell");
  }
  private reliefTex(): THREE.Texture | null {
    const o = this.o, b = this.b;
    if (!o.relief) return null;
    const k = Math.min(o.reliefPx ?? 500, 1024 / Math.max(b.w, b.h));
    const W = Math.ceil(b.w * k) + 2, H = Math.ceil(b.h * k) + 2;
    const c = canvas(W, H), g = c.getContext("2d")!;
    // base = the shared paper formation tile, so embossing sits on believable stock
    const ft = fiberTexCanvas(); const pat = g.createPattern(ft, "repeat")!;
    g.fillStyle = pat; g.globalAlpha = 1; g.save(); g.scale(Math.max(0.25, k * 0.6 / 512), Math.max(0.25, k * 0.6 / 512)); g.fillRect(0, 0, W * 8, H * 8); g.restore();
    g.setTransform(k, 0, 0, -k, -b.x0 * k + 1, b.y1 * k + 1);
    o.relief(new Painter(g, "solid", k, (o.seed ?? 1) + 77), this.pts, b);
    return tex(c, false);
  }
  private makeMats(look: Look): THREE.Material[] {
    const o = this.o, stock = stockOf(o.stock), role = o.role ?? "shell";
    if (this._relief === undefined) this._relief = this.reliefTex();
    const bump = this._relief ?? (o.tile ? fiberTex(o.tile.size, o.tile.size) : fiberTex(this.b.w, this.b.h));
    // structure/person/mech keep their print in x-ray; shells turn into vellum
    const eff: Look = look === "xray" && role !== "shell" ? (role === "structure" ? "blueprint" : "solid") : look;
    const map = this.paint(eff);
    if (role === "fx") {
      // marker-ink force arrows: unlit, scaled so the base ink lands exactly on brand red after tone mapping
      const lin = new THREE.Color(BRAND.red), u = untone(BRAND.red);
      const face = new THREE.MeshBasicMaterial({ map, color: new THREE.Color(u.r / lin.r, u.g / Math.max(lin.g, 1e-4), u.b / Math.max(lin.b, 1e-4)) });
      const side = new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffd2cf") });
      return [face, side];
    }
    if (eff === "solid") {
      const kind = stock.kind ?? "paper";
      const foil = kind === "foil" || (o.metal ?? 0) > 0.5;
      const face = new THREE.MeshStandardMaterial({
        map, bumpMap: bump, bumpScale: o.bump ?? (foil ? 1.2 : kind === "coated" ? 0.8 : 2.0),
        roughness: o.rough ?? (foil ? 0.34 : kind === "coated" ? 0.62 : kind === "kraft" ? 0.9 : 0.94),
        metalness: o.metal ?? (foil ? 0.88 : 0), envMapIntensity: foil ? 1.0 : 0.25,
      });
      if (o.emissive) { face.emissiveMap = map; face.emissive = o.emissive.clone(); }
      const e = o.edge ?? 1;
      const side = new THREE.MeshStandardMaterial({ color: new THREE.Color(stock.core).multiplyScalar(e), roughness: 0.97, metalness: 0, envMapIntensity: 0.1 });
      return [face, side];
    }
    if (eff === "blueprint") {
      const face = new THREE.MeshStandardMaterial({
        map, emissiveMap: map, emissive: new THREE.Color(0.30, 0.42, 0.62), roughness: 0.9, bumpMap: bump, bumpScale: 0.003, envMapIntensity: 0.2,
      });
      const ink = INK_FOR[role];
      const side = new THREE.MeshBasicMaterial({ color: untone(ink === BP_LINE ? BRAND.cyan : ink, 1.35), toneMapped: true });
      if (look === "xray") { face.transparent = false; }
      return [face, side];
    }
    // x-ray vellum shell
    const face = new THREE.MeshStandardMaterial({
      map, color: new THREE.Color("#8fb6cc"), transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide, roughness: 0.7,
      emissive: new THREE.Color(0.05, 0.11, 0.16), emissiveMap: map, bumpMap: bump, bumpScale: 0.002,
    });
    const side = new THREE.MeshBasicMaterial({ color: untone(BRAND.cyan, 1.15), transparent: true, opacity: 0.9, depthWrite: false });
    return [face, side];
  }
}

/** Convenience: build a card and return its mesh (positioned by the caller). */
export function card(shape: THREE.Shape, o: CardOpts = {}) { return new Card(shape, o); }

/** A folded-card box: 6 card faces of given thickness, each with its own print. Origin at bottom centre. */
export function cardBox(w: number, h: number, d: number, o: CardOpts & { printFront?: CardOpts["print"]; printTop?: CardOpts["print"]; printSide?: CardOpts["print"] }) {
  const g = new THREE.Group();
  const t = o.thick ?? 0.012;
  const mk = (W: number, H: number, pr: CardOpts["print"], seed: number) =>
    new Card(roundRect(-W / 2, -H / 2, W, H, 0.004), { ...o, print: pr, seed: (o.seed ?? 1) * 13 + seed });
  const front = mk(w, h, o.printFront ?? o.print, 1); front.mesh.position.set(0, h / 2, d / 2); g.add(front.mesh);
  const back = mk(w, h, o.print, 2); back.mesh.position.set(0, h / 2, -d / 2); back.mesh.rotation.y = Math.PI; g.add(back.mesh);
  const l = mk(d - 2 * t, h, o.printSide ?? o.print, 3); l.mesh.position.set(-w / 2, h / 2, 0); l.mesh.rotation.y = -Math.PI / 2; g.add(l.mesh);
  const r = mk(d - 2 * t, h, o.printSide ?? o.print, 4); r.mesh.position.set(w / 2, h / 2, 0); r.mesh.rotation.y = Math.PI / 2; g.add(r.mesh);
  const top = mk(w, d, o.printTop ?? o.print, 5); top.mesh.position.set(0, h, 0); top.mesh.rotation.x = -Math.PI / 2; g.add(top.mesh);
  return g;
}
