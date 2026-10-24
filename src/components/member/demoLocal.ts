"use client";

// Small state that never enters the shared record: a member's sealed note, a
// founder's OK on a City Lead in training. It lives in this browser's session,
// like the demo's own log, and is forgotten when the demo starts over — "Start
// over" swaps in a fresh, empty log, so a new empty log means "forget".

import { useEffect, useSyncExternalStore } from "react";
import { useLog } from "@/lib/store";

export interface DemoLocal<T> {
  get: () => T;
  set: (next: T) => void;
  /** Subscribe and follow the demo's resets. */
  use: () => T;
}

export function demoLocal<T>(key: string, initial: T): DemoLocal<T> {
  let value = initial;
  let loaded = false;
  let seenLog: unknown = null;
  const listeners = new Set<() => void>();

  const load = () => {
    if (loaded || typeof window === "undefined") return;
    loaded = true;
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) value = JSON.parse(raw) as T;
    } catch {
      // Unreadable or unavailable storage: start from the initial value.
    }
  };
  const get = () => {
    load();
    return value;
  };
  const set = (next: T) => {
    load();
    value = next;
    try {
      sessionStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Storage can be unavailable (private mode, previews). It still works in memory.
    }
    for (const l of listeners) l();
  };
  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  };

  function use(): T {
    const log = useLog();
    const current = useSyncExternalStore(subscribe, get, () => initial);
    useEffect(() => {
      // A different, empty log is the demo starting over (or a fresh session loaded in).
      if (seenLog !== null && log !== seenLog && log.length === 0) set(initial);
      seenLog = log;
    }, [log]);
    return current;
  }

  return { get, set, use };
}
