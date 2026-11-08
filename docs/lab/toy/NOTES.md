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
RENDER_TIMES

## Measured (scripts/frame_metrics.py --stills, 540 wide)
METRICS

## Honest strengths
STRENGTHS

## Honest weaknesses
WEAKNESSES

## What it would take to reach premium
PREMIUM

## Scaling to a character library + new locations
SCALING
