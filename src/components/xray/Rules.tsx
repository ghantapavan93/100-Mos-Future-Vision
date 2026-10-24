"use client";

// The rule catalogue, and the purpose matrix: every data class × every purpose,
// decided live by the same `decide()` every selector calls, under the chosen
// member's current consents.

import { useState } from "react";
import { PURPOSES, PURPOSE_LABEL, RULES, decide, type Basis, type DataClass } from "@/domain/policy";
import { Badge, cn } from "@/components/ui/kit";
import { useWorld } from "@/lib/store";

const BASIS_LABEL: Record<Basis, string> = {
  "provider-terms": "Provider terms",
  "platform-policy": "Platform policy",
  law: "Law",
  "our-policy": "Our policy",
};

const CONFIDENCE: Record<string, { label: string; tone: "ok" | "info" | "warn" | "neutral" }> = {
  high: { label: "Explicit text", tone: "ok" },
  medium: { label: "Reasonable reading", tone: "info" },
  review: { label: "Needs legal review", tone: "warn" },
  ours: { label: "Our decision", tone: "neutral" },
};

const CLASSES: { id: DataClass; label: string }[] = [
  { id: "activity:manual", label: "Typed by the member" },
  { id: "activity:event_checkin", label: "Event check-in" },
  { id: "activity:healthkit", label: "Apple Health" },
  { id: "activity:health_connect", label: "Health Connect" },
  { id: "activity:garmin", label: "Garmin" },
  { id: "activity:strava", label: "Strava" },
  { id: "participation", label: "RSVPs and attendance" },
  { id: "contact-optin", label: "Email shared by opt-in" },
  { id: "coach-input", label: "What they told the coach" },
  { id: "access-needs", label: "Access needs they listed" },
];

export function Rules() {
  const w = useWorld();
  const [basis, setBasis] = useState<Basis | "all">("all");
  const [memberId, setMemberId] = useState("sarah");
  const [all, setAll] = useState(false);
  const member = w.members[memberId] ?? Object.values(w.members)[0]!;
  const rules = Object.values(RULES).filter((r) => basis === "all" || r.basis === basis);

  return (
    <div className="space-y-6">
      <section className="card overflow-hidden" aria-labelledby="xr-matrix">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line p-4">
          <div>
            <h4 id="xr-matrix" className="text-[16px] font-semibold">
              Purpose matrix — where {member.name}'s data may go
            </h4>
            <p className="mt-1 max-w-[680px] text-[13.5px] text-muted">Each cell is computed now by decide(), with {member.name}'s current consents. Provider terms are checked before consent, so a switch can never unlock what a provider forbids.</p>
          </div>
          <label className="flex items-center gap-2 text-[13.5px]">
            <span className="text-muted">Member</span>
            <select value={member.id} onChange={(e) => setMemberId(e.target.value)} className="h-11 rounded-xl border border-line-strong bg-surface px-3 text-ink">
              {Object.values(w.members).filter((m) => !m.background).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} · {m.persona}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-[12px]">
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-10 bg-surface p-2 text-left font-mono text-[11px] font-normal uppercase tracking-[0.06em] text-muted">
                  Data
                </th>
                {PURPOSES.map((p) => (
                  <th key={p} scope="col" className="p-2 text-left align-bottom text-[12px] font-semibold leading-tight">
                    {PURPOSE_LABEL[p]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CLASSES.map((c) => (
                <tr key={c.id} className="border-t border-line">
                  <th scope="row" className="sticky left-0 z-10 bg-surface p-2 text-left font-semibold">
                    {c.label}
                  </th>
                  {PURPOSES.map((p) => {
                    const d = decide(c.id, p, member.consents);
                    return (
                      <td key={p} className="p-1.5 align-top">
                        <div className={cn("rounded-lg px-2 py-1.5", d.allow ? "bg-ok-soft" : "bg-bad-soft")} title={RULES[d.ruleId]?.title}>
                          <div className={cn("font-mono text-[11px] font-bold tracking-[0.05em]", d.allow ? "text-ok" : "text-bad")}>{d.allow ? "ALLOW" : "BLOCK"}</div>
                          <div className="font-mono text-[10.5px] text-muted">
                            {d.ruleId}
                            {d.consent ? " · consent" : ""}
                            {d.attribution ? ` · ${d.attribution}` : ""}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="xr-catalogue">
        <div className="flex flex-wrap items-center gap-2">
          <h4 id="xr-catalogue" className="mr-2 text-[16px] font-semibold">
            Rule catalogue · {Object.keys(RULES).length} rules
          </h4>
          {(["all", "provider-terms", "platform-policy", "law", "our-policy"] as const).map((b) => (
            <button key={b} type="button" aria-pressed={basis === b} onClick={() => setBasis(b)} className={cn("h-9 rounded-full border px-3 text-[13px] font-semibold", basis === b ? "border-transparent bg-ink text-bg" : "border-line-strong text-muted hover:text-ink")}>
              {b === "all" ? "All" : BASIS_LABEL[b]}
            </button>
          ))}
        </div>
        <ul className="mt-3 grid gap-2 md:grid-cols-2">
          {(all ? rules : rules.slice(0, 8)).map((r) => (
            <li key={r.id} className="card p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[12px] font-bold text-sun">{r.id}</span>
                <Badge>{BASIS_LABEL[r.basis]}</Badge>
                <Badge tone={CONFIDENCE[r.confidence]?.tone ?? "neutral"}>{CONFIDENCE[r.confidence]?.label ?? r.confidence}</Badge>
              </div>
              <p className="mt-1.5 text-[14.5px] font-semibold leading-snug">{r.title}</p>
              <p className="mt-1 text-[13px] leading-snug text-muted">{r.summary}</p>
              <p className="mt-2 font-mono text-[11px] text-muted">
                {r.url ? (
                  <a href={r.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink">
                    {r.source}
                  </a>
                ) : (
                  r.source
                )}
              </p>
            </li>
          ))}
        </ul>
        {rules.length > 8 ? (
          <button type="button" onClick={() => setAll((a) => !a)} aria-expanded={all} className="tap mt-3 rounded-full border border-line-strong px-4 text-[14px] font-semibold hover:border-ink">
            {all ? "Show fewer" : `Show all ${rules.length} rules`}
          </button>
        ) : null}
        <p className="mt-3 text-[12.5px] text-muted">A demo's reading of each provider's published terms, read on 2026-10-22. Not legal advice; rules marked “Needs legal review” still have an open question.</p>
      </section>
    </div>
  );
}
