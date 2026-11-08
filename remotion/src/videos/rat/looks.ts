// The three Fail-Safe Files looks as three.js materials:
// BLUEPRINT = navy fill + glowing cyan silhouette lines (inverted hull, constant pixel width)
// X-RAY     = additive Fresnel shell, interior visible
// SOLID     = lit paint + thin dark ink lines; revealed by a "print" clip plane sweeping along Z
import * as THREE from "three";

export const C = {
  navy: new THREE.Color("#0B1A33"),
  navyFill: new THREE.Color("#132c55"),
  cyan: new THREE.Color("#35D7FF"),
  red: new THREE.Color("#FF3B3B"),
  green: new THREE.Color("#39FF88"),
  amber: new THREE.Color("#FFB020"),
  ink: new THREE.Color("#1b1f2a"),
};

// Smooth "outline normals": average normals of coincident vertices, so faceted meshes don't crack.
export function addOutlineNormals(g: THREE.BufferGeometry) {
  if (!g.getAttribute("normal")) g.computeVertexNormals();
  const p = g.getAttribute("position") as THREE.BufferAttribute;
  const n = g.getAttribute("normal") as THREE.BufferAttribute;
  const key = (i: number) => `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
  const acc = new Map<string, THREE.Vector3>();
  for (let i = 0; i < p.count; i++) {
    const k = key(i);
    const v = acc.get(k) ?? new THREE.Vector3();
    v.x += n.getX(i); v.y += n.getY(i); v.z += n.getZ(i);
    acc.set(k, v);
  }
  const out = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const v = acc.get(key(i))!.clone().normalize();
    out[i * 3] = v.x; out[i * 3 + 1] = v.y; out[i * 3 + 2] = v.z;
  }
  g.setAttribute("onormal", new THREE.BufferAttribute(out, 3));
  return g;
}

const clipChunk = {
  pars: /* glsl */ `
    uniform float uClipZ; uniform float uClipSide; varying float vWZ;`,
  vert: /* glsl */ `vWZ = (modelMatrix * vec4(position, 1.0)).z;`,
  frag: /* glsl */ `if (uClipSide * (vWZ - uClipZ) > 0.0) discard;`,
};

// Inverted-hull outline with constant pixel width. side=BackSide.
export function outlineMaterial(color: THREE.Color, widthPx: number, opacity = 1, additive = false) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: color.clone() },
      uOpacity: { value: opacity },
      uWidth: { value: widthPx },
      uRes: { value: new THREE.Vector2(1080, 1920) },
      uClipZ: { value: 1e6 },
      uClipSide: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute vec3 onormal;
      uniform float uWidth; uniform vec2 uRes;
      ${clipChunk.pars}
      void main() {
        ${clipChunk.vert}
        vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        vec3 nv = normalize(normalMatrix * onormal);
        vec2 nd = (projectionMatrix * vec4(nv, 0.0)).xy;
        float l = length(nd);
        if (l > 1e-5) clip.xy += (nd / l) * uWidth / uRes * 2.0 * clip.w;
        gl_Position = clip;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOpacity;
      ${clipChunk.pars}
      void main() {
        ${clipChunk.frag}
        gl_FragColor = vec4(uColor, uOpacity);
      }`,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: !additive,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

// Flat navy fill (blueprint) with an optional faint Fresnel edge.
export function fillMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: C.navyFill.clone() },
      uEdge: { value: C.cyan.clone() },
      uEdgeAmt: { value: 0.5 },
      uOpacity: { value: 1 },
      uClipZ: { value: 1e6 },
      uClipSide: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV;
      ${clipChunk.pars}
      void main() {
        ${clipChunk.vert}
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform vec3 uEdge; uniform float uEdgeAmt; uniform float uOpacity;
      varying vec3 vN; varying vec3 vV;
      ${clipChunk.pars}
      void main() {
        ${clipChunk.frag}
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 3.0);
        gl_FragColor = vec4(uColor + uEdge * f * uEdgeAmt, uOpacity);
      }`,
    side: THREE.DoubleSide,
    transparent: true,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  });
}

// X-ray: additive Fresnel glow, no depth write so the interior shows through.
export function xrayMaterial(color = C.cyan) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: color.clone() }, uOpacity: { value: 1 }, uPow: { value: 2.2 } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOpacity; uniform float uPow;
      varying vec3 vN; varying vec3 vV;
      void main() {
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPow);
        gl_FragColor = vec4(uColor * (0.06 + 0.9 * f) * uOpacity, 1.0);
      }`,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

// Solid lit paint, clipped by the print plane. Lambert-style with hemisphere + key + rim, cool lifted shadows.
export function solidMaterial(albedo: THREE.ColorRepresentation, emissive = new THREE.Color(0, 0, 0)) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uAlbedo: { value: new THREE.Color(albedo) },
      uEmissive: { value: emissive.clone() },
      uKeyDir: { value: new THREE.Vector3(-0.45, 0.8, -0.4).normalize() },
      uKey: { value: new THREE.Color(1.25, 1.17, 1.02) },
      uSkyAmb: { value: new THREE.Color(0.42, 0.5, 0.68) },
      uGndAmb: { value: new THREE.Color(0.46, 0.5, 0.62) },
      uRim: { value: new THREE.Color(0.35, 0.55, 0.85) },
      uOpacity: { value: 1 },
      uClipZ: { value: 1e6 },
      uClipSide: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying vec3 vWN;
      ${clipChunk.pars}
      void main() {
        ${clipChunk.vert}
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        vWN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uAlbedo, uEmissive, uKeyDir, uKey, uSkyAmb, uGndAmb, uRim; uniform float uOpacity;
      varying vec3 vN; varying vec3 vV; varying vec3 vWN;
      ${clipChunk.pars}
      void main() {
        ${clipChunk.frag}
        vec3 n = normalize(vWN);
        if (!gl_FrontFacing) n = -n;
        float nd = max(dot(n, uKeyDir), 0.0);
        vec3 amb = mix(uGndAmb, uSkyAmb, 0.5 + 0.5 * n.y);
        vec3 h = normalize(uKeyDir + vec3(0.0, 0.0, 1.0));
        float spec = pow(max(dot(n, h), 0.0), 40.0) * 0.25;
        float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 4.0) * 0.35;
        vec3 c = uAlbedo * (amb + uKey * nd) + spec + uRim * rim + uEmissive;
        c = c / (1.0 + 0.15 * c);
        gl_FragColor = vec4(c, uOpacity);
      }`,
    side: THREE.DoubleSide,
    transparent: false,
  });
}

// Emissive glow line material (hydraulic tubes, RAT highlight): solid colour, additive halo handled by outline.
export function glowMaterial(color: THREE.Color, strength = 1) {
  return new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(strength), toneMapped: false });
}

export function setClip(m: THREE.Material, z: number, side: number) {
  const u = (m as THREE.ShaderMaterial).uniforms;
  if (u && u.uClipZ) { u.uClipZ.value = z; u.uClipSide.value = side; }
}
