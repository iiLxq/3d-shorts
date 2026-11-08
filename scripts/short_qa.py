"""Automated QA for a finished Short (QUALITY_PLAYBOOK §1.2).

python3 -I scripts/short_qa.py final.mp4 outdir [shot_bounds_seconds_comma_list] [planned_events_seconds_comma_list]

Reports: specs, loudness (EBU R128 I / LRA / true peak), black frames (mean luma < 0.04),
unplanned white frames (> 0.93), frozen spans (>= 12 frames with almost no change),
pops (frame-diff spike > 3x local median that is not near a planned cut/flash),
per-shot luma/sat medians, first-vs-last frame difference (loop), 2 s contact sheets.
"""
import json, os, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw

src, out = sys.argv[1], sys.argv[2]
bounds = [float(x) for x in sys.argv[3].split(",")] if len(sys.argv) > 3 and sys.argv[3] else []
planned = [float(x) for x in sys.argv[4].split(",")] if len(sys.argv) > 4 and sys.argv[4] else []
os.makedirs(out, exist_ok=True)

probe = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", src], capture_output=True, text=True).stdout)
v = next(s for s in probe["streams"] if s["codec_type"] == "video")
a = next((s for s in probe["streams"] if s["codec_type"] == "audio"), None)
W, H = 270, 480  # analysis size
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-vf", f"scale={W}:{H}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3).astype(np.float32) / 255
n = len(fr); fps = eval(v["r_frame_rate"])
luma = (0.2126 * fr[..., 0] + 0.7152 * fr[..., 1] + 0.0722 * fr[..., 2])
mean = luma.reshape(n, -1).mean(1)
mx = fr.max(-1); mn = fr.min(-1); sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0).reshape(n, -1).mean(1)
diff = np.r_[0, np.abs(np.diff(luma, axis=0)).reshape(n - 1, -1).mean(1)]

near = lambda f, ts, tol=2: any(abs(f - t * fps) <= tol for t in ts)
black = [i for i in range(n) if mean[i] < 0.04]
white = [i for i in range(n) if mean[i] > 0.93 and not near(i, planned, 12)]
frozen, run = [], 0
for i in range(1, n):
    run = run + 1 if diff[i] < 0.0008 else 0
    if run == 12: frozen.append(i - 11)
pops = []
for i in range(2, n - 2):
    loc = np.median(diff[max(1, i - 15):i + 15]) + 1e-4
    if diff[i] > 3 * loc and diff[i] > 0.02 and not near(i, bounds + planned, 2): pops.append(i)
loop = float(np.abs(fr[0] - fr[-1]).mean())

ld = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", src, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
summ = ld[ld.rfind("Summary:"):]
pick = lambda key: next((l.split(":")[1].strip() for l in summ.splitlines() if l.strip().startswith(key + ":")), "?")

# 2 s contact sheets (60 frames, 10x6) with frame numbers
cols, rows, tw, th = 10, 6, 108, 192
for s0 in range(0, n, 60):
    S = Image.new("RGB", (cols * tw, rows * th), "black"); d = ImageDraw.Draw(S)
    for k in range(60):
        i = s0 + k
        if i >= n: break
        im = Image.fromarray((fr[i] * 255).astype(np.uint8)).resize((tw, th))
        x, y = (k % cols) * tw, (k // cols) * th; S.paste(im, (x, y)); d.text((x + 3, y + 2), str(i), fill=(255, 210, 0))
    S.save(os.path.join(out, f"sheet_{s0 // 60:02d}.jpg"), quality=80)

shots = []
edges = [0] + [round(b * fps) for b in bounds] + [n]
for k in range(len(edges) - 1):
    sl = slice(edges[k], max(edges[k] + 1, edges[k + 1]))
    shots.append((k + 1, round(float(np.median(mean[sl])), 3), round(float(np.median(sat[sl])), 3)))

rep = {
    "file": src, "size": f'{v["width"]}x{v["height"]}', "fps": v["r_frame_rate"], "frames": n,
    "duration": float(probe["format"]["duration"]), "vcodec": v["codec_name"], "pix_fmt": v.get("pix_fmt"),
    "acodec": a["codec_name"] if a else None, "arate": a["sample_rate"] if a else None,
    "loudness_I": pick("I"), "LRA": pick("LRA"), "true_peak": pick("Peak"),
    "black_frames": black[:20], "n_black": len(black), "unplanned_white": white[:20], "frozen_spans": frozen,
    "pops": pops, "loop_first_last_mean_abs_diff": round(loop, 4), "shots(n, luma_med, sat_med)": shots,
}
json.dump(rep, open(os.path.join(out, "qa.json"), "w"), indent=1)
for k, val in rep.items():
    if k != "shots(n, luma_med, sat_med)": print(f"{k}: {val}")
print("shots:", shots)
