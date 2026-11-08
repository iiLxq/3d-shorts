#!/bin/bash
# Finish "The Plane's Secret Windmill": film grain on the sepia section only, mux the master mix,
# make the phone copy (~18-19 MB), then run QA.  Run from the repo root.
set -euo pipefail
V=videos/01_ram_air_turbine
RAW=remotion/out/rat/video_raw.mp4
OUT=$V/out; mkdir -p "$OUT"
# 1) grain only in the history section (37.95-53.65 s), re-encode once at high quality
ffmpeg -v error -y -i "$RAW" -i "$V/mix/mix_master.flac" \
  -filter_complex "[0:v]noise=alls=9:allf=t:enable='between(t,37.95,53.65)',format=yuv420p[v]" \
  -map "[v]" -map 1:a -c:v libx264 -crf 16 -preset slow -pix_fmt yuv420p -r 30 \
  -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart "$OUT/plane_windmill_full.mp4"
# 2) phone copy: 2-pass H.264 ~2.3 Mbps + AAC 128k, 1080x1920 kept
ffmpeg -v error -y -i "$OUT/plane_windmill_full.mp4" -c:v libx264 -b:v 2300k -preset slow -pass 1 -passlogfile "$OUT/pass" -an -f mp4 /dev/null
ffmpeg -v error -y -i "$OUT/plane_windmill_full.mp4" -c:v libx264 -b:v 2300k -preset slow -pass 2 -passlogfile "$OUT/pass" \
  -c:a aac -b:a 128k -movflags +faststart "$OUT/plane_windmill_phone.mp4"
rm -f "$OUT"/pass*
ls -la "$OUT"
# 3) QA
B=2.4,5.1,8.1,12.0,14.6,15.95,19.8,21.15,22.9,24.05,26.0,28.15,28.65,30.25,33.2,34.35,37.95,41.0,43.45,45.5,47.95,51.2,53.65
P=1.85,13.92,22.97,25.16,28.15,37.95,38.22,44.73,53.65,57.25
python3 -I scripts/short_qa.py "$OUT/plane_windmill_full.mp4" "$OUT/qa" "$B" "$P"
