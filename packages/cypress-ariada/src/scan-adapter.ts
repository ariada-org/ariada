// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Writable } from 'node:stream';

import type {
  AriadaFinding,
  AriadaScanMode,
  AriadaScanOptions,
  AriadaScanResult,
  AriadaSeverity,
} from './types.js';

type CliRunScan = (
  url: string | undefined,
  options: {
    outputDir?: string;
    browser?: 'chromium' | 'firefox' | 'webkit';
    format?: 'human' | 'json' | 'both';
    severityThreshold?: AriadaSeverity;
    timeoutMs?: number;
  },
  stdout?: NodeJS.WritableStream,
  stderr?: NodeJS.WritableStream,
) => Promise<number>;

export interface RunAriadaScanDependencies {
  runScan?: CliRunScan;
}

interface CliEnvelope {
  summary?: {
    total?: number;
    byImpact?: Partial<Record<AriadaSeverity, number>>;
  };
  report?: {
    findings?: Record<string, AriadaFinding[]> | AriadaFinding[];
  };
}

const SEVERITY_RANK: Record<AriadaSeverity, number> = {
  minor: 1,
  moderate: 2,
  serious: 3,
  critical: 4,
};

/**
 * Runs the shared @ariada-org CLI scanner and normalises its JSON output for
 * Cypress command assertions.
 */
export async function runAriadaScan(
  url: string,
  options: AriadaScanOptions = {},
  dependencies: RunAriadaScanDependencies = {},
): Promise<AriadaScanResult> {
  const outputDir =
    options.outputDir !== undefined
      ? resolve(options.outputDir)
      : await mkdtemp(join(tmpdir(), 'ariada-cypress-'));
  const runScan = dependencies.runScan ?? (await loadCliRunScan());
  const stdout = new MemoryWritable();
  const stderr = new MemoryWritable();
  const browser = options.browser ?? 'chromium';
  const severityThreshold = options.severityThreshold ?? 'moderate';

  const cliOptions: Parameters<CliRunScan>[1] = {
    outputDir,
    browser,
    format: 'json',
    severityThreshold,
  };
  if (options.timeoutMs !== undefined) {
    cliOptions.timeoutMs = options.timeoutMs;
  }

  const exitCode = await runScan(url, cliOptions, stdout, stderr);

  const envelope = await readCliEnvelope(outputDir);
  const findings = flattenFindings(envelope.report?.findings);
  const summary = {
    total: envelope.summary?.total ?? findings.length,
    byImpact: {
      critical: envelope.summary?.byImpact?.critical ?? 0,
      serious: envelope.summary?.byImpact?.serious ?? 0,
      moderate: envelope.summary?.byImpact?.moderate ?? 0,
      minor: envelope.summary?.byImpact?.minor ?? 0,
    },
  };
  const blockingCount = countBlocking(findings, severityThreshold);
  const message =
    blockingCount > 0
      ? formatBlockingMessage(findings, severityThreshold)
      : stderr.text() || stdout.text() || 'ariada scan completed without blocking violations';

  return {
    url,
    exitCode,
    mode: scanMode(browser),
    summary,
    findings,
    blockingCount,
    message,
    outputDir,
  };
}

export function formatBlockingMessage(
  findings: readonly AriadaFinding[],
  threshold: AriadaSeverity = 'moderate',
): string {
  const blocking = findings.filter((finding) => isBlocking(finding, threshold));
  const lines = blocking.slice(0, 10).map((finding) => {
    const rule = finding.ruleId ?? 'unknown-rule';
    const severity = finding.severity ?? 'unknown';
    const selector = finding.element?.selector ? ` ${finding.element.selector}` : '';
    const criterion = finding.criterion ? ` (${finding.criterion})` : '';
    return `- ${rule} [${severity}]${criterion}${selector}: ${finding.message ?? 'No message'}`;
  });
  const hidden = blocking.length > lines.length ? `\n... and ${blocking.length - lines.length} more` : '';
  return `ariada scan found ${blocking.length} blocking violation(s):\n${lines.join('\n')}${hidden}`;
}

async function loadCliRunScan(): Promise<CliRunScan> {
  const cli = (await import('@ariada-org/cli')) as { runScan: CliRunScan };
  return cli.runScan;
}

async function readCliEnvelope(outputDir: string): Promise<CliEnvelope> {
  const raw = await readFile(join(outputDir, 'scan.json'), 'utf8');
  return JSON.parse(raw) as CliEnvelope;
}

function flattenFindings(
  findings: Record<string, AriadaFinding[]> | AriadaFinding[] | undefined,
): AriadaFinding[] {
  if (findings === undefined) return [];
  if (Array.isArray(findings)) return findings;
  return Object.values(findings).flat();
}

function countBlocking(findings: readonly AriadaFinding[], threshold: AriadaSeverity): number {
  return findings.filter((finding) => isBlocking(finding, threshold)).length;
}

function isBlocking(finding: AriadaFinding, threshold: AriadaSeverity): boolean {
  const severity = isSeverity(finding.severity) ? finding.severity : 'moderate';
  return SEVERITY_RANK[severity] >= SEVERITY_RANK[threshold];
}

function isSeverity(value: unknown): value is AriadaSeverity {
  return value === 'minor' || value === 'moderate' || value === 'serious' || value === 'critical';
}

function scanMode(browser: AriadaScanOptions['browser']): AriadaScanMode {
  return browser === undefined || browser === 'chromium' ? 'ax-tree' : 'dom-fallback';
}

class MemoryWritable extends Writable {
  readonly chunks: Buffer[] = [];

  override _write(
    chunk: Buffer | string,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    callback();
  }

  text(): string {
    return Buffer.concat(this.chunks).toString('utf8').trim();
  }
}
