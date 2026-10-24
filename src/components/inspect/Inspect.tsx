"use client";

// Explain / Inspect. Any surface wrapped in <Inspectable id> gets a quiet tag
// when Inspect is on (press I). The drawer answers four questions about the
// feature behind it, from the same blueprint the Build Explorer uses:
//   See · Why · How (demo and production) · Proof (receipts, tests, rules).

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FEATURE, type Feature } from "@/blueprint/features";
import { tickLabel } from "@/domain/calendar";
import { store, useLedger, useUI } from "@/lib/store";
import { Badge, MaturityBadge, OutcomeBadge, RuleChip, cn } from "@/components/ui/kit";

export function Inspectable({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  const { inspect } = useUI();
  const feature = FEATURE[id];
  return (
    <div className={cn("relative", inspect && feature && "rounded-[20px] outline outline-2 outline-offset-4 outline-dashed outline-[var(--accent)]", className)}>
      {children}
      {inspect && feature ? (
        <button
          type="button"
          onClick={() => store.setUI({ explain: id })}
          className="absolute -top-3 right-3 z-30 rounded-full bg-accent px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-on-accent shadow"
        >
          How this works · {feature.name}
        </button>
      ) : null}
    </div>
  );
}

/** A small inline trigger for places where an outline would be noisy. */
/** "How this works" drawers belong to a review build; the founder demo explains in place. */
export function ExplainButton({ id, label = "How this works" }: { id: string; label?: string }) {
  if (!SHOW_EXPLAIN) return null;
  return (
    <button type="button" onClick={() => store.setUI({ explain: id })} className="font-mono text-[11.5px] uppercase tracking-[0.06em] text-accent-ink underline-offset-4 hover:underline">
      {label}
    </button>
  );
}

const SHOW_EXPLAIN = false;

const TABS = ["See", "Why", "How", "Proof"] as const;
type Tab = (typeof TABS)[number];

export function InspectDrawer() {
  const { explain } = useUI();
  const feature = explain ? FEATURE[explain] : undefined;
  const [tab, setTab] = useState<Tab>("See");
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    if (!feature) return;
    opener.current = document.activeElement;
    setTab("See");
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") store.setUI({ explain: null });
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (opener.current instanceof HTMLElement) opener.current.focus();
    };
  }, [feature]);

  if (!feature) return null;
  return (
    <div className="fixed inset-0 z-[70] flex justify-end" role="presentation">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-[rgba(20,18,14,0.38)]" onClick={() => store.setUI({ explain: null })} />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`How it works: ${feature.name}`}
        data-mode="day"
        className="rise-in relative flex h-full w-full max-w-[560px] flex-col overflow-hidden bg-bg text-ink shadow-2xl outline-none"
      >
        <header className="border-b border-line px-6 pb-4 pt-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="eyebrow">Inside the system</div>
              <h2 className="display mt-1 text-[28px]">{feature.name}</h2>
            </div>
            <button type="button" onClick={() => store.setUI({ explain: null })} className="tap rounded-full px-3 text-[14px] text-muted hover:text-ink">
              Close
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <MaturityBadge maturity={feature.maturity} />
            <span className="text-[12.5px] text-muted">{feature.evidence}</span>
          </div>
          <div role="tablist" aria-label="Explain" className="mt-4 flex gap-1 rounded-full bg-surface-2 p-1">
            {TABS.map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                type="button"
                onClick={() => setTab(t)}
                className={cn("flex-1 rounded-full py-2 text-[14px] font-semibold", tab === t ? "bg-surface shadow" : "text-muted hover:text-ink")}
              >
                {t}
              </button>
            ))}
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5" role="tabpanel">
          {tab === "See" ? <p className="text-[17px] leading-relaxed">{feature.see}</p> : null}
          {tab === "Why" ? <p className="text-[17px] leading-relaxed">{feature.why}</p> : null}
          {tab === "How" ? <HowPanel feature={feature} /> : null}
          {tab === "Proof" ? <ProofPanel feature={feature} /> : null}
        </div>
        <footer className="border-t border-line px-6 py-3 text-[13px]">
          <Link href={`/build#${feature.id}`} onClick={() => store.setUI({ explain: null })} className="text-accent-ink underline underline-offset-4">
            Open in the Build Explorer
          </Link>
        </footer>
      </div>
    </div>
  );
}

function HowPanel({ feature }: { feature: Feature }) {
  return (
    <div className="space-y-6 text-[15px]">
      <div>
        <div className="eyebrow">In this demo</div>
        <p className="mt-2 leading-relaxed">{feature.demo.mechanism}</p>
        <ul className="mt-2 space-y-1 font-mono text-[12.5px] text-muted">
          {feature.demo.files.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </div>
      <div>
        <div className="eyebrow">In production (proposed)</div>
        <ol className="mt-2 space-y-3">
          {feature.production.map((l, i) => (
            <li key={i} className="flex gap-3">
              <span className="num mt-0.5 h-6 w-6 shrink-0 rounded-full bg-surface-2 text-center text-[12px] leading-6">{i + 1}</span>
              <span>
                <span className="font-semibold">{l.layer}.</span> <span className="text-muted">{l.detail}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="eyebrow">Data</div>
          <p className="mt-1 font-mono text-[12.5px] text-muted">{feature.data.join(" · ") || "—"}</p>
        </div>
        <div>
          <div className="eyebrow">Who may do it</div>
          <p className="mt-1 text-[13.5px] text-muted">{feature.auth}</p>
        </div>
      </div>
      <div>
        <div className="eyebrow">When it goes wrong</div>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
          {feature.failures.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </div>
      {feature.approvals.length ? (
        <div>
          <div className="eyebrow">Needs a person to approve</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
            {feature.approvals.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ProofPanel({ feature }: { feature: Feature }) {
  const ledger = useLedger();
  const receipts = useMemo(() => ledger.filter((r) => feature.commands.includes(r.type)).slice(-6).reverse(), [ledger, feature]);
  return (
    <div className="space-y-6 text-[15px]">
      <div>
        <div className="eyebrow">Latest receipts from this session</div>
        {receipts.length === 0 ? (
          <p className="mt-2 text-muted">Nothing yet. Use the feature and its receipts appear here, produced by the same engine the tests run.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {receipts.map((r) => (
              <li key={r.seq} className="card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="num text-[12px] text-muted">#{r.seq}</span>
                  <OutcomeBadge outcome={r.outcome} />
                  <span className="font-mono text-[12px]">{r.type}</span>
                  <span className="text-[12px] text-muted">{tickLabel(r.at)}</span>
                </div>
                <p className="mt-1.5 text-[14px]">{r.summary}</p>
                <Link href={`/xray?r=${r.seq}`} onClick={() => store.setUI({ explain: null })} className="mt-1 inline-block font-mono text-[11.5px] text-accent-ink underline">
                  Open stage by stage
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      {feature.tests.length ? (
        <div>
          <div className="eyebrow">Tests that pin this behaviour</div>
          <ul className="mt-2 space-y-1 text-[13.5px]">
            {feature.tests.map((t) => (
              <li key={t} className="flex gap-2">
                <Badge tone="ok">test</Badge>
                <span className="text-muted">{t}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {feature.rules.length ? (
        <div>
          <div className="eyebrow">Rules it enforces</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {feature.rules.map((r) => (
              <RuleChip key={r} id={r} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
