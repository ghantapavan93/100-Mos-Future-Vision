// The pilot: one small test season before money and people are spent at scale.
// Three cities, six weekly first walks each, and a handful of measures with
// go / fix / stop lines. Pure functions, so the
// screen, its simulator and the tests all read the same arithmetic.
//
// The thresholds are our planning choices, anchored to public benchmarks: big
// free weekly runs see about 62–64% of first-timers return eventually; health
// walks keep about 71% at four months; free events lose 28–37% of sign-ups.

/** Three kinds of city, six Saturdays each. */
export const PILOT = { cities: 3, walksPerCity: 6 } as const;
export const PILOT_WALKS = PILOT.cities * PILOT.walksPerCity;

/** First-timers back by week 4: at or above GO, take it everywhere; under STOP after one fix, stop. */
export const RETURN_LINES = { go: 0.5, stop: 0.35 } as const;

/** 95% two-sided. */
const Z = 1.96;
/** 80% power, one-sided z. */
const Z_POWER = 0.8416;

/** First-timers the pilot counts, given how many each walk brings. */
export function pilotFirstTimers(perWalk: number): number {
  return Math.max(0, Math.round(perWalk)) * PILOT_WALKS;
}

/**
 * How far a return rate measured on `n` people could be off, in points (95%,
 * worst case p = 0.5, so it never flatters a small sample).
 */
export function marginPoints(n: number): number {
  if (n <= 0) return 100;
  return Math.round(Z * Math.sqrt(0.25 / n) * 1000) / 10;
}

/**
 * First-timers needed in each group to tell two formats apart (e.g. a 50% return
 * against 65%), at 95% confidence and 80% power. Two-proportion sample size.
 */
export function perGroupToCompare(p1: number, p2: number): number {
  const pBar = (p1 + p2) / 2;
  const a = Z * Math.sqrt(2 * pBar * (1 - pBar));
  const b = Z_POWER * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2));
  return Math.ceil(((a + b) * (a + b)) / ((p2 - p1) * (p2 - p1)));
}

export type Verdict = "go" | "fix" | "stop";

export interface PilotRead {
  verdict: Verdict;
  /** The measured rate, as a percent. */
  rate: number;
  /** ± points at this sample size. */
  margin: number;
  low: number;
  high: number;
  firstTimers: number;
  /** One plain sentence: what to do. */
  headline: string;
  /** One plain sentence: how sure we can be. */
  sureness: string;
}

/** What the pilot says, given how many first-timers each walk brings and how many come back by week 4. */
export function readPilot(perWalk: number, returnRate: number): PilotRead {
  const firstTimers = pilotFirstTimers(perWalk);
  const rate = Math.round(Math.min(1, Math.max(0, returnRate)) * 100);
  const margin = marginPoints(firstTimers);
  const low = Math.max(0, Math.round(rate - margin));
  const high = Math.min(100, Math.round(rate + margin));
  const verdict: Verdict = rate >= RETURN_LINES.go * 100 ? "go" : rate >= RETURN_LINES.stop * 100 ? "fix" : "stop";
  // Plain words: what happened, then what to do. No statistics vocabulary on screen.
  const headline =
    verdict === "go"
      ? `${rate}% came back by week 4. That's a Go: take the walk to every city.`
      : verdict === "fix"
        ? `${rate}% came back by week 4. Not enough yet: fix the walk and run it again.`
        : `Only ${rate}% came back by week 4. Pause, ask walkers why, and rethink the walk.`;
  const straddles = verdict === "go" ? low < RETURN_LINES.go * 100 : verdict === "fix" ? high >= RETURN_LINES.go * 100 || low < RETURN_LINES.stop * 100 : high >= RETURN_LINES.stop * 100;
  const sureness =
    firstTimers < 97
      ? `Only ${firstTimers} first-timers so far — too few to be sure. Run more walks before deciding.`
      : straddles
        ? "It's close, so check again after the next few walks."
        : "Clear enough to decide.";
  return { verdict, rate, margin, low, high, firstTimers, headline, sureness };
}
