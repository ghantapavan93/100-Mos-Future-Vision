import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { execute, initialMachine, seasonMiles, type LogEntry, type Machine, type Receipt } from "./engine";
import { FAULT, FAULTS, INGEST_FAULTS, verdict, type Fault } from "./faults";
import { verifyProjections } from "./projections";

function inject(m: Machine, fault: Fault, nonce: number): { machine: Machine; receipts: Receipt[]; kept: boolean; evidence: string } {
  const before = m.world;
  const receipts: Receipt[] = [];
  let machine = m;
  const entries = fault.build(m.world, nonce);
  for (const e of entries) {
    const r = execute(machine, e.input, e.actor, e.meta);
    machine = r.machine;
    receipts.push(r.receipt);
  }
  return { machine, receipts, ...verdict(fault, before, machine.world, receipts, entries) };
}

function apply(m: Machine, entries: LogEntry[]): Machine {
  return entries.reduce((acc, e) => execute(acc, e.input, e.actor, e.meta).machine, m);
}

const MEMBERS = ["maya", "james", "sarah", "nina"];
const totals = (m: Machine) => MEMBERS.map((id) => seasonMiles(m.world, id));

describe("fault lab", () => {
  it.each(FAULTS.map((f) => [f.id, f] as const))("keeps its promise on the seed world: %s", (_id, fault) => {
    const result = inject(initialMachine(), fault, 0);
    expect(result.receipts.length, "the fault must send commands").toBeGreaterThan(0);
    expect(result.kept, result.evidence).toBe(true);
    for (const r of result.receipts) expect(r.meta.fault).toBe(fault.id);
  });

  it("keeps every promise when the faults run one after another in one session", () => {
    let m = initialMachine();
    for (const fault of FAULTS) {
      const result = inject(m, fault, m.ledger.length);
      expect(result.kept, `${fault.id}: ${result.evidence}`).toBe(true);
      m = result.machine;
    }
  });

  it("detects a corrupted total, and a rebuild repairs it", () => {
    const { machine } = inject(initialMachine(), FAULT["corrupt-total"]!, 0);
    expect(verifyProjections(machine.world)).toHaveLength(1);
    const fixed = execute(machine, { type: "REBUILD_PROJECTIONS", payload: {} }, { role: "engineer", id: "kirk" }).machine;
    expect(verifyProjections(fixed.world)).toHaveLength(0);
  });

  it("the review faults refuse what they should and still let the real thing through", () => {
    const seed = initialMachine();
    const spoof = inject(seed, FAULT["provider-spoof"]!, 0);
    expect(spoof.receipts.map((r) => r.outcome)).toEqual(["rejected", "applied"]);
    const staff = inject(seed, FAULT["staff-as-member"]!, 0);
    expect(staff.receipts.every((r) => r.outcome === "rejected")).toBe(true);
    const erase = inject(seed, FAULT["erasure-chain"]!, 0);
    expect(erase.kept, erase.evidence).toBe(true);
    expect(erase.evidence).toMatch(/identical/);
  });

  it("injecting the same fault twice makes fresh records instead of replaying old ids", () => {
    const first = inject(initialMachine(), FAULT["duplicate-delivery"]!, 0);
    const second = inject(first.machine, FAULT["duplicate-delivery"]!, first.machine.ledger.length);
    expect(second.kept, second.evidence).toBe(true);
  });

  it("ingest faults in any order and multiplicity give the same totals as one clean pass", () => {
    const seed = initialMachine();
    // Each fault's commands are fixed by its nonce, so a repeat is a true duplicate of the input.
    const streams = INGEST_FAULTS.map((f, i) => f.build(seed.world, i + 1));
    const clean = totals(streams.reduce(apply, seed));
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: streams.length - 1 }), { minLength: 0, maxLength: 12 }), fc.boolean(), (extra, reverse) => {
        const order = streams.map((_, i) => i);
        if (reverse) order.reverse();
        const m = [...order, ...extra].reduce((acc, i) => apply(acc, streams[i]!), seed);
        expect(totals(m)).toEqual(clean);
        expect(verifyProjections(m.world)).toHaveLength(0);
      }),
      { numRuns: 40 },
    );
  });
});
