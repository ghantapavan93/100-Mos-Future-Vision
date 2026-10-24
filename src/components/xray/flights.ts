// What the How miles count screen and its 3D scene share: the receipt shape the
// scene draws, how many it shows, and the colour of each outcome. It lives apart
// from XRayScene.tsx so the page can read it without pulling three.js into its
// first load — the scene itself arrives later, as its own chunk.

import { LIGHT } from "@/components/three/palette";
import type { Outcome } from "@/domain/engine";

/** One receipt, as the scene needs it. */
export interface Flight {
  seq: number;
  outcome: Outcome;
  /** Index (0–6) of the last gate the request reached; for refusals, the gate that refused it. */
  stop: number;
  hash: string;
}

export interface XRaySceneProps {
  /** Newest last; the scene draws at most the last FLIGHTS of them. */
  flights: Flight[];
  stations: string[];
  /** Total receipts in the session. */
  total: number;
  /** Seq of the first receipt whose hash no longer recomputes, if any. */
  firstBreak: number | null;
  /** Read models that disagree with the ledger right now. */
  drift: number;
}

export const FLIGHTS = 18;

const P = LIGHT.night;

/** Colours by outcome, shared by the scene and the legend in XRay.tsx. */
export const OUTCOME_COLOR: Record<Outcome, string> = {
  applied: P.gold,
  noop: "#a7a194",
  rejected: P.bad,
  blocked: P.bad,
  deferred: P.info,
  quarantined: "#e8c15a",
};
