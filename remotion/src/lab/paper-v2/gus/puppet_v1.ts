// "Gus", the Fail-Safe Files technician: a jointed paper-theatre puppet.
// 4 heads tall (1.75 m incl. helmet, head unit 0.44 m), square jaw, cut-paper moustache, rosy halftone cheeks.
// Every piece is printed cardstock with real thickness, layered in z so the pieces cast shadows on each other,
// joined by brass split pins. Expressions = swapped / rotated cut-outs (brows, lids, pupils, mouths).
import * as THREE from "three";
import { Card, CardOpts, roundRect, shapeFromPts, ellipseShape } from "../card";
import { Painter, Pt, BRAND } from "../paint";

export interface Pose {
  x: number; lift: number; lean: number; neck: number; headTilt: number;
  sL: number; eL: number; wL: number; sR: number; eR: number; wR: number;
  hL: number; kL: number; fL: number; hR: number; kR: number; fR: number;
  tool: number; // hammer swing
}
export interface Expr {
  browL: number; browR: number; browY: number; lid: number; // lid 0..3
  px: number; py: number; small: boolean; mouth: "calm" | "alarm" | "relief" | "o"; stache: number;
}
export const POSE0: Pose = { x: 0, lift: 0, lean: 0, neck: 0, headTilt: 0, sL: -0.12, eL: 0.1, wL: 0, sR: 0.14, eR: -0.12, wR: 0, hL: -0.06, kL: 0.04, fL: 0.05, hR: 0.07, kR: -0.03, fR: -0.04, tool: 0 };
export const EXPR: Record<string, Expr> = {
  calm: { browL: 0.06, browR: -0.06, browY: 0, lid: 1, px: 0.006, py: 0.004, small: false, mouth: "calm", stache: 0 },
  alarmed: { browL: 0.42, browR: -0.42, browY: 0.04, lid: 0, px: 0.0, py: 0.012, small: true, mouth: "alarm", stache: 0.014 },
  relieved: { browL: -0.18, browR: 0.18, browY: 0.012, lid: 3, px: 0, py: -0.004, small: false, mouth: "relief", stache: 0.006 },
};

const T = 0.014;   // body card thickness
const TF = 0.009;  // face card thickness
const PX = 1500;   // print density px/m

// ---------- prints ----------
const AMBER_D = "#c9780a";
function jacketPrint(p: Painter, pts: Pt[]) {
  // halftone volume: darker toward the sides and hem (printed shading)
  p.halftone(pts, (x, y) => Math.max(0, (Math.abs(x) - 0.12) / 0.2) * 0.55 + Math.max(0, (0.0 - y) / 0.14) * 0.4 + (x > 0 ? 0.08 : 0), AMBER_D, 0.011);
  // reflective tape: two hoops + braces
  const band = (y: number) => p.rect(-0.33, y, 0.66, 0.05, "#dfe2e2", { line: 0.003 });
  band(0.02); band(0.19);
  p.rect(-0.2, 0.24, 0.05, 0.3, "#dfe2e2", { line: 0.003 }); p.rect(0.15, 0.24, 0.05, 0.3, "#dfe2e2", { line: 0.003 });
  for (const y of [0.02, 0.19]) p.halftone([[-0.33, y], [0.33, y], [0.33, y + 0.05], [-0.33, y + 0.05]], (x) => 0.18 + 0.12 * Math.sin(x * 40), "#9aa3a8", 0.008);
  // zip + placket (slight misregistration: dark line offset from the light one)
  p.stroke([[0.004, -0.13], [0.004, 0.5]], "#7a4a06", 0.006);
  p.stroke([[0.0, -0.13], [0.0, 0.5]], "#ffd27a", 0.003);
  // chest pocket + pen + name tag
  p.rect(-0.2, 0.3, 0.11, 0.1, "#e79a10", { line: 0.003, lineColor: "#8a5606" });
  p.rect(-0.175, 0.37, 0.012, 0.06, "#2f4f86"); p.rect(-0.155, 0.38, 0.01, 0.05, "#b23a2e");
  p.rect(0.07, 0.33, 0.12, 0.05, "#f2efe6", { line: 0.002, lineColor: "#6b6255" });
  p.text("GUS", 0.13, 0.342, 0.032, "#2b3440", { align: "center", font: "'JetBrains Mono', monospace" });
  // pockets
  p.stroke([[-0.26, -0.03], [-0.1, -0.03]], "#8a5606", 0.004); p.stroke([[0.1, -0.03], [0.26, -0.03]], "#8a5606", 0.004);
}
function sleevePrint(cuff: boolean) {
  return (p: Painter, pts: Pt[]) => {
    p.halftone(pts, (x) => Math.max(0, (x + 0.02) / 0.06) * 0.5, AMBER_D, 0.01);
    p.rect(-0.08, -0.17, 0.16, 0.045, "#dfe2e2", { line: 0.003 });
    if (cuff) p.rect(-0.08, -0.25, 0.16, 0.035, "#3b4659");
  };
}
function trouserPrint(p: Painter, pts: Pt[]) {
  p.halftone(pts, (x) => Math.max(0, (x + 0.01) / 0.07) * 0.6 + 0.08, "#222a38", 0.01);
  p.stroke([[0.03, 0.02], [0.03, -0.3]], "#556179", 0.004, false, [0.02, 0.012]); // stitching
}
function bootPrint(p: Painter) {
  p.rect(-0.1, -0.14, 0.21, 0.035, "#2a1f17");
  p.stroke([[-0.07, -0.06], [0.08, -0.06]], "#8d6a4b", 0.004);
  p.rivets([[-0.05, -0.03], [0.0, -0.03], [0.05, -0.03]], 0.006, "#c9a24a");
}
function glovePrint(p: Painter, pts: Pt[]) {
  p.halftone(pts, (x, y) => 0.25 + Math.max(0, -y / 0.12) * 0.3, "#5c6367", 0.009);
  p.rect(-0.06, 0.0, 0.12, 0.025, "#6c7a5a");
}
function headPrint(p: Painter, pts: Pt[]) {
  // shading: jaw side + under-helmet band
  p.halftone(pts, (x, y) => Math.max(0, (x + 0.02) / 0.16) * 0.35 + Math.max(0, (y - 0.25) / 0.1) * 0.35, "#a8654a", 0.009);
  // stubble (5 o'clock shadow) around jaw
  p.halftone(pts, (x, y) => (y < 0.14 ? 0.18 * (1 - y / 0.14) + 0.1 : 0) * (Math.abs(x) < 0.16 ? 1 : 0), "#6d5a55", 0.007, 0.9);
  // cheeks
  for (const s of [-1, 1]) p.halftone(
    Array.from({ length: 24 }, (_, i) => [s * 0.11 + Math.cos(i / 24 * 6.283) * 0.045, 0.135 + Math.sin(i / 24 * 6.283) * 0.032] as Pt),
    () => 0.45, "#e0605a", 0.008, 0.5);
}
function helmetPrint(p: Painter, pts: Pt[]) {
  p.halftone(pts, (x, y) => Math.max(0, (x + 0.05) / 0.2) * 0.4 + Math.max(0, (0.32 - y) / 0.06) * 0.2, "#b9b2a2", 0.01);
  p.stroke([[0, 0.31], [0, 0.48]], "#cfc8b8", 0.03); // ridge
  p.stroke([[0, 0.31], [0, 0.48]], "#f7f3ea", 0.012);
  p.rect(-0.22, 0.265, 0.44, 0.035, "#2c2f33"); // headlamp strap
  p.text("FSF", 0.11, 0.37, 0.034, "#3a4a5e", { align: "center", font: "'JetBrains Mono', monospace", weight: 800 });
}

// ---------- joints ----------
function pinMesh(r = 0.016) {
  const g = new THREE.Group();
  const head = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, 0.006, 20), new THREE.MeshStandardMaterial({ color: "#c79a3c", metalness: 0.85, roughness: 0.32 }));
  head.rotation.x = Math.PI / 2; head.castShadow = true;
  const slit = new THREE.Mesh(new THREE.BoxGeometry(r * 1.5, r * 0.22, 0.002), new THREE.MeshStandardMaterial({ color: "#5a4313", metalness: 0.6, roughness: 0.6 }));
  slit.position.z = 0.0035; slit.rotation.z = 0.5;
  g.add(head, slit);
  return g;
}

export class Puppet {
  root = new THREE.Group();   // world placement
  body = new THREE.Group();   // hips pivot (y = 0.74)
  torso = new THREE.Group();
  head = new THREE.Group();
  j: Record<string, THREE.Group> = {};
  mouths: Record<string, THREE.Object3D> = {};
  lids: THREE.Object3D[][] = [[], []];
  pupils: { big: THREE.Object3D; small: THREE.Object3D; base: THREE.Vector2 }[] = [];
  brows: { g: THREE.Group; y0: number }[] = [];
  stache = new THREE.Group();
  tool = new THREE.Group();
  lampLens!: Card;
  pins: THREE.Object3D[] = [];
  cards: Card[] = [];

  private add(parent: THREE.Object3D, shape: THREE.Shape, o: CardOpts, z: number, x = 0, y = 0) {
    const c = new Card(shape, { px: PX, role: "person", thick: T, ...o });
    c.mesh.position.set(x, y, z);
    parent.add(c.mesh);
    this.cards.push(c);
    return c;
  }
  private pin(parent: THREE.Object3D, x: number, y: number, z: number, r = 0.016) {
    const m = pinMesh(r); m.position.set(x, y, z); parent.add(m); this.pins.push(m); return m;
  }

  constructor() {
    this.root.add(this.body);
    this.body.position.y = 0.74;
    this.body.add(this.torso);

    // ---- legs (behind the jacket) ----
    for (const side of [-1, 1] as const) {
      const hip = new THREE.Group(); hip.position.set(side * 0.095, 0, side < 0 ? -0.034 : -0.02);
      this.body.add(hip);
      this.add(hip, roundRect(-0.078, -0.34, 0.156, 0.4, 0.05), { stock: "slate", print: trouserPrint, seed: 11 + side }, 0);
      const knee = new THREE.Group(); knee.position.set(0, -0.31, 0.012); hip.add(knee);
      this.add(knee, roundRect(-0.07, -0.3, 0.14, 0.34, 0.05), { stock: "slate", print: trouserPrint, seed: 13 + side }, 0);
      this.pin(knee, 0, 0, 0.003, 0.014);
      const ankle = new THREE.Group(); ankle.position.set(0, -0.285, 0.012); knee.add(ankle);
      const bootPts: Pt[] = [[-0.1, -0.15], [0.115, -0.15], [0.12, -0.1], [0.1, -0.05], [0.07, 0.0], [-0.07, 0.0], [-0.095, -0.06]];
      const boot = new THREE.Shape(); boot.moveTo(-0.1, -0.15); boot.lineTo(0.115, -0.15); boot.quadraticCurveTo(0.13, -0.1, 0.1, -0.06);
      boot.quadraticCurveTo(0.09, 0.0, 0.06, 0.01); boot.lineTo(-0.065, 0.01); boot.quadraticCurveTo(-0.1, -0.02, -0.105, -0.08); boot.closePath();
      void bootPts;
      const b = this.add(ankle, boot, { stock: "brown", print: bootPrint, seed: 17 + side }, 0);
      if (side < 0) b.mesh.scale.x = -1;
      this.j[side < 0 ? "hipL" : "hipR"] = hip; this.j[side < 0 ? "kneeL" : "kneeR"] = knee; this.j[side < 0 ? "ankleL" : "ankleR"] = ankle;
    }

    // ---- jacket ----
    const jk = new THREE.Shape();
    jk.moveTo(-0.315, -0.15); jk.lineTo(0.315, -0.15); jk.lineTo(0.29, 0.36);
    jk.quadraticCurveTo(0.285, 0.52, 0.19, 0.56); jk.lineTo(0.075, 0.575); jk.quadraticCurveTo(0, 0.52, -0.075, 0.575);
    jk.lineTo(-0.19, 0.56); jk.quadraticCurveTo(-0.285, 0.52, -0.29, 0.36); jk.closePath();
    this.add(this.torso, jk, { stock: "amber", print: jacketPrint, seed: 21 }, 0);
    // collar lapels (layered)
    for (const s of [-1, 1]) {
      const c = shapeFromPts([[0, 0.5], [s * 0.1, 0.585], [s * 0.15, 0.565], [s * 0.05, 0.44]].map(([x, y]) => [x, y] as Pt));
      this.add(this.torso, c, { stock: { base: "#e3920e", mottle: 0.04, core: "#fff1cf" }, seed: 23 + s, thick: 0.008 }, 0.012);
    }
    // tool belt + pouches + hammer
    this.add(this.torso, roundRect(-0.33, -0.08, 0.66, 0.065, 0.01), {
      stock: "brown", seed: 27, print: (p) => {
        p.rect(-0.04, -0.075, 0.08, 0.055, "#c79a3c", { line: 0.006, lineColor: "#7b5c1c" });
        p.stroke([[-0.32, -0.074], [0.32, -0.074]], "#8d6a4b", 0.003, false, [0.012, 0.008]);
        p.stroke([[-0.32, -0.022], [0.32, -0.022]], "#8d6a4b", 0.003, false, [0.012, 0.008]);
      },
    }, 0.014);
    this.add(this.torso, roundRect(0.13, -0.19, 0.12, 0.13, 0.02), {
      stock: "kraft", seed: 29, print: (p) => { p.rect(0.13, -0.09, 0.12, 0.035, "#7a5532"); p.rivets([[0.19, -0.075]], 0.008, "#c79a3c"); p.halftone([[0.13, -0.19], [0.25, -0.19], [0.25, -0.06], [0.13, -0.06]], (x) => (x - 0.13) / 0.12 * 0.4, "#6d4a2c", 0.01); },
    }, 0.026);
    this.add(this.torso, roundRect(-0.25, -0.17, 0.09, 0.11, 0.015), {
      stock: "kraft", seed: 31, print: (p) => { p.rect(-0.25, -0.09, 0.09, 0.03, "#7a5532"); p.stroke([[-0.215, -0.07], [-0.215, -0.02]], "#9aa3a8", 0.012); },
    }, 0.024);
    this.tool.position.set(-0.29, -0.05, 0.022); this.torso.add(this.tool);
    const ham = new THREE.Shape();
    ham.moveTo(-0.014, 0); ham.lineTo(0.014, 0); ham.lineTo(0.012, -0.2); ham.lineTo(0.05, -0.2); ham.lineTo(0.05, -0.26); ham.lineTo(-0.06, -0.26);
    ham.lineTo(-0.06, -0.215); ham.lineTo(-0.012, -0.2); ham.closePath();
    this.add(this.tool, ham, { stock: "steel", seed: 33, print: (p) => { p.rect(-0.014, -0.19, 0.028, 0.19, "#8a5a32"); p.stroke([[-0.012, -0.05], [0.012, -0.06]], "#5d3a1e", 0.004); } }, 0);

    // ---- arms ----
    for (const side of [-1, 1] as const) {
      const front = side > 0;
      const sh = new THREE.Group(); sh.position.set(side * 0.245, 0.47, front ? 0.05 : -0.042); this.torso.add(sh);
      this.add(sh, roundRect(-0.068, -0.31, 0.136, 0.37, 0.06), { stock: "amber", print: sleevePrint(false), seed: 41 + side }, 0);
      if (front) this.pin(sh, 0, 0, 0.003);
      const el = new THREE.Group(); el.position.set(0, -0.27, 0.014); sh.add(el);
      this.add(el, roundRect(-0.062, -0.28, 0.124, 0.32, 0.055), { stock: "amber", print: sleevePrint(true), seed: 43 + side }, 0);
      this.pin(el, 0, 0, 0.003, 0.014);
      const wr = new THREE.Group(); wr.position.set(0, -0.255, 0.012); el.add(wr);
      const gl = new THREE.Shape();
      gl.moveTo(-0.06, 0.02); gl.lineTo(0.06, 0.02); gl.lineTo(0.066, -0.06);
      gl.quadraticCurveTo(0.1, -0.05, 0.105, -0.085); gl.quadraticCurveTo(0.1, -0.11, 0.065, -0.1); // thumb
      gl.quadraticCurveTo(0.06, -0.155, 0.0, -0.155); gl.quadraticCurveTo(-0.065, -0.15, -0.062, -0.08); gl.closePath();
      const h = this.add(wr, gl, { stock: { base: "#9aa09e", mottle: 0.05, core: "#e4e6e2" }, print: glovePrint, seed: 47 + side }, 0);
      if (side < 0) h.mesh.scale.x = -1;
      this.j[front ? "shR" : "shL"] = sh; this.j[front ? "elR" : "elL"] = el; this.j[front ? "wrR" : "wrL"] = wr;
    }

    // ---- head ----
    this.torso.add(this.head);
    this.head.position.set(0, 0.545, 0.004);
    this.add(this.head, roundRect(-0.05, -0.04, 0.1, 0.1, 0.02), { stock: "skin", seed: 51 }, -0.016); // neck
    for (const s of [-1, 1]) this.add(this.head, ellipseShape(s * 0.168, 0.19, 0.045, 0.062), { stock: "skin", seed: 53 + s, print: (p) => p.ellipse(s * 0.17, 0.19, 0.022, 0.034, "#b97a58") }, -0.008);
    const hd = new THREE.Shape(); // square jaw, slightly narrower crown
    hd.moveTo(-0.13, 0.02); hd.lineTo(0.13, 0.02); hd.quadraticCurveTo(0.172, 0.025, 0.172, 0.09); hd.lineTo(0.162, 0.3);
    hd.quadraticCurveTo(0.155, 0.37, 0.0, 0.375); hd.quadraticCurveTo(-0.155, 0.37, -0.162, 0.3); hd.lineTo(-0.172, 0.09);
    hd.quadraticCurveTo(-0.172, 0.025, -0.13, 0.02); hd.closePath();
    this.add(this.head, hd, { stock: "skin", print: headPrint, seed: 55, px: 2200 }, 0);
    // eyes
    for (const s of [-1, 1]) {
      const ex = s * 0.068, ey = 0.205;
      this.add(this.head, ellipseShape(ex, ey, 0.043, 0.052), { stock: "white", seed: 61 + s, thick: TF, px: 2400, print: (p, pts) => p.halftone(pts, (x, y) => Math.max(0, (y - ey) / 0.05) * 0.35, "#b8c0c6", 0.006) }, 0.016);
      const big = new THREE.Group(), small = new THREE.Group();
      const pb = this.add(big, ellipseShape(0, 0, 0.022, 0.025), { stock: { base: BRAND.navy, mottle: 0.02, core: "#5c6f8f" }, seed: 63, thick: TF, px: 2400, print: (p) => p.ellipse(-0.007, 0.008, 0.006, 0.006, "#f4f6f8") }, 0);
      const ps = this.add(small, ellipseShape(0, 0, 0.013, 0.015), { stock: { base: BRAND.navy, mottle: 0.02, core: "#5c6f8f" }, seed: 65, thick: TF, px: 2400, print: (p) => p.ellipse(-0.004, 0.005, 0.004, 0.004, "#f4f6f8") }, 0);
      void pb; void ps;
      big.position.set(ex, ey, 0.024); small.position.set(ex, ey, 0.024);
      this.head.add(big, small);
      this.pupils.push({ big, small, base: new THREE.Vector2(ex, ey) });
      // lids: cut-outs at 4 closures, swapped
      const lv: THREE.Object3D[] = [];
      [0.0, 0.32, 0.6, 1.02].forEach((k, i) => {
        const rx = 0.046, ry = 0.055;
        const sn = Math.max(-1, Math.min(1, 1 - 2 * k)); // cut line in ellipse units
        const a0 = Math.asin(sn), a1 = Math.PI - a0;
        const pts: Pt[] = [];
        for (let a = 0; a <= 36; a++) { const t = a0 + (a1 - a0) * (a / 36); pts.push([ex + Math.cos(t) * rx, ey + Math.sin(t) * ry]); }
        const yy = ey + sn * ry, xx = rx * Math.cos(a0);
        const g = new THREE.Group();
        if (k > 0) this.add(g, shapeFromPts(pts), {
          stock: "skin", seed: 67 + i, thick: TF, px: 2400,
          print: (p) => {
            if (k < 1) { p.stroke([[ex - xx, yy + 0.002], [ex + xx, yy + 0.002]], "#4a2c22", 0.007); return; }
            // closed happy eye: a curved lash line
            const arc: Pt[] = [];
            for (let q = 0; q <= 16; q++) { const t = Math.PI * (1.15 + 0.7 * q / 16); arc.push([ex + Math.cos(t) * rx * 0.8, ey + 0.012 + Math.sin(t) * ry * 0.45]); }
            p.stroke(arc, "#4a2c22", 0.008);
          },
        }, 0);
        g.position.z = 0.032; g.visible = i === 0;
        this.head.add(g); lv.push(g);
      });
      this.lids[s < 0 ? 0 : 1] = lv;
      // brow
      const bg = new THREE.Group(); bg.position.set(s * 0.072, 0.282, 0.038); this.head.add(bg);
      this.add(bg, roundRect(-0.05, -0.014, 0.1, 0.03, 0.013), { stock: "brown", seed: 71 + s, thick: TF, px: 2200, print: (p, pts) => p.halftone(pts, () => 0.3, "#2e1f15", 0.006) }, 0);
      this.brows.push({ g: bg, y0: 0.282 });
    }
    // nose
    const nose = ellipseShape(0.004, 0.152, 0.036, 0.031, 28); // round bulb nose
    this.add(this.head, nose, { stock: { base: "#dc9c74", mottle: 0.03, core: "#f6dcc7" }, seed: 75, thick: TF, px: 2400,
      print: (p, pts) => { p.halftone(pts, (x, y) => Math.max(0, (x + 0.005) / 0.04) * 0.35 + Math.max(0, (0.14 - y) / 0.03) * 0.25, "#b06a4a", 0.006); p.ellipse(-0.012, 0.165, 0.009, 0.006, "#f7d3b8"); } }, 0.04);
    // mouths (behind the moustache)
    const mouthG = new THREE.Group(); mouthG.position.set(0, 0.075, 0.017); this.head.add(mouthG);
    const calm = new THREE.Shape(); calm.moveTo(-0.04, 0.008); calm.quadraticCurveTo(0, -0.022, 0.04, 0.008); calm.quadraticCurveTo(0, -0.008, -0.04, 0.008);
    const alarm = ellipseShape(0, -0.006, 0.038, 0.042);
    const relief = new THREE.Shape(); relief.moveTo(-0.062, 0.01); relief.lineTo(0.062, 0.01); relief.quadraticCurveTo(0.05, -0.06, 0, -0.062); relief.quadraticCurveTo(-0.05, -0.06, -0.062, 0.01);
    const oh = ellipseShape(0, -0.004, 0.022, 0.026);
    const mouthCard = (sh: THREE.Shape, teeth: boolean) => {
      const g = new THREE.Group();
      this.add(g, sh, {
        stock: { base: "#4a1c1e", mottle: 0.03, core: "#e9b9a8" }, seed: 81, thick: TF, px: 2400, inset: false,
        print: (p, _pts, b) => {
          if (teeth) p.rect(b.x0, b.y1 - 0.016, b.w, 0.016, "#f4efe4");
          if (b.h > 0.03) p.ellipse(0, b.y0 + b.h * 0.25, b.w * 0.28, b.h * 0.2, "#c4454a");
        },
      }, 0);
      mouthG.add(g); return g;
    };
    this.mouths = { calm: mouthCard(calm, false), alarm: mouthCard(alarm, true), relief: mouthCard(relief, true), o: mouthCard(oh, false) };
    // moustache: two bushy lobes with a cut fringe
    const st: Pt[] = [];
    const N = 22;
    for (let i = 0; i <= N; i++) { const t = i / N, x = -0.1 + 0.2 * t; st.push([x, 0.105 + 0.03 * Math.sin(Math.PI * t) - (Math.abs(x) < 0.012 ? 0.008 : 0)]); }
    for (let i = N; i >= 0; i--) { const t = i / N, x = -0.1 + 0.2 * t; st.push([x, 0.07 + 0.012 * Math.sin(Math.PI * t) - (i % 2 ? 0.014 : 0) + 0.02 * Math.abs(x) / 0.1]); }
    this.stache.position.z = 0.044; this.head.add(this.stache);
    this.add(this.stache, shapeFromPts(st), { stock: "brown", seed: 85, thick: TF, px: 2400, print: (p, pts) => p.halftone(pts, (x, y) => 0.25 + Math.max(0, (0.09 - y) / 0.03) * 0.3, "#24170f", 0.006) }, 0);
    // helmet (white card dome + brim) + headlamp
    const hm = new THREE.Shape();
    hm.moveTo(-0.225, 0.262); hm.lineTo(0.225, 0.262); hm.lineTo(0.215, 0.305); hm.lineTo(0.19, 0.31);
    hm.quadraticCurveTo(0.19, 0.49, 0.0, 0.495); hm.quadraticCurveTo(-0.19, 0.49, -0.19, 0.31); hm.lineTo(-0.215, 0.305); hm.closePath();
    this.add(this.head, hm, { stock: { base: "#efe9dc", mottle: 0.05, core: "#fbf8f1" }, print: helmetPrint, seed: 91, px: 2000 }, 0.026);
    this.add(this.head, ellipseShape(0, 0.355, 0.046, 0.042), { stock: { base: "#3a3d42", mottle: 0.03, core: "#b8bcc2" }, seed: 93, thick: 0.012 }, 0.042);
    this.lampLens = this.add(this.head, ellipseShape(0, 0.355, 0.03, 0.027), {
      stock: { base: "#fff3d6", mottle: 0.02, core: "#ffffff" }, seed: 95, thick: 0.006, inset: false,
      emissive: new THREE.Color(2.2, 1.9, 1.4), print: (p) => p.ellipse(-0.008, 0.362, 0.01, 0.008, "#ffffff"),
    }, 0.052);
  }

  pose(p: Pose) {
    this.body.position.set(p.x, 0.74 + p.lift, 0);
    this.torso.rotation.z = p.lean;
    this.head.rotation.z = p.neck;
    this.head.rotation.x = p.headTilt;
    this.j.shL.rotation.z = p.sL; this.j.elL.rotation.z = p.eL; this.j.wrL.rotation.z = p.wL;
    this.j.shR.rotation.z = p.sR; this.j.elR.rotation.z = p.eR; this.j.wrR.rotation.z = p.wR;
    this.j.hipL.rotation.z = p.hL; this.j.kneeL.rotation.z = p.kL; this.j.ankleL.rotation.z = p.fL;
    this.j.hipR.rotation.z = p.hR; this.j.kneeR.rotation.z = p.kR; this.j.ankleR.rotation.z = p.fR;
    this.tool.rotation.z = p.tool;
  }
  expr(e: Expr) {
    this.brows.forEach((b, i) => { b.g.rotation.z = i === 0 ? e.browL : e.browR; b.g.position.y = b.y0 + e.browY; });
    this.lids.forEach((lv) => lv.forEach((g, i) => (g.visible = i === Math.round(e.lid))));
    this.pupils.forEach((pp) => {
      pp.big.visible = !e.small; pp.small.visible = e.small;
      for (const g of [pp.big, pp.small]) g.position.set(pp.base.x + e.px, pp.base.y + e.py, 0.024);
    });
    Object.entries(this.mouths).forEach(([k, g]) => (g.visible = k === e.mouth));
    this.stache.position.y = e.stache;
  }
}

export function mixPose(a: Pose, b: Pose, t: number): Pose {
  const o = { ...a };
  (Object.keys(a) as (keyof Pose)[]).forEach((k) => { o[k] = a[k] + (b[k] - a[k]) * t; });
  return o;
}
