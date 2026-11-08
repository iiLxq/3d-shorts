# Lamplit Gouache: HyTest shots, camera and animation standard (draft v1, shots agent)

Code: `remotion/src/lab/hybrid/shots/` (owned by shots).
- `timeline.ts`: every value as a pure function of the frame: beat sheet, story-time remap, camera keys, meter, Rafa clips.
- `engine.ts`: `ShotEngine`, which holds the set, the cast, the integration rig and the look post.
- `HyTest.tsx`: the canvas plus the SVG overlay (meter, FIG. 1 callouts, freeze/replay tag).
- `LabRoot.tsx`: the compositions `HyTest` (300 f) and `HyTestHold` (12 f, a camera-locked shimmer test).

Imports are read-only: `look/api`, `look/paint` (hazeTex), `set/shaft`, `cast/api`.

Commands:
- Stills: `cd remotion && ENTRY=src/lab/hybrid/shots/index.ts TMPDIR=<scratch>/rtmp_shots node scripts/stills.mjs HyTest <out> <frames> 0.5`
- Preview: `npx remotion render src/lab/hybrid/shots/index.ts HyTest out.mp4 --gl=swiftshader --scale=0.5 --concurrency=1`

Cost: **~1.1 s/frame at 540×960** (300 frames in 5 min 50 s, including the bundle). This is with full post: MSAA 4, ink, background blur, bloom and grade, plus 3 shadow maps (work lamp, headlamp, and the set's).

## 1. Two clocks
- **Screen time `f`** drives the camera, the overlays, the meter and the shakes.
- **Story time `S = story(f)`** drives the set, the mechanism and Rafa.
- `S = f` up to f212. Then:

| Screen frames | Story time |
|---|---|
| f212–227 | **0.5 s freeze**, S = 212 (sparks hang in the air, glow held) |
| f227–233 | **rewind**: S 212 → 205, eased |
| f233–250 | **slow-mo replay** at 0.35×; the replay bite is at f247 |
| f250–260 | rate ramps 0.35× → 1× |
| after f260 | S = f − 42 |

Use the same remap for any engagement moment. The camera stays on screen time, so it keeps creeping through the freeze. Every hold creeps.

## 2. Shot list (one continuous camera, 0 hard cuts)
| # | f0–f1 | Beat | State | Camera recipe | Key events |
|---|---|---|---|---|---|
| 1 | 0–74 | BLUEPRINT patent plate → print | BP, then sweep BP→SOLID f44–74 (rising, world-y plane −2.8 → 4.2) | **Descending push** from high-front (y 3.3, d 8.2 m) to medium-wide. Monotone cubic, one axis (forward + down), 0.35 %/f push. | FIG. 1 + 6 numbered leaders draw on f3–30 and fade f34–46. The set's own blueprint line art fades with the sweep, so it does not pop. |
| 2 | 74–128 | Rafa at work → snap → alarm → lurch | SOLID | **Low 3/4 from the right** (y 1.24, d 4.4) creeping in. Rafa sits on the left third, the ropes above him. Shakes: snap 0.006, **lurch 0.03 m + 0.012 rad roll, damped sine, gone in ≤ 12 f**. The camera rides the car with a lag (`follow` 0 → 1 over f111–137), so the lurch reads as the car dropping in frame. | Idle with the hand on the rail. **Look-up f86–98** (the headlamp beam swings up onto the ropes). **Snap S104**, beacon from S106. Dip f105–108 (anticipation), alarm recoil to f116 (`backOut` overshoot), terrified face from f110. **Lurch S110** (0.1 m + rebound), then crouch-grip f122. The tremble decays (τ 9 f). Meter: 0.1 → 0.5 (snap) → 0.62 (lurch). |
| 3 | 116–206 | X-RAY travel down to the rail | sweep SOLID→X-RAY f142–164 (top-down); X-RAY f164–190 | **Crane down/right, then dolly in.** f120 creep → f176 crane (x 0.98, y 0.4: the roof is edge-on and the gear shows through the gap between the car and the wall) → f206 insert. One move of 90 f; it eases in under the end of the lurch. | Hero **red force arrow** beside the gear (shots-owned, unlit `brandOut(red)`, pulsing) f150–194. The car falls at ≤ 0.48 m/s. Meter climbs to 0.95. Print sweep X-RAY→SOLID up through the gear f190–206. |
| 4 | 206–226 (+ freeze/replay to 250) | Side-on insert: the bite | SOLID | Front-on to the blade (the jaws close **left/right in screen**), d 1.35 m, fov 34. The look is aimed 0.13 m below the gear, so **the jaws sit at y ≈ 450–1000, above the caption band**. Creep-push 0.07 m. | Trip S198 (u² ride-up). **Bite S210 = clamp frame**: the meter is green on this exact frame. Local green glow 0.45 + 0.45·e^(−t/6). Local post flash 0.55·e^(−t/3.5) at the jaw. Sparks. Bite kick 0.006, replay kick 0.0015. Freeze f212–227, rewind, slow-mo. The tag top-left reads FREEZE / REWIND / REPLAY ×0.35. |
| 5 | 220–300 | Glide back to relieved Rafa | SOLID | **Pull back along the lens axis first** (zoom flow is low in the centre), under the slow-mo replay, from f220. Then a crane up/back to a full-figure 3/4 of Rafa (f298), then a settle creep. 78 f in total. | Jolt-dip at the stop (S210–214). **Relief exhale S222–240** (the left hand goes to the chest; the right hand stays on the rail). Blink at S229, behind which the face goes from alarmed to relieved. Smile mix S258. Alarm fades S214–244. **The work lamp warms ×1.25 and the haze warms f258–292.** |

## 3. Camera and animation standard (draft, reusable)
1. **Keys plus a monotone cubic** (`cr()` in `timeline.ts`, Fritsch–Carlson weighted-harmonic tangents) per channel: pos xyz, look xyz and fov.
   - C1, so velocity stays continuous through keys and a move flows into the next creep. It never overshoots a key, so there is no dip-back.
   - A creep key next to a fast move gives the ease-in/out automatically.
   - **Never use plain Catmull-Rom.** Round 1 overshot into the gear during the replay.
2. **Every key is a creep, not a stop.** Give each hold key a 2–10 % push to its neighbour. The measured quiet push is 0.35 %/f. 0 static runs.
3. **Budget big moves by flow, not distance.** Lateral flow ≈ v/d.
   - At d ≈ 3 m, ≤ 1.3 m lateral over ≥ 50 f stays under 25 px720/f.
   - Near a macro subject (d < 1.5 m), leave **along the lens axis first** (zoom flow ≈ 0 in the centre), then go lateral once d > 2 m.
   - Crane down while looking down: the tilt and the translation partly cancel. Crane up while tilting up: they add. Avoid that.
4. **Glides ≥ 20 f of attack and release.** The measured big moves are 37/64 f and 56/24 f.
5. **Shakes:** damped sine `A·e^(−n/3.6)·sin(1.25n)` on look.y (and pos.y × 0.35), plus an optional roll. Gone by 12 f. Never alternate the sign per frame (that is a jerk spike). Amplitudes: impact 0.03 m at d 4 m, macro 0.006 m.
6. **Follow:** the camera keys live in car space blended by `follow`. World framing before an event, then glide to car space over ~26 f. The event (the lurch) reads as motion in frame; afterwards the background slides and the subject holds.
7. **State changes are sweeps, never pops:** BP→SOLID rising, SOLID→X-RAY top-down, X-RAY→SOLID rising through the hero.
   - Switch `shaft.setState` at the sweep midpoint.
   - Call `setSweep` after `shaft.setState`, because setState writes `U.uState`.
   - Call `rafa.followLook()` every frame.
8. **Acting:** keyed poses (`cast/api keyed`).
   - Anticipation dip of 3 f before the reaction. `backOut` to the extreme 6–9 f after the cue.
   - Face leads the body by 1–2 f. Big expression swaps go behind a blink.
   - Additive breathe/drift/tremble layers keep the figure alive at all times.
9. **Integration recipe (per character):**
   - Parent the character to the moving set piece, with feet on its deck; the cast IK plants the legs and draws the contact shadows.
   - `handIK` to a real rail point, every frame after `setPose`.
   - Headlamp: SpotLight on `lampAnchor` (6, 8 m, 0.26 rad, shadow 512) plus a `beamMaterial` cone (0.16, 0.05 in X-RAY).
   - Cool rim spot from high behind (6, `#a6e2ee`).
   - The set key casts his shadow on the roof.
   - Turn the outline hull off (the post ink draws the BP lines).
10. **Overlays (SVG over the canvas):**
    - Meter: x 42–112, y 350–998. It has 16 segments, green→red in OKLab (no muddy midpoint). It **crashes on the clamp frame itself**, and its outline glows green for ~10 f.
    - Callouts: text slots in a right column at y ≤ 1000. Anchors are projected per frame, and callouts for anchors off screen are skipped.
    - Nothing sits in y 1050–1350 or y > 1536, and nothing in x < 140 except the meter.

## 4. Measured (`frame_metrics.py`, 540×960 preview, round 7 = final camera)
| Target | Result | |
|---|---|---|
| jerk / speed ≤ 0.08 | **0.063** (round 1: 0.125) | ✅ |
| peak ≤ 25 px720/f | **24.1** (round 1: 53.6; round 3: 29.0) | ✅ |
| glides ≥ 20 f ease in/out | travel 37/64 f, glide back 56/24 f | ✅ |
| quiet push ≥ 0.12 %/f | 0.35 %/f (median, quiet frames); static runs 0 | ✅ |
| false cuts | 0 hard cuts, 0 flashes detected | ✅ |
| shakes decay ≤ 12 f | by construction (e^(−12/3.6) = 3.6 %) | ✅ |
| near-black ≤ 2 % | max **0.15 %** (BP), 0.006 % SOLID | ✅ |
| p99 luma ≥ 0.90 | SOLID Rafa median **0.874** (max 0.93); end 0.84; insert after bite 0.99; BP 0.70 / X-RAY 0.72 (by design) | ❌ marginal |
| local flash: full-frame luma change ≤ 0.08 | **+0.079** at the clamp frame; replay bite +0.018 | ✅ (no margin) |
| shimmer ≤ 15 % (camera-locked hold, `HyTestHold`, Δ > 4/255) | **6.2 %** mean outside Rafa (max 16.6 % while the headlamp beam swings during the look-up); 3.7 % at Δ > 8 | ✅ mean |
| render ≤ 1.5 s/f at 540 | ~1.1 s/f | ✅ |
| SSIM ≥ 0.90 at delivery bits (540 preview → 1.9 Mbps 2-pass check copy) | 0.947 (generous: 4× the 540 bpp target) | ✅ |
| meter crashes green on the clamp frame | f209 amber-red, f210 green (pixel check) | ✅ |

## 5. Known issues and next steps
- **p99 in SOLID spans is 0.84–0.87.** Only the practicals reach white. The look TD should add a stronger helmet/rail glint, or lift the top value step under the work lamp. The freeze clips 2.3 % (green glow cores bleaching).
- **The clamp flash has no headroom (+0.079).** The insert is tight, so the glow fills a large share of the frame. Lower `flashAt` to 0.45 if the 1080 render goes over.
- **The X-RAY travel frames are busy.** The car's right resin face is seen at a grazing angle as a big cyan slab on the left (f160–190). This is a Fresnel-at-grazing issue for the look/set: clamp the resin Fresnel or fade the shell near the camera.
- **The replay bite is seen smaller** because the pull-back starts under it (a trade for the 25 px peak). A longer short can hold the insert through the replay.
- **f262–275:** Rafa's raised arm crosses the top-left corner during the crane.
- BP callout text is 30 px; the right column crowds at 540 preview. Use ≥ 34 px with fewer callouts (4) in a real short.
- Rafa's face is small in the medium framing (head ≈ 130 px). Expressions read through the mouth and brows. A real short needs a face close-up at the reaction.
- The set's force arrows are disabled here (they sit below frame). The hero arrow is shots-owned.
- `cast/garment.ts` (cast WIP) currently fails `tsc` (TS2739 at line 213). Bundling and rendering are unaffected. The cast TD should fix it.
