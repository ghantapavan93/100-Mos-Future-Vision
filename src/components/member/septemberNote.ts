"use client";

// A note to your September self: one line a member writes when they start —
// why they're starting — sealed until September 1, when it opens beside their
// summer story. It is the member's alone: it never enters the shared record,
// so no circle, sponsor, coach or staff screen can read it, and it is shared
// only if the member chooses to on September 1.
//
// In their app it would be stored encrypted for that member only. Here it lives
// in this browser's session and is forgotten when the demo starts over.

import { SEASON } from "@/domain/calendar";
import { demoLocal } from "./demoLocal";

export interface SeptemberNote {
  text: string;
  /** The season day it was sealed (0 is May 1). */
  sealedDay: number;
  /** Shared with their circle, by their choice, once it has opened. */
  shared: boolean;
}

/** The day it opens: September 1, the day after the season's last. */
export const OPENS_DAY = SEASON.days;

const notes = demoLocal<Record<string, SeptemberNote>>("fl4.september-notes.v1", {});

export const useSeptemberNotes = notes.use;

export function noteFor(memberId: string): SeptemberNote | null {
  return notes.get()[memberId] ?? null;
}

export function sealNote(memberId: string, text: string, day: number) {
  const clean = text.trim().slice(0, 140);
  if (!clean) return;
  notes.set({ ...notes.get(), [memberId]: { text: clean, sealedDay: day, shared: false } });
}

export function shareNote(memberId: string, shared: boolean) {
  const all = notes.get();
  const note = all[memberId];
  if (!note) return;
  notes.set({ ...all, [memberId]: { ...note, shared } });
}

/** Days until it opens, from a season day. */
export function daysToOpen(day: number): number {
  return Math.max(0, OPENS_DAY - day);
}
