// node src/lab/toy/tools/stills.mjs <outDir> <Comp:f,f,...> [<Comp:f>...]   (scale 0.5, one bundle, one browser)
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition, openBrowser } from "@remotion/renderer";
import path from "node:path";
import fs from "node:fs";
const [outDir, ...jobs] = process.argv.slice(2);
const scale = Number(process.env.SCALE ?? 0.5);
fs.mkdirSync(outDir, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve("src/lab/toy/index.ts") });
const browser = await openBrowser("chrome", { chromiumOptions: { gl: "swiftshader" } });
for (const job of jobs) {
  const [comp, fl] = job.split(":");
  const composition = await selectComposition({ serveUrl, id: comp, puppeteerInstance: browser, chromiumOptions: { gl: "swiftshader" } });
  for (const f of fl.split(",").map(Number)) {
    const t0 = Date.now();
    const output = path.join(outDir, `${comp}_${String(f).padStart(3, "0")}.jpg`);
    await renderStill({ serveUrl, composition, frame: f, output, imageFormat: "jpeg", jpegQuality: 92, scale, puppeteerInstance: browser, chromiumOptions: { gl: "swiftshader" }, timeoutInMilliseconds: 300000,
      onBrowserLog: (l) => { if (l.type === "error" || l.type === "warning") console.log("[browser]", l.type, l.text.slice(0, 400)); } });
    console.log(`${comp} f${f} -> ${output} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }
}
await browser.close({ silent: true });
