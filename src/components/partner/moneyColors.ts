// One colour per part of a partner's fee, shared by the 3D waterfall and the
// hero legend beside it. Kept apart from the scene so the lens can read it
// without loading three.js. Tuned for the dark stage: every colour reads as a
// light against ember-black, the fee as the whole (ivory), the costs warm to
// cool, the impact share the movement's orange, what's left green.

import { LIGHT } from "@/components/three/palette";

const P = LIGHT.golden;

export const MONEY_COLOR = {
  fee: "#f2e6d6",
  delivery: P.gold,
  staff: "#e0894a",
  processing: "#9a93a8",
  impact: P.accent,
  left: P.ok,
  loss: P.bad,
} as const;
