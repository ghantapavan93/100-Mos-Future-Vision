// End-to-end check of "Next three summers" (/future) in headless Edge, against
// the running dev server (npm run dev, port 3240).
//
//   node scripts/check-future.mjs
//
// Acts only through the phone: switches to company teams, moves the cities,
// has two sponsors pay through the real engine (the goal must turn green from
// the world, not from a click), opens Year 10, and ticks off every "Try it"
// step, following the guiding ring. Checks the page leads with people and
// says "still to raise", never a loss. Fails on any console error or
// horizontal overflow, and on lab jargon in the page's text.

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
    await page.screenshot({ path: `${OUT}/check-future-fail.png`, fullPage: true });
    await browser.close();
    process.exit(1);
  }
}

const phone = () => page.getByRole("group", { name: "Plan the next three summers" }).first();
const progress = async () => (await page.locator("#try").getByText(/^\d+ of \d+$/).first().textContent())?.trim();
const stepDone = (label) =>
  page.waitForFunction((l) => [...document.querySelectorAll("#try ol li")].some((li) => li.textContent?.includes(l) && li.querySelector("span.bg-ok")), label, { timeout: 10000 });

await step("fresh summer: the page opens on the plan, nothing ticked", async () => {
  await page.goto(`${BASE}/future`, { waitUntil: "networkidle" });
  await page.evaluate(() => sessionStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { level: 1, name: /Three more summers\. Your call\./i }).waitFor();
  if ((await progress()) !== "0 of 4") throw new Error(`progress ${await progress()}`);
  await phone().getByRole("radio", { name: /City circles first/ }).waitFor();
});

await step("people first, money second: no losses, no red, money is “still to raise”", async () => {
  const text = await page.locator("main").innerText();
  for (const word of ["−$", "-$", "Short by", "What has to be true", "Work teams", "Below the glass", "the ring", "Prove it"]) {
    if (text.includes(word)) throw new Error(`found “${word}”`);
  }
  const first = await phone().getByRole("list", { name: "Three summers" }).locator("li").first().innerText();
  if (!/TEN SUMMERS STRONG/i.test(first)) throw new Error(`2027 isn't “Ten summers strong”: ${first}`);
  // People only on the phone: the money is one chart below, from the same model as Sponsors.
  if (!/first-timers/.test(first) || /\$/.test(first)) throw new Error(`the 2027 row should be people only: ${first}`);
  await phone().getByRole("button", { name: /The money for all three summers is one chart below/ }).waitFor();
  // Same names as Home's three summers, and no summer is named for a result its own money line contradicts.
  const rows = await phone().getByRole("list", { name: "Three summers" }).locator("li").allInnerTexts();
  if (!/REPEAT IT/i.test(rows[1] ?? "") || !/GROW IT/i.test(rows[2] ?? "")) throw new Error(`summer names: ${rows.map((r) => r.split("\n")[2]).join(" / ")}`);
  if (rows.some((r) => /pays its own way/i.test(r) && /Still to raise/.test(r))) throw new Error("a summer says it pays its own way while money is still to raise");
  // "Joined" mixes first-timers and coworkers, so the key also compares first-timers on their own.
  const key = page.getByRole("complementary", { name: "What you're seeing" });
  await key.getByText(/joined by 2029/).first().waitFor();
  await key.getByText(/First-timers · circles vs teams/).waitFor();
  await page.getByRole("region", { name: "In numbers" }).getByText(/new running clubs started in one year/).waitFor();
});

await step("no lab words on the page", async () => {
  const body = (await page.locator("main").innerText()).toLowerCase();
  for (const word of ["percentile", "monte carlo", "sealed", "ledger", "receipt", "fictional", "modelled", "assumption", "p10", "p90", "v2"]) {
    if (body.includes(word)) throw new Error(`found “${word}”`);
  }
});

await step("the guiding ring sits on the company-teams button, and switching changes the three summers", async () => {
  const ringed = await page.locator("#try .step-ring").first().innerText();
  if (!/Company teams first/.test(ringed)) throw new Error(`ring on “${ringed}”`);
  const before = await phone().getByRole("list", { name: "Three summers" }).innerText();
  await phone().getByRole("radio", { name: /Company teams first/ }).click();
  const after = await phone().getByRole("list", { name: "Three summers" }).innerText();
  if (before === after) throw new Error("the summers didn't change");
  if (!/teammates/.test(await phone().getByRole("list", { name: "Three summers" }).innerText())) throw new Error("no teammates on the company-teams path");
  await stepDone("Try the company-teams path");
});

await step("sliding the cities up adds walks and first-timers", async () => {
  const rows = phone().getByRole("list", { name: "Three summers" });
  const walks = async () => Number((await rows.locator("li").first().innerText()).match(/([\d,]+) walks/)[1].replace(/,/g, ""));
  const before = await walks();
  const slider = phone().getByLabel("Cities with group walks");
  await slider.focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
  const after = await walks();
  if (!(after > before)) throw new Error(`walks ${before} → ${after}`);
  await stepDone("Slide the cities up");
});

await step("two sponsors pay through the engine; the goal turns green", async () => {
  if (!/Goals/.test(await page.locator("#try .step-ring").first().evaluate((el) => el.closest("button")?.textContent ?? ""))) throw new Error("the guiding ring isn't on the Goals tab");
  await phone().getByRole("button", { name: /^Goals/ }).click();
  const check = phone().locator('[data-check="pilots"]');
  if ((await check.getAttribute("data-pass")) !== "false") throw new Error("the sponsor check started green");
  await phone().getByRole("button", { name: "Sponsor pays" }).click();
  await page.locator("#try").getByText(/paid \$[\d,]+/).first().waitFor({ timeout: 8000 });
  await phone().getByRole("button", { name: "Sponsor pays" }).click();
  await page.waitForFunction(() => document.querySelector('[data-check="pilots"]')?.getAttribute("data-pass") === "true", null, { timeout: 8000 });
  const paid = await page.evaluate(() => {
    const w = JSON.parse(sessionStorage.getItem("fl4.log.v2") ?? "{}");
    return (w.log ?? []).filter((e) => e.input?.type === "RECORD_PAYMENT").length;
  });
  if (paid < 2) throw new Error(`${paid} payments in the session log`);
  await stepDone("Have two sponsors pay");
});

await step("Year 10 opens with its goal, what we'd build, and a link to the checks", async () => {
  await phone().getByRole("button", { name: /^Plan$/ }).click();
  await phone().getByRole("button", { name: /Year 10, 2027/ }).click();
  const sheet = phone().getByRole("dialog", { name: "Year 10, 2027" });
  await sheet.getByText("A goal to agree on").waitFor();
  await sheet.getByText(/goals to check/).waitFor();
  await sheet.getByText("Teammates", { exact: true }).waitFor();
  await stepDone("Open Year 10");
  if ((await progress()) !== "4 of 4") throw new Error(`progress ${await progress()}`);
  await page.locator("#try").getByText(/Three summers in one plan/).waitFor();
  if (await page.locator("#try .step-ring").count()) throw new Error("the guiding ring is still showing after the last step");
  await page.screenshot({ path: `${OUT}/check-future-done.png` });
});

await step("“More” opens the comparables and the ideas, and an idea's “Show me” drives the phone", async () => {
  await phone().getByRole("button", { name: "‹ Plan" }).click();
  if (await page.locator("#ideas").count()) throw new Error("the ideas should wait behind More");
  await page.getByRole("button", { name: /^More/ }).click();
  await page.locator("#future-more").getByText(/biggest free weekly run/).waitFor();
  await page.locator("#ideas").getByRole("button", { name: /Show me/ }).first().click();
  await phone().getByRole("dialog", { name: "Year 10, 2027" }).waitFor();
  await phone().getByRole("button", { name: "‹ Plan" }).click();
});

await step("the pilot reads go / fix / stop from its two sliders, and says how sure it can be", async () => {
  const pilot = page.locator("#pilot");
  await pilot.scrollIntoViewIfNeeded();
  await pilot.getByRole("heading", { name: /Six Saturdays, three cities/ }).waitFor();
  const verdict = () => pilot.locator("[data-verdict]").getAttribute("data-verdict");
  const rate = pilot.locator("#pilot-return");
  await rate.focus();
  await page.keyboard.press("Home"); // 20%
  if ((await verdict()) !== "stop") throw new Error(`20% read as ${await verdict()}`);
  for (let i = 0; i < 25; i++) await page.keyboard.press("ArrowRight"); // 45%
  if ((await verdict()) !== "fix") throw new Error(`45% read as ${await verdict()}`);
  for (let i = 0; i < 20; i++) await page.keyboard.press("ArrowRight"); // 65%
  if ((await verdict()) !== "go") throw new Error(`65% read as ${await verdict()}`);
  // Fewer first-timers, less certainty: it says to run more walks rather than decide.
  const per = pilot.locator("#pilot-first-timers");
  await per.focus();
  await page.keyboard.press("Home"); // 3 a walk → 54 first-timers
  await pilot.locator("[data-verdict]").getByText(/Run more walks before deciding/).waitFor();
  await pilot.getByText(/about 1[67]\d first-timers on each side/).waitFor();
  for (const m of ["Sign-ups who show up", "First-timers in each walk", "Back by week 4", "Guests who join the app", "Sponsors who'd come back"]) await pilot.getByText(m, { exact: true }).first().waitFor();
});

await step("the team sits inside the money: turning a role off lowers the cost line every summer", async () => {
  const money = page.locator("#money");
  await money.scrollIntoViewIfNeeded();
  const teamIn = async () => Number((((await money.locator('[data-year="2027"]').getAttribute("aria-label")) ?? "").match(/Team \$(\d+)K/) ?? [])[1]);
  const before = await teamIn();
  if (!(before >= 143 && before <= 174)) throw new Error(`a lean Year 10 team should cost $143K–$174K, shows $${before}K`);
  const reading = await money.locator("[data-money-reading]").innerText();
  await money.getByRole("switch", { name: /Part-time engineer: on/ }).click();
  const after = await teamIn();
  if (!(after < before)) throw new Error(`cost ${before}K → ${after}K`);
  if ((await money.locator("[data-money-reading]").innerText()) === reading) throw new Error("the reading didn't move");
  await money.getByRole("switch", { name: /Part-time engineer: off/ }).click();
  if ((await teamIn()) !== before) throw new Error("turning the role back on didn't restore the cost");
});

await step("the money: low / middle / high switch the summers, the relay is only an option, and Year 10 needs one big partner", async () => {
  const money = page.locator("#money");
  await money.scrollIntoViewIfNeeded();
  await money.getByRole("heading", { name: /Year 10 needs one big partner/ }).waitFor();
  const reading = () => money.locator("[data-money-reading]").innerText();
  const total = async () => (await money.locator('[data-year="2027"]').getAttribute("aria-label"))?.match(/\$(\d+)K in/)?.[1];
  await money.getByRole("radio", { name: "Middle" }).click();
  const mid = await total();
  if (!/still to raise/.test(await reading())) throw new Error(`middle reading: ${await reading()}`);
  if (mid !== "79") throw new Error(`a middle Year 10 without a relay should bring $79K, shows $${mid}K`);
  await money.locator("[data-partner-line]").getByText(/one big partner at about \$100K instead, Year 10 gets within \$18K/).waitFor();
  await money.getByRole("button", { name: /A Year 10 relay/ }).click();
  await money.locator("[data-partner-line]").getByText(/pays for this team with \$7K left over/).waitFor();
  await money.getByRole("button", { name: /A Year 10 relay/ }).click();
  await money.getByRole("radio", { name: "High" }).click();
  if (!(Number(await total()) > Number(mid))) throw new Error(`high ${await total()}K vs middle ${mid}K`);
  if (!/pays for this team/.test(await reading())) throw new Error(`high reading: ${await reading()}`);
  await money.getByRole("radio", { name: "Low" }).click();
  if (!(Number(await total()) < Number(mid))) throw new Error(`low ${await total()}K vs middle ${mid}K`);
  await money.getByRole("radio", { name: "Middle" }).click();
  await money.getByRole("button", { name: "See the numbers" }).click();
  await money.getByRole("table").getByRole("rowheader", { name: "Money in" }).waitFor();
  const text = await money.innerText();
  for (const word of ["−$", "-$", "loss", "deficit"]) if (text.includes(word)) throw new Error(`the money section says “${word}”`);
});

await step("phone width: the app fills the screen and nothing scrolls sideways", async () => {
  const p = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  p.on("console", (m) => m.type() === "error" && problems.push(`phone console: ${m.text()}`));
  await p.goto(`${BASE}/future`, { waitUntil: "networkidle" });
  await p.getByRole("group", { name: "Plan the next three summers" }).last().getByRole("radio", { name: /Company teams first/ }).waitFor();
  const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (over > 0) throw new Error(`horizontal overflow ${over}px`);
  await p.close();
});

await step("no console or page errors", async () => {
  if (problems.length) throw new Error(problems.join(" | "));
});

await browser.close();
console.log(`\n${passed} checks passed.`);
