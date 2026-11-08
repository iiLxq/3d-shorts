import React, { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Engine } from "./engine";
import { World } from "./scene";
import { frameAt, makeCamera, Mode, Frame } from "./timeline";

const SERIF = "'Liberation Serif', 'DejaVu Serif', serif";
const W = 1080, H = 1920;

type Lbl = { text: string; num: string; at: [number, number, number]; car?: boolean; x: number; y: number };
const LABELS: Lbl[] = [
  { text: "HOIST ROPES", num: "16", at: [0.05, 2.6, 0], x: 250, y: 300 },
  { text: "GUIDE RAIL", num: "12", at: [-1.26, 2.2, 0.05], x: 150, y: 520 },
  { text: "SAFETY GEAR", num: "14", at: [-1.22, 0.45, 0.06], car: true, x: 150, y: 820 },
];

function project(fr: Frame, p: THREE.Vector3) {
  const cam = makeCamera(fr.cam, W / H);
  const q = p.clone().project(cam);
  return { x: (q.x * 0.5 + 0.5) * W, y: (-q.y * 0.5 + 0.5) * H };
}

const Overlay: React.FC<{ fr: Frame; mode: Mode }> = ({ fr, mode }) => {
  const bp = fr.look.bp > 0.5;
  const ink = bp ? "#CFF6FF" : "#0B1A33";
  const showMeter = mode === "motion" || mode === "states";
  const m = Math.max(0, Math.min(1, fr.meter));
  const mx = 46, my0 = 330, mh = 640, mw = 34;
  const fillCol = fr.meterGreen ? "#39FF88" : m > 0.55 ? "#FF3B3B" : m > 0.3 ? "#FFB020" : "#39FF88";
  return (
    <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
      {fr.fig && (
        <g fontFamily={SERIF} fill={ink}>
          <text x={540} y={170} textAnchor="middle" fontSize={54} fontStyle="italic" letterSpacing={6}>{fr.fig}</text>
          <line x1={420} x2={660} y1={196} y2={196} stroke={ink} strokeWidth={2.5} />
        </g>
      )}
      {fr.labels > 0 && LABELS.map((l, i) => {
        const p = project(fr, new THREE.Vector3(l.at[0], l.at[1] - (l.car ? fr.ws.drop : 0), l.at[2]));
        const tx = l.x, ty = l.y;
        return (
          <g key={i} fontFamily={SERIF} fill={ink}>
            <text x={tx} y={ty} fontSize={34} letterSpacing={3} fontWeight={700}>{l.text}</text>
            <text x={tx} y={ty + 46} fontSize={40} fontStyle="italic">{l.num}</text>
            <path d={`M ${tx + 54} ${ty + 34} Q ${(tx + p.x) / 2 + 40} ${ty + 30} ${p.x} ${p.y}`} stroke={ink} strokeWidth={2.6} fill="none" />
            <circle cx={p.x} cy={p.y} r={5} fill={ink} />
          </g>
        );
      })}
      {showMeter && (
        <g>
          <rect x={mx} y={my0} width={mw} height={mh} rx={17} fill={bp ? "rgba(11,26,51,0.6)" : "rgba(241,232,213,0.85)"} stroke={ink} strokeWidth={4} />
          <rect x={mx + 8} y={my0 + 8 + (mh - 16) * (1 - m)} width={mw - 16} height={(mh - 16) * m} rx={9} fill={fillCol} />
          <circle cx={mx + mw / 2} cy={my0 + mh + 26} r={30} fill={fillCol} stroke={ink} strokeWidth={4} />
          {Array.from({ length: 9 }).map((_, i) => (
            <line key={i} x1={mx + mw} x2={mx + mw + (i % 2 ? 10 : 20)} y1={my0 + 30 + i * ((mh - 60) / 8)} y2={my0 + 30 + i * ((mh - 60) / 8)} stroke={ink} strokeWidth={3} />
          ))}
          <text x={mx + mw / 2} y={my0 - 22} textAnchor="middle" fill={ink} fontFamily={SERIF} fontWeight={700} fontSize={28} letterSpacing={2}>RISK</text>
        </g>
      )}
    </svg>
  );
};

export const Engraving: React.FC<{ mode: Mode }> = ({ mode }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const bw = Math.round(width * dpr), bh = Math.round(height * dpr);
  const ref = useRef<HTMLCanvasElement>(null);
  const ctx = useRef<{ engine: Engine; world: World } | null>(null);
  const fr = useMemo(() => frameAt(mode, frame), [mode, frame]);
  useLayoutEffect(() => {
    if (!ref.current) return;
    if (!ctx.current) ctx.current = { engine: new Engine(ref.current, bw, bh), world: new World() };
    const { engine, world } = ctx.current;
    const cam = makeCamera(fr.cam, width / height);
    world.fig.setPose(fr.pose); world.fig.setExpr(fr.expr);
    world.update(fr.ws, fr.cam.pos);
    engine.render(world.scene, cam, fr.look);
  }, [fr, bw, bh, width, height]);
  return (
    <AbsoluteFill style={{ backgroundColor: "#0B1A33" }}>
      <canvas ref={ref} width={bw} height={bh} style={{ width, height, position: "absolute", left: 0, top: 0 }} />
      <Overlay fr={fr} mode={mode} />
    </AbsoluteFill>
  );
};
