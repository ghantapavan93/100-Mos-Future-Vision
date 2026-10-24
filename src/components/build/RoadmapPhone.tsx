"use client";

// The Roadmap as a phone app: five lists as chips along the top, one card
// per item, and a card sheet with when it lands, how big it is, what it needs
// from Kayla, and "Try it →" when this demo shows it working.

import Link from "next/link";
import { Fragment, useEffect, useRef } from "react";
import { FEATURES } from "@/blueprint/features";
import { COLUMNS, ROADMAP, SIZE_WORDS, type Column, type RoadmapItem } from "@/blueprint/roadmap";
import { AppBody, AppHeader, Phone } from "@/components/demo/Phone";
import { useMarkStep } from "@/components/demo/TryIt";
import { cn } from "@/components/ui/kit";
import { LENSES } from "@/lib/lenses";

/** What a sheet shows: a roadmap item, or a feature with no roadmap card of its own. */
export type Opened = { kind: "item"; id: string } | { kind: "feature"; id: string };

const MARK: Partial<Record<Column, string>> = { ready: "open-ready", fixes: "open-fixes", later: "open-later" };
/** The chip that completes each list step, for the guiding ring. */
const TARGET: Partial<Record<Column, string>> = { ready: "ready", fixes: "fixes", later: "later" };
const STEPS = ROADMAP.filter((r) => r.step).length;

function screenName(href: string): string {
  return LENSES.find((l) => l.href === href)?.label ?? "that screen";
}

function Chips({ item }: { item: RoadmapItem }) {
  const chips = [
    item.herGoal ? (
      <span key="goal" className="rounded-full bg-accent/15 px-2 py-0.5 text-[10.5px] font-black uppercase tracking-[0.08em] text-accent-ink">
        Your Year 10 goal
      </span>
    ) : null,
    item.needsKayla ? (
      <span key="ok" className="rounded-full bg-warn-soft px-2 py-0.5 text-[10.5px] font-black uppercase tracking-[0.08em] text-warn">
        Needs Kayla&apos;s OK
      </span>
    ) : null,
    item.tryHref && item.column !== "ready" && !item.needsKayla && !item.herGoal ? (
      <span key="try" className="rounded-full bg-ok-soft px-2 py-0.5 text-[10.5px] font-black uppercase tracking-[0.08em] text-ok">
        Try it here
      </span>
    ) : null,
  ].filter(Boolean);
  return chips.length ? <div className={cn("mt-2 flex flex-wrap gap-1.5", item.step ? "pl-[30px]" : "pl-[18px]")}>{chips}</div> : null;
}

function Sheet({ opened, onClose }: { opened: Opened; onClose: () => void }) {
  const item = opened.kind === "item" ? ROADMAP.find((r) => r.id === opened.id) : undefined;
  const feature = opened.kind === "feature" ? FEATURES.find((f) => f.id === opened.id) : undefined;
  const title = item?.title ?? feature?.name ?? "";
  const line = item?.line ?? feature?.see ?? "";
  const href = item?.tryHref ?? feature?.route;
  const column = item ? COLUMNS.find((c) => c.id === item.column) : undefined;
  const kicker = item?.step ? `Step ${item.step} of ${STEPS} · ${item.when}` : item?.herGoal ? "Year 10 · your goal" : (item?.kicker ?? column?.when ?? "Feature");
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => close.current?.focus({ preventScroll: true }), [opened]);
  return (
    <div role="dialog" aria-label={title} className="rise-in absolute inset-0 z-10 flex flex-col bg-bg">
      <div className="flex items-center justify-between px-4 pt-2">
        <button ref={close} type="button" onClick={onClose} className="tap rounded-full px-2 text-[15px] font-bold text-accent">
          ‹ Roadmap
        </button>
        {column ? (
          <span className="rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.1em]" style={{ background: `${column.color}22`, color: column.color }}>
            {column.label}
          </span>
        ) : null}
      </div>
      <AppHeader kicker={kicker} title={title} />
      <AppBody>
        <p className="text-[16px] leading-relaxed">{line}</p>
        {item?.doneWhen || item?.size ? (
          <dl className="mt-4 divide-y divide-line rounded-2xl bg-surface text-[14px]">
            {item.doneWhen ? (
              <div className="p-3.5">
                <dt className="text-[11px] font-black uppercase tracking-[0.1em] text-muted">Done when</dt>
                <dd className="mt-1 leading-snug">{item.doneWhen}</dd>
              </div>
            ) : null}
            {item.size ? (
              <div className="flex items-baseline justify-between gap-3 p-3.5">
                <dt className="text-[11px] font-black uppercase tracking-[0.1em] text-muted">How big</dt>
                <dd className="font-semibold">{SIZE_WORDS[item.size]}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
        {item?.needsKayla ? (
          <div className="mt-4 rounded-2xl border border-warn/40 bg-warn-soft p-3.5 text-[14px] leading-snug text-warn">
            <div className="text-[11px] font-black uppercase tracking-[0.1em]">Needs Kayla&apos;s OK</div>
            <div className="mt-1 text-ink">{item.needsKayla}</div>
          </div>
        ) : null}
        {href && href !== "/build" ? (
          <Link
            href={href}
            className="tap mt-6 flex items-center justify-between rounded-2xl bg-accent px-4 text-[15px] font-black uppercase tracking-[0.06em] text-on-accent shadow-[0_8px_30px_-8px_rgba(255,106,19,0.8)]"
            data-try={href}
          >
            Try it in {screenName(href)} <span aria-hidden>→</span>
          </Link>
        ) : (
          <p className="mt-6 rounded-2xl bg-surface p-3.5 text-[14px] text-muted">{item?.column === "ready" ? "Already in your app — nothing to try here." : "Not in this demo yet — it's a picture of what comes next."}</p>
        )}
      </AppBody>
    </div>
  );
}

export function RoadmapPhone({ column, onColumn, opened, onOpen }: { column: Column; onColumn: (c: Column) => void; opened: Opened | null; onOpen: (o: Opened | null) => void }) {
  const mark = useMarkStep();
  const def = COLUMNS.find((c) => c.id === column)!;
  const items = ROADMAP.filter((r) => r.column === column);
  // Opening a card from the 3D road counts too.
  useEffect(() => {
    if (opened) mark("open-card");
  }, [opened, mark]);
  return (
    <Phone label="Roadmap app" height={800}>
      <div className="relative flex h-full flex-col">
        <AppHeader kicker="100 Miles of Summer" title="Roadmap" />
        <div role="tablist" aria-label="Roadmap columns" className="flex shrink-0 flex-wrap gap-1.5 px-4 pb-3">
          {COLUMNS.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={c.id === column}
              data-step-target={c.id === "launch" ? (column === "launch" ? undefined : "card") : TARGET[c.id]}
              onClick={() => {
                onColumn(c.id);
                const m = MARK[c.id];
                if (m) mark(m);
              }}
              className={cn(
                "min-h-10 shrink-0 rounded-full border px-3 text-[13.5px] font-bold transition-colors",
                c.id === column ? "border-transparent text-on-accent" : "border-line text-muted hover:text-ink",
              )}
              style={c.id === column ? { background: c.color } : undefined}
            >
              {c.label}
            </button>
          ))}
        </div>
        <AppBody>
          <p className="px-1 text-[13.5px] font-semibold text-muted">{def.when}</p>
          <ul className="mt-2 space-y-2" role="tabpanel" aria-label={def.label}>
            {items.map((item, i) => (
              <Fragment key={item.id}>
                {item.group && item.group !== items[i - 1]?.group ? (
                  <li aria-hidden className={cn("px-1 text-[11px] font-black uppercase tracking-[0.12em] text-muted", i > 0 && "pt-3")}>
                    {item.group}
                  </li>
                ) : null}
                <li>
                  <button
                    type="button"
                    onClick={() => onOpen({ kind: "item", id: item.id })}
                    className="w-full rounded-2xl border border-line bg-surface p-3.5 text-left transition-colors hover:border-accent"
                    data-item={item.id}
                    data-step-target={column === "launch" && i === 0 ? "card" : undefined}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex items-center gap-2">
                        {item.step ? (
                          <span aria-hidden className="num flex size-[22px] shrink-0 items-center justify-center rounded-full text-[12px] font-black text-on-accent" style={{ background: def.color }}>
                            {item.step}
                          </span>
                        ) : (
                          <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: def.color, boxShadow: `0 0 10px ${def.color}` }} />
                        )}
                        <span className="text-[15.5px] font-bold leading-snug">{item.title}</span>
                      </span>
                      <span aria-hidden className="text-[18px] leading-none text-muted">
                        ›
                      </span>
                    </div>
                    {item.when ? <p className={cn("mt-1 text-[13px] font-bold text-accent-ink", item.step ? "pl-[30px]" : "pl-[18px]")}>{item.when}</p> : null}
                    <p className={cn("mt-1 text-[13.5px] leading-snug text-muted", item.step ? "pl-[30px]" : "pl-[18px]")}>{item.line}</p>
                    <Chips item={item} />
                  </button>
                </li>
              </Fragment>
            ))}
          </ul>
        </AppBody>
        {opened ? <Sheet opened={opened} onClose={() => onOpen(null)} /> : null}
      </div>
    </Phone>
  );
}
