import React from "react";
import * as THREE from "three";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { World } from "./World";
import { stateAt, State, FPS, clamp } from "./story";

const W = 1080, H = 1920;
const MONO = "'DejaVu Sans Mono', 'Courier New', monospace";

function project(st: State, p: THREE.Vector3) {
  const cam = new THREE.PerspectiveCamera(st.cam.fov, W / H, 0.05, 6000);
  cam.position.copy(st.cam.pos);
  const fwd = st.cam.look.clone().sub(st.cam.pos).normalize();
  cam.up.set(0, 1, 0).applyAxisAngle(fwd, st.cam.roll);
  cam.lookAt(st.cam.look);
  cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const q = p.clone().add(st.planePos).project(cam);
  return { x: (q.x * 0.5 + 0.5) * W, y: (-q.y * 0.5 + 0.5) * H, ok: q.z < 1 };
}

const Background: React.FC<{ st: State }> = ({ st }) => {
  if (st.scene === "pinwheel") return <AbsoluteFill style={{ background: "linear-gradient(#5d9be0, #cfe2f5 70%, #e9eef2)" }} />;
  if (st.bg === "blueprint" || st.bg === "xray") {
    // continuous blend blueprint -> x-ray background (no pop at the switch)
    const x = st.bg === "xray" && st.xray >= 0.99 ? 1 : st.xray;
    const mixc = (a: number[], b: number[]) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * x)).join(",")})`;
    const base = mixc([11, 26, 51], [7, 20, 42]);
    const g = 0.09 + (0.05 - 0.09) * x;
    return (
      <AbsoluteFill style={{
        backgroundColor: base,
        backgroundImage: `linear-gradient(rgba(53,215,255,${g}) 1px, transparent 1px), linear-gradient(90deg, rgba(53,215,255,${g}) 1px, transparent 1px), linear-gradient(rgba(53,215,255,${g * 0.45}) 1px, transparent 1px), linear-gradient(90deg, rgba(53,215,255,${g * 0.45}) 1px, transparent 1px)`,
        backgroundSize: "120px 120px, 120px 120px, 24px 24px, 24px 24px",
      }} />
    );
  }
  return <AbsoluteFill style={{ background: "linear-gradient(#3e7fd2 0%, #7fa9df 45%, #b8d0ec 75%, #d6e3f1 100%)" }} />;
};

const COLORS = { cyan: "#35D7FF", green: "#39FF88", red: "#FF3B3B" };

const Labels: React.FC<{ st: State }> = ({ st }) => (
  <>
    {st.labels.filter((l) => l.a > 0.01).map((l, i) => {
      const p = project(st, l.anchor);
      const c = COLORS[l.color];
      const tw = l.text.length * 25 + 36;
      return (
        <svg key={i} width={W} height={H} style={{ position: "absolute", left: 0, top: 0, opacity: l.a }}>
          {p.ok && <line x1={l.x + tw / 2} y1={l.y + 30} x2={p.x} y2={p.y} stroke={c} strokeWidth={3} strokeDasharray="10 8" />}
          {p.ok && <circle cx={p.x} cy={p.y} r={9} fill="none" stroke={c} strokeWidth={4} />}
          <rect x={l.x} y={l.y - 30} width={tw} height={62} fill="rgba(7,18,38,0.72)" stroke={c} strokeWidth={3} rx={6} />
          <text x={l.x + 18} y={l.y + 11} fill={c} fontFamily={MONO} fontWeight={700} fontSize={38} letterSpacing={1}>{l.text}</text>
        </svg>
      );
    })}
  </>
);

// Danger meter on the LEFT edge, y 300..1000 (outside the caption zone and bottom 20 %).
const Meter: React.FC<{ st: State }> = ({ st }) => {
  if (st.meterA < 0.01) return null;
  const x = 40, y0 = 300, h = 700, w = 46;
  const m = clamp(st.meter);
  const col = st.meterGreen ? COLORS.green : `rgb(${Math.round(57 + (255 - 57) * Math.min(1, m * 1.4))},${Math.round(255 - (255 - 59) * m)},${Math.round(136 - 77 * m)})`;
  const pulse = !st.meterGreen && m > 0.85 ? 0.55 + 0.45 * Math.sin(st.t * 18) : 1;
  return (
    <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, opacity: st.meterA }}>
      <text x={x + w / 2} y={y0 - 22} textAnchor="middle" fill={st.meterGreen ? COLORS.green : COLORS.red} fontFamily={MONO} fontWeight={700} fontSize={26}>RISK</text>
      <rect x={x} y={y0} width={w} height={h} rx={10} fill="rgba(7,18,38,0.6)" stroke="rgba(255,255,255,0.7)" strokeWidth={3} />
      <rect x={x + 7} y={y0 + h - 7 - (h - 14) * m} width={w - 14} height={(h - 14) * m} rx={6} fill={col} opacity={pulse} />
      {[0.25, 0.5, 0.75].map((k) => <line key={k} x1={x + w} x2={x + w + 12} y1={y0 + h * (1 - k)} y2={y0 + h * (1 - k)} stroke="rgba(255,255,255,0.7)" strokeWidth={3} />)}
    </svg>
  );
};

const Stamp: React.FC<{ st: State }> = ({ st }) => {
  if (st.stamp < 0) return null;
  const k = clamp(st.stamp);
  const s = 1.7 - 0.7 * k * k;
  const shake = k >= 1 ? 0 : 0;
  const after = clamp((st.t - 38.5) * 8);
  const jitter = after > 0 && after < 1 ? Math.sin(st.t * 120) * 6 * (1 - after) : 0;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 470 + jitter, display: "flex", justifyContent: "center", opacity: Math.min(1, k * 3) }}>
      <div style={{ transform: `rotate(-7deg) scale(${s + shake})`, border: "10px solid #b3261e", color: "#b3261e", padding: "14px 34px", fontFamily: MONO, fontWeight: 800, fontSize: 64, letterSpacing: 4, borderRadius: 10, background: "rgba(255,240,220,0.08)", mixBlendMode: "multiply" }}>
        1983 · AIR CANADA 143
      </div>
    </div>
  );
};

const Gauge: React.FC<{ st: State }> = ({ st }) => {
  if (st.gauge < 0) return null;
  const cx = 540, cy = 640, r = 300;
  const ang = (-120 + 240 * st.gauge) * (Math.PI / 180);
  const unit = st.kg > 0.5 ? "KG" : "LB";
  const flash = Math.sin(clamp(st.kg) * Math.PI);
  return (
    <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
      <circle cx={cx} cy={cy} r={r + 26} fill="#1b1a17" stroke="#6b6152" strokeWidth={10} />
      <circle cx={cx} cy={cy} r={r} fill="#24221d" />
      {Array.from({ length: 13 }).map((_, i) => {
        const a = (-120 + i * 20) * (Math.PI / 180);
        return <line key={i} x1={cx + Math.sin(a) * (r - 20)} y1={cy - Math.cos(a) * (r - 20)} x2={cx + Math.sin(a) * (r - (i % 3 ? 50 : 75))} y2={cy - Math.cos(a) * (r - (i % 3 ? 50 : 75))} stroke="#efe6d2" strokeWidth={i % 3 ? 5 : 9} />;
      })}
      <text x={cx} y={cy - 120} textAnchor="middle" fill="#efe6d2" fontFamily={MONO} fontWeight={700} fontSize={50}>FUEL</text>
      <text x={cx - 205} y={cy + 150} textAnchor="middle" fill="#efe6d2" fontFamily={MONO} fontWeight={700} fontSize={44}>0</text>
      <text x={cx + 205} y={cy + 150} textAnchor="middle" fill="#efe6d2" fontFamily={MONO} fontWeight={700} fontSize={44}>F</text>
      <g transform={`translate(${cx},${cy + 170})`}>
        <rect x={-100} y={-55} width={200} height={90} rx={10} fill={flash > 0.05 ? `rgba(255,59,59,${0.85 * flash})` : "#14130f"} stroke="#efe6d2" strokeWidth={4} />
        <text x={0} y={18} textAnchor="middle" fill="#efe6d2" fontFamily={MONO} fontWeight={800} fontSize={64}>{unit}</text>
      </g>
      <line x1={cx} y1={cy} x2={cx + Math.sin(ang) * (r - 60)} y2={cy - Math.cos(ang) * (r - 60)} stroke="#ff8a3d" strokeWidth={14} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={26} fill="#efe6d2" />
    </svg>
  );
};

const GlideDiagram: React.FC<{ st: State }> = ({ st }) => {
  if (st.glide < 0) return null;
  const c = COLORS.cyan;
  const x0 = 150, y0 = 820, len = 780, drop = 78;
  const k = clamp(st.glide);
  const kh = clamp((st.t - 9.3) / 1.1), kv = clamp((st.t - 11.25) / 0.35);
  const fade = 1 - clamp((st.t - 11.75) / 0.25);
  return (
    <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, opacity: fade }}>
      <line x1={x0} y1={y0} x2={x0 + len * k} y2={y0 + drop * k} stroke={c} strokeWidth={6} strokeDasharray="22 14" />
      <line x1={x0} y1={y0} x2={x0 + len * kh} y2={y0} stroke={c} strokeWidth={4} opacity={0.85} />
      {Array.from({ length: 11 }).map((_, i) => i / 10 <= kh ? <line key={i} x1={x0 + len * i / 10} x2={x0 + len * i / 10} y1={y0 - 16} y2={y0} stroke={c} strokeWidth={4} /> : null)}
      {kh > 0.95 && <text x={x0 + len / 2} y={y0 - 34} textAnchor="middle" fill={c} fontFamily={MONO} fontWeight={700} fontSize={42}>10 FT FORWARD</text>}
      {kv > 0 && <line x1={x0 + len} y1={y0} x2={x0 + len} y2={y0 + drop * kv} stroke={c} strokeWidth={6} />}
      {kv > 0.9 && <text x={x0 + len - 20} y={y0 + drop + 60} textAnchor="end" fill={c} fontFamily={MONO} fontWeight={700} fontSize={42}>1 FT DOWN</text>}
      <text x={x0} y={380} fill={c} fontFamily={MONO} fontWeight={700} fontSize={46} opacity={clamp((st.t - 8.4) * 4)}>GLIDE RATIO 10 : 1+</text>
    </svg>
  );
};

const GliderGhost: React.FC<{ st: State }> = ({ st }) => {
  if (st.gliderGhost < 0.01) return null;
  const c = COLORS.cyan;
  return (
    <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, opacity: st.gliderGhost * 0.9 }}>
      <g transform="translate(560,470) scale(1.6)" fill="none" stroke={c} strokeWidth={3}>
        <path d="M -230 0 L 230 -8 L 232 2 L -228 10 Z" />
        <path d="M -40 5 Q 0 -10 120 4 L 160 6 Q 120 18 -10 18 Q -40 16 -40 5 Z" />
        <path d="M 140 6 L 170 -40 L 182 -40 L 172 8" />
        <path d="M 150 -2 L 200 -6 L 200 2 L 150 6" />
      </g>
      <text x={150} y={360} fill={c} fontFamily={MONO} fontWeight={700} fontSize={36}>SAILPLANE PILOT</text>
    </svg>
  );
};

export const RatShort: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const st = stateAt(frame / FPS);
  const sepia = st.sepia > 0;
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <AbsoluteFill style={{ filter: sepia ? "sepia(1) saturate(1.15) contrast(1.06) brightness(0.96)" : undefined }}>
        <Background st={st} />
        <ThreeCanvas width={width} height={height} gl={{ antialias: true, alpha: true }} camera={{ fov: 40, near: 0.05, far: 6000 }}>
          <World st={st} />
        </ThreeCanvas>
        <Gauge st={st} />
        <GlideDiagram st={st} />
        <GliderGhost st={st} />
        <Labels st={st} />
        <Meter st={st} />
        <Stamp st={st} />
        {/* vignette: corners ~0.85x centre */}
        <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.22) 100%)" }} />
        {st.flash > 0.01 && <AbsoluteFill style={{ backgroundColor: `rgba(255,255,255,${st.flash})` }} />}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
