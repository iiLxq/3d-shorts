# Subtitle lab notes (Paper Case-File v2)

Code: `remotion/src/lab/subtitles/`. Test text: video #1 (`videos/01_ram_air_turbine/SCRIPT.md` VO-only section + `vo/words.json`). Nothing else used.

## Pipeline
1. `chunker.ts` `buildChunks(scriptText, asrWords, opts)` -> `Chunk[] {text,start,end,emphasis,tone,fadeOut,sentence,words,wordStart,wordEnd,firstWord}` (seconds).
   - Displayed text always comes from the script. ASR words are only used for timing, via a Needleman-Wunsch alignment tolerant to spelling/punctuation differences (handles "forty-one" vs "forty one", dropped dashes, "?" vs ","). Unmatched script words are interpolated.
   - Rules: 1-3 words; a chunk never has punctuation inside (comma, full stop, ellipsis, dash always end a chunk); DP cost penalises ending on article/preposition/conjunction (determiners worst), lone function words, splitting keep-together pairs (`almost never`, `just one`, `no engines`, `ten feet`...), and rewards cutting where the voice pauses. Min 8 frames on screen. 1-frame lead before the word. Gaps <= 0.45 s are bridged (chunk held); longer pauses get a calm 6-frame fade-out.
   - Emphasis: at most one chunk per sentence, scored by lexicon (danger / fail-safe / person words), numbers, proper nouns, sentence landing; only the top 50 % of sentences keep it; never on consecutive chunks. Manual overrides: `data/video01.overrides.json` (key = chunk text fragment -> `danger|safe|person|white|none`). Tone colours: danger #FF3B3B, safe #39FF88, person #FFB020 (`white` = size/weight only).
   - `extractVoOnly(md)`, `chunksToText()` (owner approval list: `docs/lab/subtitles/chunks_video01.txt`).
2. CLI: `sh src/lab/subtitles/cli/run.sh` (rebuild chunks), `sh src/lab/subtitles/cli/validate.sh` (validator), `cli/stills.mjs` (many stills, one bundle), `cli/fontboard.sh`, `cli/sheet.py`.
3. `Subtitles.tsx` `<Subtitles chunks style="clean|diecut" font lightDir centerY />`; `World3D.tsx` `<SubtitlesWorld chunks font />` (three.js). Comps: `SubClean`, `SubDiecut`, `SubWorld`, `SubFontCell` (entry `index.ts`, `--public-dir=src/lab/subtitles/public`).
4. Animation: `place` = 4 frame slide/fade from slightly above and larger + 1-2 deg settle ring, shadow tightens as the card lands. `stamp` (emphasis) = scale 1.2 -> 0.93 -> 1.045 -> 1.0 over 9 frames with a decaying 5 px shake, colour-coded face, size x1.12. Calm fade-out only on real pauses.

## Layout (shared by component and validator, `layout.ts`)
Band centre y 1350 (band 1250-1450), base 104 px (x font scale), shrinks to min 78 px, then two lines. Advance width <= 820 px so outline + stamp peak stay inside x 100-980 (>= 60 px margins, clear of the right-hand buttons); nothing near y 1536.

## Validator (`cli/validate.ts`) - asserts
text == script exactly (punctuation + capitalisation, char by char); 1-3 words; no punctuation inside a chunk; no lone/only article-preposition chunk; start frame within 0..-2 frames of an independently found ASR word start; >= 8 frames on screen; no overlap; no 1-3 frame gaps (flicker); <= 1 emphasis per sentence; for all 5 fonts every chunk fits the x margins, right-button zone, band y range and 1536 limit (measured with opentype.js on the real font files). Self-test with a tampered chunk file fails as expected. Result on video #1: PASSED (65 chunks, 11 emphasised, max 3 words). Warning only: 4 chunks end on a function word mid-phrase (`A pinwheel out`, `ran dry at`...).

## Styles (see styles_board.jpg, demos in scratchpad `lab/v2/subtitles/*_demo.mp4`, narration frames 660-1019)
- S1 Clean: white, 17 % black stroke, soft 25 % shadow. Maximum legibility, zero identity (the generic convention the reference channels all use).
- S2 Die-cut (recommended): white card letters with ink hairline, off-white paper border, cream edge thickness, key-light shadow (upper-left light, scene v1), subtle halftone print dots on the face (same dot language as the paper cards), +-1 deg resting tilt per chunk, card-placement motion, stamp for emphasis with the colour code on the face. Reads as clean as S1 on every backdrop tried (dark blueprint, x-ray teal, bright orange, motion clip).
- S3 In-world: real three.js extruded letters (Archivo Black), warm key + real cast shadow on a catcher plane, dark ink backer for contrast, slight camera sway so the thickness is visible. Most "of the world", but the lit paper face greys down on bright areas and green/amber emphasis goes pastel unless boosted by emissive (I did; colours are then approximate, not exact code values). Needs `--gl=swiftshader`, ~3x render time of S2. Use only if the whole scene is 3D and lit anyway; fallback to S2 per shot if a backdrop is too bright.

## Fonts (fonts_board.jpg; all OFL, files + licences in `public/fonts/`)
Montserrat ExtraBold / Black (static instances cut from the OFL variable font), Archivo Black, Barlow Semi Condensed Bold, Poppins ExtraBold. Recommendation: **Montserrat ExtraBold** (closest to Gotham Bold/Black, the owner's reference); Poppins ExtraBold is the near-twin if Montserrat feels too wide (it fits more words at a bigger size). Montserrat Black clogs the die-cut border between letters. Archivo Black is too wide (wraps to two lines on 3-word chunks). Barlow SC is the most legible at tiny size but looks nothing like Gotham.

## Weaknesses / open items
- Chunker is heuristic: adjective+noun splits rely on the keep-pair list; 4 mid-phrase function-word endings remain in video #1 (`A pinwheel out | a car window`). Owner approval of the text list is the real gate; add `breakBefore` overrides if wanted.
- 5 chunks fall back to 2 lines at 78 px (longest 3-word chunks); acceptable but smaller.
- Whole emphasised chunk is coloured (not just the key word).
- Backdrops are upscaled 360x640 board panels + the 540x960 motion clip, so backdrop detail is soft; text is true resolution. Demos are silent (no VO muxed).
- S2 shadow direction is a prop (`lightDir`); it must be wired to the real key light per shot when integrated. Safe zone (left meter strip x < 140) is not an issue since text is centred and <= 880 px wide.
