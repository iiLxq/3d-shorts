# Paper Case-File v2: lab plan (approved for lab experiments, not production)

Approved by the user: Paper Case-File stays the direction, Gus stays the character (Option A). Experiments must be ambitious, and comparisons must be rendered. Nothing is merged into production without the user's review. Authoritative instructions: `docs/MASTER_INSTRUCTIONS.md`. Proposal: `docs/lab/paper/PROPOSAL.html`.

## Preservation
- `remotion/src/lab/paper/**` and `docs/lab/paper/**` (except `PROPOSAL.html`) are the v1 baseline. They are **read-only**, and every before/after compares against them.
- All other labs (`engraving`, `toy`, `noir`, `hybrid/**`) are archived references and read-only. Technique code may be copied from them into your own folder.

## Ownership (one owner per path)
| Path | Owner | Model |
|---|---|---|
| `remotion/src/lab/paper-v2/**` except `gus/` + `docs/lab/paper-v2/world/**` | World & Look lab | Opus |
| `remotion/src/lab/paper-v2/gus/**` + `docs/lab/paper-v2/gus/**` | Gus lab | Opus |
| `remotion/src/lab/subtitles/**` + `docs/lab/subtitles/**` | Subtitle lab | Sonnet |
| `docs/lab/paper-v2/PLAN.md`, `REVIEW_*.md`, integration | Director | Opus |

Entries: `paper-v2/index.ts` (world, ids `PaperV2*`), `paper-v2/gus/index.ts` (ids `Gus*`), `subtitles/index.ts` (ids `Sub*`). Renders go to the scratchpad `lab/v2/<lab>/`. No git commits by agents; the director commits.

## Gus contract (Gus lab provides `paper-v2/gus/api.ts`; the World lab integrates it at the end)
```ts
export function buildGus(opts?: { view?: "auto" | "front" | "threeQuarter" | "profile"; method?: "replacement" | "vfold" }): Gus;
interface Gus {
  root: THREE.Group;                      // feet at y=0, facing +z, 1 unit = 1 m
  setPose(p: GusPose): void;              // named poses + blends
  setExpression(e: GusExpr, w?: number): void;
  update(frame: number, camera: THREE.Camera): void; // turning method + camera-responsive lean live here
  setState(s: 0 | 1 | 2): void;           // blueprint | x-ray (vellum) | solid
  lampAnchor: THREE.Object3D;             // headlamp
}
```
Until `api.ts` exists, the World lab keeps the v1 puppet (`paper-v2/puppet.ts`) as a stand-in.

## Shared rules
- Brand colours stay exact (amber #FFB020, safety green #39FF88, red #FF3B3B, cyan #35D7FF, navy #0B1A33). `lab/hybrid/look/colors.ts` has a tested `untone()` you may copy.
- No full-frame white flash. Glows are local.
- Measure with `python3 -I scripts/frame_metrics.py`. Targets: near-black ≤ 2 %, p99 ≥ 0.9, shimmer ≤ 15 %, camera jerk/speed ≤ 0.08, SSIM ≥ 0.90 at delivery bits-per-pixel.
- Previews render at true half resolution (`dpr = scale`), concurrency 1. At least 2 representative 1080 stills before a lab reports.
- Safe zones: subtitle band y 1250–1450, bottom 20 % (y > 1536) and the left meter strip (x < 140 px).
- Tests use only approved channel text or our own video #1 narration (`videos/01_ram_air_turbine`). Never use the user's old CapCut draft narration.
