"""Frame metrics: measure a Short (or a folder of stills) with numbers, not opinions.

  python3 -I scripts/frame_metrics.py <video_or_frame_dir> <outdir> [--fps 30] [--label name]
        [--bounds 2.4,5.1,...]      shot boundaries in seconds (default: detected hard cuts)
        [--stills]                  treat a frame folder as unrelated stills (no motion, no shots)
        [--width 270]               analysis width (height keeps the aspect); 270x480 is light
        [--mask-band 1300,1412]     rows to ignore, in 1920-high coordinates (e.g. burned-in captions)
        [--sheets | --no-sheets]    2 s contact sheets (60 frames, 10x6). Default on for video.
        [--onesheet 60]             thumbs on the compact one-sheet (evenly spaced over the video)
  python3 -I scripts/frame_metrics.py --selftest <outdir>   synthetic zoom/pan/cut test + accuracy

Writes <outdir>/frames.csv (per frame), shots.csv, summary.json, report.md, sheets/*.jpg, onesheet.jpg.
Compare two runs (ours vs reference): python3 -I scripts/frame_metrics_report.py <outA> <outB> ...

Units. Motion is in px at 720 px frame width ("px720", same unit as QUALITY_PLAYBOOK §1.1/§3; x1.5 for
1080p) per frame; zoom in % per frame (+ = push in / content grows); roll in degrees per frame.
Camera motion = robust similarity fit (tx, ty, zoom, roll) to sub-pixel phase correlation (upsampled DFT,
1/20 px) of 12 tiles, done on frame pairs at lag 1 AND lag 6. Slow pushes/drifts that are sub-pixel per
frame are taken from the lag-6 fit (6x the signal), so a 0.1 %/f push is not reported as "still".
A Fourier-Mellin (log-polar) zoom estimate on the lag-6 pair is written as a cross-check (zoom_lp_pct).
Speed = RMS of the fitted flow field over the frame. Classes: hold < 0.3, drift < 2, move >= 2 px720/f.
Smoothed with a Gaussian (sigma 1.2 f) inside shots; acceleration and jerk are its 1st/2nd differences.

Image metrics (luma Y' = Rec.709 weights on sRGB values, 0..1): mean, p1/p5/p50/p95/p99, RMS contrast
(std) and p95-p5, % near-black (8-bit luma < 16) and clipped (> 245), HSV saturation mean/p90,
Hasler-Suesstrunk colourfulness, Lab a*/b*/hue/chroma of shadows (luma < frame p20) vs highlights (> p80),
k-means (k=6) palette per shot and overall, ink density (dark thin lines: black top-hat > 0.12 and
Y' < 0.30), bright-line density (white top-hat > 0.12, e.g. blueprint lines), edge density (gradient
> 0.08), Laplacian variance centre vs periphery (DOF proxy), texture energy in surface regions
(band-pass |DoG(1,3)| away from edges, x255), vignette (corner / centre luma), grain/noise sigma
(Immerkaer, flat regions, x255; needs --width >= 540 to see fine grain).
"""
import argparse, csv, glob, json, math, os, subprocess, sys

for _v in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS"):
    os.environ.setdefault(_v, "1")  # light on shared machines: one core
import numpy as np
from scipy import ndimage as ndi
from scipy.cluster.vq import kmeans2
from PIL import Image, ImageDraw

LAG = 6
HOLD, DRIFT = 0.3, 2.0
IMG_EXT = (".jpg", ".jpeg", ".png", ".webp", ".bmp")


# ----------------------------------------------------------------------------- input
def probe(src):
    p = json.loads(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_streams",
                                   "-show_format", "-of", "json", src], capture_output=True, text=True).stdout)
    s = p["streams"][0]
    num, den = s["r_frame_rate"].split("/")
    return int(s["width"]), int(s["height"]), float(num) / float(den), float(p["format"].get("duration", 0))


def iter_video(src, W, H):
    cmd = ["ffmpeg", "-v", "error", "-i", src, "-vf",
           f"scale={W}:{H}:flags=area+accurate_rnd+full_chroma_int:in_color_matrix=bt709:out_range=pc",
           "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    pr = subprocess.Popen(cmd, stdout=subprocess.PIPE)
    n = W * H * 3
    while True:
        b = pr.stdout.read(n)
        if len(b) < n:
            break
        yield np.frombuffer(b, np.uint8).reshape(H, W, 3)
    pr.wait()


def iter_dir(paths, W, H):
    for p in paths:
        yield np.asarray(Image.open(p).convert("RGB").resize((W, H), Image.BOX))


# ----------------------------------------------------------------------------- colour helpers
def luma(rgb):
    return 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]


def srgb_to_lab(rgb):
    c = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ M.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def hexcol(c):
    c = np.clip(np.round(np.asarray(c) * 255), 0, 255).astype(int)
    return "#%02X%02X%02X" % tuple(c)


# ----------------------------------------------------------------------------- still metrics
class StillMetrics:
    def __init__(self, W, H, keep_rows):
        self.W, self.H, self.keep = W, H, keep_rows  # keep: bool per row
        self.k = max(3, int(round(7 * W / 540)) | 1)
        yy, xx = np.mgrid[0:H, 0:W]
        cx, cy = (xx - W / 2) / W, (yy - H / 2) / H
        self.centre = (np.abs(cx) < 0.2) & (np.abs(cy) < 0.2) & keep_rows[:, None]
        self.periph = ((np.abs(cx) > 0.35) | (np.abs(cy) > 0.35)) & keep_rows[:, None]
        cw = ch = max(2, int(0.12 * W))  # square corner patches, 12 % of the width
        cm = np.zeros((H, W), bool)
        for ys in (slice(0, ch), slice(H - ch, H)):
            for xs in (slice(0, cw), slice(W - cw, W)):
                cm[ys, xs] = True
        self.corner = cm & keep_rows[:, None]
        cc = np.zeros((H, W), bool)
        cc[int(H * 0.35):int(H * 0.65), int(W * 0.35):int(W * 0.65)] = True
        self.cbox = cc & keep_rows[:, None]
        self.mask = np.repeat(keep_rows[:, None], W, 1)

    def __call__(self, u8):
        rgb = u8.astype(np.float32) / 255
        m = self.mask
        Y = luma(rgb)
        y = Y[m]
        q = np.percentile(y, [1, 5, 20, 50, 80, 95, 99])
        y8 = luma(u8.astype(np.float32))[m]
        mx, mn = rgb.max(-1), rgb.min(-1)
        S = np.where(mx > 1e-6, (mx - mn) / np.maximum(mx, 1e-6), 0)[m]
        R, G, B = (u8[..., i].astype(np.float32)[m] for i in range(3))
        rg, yb = R - G, 0.5 * (R + G) - B
        colorful = math.hypot(rg.std(), yb.std()) + 0.3 * math.hypot(rg.mean(), yb.mean())
        lab = srgb_to_lab(rgb)[m]
        d = {}
        for name, sel in (("shadow", y <= q[2]), ("hi", y >= q[4])):
            a, b = lab[sel, 1].mean(), lab[sel, 2].mean()
            d[f"{name}_a"], d[f"{name}_b"] = a, b
            d[f"{name}_hue"] = math.degrees(math.atan2(b, a)) % 360
            d[f"{name}_chroma"] = math.hypot(a, b)
        chroma = np.hypot(lab[:, 1], lab[:, 2])
        lit = y > q[3]
        # lines / edges
        k = self.k
        clos = ndi.grey_closing(Y, size=(k, k))
        opn = ndi.grey_opening(Y, size=(k, k))
        ink = ((clos - Y) > 0.12) & (Y < 0.30)
        bright = (Y - opn) > 0.12
        gm = np.hypot(ndi.sobel(Y, 0), ndi.sobel(Y, 1)) / 8
        edge = gm > 0.08
        lap = ndi.laplace(ndi.gaussian_filter(Y, 0.5))
        sc, sp = lap[self.centre].var(), lap[self.periph].var()
        # texture energy in surface regions (away from edges, not black)
        near_edge = ndi.binary_dilation(edge, iterations=2)
        surf = m & ~near_edge & (Y > 0.06)
        dog = ndi.gaussian_filter(Y, 1.0) - ndi.gaussian_filter(Y, 3.0)
        tex = float(np.abs(dog[surf]).mean() * 255) if surf.sum() > 200 else float("nan")
        # Immerkaer noise in flat regions
        Mk = np.array([[1, -2, 1], [-2, 4, -2], [1, -2, 1]], np.float32)
        conv = np.abs(ndi.convolve(Y, Mk))
        flat = surf & (gm < 0.02)
        noise = float(math.sqrt(math.pi / 2) / 6 * conv[flat].mean() * 255) if flat.sum() > 200 else float("nan")
        # empty frame: share of 16 px blocks (at 1080 wide) with almost no variation (flat bg, sky, void)
        bs = max(4, int(round(16 * self.W / 1080)))
        hb, wb = self.H // bs, self.W // bs
        blk = Y[:hb * bs, :wb * bs].reshape(hb, bs, wb, bs).std(axis=(1, 3))
        bkeep = self.keep[:hb * bs].reshape(hb, bs).all(1)
        empty = float((blk[bkeep] < 0.008).mean()) if bkeep.any() else float("nan")
        d.update(
            empty_frac=empty,
            luma_mean=float(y.mean()), luma_p1=q[0], luma_p5=q[1], luma_p50=q[3], luma_p95=q[5], luma_p99=q[6],
            contrast_rms=float(y.std()), contrast_p95_p5=q[5] - q[1],
            pct_black=float((y8 < 16).mean() * 100), pct_clip=float((y8 > 245).mean() * 100),
            sat_mean=float(S.mean()), sat_p90=float(np.percentile(S, 90)), colorfulness=colorful,
            chroma_lit_p50=float(np.percentile(chroma[lit], 50)) if lit.any() else 0.0,
            chroma_lit_p90=float(np.percentile(chroma[lit], 90)) if lit.any() else 0.0,
            ink_density=float(ink[m].mean()), bright_line_density=float(bright[m].mean()),
            edge_density=float(edge[m].mean()),
            sharp_centre=float(sc * 1e3), sharp_periph=float(sp * 1e3), sharp_ratio=float(sc / max(sp, 1e-9)),
            texture_energy=tex, surface_frac=float(surf[m].mean()),
            vignette=float(Y[self.corner].mean() / max(Y[self.cbox].mean(), 1e-4)),
            noise_sigma=noise,
        )
        return {k_: float(v) for k_, v in d.items()}


# ----------------------------------------------------------------------------- motion
def hann2(h, w):
    return np.outer(np.hanning(h), np.hanning(w)).astype(np.float32)


class PhaseCorr:
    def __init__(self, h, w, ups=20):
        self.h, self.w, self.ups = h, w, ups
        self.win = hann2(h, w)
        self.fy = np.fft.fftfreq(h) * h
        self.fx = np.fft.fftfreq(w) * w
        fyy, fxx = np.meshgrid(np.fft.fftfreq(h), np.fft.fftfreq(w), indexing="ij")
        self.lp = np.exp(-(fyy ** 2 + fxx ** 2) / (2 * 0.25 ** 2))  # soft low-pass on the phase

    def spec(self, a):
        a = a - a.mean()
        return np.fft.fft2(a * self.win)

    def shift(self, A, B):
        """Return (dy, dx, peak) with b(x) ~= a(x - d)."""
        X = B * np.conj(A)
        X = X / np.maximum(np.abs(X), 1e-9) * self.lp
        r = np.fft.ifft2(X).real
        i = np.unravel_index(np.argmax(r), r.shape)
        peak = r[i] / max(self.lp.mean(), 1e-9)
        cy = i[0] - self.h if i[0] > self.h // 2 else i[0]
        cx = i[1] - self.w if i[1] > self.w // 2 else i[1]
        n = int(3 * self.ups) + 1
        off = (np.arange(n) - n // 2) / self.ups
        ys, xs = cy + off, cx + off
        Ey = np.exp(2j * np.pi * np.outer(ys, self.fy) / self.h)
        Ex = np.exp(2j * np.pi * np.outer(self.fx, xs) / self.w)
        C = (Ey @ X @ Ex).real
        j = np.unravel_index(np.argmax(C), C.shape)
        return ys[j[0]], xs[j[1]], float(peak)


class Motion:
    """Similarity fit from 12 tiles of sub-pixel phase correlation."""

    def __init__(self, W, H, keep_rows):
        self.W, self.H = W, H
        tw, th = int(W * 0.30) // 2 * 2, int(H * 0.20) // 2 * 2
        self.pc = PhaseCorr(th, tw)
        self.tiles = []
        for fy in (0.14, 0.38, 0.62, 0.86):
            for fx in (0.2, 0.5, 0.8):
                x0, y0 = int(fx * W - tw / 2), int(fy * H - th / 2)
                x0, y0 = min(max(x0, 0), W - tw), min(max(y0, 0), H - th)
                if keep_rows[y0:y0 + th].all():
                    self.tiles.append((y0, x0, (x0 + tw / 2) - W / 2, (y0 + th / 2) - H / 2))
        self.tw, self.th = tw, th
        self.lpz = LogPolarZoom(W, H)

    def prep(self, gray):
        out = []
        for y0, x0, _, _ in self.tiles:
            t = gray[y0:y0 + self.th, x0:x0 + self.tw]
            hp = float((t - ndi.gaussian_filter(t, 2.0)).std())  # fine detail; flat gradients/sky ~0.001
            out.append((self.pc.spec(t), hp))
        return out

    def fit(self, pa, pb):
        rows = []
        for (A, sa), (B, sb), (_, _, px, py) in zip(pa, pb, self.tiles):
            if min(sa, sb) < 0.003:  # untextured tile: phase correlation would just say 0
                continue
            dy, dx, pk = self.pc.shift(A, B)
            if pk < 0.06:
                continue
            rows.append((px, py, dx, dy, pk))
        if len(rows) < 2:
            return None
        r = np.array(rows)
        p90 = float(np.percentile(np.hypot(r[:, 2], r[:, 3]), 90))  # fastest-moving content (subject), not the fit
        use = np.ones(len(r), bool)
        for _ in range(3):
            q = r[use]
            if len(q) >= 4:
                Am = np.zeros((2 * len(q), 4))
                Am[0::2] = np.c_[np.ones(len(q)), np.zeros(len(q)), q[:, 0], -q[:, 1]]
                Am[1::2] = np.c_[np.zeros(len(q)), np.ones(len(q)), q[:, 1], q[:, 0]]
                bv = np.empty(2 * len(q)); bv[0::2], bv[1::2] = q[:, 2], q[:, 3]
                w = np.repeat(np.sqrt(q[:, 4]), 2)
                p = np.linalg.lstsq(Am * w[:, None], bv * w, rcond=None)[0]
            else:
                p = np.array([np.median(q[:, 2]), np.median(q[:, 3]), 0.0, 0.0])
            px_, py_ = r[:, 0], r[:, 1]
            res = np.hypot(r[:, 2] - (p[0] + p[2] * px_ - p[3] * py_), r[:, 3] - (p[1] + p[2] * py_ + p[3] * px_))
            thr = max(0.6, 2.5 * np.median(res[use]))
            nu = res < thr
            if nu.sum() < 2 or (nu == use).all():
                break
            use = nu
        return dict(tx=p[0], ty=p[1], s=p[2], r=p[3], n=int(use.sum()), resid=float(np.median(res[use])), p90=p90)


class LogPolarZoom:
    """Fourier-Mellin zoom/rotation estimate on a centred square crop (cross-check only)."""

    def __init__(self, W, H, nr=256, na=256):
        n = 1 << int(math.log2(min(W, H)))
        self.n, self.y0, self.x0 = n, (H - n) // 2, (W - n) // 2
        self.win = hann2(n, n)
        f = np.fft.fftshift(np.fft.fftfreq(n))
        fy, fx = np.meshgrid(f, f, indexing="ij")
        c = np.cos(np.pi * fy) * np.cos(np.pi * fx)
        self.hp = (1 - c) * (2 - c)
        rmin, rmax = 2.0, n / 2 - 1
        self.dlog = math.log(rmax / rmin) / nr
        rad = rmin * np.exp(np.arange(nr) * self.dlog)
        ang = np.arange(na) * np.pi / na
        self.dang = 180.0 / na
        self.coords = np.array([n / 2 + np.outer(np.sin(ang), rad), n / 2 + np.outer(np.cos(ang), rad)])
        self.pc = PhaseCorr(na, nr)

    def prep(self, gray):
        g = gray[self.y0:self.y0 + self.n, self.x0:self.x0 + self.n]
        F = np.abs(np.fft.fftshift(np.fft.fft2((g - g.mean()) * self.win))) * self.hp
        lp = ndi.map_coordinates(np.log1p(F), self.coords, order=1)
        return self.pc.spec(lp)

    def zoom(self, A, B):
        da, dr, pk = self.pc.shift(A, B)
        return -dr * self.dlog, pk  # content grows -> spectrum shrinks -> negative log-r shift


# ----------------------------------------------------------------------------- analysis
def gauss_segments(x, segs, sigma=1.2):
    y = x.copy()
    for a, b in segs:
        if b - a >= 3:
            y[a:b] = ndi.gaussian_filter1d(x[a:b], sigma, axis=0, mode="nearest")
    return y


def analyse(args):
    src = args.input
    is_dir = os.path.isdir(src)
    if is_dir:
        paths = sorted(p for p in glob.glob(os.path.join(src, "*")) if p.lower().endswith(IMG_EXT))
        if not paths:
            sys.exit("no images in " + src)
        w0, h0 = Image.open(paths[0]).size
        fps, n_hint = args.fps, len(paths)
    else:
        w0, h0, fps_p, dur = probe(src)
        fps = args.fps or fps_p
        n_hint = int(round(dur * fps))
    W = args.width
    H = int(round(W * h0 / w0 / 2)) * 2
    stills = args.stills
    keep = np.ones(H, bool)
    if args.mask_band:
        a, b = [float(v) for v in args.mask_band.split(",")]
        keep[int(a / 1920 * H):int(math.ceil(b / 1920 * H))] = False
    sm = StillMetrics(W, H, keep)
    mo = None if stills else Motion(W, H, keep)
    frames = iter_dir(paths, W, H) if is_dir else iter_video(src, W, H)
    os.makedirs(args.outdir, exist_ok=True)

    rows, thumbs_small, pal_samples = [], [], []
    tw = args.thumb
    th = int(round(tw * H / W))
    sheet_dir = os.path.join(args.outdir, "sheets")
    do_sheets = args.sheets if args.sheets is not None else not stills
    if do_sheets:
        os.makedirs(sheet_dir, exist_ok=True)
    sheet_buf = []
    hist_prep = []  # ring of (tile specs, lp spec) for lag
    prev_g, prev_small = None, None
    rng = np.random.default_rng(0)
    one_n = args.onesheet
    one_idx = set(np.linspace(0, max(n_hint - 1, 0), min(one_n, max(n_hint, 1))).round().astype(int).tolist())
    one_imgs = {}

    def flush_sheet(buf, s0):
        cols, rws = 10, 6
        S = Image.new("RGB", (cols * tw, rws * th), "black")
        d = ImageDraw.Draw(S)
        for k, (i, im) in enumerate(buf):
            x, y = (k % cols) * tw, (k // cols) * th
            S.paste(im, (x, y))
            d.text((x + 3, y + 2), str(i), fill=(255, 210, 0))
        S.save(os.path.join(sheet_dir, f"sheet_{s0 // 60:03d}.jpg"), quality=82)

    for i, u8 in enumerate(frames):
        row = {"frame": i, "t": i / fps}
        if is_dir:
            row["name"] = os.path.basename(paths[i])
        row.update(sm(u8))
        rgbf = u8.astype(np.float32) / 255
        if i % max(1, int(fps // 2)) == 0 or stills:
            px = rgbf[keep].reshape(-1, 3)
            pal_samples.append((i, px[rng.integers(0, len(px), 1500)]))
        if mo is not None:
            g = luma(rgbf)
            small = ndi.zoom(g, 64 / W, order=1)
            row["diff"] = float(np.abs(g - prev_g)[keep].mean()) if prev_g is not None else 0.0
            row["ncc"] = float(np.corrcoef(small.ravel(), prev_small.ravel())[0, 1]) if prev_small is not None and small.std() > 1e-4 and prev_small.std() > 1e-4 else 1.0
            tp, lp = mo.prep(g), mo.lpz.prep(g)
            hist_prep.append((tp, lp))
            if len(hist_prep) > LAG + 1:
                hist_prep.pop(0)
            f1 = mo.fit(hist_prep[-2][0], tp) if len(hist_prep) >= 2 else None
            fk = mo.fit(hist_prep[0][0], tp) if len(hist_prep) == LAG + 1 else None
            zl = mo.lpz.zoom(hist_prep[0][1], lp) if len(hist_prep) == LAG + 1 else (float("nan"), 0)
            for tag, f in (("l1", f1), ("lk", fk)):
                for key in ("tx", "ty", "s", "r", "n", "resid", "p90"):
                    row[f"{tag}_{key}"] = f[key] if f else float("nan")
            row["zoom_lp_raw"] = zl[0] / LAG
            row["trackable"] = int(f1 is not None or fk is not None or len(hist_prep) < 2)
            prev_g, prev_small = g, small
        im = Image.fromarray(u8).resize((tw, th), Image.BOX)
        if do_sheets:
            sheet_buf.append((i, im))
            if len(sheet_buf) == 60:
                flush_sheet(sheet_buf, i - 59); sheet_buf = []
        if i in one_idx or stills:
            one_imgs[i] = im
        rows.append(row)
        if i % 300 == 0:
            print(f"  frame {i}", file=sys.stderr, flush=True)
    if do_sheets and sheet_buf:
        flush_sheet(sheet_buf, sheet_buf[0][0])
    n = len(rows)
    if n == 0:
        sys.exit("no frames decoded")

    # ---------------- motion post-processing
    scale720 = 720 / W
    Rp = math.sqrt((W ** 2 + H ** 2) / 12)  # RMS radius of the frame (analysis px)
    cuts, flashes = [], []
    if mo is not None:
        diff = np.array([r["diff"] for r in rows]); ncc = np.array([r["ncc"] for r in rows])
        lm = np.array([r["luma_mean"] for r in rows])
        valid1 = np.array([not math.isnan(r["l1_tx"]) for r in rows])
        for i in range(1, n):
            loc = np.median(diff[max(1, i - 15):i + 16]) + 1e-4
            spike = diff[i] > 3 * loc and diff[i] > 0.02
            if lm[i] > 0.8 and lm[i] - lm[i - 1] > 0.12:  # white flash (planned transition)
                flashes.append(i)
                continue
            if spike and (ncc[i] < 0.6 or (not valid1[i] and ncc[i] < 0.8)):
                cuts.append(i)
        # merge cuts that are 1 frame apart (dissolve frames)
        merged = []
        for c in cuts:
            if not merged or c - merged[-1] > 1:
                merged.append(c)
        cuts = merged
        breaks = sorted(set(cuts + flashes))
        seg_edges = [0] + breaks + [n]
        segs = [(seg_edges[k], seg_edges[k + 1]) for k in range(len(seg_edges) - 1)]
        brk = np.zeros(n, bool)
        for b in breaks:
            brk[b:b + 1] = True
        # velocity vectors in analysis px: [tx, ty, s*Rp, r*Rp]
        V = np.full((n, 4), np.nan)
        src_used = np.zeros(n, "U2")
        lk = np.full((n, 4), np.nan)
        for i, r in enumerate(rows):
            if not math.isnan(r["lk_tx"]):
                # lag-K pair (i-K, i) -> assign to centre frame, valid only if no break inside (i-K, i]
                if not brk[i - LAG + 1:i + 1].any():
                    c = i - (LAG - 1) // 2
                    lk[c] = np.array([r["lk_tx"], r["lk_ty"], r["lk_s"] * Rp, r["lk_r"] * Rp]) / LAG
        for i, r in enumerate(rows):
            v1 = np.array([r["l1_tx"], r["l1_ty"], r["l1_s"] * Rp, r["l1_r"] * Rp]) if not math.isnan(r["l1_tx"]) and not brk[i] else None
            vk = lk[i] if not np.isnan(lk[i]).any() else None
            if vk is not None and (v1 is None or np.linalg.norm(v1) * scale720 < 1.5 or np.linalg.norm(vk) * scale720 < 1.5):
                V[i], src_used[i] = vk, "lk"
            elif v1 is not None:
                V[i], src_used[i] = v1, "l1"
        # fill gaps by interpolation inside segments
        for a, b in segs:
            idx = np.arange(a, b)
            ok = ~np.isnan(V[a:b, 0])
            if ok.sum() == 0:
                V[a:b] = 0
                continue
            for c in range(4):
                V[a:b, c] = np.interp(idx, idx[ok], V[a:b, c][ok])
        Vs = gauss_segments(V, segs)
        A = np.zeros_like(Vs); J = np.zeros_like(Vs)
        for a, b in segs:
            if b - a >= 2:
                A[a + 1:b] = np.diff(Vs[a:b], axis=0)
            if b - a >= 3:
                J[a + 2:b] = np.diff(Vs[a:b], 2, axis=0)
        speed = np.linalg.norm(Vs, axis=1) * scale720
        acc = np.linalg.norm(A, axis=1) * scale720
        jerk = np.linalg.norm(J, axis=1) * scale720
        near_brk = np.zeros(n, bool)
        for b in breaks:
            near_brk[max(0, b - 3):b + 4] = True
        near_brk[:3] = True
        for i, r in enumerate(rows):
            r["tx_px720"] = Vs[i, 0] * scale720
            r["ty_px720"] = Vs[i, 1] * scale720
            r["zoom_pct"] = Vs[i, 2] / Rp * 100
            r["roll_deg"] = math.degrees(Vs[i, 3] / Rp)
            r["zoom_lp_pct"] = r.pop("zoom_lp_raw") * 100
            r["speed_px720"] = speed[i]
            lp90 = r.get("lk_p90", float("nan"))
            sp90 = lp90 / LAG if not math.isnan(lp90) and lp90 / LAG < 1.5 / scale720 else r.get("l1_p90", float("nan"))
            r["flow_p90_px720"] = (sp90 if not math.isnan(sp90) else 0.0) * scale720
            r["accel_px720"] = acc[i]
            r["jerk_px720"] = jerk[i]
            r["motion_src"] = src_used[i]
            r["cls"] = "cut" if i in breaks else ("hold" if speed[i] < HOLD else "drift" if speed[i] < DRIFT else "move")
            r["cut"] = int(i in cuts); r["flash"] = int(i in flashes)
            for k_ in [k_ for k_ in r if k_.startswith(("l1_", "lk_"))]:
                if not k_.endswith(("_n", "_resid", "_p90")):
                    del r[k_]

    # ---------------- shots
    if stills:
        shot_edges = [0, n]
    elif args.bounds:
        shot_edges = [0] + [int(round(float(b) * fps)) for b in args.bounds.split(",")] + [n]
    else:
        shot_edges = [0] + [c for c in cuts if c > 0] + [n]
    shots = []
    for k in range(len(shot_edges) - 1):
        a, b = shot_edges[k], max(shot_edges[k] + 1, shot_edges[k + 1])
        shots.append(summarise(rows[a:b], mo is not None, k + 1, a, b, fps, pal_samples, near_brk[a:b] if mo is not None else None))
    overall = summarise(rows, mo is not None, 0, 0, n, fps, pal_samples, near_brk if mo is not None else None)
    overall.update(label=args.label or os.path.basename(src.rstrip("/")), source=src, frames=n, fps=fps,
                   analysis_size=f"{W}x{H}", source_size=f"{w0}x{h0}", hard_cuts=cuts, flashes=flashes,
                   cuts_per_10s=round(len(cuts) / (n / fps) * 10, 2) if not stills else None, mask_band=args.mask_band)
    if mo is not None:
        overall.update(moves_detail=moves(rows, fps))

    # ---------------- write
    keys = list(rows[0].keys())
    for r in rows:
        for k_ in r:
            if k_ not in keys:
                keys.append(k_)
    with open(os.path.join(args.outdir, "frames.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, keys)
        w.writeheader()
        for r in rows:
            w.writerow({k_: (round(v, 5) if isinstance(v, float) else v) for k_, v in r.items()})
    shot_keys = [k_ for k_ in shots[0] if k_ != "palette"] + ["palette"]
    with open(os.path.join(args.outdir, "shots.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, shot_keys)
        w.writeheader()
        for s in shots:
            w.writerow({k_: (" ".join(v) if isinstance(v, list) else round(v, 4) if isinstance(v, float) else v) for k_, v in s.items()})
    json.dump({"overall": overall, "shots": shots}, open(os.path.join(args.outdir, "summary.json"), "w"), indent=1, default=float)
    # one sheet
    if one_imgs:
        ids = sorted(one_imgs)
        cols = 10 if len(ids) > 10 else len(ids)
        rws = math.ceil(len(ids) / cols)
        S = Image.new("RGB", (cols * tw, rws * th), "black")
        d = ImageDraw.Draw(S)
        for k, i in enumerate(ids):
            x, y = (k % cols) * tw, (k // cols) * th
            S.paste(one_imgs[i], (x, y))
            d.text((x + 3, y + 2), f"{i}" if is_dir else f"{i} {i / fps:.1f}s", fill=(255, 210, 0))
        S.save(os.path.join(args.outdir, "onesheet.jpg"), quality=82)
    write_report(args.outdir, overall, shots, mo is not None)
    print(open(os.path.join(args.outdir, "report.md")).read()[:3000])


def pct(x, q):
    x = np.asarray([v for v in x if not (isinstance(v, float) and math.isnan(v))], float)
    return float(np.percentile(x, q)) if len(x) else float("nan")


STILL_KEYS = ["luma_mean", "luma_p1", "luma_p5", "luma_p50", "luma_p95", "luma_p99", "contrast_rms", "contrast_p95_p5",
              "pct_black", "pct_clip", "sat_mean", "sat_p90", "colorfulness", "chroma_lit_p50", "chroma_lit_p90",
              "shadow_b", "hi_b", "shadow_hue", "hi_hue", "shadow_chroma", "hi_chroma",
              "ink_density", "bright_line_density", "edge_density", "sharp_centre", "sharp_periph", "sharp_ratio",
              "texture_energy", "surface_frac", "empty_frac", "vignette", "noise_sigma"]


def summarise(rs, motion, idx, a, b, fps, pal_samples, nb):
    s = {"shot": idx, "f0": a, "f1": b, "t0": round(a / fps, 3), "t1": round(b / fps, 3), "frames": b - a}
    for k in STILL_KEYS:
        s[k] = pct([r[k] for r in rs], 50)
    if motion:
        sp = np.array([r["speed_px720"] for r in rs])
        cls = [r["cls"] for r in rs]
        nn = max(1, sum(c != "cut" for c in cls))
        s["pct_hold"] = 100 * cls.count("hold") / nn
        s["pct_drift"] = 100 * cls.count("drift") / nn
        s["pct_move"] = 100 * cls.count("move") / nn
        s["pct_moving_any"] = s["pct_drift"] + s["pct_move"]
        s["speed_p50"] = pct(sp, 50); s["speed_peak"] = float(sp.max())
        fp = np.array([r["flow_p90_px720"] for r in rs])
        s["pct_any_motion"] = 100 * float((fp >= HOLD).mean())  # some region moves (subject or camera)
        s["flow_p90_p50"] = pct(fp, 50)
        z = np.array([r["zoom_pct"] for r in rs])
        quiet = sp < DRIFT
        s["zoom_quiet_p50_pct"] = pct(z[quiet], 50) if quiet.any() else float("nan")
        s["pct_zooming"] = 100 * float((np.abs(z) >= 0.05).mean())
        s["roll_absmax_deg"] = float(np.abs([r["roll_deg"] for r in rs]).max())
        jk = np.array([r["jerk_px720"] for r in rs])[~nb] if nb is not None and (~nb).any() else np.array([0.0])
        ac = np.array([r["accel_px720"] for r in rs])[~nb] if nb is not None and (~nb).any() else np.array([0.0])
        s["jerk_rms"] = float(np.sqrt((jk ** 2).mean())); s["jerk_p95"] = pct(jk, 95)
        s["accel_rms"] = float(np.sqrt((ac ** 2).mean()))
        s["jerk_per_speed"] = s["jerk_rms"] / max(float(np.sqrt((sp ** 2).mean())), 1e-3)
        # static runs >= 4 frames (camera speed < 0.15 and frame diff < 0.002)
        run, longest, nstatic = 0, 0, 0
        for r in rs:
            st = r["speed_px720"] < 0.15 and r["diff"] < 0.002
            run = run + 1 if st else 0
            longest = max(longest, run)
            if run == 4:
                nstatic += 1
        s["static_runs_ge4"] = nstatic; s["longest_static"] = longest
        s["diff_p50"] = pct([r["diff"] for r in rs], 50)
        s["pct_untrackable"] = 100 * float(np.mean([r["trackable"] == 0 for r in rs]))
    px = [p for i, p in pal_samples if a <= i < b]
    if px:
        P = np.concatenate(px).astype(np.float64)
        if len(P) > 40000:
            P = P[np.random.default_rng(2).choice(len(P), 40000, replace=False)]
        try:
            cent, lab_ = kmeans2(P, 6, minit="++", seed=1, iter=20)
            cnt = np.bincount(lab_, minlength=6)
            order = np.argsort(-cnt)
            s["palette"] = [f"{hexcol(cent[o])}:{100 * cnt[o] / cnt.sum():.0f}%" for o in order if cnt[o]]
        except Exception:
            s["palette"] = []
    else:
        s["palette"] = []
    return s


def moves(rows, fps):
    sp = np.array([r["speed_px720"] for r in rows])
    out, i, n = [], 0, len(sp)
    while i < n:
        if sp[i] >= DRIFT and rows[i]["cls"] != "cut":
            j = i
            while j < n and sp[j] >= DRIFT and rows[j]["cls"] != "cut":
                j += 1
            # extend to the surrounding drift shoulders for attack/release
            a = i
            while a > 0 and sp[a - 1] >= HOLD and sp[a - 1] < sp[a] and rows[a - 1]["cls"] != "cut":
                a -= 1
            b = j
            while b < n and sp[b] >= HOLD and sp[b] < sp[b - 1] and rows[b]["cls"] != "cut":
                b += 1
            pk = a + int(np.argmax(sp[a:b]))
            out.append(dict(f0=a, f1=b, peak_frame=pk, peak=round(float(sp[pk]), 2), attack=pk - a, release=b - pk))
            i = b
        else:
            i += 1
    return out


def fmt(v, k=""):
    if isinstance(v, float):
        if math.isnan(v):
            return "-"
        if k.startswith("pct") or k in ("frames",):
            return f"{v:.1f}"
        return f"{v:.3f}" if abs(v) < 10 else f"{v:.1f}"
    return str(v)


def write_report(outdir, ov, shots, motion):
    L = [f"# Frame metrics: {ov['label']}", "",
         f"Source `{ov['source']}` · {ov['frames']} frames @ {ov['fps']:g} fps · analysed at {ov['analysis_size']}"
         + (f" · mask band {ov['mask_band']}" if ov.get("mask_band") else ""), ""]
    if motion:
        mv = ov.get("moves_detail", [])
        L += ["## Camera / motion (px720 per frame)", "",
              "| metric | value |", "|---|---|",
              f"| hold / drift / move % | {ov['pct_hold']:.1f} / {ov['pct_drift']:.1f} / {ov['pct_move']:.1f} |",
              f"| moving (drift+move) % | {ov['pct_moving_any']:.1f} |",
              f"| frames where any region moves >= 0.3 (subject/parallax, tile p90) | {ov['pct_any_motion']:.1f} % (p50 {ov['flow_p90_p50']:.2f}) |",
              f"| speed p50 / peak | {ov['speed_p50']:.2f} / {ov['speed_peak']:.1f} |",
              f"| zoom in quiet frames p50 (%/f) | {ov['zoom_quiet_p50_pct']:.3f} |",
              f"| frames zooming >= 0.05 %/f | {ov['pct_zooming']:.1f} % |",
              f"| RMS accel / RMS jerk / p95 jerk | {ov['accel_rms']:.3f} / {ov['jerk_rms']:.3f} / {ov['jerk_p95']:.3f} |",
              f"| jerk per unit speed (RMS jerk / RMS speed) | {ov['jerk_per_speed']:.3f} |",
              f"| moves (>= 2 px720/f): count, median peak, median attack/release f | {len(mv)}, "
              + (f"{np.median([m['peak'] for m in mv]):.1f}, {np.median([m['attack'] for m in mv]):.0f}/{np.median([m['release'] for m in mv]):.0f}" if mv else "-") + " |",
              f"| static runs >= 4 f (count, longest) | {ov['static_runs_ge4']}, {ov['longest_static']} |",
              f"| untrackable frames (too little texture to measure) | {ov['pct_untrackable']:.1f} % |",
              f"| hard cuts (per 10 s) | {len(ov['hard_cuts'])} ({ov['cuts_per_10s']}) at {ov['hard_cuts'][:30]} |",
              f"| flashes | {ov['flashes'][:30]} |", ""]
    L += ["## Image (medians over frames)", "", "| metric | value |", "|---|---|"]
    for k in STILL_KEYS:
        L.append(f"| {k} | {fmt(ov[k], k)} |")
    L += ["", f"Palette (k=6): {' '.join(ov['palette'])}", ""]
    if len(shots) > 1:
        cols = ["shot", "t0", "t1"] + (["pct_moving_any", "pct_any_motion", "pct_move", "speed_peak", "zoom_quiet_p50_pct", "jerk_rms"] if motion else []) + \
               ["luma_p50", "contrast_rms", "pct_black", "sat_mean", "colorfulness", "ink_density", "bright_line_density", "texture_energy", "sharp_ratio", "vignette"]
        L += ["## Per shot", "", "| " + " | ".join(cols) + " | palette top 3 |", "|" + "---|" * (len(cols) + 1)]
        for s in shots:
            L.append("| " + " | ".join(fmt(s[c], c) for c in cols) + " | " + " ".join(p.split(":")[0] for p in s["palette"][:3]) + " |")
    open(os.path.join(outdir, "report.md"), "w").write("\n".join(L) + "\n")


# ----------------------------------------------------------------------------- self test
def render_clip(clip, cams, canv, OW, OH):
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{OW}x{OH}", "-r", "30",
                            "-i", "-", "-c:v", "libx264", "-crf", "18", "-preset", "fast", "-pix_fmt", "yuv420p", clip], stdin=subprocess.PIPE)
    yy, xx = np.mgrid[0:OH, 0:OW].astype(np.float32)
    xo, yo = xx - OW / 2, yy - OH / 2
    for cv, cx, cy, sc, ro in cams:
        c, s = math.cos(ro), math.sin(ro)
        X = cx + sc * (c * xo - s * yo); Y = cy + sc * (s * xo + c * yo)
        fr = np.stack([ndi.map_coordinates(canv[cv][..., ch], [Y, X], order=3, mode="reflect") for ch in range(3)], -1)
        enc.stdin.write((np.clip(fr, 0, 1) * 255).astype(np.uint8).tobytes())
    enc.stdin.close(); enc.wait()


def selftest(outdir):
    """Synthetic clip with known camera motion -> run analysis -> accuracy table."""
    os.makedirs(outdir, exist_ok=True)
    rng = np.random.default_rng(7)
    OW, OH = 540, 960
    CW, CH = 1400, 2000

    def rich():
        c = np.zeros((CH, CW, 3), np.float32)
        for s, amp in ((40, 0.5), (12, 0.3), (3, 0.15)):
            c += amp * ndi.gaussian_filter(rng.standard_normal((CH, CW, 3)).astype(np.float32), (s, s, 0)) * s ** 0.5
        c = (c - c.min()) / (c.max() - c.min())
        im = Image.fromarray((c * 255).astype(np.uint8)); d = ImageDraw.Draw(im)
        for _ in range(120):
            x, y, r = rng.integers(0, CW), rng.integers(0, CH), rng.integers(10, 90)
            d.ellipse([x - r, y - r, x + r, y + r], outline=tuple(int(v) for v in rng.integers(0, 255, 3)), width=4)
        return np.asarray(im).astype(np.float32) / 255

    def blueprint():
        im = Image.new("RGB", (CW, CH), (11, 26, 51)); d = ImageDraw.Draw(im)
        for x in range(0, CW, 40):
            d.line([x, 0, x, CH], fill=(20, 45, 80), width=1)
        for y in range(0, CH, 40):
            d.line([0, y, CW, y], fill=(20, 45, 80), width=1)
        for _ in range(60):
            pts = [(int(rng.integers(0, CW)), int(rng.integers(0, CH))) for _ in range(rng.integers(2, 5))]
            d.line(pts, fill=(53, 215, 255), width=3)
        for _ in range(25):
            x, y, r = rng.integers(0, CW), rng.integers(0, CH), rng.integers(20, 120)
            d.ellipse([x - r, y - r, x + r, y + r], outline=(53, 215, 255), width=3)
        return ndi.gaussian_filter(np.asarray(im).astype(np.float32) / 255, (0.8, 0.8, 0))

    canv = [rich(), blueprint()]
    # segments: (frames, canvas, kind, params). camera param per frame: cx, cy (canvas px), scale (canvas px per output px), roll
    plan = [(45, 0, "hold", {}), (60, 0, "zoom", {"rate": 0.0015}), (60, 0, "pan", {"vx": 0.75}),
            (40, 0, "glide", {"dist": 100, "dur": 30}), (1, 1, "cut", {}),
            (45, 1, "hold", {}), (60, 1, "zoom", {"rate": 0.003, "roll": 0.05}), (60, 1, "pan", {"vx": 0.2}),
            (40, 1, "glide", {"dist": 100, "dur": 30}), (1, 0, "cut", {}), (60, 0, "zoom", {"rate": 0.0008})]
    truth, cams = [], []
    cx, cy, sc, ro = CW / 2, CH / 2, 1.0, 0.0
    ci = 0
    for nfr, cv, kind, p in plan:
        if kind == "cut":
            cx, cy, sc, ro = CW / 2 + 37, CH / 2 - 51, 1.0, 0.0
        for k in range(nfr):
            dx = dz = dr = 0.0
            if kind == "zoom":
                dz, dr = p["rate"], math.radians(p.get("roll", 0))
            elif kind == "pan":
                dx = p["vx"]
            elif kind == "glide":
                def ss(t):
                    t = min(max(t, 0), 1); return t * t * t * (t * (6 * t - 15) + 10)
                dx = p["dist"] * (ss((k + 1) / p["dur"]) - ss(k / p["dur"]))
            # camera moves right by dx output-px -> content moves left; zoom in -> scale shrinks
            cx += dx * sc; sc /= (1 + dz); ro -= dr
            cams.append((cv, cx, cy, sc, ro))
            # truth content motion at 1080 px width per frame (output is 540 -> x2) and px720
            truth.append(dict(kind=kind, cut=int(kind == "cut" and k == 0), tx720=-dx * 720 / OW if kind != "cut" else 0,
                              zoom_pct=dz * 100, roll_deg=math.degrees(dr)))
    clip = os.path.join(outdir, "synthetic.mp4")
    if not os.path.exists(clip):
        render_clip(clip, cams, canv, OW, OH)
    a = argparse.Namespace(input=clip, outdir=os.path.join(outdir, "metrics"), fps=30, label="selftest", bounds=None, stills=False,
                           width=270, mask_band=None, sheets=False, onesheet=20, thumb=108)
    analyse(a)
    est = list(csv.DictReader(open(os.path.join(a.outdir, "frames.csv"))))
    n = min(len(est), len(truth))
    res = {}
    for kind in ("hold", "zoom", "pan", "glide"):
        idx = [i for i in range(n) if truth[i]["kind"] == kind and not any(truth[j]["cut"] for j in range(max(0, i - 4), min(n, i + 4)))]
        idx = [i for i in idx if 3 < i < n - 3]
        ez = np.array([float(est[i]["zoom_pct"]) - truth[i]["zoom_pct"] for i in idx])
        ex = np.array([float(est[i]["tx_px720"]) - truth[i]["tx720"] for i in idx])
        moving = np.array([est[i]["cls"] in ("drift", "move") for i in idx])
        tm = np.array([abs(truth[i]["tx720"]) + abs(truth[i]["zoom_pct"]) * 4.24 >= HOLD for i in idx])
        res[kind] = dict(frames=len(idx), zoom_err_mae_pct=float(np.abs(ez).mean()), tx_err_mae_px720=float(np.abs(ex).mean()),
                         class_moving_agree=float((moving == tm).mean()))
    for seg_rate in (0.0015, 0.003, 0.0008):
        idx = [i for i in range(n) if truth[i]["kind"] == "zoom" and abs(truth[i]["zoom_pct"] - seg_rate * 100) < 1e-9 and 5 < i < n - 3]
        idx = [i for i in idx if not any(truth[j]["cut"] for j in range(max(0, i - 6), i + 1))]
        zt = np.mean([float(est[i]["zoom_pct"]) for i in idx]); zl = np.nanmean([float(est[i]["zoom_lp_pct"]) for i in idx])
        res[f"zoom_{seg_rate * 100:.2f}pct_mean_est"] = dict(tiles=round(zt, 4), logpolar=round(float(zl), 4))
    tc = [i for i in range(n) if truth[i]["cut"]]
    dc = [i for i in range(n) if est[i]["cut"] == "1"]
    hit = sum(any(abs(c - d) <= 1 for d in dc) for c in tc)
    res["cuts"] = dict(true=tc, detected=dc, recall=hit / max(1, len(tc)), false_pos=len(dc) - hit)
    gl = [i for i in range(n) if truth[i]["kind"] == "glide"]
    res["glide_peak"] = dict(true=round(max(abs(truth[i]["tx720"]) for i in gl), 2), est=round(max(float(est[i]["speed_px720"]) for i in gl), 2))
    json.dump(res, open(os.path.join(outdir, "selftest.json"), "w"), indent=1)
    print(json.dumps(res, indent=1))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("input", nargs="?")
    ap.add_argument("outdir", nargs="?")
    ap.add_argument("--fps", type=float, default=None)
    ap.add_argument("--label")
    ap.add_argument("--bounds")
    ap.add_argument("--stills", action="store_true")
    ap.add_argument("--width", type=int, default=270)
    ap.add_argument("--mask-band")
    ap.add_argument("--sheets", dest="sheets", action="store_true", default=None)
    ap.add_argument("--no-sheets", dest="sheets", action="store_false")
    ap.add_argument("--onesheet", type=int, default=60)
    ap.add_argument("--thumb", type=int, default=108, help="thumbnail width on sheets")
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args()
    if a.selftest:
        selftest(a.input or a.outdir)
        return
    if not a.input or not a.outdir:
        ap.error("need <video_or_frame_dir> <outdir>")
    if a.fps is None and os.path.isdir(a.input):
        a.fps = 30.0
    analyse(a)


if __name__ == "__main__":
    main()
