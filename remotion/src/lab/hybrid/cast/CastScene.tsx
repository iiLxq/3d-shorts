import React, { useLayoutEffect, useRef, useState } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, delayRender, continueRender } from "remotion";
import { CastLab, Comp, Overlay } from "./lab";

const MONO = "'JetBrains Mono','DejaVu Sans Mono',monospace";
let LAB: CastLab | null = null; // one renderer per page (frames render sequentially, concurrency 1)

export const CastScene: React.FC<{ comp: Comp }> = ({ comp }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const [ov, setOv] = useState<Overlay | null>(null);
  useLayoutEffect(() => {
    const h = delayRender(`cast ${comp} ${frame}`);
    const dpr = typeof window !== "undefined" && window.devicePixelRatio ? Math.min(1, window.devicePixelRatio) : 0.5;
    if (!LAB || LAB.cvs !== ref.current) LAB = new CastLab(ref.current!, width, height, dpr);
    const t0 = performance.now();
    const out = LAB.render(comp, frame);
    // eslint-disable-next-line no-console
    console.log(`cast render ${comp} f${frame} ${(performance.now() - t0).toFixed(0)}ms dpr ${dpr}`);
    setOv(out);
    requestAnimationFrame(() => continueRender(h));
  }, [comp, frame, width, height]);
  return (
    <AbsoluteFill style={{ backgroundColor: "#0e1820" }}>
      <canvas ref={ref} style={{ width, height, display: "block" }} />
      {ov && (
        <svg width={width} height={height} style={{ position: "absolute", left: 0, top: 0 }}>
          {ov.lines.map((l, i) => (
            <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={l.color ?? "#E9E2D3"} strokeWidth={l.w ?? 1.5} strokeDasharray={l.dash ? "8 6" : undefined} opacity={0.85} />
          ))}
          {ov.labels.map((l, i) => (
            <text key={i} x={l.x} y={l.y} fill={l.color ?? "#E9E2D3"} fontFamily={MONO} fontWeight={700} fontSize={l.size ?? 26} letterSpacing={1.5} textAnchor={l.anchor ?? "start"}
              style={{ paintOrder: "stroke", stroke: "rgba(8,14,20,0.55)", strokeWidth: 4 }}>{l.text}</text>
          ))}
        </svg>
      )}
    </AbsoluteFill>
  );
};
