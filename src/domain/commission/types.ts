// A commission: one buyer pays for a program of weekly walks in a few of
// Kayla's cities. It is a Proposal (the money, the stages, the report) plus the
// things a proposal doesn't know: who covers each city, which cities were
// dropped and why, and which walks were rerun. Money lives only on the
// proposal; nothing here repeats a number the proposal already holds.

import type { ChapterId, EventId, PartnerId, ProposalId, Tick } from "../types";

export type CommissionId = string;

/**
 * Who delivers a city.
 *  - pending: the readiness check found a gap and nobody has decided yet.
 *  - lead: the city's own City Lead runs the walks.
 *  - crew: a partner run crew co-hosts, bringing its own lead and sweeps.
 *  - descoped: dropped before signing; requested by the buyer, never promised.
 */
export type Coverage = "pending" | "lead" | "crew" | "descoped";

export interface CommissionCity {
  chapterId: ChapterId;
  coverage: Coverage;
  /** Set when coverage is "crew". */
  crewId: string | null;
  /** Set when coverage is "descoped": the reason the buyer is told. */
  descopedBecause: string | null;
}

export interface Commission {
  id: CommissionId;
  proposalId: ProposalId;
  buyerId: PartnerId;
  /** The fee first quoted, so a counter-offer can be walked back. */
  quotedFee: number;
  /** Kayla opens the program with a talk (costed as her team's hours). */
  kickoff: boolean;
  /** Every city the buyer asked for, descoped ones included, in the order asked. */
  cities: CommissionCity[];
  /** Makeup walk → the cancelled walk it replaces. */
  makeups: Record<EventId, EventId>;
  /** Next season's proposal, once one is drafted. Never signed or paid by this program. */
  renewalProposalId: ProposalId | null;
  createdAt: Tick;
}
