// "TECH 07" — the recurring person at risk, built as a ball-jointed designer collectible.
// Proportions: 1.63 m with helmet = 4.0 helmet-heads (4.6 bare heads). Chunky torso, short limbs, mitten hands.
// Rig: plain joint hierarchy (no skinning): hips > spine > neck > head, shoulders > elbows > wrists, hips > knees > ankles.
// Face: inset eyeballs with separate rigid lids, brow pieces, swappable sculpted mouths (calm / alarm / relief).
import * as THREE from "three";
import { sculpt, sculptPoint, SculptOpts, rbox, extrude, tube, merge } from "./sculpt";
import { vinyl, envMat } from "./materials";
import { PAINT } from "./palette";
import { mesh } from "./registry";
import { stencil, brushed } from "./paint";

export type JointName =
  | "hips" | "spine" | "neck" | "head"
  | "shoulderL" | "elbowL" | "wristL" | "shoulderR" | "elbowR" | "wristR"
  | "hipL" | "kneeL" | "ankleL" | "hipR" | "kneeR" | "ankleR";

export type Pose = Partial<Record<JointName, [number, number, number]>> & { lift?: number; sway?: number };
export type MouthId = "calm" | "alarm" | "relief";
export type Expr = { lidU: number; lidL: number; browY: number; browTilt: number; mouth: MouthId; gazeX: number; gazeY: number; open?: number };

export const EXPR: Record<"calm" | "alarm" | "relief", Expr> = {
  calm: { lidU: -0.32, lidL: 0.55, browY: 0, browTilt: 0.06, mouth: "calm", gazeX: 0, gazeY: 0 },
  alarm: { lidU: -1.0, lidL: 1.0, browY: 0.016, browTilt: -0.38, mouth: "alarm", gazeX: 0, gazeY: 0.12 },
  relief: { lidU: 0.42, lidL: -0.12, browY: 0.008, browTilt: -0.16, mouth: "relief", gazeX: 0, gazeY: 0.05 },
};

const D = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).normalize();
const gauss = (d: THREE.Vector3, c: THREE.Vector3, w: number) => Math.exp(-Math.pow(d.angleTo(c) / w, 2));

// Raised band that follows a sculpt's surface between two heights (stripes, belts, cuffs).
function band(o: SculptOpts, y0: number, y1: number, inflate: number, seg = 48, rows = 4) {
  const pos: number[] = [], idx: number[] = [], uv: number[] = [];
  const d = new THREE.Vector3(), p = new THREE.Vector3();
  const findDir = (phi: number, y: number) => {
    let lo = 0.02, hi = Math.PI - 0.02;
    for (let i = 0; i < 28; i++) {
      const th = (lo + hi) / 2;
      d.set(Math.sin(th) * Math.sin(phi), Math.cos(th), Math.sin(th) * Math.cos(phi));
      sculptPoint(d, o, p);
      if (p.y > y) lo = th; else hi = th;
    }
    return d.clone();
  };
  for (let r = 0; r <= rows; r++) {
    const y = THREE.MathUtils.lerp(y0, y1, r / rows);
    for (let s = 0; s <= seg; s++) {
      const phi = (s / seg) * Math.PI * 2;
      const dd = findDir(phi, y);
      sculptPoint(dd, { ...o, inflate: (o.inflate ?? 0) + inflate * (r === 0 || r === rows ? 0.55 : 1) }, p);
      pos.push(p.x, p.y, p.z); uv.push(s / seg, r / rows);
    }
  }
  for (let r = 0; r < rows; r++) for (let s = 0; s < seg; s++) {
    const a = r * (seg + 1) + s, b = a + 1, c = a + seg + 1, e = c + 1;
    idx.push(a, c, b, b, c, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export type Figure = {
  root: THREE.Group;
  j: Record<JointName, THREE.Group>;
  rest: Record<JointName, THREE.Vector3>;
  face: {
    eyes: THREE.Group[]; lidsU: THREE.Object3D[]; lidsL: THREE.Object3D[]; brows: THREE.Group[];
    mouths: Record<MouthId, THREE.Group>;
  };
  soles: THREE.Object3D[];
  headlamp: THREE.Object3D; // lens anchor, faces +z of the head
  headCenter: THREE.Object3D;
};

export function buildFigure(): Figure {
  // ------------------------------------------------------------------ materials
  const M = {
    jacket: vinyl(PAINT.jacket, { sss: "#ff7a10", sssK: 0.05, rough: 0.7, sheen: 0.0, edge: 0.18 }),
    reflect: Object.assign(vinyl(PAINT.reflective, { rough: 0.3, sheen: 0.3, edge: 0.15, clear: 0.5, sss: "#000000", sssK: 0 }), { emissive: new THREE.Color(0.32, 0.34, 0.36) }),
    pants: vinyl(PAINT.pants, { rough: 0.75, sheen: 0.5, sss: "#2a3550", sssK: 0.1 }),
    joint: vinyl(PAINT.joint, { rough: 0.38, clear: 0.5, edge: 0.1, sss: "#000000", sssK: 0 }),
    glove: vinyl(PAINT.glove, { rough: 0.7, sheen: 0.4, sss: "#000000", sssK: 0 }),
    boot: vinyl(PAINT.boot, { rough: 0.5, clear: 0.25, sss: "#5a2a10", sssK: 0.15 }),
    sole: vinyl(PAINT.sole, { rough: 0.8, sss: "#000000", sssK: 0 }),
    leather: vinyl(PAINT.leather, { rough: 0.55, clear: 0.2, sss: "#40200a", sssK: 0.1 }),
    skin: vinyl(PAINT.skin, { sss: "#ff3a1a", sssK: 0.3, rough: 0.55, edge: 0.18 }),
    hair: vinyl(PAINT.hair, { rough: 0.7, sheen: 0.4, sss: "#000000", sssK: 0 }),
    helmet: vinyl(PAINT.helmet, { rough: 0.3, clear: 0.6, sss: "#ffcf9a", sssK: 0.15, edge: 0.2 }),
    eye: new THREE.MeshPhysicalMaterial({ color: PAINT.eyeWhite, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05 }),
    iris: new THREE.MeshPhysicalMaterial({ color: PAINT.iris, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.03 }),
    pupil: new THREE.MeshPhysicalMaterial({ color: "#0d0a09", roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.02 }),
    mouth: vinyl(PAINT.mouth, { rough: 0.5, sss: "#000000", sssK: 0, edge: 0 }),
    teeth: vinyl(PAINT.teeth, { rough: 0.35, clear: 0.3, sss: "#000000", sssK: 0 }),
    tongue: vinyl(PAINT.tongue, { rough: 0.45, sss: "#ff2010", sssK: 0.3 }),
    metal: envMat({ color: "#B9BEC4", metalness: 1, roughness: 0.3, roughnessMap: brushed("brushFig", 4) }),
    black: vinyl("#1d1f22", { rough: 0.45, clear: 0.3, sss: "#000000", sssK: 0 }),
    wood: vinyl("#9a6a3c", { rough: 0.6, sss: "#000000", sssK: 0 }),
    badge: new THREE.MeshStandardMaterial({ map: stencil("badge07", ["TECH", "07"], { w: 256, h: 256, color: "#1d2733", bg: "#EDEAE2", size: 92 }), roughness: 0.4 }),
    helmetDecal: new THREE.MeshStandardMaterial({ map: stencil("helm07", ["07"], { w: 256, h: 192, color: "#1F2A38", size: 150 }), transparent: true, roughness: 0.35, polygonOffset: true, polygonOffsetFactor: -2 }),
  };

  const J = {} as Record<JointName, THREE.Group>;
  const rest = {} as Record<JointName, THREE.Vector3>;
  const root = new THREE.Group();
  root.name = "figure";
  const joint = (name: JointName, parent: THREE.Object3D, x: number, y: number, z: number) => {
    const g = new THREE.Group(); g.name = name; g.position.set(x, y, z); parent.add(g); J[name] = g; rest[name] = g.position.clone(); return g;
  };
  const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, role: "fig" | "joint" | "decal" | "emit" | "armature", x = 0, y = 0, z = 0, contours?: number[]) => {
    const m = mesh(geo, mat, { role, edges: role === "fig" ? 38 : 0, hull: role !== "decal" && role !== "armature", contours });
    m.position.set(x, y, z); parent.add(m); return m;
  };
  const ball = (parent: THREE.Object3D, r: number) => add(parent, sculpt({ r: [r, r, r], seg: [24, 16] }), M.joint, "joint");
  const rod = (parent: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3, r = 0.009) => {
    const g = tube([from, to], r, 2, 8);
    const m = mesh(g, M.metal, { role: "armature" }, false, false);
    m.visible = false; parent.add(m); return m;
  };

  // ------------------------------------------------------------------ hips / pelvis / tool belt
  const hips = joint("hips", root, 0, 0.74, 0);
  const pelvisO: SculptOpts = { r: [0.175, 0.09, 0.122], e1: 0.55, e2: 0.7, taperBot: 0.9, seg: [36, 20] };
  add(hips, sculpt(pelvisO), M.pants, "fig", 0, 0, 0, [-0.03, 0.03]);
  const beltO: SculptOpts = { r: [0.172, 0.04, 0.124], e1: 0.25, e2: 0.7, seg: [40, 10] };
  const belt = add(hips, sculpt(beltO), M.leather, "fig", 0, 0.066, 0);
  void belt;
  add(hips, rbox(0.075, 0.055, 0.02, 0.008), M.metal, "fig", 0, 0.066, 0.124); // buckle
  add(hips, rbox(0.045, 0.03, 0.022, 0.006), M.leather, "fig", 0, 0.066, 0.128);
  // pouches (rounded leather boxes with flaps), tape measure, hammer on loop
  for (const s of [-1, 1]) {
    const pouch = new THREE.Group(); pouch.position.set(s * 0.165, 0.02, 0.055); pouch.rotation.y = s * 0.5; hips.add(pouch);
    add(pouch, rbox(0.06, 0.1, 0.075, 0.018), M.leather, "fig");
    add(pouch, rbox(0.066, 0.035, 0.08, 0.012), M.leather, "fig", 0, 0.045, 0.002);
    add(pouch, rbox(0.012, 0.012, 0.012, 0.004), M.metal, "fig", s * 0.0, 0.035, 0.043);
  }
  const tape = new THREE.Group(); tape.position.set(-0.13, 0.04, -0.09); tape.rotation.y = -0.9; hips.add(tape);
  add(tape, rbox(0.07, 0.07, 0.035, 0.016), M.black, "fig");
  add(tape, new THREE.CylinderGeometry(0.02, 0.02, 0.038, 20).rotateX(Math.PI / 2), M.metal, "fig");
  const hammer = new THREE.Group(); hammer.position.set(0.17, 0.0, -0.06); hammer.rotation.set(0.15, 0.4, 0.12); hips.add(hammer);
  add(hammer, new THREE.CylinderGeometry(0.011, 0.013, 0.24, 12), M.wood, "fig", 0, -0.07, 0);
  add(hammer, rbox(0.03, 0.03, 0.11, 0.006), M.metal, "fig", 0, 0.06, 0.01);

  // ------------------------------------------------------------------ spine / jacket
  const spine = joint("spine", hips, 0, 0.075, 0);
  const torsoO: SculptOpts = { r: [0.205, 0.205, 0.138], e1: 0.52, e2: 0.72, taperBot: 0.86, taperTop: 1.0, taperTopZ: 0.92, bulge: 0.012, seg: [48, 32] };
  const torsoY = 0.19;
  add(spine, sculpt(torsoO), M.jacket, "fig", 0, torsoY, 0, [-0.12, -0.04, 0.04, 0.12]);
  // raised retro-reflective stripes (follow the jacket surface)
  for (const yb of [-0.075, 0.035]) add(spine, band(torsoO, yb - 0.022, yb + 0.022, 0.006), M.reflect, "fig", 0, torsoY, 0);
  // collar
  const collar = add(spine, new THREE.TorusGeometry(0.088, 0.03, 14, 40), M.jacket, "fig", 0, 0.385, -0.004);
  collar.rotation.x = Math.PI / 2 - 0.18; collar.scale.set(1.08, 1.0, 0.85);
  // zipper placket + pull
  add(spine, rbox(0.03, 0.34, 0.02, 0.008), M.jacket, "fig", 0, 0.17, 0.142);
  add(spine, rbox(0.007, 0.32, 0.008, 0.003), M.black, "fig", 0, 0.17, 0.153);
  add(spine, rbox(0.016, 0.03, 0.008, 0.004), M.metal, "fig", 0, 0.31, 0.158);
  // chest pocket flap with pen + ID badge
  add(spine, rbox(0.085, 0.032, 0.025, 0.008), M.jacket, "fig", -0.1, 0.27, 0.132).rotation.y = -0.25;
  add(spine, new THREE.CylinderGeometry(0.006, 0.006, 0.07, 10), M.black, "fig", -0.12, 0.29, 0.132);
  const badge = add(spine, rbox(0.07, 0.07, 0.008, 0.006), M.badge, "decal", 0.098, 0.24, 0.142);
  badge.rotation.y = 0.28;

  // ------------------------------------------------------------------ neck / head
  const neck = joint("neck", spine, 0, 0.38, -0.01);
  ball(neck, 0.05).position.y = 0.012;
  const head = joint("head", neck, 0, 0.035, 0);
  const hc = new THREE.Group(); hc.position.set(0, 0.17, 0.008); head.add(hc);

  const EYE_D = [D(0.36, 0.02, 0.93), D(-0.36, 0.02, 0.93)];
  const skullO: SculptOpts = {
    r: [0.158, 0.172, 0.162], e1: 0.82, e2: 0.86, taperBot: 0.94, taperBotZ: 1.0, seg: [64, 48],
    disp: (d) => {
      let v = 0;
      for (const e of EYE_D) v -= 0.02 * gauss(d, e, 0.2);
      v += 0.009 * (gauss(d, D(0.5, -0.28, 0.82), 0.3) + gauss(d, D(-0.5, -0.28, 0.82), 0.3)); // cheeks
      v += 0.006 * gauss(d, D(0, 0.3, 0.95), 0.45) * (1 - gauss(d, D(0, 0.06, 1), 0.18)); // brow ridge
      v += 0.01 * gauss(d, D(0, -0.78, 0.62), 0.28); // chin
      v -= 0.006 * gauss(d, D(0, -0.35, 0.94), 0.12); // philtrum hollow under the nose
      return v;
    },
  };
  const skull = add(hc, sculpt(skullO), M.skin, "fig", 0, 0, 0, [-0.08, 0, 0.08]);
  void skull;
  const onSkull = (d: THREE.Vector3, out = 0) => sculptPoint(d, skullO).addScaledVector(d, out);
  // ears + sideburns + hair at the nape
  for (const s of [-1, 1]) {
    const ear = add(hc, sculpt({ r: [0.018, 0.04, 0.03], e1: 0.8, e2: 0.9, seg: [16, 12] }), M.skin, "fig");
    ear.position.copy(onSkull(D(s, 0.02, -0.05), -0.004)); ear.rotation.y = s * 0.2;
    const sb = add(hc, sculpt({ r: [0.012, 0.035, 0.022], e1: 0.6, seg: [12, 10] }), M.hair, "fig");
    sb.position.copy(onSkull(D(s * 0.97, 0.12, 0.22), -0.004));
  }
  const nape = add(hc, sculpt({ r: [0.14, 0.05, 0.06], e1: 0.7, seg: [24, 12] }), M.hair, "fig");
  nape.position.copy(onSkull(D(0, 0.15, -1), -0.03));
  // nose
  const nose = add(hc, sculpt({ r: [0.026, 0.028, 0.026], e1: 0.9, taperTop: 0.7, seg: [20, 14] }), M.skin, "fig");
  nose.position.copy(onSkull(D(0, -0.12, 1), -0.004));
  // moustache: two chunky sculpted lobes (signature silhouette detail)
  for (const s of [-1, 1]) {
    const mu = add(hc, sculpt({ r: [0.04, 0.016, 0.02], e1: 0.7, e2: 0.8, taperTop: 0.8, seg: [20, 12] }), M.hair, "fig");
    mu.position.copy(onSkull(D(s * 0.18, -0.3, 0.94), 0.004));
    mu.rotation.set(0, s * 0.35, s * -0.32);
  }
  // eyes: eyeball + iris cap + pupil cap, lids are separate rigid shells
  const eyes: THREE.Group[] = [], lidsU: THREE.Object3D[] = [], lidsL: THREE.Object3D[] = [], brows: THREE.Group[] = [];
  const ER = 0.031;
  for (const e of EYE_D) {
    const socket = new THREE.Group();
    socket.position.copy(onSkull(e, -0.0)).addScaledVector(e, -ER * 0.62);
    socket.lookAt(socket.position.clone().add(new THREE.Vector3(e.x * 0.35, 0, 1)));
    hc.add(socket);
    const eye = new THREE.Group(); socket.add(eye); eyes.push(eye);
    add(eye, new THREE.SphereGeometry(ER, 32, 20), M.eye, "joint");
    const iris = add(eye, new THREE.SphereGeometry(ER * 1.006, 32, 8, 0, Math.PI * 2, 0, 0.58), M.iris, "joint"); iris.rotation.x = Math.PI / 2;
    const pupil = add(eye, new THREE.SphereGeometry(ER * 1.012, 24, 6, 0, Math.PI * 2, 0, 0.3), M.pupil, "joint"); pupil.rotation.x = Math.PI / 2;
    const lu = new THREE.Group(); socket.add(lu); lidsU.push(lu);
    add(lu, new THREE.SphereGeometry(ER * 1.16, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.skin, "fig");
    add(lu, new THREE.TorusGeometry(ER * 1.15, 0.0042, 8, 32).rotateX(Math.PI / 2), M.hair, "fig"); // lash line
    const ll = new THREE.Group(); socket.add(ll); lidsL.push(ll);
    add(ll, new THREE.SphereGeometry(ER * 1.12, 32, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.skin, "fig");
    // brow piece
    const bp = new THREE.Group();
    const s = Math.sign(e.x);
    bp.position.copy(onSkull(D(e.x * 1.05, 0.36, 0.9), 0.006));
    bp.rotation.y = s * 0.32;
    hc.add(bp); brows.push(bp);
    const browMesh = add(bp, sculpt({ r: [0.036, 0.011, 0.012], e1: 0.55, e2: 0.8, taperTop: 0.9, seg: [20, 10] }), M.hair, "fig");
    browMesh.rotation.z = s * -0.08;
  }
  // mouths (sculpted shapes, swapped per expression)
  const mouthAnchor = new THREE.Group();
  const md = D(0, -0.44, 0.9);
  mouthAnchor.position.copy(onSkull(md, -0.006));
  mouthAnchor.lookAt(mouthAnchor.position.clone().add(md));
  hc.add(mouthAnchor);
  const mouths = {} as Record<MouthId, THREE.Group>;
  {
    // calm: closed crescent smile
    const g = new THREE.Group(); mouthAnchor.add(g); mouths.calm = g;
    const s = new THREE.Shape();
    s.moveTo(-0.034, 0.006); s.quadraticCurveTo(0, -0.026, 0.034, 0.006); s.quadraticCurveTo(0.036, 0.0, 0.031, -0.0); s.quadraticCurveTo(0, -0.016, -0.031, -0.0); s.quadraticCurveTo(-0.036, 0.0, -0.034, 0.006);
    add(g, extrude(s, 0.012, 0.0025), M.mouth, "fig");
    // alarm: open oval with upper teeth + tongue
    const a = new THREE.Group(); mouthAnchor.add(a); mouths.alarm = a;
    const so = new THREE.Shape(); so.absellipse(0, -0.012, 0.024, 0.03, 0, Math.PI * 2, false, 0);
    add(a, extrude(so, 0.012, 0.003), M.mouth, "fig");
    add(a, rbox(0.03, 0.009, 0.01, 0.003), M.teeth, "fig", 0, 0.008, 0.005);
    add(a, sculpt({ r: [0.017, 0.008, 0.01], seg: [16, 8] }), M.tongue, "fig", 0, -0.032, 0.006);
    // relief: wide open D grin, teeth + tongue
    const r = new THREE.Group(); mouthAnchor.add(r); mouths.relief = r;
    const sr = new THREE.Shape();
    sr.moveTo(-0.04, 0.008); sr.quadraticCurveTo(0, 0.0, 0.04, 0.008); sr.quadraticCurveTo(0.036, -0.034, 0, -0.038); sr.quadraticCurveTo(-0.036, -0.034, -0.04, 0.008);
    add(r, extrude(sr, 0.012, 0.003), M.mouth, "fig");
    add(r, rbox(0.058, 0.01, 0.01, 0.004), M.teeth, "fig", 0, 0.0, 0.006);
    add(r, sculpt({ r: [0.02, 0.008, 0.01], seg: [16, 8] }), M.tongue, "fig", 0, -0.026, 0.006);
  }

  // helmet: crowned shell, brim, ridge, strap, headlamp
  const helm = new THREE.Group(); helm.position.set(0, 0.03, -0.004); hc.add(helm);
  const shellO: SculptOpts = { r: [0.18, 0.165, 0.19], e1: 0.72, e2: 0.92, seg: [56, 28], theta: [0, Math.PI / 2 + 0.02] };
  add(helm, sculpt(shellO), M.helmet, "fig", 0, 0, 0, [0.06, 0.12]);
  const brimS = new THREE.Shape(); brimS.absellipse(0, 0, 0.198, 0.212, 0, Math.PI * 2, false, 0);
  const brimHole = new THREE.Path(); brimHole.absellipse(0, 0.0, 0.17, 0.18, 0, Math.PI * 2, true, 0); brimS.holes.push(brimHole);
  const brim = add(helm, extrude(brimS, 0.016, 0.006, 2, 40), M.helmet, "fig");
  brim.rotation.x = -Math.PI / 2; brim.position.set(0, -0.004, 0.0); brim.scale.set(1, 1.08, 1);
  const peak = add(helm, sculpt({ r: [0.12, 0.012, 0.07], e1: 0.4, e2: 1, seg: [32, 10] }), M.helmet, "fig", 0, 0.004, 0.19);
  peak.rotation.x = 0.12;
  add(helm, sculpt({ r: [0.022, 0.03, 0.175], e1: 0.6, e2: 0.6, seg: [16, 20], theta: [0, Math.PI / 2] }), M.helmet, "fig", 0, 0.142, 0);
  const strap = add(helm, new THREE.TorusGeometry(0.183, 0.008, 8, 64).rotateX(Math.PI / 2), M.black, "fig", 0, 0.032, 0);
  strap.scale.set(1.0, 1.0, 1.045);
  for (const s of [-1, 1]) {
    const dec = mesh(new THREE.PlaneGeometry(0.08, 0.06), M.helmetDecal, { role: "decal" }, false, true);
    dec.position.set(s * 0.17, 0.075, 0.0); dec.rotation.set(0, s * Math.PI / 2, s * 0.12); helm.add(dec);
  }
  const lamp = new THREE.Group(); lamp.position.set(0, 0.06, 0.188); lamp.rotation.x = -0.12; helm.add(lamp);
  add(lamp, rbox(0.075, 0.05, 0.04, 0.012), M.black, "fig");
  add(lamp, new THREE.CylinderGeometry(0.023, 0.025, 0.012, 24).rotateX(Math.PI / 2), M.metal, "fig", 0, 0, 0.022);
  const lens = add(lamp, new THREE.CircleGeometry(0.019, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 3.4, 3.8) }), "emit", 0, 0, 0.0285);
  const headlamp = new THREE.Group(); headlamp.position.set(0, 0, 0.03); lamp.add(headlamp);
  void lens;

  // ------------------------------------------------------------------ arms
  for (const side of ["L", "R"] as const) {
    const s = side === "L" ? 1 : -1;
    const sh = joint(`shoulder${side}`, spine, s * 0.222, 0.335, -0.005);
    ball(sh, 0.062);
    const upO: SculptOpts = { r: [0.066, 0.115, 0.07], e1: 0.7, e2: 0.85, taperBot: 0.86, seg: [28, 20] };
    add(sh, sculpt(upO), M.jacket, "fig", 0, -0.13, 0, [-0.05, 0.05]);
    add(sh, band(upO, -0.03, 0.005, 0.005, 32, 2), M.reflect, "fig", 0, -0.13, 0);
    const el = joint(`elbow${side}`, sh, 0, -0.25, 0);
    ball(el, 0.046);
    const foO: SculptOpts = { r: [0.06, 0.1, 0.062], e1: 0.7, e2: 0.85, taperBot: 0.82, seg: [28, 20] };
    add(el, sculpt(foO), M.jacket, "fig", 0, -0.11, 0, [-0.04, 0.04]);
    add(el, band(foO, -0.1, -0.07, 0.006, 32, 2), M.black, "fig", 0, -0.11, 0); // ribbed cuff
    const wr = joint(`wrist${side}`, el, 0, -0.215, 0);
    ball(wr, 0.031);
    // mitten glove with two sculpted finger grooves + thumb
    const mit = add(wr, sculpt({
      r: [0.044, 0.064, 0.03], e1: 0.62, e2: 0.7, taperBot: 0.92, seg: [28, 24],
      disp: (d) => (d.y < 0.1 ? -0.0035 * (Math.exp(-Math.pow((d.x - 0.3) / 0.07, 2)) + Math.exp(-Math.pow((d.x + 0.3) / 0.07, 2))) * Math.max(0, Math.abs(d.z) - 0.2) : 0),
    }), M.glove, "fig", 0, -0.068, 0.004);
    void mit;
    const th = add(wr, sculpt({ r: [0.016, 0.035, 0.017], e1: 0.8, seg: [14, 12] }), M.glove, "fig", -s * 0.035, -0.05, 0.02);
    th.rotation.set(0.35, 0, s * 0.55);
    add(wr, band({ r: [0.044, 0.064, 0.03], e1: 0.62, e2: 0.7, taperBot: 0.92 }, 0.035, 0.06, 0.004, 28, 2), M.glove, "fig", 0, -0.068, 0.004);
    rod(sh, new THREE.Vector3(), new THREE.Vector3(0, -0.25, 0));
    rod(el, new THREE.Vector3(), new THREE.Vector3(0, -0.215, 0));
  }
  rod(spine, new THREE.Vector3(0, -0.075, 0), new THREE.Vector3(0, 0.395, -0.01), 0.012);
  rod(spine, new THREE.Vector3(-0.222, 0.335, -0.005), new THREE.Vector3(0.222, 0.335, -0.005));

  // ------------------------------------------------------------------ legs
  const soles: THREE.Object3D[] = [];
  for (const side of ["L", "R"] as const) {
    const s = side === "L" ? 1 : -1;
    const hp = joint(`hip${side}`, hips, s * 0.088, -0.05, 0.0);
    ball(hp, 0.058);
    const thO: SculptOpts = { r: [0.086, 0.135, 0.092], e1: 0.72, e2: 0.85, taperBot: 0.85, seg: [28, 20] };
    add(hp, sculpt(thO), M.pants, "fig", 0, -0.135, 0, [-0.06, 0.06]);
    const pk = add(hp, rbox(0.03, 0.1, 0.09, 0.012), M.pants, "fig", s * 0.084, -0.15, 0.0); pk.rotation.z = s * 0.06;
    add(hp, rbox(0.034, 0.025, 0.094, 0.008), M.pants, "fig", s * 0.086, -0.095, 0.0);
    const kn = joint(`knee${side}`, hp, 0, -0.275, 0);
    ball(kn, 0.05);
    add(kn, sculpt({ r: [0.05, 0.06, 0.03], e1: 0.6, e2: 0.7, seg: [20, 14], flatBack: 0.6 }), M.black, "fig", 0, -0.015, 0.045);
    const shO: SculptOpts = { r: [0.074, 0.12, 0.078], e1: 0.72, e2: 0.85, taperBot: 0.84, seg: [28, 20] };
    add(kn, sculpt(shO), M.pants, "fig", 0, -0.135, 0, [-0.06, 0.04]);
    const an = joint(`ankle${side}`, kn, 0, -0.27, 0);
    ball(an, 0.034);
    const bootO: SculptOpts = { r: [0.074, 0.072, 0.14], e1: 0.45, e2: 0.62, taperTop: 0.82, taperTopZ: 0.62, flatBack: 0.1, seg: [36, 24] };
    add(an, sculpt(bootO), M.boot, "fig", 0, -0.072, 0.034, [-0.02]);
    add(an, band({ r: [0.058, 0.04, 0.062], e1: 0.5, e2: 0.7 }, -0.012, 0.012, 0.006, 32, 2), M.boot, "fig", 0, 0.0, 0.0); // cuff roll
    const sole = add(an, sculpt({ r: [0.079, 0.02, 0.146], e1: 0.25, e2: 0.62, seg: [36, 10] }), M.sole, "fig", 0, -0.133, 0.036);
    soles.push(sole);
    for (let k = 0; k < 4; k++) add(an, rbox(0.06, 0.006, 0.008, 0.002), M.black, "fig", 0, -0.04 + k * 0.006, 0.105 - k * 0.012); // laces
    rod(hp, new THREE.Vector3(), new THREE.Vector3(0, -0.275, 0));
    rod(kn, new THREE.Vector3(), new THREE.Vector3(0, -0.27, 0));
  }
  rod(hips, new THREE.Vector3(-0.088, -0.05, 0), new THREE.Vector3(0.088, -0.05, 0));

  void merge;
  return {
    root, j: J, rest,
    face: { eyes, lidsU, lidsL, brows, mouths },
    soles, headlamp, headCenter: hc,
  };
}

// ------------------------------------------------------------------ posing
const tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler();
export function blendPose(a: Pose, b: Pose, t: number): Pose {
  const out: Pose = {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof Pose>;
  for (const k of keys) {
    if (k === "lift" || k === "sway") { (out[k] as number) = THREE.MathUtils.lerp((a[k] as number) ?? 0, (b[k] as number) ?? 0, t); continue; }
    const va = (a[k] as [number, number, number]) ?? [0, 0, 0], vb = (b[k] as [number, number, number]) ?? [0, 0, 0];
    (out[k] as [number, number, number]) = [0, 1, 2].map((i) => THREE.MathUtils.lerp(va[i], vb[i], t)) as [number, number, number];
  }
  return out;
}

export function applyPose(f: Figure, p: Pose) {
  for (const name of Object.keys(f.j) as JointName[]) {
    const r = p[name] ?? [0, 0, 0];
    f.j[name].rotation.set(r[0], r[1], r[2]);
  }
  f.j.hips.position.set(f.rest.hips.x + (p.sway ?? 0), f.rest.hips.y + (p.lift ?? 0), f.rest.hips.z);
  // plant: drop the whole figure so the lowest sole touches y = 0 of the root's parent
  f.root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(f.root.matrixWorld).invert();
  let minY = Infinity;
  const v = new THREE.Vector3();
  for (const s of f.soles) {
    const g = (s as THREE.Mesh).geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox!;
    for (const cx of [bb.min.x, bb.max.x]) for (const cz of [bb.min.z, bb.max.z]) {
      v.set(cx * 0.8, bb.min.y, cz * 0.8).applyMatrix4(s.matrixWorld).applyMatrix4(inv);
      minY = Math.min(minY, v.y + f.j.hips.position.y - f.j.hips.position.y);
    }
  }
  f.j.hips.position.y -= minY;
  void tmpQ; void tmpE;
}

export function applyExpr(f: Figure, e: Expr, blink = 0) {
  const lu = THREE.MathUtils.lerp(e.lidU, 1.45, blink);
  const ll = THREE.MathUtils.lerp(e.lidL, 0.35, blink);
  f.face.lidsU.forEach((l) => (l.rotation.x = lu));
  f.face.lidsL.forEach((l) => (l.rotation.x = ll));
  f.face.eyes.forEach((g) => g.rotation.set(-e.gazeY, e.gazeX, 0));
  f.face.brows.forEach((b, i) => {
    const s = i === 0 ? 1 : -1; // eye 0 is +x (figure's left)
    b.userData.baseY ??= b.position.y;
    b.position.y = b.userData.baseY + e.browY;
    b.rotation.z = s * e.browTilt;
  });
  (Object.keys(f.face.mouths) as MouthId[]).forEach((k) => (f.face.mouths[k].visible = k === e.mouth));
}

// Pose library (radians). Figure faces +z. Positive x-rotation on head = nod down.
export const POSES: Record<string, Pose> = {
  stand: {
    spine: [0.03, 0, 0], neck: [0, 0, 0], head: [-0.05, 0, 0],
    shoulderL: [0.05, 0, 0.14], shoulderR: [0.05, 0, -0.14], elbowL: [-0.25, 0, 0], elbowR: [-0.25, 0, 0],
    wristL: [0, 0, -0.1], wristR: [0, 0, 0.1],
    hipL: [0, 0, 0.04], hipR: [0, 0, -0.04], kneeL: [0.02, 0, 0], kneeR: [0.02, 0, 0], ankleL: [-0.02, 0, -0.04], ankleR: [-0.02, 0, 0.04],
  },
  // hero: weight on right leg, right hand on the rail, looking up at the ropes, left hand on hip
  work: {
    sway: -0.015,
    spine: [-0.04, 0.12, 0.02], neck: [-0.08, 0.06, 0], head: [-0.3, 0.2, 0.06],
    shoulderL: [-0.25, 0.3, 0.5], elbowL: [-1.75, 0.2, 0], wristL: [0.2, 0, 0.3],
    shoulderR: [-0.35, 0.1, -0.95], elbowR: [-0.35, 0, 0], wristR: [0.15, 0, 0.35],
    hipL: [-0.06, 0.12, 0.09], hipR: [0.03, -0.1, -0.05], kneeL: [0.14, 0, 0], kneeR: [0.03, 0, 0],
    ankleL: [-0.08, 0, -0.09], ankleR: [-0.03, 0.08, 0.05],
  },
  face: {
    spine: [0.0, 0.0, 0], neck: [0.0, 0.0, 0], head: [-0.04, 0.0, 0.0],
    shoulderL: [0.05, 0, 0.14], shoulderR: [0.05, 0, -0.14], elbowL: [-0.2, 0, 0], elbowR: [-0.2, 0, 0],
  },
  faceAlarm: {
    lift: -0.03, spine: [0.12, 0, 0], neck: [-0.08, 0, 0], head: [-0.16, 0.0, -0.06],
    shoulderL: [-0.6, 0, 0.75], shoulderR: [-0.6, 0, -0.75], elbowL: [-1.4, 0, 0], elbowR: [-1.4, 0, 0],
  },
  faceRelief: {
    spine: [-0.06, 0, 0], neck: [-0.05, 0, 0], head: [-0.1, 0.0, 0.12],
    shoulderL: [-0.75, 0.2, 0.35], elbowL: [-1.85, -0.3, 0], wristL: [0.3, 0, 0], shoulderR: [0.1, 0, -0.18], elbowR: [-0.25, 0, 0],
  },
  // alarm: crouch, head snaps up, both hands up/out, right hand still grips the rail
  alarm: {
    lift: -0.09,
    spine: [0.22, 0.05, 0], neck: [-0.15, 0, 0], head: [-0.52, 0.12, -0.05],
    shoulderL: [-0.9, 0.2, 1.05], elbowL: [-1.1, -0.3, 0], wristL: [-0.3, 0, 0.3],
    shoulderR: [-0.55, 0.1, -1.05], elbowR: [-0.45, 0, 0], wristR: [0.15, 0, 0.35],
    hipL: [-0.55, 0.12, 0.2], hipR: [-0.45, -0.12, -0.18], kneeL: [0.85, 0, 0], kneeR: [0.75, 0, 0],
    ankleL: [-0.3, 0, -0.2], ankleR: [-0.3, 0, 0.18],
  },
  brace: {
    lift: -0.16,
    spine: [0.38, 0.0, 0], neck: [-0.2, 0, 0], head: [-0.32, 0.0, 0],
    shoulderL: [-0.7, 0.3, 0.9], elbowL: [-0.9, -0.3, 0], wristL: [-0.3, 0, 0.3],
    shoulderR: [-0.5, 0.1, -0.85], elbowR: [-0.75, 0, 0], wristR: [0.15, 0, 0.35],
    hipL: [-0.95, 0.12, 0.25], hipR: [-0.85, -0.12, -0.22], kneeL: [1.45, 0, 0], kneeR: [1.35, 0, 0],
    ankleL: [-0.45, 0, -0.25], ankleR: [-0.45, 0, 0.22],
  },
  relief: {
    lift: -0.02,
    spine: [-0.08, 0.1, 0.0], neck: [-0.05, 0, 0], head: [-0.2, 0.15, 0.12],
    shoulderL: [-0.75, 0.35, 0.22], elbowL: [-1.95, -0.2, 0], wristL: [0.3, 0, 0],
    shoulderR: [-0.35, 0.1, -0.95], elbowR: [-0.35, 0, 0], wristR: [0.15, 0, 0.35],
    hipL: [-0.1, 0.06, 0.08], hipR: [-0.05, -0.08, -0.06], kneeL: [0.12, 0, 0], kneeR: [0.1, 0, 0],
    ankleL: [-0.02, 0, -0.08], ankleR: [-0.05, 0, 0.06],
  },
};
