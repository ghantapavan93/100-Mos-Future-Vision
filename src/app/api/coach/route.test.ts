// The route's gates, checked without a network: what it refuses before any
// model call is ever made.

import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const post = (body: unknown) => POST(new Request("http://local/api/coach", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));

afterEach(() => vi.unstubAllEnvs());

describe("the coach's AI route", () => {
  it("says the AI is off, and answers nothing, without a key", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(await (await GET()).json()).toEqual({ ai: false, model: null });
    expect((await post({ question: "I missed 12 days.", ruleset: "v1", name: "Maya", summary: null })).status).toBe(503);
  });

  it("never sends pain, crisis or food questions to the model, even with a key", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key-never-used");
    for (const question of ["My knee hurts every time I walk downhill.", "I keep thinking about ending my life", "Should I skip dinner to lose weight?"]) {
      const res = await post({ question, ruleset: "v1", name: "Maya", summary: null });
      expect(res.status, question).toBe(422);
      expect((await res.json()).error, question).toBe("rules-only");
    }
  });

  it("refuses a malformed request at the door", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key-never-used");
    expect((await post({ question: "", ruleset: "v9", name: "Maya", summary: null })).status).toBe(400);
  });
});
