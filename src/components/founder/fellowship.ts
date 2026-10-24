"use client";

// The City Lead Fellowship: a way to raise your hand, three short lessons, a
// walk co-led beside a seasoned City Lead, and then — with Kayla's yes — a
// walk of your own. Kayla still picks every City Lead; the path just gets
// people ready, so no one leads alone and no one burns out.
//
// The people are samples, like everyone else in the demo: Amélie is Montreal's
// new City Lead, James is training to co-lead in Detroit beside Nina. Kayla's
// answer is kept in this browser's session and forgotten when the demo starts
// over; in their app it would be one row in a decisions table.

import { demoLocal } from "@/components/member/demoLocal";

export const PATH = ["Raise your hand", "Three short lessons", "Co-lead a walk", "Lead, with Kayla's yes"] as const;

export interface Fellow {
  id: string;
  name: string;
  city: string;
  /** How far along PATH they are: 0–3 done steps (3 = ready for Kayla's yes). */
  done: number;
  now: string;
  /** Their first solo walk, once ready. */
  walk?: string;
}

export const FELLOWS: Fellow[] = [
  { id: "amelie", name: "Amélie", city: "Montreal", done: 3, now: "Three lessons done, two walks co-led", walk: "Lachine Canal First Mile" },
  { id: "james", name: "James", city: "Detroit", done: 2, now: "Co-leading with Nina on Saturdays" },
];

export type FellowChoice = "yes" | "later";

const choices = demoLocal<Record<string, FellowChoice>>("fl4.fellowship.v1", {});

export const useFellowChoices = choices.use;

export function fellowChoice(id: string): FellowChoice | null {
  return choices.get()[id] ?? null;
}

export function decideFellow(id: string, choice: FellowChoice) {
  choices.set({ ...choices.get(), [id]: choice });
}

/** "2 in training — Detroit, Montreal"; once someone is cleared to lead, they're counted as new. */
export function trainingLine(answers: Record<string, FellowChoice>): string {
  const training = FELLOWS.filter((f) => answers[f.id] !== "yes");
  const cleared = FELLOWS.filter((f) => answers[f.id] === "yes");
  const parts: string[] = [];
  if (training.length) parts.push(`${training.length} in training — ${training.map((f) => f.city).sort().join(", ")}`);
  if (cleared.length) parts.push(`${cleared.length} new City Lead${cleared.length === 1 ? "" : "s"} — ${cleared.map((f) => f.city).join(", ")}`);
  return parts.join(" · ");
}
