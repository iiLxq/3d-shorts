import React from "react";
import { Composition, AbsoluteFill } from "remotion";
const Placeholder: React.FC = () => <AbsoluteFill style={{ background: "#222" }} />;
// Placeholder: replaced by the owning agent.
export const LabRoot: React.FC = () => <Composition id="LabPlaceholder" component={Placeholder} durationInFrames={30} fps={30} width={1080} height={1920} />;
