"use client";

// The impact pool as a glass vessel. Only money partners have actually paid is
// liquid: what is still available glows orange in the vessel, and what has
// been paid out sits green in each program's own tube. Everything that is not
// money yet — signed but unpaid, promised by contracts that lose money,
// promised in unsigned deals — is drawn above the liquid as hollow, dashed
// bands, never as liquid. One dollar scale for the vessel and every tube,
// linear from $0. Each program's six stages are beads in front of its tube
// (done, current, not yet), and once it is funded, ten slots around its base
// fill with the people checked in by name — verification needs all ten.
//
// Dark stage (Afterglow): paid money is the only thing that glows from
// within; the glass is drawn by its lit rims and reflections; promises are
// faint dashed light; the floor is a measuring grid under a warm pool of light.

import { Environment, Lightformer, Line, RoundedBox } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { usd } from "@/domain/finance";
import { IMPACT_STAGES, type ImpactStage } from "@/domain/types";
import { EmberFloor } from "@/components/partner/EmberFloor";
import { ease, useSettle } from "@/components/partner/ease";
import { Label } from "@/components/three/Label";
import { LIGHT } from "@/components/three/palette";
import { Composition, MAX_DT, SceneCanvas, glowColor, useKickOn, useMotion, usePortrait } from "@/components/three/SceneCanvas";
import type { StageProps } from "@/components/three/Stage";
import { POOL_COLOR } from "./poolColors";

export interface PoolNumbers {
  available: number;
  disbursed: number;
  awaitingPayment: number;
  unfunded: number;
  pipeline: number;
}

export interface ProgramColumn {
  id: string;
  name: string;
  cost: number;
  funded: number;
  stage: ImpactStage;
  /** People checked in by name at this program's evidence events. */
  checkIns: number;
  focus: boolean;
}

export interface ImpactSceneProps {
  pool: PoolNumbers;
  programs: ProgramColumn[];
}

const P = LIGHT.golden;
/** Quiet text and lines on the dark stage. */
const MUTED = "#bba791";
const RULE = "#7e6852";
/** Plinths and the deck: dark, lit at the edges. */
const DECK = "#1a120b";
/** Horizontal field of view on phones, in degrees: the whole picture fits the width at any hero height. */
const PHONE_HFOV = 27.5;
/** The tallest stack (vessel contents or a program's cost) is this many units high. */
const SPAN = 4.4;
const VESSEL_X = -3.4;
const VESSEL_R = 1.3;
const TUBE_R = 0.54;
const TUBE_GAP = 2.05;
const TUBE_X0 = -0.4;
/** Named check-ins verification needs (IMPACT-EVIDENCE). */
const NEEDED = 10;

/** Where a program is, in the same plain words as the Giving app. */
const STAGE_WORD: Record<ImpactStage, string> = {
  proposed: "open for votes",
  "community-review": "members reviewing",
  approved: "approved",
  funded: "funded",
  delivered: "happened",
  verified: "done",
};

const circle = (r: number, y = 0, n = 64): [number, number, number][] => Array.from({ length: n + 1 }, (_, i) => [Math.cos((i / n) * Math.PI * 2) * r, y, Math.sin((i / n) * Math.PI * 2) * r]);

/** A level that eases to its data, and keeps the scene drawing until it gets there. */
function useLevel(target: number, smooth = 0.8) {
  const { still } = useMotion();
  const settle = useSettle();
  const now = useRef(0);
  return (delta: number) => {
    now.current = ease(now.current, target, delta, still, smooth);
    settle(now.current, target);
    return now.current;
  };
}

/** Liquid: a solid column with a glowing surface. Only paid money is ever drawn this way. */
function Liquid({ radius, height, color, glow }: { radius: number; height: number; color: string; glow: number }) {
  const body = useRef<THREE.Mesh>(null);
  const top = useRef<THREE.Mesh>(null);
  const level = useLevel(height);
  const surface = useMemo(() => glowColor(color, glow), [color, glow]);
  useFrame((_, delta) => {
    const h = level(delta);
    const visible = h > 0.004;
    if (body.current) {
      body.current.visible = visible;
      body.current.scale.y = Math.max(0.001, h);
      body.current.position.y = h / 2;
    }
    if (top.current) {
      top.current.visible = visible;
      top.current.position.y = h + 0.003;
    }
  });
  return (
    <group>
      <mesh ref={body} castShadow>
        <cylinderGeometry args={[radius, radius, 1, 56, 1, true]} />
        <meshStandardMaterial color={color} roughness={0.18} emissive={color} emissiveIntensity={0.55} transparent opacity={0.92} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={top} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[radius, 56]} />
        <meshBasicMaterial color={surface} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Glass: the vessel and the tubes. */
function Glass({ radius, height, rim = 1.5 }: { radius: number; height: number; rim?: number }) {
  // On a dark stage clear glass shows only where light catches it: its reflections and its rims.
  const lip = useMemo(() => glowColor("#ffb067", rim), [rim]);
  const foot = useMemo(() => circle(radius, 0.004), [radius]);
  return (
    <group>
      <mesh position-y={height / 2}>
        <cylinderGeometry args={[radius, radius, height, 64, 1, true]} />
        <meshStandardMaterial color="#ffe2c4" roughness={0.06} metalness={0.1} envMapIntensity={2.2} transparent opacity={0.13} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position-y={height} rotation-x={Math.PI / 2}>
        <torusGeometry args={[radius, 0.03, 12, 64]} />
        <meshBasicMaterial color={lip} toneMapped={false} />
      </mesh>
      <Line points={foot} color="#ffb067" lineWidth={1.2} transparent opacity={0.45} />
    </group>
  );
}

interface Band {
  key: "awaiting" | "unfunded" | "pipeline";
  label: string;
  amount: number;
}

/** Promises drawn as what they are: hollow, dashed, above the money. */
function Ghosts({ bands, k, base, radius }: { bands: Band[]; k: number; base: number; radius: number }) {
  const portrait = usePortrait();
  let y = base;
  return (
    <group>
      {bands.map((b) => {
        const h = b.amount * k;
        const y0 = y;
        y += h;
        const color = POOL_COLOR[b.key];
        return (
          <group key={b.key}>
            <mesh position-y={y0 + h / 2}>
              <cylinderGeometry args={[radius - 0.08, radius - 0.08, Math.max(0.001, h), 48, 1, true]} />
              <meshBasicMaterial color={color} transparent opacity={0.06} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
            </mesh>
            <Line points={circle(radius - 0.08, y0 + h)} color={glowColor(color, 1.25)} lineWidth={1.6} dashed dashSize={b.key === "awaiting" ? 0.05 : 0.16} gapSize={0.1} toneMapped={false} />
            {/* Named inside the glass, at the band's middle: the vessel is the one place nothing else is labelled. */}
            <Label text={b.label} detail={usd(b.amount)} position={[0, y0 + h / 2, 0]} px={portrait ? 13 : 17} />
          </group>
        );
      })}
    </group>
  );
}

function Vessel({ pool, k, height }: { pool: PoolNumbers; k: number; height: number }) {
  const portrait = usePortrait();
  const bands: Band[] = [
    { key: "awaiting" as const, label: "signed, not paid yet", amount: pool.awaitingPayment },
    { key: "unfunded" as const, label: "promised, not paid yet", amount: pool.unfunded },
    { key: "pipeline" as const, label: "promised, not signed yet", amount: pool.pipeline },
  ].filter((b) => b.amount > 0);
  const liquid = Math.max(0, pool.available) * k;
  return (
    <group position={[VESSEL_X, 0.12, 0]}>
      <mesh position-y={-0.06} receiveShadow castShadow>
        <cylinderGeometry args={[VESSEL_R + 0.18, VESSEL_R + 0.24, 0.12, 64]} />
        <meshStandardMaterial color={DECK} roughness={0.45} metalness={0.3} />
      </mesh>
      <Line points={circle(VESSEL_R + 0.2, 0.002)} color={glowColor(P.accent, 1.6)} lineWidth={1.6} toneMapped={false} />
      <Liquid radius={VESSEL_R - 0.07} height={liquid} color={POOL_COLOR.available} glow={2.4} />
      <Ghosts bands={bands} k={k} base={liquid} radius={VESSEL_R} />
      <Glass radius={VESSEL_R} height={height} />
      <Label
        text={pool.available > 0 ? "Ready to give" : "Giving fund"}
        // Phones keep just the name: the long note would run off the left edge.
        detail={pool.available > 0 ? usd(pool.available) : portrait ? undefined : "fills when a sponsor pays"}
        position={[0, height + 0.55, 0]}
        px={portrait ? 18 : 23}
        background={pool.available > 0 ? "rgba(255,106,19,0.95)" : undefined}
        color={pool.available > 0 ? "#110b07" : undefined}
      />
    </group>
  );
}

/** A flow from the vessel to a program: solid and moving when money went there, a faint dashed line when not. */
function Pipe({ to, paid }: { to: number; paid: boolean }) {
  const { still } = useMotion();
  const ref = useRef<{ material: { dashOffset: number } } | null>(null);
  const points = useMemo(() => {
    const from = new THREE.Vector3(VESSEL_X + VESSEL_R * 0.7, 0.05, 0.95);
    const end = new THREE.Vector3(to, 0.05, 0.95);
    const mid = new THREE.Vector3((from.x + end.x) / 2, 0.05, 1.45);
    return new THREE.QuadraticBezierCurve3(from, mid, end).getPoints(40).map((p) => [p.x, p.y, p.z] as [number, number, number]);
  }, [to]);
  const glow = useMemo(() => glowColor(POOL_COLOR.disbursed, 2.4), []);
  useFrame((_, delta) => {
    if (!still && paid && ref.current) ref.current.material.dashOffset -= Math.min(delta, MAX_DT) * 0.8;
  });
  return paid ? (
    <Line ref={ref as never} points={points} color={glow} lineWidth={3.2} dashed dashSize={0.22} gapSize={0.1} toneMapped={false} />
  ) : (
    <Line points={points} color={RULE} lineWidth={1.2} dashed dashSize={0.08} gapSize={0.1} transparent opacity={0.85} />
  );
}

/** The six stages as beads on an arc in front of the tube. */
function StageBeads({ stage }: { stage: ImpactStage }) {
  const idx = IMPACT_STAGES.indexOf(stage);
  const hot = useMemo(() => glowColor(P.accent, 2.4), []);
  return (
    <group>
      {IMPACT_STAGES.map((s, i) => {
        const a = Math.PI * (0.18 + (0.64 * i) / (IMPACT_STAGES.length - 1));
        const x = -Math.cos(a) * (TUBE_R + 0.42);
        const z = Math.sin(a) * (TUBE_R + 0.42);
        const done = i < idx;
        const now = i === idx;
        return now ? (
          <mesh key={s} position={[x, 0.11, z]}>
            <sphereGeometry args={[0.085, 20, 14]} />
            <meshBasicMaterial color={hot} toneMapped={false} />
          </mesh>
        ) : done ? (
          <mesh key={s} position={[x, 0.11, z]} castShadow>
            <sphereGeometry args={[0.075, 20, 14]} />
            <meshStandardMaterial color={P.ok} emissive={P.ok} emissiveIntensity={0.45} roughness={0.4} />
          </mesh>
        ) : (
          <mesh key={s} position={[x, 0.05, z]} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[0.05, 0.075, 24]} />
            <meshBasicMaterial color={RULE} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Ten places around the tube; each person checked in by name fills one. */
function CheckInSlots({ count }: { count: number }) {
  const filled = Math.min(NEEDED, count);
  const slot = useMemo(() => new THREE.SphereGeometry(0.07, 16, 12), []);
  const ring = useMemo(() => {
    const g = new THREE.RingGeometry(0.045, 0.07, 20);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  return (
    <group>
      {Array.from({ length: NEEDED }, (_, i) => {
        // Behind and beside the tube, so the stage beads in front stay clear.
        const a = Math.PI * (1.05 + (0.9 * i) / (NEEDED - 1));
        const pos: [number, number, number] = [Math.cos(a) * (TUBE_R + 0.38), 0.09, Math.sin(a) * (TUBE_R + 0.38)];
        return i < filled ? (
          <mesh key={i} geometry={slot} position={pos} castShadow>
            <meshStandardMaterial color={P.gold} emissive={P.gold} emissiveIntensity={0.9} roughness={0.4} />
          </mesh>
        ) : (
          <mesh key={i} geometry={ring} position={[pos[0], 0.02, pos[2]]}>
            <meshBasicMaterial color={RULE} transparent opacity={0.9} />
          </mesh>
        );
      })}
    </group>
  );
}

function Tube({ p, x, k, row, labelAt }: { p: ProgramColumn; x: number; k: number; row: number; labelAt: number }) {
  const portrait = usePortrait();
  const h = Math.max(0.35, p.cost * k);
  const idx = IMPACT_STAGES.indexOf(p.stage);
  const funded = idx >= IMPACT_STAGES.indexOf("funded");
  const short = p.name.split(" ").slice(-2).join(" ");
  return (
    <group position={[x, 0.08, 0]}>
      <mesh position-y={-0.04} receiveShadow castShadow>
        <cylinderGeometry args={[TUBE_R + 0.14, TUBE_R + 0.18, 0.08, 48]} />
        <meshStandardMaterial color={DECK} roughness={0.45} metalness={0.3} />
      </mesh>
      {p.focus ? <Line points={circle(TUBE_R + 0.16, 0.002)} color={glowColor(P.accent, 1.6)} lineWidth={1.4} toneMapped={false} /> : null}
      <Liquid radius={TUBE_R - 0.05} height={p.funded * k} color={POOL_COLOR.disbursed} glow={2.2} />
      <Glass radius={TUBE_R} height={h} rim={p.focus ? 1.6 : 1.15} />
      {/* The cost line: where the tube is full. */}
      <Line points={circle(TUBE_R + 0.02, h)} color={MUTED} lineWidth={1} transparent opacity={0.6} />
      <StageBeads stage={p.stage} />
      {funded ? <CheckInSlots count={p.checkIns} /> : null}
      <Label
        text={short}
        // On a phone the tubes stand close together, so each shows its name only; the phone below says the rest.
        detail={portrait ? undefined : `${STAGE_WORD[p.stage]} · ${usd(p.cost)}`}
        // All program names share a line above the tallest tube; neighbours alternate rows so they never overlap.
        position={[0, labelAt + row * (portrait ? 0.8 : 0.62), 0]}
        px={portrait ? 14 : 18}
        background={p.focus ? "rgba(255,106,19,0.95)" : undefined}
        color={p.focus ? "#110b07" : undefined}
      />
    </group>
  );
}

function Rig() {
  const { camera, size } = useThree();
  const { still, pointer } = useMotion();
  const settle = useSettle();
  const portrait = usePortrait();
  // Phones hold the horizontal field of view, so a taller hero (the empty state has more words) never crops the sides.
  // Set during render (idempotent) as well as each frame: labels size themselves from the camera's fov when they render,
  // and this Rig renders before them.
  const fov = portrait ? THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(PHONE_HFOV / 2)) / (size.width / Math.max(1, size.height)))) : 34;
  const lens = camera as THREE.PerspectiveCamera;
  if (lens.fov !== fov) {
    lens.fov = fov;
    lens.updateProjectionMatrix();
  }
  const look = useMemo(() => new THREE.Vector3(), []);
  // The first frame is composed, not travelled to (a phone would otherwise glide in from the desktop shot).
  const placed = useRef(false);
  useFrame((_, delta) => {
    const cam = camera as THREE.PerspectiveCamera;
    const first = !placed.current;
    placed.current = true;
    const px = still ? 0 : pointer.current.x * 0.9;
    const py = still ? 0 : pointer.current.y * 0.45;
    const [wx, wy, wz] = portrait ? [0.4 + px, 8.6 + py, 28] : [0.6 + px, 7.2 + py, 21];
    const snap = still || first;
    cam.position.set(ease(cam.position.x, wx, delta, snap, 1), ease(cam.position.y, wy, delta, snap, 1), ease(cam.position.z, wz, delta, snap, 1));
    settle(cam.position.x, wx);
    settle(cam.position.z, wz);
    look.set(portrait ? 0.4 : 0.2, portrait ? 2.1 : 2.0, 0.3);
    cam.fov = fov;
    cam.lookAt(look);
    cam.updateProjectionMatrix();
  });
  return null;
}

export default function ImpactScene({ pool, programs, ...stage }: ImpactSceneProps & StageProps) {
  // One scale: whichever is taller, everything stacked in the vessel or the costliest program.
  const stacked = Math.max(0, pool.available) + pool.awaitingPayment + pool.unfunded + pool.pipeline;
  const k = SPAN / Math.max(1, stacked, ...programs.map((p) => p.cost));
  const vesselHeight = Math.max(stacked * k, 1.2) + 0.45;
  const xs = programs.map((_, i) => TUBE_X0 + i * TUBE_GAP);
  const labelAt = Math.max(0.35, ...programs.map((p) => p.cost * k)) + 0.55;
  return (
    <SceneCanvas name="impact" background={P.bg} camera={{ position: [0.6, 7.2, 21], fov: 34, near: 0.1, far: 140 }} glow={0.85} threshold={0.45} vignette={0.5} grain={0.03} shadows {...stage}>
      <KickOn deps={[pool.available, pool.disbursed, pool.awaitingPayment, pool.unfunded, pool.pipeline, programs.map((p) => `${p.id}:${p.stage}:${p.funded}:${p.checkIns}:${p.focus}`).join("|")]} />
      <Rig />
      {/* Words bottom-left and the legend bottom-right: the pool floats above, right of centre. */}
      <Composition right={0.2} lift={0.17} up={0.29} />
      <fog attach="fog" args={[P.bg, 30, 64]} />
      {/* Reflections only: tall warm and cool softboxes so the glass shows its edges; offline, no HDR. */}
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={2.2} color="#ffb067" position={[-6, 4, 5]} scale={[2.5, 10, 1]} />
        <Lightformer form="rect" intensity={0.9} color="#6f7fb8" position={[7, 4, 4]} scale={[2, 9, 1]} />
        <Lightformer form="ring" intensity={0.9} color="#ffc27a" position={[0, 8, 0]} scale={4} />
      </Environment>
      <hemisphereLight args={["#5a3720", "#050302", 0.7]} />
      <directionalLight position={[7, 5, 11]} intensity={0.5} color={P.fill} />
      <directionalLight
        position={[-10, 9, 7]}
        intensity={2.3}
        color={P.key}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={8}
        shadow-camera-bottom={-6}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      <EmberFloor y={-0.2} center={[(VESSEL_X + xs[xs.length - 1]!) / 2, 0.4]} radius={11} />
      <RoundedBox args={[xs[xs.length - 1]! - VESSEL_X + 3.6, 0.18, 4.2]} radius={0.06} smoothness={3} position={[(VESSEL_X + xs[xs.length - 1]!) / 2, -0.09, 0.35]} receiveShadow>
        <meshStandardMaterial color={DECK} roughness={0.5} metalness={0.2} />
      </RoundedBox>
      {/* The deck's front edge burns orange: the stage's footlight. */}
      <Line
        points={[
          [VESSEL_X - 1.8, 0.004, 2.45],
          [xs[xs.length - 1]! + 1.8, 0.004, 2.45],
        ]}
        color={glowColor(P.accent, 1.9)}
        lineWidth={2}
        toneMapped={false}
      />
      <Vessel pool={pool} k={k} height={vesselHeight} />
      {programs.map((p, i) => (
        <Pipe key={`pipe-${p.id}`} to={xs[i]!} paid={p.funded > 0} />
      ))}
      {programs.map((p, i) => (
        <Tube key={p.id} p={p} x={xs[i]!} k={k} row={i % 2} labelAt={labelAt} />
      ))}
    </SceneCanvas>
  );
}

function KickOn({ deps }: { deps: unknown[] }) {
  useKickOn(deps);
  return null;
}
