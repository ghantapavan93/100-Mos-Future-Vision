"use client";

// The Movement Atlas: six sample chapters on a dot-grid map, and the list
// that is the real control. Choosing a chapter moves the map's camera (its
// viewBox) toward that city — the "whole movement → one community" step —
// in one eased move, or instantly when motion is reduced or paused.
//
// City names and beacons are HTML laid over the SVG at fixed pixel sizes, so
// they stay readable at any width instead of shrinking with the viewBox.

import { useEffect, useMemo, useRef, useState } from "react";
import type { Chapter, ChapterId } from "@/domain/types";
import { Basis, cn } from "@/components/ui/kit";
import { useUI } from "@/lib/store";
import { ATLAS_H, ATLAS_W, DOTS, OUTLINE_PATH, chapterPoint } from "./usShape";

type Box = [number, number, number, number];

const WORLD: Box = [-20, -20, ATLAS_W + 40, ATLAS_H + 40];

/** cubic-bezier(0.2, 0, 0, 1), solved for y at x with Newton steps. */
function ease(t: number): number {
  const x1 = 0.2,
    y1 = 0,
    x2 = 0,
    y2 = 1;
  const bx = (u: number) => 3 * u * (1 - u) ** 2 * x1 + 3 * u ** 2 * (1 - u) * x2 + u ** 3;
  const by = (u: number) => 3 * u * (1 - u) ** 2 * y1 + 3 * u ** 2 * (1 - u) * y2 + u ** 3;
  let u = t;
  for (let i = 0; i < 6; i++) {
    const d = (bx(u + 1e-4) - bx(u - 1e-4)) / 2e-4;
    if (Math.abs(d) < 1e-6) break;
    u -= (bx(u) - t) / d;
    u = Math.min(1, Math.max(0, u));
  }
  return by(u);
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function useCamera(target: Box, instant: boolean): Box {
  const [box, setBox] = useState<Box>(target);
  const from = useRef<Box>(target);
  const current = useRef<Box>(target);

  useEffect(() => {
    if (instant || prefersReducedMotion()) {
      current.current = target;
      setBox(target);
      return;
    }
    from.current = current.current;
    const start = performance.now();
    const duration = 700;
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      const k = ease(t);
      const next = from.current.map((v, i) => v + (target[i]! - v) * k) as Box;
      current.current = next;
      setBox(next);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.join(","), instant]);

  return box;
}

/** A camera box around one chapter, with the same aspect as the whole map so nothing letterboxes. */
function focusBox(chapter: Chapter): Box {
  const [cx, cy] = chapterPoint(chapter);
  const w = 470;
  const h = w * (WORLD[3] / WORLD[2]);
  const x = Math.min(Math.max(cx - w / 2, WORLD[0]), WORLD[0] + WORLD[2] - w);
  const y = Math.min(Math.max(cy - h / 2, WORLD[1]), WORLD[1] + WORLD[3] - h);
  return [x, y, w, h];
}

/** Where an SVG point lands on the rendered map, in percent of its box (the SVG keeps WORLD's aspect). */
function toPercent(box: Box, [x, y]: [number, number]): [number, number] {
  const s = Math.min(WORLD[2] / box[2], WORLD[3] / box[3]);
  const ox = (WORLD[2] - box[2] * s) / 2;
  const oy = (WORLD[3] - box[3] * s) / 2;
  return [((ox + (x - box[0]) * s) / WORLD[2]) * 100, ((oy + (y - box[1]) * s) / WORLD[3]) * 100];
}

interface AtlasProps {
  chapters: Chapter[];
  selected: ChapterId;
  zoomed: boolean;
  onSelect: (id: ChapterId) => void;
  onZoomOut: () => void;
  members: Record<ChapterId, number>;
  viewerChapter: ChapterId | null;
}

/** The flat map: the picture when WebGL can't run (the 3D map in the hero replaces it otherwise). */
export function AtlasMap({ chapters, selected, zoomed, onSelect, onZoomOut, framed = true }: Omit<AtlasProps, "members" | "viewerChapter"> & { framed?: boolean }) {
  const { motionPaused } = useUI();
  const chosen = chapters.find((c) => c.id === selected);
  const target = useMemo<Box>(() => (zoomed && chosen ? focusBox(chosen) : WORLD), [zoomed, chosen]);
  const box = useCamera(target, motionPaused);
  const scale = box[2] / WORLD[2];
  // Dots grow a little when the camera moves in, not as much as the map does.
  const dotR = 2.1 * Math.max(0.4, scale) ** 0.7;
  const chicago = chapters.find((c) => c.id === "chicago");

  return (
    <div className={cn("relative overflow-hidden", framed && "card bg-surface p-2 sm:p-3")}>
      <div className="relative">
        <svg viewBox={box.join(" ")} className="block h-auto w-full" aria-hidden="true" preserveAspectRatio="xMidYMid meet" style={{ aspectRatio: `${WORLD[2]} / ${WORLD[3]}` }}>
          <path d={OUTLINE_PATH} fill="var(--surface-2)" stroke="var(--line)" strokeWidth={1.2 * scale} strokeLinejoin="round" />
          <g fill="var(--ink)" opacity={0.2}>
            {DOTS.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={dotR} />
            ))}
          </g>
          {/* The challenge began in Chicago in 2018; a quiet line from there to each chapter. */}
          {chicago
            ? chapters
                .filter((c) => c.id !== "chicago")
                .map((c) => {
                  const [x1, y1] = chapterPoint(chicago);
                  const [x2, y2] = chapterPoint(c);
                  const mx = (x1 + x2) / 2;
                  const my = Math.min(y1, y2) - 40;
                  return (
                    <path
                      key={c.id}
                      d={`M${x1},${y1} Q${mx},${my} ${x2},${y2}`}
                      fill="none"
                      stroke="var(--accent)"
                      strokeOpacity={0.55}
                      strokeWidth={1.6 * scale}
                      strokeDasharray={`${4 * scale} ${5 * scale}`}
                      strokeLinecap="round"
                    />
                  );
                })
            : null}
        </svg>
        {/* Beacons and names: HTML at fixed sizes. The list is the accessible control. */}
        <div aria-hidden className="absolute inset-0">
          {chapters.map((c) => {
            const [left, top] = toPercent(box, chapterPoint(c));
            const on = c.id === selected;
            return (
              <div key={c.id} className="absolute" style={{ left: `${left}%`, top: `${top}%` }}>
                <span
                  onClick={() => onSelect(c.id)}
                  className={cn(
                    "absolute block h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full border-2 border-surface",
                    on ? "bg-accent outline outline-2 outline-offset-2 outline-accent" : "bg-info",
                  )}
                />
                <span data-testid="atlas-label" className="pointer-events-none absolute bottom-3 left-0 -translate-x-1/2 whitespace-nowrap rounded-md bg-surface/85 px-1.5 text-[13px] font-bold leading-tight text-ink">{c.city}</span>
                {c.id === "chicago" ? (
                  <span data-testid="atlas-label" className="pointer-events-none absolute left-0 top-3 -translate-x-1/2 whitespace-nowrap rounded-md bg-surface/85 px-1.5 font-mono text-[12px] leading-tight text-muted">began here, 2018</span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      {zoomed ? (
        <button type="button" onClick={onZoomOut} className="tap pointer-events-auto absolute bottom-3 right-3 rounded-full border border-line-strong bg-surface px-4 text-[13.5px] font-semibold hover:border-ink">
          Show every chapter
        </button>
      ) : null}
    </div>
  );
}

/**
 * The real control: one button per circle, with its member count. Two short
 * columns, so seven cities stay low in the hero and never cover the map's east coast.
 */
export function ChapterList({ chapters, selected, onSelect, members, viewerChapter, className }: Pick<AtlasProps, "chapters" | "selected" | "onSelect" | "members" | "viewerChapter"> & { className?: string }) {
  return (
    <nav aria-label="Chapters" className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="eyebrow">Choose a circle</span>
        <Basis kind="fictional" />
      </div>
      <ul className="mt-2.5 grid grid-cols-2 gap-1.5">
        {chapters.map((c) => {
          const on = c.id === selected;
          return (
            <li key={c.id}>
              <button
                type="button"
                aria-pressed={on}
                title={c.name}
                onClick={() => onSelect(c.id)}
                className={cn(
                  "tap flex w-full flex-col items-start justify-center rounded-xl border px-3 py-2 text-left transition-colors",
                  on ? "border-accent bg-accent/10 text-ink" : "border-line bg-surface/70 hover:border-accent",
                )}
              >
                <span className="block w-full truncate text-[14.5px] font-semibold leading-tight">{c.city}</span>
                <span className={cn("mt-0.5 block text-[12px] leading-tight", on ? "opacity-80" : "text-muted")}>
                  <span className="num">{members[c.id]}</span> members{viewerChapter === c.id ? " · yours" : ""}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Map and list side by side (the layout before the 3D hero; kept for any page without one). */
export function Atlas(props: AtlasProps) {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="order-2 lg:order-1">
        <AtlasMap {...props} />
        <p className="mt-2 text-[12.5px] text-muted">
          The map is a picture of the list beside it; every circle is drawn the same size, and member counts are in the list. The dashed lines start in Chicago, where the challenge began in 2018 (public record); everything else on this page is fictional.
        </p>
      </div>
      <ChapterList {...props} className="order-1 lg:order-2" />
    </div>
  );
}
