"use client";

// City Circles after sundown: the country as a dark stone slab under the last
// low western light, its dot grid lit like towns from the air, each circle a column whose height is its member count (linear
// from zero, so heights compare honestly), quiet arcs from Chicago where the
// challenge began in 2018, and one bead per upcoming walk around each column.
// Tapping a column picks that circle, same as the list beside it.

import { QuadraticBezierLine } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Line2 } from "three/examples/jsm/lines/Line2.js";
import { Label } from "@/components/three/Label";
import { LIGHT } from "@/components/three/palette";
import { Composition, MAX_DT, SceneCanvas, approach, glowColor, useKickOn, useMotion, usePortrait } from "@/components/three/SceneCanvas";
import type { StageProps } from "@/components/three/Stage";
import { ATLAS_H, ATLAS_W, DOTS, OUTLINE } from "./usShape";

export interface CircleColumn {
  id: string;
  city: string;
  members: number;
  upcoming: number;
  /** Position in atlas SVG units (chapterPoint). */
  at: [number, number];
}

export interface CirclesSceneProps {
  circles: CircleColumn[];
  selected: string;
  began: string;
  onSelect: (id: string) => void;
}

const P = LIGHT.golden;
/** The slab spans this many world units east to west. */
const SPAN = 20;
const SCALE = SPAN / ATLAS_W;
const SLAB = 0.7;
/** The largest circle's column height; every other column is in proportion. */
const TALLEST = 3;
/**
 * Where each name sits beside its column, in world units [east, up]. Chicago and
 * Detroit stand close together, and so do Charleston and Durham, and Montreal
 * sits just above New York, so each pair's names lean apart instead of stacking.
 */
const NUDGE: Record<string, [number, number]> = {
  chicago: [-0.75, 0],
  dallas: [0.8, -0.1],
  atlanta: [-0.95, -0.62],
  durham: [0.3, 0.1],
  nyc: [0.45, -0.15],
  montreal: [-1.2, 0.5],
};
/** On a phone the whole country is narrow, so the north-east pair needs a wider gap. */
const NUDGE_PHONE: Record<string, [number, number]> = { ...NUDGE, nyc: [1.3, -0.6], montreal: [-2.4, 1.1], la: [1.1, 0] };

/** Atlas SVG units → world x/z on the slab's top face. */
const toWorld = ([x, y]: [number, number]): [number, number] => [(x - ATLAS_W / 2) * SCALE, (y - ATLAS_H / 2) * SCALE];

function Slab() {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape(OUTLINE.map((p) => new THREE.Vector2(toWorld(p)[0], -toWorld(p)[1])));
    const g = new THREE.ExtrudeGeometry(shape, { depth: SLAB, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 3, steps: 1 });
    g.rotateX(-Math.PI / 2);
    g.translate(0, -SLAB, 0);
    return g;
  }, []);
  const dot = useMemo(() => {
    const g = new THREE.CircleGeometry(0.05, 10);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  const dots = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = dots.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    DOTS.forEach((p, i) => {
      const [x, z] = toWorld(p);
      mesh.setMatrixAt(i, m.makeTranslation(x, 0.09, z));
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <group>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial color="#2a1e16" roughness={0.7} metalness={0.15} />
      </mesh>
      {/* The flat atlas's dot grid, lit like towns seen from the air. */}
      <instancedMesh ref={dots} args={[dot, undefined, DOTS.length]}>
        <meshBasicMaterial color="#8a5a2e" toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

function Column({ c, height, selected, began, onSelect }: { c: CircleColumn; height: number; selected: boolean; began: boolean; onSelect: (id: string) => void }) {
  const { still, kick } = useMotion();
  const portrait = usePortrait();
  const [hover, setHover] = useState(false);
  const body = useRef<THREE.Mesh>(null);
  const cap = useRef<THREE.Mesh>(null);
  const label = useRef<THREE.Group>(null);
  const grown = useRef(0);
  const [x, z] = toWorld(c.at);
  const capGlow = useMemo(() => glowColor(P.accent, 2.2), []);
  const capQuiet = useMemo(() => glowColor(P.gold, 1.1), []);
  const bodyGlow = useMemo(() => glowColor(P.accent, 0.55), []);
  const top = 0.09;
  const [nudgeX, nudgeY] = (portrait ? NUDGE_PHONE : NUDGE)[c.id] ?? [0, 0];

  useFrame((_, delta) => {
    grown.current = approach(grown.current, height, delta, still, 1.1);
    const h = Math.max(0.001, grown.current);
    if (body.current) {
      body.current.scale.y = h;
      body.current.position.y = top + h / 2;
    }
    if (cap.current) cap.current.position.y = top + h + 0.005;
    if (label.current) label.current.position.set(nudgeX, top + h + 0.62 + nudgeY, 0);
  });

  const beads = useMemo(() => Array.from({ length: c.upcoming }, (_, i) => (i / Math.max(1, c.upcoming)) * Math.PI * 2 + 0.4), [c.upcoming]);

  return (
    <group position={[x, 0, z]}>
      <mesh
        ref={body}
        castShadow
        onClick={(e) => {
          e.stopPropagation();
          onSelect(c.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
          document.body.style.cursor = "pointer";
          kick(1.5);
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = "";
          kick(1.5);
        }}
      >
        <cylinderGeometry args={[0.3, 0.35, 1, 48]} />
        <meshStandardMaterial
          color={selected ? P.accent : hover ? "#a2552a" : "#6e3a1c"}
          emissive={selected ? bodyGlow : hover ? "#3a1a08" : "#1c0d04"}
          roughness={0.35}
          metalness={0.25}
        />
      </mesh>
      {/* The lit cap blooms only on the chosen circle. */}
      <mesh ref={cap} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.3, 48]} />
        <meshBasicMaterial color={selected ? capGlow : capQuiet} toneMapped={false} />
      </mesh>
      {beads.map((a, i) => (
        <mesh key={i} position={[Math.cos(a) * 0.62, top + 0.08, Math.sin(a) * 0.62]} castShadow>
          <sphereGeometry args={[0.08, 18, 14]} />
          <meshBasicMaterial color={capQuiet} toneMapped={false} />
        </mesh>
      ))}
      {began ? (
        <mesh rotation-x={-Math.PI / 2} position-y={top + 0.01}>
          <ringGeometry args={[0.98, 1.05, 72]} />
          <meshBasicMaterial color={capGlow} toneMapped={false} transparent opacity={0.9} />
        </mesh>
      ) : null}
      <group ref={label}>
        <Label text={c.city} position={[0, 0, 0]} px={(selected ? 30 : 26) * (portrait ? 0.72 : 1)} background={selected ? "rgba(255,106,19,0.95)" : "rgba(18,12,8,0.86)"} color={selected ? "#110b07" : P.ink} />
      </group>
      {began && !portrait ? (
        <Label text="began here, 2018" position={[0, top + 0.05, 1.45]} px={22} background="rgba(18,12,8,0.8)" color="#ff9a4d" />
      ) : null}
    </group>
  );
}

function Arcs({ circles, began }: { circles: CircleColumn[]; began: string }) {
  const { still } = useMotion();
  const from = circles.find((c) => c.id === began);
  const refs = useRef<(Line2 | null)[]>([]);
  useFrame((_, delta) => {
    if (still) return;
    for (const l of refs.current) if (l) (l.material as unknown as { dashOffset: number }).dashOffset -= Math.min(delta, MAX_DT) * 0.5;
  });
  if (!from) return null;
  const [fx, fz] = toWorld(from.at);
  return (
    <>
      {circles
        .filter((c) => c.id !== began)
        .map((c, i) => {
          const [tx, tz] = toWorld(c.at);
          const d = Math.hypot(tx - fx, tz - fz);
          return (
            <QuadraticBezierLine
              key={c.id}
              ref={(l) => {
                refs.current[i] = l as unknown as Line2 | null;
              }}
              start={[fx, 0.12, fz]}
              end={[tx, 0.12, tz]}
              mid={[(fx + tx) / 2, 0.8 + d * 0.3, (fz + tz) / 2]}
              color={P.accent}
              lineWidth={2}
              dashed
              dashSize={0.26}
              gapSize={0.18}
            />
          );
        })}
    </>
  );
}

/** Horizontal field of view on phones: the country spans the width however tall the hero runs. */
const PHONE_HFOV = 29.5;

function Rig({ focus }: { focus: [number, number] }) {
  const { camera, size } = useThree();
  const { still, pointer } = useMotion();
  const portrait = usePortrait();
  const look = useRef(new THREE.Vector3(0, 0, 0.5));
  const fov = portrait ? THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(PHONE_HFOV / 2)) / (size.width / Math.max(1, size.height)))) : 36;
  useFrame((_, delta) => {
    const cam = camera as THREE.PerspectiveCamera;
    // Lean a little toward the chosen circle without losing the country.
    look.current.x = approach(look.current.x, focus[0] * 0.3, delta, still, 1.2);
    look.current.z = approach(look.current.z, 0.6 + focus[1] * 0.25, delta, still, 1.2);
    const px = still ? 0 : pointer.current.x * 1.1;
    const py = still ? 0 : pointer.current.y * 0.6;
    // Portrait screens are narrow: a lens held to a fixed width, from higher up, keeps both coasts in frame.
    // Narrower desktops stand back a little, so the country fits above the headline instead of under it.
    const back = size.width < 1280 ? 1.2 : 1;
    const [wx, wy, wz] = portrait ? [look.current.x * 0.4 + px, 31 + py, look.current.z + 26] : [look.current.x + 4 * back + px, 21 * back + py, look.current.z + 15.5 * back];
    cam.position.set(approach(cam.position.x, wx, delta, still, 1), approach(cam.position.y, wy, delta, still, 1), approach(cam.position.z, wz, delta, still, 1));
    cam.fov = fov;
    cam.lookAt(look.current);
    cam.updateProjectionMatrix();
  });
  return null;
}

/**
 * The country floats right of centre. Narrower desktops see it from further back
 * (see Rig), so it can sit higher and further right, clear of the headline.
 */
function Framing() {
  const { size } = useThree();
  const narrow = size.width >= 1024 && size.width < 1280;
  return <Composition right={narrow ? 0.15 : 0.17} lift={narrow ? 0.21 : 0.17} up={0.27} />;
}

export default function CirclesScene({ circles, selected, began, onSelect, ...stage }: CirclesSceneProps & StageProps) {
  const tallest = Math.max(1, ...circles.map((c) => c.members));
  const chosen = circles.find((c) => c.id === selected) ?? circles[0];
  const focus = chosen ? toWorld(chosen.at) : ([0, 0] as [number, number]);
  return (
    <SceneCanvas name="circles" background={P.bg} camera={{ position: [-2, 15.5, 18], fov: 36, near: 0.1, far: 140 }} glow={1} threshold={0.45} vignette={0.5} grain={0.03} shadows {...stage}>
      <KickOn deps={[selected, circles.map((c) => `${c.id}:${c.members}:${c.upcoming}`).join("|")]} />
      {/* The words sit bottom-left and the list bottom-right, so the country floats above, a little right of centre. */}
      <Framing />
      <fog attach="fog" args={[P.bg, 30, 64]} />
      <hemisphereLight args={["#ffd9b0", "#1a0f08", 0.55]} />
      {/* A low sun in the west: long shadows east of every column. */}
      <directionalLight
        position={[-18, 9, 4]}
        intensity={2.6}
        color={P.key}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-camera-near={1}
        shadow-camera-far={50}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      {/* A cool rim from the east, so the slab's far edge separates from the dark. */}
      <directionalLight position={[14, 6, -10]} intensity={0.7} color={P.fill} />
      <mesh rotation-x={-Math.PI / 2} position-y={-SLAB - 0.05} receiveShadow>
        <planeGeometry args={[160, 160]} />
        <meshStandardMaterial color="#140d08" roughness={0.9} metalness={0.1} />
      </mesh>
      <Slab />
      <Arcs circles={circles} began={began} />
      {circles.map((c) => (
        <Column key={c.id} c={c} height={(c.members / tallest) * TALLEST} selected={c.id === selected} began={c.id === began} onSelect={onSelect} />
      ))}
      <Rig focus={focus} />
    </SceneCanvas>
  );
}

function KickOn({ deps }: { deps: unknown[] }) {
  useKickOn(deps);
  return null;
}
