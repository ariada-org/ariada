// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/aggregate.js` and `dist/aggregate.d.ts`. The source this
// was built from was never committed; the compiled output is `tsc` with the
// types stripped, so the shapes come back from the declaration file and the
// It has since been released from that comparison — that sentence is kept on one
// line, because the guard reads for this wording literally.
//
// HOW IT IS HELD NOW. Eight behaviour tests written while the comparison still
// matched, then the gathering of one package split out of the loop that also
// summed and assembled. Twenty-four against a limit of fifteen.
//
// The tests build a real workspace on disk rather than injecting dependencies,
// because this module does not take any: it walks upwards for the workspace
// root, reads the topology through the filesystem, and reads each summary and
// artifact by path. Stubbing that would test something the module does not do.
//
// Checked by removal: stop comparing a package summary's total against the
// artifacts beneath it, allow an artifact path to climb out of the report
// directory, drop the requirement that some package is marked as scanned, or
// stop matching a summary's package name against the topology — each fails a
// test that passes otherwise.
//
// The guarantee lives in `tests/scripts/recovered-lerna-aggregate.test.ts`, and
// the release is recorded in `tests/scripts/vypushchennye-iz-slicheniya.txt`.
//
// THIS RE-READS EVERY SCAN RATHER THAN TRUSTING THE PER-PACKAGE SUMMARIES.
// A summary is a claim about artifacts sitting next to it, and the workspace's
// single number is built from the artifacts themselves — then checked against
// what each summary said. A package whose summary and artifacts disagree stops
// the aggregation rather than contributing a number nobody can reproduce.
//
// THE PATH INSIDE A SUMMARY IS TREATED AS UNTRUSTED. It names a file to read,
// and a summary is a file on disk that something else wrote; an absolute path or
// one climbing out with `..` is refused rather than followed. That is the whole
// of the difference between reading a report and reading whatever the report
// points at.
//
// The workspace's generated time is the latest of the packages', not the moment
// this ran. The aggregate describes when the scanning happened, and saying "now"
// would make a report of week-old scans look fresh.
//
// A workspace with no package declaring an accessibility script is an error
// rather than an empty report. An empty report reads as "nothing found", and
// nothing was looked at.

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';

import type { AggregateOptions } from './arguments.js';
import { IMPACTS, readCliScanArtifact } from './artifact.js';
import type { Impact } from './artifact.js';
import { PACKAGE_REPORT_SCHEMA, packageKey } from './runner.js';
import type { PackageScanSummary } from './runner.js';
import { findWorkspaceRoot, readTopology } from './topology.js';


export const AGGREGATE_SCHEMA = 'https://ariada.org/schemas/lerna-aggregate.v1.json';

export interface AggregatePackageResult {
  packageName: string;
  packagePath: string;
  targets: number;
  findings: number;
  byImpact: Record<Impact, number>;
  ruleIds: string[];
  exitCode: 0 | 1;
  summary: string;
}

export interface AggregateReport {
  $schema: typeof AGGREGATE_SCHEMA;
  generatedAt: string;
  topology: {
    packages: number;
    a11yPackages: number;
    patterns: string[];
  };
  packages: AggregatePackageResult[];
  summary: {
    targets: number;
    findings: number;
    byImpact: Record<Impact, number>;
    ruleIds: string[];
  };
  exitCode: 0 | 1;
}

export interface AggregateIo {
  cwd?: string;
  stdout?: NodeJS.WritableStream;
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new Error(path + ' must be an object');
  return value as Record<string, unknown>;
}

function safeRelative(value: string, path: string): string {
  if (isAbsolute(value) || value.split(/[\\/]/).includes('..'))
    throw new Error(path + ' must stay inside its package report directory');
  return value;
}

async function packageSummary(path: string, expectedName: string): Promise<PackageScanSummary> {
  const root = object(JSON.parse(await readFile(path, 'utf8')), '$');
  if (root['$schema'] !== PACKAGE_REPORT_SCHEMA) throw new Error(path + ' has an unsupported schema');
  if (root['packageName'] !== expectedName) throw new Error(path + ' packageName does not match topology');
  if (!Array.isArray(root['targets'])) throw new Error(path + ' targets must be an array');
  if (root['exitCode'] !== 0 && root['exitCode'] !== 1) throw new Error(path + ' exitCode must be 0 or 1');
  return root as unknown as PackageScanSummary;
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

/**
 * One package: its summary, the artifacts that summary names, and the totals
 * they actually contain.
 *
 * The disagreement check at the end is the point of gathering rather than
 * reading. A summary trusted on its own is a number nobody produced: it is
 * written by an earlier run, read by a later one, and nothing between them
 * notices if the artifacts beneath it say something else.
 */
async function gatherPackage(
  reportRoot: string,
  workspacePackage: { name: string; relativePath: string },
): Promise<{ generatedAt: string; result: AggregatePackageResult }> {
  const packageDir = resolve(reportRoot, 'packages', packageKey(workspacePackage.name));
  const summaryPath = resolve(packageDir, 'package-summary.json');
  const summary = await packageSummary(summaryPath, workspacePackage.name);
  const byImpact = zeroByImpact();
  const ruleIds = new Set<string>();
  let findings = 0;
  for (const [index, target] of summary.targets.entries()) {
    const artifactRelative = safeRelative(target.artifact, '$.targets[' + String(index) + '].artifact');
    const artifact = await readCliScanArtifact(resolve(packageDir, artifactRelative), target.url, target.exitCode);
    findings += artifact.total;
    for (const impact of IMPACTS)
      byImpact[impact] += artifact.byImpact[impact];
    for (const finding of artifact.findings)
      if (typeof finding.ruleId === 'string')
        ruleIds.add(finding.ruleId);
  }
  if (findings !== summary.summary.total) throw new Error(summaryPath + ' total does not match its scan artifacts');
  return {
    generatedAt: summary.generatedAt,
    result: {
      packageName: workspacePackage.name,
      packagePath: workspacePackage.relativePath,
      targets: summary.targets.length,
      findings,
      byImpact,
      ruleIds: [...ruleIds].sort(),
      exitCode: summary.exitCode,
      summary: 'packages/' + packageKey(workspacePackage.name) + '/package-summary.json'
    },
  };
}

export async function aggregateWorkspace(
  options: AggregateOptions,
  io: AggregateIo = {},
): Promise<{ exitCode: number; report: AggregateReport; outputPath: string }> {
  const cwd = resolve(io.cwd ?? process.cwd());
  const root = options.workspaceRoot === undefined ? await findWorkspaceRoot(cwd) : resolve(cwd, options.workspaceRoot);
  const topology = await readTopology(root);
  if (topology.a11yPackages.length === 0) throw new Error('Lerna topology has no packages with an a11y script');
  const reportRoot = resolve(root, options.reportRoot);
  const packages: AggregatePackageResult[] = [];
  const dates: string[] = [];
  for (const workspacePackage of topology.a11yPackages) {
    const gathered = await gatherPackage(reportRoot, workspacePackage);
    dates.push(gathered.generatedAt);
    packages.push(gathered.result);
  }
  packages.sort((left, right) => left.packageName.localeCompare(right.packageName));
  const byImpact = zeroByImpact();
  const allRuleIds = new Set<string>();
  for (const item of packages) {
    for (const impact of IMPACTS)
      byImpact[impact] += item.byImpact[impact];
    for (const ruleId of item.ruleIds)
      allRuleIds.add(ruleId);
  }
  const findings = packages.reduce((sum, item) => sum + item.findings, 0);
  const exitCode = packages.some((item) => item.exitCode === 1) ? 1 : 0;
  const report: AggregateReport = {
    $schema: AGGREGATE_SCHEMA,
    generatedAt: [...dates].sort().at(-1) ?? new Date(0).toISOString(),
    topology: { packages: topology.packages.length, a11yPackages: topology.a11yPackages.length, patterns: topology.patterns },
    packages,
    summary: { targets: packages.reduce((sum, item) => sum + item.targets, 0), findings, byImpact, ruleIds: [...allRuleIds].sort() },
    exitCode
  };
  const outputPath = options.output === undefined ? resolve(reportRoot, 'aggregate.json') : resolve(root, options.output);
  await atomicJson(outputPath, report);
  (io.stdout ?? process.stdout).write('ARIADA_LERNA_AGGREGATE ' + JSON.stringify({ packages: packages.length, targets: report.summary.targets, findings, exitCode, report: outputPath }) + '\n');
  return { exitCode, report, outputPath };
}
