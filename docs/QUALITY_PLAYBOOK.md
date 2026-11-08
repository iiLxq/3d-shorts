# Quality Playbook v2: how to make our 3D Shorts look premium

Source of these methods: the "Claude Animated Shorts" workflow (mromidev/claude-animated-shorts, MIT) and the
"Ultra-Realistic 3D Shorts" workflow (Blender), adapted to OUR channel. We borrow their **methods and measured
craft rules**, never their style, characters, scripts, shots or reference frames. Our look stays
**Fail-Safe Files** (blueprint → x-ray → solid, safety-green payoff, danger meter on the left, brand sounds).

Read together with CLAUDE.md. Where this file gives a number, it replaces older numbers in CLAUDE.md
(for example, there is **no hand-held drift** any more, see §3).

---

## 1. The core rule: measure, don't opine

> "You can't recreate an opinion. You can recreate a number."

1. **Never judge a frame by eye alone.** Every look decision is backed by a measurement script that prints numbers.
2. **Same pipeline on both sides.** Any measurement we run on reference videos, we also run on our own render.
   **The difference between the two tables is the to-do list.**
3. **Re-measure after every fix.** A fix is only done when its number moved toward the target.
4. Reports are written as **tables of numbers + exact parameter changes + file to edit**, never adjectives.

### 1.1 Reference study (do this once per new style direction, then reuse the numbers)
- Pick 10–20 top Shorts in our lane (engineering / "what happens if" / 3D explainer, including our competitors)
  and download them at 720p with original audio (yt-dlp). **Private study only: never upload, publish, or reuse
  their footage, frames, scripts or characters.**
- Analyse **every frame at 30 fps** (sampling a few frames misses micro-animation, camera creep and light changes):
  - **Contact sheets:** one sheet = 2 s = 60 frames (10×6 grid, frame numbers burned in). Look at them.
  - **Camera:** sub-pixel phase-correlation similarity fit per frame pair (translation, zoom, roll) on ~9 tiles,
    with caption bands masked and outlier tiles rejected. Integrate into a path, smooth (Gaussian σ≈1.2 f), classify
    hold < 0.3 px/f, drift < 2, move ≥ 2 (px at 720p). Report: % hold/drift/move, peak speed, attack/release frames,
    push-in rate in quiet frames, roll moves per 10 s, hard cuts per video. *Warning: integer phase correlation can't
    see motion below ~4 px/f and will wrongly report a "still" camera. Use sub-pixel.*
  - **Grade:** per frame, after masking captions and ink lines: luma Y' p1/p5/p50/p95/p99, mean, std, HSV saturation,
    colourfulness, local contrast, black point (mean RGB of darkest 0.5 %), vignette (corner/centre luma ratio),
    Lab hue per zone (shadows / mids / highlights), lit chroma C* p50/p90. Cluster by lighting (day / golden / night /
    interior / x-ray / blueprint).
  - **Script & voice:** transcribe; words per second, pause totals, hook structure, sentence length, pivot phrases.
  - **Audio:** integrated LUFS, LRA, true peak, music/SFX level vs voice.
- Save numbers to `references/reports/<topic>.md` and summaries to `references/STYLE_TARGETS.md`.

### 1.2 Our own render QA (every video, before delivery)
Write/keep `scripts/short_qa.py` that reads the final mp4 and reports:
- specs (size, fps, frame count, duration, audio codec/rate), loudness (ebur128 I / LRA / true peak), silences;
- **black frames** (mean luma < 0.04), **unplanned white frames** (> 0.93), **frozen spans** (≥ 12 frames with
  almost no change → every hold must creep), **pops** (frame-diff spike > 3× local median that isn't a planned cut,
  flash or crossfade);
- per-shot medians of luma mean / std / p2 / p98 / saturation;
- 2 s contact sheets of the whole video for the reviewer.
Fix everything it flags, then re-run.

### 1.3 Independent verifier
After each look pass, a **fresh agent that did not build the frames** reviews side-by-side sheets
(ours vs targets/reference stills) and returns: a score /10 per area (colour, lighting, line work, materials,
characters/props, depth, composition, motion) + a numbered fix list with frame numbers, ≤ 200 words.
Iterate until every area ≥ 7. Map each fix to the file that owns it (§8).

---

## 2. Script & voice (craft numbers)
- **Voice starts on frame 1–4.** No intro, no logo, no title card before the first word. The opening brand sound
  plays *under* the first line, not before it.
- **Hook = a paradox stated as fact in sentence 1** (10–16 words). No setup.
- **Pace:** measure our niche. Fast story channels run ~3.5–4.1 words/s with < 1 s total of pauses; calm 3D explainers
  run ~2.8 words/s. Pick a target per format and hold it. (Our elevator VO ran ~2.5 words/s; aim for ~3.0 for Format 1.)
- **Escalation in 3–6 beats**, each bigger. One **mystery/question beat**.
- **Our own signature pivot line** into the explanation, the same in every video (do NOT reuse other channels'
  pivots). Example candidates: "Here's the trick." / "Here's what saves you." Pick one and keep it forever.
- **One researched deadpan joke** per video (true fact, double line works well:
  "Luckily, … / Unluckily, …").
- Explanation = **one physics idea + one everyday analogy**.
- **Ironic/callback payoff** in the last 1–2 sentences; the video ends on the last word, then loops to the blueprint.
- **Never describe what the viewer already sees.**
- Fact-check every number before writing; if a famous number is shaky, say "scientists estimate".
- **Word timings from a real transcript**: use ElevenLabs speech-to-text (Scribe) to get `words.json` with word times,
  then hand-fix. Everything (cuts, events, sound) is timed from `words.json`. Visual reactions land **0–3 frames
  before** their word.

---

## 3. Camera grammar (replaces the old CLAUDE.md camera rules)
- **No hand-held float.** Delete random drift/sinusoid "hand-held" motion.
- **Every move is a symmetric smootherstep glide of 18–40 frames** (≈10 f in, 10 f out). Never 3-frame snaps.
  Peak speed ≈ 1.875 × distance / duration; keep peak ≤ ~25 px/f at 720p.
- **Every hold creeps:** push in 0.15–0.35 % per frame; 0.6 %/f on punch words for ~35 f with soft 8 f edges.
  No static hold ≥ 4 frames (QA flags ≥ 12 f as frozen).
- **Hard cuts only on big jumps** (place/time change). Otherwise transitions are **camera moves**: follow an object
  into the next subject, fly through an opening (window, hatch, gap), whip pan with motion blur, or a 6–8 frame
  crossfade when changing place.
- **Impact kicks:** shake that **flips sign every frame** and decays over ~7 frames (not slow wobble).
- **Rolls / dutch tilts:** 4–5° for drama and falls, over ~18 frames.
- **Foreground framing props** in about 1/3 of shots (rails, brackets, beams), but recognisable and never closer
  than ~2 m to the lens; re-check every prop whenever a camera moves.
- **Sight-line culling:** automatically hide any object that blocks the ray from a camera to its look target
  (prevents "camera stuck inside a wall/house" shots).
- Low camera heights for drama; lens ~2.5 m up when rails/railings would cross torsos.

## 4. Light & colour (grade targets)
- **No pure black anywhere** except deliberate line work. Lift and colour the black point (warm-lifted, e.g. ~RGB 35,19,20
  on 0–255). Non-line p5 luma ≈ 0.2 on bright scenes.
- **Bright, saturated mids:** day/normal scenes median luma ≈ 0.55–0.57, near-whites present (p99 ≈ 0.95);
  lit chroma C* p90 ≈ 55.
- **Coloured shadows:** cool blue/violet shade, never brown or grey; warm key light. Shadow tint goes in the shade
  only, not over the whole frame.
- **Lighting follows the story:** bright/warm for setup, colder/darker for danger, our **blueprint navy** for
  hook/explanation states, **safety-green** accent at the save. History = sepia + archive stamp.
- **Vignette:** corners ≈ 0.85× centre luma.
- **Fog = horizon/sky colour**, starting ~25 m; adds depth without greying the subject.
- **Bloom only on true HDR emissives** (threshold 1.0, e.g. sparks, warning lights, safety-green glow).
- **Tone mapping:** a neutral/AgX-style map that keeps saturated colours and stops highlights clipping to flat white.
- **Grain:** off by default (it bloats file size and turns to mush after YouTube compression).
- "Too perfect = fake": add the camera imperfections that real lenses have: soft lens (slight bloom on brights),
  vignette, motion blur on fast moves. Keep them subtle.

## 5. Depth & lens
- **Depth of field on ~1/3 of screen time** (close-ups, medium shots, inserts): background blur ~10–16 px at 1080
  wide for close-ups, ~10–12 for medium, 0 for wides/aerials. Focus on the subject (the mechanism or the person).
- The blur pass must come **after** any line/outline pass (if they run in one pass, the blur wipes the lines).
- Every pixel-sized parameter (line width, blur radius) scales with output height / 1920.

## 6. Materials & assets ("primitives look homemade")
- **If a real one exists, download it; never build it by hand.** Use CC0 sources: Poly Haven (models, textures,
  HDRIs; API users credit "Powered by Poly Haven"), Kenney kits, public scan databases, NASA imagery.
  Recolour every imported asset to our palette by material name.
- **Painted procedural textures** (canvas or shader) for metal, concrete, wood: visible grain, wear, and **dark
  seams/gaps** between parts. No flat single-colour surfaces on hero objects.
- **Bevel every hard edge** a little; flat 90° box edges read as cheap.
- **Line work (our version):** in BLUEPRINT state, glowing cyan edge lines from a depth+normal edge pass; in SOLID
  state, thin dark (not pure black) lines on silhouettes and creases, roughly constant width (~3–5 px at 1080),
  no lines on floor/wall joins or the horizon. This is our own blueprint→ink identity.
- Hero props (governor, wedges, saw brake, airbag) can come from Meshy (text/image → GLB) when needed.

## 7. Motion & character details
- Animate on ones (every frame). Acting beats land 0–3 f before the word.
- People: walk bob 3–7 % of height, lean 1–7°, planted feet (no foot sliding), step 9–12 frames; blinks every
  0.5–2.3 s lasting 4 frames (half / shut / shut / half), and a blink on every expression change.
- Machines: anticipation (small wind-up), overshoot and settle on stops, secondary motion (cables, dust, sparks).
- Effects as clean stylised sprites in the 3D scene (sparks, dust puffs, speed lines, impact bursts) in our palette.

## 8. Working with several agents
- Split the work **by files, not just by jobs.** Each agent gets its own sandbox copy of the project and owns
  specific files; nobody edits another owner's file. Example owners:
  - **cam:** shot list, camera keys, cuts, kicks, DOF table, foreground props
  - **world:** lights, sky, fog, grade
  - **mat:** procedural textures, assets, buildings/machines
  - **char/fx:** people, effects sprites
  - **post:** line pass, lens blur, bloom, composer order
  - **sound:** timeline, SFX, music, mix
- Shared contracts (layer ids, DOF table, light presets) live in exported constants; changing one means telling
  every owner who reads it.
- Merge owned files back one by one (back up main first), type-check, then re-sync every sandbox from main before the
  next round.

## 9. Sound (upgrades)
- **Room-tone foundation per world** (shaft hum, machine room, hall air, city night) under everything.
- **Stacked hits on every big moment:** a low thump + a mid impact + a high transient + a short tail, all on the exact
  frame (e.g. the clunk on the frame the wedges bite).
- **Reverb that follows the camera:** bigger/wetter in large spaces and wide shots, drier in close-ups.
- **Ducking keyed to `words.json`** (not to the audio waveform), music dips ~3 dB while words are spoken; keep quiet
  sentence-final words on top with small extra dips.
- **Lock picture timing before making the sound.** Any later timing change means rebuilding the sound timeline.
- Master: −14 to −15 LUFS integrated, true peak ≤ −1 dBTP via a look-ahead limiter, exact video length, 48 kHz.
- Write `cues.md`: every SFX event with its frame, and the music map. Cache rendered stems so a crash never costs a
  full re-render.

## 10. Stack upgrade path (cloud, no GPU)
- Target stack: **three.js + Remotion (@remotion/three) + postprocessing** (line pass, lens blur, bloom, tone map)
  rendered headless in Chrome. This gives proper materials, GLB assets, depth of field and outlines that our raw-WebGL
  engine can't do easily. Keep the raw-WebGL engine as a fallback.
- **Composer order:** line pass → lens blur → bloom → tone map → grade, with MSAA 4.
- Needs a Claude Code cloud environment with network access to npm, GitHub and Poly Haven, plus a setup script that
  installs Remotion and dependencies (the environment snapshot is reused by later sessions if setup finishes in
  ~5 minutes).
- Set the temp folder to a large disk: Remotion bundles copy `public/` into temp on every render and never clean up.
- Remotion writes a silent audio track: mux with `-map 0:v:0 -map 1:a:0`.
- Optional: render final at 1440×2560 (`--scale 1.3333`) for a crisper upload; stills for checks at 0.5 scale.
- Blender (Cycles on CPU, `blender -b`) is an option for realistic hero shots, but test render times first; cut time by
  rendering at 1080 and upscaling, and profile per-frame costs before optimising.

## 11. Readability traps (check every shot)
- An object that disappears behind a person or part can read as something else; check silhouettes.
- Props closer than ~2 m to the lens become giant cut-off blobs.
- A cut-off foreground shape must still be recognisable, or remove it.
- Signs/labels lit from the side go grey and unreadable: use unlit materials for text faces.
- Rim light as an outer offset copy looks like a picture frame: use an inner rim only.
- Flat holds read as freezes: every hold creeps.
- Never put a sound effect on top of a spoken word.
