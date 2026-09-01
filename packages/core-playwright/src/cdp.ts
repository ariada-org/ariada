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

/** What to say when there is no browser to run.
 *
 *  Playwright's own message is a box telling the reader to download ninety-five
 *  megabytes, which for someone trying a tool once is the moment they stop.
 *  Most machines already have a browser; the cheaper answer goes first. */
export function missingBrowserAdvice(error: Error, platform: string = process.platform): string {
  const text = String(error?.message ?? '');
  if (!/Executable doesn't exist|browserType\.launch/i.test(text)) return text;

  // Written for the shell the reader is actually in. A line of POSIX shell is
  // noise on a Windows prompt, and Windows has the easiest answer of the three
  // — Edge is already installed on every machine.
  const use =
    platform === 'win32'
      ? [
          'Windows always has Edge, so nothing needs downloading:',
          '  set ARIADA_CHROME_CHANNEL=msedge && npx ariada check',
          'in PowerShell:',
          '  $env:ARIADA_CHROME_CHANNEL="msedge"; npx ariada check',
        ]
      : platform === 'darwin'
        ? [
            'If Chrome is installed, use it — nothing to download:',
            '  ARIADA_CHROME_CHANNEL=chrome npx ariada check',
            'or name any browser you have:',
            '  ARIADA_BROWSER_PATH=/Applications/Chromium.app/Contents/MacOS/Chromium npx ariada check',
          ]
        : [
            'If one is already installed, point at it — nothing to download:',
            '  ARIADA_BROWSER_PATH=$(command -v chromium || command -v google-chrome) npx ariada check',
            'or name a product Playwright knows:',
            '  ARIADA_CHROME_CHANNEL=chrome npx ariada check',
          ];

  return [
    'No browser to run the page in.',
    '',
    ...use,
    '',
    'Otherwise fetch one:  npx playwright install chromium',
    '',
    'A browser is needed because a page is checked as a visitor sees it. Pages',
    'that build themselves in the browser have contents no file contains — on',
    'one site measured, every image was in place in the HTML and fifty-nine of',
    'the images a visitor actually gets had no alternative text.',
  ].join('\n');
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
  let browser;
  try {
    browser = await launcher.launch({
      headless,
      ...browserLaunchOptions(browserName, process.env),
    });
  } catch (error) {
    throw new Error(missingBrowserAdvice(error as Error), { cause: error });
  }
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
