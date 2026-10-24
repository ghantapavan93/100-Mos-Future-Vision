"use client";

// 2027–2029: the next three summers, as a plan Kayla can hold in her hand.
// People first, money second. The night scene draws both ways to grow as people
// joining; the phone lets her pick one, move four numbers and see each summer
// answer — walks and first-timers, then what's still to raise — and shows the
// Year 10 goals that only turn green when the real thing happens in the app.
// Then the proof, in two parts: the pilot that answers "do first-timers come
// back?", and the money with the team folded in, drawn from one model
// (proof.ts) that the Sponsors screen reads too. The comparables and the ideas
// wait behind "More", so the page stays three blocks: the plan, the pilot, the
// money.

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import type { Year } from "@/domain/plans";
import { DataStrip } from "@/components/demo/DataStrip";
import { HowWeBuild } from "@/components/demo/HowWeBuild";
import { Ideas, type Idea } from "@/components/demo/Ideas";
import { Story } from "@/components/demo/Story";
import { TryIt, type Step } from "@/components/demo/TryIt";
import { Hero, type LegendItem } from "@/components/three/Hero";
import { Stage } from "@/components/three/Stage";
import { cn } from "@/components/ui/kit";
import { useLedger, useWorld } from "@/lib/store";
import type { FuturePathData } from "./FutureScene";
import { Comparables, MoneySection } from "./Money";
import { PilotSection } from "./Pilot";
import { PlanPhone, type PlanTab } from "./PlanPhone";
import { ALL_ROLES, type Case, type RoleId } from "./proof";
import { PATH_NAME, about, leversFor, otherPath, paidSponsors, peopleOf, plannedYears, yearTenChecks, type Levers, type PathId } from "./plan";

const FutureScene = dynamic(() => import("./FutureScene"), { ssr: false, loading: () => null });

const STEPS: Step[] = [
  {
    id: "path",
    label: "Try the company-teams path",
    hint: "Tap “Company teams first” at the top of the phone.",
    why: "Company teams are your Year 10 goal. They bring money in sooner; city circles bring more first-timers. Same summer, two ways to grow.",
    done: (_w, marked) => marked.has("path"),
  },
  {
    id: "cities",
    label: "Slide the cities up",
    hint: "Drag “Cities with group walks” to the right.",
    why: "More cities means more walks and more first-timers — and more City Leads to support. The plan shows all of it.",
    done: (_w, marked) => marked.has("cities"),
  },
  {
    id: "paid",
    label: "Have two sponsors pay",
    hint: "Open Goals at the bottom, then tap “Sponsor pays” twice.",
    why: "The goal turns green only when the money really arrives. A signature isn't money yet.",
    done: (w) => paidSponsors(w) >= 2,
  },
  {
    id: "year10",
    label: "Open Year 10",
    hint: "Back on Plan, tap the 2027 card.",
    why: "Ten summers strong: a kickoff in every city, your first company teams, and a goal you set together.",
    done: (_w, marked) => marked.has("year10"),
  },
];

/** One path as the scene draws it: everyone who joins, added up summer by summer. */
function toPathData(id: PathId, levers: Levers, chosen: boolean): FuturePathData {
  const years = plannedYears(id, levers);
  let sum = 0;
  const people = years.map((y) => (sum += peopleOf(y)));
  const firstTimers = years.reduce((n, y) => n + y.newcomers, 0);
  return {
    id,
    short: PATH_NAME[id],
    people,
    detail: `${about(sum)} joined · ${about(firstTimers)} first-timers`,
    firstTimers,
    chosen,
  };
}

export function FutureLab() {
  const world = useWorld();
  const ledger = useLedger();
  const [path, setPath] = useState<PathId>("circles-first");
  const [levers, setLevers] = useState<Levers>(() => leversFor("circles-first"));
  const [tab, setTab] = useState<PlanTab>("plan");
  const [openYear, setOpenYear] = useState<Year | null>(null);
  // The team and the kind of summer are shared: the team section toggles roles, the money section draws the same cost.
  const [team, setTeam] = useState<ReadonlySet<RoleId>>(() => new Set(ALL_ROLES));
  const [moneyCase, setMoneyCase] = useState<Case>("mid");
  const toggleRole = useCallback(
    (id: RoleId) =>
      setTeam((t) => {
        const next = new Set(t);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    [],
  );

  const choosePath = (p: PathId) => {
    setPath(p);
    setLevers(leversFor(p));
  };

  const checks = useMemo(() => yearTenChecks(world, ledger), [world, ledger]);
  const [more, setMore] = useState(false);
  // The path open on the phone uses the numbers she moved; the other keeps its own.
  const paths = useMemo(() => {
    const other = otherPath(path);
    const byId = { [path]: toPathData(path, levers, true), [other]: toPathData(other, leversFor(other), false) } as Record<PathId, FuturePathData>;
    return [byId["circles-first"], byId["workplace-first"]] as [FuturePathData, FuturePathData];
  }, [path, levers]);

  const scene = useMemo(
    () => ({
      paths,
      gates: checks.map((c) => ({ id: c.id, short: c.title, pass: c.pass })),
      year: openYear ?? 2027,
    }),
    [paths, checks, openYear],
  );

  // "Joined" counts first-timers at group walks plus coworkers on company teams, so the
  // first-timers row sits beside it: teams reach more people, circles bring more first-timers.
  const legend: LegendItem[] = [
    { label: "City circles first · joined by 2029", value: about(paths[0].people[2]!), color: "#7fb7a4" },
    { label: "Company teams first · joined by 2029", value: about(paths[1].people[2]!), color: "#f2b544" },
    { label: "First-timers · circles vs teams", value: `${about(paths[0].firstTimers)} vs ${about(paths[1].firstTimers)}` },
    { label: "Year 10 goals to check", value: `${checks.length}`, color: "#b98a4e" },
  ];

  const openTeams = () => {
    setTab("plan");
    choosePath("workplace-first");
    setOpenYear(2027);
  };

  const ideas: Idea[] = [
    {
      title: "Company teams — your Year 10 goal",
      line: "You've said Year 10 brings company teams. Coworkers walk their miles together, and team fees help pay for the summer.",
      origin: "yours",
      state: "live",
      image: "/brand/hero_3.jpg",
      show: openTeams,
    },
    {
      title: "Ten summers strong",
      line: "You already plan a kickoff in every city. This adds a Year 10 badge for everyone who starts.",
      origin: "yours",
      state: "live",
      show: () => {
        setTab("plan");
        setOpenYear(2027);
      },
    },
    { title: "A bigger giving fund", line: "Each summer, a bigger share of sponsor money goes to programs members pick.", origin: "new", state: "next" },
    { title: "Circle in a Box", line: "New cities start with a ready kit — routes, a back walker, a first-walk script — and a trained City Lead.", origin: "new", state: "next" },
    { title: "Miles or kilometres", line: "Montreal and new countries see kilometres, and later the app in French.", origin: "new", state: "next" },
    { title: "Fall szn", line: "You've teased it. A short fall and spring warm-up keep people close until May 1.", origin: "yours", state: "next" },
  ];

  return (
    <>
      <Hero
        mode="night"
        eyebrow="2027 → 2029 · Next three summers"
        title="Three more summers. *Your call.*"
        lede="Two ways to grow. Pick one, and every summer answers three questions: who comes, who runs it, who pays."
        actions={
          <Story
            title="Why plan *three summers* now"
            stat={{ value: "39,000", line: "volunteer coaches trained in one year by a girls' running program. Movements grow by training their leaders." }}
            beats={[
              { text: "Nine summers in, the question isn't whether people come. It's *who keeps them coming*, and who pays for that." },
              { text: "Start small: six Saturdays in three cities show what to fix before Year 10 grows." },
              { text: "Hire in order. One person for the weekly rhythm first, so *your evenings come back*." },
              { text: "Money follows proof. One big partner carries Year 10, and the pilot is what you show them." },
            ]}
            close="Try the plan on the phone below, then read the pilot and the money."
          />
        }
        legendTitle="What you're seeing"
        legend={legend}
        stage={
          <Stage
            name="future"
            scene={FutureScene}
            props={scene}
            fallback={<div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 65% 35%, #2a2219 0%, #070707 62%)" }} />}
          />
        }
      />

      <DataStrip
        className="mt-6"
        points={[
          { value: "28%", line: "of free sign-ups don't show up. A reminder the day before is part of the plan." },
          { value: "1.43×", line: "what a salary really costs once benefits and taxes are in. The team is priced that way." },
          { value: "3.5×", line: "as many new running clubs started in one year. The appetite is there." },
        ]}
      />

      <TryIt
        index="01"
        title="Plan *three summers* in a minute."
        intro="Pick how to grow and slide the cities. Each summer answers with walks, first-timers and teammates; the money is one chart below. Year 10 goals turn green only when the real thing happens."
        steps={STEPS}
        phone={<PlanPhone path={path} onPath={choosePath} levers={levers} onLever={(k, v) => setLevers((l) => ({ ...l, [k]: v }))} tab={tab} onTab={setTab} openYear={openYear} onOpenYear={setOpenYear} />}
        finale="Three summers in one plan you can change with your thumb — and goals that only turn green when the real thing happens."
        example="Northline Outfitters paid $7,500."
      />

      <PilotSection index="02" />
      <MoneySection index="03" moneyCase={moneyCase} onCase={setMoneyCase} on={team} onToggle={toggleRole} />

      {/* More: the comparables and the ideas, for whoever wants them. */}
      <section aria-label="More" className="mx-auto w-full max-w-[1320px] px-4 pb-12 sm:px-6 lg:px-8">
        <button
          type="button"
          aria-expanded={more}
          aria-controls="future-more"
          onClick={() => setMore((m) => !m)}
          className="tap flex w-full items-center justify-between gap-4 rounded-2xl border border-line-strong bg-surface px-5 py-4 text-left hover:border-accent"
        >
          <span>
            <span className="block font-[family-name:var(--font-display)] text-[20px] font-black uppercase tracking-[-0.02em]">More</span>
            <span className="mt-0.5 block text-[14px] text-muted">How movements like this pay their way, and ideas for later summers.</span>
          </span>
          <span aria-hidden className={cn("flex size-9 shrink-0 items-center justify-center rounded-full border border-line-strong text-[20px] transition-transform", more && "rotate-45")}>
            +
          </span>
        </button>
      </section>
      {more ? (
        <div id="future-more" className="rise-in">
          <div className="mx-auto w-full max-w-[1320px] px-4 pb-12 sm:px-6 lg:px-8">
            <Comparables />
          </div>
          <Ideas index="04" title="Ideas for *the next three summers*" intro="Ideas and numbers to talk through together, not promises." ideas={ideas} />
        </div>
      ) : null}

      {/* Numbered by what's on screen: 04 belongs to the ideas while More is open, so the count never skips. */}
      <HowWeBuild
        index={more ? "05" : "04"}
        lines={[
          { what: "Pilot sign-ups without the app", how: "A one-page web form per walk writes to a Supabase table; the QR at the door opens it. The City Lead's list checks people in.", effort: "S" },
          { what: "The pilot's numbers, from check-ins", how: "One view over check-ins: first-timers, who came back within 28 days, and show-ups against sign-ups. No new tracking.", effort: "S" },
          { what: "A sheet, not app code", how: "The three-summer plan lives in a Google Sheet Kayla owns. Nothing to build in the member app.", effort: "S" },
          { what: "Goals fed by real numbers", how: "One database function returns this week's counts — sponsors paid, cities live, walks set aside — and the sheet pulls them in.", effort: "S" },
          { what: "Goals lock on May 1", how: "Each summer's targets are one row with a lock date. Drafts until then; fixed once the season starts.", effort: "S" },
          { what: "Company teams on the same miles", how: "For Year 10 a team is a sponsor package plus a team code at sign-up. Team totals come from the same miles view; team pages can wait.", effort: "M" },
        ]}
        note="The plan stays a spreadsheet until the money proves it. Only company teams touch the app in Year 10."
      />
    </>
  );
}
