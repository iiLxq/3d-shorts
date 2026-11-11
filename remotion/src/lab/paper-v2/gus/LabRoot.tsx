// [gus lab] Render host. Compositions (all 1080x1920, preview with --scale=0.5 -> real 540x960 buffer):
//   GusBoard  : stills (before/after, turnarounds, expressions, states, heroes), one config per frame
//   GusGyro   : 6 x 60 f camera-responsive test (pan/tilt/orbit, gyro off then on)
//   GusAct1s / GusAct2s : 150 f acting showcase (idle, alarm recoil, relieved exhale), Gus on 1s vs on 2s, camera on 1s
import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { Composition, AbsoluteFill, useCurrentFrame, useVideoConfig, delayRender, continueRender } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { Stage } from "./stage";
import { Post } from "./post";
import { buildGus, Gus } from "./api";
import { VARIANTS } from "./figure";
import { ExprName, EXPR_NAMES, PoseName, actShowcase, EXPRS } from "./poses";
import { Puppet, POSE0, EXPR as EXPR1 } from "./puppet_v1";
import { GYRO_TESTS, CamPose, orbitPose } from "./gyroTests";
import type { Look } from "./paint";

/** Variant + method used for turnarounds / expressions / gyro / acting (set after the before/after round). */
export const PICK: { variant: "A" | "B" } = { variant: "B" };
const LOOKS: Look[] = ["blueprint", "xray", "solid"];

type Frame = "full" | "mid" | "face";
interface Cfg { dbg?: boolean; who: "v1" | "A" | "B"; method?: "replacement" | "vfold"; az: number; el?: number; fr?: Frame; expr?: ExprName; pose?: PoseName; state?: 0 | 1 | 2 }
const T = PICK.variant;
const TURN = [0, 15, 30, 45, 60, 75, 90];
export const BOARD: Cfg[] = [
  { who: "v1", az: 15 }, { who: "A", az: 15 }, { who: "B", az: 15 },                          // 0-2 full
  { who: "v1", az: 0, fr: "mid" }, { who: "A", az: 0, fr: "mid" }, { who: "B", az: 0, fr: "mid" }, // 3-5 mid
  ...TURN.map((az) => ({ who: T, method: "replacement" as const, az, fr: "full" as Frame })),          // 6-12
  ...TURN.map((az) => ({ who: T, method: "vfold" as const, az, fr: "full" as Frame })),                // 13-19
  ...EXPR_NAMES.map((expr) => ({ who: T, az: 10, fr: "mid" as Frame, expr })),                        // 20-27
  { who: T, az: 90, fr: "mid", expr: "alarmed" }, { who: T, az: 45, fr: "mid", expr: "smiling" },    // 28-29
  { who: T, az: 18, state: 0 }, { who: T, az: 18, state: 1 },                                         // 30-31
  { who: T, az: 14, el: 9, expr: "terrified", pose: "alarmRecoil" }, { who: T, az: 14, fr: "face", expr: "curious" }, // 32-33 heroes
  { who: "v1", az: 45 }, { who: "v1", az: 75 },                                                         // 34-35 v1 limit
  { who: T, method: "vfold", az: 30, fr: "mid", expr: "smiling" },                                      // 36
  { who: T, az: 50, el: 35, dbg: true },                                                                // 37 debug: key only
];

/** A fresh camera for a pose (track samplers never touch the stage camera). */
function camOf(p: CamPose) {
  const c = new THREE.PerspectiveCamera(p.fov, 1080 / 1920, 0.05, 60);
  c.position.set(...p.pos);
  c.lookAt(p.pos[0] + p.dir[0], p.pos[1] + p.dir[1], p.pos[2] + p.dir[2]);
  c.updateMatrixWorld();
  return c;
}
function frameCam(stage: Stage, fr: Frame, az: number, el: number, chinY: number) {
  if (fr === "face") return { cam: stage.orbit(new THREE.Vector3(0, chinY + 0.14, 0), az, el, 1.2, 28), blur: 9 };
  if (fr === "mid") return { cam: stage.orbit(new THREE.Vector3(0, chinY - 0.1, 0), az, el, 2.6, 28), blur: 6 };
  return { cam: stage.orbit(new THREE.Vector3(0, 0.93, 0), az, el, 5.4, 28), blur: 3 };
}

interface Env { stage: Stage; post: Post; cache: Map<string, { root: THREE.Object3D; gus?: Gus; v1?: Puppet }> }
function getActor(env: Env, key: string, make: () => { root: THREE.Object3D; gus?: Gus; v1?: Puppet }) {
  let a = env.cache.get(key);
  if (!a) { a = make(); env.cache.set(key, a); env.stage.scene.add(a.root); }
  for (const [k, o] of env.cache) o.root.visible = k === key;
  return a;
}
function gusActor(env: Env, variant: "A" | "B", method: "replacement" | "vfold") {
  return getActor(env, `${variant}-${method}`, () => { const gus = buildGus({ variant, method }); return { root: gus.root, gus }; });
}

const Host: React.FC<{ comp: string; frame: number }> = ({ comp, frame }) => {
  const { gl } = useThree();
  const env = useMemo<Env>(() => {
    gl.shadowMap.enabled = true; gl.shadowMap.type = THREE.PCFSoftShadowMap;
    gl.toneMapping = THREE.NoToneMapping; gl.outputColorSpace = THREE.SRGBColorSpace;
    const stage = new Stage(gl);
    const post = new Post(gl, stage.scene, stage.camera, 0);
    post.setSize(1080, 1920);
    return { stage, post, cache: new Map() };
  }, [gl]);
  const handle = useMemo(() => delayRender(`gus ${comp} ${frame}`), [comp, frame]);
  useEffect(() => {
    const { stage, post } = env;
    const t0 = performance.now();
    let look: Look = "solid", blur = 4, focus = new THREE.Vector3(0, 1.4, 0);
    if (comp === "board") {
      const c = BOARD[Math.min(frame, BOARD.length - 1)];
      const state = c.state ?? 2; look = LOOKS[state];
      const chinY = c.who === "v1" ? 1.29 : VARIANTS[c.who].chinY;
      const { cam, blur: b } = frameCam(stage, c.fr ?? "full", c.az, c.el ?? ((c.fr ?? "full") === "full" ? 11 : 4), chinY);
      blur = b; focus = new THREE.Vector3(0, c.fr === "full" || !c.fr ? 1.2 : chinY + 0.1, 0);
      if (c.who === "v1") {
        const a = getActor(env, "v1", () => { const p = new Puppet(); p.cards.forEach((k) => k.setLook("solid")); return { root: p.root, v1: p }; });
        a.v1!.pose(POSE0); a.v1!.expr(EXPR1.calm);
        a.root.rotation.y = 0;
      } else {
        const a = gusActor(env, c.who, c.method ?? "replacement");
        const g = a.gus!;
        g.setState(state);
        g.setPose(c.pose ?? "idle"); g.setExpression(c.expr ?? "neutral");
        g.setCameraTrack(() => cam, 0);
        (g as unknown as { o: { autoBlink: boolean } }).o.autoBlink = false;
        g.update(frame, cam);
      }
    } else if (comp === "gyro") {
      const seg = Math.floor(frame / 60);
      const test = GYRO_TESTS[Math.floor(seg / 2)], on = seg % 2 === 1;
      const a = gusActor(env, PICK.variant, "replacement");
      const g = a.gus!;
      (g as unknown as { gyro: unknown }).gyro = on ? { gain: 0.15, lag: 10, yawLim: 12 * Math.PI / 180, pitchLim: 6 * Math.PI / 180, rollLim: 3.5 * Math.PI / 180, rollGain: 3, panShare: 0.5 } : null;
      g.setState(2); g.setPose("idle"); g.setExpression("neutral");
      g.setCameraTrack((f) => camOf(test.at(f - seg * 60)), seg * 60);
      const cam = camOf(test.at(frame - seg * 60));
      g.update(frame, cam);
      stage.camera.copy(cam);
      console.log(`GYRO ${test.name} on=${on} k=${frame - seg * 60} view=${g.debug.view} theta=${g.debug.theta.toFixed(4)} yaw=${g.debug.lean.yaw.toFixed(5)} pitch=${g.debug.lean.pitch.toFixed(5)} roll=${g.debug.lean.roll.toFixed(5)}`);
      focus = new THREE.Vector3(0, 1.3, 0); blur = 3;
    } else {
      const twos = comp === "act2";
      const a = gusActor(env, PICK.variant, "replacement");
      const g = a.gus!;
      const act = actShowcase(frame, twos);
      g.setState(2); g.setPose(act.pose); g.setExpression(act.expr);
      const chinY = VARIANTS[PICK.variant].chinY;
      const path = (f: number) => { const t = f / 149, e = t * t * (3 - 2 * t); return orbitPose([0, 1.05 + 0.15 * e, 0], 8 + 10 * e, 4, 4.9 - 1.2 * e); };
      g.setCameraTrack((f) => camOf(path(f)), 0);
      (g as unknown as { o: { onTwos: boolean } }).o.onTwos = twos;
      const cam = camOf(path(frame));
      g.update(frame, cam);
      stage.camera.copy(cam);
      const s = g.debug.soles.map((p) => `${p.x.toFixed(5)},${p.y.toFixed(5)},${p.z.toFixed(5)}`).join(" ");
      console.log(`FOOTLOCK ${comp} f=${frame} view=${g.debug.view} ${s}`);
      focus = new THREE.Vector3(0, chinY, 0); blur = 4;
    }
    stage.setLook(look);
    // R3F re-applies gl.shadowMap.enabled = !!shadows on every Canvas render: keep it on explicitly
    gl.shadowMap.enabled = true; gl.shadowMap.type = THREE.PCFSoftShadowMap;
    if (comp === "board" && BOARD[Math.min(frame, BOARD.length - 1)].dbg) { stage.hemi.intensity = 0; stage.fill.intensity = 0; stage.rim.intensity = 0; stage.scene.environmentIntensity = 0; }
    const cam = stage.camera;
    const fwd = new THREE.Vector3(); cam.getWorldDirection(fwd);
    const buf = gl.getDrawingBufferSize(new THREE.Vector2());
    post.lens.set(focus.clone().sub(cam.position).dot(fwd), blur, buf.y);
    post.grade.uniforms.get("uFlash")!.value = 0;
    post.grade.uniforms.get("uVigCol")!.value = look === "solid" ? new THREE.Color(0.07, 0.1, 0.17) : new THREE.Color(0.043, 0.102, 0.2);
    post.grade.uniforms.get("uWarm")!.value = look === "solid" ? 1 : 0.2;
    post.bloom.intensity = look === "solid" ? 0.5 : 0.9;
    post.render();
    gl.getContext().finish();
    let casters = 0; stage.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh && o.castShadow && o.visible) casters++; });
    console.log(`gus ${comp} f${frame} ${(performance.now() - t0).toFixed(0)}ms shadowMap=${gl.shadowMap.enabled} type=${gl.shadowMap.type} casters=${casters} keyShadow=${stage.key.castShadow} mapSize=${stage.key.shadow.map ? stage.key.shadow.map.width : "none"}`);
    continueRender(handle);
  }, [env, comp, frame, handle, gl]);
  return null;
};

const View: React.FC<{ comp: string }> = ({ comp }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  return (
    <AbsoluteFill style={{ backgroundColor: "#0B1A33" }}>
      <ThreeCanvas width={width} height={height} frameloop="never" dpr={dpr} shadows="soft" gl={{ antialias: false, alpha: false, preserveDrawingBuffer: true }}>
        <Host comp={comp} frame={frame} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
const Board: React.FC = () => <View comp="board" />;
const Gyro: React.FC = () => <View comp="gyro" />;
const Act1: React.FC = () => <View comp="act1" />;
const Act2: React.FC = () => <View comp="act2" />;
void EXPRS;

export const LabRoot: React.FC = () => (
  <>
    <Composition id="GusBoard" component={Board} durationInFrames={BOARD.length} fps={30} width={1080} height={1920} />
    <Composition id="GusGyro" component={Gyro} durationInFrames={360} fps={30} width={1080} height={1920} />
    <Composition id="GusAct1s" component={Act1} durationInFrames={150} fps={30} width={1080} height={1920} />
    <Composition id="GusAct2s" component={Act2} durationInFrames={150} fps={30} width={1080} height={1920} />
  </>
);
