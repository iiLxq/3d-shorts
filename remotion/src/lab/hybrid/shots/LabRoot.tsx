import React from "react";
import { Composition, AbsoluteFill } from "remotion";
const Placeholder: React.FC = () => <AbsoluteFill style={{ background: "#222" }} />;
// Placeholder: the shots agent replaces this (composition ids prefixed "HyShots").
export const LabRoot: React.FC = () => <Composition id="HyShotsTest" component={Placeholder} durationInFrames={30} fps={30} width={1080} height={1920} />;
