"use client";

// Small pieces the circles screens share: an action hook that keeps the last
// receipt per button (so refusals can be shown right where they happened), the
// inline result line, the "who is acting" tag and access-need labels.

import { useCallback, useState } from "react";
import type { CommandInput } from "@/domain/commands";
import type { Meta, Receipt } from "@/domain/engine";
import type { AccessNeed, Actor, MovementEvent, World } from "@/domain/types";
import { OutcomeBadge, RuleChip, cn } from "@/components/ui/kit";
import { store } from "@/lib/store";

export const ACCESS_LABEL: Record<AccessNeed, string> = {
  "step-free": "Step-free",
  restrooms: "Restrooms",
  shade: "Shade",
  seating: "Seating",
  "short-option": "Short option",
  transit: "Near transit",
};

export const ACCESS_NEEDS = Object.keys(ACCESS_LABEL) as AccessNeed[];

export function useActions() {
  const [results, setResults] = useState<Record<string, Receipt>>({});
  const act = useCallback((key: string, input: CommandInput, actor: Actor, meta: Meta = {}) => {
    const receipt = store.dispatch(input, actor, { via: "circles", ...meta });
    setResults((prev) => ({ ...prev, [key]: receipt }));
    return receipt;
  }, []);
  return { act, results };
}

/**
 * Shows a refusal (or a no-change) next to the control that caused it. The
 * region is always mounted so screen readers announce what is written into it;
 * a success is announced but left for the screen itself to show.
 */
export function InlineResult({ receipt, showApplied = false, className }: { receipt: Receipt | undefined; showApplied?: boolean; className?: string }) {
  const refused = receipt ? receipt.outcome === "rejected" || receipt.outcome === "blocked" : false;
  const visible = receipt && (refused || showApplied || receipt.outcome !== "applied");
  return (
    <div role="status" className={visible ? cn("rise-in mt-2 flex flex-wrap items-start gap-2 rounded-xl px-3 py-2 text-[13.5px] leading-snug", refused ? "bg-bad-soft" : "bg-surface-2", className) : "sr-only"}>
      {receipt && !visible ? receipt.summary : null}
      {visible ? (
        <>
          <OutcomeBadge outcome={receipt.outcome} />
          <span className="min-w-0 flex-1">{receipt.summary}</span>
          {receipt.ruleIds.length ? (
            <span className="flex flex-wrap gap-1">
              {receipt.ruleIds.map((r) => (
                <RuleChip key={r} id={r} />
              ))}
            </span>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export function ActingAs({ name, role }: { name: string; role: string }) {
  return (
    <span className="font-mono text-[12px] uppercase tracking-[0.06em] text-muted">
      as {name} · {role}
    </span>
  );
}

export function AccessChip({ need, match }: { need: AccessNeed; match?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[12.5px]",
        match ? "border-transparent bg-ok-soft font-semibold text-ok" : "border-line-strong text-muted",
      )}
    >
      {match ? "✓ " : ""}
      {ACCESS_LABEL[need]}
    </span>
  );
}

export function distances(options: number[]): string {
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(n * 100 % 10 === 0 ? 1 : 2));
  if (options.length === 1) return `${fmt(options[0]!)} mi`;
  return `${options.slice(0, -1).map(fmt).join(", ")} or ${fmt(options[options.length - 1]!)} mi`;
}

/** Cities where 100 Miles of Summer has real City Leads. The demo's chapters there are placeholders and must say so. */
export const REAL_CITY_LEAD_CHAPTERS = new Set(["chicago", "nyc"]);

export const REAL_CITY_LEAD_NOTE =
  "100 Miles of Summer has real City Leads in Chicago and New York. The chapters and leads shown for those cities here are fictional placeholders, not them.";

/**
 * Who walks at the back, said without overpromising. With two routes and one
 * sweep, the sweep covers the longer route and the short route loops back to
 * the start, where an organizer waits — or the card says that person is still
 * needed.
 */
export function sweepCopy(world: World, e: MovementEvent): string | null {
  if (!e.sweep) return null;
  const sweep = world.members[e.sweep]?.name ?? "A volunteer";
  if (e.distanceOptions.length < 2) return `${sweep} is the sweep and makes sure nobody finishes alone.`;
  const long = Math.max(...e.distanceOptions);
  const short = Math.min(...e.distanceOptions);
  const hostId = [e.createdBy, ...(world.chapters[e.chapterId]?.organizers ?? [])].find((id) => id !== e.sweep);
  const host = hostId ? world.members[hostId]?.name : null;
  return host
    ? `${sweep} sweeps the ${long} mi route so nobody finishes it alone. The ${short} mi route loops back to the start, where ${host} waits.`
    : `${sweep} sweeps the ${long} mi route so nobody finishes it alone. The ${short} mi route loops back to the start; a second volunteer to wait there is still needed.`;
}

/**
 * The access facts for an event. A partner-funded event starts with none until
 * an organizer has checked the site, and says so rather than implying a fit.
 */
export function AccessSummary({ event, needs }: { event: MovementEvent; needs: AccessNeed[] }) {
  if (event.access.length === 0) {
    return (
      <p className="mt-3 text-[13.5px] text-warn">
        {event.fundedBy ? "Access not yet checked by an organizer." : "No access details listed yet."} Ask the lead before you go.
      </p>
    );
  }
  const missing = needs.filter((n) => !event.access.includes(n));
  return (
    <>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {event.access.map((n) => (
          <AccessChip key={n} need={n} match={needs.includes(n)} />
        ))}
      </div>
      {needs.length ? (
        <p className={cn("mt-2 text-[13.5px]", missing.length ? "text-warn" : "text-ok")}>
          {missing.length ? `Not listed here: ${missing.map((n) => ACCESS_LABEL[n].toLowerCase()).join(", ")}. Ask the lead before you go.` : "Fits the access needs you listed."}
        </p>
      ) : null}
      <p className="mt-1 text-[12.5px] text-muted">Not recorded yet: surface, grade, accessible restroom and parking.</p>
    </>
  );
}

/**
 * A meeting area that reads like a home: an apartment or unit, or a house
 * number followed by a street. Shown to the member and flagged to the
 * organizer; the organizer decides.
 */
export function looksLikeHomeAddress(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/\b(apt|apartment|unit|suite|ste)\b\.?\s*#?\s*\w+|#\s*\d+|\bmy (house|home|place)\b/i.test(t)) return true;
  return /\b\d{1,6}\s+(?:[nsew]\.?\s+)?[a-z0-9.'-]+(?:\s+[a-z0-9.'-]+)*\s+(st|street|ave|avenue|rd|road|dr|drive|ln|lane|ct|court|blvd|boulevard|way|pl|terrace|ter|cir|circle)\b/i.test(t);
}
