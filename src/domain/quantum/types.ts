// QUANTUM (the Quantum Health Coach) is a name, not a technology: there is no
// quantum computing. Answers come from a deterministic composer over reviewed or
// clearly-labelled content, and a validator checks every draft. When a language
// model is switched on, it may write only the kind, personal lines and choose
// which approved tips to lean on; the facts stay the tips' own words, and the
// same validator decides whether its draft is sent.

import type { ActivitySource, EventId, RacePath, RulesetVersion } from "../types";

export type Intent =
  | "start"
  | "restart"
  | "first-5k"
  | "race-big"
  | "community"
  | "rest"
  | "heat"
  | "pain"
  | "medical"
  | "crisis"
  | "wellbeing"
  | "nutrition"
  | "privacy"
  | "kayla"
  | "injection"
  | "general";

export type Safety = "ok" | "support" | "refer" | "urgent";

export type CardStatus =
  /** Paraphrase of a published public-health guideline, with citation. */
  | "public-guideline"
  /** A program rule the team proposes; needs a certified coach's review. */
  | "proposed-rule"
  /** A lesson the team drafted in the spirit of Kayla's public themes. NOT her words. Needs her review. */
  | "proposed-lesson"
  /** Crisis and care resources. */
  | "resource";

export interface KnowledgeCard {
  id: string;
  title: string;
  body: string;
  status: CardStatus;
  /** Where the content comes from. */
  source: string;
  url?: string;
  /** Who must approve before this could ship. */
  needsReviewBy: string | null;
  /** Rulesets that include this card. */
  rulesets: RulesetVersion[];
}

export type BlockKind = "heard" | "know" | "step" | "boundary" | "support";

export interface AnswerBlock {
  kind: BlockKind;
  text: string;
  cardId?: string;
}

export type NextStepAction =
  | { type: "save" }
  | { type: "rsvp"; eventId: EventId }
  | { type: "race-path"; racePath: RacePath }
  | { type: "open"; lens: "circles" | "coach" };

export interface NextStep {
  label: string;
  /** Proposed only. Nothing happens until the member taps it. */
  action: NextStepAction;
  cardId: string;
}

export interface ContextLine {
  source: ActivitySource;
  records: number;
  miles: number;
}

export interface CoachContext {
  /** Sources the coach was allowed to read, with consent. */
  included: ContextLine[];
  /** Sources that exist for this member but were kept out, with the rule that kept them out. */
  excluded: (ContextLine & { ruleId: string })[];
  /** One sentence the composer may use, built only from included sources. */
  summary: string | null;
}

export interface Check {
  id: string;
  pass: boolean;
  detail: string;
}

/** Who wrote the words: the approved tips alone, or the AI inside them. */
export type Generator = "deterministic-composer" | "ai-model";

/**
 * What the AI may contribute to an answer: a few kind, personal lines in its
 * own words, and which approved tips to lean on (by id, most relevant first).
 * It never writes a fact, a boundary, a help line or a next step.
 */
export interface AiDraft {
  heard: string[];
  cards: string[];
  /** The model that wrote it, for the record. */
  model: string;
}

export interface CoachAnswer {
  id: string;
  memberId: string;
  question: string;
  ruleset: RulesetVersion;
  /** The intent the answer was written for. "general" when the question wasn't understood well enough. */
  intent: Intent;
  safety: Safety;
  /** What the rules matched, before the low-confidence guard (may differ from `intent`). */
  classifiedAs: Intent;
  /** Low when the words carried a concern the matched intent can't address; the answer is then the safe default. */
  confidence: "high" | "low";
  /** The phrases that decided the intent, for "why this?". */
  matched: string[];
  context: CoachContext;
  cards: string[];
  blocks: AnswerBlock[];
  nextStep: NextStep | null;
  checks: Check[];
  /** When the drafting step produced something unsafe and the validator replaced it. */
  rejectedDraft: { text: string; failed: string[] } | null;
  generator: Generator;
  /** The model behind an AI-written answer; null when the approved tips answered alone. */
  model: string | null;
  attributions: string[];
}
