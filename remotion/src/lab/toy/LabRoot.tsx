import React from "react";
import { Composition } from "remotion";
import { ToyScene } from "./Scene";

// TOY / Precision Miniature — all compositions 1080x1920 @ 30 fps; render at --scale 0.5.
const C = { fps: 30, width: 1080, height: 1920 };
export const LabRoot: React.FC = () => (
  <>
    <Composition id="ToyHero" component={ToyScene} durationInFrames={1} {...C} defaultProps={{ mode: "hero" as const }} />
    <Composition id="ToyFaces" component={ToyScene} durationInFrames={3} {...C} defaultProps={{ mode: "faces" as const }} />
    <Composition id="ToyStates" component={ToyScene} durationInFrames={3} {...C} defaultProps={{ mode: "states" as const }} />
    <Composition id="ToyMotion" component={ToyScene} durationInFrames={90} {...C} defaultProps={{ mode: "motion" as const }} />
  </>
);
