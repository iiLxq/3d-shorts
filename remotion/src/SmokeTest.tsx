import React from "react";
import { ThreeCanvas } from "@remotion/three";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { EffectComposer, Bloom } from "@react-three/postprocessing";

const Cube: React.FC<{ frame: number }> = ({ frame }) => (
  <mesh rotation={[0.4, frame * 0.05, 0]}>
    <boxGeometry args={[1.6, 1.6, 1.6]} />
    <meshBasicMaterial color={[0.21 * 3, 0.84 * 3, 1.0 * 3]} wireframe toneMapped={false} />
  </mesh>
);

export const SmokeTest: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  return (
    <div style={{ flex: 1, backgroundColor: "#0B1A33" }}>
      <ThreeCanvas width={width} height={height} camera={{ position: [0, 0, 5], fov: 50 }} gl={{ antialias: true }}>
        <Cube frame={frame} />
        <EffectComposer multisampling={4}>
          <Bloom luminanceThreshold={1.0} intensity={0.8} mipmapBlur />
        </EffectComposer>
      </ThreeCanvas>
    </div>
  );
};
