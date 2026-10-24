"use client";

import Link from "next/link";
import { dayLabel, timeLabel } from "@/domain/calendar";
import type { MemberView } from "@/domain/selectors";
import type { AccessNeed, World } from "@/domain/types";
import { Inspectable } from "@/components/inspect/Inspect";
import { Badge, cn } from "@/components/ui/kit";
import { AccessSummary, sweepCopy } from "@/components/circles/shared";
import { InlineReceipt, YourAppToday, useMemberAction } from "./shared";

export const ACCESS_LABEL: Record<AccessNeed, string> = {
  "step-free": "Step-free",
  restrooms: "Restrooms",
  shade: "Shade",
  seating: "Seating",
  "short-option": "1-mile option",
  transit: "Near transit",
};

export function CirclesTab({ view, world }: { view: MemberView; world: World }) {
  const m = view.member;
  const act = useMemberAction(m.id);
  const homeId = m.chapterId ?? m.homeChapterId;
  const chapter = world.chapters[homeId];
  const joined = m.chapterId === homeId;

  return (
    <div className="space-y-4 px-4 pb-6 pt-2">
      {chapter ? (
        <section aria-label="Your circle" className="rounded-[26px] bg-[linear-gradient(160deg,#3a1d0c,#1e1830)] p-5 text-[#f7f2ea]">
          <span className="font-mono text-[11.5px] font-bold uppercase tracking-[0.12em] text-[#ffc14d]">{joined ? "Your circle" : "Circle near you"}</span>
          <h2 className="mt-2 font-[family-name:var(--font-display)] text-[24px] font-black uppercase leading-none tracking-[-0.02em]">{chapter.name}</h2>
          <p className="mt-1 text-[13.5px] leading-snug text-[#cfc6b8]">{chapter.note}</p>
          <p className="mt-2 text-[13px] text-[#cfc6b8]">
            City Lead {chapter.leadName} · <span className="num">{chapter.backgroundMembers + chapter.members.length}</span> members
          </p>
          <button
            type="button"
            onClick={() =>
              joined ? act.run({ type: "LEAVE_CHAPTER", payload: { memberId: m.id } }) : act.run({ type: "JOIN_CHAPTER", payload: { memberId: m.id, chapterId: homeId } })
            }
            className={cn("mt-4 min-h-11 w-full rounded-full text-[14.5px] font-bold", joined ? "border border-white/40 text-[#f7f2ea]" : "bg-[#ff6a13] text-[#0c0b0a]")}
            data-step-target={joined ? undefined : "join"}
          >
            {joined ? "Leave circle (your miles stay yours)" : `Join the ${chapter.city} circle`}
          </button>
        </section>
      ) : null}

      <Inspectable id="rsvp">
        <section aria-label="Upcoming events" className="space-y-3">
          <div className="px-1">
            <div className="flex items-center justify-between gap-2">
              <span className="eyebrow">Walks coming up</span>
              <YourAppToday />
            </div>
            <p className="mt-1 text-[12.5px] leading-snug text-muted">No RSVP needed — just show up. “I&apos;m going” is optional; it helps your City Lead plan.</p>
          </div>
          {view.upcoming.length === 0 ? <p className="px-1 text-[14px] text-muted">Nothing scheduled yet. City Leads post new walks every week.</p> : null}
          {view.upcoming.map((e) => {
            const going = e.rsvps.length + e.backgroundRsvps;
            const sweep = sweepCopy(world, e);
            const cancelled = e.status === "cancelled";
            return (
              <article key={e.id} className={cn("rounded-[22px] border border-line bg-surface p-4", cancelled && "opacity-80")} aria-label={e.title}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="eyebrow">
                      {dayLabel(e.day)} · {timeLabel(e.startMinute)}
                    </div>
                    <h3 className={cn("mt-1 font-[family-name:var(--font-display)] text-[20px] font-black uppercase leading-tight tracking-[-0.02em]", cancelled && "line-through")}>{e.title}</h3>
                  </div>
                  {cancelled ? <Badge tone="bad">Cancelled</Badge> : e.going ? <Badge tone="ok">Going</Badge> : e.waitlisted ? <Badge tone="warn">Waitlist</Badge> : null}
                </div>
                <p className="mt-1 text-[13.5px] text-muted">{e.meetingArea}</p>
                {cancelled ? (
                  <p className="mt-2 rounded-xl bg-bad-soft px-3 py-2 text-[13.5px] text-bad">Cancelled: {e.cancelReason ?? "no reason given"}. Everyone going was told.</p>
                ) : (
                  <>
                    <p className="mt-2 text-[13.5px] leading-snug">{e.paceNote}</p>
                    {sweep ? <p className="mt-1 text-[13px] leading-snug text-muted">{sweep}</p> : <p className="mt-1 text-[13px] text-warn">No back walker named yet.</p>}
                    <div className="mt-2">
                      <Badge>{e.distanceOptions.map((d) => `${d} mi`).join(" or ")}</Badge>
                    </div>
                    <AccessSummary event={e} needs={m.needs} />
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="text-[12.5px] text-muted">
                        <span className="num">{going}</span> of <span className="num">{e.capacity}</span> going
                      </span>
                      {e.going || e.waitlisted ? (
                        <button type="button" onClick={() => act.run({ type: "CANCEL_RSVP", payload: { memberId: m.id, eventId: e.id } })} className="min-h-11 rounded-full border border-line-strong px-4 text-[14px] font-semibold">
                          {e.waitlisted ? "Leave waitlist" : "Can't make it"}
                        </button>
                      ) : (
                        <button type="button" onClick={() => act.run({ type: "RSVP", payload: { memberId: m.id, eventId: e.id } })} className="min-h-11 rounded-full border border-line-strong px-5 text-[14px] font-semibold hover:border-accent">
                          I&apos;m going
                        </button>
                      )}
                    </div>
                  </>
                )}
              </article>
            );
          })}
          <InlineReceipt receipt={act.last} />
          <p className="px-1 text-[13px] text-muted">
            City Leads see your first name{m.consents.needsToOrganizers ? " and the access needs you chose to share" : ""} — never your miles.{" "}
            <Link href="/circles" className="font-semibold text-accent-ink underline underline-offset-4">
              Open City Circles
            </Link>
          </p>
        </section>
      </Inspectable>
    </div>
  );
}
