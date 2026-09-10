// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/index.js` and `dist/index.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies
// are the compiled ones. It is released from that comparison: the digest no
// longer has to match, and what holds this file now is the behaviour described
// in the tests beside it, written while the
// comparison still agreed, so it describes the code that ships rather than the
// intent behind it.
//
// THE GATE IS COMPUTED HERE RATHER THAN TAKEN FROM THE SCANNER. The threshold is
// applied to the findings this module read, and the count above it decides the
// verdict — so the number in the report and the exit code cannot disagree, which
// they can when one side reports and the other decides.
//
// TWO FILE NAMES ARE TRIED because the scanner has written its output under both.
// A missing first file is not an error; a malformed one is, and is raised
// immediately rather than silently falling through to the second — a file that
// exists and does not parse is a different situation from a file that is not
// there, and reporting the first as the second sends whoever reads it looking in
// the wrong place.
//
// A FINDING IS ACCEPTED IN WHATEVER SHAPE IT ARRIVES: the identifier as `id` or
// `ruleId`, the severity as `severity` or `impact`, the text as `message` or
// `description`, the place as `target` or `selector`, and the collection either
// as a list or as groups keyed by something. An unrecognised severity becomes
// the second-highest rather than the lowest, because guessing low lets a real
// problem past the gate while guessing high at worst makes somebody look.

import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const SEVERITIES = ['minor', 'moderate', 'serious', 'critical'] as const;
export type Severity = (typeof SEVERITIES)[number];

export interface TypedreamScanOptions {
  publishedUrl: string;
  outputDirectory?: string;
  severityThreshold?: Severity;
  cliBin?: string;
  timeoutMs?: number;
}

export interface ScanCommand {
  command: string;
  args: string[];
}

export interface AriadaFinding {
  id: string;
  severity: Severity;
  message: string;
  target: string;
}

export interface TypedreamScanResult {
  publishedUrl: string;
  findings: AriadaFinding[];
  summary: { total: number; blocking: number };
  gate: { threshold: Severity; passed: boolean };
}

export type CommandRunner = (command: ScanCommand) => Promise<number>;

const RANK: Record<Severity, number> = { minor: 1, moderate: 2, serious: 3, critical: 4 };

export function validatePublishedUrl(publishedUrl: string): void {
  let url;
  try {
    url = new URL(publishedUrl);
  } catch {
    throw new Error(`Typedream published URL must be an http(s) URL: ${publishedUrl}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Typedream published URL must be an http(s) URL: ${publishedUrl}`);
  }
}

export function buildScanCommand(
  options: Required<Pick<TypedreamScanOptions, 'publishedUrl' | 'outputDirectory'>> &
    Pick<TypedreamScanOptions, 'severityThreshold' | 'cliBin' | 'timeoutMs'>,
): ScanCommand {
  validatePublishedUrl(options.publishedUrl);
  const threshold = options.severityThreshold ?? 'serious';
  if (!SEVERITIES.includes(threshold))
    throw new Error(`Unsupported severity threshold: ${threshold}`);
  const cliBin = options.cliBin ?? process.env['ARIADA_CLI_BIN'];
  return {
    command: cliBin ?? 'npx',
    args: [
      ...(cliBin ? [] : ['--yes', '@ariada-org/cli']),
      'scan',
      options.publishedUrl,
      '--format',
      'json',
      '--output-dir',
      options.outputDirectory,
      '--domains',
      'accessibility',
      '--severity-threshold',
      threshold,
      ...(options.timeoutMs ? ['--timeout-ms', String(options.timeoutMs)] : []),
    ],
  };
}

export async function scanTypedreamSite(
  options: TypedreamScanOptions,
  runner: CommandRunner = runCommand,
): Promise<TypedreamScanResult> {
  const outputDirectory = options.outputDirectory ?? 'ariada-output';
  const command = buildScanCommand({
    publishedUrl: options.publishedUrl,
    outputDirectory,
    ...(options.cliBin ? { cliBin: options.cliBin } : {}),
    ...(options.severityThreshold ? { severityThreshold: options.severityThreshold } : {}),
    ...(options.timeoutMs ? { timeoutMs: options.timeoutMs } : {}),
  });
  const exitCode = await runner(command);
  if (exitCode !== 0) throw new Error(`@ariada-org/cli exited with code ${exitCode}`);
  return readAriadaResult(outputDirectory, options.publishedUrl, options.severityThreshold);
}

export async function readAriadaResult(
  outputDirectory: string,
  publishedUrl: string,
  threshold?: Severity,
): Promise<TypedreamScanResult> {
  for (const filename of ['scan.json', 'multi-domain-report.json']) {
    try {
      return mapAriadaResult(
        JSON.parse(await readFile(resolve(outputDirectory, filename), 'utf8')),
        publishedUrl,
        threshold,
      );
    } catch (error) {
      if (error instanceof SyntaxError)
        throw new Error(`Invalid Ariada JSON: ${resolve(outputDirectory, filename)}`);
      // Только отсутствие файла — повод попробовать следующее имя. Всё
      // остальное шло сюда же и сворачивалось в «вывода нет»: годный отчёт с
      // негодным порогом отвечал, что файла нет, и читателя отправляли искать
      // то, что лежит перед ним.
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  throw new Error(`Ariada output not found in ${resolve(outputDirectory)}`);
}

export function mapAriadaResult(
  payload: unknown,
  publishedUrl: string,
  threshold: Severity = 'serious',
): TypedreamScanResult {
  if (!SEVERITIES.includes(threshold))
    throw new Error(`Unsupported severity threshold: ${threshold}`);
  const findings = collectFindings(payload).map(toFinding);
  const blocking = findings.filter((finding) => RANK[finding.severity] >= RANK[threshold]).length;
  return {
    publishedUrl,
    findings,
    summary: { total: findings.length, blocking },
    gate: { threshold, passed: blocking === 0 },
  };
}

export function evaluateGate(result: TypedreamScanResult): number {
  return result.gate.passed ? 0 : 1;
}

function collectFindings(payload: unknown): unknown[] {
  if (!payload || typeof payload !== 'object') return [];
  const root = payload as Record<string, unknown>;
  const report = (
    root['report'] && typeof root['report'] === 'object' ? root['report'] : root
  ) as Record<string, unknown>;
  const raw = report['findings'] ?? report['violations'];
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object')
    return Object.values(raw).flatMap((value) => (Array.isArray(value) ? value : []));
  return [];
}

function toFinding(value: unknown): AriadaFinding {
  const row = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const severity = row['severity'] ?? row['impact'];
  return {
    id: String(row['id'] ?? row['ruleId'] ?? 'ariada/unknown'),
    severity: SEVERITIES.includes(severity as Severity) ? (severity as Severity) : 'serious',
    message: String(row['message'] ?? row['description'] ?? 'Ariada finding'),
    target: String(row['target'] ?? row['selector'] ?? 'document'),
  };
}

function runCommand({ command, args }: ScanCommand): Promise<number> {
  return new Promise((resolveExit) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('exit', (code) => resolveExit(code ?? 2));
    child.on('error', () => resolveExit(2));
  });
}
