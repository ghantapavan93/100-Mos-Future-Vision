"use client";

// "Your summer, mile by mile": the member's season goal as one lap of a
// running track. The lane fills in the order the miles were moved, each
// stretch in the colour of where it came from, and its length is the miles
// (linear: a lap is the whole goal). A light marks where the member is now.
// One white tick across the lane is a week at the gentle pace. Strava's own
// copy of a member's runs stays private to them (STRAVA-01/04) — the miles
// count when they arrive from a watch or phone — so it runs as a dashed ghost
// outside the track instead of inside it. Switching person refills the lap.
//
// Lit like a track at night: dark asphalt, a warm key from the front, a cool rim
// from beyond the far bend, the counted lane glowing in its source colours, and
// the total painted big on the infield.

import { ContactShadows, Line } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { ActivitySource } from "@/domain/types";
import { Label } from "@/components/three/Label";
import { LIGHT, SOURCE_COLOR } from "@/components/three/palette";
import { Composition, MAX_DT, SceneCanvas, approach, glowColor, useKickOn, useLiveClock, useMotion, usePortrait } from "@/components/three/SceneCanvas";
import type { StageProps } from "@/components/three/Stage";

export interface SeasonStretch {
  miles: number;
  source: ActivitySource;
}

export interface MemberSceneProps {
  memberId: string;
  name: string;
  /** Counted season miles, in the order they were moved. */
  stretches: SeasonStretch[];
  /** Counted total (the sum of `stretches`, as the engine rounds it). */
  miles: number;
  /** One lap of the track. */
  target: number;
  /** Miles in the private Strava panel: shown outside the track, never in it. */
  stravaMiles: number;
  /** A week at the gentle pace, in miles: one tick per week. */
  weekly: number;
}

const P = LIGHT.day;
/** Half the straight and the bend radius of the lap's centre line. */
const HALF = 3.4;
const R = 2.6;
const STRAIGHT = HALF * 2;
const LAP = 2 * STRAIGHT + 2 * Math.PI * R;
/** The counted lane, either side of the centre line. */
const LANE_IN = -0.42;
const LANE_OUT = 0.42;
const BASE = 0.3;
const FILL_TOP = 0.48;
const STEP = 0.06;
/** Lifts the lane's source colours just past the bloom threshold, so the counted miles glow without changing hue. */
const LANE_GLOW = new THREE.Color(1.35, 1.35, 1.35);
const DISPLAY = "'Inter Variable', 'Inter', system-ui, sans-serif";
/**
 * On phones the whole lap is drawn at this size, so it fits above the headline. Labels size themselves in
 * screen pixels before their parent's scale applies, so those inside the lap are asked for 1 / PHONE_LAP px more.
 */
const PHONE_LAP = 0.58;

/** Point and outward normal at distance `s` along the lap (counter-clockwise from the start line). */
function at(s: number): { x: number; z: number; nx: number; nz: number } {
  let u = ((s % LAP) + LAP) % LAP;
  if (u < STRAIGHT) return { x: -HALF + u, z: R, nx: 0, nz: 1 };
  u -= STRAIGHT;
  if (u < Math.PI * R) {
    const t = u / R;
    return { x: HALF + R * Math.sin(t), z: R * Math.cos(t), nx: Math.sin(t), nz: Math.cos(t) };
  }
  u -= Math.PI * R;
  if (u < STRAIGHT) return { x: HALF - u, z: -R, nx: 0, nz: -1 };
  u -= STRAIGHT;
  const t = u / R;
  return { x: -HALF - R * Math.sin(t), z: -R * Math.cos(t), nx: -Math.sin(t), nz: -Math.cos(t) };
}

/**
 * A raised lane from s0 to s1: top face plus both side walls, as a flat list of
 * triangles ordered along the lap, so a draw range can reveal it front to back.
 * `colorAt` paints each step.
 */
function laneGeometry(s0: number, s1: number, inner: number, outer: number, y0: number, y1: number, colorAt?: (s: number) => THREE.Color) {
  const steps = Math.max(1, Math.ceil((s1 - s0) / STEP));
  const pos: number[] = [];
  const col: number[] = [];
  const white = new THREE.Color("#ffffff");
  const push = (p: number[], c: THREE.Color) => {
    pos.push(...p);
    col.push(c.r, c.g, c.b);
  };
  for (let i = 0; i < steps; i++) {
    const a = s0 + ((s1 - s0) * i) / steps;
    const b = s0 + ((s1 - s0) * (i + 1)) / steps;
    const pa = at(a);
    const pb = at(b);
    const c = colorAt ? colorAt((a + b) / 2) : white;
    const ai = [pa.x + pa.nx * inner, pa.z + pa.nz * inner];
    const ao = [pa.x + pa.nx * outer, pa.z + pa.nz * outer];
    const bi = [pb.x + pb.nx * inner, pb.z + pb.nz * inner];
    const bo = [pb.x + pb.nx * outer, pb.z + pb.nz * outer];
    // Top.
    for (const v of [ai, ao, bo, ai, bo, bi]) push([v[0]!, y1, v[1]!], c);
    // Outer wall, a shade darker.
    const dark = c.clone().multiplyScalar(0.82);
    for (const [v, y] of [
      [ao, y1],
      [bo, y1],
      [bo, y0],
      [ao, y1],
      [bo, y0],
      [ao, y0],
    ] as const)
      push([v[0]!, y, v[1]!], dark);
    // Inner wall.
    for (const [v, y] of [
      [ai, y1],
      [ai, y0],
      [bi, y0],
      [ai, y1],
      [bi, y0],
      [bi, y1],
    ] as const)
      push([v[0]!, y, v[1]!], dark);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return { geometry: g, steps, perStep: 18 };
}

function stadium(offset: number): THREE.Shape {
  const shape = new THREE.Shape();
  const n = 96;
  for (let i = 0; i <= n; i++) {
    const p = at((i / n) * LAP);
    const x = p.x + p.nx * offset;
    const y = -(p.z + p.nz * offset);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  return shape;
}

function Track({ weekly, target }: { weekly: number; target: number }) {
  const base = useMemo(() => laneGeometry(0, LAP, -0.58, 0.58, 0, BASE).geometry, []);
  const infield = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(stadium(-0.62), { depth: 0.18, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  const ticks = useRef<THREE.InstancedMesh>(null);
  const count = weekly > 0 ? Math.floor(target / weekly - 1e-6) : 0;
  useLayoutEffect(() => {
    const mesh = ticks.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let k = 1; k <= count; k++) {
      const p = at(((k * weekly) / target) * LAP);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(p.nx, p.nz));
      m.compose(new THREE.Vector3(p.x, BASE + 0.004, p.z), q, new THREE.Vector3(1, 1, 1));
      mesh.setMatrixAt(k - 1, m);
    }
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
  }, [count, weekly, target]);
  const startLine = at(0);
  return (
    <group>
      <mesh geometry={base}>
        <meshStandardMaterial vertexColors color="#2a2520" roughness={0.62} metalness={0.08} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={infield} position-y={0.0}>
        <meshStandardMaterial color="#14110e" roughness={0.92} />
      </mesh>
      {/* Lane lines on both edges of the counted lane. */}
      {[LANE_IN - 0.02, LANE_OUT + 0.02].map((o) => (
        <Line key={o} points={Array.from({ length: 161 }, (_, i) => at((i / 160) * LAP)).map((p) => [p.x + p.nx * o, BASE + 0.003, p.z + p.nz * o] as [number, number, number])} color="#efe4d2" lineWidth={1.4} transparent opacity={0.7} />
      ))}
      <instancedMesh ref={ticks} args={[undefined, undefined, Math.max(1, Math.ceil(target / Math.max(0.1, weekly)) + 1)]}>
        <boxGeometry args={[0.04, 0.008, 1.0]} />
        <meshBasicMaterial color="#f7f2ea" transparent opacity={0.8} />
      </instancedMesh>
      {/* Start and finish: one line, because the goal is one lap. */}
      <mesh position={[startLine.x, BASE + 0.006, startLine.z]}>
        <boxGeometry args={[0.12, 0.012, 1.16]} />
        <meshBasicMaterial color="#f7f2ea" />
      </mesh>
    </group>
  );
}

function Fill({ memberId, stretches, target, miles, onReveal }: { memberId: string; stretches: SeasonStretch[]; target: number; miles: number; onReveal: (s: number) => void }) {
  const { still } = useMotion();
  const lapMiles = Math.min(miles, target);
  const sEnd = (lapMiles / target) * LAP;
  const built = useMemo(() => {
    // Cumulative boundaries, in lap distance, so each step takes its stretch's colour.
    const bounds: { end: number; color: THREE.Color }[] = [];
    let sum = 0;
    for (const st of stretches) {
      sum += st.miles;
      bounds.push({ end: (Math.min(sum, target) / target) * LAP, color: new THREE.Color(SOURCE_COLOR[st.source]) });
    }
    const colorAt = (s: number) => bounds.find((b) => s <= b.end)?.color ?? new THREE.Color(P.accent);
    return { ...laneGeometry(0, Math.max(STEP, sEnd), LANE_IN, LANE_OUT, BASE - 0.01, FILL_TOP, colorAt), cuts: bounds.slice(0, -1).map((b) => b.end).filter((e) => e < sEnd - 0.01) };
  }, [stretches, target, sEnd]);
  useEffect(() => () => built.geometry.dispose(), [built]);

  // Each person's lap fills from the start line.
  const shown = useRef(0);
  const who = useRef(memberId);
  if (who.current !== memberId) {
    who.current = memberId;
    shown.current = 0;
  }
  const mesh = useRef<THREE.Mesh>(null);
  // A thin cut between outings, so each stretch reads as one walk, roll or run.
  const cuts = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = cuts.current;
    if (!m) return;
    const mat = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    built.cuts.forEach((c, i) => {
      const p = at(c);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(p.nx, p.nz));
      m.setMatrixAt(i, mat.compose(new THREE.Vector3(p.x, FILL_TOP + 0.003, p.z), q, new THREE.Vector3(1, 1, 1)));
    });
    m.instanceMatrix.needsUpdate = true;
  }, [built]);
  useFrame((_, delta) => {
    shown.current = approach(shown.current, sEnd, delta, still, 1.6);
    const steps = sEnd > 0 ? Math.round((shown.current / Math.max(STEP, sEnd)) * built.steps) : 0;
    built.geometry.setDrawRange(0, steps * built.perStep);
    onReveal(shown.current);
    if (mesh.current) mesh.current.visible = steps > 0;
    if (cuts.current) cuts.current.count = built.cuts.filter((c) => c < shown.current).length;
  });
  return (
    <group>
      <mesh ref={mesh} geometry={built.geometry}>
        {/* Unlit, so each stretch keeps its source colour; lifted just past the bloom threshold so the lane glows. */}
        <meshBasicMaterial vertexColors color={LANE_GLOW} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <instancedMesh key={built.cuts.length} ref={cuts} args={[undefined, undefined, Math.max(1, built.cuts.length)]}>
        <boxGeometry args={[0.03, 0.006, 0.84]} />
        <meshBasicMaterial color="#0c0b0a" />
      </instancedMesh>
    </group>
  );
}

/** Where the member is now: a light over the lane. Their name and total are painted on the infield (Readout). */
function Marker({ reveal }: { reveal: { current: number } }) {
  const { still } = useMotion();
  const live = useLiveClock();
  const group = useRef<THREE.Group>(null);
  const orb = useRef<THREE.Mesh>(null);
  const glow = useMemo(() => glowColor(P.accent, 2.4), []);
  useFrame((state) => {
    const p = at(Math.max(0.001, reveal.current));
    if (group.current) group.current.position.set(p.x, 0, p.z);
    if (orb.current) orb.current.position.y = 1.05 + (still ? 0 : Math.sin(live(state.clock.elapsedTime) * 2.2) * 0.06);
  });
  return (
    <group ref={group}>
      <mesh ref={orb} position-y={1.05}>
        <sphereGeometry args={[0.17, 32, 24]} />
        <meshBasicMaterial color={glow} toneMapped={false} />
      </mesh>
      {/* A soft beam from the lane to the light. */}
      <mesh position-y={0.76}>
        <cylinderGeometry args={[0.035, 0.035, 0.56, 12]} />
        <meshBasicMaterial color={P.accent} transparent opacity={0.55} />
      </mesh>
      <pointLight position={[0, 1.1, 0]} color={P.accent} intensity={2.5} distance={3} decay={2} />
    </group>
  );
}

/** The app's distance stamps (10 and 50 miles) as posts beside the lane; lit once reached. */
function Milestones({ miles, target }: { miles: number; target: number }) {
  const portrait = usePortrait();
  const glow = useMemo(() => glowColor(P.gold, 2.2), []);
  return (
    <>
      {[10, 50]
        .filter((m) => m < target)
        .map((m) => {
          const p = at((m / target) * LAP);
          const reached = miles >= m;
          // Wide screens look at the track from its near side, where a raised label would sit right over the lane:
          // there the post is short and the label hangs below the track's edge. Portrait views it end-on, so labels stay raised.
          const near = !portrait && p.nz > 0.5;
          const off = LANE_OUT + (near ? 0.62 : 0.42);
          const post = near ? 0.3 : 0.64;
          return (
            <group key={m} position={[p.x + p.nx * off, BASE, p.z + p.nz * off]}>
              <mesh position-y={post / 2}>
                <cylinderGeometry args={[0.025, 0.025, post, 10]} />
                <meshStandardMaterial color={reached ? P.gold : "#4a443d"} />
              </mesh>
              <mesh position-y={post + 0.04}>
                <sphereGeometry args={[0.075, 20, 14]} />
                <meshBasicMaterial color={reached ? glow : "#5f574d"} toneMapped={!reached} />
              </mesh>
              <Label text={`${m} mi`} position={near ? [0, -0.05, 0.55] : [0, 0.98, 0]} px={portrait ? 17 / PHONE_LAP : 18} background={reached ? "rgba(255,193,77,0.95)" : "rgba(30,27,24,0.9)"} color={reached ? "#0c0b0a" : "#a8a095"} />
            </group>
          );
        })}
    </>
  );
}

function StravaGhost({ miles, target }: { miles: number; target: number }) {
  const portrait = usePortrait();
  const points = useMemo(() => {
    const sEnd = (Math.min(miles, target) / target) * LAP;
    const n = Math.max(2, Math.ceil(sEnd / 0.12));
    return Array.from({ length: n + 1 }, (_, i) => at((sEnd * i) / n)).map((p) => [p.x + p.nx * 1.0, 0.04, p.z + p.nz * 1.0] as [number, number, number]);
  }, [miles, target]);
  const end = points[points.length - 1]!;
  return (
    <group>
      <Line points={points} color={SOURCE_COLOR.strava} lineWidth={2.2} dashed dashSize={0.16} gapSize={0.12} transparent opacity={0.85} />
      <Label text="From Strava" detail={`${miles.toFixed(1)} mi · only you see it`} position={[end[0], 0.45, end[2]]} px={portrait ? 19 / PHONE_LAP : 22} background="rgba(18,16,14,0.88)" color="#a8a095" />
    </group>
  );
}

/**
 * The total, painted on the infield like a stadium number: Inter at its
 * heaviest, the goal beneath it in tracked capitals. Drawn once per value.
 */
function Readout({ name, miles, target, turned }: { name: string; miles: number; target: number; turned: boolean }) {
  const { invalidate } = useThree();
  const [fontsReady, setFontsReady] = useState(() => typeof document !== "undefined" && document.fonts.status === "loaded");
  useEffect(() => {
    if (fontsReady) return;
    let live = true;
    void document.fonts.ready.then(() => live && setFontsReady(true));
    return () => {
      live = false;
    };
  }, [fontsReady]);
  const texture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 512;
    const ctx = c.getContext("2d")!;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#f7f2ea";
    ctx.font = `italic 900 300px ${DISPLAY}`;
    ctx.fillText(miles.toFixed(1), 512, 330);
    ctx.fillStyle = "#ff8a3d";
    ctx.font = `800 58px ${DISPLAY}`;
    ctx.letterSpacing = "14px";
    ctx.fillText(`${name} · OF ${target} MI`.toUpperCase(), 512, 440);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, miles, target, fontsReady]);
  useEffect(() => {
    invalidate();
    return () => texture.dispose();
  }, [texture, invalidate]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, turned ? -Math.PI / 2 : 0]} position={[turned ? 0 : -0.2, 0.19, turned ? 0 : -0.1]}>
      <planeGeometry args={[5.2, 2.6]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} opacity={0.92} />
    </mesh>
  );
}

/** A soft warm glow on the floor beneath the track, drawn once to a small radial texture. */
function LightPool() {
  const texture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, "rgba(255,120,40,0.3)");
    g.addColorStop(0.5, "rgba(255,106,19,0.09)");
    g.addColorStop(1, "rgba(255,106,19,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={0.0}>
      <planeGeometry args={[22, 14]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

function Rig() {
  const { camera, size } = useThree();
  const { still, pointer } = useMotion();
  const portrait = usePortrait();
  const look = useMemo(() => new THREE.Vector3(0, 0, 0.2), []);
  useFrame((_, delta) => {
    const cam = camera as THREE.PerspectiveCamera;
    const px = still ? 0 : pointer.current.x * 0.9;
    const py = still ? 0 : pointer.current.y * 0.5;
    // Between 1024 and 1280 the words take more of the width, so the lap stands back a little.
    const tight = !portrait && size.width < 1280;
    const [wx, wy, wz] = portrait ? [px * 0.5, 17 + py, 13.5] : tight ? [1.8 + px, 16.6 + py, 25] : [1 + px, 12.5 + py, 18.5];
    const dt = Math.min(delta, MAX_DT);
    cam.position.set(approach(cam.position.x, wx, dt, still, 1), approach(cam.position.y, wy, dt, still, 1), approach(cam.position.z, wz, dt, still, 1));
    cam.fov = portrait ? 50 : 34;
    cam.lookAt(look);
    cam.updateProjectionMatrix();
  });
  return null;
}

export default function MemberScene({ memberId, name, stretches, miles, target, stravaMiles, weekly, ...stage }: MemberSceneProps & StageProps) {
  return (
    <SceneCanvas name="member" background={P.bg} camera={{ position: [1, 10.5, 15.5], fov: 34, near: 0.1, far: 120 }} glow={0.95} threshold={0.45} vignette={0.5} grain={0.03} {...stage}>
      <Season memberId={memberId} name={name} stretches={stretches} miles={miles} target={target} stravaMiles={stravaMiles} weekly={weekly} />
    </SceneCanvas>
  );
}

/** Inside the canvas, so it can read the viewport (portrait screens turn the lap to run away from you). */
function Season({ memberId, name, stretches, miles, target, stravaMiles, weekly }: MemberSceneProps) {
  const portrait = usePortrait();
  const reveal = useRef(0);
  return (
    <>
      <KickOn deps={[memberId, miles, target, stravaMiles, stretches.length]} />
      <Framing portrait={portrait} />
      <fog attach="fog" args={[P.bg, 26, 60]} />
      <hemisphereLight args={["#3a2c22", "#0c0b0a", 0.9]} />
      {/* A warm key from the front, like stadium lights behind the camera; a cool rim from beyond the far bend. */}
      <directionalLight position={[-5, 9, 9]} intensity={2.1} color="#ffc08a" />
      <directionalLight position={[7, 4, -9]} intensity={1.1} color={P.fill} />
      {/* On phones the lap is drawn smaller, so all of it sits above the headline instead of running under it. */}
      <group position-y={0.02} rotation-y={portrait ? Math.PI / 2 : 0} scale={portrait ? PHONE_LAP : 1}>
        <Track weekly={weekly} target={target} />
        <Fill memberId={memberId} stretches={stretches} target={target} miles={miles} onReveal={(s) => (reveal.current = s)} />
        <Milestones miles={miles} target={target} />
        {stravaMiles > 0 ? <StravaGhost miles={stravaMiles} target={target} /> : null}
        <Marker reveal={reveal} />
        <Readout name={name} miles={miles} target={target} turned={portrait} />
      </group>
      {/* The floor is the page: unlit, the exact background colour, with a warm pool of light under the track. */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.01}>
        <planeGeometry args={[120, 120]} />
        <meshBasicMaterial color={P.bg} />
      </mesh>
      <LightPool />
      <ContactShadows position={[0, 0.0, 0]} scale={24} blur={2.2} opacity={0.75} far={2.5} frames={1} color="#000000" />
      <Rig />
    </>
  );
}

/** Words left, the lap right; between 1024 and 1280 it sits a little higher and further right, clear of the headline's end. */
function Framing({ portrait }: { portrait: boolean }) {
  const { size } = useThree();
  const tight = !portrait && size.width < 1280;
  return <Composition right={tight ? 0.21 : 0.19} lift={tight ? 0.16 : 0.12} up={portrait ? 0.35 : 0.25} />;
}

function KickOn({ deps }: { deps: unknown[] }) {
  useKickOn(deps);
  return null;
}
