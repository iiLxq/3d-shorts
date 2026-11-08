import re, json, numpy as np, scipy.io.wavfile as w

sr, x = w.read('./vo.wav'); x = x.astype(np.float32) / 32768
hop = 160
rms = np.sqrt(np.array([np.mean(x[i*hop:(i+1)*hop]**2) for i in range(len(x)//hop)]) + 1e-12)
voiced = 20*np.log10(rms) > -38

P = [
 (0.53, 1.82, "What ACTUALLY happens..."),
 (2.08, 4.21, "if the cable on your elevator snaps?"),
 (4.77, 5.17, "First —"),
 (5.45, 7.35, "there's almost never just one cable."),
 (8.14, 10.44, "Most elevators hang from several steel ropes,"),
 (11.0, 13.72, "and each one is strong enough to hold the car on its own."),
 (14.45, 15.15, "But say..."),
 (15.56, 17.6, "every single one breaks."),
 (18.15, 19.03, "At the same time."),
 (19.79, 20.72, "The car drops."),
 (21.07, 22.07, "It's picking up speed."),
 (22.29, 23.55, "And up at the top of the shaft,"),
 (23.73, 26.67, "one little wheel is spinning faster..."),
 (27.05, 27.85, "and faster..."),
 (28.46, 29.66, "That's the governor."),
 (29.92, 30.74, "When it spins too fast,"),
 (30.93, 31.59, "weights inside fling outward,"),
 (31.82, 32.47, "trip a latch —"),
 (32.76, 34.25, "and it LOCKS onto a second rope."),
 (34.82, 37.58, "That rope yanks up on steel wedges under the car,"),
 (37.77, 39.16, "and jams them into the guide rails."),
 (40.55, 40.95, "Stopped."),
 (42.42, 44.83, "And it all started in 1854..."),
 (45.29, 48.69, "when Elisha Otis stood on a raised platform in front of a crowd,"),
 (48.95, 49.99, "and ordered the rope cut."),
 (50.70, 51.84, "It dropped a few inches..."),
 (52.31, 52.68, "and stopped."),
 (53.41, 54.47, "\"All safe, gentlemen.\""),
 (54.76, 55.26, "\"All safe.\""),
 (56.14, 56.98, "That one brake..."),
 (57.60, 59.17, "is why skyscrapers exist."),
]
OVR = {"1854": 4, "elevator": 4, "elevators": 4, "actually": 4, "every": 3, "several": 3, "governor": 3,
       "elisha": 3, "otis": 2, "skyscrapers": 3, "inches": 2, "gentlemen": 3, "started": 2, "dropped": 1,
       "stopped": 1, "ordered": 2, "wedges": 2, "outward": 2, "inside": 2, "platform": 2, "faster": 2, "there's": 1, "that's": 1, "it's": 1}
def syl(wd):
    k = re.sub(r"[^a-z0-9']", "", wd.lower())
    if k in OVR: return OVR[k]
    k2 = re.sub(r"e$", "", k)
    return max(1, len(re.findall(r"[aeiouy]+", k2)))

words = []
for a, b, text in P:
    toks = [t for t in text.split() if t != "—"]
    fa, fb = int(a*100), int(b*100)
    mask = voiced[fa:fb]
    cum = np.cumsum(mask); tot = cum[-1] if cum[-1] > 0 else len(mask)
    weights = [syl(t) for t in toks]; W = sum(weights)
    acc = 0
    def at(frac):
        target = frac * tot
        idx = int(np.searchsorted(cum, target)) if cum[-1] > 0 else int(frac*len(mask))
        return a + min(idx, len(mask)) / 100
    for t, wgt in zip(toks, weights):
        s0 = at(acc / W); acc += wgt; s1 = at(acc / W)
        words.append({"w": t, "s": round(s0, 3), "e": round(max(s1, s0 + .08), 3)})
    words[-1]["end_phrase"] = True

def clean(t):
    return re.sub(r"[\"]", "", t).replace("...", "").upper()

# chunk: split each phrase evenly into chunks of 2-3 words
chunks = []
ph = []
for wd in words:
    ph.append(wd)
    if wd.get("end_phrase"):
        n = len(ph); k = max(1, -(-n // 3))
        if n == 4: k = 2
        sizes = [n // k + (1 if i < n % k else 0) for i in range(k)]
        i = 0
        for sz in sizes:
            c = ph[i:i+sz]; i += sz
            if len(" ".join(clean(o["w"]) for o in c)) > 17 and len(c) > 1:
                m = (len(c) + 1) // 2 if len(c) > 2 else 1
                chunks.append(c[:m]); chunks.append(c[m:])
            else:
                chunks.append(c)
        ph = []

def ts(t):
    h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return f"{h}:{m:02d}:{s:05.2f}"

hdr = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Inter ExtraBold,86,&H00FFFFFF,&H00FFFFFF,&H00000000,&H90000000,1,0,0,0,100,100,1,0,1,7,4,5,60,60,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
ev = []
Y = 1180
for ci, ch in enumerate(chunks):
    start = ch[0]["s"]
    nxt = chunks[ci+1][0]["s"] if ci + 1 < len(chunks) else 99
    end = ch[-1]["e"] + 0.25
    if nxt - end < 0.35: end = nxt
    end = min(end, nxt)
    for wi, wd in enumerate(ch):
        ws = start if wi == 0 else wd["s"]
        we = ch[wi+1]["s"] if wi + 1 < len(ch) else end
        parts = []
        for k, o in enumerate(ch):
            t = clean(o["w"])
            if k == wi:
                parts.append(r"{\c&H00D4FF&\fscx112\fscy112}" + t + r"{\c&HFFFFFF&\fscx100\fscy100}")
            else:
                parts.append(t)
        pop = r"\t(0,90,\fscx104\fscy104)\t(90,160,\fscx100\fscy100)" if wi == 0 else ""
        ev.append(f"Dialogue: 0,{ts(ws)},{ts(we)},Cap,,0,0,0,,{{\\pos(540,{Y}){pop}}}" + " ".join(parts))
open('./captions.ass', 'w').write(hdr + "\n".join(ev) + "\n")
json.dump(words, open('./words.json', 'w'), indent=0)
for ch in chunks:
    print(f'{ch[0]["s"]:6.2f}-{ch[-1]["e"]:6.2f}  ' + " ".join(clean(c["w"]) for c in ch))
