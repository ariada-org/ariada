// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import type { Browser, BrowserContext, CDPSession, Frame, Page } from 'playwright';

/**
 *
 */
export type BrowserName = 'chromium' | 'firefox' | 'webkit';

/**
 *
 */
export interface BrowserHandle {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  cdp: CDPSession | undefined;
  close(): Promise<void>;
}

/**
 *
 */
export async function launchBrowser(
  browserName: BrowserName,
  headless = true,
): Promise<BrowserHandle> {
  const playwright = await import('playwright');
  const launcher =
    browserName === 'firefox'
      ? playwright.firefox
      : browserName === 'webkit'
        ? playwright.webkit
        : playwright.chromium;

  // When the bundled Playwright browser isn't installed, allow falling back to a
  // system-installed browser channel (e.g. ARIADA_CHROME_CHANNEL=chrome) for
  // chromium runs — same engine, no separate download.
  const channel =
    browserName === 'chromium' ? process.env['ARIADA_CHROME_CHANNEL'] || undefined : undefined;
  const browser = await launcher.launch({ headless, ...(channel ? { channel } : {}) });
  const context = await browser.newContext();
  const page = await context.newPage();

  let cdp: CDPSession | undefined;
  if (browserName === 'chromium') {
    try {
      cdp = await context.newCDPSession(page);
    } catch {
      cdp = undefined;
    }
  }

  return {
    browser,
    context,
    page,
    cdp,
    async close(): Promise<void> {
      try {
        if (cdp) await cdp.detach().catch(() => undefined);
      } finally {
        await browser.close().catch(() => undefined);
      }
    },
  };
}

/**
 *
 */
export function listFrames(page: Page): Frame[] {
  return page.frames();
}
