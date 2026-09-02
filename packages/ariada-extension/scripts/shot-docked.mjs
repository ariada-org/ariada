// A REAL, single-window store screenshot: one mock Chrome window with the sample
// site filling it and the REAL side panel docked over its right edge — exactly
// how the extension looks in use. Both frames are the real code:
//   • right  = dist/sidepanel.html running a real scan of the sample DOM
//   • left   = the same sample DOM with the real overlay; the harness feeds it
//              the panel's own ordered findings, so page numbers == panel numbers,
//              and lights one block's connector line (focus) from under the panel.
// Nothing is drawn by hand. Requires BASE (http root serving the repo).
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../rules-axe/package.json', import.meta.url));
const { chromium } = require('playwright');

const BASE = process.env.BASE;
if (!BASE) throw new Error('BASE not set (serve the repo root over http and pass its URL).');
const out = new URL('../promo/screenshot-hero-1280x800.png', import.meta.url).pathname;

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

const FOCUS = 0; // which block's line to light (0-based)

const WINDOW = `<!doctype html><meta charset=utf-8>
<style>
 html,body{margin:0;height:100%;background:#dfe3e8;font:14px Inter,system-ui,sans-serif}
 .win{height:100vh;display:flex;flex-direction:column;background:#fff}
 .bar{height:46px;display:flex;align-items:center;gap:8px;padding:0 14px;background:#f1f3f4;border-bottom:1px solid #dadce0}
 .dot{width:12px;height:12px;border-radius:50%}.r{background:#ef4444}.y{background:#f59e0b}.g{background:#22c55e}
 .url{flex:1;margin-left:14px;background:#fff;border:1px solid #dadce0;border-radius:999px;height:28px;line-height:28px;padding:0 16px;color:#5f6368;font-size:13px}
 .puzzle{margin-left:12px;color:#5f6368;font-size:18px}
 .body{flex:1;position:relative;overflow:hidden}
 iframe{border:0}
 .page{position:absolute;inset:0;width:100%;height:100%}
 .panel{position:absolute;top:0;right:0;height:100%;width:396px;box-shadow:-10px 0 28px rgba(0,0,0,.18);background:#fff;border-left:1px solid #e5e7eb}
</style>
<div class="win">
 <div class="bar"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
   <span class="url">https://demo.example</span><span class="puzzle">🧩</span></div>
 <div class="body">
   <iframe class="page" src="${BASE}/packages/ariada-extension/promo/_page.html"></iframe>
   <iframe class="panel" src="${BASE}/packages/ariada-extension/dist/sidepanel.html"></iframe>
 </div>
</div>`;

const b = await chromium.launch({ channel: 'chrome' });
try {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  // Stub the chrome.* the panel init needs — applies to every frame.
  await page.addInitScript(() => {
    // eslint-disable-next-line no-undef
    if (!window.chrome?.runtime?.getManifest) window.chrome = { runtime: { getManifest: () => ({ version: '0.2.4' }) } };
  });
  await page.setContent(WINDOW, { waitUntil: 'networkidle' });

  const panel = page.frames().find((f) => f.url().includes('/sidepanel.html'));
  const site = page.frames().find((f) => f.url().includes('/_page.html'));
  if (!panel || !site) throw new Error('frames not found');

  // Panel scans the sample DOM, renders, and returns its own ordered findings.
  const findings = await panel.evaluate(async (html) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const snap = window.__ariadaCaptureSnapshot(doc, { scanId: 'demo', url: 'https://demo.example/' });
    const report = await window.__ariadaScanSnapshots([snap]);
    window.__ariadaRenderReport(report);
    return window.__ariadaOrderedFindings();
  }, SAMPLE_HTML);
  console.log('findings:', findings.length);

  // Select the focused block in the panel (selection highlight).
  const items = panel.locator('.block-item');
  if ((await items.count()) > FOCUS) await items.nth(FOCUS).click();

  // The site draws the SAME findings; light the focused block's line from under
  // the docked panel edge.
  await site.evaluate(({ f, focus }) => {
    window.__ov.show(f, 'numbered', { lines: true, disabled: [], focus });
  }, { f: findings, focus: FOCUS });

  await page.waitForTimeout(400);
  await page.screenshot({ path: out });
  console.log('DONE →', out);
} finally {
  await b.close();
}
