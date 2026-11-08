import React, { useLayoutEffect, useRef } from "react";
import { Composition, AbsoluteFill, useCurrentFrame, useVideoConfig, delayRender, continueRender } from "remotion";
import { LookBench } from "./testScene";
import type { PostOpts } from "./post";

// [hybrid/look] Lookdev bench compositions. Render at --scale 0.5 for a true 540x960 buffer (dpr = scale).
let BENCH: LookBench | null = null; // one renderer per page (concurrency 1)

const Bench: React.FC<{ post?: Partial<PostOpts> }> = ({ post }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const h = delayRender(`look ${frame}`);
    if (!BENCH || BENCH.cvs !== ref.current) BENCH = new LookBench(ref.current!, width, height, post ?? {});
    const t0 = performance.now();
    const out = BENCH.render(frame);
    // eslint-disable-next-line no-console
    console.log(`look f${frame} ${out.name} dpr=${window.devicePixelRatio} post=${out.ms.toFixed(0)}ms total=${(performance.now() - t0).toFixed(0)}ms`);
    requestAnimationFrame(() => continueRender(h));
  }, [frame, width, height, post]);
  return (
    <AbsoluteFill style={{ backgroundColor: "#0B1A33" }}>
      <canvas ref={ref} style={{ width, height, display: "block" }} />
    </AbsoluteFill>
  );
};

const Final: React.FC = () => <Bench />;
const Preview: React.FC = () => <Bench post={{ preview: true }} />;
const Raw: React.FC = () => <Bench post={{ ink: false, dof: false, bloom: false, grain: 0 }} />;

export const LabRoot: React.FC = () => (
  <>
    <Composition id="HyLookTest" component={Final} durationInFrames={150} fps={30} width={1080} height={1920} />
    <Composition id="HyLookPreview" component={Preview} durationInFrames={150} fps={30} width={1080} height={1920} />
    <Composition id="HyLookRaw" component={Raw} durationInFrames={150} fps={30} width={1080} height={1920} />
  </>
);
