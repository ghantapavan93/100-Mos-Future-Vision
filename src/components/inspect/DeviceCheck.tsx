"use client";

// The on-device 3D check (/device-check): open it on a real phone and it loads
// every screen in turn, full size, and measures what a visitor feels — how fast
// the poster paints, how fast the live 3D takes over, which quality tier the
// device got, how smooth the frames run and whether anything errors. Results
// show on screen and go to /api/device-report, which only logs them, so a
// developer can read a real phone's numbers without standing beside it.

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/components/ui/kit";

const SCREENS: { route: string; label: string }[] = [
  { route: "/", label: "Home" },
  { route: "/member", label: "Member" },
  { route: "/circles", label: "Circles" },
  { route: "/coach", label: "AI Coach" },
  { route: "/founder", label: "Kayla's week" },
  { route: "/partner", label: "Sponsors" },
  { route: "/future", label: "Next 3 summers" },
  { route: "/vision", label: "Big picture" },
  { route: "/impact", label: "Giving back" },
  { route: "/xray", label: "How miles count" },
  { route: "/build", label: "Roadmap" },
];

/** How long one screen may take to go live before it counts as never. */
const TIMEOUT_MS = 30_000;
/** How long frames are watched once a screen is live: long enough to see its opening motion. */
const WATCH_MS = 5_000;

export interface ScreenResult {
  route: string;
  label: string;
  /** Poster painted, ms after the screen started loading; null if none showed. */
  posterMs: number | null;
  /** Live 3D's first frame, ms after start; null if it never went live. */
  liveMs: number | null;
  render: string | null;
  tier: string | null;
  failure: string | null;
  /** GPU frames drawn back to back while watched: median and 95th percentile, ms. */
  frameMedianMs: number | null;
  frameP95Ms: number | null;
  frames: number;
  /** Frames over 50 ms (visible stutter) among those. */
  slowFrames: number;
  /** True if the canvas stepped down a tier because frames ran slow. */
  stepped: boolean;
  /** Longest gap between browser frames while the screen loaded and settled (main-thread jank), ms. */
  longestGapMs: number;
  triangles: number;
  errors: string[];
}

export interface DeviceInfo {
  userAgent: string;
  renderer: string;
  webgl2: boolean;
  maxTexture: number;
  dpr: number;
  viewport: string;
  screen: string;
  cores: number | null;
  memoryGb: number | null;
  reducedMotion: boolean;
  connection: string | null;
}

function deviceInfo(): DeviceInfo {
  const c = document.createElement("canvas");
  const gl = (c.getContext("webgl2") ?? c.getContext("webgl")) as WebGLRenderingContext | null;
  const debug = gl?.getExtension("WEBGL_debug_renderer_info");
  const info: DeviceInfo = {
    userAgent: navigator.userAgent,
    renderer: gl ? String(debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) : "no WebGL",
    webgl2: typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext,
    maxTexture: gl ? Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) : 0,
    dpr: window.devicePixelRatio,
    viewport: `${window.innerWidth}×${window.innerHeight}`,
    screen: `${window.screen.width}×${window.screen.height}`,
    cores: navigator.hardwareConcurrency ?? null,
    memoryGb: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null,
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    connection: (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType ?? null,
  };
  gl?.getExtension("WEBGL_lose_context")?.loseContext();
  return info;
}

const percentile = (xs: number[], p: number) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))]! * 10) / 10;
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

type SceneWindow = Window & { __fl4scenes?: Record<string, { frameMs: number[]; stepped: boolean; triangles: number }> };

/** Loads one screen in `frame` and measures it. Resolves once it is live (and watched) or has timed out. */
async function measure(frame: HTMLIFrameElement, screen: (typeof SCREENS)[number]): Promise<ScreenResult> {
  const r: ScreenResult = { ...screen, posterMs: null, liveMs: null, render: null, tier: null, failure: null, frameMedianMs: null, frameP95Ms: null, frames: 0, slowFrames: 0, stepped: false, longestGapMs: 0, triangles: 0, errors: [] };
  const t0 = performance.now();
  frame.src = screen.route;
  let hooked: Window | null = null;
  let lastTick = 0;
  let stopTicks = false;

  // Hooks the screen's own window once it exists: its errors, and a frame clock for jank.
  const hook = () => {
    const win = frame.contentWindow;
    if (!win || win === hooked || win.location.href === "about:blank" || win.document.readyState === "loading") return;
    hooked = win;
    // The first few errors say what broke; a flood of repeats would only bloat the report.
    const note = (message: string) => r.errors.length < 10 && r.errors.push(message.slice(0, 200));
    win.addEventListener("error", (e) => note(String(e.message)));
    win.addEventListener("unhandledrejection", (e) => note(String((e as PromiseRejectionEvent).reason)));
    const tick = (now: number) => {
      if (lastTick) r.longestGapMs = Math.max(r.longestGapMs, Math.round(now - lastTick));
      lastTick = now;
      if (!stopTicks) win.requestAnimationFrame(tick);
    };
    win.requestAnimationFrame(tick);
  };

  while (performance.now() - t0 < TIMEOUT_MS) {
    await wait(50);
    hook();
    const doc = frame.contentDocument;
    if (!doc) continue;
    const stage = doc.querySelector<HTMLElement>("[data-stage]");
    const dawn = doc.querySelector<HTMLElement>("section[data-scene-ready]");
    const img = (stage ?? dawn)?.querySelector<HTMLImageElement>("picture img");
    if (r.posterMs === null && img?.complete && img.naturalWidth > 0) r.posterMs = Math.round(performance.now() - t0);
    if (stage) {
      r.render = stage.dataset.render ?? null;
      r.tier = stage.dataset.tier ?? null;
      r.failure = stage.dataset.failure ?? null;
    } else if (dawn) {
      r.render = dawn.dataset.render ?? null;
    }
    const live = stage ? stage.dataset.ready === "true" : dawn?.dataset.sceneReady === "true";
    const noWebgl = r.render !== null && r.render !== "webgl" && r.render !== "pending";
    if (live || noWebgl || r.failure) {
      if (live) r.liveMs = Math.round(performance.now() - t0);
      break;
    }
  }

  if (r.liveMs !== null) {
    // Watch the opening motion, then read the scene's own frame log.
    await wait(WATCH_MS);
    const scenes = (frame.contentWindow as SceneWindow | null)?.__fl4scenes ?? {};
    const all = Object.values(scenes);
    const frameMs = all.flatMap((s) => s.frameMs ?? []);
    r.frames = frameMs.length;
    r.slowFrames = frameMs.filter((ms) => ms > 50).length;
    r.frameMedianMs = percentile(frameMs, 0.5);
    r.frameP95Ms = percentile(frameMs, 0.95);
    r.stepped = all.some((s) => s.stepped);
    r.triangles = all.reduce((n, s) => n + (s.triangles ?? 0), 0);
  }
  stopTicks = true;
  return r;
}

/** Plain-word verdict for one screen, the way a visitor would feel it. */
export function verdict(r: ScreenResult): { tone: "ok" | "warn" | "bad"; words: string } {
  if (r.errors.length) return { tone: "bad", words: "Errors" };
  if (r.liveMs === null) return r.render && r.render !== "webgl" ? { tone: "warn", words: "Picture only" } : { tone: "bad", words: "3D never started" };
  if (r.liveMs > 6000 || (r.frameP95Ms ?? 0) > 50) return { tone: "warn", words: "Slow" };
  return { tone: "ok", words: "Smooth" };
}

export function DeviceCheck() {
  const frame = useRef<HTMLIFrameElement>(null);
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [results, setResults] = useState<ScreenResult[]>([]);
  const [current, setCurrent] = useState<number | null>(null);
  const [sent, setSent] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [copied, setCopied] = useState(false);
  const started = useRef(false);

  const run = useCallback(async () => {
    const f = frame.current;
    if (!f || started.current) return;
    started.current = true;
    const info = deviceInfo();
    setDevice(info);
    // A first, tiny report: even a run that never finishes shows it reached the server.
    void fetch("/api/device-report", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ stage: "started", device: info, results: [] }) }).catch(() => {});
    const out: ScreenResult[] = [];
    for (let i = 0; i < SCREENS.length; i++) {
      setCurrent(i);
      out.push(await measure(f, SCREENS[i]!));
      setResults([...out]);
      // Free the screen's GPU context before the next one, the way leaving a page would.
      f.src = "about:blank";
      await wait(600);
    }
    setCurrent(null);
    setSent("sending");
    try {
      const res = await fetch("/api/device-report", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ stage: "done", device: info, results: out }) });
      setSent(res.ok ? "sent" : "failed");
    } catch {
      setSent("failed");
    }
  }, []);

  useEffect(() => {
    void run();
  }, [run]);

  const report = JSON.stringify({ device, results }, null, 1);
  const running = current !== null;

  return (
    <div className="min-h-screen bg-bg text-ink">
      {/* The screen under test, full size, behind the status bar. */}
      <div className={cn("fixed inset-0 overflow-hidden", running ? "visible" : "invisible")} aria-hidden>
        <iframe ref={frame} title="Screen under test" scrolling="no" className="h-full w-full border-0" />
      </div>

      {running ? (
        <div className="fixed inset-x-2 bottom-2 z-10 rounded-2xl border border-accent/50 bg-bg/95 px-4 py-3 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.9)]" role="status">
          <div className="flex items-center justify-between gap-3 text-[13px] font-bold">
            <span>
              Checking {current! + 1} of {SCREENS.length} · {SCREENS[current!]!.label}
            </span>
            <span className="text-muted">Keep this open</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${(current! / SCREENS.length) * 100}%` }} />
          </div>
        </div>
      ) : (
        <main className="mx-auto max-w-[720px] px-4 py-8">
          <div className="kicker w-fit">3D check</div>
          <h1 className="mt-4 font-[family-name:var(--font-display)] text-[34px] font-black uppercase leading-none tracking-[-0.03em]">
            {results.length < SCREENS.length ? "Starting…" : "Done. Thank you."}
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">
            {sent === "sent"
              ? "The results were sent. You can close this page."
              : sent === "failed"
                ? "The results couldn't be sent. Tap “Copy results” and paste them in a message instead."
                : sent === "sending"
                  ? "Sending the results…"
                  : "Each screen loads in turn and is measured on this phone. It takes about a minute."}
          </p>
          {device ? (
            <p className="mt-4 rounded-2xl border border-line bg-surface p-3 font-mono text-[11.5px] leading-snug text-muted">
              {device.renderer} · {device.viewport} @{device.dpr}x · {device.cores ?? "?"} cores{device.memoryGb ? ` · ${device.memoryGb} GB` : ""}
            </p>
          ) : null}
          <ul className="mt-5 divide-y divide-line rounded-2xl border border-line bg-surface">
            {results.map((r) => {
              const v = verdict(r);
              return (
                <li key={r.route} className="flex items-center justify-between gap-3 px-4 py-3" data-route={r.route} data-verdict={v.tone}>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-bold">{r.label}</span>
                    <span className="block text-[12.5px] text-muted">
                      picture {r.posterMs ?? "—"} ms · live {r.liveMs ?? "never"}
                      {r.liveMs !== null ? ` ms · frames ${r.frameMedianMs ?? "—"}/${r.frameP95Ms ?? "—"} ms` : ""} · {r.tier ?? r.render ?? "?"}
                      {r.stepped ? " · stepped down" : ""}
                    </span>
                  </span>
                  <span className={cn("shrink-0 rounded-full px-3 py-1 text-[12px] font-black uppercase", v.tone === "ok" ? "bg-ok-soft text-ok" : v.tone === "warn" ? "bg-warn-soft text-warn" : "bg-bad-soft text-bad")}>{v.words}</span>
                </li>
              );
            })}
          </ul>
          {results.length === SCREENS.length ? (
            <button
              type="button"
              className="mt-5 min-h-12 w-full rounded-full border border-line-strong text-[15px] font-bold"
              onClick={() => {
                // Phones block the clipboard API on plain-http addresses (a LAN test server), so fall back to a selected textarea.
                const fallback = () => {
                  const area = document.createElement("textarea");
                  area.value = report;
                  area.setAttribute("readonly", "");
                  area.style.position = "fixed";
                  area.style.opacity = "0";
                  document.body.appendChild(area);
                  area.select();
                  setCopied(document.execCommand("copy"));
                  area.remove();
                };
                if (navigator.clipboard && window.isSecureContext) void navigator.clipboard.writeText(report).then(() => setCopied(true), fallback);
                else fallback();
              }}
            >
              {copied ? "Copied ✓" : "Copy results"}
            </button>
          ) : null}
        </main>
      )}
    </div>
  );
}
