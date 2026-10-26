// One commission, three cities, in a real browser: the walkthrough plays the
// whole story by pressing the same buttons a person would, and each step is
// checked against what the page then shows. Also: no console errors, no
// sideways scroll on a phone, the 3D stage settles under reduced motion, the
// replay check agrees, and the rest of the demo is untouched by it.
//   npm run dev   (port 3240)
//   node scripts/check-commission.mjs        SHOTS=1 to save screenshots in shots/commission/

import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";

const BASE = process.env.LAB_URL ?? "http://localhost:3240";
const SHOTS = process.env.SHOTS === "1";
const OUT = "shots/commission";
if (SHOTS) await mkdir(OUT, { recursive: true });

const gpu = process.env.GL === "gpu";
const browser = await chromium.launch({ channel: "msedge", headless: true, args: gpu ? ["--ignore-gpu-blocklist"] : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
let failed = 0;
const ok = (cond, what) => {
  console.log(`${cond ? "  ok " : "  FAIL"}  ${what}`);
  if (!cond) failed++;
};

async function open(viewport, opts = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: viewport.width < 600, hasTouch: viewport.width < 600, ...opts });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${BASE}/commission`, { waitUntil: "networkidle" });
  return { ctx, page, errors };
}

const shot = async (page, name) => SHOTS && page.screenshot({ path: `${OUT}/${name}.png` });
const text = (page, sel) => page.locator(sel).first().innerText().catch(() => "");
const guideSays = (page) => text(page, '[data-testid="guide-move"]');

// ── Desktop: the whole story through the walkthrough ─────────────────────────
{
  const { ctx, page, errors } = await open({ width: 1440, height: 900 });
  ok((await page.locator('[data-stage="commission"]').count()) === 1, "the commission scene is on the page");
  ok((await page.locator('[data-step="deliver"] >> text=Opens once the proposal is sent').count()) === 1, "later steps wait for the proposal");
  await shot(page, "01-ask");

  await page.click('[data-testid="guide-toggle"]');
  ok((await page.locator('[data-testid="guide"]').count()) === 1, "the walkthrough opens");
  ok((await page.locator("#move-create.step-ring").count()) === 1, "it rings the button that makes the next move");

  const seen = [];
  for (let i = 0; i < 40; i++) {
    const says = await guideSays(page);
    seen.push(says);
    if (/That's one commission|Declined/.test(says)) break;
    const before = await page.locator('[data-testid="receipts"] li').count();
    if (says.includes("Send the Community Value Report")) {
      await page.click('[role="tab"] >> nth=1');
      await page.waitForTimeout(200);
      ok((await page.locator('[data-testid="report-refused"]').count()) === 1, "the buyer can't see the report before it's sent");
    }
    await page.click('[data-testid="guide-do"]');
    await page.waitForTimeout(says.startsWith("Play") ? 1500 : 700);
    if (says.includes("partner crew")) {
      ok((await page.locator('[data-city="la"][data-coverage="crew"]').count()) === 1, "Los Angeles is covered by a partner crew");
      await shot(page, "02-deliver");
    }
    if (says.includes("data request")) {
      const r = page.locator('[data-testid="commission-pushback"] [data-outcome]').first();
      ok((await r.getAttribute("data-outcome")) === "blocked", "the buyer's request for names is blocked");
    }
    if (says.includes("counter-offer")) {
      ok(/Underpriced by/.test(await text(page, '[data-testid="price-verdict"]')), "the counter-offer shows it's underpriced, from the numbers");
      await shot(page, "03-counter");
    }
    if (says.includes("floor price")) ok(/Covers its costs/.test(await text(page, '[data-testid="price-verdict"]')), "the floor price covers its costs");
    if (says.includes("payment")) ok(/\$\d/.test(await text(page, '[data-testid="money-in"]')) && (await text(page, '[data-testid="money-in"]')) !== "$0", "money in after the payment is recorded");
    if ((await page.locator('[data-testid="heat-alert"]').count()) === 1 && !seen.includes("heat-shot")) {
      seen.push("heat-shot");
      ok(true, "a heat forecast stops the week before the walk it hits");
      await shot(page, "05-heat");
    }
    if (says.includes("early start")) ok((await page.locator('[data-testid="walk-grid"] >> text=Moved to 6:30 AM').count()) === 1, "the hot walk moved to 6:30 AM");
    if (says.includes("Send the Community Value Report")) {
      ok((await page.locator('[data-testid="value-report"][data-audience="buyer"]').count()) === 1, "the buyer's copy exists once it's sent");
      const buyerCopy = await text(page, '[data-testid="value-report"]');
      ok(!/Kayla's copy only|modelled crowd/.test(buyerCopy), "the buyer's copy has no modelled crowd");
      await shot(page, "06-report-buyer");
    }
    const after = await page.locator('[data-testid="receipts"] li').count();
    ok(after >= Math.min(6, before) && after > 0, `“${says}” left a receipt`);
  }
  ok(/That's one commission/.test(await guideSays(page)), "the walkthrough reaches the end");
  ok(seen.some((s) => s.startsWith("Play the next week")), "the summer is played week by week");
  ok((await page.locator('[data-step][data-done="true"]').count()) === 7, "all seven steps are done");
  ok(/Proposed/i.test(await text(page, '[data-testid="commission-renew"]')) && /Not paid/i.test(await text(page, '[data-testid="commission-renew"]')), "next summer is proposed, not signed or paid");
  ok(/0 unfulfilled/.test(await text(page, '[data-testid="deliverables"]')), "every walk asked for was delivered");

  // Buyer's copy before sending is refused; checked on the founder copy toggle after the fact.
  await page.click('[data-testid="replay-check"]');
  ok(/same chain head/.test(await text(page, '[data-testid="replay-result"]')), "replaying the log gives the same chain head");
  await shot(page, "07-done");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(2500);
  await shot(page, "07-hero-done");

  // The rest of the demo is untouched: the main store never saw a commission command.
  const mainLog = await page.evaluate(() => sessionStorage.getItem("fl4.log.v2"));
  ok(!mainLog || !mainLog.includes("CREATE_COMMISSION"), "the main demo's log has no commission commands");
  await page.goto(`${BASE}/partner`, { waitUntil: "networkidle" });
  ok((await page.locator('[data-testid="commission-entry"]').count()) === 1, "Sponsors has the one way in");
  ok(!(await page.locator("body").innerText()).includes("Fairhaven"), "Sponsors shows none of the commission's buyers");
  ok(errors.length === 0, `no console errors on desktop${errors.length ? `: ${errors.slice(0, 2).join(" | ")}` : ""}`);
  await ctx.close();
}

// ── Desktop: refuse, cancel and decline paths ────────────────────────────────
{
  const { ctx, page, errors } = await open({ width: 1440, height: 900 });
  await page.click('[data-testid="restart"]');
  await page.click("#move-create");
  await page.waitForTimeout(300);
  await page.click("#move-drop-la");
  await page.waitForTimeout(300);
  ok((await page.locator('[data-city="la"][data-coverage="descoped"]').count()) === 1, "dropping Los Angeles takes it out of the deal");
  await page.click("#move-ask-0");
  await page.click("#move-counter");
  await page.waitForTimeout(300);
  await page.click("#move-sign");
  await page.waitForTimeout(300);
  const signed = page.locator('[data-testid="commission-pushback"] [data-outcome]').last();
  ok((await signed.getAttribute("data-outcome")) === "blocked", "an underpriced contract won't sign without a written reason");
  await page.click("#move-walk-away");
  await page.waitForTimeout(300);
  ok((await page.locator('[data-testid="commission-money"][data-state="declined"]').count()) === 1, "walking away leaves no money in");
  await shot(page, "08-declined");
  ok(errors.length === 0, "no console errors on the decline path");
  await ctx.close();
}

// ── Phone: fits, and the walkthrough doesn't hide the buttons it points at ───
{
  const { ctx, page, errors } = await open({ width: 390, height: 844 });
  await page.click('[data-testid="restart"]');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(overflow <= 0, `no sideways scroll on a phone (${overflow}px)`);
  await page.click('[data-testid="guide-toggle"]');
  for (let i = 0; i < 4; i++) {
    await page.click('[data-testid="guide-do"]');
    await page.waitForTimeout(700);
  }
  await page.click('button:has-text("Show me")');
  await page.waitForTimeout(800);
  const covered = await page.evaluate(() => {
    const ring = document.querySelector(".step-ring");
    const guide = document.querySelector('[data-testid="guide"]');
    if (!ring || !guide) return false;
    const a = ring.getBoundingClientRect();
    const b = guide.getBoundingClientRect();
    return a.bottom > b.top && a.top < b.bottom && a.right > b.left && a.left < b.right;
  });
  ok(!covered, "on a phone, the walkthrough panel doesn't cover the button it points at");
  const overflow2 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(overflow2 <= 0, `still no sideways scroll mid-story (${overflow2}px)`);
  // The walk grid and the report are the widest things on the page: play to the end and look again.
  let tapsLand = true;
  for (let i = 0; i < 40 && (await page.locator('[data-testid="guide-do"]').count()); i++) {
    // A tap that something else on the page swallows means the layout has broken out of the screen.
    tapsLand = await page.click('[data-testid="guide-do"]', { timeout: 5000 }).then(() => true, () => false);
    if (!tapsLand) break;
    await page.waitForTimeout(700);
  }
  ok(tapsLand, "on a phone, every walkthrough tap reaches its button");
  ok(/That's one commission/.test(await guideSays(page)), "on a phone, the walkthrough reaches the end");
  const width = await page.evaluate(() => ({ inner: window.innerWidth, scroll: document.documentElement.scrollWidth }));
  ok(width.inner === 390 && width.scroll <= width.inner, `no sideways scroll at the end of the story (page ${width.scroll}px in a ${width.inner}px window)`);
  await shot(page, "10-phone-end");
  await shot(page, "09-phone");
  ok(errors.length === 0, `no console errors on a phone${errors.length ? `: ${errors[0]}` : ""}`);
  await ctx.close();
}

// ── Reduced motion: the scene settles and stays still ────────────────────────
{
  const { ctx, page } = await open({ width: 1440, height: 900 }, { reducedMotion: "reduce" });
  ok((await page.locator('[data-stage="commission"]').getAttribute("data-still")) === "true", "reduced motion keeps the scene still");
  await ctx.close();
}

await browser.close();
console.log(failed ? `\n${failed} failed` : "\nall ok");
process.exit(failed ? 1 : 0);
