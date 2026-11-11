#!/bin/sh
# Run from remotion/.
set -e
D=src/lab/subtitles
npx esbuild $D/cli/validate.ts --bundle --platform=node --format=esm --outfile=$D/cli/.validate.mjs --log-level=error
node $D/cli/.validate.mjs ../videos/01_ram_air_turbine/SCRIPT.md ../videos/01_ram_air_turbine/vo/words.json $D/data/video01.chunks.json
