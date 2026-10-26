"use client";

// The commission's own world. Same engine, same seed and same rules as every
// other screen, on its own command log: playing a six-week program here moves
// this world's clock and adds its walkers, and never the member app's. Like
// the main store, the world is a fold of the log, and the log survives a reload
// in this tab.

import { useSyncExternalStore } from "react";
import type { CommandInput } from "@/domain/commands";
import { execute, initialMachine, replay, type LogEntry, type Machine, type Receipt } from "@/domain/engine";
import type { Actor, World } from "@/domain/types";

interface State {
  log: LogEntry[];
  machine: Machine;
}

const STORAGE_KEY = "fl4.commission.v1";
const META = { via: "commission" } as const;

let state: State = { log: [], machine: initialMachine() };
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function persist() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state.log));
  } catch {
    // Storage can be unavailable (private mode, previews). The walkthrough still works in memory.
  }
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const log = raw ? (JSON.parse(raw) as LogEntry[]) : [];
    if (Array.isArray(log) && log.length) state = { log, machine: replay(log) };
  } catch {
    // A corrupt or old log is discarded; the seed world is a safe start.
  }
}

function subscribe(listener: () => void) {
  hydrate();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const commissionStore = {
  get: () => state,

  send(input: CommandInput, actor: Actor): Receipt {
    hydrate();
    const { machine, receipt } = execute(state.machine, input, actor, META);
    state = { log: [...state.log, { input, actor, meta: META }], machine };
    persist();
    emit();
    return receipt;
  },

  /** What a command would do, without doing it: the decision buttons preview their effect with this. */
  preview(input: CommandInput, actor: Actor): { world: World; receipt: Receipt } {
    hydrate();
    const { machine, receipt } = execute(state.machine, input, actor, META);
    return { world: machine.world, receipt };
  },

  /** Take on a run of commands already executed from the current machine (a played week). */
  absorb(run: { machine: Machine; entries: LogEntry[] }) {
    if (!run.entries.length) return;
    state = { log: [...state.log, ...run.entries], machine: run.machine };
    persist();
    emit();
  },

  reset() {
    state = { log: [], machine: initialMachine() };
    persist();
    emit();
  },

  /** Replays the log from the seed: the same commands must give the same chain head. */
  verify(): { head: string; replayed: string } {
    return { head: state.machine.ledger.at(-1)?.hash ?? "00000000", replayed: replay(state.log).ledger.at(-1)?.hash ?? "00000000" };
  },
};

const serverState: State = { log: [], machine: initialMachine() };

export function useCommissionStore<T>(select: (s: State) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => select(state),
    () => select(serverState),
  );
}

export const useCommissionWorld = (): World => useCommissionStore((s) => s.machine.world);
export const useCommissionLedger = (): Receipt[] => useCommissionStore((s) => s.machine.ledger);
