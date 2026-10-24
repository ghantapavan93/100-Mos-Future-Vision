"use client";

// The member app: the season as a 3D lap up top, three numbers, then the live
// app in a phone with a few things to try (each ticks itself off when it really
// happens), the ideas behind it, and how we'd build it. Whatever their app already does is labelled as theirs, on the phone and
// in the ideas: this screen shows where it can go, not what they built.

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { weeklyPaceFor } from "@/domain/calendar";
import { activitiesOf } from "@/domain/projections";
import { memberView, SOURCE_LABEL } from "@/domain/selectors";
import type { ActivitySource, Member, World } from "@/domain/types";
import { DataStrip } from "@/components/demo/DataStrip";
import { HowWeBuild } from "@/components/demo/HowWeBuild";
import { Ideas, type Idea } from "@/components/demo/Ideas";
import { Phone } from "@/components/demo/Phone";
import { Story } from "@/components/demo/Story";
import { TryIt, type Step } from "@/components/demo/TryIt";
import { Hero, type LegendItem } from "@/components/three/Hero";
import { SOURCE_COLOR } from "@/components/three/palette";
import { Stage } from "@/components/three/Stage";
import { cn } from "@/components/ui/kit";
import { store, useUI, useWorld } from "@/lib/store";
import { MemberApp, type AppTab } from "./App";
import type { MemberSceneProps } from "./MemberScene";
import { summerPathPicture } from "./pathPicture";
import { useSeptemberNotes } from "./septemberNote";
import { personaLabel } from "./shared";

const MemberScene = dynamic(() => import("./MemberScene"), { ssr: false, loading: () => null });

const ORDER = ["maya", "james", "sarah", "nina"];
/** The challenge itself: a member whose goal is counted in events still has a 100-mile season. */
const SEASON_GOAL = 100;

function people(world: World): Member[] {
  const all = Object.values(world.members);
  const fixed = ORDER.map((id) => world.members[id]).filter((m): m is Member => Boolean(m));
  const guests = all.filter((m) => !ORDER.includes(m.id) && !m.background).sort((a, b) => a.joinedAt - b.joinedAt);
  return [...fixed, ...guests];
}

/** A walk Maya logged on this visit (the demo's own buttons), as opposed to her seeded season. */
function mayaLoggedAWalk(w: World): boolean {
  return Object.values(w.activities).some((a) => a.memberId === "maya" && a.source === "manual" && a.status !== "purged" && /^manual:maya:(log|example)-/.test(a.externalId));
}

/** Each step's id is the `data-step-target` on the phone control that completes it (and on its tab while that tab is closed). */
const STEPS: Step[] = [
  {
    id: "log",
    label: "Log a walk",
    hint: "Tap Log, then Save walk — or Quick add.",
    why: "Your app's “+” does this today. Here a roll counts too, and every pace counts the same.",
    done: mayaLoggedAWalk,
  },
  {
    id: "resend",
    label: "Oops — sent twice? It still counts once.",
    hint: "Still on Log: tap “Send that walk again”.",
    why: "Your app already saves each walk once. Now the phone says so, so nobody wonders.",
    done: (_w, marked) => marked.has("resend-counted-once"),
  },
  {
    id: "join",
    label: "Join a circle",
    hint: "Circles tab → Join the Detroit circle.",
    why: "Now Maya has people to walk with, and a City Lead who knows her name.",
    done: (w) => Boolean(w.members.maya?.chapterId),
  },
  {
    id: "share",
    label: "Share her Apple Health miles with her circle",
    hint: "You tab → Your miles, your choice.",
    why: "Her circle's total grows by exactly her miles — only because she said yes.",
    done: (w) => Boolean(w.members.maya?.consents.chapter.healthkit),
  },
  {
    id: "coach",
    label: "Ask the coach about a missed week",
    hint: "Coach tab → “I missed almost two weeks…”",
    why: "A kind answer and one small step. Never a lecture.",
    done: (w) => Object.values(w.coach.answers).some((a) => a.memberId === "maya" && a.intent === "restart"),
  },
  {
    id: "note",
    label: "Seal a note to her September self",
    hint: "Today tab → write one line, or tap a starter → Seal it.",
    why: "Why she started, in her words — sealed until September 1, when it opens beside her summer story. Nobody else can read it.",
    // A note sealed earlier in the session also counts: see `steps` below.
    done: (_w, marked) => marked.has("note"),
  },
];

/** Scrolls the phone's own screen (not the page) to a part of the app. */
function scrollPhoneTo(testId: string) {
  setTimeout(() => {
    const el = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
    const scroller = el?.closest<HTMLElement>(".overflow-y-auto");
    if (!el || !scroller) return;
    const top = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 12;
    scroller.scrollTo({ top, behavior: "smooth" });
  }, 160);
}

export function MemberLens() {
  const world = useWorld();
  const ui = useUI();
  const viewerId = world.members[ui.viewer] ? ui.viewer : "maya";
  const view = useMemo(() => memberView(world, viewerId), [world, viewerId]);
  const [tab, setTab] = useState<AppTab>("today");
  const [onboarding, setOnboarding] = useState(false);
  // Read through the hook (not storage directly), so the first render matches the server's and "Start over" clears it.
  const notes = useSeptemberNotes();
  const steps = useMemo<Step[]>(() => STEPS.map((s) => (s.id === "note" ? { ...s, done: (w, marked) => s.done(w, marked) || Boolean(notes.maya) } : s)), [notes]);

  useEffect(() => {
    if (ui.viewer !== viewerId) store.setUI({ viewer: viewerId });
  }, [ui.viewer, viewerId]);

  const choose = (id: string) => {
    setOnboarding(false);
    store.setUI({ viewer: id });
  };
  const startSummer = () => {
    setOnboarding(true);
    setTab("today");
  };
  const open = (t: AppTab, testId?: string) => {
    setOnboarding(false);
    setTab(t);
    if (testId) scrollPhoneTo(testId);
  };

  // The hero's lap: counted miles in the order they were moved, the goal as one lap, Strava's private copy outside it.
  const lap = useMemo<MemberSceneProps>(() => {
    const target = view.goal.unit === "mi" ? view.goal.target : SEASON_GOAL;
    return {
      memberId: viewerId,
      name: view.member.name,
      stretches: activitiesOf(world, viewerId)
        .filter((a) => a.status === "counted" && a.distanceMi > 0)
        .map((a) => ({ miles: a.distanceMi, source: a.source })),
      miles: view.miles,
      target,
      stravaMiles: view.strava?.miles ?? 0,
      weekly: weeklyPaceFor(target),
    };
  }, [world, viewerId, view]);
  const legend = useMemo<LegendItem[]>(() => {
    const bySource = new Map<ActivitySource, number>();
    for (const s of lap.stretches) bySource.set(s.source, (bySource.get(s.source) ?? 0) + s.miles);
    const garmin = view.member.connections.garmin.deviceModel;
    const top = [...bySource.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2);
    return [
      { label: "Counted so far", value: `${lap.miles.toFixed(1)} of ${lap.target} mi` },
      ...top.map(([source, miles]) => ({ label: source === "garmin" && garmin ? garmin : SOURCE_LABEL[source], value: `${miles.toFixed(1)} mi`, color: SOURCE_COLOR[source] })),
      ...(lap.stravaMiles > 0 ? [{ label: "From Strava · only you see it", value: `${lap.stravaMiles.toFixed(1)} mi`, color: SOURCE_COLOR.strava, hollow: true }] : []),
    ];
  }, [lap, view]);

  // Every idea says what their app already has, then what this adds. Their badges aren't pitched back: they sit in the phone, labelled as theirs.
  const pathPicture = useMemo(() => summerPathPicture(view.miles), [view.miles]);
  const ideas: Idea[] = [
    {
      title: "On-Track Helper",
      line: "Your app counts down the days, and you tell people “25 miles a month.” Here each mover picks a plan, like “1.4 miles, 4 days a week,” and watches 100 stones fill in.",
      state: "live",
      origin: "yours",
      image: pathPicture,
      show: () => open("today", "on-track"),
    },
    {
      title: "A Note to Your September Self",
      line: "You already share a season recap. Here each mover seals one line in May about why they started — and it opens on September 1, beside their own summer story.",
      state: "live",
      origin: "yours",
      show: () => open("today", "september-note"),
    },
    {
      title: "My circle total",
      line: "Your leaderboard ranks by miles. A circle also gets one shared total, from members who chose to share — no ranking.",
      state: "next",
      origin: "yours",
    },
    {
      title: "Share card",
      line: "Tap a badge you've earned and get a card to post: your miles and your goal, with no map and no time on it.",
      state: "live",
      origin: "new",
      show: () => open("you", "mile-moments"),
    },
    { title: "My Summer Story", line: "You already share a recap of the season. On September 1, each member gets their own: miles, meetups and their favorite day.", state: "next", origin: "yours" },
    { title: "Share My Walk", line: "Tell up to three people you're heading out, then tap “I'm home.” No map is shared.", state: "next", origin: "new" },
    { title: "Your Movement Passport", line: "Your badges already mark the big moments. Later, a passport keeps every walk you joined and every one you helped lead — yours to keep, shared only if you choose.", state: "next", origin: "yours" },
  ];

  const app = (
    <MemberApp
      view={view}
      world={world}
      framed
      tab={tab}
      onTab={setTab}
      onboarding={onboarding}
      onOnboarding={setOnboarding}
      onJoined={(id) => store.setUI({ viewer: id })}
    />
  );

  return (
    <>
      <Hero
        mode="day"
        eyebrow="Member app · Year 10"
        title="Four movers. *Four ways to 100.*"
        lede="Walk, jog, run or roll — every pace counts the same. Pick a mover and tap through their summer, or start your own in three taps."
        actions={
          <div className="flex w-full flex-col items-start gap-4">
            <PersonaChips world={world} viewer={viewerId} onChoose={choose} onStart={startSummer} />
            <Story
              title="Why every *slow mile* counts"
              stat={{ value: "About 2 months", line: "is how long a new habit takes to stick. A summer gives you four." }}
              beats={[
                { text: "Maya has never called herself a runner. She logs a slow mile after work, and it counts the same as anyone's." },
                { text: "People keep going when they *enjoy it* — not when they're ranked. So nothing here compares her pace to anyone's." },
                { text: "In May she seals one line to her September self: why she started. Only she can open it." },
                { text: "By June she's at a Saturday walk with her circle. On September 1 her note opens beside *her summer story.*" },
                { text: "That's the app's whole job: make the next mile easy, and give her *a reason to come back* for Year 11." },
              ]}
              close="Try her first week on the phone below."
            />
          </div>
        }
        stage={<Stage name="member" scene={MemberScene} props={lap} fallback={<div className="absolute inset-0" style={{ background: "radial-gradient(60% 50% at 70% 35%, #3a1d0c, transparent)" }} />} />}
        legendTitle={`${view.member.name}'s summer`}
        legend={legend}
      />

      <DataStrip
        className="mt-6 sm:mt-10"
        points={[
          { value: "7 in 10", line: "newcomers to a weekly walking group were still walking with it four months later." },
          { value: "24", line: "studies agree: feeling good during a walk — not after it — is what brings people back." },
          { value: "42", line: "studies of walking groups found people stick with them, and feel better for it." },
        ]}
      />

      <TryIt
        index="01"
        title="Try Maya's *first week.*"
        intro="Tap the phone the way Maya would. Each step ticks itself off when it really happens."
        steps={steps}
        example="1 mi counted for Maya."
        phone={
          <Phone label="Member app" height={800}>
            {app}
          </Phone>
        }
        finale={<>That&apos;s the member app: <strong>every mile counts once, at any pace — members choose what their circle sees, and September 1 has a note waiting.</strong></>}
        aside={
          viewerId !== "maya" ? (
            <div className="rounded-2xl border border-accent/50 bg-accent/10 p-4 text-[14.5px] leading-snug">
              The steps follow Maya. You&apos;re looking at {view.member.name}&apos;s app.
              <button type="button" onClick={() => choose("maya")} className="tap mt-2 block rounded-full border border-ink px-4 text-[14px] font-bold">
                Switch to Maya
              </button>
            </div>
          ) : null
        }
      />

      <Ideas
        index="02"
        title="What keeps a *first-timer going.*"
        intro="Three work on the phone above; four come next. Each says whether it builds on your app or is new."
        ideas={ideas}
      />

      <HowWeBuild
        index="03"
        lines={[
          { what: "Every walk, saved once", how: "Already true: your runs table won't take the same walk from the same app twice. The phone just says so now.", effort: "Have" },
          { what: "One way in for every mile", how: "The Apple Health and Health Connect custom actions call one Supabase function, ingest_run, instead of inserting rows. It skips repeats, sets aside odd walks and says what happened.", effort: "M" },
          { what: "Totals the database works out", how: "A season_totals view adds up counted runs. The ring and the leaderboard read it, and the phone stops writing mileage into Firestore.", effort: "M" },
          { what: "Sharing switches with teeth", how: "A consents table holds one row per member, app and purpose. Once Supabase accepts the Firebase sign-in, row rules check it before a circle total adds anyone's miles.", effort: "M" },
        ]}
        note="The screens are new FlutterFlow pages in the app you have — Start your summer, the On-Track Helper and My circle total. Firebase sign-in stays as it is."
      />
    </>
  );
}

function PersonaChips({ world, viewer, onChoose, onStart }: { world: World; viewer: string; onChoose: (id: string) => void; onStart: () => void }) {
  return (
    // Every mover in view at every width: two to a row on a phone, one wrapping row beside the hero's legend,
    // so no chip is ever cut at the screen's edge and the legend is never pushed off a narrower screen.
    <div className="self-stretch">
      <div role="group" aria-label="View the app as" className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {people(world).map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={m.id === viewer}
            onClick={() => onChoose(m.id)}
            className={cn("flex min-h-12 min-w-0 flex-col items-start justify-center rounded-2xl px-3.5 text-left sm:min-w-[132px]", m.id === viewer ? "bg-ink text-bg" : "border border-line-strong")}
            data-persona={m.id}
          >
            <span className="text-[14.5px] font-semibold leading-tight">{m.name}</span>
            <span className={cn("whitespace-nowrap text-[12px] leading-tight", m.id === viewer ? "opacity-80" : "text-muted")}>{personaLabel(m.persona)}</span>
          </button>
        ))}
        <button type="button" onClick={onStart} className="col-span-2 flex min-h-12 items-center justify-center whitespace-nowrap rounded-2xl border border-dashed border-line-strong px-4 text-[14.5px] font-semibold sm:justify-start" data-persona="start-your-summer">
          + Start your summer
        </button>
      </div>
    </div>
  );
}
