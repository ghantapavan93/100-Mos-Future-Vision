"use client";

// THE FIRST STEP — the opening, and the one change of scale 3D explains better
// than anything else. One camera, four beats: on the ground at dawn with one
// person's line; along it; rising; above everyone, where every line meets at a
// First Mile start.
//
// The light is the story: a low sun behind the start line, a sky that warms
// beat by beat, one glowing line and the person at its head, then everyone
// else's lines arriving and the people on them walking in. Bloom catches only
// the sun, the lines and the people.
//
// Lines are Line2 (screen-space width, so they read on every GPU). Moves are
// authored tweens (fixed duration, one easing), so picture and words change
// together. The scene renders on demand: once a move and the walk-in settle,
// the GPU stops. Every geometry, material and texture made here is disposed.

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { firstMile, height, MEET, MODE_COLORS, others, ridgelines, shotsFor, SUN_DIR as SUN, type Vec3 } from "./terrain";

export interface SceneProps {
  beat: number;
  dense: boolean;
  /** False while the hero is off screen or the tab is hidden: nothing renders. */
  active: boolean;
  /** Keep the drawing buffer so a test can read pixels back (?probe=1 only; it costs a little). */
  probe?: boolean;
  onFail: (reason: string) => void;
  /** Called once, after the first frame is on screen, so the page can fade the poster out. */
  onReady?: () => void;
}

declare global {
  interface Window {
    __fl4scene?: { frames: number; renderer: string; webgl2: boolean; lines: number; disposed: number };
  }
}

/** Test and inspection counters, read by scripts/check-story.mjs. */
function stats() {
  window.__fl4scene ??= { frames: 0, renderer: "", webgl2: false, lines: 0, disposed: 0 };
  return window.__fl4scene;
}

/** Sky per beat — top, middle, horizon — matching the CSS gradient behind the canvas while it loads. */
const SKY: [string, string, string][] = [
  ["#120f1a", "#3b2433", "#7a4236"],
  ["#151120", "#56303a", "#b45c3c"],
  ["#1b1628", "#7a4038", "#de8644"],
  ["#221a30", "#a8573c", "#f6bd5a"],
];
/** Far ground fades into this; a darker, dustier horizon. */
const FOG = ["#2a1d28", "#3a2430", "#56302f", "#6b3a2e"].map((c) => new THREE.Color(c));
/** The sun sits low behind the start line. */
const SUN_DIR = new THREE.Vector3(...SUN);
const SUN_STRENGTH = [0.55, 0.8, 1.05, 1.25];

/** Camera moves take this long, whatever the distance; the words swap in the same window. */
const MOVE_SECONDS = 1.6;
const DRAW_SECONDS = 2.4;
/** The crowd walks in for this long after it appears, then everyone stands at the start. */
const WALK_SECONDS = 6.5;

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** A colour above the bloom threshold, keeping its hue (the threshold here is low: the scene is dark). */
const hot = (hex: string, k: number) => new THREE.Color(hex).multiplyScalar(k);

function flat(points: Vec3[]): number[] {
  return points.flatMap((p) => p);
}

function useDisposable<T extends { dispose: () => void }>(make: () => T, deps: unknown[]): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(make, deps);
  useEffect(
    () => () => {
      value.dispose();
      stats().disposed += 1;
    },
    [value],
  );
  return value;
}

/** The sky as a dome: a three-stop gradient and a sun glow, both eased beat to beat by the camera rig. */
function Sky({ uniforms }: { uniforms: SkyUniforms }) {
  const geometry = useDisposable(() => new THREE.SphereGeometry(150, 48, 24), []);
  const material = useDisposable(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms,
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vec4 world = modelMatrix * vec4(position, 1.0);
            vDir = normalize(world.xyz - cameraPosition);
            gl_Position = projectionMatrix * viewMatrix * world;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uHorizon; uniform vec3 uSunDir; uniform float uSun;
          varying vec3 vDir;
          void main() {
            float h = vDir.y;
            vec3 col = mix(uHorizon, uMid, smoothstep(-0.02, 0.18, h));
            col = mix(col, uTop, smoothstep(0.16, 0.62, h));
            float d = max(dot(normalize(vDir), uSunDir), 0.0);
            // A wide warm halo, a tighter glow, and a small hot disc.
            // Kept warm and below a hard clip, so the bloom stays orange instead of greying out.
            col += vec3(1.0, 0.5, 0.2) * pow(d, 14.0) * 0.42 * uSun;
            col += vec3(1.0, 0.58, 0.26) * pow(d, 220.0) * 0.75 * uSun;
            col += vec3(1.0, 0.78, 0.5) * smoothstep(0.99955, 0.99985, d) * 0.85 * uSun;
            gl_FragColor = vec4(col, 1.0);
          }`,
      }),
    [],
  );
  return <mesh geometry={geometry} material={material} renderOrder={-1} />;
}

interface SkyUniforms {
  [key: string]: THREE.IUniform;
  uTop: THREE.IUniform<THREE.Color>;
  uMid: THREE.IUniform<THREE.Color>;
  uHorizon: THREE.IUniform<THREE.Color>;
  uSunDir: THREE.IUniform<THREE.Vector3>;
  uSun: THREE.IUniform<number>;
}

function Ground() {
  const geometry = useDisposable(() => {
    // Wide enough that the top-down shot never shows the plane's edge.
    const g = new THREE.PlaneGeometry(150, 150, 160, 160);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, -26);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setY(i, height(pos.getX(i), pos.getZ(i)) - 0.03);
    g.computeVertexNormals();
    return g;
  }, []);
  const material = useDisposable(() => new THREE.MeshStandardMaterial({ color: "#3a2c36", roughness: 0.92, metalness: 0 }), []);
  return <mesh geometry={geometry} material={material} />;
}

function Ridges({ dense }: { dense: boolean }) {
  const geometry = useDisposable(() => {
    const rows = ridgelines(dense ? 52 : 34, dense ? 140 : 90);
    const pts: number[] = [];
    for (const row of rows) for (let i = 0; i < row.length - 1; i++) pts.push(...row[i]!, ...row[i + 1]!);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [dense]);
  // Contour lines catch the low sun.
  const material = useDisposable(() => new THREE.LineBasicMaterial({ color: "#c08a6c", transparent: true, opacity: 0.42 }), []);
  return <lineSegments geometry={geometry} material={material} />;
}

interface AnimatedLine {
  line: Line2;
  points: Vec3[];
  segments: number;
  delay: number;
}

function makeLine(points: Vec3[], color: THREE.Color, width: number, opacity = 1, delay = 0): AnimatedLine {
  const geometry = new LineGeometry();
  geometry.setPositions(flat(points));
  const material = new LineMaterial({ linewidth: width, transparent: opacity < 1, opacity, worldUnits: false, toneMapped: false });
  material.color.copy(color);
  const line = new Line2(geometry, material);
  line.computeLineDistances();
  geometry.instanceCount = 0;
  return { line, points, segments: points.length - 1, delay };
}

function disposeLine(l: AnimatedLine) {
  l.line.geometry.dispose();
  (l.line.material as LineMaterial).dispose();
  stats().disposed += 1;
}

/** A point a fraction of the way along a sampled line. */
function along(points: Vec3[], u: number, out: THREE.Vector3): THREE.Vector3 {
  const f = Math.min(0.9999, Math.max(0, u)) * (points.length - 1);
  const i = Math.floor(f);
  const a = points[i]!;
  const b = points[i + 1]!;
  const k = f - i;
  return out.set(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k + 0.11, a[2] + (b[2] - a[2]) * k);
}

/** Where each line should be drawn to at a beat (0..1). */
function mainTarget(beat: number) {
  return beat === 0 ? 0.42 : 1;
}

/** Everyone on the crowd lines: walkers at different places, all heading for the start. */
interface Walker {
  line: number;
  from: number;
  to: number;
  delay: number;
}

function Lines({ beat, dense }: { beat: number; dense: boolean }) {
  const { size, invalidate } = useThree();
  const main = useMemo(() => makeLine(firstMile(), hot("#f3812b", 2.1), 4.6), []);
  const crowd = useMemo(() => others(dense ? 54 : 26).map((o) => makeLine(o.points, hot(MODE_COLORS[o.mode], 1.15), 1.9, 0.9, o.delay)), [dense]);
  const walkers = useMemo<Walker[]>(() => {
    const out: Walker[] = [];
    crowd.forEach((c, i) => {
      // Two or three people per line, spread out, each stopping just short of the start.
      const n = 2 + (i % 2);
      for (let k = 0; k < n; k++) out.push({ line: i, from: 0.12 + k * 0.22 + (i % 5) * 0.02, to: 0.9 + k * 0.025, delay: c.delay * 0.8 + k * 0.25 });
    });
    return out;
  }, [crowd]);

  const ring = useMemo(() => {
    const g = new THREE.RingGeometry(0.9, 1.18, 64);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.MeshBasicMaterial({ color: hot("#f2b544", 2.2), transparent: true, opacity: 0, side: THREE.DoubleSide, toneMapped: false });
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(MEET[0], height(MEET[0], MEET[2]) + 0.08, MEET[2]);
    return mesh;
  }, []);
  const beam = useMemo(() => {
    // A soft column of light over the start line, fading upward.
    const g = new THREE.CylinderGeometry(0.55, 0.9, 9, 40, 1, true);
    g.translate(0, 4.5, 0);
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uOpacity: { value: 0 }, uColor: { value: hot("#f2b544", 1.6) } },
      vertexShader: /* glsl */ `varying float vH; void main(){ vH = position.y / 9.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `uniform float uOpacity; uniform vec3 uColor; varying float vH; void main(){ gl_FragColor = vec4(uColor, (1.0 - vH) * (1.0 - vH) * 0.5 * uOpacity); }`,
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(MEET[0], height(MEET[0], MEET[2]), MEET[2]);
    return mesh;
  }, []);
  const people = useMemo(() => {
    const g = new THREE.SphereGeometry(0.1, 12, 10);
    const m = new THREE.MeshBasicMaterial({ color: hot("#fbe3b5", 1.9), toneMapped: false });
    const mesh = new THREE.InstancedMesh(g, m, walkers.length + 1);
    mesh.frustumCulled = false;
    return mesh;
  }, [walkers]);
  const head = useMemo(() => {
    // The one person whose first mile this is.
    const g = new THREE.SphereGeometry(0.17, 20, 14);
    const m = new THREE.MeshBasicMaterial({ color: hot("#ffd2a1", 2.6), toneMapped: false });
    return new THREE.Mesh(g, m);
  }, []);

  const started = useRef<number | null>(null);
  const walkStarted = useRef<number | null>(null);
  const progress = useRef({ main: 0, crowd: 0, ring: 0 });
  const from = useRef({ main: 0, crowd: 0, ring: 0 });
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const matrix = useMemo(() => new THREE.Matrix4(), []);

  useEffect(() => {
    stats().lines = crowd.length + 1;
    return () => {
      disposeLine(main);
      for (const c of crowd) disposeLine(c);
      for (const m of [ring, beam, head]) {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
      people.geometry.dispose();
      (people.material as THREE.Material).dispose();
      people.dispose();
      stats().disposed += 1;
    };
  }, [main, crowd, ring, beam, head, people]);

  useEffect(() => {
    for (const l of [main, ...crowd]) (l.line.material as LineMaterial).resolution.set(size.width, size.height);
    invalidate();
  }, [size, main, crowd, invalidate]);

  useEffect(() => {
    from.current = { ...progress.current };
    started.current = null;
    if (beat < 2) walkStarted.current = null;
    invalidate();
  }, [beat, invalidate]);

  useFrame((state) => {
    const now = state.clock.elapsedTime;
    if (started.current === null) started.current = now;
    const t = Math.min(1, (now - started.current) / DRAW_SECONDS);
    const k = easeInOut(t);
    const targets = { main: mainTarget(beat), crowd: beat >= 2 ? 1 : 0, ring: beat >= 2 ? 1 : 0 };
    progress.current = {
      main: from.current.main + (targets.main - from.current.main) * k,
      crowd: from.current.crowd + (targets.crowd - from.current.crowd) * k,
      ring: from.current.ring + (targets.ring - from.current.ring) * k,
    };
    main.line.geometry.instanceCount = Math.max(1, Math.round(progress.current.main * main.segments));
    along(main.points, progress.current.main, tmp);
    head.position.copy(tmp).setY(tmp.y + 0.08);

    const drawn: number[] = [];
    for (const c of crowd) {
      // Each line starts a little later, so the crowd arrives instead of appearing.
      const local = Math.min(1, Math.max(0, (progress.current.crowd - c.delay * 0.45) / (1 - 0.45 * 0.55)));
      c.line.geometry.instanceCount = Math.round(local * c.segments);
      drawn.push(local);
    }
    (ring.material as THREE.MeshBasicMaterial).opacity = progress.current.ring * 0.95;
    (beam.material as THREE.ShaderMaterial).uniforms.uOpacity!.value = progress.current.ring;

    // The walk-in: once the crowd is on screen, everyone moves toward the start, then stops.
    if (beat >= 2 && walkStarted.current === null && progress.current.crowd > 0.6) walkStarted.current = now;
    const walked = walkStarted.current === null ? 0 : now - walkStarted.current;
    walkers.forEach((w, i) => {
      const local = drawn[w.line] ?? 0;
      const p = easeOut(Math.min(1, Math.max(0, (walked - w.delay) / WALK_SECONDS)));
      // Nobody stands further along than their line has been drawn.
      const u = Math.min(local, w.from + (w.to - w.from) * p);
      along(crowd[w.line]!.points, u, tmp);
      const visible = local > w.from ? 1 : 0;
      matrix.makeScale(visible, visible, visible).setPosition(tmp);
      people.setMatrixAt(i, matrix);
    });
    people.setMatrixAt(walkers.length, matrix.makeScale(0, 0, 0));
    people.instanceMatrix.needsUpdate = true;

    const walking = walkStarted.current !== null && walked < WALK_SECONDS + 1.6;
    if (t < 1 || walking) state.invalidate();
  });

  return (
    <>
      <primitive object={main.line} />
      {crowd.map((c, i) => (
        <primitive key={i} object={c.line} />
      ))}
      <primitive object={ring} />
      <primitive object={beam} />
      <primitive object={people} />
      <primitive object={head} />
    </>
  );
}

function CameraRig({ beat, sky }: { beat: number; sky: SkyUniforms }) {
  const { camera, scene, size, invalidate } = useThree();
  const portrait = size.width / Math.max(1, size.height) < 0.9;
  const shots = useMemo(() => shotsFor(portrait), [portrait]);
  const target = useRef(new THREE.Vector3(...shots[0]!.target));
  const palette = useMemo(() => SKY.map((s) => s.map((c) => new THREE.Color(c)) as [THREE.Color, THREE.Color, THREE.Color]), []);
  const start = useRef<{ t: number | null; pos: THREE.Vector3; look: THREE.Vector3; fov: number; fog: THREE.Color; sky: THREE.Color[]; sun: number } | null>(null);
  const first = useRef(true);

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    if (first.current) {
      // The first frame is composed, not travelled to.
      const s = shots[beat]!;
      cam.position.set(...s.position);
      target.current.set(...s.target);
      cam.fov = s.fov;
      cam.lookAt(target.current);
      cam.updateProjectionMatrix();
      sky.uTop.value.copy(palette[beat]![0]);
      sky.uMid.value.copy(palette[beat]![1]);
      sky.uHorizon.value.copy(palette[beat]![2]);
      sky.uSun.value = SUN_STRENGTH[beat]!;
      first.current = false;
      start.current = null;
    } else {
      const fog = (scene.fog as THREE.Fog | null)?.color.clone() ?? new THREE.Color();
      start.current = {
        t: null,
        pos: cam.position.clone(),
        look: target.current.clone(),
        fov: cam.fov,
        fog,
        sky: [sky.uTop.value.clone(), sky.uMid.value.clone(), sky.uHorizon.value.clone()],
        sun: sky.uSun.value,
      };
    }
    invalidate();
  }, [beat, shots, camera, scene, invalidate, palette, sky]);

  useFrame((state) => {
    const cam = camera as THREE.PerspectiveCamera;
    const b = Math.min(beat, shots.length - 1);
    const s = shots[b]!;
    const fog = scene.fog as THREE.Fog | null;
    const wantFog = FOG[Math.min(beat, FOG.length - 1)]!;
    const from = start.current;
    if (from) {
      if (from.t === null) from.t = state.clock.elapsedTime;
      const t = Math.min(1, (state.clock.elapsedTime - from.t) / MOVE_SECONDS);
      const k = easeInOut(t);
      cam.position.set(
        from.pos.x + (s.position[0] - from.pos.x) * k,
        from.pos.y + (s.position[1] - from.pos.y) * k,
        from.pos.z + (s.position[2] - from.pos.z) * k,
      );
      target.current.set(from.look.x + (s.target[0] - from.look.x) * k, from.look.y + (s.target[1] - from.look.y) * k, from.look.z + (s.target[2] - from.look.z) * k);
      cam.fov = from.fov + (s.fov - from.fov) * k;
      if (fog) fog.color.copy(from.fog).lerp(wantFog, k);
      sky.uTop.value.copy(from.sky[0]!).lerp(palette[b]![0], k);
      sky.uMid.value.copy(from.sky[1]!).lerp(palette[b]![1], k);
      sky.uHorizon.value.copy(from.sky[2]!).lerp(palette[b]![2], k);
      sky.uSun.value = from.sun + (SUN_STRENGTH[b]! - from.sun) * k;
      if (t < 1) state.invalidate();
      else start.current = null;
    } else if (fog) fog.color.copy(wantFog);
    cam.lookAt(target.current);
    cam.updateProjectionMatrix();
    stats().frames += 1;
  });
  return null;
}

function Probe({ onFail, onReady }: { onFail: (reason: string) => void; onReady?: () => void }) {
  const { gl } = useThree();
  const told = useRef(false);
  // Two animation frames after the first one renders, it has been presented.
  useFrame(() => {
    if (told.current || !onReady) return;
    told.current = true;
    requestAnimationFrame(() => requestAnimationFrame(onReady));
  });
  useEffect(() => {
    const ctx = gl.getContext();
    const debug = ctx.getExtension("WEBGL_debug_renderer_info");
    const renderer = debug ? String(ctx.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : String(ctx.getParameter(ctx.RENDERER));
    const s = stats();
    s.renderer = renderer;
    s.webgl2 = gl.capabilities.isWebGL2;
    const canvas = gl.domElement;
    const lost = (e: Event) => {
      e.preventDefault();
      onFail("lost");
    };
    canvas.addEventListener("webglcontextlost", lost);
    return () => canvas.removeEventListener("webglcontextlost", lost);
  }, [gl, onFail]);
  return null;
}

export default function FirstStepScene({ beat, dense, active, probe = false, onFail, onReady }: SceneProps) {
  const sky = useMemo<SkyUniforms>(
    () => ({
      uTop: { value: new THREE.Color(SKY[0]![0]) },
      uMid: { value: new THREE.Color(SKY[0]![1]) },
      uHorizon: { value: new THREE.Color(SKY[0]![2]) },
      uSunDir: { value: SUN_DIR.clone() },
      uSun: { value: SUN_STRENGTH[0]! },
    }),
    [],
  );
  return (
    <Canvas
      flat
      frameloop={active ? "demand" : "never"}
      dpr={[1, dense ? 1.75 : 1.4]}
      gl={{ antialias: false, alpha: false, stencil: false, powerPreference: "high-performance", preserveDrawingBuffer: probe }}
      camera={{ position: shotsFor(false)[0]!.position, fov: 46, near: 0.1, far: 320 }}
      aria-hidden
    >
      <color attach="background" args={[SKY[0]![2]]} />
      <fog attach="fog" args={["#2a1d28", 14, 96]} />
      <hemisphereLight args={["#f6b26b", "#1a1420", 0.65]} />
      {/* The sun: low, behind the start line, so every hill has a lit edge facing the viewer's way. */}
      <directionalLight position={SUN_DIR.clone().multiplyScalar(60).toArray()} intensity={2.2} color="#ffb070" />
      <directionalLight position={[-20, 12, 20]} intensity={0.32} color="#9d92d6" />
      <Sky uniforms={sky} />
      <Ground />
      <Ridges dense={dense} />
      <Lines beat={beat} dense={dense} />
      <CameraRig beat={beat} sky={sky} />
      <EffectComposer multisampling={dense ? 4 : 0} enableNormalPass={false}>
        <Bloom mipmapBlur intensity={0.95} luminanceThreshold={0.6} luminanceSmoothing={0.2} radius={0.7} />
        <Vignette eskil={false} offset={0.32} darkness={0.55} />
        <Noise opacity={0.04} premultiply />
      </EffectComposer>
      <Probe onFail={onFail} onReady={onReady} />
    </Canvas>
  );
}
