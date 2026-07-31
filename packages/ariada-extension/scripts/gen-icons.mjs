// Render the real Ariada mark (triangle + Ariadne's thread) to PNG icons at the
// sizes the manifest needs, into public/icons/ so the build ships them.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(new URL('../../rules-axe/package.json', import.meta.url));
const { chromium } = require('playwright');

const svg = (n) => `<!doctype html><meta charset=utf-8><body style="margin:0">
<svg xmlns="http://www.w3.org/2000/svg" width="${n}" height="${n}" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="26" fill="#1d4ed8"/>
  <polygon points="64,24 18,106 110,106" fill="#ffffff"/>
  <path d="M38,76 C50,60 58,60 64,76 C70,92 78,92 90,76" fill="none" stroke="#1d4ed8" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
</svg></body>`;

mkdirSync(new URL('../public/icons/', import.meta.url), { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
for (const size of [16, 48, 128]) {
  const ctx = await browser.newContext({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.setContent(svg(size));
  const el = await page.$('svg');
  await el.screenshot({ path: new URL(`../public/icons/icon-${size}.png`, import.meta.url).pathname, omitBackground: true });
  await ctx.close();
  console.log(`icon-${size}.png`);
}
await browser.close();
console.log('DONE');
