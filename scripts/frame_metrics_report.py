"""Side-by-side table of frame_metrics.py runs: the delta is the to-do list.

  python3 -I scripts/frame_metrics_report.py <outdirA> <outdirB> [more...] [--md out.md]

Column 1 is "ours"; the last column is (A - B) / |B| for numbers where both exist.
"""
import json, math, os, sys

KEYS = [
    ("luma_p50", "median luma"), ("luma_p5", "luma p5 (black lift)"), ("luma_p99", "luma p99 (near-whites)"),
    ("contrast_rms", "RMS contrast"), ("contrast_p95_p5", "p95-p5 range"), ("pct_black", "% near-black <16"),
    ("pct_clip", "% clipped >245"), ("sat_mean", "HSV sat mean"), ("sat_p90", "HSV sat p90"),
    ("colorfulness", "colourfulness (H-S)"), ("chroma_lit_p50", "lit chroma C* p50"), ("chroma_lit_p90", "lit chroma C* p90"),
    ("shadow_b", "shadow b* (+warm/-cool)"), ("hi_b", "highlight b*"), ("shadow_hue", "shadow hue deg"), ("hi_hue", "highlight hue deg"),
    ("ink_density", "dark ink-line density"), ("bright_line_density", "bright-line density"), ("edge_density", "edge density"),
    ("sharp_centre", "Laplacian var centre"), ("sharp_periph", "Laplacian var periphery"), ("sharp_ratio", "centre/periph sharpness"),
    ("texture_energy", "surface texture energy"), ("surface_frac", "surface fraction"), ("empty_frac", "empty (flat) 16px blocks"), ("vignette", "vignette corner/centre"),
    ("noise_sigma", "noise sigma"),
    ("pct_moving_any", "% frames camera/field moving"), ("pct_any_motion", "% frames any region moving"), ("pct_move", "% frames in a move"), ("speed_peak", "peak speed px720/f"),
    ("zoom_quiet_p50_pct", "push-in in quiet frames %/f"), ("jerk_rms", "RMS jerk"), ("jerk_per_speed", "jerk / speed"),
    ("cuts_per_10s", "hard cuts per 10 s"),
]


def fmt(v):
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return "-"
    return f"{v:.3f}" if abs(v) < 10 else f"{v:.1f}"


def main():
    args = sys.argv[1:]
    md = None
    if "--md" in args:
        i = args.index("--md"); md = args[i + 1]; del args[i:i + 2]
    runs = [json.load(open(os.path.join(d, "summary.json")))["overall"] for d in args]
    hdr = ["metric"] + [r.get("label", "?") for r in runs] + (["delta A vs B"] if len(runs) >= 2 else [])
    L = ["| " + " | ".join(hdr) + " |", "|" + "---|" * len(hdr)]
    for k, name in KEYS:
        vals = [r.get(k) for r in runs]
        if all(v is None for v in vals):
            continue
        row = [name] + [fmt(v) for v in vals]
        if len(runs) >= 2:
            a, b = vals[0], vals[1]
            ok = isinstance(a, (int, float)) and isinstance(b, (int, float)) and not (math.isnan(a) or math.isnan(b)) and abs(b) > 1e-9
            row.append(f"{(a - b) / abs(b) * 100:+.0f} %" if ok else "-")
        L.append("| " + " | ".join(row) + " |")
    out = "\n".join(L) + "\n"
    print(out)
    if md:
        open(md, "w").write(out)


if __name__ == "__main__":
    main()
