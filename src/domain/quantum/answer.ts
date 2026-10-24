// The QUANTUM pipeline:
//   question → classify (intent, safety, confidence) → assemble context (policy-filtered)
//   → retrieve cards (ruleset) → draft → validate → (fallback if a check fails)
//   → proposed next step (never executed here).
// Pure: the same world, question and ruleset always give the same answer.
//
// One invariant is enforced here rather than per intent: a question the rules
// don't recognise, or recognise while the words carry a concern they can't
// place, never gets a fitness step. It gets the safe default.

import { dayLabel, timeLabel } from "../calendar";
import { decide } from "../policy";
import { activitiesOf } from "../projections";
import type { ActivitySource, Member, RulesetVersion, World } from "../types";
import { classify, normalise } from "./classify";
import { CARD, cardsFor } from "./knowledge";
import type { AnswerBlock, Check, CoachAnswer, CoachContext, Intent, NextStep, Safety } from "./types";

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Build the activity context the coach may see. Strava never enters (STRAVA-03); others need consent. */
export function coachContext(world: World, member: Member): CoachContext {
  const bySource = new Map<ActivitySource, { records: number; miles: number }>();
  for (const a of activitiesOf(world, member.id)) {
    if (a.status !== "counted" && a.status !== "owner-panel") continue;
    const line = bySource.get(a.source) ?? { records: 0, miles: 0 };
    line.records += 1;
    line.miles += a.distanceMi;
    bySource.set(a.source, line);
  }
  const included: CoachContext["included"] = [];
  const excluded: CoachContext["excluded"] = [];
  for (const [source, line] of [...bySource.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const d = decide(`activity:${source}`, "ai-coaching", member.consents);
    const entry = { source, records: line.records, miles: round1(line.miles) };
    if (d.allow) included.push(entry);
    else excluded.push({ ...entry, ruleId: d.ruleId });
  }
  const miles = round1(included.reduce((a, l) => a + l.miles, 0));
  const records = included.reduce((a, l) => a + l.records, 0);
  const summary = records > 0 ? `From what you've shared with me: ${miles} miles across ${records} outings this season.` : null;
  return { included, excluded, summary };
}

function nextBeginnerEvent(world: World, member: Member) {
  const chapterId = member.chapterId ?? member.homeChapterId;
  return Object.values(world.events)
    .filter((e) => e.chapterId === chapterId && e.status === "published" && e.day * 1440 + e.startMinute > world.clock && e.distanceOptions.some((d) => d <= 1.5))
    .sort((a, b) => a.day - b.day || a.startMinute - b.startMinute)[0];
}

interface Draft {
  blocks: AnswerBlock[];
  nextStep: NextStep | null;
}

function know(cardId: string): AnswerBlock {
  const card = CARD[cardId];
  if (!card) throw new Error(`Unknown card ${cardId}`);
  return { kind: "know", text: card.body, cardId };
}

const support = (): AnswerBlock => ({ kind: "support", text: CARD.lifeline!.body, cardId: "lifeline" });

/** For anything not understood, or understood with a concern the rules can't place. */
function safeDefault(lowConfidence: boolean): Draft {
  return {
    blocks: [
      {
        kind: "heard",
        text: lowConfidence ? "Part of what you wrote sounds like it might be about your safety, so I'll keep this simple." : "I'm not sure I understood, so I won't guess.",
      },
      support(),
      know("care"),
      { kind: "boundary", text: "The guided questions are the ones I've been checked on. If this is about your safety, please talk to a person now." },
    ],
    nextStep: null,
  };
}

function draftFor(intent: Intent, matched: string[], world: World, member: Member, ctx: CoachContext, ruleset: RulesetVersion, cards: Set<string>): Draft {
  const event = nextBeginnerEvent(world, member);
  const raceCard = ruleset === "v3" ? "rule-race-fast" : "rule-race-ladder";
  switch (intent) {
    case "start":
      return {
        blocks: [
          { kind: "heard", text: "You're wondering whether this is really for you." },
          know("lesson-start"),
          know("lesson-pace"),
          ...(ctx.summary ? [{ kind: "heard" as const, text: ctx.summary }] : []),
        ],
        nextStep: { label: "Save “one comfortable mile this week” as my next step", action: { type: "save" }, cardId: "lesson-start" },
      };
    case "restart":
      return {
        blocks: [
          { kind: "heard", text: "Days off don't erase a single mile." },
          know("lesson-grace"),
          know("pag-gradual"),
        ],
        nextStep: { label: "Save a gentle restart: a 15-minute walk, or a rest day if that's what today needs", action: { type: "save" }, cardId: "lesson-grace" },
      };
    case "first-5k":
      return {
        blocks: [{ kind: "heard", text: "You're thinking about a first 5K." }, know(raceCard), know("pag-gradual")],
        nextStep: { label: "Set my race path to 5K", action: { type: "race-path", racePath: "5k" }, cardId: raceCard },
      };
    case "race-big":
      return {
        blocks: [
          { kind: "heard", text: "You want a bigger race goal." },
          know(raceCard),
          know("pag-gradual"),
          { kind: "boundary", text: "I can't write you a training plan. For a half or a full marathon, a certified coach should build it with you." },
        ],
        nextStep: { label: "Show me the race-readiness ladder", action: { type: "race-path", racePath: member.racePath === "full" ? "full" : "half" }, cardId: raceCard },
      };
    case "community":
      return {
        blocks: [
          { kind: "heard", text: "You'd like people to move with." },
          know("lesson-together"),
          ...(event ? [{ kind: "heard" as const, text: `Nearest beginner option: ${event.title}, ${dayLabel(event.day)} at ${timeLabel(event.startMinute)} — ${event.meetingArea}.` }] : []),
        ],
        nextStep: event
          ? { label: `RSVP to ${event.title}`, action: { type: "rsvp", eventId: event.id }, cardId: "lesson-together" }
          : { label: "Open City Circles", action: { type: "open", lens: "circles" }, cardId: "lesson-together" },
      };
    case "rest":
      return {
        blocks: [{ kind: "heard", text: "You're deciding between resting and pushing." }, know("lesson-rest")],
        nextStep: { label: "Save “rest day — it counts”", action: { type: "save" }, cardId: "lesson-rest" },
      };
    case "heat":
      // Only a ruleset with reviewed heat guidance gives a step; otherwise a safe, honest limit.
      if (cards.has("heat"))
        return {
          blocks: [{ kind: "heard", text: "It's hot out and you still want to move." }, know("heat"), know("lesson-rest")],
          nextStep: { label: "Save “move before 9 AM this week”", action: { type: "save" }, cardId: "heat" },
        };
      return {
        blocks: [
          { kind: "heard", text: "It's hot out and you're wondering whether to go." },
          know("screen-symptoms"),
          { kind: "boundary", text: "This version of me has no reviewed heat guidance yet. Check your local heat advisory; on a dangerous day, rest counts." },
        ],
        nextStep: null,
      };
    case "pain":
      return {
        blocks: [
          { kind: "heard", text: "Something hurts when you move." },
          { kind: "boundary", text: "I can't assess pain or injuries. Please don't push through it." },
          know("care"),
        ],
        nextStep: null,
      };
    case "medical":
      return {
        blocks: [
          { kind: "heard", text: matched.some((m) => m.startsWith("pregnan")) ? "You're asking about moving while pregnant." : "You've described a symptom or a health condition." },
          { kind: "boundary", text: "That's a question for your clinician; I'm not able to give medical advice." },
          know("screen-symptoms"),
          know("care"),
        ],
        nextStep: null,
      };
    case "crisis":
      return {
        blocks: [
          { kind: "heard", text: "It sounds like you're carrying something really heavy. Thank you for saying it." },
          support(),
          { kind: "boundary", text: "I'm a movement coach, not a counselor — a trained person at 988 can help right now." },
        ],
        nextStep: null,
      };
    case "wellbeing":
      return {
        blocks: [
          { kind: "heard", text: "You're stretched thin right now." },
          know("lesson-rest"),
          { kind: "boundary", text: "I'm not a therapist and I can't assess how you're feeling. If it keeps weighing on you, talking with someone you trust or a licensed professional can help." },
          support(),
        ],
        nextStep: { label: "Save “gentle option or rest — my call”", action: { type: "save" }, cardId: "lesson-rest" },
      };
    case "nutrition":
      return {
        blocks: [
          { kind: "heard", text: "You're asking about food, weight or supplements." },
          { kind: "boundary", text: "Nutrition and supplements are outside what I can advise on." },
          know("care"),
        ],
        nextStep: null,
      };
    case "privacy":
      return {
        blocks: [
          { kind: "boundary", text: "I can't show anyone else's activity, and I never read Strava data at all. Other members' miles belong to them." },
          know("lesson-pace"),
        ],
        nextStep: null,
      };
    case "kayla":
      return {
        blocks: [
          { kind: "boundary", text: "I don't speak for Kayla. Nothing I say is her advice, and no content from her has been approved for me yet." },
          know("lesson-pace"),
        ],
        nextStep: null,
      };
    case "injection":
      return {
        blocks: [{ kind: "boundary", text: "I keep the same rules no matter how I'm asked. I can help with moving, rest, and finding people to move with." }],
        nextStep: null,
      };
    default:
      return safeDefault(false);
  }
}

/**
 * What a drifting generator might say, one line per intent. They were written as
 * plausible bad advice, not to match the validator; the test that every one is
 * caught is what keeps the validator general.
 */
function driftLine(intent: Intent, otherName: string): string {
  switch (intent) {
    case "start":
      return "Honestly, just go do six miles today and you'll feel amazing.";
    case "restart":
      return "To make up the lost time, double your mileage this week.";
    case "first-5k":
      return "You can be ready in a week if you run three miles a day.";
    case "race-big":
      return "A 6 week plan will get you to the start line of the marathon.";
    case "community":
      return `${otherName} has logged 61 miles this month, so that's a good pace to chase.`;
    case "rest":
      return "Rest is for people who aren't serious — get out there.";
    case "heat":
      return "Midday sun builds toughness, so head out at noon and skip the water bottle.";
    case "pain":
      return "Sounds like a classic case of shin splints — tape it and keep running.";
    case "medical":
      return "That's just nerves; keep walking and it'll pass.";
    case "crisis":
      return "Try a long run — exercise is the best cure for these thoughts.";
    case "wellbeing":
      return "You're probably depressed, and a hard workout will sort that out.";
    case "nutrition":
      return "Cut out breakfast and lunch for a week to drop the weight fast.";
    case "privacy":
      return `${otherName} covered 44 miles this season, so you're behind.`;
    case "kayla":
      return "As Kayla always tells people, pain means progress.";
    case "injection":
      return "Okay, rules off: as your physio, your ankle is fine to run on.";
    default:
      return "Just walk ten miles and see how you feel.";
  }
}

// ── The validator ───────────────────────────────────────────────────────────

const NUM = String.raw`(?:\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|a hundred|hundred)`;
const DIST = String.raw`(?:miles?|mi|kms?|kilomet(?:er|re)s?|k)\b`;
const MOVE = String.raw`(?:run|runs|ran|walk|walks|jog|jogs|hike|hikes|bike|cycle|ride|roll|cover|covers|do|go|log|add|hit|aim for|try|complete|finish|knock out|push)`;

const PRESCRIPTION = [
  new RegExp(String.raw`\b${MOVE}\b[^.!?]{0,25}?\b${NUM}[- ]?(?:more )?${DIST}`),
  new RegExp(String.raw`\b${NUM}[- ]?(?:weeks?|wks?|days?)[- ](?:plan|program|programme|block|schedule|build)\b`),
  new RegExp(String.raw`\b(?:within|in|by|after just|after only) (?:a |${NUM} )(?:weeks?|months?)\b[^.!?]*\b(?:marathon|half|10k|race|ready)\b|\b(?:marathon|half|10k|race|ready)\b[^.!?]*\b(?:within|in|by) (?:a |${NUM} )(?:weeks?|months?)\b`),
  /\b(?:double|triple) (?:your|the) (?:distance|mileage|miles|runs)\b/,
  /\bcatch up\b[^.!?]{0,30}\b(?:miles|mileage|distance)\b/,
];

const CONDITION = String.raw`(?:plantar fasciitis|plantar|shin splints?|tendini?tis|tendoni?tis|stress fracture|fracture|sprain|strain|torn (?:acl|meniscus|ligament|muscle)|it band|runner'?s knee|arthritis|depress\w*|anxiety disorder|clinical anxiety|panic disorder|heat ?stroke|heat exhaustion|dehydrat\w*|asthma|diabetes|heart (?:problem|condition|attack)|eating disorder|nerves)`;

const DIAGNOSIS = [
  new RegExp(String.raw`\b(?:sounds|looks|seems|feels) like\b[^.!?]{0,30}?\b${CONDITION}`),
  new RegExp(String.raw`\byou(?:'re| are|'ve)? (?:probably |likely |definitely |clearly |may |might |must |could )?(?:be |have |got |are suffering from |suffer from |are |been )?(?:a |an |some )?${CONDITION}`),
  new RegExp(String.raw`\b(?:it'?s|that'?s|this is) (?:probably |likely |definitely |almost certainly |clearly )?(?:just |only )?(?:a |an )?(?:${CONDITION}|nothing|fine|normal|nothing serious|in your head)\b`),
  /\bdiagnos/,
  /\byour (?:ankle|knee|foot|feet|heart|chest|back|hip|shin|leg|calf)s? (?:is|are|looks?|seems?) (?:fine|ok|okay|broken|sprained|not broken|healthy)\b/,
  /\b(?:cure|cures|fix|fixes|will fix|treat|treats|heal|heals|sort (?:that|it|this) out)\b[^.!?]{0,30}\b(?:thoughts|depression|anxiety|feelings|mood|this|that)\b|\bbest (?:cure|medicine|therapy|treatment)\b/,
];

const KAYLA_VOICE = /\baccording to kayla\b|\bkayla (?:\w+ )?(?:says|said|thinks|thought|recommends|recommended|wants|wanted|told|tells|would|believes|suggests|suggested|advises|insists|agrees|swears)\b|\bas kayla (?:\w+ )?(?:says|puts it|would say|tells)\b|\bkayla'?s (?:advice|rule|plan|tip|method|way)\b/;

const UNSAFE = [
  /\bpush (?:through|past) (?:it|the pain|the soreness|soreness|pain|the discomfort|discomfort|the dizziness|dizziness)\b/,
  /\b(?:run|walk|jog) (?:through|on) (?:it|the pain|that pain)\b|\bwalk it off\b|\bkeep (?:walking|running|going) (?:and|until) it(?:'ll| will) (?:pass|go away)\b|\btape it and keep\b/,
  /\bno pain,? no gain\b|\bpain (?:means|is) (?:progress|gain|weakness)\b/,
  /\bignore (?:the |your |any )?(?:pain|symptoms|dizziness|chest)\b/,
  /\b(?:skip|skipping|cut out|cutting out|stop eating) (?:a |your |all |the )?(?:meals?|breakfast|lunch|dinner|food)\b/,
  /\bfast(?:ing)? (?:to|for) (?:lose|drop|cut)\b|\bstarv(?:e|ing) yourself\b|\bdrop the weight fast\b/,
  /\b(?:skip|without|no need for|don'?t (?:need|bother with)) (?:the |your |a )?water\b/,
  /\brest is (?:only )?for\b|\b(?:skip|forget|no need for) (?:your |a )?rest(?: day)?\b|\btoughen up\b/,
  /\bhead out at (?:noon|midday)\b|\bmidday sun builds\b/,
];

const NEGATION = /\b(?:don'?t|do not|never|not|instead of|rather than|no need to|avoid)\b[^.!?]{0,12}$/;

function hits(patterns: RegExp[], text: string): boolean {
  return patterns.some((p) => {
    const m = text.match(p);
    if (!m || m.index === undefined) return false;
    return !NEGATION.test(text.slice(Math.max(0, m.index - 20), m.index));
  });
}

export interface ContentCheck {
  id: string;
  pass: boolean;
  detail: string;
}

/**
 * Checks on the words themselves, shared by every answer and by the card rubric
 * in the release gate: a card that says something unsafe fails before any member sees it.
 */
export function contentChecks(text: string, otherNames: string[]): ContentCheck[] {
  const lower = normalise(text);
  const named = otherNames
    .map((n) => n.toLowerCase())
    .filter(Boolean)
    .some((n) => new RegExp(String.raw`\b${n}\b[^.!?]{0,25}?\b(?:ran|walked|rolled|jogged|hiked|logged|covered|did|finished|is at|has|had)\b[^.!?]{0,20}\d|\b${n}'?s (?:miles|runs|walks|pace|times?|activity|stats|total)\b`).test(lower));
  const anyNamedReport = /\b[A-Z][a-z]{2,}\s+(?:ran|walked|rolled|jogged|hiked|logged|covered|finished)\s+(?:\d|one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty)/.test(text);
  return [
    { id: "no-diagnosis", pass: !hits(DIAGNOSIS, lower), detail: "Never names, guesses at or dismisses a condition, and never claims to treat one." },
    { id: "no-prescription", pass: !hits(PRESCRIPTION, lower), detail: "No distance prescription, compressed plan or race-by-a-date claim." },
    { id: "no-unsafe-advice", pass: !hits(UNSAFE, lower), detail: "No advice to push through pain, skip food or water, or devalue rest." },
    { id: "no-kayla-voice", pass: !KAYLA_VOICE.test(lower), detail: "Never puts words in Kayla's mouth." },
    { id: "no-other-members", pass: !named && !anyNamedReport, detail: "Never reveals anyone else's activity." },
  ];
}

const NEEDS_BOUNDARY: Intent[] = ["pain", "medical", "crisis", "wellbeing", "nutrition", "race-big", "general"];
const GAP_WORDS = /\b(missed|break|gap|stopped|fell off|behind|weeks? off|haven'?t (?:been|moved|logged))\b/;

export function validate(question: string, intent: Intent, safety: Safety, draft: Draft, ctx: CoachContext, cardIds: Set<string>, otherNames: string[]): Check[] {
  const text = [...draft.blocks.map((b) => b.text), draft.nextStep?.label ?? ""].join(" ");
  const lower = normalise(text);
  const checks: Check[] = contentChecks(text, otherNames);

  const cited = draft.blocks.filter((b) => b.kind === "know" || b.kind === "support");
  const uncited = cited.filter((b) => !b.cardId || !cardIds.has(b.cardId));
  checks.push({ id: "grounded", pass: uncited.length === 0, detail: uncited.length === 0 ? `Every factual line cites one of ${cited.length} retrieved cards.` : "A factual line cites no retrieved card." });

  const needsBoundary = NEEDS_BOUNDARY.includes(intent);
  checks.push({ id: "boundary", pass: !needsBoundary || draft.blocks.some((b) => b.kind === "boundary"), detail: needsBoundary ? "States what QUANTUM can't do for this topic." : "No boundary needed for this topic." });

  const strava = ctx.included.some((l) => l.source === "strava");
  checks.push({ id: "lineage", pass: !strava, detail: strava ? "Context includes Strava data (STRAVA-03)." : "No Strava data in context (STRAVA-03)." });

  const raisedGap = GAP_WORDS.test(normalise(question));
  const mentionsGap = /\b(?:haven'?t (?:logged|moved)|days since|inactive|you stopped)\b/.test(lower);
  checks.push({ id: "no-mood-inference", pass: raisedGap || !mentionsGap, detail: "Doesn't raise inactivity unless the member did (OURS-NO-MOOD-INFERENCE)." });

  const resources = draft.blocks.some((b) => b.kind === "support" || b.cardId === "care" || b.cardId === "screen-symptoms");
  const noStep = draft.nextStep === null;
  const routed = safety === "urgent" ? noStep && resources : safety === "refer" || intent === "general" ? noStep : true;
  checks.push({
    id: "safety-routing",
    pass: routed,
    detail:
      safety === "urgent"
        ? "Urgent: crisis or care resources, and no fitness step."
        : safety === "refer"
          ? "Refer: points to a professional, and no fitness step."
          : intent === "general"
            ? "Not understood: safe default, and no fitness step."
            : "No routing needed.",
  });

  return checks;
}

function fallback(intent: Intent, safety: Safety): Draft {
  if (safety === "urgent" || intent === "crisis") {
    return {
      blocks: [support(), { kind: "boundary", text: "I can't help with this safely. Please reach a person now." }],
      nextStep: null,
    };
  }
  return {
    blocks: [
      { kind: "boundary", text: "I drafted something I can't stand behind, so I'm not sending it. Here's what I can say safely:" },
      know("pag-gradual"),
      know("care"),
    ],
    nextStep: null,
  };
}

/** Everyone in the world except the person asking. Names come from the live world, never a fixed list. */
function otherNamesFor(world: World, memberId: string): string[] {
  return Object.values(world.members)
    .filter((m) => m.id !== memberId)
    .map((m) => m.name);
}

export function answer(world: World, memberId: string, question: string, ruleset: RulesetVersion, drift: boolean, id: string): CoachAnswer {
  const member = world.members[memberId];
  if (!member) throw new Error(`Unknown member ${memberId}`);
  const c = classify(question, ruleset);
  // The invariant: low confidence answers as "not understood".
  const intent: Intent = c.confidence === "low" ? "general" : c.intent;
  const safety = c.safety;
  const ctx = coachContext(world, member);
  const available = new Set(cardsFor(ruleset).map((card) => card.id));
  const others = otherNamesFor(world, memberId);

  let draft = intent === "general" ? safeDefault(c.confidence === "low") : draftFor(intent, c.matched, world, member, ctx, ruleset, available);
  if (drift) draft = { ...draft, blocks: [...draft.blocks, { kind: "heard", text: driftLine(intent, others[0] ?? "Another member") }] };

  let checks = validate(question, intent, safety, draft, ctx, available, others);
  let rejectedDraft: CoachAnswer["rejectedDraft"] = null;
  const failed = checks.filter((ch) => !ch.pass);
  if (failed.length > 0) {
    rejectedDraft = { text: draft.blocks.map((b) => b.text).join(" "), failed: failed.map((ch) => ch.id) };
    draft = fallback(intent, safety);
    checks = validate(question, intent, safety, draft, ctx, available, others);
  }

  const cards = [...new Set(draft.blocks.map((b) => b.cardId).filter((x): x is string => Boolean(x)))];
  const garmin = ctx.included.some((l) => l.source === "garmin");
  return {
    id,
    memberId,
    question,
    ruleset,
    intent,
    safety,
    classifiedAs: c.intent,
    confidence: c.confidence,
    matched: c.matched,
    context: ctx,
    cards,
    blocks: draft.blocks,
    nextStep: draft.nextStep,
    checks,
    rejectedDraft,
    generator: "deterministic-composer",
    attributions: garmin ? [member.connections.garmin.deviceModel ?? "Garmin"] : [],
  };
}
