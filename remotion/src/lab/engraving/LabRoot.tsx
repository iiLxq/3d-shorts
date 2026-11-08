import React from "react";
import { Composition, AbsoluteFill } from "remotion";
// Placeholder. The engraving concept agent replaces this with its compositions (ids prefixed "Engraving").
const Placeholder: React.FC = () => <AbsoluteFill style={{ background: "#222" }} />;
export const LabRoot: React.FC = () => (
  <Composition id="EngravingHero" component={Placeholder} durationInFrames={90} fps={30} width={1080} height={1920} />
);
