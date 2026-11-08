# Reference details (read only when a step needs this detail)

Moved verbatim from CLAUDE.md. The rules live in CLAUDE.md; this file holds the long tables, examples and specs. Section numbers inside refer to the old CLAUDE.md layout.


---

# Voiceover: tagged VO script (tags table + house-style example)

### 2.2 Writing the tagged VO script
Audio tags go in square brackets **before** the words they affect and persist until the next tag. Use **1–2 tags per sentence max** — more sounds robotic.

| Goal | Technique |
|---|---|
| Short dramatic pause | `...` (ellipsis) |
| Clear stop | `[short pause]` / `[long pause]` (v4 has no SSML breaks) |
| Emphasis on a word | CAPS: `ACTUALLY`, `LOCKS` |
| Tone | `[curious]` `[matter-of-fact]` `[tense]` `[intrigued]` `[excited]` `[warmly]` `[confident]` `[softly]` |
| Pace | `[slowly]` `[rushed]` |
| Human sounds | `[sharp exhale]` `[sighing]` `[gasping]` |
| Rhythm | commas, em dashes, line breaks between beats |

Reference tagged script (elevator video — this delivery is the channel's house style):
```
[curious] What ACTUALLY happens... if the cable on your elevator snaps?

[matter-of-fact] First — there's almost never just one cable. Most elevators hang from several steel ropes, and each one is strong enough to hold the car on its own.

[slowly] But say... every single one breaks. At the same time.

[tense] The car drops. [rushed] It's picking up speed. And up at the top of the shaft, one little wheel is spinning faster... and faster...

[intrigued] That's the governor. When it spins too fast, weights inside fling outward, trip a latch — and it LOCKS onto a second rope.

[excited] That rope yanks up on steel wedges under the car, and jams them into the guide rails. [short pause] [sharp exhale] Stopped.

[long pause] [warmly] And it all started in 1854... when Elisha Otis stood on a raised platform in front of a crowd, and ordered the rope cut. It dropped a few inches... and stopped.

[confident] "All safe, gentlemen. All safe."

[softly] That one brake... is why skyscrapers exist.
```
Patterns to reuse: curious hook → matter-of-fact comfort → slow ominous turn → tense/rushed danger → intrigued mechanism → excited payoff + one-word stop line → long pause → warm history tag → soft final line.

Never use the app's "Enhance" auto-tagging — it overwrites hand-placed tags.


---

# Audio analysis → master timeline (pause-detection method)

## 3. Audio analysis → the master timeline

The VO file is the clock for the whole video. Do this before designing any shot.

1. Convert: `ffmpeg -i vo.mp3 -ac 1 -ar 16000 vo.wav`. Get duration with ffprobe.
2. **Pause detection** (10 ms RMS frames, threshold ≈ −38 dBFS, min gap 0.10 s) → list of speech intervals. Coarser check: `silencedetect=noise=-35dB:d=0.25`.
3. **Map script phrases to speech intervals** using punctuation: commas, dashes and ellipses produce gaps; sentence ends produce longer gaps; `[long pause]` produces the longest (≈1.3 s). Sanity-check each mapping with syllable rate — normal delivery is **≈ 4.5–6.5 syllables/s**; a mapping that implies 9+ syl/s is wrong.
4. **Word timings:** within each phrase, spread words across the *voiced* frames in proportion to syllable count (keep an overrides table for numbers and tricky words: "1854" = 4, "elevator" = 4, "governor" = 3…). Accuracy ≈ ±0.2 s, good enough for event sync and captions. If a real transcript with timestamps exists, use it instead.
5. Write a **beat sheet**: every key word with its timestamp, e.g. `snaps? 4.02 · breaks 17.3 · drops 20.2 · latch 32.25 · LOCKS 33.13 · yanks 35.28 · Stopped. 40.55 · cut 49.82 · stopped 52.5`.
6. Video duration = VO duration + ~1.0 s tail.

---


---

# Shot list template (elevator video)

### 4.1 Shot list
One row per shot, cut on phrase boundaries, each shot 1.2–4.8 s (hook shots shorter, mechanism close-ups longer):

| # | t0–t1 (s) | VO line | Shot | Key event @ time |
|---|---|---|---|---|

Elevator video shot list (23 shots, 60.5 s) as the template:
1. Inside the car, doors close, floor display "18", light flickers (hook question).
2. Macro of wire rope strands fraying, wires pop one by one, snaps on "snaps?" then fast pull-back.
3. Machine room: traction sheave, motor, brake, 6 ropes running over grooves.
4. Wide on car + ropes; ropes light up cyan one by one on "several steel ropes".
5. All ropes but one fade to ghosts; the remaining one glows ("each one… on its own").
6. Tension push-in, all ropes snap on "breaks" (staggered 12 ms, flash, shake).
7. Slow-motion replay from above ("At the same time").
8. Low angle, car drops toward camera ("The car drops").
9. Tracking fall with light streaks ("picking up speed").
10. Whip pan up the shaft to the governor ("And up at the top of the shaft").
11. Governor spins faster, ratchet sound rising.
12. Governor beauty shot with orange glow pulse ("That's the governor").
13. Close-up: flyweights fling outward ("weights inside fling outward").
14. Latch trips (red flash) → jaw clamps the rope, wheel stops dead ("LOCKS").
15. Follow the glowing governor rope down to the lever; lever yanks; wedges highlight.
16. Wedges jam the rail: glow red-hot, spark fountain, heavy shake.
17. Wide: car slides into frame and stops; ropes flop; dust ("Stopped." + silence).
18. White flash → sepia 1854 exhibition hall, crane down over the crowd.
19. Otis on the raised platform, crowd foreground.
20. Axeman swings, cuts the rope on "cut" (gasp).
21. Slow-mo: spring straightens, pawls catch the ratchet teeth on "stopped".
22. Low hero angle: Otis lifts his top hat ("All safe…"), crowd cheers.
23. Color flash → night city, tilt up a skyscraper with a glowing elevator rising; final hit; fade to black.


---

# Toolchain and project layout

## 5. Toolchain and environment

You work in a Linux workspace. **Check what exists before planning** (`which`, Python imports). Proven stack (no Blender needed):

- **Rendering:** raw **WebGL2** in headless **Google Chrome** driven by **Playwright** (Python). Launch flags: `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --allow-file-access-from-files`. Verify with a one-off page that reports `WEBGL_VERSION`. No three.js needed (and the network may block CDNs) — write a small engine (§6).
- **Encoding:** ffmpeg (libx264, aac, libass for captions, `noise`, `vignette`, `loudnorm`, `ebur128`, `sidechaincompress`).
- **Audio synthesis & analysis:** numpy + scipy (`signal.butter/sosfilt`, `fftconvolve`).
- **Images:** Pillow for contact sheets.
- Fonts available for captions: Inter (ExtraBold/Black), Poppins Bold.
- **Sound:** ElevenLabs connector for SFX + music (fresh per video), brand sounds from `assets/brand/`; numpy/scipy synthesis as fallback.
- Network may be restricted: no pip installs, no downloads of stock footage/music. Everything is generated.

### 5.1 Project layout
```
film/
  film.html        # loads engine.js, worlds.js, shots.js; exposes frame(shotIndex, t)
  engine.js        # math, GL programs, meshes, draw queue, particles, grading
  worlds.js        # scene builders: shaft(st), cabin(st), hall(st), city(st)…
  shots.js         # SHOTS = [{t0,t1,f(t) -> {world, st, cam, light, fog, grade}}]
  render.py        # preview mode (contact sheets) + full mode (one mp4 per shot)
  mix.sh, measure.sh
  shots/sNN.mp4    # rendered shots
  concat.txt, video_raw.mp4
vo/
  tighten.py (dead-air remover), vo.mp3, vo.wav, captions.py, captions.ass, audio.py, sfx.wav, music.wav
remotion/          # three.js + Remotion render stack (package.json, src/), node_modules + out/ git-ignored
assets/brand/      # FIXED brand sounds, reused every video, never changed
  intro_blueprint.mp3, alarm_meter.mp3, safety_clunk.mp3
```

---


---

# Raw-WebGL engine spec (fallback renderer)

## 6. The engine (technical spec)

### 6.1 Canvas and timing
- **1080 × 1920, 30 fps**, `antialias:true`, `preserveDrawingBuffer:true`.
- Units: **meters**. Y is up. Camera "forward" for most shots looks toward −Z.
- `frame(i, t)` renders shot `i` at **video time t** (seconds) and returns `canvas.toDataURL('image/jpeg', 0.92)`.
- Portrait framing math: horizontal FOV = `2·atan(tan(vFOV/2)·0.5625)`. A 56° vertical FOV only shows ≈33° horizontally — **wide objects get cropped; frame along their long axis or step back.**

### 6.2 Geometry primitives (unit-sized, scaled per instance)
- `box(center, size, color, opts, basis)`
- `cylB(a, b, radius, color, opts, mesh)` — cylinder between two points (ropes, rods, posts, arms). Use a 10-segment mesh for thin ropes, 32-segment for visible cylinders.
- `disc(center, r, thickness, …, basis)` (axis Z) / `discX` (axis X) — wheels, sheaves, buttons.
- `sph(center, r, …)` — heads, foliage, glows.
- `poly(points, r, …)` — polylines (arcs over sheaves, arches, springs, helical rope strands).
- `digit(center, h, d, color, basis)` — 7-segment emissive digits for floor displays.
- Each draw: `{mesh, center, basis(3 column vectors), scale, color, emissive, roughness, mode, seed}`. Normal matrix = basis columns ÷ scale.

### 6.3 Shading (one forward pass)
- Lambert key light + cool fill light + hemisphere ambient (`mix(amb0, amb1, 0.5+0.5·n.y)`) + Blinn-Phong spec scaled by (1−roughness) + Fresnel rim (fill color) + **emissive** + exponential **fog** + soft tonemap `c/(1+0.12c)` + gamma 1/1.1.
- Back faces: flip the normal with `gl_FrontFacing` so thin panels shade correctly from inside (cabin interior).
- **Grade uniforms:** `sepia` (0–1, luminance × (1.12, 0.92, 0.66)), `expo` (fades), `flash` (adds white for impacts/transitions).
- **Background:** full-screen gradient quad (skyTop/skyBot) drawn before geometry, depth test off.
- **Procedural windows mode** for buildings: on vertical faces, a 1.5 × 2.2 m cell grid; random lit cells (≈42%), warm/cool mix — whole skyline for the cost of one box each.

### 6.4 Lighting presets
| Scene | Key dir | Key color | Ambient low/high | Fog color / density |
|---|---|---|---|---|
| Shaft | (.55,.75,.6) | (1.2,1.14,1.05) | (.10,.12,.17)/(.22,.25,.32) | (.035,.05,.09) / .045 |
| Machine room | (.4,.85,.5) | (1.25,1.15,1.0) | (.16,.16,.18)/(.30,.30,.32) | (.06,.065,.08) / .03 |
| Cabin | (.2,1,.3) | (.9,.88,.82) | (.18,.18,.2)/(.35,.34,.33) | warm (.25,.21,.17) / .02 |
| 1854 hall (sepia) | (.3,.9,.45) | (1.15,1.05,.9) | (.16,.15,.14)/(.32,.30,.28) | (.36,.31,.25) / .018 |
| Night city | (−.4,.6,.7) | (.35,.4,.55) | (.05,.06,.1)/(.10,.12,.2) | (.03,.045,.09) / .006 |

### 6.5 Particles (additive point sprites)
- Separate program, `gl_PointSize = size·1000/w`, Gaussian falloff, additive blend, depth write off.
- **Sparks:** born over an emission window; each has birth time, lifetime 0.12–0.37 s, velocity = random spray **minus 90% of the parent object's velocity** (so they stay near a moving source), gravity −6 m/s², 4-point trail at 4 ms steps, color from white-yellow (hot) to orange (cooling). Count ∝ speed.
- **Snap burst:** 14–40 particles + one big bright glow sprite fading over 0.12–0.15 s.
- **Dust motes:** 220–300 faint static points near the camera for depth/atmosphere.
- **Dust puff on impact:** 60 soft large sprites expanding and fading over 1.2 s.
- All deterministic via a hash `rnd(i)` — the same frame always renders identically (required for per-shot re-renders).

### 6.6 Performance
- Swiftshader is CPU rendering: ~0.2–0.5 s per 1080×1920 frame. A 60 s video ≈ 10–15 min.
- **Cull by distance to camera** (e.g. landings/brackets only within ±50 m of the camera's Y).
- Keep draw calls under a few thousand per frame. Avoid per-joint spheres on long polylines.
- Hall crowds (~70 people × ~12 parts) are the heaviest scenes; that's fine.

---


---

# Animation techniques

## 7. Animation techniques

### 7.1 Timing tools
- `ease` (smoothstep), `easeIn` (t²), `easeOut`, `bump(t,a,b)` (sine hump for pulses), `clamp`, `lerp/vlerp`.
- **Write every timeline in video time** using beat-sheet timestamps: `trip: ease((t-32.25)/0.12)`.
- **Story-time remapping** for slow motion: `d = 0.03 + (t − shotStart) × 0.12` → 8× slow-mo replay that reuses the same physics.
- **Physics cheats that read well:** free fall a ≈ 9 m/s²; braking as constant deceleration ending exactly on the "Stopped." beat; speeds chosen for drama, not realism.

### 7.2 Camera
- **Push-in** (tension), **orbit** (reveal a mechanism), **crane down** (establishing), **tracking** (falling object, camera locked relative to it), **whip pan** (fast eased travel between locations with streaks), **low hero angle** (payoff/history).
- **Handheld drift:** 1–2 cm sinusoids on all axes (`sin(t·1.3)`, `sin(t·1.7+1)`…).
- **Impact shake:** high-frequency sinusoids (71/53/37 Hz-ish) with amplitude decaying as `exp(−k·dt)`; 3–9 cm for big hits, 1–3 cm for small ones. Add a white `flash` of 0.12–0.45 decaying in ~0.1 s on snaps/cuts/locks.
- **Never aim the camera straight up or down** (lookAt with up = +Y degenerates). For a look-up move, blend directions and keep a horizontal component.
- When an action happens fast at macro scale, **pull the camera back on the event** (fray close-up → ease-out pull-back on the snap) so the result is readable.

### 7.3 Motion details that sell it
- **Ropes snapping:** upper end recoils upward (`11·(1−e^(−3.5d))`) with a damped whip (`0.55·sin(22d)·e^(−2.2d)`); lower stub flutters while falling and **flops over** once the car stops (segment-angle chain).
- **Fraying:** 14 thin wires bulge outward; each breaks at its own threshold and curls into two spikes; then the rope parts.
- **Rotating parts:** drive angle from rope travel / radius; **cap on-screen angular speed ≈ 12 rad/s (~1.9 rev/s)** and use asymmetric parts to avoid wagon-wheel aliasing at 30 fps.
- **Mechanisms (cause → effect chain):** flyweights spread with speed → latch rotates and flashes red → linkage rod glows → jaw clamps the rope → wheel stops in 0.1 s → governor rope glows down to the car → lever lifts → wedges rise & close the gap → heat glow → sparks → stop. Show every link; viewers follow glowing paths.
- **Ghosting to isolate:** dim and thin all-but-one element to the fog color while the hero element glows.
- **Fake motion blur:** stretch emissive light strips vertically in proportion to camera speed ("streaks").
- **People (low-poly):** legs/skirt, torso box, sphere head, cylinder arms with shoulder pivots (sideways raise + forward raise), hats (top/bowler/bonnet). Crowd reactions: gasp = lean back + arms forward; cheer = arms up with per-person phase offsets. Hat lift: hat follows the hand.
- **Axe swing:** raise 0.5 s (arm forward-raise to ~2.9 rad) → strike 0.27 s with easeIn → contact exactly on the word "cut".

---


---

# Visual style guide (palette, composition)

## 8. Visual style guide

- **Look:** clean, stylized low-poly explainer — readable shapes, saturated accents, dark atmospheric environments. Not photoreal.
- **Palette (linear-ish RGB):**
  - Shaft walls `(.16,.18,.24)`, side walls `(.12,.13,.18)`, rails `(.62,.66,.72)`
  - Car body `(.86,.88,.92)`, doors `(.68,.72,.80)`, accent stripe blue `(.10,.65,.95)`
  - Car frame / safety yellow `(.95,.72,.10)`; wedges `(1,.8,.15)` → heated `(.35,.08,.02)` + orange emissive
  - Governor orange `(1,.42,.10)`, flyweights `(1,.55,.08)`, steel rope `(.72,.74,.78)`
  - Landing light strips cyan emissive `(.35,.85,1)`
- **Color meaning (keep consistent across videos):** cyan glow = "look here / this part", orange glow = "this is the mechanism working", red flash = "trigger / danger", white flash = "impact / transition", sepia = "history".
- **Composition in portrait:** hero subject in the middle third; keep the area around **y ≈ 1100–1300** readable for captions; keep important action out of the bottom ~20% and the right edge (platform UI).
- **Avoid clutter in the foreground:** rails, brackets, and repeated bars right in front of the lens read as a "cage". Move the camera so they frame, not block.
- History scenes: sepia 1.0 + `noise=alls=10:allf=t` film grain at encode + banners, iron arches, wood floor boards.
- Every shot gets a subtle `vignette=PI/5` (optional) — keep consistent.

---


---

# Rendering and assembly commands

## 10. Rendering and assembly commands

- Per shot: pipe JPEG frames into ffmpeg:
  `ffmpeg -f image2pipe -framerate 30 -c:v mjpeg -i - -vf format=yuv420p -c:v libx264 -crf 17 -preset veryfast -pix_fmt yuv420p -r 30 sNN.part.mp4` → rename to `sNN.mp4` only if ffmpeg exits 0.
- Frame ranges: `round(t0·30) … round(t1·30)−1` so shots tile exactly.
- History shots: add `noise=alls=10:allf=t` before `format`.
- Join: concat demuxer + `-c copy` (all shots share size, fps, encoder settings). Crossfades/flashes live *inside* a shot, never between files.
- Changing one shot = re-render only that shot (and its neighbor if a transition spans the cut), then re-concat.
- Final mux (no captions): `-map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -movflags +faststart`.
- With captions: `-vf ass=captions.ass -c:v libx264 -crf 18 -preset veryfast`.

---


---

# Sound design and music: synthesis fallback recipes

## 11. Sound design and music (48 kHz stereo)

**Default source: ElevenLabs, fresh per video** (see "Sound rules" in the signature style). The recipes and music plan below are the **fallback** when ElevenLabs isn't available, and a reference for what each sound should do (use them as prompt ideas). Brand sounds always come from `assets/brand/`.

### 11.1 SFX recipe library (numpy/scipy)
- **Elevator ding:** two bell partial stacks (1318.5 Hz then 1046.5 Hz, partials ×1, 2.76, 5.4) with exponential decay + short reverb.
- **Door slide:** band-passed noise 200–1800 Hz + rising 180→220 Hz motor tone with 11 Hz wobble, sine envelope. **Door thunk:** low sine with pitch drop + clicky noise.
- **Light flicker:** 40 ms bursts of 120 Hz sawtooth + hiss.
- **Metal creak (stick-slip):** jittered pulse train at 140–300 Hz through 300–2500 Hz and 900–1400 Hz band-passes.
- **Wire ping:** 1.9–4 kHz sine decaying in 60 ms + 4 ms noise tick.
- **Rope snap:** 10 ms high-passed noise crack + inharmonic metallic ring (ratios 1, 1.47, 2.09, 2.83, 3.97, 5.1 on ~380 Hz) + 60 Hz thump + band-passed whip whoosh + reverb.
- **Machine room:** 50 Hz hum with harmonics + 620 Hz gear whine + periodic soft ticks.
- **Highlight ticks:** rising-pitch pings, one per highlighted element, panned across.
- **Falling wind:** noise split into low/mid/high bands whose gains rise with speed, plus random rattle impulses.
- **Whoosh:** crossfade between low and high band-passed noise with a sin^1.5 envelope.
- **Governor whir:** tone at `70 + 22·ω` Hz (sine + 2nd + sawtooth) + **ratchet clicks** generated from cumulative rotation (6 clicks per revolution); hard stop with a 30 ms decay on the lock.
- **Latch / lock / lever:** metallic clank recipe at 700 / 260 / 330 Hz with thumps.
- **Brake screech:** 4 wobbling partials (≈1180/1730/2460/3350 Hz) + broadband noise + spark crackle impulses, intensity envelope following the deceleration.
- **Stop impact:** 42 Hz pitch-dropping thud + clank + small settle thuds + cooling ticks + slow creak.
- **1854:** vinyl crackle, crowd babble (14 band-passed noise "voices" with syllabic amplitude modulation), axe chop, gasp (breathy band-passed swell), spring "boing", ratchet clank, applause (dense random clap impulses + reverb).
- **City:** low traffic rumble, faint elevator hum, transition whoosh.

### 11.2 Music bed (key of D, synthesized)
- **Act 1 (hook → snap):** low D drone (D + fifth, detuned saws low-passed at 500 Hz), soft kick at 100 BPM, hats from ~4.5 s, a minor-chord riser into the snap. Music drops out for 150 ms on the snap.
- **Act 2 (fall → stop):** driving 16th-note bass ostinato at 120 BPM (D minor figure), kick every beat, high tension pad swelling. **Hard cut to total silence on the stop impact**, held until the history section starts (≈2 s of silence — the most powerful moment).
- **Act 3 (history):** warm music-box arpeggio in D major (0.3 s steps) + soft pad; drops to 40% under the axe and catch.
- **Act 4 (final):** major pad swell + final low hit right after the last word, reverb tail into the fade.

---


---

# Mixing details

## 12. Mixing (numbers, because you can't listen)

- Chain (ffmpeg): VO → mono-to-stereo, padded to video length → used as **sidechain** for music (`sidechaincompress threshold=0.02 ratio=5 attack=15 release=350`) → `amix normalize=0` with SFX → `loudnorm I=-14 TP=-1.5 LRA=11`.
- Gains that worked: music ×0.11 (pre-sidechain), SFX ×1.0.
- **Never peak-normalize the SFX stem.** Write it with a fixed reference divisor (e.g. 4.5) so turning one effect down actually lowers it instead of raising everything else.
- **Measure** per-second RMS of VO alone vs. music+SFX ("bed") through the same chain. Target **VO ≥ +10 dB over the bed during speech**. Short negative values are OK only in gaps between words (snaps, the stop impact).
- **Place impacts just before or after words**, never on top of a key word (move the "stop" thud to ~0.1 s before "Stopped."; start applause after the line it follows; keep the closing line's bed quiet).
- Final check: `ebur128` → integrated ≈ −14 LUFS, true peak ≤ −1 dBTP.

---


---

# Delivery to an iPhone: page details

## 13. Delivery to an iPhone

- Files over ~50 MB often hang in the in-app viewer. Always also make a **phone copy**: 2-pass H.264 at ~1.9 Mbps + AAC 128k → ≈15 MB for 60 s (1080×1920 kept). It must stay **under 16 MB** (measured artifact per-file cap).
- For full quality, publish an **artifact page** with:
  - a `<video controls playsinline>` streaming the ≤15 MB copy (artifact files are capped at **16 MB each** (measured Nov 2026), 64 MiB per publish call, **256 MiB total per artifact**),
  - the full file **split into 15,728,640-byte parts** (`split -b 15728640 -d -a 2 --additional-suffix=.mp4`, verify with `cat | cmp`), uploaded over several publish calls (≤4 parts per call),
  - a **Save full quality** button that fetches parts (3 in parallel, streaming reader, live "x / y MB" counter, 45 s stall watchdog), builds a Blob, and calls the `downloads` capability `save({filename, data: blob})` → iOS share sheet → **Save Video**,
  - a **Save smaller copy** button for the 15 MB version.
  - Declare `capabilities: {downloads: {}}` (with `contract: "latest"`) on the second publish. Template: `videos/01_ram_air_turbine/delivery/index.html`. Tell the user to keep the page open and the screen on while it prepares.
- Default deliverable = **no captions** (user captions in CapCut). Offer the captioned version only when asked.

---


---

# Captions spec (only when requested)

## 15. Captions (only when requested)

ASS subtitles burned with libass:
- Font **Inter ExtraBold 86 px**, white, black outline 7, shadow 4, `\an5` at `\pos(540,1180)`, **UPPERCASE**, quotes and ellipses stripped.
- **2–3 words per chunk**, split phrases evenly (4 words → 2+2), never leave a one-word orphan unless the phrase is one word; split any chunk longer than 17 characters.
- Active word: yellow `&H00D4FF&` at 112% scale; first word of each chunk gets a 160 ms pop (104% → 100%).
- Chunk stays until the next chunk starts if the gap is < 0.35 s, otherwise its last word end + 0.25 s.

---


---

# Lessons learned (full list)

## 16. Lessons learned (don't repeat these)

1. Long boxes (rails, walls) poked up into the machine room → clip scene geometry to the room it belongs to.
2. Spheres at polyline joints made rope strands look dotted → use more segments (≈120/m) instead.
3. Six identical ropes filling the frame looked like jail bars → macro shots should isolate one hero element with shallow framing.
4. Brake close-up was unreadable until the camera moved outside the car and the front jaw plate was removed → design mechanisms for the camera, not for realism.
5. Big cyan streak rectangles in close-ups → scale streak length down when the camera is near the wall.
6. Captions split as one-word orphans ("ROPES,") → balanced chunking.
7. Peak-normalized SFX stem made level fixes useless → fixed reference scaling.
8. Applause and impacts masked spoken words → time effects into gaps.
9. A 200 MB MP4 never loaded on the iPhone viewer → phone copy + artifact page with chunked download.
10. One artifact can hold at most 256 MiB → don't keep two full-quality versions on one page.
11. The artifact host refused an 18 MB file (per-file cap is 16 MB, not 20 MiB) → 15 MiB parts and a ~15 MB phone copy.
12. Grain over a 16 s section tripled the full file (317 MB) → grain `alls=5`, CRF 18 (~100 MB).
13. Ending with a blueprint↔solid sweep caused flicker on overlapping surfaces → end with a white-flash cut into the opening frame instead.
14. Far camera + near plane 0.05 made the runway flicker → use near 0.6 m outside, 0.05 only inside the cockpit.

---
