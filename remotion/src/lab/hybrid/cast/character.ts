// [hybrid/cast] Data-driven character builder: CharacterSpec -> sculpted, layered-clothing 3D figure on a rigid joint
// hierarchy (no skinning), shaded with the shared gouache paint, painted face in the skull shader, 2-bone IK feet/hands,
// per-character signature states (BLUEPRINT ink, X-RAY resin + cyan skeleton, SOLID gouache).
// Units: metres. Root at the ground between the feet, +y up, character faces +z, L = character's left = +x.
import * as THREE from "three";
import { BRAND, U, syncLookFlags } from "../look/shade";
import { sculpt, sculptPoint, SculptOpts, rbox, extrude, roundedRectShape, band, ribbon, limbGeo, tube } from "./sculpt";
import { charMat, hullMat, lockMat, CastUniforms } from "./mat";
import { EXPR, ExprName, FaceParams, FaceStyle, makeFaceUniforms, applyFaceParams, mixFace } from "./face";
import { JOINTS, JointName, Pose, HandCurl, HandShape, HANDS } from "./poses";
import { solveTwoBone } from "./ik";

export type Build = "slim" | "average" | "broad";
export type Accessory = "helmet" | "headlamp" | "toolbelt" | "glasses" | "lanyard" | "watch" | "kneepads";
export type CharacterSpec = {
  id: string; name: string; role: string;
  heightM: number;     // top of the skull (no hat)
  heads: number;       // body height in head heights (chin..crown)
  build: Build;
  skin: string;
  hair: { style: "crop" | "bun" | "bob" | "none"; color: string };
  face: { beard: number; beardColor?: string; beardGrey?: string; iris: string; brow: string; lip: string; browW?: number; eyeScale?: number; nose?: number; jaw?: number };
  body?: { shoulder?: number; waist?: number; hip?: number; limb?: number; depth?: number };
  outfit: {
    top: "workJacket" | "blazer"; topColor: string; trim: string; under?: string; stripes?: boolean;
    lower: "workPants" | "trousers"; lowerColor: string;
    shoes: "boots" | "flats"; shoeColor: string;
    gloves?: string; // glove colour (bare hands when omitted)
  };
  accessories: Accessory[];
  palette: Record<string, string>;
};

export type Proportions = {
  H: number; h: number; s: number; ankleY: number; kneeY: number; hipJY: number; hipsY: number; spineY: number; chestY: number;
  neckY: number; headJY: number; skullY: number; shoulderY: number; shoulderX: number; clavX: number; hipX: number;
  upperArm: number; foreArm: number; thigh: number; shin: number; skull: THREE.Vector3; topY: number;
};

const BUILD: Record<Build, { sh: number; limb: number; dep: number; waist: number; hip: number }> = {
  slim: { sh: 0.9, limb: 0.86, dep: 0.9, waist: 0.88, hip: 0.97 },
  average: { sh: 1.0, limb: 1.0, dep: 1.0, waist: 1.0, hip: 1.0 },
  broad: { sh: 1.08, limb: 1.1, dep: 1.06, waist: 1.04, hip: 1.02 },
};

export function proportions(spec: CharacterSpec): Proportions {
  const H = spec.heightM, h = H / spec.heads, s = H / 1.8;
  const b = BUILD[spec.build], k = spec.body ?? {};
  const ankleY = 0.082 * s, kneeY = 0.283 * H, hipJY = 0.497 * H, hipsY = hipJY + 0.035 * s;
  const spineY = hipsY + 0.1 * s, chestY = spineY + 0.13 * s;
  const chin = H - h, neckY = chin - 0.062 * s, headJY = chin + 0.022 * s, skullY = H - h / 2;
  const shoulderY = neckY - 0.034 * s;
  const shoulderX = 0.178 * s * b.sh * (k.shoulder ?? 1);
  return {
    H, h, s, ankleY, kneeY, hipJY, hipsY, spineY, chestY, neckY, headJY, skullY, shoulderY, shoulderX,
    clavX: 0.035 * s, hipX: 0.088 * s * b.hip * (k.hip ?? 1),
    upperArm: 0.17 * H, foreArm: 0.142 * H, thigh: hipJY - kneeY, shin: kneeY - ankleY,
    skull: new THREE.Vector3(h * 0.305, h * 0.49, h * 0.385), topY: H,
  };
}

export interface Character {
  spec: CharacterSpec; dims: Proportions;
  root: THREE.Group;
  joints: Record<JointName, THREE.Object3D>;
  setPose(p: Pose): void;
  setExpression(e: ExprName, weight?: number): void;
  blendExpression(a: ExprName, b: ExprName, t: number): void;
  setFace(f: FaceParams): void;
  setBlink(t: number): void;
  setGaze(x: number, y: number): void;
  setHand(side: "L" | "R", h: HandShape | HandCurl): void;
  footIK(targets: { L?: THREE.Vector3; R?: THREE.Vector3 }): void;     // world-space sole contact points
  handIK(side: "L" | "R", target: THREE.Vector3, pole?: THREE.Vector3): void; // world-space palm point
  setState(s: 0 | 1 | 2): void;   // blueprint | x-ray resin | solid (locks this character to the state)
  followLook(): void;             // unlock: follow the global look state (U.uState / print sweep); call again after state changes
  setOutline(on: boolean): void;  // blueprint outline hull (default on; turn off when the look's post ink draws lines)
  lampAnchor?: THREE.Object3D;    // headlamp lens, +z = beam direction
  eyeAnchor: THREE.Object3D;      // between the eyes (framing, labels)
  contact: THREE.Group;           // soft contact-shadow blobs (root space, follow the feet)
  meshes: THREE.Mesh[];
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const D = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).normalize();
const gauss = (d: THREE.Vector3, c: THREE.Vector3, w: number) => Math.exp(-Math.pow(d.angleTo(c) / w, 2));
const sstep = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** position + orientation (+z = outward normal, +y ~ up) on a sculpt surface along unit direction d */
function surfaceFrame(o: SculptOpts, d: THREE.Vector3, lift = 0) {
  const p = sculptPoint(d.clone().normalize(), o, new THREE.Vector3());
  const up = Math.abs(d.y) > 0.95 ? V(0, 0, 1) : V(0, 1, 0);
  const t1 = up.clone().cross(d).normalize(), t2 = d.clone().cross(t1).normalize();
  const e = 0.01;
  const p1 = sculptPoint(d.clone().addScaledVector(t1, e).normalize(), o, new THREE.Vector3());
  const p2 = sculptPoint(d.clone().addScaledVector(t2, e).normalize(), o, new THREE.Vector3());
  const n = p1.clone().sub(p).cross(p2.clone().sub(p)).normalize();
  if (n.dot(d) < 0) n.negate();
  const x = V(0, 1, 0).cross(n); if (x.lengthSq() < 1e-6) x.set(1, 0, 0); x.normalize();
  const y = n.clone().cross(x).normalize();
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, n));
  return { p: p.addScaledVector(n, lift), q, n };
}

function blobTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.45, "rgba(255,255,255,0.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
}
let BLOB: THREE.Texture | null = null;

export function buildCharacter(spec: CharacterSpec): Character {
  const P = proportions(spec);
  const s = P.s, b = BUILD[spec.build], bk = spec.body ?? {};
  const limbK = b.limb * (bk.limb ?? 1), dep = b.dep * (bk.depth ?? 1), waistK = b.waist * (bk.waist ?? 1), hipK = b.hip * (bk.hip ?? 1);
  const O = spec.outfit, pal = spec.palette, acc = new Set(spec.accessories);
  const cu: CastUniforms = { uResinA: { value: 0.85 } };
  const faceU = makeFaceUniforms({
    skin: spec.skin, lip: spec.face.lip, iris: spec.face.iris, brow: spec.face.brow, lash: pal.lash ?? "#241a18",
    beard: spec.face.beardColor ?? spec.hair.color, beardGrey: spec.face.beardGrey ?? spec.hair.color, beardAmt: spec.face.beard,
    browW: spec.face.browW ?? 1, eyeScale: spec.face.eyeScale ?? 1,
  } as FaceStyle, P.skull);
  faceU.uFE.value.w = spec.face.eyeScale ?? 1;

  const mats: THREE.MeshLambertMaterial[] = [];
  const M = (color: string, o: Parameters<typeof charMat>[2] = {}) => { const m = charMat(cu, color, o); mats.push(m); return m; };
  const mat = {
    skin: M(spec.skin, { rim: 0.3 }),
    face: M(spec.skin, { rim: 0.3, face: faceU }),
    top: M(O.topColor, { rim: 0.45 }),
    trim: M(O.trim),
    under: M(O.under ?? O.trim),
    lower: M(O.lowerColor),
    seam: M(pal.seam ?? O.trim, { brush: 0.3 }),
    tape: M(pal.tape ?? "#C9D4D6", { rim: 0.6, emissive: pal.tape ?? "#C9D4D6", emissiveIntensity: 0.12 }),
    shoe: M(O.shoeColor), sole: M(pal.sole ?? "#2A2526"), toe: M(pal.toe ?? O.shoeColor),
    glove: M(O.gloves ?? spec.skin, { rim: O.gloves ? 0.35 : 0.3 }),
    hair: M(spec.hair.color, { brush: 0.9, brushScale: 11 }),
    leather: M(pal.leather ?? "#6C4733"), metal: M(pal.metal ?? "#9AA6AE", { rim: 0.8 }), dark: M(pal.dark ?? "#23262E"),
    helmet: M(pal.helmet ?? "#EDE6D8", { rim: 0.55 }), helmetDk: M(pal.helmetDark ?? "#B9B2A6"),
    wood: M(pal.wood ?? "#8A6040"), card: M(pal.card ?? "#E9E4DA"), accent: M(pal.accent ?? O.trim),
  };
  const hullM = hullMat(new THREE.Color(BRAND.cyan), 0.0032 * s);
  const meshes: THREE.Mesh[] = [], hulls: THREE.Mesh[] = [];
  type AddOpt = { p?: THREE.Vector3; r?: [number, number, number]; q?: THREE.Quaternion; sc?: [number, number, number]; hull?: boolean; cast?: boolean };
  const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material, o: AddOpt = {}) => {
    const me = new THREE.Mesh(geo, m);
    if (o.p) me.position.copy(o.p);
    if (o.q) me.quaternion.copy(o.q); else if (o.r) me.rotation.set(o.r[0], o.r[1], o.r[2]);
    if (o.sc) me.scale.set(o.sc[0], o.sc[1], o.sc[2]);
    me.castShadow = o.cast ?? true; me.receiveShadow = true;
    parent.add(me); meshes.push(me);
    if (o.hull !== false) { const hm = new THREE.Mesh(geo, hullM); hm.visible = false; me.add(hm); hulls.push(hm); }
    return me;
  };
  const onSurf = (parent: THREE.Object3D, o: SculptOpts, oPos: THREE.Vector3, d: THREE.Vector3, geo: THREE.BufferGeometry, m: THREE.Material, lift = 0, extra?: THREE.Euler) => {
    const f = surfaceFrame(o, d, lift);
    const q = extra ? f.q.clone().multiply(new THREE.Quaternion().setFromEuler(extra)) : f.q;
    return add(parent, geo, m, { p: f.p.add(oPos), q });
  };

  // ------------------------------------------------------------------ joints
  const root = new THREE.Group(); root.name = `char-${spec.id}`;
  const J = {} as Record<JointName, THREE.Group>;
  const joint = (n: JointName, parent: THREE.Object3D, x: number, y: number, z: number) => {
    const g = new THREE.Group(); g.name = n; g.position.set(x, y, z); parent.add(g); J[n] = g; return g;
  };
  const hips = joint("hips", root, 0, P.hipsY, 0);
  const spine = joint("spine", hips, 0, P.spineY - P.hipsY, 0);
  const chest = joint("chest", spine, 0, P.chestY - P.spineY, -0.004 * s);
  const neck = joint("neck", chest, 0, P.neckY - P.chestY, -0.014 * s);
  const head = joint("head", neck, 0, P.headJY - P.neckY, 0.008 * s);
  for (const S of ["L", "R"] as const) {
    const sg = S === "L" ? 1 : -1;
    const clav = joint(`clav${S}`, chest, sg * P.clavX, P.shoulderY - P.chestY, -0.012 * s);
    const sh = joint(`shoulder${S}`, clav, sg * (P.shoulderX - P.clavX), 0, 0);
    const el = joint(`elbow${S}`, sh, 0, -P.upperArm, 0);
    joint(`wrist${S}`, el, 0, -P.foreArm, 0);
    const hp = joint(`hip${S}`, hips, sg * P.hipX, P.hipJY - P.hipsY, 0);
    const kn = joint(`knee${S}`, hp, 0, -P.thigh, 0);
    joint(`ankle${S}`, kn, 0, -P.shin, 0);
  }

  // ------------------------------------------------------------------ pelvis (lower garment) + belt
  const pelvisO: SculptOpts = { r: [0.152 * s * hipK, 0.112 * s, 0.112 * s * dep], e1: 0.62, e2: 0.76, taperBot: 0.9, seg: [40, 24] };
  const pelvisP = V(0, -0.028 * s, 0);
  add(hips, sculpt(pelvisO), mat.lower, { p: pelvisP });
  add(hips, ribbon(pelvisO, [D(0, 0.6, 1), D(0, -0.2, 1), D(0, -0.9, 0.5)], 0.012 * s, 0.002 * s), mat.seam, { p: pelvisP, hull: false }); // fly seam
  for (const sg of [1, -1]) add(hips, ribbon(pelvisO, [D(sg, 0.8, 0.0), D(sg, -0.6, 0.0)], 0.008 * s, 0.002 * s), mat.seam, { p: pelvisP, hull: false });

  // ------------------------------------------------------------------ torso: abdomen (spine) + chest pieces of the top garment
  const hem = O.top === "blazer" ? 0.13 * s : 0.1 * s;
  const abLo = P.hipsY - hem, abHi = P.chestY + 0.06 * s;
  const abO: SculptOpts = {
    r: [0.158 * s * waistK, (abHi - abLo) / 2, 0.118 * s * dep], e1: 0.5, e2: 0.74, taperBot: 1.04 * Math.sqrt(hipK / waistK), taperTop: 1.0,
    bulge: 0.006 * s, seg: [44, 26],
  };
  const abP = V(0, (abLo + abHi) / 2 - P.spineY, 0.002 * s);
  add(spine, sculpt(abO), mat.top, { p: abP });
  const chLo = P.chestY - 0.075 * s, chHi = P.neckY + 0.018 * s;
  const chO: SculptOpts = {
    r: [P.shoulderX * 0.9, (chHi - chLo) / 2, 0.128 * s * dep], e1: 0.5, e2: 0.74, taperBot: 0.86, taperTop: 0.98, taperTopZ: 0.9, seg: [48, 30],
    disp: (d) => -0.034 * s * sstep(0.25, 0.85, Math.abs(d.x)) * sstep(0.15, 0.9, d.y)            // sloped trapezius
      + 0.008 * s * (gauss(d, D(0.42, 0.22, 0.88), 0.32) + gauss(d, D(-0.42, 0.22, 0.88), 0.32))  // chest planes
      + 0.006 * s * (gauss(d, D(0.45, 0.3, -0.88), 0.3) + gauss(d, D(-0.45, 0.3, -0.88), 0.3)),   // shoulder blades
  };
  const chP = V(0, (chLo + chHi) / 2 - P.chestY, 0);
  add(chest, sculpt(chO), mat.top, { p: chP });
  // side seams + back yoke seam
  for (const sg of [1, -1]) {
    add(chest, ribbon(chO, [D(sg, 0.65, -0.08), D(sg, -0.9, -0.05)], 0.007 * s, 0.0015 * s), mat.seam, { p: chP, hull: false });
    add(spine, ribbon(abO, [D(sg, 0.9, -0.05), D(sg, -0.9, -0.05)], 0.007 * s, 0.0015 * s), mat.seam, { p: abP, hull: false });
  }
  add(chest, ribbon(chO, [D(1, 0.35, -0.5), D(0.5, 0.42, -1), D(0, 0.44, -1), D(-0.5, 0.42, -1), D(-1, 0.35, -0.5)], 0.006 * s, 0.0015 * s), mat.seam, { p: chP, hull: false });
  // hem band
  add(spine, band(abO, -abO.r[1] + 0.012 * s, -abO.r[1] + 0.04 * s, 0.003 * s, 48, 2), O.top === "blazer" ? mat.top : mat.trim, { p: abP });

  if (O.top === "workJacket") {
    // stand-up collar, zip placket, chest pockets with flaps, radio loop, reflective tape (2 hoops + braces over the shoulders)
    const col = add(chest, new THREE.TorusGeometry(0.07 * s, 0.02 * s, 12, 36), mat.trim, { p: V(0, P.neckY - P.chestY + 0.012 * s, -0.008 * s), r: [Math.PI / 2 - 0.25, 0, 0] });
    col.scale.set(1.05, 1.0, 1.25);
    add(chest, ribbon(chO, [D(0, 0.8, 0.6), D(0, 0.3, 1), D(0, -0.5, 1), D(0, -1, 0.3)], 0.028 * s, 0.003 * s), mat.trim, { p: chP, hull: false });
    add(spine, ribbon(abO, [D(0, 1, 0.3), D(0, 0.2, 1), D(0, -0.7, 1), D(0, -1, 0.2)], 0.028 * s, 0.003 * s), mat.trim, { p: abP, hull: false });
    add(chest, ribbon(chO, [D(0, 0.8, 0.6), D(0, 0.3, 1), D(0, -0.5, 1), D(0, -1, 0.3)], 0.006 * s, 0.0055 * s), mat.dark, { p: chP, hull: false });
    add(spine, ribbon(abO, [D(0, 1, 0.3), D(0, 0.2, 1), D(0, -0.7, 1), D(0, -1, 0.2)], 0.006 * s, 0.0055 * s), mat.dark, { p: abP, hull: false });
    for (const sg of [1, -1]) {
      const pd = D(sg * 0.5, 0.12, 0.88);
      onSurf(chest, chO, chP, pd, rbox(0.085 * s, 0.09 * s, 0.014 * s, 0.006 * s), mat.top, 0.004 * s);
      onSurf(chest, chO, chP, D(sg * 0.5, 0.3, 0.86), rbox(0.092 * s, 0.03 * s, 0.018 * s, 0.006 * s), mat.trim, 0.006 * s);
      onSurf(chest, chO, chP, D(sg * 0.5, 0.31, 0.86), new THREE.CylinderGeometry(0.0045 * s, 0.0045 * s, 0.006 * s, 10).rotateX(Math.PI / 2), mat.metal, 0.016 * s);
    }
    onSurf(chest, chO, chP, D(-0.5, 0.12, 0.88), new THREE.CylinderGeometry(0.005 * s, 0.005 * s, 0.07 * s, 8), mat.dark, 0.02 * s, new THREE.Euler(0, 0, 0)).position.y += 0.035 * s; // pen
    if (O.stripes) {
      add(chest, band(chO, -0.035 * s, 0.015 * s, 0.004 * s, 64, 3), mat.tape, { p: chP });
      add(spine, band(abO, -0.02 * s, 0.028 * s, 0.004 * s, 64, 3), mat.tape, { p: abP });
      for (const sg of [1, -1]) {
        add(chest, ribbon(chO, [D(sg * 0.42, -0.55, 0.85), D(sg * 0.42, 0.2, 0.92), D(sg * 0.5, 0.75, 0.42), D(sg * 0.5, 0.95, 0.0), D(sg * 0.5, 0.75, -0.42), D(sg * 0.42, 0.2, -0.92), D(sg * 0.42, -0.55, -0.85)], 0.048 * s, 0.0045 * s, 8), mat.tape, { p: chP, hull: false });
      }
    }
  } else {
    // blazer: shirt V, lapels, buttons, welt pockets
    const vGeo = sculpt({ r: [0.07 * s, 0.12 * s, 0.02 * s], e1: 0.9, e2: 0.6, taperBot: 0.15, seg: [24, 18] });
    onSurf(chest, chO, chP, D(0, 0.42, 1), vGeo, mat.under, -0.008 * s);
    for (const sg of [1, -1]) {
      add(chest, ribbon(chO, [D(sg * 0.12, 0.92, 0.38), D(sg * 0.3, 0.55, 0.92), D(sg * 0.12, 0.05, 1), D(sg * 0.02, -0.25, 1)], 0.04 * s, 0.006 * s, 8), mat.top, { p: chP });
      add(chest, ribbon(chO, [D(sg * 0.16, 0.9, 0.42), D(sg * 0.34, 0.55, 0.92), D(sg * 0.16, 0.05, 1), D(sg * 0.05, -0.25, 1)], 0.008 * s, 0.009 * s, 8), mat.seam, { p: chP, hull: false });
      onSurf(spine, abO, abP, D(sg * 0.55, -0.35, 0.85), rbox(0.09 * s, 0.012 * s, 0.01 * s, 0.004 * s), mat.seam, 0.002 * s);
    }
    for (const y of [-0.05, -0.32]) onSurf(spine, abO, abP, D(0.02, y, 1), new THREE.CylinderGeometry(0.008 * s, 0.008 * s, 0.006 * s, 14).rotateX(Math.PI / 2), mat.dark, 0.004 * s);
    const col = add(chest, new THREE.TorusGeometry(0.064 * s, 0.014 * s, 10, 32), mat.under, { p: V(0, P.neckY - P.chestY + 0.006 * s, -0.004 * s), r: [Math.PI / 2 - 0.3, 0, 0] });
    col.scale.set(1.0, 1.0, 1.2);
  }

  // ------------------------------------------------------------------ tool belt / belt
  if (acc.has("toolbelt")) {
    const beltO: SculptOpts = { r: [abO.r[0] * 1.07 * abO.taperBot! * 0.98, 0.026 * s, abO.r[2] * 1.1], e1: 0.18, e2: 0.74, seg: [48, 8] };
    const beltP = V(0, 0.035 * s, 0.003 * s);
    add(hips, sculpt(beltO), mat.leather, { p: beltP });
    add(hips, rbox(0.07 * s, 0.05 * s, 0.016 * s, 0.006 * s), mat.metal, { p: beltP.clone().add(V(0, 0, beltO.r[2] + 0.004 * s)) });
    for (const sg of [1, -1]) {
      const pouch = new THREE.Group(); pouch.position.copy(beltP).add(V(sg * beltO.r[0] * 0.92, -0.05 * s, beltO.r[2] * 0.35)); pouch.rotation.y = sg * 0.9; hips.add(pouch);
      add(pouch, rbox(0.075 * s, 0.11 * s, 0.05 * s, 0.014 * s), mat.leather, { p: V(0, 0, 0.012 * s) });
      add(pouch, rbox(0.08 * s, 0.035 * s, 0.056 * s, 0.01 * s), mat.leather, { p: V(0, 0.045 * s, 0.014 * s) });
      add(pouch, rbox(0.012 * s, 0.012 * s, 0.01 * s, 0.003 * s), mat.metal, { p: V(0, 0.035 * s, 0.043 * s) });
    }
    const hammer = new THREE.Group(); hammer.position.copy(beltP).add(V(0.11 * s, -0.02 * s, -beltO.r[2] * 0.85)); hammer.rotation.set(0.12, 0.3, 0.1); hips.add(hammer);
    add(hammer, new THREE.CylinderGeometry(0.011 * s, 0.013 * s, 0.24 * s, 12), mat.wood, { p: V(0, -0.08 * s, 0) });
    add(hammer, rbox(0.03 * s, 0.032 * s, 0.11 * s, 0.006 * s), mat.metal, { p: V(0, 0.04 * s, 0.01 * s) });
    const tape = new THREE.Group(); tape.position.copy(beltP).add(V(-0.12 * s, -0.035 * s, -beltO.r[2] * 0.8)); tape.rotation.y = -2.4; hips.add(tape);
    add(tape, rbox(0.07 * s, 0.07 * s, 0.036 * s, 0.016 * s), mat.dark);
    add(tape, new THREE.CylinderGeometry(0.02 * s, 0.02 * s, 0.04 * s, 20).rotateX(Math.PI / 2), mat.metal);
  }

  // ------------------------------------------------------------------ neck + head
  const neckLen = P.headJY - P.neckY + 0.07 * s;
  add(neck, sculpt({ r: [0.054 * s, neckLen / 2, 0.058 * s], e1: 0.85, e2: 0.95, taperTop: 0.92, seg: [24, 12] }), mat.skin, { p: V(0, neckLen / 2 - 0.02 * s, 0.004 * s) });
  const hc = new THREE.Group(); hc.name = "skull"; hc.position.set(0, P.skullY - P.headJY, 0.018 * s); head.add(hc);
  const R = P.skull, jawK = spec.face.jaw ?? 1;
  const skullO: SculptOpts = {
    r: [R.x, R.y, R.z], e1: 0.86, e2: 0.82, taperBot: 0.8, taperBotZ: 0.96, seg: [72, 56],
    disp: (d) => {
      let v = 0;
      for (const sg of [1, -1]) {
        v -= 0.006 * s * gauss(d, D(sg * 0.45, 0.0, 0.89), 0.16);                 // eye sockets (shallow: the eyes are painted)
        v += 0.007 * s * gauss(d, D(sg * 0.6, -0.14, 0.78), 0.26);                // cheekbones
        v += 0.007 * s * jawK * gauss(d, D(sg * 0.72, -0.66, 0.25), 0.3);         // jaw angle
        v -= 0.005 * s * gauss(d, D(sg * 0.82, 0.28, 0.45), 0.24);                // temples
      }
      v += 0.007 * s * Math.exp(-Math.pow((d.y - 0.22) / 0.09, 2)) * sstep(0.55, 0.92, d.z);                // brow ridge
      v += 0.013 * s * jawK * gauss(d, D(0, -0.8, 0.6), 0.26);                     // chin
      v += 0.006 * s * gauss(d, D(0, -0.52, 0.86), 0.3);                           // muzzle
      v += 0.012 * s * gauss(d, D(0, 0.35, -0.94), 0.55);                          // occiput
      return v;
    },
  };
  add(hc, sculpt(skullO), mat.face);
  const ns = spec.face.nose ?? 1;
  onSurf(hc, skullO, V(0, 0, 0), D(0, -0.16, 1), sculpt({ r: [0.016 * s * ns, 0.03 * s * ns, 0.022 * s * ns], e1: 0.8, e2: 0.85, taperTop: 0.5, taperBot: 1.15, leanTop: [0, -0.012 * s], seg: [20, 16] }), mat.skin, -0.006 * s, new THREE.Euler(-0.12, 0, 0));
  for (const sg of [1, -1]) onSurf(hc, skullO, V(0, 0, 0), D(sg * 0.12, -0.3, 0.98), sculpt({ r: [0.011 * s * ns, 0.009 * s, 0.01 * s], seg: [14, 10] }), mat.skin, -0.002 * s);
  for (const sg of [1, -1]) {
    const ear = onSurf(hc, skullO, V(0, 0, 0), D(sg, -0.02, -0.1), sculpt({ r: [0.022 * s, 0.032 * s, 0.008 * s], e1: 0.8, e2: 0.8, taperBot: 0.75, seg: [16, 12] }), mat.skin, -0.002 * s, new THREE.Euler(0, -0.35, 0));
    void ear;
  }
  // hair
  const hairCol = mat.hair;
  if (spec.hair.style !== "none") {
    const style = spec.hair.style;
    const hairO: SculptOpts = {
      ...skullO, seg: [64, 40], theta: [0, style === "bob" ? 2.25 : style === "bun" ? 2.0 : 1.72],
      disp: (d, pp) => {
        const base = skullO.disp!(d, pp) + 0.007 * s + (style === "bun" ? 0.004 * s : 0);
        // hairline: the front recedes inside the skull (crop: higher/back; bun/bob: on the forehead)
        const front = style === "crop" ? sstep(0.15, 0.5, d.z) * sstep(-0.3, 0.2, d.y) : sstep(0.55, 0.8, d.z) * sstep(0.62, 0.38, d.y);
        const side = style === "bob" ? 0 : sstep(0.25, -0.1, d.y) * sstep(0.2, 0.6, d.z); // around the ears
        return base - 0.03 * s * Math.max(front, side) + (style === "bob" ? 0.01 * s * sstep(0.0, -0.6, d.y) : 0);
      },
    };
    add(hc, sculpt(hairO), hairCol);
    if (style === "bun") {
      add(hc, sculpt({ r: [0.05 * s, 0.045 * s, 0.05 * s], e1: 0.9, e2: 0.9, seg: [24, 16], disp: (d) => 0.004 * s * Math.sin(d.x * 9 + d.y * 7) }), hairCol, { p: V(0, R.y * 0.98, -R.z * 0.35) });
      add(hc, new THREE.TorusGeometry(0.036 * s, 0.006 * s, 8, 24), mat.accent, { p: V(0, R.y * 0.86, -R.z * 0.3), r: [Math.PI / 2 + 0.6, 0, 0] });
      // side-swept fringe lock
      onSurf(hc, hairO, V(0, 0, 0), D(-0.28, 0.6, 0.76), sculpt({ r: [0.05 * s, 0.022 * s, 0.012 * s], e1: 0.7, taperTop: 0.6, seg: [20, 12] }), hairCol, -0.004 * s, new THREE.Euler(0, 0, 0.35));
    }
  }
  // eye anchor
  const eyeAnchor = new THREE.Object3D(); eyeAnchor.position.set(0, 0, R.z * 0.95); hc.add(eyeAnchor);

  // helmet + headlamp
  let lampAnchor: THREE.Object3D | undefined;
  if (acc.has("helmet")) {
    const helm = new THREE.Group(); helm.position.set(0, R.y * 0.34, -0.008 * s); hc.add(helm);
    const shellO: SculptOpts = { r: [R.x * 1.32, R.y * 0.86, R.z * 1.2], e1: 0.78, e2: 0.88, seg: [60, 26], theta: [0, Math.PI / 2 + 0.03], taperTop: 0.96 };
    add(helm, sculpt(shellO), mat.helmet);
    add(helm, band(shellO, -0.012 * s, 0.006 * s, 0.006 * s, 64, 2), mat.helmet);          // rolled rim
    add(helm, band(shellO, 0.028 * s, 0.044 * s, 0.003 * s, 64, 2), mat.dark);           // lamp strap
    // signature crown: a raised central fin + two side ribs
    add(helm, sculpt({ r: [0.013 * s, 0.024 * s, shellO.r[2] * 0.98], e1: 0.55, e2: 0.6, theta: [0, Math.PI / 2], seg: [16, 18] }), mat.helmet, { p: V(0, shellO.r[1] * 0.83, -0.004 * s) });
    for (const sg of [1, -1]) add(helm, ribbon(shellO, [D(sg * 0.42, 0.25, 0.9), D(sg * 0.34, 0.92, 0.2), D(sg * 0.42, 0.25, -0.9)], 0.014 * s, 0.004 * s, 10), mat.helmetDk, { hull: false });
    // cap-style peak (front only): the silhouette read from the side
    add(helm, sculpt({ r: [R.x * 1.08, 0.009 * s, 0.062 * s], e1: 0.35, e2: 0.9, seg: [36, 8], flatBack: 0.4 }), mat.helmet, { p: V(0, 0.002 * s, shellO.r[2] * 0.97), r: [0.2, 0, 0] });
    if (acc.has("headlamp")) {
      const lamp = new THREE.Group(); lamp.position.set(0, 0.038 * s, shellO.r[2] * 1.0); lamp.rotation.x = 0.12; helm.add(lamp);
      add(lamp, rbox(0.06 * s, 0.04 * s, 0.034 * s, 0.01 * s), mat.dark);
      add(lamp, new THREE.CylinderGeometry(0.018 * s, 0.02 * s, 0.012 * s, 24).rotateX(Math.PI / 2), mat.metal, { p: V(0, 0, 0.019 * s) });
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.0155 * s, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.5, 2.2) }));
      lens.position.z = 0.0256 * s; lamp.add(lens);
      lampAnchor = new THREE.Object3D(); lampAnchor.position.z = 0.028 * s; lamp.add(lampAnchor);
    }
  }
  if (acc.has("glasses")) {
    const g = new THREE.Group(); hc.add(g);
    const fs = roundedRectShape(0.05 * s, 0.034 * s, 0.012 * s);
    fs.holes.push(roundedRectShape(0.042 * s, 0.026 * s, 0.009 * s));
    const ex = 0.3 * R.y * (spec.face.eyeScale ?? 1);
    const ez = R.z * Math.sqrt(Math.max(0, 1 - Math.pow(ex / R.x, 2.2)));
    for (const sg of [1, -1]) {
      const ep = V(sg * ex, 0, ez);
      add(g, extrude(fs, 0.004 * s, 0.001 * s, 2, 8), mat.dark, { p: V(ep.x, ep.y + 0.002 * s, ep.z + 0.012 * s), r: [0, sg * 0.22, 0], hull: false });
      const tp = sculptPoint(D(sg * 0.95, 0.02, 0.2), skullO, new THREE.Vector3());
      add(g, tube([V(ep.x + sg * 0.025 * s, ep.y + 0.006 * s, ep.z + 0.008 * s), V(tp.x + sg * 0.008 * s, tp.y + 0.004 * s, tp.z), V(tp.x + sg * 0.004 * s, tp.y - 0.01 * s, tp.z - 0.03 * s)], 0.0018 * s, 12, 5), mat.dark, { hull: false });
    }
    const bp = sculptPoint(D(0, 0.04, 1), skullO, new THREE.Vector3());
    add(g, tube([V(-0.012 * s, bp.y + 0.002 * s, bp.z + 0.008 * s), V(0, bp.y + 0.006 * s, bp.z + 0.012 * s), V(0.012 * s, bp.y + 0.002 * s, bp.z + 0.008 * s)], 0.0018 * s, 8, 5), mat.dark, { hull: false });
  }
  if (acc.has("lanyard")) {
    add(chest, ribbon(chO, [D(0.42, 0.98, 0.1), D(0.3, 0.6, 0.95), D(0.08, -0.1, 1)], 0.012 * s, 0.006 * s, 10), mat.accent, { p: chP, hull: false });
    add(chest, ribbon(chO, [D(-0.42, 0.98, 0.1), D(-0.3, 0.6, 0.95), D(-0.08, -0.1, 1)], 0.012 * s, 0.006 * s, 10), mat.accent, { p: chP, hull: false });
    onSurf(chest, chO, chP, D(0, -0.28, 1), rbox(0.055 * s, 0.08 * s, 0.006 * s, 0.006 * s), mat.card, 0.012 * s);
    onSurf(chest, chO, chP, D(0, -0.2, 1), rbox(0.04 * s, 0.014 * s, 0.004 * s, 0.003 * s), mat.accent, 0.016 * s);
  }

  // ------------------------------------------------------------------ arms + hands
  const fingers: Record<"L" | "R", { segs: THREE.Group[][]; thumb: THREE.Group[]; side: number }> = { L: { segs: [], thumb: [], side: 1 }, R: { segs: [], thumb: [], side: -1 } };
  const gl = O.gloves ? 1.12 : 1;
  for (const S of ["L", "R"] as const) {
    const sg = S === "L" ? 1 : -1;
    const sh = J[`shoulder${S}`], el = J[`elbow${S}`], wr = J[`wrist${S}`];
    const ua0 = 0.057 * s * limbK, ua1 = 0.047 * s * limbK, fa0 = 0.047 * s * limbK, fa1 = 0.037 * s * limbK;
    add(sh, sculpt({ r: [ua0 * 1.12, ua0 * 1.08, ua0 * 1.1], seg: [24, 16] }), mat.top);                      // shoulder cap
    add(sh, limbGeo(P.upperArm, ua0, ua1, { bulge: 0.004 * s }), mat.top);
    add(el, sculpt({ r: [ua1, ua1, ua1], seg: [20, 14] }), mat.top);
    add(el, limbGeo(P.foreArm, fa0 * 1.02, fa1, { bulge: 0.003 * s }), mat.top);
    const uaO: SculptOpts = { r: [ua0, P.upperArm / 2 + (ua0 + ua1) / 4, ua0], e1: 0.62, e2: 0.92, taperBot: ua1 / ua0 };
    const faO: SculptOpts = { r: [fa0 * 1.02, P.foreArm / 2 + (fa0 + fa1) / 4, fa0 * 1.02], e1: 0.62, e2: 0.92, taperBot: fa1 / (fa0 * 1.02) };
    add(el, band(faO, -faO.r[1] + 0.03 * s, -faO.r[1] + 0.062 * s, 0.004 * s, 32, 2), mat.trim, { p: V(0, -P.foreArm / 2, 0) }); // cuff
    add(sh, ribbon(uaO, [D(0, 0.6, -1), D(0, -0.8, -1)], 0.007 * s, 0.0015 * s), mat.seam, { p: V(0, -P.upperArm / 2, 0), hull: false });
    if (O.stripes) {
      add(sh, band(uaO, -0.05 * s, -0.012 * s, 0.004 * s, 32, 2), mat.tape, { p: V(0, -P.upperArm / 2, 0) });
      add(el, band(faO, -0.035 * s, 0.0, 0.004 * s, 32, 2), mat.tape, { p: V(0, -P.foreArm / 2, 0) });
    }
    if (acc.has("watch") && S === "L") {
      add(el, band(faO, -faO.r[1] + 0.07 * s, -faO.r[1] + 0.085 * s, 0.003 * s, 32, 2), mat.dark, { p: V(0, -P.foreArm / 2, 0) });
      add(el, new THREE.CylinderGeometry(0.014 * s, 0.014 * s, 0.006 * s, 20).rotateZ(Math.PI / 2), mat.metal, { p: V(sg * (fa1 + 0.006 * s), -P.foreArm + 0.075 * s, 0) });
    }
    // hand (in wrist space, fingers along -y, palm faces -sg*x, thumb toward +z)
    const hm = mat.glove;
    add(wr, sculpt({ r: [0.027 * s * gl, 0.03 * s, 0.03 * s * gl], seg: [16, 12] }), hm, { p: V(0, -0.012 * s, 0) });
    const palmO: SculptOpts = { r: [0.017 * s * gl, 0.046 * s, 0.04 * s * gl], e1: 0.5, e2: 0.55, taperBot: 1.04, seg: [24, 18], disp: (d) => (d.x * -sg > 0.3 ? -0.003 * s : 0) };
    add(wr, sculpt(palmO), hm, { p: V(sg * 0.002 * s, -0.05 * s, 0) });
    if (O.gloves) add(wr, band({ r: [0.03 * s * gl, 0.03 * s, 0.034 * s * gl], e1: 0.6, e2: 0.7 }, -0.012 * s, 0.012 * s, 0.004 * s, 24, 2), mat.dark, { p: V(0, -0.006 * s, 0) });
    const FZ = [0.028, 0.0095, -0.009, -0.026], FL = [0.072, 0.08, 0.075, 0.06], FR = [0.0098, 0.0104, 0.0099, 0.0088];
    for (let i = 0; i < 4; i++) {
      const base = new THREE.Group(); base.position.set(-sg * 0.002 * s, -0.09 * s, FZ[i] * s); wr.add(base);
      const l1 = FL[i] * 0.56 * s, l2 = FL[i] * 0.44 * s, r = FR[i] * s * gl;
      add(base, sculpt({ r: [r * 1.05, r * 1.05, r * 1.05], seg: [12, 10] }), hm, { hull: false });
      add(base, limbGeo(l1, r, r * 0.94, { seg: [14, 10], e: 0.7 }), hm);
      const mid = new THREE.Group(); mid.position.y = -l1; base.add(mid);
      add(mid, limbGeo(l2, r * 0.94, r * 0.82, { seg: [14, 10], e: 0.75 }), hm);
      fingers[S].segs.push([base, mid]);
    }
    const tb = new THREE.Group(); tb.position.set(-sg * 0.008 * s, -0.03 * s, 0.03 * s * gl); tb.rotation.set(-0.7, 0, -sg * 0.35); wr.add(tb);
    const tr = 0.0118 * s * gl;
    add(tb, limbGeo(0.042 * s, tr * 1.1, tr, { seg: [14, 10], e: 0.7 }), hm);
    const tm = new THREE.Group(); tm.position.y = -0.042 * s; tb.add(tm);
    add(tm, limbGeo(0.034 * s, tr, tr * 0.85, { seg: [14, 10], e: 0.75 }), hm);
    fingers[S].thumb = [tb, tm];
  }

  // ------------------------------------------------------------------ legs + footwear
  for (const S of ["L", "R"] as const) {
    const sg = S === "L" ? 1 : -1;
    const hp = J[`hip${S}`], kn = J[`knee${S}`], an = J[`ankle${S}`];
    const th0 = 0.084 * s * limbK * Math.sqrt(hipK), th1 = 0.061 * s * limbK, sh0 = 0.06 * s * limbK, sh1 = 0.051 * s * limbK;
    add(hp, sculpt({ r: [th0 * 0.98, th0 * 0.98, th0 * 0.98], seg: [24, 16] }), mat.lower);
    add(hp, limbGeo(P.thigh, th0, th1, { bulge: 0.004 * s }), mat.lower);
    add(kn, sculpt({ r: [th1, th1, th1], seg: [20, 14] }), mat.lower);
    add(kn, limbGeo(P.shin, sh0, sh1, { bulge: 0.004 * s }), mat.lower);
    const thO: SculptOpts = { r: [th0, P.thigh / 2 + (th0 + th1) / 4, th0], e1: 0.62, e2: 0.92, taperBot: th1 / th0 };
    const shO: SculptOpts = { r: [sh0, P.shin / 2 + (sh0 + sh1) / 4, sh0], e1: 0.62, e2: 0.92, taperBot: sh1 / sh0 };
    const thP = V(0, -P.thigh / 2, 0), shP = V(0, -P.shin / 2, 0);
    add(hp, ribbon(thO, [D(sg, 0.8, 0), D(sg, -0.85, 0)], 0.007 * s, 0.0015 * s), mat.seam, { p: thP, hull: false });
    add(kn, ribbon(shO, [D(sg, 0.85, 0), D(sg, -0.85, 0)], 0.007 * s, 0.0015 * s), mat.seam, { p: shP, hull: false });
    if (O.lower === "workPants") {
      onSurf(hp, thO, thP, D(sg, -0.12, 0.12), rbox(0.03 * s, 0.13 * s, 0.11 * s, 0.012 * s), mat.lower, 0.0);
      onSurf(hp, thO, thP, D(sg, 0.14, 0.12), rbox(0.034 * s, 0.03 * s, 0.115 * s, 0.008 * s), mat.lower, 0.004 * s);
      if (O.stripes) add(kn, band(shO, -0.08 * s, -0.045 * s, 0.004 * s, 32, 2), mat.tape, { p: shP });
    }
    if (acc.has("kneepads")) add(kn, sculpt({ r: [0.05 * s, 0.065 * s, 0.03 * s], e1: 0.55, e2: 0.7, flatBack: 0.7, seg: [20, 14] }), mat.dark, { p: V(0, -0.02 * s, th1 * 0.82) });
    add(kn, band(shO, -shO.r[1] + 0.008 * s, -shO.r[1] + 0.03 * s, 0.003 * s, 32, 2), mat.lower, { p: shP });           // hem
    if (O.shoes === "boots") {
      add(an, sculpt({ r: [0.058 * s, 0.07 * s, 0.062 * s], e1: 0.6, e2: 0.8, seg: [24, 14] }), mat.shoe, { p: V(0, 0.01 * s, -0.004 * s) }); // shaft
      add(an, band({ r: [0.06 * s, 0.07 * s, 0.064 * s], e1: 0.6, e2: 0.8 }, 0.045 * s, 0.07 * s, 0.006 * s, 32, 2), mat.shoe, { p: V(0, 0.01 * s, -0.004 * s) }); // padded collar
      const bootO: SculptOpts = { r: [0.057 * s, 0.058 * s, 0.135 * s], e1: 0.48, e2: 0.62, taperTop: 0.86, taperTopZ: 0.62, flatBack: 0.12, seg: [40, 22] };
      add(an, sculpt(bootO), mat.shoe, { p: V(0, -P.ankleY + 0.058 * s, 0.038 * s) });
      add(an, sculpt({ r: [0.054 * s, 0.04 * s, 0.05 * s], e1: 0.5, e2: 0.7, theta: [0, Math.PI / 2 + 0.2], seg: [24, 12] }), mat.toe, { p: V(0, -P.ankleY + 0.028 * s, 0.118 * s), r: [0.0, 0, 0] });
      add(an, sculpt({ r: [0.062 * s, 0.013 * s, 0.142 * s], e1: 0.22, e2: 0.62, seg: [40, 8] }), mat.sole, { p: V(0, -P.ankleY + 0.013 * s, 0.038 * s) });
      for (let k = 0; k < 4; k++) add(an, rbox(0.05 * s, 0.006 * s, 0.009 * s, 0.002 * s), mat.dark, { p: V(0, -0.005 * s + k * 0.017 * s - 0.028 * s, 0.07 * s - k * 0.011 * s), r: [-0.6, 0, 0], hull: false });
    } else {
      add(an, sculpt({ r: [0.028 * s, 0.03 * s, 0.03 * s], seg: [16, 12] }), mat.skin, { p: V(0, -0.01 * s, 0) });
      add(an, sculpt({ r: [0.044 * s, 0.032 * s, 0.122 * s], e1: 0.5, e2: 0.66, taperTop: 0.8, taperTopZ: 0.7, flatBack: 0.1, seg: [36, 18] }), mat.shoe, { p: V(0, -P.ankleY + 0.032 * s, 0.036 * s) });
      add(an, sculpt({ r: [0.046 * s, 0.008 * s, 0.126 * s], e1: 0.25, e2: 0.66, seg: [36, 8] }), mat.sole, { p: V(0, -P.ankleY + 0.008 * s, 0.036 * s) });
    }
  }

  // ------------------------------------------------------------------ X-RAY skeleton (cyan line bones inside the resin)
  const boneMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(BRAND.cyan).multiplyScalar(1.15) });
  const skeleton: THREE.Object3D[] = [];
  const bone = (parent: THREE.Object3D, a: THREE.Vector3, c: THREE.Vector3, r: number) => {
    const m = new THREE.Mesh(tube([a, c], r, 2, 6), boneMat); m.visible = false; parent.add(m); skeleton.push(m);
    const k = new THREE.Mesh(new THREE.SphereGeometry(r * 1.9, 10, 8), boneMat); k.position.copy(a); k.visible = false; parent.add(k); skeleton.push(k);
  };
  for (const n of JOINTS) {
    const j = J[n];
    for (const c2 of j.children) if (JOINTS.includes(c2.name as JointName) && c2.position.length() > 0.02) bone(j, V(0, 0, 0), c2.position.clone(), 0.006 * s);
  }
  bone(J.ankleL, V(0, 0, 0), V(0, -P.ankleY + 0.02 * s, 0.13 * s), 0.006 * s); bone(J.ankleR, V(0, 0, 0), V(0, -P.ankleY + 0.02 * s, 0.13 * s), 0.006 * s);
  bone(J.wristL, V(0, 0, 0), V(0, -0.15 * s, 0), 0.005 * s); bone(J.wristR, V(0, 0, 0), V(0, -0.15 * s, 0), 0.005 * s);
  const ring = (parent: THREE.Object3D, p: THREE.Vector3, rx: number, rz: number, rot: [number, number, number] = [Math.PI / 2, 0, 0]) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(1, (0.0045 * s) / Math.max(rx, rz), 6, 40), boneMat);
    m.position.copy(p); m.rotation.set(...rot); m.scale.set(rx, rz, 1); m.visible = false; parent.add(m); skeleton.push(m);
  };
  for (let i = 0; i < 4; i++) ring(chest, V(0, chP.y - 0.02 * s + i * 0.05 * s, 0.01 * s), chO.r[0] * (0.62 + 0.06 * Math.sin(i)), chO.r[2] * 0.75);
  ring(hips, V(0, -0.01 * s, 0), pelvisO.r[0] * 0.7, pelvisO.r[2] * 0.7);
  ring(hc, V(0, 0, 0), R.x * 0.85, R.z * 0.85); ring(hc, V(0, 0, 0), R.z * 0.85, R.y * 0.85, [0, Math.PI / 2, 0]);

  // ------------------------------------------------------------------ contact shadow blobs (root space)
  BLOB ??= blobTexture();
  const contact = new THREE.Group(); contact.name = "contact"; root.add(contact);
  const blobMat = new THREE.MeshBasicMaterial({ map: BLOB, color: new THREE.Color("#0d1c26"), transparent: true, opacity: 0.55, depthWrite: false });
  const blobs = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.16 * s, 0.34 * s), blobMat); m.rotation.x = -Math.PI / 2; m.renderOrder = 1; contact.add(m); return m; });
  const bodyBlob = new THREE.Mesh(new THREE.PlaneGeometry(0.62 * s, 0.5 * s), blobMat.clone()); (bodyBlob.material as THREE.MeshBasicMaterial).opacity = 0.3;
  bodyBlob.rotation.x = -Math.PI / 2; bodyBlob.position.y = 0.001; contact.add(bodyBlob);

  // ------------------------------------------------------------------ behaviour
  const fingerCurl = (S: "L" | "R", h: HandCurl) => {
    const F = fingers[S], sg = F.side;
    const spreadA = [0.14, 0.04, -0.05, -0.15];
    F.segs.forEach(([b0, b1], i) => {
      const c = h.c[i + 1];
      b0.rotation.set(spreadA[i] * h.spread * 1.6 - 0.02 * i * 0, 0, -sg * c * 0.58);
      b1.rotation.set(0, 0, -sg * c * 0.62);
    });
    const tc = h.c[0];
    F.thumb[0].rotation.set(-0.7 + tc * 0.35, 0, -sg * (0.35 + tc * 0.45));
    F.thumb[1].rotation.set(0, 0, -sg * tc * 0.55);
  };
  const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), rootQ = new THREE.Quaternion();
  const lastHand = { L: HANDS.relax, R: HANDS.relax } as Record<"L" | "R", HandCurl>;

  const ch: Character = {
    spec, dims: P, root, joints: J, lampAnchor, eyeAnchor, contact, meshes,
    setHand(side, h) { const c = typeof h === "string" ? HANDS[h] : h; lastHand[side] = c; fingerCurl(side, c); },
    setFace(f) { applyFaceParams(faceU, f); },
    setExpression(e, w = 1) { applyFaceParams(faceU, w >= 1 ? EXPR[e] : mixFace(EXPR.neutral, EXPR[e], w)); },
    blendExpression(a, bb, t) { applyFaceParams(faceU, mixFace(EXPR[a], EXPR[bb], t)); },
    setBlink(t) { faceU.uFE.value.z = THREE.MathUtils.clamp(t, 0, 1); },
    setGaze(x, y) { faceU.uFE.value.x = x; faceU.uFE.value.y = y; },
    footIK(targets) {
      root.updateMatrixWorld(true); root.getWorldQuaternion(rootQ);
      for (const S of ["L", "R"] as const) {
        const t = targets[S]; if (!t) continue;
        const sg = S === "L" ? 1 : -1;
        const ank = t.clone().add(V(0, P.ankleY, 0));
        const pole = V(sg * 0.15, 0, 1).applyQuaternion(rootQ);
        solveTwoBone(J[`hip${S}`], J[`knee${S}`], J[`ankle${S}`], ank, pole, 1, rootQ);
      }
      updateContacts();
    },
    handIK(side, target, pole) {
      const sg = side === "L" ? 1 : -1;
      root.updateMatrixWorld(true); root.getWorldQuaternion(rootQ);
      const pl = pole ?? V(sg * 0.7, -0.4, -0.8).applyQuaternion(rootQ);
      // palm point sits ~0.07 m down the hand from the wrist: aim the wrist so the palm lands on the target (2 passes)
      for (let k = 0; k < 2; k++) {
        const wr = J[`wrist${side}`]; wr.updateMatrixWorld(true);
        const off = V(-sg * 0.012 * s, -0.075 * s, 0).applyQuaternion(wr.getWorldQuaternion(tmpQ));
        solveTwoBone(J[`shoulder${side}`], J[`elbow${side}`], wr, target.clone().sub(off), pl, -1);
      }
    },
    setPose(p) {
      const plant = p.plant ?? true;
      for (const n of JOINTS) {
        if (plant && /^(hip|knee|ankle)[LR]$/.test(n)) continue;
        const r = p[n]; J[n].rotation.set(r?.[0] ?? 0, r?.[1] ?? 0, r?.[2] ?? 0);
      }
      hips.position.set((p.sway ?? 0) * s, P.hipsY + (p.lift ?? 0) * s, (p.shift ?? 0) * s);
      ch.setHand("L", (p.handL ?? "relax") as HandShape | HandCurl); ch.setHand("R", (p.handR ?? "relax") as HandShape | HandCurl);
      root.updateMatrixWorld(true);
      if (plant) {
        const st = p.stance ?? 1;
        root.getWorldQuaternion(rootQ);
        for (const S of ["L", "R"] as const) {
          const sg = S === "L" ? 1 : -1;
          const fo = (S === "L" ? p.footL : p.footR) ?? [0, 0, 0];
          const heel = ((S === "L" ? p.heelL : p.heelR) ?? 0) * s;
          const lp = V(sg * P.hipX * st + fo[0] * s, P.ankleY + heel * 0.6, fo[1] * s);
          const yaw = sg * 0.08 + fo[2];
          const endQ = rootQ.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(heel > 0 ? Math.atan2(heel, 0.14 * s) : 0, yaw, 0, "YXZ")));
          const tw = root.localToWorld(lp.clone());
          const pole = V(sg * 0.15 + Math.sin(yaw) * 0.8, 0, Math.cos(yaw)).applyQuaternion(rootQ);
          solveTwoBone(J[`hip${S}`], J[`knee${S}`], J[`ankle${S}`], tw, pole, 1, endQ);
        }
      }
      const rw = p.reachW ?? 1;
      for (const S of ["L", "R"] as const) {
        const rt = S === "L" ? p.reachL : p.reachR;
        if (!rt || rw <= 0.001) continue;
        root.updateMatrixWorld(true);
        const wr = J[`wrist${S}`]; wr.updateMatrixWorld(true);
        const cur = wr.getWorldPosition(new THREE.Vector3());
        const tgt = root.localToWorld(V(rt[0] * s, rt[1] * s, rt[2] * s));
        // blend: move the target from the FK palm toward the reach point
        const sg = S === "L" ? 1 : -1;
        const palm = cur.clone().add(V(-sg * 0.012 * s, -0.075 * s, 0).applyQuaternion(wr.getWorldQuaternion(tmpQ)));
        ch.handIK(S, palm.lerp(tgt, Math.min(1, rw)));
      }
      updateContacts();
    },
    setState(st) { applyState(st, st); },
    followLook() { applyState(-1, Math.round(U.uState.value) as 0 | 1 | 2); },
    setOutline(on) { outline = on; hulls.forEach((h) => (h.visible = on && curState === 0)); },
  };
  let outline = true, curState = 2;
  function applyState(lock: number, st: 0 | 1 | 2) {
    curState = st;
    for (const m of mats) {
      lockMat(m, lock);
      const add = st === 1 ? THREE.AdditiveBlending : THREE.NormalBlending;
      if (m.blending !== add) { m.blending = add; m.needsUpdate = true; }
    }
    syncLookFlags();
    hulls.forEach((h) => (h.visible = outline && st === 0));
    skeleton.forEach((o) => (o.visible = st === 1));
    meshes.forEach((m) => (m.castShadow = st === 2));
    contact.visible = st === 2;
  }
  function updateContacts() {
    root.updateMatrixWorld(true); root.getWorldQuaternion(rootQ);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    let cx = 0, cz = 0;
    (["L", "R"] as const).forEach((S, i) => {
      const a = J[`ankle${S}`]; a.getWorldPosition(tmpV).applyMatrix4(inv);
      const fwd = V(0, 0, 0.04 * s).applyQuaternion(a.getWorldQuaternion(tmpQ).premultiply(rootQ.clone().invert()));
      const bl = blobs[i];
      bl.position.set(tmpV.x + fwd.x, 0.002, tmpV.z + fwd.z);
      const lift = Math.max(0, tmpV.y - P.ankleY);
      (bl.material as THREE.MeshBasicMaterial).opacity = 0.55;
      bl.scale.setScalar(1 + lift * 3); bl.visible = lift < 0.25;
      const e = new THREE.Euler().setFromQuaternion(a.getWorldQuaternion(tmpQ).premultiply(rootQ.clone().invert()), "YXZ");
      bl.rotation.set(-Math.PI / 2, 0, e.y);
      cx += tmpV.x / 2; cz += tmpV.z / 2;
    });
    J.hips.getWorldPosition(tmpV).applyMatrix4(inv);
    bodyBlob.position.set((tmpV.x + cx) / 2, 0.001, (tmpV.z + cz) / 2 + 0.02 * s);
  }
  ch.setExpression("neutral");
  faceU.uFE.value.w = spec.face.eyeScale ?? 1;
  return ch;
}
