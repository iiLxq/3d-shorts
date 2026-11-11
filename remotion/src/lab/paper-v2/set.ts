// v2 case-file diorama. A 1:20 paper model of an elevator shaft section that lives, collapsed flat, inside a manila
// case file lying on a navy cutting mat. Opening the cover pops it up (hinged walls, parallel-fold car), and every
// role has its own stock: cotton rag board walls, kraft structure, foil board steel, coated card prints,
// cyanotype (BLUEPRINT) and tracing vellum (X-RAY). Units: depicted metres; card thickness at model scale.
import * as THREE from "three";
import { Card, CardOpts, roundRect, shapeFromPts, handCut, setLookAll, cardBox } from "./card";
import { Look, Painter, Pt, BRAND, PRUSSIAN, canvas, tex, untone, rng } from "./paint";
import { Puppet, Pose, Expr } from "./puppet";
import { ropeState, RopeSpec, Collider } from "./rope";

export const BASE = -5.5;                 // case-file page (pit floor) height
export const TOPY = 5.6;                  // die-cut top edge of the model
export const SH = { x: 1.3, zb: -1.15, zf: 1.25 };
export const LANDINGS = [-2.2, 1.1, 4.4];
export const BREAK_Y = 2.62;
export const CAR = { w: 2.0, d: 1.7, h: 2.5 };
export const GUS = { x: -0.44, z: 0.3 };
const ROPE_X = [-0.11, -0.037, 0.037, 0.11];
const ROPE_Z = -0.02;
const HITCH_Y = 0.98;
const FOLDER = { x0: -2.5, x1: 2.5, z0: -1.75, z1: SH.zb + (TOPY - BASE) + 0.5 };
/** gear: car-local, right stile. Rail blade tip at x = RAIL_TIP, blade half thickness BT. */
export const RAIL_TIP = 1.075, BT = 0.016;
export const GEAR = { x: 1.1, y: 0.06, z: 0 };

export interface Cam { pos: THREE.Vector3; target: THREE.Vector3; fov: number; blur: number; focus: THREE.Vector3; roll?: number }
export interface Frame {
  look: Look; cam: Cam;
  pose: Pose; expr: Expr; yaw: number;
  carY: number; snap: number; clamp: number; clampT: number; glow: number;
  alarm: number; arrows: number; tags: number;
  cover: number; wall: number; side: number; pop: number;   // case-file pop-up 0..1
  callouts: number;                                         // blueprint callout print 0..1
  opening: number;                                          // desk-lamp phase 0..1
  gearLamp: number;                                         // insert practical 0..1
}

// ------------------------------------------------------------------------------------------------ prints
const MONO = "'JetBrains Mono', monospace";
function ragWallPrint(callouts: boolean) {
  return (p: Painter, _pts: Pt[], b: { x0: number; y0: number; x1: number; y1: number; w: number; h: number }) => {
    // printed formwork panels: very low frequency value shifts + tie dots, a few tide marks
    const r = rng(311);
    for (let y = Math.floor(b.y0 / 1.1) * 1.1; y < b.y1; y += 1.1) for (let x = Math.floor(b.x0 / 1.2) * 1.2; x < b.x1; x += 1.2) {
      if (p.bp) continue;
      const v = r();
      p.rect(x + 0.01, y + 0.01, 1.18, 1.08, v < 0.5 ? "rgba(20,28,45,0.08)" : "rgba(255,250,235,0.05)");
    }
    if (p.bp) {
      const g = p.g; g.save(); g.globalAlpha = 0.35;
      for (let x = Math.floor(b.x0 / 0.5) * 0.5; x <= b.x1; x += 0.5) p.stroke([[x, b.y0], [x, b.y1]], "", 0.004);
      for (let y = Math.floor(b.y0 / 0.5) * 0.5; y <= b.y1; y += 0.5) p.stroke([[b.x0, y], [b.x1, y]], "", 0.004);
      g.restore();
      if (callouts) blueprintCallouts(p);
    }
  };
}
function ragWallRelief(h: Painter, _pts: Pt[], b: { x0: number; y0: number; x1: number; y1: number }) {
  // embossed formwork seams (pressed into the board) + tie-hole dimples: big, soft, compression-friendly
  const g = h.g;
  for (let y = Math.floor(b.y0 / 1.1) * 1.1; y < b.y1; y += 1.1) h.stroke([[b.x0, y], [b.x1, y]], "#5a5a5a", 0.03);
  for (let x = Math.floor(b.x0 / 1.2) * 1.2; x < b.x1; x += 1.2) h.stroke([[x, b.y0], [x, b.y1]], "#5a5a5a", 0.03);
  g.save(); g.globalAlpha = 0.9;
  for (let y = Math.floor(b.y0 / 1.1) * 1.1 + 0.27; y < b.y1; y += 0.55) for (let x = Math.floor(b.x0 / 1.2) * 1.2 + 0.3; x < b.x1; x += 0.6) h.ellipse(x, y, 0.028, 0.028, "#4c4c4c");
  g.restore();
}
/** BLUEPRINT callouts printed on the cyanotype back wall (positions solved for the hero camera, see timeline) */
export const CALLOUTS: { text: string; at: [number, number]; to: [number, number]; size: number }[] = [];
function blueprintCallouts(p: Painter) {
  for (const c of CALLOUTS) {
    p.stroke([c.at, c.to], "", 0.012);
    p.g.beginPath(); p.g.arc(c.to[0], c.to[1], 0.035, 0, Math.PI * 2); p.g.strokeStyle = BRAND.cyan; p.g.lineWidth = 0.012; p.g.stroke();
    const left = c.at[0] < c.to[0];
    p.text(c.text, c.at[0] + (left ? -0.04 : 0.04), c.at[1] - c.size * 0.35, c.size, "", { align: left ? "right" : "left", font: MONO, weight: 800 });
  }
  // dimension line: car width
  p.stroke([[-1.0, -2.75], [1.0, -2.75]], "", 0.01); p.stroke([[-1.0, -2.65], [-1.0, -2.85]], "", 0.01); p.stroke([[1.0, -2.65], [1.0, -2.85]], "", 0.01);
  p.text("2.00 m", 0, -2.68, 0.13, "", { align: "center", font: MONO });
  p.text("FIG. 1  CAR 2 · SAFETY GEAR", -1.2, 5.1, 0.17, "", { font: MONO, weight: 800 });
}
function stencil(text: string, size: number, color = "#e9e3d4") {
  return (p: Painter, _pts: Pt[], b: { x0: number; y0: number; w: number; h: number }) => {
    p.text(text, b.x0 + b.w / 2, b.y0 + b.h * 0.24, size, color, { align: "center", font: MONO, weight: 800 });
  };
}
function brushedFoil(p: Painter, _pts: Pt[], b: { x0: number; y0: number; x1: number; y1: number; w: number; h: number }) {
  // foil board: broad soft streaks only (the env map does the rest)
  if (p.bp || p.xr) return;
  const r = rng(Math.round(b.w * 1000 + b.h * 77));
  for (let i = 0; i < 6; i++) { const y = b.y0 + r() * b.h; p.rect(b.x0, y, b.w, b.h * 0.08, r() < 0.5 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"); }
}

// ------------------------------------------------------------------------------------------------ env (foil)
function envTex() {
  const c = canvas(1024, 512), g = c.getContext("2d")!;
  const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, "#1c2a46"); gr.addColorStop(0.5, "#141b29"); gr.addColorStop(1, "#0e1018");
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 512);
  const box = (x: number, y: number, w: number, h: number, col: string) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const blob = (x: number, y: number, r: number, col: string) => { const q = g.createRadialGradient(x, y, 0, x, y, r); q.addColorStop(0, col); q.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = q; g.fillRect(0, 0, 1024, 512); };
  blob(300, 200, 120, "rgba(255,186,110,0.95)"); box(250, 170, 90, 50, "rgba(255,226,180,0.9)");   // warm work-lamp softbox
  blob(760, 120, 160, "rgba(120,160,230,0.45)");                                                    // cool vent
  box(0, 300, 1024, 6, "rgba(255,210,150,0.25)");                                                   // corridor strip
  const t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ------------------------------------------------------------------------------------------------ rope texture
function cordTex(look: Look) {
  const c = canvas(64, 128), g = c.getContext("2d")!;
  const base = look === "blueprint" ? PRUSSIAN : look === "xray" ? "#cfe6ee" : "#d8cfbb";
  const line = look === "blueprint" ? "#e8f8ff" : look === "xray" ? "#2a7ea6" : "#8a7d66";
  g.fillStyle = base; g.fillRect(0, 0, 64, 128);
  g.strokeStyle = line; g.lineWidth = look === "solid" ? 9 : 5;
  for (let k = -128; k < 192; k += 32) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 64, 128); g.stroke(); }
  if (look === "solid") { g.strokeStyle = "rgba(255,252,240,0.6)"; g.lineWidth = 4; for (let k = -128; k < 192; k += 32) { g.beginPath(); g.moveTo(k + 14, 0); g.lineTo(k + 78, 128); g.stroke(); } }
  return tex(c, true, true);
}

// ------------------------------------------------------------------------------------------------ the world
export class World {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(40, 1080 / 1920, 0.04, 120);
  // pop-up hierarchy
  coverPivot = new THREE.Group();
  wallPivot = new THREE.Group();
  wallInner = new THREE.Group();
  sidePivots: THREE.Group[] = [];
  carFold = new THREE.Group();
  carHold = new THREE.Group();
  car = new THREE.Group();
  corridor = new THREE.Group();
  puppet = new Puppet();
  diorama: Card[] = [];
  // lights
  key!: THREE.SpotLight; corr!: THREE.SpotLight; vent!: THREE.SpotLight; desk!: THREE.SpotLight;
  bounce!: THREE.PointLight; hemi!: THREE.HemisphereLight; head!: THREE.SpotLight;
  alarmL!: THREE.PointLight; clampL!: THREE.PointLight; bulbMat!: THREE.MeshBasicMaterial; alarmDome!: THREE.Mesh;
  ropeMats = new Map<Look, THREE.Material>();
  ropes: { upper: THREE.Mesh; lower: THREE.Mesh; fray: THREE.Mesh[] }[] = [];
  jaws: { g: THREE.Group; face: number; green: Card }[] = [];
  greenMats: THREE.MeshStandardMaterial[] = [];
  sparks: { m: THREE.Mesh; v: THREE.Vector3; w: THREE.Vector3; side: number }[] = [];
  arrows: THREE.Object3D[] = [];
  tags: THREE.Object3D[] = [];
  leaks: THREE.Mesh[] = [];
  veils: THREE.Mesh[] = [];
  backlight!: THREE.Mesh;
  lookFns: ((l: Look) => void)[] = [];
  look: Look | null = null;
  ropeSpecs: RopeSpec[] = [];
  stampCard: Card | null = null;
  gearLamp!: THREE.SpotLight;
  ropeKey = "";

  constructor() {
    const s = this.scene;
    s.environment = envTex(); s.environmentIntensity = 0.8;
    this.buildDesk();
    // wall pivot sits on the hinge line (y = BASE, z = SH.zb); wallInner uses world coordinates when upright
    this.wallPivot.position.set(0, BASE, SH.zb); s.add(this.wallPivot);
    this.wallInner.position.set(0, -BASE, -SH.zb); this.wallPivot.add(this.wallInner);
    this.buildWall();
    this.buildSides();
    // car: parallel fold (depth collapses onto the wall plane)
    this.carFold.position.set(0, 0, SH.zb); this.wallInner.add(this.carFold);
    this.carHold.position.set(0, 0, -SH.zb); this.carFold.add(this.carHold);
    this.carHold.add(this.car);
    this.buildCar();
    this.car.add(this.puppet.root); this.puppet.root.position.set(GUS.x, 0.025, GUS.z);
    this.buildGear();
    this.buildLights();
    this.buildRopes();
    this.buildFx();
  }

  private card(parent: THREE.Object3D, shape: THREE.Shape, o: CardOpts, pos: [number, number, number], rot: [number, number, number] = [0, 0, 0]) {
    const c = new Card(shape, o);
    c.mesh.position.set(...pos); c.mesh.rotation.set(...rot);
    parent.add(c.mesh);
    return c;
  }

  // ---------------------------------------------------------------- desk: cutting mat + manila case file
  private buildDesk() {
    const s = this.scene;
    // navy self-healing cutting mat with a cyan grid: the BLUEPRINT ground of the whole channel
    const M = 30;
    const mat = this.card(s, roundRect(-M / 2, -M / 2, M, M, 0.4), {
      lock: "solid", stock: { base: BRAND.navy, mottle: 0.03, core: "#22314f", kind: "coated" }, thick: 0.06, px: 60, maxPx: 2048, seed: 9001, inset: false,
      print: (p) => {
        const g = p.g; g.save();
        for (let v = -M / 2; v <= M / 2; v += 0.5) {
          const major = Math.abs(v % 2.5) < 0.01;
          g.globalAlpha = major ? 0.55 : 0.22;
          p.stroke([[v, -M / 2], [v, M / 2]], "#35d7ff", major ? 0.035 : 0.018);
          p.stroke([[-M / 2, v], [M / 2, v]], "#35d7ff", major ? 0.035 : 0.018);
        }
        g.globalAlpha = 0.5;
        for (let v = -12.5; v <= 12.5; v += 2.5) p.text(String(Math.round(v / 2.5 + 6)), v + 0.08, -M / 2 + 0.6, 0.3, "#35d7ff", { font: MONO });
        g.restore();
      },
    }, [0, BASE - 0.06, 0], [-Math.PI / 2, 0, 0]);
    mat.mesh.castShadow = false;
    // folder back page (inside face up): pit floor print + case form
    const fw = FOLDER.x1 - FOLDER.x0, fd = FOLDER.z1 - FOLDER.z0;
    const page = this.card(s, roundRect(FOLDER.x0, -FOLDER.z1, fw, fd, 0.12), {
      lock: "solid", stock: "manilaIn", thick: 0.05, px: 120, maxPx: 2048, seed: 9002, inset: false,
      print: (p) => {
        // pit floor (under the shaft): grey board patch + painted buffer marks + case form lines further out
        p.rect(-SH.x, -SH.zf, 2 * SH.x, SH.zf - SH.zb, "#4c5260");
        p.stroke([[-SH.x, -SH.zf], [SH.x, -SH.zf]], "rgba(40,30,20,0.4)", 0.03);
        for (let i = 0; i < 9; i++) p.stroke([[-2.1, -3.2 - i * 0.55], [2.1, -3.2 - i * 0.55]], "rgba(90,70,40,0.35)", 0.012);
        p.text("FIELD NOTES", -2.1, -2.95, 0.16, "#6b5532", { font: MONO, weight: 800 });
      },
    }, [0, BASE, 0], [-Math.PI / 2, 0, 0]);
    void page;
    // pit buffers (kraft springs on foil plates)
    for (const x of [-0.5, 0.5]) {
      const bf = cardBox(0.3, 0.55, 0.3, { lock: undefined, stock: "kraft", thick: 0.02, seed: 9010 + x * 10, role: "structure",
        printFront: (p, _pts, b) => { for (let y = b.y0 + 0.06; y < b.y1; y += 0.08) p.stroke([[b.x0 + 0.03, y], [b.x1 - 0.03, y + 0.03]], "#5d4126", 0.018); } });
      bf.position.set(x, BASE, 0.0); s.add(bf);
      this.lookFns.push(() => void 0);
    }
    // cover: hinged on the left spine, lies over everything when closed
    this.coverPivot.position.set(FOLDER.x0, BASE + 0.34, 0); s.add(this.coverPivot);
    const cover = this.card(this.coverPivot, roundRect(0, -FOLDER.z1, fw, fd, 0.12), {
      lock: "solid", stock: "manila", thick: 0.05, px: 140, maxPx: 2048, seed: 9003, inset: false,
      print: (p) => {
        p.text("CONFIDENTIAL · ENGINEERING", 2.5, -9.6, 0.16, "rgba(60,45,25,0.6)", { align: "center", font: MONO });
      },
    }, [0, 0, 0], [-Math.PI / 2, 0, 0]);
    void cover;
    // typed label strip (coated card glued on, real thickness) + FAIL-SAFE FILES rubber stamp (hi-res ink layer)
    this.card(this.coverPivot, roundRect(0.5, -2.35, 3.2, 0.95, 0.03), { lock: "solid", stock: { base: "#efe8d6", mottle: 0.04, core: "#fffaf0", kind: "coated" }, thick: 0.012, px: 600, maxPx: 2048, seed: 9005, inset: false,
      print: (p) => {
        p.text("CASE No. 01", 0.72, -1.76, 0.27, "#2a2a2e", { font: MONO, weight: 700 });
        p.text("ELEVATOR · SAFETY GEAR", 0.72, -2.16, 0.2, "#2a2a2e", { font: MONO, weight: 600 });
        p.stroke([[0.65, -1.88], [3.55, -1.88]], "rgba(60,60,70,0.4)", 0.01);
      } }, [0, 0.026, 0], [-Math.PI / 2, 0, 0]);
    const stamp = new THREE.Shape(); stamp.moveTo(-2.2, -0.75); stamp.lineTo(2.2, -0.75); stamp.lineTo(2.2, 0.75); stamp.lineTo(-2.2, 0.75); stamp.closePath();
    const ink = "rgba(28,40,96,0.9)";
    const stampC = new Card(stamp, { lock: "solid", stock: { base: "#d6b77c", mottle: 0.0, core: "#d6b77c", kind: "paper" }, thick: 0.001, px: 470, maxPx: 2048, seed: 9006, inset: false,
      print: (p) => {
        const g = p.g; g.clearRect(-3, -1, 6, 2);
        g.save();
        p.stroke([[-2.05, -0.62], [2.05, -0.62], [2.05, 0.62], [-2.05, 0.62]], ink, 0.075, true);
        p.stroke([[-1.88, -0.47], [1.88, -0.47], [1.88, 0.47], [-1.88, 0.47]], ink, 0.025, true);
        p.text("FAIL-SAFE FILES", 0, -0.18, 0.52, ink, { align: "center", font: "'Inter Display', Inter, sans-serif", weight: 900, spacing: 0.015 });
        const r = rng(51); g.globalCompositeOperation = "destination-out";
        for (let i = 0; i < 260; i++) { g.globalAlpha = 0.2 + r() * 0.55; g.beginPath(); g.arc(-2.1 + r() * 4.2, -0.65 + r() * 1.3, 0.008 + r() * 0.035, 0, Math.PI * 2); g.fill(); }
        g.restore();
      } });
    stampC.setLook("solid");
    const sm = stampC.mesh; const sms = sm.material as THREE.MeshStandardMaterial[];
    sms[0].transparent = true; sms[0].depthWrite = false; sms[0].bumpMap = null; sms[0].roughness = 0.75; sms[1].visible = false;
    sm.position.set(2.5, 0.027, 5.9); sm.rotation.set(-Math.PI / 2, 0, 0.09); sm.castShadow = false; this.coverPivot.add(sm);
    this.stampCard = stampC;
    // folder tab
    this.card(this.coverPivot, roundRect(fw - 0.02, -6.5, 0.45, 2.4, 0.15), { lock: "solid", stock: "manila", thick: 0.05, seed: 9004, inset: false,
      print: (p) => p.text("01", fw + 0.2, -5.4, 0.25, "#4a3a20", { align: "center", font: MONO, rot: Math.PI / 2 }) }, [0, 0, 0], [-Math.PI / 2, 0, 0]);
  }

  // ---------------------------------------------------------------- back wall (rag board) with die-cut landings
  private buildWall() {
    const W = this.wallInner;
    const back = new THREE.Shape();
    const top = handCut([[SH.x + 0.05, TOPY], [0.6, TOPY + 0.03], [-0.4, TOPY - 0.02], [-SH.x - 0.05, TOPY]], 0.04, 7);
    back.moveTo(-SH.x - 0.05, BASE); back.lineTo(SH.x + 0.05, BASE);
    top.forEach(([x, y]) => back.lineTo(x, y));
    back.closePath();
    for (const y of LANDINGS) {
      const hh = new THREE.Path(); const yTop = Math.min(y + 2.1, TOPY - 0.25);
      const pts = handCut([[-0.56, y], [0.56, y], [0.56, yTop], [-0.56, yTop]], 0.01, Math.round(y * 10 + 50));
      pts.forEach(([x, yy], i) => (i ? hh.lineTo(x, yy) : hh.moveTo(x, yy))); hh.closePath();
      back.holes.push(hh);
    }
    const wall = this.card(W, back, { stock: "rag", thick: 0.06, px: 150, maxPx: 2048, seed: 3, print: ragWallPrint(true), relief: ragWallRelief, reliefPx: 120, inset: false, edge: 1.15 }, [0, 0, SH.zb]);
    this.diorama.push(wall);
    for (const y of LANDINGS) {
      const fl = 18 + Math.round((y - 1.1) / 3.3);
      const yTop = Math.min(y + 2.1, TOPY - 0.25);
      // floor slab band (warm rag board layered proud of the wall) with stencil number
      this.card(W, shapeFromPts(handCut([[-SH.x, y - 0.42], [SH.x, y - 0.42], [SH.x, y - 0.05], [-SH.x, y - 0.05]], 0.012, fl)),
        { stock: "ragWarm", thick: 0.035, seed: 100 + fl, px: 300, maxPx: 1400, inset: false, edge: 1.2,
          print: (p) => { if (!p.bp) p.rect(-SH.x, y - 0.42, 2 * SH.x, 0.06, "rgba(0,0,0,0.14)"); } }, [0, 0, SH.zb + 0.045]);
      this.card(W, roundRect(-1.15, y - 0.38, 0.4, 0.28, 0.01), { stock: { base: "#3d4659", mottle: 0.04, core: "#d9d3c6", kind: "paper" }, thick: 0.012, seed: 200 + fl, px: 700, print: stencil(String(fl), 0.21) }, [0, 0, SH.zb + 0.08]);
      // sill (folded foil) + header strip
      this.card(W, roundRect(-0.6, y - 0.055, 1.2, 0.055, 0.004), { stock: "foil", thick: 0.12, seed: 300 + fl }, [0, 0, SH.zb + 0.11]);
      if (yTop > y + 2.0) this.card(W, roundRect(-0.64, yTop, 1.28, 0.1, 0.004), { stock: "foilDark", thick: 0.03, seed: 310 + fl, print: brushedFoil }, [0, 0, SH.zb + 0.04]);
      // door leaves behind the opening; floor 18 stands ajar so the corridor light cuts a blade through the gap
      const gap = fl === 18 ? 0.11 : 0.006;
      for (const d of [-1, 1]) {
        const lw = 0.55 - gap;
        const x0 = d < 0 ? -0.55 : gap;
        this.card(W, roundRect(x0, y + 0.01, lw, Math.min(2.08, yTop - y - 0.02), 0.004), { stock: "foilDark", seed: 400 + fl * 2 + d, thick: 0.014, px: 300, print: (p, pts, b) => {
          brushedFoil(p, pts, b);
          if (p.bp) return;
          p.rect(b.x0 + 0.06, b.y0 + 1.15, b.w - 0.12, 0.5, "rgba(0,0,0,0.12)", { line: 0.006, lineColor: "rgba(255,255,255,0.18)" });
        } }, [0, 0, SH.zb - 0.07]);
      }
      if (fl !== 18) {
        const leak = new THREE.Mesh(new THREE.PlaneGeometry(1.25, Math.min(2.3, yTop - y + 0.1)), new THREE.MeshBasicMaterial({ color: untone("#ffcf8f", 0.9) }));
        leak.position.set(0, y + 1.0, SH.zb - 0.12); W.add(leak); this.leaks.push(leak);
      }
    }
    // corridor behind floor 18: layered paper rooms receding into vellum "paper fog"
    const C = this.corridor; W.add(C);
    const y = 1.1;
    const cfloor = this.card(C, roundRect(-1.4, -0.0, 2.8, 1.6, 0), { stock: "ragWarm", thick: 0.03, seed: 501, inset: false,
      print: (p) => { if (!p.bp) for (let k = 0; k < 6; k++) p.rect(-1.4, k * 0.27, 2.8, 0.012, "rgba(60,40,20,0.25)"); } }, [0, y - 0.01, SH.zb - 0.12], [-Math.PI / 2, 0, 0]);
    void cfloor;
    const cw = this.card(C, roundRect(-1.6, y - 0.1, 3.2, 2.8, 0), { stock: { base: "#a68f6c", mottle: 0.06, core: "#efe3c8", kind: "paper" }, thick: 0.03, seed: 502, inset: false,
      print: (p) => {
        if (p.bp) return;
        p.rect(-1.6, y - 0.1, 3.2, 0.35, "#6e5a43");
        p.rect(0.25, y + 1.15, 0.55, 0.42, "#efe7d6", { line: 0.012, lineColor: "#4a3a2a" });
        p.text("FLOOR 18", 0.525, y + 1.31, 0.09, "#2b3440", { align: "center", font: MONO });
      } }, [0, 0, SH.zb - 1.5]);
    void cw;
    const sconce = new THREE.Mesh(new THREE.CircleGeometry(0.13, 24), new THREE.MeshBasicMaterial({ color: untone("#ffe0b0", 1.7) }));
    sconce.position.set(-0.55, y + 1.75, SH.zb - 1.47); C.add(sconce);
    for (const [k, z] of [[0, -0.55], [1, -1.0]] as const) {
      const v = new THREE.Mesh(new THREE.PlaneGeometry(3, 2.7), new THREE.MeshStandardMaterial({ color: "#e9eef0", transparent: true, opacity: k ? 0.16 : 0.1, roughness: 1, depthWrite: false, emissive: new THREE.Color("#3a3428"), side: THREE.DoubleSide }));
      v.position.set(0, y + 1.25, SH.zb + z); C.add(v); this.veils.push(v);
    }
    // landing call box, conduit, alarm beacon
    this.card(W, roundRect(0.72, 1.6, 0.2, 0.32, 0.02), { stock: "foil", seed: 511, print: (p) => { p.ellipse(0.82, 1.82, 0.035, 0.035, "#d9d3c4"); p.ellipse(0.82, 1.7, 0.035, 0.035, "#d9d3c4"); } }, [0, 0, SH.zb + 0.08]);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, TOPY - BASE, 16), new THREE.MeshStandardMaterial({ color: "#8f7a5c", roughness: 0.85 }));
    tube.position.set(-SH.x + 0.1, (BASE + TOPY) / 2, SH.zb + 0.12); tube.castShadow = tube.receiveShadow = true; W.add(tube);
    this.lookFns.push((l) => { const m = tube.material as THREE.MeshStandardMaterial; m.color.set(l === "blueprint" ? "#1b4a8c" : l === "xray" ? "#7fb6c9" : "#8f7a5c"); m.emissive.set(l === "blueprint" ? "#0c2c58" : "#000000"); });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.05, 20), new THREE.MeshStandardMaterial({ color: "#2b2f35", roughness: 0.6, metalness: 0.3 }));
    base.rotation.x = Math.PI / 2; base.position.set(-0.95, 2.95, SH.zb + 0.08); W.add(base);
    this.alarmDome = new THREE.Mesh(new THREE.SphereGeometry(0.085, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: "#a8201c", roughness: 0.45, emissive: untone(BRAND.red), emissiveIntensity: 0.1 }));
    this.alarmDome.rotation.x = Math.PI / 2; this.alarmDome.position.set(-0.95, 2.95, SH.zb + 0.1); W.add(this.alarmDome);
    // top sheave bracket (kraft) on the top edge + die-cut vent grille card (the cool light's gobo)
    const shv = cardBox(0.6, 0.22, 0.3, { stock: "kraft", thick: 0.02, seed: 520, role: "structure" });
    shv.position.set(0, TOPY - 0.3, ROPE_Z); W.add(shv);
    const grille = new THREE.Shape(); grille.moveTo(-SH.x, SH.zb); grille.lineTo(SH.x, SH.zb); grille.lineTo(SH.x, SH.zf); grille.lineTo(-SH.x, SH.zf); grille.closePath();
    for (let i = 0; i < 6; i++) { const x0 = -1.05 + i * 0.38; const h = new THREE.Path(); h.moveTo(x0, SH.zb + 0.25); h.lineTo(x0 + 0.2, SH.zb + 0.25); h.lineTo(x0 + 0.2, SH.zf - 0.25); h.lineTo(x0, SH.zf - 0.25); h.closePath(); grille.holes.push(h); }
    const gr = this.card(W, grille, { stock: "board", thick: 0.03, seed: 530, inset: false }, [0, TOPY + 0.6, 0], [Math.PI / 2, 0, 0]);
    gr.mesh.visible = true; gr.mesh.userData.vent = true;
    this.diorama.push(gr);
    // x-ray light table
    this.backlight = new THREE.Mesh(new THREE.PlaneGeometry(9, 14), new THREE.MeshBasicMaterial({ color: untone("#2f74a8", 0.2) }));
    this.backlight.position.set(0, 0, SH.zb - 0.4); this.backlight.visible = false; W.add(this.backlight);
  }

  // ---------------------------------------------------------------- side walls (fold flat onto the back wall) + rails
  private buildSides() {
    for (const sd of [-1, 1]) {
      const piv = new THREE.Group();
      piv.position.set(sd * SH.x, 0, SH.zb + (sd < 0 ? 0.07 : 0.14));
      this.wallInner.add(piv); this.sidePivots.push(piv);
      // diagonal cut-away profile: tall at the back, lower at the front (sectional model)
      const prof: Pt[] = [[0, BASE], [SH.zf - SH.zb, BASE], [SH.zf - SH.zb, 0.2], [0.9, TOPY - 0.6], [0, TOPY]];
      const sh = shapeFromPts(handCut(prof, 0.02, 40 + sd));
      // card lies in local XY with x = depth toward the camera; rotate so it stands on the side
      const g = new THREE.Group(); g.rotation.y = -Math.PI / 2; if (sd > 0) g.scale.z = -1; piv.add(g);
      const c = this.card(g, sh, { stock: "rag", thick: 0.06, px: 150, maxPx: 2048, seed: 44 + sd, print: ragWallPrint(false), relief: ragWallRelief, reliefPx: 110, inset: false, edge: 1.15 }, [0, 0, sd > 0 ? 0.06 : 0]);
      this.diorama.push(c);
      // guide rail: folded foil T-rail (flange + blade with a rolled fold at the tip) on kraft brackets
      const rail = new THREE.Group(); rail.position.set(0, 0, 0); piv.add(rail);
      const L = TOPY - 0.3 - BASE;
      const fl = cardBox(0.03, L, 0.22, { stock: "foil", thick: 0.006, role: "structure", seed: 800 + sd, px: 60 });
      fl.position.set(-sd * 0.035, BASE, -SH.zb); rail.add(fl);
      const blade = cardBox(SH.x - RAIL_TIP - 0.05, L, 2 * BT, { stock: "foil", thick: 0.006, role: "structure", seed: 810 + sd, px: 60 });
      blade.position.set(-sd * ((SH.x - RAIL_TIP - 0.05) / 2 + 0.05), BASE, -SH.zb); rail.add(blade);
      const tip = new THREE.Mesh(new THREE.CylinderGeometry(BT, BT, L, 14, 1, false, 0, Math.PI), new THREE.MeshStandardMaterial({ color: "#c3ccd6", metalness: 0.9, roughness: 0.3 }));
      tip.rotation.y = sd > 0 ? Math.PI / 2 : -Math.PI / 2; tip.position.set(-sd * (SH.x - RAIL_TIP), BASE + L / 2, -SH.zb); tip.castShadow = tip.receiveShadow = true; rail.add(tip);
      this.lookFns.push((l) => { const m = tip.material as THREE.MeshStandardMaterial; m.color.set(l === "blueprint" ? "#5fc8ff" : l === "xray" ? "#8fd0e8" : "#c3ccd6"); m.emissive.set(l === "blueprint" ? "#0a4a7a" : "#000000"); m.metalness = l === "solid" ? 0.9 : 0.2; });
      for (let y = BASE + 0.6; y < TOPY - 0.6; y += 1.6) {
        const br = cardBox(0.08, 0.16, 0.36, { stock: "kraft", thick: 0.012, role: "structure", seed: 820 + Math.round(y * 3), printFront: (p, _pts, b) => p.rivets([[b.x0 + 0.04, b.y0 + 0.08]], 0.013, "#c79a3c") });
        br.position.set(-sd * 0.05, y, -SH.zb); rail.add(br);
      }
    }
  }

  // ---------------------------------------------------------------- car (foil board shell, kraft frame) + props
  private buildCar() {
    const c = this.car, W = CAR.w, D = CAR.d, H = CAR.h;
    // chequer-plate top: foil board with an EMBOSSED lozenge pattern (relief, not print)
    const top = this.card(c, roundRect(-W / 2, -D / 2, W, D, 0.01), {
      stock: "foil", thick: 0.05, seed: 1001, px: 300, maxPx: 1400, role: "shell", inset: false,
      print: (p, _pts, b) => {
        if (p.bp || p.xr) { for (let x = b.x0 + 0.1; x < b.x1; x += 0.2) p.stroke([[x, b.y0], [x, b.y1]], "", 0.004); return; }
        p.rect(b.x0, b.y0, b.w, b.h, "rgba(20,26,36,0.18)");
        p.stroke([[-0.6, -0.3], [-0.1, -0.22], [0.25, -0.38]], "rgba(20,24,30,0.22)", 0.03);
      },
      relief: (h, _pts, b) => {
        for (let x = b.x0 + 0.05; x < b.x1; x += 0.11) for (let y = b.y0 + 0.05; y < b.y1; y += 0.11) {
          const o = (Math.round((x - b.x0) / 0.11) % 2) ? 0.055 : 0;
          h.shape([[x - 0.03, y + o], [x, y + o + 0.01], [x + 0.03, y + o], [x, y + o - 0.01]], "#c8c8c8");
        }
      }, reliefPx: 260, bump: 1.6,
    }, [0, 0, 0], [-Math.PI / 2, 0, 0]);
    this.diorama.push(top);
    this.card(c, roundRect(0.18, -0.78, 0.62, 0.2, 0.01), { stock: "white", thick: 0.006, seed: 1002, px: 1000,
      print: (p, _pts, b) => { p.text("TOP OF CAR", b.x0 + b.w / 2, b.y0 + 0.11, 0.07, "#2b3440", { align: "center", font: MONO }); p.text("KEEP CLEAR · CAR 2", b.x0 + b.w / 2, b.y0 + 0.04, 0.042, "#8a2a24", { align: "center", font: MONO }); } },
      [0, 0.002, 0], [-Math.PI / 2, 0, 0]);
    // car walls (foil board, die-cut stencil)
    const front = this.card(c, roundRect(-W / 2, -H, W, H, 0.004), { stock: "foilDark", thick: 0.03, seed: 1010, px: 260, maxPx: 1024, inset: false, print: (p, pts, b) => {
      brushedFoil(p, pts, b);
      p.text("CAR 2", b.x0 + 0.15, b.y1 - 0.32, 0.17, "#e2dccd", { font: MONO });
    } }, [0, -0.05, D / 2]);
    this.diorama.push(front);
    for (const sd of [-1, 1]) this.diorama.push(this.card(c, roundRect(-D / 2, -H, D, H, 0.004), { stock: "foilDark", thick: 0.03, seed: 1012 + sd, px: 200, print: brushedFoil, inset: false }, [sd * W / 2, -0.05, 0], [0, sd * Math.PI / 2, 0]));
    // car frame: kraft stiles, crosshead, hitch
    for (const sd of [-1, 1]) {
      const st = cardBox(0.09, H + 0.85, 0.15, { stock: "kraft", thick: 0.01, seed: 1020 + sd, role: "structure", px: 300,
        printFront: (p, _pts, b) => { const rv: Pt[] = []; for (let y = b.y0 + 0.1; y < b.y1; y += 0.25) rv.push([0, y]); p.rivets(rv, 0.013, "#c79a3c"); } });
      st.position.set(sd * 0.93, -H, -0.2); c.add(st);
    }
    const ch = cardBox(1.95, 0.16, 0.18, { stock: "kraft", thick: 0.012, seed: 1030, role: "structure", px: 400,
      printFront: (p, _pts, b) => { const rv: Pt[] = []; for (let x = b.x0 + 0.06; x < b.x1; x += 0.14) rv.push([x, b.y0 + 0.04], [x, b.y1 - 0.04]); p.rivets(rv, 0.011, "#c79a3c"); } });
    ch.position.set(0, 0.62, -0.2); c.add(ch);
    const hitch = cardBox(0.42, 0.06, 0.2, { stock: "foil", thick: 0.008, seed: 1031, role: "structure" });
    hitch.position.set(0, 0.78, ROPE_Z); c.add(hitch);
    for (const x of ROPE_X) {
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.16, 12), new THREE.MeshStandardMaterial({ color: "#c79a3c", metalness: 0.85, roughness: 0.3 }));
      sp.position.set(x, 0.9, ROPE_Z); sp.castShadow = true; c.add(sp);
    }
    // railing (back + left), inspection box, kraft toolbox
    const rail = (x0: number, z0: number, x1: number, z1: number, seed: number) => {
      const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(z1 - z0, x1 - x0);
      const g = new THREE.Group(); g.position.set(x0, 0, z0); g.rotation.y = -ang; c.add(g);
      for (const y of [0.55, 1.0]) this.card(g, roundRect(0, y - 0.03, len, 0.06, 0.01), { stock: "kraft", thick: 0.02, seed: seed + y * 10, role: "structure" }, [0, 0, 0]);
      for (let k = 0; k <= Math.round(len / 0.55); k++) this.card(g, roundRect(-0.025, 0, 0.05, 1.05, 0.01), { stock: "kraft", thick: 0.03, seed: seed + 50 + k, role: "structure" }, [Math.min(len, k * 0.55), 0, 0.01]);
    };
    rail(-0.95, -0.8, 0.85, -0.8, 1100);
    rail(-0.95, 0.5, -0.95, -0.8, 1200);
    const box = cardBox(0.32, 0.22, 0.2, { stock: "foilDark", seed: 1300, thick: 0.01,
      printTop: (p, _pts, b) => { p.rect(b.x0 + 0.03, b.y0 + 0.03, b.w - 0.06, b.h - 0.06, "#2d3540"); p.text("INSPECT", 0.05, -0.02, 0.03, "#e9e3d4", { font: MONO }); } });
    box.position.set(0.45, 0, -0.6); box.rotation.y = -0.15; c.add(box);
    const stop = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.035, 20), new THREE.MeshStandardMaterial({ color: "#c8231d", roughness: 0.45 }));
    stop.position.set(0.53, 0.24, -0.6); stop.castShadow = true; c.add(stop);
    const tb = cardBox(0.42, 0.18, 0.2, { stock: "kraft", seed: 1310, thick: 0.012,
      printFront: (p, _pts, b) => { p.rect(b.x0, b.y1 - 0.05, b.w, 0.05, "#6a4a2c"); p.text("TOOLS", 0, b.y0 + 0.05, 0.05, "#3a2a1c", { align: "center", font: MONO }); } });
    tb.position.set(0.3, 0, 0.5); tb.rotation.y = 0.3; c.add(tb);
    // work lamp: kraft tube post + folded kraft cone shade + bulb (the KEY)
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 1.45, 12), new THREE.MeshStandardMaterial({ color: "#6b5236", roughness: 0.85 }));
    post.position.set(-0.94, 0.75, 0.8); post.castShadow = true; c.add(post);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.04, 20), new THREE.MeshStandardMaterial({ color: "#6b5236", roughness: 0.85 }));
    foot.position.set(-0.94, 0.02, 0.8); foot.castShadow = foot.receiveShadow = true; c.add(foot);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.2, 9, 1, true), new THREE.MeshStandardMaterial({ color: "#9a7149", roughness: 0.9, side: THREE.DoubleSide, flatShading: true }));
    c.add(shade);
    this.bulbMat = new THREE.MeshBasicMaterial({ color: untone("#ffe2b0", 3.0) });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), this.bulbMat); c.add(bulb);
    const lampPos = new THREE.Vector3(-0.94, 1.55, 0.8), lampAim = new THREE.Vector3(0.15, 1.0, -1.15);
    const dir = lampAim.clone().sub(lampPos).normalize();
    shade.position.copy(lampPos).addScaledVector(dir, -0.05);
    shade.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    bulb.position.copy(lampPos).addScaledVector(dir, 0.02);
    this.car.userData.lampPos = lampPos; this.car.userData.lampAim = lampAim;
    // hero tag: printed kraft tag tied to the hitch
    this.tags.push(this.tag(c, "HOIST ROPES ×4", [0.14, 1.06, ROPE_Z + 0.12], 0.06, 0.07, 7001));
  }

  /** a pinned paper tag: coated tag card with a reinforced punch hole, string, brass pin; faces +z by default */
  tag(parent: THREE.Object3D, text: string, pos: [number, number, number], rotY: number, size: number, seed: number) {
    const g = new THREE.Group(); g.position.set(...pos); g.rotation.set(0, rotY, -0.06); parent.add(g);
    const w = size * text.length * 0.62 + size * 1.2, h = size * 1.9;
    const tg = new THREE.Shape(); tg.moveTo(0, -h / 2 + h * 0.2); tg.lineTo(h * 0.25, -h / 2); tg.lineTo(w, -h / 2); tg.lineTo(w, h / 2); tg.lineTo(h * 0.25, h / 2); tg.lineTo(0, h / 2 - h * 0.2); tg.closePath();
    const hole = new THREE.Path(); hole.absellipse(h * 0.3, 0, h * 0.09, h * 0.09, 0, Math.PI * 2, true, 0); tg.holes.push(hole);
    const c = new Card(tg, { stock: "tag", thick: 0.008, seed, px: 1400, inset: false, lock: "solid", edge: 1.1,
      print: (p) => {
        p.ellipse(h * 0.3, 0, h * 0.16, h * 0.16, "#cdbf9f");
        p.text(text, h * 0.62, -size * 0.36, size, "#1d2a44", { font: MONO, weight: 800 });
        p.stroke([[h * 0.6, -h / 2 + 0.012], [w - 0.012, -h / 2 + 0.012]], "#39a86a", 0.008);
      } });
    g.add(c.mesh);
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.02, 12), new THREE.MeshStandardMaterial({ color: "#c79a3c", metalness: 0.85, roughness: 0.3 }));
    pin.rotation.x = Math.PI / 2; pin.position.set(h * 0.3, 0, 0.012); g.add(pin);
    return g;
  }

  // ---------------------------------------------------------------- safety gear: designed for the side-on camera
  private buildGear() {
    const G = new THREE.Group(); G.position.set(GEAR.x, GEAR.y, GEAR.z); this.car.add(G);
    // local frame: x toward the wall (+), z across the blade, y up. Blade tip at local x = RAIL_TIP - GEAR.x.
    // guide blocks (kraft-laminated foil): inclined inner faces, narrower at the top
    const HG = 0.42, ZO = 0.14;
    for (const face of [-1, 1]) {
      const prof: Pt[] = face > 0
        ? [[BT + 0.085, 0], [ZO, 0], [ZO, HG], [BT + 0.05, HG]]
        : [[-ZO, 0], [-BT - 0.085, 0], [-BT - 0.05, HG], [-ZO, HG]];
      // extrude along x (depth 0.22) by building in (z,y) and rotating
      const gb = new THREE.Group(); gb.rotation.y = Math.PI / 2; gb.position.set(-0.12, 0, 0); G.add(gb);
      const c = new Card(shapeFromPts(prof.map(([z, y]) => [-z, y] as Pt)), { stock: "kraft", thick: 0.24, seed: 1500 + face, role: "structure", inset: false, edge: 1.1,
        print: (p, pts, b) => { if (!p.bp && !p.xr) p.rivets([[b.x0 + b.w / 2, b.y0 + 0.06], [b.x0 + b.w / 2, b.y1 - 0.06]], 0.012, "#c79a3c"); } });
      c.mesh.position.z = 0.24; gb.add(c.mesh);
    }
    // top + bottom straps (foil), far cheek with a slot for the blade
    for (const y of [-0.03, HG]) { const st = cardBox(0.26, 0.03, 2 * ZO + 0.02, { stock: "foilDark", thick: 0.008, seed: 1510 + Math.round(y * 100), role: "structure" }); st.position.set(0.0, y, 0); G.add(st); }
    // jaws: foil-board wedges, embossed serrations on the bite face, printed safety-green stock on the visible face
    const JH = 0.3;
    for (const face of [-1, 1]) {
      const g = new THREE.Group(); G.add(g);
      // profile in (z, y): inner face at z = 0 (relative), teeth along it; outer face inclined (thicker at bottom)
      const teeth: Pt[] = [];
      const n = 9;
      for (let i = 0; i <= n; i++) { const y = (i / n) * JH; teeth.push([i % 2 ? 0.0 : 0.016, y]); }
      const prof: Pt[] = [[0.06, 0], ...teeth.slice(0), [0.03, JH]];
      // order: bottom-outer -> along teeth (inner) -> top-outer
      const pts: Pt[] = [[0.072, 0.0], ...teeth.map(([z, y]) => [z, y] as Pt), [0.034, JH]];
      void prof;
      const shape = shapeFromPts(pts.map(([z, y]) => [face > 0 ? -z : z, y] as Pt));
      const gb = new THREE.Group(); gb.rotation.y = Math.PI / 2; gb.position.set(-0.11, 0, 0); g.add(gb);
      const jc = new Card(shape, { stock: "foil", thick: 0.2, seed: 1520 + face, role: "mech", inset: false, edge: 1.0, metal: 0.85, rough: 0.28 });
      jc.mesh.position.z = 0.2; gb.add(jc.mesh);
      // green printed stock laminated on the near face (inset from the teeth, so the bite edge stays bare foil)
      const gpts: Pt[] = [[0.07, 0.03], [0.03, 0.03], [0.03, JH - 0.03], [0.044, JH - 0.03]];
      const green = new Card(shapeFromPts(gpts.map(([z, y]) => [face > 0 ? -z : z, y] as Pt)), { stock: "green", thick: 0.004, seed: 1530 + face, role: "mech", inset: false,
        print: (p, pp) => { if (!p.bp && !p.xr) p.stroke(pp, "rgba(10,60,30,0.35)", 0.003, true); } });
      green.mesh.position.z = 0.204; gb.add(green.mesh);
      this.jaws.push({ g, face, green });
    }
    // SAFETY GEAR tag on the guide block, facing the insert camera (-x)
    this.tags.push(this.tag(G, "SAFETY GEAR", [-0.13, 0.5, -0.13], -Math.PI / 2, 0.026, 7002));
    // GUIDE RAIL tag pinned beside the rail blade, a little above
    this.tags.push(this.tag(G, "GUIDE RAIL", [-0.01, 0.62, 0.03], -Math.PI / 2, 0.022, 7003));
    // gear inspection lamp: small warm practical clipped to the crosshead, raking down over the teeth
    this.gearLamp = new THREE.SpotLight("#ffc890", 0, 2.5, 0.55, 0.6, 1.5);
    this.gearLamp.position.set(GEAR.x - 0.42, GEAR.y + 0.78, 0.32); this.gearLamp.target.position.set(GEAR.x + 0.02, GEAR.y + 0.15, 0);
    this.gearLamp.shadow.mapSize.set(1024, 1024); this.gearLamp.shadow.bias = -0.0004; this.gearLamp.shadow.normalBias = 0.004; this.gearLamp.shadow.radius = 2;
    this.gearLamp.shadow.camera.near = 0.05; this.gearLamp.shadow.camera.far = 2;
    this.car.add(this.gearLamp, this.gearLamp.target);
  }

  // ---------------------------------------------------------------- lights
  private buildLights() {
    const s = this.scene;
    this.hemi = new THREE.HemisphereLight("#2b4270", "#2a1d14", 0.6); s.add(this.hemi);
    // KEY: car-top work lamp, warm tungsten, raking from camera-left across Gus and the back wall
    this.key = new THREE.SpotLight("#ffb46e", 9, 10, 0.78, 0.5, 1.3);
    this.key.castShadow = true; this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.camera.near = 0.1; this.key.shadow.camera.far = 10;
    this.key.shadow.bias = -0.0003; this.key.shadow.normalBias = 0.008; this.key.shadow.radius = 3;
    this.car.add(this.key, this.key.target);
    this.key.position.copy(this.car.userData.lampPos); this.key.target.position.copy(this.car.userData.lampAim);
    // CORRIDOR: warm light behind floor 18; the ajar door cuts it into a blade that rims Gus from behind
    this.corr = new THREE.SpotLight("#ffc27a", 30, 9, 0.5, 0.3, 1.4);
    this.corr.castShadow = true; this.corr.shadow.mapSize.set(1024, 1024); this.corr.shadow.bias = -0.0005; this.corr.shadow.normalBias = 0.01; this.corr.shadow.radius = 2;
    this.corr.position.set(0.15, 2.75, SH.zb - 1.2); this.corr.target.position.set(-0.25, 0.7, 1.2);
    this.wallInner.add(this.corr, this.corr.target);
    // VENT: cool light from the top of the shaft through the die-cut grille
    this.vent = new THREE.SpotLight("#86a8ff", 40, 16, 0.42, 0.45, 1.2);
    this.vent.castShadow = true; this.vent.shadow.mapSize.set(1024, 1024); this.vent.shadow.bias = -0.0006; this.vent.shadow.normalBias = 0.01; this.vent.shadow.radius = 3;
    this.vent.position.set(0.35, TOPY + 3.2, 0.2); this.vent.target.position.set(-0.1, 0, -0.4);
    this.wallInner.add(this.vent, this.vent.target);
    // DESK: the case-file reading lamp (opening only), raking across the manila cover
    this.desk = new THREE.SpotLight("#ffcb8a", 0, 40, 0.55, 0.6, 1.0);
    this.desk.castShadow = false; this.desk.shadow.mapSize.set(2048, 2048); this.desk.shadow.bias = -0.0004; this.desk.shadow.normalBias = 0.02;
    this.desk.position.set(7, BASE + 5.5, 7); this.desk.target.position.set(0, BASE, 3.5);
    s.add(this.desk, this.desk.target);
    // BOUNCE: warm card bounce from camera-right (low), keeps faces from going dead
    this.bounce = new THREE.PointLight("#ffd9b0", 0.6, 7, 1.5); this.bounce.position.set(1.4, 1.3, 2.6); this.car.add(this.bounce);
    this.head = new THREE.SpotLight("#fff1d6", 1.5, 6, 0.3, 0.5, 2); s.add(this.head, this.head.target);
    this.alarmL = new THREE.PointLight("#ff2a22", 0, 4, 1.8); this.alarmL.position.set(-0.9, 2.95, SH.zb + 0.35); this.wallInner.add(this.alarmL);
    this.clampL = new THREE.PointLight("#39ff88", 0, 0.9, 2); this.clampL.position.set(GEAR.x - 0.25, GEAR.y + 0.2, 0); this.car.add(this.clampL);
  }

  private buildRopes() {
    for (const l of ["solid", "blueprint", "xray"] as Look[]) {
      const t = cordTex(l);
      this.ropeMats.set(l, new THREE.MeshStandardMaterial({ map: t, roughness: 0.85, bumpMap: t, bumpScale: 0.6, emissive: l === "blueprint" ? new THREE.Color(0.25, 0.45, 0.7) : new THREE.Color(0, 0, 0), emissiveMap: l === "blueprint" ? t : null }));
    }
    for (let i = 0; i < ROPE_X.length; i++) {
      const upper = new THREE.Mesh(new THREE.BufferGeometry(), this.ropeMats.get("solid"));
      const lower = new THREE.Mesh(new THREE.BufferGeometry(), this.ropeMats.get("solid"));
      upper.castShadow = lower.castShadow = true; upper.receiveShadow = lower.receiveShadow = true;
      const fray: THREE.Mesh[] = [];
      for (let k = 0; k < 6; k++) { const f = new THREE.Mesh(new THREE.BufferGeometry(), this.ropeMats.get("solid")); f.castShadow = true; fray.push(f); this.scene.add(f); }
      this.scene.add(upper, lower);
      this.ropes.push({ upper, lower, fray });
      this.ropeSpecs.push({ x: ROPE_X[i], z: ROPE_Z, top: TOPY - 0.3, hitch: HITCH_Y, breakY: BREAK_Y + (i - 1.5) * 0.03, seed: 31 + i * 17 });
    }
  }
  private tube(m: THREE.Mesh, pts: THREE.Vector3[], r = 0.022, seg = 4) {
    m.geometry.dispose();
    const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
    const len = curve.getLength();
    const g = new THREE.TubeGeometry(curve, Math.max(6, Math.round(len * seg * 5)), r, 8, false);
    const uv = g.getAttribute("uv") as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len / 0.07, uv.getY(i));
    m.geometry = g;
  }

  private buildFx() {
    // cut-paper sparks: foil flecks + green confetti (small, short-lived)
    const r = rng(4242);
    const cols = ["#ffe6b0", "#cfd8e2", "#39ff88", "#fff6e0"];
    for (let i = 0; i < 28; i++) {
      const sh = shapeFromPts([[0, 0.012], [0.008, -0.008], [-0.009, -0.005]]);
      const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color: untone(cols[i % 4], i % 4 === 2 ? 1 : 1.6), side: THREE.DoubleSide, transparent: true }));
      m.scale.setScalar(0.8 + r() * 1.4); m.visible = false; this.car.add(m);
      const a = (r() - 0.5) * 2.4;
      this.sparks.push({ m, v: new THREE.Vector3(-(0.4 + r() * 1.2), 0.3 + r() * 1.6, Math.sin(a) * (0.5 + r())), w: new THREE.Vector3(r() * 20, r() * 20, r() * 20), side: i % 2 ? 1 : -1 });
    }
    // red cut-paper force arrows standing in the scene (lit edges, cast shadows, exact red face)
    const arrow = (len: number, w: number, seed: number) => {
      const h = Math.min(len * 0.42, w * 2.0);
      const pts: Pt[] = [[-w / 2, 0], [w / 2, 0], [w / 2, len - h], [w * 1.2, len - h], [0, len], [-w * 1.2, len - h], [-w / 2, len - h]];
      const c = new Card(shapeFromPts(handCut(pts, w * 0.04, seed)), { stock: "red", thick: 0.02, seed, role: "fx", inset: false, px: 600, lock: "solid" });
      c.mesh.castShadow = true;
      return c.mesh;
    };
    const down = arrow(0.62, 0.13, 5001);
    const dg = new THREE.Group(); dg.position.set(GEAR.x - 0.12, GEAR.y + 0.98, 0.3); dg.rotation.set(0, -Math.PI / 2 + 0.35, 0); this.car.add(dg);
    down.rotation.z = Math.PI; dg.add(down);
    this.arrows = [down];
  }

  setLook(look: Look) {
    if (this.look === look) return;
    this.look = look;
    setLookAll(look);
    this.lookFns.forEach((f) => f(look));
    this.ropes.forEach((r) => { const m = this.ropeMats.get(look)!; r.upper.material = m; r.lower.material = m; r.fray.forEach((f) => (f.material = m)); });
    const fog = look === "solid" ? "#121d33" : look === "blueprint" ? BRAND.navy : "#0a1a2e";
    this.scene.fog = new THREE.FogExp2(fog, look === "solid" ? 0.028 : 0.03);
    this.scene.background = new THREE.Color(fog);
    this.backlight.visible = look === "xray";
    this.veils.forEach((v) => (v.visible = look === "solid"));
    this.leaks.forEach((m) => ((m.material as THREE.MeshBasicMaterial).color = look === "solid" ? untone("#ffcf8f", 0.9) : look === "blueprint" ? untone(BRAND.cyan, 0.7) : untone("#7fd8f5", 0.2)));
    this.bulbMat.color = look === "solid" ? untone("#ffe2b0", 3.0) : untone("#e8f8ff", 2.0);
  }

  private lightRig(look: Look, opening: number) {
    const sol = look === "solid";
    if (sol) {
      this.hemi.color.set("#2b4270"); this.hemi.groundColor.set("#2a1d14"); this.hemi.intensity = 0.55;
      this.key.color.set("#ffb46e"); this.key.intensity = 24;
      this.corr.color.set("#ffc27a"); this.corr.intensity = 45;
      this.vent.color.set("#86a8ff"); this.vent.intensity = 70;
      this.bounce.intensity = 1.0; this.scene.environmentIntensity = 0.9;
    } else if (look === "blueprint") {
      this.hemi.color.set("#9fd0ff"); this.hemi.groundColor.set("#0b1a33"); this.hemi.intensity = 0.7;
      this.key.color.set("#d8f2ff"); this.key.intensity = 5;
      this.corr.color.set(BRAND.cyan); this.corr.intensity = 8;
      this.vent.color.set("#9fd8ff"); this.vent.intensity = 14;
      this.bounce.intensity = 0.2; this.scene.environmentIntensity = 0.3;
    } else {
      this.hemi.color.set("#9fd6ff"); this.hemi.groundColor.set("#0b1a33"); this.hemi.intensity = 0.55;
      this.key.color.set("#e6f6ff"); this.key.intensity = 4;
      this.corr.color.set("#bfe9ff"); this.corr.intensity = 6;
      this.vent.color.set("#bfe6ff"); this.vent.intensity = 10;
      this.bounce.intensity = 0.2; this.scene.environmentIntensity = 0.4;
    }
    // opening: the desk lamp carries the shot, diorama practicals wake up as it pops
    this.desk.intensity = 2.2 * opening;
    const on = 1 - opening;
    this.key.intensity *= on; this.corr.intensity *= on; this.vent.intensity *= on;
    this.hemi.intensity = this.hemi.intensity * on + 0.5 * opening;
    const shadowsOn = (l: THREE.SpotLight, v: boolean) => { if (l.castShadow !== v) l.castShadow = v; };
    shadowsOn(this.desk, opening > 0.02);
    shadowsOn(this.key, on > 0.02); shadowsOn(this.corr, on > 0.02); shadowsOn(this.vent, on > 0.02);
  }

  update(st: Frame) {
    this.setLook(st.look);
    this.lightRig(st.look, st.opening);
    // pop-up kinematics
    this.coverPivot.rotation.z = Math.PI * st.cover;
    this.coverPivot.visible = st.cover < 0.999;
    this.wallPivot.rotation.x = (Math.PI / 2) * (1 - st.wall);
    this.sidePivots[0].rotation.y = (Math.PI / 2) * (1 - st.side);
    this.sidePivots[1].rotation.y = -(Math.PI / 2) * (1 - st.side);
    this.carFold.scale.z = Math.max(0.015, st.pop);
    this.corridor.visible = st.wall > 0.7;
    this.corridor.scale.z = THREE.MathUtils.clamp((st.wall - 0.7) / 0.3, 0.02, 1);
    this.car.position.y = st.carY;
    // puppet
    const P = this.puppet;
    P.pose(st.pose); P.expr(st.expr);
    P.root.rotation.y = st.yaw;
    this.scene.updateMatrixWorld(true);
    const lp = P.lampLens.mesh.localToWorld(new THREE.Vector3(0, 0.37, 0.16));
    this.head.position.copy(lp);
    const hq = new THREE.Quaternion(); P.head.getWorldQuaternion(hq);
    const aim = new THREE.Vector3(0.05, 0.75 + st.expr.py * 20, 1).applyQuaternion(hq).normalize();
    this.head.target.position.copy(lp).addScaledVector(aim, 3); this.head.target.updateMatrixWorld(true);
    this.head.intensity = st.look === "solid" ? 1.4 * st.pop * (1 - st.opening) : 0;
    // ropes
    const ready = st.pop > 0.98 && st.wall > 0.99;
    const carYAt = (t: number) => carYFn(t);
    const cols = (t: number): Collider[] => {
      const cy = carYFn(t);
      return [
        { kind: "plane", a: [-CAR.w / 2, cy, -CAR.d / 2], b: [CAR.w / 2, cy, CAR.d / 2] },
        { kind: "box", a: [-0.98, 0.62 + cy, -0.29], b: [0.98, 0.78 + cy, -0.11] },
        { kind: "box", a: [-0.21, 0.78 + cy, ROPE_Z - 0.1], b: [0.21, 0.84 + cy, ROPE_Z + 0.1] },
        { kind: "capsule", a: [GUS.x, cy, GUS.z - 0.03], b: [0, 1.9 + cy, 0], r: 0.2 },
      ];
    };
    let carYFn = (_t: number) => st.carY;
    if (this.carYAtSnap) { const f = this.carYAtSnap; carYFn = (t: number) => f(t); }
    this.ropes.forEach((r, i) => {
      r.upper.visible = r.lower.visible = ready;
      r.fray.forEach((f) => (f.visible = false));
      if (!ready) return;
      const ts = st.snap - i * 0.03;
      const rs = ropeState(this.ropeSpecs[i], ts, carYAt, cols);
      if (rs.intact) { this.tube(r.upper, [rs.upper[0], rs.upper[0].clone().lerp(rs.upper[1], 0.5), rs.upper[1]]); r.lower.visible = false; return; }
      this.tube(r.upper, rs.upper); this.tube(r.lower, rs.lower);
      // frayed paper fibres splaying from both free ends
      const ends = [[rs.upper[rs.upper.length - 1], rs.upper[rs.upper.length - 2]], [rs.lower[rs.lower.length - 1], rs.lower[rs.lower.length - 2]]];
      ends.forEach(([e, prev], k) => {
        const d = e.clone().sub(prev).normalize();
        const side = new THREE.Vector3(0, 0, 1).cross(d).normalize(); if (side.lengthSq() < 0.1) side.set(1, 0, 0);
        const up2 = d.clone().cross(side).normalize();
        for (let j = 0; j < 3; j++) {
          const a = (j / 3) * Math.PI * 2 + i + k;
          const o = side.clone().multiplyScalar(Math.cos(a)).add(up2.clone().multiplyScalar(Math.sin(a)));
          const p1 = e.clone().addScaledVector(d, 0.05).addScaledVector(o, 0.02);
          const p2 = e.clone().addScaledVector(d, 0.1).addScaledVector(o, 0.06);
          const f = r.fray[k * 3 + j]; f.visible = true;
          this.tube(f, [e.clone().addScaledVector(o, 0.008), p1, p2], 0.007, 3);
        }
      });
    });
    // jaws: wedge action (up and in), green stock glows on the bite
    for (const j of this.jaws) {
      const t = st.clamp;
      j.g.position.set(0, 0.05 * t, -j.face * 0.0 + (j.face > 0 ? 1 : -1) * (BT + 0.03 - 0.03 * t));
      for (const m of j.green.mesh.material as THREE.MeshStandardMaterial[]) {
        if (!m.emissive || st.look === "blueprint") continue;
        m.emissive = untone(BRAND.green); m.emissiveMap = null; m.emissiveIntensity = 0.04 + 0.7 * st.glow; m.needsUpdate = true;
      }
    }
    this.clampL.intensity = st.look === "blueprint" ? 0 : 0.9 * st.glow;
    // sparks (cut paper): fly from the bite toward the camera side (-x)
    this.sparks.forEach((sp, i) => {
      const t = st.clampT - (i % 4) * 0.012;
      if (t < 0 || t > 0.6 || st.look === "blueprint") { sp.m.visible = false; return; }
      sp.m.visible = true;
      sp.m.position.set(GEAR.x - 0.05 + sp.v.x * t * 0.5, GEAR.y + 0.32 + sp.v.y * t - 4.9 * t * t * 0.6, GEAR.z + sp.side * (BT + 0.01) + sp.v.z * t * 0.4);
      sp.m.rotation.set(sp.w.x * t, sp.w.y * t, sp.w.z * t);
      (sp.m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - t / 0.6);
    });
    // alarm practical, arrows, tags
    this.alarmL.intensity = st.look === "solid" ? 1.4 * st.alarm : 0;
    this.gearLamp.intensity = st.gearLamp * (st.look === "solid" ? 5 : 2);
    if (this.gearLamp.castShadow !== st.gearLamp > 0.01) this.gearLamp.castShadow = st.gearLamp > 0.01;
    (this.alarmDome.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.1 + 1.4 * st.alarm;
    this.arrows.forEach((m) => { m.visible = st.arrows > 0.01; m.scale.set(1, Math.max(0.001, st.arrows), 1); });
    this.tags.forEach((t) => (t.visible = st.tags > 0.01));
    this.tags.forEach((t) => (t.scale.setScalar(Math.max(0.001, st.tags))));
    // camera
    const c = st.cam, cam = this.camera;
    cam.position.copy(c.pos); cam.fov = c.fov; cam.up.set(0, 1, 0); cam.lookAt(c.target);
    if (c.roll) cam.rotateZ(c.roll);
    cam.near = c.pos.distanceTo(c.target) < 2 ? 0.02 : 0.05;
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
  }
  /** car offset as a function of seconds after the snap (set by the timeline so the rope sim sees the fall) */
  carYAtSnap: ((t: number) => number) | null = null;
}
