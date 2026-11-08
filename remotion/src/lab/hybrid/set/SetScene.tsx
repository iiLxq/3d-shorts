import React, { useLayoutEffect, useRef, useState } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, delayRender, continueRender } from "remotion";
import { SetEngine, SetComp } from "./engine";

const CYAN = "#35D7FF";
const MONO = "'JetBrains Mono','DejaVu Sans Mono',monospace";
let ENGINE: SetEngine | null = null;

// patent callout placement: label column on the right half, rows above the caption band (never x < 140, never y 1050-1350 / > 1536)
const SLOT: Record<string, [number, number]> = { ropeBreak: [640, 250], door: [640, 400], cw: [640, 160], gear: [700, 1000], rail: [700, 560], roof: [560, 1420] };

export const SetScene: React.FC<{ comp: SetComp; dpr?: number }> = ({ comp, dpr = 0.5 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const [labels, setLabels] = useState<Record<string, [number, number]> | null>(null);
  useLayoutEffect(() => {
    const h = delayRender(`set ${comp} ${frame}`);
    if (!ENGINE || ENGINE.cvs !== ref.current) ENGINE = new SetEngine(ref.current!, width, height, dpr);
    const t0 = performance.now();
    const out = ENGINE.render(comp, frame);
    // eslint-disable-next-line no-console
    console.log(`set render ${comp} f${frame} ${(performance.now() - t0).toFixed(0)}ms`);
    setLabels(out.labels);
    requestAnimationFrame(() => continueRender(h));
  }, [comp, frame, width, height, dpr]);
  const patent = ENGINE?.shaft.patent ?? [];
  return (
    <AbsoluteFill style={{ backgroundColor: "#0B1A33" }}>
      <canvas ref={ref} style={{ width, height, display: "block" }} />
      {labels && (
        <svg width={width} height={height} style={{ position: "absolute", left: 0, top: 0 }}>
          <text x={150} y={120} fill={CYAN} fontFamily={MONO} fontWeight={700} fontSize={44} letterSpacing={6}>FIG. 1</text>
          {patent.map((p) => {
            const a = labels[p.key], s = SLOT[p.key]; if (!a || !s) return null;
            const [x, y] = a, [tx, ty] = s;
            return (
              <g key={p.key} style={{ filter: "drop-shadow(0 0 5px rgba(53,215,255,0.6))" }}>
                <circle cx={x} cy={y} r={6} fill="none" stroke={CYAN} strokeWidth={3} />
                <path d={`M ${x} ${y} Q ${(x + tx) / 2} ${Math.min(y, ty) - 30} ${tx} ${ty}`} stroke={CYAN} strokeWidth={2.2} fill="none" />
                <text x={tx + 10} y={ty + 10} fill={CYAN} fontFamily={MONO} fontWeight={700} fontSize={30} letterSpacing={2}>{p.num}  {p.text}</text>
              </g>
            );
          })}
        </svg>
      )}
    </AbsoluteFill>
  );
};
