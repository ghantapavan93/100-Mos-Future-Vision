"use client";

// Sponsors: a brand funds walks in the cities it cares about, sees every dollar
// at work, and gets totals — never people. The page leads with the money (what
// a deal pays for, and when it is really in) and the one-page report Kayla can
// forward; then the Year 10 math (why one presenting partner matters) and the
// same company-team setup run for any employer or university. The phone is the
// sponsor's app; every tap runs the same engine as every other screen.

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import { economics, usd } from "@/domain/finance";
import { programHeadline } from "@/domain/plans";
import { partnerView } from "@/domain/selectors";
import { DataStrip } from "@/components/demo/DataStrip";
import { HowWeBuild } from "@/components/demo/HowWeBuild";
import { Ideas } from "@/components/demo/Ideas";
import { Story } from "@/components/demo/Story";
import { TryIt, type Step } from "@/components/demo/TryIt";
import { Hero } from "@/components/three/Hero";
import { Stage } from "@/components/three/Stage";
import { cn } from "@/components/ui/kit";
import { actors, store, useWorld } from "@/lib/store";
import { MONEY_COLOR } from "./moneyColors";
import { PartnerPhone, asSigned, type PartnerPhoneState } from "./PartnerPhone";
import { ProgramBuilder } from "./ProgramBuilder";
import { YearTenMath } from "./YearTenMath";
import { TEAM_COST, streamsTotal } from "./yearTen";

/** "$167K" — the strip quotes the same model the Year 10 math draws. */
const kUsd = (n: number) => `$${Math.round(n / 1000)}K`;

const PartnerScene = dynamic(() => import("./PartnerScene"), { ssr: false, loading: () => null });

const SPONSORS: { id: string; line: string }[] = [
  { id: "pr-northline", line: "An outdoor brand" },
  { id: "pr-lakeshore", line: "Three company teams — your Year 10 goal" },
  { id: "pr-riverside", line: "A city parks department" },
];

/** Where a deal's money is, in one or two words. */
function moneyWord(p: { signedAt: number | null; paidAt: number | null; stage: string }): string {
  if (p.paidAt !== null) return "paid";
  if (p.signedAt !== null) return "signed, not paid yet";
  return p.stage === "lost" ? "said no" : "offered";
}

export function PartnerStudio() {
  const world = useWorld();
  const [selected, setSelected] = useState("pr-northline");
  const [ui, setUIState] = useState<PartnerPhoneState>({ tab: "fund", brandView: false, report: false });
  const setUI = useCallback((patch: Partial<PartnerPhoneState>) => setUIState((s) => ({ ...s, ...patch })), []);
  const view = useMemo(() => partnerView(world, selected), [world, selected]);
  const { proposal, partner } = view;
  // The scene and legend show the deal as it would be signed, the same as the phone.
  const terms = useMemo(() => asSigned(proposal), [proposal]);
  const e = useMemo(() => economics(terms), [terms]);
  const headline = useMemo(() => programHeadline(terms), [terms]);
  const signed = proposal.signedAt !== null;
  const paid = proposal.paidAt !== null;
  const possessive = partner.name.endsWith("s") ? `${partner.name}'` : `${partner.name}'s`;

  const steps = useMemo<Step[]>(
    () => [
      {
        id: "cities",
        label: "Pick two cities",
        hint: "Fund tab — tap Detroit and Charleston.",
        why: "A brand picks the cities it loves, the way lululemon already hosts your Chicago and LA events.",
        done: (w) => (w.proposals[selected]?.chapterIds.length ?? 0) >= 2,
      },
      {
        id: "fee",
        label: "Set the fee",
        hint: "Slide it and watch where every dollar goes.",
        why: "Everyone sees the cost of running the walks, the giving-back share and what's left for the team — before anyone signs.",
        done: (w, marked) => marked.has("fee") || (w.proposals[selected]?.inputs.fee ?? 0) !== 7500,
      },
      {
        id: "pay",
        label: "Sign, then pay",
        hint: "Money tab — Sign the deal, then Pay.",
        why: "A signature isn't money. The giving-back share only counts once the brand has actually paid.",
        done: (w) => w.proposals[selected]?.signedAt != null && w.proposals[selected]?.paidAt != null,
      },
      {
        id: "asked",
        label: "Ask for the member list",
        hint: "Brand view tab.",
        why: "The answer is always no — you already promise never to sell members' data. That promise is what lets members trust a sponsor.",
        done: (_, marked) => marked.has("asked"),
      },
      {
        id: "report",
        label: "Open the season report",
        hint: "Bottom of the Brand view tab.",
        why: "One page Kayla can forward today: walks, turnout and first-timers — as totals.",
        done: (_, marked) => marked.has("report"),
      },
    ],
    [selected],
  );

  const choose = (id: string) => {
    setSelected(id);
    setUI({ tab: "fund", brandView: false, report: false });
  };

  return (
    <div>
      <Hero
        mode="golden"
        eyebrow="Sponsors"
        title="Sponsors fund the walks. *Members stay private.*"
        lede="A brand picks the cities it loves and pays for their summer. It sees every dollar at work — and never who walked."
        actions={
          <Story
            title="Why *trust* brings brands back"
            stat={{ value: "3 in 4", line: "people won't buy from a brand they don't trust with their data." }}
            beats={[
              { text: "Brands want to back something real. A city's summer of walks is about as real as it gets." },
              { text: "This lets one fund a city in a few taps — and see every dollar at work *before anyone signs*." },
              { text: "Money only counts once it's in. A signature is a promise; the giving-back share waits for the payment." },
              { text: "They see the walks, the turnout and the first-timers. They never get a list of names." },
              { text: "That trust keeps members coming — and brings brands back *next summer*." },
            ]}
            close="Next: fund a city on the phone, from offer to money in."
          />
        }
        stage={<Stage name="partner" scene={PartnerScene} props={{ partner: partner.name, economics: e, band: headline.band, stage: proposal.stage, signed, paid }} />}
        legendTitle={`${possessive} ${usd(e.revenue)}`}
        // The same names, in the same order, as the blocks in the scene.
        legend={[
          { label: "Walks", value: usd(e.delivery), color: MONEY_COLOR.delivery },
          { label: "Staff", value: usd(e.staffCost), color: MONEY_COLOR.staff },
          ...(e.processing > 0 ? [{ label: "Card fees", value: usd(e.processing), color: MONEY_COLOR.processing }] : []),
          { label: "Giving back", value: usd(e.impact), color: MONEY_COLOR.impact },
          e.contribution < 0
            ? { label: "Not covered yet", value: usd(-e.contribution), color: MONEY_COLOR.loss }
            : { label: "Left for the team", value: usd(e.contribution), color: MONEY_COLOR.left },
          { label: signed && !paid ? "Money in so far (signed, owed)" : "Money in so far", value: usd(paid ? proposal.inputs.fee : 0) },
        ]}
      />

      <DataStrip
        className="mt-10"
        points={[
          { value: kUsd(TEAM_COST), line: "is about what a lean Year 10 team costs: a program manager, seven City Lead stipends and the build." },
          { value: kUsd(streamsTotal("middle")), line: "is what city packages, company teams, grants and the shop bring in a middle summer. One big partner carries the rest." },
          { value: "<1%", line: "of sponsorship budgets goes to checking what the money did. The season report does that part for them." },
        ]}
      />

      <TryIt
        index="01"
        title="Fund a city *in five taps.*"
        intro="You're the sponsor. Pick the cities, set the fee, sign and pay — then open the one-page report Kayla can forward."
        steps={steps}
        example="Cities in this deal: Detroit, Charleston."
        phone={<PartnerPhone proposalId={selected} ui={ui} setUI={setUI} />}
        finale={
          <>
            <span className="font-bold">That&apos;s a sponsor deal.</span> The brand funds walks in two cities, the money is in the bank, and the report shows totals — never people.
          </>
        }
        aside={
          <div>
            <div className="eyebrow">Try it as</div>
            <ul className="mt-2 space-y-2">
              {SPONSORS.map((s) => {
                const p = world.proposals[s.id];
                if (!p) return null;
                const on = s.id === selected;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => choose(s.id)}
                      className={cn("tap w-full rounded-2xl border px-4 py-2.5 text-left transition-colors", on ? "border-accent bg-accent/10" : "border-line bg-surface hover:border-accent")}
                    >
                      <span className="block text-[15px] font-bold">{world.partners[p.partnerId]?.name}</span>
                      <span className="block text-[12.5px] text-muted">{s.line}</span>
                      <span className="num mt-1 block text-[12.5px] font-bold text-ink">
                        {usd(p.inputs.fee)} · {moneyWord(p)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        }
      />

      <YearTenMath index="02" />

      <ProgramBuilder index="03" />

      <Ideas
        index="04"
        title="Ways *brands can help.*"
        intro="Six ways brands can fund the movement, and never get anyone's personal info."
        ideas={[
          {
            title: "A Report You Can Forward",
            line: "One page after the summer: walks held, people who came, first-timers, and what the money paid for. Copy it straight into an email.",
            state: "live",
            origin: "new",
            image: "/brand/hero_3.jpg",
            show: () => setUI({ tab: "brand", report: true }),
          },
          {
            title: "Money In, Not Promises",
            line: "Every deal shows its money as offered, signed or in the bank. Giving back waits until the brand has paid.",
            state: "live",
            origin: "new",
            show: () => setUI({ tab: "deal", report: false }),
          },
          {
            title: "Fund a City",
            line: "lululemon already hosts your Chicago and LA events. This makes a city's summer a package any brand can fund in a few taps.",
            state: "live",
            origin: "yours",
            show: () => {
              choose("pr-northline");
              const p = store.get().machine.world.proposals["pr-northline"];
              if (p && p.signedAt === null && p.chapterIds.length < 2) {
                store.dispatch({ type: "SET_PROPOSAL_CHAPTERS", payload: { proposalId: "pr-northline", chapterIds: ["detroit", "charleston"] } }, actors.founder, { via: "partner-ideas" });
              }
            },
          },
          {
            title: "Totals, Not People",
            line: "You already promise never to sell members' data. Sponsors see counts only, and any group under 10 just says “fewer than 10”.",
            state: "live",
            origin: "yours",
            show: () => setUI({ tab: "brand", brandView: true, report: false }),
          },
          {
            title: "Perks You Choose",
            line: "Your Year 8 recap promised in-app perks. One-time codes tell the brand how many were used, never who used them.",
            state: "live",
            origin: "yours",
            show: () => setUI({ tab: "brand", brandView: false, report: false }),
          },
          {
            title: "Every Dollar, Before Signing",
            line: "Slide the fee and watch where every dollar goes. If a price doesn't cover the costs, it says so before anyone signs.",
            state: "live",
            origin: "new",
            show: () => setUI({ tab: "fund", report: false }),
          },
          {
            title: "Sponsor a Week",
            line: "Like your August safety push: a brand hosts one week members can join. It sees how many joined, nothing more.",
            state: "next",
            origin: "yours",
          },
          {
            title: "City Relay title partner",
            line: "Year 10's relay passes a baton Chicago → Detroit → Durham → Charleston → New York → Montreal → Los Angeles. One partner's name rides with it, and every city adds a moment.",
            state: "next",
            origin: "new",
          },
        ]}
      />

      <HowWeBuild
        index="05"
        lines={[
          { what: "Deals stay in a sheet", how: "Deals and prices live in a shared spreadsheet until two sponsors have paid. No app work for Year 10." },
          { what: "A sponsor report from one view", how: "Counts by city and week, taken from check-ins. Any group under 10 is hidden. The program manager exports it, so sponsors never log in.", effort: "S" },
          { what: "Perk codes", how: "A table of one-time codes, redeemed through one database function. Sponsors see how many were used, never by whom.", effort: "M" },
          { what: "Paid means paid", how: "The program manager records each payment when it clears. Giving-back totals read only those rows.", effort: "S" },
          { what: "One setup, any organization", how: "A programs table — name, city, weeks, people invited. One FlutterFlow page and one organizer view both read it; their totals come from the same check-ins.", effort: "M" },
        ]}
        note="Nothing here is a second app: sponsors never sign in, and the report is a file the team sends."
      />
    </div>
  );
}
