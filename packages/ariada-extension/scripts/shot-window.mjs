// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Capture the extension as a user actually sees it: one real Chrome window,
// the built extension loaded, the side panel docked against the page it
// scanned.
//
// The previous promotional shot took two separate captures and pasted them
// onto a blue gradient. Every pixel inside those cards was real, but the
// arrangement was not — nobody sees two floating panels on a gradient, and a
// store listing is meant to show the product rather than a poster of it.
//
// The side panel is browser interface, not page content, so no page-level
// screenshot reaches it: the window is captured through the operating system
// instead. Chrome is started from the command line with the extension loaded
// and a debugging port open, and the scan is driven through that port — the
// panel is itself a page in the extension's context.
//
// Usage: node scripts/shot-window.mjs

import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../rules-axe/package.json', import.meta.url));
const { chromium } = require('playwright');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env['CDP_PORT'] ?? 9333);

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');
const dist = join(pkgRoot, 'dist');
// The output is the one file this package names, and it is named here rather
// than taken from the command line. It used to be an argument with a
// containment check behind it, twice written and twice correct — but nothing
// ever passed one, and from outside a guard the analysis cannot follow and a
// guard nobody wrote look the same. There is nothing left to trace now.
const outFile = join(pkgRoot, 'promo', 'screenshot-window-1280x800.png');
const demoUrl = process.env['DEMO_URL'] ?? 'http://127.0.0.1:8321/';

const sh = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8' }).trim();
const osa = (s) => sh('osascript', ['-e', s]);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

mkdirSync(dirname(outFile), { recursive: true });

// A throwaway profile: the founder's own Chrome is never touched, and the
// window starts clean — no bookmarks, no other extensions in frame.
const profile = mkdtempSync(join(tmpdir(), 'ariada-shot-'));

const chrome = spawn(
  CHROME,
  [
    `--user-data-dir=${profile}`,
    `--disable-extensions-except=${dist}`,
    `--load-extension=${dist}`,
    `--remote-debugging-port=${PORT}`,
    '--window-size=1440,900',
    '--window-position=40,60',
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-crash-restore-bubble',
    '--disable-features=Translate,MediaRouter',
    demoUrl,
  ],
  { stdio: 'ignore', detached: true },
);

const stop = () => {
  try {
    process.kill(-chrome.pid, 'SIGTERM');
  } catch {
    /* already gone */
  }
};

try {
  await wait(4000);
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
  const context = browser.contexts()[0];
  const panelOf = () => context.pages().find((p) => p.url().includes('sidepanel.html'));

  // The panel opens on the extension's keyboard shortcut. It used to have
  // none — the only way in was a mouse click on a toolbar button, which is
  // both an accessibility defect in an accessibility tool and impossible to
  // automate reliably: the button is browser interface, its position moves
  // between Chrome versions, and a freshly loaded extension is not pinned to
  // the toolbar at all.
  //
  // Chrome needs the window focused for the shortcut to reach it, so raise it
  // by clicking inside the page area first — a click inside the viewport
  // cannot hit browser interface or another application's window.
  // The top edge is not needed — only a point inside the page area — so it is
  // not named. A name bound to a value nothing reads invites the next reader to
  // look for the use.
  const [wx, , wRight, wBottom] = osa(
    `tell application "Google Chrome" to get bounds of window 1`,
  )
    .split(',')
    .map((n) => Number(n.trim()));
  sh('cliclick', [`c:${Math.round((wx + wRight) / 2)},${Math.round(wBottom - 60)}`]);
  await wait(900);
  sh('cliclick', ['kd:alt,shift', 't:a', 'ku:alt,shift']);
  await wait(2500);

  const panel = panelOf();
  if (!panel) {
    throw new Error(
      'side panel did not open on Alt+Shift+A. Confirm the shortcut is ' +
        'registered for this profile (chrome://extensions/shortcuts).',
    );
  }

  await panel.getByRole('button', { name: /scan/i }).first().click();
  await panel.locator('.blocks-section').waitFor({ timeout: 90_000 });
  await wait(3000);

  // Select a block, so the capture shows the emphasis the panel offers rather
  // than a list at rest.
  const block = panel.locator('.block-item:not([aria-disabled="true"])').first();
  if (await block.count()) {
    await block.click();
    await wait(1500);
  }

  const [x, y, right, bottom] = osa(`tell application "Google Chrome" to get bounds of window 1`)
    .split(',')
    .map((n) => Number(n.trim()));
  const raw = join(profile, 'window.png');
  sh('screencapture', ['-x', '-R', `${x},${y},${right - x},${bottom - y}`, raw]);

  // The store takes 1280x800 exactly. Scale the photographed window rather
  // than recomposing it, so what ships is the window that was captured.
  sh('sips', ['-z', '800', '1280', raw, '--out', outFile]);
  console.log(`DONE → ${outFile} (one real window, panel docked)`);

  await browser.close().catch(() => {});
} finally {
  stop();
}
