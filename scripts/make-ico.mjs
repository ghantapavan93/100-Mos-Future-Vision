// Renders src/app/icon.svg at 32 and 16 px in Edge and wraps the PNGs in an .ico.
import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright-core";

const svg = await readFile("src/app/icon.svg", "utf8");
const browser = await chromium.launch({ channel: "msedge", headless: true });
const pngs = [];
for (const size of [16, 32]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<style>html,body{margin:0;background:transparent}</style><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}" width="${size}" height="${size}">`);
  pngs.push({ size, data: await page.screenshot({ omitBackground: true }) });
  await page.close();
}
await browser.close();

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(pngs.length, 4);
let offset = 6 + 16 * pngs.length;
const entries = pngs.map(({ size, data }) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(size, 0);
  e.writeUInt8(size, 1);
  e.writeUInt16LE(1, 4);
  e.writeUInt16LE(32, 6);
  e.writeUInt32LE(data.length, 8);
  e.writeUInt32LE(offset, 12);
  offset += data.length;
  return e;
});
await writeFile("src/app/favicon.ico", Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]));
console.log("favicon.ico", offset, "bytes");
