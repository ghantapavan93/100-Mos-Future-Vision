"use client";

// The founder's week, at night. The country's outline glows faintly on a dark
// ground; each chapter is a tower in its city — height is its member count
// (linear from zero), each lit floor is one event on its calendar, the halo at
// its foot is organizer load (teal steady, gold busy, red overloaded), and a red
// beacon sits on any chapter with a risk. In the open middle stands the money,
// all on one scale: paid is solid gold, signed-but-unpaid is gold drawn in
// outline (coins not yet in hand), promised is clear glass — not money yet.

import { Grid, Line } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { ATLAS_H, ATLAS_W, OUTLINE } from "@/components/circles/usShape";
import { Label } from "@/components/three/Label";
import { LIGHT } from "@/components/three/palette";
import { Composition, SceneCanvas, approach, glowColor, useKickOn, useLiveClock, useMotion, usePortrait } from "@/components/three/SceneCanvas";
import type { StageProps } from "@/components/three/Stage";
import { settle } from "./settle";

export type Load = "steady" | "busy" | "overloaded";

export interface FounderTower {
  id: string;
  city: string;
  members: number;
  /** Events on the chapter's calendar (published, submitted or completed): one lit floor each. */
  events: number;
  load: Load;
  risk: boolean;
  /** Position in atlas SVG units (chapterPoint). */
  at: [number, number];
}

export interface FounderMoney {
  paid: number;
  signedUnpaid: number;
  promised: number;
}

export interface FounderSceneProps {
  towers: FounderTower[];
  money: FounderMoney;
  /** Risks that belong to no chapter (a contract that loses money, screens that disagree with the ledger). */
  otherRisks: number;
}

const P = LIGHT.night;
const SPAN = 13;
const SCALE = SPAN / ATLAS_W;
/** The largest chapter's tower; every other tower is in proportion. */
const TALLEST = 4.4;
const FLOOR = 0.3;
const WIDTH = 0.92;
/** The largest of the three money columns; shorter on phones, where it stands in front of the map. */
const MONEY_TALL = 3.4;
const MONEY_TALL_PORTRAIT = 1.5;

export const LOAD_COLOR: Record<Load, string> = { steady: P.ok, busy: P.gold, overloaded: "#ff6f55" };

/** Atlas SVG units → world x/z, the map nudged a little east of centre. */
const toWorld = ([x, y]: [number, number]): [number, number] => [(x - ATLAS_W / 2) * SCALE + 0.6, (y - ATLAS_H / 2) * SCALE];

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/**
 * The eastern cities stand close together, so their names step apart: Montreal
 * rises into the gap between New York and Charleston, and Detroit and Charleston
 * lean away from each other so they never touch at narrower widths.
 */
const LABEL_SHIFT: Record<string, [number, number]> = { montreal: [0.6, 1.2], detroit: [-0.5, 0], charleston: [0.4, 0] };
/**
 * On a phone the six eastern cities share a thumb's width, so their names fan out into the open sky above and to
 * the right: New York and Montreal rise, Detroit leans west, Charleston and Durham step east.
 */
const LABEL_SHIFT_PHONE: Record<string, [number, number]> = { nyc: [0.3, 1.3], montreal: [1.4, 2.1], detroit: [-1.35, 0], charleston: [1.55, 0], durham: [1.2, -0.6] };

/** Window panes on the four faces of a tower, floor by floor; the bottom `lit` floors glow. */
function useWindows(height: number, lit: number) {
  return useMemo(() => {
    const floors = Math.max(3, Math.floor((height - 0.25) / FLOOR));
    const perFace = 3;
    const on: THREE.Matrix4[] = [];
    const off: THREE.Matrix4[] = [];
    const half = WIDTH / 2 + 0.002;
    const faces: { pos: (u: number) => [number, number]; rot: number }[] = [
      { pos: (u) => [u, half], rot: 0 },
      { pos: (u) => [half, -u], rot: Math.PI / 2 },
      { pos: (u) => [-u, -half], rot: Math.PI },
      { pos: (u) => [-half, u], rot: -Math.PI / 2 },
    ];
    const q = new THREE.Quaternion();
    for (let f = 0; f < floors; f++) {
      const y = 0.22 + f * FLOOR + FLOOR / 2;
      for (const face of faces) {
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), face.rot);
        for (let i = 0; i < perFace; i++) {
          const u = (i - (perFace - 1) / 2) * 0.26;
          const [x, z] = face.pos(u);
          const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1));
          (f < lit ? on : off).push(m);
        }
      }
    }
    return { on, off, floors };
  }, [height, lit]);
}

function Panes({ matrices, material }: { matrices: THREE.Matrix4[]; material: THREE.Material }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const pane = useMemo(() => new THREE.PlaneGeometry(0.16, 0.15), []);
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    matrices.forEach((x, i) => m.setMatrixAt(i, x));
    m.count = matrices.length;
    m.instanceMatrix.needsUpdate = true;
  }, [matrices]);
  if (!matrices.length) return null;
  return <instancedMesh key={matrices.length} ref={mesh} args={[pane, material, matrices.length]} frustumCulled={false} />;
}

function Tower({ t, height, materials }: { t: FounderTower; height: number; materials: { lit: THREE.Material; dark: THREE.Material } }) {
  const { still } = useMotion();
  const live = useLiveClock();
  const portrait = usePortrait();
  const group = useRef<THREE.Group>(null);
  const beacon = useRef<THREE.Mesh>(null);
  const grown = useRef(0);
  const [x, z] = toWorld(t.at);
  const { on, off, floors } = useWindows(height, t.events);
  const h = 0.22 + floors * FLOOR + 0.12;
  const halo = useMemo(() => glowColor(LOAD_COLOR[t.load], t.load === "steady" ? 1.4 : 2), [t.load]);
  const red = useMemo(() => glowColor("#ff5a45", 2.4), []);
  const shift = (portrait ? LABEL_SHIFT_PHONE : LABEL_SHIFT)[t.id] ?? [0, 0];

  useFrame((state, delta) => {
    grown.current = settle(grown.current, 1, delta, still, 1.3);
    // A tower that started growing finishes, however slow the frames are.
    if (grown.current !== 1) state.invalidate();
    if (group.current) group.current.scale.y = Math.max(0.001, grown.current);
    if (beacon.current) {
      // Starts from its resting size the moment the scene goes live, so the hand-over never pops.
      const pulse = still ? 1 : 1 + 0.28 * Math.sin(live(state.clock.elapsedTime) * 3.2);
      beacon.current.scale.setScalar(pulse);
    }
  });

  return (
    <group position={[x, 0, z]}>
      <group ref={group}>
        <mesh position-y={h / 2} castShadow receiveShadow>
          <boxGeometry args={[WIDTH, h, WIDTH]} />
          <meshStandardMaterial color="#2a261f" roughness={0.55} metalness={0.25} />
        </mesh>
        {/* A thin roof lip catches the moon. */}
        <mesh position-y={h + 0.03}>
          <boxGeometry args={[WIDTH + 0.08, 0.06, WIDTH + 0.08]} />
          <meshStandardMaterial color="#4a4235" roughness={0.4} metalness={0.4} />
        </mesh>
        <Panes matrices={on} material={materials.lit} />
        <Panes matrices={off} material={materials.dark} />
      </group>
      <mesh rotation-x={-Math.PI / 2} position-y={0.012}>
        <ringGeometry args={[0.78, 0.9, 64]} />
        <meshBasicMaterial color={halo} toneMapped={false} />
      </mesh>
      {t.risk ? (
        <mesh ref={beacon} position-y={h + 0.36}>
          <sphereGeometry args={[0.13, 20, 16]} />
          <meshBasicMaterial color={red} toneMapped={false} />
        </mesh>
      ) : null}
      {/* Phones show the name alone: the eastern cities sit close, and the legend carries the members. */}
      <Label
        text={t.city}
        detail={portrait ? undefined : `${t.members}`}
        position={[shift[0], h + (t.risk ? 0.95 : 0.7) + shift[1], 0]}
        px={portrait ? 22 : 27}
        background="rgba(30,28,22,0.9)"
        color="#efe7d8"
      />
    </group>
  );
}

function Coins({ height }: { height: number }) {
  // Signed but unpaid: the column drawn as stacked rims, no fill.
  const rings = Math.max(1, Math.round(height / 0.16));
  return (
    <>
      {Array.from({ length: rings }, (_, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position-y={0.03 + (i / Math.max(1, rings - 1)) * Math.max(0, height - 0.06)}>
          <ringGeometry args={[0.4, 0.44, 48]} />
          <meshBasicMaterial color={glowColor(P.gold, 1.5)} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </>
  );
}

function MoneyColumn({ kind, value, tallest, x, z, labelDx = 0 }: { kind: "paid" | "signed" | "promised"; value: number; tallest: number; x: number; z: number; labelDx?: number }) {
  const { still } = useMotion();
  const portrait = usePortrait();
  const body = useRef<THREE.Group>(null);
  const shown = useRef(0);
  const target = (value / Math.max(1, tallest)) * (portrait ? MONEY_TALL_PORTRAIT : MONEY_TALL);
  const gold = useMemo(() => glowColor(P.gold, 1.15), []);
  const glass = useMemo(() => glowColor("#b9b2e6", 1.4), []);
  useFrame((state, delta) => {
    shown.current = settle(shown.current, target, delta, still, 1.2);
    if (shown.current !== target) state.invalidate();
    if (body.current) {
      body.current.scale.y = Math.max(0.0001, shown.current);
      // $0 is nothing: no squashed disc pretending to be a little money.
      body.current.visible = shown.current > 0.01;
    }
  });
  const title = kind === "paid" ? "Money in" : kind === "signed" ? "Signed, owed" : "Promised";
  return (
    <group position={[x, 0, z]}>
      {/* The footprint is always there, so a $0 column still reads as "nothing yet". */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.01}>
        <ringGeometry args={[0.44, 0.5, 48]} />
        <meshBasicMaterial color={kind === "promised" ? "#6d6656" : P.gold} transparent opacity={0.8} />
      </mesh>
      {kind === "paid" ? (
        <group ref={body}>
          <mesh position-y={0.5} castShadow>
            <cylinderGeometry args={[0.44, 0.44, 1, 48]} />
            <meshStandardMaterial color={gold} emissive={P.gold} emissiveIntensity={0.55} roughness={0.25} metalness={0.6} toneMapped={false} />
          </mesh>
        </group>
      ) : kind === "promised" ? (
        <group ref={body}>
          <mesh position-y={0.5}>
            <cylinderGeometry args={[0.44, 0.44, 1, 48, 1, true]} />
            <meshStandardMaterial color="#cfc6ff" emissive="#6a62a8" emissiveIntensity={0.35} transparent opacity={0.24} roughness={0.1} metalness={0.1} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          <mesh position-y={1} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[0.41, 0.46, 48]} />
            <meshBasicMaterial color={glass} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ) : null}
      {kind === "signed" && target > 0.02 ? <Coins height={target} /> : null}
      {/* On a phone the names sit at the columns' feet, one row in front of the map, so none lands on a city. */}
      <Label text={title} detail={usd(value)} position={portrait ? [0, 0.05, 0.95] : [labelDx, Math.max(target, 0) + 0.55, 0]} px={portrait ? 21 : 25} background="rgba(30,28,22,0.9)" color={kind === "promised" ? "#c9c2ea" : "#f6d899"} />
    </group>
  );
}

/** The glow a city throws on the sky, far behind it: unfogged, so it reads as distance. */
function Haze() {
  const texture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 4;
    c.height = 256;
    const g = c.getContext("2d")!;
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, "rgba(243,129,43,0)");
    grad.addColorStop(0.55, "rgba(243,129,43,0.12)");
    grad.addColorStop(1, "rgba(242,181,68,0.34)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 4, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={[2, 3.5, -34]}>
      <planeGeometry args={[140, 14]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} fog={false} />
    </mesh>
  );
}

function Rig() {
  const { camera, size } = useThree();
  const { still, pointer } = useMotion();
  const portrait = usePortrait();
  useFrame((_, delta) => {
    const cam = camera as THREE.PerspectiveCamera;
    const px = still ? 0 : pointer.current.x * 0.8;
    const py = still ? 0 : pointer.current.y * 0.45;
    // Below 1280 the headline runs wider: the camera stands a little further back along the same line of sight.
    const back = size.width < 1280 ? 1.12 : 1;
    // Portrait screens are narrow: further back and a wider lens keep the money and every tower in frame.
    const [wx, wy, wz] = portrait ? [0.2 + px, 22 + py, 27] : [0.9 + (px - 2.5) * back, 1.3 + (9.1 + py) * back, 0.2 + 16.6 * back];
    cam.position.set(approach(cam.position.x, wx, delta, still, 1), approach(cam.position.y, wy, delta, still, 1), approach(cam.position.z, wz, delta, still, 1));
    cam.fov = portrait ? 54 : 36;
    cam.lookAt(portrait ? 0.2 : 0.9, 1.3, 0.2);
    cam.updateProjectionMatrix();
  });
  return null;
}

export default function FounderScene({ towers, money, otherRisks, ...stage }: FounderSceneProps & StageProps) {
  const tallest = Math.max(1, ...towers.map((t) => t.members));
  const moneyTop = Math.max(1, money.paid, money.signedUnpaid, money.promised);
  const outline = useMemo(() => [...OUTLINE, OUTLINE[0]!].map((p) => new THREE.Vector3(toWorld(p)[0], 0.02, toWorld(p)[1])), []);
  const materials = useMemo(
    () => ({
      lit: new THREE.MeshBasicMaterial({ color: glowColor("#ffc46b", 2), toneMapped: false }),
      dark: new THREE.MeshBasicMaterial({ color: "#3a342a" }),
    }),
    [],
  );
  useEffect(
    () => () => {
      materials.lit.dispose();
      materials.dark.dispose();
    },
    [materials],
  );
  const red = useMemo(() => glowColor("#ff5a45", 2.4), []);
  const key = [towers.map((t) => `${t.id}:${t.members}:${t.events}:${t.load}:${t.risk}`).join("|"), money.paid, money.signedUnpaid, money.promised, otherRisks].join("/");

  return (
    <SceneCanvas name="founder" background={P.bg} camera={{ position: [-1.6, 10.4, 16.8], fov: 36, near: 0.1, far: 120 }} glow={1.15} threshold={0.5} vignette={0.5} grain={0.035} shadows {...stage}>
      <KickOn deps={[key]} />
      <Framing />
      <Haze />
      <fog attach="fog" args={[P.bg, 20, 46]} />
      <hemisphereLight args={["#3a3f5c", "#0d0c09", 0.55]} />
      {/* Moonlight from the north-west, the only shadow-casting light. */}
      <directionalLight
        position={[-9, 14, -6]}
        intensity={1.1}
        color="#9aa6d8"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-camera-far={40}
        shadow-bias={-0.0005}
      />
      {/* A warm wash from the city, low and from the south. */}
      <directionalLight position={[4, 3, 10]} intensity={0.55} color={P.key} />
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color="#12110d" roughness={0.95} />
      </mesh>
      <Grid position={[0, 0.004, 0]} args={[60, 60]} cellSize={0.5} cellThickness={0.6} cellColor="#1f1c16" sectionSize={2.5} sectionThickness={1} sectionColor="#2c2820" fadeDistance={34} fadeStrength={1.4} infiniteGrid />
      <Line points={outline} color="#8a6a3e" lineWidth={1.4} transparent opacity={0.75} />

      {towers.map((t) => (
        <Tower key={t.id} t={t} height={(t.members / tallest) * TALLEST} materials={materials} />
      ))}

      <MoneyStand money={money} tallest={moneyTop} otherRisks={otherRisks} red={red} />
      <Rig />
    </SceneCanvas>
  );
}

/**
 * The three money columns. Wide screens stand them in the open middle of the
 * country, clear of Los Angeles in the west and the eastern cities; phones look
 * down from higher, so the columns line up in front of the map, where their
 * labels can't land on a city's.
 */
function MoneyStand({ money, tallest, otherRisks, red }: { money: FounderMoney; tallest: number; otherRisks: number; red: THREE.Color }) {
  const portrait = usePortrait();
  const tall = portrait ? MONEY_TALL_PORTRAIT : MONEY_TALL;
  const at: [number, number, number] = portrait ? [0, 0, 4.5] : [-0.75, 0, 0.9];
  const spots: [number, number][] = portrait
    ? [
        [-4.3, 0],
        [-0.6, 0],
        [3.6, 0],
      ]
    : [
        [-1.5, 0.6],
        [0, 0],
        [1.5, -0.6],
      ];
  return (
    <group position={at}>
      <MoneyColumn kind="paid" value={money.paid} tallest={tallest} x={spots[0]![0]} z={spots[0]![1]} />
      <MoneyColumn kind="signed" value={money.signedUnpaid} tallest={tallest} x={spots[1]![0]} z={spots[1]![1]} />
      {/* On wide screens the tallest column's name steps left, clear of Detroit's just behind it. */}
      <MoneyColumn kind="promised" value={money.promised} tallest={tallest} x={spots[2]![0]} z={spots[2]![1]} labelDx={portrait ? 0 : -1.25} />
      {otherRisks > 0 ? (
        <>
          <mesh position={[0, tall + 1.25, 0]}>
            <sphereGeometry args={[0.14, 20, 16]} />
            <meshBasicMaterial color={red} toneMapped={false} />
          </mesh>
          <Label text={`${otherRisks} to look at`} position={[0, tall + 1.7, 0]} px={23} background="rgba(60,22,16,0.92)" color="#ffd9cf" />
        </>
      ) : null}
    </group>
  );
}

/** Words bottom-left, legend bottom-right: the city floats above and between them — higher and further right below 1280, clear of the headline. */
function Framing() {
  const { size } = useThree();
  const narrow = size.width < 1280;
  return <Composition right={narrow ? 0.16 : 0.13} lift={narrow ? 0.16 : 0.13} up={0.27} />;
}

function KickOn({ deps }: { deps: unknown[] }) {
  useKickOn(deps);
  return null;
}
