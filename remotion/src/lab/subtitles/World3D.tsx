// S3 "In-world": extruded paper letters in three.js, lit by a warm key with a real cast shadow.
import React, { useEffect, useMemo, useState } from "react";
import { cancelRender, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import { TTFLoader } from "three/examples/jsm/loaders/TTFLoader.js";
import { Font, FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import type { Chunk } from "./chunker";
import { BAND, BASE_SIZE, EMPH_SCALE, FONTS, FontKey, H, TONE_COLORS, W, fitText } from "./layout";
import { activeChunk, fadeOutFactor, measureWith, placePose, stampPose, useSubtitleFont } from "./Subtitles";

const fontCache = new Map<string, Font>();
function useFont3D(font: FontKey) {
  const [h] = useState(() => delayRender("3d font"));
  const [f, setF] = useState<Font | null>(fontCache.get(font) ?? null);
  useEffect(() => {
    if (fontCache.has(font)) { setF(fontCache.get(font)!); continueRender(h); return; }
    new TTFLoader().load(staticFile(FONTS[font].file), (json: object) => {
      const ff = new FontLoader().parse(json as never);
      fontCache.set(font, ff); setF(ff); continueRender(h);
    }, undefined, (e: unknown) => cancelRender(e));
  }, [font, h]);
  return f;
}

const PAPER = "#F6EFE0", INK = "#0B1A33";
const geoCache = new Map<string, { face: THREE.BufferGeometry; back: THREE.BufferGeometry; w: number }>();
function buildLine(font3d: Font, key: string, text: string, size: number) {
  const k = key + "|" + text + "|" + size;
  const px = size; size = size * 0.72; // TTFLoader glyph scale quirk: size 72 == 1 em
  const hit = geoCache.get(k);
  if (hit) return hit;
  const face = new TextGeometry(text, { font: font3d, size, depth: size * 0.16, curveSegments: 6, bevelEnabled: true, bevelThickness: size * 0.012, bevelSize: size * 0.012, bevelOffset: 0, bevelSegments: 2 });
  const back = new TextGeometry(text, { font: font3d, size, depth: size * 0.05, curveSegments: 6, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.5, bevelOffset: size * 0.075, bevelSegments: 2 });
  face.computeBoundingBox(); back.computeBoundingBox();
  const bb = face.boundingBox!;
  const w = bb.max.x - bb.min.x;
  const dx = -(bb.min.x + w / 2);
  face.translate(dx, 0, 0); back.translate(dx, 0, -size * 0.045);
  const r = { face, back, w };
  geoCache.set(k, r);
  return r;
}

const Scene: React.FC<{ chunk: Chunk; index: number; f: number; dur: number; font: FontKey; font3d: Font; measure: (t: string, px: number) => number; frame: number }> = ({ chunk, index, f, dur, font, font3d, measure, frame }) => {
  const F = FONTS[font];
  const emph = chunk.emphasis;
  const fit = useMemo(() => fitText(chunk.text, measure, BASE_SIZE * F.scale * (emph ? EMPH_SCALE : 1)), [chunk.text, emph, font]);
  const lines = useMemo(() => fit.lines.map((l) => buildLine(font3d, font, l, fit.size)), [fit, font3d]);
  const pose = emph ? stampPose(f, 0) : placePose(f, ((index * 37) % 5 - 2) * 0.22);
  const fo = fadeOutFactor(f, dur, chunk.fadeOut);
  const lh = fit.size * 1.12;
  const cy = H / 2 - BAND.center - (fit.size * 0.72) / 2 + ((lines.length - 1) * lh) / 2;
  const tone = emph ? new THREE.Color(TONE_COLORS[chunk.tone]) : new THREE.Color(PAPER);
  // card lifted toward the camera while it settles (lift 1 -> 0)
  const z = pose.lift * (emph ? 230 : 90);
  const opacity = Math.min(pose.opacity, fo.o);
  const sway = Math.sin(frame / 48) * 0.012;
  return (
    <group rotation={[-0.10, sway, 0]}>
      <group position={[pose.x * 1.0, cy + (-pose.y) * 1 - fo.y, z]} rotation={[0, 0, THREE.MathUtils.degToRad(-pose.rot)]} scale={pose.scale * fo.s}>
        {lines.map((l, i) => (
          <group key={i} position={[0, -i * lh, 0]}>
            <mesh geometry={l.back} castShadow receiveShadow={false}>
              <meshStandardMaterial color={INK} roughness={0.9} transparent opacity={opacity} />
            </mesh>
            <mesh geometry={l.face} castShadow>
              <meshStandardMaterial color={tone} roughness={0.85} metalness={0} emissive={tone} emissiveIntensity={emph ? 0.42 : 0.3} transparent opacity={opacity} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
};

export const SubtitlesWorld: React.FC<{ chunks: Chunk[]; font?: FontKey; only?: number }> = ({ chunks, font = "archivo-black", only }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ready = useSubtitleFont(font);
  const font3d = useFont3D(font);
  const measure = useMemo(() => measureWith(font), [font]);
  const a = activeChunk(chunks, frame, fps);
  const fov = 24;
  const camZ = H / 2 / Math.tan(THREE.MathUtils.degToRad(fov / 2));
  return (
    <ThreeCanvas width={W} height={H} gl={{ alpha: true, antialias: true }} shadows camera={{ fov, position: [0, 0, camZ], near: 10, far: camZ * 3 }} style={{ position: "absolute", inset: 0 }}>
      <ambientLight intensity={1.5} color="#DCE6FF" />
      <directionalLight position={[-300, 380, 900]} intensity={2.6} color="#FFE1B5" castShadow shadow-mapSize={[2048, 2048]} shadow-radius={7} shadow-bias={-0.0004}
        shadow-camera-left={-700} shadow-camera-right={700} shadow-camera-top={700} shadow-camera-bottom={-700} shadow-camera-near={10} shadow-camera-far={2400} />
      {/* shadow catcher: the "card layer" behind the letters */}
      <mesh position={[0, 0, -26]} receiveShadow>
        <planeGeometry args={[W * 2, H * 2]} />
        <shadowMaterial opacity={0.5} />
      </mesh>
      {ready && font3d && a && (only === undefined || a.i === only) && (
        <Scene chunk={chunks[a.i]} index={a.i} f={a.f} dur={a.dur} font={font} font3d={font3d} measure={measure} frame={frame} />
      )}
    </ThreeCanvas>
  );
};
