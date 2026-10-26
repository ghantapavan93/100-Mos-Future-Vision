// Sample data for "One commission, three cities". Every buyer, crew, name and
// number here is FICTIONAL planning data for the demo: no real employer, brand,
// tourism board or run crew is named, and no figure is a quote from anyone.
// The engine reads these; the screen labels them as samples.

import type { ChapterId, Partner } from "../types";

export interface Buyer {
  id: string;
  name: string;
  kind: Partner["kind"];
  /** Who they are, in a few words, for the picker. */
  line: string;
  wants: string;
  /** What their side asks for that the rules refuse, as a partner data request. */
  asks: { label: string; request: "participant-list" | "activity-history" | "health-audience" }[];
}

export const BUYERS: Buyer[] = [
  {
    id: "fairhaven",
    name: "Fairhaven Mutual",
    kind: "workplace",
    line: "An employer with offices in three of your cities",
    wants: "A summer that gets staff outside together, not another step contest.",
    asks: [
      { label: "The names of staff who came", request: "participant-list" },
      { label: "Each person's step counts", request: "activity-history" },
    ],
  },
  {
    id: "shoreline",
    name: "Shoreline Visitors Collective",
    kind: "city",
    line: "A tourism board",
    wants: "Residents and visitors walking the waterfronts we promote.",
    asks: [
      { label: "A list of who walked, to email visitor offers", request: "participant-list" },
      { label: "An audience of the people who walk most", request: "health-audience" },
    ],
  },
  {
    id: "kindred",
    name: "Kindred Outdoor",
    kind: "brand",
    line: "An outdoor brand",
    wants: "Real people at real walks, in the cities where we sell.",
    asks: [
      { label: "An audience of members who log the most miles", request: "health-audience" },
      { label: "Each person's activity history", request: "activity-history" },
    ],
  },
];

export interface CityFacts {
  /** Walks a week the City Lead can add on top of what they already run. */
  leadOpenWalksPerWeek: number;
  /** Why the lead can't take more, when they can't. */
  leadLoad?: string;
  /** A start the City Lead has checked is step-free, or null if none is confirmed. */
  stepFreeStart: string | null;
  /** Volunteers trained to walk at the back. Two means there's a backup. */
  trainedSweeps: number;
}

/** What each City Lead told the team about the summer ahead (sample planning facts). */
export const CITY_FACTS: Record<ChapterId, CityFacts> = {
  chicago: { leadOpenWalksPerWeek: 1, stepFreeStart: "Lakefront path start, paved and step-free", trainedSweeps: 3 },
  detroit: { leadOpenWalksPerWeek: 1, stepFreeStart: "Riverwalk plaza start, paved and step-free", trainedSweeps: 2 },
  charleston: { leadOpenWalksPerWeek: 1, stepFreeStart: "Waterfront park path, paved and step-free", trainedSweeps: 2 },
  nyc: { leadOpenWalksPerWeek: 1, stepFreeStart: "Park loop entrance, paved and step-free", trainedSweeps: 2 },
  la: { leadOpenWalksPerWeek: 0, leadLoad: "already leads two walks a week, her limit", stepFreeStart: null, trainedSweeps: 1 },
  durham: { leadOpenWalksPerWeek: 1, stepFreeStart: "Rail-trail trailhead, paved and step-free", trainedSweeps: 1 },
  montreal: { leadOpenWalksPerWeek: 1, stepFreeStart: "Canal path start, paved and step-free", trainedSweeps: 2 },
};

export interface Crew {
  id: string;
  chapterId: ChapterId;
  name: string;
  /** The crew's lead joins the city's circle as a co-organizer when the program goes live. */
  leadId: string;
  leadName: string;
  sweeps: number;
  stepFreeStart: string;
}

/** Partner run crews that could co-host (sample names, not real crews). */
export const CREWS: Crew[] = [
  { id: "crew-la", chapterId: "la", name: "Westside Walk Crew", leadId: "crew-la-lead", leadName: "Mo", sweeps: 3, stepFreeStart: "Beach-path start by the pier lot, paved and step-free" },
  { id: "crew-durham", chapterId: "durham", name: "Trailhead Walk Crew", leadId: "crew-durham-lead", leadName: "Jo", sweeps: 2, stepFreeStart: "Rail-trail trailhead, paved and step-free" },
];

/** Sample planning rates. Every commission quote is built from these and `economics()`. */
export const RATES = {
  /** Permit, water, first-aid kit and printed welcome cards for one walk. */
  costPerWalk: 300,
  /** The City Lead's (or crew lead's) thank-you for one walk. */
  stipendPerWalk: 150,
  /** Photos and the Community Value Report. */
  reportAndCreative: 1800,
  /** Selling, scheduling and running the program. */
  baseHours: 30,
  hoursPerCity: 4,
  kickoffHours: 6,
  /** Agreement, safety briefing and route check with a partner crew. */
  crewOnboardingHours: 8,
  staffRate: 45,
  paymentFeePct: 3,
  impactPct: 10,
} as const;

export const DEFAULT_COMMISSION = {
  buyerId: "fairhaven",
  chapterIds: ["chicago", "detroit", "la"] as ChapterId[],
  weeks: 6,
  fee: 18000,
  kickoff: true,
};

/** The buyer's counter-offer: a little over half the asking fee, rounded down to $500. */
export const COUNTER_SHARE = 0.55;

/** A sample heat forecast that lands on one walk in the program. */
export const HEAT = {
  /** The first of these cities in the program gets the forecast. */
  cities: ["detroit", "chicago", "charleston", "durham", "nyc", "la", "montreal"] as ChapterId[],
  /** Which week's walk (1-based); the last week if the program is shorter. */
  week: 4,
  heatIndexF: 97,
  /** The heat plan's earlier start. */
  earlyStart: 6 * 60 + 30,
};

/** First names for the people who join and walk in the simulation (fictional). */
export const WALKER_NAMES = [
  "Ana", "Bree", "Cal", "Dami", "Elle", "Femi", "Gia", "Hal", "Ines", "Jae", "Kofi", "Lu", "Mara", "Nico", "Oli", "Pia",
  "Quin", "Rae", "Sol", "Tess", "Uma", "Vic", "Wren", "Xavi", "Yara", "Zed", "Ari", "Bo", "Cleo", "Dev", "Esi", "Fay",
  "Gus", "Hana", "Ivo", "Jun", "Kai", "Lia", "Milo", "Noa", "Omar", "Pru", "Remy", "Suki", "Tomas", "Ula", "Vera", "Will",
  "Xia", "Yusuf", "Zoe", "Abe", "Bea", "Cyd", "Dot", "Eli", "Flo", "Gil", "Hugo", "Ida",
];

/** Volunteers who sweep in a city whose circle has nobody else named yet (fictional). */
export const SWEEP_NAMES: Record<ChapterId, string> = {
  chicago: "Rosa",
  detroit: "Ken",
  charleston: "Lulu",
  nyc: "Tam",
  la: "Paz",
  durham: "Bev",
  montreal: "Élise",
};
