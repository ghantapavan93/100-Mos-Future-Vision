"use client";

// Kayla's week on one screen: how the summer is going, which City Lead needs a
// hand (and who's training to help), and the few decisions only she can make.
// It opens calm — people first, then the calls that take about three minutes. The city above and the phone below read the same world as every
// other screen.

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import { usd } from "@/domain/finance";
import { contractMoney } from "@/domain/plans";
import { founderView } from "@/domain/selectors";
import { DataStrip } from "@/components/demo/DataStrip";
import { HowWeBuild } from "@/components/demo/HowWeBuild";
import { Ideas } from "@/components/demo/Ideas";
import { Story } from "@/components/demo/Story";
import { TryIt, type Step } from "@/components/demo/TryIt";
import { loadSaturday } from "@/components/present/Present";
import { chapterPoint } from "@/components/circles/usShape";
import { Hero } from "@/components/three/Hero";
import { LIGHT } from "@/components/three/palette";
import { Stage } from "@/components/three/Stage";
import { Button } from "@/components/ui/kit";
import { useWorld } from "@/lib/store";
import { useFellowChoices } from "./fellowship";
import { FounderPhone, type FounderPhoneState, type WeekBlock } from "./FounderPhone";
import { cityChecks } from "./week";

const FounderScene = dynamic(() => import("./FounderScene"), { ssr: false, loading: () => null });

type Load = "steady" | "busy" | "overloaded";
/** Four walks per lead is where we'd find a co-lead (an assumption to test); three is busy. */
const loadOf = (eventsPerOrganizer: number): Load => (eventsPerOrganizer >= 4 ? "overloaded" : eventsPerOrganizer >= 3 ? "busy" : "steady");

const STEPS: Step[] = [
  {
    id: "city",
    label: "Open a City Lead who could use a hand",
    hint: "Week tab — tap Detroit under City Leads.",
    why: "You see the one City Lead who's stretched and can write to them in a tap, long before anyone wears out.",
    done: (_, marked) => marked.has("city"),
  },
  {
    id: "decided",
    label: "Say OK to a decision",
    hint: "Week tab — under Needs you.",
    why: "Only the decisions that really need you reach you, and each one is a single tap.",
    done: (_, marked) => marked.has("decided"),
  },
  {
    id: "fellow",
    label: "Decide on a new City Lead's first solo walk",
    hint: "Week tab — Needs you: Amélie in Montreal.",
    why: "You still pick every City Lead. Training gets them ready; your yes lets them lead — and nobody leads alone.",
    // An answer given earlier in the session also counts: see `steps` below.
    done: (_, marked) => marked.has("fellow"),
  },
  {
    id: "saturday",
    label: "Play a sample Saturday and watch the numbers move",
    hint: "The button beside the phone.",
    why: "Walks happen, people check in, a sponsor pays — and your numbers are already up to date. The sponsor's new walks also show which City Leads now need a hand.",
    done: (w) => Object.values(w.events).some((e) => e.status === "completed"),
  },
];

export function FounderConsole() {
  const world = useWorld();
  const view = useMemo(() => founderView(world), [world]);
  const money = useMemo(() => contractMoney(world), [world]);
  const [ui, setUIState] = useState<FounderPhoneState>({ tab: "week", city: null });
  const setUI = useCallback((patch: Partial<FounderPhoneState>) => setUIState((s) => ({ ...s, ...patch })), []);
  /** Ideas' "Show me": the Week tab, scrolled to that block, which pulses once it's there. */
  const showBlock = useCallback((block: WeekBlock, city: string | null = null) => setUIState({ tab: "week", city, focus: { block, at: Date.now() } }), []);
  const [played, setPlayed] = useState(false);
  // Read through the hook (not storage directly), so the first render matches the server's and "Start over" clears it.
  const answers = useFellowChoices();
  const steps = useMemo<Step[]>(() => STEPS.map((s) => (s.id === "fellow" ? { ...s, done: (w, marked) => s.done(w, marked) || Boolean(answers.amelie) } : s)), [answers]);

  // What the scene draws: the same figures as the phone, nothing extra.
  const scene = useMemo(() => {
    const atRisk = new Set(view.risks.filter((r) => r.id.startsWith("load-")).map((r) => r.id.slice(5)));
    return {
      towers: view.chapters.map((c) => ({
        id: c.id,
        city: c.city,
        members: c.members,
        events: c.events,
        load: loadOf(c.eventsPerOrganizer),
        risk: atRisk.has(c.id),
        at: chapterPoint(world.chapters[c.id]!),
      })),
      money: { paid: money.paidRevenue, signedUnpaid: money.signedRevenue - money.paidRevenue, promised: view.pipelineRevenue },
      otherRisks: view.risks.filter((r) => !r.id.startsWith("load-")).length,
    };
  }, [view, money, world.chapters]);

  const checks = useMemo(() => cityChecks(world), [world]);
  const stretched = checks.filter((c) => c.mood !== "good").length;

  return (
    <div>
      <Hero
        mode="night"
        eyebrow="Kayla's week"
        title="What needs you *this week.*"
        lede="How the summer is going, which City Lead could use a hand, and the few calls only you can make. Everything else waits — about three minutes on a good week."
        actions={
          <Story
            title="Your *evening* back"
            beats={[
              { text: "Knowing how the summer is going can take a lot of texts and a lot of apps." },
              { text: "This puts it on one screen: three numbers, the City Lead who needs a hand, and the calls *only you* can make." },
              { text: "City Leads come first. When one is carrying too much, you see it early — and a kind note is one tap away." },
              { text: "Everything else waits. On a good week that's two decisions, about three minutes." },
              { text: "You get your *evening* back." },
            ]}
            close="Next: open the City Lead who could use a hand, on the phone."
          />
        }
        legendTitle="This week"
        legend={[
          { label: "In city circles", value: view.members.toLocaleString("en-US"), color: "#8a7a62" },
          { label: "Walks on the calendar", value: scene.towers.reduce((s, t) => s + t.events, 0), color: "#ffc46b" },
          { label: "Cities that need a hand", value: stretched, color: LIGHT.night.gold, hollow: true },
          { label: "Sponsor money in", value: usd(scene.money.paid), color: "#ffc14d" },
        ]}
        stage={
          <Stage
            name="founder"
            scene={FounderScene}
            props={scene}
            fallback={<div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 70% 30%, #2a2219 0%, #070707 60%)" }} />}
          />
        }
      />

      <DataStrip
        className="mt-10"
        points={[
          { value: "3 in 10", line: "volunteers don't come back the next year. So City Leads train together, and nobody leads alone." },
          { value: "$1,700", line: "of time is what a City Lead gives each summer. A stipend says thank you." },
          { value: "<1 in 4", line: "groups that run on volunteers have anyone even half-time looking after them. This week view does that part." },
        ]}
      />

      <TryIt
        index="01"
        title="Kayla's week, *in three minutes.*"
        intro="Your own app. It opens on how the week is going, City Leads first, and asks only what needs you."
        steps={steps}
        example="Northline Outfitters: now signed."
        phone={<FounderPhone ui={ui} setUI={setUI} />}
        finale={
          <>
            <span className="font-bold">That&apos;s the founder&apos;s week.</span> One screen, the City Leads first, the few things only you can decide, and every number already up to date.
          </>
        }
        aside={
          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="eyebrow">A sample Saturday</div>
            <p className="mt-2 text-[14px] leading-snug text-muted">Maya&apos;s first group walk, a sponsor signing and paying, a giving program funded — all in one tap.</p>
            <Button
              className="mt-3"
              disabled={played}
              onClick={() => {
                loadSaturday();
                setPlayed(true);
                setUI({ tab: "week", city: null });
              }}
            >
              {played ? "Played ✓" : "Play a sample Saturday"}
            </Button>
          </div>
        }
      />

      <Ideas
        index="02"
        title="Built to *protect your time.*"
        intro="Ideas for running a movement from a phone, in a few minutes a week."
        ideas={[
          {
            title: "City Leads First",
            line: "The week opens on each City Lead and how many walks they carry. You see who's stretched early.",
            state: "live",
            origin: "new",
            image: "/brand/hero_1.jpg",
            show: () => showBlock("leads"),
          },
          {
            title: "Needs You",
            line: "Only the calls that need you, like a sponsor deal or a giving vote. Each one is a single OK.",
            state: "live",
            origin: "new",
            show: () => showBlock("needs"),
          },
          {
            title: "A Calm Week",
            line: "People first, then the miles, then how little of your time it needs. When nothing needs you, it says so: rest counts too.",
            state: "live",
            origin: "new",
            show: () => showBlock("summary"),
          },
          {
            title: "City Lead Fellowship",
            line: "You hand-pick your City Leads. This adds a way in: raise your hand, three short lessons, co-lead a walk — then lead, with your yes.",
            state: "live",
            origin: "yours",
            show: () => showBlock("training"),
          },
          {
            title: "Week in Three Numbers",
            line: "Miles moved, first-timers and walks on the calendar. Tap one to see it city by city.",
            state: "live",
            origin: "new",
            show: () => showBlock("numbers"),
          },
          {
            title: "Money In vs Promised",
            line: "For every sponsor: what's in the bank, what's signed but owed, and what's only promised.",
            state: "live",
            origin: "new",
            show: () => setUI({ tab: "money", city: null }),
          },
          {
            title: "What People Asked",
            line: "What members asked the coach most this week, ready for your next post. Topics only, never their words.",
            state: "live",
            origin: "new",
            show: () => setUI({ tab: "people", city: null }),
          },
          {
            title: "Stories to Share",
            line: "Member wins that people agreed to share, ready for your Instagram or Substack.",
            state: "next",
            origin: "new",
          },
        ]}
      />

      <HowWeBuild
        index="03"
        lines={[
          { what: "Kayla's week in one function", how: "A founder_week() database function returns members, miles, walks coming up, walks set aside, and paid versus promised money.", effort: "S" },
          { what: "A page only Kayla sees", how: "A FlutterFlow page that shows only when her Firebase account has the founder role. No second app to run.", effort: "M" },
          { what: "Every OK is one row", how: "A decisions table in Supabase records what was decided, by whom and when.", effort: "S" },
          { what: "Cities flagged by simple rules", how: "A view turns a city yellow or red — for example when one lead runs too many walks alone. Kayla tunes the limits in a settings table.", effort: "S" },
          { what: "Leads in training", how: "A fellows table — lessons done, walks co-led. Kayla's yes is one more row in decisions, and the new Lead's role follows from it.", effort: "S" },
        ]}
        note="It reads the runs your app already saves; walks and check-ins join it once City Leads post walks in the app. Nothing here asks members for anything new."
      />
    </div>
  );
}
