// Builds the BLUEPRINT line art (edges, section contours, silhouette hull) once per mesh, and swaps every mesh
// between SOLID / BLUEPRINT / X-RAY from its userData.toy recipe.
import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { ToyInfo } from "./registry";
import { bpFill, bpWall, hullMat, lineMat, resin } from "./materials";
import { sliceContours } from "./sculpt";
import { gridTex } from "./paint";
import { BRAND, untone } from "./palette";

export type LookState = "solid" | "blueprint" | "xray";

export type StateKit = {
  fill: THREE.ShaderMaterial; wall: THREE.ShaderMaterial; wallX: THREE.ShaderMaterial;
  edge: LineMaterial; edgeSoft: LineMaterial; contour: LineMaterial;
  hull: THREE.ShaderMaterial; hullRed: THREE.ShaderMaterial;
  resinFig: THREE.ShaderMaterial; resinCar: THREE.ShaderMaterial; resinEnv: THREE.ShaderMaterial;
  jawBp: THREE.MeshBasicMaterial;
  lines: LineMaterial[]; hulls: THREE.ShaderMaterial[];
};

export function makeKit(): StateKit {
  const cyan = untone(BRAND.cyan);
  const grid = gridTex("bpgrid");
  const edge = lineMat(cyan.clone().multiplyScalar(2.4), 2.6);
  const edgeSoft = lineMat(cyan.clone().multiplyScalar(1.1), 1.8);
  const contour = lineMat(cyan.clone().multiplyScalar(0.9), 1.4);
  const hull = hullMat(cyan.clone().multiplyScalar(2.8), 3.6);
  const hullRed = hullMat(untone(BRAND.red).multiplyScalar(2.2), 5);
  return {
    fill: bpFill(), wall: bpWall(grid, 0.5, 1), wallX: bpWall(grid, 0.5, 0.45),
    edge, edgeSoft, contour, hull, hullRed,
    resinFig: resin(BRAND.amber, 0.16, "#FFE2A0"),
    resinCar: resin("#7FD8F2", 0.07),
    resinEnv: resin("#4A6E92", 0.03),
    jawBp: new THREE.MeshBasicMaterial({ color: untone(BRAND.green).multiplyScalar(1.6) }),
    lines: [edge, edgeSoft, contour], hulls: [hull, hullRed],
  };
}

// Attach (hidden) blueprint children to every tagged mesh.
export function prepare(root: THREE.Object3D, kit: StateKit) {
  const todo: THREE.Mesh[] = [];
  root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.userData.toy && !(m as unknown as THREE.InstancedMesh).isInstancedMesh) todo.push(m); });
  for (const m of todo) {
    const info = m.userData.toy as ToyInfo;
    const bp: THREE.Object3D[] = [];
    if (info.edges && info.edges > 0) {
      const eg = new THREE.EdgesGeometry(m.geometry, info.edges);
      if (eg.getAttribute("position").count > 0) {
        const lg = new LineSegmentsGeometry().fromEdgesGeometry(eg);
        const ls = new LineSegments2(lg, info.role === "wall" ? kit.edgeSoft : kit.edge);
        ls.userData.bp = true; m.add(ls); bp.push(ls);
      }
    }
    if (info.lineK === -1) {
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      const bb = m.geometry.boundingBox!;
      const ls = new LineSegments2(new LineSegmentsGeometry().setPositions([0, bb.min.y, 0, 0, bb.max.y, 0]), kit.edge);
      m.add(ls); bp.push(ls);
    }
    if (info.contours && info.contours.length) {
      const seg = sliceContours(m.geometry, info.contours, 1);
      if (seg.length) {
        const lg = new LineSegmentsGeometry().setPositions(seg);
        const ls = new LineSegments2(lg, kit.contour);
        m.add(ls); bp.push(ls);
      }
    }
    if (info.hull && info.role !== "wall") {
      const h = new THREE.Mesh(m.geometry, info.role === "fx" ? kit.hullRed : kit.hull);
      h.userData.hull = true; m.add(h); bp.push(h);
    }
    bp.forEach((b) => { b.visible = false; b.userData.bpChild = true; });
    m.userData.bpKids = bp;
  }
}

export function applyState(root: THREE.Object3D, kit: StateKit, st: LookState) {
  root.traverse((o) => {
    const info = o.userData.toy as ToyInfo | undefined;
    if (!info || o.userData.bpChild) return;
    const m = o as THREE.Mesh;
    const kids = (o.userData.bpKids as THREE.Object3D[] | undefined) ?? [];
    const inst = (m as unknown as THREE.InstancedMesh).isInstancedMesh;
    let vis = true, mat: THREE.Material | undefined = info.solid, kidsOn = false, hullOn = false;
    if (st === "solid") {
      vis = info.role !== "armature" && info.role !== "xray-only" && info.role !== "bp-only";
      if (info.role === "fx") vis = o.userData.fxOn ?? vis;
    } else if (st === "blueprint") {
      kidsOn = true; hullOn = true;
      switch (info.role) {
        case "wall": mat = kit.wall; hullOn = false; break;
        case "jaw": mat = kit.jawBp; break;
        case "decal": case "emit": case "armature": case "xray-only": vis = false; break;
        case "fx": vis = o.userData.fxOn ?? false; mat = info.solid; break;
        default: mat = kit.fill;
      }
      if (inst) vis = false;
    } else {
      switch (info.role) {
        case "wall": mat = kit.wallX; kidsOn = true; break;
        case "env": mat = kit.resinEnv; break;
        case "shell": mat = kit.resinCar; break;
        case "fig": mat = kit.resinFig; break;
        case "joint": case "mech": case "jaw": mat = info.solid; break;
        case "armature": mat = info.solid; break;
        case "decal": case "bp-only": vis = false; break;
        case "emit": vis = true; break;
        case "fx": vis = o.userData.fxOn ?? true; hullOn = true; break;
        default: break;
      }
      if (inst) vis = false;
    }
    o.visible = vis;
    if (m.isMesh && mat && !(o as THREE.Points).isPoints) m.material = mat;
    for (const k of kids) {
      const isHull = !!k.userData.hull;
      k.visible = vis && (isHull ? hullOn : kidsOn && st === "blueprint" || (kidsOn && info.role === "wall"));
    }
    // shadows only in SOLID
    m.userData.castDefault ??= m.castShadow;
    m.castShadow = st === "solid" ? m.userData.castDefault : false;
  });
}

export function setLineRes(kit: StateKit, w: number, h: number) {
  const k = h / 1920;
  kit.lines.forEach((l) => { l.resolution.set(w, h); l.userData.base ??= l.linewidth; l.linewidth = l.userData.base * Math.max(k, 0.5); });
  kit.hulls.forEach((m) => { m.uniforms.uRes.value.set(w, h); m.userData.base ??= m.uniforms.uWidth.value; m.uniforms.uWidth.value = m.userData.base * Math.max(k, 0.5); });
}
