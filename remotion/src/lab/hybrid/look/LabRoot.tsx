import React from "react";
import { Composition, AbsoluteFill } from "remotion";
const Placeholder: React.FC = () => <AbsoluteFill style={{ background: "#222" }} />;
// Placeholder: the look agent replaces this (composition ids prefixed "HyCast").
export const LabRoot: React.FC = () => <Composition id="HyLookTest" component={Placeholder} durationInFrames={30} fps={30} width={1080} height={1920} />;
