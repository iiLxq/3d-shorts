import numpy as np, scipy.signal as sg, scipy.io.wavfile as wf
import sys
SFXREF = float(sys.argv[1]) if len(sys.argv) > 1 else None
SR = 48000; DUR = 60.5; N = int(SR * DUR)
rng = np.random.default_rng(7)
sfx = np.zeros((N, 2)); mus = np.zeros((N, 2))

def T(n): return np.arange(n) / SR
def noise(n): return rng.standard_normal(n)
def bp(x, lo, hi, o=2): return sg.sosfilt(sg.butter(o, [lo, hi], 'band', fs=SR, output='sos'), x)
def lp(x, f, o=2): return sg.sosfilt(sg.butter(o, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sg.sosfilt(sg.butter(o, f, 'high', fs=SR, output='sos'), x)
def env_exp(n, tau): return np.exp(-T(n) / tau)
def place(buf, t, x, g=1.0, pan=0.0):
    i = int(t * SR)
    if i >= N: return
    x = x[:N - i]
    l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4)
    buf[i:i + len(x), 0] += x * g * l * 1.414; buf[i:i + len(x), 1] += x * g * r * 1.414
def norm(x): m = np.max(np.abs(x)); return x / m if m > 0 else x
def fade(x, a=.01, b=.05):
    n = len(x); e = np.ones(n); na, nb = int(a * SR), int(b * SR)
    if na: e[:na] = np.linspace(0, 1, na)
    if nb: e[-nb:] = np.minimum(e[-nb:], np.linspace(1, 0, nb))
    return x * e
IR = noise(int(1.6 * SR)) * env_exp(int(1.6 * SR), .35); IR = lp(IR, 6000); IR /= np.sqrt(np.sum(IR ** 2))
def verb(x, wet=.3): return x + wet * sg.fftconvolve(x, IR)[:len(x)]

# ---------- SFX recipes ----------
def ding():
    n = int(1.6 * SR); t = T(n); out = np.zeros(n)
    for f0, d in [(1318.5, 0), (1046.5, .32)]:
        k = int(d * SR); m = n - k; tt = T(m)
        s = sum(a * np.sin(2 * np.pi * f0 * h * tt) * np.exp(-tt / (0.9 / h)) for h, a in [(1, 1), (2.76, .25), (5.4, .1)])
        out[k:] += s * np.minimum(1, tt / .003)
    return verb(out, .25) * .5
def slide(dur):
    n = int(dur * SR); x = bp(noise(n), 200, 1800) * .25
    x += .15 * np.sin(2 * np.pi * (180 + 40 * T(n) / dur) * T(n)) * (0.5 + .5 * np.sin(2 * np.pi * 11 * T(n)))
    e = np.sin(np.pi * np.clip(T(n) / dur, 0, 1)) ** .7
    return x * e
def thud(f=55, tau=.18, click=.4, ln=.8):
    n = int(ln * SR); t = T(n)
    x = np.sin(2 * np.pi * f * t * (1 + .6 * np.exp(-t / .03))) * np.exp(-t / tau)
    x += click * lp(noise(n), 2500) * np.exp(-t / .012)
    return x
def clank(f0=420, tau=.35, ln=1.2, gain=1):
    n = int(ln * SR); t = T(n); x = np.zeros(n)
    for r, a in [(1, 1), (1.47, .7), (2.09, .55), (2.83, .4), (3.97, .3), (5.1, .2)]:
        x += a * np.sin(2 * np.pi * f0 * r * t + rng.uniform(0, 6)) * np.exp(-t / (tau / r ** .5))
    x += 1.2 * hp(noise(n), 1500) * np.exp(-t / .006)
    return x * gain * .35
def ping(f):
    n = int(.35 * SR); t = T(n)
    return (np.sin(2 * np.pi * f * t) * np.exp(-t / .06) + .4 * hp(noise(n), 4000) * np.exp(-t / .004)) * .5
def creak(dur, f0=180, f1=260):
    n = int(dur * SR); t = T(n); f = np.linspace(f0, f1, n)
    # stick-slip: pulse train with jittered rate through resonances
    ph = np.cumsum(f / SR); pulses = (np.diff(np.floor(ph), prepend=0) > 0).astype(float) * (1 + .5 * noise(n))
    x = bp(pulses, 300, 2500) + .6 * bp(pulses, 900, 1400, 4)
    return norm(x) * np.sin(np.pi * t / dur) ** .5 * .5
def snap(big=1.0):
    n = int(2.0 * SR); t = T(n)
    x = 2.2 * hp(noise(n), 800) * np.exp(-t / .01)                       # crack
    x += clank(380, .5, 2.0, 1.4)                                         # metallic ring
    x += 1.2 * np.sin(2 * np.pi * 60 * t) * np.exp(-t / .12)              # thump
    w = bp(noise(n), 300, 5000) * np.exp(-((t - .12) / .08) ** 2) * .8    # whip
    return verb((x + w) * big, .35)
def whoosh(dur, lo=150, hi=3000, rise=True):
    n = int(dur * SR); t = T(n) / dur; x = noise(n)
    out = np.zeros(n); blk = 1024
    for i in range(0, n, blk):
        u = t[i] if rise else 1 - t[i]; fc = lo * (hi / lo) ** u
        out[i:i + blk] = x[i:i + blk]
    # approximate sweep by mixing two bands with crossfade
    a = bp(x, lo, lo * 4); b = bp(x, hi / 4, hi); m = t if rise else 1 - t
    out = a * (1 - m) + b * m
    return out * np.sin(np.pi * t) ** 1.5 * .7
def wind(dur, speed_fn):
    n = int(dur * SR); x = noise(n); t = T(n)
    s = speed_fn(t)  # 0..1
    lo = lp(x, 400); mid = bp(x, 400, 2500); hi = bp(x, 2500, 7000)
    out = lo * (.3 + .7 * s) + mid * s ** 1.3 * .8 + hi * s ** 2 * .4
    # rattle
    r = (rng.random(n) < (40 * s / SR)).astype(float); out += bp(r, 800, 4000) * 3 * s
    return out * .6
def whir(t0, t1, wfn, stop_t=None):
    n = int((t1 - t0) * SR); t = T(n) + t0; w = wfn(t)
    f = 70 + 22 * w; ph = 2 * np.pi * np.cumsum(f) / SR
    x = .5 * np.sin(ph) + .25 * np.sin(2 * ph) + .12 * sg.sawtooth(4 * ph)
    x = lp(x, 2500)
    # ratchet clicks: 2 per revolution of the flyweights * 6 teeth
    rev = np.cumsum(w / (2 * np.pi)) / SR * 6; clk = (np.diff(np.floor(rev), prepend=0) > 0).astype(float)
    clicks = sg.fftconvolve(clk, ping(3200)[:2000] + .5 * ping(1900)[:2000])[:n]
    x = x * (0.3 + .7 * np.clip(w / 12, 0, 1)) + clicks * .5
    if stop_t is not None:
        k = int((stop_t - t0) * SR); x[k:] *= np.exp(-T(n - k) / .03)
    return x * .55
def screech(dur, inten):
    n = int(dur * SR); t = T(n); I = inten(t)
    x = np.zeros(n)
    for f, a in [(1180, 1), (1730, .7), (2460, .5), (3350, .3)]:
        fm = f * (1 + .03 * np.sin(2 * np.pi * (5 + rng.random() * 4) * t) + .02 * lp(noise(n), 3))
        x += a * np.sin(2 * np.pi * np.cumsum(fm) / SR)
    x *= (0.6 + .4 * np.abs(lp(noise(n), 30) * 8).clip(0, 1))
    x += 1.4 * bp(noise(n), 600, 6000)
    cr = (rng.random(n) < (900 * I / SR)).astype(float) * rng.random(n)
    x += 4 * hp(cr, 3000)
    x += .8 * lp(noise(n), 200)
    return x * I * .35
def crowd(dur, level_fn):
    n = int(dur * SR); t = T(n); out = np.zeros(n)
    for v in range(14):
        f0 = rng.uniform(300, 900); f1 = f0 * rng.uniform(2.2, 3.5)
        syl = (.5 + .5 * np.sin(2 * np.pi * rng.uniform(3, 6) * t + rng.uniform(0, 6))) ** 2 * (lp(noise(n), 1.5) > 0)
        out += bp(noise(n), f0, f1) * syl * rng.uniform(.5, 1)
    return lp(out, 3500) * level_fn(t) * .25
def gasp(dur=1.0):
    n = int(dur * SR); t = T(n)
    return bp(noise(n), 900, 5000) * np.exp(-((t - .18) / .12) ** 2) * 1.2 + bp(noise(n), 300, 1200) * np.exp(-((t - .2) / .2) ** 2) * .5
def applause(dur, lvl_fn):
    n = int(dur * SR); t = T(n); out = np.zeros(n)
    clap = hp(noise(int(.03 * SR)), 900) * env_exp(int(.03 * SR), .006)
    rate = 260 * lvl_fn(t)
    imp = (rng.random(n) < rate / SR) * rng.uniform(.3, 1, n)
    out = sg.fftconvolve(imp, clap)[:n]
    return verb(bp(out, 500, 8000), .4) * .6
def boing(f=210, ln=1.0):
    n = int(ln * SR); t = T(n)
    return np.sin(2 * np.pi * np.cumsum(f * (1 + .08 * np.sin(2 * np.pi * 13 * t) * np.exp(-t / .3))) / SR) * np.exp(-t / .25) * .5
def chop():
    n = int(.6 * SR); t = T(n)
    x = 1.5 * bp(noise(n), 300, 3000) * np.exp(-t / .02) + np.sin(2 * np.pi * 110 * t) * np.exp(-t / .08)
    return x
def crackle(dur, rate=25):
    n = int(dur * SR); imp = (rng.random(n) < rate / SR) * rng.uniform(-1, 1, n)
    return hp(imp, 1500) * 1.5 + .02 * lp(noise(n), 600)
def hum(dur, f=50, lvl=.3):
    n = int(dur * SR); t = T(n)
    return (np.sin(2 * np.pi * f * t) + .5 * np.sin(2 * np.pi * 2 * f * t) + .2 * np.sin(2 * np.pi * 3 * f * t)) * lvl + .05 * lp(noise(n), 300)

# ---------- place SFX ----------
place(sfx, 0.0, fade(lp(noise(int(2.1 * SR)), 500) * .02 + hum(2.1, 60, .015), .2, .05))
place(sfx, 0.12, ding(), .28)
place(sfx, 0.28, slide(1.25), .2, .1)
place(sfx, 1.52, thud(70, .12, .5), .3); place(sfx, 1.53, clank(900, .1, .4, .4), .3)
for k in range(5): place(sfx, 1.76 + k * .06, hp(noise(int(.04 * SR)), 2000) * .3 + sg.sawtooth(2 * np.pi * 120 * T(int(.04 * SR))) * .2, .3)
# fray: creaks + wire pings
place(sfx, 2.1, hum(2.0, 45, .12), .2)
for t0, d in [(2.2, .7), (2.95, .6), (3.45, .5)]: place(sfx, t0, creak(d, 140 + 30 * t0, 220 + 30 * t0), .28)
fr = lambda t: (lambda u: u * u * (3 - 2 * u))(np.clip((t - 2.2) / 1.7, 0, 1))
tt = np.linspace(2.2, 4.0, 2000); fv = fr(tt)
for k in range(14):
    th = (k + 1) / 15.5; idx = np.argmax(fv > th)
    if fv[idx] > th: place(sfx, tt[idx], ping(2600 + 300 * (k % 5)), .22, (k % 3 - 1) * .4)
place(sfx, 4.02, snap(1.0), .6)
# machine room
place(sfx, 4.6, fade(hum(3.5, 50, .35) + .08 * np.sin(2 * np.pi * 620 * T(int(3.5 * SR))), .1, .2), .2)
for k in range(int(3.5 / .5)): place(sfx, 4.6 + k * .5 + .1, ping(900)[:3000] * .5, .2)
# highlight ticks
for i in range(6): place(sfx, 8.95 + .2 * i, ping(1400 * 2 ** (i / 12 * 2)) * .8, .3, -.5 + .2 * i)
place(sfx, 11.3, whoosh(.6, 200, 2000, False), .25); place(sfx, 13.85, whoosh(.6, 200, 2000, True), .2)
# tension
for t0, d in [(14.6, .9), (15.6, .8), (16.4, .7)]: place(sfx, t0, creak(d, 120, 200), .3 + .08 * (t0 - 14.6))
place(sfx, 15.0, fade(lp(noise(int(2.3 * SR)), 150) * np.linspace(0, 1, int(2.3 * SR)) ** 2, .1, .05), .5)
for i in range(6): place(sfx, 17.55 + .012 * i, snap(.6), .4, (i - 2.5) * .25)
# slow-mo
n = int(2.0 * SR); place(sfx, 17.75, verb(lp(noise(n), 300) * np.sin(np.pi * T(n) / 2.0) + .6 * np.sin(2 * np.pi * 38 * T(n)) * np.exp(-T(n) / .8), .5), .45)
# drop + fall wind
place(sfx, 20.18, thud(48, .25, .6, 1.0), .7); place(sfx, 20.2, clank(300, .3, .8, .8), .35)
place(sfx, 20.2, wind(3.45, lambda t: np.clip(t / 2.0, 0, 1)), .42)
for k in range(5): place(sfx, 20.9 + k * .32, whoosh(.25, 300, 2500), .25, (k % 2) * .6 - .3)
place(sfx, 22.2, whoosh(1.4, 120, 4000, True), .6)
# governor
wfn = lambda t: np.where(t < 23.65, 2.0, np.minimum(12, 2 + 1.6 * (t - 23.65)))
place(sfx, 22.9, whir(22.9, 33.35, wfn, 33.15), .28)
place(sfx, 30.95, verb(bp(noise(int(.6 * SR)), 2000, 8000) * np.sin(np.pi * T(int(.6 * SR)) / .6) * .6 + clank(1200, .15, .6, .5), .3), .5)
place(sfx, 32.25, clank(700, .2, .8, 1.2) + thud(120, .05, .8, .3)[:int(.8 * SR)] if False else clank(700, .2, .8, 1.2), .6)
place(sfx, 33.15, clank(260, .5, 1.5, 1.6) + np.pad(thud(60, .2, .8, 1.0), (0, int(.5 * SR))), .55)
# rope yank + wedges, falling continues
place(sfx, 34.8, wind(3.0, lambda t: np.ones_like(t)), .3)
place(sfx, 35.25, clank(330, .3, .9, 1.0) + np.pad(thud(80, .1, .6, .5), (0, int(.4 * SR))), .55)
place(sfx, 35.95, ping(1800), .25)
# screech & sparks
inten = lambda t: np.clip((t) / .12, 0, 1) * np.clip((2.67 - t) / 2.67 + .25, 0, 1) * (t < 2.67)
place(sfx, 37.78, verb(screech(2.9, inten), .3), .5)
place(sfx, 37.78, clank(200, .4, 1.2, 1.5), .45)
# stop thud
place(sfx, 40.43, thud(42, .2, .9, 1.8) * 1.4, .7); place(sfx, 40.44, clank(240, .4, 1.8, 1.0), .35)
for t0 in [40.95, 41.25, 41.6]: place(sfx, t0, thud(150, .04, .5, .3), .2, rng.uniform(-.5, .5))
for k in range(6): place(sfx, 41.0 + k * .23, ping(4200 + 300 * k)[:4000] * .4, .15)
place(sfx, 41.2, creak(.9, 90, 120), .35)
# 1854 transition + crowd
place(sfx, 42.25, whoosh(.5, 300, 6000, False), .4)
place(sfx, 42.4, crackle(13.7, 18), .25)
place(sfx, 42.4, crowd(13.7, lambda t: np.interp(t, [0, 1, 7.3, 7.6, 8.2, 11, 13.7], [.4, .8, .8, .2, .5, .9, .7])), .7)
place(sfx, 49.82, chop(), .8); place(sfx, 49.83, snap(.5), .35)
place(sfx, 49.95, gasp(1.0), .4)
place(sfx, 50.85, boing(230, 1.2), .3); place(sfx, 50.8, creak(1.6, 80, 110), .35)
place(sfx, 52.62, clank(500, .25, 1.0, 1.0) + np.pad(thud(90, .1, .7, .6), (0, int(.4 * SR))), .35)
place(sfx, 55.3, applause(1.3, lambda t: np.interp(t, [0, .25, .7, 1.3], [0, 1, .6, 0])), .6)
place(sfx, 55.3, crowd(1.2, lambda t: np.interp(t, [0, .2, .7, 1.2], [0, 1.4, .8, 0])), .5)
# city
place(sfx, 55.95, whoosh(.5, 400, 8000, True), .25)
place(sfx, 56.1, fade(lp(noise(int(4.4 * SR)), 300) * .25 + bp(noise(int(4.4 * SR)), 600, 2000) * .03, .2, 1.0), .12)
n = int(4.0 * SR); place(sfx, 56.3, fade(np.sin(2 * np.pi * np.cumsum(90 + 40 * T(n) / 4) / SR) * .15, .3, .8), .1)

# ---------- MUSIC ----------
def pad(dur, freqs, cutoff=900, lvl=.2, det=.006):
    n = int(dur * SR); t = T(n); x = np.zeros(n)
    for f in freqs:
        for d in (-det, 0, det):
            x += sg.sawtooth(2 * np.pi * f * (1 + d) * t + rng.uniform(0, 6))
    return lp(x, cutoff) * lvl / len(freqs)
def kick(f=55):
    n = int(.4 * SR); t = T(n)
    return np.sin(2 * np.pi * f * t * (1 + 2 * np.exp(-t / .02))) * np.exp(-t / .12)
def pluck(f, ln=1.2, b=.6):
    n = int(ln * SR); t = T(n)
    return sum(a * np.sin(2 * np.pi * f * h * t) * np.exp(-t / (b / h)) for h, a in [(1, 1), (2, .4), (3, .2), (4, .1)])
D = 73.42
# section A 0-17.3: low drone + ticking pulse
place(mus, 0, fade(pad(17.4, [D, D * 1.5], 500, .35), 1.0, .05))
bpm = 100; beat = 60 / bpm
for k in range(int(17.3 / beat)):
    tk = k * beat
    place(mus, tk, kick(50) * (.4 + .3 * (tk > 8)), .45)
    if tk > 4.5: place(mus, tk + beat / 2, hp(noise(int(.05 * SR)), 6000) * env_exp(int(.05 * SR), .01), .2)
n = int(2.85 * SR); place(mus, 14.45, pad(2.85, [D * 2, D * 2 * 1.189, D * 3], 600, .6) * np.linspace(0, 1, n) ** 2)
# section B 17.3-40.55: driving ostinato
place(mus, 17.3, fade(pad(23.3, [D, D * 1.5, D * 2], 700, .55), .05, .02))
bpm = 120; s16 = 60 / bpm / 4; notes = [D / 2, D / 2, D / 2 * 1.189, D / 2, D / 2 * 1.335, D / 2, D / 2 * 1.189, D / 2 * 1.5]
k = 0; tk = 20.2
while tk < 40.4:
    f = notes[k % 8]; ln = int(s16 * .9 * SR)
    x = lp(sg.sawtooth(2 * np.pi * f * T(ln)), 500) * env_exp(ln, .08)
    g = .35 + .4 * min(1, (tk - 20.2) / 17)
    place(mus, tk, x, g)
    if k % 4 == 0: place(mus, tk, kick(48), .55 + .2 * (tk > 34.8))
    k += 1; tk += s16
n = int((40.55 - 23.65) * SR); place(mus, 23.65, pad(40.55 - 23.65, [D * 4, D * 4 * 1.189, D * 4 * 1.5], 1500, .3) * np.linspace(.2, 1, n) ** 2)
# hard stop at 40.55 handled by gating below
# section C 42.4-56.1: warm music-box arpeggio (D major)
arp = [D * 4, D * 4 * 1.26, D * 4 * 1.5, D * 8, D * 4 * 1.5, D * 4 * 1.26]
tk = 42.6; k = 0
while tk < 55.9:
    place(mus, tk, pluck(arp[k % 6] * (1.335 if 48.95 < tk < 52.5 else 1), 1.0, .5), .18 * (0.4 if 48.95 < tk < 52.6 else 1))
    k += 1; tk += .3
place(mus, 42.4, fade(pad(13.7, [D * 2, D * 2 * 1.26, D * 3], 700, .3), 1.0, .5))
# section D 56.1-60.5: swell + final hit
n = int(4.4 * SR); place(mus, 56.1, fade(pad(4.4, [D, D * 2, D * 2 * 1.26, D * 3, D * 4], 1800, .25) * np.linspace(.4, 1, n), .05, 1.2))
place(mus, 59.2, verb(np.pad(kick(40) * 2, (0, int(.9 * SR))) + clank(150, .8, 1.3, .6), .6), .7)
# gate music: silence 40.55-42.4
g = np.ones(N); a, b = int(40.43 * SR), int(42.4 * SR); g[a:b] = 0; g[b:b + int(.5 * SR)] = np.linspace(0, 1, int(.5 * SR))
g[a - 200:a] = np.linspace(1, 0, 200); mus *= g[:, None]
# also silence music briefly at the 17.3 snap for impact
a = int(17.55 * SR); mus[a:a + int(.15 * SR)] *= np.linspace(0, 1, int(.15 * SR))[:, None]

def write(name, x, peak=.9, ref=None):
    print(name, 'raw peak', np.max(np.abs(x)))
    x = x / (ref if ref else max(1e-9, np.max(np.abs(x)))) * peak
    x = np.clip(x, -1, 1)
    wf.write(name, SR, (x * 32767).astype(np.int16))
write('./sfx.wav', sfx, ref=SFXREF); write('./music.wav', mus)
print("ok")
