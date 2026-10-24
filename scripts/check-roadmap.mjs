// End-to-end check of the Roadmap (/build) in headless Edge, against the
// running dev server (npm run dev, port 3240).
//
//   node scripts/check-roadmap.mjs
//
// Acts only through the phone: opens the first Year 10 step (dates, finish
// line, size, Kayla's call), follows a card's "Try it" link to the screen that
// shows it, comes back, opens Ready now, Quick fixes (today's numbers first)
// and Later, and ticks off every "Try it" step, following the guiding ring.
// Fails on any console error, horizontal overflow, or lab jargon in the
// page's text.

import { chromium } from "playwright-core";

const BASE = process.env.LAB_URL ?? "http://localhost:3240";
const OUT = "shots/r3/r4";
const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const problems = [];
page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()}`));
page.on("pageerror", (e) => problems.push(`page: ${e.message}`));

let passed = 0;
async function step(name, run) {
  try {
    await run();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.log(`FAIL  ${name}\n      ${String(err.message).split("\n")[0]}`);
    await page.screenshot({ path: `${OUT}/check-roadmap-fail.png`, fullPage: true });
    await browser.close();
    process.exit(1);
  }
}

const phone = () => page.getByRole("group", { name: "Roadmap app" }).first();
const progress = async () => (await page.locator("#try").getByText(/^\d+ of \d+$/).first().textContent())?.trim();
const stepDone = (label) =>
  page.waitForFunction((l) => [...document.querySelectorAll("#try ol li")].some((li) => li.textContent?.includes(l) && li.querySelector("span.bg-ok")), label, { timeout: 10000 });

await step("opens on the Year 10 list, nothing ticked", async () => {
  await page.goto(`${BASE}/build`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { level: 1, name: /Six steps to May 1./i }).waitFor();
  await phone().getByRole("tab", { name: "Year 10", selected: true }).waitFor();
  if ((await progress()) !== "0 of 4") throw new Error(`progress ${await progress()}`);
});

await step("no lab words on the page", async () => {
  const body = (await page.locator("main").innerText()).toLowerCase();
  for (const word of ["prototype", "maturity", "rls", "edge function", "hash", "ledger", "receipt", "fictional", "evidence", "jwt"]) {
    if (body.includes(word)) throw new Error(`found “${word}”`);
  }
});

await step("Year 10 is six dated steps plus her company-teams goal", async () => {
  const panel = phone().getByRole("tabpanel", { name: "Year 10" });
  const dates = ["Now → Nov 20", "Nov 20 → Dec 18", "Jan 4 → Feb 5", "Feb 8 → Mar 12", "Mar 15 → Apr 16", "Apr 19 → May 1"];
  for (const d of dates) await panel.getByText(d, { exact: true }).waitFor();
  await panel.locator('[data-item="teams"]').getByText("Your Year 10 goal", { exact: true }).waitFor();
  // The pilot is the first proof, beside the six steps, and its timing is Kayla's call.
  await panel.locator('[data-item="pilot"]').getByText("Needs Kayla's OK", { exact: true }).waitFor();
  const text = await panel.innerText();
  if (/Mile Zero/.test(text)) throw new Error("“Mile Zero” is someone else's toolkit; the welcome is “Start your summer”");
  const ringed = await page.locator("#try .step-ring").first().getAttribute("data-item");
  if (ringed !== "m0") throw new Error(`ring on ${ringed}`);
});

await step("a step opens with its dates, finish line, size and Kayla's call", async () => {
  await phone().locator('[data-item="m0"]').click();
  const sheet = phone().getByRole("dialog", { name: "A tidy start" });
  await sheet.getByText(/Step 1 of 6 · Now → Nov 20/).waitFor();
  await sheet.getByText("Done when").waitFor();
  await sheet.getByText("How big").waitFor();
  await sheet.getByText(/workouts with no distance/).waitFor();
  await stepDone("Open a Year 10 step");
  await page.screenshot({ path: `${OUT}/check-roadmap-card.png` });
  await sheet.getByRole("button", { name: "‹ Roadmap" }).click();
});

await step("Ready now lists what their app already does", async () => {
  await phone().getByRole("tab", { name: "Ready now" }).click();
  const ready = phone().getByRole("tabpanel", { name: "Ready now" });
  for (const t of ["The leaderboard", "The Events tab", "Apple Health, Health Connect and Garmin", "Counted once, from the same app", "The shop", "City Leads in 7 cities"]) await ready.getByText(t, { exact: true }).waitFor();
  await stepDone("See what's ready now");
});

await step("Quick fixes lead with the tidy-ups, then the website", async () => {
  await phone().getByRole("tab", { name: "Quick fixes" }).click();
  const ids = await phone().getByRole("tabpanel", { name: "Quick fixes" }).locator("[data-item]").evaluateAll((els) => els.map((e) => e.getAttribute("data-item")));
  const want = ["leaderboard-fix", "sign-in-runs", "garmin-tuneup", "events-upcoming", "android"];
  if (want.some((id, i) => ids[i] !== id)) throw new Error(`order ${ids.join(", ")}`);
  if (ids.indexOf("all-cities") < ids.indexOf("android")) throw new Error("a website fix comes before the data fixes");
  await stepDone("Look at the quick fixes");
});

await step("Later holds what can wait, and cards that wait on Kayla say so", async () => {
  await phone().getByRole("tab", { name: "Later" }).click();
  await phone().getByRole("tabpanel", { name: "Later" }).getByText("Fall szn").waitFor();
  await stepDone("See what can wait");
  await phone().locator('[data-item="giving"]').getByText("Needs Kayla's OK").waitFor();
  if ((await progress()) !== "4 of 4") throw new Error(`progress ${await progress()}`);
});

await step("one name, and a key that counts the five lists honestly", async () => {
  const main = await page.locator("main").innerText();
  if (main.includes("Ready & next")) throw new Error("the screen is still called “Ready & next”");
  await page.getByText("Roadmap · to May 1, 2027").first().waitFor();
  await phone().getByRole("heading", { name: "Roadmap" }).first().waitFor();
  // The key lists what the phone lists: Ready now holds every thing already in the app, not a feature count.
  const key = page.getByRole("complementary", { name: "On the roadmap" });
  const ready = await phone().getByRole("tab", { name: "Ready now" }).click().then(() => phone().getByRole("tabpanel", { name: "Ready now" }).locator("[data-item]").count());
  const row = await key.locator("li").filter({ hasText: "Ready now" }).innerText();
  if (!row.includes(String(ready))) throw new Error(`key says “${row.replace(/s+/g, " ")}”, the phone lists ${ready}`);
  await key.locator("li").filter({ hasText: "Year 10 · steps to May 1" }).getByText("6", { exact: true }).waitFor();
  await phone().getByRole("tab", { name: "Year 10" }).click();
});

await step("a card's “Try it” link opens the screen that shows it", async () => {
  await phone().locator('[data-item="m4"]').click();
  const sheet = phone().getByRole("dialog", { name: "City Lead toolkit" });
  await sheet.getByText(/Eventbrite/).waitFor();
  await sheet.locator('[data-try="/circles"]').click();
  await page.waitForURL((u) => new URL(u).pathname === "/circles", { timeout: 15000 });
  await page.goBack({ waitUntil: "networkidle" });
  await page.getByRole("heading", { level: 1, name: /Six steps to May 1./i }).waitFor();
});

await step("phone width: the app fills the screen, every list chip fits, nothing scrolls sideways", async () => {
  const p = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  p.on("console", (m) => m.type() === "error" && problems.push(`phone console: ${m.text()}`));
  await p.goto(`${BASE}/build`, { waitUntil: "networkidle" });
  const app = p.getByRole("group", { name: "Roadmap app" }).last();
  await app.getByRole("tab", { name: "Later" }).waitFor();
  const box = await app.getByRole("tab", { name: "Later" }).boundingBox();
  if (!box || box.x + box.width > 390) throw new Error("the last chip is off screen");
  const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (over > 0) throw new Error(`horizontal overflow ${over}px`);
  await p.close();
});

await step("no console or page errors", async () => {
  if (problems.length) throw new Error(problems.join(" | "));
});

await browser.close();
console.log(`\n${passed} checks passed.`);
