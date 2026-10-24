// The whole demo, end to end, the way Kayla or Kirk would meet it: Home, the
// 13-stop tour through every screen with every "Show me" pressed, then a
// check that what the tour did is what each screen shows. Then every screen at
// phone width. Fails on any console error or sideways scroll. Each screen's
// own phone flow has its own check script (check-member, check-circles, …).
//
//   npm run dev   (port 3240)
//   node scripts/walk.mjs

import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";

const BASE = process.env.LAB_URL ?? "http://localhost:3240";
const OUT = "shots/walk";
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const problems = [];
page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()} (${m.location()?.url ?? "?"} on ${new URL(page.url()).pathname})`));
page.on("pageerror", (e) => problems.push(`page: ${e.message}`));
// Name the resource behind any "Failed to load resource" console error.
const failedResponse = (where) => (r) => r.status() >= 400 && problems.push(`${where}${r.status()} ${new URL(r.url()).pathname}`);
page.on("response", failedResponse(""));

let n = 0;
async function step(name, run) {
  n++;
  try {
    await run();
    console.log(`  ok  ${String(n).padStart(2)} ${name}`);
  } catch (err) {
    console.log(`FAIL  ${String(n).padStart(2)} ${name}\n      ${String(err.message).split("\n")[0]}`);
    await page.screenshot({ path: `${OUT}/fail-${n}.png` });
    await browser.close();
    process.exit(1);
  }
}
const see = (locator) => locator.first().waitFor({ state: "visible", timeout: 15000 });
const tour = () => page.getByRole("complementary", { name: "Tour" });

await step("Home opens on the first mile", async () => {
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.evaluate(() => sessionStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await see(page.getByRole("heading", { name: "Every first mile looks like this." }));
});

await step("Home says what 100 Miles of Summer already is, with no sources or disclaimers", async () => {
  await see(page.getByRole("heading", { name: /What you've already built/ }));
  await see(page.getByRole("heading", { name: /Built on what you have/ }));
  await see(page.getByRole("heading", { name: /People stay when they have people/ }));
  const text = await page.locator("main").innerText();
  for (const banned of ["Independent prototype", "Sources ·", "public record", "Fictional", "[1]", "For Kirk", "For Kayla"]) {
    if (text.includes(banned)) throw new Error(`Home still shows "${banned}"`);
  }
});

await step("the tour opens", async () => {
  await page.getByRole("button", { name: "Tour", exact: true }).click();
  await see(tour().getByText("It starts with one first mile."));
});

const ROUTES = ["/", "/member", "/member", "/coach", "/circles", "/circles", "/partner", "/partner", "/impact", "/founder", "/xray", "/future", "/vision"];
for (let i = 0; i < ROUTES.length; i++) {
  const route = ROUTES[i];
  await step(`tour step ${i + 1} → ${route}`, async () => {
    await page.waitForURL((u) => new URL(u).pathname === route, { timeout: 15000 });
    const show = tour().getByRole("button", { name: "Show me" });
    if (await show.count()) {
      await show.click();
      await see(tour().getByRole("button", { name: /Done/ }));
    }
    await page.screenshot({ path: `${OUT}/tour-${String(i + 1).padStart(2, "0")}.png` });
    await tour().getByRole("button", { name: i === ROUTES.length - 1 ? "Finish" : "Next" }).click();
  });
}

await step("Maya's summer adds up: 12.4 + two group walks + one evening walk sent three times = 15.8 mi", async () => {
  await page.getByRole("navigation", { name: "Lenses" }).first().getByRole("link", { name: "Member", exact: true }).click();
  await see(page.getByText(/15\.8/));
});

await step("no lab words on any screen", async () => {
  for (const route of ["/member", "/coach", "/circles", "/partner", "/impact", "/founder", "/future", "/vision", "/xray", "/build"]) {
    await page.goto(BASE + route, { waitUntil: "networkidle" });
    const text = await page.locator("main").innerText();
    for (const banned of ["Receipt #", "STRAVA-0", "APPLE-0", "sealed set", "ruleset", "Deterministic composer", "Independent prototype", "Fictional data", "For Kirk", "for Kirk", "For Kayla", "QUANTUM", "Mile Zero"]) {
      if (text.includes(banned)) throw new Error(`${route} shows "${banned}"`);
    }
  }
});

// ── Phone width ──
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const phone = await mobile.newPage();
phone.on("console", (m) => m.type() === "error" && problems.push(`phone console: ${m.text()}`));
phone.on("pageerror", (e) => problems.push(`phone page: ${e.message}`));
phone.on("response", failedResponse("phone "));
for (const route of ["/", "/member", "/coach", "/circles", "/partner", "/impact", "/founder", "/future", "/vision", "/xray", "/build"]) {
  await step(`phone 390px ${route}: no sideways scroll`, async () => {
    await phone.goto(BASE + route, { waitUntil: "networkidle" });
    await phone.waitForTimeout(900);
    const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 1) throw new Error(`horizontal overflow ${overflow}px`);
    await phone.screenshot({ path: `${OUT}/phone${route === "/" ? "-home" : route.replace("/", "-")}.png` });
  });
}

await step("no console errors anywhere", async () => {
  if (problems.length) throw new Error(problems.join(" | "));
});

console.log(`\nwalk passed: ${n} steps`);
await browser.close();
