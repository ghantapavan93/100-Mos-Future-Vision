// How miles count (/xray): the phone brings real walks through the engine and
// the screen says, in plain words, what happened to each.
//  - each button changes the engine the way it promises (counted; the same walk
//    from a second app counted once; set aside; Strava's copy kept private;
//    typed miles count), read from the store itself;
//  - the guiding ring sits on the button for the next step, and moves on;
//  - the five "Try it" steps tick themselves off;
//  - "Why is my total…" lists where the miles came from;
//  - the words Kirk would catch are gone (Apple Health never "sends", no
//    "healthkit webhook", Strava never "never counts");
//  - no stage names, receipts or hashes on the page outside the closed record panel;
//  - no console errors; nothing scrolls sideways at 390 px.
//
//   npm run dev   (port 3240)
//   node scripts/check-behind.mjs

import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";

const BASE = process.env.LAB_URL ?? "http://localhost:3240";
const OUT = "shots/s5";
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const problems = [];
page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()}`));
page.on("pageerror", (e) => problems.push(`page: ${e.message}`));

let n = 0;
let failed = 0;
async function step(name, run) {
  n++;
  try {
    await run();
    console.log(`  ok  ${name}`);
  } catch (err) {
    failed++;
    console.log(`FAIL  ${name}\n      ${String(err.message).split("\n")[0]}`);
    await page.screenshot({ path: `${OUT}/fail-${n}.png` });
  }
}

const phone = () => page.getByRole("group", { name: "How miles count app" }).first();
const button = (title) => phone().getByRole("button", { name: new RegExp(`^${title}`) });
const tap = (title) => button(title).click();
/** Maya's counted total, as the phone shows it. */
const miles = async () => Number((await phone().getByTestId("maya-total").textContent())?.trim());
const stepDone = (label) =>
  page
    .getByRole("listitem")
    .filter({ hasText: label })
    .first()
    .evaluate((li) => li.className.includes("bg-ok-soft"));
/** The guiding ring is on this button (and on nothing else in the phone). */
const ringOn = async (title) => {
  await page.waitForTimeout(150);
  const ringed = await phone().locator(".step-ring").count();
  const here = await button(title).evaluate((b) => b.classList.contains("step-ring"));
  if (!here || ringed !== 1) throw new Error(`guiding ring not on "${title}" alone (${ringed} ringed)`);
};

await step("fresh session, five steps waiting, the ring on the first button", async () => {
  await page.goto(`${BASE}/xray`, { waitUntil: "networkidle" });
  await page.evaluate(() => sessionStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /One walk. Seven checks. Counted once./ }).waitFor();
  const counter = await page.getByText(/^0 of 5$/).count();
  if (!counter) throw new Error("step counter not at 0 of 5");
  await ringOn("Read Maya's evening walk");
  // What their app already does is labelled as theirs, in the phone.
  for (const title of ["Read Maya's evening walk", "Add miles by hand"]) {
    if (!(await button(title).textContent())?.includes("Your app today")) throw new Error(`"${title}" isn't labelled Your app today`);
  }
});

let start = 0;
await step("Read Maya's evening walk from Apple Health → counted, +1.4 mi", async () => {
  start = await miles();
  await button("Read Maya's evening walk").scrollIntoViewIfNeeded();
  const scrolled = await page.evaluate(() => window.scrollY);
  await tap("Read Maya's evening walk");
  await phone().getByText("Counted ✓", { exact: true }).waitFor();
  await phone().getByText("Read from Apple Health on Maya's phone, for Maya.").waitFor();
  await page.waitForTimeout(900);
  // Only the phone's screen scrolls to the result; the page stays put.
  const moved = (await page.evaluate(() => window.scrollY)) - scrolled;
  if (Math.abs(moved) > 2) throw new Error(`the page jumped ${moved}px when a button was tapped`);
  const after = await miles();
  if (Math.round((after - start) * 10) / 10 !== 1.4) throw new Error(`total went ${start} → ${after}`);
  if (!(await stepDone("Read Maya's evening walk"))) throw new Error("step 1 not ticked");
  await ringOn("The same walk, from her Garmin");
  await page.waitForTimeout(2200);
  await phone().screenshot({ path: `${OUT}/phone-walk.png` });
});

await step("The same walk from her Garmin → counted once, total unchanged", async () => {
  const before = await miles();
  await tap("The same walk, from her Garmin");
  await phone().getByText("Same walk — counted once", { exact: true }).waitFor();
  await phone().getByText(/Apple Health already has this walk/).waitFor();
  if ((await miles()) !== before) throw new Error("the second app's copy moved the total");
  if (!(await stepDone("Get the same walk from her Garmin"))) throw new Error("step 2 not ticked");
  await ringOn("Send a walk that looks off");
  await page.waitForTimeout(2200);
  await phone().screenshot({ path: `${OUT}/phone-garmin.png` });
});

await step("The same Garmin copy again → already counted, total unchanged", async () => {
  const before = await miles();
  await tap("The same walk, from her Garmin");
  await phone().getByText("Already counted", { exact: true }).waitFor();
  if ((await miles()) !== before) throw new Error("a repeat moved the total");
});

await step("Send a walk that looks off → set aside, total unchanged", async () => {
  const before = await miles();
  await tap("Send a walk that looks off");
  await phone().getByText(/Set aside — a person will look/).waitFor();
  if ((await miles()) !== before) throw new Error("a walk that looks off moved the total");
  if (!(await stepDone("Send a walk that looks off"))) throw new Error("step 3 not ticked");
  await page.waitForTimeout(2200);
  await phone().screenshot({ path: `${OUT}/phone-odd.png` });
});

await step("Send a run from Strava → Strava's copy private, total unchanged, said right", async () => {
  const before = await miles();
  await tap("Send a run from Strava");
  await phone().getByText("Strava's copy stays private", { exact: true }).waitFor();
  await phone().getByText(/Your miles still count — they come in from your watch or phone/).first().waitFor();
  if ((await miles()) !== before) throw new Error("Strava's copy reached the total");
  if (!(await stepDone("Send a run from Strava"))) throw new Error("step 4 not ticked");
  await page.waitForTimeout(2200);
  await phone().screenshot({ path: `${OUT}/phone-strava.png` });
});

await step("Add miles by hand → counted, +2 mi; twice is two walks", async () => {
  const before = await miles();
  await tap("Add miles by hand");
  await phone().getByText(/Typed by hand, through the same checks/).first().waitFor();
  await tap("Add miles by hand");
  await page.waitForTimeout(300);
  const after = await miles();
  if (Math.round((after - before) * 10) / 10 !== 4) throw new Error(`typed twice: ${before} → ${after}`);
  if (!(await stepDone("Add miles by hand"))) throw new Error("step 5 not ticked");
  await page.getByText(/That's the whole promise/).waitFor();
  if (await phone().locator(".step-ring").count()) throw new Error("the ring stayed on after the last step");
});

await step("What just happened speaks in plain words", async () => {
  const feed = (await page.getByText("What just happened").locator("..").innerText()).toLowerCase();
  for (const word of ["receipt", "quarantin", "strava-0", "apple-0", "reconcile", "authorize", "healthkit", "superseded"]) if (feed.includes(word)) throw new Error(`feed says "${word}"`);
});

await step("My total lists where each mile came from, and the second app's copy as kept once", async () => {
  await phone().getByRole("button", { name: "My total" }).click();
  await phone().getByRole("heading", { name: /Why is my total/ }).waitFor();
  for (const label of ["Apple Health", "Same walk, second app", "Being checked", "Counted"]) await phone().getByText(label, { exact: false }).first().waitFor();
  await phone().getByText(/Strava's own copy · stays private/).waitFor();
  await page.waitForTimeout(600);
  await phone().screenshot({ path: `${OUT}/phone-total.png` });
});

await step("no lab words, and none of the words Kirk would catch (the record panel stays closed)", async () => {
  const text = (await page.locator("main").innerText()).toLowerCase();
  for (const word of ["receipt", "hash", "authorize", "reconcile", "projection", "egress", "strava-03", "seq ", "healthkit", "apple health sends", "never counts", "never counted", "typed miles welcome", "for engineers"])
    if (text.includes(word)) throw new Error(`page says "${word}"`);
  const open = await page.locator("details[open]").count();
  if (open) throw new Error("a closed panel is open");
});

await step("Ideas say what's yours and what's new; Under the hood credits what's built", async () => {
  const ideas = page.locator("#ideas");
  await ideas.getByText("Builds on what you have").first().waitFor();
  await ideas.getByText("New", { exact: true }).first().waitFor();
  await ideas.getByText(/one odd walk could jump the leaderboard/).waitFor();
  await page.getByText("How we'd build it").click();
  await page.getByText("Already in your app").first().waitFor();
  await page.getByText("One door: ingest_run").waitFor();
  await page.getByText("How we'd build it").click();
});

await step("the record panel opens on request, names the phone and the webhook right", async () => {
  await page.getByText("Every step, and a replay").click();
  await page.getByRole("button", { name: /Rebuild/ }).first().waitFor({ timeout: 15000 });
  const panel = (await page.locator("details[open]").innerText()).toLowerCase();
  if (panel.includes("healthkit webhook")) throw new Error('the record says "healthkit webhook"');
  await page.getByText("Every step, and a replay").click();
});

await step("an idea's Show me drives the phone", async () => {
  // The try-it section's own Start over (the shell has one too).
  const tryIt = page.getByRole("region", { name: /Follow a mile/ });
  await tryIt.getByRole("button", { name: "Start over" }).click();
  await page.waitForTimeout(300);
  const card = page.getByRole("listitem").filter({ hasText: "A friendly fair check" });
  await card.getByRole("button", { name: /Show me/ }).click();
  await phone().getByText(/Set aside — a person will look/).waitFor();
});

await step("390 px: the phone fits and nothing scrolls sideways", async () => {
  const small = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  small.on("console", (m) => m.type() === "error" && problems.push(`phone console: ${m.text()}`));
  await small.goto(`${BASE}/xray`, { waitUntil: "networkidle" });
  const app = small.getByRole("group", { name: "How miles count app" }).last();
  await app.getByRole("button", { name: /^Read Maya's evening walk/ }).click();
  await app.getByText(/Counted ✓|Already counted/).first().waitFor();
  await small.waitForTimeout(1500);
  await small.screenshot({ path: `${OUT}/xray-390-sent.png` });
  const overflow = await small.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 1) throw new Error(`horizontal overflow ${overflow}px`);
  await small.close();
});

await step("no console errors", async () => {
  if (problems.length) throw new Error(problems.join(" | "));
});

await browser.close();
console.log(failed ? `\n${failed} of ${n} checks failed.` : `\n${n} checks passed.`);
process.exit(failed ? 1 : 0);
