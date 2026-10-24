"use client";

// A phone drawn in CSS whose screen is the live app — not a picture of one.
// Every "try it" in the demo happens inside one of these, so a tap on a sponsor's
// screen and a tap on a member's screen feel like the same product.
// On a real phone the frame steps aside and the app fills the screen.

import type { CSSProperties, ReactNode } from "react";
import { minuteOf } from "@/domain/calendar";
import { cn } from "@/components/ui/kit";
import { useWorld } from "@/lib/store";

function clockLabel(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")}`;
}

function StatusBar({ time }: { time: string }) {
  return (
    <div className="relative flex h-[50px] shrink-0 items-center justify-between px-8 pt-1.5 text-[15px] font-semibold">
      <span className="num">{time}</span>
      <span aria-hidden className="absolute left-1/2 top-[11px] h-[32px] w-[116px] -translate-x-1/2 rounded-full bg-black" />
      <span aria-hidden className="flex items-center gap-1.5">
        <svg width="18" height="11" viewBox="0 0 18 11">
          <rect x="0" y="7" width="3" height="4" rx="1" fill="currentColor" />
          <rect x="5" y="5" width="3" height="6" rx="1" fill="currentColor" />
          <rect x="10" y="2.5" width="3" height="8.5" rx="1" fill="currentColor" />
          <rect x="15" y="0" width="3" height="11" rx="1" fill="currentColor" />
        </svg>
        <svg width="26" height="12" viewBox="0 0 26 12">
          <rect x="0.5" y="0.5" width="22" height="11" rx="3.5" fill="none" stroke="currentColor" opacity="0.45" />
          <rect x="2.5" y="2.5" width="15" height="7" rx="2" fill="currentColor" />
          <rect x="23.5" y="4" width="2" height="4" rx="1" fill="currentColor" opacity="0.45" />
        </svg>
      </span>
    </div>
  );
}

/**
 * The phone. `label` names the app for screen readers ("Partner app").
 * `height` trims the screen for pages where the phone sits beside other things.
 */
export function Phone({ children, label, height = 780, className }: { children: ReactNode; label: string; height?: number; className?: string }) {
  const world = useWorld();
  const time = clockLabel(minuteOf(world.clock));
  // One copy of the app, always: a live app must have one state and one set of ids.
  // Only the frame changes with the screen — a device on wide screens, the bare app on phones.
  return (
    <div
      role="group"
      aria-label={label}
      data-testid="phone"
      className={cn(
        "relative mx-auto w-full overflow-hidden rounded-[28px] border border-line bg-bg",
        "sm:w-[402px] sm:shrink-0 sm:overflow-visible sm:rounded-[58px] sm:border-0 sm:bg-[#0e0d0c] sm:p-[10px]",
        "sm:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_0_0_9px_#1b1916,0_0_0_10px_rgba(255,255,255,0.06),0_50px_100px_-30px_rgba(0,0,0,0.9),0_0_120px_-40px_rgba(255,106,19,0.45)]",
        className,
      )}
    >
      <div
        className="relative flex h-[min(var(--phone-h),720px)] flex-col overflow-hidden bg-bg [contain:inline-size] sm:h-[var(--phone-h)] sm:w-[382px] sm:rounded-[48px]"
        style={{ "--phone-h": `${height}px` } as CSSProperties}
        data-mode="day"
      >
        <div className="hidden sm:block">
          <StatusBar time={time} />
        </div>
        <div className="min-h-0 flex-1">{children}</div>
        <span aria-hidden className="pointer-events-none absolute bottom-2 left-1/2 hidden h-[5px] w-[134px] -translate-x-1/2 rounded-full bg-ink opacity-70 sm:block" />
      </div>
    </div>
  );
}

/** The top of an app screen: a small line above a big title. */
export function AppHeader({ kicker, title, right }: { kicker?: ReactNode; title: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 px-5 pb-3 pt-2">
      <div className="min-w-0">
        {kicker ? <div className="text-[12.5px] font-semibold text-muted">{kicker}</div> : null}
        <h3 className="font-[family-name:var(--font-display)] text-[28px] font-black uppercase leading-[0.95] tracking-[-0.03em]">{title}</h3>
      </div>
      {right}
    </div>
  );
}

/** A scrolling app body with comfortable side margins. */
export function AppBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-8", className)}>{children}</div>;
}

/** The app's bottom tab bar. */
export function AppTabs<T extends string>({ tabs, value, onChange, label }: { tabs: { id: T; label: string; icon?: ReactNode }[]; value: T; onChange: (id: T) => void; label: string }) {
  return (
    <nav aria-label={label} className="shrink-0 border-t border-line bg-[color-mix(in_srgb,var(--bg)_94%,transparent)] pb-5 pt-1">
      <div className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={value === t.id}
            onClick={() => onChange(t.id)}
            className={cn("flex min-h-14 flex-col items-center justify-center gap-1 text-[12px] font-bold transition-colors", value === t.id ? "text-accent" : "text-muted hover:text-ink")}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
