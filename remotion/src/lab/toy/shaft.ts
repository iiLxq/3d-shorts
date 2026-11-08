// The precision scale model: a cut-away elevator shaft (front wall removed, museum-model section faces) with the
// car, crosshead, rope hitch, guide rails, safety gear, counterweight, landing doors and practical lights.
// World units are metres. Car-roof top is y = 0 in car space; the car group moves along y.
import * as THREE from "three";
import { concrete, blockWall, brushed, paintedSteel, checkerPlate, rope as ropeTex, stencil, radial, rng } from "./paint";
import { envMat, vinyl, emissive } from "./materials";
import { PAINT, BRAND, untone } from "./palette";
import { mesh, tag } from "./registry";
import { rbox, extrude, tube, helix, boltGeo, sculpt } from "./sculpt";

export const SH = { x0: -1.4, x1: 1.4, z0: -1.3, z1: 1.3, y0: -24, y1: 24, wall: 0.25 };
export const RAIL_X = 1.16; // blade tip |x|
export const LANDINGS = Array.from({ length: 15 }, (_, i) => 0.55 + (i - 7) * 3.2);
export const DOOR_X = 0.12;

export type Shaft = {
  world: THREE.Group;
  car: THREE.Group;
  cw: THREE.Group;
  jaws: { mesh: THREE.Mesh; side: number; front: number; rest: THREE.Vector3 }[];
  jawMat: THREE.MeshStandardMaterial;
  lever: THREE.Group;
  ropesUp: THREE.Group; // world-space rope runs above the hitch
  ropeStubs: THREE.Group;
  hitchTop: number; // car-space y where the upper ropes start
  work: THREE.SpotLight; workTarget: THREE.Object3D; workBulb: THREE.MeshBasicMaterial;
  alarmLight: THREE.PointLight; alarmMat: THREE.MeshStandardMaterial;
  leaks: THREE.PointLight[];
  figureMount: THREE.Group;
  contact: THREE.Mesh[];
  arrows: THREE.Group;
  sparks: THREE.Points;
  gearAnchor: THREE.Object3D; // left gear jaw centre (car space)
  ropeAnchor: THREE.Object3D;
  labelsAt: Record<string, THREE.Object3D>;
};

const at = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number) => { o.position.set(x, y, z); return o; };

export function buildShaft(): Shaft {
  const world = new THREE.Group(); world.name = "shaft";
  const wallsH = SH.y1 - SH.y0;

  // ------------------------------------------------------------------ materials
  const cBack = concrete("backwall", 21, 2.8, 6.4, 260, "#84868A");
  const cSide = blockWall("sidewall", 33, 2.6, 4.0, 260, "#7C7E82");
  const cCut = concrete("cutface", 5, 0.5, 6.4, 260, "#A8A397");
  const backMat = envMat({ map: cBack.map, bumpMap: cBack.bump, bumpScale: 1.6, roughness: 0.92 });
  backMat.map!.repeat.set(1 / 2.8, 1 / 6.4); backMat.bumpMap!.repeat.copy(backMat.map!.repeat);
  const sideMat = envMat({ map: cSide.map, bumpMap: cSide.bump, bumpScale: 2.2, roughness: 0.9 });
  sideMat.map!.repeat.set(1 / 2.6, 1 / 4.0); sideMat.bumpMap!.repeat.copy(sideMat.map!.repeat);
  const cutMat = envMat({ map: cCut.map, bumpMap: cCut.bump, bumpScale: 1.0, roughness: 0.95 });
  cutMat.map!.repeat.set(1 / 0.5, 1 / 6.4); cutMat.bumpMap!.repeat.copy(cutMat.map!.repeat);
  const rail = envMat({ color: "#7A8188", metalness: 0.92, roughness: 0.62, roughnessMap: brushed("railBrush", 7, 512, 512, 110, 90), envMapIntensity: 1.2 }, { edge: 0.6 });
  const steel = envMat({ map: paintedSteel("steelPaint", 9, PAINT.steelPaint), metalness: 0.35, roughness: 0.55 });
  const steelDark = envMat({ map: paintedSteel("steelDark", 19, PAINT.steelDark), metalness: 0.4, roughness: 0.5 });
  const galv = envMat({ color: PAINT.galv, metalness: 0.85, roughness: 0.7, roughnessMap: brushed("galvBrush", 3, 512, 512, 100, 60) }, { edge: 0.5 });
  const carPanel = envMat({ map: paintedSteel("carPanel", 13, PAINT.carPanel), metalness: 0.25, roughness: 0.5 });
  const cp = checkerPlate("roof", 17, 1.86, 1.94, 300);
  const roofMat = envMat({ map: cp.map, bumpMap: cp.bump, bumpScale: 2.0, metalness: 0.75, roughness: 0.48 }, { edge: 0.3 });
  const doorMat = envMat({ map: paintedSteel("door", 23, PAINT.door), metalness: 0.45, roughness: 0.45 });
  const alu = envMat({ color: "#C3C7CB", metalness: 0.95, roughness: 0.32, roughnessMap: brushed("aluBrush", 31, 512, 512, 90, 50) }, { edge: 0.7 });
  const rubber = vinyl("#202224", { rough: 0.8, sss: "#000000", sssK: 0, edge: 0.15 });
  const cwMat = envMat({ map: paintedSteel("cwPaint", 41, "#5E6873"), metalness: 0.3, roughness: 0.55 });
  const ropeMat = envMat({ map: ropeTex("rope"), bumpMap: ropeTex("rope"), bumpScale: 1.5, metalness: 0.85, roughness: 0.42 }, { edge: 0.0, cavity: 0 });
  const cable = vinyl("#26282B", { rough: 0.55, clear: 0.2, sss: "#000000", sssK: 0, edge: 0.2 });
  const glowWarm = emissive("#FFC58A", 1.5);
  const glowCool = emissive("#DCE8FF", 1.6);

  // ------------------------------------------------------------------ walls (back wall has landing openings)
  const back = new THREE.Shape();
  back.moveTo(SH.x0 - 0.05, SH.y0); back.lineTo(SH.x1 + 0.05, SH.y0); back.lineTo(SH.x1 + 0.05, SH.y1); back.lineTo(SH.x0 - 0.05, SH.y1); back.lineTo(SH.x0 - 0.05, SH.y0);
  for (const y of LANDINGS) {
    const h = new THREE.Path();
    h.moveTo(DOOR_X - 0.55, y); h.lineTo(DOOR_X - 0.55, y + 2.15); h.lineTo(DOOR_X + 0.55, y + 2.15); h.lineTo(DOOR_X + 0.55, y); h.lineTo(DOOR_X - 0.55, y);
    back.holes.push(h);
  }
  const backG = new THREE.ShapeGeometry(back);
  const backWall = mesh(backG, backMat, { role: "wall", edges: 1 }, false, true);
  backWall.position.z = SH.z0; world.add(backWall);
  for (const s of [-1, 1]) {
    const g = new THREE.PlaneGeometry(SH.z1 - SH.z0, wallsH);
    const uv = g.getAttribute("uv") as THREE.BufferAttribute; const p = g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) + (s > 0 ? 3 : 0), p.getY(i));
    const w = mesh(g, sideMat, { role: "wall", edges: 1 }, false, true);
    w.rotation.y = -s * Math.PI / 2; w.position.set(s > 0 ? SH.x1 : SH.x0, (SH.y0 + SH.y1) / 2, 0);
    world.add(w);
    // museum cut face (front section of the wall)
    const cg = new THREE.PlaneGeometry(SH.wall, wallsH);
    const cuv = cg.getAttribute("uv") as THREE.BufferAttribute; const cpp = cg.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < cuv.count; i++) cuv.setXY(i, cpp.getX(i), cpp.getY(i));
    const cut = mesh(cg, cutMat, { role: "wall", edges: 1 }, false, true);
    cut.position.set(s > 0 ? SH.x1 + SH.wall / 2 : SH.x0 - SH.wall / 2, (SH.y0 + SH.y1) / 2, SH.z1); world.add(cut);
    // slab sections on the cut face every floor (the floors the shaft passes)
    for (const y of LANDINGS) {
      const slab = mesh(rbox(SH.wall + 0.02, 0.22, 0.03, 0.006), cutMat, { role: "env", edges: 30 }, false, true);
      slab.position.set(cut.position.x, y - 0.12, SH.z1 + 0.012); world.add(slab);
    }
  }

  // ------------------------------------------------------------------ guide rails (T profile, 5 m lengths, fishplates, brackets)
  const prof = new THREE.Shape();
  // profile in (u = distance from blade tip toward wall, v = z)
  const bt = 0.009, fl = 0.064, ft = 0.012, bl = 0.09;
  prof.moveTo(0, -bt); prof.lineTo(bl, -bt); prof.lineTo(bl, -fl); prof.lineTo(bl + ft, -fl); prof.lineTo(bl + ft, fl); prof.lineTo(bl, fl); prof.lineTo(bl, bt); prof.lineTo(0, bt); prof.lineTo(0, -bt);
  const railSeg = extrude(prof, 4.98, 0.0025, 1);
  const bolts: THREE.Matrix4[] = [];
  const addBolt = (pos: THREE.Vector3, dir: THREE.Vector3, s = 1) => {
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    bolts.push(new THREE.Matrix4().compose(pos, q, new THREE.Vector3(s, s, s)));
  };
  for (const s of [-1, 1]) {
    for (let y = SH.y0; y < SH.y1; y += 5) {
      const m = mesh(railSeg, rail, { role: "mech", edges: 30 }, true, true);
      m.rotation.x = -Math.PI / 2; // extrude +z -> +y
      if (s < 0) { m.scale.x = -1; }
      m.position.set(s * RAIL_X, y + 0.01, 0);
      world.add(m);
      // fishplate at the joint
      const fp = mesh(rbox(0.012, 0.32, 0.11, 0.003), steelDark, { role: "env", edges: 30 }, true, true);
      fp.position.set(s * (RAIL_X + bl + ft + 0.006), y, 0); world.add(fp);
      for (const dy of [-0.11, -0.04, 0.04, 0.11]) for (const dz of [-0.035, 0.035]) addBolt(new THREE.Vector3(s * (RAIL_X + bl + ft + 0.012), y + dy, dz), new THREE.Vector3(-s, 0, 0), 0.8);
    }
    for (let y = SH.y0 + 1.2; y < SH.y1; y += 2.2) {
      // L-bracket from wall to rail foot + clips
      const br = new THREE.Group(); br.position.set(s * (RAIL_X + bl + ft), y, 0); world.add(br);
      const len = SH.x1 - (RAIL_X + bl + ft);
      const a = mesh(rbox(len, 0.12, 0.012, 0.003), steel, { role: "env", edges: 30 }, true, true);
      a.position.set(s * len / 2, 0, 0.11); br.add(a);
      const b = mesh(rbox(len, 0.12, 0.012, 0.003), steel, { role: "env", edges: 30 }, true, true);
      b.position.set(s * len / 2, 0, -0.11); br.add(b);
      const c = mesh(rbox(0.012, 0.12, 0.23, 0.003), steel, { role: "env", edges: 30 }, true, true);
      c.position.set(s * 0.006, 0, 0); br.add(c);
      const wp = mesh(rbox(0.012, 0.2, 0.3, 0.003), steel, { role: "env", edges: 30 }, true, true);
      wp.position.set(s * (len - 0.006), 0, 0); br.add(wp);
      for (const dz of [-0.055, 0.055]) {
        const clip = mesh(rbox(0.02, 0.05, 0.03, 0.004), steelDark, { role: "env", edges: 0 }, true, true);
        clip.position.set(-s * 0.012, 0, dz * 1.15); br.add(clip);
      }
      for (const dz of [-0.11, 0.11]) for (const dy of [-0.06, 0.06]) addBolt(new THREE.Vector3(s * (SH.x1 - 0.013), y + dy, dz), new THREE.Vector3(-s, 0, 0), 1.1);
      for (const dz of [-0.065, 0.065]) addBolt(new THREE.Vector3(s * (RAIL_X + bl + ft - 0.02), y, dz), new THREE.Vector3(-s, 0, 0), 0.8);
    }
  }

  // ------------------------------------------------------------------ landing doors (hoistway side) with light leaks
  const leaks: THREE.PointLight[] = [];
  LANDINGS.forEach((y, i) => {
    const g = new THREE.Group(); g.position.set(DOOR_X, y, SH.z0); world.add(g);
    // warm room light behind the doors
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.15), glowWarm);
    glow.position.set(0, 1.075, -0.12); g.add(glow); tag(glow, { role: "decal" });
    for (const s of [-1, 1]) {
      const p = mesh(rbox(0.575, 2.17, 0.03, 0.006), doorMat, { role: "env", edges: 30 }, true, true);
      p.position.set(s * 0.2925, 1.09, 0.05); g.add(p);
      for (const yy of [0.5, 1.6]) { const st = mesh(rbox(0.46, 0.035, 0.02, 0.006), doorMat, { role: "env", edges: 30 }, true, true); st.position.set(s * 0.278, yy, 0.075); g.add(st); }
      // hanger rollers
      for (const dx of [-0.17, 0.17]) {
        const r = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.025, 24).rotateX(Math.PI / 2), rubber, { role: "env", edges: 0 }, true, true);
        r.position.set(s * 0.278 + dx, 2.22, 0.08); g.add(r);
      }
    }
    const header = mesh(rbox(1.35, 0.14, 0.09, 0.008), steel, { role: "env", edges: 30 }, true, true); header.position.set(0, 2.27, 0.06); g.add(header);
    const track = mesh(rbox(1.3, 0.02, 0.03, 0.004), alu, { role: "env", edges: 30 }, true, true); track.position.set(0, 2.2, 0.11); g.add(track);
    const sill = mesh(rbox(1.25, 0.035, 0.13, 0.006), alu, { role: "env", edges: 30 }, true, true); sill.position.set(0, -0.005, 0.07); g.add(sill);
    const lock = mesh(rbox(0.14, 0.09, 0.07, 0.01), steelDark, { role: "env", edges: 30 }, true, true); lock.position.set(0.47, 2.12, 0.1); g.add(lock);
    const floorNo = 18 + (i - 7);
    const dec = mesh(new THREE.PlaneGeometry(0.42, 0.21), new THREE.MeshStandardMaterial({ map: stencil(`fl${floorNo}`, [`${floorNo}`], { w: 256, h: 128, size: 120 }), transparent: true, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 }), { role: "decal" }, false, true);
    dec.position.set(-0.85, 1.55, 0.004); g.add(dec);
    const dec2 = mesh(new THREE.PlaneGeometry(0.4, 0.1), new THREE.MeshStandardMaterial({ map: stencil(`fll${floorNo}`, [`FLOOR ${floorNo}`], { w: 512, h: 128, size: 70 }), transparent: true, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 }), { role: "decal" }, false, true);
    dec2.position.set(-0.85, 1.36, 0.004); g.add(dec2);
    // under-door and centre-gap leak pools on the shaft side
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.7), new THREE.MeshBasicMaterial({ map: radial("pool"), color: untone("#FFB27A").multiplyScalar(0.25), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    pool.position.set(0, 0.02, 0.012); g.add(pool); tag(pool, { role: "decal" });
    if (Math.abs(y - 0.55) < 0.1 || Math.abs(y - 3.75) < 0.1 || Math.abs(y + 2.65) < 0.1) {
      const L = new THREE.PointLight(untone("#FFB27A"), 0.55, 3.5, 2);
      L.position.set(DOOR_X, y + 0.25, SH.z0 + 0.15); world.add(L); leaks.push(L);
    }
  });

  // shaft bulkhead lights on the right wall (cool practicals) + cable tray on the left wall
  for (const y of [-6.1, -2.9, 0.3, 3.5, 6.7, 9.9]) {
    const g = new THREE.Group(); g.position.set(SH.x1 - 0.06, y + 2.4, 0.75); world.add(g);
    g.add(mesh(rbox(0.07, 0.3, 0.14, 0.02), steelDark, { role: "env", edges: 30 }, true, true));
    const bulb = new THREE.Mesh(sculpt({ r: [0.03, 0.12, 0.05], seg: [16, 12] }), glowCool); bulb.position.x = -0.045; g.add(bulb); tag(bulb, { role: "emit" });
    for (const dy of [-0.08, 0, 0.08]) { const cg = mesh(new THREE.TorusGeometry(0.06, 0.004, 6, 20, Math.PI).rotateY(Math.PI / 2), galv, { role: "env", edges: 0 }, false, false); cg.position.set(-0.04, dy, 0); cg.rotation.x = Math.PI / 2; g.add(cg); }
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.8), new THREE.MeshBasicMaterial({ map: radial("pool"), color: untone("#B9CCF2").multiplyScalar(0.12), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    pool.rotation.y = -Math.PI / 2; pool.position.set(-0.05, 0, 0); g.add(pool); tag(pool, { role: "decal" });
  }
  {
    const tray = new THREE.Group(); tray.position.set(SH.x0 + 0.06, 0, 0.72); world.add(tray);
    for (const dz of [-0.14, 0.14]) { const r = mesh(rbox(0.08, wallsH, 0.012, 0.003), galv, { role: "env", edges: 30 }, false, true); r.position.set(0, 0, dz); tray.add(r); }
    const rungs = new THREE.InstancedMesh(rbox(0.03, 0.012, 0.28, 0.003), galv, Math.ceil(wallsH / 0.3));
    for (let i = 0; i < rungs.count; i++) rungs.setMatrixAt(i, new THREE.Matrix4().makeTranslation(-0.02, SH.y0 + i * 0.3, 0));
    rungs.receiveShadow = true; tag(rungs, { role: "decal" }); tray.add(rungs);
    [[-0.07, 0.02], [-0.02, 0.016], [0.04, 0.022], [0.09, 0.012]].forEach(([dz, r], i) => {
      const c = mesh(tube([new THREE.Vector3(0.02, SH.y0, dz), new THREE.Vector3(0.02 + (i % 2) * 0.004, 0, dz + 0.004), new THREE.Vector3(0.02, SH.y1, dz)], r, 8, 10), cable, { role: "env", edges: 0 }, true, true);
      tray.add(c);
    });
  }

  // ------------------------------------------------------------------ counterweight (left back corner) on its own rails
  const cw = new THREE.Group(); cw.name = "cw"; world.add(cw);
  {
    const cx = -1.17, cz = -1.03;
    for (const dz of [-0.2, 0.2]) {
      const st = mesh(rbox(0.06, 3.1, 0.05, 0.006), cwMat, { role: "env", edges: 30 }, true, true); st.position.set(cx, 3.0, cz + dz); cw.add(st);
    }
    for (const y of [1.48, 4.52]) { const ch = mesh(rbox(0.3, 0.12, 0.5, 0.01), cwMat, { role: "env", edges: 30 }, true, true); ch.position.set(cx, y, cz); cw.add(ch); }
    for (let i = 0; i < 20; i++) {
      const w = mesh(rbox(0.26, 0.138, 0.36, 0.012), cwMat, { role: "env", edges: 30 }, true, true); w.position.set(cx, 1.62 + i * 0.142, cz); cw.add(w);
    }
    const lab = mesh(new THREE.PlaneGeometry(0.3, 0.12), new THREE.MeshStandardMaterial({ map: stencil("cwlab", ["CW 2"], { w: 256, h: 96, size: 70 }), transparent: true, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 }), { role: "decal" }, false, true);
    lab.rotation.y = Math.PI / 2; lab.position.set(cx + 0.131, 3.1, cz); cw.add(lab);
    for (const dx of [-0.05, 0.0, 0.05]) {
      const r = mesh(new THREE.CylinderGeometry(0.008, 0.008, 22, 8, 1), ropeMat, { role: "mech", edges: 0 }, true, true);
      r.position.set(cx + dx * 0.4, 4.58 + 11, cz + dx); cw.add(r);
    }
    for (const dz of [-0.28, 0.28]) {
      const r = mesh(railSeg, rail, { role: "env", edges: 0 }, true, true);
      r.rotation.x = -Math.PI / 2; r.rotation.z = dz > 0 ? -Math.PI / 2 : Math.PI / 2; r.scale.set(0.6, 0.6, 9);
      r.position.set(cx, SH.y0, cz + dz + (dz > 0 ? 0.0 : 0)); world.add(r);
    }
  }

  // ------------------------------------------------------------------ CAR (car space: roof top y = 0)
  const car = new THREE.Group(); car.name = "car"; world.add(car);
  const CX0 = -0.93, CX1 = 0.93, CZ0 = -1.12, CZ1 = 0.82;
  const cw2 = CX1 - CX0, cd = CZ1 - CZ0, czc = (CZ0 + CZ1) / 2;
  const body = mesh(rbox(cw2, 2.4, cd, 0.03), carPanel, { role: "shell", edges: 30 }, true, true); body.position.set(0, -1.24, czc); car.add(body);
  const roof = mesh(rbox(cw2 + 0.02, 0.04, cd + 0.02, 0.008), roofMat, { role: "shell", edges: 30 }, true, true); roof.position.set(0, -0.02, czc); car.add(roof);
  roofMat.map!.repeat.set(1, 1);
  // front face stiffeners, belt rail, stencil
  for (const x of [-0.6, 0, 0.6]) { const r = mesh(rbox(0.07, 2.3, 0.035, 0.008), carPanel, { role: "shell", edges: 30 }, true, true); r.position.set(x, -1.24, CZ1 + 0.017); car.add(r); }
  { const r = mesh(rbox(cw2 - 0.04, 0.06, 0.035, 0.008), carPanel, { role: "shell", edges: 30 }, true, true); r.position.set(0, -0.55, CZ1 + 0.02); car.add(r); }
  { const r = mesh(rbox(cw2 + 0.03, 0.05, 0.05, 0.01), steelDark, { role: "shell", edges: 30 }, true, true); r.position.set(0, -0.06, CZ1 + 0.012); car.add(r); }
  {
    const d = mesh(new THREE.PlaneGeometry(0.55, 0.2), new THREE.MeshStandardMaterial({ map: stencil("carlab", ["CAR 2", "1600 KG · 21 P"], { w: 512, h: 192, size: 64, color: "#2A3340" }), transparent: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 }), { role: "decal" }, false, true);
    d.position.set(-0.3, -0.33, CZ1 + 0.002); car.add(d);
  }
  // crosshead (double channel) + hitch plate
  for (const dz of [-0.075, 0.075]) {
    const ch = mesh(rbox(2.14, 0.2, 0.05, 0.008), steel, { role: "mech", edges: 30 }, true, true); ch.position.set(0, 0.1, -0.15 + dz); car.add(ch);
    const lip = mesh(rbox(2.14, 0.02, 0.09, 0.004), steel, { role: "mech", edges: 30 }, true, true); lip.position.set(0, 0.21, -0.15 + dz); car.add(lip);
  }
  const hp = mesh(rbox(0.36, 0.03, 0.26, 0.006), steelDark, { role: "mech", edges: 30 }, true, true); hp.position.set(0, 0.235, -0.15); car.add(hp);
  // stiles
  for (const s of [-1, 1]) {
    const st = mesh(rbox(0.06, 3.2, 0.13, 0.008), steel, { role: "mech", edges: 30 }, true, true); st.position.set(s * 1.03, -1.1, 0); car.add(st);
    // guide shoe on the rail
    const gs = mesh(rbox(0.13, 0.16, 0.12, 0.012), steelDark, { role: "mech", edges: 30 }, true, true); gs.position.set(s * 1.135, 0.42, 0); car.add(gs);
    const gib = mesh(rbox(0.05, 0.17, 0.035, 0.006), rubber, { role: "mech", edges: 30 }, true, true); gib.position.set(s * 1.175, 0.42, 0); car.add(gib);
    const arm = mesh(rbox(0.12, 0.04, 0.12, 0.008), steel, { role: "mech", edges: 30 }, true, true); arm.position.set(s * 1.08, 0.48, 0); car.add(arm);
  }
  // rope hitch: rods, compression springs, nuts, rope sockets, stubs
  const hitchTop = 0.62;
  const ropeStubs = new THREE.Group(); car.add(ropeStubs);
  const ROPE_X = [-0.09, -0.03, 0.03, 0.09];
  const springMat = envMat({ color: "#3A3F45", metalness: 0.7, roughness: 0.35 });
  for (const x of ROPE_X) {
    const rodM = mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.36, 10), galv, { role: "mech", edges: 0 }, true, true); rodM.position.set(x, 0.33, -0.15); car.add(rodM);
    const sp = mesh(helix(0.02, 0.018, 7, 0.0045), springMat, { role: "mech", edges: 0 }, true, true); sp.position.set(x, 0.252, -0.15); car.add(sp);
    for (const y of [0.385, 0.405]) { const n = mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.016, 6), galv, { role: "mech", edges: 30 }, true, true); n.position.set(x, y, -0.15); car.add(n); }
    const sock = mesh(new THREE.CylinderGeometry(0.013, 0.022, 0.13, 14), steelDark, { role: "mech", edges: 30 }, true, true); sock.position.set(x, 0.48, -0.15); ropeStubs.add(sock);
    const stub = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.08, 10), ropeMat, { role: "mech", edges: 0 }, true, true); stub.position.set(x, 0.58, -0.15); ropeStubs.add(stub);
  }
  // upper rope runs (world space, re-positioned to follow the car until the snap)
  const ropesUp = new THREE.Group(); ropesUp.name = "ropesUp"; world.add(ropesUp);
  const RL = 40;
  for (const x of ROPE_X) {
    const g = new THREE.CylinderGeometry(0.012, 0.012, RL, 10, 40);
    const uv = g.getAttribute("uv") as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * RL * 6);
    g.translate(0, RL / 2, 0);
    const r = mesh(g, ropeMat, { role: "mech", edges: 0, hull: false, lineK: -1 }, true, true); r.position.set(x, 0, -0.15); ropesUp.add(r);
  }
  ropeMat.map!.repeat.set(1, 1);
  // ------------------------------------------------------------------ SAFETY GEAR (both rails), the fail-safe
  const jawMat = new THREE.MeshStandardMaterial({ color: untone(BRAND.green).multiplyScalar(0.55), emissive: untone(BRAND.green), emissiveIntensity: 0.25, roughness: 0.38, metalness: 0.1 });
  const jaws: Shaft["jaws"] = [];
  const gearAnchor = new THREE.Object3D();
  for (const s of [-1, 1]) {
    const g = new THREE.Group(); g.position.set(s * 1.16, 0.0, 0); g.scale.setScalar(1.6); car.add(g);
    // housing: back plate, two cheeks with a front window (cut-away), top/bottom bars
    const backP = mesh(rbox(0.035, 0.24, 0.17, 0.008), steelDark, { role: "mech", edges: 30 }, true, true); backP.position.set(-s * 0.075, 0, 0); g.add(backP);
    const cheekB = mesh(rbox(0.16, 0.24, 0.028, 0.008), steel, { role: "mech", edges: 30 }, true, true); cheekB.position.set(s * 0.01, 0, -0.064); g.add(cheekB);
    { const bar = mesh(rbox(0.16, 0.04, 0.028, 0.008), steel, { role: "mech", edges: 30 }, true, true); bar.position.set(s * 0.01, 0.1, 0.064); g.add(bar); }
    const side = mesh(rbox(0.03, 0.24, 0.028, 0.006), steel, { role: "mech", edges: 30 }, true, true); side.position.set(-s * 0.055, 0, 0.064); g.add(side);
    
    // wedge jaws (trapezoid extrusions) either side of the blade
    for (const f of [-1, 1]) {
      const sh = new THREE.Shape();
      sh.moveTo(-0.045, -0.06); sh.lineTo(0.045, -0.06); sh.lineTo(0.045, 0.07); sh.lineTo(-0.045, 0.045); sh.lineTo(-0.045, -0.06);
      const jg = extrude(sh, 0.026, 0.004, 2);
      jg.translate(0, 0, -0.013);
      const jm = mesh(jg, jawMat, { role: "jaw", edges: 30 }, true, true);
      if (s < 0) jm.scale.x = -1;
      const rest = new THREE.Vector3(s * 0.035, 0, f * 0.034);
      jm.position.copy(rest); g.add(jm);
      // serrations on the gripping face
      for (let k = 0; k < 5; k++) { const ser = mesh(rbox(0.07, 0.006, 0.004, 0.0015), steelDark, { role: "mech", edges: 0 }, false, false); ser.position.set(0, -0.045 + k * 0.022, -f * 0.014); jm.add(ser); }
      jaws.push({ mesh: jm, side: s, front: f, rest });
    }
    // lift rod + linkage to the crosshead lever
    const lr = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 10), galv, { role: "mech", edges: 0 }, true, true); lr.position.set(s * -0.02, 0.32, 0.09); g.add(lr);
    if (s < 0) { gearAnchor.position.set(s * 1.16, 0.0, 0.08); car.add(gearAnchor); }
  }
  // governor lever on the right crosshead end + governor rope
  const lever = new THREE.Group(); lever.position.set(1.12, 0.3, 0.12); car.add(lever);
  { const a = mesh(rbox(0.2, 0.03, 0.025, 0.008), steel, { role: "mech", edges: 30 }, true, true); a.position.set(-0.08, 0, 0); lever.add(a);
    const pv = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.05, 16).rotateX(Math.PI / 2), galv, { role: "mech", edges: 30 }, true, true); lever.add(pv); }
  const gov = mesh(new THREE.CylinderGeometry(0.005, 0.005, wallsH, 8), ropeMat, { role: "mech", edges: 0 }, true, true); gov.position.set(1.12 - 0.17, 0, 0.12); world.add(gov);

  // car-top balustrade (galvanised tube, posts, toe board)
  const post = (x: number, z: number) => { const p = mesh(rbox(0.04, 1.1, 0.04, 0.008), galv, { role: "env", edges: 30 }, true, true); p.position.set(x, 0.55, z); car.add(p); };
  const railTube = (a: THREE.Vector3, b: THREE.Vector3) => { const t = mesh(tube([a, b], 0.019, 2, 12), galv, { role: "env", edges: 0 }, true, true); car.add(t); };
  const BZ = CZ0 + 0.05, BX0 = CX0 + 0.04, BX1 = CX1 - 0.04, FZ = 0.25;
  [[BX0, BZ], [BX1, BZ], [BX0, FZ], [BX1, FZ], [0.1, BZ]].forEach(([x, z]) => post(x, z));
  for (const y of [1.08, 0.56]) {
    railTube(new THREE.Vector3(BX0, y, BZ), new THREE.Vector3(BX1, y, BZ));
    railTube(new THREE.Vector3(BX0, y, BZ), new THREE.Vector3(BX0, y, FZ));
    railTube(new THREE.Vector3(BX1, y, BZ), new THREE.Vector3(BX1, y, FZ));
  }
  { const tb = mesh(rbox(BX1 - BX0, 0.1, 0.012, 0.004), galv, { role: "env", edges: 30 }, true, true); tb.position.set((BX0 + BX1) / 2, 0.05, BZ); car.add(tb); }
  // red alarm beacon on the back-left post
  const alarmMat = new THREE.MeshStandardMaterial({ color: untone(BRAND.red).multiplyScalar(0.5), emissive: untone(BRAND.red), emissiveIntensity: 0.4, roughness: 0.25, transparent: false });
  {
    const b = new THREE.Group(); b.position.set(BX0, 1.11, BZ); car.add(b);
    b.add(mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.035, 20), rubber, { role: "env", edges: 0 }, true, true));
    const dome = mesh(sculpt({ r: [0.04, 0.06, 0.04], seg: [20, 14], theta: [0, Math.PI / 2] }), alarmMat, { role: "emit" }, false, false);
    dome.position.y = 0.017; b.add(dome);
  }
  const alarmLight = new THREE.PointLight(untone(BRAND.red), 0.0, 4.5, 2); alarmLight.position.set(BX0 + 0.06, 1.2, BZ + 0.08); car.add(alarmLight);
  // door operator along the back edge
  { const op = mesh(rbox(1.15, 0.17, 0.2, 0.015), steel, { role: "env", edges: 30 }, true, true); op.position.set(0.1, 0.085, CZ0 + 0.2); car.add(op);
    const mot = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.18, 24).rotateZ(Math.PI / 2), steelDark, { role: "env", edges: 30 }, true, true); mot.position.set(-0.6, 0.09, CZ0 + 0.2); car.add(mot);
    const pul = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 24).rotateX(Math.PI / 2), galv, { role: "env", edges: 30 }, true, true); pul.position.set(0.62, 0.11, CZ0 + 0.32); car.add(pul); }
  // inspection station (front-left) with cable to the crosshead
  {
    const ib = new THREE.Group(); ib.position.set(-0.62, 0, 0.56); ib.rotation.y = 0.25; car.add(ib);
    const box = mesh(rbox(0.28, 0.17, 0.15, 0.02), steelDark, { role: "env", edges: 30 }, true, true); box.position.y = 0.085; ib.add(box);
    [["#E8E6E0", -0.08], ["#1A1A1A", 0.0]].forEach(([c, x]) => { const bt2 = mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.02, 20), vinyl(c as string, { rough: 0.4, sss: "#000000", sssK: 0 }), { role: "env", edges: 0 }, true, true); bt2.position.set(x as number, 0.18, 0.02); ib.add(bt2); });
    const tg = mesh(rbox(0.02, 0.05, 0.015, 0.005), galv, { role: "env", edges: 0 }, true, true); tg.position.set(0.08, 0.19, 0.02); tg.rotation.z = 0.4; ib.add(tg);
    const d = mesh(new THREE.PlaneGeometry(0.2, 0.06), new THREE.MeshStandardMaterial({ map: stencil("insp", ["INSP"], { w: 256, h: 80, size: 60 }), transparent: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 }), { role: "decal" }, false, true);
    d.position.set(0, 0.09, 0.076); ib.add(d);
    const c = mesh(tube([new THREE.Vector3(-0.62, 0.02, 0.48), new THREE.Vector3(-0.5, 0.012, 0.2), new THREE.Vector3(-0.42, 0.015, -0.02), new THREE.Vector3(-0.3, 0.2, -0.05)], 0.011, 24, 8), cable, { role: "env", edges: 0 }, true, true);
    car.add(c);
  }
  // toolbox + spanner on the roof
  {
    const tb = new THREE.Group(); tb.position.set(0.42, 0, 0.42); tb.rotation.y = -0.35; car.add(tb);
    tb.add(at(mesh(rbox(0.38, 0.15, 0.18, 0.015), steel, { role: "env", edges: 30 }, true, true), 0, 0.075, 0));
    tb.add(at(mesh(rbox(0.39, 0.03, 0.19, 0.01), steel, { role: "env", edges: 30 }, true, true), 0, 0.16, 0));
    const h = mesh(tube([new THREE.Vector3(-0.1, 0.17, 0), new THREE.Vector3(-0.08, 0.23, 0), new THREE.Vector3(0.08, 0.23, 0), new THREE.Vector3(0.1, 0.17, 0)], 0.008, 16, 8), rubber, { role: "env", edges: 0 }, true, true);
    tb.add(h);
    for (const x of [-0.17, 0.17]) { const l = mesh(rbox(0.03, 0.03, 0.02, 0.005), galv, { role: "env", edges: 0 }, true, true); l.position.set(x, 0.14, 0.095); tb.add(l); }
    const sp = new THREE.Group(); sp.position.set(-0.05, 0.006, 0.2); sp.rotation.y = 0.7; tb.add(sp);
    sp.add(mesh(rbox(0.2, 0.01, 0.022, 0.004), galv, { role: "env", edges: 0 }, true, true));
    for (const x of [-0.11, 0.11]) { const r = mesh(new THREE.TorusGeometry(0.018, 0.007, 8, 20).rotateX(Math.PI / 2), galv, { role: "env", edges: 0 }, true, true); r.position.x = x; sp.add(r); }
  }
  // work lamp: magnetic base, pole, cage lamp (warm key light)
  const workBulb = new THREE.MeshBasicMaterial({ color: untone("#FFD9A8").multiplyScalar(6) });
  const lampHead = new THREE.Group();
  {
    const ls = new THREE.Group(); ls.position.set(0.74, 0, 0.62); car.add(ls);
    ls.add(at(mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.05, 24), steelDark, { role: "env", edges: 30 }, true, true), 0, 0.025, 0));
    ls.add(at(mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.25, 10), galv, { role: "env", edges: 0 }, true, true), 0, 0.65, 0));
    lampHead.position.set(0, 1.3, 0); ls.add(lampHead);
    const shade = mesh(new THREE.CylinderGeometry(0.05, 0.1, 0.11, 24, 1, true), steelDark, { role: "env", edges: 0 }, true, false);
    shade.material = steelDark; (shade.material as THREE.Material).side = THREE.DoubleSide;
    shade.rotation.x = Math.PI / 2; shade.position.z = 0.0; lampHead.add(shade);
    const bulb = new THREE.Mesh(sculpt({ r: [0.03, 0.03, 0.04], seg: [16, 12] }), workBulb); bulb.position.z = 0.03; lampHead.add(bulb); tag(bulb, { role: "emit" });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const r = mesh(tube([new THREE.Vector3(Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0.055), new THREE.Vector3(Math.cos(a) * 0.07, Math.sin(a) * 0.07, 0.14), new THREE.Vector3(0, 0, 0.16)], 0.0035, 8, 5), galv, { role: "env", edges: 0 }, false, false);
      lampHead.add(r);
    }
    lampHead.add(at(mesh(new THREE.TorusGeometry(0.09, 0.004, 6, 24), galv, { role: "env", edges: 0 }, false, false), 0, 0, 0.1));
  }
  const work = new THREE.SpotLight(untone("#FFD6AE"), 3.0, 9, 0.85, 0.65, 2);
  work.castShadow = true; work.shadow.mapSize.set(1536, 1536); work.shadow.bias = -0.0004; work.shadow.normalBias = 0.012; work.shadow.radius = 4;
  work.shadow.camera.near = 0.1; work.shadow.camera.far = 9;
  lampHead.add(work); work.position.set(0, 0, 0.05);
  const bounce = new THREE.PointLight(untone("#FFC9A0"), 0.9, 4.5, 2); bounce.position.set(0.1, 0.35, 0.1); car.add(bounce);
  const gearLight = new THREE.SpotLight(untone("#C4D8FF"), 2.2, 4, 0.4, 0.6, 2); gearLight.position.set(-0.75, 1.5, 1.0); car.add(gearLight);
  const gearTgt = new THREE.Object3D(); gearTgt.position.set(-1.16, 0.0, 0.0); car.add(gearTgt); gearLight.target = gearTgt;
  const workTarget = new THREE.Object3D(); car.add(workTarget); workTarget.position.set(-0.3, 0.7, -0.4); work.target = workTarget;

  // figure mount + contact shadows
  const figureMount = new THREE.Group(); figureMount.position.set(-0.46, 0, 0.14); car.add(figureMount);
  const contactMat = new THREE.MeshBasicMaterial({ map: radial("contact", 0, 0.8), color: 0x000000, transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
  const contact: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), contactMat.clone());
    c.position.y = 0.003; car.add(c); tag(c, { role: "decal" }); contact.push(c);
  }
  // contact grime under props
  for (const [x, z, w, d] of [[0.42, 0.42, 0.55, 0.35], [-0.62, 0.56, 0.45, 0.3], [0.74, 0.62, 0.25, 0.25], [0.1, CZ0 + 0.2, 1.4, 0.4]]) {
    const c = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: radial("contact", 0, 0.8), color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
    c.position.set(x, 0.002, z); car.add(c); tag(c, { role: "decal" });
  }

  // bolts (instanced)
  const bi = new THREE.InstancedMesh(boltGeo(0.012), galv, bolts.length);
  bolts.forEach((m, i) => bi.setMatrixAt(i, m));
  bi.castShadow = false; bi.receiveShadow = true; tag(bi, { role: "decal" });
  // bolts on the car (gear housing) are in car space; split: world ones only here
  world.add(bi);

  // ------------------------------------------------------------------ X-RAY force arrows (red), sparks
  const arrows = new THREE.Group(); arrows.visible = false; car.add(arrows);
  {
    const sh = new THREE.Shape();
    const w = 0.07, hw = 0.16, L = 1.1, hl = 0.3;
    sh.moveTo(-w, 0); sh.lineTo(w, 0); sh.lineTo(w, -L + hl); sh.lineTo(hw, -L + hl); sh.lineTo(0, -L); sh.lineTo(-hw, -L + hl); sh.lineTo(-w, -L + hl); sh.lineTo(-w, 0);
    const g = extrude(sh, 0.05, 0.012, 3);
    const am = new THREE.MeshBasicMaterial({ color: untone(BRAND.red).multiplyScalar(1.0) });
    const a1 = new THREE.Mesh(g, am); a1.scale.setScalar(0.7); a1.position.set(0.32, 0.05, CZ1 + 0.2); arrows.add(a1); tag(a1, { role: "fx", edges: 0, hull: true });
    const a2 = new THREE.Mesh(g, am); a2.scale.setScalar(0.45); a2.position.set(-1.16, 0.15, 0.2); arrows.add(a2); tag(a2, { role: "fx", edges: 0, hull: true });
  }
  const NS = 220;
  const sg = new THREE.BufferGeometry();
  sg.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(NS * 3), 3));
  sg.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(NS * 3), 3));
  const sparks = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.04, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, map: radial("spark", 0.1, 1.5) }));
  sparks.frustumCulled = false; world.add(sparks); tag(sparks, { role: "fx" });

  const ropeAnchor = new THREE.Object3D(); ropeAnchor.position.set(0.0, 1.6, -0.15); car.add(ropeAnchor);
  void rng;
  return {
    world, car, cw, jaws, jawMat, lever, ropesUp, ropeStubs, hitchTop, work, workTarget, workBulb,
    alarmLight, alarmMat, leaks, figureMount, contact, arrows, sparks, gearAnchor, ropeAnchor,
    labelsAt: { ropes: ropeAnchor, gear: gearAnchor },
  };
}
