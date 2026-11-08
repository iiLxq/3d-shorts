// [hybrid/look] Lookdev bench for the Lamplit Gouache standard: a shaft-corner set (brick back wall, concrete side wall
// and floor), the lamp key + red practical + cool rim (2 shadow maps), a figure proxy (amber jacket), a machined guide
// rail with a safety gear (resin housing, green jaws) and a turntable of material swatches. Every frame is a pure
// function of the frame number. Sections (30 fps):
//   A   0- 39 SOLID      (0-9 still hold for shimmer, then swatch spin + slow push)
//   B  40- 69 X-RAY      (same move, local frame)
//   C  70- 99 BLUEPRINT
//   D 100-129 print sweep BLUEPRINT -> SOLID rising from the floor
//   E 130-149 SOLID, clamp moment: green jaw glow + LOCAL flash (frame 132)
import * as THREE from "three";
import { gouache, brandMat, initShared, setLookState, setSweep, U, lin, beamMaterial } from "./shade";
import { BRAND } from "./colors";
import { concreteTex, brickTex, steelTex, hazeTex } from "./paint";
import { createPost, outputDpr, Post, PostOpts } from "./post";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const glide = (t: number) => { const x = clamp01(t); return x * x * x * (x * (6 * x - 15) + 10); };
const rep = (t: THREE.Texture, x: number, y: number) => { const c = t.clone(); c.wrapS = c.wrapT = THREE.RepeatWrapping; c.repeat.set(x, y); c.needsUpdate = true; return c; };

export type Section = { name: string; state: 0 | 1 | 2; lf: number; sweep?: number; flash?: number };
export function sectionAt(f: number): Section {
  if (f < 40) return { name: "solid", state: 2, lf: f };
  if (f < 70) return { name: "xray", state: 1, lf: f - 40 };
  if (f < 100) return { name: "blueprint", state: 0, lf: f - 70 };
  if (f < 130) return { name: "sweep", state: 0, lf: f - 100, sweep: glide((f - 100) / 29) };
  return { name: "clamp", state: 2, lf: f - 130, flash: f - 132 };
}

function capsule(r: number, len: number, mat: THREE.Material, seg = 20) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 8, seg), mat); m.castShadow = m.receiveShadow = true; return m;
}
function box(w: number, h: number, d: number, mat: THREE.Material) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.castShadow = m.receiveShadow = true; return m;
}

export class LookBench {
  renderer: THREE.WebGLRenderer; scene = new THREE.Scene(); camera: THREE.PerspectiveCamera; post: Post;
  swatches: THREE.Object3D[] = []; jawMat: THREE.MeshLambertMaterial; jawPos = new THREE.Vector3();
  practicals: THREE.Mesh[] = []; beacon!: THREE.PointLight; cone!: THREE.Mesh;
  constructor(public cvs: HTMLCanvasElement, W: number, H: number, postOpts: Partial<PostOpts> = {}) {
    initShared();
    const r = new THREE.WebGLRenderer({ canvas: cvs, antialias: false, preserveDrawingBuffer: true, powerPreference: "high-performance", stencil: false });
    r.setPixelRatio(outputDpr()); r.setSize(W, H, false);
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.NoToneMapping;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = r;
    this.camera = new THREE.PerspectiveCamera(42, W / H, 0.3, 60);
    const S = this.scene;
    S.background = lin("#1d3a4c");

    // ---- set: floor, back wall (brick), side wall (concrete). World-anchored brush: continuous across pieces.
    const mFloor = gouache({ map: rep(concreteTex(), 3, 3), anchor: "world", grid: 1, brushScale: 0.8, rim: 0.1 });
    const mBrick = gouache({ map: rep(brickTex(), 2.2, 3.4), anchor: "world", grid: 1, brushScale: 0.8, rim: 0.12 });
    const mConc = gouache({ map: rep(concreteTex(), 1.5, 3), anchor: "world", grid: 1, brushScale: 0.8, rim: 0.12 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), mFloor); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 0.5); floor.receiveShadow = true; S.add(floor);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(6, 5.5), mBrick); back.position.set(0, 2.75, -2.0); back.receiveShadow = true; S.add(back);
    const side = new THREE.Mesh(new THREE.PlaneGeometry(5, 5.5), mConc); side.rotation.y = Math.PI / 2; side.position.set(-1.6, 2.75, 0.5); side.receiveShadow = true; S.add(side);

    // ---- guide rail: T-profile with a machined (bright, glinting) head, dark web, brackets
    const mRailHead = gouache({ map: rep(steelTex("railhead", "#9AA6B0", 3), 1, 12), spec: 1, gloss: 140, specTh: 0.35, metal: 1, rim: 0.7, brushScale: 3 });
    const mRailWeb = gouache({ map: rep(steelTex("railweb", "#4E5C6A", 5), 1, 10), spec: 0.6, gloss: 50, specTh: 0.6, metal: 0.6, rim: 0.4, brushScale: 3 });
    const rail = new THREE.Group(); rail.position.set(0.62, 0, -1.25); S.add(rail);
    const head = new THREE.Mesh(new RoundedBoxGeometry(0.036, 4.6, 0.07, 3, 0.009), mRailHead); head.castShadow = head.receiveShadow = true; head.position.set(0, 2.3, 0.07); rail.add(head);
    const web = box(0.018, 4.6, 0.09, mRailWeb); web.position.set(0, 2.3, -0.01); rail.add(web);
    const flange = box(0.16, 4.6, 0.02, mRailWeb); flange.position.set(0, 2.3, -0.065); rail.add(flange);
    for (const y of [0.4, 1.9, 3.4]) { const b = box(0.24, 0.07, 0.68, mRailWeb); b.position.set(0, y, -0.39); rail.add(b); }

    // ---- safety gear on the rail: resin housing (clear in X-RAY), green jaws (brand, stay painted), spring inside
    const gear = new THREE.Group(); gear.position.set(0, 1.25, 0.07); rail.add(gear);
    const mHousing = gouache({ map: rep(steelTex("housing", "#3B4656", 9), 1, 1), resin: 1, spec: 0.5, gloss: 60, specTh: 0.5, metal: 0.4, rim: 0.5, brushScale: 3 });
    const housing = new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.34, 0.2, 3, 0.012), mHousing); housing.castShadow = housing.receiveShadow = true; gear.add(housing);
    this.jawMat = brandMat(BRAND.green, { kind: "enamel" });
    for (const s of [-1, 1]) { const j = box(0.045, 0.2, 0.09, this.jawMat); j.position.set(s * 0.045, -0.02, 0.0); j.rotation.z = s * 0.12; gear.add(j); }
    const mSpring = gouache({ color: "#8E99A4", spec: 0.8, gloss: 90, specTh: 0.45, metal: 0.8, brushScale: 4 });
    const spring = new THREE.Mesh(new THREE.TorusKnotGeometry(0.03, 0.007, 64, 6, 2, 9), mSpring); spring.position.set(0, 0.11, 0); spring.rotation.x = Math.PI / 2; spring.castShadow = true; gear.add(spring);
    gear.updateMatrixWorld(true); gear.getWorldPosition(this.jawPos);

    // ---- figure proxy (amber jacket = brand lock; navy trousers; cream helmet; skin head; tape bands)
    const fig = new THREE.Group(); fig.position.set(-0.32, 0, -0.55); fig.rotation.y = 0.55; S.add(fig);
    const mJacket = brandMat(BRAND.amber, { kind: "fabric" });
    const mTrous = gouache({ color: "#2B3A55", brush: 0.6, rim: 0.35, xray: 0 });
    const mBoot = gouache({ color: "#3A2A22", spec: 0.5, gloss: 40, specTh: 0.7, xray: 0 });
    const mSkin = gouache({ color: "#B07A56", rim: 0.3, xray: 0, spec: 0.25, gloss: 18, specTh: 0.9 });
    const mHelm = gouache({ color: "#E8DCC0", spec: 0.85, gloss: 90, specTh: 0.5, rim: 0.3, xray: 0 });
    const mTape = gouache({ color: "#D5E0E3", spec: 0.85, gloss: 14, specTh: 0.5, xray: 0, brush: 0.3 }); // retro-reflective tape: broad bright sheen
    for (const s of [-1, 1]) {
      const leg = capsule(0.075, 0.68, mTrous); leg.position.set(s * 0.11, 0.48, 0); fig.add(leg);
      const boot = box(0.13, 0.11, 0.26, mBoot); boot.position.set(s * 0.11, 0.055, 0.04); fig.add(boot);
      const arm = capsule(0.062, 0.5, mJacket); arm.position.set(s * 0.29, 1.2, 0.02); arm.rotation.z = s * 0.16; fig.add(arm);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), mSkin); hand.position.set(s * 0.335, 0.88, 0.03); hand.castShadow = true; fig.add(hand);
    }
    const torso = capsule(0.2, 0.36, mJacket, 24); torso.scale.set(1, 1, 0.72); torso.position.set(0, 1.2, 0); fig.add(torso);
    for (const y of [1.06, 1.16]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.203, 0.203, 0.035, 32, 1, true), mTape); t.scale.set(1, 1, 0.73); t.position.set(0, y, 0); fig.add(t); }
    const neck = capsule(0.05, 0.06, mSkin); neck.position.set(0, 1.55, 0); fig.add(neck);
    const headM = new THREE.Mesh(new THREE.SphereGeometry(0.105, 24, 18), mSkin); headM.scale.set(0.92, 1.08, 1); headM.position.set(0, 1.7, 0.01); headM.castShadow = true; fig.add(headM);
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.122, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), mHelm); helm.position.set(0, 1.74, 0); helm.castShadow = true; fig.add(helm);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.012, 28), mHelm); brim.position.set(0, 1.745, 0.03); brim.castShadow = true; fig.add(brim);
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.03, 12), gouache({ color: "#ffffff", emissive: "#fff2d8", emissiveIntensity: 2.2, xray: 0 })); lamp.rotation.x = Math.PI / 2; lamp.position.set(0, 1.8, 0.12); fig.add(lamp);
    const blob = new THREE.Mesh(new THREE.CircleGeometry(0.34, 24), new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.0 })); blob.visible = false; fig.add(blob);

    // ---- swatch turntable (front plinth): row 1 brand colours, row 2 metal / wet / plastic / concrete
    const mPlinth = gouache({ map: rep(steelTex("plinth", "#55646A", 13), 2, 1), rim: 0.3, spec: 0.3, gloss: 30, specTh: 0.8 });
    const plinth = box(1.5, 0.42, 0.62, mPlinth); plinth.position.set(0.1, 0.21, 0.55); S.add(plinth);
    const step = box(1.5, 0.12, 0.3, mPlinth); step.position.set(0.1, 0.48, 0.4); S.add(step);
    const mats: THREE.Material[] = [
      brandMat(BRAND.amber, { kind: "fabric" }), brandMat(BRAND.green, { kind: "enamel" }), brandMat(BRAND.red, { kind: "plastic" }), brandMat(BRAND.cyan, { kind: "enamel" }),
      gouache({ map: rep(steelTex("brushed", "#A9B3BC", 31), 1, 1), spec: 1, gloss: 160, specTh: 0.35, metal: 1, rim: 0.6, brushScale: 4 }),
      gouache({ color: "#1C1F26", spec: 0.95, gloss: 220, specTh: 0.3, rim: 0.5, brush: 0.4 }),
      gouache({ color: "#E8DCC0", spec: 0.8, gloss: 80, specTh: 0.45, rim: 0.3 }),
      gouache({ map: rep(concreteTex(), 0.4, 0.4), rim: 0.15, brushScale: 1.5 }),
    ];
    mats.forEach((m, i) => {
      const row = i < 4 ? 0 : 1, col = i % 4;
      const geo = i === 0 || i === 7 ? new THREE.BoxGeometry(0.2, 0.2, 0.2, 1, 1, 1) : new THREE.SphereGeometry(0.115, 40, 28);
      const sw = new THREE.Mesh(geo, m); sw.castShadow = sw.receiveShadow = true;
      sw.position.set(-0.43 + col * 0.34, row === 0 ? 0.535 : 0.655, row === 0 ? 0.72 : 0.42);
      S.add(sw); this.swatches.push(sw);
    });

    // ---- lights: warm lamp key (shadow 1024), red beacon practical, cool rim (shadow 512); practical lamp in frame
    const key = new THREE.SpotLight(lin("#ffdcb0"), 17, 0, 0.5, 0.5, 1.25);
    key.position.set(-1.4, 3.8, 2.1); key.target.position.set(-0.02, 0.8, -0.35); S.add(key, key.target);
    key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0005; key.shadow.normalBias = 0.012; key.shadow.camera.near = 0.5; key.shadow.camera.far = 9; key.shadow.radius = 2.5;
    const rim = new THREE.SpotLight(lin("#a6e2ee"), 5, 0, 0.7, 0.6, 1.2);
    rim.position.set(1.3, 3.9, -1.75); rim.target.position.set(-0.3, 1.0, -0.4); S.add(rim, rim.target);
    rim.castShadow = true; rim.shadow.mapSize.set(512, 512); rim.shadow.bias = -0.0008; rim.shadow.normalBias = 0.015; rim.shadow.camera.near = 0.5; rim.shadow.camera.far = 8;
    const beacon = new THREE.PointLight(lin(BRAND.red), 0.9, 2.4, 1.8); beacon.position.set(1.05, 2.35, -1.75); S.add(beacon);
    const beaconMesh = new THREE.Mesh(new THREE.SphereGeometry(0.07, 20, 14), new THREE.MeshBasicMaterial({ color: lin(BRAND.red).multiplyScalar(3.2) }));
    beaconMesh.position.copy(beacon.position); S.add(beaconMesh);
    const cageMat = gouache({ color: "#2E3540", spec: 0.6, gloss: 50, specTh: 0.5, metal: 0.6 });
    const cage = box(0.16, 0.06, 0.16, cageMat); cage.position.set(-0.75, 2.92, -1.88); S.add(cage);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 20, 14), new THREE.MeshBasicMaterial({ color: lin("#ffe2b0").multiplyScalar(5) }));
    bulb.position.set(-0.75, 2.82, -1.85); S.add(bulb);
    const lampLight = new THREE.PointLight(lin("#ffd8a8"), 1.4, 3.5, 1.6); lampLight.position.copy(bulb.position).add(new THREE.Vector3(0, -0.05, 0.15)); S.add(lampLight);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.6, 32, 1, true), beamMaterial("#ffd8a8", 0.10, { noise: hazeTex() }));
    cone.position.set(-0.75, 2.82 - 1.3, -1.6); S.add(cone);
    this.practicals = [beaconMesh, bulb]; this.beacon = beacon; this.cone = cone;

    this.post = createPost(r, S, this.camera, { focus: 3.9, focusRange: 1.4, dofMaxPx: 6, ...postOpts });
  }

  render(f: number) {
    const sec = sectionAt(f);
    // states
    if (sec.sweep !== undefined) setSweep(0, 2, { offset: -0.2 + 5.2 * sec.sweep, soft: 0.08 });
    else setLookState(sec.state);
    // practicals per state: no lamp glow on blueprint paper; beams dimmed under the X-RAY glaze
    const bpOnly = sec.state === 0 && sec.sweep === undefined;
    this.practicals.forEach((m) => (m.visible = !bpOnly));
    ((this.cone.material as THREE.ShaderMaterial).uniforms.uI.value = sec.state === 1 ? 0.04 : 0.10);
    // swatch turntable (still for the first 10 frames of each section)
    const ang = Math.max(0, sec.lf - 10) * 0.07;
    this.swatches.forEach((s, i) => { s.rotation.set(0.25, ang + i * 0.6, 0); });
    // camera: 3/4 front, slow push after the hold
    const push = glide((sec.lf - 10) / 25);
    const P0 = new THREE.Vector3(0.8, 1.62, 3.35), L0 = new THREE.Vector3(-0.02, 1.22, -0.7);
    const pos = P0.clone().lerp(L0, 0.07 * push);
    this.camera.position.copy(pos); this.camera.up.set(0, 1, 0); this.camera.lookAt(L0); this.camera.updateProjectionMatrix();
    this.post.focus(pos.distanceTo(new THREE.Vector3(-0.32, 1.2, -0.55)) + 0.2, 1.4);
    // clamp moment: jaw glow (emissive over the exact green) + local flash, decays in ~10 frames
    const fl = sec.flash !== undefined && sec.flash >= 0 ? Math.exp(-sec.flash / 3.5) : 0;
    this.jawMat.emissive.copy(lin(BRAND.green)); this.jawMat.emissiveIntensity = 2.2 * fl;
    this.post.flash(fl > 0.01 ? this.jawPos : null, 0.55 * fl, 170, BRAND.green);
    void U;
    this.post.render();
    return { state: sec.state, name: sec.name, ms: this.post.lastMs };
  }
}
