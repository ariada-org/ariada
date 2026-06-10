// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve as resolvePath } from 'node:path';

import type {
  DomainModule,
  MultiDomainReport,
  PropertySnapshot,
  UnifiedSnapshot,
} from '@ariada-org/core-engine';

import { CliError, emitError } from '../errors.js';
import {
  EXIT_OK,
  EXIT_VIOLATIONS,
  EXIT_INVALID_ARGS,
  EXIT_RUNTIME_ERROR,
  type ExitCode,
} from '../exit-codes.js';

import { renderMultiDomainReport } from './render-multi-domain-report.js';

/**
 *
 */
export interface MultiDomainScanOptions {
  domains?: string[];
  config?: string;
  outputDir?: string;
  format?: 'human' | 'json' | 'both';
  browser?: 'chromium' | 'firefox' | 'webkit';
  timeoutMs?: number;
}

/** A captured snapshot plus the discovered domains, ready to scan. */
type CaptureFn = (
  url: string,
  opts: { browser: string; timeoutMs: number },
) => Promise<UnifiedSnapshot>;

type DiscoverFn = (opts: { modules?: readonly DomainModule[] }) => Promise<DomainModule[]>;

type ScanFn = (input: {
  snapshots: readonly PropertySnapshot[];
  domains: readonly DomainModule[];
}) => Promise<MultiDomainReport>;

/**
 * Run a multi-site, multi-domain scan: capture each URL once, run every selected
 * domain over the shared single pass, and render the combined report — the grid of
 * findings per site and domain, the cross-domain interactions, and where sites
 * diverge. Returns 0 (no findings), 1 (findings present), 2 (bad arguments), or 3
 * (a capture or runtime failure).
 *
 * The capture, discovery and scan functions are injected for testability; the
 * default implementations lazy-load the browser and engine so argument-validation
 * paths never start a browser.
 */
export async function runMultiDomainScan(
  urls: readonly string[],
  options: MultiDomainScanOptions,
  stdout: NodeJS.WritableStream = process.stdout,
  stderr: NodeJS.WritableStream = process.stderr,
  injected?: { capture?: CaptureFn; discover?: DiscoverFn; scan?: ScanFn },
): Promise<ExitCode> {
  if (urls.length === 0) {
    emitError(new CliError('E_INVALID_OPTION', 'Provide at least one <url> to scan'), stderr);
    return EXIT_INVALID_ARGS;
  }
  for (const url of urls) {
    if (!isValidUrl(url)) {
      emitError(
        new CliError('E_INVALID_URL', `Argument is not a parseable http(s) URL: ${url}`, { url }),
        stderr,
      );
      return EXIT_INVALID_ARGS;
    }
  }

  const format = options.format ?? 'human';
  if (format !== 'human' && format !== 'json' && format !== 'both') {
    emitError(
      new CliError('E_INVALID_OPTION', `Unknown --format: ${format}`, {
        allowed: ['human', 'json', 'both'],
      }),
      stderr,
    );
    return EXIT_INVALID_ARGS;
  }

  const browser = options.browser ?? 'chromium';
  const timeoutMs = options.timeoutMs ?? 30_000;

  const capture = injected?.capture ?? defaultCapture;
  const discover = injected?.discover ?? defaultDiscover;
  const scan = injected?.scan ?? defaultScan;

  let report: MultiDomainReport;
  try {
    const snapshots: PropertySnapshot[] = [];
    for (const url of urls) {
      const unified = await capture(url, { browser, timeoutMs });
      snapshots.push(toPropertySnapshot(unified));
    }
    const domains = await selectDomains(discover, options.domains);
    if (domains.length === 0) {
      emitError(
        new CliError('E_INVALID_OPTION', 'No domains selected or discovered to scan with'),
        stderr,
      );
      return EXIT_INVALID_ARGS;
    }
    report = await scan({ snapshots, domains });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = /timeout/i.test(message) ? 'E_NAVIGATION_TIMEOUT' : 'E_NAVIGATION_FAILED';
    emitError(new CliError(code, message), stderr);
    return EXIT_RUNTIME_ERROR;
  }

  if (format === 'human' || format === 'both') {
    stdout.write(renderMultiDomainReport(report));
  }
  if (format === 'json' || format === 'both') {
    const written = await writeJson(report, options.outputDir, stderr);
    if (written === undefined) return EXIT_RUNTIME_ERROR;
    if (format === 'json') stdout.write(`Wrote ${written}\n`);
  }

  return hasFindings(report) ? EXIT_VIOLATIONS : EXIT_OK;
}

/** Keep only the domains the user asked for, or all discovered when none given. */
async function selectDomains(
  discover: DiscoverFn,
  requested: readonly string[] | undefined,
): Promise<DomainModule[]> {
  const all = await discover({});
  if (!requested || requested.length === 0) return all;
  const wanted = new Set(requested);
  return all.filter((d) => wanted.has(d.id));
}

/** Project the captured snapshot onto the multi-domain `PropertySnapshot` shape. */
function toPropertySnapshot(unified: UnifiedSnapshot): PropertySnapshot {
  return {
    scanId: unified.scanId,
    url: unified.url,
    timestamp: unified.timestamp,
    // html/headers/cookies enrichment lands with later capture work; the
    // accessibility and sustainability demo read the element outline + attributes.
    html: '',
    headers: {},
    cookies: [],
    networkResources: unified.networkResources,
    axTree: unified.axTree,
    domOutline: unified.domOutline,
    perfMetrics: unified.perfMetrics,
    timings: unified.timings,
  };
}

function hasFindings(report: MultiDomainReport): boolean {
  for (const site of report.sites) {
    for (const domain of report.domains) {
      if ((report.grid[site]?.[domain]?.length ?? 0) > 0) return true;
    }
  }
  return false;
}

async function writeJson(
  report: MultiDomainReport,
  outputDir: string | undefined,
  stderr: NodeJS.WritableStream,
): Promise<string | undefined> {
  const dir = resolvePath(outputDir ?? './ariada-output');
  try {
    await mkdir(dir, { recursive: true });
    const dest = resolvePath(dir, 'multi-domain-report.json');
    await writeFile(dest, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    return dest;
  } catch (err) {
    emitError(
      new CliError('E_OUTPUT_WRITE', err instanceof Error ? err.message : String(err), {
        outputDir: dir,
      }),
      stderr,
    );
    return undefined;
  }
}

const defaultCapture: CaptureFn = async (url, opts) => {
  const playwright = (await import('@ariada-org/core-playwright')) as {
    scan: (u: string, o: Record<string, unknown>) => Promise<{ report: { snapshot: UnifiedSnapshot } }>;
  };
  const result = await playwright.scan(url, {
    timeoutMs: opts.timeoutMs,
    playwright: { browser: opts.browser, headless: true },
  });
  return result.report.snapshot;
};

const defaultDiscover: DiscoverFn = async (opts) => {
  const multiDomain = (await import('@ariada-org/multi-domain/discovery')) as {
    discoverDomains: DiscoverFn;
  };
  return multiDomain.discoverDomains(opts);
};

const defaultScan: ScanFn = async (input) => {
  const engine = (await import('@ariada-org/core-engine')) as { runMultiDomainScan: ScanFn };
  return engine.runMultiDomainScan(input);
};

function isValidUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}
