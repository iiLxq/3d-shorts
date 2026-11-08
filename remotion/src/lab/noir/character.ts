// "Rafa", the recurring technician (amber = person at risk), as a 2.5D painted cut-out rig.
// Every part is painted in code in ONE body coordinate system (cm, origin between the soles, y up, 3/4 view facing
// screen-left), so proportions are designed like a model sheet. Each part becomes a lit card: gouache albedo +
// a normal field generated from its own silhouette (pillow) + painted relief, so the scene's key/rim light it and
// it casts a real silhouette shadow. Blueprint versions of every part are the same shapes stroked in "line" mode.
import * as THREE from "three";
import { Painter, Pt, canvas, toTex, normalFromCanvas, shade } from "./paint";
import { gouache, cardLineMaterial, BRAND } from "./shade";

// ---------- palette (character) ----------
const JACKET = BRAND.amber;           // #FFB020, exact brand amber for the person at risk
const JACKET_DK = "#C27410";
const TAPE = "#C9D4D6";
const FAB = "#2D3647";                 // trousers: slate navy
const PAD = "#23262E";
const LEATHER = "#6C4733";
const SKIN = "#B57655", SKIN_DK = "#87503F", SKIN_LT = "#D39A75";
const BEARD = "#5E5752", BEARD_LT = "#A49A90";
const HELMET = "#EDE6D8", HELMET_DK = "#A8A4A9";
const BOOT = "#3D3130";
const STEEL = "#8C98A2";
const VIOLET_WASH = "rgba(90,50,90,0.16)";

type Draw = (P: Painter) => void;
export type Expr = "calm" | "alarm" | "relief" | "blink";
export type HandPose = "relax" | "splay" | "grip";

// ---------- shape helpers ----------
const capsule = (a: Pt, b: Pt, r: number, n = 7): Pt[] => {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, px = -uy, py = ux;
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) { const t = Math.PI / 2 + (i / n) * Math.PI; pts.push([b[0] + (Math.cos(t) * px + Math.sin(t) * -ux) * -r, b[1] + (Math.cos(t) * py + Math.sin(t) * -uy) * -r]); }
  for (let i = 0; i <= n; i++) { const t = -Math.PI / 2 + (i / n) * Math.PI; pts.push([a[0] + (Math.cos(t) * px + Math.sin(t) * -ux) * -r, a[1] + (Math.cos(t) * py + Math.sin(t) * -uy) * -r]); }
  return pts;
};
const off = (pts: Pt[], x: number, y: number): Pt[] => pts.map(([a, b]) => [a + x, b + y]);
/** tapered limb outline through a polyline (one smooth shape, rounded tip) */
const limb = (pts: Pt[], r0: number, r1: number): Pt[] => {
  const L: Pt[] = [], R: Pt[] = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const r = r0 + (r1 - r0) * (i / (n - 1));
    L.push([pts[i][0] - dy * r, pts[i][1] + dx * r]); R.push([pts[i][0] + dy * r, pts[i][1] - dx * r]);
  }
  const e = pts[n - 1], p = pts[n - 2]; let dx = e[0] - p[0], dy = e[1] - p[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
  const tip: Pt = [e[0] + dx * r1 * 0.9, e[1] + dy * r1 * 0.9];
  return [...L, tip, ...R.reverse()];
};

// ---------- HEAD ----------
function drawHead(P: Painter, e: Expr) {
  // neck (in shade under the jaw)
  P.fill([[-5, 145], [7.2, 145], [7.6, 157], [2, 154], [-3.8, 152.5]], SKIN_DK, { edge: 0.6, scumble: 0.2 });
  // face / skull
  const face: Pt[] = [[-9.5, 172.6], [-10.2, 169.6], [-10.7, 167.6], [-10.3, 166.2], [-11.5, 164.2], [-13.4, 161.7], [-12.7, 160.7], [-11.3, 160.5],
    [-11.7, 159.2], [-11.4, 158.0], [-11.6, 156.9], [-11.0, 155.6], [-10.4, 153.6], [-9.2, 152.2], [-5, 151.4], [0, 151.8], [4.5, 154.6],
    [6.8, 157.5], [8.4, 162], [8.8, 167], [8.2, 172.6]];
  P.fill(face, SKIN, { hi: "rgba(232,170,128,0.45)", hiDir: [-1, 0.6], edge: 0.8, scumble: 0.35, ang: 1.2 });
  // painted planes: temple + side of head in shade, eye socket (violet), cheekbone light, nose side
  P.wash([[2, 171], [8.4, 171.5], [8.6, 160], [5.5, 156], [2.5, 160], [1.5, 166]], "rgba(110,60,60,0.35)");
  P.wash([[-7.2, 166.6], [-2.2, 166.8], [-1.6, 163.4], [-4.5, 162.8], [-7.4, 163.6]], VIOLET_WASH);
  P.wash([[-11, 166.6], [-8.2, 166.6], [-8.2, 163.4], [-10.6, 163.6]], VIOLET_WASH);
  P.wash([[-8, 162.6], [-3, 162.8], [0.2, 161], [-3.8, 159.8], [-7.6, 160.6]], "rgba(240,190,150,0.35)");
  P.fill([[-10.4, 165.6], [-11.3, 163.5], [-12.6, 161.2], [-11.4, 160.6], [-10.1, 161.8]], SKIN_DK, { edge: 0.3, scumble: 0.1, strokes: 4 });
  P.stroke([[-11.6, 160.9], [-10.8, 160.4], [-10.1, 160.9]], "#6A3A33", 0.35);
  // beard (salt & pepper), sideburn to chin, moustache
  const beard: Pt[] = [[4.6, 165.5], [5.0, 160.5], [4.6, 156], [1, 151.6], [-5, 151.2], [-9.3, 152.1], [-10.6, 153.7], [-11.2, 155.6], [-11.6, 157], [-11.5, 158.4],
    [-11.7, 159.4], [-10.6, 160.0], [-8.4, 159.7], [-7, 158.9], [-6, 157.6], [-3.5, 158.2], [0.2, 160.6], [2.6, 165.5]];
  P.fill(beard, BEARD, { edge: 0.5, scumble: 1.2, ang: 1.7, var: 0.1 });
  for (let i = 0; i < 70; i++) { const x = -11 + P.r() * 16, y = 152 + P.r() * 9; P.stroke([[x, y], [x - 0.3, y - 0.9]], P.r() > 0.5 ? BEARD_LT : "#3C3635", 0.18, { alpha: 0.7 }); }
  // ear
  P.fill([[4.8, 165], [7.2, 165.5], [8.2, 162], [7.3, 158.6], [5.2, 158.3], [4.4, 161.8]], SKIN, { edge: 0.7, scumble: 0.1, strokes: 6 });
  P.stroke([[6.6, 164], [7.3, 161.8], [6.6, 159.6]], SKIN_DK, 0.5);
  // eyes / brows / mouth per expression
  const eyeWhite = "#E4DCCF", iris = "#3A2A22", lid = "#4A2B2A", brow = "#3A302D", mouthIn = "#4A1F2A", lip = "#91574B";
  const eye = (pts: Pt[], ix: number, iy: number, ir: number, lidPts: Pt[]) => {
    P.fill(pts, eyeWhite, { edge: 0.25, scumble: 0, strokes: 2, rough: 0.05 });
    P.ellipse(ix, iy, ir, ir * 1.05, 0, iris, true);
    P.ellipse(ix - ir * 0.35, iy + ir * 0.35, ir * 0.28, ir * 0.28, 0, "rgba(255,250,240,0.9)");
    P.stroke(lidPts, lid, 0.42, { line: true });
  };
  const browS = (pts: Pt[], w = 0.9) => P.stroke(pts, brow, w, { line: true });
  if (e === "calm") {
    eye([[-6.1, 164.5], [-4.6, 165.25], [-3.0, 164.7], [-4.4, 163.95]], -5.0, 164.55, 0.62, [[-6.2, 164.5], [-4.6, 165.35], [-2.9, 164.75]]);
    eye([[-10.2, 164.5], [-9.4, 165.0], [-8.7, 164.6], [-9.4, 164.05]], -9.75, 164.5, 0.42, [[-10.25, 164.5], [-9.4, 165.1], [-8.6, 164.65]]);
    browS([[-6.5, 167.2], [-4.4, 167.75], [-2.1, 167.35]]); browS([[-10.6, 166.8], [-8.5, 167.35]], 0.75);
    P.stroke([[-11.5, 158.2], [-9.3, 158.05], [-7.9, 157.75]], "#3E2224", 0.35, { line: true });
    P.stroke([[-11.0, 157.4], [-9.0, 157.25]], lip, 0.5, { alpha: 0.8 });
  } else if (e === "alarm") {
    eye([[-6.4, 164.6], [-4.6, 166.15], [-2.7, 164.9], [-4.5, 163.3]], -4.75, 165.05, 0.55, [[-6.5, 164.6], [-4.6, 166.3], [-2.6, 164.95]]);
    eye([[-10.3, 164.6], [-9.4, 165.6], [-8.5, 164.7], [-9.4, 163.7]], -9.6, 164.85, 0.38, [[-10.35, 164.6], [-9.4, 165.7], [-8.4, 164.7]]);
    browS([[-6.6, 168.9], [-4.6, 168.8], [-2.2, 168.0]], 0.95); browS([[-10.6, 168.6], [-8.4, 169.05]], 0.8);
    P.stroke([[-7.0, 168.2], [-5.9, 167.6]], "rgba(110,60,60,0.6)", 0.3); // worry crease
    P.fill([[-11.7, 158.9], [-9.1, 158.6], [-7.3, 157.4], [-8.4, 154.8], [-10.4, 154.5], [-11.4, 155.6]], mouthIn, { edge: 0.6, scumble: 0, strokes: 3, rough: 0.1 });
    P.fill([[-11.4, 158.6], [-8.6, 158.3], [-8.4, 157.8], [-11.2, 158.0]], "#D8CFC2", { edge: 0, scumble: 0, strokes: 0, rough: 0.05, lineW: 0 });
    P.stroke([[-11.6, 159.0], [-9.0, 158.75], [-7.3, 157.5]], lip, 0.45, { line: true });
  } else if (e === "relief") {
    P.stroke([[-6.1, 164.6], [-4.5, 163.95], [-2.9, 164.55]], lid, 0.5, { line: true });
    P.stroke([[-10.2, 164.6], [-9.4, 164.1], [-8.6, 164.5]], lid, 0.4, { line: true });
    P.stroke([[-2.6, 164.0], [-1.6, 163.2]], "rgba(120,70,60,0.6)", 0.25); // smile crease
    browS([[-6.5, 167.9], [-4.4, 167.85], [-2.1, 167.2]]); browS([[-10.6, 167.5], [-8.4, 167.6]], 0.75);
    P.fill([[-11.6, 158.4], [-9.3, 158.25], [-7.4, 158.8], [-8.6, 157.0], [-11.0, 157.1]], mouthIn, { edge: 0.5, scumble: 0, strokes: 2, rough: 0.05 });
    P.stroke([[-11.6, 158.45], [-9.2, 158.3], [-7.2, 158.95]], lip, 0.42, { line: true });
    P.wash([[-7.8, 161.2], [-3.5, 161.8], [-2.8, 160], [-6.8, 159.6]], "rgba(200,110,90,0.25)"); // cheeks lifted
  } else {
    P.stroke([[-6.1, 164.45], [-4.5, 164.3], [-2.9, 164.55]], lid, 0.55, { line: true });
    P.stroke([[-10.2, 164.5], [-9.4, 164.35], [-8.6, 164.5]], lid, 0.45, { line: true });
    browS([[-6.5, 167.2], [-4.4, 167.75], [-2.1, 167.35]]); browS([[-10.6, 166.8], [-8.5, 167.35]], 0.75);
    P.stroke([[-11.5, 158.2], [-9.3, 158.05], [-7.9, 157.75]], "#3E2224", 0.35, { line: true });
  }
  P.stroke([[-2.3, 164.6], [-1.3, 165.1]], "rgba(120,70,60,0.45)", 0.2); // crow's feet
  P.stroke([[-2.3, 164.2], [-1.4, 164.0]], "rgba(120,70,60,0.45)", 0.2);
  // helmet: brim shadow painted on the forehead, then dome + brim + headlamp
  P.wash([[-10.6, 172.6], [8.6, 172.8], [8.6, 170.6], [-1, 169.8], [-10.3, 170.4]], "rgba(60,30,50,0.55)");
  P.fill([[-12.8, 172], [-12.4, 176.6], [-9.5, 180.9], [-4, 183.7], [2, 183.7], [7.2, 181.6], [10.4, 177.6], [11.2, 172.6]], HELMET,
    { hi: "rgba(255,250,236,0.7)", hiDir: [-0.7, 1], edge: 0.9, ang: 0.2, scumble: 0.6 });
  P.stroke([[-6.5, 182.5], [-1.5, 183.9], [4, 183.2]], "rgba(255,255,255,0.6)", 0.6);
  P.stroke([[-5, 183.4], [-4, 177], [-3.6, 172.4]], HELMET_DK, 0.7, { line: true }); // ridge
  P.fill([[-17.2, 171.4], [-12.5, 172.6], [0, 172.6], [11.7, 173.0], [11.8, 171.4], [0, 170.9], [-12, 170.5], [-16.8, 170.1]], "#CFC6B6", { edge: 0.8, scumble: 0.2, strokes: 6 });
  P.stroke([[-12.6, 175.2], [0, 175.6], [11, 174.9]], "#2C3140", 0.9, { line: true }); // lamp strap
  P.fill([[-14.2, 173.6], [-10, 173.4], [-9.6, 177.4], [-13.8, 177.6]], "#2E3442", { edge: 0.6, scumble: 0.1, strokes: 4 });
  P.ellipse(-13.6, 175.5, 0.9, 1.45, 0, "#FFF4D8", true);
  P.ellipse(-13.6, 175.5, 0.5, 0.9, 0, "#FFFFFF");
  // scuffs
  for (let i = 0; i < 9; i++) { const x = -10 + P.r() * 19, y = 174 + P.r() * 8; P.stroke([[x, y], [x + 0.8, y + 0.2]], "rgba(120,110,100,0.55)", 0.2); }
}

// ---------- TORSO (jacket, belt, hips) ----------
function drawTorso(P: Painter) {
  // trousers top under the jacket
  P.fill([[-15.4, 97], [-15.8, 85], [-2, 81.5], [15.2, 85], [15.6, 97]], FAB, { edge: 0.6, scumble: 0.4 });
  // hammer hanging from the belt loop (behind the pouch)
  P.fill(capsule([16.6, 92], [17.6, 75.5], 0.9), "#7A5A3E", { edge: 0.6, strokes: 3, scumble: 0.1 });
  P.fill([[14.6, 77.5], [21.4, 77.0], [21.6, 74.6], [14.4, 75]], "#5D6670", { edge: 0.7, strokes: 3 });
  const body: Pt[] = [[-8, 153.3], [-15, 148.6], [-19, 143], [-18.6, 128], [-17.2, 110], [-16.4, 97.5], [-16.6, 95.6], [0, 94.6], [17, 96], [17.2, 98],
    [19.2, 110], [20.6, 128], [21.2, 141], [17.6, 147.4], [8, 151.8]];
  P.fill(body, JACKET, { hi: "rgba(255,226,150,0.35)", hiDir: [-1, 0.8], edge: 1, ang: 1.45, var: 0.06, scumble: 0.5 });
  // folds / form shade (painted in darker amber, warm not grey)
  P.wash([[10, 150], [21, 141], [20.4, 112], [17, 98], [12.5, 99], [15, 120], [14, 138]], "rgba(170,80,10,0.32)");
  P.stroke([[-2, 120], [3, 112], [5, 100]], JACKET_DK, 0.55, { alpha: 0.7 });
  P.stroke([[-12, 112], [-9, 104], [-10, 98]], JACKET_DK, 0.5, { alpha: 0.6 });
  P.stroke([[4, 140], [9, 134], [10, 126]], JACKET_DK, 0.45, { alpha: 0.5 });
  // zipper
  P.stroke([[-6.2, 151], [-5.6, 124], [-5.2, 97]], "#9A5A12", 0.6, { line: true });
  // reflective tape: two hoops + shoulder braces
  const tape = (pts: Pt[]) => P.fill(pts, TAPE, { edge: 0.5, strokes: 10, ang: 0, scumble: 0.8, var: 0.08 });
  tape([[-18.4, 131.8], [0, 133.2], [20.5, 131.6], [20.6, 128.2], [0, 129.6], [-18.5, 128.4]]);
  tape([[-17.6, 117.4], [0, 118.6], [19.6, 117.2], [19.4, 113.8], [0, 115.2], [-17.5, 114.0]]);
  tape([[-12.2, 149.8], [-9.6, 151], [-6.8, 133], [-9.4, 132.8]]);
  tape([[9.6, 150.8], [12.4, 149.4], [10.8, 132.8], [8.0, 133.0]]);
  // chest pocket + pen
  P.fill([[4.4, 141], [12.6, 140.6], [12.4, 134.6], [4.6, 134.8]], "#F0A418", { edge: 0.8, strokes: 6 });
  P.stroke([[4.6, 140.2], [12.6, 139.9]], JACKET_DK, 0.4);
  P.stroke([[6.2, 143], [6.4, 139.5]], "#2B5E8A", 0.5);
  // collar (navy fleece lining)
  P.fill([[-8.8, 150.0], [-7.6, 153.8], [0, 155.6], [8.6, 154.2], [9.0, 150.6], [0, 152.2]], "#33405A", { edge: 0.7, strokes: 8, scumble: 0.6 });
  // tool belt + buckle + pouch + tape measure
  P.fill([[-16.7, 99.5], [0, 98.8], [17.4, 100.0], [17.2, 94.8], [0, 93.6], [-16.6, 94.4]], LEATHER, { edge: 0.8, ang: 0, strokes: 18 });
  P.fill([[-6.8, 99.6], [-3.0, 99.6], [-3.0, 93.8], [-6.8, 93.8]], STEEL, { edge: 0.8, strokes: 2, scumble: 0.1 });
  P.fill([[8.2, 98], [17.6, 98.6], [17.0, 85.4], [9.0, 85]], "#5B3B2B", { edge: 0.9, strokes: 12, ang: 1.5 });
  P.fill([[8.0, 98.4], [17.8, 99], [17.4, 93.6], [8.4, 93.2]], "#4C3124", { edge: 0.7, strokes: 6 });
  P.fill([[-14.6, 96], [-9.2, 96], [-9.0, 89.6], [-14.4, 89.8]], "#2C3644", { edge: 0.7, strokes: 4 });
  P.ellipse(-11.8, 92.8, 1.6, 1.6, 0, "#C9B21E", false);
}

// ---------- ARMS ----------
function drawUpperArm(P: Painter, near: boolean) {
  const s = near ? 1 : -1, cx = near ? 18 : -17;
  const pts: Pt[] = near
    ? [[14.6, 146.4], [18, 148], [22, 145.4], [23.6, 138], [22.6, 122], [21.6, 114.5], [16.4, 114.2], [15.4, 124], [14.4, 138]]
    : [[-13.6, 146], [-17.4, 147.4], [-20.6, 145.2], [-21.6, 137], [-20.6, 122], [-19.6, 114.4], [-14.4, 114.8], [-13.4, 126], [-12.8, 140]];
  P.fill(pts, near ? JACKET : "#E89A12", { hi: near ? "rgba(255,226,150,0.35)" : undefined, edge: 1, ang: 1.5, scumble: 0.4 });
  P.wash(off([[2, 146], [5, 138], [4.2, 118], [2, 115], [1.5, 130]], cx - 2 * s * 0, 0).map(([x, y]) => [cx + (x - 0) * s * 0.9, y] as Pt), "rgba(160,70,10,0.3)");
  P.fill(near ? [[15.0, 127.4], [23.2, 127.6], [23.0, 124.2], [15.2, 124.0]] : [[-20.9, 127.6], [-13.2, 127.4], [-13.4, 124.0], [-20.7, 124.2]], TAPE, { edge: 0.4, strokes: 4, ang: 0, scumble: 0.8 });
  P.stroke(near ? [[17, 120], [19.6, 117.6], [21.4, 118.2]] : [[-15, 120], [-17.6, 117.6], [-19.4, 118.2]], JACKET_DK, 0.4, { alpha: 0.7 });
}
function drawForearm(P: Painter, near: boolean) {
  const pts: Pt[] = near
    ? [[16.4, 121.5], [22.6, 120.5], [22.6, 108], [21.8, 96], [21.4, 92.2], [17.8, 91.8], [17.2, 97], [16.2, 110]]
    : [[-14.4, 121.5], [-20.6, 120.5], [-20.6, 108], [-19.8, 96], [-19.4, 92.2], [-15.8, 91.8], [-15.2, 97], [-14.2, 110]];
  P.fill(pts, near ? JACKET : "#E89A12", { edge: 1, ang: 1.55, scumble: 0.4 });
  P.stroke(near ? [[17.4, 112], [20, 108], [21.2, 103]] : [[-15.4, 112], [-18, 108], [-19.2, 103]], JACKET_DK, 0.45, { alpha: 0.7 });
  P.fill(near ? [[17.4, 95.6], [21.8, 95.8], [21.6, 91.4], [17.6, 91.2]] : [[-15.4, 95.6], [-19.8, 95.8], [-19.6, 91.4], [-15.6, 91.2]], "#2E3546", { edge: 0.6, strokes: 8, ang: 1.57 });
}
// hands are designed around a wrist at (0,0) hanging down, thumb forward (screen-left)
function drawHand(P: Painter, wx: number, wy: number, pose: HandPose, far: boolean) {
  const sk = far ? "#A86A4C" : SKIN;
  const F = (pts: Pt[]) => off(pts, wx, wy);
  const finger = (a: Pt, b: Pt, c: Pt, r: number) => { P.fill(F(limb([a, b, c], r * 1.05, r * 0.8)), sk, { edge: 0.45, strokes: 2, scumble: 0.05, rough: 0.03 }); };
  if (pose === "relax") {
    finger([-2.6, -3.4], [-4.4, -7.0], [-4.2, -9.2], 0.95);
    P.fill(F([[-2.1, 0.6], [2.1, 0.4], [3.0, -5], [2.2, -9.4], [-1.6, -9.6], [-2.9, -5.5]]), sk, { hi: "rgba(230,170,130,0.4)", edge: 0.8, strokes: 8, scumble: 0.2, rough: 0.08 });
    [-1.3, -0.1, 1.1, 2.0].forEach((x, i) => finger([x, -8.8], [x - 0.5, -12.6 + i * 0.3], [x - 1.5, -14.6 + i * 0.5], 0.78 - i * 0.04));
    P.stroke(F([[-1.2, -8.4], [0.4, -8.6], [2, -8.4]]), SKIN_DK, 0.25, { alpha: 0.7 });
  } else if (pose === "splay") {
    P.fill(F([[-2.1, 0.6], [2.1, 0.4], [3.2, -5.5], [2, -9.8], [-1.8, -10], [-3.0, -5.6]]), sk, { hi: "rgba(230,170,130,0.45)", edge: 0.8, strokes: 8, scumble: 0.2, rough: 0.08 });
    finger([-2.6, -3.4], [-5.2, -6.4], [-6.6, -8.8], 0.95);
    finger([-1.5, -9.2], [-2.8, -13.2], [-3.6, -16.2], 0.78);
    finger([-0.2, -9.6], [-0.4, -14.0], [-0.6, -17.4], 0.8);
    finger([1.1, -9.4], [1.8, -13.8], [2.4, -16.8], 0.76);
    finger([2.1, -8.8], [3.6, -12.0], [4.6, -14.4], 0.68);
    P.wash(F([[-1.6, -2], [1.8, -2], [2, -8], [-1.4, -8.4]]), "rgba(200,120,100,0.25)");
  } else {
    // fist around a spanner: spanner first (behind the fingers)
    P.fill(F([[-0.9, -3], [0.9, -3], [-2.4, -26], [-4.2, -25.8]]), STEEL, { hi: "rgba(230,240,250,0.5)", edge: 0.8, strokes: 6, ang: 1.4, scumble: 0.2 });
    P.fill(F([[-5.8, -24.5], [-0.8, -24.8], [0.2, -28.4], [-1.6, -30.6], [-2.4, -28.4], [-3.6, -28.2], [-4.4, -30.6], [-6.4, -28.4]]), STEEL, { edge: 0.8, strokes: 4, scumble: 0.2 });
    P.fill(F([[-2.2, 0.6], [2.1, 0.4], [3.2, -4.6], [2.6, -8.8], [-1.8, -9.2], [-3.4, -5.2]]), sk, { hi: "rgba(230,170,130,0.4)", edge: 0.8, strokes: 8, scumble: 0.2, rough: 0.08 });
    for (let i = 0; i < 4; i++) P.fill(F(capsule([2.6, -5.6 - i * 1.0], [-1.6, -6.4 - i * 0.95], 0.62)), sk, { edge: 0.8, strokes: 1, scumble: 0, rough: 0.04 });
    finger([-2.8, -3.0], [-3.6, -6.2], [-2.0, -7.6], 0.9);
  }
}

// ---------- LEGS ----------
function drawThigh(P: Painter, near: boolean) {
  const pts: Pt[] = near ? [[0.8, 97], [16.8, 97], [16.6, 80], [15.0, 60], [14.2, 50.5], [2.6, 50], [2.0, 62], [0.6, 80]]
    : [[-17.6, 97], [-0.6, 97], [-1.0, 80], [-2.6, 60], [-3.2, 50.5], [-14.6, 50.5], [-15.4, 62], [-17.2, 80]];
  P.fill(pts, near ? FAB : "#262E3E", { edge: 0.8, ang: 1.5, scumble: 0.5 });
  if (near) {
    P.fill([[9.2, 75], [14.6, 75.4], [14.2, 62.2], [9.4, 62]], "#283142", { edge: 0.8, strokes: 6 });
    P.stroke([[9.2, 74.6], [14.6, 75.0]], "#1C2230", 0.4);
    P.stroke([[4, 72], [7, 64], [6.4, 56]], "#1E2533", 0.4, { alpha: 0.7 });
  } else P.stroke([[-13, 72], [-10, 64], [-10.6, 56]], "#1A202C", 0.4, { alpha: 0.7 });
}
function drawShin(P: Painter, near: boolean) {
  const leg: Pt[] = near ? [[2.6, 56], [14.2, 56], [14.6, 44], [14.0, 30], [12.6, 12], [5.0, 11.6], [3.4, 28], [2.6, 44]]
    : [[-14.6, 56], [-3.0, 56], [-2.8, 44], [-3.6, 30], [-5.0, 12], [-12.4, 11.6], [-14.2, 28], [-14.6, 44]];
  P.fill(leg, near ? FAB : "#262E3E", { edge: 0.8, ang: 1.5, scumble: 0.5 });
  P.stroke(near ? [[5.4, 36], [8, 26], [7.4, 16]] : [[-11.4, 36], [-9, 26], [-9.6, 16]], "#1C2230", 0.4, { alpha: 0.6 });
  // knee pad
  P.fill(near ? [[3.0, 57.4], [13.8, 57.4], [13.6, 44.6], [8.4, 43.2], [3.2, 44.6]] : [[-14.2, 57.4], [-3.4, 57.4], [-3.6, 44.6], [-8.8, 43.2], [-14, 44.6]], PAD,
    { hi: "rgba(140,150,170,0.35)", hiDir: [-1, 1], edge: 0.7, strokes: 8, scumble: 0.3 });
}

function drawBoot(P: Painter, near: boolean) {
  // boot (toe to screen-left), sole, laces
  const boot: Pt[] = near ? [[4.6, 14.5], [12.4, 14.5], [12.8, 6], [12.6, 0.8], [-6, 0.6], [-7.2, 2.2], [-6.4, 5.2], [0.5, 7.6], [4, 9.2]]
    : [[-12, 14.5], [-5.2, 14.5], [-4.6, 6], [-4.8, 0.8], [-22.6, 0.6], [-23.8, 2.2], [-23, 5.2], [-16, 7.6], [-12.6, 9.2]];
  P.fill(boot, near ? BOOT : "#2F2627", { hi: "rgba(160,130,110,0.35)", hiDir: [-1, 1], edge: 0.8, strokes: 14, scumble: 0.4 });
  P.fill(near ? [[-6.4, 2.0], [12.8, 2.2], [12.8, 0.0], [-6.2, 0.0]] : [[-23.4, 2.0], [-4.6, 2.2], [-4.6, 0.0], [-23.2, 0.0]], "#1E1D24", { edge: 0.3, strokes: 3 });
  const lx = near ? 3.4 : -13.2;
  for (let i = 0; i < 3; i++) P.stroke([[lx - i * 1.6, 9.6 - i * 0.6], [lx + 2.2 - i * 1.6, 10.4 - i * 0.6]], "#B6A58E", 0.35);
  P.stroke(near ? [[-5.4, 4.6], [-3, 6.2]] : [[-22.4, 4.6], [-20, 6.2]], "rgba(200,180,160,0.6)", 0.4); // scuffed toe cap
}

// ---------- part table ----------
type PartDef = { name: string; parent: string | null; bbox: [number, number, number, number]; pivot: Pt; z: number; ppu: number; draw: Draw; variants?: Record<string, Draw> };
const DEFS: PartDef[] = [
  { name: "root", parent: null, bbox: [0, 0, 0, 0], pivot: [0, 92], z: 0, ppu: 0, draw: () => {} },
  { name: "armF", parent: "torso", bbox: [-24, 112, -10, 150], pivot: [-16.6, 143.5], z: -0.05, ppu: 6, draw: (P) => drawUpperArm(P, false) },
  { name: "foreF", parent: "armF", bbox: [-23, 89, -12, 123], pivot: [-17.2, 117.5], z: -0.048, ppu: 6, draw: (P) => drawForearm(P, false) },
  { name: "handF", parent: "foreF", bbox: [-25, 60, -10, 94], pivot: [-17.6, 92], z: -0.046, ppu: 9, draw: (P) => drawHand(P, -17.6, 92, "relax", true),
    variants: { relax: (P) => drawHand(P, -17.6, 92, "relax", true), splay: (P) => drawHand(P, -17.6, 92, "splay", true), grip: (P) => drawHand(P, -17.6, 92, "grip", true) } },
  { name: "thighF", parent: "root", bbox: [-19, 48, 1, 98], pivot: [-8.6, 90], z: -0.03, ppu: 5, draw: (P) => drawThigh(P, false) },
  { name: "shinF", parent: "thighF", bbox: [-25, -1, -2, 58], pivot: [-8.8, 51], z: -0.026, ppu: 5, draw: (P) => drawShin(P, false) },
  { name: "bootF", parent: "shinF", bbox: [-25, -1, -3, 16], pivot: [-9, 9], z: -0.024, ppu: 6, draw: (P) => drawBoot(P, false) },
  { name: "thighN", parent: "root", bbox: [-1, 48, 18, 98], pivot: [8.4, 90], z: 0.006, ppu: 5, draw: (P) => drawThigh(P, true) },
  { name: "shinN", parent: "thighN", bbox: [-8, -1, 15, 58], pivot: [8.4, 51], z: 0.01, ppu: 5, draw: (P) => drawShin(P, true) },
  { name: "bootN", parent: "shinN", bbox: [-8, -1, 14, 16], pivot: [9, 9], z: 0.012, ppu: 6, draw: (P) => drawBoot(P, true) },
  { name: "head", parent: "torso", bbox: [-18, 144, 13, 185], pivot: [0.5, 150], z: 0.016, ppu: 14, draw: (P) => drawHead(P, "calm"),
    variants: { calm: (P) => drawHead(P, "calm"), alarm: (P) => drawHead(P, "alarm"), relief: (P) => drawHead(P, "relief"), blink: (P) => drawHead(P, "blink") } },
  { name: "torso", parent: "root", bbox: [-21, 73, 23, 157], pivot: [0, 99], z: 0.02, ppu: 6, draw: (P) => drawTorso(P) },
  { name: "armN", parent: "torso", bbox: [12, 112, 25, 150], pivot: [18.4, 143.5], z: 0.03, ppu: 6, draw: (P) => drawUpperArm(P, true) },
  { name: "foreN", parent: "armN", bbox: [14, 89, 25, 123], pivot: [19.4, 117.5], z: 0.032, ppu: 6, draw: (P) => drawForearm(P, true) },
  { name: "handN", parent: "foreN", bbox: [8, 58, 27, 94], pivot: [19.6, 92], z: 0.034, ppu: 9, draw: (P) => drawHand(P, 19.6, 92, "grip", false),
    variants: { relax: (P) => drawHand(P, 19.6, 92, "relax", false), splay: (P) => drawHand(P, 19.6, 92, "splay", false), grip: (P) => drawHand(P, 19.6, 92, "grip", false) } },
];

type Variant = { paint: THREE.Texture; line: THREE.Texture; solid: THREE.Material; bp: THREE.Material; depth: THREE.Material };
export type Part = { def: PartDef; group: THREE.Group; mesh: THREE.Mesh; variants: Record<string, Variant>; current: string };

function makeVariant(def: PartDef, draw: Draw, seed: number): Variant {
  const [x0, y0, x1, y1] = def.bbox, ppu = def.ppu * 1.0;
  const W = Math.ceil((x1 - x0) * ppu), H = Math.ceil((y1 - y0) * ppu);
  const c = canvas(W, H), Pp = new Painter(c, "paint", x0, y1, ppu, seed); draw(Pp);
  const lc = canvas(W, H), Pl = new Painter(lc, "line", x0, y1, ppu, seed); draw(Pl);
  const nc = normalFromCanvas(c, Math.max(3, Math.round(ppu * 1.6)), 2.4, 0.5);
  const paint = toTex(c), line = toTex(lc), nrm = toTex(nc, { srgb: false });
  const solid = gouache({ map: paint, normalMap: nrm, normalScale: 1, card: true, rim: 0.7, brush: 0.55, brushScale: 3, transparent: true, side: THREE.DoubleSide, xray: 0 });
  (solid as THREE.MeshLambertMaterial).alphaTest = 0.04;
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: paint, alphaTest: 0.5 });
  return { paint, line, solid, bp: cardLineMaterial(paint, line), depth };
}

export type Rig = { root: THREE.Group; parts: Record<string, Part>; lampAnchor: THREE.Object3D; lampDir: THREE.Object3D; eyeAnchor: THREE.Object3D; contact: THREE.Mesh };

export function buildRig(): Rig {
  const root = new THREE.Group(); root.name = "rafa";
  const parts: Record<string, Part> = {};
  let order = 20;
  for (const d of DEFS) {
    const g = new THREE.Group(); g.name = d.name;
    const parentPivot = d.parent ? DEFS.find((q) => q.name === d.parent)!.pivot : [0, 0];
    g.position.set((d.pivot[0] - parentPivot[0]) / 100, (d.pivot[1] - parentPivot[1]) / 100, 0);
    let mesh: THREE.Mesh;
    const variants: Record<string, Variant> = {};
    if (d.ppu > 0) {
      const keys = d.variants ? Object.keys(d.variants) : ["base"];
      keys.forEach((k, i) => { variants[k] = makeVariant(d, d.variants ? d.variants[k] : d.draw, 100 + order * 7 + i); });
      const [x0, y0, x1, y1] = d.bbox;
      mesh = new THREE.Mesh(new THREE.PlaneGeometry((x1 - x0) / 100, (y1 - y0) / 100), variants[keys[0]].solid);
      mesh.position.set(((x0 + x1) / 2 - d.pivot[0]) / 100, ((y0 + y1) / 2 - d.pivot[1]) / 100, 0);
      mesh.castShadow = true; mesh.receiveShadow = false;
      mesh.customDepthMaterial = variants[keys[0]].depth;
      mesh.renderOrder = order;
      g.add(mesh);
    } else mesh = new THREE.Mesh();
    parts[d.name] = { def: d, group: g, mesh, variants, current: d.variants ? Object.keys(d.variants)[0] : "base" };
    order++;
  }
  // z layering & hierarchy (z is absolute in the root plane; convert to parent-relative)
  for (const d of DEFS) {
    const p = parts[d.name];
    const pz = d.parent ? DEFS.find((q) => q.name === d.parent)!.z : 0;
    p.group.position.z = d.z - pz;
    (d.parent ? parts[d.parent].group : root).add(p.group);
  }
  // headlamp anchor + aim (in head space), eye-line anchor for cameras
  const lampAnchor = new THREE.Object3D(); lampAnchor.position.set((-13.6 - 0.5) / 100, (175.5 - 150) / 100, 0.06);
  const lampDir = new THREE.Object3D(); lampDir.position.set(-1.0, -0.15, 0.55); lampAnchor.add(lampDir);
  parts.head.group.add(lampAnchor);
  const eyeAnchor = new THREE.Object3D(); eyeAnchor.position.set((-6 - 0.5) / 100, (164.5 - 150) / 100, 0.02); parts.head.group.add(eyeAnchor);
  // contact shadow (multiply blob) under the boots, lives in the root (ground plane)
  const cc = canvas(128, 64), g = cc.getContext("2d")!;
  const gr = g.createRadialGradient(64, 32, 2, 64, 32, 60); gr.addColorStop(0, "rgba(0,0,0,0.85)"); gr.addColorStop(0.5, "rgba(0,0,0,0.45)"); gr.addColorStop(1, "rgba(0,0,0,0)");
  g.save(); g.scale(1, 0.5); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); g.restore();
  const blobTex = toTex(cc, { srgb: false });
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.34), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, color: "#3a2c55", blending: THREE.MultiplyBlending, premultipliedAlpha: true }));
  (contact.material as THREE.MeshBasicMaterial).blending = THREE.CustomBlending;
  const cm = contact.material as THREE.MeshBasicMaterial;
  cm.blendEquation = THREE.AddEquation; cm.blendSrc = THREE.ZeroFactor; cm.blendDst = THREE.OneMinusSrcAlphaFactor; cm.opacity = 0.85;
  contact.rotation.x = -Math.PI / 2; contact.position.set(-0.07, 0.004, 0.0); contact.renderOrder = 5;
  root.add(contact);
  return { root, parts, lampAnchor, lampDir, eyeAnchor, contact };
}

export function setVariant(p: Part, k: string, mode: "solid" | "bp") {
  const v = p.variants[k] ?? p.variants[Object.keys(p.variants)[0]];
  if (!v) return;
  p.current = k;
  p.mesh.material = mode === "bp" ? v.bp : v.solid;
  p.mesh.customDepthMaterial = v.depth;
}

// ---------- poses ----------
// Angles in degrees, rotation about the card normal. Positive = counter-clockwise on screen (a hanging arm swings
// back, since Rafa faces screen-left). Elbow flexion is therefore negative. Legs are solved by 2-bone IK so the
// boots stay planted and flat whatever the hips do.
export type Pose = {
  rootY: number; rootX: number; // hip offset, cm
  torso: number; head: number;  // + = bow forward
  armF: number; foreF: number; handF: number; armN: number; foreN: number; handN: number;
  breathe: number;              // torso scaleY offset
};
export const POSES: Record<string, Pose> = {
  idle:   { rootY: -1,  rootX: -3, torso: 5,  head: 13,  armF: 6,    foreF: -14, handF: 2,   armN: -10, foreN: -42,  handN: 14,  breathe: 0 },
  alarm:  { rootY: -2,  rootX: 2,  torso: -7, head: -17, armF: -78,  foreF: -48, handF: -22, armN: -28, foreN: -108, handN: -14, breathe: 0 },
  brace:  { rootY: -13, rootX: 1,  torso: 9,  head: -9,  armF: -78,  foreF: -32, handF: -10, armN: 52,  foreN: -34,  handN: 0,   breathe: 0 },
  relief: { rootY: -2,  rootX: 0,  torso: 5,  head: 9,   armF: 3,    foreF: -8,  handF: 2,   armN: -12, foreN: -40,  handN: 4,   breathe: 0 },
};
export const mixPose = (a: Pose, b: Pose, t: number): Pose => {
  const o = {} as Pose;
  (Object.keys(a) as (keyof Pose)[]).forEach((k) => { o[k] = a[k] + (b[k] - a[k]) * t; });
  return o;
};
const D = Math.PI / 180;
function legIK(rig: Rig, thigh: string, shin: string, boot: string, hip: Pt, ankle: Pt) {
  const L1 = 39, L2 = 42;
  const vx = ankle[0] - hip[0], vy = ankle[1] - hip[1];
  const d = Math.min(L1 + L2 - 0.01, Math.hypot(vx, vy));
  const a = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
  const base = Math.atan2(vy, vx);
  const tA = base - a; // knee forward (screen-left)
  const kx = hip[0] + Math.cos(tA) * L1, ky = hip[1] + Math.sin(tA) * L1;
  const sA = Math.atan2(ankle[1] - ky, ankle[0] - kx);
  const rest = -Math.PI / 2;
  rig.parts[thigh].group.rotation.z = tA - rest;
  rig.parts[shin].group.rotation.z = sA - tA;
  rig.parts[boot].group.rotation.z = -(sA - rest);
}
export function applyPose(rig: Rig, p: Pose) {
  const P = rig.parts;
  P.root.group.position.set(p.rootX / 100, (92 + p.rootY) / 100, 0);
  P.torso.group.rotation.z = -p.torso * D;
  P.torso.group.scale.set(1, 1 + p.breathe, 1);
  P.head.group.rotation.z = -p.head * D;
  P.armF.group.rotation.z = p.armF * D; P.foreF.group.rotation.z = p.foreF * D; P.handF.group.rotation.z = p.handF * D;
  P.armN.group.rotation.z = p.armN * D; P.foreN.group.rotation.z = p.foreN * D; P.handN.group.rotation.z = p.handN * D;
  legIK(rig, "thighF", "shinF", "bootF", [-8.6 + p.rootX, 90 + p.rootY], [-9, 9]);
  legIK(rig, "thighN", "shinN", "bootN", [8.4 + p.rootX, 90 + p.rootY], [9, 9]);
}
export const shadeHex = shade;
