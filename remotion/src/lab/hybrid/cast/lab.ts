// [hybrid/cast] Test stage for the cast: one renderer per page, lamp key + cool fill, floor with contact shadows, and the
// sheet layouts (turnaround, expressions, phone-size faces, lineup + silhouettes, states, 60-frame motion test).
// Every frame is a pure function of (comp, frame).
import * as THREE from "three";
import { gouache, initShared, U, BRAND, setLookState } from "../look/shade";
import { createPost, Post } from "../look/post";
import { buildCharacter, Character } from "./character";
import { RAFA, NOOR } from "./specs";
import { POSES, Pose, mixPose, keyed, breathe, drift, tremble, Key } from "./poses";
import { EXPR, ExprName, FaceParams, mixFace } from "./face";

export type Comp = "turn" | "faces" | "lineup" | "states" | "motion";
export type Label = { x: number; y: number; text: string; size?: number; color?: string; anchor?: "start" | "middle" | "end" };
export type Line = { x1: number; y1: number; x2: number; y2: number; color?: string; dash?: boolean; w?: number };
export type Overlay = { labels: Label[]; lines: Line[] };

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const INK = "#E9E2D3";

export class CastLab {
  r: THREE.WebGLRenderer; scene = new THREE.Scene(); cam = new THREE.PerspectiveCamera(30, 1, 0.05, 60);
  ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 40);
  rig = new THREE.Group(); key: THREE.SpotLight; fill: THREE.DirectionalLight; rim: THREE.DirectionalLight;
  floor: THREE.Mesh; back!: THREE.Mesh; rafa: Character; noor: Character; silMat = new THREE.MeshBasicMaterial({ color: "#121a22" });
  W: number; H: number;
  constructor(public cvs: HTMLCanvasElement, W: number, H: number, dpr: number) {
    this.W = W; this.H = H;
    initShared();
    const r = new THREE.WebGLRenderer({ canvas: cvs, antialias: true, preserveDrawingBuffer: true, stencil: false });
    r.setPixelRatio(dpr); r.setSize(W, H, false);
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.NoToneMapping;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.r = r;
    const sc = this.scene;
    sc.background = new THREE.Color("#16242f");
    // lights ride a rig so turnaround views keep the same model-sheet lighting
    sc.add(this.rig);
    this.key = new THREE.SpotLight("#fff1de", 34, 0, 0.42, 0.75, 2);
    this.key.position.set(-2.3, 3.9, 3.4);
    this.key.target.position.set(0, 0.95, 0);
    this.key.castShadow = true; this.key.shadow.mapSize.set(2048, 2048); this.key.shadow.bias = -0.0003; this.key.shadow.normalBias = 0.012;
    this.key.shadow.camera.near = 2; this.key.shadow.camera.far = 10;
    this.rig.add(this.key); sc.add(this.key.target);
    this.fill = new THREE.DirectionalLight("#8cc0dd", 0.32); this.fill.position.set(3, 1.6, 1.2); this.rig.add(this.fill);
    this.rim = new THREE.DirectionalLight("#a9d8ff", 0.55); this.rim.position.set(1.5, 2.8, -3.2); this.rig.add(this.rim);
    this.floor = new THREE.Mesh(new THREE.CircleGeometry(6, 64), gouache({ color: "#56646a", grid: 0.6, brush: 0.5, brushScale: 1.2, rim: 0, xray: 0.5, anchor: "world" }));
    this.floor.rotation.x = -Math.PI / 2; this.floor.receiveShadow = true; sc.add(this.floor);
    const back = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 9, 64, 1, true), gouache({ color: "#2b4250", side: THREE.BackSide, brush: 0.6, brushScale: 0.5, rim: 0, grid: 0.4 }));
    back.position.y = 4.4; sc.add(back); this.back = back;
    this.rafa = buildCharacter(RAFA); this.noor = buildCharacter(NOOR);
    sc.add(this.rafa.root, this.noor.root);
  }

  private cell(x: number, y: number, w: number, h: number, cam: THREE.Camera, bg?: string) {
    const r = this.r;
    r.setViewport(x, this.H - y - h, w, h); r.setScissor(x, this.H - y - h, w, h); r.setScissorTest(true);
    if (cam instanceof THREE.PerspectiveCamera) { cam.aspect = w / h; cam.updateProjectionMatrix(); }
    (this.scene.background as THREE.Color).set(bg ?? "#16242f");
    r.render(this.scene, cam);
  }
  private only(...cs: Character[]) { for (const c of [this.rafa, this.noor]) c.root.visible = cs.includes(c); }
  private place(c: Character, x: number, z = 0, yaw = 0) { c.root.position.set(x, 0, z); c.root.rotation.set(0, yaw, 0); c.root.updateMatrixWorld(true); }
  private state(s: 0 | 1 | 2) { setLookState(s); this.rafa.setState(s); this.noor.setState(s); this.floor.visible = true; void U; }
  post: Post | null = null;
  private face(c: Character, e: ExprName | FaceParams, gaze: [number, number] = [0, 0], blink = 0) {
    if (typeof e === "string") c.setExpression(e); else c.setFace(e);
    c.setGaze(gaze[0], gaze[1]); c.setBlink(blink);
  }
  private lookAt(cam: THREE.PerspectiveCamera, pos: THREE.Vector3, tgt: THREE.Vector3, fov: number) {
    cam.position.copy(pos); cam.fov = fov; cam.up.set(0, 1, 0); cam.lookAt(tgt); cam.updateProjectionMatrix();
  }

  render(comp: Comp, f: number): Overlay {
    const ov: Overlay = { labels: [], lines: [] };
    const r = this.r; r.setScissorTest(false); r.setClearColor("#0e1820"); r.clear();
    this.rig.rotation.y = 0; this.scene.overrideMaterial = null;
    this.state(2);
    if (comp === "turn") this.turn(f === 0 ? this.rafa : this.noor, ov);
    else if (comp === "faces") { if (f < 2) this.faces(f === 0 ? this.rafa : this.noor, ov); else this.phone(ov); }
    else if (comp === "lineup") this.lineup(ov);
    else if (comp === "states") this.states(ov);
    else this.motion(f, ov);
    return ov;
  }

  // ---------------------------------------------------------------- TURNAROUND: front, 3/4, side, back, high, low
  turn(c: Character, ov: Overlay) {
    this.only(c); this.place(c, 0); c.setPose(POSES.stand); this.face(c, "neutral");
    const H = c.dims.H, mid = H * 0.53;
    const views: [string, number, number, number][] = [
      ["FRONT", 0, 1.0, 0], ["3/4", 0.72, 1.0, 0], ["SIDE", Math.PI / 2, 1.0, 0],
      ["BACK", Math.PI, 1.0, 0], ["HIGH 3/4", 0.6, 3.5, -0.2], ["LOW 3/4", -0.62, 0.3, 0.25],
    ];
    const cw = 540, ch = 640;
    views.forEach(([name, a, camY, lookDy], i) => {
      const x = (i % 2) * cw, y = Math.floor(i / 2) * ch;
      this.rig.rotation.y = a;
      const dist = 5.6;
      const pos = V(Math.sin(a) * dist, camY, Math.cos(a) * dist);
      this.lookAt(this.cam, pos, V(0, mid + lookDy, 0), name.startsWith("HIGH") || name.startsWith("LOW") ? 26 : 23);
      this.cell(x, y, cw, ch, this.cam);
      ov.labels.push({ x: x + 24, y: y + 46, text: name, size: 30 });
    });
    ov.labels.push({ x: 1056, y: 1900, text: `${c.spec.name.toUpperCase()} · ${c.spec.heightM.toFixed(2)} m · ${c.spec.heads} heads · ${c.spec.build}`, size: 26, anchor: "end", color: BRAND.cyan });
  }

  // ---------------------------------------------------------------- EXPRESSION sheet (12, head + shoulders, 3/4 front)
  faces(c: Character, ov: Overlay) {
    this.only(c); this.place(c, 0);
    const list: ExprName[] = ["neutral", "focused", "curious", "alarmed", "terrified", "wincing", "relieved", "smiling", "determined", "shouting", "squint", "smirk"];
    const tilt: Partial<Record<ExprName, Pose>> = {
      curious: { head: [0.04, 0.12, -0.14] }, alarmed: { head: [-0.08, 0, 0], clavL: [0, 0, 0.12], clavR: [0, 0, -0.12] },
      terrified: { head: [0.06, 0, 0], neck: [-0.05, 0, 0], clavL: [0, 0, 0.22], clavR: [0, 0, -0.22] }, wincing: { head: [0.1, -0.15, 0.1], clavL: [0, 0, 0.1], clavR: [0, 0, -0.14] },
      relieved: { head: [-0.12, 0, 0.08] }, smiling: { head: [-0.03, 0.06, 0.06] }, determined: { head: [0.1, 0, 0] }, shouting: { head: [-0.05, 0, 0], chest: [0.06, 0, 0] },
      smirk: { head: [0.02, -0.06, -0.08] }, focused: { head: [0.08, 0, 0] },
    };
    const gaze: Partial<Record<ExprName, [number, number]>> = { focused: [0.0, -0.3], curious: [0.35, 0.25], alarmed: [0, 0.2], terrified: [0, 0.1], relieved: [0, 0.3], smirk: [-0.3, 0] };
    const cw = 360, ch = 480;
    list.forEach((e, i) => {
      const x = (i % 3) * cw, y = Math.floor(i / 3) * ch;
      c.setPose({ ...POSES.stand, ...(tilt[e] ?? {}) });
      this.face(c, e, gaze[e] ?? [0, 0]);
      c.root.updateMatrixWorld(true);
      const eye = c.eyeAnchor.getWorldPosition(new THREE.Vector3());
      const tgt = eye.clone().add(V(0, -0.06, 0));
      this.lookAt(this.cam, tgt.clone().add(V(0.3, 0.08, 1.3)), tgt, 21);
      this.cell(x, y, cw, ch, this.cam);
      ov.labels.push({ x: x + 18, y: y + 40, text: e.toUpperCase(), size: 26 });
    });
  }

  // ---------------------------------------------------------------- PHONE-SIZE faces: medium shots, head ~120 px tall at 1080
  phone(ov: Overlay) {
    const rows: [Character, ExprName, Pose, [number, number]][] = [
      [this.rafa, "focused", POSES.idle, [0, -0.35]], [this.noor, "curious", POSES.stand, [0.3, 0.2]],
      [this.rafa, "alarmed", POSES.lookUp, [0, 0.6]], [this.noor, "terrified", POSES.alarm, [0, 0.3]],
      [this.rafa, "terrified", POSES.alarm, [0, 0.5]], [this.noor, "wincing", POSES.brace, [0, 0]],
      [this.rafa, "relieved", POSES.relief, [0, 0.3]], [this.noor, "smiling", POSES.stand, [-0.2, 0]],
    ];
    const cw = 540, ch = 480;
    rows.forEach(([c, e, p, g], i) => {
      const x = (i % 2) * cw, y = Math.floor(i / 2) * ch;
      this.only(c); this.place(c, 0); c.setPose(p); this.face(c, e, g);
      const eye = c.eyeAnchor.getWorldPosition(new THREE.Vector3());
      // head ~ c.dims.h tall -> 120 px of a 480 px row => visible height = 4 heads
      const vis = c.dims.h * ch / 120, fov = 28, d = vis / 2 / Math.tan((fov / 2) * Math.PI / 180);
      const tgt = V(eye.x, eye.y - vis * 0.27, eye.z);
      this.lookAt(this.cam, tgt.clone().add(V(Math.sin(0.22) * d, 0.05, Math.cos(0.22) * d)), tgt, fov);
      this.cell(x, y, cw, ch, this.cam);
      ov.labels.push({ x: x + 16, y: y + 34, text: `${e.toUpperCase()} · face ≈120 px @1080`, size: 22 });
    });
  }

  // ---------------------------------------------------------------- LINEUP + height chart in heads + silhouettes
  lineup(ov: Overlay) {
    const A = this.rafa, B = this.noor;
    this.only(A, B); this.place(A, -0.42); this.place(B, 0.42);
    A.setPose(POSES.stand); B.setPose(POSES.stand); this.face(A, "neutral"); this.face(B, "smiling");
    const top = 2.18, bot = -0.07, wM = (top - bot) * (1080 / 1250);
    const o = this.ortho; o.left = -wM / 2; o.right = wM / 2; o.top = top; o.bottom = bot; o.position.set(0, 0, 10); o.lookAt(0, 0, 0); o.updateProjectionMatrix();
    this.rig.rotation.y = 0;
    this.cell(0, 0, 1080, 1250, o);
    const toY = (m: number) => ((top - m) / (top - bot)) * 1250, toX = (m: number) => ((m + wM / 2) / wM) * 1080;
    for (const [c, x0, x1, side] of [[A, -0.86, -0.05, -1], [B, 0.05, 0.86, 1]] as [Character, number, number, number][]) {
      const h = c.dims.h;
      for (let k = 0; k <= Math.ceil(c.spec.heads); k++) {
        const ym = Math.min(c.dims.H, k * h), y = toY(c.dims.H - ym);
        if (k > c.spec.heads + 0.01) continue;
        ov.lines.push({ x1: toX(x0), y1: y, x2: toX(x1), y2: y, color: BRAND.cyan, dash: k !== 0, w: k === 0 ? 2.5 : 1.4 });
        if (k > 0) ov.labels.push({ x: side < 0 ? toX(x0) + 4 : toX(x1) - 4, y: (toY(c.dims.H - (k - 1) * h) + y) / 2 + 8, text: `${k}`, size: 24, anchor: side < 0 ? "start" : "end", color: BRAND.cyan });
      }
      const yb = toY(0);
      ov.lines.push({ x1: toX(x0), y1: yb, x2: toX(x1), y2: yb, color: BRAND.cyan, w: 2.5 });
      ov.labels.push({ x: toX((x0 + x1) / 2), y: toY(c.dims.H) - 64, text: `${c.spec.name.toUpperCase()} · ${c.spec.heightM.toFixed(2)} m · ${c.spec.heads} HEADS`, size: 24, anchor: "middle", color: BRAND.cyan });
    }
    // silhouettes (the 0.5 s read): side + 3/4 of each, flat dark
    this.scene.overrideMaterial = this.silMat; this.floor.visible = false; this.back.visible = false;
    const sw = 270, sh = 640, y0 = 1270;
    const sil: [Character, number][] = [[A, Math.PI / 2], [A, 0.75], [B, 0.75], [B, -Math.PI / 2]];
    sil.forEach(([c, yaw], i) => {
      this.only(c); this.place(c, 0, 0, yaw); c.setPose(i === 1 ? POSES.idle : POSES.stand);
      const t2 = 2.05, b2 = -0.05, w2 = (t2 - b2) * (sw / sh);
      o.left = -w2 / 2; o.right = w2 / 2; o.top = t2; o.bottom = b2; o.updateProjectionMatrix();
      this.cell(i * sw, y0, sw, sh, o, "#cfd6d4");
    });
    this.scene.overrideMaterial = null; this.floor.visible = true; this.back.visible = true;
    ov.labels.push({ x: 18, y: y0 + 34, text: "SILHOUETTE READ", size: 22, color: "#16242f" });
  }

  // ---------------------------------------------------------------- STATES: blueprint / x-ray resin / solid
  states(ov: Overlay) {
    const A = this.rafa, B = this.noor;
    this.only(A, B); this.place(A, -0.45, 0, 0.5); this.place(B, 0.5, -0.1, 0.35);
    A.setPose(POSES.idle); B.setPose(POSES.stand); this.face(A, "focused", [0, -0.3]); this.face(B, "neutral");
    const names = ["BLUEPRINT", "X-RAY · RESIN", "SOLID"];
    ([0, 1, 2] as const).forEach((st) => {
      this.state(st);
      this.lookAt(this.cam, V(0.6, 1.3, 4.6), V(0.0, 0.95, 0), 30);
      this.cell(0, st * 640, 1080, 640, this.cam, st === 0 ? BRAND.navy : st === 1 ? "#0d1830" : "#16242f");
      ov.labels.push({ x: 24, y: st * 640 + 48, text: names[st], size: 30, color: st === 2 ? INK : BRAND.cyan });
    });
    this.state(2);
  }

  // ---------------------------------------------------------------- MOTION test: idle -> alarm recoil -> relief (60 f)
  motion(f: number, ov: Overlay) {
    const c = this.rafa;
    this.only(c); this.place(c, 0);
    const t = f / 30;
    const DIP: Pose = mixPose(POSES.idle, { ...POSES.idle, lift: -0.06, chest: [0.12, 0.04, 0.04], head: [0.2, 0.1, 0], clavL: [0, 0, -0.06], clavR: [0, 0, 0.06] }, 1);
    const keys: Key<Pose>[] = [
      { f: 0, v: POSES.idle }, { f: 13, v: POSES.idle }, { f: 16, v: DIP, ease: "out" },
      { f: 25, v: POSES.alarm, ease: "backOut" }, { f: 38, v: mixPose(POSES.alarm, POSES.lookUp, 0.25) },
      // mid key: the right hand drops out and forward first (arc in front of the body), then lands on the chest
      { f: 44, v: { ...mixPose(mixPose(POSES.alarm, POSES.lookUp, 0.25), POSES.relief, 0.55), reachR: [-0.16, 1.22, 0.42], reachW: 0.8 }, ease: "glide" },
      { f: 50, v: POSES.relief, ease: "glide" }, { f: 60, v: mixPose(POSES.relief, POSES.idle, 0.15) },
    ];
    let p = keyed(keys, f, mixPose);
    const scared = f >= 16 && f < 44 ? 1 : 0;
    p = breathe(p, t, f < 40 ? 1 : 1.6, scared ? 2.4 : 1);
    p = drift(p, t, f < 16 ? 1 : f > 46 ? 0.6 : 0.15);
    p = tremble(p, f, f >= 25 && f < 40 ? 0.9 * Math.exp(-(f - 25) / 9) : 0);
    c.setPose(p);
    const fk: Key<FaceParams>[] = [
      { f: 0, v: EXPR.focused }, { f: 14, v: EXPR.focused }, { f: 17, v: EXPR.alarmed, ease: "out" }, { f: 23, v: EXPR.terrified, ease: "backOut" },
      { f: 37, v: EXPR.terrified }, { f: 41, v: EXPR.alarmed }, { f: 46, v: EXPR.relieved, ease: "glide" }, { f: 60, v: mixFace(EXPR.relieved, EXPR.smiling, 0.4) },
    ];
    const blink = f >= 7 && f <= 10 ? [0.5, 1, 0.6, 0.15][f - 7] : f >= 41 && f <= 44 ? [0.4, 1, 1, 0.3][f - 41] : 0;
    const gaze: [number, number] = f < 16 ? [0.05, -0.35] : f < 40 ? [0.02, 0.55] : [0.0, 0.15];
    this.face(c, keyed(fk, f, mixFace), gaze, blink);
    const u = f / 59, push = u * u * (3 - 2 * u);
    const d = 4.3 - 0.45 * push, a = 0.42 + 0.06 * push;
    this.lookAt(this.cam, V(Math.sin(a) * d, 1.05 + 0.04 * push, Math.cos(a) * d), V(0, 0.98 + 0.03 * push, 0), 30);
    // full look pipeline (ink, bloom, grade, bg blur) on the motion test
    this.post ??= createPost(this.r, this.scene, this.cam, { msaa: 2, dof: true });
    this.post.focus(d, 1.2);
    const r = this.r; r.setScissorTest(false); r.setViewport(0, 0, this.W, this.H);
    this.cam.aspect = this.W / this.H; this.cam.updateProjectionMatrix();
    (this.scene.background as THREE.Color).set("#16242f");
    this.post.render();
    ov.labels.push({ x: 24, y: 60, text: `HyCastMotion f${f}`, size: 22, color: "#7f97a6" });
  }
}
