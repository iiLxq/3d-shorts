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

/** The expression set (12). Designed in the order a Fail-Safe beat uses them: calm work -> alarm -> relief. */
export const EXPR: Record<ExprName, FaceParams> = {
  neutral: F({}),
  focused: F({ browIn: [-0.35, -0.35], browOut: [0.05, 0.05], pull: 0.45, lidT: [0.78, 0.78], lidB: [0.3, 0.3], smile: [-0.1, -0.1], mouthW: 0.92 }),
  curious: F({ browIn: [0.25, 0.65], browOut: [0.15, 0.8], lidT: [1.05, 1.15], smile: [0.2, -0.05], mouthW: 0.88, open: 0.08 }),
  alarmed: F({ browIn: [0.9, 0.9], browOut: [0.55, 0.55], lidT: [1.33, 1.33], lidB: [0, 0], open: 0.45, mouthW: 0.8, smile: [-0.25, -0.25], teeth: 0.35 }),
  terrified: F({ browIn: [1.15, 1.15], browOut: [0.15, 0.15], pull: 0.35, lidT: [1.42, 1.42], open: 0.55, mouthW: 1.15, smile: [-0.7, -0.7], clench: 0.55, teeth: 0.6 }),
  wincing: F({ browIn: [-0.4, -0.4], browOut: [-0.1, -0.1], pull: 0.95, lidT: [0.08, 0.12], lidB: [0.85, 0.85], clench: 0.95, mouthW: 1.05, smile: [-0.35, -0.2], cheek: 0.5 }),
  relieved: F({ browIn: [0.45, 0.45], browOut: [-0.25, -0.25], lidT: [0.55, 0.55], lidB: [0.25, 0.25], smile: [0.45, 0.45], open: 0.18, mouthW: 1.02, cheek: 0.35 }),
  smiling: F({ browIn: [0.12, 0.12], browOut: [0.2, 0.2], lidT: [0.82, 0.82], lidB: [0.55, 0.55], smile: [0.95, 0.95], open: 0.22, teeth: 0.75, mouthW: 1.12, cheek: 0.9 }),
  determined: F({ browIn: [-0.75, -0.75], browOut: [0.2, 0.2], pull: 0.6, lidT: [0.88, 0.88], lidB: [0.2, 0.2], smile: [-0.2, -0.2], mouthW: 0.95, clench: 0.25 }),
  shouting: F({ browIn: [-0.6, -0.6], browOut: [0.25, 0.25], pull: 0.8, lidT: [1.12, 1.12], open: 1.0, mouthW: 1.05, smile: [-0.2, -0.2], teeth: 0.8, cheek: 0.3 }),
  squint: F({ browIn: [-0.2, -0.2], browOut: [-0.15, -0.15], pull: 0.3, lidT: [0.42, 0.42], lidB: [0.7, 0.7], smile: [0.05, -0.05], mouthW: 0.95, cheek: 0.4 }),
  smirk: F({ browIn: [0.0, 0.25], browOut: [0.0, 0.45], lidT: [0.82, 0.92], lidB: [0.3, 0.1], smile: [0.75, -0.05], mouthW: 0.98, cheek: 0.35 }),
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
    float k = smoothstep(-0.48, -0.85, nq.y) * smoothstep(-0.55, 0.2, nq.z);
    transformed.y -= jaw * k;
    transformed.z -= jaw * k * 0.25;
  }`;

/** fragment pars + paintFace(): returns the painted albedo, accumulates line "ink" (for blueprint/x-ray line art) */
export const FACE_FRAG_PARS = /* glsl */ `
uniform vec4 uFA, uFB, uFC, uFD, uFE; uniform vec3 uFR;
uniform vec3 uSkinC, uLipC, uIrisC, uBrowC, uLashC, uBeardC, uBeardC2; uniform float uBeardAmt, uBrowW;
float gInk = 0.0;
vec3 sl(vec3 c){ return pow(c, vec3(2.2)); }
float fillSd(float d, float soft){ float w = fwidth(d) * 0.9 + soft; return 1.0 - smoothstep(-w, w, d); }
float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
float bnz(vec2 p){ return texture2D(uBrush, p).r - 0.5; }

vec3 paintEye(vec3 col, vec2 p, float s, float lidT, float lidB, float front){
  float es = uFE.w;
  vec2 q = (p - vec2(s * 0.30 * es, 0.0)) / es; q.x *= s;            // mirrored: +x = outward
  float w = 0.145;
  float t = q.x / w, at = abs(t);
  float k = max(0.0, 1.0 - t * t);
  float open = lidT * (1.0 - uFE.z);
  float yB = -0.050 * pow(k, 0.8) * (1.0 - 0.6 * lidB) + 0.010 * t - 0.006;
  float yT0 = 0.070 * pow(k, 0.5) + 0.016 * t - 0.002;
  float yT = yB + (yT0 - yB) * clamp(open, 0.0, 1.5) + 0.004 * k;
  float jit = bnz(p * 2.3) * 0.006;
  // socket wash (cool violet shade around the eye), stronger when wide open / terrified
  float sock = 1.0 - smoothstep(0.0, 1.0, length((q - vec2(0.0, 0.015)) * vec2(1.0 / 0.25, 1.0 / 0.14)));
  col = mix(col, col * vec3(0.80, 0.70, 0.82), sock * 0.45 * front);
  // crease above the lid
  float yC = yT0 + 0.036 + 0.012 * max(lidT - 1.0, 0.0);
  float crease = fillSd(abs(q.y - yC - 0.01 * t) - 0.0045, 0.003) * step(at, 0.85) * (1.0 - 0.6 * uFE.z);
  col = mix(col, col * vec3(0.72, 0.58, 0.58), crease * 0.55 * front);
  // eye white
  float d = max(max(q.y - yT, yB - q.y), (abs(q.x) - w) * 0.7);
  float eye = fillSd(d + jit * 0.3, 0.0015) * step(0.0008, yT - yB) * front;
  vec3 white = sl(vec3(0.90, 0.87, 0.82));
  white *= mix(1.0, 0.62, smoothstep(yT - 0.032, yT, q.y));          // upper-lid shadow on the ball
  white *= mix(1.0, 0.85, smoothstep(0.55, 1.0, at));
  // iris + pupil + catchlight (gaze in face units)
  vec2 ic = vec2(uFE.x * 0.072 * s, uFE.y * 0.035 - 0.004);
  float ir = 0.056;
  float di = length(q - ic);
  float iris = fillSd(di - ir, 0.0015);
  vec3 irc = uIrisC * mix(1.25, 0.55, smoothstep(ir * 0.5, ir, di)) * mix(0.7, 1.15, smoothstep(0.03, -0.04, q.y - ic.y));
  irc = mix(irc, sl(vec3(0.05, 0.04, 0.04)), fillSd(di - ir * 0.42, 0.001));
  irc *= mix(1.0, 0.55, smoothstep(yT - 0.03, yT, q.y));               // lid shadow on the iris
  float cat = fillSd(length(q - ic - vec2(-0.022 * s, 0.024)) - 0.0145, 0.001);
  vec3 ec = mix(white, irc, iris);
  ec = mix(ec, sl(vec3(1.0, 0.98, 0.93)) * 1.6, cat * iris);
  col = mix(col, ec, eye);
  // upper lash line: thick, heavier at the outer end with a short flick (the main readability stroke)
  float th = mix(0.0085, 0.017, smoothstep(-0.6, 1.0, t)) * (0.85 + 0.3 * clamp(open, 0.0, 1.0));
  float lash = fillSd(abs(q.y - yT - th * 0.35) - th + jit * 0.4, 0.0015) * smoothstep(1.12, 0.98, at + max(0.0, -t) * 0.05);
  float flick = fillSd(sdSeg(q, vec2(w * 0.95, yT + 0.002), vec2(w * 1.18, yT + 0.022)) - 0.0065, 0.0015);
  lash = max(lash, flick * smoothstep(0.1, 0.4, open));
  col = mix(col, uLashC, lash * front);
  // lower lid line (thin, half strength)
  float lo = fillSd(abs(q.y - yB + 0.004) - 0.0045, 0.002) * step(at, 1.0) * smoothstep(0.05, 0.2, yT - yB);
  col = mix(col, uLashC * 1.5 + col * 0.3, lo * 0.4 * front);
  gInk += (lash + lo * 0.5 + iris * fillSd(abs(di - ir) - 0.004, 0.001)) * front;
  return col;
}

vec3 paintBrow(vec3 col, vec2 p, float s, float inY, float outY, float pull, float front){
  vec2 q = p / vec2(1.0, 1.0); q.x *= s;
  float x0 = 0.07 - pull * 0.03, x1 = 0.50;
  float u = clamp((q.x - x0) / (x1 - x0), 0.0, 1.0);
  float y0 = 0.205 + inY * 0.10 - pull * 0.028, y1 = 0.225 + outY * 0.075;
  float arch = 0.034 * (1.0 - 0.7 * clamp(inY - outY, 0.0, 1.0));
  float yc = mix(y0, y1, u) + arch * sin(3.14159 * pow(u, 0.8));
  float th = mix(0.040, 0.015, u * u) * uBrowW;
  float jit = bnz(p * 3.1) * 0.010;
  float d = abs(q.y - yc) - th + jit;
  d = max(d, max(x0 - q.x, q.x - x1) * 1.4);
  float m = fillSd(d, 0.003) * front;
  col = mix(col, uBrowC, m * 0.95);
  gInk += m;
  return col;
}

vec3 paintMouth(vec3 col, vec2 p, float front){
  float clench = uFD.y, open = uFC.y, teeth = uFD.x;
  float hw = 0.19 * uFC.x * (1.0 + 0.22 * clench);
  vec2 q = p - vec2(0.0, -0.585);
  float t = q.x / hw, at = abs(t);
  float k = max(0.0, 1.0 - t * t);
  float sm = q.x > 0.0 ? uFC.z : uFC.w;
  float cy = sm * 0.075 * at * at;
  float jit = bnz(p * 2.7) * 0.006;
  float yU = cy + (0.004 + 0.045 * open + 0.028 * teeth) * pow(k, 0.65) + 0.030 * clench * pow(k, 0.25);
  float yL = cy - (0.15 * open) * pow(k, 0.8) - 0.026 * clench * pow(k, 0.25);
  float gap = yU - yL;
  // lips (painted from the skin colour so they sit over any beard)
  float lipU = fillSd(max(max(q.y - yU - 0.026 * pow(k, 0.5) * (1.0 - 0.6 * clench), yU - q.y - 0.002), (at - 1.03) * hw), 0.004);
  float lipL = fillSd(max(max(q.y - yL + 0.002, yL - 0.044 * pow(k, 0.6) * (1.0 - 0.5 * clench) - q.y), (at - 0.98) * hw), 0.005);
  vec3 lipc = mix(uSkinC, uLipC, 0.75);
  col = mix(col, lipc * 0.92, lipU * 0.9 * front);
  col = mix(col, lipc * 1.08, lipL * 0.85 * front);
  // shadow under the lower lip
  float under = 1.0 - smoothstep(0.0, 1.0, length((q - vec2(0.0, yL - 0.072 * (1.0 - 0.3 * open))) * vec2(1.0 / (hw * 0.6), 1.0 / 0.026)));
  col *= 1.0 - 0.22 * under * front;
  // opening: dark interior, teeth rows, tongue
  float dIn = max(max(q.y - yU, yL - q.y), (at - 1.0) * hw * 0.8) + jit * 0.3;
  float inner = fillSd(dIn, 0.0015) * smoothstep(0.003, 0.010, gap) * front;
  vec3 inC = sl(vec3(0.27, 0.09, 0.12));
  float tU = clamp(teeth + clench + open * 0.5, 0.0, 1.0);
  float upT = step(yU - (0.020 + 0.016 * tU), q.y) * step(at, 0.82 + 0.15 * clench) * step(0.05, tU);
  float loT = step(q.y, yL + 0.024 * clench + 0.008 * open) * step(at, 0.7 + 0.25 * clench) * step(0.05, clench + open * 0.3);
  vec3 tc = sl(vec3(0.90, 0.87, 0.80)) * mix(0.7, 1.0, smoothstep(0.0, 0.01, yU - q.y));
  float tongue = fillSd(length((q - vec2(0.0, yL + 0.008)) * vec2(1.0 / (hw * 0.55), 1.0 / 0.035)) - 1.0, 0.004) * smoothstep(0.25, 0.5, open);
  vec3 ic = mix(inC, sl(vec3(0.62, 0.27, 0.29)), tongue);
  ic = mix(ic, tc, max(upT, loT));
  float midGap = fillSd(abs(q.y - (yU + yL) * 0.5) - 0.0025, 0.001) * step(0.4, clench) * (1.0 - smoothstep(0.3, 0.6, open));
  ic = mix(ic, inC, midGap);
  col = mix(col, ic, inner);
  // mouth line (closed) / rim of the opening: the second readability stroke
  float ym = (yU + yL) * 0.5;
  float lw = 0.0085 * (0.35 + 0.65 * pow(k, 0.35));
  float line = fillSd(abs(q.y - ym) - lw + jit, 0.0015) * step(at, 1.04) * (1.0 - inner);
  float rim = fillSd(abs(dIn) - 0.005, 0.0015) * smoothstep(0.003, 0.01, gap);
  col = mix(col, sl(vec3(0.24, 0.10, 0.11)), max(line, rim * 0.8) * front);
  // corner tucks / dimples
  for (int i = 0; i < 2; i++) {
    float s = i == 0 ? 1.0 : -1.0; float smi = i == 0 ? uFC.z : uFC.w;
    vec2 cp = vec2(s * hw * 1.04, cy * 1.0 + 0.003);
    float dim = fillSd(length(q - cp) - 0.012, 0.004) * clamp(abs(smi) * 1.5 + clench, 0.0, 1.0);
    col = mix(col, col * vec3(0.7, 0.55, 0.55), dim * 0.6 * front);
    // nasolabial fold: from the nose wing to just outside the mouth corner
    float fold = clamp(max(smi, 0.0) * 0.9 + clench * 0.8 + uFD.w * 0.5 + open * 0.25, 0.0, 1.0);
    vec2 a = vec2(s * 0.17, 0.255), b = vec2(s * (hw + 0.06), cy - 0.045);
    float df = sdSeg(q + vec2(0.0, 0.0), a, b) - 0.0055 - 0.004 * (1.0 - abs(dot(normalize(q - a), normalize(b - a))));
    col = mix(col, col * vec3(0.74, 0.60, 0.60), fillSd(df + jit, 0.005) * fold * 0.6 * front);
    gInk += fillSd(df, 0.003) * fold * 0.5 * front;
  }
  gInk += (max(line, rim) + inner * 0.25) * front;
  return col;
}

vec3 paintFace(vec3 col, vec3 op){
  vec3 nq = op / uFR;
  vec2 p = op.xy / uFR.y;
  float front = smoothstep(0.1, 0.45, nq.z);
  // warm cheeks, cool temples (painted planes; the 3D light does the big form)
  float chk = 1.0 - smoothstep(0.0, 1.0, length((vec2(abs(p.x), p.y) - vec2(0.40, -0.30)) * vec2(1.0 / 0.20, 1.0 / 0.15)));
  col = mix(col, col * vec3(1.10, 0.86, 0.82), chk * (0.22 + 0.4 * uFD.w) * front);
  float nose = 1.0 - smoothstep(0.0, 1.0, length((p - vec2(0.0, -0.32)) * vec2(1.0 / 0.11, 1.0 / 0.10)));
  col = mix(col, col * vec3(1.08, 0.88, 0.84), nose * 0.3 * front);
  // beard: top line rises from the upper lip (centre) to the sideburn (ear), salt & pepper
  if (uBeardAmt > 0.0) {
    float ax = abs(nq.x);
    float yb = mix(-0.43, -0.02, smoothstep(0.30, 0.98, ax)) - 0.06 * smoothstep(0.12, 0.30, ax) * (1.0 - smoothstep(0.30, 0.6, ax));
    float n1 = bnz(op.xy / uFR.y * 2.0 + op.z * 1.3);
    float bm = smoothstep(yb + 0.04, yb - 0.04, nq.y + n1 * 0.08) * smoothstep(-0.65, -0.25, nq.z);
    float mous = smoothstep(-0.40, -0.47, nq.y) * (1.0 - smoothstep(0.22, 0.36, ax));   // moustache zone: lighter
    float dens = uBeardAmt * mix(1.0, 0.6, mous * step(nq.y, -0.40) * step(-0.56, nq.y));
    float sp = texture2D(uBrush, op.xy / uFR.y * 4.0 + vec2(0.37, op.z * 3.0)).r;
    vec3 bc = mix(uBeardC, uBeardC2, smoothstep(0.55, 0.75, sp));
    col = mix(col, bc, bm * clamp(dens * (0.78 + 0.35 * n1), 0.0, 1.0));
  }
  col = paintBrow(col, p, 1.0, uFA.x, uFA.z, uFD.z, front);
  col = paintBrow(col, p, -1.0, uFA.y, uFA.w, uFD.z, front);
  // furrow between the brows, worry lines on the forehead
  float fur = fillSd(abs(abs(p.x) - 0.045 - 0.01 * (p.y - 0.2)) - 0.006, 0.003) * smoothstep(0.12, 0.16, p.y) * smoothstep(0.30, 0.24, p.y);
  col = mix(col, col * vec3(0.72, 0.58, 0.58), fur * uFD.z * 0.7 * front);
  float worry = clamp(max(uFA.x, uFA.y) - 0.45, 0.0, 1.0);
  for (int i = 0; i < 2; i++) {
    float yy = 0.36 + float(i) * 0.065 - 0.04 * cos(p.x * 4.0);
    col = mix(col, col * vec3(0.78, 0.66, 0.66), fillSd(abs(p.y - yy) - 0.005, 0.003) * step(abs(p.x), 0.22) * worry * 0.8 * front);
  }
  col = paintEye(col, p, 1.0, uFB.x, uFB.z, front);
  col = paintEye(col, p, -1.0, uFB.y, uFB.w, front);
  col = paintMouth(col, p, front);
  return col;
}
`;
