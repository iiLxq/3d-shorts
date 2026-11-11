// [gus lab] Gus v2: one replacement "drawing" of the paper puppet (front / three-quarter / profile), or the
// pop-up V-fold body (front drawing folded down the centre line). Every piece is a printed card with real
// thickness and a white core; the face expresses through pieces sliding behind die-cut eye windows.
// Conventions: feet at y=0, facing +z, character's left = +x (s=+1). Profile drawings face -x.
import * as THREE from "three";
import { Card, CardOpts } from "./card";
import { Painter, Pt, PaperStock, BRAND } from "./paint";
import {
  ST, smooth, mirrorHalf, shapeOf, ellipsePts, rectPts, transform, jitter, clipHalf, halfWidthAt,
  wash, spot, stitch, speckle, deg, clamp,
} from "./kit";

export type ViewId = "front" | "threeQuarter" | "profile";
export type MouthId = "neutral" | "firm" | "pursed" | "open" | "scream" | "clench" | "exhale" | "smile" | "grin";
export const MOUTHS: MouthId[] = ["neutral", "firm", "pursed", "open", "scream", "clench", "exhale", "smile", "grin"];

export interface Variant {
  id: "A" | "B"; heads: number; Hh: number; hs: number; chinY: number; shY: number; shW: number; chestW: number; hemW: number;
  hemY: number; hipY: number; legX: number; thigh: number; shin: number; ankleH: number; armU: number; armF: number;
  armX: number; armY: number; stance: number; D: number;
}
// 1.80 m including the helmet. "Head" = chin to helmet top.
export const VARIANTS: Record<"A" | "B", Variant> = {
  A: { id: "A", heads: 5, Hh: 0.36, hs: 1, chinY: 1.44, shY: 1.37, shW: 0.255, chestW: 0.235, hemW: 0.238, hemY: 0.76, hipY: 0.88, legX: 0.09,
    thigh: 0.41, shin: 0.36, ankleH: 0.11, armU: 0.29, armF: 0.255, armX: 0.2, armY: 1.325, stance: 0.105, D: 0.13 },
  B: { id: "B", heads: 5.5, Hh: 0.327, hs: 0.327 / 0.36, chinY: 1.473, shY: 1.4, shW: 0.236, chestW: 0.214, hemW: 0.216, hemY: 0.8, hipY: 0.92, legX: 0.083,
    thigh: 0.43, shin: 0.38, ankleH: 0.11, armU: 0.3, armF: 0.265, armX: 0.186, armY: 1.357, stance: 0.098, D: 0.12 },
};

/** Linear multiplier on the amber print so the LIT jacket lands on #FFB020 through stage light + grade (calibrated, see NOTES). */
export const AMBER_TINT = new THREE.Color(1.07, 1.1, 0.72);

const TB = 0.012;  // body card
const TF = 0.004;  // face card
const PXB = 1300, PXF = 3200;

// ---------------------------------------------------------------- brass split pins (a design feature)
const brass = new THREE.MeshStandardMaterial({ color: "#d1a54a", metalness: 0.92, roughness: 0.26, envMapIntensity: 1.3 });
const brassD = new THREE.MeshStandardMaterial({ color: "#7a5c22", metalness: 0.75, roughness: 0.45 });
const pinBP = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.62, 0.13) });
export const PIN_MATS = { brass, brassD, pinBP };
function pinMesh(r: number) {
  const g = new THREE.Group();
  const w = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.4, r * 1.4, 0.0022, 28), brassD);
  w.rotation.x = Math.PI / 2; w.position.z = 0.0011;
  const d = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2), brass);
  d.rotation.x = Math.PI / 2; d.scale.set(1, 0.42, 1); d.position.z = 0.0022;
  const sl = new THREE.Mesh(new THREE.BoxGeometry(r * 1.5, r * 0.18, 0.002), brassD);
  sl.position.z = 0.0022 + r * 0.4; sl.rotation.z = 0.6;
  for (const m of [w, d, sl]) { m.castShadow = true; g.add(m); }
  g.userData.pin = true;
  return g;
}

// ---------------------------------------------------------------- prints
const amberShade = (p: Painter, pts: Pt[], v: Variant, x0 = -0.3, x1 = 0.3) => {
  wash(p, pts, [0, v.shY + 0.05], [0, v.hemY - 0.02], [[0, "rgba(255,246,220,0.10)"], [0.55, "rgba(0,0,0,0)"], [1, "rgba(130,52,0,0.16)"]]);
  wash(p, pts, [x0, 0], [x1, 0], [[0, "rgba(120,48,0,0.18)"], [0.2, "rgba(0,0,0,0)"], [0.8, "rgba(0,0,0,0)"], [1, "rgba(120,48,0,0.14)"]]);
};
const tapePrint = (p: Painter, pts: Pt[], b: { x0: number; x1: number; y0: number; y1: number }) => {
  wash(p, pts, [0, b.y1], [0, b.y0], [[0, "rgba(255,255,255,0.35)"], [1, "rgba(80,90,95,0.18)"]]);
  if (p.look === "solid") {
    const g = p.g; g.save(); p.path(pts); g.clip(); g.strokeStyle = "rgba(120,130,135,0.18)"; g.lineWidth = 0.0012;
    for (let x = b.x0 - 0.1; x < b.x1 + 0.1; x += 0.006) { g.beginPath(); g.moveTo(x, b.y0); g.lineTo(x + (b.y1 - b.y0), b.y1); g.stroke(); }
    g.restore();
  }
  stitch(p, [[b.x0, b.y0 + 0.004], [b.x1, b.y0 + 0.004]], "rgba(70,70,70,0.45)", 0.0012, 0.006);
  stitch(p, [[b.x0, b.y1 - 0.004], [b.x1, b.y1 - 0.004]], "rgba(70,70,70,0.45)", 0.0012, 0.006);
};
const navyPrint = (p: Painter, pts: Pt[]) => {
  wash(p, pts, [0, 2], [0, 0], [[0, "rgba(255,255,255,0.06)"], [1, "rgba(0,0,0,0.12)"]]);
};
const trouserPrint = (len: number) => (p: Painter, pts: Pt[]) => {
  wash(p, pts, [-0.08, 0], [0.08, 0], [[0, "rgba(0,0,0,0.22)"], [0.3, "rgba(0,0,0,0)"], [0.75, "rgba(255,255,255,0.04)"], [1, "rgba(0,0,0,0.2)"]]);
  stitch(p, [[0.045, 0.03], [0.04, -len]], "rgba(150,165,190,0.35)", 0.0014, 0.007);
};
const skinPrint = (p: Painter, pts: Pt[]) => {
  wash(p, pts, [-0.12, 0], [0.12, 0], [[0, "rgba(120,50,30,0.16)"], [0.35, "rgba(0,0,0,0)"], [1, "rgba(110,45,30,0.14)"]]);
};

type Bnd = { x0: number; y0: number; x1: number; y1: number; w: number; h: number };

export interface EyeRig { g: THREE.Group; ball: THREE.Group; pupil: THREE.Object3D; lidU: THREE.Object3D; lidL: THREE.Object3D; h: number; sx: number }
export interface HandRig { fingers: THREE.Group; straight: THREE.Object3D; fist: THREE.Object3D; thumb: THREE.Group; din: number }

export interface FigureOpts { view: ViewId; fold?: number; variant: Variant }

export class Figure {
  root = new THREE.Group();     // the drawing's plane; api orients / mirrors it
  pelvis = new THREE.Group();
  torso = new THREE.Group();
  halves: Record<number, THREE.Group> = {};
  head = new THREE.Group();     // neck pivot
  face = new THREE.Group();     // head-local (chin = y 0), scaled by variant
  headHalves: Record<number, THREE.Group> = {};
  j: Record<string, THREE.Group> = {};
  eyes: EyeRig[] = [];
  brows: { g: THREE.Group; s: number; y0: number }[] = [];
  mouths: Partial<Record<MouthId, THREE.Object3D>> = {};
  mouthMap: Record<MouthId, MouthId> = Object.fromEntries(MOUTHS.map((m) => [m, m])) as Record<MouthId, MouthId>;
  stache = new THREE.Group();
  smileLines: THREE.Object3D[] = [];
  hands: Record<number, HandRig> = {};
  hammer = new THREE.Group();
  lamp = new THREE.Object3D();
  soles: THREE.Object3D[] = [];
  cards: Card[] = [];
  pins: THREE.Object3D[] = [];
  view: ViewId; fold: number; v: Variant;
  tq = 45 * deg;
  // three-quarter torso mapping (x_c, near/far scales)
  xc = 0; sN = 1; sF = 1;
  legZ: Record<number, number> = { 1: -0.022, [-1]: -0.022 };

  constructor(o: FigureOpts) {
    this.view = o.view; this.fold = o.fold ?? 0; this.v = o.variant;
    const v = this.v;
    this.root.add(this.pelvis);
    this.pelvis.position.y = v.hipY;
    this.pelvis.add(this.torso);
    if (this.view === "threeQuarter") {
      const W = (v.chestW + v.hemW) / 2, R = W * 0.9;
      this.xc = -0.07; this.sN = (R - this.xc) / W; this.sF = (R + this.xc) / W;
    }
    for (const s of [1, -1]) {
      const h = new THREE.Group(); this.torso.add(h); this.halves[s] = h;
      if (this.view === "threeQuarter") { h.position.x = this.xc; h.scale.x = s > 0 ? this.sN : this.sF; }
      else if (this.view === "front") h.rotation.y = s * this.fold;
    }
    this.buildLegs();
    if (this.view === "profile") this.buildTorsoProfile(); else this.buildTorso();
    this.buildArms();
    this.buildHead();
  }

  // ------------------------------------------------------------ helpers
  card(parent: THREE.Object3D, pts: Pt[], stock: PaperStock, o: CardOpts & { holes?: Pt[][] } = {}, x = 0, y = 0, z = 0) {
    const tint = stock === ST.amber || stock === ST.amberD ? AMBER_TINT.clone().multiplyScalar(o.tint ? o.tint.r : 1) : o.tint;
    const c = new Card(shapeOf(pts, o.holes ?? []), { px: PXB, role: "person", thick: TB, maxPx: 1024, ...o, stock, tint });
    c.mesh.position.set(x, y, z);
    parent.add(c.mesh);
    this.cards.push(c);
    return c;
  }
  pin(parent: THREE.Object3D, x: number, y: number, z: number, r = 0.015) {
    const m = pinMesh(r); m.position.set(x, y, z); parent.add(m); this.pins.push(m); return m;
  }
  /** Torso-level piece split down the centre line into the two halves (both scale/fold with their half). */
  torsoPiece(pts: Pt[], stock: PaperStock, o: CardOpts = {}, z = 0) {
    const v = this.v, out: Card[] = [];
    for (const s of [1, -1] as const) {
      const hp = clipHalf(pts, (p) => s * p[0]);
      if (hp.length < 3) continue;
      let a = 0; for (let i = 0; i < hp.length; i++) { const p = hp[i], q = hp[(i + 1) % hp.length]; a += p[0] * q[1] - q[0] * p[1]; }
      if (Math.abs(a) < 1e-6) continue;
      out.push(this.card(this.halves[s], hp, stock, { seed: (o.seed ?? 1) + s, ...o }, 0, -v.hipY, z));
    }
    return out;
  }
  /** Where a front-drawing torso x lands for attached parts (arms, legs, hammer). */
  mapX(x: number, depth = 1): [number, number] {
    if (this.view === "threeQuarter") return [this.xc * depth + x * (x >= 0 ? this.sN : this.sF), 0];
    if (this.view === "front") return [x * Math.cos(this.fold), -Math.abs(x) * Math.sin(this.fold)];
    return [0, 0];
  }
  tinted(far: boolean) { return far ? new THREE.Color(0.62, 0.64, 0.7) : undefined; }

  // ------------------------------------------------------------ legs + boots
  buildLegs() {
    const v = this.v, prof = this.view === "profile", tq = this.view === "threeQuarter";
    for (const s of [1, -1] as const) {
      const far = (prof || tq) && s < 0;
      const tint = this.tinted(far);
      const hip = new THREE.Group();
      const [hx, hz] = prof ? [0, 0] : this.mapX(s * v.legX, 0.6);
      const z = prof ? (s > 0 ? -0.018 : -0.042) : tq ? (s > 0 ? -0.02 : -0.045) : hz - 0.022;
      this.legZ[s] = z;
      hip.position.set(hx, 0, z); this.pelvis.add(hip);
      const tw = 0.075, kw = 0.064;
      const thigh = smooth([[-tw, 0.06], [tw, 0.06], [tw - 0.004, -v.thigh * 0.5], [kw + 0.002, -v.thigh - 0.01], [-kw, -v.thigh - 0.01], [-tw + 0.002, -v.thigh * 0.5]], 3);
      this.card(hip, thigh, ST.trouser, { seed: 101 + s, print: trouserPrint(v.thigh), tint }, 0, 0, 0);
      // cargo pocket on the outer thigh (front: outer side; profile/3q: centre)
      const ox = prof || tq ? -0.005 : s * 0.03;
      this.card(hip, rectPts(ox - 0.042, -v.thigh * 0.78, ox + 0.042, -v.thigh * 0.5, 0.008), ST.trouser, {
        seed: 103 + s, tint, thick: 0.006, print: (p, pts) => { navyPrint(p, pts); stitch(p, [[ox - 0.036, -v.thigh * 0.56], [ox + 0.036, -v.thigh * 0.56]], "rgba(150,165,190,0.4)", 0.0012, 0.005); },
      }, 0, 0, 0.007);
      const knee = new THREE.Group(); knee.position.set(0, -v.thigh, 0.012); hip.add(knee);
      const shin = smooth([[-kw, 0.04], [kw, 0.04], [kw - 0.004, -v.shin * 0.5], [0.058, -v.shin - 0.01], [-0.056, -v.shin - 0.01], [-kw + 0.003, -v.shin * 0.5]], 3);
      this.card(knee, shin, ST.trouser, { seed: 105 + s, print: trouserPrint(v.shin), tint }, 0, 0, 0);
      this.card(knee, rectPts(-0.058, -0.105, 0.058, 0.035, 0.022), ST.pad, {
        seed: 107 + s, tint, thick: 0.007, print: (p, pts, b) => { navyPrint(p, pts); stitch(p, transform(rectPts(b.x0 + 0.008, b.y0 + 0.008, b.x1 - 0.008, b.y1 - 0.008, 0.016), 1, 1), "rgba(160,170,190,0.45)", 0.0012, 0.005); },
      }, 0, 0, 0.007);
      this.pin(knee, 0, -0.03, 0.007, 0.012);
      const ankle = new THREE.Group(); ankle.position.set(0, -v.shin, 0.01); knee.add(ankle);
      this.buildBoot(ankle, s, prof ? 1 : tq ? 0.62 : 0, tint);
      this.j["hip" + s] = hip; this.j["knee" + s] = knee; this.j["ankle" + s] = ankle;
    }
  }
  buildBoot(ankle: THREE.Group, s: number, side: number, tint?: THREE.Color) {
    const a = this.v.ankleH;
    const bootPrint = (p: Painter, pts: Pt[], b: Bnd) => {
      wash(p, pts, [0, b.y1], [0, b.y0], [[0, "rgba(255,230,200,0.10)"], [1, "rgba(30,15,5,0.25)"]]);
      if (side < 0.5) { // laces on the front face
        for (let i = 0; i < 4; i++) { const y = 0.035 - i * 0.022; p.stroke([[-0.022, y], [0.022, y - 0.012]], "#e9dcc4", 0.0035); p.stroke([[0.022, y], [-0.022, y - 0.012]], "#e9dcc4", 0.0035); }
      } else stitch(p, [[0.05, -0.07], [-0.13, -0.075]], "rgba(240,220,190,0.5)", 0.0016, 0.006);
    };
    if (side === 0) {
      this.card(ankle, smooth([[-0.066, 0.068], [0.066, 0.068], [0.07, -0.03], [0.082, -a + 0.04], [0.08, -a + 0.02], [-0.08, -a + 0.02], [-0.082, -a + 0.04], [-0.07, -0.03]], 3), ST.boot, { seed: 121 + s, print: bootPrint, tint }, 0, 0, 0);
      this.card(ankle, smooth([[-0.074, -a + 0.068], [0.074, -a + 0.068], [0.082, -a + 0.025], [-0.082, -a + 0.025]], 3), ST.leather, { seed: 123 + s, thick: 0.006, tint }, 0, 0, 0.006);
      this.card(ankle, rectPts(-0.088, -a, 0.088, -a + 0.03, 0.008), ST.sole, { seed: 125 + s, thick: 0.01, tint }, 0, 0, 0.012);
      this.card(ankle, rectPts(-0.068, 0.05, 0.068, 0.074, 0.008), ST.leather, { seed: 127 + s, thick: 0.005, tint }, 0, 0, 0.005);
    } else {
      // side boot facing -x (toe forward); three-quarter = same drawing narrowed
      const sx = side;
      const g = new THREE.Group(); g.scale.x = sx; g.position.x = side < 1 ? -0.012 : 0; ankle.add(g);
      this.card(g, smooth([[0.06, 0.065], [-0.046, 0.065], [-0.05, -0.02], [-0.09, -0.045], [-0.15, -a + 0.04], [-0.158, -a + 0.02], [0.074, -a + 0.02], [0.072, -0.02]], 3), ST.boot, { seed: 131 + s, print: bootPrint, tint }, 0, 0, 0);
      this.card(g, smooth([[-0.088, -0.05], [-0.15, -a + 0.04], [-0.16, -a + 0.022], [-0.08, -a + 0.022], [-0.07, -0.06]], 3), ST.leather, { seed: 133 + s, thick: 0.006, tint }, 0, 0, 0.006);
      this.card(g, rectPts(-0.166, -a, 0.082, -a + 0.026, 0.008), ST.sole, { seed: 135 + s, thick: 0.01, tint }, 0, 0, 0.012);
      this.card(g, rectPts(-0.05, 0.048, 0.064, 0.07, 0.008), ST.leather, { seed: 137 + s, thick: 0.005, tint }, 0, 0, 0.005);
    }
    // contact occlusion under the sole (lamp shadow does the rest)
    const ao = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), aoMat());
    ao.rotation.x = -Math.PI / 2; ao.position.set(side ? -0.04 * side : 0, -a + 0.0015, 0);
    ao.scale.set(side ? 0.3 * Math.max(side, 0.62) : 0.19, side ? 0.16 : 0.3, 1); ao.renderOrder = 1; ao.userData.ao = true;
    ankle.add(ao);
    const sole = new THREE.Object3D(); sole.position.set(side ? -0.04 : 0, -a, 0); ankle.add(sole); this.soles.push(sole);
  }

  // ------------------------------------------------------------ torso (front / three-quarter / V-fold)
  jacketHalf(): Pt[] {
    const v = this.v;
    return smooth([[0, v.hemY], [v.hemW * 0.6, v.hemY - 0.004], [v.hemW, v.hemY], [v.hemW + 0.006, v.hemY + 0.14], [v.chestW, v.shY - 0.17],
      [v.shW - 0.004, v.shY - 0.07], [v.shW - 0.03, v.shY - 0.012], [0.13, v.shY + 0.008], [0.078, v.shY + 0.022], [0.05, v.shY - 0.01], [0.012, v.shY - 0.07], [0, v.shY - 0.076]], 3, false);
  }
  buildTorso() {
    const v = this.v;
    const half = this.jacketHalf();
    const full = jitter(mirrorHalf(half), 0.002, 7);
    // back layers: base-layer shirt in the V, back collar
    this.torsoPiece(smooth([[-0.07, v.shY + 0.02], [0.07, v.shY + 0.02], [0.0, v.shY - 0.1]], 2), ST.black, { seed: 201, thick: 0.006 }, -0.012);
    this.torsoPiece(rectPts(-0.082, v.shY - 0.04, 0.082, v.shY + 0.045, 0.02), ST.navy, { seed: 203, print: navyPrint }, -0.02);
    // jacket body
    this.torsoPiece(full, ST.amber, { seed: 205, print: (p, pts) => {
      amberShade(p, pts, v, -v.hemW - 0.02, v.hemW + 0.02);
      for (const s of [1, -1]) stitch(p, [[s * (v.hemW - 0.032), v.hemY + 0.01], [s * (v.chestW - 0.03), v.shY - 0.18]], "rgba(140,70,0,0.45)");
      stitch(p, [[-v.hemW, v.hemY + 0.016], [v.hemW, v.hemY + 0.016]], "rgba(140,70,0,0.45)");
    } }, 0);
    // navy yoke over the shoulders
    for (const s of [1, -1]) {
      const yoke = clipHalf(clipHalf(full, (p) => p[1] - (v.shY - 0.12)), (p) => s * p[0] - 0.03);
      this.torsoPiece(transform(yoke, 0.985, 1, 0, -0.002), ST.navy, { seed: 207 + s, print: (p, pts, b) => { navyPrint(p, pts); stitch(p, [[b.x0, v.shY - 0.112], [b.x1, v.shY - 0.112]], "rgba(170,180,200,0.5)", 0.0012, 0.006); } }, 0.005);
    }
    // reflective tape: waist + chest hoops (cut at the zip), braces over the shoulders
    for (const [y0, y1] of [[v.hemY + 0.03, v.hemY + 0.074], [v.shY - 0.272, v.shY - 0.228]]) {
      for (const s of [1, -1]) {
        const w = Math.min(halfWidthAt(full, y0), halfWidthAt(full, y1)) - 0.004;
        const xs = [s * 0.02, s * w].sort((a, b) => a - b);
        this.torsoPiece(rectPts(xs[0], y0, xs[1], y1, 0.003), ST.tape, { seed: 211 + s, thick: 0.004, rough: 0.55, print: (p, pts, b) => tapePrint(p, pts, b) }, 0.009);
      }
    }
    for (const s of [1, -1]) {
      const xs = [s * 0.062, s * 0.102].sort((a, b) => a - b);
      const top = v.shY + 0.012;
      this.torsoPiece(clipHalf(rectPts(xs[0], v.shY - 0.23, xs[1], top, 0.003), (p) => (halfWidthAt(full, p[1]) > Math.abs(p[0]) ? 1 : -1)), ST.tape, { seed: 215 + s, thick: 0.004, rough: 0.55, print: (p, pts, b) => tapePrint(p, pts, b) }, 0.013);
    }
    // lower flap pockets + brass snaps
    for (const s of [1, -1]) {
      const xs = [s * 0.068, s * 0.192].sort((a, b) => a - b);
      this.torsoPiece(rectPts(xs[0], v.hipY + 0.07, xs[1], v.hipY + 0.17, 0.01), ST.amberD, { seed: 221 + s, thick: 0.006, print: (p, pts) => { amberShade(p, pts, v); } }, 0.006);
      this.torsoPiece(rectPts(xs[0] - 0.005, v.hipY + 0.138, xs[1] + 0.005, v.hipY + 0.182, 0.008), ST.amber, { seed: 223 + s, thick: 0.006, print: (p, pts, b) => { amberShade(p, pts, v); stitch(p, [[b.x0 + 0.006, b.y0 + 0.006], [b.x1 - 0.006, b.y0 + 0.006]], "rgba(140,70,0,0.5)"); } }, 0.013);
      this.pin(this.halves[s], s * 0.13, v.hipY + 0.155 - v.hipY, 0.0135, 0.008);
    }
    // name tag (right chest) and radio (left chest)
    this.torsoPiece(rectPts(-0.13, v.shY - 0.322, -0.064, v.shY - 0.284, 0.004), ST.white, { seed: 231, thick: 0.004, print: (p) => {
      p.text("GUS", -0.097, v.shY - 0.3135, 0.025, "#1f2a42", { align: "center", font: "'JetBrains Mono', monospace", weight: 800 });
    } }, 0.008);
    this.torsoPiece(rectPts(0.108, v.shY - 0.218, 0.158, v.shY - 0.134, 0.008), ST.black, { seed: 233, thick: 0.01, print: (p) => {
      for (let i = 0; i < 4; i++) p.stroke([[0.116, v.shY - 0.2 + i * 0.012], [0.15, v.shY - 0.2 + i * 0.012]], "#55585e", 0.003);
      p.rect(0.118, v.shY - 0.152, 0.03, 0.01, "#9fa6ad");
    } }, 0.018);
    this.torsoPiece(rectPts(0.142, v.shY - 0.14, 0.151, v.shY - 0.07, 0.004), ST.black, { seed: 235, thick: 0.005 }, 0.016);
    // collar (navy, stand-up) + zip placket
    for (const s of [1, -1]) this.torsoPiece(smooth([[s * 0.022, v.shY - 0.07], [s * 0.074, v.shY + 0.004], [s * 0.092, v.shY + 0.05], [s * 0.064, v.shY + 0.055], [s * 0.02, v.shY - 0.01]], 2), ST.navy, { seed: 241 + s, thick: 0.008, print: navyPrint }, 0.012);
    this.torsoPiece(rectPts(-0.017, v.hemY + 0.004, 0.017, v.shY - 0.07, 0.004), ST.amberD, { seed: 245, thick: 0.006, print: (p) => {
      p.rect(-0.005, v.hemY, 0.01, v.shY - v.hemY, "#3c2b12");
      for (let y = v.hemY + 0.01; y < v.shY - 0.08; y += 0.009) p.rect(-0.004, y, 0.008, 0.004, "#b0a690");
      stitch(p, [[-0.012, v.hemY + 0.01], [-0.012, v.shY - 0.08]], "rgba(140,70,0,0.5)"); stitch(p, [[0.012, v.hemY + 0.01], [0.012, v.shY - 0.08]], "rgba(140,70,0,0.5)");
    } }, 0.016);
    this.torsoPiece(rectPts(-0.009, v.shY - 0.105, 0.009, v.shY - 0.07, 0.003), ST.steel, { seed: 247, thick: 0.004, metal: 0.6, rough: 0.4 }, 0.022);
    // tool belt + brass buckle + pouch
    const bw = v.hemW + 0.012;
    this.torsoPiece(rectPts(-bw, v.hipY - 0.006, bw, v.hipY + 0.05, 0.006), ST.leather, { seed: 251, print: (p, pts) => {
      wash(p, pts, [0, v.hipY + 0.05], [0, v.hipY - 0.006], [[0, "rgba(255,230,200,0.12)"], [1, "rgba(0,0,0,0.25)"]]);
      stitch(p, [[-bw, v.hipY + 0.002], [bw, v.hipY + 0.002]], "rgba(230,200,160,0.5)"); stitch(p, [[-bw, v.hipY + 0.042], [bw, v.hipY + 0.042]], "rgba(230,200,160,0.5)");
    } }, 0.02);
    this.torsoPiece(rectPts(-0.034, v.hipY - 0.012, 0.034, v.hipY + 0.056, 0.008), { base: "#c99a3e", mottle: 0.04, core: "#fff6e0" }, { seed: 253, thick: 0.006, metal: 0.65, rough: 0.35, print: (p) => { p.rect(-0.02, v.hipY + 0.002, 0.04, 0.04, "#5b3f2a"); } }, 0.028);
    this.torsoPiece(rectPts(0.13, v.hipY - 0.12, 0.232, v.hipY + 0.035, 0.012), ST.kraft, { seed: 255, print: (p, pts) => {
      wash(p, pts, [0.13, 0], [0.232, 0], [[0, "rgba(0,0,0,0)"], [1, "rgba(60,30,10,0.25)"]]);
      p.rect(0.15, v.hipY + 0.035, 0.012, 0.05, "#3b5b8c"); p.rect(0.19, v.hipY + 0.035, 0.016, 0.035, "#8c8f94");
    } }, 0.032);
    this.torsoPiece(rectPts(0.126, v.hipY - 0.02, 0.236, v.hipY + 0.04, 0.012), ST.leather, { seed: 257, thick: 0.006 }, 0.04);
    this.pin(this.halves[1], 0.181, 0.0, 0.0405, 0.008);
    this.buildHammer(-0.19);
  }
  buildHammer(x: number) {
    const v = this.v;
    const [hx, hz] = this.mapX(x);
    this.hammer.position.set(hx, 0.012, hz + (this.view === "profile" ? -0.06 : 0.026));
    this.torso.add(this.hammer);
    this.card(this.hammer, rectPts(-0.012, -0.2, 0.012, 0.012, 0.006), ST.wood, { seed: 261, thick: 0.008, print: (p, pts) => wash(p, pts, [-0.012, 0], [0.012, 0], [[0, "rgba(0,0,0,0.2)"], [1, "rgba(255,240,220,0.1)"]]) }, 0, 0, 0);
    this.card(this.hammer, smooth([[-0.058, -0.24], [0.05, -0.24], [0.05, -0.2], [0.012, -0.195], [-0.012, -0.195], [-0.06, -0.21]], 2), ST.steel, { seed: 263, thick: 0.012, metal: 0.55, rough: 0.35 }, 0, 0, 0.004);
    this.pin(this.hammer, 0, 0, 0.002, 0.009);
    void v;
  }
  buildTorsoProfile() {
    const v = this.v, D = v.D;
    const side = jitter(smooth([[-D, v.hemY], [D - 0.012, v.hemY], [D, v.hemY + 0.25], [D - 0.004, v.shY - 0.13], [D - 0.04, v.shY - 0.03],
      [0.03, v.shY + 0.016], [-0.045, v.shY + 0.01], [-D + 0.012, v.shY - 0.06], [-D - 0.014, v.shY - 0.2], [-D - 0.006, v.hemY + 0.25]], 3), 0.002, 9);
    const t = this.torso, Y = -v.hipY;
    this.card(t, rectPts(-0.06, v.shY - 0.04, 0.06, v.shY + 0.05, 0.02), ST.navy, { seed: 301, print: navyPrint }, 0, Y, -0.02);
    this.card(t, side, ST.amber, { seed: 303, print: (p, pts) => {
      amberShade(p, pts, v, -D - 0.02, D + 0.02);
      p.rect(-D - 0.02, v.hemY, 0.012, v.shY - v.hemY, "#3c2b12");
      stitch(p, [[0.02, v.hemY + 0.01], [0.03, v.shY - 0.18]], "rgba(140,70,0,0.45)");
    } }, 0, Y, 0);
    this.card(t, transform(clipHalf(side, (p) => p[1] - (v.shY - 0.12)), 0.98, 1, 0, -0.002), ST.navy, { seed: 305, print: navyPrint }, 0, Y, 0.005);
    for (const [y0, y1] of [[v.hemY + 0.03, v.hemY + 0.074], [v.shY - 0.272, v.shY - 0.228]]) {
      const w0 = -D - 0.008, w1 = D - 0.004;
      this.card(t, rectPts(w0, y0, w1, y1, 0.003), ST.tape, { seed: 307, thick: 0.004, rough: 0.55, print: (p, pts, b) => tapePrint(p, pts, b) }, 0, Y, 0.009);
    }
    this.card(t, rectPts(-D + 0.005, v.hipY + 0.07, -D + 0.1, v.hipY + 0.17, 0.01), ST.amberD, { seed: 309, thick: 0.006, print: (p, pts) => amberShade(p, pts, v) }, 0, Y, 0.006);
    this.card(t, rectPts(-D, v.hipY + 0.138, -D + 0.105, v.hipY + 0.182, 0.008), ST.amber, { seed: 311, thick: 0.006, print: (p, pts) => amberShade(p, pts, v) }, 0, Y, 0.013);
    this.card(t, smooth([[-0.06, v.shY - 0.03], [0.03, v.shY - 0.02], [0.05, v.shY + 0.05], [-0.04, v.shY + 0.055]], 2), ST.navy, { seed: 313, thick: 0.008, print: navyPrint }, 0, Y, 0.012);
    this.card(t, rectPts(-D - 0.014, v.hipY - 0.006, D + 0.01, v.hipY + 0.05, 0.006), ST.leather, { seed: 315, print: (p, pts) => wash(p, pts, [0, v.hipY + 0.05], [0, v.hipY - 0.006], [[0, "rgba(255,230,200,0.12)"], [1, "rgba(0,0,0,0.25)"]]) }, 0, Y, 0.02);
    this.card(t, rectPts(-0.05, v.hipY - 0.12, 0.05, v.hipY + 0.035, 0.012), ST.kraft, { seed: 317, print: (p) => { p.rect(-0.03, v.hipY + 0.035, 0.012, 0.05, "#3b5b8c"); } }, 0, Y, 0.032);
    this.card(t, rectPts(-0.054, v.hipY - 0.02, 0.054, v.hipY + 0.04, 0.012), ST.leather, { seed: 319, thick: 0.006 }, 0, Y, 0.04);
    this.pin(t, 0, 0.0, 0.0405, 0.008);
    this.buildHammer(0.05);
  }

  // ------------------------------------------------------------ arms + cut-paper hands
  buildArms() {
    const v = this.v, prof = this.view === "profile", tq = this.view === "threeQuarter";
    for (const s of [1, -1] as const) {
      const far = (prof || tq) && s < 0;
      const tint = this.tinted(far);
      const sh = new THREE.Group();
      let x = 0, z = 0.03;
      if (prof) { x = s > 0 ? 0.0 : 0.02; z = s > 0 ? 0.045 : -0.06; }
      else if (tq) { x = this.mapX(s * v.armX)[0] + (s > 0 ? -0.01 : 0.02); z = s > 0 ? 0.045 : -0.06; }
      else { const [mx, mz] = this.mapX(s * (v.armX - 0.012)); x = mx; z = mz + 0.03; }
      sh.position.set(x, v.armY - v.hipY, z); this.torso.add(sh);
      const up = smooth([[-0.06, 0.035], [0.06, 0.035], [0.06, -0.03], [0.05, -v.armU - 0.02], [-0.048, -v.armU - 0.02], [-0.058, -0.03]], 3);
      this.card(sh, up, ST.amber, { seed: 401 + s, tint, print: (p, pts) => { wash(p, pts, [-0.07, 0], [0.07, 0], [[0, "rgba(120,48,0,0.2)"], [0.35, "rgba(0,0,0,0)"], [1, "rgba(120,48,0,0.12)"]]); } }, 0, 0, 0);
      this.card(sh, smooth([[-0.058, -0.012], [0.058, -0.012], [0.06, 0.016], [0.034, 0.042], [-0.034, 0.042], [-0.06, 0.016]], 3), ST.navy, { seed: 403 + s, tint, thick: 0.006, print: navyPrint }, 0, 0, 0.007);
      this.pin(sh, 0, 0.006, 0.013, 0.012);
      const el = new THREE.Group(); el.position.set(0, -v.armU, 0.016); sh.add(el);
      const fa = smooth([[-0.05, 0.03], [0.05, 0.03], [0.048, -v.armF * 0.5], [0.044, -v.armF - 0.01], [-0.042, -v.armF - 0.01], [-0.048, -v.armF * 0.5]], 3);
      this.card(el, fa, ST.amber, { seed: 405 + s, tint, print: (p, pts) => wash(p, pts, [-0.06, 0], [0.06, 0], [[0, "rgba(120,48,0,0.2)"], [0.35, "rgba(0,0,0,0)"], [1, "rgba(120,48,0,0.12)"]]) }, 0, 0, 0);
      this.card(el, rectPts(-0.048, -v.armF * 0.52, 0.048, -v.armF * 0.52 + 0.036, 0.003), ST.tape, { seed: 407 + s, tint, thick: 0.004, rough: 0.55, print: (p, pts, b) => tapePrint(p, pts, b) }, 0, 0, 0.006);
      this.card(el, rectPts(-0.047, -v.armF - 0.016, 0.047, -v.armF + 0.022, 0.008), ST.navy, { seed: 409 + s, tint, thick: 0.007, print: navyPrint }, 0, 0, 0.007);
      this.pin(el, 0, 0, 0.0075, 0.011);
      const wr = new THREE.Group(); wr.position.set(0, -v.armF, 0.004); el.add(wr);
      const din = prof || tq ? -1 : -s; // the side the thumb / palm faces
      this.hands[s] = this.buildHand(wr, din, s, tint);
      this.j["sh" + s] = sh; this.j["el" + s] = el; this.j["wr" + s] = wr;
    }
  }
  buildHand(wr: THREE.Group, din: number, s: number, tint?: THREE.Color): HandRig {
    const handPrint = (p: Painter, pts: Pt[]) => { skinPrint(p, pts); };
    const D = (pts: Pt[]) => pts.map(([x, y]) => [x * -din, y] as Pt); // drawn with the thumb at +x, flipped so it faces din
    this.card(wr, D(smooth([[-0.03, 0.012], [0.03, 0.012], [0.035, -0.035], [0.031, -0.074], [-0.03, -0.078], [-0.035, -0.035]], 3)), ST.skin, { seed: 421 + s, thick: 0.007, print: handPrint, tint }, 0, 0, -0.004);
    const fingers = new THREE.Group(); fingers.position.set(0, -0.07, 0.004); wr.add(fingers);
    // grouped fingers: one card, cut slits between the fingers (index on the thumb side)
    const tips: [number, number][] = [[0.022, 0.07], [0.007, 0.081], [-0.008, 0.077], [-0.022, 0.064]];
    const fp: Pt[] = [[0.031, 0.006]];
    tips.forEach(([x, l], i) => {
      fp.push([x + 0.0075, -l + 0.012], [x + 0.004, -l + 0.001], [x, -l], [x - 0.004, -l + 0.001], [x - 0.0075, -l + 0.012]);
      if (i < 3) fp.push([x - 0.0078, -Math.min(l, tips[i + 1][1]) + 0.03]);
    });
    fp.push([-0.031, 0.006]);
    const straight = this.card(fingers, D(fp), ST.skin, { seed: 423 + s, thick: TF + 0.002, print: (p, pts) => { handPrint(p, pts); for (const [x] of [[0.0145], [-0.0005], [-0.015]]) p.stroke([[x * -din, -0.03], [x * -din, -0.05]], "rgba(120,60,40,0.35)", 0.0012); }, tint }, 0, 0, 0).mesh;
    const fist = this.card(fingers, D(smooth([[-0.033, 0.008], [0.033, 0.008], [0.036, -0.022], [0.026, -0.042], [-0.026, -0.042], [-0.036, -0.022]], 3)), ST.skin, { seed: 425 + s, thick: TF + 0.002, tint, print: (p, pts) => { handPrint(p, pts); for (const x of [-0.016, 0, 0.016]) p.stroke([[x, -0.012], [x, -0.03]], "rgba(120,60,40,0.4)", 0.0013); } }, 0, 0, 0).mesh;
    fist.visible = false;
    const thumb = new THREE.Group(); thumb.position.set(-din * -0.027, -0.022, 0.009); wr.add(thumb);
    this.card(thumb, D(smooth([[-0.011, 0.006], [0.011, 0.006], [0.013, -0.03], [0.006, -0.055], [-0.007, -0.054], [-0.012, -0.03]], 3)), ST.skin, { seed: 427 + s, thick: TF, print: handPrint, tint }, 0, 0, 0);
    this.pin(wr, 0, 0.0, 0.0, 0.008);
    return { fingers, straight, fist, thumb, din };
  }

  // ------------------------------------------------------------ head + face kit
  buildHead() {
    const v = this.v, prof = this.view === "profile";
    this.head.position.set(prof ? -0.012 : 0, v.chinY + 0.035 * v.hs - v.hipY, prof ? 0.004 : 0.008);
    this.torso.add(this.head);
    this.head.add(this.face);
    this.face.scale.setScalar(v.hs);
    this.face.position.y = -0.035 * v.hs;
    if (prof) this.buildHeadProfile(); else this.buildHeadFront();
  }
  /** Projection of a front-face x for the three-quarter drawing: [x, xScale]. */
  hp(x: number): [number, number] {
    if (this.view !== "threeQuarter") return [x, 1];
    const W = 0.105, Df = 0.075, a = this.tq;
    const u = Math.asin(clamp(x / W, -1, 1));
    return [W * Math.sin(u) * Math.cos(a) - Df * Math.cos(u) * Math.sin(a), Math.max(0.35, Math.cos(a) + (Df / W) * Math.tan(u) * Math.sin(a))];
  }
  /** Head-level parent for a feature on side s (V-fold: that head half). */
  hpar(s: number) { return this.view === "front" && this.fold > 0 ? this.headHalves[s] : this.face; }
  headPiece(pts: Pt[], stock: PaperStock, o: CardOpts & { holes?: Pt[][] }, z: number, holesFor?: (s: number) => Pt[][]) {
    if (this.view === "front" && this.fold > 0) {
      for (const s of [1, -1]) {
        const hp = clipHalf(pts, (p) => s * p[0]);
        if (hp.length >= 3) this.card(this.headHalves[s], hp, stock, { ...o, seed: (o.seed ?? 1) + s, holes: holesFor ? holesFor(s) : [] }, 0, 0, z);
      }
      return;
    }
    return this.card(this.face, pts, stock, { ...o, holes: holesFor ? [...holesFor(1), ...holesFor(-1)] : [] }, 0, 0, z);
  }
  eyeWin(s: number, rx = 0.027, ryU = 0.0158, ryL = 0.0118): Pt[] {
    const out: Pt[] = [], n = 14;
    for (let i = 0; i <= n; i++) { const t = -1 + (2 * i) / n; out.push([t * rx, ryU * Math.pow(1 - t * t, 0.62) + 0.0035 * t * s]); }
    for (let i = n - 1; i > 0; i--) { const t = -1 + (2 * i) / n; out.push([t * rx, -ryL * Math.pow(1 - t * t, 0.75) + 0.0035 * t * s]); }
    return out;
  }
  buildEye(parent: THREE.Object3D, cx: number, cy: number, sx: number, s: number, win: Pt[], prof = false) {
    const g = new THREE.Group(); g.position.set(cx, cy, 0); g.scale.x = sx; parent.add(g);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    win.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
    const h = y1 - y0, m = 0.012;
    this.card(g, ellipsePts(0, 0, (x1 - x0) / 2 + m, h / 2 + m, 28), ST.white, { seed: 501 + s, thick: 0.003, px: PXF, print: (p, pts) => spot(p, pts, 0, 0.012, 0.04, "rgba(0,0,0,0)", "rgba(90,70,80,0.18)", 0.6) }, 0, 0, -0.017);
    const ball = new THREE.Group(); g.add(ball);
    const ir = prof ? 0.0105 : 0.0108;
    this.card(ball, ellipsePts(0, 0, prof ? ir * 0.5 : ir, ir, 28), ST.iris, { seed: 503 + s, thick: 0.002, px: PXF, print: (p, pts) => {
      spot(p, pts, 0, 0, ir, "rgba(150,110,60,0.6)", "rgba(40,25,10,0.5)");
      if (p.look === "solid") { const gg = p.g; gg.strokeStyle = "rgba(25,15,8,0.8)"; gg.lineWidth = 0.0012; p.path(pts); gg.stroke(); }
    } }, prof ? -0.004 : 0, 0, -0.013);
    const pupil = this.card(ball, ellipsePts(0, 0, prof ? 0.0024 : 0.0048, 0.0048, 20), ST.pupil, { seed: 505 + s, thick: 0.001, px: PXF, inset: false, print: (p) => p.ellipse(-0.0016, 0.0018, 0.0016, 0.0016, "#ffffff") }, prof ? -0.006 : 0, 0, -0.0118).mesh;
    // upper lid: edge = the window's upper outline, so sliding it down reads as a real lid
    const up = win.filter((_, i) => i <= 14);
    const lidPts: Pt[] = [[x0 - 0.012, up[0][1]], ...up, [x1 + 0.012, up[up.length - 1][1]], [x1 + 0.012, 0.05], [x0 - 0.012, 0.05]];
    const lidU = new THREE.Group(); g.add(lidU);
    this.card(lidU, lidPts, ST.lid, { seed: 507 + s, thick: 0.002, px: PXF, inset: false, print: (p) => {
      p.stroke(up.map(([x, y]) => [x, y + 0.0010] as Pt), "#24150f", 0.0026);
      p.stroke(up.map(([x, y]) => [x * 0.9, y + 0.0075] as Pt), "rgba(90,45,30,0.55)", 0.0012);
    } }, 0, 0, -0.0065);
    const lo = win.filter((_, i) => i >= 14).concat([win[0]]);
    const lowPts: Pt[] = [[x1 + 0.012, lo[0][1]], ...lo, [x0 - 0.012, lo[lo.length - 1][1]], [x0 - 0.012, -0.05], [x1 + 0.012, -0.05]];
    const lidL = new THREE.Group(); g.add(lidL);
    this.card(lidL, lowPts, ST.skin, { seed: 509 + s, thick: 0.002, px: PXF, inset: false, print: (p) => p.stroke(lo.map(([x, y]) => [x * 0.85, y - 0.001] as Pt), "rgba(110,55,40,0.5)", 0.0014) }, 0, 0, -0.009);
    this.eyes.push({ g, ball, pupil, lidU, lidL, h: h, sx });
  }
  buildHeadFront() {
    const tq = this.view === "threeQuarter", vf = this.fold > 0;
    if (vf) for (const s of [1, -1]) { const h = new THREE.Group(); h.rotation.y = s * this.fold; this.face.add(h); this.headHalves[s] = h; }
    const headHalf: Pt[] = [[0, 0], [0.036, 0.003], [0.07, 0.02], [0.093, 0.052], [0.101, 0.096], [0.105, 0.14], [0.104, 0.19], [0.097, 0.235], [0.076, 0.268], [0.04, 0.283], [0, 0.288]];
    let outline = smooth(mirrorHalf(headHalf), 3);
    if (tq) outline = outline.map(([x, y]) => [x * 0.97 + (x > 0 ? 0.006 : 0), y] as Pt);
    const E = (s: number) => { const [x, sx] = this.hp(s * 0.044); return { x, sx }; };
    const winAt = (s: number) => { const e = E(s); return transform(this.eyeWin(s), e.sx, 1, e.x, 0.148); };
    // back hair, ears, neck behind the head card
    this.headPiece(rectPts(-0.114, 0.165, 0.114, 0.24, 0.02), ST.hair, { seed: 521, thick: TF, px: PXF }, -0.012);
    this.headPiece(rectPts(-0.112, 0.168, 0.112, 0.2, 0.012), ST.grey, { seed: 522, thick: 0.002, px: PXF }, -0.008);
    for (const s of [1, -1]) {
      if (tq && s < 0) continue;
      const ex = tq ? 0.072 : s * 0.103;
      this.card(this.hpar(s), ellipsePts(ex, 0.142, tq ? 0.016 : 0.019, 0.031, 24), ST.skin, { seed: 523 + s, thick: TF, px: PXF, print: (p) => p.ellipse(ex + s * 0.002, 0.14, 0.008, 0.017, "#b07a5c") }, 0, 0, -0.005);
    }
    this.card(this.face, rectPts(-0.054, -0.07, 0.054, 0.03, 0.012), ST.skin, { seed: 525, thick: 0.006, print: (p, pts) => wash(p, pts, [0, 0.03], [0, -0.03], [[0, "rgba(80,30,20,0.35)"], [1, "rgba(0,0,0,0)"]]) }, 0, 0, -0.02);
    // head card with die-cut eye windows
    this.headPiece(jitter(outline, 0.0012, 5), ST.skin, { seed: 527, thick: 0.006, px: PXF, print: (p, pts) => {
      skinPrint(p, pts);
      spot(p, pts, 0, 0.03, 0.09, "rgba(90,85,95,0.22)", "rgba(90,85,95,0)", 0.7);            // stubble shadow
            for (const s of [1, -1]) {
        const e = E(s);
        spot(p, pts, e.x + s * 0.03 * e.sx, 0.1, 0.03, "rgba(200,90,70,0.16)", "rgba(200,90,70,0)");   // cheek warmth
        spot(p, pts, e.x, 0.17, 0.032, "rgba(90,40,30,0.22)", "rgba(90,40,30,0)", 0.5);                // brow shade
        p.stroke([[e.x + s * 0.03 * e.sx, 0.154], [e.x + s * 0.038 * e.sx, 0.158]], "rgba(110,55,40,0.35)", 0.0011); // crow's feet
        p.stroke([[e.x + s * 0.03 * e.sx, 0.146], [e.x + s * 0.038 * e.sx, 0.144]], "rgba(110,55,40,0.35)", 0.0011);
      }
      p.stroke([[-0.04, 0.214], [0.04, 0.214]].map(([x, y]) => [this.hp(x)[0], y] as Pt), "rgba(110,55,40,0.3)", 0.0012);
    } }, 0, (s) => [winAt(s)]);
    for (const s of [1, -1]) {
      const e = E(s), par = this.hpar(s);
      this.buildEye(par, e.x, 0.148, e.sx, s, this.eyeWin(s));
      // sideburns (greying)
      if (!(tq && s < 0)) {
        const sbx = tq && s > 0 ? 0.068 : s * 0.094;
        this.card(par, rectPts(sbx - 0.009, 0.158, sbx + 0.009, 0.232, 0.006), ST.hair, { seed: 531 + s, thick: 0.002, px: PXF }, 0, 0, 0.002);
        this.card(par, rectPts(sbx - 0.0075, 0.16, sbx + 0.0075, 0.19, 0.005), ST.grey, { seed: 533 + s, thick: 0.0015, px: PXF }, 0, 0, 0.0036);
      }
      // brows: thick inner end, pivot at centre
      const bg = new THREE.Group(); const [bx, bsx] = this.hp(s * 0.047);
      bg.position.set(bx, 0.188, 0.004); bg.scale.x = bsx; par.add(bg);
      const bp: Pt[] = smooth([[-s * 0.028, -0.006], [-s * 0.026, 0.006], [0, 0.0085], [s * 0.028, 0.004], [s * 0.029, -0.002], [0, -0.0025]], 3);
      this.card(bg, bp, ST.stache, { seed: 535 + s, thick: TF, px: PXF, print: (p, pts) => wash(p, pts, [0, 0.01], [0, -0.006], [[0, "rgba(255,255,255,0.08)"], [1, "rgba(0,0,0,0.2)"]]) }, 0, 0, 0);
      this.brows.push({ g: bg, s, y0: 0.188 });
    }
    // nose: V-fold = a folded tent; front = bridge + tip; three-quarter = side wedge
    const nosePrint = (p: Painter, pts: Pt[]) => { skinPrint(p, pts); p.ellipse(-0.011, 0.093, 0.0055, 0.0035, "#5a2a22"); p.ellipse(0.011, 0.093, 0.0055, 0.0035, "#5a2a22"); p.ellipse(-0.006, 0.112, 0.006, 0.004, "rgba(255,235,220,0.5)"); };
    const tip: Pt[] = smooth([[-0.027, 0.098], [-0.02, 0.087], [0, 0.084], [0.02, 0.087], [0.027, 0.098], [0.016, 0.115], [0.01, 0.17], [-0.01, 0.17], [-0.016, 0.115]], 3);
    if (tq) {
      const [nx] = this.hp(0);
      this.card(this.face, smooth([[0.012, 0.185], [0.008, 0.12], [0.014, 0.097], [0.006, 0.086], [-0.014, 0.084], [-0.03, 0.092], [-0.033, 0.103], [-0.012, 0.17]], 3), ST.skin, {
        seed: 541, thick: TF, px: PXF, print: (p, pts) => { skinPrint(p, pts); p.ellipse(-0.012, 0.092, 0.006, 0.0035, "#5a2a22"); } }, nx, 0, 0.005);
    } else if (vf) {
      for (const s of [1, -1]) {
        const hp = clipHalf(tip, (p) => s * p[0]);
        const ng = new THREE.Group(); ng.rotation.y = s * 0.85; ng.position.z = 0.003; this.face.add(ng);
        this.card(ng, hp, ST.skin, { seed: 543 + s, thick: TF, px: PXF, print: nosePrint }, 0, 0, 0);
      }
    } else this.card(this.face, tip, ST.skin, { seed: 545, thick: TF, px: PXF, print: nosePrint }, 0, 0, 0.006);
    // mouths (swapped cut-outs, under the moustache)
    const [mx, msx] = this.hp(0);
    const mg = new THREE.Group(); mg.position.set(mx, 0, tq ? 0.004 : 0.005); mg.scale.x = Math.max(0.82, msx); this.face.add(mg);
    for (const id of MOUTHS) this.mouths[id] = this.mouthCard(mg, id);
    // moustache: trimmed chevron, salt and pepper, two wings (V-fold: one per half)
    const st: Pt[] = smooth([[-0.062, 0.05], [-0.058, 0.066], [-0.036, 0.086], [-0.014, 0.092], [0, 0.087], [0.014, 0.092], [0.036, 0.086], [0.058, 0.066], [0.062, 0.05],
      [0.05, 0.057], [0.038, 0.06], [0.026, 0.058], [0.013, 0.062], [0, 0.06], [-0.013, 0.062], [-0.026, 0.058], [-0.038, 0.06], [-0.05, 0.057]], 2);
    this.stache.position.z = 0.009;
    if (vf) for (const s of [1, -1]) { const h = new THREE.Group(); this.headHalves[s].add(h); h.userData.stache = true; }
    const stPrint = (p: Painter, pts: Pt[]) => { wash(p, pts, [0, 0.09], [0, 0.058], [[0, "rgba(255,255,255,0.08)"], [1, "rgba(0,0,0,0.25)"]]); for (let x = -0.05; x <= 0.051; x += 0.0125) p.stroke([[x, 0.06], [x * 0.9, 0.08]], "rgba(150,140,130,0.45)", 0.0014); };
    if (tq) {
      for (const s of [1, -1]) {
        const hpp = clipHalf(st, (p) => s * p[0]);
        const sg = new THREE.Group(); sg.position.x = mx; sg.scale.x = s > 0 ? 0.98 : 0.5; this.stache.add(sg);
        this.card(sg, hpp, ST.stache, { seed: 551 + s, thick: TF, px: PXF, print: stPrint }, 0, 0, 0);
      }
      this.face.add(this.stache);
    } else if (vf) {
      for (const s of [1, -1]) {
        const hpp = clipHalf(st, (p) => s * p[0]);
        const sg = new THREE.Group(); sg.position.z = 0.009; this.headHalves[s].add(sg);
        this.card(sg, hpp, ST.stache, { seed: 551 + s, thick: TF, px: PXF, print: stPrint }, 0, 0, 0);
        sg.userData.stacheHalf = true; this.stache.add(new THREE.Object3D());
        (this.stache.userData.halves ??= []).push(sg);
      }
    } else { this.card(this.stache, st, ST.stache, { seed: 551, thick: TF, px: PXF, print: stPrint }, 0, 0, 0); this.face.add(this.stache); }
    // smile creases (shown with cheek raise)
    for (const s of [1, -1]) {
      const [cx, csx] = this.hp(s * 0.044);
      const cr = smooth([[s * 0.0, 0.03], [s * 0.004, 0.012], [s * 0.012, -0.012], [s * 0.008, -0.012], [s * -0.001, 0.012], [s * -0.004, 0.03]], 2);
      const c = this.card(this.hpar(s), transform(cr, csx, 1, cx - s * 0.006 * csx, 0.072), ST.lid, { seed: 561 + s, thick: 0.002, px: PXF, inset: false }, 0, 0, 0.0025).mesh;
      c.visible = false; this.smileLines.push(c);
    }
    this.buildHelmet(false);
  }
  mouthCard(parent: THREE.Object3D, id: MouthId, prof = false) {
    const g = new THREE.Group(); parent.add(g);
    const lip = "#9a5348", dark = "#3d1a19";
    const lipPrint = (pts: Pt[], line: Pt[]) => (p: Painter) => { p.shape(pts, lip); p.stroke(line, "#3a1814", 0.0024); };
    const openPrint = (top: number, bot: number, tongue: boolean) => (p: Painter, pts: Pt[], b: Bnd) => {
      p.shape(pts, dark);
      if (tongue) p.ellipse((b.x0 + b.x1) / 2, b.y0 + b.h * 0.18, b.w * 0.3, b.h * 0.2, "#b8504f");
      if (top) p.rect(b.x0, b.y1 - top, b.w, top, "#f2ece0");
      if (bot) p.rect(b.x0, b.y0, b.w, bot, "#ebe3d4");
      if (top && bot && p.look === "solid") for (let x = b.x0 + b.w / 6; x < b.x1; x += b.w / 6) p.stroke([[x, b.y0], [x, b.y1]], "rgba(120,100,90,0.5)", 0.0008);
    };
    let pts: Pt[]; let print: CardOpts["print"]; let st = ST.mouth;
    const P = (q: Pt[]) => (prof ? q.map(([x, y]) => [x * 0.45 - 0.004, y] as Pt) : q);
    switch (id) {
      case "neutral": pts = smooth([[-0.03, 0.052], [-0.012, 0.0545], [0, 0.0535], [0.012, 0.0545], [0.03, 0.052], [0.012, 0.0465], [0, 0.0455], [-0.012, 0.0465]], 2); print = lipPrint(pts, [[-0.029, 0.0515], [0, 0.0505], [0.029, 0.0515]]); st = { base: lip, mottle: 0.02, core: "#fbeee4" }; break;
      case "firm": pts = rectPts(-0.031, 0.0475, 0.031, 0.0535, 0.003); print = lipPrint(pts, [[-0.03, 0.0505], [0.03, 0.0505]]); st = { base: lip, mottle: 0.02, core: "#fbeee4" }; break;
      case "pursed": pts = ellipsePts(0.006, 0.049, 0.0095, 0.0085, 20); print = (p, q) => { p.shape(q, lip); p.ellipse(0.006, 0.049, 0.0048, 0.0042, dark); }; st = { base: lip, mottle: 0.02, core: "#fbeee4" }; break;
      case "open": pts = smooth([[-0.022, 0.052], [0, 0.057], [0.022, 0.052], [0.018, 0.032], [0, 0.024], [-0.018, 0.032]], 3); print = openPrint(0.007, 0, true); break;
      case "scream": pts = smooth([[-0.036, 0.056], [0, 0.058], [0.036, 0.056], [0.034, 0.03], [0, 0.02], [-0.034, 0.03]], 3); print = openPrint(0.008, 0.006, true); break;
      case "clench": pts = smooth([[-0.035, 0.05], [-0.02, 0.056], [0, 0.0565], [0.02, 0.056], [0.035, 0.05], [0.03, 0.037], [0, 0.0355], [-0.03, 0.037]], 2); print = openPrint(0.0105, 0.0095, false); break;
      case "exhale": pts = ellipsePts(0, 0.044, 0.011, 0.012, 20); print = (p, q) => { p.shape(q, lip); p.ellipse(0, 0.044, 0.0062, 0.0072, dark); }; st = { base: lip, mottle: 0.02, core: "#fbeee4" }; break;
      case "smile": pts = smooth([[-0.034, 0.058], [0, 0.048], [0.034, 0.058], [0.031, 0.053], [0, 0.041], [-0.031, 0.053]], 3); print = lipPrint(pts, [[-0.032, 0.0555], [0, 0.0455], [0.032, 0.0555]]); st = { base: lip, mottle: 0.02, core: "#fbeee4" }; break;
      case "grin": pts = smooth([[-0.035, 0.056], [0, 0.054], [0.035, 0.056], [0.024, 0.036], [0, 0.03], [-0.024, 0.036]], 3); print = openPrint(0.0095, 0, true); break;
    }
    this.card(g, P(pts!), st, { seed: 571 + MOUTHS.indexOf(id), thick: 0.003, px: PXF, inset: false, print: prof ? undefined : print }, 0, 0, 0);
    g.visible = id === "neutral";
    return g;
  }
  buildHelmet(prof: boolean) {
    const f = this.face, vf = this.fold > 0;
    const helmetPrint = (p: Painter, pts: Pt[], b: Bnd) => {
      wash(p, pts, [b.x0, 0], [b.x1, 0], [[0, "rgba(255,255,255,0.15)"], [0.5, "rgba(0,0,0,0)"], [1, "rgba(90,85,80,0.22)"]]);
      wash(p, pts, [0, b.y1], [0, b.y0], [[0, "rgba(255,255,255,0.12)"], [1, "rgba(80,75,70,0.1)"]]);
      p.rect(b.x0, 0.244, b.w, 0.014, "#2b2d31");
      if (!prof) p.text("FSF", this.hp(0.085)[0], 0.3, 0.017, "#3a4a5e", { align: "center", font: "'JetBrains Mono', monospace", weight: 800 });
    };
    const piece = (pts: Pt[], st: PaperStock, o: CardOpts, z: number) => {
      if (vf) { this.headPiece(pts, st, o, z); return; }
      this.card(f, pts, st, o, 0, 0, z);
    };
    const tq = this.view === "threeQuarter";
    const lx = prof ? -0.14 : this.hp(0)[0] * 1.15;
    if (prof) {
      piece(smooth([[-0.138, 0.236], [-0.132, 0.3], [-0.1, 0.35], [-0.04, 0.376], [0.03, 0.378], [0.09, 0.36], [0.126, 0.32], [0.142, 0.25], [0.142, 0.236]], 3), ST.helmet, { seed: 581, thick: 0.008, px: 2400, print: helmetPrint }, 0.012);
      piece(smooth([[-0.18, 0.226], [-0.12, 0.222], [0.158, 0.222], [0.158, 0.24], [-0.12, 0.246], [-0.178, 0.238]], 2), ST.helmet, { seed: 583, thick: 0.008, px: 2400, print: (p, pts, b) => wash(p, pts, [0, b.y1], [0, b.y0], [[0, "rgba(255,255,255,0.1)"], [1, "rgba(80,75,70,0.2)"]]) }, 0.02);
      this.card(f, rectPts(-0.16, 0.268, -0.128, 0.306, 0.007), ST.black, { seed: 585, thick: 0.012, px: 2400 }, 0, 0, 0.026);
      const lens = this.card(f, rectPts(-0.167, 0.274, -0.157, 0.3, 0.003), ST.lens, { seed: 587, thick: 0.006, inset: false, emissive: new THREE.Color(2.4, 2.05, 1.5) }, 0, 0, 0.032);
      void lens;
      this.lamp.position.set(-0.17, 0.287, 0.03); this.lamp.rotation.y = -Math.PI / 2;
    } else {
      const dome = smooth([[-0.14, 0.236], [-0.137, 0.29], [-0.114, 0.342], [-0.064, 0.371], [0, 0.378], [0.064, 0.371], [0.114, 0.342], [0.137, 0.29], [0.14, 0.236]], 3);
      piece(tq ? dome.map(([x, y]) => [x * 0.97 + 0.004, y] as Pt) : dome, ST.helmet, { seed: 581, thick: 0.008, px: 2400, print: helmetPrint }, 0.012);
      const rx = this.hp(0)[0] * 0.8;
      piece(rectPts(rx - 0.011, 0.29, rx + 0.011, 0.37, 0.007), ST.helmet, { seed: 589, thick: 0.004, px: 2400, print: (p, pts) => wash(p, pts, [rx - 0.011, 0], [rx + 0.011, 0], [[0, "rgba(255,255,255,0.2)"], [1, "rgba(80,75,70,0.2)"]]) }, 0.016);
      piece(tq ? smooth([[-0.17, 0.226], [0, 0.222], [0.15, 0.226], [0.15, 0.244], [0, 0.247], [-0.17, 0.24]], 2) : rectPts(-0.154, 0.222, 0.154, 0.246, 0.011), ST.helmet, { seed: 583, thick: 0.008, px: 2400, print: (p, pts, b) => wash(p, pts, [0, b.y1], [0, b.y0], [[0, "rgba(255,255,255,0.1)"], [1, "rgba(80,75,70,0.2)"]]) }, 0.02);
      const hx = tq ? lx : 0, sx = tq ? 0.72 : 1;
      this.card(f, transform(ellipsePts(0, 0, 0.031, 0.026, 28), sx, 1, hx, 0.287), ST.black, { seed: 585, thick: 0.012, px: 2400 }, 0, 0, vf ? 0.03 : 0.026);
      this.card(f, transform(ellipsePts(0, 0, 0.021, 0.017, 28), sx, 1, hx, 0.287), ST.lens, { seed: 587, thick: 0.006, inset: false, emissive: new THREE.Color(2.4, 2.05, 1.5), print: (p) => p.ellipse(hx - 0.006, 0.292, 0.007, 0.005, "#ffffff") }, 0, 0, vf ? 0.036 : 0.032);
      this.lamp.position.set(hx, 0.287, 0.04); this.lamp.rotation.y = tq ? -this.tq * 0.8 : 0;
    }
    f.add(this.lamp);
  }
  buildHeadProfile() {
    const f = this.face;
    const outline = jitter(smooth([[-0.07, 0], [-0.088, 0.012], [-0.092, 0.035], [-0.088, 0.05], [-0.094, 0.062], [-0.098, 0.078], [-0.1, 0.092], [-0.104, 0.13], [-0.106, 0.175], [-0.1, 0.21],
      [-0.08, 0.255], [-0.04, 0.282], [0, 0.29], [0.05, 0.282], [0.095, 0.25], [0.115, 0.2], [0.118, 0.15], [0.105, 0.1], [0.08, 0.07], [0.06, 0.04], [0.03, 0.03], [-0.02, 0.01]], 3), 0.001, 21);
    const win = transform(this.eyeWin(-1, 0.0125, 0.0125, 0.0095), 1, 1, 0, 0).map(([x, y]) => [x - (y > 0 ? 0 : 0) , y] as Pt);
    const winP: Pt[] = win.map(([x, y]) => [x * (x < 0 ? 1 : 0.85), y] as Pt);
    this.card(f, smooth([[-0.005, 0.16], [0.07, 0.12], [0.122, 0.17], [0.128, 0.24], [-0.005, 0.24]], 2), ST.hair, { seed: 601, thick: TF, px: PXF }, 0, 0, 0.001);
    this.card(f, rectPts(-0.004, 0.172, 0.032, 0.2, 0.008), ST.grey, { seed: 602, thick: 0.0015, px: PXF }, 0, 0, 0.0026);
    this.card(f, rectPts(-0.05, -0.07, 0.044, 0.035, 0.01), ST.skin, { seed: 603, thick: 0.006, print: (p, pts) => wash(p, pts, [0, 0.03], [0, -0.03], [[0, "rgba(80,30,20,0.35)"], [1, "rgba(0,0,0,0)"]]) }, 0.02, 0, -0.02);
    this.card(f, outline, ST.skin, { seed: 605, thick: 0.006, px: PXF, holes: [transform(winP, 1, 1, -0.07, 0.148)], print: (p, pts) => {
      wash(p, pts, [-0.11, 0], [0.12, 0], [[0, "rgba(0,0,0,0)"], [0.6, "rgba(0,0,0,0)"], [1, "rgba(110,45,30,0.16)"]]);
      spot(p, pts, -0.05, 0.03, 0.07, "rgba(90,85,95,0.22)", "rgba(90,85,95,0)", 0.7);
      spot(p, pts, -0.06, 0.1, 0.03, "rgba(200,90,70,0.16)", "rgba(200,90,70,0)");
      p.stroke([[-0.05, 0.154], [-0.042, 0.158]], "rgba(110,55,40,0.35)", 0.0011);
    } }, 0, 0, 0);
    this.card(f, ellipsePts(0.025, 0.142, 0.019, 0.031, 24), ST.skin, { seed: 607, thick: TF, px: PXF, print: (p) => { p.ellipse(0.027, 0.14, 0.009, 0.018, "#b07a5c"); } }, 0, 0, 0.003);
    this.card(f, rectPts(-0.012, 0.158, 0.008, 0.232, 0.006), ST.hair, { seed: 609, thick: 0.002, px: PXF }, 0, 0, 0.003);
    this.buildEye(f, -0.07, 0.148, 1, -1, winP, true);
    const bg = new THREE.Group(); bg.position.set(-0.075, 0.188, 0.004); f.add(bg);
    this.card(bg, smooth([[-0.022, -0.004], [-0.02, 0.007], [0.0, 0.0085], [0.02, 0.004], [0.02, -0.002], [0, -0.003]], 3), ST.stache, { seed: 611, thick: TF, px: PXF }, 0, 0, 0);
    this.brows.push({ g: bg, s: -1, y0: 0.188 });
    this.card(f, smooth([[-0.101, 0.18], [-0.113, 0.13], [-0.136, 0.101], [-0.133, 0.088], [-0.112, 0.084], [-0.098, 0.086]], 3), ST.skin, { seed: 613, thick: TF, px: PXF, print: (p, pts) => { skinPrint(p, pts); p.ellipse(-0.114, 0.091, 0.006, 0.0035, "#5a2a22"); } }, 0, 0, 0.005);
    const mg = new THREE.Group(); mg.position.set(-0.088, 0, 0.004); f.add(mg);
    // profile mouths: four cut-outs cover the nine expressions
    const PM: Record<string, Pt[]> = {
      closed: rectPts(-0.012, 0.049, 0.004, 0.053, 0.0015),
      o: ellipsePts(-0.006, 0.047, 0.006, 0.007, 16),
      open: smooth([[-0.012, 0.055], [0.006, 0.052], [0.004, 0.034], [-0.012, 0.028]], 2),
      wide: smooth([[-0.013, 0.057], [0.01, 0.053], [0.008, 0.03], [-0.013, 0.022]], 2),
      smile: smooth([[-0.012, 0.05], [0.006, 0.055], [0.006, 0.051], [-0.012, 0.046]], 2),
    };
    const pm: Record<string, THREE.Group> = {};
    for (const [k, pts] of Object.entries(PM)) {
      const g = new THREE.Group(); mg.add(g); g.visible = false; pm[k] = g;
      this.card(g, pts, k === "closed" || k === "smile" ? { base: "#7a3a33", mottle: 0.02, core: "#fbeee4" } : ST.mouth, { seed: 621, thick: 0.003, px: PXF, inset: false, print: (p, q, b) => {
        if (k === "open" || k === "wide") p.rect(b.x0, b.y1 - 0.007, b.w, 0.007, "#f2ece0");
        if (k === "wide") p.rect(b.x0, b.y0, b.w, 0.006, "#ebe3d4");
      } }, 0, 0, 0);
    }
    const map: Record<MouthId, string> = { neutral: "closed", firm: "closed", pursed: "o", exhale: "o", open: "open", grin: "open", scream: "wide", clench: "wide", smile: "smile" };
    for (const id of MOUTHS) this.mouths[id] = pm[map[id]];
    this.stache.position.z = 0.009; f.add(this.stache);
    this.card(this.stache, smooth([[-0.1, 0.087], [-0.08, 0.088], [-0.05, 0.08], [-0.038, 0.064], [-0.055, 0.061], [-0.075, 0.06], [-0.098, 0.066]], 3), ST.stache, { seed: 631, thick: TF, px: PXF }, 0, 0, 0);
    this.buildHelmet(true);
  }
}

let _ao: THREE.Material | null = null;
function aoMat() {
  if (_ao) return _ao;
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d")!; const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, "rgba(0,0,0,0.55)"); gr.addColorStop(0.55, "rgba(0,0,0,0.3)"); gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  _ao = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, color: new THREE.Color(0.05, 0.06, 0.1) });
  return _ao;
}
export { BRAND };
