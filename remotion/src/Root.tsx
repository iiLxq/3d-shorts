import React from "react";
import { Composition } from "remotion";
import { SmokeTest } from "./SmokeTest";

export const Root: React.FC = () => (
  <>
    {/* Stack check: blueprint-style wireframe cube. Replace/extend per video. */}
    <Composition id="SmokeTest" component={SmokeTest} durationInFrames={60} fps={30} width={1080} height={1920} />
  </>
);
