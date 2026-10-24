"use client";

// The one client-side store. It holds the command log and the machine the log
// folds to, plus a little UI state (who you're viewing as, inspect mode,
// presenter state). Every lens reads from here, so moving between lenses never
// loses or forks the simulation. The engine runs synchronously inside
// `dispatch`, so a refused command is refused before anything renders.

import { useSyncExternalStore } from "react";
import type { CommandInput } from "@/domain/commands";
import { execute, initialMachine, replay, type LogEntry, type Machine, type Meta, type Receipt } from "@/domain/engine";
import { shredErased } from "@/domain/erasure";
import type { Actor, MemberId, World } from "@/domain/types";

export interface UIState {
  /** The persona whose phone the member app shows. */
  viewer: MemberId;
  /** Inspect mode outlines every explainable surface. */
  inspect: boolean;
  /** The feature open in the inspect drawer. */
  explain: string | null;
  /** Presenter step, or null when exploring freely. */
  present: number | null;
  /** Receipt shown in the toast; cleared after a few seconds. */
  toast: Receipt | null;
  /** Global "pause motion" control, on top of the OS reduced-motion setting. */
  motionPaused: boolean;
}

interface State {
  log: LogEntry[];
  machine: Machine;
  ui: UIState;
}

const STORAGE_KEY = "fl4.log.v1";

const initialUI: UIState = { viewer: "maya", inspect: false, explain: null, present: null, toast: null, motionPaused: false };

let state: State = { log: [], machine: initialMachine(), ui: initialUI };
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function persist() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ log: state.log, viewer: state.ui.viewer, present: state.ui.present }));
  } catch {
    // Storage can be unavailable (private mode, previews). The demo still works in memory.
  }
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as { log?: LogEntry[]; viewer?: string; present?: number | null };
    const present = typeof saved.present === "number" ? saved.present : null;
    if (Array.isArray(saved.log) && saved.log.length) {
      const machine = replay(saved.log);
      state = { log: shredErased(saved.log, machine.ledger, machine.world), machine, ui: { ...state.ui, viewer: saved.viewer ?? state.ui.viewer, present } };
    } else if (present !== null) state = { ...state, ui: { ...state.ui, present } };
  } catch {
    // A corrupt or old log is discarded; the seed world is a safe start.
  }
}

function subscribe(listener: () => void) {
  hydrate();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const store = {
  get: () => state,

  dispatch(input: CommandInput, actor: Actor, meta: Meta = {}): Receipt {
    hydrate();
    const { machine, receipt } = execute(state.machine, input, actor, meta);
    // Data the world has let go of (deleted Strava records, forgotten coach questions) leaves the log too.
    const log = shredErased([...state.log, { input, actor, meta }], machine.ledger, machine.world);
    state = { ...state, log, machine, ui: { ...state.ui, toast: receipt } };
    persist();
    emit();
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      state = { ...state, ui: { ...state.ui, toast: null } };
      emit();
    }, 5200);
    return receipt;
  },

  /** Back to the seeded world. */
  reset() {
    state = { log: [], machine: initialMachine(), ui: { ...initialUI, viewer: state.ui.viewer, present: state.ui.present } };
    persist();
    emit();
  },

  /** Rebuild from the log (proves state is a fold of the commands). */
  rebuild(): { before: string; after: string } {
    const before = state.machine.ledger.at(-1)?.hash ?? "00000000";
    const machine = replay(state.log);
    state = { ...state, machine };
    emit();
    return { before, after: machine.ledger.at(-1)?.hash ?? "00000000" };
  },

  /** Replace the whole log (session links, presenter scenes). An imported log is shredded on arrival, like any other. */
  load(log: LogEntry[]) {
    const machine = replay(log);
    state = { ...state, log: shredErased(log, machine.ledger, machine.world), machine };
    persist();
    emit();
  },

  setUI(patch: Partial<UIState>) {
    state = { ...state, ui: { ...state.ui, ...patch } };
    if ("viewer" in patch || "present" in patch) persist();
    emit();
  },
};

const serverState: State = { log: [], machine: initialMachine(), ui: initialUI };

export function useStore<T>(select: (s: State) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => select(state),
    () => select(serverState),
  );
}

export const useWorld = (): World => useStore((s) => s.machine.world);
export const useLedger = (): Receipt[] => useStore((s) => s.machine.ledger);
export const useUI = (): UIState => useStore((s) => s.ui);
export const useLog = (): LogEntry[] => useStore((s) => s.log);

/** Actors, so screens say who is acting. */
export const actors = {
  member: (id: string): Actor => ({ role: "member", id }),
  organizer: (id: string): Actor => ({ role: "organizer", id }),
  founder: { role: "founder", id: "kayla" } as Actor,
  engineer: { role: "engineer", id: "kirk" } as Actor,
  system: { role: "system", id: "scheduler" } as Actor,
  partner: (id: string): Actor => ({ role: "partner", id }),
  provider: (id: string): Actor => ({ role: "provider", id }),
};
