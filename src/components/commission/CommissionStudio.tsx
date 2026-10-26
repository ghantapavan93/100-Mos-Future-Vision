"use client";

// One commission, three cities. A buyer pays for weekly walks in a few of
// Kayla's cities, and the page follows it end to end: the ask, whether the
// cities can deliver it, the buyer's pushback, the money, the summer itself
// (heat included), the proof the buyer gets, and next summer's price. Every
// step is a command through the same engine as the rest of the demo, on the
// commission's own log (see ./store), so nothing here changes another screen.

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { economics, usd } from "@/domain/finance";
import { DEFAULT_COMMISSION } from "@/domain/commission/fixtures";
import { buyerOf, moneyOf, quoteInputs, walksOf } from "@/domain/commission/model";
import type { Coverage } from "@/domain/commission/types";
import { HowWeBuild } from "@/components/demo/HowWeBuild";
import { chapterPoint } from "@/components/circles/usShape";
import { MONEY_COLOR } from "@/components/partner/moneyColors";
import { Hero, type LegendItem } from "@/components/three/Hero";
import { Stage } from "@/components/three/Stage";
import { Badge, Button, OutcomeBadge, cn } from "@/components/ui/kit";
import { plain } from "@/components/demo/plain";
import { AskStep, type Draft } from "./AskStep";
import type { CityRole, SceneCity, WalkMark } from "./CommissionScene";
import { DeliverStep } from "./DeliverStep";
import { STEPS, flowOf, nextMove, type StepId } from "./flow";
import { Guide } from "./Guide";
import { MoneyStep } from "./MoneyStep";
import { GuideTarget, StepFrame } from "./parts";
import { ProofStep, RenewStep } from "./ProofStep";
import { PushbackStep } from "./PushbackStep";
import { commissionStore, useCommissionLedger, useCommissionWorld } from "./store";
import { SummerStep } from "./SummerStep";

const CommissionScene = dynamic(() => import("./CommissionScene"), { ssr: false, loading: () => null });

const ROLE: Record<Coverage, CityRole> = { pending: "gap", lead: "ready", crew: "crew", descoped: "dropped" };

/** The site header's height, so the step bar sticks right under it at any width. */
function useHeaderHeight(): number {
  const [h, setH] = useState(64);
  useEffect(() => {
    const header = document.querySelector("header");
    if (!header) return;
    const sync = () => setH(Math.round(header.getBoundingClientRect().height));
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(header);
    return () => ro.disconnect();
  }, []);
  return h;
}

export function CommissionStudio() {
  const w = useCommissionWorld();
  const ledger = useCommissionLedger();
  const f = useMemo(() => flowOf(w, ledger), [w, ledger]);
  const [draft, setDraft] = useState<Draft>({ ...DEFAULT_COMMISSION, chapterIds: [...DEFAULT_COMMISSION.chapterIds] });
  const [guide, setGuide] = useState(false);
  const [check, setCheck] = useState<{ head: string; replayed: string } | null>(null);
  const move = useMemo(() => (guide ? nextMove(w, f) : null), [guide, w, f]);
  const headerH = useHeaderHeight();
  const { c, p } = f;

  // The scene and the legend read the same state the steps do.
  const cities = useMemo<SceneCity[]>(() => {
    const walks = c ? walksOf(w, c) : [];
    return Object.values(w.chapters).map((ch) => {
      const inC = c?.cities.find((x) => x.chapterId === ch.id);
      const role: CityRole = inC ? (f.declined ? "dropped" : ROLE[inC.coverage]) : !c && draft.chapterIds.includes(ch.id) ? "asked" : "quiet";
      const mine = walks.filter((x) => x.event.chapterId === ch.id);
      const promised = p && inC && inC.coverage !== "descoped" ? p.inputs.eventsPerCommunity : !c && draft.chapterIds.includes(ch.id) ? draft.weeks : 0;
      const marks: WalkMark[] = mine.length
        ? mine.map((x) => (x.status === "completed" ? "held" : x.status === "canceled" ? "cancelled" : "pending"))
        : Array.from({ length: promised }, () => "pending" as const);
      return { id: ch.id, city: ch.city, at: chapterPoint(ch), role, walks: marks, heat: f.heat?.chapterId === ch.id };
    });
  }, [w, c, p, f.declined, f.heat, draft]);

  // Before anything is sent the legend prices the draft; after, the deal itself.
  const e = useMemo(() => economics(p ? p.inputs : quoteInputs(buyerOf(draft.buyerId)?.kind ?? "workplace", draft.chapterIds.length, draft.weeks, draft.kickoff, draft.fee)), [p, draft]);
  const money = c ? moneyOf(w, c) : null;
  const buyerName = c ? (w.partners[c.buyerId]?.name ?? "") : (buyerOf(draft.buyerId)?.name ?? "");

  // Opening the walkthrough takes you to the step it starts on, so the panel never sits over the hero.
  const toggleGuide = () => {
    if (guide) return setGuide(false);
    setGuide(true);
    const first = nextMove(w, f);
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(`step-${first?.step ?? "ask"}`)?.scrollIntoView({ block: "start", behavior: calm ? "auto" : "smooth" });
  };
  // The number that matters now: the deal as run once there is one, nothing at all once it's declined.
  const now = money ? (money.state === "declined" ? 0 : money.asRun.contribution) : e.contribution;

  const restart = () => {
    commissionStore.reset();
    setDraft({ ...DEFAULT_COMMISSION, chapterIds: [...DEFAULT_COMMISSION.chapterIds] });
    setCheck(null);
    window.scrollTo({ top: 0 });
  };

  const locked: Record<StepId, string | null> = {
    ask: null,
    deliver: c ? null : "Opens once the proposal is sent.",
    pushback: f.done.deliver ? null : c ? "Opens once every city has a City Lead, a partner crew, or has been dropped." : "Opens once the proposal is sent.",
    money: p && (p.signedAt !== null || f.declined) ? null : "Opens at signing.",
    summer: p && (p.signedAt !== null || f.declined) ? null : "Opens at signing.",
    proof: f.declined ? "Declined: there is nothing to report." : c && walksOf(w, c).length ? null : "Opens once the walks are on the calendar.",
    renew: f.declined ? "Declined: there is nothing to renew." : p && p.reportedAt !== null ? null : "Opens once the report is sent.",
  };
  const body: Record<StepId, () => React.ReactNode> = {
    ask: () => <AskStep w={w} f={f} ledger={ledger} draft={draft} setDraft={setDraft} />,
    deliver: () => <DeliverStep w={w} f={f} ledger={ledger} />,
    pushback: () => <PushbackStep w={w} f={f} ledger={ledger} />,
    money: () => <MoneyStep w={w} f={f} ledger={ledger} />,
    summer: () => <SummerStep w={w} f={f} ledger={ledger} />,
    proof: () => <ProofStep w={w} f={f} ledger={ledger} />,
    renew: () => <RenewStep w={w} f={f} ledger={ledger} />,
  };
  const legend: LegendItem[] = f.declined
    ? [
        { label: "No contract, no walks", value: usd(0) },
        { label: "Money in so far", value: usd(0) },
      ]
    : [
        { label: `${e.events} walks, photos and report`, value: usd(e.delivery), color: MONEY_COLOR.delivery },
        { label: "Team hours", value: usd(e.staffCost), color: MONEY_COLOR.staff },
        ...(e.processing > 0 ? [{ label: "Card fees", value: usd(e.processing), color: MONEY_COLOR.processing }] : []),
        { label: "Giving back", value: usd(e.impact), color: MONEY_COLOR.impact },
        e.contribution < 0 ? { label: "Not covered", value: usd(-e.contribution), color: MONEY_COLOR.loss } : { label: "Left for the team", value: usd(e.contribution), color: MONEY_COLOR.left },
        { label: "Money in so far", value: usd(money?.received ?? 0) },
      ];
  const recent = ledger.slice(-6).reverse();
  const done = STEPS.filter((s) => f.done[s.id]).length;

  return (
    <GuideTarget.Provider value={move?.target ?? null}>
      <Hero
        mode="golden"
        eyebrow="Sponsors · one commission"
        title="One commission. *Three cities.*"
        lede="A buyer pays for six weeks of walks in three of your cities. Follow it from the ask to next summer: who covers each city, what the buyer may and may not see, what a heat day costs, and the proof they renew on."
        actions={
          <>
            <Button variant="primary" onClick={toggleGuide} aria-pressed={guide} data-testid="guide-toggle">
              {guide ? "Hide the walkthrough" : "Walk me through it"}
            </Button>
            <Button onClick={restart} data-testid="restart">
              Start over
            </Button>
          </>
        }
        stage={<Stage name="commission" scene={CommissionScene} props={{ cities }} />}
        legendTitle={f.declined ? `${buyerName} · declined` : buyerName ? `${buyerName} · ${usd(e.revenue)}` : "The deal"}
        basis={<Badge>sample</Badge>}
        legend={legend}
      />

      <div className={cn("mx-auto w-full max-w-[1320px] px-4 pb-16 sm:px-6 lg:px-8", guide && "pb-48 sm:pb-16")}>
        <nav aria-label="Steps" style={{ top: headerH }} className="sticky z-20 -mx-4 mb-2 overflow-x-auto border-b border-line bg-bg/90 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <ol className="flex min-w-max gap-1.5">
            {STEPS.map((s) => (
              <li key={s.id}>
                <a href={`#step-${s.id}`} className={cn("flex min-h-10 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-bold", f.done[s.id] ? "text-ok" : locked[s.id] ? "text-muted" : "text-ink")} data-step-link={s.id}>
                  <span className="num">{s.n}</span> {s.title}
                  {f.done[s.id] ? <span aria-label="done">✓</span> : null}
                </a>
              </li>
            ))}
            <li className="num ml-2 flex items-center text-[12px] text-muted">{done}/7</li>
          </ol>
        </nav>

        {/* minmax(0, …) on every width: the wide tables scroll inside their cards instead of widening the page. */}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-10">
            {STEPS.map((s) => (
              <StepFrame key={s.id} id={s.id} n={s.n} title={s.title} question={s.question} done={f.done[s.id]} locked={locked[s.id]}>
                {body[s.id]()}
              </StepFrame>
            ))}
          </div>

          <aside aria-label="What the engine recorded" className="min-w-0 lg:sticky lg:top-28 lg:self-start">
            <div className="card p-5">
              <div className="eyebrow">Left for the team, now</div>
              <div className={cn("num mt-1 text-[28px] font-bold leading-none", now < 0 ? "text-bad" : now === 0 ? "text-muted" : "text-ok")} data-testid="aside-contribution">
                {usd(now)}
              </div>
              <p className="mt-1 text-[12.5px] text-muted">
                {money ? (money.state === "declined" ? "Declined: nothing earned, nothing spent on walks." : `${money.walksOnSchedule} walks · ${money.state === "paid" ? "paid" : money.state === "signed" ? "signed, not paid" : "offered"}`) : "Before anything is sent."}
              </p>
            </div>
            <div className="card mt-4 p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="eyebrow">Receipts</div>
                <span className="num text-[12px] text-muted">{ledger.length} so far</span>
              </div>
              {recent.length ? (
                <ol className="mt-3 space-y-2.5" data-testid="receipts">
                  {recent.map((r) => (
                    <li key={r.seq} className="text-[13px] leading-snug">
                      <div className="flex items-center gap-2">
                        <OutcomeBadge outcome={r.outcome} />
                        <span className="num text-[11px] text-muted">#{r.seq}</span>
                      </div>
                      <p className="mt-0.5 line-clamp-3">{plain(r.summary)}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-3 text-[13px] text-muted">Every tap here leaves a receipt: what was asked, which rules ran, what changed.</p>
              )}
              {ledger.length ? (
                <div className="mt-4 border-t border-line pt-3">
                  <Button size="sm" className="w-full" onClick={() => setCheck(commissionStore.verify())} data-testid="replay-check">
                    Replay it from the start
                  </Button>
                  {check ? (
                    <p className={cn("mt-2 text-[12.5px] leading-snug", check.head === check.replayed ? "text-ok" : "text-bad")} data-testid="replay-result">
                      {check.head === check.replayed ? `Same ${ledger.length} receipts, same chain head (${check.head}). The summer is a replay of its commands.` : `Replay differs: ${check.head} ≠ ${check.replayed}.`}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      </div>

      <HowWeBuild
        index="08"
        lines={[
          { what: "A commission is a deal plus its cities", how: "One Supabase table beside the deals: each city's cover (City Lead, partner crew or dropped) and the reason the buyer was given.", effort: "S" },
          { what: "Paid walks are ordinary events", how: "The walks a buyer pays for are events tagged with the deal, with a sweep, so check-ins and cancellations work as they do for any walk.", effort: "S" },
          { what: "The report is one view", how: "Counts by city from check-ins at the program's walks, any group under 10 hidden, exported as a file the team sends.", effort: "M" },
          { what: "Crews as co-organizers", how: "A crew lead gets organizer rights in one city's circle for the program's walks, through the same roles the City Leads use.", effort: "M" },
        ]}
        note="Nothing here takes payments or signs contracts. The team records both, as it does today."
      />

      {guide ? <Guide move={move} ended={f.declined ? "Declined: no contract, no money, no walks. Start over to try it another way." : "That's one commission, from the ask to next summer."} onClose={() => setGuide(false)} onRestart={restart} /> : null}
    </GuideTarget.Provider>
  );
}
