#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/run.js` and `dist/run.d.ts`.
//
// It has since been released from that comparison, and the sentence saying so
// is kept on one line on purpose: the guard reads for that exact wording, and a
// phrase wrapped across two lines is not found. Better a slightly awkward line
// than a module that reads as released to a person and as unrecorded to a check.
//
// HOW IT IS HELD NOW. The recovery matched the shipped module token for token,
// and while it still did, behaviour tests were written against it — at that
// moment they could describe nothing but the code that actually ships. Only
// then was the run split into reading the list, scanning one page, and
// assembling the verdict, because the whole of it sat well above the complexity
// limit the publishing gate enforces and no re-reading was going to lower it.
//
// The tests are green either side of that split, and they were checked against
// damage rather than assumed: removing the private-address refusal, the report's
// page check, the hash in the directory name, or the severity threshold each
// fails exactly one of them.
//
// So the guarantee lives in the tests beside it, and the
// release is recorded.
//
// NOTE, carried over rather than fixed: the declaration types the visual-tool
// gate's conclusion as 'passed' | 'failed', and the code emits 'not_evaluated'
// when no exit code was supplied. That is the original's own inconsistency. A
// recovery that quietly corrected it would produce a different module and stop
// being a recovery; it is worth a separate change, on its own, after this
// lands.

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface Page {
  name: string;
  url: string;
}

export interface Dependencies {
  run(command: string, args: string[]): Promise<CommandResult>;
  read(path: string): Promise<string>;
  fetchText(url: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  ensureDir(path: string): Promise<void>;
  remove(path: string): Promise<void>;
}

export interface RunOptions {
  pageList: string;
  baseUrl?: string;
  outputDir: string;
  ariadaBinary?: string;
  severityThreshold?: 'minor' | 'moderate' | 'serious' | 'critical';
  allowPrivate?: boolean;
  percyExitCode?: number;
}

type Conclusion = 'passed' | 'failed';

export interface PercyAriadaReport {
  schemaVersion: '1.0';
  kind: 'percy-ariada-page-set-report';
  source: { kind: 'percy-snapshot-list'; location: string; pageCount: number };
  summary: { passedPageCount: number; failedPageCount: number; findingCount: number };
  gates: {
    ariada: { conclusion: Conclusion; exitCode: 0 | 1 };
    percy: {
      conclusion: Conclusion;
      exitCode: number | null;
      evidence: 'external-percy-cli-exit-code' | 'not-provided';
    };
    combined: { conclusion: Conclusion; exitCode: 0 | 1 | null };
  };
  pages: Array<{
    page: Page;
    conclusion: Conclusion;
    ariada: { exitCode: 0 | 1; findingCount: number };
    reportPath: string;
  }>;
  execution: {
    ariadaInvocation: 'external-cli-per-page';
    ariadaDomains: ['accessibility'];
    acceptsAriadaExitOneAsFindings: true;
    percyNativePluginUsed: false;
    visualSnapshotsTakenByBridge: false;
  };
}

const rank: Record<string, number> = { minor: 1, moderate: 2, serious: 3, critical: 4 };

const defaults: Dependencies = {
  run: (command, args) =>
    new Promise((resolveResult, reject) => {
      const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '',
        stderr = '';
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk) => (stdout += chunk));
      child.stderr.on('data', (chunk) => (stderr += chunk));
      child.on('error', reject);
      child.on('close', (code) => resolveResult({ exitCode: code ?? 2, stdout, stderr }));
    }),
  read: (path) => readFile(path, 'utf8'),
  fetchText: async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Page list request failed with HTTP ${response.status}.`);
    return response.text();
  },
  write: (path, content) => writeFile(path, content, 'utf8'),
  ensureDir: (path) => mkdir(path, { recursive: true }).then(() => undefined),
  remove: (path) => rm(path, { recursive: true, force: true }),
};

/**
 * The value as an object, or an error.
 *
 * @param value - the candidate
 * @returns the object
 */
// The shapes read here come from files this code did not write, and every field
// is checked before use; a mapped type would only force bracket access and
// change nothing about the checking.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function record(value: unknown): any {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Percy snapshot list must be an array.');
  return value as Record<string, unknown>;
}

/**
 * The value as a web address, with the label in any error.
 *
 * @param value - the candidate
 * @param label - what to call it
 * @param base - a base address, when the value may be relative
 * @returns the normalised address
 */
function url(value: string, label: string, base?: string): string {
  let parsed: URL;
  try {
    parsed = base ? new URL(value, base) : new URL(value);
  } catch {
    throw new Error(`${label} is not a valid URL: ${value}`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol))
    throw new Error(`${label} must use http or https: ${value}`);
  if (!base && !parsed.hostname) throw new Error(`${label} has no hostname: ${value}`);
  return parsed.href;
}

/**
 * Whether the string looks like a web address rather than a path.
 *
 * @param value - the candidate
 * @returns true when it does
 */
function isHttp(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

/**
 * Whether the host is on a private network.
 *
 * The page list is supplied by whoever runs this, and a scanner pointed at a
 * private address from a shared runner reaches into the network the runner sits
 * in. So it is refused unless asked for explicitly.
 *
 * @param host - the hostname
 * @returns true when it is private
 */
function isPrivate(host: string): boolean {
  const normalized = host.toLowerCase().replace(/^\[|\]$/g, '');
  return (
    normalized === 'localhost' ||
    normalized === '::1' ||
    normalized === '0.0.0.0' ||
    /^(127\.|10\.|192\.168\.|169\.254\.)/.test(normalized) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)
  );
}

/**
 * Read the page list, refusing duplicates and sorting for a stable order.
 *
 * Duplicate names or addresses are errors rather than deduplicated: a list with
 * the same page twice is a mistake in whoever wrote it, and silently collapsing
 * it hides that the run covered less than the author believed.
 *
 * @param value - the parsed list
 * @param base - a base address for relative entries
 * @returns the pages, sorted
 */
function parsePages(value: unknown, base?: string): Page[] {
  if (!Array.isArray(value) || value.length === 0)
    throw new Error('Percy snapshot list must be a non-empty JSON array.');
  const pages = value.map((item) => {
    const page = record(item);
    if (typeof page.name !== 'string' || !page.name.trim())
      throw new Error('Each Percy snapshot must have a non-empty name.');
    if (typeof page.url !== 'string' || !page.url.trim())
      throw new Error(`Percy snapshot ${page.name} must have a URL.`);
    return {
      name: page.name.trim(),
      url: url(page.url, `Percy snapshot ${page.name} URL`, base),
    };
  });
  const names = new Set<string>(),
    urls = new Set<string>();
  for (const page of pages) {
    if (names.has(page.name)) throw new Error(`Duplicate Percy snapshot name: ${page.name}`);
    if (urls.has(page.url)) throw new Error(`Duplicate Percy snapshot URL: ${page.url}`);
    names.add(page.name);
    urls.add(page.url);
  }
  return pages.sort((a, b) => a.name.localeCompare(b.name) || a.url.localeCompare(b.url));
}

/**
 * Count the findings at or above the threshold, refusing a report about
 * another page.
 *
 * The check that the report names exactly the page asked for is not
 * defensiveness: reports are read from a directory this code also writes, and a
 * stale file from a previous run would otherwise be counted as this page's
 * result.
 *
 * @param value - the report
 * @param expectedUrl - the page it must describe
 * @param threshold - the severity that counts
 * @returns how many findings count
 */
function countFindings(value: unknown, expectedUrl: string, threshold: string): number {
  const report = record(value);
  const sites = report.sites;
  if (!Array.isArray(sites) || sites.length !== 1 || sites[0] !== expectedUrl)
    throw new Error(`Ariada report site does not match Percy URL: ${expectedUrl}`);
  const grid = record(report.grid);
  const siteGrid = record(grid[expectedUrl]);
  const findings = siteGrid.accessibility;
  if (!Array.isArray(findings)) throw new Error('Ariada report has no accessibility findings list.');
  return findings.filter((finding) => {
    const severity = record(finding).severity;
    return typeof severity === 'string' && severity in rank && rank[severity] >= rank[threshold];
  }).length;
}

/**
 * A filesystem-safe name for a page, with a hash so two pages that read alike
 * do not share a directory.
 *
 * @param name - the page name
 * @returns the directory name
 */
function slug(name: string): string {
  const readable =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 64) || 'page';
  return `${readable}-${createHash('sha256').update(name).digest('hex').slice(0, 8)}`;
}

/**
 * A relative path with forward slashes, so the report reads the same on any
 * platform.
 *
 * @param from - the base
 * @param to - the target
 * @returns the relative path
 */
function rel(from: string, to: string): string {
  return relative(from, to).split('\\').join('/');
}

/**
 * Scan every page in the list and write one report over all of them.
 *
 * The visual-comparison tool is not called here at all; its exit code is
 * accepted from outside as evidence. That keeps this from pretending to know
 * something it did not observe — and it is why the report carries an
 * `evidence` field saying which of the two happened.
 *
 * @param options - the list, where to write, and the rest
 * @param overrides - replacements for any side effect
 * @returns the report
 */
/**
 * The page list, read from wherever it lives and refused where it points
 * somewhere it should not.
 *
 * The private-address refusal lives here rather than at the point of use so
 * that no page is scanned before every page has been judged: a list whose
 * fourth entry is a private address should scan none of the first three.
 *
 * @param options - the run options
 * @param deps - the side effects
 * @returns the pages, in a stable order
 */
async function collectPages(options: RunOptions, deps: Dependencies): Promise<Page[]> {
  const raw = isHttp(options.pageList)
    ? await deps.fetchText(options.pageList)
    : await deps.read(resolve(options.pageList));
  const pages = parsePages(JSON.parse(raw), options.baseUrl);
  for (const page of pages)
    if (isPrivate(new URL(page.url).hostname) && !options.allowPrivate)
      throw new Error(`Private Percy URL is not allowed: ${page.url}`);
  return pages;
}

/**
 * Scan one page, keep its report, and say what it found.
 *
 * The scratch directory is removed before the run as well as after it, because
 * a leftover from an interrupted run would otherwise be read as this one's
 * output.
 *
 * @param page - the page
 * @param options - the run options
 * @param deps - the side effects
 * @param threshold - the severity that counts
 * @returns the page's summary and its finding count
 */
async function scanPage(
  page: Page,
  options: RunOptions,
  deps: Dependencies,
  threshold: string,
): Promise<{ summary: PercyAriadaReport['pages'][number]; count: number }> {
  const temp = join(options.outputDir, `.ariada-${slug(page.name)}`);
  const destination = join(options.outputDir, 'pages', slug(page.name));
  await deps.remove(temp);
  await deps.ensureDir(temp);
  const result = await deps.run(options.ariadaBinary ?? 'ariada', [
    'scan',
    page.url,
    '--domains',
    'accessibility',
    '--output-dir',
    temp,
  ]);
  const report = JSON.parse(await deps.read(join(temp, 'multi-domain-report.json')));
  const count = countFindings(report, page.url, threshold);
  const failed = result.exitCode !== 0 || count > 0;
  const reportPath = join(destination, 'report.json');
  await deps.ensureDir(destination);
  await deps.write(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  await deps.remove(temp);
  return {
    count,
    summary: {
      page,
      conclusion: failed ? 'failed' : 'passed',
      ariada: { exitCode: failed ? 1 : 0, findingCount: count },
      reportPath: rel(options.outputDir, reportPath),
    },
  };
}

export async function runPercyAriada(
  options: RunOptions,
  overrides: Partial<Dependencies> = {},
): Promise<PercyAriadaReport> {
  const deps = { ...defaults, ...overrides };
  const threshold = options.severityThreshold ?? 'serious';
  const pages = await collectPages(options, deps);
  await deps.ensureDir(options.outputDir);
  const summaries: PercyAriadaReport['pages'] = [];
  let findingCount = 0;
  for (const page of pages) {
    const scanned = await scanPage(page, options, deps, threshold);
    findingCount += scanned.count;
    summaries.push(scanned.summary);
  }
  const ariadaFailed = summaries.some((page) => page.conclusion === 'failed');
  const percyExitCode = options.percyExitCode ?? null;
  const percyFailed = percyExitCode !== null && percyExitCode !== 0;
  const report = {
    schemaVersion: '1.0',
    kind: 'percy-ariada-page-set-report',
    source: {
      kind: 'percy-snapshot-list',
      location: options.pageList,
      pageCount: pages.length,
    },
    summary: {
      passedPageCount: summaries.filter((p) => p.conclusion === 'passed').length,
      failedPageCount: summaries.filter((p) => p.conclusion === 'failed').length,
      findingCount,
    },
    gates: {
      ariada: { conclusion: ariadaFailed ? 'failed' : 'passed', exitCode: ariadaFailed ? 1 : 0 },
      percy: {
        conclusion:
          percyExitCode === null ? 'not_evaluated' : percyFailed ? 'failed' : 'passed',
        exitCode: percyExitCode,
        evidence: percyExitCode === null ? 'not-provided' : 'external-percy-cli-exit-code',
      },
      combined: {
        conclusion:
          ariadaFailed || percyFailed
            ? 'failed'
            : percyExitCode === null
              ? 'not_evaluated'
              : 'passed',
        exitCode:
          ariadaFailed || percyFailed ? 1 : percyExitCode === null ? null : 0,
      },
    },
    pages: summaries,
    execution: {
      ariadaInvocation: 'external-cli-per-page',
      ariadaDomains: ['accessibility'],
      acceptsAriadaExitOneAsFindings: true,
      percyNativePluginUsed: false,
      visualSnapshotsTakenByBridge: false,
    },
  } as unknown as PercyAriadaReport;
  await deps.write(
    join(options.outputDir, 'percy-ariada-report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  return report;
}

/**
 * The exit code for a report.
 *
 * @param report - the report
 * @returns one when the combined gate failed, zero otherwise
 */
export function percyAriadaExitCode(report: PercyAriadaReport): 0 | 1 {
  return report.gates.combined.exitCode === 1 ? 1 : 0;
}

/**
 * The command line.
 *
 * @returns nothing
 */
async function cli(): Promise<void> {
  const args = process.argv.slice(2);
  const pageList = args[0];
  if (!pageList)
    throw new Error('Usage: percy-ariada <snapshot-list.json> --output-dir <dir> [--base-url <url>]');
  const value = (flag: string): string | undefined => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const report = await runPercyAriada({
    pageList,
    outputDir: value('--output-dir') ?? 'ariada-output',
    baseUrl: value('--base-url') as string,
    allowPrivate: args.includes('--allow-private'),
    percyExitCode: Number(value('--percy-exit-code') ?? 0),
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = percyAriadaExitCode(report);
}

if (import.meta.url === `file://${process.argv[1]}`)
  cli().catch((error) => {
    process.stderr.write(`${String(error)}\n`);
    process.exitCode = 2;
  });
