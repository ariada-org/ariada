// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/arguments.js` and `dist/arguments.d.ts`. The source this
// was built from was never committed; the compiled output is `tsc` with the
// types stripped, so the shapes come back from the declaration file and the
// bodies are the compiled ones.
//
// It has since been released from that comparison, and that sentence is kept on
// one line because the guard reads for it literally.
//
// HOW IT IS HELD NOW. While the comparison still matched — while this was
// provably the shipped module — sixteen behaviour tests were written against it,
// and only then did the option reader change shape. It was the most tangled
// thing in the recovered set, thirty-six against a limit of fifteen, and almost
// all of that was one question asked seven times: whether the option belongs to
// the command being run. Asked once, in its own function, the rest reads as what
// it is.
//
// The tests were checked against damage rather than trusted. Stop checking the
// shape of an environment-variable name, accept an option belonging to the other
// command, treat an empty value after an equals sign as absent, drop the
// requirement that a scan has something to scan, or read a flag as a value — and
// each fails a test that passes otherwise.
//
// The guarantee lives in `tests/scripts/recovered-lerna-arguments.test.ts`, and
// the release is recorded in `tests/scripts/vypushchennye-iz-slicheniya.txt`.
//
// AN OPTION THAT BELONGS TO ONE COMMAND IS REFUSED FOR THE OTHER, BY NAME. It
// would be shorter to accept everything and ignore what does not apply; then
// `aggregate --browser firefox` would run and report under a browser nobody
// used. Refusing says which option and which command, so the mistake is over in
// one reading.
//
// A TARGET MAY BE NAMED BY AN ENVIRONMENT VARIABLE, AND THE NAME IS CHECKED
// AGAINST A SHAPE. This is how a workspace scans an address it does not want
// written into a command line — a preview deployment, an internal host. The
// name must look like an environment variable and nothing else, so the option
// cannot be turned into a way to read whatever the process happens to hold.
//
// Both `--option value` and `--option=value` are accepted, because both are
// written, and an empty value after the equals sign is refused rather than
// treated as absent: somebody meant to pass something.
//
// The usage error carries its own exit code. Two means the command line was
// wrong, which is a different thing from a scan that found problems, and a
// pipeline branches on the difference.

export const PACKAGE_VERSION = '0.1.0';
export const BROWSERS = ['chromium', 'firefox', 'webkit'] as const;
export const SEVERITIES = ['minor', 'moderate', 'serious', 'critical'] as const;

export type BrowserName = (typeof BROWSERS)[number];
export type Severity = (typeof SEVERITIES)[number];

export interface ScanOptions {
  targets: string[];
  targetEnvs: string[];
  reportRoot: string;
  workspaceRoot?: string;
  browser: BrowserName;
  severityThreshold: Severity;
  timeoutMs: number;
}

export interface AggregateOptions {
  reportRoot: string;
  workspaceRoot?: string;
  output?: string;
}

export type ParsedArguments =
  | { kind: 'help' }
  | { kind: 'version' }
  | { kind: 'scan'; options: ScanOptions }
  | { kind: 'aggregate'; options: AggregateOptions };

export class UsageError extends Error {
  readonly exitCode = 2;
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}

function valueAt(argv: readonly string[], index: number, option: string): { value: string; index: number } {
  const token = argv[index];
  if (token === undefined) throw new UsageError(option + ' requires a value');
  const equals = token.indexOf('=');
  if (equals !== -1) {
    const value = token.slice(equals + 1);
    if (value.length === 0) throw new UsageError(option + ' requires a value');
    return { value, index };
  }
  const value = argv[index + 1];
  if (value === undefined || value.startsWith('--')) throw new UsageError(option + ' requires a value');
  return { value, index: index + 1 };
}

function choice<T extends string>(value: string, values: readonly T[], option: string): T {
  if (!values.includes(value as T)) throw new UsageError(option + ' must be one of: ' + values.join(', '));
  return value as T;
}

const SCAN_ONLY = new Set([
  '--target',
  '--target-env',
  '--browser',
  '--severity-threshold',
  '--timeout-ms',
]);
const AGGREGATE_ONLY = new Set(['--output']);

/**
 * Refuse an option that belongs to the other command, by name.
 *
 * Gathered here rather than repeated in every branch, which is what it was:
 * the same question asked seven times made the reader harder to follow than the
 * rule it enforces. The rule itself is unchanged — accepting an option and
 * ignoring it would let `aggregate --browser firefox` run and report under a
 * browser nobody used.
 */
function assertBelongs(name: string, command: 'scan' | 'aggregate'): void {
  if (SCAN_ONLY.has(name) && command !== 'scan')
    throw new UsageError(name + ' is only valid for scan');
  if (AGGREGATE_ONLY.has(name) && command !== 'aggregate')
    throw new UsageError(name + ' is only valid for aggregate');
}

/** A timeout, or a refusal naming what it should have been. */
function positiveTimeout(value: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > 2_147_483_647)
    throw new UsageError('--timeout-ms must be a positive safe integer');
  return parsed;
}

function commandOptions(argv: readonly string[], command: 'scan'): ScanOptions;
function commandOptions(argv: readonly string[], command: 'aggregate'): AggregateOptions;
function commandOptions(argv: readonly string[], command: 'scan' | 'aggregate'): ScanOptions | AggregateOptions {
  const targets: string[] = [];
  const targetEnvs: string[] = [];
  let reportRoot = 'ariada-output';
  let workspaceRoot: string | undefined;
  let output: string | undefined;
  let browser: BrowserName = 'chromium';
  let severityThreshold: Severity = 'moderate';
  let timeoutMs = 30_000;
  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === undefined || !token.startsWith('--')) throw new UsageError('Unexpected argument: ' + String(token));
    const name = token.split('=', 1)[0] ?? token;
    const resolved = valueAt(argv, index, name);
    index = resolved.index;
    assertBelongs(name, command);
    switch (name) {
      case '--target':
        targets.push(resolved.value);
        break;
      case '--target-env':
        if (!/^[A-Z_][A-Z0-9_]*$/.test(resolved.value))
          throw new UsageError('--target-env must be an uppercase environment variable name');
        targetEnvs.push(resolved.value);
        break;
      case '--report-root':
        reportRoot = resolved.value;
        break;
      case '--workspace-root':
        workspaceRoot = resolved.value;
        break;
      case '--output':
        output = resolved.value;
        break;
      case '--browser':
        browser = choice(resolved.value, BROWSERS, name);
        break;
      case '--severity-threshold':
        severityThreshold = choice(resolved.value, SEVERITIES, name);
        break;
      case '--timeout-ms':
        timeoutMs = positiveTimeout(resolved.value);
        break;
      default: throw new UsageError('Unknown option: ' + name);
    }
  }
  if (command === 'scan') {
    if (targets.length + targetEnvs.length === 0) throw new UsageError('scan requires --target or --target-env');
    return { targets, targetEnvs, reportRoot, ...(workspaceRoot === undefined ? {} : { workspaceRoot }), browser, severityThreshold, timeoutMs };
  }
  return { reportRoot, ...(workspaceRoot === undefined ? {} : { workspaceRoot }), ...(output === undefined ? {} : { output }) };
}

export function parseArguments(argv: readonly string[]): ParsedArguments {
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') return { kind: 'help' };
  if (argv[0] === '--version' || argv[0] === '-V') return { kind: 'version' };
  if (argv[0] === 'scan') return { kind: 'scan', options: commandOptions(argv, 'scan') };
  if (argv[0] === 'aggregate') return { kind: 'aggregate', options: commandOptions(argv, 'aggregate') };
  throw new UsageError('Expected command scan or aggregate');
}

export function helpText(): string {
  return [
    'lerna-ariada - Ariada CLI glue for Lerna workspaces', '',
    'Usage:',
    '  lerna-ariada scan (--target URL | --target-env NAME) [options]',
    '  lerna-ariada aggregate [options]', '',
    'Scan options:',
    '  --target URL                  URL to scan; repeatable',
    '  --target-env NAME             Read a target URL from an allow-listed env name',
    '  --browser NAME                chromium | firefox | webkit',
    '  --severity-threshold LEVEL    minor | moderate | serious | critical',
    '  --timeout-ms NUMBER           Per-target timeout, default 30000', '',
    'Shared options:',
    '  --workspace-root PATH         Lerna root; otherwise discovered upward',
    '  --report-root PATH            Shared report directory, default ariada-output',
    '  --output PATH                 Aggregate JSON path',
    '  -h, --help                    Show help',
    '  -V, --version                 Show version', ''
  ].join('\n');
}
