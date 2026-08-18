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
