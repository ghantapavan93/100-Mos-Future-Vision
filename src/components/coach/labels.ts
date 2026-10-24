// Words for the coach's internal states. Kept in one place so the answer
// card, the "why this" panel and the lab never describe the same thing two ways.

import type { CardStatus, Intent, Safety } from "@/domain/quantum/types";

export const INTENT_LABEL: Record<Intent, string> = {
  start: "Getting started",
  restart: "Coming back after a gap",
  "first-5k": "A first 5K",
  "race-big": "A bigger race",
  community: "Finding people",
  rest: "Rest or push",
  heat: "Moving in the heat",
  pain: "Pain or injury",
  medical: "A health symptom or condition",
  crisis: "Crisis",
  wellbeing: "Stress and wellbeing",
  nutrition: "Food, weight or supplements",
  privacy: "Someone else's data",
  kayla: "Speaking for Kayla",
  injection: "Trying to change the rules",
  general: "Not sure",
};

export const SAFETY: Record<Safety, { label: string; tone: "neutral" | "info" | "warn" | "bad" }> = {
  ok: { label: "Everyday question", tone: "neutral" },
  support: { label: "Support resources shown", tone: "info" },
  refer: { label: "Refer to a professional", tone: "warn" },
  urgent: { label: "Urgent — reach a person now", tone: "bad" },
};

export const STATUS: Record<CardStatus, { label: string; tone: "ok" | "warn" | "info" | "neutral" }> = {
  "public-guideline": { label: "Public guideline", tone: "ok" },
  "proposed-lesson": { label: "Proposed lesson — not Kayla's words", tone: "warn" },
  "proposed-rule": { label: "Proposed rule", tone: "info" },
  resource: { label: "Resource", tone: "neutral" },
};

export const CHECK_LABEL: Record<string, string> = {
  "no-diagnosis": "No diagnosis",
  "no-prescription": "No mileage prescription",
  "no-unsafe-advice": "No unsafe advice",
  grounded: "Every fact is cited",
  "no-kayla-voice": "Never speaks as Kayla",
  "no-other-members": "No one else's activity",
  boundary: "States its limits",
  lineage: "No Strava in context",
  "no-mood-inference": "Doesn't read gaps as feelings",
  "safety-routing": "Urgent → people, not plans",
};

/**
 * The guided questions, in the order the phone shows them: the everyday ones a
 * new mover asks first (the coach screen's steps use the first and fourth, so
 * both sit in view), the pain question after them. Wording is chosen to match
 * how members actually ask, not to flatter the matcher.
 */
export const GUIDED: { id: string; situation: string; question: string; needsCard?: string }[] = [
  { id: "restart", situation: "Missed days", question: "I missed 12 days and I feel like I ruined everything." },
  { id: "start", situation: "Beginning a habit", question: "I have never really exercised. Is the 100-mile challenge even for me?" },
  { id: "rest", situation: "Rest or push?", question: "I'm sore today. Should I rest or push through?" },
  { id: "pain", situation: "When to see a professional", question: "My knee hurts when I jog downhill." },
  { id: "5k", situation: "A first 5K", question: "How do I train for my first 5K?" },
  { id: "community", situation: "Finding people nearby", question: "Are there any groups near me I could walk with?" },
  { id: "marathon", situation: "Marathon ambition", question: "I walked 100 miles. Can you make me a marathon runner by next month?" },
  { id: "overwhelmed", situation: "Feeling overwhelmed", question: "I have been stressed and mentally exhausted. Should I force myself to run?" },
  { id: "heat", situation: "Summer heat", question: "It's 98 degrees here. Is it safe to do my walk?", needsCard: "heat" },
];
