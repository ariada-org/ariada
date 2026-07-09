// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// The public demo page (apps/ariada-org/src/pages/demo.astro) renders a
// MultiDomainReport fixture committed at apps/ariada-org/public/demo/. This
// test proves the committed fixture is the real, reproducible output of a
// local, offline scan over the project's own fixture pages -- not a
// hand-authored sample -- by running the same scan again and comparing.
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';

import type { MultiDomainReport } from '@ariada-org/core-engine';
import {
  discoverDomains,
  runMultiDomainScan as runCoreMultiDomainScan,
} from '@ariada-org/core-engine';
import { describe, it, expect } from 'vitest';

import { EXIT_OK } from '../src/exit-codes.js';
import { runMultiDomainScan } from '../src/subcommands/scan-multi-domain.js';

function devNull(): Writable {
  return new Writable({
    write(_chunk, _enc, cb) {
      cb();
    },
  });
}

const DEMO_DOMAINS = ['accessibility', 'sustainability', 'privacy'];

const DEMO_FIXTURE_URL = new URL(
  '../../../apps/ariada-org/public/demo/multi-domain-report.json',
  import.meta.url,
);

describe('website demo fixture — real, reproducible scan', () => {
  it('is byte-identical to a fresh offline scan over the committed local fixtures', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ariada-demo-fixture-check-'));
    try {
      const fixtures = [
        new URL('../../ariada-test-fixtures/fixtures/cross-site-failing.html', import.meta.url)
          .href,
        new URL('../../ariada-test-fixtures/fixtures/cross-site-passing.html', import.meta.url)
          .href,
      ];

      const code = await runMultiDomainScan(
        fixtures,
        {
          domains: DEMO_DOMAINS,
          format: 'json',
          outputDir: dir,
          severityThreshold: 'critical',
        },
        devNull(),
        devNull(),
        {
          discover: () => Promise.resolve(discoverDomains({})),
          scan: (input) => runCoreMultiDomainScan(input),
        },
      );
      expect(code).toBe(EXIT_OK);

      const fresh = JSON.parse(
        await readFile(join(dir, 'multi-domain-report.json'), 'utf8'),
      ) as MultiDomainReport;
      const committed = JSON.parse(
        await readFile(DEMO_FIXTURE_URL, 'utf8'),
      ) as MultiDomainReport;

      // The committed website fixture must be exactly what a fresh run
      // produces -- proof it is real and reproducible, not hand-authored.
      expect(fresh).toEqual(committed);

      // Phase C definition-of-done shape, asserted explicitly so a future
      // fixture change that breaks the demo story fails loudly here.
      expect(fresh.sites).toHaveLength(2);
      expect(fresh.domains).toEqual(['accessibility', 'privacy', 'sustainability']);
      for (const site of fresh.sites) {
        for (const domain of fresh.domains) {
          expect(Array.isArray(fresh.grid[site]?.[domain])).toBe(true);
        }
      }
      expect(fresh.crossSite.divergence.length).toBeGreaterThanOrEqual(1);
      expect(fresh.interactions.length).toBeGreaterThanOrEqual(1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('runs a second offline scan producing the identical report (determinism)', async () => {
    const dirA = await mkdtemp(join(tmpdir(), 'ariada-demo-fixture-det-a-'));
    const dirB = await mkdtemp(join(tmpdir(), 'ariada-demo-fixture-det-b-'));
    try {
      const fixtures = [
        new URL('../../ariada-test-fixtures/fixtures/cross-site-failing.html', import.meta.url)
          .href,
        new URL('../../ariada-test-fixtures/fixtures/cross-site-passing.html', import.meta.url)
          .href,
      ];
      const runOnce = async (outputDir: string): Promise<unknown> => {
        await runMultiDomainScan(
          fixtures,
          {
            domains: DEMO_DOMAINS,
            format: 'json',
            outputDir,
            severityThreshold: 'critical',
          },
          devNull(),
          devNull(),
          {
            discover: () => Promise.resolve(discoverDomains({})),
            scan: (input) => runCoreMultiDomainScan(input),
          },
        );
        return JSON.parse(await readFile(join(outputDir, 'multi-domain-report.json'), 'utf8'));
      };
      const [a, b] = await Promise.all([runOnce(dirA), runOnce(dirB)]);
      expect(a).toEqual(b);
    } finally {
      await rm(dirA, { recursive: true, force: true });
      await rm(dirB, { recursive: true, force: true });
    }
  });
});
