# Lamplit Gouache: lighting and rendering standard (draft v2, Look TD)

Code: `remotion/src/lab/hybrid/look/` (`shade.ts`, `colors.ts`, `post.ts`, `paint.ts`; bench `testScene.ts`; compositions `HyLookTest` / `HyLookPreview` / `HyLookRaw` via `look/index.ts`).
Import everything from **`../look/api`**. The API only grows. The old `gouache(opts)`, `U`, `BRAND`, `lin`, `initShared()`, `glazeMaterial`, `beamMaterial` and `cardLineMaterial` still work.

## 1. Measured results (bench, 540×960 stills via `frame_metrics.py --stills --width 540`, SOLID frames)

| Target (HYBRID_PLAN) | Result | Gate |
|---|---|---|
| Centre sharpness ≥ 3× noir (0.99 → ≥ 3) | **4.3–4.4** (raw, before post: 5.0) | ✅ |
| Shimmer on a still hold ≤ 15 % | **0.00 %** (SOLID 0–9 and BLUEPRINT 70–79, PNG) | ✅ |
| Amber ΔE00 ≤ 5 (review method: median / top-lit median) | **0.9 / 0.7** | ✅ |
| Green / red / cyan ΔE00 ≤ 5 (median) | **2.7 / 4.0 / 2.2** (top-lit 2.5 / 1.6 / 2.2) | ✅ |
| p99 luma ≥ 0.90; clipped 0.1–0.5 % | **0.909–0.913**; **0.13 %** | ✅ |
| Near-black ≤ 2 % | **0.11 %** | ✅ |
| Warm highlights, cool shadows | shadow b* −4.9 / highlight b* +25 | ✅ |
| Local flash: full-frame luma change ≤ 0.08 | **+0.021** (the local peak is +0.48) | ✅ |
| Render ≤ 1.5 s/f @540 or ≤ 3 s/f @1080 | **0.96 s/f @540**, **2.0 s/f @1080** (30-frame `remotion render`, incl. startup, MSAA 4 + full post, 2 shadow maps) | ✅ |
| SSIM ≥ 0.90 at delivery bits per pixel (540 @ 475 kbps) | **0.910** | ✅ |

Ratio to the noir clip: sharpness 4.4× (noir 0.99), p99 0.91 (noir 0.87), amber ΔE 0.9 (noir 10.3), shimmer 0 % (noir 39 %).

## 2. Why the noir clip was soft, and what fixed it
1. **Bloom veil.** The threshold was 0.9 with smoothing 0.25, so most of the lit frame bloomed. It is now threshold **1.0**, smoothing 0.08, ADD blend: only practicals and hot cores bloom.
2. **Translucent painter strokes.** Strokes at alpha 0.2–0.5 turned into mush. Strokes in `paint.ts` are now opaque (alpha 0.42–0.9), so the breakup edges are crisp, and the brush field is opaque too.
3. **Muddy triplanar blend.** The blend is now sharpened with n⁴, so there are no soft cross-fades.
4. **No edges.** A new depth ink pass draws the paint edge in a darker, richer, cooler hue of the paint (never black).
5. **Screen-space paper tooth and animated haze/beams.** These are gone or anchored. Tooth is now object-anchored in the material.
6. **Final finish.** A luma-only, halo-limited sharpen (`sharpen 0.7`, clamp 0.06 in √Y).
7. **Background blur only on the far side.** Detail in the subject plane stays intact.

## 3. Material recipes (`gouache(opts)`, all uniform-driven, one shader program)
| Surface | Recipe |
|---|---|
| Person jacket (amber) | `brandMat(BRAND.amber)` (fabric: brand lock, xray 0) |
| Fail-safe jaws (green) | `brandMat(BRAND.green, {kind:"enamel"})`; while it bites: `emissive` green, intensity 2 to 2.5 decaying, plus `post.flash(jawWorldPos, 0.55, 170, BRAND.green)` |
| Danger plastic/paint | `brandMat(BRAND.red, {kind:"plastic"})`; red light spill only from the beacon (small radius, decay ≥ 1.6) |
| Machined steel (rail head) | `{map: steelTex, spec:1, gloss:140, specTh:0.35, metal:1, rim:0.7, brushScale:3, hot:0.6}` on a **RoundedBoxGeometry** (bevel ≥ 8 mm): flat faces cannot glint, bevels can |
| Painted / dark steel | `{spec:0.5–0.6, gloss:50–60, specTh:0.5–0.6, metal:0.4–0.6}` |
| Wet rubber / black plastic | `{color:"#1C1F26", spec:0.95, gloss:220, specTh:0.3}` |
| Helmet / cream plastic | `{color:"#E8DCC0", spec:0.85, gloss:90, specTh:0.5, hot:0.5, xray:0}` |
| Retro-reflective tape | `{color:"#D5E0E3", spec:0.85, gloss:14, specTh:0.5, hot:1, brush:0.3, xray:0}` |
| Skin | `{color:"#B07A56", spec:0.25, gloss:18, specTh:0.9, rim:0.3, xray:0}` |
| Walls / floor (static) | `{map, anchor:"world", grid:1, brushScale:0.8, rim:0.1}`. **Never `hot`** on large surfaces (it makes hairy pale halos). |
| Shell that turns into clear resin in X-RAY | add `resin:1` (housing, car body, cabin). Transparent, double-sided, depth-write off, Fresnel cyan edge, see-through face-on. Flags switch automatically. |

**Options added in v2:**
- `anchor` "object" (default, moves with the mesh, skin-safe) or "world"
- `spec`, `gloss`, `specTh`: painted 3-step specular (glint core, inner sheen, outer sheen); screen-blended, so it never goes above white
- `metal`: painted environment reflection plus darker diffuse
- `resin`
- `brand` and `brandFloor` (use `brandMat`)
- `tint` (how much the light hue tints the paint)
- `lock: 0|1|2`: the material ignores the global state
- `tooth` (0.06)
- `shoulder`
- `hot`: lamp hot spot painted as a pale mix toward the light colour; opt-in
- `fog`: haze multiplier
- `bpLine`: blueprint Fresnel fill
- `xrayLift` (0.6): kept-painted parts still read inside resin shells, which keep casting shadows

**Brand lock:** the top lit value step lands exactly on `untone(hex)`, whatever colour the key or practical is. The lower steps fall into the coloured gouache shadow. Haze is ×0.3 and pigment variation is ±2.5 %.

**Shadows:** `ind = (albedo·(0.6+0.3·brush) + uShadeFloor 0.10) · shadeCol(teal low → violet high) · uShadeK 1.15`. Dark albedos never go black.

## 4. Light rig (bench values; scale the intensities to the set)
- **Key:** warm caged lamp `SpotLight("#ffdcb0", 17, 0, angle 0.5, penumbra 0.5, decay 1.25)`, shadow 1024, radius 2.5, bias −5e-4, normalBias 0.012. The top value step needs irradiance luminance ≥ ~0.7 on the hero.
- **Cool rim:** `SpotLight("#a6e2ee", 5, …, 0.7, 0.6, 1.2)` from high behind, shadow 512 (second map).
- **Red beacon practical:** `PointLight(red, 0.9, distance 2.4, decay 1.8)`, plus a `MeshBasicMaterial` core at 3.2× red, which blooms.
- **Lamp practical in frame:** bulb core at 5× warm (blooms), a weak `PointLight` at 1.4, and a `beamMaterial` cone at 0.10 (0.04 under X-RAY). Set `uT` once per shot and never animate it.
- **No ambient or hemisphere light.** The shadow colour comes from the material uniforms (`U.uShadeLo/Hi`, `uShadeFloor`, `uShadeK`) and the haze (`U.uFogDen` 0.045).
- **Practicals are hidden in pure BLUEPRINT** (the bench toggles `visible`). Beams switch to cyan by themselves.

## 5. States
- `setLookState(0|1|2)`: 0 = BLUEPRINT, 1 = X-RAY, 2 = SOLID.
- `setSweep(from, to, {offset, normal?, soft 0.06, glow 0.3})`: points with `dot(n, p) < offset` show `to`, with a thin cyan print line on the band. Animate `offset`, for example floor → top over 1 s. When it has passed, call `setLookState(to)`.
- The post ink reads the same uniforms, so lines follow the sweep, reconstructed per pixel from depth.
- **BLUEPRINT:** navy paper, a world grid on walls (`grid:1`, kept calm so there is room for FIG./callout overlays), a cyan Fresnel fill, and cyan contours plus a soft glow from the ink pass. Use `bpFill:0` to hide a mesh in BLUEPRINT.
- **X-RAY:**
  - `xray:1` (default) glazes the part navy with cyan Fresnel.
  - `xray:0` keeps it painted (the person, the mechanism, brand materials).
  - `resin:1` makes the part clear resin.
  - The ink draws cyan contours on the interior through the shells, because shells do not write depth.

## 6. Post (`createPost(renderer, scene, camera, opts)`)
**Chain:** RenderPass (MSAA) → INK → BGBLUR → [SHARPEN, BLOOM, GRADE].

**Defaults (`POST_DEFAULTS`):**
- `msaa 4`
- `ink` on: width 2 px@1080, strength 0.75, lo/hi 0.0012/0.006, fade 14–40 m
- `dof` on: focus/focusRange from `post.focus(dist, range)`, max 8 px@1080, 12 taps, gathers from the far side only (no halos around the subject)
- `bloom` on: threshold 1.0, smoothing 0.08, intensity 0.9, radius 0.62, 7 mip levels (scale-invariant)
- `grade`: `DEFAULT_GRADE` (below)
- `vignette 0.2`
- `grain 0.012`: static per `grainSeed`, cells 2.5 px@1080; change the seed per shot, never per frame
- `sharpen 0.7`

**Grade (`DEFAULT_GRADE`, linear light):**
- `expo 1`
- Warm/cool split: warm ×(1.045, 1, 0.93) over cool ×(0.93, 0.99, 1.10), across luminance 0.015–0.30
- The split fades out for saturation 0.55–0.85, which protects the brand colours
- Hot cores (max channel > 1) normalise and bleach to white (no hue clip)
- Navy floor `navy×0.75` below luminance 0.006

**Controls:**
- `post.set({...})`: per-pass on/off. MSAA, bloom and sharpen toggles rebuild the chain.
- `preview: true`: MSAA 0, no background blur.
- `post.flash(worldPos|null, amount, radiusPx, hex)`: the **local** flash (a Gaussian glow at the projected point, before the bleach).
- `post.lastMs`: time of the last `render()`.

**Resolution:** `renderer.setPixelRatio(outputDpr())`. `outputDpr()` = `window.devicePixelRatio` = Remotion `--scale`, so 0.5 stills render a true 540×960 buffer. All pixel sizes are given at 1080 and scale with the buffer.

## 7. Exact brand colours (`colors.ts`)
- `gradeLinear()` mirrors the GLSL grade.
- `untone(hex)` inverts it with a damped fixed point.
- `brandOut(hex)` gives the colour to use for unlit lines, arrows, emissive cores and 3D labels. Keep them ≤ 1.0 so they do not bloom.
- `brandPaint(hex, {kind})` returns `GouacheOpts`; `brandMat()` builds the material.
- `deltaE00` / `linToLab` / `gradeRoundTrip(hex)` are QA helpers.
- Keep exposure at 1. If you change `DEFAULT_GRADE`, the untone follows automatically.
- Deliver with explicit colour tags (REVIEW_TECH: the streams are tagged bt470bg).

## 8. Rules for cast/set
- Use `api.ts`. Call `initShared()` once before building materials.
- Moving parts keep the default `anchor:"object"`. Large static set pieces use `"world"`.
- Bevel hard metal edges (glints). Never use `hot` on walls.
- Only `beacon` and force arrows may be red. Muted umber-violet brick (`brickTex` v2).
- Keep `uT` constant within a shot (beams). No animated textures (shimmer gate).
- Shells get `resin:1`. The mechanism and the person use `xray:0`.

## 9. Open issues
- Rail glints are still modest at the hero distance. The insert macro shot should place the key so that it grazes the bevel.
- The X-RAY p99 is 0.875, because the glaze is dark by design. The QA gate should be judged on the SOLID spans.
- The helmet hot spot leans pink under the warm key; this needs a cooler hot-mix target if it reads wrong on Rafa.
- The ink pass uses the MSAA-resolved depth, so its lines are aliased 1 px lines at 540; a 540 render + upscale needs the ESRGAN or lanczos test.
- `paint.ts` v2 makes strokes more opaque and brick muted. Set and cast textures that use these painters change look slightly; this is intended.
