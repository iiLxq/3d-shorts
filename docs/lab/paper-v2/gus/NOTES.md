# Gus v2 lab: notes

Owner: Gus lab. Code: `remotion/src/lab/paper-v2/gus/` (entry `index.ts`, compositions `GusBoard`, `GusGyro`, `GusAct1s`, `GusAct2s`).
Contract for the World lab: `gus/api.ts` (`buildGus`, `setPose`, `setExpression`, `update`, `setState`, `lampAnchor`, plus `setCameraTrack`).
Everything here is a lab result, not production. v1 (`lab/paper/**`) was not touched; it is rendered on the same stage for every comparison.

## Deliverables (this folder)
| File | What it shows |
|---|---|
| `before_after.jpg` | v1 vs v2-A (5 heads) vs v2-B (5.5 heads), full body and mid shot, same stage and light |
| `turnaround_replacement.jpg` | replacement views at 0-90 deg (+ v1 at 45 and 75 for comparison) |
| `turnaround_vfold.jpg` | V-fold pop-up body at 0-90 deg |
| `expressions.jpg` | 8 expressions + profile / 3-4 / V-fold samples, plus a strip at true phone size (face ~120 px in a 1080-px frame) |
| `gyro_pairs.jpg` | camera-responsive body, off vs ON at matching frames, and the lean-vs-camera plot |
| `hero_1080.jpg`, `face_1080.jpg` | full-resolution stills |

Clips (scratchpad `lab/v2/gus/`): `gyro/gyro_{pan,tilt,orbit}_pair.mp4` (off left, on right), `act/act_1s_vs_2s.mp4`, `act/act1s.mp4`, `act/act2s.mp4`.

## Verdict in one paragraph
Recommended: **variant B (5.5 heads), replacement views (front / 3-4 / profile) as the turning method, camera-responsive body ON only for orbits and crane moves (gain 0.12-0.15), Gus animated on 1s for physical beats and on 2s only for idles and holds.** Gus stays recognizably Gus (white dome helmet + lamp, moustache, amber hi-vis with hoops and braces, tool belt + hammer, name tag, brass pins) but now reads as an adult technician rather than a toy. Honest caveat: v2 is less instantly "cute" than v1 and his face is smaller in wide shots, so acting beats need mid shots or closer.

## 1. Design spec (both variants 1.80 m including the helmet; "head" = chin to helmet top)
| | v1 | v2-A | v2-B (recommended) |
|---|---|---|---|
| Heads tall | 4.0 | 5.0 (head 0.36 m) | 5.5 (head 0.327 m) |
| Shoulder width | 1.3 heads | 1.42 heads (0.51 m) | 1.44 heads (0.47 m) |
| Chin to hip pivot | - | 1.56 heads | 1.69 heads |
| Leg (hip pivot to floor) | 1.6 heads | 2.44 heads (0.88 m) | 2.81 heads (0.92 m) |
| Hands | mitten gloves | bare cut-paper hands: palm + grouped fingers + thumb | same |
| Face (chin to brow) at full-body framing | - | ~140 px at 1080 | ~130 px at 1080 |

A is stockier and its face is ~8 % larger (better for wides); B is the more premium, adult silhouette. Recommendation B, but A is a valid fallback if wides must carry expressions.

## 2. Construction (`figure.ts`)
- About 110 printed cards and 12 brass split pins per drawing (front, 3/4 and profile are separate drawings, so ~330 cards for the replacement set). Body card 12 mm, face card 2-6 mm at set scale; every cut edge shows a white card core.
- Jacket: amber body cut in two halves at the zip, navy yoke, reflective tape hoops (cut at the zip) and braces, flap pockets with brass snaps, stand-up navy collar, zip placket with a steel pull, radio, name tag, leather tool belt with brass buckle, kraft pouch, swinging hammer. Layers sit 4-20 mm apart so the key casts real shadow gaps.
- Trousers with cargo pockets and stitched knee pads; boots with toe cap, laces and a thick sole card. Arms: amber sleeves, navy shoulder cap with the shoulder pin, tape band, navy cuff.
- Hands: palm card, grouped-fingers card (cut slits between fingers, swaps to a fist card above 0.8 curl), thumb card pinned on top.
- Face: head card with **die-cut eye windows**; eye white, iris and pupil sit behind it, upper and lower lids slide behind the window. Brows rotate and lift on top. Long adult nose (bridge plus tip), trimmed chevron moustache with printed strands, greying temples as separate grey card layers (not speckle), soft printed stubble shadow, crow's feet. No halftone anywhere; volume comes from soft printed washes plus real layer shadows.
- Amber is exact: `AMBER_TINT` (1.07, 1.10, 0.72) calibrates the print under the stage key and the grade. Measured lit jacket on screen: (249-253, 171-176, 37-41), **dE00 0.6-1.7** (whole jacket including printed shading 2.0-3.9). v1 was dE ~11.5. If the World lab's key differs, re-measure and adjust `AMBER_TINT` (method: lit-jacket median, top 25 % of saturated amber pixels).
- States: `setState(0)` cyanotype with amber line art and amber edges; `setState(1)` amber vellum (50 % opacity, layered darkening, amber glowing edges, brass pins visible as the armature); `setState(2)` colour card.

## 3. Expressions (`poses.ts` EXPRS, `api.ts` applyExpr)
neutral, focused, curious, alarmed, terrified, wincing, relieved, smiling. Continuous channels (lid, lower lid, gaze, pupil size, per-side brow lift, brow inner angle, moustache lift) blend; mouths are **swapped** cut-outs (9 front, 5 profile shapes), never morphed. Auto-blink is a seeded 5-frame lid slide every 70-130 frames (turn it off for stills). The phone-size strip in `expressions.jpg` shows all eight reading at a 120 px face. Weakest reads: curious vs neutral (only the asymmetric brow and the small "o" separate them) and relieved vs wincing at phone size (both have closed lids; the mouth separates them).

## 4. Turning beyond 35 deg (recommendation: **replacement**)
- **Replacement** (`turnaround_replacement.jpg`): front for |θ| < 22.5 deg, 3/4 to 67.5 deg, profile beyond, mirrored for the other side. ±3 deg hysteresis and a **4-frame paper flip** (card width 0.7, 0.3 | 0.3, 0.7). It is computed from the camera track, so it is deterministic and never parks mid-flip. It works to 90 deg and reads as a real turned figure. Costs: 3x cards, and each drawing is a flat plane, so it is lit by its plane's orientation (a 3/4 or profile drawing facing away from the key goes dim; see R60/R90). Light per shot. Back views (>~110 deg) are not built.
- **V-fold** (`turnaround_vfold.jpg`): the front drawing folded 22 deg down the centre line (head, nose tent, moustache, helmet and jacket halves). It has lovely real parallax up to ~30-45 deg, but it collapses edge-on past ~55 deg, and the centre seam is visible down the face, lamp and helmet. Not recommended as the main method. Worth testing next: a shallow 8-10 deg fold *inside* the replacement front drawing for parallax in small moves.

## 5. Camera-responsive body (`gyro.ts`, `gyro_pairs.jpg`, clips `gyro/*_pair.mp4`)
Upper body from the hips yaws, pitches and banks by gain x camera change. The spring is critically damped and evaluated as its impulse response w(k) ∝ k·e^(-k/5) over the camera track (mean lag 10 frames, no overshoot). It is deterministic for out-of-order frames when `setCameraTrack` is given. Legs stay planted (IK); the hips shift against the bank. Render-time values match the node plot exactly.
| Test (60 f) | Camera change | Peak response | Pixels changed vs off |
|---|---|---|---|
| Pan (camera turns in place) | 6 deg | 0.4 deg yaw | 0.1 % (invisible) |
| Crane/tilt (elevation) | 28 deg | 3.6 deg lean back | 2-3 % (subtle) |
| Orbit | 64 deg | 7.8 deg yaw + 3.3 deg bank | 14 % |
**Frank verdict:** it never looks robotic (no overshoot, a smooth lag), but on a phone only the orbit really registers. In the orbit its main visible effect is that Gus "keeps half an eye on the lens": the front drawing is held to ~24 deg instead of swapping to 3/4 at 22.5 deg. That is useful (fewer swaps), but it also cancels part of the turn the orbit is meant to show. Recommendation: per shot, ON for orbits and crane moves during hold beats (gain 0.12-0.15), OFF for reveals where the turn is the point, irrelevant for pans. Please watch `gyro_orbit_pair.mp4` and `gyro_tilt_pair.mp4` yourself: I judged motion from measured curves and stills, not by watching playback.

## 6. Acting (`act/act_1s_vs_2s.mp4`; showcase idle 0-59, alarm 60-104, relief 105-149)
- Idle: 110-frame weight shift (pelvis over the standing leg, hip up, torso counter-lean, head re-levels), arms close to the body with a 7-frame secondary lag, breathing, gaze holds with quick saccades. No airplane arms.
- Alarm: 6-frame anticipation dip ("huh?", focused face), a 7-frame recoil with back-ease overshoot to a hands-up "whoa", the face cut to terrified, then settle and a decaying tremble. An earlier version spread the arms like an airplane; I caught it in review and fixed it.
- Relief: inhale (shoulders and head up), long exhale slump with the lids closing, then a hand on the chest and a smile.
- **Ground contact (director A6):** front-view legs foreshorten (straight hip-to-ankle, scaled to length) instead of bowing sideways; side views bend the knee forward. **Foot-lock check: max sole drift 0.08 mm over all 150 frames (limit 1 mm), soles at y = 0.000**, through weight shifts, recoil and gyro bank. The real cast shadow comes from the key's 2048 PCF-soft map (cards cast onto each other, the floor and the backdrop), plus a small sole-shaped contact-occlusion card per boot (not a round blob).
- **1s vs 2s:** on 2s the change between steps alternates 3.3 / 10.2 (camera-only step / pose step) in the alarm, so it is a real stop-motion staccato, and the camera on 1s means frames never freeze. On 2s the 7-frame recoil keeps only 3-4 poses and loses most of its overshoot. Recommendation: Gus on 1s for fast physical beats (recoil, the clamp hit), on 2s for idles, holds and expression pops. `actShowcase(f, onTwos)` and `GusOpts.onTwos` support both.

## 7. Contract notes for the World lab (`api.ts`)
`buildGus({ variant: "B", method: "replacement" })`, then each frame: `setPose(name | partial PoseData, w)`, `setExpression(name | ExprData, w)`, `setCameraTrack(f => cameraAt(f), shotStart)` (needed for the paper flip and a deterministic lean), `update(frame, camera)`, `setState(0|1|2)`. `lampAnchor` follows the visible drawing's headlamp (point a SpotLight along its +z). `gus.debug` exposes view, θ, lean and sole positions for QA. Pose and acting helpers: `POSES`, `EXPRS`, `mixPose`, `mixExpr`, `actIdle/actAlarm/actRelief/actShowcase` in `poses.ts`. Gus keeps its own copies of card/paint/post (`gus/card.ts`, `gus/paint.ts`), so its cards are not in the world's `setLookAll`: call `gus.setState`.
**Pipeline bug found (affects v1 and possibly the World lab):** R3F's Canvas re-applies `gl.shadowMap.enabled = !!shadows` on every render, so with the v1 LabRoot pattern (no `shadows` prop, enabled once in `useMemo`) **only the first frame of each render has shadows**. Fix: `<ThreeCanvas shadows="soft">` and set `gl.shadowMap.enabled = true` before each `post.render()` (done in `gus/LabRoot.tsx`).

## 8. Render cost (swiftshader, shared 4 CPUs, load ~6, concurrency 1)
- 540x960 with a 2048 PCF-soft key shadow, 40-tap lens blur and bloom: **~0.65 s/frame** (GusGyro 360 f in 4 min 25 s including bundling). Board stills ~0.5 s each in one page.
- 1080x1920 stills: ~2-4 s/frame (2 stills in 9.5 s including the bundle and page build).
- Page build (painting ~330 + v1 canvases): 1.3-2.3 s on the first frame.

## 9. Weaknesses (honest)
1. Flat drawings are lit as planes: 3/4 and profile go dim when they face away from the key. Each shot needs key placement (or a printed-light boost per drawing).
2. The front-view arm vocabulary is limited: in-plane gestures only. A "guard in front of the chest" reads better in 3/4 or profile; in front it becomes a hands-up "whoa".
3. The replacement swap is a visible stop-motion event. That is a style choice; hide it in fast moves or on cuts. No back views.
4. The face is small in wide shots at 5.5 heads, so acting needs mid shots. Curious vs neutral is subtle at phone size.
5. B's name tag is partly covered by the right pocket flap (the leaner jacket has no room between the chest band and the pocket). This is a layout fix still to do; the 1080 hero and acting clips have the tag on the upper chest.
6. The V-fold seam is visible on the face; the V-fold is limited to ~45 deg.
7. Profile mouths are simplified (5 shapes), and the profile mouth sits slightly proud of the face.
8. The gyro was judged from curves and stills, not from watching playback.
9. Hands have no finger articulation beyond curl/fist + thumb; there is no point pose yet.

## Reproduce
`cd remotion && TMPDIR=<scratch> npx remotion render src/lab/paper-v2/gus/index.ts GusBoard <dir> --sequence --scale=0.5 --gl=swiftshader --concurrency=1 --image-format=jpeg` (frames: 0-5 before/after, 6-12 replacement, 13-19 V-fold, 20-27 expressions, 28-29 profile and 3/4 faces, 30-31 blueprint and vellum, 32-33 heroes, 34-35 v1 limits, 36 V-fold face, 37 key-only debug); `GusGyro`, `GusAct1s`, `GusAct2s` the same way as mp4. Plot: bundle `gyroTests.ts` + `gyro.ts` with esbuild for node (scratchpad `plot/`).
