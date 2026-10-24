// End-to-end check of the founder screen ("Kayla's week") in headless Edge,
// against the running dev server (npm run dev, port 3240).
//
//   node scripts/check-founder.mjs
//
// It only acts through the UI: opens on a calm week (people first, City Leads
// on top, "3 decisions · about 3 minutes"), opens the City Lead who could use a
// hand and writes to them, says OK to a decision (a real command), says yes to a
// City Lead in training's first solo walk, plays a sample Saturday and watches
// the numbers move, then checks money in versus promised — and fails on lab
// jargon on the page, any console error, or horizontal overflow.

// The next-three-summers checks (/future) live in scripts/check-future.mjs.

import { chromium } from "playwright-core";

const BASE = process.env.LAB_URL ?? "http://localhost:3240";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
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
    await page.screenshot({ path: "shots/d2/check-fail.png", fullPage: true });
    await browser.close();
    process.exit(1);
  }
}

const noOverflow = async () => {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (over > 0) throw new Error(`horizontal overflow ${over}px`);
};

/** Waits until the guiding ring sits on the control for `stepId`. */
const ringOn = (stepId) =>
  page.waitForFunction((id) => document.querySelector(".step-ring")?.getAttribute("data-step-target") === id, stepId, { timeout: 5000 });

// ── Founder: Kayla's week, on a phone ──
const founderPhone = () => page.getByRole("group", { name: "Kayla's founder app" });
const founderTab = (name) => founderPhone().getByRole("button", { name, exact: true }).click();
/** The three numbers on the Week tab, as one string. */
const threeNumbers = async () => {
  const labels = [/^miles moved$/, /^first-timers?$/, /^walks? on the calendar$/];
  const out = [];
  for (const l of labels) out.push(await founderPhone().getByText(l).locator("xpath=..").innerText());
  return out.join(" | ");
};

await step("founder app opens on a calm week: people first, City Leads on top, three decisions in about three minutes", async () => {
  await page.goto(`${BASE}/founder`, { waitUntil: "networkidle" });
  await page.evaluate(() => sessionStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "What needs you this week" }).waitFor();
  await founderPhone().getByText("A calm week.").waitFor();
  await founderPhone().getByText(/Miles are (up \d+% on|steady with) last week/).waitFor();
  await founderPhone().getByText("3 decisions · about 3 minutes").waitFor();
  await founderPhone().getByText("Everything else can wait.").waitFor();
  await founderPhone().getByText("City Leads this week").waitFor();
  await founderPhone().getByText("miles moved").waitFor();
  await founderPhone().getByText(/^first-timers?$/).waitFor();
  // Her scale: the week's miles read in the thousands, and the hero says whose members these are.
  const miles = await founderPhone().getByText("miles moved", { exact: true }).locator("xpath=..").innerText();
  const firstLine = miles.split("\n")[0];
  if (!(Number(firstLine.replace(/,/g, "")) >= 1000)) throw new Error("the week's miles should read at the movement's scale, got " + firstLine);
  await page.getByText("In city circles", { exact: true }).waitFor();
  // One walks number: the City Lead cards add up to the "walks on the calendar" card.
  const walks = Number((await founderPhone().getByText(/^walks? on the calendar$/).locator("xpath=..").innerText()).split("\n")[0]);
  const cards = await founderPhone()
    .getByRole("button", { name: /^[A-Za-z ]+: .* walks?, / })
    .evaluateAll((els) => els.map((e) => Number(e.getAttribute("aria-label").match(/, (\d+) walks?,/)[1])));
  const sum = cards.reduce((a, b) => a + b, 0);
  if (sum !== walks) throw new Error("City Lead cards add up to " + sum + ", the walks card says " + walks);
  await founderPhone().getByText("Sign Northline Outfitters' $7,500 deal for Detroit and Charleston").waitFor();
  await founderPhone().getByText(/\$2,495 is left for the team after costs/).waitFor();
  await page.getByText("0 of 4", { exact: true }).waitFor();
  const all = await page.locator("main").innerText();
  for (const word of ["Fictional", "Receipt", "gates", "organizer load", "P10", "Burnout", "burnout", "nonprofit CEO", "Kayla sees", "night city", "left to run 100 Miles", "lululemon's Chicago report", "A busy week", "For Kirk", "For Kayla"]) {
    if (all.includes(word)) throw new Error(`founder page still says "${word}"`);
  }
  await noOverflow();
});

await step("every one of the seven City Leads is on the Week tab, the stretched one first and ringed", async () => {
  for (const city of ["Detroit", "Chicago", "Charleston", "New York", "Los Angeles", "Durham", "Montreal"]) {
    await founderPhone().getByRole("button", { name: new RegExp(`^${city}:`) }).waitFor();
  }
  await ringOn("city");
  const first = await founderPhone().getByRole("button", { name: /^[A-Za-z ]+: .* walks?, / }).first().getAttribute("aria-label");
  if (!first?.startsWith("Detroit: Nina, 3 walks")) throw new Error(`the stretched lead should come first, got "${first}"`);
});

await step("the City Lead who could use a hand opens with a plain sentence and a note to send", async () => {
  await founderPhone().getByRole("button", { name: /^Detroit:/ }).click();
  const sheet = founderPhone().getByRole("dialog", { name: "Detroit" });
  await sheet.getByText(/walks (alone|on their own)/).waitFor();
  await sheet.getByRole("button", { name: "Message Nina" }).click();
  await sheet.getByText("To Nina").waitFor();
  await page.getByText("1 of 4", { exact: true }).waitFor();
  await sheet.getByRole("button", { name: "Close" }).click();
  await ringOn("decided");
});

await step("the Cities tab still lists every city with its dot", async () => {
  await founderTab("Cities");
  await founderPhone().getByText("Every city, at a glance").waitFor();
  for (const city of ["Los Angeles", "Durham", "Montreal"]) await founderPhone().getByRole("button", { name: new RegExp(`^${city}`) }).waitFor();
});

await step("saying OK to a decision runs it for real", async () => {
  await founderTab("Week");
  await founderPhone().getByRole("button", { name: "Open the vote" }).click();
  await founderPhone().getByText("The vote is open.").waitFor();
  await founderPhone().getByText(/Members picked “First-Mile Neighborhood Walks” — approve it/).waitFor();
  await page.getByText("2 of 4", { exact: true }).waitFor();
});

await step("a City Lead in training: Kayla says yes to Amélie's first solo walk", async () => {
  await founderPhone().getByTestId("fellows-line").getByText("2 in training — Detroit, Montreal").waitFor();
  await founderPhone().getByTestId("fellows").getByText("Amélie · Montreal").waitFor();
  await founderPhone().getByTestId("fellows").getByText(/ready for your yes/).waitFor();
  await ringOn("fellow");
  const ask = founderPhone().getByTestId("fellow-decision");
  await ask.getByText("Amélie is ready to lead her first walk in Montreal. Say yes?").waitFor();
  await ask.getByText(/You pick the City Leads/).waitFor();
  await ask.getByRole("button", { name: "Yes, she's ready" }).click();
  await founderPhone().getByText(/^Yes. Amélie leads Lachine Canal First Mile on her own/).waitFor();
  await founderPhone().getByTestId("fellows-line").getByText("1 in training — Detroit · 1 new City Lead — Montreal").waitFor();
  await founderPhone().getByTestId("fellows").getByText(/Leading Lachine Canal First Mile/).waitFor();
  if (await founderPhone().getByTestId("fellow-decision").count()) throw new Error("the answered decision is still waiting");
  await page.getByText("3 of 4", { exact: true }).waitFor();
});

await step("a sample Saturday moves the numbers and pays the sponsor", async () => {
  const before = await threeNumbers();
  await page.getByRole("button", { name: "Play a sample Saturday" }).click();
  await page.getByText("4 of 4", { exact: true }).waitFor();
  const after = await threeNumbers();
  if (after === before) throw new Error(`the three numbers didn't move: ${after}`);
  await founderTab("Money");
  await founderPhone().getByText("$7,500 paid").waitFor();
});

await step("money in sits beside money promised", async () => {
  await founderPhone().getByText("Money in vs promised").waitFor();
  const inBank = await founderPhone().getByText("in the bank", { exact: true }).locator("xpath=..").innerText();
  if (!inBank.includes("$7,500")) throw new Error(`in the bank should read $7,500, got ${inBank}`);
  await founderPhone().getByText("promised", { exact: true }).waitFor();
});

await step("an idea's Show me lands on its block in the phone", async () => {
  await founderTab("Money");
  const card = page.locator("#ideas li").filter({ hasText: "City Lead Fellowship" });
  await card.getByRole("button", { name: /Show me on the phone/ }).click();
  // The block scrolls into the phone's own view, not just the page's.
  await page.waitForFunction(
    () => {
      const block = document.querySelector('[data-block="training"]');
      if (!block) return false;
      let box = block.parentElement;
      while (box && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) box = box.parentElement;
      if (!box) return false;
      const b = block.getBoundingClientRect();
      const v = box.getBoundingClientRect();
      return b.top >= v.top - 2 && b.top < v.bottom - 40;
    },
    null,
    { timeout: 5000 },
  );
});

await step("the story behind the page opens and closes", async () => {
  await page.getByRole("button", { name: "Why it matters" }).click();
  const sheet = page.getByRole("dialog", { name: /Your evening back/ });
  await sheet.waitFor();
  await sheet.getByRole("button", { name: "Close" }).click();
  await sheet.waitFor({ state: "detached" });
});

await step("phone width: no overflow", async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["/founder"]) {
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
    await noOverflow();
  }
});

await step("no console or page errors", async () => {
  if (problems.length) throw new Error(problems.join(" | "));
});

console.log(`\n${passed} checks passed.`);
await browser.close();
