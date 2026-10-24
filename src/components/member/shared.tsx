"use client";

// Small pieces the member app shares across its tabs: the action hook that
// sends commands as the current member and remembers the last refusal, the
// inline receipt that shows a refusal next to the control that caused it, the
// progress ring and the line portrait.

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import type { CommandInput } from "@/domain/commands";
import type { Meta, Receipt } from "@/domain/engine";
import { activitiesOf } from "@/domain/projections";
import type { World } from "@/domain/types";
import { OUTCOME_WORDS, plain } from "@/components/demo/plain";
import { cn } from "@/components/ui/kit";
import { actors, store, useWorld } from "@/lib/store";

/** Matches a media query on the client; assumes desktop on the server. */
export function useMedia(query: string, serverValue = true): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

/**
 * Send commands as the member being viewed. Keeps the last receipt so a
 * refusal can be shown beside the control that caused it.
 */
export function useMemberAction(memberId: string) {
  const [last, setLast] = useState<Receipt | null>(null);
  const run = useCallback(
    (input: CommandInput, meta: Meta = {}) => {
      const r = store.dispatch(input, actors.member(memberId), { via: "member-app", ...meta });
      setLast(r);
      return r;
    },
    [memberId],
  );
  const clear = useCallback(() => setLast(null), []);
  return { run, last, clear };
}

/** Schema refusals name fields ("durationMin: Too big…"); a member should read plain words instead. */
const FIELD_WORDS: Record<string, string> = {
  durationMin: "Check the minutes — an outing can't be longer than a day.",
  distanceMi: "Check the miles.",
  startedAt: "Check when the outing happened.",
  name: "Check your name — up to 24 characters.",
  goalLabel: "Check your goal — up to 90 characters.",
};

export function plainSummary(summary: string): string {
  if (!summary.startsWith("Refused at input:")) return summary;
  const field = Object.keys(FIELD_WORDS).find((f) => summary.includes(`${f}:`));
  return field ? FIELD_WORDS[field]! : summary.replace("Refused at input: ", "");
}

/**
 * The status region for one control. It is always mounted, so screen readers
 * announce what is written into it (a region inserted already holding its text
 * often isn't read). Refusals, no-ops and queue results show in place; an
 * applied result is announced but left visually to the toast.
 */
export function InlineReceipt({ receipt, className }: { receipt: Receipt | null; className?: string }) {
  const visible = receipt && receipt.outcome !== "applied";
  return (
    <div role="status" className={visible ? cn("rise-in rounded-2xl border border-line bg-surface-2 p-3 text-[13.5px] leading-snug", className) : "sr-only"}>
      {receipt && !visible ? plain(receipt.summary) : null}
      {visible ? (
        <>
          <span
            className={cn(
              "inline-flex rounded-full px-2 py-0.5 text-[11px] font-black uppercase tracking-[0.08em]",
              receipt.outcome === "noop" ? "bg-ok-soft text-ok" : receipt.outcome === "rejected" ? "bg-bad-soft text-bad" : "bg-warn-soft text-warn",
            )}
          >
            {receipt.outcome === "noop" && receipt.type === "LOG_ACTIVITY" ? "Counted once" : OUTCOME_WORDS[receipt.outcome]}
          </span>
          <p className="mt-1.5">{plain(plainSummary(receipt.summary))}</p>
        </>
      ) : null}
    </div>
  );
}

/**
 * A full-width switch row: the visible sentence is the accessible name, and the
 * whole row is the target (at least 48 px tall), so it is easy to hit and to read.
 */
export function SwitchRow({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border border-line-strong bg-surface px-4 py-2.5 text-left disabled:opacity-50"
    >
      <span className="min-w-0">
        <span className="block text-[14.5px] font-semibold leading-snug">{label}</span>
        {hint ? <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{hint}</span> : null}
      </span>
      <span aria-hidden className={cn("relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 transition-colors duration-200", checked ? "border-ok bg-ok" : "border-muted bg-surface-2")}>
        <span className={cn("absolute h-5 w-5 rounded-full shadow transition-transform duration-200", checked ? "translate-x-[22px] bg-surface" : "translate-x-[2px] bg-muted")} />
      </span>
    </button>
  );
}

export function ProgressRing({ value, target, size = 208, label, unit }: { value: number; target: number; size?: number; label: string; unit: string }) {
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / Math.max(1, target)));
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 640ms cubic-bezier(0.2,0,0,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="num text-[42px] font-semibold leading-none" data-testid="ring-value">
          {unit === "mi" ? value.toFixed(1) : value}
        </span>
        <span className="mt-1.5 text-[13px] text-muted">
          of <span className="num">{target}</span> {unit === "mi" ? "miles" : "beginners"}
        </span>
      </div>
    </div>
  );
}

function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

/**
 * A member's "line": every counted outing is one segment, its length the
 * distance, its heading a gentle meander seeded by who they are. Original to
 * this project — the Long Light mile line, drawn from real (fictional) data.
 */
export function linePoints(world: World, memberId: string, width: number, height: number): string {
  const outings = activitiesOf(world, memberId).filter((a) => a.status === "counted");
  const seed = hashSeed(memberId);
  let x = 0;
  let y = 0;
  // Headings stay mostly upward (negative y in SVG): every line rises, at its own wandering angle.
  let heading = -0.45 + seed * 0.2;
  const pts: [number, number][] = [[0, 0]];
  outings.forEach((a, i) => {
    heading += Math.sin(i * 1.7 + seed * 9) * 0.5;
    heading = Math.max(-1.0, Math.min(0.15, heading));
    const len = 0.6 + a.distanceMi;
    x += Math.cos(heading) * len;
    y += Math.sin(heading) * len;
    pts.push([x, y]);
  });
  if (pts.length < 3) pts.push([x + 2, y - 0.5], [x + 4, y + 0.3]);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const pad = 4;
  const sx = (width - pad * 2) / Math.max(1e-6, maxX - minX);
  const sy = (height - pad * 2) / Math.max(1e-6, maxY - minY);
  const s = Math.min(sx, sy * 2.2);
  const ox = pad + ((width - pad * 2) - (maxX - minX) * s) / 2;
  const oy = height / 2 - ((minY + maxY) / 2) * Math.min(s, sy);
  return pts.map(([px, py]) => `${(ox + (px - minX) * s).toFixed(1)},${(oy + py * Math.min(s, sy)).toFixed(1)}`).join(" ");
}

export function LinePortrait({ memberId, width = 132, height = 44, strong = false }: { memberId: string; width?: number; height?: number; strong?: boolean }) {
  const world = useWorld();
  const points = useMemo(() => linePoints(world, memberId, width, height), [world, memberId, width, height]);
  const end = points.split(" ").at(-1)?.split(",") ?? ["0", "0"];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="overflow-visible">
      <polyline points={points} fill="none" stroke={strong ? "var(--accent)" : "var(--ink-muted)"} strokeWidth={strong ? 2.4 : 1.6} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={Number(end[0])} cy={Number(end[1])} r={strong ? 3.6 : 2.6} fill="var(--accent)" />
    </svg>
  );
}

/**
 * Marks a part of the phone that 100 Miles of Summer's app already has (the
 * ring, the "+", the badges, Events), so nothing they built reads as our idea.
 */
export function YourAppToday({ className }: { className?: string }) {
  return <span className={cn("shrink-0 rounded-full border border-line-strong px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted", className)}>Your app today</span>;
}

/** The sample world's persona words, in 100 Miles of Summer's own: they have City Leads, not chapter leads. */
export function personaLabel(persona: string): string {
  return persona === "Chapter lead" || persona === "Community organizer" ? "City Lead" : persona;
}

/** Greeting from the simulated clock, not the visitor's. */
export function greeting(minute: number): string {
  if (minute < 12 * 60) return "Good morning";
  if (minute < 17 * 60) return "Good afternoon";
  return "Good evening";
}
