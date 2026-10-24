"use client";

// The Giving app on a phone: Maya votes for a local program, a sponsor pays,
// the members' pick gets funded, and people walk it. Four tabs, one idea each.
// Every button is a real command; nothing moves before the sponsor actually
// pays. The button that finishes each "Try it" step carries data-step-target.

import { useState, type ReactNode } from "react";
import { dayLabel, dayOf } from "@/domain/calendar";
import { impactPool, seasonMiles, type Receipt } from "@/domain/engine";
import { economics, usd } from "@/domain/finance";
import type { ImpactProgram, ImpactStage, World } from "@/domain/types";
import { AppBody, AppHeader, AppTabs } from "@/components/demo/Phone";
import { plain } from "@/components/demo/plain";
import { cn } from "@/components/ui/kit";
import { actors, store } from "@/lib/store";
import { fund, runUntil, sponsorPays, stageIndex, walkIt } from "./givingCommands";

export type GivingTab = "pool" | "vote" | "money" | "me";

const MAYA = "maya";

/** What each program is, in one line anyone gets. */
const PLAIN: Record<string, string> = {
  neighborhood: "Three welcoming beginner walks in Detroit, each with someone at the back.",
  leaders: "Ten kits for City Leads: first aid, a back-walker vest and a welcome script.",
  access: "Shade and seating at a start line, or a loaned all-terrain wheelchair.",
};

/** Where a program is, in plain words. */
const STATUS: Record<ImpactStage, string> = {
  proposed: "Open for votes",
  "community-review": "Members reviewing",
  approved: "Approved",
  funded: "Funded",
  delivered: "Happened",
  verified: "Done",
};

const done = (p: ImpactProgram) => stageIndex(p.stage) >= stageIndex("delivered");
const funded = (p: ImpactProgram) => stageIndex(p.stage) >= stageIndex("funded");
const checkedIn = (w: World, p: ImpactProgram) => p.evidenceEventIds.reduce((n, id) => n + (w.events[id]?.checkIns.length ?? 0), 0);

function Card({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <section aria-label={label} className={cn("rounded-2xl border border-line bg-surface p-4", className)}>
      {children}
    </section>
  );
}

function Big({ children, onClick, disabled, label, target }: { children: ReactNode; onClick: () => void; disabled?: boolean; label?: string; target?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      data-step-target={target}
      onClick={onClick}
      className="mt-3 min-h-12 w-full rounded-xl bg-accent px-4 text-[14.5px] font-black uppercase tracking-[0.06em] text-on-accent shadow-[0_8px_24px_-10px_rgba(255,106,19,0.8)] transition-transform active:scale-[0.98] disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/** The proof rule, said the way a member would: who walked it, and when it counts as proven. */
function refusalWords(summary: string): string {
  const proof = summary.match(/^Evidence shows (\d+) (?:person|people) checked in/);
  if (proof) {
    const n = Number(proof[1]);
    return `${n} ${n === 1 ? "person" : "people"} walked it. It's fully proven once ten have.`;
  }
  return plain(summary);
}

function Refusal({ receipt }: { receipt: Receipt | null }) {
  if (!receipt) return null;
  return (
    <p role="status" className="rise-in mt-2 rounded-xl bg-warn-soft px-3 py-2 text-[13.5px] leading-snug">
      {refusalWords(receipt.summary)}
    </p>
  );
}

const ICON = {
  pool: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <path d="M5 9h14l-1.5 10.5a2 2 0 0 1-2 1.5h-7a2 2 0 0 1-2-1.5z" />
      <path d="M6 13c2 1.2 4 1.2 6 0s4-1.2 6 0" />
    </svg>
  ),
  vote: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 12l5 5L20 6" />
    </svg>
  ),
  money: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <path d="M4 7h16M4 12h10M4 17h7" />
    </svg>
  ),
  me: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="8.5" r="3.8" />
      <path d="M4.5 20c1.4-3.6 4.3-5.2 7.5-5.2s6.1 1.6 7.5 5.2" />
    </svg>
  ),
};

export function GivingApp({ world, tab, onTab }: { world: World; tab: GivingTab; onTab: (t: GivingTab) => void }) {
  return (
    <div className="flex h-full flex-col" data-testid="giving-app">
      {tab === "pool" ? <PoolTab world={world} onTab={onTab} /> : null}
      {tab === "vote" ? <VoteTab world={world} /> : null}
      {tab === "money" ? <MoneyTab world={world} /> : null}
      {tab === "me" ? <MeTab world={world} /> : null}
      <AppTabs
        label="Giving app"
        value={tab}
        onChange={onTab}
        tabs={[
          { id: "pool", label: "Giving", icon: ICON.pool },
          { id: "vote", label: "Vote", icon: ICON.vote },
          { id: "money", label: "Money", icon: ICON.money },
          { id: "me", label: "Me", icon: ICON.me },
        ]}
      />
    </div>
  );
}

function mayaPick(world: World): ImpactProgram | undefined {
  return Object.values(world.programs).find((p) => p.votes.includes(MAYA));
}

// ── Giving (home) ─────────────────────────────────────────────────────────────

function PoolTab({ world, onTab }: { world: World; onTab: (t: GivingTab) => void }) {
  const pool = impactPool(world);
  const proposal = world.proposals["pr-northline"];
  const partner = proposal ? world.partners[proposal.partnerId]?.name ?? "The sponsor" : "The sponsor";
  const share = proposal ? economics(proposal.inputs).impact : 0;
  const sharePct = proposal?.inputs.impactPct ?? 0;
  const paid = Object.values(world.proposals).some((p) => p.paidAt !== null);
  const pick = mayaPick(world);
  const programs = Object.values(world.programs);
  const fundedOne = programs.find((p) => funded(p) && !done(p));
  const doneOne = programs.find(done);
  const [result, setResult] = useState<Receipt | null>(null);
  const total = Math.max(1, pool.committed);

  // Kayla funds Maya's pick if the pool can pay for it, otherwise the most-backed program it can.
  const affordable = programs.filter((p) => !funded(p) && p.cost <= pool.available).sort((a, b) => b.votes.length + b.backgroundVotes - (a.votes.length + a.backgroundVotes));
  const toFund = pick && !funded(pick) && pick.cost <= pool.available ? pick : affordable[0];

  return (
    <>
      <AppHeader kicker="Detroit · this summer" title="Giving" />
      <AppBody>
        <Card label="Members pick" className="mb-3">
          {pick ? (
            <p className="text-[14px] leading-snug">
              You voted for <span className="font-bold">{pick.name}</span> ✓
            </p>
          ) : (
            <>
              <p className="text-[14px] leading-snug">
                <span className="font-bold">Members pick first.</span> <span className="text-muted">Three local ideas for Detroit are open for votes.</span>
              </p>
              <button type="button" data-step-target="vote" onClick={() => onTab("vote")} className="mt-2 min-h-10 rounded-lg border border-line-strong px-3 text-[14px] font-bold text-ink hover:border-accent">
                Vote now ›
              </button>
            </>
          )}
        </Card>

        {/* Before any sponsor pays, the fund shows what's on its way, not a $0: a promise, and the one tap that makes it money. */}
        <Card label="The giving fund">
          {paid ? (
            <>
              <div className="text-[12px] font-black uppercase tracking-[0.14em] text-muted">Ready to give</div>
              <div className="num mt-1 text-[40px] font-bold leading-none text-accent">{usd(pool.available)}</div>
              <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                {pool.disbursed > 0 ? <div className="h-full bg-ok" style={{ width: `${(pool.disbursed / total) * 100}%` }} /> : null}
                {pool.available > 0 ? <div className="h-full bg-accent shadow-[0_0_12px_var(--accent)]" style={{ width: `${(pool.available / total) * 100}%` }} /> : null}
              </div>
              <p className="mt-2 text-[13px] leading-snug text-muted">
                <span className="font-semibold text-ok">{partner} paid ✓</span> Given to programs so far: {usd(pool.disbursed)}.
              </p>
            </>
          ) : (
            <>
              <div className="text-[12px] font-black uppercase tracking-[0.14em] text-muted">The giving fund</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="num text-[40px] font-bold leading-none text-ink">{usd(share)}</span>
                <span className="text-[14px] font-semibold text-accent-ink">on its way</span>
              </div>
              <div className="mt-3 h-3 rounded-full border border-dashed border-accent/60" aria-hidden />
              <p className="mt-2 text-[13.5px] leading-snug text-muted">
                {partner} promised {sharePct}% of their deal. It lands here when they pay, then goes to the members&apos; pick.
              </p>
              <Big target="pay" onClick={() => setResult(runUntil(sponsorPays, (w) => Object.values(w.proposals).some((p) => p.paidAt !== null)))}>
                Sponsor pays
              </Big>
            </>
          )}
        </Card>

        {doneOne ? (
          <Card className="mt-3 border-ok/50" label="It happened">
            <div className="text-[15px] font-bold text-ok">It happened ✓</div>
            <p className="mt-1 text-[14px] leading-snug">
              {doneOne.name}: a real walk took place and {checkedIn(world, doneOne)} {checkedIn(world, doneOne) === 1 ? "person" : "people"} checked in by name.
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
              <div className="h-full bg-ok" style={{ width: `${Math.min(100, (checkedIn(world, doneOne) / 10) * 100)}%` }} />
            </div>
            <p className="mt-1.5 text-[12.5px] text-muted">It&apos;s fully done once ten people walk it: {Math.min(10, checkedIn(world, doneOne))} of 10.</p>
          </Card>
        ) : fundedOne ? (
          <Card className="mt-3 border-accent/50" label="Next: a real walk">
            <div className="text-[15px] font-bold">Next: a real walk</div>
            <p className="mt-1 text-[14px] leading-snug text-muted">
              {fundedOne.name} is funded. Next, people walk it — Belle Isle, tomorrow at 8 AM.
            </p>
            <Big target="walk" onClick={() => setResult(runUntil((w) => walkIt(w, fundedOne.id), (w) => done(w.programs[fundedOne.id]!)))}>
              Walk it
            </Big>
          </Card>
        ) : paid ? (
          <Card className="mt-3" label="Fund the members' pick">
            <div className="text-[15px] font-bold">Fund the members&apos; pick</div>
            {!pick ? (
              <p className="mt-1 text-[14px] leading-snug text-muted">Members choose first. Once there&apos;s a vote, one tap funds it.</p>
            ) : toFund ? (
              <>
                <p className="mt-1 text-[14px] leading-snug text-muted">
                  {toFund.name} has {toFund.votes.length + toFund.backgroundVotes} votes and needs {usd(toFund.cost)}.
                  {toFund.id !== pick.id ? ` ${pick.name} needs ${usd(pick.cost)} — more than the fund holds — so this one goes first.` : ""}
                </p>
                <Big target="fund" onClick={() => setResult(runUntil((w) => fund(w, toFund.id), (w) => funded(w.programs[toFund.id]!)))}>
                  Fund it
                </Big>
              </>
            ) : (
              <p className="mt-1 text-[14px] leading-snug text-muted">The fund holds {usd(pool.available)} — not enough for any program yet. Another sponsor&apos;s payment would cover it.</p>
            )}
          </Card>
        ) : null}
        <Refusal receipt={result} />
      </AppBody>
    </>
  );
}

// ── Vote ──────────────────────────────────────────────────────────────────────

function VoteTab({ world }: { world: World }) {
  const programs = Object.values(world.programs);
  const pick = mayaPick(world);
  const top = programs.reduce((a, b) => (b.votes.length + b.backgroundVotes > a.votes.length + a.backgroundVotes ? b : a), programs[0]!);
  const [result, setResult] = useState<Receipt | null>(null);
  return (
    <>
      <AppHeader kicker="You pick" title="Where it goes" />
      <AppBody>
        <p className="mb-3 text-[14px] leading-snug text-muted">Three local ideas for Detroit. Members vote; the most-backed one gets funded first.</p>
        <ul className="space-y-3">
          {programs.map((p) => {
            const votes = p.votes.length + p.backgroundVotes;
            const mine = p.votes.includes(MAYA);
            const open = p.stage === "proposed" || p.stage === "community-review";
            return (
              <li key={p.id}>
                <article aria-label={p.name} className={cn("rounded-2xl border bg-surface p-4", mine ? "border-accent/70 shadow-[var(--glow)]" : "border-line")}>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11.5px] font-bold text-muted">{STATUS[p.stage]}</span>
                    {p.id === top.id ? <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-[11.5px] font-bold text-accent">Most votes</span> : null}
                  </div>
                  <div className="mt-2 text-[16px] font-bold leading-snug">{p.name}</div>
                  <p className="mt-1 text-[13.5px] leading-snug text-muted">{PLAIN[p.id] ?? p.what}</p>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-[13px]">
                      <span className="num font-bold">{votes}</span> votes · <span className="num">{usd(p.cost)}</span>
                    </span>
                    {mine ? (
                      <span className="rounded-full bg-ok-soft px-3 py-1 text-[12.5px] font-bold text-ok">Your vote ✓</span>
                    ) : open && !pick ? (
                      <button
                        type="button"
                        aria-label={`Vote for ${p.name}`}
                        data-step-target="vote"
                        onClick={() => {
                          const r = store.dispatch({ type: "VOTE_PROGRAM", payload: { memberId: MAYA, programId: p.id } }, actors.member(MAYA), { via: "giving-phone" });
                          setResult(r.outcome === "applied" ? null : r);
                        }}
                        className="min-h-10 rounded-xl bg-accent px-4 text-[13px] font-black uppercase tracking-[0.06em] text-on-accent"
                      >
                        Vote
                      </button>
                    ) : null}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
        {pick ? <p className="mt-3 text-[13px] text-muted">One vote per member. You picked {pick.name}.</p> : null}
        <Refusal receipt={result} />
      </AppBody>
    </>
  );
}

// ── Money ─────────────────────────────────────────────────────────────────────

function MoneyTab({ world }: { world: World }) {
  const pool = impactPool(world);
  const lines: { key: string; at: number; label: string; amount: number }[] = [];
  for (const p of Object.values(world.proposals)) {
    if (p.paidAt === null) continue;
    const e = economics(p.inputs);
    if (e.contribution < 0) continue;
    lines.push({ key: `in-${p.id}`, at: p.paidAt, label: `${world.partners[p.partnerId]?.name ?? "A sponsor"} paid its giving share`, amount: e.impact });
  }
  for (const p of Object.values(world.programs)) {
    if (p.fundedAt === null || p.funded === 0) continue;
    lines.push({ key: `out-${p.id}`, at: p.fundedAt, label: p.name, amount: -p.funded });
  }
  lines.sort((a, b) => a.at - b.at);
  const promised = pool.awaitingPayment + pool.pipeline + pool.unfunded;
  return (
    <>
      <AppHeader kicker="Where the money went" title="Money" />
      <AppBody>
        {lines.length === 0 ? (
          <Card>
            <p className="text-[14px] leading-snug text-muted">Nothing yet. A line appears here the moment a sponsor pays, and another when a program is funded.</p>
          </Card>
        ) : (
          <ul aria-label="Money in and out" className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {lines.map((l) => (
              <li key={l.key} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-semibold leading-snug">{l.label}</span>
                  <span className="block text-[12px] text-muted">{dayLabel(dayOf(l.at))}</span>
                </span>
                <span className={cn("num shrink-0 text-[15px] font-bold", l.amount > 0 ? "text-ok" : "text-ink")}>
                  {l.amount > 0 ? "+" : "−"}
                  {usd(Math.abs(l.amount))}
                </span>
              </li>
            ))}
          </ul>
        )}
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          {(
            [
              ["In", pool.committed],
              ["Out", pool.disbursed],
              ["Left", pool.available],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="rounded-xl bg-surface-2 px-2 py-2.5">
              <dt className="text-[11.5px] font-black uppercase tracking-[0.12em] text-muted">{k}</dt>
              <dd className="num mt-0.5 text-[16px] font-bold">{usd(v)}</dd>
            </div>
          ))}
        </dl>
        {promised > 0 ? <p className="mt-3 text-[12.5px] text-muted">Promised but not paid yet: {usd(promised)}. It isn&apos;t in the list until it arrives.</p> : null}
      </AppBody>
    </>
  );
}

// ── Me ────────────────────────────────────────────────────────────────────────

function MeTab({ world }: { world: World }) {
  const miles = seasonMiles(world, MAYA);
  const pick = mayaPick(world);
  const walked = Object.values(world.programs).flatMap((p) => p.evidenceEventIds.map((id) => ({ program: p, event: world.events[id] }))).find((x) => x.event?.checkIns.some((c) => c.memberId === MAYA));
  return (
    <>
      <AppHeader kicker="Your miles helped" title="Maya" />
      <AppBody>
        <section aria-label="Your summer card" className="overflow-hidden rounded-3xl border border-accent/50 bg-[radial-gradient(120%_90%_at_10%_0%,rgba(255,106,19,0.35),transparent_60%),var(--surface)] p-5 shadow-[var(--glow)]">
          <div className="text-[12px] font-black uppercase tracking-[0.14em] text-accent">My summer · Detroit</div>
          <div className="num mt-2 text-[48px] font-bold leading-none">{miles}</div>
          <div className="text-[14px] font-semibold text-muted">miles so far</div>
          <ul className="mt-4 space-y-2 text-[14px] leading-snug">
            <li>{pick ? <>You voted for <span className="font-bold">{pick.name}</span>.</> : "You haven't voted yet."}</li>
            {pick && funded(pick) ? <li className="text-ok">It&apos;s funded by a sponsor&apos;s giving share.</li> : null}
            {walked?.event ? (
              <li className="text-ok">
                You walked it ✓ {dayLabel(walked.event.day)}, at {walked.event.meetingArea}.
              </li>
            ) : null}
          </ul>
        </section>
        <p className="mt-3 text-[13px] leading-snug text-muted">Your miles are part of Detroit&apos;s summer, and your vote helped choose what the giving paid for. No map, no times — just what you were part of.</p>
      </AppBody>
    </>
  );
}
