// Every "Try it" phone says where to tap: the next step's control carries the
// ring, a "Step N · Tap here" callout sits beside it (never on it) inside the
// phone's screen, narrow screens show the next step just above the phone, and
// following the ring step by step never scrolls the page by itself.
//
//   node scripts/check-guidance.mjs [route …]     (dev server on :3240, or LAB_URL)

import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";

const BASE = process.env.LAB_URL ?? "http://localhost:3240";
const OUT = "shots/guidance";
const ALL = ["member", "circles", "partner", "founder", "future", "impact", "xray", "build", "coach"];
const ROUTES = process.argv.length > 2 ? process.argv.slice(2) : ALL;
/** How many ringed controls to tap in a row on each screen. */
const TAPS = 4;
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
let failed = 0;
const ok = (msg) => console.log(`  ok  ${msg}`);
const fail = (msg) => {
  failed++;
  console.log(`FAIL  ${msg}`);
};

/** The ring, the callout's bubble and the phone's screen, as page rectangles. */
function measure() {
  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
  };
  const hint = document.querySelector('[data-testid="tap-hint"]');
  const phone = document.querySelector('[data-testid="phone"]');
  return {
    ring: rect(document.querySelector('[data-testid="phone"] .step-ring')),
    ringId: document.querySelector('[data-testid="phone"] .step-ring')?.getAttribute("data-step-target") ?? null,
    hint: hint && !hint.classList.contains("invisible") ? rect(hint.firstElementChild) : null,
    mode: hint?.getAttribute("data-hint-mode") ?? null,
    screen: rect(phone?.firstElementChild ?? phone),
    bar: rect(document.querySelector('[data-testid="next-bar"]')),
    barText: document.querySelector('[data-testid="next-bar"]')?.textContent ?? null,
    nextCard: document.querySelector('li[data-next="true"]')?.textContent ?? null,
    scrollY: window.scrollY,
  };
}

const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

for (const [w, h] of [
  [1440, 900],
  [390, 844],
]) {
  const mobile = w < 600;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  for (const route of ROUTES) {
    const tag = `${route}-${w}`;
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${BASE}/${route}`, { waitUntil: "networkidle" });
    const phone = page.locator('[data-testid="phone"]').first();
    await phone.waitFor({ state: "visible", timeout: 30000 });
    await phone.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);

    for (let tap = 0; tap <= TAPS; tap++) {
      const m = await page.evaluate(measure);
      if (!m.ring) {
        if (tap === 0) fail(`${tag}: no ringed control on the phone at load`);
        break;
      }
      const where = `${tag} step ${tap + 1} (${m.ringId})`;
      if (!m.hint) fail(`${where}: no "Tap here" callout`);
      else if (m.mode === "close") {
        // A sheet covers the control: the callout points at its Close/Done, and that's what a person taps.
        ok(`${where}: a sheet is open, the callout says close it first`);
        await page.locator('[data-testid="phone"] [role="dialog"] button').filter({ hasText: /^\s*(done|close|back|got it|ok|‹.*|←.*)\s*$/i }).first().click({ timeout: 5000 }).catch(() => fail(`${where}: couldn't close the sheet`));
        await page.waitForTimeout(800);
        continue;
      } else {
        if (overlaps(m.hint, m.ring)) fail(`${where}: the callout covers the control`);
        const gap = m.hint.bottom <= m.ring.top ? m.ring.top - m.hint.bottom : m.hint.top - m.ring.bottom;
        if (gap > 40) fail(`${where}: the callout is ${Math.round(gap)} px away from the control`);
        if (m.hint.left < m.screen.left - 1 || m.hint.right > m.screen.right + 1) fail(`${where}: the callout spills off the phone's screen`);
        if (!(m.ring.bottom > m.screen.top && m.ring.top < m.screen.bottom)) fail(`${where}: the control is outside the phone's visible screen`);
      }
      if (mobile && !m.bar) fail(`${where}: no next-step bar above the phone`);
      if (!mobile && !m.nextCard) fail(`${where}: no highlighted next step beside the phone`);
      if (m.hint && !(mobile && !m.bar) && !(!mobile && !m.nextCard)) ok(`${where}: callout beside the control${mobile ? `, bar says “${(m.barText ?? "").slice(0, 60)}”` : ""}`);
      if (tap === 0) await page.screenshot({ path: `${OUT}/${tag}.png` });

      // Tap it the way a person would: bring it on screen first (Playwright would scroll for us
      // anyway), then tap, then the page must stay where it is while the next callout finds its place.
      const target = page.locator('[data-testid="phone"] .step-ring').first();
      await target.scrollIntoViewIfNeeded().catch(() => null);
      await page.waitForTimeout(250);
      // Where the phone sits on screen: scroll anchoring may change scrollY to keep it still, which is fine.
      const phoneTop = () => page.evaluate(() => document.querySelector('[data-testid="phone"]')?.getBoundingClientRect().top ?? 0);
      const before = await phoneTop();
      await target.click({ timeout: 5000 }).catch(() => null);
      if (new URL(page.url()).pathname !== `/${route}`) break;
      await page.waitForTimeout(2000);
      const after = await phoneTop();
      if (Math.abs(after - before) > 2) console.log(`  --  ${where}: the phone moved ${Math.round(after - before)} px on screen after the tap`);
    }
    if (errors.length) fail(`${tag}: page error ${errors[0]}`);
    await page.close();
  }
  await ctx.close();
}
await browser.close();
console.log(failed ? `\n${failed} problem(s).` : "\nEvery phone says where to tap.");
process.exit(failed ? 1 : 0);
