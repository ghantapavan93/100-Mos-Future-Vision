"use client";

// The browser's side of the AI coach. Before a question goes to the engine,
// ask the server for the AI's proposal — only for everyday topics, only when
// the AI is switched on, and never for longer than a phone user would wait.
// Whatever comes back (or doesn't), the engine decides what is sent.

import { useSyncExternalStore } from "react";
import { aiMayWrite, coachContext } from "@/domain/quantum/answer";
import { classify } from "@/domain/quantum/classify";
import type { AiDraft } from "@/domain/quantum/types";
import type { World } from "@/domain/types";

export type AiStatus = "checking" | "on" | "off";

interface State {
  status: AiStatus;
  /** Members whose question is with the AI right now. */
  pending: ReadonlySet<string>;
}

let state: State = { status: "checking", pending: new Set() };
const listeners = new Set<() => void>();
const set = (next: Partial<State>) => {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
};

let probe: Promise<void> | null = null;
/** Asks the server once per visit whether the AI is on. A static host with no server simply means "off". */
function probeOnce(): Promise<void> {
  probe ??= fetch("/api/coach", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : { ai: false }))
    .then((j: { ai?: boolean }) => set({ status: j.ai ? "on" : "off" }))
    .catch(() => set({ status: "off" }));
  return probe;
}

const WAIT_MS = 15_000;

/**
 * The AI's proposal for this question, or undefined when the rules answer alone:
 * a topic the AI never writes for, the AI switched off, slow, or unavailable.
 */
export async function aiProposal(world: World, memberId: string, question: string): Promise<AiDraft | undefined> {
  const member = world.members[memberId];
  if (!member || state.pending.has(memberId)) return undefined;
  if (!aiMayWrite(classify(question, world.coach.activeRuleset))) return undefined;
  await probeOnce();
  if (state.status !== "on") return undefined;

  set({ pending: new Set(state.pending).add(memberId) });
  try {
    const res = await fetch("/api/coach", {
      method: "POST",
      headers: { "content-type": "application/json" },
      // Only what the member chose to share with the coach: their first name and their consented summary.
      body: JSON.stringify({ question, ruleset: world.coach.activeRuleset, name: member.name, summary: coachContext(world, member).summary }),
      signal: AbortSignal.timeout(WAIT_MS),
    });
    if (res.status === 503) set({ status: "off" });
    if (!res.ok) return undefined;
    const j = (await res.json()) as { ai?: AiDraft };
    return j.ai;
  } catch {
    return undefined;
  } finally {
    const pending = new Set(state.pending);
    pending.delete(memberId);
    set({ pending });
  }
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  void probeOnce();
  return () => listeners.delete(l);
};
const SERVER: State = { status: "checking", pending: new Set() };

/** Whether the AI is on, and whether this member's question is with it right now. */
export function useCoachAi(memberId?: string): { status: AiStatus; thinking: boolean } {
  const s = useSyncExternalStore(subscribe, () => state, () => SERVER);
  return { status: s.status, thinking: memberId ? s.pending.has(memberId) : s.pending.size > 0 };
}
