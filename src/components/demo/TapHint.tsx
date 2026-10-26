"use client";

// "Step 2 · Tap here": a small callout pinned beside whatever on the phone the
// next step needs (the control carrying data-step-target="<step id>"). It sits
// above the control, or below when there's no room, never on it, and follows it
// as the phone's own screen scrolls or the app re-renders. When the next step
// changes and its control is out of sight, the phone's screen — never the page —
// scrolls it into view. If a sheet on the phone covers it, the callout points at
// the sheet's Close/Done instead. Purely visual: the steps list is what screen
// readers get.

import { Pointer } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { cn } from "@/components/ui/kit";

interface Place {
  top: number;
  left: number;
  /** Where the arrow meets the target, from the callout's left edge. */
  arrow: number;
  /** True when the callout sits below the target (arrow points up). */
  below: boolean;
  /** "close": the step's control is under an open sheet, so the callout points at the way out. */
  mode: "step" | "close";
}

/** The words of a button that closes a sheet. */
const CLOSE_WORDS = /^(?:done|close|back|‹ ?back|← ?back|got it|ok)$/i;

/**
 * If an open sheet on the phone sits over `target`, the sheet's visible Close/Done
 * button (or null when it has none we can point at). Undefined when nothing covers it.
 */
function coveringClose(target: HTMLElement, host: HTMLElement): HTMLElement | null | undefined {
  const r = target.getBoundingClientRect();
  const x = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2));
  const y = Math.min(innerHeight - 1, Math.max(0, r.top + Math.min(r.height / 2, 20)));
  // Off the page's viewport, nothing can be read here: treat it as uncovered.
  if (r.bottom < 0 || r.top > innerHeight) return undefined;
  const hit = document.elementFromPoint(x, y);
  if (!hit || target.contains(hit)) return undefined;
  const sheet = hit.closest('[role="dialog"]');
  if (!sheet || !host.contains(sheet) || sheet.contains(target)) return undefined;
  // A worded Close/Done, or a back arrow ("‹ Roadmap"); never the wordless backdrop behind the sheet.
  const buttons = [...sheet.querySelectorAll<HTMLElement>("button")].filter((b) => b.getClientRects().length > 0);
  const words = (b: HTMLElement) => (b.textContent ?? "").trim();
  return buttons.find((b) => CLOSE_WORDS.test(words(b))) ?? buttons.find((b) => /^[‹←]/.test(words(b))) ?? null;
}

/** Space kept between the callout and the target, and from the screen's edges. */
const GAP = 10;
const EDGE = 6;
/** How long to keep following after a change, so transitions (tabs, sheets) are tracked to their end. */
const FOLLOW_MS = 700;
/** After a tap completes a step, how long the tap's own result stays in view before the phone scrolls to the next control. */
const AFTER_TAP_MS = 900;
/** How long the phone keeps the next control in view while the app settles. */
const REVEAL_MS = 1400;
/** A slow re-check between events, for layout that shifts without any DOM change. */
const POLL_MS = 250;

/** The phone's visible screen: what a target must be inside to be pointed at. */
function screenOf(box: HTMLElement): HTMLElement {
  const phone = box.querySelector<HTMLElement>('[data-testid="phone"]');
  return (phone?.firstElementChild as HTMLElement | null) ?? phone ?? box;
}

function scrollsOn(el: HTMLElement, axis: "x" | "y"): boolean {
  const style = getComputedStyle(el);
  const overflow = axis === "y" ? style.overflowY : style.overflowX;
  if (overflow !== "auto" && overflow !== "scroll") return false;
  return axis === "y" ? el.scrollHeight > el.clientHeight + 1 : el.scrollWidth > el.clientWidth + 1;
}

/** Brings `el` into view inside each of its scrolling ancestors up to `stop` — the page itself never moves. */
function revealInside(el: HTMLElement, stop: HTMLElement) {
  const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches && document.documentElement.dataset.motion !== "paused";
  for (let node = el.parentElement; node && node !== stop && stop.contains(node); node = node.parentElement) {
    const t = el.getBoundingClientRect();
    const s = node.getBoundingClientRect();
    if (scrollsOn(node, "y") && (t.top < s.top + 12 || t.bottom > s.bottom - 12)) {
      // Centre it, but never push its top out of sight.
      const delta = t.top - s.top - Math.max(16, (s.height - t.height) / 2);
      node.scrollTo({ top: node.scrollTop + delta, behavior: smooth ? "smooth" : "auto" });
    }
    if (scrollsOn(node, "x") && (t.left < s.left + 8 || t.right > s.right - 8)) {
      const delta = t.left - s.left - Math.max(12, (s.width - t.width) / 2);
      node.scrollTo({ left: node.scrollLeft + delta, behavior: smooth ? "smooth" : "auto" });
    }
  }
}

export function TapHint({ box, targetId, step }: { box: RefObject<HTMLDivElement | null>; targetId: string | null; step: number }) {
  const callout = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<Place | null>(null);
  // When the phone may scroll the next control into view: a short window after the step changes
  // (or its control appears), opened a beat late after a tap so the tap's own result is seen
  // first. Outside it, a member scrolling the phone by hand is never fought.
  const reveal = useRef({ target: null as Element | null, from: 0, until: 0, last: 0 });
  const first = useRef(true);

  const update = useCallback(() => {
    const host = box.current;
    const me = callout.current;
    if (!host || !me || !targetId) return setPlace(null);
    const target = host.querySelector<HTMLElement>(`[data-step-target="${CSS.escape(targetId)}"]`);
    if (!target) return setPlace(null);
    const screen = screenOf(host);
    // Not laid out (inside a closed tab): nothing to point at yet.
    if (target.getClientRects().length === 0) return setPlace(null);
    const now = performance.now();
    const r = reveal.current;
    if (r.target !== target) {
      const from = r.target === null && r.from > now ? r.from : now;
      reveal.current = { target, from, until: from + REVEAL_MS, last: 0 };
    }
    if (now >= reveal.current.from && now <= reveal.current.until && now - reveal.current.last > 400) {
      reveal.current.last = now;
      revealInside(target, screen);
    }
    // A sheet open over the control: the way forward is closing it first.
    const close = coveringClose(target, host);
    if (close === null) return setPlace(null);
    const mode: Place["mode"] = close ? "close" : "step";
    const t = (close ?? target).getBoundingClientRect();
    const clip = screen.getBoundingClientRect();
    // Scrolled out of the screen: point at nothing rather than at the wrong place.
    if (t.bottom < clip.top + 4 || t.top > clip.bottom - 4) return setPlace(null);
    const b = host.getBoundingClientRect();
    const w = me.offsetWidth;
    const h = me.offsetHeight;
    const below = t.top - h - GAP < clip.top + EDGE;
    const top = below ? Math.min(t.bottom + GAP, clip.bottom - h - EDGE) - b.top : t.top - h - GAP - b.top;
    const centre = t.left + t.width / 2;
    const minLeft = clip.left + EDGE;
    const maxLeft = Math.max(minLeft, clip.right - w - EDGE);
    const left = Math.min(maxLeft, Math.max(minLeft, centre - w / 2));
    const arrow = Math.min(w - 16, Math.max(16, centre - left));
    const next: Place = { top: Math.round(top), left: Math.round(left - b.left), arrow: Math.round(arrow), below, mode };
    setPlace((p) => (p && p.top === next.top && p.left === next.left && p.arrow === next.arrow && p.below === next.below && p.mode === next.mode ? p : next));
  }, [box, targetId]);

  // Follow for a moment after anything changes, so a sliding tab or opening sheet is tracked to where it lands.
  const frame = useRef(0);
  const followUntil = useRef(0);
  const follow = useCallback(
    (ms: number = FOLLOW_MS) => {
      followUntil.current = Math.max(followUntil.current, performance.now() + ms);
      cancelAnimationFrame(frame.current);
      const tick = () => {
        update();
        if (performance.now() < followUntil.current) frame.current = requestAnimationFrame(tick);
      };
      tick();
    },
    [update],
  );

  // A new step: on first load, show its control straight away; after a tap, let the tap's result show first.
  useLayoutEffect(() => {
    const delay = first.current ? 0 : AFTER_TAP_MS;
    first.current = false;
    reveal.current = { target: null, from: performance.now() + delay, until: 0, last: 0 };
    follow(delay + REVEAL_MS);
  }, [targetId, follow]);

  useEffect(() => {
    const host = box.current;
    if (!host) return;
    // Watch the phone only: the callout lives beside it, so moving the callout never wakes this up.
    const watched = host.querySelector('[data-testid="phone"]') ?? host;
    const settle = () => follow();
    const mutations = new MutationObserver(settle);
    mutations.observe(watched, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-step-target", "class", "aria-pressed", "aria-expanded", "hidden"] });
    const sizes = new ResizeObserver(settle);
    sizes.observe(host);
    host.addEventListener("scroll", update, { capture: true, passive: true });
    window.addEventListener("resize", settle);
    // Layout can also shift with no DOM change at all (an animated height, a count-up): a slow check
    // catches it. It only re-renders when the callout actually has to move.
    const poll = window.setInterval(() => document.visibilityState === "visible" && update(), POLL_MS);
    return () => {
      mutations.disconnect();
      sizes.disconnect();
      host.removeEventListener("scroll", update, { capture: true });
      window.removeEventListener("resize", settle);
      window.clearInterval(poll);
      cancelAnimationFrame(frame.current);
    };
  }, [box, follow, update]);

  return (
    <div
      ref={callout}
      aria-hidden
      data-testid="tap-hint"
      data-below={place?.below ? "true" : "false"}
      data-hint-mode={place?.mode ?? "step"}
      className={cn("tap-hint pointer-events-none absolute left-0 top-0 z-30", !place && "invisible")}
      style={place ? { transform: `translate(${place.left}px, ${place.top}px)` } : undefined}
    >
      <div className="tap-hint-bob flex items-center gap-1.5 whitespace-nowrap rounded-full bg-accent py-1.5 pl-2 pr-3 text-[12.5px] font-black uppercase tracking-[0.06em] text-[#140b05] shadow-[0_8px_24px_-6px_rgba(0,0,0,0.7),0_0_22px_-4px_var(--accent)]">
        <Pointer aria-hidden size={15} strokeWidth={2.6} className={cn(place?.below ? "" : "rotate-180")} />
        {place?.mode === "close" ? (
          <span>Close this first</span>
        ) : (
          <span>
            Step {step} <span className="opacity-60">·</span> Tap here
          </span>
        )}
      </div>
      <span
        aria-hidden
        className={cn("absolute size-2.5 rotate-45 bg-accent", place?.below ? "-top-1" : "-bottom-1")}
        style={{ left: (place?.arrow ?? 16) - 5 }}
      />
    </div>
  );
}
