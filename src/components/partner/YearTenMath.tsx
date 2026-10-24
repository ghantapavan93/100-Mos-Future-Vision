"use client";

// "Year 10 needs one big partner": the honest money math on one chart, from the
// same model as Next 3 summers. Pick a case, drag the presenting partner, add a
// relay only if she chooses one, and watch the bar meet (or miss) the cost of a
// lean Year 10 team. Under it: what that partner's money would pay for, and what
// the partner gets — totals, never people.

import { useMemo, useState } from "react";
import { usd } from "@/domain/finance";
import { hotWord } from "@/components/demo/TryIt";
import { cn } from "@/components/ui/kit";
import { Reveal, Words } from "@/components/ui/Reveal";
import { BIG_PARTNER, CASE_WORDS, PRESENTING, PRESENTING_MAX, RELAY, STREAMS, TEAM_COST, paysFor, picture, type Case } from "./yearTen";

const STREAM_COLOR: Record<string, string> = {
  packages: "#ffc14d",
  shop: "#9fd36b",
  teams: "#e0894a",
  relay: "#c9c2ea",
  grants: "#5fd3a2",
  presenting: "#ff6a13",
};

const GETS = [
  "Their name on the season, alongside the partners you already have",
  "Their own team walking as a company team",
  "The season report: walks, people checked in, first-timers — totals only",
  "An early talk about Year 11, if Kayla wants one",
];

/** "$71K" — thousands, for a chart a person reads at a glance. */
const k = (n: number) => `$${Math.round(n / 1000)}K`;

export function YearTenMath({ index = "02" }: { index?: string }) {
  const [c, setCase] = useState<Case>("middle");
  const [presenting, setPresenting] = useState(PRESENTING.middle);
  const [relay, setRelay] = useState(false);
  const pic = useMemo(() => picture(c, presenting, relay), [c, presenting, relay]);
  // The lede's numbers: a middle summer with one big partner, with and without a relay.
  const middle = picture("middle", 0);
  const withBig = picture("middle", BIG_PARTNER);
  const pays = useMemo(() => paysFor(presenting), [presenting]);
  const pick = (next: Case) => {
    setCase(next);
    setPresenting(PRESENTING[next]);
  };

  // The bar's scale always leaves room past the team's cost, so the gap is visible.
  const scale = Math.max(TEAM_COST * 1.18, pic.total * 1.04);
  const at = (n: number) => `${(n / scale) * 100}%`;
  const parts = [
    ...STREAMS.map((s) => ({ id: s.id as string, label: s.label, value: s.amounts[c] })),
    { id: "relay", label: "Relay title partner", value: pic.relay },
    { id: "presenting", label: "Presenting partner", value: presenting },
  ].filter((p) => p.value > 0);
  const closer =
    pic.need <= BIG_PARTNER
      ? `A presenting partner of ${k(pic.need)} closes it.`
      : `One big partner (about ${k(BIG_PARTNER)}) gets within ${k(pic.need - BIG_PARTNER)} — a relay or more company teams closes the rest.`;

  const verdict = pic.covers
    ? { tone: "ok", text: `Covers a lean Year 10 team, with ${k(pic.total - TEAM_COST)} to spare.` }
    : { tone: "warn", text: `${k(pic.short)} short of a lean team.` };

  return (
    <section id="year-ten" aria-labelledby="year-ten-title" className="mx-auto w-full max-w-[1320px] px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="index-line">
        <b>{index}</b> The Year 10 math
      </div>
      <div className="mt-6 grid gap-x-12 gap-y-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-end">
        <h2 id="year-ten-title" className="t-section">
          <Words text="Year 10 needs *one big partner.*" render={hotWord} />
        </h2>
        <Reveal>
          <p className="t-lede">
            A lean Year 10 team costs about {k(TEAM_COST)}. City packages, company teams, grants and the shop bring about {k(middle.others)} in a middle summer. One big partner at about{" "}
            {k(BIG_PARTNER)} gets within {k(withBig.short)} — and a Year 10 relay, if you choose one, covers the rest.
          </p>
        </Reveal>
      </div>

      <Reveal className="card mt-10 p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div role="group" aria-label="Money case" className="grid grid-cols-3 gap-1 rounded-full bg-surface-2 p-1">
            {(Object.keys(CASE_WORDS) as Case[]).map((x) => (
              <button key={x} type="button" aria-pressed={c === x} onClick={() => pick(x)} className={cn("min-h-10 rounded-full px-4 text-[14px] font-bold", c === x ? "bg-ink text-bg" : "text-muted hover:text-ink")}>
                {CASE_WORDS[x]}
              </button>
            ))}
          </div>
          <label className="flex min-w-[260px] flex-1 flex-col gap-1 sm:max-w-[420px]">
            <span className="flex items-baseline justify-between text-[14px] font-bold">
              <span>Presenting partner</span>
              <span className="num font-[family-name:var(--font-display)] text-[22px] font-black text-accent" data-testid="presenting-amount">
                {usd(presenting)}
              </span>
            </span>
            <input type="range" aria-label="Presenting partner" min={0} max={PRESENTING_MAX} step={5000} value={presenting} onChange={(e) => setPresenting(Number(e.currentTarget.value))} />
          </label>
          <button
            type="button"
            aria-pressed={relay}
            onClick={() => setRelay((r) => !r)}
            className={cn("min-h-11 rounded-full border px-4 text-[13.5px] font-bold transition-colors", relay ? "border-transparent bg-ink text-bg" : "border-line-strong hover:border-accent")}
          >
            {relay ? "✓ " : "+ "}Add a Year 10 relay · {usd(RELAY)}
            <span className="block text-[11.5px] font-semibold opacity-75">only if you choose one</span>
          </button>
        </div>

        {/* The bar: every stream stacked, against the lean team's cost (the dashed line). */}
        <div className="mt-8">
          <div className="relative h-5">
            {/* Ends where the band ends, so it never runs off a narrow screen. */}
            <span className="absolute bottom-0 whitespace-nowrap text-[11.5px] font-bold uppercase tracking-[0.08em] text-muted" style={{ right: `calc(100% - ${at(TEAM_COST)})` }}>
              A lean team · {k(TEAM_COST)}
            </span>
          </div>
          <div className="relative mt-2">
            <div
              role="img"
              aria-label={`${parts.map((p) => `${p.label} ${usd(p.value)}`).join(", ")}. Total ${usd(pic.total)} against a lean team of ${usd(TEAM_COST)}.`}
              className="flex h-12 overflow-hidden rounded-xl bg-surface-2"
            >
              {parts.map((p) => (
                <div key={p.id} className="h-full border-r border-bg/60 transition-[width] duration-500 ease-out last:border-r-0" style={{ width: at(p.value), background: STREAM_COLOR[p.id] }} title={`${p.label}: ${usd(p.value)}`} />
              ))}
            </div>
            {/* The lean team's cost: a line the bar has to reach. */}
            <div aria-hidden className="pointer-events-none absolute -inset-y-1.5 w-0 border-l-2 border-dashed border-ink/70" style={{ left: at(TEAM_COST) }} />
          </div>
          <div className="mt-3 text-[13px] text-muted">
            Total <span className="num font-bold text-ink" data-testid="year-ten-total">{usd(pic.total)}</span>
          </div>
        </div>

        <p className={cn("rounded-2xl p-3.5 text-[15px] font-bold leading-snug", verdict.tone === "ok" ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn")} aria-live="polite" data-testid="year-ten-verdict">
          {verdict.text}
          {!pic.covers ? <span className="block text-[13.5px] font-semibold opacity-90">{closer}</span> : null}
        </p>

        <ul className="mt-5 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ...STREAMS.map((s) => ({ id: s.id as string, label: s.label, note: s.note, value: s.amounts[c] })),
            ...(relay ? [{ id: "relay", label: "Relay title partner", note: "one day, every city — your choice", value: pic.relay }] : []),
            { id: "presenting", label: "Presenting partner", note: "one partner, the whole season", value: presenting },
          ].map((s) => (
            <li key={s.id} className="flex items-start gap-2.5">
              <span aria-hidden className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: STREAM_COLOR[s.id] }} />
              <span className="min-w-0">
                <span className="block text-[13.5px] font-bold leading-tight">{s.label}</span>
                <span className="num block text-[13.5px]">{usd(s.value)}</span>
                <span className="block text-[12px] leading-snug text-muted">{s.note}</span>
              </span>
            </li>
          ))}
        </ul>
      </Reveal>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Reveal className="card p-6">
          <div className="eyebrow">What {usd(presenting)} pays for</div>
          <ul className="mt-3 space-y-3" data-testid="presenting-pays-for">
            {presenting === 0 ? (
              <li className="text-[15px] text-muted">Nothing yet — drag the presenting partner above.</li>
            ) : (
              <>
                <li className="flex items-baseline justify-between gap-3">
                  <span className="text-[15.5px] font-bold">Seven City Lead stipends</span>
                  <span className="num shrink-0 text-[15px]">{usd(pays.stipends)}</span>
                </li>
                {pays.managerMonths > 0 ? (
                  <li className="flex items-baseline justify-between gap-3">
                    <span className="text-[15.5px] font-bold">
                      {pays.managerMonths} month{pays.managerMonths === 1 ? "" : "s"} of a full-time program & community manager
                    </span>
                    <span className="num shrink-0 text-[15px]">{usd(presenting - pays.stipends - pays.rest)}</span>
                  </li>
                ) : null}
                {pays.rest > 0 ? (
                  <li className="flex items-baseline justify-between gap-3">
                    <span className="text-[15.5px] font-bold">Toward the Year 10 build</span>
                    <span className="num shrink-0 text-[15px]">{usd(pays.rest)}</span>
                  </li>
                ) : null}
              </>
            )}
          </ul>
          <p className="mt-4 border-t border-line pt-3 text-[13px] leading-snug text-muted">
            One way to spend it, in hiring order, with benefits and taxes included. The lean team is a program & community manager, a quarter of an engineer for the Year 10 build, and
            seven City Lead stipends.
          </p>
        </Reveal>
        <Reveal className="card p-6" delay={80}>
          <div className="eyebrow">What the partner gets</div>
          <ul className="mt-3 space-y-2.5">
            {GETS.map((g) => (
              <li key={g} className="flex gap-2.5 text-[15.5px] leading-snug">
                <span aria-hidden className="mt-0.5 text-accent-ink">
                  ✓
                </span>
                {g}
              </li>
            ))}
            <li className="flex gap-2.5 text-[15.5px] font-bold leading-snug">
              <span aria-hidden className="mt-0.5 text-bad">
                ✕
              </span>
              Never names, emails, routes or health data
            </li>
          </ul>
        </Reveal>
      </div>
      <p className="mt-4 text-[13px] text-muted">Planning ranges, not a forecast. Kayla sets the real prices.</p>
    </section>
  );
}
