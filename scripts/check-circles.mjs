// End-to-end check of City Circles: the "Try it" phone with its three hats —
// a guest with no app, Maya the member, Nina the City Lead.
//   node scripts/check-circles.mjs            (dev server on :3240)
//   SHOTS=shots/v3/circles node scripts/check-circles.mjs   (also saves screenshots)
// Drives headless Edge through the five steps on the page and checks each one
// really happened: the walks re-sort when the guest picks what helps, a first
// name saves a spot, the co-pilot flags a back walker who cancelled and the fix
// (a real command) clears it, the guest is checked in, and joining after the
// walk makes it count — once. Follows the guiding ring, fails on any console
// error, and checks what's said as theirs stays theirs.

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
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/circles-fail.png`, fullPage: true });
    await browser.close();
    process.exit(1);
  }
}
const shot = async (name) => SHOTS && page.locator("#try").screenshot({ path: `${SHOTS}/${name}` });
const visible = (locator) => locator.first().waitFor({ state: "visible", timeout: 10000 });
const phone = () => page.getByTestId("circles-app").first();
const steps = () => page.locator("#try ol");
const feed = () => page.getByText("What just happened").locator("..");
const stepDone = async (label) => {
  const item = steps().locator("li").filter({ hasText: label });
  await item.locator(".line-through").first().waitFor({ timeout: 10000 });
};
/** The guiding ring sits on the one phone control that finishes the next step. */
const ringOn = async (text) => {
  const ring = page.locator("#try .step-ring");
  await ring.first().waitFor({ timeout: 10000 });
  // innerText follows CSS text-transform, so compare without case.
  const got = (await ring.first().innerText()).trim();
  if (!got.toLowerCase().includes(text.toLowerCase())) throw new Error(`ring is on "${got}", expected "${text}"`);
};
const hat = (name) => phone().getByRole("group", { name: "Whose phone" }).getByRole("button", { name });
/** Walk titles in the order the guest page shows them. */
const order = async () => phone().getByRole("article").evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")));
const CITIES = ["Chicago", "Detroit", "Charleston", "New York", "Los Angeles", "Durham", "Montreal"];

await step("fresh world: the map, the list, and the phone opens with no app — a guest's first look", async () => {
  await page.goto(`${BASE}/circles`);
  await page.evaluate(() => sessionStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await visible(page.getByRole("heading", { name: "Strangers on Saturday. Friends by August." }));
  await page.locator('[data-stage="circles"]').waitFor({ state: "attached", timeout: 15000 });
  const rows = await page.getByRole("navigation", { name: "Chapters" }).getByRole("button").allTextContents();
  if (rows.length !== CITIES.length || !rows.every((t) => /\d+\s*members/.test(t))) throw new Error(`list rows: ${rows.join(" | ")}`);
  for (const city of CITIES) if (!rows.some((t) => t.includes(city))) throw new Error(`no ${city} in the list`);
  await visible(hat(/^No app/));
  if ((await hat(/^No app/).getAttribute("aria-pressed")) !== "true") throw new Error("the phone should open on the guest's page");
  await visible(phone().getByRole("heading", { name: "Walk with Detroit" }));
  await visible(phone().getByText("100milesofsummer.com/walk"));
  await visible(phone().getByText(/Your picks stay on this page/));
  await visible(page.getByRole("region", { name: "In numbers" }));
  const text = await page.locator("main").innerText();
  for (const word of ["Fictional", "fictional", "STRAVA-", "Receipt #", "OURS-", "WELCOME-SWEEP", "Find Your Circle", "Mile Zero", "QUANTUM", "For Kirk", "accessible route", "safe route"]) if (text.includes(word)) throw new Error(`page says "${word}"`);
  await shot("circles-1-guest.png");
});

await step("the hero's “Why it matters” opens the story and closes", async () => {
  await page.getByRole("button", { name: "Why it matters" }).first().click();
  const sheet = page.getByRole("dialog");
  await visible(sheet.getByRole("heading", { name: "Nobody walks alone." }));
  await visible(sheet.getByText(/walks at the back/));
  await page.keyboard.press("Escape");
  await sheet.waitFor({ state: "detached", timeout: 5000 });
});

await step("1 · pick what helps: the walks re-sort, and say what the City Lead checked", async () => {
  if ((await order())[0] !== "Saturday First Mile") throw new Error(`soonest first before any pick, got ${(await order()).join(", ")}`);
  await ringOn("Shade");
  await phone().getByRole("group", { name: "What helps you" }).getByRole("button", { name: "Shade" }).click();
  // Nina checked the shade on Sunday's walk but not yet on Saturday's: checked beats listed.
  await visible(phone().getByText("Best fit first"));
  const afterShade = await order();
  if (afterShade[0] !== "Sunday Long Walk") throw new Error(`Shade should put the walk with checked shade first, got ${afterShade.join(", ")}`);
  await visible(phone().getByRole("list", { name: "How Saturday First Mile fits" }).getByText(/Shade — listed, not checked yet/));
  await visible(phone().getByRole("list", { name: "How Sunday Long Walk fits" }).getByText(/Shade — checked by Nina/));
  await ringOn("Step-free");
  await phone().getByRole("group", { name: "What helps you" }).getByRole("button", { name: "Step-free" }).click();
  const afterBoth = await order();
  if (afterBoth[0] !== "Saturday First Mile") throw new Error(`Step-free should bring Saturday back on top, got ${afterBoth.join(", ")}`);
  await visible(phone().getByRole("list", { name: "How Sunday Long Walk fits" }).getByText(/Step-free — not listed/));
  await visible(phone().getByRole("article", { name: "Saturday First Mile" }).getByText("Fits 2 of 2"));
  await stepDone("pick two things that help");
  await shot("circles-2-fit.png");
});

await step("2 · save a spot with just a first name — no app, no password", async () => {
  await ringOn("Save my spot");
  await phone().getByRole("button", { name: "Save my spot on Saturday First Mile" }).click();
  const form = phone().getByRole("form", { name: "Save a spot on Saturday First Mile" });
  await visible(form.getByText(/No app, no password/));
  if ((await form.getByRole("textbox", { name: "First name" }).inputValue()) !== "Tasha") throw new Error("the first name should be ready to go");
  await ringOn("Save my spot");
  await form.getByRole("button", { name: "Save my spot" }).click();
  const list = phone().getByRole("region", { name: "You're on the list" });
  await visible(list.getByText("You're on the list, Tasha ✓"));
  await visible(list.getByText(/Look for/));
  await visible(list.getByText(/James walks at the back/));
  await visible(list.getByText(/Shade — listed, not checked yet/));
  await stepDone("Save a spot");
  await ringOn("City Lead");
  await shot("circles-3-on-the-list.png");
});

await step("Maya, the member: their own rule is kept and marked, and her heads-up reaches Nina", async () => {
  await hat(/^Member/).click();
  const note = phone().getByText("No RSVP needed — just show up!").locator("..").locator("..");
  await visible(note.getByText("Your app today"));
  const chips = await phone().getByRole("group", { name: "Choose a city" }).getByRole("button").allTextContents();
  for (const city of CITIES) if (!chips.includes(city)) throw new Error(`no ${city} chip on the phone: ${chips.join(" | ")}`);
  const walk = phone().getByRole("article", { name: "Saturday First Mile" });
  await walk.getByRole("button", { name: "I'm coming to Saturday First Mile" }).click();
  await walk.getByRole("group", { name: /Which route/ }).getByRole("button", { name: /^1 mi/ }).click();
  await visible(walk.getByText(/You're going ✓ · 1 mi/));
  await visible(feed().getByText(/Maya is going to Saturday First Mile/));
  await phone().getByRole("article", { name: "Sunday Long Walk" }).getByRole("button", { name: "Walk at the back" }).click();
  await visible(phone().getByRole("article", { name: "Sunday Long Walk" }).getByText("Offered to walk at the back ✓"));
});

await step("3 · as Nina, “What am I missing?” flags the back walker who cancelled; the fix clears it", async () => {
  await ringOn("City Lead");
  await hat(/^City Lead/).click();
  const row = phone().getByRole("button", { name: "Open Saturday First Mile" });
  await visible(row.getByText("Tasha · guest"));
  await visible(row.getByText("Maya", { exact: true }));
  await ringOn("Saturday First Mile");
  await row.click();
  const cp = phone().getByRole("region", { name: "What am I missing?" });
  await ringOn("Check this walk");
  await cp.getByRole("button", { name: "Check this walk" }).click();
  await visible(cp.getByText("Nobody at the back"));
  await visible(cp.getByText(/James can't make it/));
  await visible(cp.getByText(/Shade — listed, not checked yet/));
  await visible(cp.getByText("2 to fix"));
  // Only people in the circle can be asked (Maya offered, but she hasn't joined Detroit); the Lead herself is the last resort.
  const options = await cp.getByRole("group", { name: "Who could walk at the back" }).getByRole("button").allTextContents();
  if (!/^Ask Sarah/.test(options[0] ?? "") || !/^Ask Nina/.test(options.at(-1) ?? "") || options.some((o) => /James|Maya/.test(o))) throw new Error(`back-walker options: ${options.join(" | ")}`);
  await ringOn("Ask Sarah");
  await shot("circles-4-copilot.png");
  await cp.getByRole("button", { name: "Ask Sarah to walk at the back" }).click();
  await visible(feed().getByText(/Sarah will finish at the back of “Saturday First Mile”/));
  await visible(cp.getByText("Someone walks at the back"));
  await ringOn("mark shade checked");
  await cp.getByRole("button", { name: /mark shade checked/ }).click();
  await visible(cp.getByText("What's listed is checked"));
  await visible(cp.getByText(/Quick change: Sarah will walk at the back/));
  if ((await cp.getByText(/Sent to everyone coming/).count()) !== 0) throw new Error("the note went before Nina tapped Send");
  await ringOn("Send to");
  await cp.getByRole("button", { name: /^Send to \d+/ }).click();
  await visible(cp.getByText("All set ✓"));
  await visible(cp.getByText(/Sent to everyone coming ✓/));
  await stepDone("What am I missing?");
  await shot("circles-5-all-set.png");
});

await step("the guest's page now says Nina checked the shade", async () => {
  await hat(/^No app/).click();
  await visible(phone().getByRole("region", { name: "You're on the list" }).getByText(/Shade — checked by Nina/));
  await visible(phone().getByRole("region", { name: "You're on the list" }).getByText(/Sarah walks at the back/));
  await ringOn("City Lead");
});

await step("4 · Saturday 8:00: check the guest in (and a walk-up, no RSVP needed)", async () => {
  await hat(/^City Lead/).click();
  await phone().getByRole("button", { name: "Open Saturday First Mile" }).click();
  const list = phone().getByRole("region", { name: "Who's coming to Saturday First Mile" });
  if (await list.getByRole("button", { name: "Check in Tasha" }).count()) throw new Error("check-in offered before the start");
  await ringOn("It's Sat");
  await phone().getByRole("button", { name: /^It's Sat/ }).click();
  await ringOn("Check in");
  await list.getByRole("button", { name: "Check in Tasha" }).click();
  await visible(list.getByRole("listitem").filter({ hasText: "Tasha" }).getByText("Was there ✓"));
  await stepDone("check the guest in");
  await list.getByRole("button", { name: "Check in Maya" }).click();
  await visible(feed().getByText(/Maya checked in at/));
  const names = await list.innerText();
  if (names.includes("12.4")) throw new Error(`the list shows Maya's miles: ${names}`);
  await ringOn("No app");
});

await step("5 · after the walk, the guest joins in one tap — and that walk counts, once", async () => {
  await hat(/^No app/).click();
  await visible(phone().getByText("You walked 1 mile with Detroit ✓"));
  await ringOn("Join in one tap");
  await phone().getByRole("button", { name: "Join in one tap" }).click();
  await visible(phone().getByText("Welcome to 100 Miles of Summer, Tasha ✓"));
  await visible(phone().getByText(/1 mi counted toward your 100/));
  await visible(feed().getByText(/Tasha started their summer in Detroit/));
  await visible(feed().getByText(/Tasha checked in at “Saturday First Mile”/));
  await stepDone("join in one tap");
  await visible(page.locator("#try").getByText(/That's the doorway/));
  await shot("circles-6-joined.png");
});

await step("Nina's list: Tasha is a member now, there once", async () => {
  await hat(/^City Lead/).click();
  await phone().getByRole("button", { name: "Open Saturday First Mile" }).click();
  const list = phone().getByRole("region", { name: "Who's coming to Saturday First Mile" });
  const rows = list.getByRole("listitem").filter({ hasText: "Tasha" });
  if ((await rows.count()) !== 1) throw new Error(`Tasha should be on the list once, found ${await rows.count()}`);
  await visible(rows.getByText("Joined after the walk"));
  await phone().getByRole("button", { name: "Check in Sarah" }).click();
  await visible(list.getByRole("listitem").filter({ hasText: "Sarah" }).getByText("Was there ✓"));
});

await step("a walk can't go live without someone at the back; with one, it goes live", async () => {
  await phone().getByRole("button", { name: "‹ Walks" }).click();
  await phone().getByRole("button", { name: "+ New walk" }).click();
  const form = phone().getByRole("form", { name: "New walk" });
  await visible(form.getByText(/All paces welcome/));
  await form.getByRole("textbox", { name: "Name" }).fill("Sunrise Riverwalk");
  await form.getByRole("button", { name: "Go live" }).click();
  await visible(form.getByText(/Saved, but not live: add someone to walk at the back first/));
  await form.getByRole("textbox", { name: "Name" }).fill("Saturday Morning Miles");
  await form.getByRole("group", { name: "Who walks at the back of the new walk" }).getByRole("button", { name: "James" }).click();
  await form.getByRole("button", { name: "Go live" }).click();
  await visible(form.getByText(/Live! Everyone in Detroit can see “Saturday Morning Miles” now/));
});

await step("Nina calls a walk off for heat; Maya's phone shows it", async () => {
  await phone().getByRole("button", { name: "Walks", exact: true }).click();
  await phone().getByRole("button", { name: "Open Sunday Long Walk" }).click();
  await phone().getByRole("button", { name: "Heat advisory" }).click();
  await phone().getByRole("button", { name: /^Yes, tell \d+/ }).click();
  await visible(phone().getByText(/Called off · Heat advisory/));
  await hat(/^Member/).click();
  await visible(phone().getByRole("article", { name: "Sunday Long Walk" }).getByText(/Called off · Heat advisory/));
  await visible(phone().getByRole("article", { name: "Saturday First Mile" }).getByText(/You were there ✓ · 1 mi/));
});

await step("Nina can't run a city she doesn't lead", async () => {
  await phone().getByRole("group", { name: "Choose a city" }).getByRole("button", { name: "Chicago" }).click();
  await visible(phone().getByRole("heading", { name: "Chicago" }));
  await hat(/^City Lead/).click();
  await visible(phone().getByText("City Lead · Detroit"));
});

await step("ideas: theirs is said as theirs, and “Show me” drives the phone", async () => {
  const ideas = page.locator("#ideas");
  const doorway = ideas.locator("li").filter({ hasText: "First-Mile Doorway" });
  await visible(doorway.getByText("Builds on what you have"));
  await visible(doorway.getByText(/already take sign-ups without the app/));
  await visible(ideas.locator("li").filter({ hasText: "Walks That Fit You" }).getByText("New", { exact: true }));
  await visible(ideas.locator("li").filter({ hasText: "The Lead's Co-Pilot" }).getByText("New", { exact: true }));
  const onPhone = await ideas.getByRole("button", { name: "Show me" }).count();
  if (onPhone !== 3) throw new Error(`expected three ideas on the phone; found ${onPhone}`);
  await ideas.locator("li").filter({ hasText: "The Lead's Co-Pilot" }).getByRole("button", { name: "Show me" }).click();
  // Saturday has happened by now, so it opens Detroit's next walk — the co-pilot works before a walk starts.
  await visible(phone().getByRole("region", { name: "What am I missing?" }));
  await visible(ideas.getByText("Next, once the basics hold"));
  const fellowship = ideas.locator("li").filter({ hasText: "City Lead Fellowship" });
  await visible(fellowship.getByText(/Kayla hand-picks City Leads/));
  await visible(fellowship.getByText("Builds on what you have"));
  if (await fellowship.getByRole("button", { name: "Show me" }).count()) throw new Error("the Fellowship is a next idea, not on the phone");
});

await step("under the hood: how it lands, with sizes", async () => {
  await page.getByText("How we'd build it").click();
  await visible(page.getByText("No-app sign-up"));
  await visible(page.getByText("Already in your app"));
  await visible(page.getByText("Small · days").first());
});

await step("phone width: no sideways scroll, the three hats fit, the guest page fills the screen", async () => {
  const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
  watch(p);
  await p.goto(`${BASE}/circles`, { waitUntil: "networkidle" });
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 0) throw new Error(`horizontal overflow ${overflow}px`);
  const app = p.getByTestId("circles-app").last();
  await app.waitFor({ state: "visible" });
  // The phone's own city chips do the choosing here; a second list above them would only push the app down.
  if (await p.getByRole("navigation", { name: "Chapters" }).count()) throw new Error("the city list repeats above the phone at 390px");
  const hats = app.getByRole("group", { name: "Whose phone" });
  const clipped = await hats.evaluate((g) => [...g.querySelectorAll("button")].some((b) => b.scrollWidth > b.clientWidth + 1));
  if (clipped) throw new Error("a hat label is cut off at 390px");
  await app.getByRole("group", { name: "What helps you" }).getByRole("button", { name: "Benches" }).click();
  await app.getByRole("list", { name: "How Saturday First Mile fits" }).getByText(/Benches — not listed/).waitFor({ timeout: 10000 });
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/circles-390.png`, fullPage: true });
  await p.close();
});

await step("no console errors", async () => {
  if (problems.length) throw new Error(problems.join(" | "));
});

console.log(`\n${passed} checks passed.`);
await browser.close();
