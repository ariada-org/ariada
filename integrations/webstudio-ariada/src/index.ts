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
// THE PAGE ORDER IS FIXED, TWICE. Directory entries are sorted before the walk
// descends, and the collected paths are sorted again by their position relative
// to the export root. The file system offers no order of its own, and a report
// whose pages appear in a different sequence on each run cannot be compared with
// the previous one — which is most of what a report is for.
//
// EVERY PAGE GOES INTO ONE INVOCATION rather than one each. A static export is a
// set of files that belong together, and scanning them separately produces
// separate reports with nothing tying them into a verdict about the site.
//
// A FINDING KEEPS ITS PAGE where it names one. Where it does not, the page is
// filled in only when the export had exactly one — with two or more there is no
// honest answer, and inventing one would attach a finding to a page it may not
// be on.

import { readdir, readFile } from 'node:fs/promises';
// `basename` is imported here and never called. That is how the original was,
// and dropping it would offer a slightly different module as the recovery: an
// import that is kept is emitted, and the comparison notices.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { basename, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const DEFAULT_SEVERITY_THRESHOLD = 'serious';
export const DEFAULT_DOMAINS = ['accessibility'] as const;

const SEVERITY_RANK = { minor: 1, moderate: 2, serious: 3, critical: 4 } as const;
type Severity = keyof typeof SEVERITY_RANK;

export interface ScanOptions {
  exportDirectory: string;
  outputDirectory?: string;
  cliBin?: string;
  severityThreshold?: Severity;
  domains?: readonly string[];
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
  page?: string;
}

export interface WebstudioScanResult {
  pages: string[];
  findings: AriadaFinding[];
  summary: { total: number; blocking: number };
  gate: { threshold: Severity; passed: boolean };
}

export type CommandRunner = (command: ScanCommand) => Promise<number>;

/** Returns Webstudio's exported HTML pages in stable relative-path order. */
export async function listExportedPages(directory: string): Promise<string[]> {
  const root = resolve(directory);
  const files: string[] = [];
  async function walk(current: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const path = resolve(current, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) files.push(path);
    }
  }
  await walk(root);
  return files.sort((left, right) => relative(root, left).localeCompare(relative(root, right)));
}

export function buildScanCommand(options: {
  targets: readonly string[];
  outputDirectory: string;
  cliBin?: string;
  severityThreshold?: Severity;
  domains?: readonly string[];
}): ScanCommand {
  const cliBin = options.cliBin ?? process.env['ARIADA_CLI_BIN'];
  const command = cliBin ?? 'npx';
  const prefix = cliBin ? [] : ['--yes', '@ariada-org/cli'];
  return {
    command,
    args: [
      ...prefix,
      'scan',
      ...options.targets,
      '--format',
      'json',
      '--output-dir',
      options.outputDirectory,
      '--severity-threshold',
      options.severityThreshold ?? DEFAULT_SEVERITY_THRESHOLD,
      '--domains',
      (options.domains ?? DEFAULT_DOMAINS).join(','),
    ],
  };
}

/** Creates the one CLI invocation used for a complete static export. */
export async function scanExportedSite(
  options: ScanOptions,
  runner: CommandRunner = runCommand,
): Promise<number> {
  const root = resolve(options.exportDirectory);
  const pages = await listExportedPages(root);
  if (pages.length === 0) throw new Error(`Webstudio export contains no HTML pages: ${root}`);
  const command = buildScanCommand({
    targets: pages.map((page) => pathToFileURL(page).href),
    outputDirectory: options.outputDirectory ?? 'ariada-output',
    ...(options.cliBin ? { cliBin: options.cliBin } : {}),
    ...(options.severityThreshold ? { severityThreshold: options.severityThreshold } : {}),
    ...(options.domains ? { domains: options.domains } : {}),
  });
  return runner(command);
}

export function mapAriadaResult(
  payload: unknown,
  pages: readonly string[],
  threshold: Severity = DEFAULT_SEVERITY_THRESHOLD,
): WebstudioScanResult {
  // AN UNKNOWN THRESHOLD USED TO PASS EVERYTHING. The comparison below reads its
  // rank, an unknown name has none, and every comparison against `undefined` is
  // false — so a misspelled threshold produced a gate that blocked nothing and
  // said so cheerfully. Refusing it is the only honest answer: a gate that
  // cannot apply the threshold it was given has no verdict to offer.
  if (!(threshold in SEVERITY_RANK))
    throw new Error(`Unsupported severity threshold: ${threshold}`);
  const findings = collectFindings(payload).map((value) => toFinding(value, pages));
  const blocking = findings.filter(
    (finding) => SEVERITY_RANK[finding.severity] >= SEVERITY_RANK[threshold],
  ).length;
  return {
    pages: [...pages],
    findings,
    summary: { total: findings.length, blocking },
    gate: { threshold, passed: blocking === 0 },
  };
}

export function evaluateGate(result: WebstudioScanResult): number {
  return result.gate.passed ? 0 : 1;
}

export async function readAriadaResult(
  outputDirectory: string,
  pages: readonly string[],
  threshold?: Severity,
): Promise<WebstudioScanResult> {
  const directory = resolve(outputDirectory);
  for (const filename of ['scan.json', 'multi-domain-report.json']) {
    try {
      const payload = JSON.parse(await readFile(resolve(directory, filename), 'utf8'));
      return mapAriadaResult(payload, pages, threshold);
    } catch (error) {
      if (error instanceof SyntaxError)
        throw new Error(`Invalid Ariada JSON: ${resolve(directory, filename)}`);
      // Только отсутствие файла — повод попробовать следующее имя. Всё
      // остальное шло сюда же и сворачивалось в «вывода нет»: годный отчёт с
      // негодным порогом отвечал, что файла нет, и читателя отправляли искать
      // то, что лежит перед ним.
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  throw new Error(`Ariada output not found in ${directory}`);
}

function collectFindings(payload: unknown): unknown[] {
  if (!payload || typeof payload !== 'object') return [];
  const report = payload as Record<string, unknown>;
  if (Array.isArray(report['findings'])) return report['findings'];
  if (report['findings'] && typeof report['findings'] === 'object')
    return Object.values(report['findings'] as object).flatMap((value) =>
      Array.isArray(value) ? value : [],
    );
  if (Array.isArray(report['violations'])) return report['violations'];
  return [];
}

function toFinding(value: unknown, pages: readonly string[]): AriadaFinding {
  const row = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const page =
    typeof row['page'] === 'string'
      ? row['page']
      : typeof row['url'] === 'string'
        ? row['url']
        : undefined;
  return {
    id: String(row['id'] ?? row['ruleId'] ?? 'ariada/unknown'),
    severity: asSeverity(row['severity'] ?? row['impact']),
    message: String(row['message'] ?? row['description'] ?? 'Ariada finding'),
    target: String(row['target'] ?? row['selector'] ?? 'document'),
    ...(page ? { page } : pages.length === 1 ? { page: pages[0] } : {}),
  };
}

function asSeverity(value: unknown): Severity {
  return value === 'minor' || value === 'moderate' || value === 'critical' ? value : 'serious';
}

function runCommand({ command, args }: ScanCommand): Promise<number> {
  return import('node:child_process').then(
    ({ spawn }) =>
      new Promise((resolveExit) => {
        const child = spawn(command, args, { stdio: 'inherit' });
        child.on('exit', (code) => resolveExit(code ?? 3));
        child.on('error', () => resolveExit(3));
      }),
  );
}
