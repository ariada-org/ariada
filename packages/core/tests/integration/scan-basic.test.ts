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

describe('scan() basic flow', () => {
  it('returns a UnifiedReport shape against color-contrast fixture', async () => {
    const { report } = await scan(`${fx.url}/color-contrast.html`, {
      playwright: { browser: 'chromium', headless: true },
    });

    expect(report.scanId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(report.url).toContain('/color-contrast.html');
    expect(report.stats.analyzersRun).toContain('a11y');
    expect(Array.isArray(report.findings['a11y'])).toBe(true);
    expect(report.findings['a11y']!.length).toBeGreaterThan(0);
    expect(report.findings['a11y']!.some((f) => f.ruleId === 'color-contrast')).toBe(true);
  }, 60_000);

  it('basic-pass fixture has no critical a11y violations', async () => {
    const { report } = await scan(`${fx.url}/basic-pass.html`, {
      playwright: { browser: 'chromium', headless: true },
    });
    const critical = (report.findings['a11y'] ?? []).filter((f) => f.severity === 'critical');
    expect(critical).toHaveLength(0);
  }, 60_000);
});
