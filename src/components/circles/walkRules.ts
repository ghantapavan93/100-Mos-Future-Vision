// The rules behind three City Circles ideas, kept apart from the screens so they
// can be tested on their own:
//  - Walks that fit you: a person picks what helps (shade, benches, step-free…)
//    and each walk says, need by need, whether the City Lead has checked it, it
//    is only listed, or it isn't there. Never "accessible" or "safe": only what
//    a person confirmed.
//  - The Lead's co-pilot: "What am I missing?" reads one walk's own details —
//    who walks at the back, what's listed but unchecked, the start time against
//    the day's heat, how full it is, and whether a change still needs telling —
//    and says what to fix. It drafts; the Lead decides. No model, just rules.
// Guests (the no-app doorway) live on the screen, not in the engine: a first
// name and a walk. Their miles count once they join, through the same
// check-in as everyone else.

import { timeLabel } from "@/domain/calendar";
import type { AccessNeed, MemberId, MovementEvent, World } from "@/domain/types";

/** What each need is called on screen. "Seating" is benches to a walker. */
export const NEED_WORDS: Record<AccessNeed, string> = {
  "step-free": "Step-free",
  shade: "Shade",
  seating: "Benches",
  restrooms: "Restrooms",
  "short-option": "A short option",
  transit: "Near transit",
};

/** The order the picker offers them in. */
export const NEED_ORDER: AccessNeed[] = ["shade", "seating", "step-free", "restrooms", "short-option", "transit"];

export type FitState = "checked" | "listed" | "missing";

export interface Fit {
  rows: { need: AccessNeed; state: FitState }[];
  /** Checked counts twice what's only listed; missing counts nothing. */
  score: number;
  /** How many of the picked needs the walk has at all (checked or listed). */
  has: number;
}

export function fitOf(event: MovementEvent, needs: readonly AccessNeed[], confirmed: readonly AccessNeed[]): Fit {
  const rows = needs.map((need) => ({ need, state: (event.access.includes(need) ? (confirmed.includes(need) ? "checked" : "listed") : "missing") as FitState }));
  return {
    rows,
    score: rows.reduce((s, r) => s + (r.state === "checked" ? 2 : r.state === "listed" ? 1 : 0), 0),
    has: rows.filter((r) => r.state !== "missing").length,
  };
}

/** Best fit first; ties go to the sooner walk, so nothing reorders for no reason. */
export function rankWalks(events: readonly MovementEvent[], needs: readonly AccessNeed[], confirmed: Readonly<Record<string, readonly AccessNeed[]>>): MovementEvent[] {
  const start = (e: MovementEvent) => e.day * 1440 + e.startMinute;
  return [...events].sort((a, b) => fitOf(b, needs, confirmed[b.id] ?? []).score - fitOf(a, needs, confirmed[a.id] ?? []).score || start(a) - start(b));
}

/** "Shade and benches", "Shade, benches and restrooms". */
export function listWords(needs: readonly AccessNeed[]): string {
  const words = needs.map((n, i) => (i === 0 ? NEED_WORDS[n] : NEED_WORDS[n].toLowerCase()));
  return words.length <= 1 ? (words[0] ?? "") : `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
}

/** The week's sample forecast: the day's high, °F. Summer is the season, and heat is its biggest risk. */
export const FORECAST: Record<number, number> = { 13: 81, 14: 84, 15: 86, 16: 88, 17: 79, 21: 86, 22: 88 };

export function highOn(day: number): number {
  return FORECAST[day] ?? 82;
}

/** A start before 9 AM or from 6 PM misses the heat of the day. */
export function beatsTheHeat(event: MovementEvent): boolean {
  return highOn(event.day) < 85 || event.startMinute <= 9 * 60 || event.startMinute >= 18 * 60;
}

export type CheckId = "back" | "access" | "heat" | "room" | "told";

export interface CopilotCheck {
  id: CheckId;
  ok: boolean;
  title: string;
  detail: string;
}

export interface BackOption {
  memberId: MemberId;
  name: string;
  /** What choosing them costs, in a few words. */
  tradeoff: string;
}

export interface CopilotInput {
  world: World;
  event: MovementEvent;
  /** Needs the Lead has walked and checked on this walk. */
  confirmed: readonly AccessNeed[];
  /** A volunteer who said they can't make it. */
  dropout: MemberId | null;
  /** Guests (no app) who saved a spot on this walk. */
  guests: number;
  /** Members who offered to walk at the back. */
  offered: ReadonlySet<MemberId>;
  /** The back walker changed and the note to everyone coming hasn't gone yet. */
  untold: boolean;
}

export interface Copilot {
  checks: CopilotCheck[];
  clear: boolean;
  /** Who could walk at the back instead, best first. Empty while someone is there. */
  backOptions: BackOption[];
  /** Listed but not yet checked by the Lead. */
  unchecked: AccessNeed[];
  coming: number;
}

const nameOf = (w: World, id: MemberId) => w.members[id]?.name ?? "A volunteer";

export function copilot({ world: w, event: e, confirmed, dropout, guests, offered, untold }: CopilotInput): Copilot {
  const chapter = w.chapters[e.chapterId];
  const lead = chapter?.organizers[0] ?? e.createdBy;
  const atBack = e.sweep && e.sweep !== dropout ? e.sweep : null;
  const coming = e.rsvps.length + e.waitlist.length + e.backgroundRsvps + guests;
  const unchecked = e.access.filter((n) => !confirmed.includes(n));
  const checks: CopilotCheck[] = [];

  checks.push(
    atBack
      ? { id: "back", ok: true, title: "Someone walks at the back", detail: `${nameOf(w, atBack)} walks at the back, so nobody finishes last.` }
      : {
          id: "back",
          ok: false,
          title: "Nobody at the back",
          detail: dropout ? `${nameOf(w, dropout)} can't make it. Pick someone, so nobody finishes last.` : "Nobody is named to walk at the back yet.",
        },
  );

  checks.push(
    e.access.length === 0
      ? { id: "access", ok: true, title: "Nothing listed to check", detail: "This walk lists no access details." }
      : unchecked.length === 0
        ? { id: "access", ok: true, title: "What's listed is checked", detail: `${listWords(e.access)} — walked and checked by ${nameOf(w, lead)}.` }
        : {
            id: "access",
            ok: false,
            title: `${listWords(unchecked)} — listed, not checked yet`,
            detail: "People who need it see “not checked yet” until you've walked the route.",
          },
  );

  const high = highOn(e.day);
  checks.push(
    beatsTheHeat(e)
      ? { id: "heat", ok: true, title: "Ahead of the heat", detail: `Starts ${timeLabel(e.startMinute)}. The high is ${high}°F, later in the day.` }
      : { id: "heat", ok: false, title: "Starts in the heat", detail: `The high is ${high}°F. Start before 9 AM, or plan water and shade stops.` },
  );

  const full = coming > e.capacity * 0.8;
  checks.push(
    full
      ? { id: "room", ok: false, title: `${coming} of ${e.capacity} — nearly full`, detail: "A second person at the back helps a big group." }
      : { id: "room", ok: true, title: `${coming} of ${e.capacity} coming`, detail: "Room for anyone who just shows up." },
  );

  if (untold) checks.push({ id: "told", ok: false, title: "Tell everyone what changed", detail: `${coming} people are coming. Your note is drafted — nothing sends until you tap Send.` });

  const circle = (chapter?.members ?? []).filter((id) => id !== dropout && w.members[id]);
  const tradeoff = (id: MemberId): string =>
    id === lead ? "Then nobody's free to welcome people at the start." : offered.has(id) ? "Offered to walk at the back." : e.rsvps.includes(id) ? "Already coming. One quick ask." : "In your circle. One quick ask.";
  const rank = (id: MemberId) => (id === lead ? 3 : offered.has(id) ? 0 : e.rsvps.includes(id) ? 1 : 2);
  const backOptions = atBack ? [] : circle.sort((a, b) => rank(a) - rank(b)).map((id) => ({ memberId: id, name: nameOf(w, id), tradeoff: tradeoff(id) }));

  return { checks, clear: checks.every((c) => c.ok), backOptions, unchecked, coming };
}

/** The note the co-pilot drafts when the back walker changes. The Lead sends it, or doesn't. */
export function changeNote(event: MovementEvent, newBack: string): string {
  return `Quick change: ${newBack} will walk at the back. Same time, same place — ${timeLabel(event.startMinute)} at ${event.meetingArea}. See you there!`;
}
