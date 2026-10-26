"use client";

// The sponsor's app, on a phone. Three tabs, one job each:
//   Fund       — pick cities and a package, set the fee, see where every dollar goes;
//   Money      — the summer's sponsor money, then sign, pay, go live, in that order;
//   Brand view — what the sponsor actually gets: totals, never people, and a
//                season report Kayla can forward.
// Every tap is a real command through the same engine as every other screen.
// The control that finishes each "Try it" step carries data-step-target, so the
// guiding ring can point at it.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { dayLabel } from "@/domain/calendar";
import { campaignReport, type Receipt } from "@/domain/engine";
import { economics, usd } from "@/domain/finance";
import type { Proposal, ProposalInputs, World } from "@/domain/types";
import { AppBody, AppHeader, AppTabs, Phone } from "@/components/demo/Phone";
import { plain } from "@/components/demo/plain";
import { useMarkStep } from "@/components/demo/TryIt";
import { cn } from "@/components/ui/kit";
import { actors, store, useWorld } from "@/lib/store";
import { MONEY_COLOR } from "./moneyColors";

export type PartnerTab = "fund" | "deal" | "brand";

export interface PartnerPhoneState {
  tab: PartnerTab;
  /** "See what the brand sees": totals only. */
  brandView: boolean;
  report: boolean;
}

/**
 * What a brand can fund, as walks per city. Company teams are Kayla's own Year
 * 10 goal: the package supports it and says so, rather than pitching it as new.
 */
export const PACKAGES: { id: string; name: string; line: string; walks: number; tag?: string }[] = [
  { id: "kickoff", name: "Kickoff", line: "One big first walk in each city.", walks: 1 },
  { id: "series", name: "Summer series", line: "Kickoff, a midsummer walk and a finish party.", walks: 3 },
  { id: "company", name: "Company team", tag: "Your Year 10 goal", line: "A company signs up its staff in teams — about $4,000 a team for six weeks of team walks.", walks: 6 },
  { id: "saturdays", name: "Every Saturday", line: "Ten Saturday walks in each city.", walks: 10 },
];

/** The two cities the "Try it" step suggests, in the order the ring points at them. */
const SUGGESTED_CITIES = ["detroit", "charleston"];

const DEAL_WORDS: Record<Proposal["stage"], string> = {
  inquiry: "Talking",
  qualified: "Interested",
  proposal: "Offer ready",
  contract: "Signed",
  live: "Live",
  reported: "Report sent",
  renewed: "Coming back",
  lost: "Said no",
};

const via = { via: "partner-app" };

/**
 * The deal as it would be signed: one community per city picked. The phone
 * previews it from the picked cities, and signing writes the count once, so
 * picking cities never floods "what just happened" with bookkeeping.
 */
export function asSigned(proposal: Proposal): ProposalInputs {
  if (proposal.signedAt !== null || proposal.chapterIds.length === 0) return proposal.inputs;
  return { ...proposal.inputs, communities: proposal.chapterIds.length };
}

/** Every sponsor's money this summer, by how real it is: in the bank, signed and on its way, or only offered. */
export function sponsorMoney(world: World): { inBank: number; onItsWay: number; offered: number } {
  const all = Object.values(world.proposals).filter((p) => p.stage !== "lost");
  const sum = (ps: Proposal[]) => ps.reduce((s, p) => s + p.inputs.fee, 0);
  return {
    inBank: sum(all.filter((p) => p.paidAt !== null)),
    onItsWay: sum(all.filter((p) => p.signedAt !== null && p.paidAt === null)),
    offered: sum(all.filter((p) => p.signedAt === null)),
  };
}

function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="mt-5">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h4 className="text-[12px] font-black uppercase tracking-[0.12em] text-muted">{title}</h4>
        {right}
      </div>
      {children}
    </section>
  );
}

function BigButton({
  children,
  onClick,
  disabled,
  tone = "accent",
  label,
  target,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "accent" | "quiet";
  label?: string;
  /** The "Try it" step this button finishes. */
  target?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      data-step-target={target}
      className={cn(
        "min-h-12 w-full rounded-2xl px-4 text-[15px] font-black uppercase tracking-[0.06em] transition-[transform,opacity] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40",
        tone === "accent" ? "bg-accent text-on-accent shadow-[0_8px_30px_-8px_rgba(255,106,19,0.7)]" : "border border-line-strong text-ink",
      )}
    >
      {children}
    </button>
  );
}

// ── Fund ────────────────────────────────────────────────────────────────────

function FeeSlider({ proposal, locked }: { proposal: Proposal; locked: boolean }) {
  const mark = useMarkStep();
  const [fee, setFee] = useState(proposal.inputs.fee);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => setFee(proposal.inputs.fee), [proposal.inputs.fee, proposal.id]);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  // Dragging sends one command when the hand stops, not one per pixel.
  const commit = (value: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (value === proposal.inputs.fee) return;
      store.dispatch({ type: "SET_PROPOSAL_INPUT", payload: { proposalId: proposal.id, key: "fee", value } }, actors.founder, via);
      mark("fee");
    }, 250);
  };
  return (
    <div data-step-target="fee" className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-[14px] font-bold">The fee</span>
        <span className="num font-[family-name:var(--font-display)] text-[30px] font-black leading-none">{usd(fee)}</span>
      </div>
      <input
        type="range"
        aria-label="Program fee"
        min={1000}
        max={20000}
        step={500}
        value={fee}
        disabled={locked}
        onChange={(e) => {
          const v = Number(e.currentTarget.value);
          setFee(v);
          commit(v);
        }}
        className="mt-3 w-full disabled:opacity-40"
      />
      <div className="mt-1 flex justify-between text-[12px] text-muted">
        <span>$1,000</span>
        <span>$20,000</span>
      </div>
    </div>
  );
}

/** Where every dollar goes, as one bar a sponsor and a founder can both read. */
function DollarBar({ proposal }: { proposal: Proposal }) {
  const e = economics(asSigned(proposal));
  const running = e.delivery + e.processing;
  const left = e.contribution;
  const parts = [
    { label: "Running the walks", value: running, color: MONEY_COLOR.delivery, note: "permits, water, shirts, City Lead thank-yous, photos" },
    { label: "Staff time", value: e.staffCost, color: MONEY_COLOR.staff, note: "setting it up and reporting back" },
    { label: "Giving back", value: e.impact, color: MONEY_COLOR.impact, note: "for a program members choose" },
    {
      label: left >= 0 ? "Left for the team" : "Not covered yet",
      value: Math.abs(left),
      color: left >= 0 ? MONEY_COLOR.left : MONEY_COLOR.loss,
      note: left >= 0 ? "keeps 100 Miles running" : "the costs are more than the fee",
    },
  ];
  const whole = Math.max(1, e.revenue, running + e.staffCost + e.impact);
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex h-4 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={parts.map((p) => `${p.label} ${usd(p.value)}`).join(", ")}>
        {parts.slice(0, left >= 0 ? 4 : 3).map((p) => (
          <div key={p.label} className="h-full transition-[width] duration-500" style={{ width: `${(p.value / whole) * 100}%`, background: p.color }} />
        ))}
      </div>
      <ul className="mt-3 space-y-2">
        {parts.map((p) => (
          <li key={p.label} className="flex items-start gap-2.5">
            <span aria-hidden className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
            <span className="min-w-0 flex-1">
              <span className={cn("block text-[14px] font-bold", p.label === "Not covered yet" && "text-bad")}>{p.label}</span>
              <span className="block text-[12.5px] leading-snug text-muted">{p.note}</span>
            </span>
            <span className={cn("num text-[15px] font-bold", p.label === "Not covered yet" && "text-bad")}>{usd(p.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FundTab({ proposal, world }: { proposal: Proposal; world: World }) {
  const locked = proposal.signedAt !== null;
  const chosen = proposal.chapterIds;
  // The ring points at the next suggested city until two are picked.
  const nextSuggested = chosen.length < 2 ? SUGGESTED_CITIES.find((id) => !chosen.includes(id)) : undefined;
  const setCities = (next: string[]) => {
    store.dispatch({ type: "SET_PROPOSAL_CHAPTERS", payload: { proposalId: proposal.id, chapterIds: next } }, actors.founder, via);
  };
  const setPackage = (walks: number) => {
    if (walks === proposal.inputs.eventsPerCommunity) return;
    store.dispatch({ type: "SET_PROPOSAL_INPUT", payload: { proposalId: proposal.id, key: "eventsPerCommunity", value: walks } }, actors.founder, via);
  };
  return (
    <>
      <Section title="Which cities" right={<span className="num text-[12.5px] text-muted">{chosen.length} picked</span>}>
        <div className="grid grid-cols-2 gap-2">
          {Object.values(world.chapters).map((c) => {
            const on = chosen.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                disabled={locked}
                data-step-target={c.id === nextSuggested ? "cities" : undefined}
                onClick={() => setCities(on ? chosen.filter((x) => x !== c.id) : [...chosen, c.id])}
                className={cn(
                  "min-h-12 rounded-2xl border px-3 text-left text-[15px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                  on ? "border-accent bg-accent/15 text-ink shadow-[var(--glow)]" : "border-line bg-surface text-ink hover:border-accent",
                )}
              >
                {on ? "✓ " : ""}
                {c.city}
              </button>
            );
          })}
        </div>
      </Section>
      <Section title="What they fund">
        <div className="space-y-2">
          {PACKAGES.map((p) => {
            const on = proposal.inputs.eventsPerCommunity === p.walks;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
                disabled={locked}
                onClick={() => setPackage(p.walks)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-2xl border p-3.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                  on ? "border-accent bg-accent/10" : "border-line bg-surface hover:border-accent",
                )}
              >
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[15px] font-bold">{p.name}</span>
                    {p.tag ? <span className="rounded-full border border-line-strong px-2 py-px text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted">{p.tag}</span> : null}
                  </span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-muted">{p.line}</span>
                </span>
                <span className="num shrink-0 text-[13px] font-bold text-accent-ink">
                  {p.walks} walk{p.walks === 1 ? "" : "s"}
                </span>
              </button>
            );
          })}
        </div>
      </Section>
      <Section title="How much">
        <FeeSlider proposal={proposal} locked={locked} />
      </Section>
      <Section title="Where every dollar goes">
        <DollarBar proposal={proposal} />
      </Section>
      {locked ? <p className="mt-4 text-center text-[13px] text-muted">Signed — these terms are locked in.</p> : null}
    </>
  );
}

// ── Money ───────────────────────────────────────────────────────────────────

function MoneyFigure({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3">
      <div className={cn("num font-[family-name:var(--font-display)] text-[19px] font-black leading-none", strong && "text-accent")}>{usd(value)}</div>
      <div className="mt-1.5 text-[11.5px] leading-snug text-muted">{label}</div>
    </div>
  );
}

function DealRow({ n, title, line, done, current, children }: { n: number; title: string; line: string; done: boolean; current: boolean; children?: ReactNode }) {
  return (
    <li className={cn("rounded-2xl border p-4", done ? "border-ok/40 bg-ok-soft/50" : current ? "border-accent/70 bg-accent/10" : "border-line bg-surface")}>
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-[14px] font-black", done ? "bg-ok text-bg" : current ? "bg-accent text-on-accent" : "border border-line-strong text-muted")}
        >
          {done ? "✓" : n}
        </span>
        <div className="min-w-0">
          <div className="text-[16px] font-black uppercase tracking-[-0.01em]">{title}</div>
          <div className="text-[13px] leading-snug text-muted">{line}</div>
        </div>
      </div>
      {children ? <div className="mt-3">{children}</div> : null}
    </li>
  );
}

const EVENT_WORDS = { draft: "Being planned", submitted: "Waiting for the City Lead", published: "On the calendar", completed: "Done", cancelled: "Cancelled" } as const;

function MoneyTab({ proposal, world }: { proposal: Proposal; world: World }) {
  const [said, setSaid] = useState<Receipt | null>(null);
  const [why, setWhy] = useState("");
  const name = world.partners[proposal.partnerId]!.name;
  const e = economics(asSigned(proposal));
  const summer = sponsorMoney(world);
  const signed = proposal.signedAt !== null;
  const paid = proposal.paidAt !== null;
  const live = ["live", "reported", "renewed"].includes(proposal.stage);
  const blockedByPrice = said?.outcome === "blocked" && said.ruleIds.includes("COMMERCIAL-OVERRIDE");

  /** Signing walks the deal forward to the contract: earlier stages are the talking that came before. */
  const sign = (override?: string) => {
    let r: Receipt | null = null;
    // The deal runs in as many cities as were picked; written once, here.
    const terms = asSigned(proposal);
    if (terms.communities !== proposal.inputs.communities) {
      r = store.dispatch({ type: "SET_PROPOSAL_INPUT", payload: { proposalId: proposal.id, key: "communities", value: terms.communities } }, actors.founder, via);
      if (r.outcome !== "applied") return setSaid(r);
    }
    for (let guard = 0; guard < 4; guard++) {
      const p = store.get().machine.world.proposals[proposal.id]!;
      if (p.signedAt !== null || p.stage === "lost") break;
      r = store.dispatch({ type: "ADVANCE_DEAL", payload: override ? { proposalId: proposal.id, override } : { proposalId: proposal.id } }, actors.founder, via);
      if (r.outcome !== "applied") break;
    }
    setSaid(r);
    if (r?.outcome === "applied") setWhy("");
  };
  const pay = () => setSaid(store.dispatch({ type: "RECORD_PAYMENT", payload: { proposalId: proposal.id } }, actors.founder, via));
  const goLive = () => setSaid(store.dispatch({ type: "ADVANCE_DEAL", payload: { proposalId: proposal.id } }, actors.founder, via));

  const events = proposal.fundedEventIds.map((id) => world.events[id]).filter((x): x is NonNullable<typeof x> => Boolean(x));
  return (
    <>
      <Section title="This summer's sponsor money">
        <div className="grid grid-cols-3 gap-2">
          <MoneyFigure label="in the bank" value={summer.inBank} strong />
          <MoneyFigure label="signed, on its way" value={summer.onItsWay} />
          <MoneyFigure label="offered" value={summer.offered} />
        </div>
        <p className="mt-2 text-[12.5px] leading-snug text-muted">A signature is a promise. Money counts once it&apos;s in the bank.</p>
      </Section>

      <Section title="This deal">
        <div className="rounded-2xl border border-line bg-surface p-4">
          <div className="text-[13px] text-muted">{name} funds</div>
          <div className="mt-0.5 text-[17px] font-bold leading-snug">
            {proposal.inputs.eventsPerCommunity * Math.max(1, proposal.chapterIds.length)} walks in{" "}
            {proposal.chapterIds.length ? proposal.chapterIds.map((c) => world.chapters[c]?.city ?? c).join(" and ") : "no city yet"}
          </div>
          <div className="num mt-1 font-[family-name:var(--font-display)] text-[30px] font-black">{usd(proposal.inputs.fee)}</div>
        </div>
      </Section>
      <ol className="mt-3 space-y-3">
        <DealRow n={1} title="Sign" line="Both sides agree. Nothing is paid yet." done={signed} current={!signed}>
          {!signed ? (
            <BigButton onClick={() => sign()} label="Sign the deal" target="pay">
              Sign the deal
            </BigButton>
          ) : null}
        </DealRow>
        <DealRow n={2} title="Pay" line="The money arrives. Only now can the giving-back share be spent." done={paid} current={signed && !paid}>
          {signed && !paid ? (
            <BigButton onClick={pay} label={`Pay ${usd(proposal.inputs.fee)}`} target="pay">
              Pay {usd(proposal.inputs.fee)}
            </BigButton>
          ) : null}
        </DealRow>
        <DealRow n={3} title="Go live" line="The walks go on each city's calendar." done={live} current={signed && !live}>
          {signed && !live ? (
            <BigButton onClick={goLive} tone={paid ? "accent" : "quiet"} label="Go live">
              Go live
            </BigButton>
          ) : null}
        </DealRow>
      </ol>

      {said && said.outcome !== "applied" ? (
        <div className="mt-4 rounded-2xl border border-warn/50 bg-warn-soft p-4" aria-live="polite">
          <p className="text-[14.5px] font-bold leading-snug">{blockedByPrice ? `At this price, ${usd(Math.abs(e.contribution))} of the costs aren't covered.` : plain(said.summary)}</p>
          {blockedByPrice ? (
            <>
              <p className="mt-1 text-[13.5px] leading-snug text-muted">Raise the fee on the Fund tab — or sign anyway and say why it&apos;s worth it. The reason is kept with the deal.</p>
              <label className="mt-3 block text-[13px] font-bold" htmlFor="sign-anyway">
                Why it&apos;s worth it
              </label>
              <input
                id="sign-anyway"
                value={why}
                maxLength={240}
                onChange={(ev) => setWhy(ev.currentTarget.value)}
                placeholder="e.g. Our first sponsor in Charleston"
                className="mt-1 min-h-11 w-full rounded-xl border border-line-strong bg-bg px-3 text-[14px]"
              />
              <div className="mt-2">
                <BigButton onClick={() => sign(why.trim())} disabled={why.trim().length < 10} tone="quiet" label="Sign anyway">
                  Sign anyway
                </BigButton>
              </div>
            </>
          ) : null}
        </div>
      ) : said?.outcome === "applied" ? (
        <p className="mt-4 rounded-2xl bg-ok-soft p-3 text-[14px] font-bold text-ok" aria-live="polite">
          {said.type === "RECORD_PAYMENT" ? `Paid. ${usd(proposal.inputs.fee)} is in the bank, and ${usd(e.impact)} is ready for giving back.` : live ? `Live. ${events.length} walks are on their way to the City Leads.` : "Signed. Next: payment."}
        </p>
      ) : null}

      {proposal.override ? <p className="mt-3 text-[13px] text-muted">Signed below cost, on purpose: “{proposal.override}”</p> : null}

      {events.length ? (
        <Section title="The walks they paid for">
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {events.map((ev) => (
              <li key={ev.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span>
                  <span className="block text-[14.5px] font-bold">{world.chapters[ev.chapterId]?.city ?? ev.chapterId}</span>
                  <span className="block text-[12.5px] text-muted">{dayLabel(ev.day)}</span>
                </span>
                <span className={cn("rounded-full px-2.5 py-0.5 text-[11.5px] font-bold", ev.status === "completed" ? "bg-ok-soft text-ok" : ev.status === "cancelled" ? "bg-bad-soft text-bad" : "bg-surface-2 text-muted")}>
                  {EVENT_WORDS[ev.status]}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </>
  );
}

// ── Brand ───────────────────────────────────────────────────────────────────

/** The code a member is handed at a funded walk: theirs if they used one, otherwise the next unused. */
function handedOut(proposal: Proposal, memberId: string): string | null {
  const own = proposal.redemptions.find((r) => r.memberId === memberId);
  if (own) return own.code;
  return proposal.issuedCodes.find((c) => !proposal.redemptions.some((r) => r.code === c)) ?? null;
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 text-left">
      <span className="text-[15px] font-bold">{label}</span>
      <span aria-hidden className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors", on ? "bg-accent" : "bg-surface-2")}>
        <span className={cn("absolute top-1 size-5 rounded-full bg-white transition-[left]", on ? "left-6" : "left-1")} />
      </span>
    </button>
  );
}

function Total({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3.5">
      <div className="num font-[family-name:var(--font-display)] text-[28px] font-black leading-none">{value}</div>
      <div className="mt-1.5 text-[12.5px] leading-snug text-muted">{label}</div>
    </div>
  );
}

function BrandTab({ proposal, world, ui, setUI }: { proposal: Proposal; world: World; ui: PartnerPhoneState; setUI: (patch: Partial<PartnerPhoneState>) => void }) {
  const mark = useMarkStep();
  const [asked, setAsked] = useState<Receipt | null>(null);
  const [perk, setPerk] = useState<Receipt | null>(null);
  const name = world.partners[proposal.partnerId]!.name;
  const report = campaignReport(world, proposal.id);
  const live = ["live", "reported", "renewed"].includes(proposal.stage);
  const count = (v: number | "fewer than 10") => (typeof v === "number" ? v.toLocaleString("en-US") : "<10");
  const funded = proposal.fundedEventIds.map((id) => world.events[id]).filter((x): x is NonNullable<typeof x> => Boolean(x));
  const coming = [...new Set(funded.flatMap((e) => e.rsvps))].map((id) => world.members[id]?.name ?? id);

  const askForList = () => {
    const r = store.dispatch({ type: "PARTNER_DATA_REQUEST", payload: { proposalId: proposal.id, request: "participant-list" } }, actors.partner(proposal.partnerId), via);
    setAsked(r);
    if (r.outcome !== "applied") mark("asked");
  };
  const getPerk = () => {
    const code = handedOut(proposal, "maya");
    store.dispatch({ type: "OFFER_CLICK", payload: { memberId: "maya", proposalId: proposal.id } }, actors.member("maya"), via);
    if (code) setPerk(store.dispatch({ type: "REDEEM_OFFER", payload: { memberId: "maya", proposalId: proposal.id, code } }, actors.member("maya"), via));
  };
  const myCode = proposal.redemptions.find((r) => r.memberId === "maya")?.code ?? null;

  return (
    <>
      <Toggle on={ui.brandView} onChange={(v) => setUI({ brandView: v })} label="See what the brand sees" />
      {ui.brandView ? (
        <Section title={`What ${name} sees`}>
          <div className="grid grid-cols-2 gap-2">
            <Total label="walks done" value={`${report.eventsCompleted}/${report.eventsPlanned}`} />
            <Total label="people checked in" value={count(report.attendance)} />
            <Total label="first-timers" value={count(report.firstTimers)} />
            <Total label="perk codes used" value={proposal.redemptions.length} />
          </div>
          <p className="mt-3 rounded-2xl bg-surface-2 p-3 text-center text-[13.5px] font-bold">No names. No emails. No maps. Groups under 10 just say “&lt;10”.</p>
        </Section>
      ) : (
        <Section title="Your team sees">
          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="text-[13px] text-muted">Signed up for {name}&apos;s walks</div>
            <p className="mt-1 text-[15px] font-bold leading-snug">{coming.length ? coming.join(", ") : "Nobody yet — the walks open when the deal goes live."}</p>
            <p className="mt-2 text-[12.5px] text-muted">First names, for the City Leads. This list never leaves 100 Miles.</p>
          </div>
        </Section>
      )}

      <Section title="The brand asks">
        <BigButton onClick={askForList} tone="quiet" label="Ask for the member list" target="asked">
          Ask for the member list
        </BigButton>
        {asked ? (
          <p className={cn("mt-2 rounded-2xl p-3 text-[14.5px] font-bold leading-snug", asked.outcome === "applied" ? "bg-warn-soft text-warn" : "bg-bad-soft text-bad")} aria-live="polite">
            {asked.outcome === "applied" ? plain(asked.summary) : "No. You already promise never to sell, trade or rent members' data. Sponsors see counts, never people."}
          </p>
        ) : null}
      </Section>

      <Section title="Perk members can choose">
        <div className="rounded-2xl border border-line bg-surface p-4">
          <div className="text-[15px] font-bold">15% off a first pair of walking shoes</div>
          <p className="mt-0.5 text-[13px] text-muted">Members tap if they want it. {name} learns how many codes were used — never who used them.</p>
          <div className="mt-3">
            {myCode ? (
              <p className="rounded-xl bg-ok-soft p-3 text-center text-[14px] font-bold text-ok">
                Maya&apos;s code: <span className="num">{myCode}</span>
              </p>
            ) : (
              <BigButton onClick={getPerk} disabled={!live} tone="quiet" label="Get the perk as Maya">
                {live ? "Get the perk as Maya" : "Opens when the deal goes live"}
              </BigButton>
            )}
          </div>
          {perk && perk.outcome !== "applied" ? <p className="mt-2 text-[13px] text-muted">{plain(perk.summary)}</p> : null}
        </div>
      </Section>

      <Section title="After the summer">
        <BigButton
          onClick={() => {
            setUI({ report: true });
            mark("report");
          }}
          label="Open the season report"
          target="report"
        >
          Open the season report
        </BigButton>
        <p className="mt-2 text-center text-[12.5px] text-muted">One page Kayla can forward. Totals only.</p>
      </Section>
    </>
  );
}

/** The season report as plain text, the way it lands in an email. */
function reportText(proposal: Proposal, world: World): string {
  const r = campaignReport(world, proposal.id);
  const name = world.partners[proposal.partnerId]!.name;
  const e = economics(proposal.inputs);
  const count = (v: number | "fewer than 10") => (typeof v === "number" ? v.toLocaleString("en-US") : "fewer than 10");
  return [
    `${name} · Season report, Year 10`,
    "",
    `Walks you funded: ${r.eventsPlanned}`,
    `Walks that happened: ${r.eventsCompleted}`,
    `People checked in: ${count(r.attendance)}`,
    `First group walk ever: ${count(r.firstTimers)}`,
    "",
    `Your fee paid for water, shirts, City Lead thank-yous, photos and the team's time.`,
    `${usd(e.impact)} of it went to a community program members chose.`,
    "",
    "Totals only: no names, emails or routes — ever.",
  ].join("\n");
}

function ReportSheet({ proposal, world, onClose }: { proposal: Proposal; world: World; onClose: () => void }) {
  const r = campaignReport(world, proposal.id);
  const name = world.partners[proposal.partnerId]!.name;
  // The tiles say "<10", as the brand view does; the sentence under them says why.
  const count = (v: number | "fewer than 10") => (typeof v === "number" ? v.toLocaleString("en-US") : "<10");
  const e = economics(proposal.inputs);
  const [copied, setCopied] = useState<"yes" | "no" | null>(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reportText(proposal, world));
      setCopied("yes");
    } catch {
      setCopied("no");
    }
  };
  return (
    <div role="dialog" aria-label="Season report" className="absolute inset-0 z-20 flex flex-col bg-bg/95 backdrop-blur">
      <div className="flex items-center justify-between px-5 pb-2 pt-3">
        <span className="text-[12.5px] font-bold text-accent-ink">Ready to forward</span>
        <button type="button" onClick={onClose} className="min-h-10 rounded-full px-3 text-[14px] font-bold text-muted hover:text-ink">
          Close
        </button>
      </div>
      <AppHeader kicker={`${name} · Year 10`} title="Season report" />
      <AppBody>
        <div className="grid grid-cols-2 gap-2">
          <Total label="walks you funded" value={r.eventsPlanned} />
          <Total label="walks that happened" value={r.eventsCompleted} />
          <Total label="people checked in" value={count(r.attendance)} />
          <Total label="first group walk ever" value={count(r.firstTimers)} />
        </div>
        <div className="mt-3 rounded-2xl border border-line bg-surface p-4 text-[14px] leading-relaxed">
          <p>Your fee paid for water, shirts, City Lead thank-yous, photos and the team&apos;s time.</p>
          <p className="mt-2">
            <span className="font-bold">{usd(e.impact)}</span> of it went to a community program members chose.
          </p>
          <p className="mt-2 text-muted">Groups under 10 just say “&lt;10”. Photos are added only from walks where people said OK. No names, emails or routes — ever.</p>
        </div>
        {r.eventsCompleted === 0 ? <p className="mt-3 text-center text-[13px] text-muted">The numbers fill in as the walks happen.</p> : null}
        <div className="mt-4">
          <BigButton onClick={copy} label="Copy the report to send">
            {copied === "yes" ? "Copied ✓" : "Copy the report to send"}
          </BigButton>
          <p className="mt-2 text-center text-[12.5px] text-muted" aria-live="polite">
            {copied === "yes" ? "Paste it into an email to the sponsor." : copied === "no" ? "This browser wouldn't copy — the page above is the report." : "Plain text, ready for an email."}
          </p>
        </div>
      </AppBody>
    </div>
  );
}

const TAB_TITLES: Record<PartnerTab, string> = { fund: "Fund a city", deal: "Money in", brand: "What they get" };

export function PartnerPhone({ proposalId, ui, setUI }: { proposalId: string; ui: PartnerPhoneState; setUI: (patch: Partial<PartnerPhoneState>) => void }) {
  const world = useWorld();
  const proposal = world.proposals[proposalId]!;
  const partner = world.partners[proposal.partnerId]!;
  return (
    <Phone label={`${partner.name.endsWith("s") ? `${partner.name}'` : `${partner.name}'s`} sponsor app`}>
      <div className="relative flex h-full flex-col">
        <AppHeader
          kicker={partner.name}
          title={TAB_TITLES[ui.tab]}
          right={<span className="mb-1 shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-[11.5px] font-bold text-muted">{DEAL_WORDS[proposal.stage]}</span>}
        />
        <AppBody>
          {ui.tab === "fund" ? <FundTab proposal={proposal} world={world} /> : null}
          {ui.tab === "deal" ? <MoneyTab proposal={proposal} world={world} /> : null}
          {ui.tab === "brand" ? <BrandTab proposal={proposal} world={world} ui={ui} setUI={setUI} /> : null}
        </AppBody>
        <AppTabs
          label="Sponsor app"
          value={ui.tab}
          onChange={(tab) => setUI({ tab })}
          tabs={[
            { id: "fund", label: "Fund" },
            { id: "deal", label: "Money" },
            { id: "brand", label: "Brand view" },
          ]}
        />
        {ui.report ? <ReportSheet proposal={proposal} world={world} onClose={() => setUI({ report: false })} /> : null}
      </div>
    </Phone>
  );
}
