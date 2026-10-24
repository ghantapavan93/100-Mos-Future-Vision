// The roadmap Kayla and Kirk see on the Roadmap screen: what 100 Miles of Summer
// already has, quick fixes (today's numbers first, then the website), the six
// steps to Year 10 with dates, what comes once Year 10 is steady, and what
// waits for later. "Ready now" is what the real app and site have today (App
// Store listing, website, the app itself); "Year 10" follows a six-step build
// plan (M0–M5); everything else
// is a plan to discuss. `tryHref` marks the items this demo lets you try.

export type Column = "ready" | "fixes" | "launch" | "next" | "later";

export interface ColumnDef {
  id: Column;
  label: string;
  /** When, in plain words. */
  when: string;
  color: string;
}

export const COLUMNS: ColumnDef[] = [
  { id: "ready", label: "Ready now", when: "In your app and on your site today", color: "#5fd3a2" },
  { id: "fixes", label: "Quick fixes", when: "Now → Nov 20 · today's numbers first, then the website", color: "#ffc14d" },
  { id: "launch", label: "Year 10", when: "Six steps to May 1, 2027", color: "#ff9a4d" },
  { id: "next", label: "Next up", when: "Summer 2027, once Year 10 is steady", color: "#ff6a13" },
  { id: "later", label: "Later", when: "2028 and beyond", color: "#b8b0ff" },
];

/** Roughly how big, in Kirk's sizes. */
export type Size = "S" | "S–M" | "M" | "M–L" | "L";

export const SIZE_WORDS: Record<Size, string> = {
  S: "Small · days",
  "S–M": "Small to medium",
  M: "Medium · a week or two",
  "M–L": "Medium to large",
  L: "Large · a few weeks",
};

export interface RoadmapItem {
  id: string;
  column: Column;
  title: string;
  /** One plain line. */
  line: string;
  /** A heading the item sits under inside its list ("In the app", "On the website"). */
  group?: string;
  /** For the Year 10 steps: which step, and when it runs. */
  step?: number;
  when?: string;
  /** For the Year 10 steps: the finish line anyone can check. */
  doneWhen?: string;
  size?: Size;
  /** The screen in this demo where you can try it. */
  tryHref?: string;
  /** The feature in src/blueprint/features.ts it draws on. */
  featureId?: string;
  /** Set when the item truly waits on Kayla's decision. */
  needsKayla?: string;
  /** Kayla's own announced goal, which the plan supports rather than proposes. */
  herGoal?: boolean;
  /** The sheet's small line above the title, when the item isn't a numbered step. */
  kicker?: string;
}

export const ROADMAP: RoadmapItem[] = [
  // Ready now: the real app and the real movement.
  { id: "ios-app", column: "ready", title: "The iPhone app", line: "Free on the App Store. Log miles and watch your summer add up to 100.", tryHref: "/member", featureId: "season-progress" },
  { id: "health-sync", column: "ready", title: "Apple Health, Health Connect and Garmin", line: "Your phone reads Apple Health or Health Connect, and Garmin sends walks in. Connect late and miles from May 1 still count.", tryHref: "/xray", featureId: "ingest" },
  { id: "counted-once-app", column: "ready", title: "Counted once, from the same app", line: "The same walk from the same app can't be saved twice." },
  { id: "log-delete", column: "ready", title: "Add and delete walks", line: "Type a walk in with “+”, and fix a mistake.", tryHref: "/member" },
  { id: "leaderboard", column: "ready", title: "The leaderboard", line: "Who's logged the most miles this summer. Every pace counts." },
  { id: "badges", column: "ready", title: "Badges and the days-left ring", line: "Little wins on the way to 100 miles, and a ring that counts down the summer." },
  { id: "events-tab", column: "ready", title: "The Events tab", line: "Kickoffs and meetups, right in the app." },
  { id: "city-leads", column: "ready", title: "City Leads in 7 cities", line: "Chicago, Durham, Detroit, New York, Montreal, Charleston and LA host meetups.", tryHref: "/circles" },
  { id: "shop", column: "ready", title: "The shop", line: "The Summer 26 capsule, on the website and in the app's shop tab." },
  { id: "newsletter", column: "ready", title: "Newsletter and Substack", line: "Season news, and Kayla's Healthy Hustle letters." },

  // Quick fixes: tidy-ups first, then the website. Small, and worth doing before Year 10.
  { id: "leaderboard-fix", column: "fixes", group: "Tidy-ups first", title: "A fair check on the leaderboard", line: "As more apps connect, one odd walk could jump the leaderboard. A fair check holds it for a person to look at — nobody is accused.", size: "S", tryHref: "/xray" },
  { id: "sign-in-runs", column: "fixes", group: "Tidy-ups first", title: "Every run tied to its member", line: "Each run saves under the member's own sign-in, so every run belongs to the person who logged it. Lands with step 2, by Dec 18.", size: "M" },
  { id: "garmin-tuneup", column: "fixes", group: "Tidy-ups first", title: "Finish the Garmin tune-up", line: "The Garmin connection is nearly there. One small last step.", size: "S" },
  { id: "events-upcoming", column: "fixes", group: "Tidy-ups first", title: "Events tab leads with what's coming", line: "Upcoming walks first, then the ones you've already had.", size: "S", tryHref: "/circles" },
  { id: "android", column: "fixes", group: "Tidy-ups first", title: "The Android release", line: "The Health Connect work is already in. One check on a real Android phone, then the public listing.", size: "S" },
  { id: "together-total", column: "fixes", group: "Tidy-ups first", title: "A together total", line: "Show the season's shared total beside the leaderboard, so every mile feels part of one goal.", size: "S", tryHref: "/circles", featureId: "chapter-total", needsKayla: "Kayla decides: the leaderboard, a together total, or both." },
  { id: "all-cities", column: "fixes", group: "On the website", title: "All 7 cities on the website", line: "The City Leads page shows 4 of the 7 cities from Year 9.", size: "S" },
  { id: "typo", column: "fixes", group: "On the website", title: "One small typo", line: "The home page headline says “GET'S”. It should be “GETS”.", size: "S" },
  { id: "privacy", column: "fixes", group: "On the website", title: "A dated privacy page", line: "Add a date, and one line on what sponsors never get.", size: "S" },

  // Year 10: six steps to May 1, 2027 (M0–M5), and her own Year 10 goal.
  {
    id: "m0",
    column: "launch",
    step: 1,
    when: "Now → Nov 20",
    title: "A tidy start",
    line: "Tidy-ups already on the list: Garmin, upcoming events and the Android release.",
    doneWhen: "Garmin walks come only from Garmin. Upcoming walks lead the Events tab. Android is public.",
    size: "S–M",
    tryHref: "/xray",
    needsKayla: "Two calls: do workouts with no distance count? And the leaderboard, a together total, or both?",
  },
  {
    id: "m1",
    column: "launch",
    step: 2,
    when: "Nov 20 → Dec 18",
    title: "Sign-in, all the way through",
    line: "Sign-in reaches the database, tried on a test copy first, so every run belongs to the member who logged it.",
    doneWhen: "Every saved run belongs to a signed-in member. Three testers on iPhone and Android notice no change.",
    size: "M",
  },
  {
    id: "m2",
    column: "launch",
    step: 3,
    when: "Jan 4 → Feb 5",
    title: "One door for every mile",
    line: "Every app's walks pass one check: counted once — even from two apps — and anything faster than a person can go on foot or wheels, or over 60 miles in a day, waits for a quick look. Totals come from one place.",
    doneWhen: "Last summer's runs, replayed in the test copy, are explained to the row: how many repeats, set-asides and zeros.",
    size: "M–L",
    tryHref: "/xray",
    featureId: "ingest",
  },
  {
    id: "m3",
    column: "launch",
    step: 4,
    when: "Feb 8 → Mar 12",
    title: "Members feel it",
    line: "“Start your summer”, “Why is my total?”, miles that land on your own day, the together total, and a sharing switch.",
    doneWhen: "City Leads try it in the iPhone and Android betas.",
    size: "M",
    tryHref: "/member",
    featureId: "mile-zero",
    needsKayla: "Kayla OKs the welcome wording and the together-total words.",
  },
  {
    id: "m4",
    column: "launch",
    step: 5,
    when: "Mar 15 → Apr 16",
    title: "City Lead toolkit",
    line: "Your City Leads already post events and keep Eventbrite lists. This puts posting, an optional “I'm coming” and check-in in one place — and a check-in adds the group walk to members' miles. Every walk can have a back walker — the toolkit helps the Lead find one.",
    doneWhen: "All 7 City Leads post a test walk and check in a tester.",
    size: "M–L",
    tryHref: "/circles",
    featureId: "publish",
    needsKayla: "Which cities launch with the toolkit.",
  },
  {
    id: "m5",
    column: "launch",
    step: 6,
    when: "Apr 19 → May 1",
    title: "Launch rehearsal",
    line: "Code freeze around Apr 23, a practice run of the May 1 rush, and a plan if anything breaks. If they're signed off by then: the sponsor report — totals only, as your privacy policy already promises — and the coach's approved cards.",
    doneWhen: "Year 10 opens on May 1 with no hand fixes to totals.",
    size: "S–M",
    tryHref: "/coach",
    featureId: "coach",
    needsKayla: "Kayla approves the coach's cards, or the coach waits.",
  },
  {
    id: "pilot",
    column: "launch",
    title: "The pilot: six Saturdays, three cities",
    kicker: "Year 10 · the first proof",
    when: "Six Saturdays · your call when",
    line: "18 first walks in Chicago, Detroit and Los Angeles, each with a back walker and a sign-up that needs no app. It answers one question before Year 10 grows: do first-timers come back?",
    doneWhen: "Half or more of the first-timers are back by week 4, two in three sign-ups show up, and each pilot city has a sponsor who would renew.",
    size: "S–M",
    tryHref: "/future",
    needsKayla: "When it runs: six Saturdays before May 1, the first six weeks of Year 10, or a fall test in warm cities.",
  },
  {
    id: "teams",
    column: "launch",
    title: "Company teams",
    line: "Your Year 10 goal. To start, a company team is a sponsor package plus a team code at sign-up, and team totals come from the same miles. Team pages can wait.",
    size: "M",
    tryHref: "/future",
    featureId: "three-year",
    herGoal: true,
  },

  // Next up: once Year 10 is steady.
  { id: "high-fives", column: "next", title: "High fives", line: "Friends tap a high five on your miles. Every pace counts." },
  { id: "share-walk", column: "next", title: "Share My Walk", line: "Tell up to three people you're heading out, then tap “I'm home”. No map is shared." },
  { id: "summer-story", column: "next", title: "My Summer Story", line: "Builds on your season recap: a story of your own summer, every September 1." },
  { id: "founder-week", column: "next", title: "Kayla's week on one screen", line: "Money, cities and the few decisions that need you — from the same numbers as the plan.", tryHref: "/founder", featureId: "founder" },

  // Later: 2028 and beyond.
  { id: "fund-city", column: "later", title: "Fund a City", line: "Brands already host your city kickoffs. This makes it a package: one brand funds a city's whole summer — walks, water and shirts.", tryHref: "/partner", featureId: "partner-pipeline" },
  { id: "giving", column: "later", title: "Members choose the giving", line: "Part of sponsor money goes to programs members vote for — later, city by city.", tryHref: "/impact", featureId: "impact", needsKayla: "Kayla decides whether 100 Miles of Summer makes giving promises." },
  { id: "circle-box", column: "later", title: "Circle in a Box", line: "A ready kit for new cities: routes, a back walker, a first-walk script." },
  { id: "offline", column: "later", title: "Check-in without signal", line: "City Leads check people in even where the park has no signal.", featureId: "offline-checkin" },
  { id: "km-french", column: "later", title: "Kilometres and French", line: "For Montreal and new countries." },
  { id: "fall-szn", column: "later", title: "Fall szn", line: "You've teased it already. A short fall and a spring warm-up keep people close until May 1 — summer stays the main event." },
];
