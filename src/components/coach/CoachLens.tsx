"use client";

// The Quantum Health Coach, for Kayla and Kirk: every tip the coach may use as
// a 3D wall up top (her lessons first, help lines last), three numbers, then
// the coach itself in a phone — tap a question, see "Who says?", save one small
// step, and watch Safe Stop take over when the question is about pain. Below:
// how the AI thinks (lit by the last real answer), where the idea came from,
// the two safety locks, ideas, and how it gets built. The evaluation lab stays
// out of the way (only with ?lab=1).

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { cardsFor } from "@/domain/quantum/knowledge";
import type { CardStatus } from "@/domain/quantum/types";
import { COUNTABLE_SOURCES } from "@/domain/types";
import { DataStrip } from "@/components/demo/DataStrip";
import { HowWeBuild } from "@/components/demo/HowWeBuild";
import { Ideas, type Idea } from "@/components/demo/Ideas";
import { Phone } from "@/components/demo/Phone";
import { Story } from "@/components/demo/Story";
import { TryIt, type Step } from "@/components/demo/TryIt";
import { Hero, type LegendItem } from "@/components/three/Hero";
import { Stage } from "@/components/three/Stage";
import { cn } from "@/components/ui/kit";
import { actors, store, useUI, useWorld } from "@/lib/store";
import { askPicture } from "./askPicture";
import { CoachPhone, isSafeStop } from "./CoachPhone";
import { STATUS_COLOR, type CoachSceneProps } from "./colors";
import { FirstIdea } from "./FirstIdea";
import { HowItThinks } from "./HowItThinks";
import { GUIDED, INTENT_LABEL } from "./labels";
import { SafetyProof } from "./SafetyProof";

const CoachScene = dynamic(() => import("./CoachScene"), { ssr: false, loading: () => null });
// The evaluation lab (only with ?lab=1) and its question sets load only when it is opened.
const CoachLab = dynamic(() => import("./CoachLab").then((m) => m.CoachLab), { ssr: false, loading: () => null });

const question = (id: string) => GUIDED.find((g) => g.id === id)!.question;

/** The wall's reading order: Kayla's lessons first, help lines last — a crisis line is never the first thing anyone sees. */
const WALL_ORDER: CardStatus[] = ["proposed-lesson", "public-guideline", "proposed-rule", "resource"];

/** Each step's id is the `data-step-target` on the phone control that completes it. */
const CHIP_STEPS: Record<string, string> = { restart: "missed", pain: "pain" };

const ASK_PICTURE = askPicture();

export function CoachLens() {
  const w = useWorld();
  const { viewer } = useUI();
  const member = w.members[viewer];
  const [lab, setLab] = useState(false);
  useEffect(() => setLab(new URLSearchParams(window.location.search).get("lab") === "1"), []);

  const latest = useMemo(() => {
    const s = [...w.coach.sessions].reverse().find((x) => x.memberId === viewer);
    return s ? w.coach.answers[s.answerId] : undefined;
  }, [w.coach.sessions, w.coach.answers, viewer]);

  // The hero: every tip the coach may use and the ones the latest answer used.
  const scene = useMemo<CoachSceneProps>(() => {
    const cards = cardsFor(w.coach.activeRuleset)
      .map((c) => ({ id: c.id, title: c.title, status: c.status }))
      .sort((a, b) => WALL_ORDER.indexOf(a.status) - WALL_ORDER.indexOf(b.status));
    return {
      name: member?.name ?? "this member",
      cards,
      cited: latest?.cards ?? [],
      safety: latest?.safety ?? null,
      topic: latest ? INTENT_LABEL[latest.intent] : null,
      answerKey: latest?.id ?? null,
    };
  }, [w.coach.activeRuleset, member, latest]);
  // The cards show only a colour, a mark and a few words; the legend says what each colour means.
  const legend = useMemo<LegendItem[]>(() => {
    const count = (status: CardStatus) => scene.cards.filter((c) => c.status === status).length;
    const apps = COUNTABLE_SOURCES.filter((s) => member?.consents.coach[s]).length;
    const rows: LegendItem[] = [
      { label: "From health guidelines — ready now", value: count("public-guideline"), color: STATUS_COLOR["public-guideline"] },
      { label: "Waiting for Kayla's OK — once, before May 1", value: count("proposed-lesson"), color: STATUS_COLOR["proposed-lesson"] },
      { label: "Waiting for a coach's OK", value: count("proposed-rule"), color: STATUS_COLOR["proposed-rule"] },
      { label: "Help lines", value: count("resource"), color: STATUS_COLOR.resource },
      { label: `Used in ${scene.name}'s latest answer`, value: scene.cited.length },
      { label: "Health apps it can read — only with a yes", value: `${apps} of ${COUNTABLE_SOURCES.length}` },
    ];
    // A kind with no card in this rule set gets no row, and "Used in" waits for a first answer.
    return rows.filter((r) => r.value !== 0);
  }, [scene, member]);

  const ask = (id: string) => member && store.dispatch({ type: "ASK_COACH", payload: { memberId: member.id, question: question(id) } }, actors.member(member.id), { via: "coach" });
  const answersFor = (wd: typeof w, intent: string[]) => Object.values(wd.coach.answers).some((a) => a.memberId === viewer && intent.includes(a.intent));

  const steps: Step[] = [
    {
      id: "missed",
      label: "Ask about a missed week",
      hint: "Tap “I missed 12 days…” on the phone.",
      why: "A kind, short answer — not a lecture, not a plan.",
      done: (wd) => answersFor(wd, ["restart"]),
    },
    {
      id: "who",
      label: "Tap “Who says?” on the answer",
      hint: "Under the coach's answer.",
      why: "Every answer comes only from tips someone stands behind. Nothing of Kayla's shows until she says yes to it, once, before May 1.",
      done: (_wd, marked) => marked.has("who-says"),
    },
    {
      id: "save",
      label: "Save the small step",
      hint: "The orange button under the answer.",
      why: "Nothing happens unless the member taps it. Now it waits on their Today screen.",
      done: (wd) => Boolean(wd.members[viewer]?.savedStep),
    },
    {
      id: "pain",
      label: "Ask about knee pain",
      hint: "Tap “Knee pain”.",
      why: "Safe Stop: for pain, the coach stops and points to a real person. It never guesses.",
      done: (wd) => Object.values(wd.coach.answers).some((a) => a.memberId === viewer && isSafeStop(a)),
    },
  ];

  const ideas: Idea[] = [
    { title: "Who says?", line: "Every answer says where it comes from, in plain words. Your lessons show only after you OK them, once, before May 1.", state: "live", origin: "new", image: ASK_PICTURE, show: () => ask("restart") },
    { title: "One small step", line: "Every answer ends with one small step, like “rest day — it counts.” Nothing happens until the member taps Save.", state: "live", origin: "new", show: () => ask("rest") },
    { title: "Safe Stop", line: "Mention chest pain, dizziness or sharp pain and the coach says stop and get real help. It never guesses, and the AI is never asked.", state: "live", origin: "new", show: () => ask("pain") },
    { title: "Race-ready handoff", line: "When a member wants a race plan, the coach doesn't write one — it points to a real training plan. You already work with Runna, so that conversation starts with you.", state: "next", origin: "yours" },
    { title: "Kinder timing", line: "Before suggesting a time to go, the coach checks your city's heat and air quality and says when it's kinder to move — or that rest counts today.", state: "next", origin: "new" },
    { title: "First 10 Miles", line: "A gentle start for brand-new movers: three short walks a week, none much longer than your longest recent one. Training plans stay with real coaches.", state: "next", origin: "new" },
    { title: "Pep Talk", line: "You already record audio sessions. On a hard day, the coach could play a two-minute one of yours — only the ones you pick.", state: "next", origin: "yours" },
    { title: "Ask a Person", line: "Your 2024 hub let members ask coach questions. When the coach has no tip, it says “I don't know” and passes the question to the team. City Leads can opt in.", state: "next", origin: "yours" },
  ];

  const people = Object.values(w.members).filter((m) => !m.background);

  return (
    <>
      <Hero
        mode="day"
        eyebrow="Quantum Health Coach"
        title="An AI coach that *knows your summer.*"
        lede="Ask it anything about moving this summer. It reads only what you share, answers in plain, kind words from tips Kayla says yes to — and stops for pain or crisis, every time."
        actions={
          <Story
            title="Why an *AI coach* matters"
            stat={{ value: "2 in 3", line: "adults aren't sure AI health advice is accurate. Here, every answer shows who says so — and every word is checked first." }}
            beats={[
              { text: "New movers have small questions they're shy to ask. “Is walking enough?” “I missed two weeks — am I out?”" },
              { text: "The AI gives them *a kind, personal answer* at 10 p.m., when nobody else is up — it knows their summer, because they chose to share it." },
              { text: "The facts come only from tips you OK first. The AI writes the kind part; it never adds a fact, a plan or a diagnosis." },
              { text: "If it's about pain or a crisis, the AI is never asked. The coach stops and points to *a real person.*" },
              { text: "And it never pushes. Feeling good on a walk is what brings people back, so it leans on *enjoy it*, not *go further.*" },
            ]}
            close="Try it on the phone below."
          />
        }
        stage={<Stage name="coach" scene={CoachScene} props={scene} fallback={<div className="absolute inset-0" style={{ background: "radial-gradient(55% 50% at 68% 38%, #3a1d0c, transparent)" }} />} />}
        legendTitle="In the picture"
        legend={legend}
      />

      <DataStrip
        className="mt-6 sm:mt-10"
        points={[
          { value: "1 in 3", line: "U.S. adults asked an AI chatbot for health advice in the past year." },
          { value: "#1", line: "reason people keep moving, across 66 studies: they enjoy it. So every answer starts kind." },
          { value: "+23%", line: "more moving during app competitions — but whoever came last ended up moving less than before." },
        ]}
      />

      <TryIt
        index="01"
        title="Ask it a *real question.*"
        intro="Tap a question on the phone. Every answer says whether the AI wrote it, shows where its facts come from — and knows when to stop."
        steps={steps}
        example="The coach answered a question about coming back after a gap."
        phone={
          <Phone label="Coach app" height={800}>
            <CoachPhone viewer={viewer} chipSteps={CHIP_STEPS} />
          </Phone>
        }
        finale={<>That&apos;s the Quantum Health Coach: <strong>kind, personal answers from tips Kayla says yes to — every word checked, and a hard stop to real help when it matters.</strong></>}
        aside={
          <div>
            <div className="eyebrow">Asking as</div>
            <div role="radiogroup" aria-label="Asking as" className="mt-2 flex flex-wrap gap-1.5">
              {people.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={m.id === viewer}
                  onClick={() => store.setUI({ viewer: m.id })}
                  className={cn("tap rounded-full border px-3.5 text-[14px] font-semibold", m.id === viewer ? "border-transparent bg-ink text-bg" : "border-line-strong hover:border-accent")}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <HowItThinks index="02" latest={latest} />

      <FirstIdea index="03" />

      <SafetyProof index="04" ruleset={w.coach.activeRuleset} />

      <Ideas index="05" title="Answers that *know when to stop.*" intro="The first three work on the phone above. The rest come next, and three build on things you already do." ideas={ideas} />

      <HowWeBuild
        index="06"
        lines={[
          { what: "Tips in one table", how: "coach_cards holds each tip's topic, words, source, who approved it and when. Kayla gets a short list of tips to say yes or no to, once, before May 1. Only approved tips ever show.", effort: "S" },
          { what: "The AI step", how: "One Supabase Edge Function calls Claude with the question, what the member chose to share, and the approved tips. It returns kind lines and tip ids only, as JSON — never a fact of its own.", effort: "M" },
          { what: "Rules around the AI", how: "The same rules run first: pain, crisis, food and other people's data never reach the model. Every draft runs the checks; a failing draft is never shown, and the tips answer alone.", effort: "M" },
          { what: "Guided questions first", how: "A FlutterFlow page with topic chips. Typing your own question opens only when every safety-critical test passes.", effort: "S" },
          { what: "Safety words first", how: "A fixed word list (chest pain, dizzy, hopeless…) shows help lines such as 988 and gives no fitness advice — before any AI is involved.", effort: "S" },
        ]}
        note="Kayla says yes or no to her tips once, before May 1. Until then, the coach marks them as drafts and leans on public health guidance. The AI key lives in Supabase secrets, never in the app."
      />

      {lab ? (
        <section id="coach-lab" className="mx-auto w-full max-w-[1320px] px-4 pb-24 sm:px-6 lg:px-8" aria-label="Coach Lab">
          <CoachLab />
        </section>
      ) : null}
    </>
  );
}
