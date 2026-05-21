// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { z } from 'zod';

import { guardUrl } from '../ssrf-guard.js';

/**
 * Input schema for the `ariada.scan` tool.
 */
export const scanInputSchema = z.object({
  url: z.string().min(1),
  locale: z.enum(['en', 'sv', 'nb', 'da', 'fi']).default('en').optional(),
  jurisdiction: z
    .enum(['SE', 'DE', 'FR', 'DK', 'FI', 'NO', 'IS', 'EU', 'UK', 'IT', 'ES'])
    .default('EU')
    .optional(),
  pack: z.enum(['checkout', 'banking', 'statement', 'all']).default('all').optional(),
  rules: z.array(z.string()).optional(),
  severityThreshold: z
    .enum(['minor', 'moderate', 'serious', 'critical'])
    .default('moderate')
    .optional(),
  browser: z.enum(['chromium', 'firefox', 'webkit']).default('chromium').optional(),
  timeoutMs: z.number().int().min(1000).max(120_000).default(30_000).optional(),
});

/** Parsed input for the `ariada.scan` tool. */
export type ScanInput = z.infer<typeof scanInputSchema>;

/**
 * Result shape returned by the scan handler. Mirrors the canonical
 * `UnifiedReport` produced by `@ariada-org/core-engine`.
 */
export interface ScanResult {
  scanId: string;
  url: string;
  startedAt: string;
  finishedAt: string;
  summary: {
    total: number;
    bySeverity: Record<'minor' | 'moderate' | 'serious' | 'critical', number>;
  };
  findings: Array<{
    ruleId: string;
    severity: 'minor' | 'moderate' | 'serious' | 'critical';
    target: string;
    description: string;
  }>;
}

/**
 * Caller-injected scan implementation. Production wires this to
 * `@ariada-org/core-playwright`; tests stub it.
 */
export type ScanFn = (parsed: URL, input: ScanInput) => Promise<ScanResult>;

/**
 * Options for `runScan`.
 */
export interface RunScanOptions {
  allowPrivate?: boolean;
  scan: ScanFn;
}

/**
 * Execute the `ariada.scan` tool with SSRF guard applied.
 */
export async function runScan(input: ScanInput, opts: RunScanOptions): Promise<ScanResult> {
  const parsed = guardUrl(input.url, { allowPrivate: opts.allowPrivate === true });
  return await opts.scan(parsed, input);
}
