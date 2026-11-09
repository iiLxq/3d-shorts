// node cli/stills.mjs <CompId> <outDir> <scale> <frame[,frame...]> [propsJson] [--gl=swiftshader]
// One bundle, many stills (fast). Run from remotion/.
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";
import fs from "node:fs";
const [comp, outDir, scale, frames, propsJson, gl] = process.argv.slice(2);
const root = path.resolve("src/lab/subtitles");
const serveUrl = await bundle({ entryPoint: path.join(root, "index.ts"), publicDir: path.join(root, "public") });
const inputProps = propsJson ? JSON.parse(propsJson) : {};
const composition = await selectComposition({ serveUrl, id: comp, inputProps });
fs.mkdirSync(outDir, { recursive: true });
for (const fr of frames.split(",")) {
  const out = path.join(outDir, `${comp}_${inputProps.font ?? ""}_${String(fr).padStart(4, "0")}.png`.replace("__", "_"));
  await renderStill({ composition, serveUrl, frame: +fr, output: out, scale: +scale, inputProps, chromiumOptions: { gl: gl ? "swiftshader" : undefined }, imageFormat: "png" });
  console.log(out);
}
process.exit(0);
