// [hybrid/cast] Painted-face system. The face is PAINTED IN THE SKULL'S OWN SHADER (no decal card, no texture atlas):
// eyes, lids, brows, mouth, lips, teeth, folds, cheek washes and the beard are signed-distance shapes evaluated in the
// head's object space (front projection, normalised by the skull half-height), edges broken by the shared brush field.
// Why: (1) it is lit by the same gouache ramp/shadows as the sculpted head, so it turns with the head at any angle;
// (2) every expression is a parameter vector, so expressions BLEND continuously (no pops), blink and gaze are free;
// (3) zero textures/uploads per frame and it is resolution independent (reads at 120 px faces and in macro).
import * as THREE from "three";

/** Face parameter vector (all ~0..1 unless noted). Pairs are [character's left (+x), right (-x)]. */
export type FaceParams = {
  browIn: [number, number];   // inner brow raise (-1 frown .. 1 worried/raised)
  browOut: [number, number];  // outer brow raise
  pull: number;               // brow furrow (inner ends pulled together/down)
  lidT: [number, number];     // upper lid openness (0 closed, 1 normal, 1.35 wide)
  lidB: [number, number];     // lower lid raise (squint / smile)
  mouthW: number;             // mouth width scale (1 normal)
  open: number;               // jaw/mouth open
  smile: [number, number];    // corner lift per side (-1 frown .. 1 smile)
  teeth: number;              // upper lip raise / show upper teeth
  clench: number;             // grimace: stretched mouth with both teeth rows shown
  cheek: number;              // cheek raise + warm wash
};

export type ExprName =
  | "neutral" | "focused" | "curious" | "alarmed" | "terrified" | "wincing" | "relieved" | "smiling"
  | "determined" | "shouting" | "squint" | "smirk";

const F = (o: Partial<FaceParams>): FaceParams => ({
  browIn: [0, 0], browOut: [0, 0], pull: 0, lidT: [1, 1], lidB: [0, 0], mouthW: 1, open: 0, smile: [0.05, 0.05],
  teeth: 0, clench: 0, cheek: 0, ...o,
});

/** The expression set (12). Designed in the order a Fail-Safe beat uses them: calm work -> alarm -> relief.
 *  Polish v2: pushed to graphic-novel extremes so the seven story faces separate at ~120 px face height
 *  (neutral / focused / alarmed / terrified / wincing / relieved / smiling): each owns a different eye shape
 *  (open / slit / ring of white / pinned white / shut / heavy-lidded / crescent), brow shape and mouth shape. */
export const EXPR: Record<ExprName, FaceParams> = {
  neutral: F({ browIn: [0.05, 0.05], browOut: [0.08, 0.08], lidT: [0.9, 0.9], lidB: [0.12, 0.12], smile: [0.12, 0.12], mouthW: 0.95 }),
  focused: F({ browIn: [-0.85, -0.7], browOut: [0.15, 0.3], pull: 0.9, lidT: [0.5, 0.56], lidB: [0.5, 0.45], smile: [-0.2, -0.05], mouthW: 0.82, clench: 0.12 }),
  curious: F({ browIn: [0.25, 0.85], browOut: [0.15, 1.0], lidT: [1.0, 1.2], smile: [0.3, -0.05], mouthW: 0.85, open: 0.1 }),
  alarmed: F({ browIn: [1.15, 1.15], browOut: [0.95, 0.95], lidT: [1.45, 1.45], lidB: [0, 0], open: 0.42, mouthW: 0.66, smile: [-0.15, -0.15], teeth: 0.15 }),
  terrified: F({ browIn: [1.35, 1.35], browOut: [-0.15, -0.15], pull: 0.55, lidT: [1.55, 1.55], open: 0.62, mouthW: 1.3, smile: [-0.95, -0.95], clench: 0.8, teeth: 0.8 }),
  wincing: F({ browIn: [-0.75, -0.7], browOut: [-0.3, -0.2], pull: 1.1, lidT: [0.0, 0.0], lidB: [1.0, 1.0], clench: 1.0, mouthW: 1.15, smile: [-0.45, -0.1], cheek: 0.75 }),
  relieved: F({ browIn: [0.7, 0.7], browOut: [-0.35, -0.35], lidT: [0.32, 0.32], lidB: [0.3, 0.3], smile: [0.55, 0.55], open: 0.3, mouthW: 0.9, cheek: 0.45 }),
  smiling: F({ browIn: [0.3, 0.3], browOut: [0.35, 0.35], lidT: [0.62, 0.62], lidB: [0.85, 0.85], smile: [1.1, 1.1], open: 0.3, teeth: 0.95, mouthW: 1.2, cheek: 1.0 }),
  determined: F({ browIn: [-0.95, -0.95], browOut: [0.35, 0.35], pull: 0.7, lidT: [0.8, 0.8], lidB: [0.25, 0.25], smile: [-0.3, -0.3], mouthW: 0.9, clench: 0.35 }),
  shouting: F({ browIn: [-0.8, -0.8], browOut: [0.4, 0.4], pull: 0.9, lidT: [1.15, 1.15], open: 1.0, mouthW: 1.1, smile: [-0.25, -0.25], teeth: 0.9, cheek: 0.3 }),
  squint: F({ browIn: [-0.3, -0.3], browOut: [-0.2, -0.2], pull: 0.4, lidT: [0.3, 0.3], lidB: [0.8, 0.8], smile: [0.1, -0.05], mouthW: 0.92, cheek: 0.5 }),
  smirk: F({ browIn: [-0.1, 0.35], browOut: [0.0, 0.7], lidT: [0.72, 0.92], lidB: [0.4, 0.1], smile: [0.85, -0.1], mouthW: 0.95, cheek: 0.4 }),
};

const lerp = THREE.MathUtils.lerp;
const l2 = (a: [number, number], b: [number, number], t: number): [number, number] => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
export function mixFace(a: FaceParams, b: FaceParams, t: number): FaceParams {
  return {
    browIn: l2(a.browIn, b.browIn, t), browOut: l2(a.browOut, b.browOut, t), pull: lerp(a.pull, b.pull, t),
    lidT: l2(a.lidT, b.lidT, t), lidB: l2(a.lidB, b.lidB, t), mouthW: lerp(a.mouthW, b.mouthW, t), open: lerp(a.open, b.open, t),
    smile: l2(a.smile, b.smile, t), teeth: lerp(a.teeth, b.teeth, t), clench: lerp(a.clench, b.clench, t), cheek: lerp(a.cheek, b.cheek, t),
  };
}

export type FaceStyle = {
  skin: string; lip: string; iris: string; brow: string; lash: string;
  beard: string; beardGrey: string; beardAmt: number; // 0 none, 0.3 stubble, 1 full short beard
  browW: number;                                       // brow weight (thickness scale)
  eyeScale: number;                                    // graphic-novel eye size (1 = house size)
  eyeTilt?: number;                                    // outer-corner lift (+ = cat-eye), polish v2
  lashW?: number;                                      // upper lash-line weight (1 = house)
  age?: number;                                        // 0..1: under-eye bags, cheek hollows, brow ridge shadow
  planes?: number;                                     // 0..1: painted light planes (cheekbone tops, brow, nose bridge)
};

export function makeFaceUniforms(style: FaceStyle, radii: THREE.Vector3) {
  return {
    uFA: { value: new THREE.Vector4() }, // browIn L,R  browOut L,R
    uFB: { value: new THREE.Vector4(1, 1, 0, 0) }, // lidT L,R  lidB L,R
    uFC: { value: new THREE.Vector4(1, 0, 0, 0) }, // mouthW, open, smile L, smile R
    uFD: { value: new THREE.Vector4() }, // teeth, clench, pull, cheek
    uFE: { value: new THREE.Vector4() }, // gaze x, gaze y, blink, eyeScale
    uFR: { value: radii.clone() },
    uSkinC: { value: new THREE.Color(style.skin) }, uLipC: { value: new THREE.Color(style.lip) },
    uIrisC: { value: new THREE.Color(style.iris) }, uBrowC: { value: new THREE.Color(style.brow) },
    uLashC: { value: new THREE.Color(style.lash) }, uBeardC: { value: new THREE.Color(style.beard) },
    uBeardC2: { value: new THREE.Color(style.beardGrey) }, uBeardAmt: { value: style.beardAmt }, uBrowW: { value: style.browW },
    uFS: { value: new THREE.Vector4(style.eyeTilt ?? 0, style.lashW ?? 1, style.age ?? 0, style.planes ?? 0.5) },
  };
}
export type FaceUniforms = ReturnType<typeof makeFaceUniforms>;

export function applyFaceParams(u: FaceUniforms, f: FaceParams) {
  u.uFA.value.set(f.browIn[0], f.browIn[1], f.browOut[0], f.browOut[1]);
  u.uFB.value.set(f.lidT[0], f.lidT[1], f.lidB[0], f.lidB[1]);
  u.uFC.value.set(f.mouthW, f.open, f.smile[0], f.smile[1]);
  u.uFD.value.set(f.teeth, f.clench, f.pull, f.cheek);
}

/** vertex: subtle jaw drop with the mouth (changes the chin silhouette in profile) */
export const FACE_VERT_PARS = /* glsl */ `uniform vec4 uFC; uniform vec4 uFD; uniform vec3 uFR;`;
export const FACE_VERT = /* glsl */ `
  {
    vec3 nq = position / uFR;
    float jaw = (uFC.y * 0.10 + uFD.y * 0.02) * uFR.y;
    float k = (1.0 - smoothstep(-0.85, -0.48, nq.y)) * smoothstep(-0.55, 0.2, nq.z);
    transformed.y -= jaw * k;
    transformed.z -= jaw * k * 0.25;
  }`;

/** fragment pars + paintFace(): returns the painted albedo, accumulates line "ink" (for blueprint/x-ray line art).
 *  Polish v2 (graphic-novel): almond eyes with a heavy dark upper lash line and small sclera, angular brush-stroke
 *  brows, a dark brow-ridge plane, painted cheek/under-cheekbone/nose/lip planes, a brush-stroked boxed beard with
 *  grey strands and a bold moustache, crow's feet on squints/smiles, and a bounce-light band (gBounce). */
export const FACE_FRAG_PARS = /* glsl */ `
uniform vec4 uFA, uFB, uFC, uFD, uFE, uFS; uniform vec3 uFR;
uniform vec3 uSkinC, uLipC, uIrisC, uBrowC, uLashC, uBeardC, uBeardC2; uniform float uBeardAmt, uBrowW;
float gInk = 0.0; float gBounce = 0.0;
vec3 sl(vec3 c){ return pow(c, vec3(2.2)); }
float fillSd(float d, float soft){ float w = fwidth(d) * 0.9 + soft; return 1.0 - smoothstep(-w, w, d); }
float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
float bnz(vec2 p){ return texture2D(uBrush, p).r - 0.5; }
float ell(vec2 q, vec2 c, vec2 r){ return length((q - c) / r) - 1.0; }

vec3 paintEye(vec3 col, vec2 p, float s, float lidT, float lidB, float front){
  float es = uFE.w * 1.08;
  vec2 q = (p - vec2(s * 0.315 * es, 0.0)) / es; q.x *= s;            // mirrored: +x = outward
  q.y -= uFS.x * q.x;                                                 // eye tilt
  float w = 0.135;
  float t = q.x / w, at = abs(t);
  float k = max(0.0, 1.0 - t * t);
  float open = lidT * (1.0 - uFE.z);
  float wide = smoothstep(1.05, 1.5, open);
  float yB = -0.040 * pow(k, 0.8) * (1.0 - 0.75 * lidB) + 0.012 * t - 0.004 - 0.016 * wide * k;
  float yT0 = 0.058 * pow(k, 0.5) + 0.012 * t + 0.008 * k * (1.0 - t);   // almond: peak toward the inner third
  float yT = yB + (yT0 - yB) * clamp(open, 0.0, 1.65) + 0.003 * k;
  float jit = bnz(p * 2.3) * 0.006;
  // brow-ridge / socket plane: cool violet wash, deepest at the inner corner under the brow
  float sock = 1.0 - smoothstep(0.0, 1.0, length((q - vec2(-0.03, 0.03)) * vec2(1.0 / 0.24, 1.0 / 0.15)));
  col = mix(col, col * vec3(0.74, 0.64, 0.78), sock * (0.42 + 0.25 * uFS.z) * front);
  // lid crease (the second graphic line above the eye)
  float yC = yT0 + 0.034 + 0.016 * max(open - 1.0, 0.0);
  float crease = fillSd(abs(q.y - yC - 0.012 * t) - 0.005, 0.003) * step(at, 0.9) * (1.0 - 0.7 * uFE.z) * smoothstep(0.15, 0.5, open);
  col = mix(col, col * vec3(0.62, 0.48, 0.5), crease * 0.7 * front);
  // under-eye bag (age) and crow's feet on squints / big smiles
  float bag = fillSd(abs(q.y - (yB - 0.035 - 0.01 * k)) - 0.004, 0.003) * step(at, 0.7) * uFS.z;
  col = mix(col, col * vec3(0.72, 0.6, 0.62), bag * 0.5 * front);
  float crow = clamp(lidB * 1.3 - 0.45, 0.0, 1.0) * clamp(1.4 - open, 0.0, 1.0);
  for (int i = 0; i < 3; i++) {
    float fi = float(i) - 1.0;
    float cf = fillSd(sdSeg(q, vec2(w * 1.12, 0.004 + fi * 0.022), vec2(w * 1.45, 0.012 + fi * 0.05)) - 0.004, 0.002);
    col = mix(col, col * vec3(0.66, 0.52, 0.52), cf * crow * 0.75 * front);
  }
  // eye white (small, warm, heavily lid-shadowed)
  float d = max(max(q.y - yT, yB - q.y), (abs(q.x) - w) * 0.7);
  float eye = fillSd(d + jit * 0.3, 0.0015) * step(0.0008, yT - yB) * front;
  vec3 white = sl(vec3(0.86, 0.82, 0.76));
  white *= mix(1.0, 0.55, smoothstep(yT - 0.03, yT, q.y));
  white *= mix(1.0, 0.8, smoothstep(0.5, 1.0, at));
  // iris + pupil + catchlight (gaze in face units). Terror pins the iris small (whites all round).
  vec2 ic = vec2(uFE.x * 0.07 * s, uFE.y * 0.03 - 0.002);
  float ir = 0.052 * mix(1.0, 0.7, wide);
  float di = length(q - ic);
  float iris = fillSd(di - ir, 0.0015);
  vec3 irc = uIrisC * mix(1.35, 0.5, smoothstep(ir * 0.45, ir, di)) * mix(0.65, 1.15, (1.0 - smoothstep(-0.04, 0.03, q.y - ic.y)));
  irc = mix(irc, sl(vec3(0.04, 0.03, 0.03)), fillSd(di - ir * 0.46, 0.001));
  irc = mix(irc, uLashC, fillSd(abs(di - ir) - 0.006, 0.001) * 0.8);   // dark limbal ring
  irc *= mix(1.0, 0.5, smoothstep(yT - 0.03, yT, q.y));
  float cat = fillSd(length(q - ic - vec2(-0.02 * s, 0.022)) - 0.014, 0.001);
  vec3 ec = mix(white, irc, iris);
  ec = mix(ec, sl(vec3(1.0, 0.98, 0.93)) * 1.6, cat * iris);
  col = mix(col, ec, eye);
  // upper lash line: heavy, thickest at the outer third, runs past the corner into a flick (main readability stroke)
  float th = mix(0.010, 0.021, smoothstep(-0.7, 0.9, t)) * uFS.y * (0.9 + 0.25 * clamp(open, 0.0, 1.0));
  float lash = fillSd(abs(q.y - yT - th * 0.45) - th + jit * 0.5, 0.0015) * (1.0 - smoothstep(1.0, 1.14, at + max(0.0, -t) * 0.08));
  float flick = fillSd(sdSeg(q, vec2(w * 0.92, yT + 0.002), vec2(w * 1.22, yT + 0.02 - 0.012 * (1.0 - smoothstep(0.1, 0.5, open)))) - 0.0075, 0.0015);
  lash = max(lash, flick);
  col = mix(col, uLashC, lash * front);
  // lower lid line (thin, half strength)
  float lo = fillSd(abs(q.y - yB + 0.004) - 0.004, 0.002) * step(at, 0.98) * smoothstep(0.05, 0.2, yT - yB);
  col = mix(col, uLashC * 1.4 + col * 0.3, lo * 0.5 * front);
  gInk += (lash + lo * 0.5 + iris * fillSd(abs(di - ir) - 0.004, 0.001)) * front;
  return col;
}

vec3 paintBrow(vec3 col, vec2 p, float s, float inY, float outY, float pull, float front){
  vec2 q = p; q.x *= s;
  float x0 = 0.075 - pull * 0.035, x1 = 0.53;
  float u = clamp((q.x - x0) / (x1 - x0), 0.0, 1.0);
  float y0 = 0.195 + inY * 0.125 - pull * 0.04, y1 = 0.215 + outY * 0.10;
  float kx = 0.6;
  float yk = mix(y0, y1, kx) + 0.04 * (1.0 - 0.85 * clamp(inY - outY, 0.0, 1.4)) + 0.01 * max(outY, 0.0);
  float yc = u < kx ? mix(y0, yk, smoothstep(0.0, 1.0, u / kx) * 0.6 + 0.4 * u / kx) : mix(yk, y1, (u - kx) / (1.0 - kx));
  float th = mix(0.044, 0.014, pow(u, 1.4)) * uBrowW;                 // blocky inner end, tapered tail
  float jit = bnz(p * 3.1) * 0.012;
  float d = abs(q.y - yc) - th + jit;
  d = max(d, max(x0 - q.x + 0.006 * sin(q.y * 140.0), q.x - x1) * 1.4);
  float m = fillSd(d, 0.003) * front;
  // hair strokes inside the brow (lighter streaks along the brow)
  float hs = sin((q.y - yc) * 260.0 + q.x * 30.0 + jit * 120.0) * 0.5 + 0.5;
  vec3 bc = uBrowC * mix(1.0, 1.7, smoothstep(0.75, 0.95, hs) * smoothstep(0.1, 0.6, u));
  col = mix(col, bc, m * 0.96);
  // dark ridge shadow under the inner brow (graphic-novel brow ridge)
  float rid = fillSd(abs(q.y - (yc - th - 0.03)) - 0.018 + jit, 0.01) * (1.0 - smoothstep(0.1, 0.7, u)) * step(x0 - 0.02, q.x);
  col = mix(col, col * vec3(0.7, 0.58, 0.66), rid * (0.35 + 0.3 * uFS.z) * front);
  gInk += m;
  return col;
}

vec3 paintMouth(vec3 col, vec2 p, float front){
  float clench = uFD.y, open = uFC.y, teeth = uFD.x;
  float hw = 0.215 * uFC.x * (1.0 + 0.22 * clench);
  vec2 q = p - vec2(0.0, -0.585);
  float t = q.x / hw, at = abs(t);
  float k = max(0.0, 1.0 - t * t);
  float sm = q.x > 0.0 ? uFC.z : uFC.w;
  float cy = sm * 0.085 * at * at;
  float jit = bnz(p * 2.7) * 0.006;
  float yU = cy + (0.004 + 0.05 * open + 0.03 * teeth) * pow(k, 0.65) + 0.034 * clench * pow(k, 0.25);
  float yL = cy - (0.18 * open) * pow(k, 0.8) - 0.03 * clench * pow(k, 0.25);
  float gap = yU - yL;
  // lips: upper lip = darker plane (faces down), lower lip = lit plane with a highlight dab
  float lipU = fillSd(max(max(q.y - yU - 0.028 * pow(k, 0.5) * (1.0 - 0.6 * clench), yU - q.y - 0.002), (at - 1.03) * hw), 0.004);
  float lipL = fillSd(max(max(q.y - yL + 0.002, yL - 0.046 * pow(k, 0.6) * (1.0 - 0.5 * clench) - q.y), (at - 0.98) * hw), 0.005);
  vec3 lipc = mix(uSkinC, uLipC, 0.8);
  col = mix(col, lipc * 0.78, lipU * 0.92 * front);
  col = mix(col, lipc * 1.1, lipL * 0.88 * front);
  float hl = fillSd(ell(q, vec2(0.02, yL - 0.02), vec2(hw * 0.32, 0.009)), 0.004) * lipL;
  col = mix(col, lipc * 1.45, hl * 0.5 * front);
  // shadow under the lower lip + chin plane
  float under = 1.0 - smoothstep(0.0, 1.0, length((q - vec2(0.0, yL - 0.075 * (1.0 - 0.3 * open))) * vec2(1.0 / (hw * 0.6), 1.0 / 0.028)));
  col *= 1.0 - 0.3 * under * front;
  // opening: dark interior, teeth rows, tongue
  float dIn = max(max(q.y - yU, yL - q.y), (at - 1.0) * hw * 0.8) + jit * 0.3;
  float inner = fillSd(dIn, 0.0015) * smoothstep(0.003, 0.010, gap) * front;
  vec3 inC = sl(vec3(0.22, 0.07, 0.09));
  float tU = clamp(teeth + clench + open * 0.5, 0.0, 1.0);
  float upT = step(yU - (0.022 + 0.016 * tU), q.y) * step(at, 0.82 + 0.15 * clench) * step(0.05, tU);
  float loT = step(q.y, yL + 0.026 * clench + 0.008 * open) * step(at, 0.7 + 0.25 * clench) * step(0.05, clench + open * 0.3);
  vec3 tc = sl(vec3(0.88, 0.85, 0.78)) * mix(0.65, 1.0, smoothstep(0.0, 0.012, yU - q.y));
  float tongue = fillSd(length((q - vec2(0.0, yL + 0.008)) * vec2(1.0 / (hw * 0.55), 1.0 / 0.038)) - 1.0, 0.004) * smoothstep(0.25, 0.5, open);
  vec3 ic = mix(inC, sl(vec3(0.6, 0.25, 0.27)), tongue);
  ic = mix(ic, tc, max(upT, loT));
  float midGap = fillSd(abs(q.y - (yU + yL) * 0.5) - 0.0028, 0.001) * step(0.4, clench) * (1.0 - smoothstep(0.3, 0.6, open));
  ic = mix(ic, inC, midGap);
  col = mix(col, ic, inner);
  // mouth line (closed) / rim of the opening: the second readability stroke (bold, tapered at the corners)
  float ym = (yU + yL) * 0.5;
  float lw = 0.0105 * (0.3 + 0.7 * pow(k, 0.35));
  float line = fillSd(abs(q.y - ym) - lw + jit, 0.0015) * step(at, 1.05) * (1.0 - inner);
  float rim = fillSd(abs(dIn) - 0.006, 0.0015) * smoothstep(0.003, 0.01, gap);
  col = mix(col, sl(vec3(0.2, 0.08, 0.09)), max(line, rim * 0.85) * front);
  // corner tucks + nasolabial folds (painted planes, deepen with smile/clench/cheek)
  for (int i = 0; i < 2; i++) {
    float s = i == 0 ? 1.0 : -1.0; float smi = i == 0 ? uFC.z : uFC.w;
    vec2 cp = vec2(s * hw * 1.05, cy * 1.0 + 0.003);
    float dim = fillSd(length(q - cp) - 0.014, 0.004) * clamp(abs(smi) * 1.5 + clench, 0.0, 1.0);
    col = mix(col, col * vec3(0.66, 0.5, 0.5), dim * 0.7 * front);
    float fold = clamp(max(smi, 0.0) * 1.0 + clench * 0.9 + uFD.w * 0.5 + open * 0.3 + 0.18 * uFS.z, 0.0, 1.0);
    vec2 a = vec2(s * 0.16, 0.27), b = vec2(s * (hw + 0.065), cy - 0.05);
    float df = sdSeg(q, a, b) - 0.0065 - 0.005 * (1.0 - abs(dot(normalize(q - a), normalize(b - a))));
    col = mix(col, col * vec3(0.68, 0.54, 0.55), fillSd(df + jit, 0.005) * fold * 0.7 * front);
    gInk += fillSd(df, 0.003) * fold * 0.5 * front;
  }
  gInk += (max(line, rim) + inner * 0.25) * front;
  return col;
}

vec3 paintFace(vec3 col, vec3 op){
  vec3 nq = op / uFR;
  vec2 p = op.xy / uFR.y;
  float front = smoothstep(0.1, 0.45, nq.z);
  float ax = abs(p.x);
  float j1 = bnz(p * 1.9 + 0.3) * 0.03;
  // painted planes (gouache): warm cheek apples, cool under-cheekbone plane, nose-tip warmth, under-nose shadow
  float chk = fillSd(ell(vec2(ax, p.y), vec2(0.40, -0.27 + 0.05 * uFD.w), vec2(0.17, 0.12)) + j1 * 3.0, 0.12);
  col = mix(col, col * vec3(1.12, 0.84, 0.8), chk * (0.25 + 0.45 * uFD.w) * front);
  float hol = fillSd(abs(p.y + 0.30 + 0.55 * (ax - 0.45)) - 0.05 + j1, 0.03) * smoothstep(0.38, 0.5, ax) * (1.0 - smoothstep(0.66, 0.74, ax));
  col = mix(col, col * vec3(0.8, 0.72, 0.8), hol * (0.35 + 0.35 * uFS.z) * (1.0 - 0.6 * uFD.w) * front);
  // painted LIGHT planes (gouache: the planes that face the lamp get a lighter, warmer, opaque stroke)
  float lpC = fillSd(ell(vec2(ax, p.y), vec2(0.46, -0.13), vec2(0.15, 0.06)) + j1 * 4.0, 0.03);       // cheekbone tops
  float lpB = fillSd(ell(p, vec2(0.0, 0.42), vec2(0.36, 0.1)) + j1 * 3.0, 0.05);                       // forehead / brow plane
  float lpN = fillSd(abs(p.x + 0.012) - 0.028 + j1 * 0.5, 0.01) * step(-0.36, p.y) * step(p.y, 0.08); // nose bridge
  col = mix(col, col * vec3(1.32, 1.18, 1.04), clamp(lpC * 0.55 + lpB * 0.3 + lpN * 0.5, 0.0, 1.0) * uFS.w * front);
  float nose = 1.0 - smoothstep(0.0, 1.0, length((p - vec2(0.0, -0.34)) * vec2(1.0 / 0.11, 1.0 / 0.09)));
  col = mix(col, col * vec3(1.1, 0.86, 0.82), nose * 0.35 * front);
  float un = fillSd(ell(p, vec2(0.0, -0.455), vec2(0.13, 0.03)) + j1, 0.02);
  col = mix(col, col * vec3(0.66, 0.52, 0.55), un * 0.55 * front);
  for (int i = 0; i < 2; i++) {
    float sx = i == 0 ? 1.0 : -1.0;
    float nos = fillSd(ell(p, vec2(sx * 0.052, -0.43), vec2(0.026, 0.014)), 0.004);
    col = mix(col, sl(vec3(0.22, 0.1, 0.1)), nos * 0.75 * front);
  }
  // beard: boxed, top line rises from the upper lip (centre) to the sideburn, brush strands flowing down, salt & pepper
  if (uBeardAmt > 0.0) {
    float n1 = bnz(op.xy / uFR.y * 2.0 + op.z * 1.3);
    float n2 = bnz(op.xy / uFR.y * 5.0 + 0.41);
    vec2 fl = normalize(vec2(-0.45 * p.x, -1.0));
    vec2 pr = vec2(-fl.y, fl.x);
    float cs = dot(p, pr) * (52.0 + 22.0 * n2) + n1 * 9.0 + sin(dot(p, fl) * 7.0 + n2 * 4.0) * 2.2 + nq.z * 3.0;
    float strand = sin(cs) * 0.5 + 0.5;
    float rnd = fract(sin(floor(cs / 6.2832) * 12.9898) * 43758.5453);
    float along = sin(dot(p, fl) * (11.0 + 9.0 * rnd) + rnd * 6.2832 + n2 * 2.0) * 0.5 + 0.5;
    float axn = abs(nq.x);
    float yb = mix(-0.43, -0.02, smoothstep(0.30, 0.98, axn)) - 0.07 * smoothstep(0.12, 0.30, axn) * (1.0 - smoothstep(0.30, 0.6, axn));
    float edge = yb + (strand - 0.5) * 0.045 + n1 * 0.05;            // hair-tip edge, not a clean line
    float bm = (1.0 - smoothstep(edge - 0.012, edge + 0.012, nq.y)) * smoothstep(-0.35, 0.0, nq.z);
    // moustache: bold dark shape over the upper lip, lighter density right at the lip line
    float mous = fillSd(max(abs(p.x) - 0.27, max((-0.555 - 0.35 * p.x * p.x) - p.y, p.y - (-0.468 - 0.1 * abs(p.x)))) + n2 * 0.02 + (strand - 0.5) * 0.012, 0.006);
    float dens = uBeardAmt;
    vec3 base = uBeardC * (0.85 + 0.4 * n1);
    vec3 bc = mix(base, uBeardC2, smoothstep(0.8, 0.95, strand) * smoothstep(0.5, 0.8, along) * step(0.35, rnd));
    bc = mix(bc, uBeardC * 0.55, smoothstep(0.3, 0.05, strand) * smoothstep(0.3, 0.6, 1.0 - along) * 0.7);
    col = mix(col, bc, clamp(max(bm, mous) * dens * (0.9 + 0.2 * n1), 0.0, 1.0));
    gInk += mous * 0.3 * front;
  }
  col = paintBrow(col, p, 1.0, uFA.x, uFA.z, uFD.z, front);
  col = paintBrow(col, p, -1.0, uFA.y, uFA.w, uFD.z, front);
  // furrow between the brows, worry lines on the forehead
  float fur = fillSd(abs(abs(p.x) - 0.045 - 0.012 * (p.y - 0.2)) - 0.007, 0.003) * smoothstep(0.12, 0.16, p.y) * (1.0 - smoothstep(0.25, 0.31, p.y));
  col = mix(col, col * vec3(0.66, 0.52, 0.54), fur * uFD.z * 0.8 * front);
  float worry = clamp(max(uFA.x, uFA.y) - 0.45, 0.0, 1.0);
  for (int i = 0; i < 2; i++) {
    float yy = 0.37 + float(i) * 0.065 - 0.04 * cos(p.x * 4.0);
    col = mix(col, col * vec3(0.74, 0.62, 0.62), fillSd(abs(p.y - yy) - 0.0055, 0.003) * step(abs(p.x), 0.24) * worry * 0.85 * front);
  }
  col = paintEye(col, p, 1.0, uFB.x, uFB.z, front);
  col = paintEye(col, p, -1.0, uFB.y, uFB.w, front);
  col = paintMouth(col, p, front);
  // bounce band (brow + eyes): lifted by uBounce in the emissive slot (helmet peak / headlamp bounce)
  gBounce = front * smoothstep(-0.3, -0.02, p.y) * (1.0 - smoothstep(0.32, 0.55, p.y));
  return col;
}
`;
