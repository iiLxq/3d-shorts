# PAPER: Case-File Paper Theatre

**Concept (3 lines)**
1. Every Fail-Safe File is a hand-built pop-up diorama made from an engineer's case-file materials: grey board, kraft, foil card, paper cord, printed cardstock.
2. It is shot like a miniature: a warm work-lamp key, cool fill, real soft shadows between card layers, macro depth of field.
3. The three signature states are three papers: BLUEPRINT is cyanotype, X-RAY is backlit tracing vellum, SOLID is offset-printed colour card. The same set changes stock, so the look is ownable and one build serves all three.

Code: `remotion/src/lab/paper/` (`paint.ts` painters and brand/untone, `card.ts` card pieces and per-look materials,
`puppet.ts` Gus, `world.ts` shaft and car, `post.ts` lens blur and grade, `story.ts` shots, `LabRoot.tsx` render host).
Compositions: `PaperBoard` (frames 0 hero SOLID, 1 BLUEPRINT, 2 X-RAY, 3-5 faces), `PaperHero`, `PaperMotion` (90 f).

## Character: "Gus", the recurring technician (person at risk = amber)
- **Proportions:** 4 heads tall (1.75 m including the helmet; head unit 0.44 m). Head with helmet = 1, jacket and torso = 1.4, legs and boots = 1.6. Shoulders are 1.3 heads wide. Jacket hem is 1.4 heads (slight A-line). Hands are big mitten gloves (0.35 head).
- **Silhouette:** white dome helmet with brim and headlamp; square-jawed head slightly narrower at the crown; bushy cut-paper moustache with a fringed edge; a boxy amber hi-vis jacket with two reflective hoops and braces; a tool belt with pouches and a swinging hammer; chunky boots. The silhouette reads at thumbnail size from the helmet, the moustache and the amber block.
- **Construction:** about 40 printed card pieces with real thickness (body 14 mm, face 9 mm at set scale). They are layered in depth: back arm and leg, then legs, jacket, belt and pouches, collar, head, eyes, pupils, lids, brows, nose, moustache, helmet, lamp, then the front arm. Each layer casts a real shadow-map shadow on the one behind, and the cut edges show the lighter paper core. Brass split pins (metal, catching speculars) mark the shoulder, elbows and knees.
- **Print:** offset-print look throughout: halftone-dot shading for volume (fixed "printed light" plus the real light on top), slight misregistration on the zip line, halftone stubble and rosy halftone cheeks, a stencilled name tag "GUS", and a helmet sticker.
- **Face rig (cut-outs, swapped or rotated):** eye whites; two pupil sizes (normal, pinned-small for fright) that slide for gaze; 4 lid cut-outs (open, relaxed, half, closed-happy arc); brows that rotate and lift; 4 mouth cut-outs (calm, alarm "O" with teeth and tongue, relief grin, small "o"); the moustache lifts on alarm. Expressions are presets (`EXPR.calm/alarmed/relieved`) plus `mixPose` body poses (idle, alarmed, brace, relieved).
- **Palette:** jacket brand amber #FFB020 (cards are lit, so the on-screen value shifts with the warm key; see weaknesses), reflective tape #DFE2E2, trousers slate #36435A, boots brown, gloves grey-green, helmet off-white #EFE9DC, skin #D39A74, moustache and brows dark brown.
- **Movement style:** puppet joint rotations with overshoot (`glide` to 1.18, then a damped cosine). The character is stepped **on 2s** while the camera moves on 1s. Lids swap for blinks. The hammer swings as secondary action. Reactions land 2 frames after the event.

## Environment, materials, lighting, camera recipe
- **Set:** back wall of grey board with hand-cut (jittered) die-cut landing openings. Brick is printed as halftone on board, with layered card bands per floor carrying stencilled numbers. Sills are foil card and the door leaves are printed steel card with warm corridor light leaking through the gaps. Guide rails are folded foil T-rails with board brackets and brass bolts. There is a kraft paper conduit with clips, an ALARM box and a red paper-lantern beacon. Hoist ropes are twisted paper-cord tubes with brass shackles. The car is a printed chequer-plate top with rivets, a "TOP OF CAR" plate, steel-card walls with stencils, a board car frame and crosshead, a railing, an inspection box with a real red stop button, a kraft toolbox, a coiled cable and a work lamp.
- **Safety gear (designed for camera):** a 1.35x oversized steel-card housing on each stile around the rail blade, with a **die-cut window** that shows the safety-green wedge jaws. The jaws close on the blade and slide up (wedge action), glow green (exact brand green via `untone`), and throw a green point flash plus cut-paper sparks.
- **Materials:** one drawing per card through a `Painter`, mapped per look. SOLID is a colour print with halftone shading. BLUEPRINT is Prussian-blue cyanotype with white key lines; the person is printed in amber line and the jaws in green line, and card edges glow cyan. X-RAY turns shells into vellum (20 % opacity, cyan glowing cut edges) over a dim light table. Structure keeps the cyanotype print and Gus stays solid amber. Red force arrows are unlit marker-ink cut-outs, colour-mapped to land on #FF3B3B. Paper tooth comes from a fibre bump map (tiny world-scale `bumpScale` 0.002-0.004).
- **Lighting (all motivated):**
  - warm work-lamp SpotLight key (2048 PCF-soft shadow)
  - cool "shaft vent" directional fill (1024 shadow)
  - cool/warm hemisphere ambient
  - warm landing-leak point light
  - headlamp spot that follows Gus's head
  - red beacon point light (pulses with the alarm)
  - green clamp flash light
  - fog toward lifted navy and an equirect painted env map for the foil and brass

  Shadows land between every card layer, which is where the depth comes from.
- **Post:** thin-lens DOF (own pass, 40 Vogel taps, near-field spill probe, NaN-safe), Kawase bloom (threshold 0.82), and a hue-preserving shoulder tone map (exactly invertible, so brand hex lands on screen). Then a display grade: gentle S, warm highlights and cool shadows, **lifted navy blacks**, and a navy (never black) vignette.
- **Camera:** 40-42 deg vertical FOV from the open front of the shaft (front-left, high, 3/4), focus on Gus's face, CoC 9 px at 1920 for wides and 14 px for close-ups. Motion uses a smootherstep push-in. During the fall it follows the car with a 2-frame lag, and a flip-sign kick decays over 8 frames on the clamp.

## Render cost (swiftshader, 540x960, shared 4-CPU box, concurrency 1)
- **Motion, 90 frames:** 2 min 35 s to 3 min 36 s wall-clock including bundling (about 40 s), so **about 1.3-2.0 s/frame**. Shadows (2 maps), DOF, bloom and the grade are all on, with no MSAA.
- **Stills:** 5.5-9 s each wall-clock. Each still opens a fresh page that repaints about 60 canvas textures (2-3 s) and compiles shaders.
- A 1080x1920 final is about 4x the pixels, so expect roughly 5-8 s/frame.

## Measured (scripts/frame_metrics.py --stills, 540 wide; final board stills) vs pipeline audit
| | hero SOLID | BLUEPRINT | X-RAY | faces (3) | audit "ours v1" | reference |
|---|---|---|---|---|---|---|
| luma p50 | 0.24 | 0.24 | 0.33 | 0.44-0.49 | 0.21 | 0.33 |
| luma p99 | 0.86 | 0.82 | 0.81 | 0.87-0.88 | 0.81 | 0.95 |
| % near-black | 0.0 | 0.0 | 0.03 | 0.0-0.01 | 2.5 | 0.5 |
| % clipped | 0.002 | 0.02 | 0.11 | 0.02-0.04 | 0.00 | 0.38 |
| colourfulness | 54 | 74 | 93 | 104-106 | 33 | 69 |
| lit C* p90 | 50 | 51 | 67 | 79 | 29 | 51 |
| shadow b* / hi b* | -15 / +20 | -41 / -25 | -22 / -5 | -6 / +35 | -15 / -13 | -5 / +6 |
| edge density | 0.062 | 0.229 | 0.075 | 0.049-0.054 | 0.016 | 0.058 |
| texture energy | 2.4 | 3.7 | 2.1 | 2.8-3.1 | 0.71 | 1.80 |
| empty 16-px blocks | 0.22 | 0.24 | 0.45 | 0.33 | 0.86 | 0.54 |
| vignette corner/centre | 0.63 | 0.82 | 0.81 | 1.4-1.6 | 0.79 | 0.68 |

- **Brand colours on screen:** x-ray arrow (254,52,52) vs #FF3B3B. Neutral tone mapping cannot output a 255 channel without whitening it, so I replaced it with a hue-preserving shoulder curve that `untone()` inverts exactly (`paint.ts` and `post.ts`). The lit amber jacket reads (254,141,19), more orange than #FFB020 (see weaknesses).
- **Motion clip (frame_metrics on the 1.9 Mbps file):**
  - 0 cuts; 73 % of frames moving; quiet push-in 0.089 %/f (target 0.14).
  - Peak 32.5 px720/f during the fall-follow and clamp kick (above the 25 cap).
  - Jerk/speed 0.36. That is the impact, but the follow lag could be smoothed.
- **Compression at 1.9 Mbps (540x960, 2-pass):** SSIM 0.968, PSNR 39.7 dB vs the CRF-14 master. The halftone dots survive; the fine fibre tooth mostly does not. At 1080x1920 the same bitrate will soften the halftone further.

## Self-review log (what was wrong and fixed)
1. three r175 `ExtrudeGeometry` with `bevelEnabled:false` builds **no cap faces** (the bevel loop runs 0 times), so every card was invisible. Fix: zero-size bevel with one segment.
2. A NaN pixel in the HDR buffer spread through the mipmap bloom into a big black block. I made the lens pass NaN-safe (bit-test) and switched to Kawase bloom.
3. The headlamp light was anchored at the neck pivot and shone up through the face (a hot strip). Moved it to the lamp lens.
4. Key too hot at close range, causing clipped jacket and mouth bloom. I moved the lamp forward and dropped it from 9 to 3.4, and redesigned the nose (it read as a dark wedge).
5. Hero too dark (p50 0.095, 33 % near-black). Raised hemisphere and fill, lifted navy blacks in the grade, and softened the vignette: now p50 0.24 and 0 % near-black.
6. Safety gear sat at the frame edges. I solved the cameras numerically (front-left 3/4) and made the housing 1.35x with a die-cut window.
7. X-ray was washed white. Dimmed the light table and vellum. The arrows were missing (reparented out of the scene) and then salmon (the tone map), both fixed.
8. Motion: the push-in end cropped Gus and lost the gear, and the green clamp light flooded the set. I re-solved the end camera and made the clamp flash short and local.

## Honest strengths
- Original and ownable: a physical paper case-file theatre, not a cartoon card-in-3D-world. It carries the channel name.
- All three states come from **one build**, and each state is a different paper, so the look stays consistent.
- Gus is appealing and expressive at phone size: big face, cut-out expressions, and layered shadows give him real depth.
- Detail density, texture and colour now beat the reference numbers (empty blocks 0.22 vs 0.54, texture 2.4 vs 1.8, edges 0.062 vs 0.058). The light is motivated, with a warm/cool split.
- Cheap: about 1.3-2 s/frame at 540x960 with 2 shadow maps, DOF and bloom.
- Holds up at 1.9 Mbps (SSIM 0.968): large shapes, flat card colours and halftone compress well.

## Honest weaknesses
- **Amber is lit, not exact:** under the warm key the jacket measures about (254,141,19), more orange than #FFB020, and it shifts with the light. Brand-exact amber would need an `untone`d unlit amber accent (for example the reflective-tape band or an edge glow) or a cooler key on Gus.
- **Hero composition:** Gus fills about 40 % of the frame height in the wide shot. The left foreground lamp is a dark shape, and the car top is busy but dim. The two hero subjects (Gus and the gear) sit at opposite thirds, so the end of the push-in is tight on both.
- **Motion polish:** the fall-follow camera peaks at 32 px720/f and the post-clamp kick is jerky. Gus briefly crops at the left edge mid-fall. One frame (around f52) shows a hard shadow band across his jacket from the set.
- **Flat puppet in 3/4:** Gus is a relief, so the camera must stay within about 35 deg of his facing. Strong side or top angles reveal that he is a cut-out (this is by design, but it limits camera grammar).
- The mechanism reads as "green jaws in a window" but needs the HUD label and a close-up insert to really explain the wedge action.
- DOF has no proper bokeh shapes, and the near-field spill is approximate. There is no motion blur.
- The x-ray vellum is a single opacity, so overlapping layers do not darken as real stacked vellum would.

## What it would take to reach premium
1. Shared `lib/paper/`: a stock library (board, kraft, foil, cyanotype, vellum, colour card), the `Painter` print kit and a die-cut helper, plus a seeded "hand-cut" jitter for every outline.
2. Unlit brand-exact accent channels: amber tape glow on Gus, green jaws, red arrows, cyan edges. Measure ΔE on screen in QA.
3. A real cast-shadow artist pass: a third "practical" shadow light per shot, and contact AO strips baked as multiply cards along every glued seam.
4. A per-shot light rig like a real miniature set: a bounce card, a rim on the puppet edge, and a haze plane in the shaft.
5. A mouth-shape set for VO (5-7 cut-outs keyed to `words.json`), blink scheduler, and more poses (point, grab-rail, crouch, look-up).
6. An insert-shot library: macro wedge close-up, rope fray, governor sheave.

## Scaling to a character library and new locations
- **Characters:** `Puppet` is data, not drawings: piece shapes, prints and the rig. A new person means new print functions (uniform, face pieces, hair or helmet) on the same 4-head rig. The face kit (eyes, lids, pupils, brows, mouths) is shared, so expressions transfer for free. Person = amber always; extras get neutral prints.
- **Locations:** the `Card` and `cardBox` primitives, tiled prints (brick, concrete), `steelPrint`, stencils and die-cut holes build any set (cockpit, ride, factory, bridge). Every new piece automatically gets all three state looks, because the look lives in the stock and painter, not the model.
- **Consistency:** the seeded rng, fixed per-look palettes, `untone` and one grade make every episode match.

## Self-scores (1-10, honest)
| Criterion | Score | Why |
|---|---|---|
| Originality and ownability | 8 | Case-file paper theatre; three papers carry the three states |
| Premium feel at phone size | 7 | Faces and blueprint feel crafted; the wide hero is still a bit dim and busy |
| Character appeal and expressiveness | 8 | Cut-out expressions read instantly; a flat relief limits camera angles |
| Character-environment integration | 7 | Real layer shadows and a contact blob; Gus's cast shadow on the set is weak |
| Lighting richness | 7 | Six motivated sources, warm/cool split; the key is still slightly hot on Gus |
| Material and texture credibility | 8 | Card core edges, halftone, fibre, foil, brass |
| Mechanism readability | 6 | Die-cut window shows the green jaws, but it needs an insert close-up and HUD label |
| Fit with the 3 states and colour code | 8 | One build, three papers; red, green and cyan exact; amber is lit, not exact |
| Motion quality | 6 | Puppet on 2s with overshoot works; the fall camera is jerky |
| Production feasibility | 8 | About 1.3-2 s/frame preview, all code-built, reusable kit |
| Compression robustness at 1.9 Mbps | 8 | SSIM 0.968 at 540x960 |

## Deliverable files
- Board: `docs/lab/paper/board.jpg` (hero, 3 states, 3 faces, 4 motion frames); hero still: `docs/lab/paper/hero.jpg`.
- Motion (H.264 2-pass 1900k, 540x960, 90 f): scratchpad `lab/paper/paper_motion_1900k.mp4`.
- Render: `cd remotion && ENTRY=src/lab/paper/index.ts TMPDIR=<scratch> node scripts/stills.mjs PaperBoard <out> 0,1,2,3,4,5 0.5`, then
  `npx remotion render src/lab/paper/index.ts PaperMotion <out.mp4> --gl=swiftshader --scale=0.5 --concurrency=1`.
