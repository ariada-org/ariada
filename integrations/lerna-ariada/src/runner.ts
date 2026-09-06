// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/runner.js` and `dist/runner.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies
// are the compiled ones. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.
//
// A PACKAGE'S REPORT DIRECTORY IS ITS NAME PLUS A HASH OF ITS NAME. The readable
// half is for a person looking at the directory; the hash is because two package
// names can flatten to the same readable form — `@scope/thing` and
// `@other/thing` — and then one package's report would overwrite the other's
// with nobody told.
//
// The directory is removed before a scan rather than merged into. A stale report
// from a target that has since been dropped would otherwise be aggregated
// forever as a current result.
//
// Exit codes are passed through only where they mean something. Zero and one are
// the page's verdict; two through five are the scanner's own refusals and are
// forwarded so the caller can tell them apart; anything else becomes three,
// because an unrecognised code is not a verdict. A process killed by a signal
// reports three too, and says which signal — otherwise a browser the operating
// system removed for using too much memory looks like a page that failed.
//
// The browser download is disabled for the child, so a scan never installs
// software in the middle of somebody's build.
//
// Reports are written beside themselves and renamed into place: the aggregate
// step reads these while they are being written, and half a file parses as
// nothing rather than as half.

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ScanOptions } from './arguments.js';
import { IMPACTS, readCliScanArtifact } from './artifact.js';
import type { Impact, ParsedScanArtifact } from './artifact.js';
import { findWorkspaceRoot } from './topology.js';


export const PACKAGE_REPORT_SCHEMA = 'https://ariada.org/schemas/lerna-package-scan.v1.json';

export interface AriadaInvocation {
  command: string;
  args: string[];
  target: string;
  artifactPath: string;
}

export interface PackageTargetResult {
  url: string;
  artifact: string;
  findings: number;
  byImpact: Record<Impact, number>;
  ruleIds: string[];
  exitCode: 0 | 1;
}

export interface PackageScanSummary {
  $schema: typeof PACKAGE_REPORT_SCHEMA;
  packageName: string;
  packagePath: string;
  generatedAt: string;
  targets: PackageTargetResult[];
  summary: {
    total: number;
    byImpact: Record<Impact, number>;
  };
  exitCode: 0 | 1;
}

export interface RunnerIo {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  stdout?: NodeJS.WritableStream;
  stderr?: NodeJS.WritableStream;
  cliBin?: string;
  now?: () => Date;
}

function cliBinary(): string {
  const cliIndex = import.meta.resolve('@ariada-org/cli');
  return fileURLToPath(new URL('./bin.js', cliIndex));
}

export function packageKey(name: string): string {
  const readable = name.toLowerCase().replace(/^@/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'package';
  return readable + '-' + createHash('sha256').update(name).digest('hex').slice(0, 10);
}

function targetFolder(index: number): string {
  return 'target-' + String(index + 1).padStart(3, '0');
}

export function buildAriadaInvocation(
  options: ScanOptions,
  target: string,
  index: number,
  packageReportDir: string,
  cliBin: string = cliBinary(),
): AriadaInvocation {
  const outputDir = resolve(packageReportDir, targetFolder(index));
  return {
    command: process.execPath,
    args: [cliBin, 'scan', target, '--output-dir', outputDir, '--browser', options.browser, '--format', 'both', '--severity-threshold', options.severityThreshold, '--timeout-ms', String(options.timeoutMs)],
    target,
    artifactPath: resolve(outputDir, 'scan.json')
  };
}

async function childExit(
  invocation: AriadaInvocation,
  cwd: string,
  env: NodeJS.ProcessEnv,
  stdout: NodeJS.WritableStream,
  stderr: NodeJS.WritableStream,
): Promise<number> {
  return await new Promise((resolveExit) => {
    const child = spawn(invocation.command, invocation.args, { cwd, env, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', (chunk) => stdout.write(chunk));
    child.stderr.on('data', (chunk) => stderr.write(chunk));
    child.once('error', (error) => {
      stderr.write(JSON.stringify({ level: 'error', code: 'E_CLI_SPAWN', message: error.message, target: invocation.target }) + '\n');
      resolveExit(3);
    });
    child.once('close', (code, signal) => {
      if (code === null) {
        stderr.write(JSON.stringify({ level: 'error', code: 'E_CLI_SIGNAL', signal: signal ?? 'unknown', target: invocation.target }) + '\n');
        resolveExit(3);
      }
      else resolveExit(code);
    });
  });
}

async function manifestName(cwd: string): Promise<string> {
  const value = JSON.parse(await readFile(resolve(cwd, 'package.json'), 'utf8'));
  if (value === null || typeof value !== 'object' || Array.isArray(value) || typeof value['name'] !== 'string') {
    throw new Error('Current Lerna package manifest has no name');
  }
  return value['name'];
}

function targets(options: ScanOptions, env: NodeJS.ProcessEnv): string[] {
  const values = [...options.targets];
  for (const name of options.targetEnvs) {
    const value = env[name];
    if (value === undefined || value.length === 0) throw new Error('Target environment variable ' + name + ' is empty');
    values.push(value);
  }
  for (const target of values) {
    const url = new URL(target);
    if (url.protocol !== 'http:' && url.protocol !== 'https:')
      throw new Error('Ariada target must use http or https: ' + target);
  }
  return values;
}

function zeroByImpact(): Record<Impact, number> {
  return Object.fromEntries(IMPACTS.map((impact) => [impact, 0])) as Record<Impact, number>;
}

async function atomicJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = path + '.tmp-' + String(process.pid);
  await writeFile(temporary, JSON.stringify(value, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
  await rename(temporary, path);
}

function targetResult(artifact: ParsedScanArtifact, artifactPath: string, packageReportDir: string): PackageTargetResult {
  return {
    url: artifact.url,
    artifact: relative(packageReportDir, artifactPath).split('\\').join('/'),
    findings: artifact.total,
    byImpact: artifact.byImpact,
    ruleIds: [...new Set(artifact.findings.map((finding) => finding.ruleId).filter((value) => typeof value === 'string'))].sort(),
    exitCode: artifact.exitCode
  };
}

export async function runPackageScan(
  options: ScanOptions,
  io: RunnerIo = {},
): Promise<{ exitCode: number; summary?: PackageScanSummary; summaryPath?: string }> {
  const cwd = resolve(io.cwd ?? process.cwd());
  const env = { ...process.env, ...io.env, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1' };
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;
  const root = options.workspaceRoot === undefined ? await findWorkspaceRoot(cwd) : resolve(cwd, options.workspaceRoot);
  const packageName = await manifestName(cwd);
  const reportRoot = resolve(root, options.reportRoot);
  const packageReportDir = resolve(reportRoot, 'packages', packageKey(packageName));
  await rm(packageReportDir, { recursive: true, force: true });
  const results: PackageTargetResult[] = [];
  for (const [index, target] of targets(options, env).entries()) {
    const invocation = buildAriadaInvocation(options, target, index, packageReportDir, io.cliBin);
    const exitCode = await childExit(invocation, cwd, env, stdout, stderr);
    if (exitCode !== 0 && exitCode !== 1) return { exitCode: exitCode >= 2 && exitCode <= 5 ? exitCode : 3 };
    const artifact = await readCliScanArtifact(invocation.artifactPath, target, exitCode);
    results.push(targetResult(artifact, invocation.artifactPath, packageReportDir));
  }
  const byImpact = zeroByImpact();
  for (const result of results)
    for (const impact of IMPACTS)
      byImpact[impact] += result.byImpact[impact];
  const total = results.reduce((sum, result) => sum + result.findings, 0);
  const exitCode = results.some((result) => result.exitCode === 1) ? 1 : 0;
  const summary: PackageScanSummary = {
    $schema: PACKAGE_REPORT_SCHEMA,
    packageName,
    packagePath: relative(root, cwd).split('\\').join('/'),
    generatedAt: (io.now ?? (() => new Date()))().toISOString(),
    targets: results,
    summary: { total, byImpact },
    exitCode
  };
  const summaryPath = resolve(packageReportDir, 'package-summary.json');
  await atomicJson(summaryPath, summary);
  stdout.write('ARIADA_LERNA_PACKAGE ' + JSON.stringify({ packageName, targets: results.length, findings: total, exitCode, summary: summaryPath }) + '\n');
  return { exitCode, summary, summaryPath };
}
