"""Mix for "The Plane's Secret Windmill".  python3 -I mix.py  (run from this folder)

- VO on top, always. Beds/music are ducked by a mask built from vo/words.json (word-keyed, not waveform-keyed).
- Every transient SFX starts inside a speech gap (see cues below; times from vo/words.json).
- Brand sounds from assets/brand/ are used unchanged (trim/fade only here in the mix).
- SFX stem uses fixed per-cue gains (never peak-normalised as a whole).
Outputs: mix/mix_premaster.wav, mix/stems/*.wav, mix/cues.md
"""
import json, os, subprocess, numpy as np
import scipy.io.wavfile as wavio

SR = 48000
DUR = 58.5
N = int(DUR * SR)
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
RAW = os.path.join(HERE, "sfx", "raw")
BRAND = os.path.join(ROOT, "assets", "brand")
OUT = os.path.join(HERE, "mix"); os.makedirs(os.path.join(OUT, "stems"), exist_ok=True)


def load(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "2", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).copy()


def db(x): return 10 ** (x / 20)


def rms_db(x): return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)


def fade(x, fi=0.01, fo=0.05):
    n = len(x); a = int(fi * SR); b = int(fo * SR)
    if a: x[:a] *= np.linspace(0, 1, a)[:, None]
    if b: x[-b:] *= np.linspace(1, 0, b)[:, None]
    return x


def place(bus, x, t, gain_db=0.0):
    i = int(round(t * SR)); x = x * db(gain_db)
    if i < 0: x = x[-i:]; i = 0
    j = min(N, i + len(x)); bus[i:j] += x[: j - i]


def loop_to(x, length, xf=0.25):
    """Loop a short ambience to `length` seconds with equal-power crossfades."""
    L = int(length * SR); f = min(int(xf * SR), len(x) // 3)
    w = (np.sin(np.linspace(0, np.pi / 2, f)) ** 2)[:, None]
    out = np.zeros((L, 2), np.float32); pos = 0; first = True
    while pos < L:
        seg = x.copy()
        if not first:
            out[pos - f:pos] = out[pos - f:pos] * w[::-1] + seg[:f] * w
            seg = seg[f:]
        j = min(L, pos + len(seg)); out[pos:j] = seg[: j - pos]; pos = j; first = False
    return out


def section(x, t0, t1):
    return x[int(t0 * SR):int(t1 * SR)].copy()


# ---------------- word mask (for ducking) ----------------
W = json.load(open(os.path.join(HERE, "vo", "words.json")))["words"]
mask = np.zeros(N, np.float32)
for w in W:
    a = max(0, int((w["start"] - 0.06) * SR)); b = min(N, int((w["end"] + 0.10) * SR)); mask[a:b] = 1
# attack 40 ms / release 220 ms smoothing
def smooth_env(m, att=0.04, rel=0.22):
    out = np.zeros_like(m); ka = 1 - np.exp(-1 / (att * SR)); kr = 1 - np.exp(-1 / (rel * SR)); y = 0.0
    # vectorised enough for 58 s at 48 kHz via a decimated pass
    step = 48; dec = m[::step]; o = np.zeros_like(dec)
    ka = 1 - np.exp(-step / (att * SR)); kr = 1 - np.exp(-step / (rel * SR))
    for i, v in enumerate(dec):
        y += (ka if v > y else kr) * (v - y); o[i] = y
    return np.repeat(o, step)[: len(m)]
mask = smooth_env(mask)[:, None]
# tight mask for transient SFX tails: exact word spans, fast release, so hits in gaps keep their attack
tmask = np.zeros(N, np.float32)
for w in W:
    a = max(0, int((w["start"] - 0.03) * SR)); b = min(N, int((w["end"] + 0.03) * SR)); tmask[a:b] = 1
tmask = smooth_env(tmask, 0.02, 0.06)[:, None]


def duck(x, depth_db):
    return x * (1 - (1 - db(-abs(depth_db))) * mask)


# ---------------- VO ----------------
vo = load(os.path.join(HERE, "vo", "vo.wav"))
VO = np.zeros((N, 2), np.float32); place(VO, vo, 0.0)

# ---------------- music ----------------
MUS = np.zeros((N, 2), np.float32)
m1 = load(os.path.join(RAW, "m1_c.mp3")); m2 = load(os.path.join(RAW, "m2_c.mp3")); m3 = load(os.path.join(RAW, "m3_a.mp3"))
# 1) tension 0 -> LOCK (28.15), hard cut on the lock (silence = power)
a = section(m1, 0.0, 28.15); a = fade(a, 0.6, 0.03); place(MUS, a, 0.0, -2)
# 2) relief 28.55 -> 37.6
b = section(m2, 0.0, 9.3); b = fade(b, 0.25, 0.5); place(MUS, b, 28.55, -1)
# 3) history 37.95 -> 53.65
c = section(m3, 0.0, 15.8); c = fade(c, 0.4, 0.4); place(MUS, c, 37.95, -2)
# 4) present-day swell 53.65 -> 58.5 (later part of the relief cue), fades into the loop
d = section(m2, 14.0, 18.85); d = fade(d, 0.3, 0.9)
tt = 53.65 + np.arange(len(d)) / SR; d *= (0.22 + 0.78 * np.clip((tt - 57.38) / 0.35, 0, 1))[:, None]  # quiet under the soft last line, swell after it
place(MUS, d, 53.65, 0)
MUS = duck(MUS, 12) * db(-14)

# ---------------- brand sounds (fixed files, unchanged) ----------------
BR = np.zeros((N, 2), np.float32)
intro = load(os.path.join(BRAND, "intro_blueprint.mp3"))
alarm = load(os.path.join(BRAND, "alarm_meter.mp3"))
clunk = load(os.path.join(BRAND, "safety_clunk.mp3"))
place(BR, fade(intro.copy(), 0.0, 0.3), 0.0, -4)                 # opening blueprint (ducked under the first line below)
al = section(alarm, 0.0, 8.0); al = fade(al, 0.4, 0.03)           # meter 20.15 -> 28.15, cut on the lock
ramp = np.linspace(0.45, 1.0, len(al))[:, None]; al *= ramp        # follows the meter rising
place(BR, al, 20.15, -6)
BR = duck(BR, 12)
CL = np.zeros((N, 2), np.float32)
place(CL, clunk, 28.08, -1)                                       # in the gap "wind." | "It" (28.05-28.49), lock @28.15
CL = duck(CL, 15)                                                 # tail ducked under "It spins up"

# ---------------- SFX (fixed per-cue gains) ----------------
SFX = np.zeros((N, 2), np.float32); BED = np.zeros((N, 2), np.float32)
cues = []
def hit(name, t, g, note):
    x = fade(load(os.path.join(RAW, name + ".mp3")), 0.003, 0.08); place(SFX, x, t, g); cues.append((t, name, g, note))
def bed(x, t, g, note, name):
    place(BED, x, t, g); cues.append((t, name, g, note))

hit("die_b", 2.15, -17, "engines spool down (gap die,|a)")
wind = load(os.path.join(RAW, "wind2_a.mp3"))
wb = loop_to(wind, 26.0); env = np.linspace(0.5, 1.0, len(wb))[:, None]; wb *= env; wb = fade(wb, 1.0, 0.03)
bed(wb, 2.15, -22, "glide wind bed, rising with speed, cut at the lock", "wind2_a loop")
hit("power_b", 15.71, -4, "screens dark (gap dark,|and)")
hit("drain_a", 19.54, -2, "pressure draining (gap pressure.|That's)")
hit("creak_a", 21.60, -20, "airframe creak (gap yoke|gets)")
hit("whoosh_a", 22.50, -10, "print transition whoosh (gap heavier.|Here's)")
hit("hatch_a", 24.98, -6, "hatch pops (gap belly|pops), visual @25.16")
hit("swing_a", 26.93, -10, "RAT arm swings (gap propeller|drops)")
spin = load(os.path.join(RAW, "spin_a.mp3"))
bed(fade(spin, 0.01, 0.4), 28.2, -17, "RAT spin-up whir (bed, ducked)", "spin_a")
hit("hydup_b", 30.08, -6, "pressure back (gap pump,|and)")
pin = load(os.path.join(RAW, "pin_a.mp3"))
bed(fade(loop_to(pin, 3.5, 0.2), 0.2, 0.4), 34.02, -16, "pinwheel flutter (bed, ducked)", "pin_a loop")
hit("whoosh_a", 37.57, -10, "era-change whoosh (gap speed.|In)")
hit("stamp_a", 37.95, 12, "1983 stamp slam (gap speed.|In), stamp @38.22")
proj = load(os.path.join(RAW, "proj2_b.mp3"))
bed(fade(loop_to(proj, 15.7), 0.4, 0.4), 37.95, -22, "projector ambience (sepia)", "proj2_b loop")
hit("bong_a", 43.23, -22, "low warning bong (gap feet.|Someone)")
race = load(os.path.join(RAW, "race_a.mp3"))
bed(fade(loop_to(race, 2.6, 0.2), 0.2, 0.5), 48.63, -14, "distant race cars (gap Unluckily,|the -> ducked)", "race_a loop")
hit("touch_b", 51.81, -4, "touchdown thump + scrape (transient @52.17, gap anyway.|No)")
hit("whoosh_a", 53.53, -10, "back-to-now whoosh (gap injuries,|and)")
to = load(os.path.join(RAW, "takeoff_b.mp3"))
to = fade(to, 0.3, 1.2); tt = 53.65 + np.arange(len(to)) / SR; to *= (0.2 + 0.8 * np.clip((tt - 57.38) / 0.3, 0, 1))[:, None]
bed(to, 53.65, -16, "jet climb-out (bed, ducked; swells after the last word)", "takeoff_b")
BED = duck(BED, 12)
SFX = SFX * (1 - (1 - db(-16)) * tmask)

# alarm meter must not run past the lock
BR[int(28.15 * SR):int(28.2 * SR)] *= np.linspace(1, 0, int(0.05 * SR))[:, None]

for name, x in [("vo", VO), ("music", MUS), ("brand", BR + CL), ("sfx", SFX), ("beds", BED)]:
    wavio.write(os.path.join(OUT, "stems", f"{name}.wav"), SR, x.astype(np.float32))
mix = VO + MUS + BR + CL + SFX + BED
wavio.write(os.path.join(OUT, "mix_premaster.wav"), SR, mix.astype(np.float32))

# per-second VO vs everything-else check during speech
bedall = MUS + BR + CL + SFX + BED
rows = []
for s in range(int(DUR)):
    a, b = s * SR, (s + 1) * SR
    sp = tmask[a:b, 0] > 0.9
    if sp.mean() < 0.2: continue
    v = rms_db(VO[a:b][sp]); o = rms_db(bedall[a:b][sp]); rows.append((s, v - o))
worst = sorted(rows, key=lambda r: r[1])[:6]
print("VO over bed during speech (dB), worst seconds:", [(s, round(d, 1)) for s, d in worst])
for s_ in [w for w, _ in worst]:
    a, b = s_ * SR, (s_ + 1) * SR; sp = tmask[a:b, 0] > 0.9
    print("  sec", s_, {k: round(float(rms_db(v[a:b][sp])), 1) for k, v in [("vo", VO), ("mus", MUS), ("brand", BR), ("clunk", CL), ("sfx", SFX), ("bed", BED)]})
print("median margin:", round(float(np.median([d for _, d in rows])), 1))

with open(os.path.join(OUT, "cues.md"), "w") as f:
    f.write("# Cues (video seconds)\n\n| t | sound | gain dB | note |\n|---|---|---|---|\n")
    f.write("| 0.00 | brand intro_blueprint | -4 | opening blueprint, ducked under words |\n")
    f.write("| 20.15 | brand alarm_meter (8.0 s) | -6 | follows the danger meter, cut at the lock |\n")
    f.write("| 28.08 | brand safety_clunk | -1 | lock @28.15 (gap wind.|It) |\n")
    for t, n, g, note in sorted(cues): f.write(f"| {t:.2f} | {n} | {g} | {note} |\n")
    f.write("\nMusic: m1_c 0-28.15 (hard cut on the lock) · m2_c 28.55-37.6 · m3_a 37.95-53.65 · m2_c[14-18.85] 53.65-58.5. Ducked 12 dB on words.\n")
