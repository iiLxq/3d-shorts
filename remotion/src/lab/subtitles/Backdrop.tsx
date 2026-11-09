import React from "react";
import { AbsoluteFill, Img, Loop, OffthreadVideo, staticFile, useCurrentFrame } from "remotion";

const SEG = 90; // 3 s per backdrop
const STILLS = ["backdrops/blueprint.jpg", "backdrops/xray.jpg", "backdrops/face.jpg", "backdrops/hero.jpg"];
export const BACKDROP_ORDER = ["motion", "blueprint", "xray", "face", "hero"] as const;

/** Real Paper Case-File footage/stills as a test backdrop: motion clip, blueprint (dark), x-ray, bright orange face, hero. */
export const Backdrop: React.FC<{ force?: number }> = ({ force }) => {
  const frame = useCurrentFrame();
  const seg = force ?? Math.floor(frame / SEG) % 5;
  const t = force !== undefined ? 0 : (frame % SEG) / SEG;
  if (seg === 0)
    return (
      <AbsoluteFill style={{ background: "#0B1A33" }}>
        <Loop durationInFrames={90}>
          <OffthreadVideo src={staticFile("backdrops/motion.mp4")} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </Loop>
      </AbsoluteFill>
    );
  return (
    <AbsoluteFill style={{ background: "#0B1A33", overflow: "hidden" }}>
      <Img src={staticFile(STILLS[seg - 1])} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${1.04 + 0.04 * t}) translateY(${-8 * t}px)` }} />
    </AbsoluteFill>
  );
};
