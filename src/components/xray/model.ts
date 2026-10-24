// Small pure helpers the X-Ray screens share: how a receipt's stages read as
// stations, whether the audit chain still holds, and how to say a field change
// in words.

import { GENESIS, STAGES, receiptHash, type Receipt, type Stage } from "@/domain/engine";
import { tickLabel } from "@/domain/calendar";
import { stableStringify, type Change } from "@/domain/hash";

export const STATION: Record<Stage, { name: string; asks: string }> = {
  input: { name: "Input", asks: "Is the request well-formed?" },
  authorize: { name: "Authorize", asks: "May this person do this?" },
  reconcile: { name: "Reconcile", asks: "Seen it before? Is it stale?" },
  policy: { name: "Policy", asks: "Do provider terms, consent and our rules allow it?" },
  apply: { name: "Apply", asks: "Change the world." },
  audit: { name: "Audit", asks: "Write the receipt, chained to the last." },
  project: { name: "Project", asks: "Refresh every screen that shows it." },
};

export type StationState = "pass" | "fail" | "info" | "quiet" | "unreached" | "not-needed";

export const STATE_LABEL: Record<StationState, string> = {
  pass: "Passed",
  fail: "Refused here",
  info: "Noted",
  quiet: "Passed through",
  unreached: "Not reached",
  "not-needed": "Not needed",
};

const REFUSED = new Set(["rejected", "blocked"]);

/** The station where the receipt stopped, if it was refused. */
export function failStage(r: Receipt): Stage | null {
  if (!REFUSED.has(r.outcome)) return null;
  return r.stages.find((s) => s.status === "fail" && s.stage !== "audit")?.stage ?? null;
}

export function stationState(r: Receipt, stage: Stage): StationState {
  const notes = r.stages.filter((s) => s.stage === stage);
  if (notes.some((n) => n.status === "fail") && REFUSED.has(r.outcome)) return "fail";
  const stop = failStage(r);
  const idx = STAGES.indexOf(stage);
  if (stop && idx > STAGES.indexOf(stop) && stage !== "audit") return "unreached";
  if (r.outcome === "noop" && notes.length === 0 && (stage === "apply" || stage === "project")) return "not-needed";
  if (notes.some((n) => n.status === "pass")) return "pass";
  if (notes.length) return "info";
  return "quiet";
}

/** Index of the last station the request actually reached. */
export function reachedIndex(r: Receipt): number {
  const stop = failStage(r);
  if (stop) return STAGES.indexOf(stop);
  return r.lenses.length > 1 ? STAGES.indexOf("project") : STAGES.indexOf("audit");
}

export interface ChainCheck {
  links: number;
  intact: number;
  firstBreak: number | null;
}

/**
 * Recompute every hash from the receipt's own fields and its predecessor, with the
 * engine's own body definition (stages, change counts and facts included), so the
 * check can't drift from what was written.
 */
export function verifyChain(ledger: Receipt[]): ChainCheck {
  let intact = 0;
  let firstBreak: number | null = null;
  ledger.forEach((r, i) => {
    const prev = i === 0 ? GENESIS : ledger[i - 1]!.hash;
    const ok = r.prevHash === prev && receiptHash(r) === r.hash;
    if (ok) intact++;
    else if (firstBreak === null) firstBreak = r.seq;
  });
  return { links: ledger.length, intact, firstBreak };
}

export function recomputeMatches(r: Receipt): boolean {
  return receiptHash(r) === r.hash;
}

/** Values the engine replaced so restricted data never enters the audit trail. */
export function isRedacted(v: unknown): boolean {
  return typeof v === "string" && (v.startsWith("[Strava record") || v.startsWith("[coach conversation") || v === "[not shown]" || v.startsWith("[member's words") || /^\[\d+ queued\]$/.test(v));
}

/** Why a receipt shows digests instead of values, in one sentence, or null if nothing was redacted. */
export function redactionReason(r: Receipt): { text: string; rules: string[] } | null {
  const payload = r.payload as Record<string, unknown> | null;
  const strava = r.type === "PROVIDER_DELIVERY" && payload?.provider === "strava";
  const laundering = r.type === "LOG_ACTIVITY" && payload?.prefilledFrom === "strava";
  const coach = r.type === "ASK_COACH" || r.changes.some((c) => c.path.startsWith("coach.answers") || c.path === "coach.sessions");
  const stravaValue = (v: unknown) => isRedacted(v) && String(v).startsWith("[Strava");
  const stravaChange = r.changes.some((c) => stravaValue(c.after) || stravaValue(c.before));
  if (strava || laundering || stravaChange)
    return {
      text: "Strava data never enters the audit trail. The receipt keeps a digest that proves which record it was, never the distance, time or id — so when the record is deleted, nothing of it survives here.",
      rules: ["STRAVA-05", "STRAVA-06"],
    };
  if (coach)
    return {
      text: "What a member tells the coach stays with the member. The receipt keeps a digest and the intent the engine derived; if the member asks to forget, the words go and the chain still verifies.",
      rules: ["WA-02", "X-04"],
    };
  return null;
}

const SEGMENT: Record<string, string> = {
  members: "Member",
  activities: "Activity",
  chapters: "Chapter",
  events: "Event",
  proposals: "Proposal",
  programs: "Impact program",
  partners: "Partner",
  coach: "Coach",
  scenario: "Scenario",
  projections: "Read model",
  impact: "Impact pool",
  egress: "Egress log",
  pendingRetries: "Retry queue",
  seq: "Id counter",
  clock: "Season clock",
};

export function humanPath(path: string): string {
  const parts = path.split(".");
  const head = SEGMENT[parts[0] ?? ""] ?? parts[0] ?? "";
  // Field names read as words; numbered record ids ("a-12") stay as written.
  const rest = parts.slice(1).map((p) => (/\d/.test(p) ? p : p.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ").toLowerCase()));
  return [head, ...rest].join(" › ");
}

export function showValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v.length > 120 ? `${v.slice(0, 117)}…` : v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  const text = stableStringify(v);
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}

/** Timestamps are season ticks; say them as a day and time. */
function sayValue(path: string, v: unknown): string {
  const key = path.slice(path.lastIndexOf(".") + 1);
  return typeof v === "number" && (/[a-z]At$/.test(key) || key === "at" || key === "clock") ? tickLabel(v) : showValue(v);
}

/** A plain sentence for a change, for the "Plain English" view. */
export function sayChange(c: Change): string {
  const where = humanPath(c.path);
  if (isRedacted(c.before) || isRedacted(c.after)) {
    if (c.before === null || c.before === undefined) return `${where} was added — contents not shown here.`;
    if (String(c.after).includes("deleted")) return `${where} was deleted; nothing of it is kept.`;
    if (c.after === null || c.after === undefined) return `${where} was removed.`;
    return `${where} changed — contents not shown here.`;
  }
  if (c.before === null || c.before === undefined) return `${where} was added: ${sayValue(c.path, c.after)}.`;
  if (c.after === null || c.after === undefined) return `${where} was removed.`;
  return `${where} changed from ${sayValue(c.path, c.before)} to ${sayValue(c.path, c.after)}.`;
}

const PROVIDER_ACTOR: Record<string, string> = {
  healthkit: "Apple Health (on the phone)",
  health_connect: "Health Connect (on the phone)",
  garmin: "Garmin webhook",
  strava: "Strava webhook",
};

export function actorLabel(r: Receipt): string {
  const { role, id } = r.actor;
  if (role === "founder") return "Kayla (founder)";
  if (role === "engineer") return "Kirk (engineer)";
  if (role === "system") return "Scheduler";
  // The phone reads Apple Health and Health Connect itself; only Garmin and Strava send from their own servers.
  if (role === "provider") return PROVIDER_ACTOR[id] ?? `${id.replace("_", " ")} webhook`;
  if (role === "partner") return `Partner · ${id}`;
  return `${id[0]?.toUpperCase() ?? ""}${id.slice(1)} (${role})`;
}
