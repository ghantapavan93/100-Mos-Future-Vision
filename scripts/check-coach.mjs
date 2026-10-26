// End-to-end check of the coach screen in headless Edge, against the running
// dev server (http://localhost:3240 unless LAB_URL is set).
//
//   node scripts/check-coach.mjs [screens-dir]
//
// Plays the "Ask it a real question" steps on the phone, following the guiding
// ring: a missed-week answer, "Who says?" (Kayla's lessons are drafts for her
// review, never her words, and she OKs them once, before May 1; guidance is
// named in plain words, never as a citation), a saved step that reaches the
// member's Today screen, and Safe Stop for knee pain (no plan, a person
// instead). Then: the ideas drive the phone and credit what she already does,
// "Forget what I asked" deletes the words, the default page shows no lab and
// no lab words, the lab (only with ?lab=1) never shows a sealed question,
// phones get the same app with no sideways scroll, and there are no console errors.

import { mkdir, readFile } from "node:fs/promises";
import { chromium } from "playwright-core";

// Read only to check the page never shows them. Never printed.
const SEALED_QUESTIONS = JSON.parse(await readFile(new URL("../src/domain/quantum/heldout.sealed.json", import.meta.url), "utf8")).map((c) => c.question);

const BASE = process.env.LAB_URL ?? "http://localhost:3240";
const OUT = (process.argv[2] ?? "shots/s1").replace(/\/$/, "");
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ channel: "msedge", headless: true });
const problems = [];
let passed = 0;
let page;

function watch(p, where) {
  p.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource.*404/.test(m.text())) problems.push(`[${where}] console: ${m.text()}`);
  });
  p.on("pageerror", (e) => problems.push(`[${where}] page: ${e.message}`));
}

async function step(name, run) {
  try {
    await run();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.log(`FAIL  ${name}\n      ${String(err.message).split("\n")[0]}`);
    await page?.screenshot({ path: `${OUT}/coach-fail.png`, fullPage: true });
    await browser.close();
    process.exit(1);
  }
}
const visible = (locator, what) =>
  locator
    .first()
    .waitFor({ state: "visible", timeout: 15000 })
    .catch(() => {
      throw new Error(`expected ${what}`);
    });

const app = () => page.getByTestId("coach-app");
const chip = (name) => app().getByRole("group", { name: "Questions" }).getByRole("button", { name, exact: true });
const progress = (n) => visible(page.locator("#try").getByText(`${n} of 4`, { exact: true }), `${n} of 4 steps`);
const answers = () => app().getByRole("article", { name: "Coach's answer" });
const toTry = () => page.evaluate(() => document.querySelector("#try")?.scrollIntoView({ block: "start" }));
/** Waits until the guiding ring sits on the phone control for this step, and only there. */
const ringOn = (stepId) =>
  page
    .waitForFunction(
      (id) => {
        const rings = document.querySelectorAll("#try .step-ring");
        return rings.length === 1 && rings[0].getAttribute("data-step-target") === id;
      },
      stepId,
      { timeout: 5000 },
    )
    .catch(() => {
      throw new Error(`the guiding ring isn't on the "${stepId}" control`);
    });

page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
watch(page, "1440");
await page.goto(BASE + "/coach");
await page.evaluate(() => sessionStorage.clear());
await page.reload({ waitUntil: "networkidle" });

await step("the page opens on the hero, three numbers and the coach phone, with no lab in sight", async () => {
  await visible(page.getByRole("heading", { level: 1, name: /AI that knows your summer\./ }), "the headline");
  if (!/^Quantum Health Coach/.test(await page.title())) throw new Error(`page title: ${await page.title()}`);
  await visible(page.getByText("Waiting for Kayla's OK — once, before May 1"), "the approval time in the legend");
  await visible(page.getByRole("region", { name: "In numbers" }).getByText("#1", { exact: true }), "the enjoyment number");
  // Nothing on the page says Kayla has already approved anything.
  const said = await page.locator("main").innerText();
  for (const claim of ["okayed", "tips Kayla OKs", "64%"]) if (said.includes(claim)) throw new Error("the Ask page still says " + claim);
  await visible(page.getByRole("region", { name: "In numbers" }).getByLabel("+23%"), "the last-place number");
  await page.locator('[data-stage="coach"]').waitFor({ state: "attached" });
  await toTry();
  await visible(app().getByText(/Ask me anything about moving this summer/), "the coach's hello");
  await progress(0);
  const text = await page.locator("main").innerText();
  // "Quantum Health Coach" / "Quantum Coach" is the product's name now; the bare engine word is still jargon.
  for (const word of [/sealed/i, /Coach Lab/, /ruleset/i, /deterministic/i, /language model in this demo/i, /\bQUANTUM\b(?!\s+(?:HEALTH\s+)?COACH)/i, /Strava never/i, /behind glass/i, /10% rule/i]) {
    if (word.test(text)) throw new Error(`lab or jargon on the default page: ${word}`);
  }
  await page.screenshot({ path: `${OUT}/coach-try-0.png` });
});

await step("the coach opens joy-first: feeling good today matters more than going far, and says why", async () => {
  const note = app().getByTestId("calm-note");
  await visible(note.getByText("One thing first: feeling good today matters more than going far."), "the calm note");
  await note.getByRole("button", { name: "Why?" }).click();
  await visible(note.getByText(/People who enjoy a walk are the ones who come back/), "the reason");
  if (/Kayla says|I'm Kayla|— Kayla/.test(await note.innerText())) throw new Error("the calm note speaks as Kayla");
});

await step("1 · ask about a missed week: an empty chat offers three big questions, the first ringed; a short, kind answer", async () => {
  const offered = app().getByRole("group", { name: "Try one" }).getByRole("button");
  if ((await offered.count()) !== 3) throw new Error(`the empty chat offers ${await offered.count()} questions, not 3`);
  const first = (await offered.first().textContent()) ?? "";
  if (!first.includes("I missed 12 days")) throw new Error(`the first offered question is "${first}"`);
  await ringOn("missed");
  // The offer sits in the chat itself, inside the phone's first screen, not below it.
  const box = await offered.first().boundingBox();
  const phoneBox = await page.getByTestId("phone").boundingBox();
  if (!box || !phoneBox || box.y + box.height > phoneBox.y + 520) throw new Error("the first question isn't on the phone's first screen");
  await offered.first().click();
  await visible(answers(), "an answer");
  if (await app().getByRole("group", { name: "Try one" }).count()) throw new Error("the offer stays after the first answer");
  await visible(app().getByText("I missed 12 days and I feel like I ruined everything."), "the question as a bubble");
  await progress(1);
});

await step("2 · Who says?: every card names who stands behind it; lessons are drafts for Kayla", async () => {
  await ringOn("who");
  await answers().last().getByTestId("who-says").click();
  const sheet = app().getByRole("dialog", { name: "Who says?" });
  await visible(sheet, "the Who says? sheet");
  await visible(sheet.getByText("Written by the 100 Miles team for Kayla to review. Not her words until she says yes."), "the draft label");
  await visible(sheet.getByText(/Kayla says yes or no to each of hers once, before May 1/), "when Kayla approves");
  // The sheet takes focus and closes on Esc (focus goes back where it was).
  await page.waitForFunction(() => document.activeElement?.closest("[role=dialog]")?.getAttribute("aria-label") === "Who says?");
  await page.keyboard.press("Escape");
  await sheet.waitFor({ state: "detached" });
  await answers().last().getByTestId("who-says").click();
  await visible(sheet, "the Who says? sheet again");
  const words = await sheet.innerText();
  if (/et al\.|2nd ed\.|\(20\d\d\)|Med Sci/.test(words)) throw new Error("the sheet reads like a citation");
  await progress(2);
  await toTry();
  await page.screenshot({ path: `${OUT}/coach-whosays.png` });
  await sheet.getByRole("button", { name: "Done" }).click();
});

await step("3 · save the small step: it waits on the member's Today screen", async () => {
  await ringOn("save");
  await answers().last().getByTestId("save-step").click();
  await visible(answers().last().getByText("Saved — it's on your Today screen"), "the saved note");
  await progress(3);
  // The store persists the command log; the save must be in it, not just on screen.
  const saves = await page.evaluate(() => {
    const saved = JSON.parse(sessionStorage.getItem("fl4.log.v2") ?? "{}");
    return Array.isArray(saved.log) ? saved.log.filter((e) => e.input?.type === "SAVE_NEXT_STEP").length : 0;
  });
  if (saves !== 1) throw new Error(`expected one saved step in the log, found ${saves}`);
});

await step("4 · knee pain: Safe Stop, a person instead of a plan, and the try-it finishes", async () => {
  await ringOn("pain");
  // The ringed chip slides into view in the chip row, so nobody has to hunt for it.
  await page
    .waitForFunction(
      () => {
        const c = document.querySelector('[data-step-target="pain"]')?.getBoundingClientRect();
        const r = document.querySelector('[data-step-target="pain"]')?.closest(".overflow-x-auto")?.getBoundingClientRect();
        return c && r && c.left >= r.left - 1 && c.right <= r.right + 1;
      },
      null,
      { timeout: 5000 },
    )
    .catch(() => {
      throw new Error("the Knee pain chip stays scrolled out of sight");
    });
  await chip("Knee pain").click();
  const last = answers().last();
  await visible(last.getByTestId("safe-stop"), "the Safe Stop banner");
  if (await last.getByTestId("save-step").count()) throw new Error("Safe Stop offered a step");
  await progress(4);
  await visible(page.locator("#try").getByText("That's the Quantum Health Coach", { exact: false }), "the finale");
  if (await page.locator("#try .step-ring").count()) throw new Error("a guiding ring is left after the last step");
  await toTry();
  await page.screenshot({ path: `${OUT}/coach-safestop.png` });
});

await step("what just happened never shows a rule id or a receipt number", async () => {
  const feed = await page.locator("#try").getByText("What just happened").locator("..").innerText();
  if (/receipt|#\d|[A-Z]{3,}-\d{2}/.test(feed)) throw new Error(`jargon in the feed: ${feed.slice(0, 160)}`);
});

await step("idea · One small step: Show me asks an everyday question whose answer ends in one step to save", async () => {
  const before = await answers().count();
  await page.locator("#ideas").getByRole("listitem").filter({ hasText: "One small step" }).getByRole("button", { name: "Show me" }).click();
  await visible(app().getByText("I'm sore today. Should I rest or push through?"), "the sore-today question");
  if ((await answers().count()) !== before + 1) throw new Error("no new answer");
  await visible(answers().last().getByTestId("save-step"), "the one step to save");
});

await step("ideas · Pep Talk and Ask a Person say they build on what she already does", async () => {
  for (const title of ["Pep Talk", "Ask a Person"]) {
    const row = page.locator("#ideas").getByRole("listitem").filter({ hasText: title });
    await visible(row.getByText("Builds on what you have"), `${title} credited as hers`);
  }
});

await step("asking as someone else changes who the phone speaks to", async () => {
  await page.locator("#try").getByRole("radio", { name: "James" }).click();
  await visible(app().getByText("Asking as James"), "James in the header");
  if (await answers().count()) throw new Error("James sees Maya's answers");
  await page.locator("#try").getByRole("radio", { name: "Maya" }).click();
  await visible(app().getByText("Asking as Maya"), "Maya back");
});

await step("Forget what I asked deletes the words from the phone", async () => {
  await app().getByTestId("forget-coach").click();
  await page.waitForTimeout(300);
  if (await answers().count()) throw new Error("answers still shown after forgetting");
});

await step("How we'd build it is closed until Kirk opens it", async () => {
  const details = page.locator("details").filter({ hasText: "How we'd build it" });
  if (await details.getAttribute("open")) throw new Error("open by default");
  await details.locator("summary").click();
  await visible(details.getByText("Tips in one table"), "the first line");
  await visible(details.getByRole("listitem").filter({ hasText: "The AI step" }).getByText(/^Medium/), "the AI step, sized");
  await visible(details.getByRole("listitem").filter({ hasText: "Rules around the AI" }), "the rules around the AI");
});

await step("the lab exists only with ?lab=1, and never shows a sealed question", async () => {
  await page.goto(BASE + "/coach?lab=1", { waitUntil: "networkidle" });
  await visible(page.getByTestId("lab-dev"), "the DEV score");
  await visible(page.getByTestId("lab-sealed"), "the SEALED score");
  await visible(page.getByTestId("sealed-sha").getByText(/^sha256 [0-9a-f]{64}$/), "the SHA-256");
  const text = await page.evaluate(() => {
    const body = document.body.cloneNode(true);
    body.querySelector('[data-testid="eval-dev"]')?.remove();
    return body.textContent ?? "";
  });
  const leaked = SEALED_QUESTIONS.filter((q) => text.includes(q)).length;
  if (leaked) throw new Error(`${leaked} sealed question text(s) visible outside the DEV rows`);
});

await page.close();
page = await browser.newPage({ viewport: { width: 390, height: 844 } });
watch(page, "390");
await page.goto(BASE + "/coach", { waitUntil: "networkidle" });

await step("phone: one coach app, chips work, no sideways scroll", async () => {
  await toTry();
  if ((await page.getByTestId("coach-app").count()) !== 1) throw new Error("the coach app is mounted more than once");
  await app().getByRole("group", { name: "Try one" }).getByRole("button", { name: /I'm sore today/ }).click();
  await visible(answers(), "an answer on a phone");
  await chip("Knee pain").click();
  await visible(answers().last().getByTestId("safe-stop"), "Safe Stop from the chip row on a phone");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 1) throw new Error(`horizontal overflow ${overflow}px`);
  await page.screenshot({ path: `${OUT}/coach-390-try.png` });
});

await step("no console errors", async () => {
  if (problems.length) throw new Error(problems.join(" | "));
});

console.log(`\n${passed} checks passed.`);
await browser.close();
