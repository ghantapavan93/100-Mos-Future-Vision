"use client";

// The Roadmap: one list Kayla and Kirk can both read — what 100 Miles of Summer
// already has, quick fixes (today's numbers first), the six steps to Year 10
// with dates, and what waits — with a way to try each piece this demo already
// shows. The 3D road above reads it at a glance: what's ready, six steps, May 1.
// Tap a step on the road to open it on the phone.

import dynamic from "next/dynamic";
import { useState } from "react";
import { COLUMNS, ROADMAP, type Column } from "@/blueprint/roadmap";
import { DataStrip } from "@/components/demo/DataStrip";
import { HowWeBuild } from "@/components/demo/HowWeBuild";
import { Story } from "@/components/demo/Story";
import { TryIt, type Step } from "@/components/demo/TryIt";
import { Hero, type LegendItem } from "@/components/three/Hero";
import { Stage } from "@/components/three/Stage";
import type { RoadStep } from "./BuildScene";
import { RoadmapPhone, type Opened } from "./RoadmapPhone";

const BuildScene = dynamic(() => import("./BuildScene"), { ssr: false, loading: () => null });

/** The six Year 10 steps, in order, as the road shows them. */
const ROAD: RoadStep[] = ROADMAP.filter((r) => r.step).map((r) => ({ id: r.id, n: r.step!, title: r.title, when: r.when ?? "" }));
const READY = ROADMAP.filter((r) => r.column === "ready").length;

/** Each list in the key, with when it lands in a few words. */
const LIST_WORDS: Record<Column, string> = {
  ready: "Ready now · in your app today",
  fixes: "Quick fixes · by Nov 20",
  launch: "Year 10 · steps to May 1",
  next: "Next up · summer 2027",
  later: "Later · 2028 on",
};
const LEGEND: LegendItem[] = COLUMNS.map((c) => ({
  label: LIST_WORDS[c.id],
  value: c.id === "launch" ? ROAD.length : ROADMAP.filter((r) => r.column === c.id).length,
  color: c.color,
}));

/** The Year 10 calls that wait on Kayla, in road order. */
const DECISIONS = ROADMAP.filter((r) => r.column === "launch" && r.needsKayla);

/** Beside the phone: the few Year 10 decisions that need her, each one tap from its card. */
function Decisions({ onOpen }: { onOpen: (id: string) => void }) {
  return (
    <div className="card p-5" aria-labelledby="decisions-title">
      <div id="decisions-title" className="eyebrow">
        Year 10 · what needs your OK
      </div>
      <ul className="mt-2 divide-y divide-line">
        {DECISIONS.map((d) => (
          <li key={d.id}>
            <button type="button" onClick={() => onOpen(d.id)} className="tap group flex w-full items-start justify-between gap-3 py-3 text-left">
              <span className="min-w-0">
                <span className="block text-[14.5px] font-bold leading-snug">
                  {d.step ? <span className="num text-accent-ink">{d.step} · </span> : null}
                  {d.title}
                </span>
                <span className="mt-0.5 block text-[13px] leading-snug text-muted">{d.needsKayla}</span>
              </span>
              <span aria-hidden className="mt-0.5 text-muted transition-transform group-hover:translate-x-0.5">
                ›
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const STEPS: Step[] = [
  {
    id: "card",
    label: "Open a Year 10 step",
    hint: "Tap the first card in Year 10.",
    why: "Six steps to May 1, each with dates, a finish line anyone can check, and what it needs from you. The pilot sits beside them.",
    done: (_w, marked) => marked.has("open-card"),
  },
  {
    id: "ready",
    label: "See what's ready now",
    hint: "Tap “Ready now” at the top of the phone.",
    why: "It starts with what you have: the app, the leaderboard, health-app sync, the shop, City Leads in 7 cities.",
    done: (_w, marked) => marked.has("open-ready"),
  },
  {
    id: "fixes",
    label: "Look at the quick fixes",
    hint: "Tap “Quick fixes” at the top.",
    why: "Tidy-ups come first — the Garmin tune-up, upcoming events, the Android release — then a few website touches.",
    done: (_w, marked) => marked.has("open-fixes"),
  },
  {
    id: "later",
    label: "See what can wait",
    hint: "Tap “Later” at the top.",
    why: "Good ideas that wait until Year 10 is steady, so nothing crowds the start line.",
    done: (_w, marked) => marked.has("open-later"),
  },
];

export function BuildExplorer() {
  const [column, setColumn] = useState<Column>("launch");
  const [opened, setOpened] = useState<Opened | null>(null);
  const focus = opened?.kind === "item" ? opened.id : column === "ready" ? "ready" : null;

  /** The road opens what was tapped on the phone: the Ready now list, or a Year 10 card. */
  const openFromRoad = (id: string) => {
    if (id === "ready") {
      setOpened(null);
      setColumn("ready");
    } else {
      setColumn("launch");
      setOpened({ kind: "item", id });
    }
    document.getElementById("try")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div>
      <Hero
        mode="day"
        eyebrow="Roadmap · to May 1, 2027"
        title="Six steps *to May 1.*"
        lede="It starts with what already works. Tidy up, test the first walks, and open Year 10 ready."
        actions={
          <Story
            title="The whole list, *in one place*"
            stat={{ value: "6 steps", line: "to May 1, 2027, each with dates and a finish line anyone can check." }}
            beats={[
              { text: "Some of it works today, some is a quick fix, and some can wait." },
              { text: "Tidy-ups come first, so Year 10 opens on a clean base." },
              { text: "Then *the pilot*: six Saturdays of first walks show what to fix before Year 10 grows." },
              { text: "Each card says what it is in one line, when it lands, and *what it needs from you*. Nothing reaches members until you've said yes." },
            ]}
            close="Start with Year 10 on the phone below."
          />
        }
        stage={
          <Stage
            name="build"
            scene={BuildScene}
            props={{ steps: ROAD, ready: READY, focus, onOpen: openFromRoad }}
            fallback={<div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_70%_35%,var(--surface)_0%,transparent_70%)]" />}
          />
        }
        legendTitle="On the roadmap"
        legend={LEGEND}
      />

      <DataStrip
        className="mt-6"
        points={[
          { value: String(READY), line: "things already work in your app today. Year 10 starts from them, not from scratch." },
          { value: "18 weeks", line: "of building to May 1, with room for the holidays and a launch rehearsal at the end." },
          { value: "4 in 10", line: "adults wear a smartwatch or tracker — so reading their health apps well matters." },
        ]}
      />

      <TryIt
        index="01"
        title="The roadmap, *in your pocket.*"
        intro="Five lists, from what works today to what can wait. Open any card — if this demo shows it, one tap takes you there."
        steps={STEPS}
        phone={<RoadmapPhone column={column} onColumn={setColumn} opened={opened} onOpen={setOpened} />}
        finale="One list the whole team can read: what's ready, what's next, when it lands, and where to try each piece today."
        feed={false}
        aside={
          <Decisions
            onOpen={(id) => {
              setColumn("launch");
              setOpened({ kind: "item", id });
            }}
          />
        }
      />

      <HowWeBuild
        index="02"
        lines={[
          { what: "Counted once, same app", how: "The unique source + sourceID index on runs already stops the same walk saving twice.", effort: "Have" },
          { what: "Health apps on the phone", how: "FlutterFlow custom actions already read Apple Health and Health Connect; Garmin's webhook lands in process_garmin_activity.", effort: "Have" },
          { what: "Same app, same sign-in", how: "FlutterFlow and Firebase sign-in stay. Supabase is set to accept the Firebase sign-in, so row rules know who's asking.", effort: "M" },
          { what: "One home for miles", how: "Today the phone writes totals and the leaderboard to Firestore. Instead, runs plus views work out every total and the leaderboard; Firestore keeps profile details only.", effort: "M" },
          { what: "Staging before production", how: "A second Supabase project and the FlutterFlow dev branch. Changes live in the backend git repo, and each rule gets a SQL test before it ships.", effort: "M" },
          { what: "Six steps to May 1 (M0–M5)", how: "Tidy-ups (Nov), sign-in all the way through (Dec), one door for miles (Jan), member screens (Feb–Mar), City Leads (Mar–Apr), launch rehearsal (Apr). About 17–19 developer-weeks.", effort: "L" },
        ]}
        note="Admin screens are role-gated FlutterFlow pages in the same app. Partner deals and the three-summer plan stay in spreadsheets until the money proves them."
      />
    </div>
  );
}
