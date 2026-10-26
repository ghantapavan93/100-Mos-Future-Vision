"use client";

// The Living City: one riverside district at dawn — Detroit, by the river —
// where community shows up as light. Streets glow faintly; light flows along
// them where walks are happening. It never draws a person or a path anyone
// walked: only walks, places and the things partners fund.
//
// Seven scenes, one scene prop:
//   0 the world — light flows through the streets;
//   1 the person — the library's doorway glows (a QR poster: "walk with us");
//   2 the place — two routes to Saturday's walk, coloured by whether they fit;
//   3 the community — light gathers at Rivard Plaza, the City Lead's pin rises;
//   4 the partner — a beacon over the outfitter's store funds two more walks;
//   5 the change — shade and benches line Route A, a step-free way is marked;
//   6 the network — the district shrinks into Detroit's point among her seven
//     cities, and a baton of light runs the Year 10 relay, Chicago to LA.
// Every value eases toward its scene's target, so nothing pops.

import { useFrame, useThree } from "@react-three/fiber";
import { createContext, useContext, useMemo, useRef, type MutableRefObject, type ReactNode } from "react";
import * as THREE from "three";
import { Label } from "@/components/three/Label";
import { LIGHT } from "@/components/three/palette";
import { Composition, MAX_DT, SceneCanvas, approach, glowColor, useKickOn, useLiveClock, useMotion, usePortrait } from "@/components/three/SceneCanvas";
import type { StageProps } from "@/components/three/Stage";
import { DOOR, LIBRARY, NEW_WALKS, PLAZA, RELAY, RIVERWALK_Z, ROUTE_A, ROUTE_B, STAIRS, STORE, buildDistrict, cityNodes, pointAt, seeded, type XZ } from "./city";

/** What the person in scene 2 says she needs. A route fits when it has every one. */
export interface Needs {
  stepFree: boolean;
  shade: boolean;
  rest: boolean;
}

export interface LivingCityProps {
  scene: number;
  needs: Needs;
  /** City names by chapter id, from the world. */
  cities: Record<string, string>;
  /** Detroit's City Lead and the back walker, from the world. */
  lead: string;
  /** How many are coming to Saturday's walk, her included. */
  coming: number;
}

const P = LIGHT.dawn;
export const VISION_COLOR = {
  light: "#ffb877",
  fit: "#5fd3a2",
  notYet: "#ff7a59",
  gold: "#ffc14d",
  accent: "#ff6a13",
  violet: "#c3b8ff",
} as const;
const LABEL_BG = "rgba(20,15,34,0.92)";

// ── Easing values, one place ─────────────────────────────────────────────────

interface Anim {
  /** The opening view's name for the place. */
  world: number;
  flow: number;
  door: number;
  routes: number;
  gather: number;
  sponsor: number;
  funded: number;
  fixed: number;
  glow: number;
  network: number;
  district: number;
  /** The relay baton's progress, 0..1, scene 6 only. */
  relay: number;
}

function targetsFor(scene: number): Omit<Anim, "relay"> {
  return {
    world: scene === 0 ? 1 : 0,
    flow: [1, 0.55, 0.45, 0.75, 0.85, 0.9, 0][scene] ?? 1,
    door: scene === 1 ? 1 : scene === 2 ? 0.4 : 0,
    routes: scene === 2 || scene === 5 ? 1 : scene === 3 ? 0.65 : 0,
    gather: scene === 3 ? 1 : 0,
    sponsor: scene === 4 ? 1 : 0,
    funded: scene === 4 || scene === 5 ? 1 : 0,
    fixed: scene >= 5 ? 1 : 0,
    glow: scene === 5 ? 1 : 0,
    network: scene === 6 ? 1 : 0,
    district: scene === 6 ? 0.13 : 1,
  };
}

const AnimContext = createContext<MutableRefObject<Anim> | null>(null);
const useAnim = () => useContext(AnimContext)!;

/** Runs first each frame: every value moves toward its scene's target. */
function Driver({ scene, anim }: { scene: number; anim: MutableRefObject<Anim> }) {
  const { still } = useMotion();
  const t = useMemo(() => targetsFor(scene), [scene]);
  useFrame((state, delta) => {
    const a = anim.current;
    a.world = approach(a.world, t.world, delta, still, 0.7);
    a.flow = approach(a.flow, t.flow, delta, still, 0.9);
    a.door = approach(a.door, t.door, delta, still, 0.7);
    a.routes = approach(a.routes, t.routes, delta, still, 0.8);
    a.gather = approach(a.gather, t.gather, delta, still, 1.6);
    a.sponsor = approach(a.sponsor, t.sponsor, delta, still, 1.2);
    a.funded = approach(a.funded, t.funded, delta, still, 1.8);
    a.fixed = approach(a.fixed, t.fixed, delta, still, 1.6);
    a.glow = approach(a.glow, t.glow, delta, still, 1.2);
    a.network = approach(a.network, t.network, delta, still, 1.4);
    a.district = approach(a.district, t.district, delta, still, 1.4);
    // The relay runs once, at an even pace, after the pull-back; back to the start when you leave.
    if (scene !== 6) a.relay = approach(a.relay, 0, delta, still, 0.4);
    else if (still) a.relay = 1;
    else if (a.network > 0.6 && a.relay < 1) {
      a.relay = Math.min(1, a.relay + Math.min(delta, MAX_DT) / 6.5);
      state.invalidate();
    }
  });
  return null;
}

/** Scales its children in and out with an eased value, and stops drawing them at zero. */
function Fade({ value, children, position }: { value: (a: Anim) => number; children: ReactNode; position?: [number, number, number] }) {
  const anim = useAnim();
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const v = THREE.MathUtils.clamp(value(anim.current), 0, 1);
    g.visible = v > 0.01;
    g.scale.setScalar(Math.max(0.0001, v));
  });
  return (
    <group ref={group} position={position} visible={false}>
      {children}
    </group>
  );
}

// ── The district ─────────────────────────────────────────────────────────────

const district = buildDistrict();

/** Buildings with windows drawn in the shader: one draw call for the whole district. */
function useBuildingMaterial() {
  return useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.82, metalness: 0.06 });
    const uniforms = { uWindows: { value: 0.55 }, uWindowColor: { value: new THREE.Color("#ffb070").multiplyScalar(1.35) } };
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vCityPos;\nvarying vec3 vCityNormal;")
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          vec4 cityPos = vec4( transformed, 1.0 );
          vec3 cityNormal = objectNormal;
          #ifdef USE_INSTANCING
            cityPos = instanceMatrix * cityPos;
            cityNormal = mat3( instanceMatrix ) * cityNormal;
          #endif
          vCityPos = cityPos.xyz;
          vCityNormal = normalize( cityNormal );`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
          uniform float uWindows;
          uniform vec3 uWindowColor;
          varying vec3 vCityPos;
          varying vec3 vCityNormal;
          float cityHash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }`,
        )
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
          {
            float wall = 1.0 - step( 0.5, abs( vCityNormal.y ) );
            float run = abs( vCityNormal.x ) > 0.5 ? vCityPos.z : vCityPos.x;
            vec2 cell = vec2( run * 2.7, vCityPos.y * 2.9 );
            vec2 id = floor( cell );
            vec2 f = fract( cell );
            float pane = step( 0.26, f.x ) * step( f.x, 0.74 ) * step( 0.3, f.y ) * step( f.y, 0.76 );
            float lit = step( 0.7, cityHash( id + floor( vCityPos.xz * 0.37 ) * 13.0 ) );
            float above = step( 0.34, vCityPos.y );
            totalEmissiveRadiance += uWindowColor * pane * lit * wall * above * uWindows;
          }`,
        );
    };
    return { mat, uniforms };
  }, []);
}

function Buildings() {
  const anim = useAnim();
  const { mat, uniforms } = useBuildingMaterial();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), []);
  const { buildings } = district;
  const ready = useRef(false);
  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    if (!ready.current) {
      const o = new THREE.Object3D();
      const c = new THREE.Color();
      buildings.forEach((b, i) => {
        o.position.set(b.x, 0, b.z);
        o.scale.set(b.w, b.h, b.d);
        o.updateMatrix();
        m.setMatrixAt(i, o.matrix);
        m.setColorAt(i, c.set("#2a2140").lerp(new THREE.Color("#3f3456"), b.tone));
      });
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      ready.current = true;
    }
    // The neighbourhood brightens when it changes for the better.
    uniforms.uWindows.value = 0.5 + anim.current.glow * 0.7;
  });
  return <instancedMesh ref={mesh} args={[geometry, mat, buildings.length]} frustumCulled={false} castShadow={false} />;
}

/** Water and the far bank belong to the district view: they fade out as the network appears. */
function useDistrictFade(base: number) {
  const anim = useAnim();
  const material = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    const m = material.current;
    if (!m) return;
    const k = THREE.MathUtils.clamp((anim.current.district - 0.2) / 0.8, 0, 1);
    m.opacity = base * k;
    m.visible = k > 0.01;
  });
  return material;
}

function Ground() {
  const { park } = district;
  const river = useDistrictFade(1);
  const bank = useDistrictFade(1);
  const walk = useDistrictFade(1);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, -2]}>
        <planeGeometry args={[220, 200]} />
        <meshStandardMaterial color="#1b1530" roughness={1} />
      </mesh>
      {/* The park: a grove with an open lawn. */}
      <mesh rotation-x={-Math.PI / 2} position={[(park.x0 + park.x1) / 2, 0.012, (park.z0 + park.z1) / 2]}>
        <planeGeometry args={[park.x1 - park.x0 - 0.9, park.z1 - park.z0 - 0.9]} />
        <meshStandardMaterial color="#1c2c2a" roughness={1} />
      </mesh>
      {/* The riverwalk, a paler path along the water. */}
      <mesh rotation-x={-Math.PI / 2} position={[0.5, 0.014, RIVERWALK_Z]}>
        <planeGeometry args={[32, 1.25]} />
        <meshStandardMaterial ref={walk} color="#2d2440" roughness={0.9} transparent />
      </mesh>
      {/* The river, catching the low sun. */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 7.3 + 40]}>
        <planeGeometry args={[220, 80]} />
        <meshStandardMaterial ref={river} color="#251e4a" roughness={0.28} metalness={0.65} transparent depthWrite={false} />
      </mesh>
      {/* The far bank. */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, 30]}>
        <planeGeometry args={[220, 12]} />
        <meshStandardMaterial ref={bank} color="#17122a" roughness={1} transparent depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Streets: dark strips, each with a faint line of light down the middle. */
function Streets() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => new THREE.BoxGeometry(1, 0.02, 1), []);
  const lines = useMemo(() => {
    const pts: number[] = [];
    for (const [[ax, az], [bx, bz]] of district.streets) pts.push(ax, 0.035, az, bx, 0.035, bz);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  const lineColor = useMemo(() => glowColor("#ff9a4d", 0.85), []);
  const done = useRef(false);
  useFrame(() => {
    const m = mesh.current;
    if (!m || done.current) return;
    const o = new THREE.Object3D();
    district.streets.forEach(([[ax, az], [bx, bz]], i) => {
      o.position.set((ax + bx) / 2, 0.01, (az + bz) / 2);
      o.scale.set(Math.max(0.9, Math.abs(bx - ax)), 1, Math.max(0.9, Math.abs(bz - az)));
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    done.current = true;
  });
  return (
    <group>
      <instancedMesh ref={mesh} args={[geometry, undefined, district.streets.length]} frustumCulled={false}>
        <meshStandardMaterial color="#251d3a" roughness={0.95} />
      </instancedMesh>
      <lineSegments geometry={lines}>
        <lineBasicMaterial color={lineColor} toneMapped={false} transparent opacity={0.32} />
      </lineSegments>
    </group>
  );
}

const treeGeometry = new THREE.IcosahedronGeometry(0.34, 0);

/** Trees as one instanced mesh. `grow` scales every tree (0 → 1) for the ones a fix adds. */
function Trees({ at, grow, seed }: { at: XZ[]; grow?: (a: Anim) => number; seed: number }) {
  const anim = useAnim();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const sizes = useMemo(() => {
    const r = seeded(seed);
    return at.map(() => 0.8 + r() * 0.45);
  }, [at, seed]);
  const last = useRef(-1);
  const o = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const g = grow ? THREE.MathUtils.clamp(grow(anim.current), 0, 1) : 1;
    if (Math.abs(g - last.current) < 1e-4) return;
    last.current = g;
    at.forEach(([x, z], i) => {
      // Each new tree grows a beat after the one before it, along the route.
      const k = grow ? THREE.MathUtils.clamp(g * 1.6 - (i / at.length) * 0.6, 0, 1) : 1;
      const s = sizes[i]! * Math.max(0.0001, k);
      o.position.set(x, 0.34 * s * 1.25 + 0.02, z);
      o.scale.set(s, s * 1.25, s);
      o.rotation.y = i * 1.7;
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[treeGeometry, undefined, at.length]} frustumCulled={false}>
      <meshStandardMaterial color="#2f6352" roughness={0.85} emissive="#0d2a22" flatShading />
    </instancedMesh>
  );
}

const benchGeometry = new THREE.BoxGeometry(0.5, 0.09, 0.17);

function Benches({ at, grow }: { at: { at: XZ; turn: number }[]; grow?: (a: Anim) => number }) {
  const anim = useAnim();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const o = useMemo(() => new THREE.Object3D(), []);
  const last = useRef(-1);
  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const g = grow ? THREE.MathUtils.clamp(grow(anim.current), 0, 1) : 1;
    if (Math.abs(g - last.current) < 1e-4) return;
    last.current = g;
    at.forEach(({ at: [x, z], turn }, i) => {
      // Benches arrive after the trees have started.
      const k = grow ? THREE.MathUtils.clamp(g * 1.5 - 0.5, 0, 1) : 1;
      o.position.set(x, 0.16 * k, z);
      o.scale.setScalar(Math.max(0.0001, k));
      o.rotation.y = turn;
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[benchGeometry, undefined, at.length]} frustumCulled={false}>
      <meshStandardMaterial color="#8a5c3e" roughness={0.7} emissive="#3a1e0c" />
    </instancedMesh>
  );
}

// ── Light flowing through the streets ────────────────────────────────────────

const FLOW_COUNT = 150;
/** How many lights gather at the plaza in scene 3. */
const GATHER = 22;

function Flow() {
  const anim = useAnim();
  const { still } = useMotion();
  const live = useLiveClock();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => new THREE.SphereGeometry(0.075, 8, 6), []);
  const color = useMemo(() => glowColor(VISION_COLOR.light, 2.3), []);
  const plan = useMemo(() => {
    const r = seeded(77);
    const flows = district.flows;
    const lengths = flows.map((f) => f.slice(1).map((p, i) => Math.hypot(p[0] - f[i]![0], p[1] - f[i]![1])));
    const totals = lengths.map((l) => l.reduce((a, b) => a + b, 0));
    return Array.from({ length: FLOW_COUNT }, (_, i) => {
      const path = i % flows.length;
      const angle = (i / GATHER) * Math.PI * 2 + r() * 0.4;
      const radius = 0.45 + r() * 0.62;
      return {
        path,
        u0: r(),
        // About 0.4–1 unit a second, either way along the street.
        speed: ((0.4 + r() * 0.6) / totals[path]!) * (r() < 0.5 ? -1 : 1),
        size: 0.8 + r() * 0.5,
        home: [PLAZA[0] + Math.cos(angle) * radius, PLAZA[1] + Math.sin(angle) * radius * 0.7] as XZ,
      };
    });
  }, []);
  const lengths = useMemo(() => district.flows.map((f) => f.slice(1).map((p, i) => Math.hypot(p[0] - f[i]![0], p[1] - f[i]![1]))), []);
  const o = useMemo(() => new THREE.Object3D(), []);
  useFrame((state) => {
    const m = mesh.current;
    if (!m) return;
    const a = anim.current;
    const t = 6 + live(state.clock.elapsedTime);
    const vis = a.flow;
    m.visible = vis > 0.01;
    if (!m.visible) return;
    for (let i = 0; i < FLOW_COUNT; i++) {
      const p = plan[i]!;
      const pt = pointAt(district.flows[p.path]!, p.u0 + t * p.speed, lengths[p.path]);
      let x = pt.x;
      let z = pt.z;
      let s = p.size * vis;
      if (i < GATHER) {
        const g = a.gather;
        x += (p.home[0] - x) * g;
        z += (p.home[1] - z) * g;
        s *= 1 + g * 0.35;
      } else s *= 1 - a.gather * 0.35;
      o.position.set(x, 0.17, z);
      o.scale.setScalar(Math.max(0.0001, s));
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[geometry, undefined, FLOW_COUNT]} frustumCulled={false}>
      <meshBasicMaterial color={color} toneMapped={false} />
    </instancedMesh>
  );
}

// ── The library's doorway ────────────────────────────────────────────────────

/** A QR-like poster: a pattern of squares, drawn once. Not a real code. */
function useQrTexture() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 96;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff6ea";
    ctx.fillRect(0, 0, 96, 96);
    ctx.fillStyle = "#140f22";
    const r = seeded(4);
    const n = 11;
    const s = 96 / (n + 2);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (r() < 0.48) ctx.fillRect(s + i * s, s + j * s, s, s);
    for (const [cx, cy] of [
      [0, 0],
      [n - 3, 0],
      [0, n - 3],
    ]) {
      ctx.fillStyle = "#140f22";
      ctx.fillRect(s + cx! * s, s + cy! * s, s * 3, s * 3);
      ctx.fillStyle = "#fff6ea";
      ctx.fillRect(s + cx! * s + s * 0.6, s + cy! * s + s * 0.6, s * 1.8, s * 1.8);
      ctx.fillStyle = "#140f22";
      ctx.fillRect(s + cx! * s + s, s + cy! * s + s, s, s);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.NearestFilter;
    return t;
  }, []);
}

function Library() {
  const anim = useAnim();
  const live = useLiveClock();
  const portrait = usePortrait();
  const qr = useQrTexture();
  const door = useRef<THREE.MeshBasicMaterial>(null);
  const beam = useRef<THREE.Mesh>(null);
  const dim = useMemo(() => new THREE.Color("#6b5434"), []);
  const lit = useMemo(() => glowColor(VISION_COLOR.gold, 2.4), []);
  const columns = useMemo(() => [-1.05, -0.4, 0.4, 1.05].map((dz) => [DOOR[0] + 0.05, DOOR[1] + dz] as XZ), []);
  useFrame((state) => {
    const d = anim.current.door;
    const pulse = 0.82 + 0.18 * Math.cos(live(state.clock.elapsedTime) * 3);
    if (door.current) door.current.color.copy(dim).lerp(lit, Math.min(1, d * pulse));
    if (beam.current) {
      beam.current.visible = d > 0.01;
      beam.current.scale.set(1, Math.max(0.0001, d), 1);
      (beam.current.material as THREE.MeshBasicMaterial).opacity = 0.13 * d * pulse;
    }
  });
  const [lx, lz] = LIBRARY;
  const face = lx + 4.1 / 2;
  return (
    <group>
      <mesh position={[lx, 0.62, lz]}>
        <boxGeometry args={[4.1, 1.24, 3.1]} />
        <meshStandardMaterial color="#463b5c" roughness={0.75} />
      </mesh>
      <mesh position={[lx, 1.31, lz]}>
        <boxGeometry args={[4.3, 0.14, 3.3]} />
        <meshStandardMaterial color="#6a5c84" roughness={0.55} />
      </mesh>
      <mesh position={[lx, 1.38, lz]}>
        <sphereGeometry args={[0.72, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#7d6c99" roughness={0.45} metalness={0.25} />
      </mesh>
      {columns.map(([x, z]) => (
        <mesh key={z} position={[x, 0.55, z]}>
          <cylinderGeometry args={[0.07, 0.07, 1.1, 10]} />
          <meshStandardMaterial color="#8a7da6" roughness={0.5} />
        </mesh>
      ))}
      {/* The front door, facing the avenue, and the poster beside it. */}
      <mesh position={[face + 0.015, 0.47, DOOR[1]]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[0.55, 0.9]} />
        <meshBasicMaterial ref={door} color={dim} toneMapped={false} />
      </mesh>
      <mesh position={[face + 0.02, 0.78, DOOR[1] + 0.78]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[0.5, 0.5]} />
        <meshBasicMaterial map={qr} toneMapped={false} />
      </mesh>
      {/* A soft column of light over the door, so a first-timer's doorway reads from across the city. */}
      <mesh ref={beam} position={[DOOR[0] + 0.3, 1.9, DOOR[1]]} visible={false}>
        <cylinderGeometry args={[0.08, 0.32, 3.6, 24, 1, true]} />
        <meshBasicMaterial color={lit} toneMapped={false} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
      </mesh>
      <Fade value={(a) => Math.max(0, (a.door - 0.5) * 2)}>
        <Label text="The library" detail="“Walk with us Saturday”" position={[DOOR[0] + 0.2, 2.6, DOOR[1]]} px={portrait ? 15 : 19} background={LABEL_BG} color="#ffe2a3" />
      </Fade>
    </group>
  );
}

// ── Two routes to Saturday's walk ────────────────────────────────────────────

function tubeFor(line: XZ[], y: number, radius: number, segments: number) {
  const path = new THREE.CurvePath<THREE.Vector3>();
  for (let i = 0; i < line.length - 1; i++) path.add(new THREE.LineCurve3(new THREE.Vector3(line[i]![0], y, line[i]![1]), new THREE.Vector3(line[i + 1]![0], y, line[i + 1]![1])));
  return new THREE.TubeGeometry(path as unknown as THREE.Curve<THREE.Vector3>, segments, radius, 6, false);
}

function Route({ line, fits, label, detail, labelAt, seed }: { line: XZ[]; fits: boolean; label: string; detail: string; labelAt: [number, number, number]; seed: number }) {
  const anim = useAnim();
  const { still } = useMotion();
  const live = useLiveClock();
  const portrait = usePortrait();
  const core = useMemo(() => tubeFor(line, 0.13, 0.065, 140), [line]);
  const halo = useMemo(() => tubeFor(line, 0.13, 0.2, 140), [line]);
  const coreMat = useRef<THREE.MeshBasicMaterial>(null);
  const haloMat = useRef<THREE.MeshBasicMaterial>(null);
  const dots = useRef<THREE.InstancedMesh>(null);
  const fit = useMemo(() => glowColor(VISION_COLOR.fit, 2), []);
  const notYet = useMemo(() => glowColor(VISION_COLOR.notYet, 2), []);
  const want = useMemo(() => new THREE.Color(), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the starting colour only; useFrame eases it after that
  const initial = useMemo(() => (fits ? fit : notYet).clone(), []);
  const dotGeom = useMemo(() => new THREE.SphereGeometry(0.09, 8, 6), []);
  const segs = useMemo(() => line.slice(1).map((p, i) => Math.hypot(p[0] - line[i]![0], p[1] - line[i]![1])), [line]);
  const o = useMemo(() => new THREE.Object3D(), []);
  const DOTS = 9;
  const offset = useMemo(() => seeded(seed)() * 0.3, [seed]);
  useFrame((state, delta) => {
    const v = anim.current.routes;
    want.copy(fits ? fit : notYet);
    for (const m of [coreMat.current, haloMat.current]) {
      if (!m) continue;
      // Ease the colour too: a route that comes to fit turns from coral to mint, never flicks.
      if (still) m.color.copy(want);
      else m.color.lerp(want, 1 - Math.exp(-Math.min(delta, 0.25) * 4));
      m.visible = v > 0.01;
    }
    if (coreMat.current) coreMat.current.opacity = v;
    if (haloMat.current) haloMat.current.opacity = 0.16 * v;
    const d = dots.current;
    if (d) {
      d.visible = v > 0.01;
      const t = 2 + live(state.clock.elapsedTime);
      for (let i = 0; i < DOTS; i++) {
        const pt = pointAt(line, offset + i / DOTS + t * 0.035, segs);
        o.position.set(pt.x, 0.2, pt.z);
        o.scale.setScalar(Math.max(0.0001, v * (fits ? 1 : 0.6)));
        o.updateMatrix();
        d.setMatrixAt(i, o.matrix);
      }
      d.instanceMatrix.needsUpdate = true;
      (d.material as THREE.MeshBasicMaterial).color.copy(coreMat.current?.color ?? want);
    }
  });
  return (
    <group>
      <mesh geometry={core}>
        <meshBasicMaterial ref={coreMat} color={initial} toneMapped={false} transparent opacity={0} />
      </mesh>
      <mesh geometry={halo}>
        <meshBasicMaterial ref={haloMat} color={initial} toneMapped={false} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <instancedMesh ref={dots} args={[dotGeom, undefined, DOTS]} frustumCulled={false}>
        <meshBasicMaterial color={initial} toneMapped={false} />
      </instancedMesh>
      <Fade value={(a) => (a.routes > 0.5 ? (a.routes - 0.5) * 2 : 0)}>
        <Label text={label} detail={detail} position={labelAt} px={portrait ? 14 : 18} background={fits ? "rgba(12,38,30,0.94)" : "rgba(46,22,16,0.94)"} color={fits ? "#c9f2df" : "#ffd2c4"} />
      </Fade>
    </group>
  );
}

/** The stairs on Route A, and the step-free way around them a City Lead confirms. */
function Stairs() {
  const anim = useAnim();
  const steps = useMemo(() => [0.08, 0.16, 0.24, 0.24, 0.16, 0.08], []);
  const way = useMemo(() => {
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(STAIRS[0] - 1.05, 0.13, STAIRS[1]), new THREE.Vector3(STAIRS[0], 0.13, STAIRS[1] + 1.6), new THREE.Vector3(STAIRS[0] + 1.05, 0.13, STAIRS[1]));
    return new THREE.TubeGeometry(curve, 40, 0.06, 6, false);
  }, []);
  const coral = useMemo(() => glowColor(VISION_COLOR.notYet, 1.4), []);
  const mint = useMemo(() => glowColor(VISION_COLOR.fit, 2.1), []);
  const wayMat = useRef<THREE.MeshBasicMaterial>(null);
  const stairs = useRef<THREE.Group>(null);
  useFrame(() => {
    const a = anim.current;
    if (wayMat.current) {
      wayMat.current.opacity = a.fixed * Math.max(a.routes, 0.25);
      wayMat.current.visible = a.fixed > 0.01;
    }
    if (stairs.current) stairs.current.visible = a.district > 0.5;
  });
  return (
    <group>
      <group ref={stairs}>
        {steps.map((h, i) => (
          <mesh key={i} position={[STAIRS[0] - 0.6 + i * 0.24, h / 2 + 0.02, STAIRS[1]]}>
            <boxGeometry args={[0.24, h, 0.9]} />
            <meshStandardMaterial color="#5a3a3a" emissive={coral} emissiveIntensity={0.18} roughness={0.7} />
          </mesh>
        ))}
      </group>
      <mesh geometry={way}>
        <meshBasicMaterial ref={wayMat} color={mint} toneMapped={false} transparent opacity={0} />
      </mesh>
    </group>
  );
}

// ── Saturday at Rivard Plaza ─────────────────────────────────────────────────

function Plaza({ lead, coming }: { lead: string; coming: number }) {
  const anim = useAnim();
  const portrait = usePortrait();
  const ring = useRef<THREE.MeshBasicMaterial>(null);
  const gold = useMemo(() => glowColor(VISION_COLOR.gold, 2.2), []);
  const orange = useMemo(() => glowColor(VISION_COLOR.accent, 2.4), []);
  useFrame(() => {
    if (!ring.current) return;
    const a = anim.current;
    ring.current.opacity = Math.max(0.08, a.gather) * (a.district > 0.5 ? 1 : 0);
  });
  return (
    <group position={[PLAZA[0], 0, PLAZA[1]]}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.03}>
        <ringGeometry args={[1.05, 1.28, 64]} />
        <meshBasicMaterial ref={ring} color={gold} toneMapped={false} transparent opacity={0.2} />
      </mesh>
      <Fade value={(a) => a.gather} position={[1.45, 0, -0.95]}>
        <mesh position-y={0.7}>
          <cylinderGeometry args={[0.045, 0.045, 1.4, 10]} />
          <meshStandardMaterial color={VISION_COLOR.accent} roughness={0.4} />
        </mesh>
        <mesh position-y={1.5}>
          <sphereGeometry args={[0.17, 20, 14]} />
          <meshBasicMaterial color={orange} toneMapped={false} />
        </mesh>
        <Label text={lead} detail="City Lead" position={[0, 2.15, 0]} px={portrait ? 14 : 17} background="rgba(48,24,8,0.95)" color="#ffd2b0" />
      </Fade>
      {/* Phones see the plaza from higher up, which stacks this label onto the Lead's: lift it clear. */}
      <Fade value={(a) => a.gather}>
        <Label text="Saturday 8:00" detail={`${coming} coming`} position={portrait ? [-0.9, 4.2, 0.2] : [-1, 2.75, 0.2]} px={portrait ? 15 : 19} background={LABEL_BG} color="#ffe2a3" />
      </Fade>
    </group>
  );
}

// ── A partner funds two more walks ───────────────────────────────────────────

function arcTube(from: THREE.Vector3, to: THREE.Vector3, lift: number, radius: number) {
  const mid = from.clone().add(to).multiplyScalar(0.5);
  mid.y = Math.max(from.y, to.y) + lift;
  return new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(from, mid, to), 64, radius, 6, false);
}

/** Returns a setter that draws a tube from its start to `progress` (0..1) of the way. */
function drawTo(geometry: THREE.TubeGeometry) {
  const total = geometry.index ? geometry.index.count : 0;
  return (progress: number) => {
    const p = THREE.MathUtils.clamp(progress, 0, 1);
    geometry.setDrawRange(0, Math.floor((total * p) / 6) * 6);
  };
}

function Partner() {
  const anim = useAnim();
  const portrait = usePortrait();
  const gold = useMemo(() => glowColor(VISION_COLOR.gold, 2.3), []);
  const beam = useRef<THREE.Mesh>(null);
  const top = useMemo(() => new THREE.Vector3(STORE[0], 6.6, STORE[1]), []);
  const arcs = useMemo(() => NEW_WALKS.map(([x, z]) => arcTube(top, new THREE.Vector3(x, 1.55, z), 2.2, 0.05)), [top]);
  const draws = useMemo(() => arcs.map((g) => drawTo(g)), [arcs]);
  const pins = useRef<(THREE.Group | null)[]>([]);
  const arcMats = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  useFrame(() => {
    const a = anim.current;
    if (beam.current) {
      beam.current.visible = a.sponsor > 0.01;
      beam.current.scale.set(1, Math.max(0.0001, a.sponsor), 1);
      beam.current.position.y = 1.4 + (5.2 * a.sponsor) / 2;
    }
    // The money arrives first, then the two walks rise where it lands.
    const drawn = a.funded;
    draws.forEach((draw, i) => {
      draw(Math.min(1, drawn * 1.35) * (a.district > 0.5 ? 1 : 0));
      const m = arcMats.current[i];
      if (m) m.opacity = Math.min(1, a.sponsor * 1.2) * 0.9 + 0.1 * a.funded * (1 - a.sponsor);
    });
    pins.current.forEach((g) => {
      if (!g) return;
      const k = THREE.MathUtils.clamp((a.funded - 0.45) / 0.55, 0, 1);
      g.visible = k > 0.01;
      g.scale.set(1, Math.max(0.0001, k), 1);
    });
  });
  const walks = [
    { when: "Thursday 6:30 pm", what: "funded" },
    { when: "Sunday 9:00 am", what: "funded" },
  ];
  return (
    <group>
      {/* The outfitter's storefront, its sign lit. */}
      <mesh position={[STORE[0], 0.62, STORE[1]]}>
        <boxGeometry args={[2.6, 1.24, 2.2]} />
        <meshStandardMaterial color="#3b3048" roughness={0.7} />
      </mesh>
      <mesh position={[STORE[0], 1.02, STORE[1] + 1.11]}>
        <boxGeometry args={[2.3, 0.2, 0.04]} />
        <meshBasicMaterial color={gold} toneMapped={false} />
      </mesh>
      <mesh ref={beam} position={[STORE[0], 1.4, STORE[1]]} visible={false}>
        <cylinderGeometry args={[0.16, 0.34, 5.2, 24, 1, true]} />
        <meshBasicMaterial color={gold} toneMapped={false} transparent opacity={0.32} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
      </mesh>
      {arcs.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshBasicMaterial
            ref={(m) => {
              arcMats.current[i] = m;
            }}
            color={gold}
            toneMapped={false}
            transparent
            opacity={0.9}
          />
        </mesh>
      ))}
      {NEW_WALKS.map(([x, z], i) => (
        <group
          key={i}
          position={[x, 0, z]}
          ref={(g) => {
            pins.current[i] = g;
          }}
          visible={false}
        >
          <mesh position-y={0.7}>
            <cylinderGeometry args={[0.045, 0.045, 1.4, 10]} />
            <meshStandardMaterial color={VISION_COLOR.gold} roughness={0.4} />
          </mesh>
          <mesh position-y={1.5}>
            <sphereGeometry args={[0.17, 20, 14]} />
            <meshBasicMaterial color={gold} toneMapped={false} />
          </mesh>
          <mesh rotation-x={-Math.PI / 2} position-y={0.03}>
            <ringGeometry args={[0.5, 0.62, 48]} />
            <meshBasicMaterial color={gold} toneMapped={false} />
          </mesh>
        </group>
      ))}
      <Fade value={(a) => a.sponsor}>
        <Label text="Northline Outfitters" detail="funds 2 more walks" position={[STORE[0], 7.4, STORE[1]]} px={portrait ? 15 : 19} background={LABEL_BG} color="#ffe2a3" />
      </Fade>
      {NEW_WALKS.map(([x, z], i) => (
        <Fade key={i} value={(a) => THREE.MathUtils.clamp((a.funded - 0.6) / 0.4, 0, 1) * THREE.MathUtils.clamp(a.sponsor * 1.5, 0, 1)}>
          <Label text={walks[i]!.when} detail={walks[i]!.what} position={[x, 2.2, z]} px={portrait ? 13 : 16} background={LABEL_BG} color="#ffe2a3" />
        </Fade>
      ))}
    </group>
  );
}

// ── The network: her seven cities, and the Year 10 relay ────────────────────

function Network({ cities }: { cities: Record<string, string> }) {
  const anim = useAnim();
  const portrait = usePortrait();
  const nodes = useMemo(() => cityNodes(cities), [cities]);
  const byId = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);
  const order = useMemo(() => RELAY.map((id) => byId[id]!).filter(Boolean), [byId]);
  const gold = useMemo(() => glowColor(VISION_COLOR.gold, 1.7), []);
  const light = useMemo(() => glowColor(VISION_COLOR.light, 2.1), []);
  const white = useMemo(() => glowColor("#fff1dc", 3), []);
  const arcs = useMemo(
    () =>
      order.slice(1).map((n, i) => {
        const a = order[i]!.at;
        const b = n.at;
        const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
        return {
          geometry: arcTube(new THREE.Vector3(a[0], 0.4, a[1]), new THREE.Vector3(b[0], 0.4, b[1]), 1.2 + d * 0.32, 0.07),
          curve: (() => {
            const from = new THREE.Vector3(a[0], 0.4, a[1]);
            const to = new THREE.Vector3(b[0], 0.4, b[1]);
            const mid = from.clone().add(to).multiplyScalar(0.5);
            mid.y = 0.4 + 1.2 + d * 0.32;
            return new THREE.QuadraticBezierCurve3(from, mid, to);
          })(),
        };
      }),
    [order],
  );
  const draws = useMemo(() => arcs.map((a) => drawTo(a.geometry)), [arcs]);
  const group = useRef<THREE.Group>(null);
  const baton = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  const minis = useRef<THREE.InstancedMesh>(null);
  const discs = useRef<THREE.InstancedMesh>(null);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const o = useMemo(() => new THREE.Object3D(), []);
  const others = useMemo(() => nodes.filter((n) => n.id !== "detroit"), [nodes]);
  const MINI = 7;
  const miniPlan = useMemo(() => {
    const r = seeded(31);
    return others.flatMap((n) =>
      Array.from({ length: MINI }, () => {
        const ang = r() * Math.PI * 2;
        const rad = 0.25 + r() * 0.8;
        return { x: n.at[0] + Math.cos(ang) * rad, z: n.at[1] + Math.sin(ang) * rad, w: 0.22 + r() * 0.18, h: 0.3 + r() * 1.1 };
      }),
    );
  }, [others]);
  const boxGeom = useMemo(() => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), []);
  const discGeom = useMemo(() => new THREE.RingGeometry(1.2, 1.34, 56), []);
  const placed = useRef(-1);
  useFrame(() => {
    const a = anim.current;
    const v = a.network;
    if (group.current) group.current.visible = v > 0.01;
    if (v <= 0.01) return;
    // The other six cities grow in as the district shrinks into Detroit's point.
    if (Math.abs(v - placed.current) > 1e-4) {
      placed.current = v;
      const m = minis.current;
      if (m) {
        miniPlan.forEach((b, i) => {
          o.position.set(b.x, 0, b.z);
          o.rotation.set(0, 0, 0);
          o.scale.set(b.w, Math.max(0.0001, b.h * v), b.w);
          o.updateMatrix();
          m.setMatrixAt(i, o.matrix);
        });
        m.instanceMatrix.needsUpdate = true;
      }
      const d = discs.current;
      if (d) {
        nodes.forEach((n, i) => {
          o.position.set(n.at[0], 0.04, n.at[1]);
          o.rotation.set(-Math.PI / 2, 0, 0);
          o.scale.setScalar(Math.max(0.0001, v * (n.id === "detroit" ? 2.1 : 1)));
          o.updateMatrix();
          d.setMatrixAt(i, o.matrix);
        });
        d.instanceMatrix.needsUpdate = true;
      }
    }
    // The baton: one arc at a time, at an even pace; every arc it has passed stays lit.
    const legs = arcs.length;
    const r = a.relay * legs;
    draws.forEach((draw, i) => draw(THREE.MathUtils.clamp(r - i, 0, 1) * v));
    const leg = Math.min(legs - 1, Math.floor(r));
    const k = THREE.MathUtils.clamp(r - leg, 0, 1);
    arcs[leg]?.curve.getPoint(k, tmp);
    if (baton.current) {
      baton.current.position.copy(tmp);
      baton.current.visible = v > 0.3;
      baton.current.scale.setScalar(Math.max(0.0001, v));
    }
    if (halo.current) {
      halo.current.position.copy(tmp);
      halo.current.visible = v > 0.3;
    }
  });
  return (
    <group ref={group} visible={false}>
      <instancedMesh ref={minis} args={[boxGeom, undefined, miniPlan.length]} frustumCulled={false}>
        <meshStandardMaterial color="#3d3156" emissive={light} emissiveIntensity={0.16} roughness={0.7} />
      </instancedMesh>
      <instancedMesh ref={discs} args={[discGeom, undefined, nodes.length]} frustumCulled={false}>
        <meshBasicMaterial color={gold} toneMapped={false} side={THREE.DoubleSide} />
      </instancedMesh>
      {arcs.map((a, i) => (
        <mesh key={i} geometry={a.geometry}>
          <meshBasicMaterial color={light} toneMapped={false} />
        </mesh>
      ))}
      <mesh ref={baton}>
        <sphereGeometry args={[0.32, 20, 14]} />
        <meshBasicMaterial color={white} toneMapped={false} />
      </mesh>
      <mesh ref={halo}>
        <sphereGeometry args={[0.65, 20, 14]} />
        <meshBasicMaterial color={gold} toneMapped={false} transparent opacity={0.14} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      {nodes.map((n) => {
        const first = n.id === RELAY[0];
        const last = n.id === RELAY[RELAY.length - 1];
        return (
          <Fade key={n.id} value={(a) => (a.network > 0.55 ? (a.network - 0.55) / 0.45 : 0)}>
            <Label
              text={n.city}
              // Chicago sits beside Detroit: on phones its longer label would cover Detroit's, and the card already says where it began.
              detail={first ? (portrait ? undefined : "where it began") : last ? "the newest" : undefined}
              position={[n.at[0], n.id === "detroit" ? 2.4 : 2.1, n.at[1]]}
              px={portrait ? 15 : 19}
              background={first || last ? "rgba(48,24,8,0.95)" : LABEL_BG}
              color={first || last ? "#ffd2b0" : "#f7f2ea"}
            />
          </Fade>
        );
      })}
    </group>
  );
}

// ── Camera and sky ───────────────────────────────────────────────────────────

/**
 * Where the camera looks, per scene, and the offset back to the camera from
 * there. Phones pull back further along the same line.
 */
const SHOTS: { look: [number, number, number]; back: [number, number, number] }[] = [
  { look: [1, 0, 0.8], back: [-17, 24, 33] },
  { look: [-8.4, 0.7, 1.8], back: [9, 7.5, 13.5] },
  { look: [-1, 0, 3.4], back: [-5, 19, 22] },
  { look: [5.4, 0.4, 5.4], back: [-6.5, 8.5, 13] },
  { look: [5.4, 0, -4.6], back: [-7, 21, 25] },
  { look: [-1.6, 0, 2.8], back: [-5.5, 15, 17.5] },
  { look: [-2.6, 0, 4.6], back: [-6, 45, 46] },
];

function Rig({ scene }: { scene: number }) {
  const { camera } = useThree();
  const { still, pointer } = useMotion();
  const portrait = usePortrait();
  const look = useRef(new THREE.Vector3(...SHOTS[0]!.look));
  const want = useMemo(() => new THREE.Vector3(), []);
  const wantLook = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, delta) => {
    const cam = camera as THREE.PerspectiveCamera;
    const shot = SHOTS[scene] ?? SHOTS[0]!;
    wantLook.set(...shot.look);
    want.set(...shot.back).multiplyScalar(portrait ? (scene === 6 ? 1.6 : 1.45) : 1).add(wantLook);
    const px = still ? 0 : pointer.current.x * 0.7;
    const py = still ? 0 : pointer.current.y * 0.35;
    const smooth = 1.25;
    cam.position.set(approach(cam.position.x, want.x + px, delta, still, smooth), approach(cam.position.y, want.y + py, delta, still, smooth), approach(cam.position.z, want.z, delta, still, smooth));
    look.current.set(approach(look.current.x, wantLook.x, delta, still, smooth), approach(look.current.y, wantLook.y, delta, still, smooth), approach(look.current.z, wantLook.z, delta, still, smooth));
    const fov = portrait ? 50 : 36;
    if (cam.fov !== fov) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    cam.lookAt(look.current);
  });
  return null;
}

function FogRig() {
  const { scene, camera } = useThree();
  useFrame(() => {
    const fog = scene.fog as THREE.Fog | null;
    if (!fog) return;
    const d = camera.position.length();
    fog.near = d * 0.95;
    fog.far = d * 2.3 + 20;
  });
  return null;
}

/** A dawn sky: violet overhead, warm low in the east. Only the widest shots see it. */
function Sky() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          top: { value: new THREE.Color("#0f0b1c") },
          mid: { value: new THREE.Color("#2c1e44") },
          horizon: { value: new THREE.Color(P.fog) },
          sun: { value: new THREE.Color("#ff9a5a") },
        },
        vertexShader: "varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; uniform vec3 sun; varying vec3 vDir;
          void main() {
            float h = vDir.y;
            vec3 c = mix(horizon, mid, smoothstep(0.0, 0.16, h));
            c = mix(c, top, smoothstep(0.16, 0.55, h));
            float glow = pow(max(dot(normalize(vec3(0.62, 0.06, 0.78)), vDir), 0.0), 9.0);
            c += sun * glow * 0.45 * (1.0 - smoothstep(0.0, 0.3, h));
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    [],
  );
  return (
    <mesh material={material} renderOrder={-1}>
      <sphereGeometry args={[160, 32, 16]} />
    </mesh>
  );
}

/** The district as a whole: it shrinks into Detroit's point when the network appears. */
function DistrictGroup({ children }: { children: ReactNode }) {
  const anim = useAnim();
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    if (group.current) group.current.scale.setScalar(anim.current.district);
  });
  return <group ref={group}>{children}</group>;
}

/** "Detroit, by the river": which city this is, in the opening view only. */
function PlaceName() {
  const portrait = usePortrait();
  return <Label text="Detroit" detail="by the river, a Saturday in Year 10" position={[3, 7.2, -1]} px={portrait ? 15 : 19} background={LABEL_BG} color="#f7f2ea" />;
}

function KickOn({ deps }: { deps: unknown[] }) {
  useKickOn(deps);
  return null;
}

export default function LivingCityScene({ scene, needs, cities, lead, coming, ...stage }: LivingCityProps & StageProps) {
  const anim = useRef<Anim>({ ...targetsFor(scene), relay: scene === 6 ? 1 : 0 });
  const fixed = scene >= 5;
  const aFits = (!needs.stepFree || fixed) && (!needs.shade || fixed) && (!needs.rest || fixed);
  const bFits = true;
  return (
    <SceneCanvas
      name="vision"
      background={P.fog}
      camera={{ position: [SHOTS[0]!.look[0] + SHOTS[0]!.back[0], SHOTS[0]!.look[1] + SHOTS[0]!.back[1], SHOTS[0]!.look[2] + SHOTS[0]!.back[2]], fov: 36, near: 0.1, far: 400 }}
      glow={1.05}
      threshold={0.5}
      vignette={0.5}
      grain={0.03}
      {...stage}
    >
      <AnimContext.Provider value={anim}>
        <Driver scene={scene} anim={anim} />
        <KickOn deps={[scene, needs.stepFree, needs.shade, needs.rest, coming]} />
        {/* The words own the left on wide screens and the bottom on phones. */}
        <Composition right={0.2} lift={0.04} up={0.3} />
        <fog attach="fog" args={[P.fog, 30, 78]} />
        <FogRig />
        <hemisphereLight args={["#8f80cf", "#140f22", 0.95]} />
        <directionalLight position={[16, 9, 18]} intensity={2.3} color="#ffb27a" />
        <directionalLight position={[-14, 11, -10]} intensity={0.55} color={P.fill} />
        <Sky />
        <Ground />
        <DistrictGroup>
          <Streets />
          <Buildings />
          <Trees at={district.trees} seed={3} />
          <Trees at={district.newTrees} seed={9} grow={(a) => a.fixed} />
          <Benches at={district.benches} />
          <Benches at={district.newBenches} grow={(a) => a.fixed} />
          <Flow />
          <Library />
          <Stairs />
          <Route line={ROUTE_B} fits={bFits} label="Route B" detail="step-free · shade · benches" labelAt={[-2.2, 1.25, RIVERWALK_Z + 0.4]} seed={2} />
          <Route
            line={ROUTE_A}
            fits={aFits}
            label="Route A"
            detail={fixed ? "shade · benches · step-free way" : "stairs · no shade · no benches"}
            labelAt={[-2.3, 1.45, -0.6]}
            seed={5}
          />
          <Plaza lead={lead} coming={coming} />
          <Partner />
          <Fade value={(a) => a.world}>
            <PlaceName />
          </Fade>
        </DistrictGroup>
        <Network cities={cities} />
        <Rig scene={scene} />
      </AnimContext.Provider>
    </SceneCanvas>
  );
}
