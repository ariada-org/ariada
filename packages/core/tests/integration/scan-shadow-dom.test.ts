import { startFixtureServer, type FixtureServer } from '@ariada-org/test-fixtures';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { scan } from '../../src/index.js';

let fx: FixtureServer;

beforeAll(async () => {
  fx = await startFixtureServer();
});

afterAll(async () => {
  await fx?.stop();
});

describe('scan() — shadow DOM transparency', () => {
  it('detects violations inside an open shadow root', async () => {
    const { report } = await scan(`${fx.url}/shadow-dom.html`, {
      playwright: { browser: 'chromium', headless: true },
    });
    const findings = report.findings['a11y'] ?? [];
    expect(findings.length).toBeGreaterThan(0);
  }, 60_000);
});
