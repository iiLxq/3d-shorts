#!/bin/sh
# Rebuild the chunk list for video 01. Run from remotion/.
set -e
D=src/lab/subtitles
npx esbuild $D/cli/make-chunks.ts --bundle --platform=node --format=esm --outfile=${TMPDIR:-/tmp}/mk.mjs --log-level=error
node ${TMPDIR:-/tmp}/mk.mjs ../videos/01_ram_air_turbine/SCRIPT.md ../videos/01_ram_air_turbine/vo/words.json $D/data/video01.chunks.json ../docs/lab/subtitles/chunks_video01.txt $D/data/video01.overrides.json
