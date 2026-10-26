// Where the walkthrough stands, read from the commission's world and ledger,
// never from a click counter: a step is done when the world says so. The guide
// uses the same reading to point at the one button that moves the story on.

import type { Receipt } from "@/domain/engine";
import { economics } from "@/domain/finance";
import { crewFor, heatAlertFor, heatHandled, walksOf, type HeatAlert } from "@/domain/commission/model";
import type { Commission } from "@/domain/commission/types";
import type { Proposal, World } from "@/domain/types";

export type StepId = "ask" | "deliver" | "pushback" | "money" | "summer" | "proof" | "renew";

export const STEPS: { id: StepId; n: string; title: string; question: string }[] = [
  { id: "ask", n: "01", title: "The ask", question: "Who pays, and for what?" },
  { id: "deliver", n: "02", title: "Can we deliver it?", question: "Do the cities have the people for it?" },
  { id: "pushback", n: "03", title: "The pushback", question: "What happens when the buyer pushes?" },
  { id: "money", n: "04", title: "The money", question: "Does it pay, and is the money in?" },
  { id: "summer", n: "05", title: "The summer", question: "What happens when the walks happen?" },
  { id: "proof", n: "06", title: "The proof", question: "What does the buyer get?" },
  { id: "renew", n: "07", title: "Next summer", question: "Will they come back, and at what price?" },
];

export function currentCommission(w: World): Commission | null {
  return Object.values(w.commissions ?? {}).at(-1) ?? null;
}

const LIVE = new Set(["live", "reported", "renewed"]);

export interface Flow {
  c: Commission | null;
  p: Proposal | null;
  declined: boolean;
  /** The buyer has asked for something the rules refuse. */
  asked: boolean;
  /** The buyer's counter-offer has been tried on the deal. */
  countered: boolean;
  /** A heat forecast is waiting on a decision (the week stopped the evening before). */
  heat: HeatAlert | null;
  pendingWalks: number;
  done: Record<StepId, boolean>;
}

const forProposal = (r: Receipt, proposalId: string) => (r.payload as { proposalId?: string } | null)?.proposalId === proposalId;

export function flowOf(w: World, ledger: Receipt[]): Flow {
  const c = currentCommission(w);
  const p = c ? (w.proposals[c.proposalId] ?? null) : null;
  const declined = p?.stage === "lost";
  const asked = Boolean(p && ledger.some((r) => r.type === "PARTNER_DATA_REQUEST" && forProposal(r, p.id)));
  const countered = Boolean(p && ledger.some((r) => r.type === "SET_PROPOSAL_INPUT" && forProposal(r, p.id) && r.outcome === "applied"));
  const walks = c ? walksOf(w, c) : [];
  const pendingWalks = walks.filter((x) => x.status === "pending").length;
  const alert = c && p?.stage === "live" ? heatAlertFor(w, c) : null;
  const hot = alert ? w.events[alert.eventId] : undefined;
  const heat = alert && hot && !heatHandled(hot) && hot.status !== "completed" && w.clock >= (hot.day - 1) * 1440 + 18 * 60 ? alert : null;
  return {
    c,
    p,
    declined,
    asked,
    countered,
    heat,
    pendingWalks,
    done: {
      ask: Boolean(c),
      deliver: Boolean(c && (declined || c.cities.every((x) => x.coverage !== "pending"))),
      pushback: Boolean(p && (declined || (asked && p.signedAt !== null))),
      money: Boolean(p && (declined || p.paidAt !== null)),
      summer: Boolean(p && !declined && LIVE.has(p.stage) && walks.length > 0 && pendingWalks === 0),
      proof: Boolean(p && p.reportedAt !== null),
      renew: Boolean(c && c.renewalProposalId !== null),
    },
  };
}

export interface Move {
  step: StepId;
  /** The id of the button that makes this move; the guide points at it, or presses it. */
  target: string;
  label: string;
}

/** The one move that carries the story forward from here, or null when it's told (or declined). */
export function nextMove(w: World, f: Flow): Move | null {
  const { c, p } = f;
  if (!c || !p) return { step: "ask", target: "move-create", label: "Send the buyer a proposal" };
  if (f.declined) return null;
  const open = c.cities.find((x) => x.coverage === "pending");
  if (open) {
    const city = w.chapters[open.chapterId]?.city ?? open.chapterId;
    return crewFor(open.chapterId)
      ? { step: "deliver", target: `move-crew-${open.chapterId}`, label: `Bring in a partner crew for ${city}` }
      : { step: "deliver", target: `move-drop-${open.chapterId}`, label: `Drop ${city}` };
  }
  if (!f.asked) return { step: "pushback", target: "move-ask-0", label: "Send the buyer's data request" };
  if (p.signedAt === null) {
    if (!f.countered) return { step: "pushback", target: "move-counter", label: "Try the buyer's counter-offer" };
    if (economics(p.inputs).flags.some((x) => x.severity === "block")) return { step: "pushback", target: "move-floor", label: "Meet them at the floor price" };
    return { step: "pushback", target: "move-sign", label: "Sign the contract" };
  }
  if (p.paidAt === null) return { step: "money", target: "move-pay", label: "Record the buyer's payment" };
  if (p.stage === "contract") return { step: "summer", target: "move-live", label: "Put the walks on the calendar" };
  if (p.stage === "live") {
    if (f.heat) return { step: "summer", target: "move-heat-early", label: `Move the ${f.heat.city} walk to the early start` };
    if (f.pendingWalks > 0) return { step: "summer", target: "move-week", label: "Play the next week" };
    return { step: "proof", target: "move-send", label: "Send the Community Value Report" };
  }
  if (!c.renewalProposalId) return { step: "renew", target: "move-renew", label: "Draft next summer's proposal" };
  return null;
}
