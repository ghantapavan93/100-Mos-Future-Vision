"use client";

// How miles count, at night: seven glass gates in a row, one per check every
// mile goes through (is it real, is it theirs, counted already, allowed, saved,
// on the record, totals updated). The latest things that happened fly through as
// points of light: one that passes clears all seven and lands on the totals; one
// that is refused stops red at the gate that stopped it; an odd walk drops into
// the "checking" tray beside the first gate. In front, the record: one block per
// recent event, linked, the newest glowing. A light on the totals says whether
// every screen still matches what happened.
//
// Everything is read from what really happened; nothing here is staged. A dashed
// path shows the way every walk takes — from "A walk", through the seven gates,
// onto the totals — so the idle scene already says what it is.

import { Grid, Line } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { Label } from "@/components/three/Label";
import { LIGHT } from "@/components/three/palette";
import { AMBIENT_SECONDS, Composition, SceneCanvas, approach, glowColor, useMotion, usePortrait } from "@/components/three/SceneCanvas";
import type { StageProps } from "@/components/three/Stage";
import type { Outcome } from "@/domain/engine";
import { FLIGHTS, OUTCOME_COLOR, type Flight, type XRaySceneProps } from "./flights";

const P = LIGHT.night;
const BLOCKS = 13;
const GAP = 1.75;
const gateX = (i: number) => (i - 3) * GAP;
const START_X = gateX(0) - 2.4;
const WORLD_X = gateX(6) + 1.9;
const ROUTE_X = gateX(0) - 1.5;
const TRAY: [number, number, number] = [gateX(0) + 0.9, 0.12, 1.75];
/** Seconds a receipt takes to fly from the left edge to where it stops. */
const FLY = 2.6;
/** Seconds between receipts that arrive together. */
const STAGGER = 0.26;


const REFUSED = new Set<Outcome>(["rejected", "blocked"]);

/** A steady pseudo-random number in [0,1) for a receipt, so lanes don't jump between renders. */
const lane = (seq: number, salt: number) => {
  const x = Math.sin(seq * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/** Where a receipt comes to rest. */
function restingPlace(f: Flight, landed: number): THREE.Vector3 {
  if (f.outcome === "quarantined") {
    return new THREE.Vector3(TRAY[0] + (lane(f.seq, 3) - 0.5) * 0.7, TRAY[1] + 0.14, TRAY[2] + (lane(f.seq, 4) - 0.5) * 0.45);
  }
  const y = 0.45 + lane(f.seq, 1) * 1.55;
  const z = (lane(f.seq, 2) - 0.5) * 1.25;
  if (REFUSED.has(f.outcome)) return new THREE.Vector3(gateX(f.stop) - 0.42, y, z);
  if (f.stop >= 6) {
    // Landed on the world: a small neat pile on the plinth.
    const k = landed;
    return new THREE.Vector3(WORLD_X - 0.36 + (k % 3) * 0.36, 0.5 + Math.floor(k / 9) * 0.22, -0.36 + (Math.floor(k / 3) % 3) * 0.36);
  }
  return new THREE.Vector3(gateX(f.stop) + 0.55, y, z);
}

/** Position along the flight at t (0..1): along the lane, then down onto the world, the tray or the stop. */
function along(f: Flight, rest: THREE.Vector3, t: number, out: THREE.Vector3): THREE.Vector3 {
  const y = 0.45 + lane(f.seq, 1) * 1.55;
  const z = (lane(f.seq, 2) - 0.5) * 1.25;
  const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  if (f.outcome === "quarantined") {
    // Into Input, then set aside.
    if (t < 0.55) return out.set(THREE.MathUtils.lerp(START_X, gateX(0) + 0.25, ease / 0.55 > 1 ? 1 : t / 0.55), y, z);
    const k = (t - 0.55) / 0.45;
    return out.set(THREE.MathUtils.lerp(gateX(0) + 0.25, rest.x, k), THREE.MathUtils.lerp(y, rest.y, k * k), THREE.MathUtils.lerp(z, rest.z, k));
  }
  const endX = REFUSED.has(f.outcome) || f.stop < 6 ? rest.x : WORLD_X - 0.6;
  if (REFUSED.has(f.outcome) || f.stop < 6) {
    // Slow to a stop in front of the gate that held it.
    const k = 1 - Math.pow(1 - t, 3);
    return out.set(THREE.MathUtils.lerp(START_X, endX, k), THREE.MathUtils.lerp(y, rest.y, k), THREE.MathUtils.lerp(z, rest.z, k));
  }
  if (t < 0.82) return out.set(THREE.MathUtils.lerp(START_X, endX, t / 0.82), y, z);
  const k = (t - 0.82) / 0.18;
  return out.set(THREE.MathUtils.lerp(endX, rest.x, k), THREE.MathUtils.lerp(y, rest.y, k) + Math.sin(k * Math.PI) * 0.25, THREE.MathUtils.lerp(z, rest.z, k));
}

function gateGeometry() {
  const w = 2.15;
  const h = 2.55;
  const r = 0.32;
  const rounded = (shape: THREE.Shape | THREE.Path, x: number, y: number, ww: number, hh: number, rr: number) => {
    shape.moveTo(x + rr, y);
    shape.lineTo(x + ww - rr, y);
    shape.quadraticCurveTo(x + ww, y, x + ww, y + rr);
    shape.lineTo(x + ww, y + hh - rr);
    shape.quadraticCurveTo(x + ww, y + hh, x + ww - rr, y + hh);
    shape.lineTo(x + rr, y + hh);
    shape.quadraticCurveTo(x, y + hh, x, y + hh - rr);
    shape.lineTo(x, y + rr);
    shape.quadraticCurveTo(x, y, x + rr, y);
  };
  const outer = new THREE.Shape();
  rounded(outer, -w / 2, 0, w, h, r);
  const hole = new THREE.Path();
  const t = 0.11;
  rounded(hole, -w / 2 + t, t, w - 2 * t, h - 2 * t, r - t);
  outer.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(outer, { depth: 0.12, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2, curveSegments: 10 });
  g.translate(0, 0, -0.06);
  // The frame faces along x, the direction receipts travel.
  g.rotateY(Math.PI / 2);
  return g;
}

function Gates({ stations, refusedAt, active }: { stations: string[]; refusedAt: Set<number>; active: boolean }) {
  const portrait = usePortrait();
  const frame = useMemo(gateGeometry, []);
  const pane = useMemo(() => {
    const g = new THREE.PlaneGeometry(1.95, 2.35);
    g.rotateY(Math.PI / 2);
    g.translate(0, 1.275, 0);
    return g;
  }, []);
  const lit = useMemo(() => glowColor(P.gold, 1.5), []);
  const hot = useMemo(() => glowColor(P.bad, 1.9), []);
  return (
    <group>
      {stations.map((name, i) => {
        const refused = refusedAt.has(i);
        return (
          <group key={name} position={[gateX(i), 0, 0]}>
            <mesh geometry={frame}>
              <meshStandardMaterial color={refused ? "#6a3426" : "#4a4336"} roughness={0.32} metalness={0.6} />
            </mesh>
            <mesh geometry={pane}>
              <meshPhysicalMaterial color={refused ? P.bad : P.info} transparent opacity={refused ? 0.16 : 0.09} roughness={0.1} metalness={0} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
            {/* The lintel light: gold when the stage has seen traffic, red where the newest refusals stopped. */}
            <mesh position={[0, 2.57, 0]}>
              <boxGeometry args={[0.06, 0.035, 1.5]} />
              <meshBasicMaterial color={refused ? hot : active ? lit : "#5a5244"} toneMapped={false} />
            </mesh>
            {/* Names alternate high and low so neighbours never touch. */}
            <Label text={name} position={[0, 3.05 + (i % 2) * (portrait ? 0.95 : 0.62), 0]} px={portrait ? 14 : 23} background="rgba(30,28,22,0.86)" color={refused ? P.bad : "#e9e1d3"} />
          </group>
        );
      })}
    </group>
  );
}

/** The way every walk goes: from "A walk", through all seven gates, down onto the totals. */
function Route({ idle }: { idle: boolean }) {
  const portrait = usePortrait();
  // Starts a little before the first gate and toward the viewer, so neither the gate's frame nor its glass
  // hides it and its name sits clear of the headline; then it runs straight through all seven.
  const path = useMemo<[number, number, number][]>(() => [[ROUTE_X, 1.25, 1.4], [gateX(0) - 0.7, 1.25, 0], [WORLD_X - 0.75, 1.25, 0], [WORLD_X, 0.55, 0]], []);
  const dash = useMemo(() => glowColor(P.accent, 1.1), []);
  const start = useMemo(() => glowColor(P.gold, 2), []);
  return (
    <group>
      <Line points={path} color={dash} lineWidth={1.6} dashed dashSize={0.2} gapSize={0.16} transparent opacity={0.75} />
      <mesh position={path[0]}>
        <sphereGeometry args={[0.15, 24, 16]} />
        <meshBasicMaterial color={start} toneMapped={false} />
      </mesh>
      <Label
        text="A walk"
        detail={idle && !portrait ? "tap the phone" : undefined}
        position={[ROUTE_X + (portrait ? 1.4 : 0.75), portrait ? 2.25 : 2.15, 1.4]}
        px={portrait ? 15 : 22}
        background="rgba(30,28,22,0.9)"
        color="#f6d899"
      />
    </group>
  );
}

function World({ drift }: { drift: number }) {
  const portrait = usePortrait();
  const beacon = useMemo(() => glowColor(drift ? P.bad : P.ok, 2), [drift]);
  return (
    <group position={[WORLD_X, 0, 0]}>
      <mesh position={[0, 0.17, 0]}>
        <cylinderGeometry args={[0.95, 1.05, 0.34, 64]} />
        <meshStandardMaterial color="#2a251d" roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.345, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.86, 0.92, 64]} />
        <meshBasicMaterial color={glowColor(P.accent, 1.4)} toneMapped={false} />
      </mesh>
      <mesh position={[0.72, 1.2, -0.62]}>
        <sphereGeometry args={[0.12, 24, 16]} />
        <meshBasicMaterial color={beacon} toneMapped={false} />
      </mesh>
      <Label text="Totals" detail={drift ? `${drift} need a fix` : portrait ? undefined : "match everywhere"} position={[0, 2.25, 0]} px={portrait ? 15 : 23} background="rgba(30,28,22,0.86)" color={drift ? P.bad : P.ok} />
    </group>
  );
}

function Tray({ count }: { count: number }) {
  if (!count) return null;
  return (
    <group position={TRAY}>
      <mesh>
        <boxGeometry args={[1.1, 0.12, 0.7]} />
        <meshStandardMaterial color="#2a251d" roughness={0.7} metalness={0.2} />
      </mesh>
      <Label text="Being checked" detail={`${count}`} position={[0, -0.32, 0.55]} px={16} background="rgba(30,28,22,0.86)" color="#f2b544" />
    </group>
  );
}

function Flights({ flights }: { flights: Flight[] }) {
  const { still, kick } = useMotion();
  const { clock } = useThree();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => new THREE.SphereGeometry(0.085, 18, 14), []);
  /** When each receipt started flying (clock seconds); receipts already seen keep their time. */
  const starts = useRef(new Map<number, number>());
  /** Receipts already there when the scene mounts are drawn landed, as the poster shows them. */
  const mounted = useRef(false);
  const rests = useMemo(() => {
    let landed = 0;
    return flights.map((f) => restingPlace(f, !REFUSED.has(f.outcome) && f.outcome !== "quarantined" && f.stop >= 6 ? landed++ : 0));
  }, [flights]);

  // New receipts take off in order, a beat apart; the scene stays awake until the last one lands.
  useEffect(() => {
    const now = clock.elapsedTime;
    let k = 0;
    for (const f of flights) {
      if (starts.current.has(f.seq)) continue;
      starts.current.set(f.seq, mounted.current ? now + 0.2 + STAGGER * k++ : -Infinity);
    }
    mounted.current = true;
    if (k) kick(Math.max(AMBIENT_SECONDS, 0.4 + STAGGER * k + FLY + 0.6));
  }, [flights, clock, kick]);

  const tmp = useMemo(() => new THREE.Vector3(), []);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const colors = useMemo(() => flights.map((f) => glowColor(OUTCOME_COLOR[f.outcome], REFUSED.has(f.outcome) ? 2.1 : f.outcome === "noop" ? 0.8 : 1.9)), [flights]);

  useLayoutEffect(() => {
    const im = mesh.current;
    if (!im) return;
    colors.forEach((c, i) => im.setColorAt(i, c));
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  }, [colors]);

  useFrame((state) => {
    const im = mesh.current;
    if (!im) return;
    flights.forEach((f, i) => {
      const start = starts.current.get(f.seq) ?? 0;
      const t = still ? 1 : THREE.MathUtils.clamp((state.clock.elapsedTime - start) / FLY, 0, 1);
      const p = t <= 0 ? tmp.set(START_X, -10, 0) : along(f, rests[i]!, t, tmp);
      const s = t <= 0 ? 0.0001 : REFUSED.has(f.outcome) && t >= 1 ? 1.25 : 1;
      im.setMatrixAt(i, m.makeScale(s, s, s).setPosition(p));
    });
    im.count = flights.length;
    im.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[geometry, undefined, FLIGHTS]} frustumCulled={false}>
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

function Chain({ flights, firstBreak, total }: { flights: Flight[]; firstBreak: number | null; total: number }) {
  const portrait = usePortrait();
  const blocks = flights.slice(-BLOCKS);
  const span = 0.62;
  const x0 = -((Math.max(1, blocks.length) - 1) * span) / 2 + 0.6;
  const z = 2.55;
  const box = useMemo(() => new RoundedBoxGeometry(0.36, 0.36, 0.36, 3, 0.07), []);
  const link = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.03, 0.03, span - 0.34, 10);
    g.rotateZ(Math.PI / 2);
    return g;
  }, []);
  const blockMesh = useRef<THREE.InstancedMesh>(null);
  const linkMesh = useRef<THREE.InstancedMesh>(null);
  const head = blocks.at(-1);

  useLayoutEffect(() => {
    const bm = blockMesh.current;
    const lm = linkMesh.current;
    if (!bm || !lm) return;
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    blocks.forEach((f, i) => {
      bm.setMatrixAt(i, m.makeTranslation(x0 + i * span, 0.2, z));
      const broken = firstBreak !== null && f.seq >= firstBreak;
      c.set(broken ? P.bad : i === blocks.length - 1 ? P.accent : "#4a4336");
      bm.setColorAt(i, c);
    });
    bm.count = blocks.length;
    bm.instanceMatrix.needsUpdate = true;
    if (bm.instanceColor) bm.instanceColor.needsUpdate = true;
    blocks.slice(1).forEach((f, i) => {
      lm.setMatrixAt(i, m.makeTranslation(x0 + (i + 0.5) * span, 0.2, z));
      c.set(firstBreak !== null && f.seq === firstBreak ? P.bad : "#8a8070");
      lm.setColorAt(i, c);
    });
    lm.count = Math.max(0, blocks.length - 1);
    lm.instanceMatrix.needsUpdate = true;
    if (lm.instanceColor) lm.instanceColor.needsUpdate = true;
  });

  const glow = useMemo(() => glowColor(P.accent, 2), []);
  // Nothing on the record yet: the route's "A walk" label already says what to do.
  if (!blocks.length) return null;
  return (
    <group>
      <instancedMesh ref={blockMesh} args={[box, undefined, BLOCKS]} frustumCulled={false}>
        <meshStandardMaterial roughness={0.45} metalness={0.35} />
      </instancedMesh>
      <instancedMesh ref={linkMesh} args={[link, undefined, BLOCKS]} frustumCulled={false}>
        <meshStandardMaterial roughness={0.4} metalness={0.6} />
      </instancedMesh>
      {head ? (
        <>
          {/* The newest block's glowing seam. */}
          <mesh position={[x0 + (blocks.length - 1) * span, 0.2, z]}>
            <boxGeometry args={[0.39, 0.05, 0.39]} />
            <meshBasicMaterial color={glow} toneMapped={false} />
          </mesh>
          {/* On a phone the record sits at the cropped front-left edge; its name would be cut off, unless it is out of order. */}
          {portrait && firstBreak === null ? null : (
            <Label
              text="The record"
              detail={firstBreak !== null ? "out of order" : `${total} ${total === 1 ? "thing" : "things"}, in order`}
              position={[x0 + (blocks.length - 1) * span, 0.85, z]}
              px={portrait ? 17 : 22}
              background="rgba(30,28,22,0.9)"
              color={firstBreak !== null ? P.bad : "#f6f0e4"}
            />
          )}
        </>
      ) : null}
    </group>
  );
}

/** Side by side but narrower than 1440: how far toward the 1024 framing, 0..1. */
function tightness(width: number, portrait: boolean): number {
  return portrait ? 0 : Math.min(1, Math.max(0, (1440 - width) / 416));
}

/** Narrower screens move the row less to the right, so Totals stays inside the frame. */
function Framing() {
  const { size } = useThree();
  const tight = tightness(size.width, size.width / Math.max(1, size.height) < 0.9);
  return <Composition right={0.21 - 0.07 * tight} lift={0.15} up={0.24} />;
}

function Rig() {
  const { camera, size } = useThree();
  const { still, pointer } = useMotion();
  const portrait = usePortrait();
  const tight = tightness(size.width, portrait);
  const look = useMemo(() => new THREE.Vector3(2.2, 0.9, 0.7), []);
  useFrame((_, delta) => {
    const cam = camera as THREE.PerspectiveCamera;
    const px = still ? 0 : pointer.current.x * 0.8;
    const py = still ? 0 : pointer.current.y * 0.45;
    // Phones look along the row from the front-right corner and further back, so the whole row — all seven
    // gates and the totals — runs corner to corner instead of off both edges.
    const [wx, wy, wz] = portrait ? [19 + px, 13.5 + py, 18] : [11.6 + 1.6 * tight + px, 6 + 0.8 * tight + py, 13 + 2.6 * tight];
    look.set(portrait ? 1.6 : 2.2, 0.9, portrait ? 0.2 : 0.7);
    cam.position.set(approach(cam.position.x, wx, delta, still, 1), approach(cam.position.y, wy, delta, still, 1), approach(cam.position.z, wz, delta, still, 1));
    // A wider lens on phones, so the walk, all seven checks and the Totals platform fit inside the frame.
    cam.fov = portrait ? 60 : 42;
    cam.lookAt(look);
    cam.updateProjectionMatrix();
  });
  return null;
}

export default function XRayScene({ flights, stations, total, firstBreak, drift, ...stage }: XRaySceneProps & StageProps) {
  const shown = flights.slice(-FLIGHTS);
  // Gates where the newest refusals were stopped light red.
  const refusedAt = useMemo(() => new Set(shown.slice(-6).filter((f) => REFUSED.has(f.outcome)).map((f) => f.stop)), [shown]);
  const quarantined = shown.filter((f) => f.outcome === "quarantined").length;
  return (
    <SceneCanvas name="xray" background={P.bg} camera={{ position: [11.6, 6, 13], fov: 38, near: 0.1, far: 120 }} glow={0.9} threshold={0.45} vignette={0.55} grain={0.035} {...stage}>
      <Framing />
      <fog attach="fog" args={[P.bg, 30, 54]} />
      <hemisphereLight args={["#b9b2e6", "#15140f", 0.55]} />
      <directionalLight position={[-6, 9, 6]} intensity={1.4} color={P.key} />
      <directionalLight position={[8, 4, -6]} intensity={0.6} color={P.fill} />
      {/* Rim light from behind the row, so the glass frames read as edges of light against the night. */}
      <directionalLight position={[-4, 6, -10]} intensity={2.2} color="#c9c1f0" />
      <pointLight position={[WORLD_X, 2.2, 0.8]} intensity={6} distance={6} color={P.accent} />
      <Grid
        position={[0, 0.001, 0]}
        infiniteGrid
        cellSize={0.5}
        sectionSize={GAP}
        cellThickness={0.6}
        sectionThickness={1}
        cellColor="#28241d"
        sectionColor="#3d372c"
        fadeDistance={26}
        fadeStrength={1.4}
      />
      <Route idle={total === 0} />
      <Gates stations={stations} refusedAt={refusedAt} active={total > 0} />
      <World drift={drift} />
      <Tray count={quarantined} />
      <Flights flights={shown} />
      <Chain flights={shown} firstBreak={firstBreak} total={total} />
      <Rig />
    </SceneCanvas>
  );
}
