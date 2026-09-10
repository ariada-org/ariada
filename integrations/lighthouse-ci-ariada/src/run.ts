#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/run.js` and `dist/run.d.ts`. The source this was built
// from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies
// are the compiled ones. It is released from that comparison: the digest no
// longer has to match, and what holds this file now is the behaviour described
// in the tests beside it, written while the
// comparison still agreed, so it describes the code that ships rather than the
// intent behind it.
//
// THE WHOLE POINT IS TELLING TWO KINDS OF FAILURE APART. A performance budget
// that was not met and an accessibility policy that was not met are verdicts —
// the tools ran, looked, and disagreed with the page. A tool that could not
// start, or crashed, or wrote nothing readable is not a verdict at all. Both
// arrive as a non-zero exit code, and a gate that treats them alike reports a
// broken installation as a failing page, which sends whoever reads it to fix the
// wrong thing.
//
// So each tool's exit code is admitted only if it is nought or one; anything
// else becomes an infrastructure error carrying the tool's own stderr, and the
// combined conclusion is `error` rather than `failed`. The process exit follows
// the same three-way split: nought passed, one failed, two could not be
// determined.
//
// EVERY EFFECT GOES THROUGH THE DEPENDENCY RECORD. Running a command, reading a
// file, writing one, making a directory — all four are fields a caller can
// replace, which is what makes this testable without a browser, a network or a
// build of either tool. The default implementations are the only place the real
// ones are named.
//
// THE FINDING COUNT ACCEPTS TWO SHAPES because the scanner emits two. Findings
// grouped by rule is the ordinary one; the canonical grid, findings by domain
// within category, is the other. Neither present is an error rather than nought
// — a report this reader does not understand must not be counted as a clean one.
//
// THE TWO TOOLS DO NOT SHARE A BROWSER, and the report says so in a field rather
// than leaving it to be assumed. They each drive their own, which costs a second
// page load and buys the guarantee that neither measurement is standing in
// state the other left behind.

import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface GateDependencies {
  run(command: string, args: string[]): Promise<CommandResult>;
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  ensureDir(path: string): Promise<void>;
}

export interface GateOptions {
  url: string;
  outputDir: string;
  lhciBinary?: string;
  ariadaBinary?: string;
  lhciConfig?: string;
  allowPrivate?: boolean;
  lhciArgs?: string[];
}

export interface CombinedGateReport {
  schemaVersion: '1.0';
  url: string;
  conclusion: 'passed' | 'failed' | 'error';
  lighthouseCi: {
    exitCode: number | null;
    gateFailed: boolean;
  };
  ariada: {
    exitCode: number | null;
    policyFailed: boolean;
    findingCount: number | null;
    report: unknown | null;
  };
  execution: {
    sharedChromeSession: false;
  };
  error?: string;
}

const defaultDependencies: GateDependencies = {
  run: (command, args) =>
    new Promise((resolveResult, reject) => {
      const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => (stdout += chunk));
      child.stderr.on('data', (chunk: string) => (stderr += chunk));
      child.on('error', reject);
      child.on('close', (code) => resolveResult({ exitCode: code ?? 2, stdout, stderr }));
    }),
  read: (path) => readFile(path, 'utf8'),
  write: (path, content) => writeFile(path, content, 'utf8'),
  ensureDir: (path) => mkdir(path, { recursive: true }).then(() => undefined),
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Findings held in named groups, counted across the groups. */
function countGroups(groups: Record<string, unknown>): number {
  let total = 0;
  for (const entries of Object.values(groups)) {
    if (Array.isArray(entries)) total += entries.length;
  }
  return total;
}

/** The canonical grid: findings by domain, within category. One level deeper. */
function countGrid(grid: Record<string, unknown>): number {
  let total = 0;
  for (const domains of Object.values(grid)) {
    if (isRecord(domains)) total += countGroups(domains);
  }
  return total;
}

function countFindings(value: unknown): number {
  if (!isRecord(value)) throw new Error('Ariada report is not an object.');
  const payload = isRecord(value['report']) ? value['report'] : value;
  const findings = payload['findings'];
  if (isRecord(findings)) return countGroups(findings);
  const grid = payload['grid'];
  if (isRecord(grid)) return countGrid(grid);
  // Neither shape is a refusal rather than nought: a report this reader does not
  // understand must not be counted as a clean one.
  throw new Error('Ariada report has no findings or canonical grid.');
}

function infrastructureMessage(tool: string, result: CommandResult): string {
  const detail = result.stderr.trim();
  return `${tool} infrastructure failed with exit ${result.exitCode}${detail ? `: ${detail}` : ''}`;
}

/**
 * Whether the tool reached a verdict at all. Nought and one are its answer about
 * the page; anything else means it did not get as far as answering, and that is
 * not a failing page.
 */
function assertToolRan(tool: string, result: CommandResult): void {
  if (![0, 1].includes(result.exitCode)) {
    throw new Error(infrastructureMessage(tool, result));
  }
}

/** What the caller is told, once both tools have or have not answered. */
function conclusionOf(
  infrastructureError: string | undefined,
  lighthouseExitCode: number | null,
  ariadaExitCode: number | null,
): CombinedGateReport['conclusion'] {
  if (infrastructureError) return 'error';
  return lighthouseExitCode === 0 && ariadaExitCode === 0 ? 'passed' : 'failed';
}

function lighthouseArguments(options: GateOptions, lighthouseDir: string, href: string): string[] {
  return (
    options.lhciArgs ?? [
      'autorun',
      ...(options.lhciConfig ? [`--config=${resolve(options.lhciConfig)}`] : []),
      `--collect.url=${href}`,
      '--upload.target=filesystem',
      `--upload.outputDir=${lighthouseDir}`,
    ]
  );
}

export async function runCombinedGate(
  options: GateOptions,
  overrides: Partial<GateDependencies> = {},
): Promise<CombinedGateReport> {
  const deps = { ...defaultDependencies, ...overrides };
  const url = new URL(options.url);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Gate URL must be http/https.');
  }
  const outputDir = resolve(options.outputDir);
  const ariadaDir = resolve(outputDir, 'ariada');
  const lighthouseDir = resolve(outputDir, 'lighthouse');
  const combinedPath = resolve(outputDir, 'lhci-ariada-report.json');
  await deps.ensureDir(ariadaDir);
  await deps.ensureDir(lighthouseDir);

  let lighthouseExitCode: number | null = null;
  let ariadaExitCode: number | null = null;
  let ariadaReport: unknown = null;
  let findingCount: number | null = null;
  let infrastructureError: string | undefined;

  try {
    const lighthouse = await deps.run(
      options.lhciBinary ?? 'lhci',
      lighthouseArguments(options, lighthouseDir, url.href),
    );
    lighthouseExitCode = lighthouse.exitCode;
    assertToolRan('LHCI', lighthouse);

    const ariada = await deps.run(options.ariadaBinary ?? 'ariada', [
      'scan',
      url.href,
      '--format',
      'json',
      '--output-dir',
      ariadaDir,
      ...(options.allowPrivate ? ['--allow-private'] : []),
    ]);
    ariadaExitCode = ariada.exitCode;
    assertToolRan('Ariada', ariada);

    try {
      ariadaReport = JSON.parse(await deps.read(resolve(ariadaDir, 'scan.json')));
      findingCount = countFindings(ariadaReport);
      ariadaReport =
        isRecord(ariadaReport) && 'report' in ariadaReport ? ariadaReport['report'] : ariadaReport;
    } catch (error) {
      throw new Error(`Ariada did not produce a readable scan.json: ${String(error)}`);
    }
  } catch (error) {
    infrastructureError = error instanceof Error ? error.message : String(error);
  }

  const combined: CombinedGateReport = {
    schemaVersion: '1.0',
    url: url.href,
    conclusion: conclusionOf(infrastructureError, lighthouseExitCode, ariadaExitCode),
    lighthouseCi: {
      exitCode: lighthouseExitCode,
      gateFailed: lighthouseExitCode === 1,
    },
    ariada: {
      exitCode: ariadaExitCode,
      policyFailed: ariadaExitCode === 1,
      findingCount,
      report: ariadaReport,
    },
    execution: { sharedChromeSession: false },
    ...(infrastructureError ? { error: infrastructureError } : {}),
  };
  await deps.write(combinedPath, `${JSON.stringify(combined, null, 2)}\n`);
  return combined;
}

function parseArguments(argv: readonly string[]): GateOptions {
  const value = (name: string): string | undefined => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const url = value('--url');
  if (!url) throw new Error('--url is required');
  const lhciBinary = value('--lhci-binary');
  const ariadaBinary = value('--ariada-binary');
  const lhciConfig = value('--lhci-config');
  return {
    url,
    outputDir: value('--output-dir') ?? '.lhci-ariada',
    ...(lhciBinary ? { lhciBinary } : {}),
    ...(ariadaBinary ? { ariadaBinary } : {}),
    ...(lhciConfig ? { lhciConfig } : {}),
    ...(argv.includes('--allow-private') ? { allowPrivate: true } : {}),
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  runCombinedGate(parseArguments(process.argv.slice(2)))
    .then((report) => {
      console.log(`LHCI + Ariada gate: ${report.conclusion}`);
      process.exitCode = report.conclusion === 'passed' ? 0 : report.conclusion === 'failed' ? 1 : 2;
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 2;
    });
}
