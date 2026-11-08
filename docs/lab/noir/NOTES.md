# GOUACHE: Lit Gouache Noir (lab concept `noir`)

## Concept (3 lines)
Paintings in motion: an animated-feature concept painting of the shaft that the camera can move through.
Opaque, chalky gouache surfaces with painted light steps, coloured shadows (teal low, violet high, never black), haze and light shafts.
The three states are the three stages of a painting: **BLUEPRINT = the cyanotype under-drawing**, **X-RAY = translucent glazes**, **SOLID = the finished gouache**.

## Files
- Code: `remotion/src/lab/noir/` (`paint.ts` painter + textures, `shade.ts` gouache shader + glaze/beam/line materials,
  `character.ts` Rafa rig, `world.ts` shaft, `engine.ts` timeline + renderer + post, `NoirScene.tsx`, `LabRoot.tsx`).
- Compositions: `NoirHero` (1 f), `NoirFaces` (3 f: calm/alarm/relief), `NoirStates` (3 f: blueprint/x-ray/solid), `NoirMotion` (90 f).
- Board: `docs/lab/noir/board.jpg`. Motion: scratchpad `lab/noir/noir_motion_1900k.mp4`.

## Character: "Rafa" (recurring person at risk)
- **Build:** 2.5D painted cut-out, 15 cards (head with 4 expression paintings, torso, upper arms, forearms, 3 hand shapes per
  hand, thighs, shins, boots). All parts are painted in code in ONE body coordinate system (cm, 3/4 view facing screen-left),
  like a model sheet, so proportions are designed, not eyeballed.
- **Proportions:** 182 cm with helmet, head 26-28 cm => ~6.6 heads. Broad shoulders (44 cm), stocky legs, big boots. Silhouette
  = helmet dome + brim + headlamp, square hi-vis torso, tool belt with hammer and pouch: reads at thumbnail size.
- **Face construction:** painted planes, not lines: skin field + painted temple/eye-socket/cheekbone washes, a nose side plane,
  salt-and-pepper beard as its own shape, ear; brows/eyes/mouth are drawn per expression (calm, alarm, relief, blink).
  The helmet brim's shadow is painted on the forehead. Edges are a darker, more saturated hue of each fill, never black.
- **Palette:** jacket = brand amber `#FFB020` (lands on screen as amber in the key light), reflective tape pale grey-cyan,
  slate-navy trousers, warm brown skin with violet-red shade, cream helmet, umber boots. Nothing else in the frame is amber.
- **Lighting the cut-outs:** each card gets a normal map generated from its own silhouette (blurred-alpha "pillow" + painted
  relief), so the scene's key light shades it and a cool rim catches the edges. Cards cast real silhouette shadows
  (alpha-tested depth material) and stand on a multiply contact blob.
- **Rig / acting:** hierarchical pivots (hips > torso > head / arms > forearms > hands; hips > thighs > shins > boots). Legs are
  solved by 2-bone IK so boots stay planted and flat in any crouch. Pose library: idle (inspecting, spanner), alarm,
  brace, relief. Expressions swap behind 1-2 frame blinks; hands swap shape (grip/splay/relax) on the same frames. Breathing
  (torso scale 0.6 %), head micro-sway, damped follow-through on the hands after each reaction, back-out easing into poses.
- **Movement style:** snappy poses (8-9 f back-out), long holds that keep breathing; 2D cut-out acting, no squash on the body.

## Environment / material / light / camera recipe
- **Material (`gouache()`):** a patched `MeshLambertMaterial` (three's lights + shadow maps do the work). The direct light is
  remapped into 3 painted value steps + soft shoulder; the step thresholds are offset by a triplanar brush-stroke field, so
  light/shadow edges look brushed. Indirect = albedo x shade colour (teal low in the shaft, violet high), modulated by the
  brush field (pigment density). Cool Fresnel rim, distance+height haze (lifted teal, never black).
- **Textures:** all code-painted with seeded RNG: board-formed concrete (form seams, tie holes, violet water stains), brick,
  steel (vertical brushing, chips), roof tread plate (scuffs, oil), green enamel car panels with rivets, rope strands. Every
  painter adds directional strokes + chalky dry-brush specks; character parts add a darker-hue edge.
- **Light:** one dominant warm key (caged work lamp on the car top, off-frame left, PCF soft shadow 1024), cool landing light
  through the door slits (spot + emissive slit + additive light sheets), headlamp (aimable spot + beam cone), red beacon as the
  alarm accent, a green point light from the jaws when they bite.
- **Atmosphere:** additive light cones with scrolling haze noise (lamp, headlamp, every slit), noisy haze sheets, 650 dust
  motes lit only inside the beams (computed in the vertex shader), hexagonal bokeh from far landings, sparks on the clamp.
- **States:** one uniform switches every material: BLUEPRINT = cyanotype paper + world-space grid on walls, fat cyan edges
  (crisp line + jittered draftsman's overshoot pass + soft glow pass), character cards show their own line-mode painting;
  X-RAY = the painting is glazed to navy with cyan Fresnel brushwork, shells (roof, gear housing, car body) become additive
  glazes, red force arrows are painted loaded-brush strokes; the person (amber) and the jaws (green) stay painted.
- **Post:** postprocessing composer (HalfFloat, MSAA 4): mip bloom (threshold 0.9, ADD) -> GouacheGrade (hot cores bleach to
  white instead of hue-clipping, warm-highlight/cool-shadow split, paper tooth 7 %, vignette, navy-lifted blacks, flash).
  No tone mapping: brand hexes are albedos/emissives that land as authored.
- **Camera:** smootherstep push-in (17 % over 90 f) from a front-right 3/4, camera rides the car with lag so the shaft slides
  past during the drop, 7-frame sign-flip kick on the clamp. The cut-out yaw is set between camera and key lamp (never edge-on).

## Render time (shared 4-CPU box, swiftshader, 540x960 buffer, MSAA 4 + bloom)
- Stills ~4.5-6 s per frame wall time incl. page overhead (first frame +2-3 s for painting all textures).
- Motion (90 f, `npx remotion render ... --scale=0.5 --concurrency=1`): **1.5 s/frame** on a quiet box (2m16s), 2.2 s/frame
  while other agents were rendering (3m16s). Still renders via stills.mjs show ~4.5 s because of per-still page overhead.
- 1.9 Mbps 2-pass H.264 encode: 726 KB for 3 s; haze stays smooth (painted noise hides banding); paper tooth and motes
  are the parts the encoder smears first.

## Self-review (2 rounds, 0.5-scale sheets + `scripts/frame_metrics.py --stills`)
Round 1 defects found and fixed: head card lit from behind/outside the key cone (dark face) -> key raised and re-aimed;
over-exposed pinkish jacket -> key de-saturated, ramp top 1.0; lamp post cutting through the gear ("jail bar") -> lamp moved
off-frame left; haze sheets flattening everything (key-only debug render proved the key/shadows worked but were washed
out) -> haze cut ~50 %; beard swallowing the ear, bruise-like eye sockets -> reshaped/softened; stick-lollipop fingers ->
single tapered finger shapes; legs too thin -> widened; X-RAY character unlit silhouette -> lights stay on in X-RAY;
X-RAY too similar to SOLID -> darker navy glaze, cyan brushed Fresnel, glazed roof showing the lit cabin; arrows edge-on ->
yaw-billboarded; overlapping blueprint labels -> re-laid out; face camera too tight -> 34 deg head-and-shoulders.
Round 3 / final metrics (7 stills, 540x960) vs audit (ours v1 / reference):

| metric | GOUACHE | ours v1 | reference | target |
|---|---|---|---|---|
| empty 16 px blocks | **0.47** | 0.86 | 0.54 | <= 0.55 |
| texture energy | **1.75** | 0.71 | 1.80 | >= 1.5 |
| edge density | 0.038 | 0.016 | 0.058 | >= 0.045 |
| colourfulness | **83** | 33 | 69 | >= 60 |
| lit chroma p90 | **51** | 29 | 51 | >= 45 |
| shadow b* / highlight b* | **-12.9 / +14.3** | -14.9 / -13.4 | -5 / +6 | hi > 0 > shadow |
| luma p50 / p99 | 0.39 / 0.84 | 0.21 / 0.81 | 0.33 / 0.95 | p99 >= 0.93 |
| clipped > 245 | 0.0 % | 0.0 | 0.38 % | 0.1-0.5 % |
| near-black < 16 | **0.0 %** | 2.5 | 0.5 | <= 2 % |
| vignette corner/centre | 0.72 | 0.79 | 0.68 | ~0.85 |
| noise sigma | 0.38 | 0.22 | 0.27 | (paper tooth) |

Round 3 (motion sheet) fixes: helmet/trousers too dark on the unlit side -> card ambient lift; X-RAY roof glowing slab ->
glaze 0.22; clamp flash halved (0.32 peak, 4 f). Motion metrics (`frame_metrics.py` on the 1.9 Mbps clip): hold/drift/move
16.7/61.1/22.2 %, quiet push-in 0.163 %/f (target >= 0.12), jerk/speed 0.225 (incl. the planned clamp kick), 0 hard cuts.
Still open after round 3: the rope break happens behind Rafa's head (the snap itself is not legible; only the slack loop and
whip are), a soft translucent band (light-volume edge) crosses the face in the calm/relief close-ups.

## Honest strengths
- It has a person: Rafa reads as a specific, likeable middle-aged tradesman with three clear expressions; amber owns him.
- Integration is real light, not stickers: the key shades the cut-outs through generated normals, they cast shadows, the rim
  and beacon tint them like everything else.
- Dressed, textured, warm/cool frames: the measured "cheap" gaps from the audit (empty frame, no texture, monochrome blue,
  no warm/cool split, crushed blacks) are closed or exceeded.
- One shader carries all three signature states; the "under-drawing / glaze / finished painting" metaphor is ownable.
- Fully procedural, deterministic, no assets: a new location is code + painters.

## Honest weaknesses
- **Mechanism readability is the weakest point:** at hero distance the safety gear is a small bright green wedge block; the jaws
  biting the rail only reads in a dedicated close-up (not built in this lab). Needs an insert shot + cutaway housing.
- **The cut-out is still a card:** 3/4 view is baked, so camera azimuth is limited to ~+-35 deg of the card; no turnarounds.
  Limbs rotate as flat pieces (elbow/knee joints show a little at extreme bends); the far arm's "alarm" reads partly as a wave.
- Highlights are too polite (p99 0.85, no glints): steel lacks specular sparkle; the noir key could hit harder.
- Haze is still somewhat uniform; light shafts from the landings are subtle at phone size.
- Paper tooth raises noise sigma to 0.40: costs bitrate at 1.9 Mbps (see motion encode).
- Character painting is code-drawn Bezier shapes: credible, but not yet at concept-artist level (hands especially).

## What it would take to reach premium
1. A mechanism insert kit: macro camera on the gear with DOF (cheap depth blur), cutaway housing, rail with machined face glints.
2. Character: 2-3 baked views (front 3/4, profile, back 3/4) per part with view switching hidden behind motion; more hand shapes
   (point, grab, shield); mouth shapes for 3-4 visemes; a jacket fold layer that swaps on big poses.
3. Stronger chiaroscuro: tighter key pool, a visible cast shadow of Rafa on the back wall in every hero, small specular glints
   (rope strands, rail face, bolts) to get p99 >= 0.93 and 0.1-0.3 % clipped.
4. Paint-on transitions between states (a brush wipe that reveals SOLID over the under-drawing) instead of hard switches.
5. Halve the paper-tooth amplitude in motion (or make it static per shot) to protect the 1.9 Mbps encode.

## Library / new locations
- **Character library:** the part table + painter functions are the model sheet; a new character = new palette + a few shape
  edits (helmet -> cap, beard -> hair) on the same body coordinates, rig, IK, poses and expression table. Rafa recurs.
- **Locations:** `gouache()` + the painters are location-agnostic: a new scene is geometry + 3-4 code-painted textures + a
  motivated key/rim/practical list + haze cones. The three states come for free from the shared uniform.
- **Cost:** ~5 s/frame at 540x960 preview; a 60 s video at 1080x1920 would be roughly 4x pixels (MSAA/bloom dominate),
  so final renders need the heavy passes at reduced resolution or MSAA 2.
