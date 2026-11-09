// Usage: npx esbuild cli/make-chunks.ts --bundle --platform=node --format=esm --outfile=/tmp/mk.mjs && node /tmp/mk.mjs <SCRIPT.md> <words.json> <out.json> <out.txt> [overrides.json]
import fs from "node:fs";
import { buildChunks, chunksToText, extractVoOnly } from "../chunker";

const [script, words, outJson, outTxt, ovr] = process.argv.slice(2);
if (!script || !words || !outJson) { console.error("args: SCRIPT.md words.json out.json [out.txt] [overrides.json]"); process.exit(1); }
const text = extractVoOnly(fs.readFileSync(script, "utf8"));
const w = JSON.parse(fs.readFileSync(words, "utf8"));
const overrides = ovr ? JSON.parse(fs.readFileSync(ovr, "utf8")) : {};
const chunks = buildChunks(text, Array.isArray(w) ? w : w.words, { overrides });
fs.writeFileSync(outJson, JSON.stringify({ script: text, chunks }, null, 1));
if (outTxt) fs.writeFileSync(outTxt, chunksToText(chunks));
console.log(chunks.length, "chunks");
