# Hybrid direction: "Lamplit Gouache" (working name), test-animation plan

**Decision (director, from REVIEW_ART + REVIEW_TECH):** build on the Gouache concept, the best on both art (6.5) and technical (39/60) review. Fix what made every concept read as cheap, and borrow the strongest single idea from each of the others:

| From | Keep |
|---|---|
| Gouache (noir) | Painted value-step shading, coloured shadows (teal/violet, never black), haze and light shafts, adult cast with real acting, warm lamp vs cool ambient. |
| Toy | Real 3D sculpted characters (no flat cards → any camera angle), joint-hierarchy rig, the shaft set density and practical lights, **X-RAY as clear resin** (see-through shells revealing the mechanism inside). |
| Engraving | **Patent-drawing language for BLUEPRINT only**: `FIG. 1`, numbered leader lines, hand-lettered callouts, cyan on navy. Sepia engraved plate for the history tag later. |
| Paper | Character warmth/appeal targets (big readable expressions at phone size). |

Not carried over: flat cut-out characters, full-frame hatching, halftone, peg-doll/Playmobil figure language, moustache "everyman", full-frame white flashes.

## Measurable targets (QA gates, checked with `scripts/frame_metrics.py`)
- Camera: quiet push-in ≥ 0.12 %/frame; jerk/speed ≤ 0.08; glides ≥ 20 frames ease-in/out; peak ≤ 25 px720/f; no false cuts; every shake decays within 12 frames.
- Tone: near-black ≤ 2 %; p99 luma ≥ 0.90 (real highlights/glints); no clipping of brand colours; warm-highlight/cool-shadow split present.
- Sharpness: subject region sharp (centre Laplacian ≥ 3× the noir lab clip); DOF only on background/foreground layers.
- Temporal stability: static paper/brush textures are **world/object anchored and not animated**; shimmer (pixels changing in still regions) ≤ 15 %.
- Brand colour: amber jacket lit area ΔE00 ≤ 5 vs #FFB020; green/red/cyan ΔE00 ≤ 5.
- Clamp flash: **local** glow on the jaws + bloom; full-frame luma change ≤ 0.08.
- Compression: SSIM ≥ 0.90 at delivery bits-per-pixel (540×960 @ 475 kbps ≈ 1080×1920 @ 1.9 Mbps).
- Render: ≤ 3 s/frame at 1080×1920 or ≤ 1.5 s/frame at 540×960 + upscale.
- Layout: left edge (x < 140 px at 1080) free for the danger meter; nothing important at y 1050–1350 or y > 1536.

## Module ownership (remotion/src/lab/hybrid/)
| Folder | Owner | Notes |
|---|---|---|
| `base/` | nobody (read-only) | Frozen copy of the Gouache lab (engine, world, character, shade, paint): reference only. |
| `look/` | Look & Lighting TD | `shade.ts` (gouache material + shared uniforms + states), `paint.ts` (textures), new `post.ts` (grade/bloom/DOF/grain), `colors.ts` (exact brand colours). **API is additive only:** `gouache(opts)`, `U`, `BRAND`, `initShared()` keep working; never break a build (typecheck after every edit). |
| `cast/` | Character TD | Reusable spec-driven character builder + rig + painted faces. Imports `../look/*` read-only. |
| `set/` | Set & Mechanism TD | Shaft, car, rails, ropes (snap), safety gear designed for camera, practicals. Imports `../look/*` read-only. |
| `shots/` | Director/Animation agent (phase 2) | Engine, timeline, camera, overlays (labels, meter), the `HyTest` composition. Imports everything read-only. |

Each folder has its own entry `hybrid/<m>/index.ts` for standalone tests (composition ids prefixed `Hy<Module>`). No agent edits another's folder; requests go to the director. No git commits by agents. Render outputs → scratchpad `lab/hybrid/<m>/`.

## Interfaces (phase-1 contracts)
```ts
// cast/index of API (cast/character.ts)
export type CharacterSpec = { id: string; heightM: number; heads: number; build: "slim"|"average"|"broad";
  skin: string; hair: {style: string; color: string}; outfit: {...}; accessories: string[]; palette: Record<string,string> };
export function buildCharacter(spec: CharacterSpec): Character;
interface Character { root: THREE.Group; joints: Record<JointName, THREE.Object3D>;
  setPose(p: Pose): void; setExpression(e: ExprName, weight?: number): void; setBlink(t: number): void;
  setGaze(x: number, y: number): void; footIK?(targets): void; handIK?(side, target): void;
  setState(s: 0|1|2): void /* blueprint | x-ray resin | solid */; lampAnchor?: THREE.Object3D; }
export const RAFA: CharacterSpec;     // first recurring cast member (the technician)
// set/shaft.ts
export function buildShaft(): Shaft;
interface Shaft { group: THREE.Group; car: THREE.Group; carRoofY: number; charSpot: THREE.Vector3;
  setRopeSnap(t: number): void; setCarDrop(y: number): void; setGearClamp(t: number): void; setAlarm(on: number): void;
  setState(s: 0|1|2): void; anchors: Record<string, THREE.Object3D> /* camera targets: gear, rail, ropeTop, lamp… */;
  lights: THREE.Light[]; }
```

## Test animation (phase 2, ~10 s, 300 frames, no VO)
1. 0.0–2.5 s BLUEPRINT patent plate of shaft + car (`FIG. 1`, numbered callouts), slow push down the shaft → print-sweep into SOLID gouache.
2. 2.5–5.0 s Rafa at work on the car roof (headlamp, idle, looks up); a hoist rope visibly snaps above; red beacon; Rafa alarmed; car lurches (decaying shake). Meter rises on the left.
3. 5.0–6.8 s X-RAY resin: the camera travels (no hard cut) down the rail to the safety gear; red force arrow.
4. 6.8–8.5 s Side-on insert: oversized wedge jaws ride up and bite the rail; **local** green glow, sparks; 0.5 s freeze + short slow-mo replay; meter crashes to green on the clamp frame.
5. 8.5–10 s Glide back to Rafa: relieved exhale, warm light settles.
