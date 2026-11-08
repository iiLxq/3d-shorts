// Render many stills with one bundle, then a labelled contact sheet.
// node scripts/stills.mjs <Comp> <outDir> <frames comma list> [scale=0.5]
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";
import fs from "node:fs";
const [comp, outDir, frameList, scaleArg] = process.argv.slice(2);
const scale = Number(scaleArg ?? 0.5);
fs.mkdirSync(outDir, { recursive: true });
// ENTRY env picks an isolated entry point (lab concepts each have their own), default = main project.
const serveUrl = await bundle({ entryPoint: path.resolve(process.env.ENTRY ?? "src/index.ts") });
const composition = await selectComposition({ serveUrl, id: comp, chromiumOptions: { gl: "swiftshader" } });
const frames = frameList.split(",").map(Number);
for (const f of frames) {
  const t0 = Date.now();
  const output = path.join(outDir, `f${String(f).padStart(4, "0")}.jpg`);
  await renderStill({ serveUrl, composition, frame: f, output, imageFormat: "jpeg", jpegQuality: 88, scale, chromiumOptions: { gl: "swiftshader" } });
  console.log(`frame ${f} -> ${output} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}
