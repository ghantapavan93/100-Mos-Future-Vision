// The fictional season the demo runs in. 100 Miles of Summer publicly runs
// May 1 to August 31, and 2027 is its tenth season.
// The engine counts time in ticks (minutes since May 1, 00:00); this file is
// the only place that turns ticks into calendar words.

import type { Tick } from "./types";

export const SEASON = {
  year: 2027,
  number: 10,
  firstDay: "2027-05-01",
  /** May 1 through August 31 inclusive. */
  days: 123,
} as const;

export const MINUTES_PER_DAY = 1440;

export function tick(day: number, minute = 0): Tick {
  return day * MINUTES_PER_DAY + minute;
}

export function dayOf(t: Tick): number {
  return Math.floor(t / MINUTES_PER_DAY);
}

export function minuteOf(t: Tick): number {
  return t - dayOf(t) * MINUTES_PER_DAY;
}

const START_UTC = Date.UTC(2027, 4, 1);
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function dateOf(day: number): Date {
  return new Date(START_UTC + day * 86_400_000);
}

/** "Sat, May 15" */
export function dayLabel(day: number): string {
  const d = dateOf(day);
  return `${WEEKDAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** "8:00 AM" */
export function timeLabel(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${suffix}`;
}

/** "Sat, May 15 · 8:00 AM" */
export function tickLabel(t: Tick): string {
  return `${dayLabel(dayOf(t))} · ${timeLabel(minuteOf(t))}`;
}

export function daysLeft(t: Tick): number {
  return Math.max(0, SEASON.days - dayOf(t) - 1);
}

/** Kayla's public pacing guide is 25 miles a month; this is the weekly equivalent over the season. */
export function weeklyPaceFor(targetMiles: number): number {
  return Math.round((targetMiles / (SEASON.days / 7)) * 10) / 10;
}
