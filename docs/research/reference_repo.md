# Reference repo study: `claude-animated-shorts` (mromidev, MIT)

Studied 2026-11-08 from `references/external/claude-animated-shorts` (git-ignored, private). **Methods and numbers
only.** Its characters, story, scripts, reference frames and look are not ours and must never appear in our videos.
The code is MIT, but we still re-implement techniques in our own files (our states, palette and constraints differ).

**Repo facts**
- One commit (`e3b817b`, 2026-11-01, "Add 20 reference contact sheets"), one branch (`main`). No other history.
- **`STYLE_BIBLE.md` exists:** `references/STYLE_BIBLE.md` (44 lines: format, script formula, picture, camera, effects of
  the studied channel). Its camera section ("ease-out bursts") was later **refuted** by its own `reports/motion.md`
  (integer phase correlation can't see < 4 px/f). Treat the reports as the truth, the bible as superseded.
- Stack used by the author: **Remotion 4.0.290, three 0.175, @react-three/fiber 9.1.2, @react-three/postprocessing 3.0.4,
  postprocessing 6.37.2** (`reports/CONTEXT.md`) = **exactly our pinned versions.** Difference: they rendered on Windows
  Chrome with `gl: "angle"` (GPU); we render `--gl=swiftshader` on 4 CPUs.
- ~12.5k lines: SKILL.md 166, 7 measured reports + CONTEXT (4.4k), bridge scene code (4.8k TS), audio (2.9k py),
  5 helper scripts, 38 frames (540x960) + 20 contact sheets (1800x1920, 10x6 frames sampled across each whole video,
  not a 2 s span as the README says).
- Their own verifier's final scores (SKILL.md): colour day 7, golden 5-6, lighting 5-6, ink 6, textures 5-6,
  characters 7, depth 6-7, composition 6-7. **The method is stronger than the result.**

---

## 1. Pipeline architecture

### 1.1 Stages (SKILL.md "Pipeline")
| # | Stage | Files / output | Notes |
|---|---|---|---|
| 1 | Topic + facts | `SCRIPT.md` (facts + source on top) | one true story with a physical cause/effect + everyday analogy |
| 2 | Script | `SCRIPT.md` | ~3.7 words/s, 55-70 s, fixed beat formula |
| 3 | Voice | `voice/voice.wav`, `voice/words.json` | any STT with word times, **hand-fixed**; everything is timed to words.json |
| 4 | Shot plan | `src/videos/<name>/story.ts` | `SHOTS`, `XFADE`, `FLASH_AT`, `CAMS`, `KICKS`, `DOF`, `FOREGROUND` tables; reactions land 0-3 f before the word |
| 5 | World | `lights.ts`, `shade.ts`, `build.ts`, `paint.ts`, `world.ts` | presets, two-tone shading, props, Canvas2D textures, per-frame posing |
| 6 | Characters | `toon.ts`, `cast.ts`, `cardshade.ts` | Canvas2D-drawn cards as lit billboards |
| 7 | Post | `Bridge.tsx`, `ink.ts`, `lensblur.ts`, `grade.ts` | ink → lens pre → lens main → bloom → NEUTRAL → grade, MSAA 4 |
| 8 | Sound | `audio/timeline.py, sfx_gen.py, sfx.py, music.py, instruments.py, dsp.py, mix.py` | all synthesized in numpy; picture timing locked first |
| 9 | Look checks | `scripts/bridge-stills.mjs`, `sbs_sheet.py` | stills at 0.5, side-by-sides vs reference, verifier agent |
| 10 | Final render | `npx remotion render ... --crf 16 --scale 1.3333`; mux `-map 0:v:0 -map 1:a:0`; `short_qa.py` | 1440x2560 final |
| 11 | Deliver | SendUserFile | — |

### 1.2 Agent roles
- **Lead** (owns pipeline, merges, final render).
- **Analysis agents, one per topic** (motion, depth, textures, characters, lighting, outlines, grade). Shared brief
  `reports/CONTEXT.md`; each writes numbers + recipe + "top 5 changes" to `references/reports/<topic>.md`. Read-only on
  the project, may not render. These reports are then the source of truth for everyone.
- **Look owners in sandboxes** (file ownership, SKILL.md "Look-match loop"):
  `cam` story.ts · `world` world/lights/shade/grade · `mat` paint/build · `char` toon/cast/cardshade · `post` ink/Bridge/lensblur.
  Each works in `src/videos/<name>_<role>/` with its own entry `src/sandboxes/<role>/index.tsx`.
- **Verifier** (fresh Opus agent): side-by-side sheets, a score /10 per area + numbered fix list with frame numbers;
  fixes are routed to the owning agent via SendMessage (keeps that agent's context).
- **Merge**: `bridge_merge.py` backs up main, copies only owned files, then `tsc --noEmit`, then re-sync every sandbox.
- **Contracts** are exported constants (`NOINK` layer, `dofAt`, `FOREGROUND`, `LIGHTS`, `LOOK`, `TONE`, `CHAR`).

### 1.3 Data flow
`words.json` → `story.ts` (frames) → `World.update(id, f)` is a **pure function of (shot, frame)** → post chain.
`audio/timeline.py` mirrors `story.ts` by hand (shots, physics, footfalls, camera distance) → SFX/music cues →
`mix.py` → `mix.wav` + stems + auto `cues.md`. `bridge_shots.py` regex-parses `story.ts` into `shots.json` for QA.

---

## 2. Component analysis

Compatibility column: **OK** = verified against our `node_modules` (three 0.175.0, postprocessing 6.37.2).

### 2.1 Ink / outline pass (`ink.ts`, 393 lines) — the best piece
**What:** constant-screen-width world outlines on silhouettes, depth jumps, convex creases and contacts, never on
billboards; composited **before** the DOF so lines blur with their surface.
**How:**
1. Re-render the world only (camera layer 0; billboards/sky/smoke on layer `NOINK = 3`) with `scene.overrideMaterial`
   = view-space normal shader into a non-MSAA HalfFloat RT with a `DepthTexture`. Shadow maps not re-rendered
   (`shadowMap.autoUpdate=false`). Alpha-tested materials keep their cut-out via `onBeforeRender` copying `map`/`alphaTest`.
2. Mask shader, per pixel, 4 directions (x, y, 2 diagonals) × r = 1..RMAX(9) px:
   ```glsl
   float s = (1.0/z1 + 1.0/z2 - 2.0*Wc) / Wc;            // 2nd diff of 1/z: exactly 0 on any plane
   eD = max(eD, smoothstep(depthLo, depthHi, -s) * cw);  // only the NEAR side of a jump is inked
   float cw = clamp(w + 0.5 - d, 0.0, 1.0);              // continuous coverage = no width popping + AA
   // crease: neighbour at same depth (|dz| < z*depthLo) whose normal turns > angleLo; concave folds x0.7
   ```
   Width interpolates in **log distance**: `w = mix(wNear, wFar, log(z/dNear)/log(dFar/dNear)) * (height/1920)`.
   Characters in front (main composer depth nearer than world depth) suppress the line.
3. Composite: 3×3 tent filter of the mask (AA), ink blended **in display gamma** (`pow(...,1/2.2)`) so measured width =
   coverage width (linear-light blend reads ~30 % thinner), fog-tinted far ink, written back into the input buffer
   (`needsSwap=false`, keeps composer depth intact).
- It is a `Pass`, not an `Effect`: R3F's `<EffectComposer>` merges consecutive Effects into one EffectPass, and a
  DOF in the same pass erases the ink (their documented failure). **Lesson: line pass must be its own Pass.**
- Final values: `#030303`, 5.1 px @6 m → 3.3 px @90 m (at 1080x1920), creases ×0.8 from 35-50°, depth jumps 1-3 %,
  fade 150-450 m. `debug=1` shows the mask, `2` the normals; `set({...})` for live tuning. `noInkFallback()` auto-moves
  sprites/points/lines/depthWrite=false/alpha-cut basic materials to NOINK every frame.
- **Quality:** high; measured widths in a toy scene. **Limits:** one extra full scene render + ~100 texture fetches/px
  (RMAX loop) at full res → expensive on swiftshader; transparent X-ray shells would be rendered opaque by the
  override material (need a layer rule); no hidden-line rendering.
- **Compat:** OK (`perspectiveDepthToViewZ`, `Pass`, `setDepthTexture` all present). **ADAPT.**

### 2.2 Lens blur / DOF (`lensblur.ts`)
**What:** deterministic thin-lens DOF that actually shows (postprocessing's `DepthOfFieldEffect` capped blur at
`bokehScale` px, which is why their first DOF was invisible).
**How:** `CoC = cInf * (1 - focus/depth)` px at 1080x1920 (× nearScale 1.2 in front, clamp maxCoC 24), scaled by
`resolution.y/1920`. Two `Effect`s with `EffectAttribute.DEPTH | CONVOLUTION` (each gets its own pass):
pre 16-tap Vogel over 0.287×CoC + main 64-tap Vogel over 0.958×CoC (combined ≈ smooth disc, "1024 effective taps"),
plus 32 near-field taps so a blurred foreground spreads over sharper pixels. Occlusion: a sample counts only if its own
CoC reaches the pixel; farther samples never spread wider than this pixel's CoC (no halos). Fixed pattern, no noise →
no flicker. `if (cInf < 0.25) return` early-out.
- Driven per frame from `dofAt(f)` (table aligned to camera keys, ramps with glides) and focus = distance along view
  axis to a world point (eyes) or the look target.
- Targets (measured): DOF on ~1/3 of screen time; cInf CU 12-16, MS 10-12, wides 0.
- **Compat:** OK. **Cost:** ~112 taps × 2 fetches/px when on. **ADAPT** (use for SOLID close-ups/inserts; off in BLUEPRINT).

### 2.3 Bloom (`Bridge.tsx makeBloom`)
`BloomEffect({ blendFunction: ADD, intensity .5, luminanceThreshold 1.0, smoothing .2, mipmapBlur, levels 6, radius .6 })`
and **override `mipmapBlurPass.setSize` so the MIP chain always starts at 1920 tall-equivalent** → glow size is the same
in 0.5 stills and finals. ADD (not SCREEN) is HDR-safe. Bloom only on HDR emissives (threshold 1.0). **ADOPT** (safety-
green glow, warning lights, sparks). Cheap relative to the rest.

### 2.4 Tone map + grade (`grade.ts`)
- `ToneMappingEffect({ mode: NEUTRAL })` (Khronos PBR Neutral, needs three ≥ r162: OK).
- `GradeEffect` (display-referred, after tone map): encode linear→sRGB, **monotone cubic Hermite RGB curve through 7
  knots** (x = 0,.1,.25,.5,.75,.9,1; Fritsch-Carlson tangents computed in TS), saturation around Y' separately for
  shadows/mids/highlights (`wS = 1-smoothstep(0,.55,Y)`, `wH = smoothstep(.45,1,Y)`), 3-way zero-luma Cb/Cr tint,
  elliptical vignette `× (1 - k·smoothstep(r0,1,r))`, `amount` blend; `set(p, q, t)` interpolates two presets for
  crossfades/time-of-day changes. Presets were **fitted** to reference cluster quantiles by `fit2.py` (staged,
  regularised; numpy and GLSL identical) — then replaced by gentle hand S-curves after relighting because the fit
  over-corrected. Lesson: **fit the grade last, after lighting/albedo.**
- **Compat:** OK. **ADAPT** the engine; **do not reuse their preset numbers** (they encode their look).

### 2.5 Tone-map inversion `untone()` (`shade.ts`)
JS port of PBR Neutral; 60 fixed-point iterations find the **linear scene value that lands on a target on-screen sRGB
colour** after tone mapping. Used for sky, fog, water. **ADOPT** — this is how our fixed brand colours (navy
`#0B1A33`, cyan `#35D7FF`, red `#FF3B3B`, green `#39FF88`, amber `#FFB020`) stay exact through the tone map. (The grade
then shifts them again: keep the grade mild on brand elements and measure on-screen hex in QA, §4.)

### 2.6 Lighting rig + two-tone shading (`lights.ts`, `shade.ts`, `world.ts`)
- **Patch of three's `lights_fragment_begin`** to capture the sun's shadow-map visibility `sunVis` inside the light
  loop (string replace + a throw if the chunk changes). Verified: the exact string exists in three 0.175 line 145.
- `twoTone(material)` via `onBeforeCompile`: `albedo × mix(shadeCol, litCol × mix(1,ndl,lambert), sunVis·smoothstep(0,term,ndl)) × skyK`
  + shade lift + optional bounce; `uSat` world saturation. Coloured shadows (day shade `[.30,.29,.36]`, golden
  violet) come from the preset, **not** from extra lights; hemisphere/fill zeroed. `customProgramCacheKey` set.
- **Sun is camera-relative and frozen per shot:** mean view direction of the shot's camera path, rotated by preset
  az/el; `SUN_SHOT` overrides per shot. Shadow frustum fitted to the focus: `Rr = clamp(dist·1.15+7, 12, 95)`,
  4096 map, `normalBias ∝ Rr`. Measured: crisp in-focus shadows (3-12 px @720), softness comes from DOF; **no SSAO**.
- **Compat:** OK (string match verified). **ADAPT** for our SOLID state (lit 3D with cool shade, our colours).

### 2.7 Textures by code (`paint.ts`, 720 lines)
- `ctex(key, w, h, draw)` caches a `CanvasTexture` (sRGB, anisotropy 8, repeat) drawn with a **seeded LCG `rng`** →
  deterministic per frame and per render worker. `jit()` per-tile HSL jitter (±10 % L, ±5° h) kills visible tiling.
- HD painters (`planksHD` 2048² = 1024 texels/m, `stoneHD`, `cobbleHD`, `roofHD`, `facadeHD` 96 px/m, `waterMarks`,
  `cloudHD`): flat colour fields + soft blotches + grain strokes + **seams painted as dark tinted bands drawn last**
  (core + soft rim, ~4-5 % of pitch so they survive mips) + sunlit lip / shaded lip; wrap helpers keep x/y seamless.
- **Texel-density rule (measured):** screen px per texel M ≤ 6 at the closest lens, ≤ 3 at working distance;
  `px/m = 1920 / (2·D·tan(vfov/2))`. Memory table given (22 MB for one 2048² with mips).
- **ADAPT**: our painters will be metal (brushed, painted steel with chipped edges), concrete, cable strand, rubber,
  hazard stripes, rivets/bolts — not their storybook brick/wood palette.

### 2.8 Scene building (`build.ts`, `world.ts`)
- Material cache (`lam(key)`), merged geometry batches (one mesh per material), "strands" rebuilt along a path per
  frame (chains, rails), Kenney CC0 GLBs converted to Lambert and **recoloured by material name**.
- **Sight-line culling:** every shot camera sampled every 2 frames (±8 f around shots), 5 rays per sample (centre,
  ±0.6 x, +0.6/-0.4 y of the frustum), slab ray-vs-AABB test; any house/prop that blocks a ray is not built.
  ```ts
  for ([oo,dd,a,b] of [[o.x,d.x,x0,x1],...]) { ta=(a-oo)/dd; tb=(b-oo)/dd; t0=max(t0,min(ta,tb)); t1=min(t1,max(ta,tb)); }
  if (t0 <= t1) return true; // blocked
  ```
  **ADOPT** (with an exception list: our X-ray shots are *meant* to be inside shells).
- Sky = BackSide sphere with 5 elevation stops (smoothstep), fog colour = horizon colour, both written via `untone`.

### 2.9 Characters: flat 2D cards in 3D (`toon.ts` 909, `cast.ts` 473, `cardshade.ts`)
- **Drawing:** Canvas2D `Pen` API on a 600×1000 design space (soles y=975): `poly/ell/line/stroke/arc/dot`,
  `shadedFill` (radial crescent away from light), `gradFill`, `inkRing` (thick-thin outline
  `w(θ) = w0(1 + k·cos(θ - thick))`, thick side away from light and down), `band`. Heads = superellipse "bean"
  (`blobPts`: separate crown/jaw exponents, egg taper, side bulge, tilt, low-order noise, per-character seed).
  Builds, outfits, 14 expressions as a table of eye kind / brow offsets / mouth kind.
- **Placement:** yaw-only billboards (`BODY` plane), `alphaTest .5`, `customDepthMaterial` for silhouette shadows;
  front vs side view chosen by camera angle (`cos < 0.57`), mirroring by walk direction; drawings cached in a
  `Pool` keyed by quantized pose JSON (marching soldiers share canvases); **resolution tiers by distance**
  (3000/1800/800/400 px tall); light angle quantized to 45° to keep the cache small.
- **Lighting:** `cardShade` (Lambert patched): scene tint, bright floor where shadowed (`charShade .86`), side gradient
  toward the sun, inner rim only (never an offset copy). Contact = multiply blob (`ZeroFactor/SrcColorFactor` blend).
- **Life:** deterministic blink schedule (gaps 0.5-2.3 s, 4 f half/shut/shut/half, plus a blink hiding every
  expression swap), reactions 2 f (`LEAD`) before the word, walk bob 3-7 %, lean 1-7°, planted feet.
- **Limits (their own motion report):** front↔side swaps pop in 1 f, even mid camera-move; the reference itself
  used real 3D bodies with face decals. Cards cannot be drawn as BLUEPRINT/X-RAY line art from geometry.
- **SKIP the cards and the character design entirely** (it *is* their look). **ADAPT** only: deterministic
  blink/reaction scheduler, pose-keyed texture pool + distance tiers (for any canvas-drawn label/sprite), contact blobs,
  walk numbers.

### 2.10 Camera grammar (`story.ts`)
```ts
const glide = (u) => { const x = clamp01(u); return x*x*x*(x*(6*x-15)+10); };   // smootherstep, peak = 1.875·dist/dur
// key list per shot: {f, dur?, cut?, s: f => {pos, look, fov, roll}}; run() folds keys: cut = replace, else mix by glide
const pushK = (f, f0, rate, punch=0, n=35) => exp(-(rate·x + Σ (punch-rate)·softEdge8f))  // multiplicative push-in
dolly(pos, look, k) // slide toward look point;  zoom(pos, look, fov, k) // tan(fov/2)·k when the lens is near walls
kickAt(t): a += g * (n % 2 ? -1 : 1) * (1 - n/7) ** 1.5   // flips sign every frame, gone in 7 f; applied as look offset
                                                            // (3 px @720 per unit) + roll 0.004 rad/unit
```
Glides are **centred** on the old key (start dur/2 early; whoosh peaks there). `keyEnd()` lets billboards pick views
per key, not per frame. Measured reference: moves 18-40 f symmetric, peak median ~14 px/f @720, holds push
0.14-0.35 %/f, punch 0.6 %/f for ~35 f, rolls ~3.6° over 18 f, no hand-held float. Our playbook §3 already took the
rules. **ADOPT** the code pattern as a shared library.

### 2.11 Shot composition helpers (`Bridge.tsx`, `story.ts`)
- **Crossfades** by stacking a second `ThreeCanvas` with DOM opacity during `XFADE` frames (`layersAt(f)`) — costs
  2× render on those frames; **white flash** as a DOM overlay `[1, .75, .45, .2]` over 4 f. **ADOPT** the flash
  (our loop cut); crossfade only if needed.
- **`FOREGROUND` table** (near framing props per frame range, 0.3-0.5 × focus distance, 10-25 % of one edge, never a
  face, built outside the sight-line filter). **ADAPT.**
- **inputProps toggles** `{ post: { ink:false, lens:false, ..., dpr:0.5 } }` for A/B stills; **`dpr` override** because
  R3F clamps dpr ≥ 1, so `--scale 0.5` stills otherwise still render a full 1080×1920 buffer. **ADOPT** — on swiftshader
  a 0.5 dpr preview is ~4× fewer pixels. All pixel-sized parameters must read the buffer height (their `pxScale`).

### 2.12 Audio (`templates/audio/`)
- `dsp.py`: own ITU-R BS.1770-4 meter (K-filter biquads, integrated/momentary/short-term/LRA), 4× oversampled true
  peak, filters, modal resonator banks, `make_ir` (decorrelated decaying noise, frequency-dependent decay, early
  reflections), 24-bit WAV IO.
- `sfx_gen.py`: physical-ish synthesis (stick-slip creak engine = rate-modulated impulse train into modal banks;
  chain/wood/timber mode tables; splash, bubbles, whoosh, formant crowd voices, applause, birds, crickets).
- `sfx.py`: `Cue(t, name, desc, gen, naive_LU, kind, pan, extra, lpf, send)`; **level convention:** each event's
  "naive" level = max momentary loudness relative to the voice stem, applied = naive **−6 dB**; beds measured
  integrated, not reduced; distance → gain + low-pass + more reverb send; one shared valley IR.
- `music.py` + `instruments.py`: fully synthesized score (oompah, glock, snare rolls, whistle) locked to the
  picture's beat grid; sections with per-section **target level relative to the voice** (−9.5…−12 LU).
- `mix.py`: voice gain only; music ducked **−3 dB** by a mask from `words.json` (pre 80 ms, post 120 ms,
  attack 70 ms, release 450 ms); per-section auto-gain to hit LU targets; hand "rides" (−2…−4 dB) under quiet
  sentence-final words; master gain iterated to **−15 LUFS**; own 4×-oversampled look-ahead limiter (ceiling
  −1.2 dBTP, 3 ms look-ahead, 80 ms release); stems cached in `_cache/*.npy`; writes `mix.wav` + stems + **auto
  `cues.md`** (every event with time/frame/naive/applied/measured LU, music map, per-section table).
- **Their own measured result** (cues.md): −15.0 LUFS, TP −1.2, LRA 2.6; **speech margin median 7.5-9.6 LU, p10 0.7-4.6
  LU** → would **fail our ≥ +10 dB voice-over-bed rule.** Their duck is too shallow for us.
- **ADAPT** the meter, limiter, words.json duck mask, per-section voice-relative targets, cue sheet and stem cache.
  **SKIP** synthesized music/SFX as primary (we use ElevenLabs + fixed brand files); keep the creak/modal/IR
  recipes as our offline fallback.

### 2.13 QA + helper scripts (`templates/scripts/`)
- `short_qa.py`: specs, ebur128, silencedetect, per-frame luma/sat/diff at 180×320, black (<.04), unplanned white
  (>.93), frozen spans (diff < .02 for ≥ 12 f), pops (diff > 3× local median + 1, not planned), held %, per-shot
  mean/std/p2/p98/sat, `perframe.npz`, 2 s sheets. Our `scripts/short_qa.py` is already derived from it (and adds a
  loop first/last diff).
- `bridge_shots.py`: regex-parses `story.ts` into `shots.json` (shots, crossfades, flash, planned cuts, kick windows)
  so QA ignores planned events. Brittle (regex on TS source).
- `bridge-stills.mjs`: one bundle, many stills; `REMOTION_TMP` to a big disk; sandbox entry via env var.
- `sbs_sheet.py`: two-row side-by-side (ours / target) at equal height for the verifier.
- `bridge_merge.py`: owner→files map, backup, copy changed owned files only.

### 2.14 Render settings and performance
| Setting | Theirs | For us |
|---|---|---|
| GL | ANGLE (GPU, Windows Chrome) | swiftshader, 4 CPU |
| Final | 1440×2560 `--scale 1.3333`, CRF 16, ~4 fps (≈10 min / 67 s) | stay 1080×1920 (1.78× fewer pixels) |
| Stills | 0.5 scale, 3-8 s each after ~40 s bundle | use `dpr` 0.5 override + toggles |
| MSAA | 4 on the composer; ink RT non-MSAA; A2C off (left 1 px seams under DOF) | keep 4 only if profiled OK; ink/DOF dominate |
| Grain | built, OFF (2.5 % grain → 910 MB vs 250 MB file) | history spans only, subtle (CLAUDE.md `alls=5`) |
| Temp | each bundle copies `public/` (1.3 GB) into temp, never deleted (110 GB after 4 rounds) | keep `public/` small, `TMPDIR` in scratch, clean bundles after a project |

Per-pixel cost estimate of their full chain (not measured on our machine): ink ~100 fetches + extra scene render;
lens pre+main+near ~220 fetches when on; bloom mip chain; MSAA 4 resolve. On swiftshader expect **several s/frame**
at 1080×1920 (our CLAUDE.md already notes ~5 s/frame for bloom + MSAA 4). Profile per pass with the toggles before
any full render; reduce ink `RMAX` to 5 (enough for ≤ 4 px lines at 1080), keep DOF off on wides (early-out).

---

## 3. ADOPT / ADAPT / SKIP

| Component | Verdict | Why / how |
|---|---|---|
| Ink pass as separate `Pass` before DOF (depth 2nd-diff + normal crease, log-distance width, gamma blend, NOINK layer, debug views) | **ADAPT** | Our own `lib/post/linepass.ts`: colour/width per state (BLUEPRINT cyan + glow from a blurred mask; SOLID dark navy-graphite, not pure black); RMAX 5; layer rules for X-ray shells. Replaces inverted-hull outlines for creases/contacts. |
| `noInkFallback` auto-layering | ADOPT | Safety net for sprites/labels/particles. |
| Thin-lens gather DOF + `dofAt` table synced to camera keys | **ADAPT** | SOLID close-ups/inserts only; focus on the mechanism. Profile cost. |
| Bloom with fixed MIP chain size, ADD, threshold 1.0 | **ADOPT** | Safety-green glow, warning lights, sparks; preview = final. |
| NEUTRAL tone mapping | ADOPT | Already in our playbook. |
| `untone()` tone-map inversion | **ADOPT** | Brand hex must land exactly on screen. |
| GradeEffect engine (Hermite curve, zone saturation, 3-way tint, vignette, preset blend) | **ADAPT** | Our presets per state: BLUEPRINT, XRAY, SOLID, HISTORY (sepia). Never their fitted numbers. Fit last. |
| Deterministic grain (PCG hash, seeded by frame) | ADAPT | History tag spans only. |
| `sunVis` light-loop patch + two-tone shading | **ADAPT** | SOLID state; our cool shade colours; guard with the same "chunk changed" throw. |
| Camera-relative sun frozen per shot; shadow frustum fitted to focus; no SSAO | ADOPT | Stable lighting during moves; crisp shadows. |
| Canvas texture painters (`ctex`, seeded rng, jitter, painted seams, texel-density rule M ≤ 6/≤ 3) | **ADAPT** | Our industrial materials. |
| Kenney recolour by material name | ADOPT | Any CC0 GLB → our palette. |
| Sight-line culling from camera keys | **ADOPT** | Plus an "intended interior" exception list. |
| Camera grammar code (`glide`, key fold `run`, `pushK` punch, `dolly`/`zoom`, `rolled`, flip-sign kicks, `keyEnd`) | **ADOPT** | Shared `lib/camera/`. Rules already in playbook §3. |
| `FOREGROUND` props table | ADAPT | Recognisable industrial props, ≥ 2 m from lens. |
| White flash DOM overlay; crossfade by stacked canvases | ADOPT / ADAPT | Flash = our loop cut; crossfade doubles cost, use sparingly. |
| inputProps post toggles + `dpr` override for stills | **ADOPT** | ~4× faster previews on swiftshader. |
| 2D card characters (Pen, bean heads, plum thick-thin ink, faces, cardShade, front/side billboards) | **SKIP** | It is their look; cards can't become blueprint/X-ray line art; pops on view swaps. |
| Blink/reaction scheduler, contact blobs, walk numbers | ADAPT | For our own 3D figures (if they have eyes; else only reaction timing + walk). |
| Pose-keyed canvas pool + distance tiers | ADAPT | For canvas labels/stamps/sprites. |
| BS.1770 meter, 4× look-ahead limiter, words.json duck mask, section LU table, auto cues.md, stem cache | **ADAPT** | Duck deeper (our ≥ +10 dB rule); brand files as fixed events. |
| Synth SFX / music / instruments | SKIP (primary) / keep as fallback | ElevenLabs + brand sounds are our rule; numpy recipes only when ElevenLabs is down. |
| "−6 dB under naive" SFX convention | ADAPT | As starting gain per cue, then fixed per-cue gains, never normalised stem. |
| `short_qa.py` | ADOPT (done) | Extend, see §4. |
| `shots.json` via regex on story.ts | ADAPT | Export JSON from TS instead of regex. |
| `sbs_sheet.py`, stills script, merge script | ADOPT / ADAPT | Merge owner map per video. |
| Analysis-agent reports with numbers (motion, depth, grade, outlines, lighting, textures) | **ADOPT method** | Run on OUR competitor set for OUR look; their numbers describe their style. |
| STYLE_BIBLE script formula ("You see," pivot, everyman story, jokes) | SKIP | Our own formula + "Here's what saves you." |
| 1440×2560 final, CRF 16 | SKIP | CPU render budget; 1080 is our deliverable. |
| Grain on everything | SKIP | File bloat, YouTube mush (their own finding). |

---

## 4. Their QA / measurement tooling, and what we should build

### 4.1 What they have (scripts mostly live outside this repo, described in the reports)
| Tool | Method (from reports) | Key numbers it produced |
|---|---|---|
| Camera path (`cam2.py`, `camstats.py`) | 9-tile **sub-pixel phase-correlation similarity fit** (tx, ty, zoom, roll) at 360×640, caption bands excluded, outlier tiles rejected, path integrated + Gaussian σ 1.2 f; hold < 0.3, drift < 2, move ≥ 2 px/f @720; bursts ≥ 6 px/f, attack/release to 10 % of peak | peak 13.7 px/f, attack = release 10 f, push-in 0.14 %/f, rolls 3.6°/18 f |
| **Our camera from code** (`ourcam.py`) | runs the real `camAt()` via node, projects a 5×5 grid, same fit — measures camera grammar **without rendering** | found 3 f snaps at 115 px/f |
| Grade (`metrics.py`, `fit2.py`) | bt709-correct ffmpeg decode, caption mask, ink mask (black top-hat), Y' percentiles, HSV S, colourfulness, local contrast, black point (darkest 0.5 %), vignette radial bins, Lab hue per zone, lit C* p50/p90, manual clusters | day median Y' .571, non-ink p5 .234, C* p90 55 |
| DOF (`blurlib.py`) | edge-spread fit `a + b·Φ((t−t0)/σ) + c·t` (batched LM), multi-scale, tiles p30, hand-labelled shot types | bg σ720 CU 4.2 / MS 4.0 / WS 1.9 |
| Lines (`scanline.py`) | perpendicular luma scans, equivalent ink width EW = dip area / contrast (blur-independent), FWHM, 10-90 % rise | EW 3.1 px @1080, nearly constant with distance |
| Lighting (`run_pairs.py`, `heads.py`) | same-material lit/shade patch ratios in linear light, Otsu split; shadow-edge logistic fit; head plane-fit gradients; model reproduction of three's shading | day shade/lit Y .49-.52 |
| Textures (`measure_patches.py`, `lines.py`) | Lab k-means clusters per patch, painted-line FWHM, texel magnification from edge ramps | M 2-6 px/texel |
| Motion of characters | NCC template tracking with background compensation, blink eye-strip counts, mouth area vs voice RMS lag | blinks 0.5-2.3 s, reactions −0..3 f |
| Render QA (`short_qa.py`) | see §2.13 | — |
| Mix report (`mix.py`) | per-section voice/music/sfx/bed LUFS + momentary voice−bed margin over spoken-word windows (median, p10) | — |

### 4.2 What we should build (priority order; each prints numbers, saves JSON, compares to a target table)
1. **`scripts/timeline_dump.mjs`** → `videos/NN/timeline.json` (shots, cuts, flashes, kicks, freeze/slow-mo spans,
   meter keys, engagement frame, state per frame) exported from the TS source, not regex. Every QA tool reads it.
2. **Camera-from-code checker** (port of their `ourcam` idea): evaluate `camAt()` per frame in node, project a point
   grid, report per move peak px/f @720, attack/release frames, static-hold runs ≥ 4 f, roll moves, kick decay.
   Fails: peak > 25 px/f outside planned whips; any hold ≥ 4 f without push-in. Zero render cost.
3. **`short_qa.py` upgrades:** read `timeline.json`; check **last frame = first frame** (have), **engagement frame**
   (meter crash + clunk on the same frame), **freeze span** exactly 15 frames identical, per-state grade metrics.
   Fix memory: it holds all frames as float32 at 270×480 (~2.8 GB for 60 s) — stream or keep uint8.
4. **Brand-colour check:** sample state-specific regions (meter, labels, safety-green glow, amber person) on QA
   frames; report ΔE2000 to brand hex after tone map + grade; fail > 5.
5. **Safe-zone check:** render the HUD layer alone (inputProps toggle) for a few frames, flag any non-transparent pixel
   in y 1050-1350, y > 1536 or the right edge band.
6. **Grade metrics per state** (`measure_grade.py`): Y' p1/p5/p50/p95/p99, non-line p5, C* p50/p90, black point,
   vignette ratio; targets per BLUEPRINT / XRAY / SOLID / HISTORY in `references/STYLE_TARGETS.md` (our numbers).
7. **Line-width scanner** (EW method) to calibrate our line pass at 1080 and at preview dpr.
8. **Audio report** (`audio/report.py`): BS.1770 meter + ffmpeg cross-check, per-section table with **speech-window
   margin median ≥ 10 dB and p10 ≥ 6 dB**, every SFX onset vs nearest word (no overlap), brand files' checksums +
   placement frames, cue sheet auto-written.
9. **`sbs_sheet.py`** equivalent for verifier rounds (ours vs approved previous video / targets, not their frames).

---

## 5. What defines THEIR look (do not reproduce)

- **Characters:** flat 2D cards; pale/white round **bean heads** (H/W ~0.94, pointed crown, fuller jaw), **thin ink
  stick limbs with ink-dot hands**, ~3.5 head-heights, deadpan **lidded eyes**, no blush/catchlights, **plum
  thick-thin outlines** (`#241726`, 3:1 weighted to the shadow side), soft crescent shading, 14-expression face set,
  hats/outfits as identity. Front/side billboard swaps.
- **World:** colourful **storybook 3D towns and interiors** (Western streets, shops, ships, forges), Kenney-like
  props rounded into "storybook" vegetation, **hand-painted Canvas textures** with dark painted seams, saturated
  albedos; **near-black ~3 px Freestyle-like ink** on every silhouette/crease of the world, none on cards.
- **Colour:** bright saturated day (median Y' .57, C* p90 55, warm-lifted blacks ~RGB 35,19,20), sky `#5e93d9 → #9fb6e6`,
  golden-hour peach horizon `#ffd08a` with **violet-blue shadows**, warm key + cool/violet shade, window light pools;
  light shifts noon → sunset → night-blue along the story.
- **Lens/camera:** DOF backgrounds on ~1/3 of shots, symmetric glides, slow push-ins, dutch rolls, flip-sign kicks,
  near-zero hard cuts (follow-the-object transitions, whip pans with motion blur, 6-8 f dissolves).
- **Effects:** flat 2D cartoon sprites (stars, music notes, bursts, splashes, puffs, speed lines).
- **Format/voice:** comedic true-history stories, named everyman in present tense, "You see," pivot (14/20),
  ~3.7 words/s, one-word white captions with black outline, deadpan "Luckily/Unluckily" double line, march/whistle
  synth scores.

**How we stay distinct:** our people are **amber-coded 3D figures** (no cartoon faces, no stick-limb cards); our
world is **industrial/mechanical**, shown as BLUEPRINT (cyan line art on navy grid) → X-RAY (Fresnel shells, red force
arrows) → SOLID (lit, cool shade, safety-green payoff); our solid-state lines are dark navy-graphite and thinner on
small parts, not storybook black ink; no 2D cartoon effect sprites (use 3D sparks/dust/force arrows); no golden-hour
storybook skies; captions off; our own pivot line and brand sounds.

---

## 6. Recommendations for our reusable production system

### 6.1 Folder layout
```
remotion/src/
  lib/                      # shared engine (owner: engine). Versioned contracts, no per-video values.
    post/   linepass.ts  lensblur.ts  bloom.ts  grade.ts  grain.ts  Composer.tsx (order + toggles + dpr)
    look/   palette.ts (brand hex + untone)  states.ts (BLUEPRINT/XRAY/SOLID/HISTORY presets)  shade.ts (two-tone)
    camera/ grammar.ts (glide, run, pushK, dolly, zoom, rolled, kicks, keyEnd)  dof.ts  sightlines.ts
    paint/  ctex.ts (cache, rng, jit)  metal.ts concrete.ts cable.ts rubber.ts hazard.ts
    hud/    DangerMeter.tsx  Labels.tsx  Stamp.tsx  Flash.tsx  safezones.ts
    people/ (see 6.2)
    time/   words.ts (words.json -> frame lookups)  timeremap.ts (freeze + slow-mo story time)
  videos/<name>/            # per video (owners: cam / world / mat / people)
    story.ts (SHOTS, CAMS, DOF, KICKS, METER, STATE_AT, FOREGROUND)  world.ts  mechanism.ts  Short.tsx  contracts.ts
  sandboxes/<role>/index.tsx   # only during multi-agent look passes
remotion/scripts/  stills.mjs (+ TMPDIR, dpr, toggles)  timeline_dump.mjs  camcheck.mjs
scripts/           short_qa.py  measure_grade.py  check_brand.py  check_safezones.py  scan_lines.py  sbs_sheet.py  merge_sandbox.py
scripts/audio/     dsp.py (BS.1770, true peak, limiter, IR)  duck.py  report.py  fallback_sfx.py
videos/NN_name/    SCRIPT.md SHOTLIST.md vo/ (takes, words.json) timeline.json sfx/ music/
                   audio/ (mix.py, cues.md, stems, _cache/) qa/ (report.md, sheets) finish.sh delivery/
references/        STYLE_TARGETS.md + reports/<topic>.md (OUR measured targets); external/ stays private
```

### 6.2 Character library (`remotion/src/lib/people/`)
- `rig.ts` — one parametric 3D figure (capsule/rounded-box segments, ~3.5 head-heights or our own proportion),
  joints as a plain object; built from geometry so the line pass draws it in every state.
- `materials.ts` — state variants: BLUEPRINT amber line art, X-RAY amber translucent, SOLID amber lit (two-tone).
  Amber `#FFB020` via `untone`; nothing else may use amber.
- `poses.ts` — named, deterministic poses (stand, brace, grab-rail, fall, relief) + `pose(t)` blends; reactions
  scheduled from `words.json` with a 0-3 f lead (their `LEAD` idea).
- `walk.ts` — bob 3-7 %, lean 1-7°, planted feet, step 9-12 f (measured numbers, not their drawings).
- `crowd.ts` — instancing + per-person seed; quiet extras (no nonstop idle loops).
- No faces by default; if an expression is ever needed, a minimal visor/eye-line decal of our own design.

### 6.3 File-ownership rules for multi-agent work
1. **One owner per file**, written at the top of each video's `contracts.ts` as an `OWNERS` map; the merge script
   reads that map (their `OWN` dict, but per video and in-repo).
2. **lib/ is owned by one engine role.** Video agents never edit lib/; they request changes. A lib change bumps a
   `LIB_VERSION` constant and is announced to every reader.
3. **Contracts are exported constants** (layers `NOLINE`/`XRAY_SHELL`, `STATE_AT`, `dofAt`, `METER`, `ENGAGE_FRAME`,
   `SAFE_ZONES`). Changing one = notify every owner that imports it.
4. **Sandboxes:** copy `videos/<name>` → `videos/<name>_<role>` + `sandboxes/<role>/index.tsx`; stills via
   `ENTRY=...`; merge = backup → copy owned files only → `npm run typecheck` → re-sync all sandboxes from main.
   Delete sandboxes after the pass (they bloat bundles and break typecheck if left stale).
5. **Picture lock before sound:** `timeline.json` hash is stored in `audio/cues.md`; the audio owner rebuilds if the
   hash changes. Audio agent owns `videos/NN/audio/*` only; brand files are read-only.
6. **Verifier is read-only** and fresh each round: 1-3 sheets, ≤ 200 words, score per area + numbered fixes mapped to
   owners; max 2 rounds (CLAUDE.md token budget).
7. **Reports are numbers:** every agent returns measured before/after values, files changed and the next fix; no
   adjectives. Scratch files go to the scratchpad, never `out/*.ts` (breaks `tsc`).
8. Keep it lean: per CLAUDE.md use subagents only when truly needed; a single agent can own cam+world+post for a
   normal video, and the split above is for look-development passes.
