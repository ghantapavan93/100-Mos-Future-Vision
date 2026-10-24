"use client";

// How miles count — how every walk is counted fairly and kept safe. Written
// for Kirk, readable by Kayla: seven glass gates for the checks every walk goes
// through, then a phone that brings real walks through them the way they really
// arrive (the phone reads Apple Health; Garmin sends to us). The full record
// (every event, step by step, and a replay) waits in one closed panel at the
// bottom for whoever wants the machinery.

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { verifyProjections } from "@/domain/projections";
import type { World } from "@/domain/types";
import { DataStrip } from "@/components/demo/DataStrip";
import { HowWeBuild } from "@/components/demo/HowWeBuild";
import { Ideas } from "@/components/demo/Ideas";
import { Phone } from "@/components/demo/Phone";
import { Story } from "@/components/demo/Story";
import { TryIt, type Step } from "@/components/demo/TryIt";
import { Hero } from "@/components/three/Hero";
import { Stage } from "@/components/three/Stage";
import { store, useLedger, useWorld } from "@/lib/store";
import { FAIR_CHECK_PICTURE } from "./fairCheckPicture";
import { Ledger } from "./Ledger";
import { IDS, MileJourneyApp, resultOf, send, STRAVA_LINE, walkSent, type Journey, type Kind, type PhoneTab } from "./MileJourney";
import { reachedIndex, verifyChain } from "./model";
import { Pipeline } from "./Pipeline";
import { Replay } from "./Replay";
import { FLIGHTS, OUTCOME_COLOR, type Flight } from "./flights";

const XRayScene = dynamic(() => import("./XRayScene"), { ssr: false, loading: () => null });

/** The seven checks, in the words the gates wear. */
const CHECKS = ["Is it real?", "Is it theirs?", "Counted already?", "Allowed?", "Saved", "On the record", "Totals updated"];

type Activity = World["activities"][string];
const mayaHas = (w: World, test: (a: Activity) => boolean) => Object.values(w.activities).some((a) => a.memberId === "maya" && test(a));

const STEPS: Step[] = [
  {
    id: "walk",
    label: "Read Maya's evening walk",
    hint: "Her phone reads it from Apple Health.",
    why: "Your app already brings walks in. New here: you can watch every check it passes, in order.",
    done: (w) => mayaHas(w, (a) => a.source === "healthkit" && a.externalId === IDS.walk && a.status === "counted"),
  },
  {
    id: "garmin",
    label: "Get the same walk from her Garmin",
    hint: "Her watch sends it too.",
    why: "Two apps, one walk, counted once. Same distance, started minutes apart — so the watch's copy is kept, not added.",
    done: (w) => mayaHas(w, (a) => a.source === "garmin" && a.externalId === IDS.garmin && a.status === "superseded"),
  },
  {
    id: "odd",
    label: "Send a walk that looks off",
    hint: "40 miles in one hour.",
    why: "As more apps connect, one odd walk could jump the leaderboard. The fair check holds it for a person to look at — nobody is accused.",
    done: (w) => mayaHas(w, (a) => a.source === "garmin" && a.externalId === IDS.odd && a.status === "quarantined"),
  },
  {
    id: "strava",
    label: "Send a run from Strava",
    hint: "If you ever add Strava.",
    why: STRAVA_LINE,
    done: (w) => mayaHas(w, (a) => a.source === "strava" && a.externalId === IDS.strava),
  },
  {
    id: "typed",
    label: "Add miles by hand",
    hint: "Your app's + button, through the same checks.",
    why: "Typed miles count like any app's, and two real walks stay two walks — they're never merged.",
    done: (w) => mayaHas(w, (a) => a.externalId.startsWith(IDS.typedPrefix) && a.status === "counted"),
  },
];

const WALK_TYPES = new Set(["PROVIDER_DELIVERY", "LOG_ACTIVITY"]);

function JourneyPhone({ tab, onTab, journey, onSend }: { tab: PhoneTab; onTab: (t: PhoneTab) => void; journey: Journey | null; onSend: (k: Kind) => void }) {
  const world = useWorld();
  return (
    <Phone label="How miles count app" height={800}>
      <MileJourneyApp world={world} tab={tab} onTab={onTab} journey={journey} onSend={onSend} />
    </Phone>
  );
}

/** Why it matters, as Kayla would tell it to a sponsor. */
function WhyItMatters() {
  return (
    <Story
      title="Numbers a brand *can trust.*"
      beats={[
        { text: "When you tell a brand your movers logged 100,000 miles, that number has to be *real*." },
        { text: "Lots of members wear a watch and carry a phone, so the same walk often arrives twice. Here it *counts once*." },
        { text: "Sometimes a watch is left on in the car. That walk waits for a person before it counts — and nobody gets accused." },
        { text: STRAVA_LINE },
        { text: "Routes and home addresses stay in the app unless you choose to share." },
      ]}
      close="Try it below: read Maya's walk, then get the same walk from her Garmin."
    />
  );
}

export function XRay() {
  const ledger = useLedger();
  const world = useWorld();
  const [tab, setTab] = useState<PhoneTab>("send");
  const [journey, setJourney] = useState<Journey | null>(null);
  const [record, setRecord] = useState(false);

  const chain = useMemo(() => verifyChain(ledger), [ledger]);
  const drift = verifyProjections(world);
  const walks = ledger.filter((r) => WALK_TYPES.has(r.type));
  const passed = walks.filter((r) => r.outcome === "applied").length;
  const held = walks.filter((r) => r.outcome === "rejected" || r.outcome === "blocked" || r.outcome === "quarantined").length;
  // The scene flies the newest events through the seven gates.
  const flights = useMemo<Flight[]>(() => ledger.slice(-FLIGHTS).map((r) => ({ seq: r.seq, outcome: r.outcome, stop: reachedIndex(r), hash: r.hash })), [ledger]);

  const onSend = (k: Kind) => {
    const receipt = send(k);
    setJourney({ kind: k, receipt, result: resultOf(receipt, store.get().machine.world) });
    setTab("send");
  };
  const showTotal = () => setTab("total");

  return (
    <div>
      <Hero
        mode="night"
        eyebrow="How miles count"
        title="One walk. Seven checks. *Counted once.*"
        lede="Phones and watches send walks all summer long. Every one passes the same seven checks before it counts, so every total a member or a sponsor sees is one they can trust."
        actions={<WhyItMatters />}
        stage={<Stage name="xray" scene={XRayScene} props={{ flights, stations: CHECKS, total: ledger.length, firstBreak: chain.firstBreak, drift: drift.length }} fallback={<GatesFallback />} />}
        legendTitle="On this visit"
        legend={[
          { label: "Checks on every walk", value: CHECKS.length },
          { label: "Passed every check", value: passed, color: OUTCOME_COLOR.applied },
          { label: "Stopped or set aside", value: held, color: OUTCOME_COLOR.rejected },
          { label: "Totals match everywhere", value: drift.length ? "Not yet" : "Yes", color: drift.length ? OUTCOME_COLOR.rejected : "#5fd3a2" },
        ]}
      />

      <DataStrip
        className="mt-10"
        points={[
          { value: "Millions", line: "of fake activities get pulled from big fitness apps every year. Bad data comes with scale." },
          { value: "4 in 10", line: "adults wear a smartwatch or tracker — and most also carry a phone that logs the same walk." },
          { value: "7 checks", line: "every walk passes before it counts, whichever app it came from: Apple Health, Health Connect or Garmin." },
        ]}
      />

      <TryIt
        index="01"
        title="Follow a mile. *Watch it count.*"
        intro="Five walks a real summer sends in. Tap each one on the phone and watch what happens to it."
        steps={STEPS}
        example="1.4 mi counted for Maya."
        phone={<JourneyPhone tab={tab} onTab={setTab} journey={journey} onSend={onSend} />}
        finale={
          <>
            <strong>That&apos;s the whole promise.</strong> Every mile counts once, even from two apps. A walk that looks off waits for a person. Strava&apos;s copy stays private — and Maya can always see why her
            total is what it is.
          </>
        }
      />

      <Ideas
        index="02"
        title="Every honest mile *counts.*"
        intro="Each one starts from what your app already does, and says what it adds."
        ideas={[
          {
            title: "A friendly fair check",
            line: "As more apps connect, one odd walk could jump the leaderboard. The fair check holds it for a person to look at — nobody is accused, and every honest mile still counts.",
            origin: "new",
            image: FAIR_CHECK_PICTURE,
            state: "live",
            show: () => onSend("odd"),
          },
          {
            title: "Counted once, across apps",
            line: "Your app already refuses the same walk twice from one app. Now the same walk from Garmin and Apple Health counts once too.",
            origin: "yours",
            state: "live",
            show: () => onSend(walkSent(store.get().machine.world) ? "garmin" : "walk"),
          },
          {
            title: "Where this mile came from",
            line: "Your app already lists each activity. This adds a plain answer to \"why is my total…?\" — miles by app, plus any walk still being checked.",
            origin: "yours",
            state: "live",
            show: showTotal,
          },
          {
            title: "The map stays home",
            line: "Your app already collects no location and never sells data. Sponsors will only ever see totals from 10 or more people.",
            origin: "yours",
            state: "next",
          },
          {
            title: "Your day, your clock",
            line: "Your app already counts miles from May 1. Each walk will land on the member's own calendar day, wherever they live.",
            origin: "yours",
            state: "next",
          },
        ]}
      />

      <HowWeBuild
        index="03"
        lines={[
          { what: "Same id, saved once", how: "Your runs table already refuses the same source and id twice, so one app can't count a walk twice.", effort: "Have" },
          {
            what: "One door: ingest_run",
            how: "One Postgres function every walk goes through. Phone custom actions call it as the signed-in member; the Garmin webhook calls it server-side, with its secret required.",
            effort: "M",
          },
          {
            what: "Counted once across apps",
            how: "Keep the unique index and add a fingerprint: same start within 15 minutes, distance within 3%. The member's own log wins; the other copy is kept, not added.",
            effort: "M",
          },
          {
            what: "Set aside, not deleted",
            how: "A status on runs — counted, set aside, no distance, duplicate. Faster than a person can go on foot or wheels, or over 60 miles in a day, waits on a short review list for a City Lead or the tech team.",
            effort: "M",
          },
          { what: "Totals from one view", how: "Totals and the leaderboard read one database view of counted miles, instead of numbers each phone writes to Firestore.", effort: "S" },
          { what: "Signed-in saves", how: "Firebase sign-in passed through to Supabase, so row rules let each member write only their own runs.", effort: "S" },
        ]}
        note="No new servers: one Postgres function, the Garmin Edge Function you already run, an append-only run_events log, and one review page. Strava only if Kayla wants it — and then only on the member's own screen for 7 days."
      />

      {/* Optional depth, under the same "Under the hood" heading as How we'd build it — not a chapter of its own. */}
      <section aria-label="The full record" className="mx-auto -mt-6 w-full max-w-[1320px] px-4 pb-8 sm:px-6 lg:px-8">
        <details className="group card overflow-hidden" onToggle={(e) => setRecord((e.currentTarget as HTMLDetailsElement).open)}>
          <summary className="tap flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 [&::-webkit-details-marker]:hidden">
            <span>
              <span className="block font-[family-name:var(--font-display)] text-[20px] font-black uppercase tracking-[-0.02em]">Every step, and a replay</span>
              <span className="mt-0.5 block text-[14px] text-muted">Under the hood: everything that happened on this visit, in order, and a replay that rebuilds it.</span>
            </span>
            <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line-strong text-[20px] transition-transform group-open:rotate-45">
              +
            </span>
          </summary>
          {record ? <RecordView /> : null}
        </details>
      </section>
    </div>
  );
}

/** The machinery, unchanged: pick any event and follow it; rebuild the session from its record. */
function RecordView() {
  const ledger = useLedger();
  const [selected, setSelected] = useState<number | null>(null);
  const seq = selected ?? (ledger.length || null);
  const receipt = seq ? (ledger[seq - 1] ?? null) : null;
  const previousHash = receipt && receipt.seq > 1 ? (ledger[receipt.seq - 2]?.hash ?? null) : null;
  const [plainWords, setPlainWords] = useState(true);
  return (
    <div className="space-y-10 border-t border-line p-4 sm:p-6">
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(320px,400px)_1fr]">
        <Ledger ledger={ledger} selected={seq} onSelect={setSelected} />
        <Pipeline receipt={receipt} previousHash={previousHash} plain={plainWords} onPlain={setPlainWords} />
      </div>
      <Replay onShow={setSelected} />
    </div>
  );
}

/** Without WebGL: the seven checks as a quiet row of arches, so the hero still says what it is. */
function GatesFallback() {
  return (
    <ol aria-hidden className="absolute inset-x-0 top-[12%] mx-auto flex max-w-[760px] justify-center gap-2 px-4 lg:left-auto lg:right-[6%] lg:w-[56%]">
      {CHECKS.map((name) => (
        <li key={name} className="flex h-40 flex-1 items-end justify-center rounded-t-[22px] border-2 border-b-0 border-line-strong px-1 pb-2 text-center text-[11px] leading-tight text-muted">
          {name}
        </li>
      ))}
    </ol>
  );
}
