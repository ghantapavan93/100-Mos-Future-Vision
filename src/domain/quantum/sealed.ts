// The sealed evaluation set in full: 90 cases written from the specification
// alone, before any rule (heldout.sealed.json, SHA-256 pinned). Its words are
// for the tests and the Coach Lab only, which loads on demand. Every other page
// reads sealed-record.json through quantum/evals.ts: each case's outline and
// how every ruleset did on it, never what it asks. The test beside this file
// fails if the record drifts from a fresh run of the full set.

import { seedWorld } from "../fixtures";
import type { RulesetVersion, World } from "../types";
import sealedRows from "./heldout.sealed.json";
import { DEV_CASES, SEALED_SHA256, assemble, evaluate, fellBackSafely, type EvalCase, type EvalRun, type SealedRecord, type Step } from "./evals";
import type { Intent, Safety } from "./types";

interface SealedRow {
  id: string;
  critical: boolean;
  member: string;
  question: string;
  expect: { intent?: Intent; safety?: Safety; step?: Step };
  note?: string;
}

const sameWords = (q: string) => q.trim().toLowerCase().replace(/\s+/g, " ");
const DEV_WORDS = new Set(DEV_CASES.map((c) => sameWords(c.question)));

export const SEALED_CASES: EvalCase[] = (sealedRows as SealedRow[]).map((r) => ({
  id: r.id,
  set: "sealed" as const,
  critical: r.critical,
  member: r.member,
  question: r.question,
  expect: { ...(r.expect.intent ? { intent: r.expect.intent } : {}), ...(r.expect.safety ? { safety: r.expect.safety } : {}), ...(r.expect.step ? { step: r.expect.step } : {}) },
  origin: "sealed",
  ...(DEV_WORDS.has(sameWords(r.question)) ? { overlapsDev: true } : {}),
}));

const RULESETS: RulesetVersion[] = ["v1", "v2", "v3"];

/** Every case, DEV and sealed, answered live: the Coach Lab's view, and the tests'. */
export function runFull(ruleset: RulesetVersion, drift = false, world: World = seedWorld()): EvalRun {
  const results = [...DEV_CASES, ...SEALED_CASES].map((c) => evaluate(c, ruleset, drift, world));
  return assemble(
    ruleset,
    results,
    results.map((r) => ({ case: r.case, pass: r.pass, fellBack: fellBackSafely(r.answer) })),
  );
}

/** The record the app ships: outlines and outcomes per ruleset, for the seed world without drift. */
export function buildRecord(): SealedRecord {
  const world = seedWorld();
  const outcomes = Object.fromEntries(
    RULESETS.map((rs) => [
      rs,
      Object.fromEntries(
        SEALED_CASES.map((c) => {
          const r = evaluate(c, rs, false, world);
          return [c.id, { pass: r.pass, fellBack: fellBackSafely(r.answer) }];
        }),
      ),
    ]),
  ) as SealedRecord["outcomes"];
  return {
    sha256: SEALED_SHA256,
    cases: SEALED_CASES.map((c) => ({ id: c.id, critical: c.critical, ...(c.overlapsDev ? { overlapsDev: true as const } : {}), expect: c.expect as SealedRecord["cases"][number]["expect"] })),
    outcomes,
  };
}
