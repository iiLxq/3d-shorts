import React, { useLayoutEffect, useRef, useState } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, delayRender, continueRender } from "remotion";
import { NoirEngine, Comp } from "./engine";

const CYAN = "#35D7FF";
const MONO = "'JetBrains Mono','DejaVu Sans Mono',monospace";
let ENGINE: NoirEngine | null = null; // one renderer per page (frames render sequentially, concurrency 1)

type Lab = { k: string; text: string; dx: number; dy: number };
const LABELS: Lab[] = [
  { k: "gear", text: "SAFETY GEAR", dx: 60, dy: 330 },
  { k: "ropes", text: "HOIST ROPES ×4", dx: 140, dy: -330 },
  { k: "tech", text: "TECH · CAR TOP", dx: 170, dy: 120 },
];

export const NoirScene: React.FC<{ comp: Comp; dpr?: number }> = ({ comp, dpr = 0.5 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const [labels, setLabels] = useState<Record<string, [number, number]> | null>(null);
  useLayoutEffect(() => {
    const h = delayRender(`noir ${comp} ${frame}`);
    if (!ENGINE || ENGINE.cvs !== ref.current) ENGINE = new NoirEngine(ref.current!, width, height, dpr);
    const t0 = performance.now();
    const out = ENGINE.render(comp, frame);
    // eslint-disable-next-line no-console
    console.log(`noir render ${comp} f${frame} ${(performance.now() - t0).toFixed(0)}ms`);
    setLabels(out.labels);
    requestAnimationFrame(() => continueRender(h));
  }, [comp, frame, width, height, dpr]);
  return (
    <AbsoluteFill style={{ backgroundColor: "#0B1A33" }}>
      <canvas ref={ref} style={{ width, height, display: "block" }} />
      {labels && (
        <svg width={width} height={height} style={{ position: "absolute", left: 0, top: 0 }}>
          {LABELS.map((l) => {
            const p = labels[l.k]; if (!p) return null;
            let [x, y] = p; let tx = Math.min(width - 380, Math.max(70, x + l.dx)), ty = y + l.dy;
            if (ty > 1000 && ty < 1400) ty = ty < 1200 ? 1000 : 1400; if (ty > 1500) ty = 1500; if (ty < 140) ty = 140;
            return (
              <g key={l.k} style={{ filter: "drop-shadow(0 0 6px rgba(53,215,255,0.7))" }}>
                <circle cx={x} cy={y} r={7} fill="none" stroke={CYAN} strokeWidth={3} />
                <path d={`M ${x} ${y} L ${tx} ${ty} L ${tx + 22} ${ty}`} stroke={CYAN} strokeWidth={2.5} fill="none" />
                <text x={tx + 30} y={ty + 12} fill={CYAN} fontFamily={MONO} fontWeight={700} fontSize={34} letterSpacing={2}>{l.text}</text>
              </g>
            );
          })}
        </svg>
      )}
    </AbsoluteFill>
  );
};
