"use client";

import Link from "next/link";
import { Pause, Play } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { InspectDrawer } from "@/components/inspect/Inspect";
import { OUTCOME_WORDS, plain } from "@/components/demo/plain";
import { cn } from "@/components/ui/kit";
import { ACTS, lensFor, LENSES, lensesIn } from "@/lib/lenses";
import { store, useUI } from "@/lib/store";
import { PresentOverlay } from "@/components/present/Present";

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const lens = lensFor(pathname);
  const ui = useUI();
  const [menu, setMenu] = useState(false);

  // The pre-paint script in layout.tsx sets the mode before first paint; this keeps it in step on navigation.
  useEffect(() => {
    document.documentElement.dataset.mode = lens.mode;
  }, [lens.mode]);

  useEffect(() => {
    document.documentElement.dataset.motion = ui.motionPaused ? "paused" : "running";
  }, [ui.motionPaused]);

  useEffect(() => setMenu(false), [pathname]);
  // Esc closes the menu.
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      // Alt-chords only (WCAG 2.1.4): a single letter must never trigger anything by itself.
      if (!e.altKey || e.metaKey || e.ctrlKey) return;
      if (e.code === "KeyI") {
        e.preventDefault();
        store.setUI({ inspect: !store.get().ui.inspect });
      }
      if (e.code === "Period") {
        e.preventDefault();
        store.setUI({ motionPaused: !store.get().ui.motionPaused });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // The presenter's second window shows only the notes.
  if (pathname === "/notes") return <>{children}</>;

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[90] focus:rounded-full focus:bg-surface focus:px-4 focus:py-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-50 border-b border-line bg-bg/95">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-3 px-4 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="100 Miles of Summer, home">
            {/* The movement's mark, used with the team's permission (public/brand). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo.jpg" alt="" width={34} height={34} className="size-[34px] rounded-md shadow-[0_0_18px_-4px_rgba(255,106,19,0.7)]" />
            <span className="flex flex-col leading-none">
              <span className="hidden font-[family-name:var(--font-display)] text-[15px] font-black uppercase tracking-[-0.01em] min-[420px]:inline">100 Miles</span>
              <span className="mt-0.5 hidden font-mono text-[10px] uppercase tracking-[0.18em] text-accent-ink sm:inline">Year 10 · Summer 2027</span>
            </span>
          </Link>
          <nav aria-label="Lenses" className="ml-2 hidden min-w-0 flex-1 items-center gap-0.5 min-[1180px]:flex">
            {LENSES.filter((l) => l.primary).map((l) => (
              <NavLink key={l.href} lens={l} active={l === lens} />
            ))}
            <span aria-hidden className="mx-2 hidden h-5 w-px bg-line-strong/60 min-[1400px]:block" />
            {LENSES.filter((l) => !l.primary).map((l) => (
              <NavLink key={l.href} lens={l} active={l === lens} quiet />
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => store.setUI({ motionPaused: !ui.motionPaused })}
              aria-pressed={ui.motionPaused}
              aria-label={ui.motionPaused ? "Resume motion" : "Pause motion"}
              className={cn("hidden h-9 w-9 items-center justify-center rounded-full border md:inline-flex", ui.motionPaused ? "border-transparent bg-ink text-bg" : "border-line-strong")}
              title={`${ui.motionPaused ? "Resume" : "Pause"} motion (Alt+.)`}
            >
              {ui.motionPaused ? <Play size={15} aria-hidden /> : <Pause size={15} aria-hidden />}
            </button>
            <button
              type="button"
              onClick={() => store.setUI({ present: ui.present === null ? 0 : null })}
              aria-pressed={ui.present !== null}
              className={cn("h-9 rounded-full px-3 text-[13px] font-semibold", ui.present !== null ? "bg-ink text-bg" : "border border-line-strong")}
            >
              {ui.present !== null ? "Touring" : "Tour"}
            </button>
            <button type="button" className="h-9 rounded-full border border-line-strong px-3 text-[13px] font-semibold min-[1400px]:hidden" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
              <span className="min-[1180px]:hidden">Menu</span>
              <span className="hidden min-[1180px]:inline">More</span>
            </button>
          </div>
        </div>
        {menu ? (
          <nav aria-label="Lenses" className="max-h-[calc(100svh-56px)] overflow-y-auto border-t border-line bg-bg px-4 pb-4 pt-3 min-[1400px]:hidden">
            {/* The five acts, in story order: the same grouping as the map on Home. */}
            <ol className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-5">
              {ACTS.map((act) => (
                <li key={act.id}>
                  <div className="flex items-baseline gap-2 px-1">
                    <span className="num text-[12px] font-black text-accent-ink">{act.id}</span>
                    <span className="eyebrow">{act.title}</span>
                  </div>
                  <ul className="mt-1.5 grid gap-1">
                    {lensesIn(act.id).map((l) => (
                      <li key={l.href}>
                        <Link href={l.href} aria-current={l === lens ? "page" : undefined} className={cn("tap flex flex-col justify-center rounded-xl px-3 py-2", l === lens ? "bg-ink text-bg" : "hover:bg-surface-2")}>
                          <span className="text-[15px] font-semibold">{l.label}</span>
                          <span className={cn("text-[12px]", l === lens ? "opacity-75" : "text-muted")}>For {l.who}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => store.setUI({ motionPaused: !ui.motionPaused })} aria-pressed={ui.motionPaused} className="tap rounded-full border border-line-strong px-4 text-[14px] font-semibold">
                {ui.motionPaused ? "Motion paused" : "Pause motion"}
              </button>
              <ResetButton />
            </div>
          </nav>
        ) : null}
      </header>
      <main id="main" className="pb-10">
        {children}
      </main>
      <footer data-mode={lens.mode === "dawn" ? "day" : lens.mode} className="relative overflow-hidden bg-bg">
        <div className="mx-auto max-w-[1240px] px-4 pb-8 pt-16 sm:px-6 lg:px-8">
          <div className="grid gap-10 border-t border-line pt-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
            <div>
              <p className="max-w-[34ch] font-[family-name:var(--font-display)] text-[22px] font-black uppercase leading-[1.05] tracking-[-0.02em] text-ink">
                Nine summers in. <span className="text-accent">The next hundred miles start here.</span>
              </p>
              <p className="mt-3 max-w-[42ch] text-[13.5px] leading-relaxed text-muted">The people and walks inside are samples, so every screen can be tried. The research numbers are real.</p>
            </div>
            {/* Acts 2–5; the first act is Home itself. */}
            {ACTS.filter((act) => act.id !== 1).map((act) => (
              <div key={act.id}>
                <div className="eyebrow">{act.title}</div>
                <ul className="mt-3 space-y-2">
                  {lensesIn(act.id).map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="group inline-flex items-center gap-1.5 text-[14.5px] font-semibold text-ink/85 hover:text-ink">
                        {l.label}
                        <span aria-hidden className="text-accent opacity-0 transition-opacity group-hover:opacity-100">→</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-3 text-[12.5px] text-muted">
            <span>100 Miles of Summer · Year 10 · Summer 2027</span>
            <ResetButton />
          </div>
        </div>
        {/* The mark, huge and faint: the last thing on every page. */}
        <div aria-hidden className="pointer-events-none select-none px-4 pb-2 text-center font-[family-name:var(--font-display)] text-[clamp(64px,17vw,260px)] font-black uppercase leading-[0.8] tracking-[-0.06em] text-ink/[0.05]">
          100 Miles
        </div>
      </footer>
      <ReceiptToast />
      <InspectDrawer />
      <PresentOverlay />
    </>
  );
}

function NavLink({ lens, active, quiet = false }: { lens: (typeof LENSES)[number]; active: boolean; quiet?: boolean }) {
  return (
    <Link
      href={lens.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "whitespace-nowrap rounded-full px-3 py-1.5 font-semibold transition-colors",
        // Below 1400px the quiet four live under "More", except the one you're on.
        quiet ? cn("text-[12.5px]", !active && "hidden min-[1400px]:inline") : "text-[13.5px]",
        active ? "bg-ink text-bg" : quiet ? "text-muted/80 hover:text-ink" : "text-muted hover:text-ink",
      )}
    >
      {lens.short}
    </Link>
  );
}

function ResetButton() {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3500);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      onClick={() => {
        if (!armed) return setArmed(true);
        store.reset();
        setArmed(false);
      }}
      className={cn("tap rounded-full border px-4 text-[13.5px] font-semibold", armed ? "border-bad text-bad" : "border-line-strong")}
    >
      {armed ? "Tap again to start over" : "Start over"}
    </button>
  );
}

function ReceiptToast() {
  const { toast, present } = useUI();
  return (
    <>
      {/* Always mounted, so screen readers announce each new result rather than missing an inserted region. */}
      <div className="sr-only" role="status" aria-live="polite">
        {toast ? plain(toast.summary) : ""}
      </div>
      {toast ? <VisibleToast toast={toast} touring={present !== null} /> : null}
    </>
  );
}

function VisibleToast({ toast, touring }: { toast: NonNullable<ReturnType<typeof useUI>["toast"]>; touring: boolean }) {
  return (
    <div className={cn("pointer-events-none fixed bottom-4 left-4 right-4 z-[70] flex justify-center sm:right-auto sm:justify-start", touring && "max-sm:bottom-auto max-sm:top-[64px]")}>
      <div data-mode="day" className="rise-in pointer-events-auto card flex max-w-[520px] items-start gap-3 p-3 pr-4">
        <span className={cn("mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black uppercase tracking-[0.08em]", toast.outcome === "applied" ? "bg-ok-soft text-ok" : toast.outcome === "rejected" ? "bg-bad-soft text-bad" : "bg-surface-2 text-muted")}>
          {OUTCOME_WORDS[toast.outcome]}
        </span>
        <div className="min-w-0 text-[14px] leading-snug">{plain(toast.summary)}</div>
      </div>
    </div>
  );
}
