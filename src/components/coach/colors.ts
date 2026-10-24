// What the Ask page and its 3D wall share: the scene's props and one colour per
// kind of tip. Kept apart from CoachScene.tsx so the page can import them without
// pulling three.js into its first load — the scene itself arrives through
// next/dynamic.

import type { CardStatus, Safety } from "@/domain/quantum/types";

export interface CoachCard {
  id: string;
  title: string;
  status: CardStatus;
}

export interface CoachSceneProps {
  name: string;
  cards: CoachCard[];
  /** Cards the latest answer cites, in order. Empty before anything is asked. */
  cited: string[];
  /** Null before anything is asked. */
  safety: Safety | null;
  /** The answer's topic, in words ("Getting started"). */
  topic: string | null;
  /** Changes whenever a new answer arrives, so the scene replays its threads. */
  answerKey: string | null;
}

/** One colour per kind of content, the same as the badges on the answer card. */
export const STATUS_COLOR: Record<CardStatus, string> = {
  "public-guideline": "#5fd3a2",
  "proposed-lesson": "#ff6a13",
  "proposed-rule": "#ffc14d",
  resource: "#ff7a59",
};
