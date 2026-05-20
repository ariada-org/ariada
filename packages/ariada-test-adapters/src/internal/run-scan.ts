// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
// Maintainer: Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
/**
 * Glue between the framework adapters and `@ariada/core-playwright`.
 *
 * The scanner is injected via a `ScannerImpl` interface so unit tests can
 * substitute a deterministic fake without launching Playwright. The default
 * implementation lazily imports `@ariada/core-playwright` so consumers that
 * never call `runScan` (e.g. only use the formatter helpers) do not pay the
 * Playwright module-load cost.
 */

import { AriadaTestAdapterError } from './error.js';
import type { ScanResult, ScanTarget, Violation } from './types.js';
import type { NormalisedScanOptions } from './validate-options.js';

/**
 * Minimal scanner contract the adapters depend on.
 */
export interface ScannerImpl {
  scan(target: ScanTarget, options: NormalisedScanOptions): Promise<ScanResult>;
}

/**
 * Module-level injection hook for tests. `setScanner(null)` restores the
 * lazy default implementation. Production code MUST NOT call this — it is
 * exposed exclusively for `tests/unit/run-scan.test.ts`.
 */
let injectedScanner: ScannerImpl | null = null;

/**
 * Replace the scanner used by `runScan`. Pass `null` to restore the default.
 *
 * @internal Test-only seam. Not part of the public API contract.
 */
export function setScanner(impl: ScannerImpl | null): void {
  injectedScanner = impl;
}

/**
 * Lazy default scanner that wires `@ariada/core-playwright`'s `scan(url)` and
 * normalises its `UnifiedReport` into the adapter `ScanResult` shape.
 */
async function defaultScanner(): Promise<ScannerImpl> {
  // Dynamic import so consumers that never run a real scan (e.g. only call
  // the formatter helpers in unit tests) don't pay the Playwright load cost.
  const mod = (await import('@ariada/core-playwright')) as {
    scan: (
      url: string,
      opts?: { timeoutMs?: number },
    ) => Promise<{ report: { findings?: Record<string, ReadonlyArray<unknown>> } }>;
  };

  return {
    async scan(target, options) {
      if (target.kind !== 'url') {
        // v0.1: only the URL path is wired to the production scanner. The
        // `page` and `html` paths surface a clear NOT-IMPLEMENTED error so
        // consumers know to wait for v0.2 or to use the URL path.
        throw new AriadaTestAdapterError(
          'ERR_A11Y_SCANNER_FAIL',
          `target kind ${target.kind} not supported by default scanner in v0.1 — pass a URL or inject a custom ScannerImpl via setScanner()`,
        );
      }
      const startedAt = Date.now();
      try {
        const raw = await mod.scan(target.url, { timeoutMs: options.timeoutMs });
        return projectScanResult(raw, target, startedAt);
      } catch (cause) {
        throw new AriadaTestAdapterError(
          'ERR_A11Y_SCANNER_FAIL',
          `scanner failed for ${target.url}: ${cause instanceof Error ? cause.message : String(cause)}`,
          { cause },
        );
      }
    },
  };
}

/**
 * Resolve the active scanner — injected (tests) or default (production).
 */
async function resolveScanner(): Promise<ScannerImpl> {
  return injectedScanner ?? (await defaultScanner());
}

/**
 * Run a scan with timeout enforcement and result normalisation.
 *
 * Throws `AriadaTestAdapterError` on timeout (`ERR_A11Y_TIMEOUT`) or scanner
 * failure (`ERR_A11Y_SCANNER_FAIL`). Returns the canonical `ScanResult` shape
 * on success.
 */
export async function runScan(
  target: ScanTarget,
  options: NormalisedScanOptions,
): Promise<ScanResult> {
  const scanner = await resolveScanner();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new AriadaTestAdapterError(
          'ERR_A11Y_TIMEOUT',
          `scan exceeded ${options.timeoutMs} ms timeout`,
        ),
      );
    }, options.timeoutMs);
    // Unref so a hung scanner cannot keep the process alive after the suite.
    if (typeof timer === 'object' && timer !== null && 'unref' in timer) {
      (timer as { unref?: () => void }).unref?.();
    }
  });

  try {
    return await Promise.race([scanner.scan(target, options), timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Project a `@ariada/core-playwright` raw scan output into the canonical
 * `ScanResult` shape consumed by adapters. Exported so unit tests can verify
 * projection logic in isolation.
 */
export function projectScanResult(
  raw: { report: { findings?: Record<string, ReadonlyArray<unknown>> } },
  target: ScanTarget,
  startedAt: number,
): ScanResult {
  const findingsMap = raw.report.findings ?? {};
  const violations: Violation[] = [];
  for (const arr of Object.values(findingsMap)) {
    for (const f of arr) {
      const projected = projectFinding(f);
      if (projected) violations.push(projected);
    }
  }
  return {
    violations,
    passes: 0,
    timestamp: new Date(startedAt).toISOString(),
    durationMs: Math.max(0, Date.now() - startedAt),
    target: {
      kind: target.kind,
      identifier:
        target.kind === 'url'
          ? target.url
          : target.kind === 'page'
            ? target.page.url()
            : 'inline-html',
    },
  };
}

/**
 * Best-effort projection of an engine `Finding` shape into the adapter
 * `Violation` shape. Unknown fields are dropped; missing fields default to
 * safe sentinels so the formatter never throws on partial data.
 */
function projectFinding(raw: unknown): Violation | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const f = raw as Record<string, unknown>;
  const ruleId = typeof f['ruleId'] === 'string' ? f['ruleId'] : 'unknown-rule';
  const impactRaw = f['severity'] ?? f['impact'];
  const impact = isImpact(impactRaw) ? impactRaw : 'moderate';
  const message = typeof f['message'] === 'string' ? f['message'] : '';
  const elementRef = f['element'] as { selector?: unknown } | undefined;
  const selector =
    typeof elementRef?.selector === 'string'
      ? elementRef.selector
      : typeof f['selector'] === 'string'
        ? f['selector']
        : 'unknown-selector';
  const wcag = Array.isArray(f['wcagMapping'])
    ? (f['wcagMapping'] as string[])
    : typeof f['criterion'] === 'string'
      ? [f['criterion']]
      : [];
  return {
    ruleId,
    impact,
    selector,
    message,
    wcag,
    ...(typeof f['help'] === 'string' ? { help: f['help'] } : {}),
    ...(typeof f['helpUrl'] === 'string' ? { helpUrl: f['helpUrl'] } : {}),
  };
}

function isImpact(v: unknown): v is Violation['impact'] {
  return v === 'minor' || v === 'moderate' || v === 'serious' || v === 'critical';
}
