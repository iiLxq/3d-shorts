import React from "react";
import { Composition } from "remotion";
import { SmokeTest } from "./SmokeTest";
import { RatShort } from "./videos/rat/RatShort";
import { FRAMES } from "./videos/rat/story";

export const Root: React.FC = () => (
  <>
    {/* Stack check: blueprint-style wireframe cube. Replace/extend per video. */}
    <Composition id="SmokeTest" component={SmokeTest} durationInFrames={60} fps={30} width={1080} height={1920} />
    <Composition id="RatShort" component={RatShort} durationInFrames={FRAMES} fps={30} width={1080} height={1920} />
  </>
);
