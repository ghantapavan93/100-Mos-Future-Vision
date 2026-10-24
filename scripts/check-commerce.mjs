// End-to-end check of the Sponsors screen (/partner) in a real browser.
//   npm run dev   (port 3240)    then    node scripts/check-commerce.mjs
// Drives installed Edge headless, starting from a clean session. Fails on any
// broken expectation or console error (resource 404s are reported, not counted).
//
// Sponsors is the sponsor's phone app: pick cities (all seven), pick a package
// (company teams are Kayla's Year 10 goal), set the fee, see where every dollar
// goes, sign and pay, ask for the member list (no), get a perk, open and copy
// the season report. The money rules it proves: a price that doesn't cover the
// costs needs a written reason to sign, a signature isn't money until payment,
// the brand sees totals and never people, and a member's perk is one code.

import { chromium } from "playwright-core";

const BASE = process.env.LAB_URL ?? "http://localhost:3240";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
// The season report is copied to the clipboard; let the page write to it.
await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
const page = await context.newPage();
const errors = [];
const ignored = [];
page.on("console", (m) => {
  if (m.type() !== "error") return;
  (/Failed to load resource: .*404/.test(m.text()) ? ignored : errors).push(m.text());
});
page.on("pageerror", (e) => errors.push(e.message));

let step = 0;
async function check(name, fn) {
  step++;
  try {
    await fn();
    console.log(`  ok  ${step}. ${name}`);
  } catch (err) {
    console.log(`FAIL  ${step}. ${name}\n      ${String(err.message).split("\n")[0]}`);
    await page.screenshot({ path: "shots/check-commerce-fail.png", fullPage: true });
    await browser.close();
    process.exit(1);
  }
}

const expect = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

/** The sponsor's phone (the visible one: phones get the unframed copy). */
const phone = () => page.getByRole("group", { name: /sponsor app$/ });
const tab = (name) => phone().getByRole("button", { name, exact: true }).click();
const tryAs = (name) => page.getByRole("button", { name: new RegExp(`^${name}`) }).click();
/** Waits until the guiding ring sits on the control for `stepId` whose text includes `text`. */
const ringOn = (stepId, text) =>
  page.waitForFunction(
    ([id, words]) => {
      const el = document.querySelector(".step-ring");
      return el?.getAttribute("data-step-target") === id && (el.textContent ?? "").includes(words);
    },
    [stepId, text],
    { timeout: 5000 },
  );

await check("open Sponsors from a clean session", async () => {
  await page.goto(`${BASE}/partner`);
  await page.evaluate(() => sessionStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /Sponsors fund the walks/ }).waitFor();
  await phone().waitFor();
  await page.getByText("0 of 5", { exact: true }).waitFor();
});

await check("no lab jargon, no real partner pitched as a deal, no idea that's already theirs", async () => {
  const text = await page.locator("main").innerText();
  for (const word of ["Fictional", "COMMERCIAL-OVERRIDE", "P10", "Receipt", "egress", "V2", "She's Birdie", "Team Miles at Work", "Processing", "Short by", "Partner Studio"]) {
    expect(!text.includes(word), `page still says "${word}"`);
  }
  await page.getByText(/lululemon already hosts your Chicago and LA events/).waitFor();
});

await check("the page leads with the money: the legend says what's in, the deal card says offered", async () => {
  await page.getByRole("complementary", { name: /Northline Outfitters' \$7,500/ }).getByText("Money in so far").waitFor();
  await page.getByRole("button", { name: /^Northline Outfitters/ }).getByText("$7,500 · offered").waitFor();
});

await check("all seven cities can be funded, and company teams are offered as her Year 10 goal", async () => {
  for (const city of ["Chicago", "Detroit", "Charleston", "New York", "Los Angeles", "Durham", "Montreal"]) {
    await phone().getByRole("button", { name: city, exact: true }).waitFor();
  }
  await phone().getByRole("button", { name: /Company team/ }).getByText("Your Year 10 goal").waitFor();
});

await check("the ring points at Detroit, then Charleston; picking both ticks the first step", async () => {
  await ringOn("cities", "Detroit");
  await phone().getByRole("button", { name: "Detroit", exact: true }).click();
  await ringOn("cities", "Charleston");
  await phone().getByRole("button", { name: "Charleston", exact: true }).click();
  await phone().getByText("2 picked").waitFor();
  await page.getByText("1 of 5", { exact: true }).waitFor();
  await ringOn("fee", "The fee");
});

await check("sliding the fee to $2,500 shows the costs aren't covered", async () => {
  await phone().getByLabel("Program fee").fill("2500");
  await phone().getByText("Not covered yet", { exact: true }).waitFor();
  await phone().getByText("$1,755", { exact: true }).waitFor();
  await page.getByText("2 of 5", { exact: true }).waitFor();
});

await check("the Money tab opens on the summer's money: nothing in the bank yet", async () => {
  await tab("Money");
  await phone().getByText("This summer's sponsor money").waitFor();
  await phone().getByText("in the bank", { exact: true }).waitFor();
  await ringOn("pay", "Sign the deal");
});

await check("a price that doesn't cover the costs can't be signed without a written reason", async () => {
  await phone().getByRole("button", { name: "Sign the deal" }).click();
  await phone().getByText("At this price, $1,755 of the costs aren't covered.").waitFor();
  expect(await phone().getByRole("button", { name: "Sign anyway" }).isDisabled(), "Sign anyway should wait for a reason");
  await phone().getByLabel("Why it's worth it").fill("Our first sponsor in Charleston; worth it to prove the walks");
  await phone().getByRole("button", { name: "Sign anyway" }).click();
  await phone().getByText(/Signed below cost, on purpose/).waitFor();
  await phone().getByText("Signed", { exact: true }).first().waitFor();
});

await check("signed terms are locked", async () => {
  await tab("Fund");
  expect(await phone().getByLabel("Program fee").isDisabled(), "the fee should be locked once signed");
  await phone().getByText("Signed — these terms are locked in.").waitFor();
});

await check("asking for the member list is a friendly no that credits their own promise", async () => {
  await tab("Brand view");
  await phone().getByRole("button", { name: "Ask for the member list" }).click();
  await phone().getByText(/No\. You already promise never to sell, trade or rent members' data\./).waitFor();
});

await check("paying puts the money in the bank; going live puts the walks with the City Leads", async () => {
  await tab("Money");
  await phone().getByRole("button", { name: "Pay $2,500" }).click();
  await phone().getByText(/^Paid\. \$2,500 is in the bank/).waitFor();
  const inBank = await phone().getByText("in the bank", { exact: true }).locator("xpath=..").innerText();
  expect(inBank.includes("$2,500"), `in the bank should read $2,500, got ${inBank}`);
  await phone().getByRole("button", { name: "Go live" }).click();
  await phone().getByText("The walks they paid for").waitFor();
  await phone().getByText("Waiting for the City Lead").first().waitFor();
});

await check("a perk is one code for Maya, and the brand sees only how many", async () => {
  await tab("Brand view");
  await phone().getByRole("button", { name: "Get the perk as Maya" }).click();
  await phone().getByText(/Maya's code:/).waitFor();
  await phone().getByText("NO-0001").waitFor();
  await phone().getByRole("switch", { name: "See what the brand sees" }).click();
  await phone().getByText("perk codes used").waitFor();
  await phone().getByText(/No names\. No emails\. No maps\./).waitFor();
});

await check("the season report opens, copies as plain text, and every step is done", async () => {
  await phone().getByRole("button", { name: "Open the season report" }).click();
  const sheet = phone().getByRole("dialog", { name: "Season report" });
  await sheet.waitFor();
  await sheet.getByRole("button", { name: "Copy the report to send" }).click();
  await sheet.getByText("Copied ✓").waitFor();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied.includes("Season report") && copied.includes("Walks you funded") && !copied.includes("Maya"), `the copied report should be totals only: ${copied.slice(0, 120)}`);
  await sheet.getByRole("button", { name: "Close" }).click();
  await page.getByText("5 of 5", { exact: true }).waitFor();
  await page.getByText(/That's a sponsor deal\./).waitFor();
});

await check("sign Lakeshore as a company team: the package is already picked, the contract unpaid", async () => {
  await tryAs("Lakeshore Logistics");
  expect((await phone().getByRole("button", { name: /Company team/ }).getAttribute("aria-pressed")) === "true", "Lakeshore should be on the company-team package");
  await phone().getByRole("button", { name: "Chicago", exact: true }).click();
  await tab("Money");
  await phone().getByRole("button", { name: "Sign the deal" }).click();
  await phone().getByRole("button", { name: "Pay $12,000" }).waitFor();
  const owed = await phone().getByText("signed, on its way", { exact: true }).locator("xpath=..").innerText();
  expect(owed.includes("$12,000"), `signed, on its way should read $12,000, got ${owed}`);
});

await check("the Year 10 math: the middle case falls short of a lean team, and says what closes it", async () => {
  const math = page.locator("#year-ten");
  await math.scrollIntoViewIfNeeded();
  await math.getByRole("heading", { name: /Year 10 needs one big partner/ }).waitFor();
  await math.getByTestId("year-ten-total").getByText("$79,000").waitFor();
  await math.getByTestId("year-ten-verdict").getByText("$88K short of a lean team.", { exact: false }).waitFor();
  await math.getByTestId("year-ten-verdict").getByText("One big partner (about $100K) gets within $18K — a relay or more company teams closes the rest.").waitFor();
});

await check("one big partner at $100,000 gets within $18K, and a relay — only if she chooses one — covers the team", async () => {
  const math = page.locator("#year-ten");
  await math.getByRole("slider", { name: "Presenting partner" }).fill("100000");
  await math.getByTestId("presenting-amount").getByText("$100,000").waitFor();
  await math.getByTestId("year-ten-verdict").getByText("$18K short of a lean team.", { exact: false }).waitFor();
  await math.getByRole("button", { name: /Add a Year 10 relay/ }).click();
  await math.getByTestId("year-ten-verdict").getByText("Covers a lean Year 10 team, with $7K to spare.").waitFor();
  const pays = math.getByTestId("presenting-pays-for");
  await pays.getByText("Seven City Lead stipends").waitFor();
  await pays.getByText("9 months of a full-time program & community manager").waitFor();
  await math.getByText("Never names, emails, routes or health data").waitFor();
  // The high case covers the whole team on its own.
  await math.getByRole("button", { name: "High", exact: true }).click();
  await math.getByTestId("year-ten-verdict").getByText(/Covers a lean Year 10 team, with \$\d+K to spare\./).waitFor();
});

await check("programs for any organization: one setup builds the member page and the organizer view together", async () => {
  const programs = page.locator("#programs");
  await programs.scrollIntoViewIfNeeded();
  const member = programs.getByTestId("program-member-page");
  const organizer = programs.getByTestId("program-organizer-view");
  await member.getByText("Join the Lakeshore Logistics team").waitFor();
  await organizer.getByTestId("program-price").getByText("$4,000", { exact: true }).waitFor();
  await organizer.getByText("1 company team · about $4,000 a team for the season").waitFor();
  await programs.getByRole("button", { name: "A university", exact: true }).click();
  await member.getByText("Join the Riverbend University campus team").waitFor();
  await organizer.getByText("1,000–2,000").waitFor();
  await organizer.getByTestId("program-price").getByText("$7,000–$22,000").waitFor();
  await programs.getByRole("button", { name: "8 weeks", exact: true }).click();
  await member.getByText(/^8 weeks of walking/).waitFor();
  await organizer.getByText("Riverbend University · 8-week program").waitFor();
  await programs.getByLabel("Its name").fill("Wayfield College");
  await member.getByText("Join the Wayfield College campus team").waitFor();
  await member.getByText(/Wayfield College sees campus team totals only/).waitFor();
});

await check("the City Relay title partner is a next idea", async () => {
  await page.locator("#ideas").getByText("City Relay title partner").waitFor();
});

await check("the story behind the page opens and closes", async () => {
  await page.getByRole("button", { name: "Why it matters" }).click();
  const sheet = page.getByRole("dialog", { name: /Why trust brings brands back/ });
  await sheet.waitFor();
  await sheet.getByRole("button", { name: "Close" }).click();
  await sheet.waitFor({ state: "detached" });
});

// The Giving back (impact) flow is checked on its own page: scripts/check-impact.mjs.

await check("no console errors", async () => {
  expect(errors.length === 0, `console errors: ${errors.join(" | ").slice(0, 400)}`);
});

console.log(`\n${step} checks passed.${ignored.length ? ` Ignored ${ignored.length} resource 404(s) (favicon, shared).` : ""}`);
await browser.close();
