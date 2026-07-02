// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { Writable } from 'node:stream';

import type {
  DomainModule,
  MultiDomainReport,
  PropertySnapshot,
  UnifiedSnapshot,
} from '@ariada-org/core-engine';
import { describe, it, expect } from 'vitest';

import { EXIT_OK, EXIT_VIOLATIONS, EXIT_INVALID_ARGS } from '../src/exit-codes.js';
import { runMultiDomainScan } from '../src/subcommands/scan-multi-domain.js';

function buffers(): {
  stdout: Writable;
  stderr: Writable;
  out: () => string;
  err: () => string;
} {
  const outChunks: Buffer[] = [];
  const errChunks: Buffer[] = [];
  return {
    stdout: new Writable({
      write(chunk: Buffer, _enc, cb) {
        outChunks.push(chunk);
        cb();
      },
    }),
    stderr: new Writable({
      write(chunk: Buffer, _enc, cb) {
        errChunks.push(chunk);
        cb();
      },
    }),
    out: () => Buffer.concat(outChunks).toString('utf8'),
    err: () => Buffer.concat(errChunks).toString('utf8'),
  };
}

function makeUnified(url: string): UnifiedSnapshot {
  return {
    scanId: `scan-${url}`,
    url,
    timestamp: 0,
    axTree: [],
    domOutline: [{ backendNodeId: 1, nodeName: 'img', selector: 'img.hero' }],
    perfMetrics: {},
    networkResources: [],
    timings: { navigationMs: 0, axTreeMs: 0, domMs: 0, totalMs: 0 },
  };
}

const oneDomain: DomainModule = {
  id: 'accessibility',
  title: 'Accessibility',
  version: '0',
  extractors: {},
  evaluate: () => [],
};

/** A scan stub that flags the first site and passes the second. */
function divergingScan(input: {
  snapshots: readonly PropertySnapshot[];
  domains: readonly DomainModule[];
}): Promise<MultiDomainReport> {
  const [a, b] = input.snapshots;
  const finding = {
    id: 'image-alt-img.hero',
    scanId: a?.scanId ?? '',
    domain: 'accessibility' as const,
    ruleId: 'image-alt',
    severity: 'serious' as const,
    element: { selector: 'img.hero' },
    message: 'Image is missing alternative text',
  };
  return Promise.resolve({
    sites: [a?.url ?? '', b?.url ?? ''],
    domains: ['accessibility'],
    grid: {
      [a?.url ?? '']: { accessibility: [finding] },
      [b?.url ?? '']: { accessibility: [] },
    },
    interactions: [],
    crossSite: {
      systemic: [],
      divergence: [
        {
          domain: 'accessibility',
          ruleId: 'image-alt',
          failingSites: [a?.url ?? ''],
          passingSites: [b?.url ?? ''],
        },
      ],
    },
  });
}

const stubs = {
  capture: (url: string): Promise<UnifiedSnapshot> => Promise.resolve(makeUnified(url)),
  discover: (): Promise<DomainModule[]> => Promise.resolve([oneDomain]),
  scan: divergingScan,
};

describe('runMultiDomainScan — argument validation', () => {
  it('rejects an empty URL list', async () => {
    const b = buffers();
    const code = await runMultiDomainScan([], { domains: ['accessibility'] }, b.stdout, b.stderr);
    expect(code).toBe(EXIT_INVALID_ARGS);
  });

  it('rejects a non-http(s) URL', async () => {
    const b = buffers();
    const code = await runMultiDomainScan(
      ['ftp://x/'],
      { domains: ['accessibility'] },
      b.stdout,
      b.stderr,
    );
    expect(code).toBe(EXIT_INVALID_ARGS);
  });

  it('rejects an unknown --format', async () => {
    const b = buffers();
    const code = await runMultiDomainScan(
      ['http://a.local/'],
      { domains: ['accessibility'], format: 'xml' as unknown as 'human' },
      b.stdout,
      b.stderr,
    );
    expect(code).toBe(EXIT_INVALID_ARGS);
  });
});

describe('runMultiDomainScan — rendering', () => {
  it('renders the grid and the divergence, exiting with violations', async () => {
    const b = buffers();
    const code = await runMultiDomainScan(
      ['http://brand.com/', 'http://brand.de/'],
      { domains: ['accessibility'], format: 'human' },
      b.stdout,
      b.stderr,
      stubs,
    );
    expect(code).toBe(EXIT_VIOLATIONS);
    const out = b.out();
    expect(out).toContain('ariada multi-domain scan');
    expect(out).toContain('http://brand.com/');
    expect(out).toContain('1 found');
    expect(out).toContain('pass');
    expect(out).toContain('divergence');
  });

  it('exits OK when no site has findings', async () => {
    const b = buffers();
    const cleanScan = (): Promise<MultiDomainReport> =>
      Promise.resolve({
        sites: ['http://a.local/'],
        domains: ['accessibility'],
        grid: { 'http://a.local/': { accessibility: [] } },
        interactions: [],
        crossSite: { systemic: [], divergence: [] },
      });
    const code = await runMultiDomainScan(
      ['http://a.local/'],
      { domains: ['accessibility'], format: 'human' },
      b.stdout,
      b.stderr,
      { ...stubs, scan: cleanScan },
    );
    expect(code).toBe(EXIT_OK);
  });

  it('errors when no requested domain is discovered', async () => {
    const b = buffers();
    const code = await runMultiDomainScan(
      ['http://a.local/'],
      { domains: ['nonexistent'], format: 'human' },
      b.stdout,
      b.stderr,
      stubs,
    );
    expect(code).toBe(EXIT_INVALID_ARGS);
  });
});

describe('runMultiDomainScan — severity threshold', () => {
  it('rejects an unknown --severity-threshold before any capture', async () => {
    const b = buffers();
    let captured = false;
    const code = await runMultiDomainScan(
      ['http://a.local/'],
      { severityThreshold: 'bogus' as unknown as 'moderate', format: 'human' },
      b.stdout,
      b.stderr,
      {
        ...stubs,
        capture: (url): Promise<UnifiedSnapshot> => {
          captured = true;
          return Promise.resolve(makeUnified(url));
        },
      },
    );
    expect(code).toBe(EXIT_INVALID_ARGS);
    expect(captured).toBe(false);
    expect(b.err()).toMatch(/E_INVALID_OPTION/);
  });

  it('exits OK when the only finding is below the threshold', async () => {
    const b = buffers();
    const minorScan = (): Promise<MultiDomainReport> =>
      Promise.resolve({
        sites: ['http://a.local/'],
        domains: ['accessibility'],
        grid: {
          'http://a.local/': {
            accessibility: [
              {
                id: 'x',
                scanId: 's',
                domain: 'accessibility',
                ruleId: 'r',
                severity: 'minor',
                element: { selector: 'p' },
                message: 'm',
              },
            ],
          },
        },
        interactions: [],
        crossSite: { systemic: [], divergence: [] },
      });
    const code = await runMultiDomainScan(
      ['http://a.local/'],
      { severityThreshold: 'serious', format: 'human' },
      b.stdout,
      b.stderr,
      { ...stubs, scan: minorScan },
    );
    expect(code).toBe(EXIT_OK);
  });
});

describe('runMultiDomainScan — default domain selection', () => {
  it('runs every discovered domain when none are requested', async () => {
    const b = buffers();
    let scannedDomains: string[] = [];
    const discoverThree = (): Promise<DomainModule[]> =>
      Promise.resolve(
        ['accessibility', 'privacy', 'security'].map((id) => ({
          id,
          title: id,
          version: '0',
          extractors: {},
          evaluate: () => [],
        })),
      );
    const recordingScan = (input: {
      snapshots: readonly PropertySnapshot[];
      domains: readonly DomainModule[];
    }): Promise<MultiDomainReport> => {
      scannedDomains = input.domains.map((d) => d.id);
      return Promise.resolve({
        sites: input.snapshots.map((s) => s.url),
        domains: scannedDomains,
        grid: {},
        interactions: [],
        crossSite: { systemic: [], divergence: [] },
      });
    };
    const code = await runMultiDomainScan(
      ['http://a.local/'],
      { format: 'human' },
      b.stdout,
      b.stderr,
      { ...stubs, discover: discoverThree, scan: recordingScan },
    );
    expect(code).toBe(EXIT_OK);
    expect(scannedDomains).toEqual(['accessibility', 'privacy', 'security']);
  });
});

describe('runMultiDomainScan — allowPrivate threading', () => {
  it('defaults allowPrivate to false in the capture options', async () => {
    const b = buffers();
    let seen: { allowPrivate: boolean } | undefined;
    const recordingCapture = (
      url: string,
      opts: { browser: string; timeoutMs: number; allowPrivate: boolean },
    ): Promise<UnifiedSnapshot> => {
      seen = { allowPrivate: opts.allowPrivate };
      return Promise.resolve(makeUnified(url));
    };
    await runMultiDomainScan(
      ['http://a.local/'],
      { domains: ['accessibility'] },
      b.stdout,
      b.stderr,
      { ...stubs, capture: recordingCapture },
    );
    expect(seen?.allowPrivate).toBe(false);
  });

  it('passes allowPrivate=true through to the capture options when opted in', async () => {
    const b = buffers();
    let seen: { allowPrivate: boolean } | undefined;
    const recordingCapture = (
      url: string,
      opts: { browser: string; timeoutMs: number; allowPrivate: boolean },
    ): Promise<UnifiedSnapshot> => {
      seen = { allowPrivate: opts.allowPrivate };
      return Promise.resolve(makeUnified(url));
    };
    await runMultiDomainScan(
      ['http://a.local/'],
      { domains: ['accessibility'], allowPrivate: true },
      b.stdout,
      b.stderr,
      { ...stubs, capture: recordingCapture },
    );
    expect(seen?.allowPrivate).toBe(true);
  });
});
