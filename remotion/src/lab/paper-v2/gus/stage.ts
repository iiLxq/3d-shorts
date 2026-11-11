// [gus lab] Independent test stage: paper floor + paper backdrop, warm raking work-lamp key (real shadow map, the
// contact shadow comes from Gus's own cards), cool fill, cool rim, soft hemisphere. Same three looks as the world.
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { Card } from "./card";
import { Look, BRAND } from "./paint";
import { rectPts, shapeOf, wash, stitch } from "./kit";

export class Stage {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(28, 1080 / 1920, 0.05, 60);
  key: THREE.SpotLight;
  fill: THREE.DirectionalLight;
  rim: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  table: THREE.Mesh;
  cards: Card[] = [];
  constructor(gl: THREE.WebGLRenderer) {
    const s = this.scene;
    const pm = new THREE.PMREMGenerator(gl);
    s.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    s.environmentIntensity = 0.35;
    const floor = new Card(shapeOf(rectPts(-5, -5, 5, 5)), {
      stock: { base: "#7d8493", mottle: 0.07, flecks: ["#6a717f", "#8f96a4"], core: "#d9dde4" }, role: "structure", thick: 0.02,
      tile: { size: 1, key: "gusfloor", paint: (p, sz) => { stitch(p, [[0, 0.002], [sz, 0.002]], "rgba(20,25,35,0.18)", 0.002, 0.03); stitch(p, [[0.002, 0], [0.002, sz]], "rgba(20,25,35,0.18)", 0.002, 0.03); } }, px: 512,
    });
    floor.mesh.rotation.x = -Math.PI / 2; floor.mesh.castShadow = false; s.add(floor.mesh); this.cards.push(floor);
    const back = new Card(shapeOf(rectPts(-6, 0, 6, 6)), {
      stock: { base: "#3a4459", mottle: 0.08, flecks: ["#2f374a", "#4b566c"], core: "#c9cdd6" }, role: "structure", thick: 0.02, px: 120,
      print: (p, pts) => wash(p, pts, [0, 2.2], [0, 0], [[0, "rgba(0,0,0,0)"], [1, "rgba(0,0,0,0.25)"]]),
    });
    back.mesh.position.set(0, 0, -1.35); back.mesh.castShadow = false; s.add(back.mesh); this.cards.push(back);
    // x-ray light table glow (only in the vellum look)
    this.table = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.32, 0.5, 0.6) }));
    this.table.position.set(0, 3, -1.3); this.table.visible = false; s.add(this.table);

    this.hemi = new THREE.HemisphereLight("#8ea6d4", "#4a3a2c", 0.9); s.add(this.hemi);
    this.key = new THREE.SpotLight("#ffd6a6", 24, 12, 0.6, 0.55, 2);
    this.key.position.set(-2.3, 2.9, 2.6); this.key.target.position.set(0.2, 0.9, 0);
    this.key.castShadow = true; this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.camera.near = 1.5; this.key.shadow.camera.far = 9;
    this.key.shadow.bias = -0.00025; this.key.shadow.normalBias = 0.0025; this.key.shadow.radius = 3;
    s.add(this.key, this.key.target);
    this.fill = new THREE.DirectionalLight("#a8c0ff", 0.75); this.fill.position.set(2.6, 1.6, 2.2); s.add(this.fill);
    this.rim = new THREE.DirectionalLight("#cfe0ff", 1.4); this.rim.position.set(1.8, 2.6, -2.6); s.add(this.rim);
  }
  setLook(look: Look) {
    this.cards.forEach((c) => c.setLook(look));
    const s = this.scene;
    this.table.visible = look === "xray";
    if (look === "solid") {
      s.background = new THREE.Color("#1c2638"); s.fog = new THREE.FogExp2("#1c2638", 0.05);
      this.hemi.intensity = 0.34; this.key.intensity = 38; this.key.color.set("#ffd6a6"); this.fill.intensity = 0.5; this.rim.intensity = 1.3;
    } else if (look === "blueprint") {
      s.background = new THREE.Color(BRAND.navy); s.fog = new THREE.FogExp2(BRAND.navy, 0.06);
      this.hemi.intensity = 0.6; this.key.intensity = 16; this.key.color.set("#d8f2ff"); this.fill.intensity = 0.4; this.rim.intensity = 0.6;
    } else {
      s.background = new THREE.Color("#0f2236"); s.fog = new THREE.FogExp2("#0f2236", 0.03);
      this.hemi.intensity = 0.7; this.key.intensity = 12; this.key.color.set("#e6f6ff"); this.fill.intensity = 0.4; this.rim.intensity = 0.5;
    }
  }
  /** Orbit camera about a target: az (deg, + = toward Gus's left), el (deg), distance (m). */
  orbit(target: THREE.Vector3, az: number, el: number, dist: number, fov = 28, panDeg = 0, tiltDeg = 0) {
    const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180;
    const c = this.camera;
    c.fov = fov; c.updateProjectionMatrix();
    c.position.set(target.x + Math.sin(a) * Math.cos(e) * dist, target.y + Math.sin(e) * dist, target.z + Math.cos(a) * Math.cos(e) * dist);
    c.lookAt(target);
    if (panDeg || tiltDeg) { c.rotateY((panDeg * Math.PI) / 180); c.rotateX((tiltDeg * Math.PI) / 180); }
    c.updateMatrixWorld();
    return c;
  }
}
