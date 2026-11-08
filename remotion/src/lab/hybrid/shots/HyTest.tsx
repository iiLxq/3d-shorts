// [hybrid/shots] HyTest composition: 3D canvas (ShotEngine) + overlay layer (left danger meter, FIG. 1 patent callouts).
// Safe zones: meter in x < 140; nothing in y 1050-1350 or y > 1536.
import React, { useLayoutEffect, useRef, useState } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, delayRender, continueRender } from "remotion";
import { ShotEngine } from "./engine";
import { meterAt, calloutAt, T, smooth } from "./timeline";

const CYAN = "#35D7FF", GREEN = "#39FF88", RED = "#FF3B3B", NAVY = "#0B1A33";
const MONO = "'JetBrains Mono','DejaVu Sans Mono',monospace";
let ENGINE: ShotEngine | null = null;

// patent callout text slots (right column, above the caption band)
const SLOT: Record<string, [number, number]> = {
  cw: [690, 210], ropeBreak: [690, 330], door: [690, 470], rail: [690, 640], roof: [690, 820], gear: [690, 975],
};

// green -> red through OKLab (no muddy sRGB midpoint)
const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const toSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(Math.max(0, c), 1 / 2.4) - 0.055);
function oklab(hex: string) {
  const n = parseInt(hex.slice(1), 16); const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => toLin(v / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function fromOklab([L, A, B]: number[]) {
  const l = Math.pow(L + 0.3963377774 * A + 0.2158037573 * B, 3), m = Math.pow(L - 0.1055613458 * A - 0.0638541728 * B, 3), s = Math.pow(L - 0.0894841775 * A - 1.291485548 * B, 3);
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  return "#" + rgb.map((v) => Math.round(Math.max(0, Math.min(1, toSrgb(v))) * 255).toString(16).padStart(2, "0")).join("");
}
const G_LAB = oklab(GREEN), R_LAB = oklab(RED);
const meterCol = (t: number) => (t <= 0 ? GREEN : t >= 1 ? RED : fromOklab(G_LAB.map((v, i) => v + (R_LAB[i] - v) * t)));

const SEG = 16, MX = 50, MW = 44, MTOP = 372, MBOT = 990;
const Meter: React.FC<{ f: number }> = ({ f }) => {
  const lvl = meterAt(f);
  const crash = f >= T.BITE ? Math.exp(-(f - T.BITE) / 8) : 0;
  const segH = (MBOT - MTOP) / SEG;
  return (
    <g>
      <text x={MX + MW / 2} y={MTOP - 22} fill="#E8F1F6" fillOpacity={0.85} fontFamily={MONO} fontWeight={700} fontSize={19} letterSpacing={2} textAnchor="middle">DANGER</text>
      <rect x={MX - 8} y={MTOP - 8} width={MW + 16} height={MBOT - MTOP + 16} rx={14} fill={NAVY} fillOpacity={0.55} stroke={crash > 0.02 ? GREEN : "#9FB4C4"} strokeOpacity={0.5 + 0.5 * crash} strokeWidth={2.5 + 4 * crash}
        style={crash > 0.02 ? { filter: `drop-shadow(0 0 ${10 * crash}px ${GREEN})` } : undefined} />
      {Array.from({ length: SEG }, (_, i) => {
        const t = i / (SEG - 1), y = MBOT - (i + 1) * segH + 3;
        const on = smooth(0, 1, (lvl * SEG - i) * 1.5 + 0.5);
        const col = meterCol(t);
        return <rect key={i} x={MX} y={y} width={MW} height={segH - 6} rx={4} fill={col} fillOpacity={0.12 + 0.88 * on} stroke={col} strokeOpacity={0.35} strokeWidth={1.5} />;
      })}
      <polygon points={`${MX + MW + 12},${MBOT - lvl * (MBOT - MTOP)} ${MX + MW + 26},${MBOT - lvl * (MBOT - MTOP) - 9} ${MX + MW + 26},${MBOT - lvl * (MBOT - MTOP) + 9}`} fill={meterCol(lvl)} />
    </g>
  );
};

const Callouts: React.FC<{ f: number; labels: Record<string, [number, number]>; patent: { key: string; num: number; text: string }[] }> = ({ f, labels, patent }) => {
  const { draw, alpha } = calloutAt(f);
  if (alpha <= 0.001) return null;
  return (
    <g opacity={alpha} style={{ filter: "drop-shadow(0 0 4px rgba(53,215,255,0.55))" }}>
      <text x={160} y={130} fill={CYAN} fontFamily={MONO} fontWeight={700} fontSize={46} letterSpacing={6} opacity={smooth(0, 0.25, draw)}>FIG. 1</text>
      <line x1={160} y1={146} x2={160 + 230 * draw} y2={146} stroke={CYAN} strokeWidth={2} />
      <text x={160} y={180} fill={CYAN} fontFamily={MONO} fontSize={20} letterSpacing={3} opacity={0.8 * smooth(0.2, 0.5, draw)}>ELEVATOR SAFETY · PAT. 1861</text>
      {patent.map((p, i) => {
        const a = labels[p.key], s = SLOT[p.key]; if (!a || !s) return null;
        const d = smooth(i * 0.1, i * 0.1 + 0.45, draw); if (d <= 0) return null;
        const [x, y] = a, [tx, ty] = s;
        const len = Math.hypot(tx - x, ty - y) * 1.15 + 40;
        return (
          <g key={p.key}>
            <circle cx={x} cy={y} r={7} fill="none" stroke={CYAN} strokeWidth={3} opacity={d} />
            <path d={`M ${x} ${y} Q ${(x + tx) / 2} ${Math.min(y, ty) - 24} ${tx} ${ty}`} stroke={CYAN} strokeWidth={2.4} fill="none" strokeDasharray={len} strokeDashoffset={len * (1 - d)} />
            <text x={tx + 12} y={ty + 10} fill={CYAN} fontFamily={MONO} fontWeight={700} fontSize={30} letterSpacing={2} opacity={smooth(0.6, 1, d)}>{p.num}  {p.text}</text>
          </g>
        );
      })}
    </g>
  );
};

/** freeze / rewind / slow-mo tag (top left, clear of the meter, captions and the right edge) */
const ReplayTag: React.FC<{ f: number }> = ({ f }) => {
  const a = smooth(T.FREEZE[0], T.FREEZE[0] + 3, f) * (1 - smooth(T.SLOW[1], T.SLOW[1] + 6, f));
  if (a <= 0.01) return null;
  const rew = f >= T.REWIND[0] && f < T.REWIND[1];
  const txt = f < T.REWIND[0] ? "FREEZE" : rew ? "REWIND" : "REPLAY  x0.35";
  return (
    <g opacity={a} fontFamily={MONO} fontWeight={700}>
      <rect x={160} y={96} width={300} height={56} rx={10} fill={NAVY} fillOpacity={0.6} stroke="#E8F1F6" strokeOpacity={0.6} strokeWidth={2} />
      {f < T.REWIND[0] ? <g fill="#E8F1F6"><rect x={178} y={110} width={9} height={28} /><rect x={193} y={110} width={9} height={28} /></g>
        : rew ? <g fill="#E8F1F6"><polygon points="200,110 200,138 180,124" /><polygon points="222,110 222,138 202,124" /></g>
        : <polygon points="180,110 180,138 204,124" fill="#E8F1F6" />}
      <text x={236} y={134} fill="#E8F1F6" fontSize={24} letterSpacing={3}>{txt}</text>
    </g>
  );
};

export const HyTest: React.FC<{ hold?: { f0: number; camF: number } }> = ({ hold }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const [labels, setLabels] = useState<Record<string, [number, number]> | null>(null);
  useLayoutEffect(() => {
    const h = delayRender(`hytest ${frame}`);
    if (!ENGINE || ENGINE.cvs !== ref.current) ENGINE = new ShotEngine(ref.current!, width, height);
    const t0 = performance.now();
    const out = hold ? ENGINE.render(hold.f0 + frame, { camF: hold.camF }) : ENGINE.render(frame);
    // eslint-disable-next-line no-console
    console.log(`hytest f${frame} S${out.S.toFixed(2)} post=${out.ms.toFixed(0)}ms total=${(performance.now() - t0).toFixed(0)}ms`);
    setLabels(out.labels);
    requestAnimationFrame(() => continueRender(h));
  }, [frame, width, height, hold]);
  return (
    <AbsoluteFill style={{ backgroundColor: NAVY }}>
      <canvas ref={ref} style={{ width, height, display: "block" }} />
      <svg width={width} height={height} style={{ position: "absolute", left: 0, top: 0 }}>
        {labels && ENGINE && <Callouts f={frame} labels={labels} patent={ENGINE.shaft.patent} />}
        <Meter f={frame} />
        <ReplayTag f={frame} />
        {labels && Object.entries(labels).filter(([k]) => k.startsWith("dbg")).map(([k, [x, y]]) => k === "dbgD" ? <text key={k} x={200} y={1700} fill="#f0f" fontSize={40}>{`d=${x.toFixed(3)}`}</text> : <circle key={k} cx={x} cy={y} r={10} fill={k === "dbgT" ? "#f0f" : k === "dbgW" ? "#0f0" : "#ff0"} />)}
      </svg>
    </AbsoluteFill>
  );
};
