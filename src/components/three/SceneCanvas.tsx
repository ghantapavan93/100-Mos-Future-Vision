"use client";

// The one Canvas every lens scene draws in. It owns the rules a scene would
// otherwise get wrong on its own:
//  - Render on demand. A scene moves for a short "ambient" window after it
//    mounts, after its data changes and while the pointer moves, then settles
//    and the GPU stops. `still` (reduced motion, or the header's pause) means
//    settled frames only.
//  - Colours are the page's colours: no tone mapping (`flat`), so a hex from
//    palette.ts on screen is the same hex as the CSS token beside it.
//  - Light post-processing: a vignette, a little grain, and bloom that catches
//    only colours brighter than white — made with `glowColor()` on a material
//    with `toneMapped={false}` — so a light page never washes out.
//  - Counters in `window.__fl4scenes[name]` that scripts/check-scenes.mjs and
//    the on-device check (/device-check) read, frame times included.
//  - Cost follows the device: the Stage's tier sets the pixel ratio and the
//    post-processing, and if frames still drop, the canvas steps down once more.
//  - `onReady` fires once the first frame is on screen, so the Stage can swap
//    its poster for the live canvas.
// Import this only from scene files, which lenses load with next/dynamic.

import { Canvas, useFrame, useThree, type CameraProps } from "@react-three/fiber";
import { Bloom, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import * as THREE from "three";
import type { StageProps, Tier } from "./Stage";

export interface SceneStats {
  frames: number;
  renderer: string;
  webgl2: boolean;
  mounted: boolean;
  mounts: number;
  calls: number;
  triangles: number;
  /** The latest back-to-back frame intervals in ms (idle gaps left out), newest last, at most FRAME_LOG long. */
  frameMs: number[];
  /** True once frames ran slow and the canvas stepped down a tier. */
  stepped: boolean;
}

/** How many recent frame intervals each scene keeps for diagnostics. */
const FRAME_LOG = 240;

declare global {
  interface Window {
    __fl4scenes?: Record<string, SceneStats>;
  }
}

export function sceneStats(name: string): SceneStats {
  window.__fl4scenes ??= {};
  window.__fl4scenes[name] ??= { frames: 0, renderer: "", webgl2: false, mounted: false, mounts: 0, calls: 0, triangles: 0, frameMs: [], stepped: false };
  return window.__fl4scenes[name];
}

/** How long a scene keeps moving after something happens, before it settles. */
export const AMBIENT_SECONDS = 8;
/**
 * Largest time step a scene should animate by. After an idle stretch the first
 * frame's delta is the whole idle time; clamping it keeps the next transition a
 * transition instead of a jump. A quarter second, not a frame: on a slow GPU
 * (4 fps in software rendering) a tighter clamp makes transitions outlast the
 * ambient window.
 */
export const MAX_DT = 0.25;

/**
 * When any `approach()` last had somewhere left to go. While values are still
 * travelling the scene keeps drawing, ambient window or not, so no transition
 * ever stops half-way. One canvas per page, so module scope is enough.
 */
let unsettledAt = -Infinity;
const SETTLE_GRACE_MS = 150;

interface Motion {
  still: boolean;
  /** Keep moving for `seconds` more (default AMBIENT_SECONDS). Draws one frame when still. */
  kick: (seconds?: number) => void;
  /** Pointer over the page, -1..1 across the canvas (x right, y up), for parallax. */
  pointer: MutableRefObject<{ x: number; y: number }>;
  /** The clock time the scene went live (stopped being still); null while still. */
  liveSince: MutableRefObject<number | null>;
}

const MotionContext = createContext<Motion>({ still: true, kick: () => {}, pointer: { current: { x: 0, y: 0 } }, liveSince: { current: null } });

/** The scene's motion state: whether it may move, how to wake it, where the pointer is. */
export const useMotion = () => useContext(MotionContext);

/**
 * Seconds since the scene went live: 0 while still, including the settled first
 * frame the Stage crossfades from. Time-based motion (pulses, bobs, flowing
 * lights) built on this with its still pose at t = 0 never jumps at the hand-over.
 * Call the returned function with `state.clock.elapsedTime` inside useFrame.
 */
export function useLiveClock(): (elapsed: number) => number {
  const { liveSince } = useMotion();
  return (elapsed: number) => (liveSince.current === null ? 0 : Math.max(0, elapsed - liveSince.current));
}

/**
 * Wake the scene when any of `deps` changes, so data changes animate in.
 * Use it for everything a scene draws from the world.
 */
export function useKickOn(deps: unknown[]) {
  const { kick } = useMotion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => kick(), deps);
}

/**
 * A colour brighter than the bloom threshold, for things that should glow. Use
 * on materials with `toneMapped={false}`. Strength multiplies the linear colour:
 * saturated orange needs about 3 to cross the default threshold of 1 (its core
 * then reads hot, nearly yellow); on dark scenes pass a lower `threshold` to
 * SceneCanvas instead and keep strength near 2, so glows keep their hue.
 */
export function glowColor(hex: string, strength = 3): THREE.Color {
  return new THREE.Color(hex).multiplyScalar(strength);
}

/**
 * Exponential approach that is frame-rate independent; jumps straight there
 * when still. Until it lands, the scene keeps drawing (see `unsettledAt`).
 */
export function approach(current: number, target: number, delta: number, still: boolean, smoothTime = 0.45): number {
  if (still) return target;
  const dt = Math.min(delta, MAX_DT);
  const k = 1 - Math.exp(-dt / Math.max(0.0001, smoothTime / 4));
  const next = current + (target - current) * k;
  if (Math.abs(target - next) < 1e-4 * Math.max(1, Math.abs(target))) return target;
  unsettledAt = performance.now();
  return next;
}

/**
 * Moves the scene's subject on screen without moving the camera (a view offset):
 * to the right of the hero's words on wide screens, above them on narrow or
 * portrait ones. All values are fractions of the canvas: `right` and `lift`
 * apply when words and scene sit side by side, `up` when the words sit below.
 */
export function Composition({ right = 0.2, up = 0.2, lift = 0 }: { right?: number; up?: number; lift?: number }) {
  const { camera, size, invalidate } = useThree();
  useLayoutEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const sideBySide = size.width >= 1024 && size.width / Math.max(1, size.height) >= 0.9;
    const ox = sideBySide ? -right * size.width : 0;
    const oy = (sideBySide ? lift : up) * size.height;
    cam.setViewOffset(size.width, size.height, ox, oy, size.width, size.height);
    cam.updateProjectionMatrix();
    invalidate();
    return () => {
      cam.clearViewOffset();
      cam.updateProjectionMatrix();
    };
  }, [camera, size, right, up, lift, invalidate]);
  return null;
}

/** True when the canvas is taller than wide (phones upright): frame the subject for that. */
export function usePortrait(): boolean {
  const { size } = useThree();
  return size.width / Math.max(1, size.height) < 0.9;
}

function MotionProvider({ still, active, children }: { still: boolean; active: boolean; children: ReactNode }) {
  const { clock, invalidate, gl } = useThree();
  const until = useRef(0);
  const pointer = useRef({ x: 0, y: 0 });
  const liveSince = useRef<number | null>(null);
  // Before the value below is rebuilt, so the first live frame already reads t ≈ 0.
  if (still) liveSince.current = null;
  else if (liveSince.current === null) liveSince.current = clock.elapsedTime;

  const value = useMemo<Motion>(
    () => ({
      still,
      kick: (seconds = AMBIENT_SECONDS) => {
        if (!still) until.current = Math.max(until.current, clock.elapsedTime + seconds);
        invalidate();
      },
      pointer,
      liveSince,
    }),
    [still, clock, invalidate],
  );

  // Coming on screen (or un-pausing) draws a frame and opens a short ambient window.
  useEffect(() => {
    if (active) value.kick();
  }, [active, value]);

  // The hero's words sit over the canvas, so follow the pointer on the window, not the canvas.
  useEffect(() => {
    if (still) return;
    const move = (e: PointerEvent) => {
      const r = gl.domElement.getBoundingClientRect();
      if (e.clientY < r.top || e.clientY > r.bottom) return;
      pointer.current = { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -(((e.clientY - r.top) / r.height) * 2 - 1) };
      value.kick(2.5);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [still, gl, value]);

  useFrame((state) => {
    if (still) return;
    const ambient = state.clock.elapsedTime < until.current;
    const travelling = performance.now() - unsettledAt < SETTLE_GRACE_MS;
    if (ambient || travelling) state.invalidate();
  });

  return <MotionContext.Provider value={value}>{children}</MotionContext.Provider>;
}

function Instrument({ name, onFail, onReady }: { name: string; onFail: (reason: string) => void; onReady: () => void }) {
  const { gl } = useThree();
  const told = useRef(false);
  useEffect(() => {
    const s = sceneStats(name);
    const ctx = gl.getContext();
    const debug = ctx.getExtension("WEBGL_debug_renderer_info");
    s.renderer = debug ? String(ctx.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : String(ctx.getParameter(ctx.RENDERER));
    s.webgl2 = gl.capabilities.isWebGL2;
    s.mounted = true;
    s.mounts += 1;
    // Count every pass of a frame (scene, shadows, post-processing), not just the last one.
    gl.info.autoReset = false;
    const canvas = gl.domElement;
    const lost = (e: Event) => {
      e.preventDefault();
      onFail("lost");
    };
    canvas.addEventListener("webglcontextlost", lost);
    return () => {
      canvas.removeEventListener("webglcontextlost", lost);
      s.mounted = false;
    };
  }, [gl, name, onFail]);
  // Runs before the frame renders: record the previous frame's totals, then start counting afresh.
  useFrame(() => {
    const s = sceneStats(name);
    s.frames += 1;
    // Two animation frames on, this frame has been presented.
    if (!told.current) {
      told.current = true;
      requestAnimationFrame(() => requestAnimationFrame(onReady));
    }
    if (gl.info.render.calls > 0) {
      s.calls = gl.info.render.calls;
      s.triangles = gl.info.render.triangles;
    }
    gl.info.reset();
  });
  return null;
}

export interface SceneCanvasProps extends StageProps {
  /** Same as the Stage's name. */
  name: string;
  /** Opaque background, normally the page colour so the canvas edge disappears. */
  background: string;
  camera: CameraProps;
  children: ReactNode;
  /** Bloom strength on colours above `threshold` (see `glowColor`). */
  glow?: number;
  /**
   * Luminance above which things bloom. Keep 1 on light pages (their background
   * is nearly white and would wash out); dark scenes can use ~0.45.
   */
  threshold?: number;
  /** Vignette darkness, 0..1. */
  vignette?: number;
  /** Film grain opacity. */
  grain?: number;
  shadows?: boolean;
}

/**
 * Watches frames drawn back to back (the ambient window, a transition) and
 * calls `onSlow` once if they run under ~40 fps. Gaps between on-demand frames
 * are idle time, not slowness, so any interval over 200 ms is ignored.
 */
function FrameBudget({ name, onSlow }: { name: string; onSlow: () => void }) {
  const intervals = useRef<number[]>([]);
  const done = useRef(false);
  useFrame((_, delta) => {
    if (delta <= 0 || delta > 0.2) return;
    // Every back-to-back frame goes in the scene's log, before and after any step-down.
    const log = sceneStats(name).frameMs;
    log.push(Math.round(delta * 10000) / 10);
    if (log.length > FRAME_LOG) log.splice(0, log.length - FRAME_LOG);
    if (done.current) return;
    intervals.current.push(delta);
    if (intervals.current.length < 90) return;
    const sorted = [...intervals.current].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)]!;
    intervals.current = [];
    if (median > 1 / 40) {
      done.current = true;
      onSlow();
    }
  });
  return null;
}

/** Pixel ratio range and MSAA samples per tier. The page's own CSS grain covers the film look below "high". */
const QUALITY: Record<Tier, { dpr: [number, number]; samples: number; grain: boolean }> = {
  high: { dpr: [1, 1.75], samples: 4, grain: true },
  mid: { dpr: [1, 1.5], samples: 2, grain: false },
  low: { dpr: [1, 1], samples: 0, grain: false },
};

export function SceneCanvas({ name, active, still, probe, onFail, onReady, tier, background, camera, children, glow = 0.8, threshold = 1, vignette = 0.45, grain = 0.03, shadows = false }: SceneCanvasProps) {
  // Frames dropping on a busy machine: step down one tier, once, and stay there.
  const [stepped, setStepped] = useState(false);
  const q = QUALITY[stepped ? (tier === "high" ? "mid" : "low") : tier];
  return (
    <Canvas
      flat
      shadows={shadows ? "percentage" : false}
      frameloop={active ? "demand" : "never"}
      dpr={q.dpr}
      gl={{ antialias: false, alpha: false, stencil: false, powerPreference: "high-performance", preserveDrawingBuffer: probe }}
      camera={camera}
      style={{ position: "absolute", inset: 0 }}
    >
      <FrameBudget
        name={name}
        onSlow={() => {
          sceneStats(name).stepped = true;
          setStepped(true);
        }}
      />
      <color attach="background" args={[background]} />
      <MotionProvider still={still} active={active}>
        {children}
      </MotionProvider>
      <EffectComposer multisampling={q.samples} enableNormalPass={false}>
        <Bloom mipmapBlur intensity={glow} luminanceThreshold={threshold} luminanceSmoothing={0.15} radius={0.72} />
        <Vignette eskil={false} offset={0.3} darkness={vignette} />
        {q.grain ? <Noise opacity={grain} premultiply /> : <></>}
      </EffectComposer>
      <Instrument name={name} onFail={onFail} onReady={onReady} />
    </Canvas>
  );
}
