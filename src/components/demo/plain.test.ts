import { describe, expect, it } from "vitest";
import { plain } from "./plain";

describe("plain words", () => {
  it("drops rule ids and names providers the way people know them", () => {
    expect(plain("Strava data stays private (STRAVA-03).")).toBe("Strava data stays private.");
    expect(plain("healthkit sent an implausible record: 40 mi in 60 min.")).toBe("Apple Health sent a walk that doesn't add up: 40 mi in 60 min.");
  });
  it("says deal and giving steps in words", () => {
    expect(plain("Northline Outfitters: qualified → proposal.")).toBe("Northline Outfitters: now proposal sent.");
    expect(plain("“First-Mile Neighborhood Walks”: funded → delivered.")).toBe("“First-Mile Neighborhood Walks”: now delivered.");
    expect(plain("fee → 9000. Contribution after impact $1,125 → $2,000.")).toBe("Price set to $9,000. What's left after giving: $1,125 → $2,000.");
    expect(plain("impactPct → 15. Contribution after impact −$300 → −$120.")).toBe("Giving share set to 15%. What's left after giving: −$300 → −$120.");
    expect(plain("Partners get counts, never people. A member list would be an unauthorised disclosure.")).toBe("Partners get counts, never people. A list of members is never shared.");
  });
  it("says what the coach and the walks did", () => {
    expect(plain("QUANTUM answered (restart).")).toBe("The coach answered a question about coming back after a gap.");
    expect(plain("“Saturday First Mile” completed: 2 checked in by name, 0 modelled.")).toBe("“Saturday First Mile” is done: 2 people checked in.");
    expect(plain("Evidence shows 2 people checked in by name; verification needs 10. Modelled crowds don't count.")).toBe("Evidence shows 2 people checked in; it's done once ten people walk it.");
  });
  it("says a repeat walk was counted once", () => {
    expect(plain("Duplicate outing recorded once. Miles unchanged.")).toBe("Same walk from another app: counted once. Miles unchanged.");
    expect(plain("The same Apple Health record arrived again. Ignored; miles unchanged.")).toBe("That Apple Health walk was already counted. Miles unchanged.");
    expect(plain("Duplicate or stale Strava delivery ignored.")).toBe("That Strava run was already here. Miles unchanged.");
  });
});
