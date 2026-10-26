"use client";

// Replay and time travel. The world is a fold of the command log, so it can be
// rebuilt from the log alone and land on the same hash. The scrubber replays a
// prefix of the log into a separate, read-only machine — the live demo is never
// touched while you look back.

import { useMemo, useState } from "react";
import { COMMAND_TYPES } from "@/domain/commands";
import { tickLabel } from "@/domain/calendar";
import { GENESIS, STRAVA_SHREDDED, impactPool, replay, seasonMiles, type LogEntry, type Receipt } from "@/domain/engine";
import { shredErased } from "@/domain/erasure";
import { FORGOTTEN } from "@/domain/quantum/classify";
import type { ActivitySource, Role, World } from "@/domain/types";
import { Badge, Button, OutcomeBadge, RuleChip, Stat } from "@/components/ui/kit";
import { actors, store, useLedger, useLog, useWorld } from "@/lib/store";

const ROLES: Role[] = ["member", "organizer", "partner", "founder", "provider", "engineer", "system"];

export function parseLog(text: string): { ok: true; log: LogEntry[] } | { ok: false; error: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "That isn't valid JSON." };
  }
  if (!Array.isArray(data)) return { ok: false, error: "Expected a JSON array of log entries." };
  if (data.length > 2000) return { ok: false, error: "Logs over 2,000 entries aren't accepted here." };
  for (const [i, e] of data.entries()) {
    const entry = e as { input?: { type?: unknown; payload?: unknown }; actor?: { role?: unknown; id?: unknown } };
    if (!entry || typeof entry !== "object" || !entry.input || typeof entry.input.type !== "string" || !(COMMAND_TYPES as string[]).includes(entry.input.type))
      return { ok: false, error: `Entry ${i + 1} has no known command type.` };
    if (!entry.actor || !ROLES.includes(entry.actor.role as Role) || typeof entry.actor.id !== "string") return { ok: false, error: `Entry ${i + 1} has no valid actor.` };
  }
  // Payloads are not trusted here: the engine validates every one again on replay.
  return { ok: true, log: data as LogEntry[] };
}

/**
 * What leaves the building: the log with every restricted value shredded, as if the
 * world had let go of all of it. It still replays to the same audit chain.
 */
export function exportableLog(log: LogEntry[], ledger: Receipt[], world: World): LogEntry[] {
  const nothingHeld: World = {
    ...world,
    activities: Object.fromEntries(Object.entries(world.activities).filter(([, a]) => a.source !== "strava")),
    pendingRetries: [],
    coach: { ...world.coach, sessions: [] },
  };
  return shredErased(log, ledger, nothingHeld);
}

/** Which kinds of member data an export of this log carries (for the egress row). */
export function lineageOf(log: LogEntry[]): ActivitySource[] {
  const out = new Set<ActivitySource>();
  for (const { input } of log) {
    if (input.type === "PROVIDER_DELIVERY") {
      const p = input.payload as { provider: ActivitySource; externalId: string };
      if (!String(p.externalId).startsWith(STRAVA_SHREDDED)) out.add(p.provider);
    }
    if (input.type === "LOG_ACTIVITY") out.add("manual");
    if (input.type === "CHECK_IN") out.add("event_checkin");
  }
  return [...out].sort();
}

function erasureCounts(log: LogEntry[], world: World) {
  let erased = 0;
  let held = 0;
  for (const { input } of log) {
    if (input.type === "PROVIDER_DELIVERY" && (input.payload as { provider: string }).provider === "strava") {
      if (String((input.payload as { externalId: string }).externalId).startsWith(STRAVA_SHREDDED)) erased++;
      else held++;
    }
    if (input.type === "ASK_COACH") {
      if (FORGOTTEN.test(String((input.payload as { question: string }).question))) erased++;
      else held++;
    }
  }
  return { erased, held, strava: Object.values(world.activities).filter((a) => a.source === "strava" && a.status === "owner-panel").length };
}

export function Replay({ onShow }: { onShow: (seq: number) => void }) {
  const log = useLog();
  const ledger = useLedger();
  const world = useWorld();
  const [proof, setProof] = useState<{ same: number; total: number } | null>(null);
  const [rebuilt, setRebuilt] = useState<{ before: string; after: string } | null>(null);
  const [pick, setPick] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const n = pick === null ? log.length : Math.min(pick, log.length);

  const past = useMemo(() => replay(log, n), [log, n]);
  const w = past.world;
  const step = past.ledger[n - 1];

  /** Every export is a disclosure: it writes its egress row first (X-04), then leaves with restricted data shredded. */
  const exportText = (how: string) => {
    const before = store.get();
    const out = exportableLog(before.log, before.machine.ledger, before.machine.world);
    store.dispatch(
      { type: "RECORD_EXPORT", payload: { recipient: "Engineering (Kirk)", what: `Command log, ${out.length} entries, ${how}. Strava data and coach conversations shredded.`, lineage: lineageOf(out) } },
      actors.engineer,
      { via: "xray-export" },
    );
    return JSON.stringify(out, null, 2);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(exportText("copied to the clipboard"));
      setMessage(`Copied ${log.length} entries. The export is in the egress log.`);
    } catch {
      setMessage("The clipboard isn't available here — use Download instead.");
    }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([exportText("downloaded as JSON")], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `future-lab-log-${log.length}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage(`Downloaded ${log.length} entries. The export is in the egress log.`);
  };
  const counts = erasureCounts(log, world);
  const verifyErasure = () => {
    const again = replay(log);
    const same = ledger.filter((r, i) => again.ledger[i]?.hash === r.hash).length;
    setProof({ same, total: ledger.length });
  };
  const load = (text: string) => {
    const parsed = parseLog(text);
    if (!parsed.ok) return setMessage(parsed.error);
    store.load(parsed.log);
    setPick(null);
    setMessage(`Loaded ${parsed.log.length} entries and replayed them. Head hash ${store.get().machine.ledger.at(-1)?.hash ?? GENESIS}.`);
    setDraft("");
  };

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_1.25fr]">
      <section className="card p-4 sm:p-5" aria-labelledby="xr-rebuild">
        <h4 id="xr-rebuild" className="text-[16px] font-semibold">
          Rebuild the world from the log
        </h4>
        <p className="mt-1 text-[13.5px] text-muted">Throw the current world away and fold the {log.length} logged command{log.length === 1 ? "" : "s"} over the seed again. If the engine is deterministic, the head hash comes back identical.</p>
        <Button className="mt-4" variant="primary" onClick={() => setRebuilt(store.rebuild())}>
          Rebuild from {log.length} command{log.length === 1 ? "" : "s"}
        </Button>
        {rebuilt ? (
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[12.5px]" aria-live="polite">
            <dt className="text-muted">before</dt>
            <dd>{rebuilt.before}</dd>
            <dt className="text-muted">after</dt>
            <dd>{rebuilt.after}</dd>
            <dt className="text-muted">result</dt>
            <dd className={rebuilt.before === rebuilt.after ? "text-ok" : "text-bad"} data-testid="rebuild-result">
              {rebuilt.before === rebuilt.after ? "identical — state is a fold of the command log" : "DIFFERENT — the engine is not deterministic"}
            </dd>
          </dl>
        ) : null}

        <div className="mt-6 border-t border-line pt-4">
          <h5 className="text-[14.5px] font-semibold">Take the session with you</h5>
          <p className="mt-1 text-[13px] text-muted">
            The log is the whole session. An export is a disclosure like any other: it writes an egress row first, and leaves with Strava data and coach conversations shredded. Loading it reproduces the same audit chain.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={copy} disabled={!log.length}>
              Copy log
            </Button>
            <Button onClick={download} disabled={!log.length}>
              Download .json
            </Button>
            <label className="tap inline-flex cursor-pointer items-center rounded-full border border-line-strong px-5 text-[15px] font-semibold hover:border-ink">
              Load a file
              <input
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) load(await f.text());
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <label htmlFor="xr-import" className="mt-3 block text-[13px] text-muted">
            …or paste a log
          </label>
          <textarea id="xr-import" value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-line-strong bg-surface p-2 font-mono text-[12px] text-ink" placeholder='[{"input":{"type":"RSVP", …}, "actor":{…}}]' />
          <Button className="mt-2" disabled={!draft.trim()} onClick={() => load(draft)}>
            Load pasted log
          </Button>
          {message ? (
            <p className="mt-2 text-[13px]" aria-live="polite">
              {message}
            </p>
          ) : null}
        </div>
      </section>

      <section className="card p-4 sm:p-5 lg:order-first lg:col-span-2" aria-labelledby="xr-erasure">
        <div className="flex flex-wrap items-center gap-2">
          <h4 id="xr-erasure" className="text-[16px] font-semibold">
            Erasure that doesn&apos;t break the chain
          </h4>
          <RuleChip id="STRAVA-06" />
          <RuleChip id="WA-02" />
        </div>
        <div className="mt-2 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <div className="space-y-2 text-[13.5px] leading-relaxed text-muted">
            <p>
              The world can be rebuilt from the log, so deleting a record isn&apos;t enough: the log entry that created it still holds the data. When Sarah disconnects Strava, or her 7-day cache expires, or Maya asks the coach to forget, the restricted parts of those log entries are shredded too — the distance, the time, the provider id, the words.
            </p>
            <p>
              What stays is what the receipts already held: a digest, and what the engine derived (for a coach question, its intent and safety level). So replaying the shredded log lands on exactly the same receipts. Production would do the same with per-member encryption keys that are destroyed on deletion — crypto-shredding.
            </p>
          </div>
          <div>
            <dl className="grid grid-cols-3 gap-3">
              <Stat label="Erased" value={counts.erased} note="log entries shredded" />
              <Stat label="Still held" value={counts.held} note="the member still has them" />
              <Stat label="Strava cache" value={counts.strava} note="private panel records" />
            </dl>
            <Button className="mt-4" onClick={verifyErasure} disabled={!log.length}>
              Replay the erased log and compare
            </Button>
            {proof ? (
              <p className="mt-2 text-[13.5px]" aria-live="polite" data-testid="erasure-result">
                <span className={proof.same === proof.total ? "font-semibold text-ok" : "font-semibold text-bad"}>
                  {proof.same} of {proof.total} receipts identical
                </span>{" "}
                {proof.same === proof.total ? "after erasure — nothing restricted was needed to prove what happened." : "— the log no longer reproduces the chain."}
              </p>
            ) : (
              <p className="mt-2 text-[12.5px] text-muted">Try it: inject “Erasure keeps the chain” in the fault lab, then compare.</p>
            )}
          </div>
        </div>
      </section>

      <section className="card p-4 sm:p-5" aria-labelledby="xr-travel">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 id="xr-travel" className="text-[16px] font-semibold">
            Time travel (read-only)
          </h4>
          <Badge tone={n === log.length ? "ok" : "warn"}>{n === log.length ? "Now" : `${log.length - n} step${log.length - n === 1 ? "" : "s"} back`}</Badge>
        </div>
        <p className="mt-1 text-[13.5px] text-muted">Replay the first N commands into a separate copy of the world. The live demo is untouched.</p>
        <label htmlFor="xr-scrub" className="mt-4 block font-mono text-[12px] text-muted">
          After command {n} of {log.length}
        </label>
        <input
          id="xr-scrub"
          type="range"
          min={0}
          max={log.length}
          step={1}
          value={n}
          disabled={log.length === 0}
          onChange={(e) => {
            const v = Number(e.target.value);
            setPick(v >= log.length ? null : v);
          }}
          className="mt-2 h-11 w-full"
        />
        <div className="mt-3 rounded-xl bg-surface-2 p-3 text-[13.5px]">
          {step ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="num text-[12px] text-sun">#{step.seq}</span>
              <OutcomeBadge outcome={step.outcome} />
              <span className="min-w-0 flex-1">{step.summary}</span>
              <button type="button" onClick={() => onShow(step.seq)} className="font-mono text-[11.5px] text-accent-ink underline underline-offset-2">
                Follow it
              </button>
            </div>
          ) : (
            <span className="text-muted">The seeded world, before anyone did anything.</span>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat label="Season clock" value={<span className="text-[15px]">{tickLabel(w.clock)}</span>} />
          <Stat label="Maya's miles" value={seasonMiles(w, "maya")} />
          <Stat label="Sarah's miles" value={seasonMiles(w, "sarah")} />
          <Stat label="Detroit total" value={(w.projections.chapterSharedMiles.detroit ?? 0).toLocaleString("en-US")} note="as displayed" />
          <Stat label="Impact pool" value={`$${impactPool(w).available.toLocaleString("en-US")}`} note="available, signed only" />
          <Stat label="Coach ruleset" value={w.coach.activeRuleset} note={w.coach.drift ? "drift ON" : "drift off"} />
        </div>
        <p className="mt-4 font-mono text-[11.5px] text-muted">head hash at this point: {past.ledger.at(-1)?.hash ?? GENESIS}</p>
      </section>
    </div>
  );
}
