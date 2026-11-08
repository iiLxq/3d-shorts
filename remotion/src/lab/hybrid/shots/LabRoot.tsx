import React from "react";
import { Composition } from "remotion";
import { HyTest } from "./HyTest";
// hybrid/shots: the Lamplit Gouache test animation (render with --scale 0.5 for a true 540x960 preview buffer).
// HyTestHold: shimmer test - camera locked to the f90 camera while the story runs f80-91 (idle, haze, dust, breathing).
const HOLD = { f0: 80, camF: 90 };
const Hold: React.FC = () => <HyTest hold={HOLD} />;
export const LabRoot: React.FC = () => (
  <>
    <Composition id="HyTest" component={HyTest} durationInFrames={300} fps={30} width={1080} height={1920} />
    <Composition id="HyTestHold" component={Hold} durationInFrames={12} fps={30} width={1080} height={1920} />
  </>
);
