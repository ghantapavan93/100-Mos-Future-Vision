"use client";

// The road to Year 10, from here to the horizon. Up close is what 100 Miles of
// Summer already has — a slab of lit blocks, one per thing in the app today.
// The road winds away past the six Year 10 steps, numbered posts with their
// dates (the one running now lit brightest, with a ring at its foot), to the
// finish gate on the horizon: May 1, 2027. Tap a post, the slab or the gate to
// open it on the phone.
//
// The road recedes rather than running left to right because the hero's words
// and their scrim own the left of the frame; the whole road lives on the right.
// In the dark: a warm road on a dim grid, mint for what's ready, orange for the
// steps, gold for the finish.

import { Grid, Line } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { Label } from "@/components/three/Label";
import { LIGHT } from "@/components/three/palette";
import { Composition, SceneCanvas, approach, glowColor, useKickOn, useLiveClock, useMotion, usePortrait } from "@/components/three/SceneCanvas";
import type { StageProps } from "@/components/three/Stage";

/** One Year 10 step as the road shows it. */
export interface RoadStep {
  id: string;
  n: number;
  title: string;
  /** Its dates, e.g. "Nov 20 → Dec 18". */
  when: string;
}

export interface BuildSceneProps {
  steps: RoadStep[];
  /** How many things are in the app today: one lit block each. */
  ready: number;
  /** The roadmap card open on the phone ("ready", "teams" or a step id), lit on the road. */
  focus: string | null;
  /** A step id, "ready" for the slab, or "teams" for the finish gate. */
  onOpen: (id: string) => void;
}

const P = LIGHT.day;
/** Shared with the phone's list colours in src/blueprint/roadmap.ts. */
export const ROAD_COLOR = { ready: "#5fd3a2", step: "#ff9a4d", now: "#ff6a13", finish: "#ffc14d" } as const;
const LABEL_BG = "rgba(18,16,14,0.92)";

/** The road runs from z = NEAR (today) to z = FAR (May 1). */
const NEAR = 2.4;
const FAR = -13;
/** Where along the road (0 = today, 1 = May 1) each of the six steps stands: further apart as they recede, so they read evenly spaced. */
const POST_T = [0.13, 0.26, 0.4, 0.55, 0.71, 0.87];
const postT = (i: number) => POST_T[i] ?? 0.9;
const POST_H = 1.3;

/** A point on the road: it winds in a gentle S as it recedes, so every post has room for its words. */
function at(t: number): [number, number] {
  return [1.7 * Math.sin(t * Math.PI * 1.25 + 0.4), NEAR + (FAR - NEAR) * t];
}

function Road() {
  const { points, done } = useMemo(() => {
    const pts: [number, number, number][] = [];
    for (let k = 0; k <= 160; k++) {
      const t = -0.04 + (k / 160) * 1.06;
      const [x, z] = at(t);
      pts.push([x, 0.02, z]);
    }
    // The stretch already travelled: from what's ready to the step running now.
    const cut = postT(0);
    return { points: pts, done: pts.filter((_, k) => -0.04 + (k / 160) * 1.06 <= cut) };
  }, []);
  return (
    <>
      <Line points={points} color={ROAD_COLOR.step} lineWidth={9} transparent opacity={0.18} />
      <Line points={points} color={ROAD_COLOR.step} lineWidth={1.4} transparent opacity={0.7} dashed dashSize={0.3} gapSize={0.22} />
      <Line points={done} color={glowColor(ROAD_COLOR.now, 1.8)} lineWidth={3.5} toneMapped={false} />
    </>
  );
}

function ReadySlab({ count, lit, onOpen }: { count: number; lit: boolean; onOpen: () => void }) {
  const portrait = usePortrait();
  const slab = useMemo(() => new RoundedBoxGeometry(2.3, 0.2, 1.7, 4, 0.08), []);
  const block = useMemo(() => new RoundedBoxGeometry(0.3, 0.3, 0.3, 3, 0.07), []);
  const glow = useMemo(() => glowColor(ROAD_COLOR.ready, lit ? 2.3 : 1.4), [lit]);
  const [x, z] = at(0);
  const cols = 5;
  const open = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    onOpen();
  };
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={slab} position={[0, 0.1, 0]} onClick={open}>
        <meshStandardMaterial color="#1e2a25" roughness={0.35} metalness={0.2} />
      </mesh>
      {Array.from({ length: count }, (_, k) => (
        <mesh key={k} geometry={block} position={[((k % cols) - (cols - 1) / 2) * 0.42, 0.37, (Math.floor(k / cols) - 0.5) * 0.5]} onClick={open}>
          <meshBasicMaterial color={glow} toneMapped={false} />
        </mesh>
      ))}
      <Label text="Ready now" detail={`${count} things in your app today`} position={[0, 1.05, 0]} px={portrait ? 19 : 20} background={LABEL_BG} color="#c9f2df" />
    </group>
  );
}

function Post({ step, i, focused, onOpen, grow }: { step: RoadStep; i: number; focused: boolean; onOpen: () => void; grow: MutableRefObject<number> }) {
  const portrait = usePortrait();
  const { size } = useThree();
  // On a tight screen the far posts sit close together: their dates live on the phone, and their names lean apart.
  const crowded = !portrait && tightness(size.width, size.height) > 0.5 && i >= 2;
  const { kick } = useMotion();
  const [hover, setHover] = useState(false);
  const stem = useRef<THREE.Mesh>(null);
  const head = useRef<THREE.Mesh>(null);
  const now = i === 0;
  const [x, z] = at(postT(i));
  const lit = focused || now;
  const headColor = useMemo(() => (lit ? glowColor(now ? ROAD_COLOR.now : ROAD_COLOR.step, focused ? 2.6 : 2.1) : new THREE.Color(ROAD_COLOR.step)), [lit, now, focused]);
  useFrame(() => {
    // Posts rise one after another, nearest first, as the scene arrives.
    const g = THREE.MathUtils.clamp(grow.current * 1.6 - i * 0.12, 0, 1);
    if (stem.current) {
      stem.current.scale.y = Math.max(0.001, g);
      stem.current.position.y = (POST_H * g) / 2;
    }
    if (head.current) {
      head.current.position.y = POST_H * g + 0.2;
      head.current.scale.setScalar((focused ? 1.35 : hover ? 1.2 : 1) * Math.max(0.001, g));
    }
  });
  const handlers = {
    onClick: (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      onOpen();
    },
    onPointerOver: (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      setHover(true);
      document.body.style.cursor = "pointer";
      kick(1.5);
    },
    onPointerOut: () => {
      setHover(false);
      document.body.style.cursor = "";
      kick(1.5);
    },
  };
  return (
    <group position={[x, 0, z]}>
      <mesh ref={stem} {...handlers}>
        <cylinderGeometry args={[0.08, 0.08, POST_H, 12]} />
        <meshStandardMaterial color={lit ? ROAD_COLOR.now : "#7a5236"} roughness={0.4} metalness={0.2} />
      </mesh>
      <mesh ref={head} {...handlers}>
        <sphereGeometry args={[0.24, 24, 18]} />
        <meshBasicMaterial color={headColor} toneMapped={false} />
      </mesh>
      {now ? <NowRing /> : null}
      <Label
        text={`${step.n} · ${step.title}`}
        detail={crowded ? undefined : now ? `Now · ${step.when.replace(/^Now → /, "to ")}` : step.when}
        position={[crowded ? (i % 2 ? -1 : 1) * (0.7 + 0.25 * (i - 2)) : 0, POST_H + 0.68, 0]}
        px={portrait ? 19 : 18}
        background={lit ? "rgba(48,24,8,0.95)" : LABEL_BG}
        color={lit ? "#ffd2b0" : "#f7f2ea"}
      />
    </group>
  );
}

/** A soft ring on the road under the step running now; it breathes while the scene is awake. */
function NowRing() {
  const ring = useRef<THREE.Mesh>(null);
  // The live clock is 0 while still, so the pulse starts from the settled pose (t = 0.5): no jump at the hand-over.
  const live = useLiveClock();
  useFrame(({ clock }) => {
    if (!ring.current) return;
    const t = (Math.sin(live(clock.elapsedTime) * 2.2) + 1) / 2;
    ring.current.scale.setScalar(1 + t * 0.35);
    (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.8 - t * 0.45;
  });
  return (
    <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
      <ringGeometry args={[0.38, 0.5, 48]} />
      <meshBasicMaterial color={glowColor(ROAD_COLOR.now, 1.8)} toneMapped={false} transparent opacity={0.6} />
    </mesh>
  );
}

function FinishGate({ lit, onOpen }: { lit: boolean; onOpen: () => void }) {
  const portrait = usePortrait();
  const [x, z] = at(1);
  const gold = useMemo(() => glowColor(ROAD_COLOR.finish, lit ? 2.6 : 1.8), [lit]);
  const open = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    onOpen();
  };
  return (
    <group position={[x, 0, z]}>
      {[-1.1, 1.1].map((dx) => (
        <mesh key={dx} position={[dx, 1.4, 0]} onClick={open}>
          <boxGeometry args={[0.16, 2.8, 0.16]} />
          <meshBasicMaterial color={gold} toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[0, 2.8, 0]} onClick={open}>
        <boxGeometry args={[2.36, 0.18, 0.18]} />
        <meshBasicMaterial color={gold} toneMapped={false} />
      </mesh>
      <Label text="May 1, 2027" detail="Year 10 starts · company teams too" position={[0, 3.6, 0]} px={portrait ? 19 : 20} background={LABEL_BG} color="#ffe2a3" />
    </group>
  );
}

/**
 * How far a side-by-side screen falls short of 1440×900 (0 there, 1 at about
 * 1024×768). The road is tall: with less room between the header and the key,
 * the lens widens so the whole road, gate and label still fit.
 */
function tightness(width: number, height: number): number {
  return Math.min(1, Math.max(0, (1440 - width) / 416) + Math.max(0, (900 - height) / 300));
}

function Rig() {
  const { camera, size } = useThree();
  const { still, pointer } = useMotion();
  const portrait = usePortrait();
  const tight = tightness(size.width, size.height);
  const look = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, delta) => {
    const cam = camera as THREE.PerspectiveCamera;
    const px = still ? 0 : pointer.current.x * 0.8;
    // Behind today, looking down the road to May 1.
    const [wx, wy, wz] = portrait ? [0.3 + px, 14.5, 23] : [-2.4 + px, 9.6, 15.4];
    cam.position.set(approach(cam.position.x, wx, delta, still, 1), approach(cam.position.y, wy, delta, still, 1), approach(cam.position.z, wz, delta, still, 1));
    look.set(portrait ? 0.1 : 0.5, 0.6, portrait ? -5.4 : -5);
    cam.fov = portrait ? 50 : 41 + 9 * tight;
    cam.lookAt(look);
    cam.updateProjectionMatrix();
  });
  return null;
}

/**
 * The road on the right, its gate clear of the sticky header at the top and
 * "Ready now" clear of the key below; the wider lens (Rig) does the rest on
 * smaller screens.
 */
function Framing() {
  const { size } = useThree();
  const tight = tightness(size.width, size.height);
  return <Composition right={0.21} lift={0.09 + 0.03 * tight} up={0.31} />;
}

/** Drives the posts' rise from 0 to 1 as the scene arrives (instantly when still). */
function Grow({ grow }: { grow: MutableRefObject<number> }) {
  const { still } = useMotion();
  useFrame((_, delta) => {
    grow.current = approach(grow.current, 1.2, delta, still, 0.9);
  });
  return null;
}

export default function BuildScene({ steps, ready, focus, onOpen, ...stage }: BuildSceneProps & StageProps) {
  const grow = useRef(0);
  return (
    <SceneCanvas name="build" background={P.bg} camera={{ position: [-2.4, 9.6, 15.4], fov: 38, near: 0.1, far: 120 }} glow={0.95} threshold={0.55} vignette={0.5} grain={0.03} {...stage}>
      <KickOn deps={[focus, steps.length, ready]} />
      {/* The road on the right; the headline and its scrim keep the left. */}
      <Framing />
      <fog attach="fog" args={[P.bg, 26, 50]} />
      <hemisphereLight args={["#3a2c22", "#0c0b0a", 1.0]} />
      <directionalLight position={[-6, 12, 8]} intensity={2} color="#ffc08a" />
      <directionalLight position={[8, 6, -8]} intensity={1} color={P.fill} />
      <Grid position={[0, 0, -4]} args={[14, 22]} cellSize={1} cellThickness={0.5} cellColor="#2e2924" sectionSize={4} sectionThickness={1} sectionColor="#4a3d2e" fadeDistance={30} fadeStrength={1.4} />
      <Grow grow={grow} />
      <Road />
      <ReadySlab count={ready} lit={focus === "ready"} onOpen={() => onOpen("ready")} />
      {steps.map((s, i) => (
        <Post key={s.id} step={s} i={i} focused={focus === s.id} onOpen={() => onOpen(s.id)} grow={grow} />
      ))}
      <FinishGate lit={focus === "teams"} onOpen={() => onOpen("teams")} />
      <Rig />
    </SceneCanvas>
  );
}

function KickOn({ deps }: { deps: unknown[] }) {
  useKickOn(deps);
  return null;
}
