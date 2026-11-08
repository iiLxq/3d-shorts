// The case-file diorama: an elevator shaft built from grey board, kraft card, foil card and paper cord.
// Units: metres of the depicted world (the "set" is a 1:20 model; card thickness is drawn at model scale).
import * as THREE from "three";
import { Card, CardOpts, roundRect, shapeFromPts, ellipseShape, handCut, setLookAll, cardBox } from "./card";
import { Look, Painter, Pt, BRAND, PRUSSIAN, canvas, tex, untone, rng, fiberTex } from "./paint";
import { Puppet, Pose, Expr } from "./puppet";

export interface Cam { pos: THREE.Vector3; target: THREE.Vector3; fov: number; focus: number; blur: number; roll?: number }
export interface FrameState {
  look: Look; t: number; cam: Cam;
  pose: Pose; expr: Expr; yaw: number;
  carY: number;      // car top height (drops in the fall)
  snap: number;      // seconds since the ropes snapped (<0 = intact)
  clamp: number;     // 0..1 jaws travel
  clampT: number;    // seconds since the clamp frame (<0 = not yet)
  alarm: number;     // 0..1 red practical
  arrows: number;    // 0..1 red marker force arrows (x-ray)
}

export const SHAFT = { x: 1.3, zb: -1.15, zf: 1.25, y0: -9, y1: 24 };
export const LANDINGS = [-2.2, 1.1, 4.4, 7.7, 11.0, 14.3, 17.6];
export const BREAK_Y = 3.4;
const CAR = { w: 2.0, d: 1.7, h: 2.5 };
const ROPE_X = [-0.12, -0.04, 0.04, 0.12];
export const GUS = { x: -0.15, z: 0.36 };

// ---------- prints ----------
function brickTile(p: Painter, S: number) {
  // offset-printed brick: halftone red-brown bricks, paper-coloured mortar, slight misregistration
  const bw = 0.3, bh = 0.1, rows = Math.round(S / bh), cols = Math.round(S / bw);
  const r = rng(77);
  for (let j = 0; j < rows; j++) for (let i = -1; i <= cols; i++) {
    const x = i * bw + (j % 2 ? bw / 2 : 0), y = j * bh;
    const pts: Pt[] = [[x + 0.008, y + 0.008], [x + bw - 0.008, y + 0.008], [x + bw - 0.008, y + bh - 0.008], [x + 0.008, y + bh - 0.008]];
    const v = r();
    if (p.bp) { p.stroke(pts, "", 0.0035, true); continue; }
    if (p.xr) { p.stroke(pts, "", 0.003, true); continue; }
    const col = v < 0.33 ? "#6e4a3c" : v < 0.66 ? "#7a5444" : "#665046";
    p.shape(pts, col, { alpha: 0.85 });
    p.halftone(pts, (xx, yy) => 0.25 + 0.25 * Math.sin(xx * 23 + v * 9) * Math.sin(yy * 31), "#3e2a24", 0.014, 0.4);
    p.stroke([[x + 0.01, y + 0.012], [x + bw - 0.012, y + 0.012]], "rgba(20,12,10,0.35)", 0.006); // under-shadow line
  }
  if (p.bp) { // blueprint: a faint construction grid over the bricks
    for (let k = 0; k <= 4; k++) { p.stroke([[0, (k * S) / 4], [S, (k * S) / 4]], "", 0.002); p.stroke([[(k * S) / 4, 0], [(k * S) / 4, S]], "", 0.002); }
  }
}
function concreteTile(p: Painter, S: number) {
  const r = rng(91);
  if (p.bp) { for (let i = 0; i < 6; i++) p.stroke([[0, i * S / 6], [S, i * S / 6]], "", 0.0015, false, [0.02, 0.02]); return; }
  if (p.xr) return;
  for (let i = 0; i < 140; i++) { const x = r() * S, y = r() * S; p.ellipse(x, y, 0.004 + r() * 0.01, 0.003 + r() * 0.008, r() < 0.5 ? "#55524c" : "#a39e94", { alpha: 0.5 }); }
  p.halftone([[0, 0], [S, 0], [S, S], [0, S]], (x, y) => 0.12 + 0.12 * Math.sin(x * 7.0 + Math.sin(y * 5)) , "#4a4741", 0.016, 0.7);
}
function stencil(text: string, size: number, color = "#e9e3d4") {
  return (p: Painter, _pts: Pt[], b: { x0: number; y0: number; w: number; h: number }) => {
    p.text(text, b.x0 + b.w / 2, b.y0 + b.h * 0.24, size, color, { align: "center", font: "'JetBrains Mono', monospace", weight: 800 });
  };
}
function steelPrint(seams: number[], rivetRows = true) {
  return (p: Painter, pts: Pt[], b: { x0: number; y0: number; x1: number; y1: number; w: number; h: number }) => {
    p.halftone(pts, (x, y) => 0.2 + 0.25 * ((y - b.y0) / b.h) * 0 + 0.3 * Math.max(0, (x - b.x0) / b.w - 0.4), "#2f3b49", 0.012);
    for (const sx of seams) { p.stroke([[sx, b.y0], [sx, b.y1]], "#2a3440", 0.008); p.stroke([[sx + 0.006, b.y0], [sx + 0.006, b.y1]], "#8d9bab", 0.003); }
    if (rivetRows) {
      const rv: Pt[] = [];
      for (let x = b.x0 + 0.06; x < b.x1 - 0.03; x += 0.12) { rv.push([x, b.y1 - 0.04], [x, b.y0 + 0.04]); }
      p.rivets(rv, 0.009, "#7e8c9b");
    }
  };
}

// ---------- rope texture ----------
function ropeTex(look: Look) {
  const c = canvas(64, 64), g = c.getContext("2d")!;
  const base = look === "blueprint" ? PRUSSIAN : look === "xray" ? "#cfe6ee" : "#9a9387";
  const line = look === "blueprint" ? "#e8f8ff" : look === "xray" ? "#2a7ea6" : "#4f4a42";
  g.fillStyle = base; g.fillRect(0, 0, 64, 64);
  g.strokeStyle = line; g.lineWidth = look === "solid" ? 7 : 4;
  for (let k = -64; k < 128; k += 21) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 64, 64); g.stroke(); }
  if (look === "solid") { g.strokeStyle = "rgba(255,248,230,0.45)"; g.lineWidth = 3; for (let k = -64; k < 128; k += 21) { g.beginPath(); g.moveTo(k + 9, 0); g.lineTo(k + 73, 64); g.stroke(); } }
  const t = tex(c, true, true);
  return t;
}

// ---------- environment (soft reflections for foil + brass) ----------
function envTex() {
  const c = canvas(512, 256), g = c.getContext("2d")!;
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, "#28344a"); gr.addColorStop(0.5, "#1a1d24"); gr.addColorStop(1, "#141210");
  g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
  const blob = (x: number, y: number, r: number, col: string) => { const q = g.createRadialGradient(x, y, 0, x, y, r); q.addColorStop(0, col); q.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = q; g.fillRect(0, 0, 512, 256); };
  blob(150, 110, 60, "rgba(255,190,120,0.9)"); blob(380, 60, 90, "rgba(140,170,230,0.5)"); blob(260, 140, 40, "rgba(255,220,170,0.6)");
  const t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- the world ----------
export class World {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(36, 1080 / 1920, 0.05, 80);
  car = new THREE.Group();
  puppet = new Puppet();
  key!: THREE.SpotLight;
  head!: THREE.SpotLight;
  fill!: THREE.DirectionalLight;
  hemi!: THREE.HemisphereLight;
  landing!: THREE.PointLight;
  alarmL!: THREE.PointLight;
  clampL!: THREE.PointLight;
  alarmDome!: THREE.Mesh;
  ropes: { lower: THREE.Mesh; upper: THREE.Mesh }[] = [];
  ropeMats = new Map<Look, THREE.Material>();
  jaws: { card: Card; side: number; face: number; base: THREE.Vector3 }[] = [];
  sparks: { m: THREE.Mesh; v: THREE.Vector3; w: THREE.Vector3 }[] = [];
  arrows = new THREE.Group();
  backlight!: THREE.Mesh;
  leaks: THREE.Mesh[] = [];
  contact!: THREE.Mesh;
  look: Look | null = null;
  lookFns: ((l: Look) => void)[] = [];

  constructor() {
    const s = this.scene;
    s.environment = envTex();
    s.environmentIntensity = 0.6;
    this.buildShaft();
    this.buildCar();
    this.scene.add(this.car);
    this.car.add(this.puppet.root);
    this.puppet.root.position.set(GUS.x, 0.025, GUS.z);
    this.buildLights();
    this.buildRopes();
    this.buildFx();
  }

  private add(parent: THREE.Object3D, shape: THREE.Shape, o: CardOpts, pos: [number, number, number], rot: [number, number, number] = [0, 0, 0]) {
    const c = new Card(shape, o);
    c.mesh.position.set(...pos); c.mesh.rotation.set(...rot);
    parent.add(c.mesh);
    return c;
  }

  private buildShaft() {
    const S = SHAFT, s = this.scene;
    const brick = { size: 1.2, key: "brick", paint: brickTile };
    // back wall: grey board with die-cut landing openings
    const back = new THREE.Shape();
    back.moveTo(-S.x - 0.05, S.y0); back.lineTo(S.x + 0.05, S.y0); back.lineTo(S.x + 0.05, S.y1); back.lineTo(-S.x - 0.05, S.y1); back.closePath();
    for (const y of LANDINGS) {
      const h = new THREE.Path(); const pts = handCut([[-0.56, y], [0.56, y], [0.56, y + 2.1], [-0.56, y + 2.1]], 0.012, Math.round(y * 10 + 50));
      pts.forEach(([x, yy], i) => (i ? h.lineTo(x, yy) : h.moveTo(x, yy))); h.closePath();
      back.holes.push(h);
    }
    this.add(s, back, { stock: "grey", thick: 0.05, tile: brick, seed: 3, px: 850 }, [0, 0, S.zb]);
    // side walls
    for (const side of [-1, 1]) {
      const sh = roundRect(S.zb - 0.05, S.y0, S.zf - S.zb + 0.05, S.y1 - S.y0, 0.0);
      // card lies in its local XY; rotate so the printed face looks into the shaft
      const c = this.add(s, sh, { stock: "grey", thick: 0.05, tile: brick, seed: 4 + side, px: 850 }, [side * S.x, 0, 0], [0, side < 0 ? Math.PI / 2 : -Math.PI / 2, 0]);
      if (side > 0) c.mesh.scale.x = -1;
      // front cut edge of the diorama wall: a raw edge strip (lighter core visible)
    }
    // per landing: floor slab band (concrete card, layered on the wall), sill (foil), door leaves, light leaks
    for (const y of LANDINGS) {
      const fl = 18 + Math.round((y - 1.1) / 3.3);
      this.add(s, shapeFromPts(handCut([[-S.x, y - 0.42], [S.x, y - 0.42], [S.x, y - 0.06], [-S.x, y - 0.06]], 0.015, fl)),
        { stock: "grey", thick: 0.03, seed: 100 + fl, role: "shell", px: 500, maxPx: 1400, print: (p, pts) => { concreteTile(p, 3); p.halftone(pts, (_x, yy) => Math.max(0, (y - 0.3 - yy) / 0.15) * 0.5, "#3c3a36", 0.014); } },
        [0, 0, S.zb + 0.035]);
      // stencil floor number on the slab
      this.add(s, roundRect(-1.12, y - 0.38, 0.42, 0.29, 0.01),
        { stock: { base: "#5b5852", mottle: 0.05, core: "#bdb6a9" }, thick: 0.01, seed: 200 + fl, px: 700, print: stencil(String(fl), 0.22) }, [0, 0, S.zb + 0.05]);
      // sill (folded foil card) + header
      this.add(s, roundRect(-0.62, y - 0.06, 1.24, 0.06, 0.004), { stock: "steel", metal: 0.7, rough: 0.4, thick: 0.12, seed: 300 + fl, print: steelPrint([], false) }, [0, 0, S.zb + 0.11]);
      this.add(s, roundRect(-0.66, y + 2.1, 1.32, 0.12, 0.004), { stock: "steel", metal: 0.5, rough: 0.5, thick: 0.03, seed: 310 + fl, print: steelPrint([], true) }, [0, 0, S.zb + 0.04]);
      // landing door leaves (back of the doors), behind the opening with a centre gap
      for (const d of [-1, 1]) {
        this.add(s, roundRect(d < 0 ? -0.545 : 0.009, y + 0.012, 0.536, 2.075, 0.003),
          { stock: "steel", seed: 400 + fl * 2 + d, thick: 0.012, px: 380, print: steelPrint([d < 0 ? -0.3 : 0.3], true) }, [0, 0, S.zb - 0.06]);
      }
      // light box behind the doors: warm corridor light leaking through the gaps
      const leak = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.3), new THREE.MeshBasicMaterial({ color: untone("#ffd59a", 1.6), toneMapped: true }));
      leak.position.set(0, y + 1.05, S.zb - 0.1);
      s.add(leak); this.leaks.push(leak);
    }
    // landing-call box + conduit on the back wall near the current landing
    this.add(s, roundRect(0.72, 1.6, 0.2, 0.32, 0.02), { stock: "steel", seed: 501, print: (p) => { p.ellipse(0.82, 1.82, 0.035, 0.035, "#d9d3c4"); p.ellipse(0.82, 1.7, 0.035, 0.035, "#d9d3c4"); p.text("HALL", 0.82, 1.62, 0.04, "#d9d3c4", { align: "center", font: "'JetBrains Mono', monospace" }); } }, [0, 0, S.zb + 0.08]);
    // conduit: a kraft paper tube along the left wall + junction box + alarm beacon
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, S.y1 - S.y0, 16), new THREE.MeshStandardMaterial({ color: "#8f7a5c", roughness: 0.85 }));
    tube.position.set(-S.x + 0.06, (S.y0 + S.y1) / 2, -0.75); tube.castShadow = tube.receiveShadow = true; s.add(tube);
    this.lookFns.push((l) => { (tube.material as THREE.MeshStandardMaterial).color.set(l === "blueprint" ? "#1b4a8c" : l === "xray" ? "#7fb6c9" : "#8f7a5c"); (tube.material as THREE.MeshStandardMaterial).emissive.set(l === "blueprint" ? "#0c2c58" : "#000000"); });
    // clips on the conduit
    for (let y = -6; y < 22; y += 1.1) this.add(s, roundRect(-0.06, -0.02, 0.12, 0.04, 0.01), { stock: "steel", metal: 0.6, rough: 0.4, thick: 0.08, seed: 600 + Math.round(y * 10) }, [-S.x + 0.04, y, -0.71], [0, Math.PI / 2, 0]);
    const jb = cardBox(0.3, 0.36, 0.14, { stock: "grey", seed: 700, printFront: (p, _pts, b) => { p.rect(b.x0 + 0.04, b.y0 + 0.2, b.w - 0.08, 0.1, "#e9e3d4"); p.text("ALARM", 0, b.y0 + 0.23, 0.05, "#2b3440", { align: "center", font: "'JetBrains Mono', monospace" }); p.rivets([[b.x0 + 0.03, b.y0 + 0.03], [b.x1 - 0.03, b.y0 + 0.03], [b.x0 + 0.03, b.y1 - 0.03], [b.x1 - 0.03, b.y1 - 0.03]], 0.01, "#9aa6b2"); } });
    jb.position.set(-S.x + 0.07, 1.72, -0.75); jb.rotation.y = Math.PI / 2; s.add(jb);
    // red alarm beacon (paper lantern dome)
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.05, 20), new THREE.MeshStandardMaterial({ color: "#2b2f35", roughness: 0.6, metalness: 0.3 }));
    base.rotation.z = Math.PI / 2; base.position.set(-S.x + 0.03, 2.45, -0.75); s.add(base);
    this.alarmDome = new THREE.Mesh(new THREE.SphereGeometry(0.08, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: "#b8221e", roughness: 0.5, emissive: untone(BRAND.red), emissiveIntensity: 0.2 }));
    this.alarmDome.rotation.z = -Math.PI / 2; this.alarmDome.position.set(-S.x + 0.055, 2.45, -0.75); s.add(this.alarmDome);
    // caged hoistway lamp high on the right wall (cool), adds a second motivated source up the shaft
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), new THREE.MeshBasicMaterial({ color: untone("#dfe9ff", 2.2) }));
    bulb.position.set(S.x - 0.1, 7.1, -0.6); s.add(bulb);
    // guide rails (folded foil card T-rails) + brackets with split-pin bolts
    for (const side of [-1, 1]) {
      const g = new THREE.Group(); g.position.set(side * S.x, 0, 0); g.scale.x = side; s.add(g);
      const L = S.y1 - S.y0;
      const blade = cardBox(0.034, L, 0.16, { stock: "steel", metal: 0.85, rough: 0.32, thick: 0.006, role: "structure", seed: 800 + side, px: 120, maxPx: 2048,
        print: (p, _pts, b) => { p.halftone([[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]], (x) => 0.15 + 0.3 * Math.abs(Math.sin(x * 9)), "#6b7684", 0.03); } });
      blade.rotation.y = Math.PI / 2; blade.position.set(-0.13, S.y0, 0); g.add(blade);
      const flange = cardBox(0.03, L, 0.2, { stock: "steel", metal: 0.85, rough: 0.35, thick: 0.006, role: "structure", seed: 810 + side, px: 120, maxPx: 2048 });
      flange.position.set(-0.04, S.y0, 0); g.add(flange);
      for (let y = -6.4; y < 22; y += 2.4) {
        const br = cardBox(0.06, 0.16, 0.34, { stock: "board", seed: 820 + Math.round(y), thick: 0.01, role: "structure", printFront: (p, _pts, b) => p.rivets([[b.x0 + 0.03, b.y0 + 0.08]], 0.012, "#c79a3c") });
        br.position.set(-0.015, y, 0); g.add(br);
        for (const z of [-0.13, 0.13]) {
          const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.02, 12), new THREE.MeshStandardMaterial({ color: "#c79a3c", metalness: 0.85, roughness: 0.3 }));
          bolt.rotation.z = Math.PI / 2; bolt.position.set(-0.075, y + 0.08, z); g.add(bolt);
        }
      }
    }
    // the dark top of the shaft: a navy card ceiling far above with a vent slit
    this.add(s, roundRect(-S.x, S.zb, 2 * S.x, S.zf - S.zb, 0), { stock: "board", thick: 0.05, seed: 900 }, [0, S.y1 - 0.5, 0], [Math.PI / 2, 0, 0]);
    // x-ray light table behind the back wall
    this.backlight = new THREE.Mesh(new THREE.PlaneGeometry(9, 40), new THREE.MeshBasicMaterial({ color: untone("#2f74a8", 0.16), toneMapped: true }));
    this.backlight.position.set(0, 7, S.zb - 0.35); this.backlight.visible = false; s.add(this.backlight);
  }

  private buildCar() {
    const c = this.car, W = CAR.w, D = CAR.d, H = CAR.h;
    // car top plate (chequer plate printed card, thick board)
    const top = this.add(c, roundRect(-W / 2, -D / 2, W, D, 0.01), {
      stock: "steel", thick: 0.05, seed: 1001, px: 520, maxPx: 1400, role: "shell",
      print: (p, pts, b) => {
        // chequer plate: rotated lozenges
        for (let x = b.x0 + 0.04; x < b.x1; x += 0.09) for (let y = b.y0 + 0.04; y < b.y1; y += 0.09) {
          const o = (Math.round((x - b.x0) / 0.09) % 2) ? 0.045 : 0;
          p.shape([[x - 0.022, y + o], [x, y + o + 0.007], [x + 0.022, y + o], [x, y + o - 0.007]], "#6f8297", { line: 0.002 });
        }
        p.halftone(pts, (x, y) => 0.15 + 0.35 * Math.max(0, (x - b.x0) / b.w - 0.3) + 0.25 * Math.max(0, 0.5 - (y - b.y0) / b.h), "#26313d", 0.016);
        const rv: Pt[] = [];
        for (let x = b.x0 + 0.05; x < b.x1; x += 0.13) rv.push([x, b.y0 + 0.04], [x, b.y1 - 0.04]);
        p.rivets(rv, 0.011, "#8c99a8");
        // scuffs
        p.stroke([[-0.5, -0.3], [-0.1, -0.22], [0.2, -0.35]], "rgba(20,24,30,0.25)", 0.02);
        p.stroke([[0.3, 0.2], [0.55, 0.32]], "rgba(220,230,240,0.18)", 0.012);
      },
    }, [0, 0, 0], [-Math.PI / 2, 0, 0]);
    void top;
    // stencilled warning plate glued on the top (layer)
    this.add(c, roundRect(0.2, -0.75, 0.62, 0.2, 0.01), { stock: { base: "#e7e0cf", mottle: 0.05, core: "#fbf6ea" }, thick: 0.006, seed: 1002, px: 1000,
      print: (p, _pts, b) => { p.rect(b.x0, b.y0, b.w, b.h, "#e7e0cf"); p.text("TOP OF CAR", b.x0 + b.w / 2, b.y0 + 0.11, 0.07, "#2b3440", { align: "center", font: "'JetBrains Mono', monospace" }); p.text("KEEP CLEAR · CAR 2", b.x0 + b.w / 2, b.y0 + 0.04, 0.042, "#8a2a24", { align: "center", font: "'JetBrains Mono', monospace" }); } },
      [0, 0.002, 0], [-Math.PI / 2, 0, 0]);
    // car walls below the top
    this.add(c, roundRect(-W / 2, -H, W, H, 0.004), { stock: "steel", thick: 0.03, seed: 1010, px: 260, maxPx: 1024, print: (p, pts, b) => {
      steelPrint([-0.5, 0, 0.5])(p, pts, b);
      p.text("CAR 2", b.x0 + 0.15, b.y1 - 0.3, 0.16, "#d9d3c4", { font: "'JetBrains Mono', monospace" });
      p.text("1000 KG · 13 PERS", b.x0 + 0.15, b.y1 - 0.42, 0.06, "#d9d3c4", { font: "'JetBrains Mono', monospace", weight: 600 });
    } }, [0, -0.05, D / 2]);
    for (const sd of [-1, 1]) this.add(c, roundRect(-D / 2, -H, D, H, 0.004), { stock: "steel", thick: 0.03, seed: 1012 + sd, px: 260, print: steelPrint([0]) }, [sd * W / 2, -0.05, 0], [0, sd * Math.PI / 2, 0]);
    // car frame: stiles (folded channels) + crosshead + rope hitch
    for (const sd of [-1, 1]) {
      const st = cardBox(0.09, H + 0.8, 0.16, { stock: "board", thick: 0.008, seed: 1020 + sd, role: "structure", px: 300,
        printFront: (p, _pts, b) => { const rv: Pt[] = []; for (let y = b.y0 + 0.1; y < b.y1; y += 0.25) rv.push([0, y]); p.rivets(rv, 0.013, "#9aa6b2"); } });
      st.position.set(sd * (W / 2 + 0.03), -H, 0); c.add(st);
    }
    const ch = cardBox(W + 0.16, 0.16, 0.18, { stock: "board", thick: 0.01, seed: 1030, role: "structure", px: 500,
      printFront: (p, _pts, b) => { const rv: Pt[] = []; for (let x = b.x0 + 0.05; x < b.x1; x += 0.12) rv.push([x, b.y0 + 0.04], [x, b.y1 - 0.04]); p.rivets(rv, 0.011, "#9aa6b2"); p.text("CROSSHEAD", -0.62, b.y0 + 0.06, 0.05, "#c9cfd6", { font: "'JetBrains Mono', monospace" }); } });
    ch.position.set(0, 0.62, 0); c.add(ch);
    const hitch = cardBox(0.42, 0.06, 0.2, { stock: "steel", metal: 0.6, rough: 0.4, thick: 0.008, seed: 1031, role: "structure" });
    hitch.position.set(0, 0.78, 0); c.add(hitch);
    for (const x of ROPE_X) {
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.16, 12), new THREE.MeshStandardMaterial({ color: "#c79a3c", metalness: 0.85, roughness: 0.3 }));
      sp.position.set(x, 0.9, 0); sp.castShadow = true; c.add(sp);
      const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 6), new THREE.MeshStandardMaterial({ color: "#8b96a3", metalness: 0.8, roughness: 0.35 }));
      nut.position.set(x, 0.85, 0); nut.castShadow = true; c.add(nut);
    }
    // safety gear housings at the top of each stile, around the rail blade; green brake jaws inside
    for (const sd of [-1, 1]) {
      const g = new THREE.Group(); g.position.set(sd * 1.14, 0.06, 0); g.scale.set(sd * 1.35, 1.35, 1.35); c.add(g);
      // back cheek + front cheek with a die-cut inspection window
      const cheek = new THREE.Shape(); cheek.moveTo(-0.17, 0); cheek.lineTo(0.13, 0); cheek.lineTo(0.13, 0.42); cheek.lineTo(-0.17, 0.42); cheek.closePath();
      const win = new THREE.Path(); win.absellipse(-0.02, 0.21, 0.1, 0.13, 0, Math.PI * 2, false, 0); cheek.holes.push(win);
      this.add(g, cheek, { stock: "steel", thick: 0.014, seed: 1040 + sd, role: "structure", px: 1400,
        print: (p, _pts, b) => { p.rivets([[b.x0 + 0.03, b.y0 + 0.03], [b.x1 - 0.03, b.y0 + 0.03], [b.x0 + 0.03, b.y1 - 0.03], [b.x1 - 0.03, b.y1 - 0.03]], 0.011, "#c79a3c"); p.text("SAFETY", -0.02, b.y1 - 0.035, 0.036, "#e9e3d4", { align: "center", font: "'JetBrains Mono', monospace" }); } },
        [0, 0, 0.13]);
      this.add(g, roundRect(-0.17, 0, 0.3, 0.42, 0.004), { stock: "steel", thick: 0.014, seed: 1042 + sd, role: "structure" }, [0, 0, -0.115]);
      this.add(g, roundRect(-0.17, -0.12, 0.3, 0.24, 0.004), { stock: "board", thick: 0.012, seed: 1044 + sd, role: "structure" }, [0, 0.0, 0], [-Math.PI / 2, 0, 0]);
      // jaws: wedge blocks either side of the blade (blade sits at local x ~ -0.02, z 0)
      for (const face of [-1, 1]) {
        const w = shapeFromPts([[-0.09, 0.03], [0.05, 0.03], [0.05, 0.39], [-0.06, 0.39]]);
        const jc = this.add(g, w, { stock: "green", thick: 0.05, seed: 1050 + sd * 3 + face, role: "mech", px: 1400,
          print: (p, pts) => { p.halftone(pts, (_x, y) => 0.1 + 0.3 * (y - 0.03) / 0.36, "#1e8a52", 0.01); for (let y = 0.06; y < 0.38; y += 0.035) p.stroke([[-0.07, y], [0.04, y]], "#1a7d49", 0.006); } },
          [0, 0, 0]);
        this.jaws.push({ card: jc, side: sd, face, base: new THREE.Vector3(0, 0, face > 0 ? 0.075 : -0.025) });
      }
    }
    // top-of-car railing (back + left side only, low, folded card strips)
    const rail = (x0: number, z0: number, x1: number, z1: number, seed: number) => {
      const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(z1 - z0, x1 - x0);
      const g = new THREE.Group(); g.position.set(x0, 0, z0); g.rotation.y = -ang; c.add(g);
      for (const y of [0.55, 1.0]) this.add(g, roundRect(0, y - 0.035, len, 0.07, 0.01), { stock: "board", thick: 0.02, seed: seed + y * 10, role: "structure",
        print: (p, _pts, b) => { for (let x = b.x0; x < b.x1; x += 0.24) p.shape([[x, b.y0], [x + 0.12, b.y0], [x + 0.16, b.y1], [x + 0.04, b.y1]], "#c9b9a0", { alpha: 0.9 }); } }, [0, 0, 0]);
      for (let k = 0; k <= Math.round(len / 0.55); k++) this.add(g, roundRect(-0.025, 0, 0.05, 1.05, 0.01), { stock: "board", thick: 0.03, seed: seed + 50 + k, role: "structure" }, [Math.min(len, k * 0.55), 0, 0.01]);
    };
    rail(-0.95, -0.8, 0.95, -0.8, 1100);
    rail(-0.95, 0.55, -0.95, -0.8, 1200);
    // inspection station (paper box with printed controls + a real red stop button)
    const box = cardBox(0.32, 0.22, 0.2, { stock: "grey", seed: 1300, thick: 0.01,
      printTop: (p, _pts, b) => { p.rect(b.x0 + 0.03, b.y0 + 0.03, b.w - 0.06, b.h - 0.06, "#2d3540"); p.text("INSPECT", 0.05, -0.02, 0.03, "#e9e3d4", { font: "'JetBrains Mono', monospace" }); p.ellipse(-0.08, 0.0, 0.025, 0.025, "#e9e3d4"); },
      printFront: (p, _pts, b) => { p.text("RUN · STOP", 0, b.y0 + 0.08, 0.04, "#2b3440", { align: "center", font: "'JetBrains Mono', monospace" }); } });
    box.position.set(0.48, 0, -0.55); box.rotation.y = -0.15; c.add(box);
    const stop = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.035, 20), new THREE.MeshStandardMaterial({ color: "#c8231d", roughness: 0.45 }));
    stop.position.set(0.56, 0.24, -0.55); stop.castShadow = true; c.add(stop);
    // toolbox (kraft card) + coiled cord near Gus
    const tb = cardBox(0.42, 0.18, 0.2, { stock: "kraft", seed: 1310, thick: 0.01,
      printFront: (p, _pts, b) => { p.rect(b.x0, b.y1 - 0.05, b.w, 0.05, "#7a5532"); p.text("TOOLS", 0, b.y0 + 0.05, 0.05, "#3a2a1c", { align: "center", font: "'JetBrains Mono', monospace" }); } });
    tb.position.set(0.25, 0, 0.42); tb.rotation.y = 0.35; c.add(tb);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 8, 20, Math.PI), new THREE.MeshStandardMaterial({ color: "#2b2f35", roughness: 0.5 }));
    handle.position.set(0.25, 0.18, 0.42); handle.rotation.y = 0.35; c.add(handle);
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.016, 8, 40), new THREE.MeshStandardMaterial({ color: "#2d3a52", roughness: 0.7 }));
    coil.rotation.x = Math.PI / 2; coil.position.set(-0.72, 0.016, -0.35); coil.castShadow = coil.receiveShadow = true; c.add(coil);
    const coil2 = coil.clone(); coil2.scale.setScalar(0.85); coil2.position.y = 0.045; c.add(coil2);
    // work lamp: paper tube post + folded cone shade + bulb
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 1.3, 12), new THREE.MeshStandardMaterial({ color: "#3e4a3f", roughness: 0.7 }));
    post.position.set(-0.66, 0.65, 0.78); post.castShadow = true; c.add(post);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.04, 20), new THREE.MeshStandardMaterial({ color: "#3e4a3f", roughness: 0.7 }));
    foot.position.set(-0.66, 0.02, 0.78); foot.castShadow = foot.receiveShadow = true; c.add(foot);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.2, 24, 1, true), new THREE.MeshStandardMaterial({ color: "#6f8a74", roughness: 0.55, side: THREE.DoubleSide, emissive: new THREE.Color("#5a3a12"), emissiveIntensity: 0.6 }));
    shade.name = "shade"; c.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), new THREE.MeshBasicMaterial({ color: untone("#ffe2b0", 3.0) }));
    bulb.name = "bulb"; c.add(bulb);
    const lampPos = new THREE.Vector3(-0.66, 1.36, 0.78), lampAim = new THREE.Vector3(0.35, 0.45, -0.55);
    const dir = lampAim.clone().sub(lampPos).normalize();
    shade.position.copy(lampPos).addScaledVector(dir, -0.06);
    shade.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    bulb.position.copy(lampPos).addScaledVector(dir, 0.01);
    this.car.userData.lampPos = lampPos; this.car.userData.lampAim = lampAim;
    // contact shadow under Gus's boots (multiply blob)
    const cc = canvas(128, 64), g = cc.getContext("2d")!;
    const gr = g.createRadialGradient(64, 32, 2, 64, 32, 62); gr.addColorStop(0, "#ffffff"); gr.addColorStop(1, "#000000");
    g.fillStyle = "#000"; g.fillRect(0, 0, 128, 64); g.setTransform(1, 0, 0, 0.5, 0, 16); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    this.contact = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.32), new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: tex(cc, false), transparent: true, depthWrite: false, opacity: 0.8 }));
    this.contact.rotation.x = -Math.PI / 2; this.contact.position.set(GUS.x, 0.006, GUS.z); c.add(this.contact);
    void fiberTex;
  }

  private buildLights() {
    const s = this.scene;
    this.hemi = new THREE.HemisphereLight("#7d97c9", "#3a2c22", 0.5); s.add(this.hemi);
    // key: the car-top work lamp (warm), soft shadows
    this.key = new THREE.SpotLight("#ffc68a", 9, 9, 0.75, 0.55, 2);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.camera.near = 0.1; this.key.shadow.camera.far = 9;
    this.key.shadow.bias = -0.0004; this.key.shadow.normalBias = 0.006; this.key.shadow.radius = 4;
    this.car.add(this.key); this.car.add(this.key.target);
    this.key.position.copy(this.car.userData.lampPos); this.key.target.position.copy(this.car.userData.lampAim);
    // cool fill from the shaft vent above (moon-blue), long shadows down the walls
    this.fill = new THREE.DirectionalLight("#9db8ff", 0.9);
    this.fill.position.set(1.6, 14, 4.5); this.fill.target.position.set(0, 0, -0.3);
    this.fill.castShadow = true; this.fill.shadow.mapSize.set(1024, 1024);
    const sc = this.fill.shadow.camera; sc.left = -2.6; sc.right = 2.6; sc.top = 3.5; sc.bottom = -3.5; sc.near = 2; sc.far = 24;
    this.fill.shadow.bias = -0.0006; this.fill.shadow.normalBias = 0.01;
    s.add(this.fill, this.fill.target);
    // headlamp (follows Gus's gaze), landing leak, red alarm practical, clamp flash
    this.head = new THREE.SpotLight("#fff1d6", 3.5, 7, 0.32, 0.5, 2); s.add(this.head, this.head.target);
    this.landing = new THREE.PointLight("#ffcf8f", 1.4, 4.5, 2); this.landing.position.set(0, 2.2, SHAFT.zb + 0.25); s.add(this.landing);
    this.alarmL = new THREE.PointLight("#ff2a22", 0, 5, 2); this.alarmL.position.set(-SHAFT.x + 0.2, 2.45, -0.75); s.add(this.alarmL);
    this.clampL = new THREE.PointLight("#39ff88", 0, 1.6, 2); this.car.add(this.clampL); this.clampL.position.set(1.0, 0.35, 0.3);
  }

  private buildRopes() {
    for (const l of ["solid", "blueprint", "xray"] as Look[]) {
      const t = ropeTex(l);
      this.ropeMats.set(l, new THREE.MeshStandardMaterial({ map: t, roughness: 0.8, emissive: l === "blueprint" ? new THREE.Color(0.25, 0.45, 0.7) : new THREE.Color(0, 0, 0), emissiveMap: l === "blueprint" ? t : null }));
    }
    for (let i = 0; i < ROPE_X.length; i++) {
      const lower = new THREE.Mesh(new THREE.BufferGeometry(), this.ropeMats.get("solid"));
      const upper = new THREE.Mesh(new THREE.BufferGeometry(), this.ropeMats.get("solid"));
      lower.castShadow = upper.castShadow = true;
      this.scene.add(lower, upper);
      this.ropes.push({ lower, upper });
    }
    // governor rope (thin) on the right
    const gov = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, SHAFT.y1 - SHAFT.y0, 8), new THREE.MeshStandardMaterial({ color: "#7d776c", roughness: 0.8 }));
    gov.position.set(0.98, (SHAFT.y0 + SHAFT.y1) / 2, -0.32); gov.castShadow = true; this.scene.add(gov);
  }

  private tube(m: THREE.Mesh, pts: THREE.Vector3[], r = 0.024) {
    m.geometry.dispose();
    const curve = new THREE.CatmullRomCurve3(pts);
    const len = curve.getLength();
    const g = new THREE.TubeGeometry(curve, Math.max(8, Math.round(len * 6)), r, 10, false);
    const uv = g.getAttribute("uv") as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len / 0.06, uv.getY(i));
    m.geometry = g;
  }

  private buildFx() {
    // cut-paper sparks at the jaws (yellow-white + green confetti)
    const r = rng(4242);
    const cols = ["#fff2c4", "#ffd36b", "#39ff88", "#ffffff"];
    for (let i = 0; i < 46; i++) {
      const sh = shapeFromPts([[0, 0.02], [0.012, -0.012], [-0.014, -0.008]]);
      const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color: untone(cols[i % 4], 2.2), side: THREE.DoubleSide, transparent: true }));
      m.scale.setScalar(0.8 + r() * 1.6);
      m.visible = false; this.car.add(m);
      const a = r() * Math.PI * 2;
      this.sparks.push({ m, v: new THREE.Vector3(Math.cos(a) * (0.6 + r() * 1.8), 0.5 + r() * 2.5, Math.sin(a) * (0.6 + r() * 1.6) + 0.6), w: new THREE.Vector3(r() * 20, r() * 20, r() * 20) });
    }
    // red marker force arrows (x-ray): gravity on the car, tension in the ropes, the break
    const arrow = (len: number, w: number, seed: number) => {
      const h = Math.min(len * 0.45, w * 2.2);
      const pts: Pt[] = [[-w / 2, 0], [w / 2, 0], [w / 2, len - h], [w * 1.25, len - h], [0, len], [-w * 1.25, len - h], [-w / 2, len - h]];
      return new Card(shapeFromPts(handCut(pts, w * 0.06, seed)), {
        stock: { base: BRAND.red, mottle: 0.0, core: "#ffd2cf" }, thick: 0.01, seed, role: "fx", inset: false, px: 900, emissive: untone(BRAND.red, 0.9),
        print: (p, pp) => { p.halftone(pp, (x) => 0.2 + 0.2 * Math.sin(x * 120), "#d81f1f", 0.012, 1.1); },
      });
    };
    const down = arrow(1.1, 0.16, 5001); down.mesh.rotation.z = Math.PI; down.mesh.position.set(0.62, 1.25, 0.55); this.car.add(down.mesh);
    const up = arrow(0.9, 0.11, 5002); up.mesh.position.set(0.3, 1.9, 0.1); this.car.add(up.mesh);
    const brk = arrow(0.6, 0.1, 5003); brk.mesh.rotation.z = -2.3; brk.mesh.position.set(0.55, BREAK_Y - 0.1, 0.15); this.scene.add(brk.mesh);
    this.arrows.userData.list = [down.mesh, up.mesh, brk.mesh];
  }

  setLook(look: Look) {
    if (this.look === look) return;
    this.look = look;
    setLookAll(look);
    this.lookFns.forEach((f) => f(look));
    this.ropes.forEach((r) => { r.lower.material = this.ropeMats.get(look)!; r.upper.material = this.ropeMats.get(look)!; });
    const fog = look === "solid" ? "#24344f" : look === "blueprint" ? BRAND.navy : "#0a1a2e";
    this.scene.fog = new THREE.FogExp2(fog, look === "xray" ? 0.035 : 0.045);
    this.scene.background = new THREE.Color(fog);
    this.backlight.visible = look === "xray";
    this.leaks.forEach((m) => ((m.material as THREE.MeshBasicMaterial).color = look === "solid" ? untone("#ffd59a", 1.6) : look === "blueprint" ? untone(BRAND.cyan, 0.9) : untone("#7fd8f5", 0.22)));
    const bulb = this.car.getObjectByName("bulb") as THREE.Mesh;
    (bulb.material as THREE.MeshBasicMaterial).color = look === "solid" ? untone("#ffe2b0", 3.0) : untone("#e8f8ff", 2.0);
    if (look === "solid") {
      this.hemi.color.set("#8aa2d6"); this.hemi.groundColor.set("#7a5638"); this.hemi.intensity = 2.3;
      this.key.color.set("#ffc68a"); this.key.intensity = 3.4;
      this.fill.color.set("#9db8ff"); this.fill.intensity = 2.0;
      this.landing.color.set("#ffcf8f"); this.landing.intensity = 2.4;
      this.scene.environmentIntensity = 0.6;
    } else if (look === "blueprint") {
      this.hemi.color.set("#bfe6ff"); this.hemi.groundColor.set("#0b1a33"); this.hemi.intensity = 0.9;
      this.key.color.set("#d8f2ff"); this.key.intensity = 5;
      this.fill.color.set("#7fd0ff"); this.fill.intensity = 0.6;
      this.landing.color.set(BRAND.cyan); this.landing.intensity = 0.8;
      this.scene.environmentIntensity = 0.3;
    } else {
      this.hemi.color.set("#9fd6ff"); this.hemi.groundColor.set("#0b1a33"); this.hemi.intensity = 0.55;
      this.key.color.set("#e6f6ff"); this.key.intensity = 2.6;
      this.fill.color.set("#bfe6ff"); this.fill.intensity = 0.35;
      this.landing.color.set("#cfefff"); this.landing.intensity = 0.4;
      this.scene.environmentIntensity = 0.4;
    }
  }

  update(st: FrameState) {
    this.setLook(st.look);
    this.car.position.y = st.carY;
    // puppet
    const P = this.puppet;
    P.pose(st.pose); P.expr(st.expr);
    P.root.rotation.y = st.yaw;
    this.contact.position.x = GUS.x + st.pose.x * Math.cos(st.yaw);
    // headlamp follows the head
    this.scene.updateMatrixWorld(true);
    const lp = P.lampLens.mesh.localToWorld(new THREE.Vector3(0, 0.37, 0.16));
    this.head.position.copy(lp);
    const hq = new THREE.Quaternion(); P.head.getWorldQuaternion(hq);
    const aim = new THREE.Vector3(0.05, 0.75 + st.expr.py * 20, 1).applyQuaternion(hq).normalize();
    this.head.target.position.copy(lp).addScaledVector(aim, 3);
    this.head.target.updateMatrixWorld(true);
    this.head.intensity = st.look === "solid" ? 3.0 : 1.0;
    (P.lampLens.mesh.material as THREE.Material[]).forEach(() => {});
    // ropes (intact or snapped)
    const top = SHAFT.y1, hitchY = st.carY + 0.98;
    this.ropes.forEach((r, i) => {
      const x = ROPE_X[i], ts = st.snap - i * 0.033;
      if (ts < 0) {
        this.tube(r.lower, [new THREE.Vector3(x, hitchY, 0), new THREE.Vector3(x, (hitchY + top) / 2, 0), new THREE.Vector3(x, top, 0)]);
        r.upper.visible = false;
      } else {
        r.upper.visible = true;
        // upper end recoils up the shaft with a whip
        const rec = 7 * ts + 2 * ts * ts, wob = Math.sin(ts * 22 + i) * Math.exp(-ts * 3) * 0.12;
        this.tube(r.upper, [new THREE.Vector3(x + wob, BREAK_Y + rec, 0), new THREE.Vector3(x - wob * 0.5, BREAK_Y + rec + 2, 0), new THREE.Vector3(x, top + 2, 0)]);
        // lower end goes slack and folds over onto the car top
        const k = Math.min(1, ts / 0.9), e = 1 - Math.pow(1 - k, 2);
        const L = BREAK_Y - 0.98; // length above the hitch at rest
        const pts: THREE.Vector3[] = [];
        for (let j = 0; j <= 8; j++) {
          const u = j / 8;
          const straight = new THREE.Vector3(x, hitchY + u * L, 0);
          const slack = new THREE.Vector3(x + (0.25 + 0.15 * i) * Math.sin(u * 3.2 + i) * u + (i - 1.5) * 0.18 * u, hitchY + 0.35 * Math.sin(u * Math.PI) + 0.1 - u * 0.15, 0.25 * u * Math.cos(u * 4 + i));
          pts.push(straight.lerp(slack, e));
        }
        this.tube(r.lower, pts);
      }
    });
    // jaws
    for (const j of this.jaws) {
      const travel = 0.032 * st.clamp;
      j.card.mesh.position.set(j.base.x, j.base.y + 0.025 * st.clamp, j.base.z - j.face * travel);
      const flash = st.clampT >= 0 ? Math.exp(-st.clampT * 5) : 0;
      for (const m of j.card.mesh.material as THREE.MeshStandardMaterial[]) {
        if (!m.emissive) continue;
        if (st.look === "solid" || st.look === "xray") { m.emissive = untone(BRAND.green, 1); m.emissiveIntensity = 0.12 + 0.55 * st.clamp + 2.5 * flash; m.emissiveMap = null; m.needsUpdate = true; }
      }
    }
    const fl = st.clampT >= 0 ? Math.exp(-st.clampT * 4) : 0;
    this.clampL.intensity = st.clamp > 0 ? 0.2 * st.clamp + 5 * fl : 0;
    // sparks
    this.sparks.forEach((sp, i) => {
      const t = st.clampT - (i % 5) * 0.01;
      if (t < 0 || t > 0.9) { sp.m.visible = false; return; }
      sp.m.visible = true;
      const side = i % 2 ? 1 : -1;
      sp.m.position.set(side * 1.12 + sp.v.x * t * side * 0.6, 0.3 + sp.v.y * t - 4.9 * t * t, 0.12 + sp.v.z * t * 0.6);
      sp.m.rotation.set(sp.w.x * t, sp.w.y * t, sp.w.z * t);
      (sp.m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - t / 0.9);
    });
    // alarm practical
    this.alarmL.intensity = st.look === "solid" ? 0.25 + 4.5 * st.alarm : 0;
    (this.alarmDome.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.15 + 1.6 * st.alarm;
    // arrows
    const al = this.arrows.userData.list as THREE.Mesh[];
    al.forEach((m, i) => { m.visible = st.arrows > 0.01 && (i < 2 || st.snap >= 0); m.scale.setScalar(Math.max(0.001, st.arrows)); });
    // camera
    const c = st.cam, cam = this.camera;
    cam.position.copy(c.pos); cam.fov = c.fov; cam.near = 0.05; cam.far = 80;
    cam.up.set(0, 1, 0);
    cam.lookAt(c.target);
    if (c.roll) cam.rotateZ(c.roll);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);
  }
}
