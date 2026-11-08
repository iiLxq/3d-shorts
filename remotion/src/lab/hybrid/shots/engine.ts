// [hybrid/shots] HyTest engine: one renderer per page; render(f) is a pure function of the frame.
// Set (buildShaft) + cast (Rafa) + look post. Integration rig owned here: Rafa's headlamp (spot + beam cone),
// a cool rim on Rafa, his hand IK on the balustrade, contact shadows (cast), key-light shadow on the roof (set key).
import * as THREE from "three";
import { initShared, setLookState, setSweep, beamMaterial, lin, BRAND, createPost, outputDpr, U, brandOut } from "../look/api";
import type { Post } from "../look/api";
import { hazeTex } from "../look/paint";
import { buildShaft } from "../set/shaft";
import type { Shaft } from "../set/shaft";
import { buildCharacter, RAFA } from "../cast/api";
import type { Character } from "../cast/api";
import { story, carY, clampAt, glowAt, sparksAt, flashAt, snapAt, alarmAt, forceAt, stateAt, camAt, rafaAt, focusAt, smooth, glide } from "./timeline";

export const RAFA_SPOT = new THREE.Vector3(-0.36, 0, 0.0);  // car space (feet), left of centre: gear owns the right
export const RAFA_YAW = 0.45;                                 // turned toward screen right (the gear side)
export const RAIL_GRIP = new THREE.Vector3(-0.68, 1.075, -0.1); // car space: top of the balustrade rail

export const DEBUG = false;
export type Frame = { labels: Record<string, [number, number]> | null; ms: number; S: number };

export class ShotEngine {
  renderer: THREE.WebGLRenderer; scene = new THREE.Scene(); camera: THREE.PerspectiveCamera; post: Post;
  shaft: Shaft; rafa: Character; head!: THREE.SpotLight; headTgt = new THREE.Object3D(); beam!: THREE.Mesh; rim!: THREE.SpotLight;
  bpLines: { o: THREE.Object3D; m: THREE.Material & { opacity: number }; op: number }[] = [];
  arrow!: THREE.Mesh; arrowMat!: THREE.MeshBasicMaterial;
  key: THREE.Light; keyBase: number; fogBase = U.uFogCol.value.clone();
  constructor(public cvs: HTMLCanvasElement, public W: number, public H: number) {
    initShared();
    const r = new THREE.WebGLRenderer({ canvas: cvs, antialias: false, preserveDrawingBuffer: true, powerPreference: "high-performance", stencil: false });
    r.setPixelRatio(outputDpr()); r.setSize(W, H, false);
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.NoToneMapping;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = r;
    this.camera = new THREE.PerspectiveCamera(40, W / H, 0.06, 120);
    this.scene.background = lin("#1d3a4c");
    this.shaft = buildShaft();
    this.scene.add(this.shaft.group);
    this.shaft.group.traverse((o) => {
      const any = o as unknown as { isLineSegments2?: boolean; material: THREE.Material & { opacity: number } };
      if (any.isLineSegments2) this.bpLines.push({ o, m: any.material, op: any.material.opacity });
    });
    this.key = this.shaft.lights[0]; this.keyBase = this.key.intensity;

    // ---- Rafa on the car roof (rides the car)
    this.rafa = buildCharacter(RAFA);
    this.rafa.root.position.copy(RAFA_SPOT); this.rafa.root.rotation.y = RAFA_YAW;
    this.shaft.car.add(this.rafa.root);
    this.rafa.setOutline(false); // the post ink draws the blueprint lines

    // ---- headlamp: warm-white spot along the lamp's +z, soft shadow, painted beam cone in the haze
    const la = this.rafa.lampAnchor ?? this.rafa.eyeAnchor;
    const head = new THREE.SpotLight(lin("#fff0d6"), 6, 8, 0.26, 0.5, 1.2);
    this.headTgt.position.set(0, 0, 1); la.add(this.headTgt); head.target = this.headTgt;
    head.castShadow = true; head.shadow.mapSize.set(512, 512); head.shadow.bias = -0.0008; head.shadow.normalBias = 0.02; head.shadow.camera.near = 0.1; head.shadow.camera.far = 7; head.shadow.radius = 3;
    la.add(head); this.head = head;
    const bm = beamMaterial("#ffe7c4", 0.16, { noise: hazeTex() });
    const cg = new THREE.ConeGeometry(0.5, 3.0, 28, 1, true); cg.translate(0, -1.5, 0); cg.rotateX(-Math.PI / 2);
    this.beam = new THREE.Mesh(cg, bm); this.beam.renderOrder = 45; this.beam.frustumCulled = false; la.add(this.beam);

    // ---- cool rim from high behind-right: separates his silhouette from the warm back wall
    const rim = new THREE.SpotLight(lin("#a6e2ee"), 6, 6, 0.32, 0.6, 1.2);
    rim.position.set(0.55, 3.0, -1.1); const rt = new THREE.Object3D(); rt.position.set(RAFA_SPOT.x, 1.25, RAFA_SPOT.z);
    this.shaft.car.add(rim, rt); rim.target = rt; this.rim = rim;

    // ---- hero force arrow (X-RAY): the car's weight acting down beside the gear, painted danger red, unlit
    {
      const sh = new THREE.Shape([[-0.028, 0.5], [0.028, 0.5], [0.028, 0.16], [0.075, 0.16], [0, 0], [-0.075, 0.16], [-0.028, 0.16]].map(([x, y]) => new THREE.Vector2(x, y)));
      this.arrowMat = new THREE.MeshBasicMaterial({ color: brandOut(BRAND.red), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
      const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), this.arrowMat); m.position.set(0.74, -0.24, -0.72); m.renderOrder = 85; m.frustumCulled = false;
      this.shaft.car.add(m); this.arrow = m;
    }
    this.post = createPost(r, this.scene, this.camera, { focus: 4, focusRange: 1.4, dofMaxPx: 6, grainSeed: 7 });
  }

  /** opts.camF: lock the camera to that frame's camera (shimmer hold test) */
  render(f: number, opts: { camF?: number } = {}): Frame {
    const S = story(f), sh = this.shaft, cy = carY(S);
    // ---------------- set + mechanism (story time)
    const st = stateAt(f, cy);
    sh.setState(st.shaft);
    sh.setTime(2 + S / 30);
    sh.setCarDrop(cy);
    sh.setGearClamp(clampAt(S));
    sh.setGearGlow(glowAt(S));
    sh.setSparks(sparksAt(S));
    sh.setRopeSnap(snapAt(S));
    sh.setAlarm(alarmAt(S));
    sh.setForce(0); // the set's arrows sit below the frame here; the shots-owned hero arrow carries the force
    this.arrowMat.opacity = forceAt(f); this.arrow.visible = forceAt(f) > 0.01;
    this.arrow.position.y = -0.24 - 0.05 * Math.sin(f * 0.35) * forceAt(f); // pushing
    if (st.sweep) setSweep(st.sweep.from, st.sweep.to, { offset: st.sweep.offset, normal: new THREE.Vector3(0, st.sweep.dir, 0), soft: 0.08, glow: 0.35 });
    else setLookState(st.shaft);
    // blueprint line art fades out with the first print sweep instead of popping
    if (st.sweep && st.sweep.from === 0) for (const l of this.bpLines) { l.o.visible = true; l.m.opacity = l.op * (1 - smooth(0.0, 0.7, st.sweep.p)); }
    else for (const l of this.bpLines) l.m.opacity = l.op;

    // warm light settles after the save; red alarm leaves; haze warms a touch
    const warm = smooth(258, 292, f);
    this.key.intensity *= 1 + 0.25 * warm;
    U.uFogCol.value.copy(this.fogBase).lerp(lin("#3a3c48"), 0.35 * warm);

    // ---------------- Rafa
    const R = rafaAt(S), c = this.rafa;
    c.followLook();
    c.setPose(R.pose);
    sh.car.updateMatrixWorld(true);
    c.handIK("R", sh.car.localToWorld(RAIL_GRIP.clone()));
    c.setExpression("neutral"); c.setFace(R.face); c.setBlink(R.blink); c.setGaze(R.gaze[0], R.gaze[1]);
    const lit = st.shaft !== 0 || (st.sweep !== undefined);
    this.head.intensity = st.shaft === 0 ? 0 : 6;
    (this.beam.material as THREE.ShaderMaterial).uniforms.uI.value = st.shaft === 1 ? 0.05 : 0.16;
    this.beam.visible = lit && st.shaft !== 0;
    this.rim.intensity = st.shaft === 0 ? 0 : 6;

    // ---------------- camera
    const C = camAt(opts.camF ?? f);
    const dy = cy * C.follow;
    const pos = C.pos.clone().add(new THREE.Vector3(0, dy, 0)), look = C.look.clone().add(new THREE.Vector3(0, dy, 0));
    const cam = this.camera;
    cam.position.copy(pos); cam.fov = C.fov;
    const fwd = look.clone().sub(pos).normalize();
    cam.up.set(0, 1, 0).applyAxisAngle(fwd, C.roll); cam.lookAt(look);
    cam.near = 0.06; cam.far = 120; cam.updateProjectionMatrix();
    const bw = Math.round(this.W * this.renderer.getPixelRatio()), bh = Math.round(this.H * this.renderer.getPixelRatio());
    sh.setViewport(bw, bh, C.fov);
    this.scene.updateMatrixWorld(true);

    // focus: Rafa's face <-> gear jaw
    const eye = c.eyeAnchor.getWorldPosition(new THREE.Vector3());
    const jaw = sh.anchors.gearJaw.getWorldPosition(new THREE.Vector3());
    const fw = focusAt(f).w;
    this.post.focus(eye.distanceTo(pos) * (1 - fw) + jaw.distanceTo(pos) * fw + 0.25, 1.2 * (1 - fw) + 0.5 * fw);
    const fl = flashAt(S);
    this.post.flash(fl > 0.01 ? jaw : null, fl, 170, BRAND.green);
    this.post.render();
    void glide;
    const dbg = (globalThis as unknown as { HYDBG?: boolean }).HYDBG;
    const L = f < 48 ? this.project() : {};
    if (DEBUG) {
      const pr = (v: THREE.Vector3): [number, number] => { const q = v.clone().project(cam); return [(q.x * 0.5 + 0.5) * this.W, (-q.y * 0.5 + 0.5) * this.H]; };
      L.dbgT = pr(sh.car.localToWorld(RAIL_GRIP.clone()));
      L.dbgW = pr(c.joints.wristR.getWorldPosition(new THREE.Vector3()));
      L.dbgS = pr(c.joints.shoulderR.getWorldPosition(new THREE.Vector3()));
      const d = c.joints.shoulderR.getWorldPosition(new THREE.Vector3()).distanceTo(sh.car.localToWorld(RAIL_GRIP.clone()));
      L.dbgD = [d, 0];
    }
    void dbg;
    return { labels: L, ms: this.post.lastMs, S };
  }

  project() {
    const out: Record<string, [number, number]> = {};
    for (const p of this.shaft.patent) {
      const o = this.shaft.anchors[p.key]; if (!o) continue;
      const v = new THREE.Vector3(); o.getWorldPosition(v); v.project(this.camera);
      if (v.z > 1 || Math.abs(v.x) > 0.98 || Math.abs(v.y) > 0.98) continue;
      out[p.key] = [(v.x * 0.5 + 0.5) * this.W, (-v.y * 0.5 + 0.5) * this.H];
    }
    return out;
  }
}
