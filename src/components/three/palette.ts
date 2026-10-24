// Colours for the 3D scenes, matched to the Afterglow tokens in globals.css (four darks).
// WebGL can't read CSS variables, so each mode's values are repeated here once;
// keep the two in step when a token changes.

import type { ActivitySource } from "@/domain/types";

export type Mode = "dawn" | "day" | "golden" | "night";

export interface Light {
  /** Page background behind the hero, so the canvas edge disappears into the page. */
  bg: string;
  /** Far colour the scene fades into. */
  fog: string;
  /** Sky gradient, top then horizon. */
  sky: [string, string];
  /** Main surfaces (ground, plinths). */
  ground: string;
  ink: string;
  muted: string;
  line: string;
  accent: string;
  gold: string;
  ok: string;
  bad: string;
  info: string;
  /** Key light (the sun) and the cool fill opposite it. */
  key: string;
  fill: string;
}

export const LIGHT: Record<Mode, Light> = {
  dawn: {
    bg: "#140f22",
    fog: "#1e1632",
    sky: ["#100c1c", "#4a2c46"],
    ground: "#1e1830",
    ink: "#f7f2ea",
    muted: "#84799f",
    line: "#352c50",
    accent: "#ff6a13",
    gold: "#ffc14d",
    ok: "#5fd3a2",
    bad: "#ff7a59",
    info: "#c3b8ff",
    key: "#ff9a4d",
    fill: "#8f87c9",
  },
  day: {
    bg: "#0c0b0a",
    fog: "#12100e",
    sky: ["#0a0908", "#2a1a10"],
    ground: "#171512",
    ink: "#f7f2ea",
    muted: "#736a5f",
    line: "#2b2723",
    accent: "#ff6a13",
    gold: "#ffc14d",
    ok: "#5fd3a2",
    bad: "#ff7a59",
    info: "#b8b0ff",
    key: "#ffd2a8",
    fill: "#7d8fc4",
  },
  golden: {
    bg: "#110b07",
    fog: "#180f09",
    sky: ["#0e0905", "#3a1d0c"],
    ground: "#1d140d",
    ink: "#fbf1e4",
    muted: "#7e6852",
    line: "#34271c",
    accent: "#ff6a13",
    gold: "#ffc14d",
    ok: "#5fd3a2",
    bad: "#ff7a59",
    info: "#c3b8ff",
    key: "#ffb067",
    fill: "#6f7fb8",
  },
  night: {
    bg: "#070707",
    fog: "#0c0c0c",
    sky: ["#050505", "#1d150e"],
    ground: "#121212",
    ink: "#f5f5f4",
    muted: "#6e6e6b",
    line: "#262626",
    accent: "#ff6a13",
    gold: "#ffc14d",
    ok: "#5fd3a2",
    bad: "#ff7a59",
    info: "#b8b0ff",
    key: "#ff9a4d",
    fill: "#6f7fb8",
  },
};

/** One colour per data source, the same in every scene that shows where miles came from. */
export const SOURCE_COLOR: Record<ActivitySource, string> = {
  // Ivory, not orange: Strava's brand orange (#FC5200, required by its guidelines) must stay unmistakable.
  manual: "#f4efe6",
  event_checkin: "#ffc14d",
  healthkit: "#ec8a6b",
  health_connect: "#7fb7a4",
  garmin: "#8fb3e8",
  strava: "#fc5200",
};
