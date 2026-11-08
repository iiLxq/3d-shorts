# Tutorial study: two "Claude makes 3D Shorts" workflows

Private study notes. Sources (git-ignored, never publish):
- **T1** = "How to Make Ultra-Realistic 3D Animated Shorts Using Claude (Full Workflow)", transcript in
  `references/external/transcripts/*Ultra-Realistic*`. Blender/Cycles, realistic scanned humans, reverse-engineers a
  large realistic-anatomy Shorts channel.
- **T2** = "How to Make Viral Animated Shorts Using Claude (Full Workflow)", transcript in
  `references/external/transcripts/*Viral_Animated*`. 2D cartoon characters in a 3D world, three.js + Remotion.
  The creator's public repo (`references/external/claude-animated-shorts/SKILL.md`) states some fixes the video only
  shows; those are marked **[repo]**.

Timestamps are `m:ss` in each video. Transcripts are YouTube auto-captions: numbers marked **(caption?)** look garbled
and must not be used as targets until re-measured. Methods and numbers only; no characters, scripts, shots or frames
are to be reused (see §4).

---

## 1. Techniques, problems, fixes, and why they work

### 1A. T1: realistic Blender shorts

#### Reference analysis (measure the reference at full frame rate)
| t | Technique / finding | Why it matters |
|---|---|---|
| 0:55–1:13 | Claude analysed the two biggest reference shorts **every frame at 30 fps** ("full temporal resolution"). | Sampling a few frames misses micro-animation, creep and cadence; the "premium" feel lives in sub-second detail. |
| 1:13–1:21 | Finding: **"the camera is the whole trick."** A 31 s short is **one continuous shot, zero cuts**; it **dollies in to explain, pulls back out to resolve**. | Camera distance carries the story structure: closer = detail/tension/explanation, wider = context/release. No cut = no re-orientation cost for the eye, so attention never resets (retention). |
| 1:21–1:39 | **Phase correlation**: each frame to frequency domain; the cross-power spectrum peak gives the shift, (log-polar variant) gives zoom. Result: **zero lateral motion, no pan**; only a straight dolly, a hold where the subject keeps moving, a slow creep, an eased pull-out. | Turns "the camera feels smooth" into numbers (px/frame translation, %/frame zoom). Pure dolly on one axis keeps the subject's screen position stable, so the eye never has to re-acquire it. |
| 1:49–1:57 | Micro-detail at 30 fps: **a new stitch lands every 6–8 frames**; the thread **animates along its own path** (draws itself). | A steady micro-event cadence (~4–5 events/s) keeps the frame alive even when the camera holds. Path-reveal animation shows *process*, which reads as explanation. |
| 1:57–2:16 | Day 1: **50 most-viewed shorts, 26 min, ~47k frames** ("47,79" caption?), every frame pair measured: **luminance, contrast, saturation, exact RGB of the signature background, loudness of every mix**. | A corpus gives distributions (medians, percentiles), not one example's quirks. |
| 2:16–2:26 | Script formula: **16 of 50 open with the same second-person hypothetical ("If you…")**; **median 2.77 words/s**, "way calmer" than cartoon shorts. | Second-person puts the viewer inside the scenario in sentence 1. Calm pace fits realism; realistic visuals need time to be read. |
| 2:26–2:32 | Transitions: **only ~1 in 7 is a hard cut**; the rest are **motion transitions: whip pans, zooms where the camera flies straight into the next scene**. | Motion carries the eye across the change of subject (continuity of motion vector), so the cut is felt as travel, not interruption. |
| 2:32–2:44 | **Tip: run your own render through the exact same pipeline. The delta between the two data sets is your to-do list.** | Same tool both sides cancels the tool's own biases; the fix list becomes objective and prioritisable. |

#### 9-second test, camera
| t | Problem | Fix | Why |
|---|---|---|---|
| 2:44–2:53 | First test camera had **8× more jerk** than the reference (jerk = rate of change of acceleration, d³x/dt³). | — | High jerk is what the eye reads as "robotic/cheap" motion: real dollies have mass, so acceleration ramps. |
| 2:53–3:11 | Cause: our camera **drifted in a little orbit**; the reference never does. | **Lock every move to a single dolly axis, ease every move**, re-measure: **jerk dropped by almost half, sideways drift basically gone.** | Orbit adds a rotating lateral component = continuous parallax + changing velocity direction = jerk in 2 axes. Note: halving 8× still leaves ~4×: they did not claim parity. Keep measuring until the number is at target. |

#### Characters (realistic)
| t | Problem | Fix | Why |
|---|---|---|---|
| 3:13–3:29 | Real 3D-scanned human looked great but wore long pants; stitches need bare skin. "Can't we take the pants off?" No: **a scan is one solid surface; there is no leg under the pants.** | Switched to another scan ("Nathan"), **already rigged with a walk cycle**; moved the stitches to the bare forearm. | Photogrammetry captures only the outer visible surface. Choose assets for the shot's needs (exposed area, rig) before building. |
| 3:39–3:43 | Blender's **default view transform muted the signature blue**. | Swapped the view transform (later revised, see 8:39). | Filmic/AgX-type transforms desaturate and hue-shift very saturated colours (esp. blue → cyan/grey) as they approach the shoulder. |
| 3:43–3:49 | — | Grew **2,600 real 3D hairs** around the cut. | Fine high-frequency detail at macro scale = scale cue and "real skin" cue. |
| 3:49–4:04 | **Bright strip inside the wound.** Wound mesh floated **0.25 mm above the skin**, but at render time Blender **triangulated the skin quads along the opposite diagonal**, so the skin poked through. | **Rebuilt the wound from the exact triangles the renderer sees and bound it to the skin so it deforms with every step.** | Non-planar quads have two possible triangulations; an offset decal must follow the *rendered* surface, and must be skinned/deformed with it or it separates during animation. |
| 4:04–4:13 | Wound was **flat red** up close. Searched **all 869 Poly Haven textures: zero flesh.** | Used a **scanned sponge** texture inside the wound. | Real scanned micro-structure (pores, cavities) reads as organic; flat albedo reads as CG. Substitute materials from other real scans when the exact one does not exist. |
| 4:13–4:22 | QA: **a separate Claude agent judged the stills after every fix: 7/10 → 7.5 → 8.5 → "ready to render"**. | — | Builder bias: the agent that built a frame grades it generously; a fresh judge has no sunk cost. Stills are cheap; a render is not. |
| 5:13–5:26 | Scanned character had to look **surprised**; a scan's facial rig is "basically a jaw and a few bones", so the expression was stiff. "A scan isn't built for acting." | Tried Epic MetaHuman: **dead end** (add-on needs an account + personal access token; Claude can't create accounts; public code lacks the compiled rig-logic library). | Agent pipelines need account-free, fully open toolchains; check this before investing. |
| 5:53–6:10 | — | Open-source **character system inside Blender** from the official extension site (checksum verified, no account); **new character in 15 min with 52 blend shapes = the iPhone face-capture (ARKit) set**: brows up, eyes wide, jaw drop → real surprise. | Facial acting needs blend shapes (FACS-style per-muscle shapes), not bones. The 52-shape ARKit set is a de-facto standard that free tools can drive. (Likely MPFB/MakeHuman; verify name and licence before use.) |
| 6:10–6:18 | New character looked like **a video-game character: waxy skin, heavy lips, bowl cut**; T-shirt had **someone else's logo**. | Logo replaced with their own text; skin fixed later (8:57). | Never ship third-party marks. "Game look" = too-smooth shading + default proportions. |
| 6:18–6:27 | **Eyes, teeth, hair, T-shirt floated off the body** when animated. | **Attached them to the armature** (one fix). | Every sub-mesh must be parented/skinned to the same armature, or it stays at rest pose while the body moves. |
| 6:27–6:43 | — | Claude **wrote its own vessel generator**: branching growth inside the body; **bright red arteries from the heart, darker veins returning; denser near the skin so the silhouette still reads**. | Procedural is right when the thing is a *pattern* (branching) rather than an object. Colour carries meaning (arterial vs venous). Density tuned for **silhouette readability**, not anatomical truth: design for the camera. |

#### World building
| t | Problem | Fix | Why |
|---|---|---|---|
| 6:43–6:58 | Stadium opening: **real 3D grass rendered almost black**, "like a dark wall". | Used a **real stadium photo** as the backplate; the 3D field became **invisible and only catches shadows** (shadow catcher). Grass, mowing stripes all from the photo. | Dense blade geometry self-occludes; light can't reach between blades without many bounces, so it goes dark. A photo already contains correct GI; a shadow catcher grounds 3D objects in it (contact shadows are the strongest "resting on a surface" cue). |
| 7:00–7:20 | Top-down shot: Claude **built a whole stadium from scratch** (tiered stands, flood-light towers, parking lot of cars). User: **"that looks like AI slop."** Claude re-checked the reference: its top-down shot **has no stadium at all, just the field floating in light blue**. | Copied the *idea* of simplification: field only, **markings from a real field diagram**. | More generated stuff ≠ better. Generic invented detail has no real-world structure; the eye detects it. Simplify to what the story needs and make that part true. |
| 7:20–7:26 | **The rule: "If a real one exists, download it. Never build it by hand."** | Bones = real scans from a **public anatomy database (Japan)**; city = **440 buildings assembled from a real scanned facade kit** (walls, windows, shop fronts, roof edges). | Real assets carry real proportions, wear and irregularity that a model can't invent convincingly. |
| 7:41–7:54 | First clouds were **fake solid blobs**: deleted. "Where's the cloud?" | Built **34 volumetric clouds**: light scatters through them, they **cast real shadows on the ocean**. | Clouds are participating media; a solid surface can't show translucency, soft edges or inner scattering. Cast shadows tie them into the world. |
| 7:54–8:08 | — | **Earth = sphere with NASA satellite imagery**: surface, clouds, **city lights on the night side**, **thin atmosphere fading with altitude** "like photos from orbit". | Public-domain real imagery + a rim atmosphere (Rayleigh scattering read) match the viewer's memory of orbital photos. |

#### "Too perfect" pass (realism)
| t | Problem | Fix | Why |
|---|---|---|---|
| 8:08–8:30 | Every piece real, **together still not real enough**. Claude downloaded **21 tutorials; 4 agents** read every transcript and stepped through key moments frame by frame; **all pointed to one problem: renders too perfect.** | Added what real cameras add: **softer lens, glow around bright spots (bloom), vignette, film grain, motion blur on every fast move.** | The eye learned "real" from photographs, which always carry optical artefacts: veiling glare/halation (bloom), cos⁴ falloff (vignette), sensor/film noise (grain, also breaks up banding), shutter integration (motion blur; without it fast motion strobes). Their absence reads as CG. |
| 8:39–8:47 | The swapped view transform (3:39) is the one **every tutorial says never to use: it clips the highlights.** | Found a transform that **keeps the blue and stops bright spots burning out to flat white.** | A display transform needs a highlight shoulder; hard clipping turns highlight texture into flat white patches (instant "CG"). Requirement = saturated hues preserved **and** soft shoulder (e.g. Khronos PBR Neutral-type mapping). |
| 8:47–8:57 | City: — | **Low sun, long shadows, ~1,300 trees, cars, AC units on rooftops.** | Low sun = long shadows that reveal form and depth (raking light). Small repeated real-world clutter = scale cues. |
| 8:57–9:05 | Waxy skin. | **Matte skin, real pores, subsurface scattering** (light glows through). | Skin is translucent; SSS softens the terminator and adds red bleed. Specular sheen without pores = wax/plastic. |
| 9:05–9:13 | **Teeth looked green.** Claude tinted them ivory → **whole mouth turned beige**. Root cause: **green grass light bouncing up from the field**. | **"The fix was deleting the fix"**: removed the tint. | Global illumination bleeds environment colour (physically correct). Patching a symptom adds a second error. Diagnose root cause; revert patches that fought physics. |

#### Sound
| t | Technique | Why |
|---|---|---|
| 4:22–4:32 | Reference mix measured at **"minus5 LUFS" (caption?) with almost no dynamic range.** | Very low loudness range = dense, constant-energy mix that stays loud on phone speakers; re-measure the real value. |
| 4:28–4:41 | Ours: **room-tone foundation**, **stacked hits on every big moment**, **reverb that follows the camera**; **19 audio tracks for 9 s.** | Room tone: true digital silence sounds broken/empty; a continuous bed defines the space. Stacking low/mid/high layers fills the spectrum = perceived weight + crisp timing transient. Reverb tracking camera distance = auditory perspective matches visual perspective (wide = wetter). |
| 4:38–4:46 | User said the stitch sound was too loud → **Claude measured it and dropped it ~11 LU.** | Complaints become measured deltas, not guesses. |
| 9:13–9:22 | **A background (ambience) for every world**, "from stadium air to a deep drone in space". | Each place has an acoustic signature; changing it sells the cut/transition. |
| 9:22–9:27 | **Every effect lands on the exact frame**, e.g. a **bone knock right on the word "bones"**. | Audio-visual sync on the frame binds sound and image (ventriloquism effect). NOTE: conflicts with our "no SFX on a spoken word" rule (§5). |
| 9:27–9:31 | **Mix rule now: music up 3 dB, effects at half.** | Relative to their earlier mix. "Half" is ambiguous (−6 dB amplitude or −10 dB perceived). Lesson: effects were too loud, music too quiet, relative to voice. |

#### Facts
- 5:02–5:17: same topic as the reference, **own words**, fact-checked: the famous 100,000 km figure has a shaky origin, so the script says **"Scientists estimate"**. Hedge exactly where the source is weak.

#### Render optimisation (Blender)
| t | Step | Result | Why |
|---|---|---|---|
| 0:18, 9:31 | Start | **11 h** (intro says 8 h; T2 says 7.5 h: inconsistent) | — |
| 9:33–9:41 | Studied speed tutorials, **kept only changes that looked identical** | ×1.5 ("3,000× faster" promised) → **still almost 8 h** | Every speed change is A/B-checked for visual identity; ignore hype. |
| 9:41–9:51 | **Render at 1080, upscale to 2K**; "on a phone, no visible difference" | **3.5 h** | Phone screens and YouTube re-encode can't show the difference; pixel cost scales ~linearly. |
| 9:51–9:59 | **Put a stopwatch inside the render** (profile where every second goes) | Found two big costs | Measure, don't guess the bottleneck. |
| 9:59–10:08 | **Haze counted as a light source** → every building, tree and car **rebuilt into a light list every frame** | City frames **19 s → 8 s** | Per-frame scene-structure rebuilds scale with object count; a "light" that isn't one multiplies them. |
| 10:08–10:14 | Clouds stuck in **Blender's new volume mode, which ignored the speed setting** | **40 s → 14 s** per frame | A mode silently overriding a quality setting; verify settings actually take effect by timing. |
| 10:14–10:21 | Smaller switches + **two Blender instances at once** | **61 min total**; "under 50 min not without losing quality" → stopped | A single render doesn't saturate the machine; parallel instances fill idle cores. Stop optimising when the next step costs quality. |

#### Skill packaging
- 10:33–10:52: the whole method saved as one Claude skill; **one short prompt, 13 user messages, 7 pm → 2 am** unattended. 11:21 a clay (no-material) version exists: good check of form/lighting independent of texture.

### 1B. T2: 2D characters in a 3D three.js world

#### Reference analysis
| t | Technique / finding | Why |
|---|---|---|
| 0:41–0:51 | Downloaded the creator's **last 20 shorts** in the target look. | Recent + consistent sample = current style, not old experiments. |
| 0:51–1:14 | "If you just tell Claude to analyse a video it grabs a few frames"; insisted on **every frame at 30 fps**: lighting, contrast, shadows, movement, effects, cuts. **20 shorts, ~18 min, >32,000 frames** → a rule book. | "Most copies look trash" because of **micro animations, a little camera move, a little shading, a little light**, all invisible at low sampling. |
| 1:46–1:55 | YouTube first returned the **German dub** audio. | Pulled the **original English track**, transcribed all 20 itself. Lesson: verify language/track before analysis. |
| 1:55–2:11 | Script: every one opens with **a paradox in the very first sentence**; no intro, no setup. | Cognitive dissonance = open loop; viewer stays to resolve it. |
| 2:11–2:21 | Structure: **paradox → escalation → pivot (real reason) → payoff → one last line where the twist lands.** | Classic setup/escalation/reveal; final line gives a reward + loop/share moment. |
| 2:21–2:32 | **14 of 20 pivot into the explanation with the same two words.** | A fixed verbal signpost = channel signature + tells the viewer "answer coming". (We already have our own: "Here's what saves you.") |
| 2:32–2:40 | Delivery **almost 4 words/s, basically zero dead air.** | Story-cartoon pace. Compare T1 realistic: 2.77 w/s. Pace is genre-dependent. |
| 2:37–2:49 | Visuals: **characters flat 2D but lit like they exist in the world: they catch the key light and cast real shadows.** World = **real 3D geometry traced with black ink outlines.** | Shared light direction + cast/contact shadows = "same world" (perceptual integration). Ink on both 2D and 3D unifies two render styles into one graphic language. |
| 2:51–3:03 | **Heavily saturated; warm highlights, cool blue shadows; lighting follows the story: warm/bright for setup, deep night blue as the explanation begins.** | Warm key + cool sky-fill is how daylight works (sun vs skylight); complementary contrast increases perceived depth and saturation. Light change marks act change without a title card. |
| 3:03–3:10 | **Camera almost never cuts: 12 of 20 have one hard cut or none.** The camera **physically travels into the next moment.** | Continuous space = orientation is never lost; travel itself is motion that holds attention. |
| 3:10–3:37 | Own measuring tool: **one contact sheet per 2 s = 60 frames on one image; 549 sheets**; camera tracked with **phase correlation**; **every hard cut flagged**; **brightness, contrast, saturation of every short**. First finding: **~80 % of frames almost perfectly still, tiny drifts.** (Later proven WRONG, see 9:33.) | Contact sheets let a model see motion/cadence in one image; numbers make the look reproducible. |
| 3:39–3:47 | **Tip: "Don't ask Claude what it thinks of a video. Make it measure. You can't recreate an opinion. You can recreate a number."** | Opinions are not actionable or verifiable; a number has a direction and a done-state. |

#### Story
| t | Item | Why |
|---|---|---|
| 3:56–4:15 | First topic was **already covered by one of the 20 reference shorts (5.7 M views)** → thrown out; picked a story the channel had never told. | Check topics against the competitor corpus; duplicates lose on comparison. |
| 4:15–4:36 | **Every fact checked before writing** (date, number of people, even river depth). The river-depth detail became **the best joke** (a two-line "luckily/unluckily" reversal). | Research produces specific, surprising, true details; jokes built on true facts feel earned. |
| 4:39–4:48 | Script written **with the exact formula** from the 20: paradox in line 1, build, pivot, twist. | Formula from measurement, content original. |

#### Build
| t | Problem | Fix | Why |
|---|---|---|---|
| 4:56–5:15 | First a **5 s look test** (Blender): own character, free 3D buildings, flat cartoon clouds, **camera timing matched from the reference frames**. | — | Cheap look test before production. |
| 5:13–5:17 | **On the third camera push the camera flew right past the character.** | Not stated. (Implication: pushes defined in absolute distance accumulate; define moves relative to the subject with a minimum-distance clamp and check with stills.) | Accumulated relative moves overshoot. |
| 5:23–5:40 | Tested ink lines in Blender, drew the whole cast in code; then **hunch: the reference is made with three.js** ("3D built with code in the browser"); frames confirmed flat characters in a real 3D world, **three.js can do exactly that**. | **Moved everything to three.js; Remotion renders frame by frame.** | Pick the engine that natively matches the look: camera-facing cards + real-time post effects are trivial in three.js. |
| 5:40–6:00 | **37 free 3D models** (trees, rocks, flowers, stalls, cart, windmill); **every texture painted by code** (grass, cobblestones, roofs, water). | — | Free kit geometry + procedural paint = consistent hand-made look without paid assets. |
| 6:00–6:04 | Characters got **14 different faces** (laughing, whistling, nervous, shocked…). | — | An expression library lets acting change on the beat; 14 covers a whole short. |
| 6:04–6:15 | Hero mechanism: bridge (two towers, chains, **deck 5 m wide**, **74 soldiers, 4 abreast**). **Every step makes it bounce, the bounce keeps growing until it snaps.** | — | Escalation shown physically: amplitude growth = visible resonance = rising tension before the break. |
| 6:15–6:23 | Ink: Claude **wrote its own effect**: finds edges in the 3D world, draws black lines. | — | Edge detection on depth/normals = graphic look on real geometry. |
| 6:23–6:26 | **~1 h after the switch, all 15 shots worked; "2,25" frames (caption?).** | — | three.js iteration speed. |
| 6:26–6:36 | **Checked still frames before rendering any video.** Found: **camera stuck inside a house in 3 shots, trees teal, a chain in front of everyone's faces.** | [repo] **Sight-line culling** (remove anything blocking a camera's view ray to its target); **recolour kit materials by material name** (Kenney nature kit is teal); re-check foreground props. | Stills are 100× cheaper than video; most framing bugs are visible in one frame. |

#### Look gap: "ours looks cheap"
| t | Gap measured (ref vs ours) | Why it matters |
|---|---|---|
| 6:36–6:58 | User put one frame next to the original: original **colourful, high contrast, premium**; ours **dull**. "Analyse frame by frame, take your time, use 10 agents." | Side-by-side comparison exposes what single-frame review hides. |
| 7:00–7:07 | **Ink lines on the whole world** vs almost none. | Lines segment shapes for fast reading on a tiny screen. |
| 7:07–7:14 | **Bold colours, long blue shadows, deep darks** vs **pastel and flat**. | Contrast range + saturated mids = "premium"; pastel = low chroma and compressed tonal range. |
| 7:14–7:19 | **Hand-painted wood and stone: visible grain and dark gaps between planks** vs plain. | High-frequency texture + dark crevices (AO) = material identity and scale. Flat fill = placeholder. |
| 7:19–7:23 | **Blurry backgrounds, eye goes straight to the character** vs mostly sharp. | DOF = attention guidance + depth cue. |
| 7:23–7:31 | Characters: (thought) egg heads + thin limbs vs our perfect circles + chunky bodies → **"looked like clip art pasted on top."** | Integration failure: proportions/weight/style mismatch with the world reads as a sticker. |

#### Multi-agent rebuild
| t | Method | Why |
|---|---|---|
| 7:35–8:01 | Asked for 10, Claude used **12**: **7 gap-study agents, one per discipline** (colour, ink lines, light & shadows, textures, characters, depth & framing, motion = camera + characters), each putting **original frames next to ours and measuring the difference: "no guessing, real numbers"**; **1 sound agent.** | Narrow scope per agent = deeper measurement; per-discipline deltas map to owners. |
| 8:01–8:09 | **4 rebuild agents**: camera, world, characters, final look. | Rebuild split mirrors file ownership. |
| 8:09–8:29 | Problem: **4 agents on one project break each other's work.** Fix: **each agent gets its own copy of the project and owns its own files; nobody else may touch them; Claude merges back file by file.** **Tip: "don't just split the jobs, split the files."** | Prevents write conflicts and silent overwrites; merge is deterministic. |
| 8:29–8:33 | **10-hour budget** to learn the style and finish. | Time-boxed. |

#### What the 7 agents found (8:33–9:38)
| t | Finding | Fix | Why |
|---|---|---|---|
| 8:38–8:48 | **Ink on ~3/4 of edges in the original; zero on ours.** The ink effect existed but **the blur effect ran in the same step and wiped it out.** | [repo] Ink as **its own pass before the blur** (composer order ink → lens blur → bloom → tone map → grade). | Effect-merging in a single post pass made the blur sample the un-inked buffer. Post order is a correctness issue, not taste. |
| 8:48–8:53 | **The blur itself was so weak you couldn't see it anywhere.** | [repo] blur radius set per shot type in px at 1080 (close-ups strongest, wides 0). | An effect below the visibility threshold costs render time for nothing; measure effect strength in output pixels. |
| 8:53–9:01 | Camera: ours **snapped from one spot to the next in 3 frames**; the original **glides over ~23 frames, slow in, slow out.** | [repo] smootherstep glides 18–40 f. | 3 frames is faster than smooth-pursuit eye tracking: reads as a jump/glitch. Ease in/out = implied camera mass, low jerk. |
| 9:01–9:04 | **Original has no pure black anywhere; ours went almost black.** | Lift and colour the black point. | Real optics and atmosphere always add some light (flare, scatter); crushed black reads digital and bands/blocks after YouTube compression. |
| 9:04–9:08 | **Sunset shadows purple (original) vs brown (ours).** | Cool/violet shadow fill. | At sunset the shade is lit by blue/violet sky while the key is orange; brown = darkened key colour = muddy. Complementary warm/cool contrast = depth. |
| 9:08–9:13 | **Bodies 3.5 heads tall vs ours under 3; our arms and legs 5× too thick.** | Re-proportioned. | Proportions are measurable in head units; limb thickness sets the "weight" and style family. |
| 9:13–9:27 | **Our own notes were wrong**: the "egg-shaped heads" — agent **measured 38 heads: theirs are rounder; ours were the egg-shaped ones.** | Corrected. | Visual impressions (even our own analysis notes) are unreliable; only measurement settles it. |
| 9:27–9:38 | **The measuring tool was wrong**: "80 % still" — actually **the camera moves in 65 % of frames, slowly pushing in; the tool couldn't see moves that slow.** | Better tool (sub-pixel). | Integer-pixel phase correlation quantises motion < 1 px/f to zero; a slow push-in of ~0.2 %/f moves the image centre 0 px and the edges < 1 px. **Every measuring tool has blind spots: validate it on a synthetic move of known speed.** |

#### Distribution
- 9:53–10:12: rules + fixes packaged as one free skill with **5,000 reference images**. 11:45: "with this workflow you can clone any style" (we use it to build our own, not clone).

---

## 2. Numeric standards mentioned (candidate QA targets)

"Target" column = what we should do with it. ✱ = defines *their* look; use only as a calibration point, not as our target.

| Value | Measures | Source | Use for us |
|---|---|---|---|
| 30 fps, every frame | analysis temporal resolution | T1 1:13, T2 1:14 | Always analyse at native fps; never sample. |
| 31 s, 0 cuts | longest single continuous shot | T1 1:18 | Long takes are viable; hard cuts are optional. |
| 0 px lateral | camera pan/lateral drift in ref | T1 1:39 | Target: lateral drift ≈ 0 during dolly moves. |
| 6–8 frames | interval between micro-events (stitches) | T1 1:52 | Target: a visible micro-event every ≤ 8 f in mechanism close-ups. |
| 50 shorts / 26 min / ~47k frames (caption?) | corpus size T1 | T1 1:57 | Corpus ≥ 20 shorts. |
| 16 / 50 | openings with same 2nd-person hypothetical | T1 2:16 | Not a target (✱ their hook). |
| **2.77 words/s** | median VO rate, realistic 3D explainer | T1 2:25 | Lower bound for our pace. |
| **~1 in 7** | share of transitions that are hard cuts | T1 2:32 | Target: ≤ 15 % of transitions are hard cuts. |
| 9 s | first test clip length | T1 2:50 | Always a ≤ 10 s look test first. |
| **8×** | our jerk vs ref (before fix) | T1 2:53 | Metric: camera jerk ratio ours/ref; target ≤ 1.5×. |
| ~0.5× | jerk after single-axis + easing | T1 3:08 | Re-measure after each camera fix. |
| 2,600 | hair strands around wound | T1 3:47 | ✱ |
| 0.25 mm | wound offset above skin (failed) | T1 3:53 | Decal offsets must follow rendered triangles. |
| 869 / 0 | Poly Haven textures / flesh ones | T1 4:11 | Search CC0 libraries first; substitute. |
| **7 → 7.5 → 8.5 /10** | judge-agent still scores to "ready" | T1 4:20 | Gate: judge ≥ 8.5 overall (and ≥ 7 per area) before full render. |
| −5 LUFS (caption?) | ref integrated loudness, "almost no dynamic range" | T1 4:30 | Re-measure; low LRA is the takeaway. |
| **19 tracks / 9 s** | audio layer density | T1 4:38 | ~2 tracks/s in busy sections. |
| **−11 LU** | correction to a too-loud SFX | T1 4:41 | Fix by measured LU deltas. |
| 100,000 km "scientists estimate" | hedged fact | T1 5:07 | Hedge weak-source numbers. |
| 15 min | build time of an open-source rigged human | T1 6:00 | — |
| **52** | facial blend shapes (ARKit set) | T1 6:02 | Any face that acts needs blend shapes (ARKit-52 compatible). |
| 440 | buildings from scanned facade kit | T1 7:36 | ✱ |
| 34 | volumetric clouds | T1 7:52 | ✱ |
| 2.5 | wraps of the line around Earth | T1 8:08 | ✱ |
| 21 tutorials / 4 agents | realism research | T1 8:17 | — |
| ~1,300 | trees in city | T1 8:55 | Instancing scale needed. |
| **+3 dB music, effects ×½** | revised mix rule | T1 9:27 | Relative change; translate to our ratios by measurement. |
| 11 h → ×1.5 → ~8 h → 3.5 h → 61 min | render time steps | T1 9:31–10:19 | Profile → fix top 2 costs → parallelise. |
| 1080 → 2K upscale | render res vs delivery | T1 9:43 | Render heavy passes at reduced res, upscale. |
| **19 s → 8 s / frame** | light-list rebuild bug | T1 10:05 | Per-frame scene rebuilds are a top suspect. |
| **40 s → 14 s / frame** | volume mode ignoring speed setting | T1 10:12 | Verify settings by timing. |
| 2 instances | parallel renders | T1 10:17 | Test `--concurrency`. |
| 13 messages, 7 h | unattended skill run | T1 10:46 | — |
| 20 shorts / 18 min / >32,000 frames | corpus T2 | T2 1:28 | Corpus size. |
| **60 frames = 2 s per contact sheet; 549 sheets** | sheet format | T2 3:18 | Our sheets: 60 f, 10×6, frame numbers (already in short_qa.py). |
| 14 / 20 | pivot with same two words | T2 2:27 | Fixed pivot line (ours exists). |
| **~4 words/s, ~0 dead air** | VO rate, story cartoon | T2 2:32 | Upper bound for our pace. |
| **12 / 20** | shorts with ≤ 1 hard cut | T2 3:06 | Target: ≤ 2 hard cuts per short (excl. signature flashes). |
| 80 % (wrong) → **65 %** | frames with camera moving | T2 3:37, 9:35 | Target: camera moving in ≥ 60 % of frames; hold frames still creep. |
| 5.7 M | views of duplicate-topic short | T2 4:10 | Dedupe topics vs corpus. |
| 2 ft | the fact that became the joke | T2 4:33 | — |
| 37 | free 3D models used | T2 5:50 | ✱ |
| **14** | facial expressions per character | T2 6:00 | Expression library size for a ~60 s short. |
| 5 m / 74 / 4 abreast | bridge deck / cast / rows | T2 6:08 | ✱ |
| 15 shots, "2,25" frames (caption?) | shot count / length | T2 6:26 | ~15 camera segments per 60 s. |
| 10 asked → 12 agents (7 gap + 1 sound + 4 rebuild) | team size | T2 7:37 | One-off identity rebuild only. |
| 10 h | build budget | T2 8:31 | — |
| **~75 % (3 of 4)** | edges carrying ink in ref (ours 0 %) | T2 8:39 | ✱ value; metric "edge coverage %" is reusable for our line passes. |
| **23 frames vs 3** | camera transition glide duration (ref vs ours) | T2 8:56 | Target: no camera move shorter than 18 f (except impact kicks). |
| 0 pure-black pixels | black point in ref | T2 9:03 | Target: non-line p1 luma > 0 (lifted), no clipped blacks. |
| purple vs brown | sunset shadow hue | T2 9:06 | Target: shadow Lab hue cool (b* < 0) in lit scenes. |
| **3.5 heads vs < 3** | body height in head units | T2 9:12 | ✱ value; metric reusable for our "person at risk". |
| **5×** | our limb thickness vs ref (too thick) | T2 9:13 | Measure limb width / head width. |
| 38 | heads measured to settle shape | T2 9:23 | Measure n ≥ 30 before concluding. |
| 5,000 | reference images in their skill | T2 10:10 | — |
| 7.5 h → 1 h | render (T2 teaser) | T2 11:31 | Inconsistent with T1 (8 h, 11 h). |

---

## 3. Transferable principles (style-independent)

1. **Measure, don't opine; same tool on both sides.** The per-metric delta between reference and our render is the backlog; a fix is done only when its number moves. *Why:* an opinion can't be reproduced or verified; a number has direction and a stop condition. (T1 2:40, T2 3:39)
2. **Analyse every frame at native fps.** *Why:* "premium" lives in micro-motion (creep, cadence of small events, light shifts) that frame sampling never sees. (T1 1:13, T2 0:51)
3. **Validate the measuring tool on a synthetic move of known speed.** *Why:* integer phase correlation reported 80 % still when 65 % was moving; a blind spot silently becomes a wrong rule. (T2 9:27)
4. **Measure your own notes too.** *Why:* the "egg heads" impression was backwards; perception is unreliable even when confident. (T2 9:13)
5. **The camera is the storyteller: dolly in to explain, out to resolve, one axis, eased, no orbit drift.** *Why:* distance encodes tension/detail vs context; a single axis keeps the subject anchored for the eye; easing lowers jerk = implied physical mass. (T1 1:21, 2:53)
6. **Prefer motion transitions over hard cuts; travel into the next moment.** *Why:* continuity of motion carries attention across the change; each hard cut forces re-orientation. (T1 2:32, T2 3:03)
7. **No snaps: glide ≥ ~18 f with slow in/out.** *Why:* moves faster than smooth-pursuit read as glitches. (T2 8:53)
8. **"Too perfect" is the CG tell: add the optics of a real camera** (soft lens/bloom on brights, vignette, motion blur on fast moves, a highlight shoulder), subtly. *Why:* viewers learned "real" from photographs. (T1 8:27)
9. **Never clip highlights or crush blacks; keep saturated hues through the tone map.** *Why:* clipped white and crushed black lose texture and band after compression; pure black never occurs through real optics. (T1 8:39, T2 9:01)
10. **Warm key, cool shadows; lighting changes with the story beat.** *Why:* mimics sun + skylight, complementary contrast reads as depth; light change marks act changes without text. (T2 2:51, 9:04)
11. **Ground everything: shared key light + cast/contact shadows for every element that "exists" in the scene.** *Why:* contact shadows are the strongest cue that an object sits in a space; without them it's a sticker ("clip art pasted on top"). (T2 2:37, 7:31; T1 6:58 shadow catcher)
12. **Real beats invented: if a real asset/scan/photo/diagram exists, download it; simplify instead of filling with generated detail.** *Why:* real data has true proportions and irregularity; generic invented clutter reads as "AI slop". (T1 7:00–7:26)
13. **Surfaces need texture and dark seams.** *Why:* high-frequency detail + crevice darkening give material identity and scale; flat fills read as placeholders. (T2 7:14, T1 4:04)
14. **Diagnose root cause before patching; delete fixes that fought physics.** *Why:* the "green teeth" were correct bounce light; the tint added a second error. (T1 9:05)
15. **Post-effect order is correctness: lines → blur → bloom → tone map → grade, each its own pass; verify each effect is actually visible in the output.** *Why:* merged passes silently drop effects; an invisible effect is pure cost. (T2 8:38)
16. **Stills before video; a fresh judge agent scores them.** *Why:* framing bugs show in one frame; the builder is biased. (T1 4:13, T2 6:26)
17. **Sound: room tone per world, stacked layered hits, reverb that follows camera distance, frame-exact sync, fix loudness by measured LU.** *Why:* silence sounds broken; layered spectrum = weight; auditory perspective must match visual perspective. (T1 4:28, 9:13)
18. **Multi-agent: split by discipline for study, by files for building; private copies, merge file by file.** *Why:* parallel writers corrupt shared files; ownership makes merges deterministic. (T2 7:35–8:29)
19. **Profile before optimising; keep only speed changes that look identical; render heavy work at lower res and upscale; fill idle cores with parallel instances; stop when the next gain costs quality.** (T1 9:31–10:21)
20. **Research makes the jokes and protects the channel.** Verify every fact, hedge shaky numbers ("scientists estimate"), dedupe topics against the competitor corpus. (T1 5:02, T2 3:56, 4:15)

---

## 4. Do not copy (their identity, not ours)

From T1's reference channel / creator:
- The **realistic scanned-human anatomy look** (stitches, wounds, blood-vessel-through-the-body), its **signature light-blue background colour** and the "field floating in light blue" treatment.
- The **single continuous medical/anatomy shot** format as a whole and their topics (stitches, splinters, blood-vessel length) and their story beats/shots.
- The **"If you…" second-person hypothetical** as a fixed opener (16/50 of theirs). Our hook is a literal, slightly scary statement about a machine.
- Their characters (the scanned man, the "Mr. Omi"-type custom human), their T-shirt branding.
- Their mix character (if truly hyper-compressed ~−5 LUFS), their skill text.

From T2's reference channel / creator:
- **Flat 2D cartoon characters in a 3D world**, bean/egg heads, **stick limbs, 3.5-head proportions, ink-dot hands, plum character outlines, 14-face library**: none of this; our "person at risk" is amber and stays in our own visual language.
- **Black comic-book ink on the whole world** (~75 % edge coverage, near-black lines) and **hand-painted cartoon wood/stone towns**, saturated storybook palette, **purple sunset palette**, day-sky colours they measured.
- The **"You see?" pivot** and the **paradox-history-story** format, their stories (soldiers/bridge, time-slows-in-danger), and the **"Luckily… / Unluckily…" two-liner wording** (the generic idea "one true deadpan reversal" is fine; their exact phrasing is not; QUALITY_PLAYBOOK §2 quotes it as an example: replace with our own construction).
- March-style music, their character designs, their 5,000 reference frames, their colour constants from the repo.
- Rule: **adopt metrics, not values that define their look.** E.g. "edge coverage %" is a reusable metric; "75 % black ink" is their style. Our line work stays **glowing cyan blueprint lines** (BLUEPRINT), **Fresnel edges** (X-RAY) and **thin dark-but-not-black lines** (SOLID).

---

## 5. Implications for our stack (three.js r175 + Remotion 4.0.290 + postprocessing 6.37, swiftshader, 4 CPUs, no GPU; Blender 4.5 LTS is installed at `/usr/local/bin/blender`)

### 5.1 Feasible now in three.js + Remotion
| Lesson | How in our stack | Cost note |
|---|---|---|
| Single-axis eased dolly, ≥ 18 f glides, creep on holds, motion transitions | Camera = position along one axis + smootherstep; transitions as continuous camera paths, fly-throughs | Free. |
| Highlight shoulder + saturated hues | `THREE.NeutralToneMapping` (Khronos PBR Neutral) or `ToneMappingEffect` mode NEUTRAL/AGX in postprocessing; AgX desaturates blues (the T1 3:39 trap: test our cyan `#35D7FF` and safety-green through it) | Free. |
| Bloom on HDR emissives, vignette, soft lens | `BloomEffect` (threshold 1.0 on emissive cyan/green/red), `VignetteEffect` | Bloom is the heavy one on swiftshader (~5 s/f full-res + MSAA per CLAUDE.md): run at half res. |
| DOF on close-ups | `DepthOfFieldEffect`; radius in px scaled by height/1920 | Medium cost; skip on wides. |
| Edge/line pass (our cyan blueprint lines, dark solid lines) | Custom depth+normal Sobel pass, its **own pass before DOF/bloom** (T2 8:38 bug applies directly to our blueprint glow) | Medium. Measure edge coverage % per state. |
| Shadow catcher on photo backplates / HDRIs | `ShadowMaterial` ground + Poly Haven HDRI/backplate | Cheap; strong realism win for SOLID shots. |
| Grounding overlays | Any 3D-space label/element gets shadows or depth fade; HUD (meter, stamps) stays clearly HUD | — |
| Procedural texture with seams/grain | Canvas2D or shader-painted maps, AO in crevices | Cheap at runtime. |
| Real assets | GLB from Poly Haven/Kenney/NASA via `GLTFLoader` + `delayRender`; recolour by material name | Check licences: Japanese anatomy DB (BodyParts3D) is CC BY-SA, not CC0. |
| Blend-shape faces | three.js morph targets (ARKit-52 in GLB) | Feasible if we ever need a face. |
| Instancing (1,300 trees analog) | `InstancedMesh` | Required on CPU. |
| Motion blur | Not built into postprocessing 6.37. Options: (a) camera-motion blur by depth reprojection (static scenes, cheap, one pass); (b) N-subframe accumulation (correct, N× cost); use only on whip pans/fast moves | (b) is too slow beyond short ranges on swiftshader. |
| Measurement tools | numpy FFT phase correlation (no cv2/skimage installed: write sub-pixel peak fit ourselves), jerk from the integrated path (3rd difference, smoothed), luma/sat/contrast/black point; `short_qa.py` already does sheets/luma/sat/pops but **has no camera path, jerk, % moving or hard-cut count**: add them | Cheap. Validate on a synthetic 0.2 %/f push-in. |

### 5.2 Needs Blender (or is impractical on 4 CPUs)
- **Path-traced GI** (bounce colour, "green teeth"), **true SSS skin**, **volumetric clouds with shadows**, **2,600-strand hair**, physically correct motion blur/DOF: Blender Cycles. On 4 CPUs without GPU, 1080×1920 Cycles is roughly tens of seconds to minutes per frame → 1,800 frames = many hours to days. **Not for full videos.** EEVEE needs a GPU OpenGL context; untested here.
- **Practical hybrid:** use Blender headless (`blender -b`) to **bake** AO/GI lightmaps and textures onto GLBs, render **single hero backplates/HDRIs**, or render short hero ranges; three.js does everything animated. This gets "real light" at three.js runtime cost.
- Render-optimisation analogs for three.js: light count changes force shader recompiles; shadow-casting lights re-render maps every frame (`shadowMap.autoUpdate = false` for static scenes); React re-creating scene objects per frame (= T1 "light list rebuilt every frame"); raymarched fog/volumes that ignore quality settings (= T1 volume mode). **Instrument per-pass ms with a stopwatch before optimising.** Test Remotion `--concurrency` 1/2/4 (swiftshader already multithreads; T1's "two instances" may or may not help: measure).
- **Render low, upscale:** fine for heavy 3D/post passes, but our **thin cyan line art and text/meter overlays are what upscaling damages most**: keep line pass and HUD at native 1080 (composite after upscale).

### 5.3 Conflicts with our current rules (decide and update)
1. **REFERENCE.md §207 "Handheld drift: 1–2 cm sinusoids on all axes"** conflicts with T1 (drift/orbit was *the* defect; ref has zero lateral motion) and QUALITY_PLAYBOOK §3 (no hand-held float). Delete it from REFERENCE.
2. **CLAUDE.md §4 / REFERENCE shot list: "cut on phrase boundaries, 1.2–4.8 s each"** implies ~15–25 hard cuts per minute. References: ≤ 1 in 7 transitions hard (T1), 12/20 shorts with ≤ 1 hard cut (T2), a 31 s single take. Redefine "shot" as a **camera segment**; boundaries are glides/fly-throughs; hard cuts only for place/era jumps; our white-flash cuts (era change, loop) count as the hard cuts.
3. **REFERENCE §208 impact shake (71/53/37 Hz sinusoids)** vs playbook (sign-flip per frame, ~7 f decay). Either way, exclude planned kicks from the jerk metric, or the jerk QA will always fail.
4. **"No SFX on a spoken word" (CLAUDE.md sig. §8)** vs T1 9:22 (bone knock *on* "bones"). Proposal: keep the rule for impacts/brand sounds; allow soft sync foley on the key word only if it is ≥ 10 dB under the VO in 1–4 kHz (measured). Needs a decision.
5. **Mix:** CLAUDE.md VO ≥ +10 dB over bed, −14 LUFS. T1's reference is a dense, low-dynamic-range mix (loudness value unreliable in captions) and their fix was "music +3 dB, effects ½". −14 LUFS stays (YouTube normalises louder masters down), but **add an LRA target** and measure our competitors' VO-to-bed ratio before deciding if +10 dB makes our bed too thin.
6. **Grain:** T1 adds film grain to everything as part of "too perfect"; our rules allow grain on history only (file size, compression mush). Keep it, but compensate with the other imperfections (bloom, vignette, soft lens, motion blur); optionally test a very fine static luma grain and measure file size.
7. **Words/s:** CLAUDE.md ≈ 3 w/s sits between T1 realistic (2.77) and T2 story (~4). Consistent; set the target from our own competitor measurement, not either tutorial.
8. **"Never aim the camera straight up/down" (CLAUDE.md §4)** vs T1's effective top-down shot. Our rule exists to avoid `lookAt` gimbal flips; a top-down with an explicit up vector is safe. Consider relaxing to "no up/down without an explicit up vector".
9. **Reviewer scoring "max 2 rounds" (token budget)** vs T1 needing 3 judge rounds (7 → 7.5 → 8.5) and the repo's ≥ 7 per area gate. 2 rounds may stop below target; allow a 3rd round for the identity rebuild at least.
10. **"Use subagents only when truly needed"** vs T2's 12-agent gap study. Justified once for this identity rebuild; not per video.
11. **QUALITY_PLAYBOOK §6 mentions Meshy** for hero props, but CLAUDE.md says **free only, no paid model services**. Remove or mark as "after channel earns".
12. **QC "visual event within ±2 frames" (CLAUDE.md §14)** vs playbook "0–3 frames *before* the word". Align on the playbook (events slightly lead the word).
13. **REFERENCE soft tonemap `c/(1+0.12c)` + gamma 1/1.1** (raw-WebGL engine) has no proper shoulder/hue handling; for the Remotion stack use Neutral, and verify the cyan/green brand colours survive it (T1 3:39 + 8:39 is exactly this failure).
