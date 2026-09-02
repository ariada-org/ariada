// Render the two drawn store graphics to PNG at the exact sizes the store
// requires: the marquee tile (1400x560) and the small tile (440x280). Brand:
// blue (#1d4ed8), triangle + Ariadne's-thread mark. Reuses the gen-icons render
// approach. The 1280x800 screenshot is not drawn — see the note further down.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(new URL('../../rules-axe/package.json', import.meta.url));
const { chromium } = require('playwright');

const OUT = new URL('../promo/', import.meta.url);
mkdirSync(OUT, { recursive: true });

// Reusable brand mark (triangle + thread), sized by viewBox.
const mark = (x, y, s) => `
  <g transform="translate(${x},${y})">
    <rect width="${s}" height="${s}" rx="${s * 0.2}" fill="#ffffff"/>
    <polygon points="${s / 2},${s * 0.19} ${s * 0.14},${s * 0.83} ${s * 0.86},${s * 0.83}" fill="#1d4ed8"/>
    <path d="M${s * 0.3},${s * 0.59} C${s * 0.39},${s * 0.47} ${s * 0.45},${s * 0.47} ${s / 2},${s * 0.59} C${s * 0.55},${s * 0.71} ${s * 0.61},${s * 0.71} ${s * 0.7},${s * 0.59}"
      fill="none" stroke="#ffffff" stroke-width="${s * 0.07}" stroke-linecap="round"/>
  </g>`;

const bg = `
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1d4ed8"/><stop offset="1" stop-color="#172554"/>
    </linearGradient>
  </defs>`;

// 1400x560 marquee
const marquee = `<!doctype html><meta charset=utf-8><body style="margin:0">
<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="560" viewBox="0 0 1400 560" font-family="Inter, system-ui, sans-serif">
  ${bg}<rect width="1400" height="560" fill="url(#g)"/>
  ${mark(110, 90, 120)}
  <text x="260" y="150" fill="#fff" font-size="30" font-weight="700">ariada scanner</text>
  <text x="110" y="285" fill="#fff" font-size="62" font-weight="800">Scan any page for compliance</text>
  <text x="112" y="345" fill="#bfdbfe" font-size="27" font-weight="500">Accessibility · Privacy · AI-readiness · Structured data · Sustainability</text>
  <text x="112" y="392" fill="#93c5fd" font-size="24" font-weight="500">Runs locally in your browser — nothing leaves the page. Open source, EUPL-1.2.</text>
  <!-- real severity chips as a subtle motif, well clear of the text baseline -->
  <g transform="translate(112,440)">
    <rect width="96" height="30" rx="15" fill="#dc2626"/><text x="48" y="20" fill="#fff" font-size="14" font-weight="700" text-anchor="middle">critical</text>
    <rect x="112" width="96" height="30" rx="15" fill="#f59e0b"/><text x="160" y="20" fill="#fff" font-size="14" font-weight="700" text-anchor="middle">serious</text>
    <rect x="224" width="112" height="30" rx="15" fill="#0ea5e9"/><text x="280" y="20" fill="#fff" font-size="14" font-weight="700" text-anchor="middle">moderate</text>
  </g>
</svg></body>`;

// 440x280 small tile
const small = `<!doctype html><meta charset=utf-8><body style="margin:0">
<svg xmlns="http://www.w3.org/2000/svg" width="440" height="280" viewBox="0 0 440 280" font-family="Inter, system-ui, sans-serif">
  ${bg}<rect width="440" height="280" fill="url(#g)"/>
  ${mark(160, 40, 120)}
  <text x="220" y="215" fill="#fff" font-size="34" font-weight="800" text-anchor="middle">ariada scanner</text>
  <text x="220" y="248" fill="#bfdbfe" font-size="18" font-weight="500" text-anchor="middle">multi-domain compliance</text>
</svg></body>`;

// There is no third template here. A store screenshot has to be a capture of
// the product rather than a drawing of it, so the 1280x800 one is produced by
// scripts/shot-real.mjs — a real scan, rendered by the real panel, composed
// with the real overlay. The mock that used to sit here was kept unused behind
// a no-op statement, which is a way of keeping something while saying it is not
// wanted; the sentence above is the part worth keeping.
const jobs = [
  ['marquee-1400x560.png', marquee, 1400, 560],
  ['small-tile-440x280.png', small, 440, 280],
];

const browser = await chromium.launch({ channel: 'chrome' });
try {
  for (const [name, html, w, h] of jobs) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.setContent(html);
    await page.locator('svg').screenshot({ path: new URL(name, OUT).pathname });
    await ctx.close();
    console.log(name);
  }
} finally {
  await browser.close();
}
console.log('DONE →', OUT.pathname);
