"use client";

// Presenter mode: "Maya's Saturday". A guided walk through every lens that is
// advanced by hand (no timers). The audience sees the step and the controls;
// the presenter's notes (what to say, click, expect, why, how, and what to be
// honest about) stay folded or open in a second window. "Do it for me" sends
// the step's real commands through the engine, so presenting and exploring
// are the same world.

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { tick } from "@/domain/calendar";
import type { CommandInput } from "@/domain/commands";
import { IMPACT_STAGES, type Actor, type World } from "@/domain/types";
import { actors, store, useUI, useWorld } from "@/lib/store";
import { cn } from "@/components/ui/kit";

interface Step {
  route: string;
  title: string;
  say: string;
  click: string;
  happens: string;
  why: string;
  how: string;
  honest: string;
  viewer?: string;
  /** Where the audience should be looking after the step runs. */
  focus?: string;
  /**
   * Commands to send, given the current world (already-done ones are skipped).
   * A step with `done` is asked again after its commands run, so it can act on
   * what they created (an event it drafted), until it is done or has nothing left.
   */
  act?: (w: World) => { input: CommandInput; actor: Actor }[];
  done?: (w: World) => boolean;
}

const maya = actors.member("maya");
const james = actors.member("james");
const nina = actors.organizer("nina");
type Cmd = { input: CommandInput; actor: Actor };

const MAX_ROUNDS = 4;

/** Sends a step's commands through the engine; returns how many were sent. */
function perform(step: Step, via: string): number {
  let sent = 0;
  for (let round = 0; round < (step.done ? MAX_ROUNDS : 1); round++) {
    if (step.done?.(store.get().machine.world)) break;
    const cmds = step.act?.(store.get().machine.world) ?? [];
    if (!cmds.length) break;
    for (const { input, actor } of cmds) store.dispatch(input, actor, { via });
    sent += cmds.length;
  }
  return sent;
}

const IMPACT_WALK = "Neighborhood Walk, the members' pick";

/** The walk the neighborhood program pays for: Nina's own event, never one a partner already bought. */
function impactWalk(w: World) {
  return Object.values(w.events).find((e) => e.chapterId === "detroit" && e.title === IMPACT_WALK && e.fundedBy === null && e.status !== "cancelled");
}

export const STEPS: Step[] = [
  {
    route: "/",
    title: "It starts with one first mile.",
    say: "Someone who isn't sure they belong decides to move anyway. That moment is what 100 Miles of Summer is for.",
    click: "Continue three times on the opening (or the → key).",
    happens: "The camera rises from one line to many lines meeting at a start line.",
    why: "The whole platform is a promise: you won't be alone, and your pace counts.",
    how: "React Three Fiber scene, lazy-loaded; an SVG still without WebGL or with reduced motion; the GPU stops once a move settles.",
    honest: "Founder facts come from public pages. Nothing here is in Kayla's voice or approved by her.",
  },
  {
    route: "/member",
    viewer: "maya",
    title: "Meet Maya.",
    say: "Maya has walked 12.4 miles. Her goal is in her own words, and every pace counts.",
    click: "Point at the ring, the stamps, then the Log tab.",
    happens: "Nothing changes yet — this is her season so far.",
    why: "Pace-agnostic progress is the brand's core promise, made structural.",
    how: "memberView() derives miles only from sources that may count.",
    honest: "Maya is fictional. The real app already has progress and badges.",
  },
  {
    route: "/member",
    viewer: "maya",
    title: "Her miles, her choice.",
    say: "Maya joins her local circle and chooses to share her Apple Health miles with it. Only she can flip that switch.",
    click: "You tab → the consent grid.",
    happens: "Detroit's shared total rises by exactly her miles. Strava cells stay locked for anyone who uses it.",
    why: "Strava's June 2026 terms keep its data owner-only; health platforms need opt-in. Members deserve to see that.",
    how: "decide(dataClass, purpose, consents) — one function every view calls. Only Maya can flip her own switches.",
    honest: "Rule readings marked 'review' need counsel before production.",
    act: (w) => [
      ...(w.members.maya?.chapterId !== "detroit" ? [{ input: { type: "JOIN_CHAPTER", payload: { memberId: "maya", chapterId: "detroit" } } as CommandInput, actor: maya }] : []),
      ...(!w.members.maya?.consents.chapter.healthkit ? [{ input: { type: "SET_CONSENT", payload: { memberId: "maya", purpose: "chapter", source: "healthkit", granted: true } } as CommandInput, actor: maya }] : []),
    ],
    done: (w) => w.members.maya?.chapterId === "detroit" && Boolean(w.members.maya?.consents.chapter.healthkit),
  },
  {
    route: "/coach",
    viewer: "maya",
    title: "A hard week.",
    say: "Maya missed twelve days. The coach answers kindly, says who the advice comes from, and suggests one small step.",
    click: "On the phone: tap a question, then “Who says?”.",
    happens: "A short, kind answer, a clear limit, and a step she can save — nothing happens without her tap.",
    why: "People need confidence and a next step, not a chatbot that diagnoses or prescribes.",
    how: "classify → policy-filtered context → cards → validator → proposed step. No language model.",
    honest: "The lessons are drafts written in her spirit — not her words. Free text stays off at launch until a sealed safety set passes.",
    focus: `[data-testid="phone"]`,
    act: (w) =>
      Object.values(w.coach.answers).some((a) => a.memberId === "maya" && a.intent === "restart")
        ? []
        : [{ input: { type: "ASK_COACH", payload: { memberId: "maya", question: "I missed 12 days and I feel like I ruined everything." } }, actor: maya }],
    done: (w) => Object.values(w.coach.answers).some((a) => a.memberId === "maya" && a.intent === "restart"),
  },
  {
    route: "/circles",
    viewer: "maya",
    title: "Saturday's first walk.",
    say: "No RSVP needed — Maya just lets Nina know she's coming. James walks at the back of the longer route, so nobody finishes alone.",
    click: "Switch the phone to Nina, the City Lead: Maya is on her list.",
    happens: "The same RSVP appears for Nina — a first name, plus access needs only if Maya chose to share them. No activity data.",
    why: "Real-world belonging is the product; the sweep answers 'will I be last?'",
    how: "RSVP with capacity and waitlist; roster() is the organizer's minimal, consent-aware projection.",
    honest: "Chapters, organizers and attendance are fictional.",
    focus: `article[aria-label="Saturday First Mile"]`,
    act: (w) => (w.events["det-first-mile"]?.rsvps.includes("maya") ? [] : [{ input: { type: "RSVP", payload: { memberId: "maya", eventId: "det-first-mile" } }, actor: maya }]),
    done: (w) => Boolean(w.events["det-first-mile"]?.rsvps.includes("maya")),
  },
  {
    route: "/circles",
    viewer: "maya",
    title: "She shows up.",
    say: "Saturday morning, the City Lead checks Maya in. Her first group walk counts toward her summer.",
    click: "On Nina's phone: open the walk, then check Maya in.",
    happens: "Maya gets a first-event stamp and a counted first-party mile; James earns 'welcomed someone'.",
    why: "Check-ins are the one record the movement fully owns — the honest basis for everything partners see.",
    how: "CHECK_IN runs through the same ingest path as any activity, so it counts once; it accepts only the event's own distances, within six hours of the start.",
    honest: "In production this would be an offline-first organizer screen.",
    focus: `article[aria-label="Saturday First Mile"]`,
    act: (w) => {
      const out: Cmd[] = [];
      if (w.clock < tick(14, 9 * 60)) out.push({ input: { type: "ADVANCE_CLOCK", payload: { to: tick(14, 9 * 60) } }, actor: actors.system });
      const e = w.events["det-first-mile"];
      if (e && !e.checkIns.some((c) => c.memberId === "maya")) out.push({ input: { type: "CHECK_IN", payload: { eventId: "det-first-mile", memberId: "maya", distanceMi: 1 } }, actor: nina });
      if (e && e.status !== "completed") out.push({ input: { type: "COMPLETE_EVENT", payload: { eventId: "det-first-mile" } }, actor: nina });
      return out;
    },
    done: (w) => w.events["det-first-mile"]?.status === "completed",
  },
  {
    route: "/partner",
    title: "A sponsor steps in.",
    say: "An outdoor brand wants to fund first walks. It sees where every dollar goes before it signs.",
    click: "Change the fee and watch the range. Then walk the pipeline.",
    happens: "Signed, paid, live: six funded walks appear as submissions for organizers, with no access claims until someone checks each site.",
    why: "Strava's sponsored challenges start around $30,000; local partners have little in between. Revenue is not profit, and promised money is not money.",
    how: "economics() and a seeded 2,000-run band; impact enters the pool only when the payment is recorded.",
    honest: "Northline and every price are fictional; ranges come from public research, not sales.",
    act: (w) => {
      const p = w.proposals["pr-northline"];
      if (!p) return [];
      const out: Cmd[] = [];
      if (p.chapterIds.length < 2) out.push({ input: { type: "SET_PROPOSAL_CHAPTERS", payload: { proposalId: "pr-northline", chapterIds: ["detroit", "charleston"] } }, actor: actors.founder });
      if (p.signedAt === null) out.push({ input: { type: "ADVANCE_DEAL", payload: { proposalId: "pr-northline" } }, actor: actors.founder });
      if (p.paidAt === null) out.push({ input: { type: "RECORD_PAYMENT", payload: { proposalId: "pr-northline" } }, actor: actors.founder });
      if (p.stage === "proposal" || p.stage === "contract") out.push({ input: { type: "ADVANCE_DEAL", payload: { proposalId: "pr-northline" } }, actor: actors.founder });
      return out;
    },
    done: (w) => w.proposals["pr-northline"]?.stage === "live" && w.proposals["pr-northline"]?.paidAt !== null,
  },
  {
    route: "/partner",
    title: "What sponsors can't buy.",
    say: "The sponsor asks for the list of people who came. The answer is no: sponsors see counts, never people.",
    click: "The request buttons.",
    happens: "Refused, with the rule that refused it.",
    why: "That line is what lets members trust the sponsor.",
    how: "PARTNER_DATA_REQUEST → decide() per source; allowed disclosures go to the egress log.",
    honest: "A real program needs contracts, insurance and a W-9 first.",
    act: () => [{ input: { type: "PARTNER_DATA_REQUEST", payload: { proposalId: "pr-northline", request: "participant-list" } }, actor: actors.partner("northline") }],
  },
  {
    route: "/impact",
    viewer: "maya",
    title: "Giving back.",
    say: "Part of the sponsor's money pays for a walk the members voted for. It's walked now — and fully proven once ten people have walked it.",
    click: "Follow the program's track from proposed to delivered.",
    happens: "Funded from paid money, delivered on its own walk after funding, and honestly short of verified.",
    why: "Proposed, funded, delivered and verified must never look the same — and one walk can't prove two funders' money.",
    how: "ADVANCE_PROGRAM guards: votes, paid pool, a completed event after funding that no partner paid for and no other program claims, and named attendance.",
    honest: "No charity or legal entity exists for 100MoS today; this is a model.",
    act: (w) => {
      const prog = w.programs.neighborhood;
      if (!prog) return [];
      const out: Cmd[] = [];
      const toFunded = Math.max(0, IMPACT_STAGES.indexOf("funded") - IMPACT_STAGES.indexOf(prog.stage));
      for (let i = 0; i < toFunded; i++) out.push({ input: { type: "ADVANCE_PROGRAM", payload: { programId: "neighborhood" } }, actor: actors.founder });
      const walk = impactWalk(w);
      if (!walk) {
        // Next round picks up the draft this creates.
        const day = Math.floor(w.clock / 1440) + 1;
        out.push({
          input: {
            type: "DRAFT_EVENT",
            payload: { chapterId: "detroit", title: IMPACT_WALK, day, startMinute: 8 * 60, meetingArea: "Belle Isle, Casino lawn", distanceOptions: [1, 2], mode: "walk", access: ["step-free", "short-option", "shade"], capacity: 40 },
          },
          actor: nina,
        });
        return out;
      }
      if (walk.status === "submitted" || walk.status === "draft") {
        if (!walk.sweep) out.push({ input: { type: "ASSIGN_SWEEP", payload: { eventId: walk.id, memberId: "james" } }, actor: nina });
        out.push({ input: { type: "PUBLISH_EVENT", payload: { eventId: walk.id } }, actor: nina });
      }
      if (walk.status !== "completed") {
        if (!walk.rsvps.includes("maya")) out.push({ input: { type: "RSVP", payload: { memberId: "maya", eventId: walk.id } }, actor: maya });
        if (!walk.rsvps.includes("james")) out.push({ input: { type: "RSVP", payload: { memberId: "james", eventId: walk.id } }, actor: james });
        const start = tick(walk.day, walk.startMinute);
        out.push({ input: { type: "ADVANCE_CLOCK", payload: { to: start + 60 } }, actor: actors.system });
        out.push({ input: { type: "CHECK_IN", payload: { eventId: walk.id, memberId: "maya", distanceMi: 1 } }, actor: nina });
        out.push({ input: { type: "CHECK_IN", payload: { eventId: walk.id, memberId: "james", distanceMi: 1 } }, actor: nina });
        out.push({ input: { type: "COMPLETE_EVENT", payload: { eventId: walk.id } }, actor: nina });
      }
      if (prog.stage !== "delivered" && prog.stage !== "verified") {
        out.push({ input: { type: "ADVANCE_PROGRAM", payload: { programId: "neighborhood" } }, actor: actors.founder });
        out.push({ input: { type: "ADVANCE_PROGRAM", payload: { programId: "neighborhood" } }, actor: actors.founder });
      }
      return out;
    },
    done: (w) => w.programs.neighborhood?.stage === "delivered" || w.programs.neighborhood?.stage === "verified",
  },
  {
    route: "/founder",
    title: "Kayla's week.",
    say: "Everything that just happened lands here. Kayla sees which City Leads could use a hand after a big Saturday.",
    click: "The risk list and the 'what changed' feed.",
    happens: "Everything Maya and Northline did is already here.",
    why: "A founder's scarce time goes to the one or two things that could hurt the movement.",
    how: "founderView() reads the same world; risks are computed, not written.",
    honest: "No real operating data is shown.",
  },
  {
    route: "/xray",
    title: "Every mile, counted once.",
    say: "Maya's evening walk arrives three times. It counts once. That's how every total stays fair.",
    click: "On the phone: send the same walk from a second app, then one that looks off.",
    happens: "One copy counts, the repeats change nothing, and the odd walk is set aside for a person to look at.",
    why: "A beautiful demo is only credible if the mechanism holds when poked.",
    how: "Faults change the input stream, never the engine. Replay folds the log to the same hash, even after erasure.",
    honest: "In-browser engine; production would run the same rules in Supabase.",
    act: () =>
      [1, 2, 3].map(() => ({
        input: { type: "PROVIDER_DELIVERY", payload: { provider: "healthkit", memberId: "maya", externalId: "hk:evening-walk", version: 1, op: "upsert", distanceMi: 1.4, mode: "walk", startedAt: tick(13, 18 * 60), durationMin: 28 } } as CommandInput,
        actor: actors.provider("healthkit"),
      })),
  },
  {
    route: "/future",
    title: "The next three summers.",
    say: "One summer of pilots tells us who comes back. Then the team, in order, and the money — Year 10 needs one big partner.",
    click: "Pick a path on the phone, then drag the pilot's sliders and flip the team switches below.",
    happens: "Walks, first-timers and teammates change first; what's still to raise comes last. Goals read today's demo world.",
    why: "The question isn't how big. It's which one thing to try first.",
    how: "runYear/runPath with seeded bands; liveGates(world).",
    honest: "Arithmetic on assumptions, not a forecast. End on the question: which one journey and which one pilot do we test first?",
  },
  {
    route: "/vision",
    title: "Find your people.",
    say: "Ten summers built a movement. This is the network it can become: people, places and partners, moving together.",
    click: "Next on the city, scene by scene, then tap an idea on the map.",
    happens: "The city lights up as a first walk is found, fits, fills, gets funded, and changes the street it runs on.",
    why: "Kayla's hardest-to-copy asset is her people and her City Leads. The software only makes them easier to find and keep.",
    how: "A self-contained scene and keynote; the ideas map reads vision/ideas.ts.",
    honest: "Possibilities, not promises. The first year is about proving people come.",
  },
];

const PHONE = '[data-testid="phone"]';

/** Run every step's actions in order: the whole story in one click (empty states use it). */
export function loadStory(): number {
  let sent = 0;
  for (const step of STEPS) sent += perform(step, "load-story");
  return sent;
}

/** Only the Saturday itself — everything before Kayla's week — so her screen isn't left showing the later steps' test walks. */
export function loadSaturday(): number {
  const upTo = STEPS.findIndex((s) => s.route === "/founder");
  let sent = 0;
  for (const step of STEPS.slice(0, upTo < 0 ? STEPS.length : upTo)) sent += perform(step, "load-story");
  return sent;
}

const CHANNEL = "fl4-present";

export function PresentOverlay() {
  const { present } = useUI();
  const w = useWorld();
  const router = useRouter();
  const pathname = usePathname();
  const step = present === null ? null : STEPS[Math.min(present, STEPS.length - 1)];
  // Steps the world can't confirm (asking for a member list changes nothing) count as done once shown.
  const [shown, setShown] = useState<ReadonlySet<number>>(() => new Set());
  // On a phone, "Show me" tucks the panel into a slim bar so the phone it points at stays in view.
  const [tucked, setTucked] = useState(false);
  // One channel per visit to the notes window, closed when the tour goes.
  const channel = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    try {
      channel.current = new BroadcastChannel(CHANNEL);
    } catch {
      // No BroadcastChannel: the pop-out window falls back to sessionStorage.
    }
    return () => channel.current?.close();
  }, []);

  useEffect(() => {
    if (!step) return;
    setTucked(false);
    if (step.viewer && store.get().ui.viewer !== step.viewer) store.setUI({ viewer: step.viewer });
    if (pathname !== step.route) router.push(step.route);
    channel.current?.postMessage({ step: present });
    // Route changes are driven by the step, not by every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [present]);

  // Esc closes the tour, unless a sheet is open: that Esc belongs to the sheet.
  useEffect(() => {
    if (present === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      store.setUI({ present: null });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [present]);

  if (present === null || !step || pathname === "/notes") return null;
  const done = step.done ? step.done(w) : shown.has(present);
  const go = (n: number) => store.setUI({ present: Math.max(0, Math.min(STEPS.length - 1, n)) });
  const run = () => {
    perform(step, "presenter");
    setShown((s) => new Set(s).add(present));
    // "Show me" changes the phone, so bring the phone into view unless the step names something else.
    const target = step.focus ?? (step.route === "/" ? null : PHONE);
    const narrow = window.innerWidth < 640;
    if (narrow) setTucked(true);
    if (target) {
      setTimeout(() => document.querySelector(target)?.scrollIntoView({ behavior: "smooth", block: narrow ? "start" : "center" }), 120);
    }
  };
  const next = () => (present === STEPS.length - 1 ? store.setUI({ present: null }) : go(present + 1));
  const progress = (
    <div className="h-1 bg-surface-2" aria-hidden>
      <div className="h-full bg-accent shadow-[0_0_12px_var(--accent)] transition-[width] duration-500" style={{ width: `${((present + 1) / STEPS.length) * 100}%` }} />
    </div>
  );

  if (tucked) {
    return (
      <aside data-mode="day" aria-label="Tour" className="fixed inset-x-2 bottom-2 z-[65] overflow-hidden rounded-2xl border border-accent/40 bg-bg shadow-[0_20px_60px_-20px_rgba(0,0,0,0.9)]">
        {progress}
        <div className="flex items-center gap-2 px-3 py-2">
          <span className="num shrink-0 text-[12.5px] font-bold text-accent-ink">
            {present + 1}/{STEPS.length}
          </span>
          <button type="button" onClick={() => setTucked(false)} aria-expanded={false} className="tap min-w-0 flex-1 truncate text-left text-[14px] font-bold">
            {step.title}
          </button>
          <button type="button" onClick={next} className="tap shrink-0 rounded-xl border border-ink px-4 text-[14px] font-bold">
            {present === STEPS.length - 1 ? "Finish" : "Next"}
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside
      data-mode="day"
      aria-label="Tour"
      className="fixed inset-x-2 bottom-2 z-[65] overflow-hidden rounded-[20px] border border-accent/40 bg-bg shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9),0_0_60px_-20px_rgba(255,106,19,0.6)] sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-[420px]"
    >
      {progress}
      <div className="px-5 pb-4 pt-4">
        <div className="flex items-center justify-between gap-3">
          <span className="num text-[12.5px] font-bold text-accent-ink">
            {present + 1} / {STEPS.length}
          </span>
          <button type="button" onClick={() => store.setUI({ present: null })} className="tap -mr-2 rounded-full px-2.5 text-[13px] text-muted hover:text-ink">
            Close
          </button>
        </div>
        <h2 className="mt-1 font-[family-name:var(--font-display)] text-[26px] font-black uppercase leading-[0.95] tracking-[-0.03em]">{step.title}</h2>
        <p className="mt-2.5 text-[16px] leading-relaxed text-ink/90">{step.say}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {step.act ? (
            <button
              type="button"
              onClick={run}
              disabled={done}
              className={cn("tap rounded-xl border px-4 text-[14px] font-black uppercase tracking-[0.06em]", done ? "border-transparent bg-ok-soft text-ok" : "border-accent bg-ink text-bg")}
            >
              {done ? "Done ✓" : "Show me"}
            </button>
          ) : null}
          <button type="button" onClick={() => go(present - 1)} disabled={present === 0} className="tap ml-auto rounded-xl border border-line-strong px-4 text-[14px] font-bold disabled:opacity-40">
            Back
          </button>
          <button type="button" onClick={next} className="tap rounded-xl border border-ink px-5 text-[14px] font-bold">
            {present === STEPS.length - 1 ? "Finish" : "Next"}
          </button>
        </div>
        {present === 0 ? (
          <button type="button" onClick={() => store.reset()} className="tap mt-1 text-[13px] text-muted underline-offset-4 hover:underline">
            Start over
          </button>
        ) : null}
      </div>
    </aside>
  );
}

export function NotesBody({ step }: { step: Step }) {
  return (
    <>
      <p className="text-[15px] leading-relaxed">{step.say}</p>
      <dl className="mt-3 grid gap-2 text-[13px] leading-snug">
        {(
          [
            ["Click", step.click],
            ["What happens", step.happens],
            ["Why it matters", step.why],
            ["How it works", step.how],
            ["Be honest about", step.honest],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="grid grid-cols-[104px_1fr] gap-2">
            <dt className={cn("eyebrow pt-0.5", k === "Be honest about" && "text-accent-ink")}>{k}</dt>
            <dd className="text-muted">{v}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

/** The second-window notes view: follows the presenter's step over a BroadcastChannel. */
export function PopOutNotes() {
  const { present } = useUI();
  const [stepIndex, setStepIndex] = useState<number>(present ?? 0);
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(CHANNEL);
      channel.onmessage = (e: MessageEvent<{ step: number | null }>) => {
        if (typeof e.data?.step === "number") setStepIndex(e.data.step);
      };
    } catch {
      // Without BroadcastChannel the notes follow this tab's own presenter state.
    }
    return () => channel?.close();
  }, []);
  useEffect(() => {
    if (typeof present === "number") setStepIndex(present);
  }, [present]);
  const step = STEPS[Math.min(stepIndex, STEPS.length - 1)]!;
  return (
    <div data-mode="day" className="min-h-screen bg-bg px-6 py-6 text-ink">
      <div className="eyebrow">
        Presenter notes · step {stepIndex + 1} of {STEPS.length}
      </div>
      <h1 className="t-section mt-1">{step.title}</h1>
      <div className="mt-4">
        <NotesBody step={step} />
      </div>
    </div>
  );
}
