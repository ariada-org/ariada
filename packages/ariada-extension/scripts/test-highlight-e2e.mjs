// Focused e2e for the new in-page highlight: load the built extension into a
// real Chrome, open a page with bad elements, drive the content script's
// highlight_request, and assert the overlay boxes are drawn ON the page.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../../rules-axe/package.json', import.meta.url));
const { chromium } = require('playwright');

const distPath = fileURLToPath(new URL('../dist', import.meta.url));
// MV3 service workers only run under the NEW headless mode. Pass --headless=new
// explicitly and set headless:false so Playwright doesn't add the old --headless.
const ctx = await chromium.launchPersistentContext('', {
  channel: 'chrome',
  headless: false,
  args: ['--headless=new', `--disable-extensions-except=${distPath}`, `--load-extension=${distPath}`],
});
let ok = true;
try {
  // Opening a page first often wakes the MV3 service worker.
  const warm = await ctx.newPage();
  await warm.goto('about:blank');
  // the extension's background service worker
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 25000 });
  const extId = new URL(sw.url()).host;
  console.log('extension loaded, id =', extId);

  const page = await ctx.newPage();
  await page.setContent('<!doctype html><body style="height:1200px"><img id="logo"><input id="user" type="text"><a id="lnk" style="color:#bbb">low</a></body>');
  await page.bringToFront();

  // From the SW: inject content.js into the active tab, then send a highlight.
  const findings = [
    { selector: '#logo', severity: 'critical', message: 'Image missing alt' },
    { selector: '#user', severity: 'critical', message: 'Field has no label' },
    { selector: '#lnk', severity: 'serious', message: 'Contrast below 4.5:1' },
  ];
  const res = await sw.evaluate(async (f) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    return await chrome.tabs.sendMessage(tab.id, { kind: 'highlight_request', findings: f, painter: 'box' });
  }, findings);
  console.log('highlight_request reply:', JSON.stringify(res));

  await page.waitForTimeout(400);
  const overlay = await page.locator('[data-ariada-overlay]').count();
  const boxes = await page.locator('[data-ariada-overlay] > div').count();
  console.log('overlay present:', overlay === 1, '| boxes drawn:', boxes);
  if (overlay !== 1 || boxes < 2) { ok = false; console.error('FAIL: overlay/boxes not drawn'); }

  // switch painter to the Dracula mascot and re-highlight
  const res2 = await sw.evaluate(async (f) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.sendMessage(tab.id, { kind: 'highlight_request', findings: f, painter: 'box' }); // toggle off
    return await chrome.tabs.sendMessage(tab.id, { kind: 'highlight_request', findings: f, painter: 'dracula' });
  }, findings);
  await page.waitForTimeout(300);
  const mascot = await page.evaluate(() => [...document.querySelectorAll('[data-ariada-overlay] div')].some((d) => d.textContent === '🧛'));
  console.log('dracula mascot on page:', mascot, '| reply:', JSON.stringify(res2));
  if (!mascot) { ok = false; console.error('FAIL: mascot painter did not draw'); }
} catch (e) {
  ok = false; console.error('ERROR:', String(e).split('\n')[0]);
} finally {
  await ctx.close();
}
console.log(ok ? '\n✅ HIGHLIGHT E2E PASSED' : '\n❌ HIGHLIGHT E2E FAILED');
process.exit(ok ? 0 : 1);
