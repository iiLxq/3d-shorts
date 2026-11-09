import React from "react";
import { AbsoluteFill, Composition } from "remotion";
import { Backdrop } from "./Backdrop";
import { Subtitles, StyleId } from "./Subtitles";
import type { Chunk } from "./chunker";
import { FontKey } from "./layout";
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

export const LabRoot: React.FC = () => (
  <>
    <Composition id="SubClean" component={Demo} durationInFrames={DURATION} fps={FPS} width={1080} height={1920} defaultProps={{ style: "clean" as StyleId, font: "montserrat-xb" as FontKey }} />
    <Composition id="SubDiecut" component={Demo} durationInFrames={DURATION} fps={FPS} width={1080} height={1920} defaultProps={{ style: "diecut" as StyleId, font: "montserrat-xb" as FontKey }} />
  </>
);
