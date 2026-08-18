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

/** Which already-installed browser to use, if the machine has one.
 *
 *  Two ways, because they cover different machines: a channel names a product
 *  Playwright knows how to find (`chrome`, `msedge`), and a path names the
 *  binary outright, which is what a Linux distribution's `chromium` package
 *  needs — it installs to a path no channel refers to. The path wins when both
 *  are set, being the more specific answer. Without either, Playwright uses the
 *  browser it downloads for itself.
 *
 *  This is what makes the ninety-five megabyte download optional rather than a
 *  condition of trying the tool at all. */
export function browserLaunchOptions(
  browserName: string,
  env: Record<string, string | undefined>,
): { channel?: string; executablePath?: string } {
  const executablePath = env['ARIADA_BROWSER_PATH'] || undefined;
  if (executablePath) return { executablePath };

  const channel = browserName === 'chromium' ? env['ARIADA_CHROME_CHANNEL'] || undefined : undefined;
  return channel ? { channel } : {};
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

  // Use a browser that is already on the machine rather than downloading
  // another ninety-five megabytes of the same engine. Two ways, because they
  // cover different machines: a channel names a product Playwright knows how to
  // find (`chrome`, `msedge`), and a path names the binary outright, which is
  // what a Linux distribution's `chromium` package needs — it installs to a
  // path no channel refers to.
  const browser = await launcher.launch({
    headless,
    ...browserLaunchOptions(browserName, process.env),
  });
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
