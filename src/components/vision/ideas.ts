// Seventeen ideas, in her words and cities: fifteen cards, because two
// merged into others (the quiet app into the First-Mile Doorway, the global
// premiere into the Year 10 Relay). Each says what 100MoS already has
// first; nothing here pitches her own idea back
// without saying it's hers first.
//
// `value` (to the movement) and `effort` place each idea on the map, 0..1.

export type IdeaStage = "now" | "next" | "later";

export interface VisionIdea {
  id: string;
  name: string;
  stage: IdeaStage;
  /** "yours": builds on something 100 Miles of Summer already does or has said. */
  origin: "yours" | "new";
  value: number;
  effort: number;
  /** One of the four to start with. */
  start?: boolean;
  what: string;
  moment: string;
  money: string;
  careful: string;
}

export const STAGE_WORDS: Record<IdeaStage, string> = { now: "Now", next: "Next", later: "Later" };

export const IDEAS: VisionIdea[] = [
  {
    id: "doorway",
    name: "First-Mile Doorway",
    stage: "now",
    origin: "yours",
    value: 0.9,
    effort: 0.2,
    start: true,
    what: "Your kickoffs already take sign-ups without the app. This makes every weekly walk work that way: a QR poster, one page, a check-in, and the app only if they want it.",
    moment: "Scan at the library, tap “I'm coming”, get a reminder Friday.",
    money: "More first-timers show up — and first-timers are what partners pay for.",
    careful: "Just a first name and a way to remind them, deleted after the season unless they join.",
  },
  {
    id: "copilot",
    name: "The Lead's Co-Pilot",
    stage: "now",
    origin: "new",
    value: 0.77,
    effort: 0.37,
    start: true,
    what: "“What am I missing?” for one walk: back walker, water, a heat plan, access details — with a message drafted for the Lead to send.",
    moment: "A volunteer cancels on Thursday; the co-pilot offers three fixes.",
    money: "Part of a paid program kit for organizations, later.",
    careful: "It drafts; the Lead decides. It reads only that walk's details, never anyone's health.",
  },
  {
    id: "fit",
    name: "Walks That Fit You",
    stage: "now",
    origin: "new",
    value: 0.86,
    effort: 0.55,
    start: true,
    what: "Say what you need — step-free, shade, somewhere to rest — and see which walk fits, and why.",
    moment: "Tap “shade” and watch the recommendation change.",
    money: "Partners who care about access: parks, libraries, universities.",
    careful: "A route is never called accessible unless a City Lead checked it.",
  },
  {
    id: "fellowship",
    name: "City Lead Fellowship",
    stage: "now",
    origin: "yours",
    value: 0.68,
    effort: 0.29,
    what: "Kayla hand-picks City Leads today. This adds a way to raise your hand, three short lessons, a co-led walk, and a Lead who mentors the next city.",
    moment: "Apply, learn, co-lead, then lead.",
    money: "A partner can fund it, the way brands fund leaders' training elsewhere.",
    careful: "Kayla keeps the final pick. Small stipends need simple agreements and insurance.",
  },
  {
    id: "relay",
    name: "The Year 10 Relay",
    stage: "now",
    origin: "new",
    value: 0.64,
    effort: 0.5,
    what: "Opening day passes a baton of light from city to city, Chicago to Los Angeles. Each city adds one moment.",
    moment: "The baton crossing the map at the end of the story above.",
    money: "A title partner for opening day.",
    careful: "Stories and photos only with permission. Never a race between cities.",
  },
  {
    id: "september",
    name: "A Note to Your September Self",
    stage: "now",
    origin: "yours",
    value: 0.41,
    effort: 0.15,
    what: "You already share a season recap. This adds a private note, written on your first walk, that opens on September 1.",
    moment: "Write it in a minute in May; open it at the finish.",
    money: "None needed — it brings people back.",
    careful: "Private by default. Nobody reads it unless you share it.",
  },
  {
    id: "art",
    name: "Movement as Art",
    stage: "now",
    origin: "new",
    value: 0.42,
    effort: 0.38,
    what: "Every check-in adds one thread of light to a shared artwork: the summer, drawn by everyone who moved.",
    moment: "At the finale the piece is finished, and everyone's in it — no names.",
    money: "A partner's moment at a kickoff or finale, later in real life.",
    careful: "Anonymous threads only. A real installation needs permits and an accessibility review.",
  },
  {
    id: "living",
    name: "The Living City",
    stage: "now",
    origin: "new",
    value: 0.58,
    effort: 0.62,
    what: "One map where walks, circles and funded programs show up as light.",
    moment: "Fund two walks and watch the city change.",
    money: "A picture partners remember, next to the season report.",
    careful: "Walks and programs only — never anyone's location.",
  },
  {
    id: "people",
    name: "Find Your People",
    stage: "next",
    origin: "yours",
    value: 0.76,
    effort: 0.66,
    what: "Your City Leads already connect newcomers. This points each person to the right group: a beginner walk, a back walker, a Lead who needs a hand.",
    moment: "Three different people, three right walks — and the reason for each.",
    money: "It's why people stay, and people staying is the business.",
    careful: "Approved groups and walks only. No stranger matching, no location sharing.",
  },
  {
    id: "programs",
    name: "Programs for Any Organization",
    stage: "next",
    origin: "yours",
    value: 0.82,
    effort: 0.79,
    start: true,
    what: "Company teams are your Year 10 goal. The same setup can run a six-week program for a campus or an employer, under their name.",
    moment: "Pick an employer, set six weeks, and the pages and organizer view build themselves.",
    money: "Program fees, about $1–$1.67 per employee a month, or a season fee.",
    careful: "Each organization sees only its own people. Never promise health savings.",
  },
  {
    id: "trails",
    name: "Story Trails",
    stage: "next",
    origin: "new",
    value: 0.46,
    effort: 0.71,
    what: "A walk that tells a city's story — art, history, neighborhoods — stop by stop, at your pace.",
    moment: "“The Stories of Chicago”: the city on foot, where it all began.",
    money: "Museums, tourism boards and cultural partners.",
    careful: "Public routes, stops checked by a Lead, stories shared only with permission.",
  },
  {
    id: "fixes",
    name: "Neighborhood Fixes",
    stage: "next",
    origin: "new",
    value: 0.63,
    effort: 0.88,
    what: "Members point out what makes a walk hard — no shade, nowhere to sit — and vote part of the giving fund to fix it, with a matched grant.",
    moment: "Route A gets shade and benches, and more people can join.",
    money: "Community grants and civic partners.",
    careful: "Reports stay voluntary and anonymous. Never location tracking.",
  },
  {
    id: "calendar",
    name: "One Calendar for Every Walk",
    stage: "later",
    origin: "new",
    value: 0.38,
    effort: 0.84,
    what: "Publish every walk in an open format, so libraries, campuses and city calendars can list it.",
    moment: "One walk, listed in three places, always up to date.",
    money: "Reach, without owning anyone's data.",
    careful: "Walks only — never anyone's activity.",
  },
  {
    id: "passport",
    name: "Your Movement Passport",
    stage: "later",
    origin: "yours",
    value: 0.24,
    effort: 0.58,
    what: "Your badges, grown into a record of walks joined, led and volunteered — yours to keep and share.",
    moment: "Share one Lead badge; keep the rest private.",
    money: "None needed.",
    careful: "No public ledger, no score.",
  },
  {
    id: "care",
    name: "Community Doorway",
    stage: "later",
    origin: "new",
    value: 0.26,
    effort: 0.76,
    what: "Libraries and community centers share a beginner walk link with people who'd like company.",
    moment: "A coordinator shares one link; the visitor decides.",
    money: "Funded outreach programs, later.",
    careful: "Not medical: no referrals, no records, no health claims.",
  },
];
