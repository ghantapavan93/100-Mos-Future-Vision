"use client";

// The pieces every City Circles phone screen shares: the people and walk the
// demo is built around, the phone's state, its buttons and chips, and how a
// command is sent and a refusal is said.

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { dateOf, tick } from "@/domain/calendar";
import type { CommandInput } from "@/domain/commands";
import type { Receipt } from "@/domain/engine";
import type { AccessNeed, Actor, ChapterId, MemberId, MovementEvent } from "@/domain/types";
import { plain } from "@/components/demo/plain";
import { cn } from "@/components/ui/kit";
import { actors, store } from "@/lib/store";

export const MAYA = "maya";
export const NINA = actors.organizer("nina");
/** Nina leads Detroit (the sample chapter's id predates the move to real cities). */
export const LEAD_CITY: ChapterId = "dallas";
/** The walk the tour and the guest doorway meet at. */
export const SATURDAY = "dal-first-mile";

/** Whose phone it is: a guest with no app (from a poster), Maya the member, or Nina the City Lead. */
export type CirclesMode = "guest" | "member" | "lead";
export type LeadTab = "walks" | "new";

/** Someone who saved a spot from the poster, no app. Only a first name; their miles count once they join. */
export interface Guest {
  name: string;
  eventId: string;
  checkedIn: boolean;
  /** Set once they join: the member the engine created for them. */
  memberId: MemberId | null;
  /** What joining said, if the walk's check-in didn't carry over. */
  note: string | null;
}

export interface CirclesDemo {
  chapterId: ChapterId;
  pick: (id: ChapterId) => void;
  mode: CirclesMode;
  setMode: (m: CirclesMode) => void;
  leadTab: LeadTab;
  setLeadTab: (t: LeadTab) => void;
  openEvent: string | null;
  setOpenEvent: (id: string | null) => void;
  /** The Try it step the guiding ring is on, so controls outside the step's own screen (the hat switch) can carry it. */
  next: string | null;
  /** The route Maya picked for each walk she's coming to (miles). */
  route: Record<string, number>;
  setRoute: (eventId: string, miles: number) => void;
  /** Walks where Maya offered to walk at the back. */
  offers: ReadonlySet<string>;
  offer: (eventId: string) => void;
  // ── the no-app doorway ──
  /** What the guest said helps them. Stays on the page; never sent anywhere. */
  needs: AccessNeed[];
  toggleNeed: (n: AccessNeed) => void;
  guest: Guest | null;
  /** The walk whose "save my spot" form is open. Held here so the guiding ring follows it. */
  saving: string | null;
  setSaving: (eventId: string | null) => void;
  saveGuest: (name: string, eventId: string) => void;
  dropGuest: () => void;
  checkInGuest: () => void;
  joinGuest: () => void;
  // ── the Lead's co-pilot ──
  /** Needs the City Lead has walked and checked, per walk. */
  confirmed: Record<string, AccessNeed[]>;
  confirm: (eventId: string, needs: AccessNeed[]) => void;
  /** A back walker who said they can't make it, per walk. */
  dropout: Record<string, MemberId>;
  /** Walks whose co-pilot has been opened. */
  opened: ReadonlySet<string>;
  openCopilot: (eventId: string) => void;
  /** Per walk: who now walks at the back, while the note to everyone hasn't gone yet. */
  untold: Record<string, string>;
  setUntold: (eventId: string, name: string | null) => void;
  /** Per walk: the note the Lead sent. */
  sent: Record<string, string>;
  sendNote: (eventId: string, note: string) => void;
}

export function send(input: CommandInput, actor: Actor): Receipt {
  return store.dispatch(input, actor, { via: "circles-phone" });
}

export const refused = (r: Receipt | null | undefined) => r !== null && r !== undefined && (r.outcome === "rejected" || r.outcome === "blocked");

export function start(e: MovementEvent) {
  return tick(e.day, e.startMinute);
}

function dateChip(day: number) {
  const d = dateOf(day);
  return {
    weekday: d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }).toUpperCase(),
    date: d.getUTCDate(),
    month: d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase(),
  };
}

export function DateChip({ day }: { day: number }) {
  const c = dateChip(day);
  return (
    <div aria-hidden className="flex w-[52px] shrink-0 flex-col items-center rounded-xl border border-line bg-surface-2 py-1.5 leading-none">
      <span className="text-[10.5px] font-black tracking-[0.08em] text-accent">{c.weekday}</span>
      <span className="num mt-1 text-[22px] font-bold">{c.date}</span>
      <span className="mt-0.5 text-[10px] font-semibold tracking-[0.08em] text-muted">{c.month}</span>
    </div>
  );
}

export function Chip({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "ok" | "bad" | "warn" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-bold",
        tone === "neutral" && "bg-surface-2 text-muted",
        tone === "accent" && "bg-accent/15 text-accent",
        tone === "ok" && "bg-ok-soft text-ok",
        tone === "bad" && "bg-bad-soft text-bad",
        tone === "warn" && "bg-warn-soft text-warn",
      )}
    >
      {children}
    </span>
  );
}

export function Primary({ children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        "min-h-11 rounded-xl bg-accent px-4 text-[14px] font-black uppercase tracking-[0.06em] text-on-accent shadow-[0_8px_24px_-10px_rgba(255,106,19,0.8)] transition-transform active:scale-[0.98] disabled:opacity-40",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Secondary({ children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...rest} className={cn("min-h-11 rounded-xl border border-line-strong px-4 text-[14px] font-bold transition-colors hover:border-accent disabled:opacity-40", className)}>
      {children}
    </button>
  );
}

/** Marks what 100 Miles of Summer's own app already does, so nobody mistakes it for something new. */
export function YourAppToday() {
  return <span className="inline-flex shrink-0 items-center rounded-full border border-line-strong px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-muted">Your app today</span>;
}

/** A refusal, said plainly, right under the button that caused it. */
export function Note({ receipt }: { receipt: Receipt | null }) {
  if (!refused(receipt)) return null;
  return (
    <p role="status" className="rise-in mt-2 rounded-xl bg-bad-soft px-3 py-2 text-[13.5px] leading-snug text-ink">
      {plain(receipt!.summary)}
    </p>
  );
}

/** Small section heading inside the phone. */
export function PhoneHeading({ children, className }: { children: ReactNode; className?: string }) {
  return <h4 className={cn("text-[12px] font-black uppercase tracking-[0.14em] text-muted", className)}>{children}</h4>;
}
