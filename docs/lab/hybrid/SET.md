# Hybrid "Lamplit Gouache": Set & Mechanism (draft standard)

Owner: Set & Mechanism TD. Code: `remotion/src/lab/hybrid/set/` (`shaft.ts` builder, `kit.ts` kit textures + helpers,
`engine.ts` + `SetScene.tsx` + `LabRoot.tsx` test harness; entry `set/index.ts`). Imports `../look/shade` and `../look/paint` read-only.
Boards: `docs/lab/hybrid/set/board_establish_states.jpg`, `board_gear.jpg`, `board_snap.jpg`.

## 1. `buildShaft(): Shaft` (phase-1 contract + additive extras)

| Member | Meaning |
|---|---|
| `group` | Whole set (fixed shaft + car). Add it to your scene. |
| `car` | Car group; moves along y. Car space y = 0 is the top of the roof deck (`carRoofY = 0`). |
| `charSpot` | Car-space feet position for the person on the roof `(0.18, 0, 0.10)`. Parent the character to `shaft.car`. |
| `setRopeSnap(t)` | `t` = seconds since the snap (≤ 0 = intact). 4 ropes part at world y 2.6 (`BREAK_Y`), staggered 0–0.13 s. Each part has frayed wire ends (9 splayed strands). The upper ends recoil about 1 m up with a travelling whip that decays (e^-1.8t). The lower ends lose tension and flop toward the camera over the hitch. There is a local white flash sprite (≈ 0.15 s) and a steel spark burst. No full-frame flash. |
| `setCarDrop(y)` | Car y offset (world metres, negative = down). Dust motes stay world-still, so the car falls through them. |
| `setGearClamp(t)` | 0 = open (50 mm gap each side), 1 = bite. The wedges ride 157 mm up a 1:3.1 taper and move inward. Lift links, yoke and pull rod follow. It sets a default glow, `smooth(0.85, 1, t)`. |
| `setAlarm(on)` | 0..1 red beacon on the crosshead (emissive + halo + point light, range 1.6 m). The caller pulses it. |
| `setState(0/1/2)` | BLUEPRINT / X-RAY / SOLID. It sets the shared `U.uState` and toggles line art, resin twins, beams, sparks and lights. |
| `anchors` | `gear`, `gearJaw`, `gearSpark` (hero gear, right rail), `rail`, `ropeBreak`, `ropeTop`, `hitch`, `lamp`, `roof`, `char` (head height), `beacon`, `door` (floor-18 number), `cw`, `force`. |
| `lights` | key (work lamp, only shadow caster), gearLamp, 2 landing spills, cool top directional, hemi, beacon, 2 jaw glows, cab (X-RAY). |
| extras | `setGearGlow(g)` (override; < 0.15 = painted green only, 1 = full local glow), `setSparks(age)` (gear contact sparks, s since bite), `setForce(k)` (X-RAY red arrows), `setTime(t)` (haze/dust drift), `setViewport(bufW, bufH, fov)` (**call after resize/fov change**: line widths + particle sizes), `patent[]` (BLUEPRINT callouts: anchor key, numeral, label: 10 CAR, 12 GUIDE RAIL, 14 SAFETY GEAR, 16 HOIST ROPES, 18 COUNTERWEIGHT, 20 LANDING DOOR). |

Test compositions (540×960 via `--scale=0.5`): `HySetEstablish` (2 f: medium figure + gear, up-the-shaft), `HySetGear` (45 f: car falling at 2.6 m/s, trip f12, bite f24, stop by f33), `HySetSnap` (45 f: snap f10, alarm f12, drop f16), `HySetStates` (3 f, with FIG. 1 callouts on f0). The stand-in figure is a 1.75 m amber capsule.

**Render cost:** ≈ 0.65 s/frame at 540×960 with MSAA 4 + bloom, measured on a 45-frame clip in 29–30 s wall time including bundling. That is far under the 1.5 s budget, so there is headroom for the Look TD's post and the cast. Stills take ~3 s each, mostly page and texture setup.

## 2. Layout and scale (metres, 1 unit = 1 m)
- Shaft interior x ±1.4, back wall z −1.25, front open toward the camera (+z). Walls run y −42…46. Landings every 3.3 m, with the floor-18 sill at y −0.9 (behind the car top at rest).
- **Backpack layout, designed for the camera:** both guide rails stand in front of the back wall at x ±0.98 with their **blades pointing at the camera**. The jaws close on the blade **left/right in screen space**, so a front or ¾ camera always sees jaw | gap | blade | gap | jaw. Phase-1 failure: front-mounted gears stacked their jaws in depth and read as a green square.
- The **hero gear is on the right rail.** In the medium framing it sits at ~0.65–0.85 of frame width, and the left 140 px stay background.
- Car: 1.44 × 1.44 × 2.5. The sling (uprights + crosshead) is at the back (z −0.94). The rope hitch is at car-space y 0.62. The roof carries the door operator (back), inspection box (back right), toolbox and cable coil (left), a left-side balustrade only (none between camera and gear), and the work lamp on a mast at the front-left corner.
- Depth layers: foreground column + slab stubs at the front right edge (parallax, never across the subject); mid = car, figure and gear; background = back wall with stacked doors, rails and brackets every 2.5 m, counterweight high on the right wall, ropes rising into cool haze, and a vent beam from above.

## 3. Modular kit (reuse for new locations)
| Piece | Builder / constant | Notes |
|---|---|---|
| Walls | `PlaneGeometry` + `gouache({map: repTex(concreteTex()/brickTex(), w/2.2, h/2.2), grid: 1})` | Concrete tile 2.2 m, brick 1.3 m. `grid: 1` gives the BLUEPRINT grid. |
| Slab band | `boxGeo(w, 0.32, 0.06)` lighter concrete at every floor | The main scale/parallax rhythm. Keep it. |
| Landing door | group: header, jambs, sill, 2 leaves (`doorTex`), warm slit/sill/top emissive strips, stencil number (`stencilTex("18")`) | Warm corridor leak, `#ffc890` × 3.4 HDR. |
| T-rail | blade + flange boxes; tip face uses the polished `mRailTip`; bracket (wall plate, 2 arms, seat, clips, 4 bolts) every 2.5 m; fishplates every 5 m | Blade 36 mm (2× real) so it reads. |
| Safety gear | `cheekShape` / `jawShape` extrusions + plates + mount, lift links, yoke, pull rod | Generic "wedge on a taper" clamp. Reuse for train, cable car or hoist brakes. |
| Ropes | `polyTube(points, r, radial, tile)` + `fray(end, tangent, seed, open)` | Any cable, rope or hose that whips or snaps. |
| Sparks | `sparkSys(n, seed, vel, origin, colour)` with uniform `uAge` | Deterministic, a pure function of age. |
| Haze / beams | `sheet(...)` haze planes; `beamMaterial` cones from look | Additive; scaled per state. |
| Textures | `kit.ts`: enamel, door, rail, rope, gunmetal, counterweight, slate, stencil | All code-painted and seeded; `boxGeo(w,h,d,tile)` keeps texel density constant on every face. |

**New location recipe:**
1. Choose the room box and clip all geometry to it (lesson: clip geometry to its room).
2. Set one horizontal rhythm element (slabs or beams) and one vertical one (rails or columns).
3. Place practicals: one warm key with shadow, one warm leak, one cool top/vent, plus the alarm.
4. Put the hero mechanism on the right two-thirds, with its action axis across the screen.
5. Add a foreground parallax element at the right edge.
6. Register edges (`add(..., {edges})`) for BLUEPRINT and wrap shells with `resin()` for X-RAY.
7. Expose anchors and patent callouts.

Concrete-scan detail maps from Poly Haven/ambientCG are allowed but not used yet: painted textures with real-scale tiling were enough to fix the "mush".

## 4. Mechanism-for-the-camera rules
1. **Action axis in the picture plane.** Jaws close left/right or up/down on screen, never toward the lens.
2. **Exaggerate the readable dimension**: blade 2× real, jaw gap 50 mm, wedge travel 157 mm, housing 0.38 × 0.5 m. Value contrast: dark gunmetal housing, mid green jaws, bright polished blade tip. The gap reads as a dark slot.
3. **Serrated grip faces** (saw-tooth silhouette) say "teeth that bite" at phone size. Machined bright strips and bolts say "precision steel".
4. **Show the cause:** lift links, yoke and pull rod move with the wedges, so "something pulled them up" reads in close-up.
5. **The open front is the cut-away.** No front plate, no acrylic. The housing frames the action like a window.
6. **Local glow only:** emissive on the jaws, a short-range green light (0.42 m), small halos. Measured full-frame luma change at the bite in the tight insert: **+0.074** (target ≤ 0.08). Snap flash: **+0.016**. Brand green appears only at the glow peak. At rest the jaws are painted green (`#27B865`), so a glowing green rectangle never stands in for the mechanism.
7. **Practical light on the hero:** a caged bulkhead on the upright keeps the gear lit in every state and shot.
8. **One hero per macro shot:** no balustrade, mast or cable between the camera and the gear (lesson: no jail bars).

## 5. Measured (`scripts/frame_metrics.py`, 540 wide)
- Stills (5): near-black 0 %, vignette 0.71, texture energy 2.2, empty blocks 0.27, colourfulness 54, lit C\* p90 51, shadow b\* −12.9 / highlight b\* +25 (warm/cool split present). **p99 luma 0.78 (target ≥ 0.90)**. **Edge density 0.034 (target ≥ 0.045)**.
- Gear clip: no false cuts, longest static run 2 f. Jerk/speed is 0.66 because of the scripted bite kick plus the rail sliding past (a camera choice for the shots TD).
- Snap clip: jerk/speed 0.08. Peak 34 px720/f during the free fall (> 25): the follow camera needs more lag or a slower drop in the real shot.

## 6. Known weaknesses / next steps
- Too dark at the top end (p99 0.78) and hazy: needs brighter specular glints (rail tip, bolts, rope) or the Look TD's grade. Background edge density is still below target.
- In the medium framing the gear is ~13 % of frame height. It is identifiable but small. The story needs the X-RAY travel + insert (as planned), or a ¾ camera from the right.
- Rope pieces are rebuilt per frame (`TubeGeometry` + merge, about 8 meshes). Fine at this cost, but the strand texture slides a little as the curve changes.
- The left gear mirrors the right one (`scale.x = −1`) and has not been checked in close-up. The guide shoes are simple blocks.
- The governor rope/sheave is not modelled (the pull rod ends at a pivot block). Add it if a shot explains the trip.
- The test harness has its own minimal grade/bloom. Swap to `look/post` when it lands.
