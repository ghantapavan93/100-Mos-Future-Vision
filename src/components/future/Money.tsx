"use client";

// The money, with the team folded in: where a summer's money comes from, stream
// by stream, against the team it has to pay for. The roles on the right switch
// on and off, and the cost line on every summer moves with them. Low, middle and
// high summers share one scale, so switching shows the difference honestly. The
// relay is an option she may choose, never part of a case. The headline is the
// plain reading — one big partner carries Year 10 — and the same model drives
// the Sponsors screen (partner/yearTen.ts), so the two never disagree.
// Never a red loss: "still to raise".

import { useState } from "react";
import { FTE_LOAD, type Year } from "@/domain/plans";
import { cn } from "@/components/ui/kit";
import { Reveal } from "@/components/ui/Reveal";
import {
  CASE_LABEL,
  PRESENTING_TOP,
  RELAY_OPTION,
  ROLES,
  STREAMS,
  SUMMER_YEARS,
  companies,
  gapFor,
  k,
  moneyIn,
  othersIn,
  teamCost,
  topPartnerCloses,
  totalIn,
  type Case,
  type RoleId,
} from "./proof";
import { SectionHead } from "./SectionHead";

/** Every bar shares one scale, so a summer's bar means the same money in each case. */
export const MONEY_MAX = 400_000;
const CASES: Case[] = ["low", "mid", "high"];
const TICKS = [0, 100_000, 200_000, 300_000, 400_000];
const ORDER = ["Hire first", "Hire next", "Then", "As the money comes"] as const;

/** How three movements like this one pay their way, without names. */
const LIKE_US: { who: string; mix: string; note: string }[] = [
  { who: "The world's biggest free weekly run", mix: "36% shop · 33% partners · 19% grants", note: "Free to join and sponsor-backed — closest to you." },
  { who: "A girls' running program", mix: "41% donations · 41% program fees", note: "Families pay for a season; donors cover the rest." },
  { who: "A women's walking movement", mix: "92% donations", note: "Almost all from giving." },
];

const frac = (v: number) => Math.min(v, MONEY_MAX) / MONEY_MAX;
const pct = (v: number) => `${frac(v) * 100}%`;

function Switch({ on, label, onToggle }: { on: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className={cn("tap relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border transition-colors", on ? "border-accent bg-accent" : "border-line-strong bg-surface-2")}
    >
      <span aria-hidden className={cn("absolute size-6 rounded-full bg-ink shadow transition-transform duration-200", on ? "translate-x-[26px] bg-on-accent" : "translate-x-[3px]")} />
    </button>
  );
}

function Row({ year, c, relay, team, active, onActive }: { year: Year; c: Case; relay: boolean; team: number; active: boolean; onActive: (y: Year | null) => void }) {
  const parts = moneyIn(year, c, relay);
  const total = totalIn(year, c, relay);
  const shown = STREAMS.filter((s) => parts[s.id] > 0);
  const short = team > total;
  return (
    <div
      className="cursor-pointer rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-sun sm:grid sm:grid-cols-[44px_1fr_112px] sm:items-center sm:gap-x-3"
      data-year={year}
      role="img"
      tabIndex={0}
      onPointerEnter={() => onActive(year)}
      onPointerLeave={() => onActive(null)}
      onClick={() => onActive(year)}
      onFocus={() => onActive(year)}
      onBlur={() => onActive(null)}
      aria-label={`${year}: ${k(total)} in — ${shown.map((s) => `${s.label} ${k(parts[s.id])}`).join(", ")}. Team ${k(team)}.`}
    >
      <div className="flex items-baseline justify-between gap-3 sm:contents">
        <span className="num text-[14px] font-bold">{year}</span>
        <div className="text-right leading-tight sm:order-3">
          <div className="num text-[13.5px] font-bold">{k(total)} in</div>
          {team > 0 ? <div className="num text-[11.5px] text-muted">{short ? `${k(team - total)} to raise` : `${k(total - team)} left over`}</div> : null}
        </div>
      </div>
      <div className="relative mt-1.5 h-[22px] sm:order-2 sm:mt-0">
        {/* The stack: one segment per stream, a 2px surface gap between, rounded only at the data end. */}
        <div className={cn("absolute inset-y-0 left-0 flex gap-[2px] transition-[width] duration-500 ease-out", active && "brightness-125")} style={{ width: pct(total) }}>
          {shown.map((s, i) => (
            <span key={s.id} className={cn("h-full min-w-[2px]", i === shown.length - 1 && "rounded-r-[4px]")} style={{ flexGrow: parts[s.id], flexBasis: 0, background: s.color }} />
          ))}
        </div>
        {/* What's still to raise: a quiet wash from where the money ends to where the team's cost sits. */}
        {short ? (
          <span aria-hidden className="absolute inset-y-0 rounded-r-[4px] bg-ink/[0.07] transition-all duration-500 ease-out" style={{ left: `calc(${pct(total)} + 2px)`, width: `calc(${(frac(team) - frac(total)) * 100}% - 2px)` }} />
        ) : null}
        {team > 0 ? <span aria-hidden className="absolute -bottom-1 -top-1 w-[2px] rounded-full bg-ink shadow-[0_0_0_2px_var(--surface)] transition-[left] duration-500" style={{ left: pct(team) }} /> : null}
      </div>
    </div>
  );
}

/** The team, in hiring order, as switches: what each role costs in Year 10 and what it takes off her plate. */
function TeamPanel({ on, onToggle }: { on: ReadonlySet<RoleId>; onToggle: (id: RoleId) => void }) {
  return (
    <div className="card p-5 sm:p-6" id="team">
      <div className="text-[16px] font-bold">The team, in hiring order</div>
      <p className="mt-1 text-[14px] leading-snug text-muted">Four roles, in order. Each one takes something specific off your plate. Turn one off to see what can wait.</p>
      <ol className="mt-4 space-y-2.5" aria-label="Hiring ladder">
        {ROLES.map((role, i) => {
          const active = on.has(role.id);
          return (
            <li key={role.id} data-role={role.id} data-on={String(active)} className={cn("rounded-2xl border border-line bg-surface p-3.5 transition-opacity", !active && "opacity-55")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-black uppercase tracking-[0.1em] text-accent-ink">{ORDER[i]}</div>
                  <div className="mt-0.5 text-[15px] font-bold leading-snug">{role.title}</div>
                  <p className="mt-0.5 text-[13px] leading-snug text-muted">Frees you from {role.frees}</p>
                  {/* Each part stays whole on a phone; a role on commission says so once. */}
                  <div className={cn("num mt-1 text-[13px] font-bold", !active && "line-through decoration-muted")} data-cost-2027>
                    <span className="whitespace-nowrap">Year 10: {role.years[2027].cost ? k(role.years[2027].cost) : "on commission"}</span>
                    {role.years[2027].cost ? (
                      <>
                        {" "}
                        <span className="whitespace-nowrap font-normal text-muted">· {role.years[2027].what}</span>
                      </>
                    ) : null}
                  </div>
                </div>
                <Switch on={active} label={`${role.title}: ${active ? "on" : "off"}`} onToggle={() => onToggle(role.id)} />
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-[12.5px] leading-snug text-muted">Costs include benefits and taxes, about {FTE_LOAD}× the salary. Partnerships starts on commission, paid only from the money it brings in.</p>
    </div>
  );
}

export function MoneySection({
  index = "03",
  moneyCase,
  onCase,
  on,
  onToggle,
}: {
  index?: string;
  moneyCase: Case;
  onCase: (c: Case) => void;
  on: ReadonlySet<RoleId>;
  onToggle: (id: RoleId) => void;
}) {
  const [active, setActive] = useState<Year | null>(null);
  const [table, setTable] = useState(false);
  const [relay, setRelay] = useState(false);
  const team10 = teamCost(2027, on);
  const big = topPartnerCloses(2027, on);
  const bigAndRelay = topPartnerCloses(2027, on, true);
  const gap = gapFor(2027, moneyCase, on, relay);
  const tip = active ? moneyIn(active, moneyCase, relay) : null;
  const caseWord = CASE_LABEL[moneyCase].toLowerCase();

  const lede =
    team10 === 0
      ? "With no paid team, every dollar goes to the walks — and every task lands on you and your Leads."
      : `A lean team costs about ${k(team10)}. Everything else brings about ${k(othersIn(2027, "mid"))} in a middle summer. One big partner at about ${k(PRESENTING_TOP)} ${
          big.left >= 0
            ? "covers it."
            : `gets within ${k(-big.left)} — and a Year 10 relay, if you choose one, ${bigAndRelay.left >= 0 ? "covers the rest." : `gets within ${k(-bigAndRelay.left)}.`}`
        }`;

  const reading =
    gap.team === 0
      ? `With no paid team, a ${caseWord} Year 10 brings ${k(gap.money)} — and everything lands on you.`
      : gap.left >= 0
        ? `A ${caseWord} Year 10 brings ${k(gap.money)} and pays for this team, with ${k(gap.left)} left over.`
        : `A ${caseWord} Year 10 brings ${k(gap.money)}: ${k(-gap.left)} still to raise for this team.`;
  const partnerLine = (() => {
    if (moneyCase !== "mid" || gap.left >= 0 || gap.team === 0) return null;
    const fix = topPartnerCloses(2027, on, relay);
    return fix.left >= 0
      ? `With one big partner at about ${k(PRESENTING_TOP)} instead, Year 10 pays for this team with ${k(fix.left)} left over.`
      : `With one big partner at about ${k(PRESENTING_TOP)} instead, Year 10 gets within ${k(-fix.left)}.${relay ? "" : " A relay, if you choose one, adds " + k(RELAY_OPTION) + "."}`;
  })();

  return (
    <section id="money" aria-labelledby="money-title" className="mx-auto w-full max-w-[1320px] px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <SectionHead id="money" index={index} label="The money and the team" title="Year 10 needs *one big partner.*" lede={lede} why="free to join only works when partners pay for the summer." />

      {/* grid-cols-1 caps the phone column at the screen width, so the open table scrolls inside its card. */}
      <div className="mt-10 grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* The chart stays in view beside the longer team list, so switching a role shows its cost line move. */}
        <Reveal className="lg:sticky lg:top-20 lg:col-span-8">
          <div className="flex flex-wrap items-center gap-3">
            <div role="radiogroup" aria-label="What kind of summer" className="inline-grid grid-cols-3 gap-1 rounded-2xl bg-surface-2 p-1">
              {CASES.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={moneyCase === c}
                  onClick={() => onCase(c)}
                  className={cn("tap min-w-[84px] rounded-xl px-4 text-[14px] font-bold transition-colors", moneyCase === c ? "bg-ink text-bg" : "text-muted hover:text-ink")}
                >
                  {CASE_LABEL[c]}
                </button>
              ))}
            </div>
            <button
              type="button"
              aria-pressed={relay}
              onClick={() => setRelay((r) => !r)}
              className={cn("tap rounded-2xl border px-4 text-left text-[13.5px] font-bold leading-tight transition-colors", relay ? "border-transparent bg-ink text-bg" : "border-line-strong hover:border-accent")}
            >
              {relay ? "✓ " : "+ "}A Year 10 relay · {k(RELAY_OPTION)}
              <span className="block text-[11.5px] font-semibold opacity-75">only if you choose one</span>
            </button>
          </div>

          <figure className="card mt-4 p-5 sm:p-7" aria-labelledby="money-chart-title">
            <figcaption id="money-chart-title" className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-[16px] font-bold">Where a {caseWord} summer&apos;s money comes from</span>
              <button type="button" onClick={() => setTable((t) => !t)} aria-expanded={table} className="tap text-[14px] font-bold text-accent-ink underline-offset-4 hover:underline">
                {table ? "Hide the numbers" : "See the numbers"}
              </button>
            </figcaption>

            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-muted" aria-label="Key">
              {STREAMS.filter((s) => s.id !== "relay" || relay).map((s) => (
                <li key={s.id} className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="h-2.5 w-3.5 rounded-[2px]" style={{ background: s.color }} />
                  {s.label}
                </li>
              ))}
              <li className="inline-flex items-center gap-1.5">
                <span aria-hidden className="h-3 w-[2px] rounded-full bg-ink" />
                Team cost
              </li>
            </ul>

            <div className="relative mt-5">
              {/* Recessive hairline grid on the shared scale. */}
              <div aria-hidden className="pointer-events-none absolute inset-y-0 left-[56px] right-[124px] hidden sm:block">
                {TICKS.map((t) => (
                  <span key={t} className="absolute inset-y-0 w-px bg-line" style={{ left: pct(t) }} />
                ))}
              </div>
              <div className="relative space-y-5 py-1">
                {SUMMER_YEARS.map((y) => (
                  <Row key={y} year={y} c={moneyCase} relay={relay} team={teamCost(y, on)} active={active === y} onActive={setActive} />
                ))}
              </div>
              <div aria-hidden className="mt-2 flex justify-between text-[11.5px] text-muted sm:hidden">
                <span className="num">$0</span>
                <span className="num">{k(MONEY_MAX)}</span>
              </div>
              <div aria-hidden className="relative ml-[56px] mr-[124px] mt-2 hidden h-4 text-[11.5px] text-muted sm:block">
                {TICKS.map((t) => (
                  <span key={t} className="num absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full" style={{ left: pct(t) }}>
                    {t === 0 ? "$0" : k(t)}
                  </span>
                ))}
              </div>
            </div>

            {/* The readout: a summer's streams once one is tapped, hovered or focused, in a slot that never moves the layout. */}
            <div aria-hidden className="mt-4 min-h-[52px] rounded-2xl bg-surface-2/60 px-3.5 py-2.5 text-[13px]">
              {tip && active ? (
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <span className="num text-[14px] font-bold">
                    {active} · {k(totalIn(active, moneyCase, relay))} in
                  </span>
                  {STREAMS.filter((s) => tip[s.id] > 0).map((s) => (
                    <span key={s.id} className="inline-flex items-center gap-1.5">
                      <span className="h-[2px] w-3 rounded-full" style={{ background: s.color }} />
                      <span className="num font-bold">{k(tip[s.id])}</span>
                      <span className="text-muted">{s.label}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-muted">Tap a summer to see each stream.</span>
              )}
            </div>

            <p className="mt-5 text-[15px] font-semibold leading-snug" data-money-reading aria-live="polite">
              {reading}
            </p>
            {partnerLine ? (
              <p className="mt-1 text-[14px] leading-snug text-muted" data-partner-line>
                {partnerLine}
              </p>
            ) : null}

            {table ? (
              <div className="mt-5 overflow-x-auto">
                {/* On phones the table fits the card: the teams note drops under its stream, and padding tightens. */}
                <table className="w-full text-left text-[13px] sm:min-w-[420px] sm:text-[13.5px] [&_td]:pr-2 sm:[&_td]:pr-3">
                  <caption className="sr-only">Money in by stream and the team cost, {caseWord} summer</caption>
                  <thead>
                    <tr className="border-b border-line text-muted">
                      <th scope="col" className="py-2 pr-3 font-semibold">
                        Stream
                      </th>
                      {SUMMER_YEARS.map((y) => (
                        <th key={y} scope="col" className="num py-2 pr-3 text-right font-semibold">
                          {y}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  {/* Figures in the number face; the stream names stay in the text face. */}
                  <tbody className="tabular-nums">
                    {STREAMS.filter((s) => s.id !== "relay" || relay).map((s) => (
                      <tr key={s.id} className="border-b border-line/60">
                        <th scope="row" className="py-1.5 pr-3 font-normal">
                          {s.label}
                          {s.id === "teams" ? (
                            <span className="text-muted max-sm:block max-sm:text-[12px]">
                              <span className="max-sm:hidden"> · </span>
                              {SUMMER_YEARS.map((y) => companies(y, moneyCase)).join(" → ")} teams
                            </span>
                          ) : null}
                        </th>
                        {SUMMER_YEARS.map((y) => (
                          <td key={y} className="num py-1.5 pr-3 text-right">
                            {moneyIn(y, moneyCase, relay)[s.id] ? k(moneyIn(y, moneyCase, relay)[s.id]) : "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr className="border-b border-line font-bold">
                      <th scope="row" className="py-1.5 pr-3">
                        Money in
                      </th>
                      {SUMMER_YEARS.map((y) => (
                        <td key={y} className="num py-1.5 pr-3 text-right">
                          {k(totalIn(y, moneyCase, relay))}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <th scope="row" className="py-1.5 pr-3 font-normal text-muted">
                        Team <span className="max-lg:hidden">(the roles on the right)</span>
                        <span className="lg:hidden">(the roles below)</span>
                      </th>
                      {SUMMER_YEARS.map((y) => (
                        <td key={y} className="num py-1.5 pr-3 text-right text-muted">
                          {k(teamCost(y, on))}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
                <ul className="mt-3 space-y-1 text-[13px] leading-snug text-muted">
                  {STREAMS.map((s) => (
                    <li key={s.id}>
                      <b className="font-semibold text-ink/85">{s.label}:</b> {s.line}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </figure>
          <p className="mt-3 text-[13.5px] leading-snug text-muted">Planning numbers, not forecasts. Cities grow 7 → 10 → 14. Kayla sets the real prices.</p>
        </Reveal>

        <Reveal className="lg:col-span-4" delay={80}>
          <TeamPanel on={on} onToggle={onToggle} />
        </Reveal>
      </div>
    </section>
  );
}

/** How movements like this one pay their way — behind "More", so the money section stays one idea. */
export function Comparables() {
  return (
    <div>
      <div className="eyebrow">How movements like this pay their way</div>
      <ul className="mt-3 grid gap-3 sm:grid-cols-3">
        {LIKE_US.map((m, i) => (
          <li key={m.who} className={cn("rounded-2xl border p-4", i === 0 ? "border-accent/50 bg-accent/10" : "border-line bg-surface")}>
            <div className="text-[14px] font-semibold text-muted">{m.who}</div>
            <div className="mt-1 text-[17px] font-bold leading-snug">{m.mix}</div>
            <div className="mt-1 text-[13.5px] leading-snug text-muted">{m.note}</div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[15px] font-semibold leading-snug">Partners and the shop carry the summer; small grants fund the neighborhood walks. Nobody pays to join.</p>
    </div>
  );
}
