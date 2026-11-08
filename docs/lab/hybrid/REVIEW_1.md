# HyTest review 1: independent art direction and technical QA

Reviewer: an independent senior animation director and technical QA. I did not make this work.

Material reviewed:
- `hytest_preview.mp4` (540×960, 300 f) and `hytest_check_1900k.mp4`.
- A contact sheet of every 10th frame: `scratchpad/review_hytest1/sheet_all.jpg`.
- Full-size frames f96, f114, f176 and f212, plus a strip of f0, f176 (1.9 Mbps), f248 and f299.
- `frame_metrics.py`: `review_hytest1/metrics/`.

"Phone size" means the 0.5-scale sheet. Frame numbers refer to the preview.

## Verdict
**It does not look premium yet.** At phone size it reads as a competent **real-time game or stylised-CG test**: a smooth CG worker in a grey box lined with a scribble texture.
- It does not read as a painted gouache world. Nothing on screen says "gouache" except some wall strokes, and those read as **OSB/particle board**.
- The camera numbers pass. The image does not, for these reasons:
  - The values are milky and grey.
  - The background is noise rather than design.
  - The snapped ropes look like garden sprinklers.
  - The hero mechanism is two flat green triangles in a black box: a road-sign icon, not machined steel.

## Scores (1–10)
| Criterion | Score |
|---|---|
| Premium feel at phone size | **4** |
| Originality / ownability | **4** |
| Lighting & mood | **5** |
| Environment / material quality | **3** |
| Character appeal & acting | **5** |
| Character–environment integration | **5** |
| Mechanism readability | **6** |
| Camera & motion | **6** |
| Signature-state fit (BP / X-RAY / SOLID + meter) | **6** |
| Compression robustness | **7** |
| **Mean** | **5.1** |

## Key measurements (frame_metrics, 270×480 analysis)
| Span | luma p1 | luma p99 | RMS contrast | sat mean |
|---|---|---|---|---|
| BP f0–44 | 0.089 | 0.70 | 0.172 | 0.84 |
| SOLID Rafa f74–128 | **0.156** | 0.874 | **0.148** | **0.31** |
| X-RAY travel f128–164 | **0.165** | 0.82 | 0.145 | **0.26** |
| Insert, bite and freeze f206–227 | 0.126 | 0.99 | 0.206 | 0.34 |
| Replay f227–260 | **0.165** | 0.71 | **0.129** | **0.24** |
| Glide back f260–300 | **0.160** | 0.83 | 0.143 | **0.24** |

- **Camera:** jerk/speed 0.058; peak 24.2 px720/f; 0 cuts; 0 static runs; push 0.35 %/f. Moving in 100 % of frames: there is never a single settled composition.
- **Grade:** whole-clip palette (k = 6) is 88 % grey-teal (`#3C4D59`, `#143042`, `#707A77`); amber is only 2 %. Highlight hue is 158° (green-grey), not warm (hi_b 3.6 median).
- **Lit jacket:** samples measured RGB ≈ (254, 184–193, 80–117), a pale peach. That is ΔE76 ≈ 15–30 from `#FFB020`. The sample is rough because it includes some stripe pixels.
- **Compression:** PSNR, 1.9 Mbps vs the preview, at the same 540 size, is 31.4–33.8 dB. The worst is f299 (dust and scribble walls). This is at 4× the real bits per pixel, so it is not yet the 1080 @ 1.9 Mbps test.

## Defects and causes (every score below 8)

### Premium feel: 4
1. **f74–300: milky, low-contrast image.** SOLID p1 is 0.156–0.165: the darkest 1 % sits at about 40/255. RMS contrast is 0.13–0.15 and saturation 0.24–0.31.
   - *Cause:* haze, the ambient fill and the grade all lift the shadows. Nothing in SOLID goes to a deep accent dark, so the frame has no value anchor and looks like an unlit viewport. (look: post/grade, haze density.)
2. **f74–300: about 70 % of every frame is wall, and the wall is a field of random short dashes.**
   - *Cause:* a procedural stroke texture with no large-scale design: no brick courses, formwork panels or stains. It reads as OSB board or carpet, not painting. (look: paint.ts; set: wall layout.)
3. **f110–300: the snapped ropes form four upward arches with frayed tips** (most visible at f114, f130, f280 and f299). They read as sprinklers, tentacles or party poppers, and they stay up until the last frame.
   - *Cause:* the rope snap is a spring-up pose with no gravity, fall or slack. (set: setRopeSnap.)
4. **f206–260: the hero jaws are flat, unlit, saturated-green triangles inside a black box with a starfield speckle.**
   - *Cause:* the jaws use an emissive brand material all over instead of lit steel with a green edge or engagement glow. (set + look.)
5. **f100–300: the dust is uniform white discs that read as snow.** The sparks (f212–227 and the f250 replay) are round dots that read as bokeh or confetti, not streaks.
   - *Cause:* the particle sprite has no motion-blur stretch and no size or brightness falloff. (look/set particles; shots for the spark emitter.)

### Originality / ownability: 4
1. **Rafa (f74–130, f260–300)** reads as a generic stylised game NPC: smooth-shaded body, bulging white eyes, glove "claws", and a jacket with hi-vis stripes. Nothing on him is painterly or graphic-novel.
   - *Cause:* the gouache value-step and paint texture are too weak on the cast material at this scale, and there is no ink or brush edge on the silhouette. (look shade + cast.)
2. **The BLUEPRINT (f0–44) is an every-edge "Tron" wireframe, not a patent plate.**
   - FIG. 1 and the callouts are about 10 px tall at 540, so they cannot be read on a phone.
   - There are no numerals at legible size, no dashed hidden lines and no section hatching.
   - *Cause:* the post ink draws all edges at one weight. The callouts are 30 px at 1080 and too many. (look: ink-weight hierarchy; shots: callouts.)
3. **The mechanism icon at f210 is generic signage**, not an owned visual. (set.)

### Lighting & mood: 5
1. **No dark periphery or pool of light.** The work lamp lights Rafa, but the walls around him are almost as bright.
   - *Cause:* the ambient and haze level are too high and there is no vignette or negative fill. (look.)
2. **Highlights are not warm** (hi hue 98–158° in SOLID), so the planned "warm lamp vs cool ambient" split barely reads. The relief warm-up at f258–292 is not visible on the sheet.
   - *Cause:* the work-lamp colour is desaturated by the grade. ×1.25 is too subtle. (look grade; shots warm-up amount.)
3. **The red danger is a dull maroon panel behind Rafa** (f110–150). There is no readable beacon source or rhythm.
   - *Cause:* the beacon is placed behind or off frame, and its spill is muddied by the grade. (set: beacon placement; look.)
4. **The vertical orange LED strips (f74–300) read as UI lines or neon,** not as practical fixtures. (set.)

### Environment / material quality: 3
1. **The guide rail looks like wood:** brown, streaky planks at f176 and f200–260.
   - *Cause:* the paint texture tint and stroke pattern on the steel material. The rail needs a machined, bright edge. (look materials + set.)
2. **The X-RAY shells (f160–200) are opaque, flat cyan slabs.** The car's grazing face fills about 35 % of the frame on the left.
   - *Cause:* the resin Fresnel is unclamped at grazing angles and there is no near-camera fade. This is already listed in SHOTS §5 and is unfixed. (look.)
3. **The gear housing interior is black with white speckles (f212),** which reads as a starfield.
   - *Cause:* a noise texture on a dark material. (look/set.)
4. **The boxes and crates on the roof are untextured grey cubes** (f74–130, f240–260). (set.)

### Character appeal & acting: 5
1. **f96: "airplane arms".** Both arms are spread at shoulder height during the idle, close to the T-pose that REVIEW_ART banned. (cast/shots pose keys.)
2. **The face is about 130 px tall at 1080 and about 65 px on the preview.** The alarm (f110–130) reads only as white eyes. There is no close-up. (shots.)
3. **The jacket shows dark paint-chip speckles,** which read as dirt or low-res noise instead of brushwork. (look paint / cast garment texture.)
4. **The hands are mitten claws with no finger poses.** (cast.)

### Character–environment integration: 5
1. **The rendering languages clash:** a smooth CG figure against scribble-painted walls. (look: one shading recipe for both.)
2. **f96: a blue box in the foreground hides Rafa's feet.** No contact shadow is readable. (shots staging / set prop.)
3. **f150: Rafa is cut in half at the left edge,** inside the meter strip.
4. **f280: Rafa's head and shoulder sit under the meter.**
5. **f299: his elbow crosses x < 140.** (shots.)

### Mechanism readability: 6
1. **f60–90: green jaws are visible as triangles at the bottom-left and bottom-right corners.** That is in the bottom 20 % and the meter strip, and it spoils the payoff. (set/shots: hide the gear until X-RAY.)
2. **f176: the gear occupies about 150 px of the 540 width** behind a grey bar. The red arrow sits on the car edge, not on the force path into the jaws, and has a white ring artifact at its top. (shots.)
3. **f240–260: the replay bite is small (about 25 % of the width)** and a large grey car corner fills the left 35 %. (shots: hold the insert through the replay.)
4. **There is no visual reason the jaws move** (no governor or lift-rod cue). (set.)

### Camera & motion: 6
- The metrics pass. The defect is composition: constant floating with no held key composition.
- The bite is not given a stronger punctuation than the push.
- Crops: f150, f262–275 (arm in a corner) and f280 (see Integration).
- *Cause:* one continuous move was chosen over cuts, and the composition was not checked at the frame level.

### Signature-state fit: 6
1. **The BP is unreadable as a patent plate** (see Originality 2).
2. **The X-RAY is not translucent,** and the camera does not go "inside" the car.
3. **The freeze tag (f212–260) sits next to the meter** at the top left and crowds it.
4. **No loop ending** (not required for this test).
- The meter (left, rise, green on f210), the freeze, the rewind and the slow-mo all work.

### Compression robustness: 7
1. **f299 is the worst frame (31.4 dB).**
   - *Cause:* high-frequency scribble walls plus about 100 dust discs.
2. **Not yet tested at real delivery bits** (1080 @ 1.9 Mbps).
3. **Banding risk** in the lifted, grey shadows.

## Prioritized fix list
| # | Owner | Fix | Acceptance check |
|---|---|---|---|
| 1 | look (post/grade) | Re-grade for depth: crush the periphery, cut the haze and ambient by about 40 %, add a soft vignette, and keep teal/violet coloured shadows. | SOLID spans: luma p1 ≤ 0.07, RMS contrast ≥ 0.19, p99 ≥ 0.90, near-black ≤ 2 %. |
| 2 | look (paint.ts) + set (walls) | Replace the dash-noise walls with **designed large shapes**: formwork panels and tie holes, brick courses, 2–3 big painted stain gradients, and low-frequency brush only. | No texture period below 8 px at 1080. Walls' local contrast is less than half the subject's (sharp_periph/sharp_centre ≤ 0.35). PSNR at 1.9 Mbps is ≥ 33 dB on f280–299. |
| 3 | set (gear) + look (materials) | Rebuild the jaws as **lit, machined steel wedges** with bevels and a knurled face. Green is only an emissive rim or edge plus a local glow on engagement. Housing is painted metal with no speckle. | At f212: green pixels (ΔE00 ≤ 8 vs `#39FF88`) cover ≤ 25 % of the gear bbox, and the steel faces show ≥ 3 distinct value steps. |
| 4 | set (setRopeSnap) | Snapped ropes **whip, then fall and hang slack under gravity** (catenary, settles in ≤ 20 f). No upward arches after f125. | Every rope tip is below its break point from f125 on. No rope inside Rafa's head bbox at f260–300. |
| 5 | look (shade) + cast | Make the cast **painted**: 3–4 hard value steps, a brush-edge terminator, a thin coloured (not black) silhouette line, flat-painted skin planes, and no speckle noise on the garments. | On a 1080 frame of Rafa's torso, the luma histogram shows ≥ 3 separated peaks. The jacket speckle (local std over 6 px) is ≤ 50 % of the current value. |
| 6 | look (colors/grade) | Protect the brand amber under every light: grade highlights warm, and stop the haze washing the jacket to peach. | Lit jacket (stripes excluded) ΔE00 ≤ 5 vs `#FFB020` at f96, f114, f290. hi_hue in SOLID is 40–80°. |
| 7 | look (materials) + set (rail) | The rail is steel: cool grey with a bright machined running face, not brown streaks. | Rail hue is not within 20–50° with chroma > 8 at f176 and f230. There is a specular strip with p99 ≥ 0.9 on the rail at f212. |
| 8 | look (resin) | Clamp the X-RAY resin Fresnel and fade shells near the camera, so the inside reads (gear, rail, Rafa's bones line). | f160–200: no single flat cyan region over 12 % of the frame. The gear bbox is ≥ 35 % of the frame width by f190. |
| 9 | shots (staging) | Fix the crops and collisions: Rafa never cut by the left edge or under the meter. Hide the gear's green until the X-RAY (or the set masks it). | x < 140 at 1080 contains only the meter in all 300 f. No green-brand pixels outside the gear shot before f142. Zero frames with Rafa's bbox partly out of frame. |
| 10 | shots (camera) | Add **held compositions**: a 10–14 f near-still creep on the snap reaction (a face close-up, head ≥ 300 px at 1080) and on the bite. Hold the insert through the replay. | Head height ≥ 300 px at f112–125. Gear width ≥ 45 % of the frame through f227–250. Speed < 2 px720/f for ≥ 10 f around f115 and f212. |
| 11 | shots (callouts) + look (ink) | The BP becomes a patent plate: FIG. 1 at ≥ 60 px, 4 callouts with numerals at ≥ 34 px, a 2-weight ink hierarchy (heavy silhouettes, hairline interior), dashed hidden lines and a navy paper grain. | At 540, all callout text is ≥ 17 px tall. Interior edge density in BP ≤ 60 % of the current value. |
| 12 | set + look (particles) | Dust: 30–50 motes with size and brightness falloff and DOF. Sparks: velocity-stretched streaks with cooling colour (white → amber → out). | No mote over 3 px in f100–300. Spark length/width ≥ 4 at f210–214. |
| 13 | set (practicals) + look | Make the red beacon a visible rotating source with rhythmic sweeps. Turn the LED strips into real fixtures (housing + glow), or cut them. | A beacon source is visible in frame at f106–150. Red spill reaches ≥ 0.6 luma peak on the wall once per ≤ 20 f, then falls back. |
| 14 | cast + shots (poses) | Kill the airplane-arms idle. Give the hands finger poses (grip, point, chest). | At f80–100: both elbows below shoulder height, with ≥ 1 hand in contact with the rail or a tool. |
| 15 | shots (QA) | Re-run at 1080×1920 with a 2-pass 1.9 Mbps copy and measure. | SSIM ≥ 0.90 and PSNR ≥ 33 dB on f0, f114, f176, f212 and f299. |
