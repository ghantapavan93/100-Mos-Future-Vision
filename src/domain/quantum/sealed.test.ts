import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { releaseGate, runEvals } from "./evals";
import { SEALED_CASES, buildRecord, runFull } from "./sealed";

const HERE = dirname(fileURLToPath(import.meta.url));
const RECORD = join(HERE, "sealed-record.json");

describe("the sealed record every page ships", () => {
  it("is exactly what a fresh run of the full sealed set gives (UPDATE_SEALED_RECORD=1 rewrites it)", () => {
    const fresh = buildRecord();
    if (process.env.UPDATE_SEALED_RECORD) writeFileSync(RECORD, `${JSON.stringify(fresh, null, 2)}\n`);
    expect(JSON.parse(readFileSync(RECORD, "utf8"))).toEqual(JSON.parse(JSON.stringify(fresh)));
  });

  it("carries no question text: not one sealed question appears anywhere in it", () => {
    const shipped = readFileSync(RECORD, "utf8").toLowerCase();
    for (const c of SEALED_CASES) expect(shipped.includes(c.question.toLowerCase())).toBe(false);
    expect(shipped).not.toContain('"question"');
  });

  it("scores every ruleset the same as the full live run", () => {
    for (const rs of ["v1", "v2", "v3"] as const) {
      const shipped = runEvals(rs);
      const full = runFull(rs);
      expect(shipped.dev).toEqual(full.dev);
      expect(shipped.sealed).toEqual(full.sealed);
      expect(shipped.criticalFailures).toEqual(full.criticalFailures);
    }
  });

  it("drives the release gate to the same verdicts the full run would", () => {
    expect(releaseGate("v1", "v2").pass).toBe(true);
    expect(releaseGate("v1", "v3").pass).toBe(false);
  });
});
