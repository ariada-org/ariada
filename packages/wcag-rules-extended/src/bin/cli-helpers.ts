// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Pure-logic helpers for the run-eaa-audit CLI entry point.
 *
 * Separated from the entry-point script so they can be unit-tested without
 * spawning a browser. All functions here are synchronous and have no side
 * effects (no filesystem writes, no network calls, no process.exit).
 */

/**
 * Axe-core impact levels ordered from least to most severe.
 */
export const VALID_IMPACT_LEVELS = ['minor', 'moderate', 'serious', 'critical'] as const;
export type ImpactLevel = (typeof VALID_IMPACT_LEVELS)[number];

/**
 * Per-impact-level violation counts.
 */
export interface ByImpact {
  critical: number;
  serious: number;
  moderate: number;
  minor: number;
}

/**
 * Per-page scan summary included in the full report.
 */
export interface PageResult {
  url: string;
  violations: number;
  byImpact: ByImpact;
}

/**
 * Parsed CLI arguments, normalised and validated.
 */
export interface CliArgs {
  /** The base URL to scan. Must be https:// (or http://localhost for tests). */
  siteUrl: string;
  /** Path segments to append to siteUrl. Each starts with '/'. */
  pages: string[];
  /** Impact levels that trigger a policy failure (exit 1). */
  failOn: string[];
  /** Directory to write report.json and other output files. */
  outDir: string;
  /** Whether to emit accessibility-statement.html. */
  emitStatement: boolean;
  /** Whether to emit vpat.json + accessibility.json. */
  emitEvidence: boolean;
  /** BCP-47 locale tag for emitted accessibility statement. */
  locale: string;
}

/**
 * The JSON report written to <outDir>/report.json.
 */
export interface ScanReport {
  verdict: 'PASS' | 'FAIL';
  totalViolations: number;
  byImpact: ByImpact;
  perPage: PageResult[];
  scannerPackVersion: string;
  pagesScanned: number;
  failOn: string[];
}

/**
 * Input to buildReport — raw scan metrics before verdict is applied.
 */
export interface BuildReportInput {
  totalViolations: number;
  byImpact: ByImpact;
  perPage: PageResult[];
  scannerPackVersion: string;
  failOn: string[];
  pagesScanned: number;
}

// ---------------------------------------------------------------------------
// parseArgs
// ---------------------------------------------------------------------------

/**
 * Parse a raw argv array (the portion after `node script.mjs`) into
 * validated {@link CliArgs}.
 *
 * Throws a descriptive `Error` on any validation failure; the caller is
 * expected to catch and exit with code 2 (input error).
 */
export function parseArgs(argv: string[]): CliArgs {
  const map = new Map<string, string>();

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === undefined) break;
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const value = argv[i + 1] ?? '';
      map.set(key, value);
      i++;
    }
  }

  // --site-url / --url (alias)
  const rawUrl = map.get('site-url') ?? map.get('url') ?? '';
  if (!rawUrl) {
    throw new Error(
      'Missing required argument: --site-url <url> (or --url <url>). ' +
        'Provide an https:// URL (or http://localhost for local testing).',
    );
  }

  // URL validation — https required; http://localhost exempted for local testing
  if (!rawUrl.startsWith('https://') && !rawUrl.startsWith('http://localhost')) {
    throw new Error(
      `Invalid --site-url: "${rawUrl}". ` +
        'The URL must start with https:// (or http://localhost for local fixture testing). ' +
        'Plaintext http:// to remote hosts is rejected for security.',
    );
  }

  // --pages
  const rawPages = map.get('pages') ?? '/';
  const pages = rawPages
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p) => (p.startsWith('/') ? p : `/${p}`));

  // --fail-on
  const rawFailOn = map.get('fail-on') ?? 'serious,critical';
  const failOn = rawFailOn
    .split(',')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  for (const level of failOn) {
    if (!(VALID_IMPACT_LEVELS as readonly string[]).includes(level)) {
      throw new Error(
        `Invalid --fail-on value: "${level}". ` +
          `Allowed levels: ${VALID_IMPACT_LEVELS.join(', ')}.`,
      );
    }
  }

  // --out-dir
  const outDir = map.get('out-dir') ?? 'eaa-out';

  // --emit-statement (boolean string)
  const emitStatement = (map.get('emit-statement') ?? 'false').toLowerCase() === 'true';

  // --emit-evidence (boolean string)
  const emitEvidence = (map.get('emit-evidence') ?? 'true').toLowerCase() !== 'false';

  // --locale
  const locale = map.get('locale') ?? 'en';

  return {
    siteUrl: rawUrl,
    pages,
    failOn,
    outDir,
    emitStatement,
    emitEvidence,
    locale,
  };
}

// ---------------------------------------------------------------------------
// buildReport
// ---------------------------------------------------------------------------

/**
 * Compute the {@link ScanReport} from raw scan metrics.
 *
 * Verdict is FAIL iff any impact level in `failOn` has a non-zero count.
 */
export function buildReport(input: BuildReportInput): ScanReport {
  const { totalViolations, byImpact, perPage, scannerPackVersion, failOn, pagesScanned } = input;

  const policyFail = failOn.some((level) => {
    const count = byImpact[level as ImpactLevel] ?? 0;
    return count > 0;
  });

  return {
    verdict: policyFail ? 'FAIL' : 'PASS',
    totalViolations,
    byImpact,
    perPage,
    scannerPackVersion,
    pagesScanned,
    failOn,
  };
}

// ---------------------------------------------------------------------------
// mapExitCode
// ---------------------------------------------------------------------------

/**
 * Map a scan verdict to a process exit code.
 *
 * | Code | Meaning |
 * |------|---------|
 * | 0    | PASS — no policy-level violations |
 * | 1    | FAIL — policy violations found |
 * | 2    | Input validation error (thrown by parseArgs) |
 * | 3    | Network failure after retries |
 * | 4    | Toolchain install failure |
 * | 5    | Scanner runtime crash |
 */
export function mapExitCode(verdict: 'PASS' | 'FAIL'): 0 | 1 {
  return verdict === 'PASS' ? 0 : 1;
}
