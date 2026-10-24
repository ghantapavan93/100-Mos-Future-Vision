// The only content QUANTUM may draw on. Three kinds, always labelled:
//  - public-guideline: paraphrases of published guidance, cited;
//  - proposed-rule / proposed-lesson: drafted by the Future Lab team, NOT
//    Kayla's words, each waiting for the named reviewer;
//  - resource: crisis and care lines.
// Nothing here is attributed to Kayla. An approved library of her own content
// does not exist yet; building it with her is a roadmap item, not a feature.

import type { RulesetVersion } from "../types";
import type { KnowledgeCard } from "./types";

const ALL: RulesetVersion[] = ["v1", "v2", "v3"];
const PAG = "U.S. HHS, Physical Activity Guidelines for Americans, 2nd ed. (2018)";
const PAG_URL = "https://odphp.health.gov/our-work/nutrition-physical-activity/physical-activity-guidelines/current-guidelines";

export const CARDS: KnowledgeCard[] = [
  {
    id: "pag-some",
    title: "Some activity is better than none",
    body: "Moving more and sitting less helps, and any amount of activity counts — there is no minimum you have to reach before it matters.",
    status: "public-guideline",
    source: PAG,
    url: PAG_URL,
    needsReviewBy: null,
    rulesets: ALL,
  },
  {
    id: "pag-weekly",
    title: "The weekly picture for adults",
    body: "Adults get substantial benefit from about 150 to 300 minutes a week of moderate activity, like brisk walking, spread across the week.",
    status: "public-guideline",
    source: PAG,
    url: PAG_URL,
    needsReviewBy: null,
    rulesets: ALL,
  },
  {
    id: "pag-gradual",
    title: "Build up gradually",
    body: "Start small — a short walk today — and add a little more each week.",
    status: "public-guideline",
    source: PAG,
    url: PAG_URL,
    needsReviewBy: null,
    rulesets: ALL,
  },
  {
    id: "screen-symptoms",
    title: "Symptoms that mean stop and get care",
    body: "Chest pain or pressure, fainting, severe shortness of breath, or dizziness during activity are reasons to stop and get medical care — not to push through.",
    status: "public-guideline",
    source: "ACSM pre-participation screening recommendations (Riebe et al., Med Sci Sports Exerc, 2015)",
    needsReviewBy: null,
    rulesets: ALL,
  },
  {
    id: "heat",
    title: "Moving on hot days",
    body: "In summer heat, move early or late in the day, drink water before you're thirsty, and stop if you feel dizzy, confused, nauseated or stop sweating.",
    status: "public-guideline",
    source: "CDC Heat and Health guidance",
    url: "https://www.cdc.gov/heat-health/",
    needsReviewBy: null,
    rulesets: ["v2"],
  },
  {
    id: "lifeline",
    title: "988 Suicide & Crisis Lifeline",
    body: "If you're thinking about suicide or are in crisis, call or text 988 in the U.S., any time, to reach a trained counselor. If you're in immediate danger, call 911.",
    status: "resource",
    source: "988 Suicide & Crisis Lifeline",
    url: "https://988lifeline.org/",
    needsReviewBy: null,
    rulesets: ALL,
  },
  {
    id: "care",
    title: "Who to talk to about pain and health questions",
    body: "Pain that changes how you move, or questions about a health condition, medication or food, belong with a doctor, physical therapist or registered dietitian.",
    status: "resource",
    source: "Future Lab safety routing (no clinical content)",
    needsReviewBy: "Clinical reviewer",
    rulesets: ALL,
  },
  {
    id: "lesson-start",
    title: "Start where you are",
    body: "One mile is a whole goal. Walking counts, rolling counts, stopping to rest counts. Your 100 can be one comfortable mile at a time.",
    status: "proposed-lesson",
    source: "Drafted by the Future Lab team in the spirit of 100MoS's public 'start where you're at' theme. Not Kayla's words.",
    needsReviewBy: "Kayla Jeter",
    rulesets: ALL,
  },
  {
    id: "lesson-grace",
    title: "A missed stretch doesn't erase anything",
    body: "Every mile you've already moved still counts. Coming back is the skill — and a gentle restart beats trying to catch up.",
    status: "proposed-lesson",
    source: "Drafted by the Future Lab team in the spirit of 100MoS's public 'grace, not all-or-nothing' theme. Not Kayla's words.",
    needsReviewBy: "Kayla Jeter",
    rulesets: ALL,
  },
  {
    id: "lesson-pace",
    title: "Every pace counts the same",
    body: "Here, a 25-minute mile and an 8-minute mile move the bar the same distance. Every pace counts.",
    status: "proposed-lesson",
    source: "Drafted by the Future Lab team from 100MoS's public 'every body and every pace' message. Not Kayla's words.",
    needsReviewBy: "Kayla Jeter",
    rulesets: ALL,
  },
  {
    id: "lesson-together",
    title: "Find your people",
    body: "First Mile walks are built for newcomers: a short option, a meeting point, and a sweep who finishes at the back with whoever is last.",
    status: "proposed-lesson",
    source: "Drafted by the Future Lab team; the sweep role mirrors volunteer 'tail walkers' at community runs. Not Kayla's words.",
    needsReviewBy: "Kayla Jeter",
    rulesets: ALL,
  },
  {
    id: "lesson-rest",
    title: "Rest days count",
    body: "Recovery is part of the plan, not a break from it. A rest day logged is a day you kept your promise to yourself.",
    status: "proposed-lesson",
    source: "Drafted by the Future Lab team in the spirit of 100MoS's public recovery theme. Not Kayla's words.",
    needsReviewBy: "Kayla Jeter",
    rulesets: ALL,
  },
  {
    id: "rule-race-ladder",
    title: "Race paths, one rung at a time",
    body: "5K is open to everyone. A 10K usually follows a 5K; a half follows a 10K and about 12 weeks of steady running; a first marathon follows a half and roughly 16 or more weeks of preparation with a qualified coach.",
    status: "proposed-rule",
    source: "Future Lab program rule v1/v2, written from common published beginner plans. Not a medical guideline.",
    needsReviewBy: "Certified running coach",
    rulesets: ["v1", "v2"],
  },
  {
    id: "rule-race-fast",
    title: "Race paths, accelerated",
    body: "Any finisher of 100 miles can take on a marathon with an 8-week plan.",
    status: "proposed-rule",
    source: "Future Lab program rule v3 — an aggressive draft kept to show the release gate refusing it.",
    needsReviewBy: "Certified running coach",
    rulesets: ["v3"],
  },
];

export const CARD: Record<string, KnowledgeCard> = Object.fromEntries(CARDS.map((c) => [c.id, c]));

export function cardsFor(ruleset: RulesetVersion): KnowledgeCard[] {
  return CARDS.filter((c) => c.rulesets.includes(ruleset));
}

export const RULESET_NOTES: Record<RulesetVersion, string> = {
  v1: "Baseline. Race ladder, gradual build-up, no heat guidance. Symptom and crisis routing is a floor shared by every version, not a v1 feature.",
  v2: "Adds summer-heat guidance paraphrased from the CDC with a save-for-later step. Same safety floor as v1.",
  v3: "Aggressive draft: lets a 100-mile finisher attempt a marathon in 8 weeks. Exists to prove the gate refuses unsafe rules and unsafe cards.",
};
