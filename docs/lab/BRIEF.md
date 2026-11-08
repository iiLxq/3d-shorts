# Phase 1 Lab — Art-direction experiments (brief)

Goal: find an **original, premium, ownable** look for Fail-Safe Files. Every concept renders the **same test scene** so they can be compared fairly. These are experiments, not a video.

## Originality rules (hard)
Do **not** reproduce: the realistic-Blender "Zack D Films" look (scanned humans, realistic skin); the reference repo / tutorial-2 look (flat 2D cartoon characters with black comic-ink outlines on a saturated daylight 3D world, egg/round heads with thin limbs); Kurzgesagt-style flat vector; generic Pixar/Mixamo/AI-3D characters. Techniques (measuring, ink passes, painted textures, lighting principles) are fine to reuse; their look is not. `references/external/` is private study only.

## Test scene (same for every concept)
**Elevator shaft, night.** A maintenance technician (our recurring "person at risk": **amber** high-vis jacket, helmet with headlamp, tool belt) stands on the roof of an elevator car inside a tall shaft. Concrete/brick shaft walls with floor-landing openings that leak a little light, steel guide rails with brackets, hoist ropes going up into darkness, the car's top work-lamp. The fail-safe is the car's **safety gear**: two brake jaws that clamp the guide rail and glow **safety-green #39FF88**. Danger/force = **red #FF3B3B**. Structure lines = **cyan #35D7FF**. Navy **#0B1A33** is our base. Lighting must be motivated (work-lamp, headlamp, landing light, a red alarm practical).

## Deliverables per concept (1080×1920 compositions, render at 0.5 scale unless noted)
1. **Hero** — establishing 3/4 view, character on the car roof in the shaft (full "SOLID" look).
2. **Faces** — character head-and-shoulders in 3 expressions: calm, alarmed, relieved (3 frames).
3. **States** — the hero frame in our three signature states: BLUEPRINT (navy + cyan line art), X-RAY (translucent shells, red force arrow), SOLID. Show how your look carries them.
4. **Motion** — 90 frames (3 s) at 540×960: slow eased push-in, character idle → alarm reaction, rope snap → jaws clamp with a light flash on the clamp frame. Encode H.264 `-b:v 1900k` (our phone bitrate) so compression robustness is visible.
5. **Notes** `docs/lab/<concept>/NOTES.md` — concept statement (3 lines), character design spec (proportions in heads, silhouette, face construction, palette, rig/expression method, movement style), environment/material/lighting/camera recipe, render time per frame, honest strengths & weaknesses, what it would take to reach premium, and how the concept scales to a reusable character library + new locations.
6. One **board** image `docs/lab/<concept>/board.jpg` (≤ 400 KB): hero + faces + states side by side.

## Self-review before reporting (mandatory, at least 2 rounds)
Render → look at your frames (one contact sheet at 0.5 scale) → measure with `python3 scripts/frame_metrics.py` if it exists → list concrete defects (floating feet, missing contact shadows, flat light, clutter, illegible mechanism, aliasing/shimmer, banding, crushed blacks, clipped highlights, stiff pose) → fix → re-render. Don't call it good if it isn't.

## Evaluation criteria (reviewers score 1–10)
Originality/ownability · premium feel at phone size · character appeal & expressiveness · character–environment integration (light, shadow, contact) · lighting richness · material/texture credibility · mechanism readability (we are an explainer) · fit with the three signature states + color code · motion quality · production feasibility (render time on 4 CPUs/swiftshader, reusability, consistency) · compression robustness at 1.9 Mbps.

## File ownership (multi-agent rules)
- Concept agent `<c>` owns only `remotion/src/lab/<c>/**` and `docs/lab/<c>/**`. Its entry point is `remotion/src/lab/<c>/index.ts`; composition ids are prefixed with the capitalized concept name.
- Read-only for everyone: `remotion/src/videos/**`, `remotion/src/Root.tsx`, `remotion/package.json`, `scripts/**`, `assets/**`, `CLAUDE.md`, `docs/*.md`. Need a dependency? Ask the director; do not `npm install` into `remotion/`.
- Render outputs go to the scratchpad `…/scratchpad/lab/<c>/`, never into the repo (except the board + a few small jpgs in `docs/lab/<c>/`).
- Stills: `cd remotion && ENTRY=src/lab/<c>/index.ts TMPDIR=<scratch>/rtmp_<c> node scripts/stills.mjs <CompId> <outDir> <frames> 0.5`. Clips: `npx remotion render src/lab/<c>/index.ts <CompId> <out.mp4> --gl=swiftshader --scale=0.5 --concurrency=1`.
- CPU is shared by 4 agents: concurrency 1, no full-resolution renders.
- No git commits by agents; the director integrates.
