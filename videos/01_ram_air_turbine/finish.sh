#!/bin/bash
# Finish "The Plane's Secret Windmill": film grain on the sepia section only, mux the master mix,
# make the phone copy (~18-19 MB), then run QA.  Run from the repo root.
set -euo pipefail
V=videos/01_ram_air_turbine
RAW0=remotion/out/rat/video_raw.mp4
F=remotion/out/rat/fix
OUT=$V/out; mkdir -p "$OUT"
RAW=$OUT/video_spliced.mp4
# 0) splice the re-rendered frame ranges into the first full render (frame-exact)
if [ -f "$F/seg_1610-1754.mp4" ]; then
  ffmpeg -v error -y -i "$F/seg_0-71.mp4" -i "$RAW0" -i "$F/seg_360-437.mp4" -i "$F/seg_1439-1609.mp4" -i "$F/seg_1610-1754.mp4" -filter_complex \
"[1:v]trim=start_frame=72:end_frame=360,setpts=PTS-STARTPTS[r1];[1:v]trim=start_frame=438:end_frame=1439,setpts=PTS-STARTPTS[r2];\
[0:v][r1][2:v][r2][3:v][4:v]concat=n=6:v=1:a=0[v]" -map "[v]" -c:v libx264 -crf 12 -preset veryfast -pix_fmt yuv420p -r 30 "$RAW"
else cp "$RAW0" "$RAW"; fi
echo "spliced frames: $(ffprobe -v error -count_frames -select_streams v -show_entries stream=nb_read_frames -of csv=p=0 "$RAW")"
# 1) grain only in the history section (37.95-53.65 s), re-encode once at high quality
ffmpeg -v error -y -i "$RAW" -i "$V/mix/mix_master.flac" \
  -filter_complex "[0:v]noise=alls=5:allf=t:enable='between(t,37.95,53.65)',format=yuv420p[v]" \
  -map "[v]" -map 1:a -c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p -r 30 \
  -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart "$OUT/plane_windmill_full.mp4"
# 2) phone copy: 2-pass H.264 ~2.3 Mbps + AAC 128k, 1080x1920 kept
ffmpeg -v error -y -i "$OUT/plane_windmill_full.mp4" -c:v libx264 -b:v 2300k -preset slow -pass 1 -passlogfile "$OUT/pass" -an -f mp4 /dev/null
ffmpeg -v error -y -i "$OUT/plane_windmill_full.mp4" -c:v libx264 -b:v 2300k -preset slow -pass 2 -passlogfile "$OUT/pass" \
  -c:a aac -b:a 128k -movflags +faststart "$OUT/plane_windmill_phone.mp4"
rm -f "$OUT"/pass* "$RAW"
ls -la "$OUT"
# 3) QA
B=2.4,5.1,8.1,12.0,14.6,15.95,19.8,21.15,22.9,24.05,26.0,28.15,28.65,30.25,33.2,34.35,37.95,41.0,43.45,45.5,47.95,51.2,53.65
P=1.85,13.92,15.39,22.97,23.5,25.16,28.15,29.5,37.95,38.22,44.73,53.65,57.45
python3 -I scripts/short_qa.py "$OUT/plane_windmill_full.mp4" "$OUT/qa" "$B" "$P"
