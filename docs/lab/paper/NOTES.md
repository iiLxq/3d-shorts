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
- **Post:** thin-lens DOF (own pass, 40 Vogel taps, near-field spill probe, NaN-safe), Kawase bloom (threshold 0.82), Neutral tone map, then a display grade: gentle S, warm highlights and cool shadows, **lifted navy blacks**, and a navy (never black) vignette.
- **Camera:** 40-42 deg vertical FOV from the open front of the shaft (front-left, high, 3/4), focus on Gus's face, CoC 9 px at 1920 for wides and 14 px for close-ups. Motion uses a smootherstep push-in. During the fall it follows the car with a 2-frame lag, and a flip-sign kick decays over 8 frames on the clamp.

## Render cost (swiftshader, 540x960, shared 4-CPU box, concurrency 1)
- Stills: GPU render 2.0-3.3 s per frame for the post chain (measured in-page). Stills cost 5.5-9 s each wall-clock including page and texture setup (the canvas textures are painted per page, about 2-3 s).
- Motion: see the numbers below (filled in after the 90-frame render).

## Measured (frame_metrics --stills, 540 wide; board r9) vs audit
| | hero SOLID | BLUEPRINT | X-RAY | faces (3) | audit ours v1 | reference |
|---|---|---|---|---|---|---|
| luma p50 | 0.17 | 0.23 | 0.31 | 0.39-0.44 | 0.21 | 0.33 |
| luma p99 | 0.86 | 0.87 | 0.85 | 0.91-0.92 | 0.81 | 0.95 |
| % near-black | 1.6 | 0.0 | 0.7 | 0.7-1.4 | 2.5 | 0.5 |
| colourfulness | 64 | 83 | 95 | 95-96 | 33 | 69 |
| lit C* p90 | 55 | 53 | 50 | 74 | 29 | 51 |
| shadow b* / hi b* | -18 / +24 | -42 / -24 | -21 / 0 | -9 / +28 | -15 / -13 | -5 / +6 |
| edge density | 0.063 | 0.205 | 0.075 | 0.055-0.060 | 0.016 | 0.058 |
| texture energy | 2.3 | 3.7 | 2.2 | 2.9-3.2 | 0.71 | 1.80 |
| empty blocks | 0.24 | 0.24 | 0.43 | 0.31 | 0.86 | 0.54 |

Every audit "cheap" metric moved past the reference: empty frame, texture, edges, colour, warm/cool split and no crushed black.
The hero is still darker than the reference (night set, p50 0.17).

## Honest strengths
- Original and ownable: a physical paper case-file theatre, not a cartoon card-in-3D-world. It carries the channel name.
- All three states come from **one build**, and each state is a different paper, so the look stays consistent.
- Gus is appealing and expressive at phone size: big face, cut-out expressions, and layered shadows give him real depth.
- Detail density, texture and colour now beat the reference numbers; light is motivated and warm/cool split.
- Cheap enough: about 2-3 s/frame of GPU at 540x960 with shadows, DOF and bloom.

## Honest weaknesses
- **Amber is lit, not exact:** under the warm key the jacket ranges from deep orange to pale yellow-white. Brand-exact amber would need an `untone`d unlit amber accent (for example the reflective-tape band or an edge glow).
- **Hero exposure and composition:** the night hero is still darkish (p50 0.17). The lower car top is busy-but-dim, and the left foreground lamp is a dark shape. Gus fills about 40 % of the frame height in the wide shot.
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
