# Phase 1 Lab: independent art-direction review

Reviewer: independent art director (did not make this work). Method: board + a 12-frame motion contact sheet (every 8th frame of the 1.9 Mbps clip) + a side-by-side crop of frames 46 and 66 per concept, all viewed **before** reading NOTES.md. Notes were read afterwards only to check render times and the engraving compression numbers.
Sheets: `…/scratchpad/review_art/{paper,engraving,toy,noir}.jpg`, `crops.jpg`.

Scores are 1–10 against the BRIEF criteria. "Phone size" means a 6-inch screen at arm's length, which is roughly the 0.5-scale sheet.

## Finding shared by all four: the mechanism is not shown

The brief asks for **two brake jaws clamping a guide rail**. In every clip, the fail-safe at phone size is **a glowing green rectangle near the left edge**: Paper's "SAFETY" panel, Engraving's green blob, Toy's green square, and Noir's green card. None of them shows jaws, a rail or a clamping action. We are an explainer, so this is the biggest gap in the lab, and no concept has solved it yet. Toy, Noir and Engraving also put the gear at the left edge, which is where the danger meter must sit (signature §3). The meter and the hero mechanism will fight for the same strip.

---

## 1. PAPER: "Case-File Paper Theatre" (Gus)

| Criterion | Score | Why |
|---|---|---|
| Originality / ownability | 4 | Blocky card-stock figure with peg limbs reads as Playmobil or a wooden toy. Halftone dots on every surface read as "comic print". |
| Premium at phone size | 5 | Clean and legible, but it looks like a kids' channel. The warm brick and gold door frame are generic. |
| Character appeal & expressiveness | 7 | Gus has the most readable face in the lab: big eyes, a moustache and huge mouth shapes. He is charming but juvenile. |
| Character–environment integration | 5 | The feet sit on the deck, but contact shadows are faint. The figure is front-lit flat against a moodier set. |
| Lighting richness | 5 | It reads as a lit lobby, not a night shaft. The warm door glow dominates and the headlamp does no work. |
| Material / texture credibility | 5 | The same halftone sits on helmet, jacket and floor, so nothing feels like a different material. Bricks are stock. |
| Mechanism readability | 3 | A green "SAFETY" window on a box at the frame edge. No rail and no jaws. |
| Fit with 3 states + colour code | 7 | The cyanotype BLUEPRINT is lovely and the vellum X-RAY works. SOLID = hero. Amber drifts to orange (254,141,19). |
| Motion quality | 5 | Big readable arms-up reaction and the rope whip reads. Animating on 2s plus the camera on 1s gives judder. The clamp frame is a **full-frame white wash** (row 2, frame 2) that erases the payoff. |
| Production feasibility | 7 | ~1.3–2 s/frame preview, all in code. |
| Compression robustness | 6 | The flat cards compress well. The halftone dots will mush at 1080 and 1.9 Mbps. |
| **Overall** | **5.3** | |

**Looks cheap:** (1) the toy-proportioned body: rectangular torso, cylinder limbs, mitten hands (hero, every motion frame); (2) the white-out flash at the clamp (motion frame 8), which drops all value structure at the most important moment; (3) halftone stamped on everything, including the face close-ups, where it reads as a Photoshop filter.
**Strongest:** expressive, legible face set; the best cyanotype BLUEPRINT texture; the "case file" framing suits the channel name.
**Originality check:** closest to Playmobil, paper-craft stop-motion and comic halftone. The Playmobil/LEGO risk is **high**, and the owner explicitly excluded it.
**Brand test (0.5 s):** no. It reads as a "cute toy channel", not Fail-Safe Files.
**Universe potential:** medium. New figures are cheap to make, but everyone will look like the same toy, and the style cannot do adult jeopardy.

---

## 2. ENGRAVING: "Living Patent Drawing"

| Criterion | Score | Why |
|---|---|---|
| Originality / ownability | 9 | Nothing on Shorts looks like a moving patent engraving. FIG. numbers, reference numerals and section lining are pure brand. |
| Premium at phone size | 5 | On the board it is premium print design. In motion at phone size it becomes a grey, buzzing field and the eye has nowhere to rest. |
| Character appeal & expressiveness | 4 | The faces are decent but generic inked cartoons. The body is a stiff cut-out with hatched trousers that read as **striped pyjamas**, and the arm locks into a T-pose (motion frames 5–12). |
| Character–environment integration | 5 | The hatched shadow ties him in, but the red floor "danger" is an **airbrushed blob** (frames 4–12) that sits on top of the engraving instead of being part of it. |
| Lighting richness | 3 | It is daylight paper, not a night shaft. Light only exists as hatch density, and the motivated practicals the brief asked for barely register. |
| Material / texture credibility | 6 | The brick, tread plate and wire rope are beautifully engraved, but everything is the same ink, so materials separate by pattern only. |
| Mechanism readability | 5 | The best explainer grammar in the lab ("SAFETY GEAR 14", "GUIDE RAIL 12"), but the gear itself is still a green smudge. |
| Fit with 3 states + colour code | 7 | Spot inks carry the code exactly, and the meter is built in on the left. However, the base is **cream, not navy**, and SOLID is nearly identical to the hero. |
| Motion quality | 4 | Cut-out parts slide in plane. Line crawl on oblique planes during the push and fall. The reaction is one stiff arm. |
| Production feasibility | 8 | ~0.6 s/frame, analytic anti-aliasing. |
| Compression robustness | 3 | Measured by the team: SSIM 0.79 at the bits per pixel of real delivery. Wall hatching blocks up during camera moves, which is visible on the floor in `crops.jpg`. This is inherent to the look. |
| **Overall** | **5.4** | |

**Looks cheap:** (1) the airbrushed red floor glow (frames 4–12), which is the only soft element and looks pasted on; (2) the stiff cut-out body with T-pose arm and pyjama-striped legs; (3) hatch fields smearing into mud under motion at 1.9 Mbps (crop, floor and wall).
**Strongest:** the patent vocabulary (FIG. n, numerals, leader lines, hidden dashed lines), which doubles as explainer grammar; spot-ink discipline on the colour code; cheap to render.
**Originality check:** closest to 19th-century patent plates, Victorian wood engraving and *Wall Street Journal* hedcut portraits. The look itself is low risk. The thick black outlines on the faces edge towards the forbidden comic-ink look, so it is moderate there.
**Brand test (0.5 s):** yes, instantly distinctive, but as a *documentary or illustration* channel. It loses the night-jeopardy thrill.
**Universe potential:** low to medium. The cut-out rig cannot turn, and new characters need new hand-drawn draw functions. Extended jeopardy will fatigue the eye.

---

## 3. TOY: "Precision Miniature" (TECH 07)

| Criterion | Score | Why |
|---|---|---|
| Originality / ownability | 4 | A ball-jointed vinyl action figure with a moustache. It is Playmobil, Fisher-Price and generic "AI 3D toy render" in one, and the closest of the four to excluded territory. |
| Premium at phone size | 8 | Best render polish: depth of field, bloom, motivated light, believable set dressing. It looks expensive. |
| Character appeal & expressiveness | 5 | Readable mouth shapes, but a peg head and dead plastic eyes. He is the same moustache archetype as Gus. |
| Character–environment integration | 6 | Real contact shadows and foot planting, but in every motion frame the figure **stands on or through the "INSP" box**, and the scale reads as a miniature, not a man. |
| Lighting richness | 9 | Red beacon, warm landing leaks, cool fill, headlamp: the best lighting in the lab. |
| Material / texture credibility | 8 | Stained board-formed concrete, checker plate, rails with fishplates, stencilled floor numbers. |
| Mechanism readability | 4 | The NOTES describe wedge jaws in a cut-away housing, but on screen they are a 20 px green square at the far-left edge, inside the meter zone. |
| Fit with 3 states + colour code | 8 | The bloom-lit BLUEPRINT with parallax grid walls is strong. The **clear-resin X-RAY with an armature inside** is the best idea in the lab. Red alarm spill floods whole frames (motion row 2), which muddies "red = danger force". |
| Motion quality | 5 | A smooth push-in. The character idles in T-arms, the reaction is a small crouch, and the rope snap does not read. |
| Production feasibility | 6 | ~2.4–2.7 s/frame at preview, so expect ~8–10 s/frame at 1080 unless post is reduced. |
| Compression robustness | 7 | Mostly smooth surfaces. The dark gradients and the bloom halo around the beacon are banding risks. |
| **Overall** | **6.4** | |

**Looks cheap:** (1) the vinyl action-figure body with visible ball joints and peg head (every frame), which is the "collectible toy" cliché; (2) the T-pose idle arms (frames 1–6); (3) red beacon spill tinting the whole wall pink (row 2), which makes the image look like a gaming-PC render.
**Strongest:** lighting; set construction and material detail; the clear-resin X-RAY variant concept.
**Originality check:** closest to Playmobil, designer vinyl toys and the "isometric miniature diorama" trend in AI 3D. The risk is **high** for the character but **low** for the environment.
**Brand test (0.5 s):** partially. It reads as "premium toy render", but there is nothing only *we* do.
**Universe potential:** high technically, because the rig is parametric and swappable. Creatively it is low: every cast member becomes a toy, and adult stakes read as playtime.

---

## 4. NOIR: "Lit Gouache Noir" (Rafa)

| Criterion | Score | Why |
|---|---|---|
| Originality / ownability | 7 | A painted 2.5D figure in a real-lit 3D world with haze and dust. Adult proportions and a beard. It sits near *Arcane*, *Klaus* and Spider-Verse painted lighting, but it is not a copy. It is **cards in 3D**, so we must keep it away from the tutorial look, which it currently does because it has no ink outlines. |
| Premium at phone size | 7 | Best mood and atmosphere, and the most "film" frame. Held back by mushy walls and a flat body when turned. |
| Character appeal & expressiveness | 7 | The most relatable, adult hero. Painted faces with good alarm and relief, and the only acting with weight: the brace crouch in frames 7–10. |
| Character–environment integration | 6 | Lit by scene lights with shadows, but the cut-out goes paper-thin in 3/4 (the hero torso). The **helmet changes colour** from navy to pink to white across the clip. |
| Lighting richness | 8 | Haze cones, lit dust, teal and violet shadows, a warm key. |
| Material / texture credibility | 6 | The gouache jacket is lovely. The walls and rails are a smeary, out-of-focus mush with no material identity. |
| Mechanism readability | 3 | A glowing green card on the rail. No jaws. |
| Fit with 3 states + colour code | 7 | The under-drawing BLUEPRINT is good and "one shader = drawing, glaze, paint" is elegant. The X-RAY is only teal plus arrows: shells are not translucent and the camera does not go inside. |
| Motion quality | 7 | Best performance: anticipation, crouch, overshoot, relief. The camera is good. The limit is the card plane, which restricts angles. |
| Production feasibility | 6 | 1.5–5 s/frame (the NOTES contradict themselves). Painted per-angle cards limit reuse. |
| Compression robustness | 7 | Soft fields encode well. Dust specks and haze gradients risk shimmer and banding. |
| **Overall** | **6.5** | |

**Looks cheap:** (1) the background walls and rails: a blurry, smeared texture with no design (every frame, especially upper left); (2) cut-out flatness, with arms that look pinned on in 3/4 and an arm that tucks behind the body in the calm face crop; (3) colour drift on the helmet and jacket under the alarm light (frames 4–11), which breaks character consistency.
**Strongest:** acting and an adult, empathetic hero (the right emotional register for "this could kill you"); atmosphere and light; the best match for a premium-thriller feel at phone size.
**Originality check:** closest to *Arcane* (Fortiche), *Klaus* (SPA Studios) and Spider-Verse painted shading. The risk is **moderate**: avoid hard ink outlines and bright daylight, or it slides towards the tutorial's 2D-cards-in-3D look.
**Brand test (0.5 s):** almost. Dark teal with an amber figure and a green glow is distinctive, but it needs one owned graphic device (see the recommendation) to be unmistakable.
**Universe potential:** the best *creatively* (the adult cast and the style travel to bridges, aircraft and trains). It is weak *technically* while the character is a flat card that cannot turn.

---

## Ranking

1. **Noir / Gouache: 6.5.** Best acting, mood and emotional register, and an original enough base.
2. **Toy: 6.4.** Best craft (light, set, materials, X-RAY idea), but the character is in excluded toy territory.
3. **Engraving: 5.4.** The most original, with a great explainer vocabulary, but it cannot survive 1.9 Mbps motion or carry night jeopardy as a full-frame look.
4. **Paper: 5.3.** Likeable faces, but Playmobil-adjacent and juvenile.

## Recommended direction: "Gouache Noir, engineered" (hybrid)

- **Base look and cast: Noir.** Adult proportions (~6.5 heads), a painted gouache surface, teal and violet shadows, haze and dust, and an amber hero.
- **Character construction: Toy's technology, not Toy's design.** Build each character as a real low-poly 3D mesh on Toy's joint rig (foot planting, contact shadows, parametric parts), then shade it with Noir's painted-gouache shader and *projected painted face decals* (Noir's expression paintings). This fixes the cut-out's flatness at any angle while keeping the painterly identity. The two are compatible because Noir already lights its cards with generated normals, and a mesh simply gives true normals.
- **Environment: Toy's set construction and practical lights, with Noir's painted shading.** Use Toy's cut-away shaft, rails, fishplates and stencils, but re-texture them in low-frequency painted planes instead of photoreal grime or Noir's mush.
- **BLUEPRINT and graphic language: Engraving's patent grammar, used as overlay only.** FIG. n titles, reference numerals with leader lines, dashed hidden lines and section lining, drawn in **cyan on navy** with sparse, low-frequency hatching. This is the owned 0.5-second brand device and it is cheap. Full-frame hatching is dropped, because it fails compression.
- **X-RAY: Toy's clear-resin idea, translated.** The gouache shells fade to a tinted glaze with a Fresnel rim, and the internal structure (rails, gear, the character's bones as cyan line) shows through.
- **History tag:** an engraved patent plate in sepia (Engraving's look at full strength, but only for 2–3 s, where its compression cost is acceptable).

## 8 changes needed to reach premium

1. **Design the mechanism for the camera.** Use oversized wedge jaws on a rail with a machined face, plus a macro insert shot (depth of field, sparks, and a localized green flash on the jaws only, never a full-frame white-out). Move the gear inboard and frame it centre-right so the left strip belongs to the meter.
2. **Give the character a 3D mesh with painted shading**, as above. Make a 5-angle turnaround sheet and 10 expressions (add squint, wince, shout, smirk and determined) using decal swaps with blink cover, and add IK hands and feet.
3. **Give the brand cast an owned silhouette.** Use a distinctive helmet shape and a long-limbed adult build, and drop the moustache-peg-man archetype that Paper and Toy share. One recurring hero (Rafa) plus 3 supporting archetypes, sharing the rig.
4. **Treat the background as design, not blur.** Use painted planes with readable large shapes (brick courses, formwork seams), a clear value hierarchy (dark periphery, lit subject), and no smeared noise textures.
5. **Enforce colour-code discipline in lighting.** Red spill stays on the beacon and the force arrows only. The amber jacket holds #FFB020 within ΔE ~6 under every light, the helmet keeps one colour, and the grade pulls to navy #0B1A33 in the shadows.
6. **Make X-RAY real.** Translucent shells with Fresnel edges, a camera move inside, and red force arrows integrated with the painted look (brushed edges, not flat vector).
7. **Plan motion like acting.** No T-pose idles. Use anticipation, reaction, settle and relief beats, and design the 0.5 s freeze plus slow-mo replay in the rig from day one. The camera keeps creeping during holds.
8. **Budget compression and render cost.** No texture period under ~4 px at 1080. Cap dust counts and dither the haze. Validate every look at 1080×1920 and 1.9 Mbps (SSIM ≥ 0.9 target). Target ≤ 3 s/frame at 1080 by running bloom and depth of field at half resolution.
