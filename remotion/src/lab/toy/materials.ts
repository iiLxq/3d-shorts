// Materials for the three signature states.
// SOLID     = "painted miniature": PBR + wrap/fake-subsurface + curvature paint (convex edges dry-brushed lighter,
//             concave creases darker), so every bevel reads at phone size like a hand-finished collectible.
// BLUEPRINT = navy fill with cyan Fresnel + inverted-hull silhouette + fat edge/contour lines (HDR for bloom).
// X-RAY     = clear-resin variant: tinted glassy shell with Fresnel, sharp glints, no depth write.
import * as THREE from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { BRAND, untone } from "./palette";
import { vinylPaint } from "./paint";

const DIRECT_FIND = "float dotNL = saturate( dot( geometryNormal, directLight.direction ) );";
const DIFF_FIND = "reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );";

export type PaintOpts = {
  wrap?: number; // 0 = Lambert, 0.5 = soft vinyl
  sss?: THREE.ColorRepresentation; // terminator scatter tint (fake subsurface)
  sssK?: number;
  edge?: number; // convex-edge lightening (dry brush)
  cavity?: number; // concave darkening
  curvLo?: number; // curvature (1/m) where the edge highlight starts
  curvHi?: number;
};

// Inject wrap lighting + curvature paint into any MeshStandard/Physical material.
export function toyPaint<T extends THREE.MeshStandardMaterial>(m: T, o: PaintOpts = {}): T {
  const uni = {
    uWrap: { value: o.wrap ?? 0.0 },
    uSSS: { value: new THREE.Color(o.sss ?? "#000000").multiplyScalar(o.sssK ?? 0) },
    uEdge: { value: o.edge ?? 0.35 },
    uCav: { value: o.cavity ?? 0.3 },
    uCurv: { value: new THREE.Vector2(o.curvLo ?? 18, o.curvHi ?? 70) },
  };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni);
    let chunk = THREE.ShaderChunk.lights_physical_pars_fragment;
    if (!chunk.includes(DIRECT_FIND) || !chunk.includes(DIFF_FIND)) throw new Error("toyPaint: three lighting chunk changed");
    chunk = chunk.replace(DIRECT_FIND, `float ndlRaw = dot( geometryNormal, directLight.direction );
      float dotNL = saturate( ndlRaw );
      float wrapNL = saturate( ( ndlRaw + uWrap ) / ( 1.0 + uWrap ) );
      vec3 sssIrr = max( wrapNL - dotNL, 0.0 ) * directLight.color * ( vec3( 0.35 ) + uSSS );`);
    chunk = chunk.replace(DIFF_FIND, "reflectedLight.directDiffuse += ( irradiance + sssIrr ) * BRDF_Lambert( material.diffuseColor );");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <lights_physical_pars_fragment>", `uniform float uWrap; uniform vec3 uSSS; uniform float uEdge; uniform float uCav; uniform vec2 uCurv;\n${chunk}`)
      .replace("#include <color_fragment>", `#include <color_fragment>
      {
        vec3 nV = normalize( vNormal );
        vec3 dpx = dFdx( vViewPosition ), dpy = dFdy( vViewPosition );
        vec3 dnx = dFdx( nV ), dny = dFdy( nV );
        float cx = dot( dnx, dpx ) / max( dot( dpx, dpx ), 1e-10 );
        float cy = dot( dny, dpy ) / max( dot( dpy, dpy ), 1e-10 );
        float curv = -0.5 * ( cx + cy );
        float e = smoothstep( uCurv.x, uCurv.y, curv );
        float c = smoothstep( uCurv.x * 0.6, uCurv.y, -curv );
        diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * 1.45 + 0.035, e * uEdge );
        diffuseColor.rgb *= 1.0 - c * uCav;
      }`);
  };
  m.customProgramCacheKey = () => "toyPaint";
  return m;
}

const paintRough = () => vinylPaint("vinylPaint", 11);

// Matte painted vinyl/resin for the figures.
export function vinyl(color: THREE.ColorRepresentation, o: PaintOpts & { rough?: number; sheen?: number; clear?: number; bump?: number } = {}) {
  const m = new THREE.MeshPhysicalMaterial({
    color, roughness: o.rough ?? 0.62, metalness: 0,
    roughnessMap: paintRough(), bumpMap: paintRough(), bumpScale: o.bump ?? 0.6,
    sheen: o.sheen ?? 0.25, sheenRoughness: 0.6, sheenColor: new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.4),
    clearcoat: o.clear ?? 0.0, clearcoatRoughness: 0.35,
  });
  return toyPaint(m, { wrap: 0.45, sss: o.sss ?? "#ff5a2a", sssK: o.sssK ?? 0.25, edge: o.edge ?? 0.28, cavity: o.cavity ?? 0.25, curvLo: o.curvLo ?? 14, curvHi: o.curvHi ?? 60 });
}

// Environment (steel, concrete) with the same curvature paint, lower wrap.
export function envMat(p: THREE.MeshStandardMaterialParameters, o: PaintOpts = {}) {
  return toyPaint(new THREE.MeshStandardMaterial(p), { wrap: 0.1, edge: 0.4, cavity: 0.35, curvLo: 25, curvHi: 120, ...o });
}

// --------------------------------------------------------------------------------------------- BLUEPRINT
const navyFill = new THREE.Color(BRAND.navy).multiplyScalar(1.35);
export function bpFill() {
  return new THREE.ShaderMaterial({
    uniforms: { uFill: { value: untone("#13284A") }, uEdge: { value: untone(BRAND.cyan) }, uAmt: { value: 0.55 } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uFill; uniform vec3 uEdge; uniform float uAmt; varying vec3 vN; varying vec3 vV;
      void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.5); gl_FragColor = vec4(uFill + uEdge * f * uAmt, 1.0); }`,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2,
  });
}
void navyFill;

// Blueprint wall: navy with a world-space cyan grid (perspective + parallax, not a screen overlay).
export function bpWall(grid: THREE.Texture, cell = 0.5, k = 1) {
  return new THREE.ShaderMaterial({
    uniforms: { uGrid: { value: grid }, uNavy: { value: untone(BRAND.navy) }, uCyan: { value: untone(BRAND.cyan) }, uCell: { value: cell }, uK: { value: k }, uFogC: { value: untone(BRAND.navy) }, uCam: { value: new THREE.Vector3() } },
    vertexShader: `varying vec3 vW; varying vec3 vNw;
      void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; vNw = normalize(mat3(modelMatrix)*normal); gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform sampler2D uGrid; uniform vec3 uNavy; uniform vec3 uCyan; uniform float uCell; uniform float uK; uniform vec3 uCam; varying vec3 vW; varying vec3 vNw;
      void main(){
        vec3 n = abs(normalize(vNw));
        vec2 uv = n.x > 0.5 ? vW.zy : (n.y > 0.5 ? vW.xz : vW.xy);
        float g = texture2D(uGrid, uv / (uCell * 2.0)).r;
        float d = length(uCam - vW);
        float fade = exp(-max(d - 4.0, 0.0) * 0.12);
        gl_FragColor = vec4(uNavy * (0.9 + 0.25 * fade) + uCyan * g * 0.55 * uK * (0.3 + 0.7 * fade), 1.0);
      }`,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2,
  });
}

// Constant-pixel-width inverted hull (silhouette) in HDR cyan.
export function hullMat(color: THREE.Color, widthPx: number) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: color }, uWidth: { value: widthPx }, uRes: { value: new THREE.Vector2(1080, 1920) } },
    vertexShader: `uniform float uWidth; uniform vec2 uRes;
      void main(){ vec4 clip = projectionMatrix*modelViewMatrix*vec4(position,1.0);
        vec3 nv = normalize(normalMatrix*normal); vec2 nd = (projectionMatrix*vec4(nv,0.0)).xy; float l = length(nd);
        if (l > 1e-5) clip.xy += (nd/l) * uWidth / uRes * 2.0 * clip.w; gl_Position = clip; }`,
    fragmentShader: `uniform vec3 uColor; void main(){ gl_FragColor = vec4(uColor,1.0); }`,
    side: THREE.BackSide,
  });
}

export function lineMat(color: THREE.Color, widthPx: number, opacity = 1) {
  const m = new LineMaterial({ color: 0xffffff, linewidth: widthPx, transparent: opacity < 1, opacity, depthTest: true, worldUnits: false });
  m.color = color.clone();
  m.toneMapped = true;
  return m;
}

// --------------------------------------------------------------------------------------------- X-RAY resin
export function resin(tint: string, opacity = 0.18, edgeHex = "#BFEFFF") {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTint: { value: untone(tint) }, uEdge: { value: untone(edgeHex) }, uOp: { value: opacity },
      uKey: { value: new THREE.Vector3(0.4, 0.7, 0.5).normalize() },
    },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uTint; uniform vec3 uEdge; uniform float uOp; uniform vec3 uKey; varying vec3 vN; varying vec3 vV;
      void main(){
        vec3 n = normalize(vN); vec3 v = normalize(vV); if (!gl_FrontFacing) n = -n;
        float ndv = abs(dot(n, v));
        float f = pow(1.0 - ndv, 3.0);
        vec3 h = normalize(uKey + v);
        float sp = pow(max(dot(n, h), 0.0), 90.0) * 2.2 + pow(max(dot(n, normalize(vec3(-0.5,0.3,0.6) + v)), 0.0), 140.0) * 1.2;
        vec3 col = uTint * (0.55 + 0.6 * f) + uEdge * f * 0.85 + vec3(sp);
        float a = clamp(uOp + 0.55 * f + sp * 0.5, 0.0, 0.92);
        gl_FragColor = vec4(col, a);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
}

export function emissive(hex: string, k: number) {
  return new THREE.MeshBasicMaterial({ color: untone(hex).multiplyScalar(k), toneMapped: true, fog: false });
}
