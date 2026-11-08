// Every mesh carries its per-state recipe in userData.toy; states.ts swaps materials/visibility from it.
import * as THREE from "three";

export type Role =
  | "wall" // big flat shaft surfaces: blueprint grid wall, x-ray dim wall
  | "env" // static props (rails, brackets, doors): blueprint line art, x-ray solid but dimmed
  | "mech" // the mechanism + rope + rails: stays solid in x-ray
  | "jaw" // safety-gear jaws: green in every state
  | "shell" // car shell: clear resin in x-ray
  | "fig" // figure body shells: amber resin in x-ray
  | "joint" // figure ball joints + eyes: solid in x-ray (the armature)
  | "armature" // rods only visible in x-ray
  | "decal" // stencils: solid only
  | "emit" // emissive practicals (bulbs, lens, leaks)
  | "fx" // arrows, cones, sparks: managed by the scene
  | "xray-only"
  | "bp-only";

export type ToyInfo = {
  role: Role;
  solid?: THREE.Material;
  xray?: THREE.Material;
  edges?: number; // edge angle threshold (deg) for blueprint line art; 0 = none
  contours?: number[]; // local-y levels for blueprint section contours
  hull?: boolean; // blueprint silhouette hull
  lineK?: number; // line brightness multiplier
};

export function tag<T extends THREE.Object3D>(o: T, info: ToyInfo): T {
  o.userData.toy = info;
  if ((o as unknown as THREE.Mesh).isMesh) {
    const m = o as unknown as THREE.Mesh;
    if (!info.solid) info.solid = m.material as THREE.Material;
  }
  return o;
}

export function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, info: Omit<ToyInfo, "solid">, cast = true, receive = true) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast; m.receiveShadow = receive;
  return tag(m, { ...info, solid: mat });
}
