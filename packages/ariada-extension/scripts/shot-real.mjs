// Produce a REAL store screenshot — no hand-drawn mock. Steps:
//   1) load the built side panel (served over http; file:// blocks module load),
//      stub the chrome.* the init needs, run a REAL scan over a sample DOM through
//      the real engine, render the real report, click a finding to show the
//      selection state, and capture the real "Findings on this page" list — with
//      its master Lines switch and per-block switches — at high density (dsf 2).
//   2) compose that real, readable panel capture with the real in-page overlay
//      capture onto a 1280x800 branded canvas.
// Every pixel of product UI in the result is a real capture of the real code.
import { createRequire } from 'node:module';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(new URL('../../rules-axe/package.json', import.meta.url));
const { chromium } = require('playwright');

// The two intermediate captures were written to fixed names in the shared
// temporary directory, which anyone on the machine can write to and predict.
// Between the write and the read a second process can put its own file there,
// and the composed shot would carry it. A directory made for this run has a
// name nobody can guess and permissions nobody else holds.
const scratch = mkdtempSync(join(tmpdir(), 'ariada-shot-real-'));
const scratchFile = (name) => join(scratch, name);

const panelUrl = process.env.PANEL_URL;
if (!panelUrl) throw new Error('PANEL_URL not set (serve dist/ over http and pass the sidepanel.html URL).');
const promo = (n) => new URL(`../promo/${n}`, import.meta.url).pathname;

const SAMPLE_HTML = `<!doctype html><html lang="en"><head><title>Demo store</title></head>
<body>
  <div><img src="/hero.jpg"></div>
  <h1>Spring sale</h1>
  <p>Save on everything this week.</p>
  <form>
    <input type="email" placeholder="Email">
    <input type="text" placeholder="Name">
    <button></button>
  </form>
  <a href="/more" style="color:#bbb;background:#fff">See more</a>
  <div role="button">Add to cart</div>
</body></html>`;

const b = await chromium.launch({ channel: 'chrome' });
try {
  // ---- 1) real, readable panel (blocks list + switches) ----
  const ctx = await b.newContext({ viewport: { width: 470, height: 1200 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    // eslint-disable-next-line no-undef
    window.chrome = { runtime: { getManifest: () => ({ version: '0.2.4' }) } };
  });
  await page.goto(panelUrl, { waitUntil: 'networkidle' });
  const domains = await page.evaluate(async (html) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const snap = window.__ariadaCaptureSnapshot(doc, { scanId: 'demo', url: 'https://demo.example/' });
    const report = await window.__ariadaScanSnapshots([snap]);
    window.__ariadaRenderReport(report);
    return report.domains;
  }, SAMPLE_HTML);
  console.log('real scan domains:', domains.join(', '));
  // Click the second finding so the capture shows the selection highlight.
  const items = page.locator('.block-item');
  const n = await items.count();
  if (n > 1) await items.nth(1).click();
  await page.waitForTimeout(250);
  await page.locator('.blocks-section').screenshot({ path: scratchFile('panel-list.png') });
  // Also capture the domain matrix for context.
  await page.locator('.report-grid, table').first().screenshot({ path: scratchFile('panel-grid.png') }).catch(() => {});
  await ctx.close();

  // ---- 2) compose real panel list + real overlay onto 1280x800 ----
  const listB64 = readFileSync(scratchFile('panel-list.png')).toString('base64');
  const overlayB64 = readFileSync(promo('overlay-numbered-demo.png')).toString('base64');
  // panel-list source is 470 css wide (dsf2 → 940px). Show it big on the right.
  const comp = `<!doctype html><meta charset=utf-8><body style="margin:0">
  <svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800" viewBox="0 0 1280 800" font-family="Inter, system-ui, sans-serif">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1d4ed8"/><stop offset="1" stop-color="#172554"/></linearGradient></defs>
    <rect width="1280" height="800" fill="url(#g)"/>
    <text x="60" y="76" fill="#fff" font-size="34" font-weight="800">Every finding is a block you can act on</text>
    <text x="60" y="112" fill="#bfdbfe" font-size="19">Numbered on the page, numbered in the panel. Select a block to light its line; switch lines off per block or all at once.</text>
    <!-- left: real page with the numbered overlay -->
    <image x="60" y="150" width="620" height="600" href="data:image/png;base64,${overlayB64}" preserveAspectRatio="xMidYMin slice"/>
    <rect x="60" y="150" width="620" height="600" rx="12" fill="none" stroke="#ffffff" opacity="0.25"/>
    <!-- right: real panel blocks list with the master + per-block switches -->
    <rect x="712" y="132" width="508" height="636" rx="16" fill="#ffffff"/>
    <image x="724" y="144" width="484" height="612" href="data:image/png;base64,${listB64}" preserveAspectRatio="xMidYMin meet"/>
  </svg></body>`;
  const ctx2 = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const page2 = await ctx2.newPage();
  await page2.setContent(comp);
  await page2.locator('svg').screenshot({ path: promo('screenshot-hero-1280x800.png') });
  await ctx2.close();
  console.log('DONE → screenshot-hero-1280x800.png (real, readable panel + real overlay)');
} finally {
  await b.close();
}
