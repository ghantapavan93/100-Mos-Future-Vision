// End-to-end check of the member screen in headless Edge.
//   node scripts/check-member.mjs        (dev server on http://localhost:3240)
// Plays the "Try Maya's first week" steps on the phone and checks that each one
// really changed the shared world (the ring, the circle, the switches, the
// coach, a sealed note to her September self) and that the guiding ring
// follows the next step; that the note stays sealed until a September 1
// preview opens it, and is shared only by her choice; that what their app
// already does is labelled as theirs and none of the retired claims show; that
// the ideas' "Show me" links drive the phone; that "Start your summer" signs a
// new member up; and that a phone visitor gets the same app with no sideways
// scroll. Fails on any console error. Saves screenshots to shots/s1/.

import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";

const BASE = process.env.LAB_URL ?? "http://localhost:3240";
const SHOTS = "shots/s1";
await mkdir(SHOTS, { recursive: true });

const browser = await chromium.launch({ channel: "msedge", headless: true });
const problems = [];
let passed = 0;

async function run(width, height, steps) {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) problems.push(`[${width}] console: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`[${width}] page: ${e.message}`));
  await page.goto(BASE + "/member");
  await page.evaluate(() => sessionStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await steps(page);
  await page.close();
}

async function step(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.log(`FAIL  ${name}\n      ${String(err.message).split("\n")[0]}`);
    await browser.close();
    process.exit(1);
  }
}

const app = (page) => page.getByTestId("member-app");
const tab = (page, name) => app(page).getByRole("tab", { name }).click();
const ring = async (page) => Number((await app(page).getByTestId("ring-value").textContent()).trim());
const progress = (page, n) => page.locator("#try").getByText(`${n} of 6`, { exact: true }).waitFor({ timeout: 8000 });
const toTry = (page) => page.evaluate(() => document.querySelector("#try")?.scrollIntoView({ block: "start" }));
const idea = (page, title) => page.locator("#ideas").getByRole("listitem").filter({ hasText: title }).getByRole("button", { name: "Show me" });
/** The text of whatever on the phone carries the guiding ring right now (exactly one thing should). */
async function ringed(page) {
  const rings = page.locator("#try .step-ring");
  await page.waitForFunction(() => document.querySelectorAll("#try .step-ring").length === 1, null, { timeout: 5000 }).catch(() => {});
  const n = await rings.count();
  if (n !== 1) throw new Error(`${n} guiding rings on the phone`);
  // textContent, not innerText: a button styled in capitals still reads as it is written.
  return (await rings.textContent()).trim();
}

/** Claims this screen no longer makes: her own ideas pitched back, someone else's "Mile Zero", the speed claim, Strava "never counted", lab names. */
const RETIRED = [/Mile Zero/, /ranked by speed/i, /never counted/i, /not counted/i, /QUANTUM/, /Mile Moments/, /For Kirk/, /For Kayla/];
async function noRetiredClaims(page) {
  const text = await page.locator("main").innerText();
  const hit = RETIRED.find((r) => r.test(text));
  if (hit) throw new Error(`the page still says ${hit}`);
}

await run(1440, 1000, async (page) => {
  await step("the page opens on the 3D hero, three numbers and the try-it phone, nothing done yet", async () => {
    await page.getByRole("heading", { level: 1, name: /Four movers\. Four ways to 100\./ }).waitFor();
    await page.locator('[data-stage="member"]').waitFor({ state: "attached" });
    // A number that counts up carries its value as a label; a small one that stays still is plain text.
    const numbers = page.getByRole("region", { name: "In numbers" });
    await numbers.getByText("7 in 10", { exact: true }).or(numbers.getByLabel("7 in 10")).first().waitFor();
    // Joy, not fear: no death-risk number, and the gym number lives on Home only.
    const strip = await numbers.innerText();
    for (const gone of ["47%", "6 in 10", "dying"]) if (strip.includes(gone)) throw new Error("the member numbers still show " + gone);
    await toTry(page);
    await app(page).getByRole("heading", { name: /Maya/ }).waitFor();
    await progress(page, 0);
    await page.screenshot({ path: `${SHOTS}/member-try-0.png` });
  });

  await step("nothing they already have is pitched as ours, and the retired claims are gone", async () => {
    await noRetiredClaims(page);
    // The ring and days left, and the next walk (their Events tab), are labelled as their app's.
    await app(page).getByRole("region", { name: "Your summer" }).getByText("Your app today").waitFor();
    const ideas = await page.locator("#ideas").innerText();
    if (/Mile Moments|milestones/i.test(ideas)) throw new Error("their badges are still pitched as an idea");
    if (!/Builds on what you have/i.test(ideas)) throw new Error("no idea says what it builds on");
  });

  await step("Why it matters opens a short story and closes with Escape", async () => {
    await page.getByRole("button", { name: "Why it matters" }).first().click();
    const sheet = page.getByRole("dialog");
    await sheet.getByText("Maya has never called herself a runner.", { exact: false }).waitFor();
    await page.keyboard.press("Escape");
    await sheet.waitFor({ state: "detached" });
  });

  await step("the guiding ring starts on the Log tab", async () => {
    await toTry(page);
    const where = await ringed(page);
    if (!/Log/.test(where)) throw new Error(`ring is on "${where}"`);
  });

  await step("1 · log a walk: Quick add puts 1.2 mi on Maya's ring", async () => {
    const before = await ring(page);
    await tab(page, "Log");
    if ((await ringed(page)) !== "Save walk") throw new Error("the ring didn't move to Save walk");
    await app(page).getByTestId("example-walk").click();
    await tab(page, "Today");
    const after = await ring(page);
    if (Math.abs(after - before - 1.2) > 0.05) throw new Error(`ring ${before} → ${after}`);
    await progress(page, 1);
  });

  await step("2 · oops, sent twice: counted once, the ring doesn't move", async () => {
    const before = await ring(page);
    await tab(page, "Log");
    if ((await ringed(page)) !== "Send that walk again") throw new Error("the ring isn't on Send that walk again");
    await app(page).getByTestId("resend-walk").click();
    await app(page).getByText("Counted once", { exact: true }).waitFor();
    await tab(page, "Today");
    if ((await ring(page)) !== before) throw new Error("a resent walk changed the ring");
    await progress(page, 2);
  });

  await step("3 · join a circle from the Circles tab", async () => {
    if (!/Circles/.test(await ringed(page))) throw new Error("the ring isn't on the Circles tab");
    await tab(page, "Circles");
    await app(page).getByText(/No RSVP needed — just show up/).waitFor();
    await app(page).getByRole("button", { name: /^Join the .* circle$/ }).click();
    await app(page).getByRole("button", { name: /Leave circle/ }).waitFor();
    await progress(page, 3);
  });

  await step("4 · share Apple Health miles with the circle (a switch only Maya can flip)", async () => {
    await tab(page, "You");
    const sw = app(page).getByRole("switch", { name: "Share with my circle from Apple Health" });
    if ((await sw.getAttribute("aria-checked")) !== "false") throw new Error("Apple Health was already shared");
    await page
      .waitForFunction(() => document.querySelector('[data-step-target="share"]')?.classList.contains("step-ring"), null, { timeout: 5000 })
      .catch(() => {
        throw new Error("the ring isn't on the Apple Health switch");
      });
    await sw.click();
    if ((await sw.getAttribute("aria-checked")) !== "true") throw new Error("the switch didn't turn on");
    await progress(page, 4);
  });

  await step("5 · ask the coach about a missed week: a short answer", async () => {
    await tab(page, "Coach");
    await app(page).getByRole("button", { name: /I missed almost two weeks/ }).click();
    await app(page).getByRole("article", { name: "Coach's answer" }).waitFor();
    await progress(page, 5);
  });

  await step("6 · seal a note to her September self: the words stay hidden, and the try-it finishes", async () => {
    if (!/Today/.test(await ringed(page))) throw new Error("the ring isn't on the Today tab");
    await tab(page, "Today");
    const note = app(page).getByTestId("september-note");
    await note.scrollIntoViewIfNeeded();
    if ((await ringed(page)) !== "Seal it until September 1") throw new Error("the ring isn't on Seal it");
    if (!(await note.getByRole("button", { name: "Seal it until September 1" }).isDisabled())) throw new Error("an empty note can be sealed");
    await note.getByRole("button", { name: "I want to meet people" }).click();
    await note.getByRole("button", { name: "Seal it until September 1" }).click();
    await note.getByText("Sealed", { exact: true }).waitFor();
    await note.getByText(/Opens September 1 · \d+ days? to go/).waitFor();
    if ((await note.innerText()).includes("I want to meet people")) throw new Error("a sealed note shows its words");
    await progress(page, 6);
    await page.locator("#try").getByText("That's the member app", { exact: false }).waitFor();
    if (await page.locator("#try .step-ring").count()) throw new Error("a guiding ring is left after the last step");
    await toTry(page);
    await page.screenshot({ path: `${SHOTS}/member-try-done.png` });
  });

  await step("September 1, previewed: the note opens beside her summer story, private until she shares it", async () => {
    const note = app(page).getByTestId("september-note");
    await note.getByRole("button", { name: "Preview September 1" }).click();
    const opened = app(page).getByRole("region", { name: "Your note, opened" });
    await opened.getByText("Your summer story").waitFor();
    if ((await opened.getByTestId("september-note-text").innerText()) !== "“I want to meet people”") throw new Error("the opened note isn't her words");
    await opened.getByText("Private. Nobody sees it unless you choose to share.").waitFor();
    await opened.getByRole("button", { name: /^Share with / }).click();
    await opened.getByText(/^Shared with your .* circle\. You can take it back any time\.$/).waitFor();
    await opened.getByRole("button", { name: "Keep it private" }).click();
    await opened.getByText("Private. Nobody sees it unless you choose to share.").waitFor();
    await page.getByTestId("phone").screenshot({ path: `${SHOTS}/member-phone-september.png` });
    await opened.getByRole("button", { name: "Close" }).click();
  });

  await step("what just happened reads in plain words (no receipts, no rule ids)", async () => {
    const feed = await page.locator("#try").getByText("What just happened").locator("..").innerText();
    if (/receipt|#\d|[A-Z]{3,}-\d{2}/.test(feed)) throw new Error(`jargon in the feed: ${feed.slice(0, 160)}`);
  });

  await step("idea · Share card: Show me opens You, a badge (their milestones) makes a card with no map or time", async () => {
    await idea(page, "Share card").click();
    const moments = app(page).getByTestId("mile-moments");
    await moments.waitFor();
    await moments.getByText("Your app today").waitFor();
    await app(page).getByRole("button", { name: /^10 big deal, earned/ }).click();
    await app(page).getByTestId("share-card").click();
    await app(page).getByLabel("Share card").getByText("No map · no time · no pace").waitFor();
    await page.getByTestId("phone").screenshot({ path: `${SHOTS}/member-phone-moments.png` });
  });

  await step("idea · On-Track Helper: choosing days a week changes the plan", async () => {
    await idea(page, "On-Track Helper").click();
    const line = app(page).getByTestId("pace-line");
    await line.waitFor();
    const four = await line.innerText();
    await app(page).getByRole("button", { name: "3 days" }).click();
    const three = await line.innerText();
    if (four === three || !/3 days a week/.test(three)) throw new Error(`plan didn't change: "${four}" → "${three}"`);
  });

  await step("My circle total sits on Today (a no-rank total); the Summer Path has 100 stones", async () => {
    await page.locator("#ideas").getByText("My circle total").waitFor();
    await tab(page, "Today");
    await app(page).getByTestId("circle-total").getByRole("button", { name: "My circle" }).click();
    await app(page).getByTestId("circle-total").getByText("miles together").waitFor();
    const label = await app(page).getByTestId("summer-path").getByRole("img").getAttribute("aria-label");
    if (!/of 100 stones filled/.test(label ?? "")) throw new Error(`path label: ${label}`);
  });

  await step("switching person keeps everyone's state", async () => {
    const mine = await ring(page);
    await page.locator('[data-persona="james"]:visible').first().click();
    await app(page).getByRole("heading", { name: /James/ }).waitFor();
    await page.locator("#try").getByRole("button", { name: "Switch to Maya" }).click();
    await app(page).getByRole("heading", { name: /Maya/ }).waitFor();
    await tab(page, "Today");
    if ((await ring(page)) !== mine) throw new Error("Maya's miles changed after switching people");
  });

  await step("Sarah runs with Strava: her miles still count, Strava's own copy stays private", async () => {
    await page.locator('[data-persona="sarah"]:visible').first().click();
    await tab(page, "You");
    await app(page).getByText("Strava's own copy stays private — only you see it.").waitFor();
    await tab(page, "Log");
    await app(page).getByTestId("strava-honest").getByText("Run with Strava? Your miles still count.").waitFor();
  });

  await step("How we'd build it is closed until someone opens it, and credits what already exists", async () => {
    const details = page.locator("details").filter({ hasText: "How we'd build it" });
    if (await details.getAttribute("open")) throw new Error("open by default");
    await details.locator("summary").click();
    const saved = details.getByRole("listitem").filter({ hasText: "Every walk, saved once" });
    await saved.getByText("Already in your app").waitFor();
    await details.getByText("ingest_run", { exact: false }).waitFor();
  });

  await step("Start your summer: three questions, then a new member is counted", async () => {
    await page.locator('[data-persona="start-your-summer"]').click();
    await toTry(page);
    await app(page).getByText("Start your summer · 1 of 3").waitFor();
    await app(page).getByRole("button", { name: /^Walk/ }).click();
    await app(page).getByRole("button", { name: "Next" }).click();
    await app(page).getByLabel("Your first name").fill("Ana");
    await app(page).getByLabel("Your goal, in your words").fill("Walk to the lake and back");
    await app(page).getByLabel(/A note to your September self/).fill("I'm starting because I want my mornings back");
    await app(page).getByRole("button", { name: "Next" }).click();
    await app(page).getByText("No circle for now — just you.", { exact: false }).waitFor();
    await app(page).getByRole("button", { name: "Start my summer" }).click();
    await app(page).getByText("Start your summer · you're in").waitFor();
    await app(page).getByTestId("note-sealed").getByText(/sealed until/).waitFor();
    await app(page).getByRole("button", { name: "Open my app" }).click();
    await app(page).getByRole("heading", { name: /Ana/ }).waitFor();
    if ((await ring(page)) !== 0) throw new Error("a brand-new member doesn't start at 0");
    // Her own note waits for her, sealed; Maya's stays Maya's.
    const sealed = app(page).getByTestId("september-note");
    await sealed.getByText("Sealed", { exact: true }).waitFor();
    if ((await sealed.innerText()).includes("mornings back")) throw new Error("Ana's sealed note shows its words");
  });

  await step("Start over forgets the sealed notes, like everything else", async () => {
    await page.locator("#try").getByRole("button", { name: "Start over" }).click();
    await page.locator('[data-persona="maya"]:visible').first().click();
    await tab(page, "Today");
    await app(page).getByTestId("september-note").getByRole("button", { name: "Seal it until September 1" }).waitFor();
    await progress(page, 0);
  });
});

await run(390, 844, async (page) => {
  await step("phone: same app, no sideways scroll, quick add still counts", async () => {
    await toTry(page);
    await app(page).getByRole("heading", { name: /Maya/ }).waitFor();
    const before = await ring(page);
    await tab(page, "Log");
    await app(page).getByTestId("example-walk").click();
    await tab(page, "Today");
    if (Math.abs((await ring(page)) - before - 1.2) > 0.05) throw new Error("quick add didn't count on a phone");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 1) throw new Error(`horizontal overflow ${overflow}px`);
    if ((await page.getByTestId("member-app").count()) !== 1) throw new Error("the app is mounted more than once");
    await page.screenshot({ path: `${SHOTS}/member-390-try.png` });
  });
});

await browser.close();
if (problems.length) {
  console.log(`\nFAIL  no console errors\n      ${problems.join("\n      ")}`);
  process.exit(1);
}
console.log(`\n${passed} steps passed, no console errors.`);
