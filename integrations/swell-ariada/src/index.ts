// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/index.js` and `dist/index.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies are
// the compiled ones. Checked with
// the rebuild check.
//
// THE STOREFRONT ADDRESS IS LOOKED FOR IN FOUR PLACES because the platform has
// written it in four over time, and a configuration from any era should still
// work. The first one that is a usable address wins — and "usable" is checked
// rather than assumed: an absolute http or https address with no credentials in
// it, because this value is handed to a scanner process and would end up in its
// diagnostics.
//
// A FINDING IS ACCEPTED IN WHATEVER SHAPE IT ARRIVES. The rule identifier may be
// `ruleId` or `id`; the severity may be `severity` or `impact`; the regulatory
// mapping may be `eaaMapping`, `en301549` or `en301549Criteria`, and may be one
// string or a list of them. Each is normalised to one shape here, so the rest of
// the module reads one vocabulary rather than a union of three.
//
// An unrecognised severity becomes `serious` rather than the lowest. Guessing
// low would let a real problem past a threshold; guessing high at worst makes
// somebody look.
//
// EXIT ONE IS A VERDICT, NOT A FAILURE. The scanner answers nought when the page
// passed and one when it did not; anything else means it did not get as far as
// answering, and that is raised as an error rather than reported as a failing
// storefront. A caller that treats them alike sends somebody to fix a page when
// the tool would not start.
//
// The ten shown first are sorted by severity and then by rule identifier, so two
// runs over the same page list them in the same order — a report that reshuffles
// itself between runs cannot be diffed.

import { spawn } from 'node:child_process';

export type Severity = 'minor' | 'moderate' | 'serious' | 'critical';
export type ScanStatus = 'passed' | 'failed';

export interface SwellStoreConfig {
  storefrontUrl?: unknown;
  frontendUrl?: unknown;
  storefront?: { url?: unknown };
  frontend?: { url?: unknown };
  outputDir?: string;
}

export interface SwellApiClient {
  getStore(): Promise<unknown>;
}

export interface SwellFinding {
  message: string;
  ruleId: string;
  severity: Severity;
  eaaRelevant: boolean;
  eaaMapping: string[];
}

export interface SwellScanResult {
  target: string;
  status: ScanStatus;
  findingCount: number;
  topViolations: SwellFinding[];
  findings: SwellFinding[];
  reportUrl?: string;
  exitCode: number;
}

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export type CommandRunner = (command: string, args: string[]) => Promise<CommandResult>;

export interface ScanDependencies {
  run?: CommandRunner;
  cliBinary?: string;
}

const severityRank: Record<Severity, number> = { critical: 4, serious: 3, moderate: 2, minor: 1 };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function validUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function resolveSwellStorefrontUrl(config: SwellStoreConfig): string {
  const candidates = [
    config.storefrontUrl,
    config.frontendUrl,
    config.storefront?.url,
    config.frontend?.url,
  ];
  const url = candidates.find(validUrl);
  if (!url) throw new Error('Swell config does not contain a valid storefront URL');
  return url;
}

export async function readSwellStorefrontUrl(client: SwellApiClient): Promise<string> {
  const store = await client.getStore();
  if (!isRecord(store)) throw new Error('Swell API returned an invalid store object');
  return resolveSwellStorefrontUrl(store);
}

function asSeverity(value: unknown): Severity {
  return value === 'critical' || value === 'serious' || value === 'moderate' || value === 'minor'
    ? value
    : 'serious';
}

function asStringList(value: unknown): string[] {
  if (typeof value === 'string' && value.length > 0) return [value];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : [];
}

function normalizeFinding(value: unknown): SwellFinding | undefined {
  if (!isRecord(value)) return undefined;
  const eaaMapping = asStringList(
    value['eaaMapping'] ?? value['en301549'] ?? value['en301549Criteria'],
  );
  const eaaRelevant = value['eaaRelevant'] === true || eaaMapping.length > 0;
  return {
    message: typeof value['message'] === 'string' ? value['message'] : 'Accessibility finding',
    ruleId: String(value['ruleId'] ?? value['id'] ?? 'ariada/unknown'),
    severity: asSeverity(value['severity'] ?? value['impact']),
    eaaRelevant,
    eaaMapping,
  };
}

function extractFindings(report: unknown): unknown[] {
  if (!isRecord(report)) throw new Error('Ariada output must be a JSON object');
  if (Array.isArray(report['findings'])) return report['findings'];
  const grid = report['grid'];
  if (!isRecord(grid)) return [];
  return Object.values(grid).flatMap((site) => {
    if (!isRecord(site)) return [];
    return Object.values(site).flatMap((domain) => (Array.isArray(domain) ? domain : []));
  });
}

export function parseSwellScanResult(
  raw: unknown,
  target: string,
  exitCode: number,
): SwellScanResult {
  const report = isRecord(raw) ? raw : {};
  const findings = extractFindings(report).flatMap((item) => {
    const finding = normalizeFinding(item);
    return finding ? [finding] : [];
  });
  const topViolations = [...findings]
    .sort(
      (a, b) =>
        severityRank[b.severity] - severityRank[a.severity] || a.ruleId.localeCompare(b.ruleId),
    )
    .slice(0, 10);
  return {
    target,
    status: findings.length === 0 ? 'passed' : 'failed',
    findingCount: findings.length,
    topViolations,
    findings,
    ...(typeof report['reportUrl'] === 'string' ? { reportUrl: report['reportUrl'] } : {}),
    exitCode,
  };
}

export function createSwellScanArgs(url: string, outputDir = 'ariada-swell-output'): string[] {
  if (!validUrl(url)) throw new Error('Swell storefront URL must be an absolute HTTP(S) URL');
  return ['scan', url, '--domains', 'accessibility', '--format', 'json', '--output-dir', outputDir];
}

export async function scanSwellStorefront(
  config: SwellStoreConfig,
  dependencies: ScanDependencies = {},
): Promise<SwellScanResult> {
  const target = resolveSwellStorefrontUrl(config);
  const args = createSwellScanArgs(target, config.outputDir);
  const cliBinary = dependencies.cliBinary ?? process.env['ARIADA_CLI_BIN'];
  const command = cliBinary ?? 'npx';
  const commandArgs = cliBinary ? args : ['--yes', '@ariada-org/cli', ...args];
  const result = await (dependencies.run ?? runCommand)(command, commandArgs);
  if (result.exitCode !== 0 && result.exitCode !== 1)
    throw new Error(`Ariada CLI failed with exit ${result.exitCode}: ${result.stderr.trim()}`);
  let raw: unknown;
  try {
    raw = JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`Ariada CLI did not return JSON: ${String(error)}`);
  }
  return parseSwellScanResult(raw, target, result.exitCode);
}

function runCommand(command: string, args: string[]): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (exitCode) => resolve({ exitCode: exitCode ?? 2, stdout, stderr }));
  });
}
