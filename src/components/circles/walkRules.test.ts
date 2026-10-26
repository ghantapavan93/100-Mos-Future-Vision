import { describe, expect, it } from "vitest";
import { tick } from "@/domain/calendar";
import { execute, initialMachine, seasonMiles, type Machine } from "@/domain/engine";
import type { CommandInput } from "@/domain/commands";
import type { Actor } from "@/domain/types";
import { beatsTheHeat, changeNote, copilot, fitOf, listWords, rankWalks } from "./walkRules";

const nina: Actor = { role: "organizer", id: "nina" };
const run = (m: Machine, input: CommandInput, actor: Actor) => execute(m, input, actor);


describe("walks that fit you", () => {
  const w = initialMachine().world;
  const saturday = w.events["det-first-mile"]!;
  const sunday = w.events["det-dequindre-long"]!;

  it("says, need by need, what the City Lead checked, what's only listed and what isn't there", () => {
    const fit = fitOf(saturday, ["shade", "seating", "step-free"], ["step-free", "restrooms"]);
    expect(fit.rows).toEqual([
      { need: "shade", state: "listed" },
      { need: "seating", state: "missing" },
      { need: "step-free", state: "checked" },
    ]);
    expect(fit.score).toBe(3);
    expect(fit.has).toBe(2);
  });

  it("puts the best fit first and keeps date order when nothing is picked", () => {
    expect(rankWalks([sunday, saturday], ["step-free"], {}).map((e) => e.id)).toEqual(["det-first-mile", "det-dequindre-long"]);
    expect(rankWalks([sunday, saturday], [], {}).map((e) => e.id)).toEqual(["det-first-mile", "det-dequindre-long"]);
    // A checked need outranks one that's only listed.
    expect(fitOf(sunday, ["shade"], ["shade"]).score).toBeGreaterThan(fitOf(saturday, ["shade"], []).score);
  });

  it("names needs in plain words", () => {
    expect(listWords(["shade", "seating", "restrooms"])).toBe("Shade, benches and restrooms");
    expect(listWords(["shade"])).toBe("Shade");
  });
});

describe("the Lead's co-pilot", () => {
  const w = initialMachine().world;
  const saturday = w.events["det-first-mile"]!;
  const base = { world: w, event: saturday, dropout: null, guests: 1, offered: new Set<string>(), untold: false };

  it("flags what's listed but not checked, and clears once the Lead has walked it", () => {
    const before = copilot({ ...base, confirmed: ["step-free", "restrooms", "short-option"] });
    expect(before.clear).toBe(false);
    expect(before.unchecked).toEqual(["shade"]);
    expect(before.checks.find((c) => c.id === "access")?.ok).toBe(false);
    expect(before.coming).toBe(saturday.rsvps.length + saturday.backgroundRsvps + 1);
    const after = copilot({ ...base, confirmed: saturday.access });
    expect(after.clear).toBe(true);
  });

  it("when the back walker cancels, it flags nobody at the back and offers who could step in, the Lead last", () => {
    const c = copilot({ ...base, confirmed: saturday.access, dropout: "james" });
    expect(c.clear).toBe(false);
    expect(c.checks.find((x) => x.id === "back")).toMatchObject({ ok: false, title: "Nobody at the back" });
    expect(c.backOptions.map((o) => o.memberId)).toEqual(["sarah", "nina"]);
    expect(c.backOptions.at(-1)?.tradeoff).toMatch(/nobody's free to welcome/);
  });

  it("puts a member who offered first, and asks the Lead to tell everyone after a change", () => {
    let m = initialMachine();
    m = run(m, { type: "JOIN_CHAPTER", payload: { memberId: "maya", chapterId: "detroit" } }, { role: "member", id: "maya" }).machine;
    const offered = copilot({ ...base, world: m.world, event: m.world.events["det-first-mile"]!, confirmed: saturday.access, dropout: "james", offered: new Set(["maya"]) });
    expect(offered.backOptions[0]).toMatchObject({ memberId: "maya", tradeoff: "Offered to walk at the back." });
    // The fix is a real command; the co-pilot then wants the change told.
    m = run(m, { type: "ASSIGN_SWEEP", payload: { eventId: "det-first-mile", memberId: "sarah" } }, nina).machine;
    const fixed = copilot({ ...base, world: m.world, event: m.world.events["det-first-mile"]!, confirmed: saturday.access, dropout: "james", untold: true });
    expect(fixed.checks.find((x) => x.id === "back")?.ok).toBe(true);
    expect(fixed.clear).toBe(false);
    expect(fixed.checks.at(-1)).toMatchObject({ id: "told", ok: false });
    expect(changeNote(m.world.events["det-first-mile"]!, "Sarah")).toBe("Quick change: Sarah will walk at the back. Same time, same place — 8:00 AM at Detroit Riverwalk, Rivard Plaza. See you there!");
  });

  it("knows a midday start on a hot day is in the heat", () => {
    expect(beatsTheHeat(saturday)).toBe(true);
    expect(beatsTheHeat({ ...saturday, day: 16, startMinute: 12 * 60 })).toBe(false);
  });
});

describe("the no-app doorway", () => {
  it("a guest's walk counts once they join: the same check-in as everyone, counted once", () => {
    let m = initialMachine();
    const before = new Set(Object.keys(m.world.members));
    m = run(m, { type: "JOIN_MOVEMENT", payload: { name: "Tasha", moves: ["walk"], goalLabel: "100 miles this summer", goalKind: "season-100", target: 100, chapterId: "detroit", needs: [] } }, { role: "member", id: "guest" }).machine;
    const tasha = Object.keys(m.world.members).find((id) => !before.has(id))!;
    expect(m.world.chapters.detroit!.members).toContain(tasha);
    m = run(m, { type: "ADVANCE_CLOCK", payload: { to: tick(14, 8 * 60) } }, { role: "system", id: "clock" }).machine;
    const first = run(m, { type: "CHECK_IN", payload: { eventId: "det-first-mile", memberId: tasha, distanceMi: 1 } }, nina);
    expect(first.receipt.outcome).toBe("applied");
    m = first.machine;
    expect(seasonMiles(m.world, tasha)).toBe(1);
    expect(m.world.members[tasha]!.stamps.some((s) => s.kind === "first-event")).toBe(true);
    const again = run(m, { type: "CHECK_IN", payload: { eventId: "det-first-mile", memberId: tasha, distanceMi: 1 } }, nina);
    expect(again.receipt.outcome).toBe("noop");
    expect(seasonMiles(again.machine.world, tasha)).toBe(1);
  });
});

