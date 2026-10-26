// End-to-end check of the Big picture (/vision) in headless Edge, against the
// running dev server (npm run dev, port 3240).
//
//   node scripts/check-vision.mjs
//
// Steps through all seven scenes by Next, by the arrow keys and by the dots, and
// checks each one's words, that the page never scrolls under you and that Next
// stays on screen. Tries the doorway's "I'm coming", the route-fit needs (Route A
// only fits once nothing it lacks is needed), the last scene's jump to the five
// summers, opening a summer, opening ideas from the map and the list, and the
// "Why it matters" sheet. Then the same story at phone width. Fails on console
// errors (a missing /posters/vision-* image is expected until posters are
// rendered), sideways scroll, a draw-call budget over 150, or words that don't
// belong on screen.

import { chromium } from "playwright-core";

const BASE = process.env.LAB_URL ?? "http://localhost:3240";
const OUT = "shots/vision";
const TITLES = ["Your city, moving.", "One poster. One doorway.", "A walk that fits.", "Nobody walks in alone.", "A partner funds the next walks.", "The city gets better.", "Seven cities. One summer."];
const BANNED = ["For Kirk", "For Kayla", "Mile Zero", "Dallas", "Atlanta", "London", "ShelfTrace", "Sicily", "Verity", "ictional", "Source"];

const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const problems = [];
let page;
let passed = 0;

function watch(p, where) {
  p.on("console", (m) => {
    if (m.type() !== "error") return;
    // The Stage's poster is rendered at the end; until then its 404 is expected.
    if (m.text().includes("Failed to load resource") && m.location()?.url?.includes("/posters/vision-")) return;
    problems.push(`${where} console: ${m.text()} (${m.location()?.url ?? "?"})`);
  });
  p.on("pageerror", (e) => problems.push(`${where} page: ${e.message}`));
}

async function step(name, run) {
  try {
    await run();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.log(`FAIL  ${name}\n      ${String(err.message).split("\n")[0]}`);
    await page.screenshot({ path: `${OUT}/check-vision-fail.png` }).catch(() => {});
    await browser.close();
    process.exit(1);
  }
}

const card = () => page.getByRole("region", { name: "The story, in seven scenes" });
const counter = async () => (await card().locator(".num").first().textContent())?.replace(/\s+/g, " ").trim();
const title = async () => (await card().getByRole("heading", { level: 2 }).textContent())?.trim();
const stayed = async () => {
  const g = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('section[aria-label="The story, in seven scenes"] button')];
    const bottom = Math.max(...buttons.map((b) => b.getBoundingClientRect().bottom));
    return { y: window.scrollY, bottom, h: window.innerHeight };
  });
  if (g.y > 0) throw new Error(`the page scrolled ${g.y}px`);
  if (g.bottom > g.h) throw new Error(`the card's buttons end at ${Math.round(g.bottom)}px, below the ${g.h}px screen`);
};

// ── Desktop ──
const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
page = await desktop.newPage();
watch(page, "desktop");

await step("opens on the line, scene 1 of 7, and the city draws", async () => {
  await page.goto(`${BASE}/vision`, { waitUntil: "load" });
  await page.getByRole("heading", { level: 1, name: "Find your people. Find your place. Find your next reason to move." }).waitFor();
  if ((await counter()) !== "01 / 07") throw new Error(`counter ${await counter()}`);
  if ((await title()) !== TITLES[0]) throw new Error(`title ${await title()}`);
  await page.waitForFunction(() => document.querySelector('[data-stage="vision"]')?.getAttribute("data-ready") === "true", null, { timeout: 90000 });
});

await step("Next walks through all seven scenes, and the page never scrolls under you", async () => {
  await page.mouse.move(2, 898);
  for (let i = 1; i < 7; i++) {
    await card().getByRole("button", { name: /^Next/ }).click();
    if ((await title()) !== TITLES[i]) throw new Error(`scene ${i + 1}: ${await title()}`);
    await stayed();
  }
  if ((await counter()) !== "07 / 07") throw new Error(`counter ${await counter()}`);
  await card().getByRole("button", { name: /Five summers/ }).waitFor();
});

await step("the finale is the Year 10 relay, Chicago to Los Angeles", async () => {
  const relay = (await card().locator("ol").last().innerText()).replace(/\s+/g, " ");
  if (!/Chicago.*Detroit.*Durham.*Charleston.*New York.*Montreal.*Los Angeles/.test(relay)) throw new Error(`relay: ${relay}`);
  await page.waitForTimeout(2500);
  const s = await page.evaluate(() => window.__fl4scenes?.vision ?? null);
  if (!s || s.calls > 150) throw new Error(`draw calls ${s?.calls}`);
  await page.screenshot({ path: `${OUT}/check-vision-relay.png` });
});

await step("← and → step the story; the dots jump to a scene", async () => {
  await page.keyboard.press("ArrowLeft");
  if ((await counter()) !== "06 / 07") throw new Error(`after ←: ${await counter()}`);
  await page.keyboard.press("ArrowRight");
  if ((await counter()) !== "07 / 07") throw new Error(`after →: ${await counter()}`);
  await card().getByRole("button", { name: "Scene 2: The person" }).click();
  if ((await title()) !== TITLES[1]) throw new Error(`dot: ${await title()}`);
});

await step("the doorway: “I'm coming” with no app", async () => {
  await card().getByText("No app needed").waitFor();
  await card().getByRole("button", { name: "I'm coming" }).click();
  await card().getByRole("button", { name: /You're in ✓/ }).waitFor();
});

await step("a walk that fits: Route A fits only once nothing it lacks is needed", async () => {
  await card().getByRole("button", { name: "Scene 3: The place" }).click();
  const routeA = () => card().locator("li").filter({ hasText: "Route A" });
  await routeA().getByText("Not yet").waitFor();
  for (const need of ["Step-free", "Shade", "Somewhere to rest"]) await card().getByRole("group", { name: "What she needs" }).getByRole("button", { name: new RegExp(need) }).click();
  await routeA().getByText("Fits").waitFor();
  await card().getByRole("group", { name: "What she needs" }).getByRole("button", { name: /Shade/ }).click();
  await routeA().getByText("Not yet").waitFor();
  await stayed();
});

await step("after the change, Route A fits; the last scene leads to the five summers", async () => {
  await card().getByRole("button", { name: "Scene 6: The change" }).click();
  await card().getByText("Fits now").waitFor();
  await card().getByRole("button", { name: "Scene 7: The network" }).click();
  await card().getByRole("button", { name: /Five summers/ }).click();
  await page.waitForFunction(() => {
    const r = document.getElementById("five-summers")?.getBoundingClientRect();
    return r && r.top < window.innerHeight * 0.5 && r.bottom > 0;
  }, null, { timeout: 8000 });
});

await step("five summers: possibilities said once, and a summer opens", async () => {
  const text = await page.locator("main").innerText();
  const said = text.split("Ideas, not promises — Kayla picks what's next.").length - 1;
  if (said !== 1) throw new Error(`"Ideas, not promises" appears ${said} times`);
  await page.getByRole("button", { name: /2029/ }).click();
  const detail = page.locator("#summer-detail");
  await detail.getByText("Grow it").first().waitFor();
  // One name per summer, the same as Home and Next 3 summers; nothing promised as already paying its way.
  if (/pays its way(?! —)/i.test(await page.locator("#five-summers").innerText()) && !/toward paying its way/i.test(await page.locator("#five-summers").innerText())) throw new Error("a summer promises it pays its way");
  if (await page.getByRole("button", { name: /2032/ }).count()) throw new Error("the last summer should be 2031");
  await detail.getByText("How we'd know").waitFor();
});

await step("the ideas map: a dot and a list name both open an idea", async () => {
  const map = page.getByRole("group", { name: "Ideas by value and effort" });
  await map.getByRole("button", { name: /^The Lead's Co-Pilot/ }).click();
  const open = page.locator("#ideas-map");
  await open.getByRole("heading", { level: 3, name: "The Lead's Co-Pilot" }).waitFor();
  await open.getByRole("button", { name: /Story Trails/ }).last().click();
  await open.getByRole("heading", { level: 3, name: "Story Trails" }).waitFor();
  const starred = await map.getByRole("button", { name: /start here/ }).count();
  if (starred !== 4) throw new Error(`${starred} ideas marked "start here"`);
  const doorway = open.getByRole("button", { name: /First-Mile Doorway/ }).last();
  await doorway.click();
  await open.getByText("Builds on what you have").first().waitFor();
});

await step("“Why it matters” opens a story and closes with Escape", async () => {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole("button", { name: "Why it matters" }).first().click();
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "detached" });
});

await step("no words that don't belong on screen", async () => {
  const text = await page.locator("main").innerText();
  for (const word of BANNED) if (text.includes(word)) throw new Error(`page says "${word}"`);
});
await desktop.close();

// ── Phone ──
const phoneCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
page = await phoneCtx.newPage();
watch(page, "phone");

await step("390 px: no sideways scroll; the city and the card share the screen through all seven scenes", async () => {
  await page.goto(`${BASE}/vision`, { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelector('[data-stage="vision"]')?.getAttribute("data-ready") === "true", null, { timeout: 90000 });
  for (let i = 1; i < 7; i++) {
    await card().getByRole("button", { name: /^Next/ }).click();
    if ((await title()) !== TITLES[i]) throw new Error(`scene ${i + 1}: ${await title()}`);
    await stayed();
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 1) throw new Error(`horizontal overflow ${overflow}px`);
  const fits = await page.evaluate(() => {
    const c = document.querySelector('section[aria-label="The story, in seven scenes"]').getBoundingClientRect();
    return [...document.querySelectorAll('section[aria-label="The story, in seven scenes"] button')].every((b) => {
      const r = b.getBoundingClientRect();
      return r.width === 0 || (r.left >= c.left - 1 && r.right <= c.right + 1);
    });
  });
  if (!fits) throw new Error("a button sticks out of the card");
  await page.screenshot({ path: `${OUT}/check-vision-390.png` });
});

await step("no console errors anywhere", async () => {
  if (problems.length) throw new Error(problems.join(" | "));
});

await browser.close();
console.log(`\n${passed} checks passed.`);
