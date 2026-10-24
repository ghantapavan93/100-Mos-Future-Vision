"use client";

// Where a lens puts real-time 3D on screen. The Stage decides the things the
// scenes never decide for themselves:
//  - whether WebGL runs at all (support, a lost context): if not, the poster
//    stays and the page still reads, because every scene's facts are also text;
//  - how hard it works: a quality tier from the GPU and device, so a phone or a
//    software renderer gets fewer pixels and passes instead of dropped frames;
//  - what shows before the first frame: a full-frame poster of the same scene,
//    on screen with the HTML, that crossfades to the live canvas once it has
//    drawn — so a hero is never an empty black box while three.js loads;
//  - whether it moves: the OS "reduce motion" setting and the header's pause
//    both mean `still`. Every scene also draws its first frame settled, so the
//    crossfade lands on the same picture the poster shows, with no jump;
//  - whether it draws: only while on screen and the tab is visible.
// Scenes load as their own chunk (next/dynamic in the lens), so three.js is
// fetched only by pages that show one.

import { useCallback, useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { cn } from "@/components/ui/kit";
import { useLedger, useUI } from "@/lib/store";

/** How much a device can draw: pixel ratio and post-processing follow it. */
export type Tier = "high" | "mid" | "low";

/** What every scene receives from its Stage. */
export interface StageProps {
  /** On screen and the tab visible: the scene may draw. */
  active: boolean;
  /** No autonomous motion: render settled frames only. */
  still: boolean;
  /** Keep the drawing buffer so a test can read pixels (`?probe=1` only). */
  probe: boolean;
  onFail: (reason: string) => void;
  /** Called once, after the first frame is on screen. */
  onReady: () => void;
  tier: Tier;
}

type Render = "pending" | "webgl" | "fallback";

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduced;
}

let probed: { ok: boolean; tier: Tier } | null = null;

/** One throwaway context per page load: can WebGL run, and on what. Cached, and the context is released. */
export function probeGpu(): { ok: boolean; tier: Tier } {
  if (probed) return probed;
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl2") ?? c.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return (probed = { ok: false, tier: "low" });
    const debug = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = String(debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    const software = /swiftshader|llvmpipe|software|basic render/i.test(renderer);
    const cores = navigator.hardwareConcurrency ?? 4;
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
    const phone = window.matchMedia("(pointer: coarse)").matches && Math.min(window.screen.width, window.screen.height) < 820;
    const tier: Tier = software || cores <= 2 ? "low" : phone || memory <= 4 ? "mid" : "high";
    return (probed = { ok: true, tier });
  } catch {
    return (probed = { ok: false, tier: "low" });
  }
}

export function Stage<P extends object>({
  name,
  scene: Scene,
  props,
  fallback,
  poster = true,
  className,
}: {
  /** Stable id: `data-stage` on the element, the key in `window.__fl4scenes`, and the poster's file name. */
  name: string;
  scene: ComponentType<P & StageProps>;
  props: P;
  /** Shown behind the poster when WebGL can't run. */
  fallback?: ReactNode;
  /** `public/posters/<name>-wide.webp` and `-tall.webp` (scripts/render-stills.mjs). False for a scene without one. */
  poster?: boolean;
  className?: string;
}) {
  const reducedOS = useReducedMotion();
  const { motionPaused } = useUI();
  const ref = useRef<HTMLDivElement>(null);
  const [render, setRender] = useState<Render>("pending");
  const [failure, setFailure] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const [probe, setProbe] = useState(false);
  const [tier, setTier] = useState<Tier>("high");
  const [ready, setReady] = useState(false);
  // A scene whose poster hasn't been rendered yet shows nothing there, never a broken-image icon.
  const [posterMissing, setPosterMissing] = useState(false);
  // Posters are pictures of the untouched demo. Once anything has happened, a
  // poster would show old numbers beside new ones, so the live scene fades in
  // from the page colour instead.
  const pristine = useLedger().length === 0;
  const [posterFits, setPosterFits] = useState(true);
  useEffect(() => {
    if (!pristine) setPosterFits(false);
  }, [pristine]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setProbe(params.get("probe") === "1");
    const gpu = probeGpu();
    // `?tier=high` lets scripts/render-stills.mjs capture sharp posters in a software renderer.
    const forced = params.get("tier");
    setTier(forced === "high" || forced === "mid" || forced === "low" ? forced : gpu.tier);
    if (params.get("still") === "1" || !gpu.ok) {
      setFailure(params.get("still") === "1" ? "forced" : "unsupported");
      setRender("fallback");
    } else setRender("webgl");
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let visible = false;
    const sync = () => setActive(visible && document.visibilityState === "visible");
    const io = new IntersectionObserver(
      ([e]) => {
        visible = Boolean(e?.isIntersecting);
        sync();
      },
      { threshold: 0.02 },
    );
    io.observe(el);
    document.addEventListener("visibilitychange", sync);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  const onFail = useCallback((reason: string) => {
    setFailure(reason);
    setRender("fallback");
  }, []);
  const onReady = useCallback(() => setReady(true), []);

  const still = reducedOS || motionPaused;
  const live = render === "webgl" && ready;
  return (
    <div
      ref={ref}
      aria-hidden
      data-stage={name}
      data-render={render}
      data-ready={live ? "true" : "false"}
      data-tier={tier}
      data-still={still ? "true" : "false"}
      data-failure={failure ?? undefined}
      className={cn("relative h-full w-full", className)}
    >
      {render === "fallback" ? fallback ?? null : null}
      {poster && !posterMissing ? (
        <picture className={cn("pointer-events-none absolute inset-0 transition-opacity duration-700 ease-out", live || !posterFits ? "opacity-0" : "opacity-100")}>
          {/* Same frame as the live scene: phones get the upright one. */}
          <source media="(max-aspect-ratio: 9/10)" srcSet={`/posters/${name}-tall.webp`} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/posters/${name}-wide.webp`} alt="" decoding="async" fetchPriority="high" onError={() => setPosterMissing(true)} className="h-full w-full object-cover" />
        </picture>
      ) : null}
      {render === "webgl" ? (
        <div className={cn("absolute inset-0 transition-opacity duration-700 ease-out", live ? "opacity-100" : "opacity-0")}>
          {/* Settled until the first frame is up, so the crossfade meets the poster's picture. */}
          <Scene {...props} active={active} still={still || !ready} probe={probe} onFail={onFail} onReady={onReady} tier={tier} />
        </div>
      ) : null}
    </div>
  );
}
