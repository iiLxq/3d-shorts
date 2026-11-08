# CAST: Character Design Bible (v2 polish, Lamplit Gouache)

Owner: Character TD. Code: `remotion/src/lab/hybrid/cast/`. Import from `cast/api.ts` (the `cast/index.ts` file is the Remotion test entry).
Sheets: `docs/lab/hybrid/cast/{turnaround,expressions,lineup,motion}.jpg`; before/after of the v2 polish: `polish_board.jpg`.

## 1. What the library is
- `buildCharacter(spec: CharacterSpec): Character` turns a data spec into a real 3D figure:
  - **skinned garments** (v2): the jacket body, sleeves and trouser legs are lofted cloth shells (`garment.ts`: superellipse cross-sections, front/back depth, squareness) bound to a THREE.Skeleton whose bones ride the joint groups, with smooth weights, so limbs bend as one piece of fabric (no ball joints, no tube segments);
  - rigid sculpted parts on the joints: head, hands, boots, belt, props;
  - the face painted in the skull shader;
  - IK for the feet and hands;
  - the three signature states.
- Shading is the shared `look/` `gouache()` material (object-anchored brush and tooth, painted value steps, coloured shadows). The amber jacket uses the look's brand lock, so its lit step lands exactly on `#FFB020`.
- Cast patches on top (`mat.ts`, string inserts into the look shader, read-only use of the look):
  - **painted folds**: garments carry `aFold` (u along the part from the crease, angle, crease id, mask). The shader turns it into object-anchored fold strokes (3 elbow/knee crease strokes on the inner side, a stretch ridge behind, waist rumples, armpit drag lines, gravity drape) by bending the shading normal, so folds drop into the painted value steps. Crease depth follows the live bends (`uBendA` elbows/knees, `uBendB.x` spine flex), updated in `setPose`/`handIK`/`footIK`.
  - **warm shadow pigment** (`warm`): the amber jacket's shadow plane mixes 86 % toward `#5A3A26`, so it reads as amber-brown cloth with form; other cloth 22 % warm. The top step stays brand exact.
  - **hair strands** (`strand`): painted strand grooves/sheen along meridians converging on the bun (Noor) or the crown.
  - **face bounce** (`bounce`): an emissive lift on the brow/eye band (0.42 under a helmet, 0.34 bare) = the headlamp bounce off the shell, so the peak never kills the brows.
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
| Heads | **6.4** (head 0.281 m; v1 6.7) | **6.2** (head 0.268 m; v1 6.5) |
| Build | broad (shoulders ×1.07, limbs ×1.05) | slim, with hips ×1.12, waist ×0.92 and limbs ×1.1 so she is not a stick figure |

Fixed landmarks, as fractions of H with s = H/1.8:
- ankle 0.082 s; knee 0.283 H; hip joint 0.497 H (long legs: half the height);
- chin H − 1 head; neck base 0.062 s below the chin; shoulder joint 0.034 s below that;
- shoulder half-width 0.166 s × build;
- upper arm 0.17 H, forearm 0.142 H, so the fingertips reach mid-thigh (the long-limbed adult read);
- skull radii (0.35, 0.49, 0.40) × head (v2: wider, squarer graphic-novel skull; v1 was an egg at 0.318 wide).

Eyes sit at half the head height (an adult, not a kid). The house eye size is 1.15× real (graphic novel), not anime.

## 3. Silhouette rules
- Each cast member owns **one unmistakable head shape**: Rafa has the cap-peak hard hat with a crown fin and a headlamp; Noor has a high bun and glasses. Check the black-fill silhouette sheet (`lineup.jpg`, bottom). Both must read in profile and in 3/4.
- No peg heads, no ball joints showing, no moustache everyman. Sleeves and trouser legs are continuous skinned cloth (v2).
- Garments are bigger than the body: Rafa's jacket is a box (straight sides from chest to a flared hem, e ≈ 0.7), baggy trousers hang over the boot shafts; Noor's blazer is tailored (padded square shoulders, pinched waist, hip flare).
- Asymmetry is mandatory: Rafa wears the radio + harness strap on the left, the pen in the right pocket, a rag in the right back pocket, pliers left/tape right on the belt; Noor has a side-swept fringe, flyaway strands, the watch on the left wrist.
- Arms stay off the torso in every pose (shoulders z ≥ 0.12 rad). The idle is never a T or I pose: use a contrapposto idle with weight on one leg.
- Feet always plant: legs are IK-solved to the stance unless `plant:false`, and the soles stay flat (the heel lift is explicit).
- Amber `#FFB020` belongs only to the person at risk (`asAtRisk(spec)` recolours any outer layer). Other cast wear desaturated colours. Never use cyan, red or green on clothing.

## 4. Face construction (why it is painted in the shader)
- The face is painted **in the skull's own fragment shader**: signed-distance eyes, lids, lash line, brows, mouth, lips, teeth, tongue, nasolabial folds, worry and furrow lines, cheek washes and the beard. Coordinates are the head's object space, normalised by the skull half-height. Edges are broken by the shared brush field.
- Why: it is lit and shadowed by the same gouache ramp as the sculpted head (the brim shadow falls across it), so it turns correctly at any angle. Expressions are continuous parameter vectors that blend with no swaps or pops. Blink and gaze are free uniforms. It costs no textures and stays resolution independent.
- Sculpted (3D): the skull with a strong brow ridge + glabella, cheekbones, cheek hollows, jaw angle, chin and occiput; a two-piece nose (bridge + distinctive tip, `nose` scale); nostril wings, ears; **Rafa's beard is sculpted volume** (boxed mass on jaw + chin with clumped relief, mouth kept clear) under the painted beard. The jaw drops with `open`, so the chin changes in profile.
- Painted (v2, graphic-novel): almond eyes with small warm sclera and a **heavy dark upper lash line + flick**, a dark limbal ring, terror pins the iris small (white all round); angular brush-stroke brows with a blocky inner end and a dark ridge plane under them; painted planes (warm cheek apples, cool under-cheekbone plane, under-nose shadow, darker upper lip / lit lower lip with a highlight dab); crow's feet on squints and big smiles; the beard is brush strokes that flow down and in with irregular grey strands and a hair-tip edge, plus a bold moustache shape. Style knobs per spec: `eyeTilt`, `lashW`, `age` (bags, hollows, ridge shadow).
- `FaceParams`: brow inner/outer per side, `pull` (furrow), upper and lower lids per side, mouth width, `open`, `smile` per side, `teeth`, `clench`, `cheek`.
- **Expression set (12):** neutral, focused, curious, alarmed, terrified, wincing, relieved, smiling, determined, shouting, squint, smirk.
- **Readability:** at phone size (head ≈ 120 px at 1080; `HyCastFaces` frame 2) expressions read through the lash-line weight, eye-white area, brow angle and mouth shape. v2 gives each of the seven story faces its own eye shape: neutral = open calm; focused = slit + hard furrow + pressed mouth; alarmed = ring of white + high arched brows + small "o"; terrified = pinned irises + worry brows + wide square grimace with teeth; wincing = shut + clench; relieved = heavy lids + soft open smile; smiling = crescent eyes + grin + cheeks up. determined / shouting / squint / smirk / curious stay in the API.
- Rule: big expression changes happen behind a blink (1–2 frames) or with a 3–5 frame blend, never as a cut.

## 5. Palettes
- **Rafa:**
  - skin `#B57655` with a warm self-lift so shadowed skin stays warm, not grey; face style `age 0.6`, `lashW 1.1`, `nose 1.2`, `jaw 1.2`;
  - salt-and-pepper boxed beard `#2E2624`/`#8E857C`;
  - jacket brand amber, with navy trim `#2D3647` and tape `#C9D4D6`;
  - work trousers `#34404F`, boots `#5C3D2C`, toe cap `#7A5638`, gloves `#3E434B`;
  - navy yoke, collar, placket, elbow + knee patches (`trim`); helmet cream `#EDE6D8` (painted glint), ribs `#C9C0B2`, tool belt leather `#6C4733`; rag `#6F8296`; radio + harness strap dark.
- **Noor:**
  - skin `#7B4B36`, hair `#2A1C18`;
  - blazer slate-plum `#5E5470`, blouse `#E6DCCB`, trousers `#2B2E38`, flats `#6E4430`;
  - glasses `#221C20`, lanyard `#3A4150`, gold `#C8A15A` (earrings, watch case); face style `eyeTilt 0.12` (cat-eye), `lashW 1.3`.

## 6. Rig and joints
- Joint order: `hips > spine > chest > neck > head`; `chest > clav{L,R} > shoulder > elbow > wrist`; `hips > hip{L,R} > knee > ankle`.
- Each hand has 4 two-segment fingers and a two-segment thumb, driven by curls + spread (`HANDS`: relax, grip, fist, splay, point, flat, claw).
- Conventions: the character faces +z and L = +x. Spine/head x+ bends forward and head x− looks up. Arm x− swings forward, elbow x− bends. shoulderL z+ / shoulderR z− lifts the arm out; clavL z+ / clavR z− shrugs.
- Skinning: one `THREE.Skeleton` per character, one `Bone` parented under every joint group (bind = rest pose with the root at the origin, attached bind mode), so IK/FK on the joint groups drives the cloth. Weights: sleeve top 55 % clavicle → shoulder; elbow blend ±5 cm; trouser top 60 % hips; knee blend ±5 cm; torso hips → spine → chest with clavicle pull on the shoulder line. Skinned meshes have `frustumCulled = false`; the blueprint hull is skinning-aware.
- IK (`ik.ts`) is an analytic 2-bone solve with a pole. Knees point along the foot yaw. Elbows point back and out, except reaches to the own chest (hand on heart), which use an out-down-forward pole so the forearm passes in front of the torso. A pose's `reachL/R` (root space, metres at 1.8 m scale) drives the palm onto a point, for example a rail or the chest.
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
  - motion test with the full look post (ink, background blur, bloom, grade, MSAA 2): v1 ≈0.6 s/frame on an idle machine; v2 +11 % (see §10);
  - sheets with 6–12 viewports: ≈3 s per still.

## 10. v2 polish: measured + verdict
- Cost: interleaved A/B on the same loaded machine (another render running), 30-frame `HyCastMotion` clip incl. startup: v1 **47.9 s** avg, v2 **53.1 s** avg (**+11 %**, budget +30 %). Skinning + fold shader are cheap; draw calls went down (garment pieces merged per material).
- Amber: top-lit median ΔE00 **1.3–2.0** vs `#FFB020` (v1 1.9); the shadow plane and fold strokes are now warm amber-brown.
- Before/after: `cast/polish_board.jpg`.
- Verdict (harsh): no longer a mannequin. Limbs bend as cloth, the jacket is a designed garment, Rafa has a face with character (brow ridge, nose, sculpted brushed beard), and the seven story expressions separate at 120 px. It still reads as a **stylized 3D game character more than a painted graphic novel** at full-body distance: the brush texture on the brand-locked amber is subtle (by design the lit step is flat), and the cloth folds read best in medium shots.

## 11. Known weaknesses and next steps
- **Lit amber is still a flat field** between folds (brand lock ±2.5 % pigment). The next lever is the look TD's: brushed value strokes inside the top step within ΔE ≤ 5, or ink lines from the post on fold edges.
- **Noor is less developed than Rafa:** face planes and lashes help, but her head shape is still generic, the bun's strand stripes can read "coiled", and the blazer has no real lapel depth from the side.
- **Hands:** capsule fingers. Gloved mitts read at distance; bare hands (Noor) look doll-like in close-up. Next: a skinned hand mesh.
- **Skinning limits:** linear blend; at > 130° elbow bends the inner sleeve compresses (hidden by the crease strokes). Raised arms > 100° stretch the deltoid area; avoid in close-ups or add a corrective shape.
- **Relief arc:** the motion test uses a mid key (f44) so the hand arcs out and in front; shot timelines doing alarm → hand-on-chest should add a similar mid key (the chest-reach pole alone prevents the torso crossing at the end pose, not the path).
- **Beard/hair** are procedural brush stripes: good at phone size, a little regular in macro.
