// The elevator shaft at night, built for the camera: back wall (board-formed concrete) with stacked landing doors
// leaking cool light through their slits, a brick side wall, T guide rails on brackets, the car with crosshead,
// stiles, balustrade, inspection box, caged work lamp, hoist ropes, and the safety gear (housings + green jaws).
// Atmosphere: additive light volumes (lamp cone, slit sheets), haze sheets, dust motes lit inside the beams, bokeh.
import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { gouache, glazeMaterial, beamMaterial, lin, BRAND, U } from "./shade";
import { concreteTex, brickTex, steelTex, roofTex, panelTex, hazeTex, bokehTex, dotTex, arrowTex, rng } from "./paint";

const rep = (t: THREE.Texture, x: number, y: number) => { const c = t.clone(); c.wrapS = c.wrapT = THREE.RepeatWrapping; c.repeat.set(x, y); c.needsUpdate = true; return c; };

export const CAR_W = 1.6, CAR_D = 1.4, CAR_H = 2.5, RAIL_X = 1.0, RAIL_Z = -0.35, WALL_Z = -1.2, WALL_X = -1.5;
export const LAMP_POS = new THREE.Vector3(-0.92, 1.95, 0.74);
export const KEY_T = new THREE.Vector3(-0.12, 0.62, -0.62);
export const CHAR_POS = new THREE.Vector3(-0.08, 0, 0.22);
export const GEAR_Y = 0.16;

export type World = {
  scene: THREE.Scene; car: THREE.Group; fixed: THREE.Group;
  key: THREE.SpotLight; head: THREE.SpotLight; slit: THREE.SpotLight; slit2: THREE.SpotLight; beacon: THREE.PointLight; jawLight: THREE.PointLight;
  beaconMesh: THREE.Mesh; bulb: THREE.Mesh; jaws: THREE.Mesh[]; jawMat: THREE.MeshLambertMaterial; slitMats: THREE.MeshBasicMaterial[];
  lampCone: THREE.Mesh; headCone: THREE.Mesh; beams: THREE.ShaderMaterial[]; hazeMats: THREE.ShaderMaterial[]; motes: THREE.Points; moteMat: THREE.ShaderMaterial;
  ropes: { mesh: THREE.Mesh; x: number }[]; ropeMat: THREE.Material; ropeLines: LineSegments2;
  lines: LineSegments2[]; lineMats: LineMaterial[];
  bpOnly: THREE.Object3D[]; solidOnly: THREE.Object3D[]; xrayOnly: THREE.Object3D[]; notXray: THREE.Object3D[]; notBp: THREE.Object3D[];
  arrows: THREE.Mesh[]; sparks: THREE.Points; sparkMat: THREE.ShaderMaterial; anchors: Record<string, THREE.Object3D>;
};

export function buildWorld(): World {
  const scene = new THREE.Scene();
  const fixed = new THREE.Group(); scene.add(fixed);
  const car = new THREE.Group(); scene.add(car);
  const bpOnly: THREE.Object3D[] = [], solidOnly: THREE.Object3D[] = [], xrayOnly: THREE.Object3D[] = [], notXray: THREE.Object3D[] = [], notBp: THREE.Object3D[] = [];
  const edgeSrc: { mesh: THREE.Mesh; parent: THREE.Object3D; thr?: number }[] = [];
  const anchors: Record<string, THREE.Object3D> = {};

  const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, pos: [number, number, number], o: { cast?: boolean; recv?: boolean; edges?: boolean; rot?: [number, number, number]; thr?: number } = {}) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(...pos); if (o.rot) m.rotation.set(...o.rot);
    m.castShadow = o.cast ?? true; m.receiveShadow = o.recv ?? true; parent.add(m);
    if (o.edges !== false) edgeSrc.push({ mesh: m, parent, thr: o.thr });
    return m;
  };
  const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);

  // ---------- materials ----------
  const mConcrete = gouache({ map: rep(concreteTex(), 1, 8), grid: 1, brushScale: 0.8, rim: 0.15 });
  const mBrick = gouache({ map: rep(brickTex(), 1.4, 12), grid: 1, brushScale: 0.8, rim: 0.15 });
  const mRail = gouache({ map: rep(steelTex("rail", "#7D8A96", 3), 1, 24), brushScale: 2, rim: 0.8 });
  const mSteel = gouache({ map: rep(steelTex("steel", "#4E5C6A", 5), 1, 1), brushScale: 2, rim: 0.5 });
  const mDark = gouache({ map: rep(steelTex("dark", "#323B4A", 9), 1, 1), brushScale: 2, rim: 0.5 });
  const mDoor = gouache({ map: rep(steelTex("door", "#55646A", 13), 1, 2), brushScale: 1.5, rim: 0.3 });
  const mRoof = gouache({ map: rep(roofTex(), 1.2, 1.1), brushScale: 1.4, rim: 0.2 });
  const mPanel = gouache({ map: rep(panelTex(), 1.4, 1.6), brushScale: 1.2, rim: 0.35 });
  const mBalu = gouache({ color: "#7C7766", map: rep(steelTex("balu", "#8A8470", 17), 1, 1), brushScale: 2, rim: 0.5 });
  const mRope = gouache({ map: rep(steelTex("rope", "#8F9AA4", 23), 1, 60), brushScale: 4, rim: 0.9, brush: 0.4 });
  const mInterior = gouache({ color: "#C8B898", map: rep(roofTex(), 2, 2), brushScale: 1.4, xray: 0.35 });
  const jawCap = gouache({ color: "#1C9E58", emissive: "#1C9E58", emissiveIntensity: 0.2, brushScale: 3, rim: 0.4, xray: 0, brush: 0.3 });
  const jawMat = gouache({ color: BRAND.green, emissive: BRAND.green, emissiveIntensity: 0.25, brushScale: 3, rim: 0.4, xray: 0, brush: 0.3 });

  // ---------- shaft (fixed) ----------
  add(fixed, new THREE.PlaneGeometry(3.4, 44), mConcrete, [0.15, 4, WALL_Z], { cast: false, edges: false });
  add(fixed, new THREE.PlaneGeometry(2.8, 44), mBrick, [WALL_X, 4, 0.2], { cast: false, edges: false, rot: [0, Math.PI / 2, 0] });
  // pit floor far below (lost in haze)
  add(fixed, new THREE.PlaneGeometry(3.4, 2.8), mConcrete, [0.15, -16, 0.2], { cast: false, edges: false, rot: [-Math.PI / 2, 0, 0] });
  // rails + brackets
  for (const s of [-1, 1]) {
    const blade = add(fixed, box(0.09, 44, 0.018), mRail, [s * (RAIL_X - 0.045), 4, RAIL_Z], { thr: 30 });
    void blade;
    add(fixed, box(0.016, 44, 0.13), mRail, [s * (RAIL_X + 0.008), 4, RAIL_Z], { thr: 30 });
    for (let y = -14; y < 24; y += 2.4) {
      add(fixed, box(0.5, 0.06, 0.16), mDark, [s * (RAIL_X + 0.27), y + 0.9, RAIL_Z]);
      add(fixed, box(0.03, 0.22, 0.2), mDark, [s * (RAIL_X + 0.03), y + 0.9, RAIL_Z]);
    }
  }
  // landing doors stacked on the back wall: frame, two panels, glowing slit + sill gap
  const slitMats: THREE.MeshBasicMaterial[] = [];
  const bok = bokehTex();
  for (let k = -3; k <= 5; k++) {
    const y0 = 0.62 + k * 3.3;
    const g = new THREE.Group(); g.position.set(0.05, y0, WALL_Z + 0.02); fixed.add(g);
    add(g, box(1.24, 0.14, 0.08), mDark, [0, 2.17, 0.04]);           // header / hanger
    add(g, box(0.1, 2.1, 0.06), mDark, [-0.6, 1.05, 0.03]);
    add(g, box(0.1, 2.1, 0.06), mDark, [0.6, 1.05, 0.03]);
    add(g, box(1.3, 0.06, 0.18), mSteel, [0, -0.03, 0.09]);           // sill
    add(g, box(0.545, 2.08, 0.03), mDoor, [-0.28, 1.05, 0.03]);
    add(g, box(0.545, 2.08, 0.03), mDoor, [0.28, 1.05, 0.03]);
    const sm = new THREE.MeshBasicMaterial({ color: lin("#bfeaf2").multiplyScalar(3.2), toneMapped: false });
    slitMats.push(sm);
    const slit = new THREE.Mesh(new THREE.PlaneGeometry(0.016, 2.04), sm); slit.position.set(0, 1.05, 0.005); g.add(slit);
    const sill = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.012), sm); sill.position.set(0, 0.012, 0.005); g.add(sill);
    // floor number plate (painted, tiny)
    add(g, box(0.16, 0.1, 0.01), mSteel, [0.48, 1.6, 0.05], { edges: false });
    // bokeh from distant slits (only far ones)
    if (k >= 1 || k <= -2) {
      const r = rng(k + 40);
      for (let j = 0; j < 3; j++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: bok, color: lin(j % 2 ? "#a8e6f2" : "#ffd9a8").multiplyScalar(0.55), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        sp.position.set(-0.3 + r() * 0.8, 0.3 + r() * 1.6, 0.25 + r() * 0.5); const s = 0.18 + r() * 0.22; sp.scale.set(s, s, 1); g.add(sp); notBp.push(sp);
      }
    }
  }
  // red alarm beacon on a wall bracket (left wall)
  add(fixed, box(0.22, 0.04, 0.12), mDark, [WALL_X + 0.11, 1.84, 0.62]);
  const beaconMesh = add(fixed, new THREE.SphereGeometry(0.055, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: lin(BRAND.red) }), [WALL_X + 0.16, 1.86, 0.62], { cast: false });
  const beacon = new THREE.PointLight(lin(BRAND.red), 0, 7, 1.4); beacon.position.set(WALL_X + 0.22, 1.95, 0.62); fixed.add(beacon);

  // ---------- car ----------
  // body (shell) + glaze twin for X-RAY + interior revealed by X-RAY
  const body = add(car, box(CAR_W, CAR_H - 0.04, CAR_D), mPanel, [0, -CAR_H / 2 - 0.02, 0]);
  notXray.push(body);
  const bodyGlaze = new THREE.Mesh(box(CAR_W, CAR_H - 0.04, CAR_D), glazeMaterial(BRAND.cyan, 1.0)); bodyGlaze.position.copy(body.position); car.add(bodyGlaze); xrayOnly.push(bodyGlaze);
  const floor = add(car, box(CAR_W - 0.04, 0.04, CAR_D - 0.04), mInterior, [0, -CAR_H + 0.04, 0], { edges: false }); xrayOnly.push(floor);
  const hand = add(car, box(CAR_W - 0.2, 0.035, 0.035), mSteel, [0, -1.55, -CAR_D / 2 + 0.08], { edges: false }); xrayOnly.push(hand);
  const roof = add(car, box(CAR_W + 0.04, 0.045, CAR_D + 0.04), mRoof, [0, -0.0225, 0], { thr: 20 });
  notXray.push(roof);
  const roofGlaze = new THREE.Mesh(roof.geometry, glazeMaterial(BRAND.cyan, 0.8)); roofGlaze.position.copy(roof.position); car.add(roofGlaze); xrayOnly.push(roofGlaze);
  const cabLamp = add(car, box(0.5, 0.03, 0.2), new THREE.MeshBasicMaterial({ color: lin("#fff1d6").multiplyScalar(2.2) }), [0, -0.08, 0], { cast: false, edges: false }); xrayOnly.push(cabLamp);
  const cabLight = new THREE.PointLight(lin("#ffe2b8"), 0, 4, 1.2); cabLight.position.set(0, -0.3, 0); car.add(cabLight); cabLight.userData.xray = true;
  (car.userData as { cabLight?: THREE.PointLight }).cabLight = cabLight;
  // crosshead + stiles
  add(car, box(1.84, 0.18, 0.12), mDark, [0, 0.43, RAIL_Z]);
  add(car, box(0.16, 0.06, 0.2), mSteel, [0, 0.55, RAIL_Z]); // rope hitch plate
  for (const s of [-1, 1]) add(car, box(0.06, CAR_H + 0.55, 0.16), mDark, [s * 0.86, -CAR_H / 2 + 0.27, RAIL_Z]);
  // balustrade along the back edge
  for (const x of [-0.74, 0.0, 0.74]) add(car, new THREE.CylinderGeometry(0.018, 0.018, 1.0, 10), mBalu, [x, 0.5, -0.66]);
  add(car, new THREE.CylinderGeometry(0.02, 0.02, 1.5, 10), mBalu, [0, 1.0, -0.66], { rot: [0, 0, Math.PI / 2] });
  add(car, new THREE.CylinderGeometry(0.015, 0.015, 1.5, 10), mBalu, [0, 0.55, -0.66], { rot: [0, 0, Math.PI / 2] });
  add(car, box(1.5, 0.1, 0.012), mBalu, [0, 0.05, -0.66]); // toe board
  // inspection box
  add(car, box(0.26, 0.16, 0.16), mSteel, [0.5, 0.08, -0.38]);
  add(car, new THREE.CylinderGeometry(0.025, 0.025, 0.02, 12), new THREE.MeshBasicMaterial({ color: lin("#d8f0ff").multiplyScalar(1.6) }), [0.45, 0.17, -0.38], { edges: false });
  // caged work lamp on a post at the front-left corner, aimed at Rafa and the gear
  add(car, new THREE.CylinderGeometry(0.018, 0.022, LAMP_POS.y, 10), mBalu, [LAMP_POS.x, LAMP_POS.y / 2, LAMP_POS.z]);
  add(car, box(0.14, 0.03, 0.14), mDark, [LAMP_POS.x, 0.015, LAMP_POS.z]);
  const lampHead = new THREE.Group(); lampHead.position.copy(LAMP_POS); car.add(lampHead);
  const keyTarget = new THREE.Object3D(); keyTarget.position.copy(KEY_T); car.add(keyTarget);
  lampHead.lookAt(KEY_T); // +z of lampHead points at target
  add(lampHead, new THREE.CylinderGeometry(0.06, 0.075, 0.12, 14, 1, true), mDark, [0, 0, -0.03], { rot: [Math.PI / 2, 0, 0] });
  for (let i = 0; i < 4; i++) add(lampHead, box(0.006, 0.006, 0.12), mBalu, [Math.cos(i * 1.57) * 0.07, Math.sin(i * 1.57) * 0.07, 0.06], { cast: false });
  const bulb = add(lampHead, new THREE.SphereGeometry(0.04, 14, 10), new THREE.MeshBasicMaterial({ color: lin("#ffe2b0").multiplyScalar(6) }), [0, 0, 0.03], { cast: false, edges: false });
  notBp.push(bulb);
  const key = new THREE.SpotLight(lin("#ffdcb0"), 6, 0, 0.74, 0.55, 1.25);
  key.position.copy(LAMP_POS).add(new THREE.Vector3(0, 0, -0.02)); key.target = keyTarget; car.add(key);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0006; key.shadow.normalBias = 0.015; key.shadow.camera.near = 0.15; key.shadow.camera.far = 9;
  key.shadow.radius = 3;
  // safety gear: a housing on each stile around the rail blade, two wedge jaws inside (open at the front)
  const jaws: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const hg = new THREE.Group(); hg.position.set(s * (RAIL_X - 0.05), GEAR_Y, RAIL_Z); car.add(hg);
    const back = add(hg, box(0.22, 0.38, 0.035), mSteel, [0, 0, -0.13]); notXray.push(back);
    const top = add(hg, box(0.22, 0.05, 0.28), mSteel, [0, 0.19, 0]); notXray.push(top);
    const shoe = add(hg, box(0.2, 0.05, 0.28), mSteel, [0, -0.17, 0]); notXray.push(shoe);
    for (const g2 of [back, top, shoe]) {
      const gz = new THREE.Mesh(g2.geometry, glazeMaterial(BRAND.cyan, 1.2)); gz.position.copy(g2.position); hg.add(gz); xrayOnly.push(gz);
    }
    for (const zs of [-1, 1]) {
      // wedge jaw: flat toothed grip face toward the blade, slanted back riding the housing taper (thick at the bottom)
      const P2 = (zz: number, yy: number) => new THREE.Vector2(-zz * zs, yy);
      const shape = new THREE.Shape([P2(0.03, -0.14), P2(0.1, -0.14), P2(0.055, 0.13), P2(0.03, 0.13)]);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.13, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1 }); geo.translate(0, 0, -0.065); geo.rotateY(Math.PI / 2);
      const j = add(hg, geo, [jawCap, jawMat] as unknown as THREE.Material, [s * 0.04, -0.01, 0]);
      j.userData = { zs, base: j.position.clone() };
      // teeth on the grip face (dark green grooves)
      for (let t = 0; t < 6; t++) add(j, box(0.13, 0.006, 0.004), new THREE.MeshBasicMaterial({ color: lin("#0d4a2a") }), [0, -0.11 + t * 0.042, zs * 0.029], { cast: false, edges: false });
      jaws.push(j);
    }
    // bolts on the housing
    for (const yy of [-0.1, 0.1]) add(hg, new THREE.CylinderGeometry(0.012, 0.012, 0.02, 8), mBalu, [-s * 0.12, yy, 0.06], { rot: [0, 0, Math.PI / 2], edges: false });
    if (s < 0) { const a = new THREE.Object3D(); a.position.set(0, 0, 0.08); hg.add(a); anchors.gear = a; }
  }
  const jawLight = new THREE.PointLight(lin(BRAND.green), 0, 2.4, 1.5); jawLight.position.set(-(RAIL_X - 0.15), GEAR_Y + 0.05, RAIL_Z + 0.25); car.add(jawLight);

  // hoist ropes from the hitch up into the dark
  const ropes: { mesh: THREE.Mesh; x: number }[] = [];
  const ropePts: number[] = [];
  for (const x of [-0.075, -0.025, 0.025, 0.075]) {
    const curve = new THREE.LineCurve3(new THREE.Vector3(x, 0.58, RAIL_Z), new THREE.Vector3(x, 30, RAIL_Z));
    const m = add(car, new THREE.TubeGeometry(curve, 1, 0.011, 8, false), mRope, [0, 0, 0], { edges: false });
    ropes.push({ mesh: m, x });
    ropePts.push(x, 0.58, RAIL_Z, x, 30, RAIL_Z);
    const term = add(car, new THREE.CylinderGeometry(0.018, 0.018, 0.12, 8), mSteel, [x, 0.64, RAIL_Z], { edges: false }); void term;
  }
  anchors.ropes = new THREE.Object3D(); anchors.ropes.position.set(0, 2.6, RAIL_Z); car.add(anchors.ropes);
  anchors.char = new THREE.Object3D(); anchors.char.position.set(CHAR_POS.x - 0.1, 1.9, CHAR_POS.z); car.add(anchors.char);
  anchors.rail = new THREE.Object3D(); anchors.rail.position.set(-RAIL_X, 2.8, RAIL_Z); fixed.add(anchors.rail);

  // ---------- light: headlamp, slit lights ----------
  const head = new THREE.SpotLight(lin("#e4f0ff"), 3.2, 0, 0.26, 0.55, 1.4); car.add(head); car.add(head.target);
  const slit = new THREE.SpotLight(lin("#a6e2ee"), 2.6, 0, 1.1, 1.0, 1.1); slit.position.set(0.05, 1.7, WALL_Z + 0.05);
  const st = new THREE.Object3D(); st.position.set(0.1, 0.6, 1.2); fixed.add(st); slit.target = st; fixed.add(slit);
  const slit2 = new THREE.SpotLight(lin("#a6e2ee"), 2.2, 0, 1.1, 1.0, 1.1); slit2.position.set(0.05, 5.0, WALL_Z + 0.05);
  const st2 = new THREE.Object3D(); st2.position.set(0.1, 3.6, 1.2); fixed.add(st2); slit2.target = st2; fixed.add(slit2);

  // ---------- volumes ----------
  const hz = hazeTex();
  const beams: THREE.ShaderMaterial[] = [];
  const cone = (len: number, r0: number, r1: number, mat: THREE.ShaderMaterial) => {
    const g = new THREE.CylinderGeometry(r0, r1, len, 32, 1, true); g.translate(0, -len / 2, 0); // source at origin, extends along -Y
    const m = new THREE.Mesh(g, mat); m.renderOrder = 50; m.castShadow = false; m.receiveShadow = false; return m;
  };
  const lampMat = beamMaterial("#ffc98c", 0.16, { noise: hz }); beams.push(lampMat);
  const lampCone = cone(3.4, 0.05, 2.2, lampMat);
  lampCone.position.copy(LAMP_POS); lampCone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), KEY_T.clone().sub(LAMP_POS).normalize());
  car.add(lampCone); notBp.push(lampCone);
  const headMat = beamMaterial("#dcecff", 0.13, { noise: hz }); beams.push(headMat);
  const headCone = cone(4.0, 0.02, 1.0, headMat); car.add(headCone); notBp.push(headCone);
  for (let k = -3; k <= 5; k++) {
    const y0 = 0.62 + k * 3.3;
    const mat = beamMaterial("#9fdcea", k === 0 ? 0.5 : 0.36, { noise: hz }); beams.push(mat);
    const c = cone(2.6, 0.02, 1.1, mat); c.position.set(0.05, y0 + 1.1, WALL_Z + 0.03);
    c.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0.12, -0.32, 1).normalize());
    c.scale.set(0.45, 1, 1); fixed.add(c);
  }
  // haze sheets (between wall and ropes, and up the shaft): painted cloud noise, faded at the edges
  const hazeMats: THREE.ShaderMaterial[] = [];
  const hazeMat = (col: string, k: number, rx: number, ry: number) => {
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uN: { value: hz }, uC: { value: lin(col) }, uK: { value: k }, uT: { value: 0 }, uR: { value: new THREE.Vector2(rx, ry) }, uState: U.uState, uCyan: U.uCyan },
      vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vW = (modelMatrix*vec4(position,1.0)).xyz; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `uniform sampler2D uN; uniform vec3 uC; uniform float uK; uniform float uT; uniform vec2 uR; uniform float uState; uniform vec3 uCyan; varying vec2 vUv; varying vec3 vW;
        void main(){ vec2 e = smoothstep(vec2(0.0), vec2(0.18), vUv) * smoothstep(vec2(0.0), vec2(0.18), 1.0 - vUv);
          float n = texture2D(uN, vUv * uR + vec2(uT*0.004, uT*0.01)).r * 1.4 + texture2D(uN, vUv * uR * 0.37 - vec2(uT*0.003, uT*0.006)).r;
          vec3 c = uState < 0.5 ? uCyan * 0.35 : uC;
          gl_FragColor = vec4(c * n * e.x * e.y * uK, 1.0); }`,
    });
    hazeMats.push(m); return m;
  };
  const sheet = (w: number, h: number, pos: [number, number, number], col: string, k: number, rot: [number, number, number] = [0, 0, 0]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), hazeMat(col, k, w * 0.6, h * 0.6)); m.position.set(...pos); m.rotation.set(...rot); m.renderOrder = 40; return m;
  };
  fixed.add(sheet(3.2, 14, [0.1, 6.5, WALL_Z + 0.25], "#7fb6c8", 0.07));
  fixed.add(sheet(3.0, 14, [0.1, 7.5, -0.75], "#8aa6c8", 0.05));
  fixed.add(sheet(3.0, 10, [0.1, -5.5, 0.2], "#4f8aa0", 0.08));
  // glow halo around the lamp bulb
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: lin("#ffc890").multiplyScalar(0.9), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.set(0.7, 0.7, 1); lampHead.add(halo); halo.position.set(0, 0, 0.06); notBp.push(halo);
  const bhalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: lin(BRAND.red).multiplyScalar(0.0), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  bhalo.scale.set(0.6, 0.6, 1); bhalo.position.set(WALL_X + 0.2, 1.88, 0.62); fixed.add(bhalo); beaconMesh.userData.halo = bhalo;

  // dust motes: brighter inside the lamp cone and the slit sheets (computed in the vertex shader)
  const N = 650, r = rng(77), pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos[i * 3] = -1.4 + r() * 2.9; pos[i * 3 + 1] = -0.6 + r() * 4.2; pos[i * 3 + 2] = -1.1 + r() * 2.6; seed[i] = r(); }
  const mg = new THREE.BufferGeometry(); mg.setAttribute("position", new THREE.BufferAttribute(pos, 3)); mg.setAttribute("seed", new THREE.BufferAttribute(seed, 1));
  const moteMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uT: { value: 0 }, uLamp: { value: LAMP_POS.clone() }, uAxis: { value: KEY_T.clone().sub(LAMP_POS).normalize() }, uMap: { value: dotTex() }, uPx: { value: 960 }, uState: U.uState, uCyan: U.uCyan, uCarY: { value: 0 } },
    vertexShader: `attribute float seed; uniform float uT; uniform vec3 uLamp; uniform vec3 uAxis; uniform float uPx; uniform float uCarY; varying float vB; varying vec3 vC;
      void main(){ vec3 p = position;
        p.x += sin(uT*0.4 + seed*40.0)*0.05; p.y += mod(uT*0.03*(0.4+seed) + seed*4.2, 4.2) - seed*4.2*0.0; p.y = mod(p.y + 0.6, 4.2) - 0.6 + uCarY; p.z += cos(uT*0.33 + seed*21.0)*0.05;
        vec3 d = p - (uLamp + vec3(0.0, uCarY, 0.0)); float cosA = dot(normalize(d), uAxis);
        float inLamp = smoothstep(0.72, 0.9, cosA) * smoothstep(3.6, 0.3, length(d));
        float inSlit = smoothstep(0.5, 0.0, abs(p.x - 0.05)) * smoothstep(1.4, -1.0, p.z) * (1.0 - smoothstep(0.0, 1.0, abs(mod(p.y - 1.7 + 1.65, 3.3) - 1.65)));
        vB = 0.015 + inLamp * 1.2 + inSlit * 0.45; vC = mix(vec3(0.62, 0.86, 0.95), vec3(1.0, 0.74, 0.45), inLamp / (inLamp + inSlit + 0.001));
        vB *= 0.6 + 0.8 * fract(seed * 13.7);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp((0.006 + 0.008 * fract(seed*7.3)) * uPx / -mv.z, 1.0, 5.0); }`,
    fragmentShader: `uniform sampler2D uMap; uniform float uState; uniform vec3 uCyan; varying float vB; varying vec3 vC;
      void main(){ float a = texture2D(uMap, gl_PointCoord).r; vec3 c = uState < 0.5 ? uCyan : vC; gl_FragColor = vec4(c * a * vB, 1.0); }`,
  });
  const motes = new THREE.Points(mg, moteMat); motes.frustumCulled = false; motes.renderOrder = 60; fixed.add(motes);

  // sparks at the jaws (clamp frame)
  const SN = 90, sp = new Float32Array(SN * 3), sv = new Float32Array(SN * 3), rs = rng(5);
  for (let i = 0; i < SN; i++) { sv[i * 3] = (rs() - 0.2) * 1.6; sv[i * 3 + 1] = rs() * 1.8 - 0.3; sv[i * 3 + 2] = (rs() - 0.3) * 1.8; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(sp, 3)); sg.setAttribute("vel", new THREE.BufferAttribute(sv, 3));
  const sparkMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uAge: { value: -1 }, uO: { value: new THREE.Vector3() }, uMap: { value: dotTex() }, uPx: { value: 960 } },
    vertexShader: `attribute vec3 vel; uniform float uAge; uniform vec3 uO; uniform float uPx; varying float vA;
      void main(){ float t = max(uAge, 0.0); vec3 p = uO + vel * t * 0.9 + vec3(0.0, -4.9, 0.0) * t * t; vA = uAge < 0.0 ? 0.0 : clamp(1.0 - t / (0.35 + 0.4*fract(vel.x*7.0)), 0.0, 1.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(0.02 * uPx / -mv.z, 1.0, 6.0); }`,
    fragmentShader: `uniform sampler2D uMap; varying float vA; void main(){ float a = texture2D(uMap, gl_PointCoord).r; gl_FragColor = vec4(vec3(1.4, 1.6, 1.0) * a * vA, 1.0); }`,
  });
  const sparks = new THREE.Points(sg, sparkMat); sparks.frustumCulled = false; sparks.renderOrder = 70; car.add(sparks);

  // ---------- X-RAY force arrows (painted glowing strokes) ----------
  const arrows: THREE.Mesh[] = [];
  const amat = (k: number) => new THREE.MeshBasicMaterial({ map: arrowTex(), color: lin(BRAND.red).multiplyScalar(k), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const a1 = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 1.3), amat(1.3)); a1.position.set(0.5, 0.75, 0.45); a1.renderOrder = 80; car.add(a1); arrows.push(a1);
  const a2 = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 1.15), amat(1.2)); a2.position.set(0.0, 2.75, RAIL_Z + 0.1); a2.rotation.z = Math.PI; a2.renderOrder = 80; car.add(a2); arrows.push(a2);
  arrows.forEach((a) => xrayOnly.push(a));

  // ---------- BLUEPRINT line art: fat edges + a jittered sketch pass + a soft glow pass ----------
  const lineMats: LineMaterial[] = [];
  const lines: LineSegments2[] = [];
  const mk = (pos: number[], width: number, opacity: number, k: number, additive = false) => {
    const g = new LineSegmentsGeometry(); g.setPositions(pos);
    const m = new LineMaterial({ color: new THREE.Color(lin(BRAND.cyan)).multiplyScalar(k), linewidth: width, transparent: true, opacity, depthWrite: false });
    if (additive) m.blending = THREE.AdditiveBlending;
    lineMats.push(m);
    const l = new LineSegments2(g, m); l.renderOrder = 90; l.frustumCulled = false; return l;
  };
  const byParent = new Map<THREE.Object3D, number[]>();
  const jr = rng(303);
  for (const e of edgeSrc) {
    const eg = new THREE.EdgesGeometry(e.mesh.geometry, e.thr ?? 25);
    const a = eg.attributes.position.array as Float32Array;
    e.mesh.updateMatrix();
    const v = new THREE.Vector3(), arr = byParent.get(e.parent) ?? [];
    for (let i = 0; i < a.length; i += 3) { v.set(a[i], a[i + 1], a[i + 2]).applyMatrix4(e.mesh.matrix); arr.push(v.x, v.y, v.z); }
    byParent.set(e.parent, arr);
  }
  byParent.set(car, [...(byParent.get(car) ?? []), ...ropePts]);
  let ropeLines: LineSegments2 | null = null;
  for (const [parent, arr] of byParent) {
    const sketch: number[] = [];
    for (let i = 0; i < arr.length; i += 6) {
      const ax = arr[i], ay = arr[i + 1], az = arr[i + 2], bx = arr[i + 3], by = arr[i + 4], bz = arr[i + 5];
      const L = Math.hypot(bx - ax, by - ay, bz - az), ov = Math.min(0.04, L * 0.08) / (L || 1);
      const j = () => (jr() - 0.5) * 0.008;
      sketch.push(ax - (bx - ax) * ov + j(), ay - (by - ay) * ov + j(), az - (bz - az) * ov + j(), bx + (bx - ax) * ov + j(), by + (by - ay) * ov + j(), bz + (bz - az) * ov + j());
    }
    for (const l of [mk(arr, 2.4, 1, 1.0), mk(sketch, 1.2, 0.55, 1.0), mk(arr, 9, 0.16, 1.0, true)]) { parent.add(l); lines.push(l); bpOnly.push(l); }
  }
  ropeLines = lines[0];
  // fixed-object anchors for labels
  anchors.door = new THREE.Object3D(); anchors.door.position.set(0.45, 2.9, WALL_Z); fixed.add(anchors.door);

  return {
    scene, car, fixed, key, head, slit, slit2, beacon, jawLight, beaconMesh, bulb, jaws, jawMat, slitMats, lampCone, headCone, beams, hazeMats, motes, moteMat,
    ropes, ropeMat: mRope, ropeLines, lines, lineMats, bpOnly, solidOnly, xrayOnly, notXray, notBp, arrows, sparks, sparkMat, anchors,
  };
}
