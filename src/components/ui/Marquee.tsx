// The orange band from the team's proto: the movement's lines running across
// the page. Decorative (screen readers skip it; the same lines appear in the
// page's own words), and it stands still when motion is paused or reduced.

import { cn } from "./kit";

/** The movement's own public lines. */
export const MOVEMENT_LINES = ["Your pace. Your journey. Our community.", "Strut · stride · roll", "All paces welcome", "100 miles · May 1 – Aug 31", "The Year 10 start line"];

export function Marquee({ lines = MOVEMENT_LINES, tone = "accent", className }: { lines?: string[]; tone?: "accent" | "dark"; className?: string }) {
  const run = lines.map((l) => `${l} •`).join(" ");
  return (
    <div
      aria-hidden
      className={cn(
        "marquee py-3.5",
        tone === "accent" ? "bg-accent text-on-accent shadow-[0_0_60px_-10px_rgba(255,106,19,0.8)]" : "border-y border-line bg-surface text-accent-ink",
        className,
      )}
    >
      {[0, 1].map((k) => (
        <div key={k}>
          <span className="whitespace-nowrap pr-6 font-[family-name:var(--font-display)] text-[clamp(18px,2.2vw,30px)] font-black uppercase italic leading-none tracking-[-0.01em]">
            {run} {run}
          </span>
        </div>
      ))}
    </div>
  );
}
