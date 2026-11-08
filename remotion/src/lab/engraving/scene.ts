// Test scene: elevator shaft at night, car top with technician, upper-mounted safety gear on both rails.
// Units: metres, y up, car roof top at y = 0 (car group moves with `drop`). The front of the shaft is a
// section cut (patent convention): the side walls show 45 deg section lining on their cut faces.
import * as THREE from "three";
import { inkMat, KIND, SPOT, XROLE, U, InkOpts, setU } from "./ink";
import { Figure } from "./figure";

const RAIL_X = 1.335;      // rail flange on the side walls; blade points inward to |x| = 1.245
const BLADE_IN = 1.245;

function box(w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material, parent: THREE.Object3D, cast = true) {
  const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); me.position.set(x, y, z);
  me.castShadow = cast; me.receiveShadow = true; parent.add(me); return me;
}
function cyl(r: number, h: number, x: number, y: number, z: number, m: THREE.Material, parent: THREE.Object3D, seg = 16, axis: "y" | "x" | "z" = "y") {
  const me = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m); me.position.set(x, y, z);
  if (axis === "x") me.rotation.z = Math.PI / 2; if (axis === "z") me.rotation.x = Math.PI / 2;
  me.castShadow = true; me.receiveShadow = true; parent.add(me); return me;
}

// Dashed hidden lines (patent convention) along the 12 edges of a box: world-anchored dash pieces.
function dashedBox(w: number, h: number, d: number, c: THREE.Vector3, m: THREE.Material, parent: THREE.Object3D, t = 0.016, dash = 0.075, gap = 0.05) {
  const g = new THREE.Group(); g.position.copy(c); parent.add(g);
  const hw = w / 2, hh = h / 2, hd = d / 2;
  const edges: [THREE.Vector3, THREE.Vector3][] = [];
  for (const sy of [-1, 1]) for (const sz of [-1, 1]) edges.push([new THREE.Vector3(-hw, sy * hh, sz * hd), new THREE.Vector3(hw, sy * hh, sz * hd)]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) edges.push([new THREE.Vector3(sx * hw, -hh, sz * hd), new THREE.Vector3(sx * hw, hh, sz * hd)]);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) edges.push([new THREE.Vector3(sx * hw, sy * hh, -hd), new THREE.Vector3(sx * hw, sy * hh, hd)]);
  const unit = new THREE.BoxGeometry(1, 1, 1);
  for (const [a, b] of edges) {
    const L = a.distanceTo(b); const dir = b.clone().sub(a).normalize();
    const n = Math.max(1, Math.floor((L + gap) / (dash + gap))); const used = n * dash + (n - 1) * gap; const s0 = (L - used) / 2;
    for (let i = 0; i < n; i++) {
      const s = s0 + i * (dash + gap) + dash / 2;
      const me = new THREE.Mesh(unit, m); me.position.copy(a).addScaledVector(dir, s);
      me.scale.set(Math.abs(dir.x) > 0.5 ? dash : t, Math.abs(dir.y) > 0.5 ? dash : t, Math.abs(dir.z) > 0.5 ? dash : t);
      g.add(me);
    }
  }
  return g;
}

// flat arrow (extruded) in the XY plane, pointing along -y by default; red/green spot + glow
function arrowMesh(len: number, wid: number, m: THREE.Material) {
  const s = new THREE.Shape(); const hw = wid / 2, hl = Math.min(len * 0.42, wid * 1.6);
  s.moveTo(-hw * 0.45, 0); s.lineTo(hw * 0.45, 0); s.lineTo(hw * 0.45, -(len - hl)); s.lineTo(hw, -(len - hl)); s.lineTo(0, -len); s.lineTo(-hw, -(len - hl)); s.lineTo(-hw * 0.45, -(len - hl)); s.closePath();
  const g = new THREE.ShapeGeometry(s);
  m.side = THREE.DoubleSide;
  return new THREE.Mesh(g, m);
}

export type WorldState = {
  drop: number;        // car displacement down (m)
  jaw: number;         // 0 open .. 1 clamped (wedges pulled up)
  jawGlow: number;     // green glow strength
  alarm: number;       // red beacon brightness 0..1
  snap: number;        // -1 intact; >= 0 seconds since rope snap
  xr: number;          // x-ray (show dashed shells + arrows)
  arrows: number;      // force arrows visibility
  lampOn: number;
  headAim: THREE.Vector3;  // where the headlamp points (world)
  ropeShiver: number;  // pre-snap vibration amplitude
  t: number;
};

export class World {
  scene = new THREE.Scene();
  car = new THREE.Group();
  fig = new Figure();
  jaws: THREE.Mesh[] = []; jawMats: THREE.MeshPhongMaterial[] = [];
  ropes: THREE.Mesh[] = []; ropeUp: THREE.Mesh[] = [];
  ropeMat: THREE.MeshPhongMaterial;
  beaconMat: THREE.MeshPhongMaterial; beacon: THREE.PointLight;
  work: THREE.SpotLight; head: THREE.SpotLight; landing: THREE.SpotLight;
  xrayGroup = new THREE.Group(); arrows = new THREE.Group(); sparks = new THREE.Group();
  lever!: THREE.Group;
  figPos = new THREE.Vector3(0.18, 0, 0.12);
  constructor() {
    const S = this.scene;
    S.add(this.car);
    // ---------------- materials
    const M = (o: InkOpts) => inkMat(o);
    const brick = M({ kind: KIND.brick, albedo: 0.62, angle: 18 });
    const concL = M({ kind: KIND.concrete, albedo: 0.7, angle: 70, section: true });
    const concR = M({ kind: KIND.concrete, albedo: 0.7, angle: 110, section: true });
    const rail = M({ kind: KIND.metal, albedo: 0.5, angle: 90, spot: SPOT.cyan, spotAmt: 0.55, shininess: 60, spec: 0.5, xrole: XROLE.hero });
    const steel = M({ kind: KIND.metal, albedo: 0.48, angle: 25, shininess: 40, spec: 0.3 });
    const struct = M({ kind: KIND.metal, albedo: 0.55, angle: 0, spot: SPOT.cyan, spotAmt: 0.45, shininess: 40, spec: 0.3, xrole: XROLE.hero });
    const carPaint = M({ kind: KIND.paint, albedo: 0.72, angle: 90, panel: 0.5, xrole: XROLE.shell, shininess: 30, spec: 0.15 });
    const plate = M({ kind: KIND.plate, albedo: 0.6, angle: 0, contact: true, shininess: 30, spec: 0.2 });
    const housing = M({ kind: KIND.metal, albedo: 0.42, angle: 60, shininess: 50, spec: 0.35, xrole: XROLE.shell });
    const dark = M({ kind: KIND.metal, albedo: 0.25, angle: 45 });
    const door = M({ kind: KIND.paint, albedo: 0.55, angle: 90, panel: 0.0, shininess: 20, spec: 0.1 });
    const gap = M({ kind: KIND.plain, albedo: 1, glow: 0.9, spot: SPOT.light, spotAmt: 0 });
    const lampLens = M({ kind: KIND.plain, albedo: 1, glow: 1.0, spot: SPOT.light, spotAmt: 0, hatchK: 0 });
    const hidden = M({ kind: KIND.solid, xrole: XROLE.xonly });
    this.ropeMat = M({ kind: KIND.rope, albedo: 0.5, angle: 90, uvScale: [0.044, 20], shininess: 60, spec: 0.4, spot: SPOT.cyan, spotAmt: 0.25, xrole: XROLE.hero });
    this.beaconMat = M({ kind: KIND.plain, albedo: 0.9, spot: SPOT.red, spotAmt: 1, glow: 0.5, hatchK: 0.4 });

    // ---------------- shaft (static)
    box(3.3, 26, 0.3, 0, 2, -1.42, brick, S, false);
    box(0.3, 26, 2.95, -1.5, 2, -0.12, concL, S, false);
    box(0.3, 26, 2.95, 1.5, 2, -0.12, concR, S, false);
    // landing doors on the back wall (sills at 1.15, 4.45, 7.75): frame + 2 panels + leaking light gaps
    for (const sill of [1.15, 4.45, 7.75, -2.15]) {
      const z = -1.265;
      box(1.22, 0.07, 0.06, 0, sill + 2.12, z, steel, S); box(0.07, 2.12, 0.06, -0.575, sill + 1.06, z, steel, S); box(0.07, 2.12, 0.06, 0.575, sill + 1.06, z, steel, S);
      box(1.3, 0.05, 0.16, 0, sill - 0.02, -1.2, steel, S); // sill plate
      box(0.535, 2.08, 0.03, -0.272, sill + 1.04, -1.255, door, S); box(0.535, 2.08, 0.03, 0.272, sill + 1.04, -1.255, door, S);
      box(0.012, 2.0, 0.02, 0, sill + 1.04, -1.252, gap, S, false);          // centre gap light
      box(1.05, 0.012, 0.02, 0, sill + 2.085, -1.252, gap, S, false);       // head gap
      // door hanger box + interlock above
      box(1.2, 0.16, 0.12, 0, sill + 2.3, -1.2, dark, S);
    }
    // rails + brackets (static, structure = cyan)
    for (const s of [-1, 1]) {
      box(0.012, 22, 0.13, s * RAIL_X, 2, 0, rail, S);                         // flange
      box(0.09, 22, 0.018, s * (BLADE_IN + 0.045), 2, 0, rail, S);           // blade
      for (let y = -8; y < 12; y += 1.6) {
        box(0.07, 0.11, 0.24, s * (RAIL_X + 0.035), y, 0, struct, S);
        box(0.02, 0.2, 0.02, s * (RAIL_X + 0.005), y, 0.08, steel, S); box(0.02, 0.2, 0.02, s * (RAIL_X + 0.005), y, -0.08, steel, S);
      }
    }
    // conduit + junction boxes on the right wall, governor rope on the left
    cyl(0.022, 22, 1.3, 2, -0.95, steel, S, 10);
    for (let y = -6; y < 12; y += 1.4) box(0.04, 0.05, 0.07, 1.33, y, -0.95, dark, S);
    box(0.08, 0.32, 0.22, 1.3, 1.9, -0.8, dark, S);
    cyl(0.009, 22, -1.13, 2, 0.32, this.ropeMat, S, 8);                     // governor rope
    // buffer/counterweight hint far below: dark
    // ---------------- car (moves)
    const C = this.car;
    box(2.0, 2.55, 1.85, 0, -1.3, 0, carPaint, C);
    box(2.06, 0.05, 1.9, 0, 0.0, 0, plate, C);
    const doorS = M({ kind: KIND.paint, albedo: 0.55, angle: 90, panel: 0.0, shininess: 20, spec: 0.1, xrole: XROLE.shell });
    box(1.5, 0.28, 0.16, 0, -0.2, 1.0, doorS, C);                                      // door operator / header
    cyl(0.07, 0.05, -0.45, -0.2, 1.1, doorS, C, 18, "z"); cyl(0.07, 0.05, 0.45, -0.2, 1.1, doorS, C, 18, "z");
    box(1.0, 0.02, 0.05, 0, -0.08, 1.1, doorS, C);                                       // belt
    box(0.56, 2.05, 0.04, -0.285, -1.4, 0.94, doorS, C); box(0.56, 2.05, 0.04, 0.285, -1.4, 0.94, doorS, C);
    // car top balustrade (back + left side)
    for (const x of [-0.97, -0.3, 0.4, 0.97]) cyl(0.017, 1.08, x, 0.55, -0.88, steel, C, 10);
    cyl(0.02, 1.94, 0, 1.08, -0.88, steel, C, 10, "x"); cyl(0.014, 1.94, 0, 0.62, -0.88, steel, C, 10, "x");
    cyl(0.017, 1.08, -0.97, 0.55, 0.0, steel, C, 10); cyl(0.02, 0.88, -0.97, 1.08, -0.44, steel, C, 10, "z");
    box(1.94, 0.1, 0.012, 0, 0.07, -0.89, steel, C); // toe board
    // stiles + crosshead (structure)
    for (const s of [-1, 1]) box(0.09, 3.3, 0.14, s * 1.08, -1.05, 0, struct, C);
    box(2.25, 0.18, 0.13, 0, 0.47, 0, struct, C);
    box(0.36, 0.2, 0.16, 0, 0.66, 0, steel, C);                                    // rope hitch plate
    for (let i = 0; i < 4; i++) cyl(0.016, 0.22, -0.075 + i * 0.05, 0.86, 0, steel, C, 10); // rope sockets
    // safety gear: housing cheeks (open front), wedges (green), on both rails at crosshead level
    for (const s of [-1, 1]) {
      const hx = s * 1.2;
      box(0.2, 0.06, 0.2, hx, 0.62, 0, housing, C); box(0.2, 0.06, 0.2, hx, 0.22, 0, housing, C);
      box(0.2, 0.46, 0.03, hx, 0.42, -0.1, housing, C);
      box(0.03, 0.46, 0.2, s * 1.11, 0.42, 0, housing, C);
      dashedBox(0.2, 0.46, 0.2, new THREE.Vector3(hx, 0.42, 0), hidden, this.xrayGroup, 0.012, 0.04, 0.028);
      for (const sz of [-1, 1]) {
        const jm = M({ kind: KIND.metal, albedo: 0.75, angle: 90, spot: SPOT.green, spotAmt: 1, glow: 0.0, shininess: 60, spec: 0.4, xrole: XROLE.hero });
        // tapered wedge: thick (z) at the bottom, thin at the top; flat face toward the blade
        const g = new THREE.BoxGeometry(0.12, 0.3, 0.07);
        const pa = g.attributes.position;
        for (let i = 0; i < pa.count; i++) if (pa.getY(i) > 0 && pa.getZ(i) > 0) pa.setZ(i, pa.getZ(i) - 0.035);
        g.translate(0, 0, 0.035); g.computeVertexNormals();
        const j = new THREE.Mesh(g, jm);
        if (sz < 0) j.rotation.y = Math.PI;
        j.position.set(s * (BLADE_IN + 0.045), 0.4, sz * 0.012);
        j.userData = { sz, s };
        j.castShadow = true; C.add(j); this.jaws.push(j); this.jawMats.push(jm);
      }
    }
    // synchronising shaft + trip lever (left) on the crosshead, linked to the governor rope
    cyl(0.016, 2.3, 0, 0.6, 0.13, steel, C, 10, "x");
    this.lever = new THREE.Group(); this.lever.position.set(-1.0, 0.6, 0.2); C.add(this.lever);
    box(0.04, 0.3, 0.03, 0, 0.13, 0, struct, this.lever);
    box(0.16, 0.03, 0.03, -0.07, 0.28, 0, struct, this.lever);
    // car-top furniture: inspection station, toolbox, work lamp on a post, red beacon
    box(0.3, 0.22, 0.15, 0.62, 0.14, -0.7, door, C);
    cyl(0.03, 0.02, 0.56, 0.17, -0.62, this.beaconMat, C, 14, "z");
    box(0.5, 0.18, 0.22, -0.6, 0.11, -0.58, dark, C); box(0.38, 0.03, 0.03, -0.6, 0.26, -0.58, steel, C);
    cyl(0.018, 1.2, -0.52, 0.6, 0.82, steel, C, 10);
    const lampHead = new THREE.Group(); lampHead.position.set(-0.52, 1.25, 0.82); C.add(lampHead);
    const lh = cyl(0.075, 0.14, 0, 0, 0, dark, lampHead, 16, "z"); lh.rotation.set(Math.PI / 2 + 0.6, 0, -0.5);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.064, 20), lampLens); lens.position.set(0.04, -0.045, -0.05); lens.lookAt(new THREE.Vector3(0.6, 0.0, -0.6).add(lampHead.position).setY(-1)); lampHead.add(lens);
    const bc = cyl(0.06, 0.06, 0.55, 0.59, -0.15, dark, C, 14);
    void bc;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.065, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), this.beaconMat); dome.position.set(0.55, 0.62, -0.15); C.add(dome);
    // dashed hidden lines of the car shell (x-ray only)
    dashedBox(2.0, 2.55, 1.85, new THREE.Vector3(0, -1.3, 0), hidden, this.xrayGroup, 0.02, 0.11, 0.07);
    C.add(this.xrayGroup);
    // force arrows (x-ray / danger): gravity on the car (red), clamping force (green)
    const red = M({ kind: KIND.plain, albedo: 0.9, spot: SPOT.red, spotAmt: 1, glow: 0.25, hatchK: 0.3 });
    const grn = M({ kind: KIND.plain, albedo: 0.9, spot: SPOT.green, spotAmt: 1, glow: 0.25, hatchK: 0.3 });
    const a1 = arrowMesh(0.95, 0.34, red); a1.position.set(0.12, -0.08, 0.75); this.arrows.add(a1);
    for (const s of [-1, 1]) { const a = arrowMesh(0.22, 0.12, grn); a.rotation.z = s * Math.PI / 2; a.position.set(s * 0.98, 0.42, 0.14); this.arrows.add(a); }
    const a2 = arrowMesh(0.6, 0.2, red); a2.rotation.z = Math.PI; a2.position.set(0.0, 1.35, 0.25); this.arrows.add(a2);
    C.add(this.arrows);
    // ropes (rebuilt per frame)
    for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.BufferGeometry(), this.ropeMat); m.castShadow = true; S.add(m); this.ropes.push(m); }
    for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.BufferGeometry(), this.ropeMat); m.castShadow = true; S.add(m); this.ropeUp.push(m); }
    // sparks (red / green) as thin solid-ink-free bright streaks
    const sparkM = M({ kind: KIND.plain, albedo: 1, spot: SPOT.red, spotAmt: 1, glow: 1.0, hatchK: 0 });
    for (let i = 0; i < 14; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.09, 0.012), sparkM); this.sparks.add(sp); }
    S.add(this.sparks);
    // figure
    C.add(this.fig.root); C.add(this.fig.shadow);
    // ---------------- lights
    S.add(new THREE.AmbientLight(0x9aa6c4, 0.75));
    const hemi = new THREE.HemisphereLight(0xb8c4e0, 0x302820, 0.4); S.add(hemi);
    const bounce = new THREE.DirectionalLight(0xd0dcf4, 0.9); bounce.position.set(2.5, 1.2, 2.0); S.add(bounce); // bounce off the lit right wall
    this.work = new THREE.SpotLight(0xfff0d8, 14.0, 12, 0.95, 0.55, 1.6);
    this.work.castShadow = true; this.work.shadow.mapSize.set(1024, 1024); this.work.shadow.bias = -0.0008; this.work.shadow.normalBias = 0.02;
    this.work.shadow.camera.near = 0.2; this.work.shadow.camera.far = 10;
    this.work.position.set(-0.48, 1.2, 0.78); C.add(this.work); C.add(this.work.target); this.work.target.position.set(0.55, 0.55, -1.25);
    this.landing = new THREE.SpotLight(0xdde6ff, 5.0, 8, 0.7, 0.8, 1.6);
    this.landing.position.set(0, 2.4, -1.15); this.landing.target.position.set(0.1, -0.5, 0.8); S.add(this.landing); S.add(this.landing.target);
    this.head = new THREE.SpotLight(0xfff6e6, 6.0, 7, 0.32, 0.5, 1.5);
    S.add(this.head); S.add(this.head.target);
    this.beacon = new THREE.PointLight(0xff2a1a, 0, 2.6, 1.6); this.beacon.position.set(0.55, 0.75, -0.1); C.add(this.beacon);
  }

  private rope(m: THREE.Mesh, pts: THREE.Vector3[]) {
    m.geometry.dispose();
    const curve = new THREE.CatmullRomCurve3(pts);
    m.geometry = new THREE.TubeGeometry(curve, Math.max(8, pts.length * 6), 0.011, 8, false);
  }

  update(ws: WorldState, camPos: THREE.Vector3) {
    U.uXr.value = ws.xr;
    this.car.position.y = -ws.drop;
    this.xrayGroup.visible = ws.xr > 0.5;
    this.arrows.visible = ws.arrows > 0.01;
    // jaws: wedges ride up the tapered housing and close on the blade
    for (const j of this.jaws) {
      const { s } = j.userData as { s: number };
      j.position.y = 0.40 + 0.07 * ws.jaw;
      j.position.x = s * (BLADE_IN + 0.04 - 0.012 * ws.jaw);
    }
    for (const m of this.jawMats) setU(m, "uGlow", ws.jawGlow);
    this.lever.rotation.z = -0.9 * ws.jaw;
    // beacon
    setU(this.beaconMat, "uGlow", 0.15 + 0.85 * ws.alarm);
    this.beacon.intensity = 2.2 * ws.alarm;
    this.work.intensity = 14.0 * ws.lampOn;
    // ropes: 4 strands from the hitch up into the dark; after the snap the lower ends go slack
    const topY = 14, hitchY = 0.97 - ws.drop, breakY = 3.6;
    for (let i = 0; i < 4; i++) {
      const x = -0.075 + i * 0.05;
      const shv = ws.ropeShiver * Math.sin(ws.t * 47 + i * 1.7);
      if (ws.snap < 0) {
        this.rope(this.ropes[i], [new THREE.Vector3(x, hitchY, 0), new THREE.Vector3(x + shv, (hitchY + topY) / 2, shv * 0.5), new THREE.Vector3(x, topY, 0)]);
        this.ropeUp[i].visible = false;
      } else {
        const k = Math.min(1, ws.snap / 0.5);
        const sag = 0.9 * k;
        // lower piece: from hitch up to the broken end which falls & whips
        const endY = breakY - ws.drop * 0.6 - 1.4 * k * k;
        const whip = (i % 2 ? 1 : -1) * (0.15 + 0.35 * k) * (1 + i * 0.15);
        this.rope(this.ropes[i], [new THREE.Vector3(x, hitchY, 0), new THREE.Vector3(x + whip * 0.3, hitchY + 0.6, 0.1 * sag), new THREE.Vector3(x + whip * 0.8, (hitchY + endY) / 2 + 0.3, 0.25 * sag), new THREE.Vector3(x + whip, endY, 0.15 * sag)]);
        // upper piece recoils up
        const upY = breakY + 0.25 + 2.2 * k;
        this.ropeUp[i].visible = true;
        this.rope(this.ropeUp[i], [new THREE.Vector3(x - whip * 0.6, upY, 0.1), new THREE.Vector3(x - whip * 0.2, upY + 1.5, 0), new THREE.Vector3(x, topY, 0)]);
      }
    }
    // sparks at the break (red) for 0.4 s
    this.sparks.visible = ws.snap >= 0 && ws.snap < 0.45;
    this.sparks.children.forEach((sp, i) => {
      const a = (i / 14) * Math.PI * 2 + 0.3; const r = 0.15 + ws.snap * 2.4 * (0.6 + (i % 3) * 0.25);
      sp.position.set(Math.cos(a) * r, 3.7 + Math.sin(a) * r * 0.8 - ws.snap * ws.snap * 3, 0.1);
      sp.rotation.z = a + Math.PI / 2; sp.scale.setScalar(Math.max(0.01, 1 - ws.snap * 2));
    });
    // figure placement + headlamp
    this.fig.place(this.figPos.x, 0, this.figPos.z, camPos.clone().setY(camPos.y + ws.drop), this.work.position);
    this.car.updateMatrixWorld(true);
    const lp = new THREE.Vector3(); this.fig.lampAnchor.getWorldPosition(lp);
    this.head.position.copy(lp); this.head.target.position.copy(ws.headAim); this.head.target.updateMatrixWorld();
    const f = this.fig.feet(); U.uFeet.value[0].copy(f[0]); U.uFeet.value[1].copy(f[1]);
  }
}
