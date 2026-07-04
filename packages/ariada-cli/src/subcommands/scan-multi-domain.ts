// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

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

import { renderMultiDomainReportHtml } from './render-multi-domain-report-html.js';
import { renderMultiDomainReport } from './render-multi-domain-report.js';

/**
 *
 */
export interface MultiDomainScanOptions {
  domains?: string[];
  config?: string;
  outputDir?: string;
  outputFile?: string;
  format?: 'human' | 'json' | 'both' | 'html';
  browser?: 'chromium' | 'firefox' | 'webkit';
  timeoutMs?: number;
  /** Minimum severity that makes the scan exit non-zero. Defaults to `moderate`. */
  severityThreshold?: 'minor' | 'moderate' | 'serious' | 'critical';
  /**
   * Allow scanning loopback/private/link-local destinations. Off by default so
   * a URL argument cannot reach cloud metadata or internal services; enable
   * with `--allow-private` for local development.
   */
  allowPrivate?: boolean;
}

const SEVERITY_RANK: Record<string, number> = {
  minor: 1,
  moderate: 2,
  serious: 3,
  critical: 4,
};

/** A captured snapshot plus the discovered domains, ready to scan. */
type CaptureFn = (
  url: string,
  opts: { browser: string; timeoutMs: number; allowPrivate: boolean },
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
  if (format !== 'human' && format !== 'json' && format !== 'both' && format !== 'html') {
    emitError(
      new CliError('E_INVALID_OPTION', `Unknown --format: ${format}`, {
        allowed: ['human', 'json', 'both', 'html'],
      }),
      stderr,
    );
    return EXIT_INVALID_ARGS;
  }

  const threshold = options.severityThreshold ?? 'moderate';
  if (!(threshold in SEVERITY_RANK)) {
    emitError(
      new CliError('E_INVALID_OPTION', `Unknown --severity-threshold: ${threshold}`, {
        allowed: Object.keys(SEVERITY_RANK),
      }),
      stderr,
    );
    return EXIT_INVALID_ARGS;
  }

  const browser = options.browser ?? 'chromium';
  const timeoutMs = options.timeoutMs ?? 30_000;
  const allowPrivate = options.allowPrivate === true;

  const capture = injected?.capture ?? defaultCapture;
  const discover = injected?.discover ?? defaultDiscover;
  const scan = injected?.scan ?? defaultScan;

  let report: MultiDomainReport;
  try {
    const snapshots: PropertySnapshot[] = [];
    for (const url of urls) {
      const unified = await capture(url, { browser, timeoutMs, allowPrivate });
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
  if (format === 'html') {
    const written = await writeHtml(report, options, stderr);
    if (written === undefined) return EXIT_RUNTIME_ERROR;
    stdout.write(`Wrote ${written}\n`);
  }

  return hasFindingsAtOrAbove(report, threshold) ? EXIT_VIOLATIONS : EXIT_OK;
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
    // Carry the full capture: the rendered HTML the document-level rules read,
    // the cookies and network log the privacy/security domains read, and the
    // rule-library findings the accessibility domain merges in.
    html: unified.html ?? '',
    headers: unified.headers ?? {},
    cookies: unified.cookies ?? [],
    networkResources: unified.networkResources,
    axTree: unified.axTree,
    domOutline: unified.domOutline,
    perfMetrics: unified.perfMetrics,
    timings: unified.timings,
    ...(unified.axeFindings ? { axeFindings: unified.axeFindings } : {}),
  };
}

function hasFindingsAtOrAbove(report: MultiDomainReport, threshold: string): boolean {
  const minRank = SEVERITY_RANK[threshold] ?? SEVERITY_RANK['moderate'] ?? 2;
  for (const site of report.sites) {
    for (const domain of report.domains) {
      for (const finding of report.grid[site]?.[domain] ?? []) {
        const rank = SEVERITY_RANK[finding.severity] ?? 2;
        if (rank >= minRank) return true;
      }
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

async function writeHtml(
  report: MultiDomainReport,
  options: MultiDomainScanOptions,
  stderr: NodeJS.WritableStream,
): Promise<string | undefined> {
  const dest = resolvePath(options.outputFile ?? resolvePath(options.outputDir ?? './ariada-output', 'multi-domain-report.html'));
  try {
    await mkdir(resolvePath(dest, '..'), { recursive: true });
    await writeFile(dest, renderMultiDomainReportHtml(report), 'utf8');
    return dest;
  } catch (err) {
    emitError(
      new CliError('E_OUTPUT_WRITE', err instanceof Error ? err.message : String(err), {
        outputFile: dest,
      }),
      stderr,
    );
    return undefined;
  }
}

const defaultCapture: CaptureFn = async (url, opts) => {
  if (url.startsWith('file:')) return captureLocalFixture(url);
  const playwright = (await import('@ariada-org/core-playwright')) as {
    capture: (u: string, o: Record<string, unknown>) => Promise<UnifiedSnapshot>;
  };
  return playwright.capture(url, {
    timeoutMs: opts.timeoutMs,
    playwright: { browser: opts.browser, headless: true },
    ...(opts.allowPrivate ? { allowPrivate: true } : {}),
  });
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

async function captureLocalFixture(fileUrl: string): Promise<UnifiedSnapshot> {
  const path = fileURLToPath(fileUrl);
  const html = await readFile(path, 'utf8');
  const label = basename(path);
  return {
    scanId: `fixture-${label.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()}`,
    url: `fixture:${label}`,
    timestamp: 0,
    html,
    headers: {},
    cookies: [],
    networkResources: [],
    axTree: [],
    domOutline: extractDomOutline(html),
    perfMetrics: {},
    timings: { navigationMs: 0, axTreeMs: 0, domMs: 0, totalMs: 0 },
  };
}

function extractDomOutline(html: string): NonNullable<UnifiedSnapshot['domOutline']> {
  const out: NonNullable<UnifiedSnapshot['domOutline']> = [];
  const tagRe = /<(h[1-6]|a|button|img|input|select|textarea|p|li|label|script)\b([^>]*)>/gi;
  const counts = new Map<string, number>();
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(html))) {
    const tag = String(match[1]).toLowerCase();
    const rawAttrs = String(match[2] ?? '');
    const attrs = parseAttributes(rawAttrs);
    const count = (counts.get(tag) ?? 0) + 1;
    counts.set(tag, count);
    const id = attrs['id'];
    const cls = attrs['class']?.split(/\s+/).filter(Boolean)[0];
    const selector = id ? `${tag}#${id}` : cls ? `${tag}.${cls}` : `${tag}:nth-of-type(${count})`;
    out.push({
      backendNodeId: out.length + 1,
      nodeName: tag,
      selector,
      ...(Object.keys(attrs).length > 0 ? { attributes: attrs } : {}),
    });
  }
  return out;
}

function parseAttributes(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match: RegExpExecArray | null;
  while ((match = attrRe.exec(raw))) {
    const name = String(match[1]).toLowerCase();
    attrs[name] = String(match[2] ?? match[3] ?? match[4] ?? '');
  }
  return attrs;
}

function isValidUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'file:';
  } catch {
    return false;
  }
}
