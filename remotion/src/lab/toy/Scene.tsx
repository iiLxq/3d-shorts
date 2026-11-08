import React, { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { buildShaft, Shaft } from "./shaft";
import { buildFigure, applyPose, applyExpr, Figure } from "./figure";
import { makeKit, prepare, applyState, setLineRes, StateKit, LookState } from "./states";
import { makePost, Post } from "./post";
import { Spec, SPEC, vec } from "./story";
import { BRAND, untone } from "./palette";
import { radial, rng } from "./paint";

export type Mode = "hero" | "faces" | "states" | "motion";

type Built = {
  sh: Shaft; fig: Figure; kit: StateKit; post: Post; scene: THREE.Scene;
  hemi: THREE.HemisphereLight; head: THREE.SpotLight; headTarget: THREE.Object3D; cone: THREE.Mesh;
  look?: LookState; env: THREE.Texture; fill: THREE.DirectionalLight;
};

function makeEnv(gl: THREE.WebGLRenderer) {
  // A small "studio" around the model: dark shaft box, warm lamp panel front-right, cool skylight above,
  // warm landing glow behind. Gives metals motivated reflections (no HDRI needed).
  const s = new THREE.Scene();
  const box = new THREE.Mesh(new THREE.BoxGeometry(20, 20, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.012, 0.014, 0.02), side: THREE.BackSide }));
  s.add(box);
  const panel = (w: number, h: number, c: THREE.Color, p: THREE.Vector3) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
    m.position.copy(p); m.lookAt(0, 0, 0); s.add(m);
  };
  panel(3, 3, new THREE.Color(5, 3.4, 2.0), new THREE.Vector3(5, 5, 6));
  panel(6, 6, new THREE.Color(0.35, 0.5, 0.8), new THREE.Vector3(0, 9.5, 0));
  panel(4, 2, new THREE.Color(1.6, 0.9, 0.45), new THREE.Vector3(0, 1, -9));
  panel(2, 6, new THREE.Color(0.25, 0.32, 0.45), new THREE.Vector3(-9, 2, 2));
  const pm = new THREE.PMREMGenerator(gl);
  const rt = pm.fromScene(s, 0.03);
  pm.dispose();
  return rt.texture;
}

function build(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, msaa: number): Built {
  gl.toneMapping = THREE.NoToneMapping;
  gl.outputColorSpace = THREE.SRGBColorSpace;
  gl.shadowMap.enabled = true;
  gl.shadowMap.type = THREE.PCFSoftShadowMap;
  const sh = buildShaft();
  scene.add(sh.world);
  const fig = buildFigure();
  sh.figureMount.add(fig.root); fig.root.scale.setScalar(1.1);
  const env = makeEnv(gl);
  scene.environment = env;
  scene.environmentIntensity = 0.55;
  const hemi = new THREE.HemisphereLight(untone("#6F86AD"), untone("#2A2018"), 0.55);
  scene.add(hemi);
  // cool top light from the shaft head (moonlit vent), no shadows: separates silhouettes from the back wall
  const fill = new THREE.DirectionalLight(untone("#9DB4E0"), 1.1);
  fill.position.set(-1.5, 8, 2); scene.add(fill); scene.add(fill.target);
  // headlamp: cool LED spot from the helmet + faint volumetric cone
  const head = new THREE.SpotLight(untone("#E6EEFF"), 3.2, 7, 0.32, 0.55, 2);
  const headTarget = new THREE.Object3D();
  fig.headlamp.add(head); fig.headlamp.add(headTarget); headTarget.position.set(0, 0, 3); head.target = headTarget;
  const coneG = new THREE.CylinderGeometry(0.02, 0.55, 2.4, 32, 1, true); coneG.translate(0, -1.2, 0); coneG.rotateX(-Math.PI / 2);
  const cone = new THREE.Mesh(coneG, new THREE.ShaderMaterial({
    uniforms: { uC: { value: untone("#DCE6FF") }, uA: { value: 0.07 } },
    vertexShader: `varying float vL; varying vec3 vN; varying vec3 vV; void main(){ vL = position.z / 2.4; vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uC; uniform float uA; varying float vL; varying vec3 vN; varying vec3 vV; void main(){ float e = pow(abs(dot(normalize(vN), normalize(vV))), 2.0); float a = uA * e * pow(1.0 - clamp(vL,0.0,1.0), 1.6); gl_FragColor = vec4(uC * a, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }));
  fig.headlamp.add(cone);
  scene.fog = new THREE.FogExp2(untone("#10151E"), 0.05);
  const kit = makeKit();
  prepare(scene, kit);
  const post = makePost(gl, scene, camera, msaa);
  return { sh, fig, kit, post, scene, hemi, head, headTarget, cone, env, fill };
}

const sparkCache = new Map<string, Float32Array>();
function sparkField(key: string, n: number, seed: number) {
  let a = sparkCache.get(key);
  if (!a) { const R = rng(seed); a = new Float32Array(n * 6); for (let i = 0; i < n * 6; i++) a[i] = R(); sparkCache.set(key, a); }
  return a;
}

function apply(b: Built, s: Spec, size: { w: number; h: number }, camera: THREE.PerspectiveCamera) {
  const { sh, fig, kit, post } = b;
  if (b.look !== s.look) { applyState(b.scene, kit, s.look); b.look = s.look; }
  const solid = s.look === "solid";
  // car + ropes + counterweight
  sh.car.position.y = s.carY;
  const ropeBase = (s.snapped ? 0 : s.carY) + sh.hitchTop;
  sh.ropesUp.position.y = ropeBase + s.ropeUp;
  sh.ropesUp.rotation.z = s.ropeSway;
  sh.cw.position.y = -s.carY * (s.snapped ? 0 : 1) - s.ropeUp;
  // safety gear
  for (const j of sh.jaws) {
    j.mesh.position.set(j.rest.x, j.rest.y + 0.03 * s.jaw, j.rest.z - j.front * 0.0155 * s.jaw);
  }
  sh.jawMat.emissiveIntensity = s.jawGlow;
  kit.jawBp.color.copy(untone(BRAND.green).multiplyScalar(1.2 + 0.4 * s.jawGlow));
  sh.lever.rotation.z = s.lever;
  sh.alarmMat.emissiveIntensity = 0.3 + 5 * s.alarm;
  sh.alarmLight.intensity = solid ? 1.1 * s.alarm : 0;
  sh.work.intensity = solid ? 3.0 : 1.5;
  sh.arrows.visible = s.arrows;
  sh.arrows.traverse((o) => { o.userData.fxOn = s.arrows; if (o !== sh.arrows && o.userData.toy) o.visible = s.arrows; });
  // figure
  fig.root.rotation.y = s.figYaw;
  applyPose(fig, s.pose);
  applyExpr(fig, s.expr, s.blink);
  b.head.intensity = solid ? 3.2 : 0;
  (b.cone.material as THREE.ShaderMaterial).uniforms.uA.value = 0.07 * s.cone * (solid ? 1 : 0.5);
  b.cone.visible = s.cone > 0.01;
  b.scene.updateMatrixWorld(true);
  // contact shadows under the boots (fade with height above the roof)
  const v = new THREE.Vector3();
  fig.soles.forEach((so, i) => {
    so.getWorldPosition(v); sh.car.worldToLocal(v);
    const c = sh.contact[i];
    c.position.set(v.x, 0.003, v.z); c.scale.set(0.2, 1, 0.34);
    (c.material as THREE.MeshBasicMaterial).opacity = 0.75 * Math.max(0, 1 - v.y / 0.12);
  });
  {
    fig.j.hips.getWorldPosition(v); sh.car.worldToLocal(v);
    const c = sh.contact[2]; c.position.set(v.x, 0.0025, v.z + 0.02); c.scale.set(0.62, 1, 0.5);
    (c.material as THREE.MeshBasicMaterial).opacity = 0.35;
  }
  // sparks (deterministic ballistic particles)
  const pos = sh.sparks.geometry.getAttribute("position") as THREE.BufferAttribute;
  const col = sh.sparks.geometry.getAttribute("color") as THREE.BufferAttribute;
  let n = 0;
  const N = pos.count;
  for (const sp of s.sparks) {
    const field = sparkField(sp.at, 110, sp.at === "hitch" ? 7 : 9);
    const o = new THREE.Vector3();
    if (sp.at === "hitch") o.set(0, s.carY + sh.hitchTop - 0.02, -0.15);
    for (let i = 0; i < 110 && n < N; i++) {
      const r = field.subarray(i * 6, i * 6 + 6);
      const t = sp.t - r[0] * 0.12; if (t < 0) continue;
      const life = 0.25 + r[1] * 0.35; if (t > life) continue;
      let p: THREE.Vector3;
      if (sp.at === "jaw") {
        const side = r[2] < 0.5 ? -1 : 1;
        p = new THREE.Vector3(side * 1.16 - side * 0.04, s.carY - 0.1, 0.09);
        const vx = -side * (0.4 + r[3] * 1.4), vy = -0.5 - r[4] * 2.5, vz = (r[5] - 0.2) * 1.8;
        p.add(new THREE.Vector3(vx * t, vy * t - 4.9 * t * t, vz * t));
      } else {
        p = o.clone();
        const a = r[2] * Math.PI * 2, sp2 = 0.8 + r[3] * 2.4;
        p.add(new THREE.Vector3(Math.cos(a) * sp2 * t, (0.6 + r[4] * 2.5) * t - 4.9 * t * t, Math.sin(a) * sp2 * t));
      }
      const heat = 1 - t / life;
      pos.setXYZ(n, p.x, p.y, p.z);
      const k = solid ? 7 * heat : 4 * heat;
      col.setXYZ(n, k * 1.0, k * (0.55 + 0.35 * heat), k * (0.25 + 0.3 * heat));
      n++;
    }
  }
  for (let i = n; i < N; i++) { pos.setXYZ(i, 0, -999, 0); col.setXYZ(i, 0, 0, 0); }
  pos.needsUpdate = true; col.needsUpdate = true;
  sh.sparks.visible = n > 0;

  // camera
  let camPos = vec(s.cam.pos), look = vec(s.cam.look);
  if (s.camRel === "face") {
    const hc = new THREE.Vector3(); fig.headCenter.getWorldPosition(hc);
    look = hc.clone().add(vec(s.cam.look)); camPos = hc.clone().add(vec(s.cam.pos));
  }
  camPos.add(vec(s.shake)); look.add(vec(s.shake).multiplyScalar(0.6));
  camera.position.copy(camPos);
  camera.fov = s.cam.fov; camera.aspect = size.w / size.h; camera.near = 0.05; camera.far = 60;
  camera.up.set(0, 1, 0); camera.lookAt(look); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  // look-dependent world
  const bg = s.look === "solid" ? untone("#0E131B") : untone(BRAND.navy);
  b.scene.background = bg;
  (b.scene.fog as THREE.FogExp2).color.copy(s.look === "solid" ? untone("#10151E") : untone(BRAND.navy));
  (b.scene.fog as THREE.FogExp2).density = s.look === "solid" ? 0.028 : 0.025;
  b.scene.environmentIntensity = solid ? 0.85 : 0.35;
  b.hemi.intensity = solid ? 0.8 : 0.9;
  for (const m of [kit.wall, kit.wallX]) m.uniforms.uCam.value.copy(camPos);
  // lens: focus on the head (or gear)
  const fp = new THREE.Vector3();
  if (s.focus === "head") fig.headCenter.getWorldPosition(fp);
  else if (s.focus === "gear") sh.gearAnchor.getWorldPosition(fp);
  else fp.set(...s.focus);
  const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
  const fd = fp.clone().sub(camPos).dot(fwd);
  post.lens.set({ focus: fd, k: s.lensK * (solid ? 1 : 0.6), max: 20, tilt: s.tilt, tiltC: 0.5, tiltW: 0.22, scale: size.h / 1920 });
  post.bloom.intensity = solid ? 0.75 : 1.0;
  post.grade.set({
    seed: s.seed, flash: s.flash,
    grain: solid ? 0.03 : 0.018, vig: solid ? 0.26 : 0.2, lift: solid ? 0.02 : 0.012,
    contrast: solid ? 0.14 : 0.05, sat: solid ? 1.1 : 1.0,
    shadow: solid ? [-0.012, 0.0, 0.03] : [0, 0, 0], hi: solid ? [0.025, 0.01, -0.02] : [0, 0, 0],
  });
  setLineRes(kit, size.w, size.h);
}

const Rig: React.FC<{ spec: Spec; handle: number; msaa: number }> = ({ spec, handle, msaa }) => {
  const { gl, scene, camera } = useThree();
  const built = useMemo(() => build(gl, scene, camera, msaa), [gl, scene, camera, msaa]);
  useLayoutEffect(() => {
    const buf = gl.getDrawingBufferSize(new THREE.Vector2());
    built.post.composer.setSize(buf.x / gl.getPixelRatio(), buf.y / gl.getPixelRatio(), false);
    apply(built, spec, { w: buf.x, h: buf.y }, camera as THREE.PerspectiveCamera);
    built.post.composer.render();
    const gctx = gl.getContext();
    gctx.finish();
    continueRender(handle);
  }, [built, spec, handle, gl, camera]);
  return null;
};

// ---------------------------------------------------------------- DOM overlay: blueprint labels (safe zones respected)
const MONO = "'JetBrains Mono', 'DejaVu Sans Mono', monospace";
function project(s: Spec, p: THREE.Vector3, W: number, H: number) {
  const cam = new THREE.PerspectiveCamera(s.cam.fov, W / H, 0.05, 60);
  cam.position.set(...s.cam.pos); cam.lookAt(...s.cam.look); cam.updateMatrixWorld();
  const q = p.clone().project(cam);
  return { x: (q.x * 0.5 + 0.5) * W, y: (-q.y * 0.5 + 0.5) * H };
}
const Labels: React.FC<{ s: Spec }> = ({ s }) => {
  if (!s.labels) return null;
  const W = 1080, H = 1920, c = BRAND.cyan;
  const items = [
    { text: "HOIST ROPES · 4×", at: new THREE.Vector3(0, s.carY + 1.9, -0.15), x: 520, y: 330 },
    { text: "SAFETY GEAR", at: new THREE.Vector3(-1.13, s.carY + 0.02, 0.09), x: 330, y: 1000 },
    { text: "TECH 07", at: new THREE.Vector3(-0.3, 1.25, 0.05), x: 120, y: 520 },
  ];
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
      {items.map((it, i) => {
        const p = project(s, it.at, W, H);
        const tw = it.text.length * 24 + 40;
        return (
          <g key={i}>
            <line x1={it.x + tw / 2} y1={it.y + 32} x2={p.x} y2={p.y} stroke={c} strokeWidth={3} strokeDasharray="10 7" />
            <circle cx={p.x} cy={p.y} r={10} fill="none" stroke={c} strokeWidth={4} />
            <rect x={it.x} y={it.y - 32} width={tw} height={64} rx={4} fill="rgba(11,26,51,0.82)" stroke={c} strokeWidth={3} />
            <text x={it.x + 20} y={it.y + 12} fill={c} fontFamily={MONO} fontWeight={700} fontSize={36} letterSpacing={1}>{it.text}</text>
          </g>
        );
      })}
    </svg>
  );
};

export const ToyScene: React.FC<{ mode: Mode; dpr?: number; msaa?: number }> = ({ mode, dpr, msaa = 4 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const spec = useMemo(() => (mode === "hero" ? SPEC.hero() : SPEC[mode](frame)), [mode, frame]);
  const handle = useMemo(() => delayRender(`toy frame ${frame}`, { timeoutInMilliseconds: 300000 }), [frame]);
  const pr = dpr ?? (typeof window !== "undefined" ? Math.min(1, window.devicePixelRatio || 1) : 1);
  void radial;
  return (
    <AbsoluteFill style={{ backgroundColor: "#0B1A33" }}>
      <ThreeCanvas width={width} height={height} dpr={pr} frameloop="never" flat
        gl={{ antialias: false, preserveDrawingBuffer: true, powerPreference: "high-performance", stencil: false }}
        camera={{ fov: 30, near: 0.05, far: 60, position: [0, 1, 6] }}>
        <Rig spec={spec} handle={handle} msaa={msaa} />
      </ThreeCanvas>
      <Labels s={spec} />
    </AbsoluteFill>
  );
};
