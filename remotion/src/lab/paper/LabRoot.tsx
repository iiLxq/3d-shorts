import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { Composition, AbsoluteFill, useCurrentFrame, useVideoConfig, delayRender, continueRender } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { World } from "./world";
import { Post } from "./post";
import { Shot, boardShot, motionShot } from "./story";

const DEBUG_PICK = false;
const Host: React.FC<{ shot: Shot; frame: number }> = ({ shot, frame }) => {
  const { gl } = useThree();
  const env = useMemo(() => {
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
    gl.toneMapping = THREE.NoToneMapping;
    gl.outputColorSpace = THREE.SRGBColorSpace;
    const world = new World();
    const post = new Post(gl, world.scene, world.camera, 0);
    post.setSize(1080, 1920);
    return { world, post };
  }, [gl]);
  const handle = useMemo(() => delayRender(`paper frame ${frame}`), [frame]);
  useEffect(() => {
    const { world, post } = env;
    world.update(shot);
    const fwd = new THREE.Vector3(); world.camera.getWorldDirection(fwd);
    const focus = shot.focusAt.clone().sub(world.camera.position).dot(fwd);
    const buf = gl.getDrawingBufferSize(new THREE.Vector2());
    post.lens.set(focus, shot.cam.blur, buf.y);
    post.grade.uniforms.get("uFlash")!.value = shot.flash;
    const vig = shot.look === "solid" ? new THREE.Color(0.07, 0.1, 0.17) : shot.look === "blueprint" ? new THREE.Color(0.043, 0.102, 0.2) : new THREE.Color(0.05, 0.12, 0.18);
    post.grade.uniforms.get("uVigCol")!.value = vig;
    post.grade.uniforms.get("uWarm")!.value = shot.look === "solid" ? 1 : 0.2;
    post.bloom.intensity = shot.look === "solid" ? 0.65 : 0.95;
    if (DEBUG_PICK) {
      const rc = new THREE.Raycaster();
      for (const [x, y] of [[0.4, -0.2], [0.8, -0.6], [0.5, 0.1]]) {
        rc.setFromCamera(new THREE.Vector2(x, y), world.camera);
        const hits = rc.intersectObjects(world.scene.children, true).slice(0, 3);
        console.log("PICK", x, y, hits.map((h) => `${h.object.type}:${h.object.name}:${h.distance.toFixed(2)}:${(h.object as THREE.Mesh).geometry?.type}:${JSON.stringify(h.point.toArray().map((v) => +v.toFixed(2)))}`).join(" | "));
      }
    }
    const t0 = performance.now();
    post.render();
    gl.getContext().finish();
    if (DEBUG_PICK) {
      const ctx = gl.getContext(); const px = new Uint8Array(4);
      const b = gl.getDrawingBufferSize(new THREE.Vector2());
      for (const [x, y] of [[400, 260], [100, 760], [270, 100]]) { ctx.readPixels(x, y, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, px); console.log("PIX", b.x, b.y, x, y, Array.from(px).join(",")); }
      const el = gl.domElement; console.log("CANVAS", el.width, el.height, el.style.width, el.style.height, JSON.stringify(el.getBoundingClientRect()));
    }
    console.log(`paper render f${frame} ${(performance.now() - t0).toFixed(0)}ms`);
    continueRender(handle);
  }, [env, shot, frame, handle, gl]);
  return null;
};

const PaperView: React.FC<{ shotAt: (f: number) => Shot }> = ({ shotAt }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const shot = useMemo(() => shotAt(frame), [frame, shotAt]);
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  return (
    <AbsoluteFill style={{ backgroundColor: "#0B1A33" }}>
      <ThreeCanvas width={width} height={height} frameloop="never" dpr={dpr} gl={{ antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" }}>
        <Host shot={shot} frame={frame} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

const Board: React.FC = () => <PaperView shotAt={boardShot} />;
const Motion: React.FC = () => <PaperView shotAt={motionShot} />;

export const LabRoot: React.FC = () => (
  <>
    <Composition id="PaperBoard" component={Board} durationInFrames={6} fps={30} width={1080} height={1920} />
    <Composition id="PaperHero" component={Board} durationInFrames={1} fps={30} width={1080} height={1920} />
    <Composition id="PaperMotion" component={Motion} durationInFrames={90} fps={30} width={1080} height={1920} />
  </>
);
