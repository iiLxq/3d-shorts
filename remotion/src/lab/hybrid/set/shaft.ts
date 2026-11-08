// [hybrid/set, owned by the Set & Mechanism TD] buildShaft(): the elevator shaft at night, built for a portrait camera.
// Layout (metres, world): shaft interior x in [-1.4, 1.4], back wall z = -1.25, open front (camera side, +z).
// "Backpack" layout: both guide rails stand in front of the back wall with their blades pointing at the camera (+z),
// so the safety gear's jaws close on the blade LEFT/RIGHT in screen space (readable from the front, never stacked in
// depth). The hero gear is on the RIGHT rail (x = +0.98), keeping the left 140 px of frame free for the danger meter.
// The car group moves along y; car-space y = 0 is the top of the roof deck. Ropes rise from the hitch on the crosshead.
import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { gouache, glazeMaterial, beamMaterial, lin, BRAND, U } from "../look/shade";
import { concreteTex, brickTex, roofTex, steelTex, hazeTex, dotTex, arrowTex, rng } from "../look/paint";
import { enamelTex, doorTex, railTex, ropeTex, gunTex, cwTex, slateTex, stencilTex, repTex, boxGeo, polyTube, clamp01, smooth } from "./kit";

// ---------- layout constants ----------
export const SH = { x: 1.4, back: -1.25, yMin: -42, yMax: 46 };
export const CAR = { hw: 0.72, hd: 0.72, h: 2.5 };
export const RAIL = { x: 0.98, t: 0.036, tipZ: -0.85, rootZ: -1.048, flangeT: 0.022, flangeW: 0.17 };
export const BLADE_Z = (RAIL.tipZ + RAIL.rootZ) / 2; // -0.949
export const GEAR_Y = -0.3;           // car-space centre of the safety-gear housing
export const SLING_Z = -0.94;         // uprights + crosshead
export const HITCH_Y = 0.62;          // car-space rope socket top
export const BREAK_Y = 2.6;           // world height where the ropes part (car at rest = 0)
export const DOOR0 = -0.9;            // world sill height of the landing behind the car at rest
export const FLOOR0 = 18;             // floor number of that landing
export const LANDING = 3.3;           // floor-to-floor
export const CHAR_SPOT = new THREE.Vector3(0.18, 0, 0.1); // right of centre: figure + gear share one medium frame, left third stays quiet
const ROPE_X = [-0.105, -0.035, 0.035, 0.105];
const ROPE_DELAY = [0.04, 0.0, 0.09, 0.13]; // stagger: rope 1 parts first
// jaw design (gear-local, x outward from the blade centre): wedge thick at the bottom, rides up a 1:4 taper
const JAW = { tb: 0.1, tt: 0.03, h: 0.22, gap: 0.05, y0: -0.21, depth: 0.15 };
const GRIP0 = RAIL.t / 2 + 0.008; // grip-face x at contact: blade half-thickness + saw-tooth height
const RISE = JAW.gap / ((JAW.tb - JAW.tt) / JAW.h); // 0.136: travel that closes the gap

export interface Shaft {
  group: THREE.Group; car: THREE.Group; carRoofY: number; charSpot: THREE.Vector3;
  setRopeSnap(t: number): void; setCarDrop(y: number): void; setGearClamp(t: number): void; setAlarm(on: number): void;
  setState(s: 0 | 1 | 2): void; anchors: Record<string, THREE.Object3D>; lights: THREE.Light[];
  // additive extras (not in the phase-1 contract)
  setGearGlow(g: number): void;        // 0..1+ local green glow on the jaws only (setGearClamp sets a default)
  setSparks(age: number): void;        // gear contact sparks, seconds since the bite (<0 = none)
  setForce(k: number): void;           // X-RAY red force arrows (0..1)
  setTime(t: number): void;            // seconds; drives haze / dust drift (deterministic)
  setViewport(w: number, h: number, fovDeg?: number): void; // buffer px for blueprint line widths + particle sizes
  patent: { key: string; num: number; text: string }[]; // BLUEPRINT callouts (anchor key, FIG. numeral, label)
  state: number;
}

type EdgeSrc = { mesh: THREE.Mesh; thr: number; own: boolean };

export function buildShaft(): Shaft {
  const group = new THREE.Group(); group.name = "shaft";
  const fixed = new THREE.Group(); fixed.name = "fixed"; group.add(fixed);
  const car = new THREE.Group(); car.name = "car"; group.add(car);
  const anchors: Record<string, THREE.Object3D> = {};
  const bpOnly: THREE.Object3D[] = [], notBp: THREE.Object3D[] = [], xrayOnly: THREE.Object3D[] = [], notXray: THREE.Object3D[] = [];
  const edges: EdgeSrc[] = [];
  const anchor = (parent: THREE.Object3D, key: string, x: number, y: number, z: number) => { const a = new THREE.Object3D(); a.name = `anchor-${key}`; a.position.set(x, y, z); parent.add(a); anchors[key] = a; return a; };

  type AddO = { cast?: boolean; recv?: boolean; edges?: boolean; thr?: number; own?: boolean; rot?: [number, number, number] };
  const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], pos: [number, number, number], o: AddO = {}) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(...pos); if (o.rot) m.rotation.set(...o.rot);
    m.castShadow = o.cast ?? true; m.receiveShadow = o.recv ?? true; parent.add(m);
    if (o.edges !== false) edges.push({ mesh: m, thr: o.thr ?? 25, own: o.own ?? false });
    return m;
  };
  /** solid mesh + additive resin twin for X-RAY */
  const resin = (m: THREE.Mesh, k = 1) => { const gz = new THREE.Mesh(m.geometry, glazeMaterial(BRAND.cyan, k)); gz.position.copy(m.position); gz.rotation.copy(m.rotation); gz.scale.copy(m.scale); m.parent!.add(gz); xrayOnly.push(gz); notXray.push(m); return gz; };

  // ---------- materials ----------
  const mWall = gouache({ map: repTex(concreteTex(), 2.8 / 2.2, (SH.yMax - SH.yMin) / 2.2), grid: 1, brushScale: 0.8, rim: 0.12 });
  const mWallR = gouache({ map: repTex(concreteTex(), 2.5 / 2.2, (SH.yMax - SH.yMin) / 2.2), color: "#d8dcd8", grid: 1, brushScale: 0.8, rim: 0.12 });
  const mBrick = gouache({ map: repTex(brickTex(), 2.5 / 1.3, (SH.yMax - SH.yMin) / 1.3), grid: 1, brushScale: 0.8, rim: 0.12 });
  const mSlab = gouache({ map: repTex(concreteTex(), 1, 1), color: "#c9c8bc", brushScale: 0.9, rim: 0.2 });
  const railT = railTex();
  const mRail = gouache({ map: repTex(railT, 1, 1), brushScale: 2.2, rim: 0.7, brush: 0.5, xray: 0 });
  const mRailTip = gouache({ map: repTex(railT, 1, 1), color: "#e8eef4", brushScale: 2.2, rim: 0.9, brush: 0.4, xray: 0 });
  const mDark = gouache({ map: repTex(steelTex("set-dark", "#2F3846", 9), 1, 1), brushScale: 2, rim: 0.45 });
  const mSteel = gouache({ map: repTex(steelTex("set-steel", "#56626E", 5), 1, 1), brushScale: 2, rim: 0.5 });
  const mSling = gouache({ map: repTex(gunTex(), 1, 1), color: "#c8ccd4", brushScale: 2, rim: 0.5, xray: 0 });
  const mGun = gouache({ map: repTex(gunTex(), 1, 1), brushScale: 2.4, rim: 0.6, brush: 0.4 });
  const mCheek = gouache({ map: repTex(gunTex(), 5, 5), color: "#8a929c", brushScale: 2.4, rim: 0.35, brush: 0.4 }); // extrude UVs are metres
  const mMachined = gouache({ color: "#B9C2CA", map: repTex(railT, 1, 1), brushScale: 3, rim: 0.8, brush: 0.3, xray: 0 });
  const mEnamel = gouache({ map: repTex(enamelTex(), 1, 1), brushScale: 1.2, rim: 0.3 });
  const mRoof = gouache({ map: repTex(roofTex(), 1, 1), brushScale: 1.4, rim: 0.2 });
  const mDoor = gouache({ map: repTex(doorTex(), 1, 1), brushScale: 1.5, rim: 0.3 });
  const mSlate = gouache({ map: repTex(slateTex(), 1, 1), brushScale: 2, rim: 0.45 });
  const mCw = gouache({ map: repTex(cwTex(), 1, 1), brushScale: 1.5, rim: 0.3 });
  const mInterior = gouache({ color: "#C8B898", map: repTex(roofTex(), 2, 2), brushScale: 1.4, xray: 0.3 });
  const ropeT = repTex(ropeTex(), 1, 1);
  const mRope = gouache({ map: ropeT, brushScale: 4, rim: 0.9, brush: 0.35, xray: 0 });
  const mFray = gouache({ color: "#D7DEE4", brushScale: 4, rim: 1.0, brush: 0.2, xray: 0 });
  const mRopeBp = new THREE.MeshBasicMaterial({ color: lin(BRAND.cyan).multiplyScalar(1.1) });
  const mJaw = gouache({ color: "#27B865", emissive: BRAND.green, emissiveIntensity: 0.0, brushScale: 3, rim: 0.5, brush: 0.25, xray: 0 });
  const mJawFace = gouache({ color: "#17703F", emissive: BRAND.green, emissiveIntensity: 0.0, brushScale: 3, rim: 0.4, brush: 0.25, xray: 0 });
  const hot = (hex: string, k: number) => new THREE.MeshBasicMaterial({ color: lin(hex).multiplyScalar(k), toneMapped: false });

  // =====================================================================================================
  // FIXED: walls, slab bands, landing doors, rails, brackets, cable tray, conduit, counterweight, foreground column
  // =====================================================================================================
  const H = SH.yMax - SH.yMin, YC = (SH.yMax + SH.yMin) / 2;
  add(fixed, new THREE.PlaneGeometry(2 * SH.x, H), mWall, [0, YC, SH.back], { cast: false, edges: false });
  add(fixed, new THREE.PlaneGeometry(2.5, H), mBrick, [-SH.x, YC, 0], { cast: false, edges: false, rot: [0, Math.PI / 2, 0] });
  add(fixed, new THREE.PlaneGeometry(2.5, H), mWallR, [SH.x, YC, 0], { cast: false, edges: false, rot: [0, -Math.PI / 2, 0] });
  // pit floor far below (lost in haze)
  add(fixed, new THREE.PlaneGeometry(2 * SH.x, 2.5), mWall, [0, SH.yMin + 0.5, 0], { cast: false, edges: false, rot: [-Math.PI / 2, 0, 0] });

  const landings: number[] = [];
  for (let k = -12; k <= 13; k++) landings.push(k);
  const slitMats: THREE.MeshBasicMaterial[] = [];
  const hz = hazeTex();
  const beams: THREE.ShaderMaterial[] = [];
  const cone = (len: number, r0: number, r1: number, mat: THREE.ShaderMaterial) => {
    const g = new THREE.CylinderGeometry(r0, r1, len, 28, 1, true); g.translate(0, -len / 2, 0);
    const m = new THREE.Mesh(g, mat); m.renderOrder = 50; return m;
  };
  for (const k of landings) {
    const y0 = DOOR0 + k * LANDING;
    // slab band: lighter, slightly proud concrete strip at each floor (strong horizontal rhythm for scale + parallax)
    add(fixed, boxGeo(2 * SH.x, 0.32, 0.06, 1.1), mSlab, [0, y0 - 0.16, SH.back + 0.03], { cast: false, edges: true, thr: 40 });
    add(fixed, boxGeo(0.06, 0.32, 2.5, 1.1), mSlab, [-SH.x + 0.03, y0 - 0.16, 0], { cast: false, thr: 40 });
    add(fixed, boxGeo(0.06, 0.32, 2.5, 1.1), mSlab, [SH.x - 0.03, y0 - 0.16, 0], { cast: false, thr: 40 });
    if (Math.abs(k) > 9) continue;
    const g = new THREE.Group(); g.position.set(0, y0, SH.back + 0.02); fixed.add(g);
    add(g, boxGeo(1.24, 0.16, 0.09), mDark, [0, 2.16, 0.045]);              // header + track
    add(g, boxGeo(0.12, 2.1, 0.07), mDark, [-0.56, 1.05, 0.035]);           // jambs
    add(g, boxGeo(0.12, 2.1, 0.07), mDark, [0.56, 1.05, 0.035]);
    add(g, boxGeo(1.24, 0.05, 0.2), mSteel, [0, -0.025, 0.1]);              // sill
    add(g, boxGeo(0.49, 2.06, 0.03), mDoor, [-0.252, 1.04, 0.03]);          // leaves
    add(g, boxGeo(0.49, 2.06, 0.03), mDoor, [0.252, 1.04, 0.03]);
    for (const s of [-1, 1]) add(g, new THREE.CylinderGeometry(0.03, 0.03, 0.02, 12), mSteel, [s * 0.32, 2.2, 0.1], { rot: [Math.PI / 2, 0, 0], edges: false }); // hanger rollers
    // warm corridor light leaking through the meeting slit and the sill gap
    const sm = hot("#ffc890", 3.4); slitMats.push(sm);
    const slit = new THREE.Mesh(new THREE.PlaneGeometry(0.014, 2.02), sm); slit.position.set(0, 1.04, 0.047); g.add(slit); notBp.push(slit);
    const sill = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.012), sm); sill.position.set(0, 0.012, 0.047); g.add(sill); notBp.push(sill);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.008), sm); top.position.set(0, 2.075, 0.047); g.add(top); notBp.push(top);
    // stencilled floor number above the door
    const num = String(FLOOR0 + k);
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.31), gouache({ map: stencilTex(num), transparent: true, brushScale: 1.2, rim: 0, bpFill: 0.0 }));
    decal.position.set(0, y0 + 2.62, SH.back + 0.012); decal.receiveShadow = true; fixed.add(decal);
    if (k === 0) anchor(fixed, "door", 0, y0 + 2.62, SH.back + 0.05);
    // spill cone (additive), only near the action to save fill
    if (k >= -3 && k <= 4) {
      const mat = beamMaterial("#ffc890", k === 1 ? 0.3 : 0.22, { noise: hz }); beams.push(mat);
      const c = cone(2.4, 0.02, 1.0, mat); c.position.set(0, y0 + 1.15, SH.back + 0.05);
      c.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0.0, -0.3, 1).normalize());
      c.scale.set(0.35, 1, 1); fixed.add(c); notBp.push(c);
    }
  }
  // spill lights for the two landings that frame the car top
  const spills: THREE.SpotLight[] = [];
  for (const k of [0, 1]) {
    const y0 = DOOR0 + k * LANDING;
    const s = new THREE.SpotLight(lin("#ffcf98"), 2.4, 0, 1.05, 1.0, 1.15); s.position.set(0, y0 + 1.2, SH.back + 0.1);
    const t = new THREE.Object3D(); t.position.set(0, y0 + 0.1, 1.2); fixed.add(t); s.target = t; fixed.add(s); spills.push(s);
  }

  // guide rails (T-section, blade toward the camera), brackets every 2.5 m, fishplates every 5 m
  for (const s of [-1, 1]) {
    const x = s * RAIL.x;
    const bladeD = RAIL.tipZ - RAIL.rootZ;
    const bladeMats = [mRail, mRail, mRail, mRail, mRailTip, mRail];
    add(fixed, boxGeo(RAIL.t, H, bladeD, 0.6), bladeMats, [x, YC, (RAIL.tipZ + RAIL.rootZ) / 2], { thr: 30 });
    add(fixed, boxGeo(RAIL.flangeW, H, RAIL.flangeT, 0.6), mRail, [x, YC, RAIL.rootZ - RAIL.flangeT / 2], { thr: 30 });
    for (let y = SH.yMin + 1; y < SH.yMax; y += 2.5) {
      const bz0 = SH.back, bz1 = RAIL.rootZ - RAIL.flangeT;
      add(fixed, boxGeo(0.26, 0.22, 0.012, 0.5), mDark, [x, y, bz0 + 0.006]);                          // wall plate
      add(fixed, boxGeo(0.012, 0.18, bz1 - bz0, 0.5), mDark, [x - 0.1, y, (bz0 + bz1) / 2]);           // two arms
      add(fixed, boxGeo(0.012, 0.18, bz1 - bz0, 0.5), mDark, [x + 0.1, y, (bz0 + bz1) / 2]);
      add(fixed, boxGeo(0.23, 0.1, 0.014, 0.5), mDark, [x, y, bz1 - 0.007]);                           // seat
      for (const cx of [-0.068, 0.068]) add(fixed, boxGeo(0.035, 0.05, 0.03), mSteel, [x + cx, y, RAIL.rootZ + 0.012], { edges: false }); // clips
      for (const by of [-0.07, 0.07]) for (const bx of [-0.08, 0.08]) add(fixed, new THREE.CylinderGeometry(0.012, 0.012, 0.02, 6), mSteel, [x + bx, y + by, bz0 + 0.02], { rot: [Math.PI / 2, 0, 0], edges: false });
      if (Math.round((y - SH.yMin - 1) / 2.5) % 2 === 0) {
        for (const fx of [-1, 1]) add(fixed, boxGeo(0.012, 0.42, 0.07), mSteel, [x + fx * 0.024, y + 1.25, RAIL.rootZ + 0.04], { thr: 30 }); // fishplate
      }
    }
  }
  anchor(fixed, "rail", RAIL.x, 1.6, RAIL.tipZ + 0.01);

  // cable tray (left wall): ladder tray + cable bundles (instanced rungs)
  {
    const tx = -SH.x + 0.06, z0 = 0.18, z1 = 0.48;
    for (const z of [z0, z1]) add(fixed, boxGeo(0.06, H, 0.02, 0.6), mDark, [tx, YC, z], { thr: 40 });
    const n = Math.floor(H / 0.3);
    const rung = new THREE.InstancedMesh(boxGeo(0.05, 0.025, z1 - z0, 0.5), mDark, n);
    const M = new THREE.Matrix4();
    for (let i = 0; i < n; i++) { M.makeTranslation(tx, SH.yMin + i * 0.3, (z0 + z1) / 2); rung.setMatrixAt(i, M); }
    rung.receiveShadow = true; fixed.add(rung); notBp.push(rung);
    const cols = ["#2E3440", "#4A4E58", "#3C4452"];
    for (let i = 0; i < 3; i++) add(fixed, new THREE.CylinderGeometry(0.02 + i * 0.006, 0.02 + i * 0.006, H, 8), gouache({ color: cols[i], brushScale: 2, rim: 0.5 }), [tx + 0.04, YC, z0 + 0.06 + i * 0.09], { edges: false });
  }
  // conduit + junction boxes (right wall)
  {
    const cx = SH.x - 0.05, cz = 0.62;
    add(fixed, new THREE.CylinderGeometry(0.025, 0.025, H, 10), mSteel, [cx, YC, cz], { edges: false });
    for (const k of landings) {
      const y = DOOR0 + k * LANDING + 1.4;
      add(fixed, boxGeo(0.07, 0.16, 0.14, 0.4), mGun, [cx - 0.01, y, cz]);
      for (const d of [-1.2, 1.0]) add(fixed, boxGeo(0.03, 0.03, 0.08), mDark, [cx, y + d, cz], { edges: false });
    }
  }
  // counterweight on the right wall, hanging in the haze above the car, with its own small rails and ropes
  {
    const cwG = new THREE.Group(); cwG.position.set(1.2, 6.2, 0.1); fixed.add(cwG);
    add(cwG, boxGeo(0.06, 2.4, 0.08), mDark, [0, 0, -0.36]); add(cwG, boxGeo(0.06, 2.4, 0.08), mDark, [0, 0, 0.36]);   // stiles
    add(cwG, boxGeo(0.12, 0.12, 0.84), mDark, [0, 1.2, 0]); add(cwG, boxGeo(0.12, 0.12, 0.84), mDark, [0, -1.2, 0]);   // top/bottom
    add(cwG, boxGeo(0.1, 2.26, 0.64, 2.26), mCw, [0, 0, 0], { thr: 40 });                                             // filler stack
    for (const z of [-0.06, 0.06]) add(cwG, new THREE.CylinderGeometry(0.009, 0.009, 30, 6), mRope, [0, 16.2, z], { edges: false });
    for (const z of [-0.47, 0.47]) add(fixed, boxGeo(0.05, H, 0.025, 0.6), mRail, [1.24, YC, 0.1 + z], { thr: 30 });
    anchor(cwG, "cw", -0.08, 0, 0);
  }
  // foreground column (front-right) with clamps: parallax layer at the frame edge, never across the subject
  {
    const fx = SH.x - 0.1, fz = 1.18;
    add(fixed, boxGeo(0.16, H, 0.16, 0.8), mDark, [fx, YC, fz], { thr: 40 });
    add(fixed, new THREE.CylinderGeometry(0.03, 0.03, H, 10), mSteel, [fx - 0.13, YC, fz + 0.02], { edges: false });
    for (const k of landings) {
      const y = DOOR0 + k * LANDING;
      add(fixed, boxGeo(0.36, 0.26, 0.2, 0.8), mSlab, [SH.x - 0.18, y - 0.13, fz - 0.02], { thr: 40 });   // slab stub
      add(fixed, boxGeo(0.06, 0.08, 0.1), mGun, [fx - 0.13, y + 1.7, fz + 0.02], { edges: false });
    }
  }

  // =====================================================================================================
  // CAR: body (resin in X-RAY), roof deck + kit, sling (uprights, crosshead, hitch), guide shoes, safety gears
  // =====================================================================================================
  const body = add(car, boxGeo(2 * CAR.hw, CAR.h - 0.05, 2 * CAR.hd, 1.0), mEnamel, [0, -CAR.h / 2 - 0.025, 0], { thr: 20 }); resin(body, 0.9);
  for (const yy of [-0.7, -1.6]) { const rib = add(car, boxGeo(2 * CAR.hw + 0.02, 0.05, 0.02, 0.5), mEnamel, [0, yy, CAR.hd + 0.01], { thr: 20 }); notXray.push(rib); }
  const roof = add(car, boxGeo(2 * CAR.hw + 0.04, 0.05, 2 * CAR.hd + 0.04, 1.1), mRoof, [0, -0.025, 0], { thr: 20 }); resin(roof, 0.25);
  // interior (only seen through the resin)
  { const fl = add(car, boxGeo(2 * CAR.hw - 0.04, 0.04, 2 * CAR.hd - 0.04, 0.6), mInterior, [0, -CAR.h + 0.04, 0], { edges: false }); xrayOnly.push(fl);
    const hr = add(car, boxGeo(2 * CAR.hw - 0.2, 0.035, 0.035), mSteel, [0, -1.55, -CAR.hd + 0.08], { edges: false }); xrayOnly.push(hr); }
  const cab = new THREE.PointLight(lin("#ffe2b8"), 0, 3.2, 1.3); cab.position.set(0, -0.6, 0); car.add(cab);
  // door operator at the back edge of the roof
  { const op = add(car, boxGeo(1.0, 0.2, 0.2, 0.5), mGun, [0, 0.1, -CAR.hd + 0.14]); resin(op, 0.8);
    const mot = add(car, new THREE.CylinderGeometry(0.07, 0.07, 0.16, 14), mSteel, [-0.36, 0.27, -CAR.hd + 0.14], { rot: [0, 0, Math.PI / 2] }); notXray.push(mot); }
  // inspection box (muted, no brand colours) with stop mushroom + run switch
  { const ib = add(car, boxGeo(0.26, 0.18, 0.17, 0.4), mSteel, [0.42, 0.09, -0.3]); resin(ib, 0.8);
    const b1 = add(car, new THREE.CylinderGeometry(0.03, 0.03, 0.03, 12), mDark, [0.37, 0.195, -0.3], { edges: false }); notXray.push(b1);
    const b2 = add(car, boxGeo(0.02, 0.05, 0.02), hot("#e8f4ff", 1.4), [0.47, 0.205, -0.3], { edges: false, cast: false }); notXray.push(b2); }
  // toolbox (slate blue) front-right, coiled cable front-left
  { const tb = add(car, boxGeo(0.42, 0.15, 0.2, 0.4), mSlate, [-0.36, 0.075, 0.45], { rot: [0, 0.25, 0] }); resin(tb, 0.8);
    const h1 = add(car, boxGeo(0.26, 0.018, 0.02), mDark, [-0.36, 0.19, 0.45], { rot: [0, 0.25, 0] }); notXray.push(h1);
    const coil = add(car, new THREE.TorusGeometry(0.13, 0.016, 8, 28), mDark, [-0.4, 0.018, -0.25], { rot: [Math.PI / 2, 0, 0], edges: false }); notXray.push(coil);
    const coil2 = add(car, new THREE.TorusGeometry(0.11, 0.016, 8, 28), mDark, [-0.39, 0.05, -0.25], { rot: [Math.PI / 2 + 0.1, 0, 0], edges: false }); notXray.push(coil2); }
  // balustrade: left side + short back-left run only (never between camera and gear)
  {
    const posts: [number, number][] = [[-0.68, 0.55], [-0.68, -0.05], [-0.68, -0.6], [-0.2, -0.6]];
    for (const [x, z] of posts) add(car, new THREE.CylinderGeometry(0.018, 0.018, 1.05, 8), mSteel, [x, 0.525, z]);
    for (const y of [1.05, 0.55]) {
      add(car, new THREE.CylinderGeometry(0.02, 0.02, 1.15, 8), mSteel, [-0.68, y, -0.025], { rot: [Math.PI / 2, 0, 0] });
      add(car, new THREE.CylinderGeometry(0.02, 0.02, 0.48, 8), mSteel, [-0.44, y, -0.6], { rot: [0, 0, Math.PI / 2] });
    }
    add(car, boxGeo(0.012, 0.1, 1.15, 0.5), mSteel, [-0.68, 0.05, -0.025]);
  }
  // work lamp: mast clamped at the front-left corner, caged head aimed at the roof + gear zone (warm key)
  const LAMP = new THREE.Vector3(-0.62, 1.86, 0.6), LAMP_T = new THREE.Vector3(0.32, 0.25, -0.45);
  add(car, new THREE.CylinderGeometry(0.016, 0.02, LAMP.y, 8), mSteel, [LAMP.x, LAMP.y / 2, LAMP.z]);
  add(car, boxGeo(0.12, 0.04, 0.12), mDark, [LAMP.x, 0.02, LAMP.z]);
  const lampHead = new THREE.Group(); lampHead.position.copy(LAMP); car.add(lampHead); lampHead.lookAt(LAMP_T);
  add(lampHead, new THREE.CylinderGeometry(0.06, 0.08, 0.13, 14, 1, true), mDark, [0, 0, -0.03], { rot: [Math.PI / 2, 0, 0] });
  for (let i = 0; i < 4; i++) add(lampHead, boxGeo(0.006, 0.006, 0.12), mSteel, [Math.cos(i * 1.57 + 0.78) * 0.075, Math.sin(i * 1.57 + 0.78) * 0.075, 0.06], { cast: false, edges: false });
  const bulb = add(lampHead, new THREE.SphereGeometry(0.042, 14, 10), hot("#ffe2b0", 6), [0, 0, 0.03], { cast: false, edges: false }); notBp.push(bulb);
  const lampHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: lin("#ffc890").multiplyScalar(0.8), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  lampHalo.scale.set(0.32, 0.32, 1); lampHalo.position.set(0, 0, 0.07); lampHead.add(lampHalo); notBp.push(lampHalo);
  const keyT = new THREE.Object3D(); keyT.position.copy(LAMP_T); car.add(keyT);
  const key = new THREE.SpotLight(lin("#ffdcb0"), 7, 0, 0.8, 0.55, 1.25); key.position.copy(LAMP); key.target = keyT; car.add(key);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0006; key.shadow.normalBias = 0.015; key.shadow.camera.near = 0.15; key.shadow.camera.far = 8; key.shadow.radius = 3;
  anchor(lampHead, "lamp", 0, 0, 0.05);
  {
    const lampMat = beamMaterial("#ffc98c", 0.13, { noise: hz }); beams.push(lampMat);
    const lc = cone(3.0, 0.05, 1.9, lampMat); lc.position.copy(LAMP);
    lc.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), LAMP_T.clone().sub(LAMP).normalize()); car.add(lc); notBp.push(lc);
  }

  // sling: uprights at the back corners, crosshead with the rope hitch, car brackets
  for (const s of [-1, 1]) {
    add(car, boxGeo(0.07, CAR.h + 0.95, 0.12, 0.8), mSling, [s * 0.755, -CAR.h / 2 + 0.45 - 0.0, SLING_Z], { thr: 30 });
    for (const y of [-0.12, -CAR.h + 0.12]) add(car, boxGeo(0.06, 0.08, 0.22, 0.4), mSling, [s * 0.69, y, -CAR.hd - 0.1]);
  }
  add(car, boxGeo(1.58, 0.17, 0.14, 0.8), mSling, [0, 0.37, SLING_Z], { thr: 30 });
  add(car, boxGeo(1.44, 0.12, 0.12, 0.8), mSling, [0, -CAR.h - 0.06, SLING_Z], { thr: 30 }); // plank
  add(car, boxGeo(0.34, 0.03, 0.18), mSteel, [0, 0.47, SLING_Z]); // hitch plate
  for (const x of ROPE_X) {
    add(car, new THREE.CylinderGeometry(0.016, 0.016, 0.1, 8), mSteel, [x, 0.53, SLING_Z], { edges: false });   // rod + spring
    add(car, new THREE.CylinderGeometry(0.024, 0.024, 0.04, 10), mDark, [x, 0.51, SLING_Z], { edges: false });
    add(car, new THREE.CylinderGeometry(0.019, 0.013, 0.06, 8), mSteel, [x, HITCH_Y - 0.03, SLING_Z], { edges: false }); // socket
  }
  anchor(car, "hitch", 0, HITCH_Y, SLING_Z);
  anchor(car, "roof", 0, 0, 0);
  anchor(car, "char", CHAR_SPOT.x, 1.6, CHAR_SPOT.z);
  // car-top alarm beacon on the crosshead (left), red only when the alarm is on
  const beaconMat = hot(BRAND.red, 0.4);
  add(car, boxGeo(0.12, 0.05, 0.1), mDark, [-0.55, 0.48, SLING_Z]);
  const beaconMesh = add(car, new THREE.SphereGeometry(0.05, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), beaconMat, [-0.55, 0.505, SLING_Z], { cast: false, edges: false });
  const beaconHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: lin(BRAND.red).multiplyScalar(0), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  beaconHalo.scale.set(0.5, 0.5, 1); beaconHalo.position.set(-0.55, 0.54, SLING_Z + 0.02); car.add(beaconHalo); notBp.push(beaconHalo);
  const beacon = new THREE.PointLight(lin(BRAND.red), 0, 1.6, 1.8); beacon.position.set(-0.55, 0.62, SLING_Z + 0.1); car.add(beacon);
  anchor(car, "beacon", -0.55, 0.53, SLING_Z);

  // ---------- safety gears (the hero is the right one) ----------
  type Gear = { g: THREE.Group; jaws: { m: THREE.Mesh; side: number }[]; rods: THREE.Mesh[]; yoke: THREE.Mesh; pull: THREE.Mesh; halos: THREE.Sprite[]; light: THREE.PointLight };
  const gears: Gear[] = [];
  const cheekShape = (side: number) => {
    const xc = (y: number) => JAW.gap + GRIP0 + JAW.tb - (JAW.tb - JAW.tt) / JAW.h * (y - JAW.y0);
    const pts = [[0.19, -0.22], [0.19, 0.2], [xc(0.2), 0.2], [xc(-0.22), -0.22]].map(([x, y]) => new THREE.Vector2(side * x, y));
    return new THREE.Shape(pts);
  };
  const jawShape = (side: number) => {
    // grip face at x = 0 (toward the blade) with 6 saw teeth; back face slanted (thick at the bottom)
    const pts: THREE.Vector2[] = [new THREE.Vector2(0, 0), new THREE.Vector2(side * JAW.tb, 0), new THREE.Vector2(side * JAW.tt, JAW.h)];
    const n = 7;
    for (let i = n; i >= 1; i--) {
      const y = (i / n) * JAW.h;
      pts.push(new THREE.Vector2(0, y));
      pts.push(new THREE.Vector2(-side * 0.008, y - (JAW.h / n) * 0.5));
    }
    return new THREE.Shape(pts);
  };
  const extrude = (sh: THREE.Shape, depth: number) => { const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1 }); g.translate(0, 0, -depth / 2); return g; };
  for (const s of [1, -1]) {
    const gg = new THREE.Group(); gg.position.set(s * RAIL.x, GEAR_Y, BLADE_Z); gg.scale.x = s; car.add(gg);
    const parts: THREE.Mesh[] = [];
    for (const side of [-1, 1]) parts.push(add(gg, extrude(cheekShape(side), 0.17), mCheek, [0, 0, 0], { thr: 20 }));
    for (const side of [-1, 1]) {
      parts.push(add(gg, boxGeo(0.165, 0.045, 0.17, 0.3), mGun, [side * (0.027 + 0.0825), 0.2225, 0]));   // top plate halves (blade slot)
      parts.push(add(gg, boxGeo(0.165, 0.045, 0.17, 0.3), mGun, [side * (0.027 + 0.0825), -0.2425, 0]));  // bottom plate halves
    }
    parts.forEach((p) => resin(p, 1.15));
    // machined bright edge strips on the cheeks' front faces (reads as precision steel at phone size)
    for (const side of [-1, 1]) { const st = add(gg, boxGeo(0.012, 0.42, 0.006), mMachined, [side * 0.184, -0.01, 0.088], { edges: false, cast: false }); notXray.push(st); }
    // bolts on the cheeks + mount plate to the upright (inner side)
    for (const side of [-1, 1]) for (const by of [-0.15, 0.0, 0.15]) { const b = add(gg, new THREE.CylinderGeometry(0.013, 0.013, 0.014, 6), mMachined, [side * 0.165, by, 0.09], { rot: [Math.PI / 2, 0, 0], edges: false }); notXray.push(b); }
    const mount = add(gg, boxGeo(0.04, 0.5, 0.15, 0.4), mGun, [-0.205, -0.01, -0.01]); resin(mount, 1.0);
    // wedge jaws
    const jaws: { m: THREE.Mesh; side: number }[] = [];
    for (const side of [-1, 1]) {
      const geo = extrude(jawShape(side), JAW.depth);
      const m = add(gg, geo, [mJaw, mJawFace], [0, 0, 0], { own: true, thr: 20 });
      jaws.push({ m, side });
    }
    // lift links (jaw -> yoke) + yoke in front of the blade below the housing + pull rod down to the governor lever
    const rods = [-1, 1].map(() => add(gg, new THREE.CylinderGeometry(0.007, 0.007, 1, 6), mMachined, [0, 0, 0.0], { edges: false, own: true }));
    const yoke = add(gg, boxGeo(0.4, 0.024, 0.024), mMachined, [0, 0, 0.115], { own: true });
    const pull = add(gg, new THREE.CylinderGeometry(0.009, 0.009, 0.62, 6), mMachined, [-0.19, 0, 0.115], { own: true });
    add(gg, boxGeo(0.05, 0.05, 0.05), mGun, [-0.19, -0.98, 0.1]); // lever pivot block
    // local glow: green point light with short reach + soft halo sprites at the grip faces
    const light = new THREE.PointLight(lin(BRAND.green), 0, 0.42, 2.0); light.position.set(0, 0.0, 0.12); gg.add(light);
    const halos: THREE.Sprite[] = [];
    for (const side of [-1, 1]) {
      const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: lin(BRAND.green), opacity: 0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      h.scale.set(0.16, 0.3, 1); h.position.set(side * 0.03, 0, 0.1); gg.add(h); notBp.push(h); halos.push(h);
    }
    gears.push({ g: gg, jaws, rods, yoke, pull, halos, light });
    if (s > 0) { anchor(gg, "gear", 0, 0, 0.1); anchor(gg, "gearJaw", 0.035, 0.0, 0.08); anchor(gg, "gearSpark", 0.0, 0.0, 0.1); }
    // guide shoes above and at the bottom (small dark C-blocks, clearly not the gear)
    for (const y of [0.32 - GEAR_Y, -CAR.h + 0.1 - GEAR_Y]) {
      add(gg, boxGeo(0.11, 0.12, 0.12, 0.3), mDark, [-0.075, y, 0.02]);
      add(gg, boxGeo(0.04, 0.12, 0.12, 0.3), mDark, [0.04, y, 0.02]);
    }
  }
  // gear lamp: small caged bulkhead on the upright that keeps the mechanism lit in every state/shot
  const gl0 = new THREE.Vector3(0.7, 0.2, -0.8), glT = new THREE.Vector3(RAIL.x, GEAR_Y - 0.05, BLADE_Z);
  add(car, boxGeo(0.09, 0.07, 0.07), mDark, [gl0.x, gl0.y, gl0.z]);
  const glBulb = add(car, new THREE.SphereGeometry(0.022, 10, 8), hot("#fff0d8", 4), [gl0.x + 0.02, gl0.y - 0.035, gl0.z + 0.02], { cast: false, edges: false }); notBp.push(glBulb);
  const gearLamp = new THREE.SpotLight(lin("#ffecd0"), 1.3, 2.2, 0.85, 0.6, 1.5); gearLamp.position.copy(gl0).add(new THREE.Vector3(0.03, -0.04, 0.04));
  const glTo = new THREE.Object3D(); glTo.position.copy(glT); car.add(glTo); gearLamp.target = glTo; car.add(gearLamp);

  // ---------- hoist ropes ----------
  const ropeTop = 60;
  const intact = ROPE_X.map((x) => add(car, new THREE.CylinderGeometry(0.012, 0.012, ropeTop - HITCH_Y, 8, 1, true), mRope, [x, (ropeTop + HITCH_Y) / 2, SLING_Z], { edges: false, cast: true }));
  intact.forEach((m) => { const uv = m.geometry.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.075 / 0.06, uv.getY(i) * (ropeTop - HITCH_Y) / 0.06); });
  const lowM = ROPE_X.map(() => { const m = new THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>(new THREE.BufferGeometry(), [mRope, mFray]); m.castShadow = true; m.visible = false; car.add(m); return m; });
  const upM = ROPE_X.map(() => { const m = new THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>(new THREE.BufferGeometry(), [mRope, mFray]); m.castShadow = true; m.visible = false; fixed.add(m); return m; });
  anchor(fixed, "ropeBreak", 0, BREAK_Y, SLING_Z);
  anchor(fixed, "ropeTop", 0, 7.5, SLING_Z);
  const fray = (end: THREE.Vector3, tan: THREE.Vector3, seed: number, open: number) => {
    const r = rng(seed), out: THREE.BufferGeometry[] = [];
    const n1 = new THREE.Vector3().crossVectors(tan, new THREE.Vector3(0.3, 0.2, 1).normalize()).normalize(), n2 = new THREE.Vector3().crossVectors(tan, n1).normalize();
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2 + r() * 0.5, spl = (0.35 + r() * 0.9) * open, len = (0.035 + r() * 0.08) * (0.4 + 0.6 * open);
      const d = tan.clone().addScaledVector(n1, Math.cos(a) * spl).addScaledVector(n2, Math.sin(a) * spl).normalize();
      const p0 = end.clone().addScaledVector(tan, -0.01).addScaledVector(n1, Math.cos(a) * 0.007).addScaledVector(n2, Math.sin(a) * 0.007);
      const p1 = end.clone().addScaledVector(d, len * 0.5).addScaledVector(n1, (r() - 0.5) * 0.01);
      const p2 = end.clone().addScaledVector(d, len).addScaledVector(n2, (r() - 0.5) * 0.02 * open);
      out.push(polyTube([p0, p1, p2], 0.0032, 4, 0.05));
    }
    return out;
  };
  const setPiece = (m: THREE.Mesh, pts: THREE.Vector3[], fr: THREE.BufferGeometry[]) => {
    const body = polyTube(pts, 0.012, 7, 0.06);
    const fm = mergeGeometries(fr, false)!;
    const merged = mergeGeometries([body, fm], true)!;
    body.dispose(); fm.dispose(); fr.forEach((g) => g.dispose());
    m.geometry.dispose(); m.geometry = merged; m.visible = true;
  };

  // ---------- particles: sparks (gear contacts + rope break), dust motes riding with the car top ----------
  const sparkSys = (n: number, seed: number, vel: (r: () => number, i: number) => [number, number, number], origin: (i: number) => [number, number, number], col: string) => {
    const p = new Float32Array(n * 3), v = new Float32Array(n * 3), o = new Float32Array(n * 3), rs = rng(seed);
    for (let i = 0; i < n; i++) { const [a, b, c] = vel(rs, i); v.set([a, b, c], i * 3); o.set(origin(i), i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(p, 3)); g.setAttribute("vel", new THREE.BufferAttribute(v, 3)); g.setAttribute("org", new THREE.BufferAttribute(o, 3));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uAge: { value: -1 }, uMap: { value: dotTex() }, uPx: { value: 960 }, uCol: { value: lin(col) } },
      vertexShader: `attribute vec3 vel; attribute vec3 org; uniform float uAge; uniform float uPx; varying float vA;
        void main(){ float life = 0.25 + 0.45*fract(vel.x*7.13 + vel.z*3.7); float delay = 0.12*fract(vel.y*5.3);
          float t = max(uAge - delay, 0.0); vec3 p = org + vel * t + vec3(0.0, -4.9, 0.0) * t * t;
          vA = (uAge < delay) ? 0.0 : clamp(1.0 - t / life, 0.0, 1.0);
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
          // motion-stretched size: bigger while fast
          gl_PointSize = clamp(0.022 * uPx / -mv.z, 1.5, 9.0); }`,
      fragmentShader: `uniform sampler2D uMap; uniform vec3 uCol; varying float vA; void main(){ float a = texture2D(uMap, gl_PointCoord).r; gl_FragColor = vec4(uCol * 2.2 * a * vA * vA, 1.0); }`,
    });
    const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = 70; notBp.push(pts); return { pts, mat };
  };
  const gearSparks = sparkSys(240, 5, (r) => [(r() - 0.5) * 2.2, r() * 2.8 - 0.2, 0.3 + r() * 1.8], (i) => [(i % 2 ? 1 : -1) * 0.03, 0.04 * (i % 3), 0.08], "#fff1c8");
  gears[0].g.add(gearSparks.pts);
  const snapSparks = sparkSys(120, 9, (r) => { const a = r() * Math.PI * 2, sp = 0.6 + r() * 2.4; return [Math.cos(a) * sp, (r() - 0.3) * 2.2, Math.sin(a) * sp * 0.7 + 0.6]; }, (i) => [ROPE_X[i % 4], BREAK_Y, SLING_Z + 0.02], "#f4f8ff");
  fixed.add(snapSparks.pts);
  // snap flash: a LOCAL white sprite at the break (white = impact), never a full-frame wash
  const snapFlash = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: new THREE.Color(1, 1, 1), opacity: 0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  snapFlash.position.set(0, BREAK_Y, SLING_Z + 0.05); snapFlash.scale.set(0.7, 0.7, 1); fixed.add(snapFlash); notBp.push(snapFlash);

  const MN = 520, mr = rng(77), mpos = new Float32Array(MN * 3), mseed = new Float32Array(MN);
  for (let i = 0; i < MN; i++) { mpos[i * 3] = -1.35 + mr() * 2.7; mpos[i * 3 + 1] = -1.5 + mr() * 5; mpos[i * 3 + 2] = -1.2 + mr() * 2.5; mseed[i] = mr(); }
  const mg = new THREE.BufferGeometry(); mg.setAttribute("position", new THREE.BufferAttribute(mpos, 3)); mg.setAttribute("seed", new THREE.BufferAttribute(mseed, 1));
  const moteMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uT: { value: 0 }, uLamp: { value: LAMP.clone() }, uAxis: { value: LAMP_T.clone().sub(LAMP).normalize() }, uMap: { value: dotTex() }, uPx: { value: 960 }, uCarY: { value: 0 }, uState: U.uState, uCyan: U.uCyan },
    vertexShader: `attribute float seed; uniform float uT; uniform vec3 uLamp; uniform vec3 uAxis; uniform float uPx; uniform float uCarY; varying float vB; varying vec3 vC;
      void main(){ vec3 p = position;
        p.x += sin(uT*0.4 + seed*40.0)*0.05; p.z += cos(uT*0.33 + seed*21.0)*0.05;
        float y = p.y + uT*0.04*(0.4+seed) - uCarY;           // world-still air: the car falls through it
        p.y = mod(y + 1.5, 5.0) - 1.5 + uCarY;
        vec3 d = p - (uLamp + vec3(0.0, uCarY, 0.0)); float cosA = dot(normalize(d), uAxis);
        float inLamp = smoothstep(0.74, 0.92, cosA) * smoothstep(3.4, 0.3, length(d));
        float inDoor = smoothstep(0.55, 0.0, abs(p.x)) * smoothstep(0.4, -1.2, p.z) * 0.5;
        vB = (0.02 + inLamp * 1.1 + inDoor * 0.35) * (0.6 + 0.8 * fract(seed * 13.7));
        vC = mix(vec3(0.62, 0.84, 0.95), vec3(1.0, 0.76, 0.48), clamp(inLamp + inDoor, 0.0, 1.0));
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp((0.006 + 0.008 * fract(seed*7.3)) * uPx / -mv.z, 1.0, 5.0); }`,
    fragmentShader: `uniform sampler2D uMap; uniform float uState; uniform vec3 uCyan; varying float vB; varying vec3 vC;
      void main(){ float a = texture2D(uMap, gl_PointCoord).r; vec3 c = uState < 0.5 ? uCyan * 0.6 : vC; gl_FragColor = vec4(c * a * vB, 1.0); }`,
  });
  const motes = new THREE.Points(mg, moteMat); motes.frustumCulled = false; motes.renderOrder = 60; fixed.add(motes);

  // ---------- haze sheets: shaft receding into cool haze above and below ----------
  const hazeMats: THREE.ShaderMaterial[] = [];
  const sheet = (w: number, h: number, pos: [number, number, number], col: string, k: number, rot: [number, number, number] = [0, 0, 0]) => {
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uN: { value: hz }, uC: { value: lin(col) }, uK: { value: k }, uK0: { value: k }, uT: { value: 0 }, uR: { value: new THREE.Vector2(w * 0.5, h * 0.5) }, uState: U.uState, uCyan: U.uCyan },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `uniform sampler2D uN; uniform vec3 uC; uniform float uK; uniform float uT; uniform vec2 uR; uniform float uState; uniform vec3 uCyan; varying vec2 vUv;
        void main(){ vec2 e = smoothstep(vec2(0.0), vec2(0.15), vUv) * smoothstep(vec2(0.0), vec2(0.15), 1.0 - vUv);
          float n = texture2D(uN, vUv * uR + vec2(uT*0.004, uT*0.01)).r * 1.4 + texture2D(uN, vUv * uR * 0.37 - vec2(uT*0.003, uT*0.006)).r;
          vec3 c = uState < 0.5 ? uCyan * 0.3 : uC; gl_FragColor = vec4(c * n * e.x * e.y * uK, 1.0); }`,
    });
    hazeMats.push(m);
    const me = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); me.position.set(...pos); me.rotation.set(...rot); me.renderOrder = 40; fixed.add(me); return me;
  };
  sheet(2.8, 18, [0, 13, -1.0], "#7fb0c8", 0.07);
  sheet(2.8, 18, [0, 13, -0.2], "#8aa2c8", 0.05);
  sheet(2.8, 14, [0, -10, -0.4], "#4f8aa0", 0.08);
  sheet(2.8, 8, [0, 4.6, 0.7], "#7da8c0", 0.035);
  // cool top light from the machine-room vent: a long soft beam down the shaft
  {
    const m = beamMaterial("#a8d4ee", 0.12, { noise: hz }); beams.push(m);
    const c = cone(26, 0.4, 1.6, m); c.position.set(0.2, 30, -0.6); fixed.add(c); notBp.push(c);
  }

  // ---------- lights ----------
  const top = new THREE.DirectionalLight(lin("#9fc6e6"), 0.55); top.position.set(0.4, 10, 2.0); fixed.add(top); top.target.position.set(0, 0, -0.5); fixed.add(top.target);
  const hemi = new THREE.HemisphereLight(lin("#5c84a6"), lin("#2a2a3c"), 0.35); fixed.add(hemi);
  const lights: THREE.Light[] = [key, gearLamp, ...spills, top, hemi, beacon, gears[0].light, gears[1].light, cab];
  const baseInt = new Map<THREE.Light, number>(lights.map((l) => [l, l.intensity]));

  // ---------- X-RAY force arrows (painted red strokes): fall force on the car, drag on the rope ----------
  const arrows: THREE.Mesh[] = [];
  const amat = (k: number) => new THREE.MeshBasicMaterial({ map: arrowTex(), color: lin(BRAND.red).multiplyScalar(k), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  { const a = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 1.3), amat(1.3)); a.position.set(0.0, -1.3, CAR.hd + 0.12); car.add(a); arrows.push(a);
    const b = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.8), amat(1.2)); b.position.set(RAIL.x - 0.26, GEAR_Y - 0.62, BLADE_Z + 0.2); car.add(b); arrows.push(b); }
  arrows.forEach((a) => { a.renderOrder = 80; xrayOnly.push(a); });
  anchor(car, "force", 0, -1.3, CAR.hd + 0.12);

  // ---------- BLUEPRINT line art: crisp edges + jittered draftsman overshoot + soft glow ----------
  const lineMats: LineMaterial[] = [];
  const mkLine = (pos: number[], width: number, opacity: number, additive = false) => {
    const g = new LineSegmentsGeometry(); g.setPositions(pos);
    const m = new LineMaterial({ color: lin(BRAND.cyan), linewidth: width, transparent: true, opacity, depthWrite: false });
    if (additive) m.blending = THREE.AdditiveBlending;
    lineMats.push(m);
    const l = new LineSegments2(g, m); l.renderOrder = 90; l.frustumCulled = false; bpOnly.push(l); return l;
  };
  const byParent = new Map<THREE.Object3D, number[]>();
  const jr = rng(303);
  const v = new THREE.Vector3();
  for (const e of edges) {
    const eg = new THREE.EdgesGeometry(e.mesh.geometry, e.thr);
    const a = eg.attributes.position.array as Float32Array;
    e.mesh.updateMatrix();
    const target = e.own ? e.mesh : e.mesh.parent!;
    const arr = byParent.get(target) ?? [];
    for (let i = 0; i < a.length; i += 3) { v.set(a[i], a[i + 1], a[i + 2]); if (!e.own) v.applyMatrix4(e.mesh.matrix); arr.push(v.x, v.y, v.z); }
    byParent.set(target, arr); eg.dispose();
  }
  for (const [parent, arr] of byParent) {
    const sketch: number[] = [];
    for (let i = 0; i < arr.length; i += 6) {
      const ax = arr[i], ay = arr[i + 1], az = arr[i + 2], bx = arr[i + 3], by = arr[i + 4], bz = arr[i + 5];
      const L = Math.hypot(bx - ax, by - ay, bz - az), ov = Math.min(0.035, L * 0.08) / (L || 1);
      const j = () => (jr() - 0.5) * 0.006;
      sketch.push(ax - (bx - ax) * ov + j(), ay - (by - ay) * ov + j(), az - (bz - az) * ov + j(), bx + (bx - ax) * ov + j(), by + (by - ay) * ov + j(), bz + (bz - az) * ov + j());
    }
    // a mirrored parent (left gear, scale.x = -1) keeps lines correct: they are children in local space
    for (const l of [mkLine(arr, 2.2, 1), mkLine(sketch, 1.1, 0.5), mkLine(arr, 8, 0.14, true)]) parent.add(l);
  }

  // =====================================================================================================
  // animation state
  // =====================================================================================================
  let state = 2, alarm = 0, glow = 0, snapT = -1, force = 0;
  const ropeBuild = () => {
    for (let j = 0; j < 4; j++) {
      const t = snapT - ROPE_DELAY[j];
      if (snapT < 0 || t <= 0) { intact[j].visible = true; lowM[j].visible = false; upM[j].visible = false; continue; }
      intact[j].visible = false;
      const x = ROPE_X[j], z = SLING_Z, r = rng(50 + j);
      const open = clamp01(t * 14);
      // lower piece (car space): loses tension, buckles toward the camera and flops over, whip wave decays
      const L = BREAK_Y - HITCH_Y, N = 26;
      const bd = new THREE.Vector3(0.35 * (j - 1.5) + (r() - 0.5) * 0.2, 0, 1).normalize();
      const side = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), bd);
      const bend = 2.5 * (1 - Math.exp(-t * 4.5)) + 0.35 * Math.sin(t * 11) * Math.exp(-t * 4);
      const low: THREE.Vector3[] = [];
      let p = new THREE.Vector3(x, HITCH_Y, z);
      low.push(p.clone());
      for (let i = 1; i <= N; i++) {
        const u = i / N, th = bend * Math.pow(u, 1.8);
        const dir = new THREE.Vector3(0, Math.cos(th), 0).addScaledVector(bd, Math.sin(th));
        p = p.clone().addScaledVector(dir, L / N);
        const w = 0.14 * u * u * Math.sin(9 * u - 22 * t + j) * Math.exp(-3 * t);
        const q = p.clone().addScaledVector(side, w);
        q.y = Math.max(q.y, 0.03);
        low.push(q);
      }
      const le = low[N], lt = le.clone().sub(low[N - 1]).normalize();
      setPiece(lowM[j], low, fray(le, lt, 200 + j, open));
      // upper piece (world): elastic recoil upward with a travelling whip that decays
      const rise = 1.05 * (1 - Math.exp(-t * 7)) + 0.12 * Math.sin(t * 9) * Math.exp(-t * 3);
      const A = 0.42 * Math.exp(-t * 1.8) * (1 - Math.exp(-t * 30));
      const up: THREE.Vector3[] = [];
      const yE = BREAK_Y + rise;
      for (let i = 0; i <= 30; i++) {
        const s = Math.pow(i / 30, 1.6) * 16;
        const env = Math.exp(-s / 2.4);
        up.push(new THREE.Vector3(x + A * env * Math.sin(s * 3.1 - t * 24 + j * 1.7), yE + s, z + 0.55 * A * env * Math.cos(s * 2.6 - t * 19 + j)));
      }
      up.push(new THREE.Vector3(x, yE + 44, z));
      const ue = up[0], ut = up[0].clone().sub(up[1]).normalize();
      setPiece(upM[j], up, fray(ue, ut, 300 + j, open));
    }
    snapSparks.mat.uniforms.uAge.value = state === 2 ? snapT : -1;
    const fl = snapT < 0 ? 0 : Math.exp(-snapT / 0.05) * (snapT < 0.2 ? 1 : 0);
    snapFlash.material.opacity = fl * 0.9;
    snapFlash.scale.setScalar(0.4 + 0.8 * (1 - Math.exp(-snapT * 20)));
  };

  const applyGlow = () => {
    const g = state === 0 ? 0 : glow;
    // below g = 0.2 the jaws are just painted safety-green; above it they glow (local light + halo, no frame wash)
    const e = smooth(0.15, 1.0, g) * Math.max(g, 0);
    mJaw.emissiveIntensity = 0.75 * e;
    mJawFace.emissiveIntensity = 0.5 * e;
    gears.forEach((G, i) => { G.light.intensity = state === 2 ? (i === 0 ? 0.7 : 0.35) * e : 0; G.halos.forEach((h) => (h.material.opacity = Math.min(0.6, 0.3 * e))); });
  };
  const applyAlarm = () => {
    const a = state === 0 ? 0 : alarm;
    beaconMat.color.copy(lin(BRAND.red)).multiplyScalar(0.35 + 3.2 * a);
    beaconHalo.material.color.copy(lin(BRAND.red)).multiplyScalar(0.6 * a);
    beacon.intensity = 1.0 * a;
  };
  const applyForce = () => arrows.forEach((a) => ((a.material as THREE.MeshBasicMaterial).opacity = force));

  const shaft: Shaft = {
    group, car, carRoofY: 0, charSpot: CHAR_SPOT.clone(), anchors, lights, state,
    patent: [
      { key: "roof", num: 10, text: "CAR" }, { key: "rail", num: 12, text: "GUIDE RAIL" }, { key: "gear", num: 14, text: "SAFETY GEAR" },
      { key: "ropeBreak", num: 16, text: "HOIST ROPES" }, { key: "cw", num: 18, text: "COUNTERWEIGHT" }, { key: "door", num: 20, text: "LANDING DOOR" },
    ],
    setCarDrop(y: number) { car.position.y = y; moteMat.uniforms.uCarY.value = y; },
    setRopeSnap(t: number) { snapT = t <= 0 ? -1 : t; ropeBuild(); },
    setGearClamp(t: number) {
      const c = clamp01(t);
      for (const G of gears) {
        const gap = JAW.gap * (1 - c), rise = RISE * c;
        for (const J of G.jaws) J.m.position.set(J.side * (GRIP0 + gap), JAW.y0 + rise, 0);
        G.rods.forEach((rod, i) => {
          const side = i ? 1 : -1, top = JAW.y0 + rise, bot = -0.33 + rise;
          rod.position.set(side * (GRIP0 + gap + 0.045), (top + bot) / 2, 0.0); rod.scale.set(1, top - bot, 1);
        });
        G.yoke.position.set(0, -0.33 + rise, 0.115);
        G.pull.position.set(-0.19, -0.33 + rise - 0.31, 0.115);
      }
      shaft.setGearGlow(smooth(0.85, 1.0, c));
    },
    setGearGlow(g: number) { glow = g; applyGlow(); },
    setSparks(age: number) { gearSparks.mat.uniforms.uAge.value = state === 2 ? age : -1; },
    setAlarm(on: number) { alarm = on; applyAlarm(); },
    setForce(k: number) { force = k; applyForce(); },
    setTime(t: number) {
      beams.forEach((m) => (m.uniforms.uT.value = t * 30));
      hazeMats.forEach((m) => (m.uniforms.uT.value = t * 30));
      moteMat.uniforms.uT.value = t;
    },
    setViewport(w: number, h: number, fovDeg = 40) {
      lineMats.forEach((m) => m.resolution.set(w, h));
      const px = h / (2 * Math.tan((fovDeg / 2) * Math.PI / 180));
      moteMat.uniforms.uPx.value = px; gearSparks.mat.uniforms.uPx.value = px; snapSparks.mat.uniforms.uPx.value = px;
    },
    setState(s: 0 | 1 | 2) {
      state = s; shaft.state = s; U.uState.value = s;
      bpOnly.forEach((o) => (o.visible = s === 0));
      xrayOnly.forEach((o) => (o.visible = s === 1));
      notXray.forEach((o) => (o.visible = s !== 1));
      notBp.forEach((o) => (o.visible = s !== 0));
      intact.forEach((m) => (m.material = s === 0 ? mRopeBp : mRope));
      [...lowM, ...upM].forEach((m) => (m.material = s === 0 ? mRopeBp : [mRope, mFray]));
      slitMats.forEach((m) => m.color.copy(lin("#ffc890")).multiplyScalar(3.4));
      for (const l of lights) l.intensity = s === 0 ? 0 : (baseInt.get(l) ?? 1);
      cab.intensity = s === 1 ? 1.4 : 0;
      hazeMats.forEach((m) => (m.uniforms.uK.value = m.uniforms.uK0.value * (s === 1 ? 0.35 : 1)));
      beams.forEach((m) => (m.uniforms.uI.value = (m.userData.k ??= m.uniforms.uI.value) * (s === 1 ? 0.35 : 1)));
      applyGlow(); applyAlarm(); applyForce();
      gearSparks.mat.uniforms.uAge.value = s === 2 ? gearSparks.mat.uniforms.uAge.value : -1;
      snapSparks.mat.uniforms.uAge.value = s === 2 ? snapSparks.mat.uniforms.uAge.value : -1;
    },
  };
  shaft.setGearClamp(0); shaft.setRopeSnap(0); shaft.setAlarm(0); shaft.setForce(0); shaft.setState(2);
  return shaft;
}
