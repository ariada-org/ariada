// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from 'vitest';

import { browserLaunchOptions } from '../src/cdp.js';

describe('choosing which browser to run', () => {
  it('downloads nothing extra when neither is set', () => {
    expect(browserLaunchOptions('chromium', {})).toEqual({});
  });

  it('takes a named product where Playwright knows how to find it', () => {
    expect(browserLaunchOptions('chromium', { ARIADA_CHROME_CHANNEL: 'chrome' })).toEqual({
      channel: 'chrome',
    });
  });

  it('takes a path outright, which is what a distribution package needs', () => {
    // Debian installs chromium at a path no Playwright channel refers to, so a
    // channel alone leaves a container asking for the bundled download.
    expect(browserLaunchOptions('chromium', { ARIADA_BROWSER_PATH: '/usr/bin/chromium' })).toEqual({
      executablePath: '/usr/bin/chromium',
    });
  });

  it('lets the path win, since it is the more specific answer', () => {
    expect(
      browserLaunchOptions('chromium', {
        ARIADA_CHROME_CHANNEL: 'chrome',
        ARIADA_BROWSER_PATH: '/usr/bin/chromium',
      }),
    ).toEqual({ executablePath: '/usr/bin/chromium' });
  });

  it('does not offer a chromium channel to firefox, which has none', () => {
    expect(browserLaunchOptions('firefox', { ARIADA_CHROME_CHANNEL: 'chrome' })).toEqual({});
    expect(browserLaunchOptions('firefox', { ARIADA_BROWSER_PATH: '/usr/bin/firefox' })).toEqual({
      executablePath: '/usr/bin/firefox',
    });
  });
});

describe('when there is no browser', () => {
  it('offers the browser already on the machine before the download', async () => {
    const { missingBrowserAdvice } = await import('../src/cdp.js');
    const advice = missingBrowserAdvice(
      new Error("browserType.launch: Executable doesn't exist at /root/.cache/ms-playwright/chromium-1234/chrome"),
    );
    expect(advice.indexOf('ARIADA_BROWSER_PATH')).toBeLessThan(advice.indexOf('playwright install'));
    expect(advice).toContain('nothing to download');
  });

  it('says why a browser is needed at all, since that is the question asked', async () => {
    const { missingBrowserAdvice } = await import('../src/cdp.js');
    expect(missingBrowserAdvice(new Error("Executable doesn't exist"))).toMatch(/as a visitor sees it/);
  });

  it('leaves an unrelated failure alone rather than misdiagnosing it', async () => {
    const { missingBrowserAdvice } = await import('../src/cdp.js');
    expect(missingBrowserAdvice(new Error('net::ERR_CONNECTION_REFUSED'))).toBe('net::ERR_CONNECTION_REFUSED');
  });
});

describe('advice for the machine the reader is on', () => {
  const failure = new Error("browserType.launch: Executable doesn't exist at /cache/chromium/chrome");

  it('offers Edge on Windows, which is always there', async () => {
    const { missingBrowserAdvice } = await import('../src/cdp.js');
    const advice = missingBrowserAdvice(failure, 'win32');
    expect(advice).toContain('msedge');
    expect(advice).toContain('$env:');
    expect(advice).not.toContain('command -v');
  });

  it('offers Chrome on macOS and does not talk about apt paths', async () => {
    const { missingBrowserAdvice } = await import('../src/cdp.js');
    const advice = missingBrowserAdvice(failure, 'darwin');
    expect(advice).toContain('/Applications/');
    expect(advice).not.toContain('msedge');
  });

  it('offers what a distribution installs on Linux', async () => {
    const { missingBrowserAdvice } = await import('../src/cdp.js');
    const advice = missingBrowserAdvice(failure, 'linux');
    expect(advice).toContain('command -v chromium');
  });

  it('puts the download last on every platform', async () => {
    const { missingBrowserAdvice } = await import('../src/cdp.js');
    for (const platform of ['win32', 'darwin', 'linux']) {
      const advice = missingBrowserAdvice(failure, platform);
      expect(advice.indexOf('playwright install')).toBeGreaterThan(advice.indexOf('nothing'));
    }
  });
});
