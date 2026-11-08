import React from "react";
import { Composition, AbsoluteFill } from "remotion";
// Placeholder. The toy concept agent replaces this with its compositions (ids prefixed "Toy").
const Placeholder: React.FC = () => <AbsoluteFill style={{ background: "#222" }} />;
export const LabRoot: React.FC = () => (
  <Composition id="ToyHero" component={Placeholder} durationInFrames={90} fps={30} width={1080} height={1920} />
);
