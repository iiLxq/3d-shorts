# Pipeline audit: why video #1 looks cheap (measured)

Subject: `videos/01_ram_air_turbine/out/plane_windmill_full.mp4` (58.5 s, 1755 f). Tool: `scripts/frame_metrics.py`
(+ `scripts/frame_metrics_report.py` for side-by-side deltas). Reference = the 38 private study stills in
`references/external/.../frames` (20 top Shorts, frames 60/180, captions masked) for still-image metrics, and the
published reference camera numbers in that folder's `reports/motion.md` (same method: sub-pixel phase-correlation
similarity fit, px at 720 wide, hold < 0.3 / drift < 2 / move >= 2) for motion. Methods and numbers only; nothing copied.

How it was run (scratch outputs, not committed):
```
python3 -I scripts/frame_metrics.py videos/01_ram_air_turbine/out/plane_windmill_full.mp4 <out> --label ours_v1 \
  --bounds 2.40,5.10,8.10,12.00,14.60,15.95,19.80,21.15,22.90,24.05,26.00,28.15,28.65,30.25,33.20,34.35,37.95,41.00,43.45,45.50,47.95,51.20,53.65
# stills compared at the same grid (540x960): our video every 30th frame vs the reference stills
python3 -I scripts/frame_metrics.py <ours_every_30th_frame_dir> <out> --stills --width 540
python3 -I scripts/frame_metrics.py references/external/claude-animated-shorts/references/frames <out> --stills --width 540 --mask-band 1300,1412
python3 -I scripts/frame_metrics_report.py <ours_out> <ref_out>
```
Full-video analysis runs in ~2.8 min on one core at 270x480.

## 0. Tool validation (`--selftest`)

Synthetic 472-frame clip (rich texture + navy/cyan blueprint line art with a grid, H.264 CRF 18), known camera:

| test | truth | measured | error |
|---|---|---|---|
| static hold (82 f) | 0 | 0.0001 px720/f, 0.003 %/f | 99 % frames classed "hold" |
| slow push 0.08 %/f | 0.080 | 0.0805 %/f | 0.6 % |
| slow push 0.15 %/f | 0.150 | 0.1516 %/f | 1 % (100 % classed moving; a naive tool says "still") |
| push 0.30 %/f + 0.05 deg/f roll | 0.300 | 0.2904 %/f | 3 % |
| pans 0.27 / 1.0 px720/f | | MAE 0.034 px720/f | 97.5 % class agreement |
| smootherstep glide, peak 8.31 px720/f | 8.31 | 8.17 | 2 %, MAE 0.15 px720/f per frame |
| hard cuts | 2 | 2, 0 false positives | recall 100 % |
| clean 30 f glide jerk/speed | | 0.022 | baseline for "smooth" |

Zoom MAE over all zoom frames 0.007 %/f. The log-polar (Fourier-Mellin) cross-check is only good for >= 0.3 %/f
(0.278 at 0.30; under-reads slow pushes), so the tile fit is the primary number.
Limits: it measures **image** motion (dominant field), so a screen-locked background reads as "camera still" even
when the 3D camera moves; `flow_p90_px720` / "any region moves" covers the subject. Untextured tiles (sky
gradients, flat paint) are skipped (high-pass std < 0.003); on video #1 only 0.1 % of frames were untrackable.

## 1. Our numbers vs reference

### Stills (540x960, medians; ours = 59 frames, 1/s)
| metric | ours | reference | delta |
|---|---|---|---|
| empty (flat) 16 px blocks | **0.86** | 0.54 | +60 % |
| edge density | **0.016** | 0.058 | -73 % |
| dark ink-line density | **0.002** | 0.024 | -90 % |
| bright-line density | 0.009 | 0.032 | -70 % |
| surface texture energy | **0.71** | 1.80 | -60 % |
| Laplacian var centre (detail) | 2.5 | 9.6 | -74 % |
| colourfulness (Hasler-Suesstrunk) | **33** | 69 | -52 % |
| lit chroma C* p50 / p90 | 18 / 29 | 28 / 51 | -34 / -43 % |
| shadow b* / highlight b* | **-14.9 / -13.4** | -5.1 / +6.3 | no warm/cool split |
| median luma | 0.21 | 0.33 | -36 % |
| luma p99 (near-whites) | 0.81 | 0.95 | -14 % |
| % clipped > 245 (speculars, glints) | 0.00 | 0.38 | none |
| % near-black < 16 | 2.5 | 0.5 | 5x |
| vignette corner/centre | 0.79 | 0.68 | ok (target 0.85) |
| noise sigma (x255) | 0.22 | 0.27 | ok |

### Per Fail-Safe state (same stills)
| state | luma p50 | luma p99 | empty | colourful | lit C* p90 | shadow b* / hi b* | edge dens | texture | vignette |
|---|---|---|---|---|---|---|---|---|---|
| BLUEPRINT (0-12 s, the hook) | 0.094 | **0.38** | 0.70 | **28.6** | 21 | -16 / -20 | 0.015 | 0.76 | 0.71 |
| X-RAY (12-22.9 s) | 0.075 | 0.62 | 0.78 | 48.7 | 34 | -15 / -19 | 0.021 | 0.81 | **0.30** |
| SOLID (22.9-38, 53.7-58.5 s) | 0.62 | 0.84 | **0.89** | 55.7 | 29 | **-15 / -13** | 0.014 | **0.48** | 0.85 |
| SEPIA (38-53.7 s) | 0.53 | 0.96 | 0.89 | 30.5 | 30 | +14 / +25 | 0.021 | 0.70 | 1.04 |
| reference | 0.33 | 0.95 | 0.54 | 69 | 51 | -5 / +6 | 0.058 | 1.80 | 0.68 |

### Camera (full video, every frame)
| metric | ours | reference (motion.md) |
|---|---|---|
| hold / drift / move (dominant field) | **59.6 / 28.5 / 11.9 %** | 10 / 24 / 65 % |
| frames where any region moves >= 0.3 px720/f | 82.9 % | (n/a) |
| median speed | 0.20 px720/f | 3.6 |
| moves (>= 2 px720/f) per 10 s | 3.8 | 6.0 |
| median move peak | **3.4 px720/f** (max 17.2) | 13.7 |
| attack / release (median) | **4 / 6 f** | 10 / 10 f |
| push-in in quiet frames, median | **0.012 %/f** | 0.14 %/f |
| frames zooming >= 0.05 %/f | 37 % | 70 % |
| RMS jerk / RMS speed | **0.31** | clean smootherstep glide 0.022 |
| hard cuts | **14** (2.4 per 10 s) + 3 flashes | shot list planned 2 |
| longest dead-still run | 66 f (f 244-309, shot 4) | playbook: none >= 4 f |

## 2. Why it looks cheap (ranked by impact)

1. **The frame is mostly empty: a small object floating in a void.** 86 % of 16 px blocks are flat (reference 54 %);
   SOLID shots 89 %. Observed: plane at ~10-15 % of frame width in the hook (sheet t=0-11 s), RAT close-up against a
   bare blue gradient (f 840), sky with no clouds/ground/horizon in every SOLID air shot (f 1650), sepia "farmland" is a
   flat beige plane with a hard horizon (f 1440). No environment = no scale, no speed, no story place. Reference frames
   are dressed edge to edge (rooms, streets, props). This is the single biggest "homemade" tell.
2. **Untextured, primitive geometry.** Surface texture energy 0.48 in SOLID vs 1.80 (-73 %); edge density 0.016 vs
   0.058 (-73 %); centre detail 2.5 vs 9.6 (-74 %). Observed: the RAT is one green cylinder + strut with a sliver of
   blade (f 840); the belly is two flat grey slabs + an unlit pure-black door; the 767 has no windows, panel lines,
   livery, or doors (f 1650); the "car window" is a red box. `plane.ts` builds the jet from ~18 primitive calls;
   `solidMaterial` (looks.ts) is a single flat albedo.
3. **Flat, shadowless lighting; no speculars.** Custom Lambert with hemisphere ambient 0.42-0.50 against key 1.25
   (looks.ts L150-153): shadow sides stay at ~35-40 % of lit, no cast shadows, no AO, no environment reflections,
   no composer/bloom. Measured: 0.00 % clipped pixels vs 0.38 % and p99 0.81-0.84 vs 0.95, i.e. no glints on metal,
   no near-whites; objects read as matte clay/plastic.
4. **Monochrome blue colour, no warm/cool split.** Colourfulness 33 vs 69 (-52 %); lit chroma p90 29 vs 51.
   SOLID highlights are as blue as the shadows (b* -13 / -15; reference warm highlights +6, cool shadows -5).
   Overall palette (k=6): navy 47 %, pale sky blue 15 %, sepia 20 %; red/amber/green appear only as small accents.
5. **No characters (faceless person in ~8 % of frames).** Observed: the only human is an amber block figure with no
   face (pilot/captain, ~5 of 59 sampled frames, plus hands). Reference stills show an expressive character in about
   two thirds of frames. The viewer has no one to feel the danger through; the "amber = person at risk" code is a prop.
6. **Camera grammar: mostly dead-still field, small moves, many hard cuts, jerky action shots.** Field hold 60 % vs
   10 %; quiet push-in 0.012 %/f vs 0.14 %/f (the coded `creep` 0.15-0.6 %/f is invisible because it only scales a
   small subject while the empty or screen-locked background does not change); moves peak 3.4 vs 13.7 px720/f with
   4/6 f attack/release vs 10/10; 14 hard cuts (shot list says cuts only at 18 and 24; `story.ts` jumps to a new
   orbit each shot); 3.9 s near-static in shot 4 (glide-ratio diagram, 0.9 % of frames with any motion) and 4.5 s of
   zero camera motion on the fuel gauge (shots 19-20). Jerk/speed 0.31 vs 0.022 for a clean glide, worst in shots
   10-14 (f 700-865, jerk 4-8 px720/f^3 at 5-17 px720/f), i.e. the print/hatch/RAT drop/lock sequence stutters.
7. **No parallax or depth.** The blueprint/x-ray grid is a CSS background (`RatShort.tsx` Background) locked to the
   screen, so in shots 1-4 the dominant field reads 0 % moving while the 3D camera glides (only the thin plane lines
   move: "any region moving" 94-100 %). No fog/atmospheric perspective, no foreground framing, no DOF pass (no
   EffectComposer at all). Ours has almost no out-of-focus areas because almost nothing is in the periphery.
8. **The hook is the dimmest, dullest part.** BLUEPRINT 0-12 s: luma p50 0.094, p99 **0.38** (the cyan lines never
   reach a bright value), colourfulness 28.6, bright-line density 0.013 vs 0.032 in the reference, 70 % empty.
   Thin 1-2 px lines at phone size read as a faint wireframe, not a glowing blueprint. These 12 s decide retention.
9. (minor) **Line work absent in SOLID.** Dark ink density 0.002 vs 0.024 (-90 %): the 1.7 px inverted-hull ink is
   too thin and too low-contrast to register; silhouettes rely on value difference only.
10. (minor) **X-ray vignette is too heavy** (corner/centre 0.30) and 9 % near-black: the corners go to black instead of
   lifted navy (playbook: no pure black, vignette ~0.85).

## 3. What to change in the pipeline (file owners per playbook §8)

| # | change | target number | file |
|---|---|---|---|
| 1 | Build a world per scene: cloud deck + ground/horizon + sun for SOLID air shots (Poly Haven HDRI sky + CC0 cloud/terrain textures), a 3D blueprint floor/room instead of void; frame the hero at 35-60 % of frame width | empty blocks <= 0.55 | `World.tsx`, `story.ts` cams |
| 2 | Replace primitive hero meshes with CC0 GLBs (airliner, landing gear) or detailed procedural ones: panel lines, windows, livery, rivets, bevels, painted wear maps; RAT with real 2-blade prop + fairing | texture energy >= 1.5, edge density >= 0.045 | `plane.ts`, `looks.ts` |
| 3 | MeshStandard/Physical + HDRI env (metal 0.6-0.9, roughness 0.3-0.5), shadow maps or baked contact shadows, SSAO, ambient <= 0.25 of key, composer with bloom threshold 1.0 on emissives/glints, AgX tone map | p99 >= 0.93, clipped 0.1-0.5 % | `looks.ts`, `RatShort.tsx` composer |
| 4 | Warm key (sun ~5200 K), cool sky fill in the shade only; add hue families (red/white livery, green land, golden sky) | colourfulness >= 60, lit C* p90 >= 45, hi b* > 0 > shadow b* | `looks.ts`, `World.tsx` |
| 5 | A recurring code-built pilot character (amber jacket) with face, eyes, blinks and acting beats; on screen in the danger and payoff beats | character in >= 40 % of frames | new `cast.ts` |
| 6 | Camera: continuous moves across shot boundaries (follow-through instead of 12 of the 14 cuts), 18-40 f symmetric glides peaking 8-25 px720/f, holds push in 0.15-0.35 %/f on a dressed background, no shot without camera motion; smooth the 10-14 action block | hold <= 15 %, move >= 50 %, quiet push >= 0.12 %/f, jerk/speed <= 0.08, cuts = planned only | `story.ts` |
| 7 | Grid as a 3D plane in world space (perspective + parallax), height fog matching sky colour from ~25 m, DOF on close-ups/inserts (~1/3 of time), foreground framing props in ~1/3 of shots | field moving >= 80 % in BLUEPRINT | `World.tsx`, `RatShort.tsx` |
| 8 | Hook: HDR-emissive cyan lines 3-5 px at 1080 + bloom, draw-on animation, denser line art and labels | BLUEPRINT p99 >= 0.8, bright-line density >= 0.03 | `looks.ts` (outlineMaterial), `World.tsx` |
| 9 | SOLID ink: depth+normal edge pass, 3-5 px, dark navy not black | ink density >= 0.015 | post pass |
| 10 | X-ray vignette to 0.7-0.85, lift corners to navy | vignette >= 0.7, near-black <= 2 % | `RatShort.tsx` |

Re-measure after each fix with the same commands; a fix is done when its number moves toward the target.

## 4. Keep (measured or observed as good)

- **Loop works:** first and last frame luma 0.0990 vs 0.0991; both are the same blueprint framing.
- **States are clearly distinct numerically** (BLUEPRINT/X-RAY navy, SOLID sky, SEPIA b* +14/+25): the Fail-Safe
  look reads at a glance; keep the colour code.
- **No crushed or clipped grade in SOLID/SEPIA:** near-black 0-2.5 %, clipped 0 %; SOLID vignette 0.85 = target.
- **No snap moves:** max 17.2 px720/f, under the 25 px/f cap; several glides are well shaped (f 690-715: 15 f in /
  10 f out). Keep smootherstep and the no-hand-held rule.
- **Sepia grain is restrained** (noise 0.24 vs reference 0.27): no file bloat, survives compression.
- **Era changes use white flashes** exactly where planned (f 1139, 1610, 1724), and only 0.1 % of frames are
  untrackable (no black or empty frames).
- **Meter, labels and stamps stay in the safe zones** and the meter sits on the left (observed on the sheets).
