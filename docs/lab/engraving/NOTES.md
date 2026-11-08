# ENGRAVING: Living Patent Drawing (lab concept)

**Concept.** A 19th-century patent drawing that has come alive and is printed in spot inks. Navy key ink on warm paper does all of the shading as engraved hatching, driven by real 3D lights and shadow maps. Four fluorescent spot plates (cyan structure, red danger, safety-green fail-safe, amber person), slightly misregistered, carry the brand colour code exactly. The patent conventions are the brand's grammar: section lining on cut walls, dashed hidden lines in X-RAY, reference numerals with leader lines, and "FIG. n" titles.

Board: `docs/lab/engraving/board.jpg` · hero: `docs/lab/engraving/hero.jpg` · motion (540×960, 2-pass H.264 1900k):
`/tmp/claude-0/-home-user-3d-shorts/a8e2ed45-e668-5f73-979d-cde8a05003ef/scratchpad/lab/engraving/engraving_motion_1900k.mp4`
Code: `remotion/src/lab/engraving/` (entry `index.ts`, compositions `EngravingHero`, `EngravingFaces`, `EngravingStates`, `EngravingMotion`).

## Character: "Ray Calder", elevator technician
- **Proportions:** 5.4 heads (head chin-to-crown 0.33 m, 1.79 m to crown, 1.84 m with helmet). Shoulders 1.4 heads wide. Hands and boots run ~1.2× realistic so they read at phone size.
- **Silhouette:** a broad trapezoid hi-vis jacket that ends at the hip, a tool belt with two pouches and a hammer, dark work trousers with knee pads, chunky boots, and a domed helmet with a big round headlamp. The helmet + amber torso reads at thumbnail size.
- **Face construction:** a squarish jaw and slight 3/4 turn (features offset 12 mm to screen-left). The acting is carried by **tapered engraved brows** (inner and outer ends move independently). Almond eyes have paper sclera, an inked iris, a pupil and a paper catch-light on the key-light side. Details: nose bridge line + nostrils, nasolabial folds, mouth by expression, and stubble as fine stipple. Three expressions plus a blink: calm (half-lidded, small smile), alarmed (brows up and pinched, eyes 1.18× open with small pupils, open "O" with teeth, worry lines), relieved (eyes closed in soft arcs, pursed exhale, puffed cheek, sweat drop).
- **Palette:** amber `#FFB020` spot on the jacket only (= person at risk). Skin and helmet are bare paper shaded only by hatching. Trousers, gloves and boots are dark albedo, so they hatch denser. Reflective tape is bare paper with fine ink borders.
- **Rig:** a 2D cut-out of 16 parts (torso, pelvis, head, helmet, upper/fore-arm, hand ×2, thigh, shin, boot ×2) on quads with pivots, rotated in the card plane. Poses are tables (`idle`, `alarm`, `relieved`) blended per frame, with breathing, anticipation and overshoot. The head texture swaps per expression; a blink frame hides each swap.
- **How he sits in the world:** each part is drawn in Canvas2D as **data channels** (R = ink lines, G = amber coverage, B = albedo, A = silhouette), plus a **pillow normal map** from a distance transform. The same patched Phong shader as the set therefore lights him with the scene's lamps and hatches him by that light. Lit parts are bare paper; the side away from the work lamp gets single, then cross-hatching. A yaw-to-light "shadow twin" (an invisible copy of the rig) casts his silhouette into the work-lamp shadow map, so his shadow on the roof and back wall is **hatched**, not grey. Feet positions feed a hatched contact-darkening term in the roof shader.
- **Movement style:** cut-out pose-to-pose with eased blends, a 2-frame lead before reactions, a small anticipation dip and overshoot. The yaw-only billboard faces the camera.

## Environment / material / lighting / camera recipe
- **Ink shader** (`ink.ts`): MeshPhong is patched via onBeforeCompile. The lit result becomes tone T = 1 − exp(−k·lum). Up to three hatch directions (base angle, +66°, −54°) add in as darkness rises, and **tone sets line width** (the engraver's swelling line), not line count.
- **Hatch stability:** coordinates are object-space (dominant-axis planes; UV for ropes and figure), so lines stick to surfaces with no "shower door". Each pixel picks a power-of-two line period from screen derivatives and cross-fades the odd lines, so on-screen spacing stays ≈ 17 px at 1080 at any distance. Lines are analytically anti-aliased.
- **Materials as engraving marks:** brick courses with per-brick tone, board-formed concrete with seams, tie holes and grain, diamond tread plate, helical wire-rope strands, riveted panels. Wall cut faces use 45° **section lining**. Far planes print lighter (aerial perspective in the composite, stronger in close-ups to quiet the background).
- **Post** (`engine.ts`, raw three.js, no R3F): one MRT pass (ink/spot/id/glow + normal/depth), then contour and crease lines from depth/normal (near side only, 3.2 px silhouettes at 1080), procedural paper (mottling + fibres), four spot plates at fixed 1–1.3 px misregistration (opaque, so brand hex lands exactly), and key ink overprinting spot colour. Glow is a 2-level blur of emissive spot ink plus a mild vignette and flash.
- **Lighting (all motivated):** the car-top work lamp is the key and the only shadow map. Also: a cool landing-door spill, the headlamp spot (aimed where Ray looks), the red beacon (red light prints as a **red spot-ink wash** on lit surfaces), a cool bounce fill, and leaking light through landing-door gaps (glow).
- **Camera:** one-axis smootherstep push-in over the clip that tracks 60 % of the car drop, with a decaying 9-frame shake on the clamp.

## States
- **BLUEPRINT:** navy paper, cyan-white key ink, glowing lines. Hatching is cut to a faint single direction in the darkest areas, plus an object-anchored 0.5 m drafting grid. Amber and other spot inks are off; only green and red stay available.
- **X-RAY:** the car shell and safety-gear housings vanish and are replaced by **dashed hidden lines** (world-anchored dash geometry, the patent convention). The environment prints at about 40 % ink. Red force arrows show rope tension up and the fall down; green arrows mark the clamp.
- **SOLID:** full engraving + spot colours; the jaws glow green.
- All states use the same scene and shader; only uniforms change. The patent labels (FIG. n, numerals 12/14/16) work in every state.

## Render cost (swiftshader, 4 shared CPUs, concurrency 1)
- Motion: 90 frames at 540×960 in **85 s including bundle**, about **0.6 s/frame**. Stills take 2.4–3.6 s each, including page setup.
- 1080×1920 is not measured (not allowed); I estimate ~2–2.5 s/frame (4× pixels; the composite runs ~20 taps/pixel).
- The buffer follows `devicePixelRatio`, so `--scale 0.5` really renders 540×960.

## Measured (frame_metrics, compare docs/research/pipeline_audit.md)
| metric | video #1 | reference | engraving stills | engraving motion |
|---|---|---|---|---|
| empty 16 px blocks | 0.86 | 0.54 | **0.10** | 0.04 |
| colourfulness | 33 | 69 | **59** | 47 |
| shadow b* / highlight b* | −14.9 / −13.4 | −5.1 / +6.3 | **−2.6 / +7.5** | −3.7 / +4.8 |
| luma p50 / p99 | 0.21 / 0.81 | 0.33 / 0.95 | 0.67 / 0.92 | 0.60 / 0.92 |
| near-black % / clipped % | 2.5 / 0.00 | 0.5 / 0.38 | 2.3 / 0.15 | 0.3 / 0.05 |
| edge density | 0.016 | 0.058 | **0.33** (6× ref) | 0.69 @270 px |
| texture energy | 0.71 | 1.80 | 3.8 | 5.3 |
| lit chroma C* p90 | 29 | 51 | **20** (paper is neutral) | 22 |
| vignette corner/centre | 0.79 | 0.68 | 0.71 | 0.62 |

Motion: quiet push-in 0.145 %/f (ref 0.14), zooming 80 % of frames, jerk/speed 0.087 (target ≤ 0.08), no cuts, no static run ≥ 6 f.

## Compression robustness (the critical risk), measured honestly
- 2-pass H.264 at **1900k on 540×960**: SSIM 0.893, PSNR 25.4 dB vs the CRF-10 master. Hatching is visibly kept; fine wall hatching softens.
- **Stress test at 475k on 540×960** (the same bits per pixel as delivering 1080×1920 at 1.9 Mbps): SSIM 0.79, PSNR 20.6 dB. The figure, contours, spot colours and the jaws survive; **large hatched wall fields block up and smear** during the push and fall.
- Moving the hatch period from 14 to 17 px changed SSIM by < 0.002. The cost comes from the *amount* of hatched area, not the line pitch.
- Object-space anchoring + octave cross-fade means no shower-door and no popping. Remaining shimmer is mild line crawl on oblique planes when the camera moves fast (snap/fall frames).
- Edge density at 6× the reference is the root cause. This look is inherently expensive for the encoder.

## Strengths
- Highly ownable: nothing on Shorts looks like a live patent engraving, and the conventions (section lining, hidden lines, FIG. numbers, reference numerals) are a brand vocabulary that doubles as explainer grammar.
- One shader serves all three signature states. Brand colours are exact (opaque spot plates). The audit's top failures are fixed: no empty frames, rich texture, warm/cool split, a character on screen.
- The character truly lives in the light: hatching follows the scene lamps, and his shadow is hatched by the same shadow map as the set.
- Cheap: about 0.6 s/frame preview, no bloom/MSAA needed (lines are analytically anti-aliased).

## Weaknesses (honest)
1. **Compression at delivery bitrate:** big hatched planes smear at 1080 @ 1.9 Mbps-equivalent. It needs more bare paper and solid spot areas, and fewer cross-hatched fields.
2. **Mechanism readability:** the safety gear is small and at the frame edge in the hero. The jaw motion (7 cm up) is hard to see at 540 without an insert close-up. The busy hatched set competes with it.
3. **Character polish:** the cut-out joints are visible (elbows and knees are separate quads). The neck reads as a hatched block. A side-lit face gets a hard half-face terminator. The alarm pose legs look stiff. There is no side or back view.
4. Frames are dense everywhere (edge density 6× ref), so the eye has no rest area. The red beacon wash can read as a "red puddle".
5. The clamp flash at 0.6 still washes the whole frame mint for 1 frame. A local flash would be better.

## What it would take to reach premium
- **Value design pass:** designate 30–40 % of each frame as bare paper or flat spot fill (key-lit walls, sky-like darkness as solid navy). Restrict cross-hatching to true shadow shapes. Make hatch density step in 3 bands instead of a continuum (cleaner and more compressible). Target edge density ≤ 0.15.
- **Insert shots** for the mechanism: a macro on the jaw and rail with a big green wedge and red fall arrow, numeral callouts, and the camera dolly-in.
- **Character:** joint caps (overlapping round elbow/knee shapes), a drawn neck/collar turn, 3/4 and profile head turnarounds, 6–8 more expressions, 2–3 more pose libraries (walk, climb, kneel), and hand variants (point, grab, open).
- **Delivery:** test a real 1080 render (one 3 s clip) at 1.9 Mbps. Consider x264 `-tune animation`/psy settings and a slight pre-blur of hatching only on far planes.

## Scaling to a character library + new locations
- **Characters** are just a part table (`PARTS`), draw functions and pose tables. A new person = new draw functions reusing the `Pen` helpers (ribbon ink, hatched hair, stipple, data-channel fills). Rig, lighting, shadow twin and expressions plug in unchanged. Spot colour per wardrobe via the G channel (amber = the person at risk only; others get paper/navy).
- **Locations:** any box/cylinder geometry gets the look by choosing an ink material kind (brick, concrete, plate, rope, paint, metal + angle). New "engraving marks" are a few lines of GLSL each. CC0 GLBs work by replacing their materials with `inkMat` by name. Labels/FIG system and states are scene-independent.
- **Consistency:** everything is a pure function of (mode, frame), so renders are deterministic and repeatable across workers.
