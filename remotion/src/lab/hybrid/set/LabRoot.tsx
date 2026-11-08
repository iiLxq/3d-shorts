import React from "react";
import { Composition } from "remotion";
import { SetScene } from "./SetScene";
// hybrid/set standalone tests (Set & Mechanism TD). 1080x1920; render with --scale 0.5 (true 540x960 buffer, dpr 0.5).
const Establish: React.FC = () => <SetScene comp="establish" />;
const Gear: React.FC = () => <SetScene comp="gear" />;
const Snap: React.FC = () => <SetScene comp="snap" />;
const States: React.FC = () => <SetScene comp="states" />;
export const LabRoot: React.FC = () => (
  <>
    <Composition id="HySetEstablish" component={Establish} durationInFrames={2} fps={30} width={1080} height={1920} />
    <Composition id="HySetGear" component={Gear} durationInFrames={45} fps={30} width={1080} height={1920} />
    <Composition id="HySetSnap" component={Snap} durationInFrames={45} fps={30} width={1080} height={1920} />
    <Composition id="HySetStates" component={States} durationInFrames={3} fps={30} width={1080} height={1920} />
  </>
);
