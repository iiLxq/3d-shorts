# TOY — Precision Miniature (lab concept notes)

## Concept (3 lines)
Every Fail-Safe File is shot as a **museum-grade cut-away scale model** with a **ball-jointed designer-collectible** cast.
The front wall is sectioned away like an exhibit, so the camera can always see the machine *and* the person on it.
The three signature states are three editions of the same collectible: the design drawing (BLUEPRINT), the clear-resin variant (X-RAY) and the painted figure (SOLID).

## Character spec — "TECH 07" (the recurring person at risk)
- **Proportions:** 1.63 m (scaled ×1.1 in scene) = **4.0 helmet-heads** (4.6 bare heads). Chunky barrel torso (widest at the shoulders, 0.86 taper to the waist), short sturdy limbs, big boots, mitten gloves with a sculpted thumb and two finger grooves.
- **Silhouette signatures:** domed hard hat with ridge, wide brim and front **headlamp** (emissive lens + spot light + faint volumetric cone); **chunky sculpted moustache**; amber hi-vis jacket with **raised retro-reflective bands** (separate geometry that follows the jacket surface, slight emissive lift); tool belt with pouches, tape and hammer; **visible satin-grey ball joints** at neck, shoulders, elbows, wrists, hips, knees, ankles.
- **Construction:** every part is a "sculpt" — a superellipsoid with taper / lean / bulge / per-direction displacement (`sculpt.ts`), so nothing is a raw primitive; bands, cuffs and stripes are surface-following strips (`band()` in `figure.ts`).
- **Face:** sculpted skull (eye sockets, cheeks, brow ridge, chin, temples by displacement), inset glossy eyeballs with iris/pupil caps (catchlights from clearcoat), **separate rigid upper/lower lid shells** with lash line, separate brow pieces, **swappable sculpted mouths** (calm crescent / alarm "O" with teeth + tongue / relief open grin). 3 expressions = presets of lid angles, brow height/tilt, gaze, mouth id (`EXPR`).
- **Palette:** jacket `#F2A21A` lit to brand amber, pants `#2E3644`, joints `#565B63`, gloves `#3B3F46`, boots `#6E4A2C`, helmet `#ECE7DC`, skin `#C49A80`. Amber is reserved for this figure.
- **Rig:** plain joint hierarchy (no skinning): hips > spine > neck > head; shoulder > elbow > wrist; hip > knee > ankle. Poses are Euler tables blended per frame; feet are planted automatically (lowest sole pinned to the roof); contact shadows follow the soles.
- **Movement style:** posed-figure acting — clear key poses (work → startle with overshoot → brace crouch → relief), quick 4–6 f attacks with easeOutBack, held poses with breathing + blinks, impact dip on the clamp frame.

## Environment / material / lighting / camera recipe
- **Model:** cut-away shaft (front wall removed, lighter concrete section faces + slab sections), formwork concrete back wall with tie holes, pour lines, rust tears and water stains; CMU side walls; T-section guide rails in 5 m lengths with fishplates, L-brackets, clips and instanced bolts; landing doors (hoistway side) with header/track/rollers/interlock, aluminium sill, stencilled floor numbers and warm light leaks; counterweight with filler plates; cable tray; caged bulkhead lights; car with checker-plate roof, crosshead, stiles, guide shoes, rope hitch (rods, springs, nuts, sockets), balustrade, door operator, inspection box, toolbox, spanner, work lamp on a mast, red alarm beacon. **Safety gear** at each rail: housing with cut-away window and two **safety-green wedge jaws** (emissive), lifted by the governor lever.
- **Textures:** all code-painted, seeded (`paint.ts`): colour + matching bump canvases (concrete, blocks, checker plate, chipped paint, rope strands, brushed-metal roughness, vinyl brush strokes, sprayed stencils with bridges + wear).
- **"Painted miniature" shading** (`materials.ts › toyPaint`): three PBR + injected wrap diffuse with a fake-subsurface terminator tint (skin/vinyl), and a **screen-space curvature pass** that dry-brushes convex bevels lighter and darkens creases — the hand-finished collectible look, on every mesh, no extra pass.
- **Light (all motivated):** warm work-lamp spot (only shadow caster, PCF soft 1536²), warm roof bounce, cool LED headlamp spot + cone, warm landing leaks (point + additive pools), red alarm beacon (point, pulsing), cool front/top fill, cool spot on the left safety gear, procedural PMREM "studio" env for metal reflections (no HDRI). Fog = dark blue shaft air.
- **Post** (`post.ts`): MacroLens = own depth-based CoC gather (40 Vogel taps, near-sharp-sample rejection) + a screen-y tilt band → miniature DOF; mip bloom on HDR emissives only (threshold 1.0); Khronos Neutral tone map; grade with gentle S-curve, lifted blacks, cool-shadow/warm-highlight split, light vignette, deterministic grain; clamp flash in the grade.
- **States** (`states.ts`): BLUEPRINT = navy Fresnel fill + fat cyan edge lines (`LineSegments2`, HDR → bloom) + section contour lines sliced from the figure meshes + constant-pixel silhouette hull + world-space grid walls (parallax, not a screen overlay) + labels. X-RAY = clear-resin variant: amber resin figure with its **steel armature rods and ball joints visible inside**, cyan resin car shell, ghosted environment, solid rails/ropes/gear, red force arrows. SOLID = painted model.
- **Camera:** 33° vertical, 3/4 from the cut-away side, slow eased push-in (smootherstep), follows the falling car with first-order lag, decaying shake on snap/clamp.

## Render time (swiftshader, 4 shared CPUs, 540×960, MSAA 4)
- Motion (90 f, 540×960, MSAA 4, 40-tap DOF, bloom, 1 PCF shadow map 1536²): **246 s total incl. bundle + scene build ≈ 2.7 s/frame (≈ 2.4 s steady state)**. Previous iteration 317 s (3.5 s/f) while another agent shared the CPU.
- Stills: 7–12 s each, of which ~5 s is per-page scene build (textures painted in Canvas2D + shader compile); `tools/stills.mjs` reuses one bundle + one browser.
- Cost drivers (not profiled pass by pass yet): MSAA 4 resolve, DOF gather, shadow map. Cheap wins: MSAA 2, DOF 24 taps on wides.
- dpr is forced to the render scale (R3F otherwise renders 1080×1920 and downsamples).

## Measured (scripts/frame_metrics.py --stills, 540 wide)
Final 7 board stills vs audit reference (ours v1 → TOY → reference):
| metric | video #1 | TOY | ref |
|---|---|---|---|
| empty 16 px blocks | 0.86 | **0.34** | 0.54 |
| edge density | 0.016 | **0.053** | 0.058 |
| texture energy | 0.71 | **2.18** | 1.80 |
| colourfulness | 33 | **76** | 69 |
| lit C* p90 | 29 | 51 | 51 |
| shadow b* / highlight b* | −14.9 / −13.4 | **−14.4 / +31.7** (warm/cool split; highlights a bit too warm) | −5 / +6 |
| luma p50 / p99 | 0.21 / 0.81 | 0.21 / 0.78 (too dark, no near-whites) | 0.33 / 0.95 |
| near-black % / clipped % | 2.5 / 0.00 | 1.9 / 0.0 | 0.5 / 0.38 |
| vignette corner/centre | 0.79 | 0.53 (dark shaft edges) | 0.68 |
| dark-line density | 0.002 | 0.028 | 0.024 |
Motion clip (frame_metrics on the 1.9 Mbps encode): hold/drift/move 11/23/66 %, 89 % of frames moving, quiet push-in 0.086 %/f (target ≥ 0.12), jerk/speed 0.18 (target ≤ 0.08, the shake + fall lag), 0 hard cuts. **Compression: PSNR 1.9 Mbps vs CRF16 master = 36.2 dB mean, 34.2 dB min** (no banding seen; grain is light).

## Honest strengths
- **States carry best of the four ideas I could see:** the same meshes give a dense, bloom-lit BLUEPRINT (edges + section contours + hull + parallax grid walls) and a genuinely ownable **X-RAY = "clear-resin collectible variant"** where the figure's steel armature and ball joints show inside the amber shell. This is a product idea, not a filter.
- Cut-away museum model solves the vertical framing: walls/doors/rails fill the frame edge to edge (empty blocks 0.34 vs 0.86 before), and the camera can always see person + machine.
- Faces read at phone size: 3 expressions from lids/brows/mouth swaps, glossy inset eyes with catchlights, signature moustache + headlamp silhouette.
- Integration: one shadow-casting work lamp + contact blobs + bounce = feet sit on the roof; warm key / cool fill split is measurable.
- Everything is code: seeded textures, sculpt geometry, no downloads, deterministic, ~2.5 s/frame at preview res.

## Honest weaknesses
1. **Mechanism readability (worst):** the safety gear is seen from the front, so the two jaws stack in depth and read as a green square at the frame edge; the clamp is sold by glow + flash + sparks, not by visible motion. The rope snap happens behind/next to the figure and is only a spark puff. An explainer needs a dedicated side-on insert of the blade between the jaws.
2. **Character silhouette sits close to a peg-doll / Playmobil-like read** (round head under a hard hat, moustache, stiff limbs). Ball joints help, but the body is a stack of capsules; arms are posed by Euler tables without IK, so hand placement (rail grip) is approximate and poses look stiff, especially "relief".
3. **Exposure:** median luma 0.21 and p99 0.78 — the hero is dim and the shaft edges fall off (vignette 0.53); highlights are too warm (b* +32). No motion blur on the free-fall, so landings strobe.
4. Brows ride under the helmet brim when raised (alarm brows had to be lowered), limiting the expression range.
5. Tilt-shift DOF is subtle on the wide shots; it reads as "soft background" more than "miniature".
6. X-ray resin uses sorted transparency; overlapping shells (car + walls) can look milky.

## What it would take to reach premium
- Mechanism inserts: a side-on macro shot of the rail blade with the two wedges sliding up/in (designed-for-camera housing with an acrylic window), wear marks appearing on the blade, governor rope + lever in the same frame. Mechanism-first shot list.
- Character: second sculpt pass (asymmetric jaw, ear/hair detail, thicker gloves with a real 3-finger hand, jacket folds by displacement), simple 2-bone IK for hands/feet, 8–10 more expressions (squint, wince, shout, smirk), eyelid shape per expression; tune head:body to 1:3.6 for a less "peg" read.
- Light/grade: raise mid exposure (target luma p50 ≈ 0.3), add a cool practical pool on each side wall, cool down highlight b*, small specular sparkle on metals to reach p99 ≈ 0.9; per-shot DOF table with a stronger tilt band on wides; vertical motion blur for the fall (velocity from carY).
- Optional CC0 Poly Haven concrete/metal scans as detail maps under the painted textures.

## Scaling to a character library + new locations
- **Character library:** `figure.ts` is parametric: proportions (sculpt half-extents), palette, head accessories (helmet/cap/hair), face parts (moustache, glasses), mouth set and pose tables are data. New cast = new palette + 2–3 swapped parts, same rig and expression presets; amber stays reserved for the person at risk, other people get desaturated jackets. The ball-joint rig needs no skinning, so poses transfer between all figures.
- **Locations:** the shaft is built from reusable kit pieces (cut-away section walls, formwork concrete, block walls, rails/brackets/bolts, doors, practical lights, decals/stencils, cable trays). Other Fail-Safe topics (cable car grip, train brake, crane limit switch, plane RAT) reuse the cut-away + scale-model lighting recipe; only the hero mechanism is new geometry.
- **Consistency:** one material system (`toyPaint` curvature + wrap), one post chain, one state builder (`states.ts` works on any tagged mesh), one grade → every episode looks like the same collectible line.

## Self-review log
- **Round 0–1** (sheet `round1`): orange monochrome + over-exposed jacket (lamp 9 cd, SSS), figure facing away, hero too tight then too wide, door light-leak "T" dominating, blueprint ropes merged into one bar, x-ray door glows washing the frame, mouth hidden by the moustache, safety gear illegible at the frame edge. Fixed: lamp 3 cd neutral-warm, cool front fill, cooler concrete, thicker legs/arms + cargo pockets, rope hull → single axis line, glows hidden in x-ray, 1.6× safety gear moved to roof level with a cool spot, reframed hero/motion, flash 0.85 → 0.42, camera lag as first-order follow.
- **Round 2** (sheet `round2` + motion sheet): brows hidden under the brim, alarm mouth hidden, snap not readable behind the figure, jaws always bright. Fixed: brows lowered + helmet raised, mouth lowered, figure moved left/forward to clear the rope hitch, jaw glow baseline 0.1 → clamp spike 8.9, bigger sparks. Remaining issues listed under weaknesses (not fixed).

## Self-scores (1–10, builder-biased)
Originality 6 · premium at phone size 6 · character appeal/expressiveness 7 · integration 7 · lighting richness 7 · material credibility 6 · mechanism readability 4 · fit with states + colour code 8 · motion 6 · production feasibility 8 · compression robustness 8.

## How to render
```
cd remotion
TMPDIR=<scratch>/rtmp node src/lab/toy/tools/stills.mjs <outDir> ToyHero:0 ToyFaces:0,1,2 ToyStates:0,1,2
npx remotion render src/lab/toy/index.ts ToyMotion <out.mp4> --gl=swiftshader --scale=0.5 --concurrency=1
```
Board: `python3 -I <scratch>/lab/toy/tools/board.py <stillsDir> docs/lab/toy/board.jpg`.
