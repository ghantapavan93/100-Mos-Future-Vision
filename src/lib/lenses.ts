// The screens: one summer, seen by different people. Each has a mode (one of
// four darks) that tells the viewer which layer they're in: dawn for the
// story, day for a member's own things, golden for community and money, night
// for the founder's view and the machinery.
//
// The founder demo leads with the screens Kayla needs; the rest stay one tap
// away, quieter, for whoever wants to go further (Kirk, mostly).

export type Mode = "dawn" | "day" | "golden" | "night";

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
}

export const LENSES: LensDef[] = [
  { href: "/", label: "Home", short: "Home", who: "everyone", promise: "Where 100 Miles of Summer goes next.", mode: "dawn", primary: true },
  { href: "/member", label: "Member app", short: "Member", who: "every mover", promise: "Log a walk and watch your summer add up.", mode: "day", primary: true },
  { href: "/circles", label: "City Circles", short: "Circles", who: "movers and City Leads", promise: "Join a walk near you, and run one as a City Lead.", mode: "golden", primary: true },
  { href: "/partner", label: "Sponsors", short: "Sponsors", who: "brands and companies", promise: "Fund a city's summer and see where every dollar goes.", mode: "golden", primary: true },
  { href: "/founder", label: "Kayla's week", short: "Kayla's week", who: "the founder", promise: "The few things that need you, in three minutes.", mode: "night", primary: true },
  { href: "/future", label: "Next 3 summers", short: "Next 3 summers", who: "the whole team", promise: "Pilots, the team and the money, summer by summer.", mode: "night", primary: true },
  { href: "/vision", label: "Big picture", short: "Big picture", who: "everyone", promise: "Find your people. Find your place. Find your next reason to move.", mode: "dawn", primary: true },
  { href: "/coach", label: "Ask a question", short: "Ask a question", who: "every mover", promise: "Stuck? Get a kind, short answer.", mode: "day", primary: false },
  { href: "/impact", label: "Giving back", short: "Giving back", who: "movers and their neighborhoods", promise: "Movers choose where the giving goes.", mode: "golden", primary: false },
  { href: "/xray", label: "How miles count", short: "How miles count", who: "everyone who logs a mile", promise: "Every mile counted once, fairly, and kept private.", mode: "night", primary: false },
  { href: "/build", label: "Roadmap", short: "Roadmap", who: "the whole team", promise: "What you have today, and what we build next.", mode: "day", primary: false },
];

export function lensFor(pathname: string): LensDef {
  if (pathname === "/") return LENSES[0]!;
  return LENSES.find((l) => l.href !== "/" && pathname.startsWith(l.href)) ?? LENSES[0]!;
}
