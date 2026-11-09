# Reference research: vidIQ analyses of 12 videos

Sources: R1-R7 Ricks Clips, S1 Segment Zero, W1 Wobbly Business, J1 Read With Jessica, T1/T2 tutorials. Raw text: `references/external/vidiq/<ID>.md` (private). All 12 jobs completed. Study material only: methods and numbers, no characters, scripts, brand or frames are to be reused.

---
## 1. DIRECT OBSERVATIONS
**Everything below is as reported by vidIQ's AI video analysis; not frame-measured by us.** Timestamps and numbers are the model's estimates.

### Ricks Clips (R1-R7), recurring patterns
- **Scene construction.** Low-poly or cel-shaded 3D sets with flat 2D "stick/pill" puppet characters placed in them (R1-R7). Three declared depth layers per shot: foreground props or occluders, midground action, hazy background (R1, R2, R3, R4). Sets carry story props: tape outlines where a PC used to be, shoe scuffs on a desk, wall calendar, tiled walls (R7, R5).
- **Scale.** Constant macro-to-wide alternation: a coin in a rail gap, then a canyon abyss (R2); wine-cup meniscus, then an army courtyard (R3); aerial map, then a single cell (R5). Two-ship or giant-wave scale contrast (R4).
- **Camera.** Every shot moves: push-ins, snap zooms, orbits (~45 deg, R3), crane/pedestal rises, mounted tracking, reverse dollies, a Dutch tilt (R2). Hard cuts land on narration beats. Match-cuts carry scene changes (zoom into a CRT monitor, R5; the same stool through room, ocean, elevator, room, R6; a dissolve with matched head position, J1).
- **Pacing.** ASL 2.4-2.8 s (R1 2.6, R2 2.7, R3 2.78, R4 2.6, R7 2.4), 23-25 shots per ~64 s. R5 (3.6 s, ~18 shots) and R6 (3.5 s, 11 "phases", 40 s) are slower. Cuts speed up in action finales (R1).
- **Lighting and grade.** One motivated key per scene; hard shadows. Colour script follows the story: day to night (R1), warm royal to golden hour to indigo night to dawn (R3), cold teal vs warm pink (R5), cyan office vs olive vs sunset (R7). Barred-window god-rays (R5), a hanging bulb as a recurring anchor with vignette (R6), rim light on cliffs and metal (R2, R3). Bloom is used only on hot sources.
- **Materials.** Cel-shaded toon shaders with black outline (R4, R7); hand-painted or grain textures; brass speculars; heat-map shader on rails (R2); caustics (R6).
- **Characters.** ~3.5-head pill/bean bodies; faces as swappable expression plates (smirk, sweat drop, wide eyes, squint); squash-and-stretch on exaggerated beats; deadpan hero against panicking cast (R4); a body that stays absolutely still against a moving crowd (J1). Contact is faked with parented nulls and drop shadows (R1).
- **Explanatory graphics.** Mostly **in-world**: chalk blueprint board (R1), caliper, coin, paper sheet, newspaper (R2), jar mechanism as a physical cutaway (R3), soup ripple rings (R4), labels on cans and a stopwatch mesh (R5), breaker switches "HOPE / FRIENDS" (R7), phone with money counter (R7). Streamlines mapped into world space (R4). Semi-diegetic gauges and dials (R6). Overlays are rare.
- **Subtitles.** Consistent across R1-R7, S1, W1, J1: bold sans, heavy black stroke/shadow, white fill, 1-3 words per chunk, scale-pop on entry, lower-third centre. W1 adds a yellow active-word highlight. R2 was flagged for sitting under platform UI.
- **Polish.** Sweat drops, impact lines, screen shake on hits, steam, dust motes in light cones (J1), secondary wobble on balloons/hats, particles on every contact.
- **Weaknesses vidIQ saw** (R1-R7, W1, J1, S1): foot sliding and clipping, flat circular alpha shadows (R3, J1), cloned crowds and repeated faces (R3, R7, J1, W1), repeating ground and foam textures, sparse far backgrounds.

### Other channels
- **S1 (Segment Zero):** fastest cutting (~1.9 s ASL, ~32 shots). Labels and formulas **textured onto 3D objects**, whip pans, calendar/clock flips for time, anthropomorphic atoms.
- **W1 (Wobbly Business):** toy-like matte PBR, chamfered shapes, no outlines; world-space extruded text as props; stamp squash with ink reveal; ASL ~2.9 s.
- **J1:** chalk strokes drawn live with falling dust; glow pass on correct equations; teal/orange script; ASL ~2.9 s.
- **Tutorials:** T1 reports a reference-stat dashboard (47,709 frames/50 shorts: 2.77 words/s, -10.4 LUFS, 0.14 hard-cut ratio, i.e. mostly continuous moves), camera jerk 0.05 and drift ~0 in reference vs 0.41/0.79 px in a first attempt, highlight-roll-off grade, shadow catcher, FACS faces. T2 reports ink outline pass must run **before** blur, warm key with lifted cool shadows (no crushed black), 18-40 frame eased camera glides, ~3.5-head proportions, 14 expression variants.

### Contradictions and unreliable claims
- Materials are described inconsistently: R2 "semi-realistic PBR" vs R4/R7 "cel-shaded"; R1 "unlit flat 2D" characters vs R3 "cel-shaded 2.5D". Treat as "flat characters in lit 3D sets", not a measured shader spec.
- R1 "FOV 75-90 deg", R2 "volumetric fireball", R4 "volumetric storm", R3 "anisotropic highlights" are unverifiable inferences.
- R6 "11 shots / ASL 3.5 s" counts "phases" while also listing snap cuts, so it is not comparable.
- R2 subtitle colour (black fill, white stroke) conflicts with all other reports (white fill, black stroke).
- Reference names such as "Henry Stickmin" (R1) or "Planet Coaster" are vidIQ's guesses.
- "Paper-cutout" (R2) means 2D puppet cutouts, not paper craft; no source shows real paper materials.

---
## 2. PRODUCTION PRINCIPLES (inferred)
1. **Constant legible motion**: ASL ~2.5 s plus a moving camera in every shot keeps retention; slow shots still creep (R1-R7, T1 86% continuous moves).
2. **Diegetic explanation**: info living on objects (tags, props, dials) feels like story, not a lecture, and survives phone compression better than floating UI (R2, R3, R5, S1, W1).
3. **Scale alternation** gives rhythm and clarity: establish wide, explain macro (R2, R3, R5).
4. **One motivated light per scene plus a colour script** tells the viewer the story state without words (R3, R5, R7).
5. **Silhouette-first characters**: a simple body with swappable expressions and one strong prop per person reads at phone size (R4, R7, W1).
6. **Contrast acting**: one still, deadpan figure against panic sells comedy and tension cheaply (R4, J1).
7. **Contact and secondary motion** (shadows, dust, sweat, wobble) are what make flat figures feel in the world; their absence is the weakness vidIQ flags most (R2, R3, J1).
8. **Match-cuts carry continuity** across metaphors and time jumps without explanation (R5, R6, S1, J1).
9. **Camera smoothness is measurable**: eased glides, no jerk or drift (T1, T2). Matches our existing smoothness rules.
10. **Subtitle conventions converge** because they work; the style is not distinctive in itself.

---
## 3. PROPOSED ADAPTATIONS FOR PAPER CASE-FILE
Impact: H/M/L (visible gain per effort).

| # | Idea in paper language | Proposal item | Source | Impact |
|---|---|---|---|---|
| A1 | **Scale alternation per mechanism**: wide diorama establish, then a macro insert (paper coin in the rail gap, jaw teeth) with a slow rack of paper layers; plan one macro per beat in the shot list | Camera | R2, R3, R5 | H |
| A2 | **Pop-up peel as the match-cut**: peel/fold continuity where the end pose of one scene matches the start of the next (same Gus position, same table edge), instead of a plain dissolve | Transitions | R5, R6, J1 | H |
| A3 | **Tags and callouts printed ON parts**: cyanotype labels glued to the cable/jaw, a paper dial or stopwatch card as a prop, a rubber stamp with squash for dates | In-scene graphics | R5, S1, W1, R7 | H |
| A4 | **Heat/danger shading on paper**: a vellum overlay that warms (cyan to amber to red) over the part under stress, like the rail heat-map; ties to the danger meter without a HUD | Lighting, mechanism | R2 | M |
| A5 | **Cutaway mechanism as a moving paper machine**: pendulum, lever, latch built as layered card with visible inertia and a top-down cutaway shot before the engagement | Mechanism | R3, R4 | H |
| A6 | **Contact discipline for Gus**: real cast shadow from the key lamp (not a round decal), slight fold-bend on step, dust-paper-scrap particle on foot plant; foot-lock QA in the contact sheet | Gus, physics | R2, R3, J1 | H |
| A7 | **Expression plates**: a small swappable face set (smirk, sweat-drop slip of paper, wide eyes) popped on 2s, plus deadpan-vs-panic staging with cut-out extras of different silhouettes | Gus | R4, R7, T2 | M |
| A8 | **Light script**: one warm work-lamp pool per scene; fixed colour per state (cyan blueprint, vellum, warm print), amber window beam for "the person at risk"; navy lifted shadows (no black) | Lighting | R3, R5, T2 | M |
| A9 | **Paper dust and fibre motes** in the lamp cone, scrap bursts on impact, thin paper-edge screen shake only on the clamp hit | Polish | J1, R6 | M |
| A10 | **Subtitle pop**: die-cut card slides 3-4 frames and settles with ~105% scale; do not add a black outline; keep our amber/red/green emphasis | Subtitles | R1, R3, W1 | L-M |
| A11 | **Environmental storytelling props** per video (wear marks, tape outlines as paper strips, wall calendar) to answer "what happened here" without VO | Materials, set | R7, S1 | M |
| A12 | **Pacing target** ASL 2.4-2.8 s with ~23 setups/60 s; verify against `short_qa.py` | Camera | R1-R7 | M |
| A13 | **Camera-eased glides** 18-40 frames, ~0 lateral drift on dollies; QA with a phase-correlation or jerk script | Camera | T1, T2 | M |
| A14 | **Highlight roll-off grade** so foil-board highlights do not clip to white; keep film-like contrast | Lighting | T1, T2 | M |

---
## 4. REJECTED IDEAS
- **Black ink outlines and cel-shading on everything** (R1-R7, S1): would turn paper into a cartoon; conflicts with paper edges and layer shadows. Keep paper edges instead.
- **Flat 2D stick-figure/bean puppets with oversized pill heads** (R1-R7): the recognisable Ricks-style character design; copying it is imitation. Gus stays a folded paper puppet.
- **Stylised black text with scale-pop and yellow highlight as is** (W1 and all): generic "viral" look and conflicts with die-cut type; take only the timing.
- **Photoreal SSS, FACS rigs, pore displacement, raymarched clouds** (T1): too costly in the swiftshader pipeline (~5 s/frame with heavy post) and off-identity.
- **Real rigid-body crash and fireball simulation** (R2, R1): high build cost, not our "safety mechanism saves you" tone. Use cheap paper tears and scrap bursts.
- **Mass crowd of cloned puppets** (R3): vidIQ itself flags repetition; use 3-5 distinct silhouettes at most.
- **Fast whip-pan stacks at ~1.9 s ASL** (S1): fights our slow macro payoff and engagement freeze.
- **Toy-matte no-outline PBR** (W1): close to a different channel look; our paper stocks give distinction.
- **Subtitle bottom-centre placement** (R1-R7): collides with our caption band and platform UI; keep y 1250-1450 rule.
- **Danger gauge on the left as in R6**: our left meter is already signature; no change needed. Do not copy the sleep-depth gauge layout.
- **Day/night "story-time" light swaps every scene**: dilutes our fixed three-state colour code.
- **Sound claims** (R3 "layered sound"): vidIQ does not report audio detail; ignore.

---
## Gaps worth a follow-up (reserve credits: propose only)
1. **Subtitle exact specs** on 2 Ricks Clips shorts: font size ratio to frame width, stroke width, y-position, pop scale/timing in frames (current numbers are generic).
2. **Camera moves with frame numbers** for one macro-to-wide cut: easing, duration, amount of parallax; confirm whether snap zooms are scale or true dolly.
3. **Character ground contact and shadow**: how shadows are projected (blob vs cast) and foot plant timing on one walk.
4. **Transition catalogue**: count and type of match-cuts per short (whip, zoom-through, dissolve) with durations, to set our transition budget.
5. **Audio layering** (SFX density, music ducking, impact sync) on one Ricks Clips short, since this report has none.
