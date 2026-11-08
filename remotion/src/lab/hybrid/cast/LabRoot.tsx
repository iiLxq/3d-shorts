import React from "react";
import { Composition } from "remotion";
import { CastScene } from "./CastScene";
// hybrid/cast test compositions (1080x1920; render at --scale 0.5 -> real 540x960 buffer via devicePixelRatio).
const Turn: React.FC = () => <CastScene comp="turn" />;       // f0 Rafa, f1 Noor
const Faces: React.FC = () => <CastScene comp="faces" />;     // f0 Rafa x12, f1 Noor x12, f2 phone-size medium shots
const Lineup: React.FC = () => <CastScene comp="lineup" />;
const States: React.FC = () => <CastScene comp="states" />;
const Motion: React.FC = () => <CastScene comp="motion" />;
export const LabRoot: React.FC = () => (
  <>
    <Composition id="HyCastTurn" component={Turn} durationInFrames={2} fps={30} width={1080} height={1920} />
    <Composition id="HyCastFaces" component={Faces} durationInFrames={3} fps={30} width={1080} height={1920} />
    <Composition id="HyCastLineup" component={Lineup} durationInFrames={1} fps={30} width={1080} height={1920} />
    <Composition id="HyCastStates" component={States} durationInFrames={1} fps={30} width={1080} height={1920} />
    <Composition id="HyCastMotion" component={Motion} durationInFrames={60} fps={30} width={1080} height={1920} />
  </>
);
