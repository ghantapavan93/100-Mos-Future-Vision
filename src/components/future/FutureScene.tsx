"use client";

// Three more summers, at night. Time runs left to right, from today to 2029.
// Two paths of light leave one point and rise as people join: height is
// everyone who joins over the summers, added up — first-timers at group walks,
// plus teammates on company teams. City circles first is teal and solid;
// company teams first is gold and beaded. A soft curtain falls from each path
// to the floor so the rise reads at a glance, and the path open on the phone
// glows brighter. At 2027 both pass through the Year 10 ring: one arc per Year
// 10 goal, mint when it's met, a dim warm amber while it isn't yet. No money in
// the scene — money lives on the phone, second.

import { Grid, Line } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import type { Line2 } from "three/examples/jsm/lines/Line2.js";
import { Label } from "@/components/three/Label";
import { LIGHT } from "@/components/three/palette";
import { Composition, SceneCanvas, approach, glowColor, useKickOn, useMotion, usePortrait } from "@/components/three/SceneCanvas";
import type { StageProps } from "@/components/three/Stage";
import { settle } from "./settle";

export interface FuturePathData {
  id: string;
  short: string;
  /** Everyone who has joined by the end of 2027, 2028 and 2029, added up. */
  people: number[];
  /** The second line of the path's label, e.g. "5,500 joined · 3,200 first-timers". */
  detail: string;
  /** First-timers at group walks over the three summers (the part of `people` that is new to moving together). */
  firstTimers: number;
  /** The path open on the phone: drawn brighter. */
  chosen: boolean;
}

export interface FutureGate {
  id: string;
  short: string;
  pass: boolean | null;
}

export interface FutureSceneProps {
  paths: [FuturePathData, FuturePathData];
  /** The live Year 10 goals, read from the running demo. */
  gates: FutureGate[];
  /** The summer open on the phone. */
  year: 2027 | 2028 | 2029;
}

const P = LIGHT.night;
/** World units per year along x; the three years run from x = -6.9 to 6.9. */
const YEAR_LEN = 4.6;
const X0 = -6.9;
/** The tallest path ends this high. */
const HEIGHT = 4.6;
/** How far apart in depth (z) the two paths end. */
const SPREAD = 1.6;
const HALF_W = 3.75;
const COLORS = ["#7fb7a4", "#f2b544"] as const;
const PASS = "#9fe8c2";
const NOT_YET = "#8a6a44";
const WALL_Z = -3;
const RING = 1.45;

const xOf = (t: number) => X0 + t * YEAR_LEN;
/** Path A comes toward you, path B goes back; both leave from one point. */
const zOf = (t: number, side: number) => side * SPREAD * Math.pow(t / 3, 0.85);

function curveFor(values: number[], side: number, perUnit: number): THREE.CatmullRomCurve3 {
  const pts = [0, ...values].map((v, t) => new THREE.Vector3(xOf(t), v / perUnit, zOf(t, side)));
  return new THREE.CatmullRomCurve3(pts, false, "centripetal");
}

const SAMPLES = 96;
const RADIAL = 10;

function FuturePath({ data, side, index, perUnit, labelAbove, progress }: { data: FuturePathData; side: number; index: number; perUnit: number; labelAbove: boolean; progress: MutableRefObject<number> }) {
  const portrait = usePortrait();
  const color = COLORS[index]!;
  const glow = useMemo(() => glowColor(color, data.chosen ? 2.2 : 1.1), [color, data.chosen]);
  const line = useMemo(() => curveFor(data.people, side, perUnit), [data, side, perUnit]);

  // The curtain: a strip from the path down to its shadow on the floor.
  const curtain = useMemo(() => {
    const top = line.getPoints(SAMPLES);
    const pos: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= SAMPLES; i++) pos.push(top[i]!.x, top[i]!.y, top[i]!.z, top[i]!.x, 0.01, top[i]!.z);
    for (let i = 0; i < SAMPLES; i++) {
      const k = i * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    return g;
  }, [line]);

  const tube = useMemo(() => new THREE.TubeGeometry(line, SAMPLES, data.chosen ? 0.07 : 0.05, RADIAL, false), [line, data.chosen]);
  const floor = useMemo(() => line.getPoints(SAMPLES).map((p) => new THREE.Vector3(p.x, 0.012, p.z)), [line]);
  const beads = useMemo(() => line.getSpacedPoints(Math.round(line.getLength() / 0.3)), [line]);
  const bead = useMemo(() => new THREE.SphereGeometry(data.chosen ? 0.09 : 0.07, 14, 10), [data.chosen]);
  useEffect(
    () => () => {
      curtain.dispose();
      tube.dispose();
      bead.dispose();
    },
    [curtain, tube, bead],
  );

  const beadMesh = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = beadMesh.current;
    if (!m) return;
    const mat = new THREE.Matrix4();
    beads.forEach((p, i) => m.setMatrixAt(i, mat.makeTranslation(p.x, p.y, p.z)));
    m.instanceMatrix.needsUpdate = true;
  }, [beads]);

  const shadow = useRef<Line2>(null);
  useFrame(() => {
    const p = progress.current;
    const k = Math.floor(p * SAMPLES);
    curtain.setDrawRange(0, k * 6);
    tube.setDrawRange(0, k * RADIAL * 6);
    if (shadow.current) shadow.current.geometry.instanceCount = Math.max(1, k);
    if (beadMesh.current) beadMesh.current.count = Math.floor(p * beads.length);
  });

  const end = line.getPoint(1);
  return (
    <group>
      <mesh geometry={curtain} renderOrder={1}>
        <meshBasicMaterial color={color} transparent opacity={data.chosen ? 0.22 : 0.08} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <Line ref={shadow} points={floor} color={color} lineWidth={1} transparent opacity={data.chosen ? 0.55 : 0.3} />
      {index === 0 ? (
        <mesh geometry={tube}>
          <meshBasicMaterial color={glow} toneMapped={false} />
        </mesh>
      ) : (
        <instancedMesh ref={beadMesh} args={[bead, undefined, beads.length]} frustumCulled={false}>
          <meshBasicMaterial color={glow} toneMapped={false} />
        </instancedMesh>
      )}
      {/* Each summer's end: a stem from the floor and a lit point. */}
      {data.people.map((v, i) => (
        <group key={i}>
          <Line
            points={[
              [xOf(i + 1), 0, zOf(i + 1, side)],
              [xOf(i + 1), v / perUnit, zOf(i + 1, side)],
            ]}
            color={color}
            lineWidth={1}
            dashed
            dashSize={0.12}
            gapSize={0.1}
            transparent
            opacity={data.chosen ? 0.6 : 0.35}
          />
          <mesh position={[xOf(i + 1), v / perUnit, zOf(i + 1, side)]}>
            <sphereGeometry args={[data.chosen ? 0.15 : 0.11, 18, 14]} />
            <meshBasicMaterial color={glow} toneMapped={false} />
          </mesh>
        </group>
      ))}
      <Label
        text={data.short}
        // People only: the key beside the scene carries the rest, and a long label runs off the right edge.
        detail={data.detail.split(" · ")[0]}
        position={[end.x + (portrait ? -2.6 : -0.9), Math.max(0.6, end.y + (labelAbove ? 0.8 : -0.8)), end.z]}
        px={portrait ? 18 : 22}
        background="rgba(24,22,17,0.92)"
        color={index === 0 ? "#bfe3d6" : "#f6d899"}
      />
    </group>
  );
}

/** The Year 10 ring: one arc per goal, standing across both paths at the end of 2027. */
function GateRing({ gates, center }: { gates: { pass: boolean | null }[]; center: [number, number, number] }) {
  const portrait = usePortrait();
  const n = Math.max(1, gates.length);
  const gap = 0.12;
  const arc = (Math.PI * 2) / n - gap;
  const colors = useMemo(() => gates.map((g) => (g.pass === true ? glowColor(PASS, 1.5) : new THREE.Color(NOT_YET))), [gates]);
  return (
    <group position={center}>
      {/* Phones look from the front: turn the ring toward the camera so it reads as a ring, not a line. */}
      <group rotation-y={portrait ? Math.PI / 2 - 0.85 : Math.PI / 2}>
        {gates.map((g, i) => (
          <mesh key={i} rotation-z={Math.PI / 2 + gap / 2 + i * (arc + gap)}>
            <torusGeometry args={[RING, 0.075, 10, 64, arc]} />
            <meshBasicMaterial color={colors[i]} toneMapped={g.pass !== true} />
          </mesh>
        ))}
      </group>
      <Label text="Ten summers strong" detail={`${gates.length} Year 10 goals to check`} position={[0, RING + 0.6, 0]} px={portrait ? 18 : 21} background="rgba(24,22,17,0.92)" color="#e9e1d1" />
    </group>
  );
}

function Rig() {
  const { camera, size } = useThree();
  const { still, pointer } = useMotion();
  const portrait = usePortrait();
  // Side by side but narrower than 1440 (laptops, tablets on their side): step back a little, so
  // 2029 stays inside the frame and the paths clear the key in the corner. Wide screens keep some
  // of that step back, so the paths can start clear of the bigger headline.
  const tight = portrait ? 0 : Math.min(1, Math.max(0.35, (1440 - size.width) / 416));
  useFrame((_, delta) => {
    const cam = camera as THREE.PerspectiveCamera;
    const px = still ? 0 : pointer.current.x * 1.2;
    const py = still ? 0 : pointer.current.y * 0.6;
    const [wx, wy, wz] = portrait ? [-1.5 + px, 9.5 + py, 34] : [-11.5 - 2.5 * tight + px, 7.2 + 2.2 * tight + py, 17.5 + 6 * tight];
    cam.position.set(approach(cam.position.x, wx, delta, still, 1), approach(cam.position.y, wy, delta, still, 1), approach(cam.position.z, wz, delta, still, 1));
    // Phones are narrow: a more frontal, wider view keeps 2027 to 2029 in one frame.
    cam.fov = portrait ? 60 : 36;
    cam.lookAt(portrait ? 0.6 : 0.9, 2.2, -0.6);
    cam.updateProjectionMatrix();
  });
  return null;
}

export default function FutureScene({ paths, gates, year, ...stage }: FutureSceneProps & StageProps) {
  return (
    <SceneCanvas name="future" background={P.bg} camera={{ position: [-11.5, 7.2, 17.5], fov: 36, near: 0.1, far: 140 }} glow={1.15} threshold={0.5} vignette={0.5} grain={0.035} {...stage}>
      <Contents paths={paths} gates={gates} year={year} />
    </SceneCanvas>
  );
}

function Contents({ paths, gates, year }: FutureSceneProps) {
  const portrait = usePortrait();
  const { size } = useThree();
  // From 1280 up the headline grows and sits further in: start the paths a little further right,
  // and a little more on very wide screens, where the page column stays centred.
  const wide = portrait ? 0 : Math.min(1, Math.max(0, (size.width - 1280) / 160)) + 0.6 * Math.min(1, Math.max(0, (size.width - 1440) / 480));
  const tallest = useMemo(() => Math.max(1, ...paths.flatMap((p) => p.people)), [paths]);
  const perUnit = tallest / HEIGHT;
  const key = [paths.map((p) => `${p.people.join(",")}:${p.chosen}`).join("|"), gates.map((g) => `${g.id}:${g.pass}`).join(","), year].join("/");
  // The higher path at 2029 labels above its end, the lower one below, so the two never collide.
  const firstAbove = paths[0].people[2]! >= paths[1].people[2]!;
  const labelBg = "rgba(24,22,17,0.92)";
  const px = portrait ? 18 : 21;

  return (
    <>
      <KickOn deps={[key]} />
      {/* Words bottom-left, legend bottom-right: the two paths rise across the open top of the hero. */}
      <Composition right={0.14 + 0.045 * wide} lift={0.06} up={0.3} />
      <fog attach="fog" args={[P.bg, 18, 46]} />

      {/* The ground: a dark glass floor the paths rise from. */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} renderOrder={5}>
        <planeGeometry args={[-X0 * 2 + 1.6, HALF_W * 2]} />
        <meshBasicMaterial color="#2a251c" transparent opacity={0.5} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <Grid position={[0, 0.004, 0]} args={[-X0 * 2 + 1.6, HALF_W * 2]} cellSize={1} cellThickness={0.5} cellColor="#3a342a" sectionSize={YEAR_LEN} sectionThickness={1.2} sectionColor="#6b5a3e" fadeDistance={60} fadeStrength={0.4} />
      <Line
        points={[
          [X0 - 0.8, 0.01, HALF_W],
          [-X0 + 0.8, 0.01, HALF_W],
        ]}
        color={P.gold}
        lineWidth={1.4}
        transparent
        opacity={0.7}
      />

      {/* Each summer's end, on the floor and up the wall; the summer open on the phone glows. */}
      {[1, 2, 3].map((t) => (
        <Line
          key={t}
          points={[
            [xOf(t), 0.02, HALF_W],
            [xOf(t), 0.02, WALL_Z],
            [xOf(t), HEIGHT + 0.6, WALL_Z],
          ]}
          color={P.gold}
          lineWidth={1}
          transparent
          opacity={0.32}
        />
      ))}
      {/* Each summer's name sits on the front edge, under the end of that summer. */}
      {[2027, 2028, 2029].map((y, i) => (
        <Label key={y} text={`${y}`} position={[xOf(i + 1), 0.05, HALF_W + 0.55]} px={portrait ? 20 : 22} background={y === year ? "rgba(243,129,43,0.95)" : labelBg} color={y === year ? "#15140f" : "#e9e1d1"} />
      ))}

      <PathsGroup paths={paths} perUnit={perUnit} firstAbove={firstAbove} />

      <GateRing gates={gates} center={[xOf(1), RING * 0.85, 0]} />

      <mesh position={[X0, 0.02, 0]}>
        <sphereGeometry args={[0.14, 20, 16]} />
        <meshBasicMaterial color={glowColor("#f6f0e4", 1.6)} toneMapped={false} />
      </mesh>
      {/* On wide screens the start sits behind the headline; only phones, with the words below, can read it. */}
      {portrait ? <Label text="Today" detail="Nine summers in" position={[X0 + 1.6, 0.7, 0.4]} px={px} background={labelBg} color="#e9e1d1" /> : null}

      <hemisphereLight args={["#3a3f5c", "#0d0c09", 0.6]} />
      <Rig />
    </>
  );
}

function PathsGroup({ paths, perUnit, firstAbove }: { paths: [FuturePathData, FuturePathData]; perUnit: number; firstAbove: boolean }) {
  const { still } = useMotion();
  const progress = useRef(0);
  useFrame((state, delta) => {
    progress.current = settle(progress.current, 1, delta, still, 2.4);
    // A draw-in that started finishes, however slow the frames are.
    if (progress.current < 1) state.invalidate();
  });
  return (
    <>
      <FuturePath data={paths[0]} side={1} index={0} perUnit={perUnit} labelAbove={firstAbove} progress={progress} />
      <FuturePath data={paths[1]} side={-1} index={1} perUnit={perUnit} labelAbove={!firstAbove} progress={progress} />
    </>
  );
}

function KickOn({ deps }: { deps: unknown[] }) {
  useKickOn(deps);
  return null;
}
