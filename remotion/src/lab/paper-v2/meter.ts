// Danger meter: a die-cut card gauge "in front of the lens" on the LEFT edge. Built in 3D in pixel units of the
// 1080x1920 frame (x right, y up), rendered after the lens blur (so it never picks up the scene's depth) and before
// bloom + grade (so it is graded with the frame). Lit by its own copy of the scene key + navy ambient + the red alarm,
// with a real shadow map so the slider tab casts a soft shadow onto the backing card.
import * as THREE from "three";
import { Card, roundRect, shapeFromPts } from "./card";
import { BRAND, untone, Pt } from "./paint";

const X0 = 30, X1 = 122;        // backing card (px @1080)
const Y0 = 1920 - 1010, Y1 = 1920 - 340; // bottom / top (y up): screen rows 340..1010
const WX0 = 62, WX1 = 90;       // die-cut window
const WY0 = Y0 + 64, WY1 = Y1 - 92;

export class Meter {
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  root = new THREE.Group();
  key: THREE.DirectionalLight;
  amb: THREE.HemisphereLight;
  alarm: THREE.PointLight;
  fill: THREE.Mesh;
  fillMat: THREE.MeshBasicMaterial;
  slider = new THREE.Group();
  constructor() {
    const D = 3000;
    this.camera = new THREE.PerspectiveCamera((2 * Math.atan(960 / D) * 180) / Math.PI, 1080 / 1920, 100, 6000);
    this.camera.position.set(540, 960, D); this.camera.lookAt(540, 960, 0);
    this.scene.add(this.root);
    const lock = "solid" as const;
    // backing: navy board, cream printed border + ticks + labels, die-cut window
    const back = roundRect(X0, Y0, X1 - X0, Y1 - Y0, 16);
    const win = new THREE.Path();
    win.moveTo(WX0 + 6, WY0); win.lineTo(WX1 - 6, WY0); win.quadraticCurveTo(WX1, WY0, WX1, WY0 + 6); win.lineTo(WX1, WY1 - 6); win.quadraticCurveTo(WX1, WY1, WX1 - 6, WY1); win.lineTo(WX0 + 6, WY1); win.quadraticCurveTo(WX0, WY1, WX0, WY1 - 6); win.lineTo(WX0, WY0 + 6); win.quadraticCurveTo(WX0, WY0, WX0 + 6, WY0);
    back.holes.push(win);
    const backC = new Card(back, {
      lock, stock: { base: "#1d2a44", mottle: 0.05, core: "#d8d0bd", kind: "paper" }, thick: 10, px: 2.2, maxPx: 1500, seed: 4401, inset: false, edge: 1.1,
      print: (p) => {
        const g = p.g; g.save();
        p.stroke([[X0 + 8, Y0 + 8], [X1 - 8, Y0 + 8], [X1 - 8, Y1 - 8], [X0 + 8, Y1 - 8]], "rgba(233,224,203,0.85)", 2.2, true);
        for (let i = 0; i <= 10; i++) {
          const y = WY0 + ((WY1 - WY0) * i) / 10, long = i % 5 === 0;
          p.stroke([[X0 + 14, y], [WX0 - 6, y]], "rgba(233,224,203,0.85)", long ? 3 : 1.6);
          p.stroke([[WX1 + 6, y], [WX1 + (long ? 22 : 14), y]], "rgba(233,224,203,0.85)", long ? 3 : 1.6);
        }
        p.text("DANGER", (X0 + X1) / 2, Y1 - 44, 15, "#ff5a4f", { align: "center", font: "'JetBrains Mono', monospace", weight: 800 });
        p.text("SAFE", (X0 + X1) / 2, Y0 + 22, 15, "#5dffa0", { align: "center", font: "'JetBrains Mono', monospace", weight: 800 });
        g.restore();
      },
    });
    backC.mesh.position.z = 0; this.root.add(backC.mesh);
    // printed scale strip behind the window (dim, stepped green -> red)
    const strip = new Card(roundRect(WX0 - 8, WY0 - 8, WX1 - WX0 + 16, WY1 - WY0 + 16, 4), {
      lock, stock: { base: "#2a3243", mottle: 0.03, core: "#cfc8b8", kind: "coated" }, thick: 3, px: 2, seed: 4402, inset: false,
      print: (p) => {
        for (let i = 0; i < 10; i++) {
          const y = WY0 + ((WY1 - WY0) * i) / 10, u = i / 9;
          const c = new THREE.Color("#2c8a58").lerp(new THREE.Color("#a3302c"), u);
          p.rect(WX0 - 4, y + 2, WX1 - WX0 + 8, (WY1 - WY0) / 10 - 4, `#${c.getHexString()}`, { alpha: 0.75 });
        }
      },
    });
    strip.mesh.position.z = -12; this.root.add(strip.mesh);
    // live fill: brand-exact colour card rising behind the window (unlit, untoned)
    this.fillMat = new THREE.MeshBasicMaterial({ color: untone(BRAND.green) });
    this.fill = new THREE.Mesh(new THREE.PlaneGeometry(WX1 - WX0 + 10, 1), this.fillMat);
    this.fill.position.set((WX0 + WX1) / 2, WY0, -8); this.root.add(this.fill);
    // slider tab: cream coated card with a die-cut pointer notch, brass split pin
    const tabPts: Pt[] = [[X0 - 10, -15], [X1 + 6, -15], [X1 + 6, 15], [X0 - 10, 15], [X0 - 10, 4], [X0 - 1, 0], [X0 - 10, -4]];
    const tab = new Card(shapeFromPts(tabPts), {
      lock, stock: { base: "#efe6d0", mottle: 0.04, core: "#fffaf0", kind: "coated" }, thick: 6, px: 3, seed: 4403, inset: false,
      print: (p) => { p.stroke([[WX0 - 4, 0], [WX1 + 4, 0]], "#1d2a44", 3); p.rect(X1 - 14, -7, 10, 14, "#1d2a44"); },
    });
    tab.mesh.position.z = 18; this.slider.add(tab.mesh);
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.5, 3, 18), new THREE.MeshStandardMaterial({ color: "#c79a3c", metalness: 0.85, roughness: 0.3 }));
    pin.rotation.x = Math.PI / 2; pin.position.set(X1 - 9, 0, 22); this.slider.add(pin);
    this.root.add(this.slider);
    for (const m of [backC.mesh, strip.mesh, tab.mesh]) { m.castShadow = true; m.receiveShadow = true; }
    // lights
    this.amb = new THREE.HemisphereLight("#33476e", "#1a1410", 1.2); this.scene.add(this.amb);
    this.key = new THREE.DirectionalLight("#ffc890", 2.4);
    this.key.position.set(300, 1500, 500); this.key.target.position.set(76, 1250, 0);
    this.key.castShadow = true; this.key.shadow.mapSize.set(512, 1024);
    const sc = this.key.shadow.camera; sc.left = -200; sc.right = 200; sc.top = 500; sc.bottom = -500; sc.near = 10; sc.far = 2000;
    this.key.shadow.bias = -0.002; this.key.shadow.radius = 3;
    this.scene.add(this.key, this.key.target);
    this.alarm = new THREE.PointLight("#ff2a22", 0, 900, 1.2); this.alarm.position.set(200, 1500, 120); this.scene.add(this.alarm);
    this.root.rotation.y = 0.18; // slight turn toward the frame centre: the card catches the key
    this.root.position.set(-6, 0, 0);
  }
  /** level 0..1, show 0..1 (slide-in), look lighting */
  update(level: number, show: number, look: "solid" | "blueprint" | "xray", alarm: number) {
    const y = WY0 + (WY1 - WY0) * level;
    this.slider.position.set(0, y, 0);
    this.fill.scale.y = Math.max(0.001, y - WY0 + 4); this.fill.position.y = WY0 - 4 + (y - WY0 + 4) / 2;
    const c = new THREE.Color(BRAND.green).lerp(new THREE.Color(BRAND.red), THREE.MathUtils.smoothstep(level, 0.15, 0.8));
    this.fillMat.color = untone(`#${c.getHexString()}`);
    this.root.position.x = -6 - 190 * (1 - show);
    this.root.visible = show > 0.001;
    if (look === "solid") { this.key.color.set("#ffc890"); this.key.intensity = 2.4; this.amb.color.set("#33476e"); this.amb.intensity = 1.2; }
    else { this.key.color.set("#cfeaff"); this.key.intensity = 1.8; this.amb.color.set("#2b4d80"); this.amb.intensity = 1.3; }
    this.alarm.intensity = 2.5e4 * alarm;
  }
}
