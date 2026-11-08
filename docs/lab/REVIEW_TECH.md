# Phase 1 Lab: independent technical QA review

Reviewer: technical QA / visual-analysis (did not build any concept). Measured, not judged by taste.
Inputs: the four 90-frame 540x960 motion clips at 1.9 Mbps (`scratchpad/lab/<c>/<c>_motion_1900k.mp4`), their render masters
(`paper/motion/raw.mp4`, `engraving/motion/raw_final.mp4`, `toy/motion2_raw.mp4`, `noir/motion_raw.mp4`; Remotion H.264,
10-46 Mbps), and the boards in `docs/lab/<c>/`. Scratch outputs: `scratchpad/review_tech/`.

## Method

- **Camera and image:** `python3 -I scripts/frame_metrics.py <clip> <out> --width 540`, every frame, on the delivered 1.9 Mbps clip.
  Targets come from `docs/research/pipeline_audit.md` §1/§3 and `docs/research/tutorials.md` §2.
- **Compression at true delivery bits per pixel:** a 1080x1920 video at 1.9 Mbps has the same bits per pixel as 540x960 at 475 kbps.
  I encoded each master with 2-pass x264 (`-preset slow -b:v 475k`). SSIM-Y and PSNR-Y are per frame against the master and against the delivered 1.9 Mbps clip.
  The "complexity index" is the bitrate x264 needs at CRF 23 (preset slow) for the same 90 frames.
  This proxy is a little pessimistic: at 1080 the same detail spans 2x more pixels, so it is easier to code per pixel.
- **Temporal stability:** two measures.
  - The camera is near-still (0.0-0.1 px720/f) for frames 0-7 in all four clips. On the master over those frames I took the per-pixel temporal std (x255) and the % of pixels above 2/255. This is "shimmer".
  - Over frames 1-29 (slow push) I took the temporal 2nd difference |I(t+1) - 2I(t) + I(t-1)| on edge and flat pixels. This is "line crawl / boil".
  - Single-frame local pops come from a 12x9 grid: each cell's deviation from the mean of its two neighbouring frames.
- **Brand colour:** CIEDE2000 against the brand hex.
  - Pixels count only if their hue is within ±15° of the target, chroma is above 0.6x the target's and L is above 0.6x the target's.
  - Sampled every 5th frame of the delivered clip (BT.601 decode, as the streams are tagged) and on the board JPG (the only source for cyan, because the clip is all SOLID).
  - Reported as the median ΔE00 and the 10th-percentile ΔE00 (best patches) of those pixels.
- **Images viewed:** 4 (one combined contact sheet, one shimmer heat-map, one pop strip, one compression crop sheet).

## 1. Comparison table (delivered 1.9 Mbps clips, medians over 90 frames)

Bold = misses target.

| metric | target / reference | paper | engraving | toy | noir |
|---|---|---|---|---|---|
| **Motion** | | | | | |
| hold / drift / move % | hold ≤ 15, move ≥ 50 (ref 10/24/65) | **27** / 39 / **34** | **24** / 52 / **23** | 12 / 22 / 66 | **16** / 62 / **22** |
| frames camera moving % | ≥ 60 | 73 | 76 | 88 | 84 |
| any region moving % | (n/a) | 80 | 86 | 89 | 93 |
| quiet push-in %/f | ≥ 0.12 (ref 0.14) | **0.098** | 0.147 | **0.082** | 0.158 |
| speed p50 / peak px720/f | peak ≤ 25 | 0.94 / **68.6** (f58) | 0.97 / 10.5 | 3.29 / 21.9 | 1.06 / 10.6 |
| RMS jerk / RMS speed | ≤ 0.08 (clean glide 0.022) | **0.135** | **0.106** | **0.169** | **0.171** |
| glide length (move run ≥ 2 px720/f) | ≥ 18 f, ~23 f | 30 f (f37-66) | 21 f (f41-61) | 59 f (f20-78) | 20 f (f41-60) |
| attack / release f | ~10 / 10, symmetric | **1 / 5** | 45 / **8** | 56 / 23 | 39 / 33 |
| hard cuts | planned only (0) | **1 (f58)** | 0 | 0 | 0 |
| longest static run | < 4 f | 3 | 4 | 5 | 1 |
| **Tone / colour** | | | | | |
| luma p1 / p50 / p99 | p1 > 0 lifted, p99 ≥ 0.93 | 0.10 / 0.23 / **0.86** | 0.04 / 0.64 / 0.95 | 0.03 / 0.20 / **0.79** | 0.18 / 0.43 / **0.87** |
| RMS contrast | (ref ~0.2) | 0.171 | 0.290 | 0.173 | **0.144** |
| near-black < 16 % | ≤ 2 (ref 0.5) | 0.0 | **2.4** | **8.5** | 0.0 |
| clipped > 245 % | 0.1-0.5 (ref 0.38) | **0.0** | **0.7** | **0.0** | **0.0** |
| colourfulness | ≥ 60 (ref 69) | **57.7** | **46.4** | 77.5 | **50.3** |
| lit C* p90 | ≥ 45 (ref 51) | 48.3 | **21.6** | 67.6 | 52.9 |
| shadow b* / highlight b* | shadow < 0 < highlight | -14.9 / +21.6 | -3.1 / +4.3 (weak) | -13.7 / +39.9 | -3.7 / +23.6 |
| vignette corner/centre | 0.7-0.85 | **0.62** | **0.62** | **0.39** | **0.48** |
| **Detail** | | | | | |
| edge density | ≥ 0.045 (ref 0.058) | 0.048 | **0.622 (10.7x ref)** | 0.052 | **0.032** |
| ink-line density | ≥ 0.015 (ref 0.024) | **0.010** | 0.284 | 0.018 | **0.006** |
| texture energy | ≥ 1.5 (ref 1.80) | 2.17 | 5.80 | 2.15 | 1.79 |
| empty 16-px blocks | ≤ 0.55 (ref 0.54) | 0.30 | 0.03 (no rest area) | 0.32 | 0.44 |
| sharpness centre / ratio (DOF proxy) | ref centre 9.6 | 5.1 / 1.99 | 70 / 1.10 (all sharp) | 4.1 / 3.73 (strong DOF) | **0.99** / 1.09 (all soft) |
| noise sigma x255 | ~0.27 (ref) | 0.61 (halftone) | 0.60 (hatch) | 0.47 | 0.36 (paper tooth) |
| **Compression** | | | | | |
| complexity: CRF 23 bitrate | lower = cheaper | 2.55 Mbps | **10.86 Mbps** | 3.09 Mbps | 2.17 Mbps |
| 1.9 Mbps clip vs master SSIM-Y / PSNR-Y | ≥ 0.95 / ≥ 36 dB | 0.961 / 38.5 | **0.937 / 23.9** | 0.954 / 37.3 | 0.969 / 40.6 |
| 475 kbps vs master SSIM-Y (min @f) / PSNR-Y | ≥ 0.90 / ≥ 32 dB | 0.903 (0.864 @61) / 33.4 | **0.834 (0.740 @57) / 19.3** | **0.891** (0.862 @42) / 32.4 | 0.928 (0.905 @61) / 35.6 |
| 475 kbps vs 1.9 Mbps clip SSIM-Y / PSNR-Y | | 0.919 / 34.0 | **0.859 / 20.2** | 0.910 / 33.1 | 0.945 / 36.5 |
| **Temporal stability (master)** | | | | | |
| hold f0-7: temporal std p50 x255 / % px > 2 | low | 0.50 / 18 % | **4.21 / 79 %** | 1.41 / **38 %** (incl. pop) | 1.69 / **39 %** |
| boil f1-29: 2nd-diff edge / flat x255 | low | 11.2 / 2.4 | **26.1 / 11.3** | 15.8 / 6.7 | 7.9 / 4.2 |
| unplanned single-frame pops | 0 | 0 | 0 (f40 snap wash, likely planned) | **4 (f5, f21, f41, f58)** | 0 |
| clamp flash (frame luma before → peak) | local, not a full wash | **0.24 → 0.69 (f58)** | 0.55 → 0.78 (f58) | 0.24 → 0.61 (f62) | 0.45 → 0.67 (f58) |
| **Brand colour, ΔE00 median / p10** | ≤ 5 / ≤ 2 | | | | |
| amber #FFB020 (clip) | | **11.5** / 8.2 (h66, darker) | 2.8 / 0.8 | **12.9** / 7.4 (h67, L66) | **10.3** / 8.1 (h64, C59) |
| safety-green #39FF88 (clip) | | **8.4** / 1.6 (C60) | **8.4** / 0.7 (C58) | **9.4** / 7.5 (C100, h138) | 4.2 / 3.0 |
| red #FF3B3B (clip) | | **12.0** / 6.3 (0.05 % cover) | 4.7 / 1.1 | **8.0** / 2.6 | **13.1** / 9.0 (0.02 % cover) |
| cyan #35D7FF (board BLUEPRINT) | | 4.3 / 1.4 | **10.7** (pale aqua, C22 h209) | **9.2** / 4.0 | **13.8** / 5.4 |
| **Cost** | | | | | |
| render s/frame @540 (NOTES) | | 1.3-2.0 | 0.6 | 2.4-2.7 | 1.5-2.2 (NOTES also says ~5) |

## 2. Per-concept technical defects (frame numbers are 0-based)

### Paper (cut-card puppet)
1. **f58, clamp flash is a full-frame wash.**
   - Mean luma goes 0.24 → 0.69 (2.9x) and needs 3 frames to decay.
   - It trips the cut detector (hard cut flagged at f58).
   - Framing differs between f55 and f62 (the camera re-poses during the flash).
   - NOTES says "short and local"; the measurement disagrees.
2. **Fall-follow lurch, f47-54:** speed oscillates 12.8 → 6.4 → 16.4 px720/f.
3. **Post-clamp kick:**
   - Attack is 1 frame.
   - Jerk peaks at 5.7-7.4 px720/f³ on f60-65.
   - The measured peak of 68.6 px720/f on f58 is inflated by the flash. NOTES measured 32.5, which is still above the 25 cap.
4. **Safety-gear housing is cut by the right frame edge** f62-89, which is also the right-edge exclusion zone.
5. **Quiet push-in is 0.098 %/f** (target ≥ 0.12). Vignette is 0.62 (heavy).
6. **Highlights are polite:** p99 0.86 and 0 % clipped, so no metal glints despite the brass pins.
7. **Compression (f61 at 475 kbps):**
   - The jacket halftone dots and the brick mortar turn to mush.
   - The "printed card" signature texture is the first thing lost at delivery bits per pixel.
   - The 1.9 Mbps clip at 540 keeps it only partly.

### Engraving (live patent engraving)
1. **Hatch shimmer over the whole frame.**
   - With the camera near-still (f0-7), 79 % of pixels change by more than 2/255 frame to frame (paper: 18 %).
   - Edge-pixel boil is 26 x255, 2-3x the others.
   - The heat map shows walls and floor crawling, not just the character.
2. **Compression failure.**
   - It needs 10.9 Mbps at CRF 23, 4.3x paper.
   - The *delivered* 1.9 Mbps clip is already only 23.9 dB PSNR against its master. I re-checked this with range-corrected inputs: the master is full-range.
   - At true delivery bits per pixel: SSIM 0.834 mean, 0.740 at f57. The hatching breaks into blocks and moiré, and mosquito noise speckles the paper whites.
3. **Edge density is 0.62** (10.7x reference) and only 3 % of blocks are flat: there is no rest area for the eye or the encoder.
4. **f40:** a one-frame global wash (38 % of pixels +56 luma), presumably the rope-snap flash. Together with f58 that is two full-frame flashes 0.6 s apart.
5. **Abrupt stop, f58-62:** speed goes 10.3 → 1.5 px720/f in 4 frames (release 8 frames vs a 45-frame attack). Jerk spikes 2.28 at f59.
6. **Cyan prints as pale aqua:** L84 C22 h209 vs C41 h229, ΔE00 10.7.
   - Amber (2.8) and red (4.7) are near-exact.
   - Green is desaturated (C58 vs 84), ΔE00 8.4.
7. **Tones:** 2.4 % near-black (just over target), 0.7 % clipped, lit chroma p90 21.6 (half the target): a low-chroma image overall.

### Toy (cut-away scale model, ball-jointed figure)
1. **Unplanned single-frame pops at f5, f21 and f41.**
   - A bright out-of-focus bloom ball at the lower-left edge, about +100 luma over about 10 % of the frame, lasting one frame each. It is also present at f58.
   - Not tied to any event; it reads as a render glitch.
2. **Crushed blacks and heavy vignette:** 8.5 % near-black (target ≤ 2), p1 0.029, vignette 0.39. p99 0.79 with 0 % clipped means no highlight sparkle in the graded frame.
3. **f62, clamp flash is a full-frame wash:** luma 0.24 → 0.61.
4. **Motion:**
   - Fall-follow oscillates f45-53 (18.5 → 13.0 → 17.4 px720/f).
   - The kick goes 4.1 → 21.9 px720/f in 3 frames (f61-64).
   - Jerk/speed 0.169; quiet push-in 0.082 %/f (lowest).
5. **Framing:** head and raised arm hit the top and right frame edges around f70-89 (sheet).
6. **Compression (f42 at 475 kbps):**
   - Checker-plate floor and rope-hitch detail smear.
   - Dark navy haze ramps show macroblocking (visible on a 5x contrast stretch, mild at normal contrast).
7. **Brand colour is the weakest of the four:**
   - Amber reads orange-brown (L66, h67; ΔE00 12.9).
   - Green is over-saturated and yellow-shifted (C100, h138; ΔE00 9.4); bloom and tone-map push the emissive past the brand hex.

### Noir (gouache-painted cut-out)
1. **Uniform low-level boil.**
   - 39 % of pixels move by more than 2/255 in the still hold, at a low amplitude (p99 7.4).
   - The sources are the animated paper tooth, dust motes and haze cones; the heat map lights the beams and the whole field.
   - It is mild visually, but it costs bits on every frame (noise sigma 0.36).
2. **Soft everywhere.**
   - Centre sharpness is 0.99 vs 9.6 in the reference, and the centre/edge ratio is 1.09: no DOF separation and no crisp focal plane.
   - Edge density 0.032 and ink density 0.006 are below target.
   - RMS contrast is 0.144, the flattest of the four (milky haze).
3. **No highlights:** p99 0.87, 0 % clipped (NOTES agrees).
4. **f58, clamp flash is a frame-wide mint wash:** luma 0.45 → 0.67. Kick jerk peaks 2.1 at f56-59.
5. **Colour:**
   - Red is almost absent in the clip (0.02 %) and off-hue (ΔE00 13.1).
   - Amber leans orange and is desaturated (C59, ΔE00 10.3).
   - Cyan on the board measures ΔE00 13.8 (dim).
   - Green is the best of the four (4.2).
6. **Render cost is inconsistent in NOTES:** 1.5-2.2 s/f for motion vs "~5 s/frame" in the cost section. This needs one timed profile before planning.

### Shared to all four
- **The clamp flash is global, not local.** Every concept washes the whole frame on the engagement frame. Our rules want the crash frame to read the mechanism.
- **Brand amber is rendered too orange and too dark under lit shading in the three lit concepts** (hue 64-67 vs 76).
  - Fix by grading amber materials toward the hex, as engraving's spot plates do, or with a brand-colour LUT protect.
- **Streams are tagged BT.601 (`bt470bg`, TV range).** The 1080 finals must keep explicit colour tags. Untagged HD is decoded as BT.709 and would shift every brand hue.
- **The safety gear is small and at the frame edge in every clip.** This is a readability point, but it also has a technical cost: the hero detail sits where the vignette and the encoder are weakest.

## 3. Production risk

Full video is about 1830 frames (60 s plus tail). Estimates are single-process on the shared 4-CPU box.
Real-ESRGAN animevideov3 ONNX adds 3.4 s/f, about 1.7 h (tools.md §6).

| concept | @540 render | @540 + lanczos | @540 + ESRGAN | native 1080 (≈4x px) | rig limit | main risk |
|---|---|---|---|---|---|---|
| paper | 0.7-1.0 h | ≈1 h | 2.4-2.7 h | 5-8 s/f → 2.5-4.1 h | flat relief, camera within ±35° of facing | halftone lost at delivery bits; flash/kick control |
| engraving | 0.3 h | ≈0.3 h (softens hatch) | ESRGAN untested on hatching (likely smears it) | 2-2.5 s/f → 1.0-1.3 h | 16-part card cut-out, yaw-only billboard: no orbits or top views, figure always faces camera | **fails 1.9 Mbps delivery** (PSNR 20-24 dB); shimmer |
| toy | 1.2-1.4 h | ≈1.4 h | 2.9-3.1 h | MSAA 4 + 40-tap DOF ≈10 s/f → **≈5 h** (over budget) | full 3D joint rig, any angle; no skinning (joint seams) | slowest; crushed blacks; pops; colour drift |
| noir | 0.8-1.1 h (2.5 h if 5 s/f) | ≈1.1 h | 2.5-2.8 h (ESRGAN erases the paper tooth, add it back after) | 6-9 s/f → 3-4.5 h | painted card, azimuth within ±35°, flat limbs at extreme bends | cost uncertainty; soft image; boil costs bits |

Notes on the table:
- Within the ≤ 3 h budget, engraving can render native 1080, but delivery compression defeats it.
- Paper, noir and toy must render at 540 and upscale, or drop to MSAA 2 / half-res DOF and bloom.
- Toy is the only concept with no camera-angle limit. The two card concepts (paper, noir) cap camera grammar at ±35°, which conflicts with the playbook's orbit/alternate-angle replays of the engagement moment.

## 4. Technical scores (1-10)

| | motion quality | compression robustness | temporal stability | colour accuracy | lighting / tonal range | feasibility | **total /60** |
|---|---|---|---|---|---|---|---|
| **noir** | 7 | 9 | 6 | 6 | 5 | 6 | **39** |
| **paper** | 4 | 7 | 8 | 5 | 7 | 7 | **38** |
| **toy** | 6 | 6 | 4 | 4 | 6 | 6 | **32** |
| **engraving** | 7 | 2 | 2 | 7 | 5 | 8 | **31** |

Why each concept scored as it did:
- **Noir:** the cleanest encode (CRF 23 needs 2.2 Mbps; SSIM 0.93 at delivery bits per pixel) and a symmetric 39/33 f glide. It loses points for low-level boil, softness and an unprofiled cost.
- **Paper:** the most stable picture and the best-balanced tones (no crush, strong warm/cool split, C* p90 48). Its motion has the only false cut, a 1-frame-attack kick and a lurch. All of these are fixable in `story.ts`.
- **Toy:** the most motion and colour, and the only rig with no angle limit. It loses points for unplanned pops, 8.5 % crushed blacks, the worst brand-colour drift and the highest render cost.
- **Engraving:** the cheapest render and the most exact spot colours. It is technically **not deliverable at 1.9 Mbps as built**: 10.7x reference edge density, 79 % shimmering pixels and 20-24 dB PSNR.

## 5. Fix list (numbers to hit)

- **All:**
  - Make the clamp flash local (frame luma rise ≤ +0.08) and keep the mechanism readable on the crash frame.
  - Grade amber to within ΔE00 ≤ 5 of #FFB020 (protect amber materials from the warm key and tone map).
  - Keep the green emissive below the bloom/tone-map clip (target C* 80-85, h 149).
  - Kicks need ≥ 4 frames of attack and decay to < 1 px720/f within 8 frames. Fall-follow speed must be monotonic (no dips over 30 %).
- **Paper:**
  - Remove the f58 re-pose or hide it inside a planned cut. Peak ≤ 25 px720/f.
  - Bring the gear 10 % inward from the right edge.
  - Quiet push ≥ 0.12 %/f.
  - Scale halftone dots to ≥ 4 px at 1080 so they survive 1.9 Mbps.
- **Engraving:**
  - Make the hatch band-limited: minimum line pitch ≥ 4 px at 1080, hatch density stepped in 3 bands, 30-40 % flat paper or spot fill.
  - Target CRF 23 bitrate ≤ 4 Mbps at 540 and a hold-shimmer share ≤ 20 %.
  - Re-test with `-tune animation`.
  - Raise cyan chroma to C ≥ 38.
- **Toy:**
  - Find and kill the f5/f21/f41 bloom-ball pops (near-camera emissive or spark sprite).
  - Lift blacks: near-black ≤ 2 %, vignette ≥ 0.7. Let specular glints reach p99 ≥ 0.93.
  - Profile MSAA 4 + 40-tap DOF; use MSAA 2 or half-res DOF to fit ≤ 3 h at 540 + ESRGAN.
- **Noir:**
  - Make paper tooth and motes static per shot (or halve them) to cut boil below 20 %.
  - Add a crisp focal plane (centre sharpness ≥ 4) and glints (p99 ≥ 0.93).
  - Time one 30-frame render to settle the 1.5 vs 5 s/f question.
