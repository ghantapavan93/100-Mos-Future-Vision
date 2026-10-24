"use client";

// "Plan the next three summers" — the founder's planning app. Two tabs: the
// plan (pick a path, slide the cities, watch three summers answer in people —
// walks, first-timers, teammates) and the Year 10 goals that turn green on
// their own when the real thing happens. The money lives in one chart below
// the phone (proof.ts), so the phone never shows a second, different number.

import { useMemo, type ReactNode } from "react";
import type { Year } from "@/domain/plans";
import { AppBody, AppHeader, AppTabs, Phone } from "@/components/demo/Phone";
import { useMarkStep } from "@/components/demo/TryIt";
import { cn } from "@/components/ui/kit";
import { useLedger, useWorld } from "@/lib/store";
import { LEVER_RANGE, PATH_NAME, SUMMERS, laterChecks, payNextSponsor, plannedYears, yearTenChecks, type Check, type Levers, type PathId, type PlannedYear } from "./plan";

export type PlanTab = "plan" | "checks";

const LEVERS: { key: keyof Levers; label: string; show: (v: number) => string; mark?: string; note?: string }[] = [
  { key: "cities", label: "Cities with group walks", show: (v) => `${v}`, mark: "cities", note: "You have City Leads in 7 cities today." },
];

/** The money for every summer is one chart below the phone. */
function toMoney() {
  document.getElementById("money")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** One short line under each way to grow, so the choice reads at a glance. */
const PATH_NOTE: Record<PathId, string> = {
  "circles-first": "More first-timers",
  "workplace-first": "Your Year 10 goal",
};

function Lever({ lever, value, onChange }: { lever: (typeof LEVERS)[number]; value: number; onChange: (v: number) => void }) {
  const r = LEVER_RANGE[lever.key];
  return (
    <div className="rounded-2xl bg-surface px-3.5 pb-1 pt-3" data-step-target={lever.mark}>
      <label htmlFor={`lever-${lever.key}`} className="flex items-baseline justify-between gap-3">
        <span className="text-[14.5px] font-bold">{lever.label}</span>
        <span className="num text-[17px] font-bold text-accent">{lever.show(value)}</span>
      </label>
      <input id={`lever-${lever.key}`} type="range" min={r.min} max={r.max} step={r.step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-10 w-full" />
      {lever.note ? <p className="-mt-1 pb-2 text-[12px] text-muted">{lever.note}</p> : null}
    </div>
  );
}

function Dot({ pass }: { pass: boolean | null }) {
  return (
    <span
      aria-hidden
      className={cn(
        "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-[13px] font-black",
        pass === true && "bg-ok text-bg shadow-[0_0_14px_-2px_var(--ok)]",
        pass === false && "border-2 border-line-strong text-muted",
        pass === null && "border-2 border-line text-muted",
      )}
    >
      {pass === true ? "✓" : "·"}
    </span>
  );
}

function CheckRow({ check, action }: { check: Check; action?: ReactNode }) {
  return (
    <li className={cn("rounded-2xl border p-3.5", check.pass === true ? "border-ok/40 bg-ok-soft/50" : "border-line bg-surface")} data-check={check.id} data-pass={String(check.pass)}>
      <div className="flex gap-3">
        <Dot pass={check.pass} />
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-bold leading-snug">{check.title}</div>
          <p className="mt-0.5 text-[13px] leading-snug text-muted">{check.status}</p>
          {action}
        </div>
      </div>
    </li>
  );
}

function YearRow({ y, onOpen, target }: { y: PlannedYear; onOpen: () => void; target?: string }) {
  const s = SUMMERS[y.year];
  return (
    <button
      type="button"
      onClick={onOpen}
      data-step-target={target}
      className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 text-left transition-colors hover:border-accent"
      aria-label={`${s.tag}, ${y.year}: ${s.name}. ${y.result.events} walks, ${y.newcomers} first-timers${y.teammates ? `, ${y.teammates} teammates` : ""}. Open`}
    >
      <span className="w-[62px] shrink-0">
        <span className="block text-[11px] font-black uppercase tracking-[0.1em] text-accent">{s.tag}</span>
        <span className="num block text-[20px] font-bold leading-none">{y.year}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-[family-name:var(--font-display)] text-[15px] font-black uppercase tracking-[-0.01em]">{s.name}</span>
        <span className="block text-[13px] font-semibold">
          <span className="num">{y.result.events.toLocaleString("en-US")}</span> walks · <span className="num">{y.newcomers.toLocaleString("en-US")}</span> first-timers
          {y.teammates ? (
            <>
              {" "}
              · <span className="num">{y.teammates.toLocaleString("en-US")}</span> teammates
            </>
          ) : null}
        </span>
      </span>
      <span aria-hidden className="text-[18px] text-muted">
        ›
      </span>
    </button>
  );
}

function YearSheet({ y, checks, onClose, onChecks }: { y: PlannedYear; checks: Check[]; onClose: () => void; onChecks: () => void }) {
  const s = SUMMERS[y.year];
  const later = y.year === 2027 ? null : laterChecks(y.year as 2028 | 2029);
  const stats: [string, string][] = [
    ["Cities", y.plan.chapters.toLocaleString("en-US")],
    ["Group walks", y.result.events.toLocaleString("en-US")],
    ["First-timers", y.newcomers.toLocaleString("en-US")],
    ...(y.teammates ? ([["Teammates", y.teammates.toLocaleString("en-US")]] as [string, string][]) : []),
  ];
  return (
    <div role="dialog" aria-label={`${s.tag}, ${y.year}`} className="absolute inset-0 z-10 flex flex-col bg-bg rise-in">
      <div className="flex items-center justify-between px-4 pt-2">
        <button type="button" onClick={onClose} className="tap rounded-full px-2 text-[15px] font-bold text-accent">
          ‹ Plan
        </button>
        <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.1em] text-muted">Our plan to discuss</span>
      </div>
      <AppHeader kicker={`${s.tag} · ${y.year}`} title={s.name} />
      <AppBody>
        <p className="text-[15px] leading-relaxed">{s.line}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {stats.map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-surface p-3">
              <div className="text-[12px] font-semibold text-muted">{k}</div>
              <div className="num mt-0.5 text-[20px] font-bold">{v}</div>
            </div>
          ))}
        </div>
        <button type="button" onClick={toMoney} className="mt-2 flex w-full items-center justify-between rounded-2xl bg-surface-2 p-3 text-left text-[14px] font-bold">
          The money for this summer
          <span className="text-accent">One chart, below ›</span>
        </button>
        {y.result.organizerLoad > 100 ? <p className="mt-2 text-[13px] text-warn">City Leads would be stretched thin — plan a co-lead per city.</p> : null}

        <div className="mt-5 text-[12px] font-black uppercase tracking-[0.1em] text-muted">A goal to agree on</div>
        <p className="mt-1 text-[15px] font-semibold">{s.goal}</p>
        <div className="mt-4 text-[12px] font-black uppercase tracking-[0.1em] text-muted">What we&apos;d build</div>
        <p className="mt-1 text-[14.5px] leading-relaxed text-muted">{s.build}</p>

        <div className="mt-5 text-[12px] font-black uppercase tracking-[0.1em] text-muted">{later ? "How we'll know it worked" : "Year 10 goals"}</div>
        {later ? (
          <ul className="mt-2 space-y-2">
            {later.map((c) => (
              <CheckRow key={c.id} check={c} />
            ))}
          </ul>
        ) : (
          <button type="button" onClick={onChecks} className="mt-2 flex w-full items-center justify-between rounded-2xl border border-line bg-surface p-3.5 text-left hover:border-accent">
            <span className="text-[15px] font-bold">
              <span className="num">{checks.length}</span> goals to check
            </span>
            <span className="text-[14px] font-bold text-accent">See goals ›</span>
          </button>
        )}
      </AppBody>
    </div>
  );
}

export function PlanPhone({
  path,
  onPath,
  levers,
  onLever,
  tab,
  onTab,
  openYear,
  onOpenYear,
}: {
  path: PathId;
  onPath: (p: PathId) => void;
  levers: Levers;
  onLever: (key: keyof Levers, value: number) => void;
  tab: PlanTab;
  onTab: (t: PlanTab) => void;
  openYear: Year | null;
  onOpenYear: (y: Year | null) => void;
}) {
  const world = useWorld();
  const ledger = useLedger();
  const mark = useMarkStep();
  const years = useMemo(() => plannedYears(path, levers), [path, levers]);
  const checks = useMemo(() => yearTenChecks(world, ledger), [world, ledger]);
  const open = openYear ? years.find((y) => y.year === openYear) : undefined;
  const sponsorsLeft = checks[0]?.pass !== true;
  const change = (l: (typeof LEVERS)[number], v: number) => {
    onLever(l.key, v);
    if (l.mark) mark(l.mark);
  };

  return (
    <Phone label="Plan the next three summers" height={800}>
      <div className="relative flex h-full flex-col">
        {tab === "plan" ? (
          <>
            <AppHeader kicker="Next three summers" title="The plan" right={<span className="mb-1 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.1em] text-muted">To discuss</span>} />
            <AppBody>
              <div role="radiogroup" aria-label="How we grow" className="grid grid-cols-2 gap-1 rounded-2xl bg-surface-2 p-1">
                {(Object.keys(PATH_NAME) as PathId[]).map((id) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={path === id}
                    data-step-target={path === id ? undefined : "path"}
                    onClick={() => {
                      if (id !== path) {
                        onPath(id);
                        mark("path");
                      }
                    }}
                    className={cn("flex min-h-14 flex-col items-center justify-center rounded-xl px-2 text-center transition-colors", path === id ? "bg-accent text-on-accent shadow-[0_6px_20px_-8px_rgba(255,106,19,0.8)]" : "text-muted hover:text-ink")}
                  >
                    <span className="text-[14px] font-bold leading-tight">{PATH_NAME[id]}</span>
                    <span className={cn("mt-0.5 text-[11.5px] font-semibold leading-tight", path === id ? "opacity-80" : "opacity-70")}>{PATH_NOTE[id]}</span>
                  </button>
                ))}
              </div>

              {/* The number that matters most sits right under the paths, so every move shows in the summers below. */}
              <div className="mt-3">
                <Lever lever={LEVERS[0]!} value={levers.cities} onChange={(v) => change(LEVERS[0]!, v)} />
              </div>

              <ul className="mt-3 space-y-2" aria-label="Three summers">
                {years.map((y) => (
                  <li key={y.year}>
                    <YearRow
                      y={y}
                      target={y.year === 2027 ? "year10" : undefined}
                      onOpen={() => {
                        onOpenYear(y.year);
                        if (y.year === 2027) mark("year10");
                      }}
                    />
                  </li>
                ))}
              </ul>
              <button type="button" onClick={toMoney} className="mt-2 px-1 text-left text-[13.5px] font-semibold text-muted underline-offset-4 hover:underline">
                The money for all three summers is one chart below the phone ›
              </button>

              <button
                type="button"
                onClick={() => onTab("checks")}
                className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 text-left transition-colors hover:border-accent"
              >
                <span aria-hidden className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-[13px] font-black", "border-2 border-accent/60 text-accent")}>
                  {checks.length}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold">Year 10 goals</span>
                  <span className="block text-[12.5px] text-muted">
                    <span className="num">{checks.length}</span> to check · each turns green on its own when it really happens
                  </span>
                </span>
                <span aria-hidden className="text-[18px] text-muted">
                  ›
                </span>
              </button>

              <p className="mt-4 px-1 text-[12.5px] leading-snug text-muted">Year 10 takes these cities. Later summers grow from them the way this path does.</p>
            </AppBody>
          </>
        ) : (
          <>
            <AppHeader kicker="Ten summers strong" title="Year 10 goals" />
            <AppBody>
              <p className="px-1 text-[14px] leading-snug text-muted">Each one turns green on its own when it really happens in the app. Nobody ticks a box.</p>
              <ul className="mt-3 space-y-2">
                {checks.map((c) => (
                  <CheckRow
                    key={c.id}
                    check={c}
                    action={
                      c.id === "pilots" && sponsorsLeft ? (
                        <button
                          type="button"
                          onClick={() => payNextSponsor()}
                          data-step-target="paid"
                          className="tap mt-2 rounded-xl bg-accent px-4 text-[13px] font-black uppercase tracking-[0.06em] text-on-accent shadow-[0_8px_24px_-8px_rgba(255,106,19,0.8)]"
                        >
                          Sponsor pays
                        </button>
                      ) : null
                    }
                  />
                ))}
              </ul>
            </AppBody>
          </>
        )}
        <AppTabs
          label="Plan sections"
          value={tab}
          onChange={onTab}
          tabs={[
            {
              id: "plan",
              label: "Plan",
              icon: (
                <span aria-hidden className="inline-flex size-7 items-center justify-center rounded-full text-[18px] leading-none">
                  ◐
                </span>
              ),
            },
            {
              id: "checks",
              label: "Goals",
              icon: (
                <span aria-hidden data-step-target={tab === "plan" ? "paid" : undefined} className="inline-flex size-7 items-center justify-center rounded-full text-[18px] leading-none">
                  ✓
                </span>
              ),
            },
          ]}
        />
        {open ? (
          <YearSheet
            y={open}
            checks={checks}
            onClose={() => onOpenYear(null)}
            onChecks={() => {
              onOpenYear(null);
              onTab("checks");
            }}
          />
        ) : null}
      </div>
    </Phone>
  );
}
