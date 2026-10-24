"use client";

// Giving back. A slice of every sponsor deal goes to a local cause members vote
// for. The money moves only after the sponsor pays — never out of 100 Miles of
// Summer's own pocket — the members' pick gets funded, and people walk it.
// Under the phone: how the fund can run without starting a charity, and the
// next idea, Neighborhood Fixes. Giving is new for 100 Miles of Summer; the one
// thing it builds on is the shared mile goal every summer already has.

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { impactPool } from "@/domain/engine";
import { usd } from "@/domain/finance";
import { DataStrip } from "@/components/demo/DataStrip";
import { HowWeBuild } from "@/components/demo/HowWeBuild";
import { Ideas, type Idea } from "@/components/demo/Ideas";
import { Phone } from "@/components/demo/Phone";
import { Story } from "@/components/demo/Story";
import { TryIt, type Step } from "@/components/demo/TryIt";
import { Hero, type LegendItem } from "@/components/three/Hero";
import { Stage } from "@/components/three/Stage";
import { useWorld } from "@/lib/store";
import { GivingApp, type GivingTab } from "./GivingApp";
import { HowItCouldWork } from "./HowItCouldWork";
import { stageIndex } from "./givingCommands";
import type { ProgramColumn } from "./ImpactScene";
import { POOL_COLOR } from "./poolColors";

const ImpactScene = dynamic(() => import("./ImpactScene"), { ssr: false, loading: () => null });

export function ImpactLedger() {
  const world = useWorld();
  const [tab, setTab] = useState<GivingTab>("pool");
  const pool = useMemo(() => impactPool(world), [world]);
  const programs = Object.values(world.programs);
  // What the 3D pool draws per program: its money, its stage, and the people checked in by name at its walk.
  const columns = useMemo<ProgramColumn[]>(
    () =>
      programs.map((p) => ({
        id: p.id,
        name: p.name,
        cost: p.cost,
        funded: p.funded,
        stage: p.stage,
        checkIns: p.evidenceEventIds.reduce((n, id) => n + (world.events[id]?.checkIns.length ?? 0), 0),
        focus: world.impact.selectedProgram === p.id,
      })),
    [programs, world.events, world.impact.selectedProgram],
  );
  const walked = columns.reduce((n, c) => n + c.checkIns, 0);
  const votes = programs.reduce((n, p) => n + p.votes.length + p.backgroundVotes, 0);
  const openForVotes = programs.filter((p) => p.stage === "proposed" || p.stage === "community-review").length;
  // The key leads with what's real today (money promised, ideas open, votes cast); the
  // ready / given / walked rows join once they're above zero, so the page never opens on a row of $0.
  const legend: LegendItem[] = [
    { label: "Promised by sponsors", value: usd(pool.awaitingPayment + pool.pipeline + pool.unfunded), color: POOL_COLOR.pipeline, hollow: true },
    ...(pool.available > 0 ? [{ label: "Ready to give", value: usd(pool.available), color: POOL_COLOR.available }] : []),
    ...(pool.disbursed > 0 ? [{ label: "Given to programs", value: usd(pool.disbursed), color: POOL_COLOR.disbursed }] : []),
    { label: "Local ideas open for votes", value: openForVotes },
    { label: "Member votes so far", value: votes },
    ...(walked > 0 ? [{ label: "People at funded walks", value: walked }] : []),
  ];

  const steps: Step[] = [
    {
      id: "vote",
      label: "Vote for a program in Detroit",
      hint: "“Vote now” on the Giving tab, or the Vote tab.",
      why: "Members decide where the giving goes. One vote each.",
      done: (w) => Object.values(w.programs).some((p) => p.votes.includes("maya")),
    },
    {
      id: "pay",
      label: "Mark the sponsor as paid",
      hint: "“Sponsor pays” on the Giving tab.",
      why: "A promise isn't money. The fund fills only when the sponsor actually pays — never out of your own pocket.",
      done: (w) => Object.values(w.proposals).some((p) => p.paidAt !== null),
    },
    {
      id: "fund",
      label: "Fund the members' pick",
      hint: "“Fund it” on the Giving tab.",
      why: "Money leaves the fund only for a program members backed. One tap from you says yes.",
      done: (w) => Object.values(w.programs).some((p) => stageIndex(p.stage) >= stageIndex("funded")),
    },
    {
      id: "walk",
      label: "Walk it",
      hint: "“Walk it” on the Giving tab.",
      why: "People show up and check in. That's when members see their miles did something.",
      done: (w) => Object.values(w.programs).some((p) => stageIndex(p.stage) >= stageIndex("delivered")),
    },
  ];

  const ideas: Idea[] = [
    {
      title: "You Pick",
      line: "Members vote on which local program gets the money — free first walks, kits for City Leads, shade at a start line. One vote each.",
      state: "live",
      origin: "new",
      image: "/renders/impact.webp",
      imagePosition: "50% 30%",
      show: () => setTab("vote"),
    },
    {
      title: "Your Miles Helped",
      line: "Your summer card shows what your miles and your vote were part of — no map, no times.",
      state: "live",
      origin: "new",
      show: () => setTab("me"),
    },
    {
      title: "Where the Money Went",
      line: "A simple list: money in, money out, and who got it. Anyone in the circle can read it, and it's one line for the sponsor's season report.",
      state: "live",
      origin: "new",
      show: () => setTab("money"),
    },
    {
      title: "Miles Unlock Money",
      line: "Every summer already has a shared goal — 80,000 miles in Year 8. This ties sponsor giving to it: “25,000 more miles unlocks $5,000 for Durham.”",
      state: "next",
      origin: "yours",
    },
    {
      title: "Suggest a Program",
      line: "Members name a local group that should get help next summer, with a city and a reason.",
      state: "next",
      origin: "new",
    },
    {
      title: "Thank-You Notes",
      line: "Programs that got money post a short thank-you with photos people said OK to.",
      state: "next",
      origin: "new",
    },
  ];

  return (
    <div>
      <Hero
        mode="golden"
        eyebrow="Giving back"
        title="Sponsor money that *stays in the neighborhood.*"
        lede="A slice of every sponsor deal goes to a local cause members vote for. It moves only after the sponsor pays, and it's proven on a real walk."
        actions={
          <Story
            title="Why giving *keeps people moving.*"
            stat={{ value: "+32 min", line: "of exercise a week, a year later, for people whose steps sent money to charity — even after the rewards stopped." }}
            beats={[
              { text: "Sponsor money usually disappears into a budget." },
              { text: "Here, members vote on one local cause — say, *free first walks* in Detroit, or shade on a hot route." },
              { text: "The money moves only after the brand pays — never out of your own pocket — and the ad says exactly how much goes to giving." },
              { text: "Then a real walk happens, and people check in by name." },
              { text: "People whose steps sent money to a cause were still moving more a year later. *Giving keeps people going.*" },
            ]}
            close="Try it below: vote, let the sponsor pay, fund the members' pick, then walk it."
          />
        }
        stage={<Stage name="impact" scene={ImpactScene} props={{ pool, programs: columns }} />}
        legendTitle="Giving fund"
        legend={legend}
      />

      <DataStrip
        className="mt-6"
        points={[
          { value: "$2,500", line: "is what a small neighborhood walking grant can be. Enough for shade or benches on one route." },
          { value: "11,629", line: "local projects picked by kids' running teams in one year. Choosing a cause together works." },
          { value: "5–15%", line: "is what a partner charity usually keeps for holding a fund like this. It's planned in from the start." },
        ]}
      />

      <TryIt
        index="01"
        title="Members pick. *Sponsors pay.*"
        intro="Maya votes for a program in Detroit. The sponsor pays, the giving fund fills, the members' pick gets funded — and people walk it."
        steps={steps}
        phone={
          <Phone label="Giving app">
            <GivingApp world={world} tab={tab} onTab={setTab} />
          </Phone>
        }
        finale="Sponsor pays, members choose, people walk it — and nobody's personal info changes hands."
        example="Maya backed “First-Mile Neighborhood Walks”."
      />

      <HowItCouldWork index="02" />

      <Ideas index="03" title="Ideas for *giving back.*" intro="A giving fund is new for 100 Miles of Summer. The first three work on the phone above." ideas={ideas} />

      <HowWeBuild
        index="04"
        lines={[
          { what: "A partner per city", how: "Each city's giving share is paid to a nonprofit partner members picked; the payment row records who received it. Nothing new to incorporate.", effort: "S" },
          { what: "One member, one vote", how: "programs and votes tables in Supabase, with unique (member, program). A FlutterFlow page lists each city's programs.", effort: "S" },
          { what: "Only paid money is given", how: "Kayla adds a payment row when an invoice clears. A view adds up payment rows times the giving share; signed but unpaid shows as “promised”.", effort: "S" },
          { what: "Done means walked", how: "A program is marked done only when it's linked to a past walk with at least 10 people checked in by name.", effort: "S" },
          { what: "An open list", how: "A read-only view of money in and out, for that city's members. Sponsors get the same totals in their report.", effort: "S" },
        ]}
        note="The tables are simple. The first step is Kayla's call: what share of each deal goes to giving, and who keeps the books."
      />
    </div>
  );
}
