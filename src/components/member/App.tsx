"use client";

// The member app itself. Rendered inside a phone frame on wide screens and as
// the whole screen on phones — the same component, the same state.

import { useEffect, useRef, type ReactNode } from "react";
import { dayLabel, dayOf, minuteOf } from "@/domain/calendar";
import type { MemberView } from "@/domain/selectors";
import type { World } from "@/domain/types";
import { cn } from "@/components/ui/kit";
import { CirclesTab } from "./CirclesTab";
import { CoachTab } from "./CoachTab";
import { LogTab } from "./LogTab";
import { greeting } from "./shared";
import { StartYourSummer } from "./StartYourSummer";
import { TodayTab } from "./TodayTab";
import { YouTab } from "./YouTab";

export type AppTab = "today" | "log" | "circles" | "coach" | "you";

/**
 * The member screen's "Try it" steps that happen inside each tab. The tab
 * button carries those steps' guiding ring while its tab is closed; once it is
 * open, the control inside (earlier in the page) carries it instead.
 */
const TAB_STEPS: Partial<Record<AppTab, string[]>> = { today: ["note"], log: ["log", "resend"], circles: ["join"], coach: ["coach"], you: ["share"] };

const TABS: { id: AppTab; label: string; icon: ReactNode }[] = [
  {
    id: "today",
    label: "Today",
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
      </svg>
    ),
  },
  {
    id: "log",
    label: "Log",
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v8M8 12h8" />
      </svg>
    ),
  },
  {
    id: "circles",
    label: "Circles",
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <circle cx="9" cy="10" r="5" />
        <circle cx="15.5" cy="14" r="5" />
      </svg>
    ),
  },
  {
    id: "coach",
    label: "Coach",
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 18c3-1 4-5 7-6s4 2 6 1 2-4 3-5" />
        <circle cx="20" cy="8" r="1.6" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "you",
    label: "You",
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
        <circle cx="12" cy="8.5" r="3.8" />
        <path d="M4.5 20c1.4-3.6 4.3-5.2 7.5-5.2s6.1 1.6 7.5 5.2" />
      </svg>
    ),
  },
];

const TITLES: Record<AppTab, string> = { today: "", log: "Log", circles: "Circles", coach: "Coach", you: "You" };

export function MemberApp({
  view,
  world,
  framed,
  tab,
  onTab,
  onboarding,
  onOnboarding,
  onJoined,
}: {
  view: MemberView;
  world: World;
  framed: boolean;
  tab: AppTab;
  onTab: (t: AppTab) => void;
  onboarding: boolean;
  onOnboarding: (open: boolean) => void;
  onJoined: (memberId: string) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Partial<Record<AppTab, HTMLButtonElement | null>>>({});
  // Arrow keys move the selection and the focus together, as a tablist should.
  const moveTo = (id: AppTab) => {
    onTab(id);
    tabRefs.current[id]?.focus();
  };
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [tab, view.member.id, onboarding]);

  const minute = minuteOf(world.clock);
  const header = (
    <div className="px-5 pb-2 pt-1">
      {tab === "today" ? (
        <>
          <div className="text-[12.5px] text-muted">{dayLabel(dayOf(world.clock))}</div>
          <h2 className="display text-[30px] leading-tight">
            {greeting(minute)}, {view.member.name}
          </h2>
        </>
      ) : (
        <h2 className="display text-[30px] leading-tight">{TITLES[tab]}</h2>
      )}
    </div>
  );

  const body = onboarding ? (
    <StartYourSummer
      world={world}
      onCancel={() => onOnboarding(false)}
      onDone={(id) => {
        onJoined(id);
        onOnboarding(false);
        onTab("today");
      }}
    />
  ) : (
    <div key={`${tab}-${view.member.id}`} className="animate-[rise-in_220ms_cubic-bezier(0.2,0,0,1)_both]" role="tabpanel" id={`member-panel-${tab}`} aria-labelledby={`member-tab-${tab}`}>
      {header}
      {tab === "today" ? <TodayTab view={view} world={world} onTab={onTab} /> : null}
      {tab === "log" ? <LogTab view={view} world={world} /> : null}
      {tab === "circles" ? <CirclesTab view={view} world={world} /> : null}
      {tab === "coach" ? <CoachTab view={view} world={world} onTab={onTab} /> : null}
      {tab === "you" ? <YouTab view={view} world={world} onStart={() => onOnboarding(true)} /> : null}
    </div>
  );

  const tabBar = onboarding ? null : (
    <nav aria-label="Member app" className={cn("border-t border-line bg-[color-mix(in_srgb,var(--bg)_94%,transparent)]", framed ? "pb-6" : "sticky bottom-0 z-20 pb-[max(env(safe-area-inset-bottom),6px)] backdrop-blur-md")}>
      <div role="tablist" aria-label="Sections" className="mx-auto grid max-w-[480px] grid-cols-5">
        {TABS.map((t) => {
          // One element can carry one step's ring, so a tab with two steps nests the second inside the first.
          const [first, second] = TAB_STEPS[t.id] ?? [];
          return (
            <button
              key={t.id}
              id={`member-tab-${t.id}`}
              role="tab"
              type="button"
              aria-selected={tab === t.id}
              aria-controls={`member-panel-${t.id}`}
              onClick={() => onTab(t.id)}
              ref={(el) => {
                tabRefs.current[t.id] = el;
              }}
              onKeyDown={(e) => {
                const i = TABS.findIndex((x) => x.id === tab);
                const to = e.key === "ArrowRight" ? (i + 1) % TABS.length : e.key === "ArrowLeft" ? (i - 1 + TABS.length) % TABS.length : e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : -1;
                if (to < 0) return;
                e.preventDefault();
                moveTo(TABS[to]!.id);
              }}
              tabIndex={tab === t.id ? 0 : -1}
              className={cn("flex min-h-14 items-stretch p-1.5 text-[12px] font-semibold transition-colors", tab === t.id ? "text-accent-ink" : "text-muted hover:text-ink")}
            >
              <span className="flex flex-1 rounded-[14px]" data-step-target={tab === t.id ? undefined : first}>
                <span className="flex flex-1 flex-col items-center justify-center gap-0.5 rounded-[14px]" data-step-target={tab === t.id ? undefined : second}>
                  {t.icon}
                  {t.label}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );

  if (!framed) {
    return (
      <div className="relative" data-testid="member-app">
        {body}
        {tabBar}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col" data-testid="member-app">
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {body}
      </div>
      {tabBar}
    </div>
  );
}

/** A plausible modern phone, drawn in CSS. The screen is the live app, not a picture of one. */
export function PhoneFrame({ children, clock }: { children: ReactNode; clock: string }) {
  return (
    <div data-testid="phone" className="relative mx-auto w-[414px] shrink-0 rounded-[60px] bg-[#1d1b17] p-3 shadow-[0_2px_0_rgba(255,255,255,0.06)_inset,0_40px_80px_-30px_rgba(34,32,28,0.55),0_14px_30px_-18px_rgba(34,32,28,0.4)]">
      <div className="relative flex h-[844px] w-[390px] flex-col overflow-hidden rounded-[48px] bg-bg" data-mode="day">
        <div className="relative flex h-[50px] shrink-0 items-center justify-between px-8 pt-1.5 text-[15px] font-semibold">
          <span className="num">{clock}</span>
          <span aria-hidden className="absolute left-1/2 top-[11px] h-[32px] w-[116px] -translate-x-1/2 rounded-full bg-[#0c0b09]" />
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
        <div className="min-h-0 flex-1">{children}</div>
        <span aria-hidden className="pointer-events-none absolute bottom-2 left-1/2 h-[5px] w-[134px] -translate-x-1/2 rounded-full bg-ink opacity-80" />
      </div>
    </div>
  );
}
