import React, { useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import {
  buildPlane, ratParts, ratBlades, hatchDoor, hydraulicPaths, cockpitParts, yokeGeo, mergeSimple,
  RAT_PIVOT, RAT_STRUT, ENGINE_X, YOKE_POS, COCKPIT, engineFace,
} from "./plane";
import { C, addOutlineNormals, outlineMaterial, fillMaterial, xrayMaterial, solidMaterial, setClip } from "./looks";
import { State, GEAR_H } from "./story";

type Mats = { fill: THREE.ShaderMaterial; line: THREE.ShaderMaterial; glow: THREE.ShaderMaterial; xray: THREE.ShaderMaterial; solid: THREE.ShaderMaterial; ink: THREE.ShaderMaterial };
function makeMats(albedo: THREE.ColorRepresentation, lineW = 3.0): Mats {
  return {
    fill: fillMaterial(),
    line: outlineMaterial(C.cyan, lineW, 1, false),
    glow: outlineMaterial(C.cyan, lineW * 3.4, 0.3, true),
    xray: xrayMaterial(),
    solid: solidMaterial(albedo),
    ink: outlineMaterial(C.ink, 1.7, 1, false),
  };
}

// A part rendered in all looks at once; visibility & clip decided by the state.
const LookMesh: React.FC<{ geo: THREE.BufferGeometry; m: Mats; st: State; xrayOk?: boolean }> = ({ geo, m, st, xrayOk = true }) => {
  const solidOn = st.printZ > -1e5;
  const bpOn = st.printZ < 1e5;
  [m.fill, m.line, m.glow].forEach((mm) => setClip(mm, st.printZ, -1));
  [m.solid, m.ink].forEach((mm) => setClip(mm, st.printZ, 1));
  m.fill.uniforms.uOpacity.value = st.fill;
  m.line.uniforms.uOpacity.value = st.lines;
  m.glow.uniforms.uOpacity.value = 0.3 * st.lines;
  m.fill.uniforms.uOpacity.value = st.fill * (1 - 0.6 * (st.ghost ?? 0));
  m.xray.uniforms.uOpacity.value = st.xray;
  return (
    <>
      {bpOn && st.fill > 0.01 && <mesh geometry={geo} material={m.fill} renderOrder={1} />}
      {bpOn && st.lines > 0.01 && <mesh geometry={geo} material={m.line} renderOrder={2} />}
      {bpOn && st.lines > 0.01 && <mesh geometry={geo} material={m.glow} renderOrder={3} />}
      {xrayOk && st.xray > 0.01 && <mesh geometry={geo} material={m.xray} renderOrder={5} />}
      {solidOn && <mesh geometry={geo} material={m.solid} renderOrder={0} />}
      {solidOn && <mesh geometry={geo} material={m.ink} renderOrder={0} />}
    </>
  );
};

function useCamera(st: State) {
  const { camera } = useThree();
  const cam = camera as THREE.PerspectiveCamera;
  cam.position.copy(st.cam.pos);
  cam.fov = st.cam.fov;
  const inside = st.shot === 5 || st.shot === 8 || st.shot === 15 || (st.shot >= 18 && st.shot <= 20);
  cam.near = inside ? 0.05 : 0.6; cam.far = 6000; // larger near plane outside = no z-fighting on the runway
  const fwd = st.cam.look.clone().sub(st.cam.pos).normalize();
  cam.up.set(0, 1, 0).applyAxisAngle(fwd, st.cam.roll);
  cam.lookAt(st.cam.look);
  cam.updateProjectionMatrix();
}

// ---------- canvas textures ----------
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat?: [number, number]) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
const rnd = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function farmTexture() {
  return canvasTex(1024, 1024, (g) => {
    const cols = ["#8aa05a", "#b8a868", "#6f8f4c", "#c9b77a", "#9cae66", "#a7955c"];
    for (let i = 0; i < 64; i++) for (let j = 0; j < 64; j++) {
      g.fillStyle = cols[Math.floor(rnd(i * 64 + j) * cols.length)];
      g.fillRect(i * 16, j * 16, 16, 16);
    }
    g.strokeStyle = "rgba(60,50,30,0.35)"; g.lineWidth = 1;
    for (let i = 0; i <= 64; i++) { g.beginPath(); g.moveTo(i * 16, 0); g.lineTo(i * 16, 1024); g.stroke(); g.beginPath(); g.moveTo(0, i * 16); g.lineTo(1024, i * 16); g.stroke(); }
  }, [6, 6]);
}
function runwayTexture() {
  return canvasTex(256, 2048, (g) => {
    g.fillStyle = "#55575a"; g.fillRect(0, 0, 256, 2048);
    for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(0,0,0,${0.05 * rnd(i)})`; g.fillRect(rnd(i + 9) * 256, rnd(i + 17) * 2048, 3, 3); }
    g.fillStyle = "#e9e6dc";
    for (let y = 40; y < 2048; y += 120) g.fillRect(124, y, 8, 60); // centre dashes
    g.fillRect(8, 0, 6, 2048); g.fillRect(242, 0, 6, 2048);
  }, [1, 6]);
}
function cloudTexture() {
  return canvasTex(256, 256, (g) => {
    for (let i = 0; i < 9; i++) {
      const x = 70 + rnd(i) * 116, y = 90 + rnd(i + 3) * 70, r = 40 + rnd(i + 7) * 50;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, "rgba(255,255,255,0.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    }
  });
}

// ---------- arrow helper ----------
const Arrow: React.FC<{ from: THREE.Vector3; to: THREE.Vector3; color: THREE.Color; r?: number }> = ({ from, to, color, r = 0.25 }) => {
  const dir = to.clone().sub(from); const len = dir.length();
  if (len < 1e-3) return null;
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  const head = Math.min(len * 0.4, r * 4);
  return (
    <group position={from} quaternion={q}>
      <mesh position={[0, (len - head) / 2, 0]}><cylinderGeometry args={[r, r, len - head, 12]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>
      <mesh position={[0, len - head / 2, 0]}><coneGeometry args={[r * 2.4, head, 16]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>
    </group>
  );
};

// ---------- the plane ----------
const Plane: React.FC<{ st: State }> = ({ st }) => {
  const parts = useMemo(() => buildPlane().map((p) => ({ ...p, geo: addOutlineNormals(p.geo), m: makeMats(p.color) })), []);
  const rat = useMemo(() => {
    const r = ratParts();
    const all = addOutlineNormals(mergeSimple([r.strut, r.hub, r.gen]));
    const blades = addOutlineNormals(ratBlades());
    return { all, blades, m: makeMats("#9aa3ad", 2.0), mb: makeMats("#d9dde3", 1.6) };
  }, []);
  const ratTop = useMemo(() => { const m = outlineMaterial(C.cyan, 7, 1, true); m.depthTest = false; m.side = THREE.DoubleSide; return m; }, []);
  const hatch = useMemo(() => ({ geo: addOutlineNormals(hatchDoor()), m: makeMats("#c9ced6", 1.6) }), []);
  const hyd = useMemo(() => hydraulicPaths().map((pts) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.1, 8)), []);
  const faces = useMemo(() => [engineFace(ENGINE_X), engineFace(-ENGINE_X)], []);
  const gear = useMemo(() => {
    const strut = (x: number, z: number, h: number) => { const g = new THREE.CylinderGeometry(0.18, 0.18, h, 10); g.translate(x, -2.4 - h / 2, z); return g; };
    const wheels = (x: number, z: number, y: number) => [-0.6, 0.6].flatMap((dz) => [-0.45, 0.45].map((dx) => { const g = new THREE.CylinderGeometry(0.62, 0.62, 0.45, 18); g.rotateZ(Math.PI / 2); g.translate(x + dx, y, z + dz); return g; }));
    const yW = -GEAR_H + 0.62;
    const main = addOutlineNormals(mergeSimple([strut(4.7, 1.8, 2.1), strut(-4.7, 1.8, 2.1), ...wheels(4.7, 1.8, yW), ...wheels(-4.7, 1.8, yW)]));
    return { main, m: makeMats("#4a4f57", 1.6) };
  }, []);

  const hydCol = st.hydCol === "green" ? C.green : st.hydCol === "dim" ? C.red.clone().multiplyScalar(0.55) : C.cyan;
  const hydMat = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), []);
  hydMat.color.copy(hydCol).multiplyScalar(1 + 1.2 * st.hydPulse);
  hyd.forEach((g) => g.setDrawRange(0, Math.floor((g.index ? g.index.count : 0) * st.hydFill / 6) * 6));

  // RAT pose
  const ratRot = -Math.PI / 2 * (1 - st.rat);
  const ratGreen = st.printZ > 5 ? st.ratGlow : 0;
  rat.m.solid.uniforms.uEmissive.value.copy(C.green).multiplyScalar(0.55 * ratGreen);
  rat.mb.solid.uniforms.uEmissive.value.copy(C.green).multiplyScalar(0.7 * ratGreen);
  rat.m.ink.uniforms.uColor.value.copy(ratGreen > 0.5 ? C.green : C.ink);
  rat.m.ink.uniforms.uWidth.value = ratGreen > 0.5 ? 3.0 : 1.7;
  const ratSt = { ...st, xray: st.xray, lines: Math.max(st.lines, st.inner), ghost: 0 };
  ratTop.uniforms.uOpacity.value = 0.55 + 0.45 * Math.sin(st.t * 9);

  // engine glow (blueprint): cyan discs fading when engines die
  const engGlow = st.engines;

  return (
    <group position={st.planePos} rotation={st.planeRot}>
      {parts.map((p) => <LookMesh key={p.name} geo={p.geo} m={p.m} st={st} />)}
      {/* engine fan faces */}
      {faces.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshBasicMaterial color={st.printZ > 1e5 || st.printZ > -3 ? new THREE.Color("#22262e") : C.cyan.clone().multiplyScalar(0.25 + 1.4 * engGlow)} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* landing gear */}
      {st.gear > 0 && <LookMesh geo={gear.main} m={gear.m} st={st} />}
      {/* hatch door: hinge along Z at the inner edge, opens downward/outward */}
      <group position={[RAT_PIVOT.x - 0.42, -3.06, RAT_PIVOT.z - 0.2]} rotation={[0, 0, -1.05 * st.hatch]}>
        <LookMesh geo={hatch.geo} m={hatch.m} st={st} />
      </group>
      {st.hatch > 0.02 && (
        <mesh position={[RAT_PIVOT.x - 0.02, -2.97, RAT_PIVOT.z + 0.95]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.62, 2.2]} /><meshBasicMaterial color="#0d0f13" side={THREE.DoubleSide} />
        </mesh>
      )}
      {/* RAT */}
      <group position={RAT_PIVOT} rotation={[ratRot, 0, 0]}>
        <LookMesh geo={rat.all} m={rat.m} st={ratSt} />
        {st.ghost > 0.5 && <mesh geometry={rat.all} material={ratTop} renderOrder={9} />}
        {st.ghost > 0.5 && <group position={[0, -RAT_STRUT, -0.45]}><mesh geometry={rat.blades} material={ratTop} renderOrder={9} /></group>}
        <group position={[0, -RAT_STRUT, -0.45]} rotation={[0, 0, st.propAng]}>
          <LookMesh geo={rat.blades} m={rat.mb} st={ratSt} />
          {st.propBlur > 0.01 && st.printZ > 5 && (
            <mesh rotation={[0, 0, 0]}>
              <circleGeometry args={[0.72, 40]} />
              <meshBasicMaterial color={C.green} transparent opacity={0.28 * st.propBlur} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
            </mesh>
          )}
        </group>
      </group>
      {/* hydraulic lines (interior) */}
      {st.inner > 0.01 && st.hydFill > 0.001 && hyd.map((g, i) => <mesh key={i} geometry={g} material={hydMat} renderOrder={4} />)}
      {/* red force arrows on the tail */}
      {st.arrows > 0.01 && (
        <>
          <Arrow from={new THREE.Vector3(5.5, 7 * st.arrows + 2.5, 23)} to={new THREE.Vector3(5.5, 2.6, 23)} color={C.red} r={0.32} />
          <Arrow from={new THREE.Vector3(-5.5, 7 * st.arrows + 2.5, 23)} to={new THREE.Vector3(-5.5, 2.6, 23)} color={C.red} r={0.32} />
          <Arrow from={new THREE.Vector3(-6 * st.arrows - 0.8, 7, 25)} to={new THREE.Vector3(-0.6, 7, 25)} color={C.red} r={0.32} />
        </>
      )}
      <Cockpit st={st} />
    </group>
  );
};

// ---------- cockpit interior ----------
const Cockpit: React.FC<{ st: State }> = ({ st }) => {
  const cp = useMemo(() => cockpitParts(), []);
  const yk = useMemo(() => yokeGeo(), []);
  const show = st.shot === 5 || st.shot === 8 || st.shot === 15 || (st.shot >= 18 && st.shot <= 21);
  if (!show) return null;
  const amber = C.amber;
  const sepia = st.sepia > 0.5;
  const pull = st.yokePull;
  const yokeRot = -0.32 * pull;
  return (
    <group>
      <mesh geometry={cp.panel}><meshLambertMaterial color="#4b5361" /></mesh>
      <mesh geometry={cp.glare}><meshLambertMaterial color="#323843" /></mesh>
      {cp.screens.map((g, i) => {
        const on = st.screens - i; // fractional: flicker as it dies
        const k = on >= 1 ? 1 : on <= 0 ? 0 : (Math.sin(st.t * 60 + i) > 0 ? 0.8 : 0.1);
        return (
          <mesh key={i} geometry={g}>
            <meshBasicMaterial color={sepia ? new THREE.Color("#2a2620") : new THREE.Color("#0b1220").lerp(new THREE.Color(i % 2 ? "#3fd0ff" : "#7fe7a7"), 0.85 * k)} toneMapped={false} />
          </mesh>
        );
      })}
      {/* captain's yoke */}
      <group position={YOKE_POS} rotation={[yokeRot, 0, 0]}>
        <mesh geometry={yk}><meshLambertMaterial color="#30353d" /></mesh>
        {st.hands > 0 && [-0.17, 0.17].map((x) => (
          <group key={x} position={[x, 0.02, 0.06]}>
            <mesh><sphereGeometry args={[0.065, 14, 10]} /><meshLambertMaterial color={amber} emissive={amber} emissiveIntensity={0.25} /></mesh>
          </group>
        ))}
        {st.yokeArrows > 0.01 && (
          <>
            <Arrow from={new THREE.Vector3(-0.3, 0.1, -0.8 * st.yokeArrows - 0.05)} to={new THREE.Vector3(-0.3, 0.1, -0.02)} color={C.red} r={0.04} />
            <Arrow from={new THREE.Vector3(0.3, 0.1, -0.8 * st.yokeArrows - 0.05)} to={new THREE.Vector3(0.3, 0.1, -0.02)} color={C.red} r={0.04} />
          </>
        )}
      </group>
      {/* first officer's yoke */}
      <group position={[-YOKE_POS.x, YOKE_POS.y, YOKE_POS.z]}><mesh geometry={yk}><meshLambertMaterial color="#30353d" /></mesh></group>
      {/* captain (shot 20 view from the right seat) */}
      {st.hands > 0 ? <Pilot x={-0.55} z={COCKPIT.z + 0.15} /> : null}
      <ambientLight intensity={0.9} />
      <directionalLight position={[2, 4, 3]} intensity={1.6} />
    </group>
  );
};

const Pilot: React.FC<{ x: number; z: number }> = ({ x, z }) => {
  const a = C.amber;
  const mat = <meshLambertMaterial color={a} emissive={a} emissiveIntensity={0.15} />;
  return (
    <group position={[x, -0.55, z]}>
      <mesh position={[0, 0.55, 0.05]}><boxGeometry args={[0.46, 0.62, 0.28]} />{mat}</mesh>
      <mesh position={[0, 1.02, 0.0]}><sphereGeometry args={[0.15, 18, 14]} />{mat}</mesh>
      <mesh position={[0, 1.13, 0.0]}><cylinderGeometry args={[0.16, 0.17, 0.07, 18]} /><meshLambertMaterial color="#2b2d33" /></mesh>
      <mesh position={[0, 1.13, -0.12]}><boxGeometry args={[0.2, 0.025, 0.12]} /><meshLambertMaterial color="#2b2d33" /></mesh>
      <mesh position={[-0.2, 0.62, -0.25]} rotation={[1.2, 0, 0.1]}><cylinderGeometry args={[0.05, 0.055, 0.5, 10]} />{mat}</mesh>
      <mesh position={[0.2, 0.62, -0.25]} rotation={[1.2, 0, -0.1]}><cylinderGeometry args={[0.05, 0.055, 0.5, 10]} />{mat}</mesh>
      <mesh position={[0, 0.2, -0.1]}><boxGeometry args={[0.5, 0.15, 0.6]} /><meshLambertMaterial color="#3a3f48" /></mesh>
    </group>
  );
};

// ---------- environment ----------
const Clouds: React.FC<{ st: State }> = ({ st }) => {
  const tex = useMemo(() => cloudTexture(), []);
  if (st.bg !== "sky" && st.bg !== "sepia") return null;
  if (st.shot === 5 || st.shot === 8 || st.shot === 15 || st.shot === 16 || st.ground === "runway") return null;
  const items = [];
  for (let i = 0; i < 26; i++) {
    const span = 900;
    const z = (((rnd(i) * span + st.t * 60 * st.speed) % span) + span) % span - span / 2;
    items.push(
      <sprite key={i} position={[(rnd(i + 1) - 0.5) * 420, -40 - rnd(i + 2) * 120, z]} scale={[90 + rnd(i + 3) * 120, 45 + rnd(i + 4) * 50, 1]}>
        <spriteMaterial map={tex} transparent opacity={0.8} depthWrite={false} />
      </sprite>,
    );
  }
  return <>{items}</>;
};

const Ground: React.FC<{ st: State }> = ({ st }) => {
  const farm = useMemo(() => farmTexture(), []);
  const rw = useMemo(() => runwayTexture(), []);
  if (st.ground === "none") return null;
  if (st.ground === "farm") return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1800, 0]}><planeGeometry args={[30000, 30000]} /><meshBasicMaterial map={farm} /></mesh>
  );
  const cars = [];
  for (let i = 0; i < 14; i++) {
    const col = ["#c0392b", "#2c6fbb", "#e5b52a", "#e8e8e8", "#2e8b57"][i % 5];
    cars.push(
      <group key={i} position={[(rnd(i) - 0.5) * 38, 0.5, -520 - i * 28 - rnd(i + 5) * 20]} rotation={[0, rnd(i + 2) * 0.6, 0]}>
        <mesh><boxGeometry args={[1.9, 0.9, 4.3]} /><meshLambertMaterial color={col} /></mesh>
        <mesh position={[0, 0.55, -0.2]}><boxGeometry args={[1.5, 0.5, 2.0]} /><meshLambertMaterial color="#222" /></mesh>
      </group>,
    );
  }
  for (let i = 0; i < 10; i++) {
    cars.push(
      <mesh key={"c" + i} position={[45 + rnd(i + 30) * 30, 1.5, -500 - i * 40]}><boxGeometry args={[2.5, 3, 7]} /><meshLambertMaterial color="#efe6d2" /></mesh>,
    );
  }
  return (
    <group position={[0, st.groundY, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.4, -1500]}><planeGeometry args={[6000, 6000]} /><meshLambertMaterial color="#8b9a5e" /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -900]}><planeGeometry args={[60, 2400]} /><meshLambertMaterial map={rw} /></mesh>
      {cars}
      <hemisphereLight args={["#ffffff", "#776655", 1.2]} />
      <directionalLight position={[300, 500, 200]} intensity={1.6} />
    </group>
  );
};

const Sparks: React.FC<{ st: State }> = ({ st }) => {
  if (st.sparks <= 0.01) return null;
  const pts: number[] = [];
  for (let i = 0; i < 260; i++) {
    const age = (st.t * 3 + rnd(i)) % 1;
    pts.push(st.planePos.x + (rnd(i + 1) - 0.5) * 2.5, 0.2 + age * 2.2 * rnd(i + 2), st.planePos.z - 19 + age * 10 + rnd(i + 3) * 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  return <points geometry={g}><pointsMaterial color="#ffd27a" size={0.35} transparent opacity={st.sparks} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} /></points>;
};

const Rock: React.FC<{ st: State }> = ({ st }) => {
  const geo = useMemo(() => addOutlineNormals(new THREE.IcosahedronGeometry(3.2, 0).toNonIndexed()), []);
  const m = useMemo(() => makeMats("#888", 2.4), []);
  if (st.rock < 0) return null;
  const y = 30 - 140 * easeInQ(st.rock);
  return <group position={[-8, y, -26]} rotation={[st.rock * 4, st.rock * 3, 0]}><LookMesh geo={geo} m={m} st={st} /></group>;
};
const easeInQ = (x: number) => x * x;

const GlidePath: React.FC<{ st: State }> = ({ st }) => {
  if (st.glide < 0) return null;
  const k = st.glide;
  const x0 = 0, z0 = -24, y0 = -1.5;
  const segs: number[] = [];
  const len = 30, drop = 3;
  // slanted glide path (dashed)
  for (let i = 0; i < 20; i++) {
    const a = i / 20, b = (i + 0.6) / 20;
    if (a > k) break;
    const bb = Math.min(b, k);
    segs.push(x0, y0 - drop * a, z0 - len * a, x0, y0 - drop * bb, z0 - len * bb);
  }
  // horizontal leg with 10 ticks (appears by "ten")
  const kh = clamp01((st.t - 9.3) / 1.2);
  for (let i = 0; i <= 10; i++) {
    if (i / 10 > kh) break;
    const z = z0 - len * (i / 10);
    segs.push(x0, y0 - drop - 0.0, z, x0, y0 - drop + 0.8, z);
  }
  if (kh > 0) segs.push(x0, y0 - drop, z0, x0, y0 - drop, z0 - len * kh);
  // vertical leg (1 tick) on "foot down"
  const kv = clamp01((st.t - 11.2) / 0.4);
  if (kv > 0) segs.push(x0 + 0.01, y0, z0 - len, x0 + 0.01, y0 - drop * kv, z0 - len);
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(segs, 3));
  return (
    <>
      {[0, 0.05, -0.05, 0.1, -0.1].map((d, i) => (
        <lineSegments key={i} geometry={g} position={[0, d, 0]}><lineBasicMaterial color={C.cyan} transparent opacity={i === 0 ? 1 : 0.55} toneMapped={false} /></lineSegments>
      ))}
    </>
  );
};
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

// ---------- pinwheel scene (shot 17) ----------
const PinwheelScene: React.FC<{ st: State }> = ({ st }) => {
  const blade = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 0.0, 0.42, 0.0, 0.3, 0.3, 0.1], 3));
    g.computeVertexNormals();
    return g;
  }, []);
  const ang = st.t * 2 + st.pin * st.pin * (st.t - 34.35) * 22;
  const wheel = (a: number, op: number) => (
    <group rotation={[0, 0, a]}>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} geometry={blade} rotation={[0, 0, (i * Math.PI) / 2]}>
          <meshLambertMaterial color={C.green} emissive={C.green} emissiveIntensity={0.35} side={THREE.DoubleSide} transparent opacity={op} />
        </mesh>
      ))}
    </group>
  );
  const blur = st.pin;
  return (
    <group>
      {/* car door with window opening (car faces -Z, door plane at x=0) */}
      <mesh position={[0, 0.55, 0]}><boxGeometry args={[0.12, 1.1, 2.6]} /><meshLambertMaterial color="#b8323a" /></mesh>
      <mesh position={[0, 1.58, -1.2]}><boxGeometry args={[0.1, 0.95, 0.12]} /><meshLambertMaterial color="#1d1f24" /></mesh>
      <mesh position={[0, 1.58, 1.2]}><boxGeometry args={[0.1, 0.95, 0.12]} /><meshLambertMaterial color="#1d1f24" /></mesh>
      <mesh position={[0, 2.08, 0]}><boxGeometry args={[0.12, 0.1, 2.5]} /><meshLambertMaterial color="#b8323a" /></mesh>
      <mesh position={[-0.9, 1.4, 0]}><boxGeometry args={[0.05, 1.4, 2.4]} /><meshLambertMaterial color="#2a2d33" /></mesh>
      {/* arm (amber = a person) */}
      <mesh position={[0.38, 1.31, 0.1]} rotation={[0, 0, -Math.PI / 2 + 0.09]}><cylinderGeometry args={[0.06, 0.07, 1.25, 12]} /><meshLambertMaterial color={C.amber} emissive={C.amber} emissiveIntensity={0.2} /></mesh>
      <mesh position={[0.98, 1.36, 0.1]}><sphereGeometry args={[0.08, 12, 10]} /><meshLambertMaterial color={C.amber} emissive={C.amber} emissiveIntensity={0.2} /></mesh>
      {/* pinwheel on its stick, facing the wind (-Z travel => wind along +Z) */}
      <mesh position={[1.0, 1.62, 0.1]}><cylinderGeometry args={[0.012, 0.012, 0.6, 8]} /><meshLambertMaterial color="#dddddd" /></mesh>
      <group position={[1.0, 1.95, 0.1]} rotation={[0, Math.PI, 0]}>
        {wheel(ang, 1)}
        {blur > 0.05 && wheel(ang - 0.25, 0.45 * blur)}
        {blur > 0.05 && wheel(ang - 0.5, 0.3 * blur)}
        {blur > 0.3 && (
          <mesh><circleGeometry args={[0.45, 32]} /><meshBasicMaterial color={C.green} transparent opacity={0.22 * blur} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} /></mesh>
        )}
      </group>
      {/* road streaks behind */}
      {Array.from({ length: 30 }).map((_, i) => {
        const z = ((rnd(i) * 60 + st.t * 40) % 60) - 30;
        return <mesh key={i} position={[-6 - rnd(i + 1) * 8, -0.5 + rnd(i + 2) * 3, z]}><boxGeometry args={[0.05, 0.05, 3 + 4 * st.pin]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.35} /></mesh>;
      })}
      <hemisphereLight args={["#cfe3ff", "#6b5a4a", 1.3]} />
      <directionalLight position={[4, 6, 3]} intensity={2.0} />
    </group>
  );
};

export const World: React.FC<{ st: State }> = ({ st }) => {
  useCamera(st);
  if (st.scene === "pinwheel") return <PinwheelScene st={st} />;
  return (
    <>
      <Ground st={st} />
      <Clouds st={st} />
      <Plane st={st} />
      <Rock st={st} />
      <Sparks st={st} />
    </>
  );
};
