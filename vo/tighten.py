"""Tighten a voiceover: shrink silent runs between words to per-context targets.

Usage: python3 vo/tighten.py in_48k.wav words.json out.wav out_words.json [targets.json]
- Only silent runs (10 ms frames below -45 dBFS, >= 0.12 s) that sit between two words are shrunk.
- Speech, breaths and intentional sounds (e.g. [exhales]) are never cut.
- Cuts remove the middle of a run with a 40 ms equal-power crossfade (smooth joins).
- Word times are remapped through the edit (words.json from ElevenLabs Scribe).
targets.json (optional): {"<word index of the word BEFORE the pause>": seconds} overrides.
"""
import sys, json, numpy as np, scipy.io.wavfile as w

import os
SIL_DB, MIN_RUN = -45.0, 0.12
# Smooth defaults (user asked for smoother transitions): longer equal-power crossfades,
# natural breathing room between sentences. Override with env vars if needed.
XF = float(os.environ.get('VO_XF', 0.04))
T_COMMA = float(os.environ.get('VO_T_COMMA', 0.12))
T_SENT = float(os.environ.get('VO_T_SENT', 0.24))

def main(inp, wj, out, outj, tj=None):
    sr, x = w.read(inp); x = x.astype(np.float32)
    words = [q for q in json.load(open(wj))['words'] if q['type'] == 'word']
    over = {int(k): v for k, v in json.load(open(tj)).items()} if tj else {}
    hop = int(0.01 * sr); n = len(x) // hop
    db = np.array([20*np.log10(np.sqrt(np.mean(x[i*hop:(i+1)*hop]**2)) + 1e-9) for i in range(n)])
    sil = db < SIL_DB
    runs, i = [], 0
    while i < n:
        if sil[i]:
            j = i
            while j < n and sil[j]: j += 1
            runs.append((i*0.01, j*0.01)); i = j
        else: i += 1
    # which pause does each run belong to?
    cuts = []  # (start, end) of audio to remove
    for a, b in runs:
        if b - a < MIN_RUN: continue
        mid = (a + b) / 2
        k = next((k for k in range(len(words)-1) if words[k]['end'] - 0.08 <= mid <= words[k+1]['start'] + 0.08), None)
        if k is None: continue  # inside a word or before/after the speech: handled separately
        t = over.get(k, T_SENT if words[k]['text'][-1] in '.?!' else T_COMMA)
        if b - a <= t: continue
        keep_head = t / 2 + XF / 2
        cuts.append((a + keep_head, b - (t - t / 2) - XF / 2))
    # trim head/tail silence
    first = words[0]['start']; last = words[-1]['end']
    nz = np.where(~sil)[0]
    head = max(0.0, nz[nz*0.01 >= first - 0.3][0]*0.01 - 0.02)
    tail = min(len(x)/sr, nz[nz*0.01 <= last + 0.4][-1]*0.01 + 0.01 + 0.25)
    # assemble with crossfades
    segs, pos = [], head
    for c0, c1 in cuts:
        segs.append((pos, c0 + XF)); pos = c1
    segs.append((pos, tail))
    fade = np.sin(np.linspace(0, np.pi/2, int(XF*sr)))**2
    y = x[int(segs[0][0]*sr):int(segs[0][1]*sr)].copy()
    for s0, s1 in segs[1:]:
        z = x[int(s0*sr):int(s1*sr)].copy(); L = len(fade)
        y[-L:] = y[-L:]*fade[::-1] + z[:L]*fade
        y = np.concatenate([y, z[L:]])
    w.write(out, sr, y)
    # remap word times: removed time before t
    removed = [(head, 0.0)]  # cumulative removal points
    def remap(t):
        r = head
        for c0, c1 in cuts:
            if t >= c1: r += (c1 - c0)
            elif t > c0: r += (t - c0)
        return round(max(0.0, t - r), 3)
    nw = [{**q, 'start': remap(q['start']), 'end': remap(q['end'])} for q in words]
    json.dump({'words': nw, 'source': inp, 'cuts': [[round(a,3), round(b,3)] for a, b in cuts],
               'head_trim': round(head,3), 'duration': round(len(y)/sr,3)}, open(outj, 'w'), indent=1)
    print(f"in {len(x)/sr:.2f}s -> out {len(y)/sr:.2f}s, {len(cuts)} cuts, head trim {head:.2f}s")

if __name__ == '__main__':
    main(*sys.argv[1:])
