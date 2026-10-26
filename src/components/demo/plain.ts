// Plain words for what the engine records. The engine's summaries are written
// for people already, but they cite rule ids and use a few system words; the
// demo shows Kayla and Kirk the sentence, not the plumbing.

import type { Outcome } from "@/domain/engine";

/** Deal and giving-program steps, as a person would say them. */
const STAGE_WORDS: Record<string, string> = {
  inquiry: "first chat",
  qualified: "a good fit",
  proposal: "proposal sent",
  contract: "signed",
  live: "live",
  reported: "report sent",
  renewed: "renewed",
  proposed: "proposed",
  "community-review": "with members for a vote",
  approved: "approved",
  funded: "funded",
  delivered: "delivered",
  verified: "done",
};

/** What a coach question was about, by the coach's topic. */
const TOPIC_WORDS: Record<string, string> = {
  start: "getting started",
  restart: "coming back after a gap",
  "first-5k": "a first 5K",
  "race-big": "a big race",
  community: "finding people to move with",
  rest: "rest days",
  heat: "moving in the heat",
  pain: "pain",
  medical: "a health worry",
  crisis: "a hard moment",
  wellbeing: "how they're feeling",
  nutrition: "food",
  privacy: "someone else's miles",
  kayla: "what Kayla would say",
  injection: "a trick question",
  general: "something general",
};

/** A sponsor deal's settings, as Kayla would name them. Money keys get a dollar sign. */
const DEAL_INPUTS: Record<string, [string, "usd" | "count" | "pct"]> = {
  fee: ["Price", "usd"],
  communities: ["Cities", "count"],
  eventsPerCommunity: ["Walks per city", "count"],
  costPerEvent: ["Cost per walk", "usd"],
  organizerStipendPerEvent: ["City Lead thank-you per walk", "usd"],
  creativeAndReporting: ["Photos and report", "usd"],
  staffHours: ["Team hours", "count"],
  staffRate: ["Team hourly cost", "usd"],
  paymentFeePct: ["Card fees", "pct"],
  impactPct: ["Giving share", "pct"],
};

function dealValue(raw: string, kind: "usd" | "count" | "pct"): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  if (kind === "usd") return `$${n.toLocaleString("en-US")}`;
  if (kind === "pct") return `${n}%`;
  return n.toLocaleString("en-US");
}

/** Drops rule ids like "(STRAVA-03)" or "per APPLE-04", says stage changes in words, and tidies the spaces left behind. */
export function plain(text: string): string {
  return text
    .replace(/^(\w+) → ([\d.]+)\./, (m, key: string, value: string) => {
      const known = DEAL_INPUTS[key];
      return known ? `${known[0]} set to ${dealValue(value, known[1])}.` : m;
    })
    .replace(/A member list would be an unauthorised disclosure\./g, "A list of members is never shared.")
    .replace(/(What's left after giving|Contribution after impact) ([−-]?\$[\d,.]+) → /g, "What's left after giving: $2 → ")
    .replace(/QUANTUM answered with AI \(([\w-]+)\)\.?/g, (m, topic: string) => (TOPIC_WORDS[topic] ? `The AI coach answered a question about ${TOPIC_WORDS[topic]}, inside approved tips.` : "The AI coach answered, inside approved tips."))
    .replace(/QUANTUM answered \(([\w-]+)\)\.?/g, (m, topic: string) => (TOPIC_WORDS[topic] ? `The coach answered a question about ${TOPIC_WORDS[topic]}.` : "The coach answered."))
    .replace(/QUANTUM caught an unsafe draft and sent a safe answer\./g, "The coach caught an unsafe answer and sent a safe one instead.")
    .replace(/ completed: (\d+) checked in by name, (?:\d+|null) modelled\./g, (m, n: string) => ` is done: ${n} ${n === "1" ? "person" : "people"} checked in.`)
    .replace(/verification needs 10\. Modelled crowds don't count\./g, "it's done once ten people walk it.")
    .replace(/\bchecked in by name\b/g, "checked in")
    .replace(/:\s*([a-z-]+) → ([a-z-]+)\./g, (m, from: string, to: string) => (STAGE_WORDS[from] && STAGE_WORDS[to] ? `: now ${STAGE_WORDS[to]}.` : m))
    .replace(/\bContribution after impact\b/g, "What's left after giving")
    .replace(/\s*\((?:[A-Z]+-[A-Z0-9-]+)(?:[,;]\s*[A-Z]+-[A-Z0-9-]+)*\)/g, "")
    .replace(/\s*(?:per|under|see)\s+[A-Z]+-\d+[A-Z0-9-]*/g, "")
    .replace(/\b[A-Z]{2,}-\d{2}\b\s*/g, "")
    .replace(/^Duplicate outing recorded once\. Miles unchanged\./, "Same walk from another app: counted once. Miles unchanged.")
    .replace(/^Duplicate or stale Strava delivery ignored\./, "That Strava run was already here. Miles unchanged.")
    .replace(/^The same (.+?) record arrived again\. Ignored; miles unchanged\./, "That $1 walk was already counted. Miles unchanged.")
    .replace(/^Saved: Save /, "Saved: ")
    .replace(/\bchapter (totals?)\b/g, "circle $1")
    .replace(/\bQuarantined\b/g, "Set aside")
    .replace(/\bquarantined\b/g, "set aside")
    .replace(/\ban implausible record\b/g, "a walk that doesn't add up")
    .replace(/\bimplausible\b/g, "unlikely")
    // Provider ids, as people know them.
    .replace(/\bhealthkit\b/gi, "Apple Health")
    .replace(/\bhealth_connect\b/gi, "Health Connect")
    .replace(/\bgarmin\b/g, "Garmin")
    .replace(/\bstrava\b/g, "Strava")
    .replace(/\bevent_checkin\b/g, "event check-in")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;:])/g, "$1")
    .trim();
}

/** What an outcome means to a person, in one or two words. */
export const OUTCOME_WORDS: Record<Outcome, string> = {
  applied: "Done",
  noop: "Already done",
  rejected: "Not allowed",
  blocked: "Not yet",
  deferred: "Waiting",
  quarantined: "Set aside",
};

export const OUTCOME_TONE: Record<Outcome, "ok" | "neutral" | "bad" | "warn" | "info"> = {
  applied: "ok",
  noop: "neutral",
  rejected: "bad",
  blocked: "warn",
  deferred: "info",
  quarantined: "warn",
};
