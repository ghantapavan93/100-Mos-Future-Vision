// The AI's place in the coach: it may write a few kind lines and choose
// approved tips by id, for everyday topics only. Every failure class below has
// a control case that must still go through, so the checks stay general.

import { describe, expect, it } from "vitest";
import type { CommandInput } from "../commands";
import { execute, initialMachine, replay, type LogEntry } from "../engine";
import { shredErased } from "../erasure";
import { seedWorld } from "../fixtures";
import type { Actor } from "../types";
import { AI_TOPICS, aiCardPool, aiMayWrite, answer } from "./answer";
import { classify } from "./classify";
import { CARD } from "./knowledge";
import type { AiDraft } from "./types";

const RESTART = "I missed 12 days and I feel like I ruined everything.";
const PAIN = "My knee hurts every time I walk downhill.";
const maya: Actor = { role: "member", id: "maya" };
const MODEL = "claude-opus-5-5";

const draft = (over: Partial<AiDraft> = {}): AiDraft => ({
  heard: ["Twelve days off doesn't undo a single mile you've already walked, Maya."],
  cards: ["lesson-grace", "pag-gradual"],
  model: MODEL,
  ...over,
});

const ask = (question: string, ai?: AiDraft) => answer(seedWorld(), "maya", question, "v1", false, "q1", ai);

describe("the AI's draft", () => {
  it("is sent for an everyday topic when every check passes: its words first, the tips verbatim, the rules' own step", () => {
    const a = ask(RESTART, draft());
    const composer = ask(RESTART);
    expect(a.generator).toBe("ai-model");
    expect(a.model).toBe(MODEL);
    expect(a.blocks[0]).toEqual({ kind: "heard", text: draft().heard[0] });
    for (const b of a.blocks.filter((x) => x.kind === "know")) expect(b.text).toBe(CARD[b.cardId!]!.body);
    expect(a.nextStep).toEqual(composer.nextStep);
    expect(a.checks.every((c) => c.pass)).toBe(true);
    expect(a.checks.map((c) => c.id)).toEqual(expect.arrayContaining(["ai-own-words", "ai-no-new-facts", "ai-tips-only"]));
  });

  it("is never used for pain, crisis or anything not everyday — the rules answer alone", () => {
    for (const q of [PAIN, "I keep thinking about ending my life", "Should I skip dinner to lose weight?", "How far did Sarah walk this week?"]) {
      const a = ask(q, draft());
      expect(a.generator, q).toBe("deterministic-composer");
      expect(a.blocks.some((b) => b.text === draft().heard[0]), q).toBe(false);
      expect(a.checks.find((c) => c.id === "ai-scope")?.pass, q).toBe(true);
    }
  });

  it("is refused when it makes a health claim or uses a number the member never shared (control: echoing their own words passes)", () => {
    const claim = ask(RESTART, draft({ heard: ["Walking lowers your blood pressure, so get back out there."] }));
    expect(claim.generator).toBe("deterministic-composer");
    expect(claim.rejectedDraft?.failed).toContain("ai-no-new-facts");
    const number = ask(RESTART, draft({ heard: ["Most people need about 66 days to build a habit."] }));
    expect(number.rejectedDraft?.failed).toContain("ai-no-new-facts");
    const echo = ask(RESTART, draft({ heard: ["12 days is a pause, not an ending."] }));
    expect(echo.generator).toBe("ai-model");
  });

  it("is refused when it prescribes distance, diagnoses, or speaks for Kayla", () => {
    for (const line of ["Walk five miles tomorrow to catch up.", "That sounds like it could be depression.", "Kayla says you should never take a day off."]) {
      const a = ask(RESTART, draft({ heard: [line] }));
      expect(a.generator, line).toBe("deterministic-composer");
      expect(a.rejectedDraft, line).not.toBeNull();
      expect(a.blocks.some((b) => b.text === line), line).toBe(false);
    }
  });

  it("may only lean on approved tips — never a help line, an unknown tip, or a repeat", () => {
    expect(ask(RESTART, draft({ cards: ["lifeline"] })).rejectedDraft?.failed).toContain("ai-tips-only");
    expect(ask(RESTART, draft({ cards: ["made-up-tip"] })).rejectedDraft?.failed).toContain("ai-tips-only");
    expect(ask(RESTART, draft({ cards: ["lesson-grace", "lesson-grace"] })).rejectedDraft?.failed).toContain("ai-tips-only");
    expect(aiCardPool("v1").some((c) => c.status === "resource")).toBe(false);
  });

  it("keeps every boundary the rules wrote, even when the AI leaves it out", () => {
    const q = "Can I run a marathon next month if I start now?";
    const c = classify(q, "v1");
    if (!aiMayWrite(c)) return; // only meaningful while bigger-race questions are everyday topics
    const a = ask(q, draft({ heard: ["A big goal is worth taking one step at a time."], cards: ["rule-race-ladder"] }));
    expect(a.blocks.some((b) => b.kind === "boundary")).toBe(true);
  });

  it("covers only everyday topics", () => {
    expect([...AI_TOPICS].sort()).toEqual(["community", "first-5k", "heat", "race-big", "rest", "restart", "start"]);
  });
});

describe("the AI's draft in the engine", () => {
  const entry = (ai?: AiDraft): LogEntry => ({ input: { type: "ASK_COACH", payload: { memberId: "maya", question: RESTART, ...(ai ? { ai } : {}) } } as CommandInput, actor: maya });

  it("records an AI answer, replays to the same answer, and keeps the AI's words out of the audit trail", () => {
    const r = execute(initialMachine(), entry(draft()).input, maya);
    expect(r.receipt.outcome).toBe("applied");
    const a = Object.values(r.machine.world.coach.answers)[0]!;
    expect(a.generator).toBe("ai-model");
    expect(JSON.stringify(r.receipt)).not.toContain(draft().heard[0]);
    expect(replay([entry(draft())]).world.coach.answers).toEqual(r.machine.world.coach.answers);
  });

  it("refuses a malformed proposal at the door", () => {
    const r = execute(initialMachine(), entry({ heard: [], cards: [], model: MODEL }).input, maya);
    expect(r.receipt.outcome).toBe("rejected");
  });

  it("forgets the AI's words with the question", () => {
    const log: LogEntry[] = [entry(draft()), { input: { type: "FORGET_COACH_HISTORY", payload: { memberId: "maya" } }, actor: maya }];
    const m = replay(log);
    const shredded = shredErased(log, m.ledger, m.world);
    expect(JSON.stringify(shredded)).not.toContain(draft().heard[0]);
  });
});
