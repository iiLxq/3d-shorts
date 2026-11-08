// Gouache shading: a patched MeshLambertMaterial (so three's lights + shadow maps still do the work) whose direct
// light is remapped into painted value steps. The step thresholds are broken up by a brush-stroke field, shadows
// are coloured (teal low / violet high, never black), a cool rim sits on silhouettes, and atmospheric haze is
// mixed in by distance and height. The same shader carries the three signature states:
//   uState 0 = BLUEPRINT (cyanotype paper + world-space grid), 1 = X-RAY (darkened cool glaze), 2 = SOLID.
import * as THREE from "three";
import { brushTex, paperTex } from "./paint";

export const lin = (hex: string) => new THREE.Color(hex); // THREE.Color(hex) is converted sRGB->linear
export const BRAND = {
  navy: "#0B1A33", cyan: "#35D7FF", red: "#FF3B3B", green: "#39FF88", amber: "#FFB020",
};

// shared uniforms (one object -> every gouache material sees the same state)
export const U = {
  uState: { value: 2 },
  uBrush: { value: null as THREE.Texture | null },
  uPaper: { value: null as THREE.Texture | null },
  uShadeLo: { value: lin("#173a46") }, // teal, low in the shaft
  uShadeHi: { value: lin("#2b2547") }, // violet, high in the shaft
  uFogCol: { value: lin("#1d3a4c") },
  uFogHi: { value: lin("#2a3555") },
  uFogDen: { value: 0.06 },
  uRimCol: { value: lin("#9fe3f2") },
  uRimDir: { value: new THREE.Vector2(0.6, 0.5) },
  uNavy: { value: lin(BRAND.navy) },
  uCyan: { value: lin(BRAND.cyan) },
  uXrayDim: { value: 0.35 },
};
export function initShared() {
  U.uBrush.value = brushTex();
  U.uPaper.value = paperTex();
}

export type GouacheOpts = {
  map?: THREE.Texture; color?: string; normalMap?: THREE.Texture; normalScale?: number;
  card?: boolean;       // painted cut-out (uv brush space, rim from the normal map)
  rim?: number;         // rim strength
  grid?: number;        // blueprint grid strength (walls)
  brush?: number;       // ramp-threshold breakup
  brushScale?: number;  // brush texture repeats per metre (world) or per card
  emissive?: string; emissiveIntensity?: number;
  transparent?: boolean; side?: THREE.Side;
  bpFill?: number;      // how much of the blueprint navy fill shows (0 = invisible in blueprint)
  xray?: number;        // 0: keep painted in X-RAY, 1: dim to glaze
};

const RAMP = /* glsl */ `
float paintRamp(float x){
  // three painted value steps + a soft overbright shoulder for hot spots
  return 0.30*smoothstep(0.035,0.075,x) + 0.36*smoothstep(0.22,0.30,x) + 0.40*smoothstep(0.62,0.74,x) + 0.30*smoothstep(1.3,2.2,x);
}`;

export function gouache(o: GouacheOpts = {}) {
  const m = new THREE.MeshLambertMaterial({
    map: o.map, color: o.color ?? "#ffffff", normalMap: o.normalMap,
    emissive: o.emissive ?? "#000000", emissiveIntensity: o.emissiveIntensity ?? 1,
    transparent: o.transparent ?? false, side: o.side ?? THREE.FrontSide,
  });
  if (o.normalMap) m.normalScale.set(o.normalScale ?? 1, o.normalScale ?? 1);
  const local = {
    uCard: { value: o.card ? 1 : 0 }, uRim: { value: o.rim ?? 0.35 }, uGrid: { value: o.grid ?? 0 },
    uBrushAmt: { value: o.brush ?? 0.7 }, uBrushScale: { value: o.brushScale ?? 0.9 },
    uBpFill: { value: o.bpFill ?? 1 }, uXray: { value: o.xray ?? 1 },
  };
  m.userData.u = local;
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, U, local);
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWP; varying vec3 vWN; varying vec2 vUv2;")
      .replace("#include <project_vertex>", `#include <project_vertex>
        vec4 wp4 = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wp4 = instanceMatrix * wp4;
        #endif
        vWP = (modelMatrix * wp4).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal); vUv2 = uv;`);
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", `#include <common>
        varying vec3 vWP; varying vec3 vWN; varying vec2 vUv2;
        uniform float uState, uCard, uRim, uGrid, uBrushAmt, uBrushScale, uFogDen, uBpFill, uXray, uXrayDim;
        uniform sampler2D uBrush, uPaper;
        uniform vec3 uShadeLo, uShadeHi, uFogCol, uFogHi, uRimCol, uNavy, uCyan;
        uniform vec2 uRimDir;
        ${RAMP}
        float brushAt(){
          if (uCard > 0.5) return texture2D(uBrush, vUv2 * uBrushScale).r;
          vec3 n = abs(normalize(vWN)); n /= (n.x + n.y + n.z);
          vec3 p = vWP * uBrushScale;
          return texture2D(uBrush, p.zy).r * n.x + texture2D(uBrush, p.xz).r * n.y + texture2D(uBrush, p.xy).r * n.z;
        }`)
      .replace("#include <aomap_fragment>", `#include <aomap_fragment>
        float bn = brushAt();
        {
          vec3 alb = max(diffuseColor.rgb, vec3(0.004));
          vec3 irr = reflectedLight.directDiffuse / (alb * RECIPROCAL_PI);
          float L = dot(irr, vec3(0.2126, 0.7152, 0.0722));
          float Lb = L * (1.0 + (bn - 0.5) * uBrushAmt) + (bn - 0.5) * 0.02 * uBrushAmt;
          float q = paintRamp(Lb);
          vec3 hue = irr / max(L, 1e-4);
          hue = mix(vec3(1.0), hue, smoothstep(0.0, 0.03, L));
          reflectedLight.directDiffuse = alb * RECIPROCAL_PI * hue * q * 3.14159;
          // coloured shadow: teal low in the shaft, violet up high; pigment density from the brush field
          float hk = smoothstep(-3.0, 4.0, vWP.y);
          vec3 shadeCol = mix(uShadeLo, uShadeHi, hk);
          reflectedLight.indirectDiffuse = reflectedLight.indirectDiffuse + alb * shadeCol * (0.6 + 0.3 * bn) * (uCard > 0.5 ? 1.9 : 1.0);
        }`)
      .replace("#include <opaque_fragment>", `#include <opaque_fragment>
        {
          vec3 V = normalize(vViewPosition);
          vec3 N = normalize(normal);
          float fr = pow(1.0 - clamp(abs(dot(N, V)), 0.0, 1.0), 2.5);
          float side = uCard > 0.5 ? clamp(dot(normalize(N.xy + 1e-4), uRimDir) * 0.8 + 0.35, 0.0, 1.0) * smoothstep(0.02, 0.25, length(N.xy)) : 1.0;
          vec3 rim = uRimCol * fr * uRim * side * (0.7 + 0.6 * bn);
          gl_FragColor.rgb += rim * (uState > 1.5 ? 1.0 : 0.0);
          // pigment variation (gouache is never perfectly flat)
          gl_FragColor.rgb *= 0.94 + 0.12 * bn;
          // atmosphere: distance + height haze (lifted teal, never black)
          float d = length(vWP - cameraPosition);
          float f = 1.0 - exp(-pow(d * uFogDen, 1.6));
          vec3 fogc = mix(uFogCol, uFogHi, smoothstep(-4.0, 8.0, vWP.y));
          vec3 solid = mix(gl_FragColor.rgb, fogc, f);
          // X-RAY: the painting is glazed over (cool, dim) except things flagged uXray = 0
          float lum = dot(solid, vec3(0.2126, 0.7152, 0.0722));
          vec3 glaze = uNavy * 1.1 + lum * vec3(0.10, 0.30, 0.42) * uXrayDim;
          glaze += uCyan * (pow(fr, 1.5) * 0.55 + 0.02) * (0.6 + 0.8 * bn);
          vec3 xr = mix(solid, glaze, uXray);
          // BLUEPRINT: cyanotype paper + grid; faint cyan face fill by fresnel so forms read
          vec3 bp = texture2D(uPaper, vWP.xy * 0.35 + vWP.z * 0.21).rgb;
          vec3 gp = vWP * 4.0;
          vec3 gw = fwidth(gp);
          vec3 gl = 1.0 - smoothstep(vec3(0.0), gw * 1.2, abs(fract(gp - 0.5) - 0.5));
          vec3 gp2 = vWP;
          vec3 gw2 = fwidth(gp2);
          vec3 gl2 = 1.0 - smoothstep(vec3(0.0), gw2 * 1.8, abs(fract(gp2 - 0.5) - 0.5));
          vec3 an = abs(normalize(vWN));
          float grid = an.z > 0.5 ? max(gl.x, gl.y) * 0.3 + max(gl2.x, gl2.y) * 0.5 : an.x > 0.5 ? max(gl.z, gl.y) * 0.3 + max(gl2.z, gl2.y) * 0.5 : max(gl.x, gl.z) * 0.3 + max(gl2.x, gl2.z) * 0.5;
          bp += uCyan * (grid * uGrid * 0.55 + fr * 0.10 + 0.012);
          bp = mix(bp, uCyan * 0.18 + uNavy, smoothstep(6.0, 22.0, d) * 0.6); // cyan haze glow far away
          vec3 outc = uState < 0.5 ? bp : (uState < 1.5 ? xr : solid);
          float a = gl_FragColor.a * (uState < 0.5 ? uBpFill : 1.0);
          gl_FragColor = vec4(outc, a);
        }`)
      .replace("#include <fog_fragment>", "");
  };
  m.customProgramCacheKey = () => `gouache-${o.card ? 1 : 0}`;
  return m;
}

/** X-RAY shell: translucent glaze with a Fresnel edge, the edge broken by brush texture */
export function glazeMaterial(tint = BRAND.cyan, strength = 1) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { uTint: { value: lin(tint) }, uK: { value: strength }, uBrush: U.uBrush },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; vW = (modelMatrix*vec4(position,1.0)).xyz; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uTint; uniform float uK; uniform sampler2D uBrush; varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){ float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        float b = texture2D(uBrush, vW.xy*1.3 + vW.z*0.7).r;
        float e = pow(f, 2.2) * (0.6 + 0.8*b);
        gl_FragColor = vec4(uTint * (0.035 + e * 0.75) * uK, 1.0); }`,
  });
}

/** additive light volume (cone/sheet): brighter along its axis, faded at ends and at grazing angles, painted noise */
export function beamMaterial(color: string, intensity: number, o: { noise?: THREE.Texture; axisFade?: number; scroll?: number } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { uCol: { value: lin(color) }, uI: { value: intensity }, uNoise: { value: o.noise ?? null }, uT: { value: 0 }, uState: U.uState, uCyan: U.uCyan },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv = uv; vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = -mv.xyz; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uCol; uniform float uI; uniform sampler2D uNoise; uniform float uT; uniform float uState; uniform vec3 uCyan;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        float face = abs(dot(normalize(vN), normalize(vV)));
        float along = 1.0 - vUv.y;            // cone: source at the top (uv.y = 1), 0 -> 1 along the beam
        float a = pow(1.0 - along, 1.6) * smoothstep(0.0, 0.06, along);
        a *= smoothstep(0.05, 0.6, face) * (0.4 + 0.6 * face);
        float n = texture2D(uNoise, vec2(vUv.x * 3.0 + uT * 0.02, vUv.y * 0.8 - uT * 0.035)).r;
        float n2 = texture2D(uNoise, vec2(vUv.x * 0.7 - uT * 0.013, vUv.y * 1.6 + 0.3)).r;
        a *= 0.35 + 1.6 * n + 0.8 * n2;
        vec3 c = uState < 0.5 ? uCyan * 0.8 : uCol;
        gl_FragColor = vec4(c * a * uI, 1.0);
      }`,
  });
}

/** blueprint card: navy fill (from the painted alpha) + cyan under-drawing lines */
export function cardLineMaterial(paint: THREE.Texture, line: THREE.Texture) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: true,
    uniforms: { uMap: { value: paint }, uLine: { value: line }, uNavy: U.uNavy, uCyan: U.uCyan },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform sampler2D uMap; uniform sampler2D uLine; uniform vec3 uNavy; uniform vec3 uCyan; varying vec2 vUv;
      void main(){ float a = texture2D(uMap, vUv).a; float l = texture2D(uLine, vUv).a;
        if (a < 0.02 && l < 0.02) discard;
        vec3 c = mix(uNavy * 1.25, uCyan * 1.05, l);
        gl_FragColor = vec4(c, max(a * 0.92, l)); }`,
  });
}
