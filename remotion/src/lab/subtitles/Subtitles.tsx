import React, { useEffect, useMemo, useState } from "react";
import { AbsoluteFill, cancelRender, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { Chunk } from "./chunker";
import { BAND, BASE_SIZE, EMPH_SCALE, FONTS, FontKey, H, TONE_COLORS, W, fitText } from "./layout";

export type StyleId = "clean" | "diecut";
export type SubtitleProps = {
  chunks: Chunk[];
  style?: StyleId;
  font?: FontKey;
  /** direction the scene key light travels (shadow offset direction), unit-ish vector. Paper v1: light from upper-left. */
  lightDir?: [number, number];
  /** y of the band centre (default 1350) */
  centerY?: number;
  /** when set, show only this chunk index (font board / stills) */
  only?: number;
};

// ------------------------------------------------------------------ fonts + measuring
const loaded = new Set<string>();
export function useSubtitleFont(font: FontKey) {
  const [handle] = useState(() => delayRender("subtitle font " + font));
  const [ready, setReady] = useState(loaded.has(font));
  useEffect(() => {
    if (loaded.has(font)) { setReady(true); continueRender(handle); return; }
    const f = FONTS[font];
    const face = new FontFace(f.family, `url(${staticFile(f.file)})`, { weight: String(f.weight) });
    face.load().then((ff) => { document.fonts.add(ff); loaded.add(font); setReady(true); continueRender(handle); }).catch((e) => cancelRender(e));
  }, [font, handle]);
  return ready;
}
let ctx: CanvasRenderingContext2D | null = null;
export const measureWith = (font: FontKey) => (text: string, px: number) => {
  ctx ??= document.createElement("canvas").getContext("2d")!;
  const f = FONTS[font];
  ctx.font = `${f.weight} ${px}px ${f.family}`;
  return ctx.measureText(text).width;
};

// ------------------------------------------------------------------ animation
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const hash = (n: number) => { const s = Math.sin(n * 12.9898) * 43758.5453; return s - Math.floor(s); };

export type Pose = { x: number; y: number; scale: number; rot: number; opacity: number; lift: number };

/** 'place': a card set down. 3-4 frame slide + 1-2 degree settle. lift (0..1) drives shadow distance/softness. */
export function placePose(f: number, restRot: number): Pose {
  const p = easeOut(f / 4);
  const ring = f > 3 ? 1.3 * Math.exp(-(f - 3) / 3.2) * Math.sin((f - 3) * 1.7) : 0;
  return {
    x: -10 * (1 - p), y: -30 * (1 - p), scale: 1 + 0.09 * (1 - p),
    rot: restRot + 2.1 * (1 - p) + ring, opacity: clamp01((f + 1) / 2.6), lift: 1 - p,
  };
}
/** 'stamp': press down from large, tiny overshoot, 2-3 frame shake. */
export function stampPose(f: number, restRot: number): Pose {
  const keys: [number, number][] = [[0, 1.2], [2, 0.93], [4, 1.045], [6.5, 0.995], [9, 1]];
  let s = 1;
  for (let i = 0; i < keys.length - 1; i++) {
    const [f0, v0] = keys[i], [f1, v1] = keys[i + 1];
    if (f >= f0 && f <= f1) { const t = (f - f0) / (f1 - f0); s = v0 + (v1 - v0) * (i === 0 ? t * t : 0.5 - 0.5 * Math.cos(Math.PI * t)); }
  }
  if (f > 9) s = 1;
  const shake = f >= 2 && f < 8 ? Math.sin((f - 2) * 3.4) * 5 * Math.exp(-(f - 2) / 2.2) : 0;
  return { x: shake, y: f < 2 ? -6 : 0, scale: s, rot: restRot + (f < 4 ? -1.2 * (1 - f / 4) : 0), opacity: clamp01((f + 1) / 2), lift: f < 2 ? 1 - f / 2 : 0 };
}
const FADE_FRAMES = 6;
export function fadeOutFactor(f: number, dur: number, fadeOut: boolean) {
  if (!fadeOut) return { o: 1, y: 0, s: 1 };
  const t = clamp01((f - (dur - FADE_FRAMES)) / FADE_FRAMES);
  return { o: 1 - t * t, y: 5 * t, s: 1 - 0.02 * t };
}

// ------------------------------------------------------------------ SVG chunk renderers
type CardProps = { lines: string[]; size: number; width: number; family: string; weight: number; fill: string; lift: number; lightDir: [number, number]; style: StyleId; emphasis: boolean; flash?: number };

const PAPER = "#F3ECDD", PAPER_EDGE = "#CBBE9F", INK = "#0B1A33";

const Card: React.FC<CardProps> = ({ lines, size, width, family, weight, fill, lift, lightDir, style, emphasis, flash = 0 }) => {
  const lh = size * 1.08;
  const pad = 70;
  const w = Math.ceil(width) + pad * 2;
  const h = Math.ceil(lh * lines.length) + pad * 2;
  const [lx, ly] = lightDir;
  const n = Math.hypot(lx, ly) || 1;
  const ux = lx / n, uy = ly / n;
  const cap = size * 0.72;
  const base = (i: number) => pad + cap + i * lh + (lh - cap) * 0.0;
  const common = { letterSpacing: style === "diecut" ? size * 0.02 : 0, fontFamily: family, fontWeight: weight, fontSize: size, textAnchor: "middle" as const, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  const T = (props: React.SVGProps<SVGTextElement> & { dx?: number; dy?: number }) =>
    lines.map((ln, i) => {
      const { dx = 0, dy = 0, ...rest } = props;
      return <text key={i} x={w / 2 + dx} y={base(i) + dy} {...common} {...rest}>{ln}</text>;
    });
  const el: React.ReactNode[] = [];
  if (style === "clean") {
    const sw = size * 0.17; // black stroke
    const so = 6 + lift * 10, blur = 7 + lift * 6;
    el.push(<filter id="blur" key="f" x="-20%" y="-40%" width="140%" height="180%"><feGaussianBlur stdDeviation={blur} /></filter>);
    el.push(<g key="sh" filter="url(#blur)" opacity={0.25 + 0.08 * lift}>{T({ dx: ux * so * 0.4, dy: so + uy * so * 0.2, fill: "#000", stroke: "#000", strokeWidth: sw + 4 })}</g>);
    el.push(<g key="st">{T({ fill: "#000", stroke: "#000", strokeWidth: sw, paintOrder: "stroke" })}</g>);
    el.push(<g key="fc">{T({ fill })}</g>);
  } else {
    // die-cut v2: letters are a card cut from paper. Layers (bottom -> top):
    // key-light shadow (soft + contact) > ink hairline > darker underside edge (thickness) > lighter lit rim > card border (paper tooth) > crisp face
    const B = size * 0.04; // visible card border around the letters
    const hair = 2.2;
    const depth = 3; // thickness steps (px) toward the shadow side
    const dist = 13 + lift * 16, blur = 7 + lift * 7;
    const PAPER_UNDER = "#BDB190", PAPER_RIM = "#FFFFFF";
    const mix = (a: string, b: string, t: number) => {
      const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
      return "#" + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0")).join("");
    };
    const cardFill = mix(PAPER, "#5C5444", flash); // stamp: tiny ink-darkening flash on the rim only
    el.push(<filter id="blur" key="f" x="-20%" y="-40%" width="140%" height="180%"><feGaussianBlur stdDeviation={blur} /></filter>);
    el.push(<filter id="blur2" key="f2" x="-20%" y="-40%" width="140%" height="180%"><feGaussianBlur stdDeviation={2.2} /></filter>);
    // paper tooth: noise multiplied into the card border only (face is drawn on top, solid)
    el.push(
      <filter id="tooth" key="ft" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" result="n" />
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.28  0 0 0 0 0.18  0 0 0 -1.7 1.05" result="speck" />
        <feComposite in="speck" in2="SourceAlpha" operator="in" result="sp" />
        <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="sp" /></feMerge>
      </filter>,
    );
    el.push(<g key="sh" filter="url(#blur)" opacity={0.3 + 0.08 * lift}>{T({ dx: ux * dist, dy: uy * dist, fill: "#05101F", stroke: "#05101F", strokeWidth: 2 * B + 6 })}</g>);
    el.push(<g key="sh2" filter="url(#blur2)" opacity={0.4}>{T({ dx: ux * (4 + lift * 6), dy: uy * (4 + lift * 6), fill: "#05101F", stroke: "#05101F", strokeWidth: 2 * B + 4 })}</g>);
    for (let k = depth; k >= 0; k--) {
      el.push(<g key={"ink" + k}>{T({ dx: ux * k, dy: uy * k, fill: INK, stroke: INK, strokeWidth: 2 * B + 2 * hair, paintOrder: "stroke" })}</g>);
    }
    for (let k = depth; k >= 1; k--) {
      el.push(<g key={"ed" + k}>{T({ dx: ux * k, dy: uy * k, fill: PAPER_UNDER, stroke: PAPER_UNDER, strokeWidth: 2 * B, paintOrder: "stroke" })}</g>);
    }
    el.push(<g key="rim">{T({ dx: -ux * 1.8, dy: -uy * 1.8, fill: PAPER_RIM, stroke: PAPER_RIM, strokeWidth: 2 * B, paintOrder: "stroke" })}</g>);
    el.push(<g key="card" filter="url(#tooth)">{T({ fill: cardFill, stroke: cardFill, strokeWidth: 2 * B, paintOrder: "stroke" })}</g>);
    el.push(<g key="face">{T({ fill })}</g>);
  }
  return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: "visible", display: "block" }}>{el}</svg>;
};

export const ChunkCard: React.FC<{
  chunk: Chunk; index: number; f: number; dur: number; style: StyleId; font: FontKey; lightDir: [number, number]; centerY: number; measure: (t: string, px: number) => number;
}> = ({ chunk, index, f, dur, style, font, lightDir, centerY, measure }) => {
  const F = FONTS[font];
  const emph = chunk.emphasis;
  const { size, width, lines } = useMemo(() => {
    const m = (t: string, px: number) => measure(t, px) * 1;
    const base = BASE_SIZE * F.scale * (emph ? EMPH_SCALE : 1);
    return fitText(chunk.text, m, base);
  }, [chunk.text, emph, font]);
  const restRot = style === "diecut" ? ((Math.floor(hash(index + 3) * 5) - 2) / 2) * 0.9 : 0;
  const pose = emph ? stampPose(f, restRot) : placePose(f, restRot);
  const fo = fadeOutFactor(f, dur, chunk.fadeOut);
  const fill = emph ? TONE_COLORS[chunk.tone] : "#FFFFFF";
  const lift = pose.lift;
  const rotDamp = style === "clean" ? 0 : 1; // clean = no tilt
  return (
    <div style={{ position: "absolute", left: 0, top: centerY, width: W, display: "flex", justifyContent: "center", transform: `translateY(-50%)` }}>
      <div style={{ transform: `translate(${pose.x}px, ${pose.y + fo.y}px) rotate(${pose.rot * rotDamp}deg) scale(${pose.scale * fo.s})`, opacity: Math.min(pose.opacity, fo.o), willChange: "transform" }}>
        <Card lines={lines} size={size} width={width} family={F.family} weight={F.weight} fill={fill} lift={lift} lightDir={lightDir} style={style} emphasis={emph} flash={emph ? Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, (f - 1.5) / 5)))) * 0.65 : 0} />
      </div>
    </div>
  );
};

/** Find the chunk visible at absolute frame `frame`. */
export function activeChunk(chunks: Chunk[], frame: number, fps: number): { i: number; f: number; dur: number } | null {
  for (let i = 0; i < chunks.length; i++) {
    const s = Math.round(chunks[i].start * fps), e = Math.round(chunks[i].end * fps);
    if (frame >= s && frame < e) return { i, f: frame - s, dur: e - s };
  }
  return null;
}

export const Subtitles: React.FC<SubtitleProps> = ({ chunks, style = "diecut", font = "barlow-sc-bold", lightDir = [0.55, 0.85], centerY = BAND.center, only }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ready = useSubtitleFont(font);
  const measure = useMemo(() => measureWith(font), [font]);
  const a = activeChunk(chunks, frame, fps);
  if (!ready || !a) return null;
  if (only !== undefined && a.i !== only) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <ChunkCard chunk={chunks[a.i]} index={a.i} f={a.f} dur={a.dur} style={style} font={font} lightDir={lightDir} centerY={centerY} measure={measure} />
    </AbsoluteFill>
  );
};
