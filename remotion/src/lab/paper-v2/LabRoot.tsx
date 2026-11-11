// PaperV2 render host (World & Look lab). PaperV2Test = 300-frame look test; stills via scripts/stills.mjs.
import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { Composition, AbsoluteFill, useCurrentFrame, useVideoConfig, delayRender, continueRender } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { World, Frame, GEAR } from "./set";
import { Post, SheetComposite } from "./post";
import { Meter } from "./meter";
import { BUMPK } from "./card";
import { frameAt, carY, T, N } from "./timeline";

const Host: React.FC<{ frame: number }> = ({ frame }) => {
  const { gl } = useThree();
  const env = useMemo(() => {
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFShadowMap;
    gl.toneMapping = THREE.NoToneMapping;
    gl.outputColorSpace = THREE.SRGBColorSpace;
    BUMPK.v = gl.getPixelRatio();
    const world = new World();
    world.carYAtSnap = (t: number) => carY(T.SNAP + t * 30);
    const meter = new Meter();
    const post = new Post(gl, world.scene, world.camera, { scene: meter.scene, camera: meter.camera });
    post.setSize(1080, 1920);
    const comp = new SheetComposite();
    return { world, post, meter, comp };
  }, [gl]);
  const handle = useMemo(() => delayRender(`paperv2 frame ${frame}`), [frame]);
  useEffect(() => {
    const { world, post, meter, comp } = env;
    const plan = frameAt(frame);
    const buf = gl.getDrawingBufferSize(new THREE.Vector2());
    const pass = (st: Frame) => {
      world.update(st);
      const fwd = new THREE.Vector3(); world.camera.getWorldDirection(fwd);
      const focus = Math.max(0.2, st.cam.focus.clone().sub(world.camera.position).dot(fwd));
      post.lens.set(focus, st.cam.blur, buf.y);
      const g = post.grade.uniforms;
      g.get("uWarm")!.value = st.look === "solid" ? 1 : 0.25;
      g.get("uVigCol")!.value = st.look === "solid" ? new THREE.Color(0.045, 0.07, 0.15) : new THREE.Color(0.043, 0.102, 0.2);
      post.bloom.intensity = st.look === "solid" ? 0.55 : 0.85;
      const jaw = world.car.localToWorld(new THREE.Vector3(GEAR.x - 0.06, GEAR.y + 0.2, 0));
      post.flash(world.camera, st.look === "blueprint" ? null : jaw, plan.flash, 150);
      meter.update(plan.meter.level, plan.meter.show, st.look, st.alarm);
      post.render();
    };
    const t0 = performance.now();
    pass(plan.a);
    if (plan.b) {
      comp.grab(gl);
      pass(plan.b);
      const u = comp.mat.uniforms;
      u.uMode.value = plan.mode; u.uL.value = plan.L ?? 0; u.uR.value = 0.13;
      u.uEdge0.value = plan.e0 ?? 0; u.uEdge1.value = plan.e1 ?? 1;
      u.uO.value.set(1, 0); u.uD.value.set(-0.5625, 1).normalize();
      comp.draw(gl);
    }
    gl.getContext().finish();
    console.log(`paperv2 f${frame} ${(performance.now() - t0).toFixed(0)}ms`);
    continueRender(handle);
  }, [env, frame, handle, gl]);
  return null;
};

const View: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  return (
    <AbsoluteFill style={{ backgroundColor: "#0B1A33" }}>
      <ThreeCanvas width={width} height={height} frameloop="never" dpr={dpr} gl={{ antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" }}>
        <Host frame={frame} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

export const LabRoot: React.FC = () => (
  <>
    <Composition id="PaperV2Test" component={View} durationInFrames={N} fps={30} width={1080} height={1920} />
  </>
);
