import { describe, expect, it } from "vitest";
import { seedWorld } from "../fixtures";
import { answer } from "./answer";

const ask = (question: string) => {
  const w = seedWorld();
  return answer(w, "maya", question, w.coach.activeRuleset, false, "a1");
};
const cited = (a: ReturnType<typeof ask>) => a.blocks.map((b) => b.cardId).filter(Boolean);

describe("kind before clinical", () => {
  it("a plain sore day gets rest, not a list of emergencies", () => {
    const a = ask("I'm sore today. Should I rest or push through?");
    expect(a.intent).toBe("rest");
    expect(cited(a)).toContain("lesson-rest");
    expect(cited(a)).not.toContain("screen-symptoms");
  });

  it("naming a warning sign still goes straight to stop-and-get-care", () => {
    const a = ask("I got dizzy and my chest felt tight on my walk.");
    expect(a.safety).toBe("urgent");
    expect(a.nextStep).toBeNull();
  });

  it("coming back after days off opens kindly", () => {
    const a = ask("I missed 12 days and I feel like I ruined everything.");
    expect(a.blocks[0]?.text).toBe("Days off don't erase a single mile.");
  });
});
