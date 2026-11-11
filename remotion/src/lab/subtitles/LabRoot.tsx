import React from "react";
import { AbsoluteFill, Composition } from "remotion";
import { Backdrop } from "./Backdrop";
import { Subtitles, StyleId } from "./Subtitles";
import type { Chunk } from "./chunker";
import { FontKey } from "./layout";
import { SubtitlesWorld } from "./World3D";
import data from "./data/video01.chunks.json";

const FPS = 30;
const DURATION = 1725; // 57.5 s of narration
const chunks = data.chunks as Chunk[];

type DemoProps = { style: StyleId; font: FontKey; backdrop?: number; only?: number };
const Demo: React.FC<DemoProps> = ({ style, font, backdrop, only }) => (
  <AbsoluteFill>
    <Backdrop force={backdrop} />
    <Subtitles chunks={chunks} style={style} font={font} only={only} />
  </AbsoluteFill>
);

const DemoWorld: React.FC<{ font: FontKey; backdrop?: number; only?: number }> = ({ font, backdrop, only }) => (
  <AbsoluteFill>
    <Backdrop force={backdrop} />
    <SubtitlesWorld chunks={chunks} font={font} only={only} />
  </AbsoluteFill>
);

// Font comparison cell: one synthetic chunk, any font, any backdrop.
type CellProps = { font: FontKey; text: string; emph: boolean; tone: Chunk["tone"]; backdrop: number; style: StyleId };
const FontCell: React.FC<CellProps> = ({ font, text, emph, tone, backdrop, style }) => {
  const c: Chunk = { text, start: 0, end: 4, emphasis: emph, tone, fadeOut: false, sentence: 0, words: text.split(" ").length, wordStart: 0, wordEnd: 1, firstWord: 0 };
  return (
    <AbsoluteFill>
      <Backdrop force={backdrop} />
      <Subtitles chunks={[c]} style={style} font={font} />
    </AbsoluteFill>
  );
};

export const LabRoot: React.FC = () => (
  <>
    <Composition id="SubClean" component={Demo} durationInFrames={DURATION} fps={FPS} width={1080} height={1920} defaultProps={{ style: "clean" as StyleId, font: "montserrat-xb" as FontKey }} />
    <Composition id="SubDiecut" component={Demo} durationInFrames={DURATION} fps={FPS} width={1080} height={1920} defaultProps={{ style: "diecut" as StyleId, font: "montserrat-xb" as FontKey }} />
    <Composition id="SubWorld" component={DemoWorld} durationInFrames={DURATION} fps={FPS} width={1080} height={1920} defaultProps={{ font: "archivo-black" as FontKey }} />
    <Composition id="SubFontCell" component={FontCell} durationInFrames={60} fps={FPS} width={1080} height={1920} defaultProps={{ font: "montserrat-xb" as FontKey, text: "what saves you.", emph: false, tone: "white" as Chunk["tone"], backdrop: 1, style: "diecut" as StyleId }} />
  </>
);
