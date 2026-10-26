// The screens: one summer, seen by different people. Each has a mode (one of
// four darks) that tells the viewer which layer they're in: dawn for the
// story, day for a member's own things, golden for community and money, night
// for the founder's view and the machinery.
//
// The screens are grouped into five acts, in the order the story is told:
// why it matters, the member and her city, the AI coach and the founder's
// week, the money, then the future and the proof. Every screen stays one link
// away; the acts only decide the order things are shown in.

export type Mode = "dawn" | "day" | "golden" | "night";

export type ActId = 1 | 2 | 3 | 4 | 5;

export interface ActDef {
  id: ActId;
  title: string;
  /** What this part of the app answers, in one plain line. */
  line: string;
}

export const ACTS: ActDef[] = [
  { id: 1, title: "The first mile", line: "Why it matters, and what's already built." },
  { id: 2, title: "Members & community", line: "One mover, her city, her neighborhood." },
  { id: 3, title: "The AI coach & the work", line: "Kind answers for movers. A calm week for the founder." },
  { id: 4, title: "Sponsors & money", line: "Who pays, what they get, what it costs." },
  { id: 5, title: "The future & proof", line: "Where it goes, and how we know it holds." },
];

export interface LensDef {
  href: string;
  label: string;
  short: string;
  /** Who the screen is for, in a few words. */
  who: string;
  /** What you can do there, in one plain line. */
  promise: string;
  mode: Mode;
  /** Shown first in the header; the others sit beside them, quieter. */
  primary: boolean;
  act: ActId;
}

export const LENSES: LensDef[] = [
  { href: "/", label: "Home", short: "Home", who: "everyone", promise: "Where 100 Miles of Summer goes next.", mode: "dawn", primary: true, act: 1 },
  { href: "/member", label: "Member app", short: "Member", who: "every mover", promise: "Log a walk and watch your summer add up.", mode: "day", primary: true, act: 2 },
  { href: "/circles", label: "City Circles", short: "Circles", who: "movers and City Leads", promise: "Join a walk near you, and run one as a City Lead.", mode: "golden", primary: true, act: 2 },
  { href: "/coach", label: "AI Coach", short: "AI Coach", who: "every mover", promise: "Quantum Health Coach: an AI that knows your summer, answers kindly, and knows when to stop.", mode: "day", primary: true, act: 3 },
  { href: "/founder", label: "Kayla's week", short: "Kayla's week", who: "the founder", promise: "The few things that need you, in three minutes.", mode: "night", primary: true, act: 3 },
  { href: "/partner", label: "Sponsors", short: "Sponsors", who: "brands and companies", promise: "Fund a city's summer and see where every dollar goes.", mode: "golden", primary: true, act: 4 },
  { href: "/future", label: "Next 3 summers", short: "Next 3 summers", who: "the whole team", promise: "Pilots, the team and the money, summer by summer.", mode: "night", primary: true, act: 4 },
  { href: "/vision", label: "Big picture", short: "Big picture", who: "everyone", promise: "Find your people. Find your place. Find your next reason to move.", mode: "dawn", primary: true, act: 5 },
  { href: "/impact", label: "Giving back", short: "Giving back", who: "movers and their neighborhoods", promise: "Movers choose where the giving goes.", mode: "golden", primary: false, act: 2 },
  { href: "/xray", label: "How miles count", short: "How miles count", who: "everyone who logs a mile", promise: "Every mile counted once, fairly, and kept private.", mode: "night", primary: false, act: 5 },
  { href: "/build", label: "Roadmap", short: "Roadmap", who: "the whole team", promise: "What you have today, and what we build next.", mode: "day", primary: false, act: 5 },
];

/** The screens in one act, in story order (the act's primary screens first). */
export function lensesIn(act: ActId): LensDef[] {
  return LENSES.filter((l) => l.act === act);
}

/** Pages that belong to a screen without a place of their own in the navigation. */
const BELONGS_TO: Record<string, string> = { "/commission": "/partner" };

export function lensFor(pathname: string): LensDef {
  if (pathname === "/") return LENSES[0]!;
  const parent = Object.entries(BELONGS_TO).find(([path]) => pathname.startsWith(path))?.[1];
  if (parent) return LENSES.find((l) => l.href === parent)!;
  return LENSES.find((l) => l.href !== "/" && pathname.startsWith(l.href)) ?? LENSES[0]!;
}
