#!/bin/sh
# Renders font-comparison stills (1080) then call cli/sheet.py. Run from remotion/. usage: fontboard.sh <outDir>
set -e
O=$1
for f in montserrat-xb montserrat-black archivo-black barlow-sc-bold poppins-xb; do
  node src/lab/subtitles/cli/stills.mjs SubFontCell $O 1 20 "{\"font\":\"$f\",\"text\":\"what saves you.\",\"emph\":true,\"tone\":\"safe\",\"backdrop\":2}" >/dev/null
  mv $O/SubFontCell_${f}_0020.png $O/fa_$f.png
  node src/lab/subtitles/cli/stills.mjs SubFontCell $O 1 20 "{\"font\":\"$f\",\"text\":\"No serious injuries.\",\"emph\":false,\"tone\":\"white\",\"backdrop\":3}" >/dev/null
  mv $O/SubFontCell_${f}_0020.png $O/fb_$f.png
done
