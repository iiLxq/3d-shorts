// [hybrid/cast] Data-driven character builder: CharacterSpec -> stylized graphic-novel 3D figure, shaded with the shared
// gouache paint. Polish v2:
//  - CONTINUOUS GARMENTS: the jacket body, sleeves and trouser legs are lofted cloth shells SKINNED to the joint
//    hierarchy (THREE.SkinnedMesh, smooth weights), so a sleeve bends as one piece of fabric; no ball joints or tube
//    segments. Rigid parts (head, hands, boots, props) still ride their joints.
//  - CLOTH DESIGN: boxy jacket with a navy yoke, stand collar, zip placket, pocket flaps, rolled cuffs, elbow patches,
//    reflective tape with a painted glint; baggy work trousers with cargo + knee patches over chunky boots; painted
//    fold strokes (mat.ts) that deepen with the live bends; warm amber-brown shadow plane on the brand amber.
//  - HEADS: wider skull with a real brow ridge, a distinctive nose, a sculpted beard volume (Rafa), hair as sculpted
//    clumps with painted strands (Noor's bun), helmet lifted off the brows + a bounce fill on the eye band.
//  - ANTI-MANNEQUIN: asymmetric props (radio on a cross strap, pen, rag in the back pocket; lanyard, watch, earrings).
// Units: metres. Root at the ground between the feet, +y up, character faces +z, L = character's left = +x.
import * as THREE from "three";
import { BRAND, U, syncLookFlags } from "../look/shade";
import { sculpt, sculptPoint, SculptOpts, rbox, extrude, roundedRectShape, band, ribbon, tube } from "./sculpt";
import { charMat, hullMat, lockMat, castUniforms } from "./mat";
import { EXPR, ExprName, FaceParams, FaceStyle, makeFaceUniforms, applyFaceParams, mixFace } from "./face";
import { JOINTS, JointName, Pose, HandCurl, HandShape, HANDS } from "./poses";
import { solveTwoBone } from "./ik";
import { Loft, Sec, loftGeo, loftBand, loftRibbon, stripGeo, placed, mergeIdx, addSkin, Weights, FoldFn, sstep } from "./garment";

export type Build = "slim" | "average" | "broad";
export type Accessory = "helmet" | "headlamp" | "toolbelt" | "glasses" | "lanyard" | "watch" | "kneepads" | "radio" | "rag" | "earrings";
export type CharacterSpec = {
  id: string; name: string; role: string;
  heightM: number;     // top of the skull (no hat)
  heads: number;       // body height in head heights (chin..crown)
  build: Build;
  skin: string;
  hair: { style: "crop" | "bun" | "bob" | "none"; color: string };
  face: {
    beard: number; beardColor?: string; beardGrey?: string; iris: string; brow: string; lip: string; browW?: number; eyeScale?: number; nose?: number; jaw?: number;
    eyeTilt?: number; lashW?: number; age?: number; // polish v2 (optional)
  };
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
  broad: { sh: 1.07, limb: 1.05, dep: 1.05, waist: 1.03, hip: 1.02 },
};

export function proportions(spec: CharacterSpec): Proportions {
  const H = spec.heightM, h = H / spec.heads, s = H / 1.8;
  const b = BUILD[spec.build], k = spec.body ?? {};
  const ankleY = 0.082 * s, kneeY = 0.283 * H, hipJY = 0.497 * H, hipsY = hipJY + 0.035 * s;
  const spineY = hipsY + 0.1 * s, chestY = spineY + 0.13 * s;
  const chin = H - h, neckY = chin - 0.062 * s, headJY = chin + 0.022 * s, skullY = H - h / 2;
  const shoulderY = neckY - 0.034 * s;
  const shoulderX = 0.166 * s * b.sh * (k.shoulder ?? 1);
  return {
    H, h, s, ankleY, kneeY, hipJY, hipsY, spineY, chestY, neckY, headJY, skullY, shoulderY, shoulderX,
    clavX: 0.035 * s, hipX: 0.088 * s * b.hip * (k.hip ?? 1),
    upperArm: 0.17 * H, foreArm: 0.142 * H, thigh: hipJY - kneeY, shin: kneeY - ankleY,
    // polish v2: wider, squarer graphic-novel skull (was 0.318 / 0.49 / 0.385)
    skull: new THREE.Vector3(h * 0.35, h * 0.49, h * 0.4), topY: H,
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
const Q = (x: number, y: number, z: number) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));

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
const BI = (n: JointName) => JOINTS.indexOf(n);

export function buildCharacter(spec: CharacterSpec): Character {
  const P = proportions(spec);
  const s = P.s, b = BUILD[spec.build], bk = spec.body ?? {};
  const limbK = b.limb * (bk.limb ?? 1), dep = b.dep * (bk.depth ?? 1), waistK = b.waist * (bk.waist ?? 1), hipK = b.hip * (bk.hip ?? 1);
  const O = spec.outfit, pal = spec.palette, acc = new Set(spec.accessories);
  const work = O.top === "workJacket";
  const cu = castUniforms();
  const faceU = makeFaceUniforms({
    skin: spec.skin, lip: spec.face.lip, iris: spec.face.iris, brow: spec.face.brow, lash: pal.lash ?? "#241a18",
    beard: spec.face.beardColor ?? spec.hair.color, beardGrey: spec.face.beardGrey ?? spec.hair.color, beardAmt: spec.face.beard,
    browW: spec.face.browW ?? 1, eyeScale: spec.face.eyeScale ?? 1, eyeTilt: spec.face.eyeTilt, lashW: spec.face.lashW, age: spec.face.age,
  } as FaceStyle, P.skull);
  faceU.uFE.value.w = spec.face.eyeScale ?? 1;

  const mats: THREE.MeshLambertMaterial[] = [];
  const M = (color: string, o: Parameters<typeof charMat>[2] = {}) => { const m = charMat(cu, color, o); mats.push(m); return m; };
  const isBrandTop = O.topColor.toUpperCase() === BRAND.amber;
  const clothWarm: [string, number] = ["#8a7a6c", 0.22];
  const mat = {
    skin: M(spec.skin, { rim: 0.3, emissive: spec.skin, emissiveIntensity: 0.07, spec: 0.25, gloss: 18, specTh: 0.9 }),
    face: M(spec.skin, { rim: 0.3, face: faceU, emissive: spec.skin, emissiveIntensity: 0.07, bounce: acc.has("helmet") ? 0.42 : 0.18, spec: 0.22, gloss: 18, specTh: 0.95 }),
    // amber jacket: lit step = brand (look's brand lock); shadow plane + folds = warm amber-brown (uWarm)
    top: M(O.topColor, { rim: 0.45, fold: 1.25, warm: isBrandTop ? ["#5a3a26", 0.86] : clothWarm, brushScale: 6 }),
    trim: M(O.trim, { fold: 1.0, warm: clothWarm }),
    under: M(O.under ?? O.trim, { fold: 0.8, warm: ["#a08a76", 0.3] }),
    lower: M(O.lowerColor, { fold: 1.3, warm: clothWarm, brushScale: 6 }),
    seam: M(pal.seam ?? O.trim, { brush: 0.3, fold: 0.6 }),
    tape: M(pal.tape ?? "#C9D4D6", { rim: 0.6, emissive: pal.tape ?? "#C9D4D6", emissiveIntensity: 0.1, spec: 0.85, gloss: 14, specTh: 0.5, hot: 1, brush: 0.3, fold: 0.7 }),
    shoe: M(O.shoeColor, { spec: 0.35, gloss: 30, specTh: 0.6 }), sole: M(pal.sole ?? "#2A2526"), toe: M(pal.toe ?? O.shoeColor, { spec: 0.5, gloss: 40, specTh: 0.55 }),
    glove: M(O.gloves ?? spec.skin, { rim: O.gloves ? 0.35 : 0.3 }),
    hair: M(spec.hair.color, { brush: 0.8, brushScale: 11, rim: 0.25, spec: 0.5, gloss: 26, specTh: 0.55,
      strand: { k: 1, n: spec.hair.style === "bun" ? 46 : 60, focus: spec.hair.style === "bun" ? V(0, P.skull.y * 1.05, -P.skull.z * 0.45) : V(0, P.skull.y * 1.2, -P.skull.z * 0.2), light: "#7a6052" } }),
    beard: M(spec.face.beardColor ?? spec.hair.color, { brush: 0.9, brushScale: 14, rim: 0.2, jaw: faceU }),
    leather: M(pal.leather ?? "#6C4733", { spec: 0.4, gloss: 30, specTh: 0.6 }), metal: M(pal.metal ?? "#9AA6AE", { rim: 0.8, spec: 0.9, gloss: 90, specTh: 0.45, metal: 0.7 }),
    dark: M(pal.dark ?? "#23262E", { spec: 0.6, gloss: 60, specTh: 0.5 }),
    helmet: M(pal.helmet ?? "#EDE6D8", { rim: 0.55, spec: 0.85, gloss: 90, specTh: 0.5, hot: 0.5 }), helmetDk: M(pal.helmetDark ?? "#B9B2A6"),
    wood: M(pal.wood ?? "#8A6040"), card: M(pal.card ?? "#E9E4DA"), accent: M(pal.accent ?? O.trim, { fold: 0.5 }),
    rag: M(pal.rag ?? "#7C8C9A", { fold: 1.4, brushScale: 9 }), gold: M(pal.gold ?? "#C8A15A", { spec: 0.9, gloss: 80, specTh: 0.4, metal: 0.6 }),
  };
  const hullM = hullMat(new THREE.Color(BRAND.cyan), 0.0032 * s);
  const meshes: THREE.Mesh[] = [], hulls: THREE.Mesh[] = [];
  const foldOn = (m: THREE.Material) => ((m.userData?.cast?.uFoldK?.value ?? 0) > 0);
  const zeroFold = (g: THREE.BufferGeometry) => { if (!g.getAttribute("aFold")) g.setAttribute("aFold", new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute("position").count * 4), 4)); };
  type AddOpt = { p?: THREE.Vector3; r?: [number, number, number]; q?: THREE.Quaternion; sc?: [number, number, number]; hull?: boolean; cast?: boolean };
  const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material, o: AddOpt = {}) => {
    if (foldOn(m)) zeroFold(geo);
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

  // ------------------------------------------------------------------ joints + skeleton (bind = rest pose, root at origin)
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
  const bones = JOINTS.map((n) => { const bn = new THREE.Bone(); bn.name = `bone-${n}`; J[n].add(bn); return bn; });
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  const rest = (n: JointName) => J[n].matrixWorld.clone();
  const IDM = new THREE.Matrix4();
  /** a skinned garment piece. geo in `frame` joint rest space (or root space), weights/folds evaluated there */
  const skinned = (geo: THREE.BufferGeometry, m: THREE.Material, wf: (p: THREE.Vector3) => Weights, ff?: FoldFn, frame?: JointName, o: { hull?: boolean } = {}) => {
    addSkin(geo, wf, ff);
    if (frame) geo.applyMatrix4(rest(frame));
    const me = new THREE.SkinnedMesh(geo, m); me.bind(skeleton, IDM);
    me.frustumCulled = false; me.castShadow = true; me.receiveShadow = true;
    root.add(me); meshes.push(me);
    if (o.hull !== false) { const hm = new THREE.SkinnedMesh(geo, hullM); hm.bind(skeleton, IDM); hm.frustumCulled = false; hm.visible = false; me.add(hm); hulls.push(hm); }
    return me;
  };
  /** group pieces by material, merge, skin once (fewer draw calls) */
  const kit = () => {
    const by = new Map<THREE.Material, THREE.BufferGeometry[]>();
    return {
      put(m: THREE.Material, g: THREE.BufferGeometry) { if (!by.has(m)) by.set(m, []); by.get(m)!.push(g); },
      skin(wf: (p: THREE.Vector3) => Weights, ff?: FoldFn, frame?: JointName, noHull?: Set<THREE.Material>) {
        by.forEach((gs, m) => skinned(mergeIdx(gs), m, wf, ff, frame, { hull: !noHull?.has(m) }));
      },
    };
  };

  // ------------------------------------------------------------------ pelvis (lower garment seat) + belt (rigid on hips)
  const pelvisO: SculptOpts = { r: [0.155 * s * hipK, 0.112 * s, 0.114 * s * dep], e1: 0.62, e2: 0.76, taperBot: 0.9, seg: [40, 24] };
  const pelvisP = V(0, -0.028 * s, 0);
  add(hips, sculpt(pelvisO), mat.lower, { p: pelvisP });
  add(hips, ribbon(pelvisO, [D(0, 0.6, 1), D(0, -0.2, 1), D(0, -0.9, 0.5)], 0.012 * s, 0.002 * s), mat.seam, { p: pelvisP, hull: false }); // fly seam
  // back pockets (seat)
  for (const sg of [1, -1]) onSurf(hips, pelvisO, pelvisP, D(sg * 0.42, -0.25, -0.9), rbox(0.095 * s, 0.1 * s, 0.012 * s, 0.01 * s), mat.lower, 0.002 * s);

  // ------------------------------------------------------------------ TORSO garment (skinned loft, root space)
  const W = waistK, X = P.shoulderX;
  const hemY = P.hipsY - (work ? 0.105 : 0.13) * s;
  const yTop = P.neckY + 0.014 * s;
  const torsoSecs: Sec[] = work ? [
    { y: hemY, rx: 0.171 * s * W, rzF: 0.128 * s * dep, rzB: 0.12 * s * dep, e: 0.74, cz: 0.004 * s },
    { y: hemY + 0.05 * s, rx: 0.168 * s * W, rzF: 0.126 * s * dep, rzB: 0.118 * s * dep, e: 0.72, cz: 0.004 * s },
    { y: P.spineY, rx: 0.164 * s * W, rzF: 0.124 * s * dep, rzB: 0.115 * s * dep, e: 0.7, cz: 0.004 * s },
    { y: P.chestY, rx: 0.174 * s * Math.max(W, 1), rzF: 0.132 * s * dep, rzB: 0.122 * s * dep, e: 0.66, cz: 0.002 * s },
    { y: P.shoulderY - 0.06 * s, rx: X + 0.016 * s, rzF: 0.118 * s * dep, rzB: 0.118 * s * dep, e: 0.6, cz: -0.006 * s },
    { y: P.shoulderY + 0.006 * s, rx: X + 0.012 * s, rzF: 0.098 * s * dep, rzB: 0.104 * s * dep, e: 0.68, cz: -0.012 * s },
    { y: P.shoulderY + 0.03 * s, rx: X * 0.7, rzF: 0.082 * s, rzB: 0.088 * s, e: 0.86, cz: -0.014 * s },
    { y: yTop, rx: 0.074 * s, rzF: 0.068 * s, rzB: 0.074 * s, e: 1, cz: -0.012 * s },
  ] : [
    { y: hemY, rx: 0.162 * s * hipK, rzF: 0.12 * s * dep, rzB: 0.122 * s * dep, e: 0.85, cz: 0.002 * s },
    { y: hemY + 0.06 * s, rx: 0.156 * s * hipK, rzF: 0.113 * s * dep, rzB: 0.116 * s * dep, e: 0.85 },
    { y: P.spineY, rx: 0.135 * s * W, rzF: 0.1 * s * dep, rzB: 0.098 * s * dep, e: 0.84 },
    { y: P.chestY, rx: 0.15 * s, rzF: 0.118 * s * dep, rzB: 0.106 * s * dep, e: 0.78 },
    { y: P.shoulderY - 0.06 * s, rx: X + 0.016 * s, rzF: 0.108 * s * dep, rzB: 0.104 * s * dep, e: 0.62, cz: -0.004 * s },
    { y: P.shoulderY + 0.006 * s, rx: X + 0.016 * s, rzF: 0.09 * s * dep, rzB: 0.094 * s * dep, e: 0.62, cz: -0.01 * s },
    { y: P.shoulderY + 0.028 * s, rx: X * 0.66, rzF: 0.074 * s, rzB: 0.08 * s, e: 0.86, cz: -0.012 * s },
    { y: yTop, rx: 0.066 * s, rzF: 0.06 * s, rzB: 0.066 * s, e: 1, cz: -0.012 * s },
  ];
  const TL = new Loft(torsoSecs);
  const armpitY = P.shoulderY - 0.075 * s;
  const foldBaseY = P.hipsY + 0.06 * s;
  cu.uBendB.value.w = armpitY - foldBaseY;
  const torsoW = (p: THREE.Vector3): Weights => {
    const y = p.y;
    const wH = 1 - sstep(P.hipsY - 0.03 * s, P.spineY - 0.01 * s, y);
    const wC = sstep(P.spineY + 0.03 * s, P.chestY + 0.015 * s, y);
    const ax = Math.abs(p.x);
    const wCl = sstep(X * 0.45, X * 0.95, ax) * sstep(P.shoulderY - 0.1 * s, P.shoulderY - 0.01 * s, y) * 0.6;
    const cl: JointName = p.x > 0 ? "clavL" : "clavR";
    const wN = sstep(P.neckY - 0.01 * s, yTop + 0.03 * s, y) * 0.5;
    const rem = 1 - wCl - wN;
    return [[BI("hips"), wH * rem], [BI("spine"), (1 - wH) * (1 - wC) * rem], [BI("chest"), (1 - wH) * wC * rem], [BI(cl), wCl], [BI("neck"), wN]];
  };
  const torsoF: FoldFn = (p) => [p.y - foldBaseY, Math.atan2(p.x, p.z), 4, 1];
  const tk = kit();
  tk.put(mat.top, loftGeo(TL, { rows: 44, cols: 56, capTop: true, capBot: true }));
  // hem band + side seams + back yoke seam
  tk.put(work ? mat.trim : mat.top, loftBand(TL, hemY + 0.004 * s, hemY + 0.036 * s, 0.004 * s, 56, 3));
  for (const sg of [1, -1]) tk.put(mat.seam, loftRibbon(TL, [[hemY + 0.03 * s, sg * 1.62], [P.chestY, sg * 1.6], [P.shoulderY - 0.07 * s, sg * 1.62]], 0.006 * s, 0.0016 * s));
  if (work) {
    // navy yoke (two-tone hi-vis): shoulders + upper back
    tk.put(mat.trim, loftGeo(TL, { y0: P.shoulderY - 0.035 * s, y1: yTop, rows: 10, cols: 56, inflate: 0.0025 * s }));
    tk.put(mat.seam, loftBand(TL, P.shoulderY - 0.04 * s, P.shoulderY - 0.033 * s, 0.003 * s, 56, 1));
    // zip placket + zipper teeth line
    tk.put(mat.trim, loftRibbon(TL, [[hemY + 0.004 * s, 0], [P.spineY, 0], [P.chestY, 0], [yTop - 0.004 * s, 0]], 0.032 * s, 0.004 * s, 12, 0.003 * s));
    tk.put(mat.dark, loftRibbon(TL, [[hemY + 0.006 * s, 0], [P.chestY, 0], [yTop - 0.006 * s, 0]], 0.006 * s, 0.0075 * s, 12));
    // chest pockets (with flaps + snaps), lower hand-warmer pockets with slanted welts
    for (const sg of [1, -1]) {
      const f1 = TL.frame(P.chestY + 0.035 * s, sg * 0.5, 0.004 * s);
      tk.put(mat.top, placed(rbox(0.088 * s, 0.096 * s, 0.014 * s, 0.007 * s), f1.p, f1.q));
      const f2 = TL.frame(P.chestY + 0.084 * s, sg * 0.5, 0.008 * s, sg * 0.03);
      tk.put(mat.trim, placed(rbox(0.096 * s, 0.032 * s, 0.016 * s, 0.007 * s), f2.p, f2.q));
      const f3 = TL.frame(P.chestY + 0.08 * s, sg * 0.5, 0.017 * s);
      tk.put(mat.metal, placed(new THREE.CylinderGeometry(0.005 * s, 0.005 * s, 0.006 * s, 10).rotateX(Math.PI / 2), f3.p, f3.q));
      const f4 = TL.frame(P.spineY - 0.035 * s, sg * 0.62, 0.005 * s, -sg * 0.5);
      tk.put(mat.trim, placed(rbox(0.11 * s, 0.022 * s, 0.014 * s, 0.006 * s), f4.p, f4.q));
    }
    if (O.stripes) {
      tk.put(mat.tape, loftBand(TL, P.chestY - 0.03 * s, P.chestY + 0.018 * s, 0.0045 * s, 64, 3));
      tk.put(mat.tape, loftBand(TL, P.spineY - 0.085 * s, P.spineY - 0.037 * s, 0.0045 * s, 64, 3));
      for (const sg of [1, -1]) {
        // tape braces: front up over the shoulder, down the back
        tk.put(mat.tape, loftRibbon(TL, [[P.spineY - 0.04 * s, sg * 0.42], [P.chestY + 0.03 * s, sg * 0.43], [P.shoulderY - 0.03 * s, sg * 0.52],
          [P.shoulderY + 0.022 * s, sg * 1.2], [P.shoulderY - 0.03 * s, sg * (Math.PI - 0.52)], [P.chestY, sg * (Math.PI - 0.43)], [P.spineY - 0.04 * s, sg * (Math.PI - 0.42)]], 0.044 * s, 0.006 * s, 8));
      }
    }
  } else {
    // blazer: blouse V (width grows to the neck), notched lapels with relief, front edge line, buttons, welt pockets
    const vb = P.chestY - 0.07 * s;
    const vPts: [number, number][] = [[vb, 0], [P.chestY + 0.04 * s, 0], [yTop - 0.006 * s, 0]];
    tk.put(mat.under, loftRibbon(TL, vPts, 0.001, 0.003 * s, 12).computeVertexNormals() as unknown as THREE.BufferGeometry);
    const vN: THREE.Vector3[] = [], vP: THREE.Vector3[] = [];
    for (let i = 0; i <= 20; i++) { const y = THREE.MathUtils.lerp(vb, yTop - 0.004 * s, i / 20); vP.push(TL.at(y, 0).addScaledVector(TL.normal(y, 0), 0.0035 * s)); vN.push(TL.normal(y, 0)); }
    tk.put(mat.under, stripGeo(vP, vN, (t) => THREE.MathUtils.lerp(0.006, 0.13, Math.pow(t, 0.8)) * s));
    for (const sg of [1, -1]) {
      const lp: [number, number][] = [[vb - 0.005 * s, sg * 0.04], [P.chestY + 0.02 * s, sg * 0.24], [P.shoulderY - 0.04 * s, sg * 0.42], [yTop - 0.002 * s, sg * 0.75]];
      const pts: THREE.Vector3[] = [], nr: THREE.Vector3[] = [];
      for (let i = 0; i < lp.length - 1; i++) for (let k = 0; k < 8; k++) {
        const t = k / 8, y = THREE.MathUtils.lerp(lp[i][0], lp[i + 1][0], t), a = THREE.MathUtils.lerp(lp[i][1], lp[i + 1][1], t);
        const n = TL.normal(y, a); pts.push(TL.at(y, a).addScaledVector(n, 0.007 * s)); nr.push(n);
      }
      const n = TL.normal(lp[3][0], lp[3][1]); pts.push(TL.at(lp[3][0], lp[3][1]).addScaledVector(n, 0.007 * s)); nr.push(n);
      // lapel: narrow at the button, widest at the notch (~70 %), then the collar
      tk.put(mat.top, stripGeo(pts, nr, (t) => (t < 0.68 ? THREE.MathUtils.lerp(0.012, 0.062, t / 0.68) : t < 0.74 ? 0.03 : 0.045 - 0.015 * (t - 0.74) / 0.26) * s, 0.006 * s));
      tk.put(mat.seam, stripGeo(pts.map((p, i) => p.clone().addScaledVector(nr[i], 0.0006 * s)), nr, 0.004 * s));
      // front edge below the button: a cutaway curve
      tk.put(mat.seam, loftRibbon(TL, [[vb - 0.01 * s, sg * 0.02], [P.spineY - 0.04 * s, sg * 0.03], [hemY + 0.04 * s, sg * 0.1], [hemY + 0.006 * s, sg * 0.22]], 0.005 * s, 0.003 * s, 8));
      const fw = TL.frame(P.spineY - 0.07 * s, sg * 0.62, 0.003 * s, -sg * 0.12);
      tk.put(mat.seam, placed(rbox(0.09 * s, 0.012 * s, 0.01 * s, 0.004 * s), fw.p, fw.q));
    }
    for (const y of [vb - 0.03 * s, P.spineY - 0.04 * s]) { const fb = TL.frame(y, 0.03, 0.006 * s); tk.put(mat.dark, placed(new THREE.CylinderGeometry(0.008 * s, 0.008 * s, 0.006 * s, 14).rotateX(Math.PI / 2), fb.p, fb.q)); }
    // blouse stand collar
    tk.put(mat.under, loftBand(new Loft([{ y: yTop - 0.01 * s, rx: 0.064 * s, rzF: 0.06 * s, rzB: 0.066 * s, cz: -0.01 * s }, { y: yTop + 0.03 * s, rx: 0.058 * s, rzF: 0.055 * s, rzB: 0.06 * s, cz: -0.012 * s }]), yTop - 0.008 * s, yTop + 0.028 * s, 0.004 * s, 40, 3));
  }
  if (work) {
    // stand-up collar (navy) with a rolled lip
    const CL = new Loft([
      { y: yTop - 0.015 * s, rx: 0.08 * s, rzF: 0.074 * s, rzB: 0.08 * s, cz: -0.012 * s },
      { y: yTop + 0.03 * s, rx: 0.074 * s, rzF: 0.068 * s, rzB: 0.076 * s, cz: -0.016 * s },
      { y: yTop + 0.042 * s, rx: 0.077 * s, rzF: 0.071 * s, rzB: 0.079 * s, cz: -0.017 * s },
    ]);
    tk.put(mat.trim, loftGeo(CL, { rows: 6, cols: 40, a0: -Math.PI + 0.25, a1: Math.PI - 0.25 }));
    tk.put(mat.trim, loftGeo(CL, { rows: 6, cols: 40, a0: -Math.PI + 0.25, a1: Math.PI - 0.25, inflate: -0.004 * s }));
  }
  tk.skin(torsoW, torsoF, undefined, new Set([mat.seam, mat.dark, mat.metal]));

  // ------------------------------------------------------------------ tool belt / belt (rigid on hips, sized to the jacket)
  if (acc.has("toolbelt")) {
    const by = P.hipsY + 0.035 * s, bs = TL.sec(by);
    const beltO: SculptOpts = { r: [bs.rx + 0.01 * s, 0.026 * s, Math.max(bs.rzF, bs.rzB) + 0.01 * s], e1: 0.18, e2: 0.74, seg: [48, 8] };
    const beltP = V(0, 0.035 * s, 0.004 * s);
    add(hips, sculpt(beltO), mat.leather, { p: beltP });
    add(hips, rbox(0.07 * s, 0.052 * s, 0.016 * s, 0.006 * s), mat.metal, { p: beltP.clone().add(V(0, 0, beltO.r[2] + 0.004 * s)) });
    for (const sg of [1, -1]) {
      const pouch = new THREE.Group(); pouch.position.copy(beltP).add(V(sg * beltO.r[0] * 0.92, -0.055 * s, beltO.r[2] * 0.35)); pouch.rotation.set(0.05, sg * 0.9, sg * 0.04); hips.add(pouch);
      add(pouch, rbox(0.08 * s, 0.12 * s, 0.055 * s, 0.016 * s), mat.leather, { p: V(0, 0, 0.014 * s) });
      add(pouch, rbox(0.086 * s, 0.038 * s, 0.062 * s, 0.012 * s), mat.leather, { p: V(0, 0.048 * s, 0.016 * s), r: [0.12, 0, 0] });
      add(pouch, rbox(0.012 * s, 0.012 * s, 0.01 * s, 0.003 * s), mat.metal, { p: V(0, 0.036 * s, 0.05 * s) });
      // tool handles sticking out (screwdriver + pliers): asymmetric silhouettes
      if (sg > 0) {
        add(pouch, new THREE.CylinderGeometry(0.008 * s, 0.01 * s, 0.07 * s, 10), mat.dark, { p: V(0.018 * s, 0.085 * s, 0.006 * s), r: [0, 0, 0.15] });
        add(pouch, new THREE.CylinderGeometry(0.0055 * s, 0.0055 * s, 0.07 * s, 10), mat.accent, { p: V(-0.016 * s, 0.09 * s, 0.01 * s), r: [0.1, 0, -0.2] });
      } else add(pouch, rbox(0.03 * s, 0.06 * s, 0.012 * s, 0.005 * s), mat.dark, { p: V(0.0, 0.08 * s, 0.01 * s), r: [0, 0, 0.12] });
    }
    const hammer = new THREE.Group(); hammer.position.copy(beltP).add(V(0.11 * s, -0.02 * s, -beltO.r[2] * 0.9)); hammer.rotation.set(0.12, 0.3, 0.1); hips.add(hammer);
    add(hammer, new THREE.CylinderGeometry(0.011 * s, 0.013 * s, 0.24 * s, 12), mat.wood, { p: V(0, -0.08 * s, 0) });
    add(hammer, rbox(0.03 * s, 0.032 * s, 0.11 * s, 0.006 * s), mat.metal, { p: V(0, 0.04 * s, 0.01 * s) });
    const tape = new THREE.Group(); tape.position.copy(beltP).add(V(-0.13 * s, -0.035 * s, -beltO.r[2] * 0.82)); tape.rotation.y = -2.4; hips.add(tape);
    add(tape, rbox(0.07 * s, 0.07 * s, 0.036 * s, 0.016 * s), mat.dark);
    add(tape, new THREE.CylinderGeometry(0.02 * s, 0.02 * s, 0.04 * s, 20).rotateX(Math.PI / 2), mat.metal);
  }
  if (acc.has("rag")) {
    // rag hanging from the right back pocket: a soft folded cloth (asymmetry + a secondary shape that moves with the hips)
    const rag = new THREE.Group(); rag.position.set(-0.075 * s, -0.04 * s, -pelvisO.r[2] * 0.95); rag.rotation.set(0.12, 0.25, 0.08); hips.add(rag);
    const rg = sculpt({ r: [0.04 * s, 0.085 * s, 0.012 * s], e1: 0.7, e2: 0.6, taperBot: 1.35, seg: [20, 18],
      disp: (d) => 0.006 * s * Math.sin(d.x * 9 + d.y * 4) * Math.max(0, -d.y + 0.2) });
    add(rag, rg, mat.rag, { p: V(0, -0.06 * s, 0) });
    add(rag, sculpt({ r: [0.03 * s, 0.022 * s, 0.014 * s], e1: 0.6, e2: 0.7, seg: [14, 10] }), mat.rag, { p: V(0, 0.02 * s, 0.002 * s) });
  }

  // ------------------------------------------------------------------ neck + head
  const neckLen = P.headJY - P.neckY + 0.07 * s;
  add(neck, sculpt({ r: [0.056 * s, neckLen / 2, 0.06 * s], e1: 0.85, e2: 0.95, taperTop: 0.9, seg: [24, 12] }), mat.skin, { p: V(0, neckLen / 2 - 0.02 * s, 0.004 * s) });
  const hc = new THREE.Group(); hc.name = "skull"; hc.position.set(0, P.skullY - P.headJY, 0.018 * s); head.add(hc);
  const R = P.skull, jawK = spec.face.jaw ?? 1, beardV = spec.face.beard;
  const hd = (d: THREE.Vector3, c: THREE.Vector3, w: number) => gauss(d, D(c.x, c.y, c.z), w);
  const skullO: SculptOpts = {
    r: [R.x, R.y, R.z], e1: 0.8, e2: 0.78, taperBot: 0.8 + 0.08 * jawK, taperBotZ: 0.95, seg: [80, 60],
    disp: (d) => {
      let v = 0;
      for (const sg of [1, -1]) {
        v -= 0.008 * s * hd(d, V(sg * 0.42, 0.02, 0.9), 0.15);                    // eye sockets (painted eyes sit in them)
        v += 0.009 * s * hd(d, V(sg * 0.6, -0.12, 0.78), 0.24);                   // cheekbones
        v += 0.01 * s * jawK * hd(d, V(sg * 0.74, -0.62, 0.3), 0.3);              // jaw angle
        v -= 0.006 * s * hd(d, V(sg * 0.84, 0.3, 0.42), 0.24);                    // temples
        v -= 0.005 * s * hd(d, V(sg * 0.55, -0.42, 0.75), 0.2) * (1 - beardV);    // cheek hollows (under the beard: filled)
      }
      v += 0.011 * s * Math.exp(-Math.pow((d.y - 0.2) / 0.075, 2)) * sstep(0.55, 0.92, d.z) * (1 - 0.5 * Math.exp(-Math.pow(d.x / 0.12, 2))); // brow ridge
      v += 0.004 * s * Math.exp(-Math.pow((d.y - 0.12) / 0.06, 2)) * Math.exp(-Math.pow(d.x / 0.07, 2)) * sstep(0.8, 0.98, d.z); // glabella
      v += 0.015 * s * jawK * hd(d, V(0, -0.8, 0.6), 0.25);                         // chin
      v += 0.007 * s * hd(d, V(0, -0.5, 0.86), 0.28);                               // muzzle
      v += 0.012 * s * hd(d, V(0, 0.35, -0.94), 0.55);                              // occiput
      if (beardV > 0) {
        // sculpted beard volume: boxed beard mass on the jaw + chin, clumped edge, mouth kept clear
        const ax = Math.abs(d.x);
        const top = THREE.MathUtils.lerp(-0.42, -0.05, sstep(0.3, 0.95, ax));
        const inB = 1 - sstep(top - 0.06, top + 0.02, d.y);
        const mouth = Math.exp(-Math.pow(d.x / 0.2, 2) - Math.pow((d.y + 0.56) / 0.07, 2)) * sstep(0.6, 0.9, d.z);
        const clump = 0.5 + 0.5 * Math.sin(Math.atan2(d.x, d.z) * 22 + d.y * 9) * Math.sin(d.y * 31 + d.x * 7);
        v += beardV * 0.011 * s * inB * sstep(-0.4, 0.1, d.z) * (1 - 0.8 * mouth) * (0.75 + 0.35 * clump) * (1 + 0.6 * sstep(-0.55, -0.95, d.y));
      }
      return v;
    },
  };
  add(hc, sculpt(skullO), mat.face);
  // nose: a real bridge + a distinctive tip (Rafa: broad, slightly hooked; Noor: short, rounded, wide wings)
  const ns = spec.face.nose ?? 1;
  onSurf(hc, skullO, V(0, 0, 0), D(0, 0.04, 1), sculpt({ r: [0.011 * s * ns, 0.04 * s, 0.012 * s * ns], e1: 0.7, e2: 0.7, taperTop: 0.6, taperBot: 1.2, seg: [16, 14] }), mat.skin, -0.006 * s, new THREE.Euler(-0.18, 0, 0));
  onSurf(hc, skullO, V(0, 0, 0), D(0, -0.2, 1), sculpt({ r: [0.016 * s * ns, 0.03 * s * ns, 0.021 * s * ns], e1: 0.78, e2: 0.86, taperTop: 0.55, taperBot: 1.3, leanTop: [0, -0.012 * s], seg: [20, 16],
    disp: (d) => 0.003 * s * ns * Math.exp(-Math.pow((d.y + 0.45) / 0.35, 2)) * Math.max(0, d.z) }), mat.skin, -0.004 * s, new THREE.Euler(-0.12, 0, 0));
  for (const sg of [1, -1]) onSurf(hc, skullO, V(0, 0, 0), D(sg * 0.12, -0.31, 0.98), sculpt({ r: [0.011 * s * ns, 0.009 * s, 0.01 * s], seg: [14, 10] }), mat.skin, -0.002 * s);
  for (const sg of [1, -1]) {
    onSurf(hc, skullO, V(0, 0, 0), D(sg, -0.02, -0.1), sculpt({ r: [0.024 * s, 0.034 * s, 0.009 * s], e1: 0.8, e2: 0.8, taperBot: 0.75, seg: [16, 12],
      disp: (d) => -0.004 * s * Math.exp(-Math.pow(d.x / 0.5, 2) - Math.pow(d.y / 0.5, 2)) * Math.max(0, d.z) }), mat.skin, -0.002 * s, new THREE.Euler(0, -0.35, 0));
    if (acc.has("earrings")) {
      const ep = sculptPoint(D(sg, -0.2, 0.05), skullO, new THREE.Vector3());
      add(hc, new THREE.TorusGeometry(0.008 * s, 0.0022 * s, 6, 16), mat.gold, { p: V(ep.x + sg * 0.008 * s, ep.y - 0.022 * s, ep.z), r: [0, Math.PI / 2, 0], hull: false });
    }
  }
  // hair
  if (spec.hair.style !== "none") {
    const style = spec.hair.style;
    const bunC = V(0, R.y * 0.98, -R.z * 0.42);
    const hairO: SculptOpts = {
      ...skullO, seg: [72, 48], theta: [0, style === "bob" ? 2.25 : style === "bun" ? 2.05 : 1.72],
      disp: (d, pp) => {
        const base = skullO.disp!(d, pp) + 0.008 * s + (style === "bun" ? 0.005 * s : 0);
        const front = style === "crop" ? sstep(0.15, 0.5, d.z) * sstep(-0.3, 0.2, d.y) : sstep(0.6, 0.82, d.z) * sstep(0.62, 0.36, d.y);
        const side = style === "bob" ? 0 : sstep(0.32, 0.05, d.y) * sstep(-0.35, 0.1, d.z);
        // sculpted clumps: ridges along the meridians that converge on the bun (or the crown)
        let clump = 0;
        if (style === "bun") {
          const v2 = pp.clone().sub(bunC).normalize();
          const ph = Math.atan2(v2.x, v2.z * 0.6 - v2.y * 0.8);
          clump = 0.0035 * s * Math.pow(Math.abs(Math.sin(ph * 7.0)), 0.6) * sstep(-0.1, 0.4, d.z + 0.3);
        } else clump = 0.0025 * s * Math.pow(Math.abs(Math.sin(Math.atan2(d.x, d.z) * 9 + d.y * 5)), 0.6);
        // hairline: graphic, slightly wavy edge
        const edge = 0.003 * s * Math.sin(Math.atan2(d.x, d.z) * 14);
        return base + clump + edge - 0.034 * s * Math.max(front, side) + (style === "bob" ? 0.01 * s * sstep(0.0, -0.6, d.y) : 0);
      },
    };
    add(hc, sculpt(hairO), mat.hair);
    if (style === "bun") {
      // coiled bun: a twisted torus + a domed core, both with clump grooves
      add(hc, sculpt({ r: [0.052 * s, 0.046 * s, 0.052 * s], e1: 0.85, e2: 0.9, seg: [28, 18], disp: (d) => 0.006 * s * Math.pow(Math.abs(Math.sin(Math.atan2(d.x, d.z) * 4 + d.y * 6)), 0.7) }), mat.hair, { p: bunC.clone().add(V(0, 0.012 * s, -0.006 * s)), r: [-0.5, 0, 0] });
      const coil: THREE.Vector3[] = [];
      for (let i = 0; i <= 40; i++) { const a = (i / 40) * Math.PI * 2.6; const rr = 0.052 * s * (1 - 0.18 * i / 40); coil.push(V(Math.cos(a) * rr, 0.004 * s * i / 40 - 0.02 * s, Math.sin(a) * rr)); }
      const cg = tube(coil, 0.014 * s, 80, 10);
      add(hc, cg, mat.hair, { p: bunC.clone().add(V(0, -0.004 * s, -0.004 * s)), r: [-0.5, 0, 0] });
      add(hc, new THREE.TorusGeometry(0.04 * s, 0.006 * s, 8, 24), mat.accent, { p: bunC.clone().add(V(0, -0.028 * s, 0.012 * s)), r: [Math.PI / 2 - 0.5, 0, 0] });
      // swept fringe lock + flyaway strands at the temples (anti-helmet-hair)
      onSurf(hc, hairO, V(0, 0, 0), D(-0.3, 0.58, 0.76), sculpt({ r: [0.055 * s, 0.022 * s, 0.013 * s], e1: 0.7, taperTop: 0.55, seg: [20, 12], disp: (d) => 0.003 * s * Math.sin(d.x * 12) }), mat.hair, -0.004 * s, new THREE.Euler(0, 0, 0.4));
      for (const [sx, k] of [[1, 0], [-1, 1], [1, 2]] as [number, number][]) {
        const a0 = sculptPoint(D(sx * 0.62, 0.3 - 0.08 * k, 0.6), hairO, new THREE.Vector3());
        const pts = [a0, a0.clone().add(V(sx * 0.012 * s, -0.03 * s, 0.01 * s)), a0.clone().add(V(sx * 0.004 * s, -0.065 * s, 0.016 * s))];
        add(hc, tube(pts, 0.0016 * s, 10, 4), mat.hair, { hull: false });
      }
    }
  }
  // eye anchor
  const eyeAnchor = new THREE.Object3D(); eyeAnchor.position.set(0, 0, R.z * 0.95); hc.add(eyeAnchor);

  // helmet + headlamp (lifted + peak tipped up so the brows stay readable)
  let lampAnchor: THREE.Object3D | undefined;
  if (acc.has("helmet")) {
    const helm = new THREE.Group(); helm.position.set(0, R.y * 0.6, -0.016 * s); helm.rotation.x = -0.1; hc.add(helm);
    const shellO: SculptOpts = { r: [R.x * 1.17, R.y * 0.7, R.z * 1.1], e1: 0.74, e2: 0.86, seg: [60, 26], theta: [0, Math.PI / 2 + 0.03], taperTop: 0.95 };
    add(helm, sculpt(shellO), mat.helmet);
    add(helm, band(shellO, -0.012 * s, 0.006 * s, 0.007 * s, 64, 2), mat.helmet);          // rolled rim
    add(helm, band(shellO, 0.03 * s, 0.046 * s, 0.003 * s, 64, 2), mat.dark);             // lamp strap
    add(helm, sculpt({ r: [0.014 * s, 0.026 * s, shellO.r[2] * 0.98], e1: 0.5, e2: 0.55, theta: [0, Math.PI / 2], seg: [16, 18] }), mat.helmet, { p: V(0, shellO.r[1] * 0.82, -0.004 * s) });
    for (const sg of [1, -1]) add(helm, ribbon(shellO, [D(sg * 0.42, 0.25, 0.9), D(sg * 0.34, 0.92, 0.2), D(sg * 0.42, 0.25, -0.9)], 0.014 * s, 0.004 * s, 10), mat.helmetDk, { hull: false });
    // scuffs + a sticker (anti-prop-catalogue): small dark marks and a navy decal on the side
    add(helm, ribbon(shellO, [D(-0.95, 0.35, 0.2), D(-0.95, 0.5, -0.1)], 0.03 * s, 0.002 * s, 6), mat.accent, { hull: false });
    add(helm, sculpt({ r: [R.x * 0.96, 0.007 * s, 0.044 * s], e1: 0.35, e2: 0.9, seg: [36, 8], flatBack: 0.4 }), mat.helmet, { p: V(0, -0.004 * s, shellO.r[2] * 0.95), r: [-0.06, 0, 0] });
    if (acc.has("headlamp")) {
      const lamp = new THREE.Group(); lamp.position.set(0, 0.04 * s, shellO.r[2] * 1.0); lamp.rotation.x = 0.16; helm.add(lamp);
      add(lamp, rbox(0.056 * s, 0.038 * s, 0.032 * s, 0.01 * s), mat.dark);
      add(lamp, new THREE.CylinderGeometry(0.016 * s, 0.018 * s, 0.012 * s, 24).rotateX(Math.PI / 2), mat.metal, { p: V(0, 0, 0.018 * s) });
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.0138 * s, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.1, 1.85) }));
      lens.position.z = 0.0245 * s; lamp.add(lens);
      lampAnchor = new THREE.Object3D(); lampAnchor.position.z = 0.027 * s; lamp.add(lampAnchor);
    }
  }
  if (acc.has("glasses")) {
    const g = new THREE.Group(); hc.add(g);
    const fs = roundedRectShape(0.054 * s, 0.036 * s, 0.013 * s);
    fs.holes.push(roundedRectShape(0.044 * s, 0.027 * s, 0.009 * s));
    const ex = 0.315 * R.y * (spec.face.eyeScale ?? 1) * 1.08;
    const ez = R.z * Math.sqrt(Math.max(0, 1 - Math.pow(ex / R.x, 2.2)));
    for (const sg of [1, -1]) {
      const ep = V(sg * ex, 0, ez);
      add(g, extrude(fs, 0.005 * s, 0.0012 * s, 2, 8), mat.dark, { p: V(ep.x, ep.y + 0.003 * s, ep.z + 0.014 * s), r: [0, sg * 0.24, 0], hull: false });
      const tp = sculptPoint(D(sg * 0.95, 0.02, 0.2), skullO, new THREE.Vector3());
      add(g, tube([V(ep.x + sg * 0.027 * s, ep.y + 0.007 * s, ep.z + 0.01 * s), V(tp.x + sg * 0.008 * s, tp.y + 0.004 * s, tp.z), V(tp.x + sg * 0.004 * s, tp.y - 0.01 * s, tp.z - 0.03 * s)], 0.002 * s, 12, 5), mat.dark, { hull: false });
    }
    const bp = sculptPoint(D(0, 0.04, 1), skullO, new THREE.Vector3());
    add(g, tube([V(-0.013 * s, bp.y + 0.003 * s, bp.z + 0.008 * s), V(0, bp.y + 0.007 * s, bp.z + 0.012 * s), V(0.013 * s, bp.y + 0.003 * s, bp.z + 0.008 * s)], 0.002 * s, 8, 5), mat.dark, { hull: false });
  }
  // chest props ride the chest joint (the torso garment is 100 % chest-weighted there)
  const chestLocal = (y: number, a: number, lift: number, roll = 0) => { const f = TL.frame(y, a, lift, roll); f.p.sub(V(0, P.chestY, -0.004 * s)); return f; };
  if (acc.has("lanyard")) {
    for (const sg of [1, -1]) {
      const path: [number, number][] = [[yTop + 0.004 * s, sg * 1.0], [P.shoulderY - 0.03 * s, sg * 0.42], [P.chestY + 0.01 * s, sg * 0.18], [P.chestY - 0.05 * s, sg * 0.03]];
      const g = loftRibbon(TL, path, 0.012 * s, 0.009 * s, 10); g.translate(0, -P.chestY, 0.004 * s);
      add(chest, g, mat.accent, { hull: false });
    }
    const fc = chestLocal(P.chestY - 0.085 * s, 0, 0.016 * s, 0.05);
    add(chest, rbox(0.056 * s, 0.082 * s, 0.006 * s, 0.006 * s), mat.card, { p: fc.p, q: fc.q });
    add(chest, rbox(0.04 * s, 0.014 * s, 0.004 * s, 0.003 * s), mat.accent, { p: fc.p.clone().add(V(0, 0.022 * s, 0.004 * s)), q: fc.q });
  }
  if (work) {
    // pen clipped in the right chest pocket (asymmetry)
    const fp = chestLocal(P.chestY + 0.11 * s, -0.42, 0.016 * s, 0.12);
    add(chest, new THREE.CylinderGeometry(0.0048 * s, 0.0048 * s, 0.075 * s, 8), mat.dark, { p: fp.p, q: fp.q });
    add(chest, new THREE.CylinderGeometry(0.0052 * s, 0.0052 * s, 0.014 * s, 8), mat.metal, { p: fp.p.clone().add(V(0, 0.032 * s, 0)), q: fp.q, hull: false });
  }
  if (acc.has("radio")) {
    // cross strap (right hip -> left shoulder -> back) + a radio with antenna on the left chest
    const strap: [number, number][] = [[hemY + 0.05 * s, -0.9], [P.spineY, -0.45], [P.chestY + 0.02 * s, 0.15], [P.shoulderY - 0.02 * s, 0.6], [P.shoulderY + 0.024 * s, 1.25],
      [P.shoulderY - 0.02 * s, Math.PI - 0.6], [P.chestY, Math.PI - 0.1], [P.spineY, -Math.PI + 0.5]];
    const sk = kit();
    sk.put(mat.dark, loftRibbon(TL, strap, 0.034 * s, 0.009 * s, 10, 0.003 * s));
    sk.skin(torsoW, torsoF);
    const fr = chestLocal(P.chestY + 0.095 * s, 0.36, 0.034 * s, -0.12);
    const radio = new THREE.Group(); radio.position.copy(fr.p); radio.quaternion.copy(fr.q); chest.add(radio);
    add(radio, rbox(0.052 * s, 0.085 * s, 0.03 * s, 0.009 * s), mat.dark);
    add(radio, rbox(0.04 * s, 0.03 * s, 0.006 * s, 0.003 * s), mat.metal, { p: V(0, -0.014 * s, 0.016 * s), hull: false });
    add(radio, new THREE.CylinderGeometry(0.0045 * s, 0.006 * s, 0.07 * s, 8), mat.dark, { p: V(0.016 * s, 0.075 * s, 0) });
    add(radio, new THREE.CylinderGeometry(0.008 * s, 0.008 * s, 0.012 * s, 10), mat.dark, { p: V(-0.014 * s, 0.048 * s, 0) });
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.0035 * s, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 1.4, 0.55) }));
    led.position.set(-0.014 * s, 0.03 * s, 0.016 * s); radio.add(led);
  }

  // ------------------------------------------------------------------ ARMS: skinned sleeves + rigid hands
  const fingers: Record<"L" | "R", { segs: THREE.Group[][]; thumb: THREE.Group[]; side: number }> = { L: { segs: [], thumb: [], side: 1 }, R: { segs: [], thumb: [], side: -1 } };
  const gl = O.gloves ? 1.14 : 1;
  const UA = P.upperArm, FA = P.foreArm;
  for (const S of ["L", "R"] as const) {
    const sg = S === "L" ? 1 : -1;
    const wr = J[`wrist${S}`];
    const r = (work ? 0.06 : 0.051) * s * limbK;
    const yC = -UA - FA + (work ? 0.085 : 0.03) * s;     // sleeve end (rolled cuff above the glove)
    const slv = new Loft([
      { y: 0.055 * s, rx: 0.2 * r, rzF: 0.2 * r },
      { y: 0.04 * s, rx: 0.8 * r, rzF: 0.8 * r },
      { y: 0.0, rx: 1.02 * r, rzF: 1.06 * r, rzB: 1.06 * r, e: 0.9 },
      { y: -0.32 * UA, rx: 1.0 * r, rzF: 1.02 * r, rzB: 1.04 * r, e: 0.92 },
      { y: -0.78 * UA, rx: 0.92 * r, rzF: 0.92 * r, rzB: 0.95 * r },
      { y: -UA, rx: 0.9 * r, rzF: 0.88 * r, rzB: 0.98 * r, cz: -0.004 * s },
      { y: -UA - 0.35 * FA, rx: 0.86 * r, rzF: 0.86 * r, rzB: 0.88 * r },
      { y: yC + 0.04 * s, rx: 0.8 * r, rzF: 0.8 * r },
      { y: yC, rx: 0.78 * r, rzF: 0.78 * r },
    ]);
    const ak = kit();
    ak.put(mat.top, loftGeo(slv, { rows: 40, cols: 28, capTop: true, capBot: true }));
    if (work) {
      // rolled cuff: a fat rolled band of the same cloth + its navy-lined lip
      const cuff = new Loft([{ y: yC - 0.004 * s, rx: 0.8 * r, rzF: 0.8 * r }, { y: yC + 0.006 * s, rx: 0.92 * r, rzF: 0.92 * r }, { y: yC + 0.036 * s, rx: 0.92 * r, rzF: 0.92 * r }, { y: yC + 0.046 * s, rx: 0.82 * r, rzF: 0.82 * r }]);
      ak.put(mat.top, loftGeo(cuff, { rows: 6, cols: 28 }));
      ak.put(mat.trim, loftBand(cuff, yC + 0.004 * s, yC + 0.011 * s, 0.003 * s, 28, 1));
      // navy elbow patch (back of the elbow)
      ak.put(mat.trim, loftGeo(slv, { y0: -UA - 0.07 * s, y1: -UA + 0.05 * s, a0: Math.PI - 0.95, a1: Math.PI + 0.95, rows: 6, cols: 10, inflate: 0.0028 * s }));
      if (O.stripes) {
        ak.put(mat.tape, loftBand(slv, -0.62 * UA - 0.02 * s, -0.62 * UA + 0.022 * s, 0.004 * s, 32, 2));
        ak.put(mat.tape, loftBand(slv, -UA - 0.5 * FA - 0.02 * s, -UA - 0.5 * FA + 0.022 * s, 0.004 * s, 32, 2));
      }
    } else {
      ak.put(mat.under, loftBand(new Loft([{ y: yC - 0.012 * s, rx: 0.72 * r, rzF: 0.72 * r }, { y: yC + 0.006 * s, rx: 0.74 * r, rzF: 0.74 * r }]), yC - 0.012 * s, yC + 0.004 * s, 0.002 * s, 24, 2));
      for (let k = 0; k < 3; k++) { const f = slv.frame(yC + 0.025 * s, sg * (Math.PI / 2 + 0.6) + k * 0.25 * -sg, 0.003 * s); ak.put(mat.dark, placed(new THREE.CylinderGeometry(0.0045 * s, 0.0045 * s, 0.004 * s, 10).rotateX(Math.PI / 2), f.p, f.q)); }
    }
    ak.put(mat.seam, loftRibbon(slv, [[0.02 * s, Math.PI], [-UA, Math.PI + sg * 0.3], [yC + 0.04 * s, Math.PI + sg * 0.6]], 0.006 * s, 0.0015 * s, 16));
    const clv: JointName = `clav${S}`, shJ: JointName = `shoulder${S}`, elJ: JointName = `elbow${S}`, wrJ: JointName = `wrist${S}`;
    const armW = (p: THREE.Vector3): Weights => {
      const d = -p.y;
      const wT = (1 - sstep(-0.01 * s, 0.085 * s, d)) * 0.55;
      const wE = sstep(UA - 0.05 * s, UA + 0.045 * s, d);
      const wW = sstep(UA + FA - 0.06 * s, UA + FA + 0.02 * s, d) * 0.4;
      const k = 1 - wT;
      return [[BI(clv), wT], [BI(shJ), k * (1 - wE)], [BI(elJ), k * wE * (1 - wW)], [BI(wrJ), k * wE * wW]];
    };
    const armF: FoldFn = (p) => [-p.y - UA, Math.atan2(p.x * sg, p.z), S === "L" ? 0 : 1, sstep(-0.02 * s, 0.05 * s, -p.y)];
    ak.skin(armW, armF, shJ, new Set([mat.seam, mat.dark]));
    if (acc.has("watch") && S === "L") {
      // watch on the wrist, just below the blouse cuff (rigid on the wrist)
      add(wr, band({ r: [0.029 * s, 0.02 * s, 0.025 * s], e1: 0.6, e2: 0.8 }, -0.007 * s, 0.007 * s, 0.003 * s, 32, 2), mat.dark, { p: V(0, 0.03 * s, 0) });
      add(wr, new THREE.CylinderGeometry(0.015 * s, 0.015 * s, 0.007 * s, 20).rotateZ(Math.PI / 2), mat.gold, { p: V(sg * 0.031 * s, 0.03 * s, 0) });
      add(wr, new THREE.CircleGeometry(0.012 * s, 20).rotateY(sg * Math.PI / 2), mat.card, { p: V(sg * 0.0352 * s, 0.03 * s, 0), hull: false });
    }
    // hand (in wrist space, fingers along -y, palm faces -sg*x, thumb toward +z)
    const hm = mat.glove;
    add(wr, sculpt({ r: [0.028 * s * gl, 0.03 * s, 0.031 * s * gl], seg: [16, 12] }), hm, { p: V(0, -0.012 * s, 0) });
    const palmO: SculptOpts = { r: [0.018 * s * gl, 0.047 * s, 0.041 * s * gl], e1: 0.5, e2: 0.55, taperBot: 1.05, seg: [24, 18], disp: (d) => (d.x * -sg > 0.3 ? -0.003 * s : 0) };
    add(wr, sculpt(palmO), hm, { p: V(sg * 0.002 * s, -0.05 * s, 0) });
    if (O.gloves) {
      // chunky gauntlet cuff + knuckle pad
      add(wr, sculpt({ r: [0.039 * s, 0.032 * s, 0.043 * s], e1: 0.4, e2: 0.8, taperTop: 1.12, seg: [24, 10] }), hm, { p: V(0, 0.026 * s, 0) });
      add(wr, band({ r: [0.04 * s, 0.032 * s, 0.044 * s], e1: 0.4, e2: 0.8, taperTop: 1.12 }, 0.018 * s, 0.03 * s, 0.003 * s, 24, 2), mat.dark, { p: V(0, 0.026 * s, 0) });
      add(wr, rbox(0.012 * s, 0.03 * s, 0.07 * s, 0.006 * s), mat.dark, { p: V(sg * 0.019 * s, -0.075 * s, 0), hull: false });
    }
    const FZ = [0.028, 0.0095, -0.009, -0.026], FL = [0.072, 0.08, 0.075, 0.06], FR = [0.0098, 0.0104, 0.0099, 0.0088];
    for (let i = 0; i < 4; i++) {
      const base = new THREE.Group(); base.position.set(-sg * 0.002 * s, -0.09 * s, FZ[i] * s); wr.add(base);
      const l1 = FL[i] * 0.56 * s, l2 = FL[i] * 0.44 * s, rr = FR[i] * s * gl;
      add(base, sculpt({ r: [rr * 1.05, rr * 1.05, rr * 1.05], seg: [12, 10] }), hm, { hull: false });
      add(base, limbSeg(l1, rr, rr * 0.94), hm);
      const mid = new THREE.Group(); mid.position.y = -l1; base.add(mid);
      add(mid, limbSeg(l2, rr * 0.94, rr * 0.82), hm);
      fingers[S].segs.push([base, mid]);
    }
    const tb = new THREE.Group(); tb.position.set(-sg * 0.008 * s, -0.03 * s, 0.03 * s * gl); tb.rotation.set(-0.7, 0, -sg * 0.35); wr.add(tb);
    const tr = 0.0118 * s * gl;
    add(tb, limbSeg(0.042 * s, tr * 1.1, tr), hm);
    const tm = new THREE.Group(); tm.position.y = -0.042 * s; tb.add(tm);
    add(tm, limbSeg(0.034 * s, tr, tr * 0.85), hm);
    fingers[S].thumb = [tb, tm];
  }

  // ------------------------------------------------------------------ LEGS: skinned trouser legs + rigid footwear
  const TH = P.thigh, SH = P.shin;
  for (const S of ["L", "R"] as const) {
    const sg = S === "L" ? 1 : -1;
    const an = J[`ankle${S}`];
    const baggy = O.lower === "workPants";
    const r = (baggy ? 0.09 : 0.077) * s * limbK * Math.sqrt(hipK);
    const yH = -TH - SH + (baggy ? 0.035 : 0.05) * s;
    const leg = new Loft(baggy ? [
      { y: 0.07 * s, rx: 0.35 * r, rzF: 0.35 * r },
      { y: 0.045 * s, rx: 0.92 * r, rzF: 0.92 * r },
      { y: 0.0, rx: 1.0 * r, rzF: 1.0 * r, rzB: 1.05 * r },
      { y: -0.35 * TH, rx: 0.96 * r, rzF: 0.95 * r, rzB: 0.98 * r, e: 0.92 },
      { y: -0.8 * TH, rx: 0.82 * r, rzF: 0.8 * r, rzB: 0.8 * r, e: 0.92 },
      { y: -TH, rx: 0.79 * r, rzF: 0.84 * r, rzB: 0.76 * r, cz: 0.004 * s },
      { y: -TH - 0.3 * SH, rx: 0.75 * r, rzF: 0.76 * r, rzB: 0.74 * r },
      { y: -TH - 0.75 * SH, rx: 0.72 * r, rzF: 0.72 * r },
      { y: yH, rx: 0.76 * r, rzF: 0.8 * r, rzB: 0.74 * r, cz: 0.004 * s },
    ] : [
      { y: 0.07 * s, rx: 0.35 * r, rzF: 0.35 * r },
      { y: 0.045 * s, rx: 0.92 * r, rzF: 0.92 * r },
      { y: 0.0, rx: 1.0 * r, rzF: 1.0 * r, rzB: 1.05 * r },
      { y: -0.4 * TH, rx: 0.92 * r, rzF: 0.92 * r },
      { y: -TH, rx: 0.74 * r, rzF: 0.76 * r, rzB: 0.72 * r },
      { y: -TH - 0.5 * SH, rx: 0.7 * r, rzF: 0.7 * r },
      { y: yH, rx: 0.72 * r, rzF: 0.74 * r, rzB: 0.7 * r },
    ]);
    const lk = kit();
    lk.put(mat.lower, loftGeo(leg, { rows: 44, cols: 28, capTop: true, capBot: true }));
    lk.put(mat.lower, loftBand(leg, yH + 0.002 * s, yH + 0.024 * s, 0.003 * s, 28, 2));                      // hem
    lk.put(mat.seam, loftRibbon(leg, [[0.03 * s, sg * Math.PI / 2], [yH + 0.02 * s, sg * Math.PI / 2]], 0.007 * s, 0.0015 * s, 24));
    if (baggy) {
      // cargo pocket with flap on the outer thigh, reinforced knee patch, tape on the shin
      const fc = leg.frame(-0.5 * TH, sg * 1.5, 0.004 * s);
      lk.put(mat.lower, placed(rbox(0.11 * s, 0.13 * s, 0.022 * s, 0.012 * s), fc.p, fc.q));
      const ff = leg.frame(-0.5 * TH + 0.074 * s, sg * 1.5, 0.012 * s);
      lk.put(mat.trim, placed(rbox(0.118 * s, 0.032 * s, 0.018 * s, 0.008 * s), ff.p, ff.q));
      lk.put(mat.trim, loftGeo(leg, { y0: -TH - 0.07 * s, y1: -TH + 0.06 * s, a0: -1.05, a1: 1.05, rows: 6, cols: 12, inflate: 0.003 * s }));
      if (O.stripes) lk.put(mat.tape, loftBand(leg, -TH - 0.62 * SH - 0.018 * s, -TH - 0.62 * SH + 0.018 * s, 0.004 * s, 32, 2));
    } else {
      lk.put(mat.seam, loftRibbon(leg, [[0.0, 0], [yH + 0.02 * s, 0]], 0.004 * s, 0.002 * s, 24)); // pressed front crease
    }
    if (acc.has("kneepads")) lk.put(mat.dark, loftGeo(leg, { y0: -TH - 0.06 * s, y1: -TH + 0.07 * s, a0: -1.2, a1: 1.2, rows: 6, cols: 12, inflate: 0.012 * s }));
    const hpJ: JointName = `hip${S}`, knJ: JointName = `knee${S}`, anJ: JointName = `ankle${S}`;
    const legW = (p: THREE.Vector3): Weights => {
      const d = -p.y;
      const wT = (1 - sstep(-0.02 * s, 0.1 * s, d)) * 0.6;
      const wK = sstep(TH - 0.055 * s, TH + 0.05 * s, d);
      const wA = sstep(TH + SH - 0.1 * s, TH + SH - 0.02 * s, d) * 0.25;
      const k = 1 - wT;
      return [[BI("hips"), wT], [BI(hpJ), k * (1 - wK)], [BI(knJ), k * wK * (1 - wA)], [BI(anJ), k * wK * wA]];
    };
    const legF: FoldFn = (p) => [-p.y - TH, Math.atan2(p.x * sg, -p.z), S === "L" ? 2 : 3, sstep(0.0, 0.06 * s, -p.y)];
    lk.skin(legW, legF, hpJ, new Set([mat.seam]));
    if (O.shoes === "boots") {
      // chunky work boot: tall padded shaft, broad toe cap, thick lugged sole, laces
      const bk2 = 1.1;
      add(an, sculpt({ r: [0.062 * s, 0.075 * s, 0.066 * s], e1: 0.6, e2: 0.8, seg: [24, 14] }), mat.shoe, { p: V(0, 0.016 * s, -0.004 * s) });
      add(an, band({ r: [0.065 * s, 0.075 * s, 0.069 * s], e1: 0.6, e2: 0.8 }, 0.05 * s, 0.075 * s, 0.007 * s, 32, 2), mat.shoe, { p: V(0, 0.016 * s, -0.004 * s) });
      const bootO: SculptOpts = { r: [0.062 * s * bk2, 0.062 * s, 0.142 * s * bk2], e1: 0.46, e2: 0.6, taperTop: 0.86, taperTopZ: 0.62, flatBack: 0.12, seg: [40, 22] };
      add(an, sculpt(bootO), mat.shoe, { p: V(0, -P.ankleY + 0.064 * s, 0.04 * s) });
      add(an, sculpt({ r: [0.06 * s * bk2, 0.044 * s, 0.054 * s], e1: 0.5, e2: 0.7, theta: [0, Math.PI / 2 + 0.2], seg: [24, 12] }), mat.toe, { p: V(0, -P.ankleY + 0.034 * s, 0.128 * s) });
      add(an, sculpt({ r: [0.068 * s * bk2, 0.017 * s, 0.152 * s * bk2], e1: 0.2, e2: 0.6, seg: [40, 8] }), mat.sole, { p: V(0, -P.ankleY + 0.017 * s, 0.04 * s) });
      for (let k = 0; k < 5; k++) add(an, rbox(0.07 * s, 0.006 * s, 0.012 * s, 0.002 * s), mat.sole, { p: V(0, -P.ankleY + 0.003 * s, 0.17 * s - k * 0.055 * s), hull: false, cast: false });
      for (let k = 0; k < 4; k++) add(an, rbox(0.052 * s, 0.006 * s, 0.009 * s, 0.002 * s), mat.dark, { p: V(0, -0.002 * s + k * 0.018 * s - 0.03 * s, 0.077 * s - k * 0.012 * s), r: [-0.6, 0, 0], hull: false });
      add(an, ribbon(bootO, [D(sg, -0.2, -0.3), D(sg, -0.3, 0.6)], 0.006 * s, 0.002 * s), mat.dark, { p: V(0, -P.ankleY + 0.064 * s, 0.04 * s), hull: false });
    } else {
      add(an, sculpt({ r: [0.028 * s, 0.03 * s, 0.03 * s], seg: [16, 12] }), mat.skin, { p: V(0, -0.01 * s, 0) });
      add(an, sculpt({ r: [0.044 * s, 0.032 * s, 0.122 * s], e1: 0.5, e2: 0.66, taperTop: 0.8, taperTopZ: 0.7, flatBack: 0.1, seg: [36, 18] }), mat.shoe, { p: V(0, -P.ankleY + 0.032 * s, 0.036 * s) });
      add(an, sculpt({ r: [0.046 * s, 0.008 * s, 0.126 * s], e1: 0.25, e2: 0.66, seg: [36, 8] }), mat.sole, { p: V(0, -P.ankleY + 0.008 * s, 0.036 * s) });
      add(an, rbox(0.03 * s, 0.006 * s, 0.012 * s, 0.003 * s), mat.dark, { p: V(0, -P.ankleY + 0.05 * s, 0.11 * s), r: [-0.5, 0, 0], hull: false }); // bar detail
    }
  }

  // ------------------------------------------------------------------ X-RAY skeleton (cyan line bones inside the resin)
  const boneMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(BRAND.cyan).multiplyScalar(1.15) });
  const skel: THREE.Object3D[] = [];
  const bone = (parent: THREE.Object3D, a: THREE.Vector3, c: THREE.Vector3, rr: number) => {
    const m = new THREE.Mesh(tube([a, c], rr, 2, 6), boneMat); m.visible = false; parent.add(m); skel.push(m);
    const k = new THREE.Mesh(new THREE.SphereGeometry(rr * 1.9, 10, 8), boneMat); k.position.copy(a); k.visible = false; parent.add(k); skel.push(k);
  };
  for (const n of JOINTS) {
    const j = J[n];
    for (const c2 of j.children) if (JOINTS.includes(c2.name as JointName) && c2.position.length() > 0.02) bone(j, V(0, 0, 0), c2.position.clone(), 0.006 * s);
  }
  bone(J.ankleL, V(0, 0, 0), V(0, -P.ankleY + 0.02 * s, 0.13 * s), 0.006 * s); bone(J.ankleR, V(0, 0, 0), V(0, -P.ankleY + 0.02 * s, 0.13 * s), 0.006 * s);
  bone(J.wristL, V(0, 0, 0), V(0, -0.15 * s, 0), 0.005 * s); bone(J.wristR, V(0, 0, 0), V(0, -0.15 * s, 0), 0.005 * s);
  const ring = (parent: THREE.Object3D, p: THREE.Vector3, rx: number, rz: number, rot: [number, number, number] = [Math.PI / 2, 0, 0]) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(1, (0.0045 * s) / Math.max(rx, rz), 6, 40), boneMat);
    m.position.copy(p); m.rotation.set(...rot); m.scale.set(rx, rz, 1); m.visible = false; parent.add(m); skel.push(m);
  };
  for (let i = 0; i < 4; i++) ring(chest, V(0, -0.02 * s + i * 0.05 * s, 0.01 * s), X * 1.06 * (0.62 + 0.06 * Math.sin(i)), 0.124 * s * 0.75);
  ring(hips, V(0, -0.01 * s, 0), pelvisO.r[0] * 0.7, pelvisO.r[2] * 0.7);
  ring(hc, V(0, 0, 0), R.x * 0.85, R.z * 0.85); ring(hc, V(0, 0, 0), R.z * 0.85, R.y * 0.85, [0, Math.PI / 2, 0]);

  // ------------------------------------------------------------------ contact shadow blobs (root space)
  BLOB ??= blobTexture();
  const contact = new THREE.Group(); contact.name = "contact"; root.add(contact);
  const blobMat = new THREE.MeshBasicMaterial({ map: BLOB, color: new THREE.Color("#0d1c26"), transparent: true, opacity: 0.55, depthWrite: false });
  const blobs = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.17 * s, 0.36 * s), blobMat); m.rotation.x = -Math.PI / 2; m.renderOrder = 1; contact.add(m); return m; });
  const bodyBlob = new THREE.Mesh(new THREE.PlaneGeometry(0.62 * s, 0.5 * s), blobMat.clone()); (bodyBlob.material as THREE.MeshBasicMaterial).opacity = 0.3;
  bodyBlob.rotation.x = -Math.PI / 2; bodyBlob.position.y = 0.001; contact.add(bodyBlob);

  // ------------------------------------------------------------------ behaviour
  const fingerCurl = (S: "L" | "R", h: HandCurl) => {
    const F = fingers[S], sg = F.side;
    const spreadA = [0.14, 0.04, -0.05, -0.15];
    F.segs.forEach(([b0, b1], i) => {
      const c = h.c[i + 1];
      b0.rotation.set(spreadA[i] * h.spread * 1.6, 0, -sg * c * 0.58);
      b1.rotation.set(0, 0, -sg * c * 0.62);
    });
    const tc = h.c[0];
    F.thumb[0].rotation.set(-0.7 + tc * 0.35, 0, -sg * (0.35 + tc * 0.45));
    F.thumb[1].rotation.set(0, 0, -sg * tc * 0.55);
  };
  const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), rootQ = new THREE.Quaternion();
  const qAng = (o: THREE.Object3D) => 2 * Math.acos(Math.min(1, Math.abs(o.quaternion.w)));
  const updateBends = () => {
    const bA = cu.uBendA.value, bB = cu.uBendB.value;
    bA.set(Math.min(1, qAng(J.elbowL) / 1.9), Math.min(1, qAng(J.elbowR) / 1.9), Math.min(1, qAng(J.kneeL) / 1.7), Math.min(1, qAng(J.kneeR) / 1.7));
    bB.x = Math.min(1, Math.abs(J.spine.rotation.x + J.chest.rotation.x + J.hips.rotation.x * 0.5) / 0.45);
  };

  const ch: Character = {
    spec, dims: P, root, joints: J, lampAnchor, eyeAnchor, contact, meshes,
    setHand(side, h) { const c = typeof h === "string" ? HANDS[h] : h; fingerCurl(side, c); },
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
      updateContacts(); updateBends();
    },
    handIK(side, target, pole) {
      const sg = side === "L" ? 1 : -1;
      root.updateMatrixWorld(true); root.getWorldQuaternion(rootQ);
      const pl = pole ?? V(sg * 0.85, -0.35, -0.6).applyQuaternion(rootQ);
      // palm point sits ~0.07 m down the hand from the wrist: aim the wrist so the palm lands on the target (2 passes)
      for (let k = 0; k < 2; k++) {
        const wr = J[`wrist${side}`]; wr.updateMatrixWorld(true);
        const off = V(-sg * 0.012 * s, -0.075 * s, 0).applyQuaternion(wr.getWorldQuaternion(tmpQ));
        solveTwoBone(J[`shoulder${side}`], J[`elbow${side}`], wr, target.clone().sub(off), pl, -1);
      }
      updateBends();
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
      updateContacts(); updateBends();
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
      const add2 = st === 1 ? THREE.AdditiveBlending : THREE.NormalBlending;
      if (m.blending !== add2) { m.blending = add2; m.needsUpdate = true; }
    }
    syncLookFlags();
    hulls.forEach((h) => (h.visible = outline && st === 0));
    skel.forEach((o) => (o.visible = st === 1));
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
  void Q;
  ch.setExpression("neutral");
  faceU.uFE.value.w = spec.face.eyeScale ?? 1;
  return ch;
}

/** tapered capsule along -y (finger segments) */
function limbSeg(len: number, r0: number, r1: number) {
  const ry = len / 2 + (r0 + r1) / 4;
  const g = sculpt({ r: [r0, ry, r0], e1: 0.72, e2: 0.92, taperBot: r1 / r0, seg: [14, 10] });
  g.translate(0, -len / 2, 0);
  return g;
}
