# Takeover Audit: `iiLxq/3d-shorts`

**Date:** 2026-11-11
**Scope:** Read-only audit of the repository against the Unified Master Handoff v1.0, the YouTube Production Director Master Specification v2.2, and the Scheduled Tasks Playbook v2.2.
**Method:** `git` reads, GitHub API reads (branches, commits, PRs), `ls`/`grep`/`ffprobe`, and Python parse-only syntax checks.
**Not done:** nothing was installed, type-checked, rendered or run. No files were modified, committed or pushed during the audit. This document is the only file added, and it is uncommitted.

Evidence labels used below: **VERIFIED** (observed directly in this workspace or on GitHub), **GLM-REPORTED** (stated in the handoff, not reproduced), **UNVERIFIED** (no evidence available).

---

## 1. Key finding

GLM's work is not in this workspace or on GitHub. Everything the handoff describes as GLM's output (the subtitle production module, the `rev` lab, the evidence tree, the audit documents, local commit `c04011d`) exists only on GLM's device (`/workspace/swift-tesla`). None of it can be verified from here, and it is at risk of being lost if that environment is reclaimed.

## 2. Verified repository state

| Item | Evidence | Result |
|---|---|---|
| This workspace | `git status -sb` | Branch `claude/eloquent-archimedes-ysbyph`, HEAD `a5a042f`. Working tree clean, 0 untracked files, no stashes. VERIFIED |
| GitHub remote | `list_branches`, `list_commits`, `list_pull_requests` | `main` is the only branch, at `a5a042f`. It is not protected. There are no PRs. VERIFIED |
| `c04011d` | `git cat-file -t`; GitHub `get_commit` | Does not exist locally or on GitHub ("No commit found"). VERIFIED |
| Last commit | `a5a042f` | Claude Opus, 2026-11-09, "WIP: v2 labs in progress". 48 commits in total. VERIFIED |
| Tracked files | `git ls-files` | 256 files; `.git` is 38 MB. VERIFIED |
| Stack pins | `remotion/package.json` | Remotion 4.0.290, three 0.175.0, @react-three/fiber 9.1.2, React 19.0.0, TypeScript 5.8.3. Matches the v2.2 spec. VERIFIED |
| Toolchain here | `node -v`, `python3 --version`, `ffmpeg -version` | Node 22.23.4, Python 3.13.18, ffmpeg 6.1.1. `node_modules` absent. VERIFIED |

## 3. GLM's claims versus the repository

| GLM-reported item | Found here | Status |
|---|---|---|
| Local commit `c04011d` (12 files: REV lab and fonts) | Absent | Unverifiable |
| `remotion/src/lab/subtitles/rev/` (approved design source) | 0 files in HEAD | Not present; the only copy was in `c04011d` |
| Uncommitted edits to `Root.tsx` and `RatShort.tsx` (`RatShortSubbed`, `subtitles` prop) | `Root.tsx` registers only `SmokeTest` and `RatShort`; `RatShort` takes no props | Not present |
| Untracked `remotion/src/subtitles/` (8 files), `videos/rat/subs.ts`, `remotion/public/fonts/` | None exist | Not present |
| `docs/audits/`, `docs/RULINGS_C3_C4_DRAFT.md`, `docs/GLM_TECHNICAL_REPOSITORY_HANDOFF.md` | None exist | Not present |
| `remotion/out/` (~1.5 GB evidence), `remotion/rtmp_eval/` (439 MB) | None exist (gitignored, never pushed) | Not present |
| `remotion/src/lab/paper-int/` | Absent | Not present |
| Opus's `a5a042f` was the last push; nothing pushed by GLM | GitHub `main` = `a5a042f` | VERIFIED |

**Not verified at all:** subtitle correctness, Gate A/B results, "bit-identical" renders, the WebGL verdict, and all numeric evidence. These live in the missing `remotion/out/` tree.

**Shared Claude Code session link:** not read. This audit used the uploaded documents and the repository only.

## 4. Verified contradictions

1. **Style authority.**
   - `CLAUDE.md` line 42 says "Every video uses the Fail-Safe Files signature style".
   - Its own header says `docs/MASTER_INSTRUCTIONS.md` wins, and that file says Paper Case-File is the chosen direction.
   - `docs/QUALITY_PLAYBOOK.md` line 6 also leads with Fail-Safe Files.
   - The handoff says Fail-Safe is a supporting technique only. Not yet reconciled.
2. **Character.**
   - The v2.2 spec says Gus (Option A).
   - `docs/MASTER_INSTRUCTIONS.md` says keep Rafa and Noor.
   - Gus code is in `remotion/src/lab/paper-v2/gus/`. Rafa/Noor code is in `remotion/src/lab/hybrid/`.
   - The repository does not settle this (the C-2 question).
3. **Subtitle band, four different values.**
   - `CLAUDE.md`: y 1050–1350.
   - `docs/REFERENCE.md`: 1100–1300, plus an ASS position of 1180.
   - Committed v1 lab (`remotion/src/lab/subtitles/layout.ts:4`): 1250–1450.
   - Handoff "approved" band: 1250–1450, X 150–930.
   - C-3 (captions default-on or opt-in) and C-4 (ratify the band) are open.
4. **Default captions.** `CLAUDE.md` says no burned-in captions by default; `MASTER_INSTRUCTIONS.md` asks for expressive subtitles. They conflict until C-3 is decided.
5. **Environment drift.** GLM used Node 24, Python 3.8, ffmpeg 7.0.2. This workspace has Node 22, Python 3.13, ffmpeg 6.1.1. GLM's py3.8 pins (numpy 1.24.4 etc.) will not apply as written.

## 5. Completed work (committed; verified by file presence only)

- **Video #1, "The Plane's Secret Windmill".**
  - `videos/01_ram_air_turbine/` holds `SCRIPT.md`, `SHOTLIST.md`, VO takes and `words.json`, 58 raw SFX files, `mix.py`, `finish.sh`, and `mix/mix_master.flac` (58.5 s, confirmed by `ffprobe`).
  - No final rendered video is tracked. The only tracked mp4 is the 728 KB clip `remotion/src/lab/subtitles/public/backdrops/motion.mp4`.
- **Remotion/three.js scene:** `remotion/src/videos/rat/` (1,393 lines of TS/TSX). `RatShort` and `SmokeTest` are registered in `Root.tsx`.
- **Brand audio:** `assets/brand/` holds three distinct files (`alarm_meter`, `intro_blueprint`, `safety_clunk`); the SHA-256 hashes differ.
- **Documentation:** `MASTER_INSTRUCTIONS.md`, `QUALITY_PLAYBOOK.md`, `REFERENCE.md`, five research notes in `docs/research/`, and `docs/lab/` (briefs, art and tech reviews, per-concept notes).
- **Scripts:** the 8 Python files (`scripts/`, `vo/`, `film/render.py`, `remotion/scripts/sheet.py`) all parse. This is a syntax check only, not a functional test.
- **Labs (experiments, tracked TS/TSX lines):** hybrid 7,239; paper-v2 2,599; toy 2,382; noir 1,711; paper 1,641; engraving 1,400; subtitles 562.
- **Hygiene:** a pattern scan found no secrets, and there are no TODO/FIXME markers.

## 6. Unfinished or unverified work

- **Subtitle system:** GLM reports it as production-integrated and verified, but none of it exists here.
- **Paper Case-File refinement:** the v2 labs are partly done. The handoff gives Gus about 25% and World & Look about 5%. The 15-item fix list from the 5.1/10 hybrid test was never confirmed as applied.
- **Gus:** not integrated into production; camera-responsive lean is unverified.
- **GLM's Paper Case-File audit:** the weakness list, improvement plan and risk/cost assessment were never written.
- **Scheduled-task layer:** nothing exists. There is no `production-intelligence/` folder, master-learnings file or experiment registry.
- **Open decisions:** C-2, C-3, C-4.
- **Preset/config layer:** the spec's core preset, `project.yaml` and project initializer are not implemented. Only `.claude/commands/new-video.md` exists.
- **Final render and QA:** no final video is in the repository, so visual and audio QA of the actual output could not be done.

## 7. Problems and risks

1. **Critical: possible total loss of GLM's work.** The subtitle module, `rev` lab and fonts, evidence tree and audit documents exist only on GLM's device.
2. **`main` is unprotected**, and the handoff indicates GLM attempted or planned pushes to `main`.
3. **WebGL verdict is unverified.** The claim that no GPU shader can execute is specific to GLM's sandbox. It should be re-tested on this hardware before the 3D pipeline is declared blocked. `CLAUDE.md` notes software rendering costs roughly 0.3 to 5 s per frame.
4. **Remotion 4.0.290 `renderStill` ignores `inputProps`** (GLM-reported, not reproduced). If true, prop-driven stills are misleading.
5. **Large binaries in git:** `mix_master.flac` (about 10 MB), `vo.wav` (about 8 MB) and about 58 SFX MP3s. Acceptable now, but history only grows.
6. **Documentation sprawl:** four overlapping style/spec documents with the contradictions in section 4.
7. **Stale remote-tracking ref:** `origin/claude/eloquent-archimedes-ysbyph` appears in local `git branch -a`, but GitHub lists only `main`. Cause unknown.
8. **vidIQ and ElevenLabs:** the MCP tools appear available, but no calls were made, so permissions and credits are unverified.

## 8. Preserve

- Everything in `videos/01_ram_air_turbine/` (finalized script, VO and mix).
- `assets/brand/*.mp3` (fixed brand sounds).
- All of `remotion/src/lab/*` and `docs/lab/*` (archived experiments, per the master instructions).
- `remotion/package.json` and `remotion/package-lock.json` pins.
- `docs/MASTER_INSTRUCTIONS.md` and the three v2.2 governing documents.
- When GLM's work is retrieved: `rev/`, the subtitle module, fonts, all `verification.json` files, `p33_audit.json`, `GL_FLAGS_DIAG.md`, `REVISION_NOTES.md` files and contact sheets.

## 9. Recommended cleanup (nothing performed)

- **This clone:** do not delete anything. Repo-level cleanup is mostly reconciling documents.
- **Removal candidates (all in GLM's environment, only after retrieval is confirmed):**
  - `remotion/rtmp_eval/` (439 MB webpack cache)
  - `remotion/node_modules/.remotion/chrome-full/`
  - `remotion/out/subtitles/` (invalid P2 v1 renders)
  - `remotion/out/p33_gateC/` (superseded)
  - duplicate render sets in `remotion/out/p32_gateB/`
  - `remotion/src/subtitles/__probe__/`
  - Each needs its purpose and references checked and a rollback path stated before removal.
- **Consolidation candidate:** reconcile `CLAUDE.md`, `QUALITY_PLAYBOOK.md` and `MASTER_INSTRUCTIONS.md` into one style authority, after the user decides C-2/C-3/C-4.

## 10. Prioritized action plan

| # | Action | Class | Reason and risk |
|---|---|---|---|
| 1 | Get GLM's work out of its sandbox (`git bundle` of `c04011d`, the working tree, and `remotion/out/` evidence, by zip or upload). | NEEDS MY APPROVAL | Highest value and time-sensitive. It must happen on GLM's side; this session cannot reach it. |
| 2 | Import the retrieved work onto a separate branch, not `main`. | NEEDS MY APPROVAL | Protects both accounts' work. |
| 3 | Enable branch protection on `main`. | NEEDS MY APPROVAL | GitHub setting only the owner can change. Low risk. |
| 4 | Decide C-2 (Gus vs Rafa/Noor), C-3 (captions default) and C-4 (subtitle band). | NEEDS MY APPROVAL | Downstream work depends on these. |
| 5 | Reconcile the `CLAUDE.md` and playbook style text with the Paper Case-File decision. | FIX (after #4) | Low risk; the wrong style authority is re-read every session. |
| 6 | Run `npm ci`, `tsc --noEmit`, a 1-frame render, then a WebGL smoke test on this hardware. | NEEDS MY APPROVAL | First real evidence the pipeline renders. `npm ci` only, to keep the lockfile pins. |
| 7 | Render `RatShort` fully and inspect it for post-render learning capture. | COMPLETE (after #6) | No final video is tracked; visual quality cannot be judged today. |
| 8 | Re-implement or import the subtitle system, then re-run the Gate A/B identity checks. | COMPLETE (after #2) | Prefer recovering GLM's code over rewriting. |
| 9 | Create `production-intelligence/` and the scheduled tasks one at a time. | COMPLETE (later) | The playbook says to prove read-only access first. |
| 10 | Remove the candidates listed in section 9. | REMOVE (after #1–2) | Verify retrieval first. |

## 11. Practical tasks while the main account cools down

Documentation-only unless marked.

- **A.** Draft a decision memo for C-2, C-3 and C-4 with options and a recommendation.
- **B.** Draft the reconciled style-authority section for `CLAUDE.md` as a proposal file only.
- **C.** Write a read-only retrieval checklist for GLM's device (exact commands and file list) to support action 1.
- **D.** Do the Paper Case-File Stage 1/2 audit from committed code and docs: weakness list, ranked gap analysis and improvement plan, clearly labelled as not render-validated.
- **E.** Draft the `production-intelligence/` structure and the three scheduled-task prompts as proposals only.
- **F.** After approval of installs: `npm ci`, `tsc`, a 1-frame render, and a WebGL smoke test on this hardware.

**Suggested first step:** actions 1 and 4 on the user's side, then A, D and F.

## 12. Limits of this audit

- No code was type-checked, run or rendered.
- No images, renders or audio were visually or audibly inspected. Visual quality is unassessed.
- GLM's claims are treated as GLM-reported unless a repository file confirms them.
- The shared Claude Code session link was not accessed.
- vidIQ and ElevenLabs integrations were not called, so access and credits are unknown.
- This workspace is a fresh clone. It may not reflect any state that exists only on another device.
