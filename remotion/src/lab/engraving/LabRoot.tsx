import React from "react";
import { Composition } from "remotion";
import { Engraving } from "./Engraving";

const Hero: React.FC = () => <Engraving mode="hero" />;
const Faces: React.FC = () => <Engraving mode="faces" />;
const States: React.FC = () => <Engraving mode="states" />;
const Motion: React.FC = () => <Engraving mode="motion" />;

export const LabRoot: React.FC = () => (
  <>
    <Composition id="EngravingHero" component={Hero} durationInFrames={1} fps={30} width={1080} height={1920} />
    <Composition id="EngravingFaces" component={Faces} durationInFrames={3} fps={30} width={1080} height={1920} />
    <Composition id="EngravingStates" component={States} durationInFrames={3} fps={30} width={1080} height={1920} />
    <Composition id="EngravingMotion" component={Motion} durationInFrames={90} fps={30} width={1080} height={1920} />
  </>
);
