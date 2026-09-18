// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve as resolvePath } from 'node:path';

import { CliError, emitError } from '../errors.js';
import {
  EXIT_OK,
  EXIT_VIOLATIONS,
  EXIT_INVALID_ARGS,
  EXIT_RUNTIME_ERROR,
  type ExitCode,
} from '../exit-codes.js';
import { proiskhozhdenie } from '../proiskhozhdenie.js';
import { scanFailureCode } from '../scan-failure-code.js';

/**
 *
 */
export interface ScanOptions {
  outputDir?: string;
  browser?: 'chromium' | 'firefox' | 'webkit';
  format?: 'human' | 'json' | 'both';
  severityThreshold?: 'minor' | 'moderate' | 'serious' | 'critical';
  timeoutMs?: number;
}

const SEVERITY_RANK: Record<string, number> = {
  minor: 1,
  moderate: 2,
  serious: 3,
  critical: 4,
};

function isValidUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

const BROWSERS = ['chromium', 'firefox', 'webkit'] as const;
const FORMATS = ['human', 'json', 'both'] as const;

/** Whether a flag carries one of the values the command accepts, saying so if not. */
function isOneOf(
  value: string,
  allowed: readonly string[],
  flag: string,
  stderr: NodeJS.WritableStream,
): boolean {
  if (allowed.includes(value)) return true;
  emitError(
    new CliError('E_INVALID_OPTION', `Unknown ${flag}: ${value}`, { allowed: [...allowed] }),
    stderr,
  );
  return false;
}

/** What the arguments mean once every one of them has been checked. */
interface CheckedScanArgs {
  url: string;
  threshold: string;
  browser: NonNullable<ScanOptions['browser']>;
  format: NonNullable<ScanOptions['format']>;
  outputDir: string;
  timeoutMs: number;
}

/**
 * Check every argument before anything is launched, reporting the first fault.
 *
 * The checked values and the exit code are returned as different answers,
 * because the caller has to be able to tell "here is what you asked for" from
 * "here is why I will not".
 */
function checkScanArgs(
  url: string | undefined,
  options: ScanOptions,
  stderr: NodeJS.WritableStream,
): { ok: true; args: CheckedScanArgs } | { ok: false; code: ExitCode } {
  if (!url || url.length === 0) {
    emitError(new CliError('E_INVALID_OPTION', 'Missing required argument: <url>'), stderr);
    return { ok: false, code: EXIT_INVALID_ARGS };
  }
  if (!isValidUrl(url)) {
    emitError(
      new CliError('E_INVALID_URL', `Argument is not a parseable http(s) URL: ${url}`, { url }),
      stderr,
    );
    return { ok: false, code: EXIT_INVALID_ARGS };
  }

  const threshold = options.severityThreshold ?? 'moderate';
  if (!(threshold in SEVERITY_RANK)) {
    emitError(
      new CliError('E_INVALID_OPTION', `Unknown --severity-threshold: ${threshold}`, {
        allowed: Object.keys(SEVERITY_RANK),
      }),
      stderr,
    );
    return { ok: false, code: EXIT_INVALID_ARGS };
  }

  const browser = options.browser ?? 'chromium';
  if (!isOneOf(browser, BROWSERS, '--browser', stderr)) {
    return { ok: false, code: EXIT_INVALID_ARGS };
  }

  const format = options.format ?? 'human';
  if (!isOneOf(format, FORMATS, '--format', stderr)) {
    return { ok: false, code: EXIT_INVALID_ARGS };
  }

  return {
    ok: true,
    args: {
      url,
      threshold,
      browser,
      format,
      outputDir: resolvePath(options.outputDir ?? './ariada-output'),
      timeoutMs: options.timeoutMs ?? 30_000,
    },
  };
}

/**
 * Write the machine-readable envelope beside the human output.
 *
 * Hands back the fault rather than exiting on it, so every exit code this
 * command can return is decided in one place.
 */
async function writeScanJson(
  outputDir: string,
  envelope: unknown,
  announcePath: boolean,
  stdout: NodeJS.WritableStream,
): Promise<Error | undefined> {
  try {
    await mkdir(outputDir, { recursive: true });
    const jsonPath = resolvePath(outputDir, 'scan.json');
    await writeFile(jsonPath, `${JSON.stringify(envelope, null, 2)}\n`, 'utf8');
    if (announcePath) stdout.write(`Wrote ${jsonPath}\n`);
    return undefined;
  } catch (err) {
    return err instanceof Error ? err : new Error(String(err));
  }
}

interface FindingLike {
  ruleId?: string;
  severity?: string;
  message?: string;
}

interface ReportLike {
  scanId?: string;
  url?: string;
  findings?: Record<string, FindingLike[]> | FindingLike[];
}

function flattenFindings(report: ReportLike): FindingLike[] {
  const f = report.findings;
  if (!f) return [];
  if (Array.isArray(f)) return f;
  return Object.values(f).flat();
}

function countByImpact(findings: FindingLike[]): Record<string, number> {
  const out: Record<string, number> = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const finding of findings) {
    const sev = finding.severity ?? 'moderate';
    if (sev in out) {
      const current = out[sev] ?? 0;
      out[sev] = current + 1;
    }
  }
  return out;
}

function shouldFail(findings: FindingLike[], threshold: string): boolean {
  const thresholdRank = SEVERITY_RANK[threshold] ?? SEVERITY_RANK['moderate'] ?? 2;
  for (const finding of findings) {
    const sev = finding.severity ?? 'moderate';
    const rank = SEVERITY_RANK[sev] ?? 2;
    if (rank >= thresholdRank) return true;
  }
  return false;
}

function formatHuman(
  url: string,
  findings: FindingLike[],
  counts: Record<string, number>,
  fail: boolean,
  durationMs: number,
): string {
  const total = findings.length;
  const status = fail ? `✗ ${total} violation${total === 1 ? '' : 's'}` : '✓ 0 violations';
  const breakdown = `${counts['critical'] ?? 0} critical · ${counts['serious'] ?? 0} serious · ${counts['moderate'] ?? 0} moderate · ${counts['minor'] ?? 0} minor`;
  const body = findings
    .slice(0, 25)
    .map((f) => `  • ${f.ruleId ?? 'unknown'} [${f.severity ?? '?'}] ${f.message ?? ''}`)
    .join('\n');
  const truncated = findings.length > 25 ? `\n  ... and ${findings.length - 25} more` : '';
  return `ariada scan — ${url}\n\n  ${status} · ${breakdown}\n\n${body}${truncated}\n\n  Duration: ${Math.round(durationMs)} ms\n`;
}

/**
 * Run a single-URL scan using @ariada-org/core-playwright + the default analyzer
 * pack. Returns 0 (no violations), 1 (violations), 2 (invalid args), or 3
 * (runtime error such as navigation failure).
 *
 * `coreScan` is injected for testability: in unit tests, supply a stub; the
 * default real implementation lazy-loads @ariada-org/core-playwright so that
 * argument-validation paths (which exit early) never instantiate Playwright.
 */
export async function runScan(
  url: string | undefined,
  options: ScanOptions,
  stdout: NodeJS.WritableStream = process.stdout,
  stderr: NodeJS.WritableStream = process.stderr,
  coreScan?: (url: string, opts: Record<string, unknown>) => Promise<{ report: ReportLike }>,
): Promise<ExitCode> {
  const checked = checkScanArgs(url, options, stderr);
  if (!checked.ok) return checked.code;
  const { url: scanUrl, threshold, browser, format, outputDir, timeoutMs } = checked.args;

  const scanFn =
    coreScan ??
    (async (u: string, opts: Record<string, unknown>) => {
      // Lazy-load to avoid Playwright import cost on validation-only paths.
      const mod = (await import('@ariada-org/core-playwright')) as {
        scan: (u: string, o: Record<string, unknown>) => Promise<{ report: ReportLike }>;
      };
      return mod.scan(u, opts);
    });

  const startedAt = Date.now();
  let report: ReportLike;
  try {
    const result = await scanFn(scanUrl, {
      timeoutMs,
      playwright: { browser, headless: true },
    });
    report = result.report;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = scanFailureCode(message);
    emitError(new CliError(code, message, { url: scanUrl }), stderr);
    return EXIT_RUNTIME_ERROR;
  }
  const durationMs = Date.now() - startedAt;

  const findings = flattenFindings(report);
  const counts = countByImpact(findings);
  const fail = shouldFail(findings, threshold);

  if (format === 'human' || format === 'both') {
    stdout.write(formatHuman(scanUrl, findings, counts, fail, durationMs));
  }

  if (format === 'json' || format === 'both') {
    const envelope = {
      $schema: 'https://ariada.org/schemas/cli-scan.v1.json',
      // Время снятия берётся у самого прохода, а не у момента записи: отчёт
      // говорит, когда смотрели, а не когда его сериализовали.
      producedBy: proiskhozhdenie(() => new Date(startedAt)),
      url: scanUrl,
      scanId: report.scanId,
      startedAt: new Date(startedAt).toISOString(),
      completedAt: new Date(startedAt + durationMs).toISOString(),
      durationMs,
      summary: {
        total: findings.length,
        byImpact: counts,
      },
      report,
      exitCode: fail ? EXIT_VIOLATIONS : EXIT_OK,
    };
    const fault = await writeScanJson(outputDir, envelope, format === 'json', stdout);
    if (fault) {
      emitError(new CliError('E_OUTPUT_WRITE', fault.message, { outputDir }), stderr);
      return EXIT_RUNTIME_ERROR;
    }
  }

  return fail ? EXIT_VIOLATIONS : EXIT_OK;
}
