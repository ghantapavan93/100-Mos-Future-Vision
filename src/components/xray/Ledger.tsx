"use client";

// The ledger: every receipt in this session, newest first. Filters narrow it;
// arrow keys move through it; "Pause live" freezes the list while you read.

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { Lens, Outcome, Receipt } from "@/domain/engine";
import { tickLabel } from "@/domain/calendar";
import type { Role } from "@/domain/types";
import { OUTCOME_LABEL, OutcomeBadge, cn } from "@/components/ui/kit";
import { loadStory } from "@/components/present/Present";
import { actors, store } from "@/lib/store";
import { actorLabel } from "./model";

const OUTCOMES: Outcome[] = ["applied", "noop", "rejected", "blocked", "deferred", "quarantined"];
/** The screens, named as the nav names them. */
const LENS_LABEL: Record<Lens, string> = {
  member: "Member",
  coach: "Ask a question",
  circles: "Circles",
  partner: "Sponsors",
  impact: "Giving back",
  founder: "Kayla's week",
  future: "Next 3 summers",
  xray: "How miles count",
};
const ROLES: Role[] = ["member", "organizer", "partner", "founder", "provider", "engineer", "system"];
/** Who acted, in the words the screens use. */
const ROLE_LABEL: Record<Role, string> = {
  member: "A member",
  organizer: "A City Lead",
  partner: "A sponsor",
  founder: "Kayla",
  provider: "A phone or watch app",
  engineer: "An engineer",
  system: "The app itself",
};

const selectClass = "h-11 min-w-0 rounded-xl border border-line-strong bg-surface px-3 text-[13.5px] text-ink";

export function Ledger({ ledger, selected, onSelect }: { ledger: Receipt[]; selected: number | null; onSelect: (seq: number) => void }) {
  const [outcome, setOutcome] = useState<Outcome | "all">("all");
  const [lens, setLens] = useState<Lens | "all">("all");
  const [role, setRole] = useState<Role | "all">("all");
  const [query, setQuery] = useState("");
  const [frozenAt, setFrozenAt] = useState<number | null>(null);
  const list = useRef<HTMLUListElement>(null);

  const visibleLedger = frozenAt === null ? ledger : ledger.slice(0, frozenAt);
  const waiting = frozenAt === null ? 0 : ledger.length - frozenAt;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...visibleLedger]
      .reverse()
      .filter((r) => outcome === "all" || r.outcome === outcome)
      .filter((r) => lens === "all" || r.lenses.includes(lens))
      .filter((r) => role === "all" || r.actor.role === role)
      .filter((r) => !q || `${r.type} ${r.summary} ${r.actor.id} ${r.ruleIds.join(" ")} ${r.meta.fault ?? ""}`.toLowerCase().includes(q));
  }, [visibleLedger, outcome, lens, role, query]);

  // Keep the selected receipt visible inside the list (without scrolling the page).
  useEffect(() => {
    const ul = list.current;
    const el = ul?.querySelector<HTMLElement>(`[data-seq="${selected}"]`);
    if (!ul || !el) return;
    const top = el.offsetTop;
    if (top < ul.scrollTop || top + el.offsetHeight > ul.scrollTop + ul.clientHeight) ul.scrollTop = Math.max(0, top - ul.clientHeight / 3);
  }, [selected, rows]);

  const move = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const at = rows.findIndex((r) => r.seq === selected);
    const next = e.key === "Home" ? 0 : e.key === "End" ? rows.length - 1 : Math.max(0, Math.min(rows.length - 1, at + (e.key === "ArrowDown" ? 1 : -1)));
    const target = rows[next];
    if (!target) return;
    onSelect(target.seq);
    list.current?.querySelector<HTMLButtonElement>(`[data-seq="${target.seq}"]`)?.focus();
  };

  return (
    <div className="card flex min-h-0 flex-col overflow-hidden">
      <div className="border-b border-line p-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="eyebrow">Ledger · {ledger.length} receipt{ledger.length === 1 ? "" : "s"}</h3>
          <button
            type="button"
            aria-pressed={frozenAt !== null}
            onClick={() => setFrozenAt(frozenAt === null ? ledger.length : null)}
            className={cn("h-9 rounded-full border px-3 text-[12.5px] font-semibold", frozenAt !== null ? "border-transparent bg-sun text-night" : "border-line-strong")}
          >
            {frozenAt !== null ? `Paused${waiting ? ` · ${waiting} new` : ""}` : "Pause live"}
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 2xl:grid-cols-4">
          <label className="sr-only" htmlFor="xr-outcome">Outcome</label>
          <select id="xr-outcome" className={selectClass} value={outcome} onChange={(e) => setOutcome(e.target.value as Outcome | "all")}>
            <option value="all">All outcomes</option>
            {OUTCOMES.map((o) => (
              <option key={o} value={o}>
                {OUTCOME_LABEL[o]}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="xr-lens">Screen</label>
          <select id="xr-lens" className={selectClass} value={lens} onChange={(e) => setLens(e.target.value as Lens | "all")}>
            <option value="all">All screens</option>
            {(Object.keys(LENS_LABEL) as Lens[]).map((l) => (
              <option key={l} value={l}>
                {LENS_LABEL[l]}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="xr-role">Who acted</label>
          <select id="xr-role" className={selectClass} value={role} onChange={(e) => setRole(e.target.value as Role | "all")}>
            <option value="all">Anyone</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="xr-q">Search receipts</label>
          <input id="xr-q" className={cn(selectClass, "placeholder:text-muted")} placeholder="Search: RSVP, Strava, Maya…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      {ledger.length === 0 ? (
        <EmptyLedger />
      ) : rows.length === 0 ? (
        <p className="p-4 text-[14px] text-muted">No receipt matches these filters.</p>
      ) : (
        <ul ref={list} role="listbox" aria-label="Receipts, newest first" onKeyDown={move} className="relative max-h-[560px] min-h-0 flex-1 overflow-y-auto">
          {rows.map((r) => {
            const active = r.seq === selected;
            return (
              <li key={r.seq} className="border-b border-line last:border-b-0">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  data-seq={r.seq}
                  tabIndex={active || (selected === null && r === rows[0]) ? 0 : -1}
                  onClick={() => onSelect(r.seq)}
                  className={cn("block w-full px-3 py-2.5 text-left transition-colors", active ? "bg-surface-2" : "hover:bg-[color-mix(in_srgb,var(--surface-2)_55%,transparent)]")}
                >
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className={cn("num w-9 text-[12px]", active ? "text-sun" : "text-muted")}>#{r.seq}</span>
                    <OutcomeBadge outcome={r.outcome} />
                    <span className="font-mono text-[12px] text-ink">{r.type}</span>
                    {r.meta.fault ? <span className="rounded-full border border-warn px-1.5 font-mono text-[11px] uppercase tracking-[0.05em] text-warn">fault</span> : null}
                    {r.meta.harness ? <span className="rounded-full border border-info px-1.5 font-mono text-[11px] uppercase tracking-[0.05em] text-info">harness</span> : null}
                  </div>
                  <p className="mt-1 line-clamp-2 pl-11 text-[13.5px] leading-snug">{r.summary}</p>
                  <p className="mt-0.5 pl-11 font-mono text-[11px] text-muted">
                    {actorLabel(r)} · {tickLabel(r.at)}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function EmptyLedger() {
  const go = (fn: () => void) => () => fn();
  return (
    <div className="p-4 text-[14px]">
      <p className="text-muted">Nothing has happened yet. Play the sample Saturday, tap something on any screen, or start with one action here.</p>
      <div className="mt-3 flex flex-col gap-2">
        <button type="button" className="tap rounded-xl bg-accent px-3 text-left text-[14px] font-semibold text-on-accent" onClick={() => loadStory()}>
          Play a sample Saturday — about 20 events
        </button>
        <button
          type="button"
          className="tap rounded-xl border border-line-strong px-3 text-left text-[13.5px] font-semibold hover:border-ink"
          onClick={go(() => store.dispatch({ type: "RSVP", payload: { memberId: "maya", eventId: "det-first-mile" } }, actors.member("maya"), { via: "xray-starter" }))}
        >
          Maya RSVPs to Saturday First Mile
        </button>
        <button
          type="button"
          className="tap rounded-xl border border-line-strong px-3 text-left text-[13.5px] font-semibold hover:border-ink"
          onClick={go(() => store.dispatch({ type: "PARTNER_DATA_REQUEST", payload: { proposalId: "pr-northline", request: "participant-list" } }, actors.partner("northline"), { via: "xray-starter" }))}
        >
          A sponsor asks for the participant list
        </button>
        <button
          type="button"
          className="tap rounded-xl border border-line-strong px-3 text-left text-[13.5px] font-semibold hover:border-ink"
          onClick={go(() => store.dispatch({ type: "RSVP", payload: { memberId: "maya", eventId: "det-first-mile" } }, actors.member("sarah"), { via: "xray-starter" }))}
        >
          Sarah tries to RSVP on Maya's behalf
        </button>
      </div>
    </div>
  );
}
