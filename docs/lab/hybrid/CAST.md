# CAST: Character Design Bible (draft v1, Lamplit Gouache)

Owner: Character TD. Code: `remotion/src/lab/hybrid/cast/`. Import from `cast/api.ts` (the `cast/index.ts` file is the Remotion test entry).
Sheets: `docs/lab/hybrid/cast/{turnaround,expressions,lineup,motion}.jpg`.

## 1. What the library is
- `buildCharacter(spec: CharacterSpec): Character` turns a data spec into a real 3D figure:
  - sculpted superellipsoid parts with layered clothing (seams, pockets, collar, hem, reflective tape, tool belt, helmet, boots);
  - a rigid joint hierarchy (no skinning);
  - the face painted in the skull shader;
  - IK for the feet and hands;
  - the three signature states.
- Shading is the shared `look/` `gouache()` material (object-anchored brush and tooth, painted value steps, coloured shadows). The amber jacket uses the look's brand lock, so its lit step lands exactly on `#FFB020`.
- Every frame is a pure function of the inputs. There are no textures to paint, and the face is shader math.

```ts
const rafa = buildCharacter(RAFA);      // or NOOR, or asAtRisk(NOOR)
scene.add(rafa.root);                   // root = ground point between the feet, faces +z
rafa.setPose(mixPose(POSES.idle, POSES.alarm, EASE.backOut(u)));   // legs auto-plant by IK
rafa.setExpression("terrified");  rafa.blendExpression("alarmed", "relieved", t);  rafa.setFace(params)
rafa.setBlink(0..1); rafa.setGaze(x, y);   // x + = toward the character's left, y + = up
rafa.handIK("R", railPointWorld);          // palm lands on the point (call after setPose)
rafa.footIK({ L: soleWorld, R: soleWorld });
rafa.setState(0 | 1 | 2);  rafa.followLook();  rafa.setOutline(false)
rafa.lampAnchor   // headlamp lens, +z = beam;  rafa.eyeAnchor = between the eyes (framing/labels)
rafa.contact      // soft contact-shadow blobs that follow the feet (root space)
```

## 2. Proportions (stylized-real, graphic-novel)
| | Rafa | Noor |
|---|---|---|
| Height (skull top) | 1.80 m (≈1.86 m with the helmet) | 1.66 m (≈1.75 m with the bun) |
| Heads | **6.7** (head 0.269 m) | **6.5** (head 0.255 m) |
| Build | broad (shoulders ×1.07, limbs ×1.05) | slim, with hips ×1.12, waist ×0.92 and limbs ×1.1 so she is not a stick figure |

Fixed landmarks, as fractions of H with s = H/1.8:
- ankle 0.082 s; knee 0.283 H; hip joint 0.497 H (long legs: half the height);
- chin H − 1 head; neck base 0.062 s below the chin; shoulder joint 0.034 s below that;
- shoulder half-width 0.166 s × build;
- upper arm 0.17 H, forearm 0.142 H, so the fingertips reach mid-thigh (the long-limbed adult read);
- skull radii (0.318, 0.49, 0.385) × head.

Eyes sit at half the head height (an adult, not a kid). The house eye size is 1.15× real (graphic novel), not anime.

## 3. Silhouette rules
- Each cast member owns **one unmistakable head shape**: Rafa has the cap-peak hard hat with a crown fin and a headlamp; Noor has a high bun and glasses. Check the black-fill silhouette sheet (`lineup.jpg`, bottom). Both must read in profile and in 3/4.
- No peg heads, no ball joints showing, no moustache everyman. Joints are hidden by same-material caps inside sleeves and trouser legs.
- Arms stay off the torso in every pose (shoulders z ≥ 0.12 rad). The idle is never a T or I pose: use a contrapposto idle with weight on one leg.
- Feet always plant: legs are IK-solved to the stance unless `plant:false`, and the soles stay flat (the heel lift is explicit).
- Amber `#FFB020` belongs only to the person at risk (`asAtRisk(spec)` recolours any outer layer). Other cast wear desaturated colours. Never use cyan, red or green on clothing.

## 4. Face construction (why it is painted in the shader)
- The face is painted **in the skull's own fragment shader**: signed-distance eyes, lids, lash line, brows, mouth, lips, teeth, tongue, nasolabial folds, worry and furrow lines, cheek washes and the beard. Coordinates are the head's object space, normalised by the skull half-height. Edges are broken by the shared brush field.
- Why: it is lit and shadowed by the same gouache ramp as the sculpted head (the brim shadow falls across it), so it turns correctly at any angle. Expressions are continuous parameter vectors that blend with no swaps or pops. Blink and gaze are free uniforms. It costs no textures and stays resolution independent.
- Sculpted (3D): the skull with brow ridge, cheekbones, jaw angle, chin and occiput, plus the nose, nostril wings, ears and hair. The jaw drops a little with `open`, so the chin changes in profile.
- `FaceParams`: brow inner/outer per side, `pull` (furrow), upper and lower lids per side, mouth width, `open`, `smile` per side, `teeth`, `clench`, `cheek`.
- **Expression set (12):** neutral, focused, curious, alarmed, terrified, wincing, relieved, smiling, determined, shouting, squint, smirk.
- **Readability:** at phone size (head ≈ 120 px at 1080; `HyCastFaces` frame 2) expressions read through the lash-line weight, eye-white area, brow angle and mouth shape. Alarm vs terror is carried mostly by mouth shape and eye whites.
- Rule: big expression changes happen behind a blink (1–2 frames) or with a 3–5 frame blend, never as a cut.

## 5. Palettes
- **Rafa:**
  - skin `#B57655` with a warm self-lift so shadowed skin stays warm, not grey;
  - salt-and-pepper boxed beard `#2E2624`/`#8E857C`;
  - jacket brand amber, with navy trim `#2D3647` and tape `#C9D4D6`;
  - work trousers `#34404F`, boots `#5C3D2C`, toe cap `#7A5638`, gloves `#3E434B`;
  - helmet cream `#EDE6D8`, ribs `#C9C0B2`, tool belt leather `#6C4733`.
- **Noor:**
  - skin `#7B4B36`, hair `#2A1C18`;
  - blazer slate-plum `#5E5470`, blouse `#E6DCCB`, trousers `#2B2E38`, flats `#6E4430`;
  - glasses `#221C20`, lanyard `#3A4150`.

## 6. Rig and joints
- Joint order: `hips > spine > chest > neck > head`; `chest > clav{L,R} > shoulder > elbow > wrist`; `hips > hip{L,R} > knee > ankle`.
- Each hand has 4 two-segment fingers and a two-segment thumb, driven by curls + spread (`HANDS`: relax, grip, fist, splay, point, flat, claw).
- Conventions: the character faces +z and L = +x. Spine/head x+ bends forward and head x− looks up. Arm x− swings forward, elbow x− bends. shoulderL z+ / shoulderR z− lifts the arm out; clavL z+ / clavR z− shrugs.
- IK (`ik.ts`) is an analytic 2-bone solve with a pole. Knees point along the foot yaw. Elbows point back and out. A pose's `reachL/R` (root space, metres at 1.8 m scale) drives the palm onto a point, for example a rail or the chest.
- Poses are authored at 1.8 m and scale with the character, so they transfer to any spec.
- States:
  - `setState` locks the character's materials (the look's `uLock`).
  - BLUEPRINT = navy paper, cyan face ink and a cyan outline hull. Turn the hull off with `setOutline(false)` when the look's post ink is drawing lines.
  - X-RAY = additive coloured resin (the person stays amber) with a cyan skeleton inside: bones, ribs, pelvis, skull rings.
  - SOLID = gouache.
  - `followLook()` hands control back to the global state and sweep.

## 7. Motion language (`poses.ts`)
- **Poses:** stand (model sheet), idle (contrapposto), lookUp, alarm (recoil: knees bend, torso leans back, shrug, arms up and out, splayed hands), brace (low crouch, both hands gripping a rail through reach IK), relief (shoulders drop, chest sinks, hand to chest, head tips back).
- **Clips:** `keyed(keys, f, mixPose)`. The ease of the target key shapes each segment:
  - `glide` for holds and settles;
  - `backOut` for reactions (≈10 % overshoot);
  - `out` for snappy starts;
  - `antic` for an 8 % dip before the move.
- **Additive layers (nothing is ever frozen):**
  - `breathe`: 4.2 s cycle, ×2.4 when scared;
  - `drift`: slow weight shift and head micro-sway;
  - `tremble`: fear shake that must decay within about 12 frames.
- **Acting rules:**
  - Anticipate big reactions with a 2–3 frame dip.
  - Hit the extreme 6–9 frames after the cue, then settle with overshoot.
  - Hold with breathing.
  - Relief is an exhale: shoulders drop, then the face relaxes into a smile 5–10 frames later.
  - Face changes lead the body by 1–2 frames.
- Reference timing: `HyCastMotion` (60 frames):
  - idle 0–13;
  - dip 13–16;
  - recoil 16–25 (backOut) with terror on the face from frame 17;
  - trembling hold 25–38;
  - relief 38–50, with the expression swapped behind a blink at frames 41–44;
  - smile settle 50–60.

## 8. Adding a new character (no new code)
1. Copy a spec in `specs.ts`. Set height, heads (6.3–7.0), build, `body` multipliers, skin, hair (`crop`, `bun`, `bob` or `none`), and the face style (beard 0–1, iris, brow weight, eye scale, nose, jaw).
2. Pick outfit pieces: top `workJacket` or `blazer`, `under`, `stripes`; lower `workPants` or `trousers`; shoes `boots` or `flats`; `gloves` colour.
3. Pick accessories: helmet, headlamp, toolbelt, glasses, lanyard, watch, kneepads.
4. Give it its own palette. Keep amber for the person at risk (`asAtRisk`).
5. Check it with `HyCastTurn`, `HyCastFaces` and `HyCastLineup` (add it to `lab.ts`). The silhouette must differ from the rest of the cast at the 0.5-s read.
6. New garment types or hair styles are new branches in `character.ts`. Keep them built from sculpt, ribbon and band parts.

## 9. Render and test
- Stills: `cd remotion && ENTRY=src/lab/hybrid/cast/index.ts TMPDIR=<scratch>/rtmp_cast node scripts/stills.mjs HyCastTurn|HyCastFaces|HyCastLineup|HyCastStates|HyCastMotion <out> <frames> 0.5`
- Clip: `npx remotion render src/lab/hybrid/cast/index.ts HyCastMotion out.mp4 --gl=swiftshader --scale=0.5 --concurrency=1`
- Cost at 540×960 (real buffer through devicePixelRatio):
  - motion test with the full look post (ink, background blur, bloom, grade, MSAA 2): **≈0.6 s/frame** (60 frames in 39 s including the bundle);
  - sheets with 6–12 viewports: ≈3 s per still.

## 10. Known weaknesses and next steps
- **Rigid segments:** limbs are capsule chains, so sleeves read as tubes, elbow and knee caps show at strong bends, and there are no cloth folds. Next: per-pose fold decals painted in the shader (the same technique as the face), and a skinned torso-and-sleeve mesh if needed.
- **Brand-locked amber is very flat** under the key. Brand lock plus painted fold washes should be balanced with the look TD.
- **Faces:** the features are small relative to the egg-like skull in wide shots. Neutral, focused, determined and squint differ subtly at 120 px; strengthen with brow weight or per-shot `setFace` exaggeration. The helmet peak shadows the brows under a high key.
- **Noor:** her hair cap reads as a smooth shell (it needs strand clumps), and the blazer is a single shape (it needs real lapels and a hem split).
- **Motion:** the relief arm arcs through the torso area for 3–4 frames (frames 40–45); add a mid key or a pole change.
- **Hands:** read only in close-up or with splayed and pointing shapes. Gloved fingers merge at distance.
