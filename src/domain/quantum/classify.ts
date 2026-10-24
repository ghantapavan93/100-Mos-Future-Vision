// Intent and safety classification by ordered phrase rules. Deterministic and
// inspectable, and built recall-first: when a question might be about danger,
// it is treated as danger. Keyword rules still can't recognise every way a
// person in distress might say it, so two things back them up:
//   - answer() never gives a fitness step to anything it doesn't recognise, or
//     recognises with a concern it can't place (see `confidence`);
//   - the sealed evaluation set (heldout.sealed.json) measures what the rules
//     miss, and free text stays off for launch until it passes.
//
// Safety routing is a floor shared by every ruleset. Rulesets change coaching
// content (cards and program rules), never whether a crisis is recognised.

import type { RulesetVersion } from "../types";
import type { Intent, Safety } from "./types";

interface Rule {
  intent: Intent;
  safety: Safety;
  patterns: RegExp[];
}

// Order is priority: the first matching rule wins, so safety rules come first.
const RULES: Rule[] = [
  {
    // Suicide, self-harm, overdose and indirect warning signs. English slang and
    // misspellings are folded by `loosen`; a few Spanish phrases are included.
    intent: "crisis",
    safety: "urgent",
    patterns: [
      /\bsuicid/,
      /\bkill(?:ing)? (?:myself|my ?self)\b/,
      /(?<![\d.]\s?)\bkms\b/,
      /\bunaliv/,
      /\bend(?:ing)? (?:my life|it all|things|myself|my own life)\b/,
      /\btak(?:e|ing) my (?:own )?life\b/,
      /\bwant(?:ed|ing)? to die\b|\bwanna die\b|\bready to die\b/,
      /\bwish (?:i (?:was|were) dead|i (?:could )?(?:just )?(?:disappear|not wake up|didn'?t exist|wasn'?t here|was never born))/,
      /\bdon'?t want to (?:live|be alive|be here anymore|wake up|exist)\b|\bdo not want to (?:live|be alive|wake up)\b/,
      /\bno reason to (?:live|go on|keep going|be here)\b|\bnot worth living\b|\blife (?:isn'?t|is not|is no longer) worth\b/,
      /\bbetter off (?:dead|without me|if i (?:was|were)n'?t (?:here|around))\b/,
      /\bcan'?t (?:go on|do this anymore|keep going like this|take (?:it|this|life) anymore)\b/,
      /\bself[- ]?harm/,
      /\b(?:cut|cutting|hurt|hurting|harm|harming|burn|burning) (?:myself|my ?self)\b/,
      /\boverdos/,
      /\b(?:took|take|taking|swallowed) (?:a bunch of|too many|all (?:of )?my|a lot of|a handful of|a whole bottle of|an entire bottle of) (?:pills|meds|tablets|medication|sleeping pills|painkillers)\b/,
      /\bgiving (?:away )?(?:all )?(?:my|of my) (?:things|stuff|belongings|possessions|things away|stuff away)\b|\bgiving away (?:all )?my (?:things|stuff|belongings|possessions)\b/,
      /\bsaying (?:my )?(?:last )?goodbyes? to (?:everyone|everybody|people|my family|my friends|you all)\b|\bgoodbye forever\b|\bthis is goodbye\b/,
      /\b(?:i'?m|i am|feel like) (?:just )?(?:a|such a) burden\b/,
      /\b(?:no one|nobody|noone) would (?:miss|notice|care) (?:me|if i)\b/,
      /\bwon'?t be (?:here|around) (?:much longer|for long|anymore|next week)\b/,
      // Spanish
      /\bquiero morir/,
      /\bme quiero morir\b/,
      /\bno quiero (?:vivir|seguir|estar aqui)\b/,
      /\bquitarme la vida\b|\bmatarme\b|\bhacerme dano\b/,
      /\bno vale la pena vivir\b/,
      /\bme tome (?:todas las|muchas|un frasco de) pastillas\b/,
    ],
  },
  {
    // Emergency symptoms: stop, get help now.
    intent: "medical",
    safety: "urgent",
    patterns: [
      /\bchest (?:pain|pains|pressure|tight|hurts?|hurting|squeez|heavy|heaviness|discomfort)/,
      /\b(?:tight|tightness|pressure|pain|squeezing|heaviness) in (?:my |the )?chest\b/,
      /\bchest (?:feels|felt|is|was|got) (?:tight|heavy|weird|like)/,
      /\b(?:left |right )?arm (?:is |feels |felt |goes |went |keeps going |has gone )?(?:numb|tingl|dead)/,
      /\bnumb(?:ness)? (?:in|down) (?:my )?(?:left |right )?(?:arm|face|jaw|side)\b/,
      /\bjaw (?:pain|hurts|ache)/,
      /\bshort(?:ness)? of breath\b|\bout of breath and (?:can'?t|cannot|won'?t)\b/,
      /\bcan'?t (?:catch my )?breath(?:e)?\b|\bcan ?not breathe\b|\bcannot breathe\b|\b(?:trouble|struggling|hard time|difficulty) breathing\b/,
      /\b(?:blacked|passed|blacking|passing) out\b|\bblack ?out\b/,
      /\bfaint(?:ed|ing)?\b|\bcollapsed\b/,
      /\bheart (?:is |was |keeps )?(?:racing|pounding|skipping|fluttering|beating (?:really |so |too )?(?:fast|hard|weird))/,
      /\bseizure\b|\bslurred speech\b|\bface (?:is |was )?droop/,
      /\bstopped sweating\b|\bheat ?stroke\b|\bconfused (?:and|in the) (?:hot|heat)\b/,
      /\bdolor (?:en el|de) pecho\b|\bno puedo respirar\b/,
    ],
  },
  {
    // Symptoms and conditions that belong with a clinician.
    intent: "medical",
    safety: "refer",
    patterns: [
      /\bdizz(?:y|iness)\b|\blight-?headed\b|\bvertigo\b/,
      /\bpregnan/,
      /\bmedication\b|\bmeds\b|\bprescription\b|\binsulin\b/,
      /\bdiabet/,
      /\basthma\b|\binhaler\b/,
      /\bheart condition\b|\bblood pressure\b|\bhypertension\b|\bpacemaker\b/,
      /\bsurgery\b|\bepilep/,
      /\bmy doctor (?:said|told|says)\b|\bcleared (?:to|for) (?:exercise|walk|run)\b/,
    ],
  },
  {
    intent: "pain",
    safety: "refer",
    patterns: [
      /\b(?:knee|ankle|hip|foot|feet|shin|back|heel|calf|hamstring|achilles|toe|wrist|shoulder|leg)s? (?:hurts?|hurting|pain|aches?|is killing me|are killing me|swollen)/,
      /\bhurts? (?:when|after|during|to)\b/,
      /\bsharp pain\b|\bshooting pain\b/,
      /\binjur/,
      /\bswollen\b|\bswelling\b/,
      /\bsprain|\bstrain(?:ed)? (?:my|a)\b|\bpulled (?:a|my) (?:muscle|hamstring|calf)\b/,
      /\b(?:twisted|rolled) (?:my|an) ankle\b/,
      /\blimp(?:ing)?\b|\bcan'?t put weight\b/,
      /\bshin splints?\b|\bplantar\b|\bblisters?\b/,
      /\bin pain\b|\bpain (?:in|when|after|during)\b/,
    ],
  },
  {
    intent: "injection",
    safety: "ok",
    patterns: [
      /\b(?:ignore|disregard|forget|override) (?:all |any |your |the |previous |prior |above |these |those )*(?:instructions|rules|guidelines|guardrails|prompt|programming)\b/,
      /\bsystem prompt\b/,
      /\b(?:pretend|imagine) (?:you are|you'?re|to be) (?:my |a |an )?(?:doctor|physio|physiotherapist|therapist|nurse|trainer|dietitian|nutritionist|psychiatrist|kayla)\b/,
      /\b(?:act|behave|respond) (?:as|like) (?:my |a |an )?(?:doctor|physio|physiotherapist|therapist|nurse|dietitian|nutritionist|psychiatrist)\b/,
      /\byou are now\b|\bfrom now on you\b/,
      /\bjailbreak\b|\bdeveloper mode\b|\bno restrictions\b|\bwithout (?:your )?(?:rules|restrictions|limits)\b/,
    ],
  },
  {
    intent: "privacy",
    safety: "ok",
    patterns: [
      /\b(?:how (?:far|much|many miles|fast|often)|what|when|where) (?:did|does|has) (?!(?:i|you|we|it|the|a|an|this|that|my|our|your|everyone|anyone|one)\b)[a-z]+ (?:run|ran|walk|walked|roll|go|do|log|logged|finish|move)\b/,
      /\b(?!(?:my|your|our|today|yesterday|tonight|tomorrow|week|this week|season|team|group|chapter|club|circle|everyone|the|it|that|what|who|there|here|one)'s)[a-z]+'s (?:miles|mileage|runs|walks|activities|activity|stats|pace|times?|data|location|address|home|strava|progress)\b/,
      /\bwho (?:is|was|'s) (?:the )?(?:slowest|fastest|last|behind)\b/,
      /\bshow me (?:other people'?s|everyone'?s|the others'?|their)\b/,
      /\bwhere (?:does|do) (?!i\b)[a-z]+ live\b/,
      /\bmy strava\b.*\b(?:coach|ai|you|use|read|analy[sz]e|look at)\b|\b(?:coach|ai|you|use|read|analy[sz]e)\b.*\bmy strava\b/,
    ],
  },
  {
    intent: "kayla",
    safety: "ok",
    patterns: [/\bkayla\b/, /\bthe founder\b/],
  },
  {
    intent: "nutrition",
    safety: "refer",
    patterns: [
      /\bdiet(?:ing)?\b|\bketo\b|\bcarbs?\b/,
      /\bsupplement/,
      /\bcalorie/,
      /\blose (?:\d+ )?(?:pounds|lbs|kilos|kg|weight)\b|\bweight ?loss\b|\blosing weight\b/,
      /\bprotein\b|\bcreatine\b|\belectrolyte|\bpre-?workout\b/,
      /\bfasting\b|\bintermittent fast|\bfast to lose\b/,
      /\bskip(?:ping)? (?:meals?|breakfast|lunch|dinner)\b|\bwhat should i eat\b|\beat before\b/,
    ],
  },
  {
    intent: "wellbeing",
    safety: "support",
    patterns: [
      /\boverwhelm/,
      /\bstress(?:ed|ful)?\b/,
      /\banxious\b|\banxiety\b|\bpanic attack/,
      /\bmentally (?:exhausted|drained)\b/,
      /\bburn(?:ed|t)? ?out\b/,
      /\bsad\b|\bdown lately\b|\bfeeling down\b|\bcrying\b/,
      /\bgrief\b|\bgriev/,
      /\bdepress/,
      /\bhopeless\b|\bworthless\b|\bcan'?t cope\b/,
      /\bno point (?:in|to) (?:anything|living|trying|life)\b|\bwhat'?s the point of (?:anything|life|living|trying|it all)\b/,
    ],
  },
  {
    // Belonging worries outrank the generic "people"/"group" words below.
    intent: "start",
    safety: "ok",
    patterns: [
      /\b(?:so|too) slow\b/,
      /\bjudg/,
      /\blaugh(?:ing)? at me\b|\bstare at me\b/,
      /\bnever (?:really )?(?:exercised|run|walked|worked out)/,
      /\bfor (?:me|someone like me)\?/,
      /\bwheelchair\b|\bin my chair\b/,
      /\b(?:does|do|will) (?:it|that|my|rolling|walking|wheelchair|chair) (?:\w+ )?(?:miles )?count\b|\bcount the same\b/,
    ],
  },
  {
    intent: "heat",
    safety: "ok",
    patterns: [/\bheat\b|\bheatwave\b/, /\bhot (?:out|outside|today|day|weather|morning|afternoon)\b|\bso hot\b|\btoo hot\b/, /\bhumid/, /\b(?:9\d|1[0-2]\d) ?(?:°|degrees|f\b)/],
  },
  {
    intent: "race-big",
    safety: "ok",
    patterns: [/\b(?:half|full)[- ]?marathon\b/, /\bmarathon\b/, /\b10 ?k\b/, /\b13\.1\b/, /\b26\.2\b/, /\bultra(?:marathon)?\b/],
  },
  {
    intent: "first-5k",
    safety: "ok",
    patterns: [
      /\b(?:train|training|prepare|preparing|ready|plan|first|couch to|c25k|build up to|get to)\b[^.?!]{0,20}\b5 ?k\b/,
      /\b5 ?k\b[^.?!]{0,15}\b(?:plan|training|race)\b/,
      /\bc25k\b|\b3\.1 miles\b|\bfirst race\b/,
    ],
  },
  {
    intent: "restart",
    safety: "ok",
    patterns: [
      /\bmissed\b/,
      /\bfell off\b|\bfallen off\b|\bfallen behind\b|\bbehind\b/,
      /\bruined\b|\bgave up\b|\bgiven up\b/,
      /\blost (?:my |all )?motivation\b|\bunmotivated\b|\bno motivation\b/,
      /\bstart(?:ing)? (?:over|again)\b|\bweeks? off\b|\bcoming back\b|\bget(?:ting)? back (?:into|to|on)\b/,
      /\bhaven'?t (?:walked|moved|been out|logged|run)\b/,
    ],
  },
  {
    intent: "community",
    safety: "ok",
    patterns: [/\bgroups?\b/, /\bpeople\b/, /\bnear me\b|\bnearby\b|\baround here\b/, /\bmeet ?ups?\b/, /\blonely\b/, /\bclubs?\b|\bcrew\b|\bcircle\b|\bchapter\b/, /\bfriends?\b|\bbuddy\b|\bpartner to\b/, /\bevents?\b/, /\bstep-?free\b/],
  },
  {
    intent: "rest",
    safety: "ok",
    patterns: [/\brest\b/, /\btired\b|\bexhausted\b/, /\bsore(?:ness)?\b/, /\brecover/, /\bday off\b|\bbreak day\b/, /\bforce myself\b|\bpush (?:through|myself)\b/],
  },
  {
    intent: "start",
    safety: "ok",
    patterns: [/\bbegin/, /\bstart/, /\bnew to\b/, /\bfor me\b/, /\bcan i (?:do|join)\b/, /\bout of shape\b/, /\bslow\b/],
  },
];

/**
 * Phrases that look dangerous but aren't ("dying to try", "this hill killed me").
 * They are removed before the safety rules run; nothing else is.
 */
const IDIOMS: RegExp[] = [
  /\bdying (?:to|for) (?:try|do|join|run|walk|get|see|know|go|start|sign|hear|meet)\w*/g,
  /\b(?:hill|hills|run|workout|heat|sun|stairs|it|this|that|they|you|legs|knees|feet|week|class|pace)\s+(?:is |are |was |were |will |'?s |'?re )?(?:going to |gonna |about to |almost |nearly |totally |literally )?kill(?:ed|ing|s)? me\b/g,
  /\bcould (?:kill|murder) (?:a|for a|for an|an|some)\b/g,
  /\b(?:dead|deadly) (?:tired|legs|serious|last|slow)\b/g,
  /\bmuero de (?:ganas|hambre|risa)\b/g,
];

export type Confidence = "high" | "low";

export interface Classification {
  intent: Intent;
  safety: Safety;
  matched: string[];
  /** Low when a non-safety intent matched but the words also carry a concern the rules can't place. */
  confidence: Confidence;
}

export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Fold accents and the common letter-for-digit swaps ("su1cide") so spelling can't hide a word. */
export function loosen(text: string): string {
  return normalise(text)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/(?<=[a-z])[1!|](?=[a-z])/g, "i")
    .replace(/(?<=[a-z])0(?=[a-z])/g, "o")
    .replace(/(?<=[a-z])3(?=[a-z])/g, "e")
    .replace(/(?<=[a-z])[4@](?=[a-z])/g, "a")
    .replace(/(?<=[a-z])\$(?=[a-z])/g, "s")
    .replace(/(?<=[a-z])5(?=[a-z])/g, "s");
}

const CONCERN = /\bunsafe\b|\bnot safe\b|\bhate (?:myself|my life|my body)\b|\bdesperate\b|\bnot okay\b|\bnot ok\b|\bat night alone\b|\balone at night\b|\bafraid of (?:him|her|them|someone)\b|\bsomeone (?:is )?following me\b/;

/**
 * A question the member asked the system to forget. Only the classification the engine
 * derived at the time survives, plus a digest; replay reads it back without the words.
 */
export const FORGOTTEN = /^⟦forgotten:([\w-]+):([\w-]+):#([0-9a-f]{8})⟧$/;

export function classify(question: string, _ruleset?: RulesetVersion): Classification {
  const forgotten = FORGOTTEN.exec(question);
  if (forgotten) return { intent: forgotten[1] as Intent, safety: forgotten[2] as Safety, matched: [], confidence: "high" };
  const text = loosen(question);
  // Idioms are removed only for the urgent rules: "my knees are killing me" is still pain.
  let urgentText = text;
  for (const idiom of IDIOMS) urgentText = urgentText.replace(idiom, " ");
  for (const rule of RULES) {
    const matched: string[] = [];
    const subject = rule.safety === "urgent" ? urgentText : text;
    for (const p of rule.patterns) {
      const m = subject.match(p);
      if (m) matched.push(m[0].trim());
    }
    if (matched.length > 0) {
      const placesConcern = rule.safety !== "ok" || rule.intent === "injection" || rule.intent === "privacy" || rule.intent === "kayla";
      return { intent: rule.intent, safety: rule.safety, matched, confidence: !placesConcern && CONCERN.test(text) ? "low" : "high" };
    }
  }
  return { intent: "general", safety: "ok", matched: [], confidence: CONCERN.test(text) ? "low" : "high" };
}
