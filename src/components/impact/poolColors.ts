// One colour per kind of impact money, shared by the 3D pool and the hero
// legend — the same meanings as the flat bar below (disbursed green,
// available orange). Kept apart from the scene so the lens can read it without
// loading three.js. On the dark stage money is light: paid money glows, and
// promises are faint outlines in their own colour.

import { LIGHT } from "@/components/three/palette";

const P = LIGHT.golden;

export const POOL_COLOR = {
  available: P.accent,
  disbursed: P.ok,
  awaiting: P.accent,
  unfunded: P.bad,
  pipeline: "#b7a48e",
} as const;
