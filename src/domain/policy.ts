// Purpose-based data rules. Every selector that shows data to someone other
// than its owner, hands it to the coach, or reports it to a partner asks
// `decide` first. Provider terms are architecture, not a checkbox: a member's
// consent can widen what OUR policy allows, but never what a provider forbids.
//
// Rule ids and paraphrases paraphrase each provider's published terms (read
// 2026-10-22). They are a demo's reading, not legal advice; rules marked
// "review" still have an open question.

import type { ActivitySource, Consents, CountableSource } from "./types";

export type DataClass =
  | `activity:${ActivitySource}`
  | "participation" // RSVPs and event check-ins as attendance facts
  | "contact-optin" // an email address a member chose to give one partner
  | "coach-input" // goals and questions a member typed to QUANTUM
  | "access-needs"; // needs a member listed (step-free, seating…) — disability-adjacent

export type Purpose =
  | "owner-view" // the member looking at their own data
  | "season-total" // the member's own progress toward 100 (a combination of sources)
  | "other-members" // story wall, team views
  | "chapter-total" // the chapter's shared-miles total
  | "organizer-roster" // an organizer seeing who RSVP'd
  | "ai-coaching" // context handed to QUANTUM
  | "partner-report" // aggregate campaign report to a paying partner
  | "partner-export" // individual-level records handed to a partner
  | "advertising"; // audience building or ad targeting

export const PURPOSES: readonly Purpose[] = [
  "owner-view",
  "season-total",
  "other-members",
  "chapter-total",
  "organizer-roster",
  "ai-coaching",
  "partner-report",
  "partner-export",
  "advertising",
];

export const PURPOSE_LABEL: Record<Purpose, string> = {
  "owner-view": "Your own view",
  "season-total": "Your season total",
  "other-members": "Other members",
  "chapter-total": "Chapter total",
  "organizer-roster": "Organizer roster",
  "ai-coaching": "QUANTUM coach",
  "partner-report": "Partner report (counts)",
  "partner-export": "Partner export (people)",
  advertising: "Advertising",
};

export type Basis = "provider-terms" | "platform-policy" | "law" | "our-policy";

export interface Rule {
  id: string;
  title: string;
  basis: Basis;
  source: string;
  url?: string;
  summary: string;
  /** high = explicit text; medium = reasonable reading; review = open legal question; ours = our product decision. */
  confidence: "high" | "medium" | "review" | "ours";
}

const STRAVA_POLICY = "https://www.strava.com/legal/api_policy";
const APPLE_GUIDELINES = "https://developer.apple.com/app-store/review/guidelines/";
const PLAY_HEALTH = "https://support.google.com/googleplay/android-developer/answer/9888170";
const GARMIN_AGREEMENT = "https://developerportal.garmin.com/sites/default/files/Garmin%20Connect%20Developer%20Program%20Agreement.pdf";

export const RULES: Record<string, Rule> = {
  "STRAVA-01": {
    id: "STRAVA-01",
    title: "Strava data is shown only to its owner",
    basis: "provider-terms",
    source: "Strava API Agreement + API Policy §2.3, §6.1 (effective June 1, 2026)",
    url: "https://www.strava.com/legal/api",
    summary: "A member's Strava data may be displayed only to that member. Not to other members, chapters, organizers, partners or staff consoles. Consent does not change this.",
    confidence: "high",
  },
  "STRAVA-02": {
    id: "STRAVA-02",
    title: "No Strava data to third parties, even with consent",
    basis: "provider-terms",
    source: "Strava API Policy §5.10, §6.2",
    url: STRAVA_POLICY,
    summary: "No transfer, sale or licence of Strava data to sponsors, advertisers, data brokers or AI providers, whatever the member agreed to.",
    confidence: "high",
  },
  "STRAVA-03": {
    id: "STRAVA-03",
    title: "No Strava data in any AI, including its prompt",
    basis: "provider-terms",
    source: "Strava API Policy §5.3",
    url: STRAVA_POLICY,
    summary: "Strava data and anything derived from it may not train, evaluate, ground or be placed in the context window of an AI feature.",
    confidence: "high",
  },
  "STRAVA-04": {
    id: "STRAVA-04",
    title: "No analytics on Strava data, and no combining it",
    basis: "provider-terms",
    source: "Strava API Policy §5.4",
    url: STRAVA_POLICY,
    summary: "No aggregation or analytics even when anonymised, and no combining Strava data with other data. We read this as: Strava miles cannot be summed into a season total. Open question D-2.",
    confidence: "review",
  },
  "STRAVA-05": {
    id: "STRAVA-05",
    title: "Strava data lives in a 7-day cache",
    basis: "provider-terms",
    source: "Strava API Policy §5.5, §6.2",
    url: STRAVA_POLICY,
    summary: "Strava records may be cached for at most 7 days and must then be purged; no other storage, index or archive.",
    confidence: "high",
  },
  "STRAVA-06": {
    id: "STRAVA-06",
    title: "Disconnecting Strava deletes Strava data",
    basis: "provider-terms",
    source: "Strava API Policy §2.5, §6.3",
    url: STRAVA_POLICY,
    summary: "On deauthorization the app deletes the member's Strava data (within 30 days) and confirms it. Deletions made on Strava show up within 48 hours.",
    confidence: "high",
  },
  "STRAVA-08": {
    id: "STRAVA-08",
    title: "No Strava data in advertising",
    basis: "provider-terms",
    source: "Strava API Policy §5.9, §5.12",
    url: STRAVA_POLICY,
    summary: "No targeted advertising built directly or indirectly on Strava data.",
    confidence: "high",
  },
  "APPLE-02": {
    id: "APPLE-02",
    title: "HealthKit data is never marketing data",
    basis: "platform-policy",
    source: "App Review Guidelines 5.1.2(vi), 5.1.3(i) (updated Oct 16, 2026); DPLA §3.3.3(H)",
    url: APPLE_GUIDELINES,
    summary: "No marketing, advertising or use-based data mining with HealthKit data, and no sharing it with ad platforms.",
    confidence: "high",
  },
  "APPLE-03": {
    id: "APPLE-03",
    title: "HealthKit data reaches a third party only to provide a health service",
    basis: "platform-policy",
    source: "DPLA §3.3.3(H)",
    summary: "A sponsor is not a health-service provider, so per-member HealthKit data never goes to one, consent or not.",
    confidence: "high",
  },
  "APPLE-04": {
    id: "APPLE-04",
    title: "AI use of HealthKit data needs explicit permission",
    basis: "platform-policy",
    source: "App Review Guidelines 5.1.2(i)",
    url: APPLE_GUIDELINES,
    summary: "Disclose and get explicit permission before personal data reaches an AI feature, including third-party AI.",
    confidence: "high",
  },
  "APPLE-09": {
    id: "APPLE-09",
    title: "Showing HealthKit data to other members needs opt-in",
    basis: "platform-policy",
    source: "DPLA §3.3.3(H), Guidelines 5.1.2(i) (interpretation)",
    summary: "We treat other members as recipients: HealthKit miles join a chapter total only with the member's opt-in for that source.",
    confidence: "medium",
  },
  "HC-02": {
    id: "HC-02",
    title: "Health Connect data is never for ads or eligibility",
    basis: "platform-policy",
    source: "Google Play Health Connect permissions policy, Limited Use",
    url: PLAY_HEALTH,
    summary: "No selling or transferring to ad platforms or brokers, no ads, and no use for credit, insurance or employment decisions.",
    confidence: "high",
  },
  "HC-04": {
    id: "HC-04",
    title: "Health Connect data is shared socially only with consent",
    basis: "platform-policy",
    source: "Google Play Health permissions guidance",
    summary: "Public display or social sharing of Health Connect data needs the member's explicit consent.",
    confidence: "high",
  },
  "HC-06": {
    id: "HC-06",
    title: "AI use of Health Connect data needs consent",
    basis: "platform-policy",
    source: "Google Play User Data policy (third-party AI)",
    summary: "AI features are bound by the same limited-use and consent rules as the app.",
    confidence: "high",
  },
  "GARMIN-01": {
    id: "GARMIN-01",
    title: "Garmin data is used within the member's consent",
    basis: "provider-terms",
    source: "Garmin Connect Developer Program Agreement §4.1, §15.4",
    url: GARMIN_AGREEMENT,
    summary: "Garmin data may be formatted and displayed consistent with the member's consent; community display needs an opt-in.",
    confidence: "medium",
  },
  "GARMIN-02": {
    id: "GARMIN-02",
    title: "No Garmin data to partners",
    basis: "provider-terms",
    source: "Garmin Connect Developer Program Agreement §5.2(e), §5.2(o)",
    url: GARMIN_AGREEMENT,
    summary: "No per-member Garmin data to sponsors, and no income from providing Garmin data without Garmin's written permission.",
    confidence: "high",
  },
  "GARMIN-04": {
    id: "GARMIN-04",
    title: "Garmin attribution travels with Garmin data",
    basis: "provider-terms",
    source: "Garmin API Brand Guidelines (v6.30.2025)",
    summary: "Any total or AI output materially influenced by Garmin data carries a 'Garmin [device]' attribution.",
    confidence: "high",
  },
  "GARMIN-05": {
    id: "GARMIN-05",
    title: "No competing-wearable ads inside a Garmin-connected app",
    basis: "provider-terms",
    source: "Garmin Connect Developer Program Agreement §5.2(t)",
    url: GARMIN_AGREEMENT,
    summary: "While Garmin is integrated, the app does not advertise products that compete with Garmin's.",
    confidence: "high",
  },
  "GARMIN-06": {
    id: "GARMIN-06",
    title: "AI use of Garmin data needs explicit consent",
    basis: "provider-terms",
    source: "Garmin Connect Developer Program Agreement §15.10 (China-entity version; applied conservatively)",
    summary: "Processing Garmin data with AI needs an AI transparency statement and explicit, withdrawable consent. Treated as required pending legal review.",
    confidence: "review",
  },
  "OURS-NEEDS-PRIVATE": {
    id: "OURS-NEEDS-PRIVATE",
    title: "Access needs stay with the member unless they share them",
    basis: "our-policy",
    source: "Future Lab product rule (cf. HC-05, WA-05)",
    summary: "Needs like step-free routes are disability-adjacent. An organizer sees them only if the member switched sharing on.",
    confidence: "ours",
  },
  "FTC-02": {
    id: "FTC-02",
    title: "An unauthorised disclosure is a breach",
    basis: "law",
    source: "FTC Health Breach Notification Rule, 16 CFR 318 (amended 2024)",
    url: "https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-318",
    summary: "Sharing health records without authorisation counts as a breach with notice duties. No override can authorise it.",
    confidence: "medium",
  },
  "WA-02": {
    id: "WA-02",
    title: "Sharing health data needs its own consent",
    basis: "law",
    source: "Washington My Health My Data Act, RCW 19.373.030",
    url: "https://app.leg.wa.gov/RCW/default.aspx?cite=19.373&full=true",
    summary: "Consent to share is separate from consent to collect, and terms of service never count as either.",
    confidence: "high",
  },
  "X-01": {
    id: "X-01",
    title: "Derived data inherits its sources' restrictions",
    basis: "our-policy",
    source: "Derived from Strava §5.3–5.5, Garmin brand guidelines, WA RCW 19.373.010",
    summary: "A total, summary or AI answer carries the union of the restrictions and attributions of everything it was built from.",
    confidence: "ours",
  },
  "X-02": {
    id: "X-02",
    title: "No laundering provider data into manual logs",
    basis: "our-policy",
    source: "Derived from the Strava API definition of Strava Data",
    summary: "A manual log is typed or confirmed by the member. The app never pre-fills one from a provider record.",
    confidence: "ours",
  },
  "X-04": {
    id: "X-04",
    title: "Every disclosure is written to the egress log",
    basis: "our-policy",
    source: "Derived from FTC HBNR §318.2 and WA RCW 19.373.040",
    summary: "Anything that leaves its owner records recipient, purpose, rules and source lineage. An export without a row cannot happen.",
    confidence: "ours",
  },
  "APPLE-06": {
    id: "APPLE-06",
    title: "Withdrawing HealthKit access removes HealthKit data",
    basis: "platform-policy",
    source: "App Review Guidelines 5.1.1, 5.1.3(i)",
    url: APPLE_GUIDELINES,
    summary: "Members can withdraw consent easily; on withdrawal the app deletes or locks the HealthKit-derived records it holds.",
    confidence: "high",
  },
  "OURS-DISCONNECT": {
    id: "OURS-DISCONNECT",
    title: "Disconnect means remove",
    basis: "our-policy",
    source: "Future Lab product rule",
    summary: "Disconnecting any source removes its records from every total, so a member never has to wonder what is still counted.",
    confidence: "ours",
  },
  "WELCOME-SWEEP": {
    id: "WELCOME-SWEEP",
    title: "No First Mile event without a sweep",
    basis: "our-policy",
    source: "Future Lab welcome standard (after community-run tail walkers)",
    summary: "An event is published only when a named volunteer will finish at the back, so nobody finishes alone.",
    confidence: "ours",
  },
  "COMMERCIAL-OVERRIDE": {
    id: "COMMERCIAL-OVERRIDE",
    title: "Losing contracts need a written reason",
    basis: "our-policy",
    source: "Future Lab commercial rule",
    summary: "A contract whose contribution is below zero can be signed only with a written founder override, kept on the record. Overrides never apply to data rules.",
    confidence: "ours",
  },
  "IMPACT-POOL": {
    id: "IMPACT-POOL",
    title: "Only signed money can be given",
    basis: "our-policy",
    source: "Future Lab impact rule",
    summary: "A program is funded only from impact money committed in signed contracts, never from proposals.",
    confidence: "ours",
  },
  "IMPACT-EVIDENCE": {
    id: "IMPACT-EVIDENCE",
    title: "Delivered means evidenced",
    basis: "our-policy",
    source: "Future Lab impact rule",
    summary: "A program is delivered only when a completed event in its chapters happened after funding, and verified only when at least 10 people attended.",
    confidence: "ours",
  },
  "RULESET-GATE": {
    id: "RULESET-GATE",
    title: "A coaching rule change must not regress",
    basis: "our-policy",
    source: "Future Lab release gate (after Backstop's regression contracts)",
    summary: "A new coaching ruleset activates only with content and engineering approval and zero regressions on the evaluation set.",
    confidence: "ours",
  },
  OWNER: {
    id: "OWNER",
    title: "You always see your own data",
    basis: "our-policy",
    source: "Future Lab product rule",
    summary: "Every record a member owns is visible to that member, with its source shown.",
    confidence: "ours",
  },
  "OURS-CONSENT": {
    id: "OURS-CONSENT",
    title: "Your miles go where you say, source by source",
    basis: "our-policy",
    source: "Future Lab product rule",
    summary: "First-party miles join a chapter total or reach the coach only while that source's switch is on.",
    confidence: "ours",
  },
  "OURS-NO-ADS": {
    id: "OURS-NO-ADS",
    title: "Movement data is never an advertising audience",
    basis: "our-policy",
    source: "Future Lab product rule",
    summary: "No activity, attendance or coaching record of any kind is used to target or build audiences for ads.",
    confidence: "ours",
  },
  "OURS-COUNTS-NOT-PEOPLE": {
    id: "OURS-COUNTS-NOT-PEOPLE",
    title: "Partners get counts, never people",
    basis: "our-policy",
    source: "Future Lab product rule",
    summary: "Partner reports contain aggregate attendance at the events they funded. No names, no per-person rows, no provider data.",
    confidence: "ours",
  },
  "OURS-SMALL-GROUPS": {
    id: "OURS-SMALL-GROUPS",
    title: "Groups under 10 are suppressed",
    basis: "our-policy",
    source: "Future Lab product rule (k-anonymity, cf. APPLE-07)",
    summary: "Any reported group smaller than 10 appears as 'fewer than 10' so no individual can be singled out.",
    confidence: "ours",
  },
  "OURS-ROSTER": {
    id: "OURS-ROSTER",
    title: "Organizers see who is coming, not how they move",
    basis: "our-policy",
    source: "Future Lab product rule (cf. HC-05, WA-05)",
    summary: "A roster shows first name, last initial and access needs the member chose to share. Never activity history.",
    confidence: "ours",
  },
  "OURS-OPTIN-CONTACT": {
    id: "OURS-OPTIN-CONTACT",
    title: "A partner gets an email only from the member's own opt-in",
    basis: "our-policy",
    source: "Future Lab product rule",
    summary: "Contact details reach a partner only through a member's explicit, separate opt-in for that partner.",
    confidence: "ours",
  },
  "OURS-NO-MOOD-INFERENCE": {
    id: "OURS-NO-MOOD-INFERENCE",
    title: "Inactivity is never read as a feeling",
    basis: "our-policy",
    source: "Future Lab product rule",
    summary: "Gaps in activity are never used to infer mood or mental health, and the coach does not raise them unless the member does.",
    confidence: "ours",
  },
};

export interface Decision {
  allow: boolean;
  /** The rule that decided. */
  ruleId: string;
  /** The consent switch that made this allowed, if any. */
  consent?: string;
  /** Attribution that must travel with the output (GARMIN-04). */
  attribution?: string;
}

const HEALTH_PLATFORM = new Set<ActivitySource>(["healthkit", "health_connect"]);

function healthRule(source: ActivitySource, apple: string, android: string): string {
  return source === "healthkit" ? apple : android;
}

/**
 * The single place that decides whether a class of data may be used for a
 * purpose. Provider terms are checked before consent, so consent can never
 * override a provider prohibition.
 */
export function decide(dataClass: DataClass, purpose: Purpose, consents?: Consents): Decision {
  if (dataClass.startsWith("activity:")) return decideActivity(dataClass.slice("activity:".length) as ActivitySource, purpose, consents);

  // Every non-activity class names every purpose; anything not listed is denied.
  if (dataClass === "participation") {
    switch (purpose) {
      case "owner-view":
      case "season-total":
        return allow("OWNER");
      case "chapter-total":
        return allow("OURS-CONSENT"); // counts of attendance, never who
      case "other-members":
        return consents?.storyWall ? allow("OURS-CONSENT", "wall") : deny("OURS-CONSENT");
      case "organizer-roster":
        return allow("OURS-ROSTER");
      case "ai-coaching":
        return consents?.coach.event_checkin ? allow("OURS-CONSENT", "coach:event_checkin") : deny("OURS-CONSENT");
      case "partner-report":
        return allow("OURS-COUNTS-NOT-PEOPLE");
      case "partner-export":
        return deny("OURS-COUNTS-NOT-PEOPLE");
      case "advertising":
        return deny("OURS-NO-ADS");
    }
  }

  if (dataClass === "contact-optin") {
    switch (purpose) {
      case "owner-view":
        return allow("OWNER");
      case "partner-export":
        // Per-partner opt-in is checked by the engine against consents.partnerContact.
        return consents && consents.partnerContact.length > 0 ? allow("OURS-OPTIN-CONTACT", "partner-contact") : deny("OURS-OPTIN-CONTACT");
      default:
        return deny("OURS-OPTIN-CONTACT");
    }
  }

  if (dataClass === "access-needs") {
    switch (purpose) {
      case "owner-view":
        return allow("OWNER");
      case "organizer-roster":
        return consents?.needsToOrganizers ? allow("OURS-NEEDS-PRIVATE", "needs") : deny("OURS-NEEDS-PRIVATE");
      default:
        return deny("OURS-NEEDS-PRIVATE");
    }
  }

  // coach-input: words a member typed to the coach. The deterministic coach is part of the
  // app; a third-party model would also need APPLE-04 / HC-06-style consent before seeing them.
  switch (purpose) {
    case "owner-view":
    case "ai-coaching":
      return allow("OWNER");
    case "advertising":
      return deny("OURS-NO-ADS");
    case "partner-report":
    case "partner-export":
      return deny("WA-02");
    default:
      return deny("OURS-CONSENT");
  }
}

function decideActivity(source: ActivitySource, purpose: Purpose, consents?: Consents): Decision {
  if (purpose === "owner-view") return allow("OWNER");

  if (source === "strava") {
    switch (purpose) {
      case "season-total":
      case "chapter-total":
        return deny("STRAVA-04");
      case "ai-coaching":
        return deny("STRAVA-03");
      case "partner-report":
      case "partner-export":
        return deny("STRAVA-02");
      case "advertising":
        return deny("STRAVA-08");
      default:
        return deny("STRAVA-01");
    }
  }

  if (purpose === "season-total") return allow("OWNER");
  if (purpose === "advertising") return deny(HEALTH_PLATFORM.has(source) ? healthRule(source, "APPLE-02", "HC-02") : "OURS-NO-ADS");
  if (purpose === "organizer-roster") return deny("OURS-ROSTER");

  if (purpose === "partner-export" || purpose === "partner-report") {
    if (HEALTH_PLATFORM.has(source)) return deny(healthRule(source, "APPLE-03", "HC-02"));
    if (source === "garmin") return deny("GARMIN-02");
    // First-party attendance at funded events is reportable as a count; nothing per person.
    if (source === "event_checkin" && purpose === "partner-report") return allow("OURS-COUNTS-NOT-PEOPLE");
    return deny("OURS-COUNTS-NOT-PEOPLE");
  }

  const countable = source as CountableSource;
  const attribution = source === "garmin" ? "Garmin" : undefined;

  if (purpose === "ai-coaching") {
    const rule = source === "healthkit" ? "APPLE-04" : source === "health_connect" ? "HC-06" : source === "garmin" ? "GARMIN-06" : "OURS-CONSENT";
    return consents?.coach[countable] ? allow(rule, `coach:${source}`, attribution) : deny(rule);
  }

  // chapter-total and other-members
  const rule = source === "healthkit" ? "APPLE-09" : source === "health_connect" ? "HC-04" : source === "garmin" ? "GARMIN-01" : "OURS-CONSENT";
  const granted = purpose === "chapter-total" ? consents?.chapter[countable] : consents?.storyWall && consents.chapter[countable];
  return granted ? allow(rule, `${purpose === "chapter-total" ? "chapter" : "wall"}:${source}`, attribution) : deny(rule);
}

function allow(ruleId: string, consent?: string, attribution?: string): Decision {
  const d: Decision = { allow: true, ruleId };
  if (consent) d.consent = consent;
  if (attribution) d.attribution = attribution;
  return d;
}

function deny(ruleId: string): Decision {
  return { allow: false, ruleId };
}

/** Group sizes below this are suppressed in anything a partner sees. */
export const MIN_REPORTABLE_GROUP = 10;

export function suppressSmall(n: number): number | "fewer than 10" {
  return n < MIN_REPORTABLE_GROUP ? "fewer than 10" : n;
}

export function ruleFor(id: string): Rule {
  const rule = RULES[id];
  if (!rule) throw new Error(`Unknown rule ${id}`);
  return rule;
}
