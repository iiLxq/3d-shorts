# Tools scout: tested capability matrix for a premium stylized look

Date: 2026-11-08. Machine: 4-CPU Xeon 2.1 GHz, 15 GB RAM, no GPU, Ubuntu 24.04, Mesa 25.2 (llvmpipe / lavapipe).
Everything below was **actually run** in this container unless marked *(not tested)*.
Timings are seconds per frame, warm (shader compile excluded), measured while other agents shared the CPU
(load average 0.4–6.3), so treat them as ±40 %. Scratch work lives in the session scratchpad, not the repo.

## TL;DR

1. **Remotion `scale: 0.5` does NOT render at half resolution.** R3F's default `dpr=[1,2]` clamps the device pixel ratio
   up to 1, so the WebGL buffer stays 1080×1920 and is only downsampled on screenshot. Pass `dpr={scale}` to
   `<ThreeCanvas>` (or make the composition 540×960) to get the real ~4× speed-up. This also means today's
   `scripts/stills.mjs … 0.5` previews cost a full-res render each.
2. **Blender 4.5.15 LTS works headless** at `/opt/blender` (`/usr/local/bin/blender`), including **EEVEE on llvmpipe via EGL**,
   Cycles CPU + OIDN, Workbench, Freestyle and Grease Pencil Line Art. MPFB (MakeHuman) and Rigify work headless too.
3. **three.js in swiftshader:** toon shading, PCFSoft shadows, custom ink (edge) pass, bloom, N8AO, grain all work.
   VSM shadows and full-res bokeh DOF are very slow. Best value: toon + PCFSoft + ink + bloom at 540×960 ≈ **1.4–3.3 s/frame**.
4. **Upscale:** ffmpeg lanczos is ~free; Real-ESRGAN *animevideov3* via **onnxruntime CPU ≈ 3.4 s/frame** (540×960→1080×1920),
   makes ink lines much crisper. The ncnn-Vulkan build on lavapipe is 6× slower (21 s). Add grain **after** upscaling (ESRGAN eats grain).
5. **Recommended:** keep Remotion/three.js as the animation renderer at 540×960 (real dpr) with the lean stylized stack,
   and use Blender as an offline **look factory** (baked lighting/AO into textures, painted backplates, character prep → glb).
   60 s ≈ 1.7–3.5 h total render. Details in "Recommended architecture".

## 1. Blender headless

| Item | Result |
|---|---|
| apt `blender` | Candidate 4.0.2 (Ubuntu universe, after `apt-get update`). Old (pre-EEVEE-Next, pre-extensions); not used. |
| download.blender.org | Reachable (also Berkeley/RWTH mirrors). Latest: 5.2.3, LTS 4.5.15. |
| Installed | **Blender 4.5.15 LTS** tarball (378 MB download, 15 s) → `/opt/blender/blender-4.5.15-linux-x64` (1.2 GB), symlink `/usr/local/bin/blender`. |
| Extra apt packages it needed | `libegl1 libegl-mesa0 libxkbcommon0 libsm6 libxi6 libxxf86vm1` (without libEGL it aborts). Also installed `mesa-vulkan-drivers vulkan-tools libomp5` (lavapipe Vulkan + ncnn). These are image-level, not persisted in the repo; re-install in a new container. |
| GPU context | EGL on Mesa llvmpipe; prints harmless `EGL_BAD_MATCH` warnings. No Xvfb needed. |
| Python API | `bpy` scripts via `blender -b --factory-startup -P script.py -- args`. glTF/FBX import-export, SVG import, Rigify bundled. |

Bench scene: room, 40 primitives, subdivided Suzanne "character", sun + area light, camera DOF on. Times are the 2nd render in-session.

| Engine / setting | 540×960 | 1080×1920 | Notes |
|---|---|---|---|
| Workbench (studio light, shadows, cavity, 8× AA) | **1.1–2.1 s** | 3.3 s | Flat look; good for previz/animatics. |
| EEVEE (Next), 4 samples | **5.7 s** | 11.3 s | Real soft shadows, AO, DOF. Shadow speckle at 4 spp; first frame +1–25 s shader compile. |
| EEVEE, 16 samples | 12.8 s | *(not run)* | Clean. |
| Cycles CPU 16 spp + OIDN (albedo+normal) | 11.3 s | *(≈4×)* | Clean thanks to OIDN; includes BVH rebuild (use `render.use_persistent_data=True` for animations). |
| Cycles CPU 64 spp + OIDN | 38 s | — | Only for stills/backplates. |
| EEVEE 4 spp + **Grease Pencil Line Art** | 8.0 s | — | Works. Use modifier `radius` (metres, e.g. 0.01–0.02). Gotcha: setting legacy `thickness` to 25 blacked out the frame; default radius 0.0025 is sub-pixel at 540 px. |
| EEVEE 4 spp + **Freestyle** | 5.8–12.5 s | — | Works once a linestyle is assigned (empty factory scene has none → Python error "linestyle is None"). |
| Cycles 16 spp + Line Art | 21.7 s | — | Works. |

Characters in Blender (tested): **MPFB 2.0.18** extension (GPL code; generated humans are CC0) downloads from extensions.blender.org (46 MB),
installs with `blender --command extension install-file -r user_default -e mpfb.zip`, and headless `bpy.ops.mpfb.create_human()` made a
19,158-vertex human with 11 shape keys in 0.3 s; `bpy.ops.mpfb.add_standard_rig()` added a rig. Also has `add_rigify_rig`. Skins/clothes need the
MakeHuman asset packs (static.makehumancommunity.org reachable). **Rigify**: enabled fine, human metarig operator available.
FBX → glb export round-trip tested (Quaternius character, 62-bone armature → 1.1 MB glb, loads in three.js).

## 2. three.js 0.175 in Chromium swiftshader (Remotion 4.0.290)

Scene: floor + wall, 40 props (high-segment primitives), skinned **Soldier.glb** running via `AnimationMixer.setTime(frame/fps)`
(deterministic, verified pose changes), directional light with 2048 shadow map, hemisphere + point light, one emissive sphere.
`renderFrames`, concurrency 1. "Half" = real 540×960 buffer (`dpr 0.5`); "full" = 1080×1920.

| Config | Half 540×960 | Full 1080×1920 | Works? |
|---|---|---|---|
| Standard material, **no shadows** | 0.70 s | 2.4 s | yes |
| Standard + **PCFSoft** shadows (2048) | 1.34 s | 5.3 s | yes |
| same, shadow map 1024 | 1.14 s | — | yes |
| **VSM** shadows | — | 20.2 s | works, too slow (blur passes) |
| **Toon** (`MeshToonMaterial` + 3-step gradient map, Nearest) + PCFSoft | — | 3.7 s (cheaper than Standard) | yes |
| Native MSAA 4 (no post) | — | 5.9 s | yes |
| + **ink edge pass** (custom `postprocessing` Effect, depth Laplacian + silhouette) | — | +0.6 s | yes (see notes) |
| + **N8AO** (medium, halfRes; already in node_modules via @react-three/postprocessing) | — | +8 s | yes, nice contact shadows |
| + `SSAO` (needs `enableNormalPass`) | *(not timed)* | | available |
| + **Bloom** (mipmap) | — | +3 s | yes |
| + **DepthOfField** (bokeh) full-res CoC | 7.7 s total | +30 s | works, very slow |
| + DepthOfField `resolutionScale 0.35` | — | 9.5 s total | works |
| + TiltShift2 | — | 6.5 s total | works (cheap fake DOF) |
| **Toon + PCFSoft(1k) + ink**, no MSAA | **1.38 s** | — | best value |
| Toon + PCFSoft(1k) + ink + bloom + grain/vignette, no MSAA | **2.31 s** | — | |
| Same + MSAA 4 ("lean") | 3.32 s | 11.0 s | 720×1280: 5.5 s |
| Full stack: Standard + MSAA4 + N8AO + ink + DOF(0.35) + bloom + grain | 8.2 s | 29.8 s | |
| Remotion concurrency 3 (lean, half) | 4.5 s/frame throughput | | **worse** than concurrency 1: swiftshader already uses all cores |

Other verified bits: SVG string → `Image` → canvas → `CanvasTexture` on a plane (2D face decal) renders; Blender-exported glb with skeleton loads.
`@react-three/postprocessing` 3.0.4 also exports Outline, SMAA/FXAA, LUT, ToneMapping, Noise, Vignette, ChromaticAberration, GodRays, Sepia, ColorDepth.
npm registry reachable: `@react-three/drei` 10.7.9, `three-custom-shader-material` 6.4.0, `realism-effects` 1.1.2, `three-good-godrays` 0.12.2 (not installed/tested).

Notes:
- Ink pass: Laplacian of raw depth is zero on planes in screen space, so it picks up silhouettes and creases cheaply. Needs tuning
  (small cross artefacts where the depth gradient is ~0 on spheres; fixed mostly with eps = 2e-5·depth). Meshes that don't write depth
  (transparent glTF materials, e.g. Soldier) get no ink → set `depthWrite: true` / `transparent: false` on characters. An inverted-hull
  outline per mesh (*not tested*) gives thicker, controllable character lines and costs only geometry.
- Shadow map resolution costs as much as screen resolution in software raster: use 1024, a tight shadow camera, and
  `renderer.shadowMap.autoUpdate=false` for static shots.
- Bloom + DOF + AO at full res is where time explodes. Do them at reduced resolution or not at all.

## 3. Free asset sources (HTTP-tested)

| Source | Reachable? | Download works? | License | Notes |
|---|---|---|---|---|
| **Poly Haven** API (`api.polyhaven.com`) | yes | yes (`dl.polyhaven.org/file/...` gltf + HDR tested) | **CC0** | 521 models, 997 HDRIs, 869 textures. Best first stop. |
| **ambientCG** API v2 | yes | yes (`ambientcg.com/get?file=Wood049_1K-JPG.zip`, 6.8 MB) | **CC0** | 2,931 PBR materials. |
| **Quaternius** | site yes | yes via Google Drive folder + `gdown` (pip) — tested, 94 MB pulled | **CC0** | Characters (some packs rigged without animation in the "Humanoid Rig" folder), animal/props packs. Itch pages reachable too. |
| **Kenney** | kenney.nl **403 (proxy blocks)** | itch.io pages reachable; downloads need the itch click-through *(not tested)*; OpenGameArt mirrors some packs | CC0 | Ask coordinator if needed; not scriptable today. |
| **Mixamo** | home page 200, API **403** | no — needs Adobe login in a browser | free with Adobe ID; files not redistributable | Not usable from here (owner is iPhone-only). |
| **Sketchfab** | search API 200 (`license=cc0` filter works) | **401**: downloads need an API token/account | per model (CC0/CC-BY) | Would need the owner to create a token. |
| Smithsonian 3D | `3d.si.edu` **403**, `api.si.edu` open-access search works with DEMO_KEY | metadata only tested | CC0 for open-access items | |
| **NASA 3D Resources** | `nasa3d.arc.nasa.gov` 200, `raw.githubusercontent.com/nasa/NASA-3D-Resources` 200 | yes (raw files) | NASA media guidelines (free, no endorsement) | |
| **Khronos glTF-Sample-Assets** | raw.githubusercontent 200 (Fox.glb tested) | yes | per model, mostly **CC-BY 4.0** (credit needed) / some CC0 | Good test rigs (Fox is rigged + animated). |
| three.js example models (jsDelivr `gh/mrdoob/three.js@r175`) | yes (unpkg 404 for models) | yes | mixed; Soldier/Xbot are **Mixamo-derived** → don't publish | Fine for benchmarks only. |
| BlenderKit | API search 200 | downloads need account *(not tested)* | free tier mixed RF/CC0 | |
| Poly Pizza | **403** | — | CC0/CC-BY | |
| extensions.blender.org | yes | yes (MPFB zip) | per extension | |
| **github.com** (web, API, codeload, releases) | **403 via proxy** | — | — | raw.githubusercontent.com and cdn.jsdelivr.net/gh work as a workaround. |
| HuggingFace | yes | yes (ONNX model tested) | per repo | |

## 4. Character tech options

| Option | Status here | Fit |
|---|---|---|
| glTF skinned mesh + `AnimationMixer.setTime(frame/fps)` in three.js | **Tested** (Soldier run cycle, Quaternius rig loads) | Primary. Deterministic, frame-exact for Remotion. |
| Blender Rigify → bake actions → glb | Rigify enables headless; export path tested with FBX→glb | Author/retarget clips in Blender by script; ship glb. |
| MPFB (MakeHuman) humans | **Tested** headless create + rig | Fast base humans (CC0 output); stylize via shape keys/proportions + toon material + ink. |
| Quaternius CC0 characters | Downloaded + converted | Low-poly stylized characters ready for toon look; animations come from their animated packs or our own clips. |
| Procedural/IK posing in code (three.js bones, CCDIKSolver) | *(not tested)* | Good for mechanism-driven gestures (grab rail, recoil). |
| 2D cutout on planes: SVG → canvas texture | **Tested** (SVG face decal rendered) | Fits "illustrated" look; swap mouth/eye SVGs per expression; cheap. |
| Bone-based 2D cutout rig (parts as planes parented to Object3D joints) | *(not tested; trivial with the above)* | Paper-cutout characters in a 3D set. |
| Spritesheets (pre-drawn frames) | *(not tested)* | Needs drawn frames; only if images come from a generator. |
| Facial expressions | MPFB base has shape keys; glTF morph targets supported in three.js | Recommended: **2D face decal on a 3D head** (eyes/brows/mouth SVG layers) — readable on a phone, no lip-sync rig needed (faceless narrator anyway). |
| Mixamo animations | Not reachable (login) | Skip. |

## 5. Connected services (checked, nothing generated, no credits spent)

**ElevenLabs creative** (`creative_get_flow_node_types`): image generation (Nano Banana / Pro / 2 / 2.1, GPT Image 1.5–2.6, FLUX.1 Kontext / FLUX.2 Pro / FLUX 3,
**Recraft V4.1 incl. "Pro Vector"** (SVG output – useful for 2D character parts / decals), Ideogram 4.5, Krea, Seedream-style, Runway Gen-4 Image,
Topaz Image Upscale, BiRefNet background removal); video generation (Veo 3.1, Seedance 2/2.5, Kling-class, Runway Gen-4/4.5/Aleph, LTX 2, MiniMax H3,
FLUX 3 video, Topaz Video Upscale, lipsync models); plus TTS v4, SFX v2, Music v2.5, Scribe, image editor. All generation spends credits.
Possible uses: concept art/style frames, painted texture tiles, SVG face/prop parts (Recraft vector), backplate paintings. Licensing of
generated images for a monetised channel must be checked per model before use.

**Adobe** (`adobe_mandatory_init` called; account type `auth`): no text-to-image tool exposed ("generative AI not available" except
`image_generative_expand`). Available: background removal, `image_vectorize` (PNG/JPEG → SVG), lens blur, grain/noise, Lightroom presets,
crop/resize, select-subject masks, Express design tools, fonts. Useful for: vectorizing drawn character parts, cut-outs for 2D layers.
Each call needs an uploaded asset or public URL.

## 6. Upscaling (540×960 → 1080×1920, one frame)

| Method | Time/frame | Quality |
|---|---|---|
| ffmpeg `scale=1080:1920:flags=lanczos` (+ optional `unsharp`) | ~0.05 s in a video pipeline (0.36 s incl. process start) | Soft; amplifies grain if grain was rendered. |
| OpenCV `dnn_superres` FSRCNN ×2 / ESPCN ×2 (pip `opencv-contrib-python-headless`, models from raw.githubusercontent) | 0.51 s / 0.25 s | Barely better than lanczos. |
| **Real-ESRGAN animevideov3 ×4 ONNX** (HF `Tomoali/realesr-animevideov3-onnx`, BSD-3) on **onnxruntime CPU**, 256-px tiles, ×4 then INTER_AREA to ×2 | **3.4 s** | Best: clean, crisp ink edges, flat cel shading; removes grain/noise. |
| Real-ESRGAN ncnn-Vulkan (`realesrgan-ncnn-py`, py3.12 wheel) on **lavapipe** | 21–26 s | Same look, far too slow. (GitHub release binaries blocked anyway.) |
| Topaz (ElevenLabs node) | credits | not tested |

Rule: render clean → upscale → then add grain/vignette in ffmpeg (`noise=alls=5:allf=t`, per lessons).

## Recommended render architecture (premium stylized hybrid, 60 s in ~1–3 h)

**Look target:** illustrated toon characters (2–3 tone ramp + ink lines + 2D face decals) inside rich 3D sets whose lighting is
*baked*, not computed per frame; grain and colour grade in post.

1. **Blender = look factory (offline, once per set).**
   - Build/dress sets from Poly Haven/ambientCG/Quaternius/NASA + code-built mechanisms.
   - Bake Cycles lighting (AO, soft shadows, bounce light) into lightmap/albedo textures (Cycles 16–64 spp + OIDN per bake, minutes not hours),
     optionally hand-painted-look via texture filters; export glb. three.js then draws them with `MeshBasicMaterial`/toon at near-zero cost.
   - Hero backplates (static camera shots): render one Cycles/EEVEE frame at 1080×1920 (+Line Art/Freestyle ink), use as background plate
     in Remotion with a matched three.js camera; only moving parts render live with a shadow-catcher.
   - Characters: MPFB/Quaternius base → stylize → Rigify/standard rig → bake clips → glb.
2. **Remotion + three.js = animation/timing renderer** (keeps word-sync, beat sheet, signature overlays, meter, stamps in one place).
   - Render at **540×960 with `dpr` set explicitly** (or 720×1280 for hero shots).
   - Stack: MeshToon/gradient-map or baked basic materials, PCFSoft 1024 shadow only from the key light (static shots: `autoUpdate=false`),
     depth-ink pass (+ inverted-hull on characters), bloom, no MSAA (ink + upscaler cleans edges) or MSAA only on hero shots.
   - DOF: TiltShift2, pre-blurred background plates, or `DepthOfField resolutionScale≈0.35` on chosen shots only.
   - Characters can animate "on twos" (hold every other pose) for a stylized feel; the camera stays on ones.
3. **Post:** Real-ESRGAN animevideov3 ONNX upscale on hero shots (or all, if time allows), lanczos for the rest; grain/vignette/grade in ffmpeg.

Budget for 1,800 frames (60 s @ 30 fps):
| Pipeline | Render | Upscale | Total |
|---|---|---|---|
| three.js toon+ink+bloom (2.3 s) @540 + lanczos | 1.2 h | ~2 min | **≈1.2 h** |
| three.js lean w/ MSAA (3.3 s) @540 + ESRGAN (3.4 s) | 1.7 h | 1.7 h | ≈3.4 h |
| three.js toon+ink (1.4 s) @540 + ESRGAN | 0.7 h | 1.7 h | ≈2.4 h |
| Blender EEVEE 4 spp @540 (5.7 s) + lanczos | 2.9 h | — | ≈2.9 h (contention-sensitive) |
| Blender Workbench @540 (1.5 s) | 0.75 h | — | previz only |
| three.js lean at native 1080×1920 (11 s) | 5.5 h | — | over budget |

Re-render only flagged frame ranges, never the whole video.

## Risks

- **Shared CPU:** all numbers vary ±40 % with other agents running; two heavy renders at once roughly double each one's time. Concurrency >1 in Remotion doesn't help.
- **`dpr` gotcha** (above): any half-scale preview or render without explicit `dpr` silently costs full-res time.
- **Container drift:** Blender lives in `/opt` and apt libs (`libegl1`, `libegl-mesa0`, `libomp5`, `mesa-vulkan-drivers`) are image state; a fresh container loses them (save as an environment setup script if Blender becomes part of the pipeline).
- **EEVEE on llvmpipe** works today but is not an officially supported path; shader compile on first frame can take 25 s+; low sample counts show shadow noise.
- **Line Art units:** use `radius` (metres); legacy `thickness` misbehaves. Freestyle needs an explicit linestyle in scripted scenes.
- **Proxy blocks:** github.com (releases/API), kenney.nl, poly.pizza, 3d.si.edu, Mixamo API; Sketchfab downloads need a token.
- **Licensing:** prefer CC0 (Poly Haven, ambientCG, Quaternius, Kenney). CC-BY (some Khronos/Sketchfab) needs credit in the description. Never publish Mixamo-derived three.js example characters. AI-generated images/videos: check the model's commercial terms; they spend credits.
- **Ink pass quality** needs per-scene tuning; transparent materials get no lines.
- **ESRGAN** removes texture detail and grain; painted textures may look over-smoothed — test per look before committing.
