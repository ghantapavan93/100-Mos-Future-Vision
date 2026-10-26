"use client";

// One commission on the map: the country as a dark slab at dusk, Kayla's seven
// cities as quiet lights, and the cities a buyer asked for lit as rings joined
// by the program's thread. Each promised walk is a disc stacked on its city:
// dim until it happens, gold when it's held, ember when it's cancelled. A city
// with a gap pulses red until someone decides; a partner crew adds a second
// ring; a dropped city goes hollow. A heat forecast glows over the walk it
// threatens. Every one of these is also in the text beside the scene.

import { QuadraticBezierLine } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Line2 } from "three/examples/jsm/lines/Line2.js";
import { ATLAS_H, ATLAS_W, DOTS, OUTLINE } from "@/components/circles/usShape";
import { Label } from "@/components/three/Label";
import { LIGHT } from "@/components/three/palette";
import { Composition, MAX_DT, SceneCanvas, approach, glowColor, useKickOn, useLiveClock, useMotion, usePortrait } from "@/components/three/SceneCanvas";
import type { StageProps } from "@/components/three/Stage";

export type CityRole = "quiet" | "asked" | "ready" | "gap" | "crew" | "dropped";
export type WalkMark = "pending" | "held" | "cancelled";

export interface SceneCity {
  id: string;
  city: string;
  /** Atlas SVG units (chapterPoint). */
  at: [number, number];
  role: CityRole;
  walks: WalkMark[];
  heat: boolean;
}

export interface CommissionSceneProps {
  cities: SceneCity[];
}

const P = LIGHT.golden;
const SPAN = 20;
const SCALE = SPAN / ATLAS_W;
const SLAB = 0.7;
const TOP = 0.09;
const DISC = 0.16;
const toWorld = ([x, y]: [number, number]): [number, number] => [(x - ATLAS_W / 2) * SCALE, (y - ATLAS_H / 2) * SCALE];

/** Names lean apart where cities sit close (Chicago–Detroit, Charleston–Durham, New York–Montreal). */
const NUDGE: Record<string, [number, number]> = { chicago: [-0.8, 0], detroit: [0.85, -0.1], charleston: [-1, -0.6], durham: [0.35, 0.1], nyc: [0.5, -0.15], montreal: [-1.2, 0.5] };
const NUDGE_PHONE: Record<string, [number, number]> = { ...NUDGE, chicago: [-1.5, 0.35], detroit: [1.7, -0.35], nyc: [1.3, -0.6], montreal: [-2.4, 1.1], la: [1.1, 0] };

const RING: Record<CityRole, string> = { quiet: P.muted, asked: P.gold, ready: P.ok, gap: P.bad, crew: P.info, dropped: P.muted };

function Slab() {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape(OUTLINE.map((p) => new THREE.Vector2(toWorld(p)[0], -toWorld(p)[1])));
    const g = new THREE.ExtrudeGeometry(shape, { depth: SLAB, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 3, steps: 1 });
    g.rotateX(-Math.PI / 2);
    g.translate(0, -SLAB, 0);
    return g;
  }, []);
  const dot = useMemo(() => {
    const g = new THREE.CircleGeometry(0.045, 8);
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
      mesh.setMatrixAt(i, m.makeTranslation(x, TOP, z));
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <group>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial color="#251a12" roughness={0.75} metalness={0.12} />
      </mesh>
      <instancedMesh ref={dots} args={[dot, undefined, DOTS.length]}>
        <meshBasicMaterial color="#6a4526" toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

function Walks({ walks }: { walks: WalkMark[] }) {
  const { still } = useMotion();
  const held = useMemo(() => glowColor(P.gold, 2), []);
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const grown = useRef<number[]>([]);
  useFrame((_, delta) => {
    walks.forEach((_, i) => {
      const mesh = refs.current[i];
      if (!mesh) return;
      grown.current[i] = approach(grown.current[i] ?? 0, 1, delta, still, 0.5 + i * 0.08);
      const s = grown.current[i]!;
      mesh.scale.set(s, s, s);
      mesh.position.y = TOP + DISC / 2 + i * (DISC + 0.05) * s;
    });
  });
  return (
    <>
      {walks.map((w, i) => (
        <mesh
          key={i}
          ref={(m) => {
            refs.current[i] = m;
          }}
          castShadow
        >
          <cylinderGeometry args={[0.34, 0.34, DISC, 40]} />
          {w === "held" ? (
            <meshBasicMaterial color={held} toneMapped={false} />
          ) : w === "cancelled" ? (
            <meshStandardMaterial color="#5a1f12" emissive="#3a0e06" roughness={0.6} />
          ) : (
            <meshStandardMaterial color="#6a4a2c" emissive="#24140a" roughness={0.45} transparent opacity={0.9} />
          )}
        </mesh>
      ))}
    </>
  );
}

function Pulse({ color, radius, speed = 1.6 }: { color: string; radius: number; speed?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const live = useLiveClock();
  // Pulses while the scene is awake (after a change or under the pointer), then rests, like every scene.
  const { still } = useMotion();
  const tint = useMemo(() => glowColor(color, 2.2), [color]);
  useFrame((state) => {
    const t = live(state.clock.elapsedTime);
    const k = still ? 0.5 : (t * speed) % 1;
    if (ref.current) {
      ref.current.scale.setScalar(1 + k * 0.9);
      (ref.current.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - k);
    }
  });
  return (
    <mesh ref={ref} rotation-x={-Math.PI / 2} position-y={TOP + 0.02}>
      <ringGeometry args={[radius, radius + 0.07, 64]} />
      <meshBasicMaterial color={tint} toneMapped={false} transparent opacity={0.85} />
    </mesh>
  );
}

function City({ c }: { c: SceneCity }) {
  const portrait = usePortrait();
  const [x, z] = toWorld(c.at);
  const [nx, ny] = (portrait ? NUDGE_PHONE : NUDGE)[c.id] ?? [0, 0];
  const lit = c.role !== "quiet";
  const ring = useMemo(() => (c.role === "dropped" || c.role === "quiet" ? new THREE.Color(RING[c.role]) : glowColor(RING[c.role], 1.8)), [c.role]);
  const height = c.walks.length * (DISC + 0.05);
  return (
    <group position={[x, 0, z]}>
      <mesh rotation-x={-Math.PI / 2} position-y={TOP + 0.01}>
        <circleGeometry args={[lit ? 0.12 : 0.09, 24]} />
        <meshBasicMaterial color={lit ? glowColor(P.gold, 1.4) : P.muted} toneMapped={false} />
      </mesh>
      {lit ? (
        <mesh rotation-x={-Math.PI / 2} position-y={TOP + 0.015}>
          <ringGeometry args={[0.52, c.role === "dropped" ? 0.56 : 0.6, 64]} />
          <meshBasicMaterial color={ring} toneMapped={false} transparent opacity={c.role === "dropped" ? 0.55 : 1} />
        </mesh>
      ) : null}
      {c.role === "crew" ? (
        <mesh rotation-x={-Math.PI / 2} position-y={TOP + 0.015}>
          <ringGeometry args={[0.72, 0.77, 64]} />
          <meshBasicMaterial color={glowColor(P.info, 1.6)} toneMapped={false} />
        </mesh>
      ) : null}
      {c.role === "gap" ? <Pulse color={P.bad} radius={0.62} /> : null}
      {c.heat ? <Pulse color={P.accent} radius={0.85} speed={0.9} /> : null}
      {c.role !== "dropped" && c.role !== "quiet" ? <Walks walks={c.walks} /> : null}
      <group position={[nx, TOP + Math.max(0.5, height + 0.45) + ny, 0]}>
        <Label
          text={c.city}
          detail={lit && c.walks.length ? `${c.walks.filter((w) => w === "held").length}/${c.walks.length}` : undefined}
          position={[0, 0, 0]}
          px={(lit ? 28 : 21) * (portrait ? 0.72 : 1)}
          background={lit ? "rgba(18,12,8,0.9)" : "rgba(18,12,8,0.6)"}
          color={lit ? P.ink : P.muted}
        />
      </group>
    </group>
  );
}

/** The program's thread: one arc between each pair of cities in the order the buyer asked. */
function Thread({ cities }: { cities: SceneCity[] }) {
  const { still } = useMotion();
  const refs = useRef<(Line2 | null)[]>([]);
  useFrame((_, delta) => {
    if (still) return;
    for (const l of refs.current) if (l) (l.material as unknown as { dashOffset: number }).dashOffset -= Math.min(delta, MAX_DT) * 0.45;
  });
  const on = cities.filter((c) => c.role !== "quiet" && c.role !== "dropped");
  const pairs = on.map((c, i) => [c, on[(i + 1) % on.length]!] as const).slice(0, on.length > 2 ? on.length : on.length - 1);
  return (
    <>
      {pairs.map(([a, b], i) => {
        const [ax, az] = toWorld(a.at);
        const [bx, bz] = toWorld(b.at);
        const d = Math.hypot(bx - ax, bz - az);
        return (
          <QuadraticBezierLine
            key={`${a.id}-${b.id}`}
            ref={(l) => {
              refs.current[i] = l as unknown as Line2 | null;
            }}
            start={[ax, TOP + 0.04, az]}
            end={[bx, TOP + 0.04, bz]}
            mid={[(ax + bx) / 2, 0.7 + d * 0.28, (az + bz) / 2]}
            color={P.accent}
            lineWidth={2}
            dashed
            dashSize={0.24}
            gapSize={0.16}
          />
        );
      })}
    </>
  );
}

const PHONE_HFOV = 29.5;

function Rig() {
  const { camera, size } = useThree();
  const { still, pointer } = useMotion();
  const portrait = usePortrait();
  const fov = portrait ? THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(PHONE_HFOV / 2)) / (size.width / Math.max(1, size.height)))) : 36;
  const look = useMemo(() => new THREE.Vector3(0, 0, 0.6), []);
  useFrame((_, delta) => {
    const cam = camera as THREE.PerspectiveCamera;
    const px = still ? 0 : pointer.current.x * 1.1;
    const py = still ? 0 : pointer.current.y * 0.6;
    const back = size.width < 1280 ? 1.2 : 1;
    const [wx, wy, wz] = portrait ? [px, 31 + py, 26.6] : [4 * back + px, 20 * back + py, 0.6 + 15 * back];
    cam.position.set(approach(cam.position.x, wx, delta, still, 1), approach(cam.position.y, wy, delta, still, 1), approach(cam.position.z, wz, delta, still, 1));
    cam.fov = fov;
    cam.lookAt(look);
    cam.updateProjectionMatrix();
  });
  return null;
}

function Framing() {
  const { size } = useThree();
  const narrow = size.width >= 1024 && size.width < 1280;
  return <Composition right={narrow ? 0.15 : 0.17} lift={narrow ? 0.2 : 0.16} up={0.27} />;
}

function KickOn({ deps }: { deps: unknown[] }) {
  useKickOn(deps);
  return null;
}

export default function CommissionScene({ cities, ...stage }: CommissionSceneProps & StageProps) {
  const signature = cities.map((c) => `${c.id}:${c.role}:${c.walks.join("")}:${c.heat}`).join("|");
  return (
    <SceneCanvas name="commission" background={P.bg} camera={{ position: [4, 20, 15.6], fov: 36, near: 0.1, far: 140 }} glow={1} threshold={0.45} vignette={0.5} grain={0.03} shadows {...stage}>
      <KickOn deps={[signature]} />
      <Framing />
      <fog attach="fog" args={[P.bg, 30, 64]} />
      <hemisphereLight args={["#ffd9b0", "#1a0f08", 0.5]} />
      <directionalLight
        position={[-18, 9, 4]}
        intensity={2.4}
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
      <directionalLight position={[14, 6, -10]} intensity={0.7} color={P.fill} />
      <mesh rotation-x={-Math.PI / 2} position-y={-SLAB - 0.05} receiveShadow>
        <planeGeometry args={[160, 160]} />
        <meshStandardMaterial color="#140d08" roughness={0.9} metalness={0.1} />
      </mesh>
      <Slab />
      <Thread cities={cities} />
      {cities.map((c) => (
        <City key={c.id} c={c} />
      ))}
      <Rig />
    </SceneCanvas>
  );
}
