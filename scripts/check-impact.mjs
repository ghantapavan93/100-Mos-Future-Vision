// End-to-end check of Giving back: the "Try it" phone from a fresh season.
//   node scripts/check-impact.mjs            (dev server on :3240)
//   SHOTS=shots/s2 node scripts/check-impact.mjs   (also saves screenshots)
// Proves the money rules on the phone: the giving fund is empty until a sponsor
// pays, members vote first, only what the fund can pay for gets funded, and a
// program counts as happened only after a real walk with people checked in.
// Follows the guiding ring step by step, checks every idea says honestly
// whether it builds on what 100 Miles of Summer has or is new, and that "how it
// could work" never claims the giving fund is already set up.

import { mkdir } from "node:fs/promises";

import { chromium } from "playwright-core";

const BASE = process.env.LAB_URL ?? "http://localhost:3240";
const SHOTS = process.env.SHOTS;
if (SHOTS) await mkdir(SHOTS, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const problems = [];
const watch = (p) => {
  p.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()}`));
  p.on("pageerror", (e) => problems.push(`page: ${e.message}`));
};
watch(page);

let passed = 0;
async function step(name, run) {
  try {
    await run();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.log(`FAIL  ${name}\n      ${String(err.message).split("\n")[0]}`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/impact-fail.png`, fullPage: true });
    await browser.close();
    process.exit(1);
  }
}
const shot = async (name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}` });
const visible = (locator) => locator.first().waitFor({ state: "visible", timeout: 10000 });
const phone = () => page.getByTestId("giving-app").first();
const tab = (name) => phone().getByRole("navigation", { name: "Giving app" }).getByRole("button", { name });
/** The guiding ring sits on the one phone control that finishes the next step (innerText is uppercased by CSS). */
const ringOn = async (text) => {
  const ring = page.locator("#try .step-ring");
  await ring.first().waitFor({ timeout: 10000 });
  const got = (await ring.first().innerText()).trim();
  if (!got.toLowerCase().includes(text.toLowerCase())) throw new Error(`ring is on "${got}", expected "${text}"`);
};
const fund = () => phone().getByRole("region", { name: "The giving fund" });
const stepDone = async (label) => {
  await page.locator("#try ol li").filter({ hasText: label }).locator(".line-through").first().waitFor({ timeout: 10000 });
};

await step("fresh season: the fund shows the promise on its way (not a $0), and votes already coming in", async () => {
  await page.goto(`${BASE}/impact`);
  await page.evaluate(() => sessionStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await visible(page.getByRole("heading", { name: "Sponsor money that stays in the neighborhood." }));
  await page.locator('[data-stage="impact"]').waitFor({ state: "attached", timeout: 15000 });
  await visible(fund().getByText("$1,125"));
  await visible(fund().getByText("on its way"));
  await visible(fund().getByText(/Northline Outfitters promised 15% of their deal\. It lands here when they pay/));
  if (await fund().getByText("Ready to give").count()) throw new Error("the fund says “Ready to give” before any sponsor has paid");
  const legend = page.getByRole("complementary", { name: "Giving fund" });
  await visible(legend.getByText("Member votes so far"));
  await visible(legend.getByText("Local ideas open for votes"));
  for (const row of ["Ready to give", "Given to programs", "People at funded walks"]) {
    if (await legend.getByText(row).count()) throw new Error(`the hero key opens on an empty “${row}” row`);
  }
  await visible(page.getByRole("region", { name: "In numbers" }));
  const text = await page.locator("main").innerText();
  for (const word of ["Fictional", "fictional", "IMPACT-", "verified", "Verified", "community review", "Receipt #", "pool", "Pool", "Kayla's OK", "fiscal sponsor", "501(c)", "For Kirk", "QUANTUM"]) if (text.includes(word)) throw new Error(`page still says "${word}"`);
  await shot("impact-1440.png");
});

await step("the hero's “Why it matters” tells the story and closes", async () => {
  await page.getByRole("button", { name: "Why it matters" }).first().click();
  const sheet = page.getByRole("dialog");
  await visible(sheet.getByRole("heading", { name: "Why giving keeps people moving." }));
  await visible(sheet.getByText(/never out of your own pocket/));
  await visible(sheet.getByText("+32 min"));
  await page.keyboard.press("Escape");
  await sheet.waitFor({ state: "detached", timeout: 5000 });
});

await step("1 · Maya votes for a program in Detroit, once (the ring leads the way)", async () => {
  await ringOn("Vote now");
  await phone().getByRole("region", { name: "Members pick" }).getByRole("button", { name: /Vote now/ }).click();
  await ringOn("Vote");
  await phone().getByRole("button", { name: "Vote for First-Mile Neighborhood Walks" }).click();
  await visible(phone().getByRole("article", { name: "First-Mile Neighborhood Walks" }).getByText("Your vote ✓"));
  if (await phone().getByRole("button", { name: /^Vote for/ }).count()) throw new Error("other programs still take a vote");
  await visible(phone().getByText("22 votes"));
  await stepDone("Vote for a program");
});

await step("2 · the sponsor pays and the fund fills", async () => {
  await tab("Giving").click();
  await visible(phone().getByRole("region", { name: "Members pick" }).getByText(/You voted for/));
  await ringOn("Sponsor pays");
  await phone().getByRole("button", { name: "Sponsor pays" }).click();
  await visible(fund().getByText(/Northline Outfitters paid ✓/));
  await visible(fund().getByText("Ready to give"));
  await visible(fund().getByText("$1,125"));
  await visible(page.getByRole("complementary", { name: "Giving fund" }).getByText("Ready to give"));
  await stepDone("Mark the sponsor as paid");
});

await step("3 · the members' pick gets funded", async () => {
  const pick = phone().getByRole("region", { name: "Fund the members' pick" });
  await visible(pick.getByText(/First-Mile Neighborhood Walks has 22 votes and needs \$750/));
  await ringOn("Fund it");
  await pick.getByRole("button", { name: "Fund it" }).click();
  await visible(phone().getByRole("region", { name: "Next: a real walk" }));
  await visible(fund().getByText("$375"));
  await stepDone("Fund the members' pick");
});

await step("4 · a real walk happens and the program counts", async () => {
  await ringOn("Walk it");
  await phone().getByRole("region", { name: "Next: a real walk" }).getByRole("button", { name: "Walk it" }).click();
  const done = phone().getByRole("region", { name: "It happened" });
  await visible(done.getByText(/2 people checked in by name/));
  await visible(done.getByText(/2 of 10/));
  await stepDone("Walk it");
  await visible(page.locator("#try").getByText(/Sponsor pays, members choose/));
  await shot("impact-done.png");
});

await step("where the money went: one line in, one line out", async () => {
  await tab("Money").click();
  const list = phone().getByRole("list", { name: "Money in and out" });
  await visible(list.getByText("Northline Outfitters paid its giving share"));
  await visible(list.getByText("+$1,125"));
  await visible(list.getByText("−$750"));
});

await step("Maya's card: her vote and the walk she was part of", async () => {
  await tab("Me").click();
  const card = phone().getByRole("region", { name: "Your summer card" });
  await visible(card.getByText(/You voted for/));
  await visible(card.getByText(/You walked it ✓/));
});

await step("how it could work: no new charity, said as not set up yet", async () => {
  const fundCard = page.getByRole("article", { name: "The giving fund, without starting a charity" });
  await fundCard.scrollIntoViewIfNeeded();
  for (const line of ["Sponsors fund it", "A nonprofit partner holds it", "Members pick where it goes", "A real walk proves it"]) await visible(fundCard.getByText(line));
  await visible(fundCard.getByText(/Not set up yet\. Kayla picks the partner/));
});

await step("Neighborhood Fixes: a next idea, and the route flips from before to after", async () => {
  const fix = page.getByRole("article", { name: "Neighborhood Fixes" });
  await visible(fix.getByText("Next idea"));
  await visible(fix.getByText("New", { exact: true }));
  await visible(fix.getByRole("list", { name: "Before the fix" }).getByText("Nowhere to sit"));
  await fix.getByRole("group", { name: "Before or after" }).getByRole("button", { name: "After" }).click();
  const after = fix.getByRole("list", { name: "After the fix" });
  await visible(after.getByText(/Benches/));
  await visible(after.getByText(/Shade/));
  await visible(fix.getByText(/\$2,500/));
  if (SHOTS) await fix.screenshot({ path: `${SHOTS}/impact-fixes.png` });
});

await step("ideas: new is marked new, the mile goal is theirs, and “Show me” switches the phone", async () => {
  const ideas = page.locator("#ideas");
  await visible(ideas.locator("li").filter({ hasText: "You Pick" }).getByText("New", { exact: true }));
  await ideas.locator("li").filter({ hasText: "Where the Money Went" }).getByRole("button", { name: "Show me" }).click();
  await visible(phone().getByRole("list", { name: "Money in and out" }));
  await visible(ideas.getByText("Next, once the basics hold"));
  const later = ideas.locator("li").filter({ hasText: "Miles Unlock Money" });
  await visible(later.getByText("Builds on what you have"));
  await visible(later.getByText(/80,000 miles in Year 8/));
  if (await later.getByRole("button", { name: "Show me" }).count()) throw new Error("Miles Unlock Money should be a later idea, not on the phone");
});

await step("under the hood: how it lands, with sizes", async () => {
  await page.getByText("How we'd build it").click();
  await visible(page.getByText("Only paid money is given"));
  await visible(page.getByText("A partner per city"));
  await visible(page.getByText("Small · days"));
});

await step("the tour still finds the same walk afterwards (no second impact walk)", async () => {
  const titles = await page.evaluate(() => {
    const raw = Object.keys(sessionStorage).map((k) => sessionStorage.getItem(k) ?? "").join("");
    return (raw.match(/Neighborhood Walk, the members' pick/g) ?? []).length;
  });
  if (titles !== 1) throw new Error(`expected one drafted impact walk in the log, found ${titles}`);
});

await step("phone width: no sideways scroll", async () => {
  const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
  watch(p);
  await p.goto(`${BASE}/impact`, { waitUntil: "networkidle" });
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 0) throw new Error(`horizontal overflow ${overflow}px`);
  await p.getByTestId("giving-app").last().waitFor({ state: "visible" });
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/impact-390.png`, fullPage: true });
  await p.close();
});

await step("no console errors", async () => {
  if (problems.length) throw new Error(problems.join(" | "));
});

console.log(`\n${passed} checks passed.`);
await browser.close();
