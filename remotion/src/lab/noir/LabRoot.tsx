import React from "react";
import { Composition } from "remotion";
import { NoirScene } from "./NoirScene";
// GOUACHE / "Lit Gouache Noir" art-direction lab. All compositions 1080x1920; render at --scale 0.5 (dpr 0.5 buffer).
const Hero: React.FC = () => <NoirScene comp="hero" />;
const Faces: React.FC = () => <NoirScene comp="faces" />;
const States: React.FC = () => <NoirScene comp="states" />;
const Motion: React.FC = () => <NoirScene comp="motion" />;
export const LabRoot: React.FC = () => (
  <>
    <Composition id="NoirHero" component={Hero} durationInFrames={1} fps={30} width={1080} height={1920} />
    <Composition id="NoirFaces" component={Faces} durationInFrames={3} fps={30} width={1080} height={1920} />
    <Composition id="NoirStates" component={States} durationInFrames={3} fps={30} width={1080} height={1920} />
    <Composition id="NoirMotion" component={Motion} durationInFrames={90} fps={30} width={1080} height={1920} />
  </>
);
