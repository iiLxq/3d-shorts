// Subtitle chunker: exact script text + Scribe-style word timings -> 1-3 word chunks.
// Displayed text ALWAYS comes from the script. Timings come from the aligned ASR words.
// Pure TypeScript, no dependencies (runs in Node and in the Remotion bundle).

export type AsrWord = { text: string; start: number; end: number; type?: string };
export type Tone = "white" | "danger" | "safe" | "person";
export type Chunk = {
  text: string; // exact script text (punctuation + capitalisation kept)
  start: number; // seconds, on-screen start (first word start minus lead)
  end: number; // seconds, on-screen end
  emphasis: boolean; // at most one per sentence
  tone: Tone; // colour code when emphasised ("white" = size/weight only)
  fadeOut: boolean; // true when a real pause follows: calm fade-out at the end
  sentence: number; // sentence index
  words: number; // spoken word count (1..3)
  wordStart: number; // seconds: aligned start of first word (validation)
  wordEnd: number;
  firstWord: number; // index of the first script word
};
export type ChunkOptions = {
  fps?: number;
  leadFrames?: number; // show chunk this many frames before the word (default 1)
  minFrames?: number; // min on-screen frames (default 8)
  maxWords?: number; // default 3
  holdAfter?: number; // s to hold a chunk after its last word when a pause follows (0.3)
  joinGap?: number; // gaps up to this many s are bridged by holding the chunk (0.45)
  overrides?: Record<string, EmphasisOverride>; // key = lower-case chunk text w/o punctuation
  autoEmphasis?: boolean; // default true
};
export type EmphasisOverride = null | "none" | "white" | "danger" | "safe" | "person";

export type ScriptWord = { text: string; norm: string; after: string; idx: number; sentence: number };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Extract the "VO only" section (plain paragraphs) from a SCRIPT.md. */
export function extractVoOnly(md: string): string {
  const m = md.match(/^##\s*VO only\s*$([\s\S]*?)(?=^---\s*$|^##\s)/m);
  if (!m) throw new Error("no '## VO only' section");
  return m[1].trim();
}

/** Tokenise the script. A standalone dash is kept as `after` of the previous word. */
export function tokenizeScript(text: string): ScriptWord[] {
  const raw = text.split(/\s+/).filter(Boolean);
  const out: ScriptWord[] = [];
  let sentence = 0;
  for (const t of raw) {
    if (/^[—–-]+$/.test(t)) {
      if (out.length) out[out.length - 1].after = " " + t;
      continue;
    }
    out.push({ text: t, norm: norm(t), after: "", idx: out.length, sentence });
    if (/[.?!]["')\]]*$/.test(t) && !/(\.\.\.|…)$/.test(t)) sentence++;
  }
  return out;
}

function lev(a: string, b: string): number {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
const sim = (a: string, b: string) => (a === b ? 1 : a && b ? 1 - lev(a, b) / Math.max(a.length, b.length) : 0);

export type Aligned = ScriptWord & { start: number; end: number; matched: boolean };

/** Needleman-Wunsch alignment of script words to ASR words (tolerant to spelling/punctuation). */
export function alignWords(script: ScriptWord[], asr: AsrWord[]): Aligned[] {
  const A = asr.filter((w) => (w.type ?? "word") === "word" && norm(w.text));
  const n = script.length, m = A.length;
  const GAP = -1.5;
  const S: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(-1e9));
  const B: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0)); // 1 diag, 2 up(script gap), 3 left(asr gap), 4 script<-2 asr
  S[0][0] = 0;
  for (let i = 0; i <= n; i++)
    for (let j = 0; j <= m; j++) {
      const cur = S[i][j];
      if (cur < -1e8) continue;
      const upd = (ni: number, nj: number, sc: number, b: number) => {
        if (ni <= n && nj <= m && cur + sc > S[ni][nj]) { S[ni][nj] = cur + sc; B[ni][nj] = b; }
      };
      if (i < n && j < m) {
        const s = sim(script[i].norm, norm(A[j].text));
        upd(i + 1, j + 1, s >= 0.5 ? 3 * s : -2 + s, 1);
      }
      if (i < n) upd(i + 1, j, GAP, 2);
      if (j < m) upd(i, j + 1, GAP, 3);
      if (i < n && j + 1 < m) { // one script word spoken as two ASR words ("forty-one" -> "forty one")
        const s = sim(script[i].norm, norm(A[j].text) + norm(A[j + 1].text));
        if (s >= 0.75) upd(i + 1, j + 2, 3 * s, 4);
      }
    }
  const res: Aligned[] = script.map((w) => ({ ...w, start: NaN, end: NaN, matched: false }));
  let i = n, j = m;
  while (i > 0 || j > 0) {
    const b = B[i][j];
    if (i > 0 && j > 0 && b === 1) { res[i - 1].start = A[j - 1].start; res[i - 1].end = A[j - 1].end; res[i - 1].matched = true; i--; j--; }
    else if (i > 0 && b === 2) i--;
    else if (j > 0 && b === 3) j--;
    else if (i > 0 && j > 1 && b === 4) { res[i - 1].start = A[j - 2].start; res[i - 1].end = A[j - 1].end; res[i - 1].matched = true; i--; j -= 2; }
    else break;
  }
  // interpolate unmatched script words between matched neighbours
  for (let k = 0; k < n; k++) {
    if (res[k].matched) continue;
    let a = k - 1; while (a >= 0 && !res[a].matched) a--;
    let c = k + 1; while (c < n && !res[c].matched) c++;
    const t0 = a >= 0 ? res[a].end : (c < n ? res[c].start - 0.3 * (c - k) : 0);
    const t1 = c < n ? res[c].start : t0 + 0.3 * (c - a);
    const cnt = c - a - 1, pos = k - a - 1;
    res[k].start = t0 + ((t1 - t0) * pos) / cnt;
    res[k].end = t0 + ((t1 - t0) * (pos + 1)) / cnt;
  }
  return res;
}

// ---------------------------------------------------------------- chunking
const WEAK = new Set("a an the of in on at to for with by from into onto and or but that this these those is was are were be it its as than if so your my his her their our them they he she we you i not no nor out up off over under about per via when while because who which what like had has have do does did can could would will".split(" "));
// "no", "you", "up", "out", "what", "back" are weak only as chunk END (they still can end a chunk at a phrase end)
const NOT_WEAK_END = new Set(["you", "it", "back", "them", "away", "anyway"]);
const DETERMINERS = new Set("a an the your my his her their our this these those its no".split(" "));
const AUX = new Set("is was are were be had has have do does did can could would will".split(" "));
const PHRASAL_OK = new Set(["run on", "powered by", "mixed up", "spins up", "pops open", "drops in", "ran dry"]);
// pairs that must stay together (normalised bigrams)
const KEEP = new Set(["almost never", "almost twenty", "just one", "no engines", "no power", "no serious", "ten feet", "feet forward", "forty one", "fortyone thousand", "twentyfive more", "glider pilot", "air canada", "canada 143", "little propeller", "tiny windmill", "giant glider", "more than", "every foot", "pounds and", "and kilograms", "ran dry", "hydraulic pressure", "forty one", "kept flying", "what saves", "saves you", "more years"]);
const isPunctEnd = (t: string) => /[,;:.?!…—–]$/.test(t) || /\.\.\.$/.test(t);

type Phrase = Aligned[];

function chunkPhrase(ph: Phrase, nextStart: number | null, o: Required<Pick<ChunkOptions, "fps" | "minFrames" | "maxWords">>): Aligned[][] {
  const n = ph.length;
  const best: number[] = Array(n + 1).fill(Infinity), from: number[] = Array(n + 1).fill(-1);
  best[0] = 0;
  const minDur = o.minFrames / o.fps;
  for (let i = 0; i < n; i++) {
    if (best[i] === Infinity) continue;
    for (let L = 1; L <= o.maxWords && i + L <= n; L++) {
      const j = i + L;
      const ws = ph.slice(i, j);
      let c = 1.0 + (L === 1 ? 0.9 : L === 3 ? 0.35 : 0);
      const last = ws[L - 1];
      const lastIsPhraseEnd = j === n;
      if (!lastIsPhraseEnd) {
        const ln = last.norm;
        const pair2 = L > 1 ? ws[L - 2].norm + " " + ln : "";
        if (DETERMINERS.has(ln)) c += 8;
        else if (AUX.has(ln)) c += 5;
        else if (WEAK.has(ln) && !NOT_WEAK_END.has(ln) && !PHRASAL_OK.has(pair2)) c += 8;
        // keep-together pairs across the boundary
        if (KEEP.has(last.norm + " " + ph[j].norm)) c += 14;
        // rhythm: a natural pause after the chunk is a good place to cut
        const gap = ph[j].start - last.end;
        c -= Math.min(Math.max(gap, 0), 0.4) * 5;
        // an article/preposition + its noun is a unit
        if (L === 1 && WEAK.has(ln)) c += 3;
      }
      if (ws.every((w) => WEAK.has(w.norm) && !lastIsPhraseEnd)) c += 3;
      if (L > 1 && KEEP.has(ws[0].norm + " " + ws[1].norm)) c -= 0.8; // bonus for kept pair inside
      if (L === 3 && KEEP.has(ws[1].norm + " " + ws[2].norm)) c -= 0.8;
      const chars = ws.reduce((a, w) => a + w.text.length + 1, 0);
      if (chars > 22) c += (chars - 22) * 0.4;
      const nextT = j < n ? ph[j].start : (nextStart ?? last.end + 0.3);
      if (nextT - ws[0].start < minDur) c += 6;
      if (best[i] + c < best[j]) { best[j] = best[i] + c; from[j] = i; }
    }
  }
  const out: Aligned[][] = [];
  for (let j = n; j > 0; j = from[j]) out.unshift(ph.slice(from[j], j));
  return out;
}

// ---------------------------------------------------------------- emphasis
const LEX: Record<string, Tone> = {
  die: "danger", dark: "danger", draining: "danger", heavier: "danger", rock: "danger", dry: "danger", power: "danger", fall: "danger", injuries: "danger", mixed: "danger", unluckily: "danger",
  saves: "safe", windmill: "safe", propeller: "safe", back: "safe", landed: "safe", flying: "safe", pinwheel: "safe", glides: "safe", luckily: "safe",
  captain: "person", pilot: "person", someone: "person", you: "person",
};
const NUMWORDS = /^(forty|fortyone|twentyfive|twenty|thirty|ten|one|two|three|1983|143|41|25)$/;

function scoreChunk(c: Aligned[], posInSentence: number, total: number): { s: number; tone: Tone } {
  let s = 0, tone: Tone = "white";
  for (const w of c) {
    const n = w.norm;
    if (WEAK.has(n) && !LEX[n]) continue;
    s += 0.6 + Math.min(w.norm.length, 10) * 0.12;
    if (LEX[n]) { s += 2.2; tone = LEX[n]; }
    if (NUMWORDS.test(n)) s += 1.2;
    if (/[A-Z]/.test(w.text[0]) && w.idx !== 0 && posInSentence > 0) s += 0.8; // proper noun
  }
  if (c.length === 1) s += 0.6;
  { const l = c[c.length - 1]; if (WEAK.has(l.norm) && !/[,.;:!?…—]$/.test(l.text)) s -= 3; }
  if (posInSentence === total - 1) s += 0.5; // sentence landing
  if (posInSentence === 0) s -= 0.3;
  return { s, tone };
}

/** Build the chunk track. */
export function buildChunks(scriptText: string, asr: AsrWord[], opt: ChunkOptions = {}): Chunk[] {
  const o = { fps: 30, leadFrames: 1, minFrames: 8, maxWords: 3, holdAfter: 0.3, joinGap: 0.45, autoEmphasis: true, overrides: {} as Record<string, EmphasisOverride>, ...opt };
  const words = alignWords(tokenizeScript(scriptText), asr);
  // phrases: break after any punctuated word
  const phrases: Phrase[] = [];
  let cur: Phrase = [];
  for (const w of words) { cur.push(w); if (isPunctEnd(w.text) || w.after) { phrases.push(cur); cur = []; } }
  if (cur.length) phrases.push(cur);

  const chunks: Chunk[] = [];
  const lead = o.leadFrames / o.fps;
  phrases.forEach((ph, pi) => {
    const nextStart = pi + 1 < phrases.length ? phrases[pi + 1][0].start : null;
    for (const cw of chunkPhrase(ph, nextStart, o)) {
      chunks.push({
        text: cw.map((w) => w.text + w.after).join(" "),
        start: Math.max(0, cw[0].start - lead), end: cw[cw.length - 1].end,
        emphasis: false, tone: "white", fadeOut: false, sentence: cw[0].sentence, words: cw.length,
        wordStart: cw[0].start, wordEnd: cw[cw.length - 1].end, firstWord: cw[0].idx,
      });
    }
  });

  // timing: bridge small gaps, fade out on real pauses, enforce minimum on-screen time
  for (let k = 0; k < chunks.length; k++) {
    const c = chunks[k], nx = chunks[k + 1];
    const gap = nx ? nx.start - c.end : Infinity;
    if (nx && gap <= o.joinGap) c.end = nx.start;
    else { c.end = c.wordEnd + o.holdAfter; c.fadeOut = true; if (nx) c.end = Math.min(c.end, nx.start); }
    if (c.end - c.start < o.minFrames / o.fps) c.end = c.start + o.minFrames / o.fps;
    if (nx && c.end > nx.start) c.end = nx.start;
  }

  // emphasis: at most one per sentence
  if (o.autoEmphasis) {
    const bySent = new Map<number, number[]>();
    chunks.forEach((c, k) => { if (!bySent.has(c.sentence)) bySent.set(c.sentence, []); bySent.get(c.sentence)!.push(k); });
    let lastEmph = -9;
    const picks: { k: number; s: number; tone: Tone }[] = [];
    for (const [, ks] of bySent) {
      let bestK = -1, bestS = 2.6, bestTone: Tone = "white";
      ks.forEach((k, pos) => {
        if (k - lastEmph < 2) return; // not on consecutive chunks
        const { s, tone } = scoreChunk(words.filter((w) => w.idx >= chunks[k].firstWord && w.idx < chunks[k].firstWord + chunks[k].words), pos, ks.length);
        if (s > bestS) { bestS = s; bestK = k; bestTone = tone; }
      });
      if (bestK >= 0) { picks.push({ k: bestK, s: bestS, tone: bestTone }); lastEmph = bestK; }
    }
    picks.sort((a, b) => b.s - a.s);
    for (const p of picks.slice(0, Math.ceil(bySent.size * 0.5))) { chunks[p.k].emphasis = true; chunks[p.k].tone = p.tone; }
  }
  // manual overrides (key = lower-case chunk text without punctuation)
  const key = (t: string) => t.toLowerCase().replace(/[^a-z0-9' -]/g, "").replace(/\s+/g, " ").trim();
  for (const [k, v] of Object.entries(o.overrides)) {
    const re = new RegExp("(^| )" + key(k).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "( |$)");
    const hits = chunks.map((c, i) => [c, i] as const).filter(([c]) => re.test(key(c.text)));
    for (const [c] of hits) {
      for (const d of chunks) if (d.sentence === c.sentence && d !== c) { d.emphasis = false; d.tone = "white"; }
      if (v === null || v === "none") { c.emphasis = false; c.tone = "white"; }
      else { c.emphasis = true; c.tone = v; }
    }
  }
  return chunks;
}

export const secToFrame = (s: number, fps = 30) => Math.round(s * fps);

/** Plain-text list for owner approval. */
export function chunksToText(chunks: Chunk[], fps = 30): string {
  const lines: string[] = [];
  let sent = -1;
  for (const c of chunks) {
    if (c.sentence !== sent) { if (sent >= 0) lines.push(""); sent = c.sentence; }
    const tag = c.emphasis ? `  [EMPHASIS${c.tone !== "white" ? ":" + c.tone : ""}]` : "";
    lines.push(`${(c.start).toFixed(2).padStart(6)}  f${String(secToFrame(c.start, fps)).padStart(4)}  ${c.text}${tag}`);
  }
  return lines.join("\n") + "\n";
}
