// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

/** Severity level that makes the shared Ariada CLI return a failing status. */
export type AriadaSeverity = 'minor' | 'moderate' | 'serious' | 'critical';

/** Browser engine accepted by the shared Ariada CLI scan command. */
export type AriadaBrowser = 'chromium' | 'firefox' | 'webkit';

/** Output format accepted by the shared Ariada CLI scan command. */
export type AriadaOutputFormat = 'human' | 'json' | 'both';

/** Options used to build a delegated `@ariada-org/cli` scan command. */
export interface AriadaScanCommandOptions {
  target: string;
  packageVersion?: string;
  outputDir?: string;
  domains?: readonly string[];
  browser?: AriadaBrowser;
  format?: AriadaOutputFormat;
  severityThreshold?: AriadaSeverity;
  timeoutMs?: number;
}

/** Shell command shape returned to Deno or TypeScript consumers. */
export interface AriadaCliCommand {
  command: 'npx';
  args: readonly string[];
  display: string;
}

function quoteShellArg(value: string): string {
  if (/^[A-Za-z0-9_./:@=-]+$/.test(value)) return value;
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function pushOption(args: string[], name: string, value: string | number | undefined): void {
  if (value === undefined || value === '') return;
  args.push(name, String(value));
}

/** Build the argument vector for `npx @ariada-org/cli scan`. */
export function buildAriadaCliArgs(options: AriadaScanCommandOptions): string[] {
  if (!options.target) {
    throw new Error('Ariada JSR adapter requires a target URL.');
  }

  const packageSpec = `@ariada-org/cli@${options.packageVersion ?? 'latest'}`;
  const args = ['--yes', packageSpec, 'scan', options.target];
  pushOption(args, '--output-dir', options.outputDir);
  pushOption(args, '--browser', options.browser);
  pushOption(args, '--format', options.format);
  pushOption(args, '--severity-threshold', options.severityThreshold);
  pushOption(args, '--timeout-ms', options.timeoutMs);

  if (options.domains && options.domains.length > 0) {
    args.push('--domains', options.domains.join(','));
  }

  return args;
}

/** Build a displayable `npx` command that delegates scanning to Ariada CLI. */
export function buildAriadaNpxCommand(options: AriadaScanCommandOptions): AriadaCliCommand {
  const args = buildAriadaCliArgs(options);
  return {
    command: 'npx',
    args,
    display: ['npx', ...args].map(quoteShellArg).join(' '),
  };
}

/** Render a minimal `deno.json` task block for running Ariada from a JSR project. */
export function buildDenoTaskSnippet(options: AriadaScanCommandOptions): string {
  const command = buildAriadaNpxCommand(options);
  return JSON.stringify({ tasks: { 'ariada:scan': command.display } }, null, 2);
}
