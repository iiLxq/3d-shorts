// Validator: node bundle. Usage: sh cli/validate.sh   (from remotion/)  -> exit code 1 on any ERROR
import fs from "node:fs";
import path from "node:path";
// @ts-ignore (three ships opentype.js as an ES module without types)
import * as opentype from "three/examples/jsm/libs/opentype.module.js";
import { extractVoOnly, tokenizeScript, type Chunk } from "../chunker";
import { BAND, BASE_SIZE, EMPH_SCALE, FONTS, HARD_BOTTOM, MAX_TEXT_W, MIN_SIZE, SIDE_MARGIN, W, fitText, type FontKey } from "../layout";

const [scriptMd, wordsJson, chunksJson] = process.argv.slice(2);
const FPS = 30;
const text = extractVoOnly(fs.readFileSync(scriptMd, "utf8"));
const asr = (JSON.parse(fs.readFileSync(wordsJson, "utf8")).words as { text: string; start: number; end: number }[]);
const { chunks } = JSON.parse(fs.readFileSync(chunksJson, "utf8")) as { chunks: Chunk[] };
const errors: string[] = [], warns: string[] = [];
const err = (m: string) => errors.push(m), warn = (m: string) => warns.push(m);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
// chunks that may end on a function word only because no 1-3 word split avoids it (documented exceptions)
const EXCEPTIONS = new Set(["more than", "the captain was"]);
const PHRASAL = new Set(["run on", "powered by", "mixed up", "spins up", "pops open"]);
const WEAK_END = new Set("a an the of to at in on by for with from into onto and or but as than that this these those your my its their his her our like is was are were had has have do does did can could would will".split(" "));
const ARTPREP = new Set("a an the of in on at to for with by from into and or but that this your my its as than".split(" "));

// 1+2: text is exactly the script, in order
const script = tokenizeScript(text).map((w) => w.text + w.after).join(" ");
const joined = chunks.map((c) => c.text).join(" ");
if (joined !== script) {
  const a = joined.split(" "), b = script.split(" ");
  const i = a.findIndex((x, k) => x !== b[k]);
  err(`chunk text != script text (first diff at word ${i}: "${a[i]}" vs "${b[i]}")`);
}
// also verbatim check against the raw script (punctuation + capitalisation char by char, whitespace collapsed)
if (joined.replace(/ — /g, " — ") !== text.replace(/\s+/g, " ").replace(/\s*\n\s*/g, " ")) err("joined chunks differ from raw script text (whitespace-collapsed)");

let weakEnds = 0, sentenceEmph = new Map<number, number>();
chunks.forEach((c, i) => {
  const toks = c.text.split(" ").filter((t) => !/^[—–-]+$/.test(t));
  const where = `chunk ${i} "${c.text}"`;
  if (toks.length < 1 || toks.length > 3) err(`${where}: ${toks.length} words`);
  toks.slice(0, -1).forEach((t) => { if (/[,;:.?!…]$/.test(t)) err(`${where}: punctuation inside chunk ("${t}")`); });
  if (toks.every((t) => ARTPREP.has(norm(t)))) err(`${where}: only article/preposition words`);
  if (toks.length === 1 && ARTPREP.has(norm(toks[0]))) err(`${where}: lone article/preposition`);
  const last = norm(toks[toks.length - 1]);
  const lastTwo = toks.slice(-2).map(norm).join(" ");
  if (WEAK_END.has(last) && !/[,.;:!?…—]$/.test(c.text) && !PHRASAL.has(lastTwo)) {
    if (EXCEPTIONS.has(c.text.toLowerCase().replace(/[^a-z' ]/g, "").trim())) { weakEnds++; warn(`EXCEPTION (documented): chunk ${i} "${c.text}" ends on a function word; no 1-3 word split avoids it`); }
    else err(`${where}: ends on a dangling function word ("${last}")`);
  }
  // timing: independent check against ASR (nearest same-word within 0.8 s)
  const first = norm(toks[0]);
  const cand = asr.filter((w) => norm(w.text) === first && Math.abs(w.start - c.wordStart) < 0.8).sort((a, b) => Math.abs(a.start - c.wordStart) - Math.abs(b.start - c.wordStart))[0];
  if (cand) {
    const d = Math.round(c.start * FPS) - Math.round(cand.start * FPS);
    if (d > 0 || d < -2) err(`${where}: start frame off by ${d} vs ASR word start`);
  } else warn(`${where}: first word not found in ASR (interpolated)`);
  const dur = Math.round(c.end * FPS) - Math.round(c.start * FPS);
  if (dur < 8) err(`${where}: on screen only ${dur} frames`);
  const nx = chunks[i + 1];
  if (nx) {
    const gap = Math.round(nx.start * FPS) - Math.round(c.end * FPS);
    if (gap < 0) err(`${where}: overlaps next chunk by ${-gap} frames`);
    if (gap > 0 && gap < 4) err(`${where}: ${gap}-frame gap (flicker)`);
  }
  if (c.emphasis) sentenceEmph.set(c.sentence, (sentenceEmph.get(c.sentence) ?? 0) + 1);
});
for (const [s, n] of sentenceEmph) if (n > 1) err(`sentence ${s}: ${n} emphasised chunks`);


// layout: every chunk, every font, must sit inside the band and the safe margins
const dir = path.resolve("src/lab/subtitles/public");
const layoutRows: string[] = [];
for (const key of Object.keys(FONTS) as FontKey[]) {
  const F = FONTS[key];
  const buf = fs.readFileSync(path.join(dir, F.file));
  const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const measure = (t: string, px: number) => font.getAdvanceWidth(t, px, { kerning: true, letterSpacing: key === "montserrat-xb" ? 0 : 0 });
  let worst = 0, minSize = 999, twoLine = 0;
  for (const c of chunks) {
    const base = BASE_SIZE * F.scale * (c.emphasis ? EMPH_SCALE : 1);
    const fit = fitText(c.text, measure, base);
    // outline/shadow/stamp allowance: +6 % size, +24 px width
    const wFull = fit.width * 1.045 + 24;
    worst = Math.max(worst, wFull);
    minSize = Math.min(minSize, fit.size);
    if (fit.lines.length > 1) twoLine++;
    const left = W / 2 - wFull / 2, right = W / 2 + wFull / 2;
    if (left < SIDE_MARGIN || right > W - SIDE_MARGIN) err(`[${key}] "${c.text}": x ${left.toFixed(0)}..${right.toFixed(0)} outside side margins`);
    if (wFull > MAX_TEXT_W + 65) err(`[${key}] "${c.text}": width ${wFull.toFixed(0)} > ${MAX_TEXT_W + 65}`);
    if (right > 1000) err(`[${key}] "${c.text}": reaches the right-hand button zone (x ${right.toFixed(0)})`);
    const hBox = fit.lines.length * fit.size * 1.08 * 1.06 + 20;
    const top = BAND.center - hBox / 2, bot = BAND.center + hBox / 2;
    if (top < BAND.top - 10 || bot > BAND.bottom + 10) err(`[${key}] "${c.text}": y ${top.toFixed(0)}..${bot.toFixed(0)} outside the band`);
    if (bot > HARD_BOTTOM) err(`[${key}] "${c.text}": below y ${HARD_BOTTOM}`);
    if (fit.size < MIN_SIZE) err(`[${key}] "${c.text}": size ${fit.size} < ${MIN_SIZE}`);
  }
  layoutRows.push(`${F.label}: widest ${worst.toFixed(0)} px (limit ${MAX_TEXT_W + 65}), min size ${minSize}, two-line chunks ${twoLine}`);
}
console.log(`chunks: ${chunks.length}  emphasised: ${chunks.filter((c) => c.emphasis).length}  max words: ${Math.max(...chunks.map((c) => c.words))}`);
layoutRows.forEach((r) => console.log("layout  " + r));
warns.forEach((w) => console.log("WARN  " + w));
errors.forEach((e) => console.log("ERROR " + e));
console.log(errors.length ? `FAILED (${errors.length} errors)` : "PASSED");
process.exit(errors.length ? 1 : 0);
