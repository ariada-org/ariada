// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { Command, InvalidArgumentError } from 'commander';

import {
  runDiffClassify,
  runDiffGate,
  runDiffInspect,
  runDiffExplain,
  runDiffReplay,
  runDiffExempt,
} from './commands/diff/index.js';
import { CliError, emitError } from './errors.js';
import {
  EXIT_OK,
  EXIT_INVALID_ARGS,
  EXIT_RUNTIME_ERROR,
  type ExitCode,
} from './exit-codes.js';
import { runEstimatePenalty } from './subcommands/estimate-penalty.js';
import { runGenerateStatement } from './subcommands/generate-statement.js';
import { runListRules, type ListRulesOptions } from './subcommands/list-rules.js';
import {
  runMultiDomainScan,
  type MultiDomainScanOptions,
} from './subcommands/scan-multi-domain.js';
import { runVersion } from './subcommands/version.js';

/**
 *
 */
export interface RunOptions {
  stdout?: NodeJS.WritableStream;
  stderr?: NodeJS.WritableStream;
}

function parseTimeoutMs(value: string): number {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) {
    throw new InvalidArgumentError(`--timeout-ms must be a positive integer, got: ${value}`);
  }
  return n;
}

/** Map commander's parsed options to the multi-domain scan option shape. */
function buildMultiDomainOptions(opts: Record<string, unknown>): MultiDomainScanOptions {
  const out: MultiDomainScanOptions = {};
  if (typeof opts['domains'] === 'string') {
    out.domains = opts['domains'].split(',').map((d) => d.trim()).filter(Boolean);
  }
  if (typeof opts['config'] === 'string') out.config = opts['config'];
  if (typeof opts['outputDir'] === 'string') out.outputDir = opts['outputDir'];
  if (typeof opts['out'] === 'string') out.outputFile = opts['out'];
  if (typeof opts['format'] === 'string') {
    out.format = opts['format'] as 'human' | 'json' | 'both' | 'html';
  }
  if (typeof opts['browser'] === 'string') {
    out.browser = opts['browser'] as 'chromium' | 'firefox' | 'webkit';
  }
  if (typeof opts['severityThreshold'] === 'string') {
    out.severityThreshold = opts['severityThreshold'] as
      | 'minor'
      | 'moderate'
      | 'serious'
      | 'critical';
  }
  if (typeof opts['timeoutMs'] === 'number') out.timeoutMs = opts['timeoutMs'];
  return out;
}

/**
 * Build the root commander program. Exposed for snapshot tests of help output.
 */
export function buildProgram(
  stdout: NodeJS.WritableStream,
  stderr: NodeJS.WritableStream,
): { program: Command; exitCodeHolder: { code: ExitCode } } {
  const exitCodeHolder: { code: ExitCode } = { code: EXIT_OK };

  const program = new Command();
  program
    .name('ariada')
    .description(
      'ariada — accessibility scanner CLI. Scan URLs against WCAG 2.2 AA + EN 301 549.',
    )
    .version('0.1.0', '-V, --version', 'Print version and exit')
    .exitOverride(); // throw instead of process.exit so we can map to ExitCode

  // Suppress commander's default stdout/stderr writers, route through injected streams.
  program.configureOutput({
    writeOut: (str) => stdout.write(str),
    writeErr: (str) => stderr.write(str),
  });

  program
    .command('scan <url...>')
    .description(
      'Scan one or more URLs across every registered domain — accessibility ' +
        '(full WCAG 2.2 AA rule set + EN 301 549), privacy, security, ' +
        'sustainability, structured-data and ai-readiness — and render a combined ' +
        'report. Use --domains to narrow to a subset, e.g. ' +
        '--domains accessibility,privacy.',
    )
    .option('--output-dir <path>', 'Directory for machine-readable artefacts', './ariada-output')
    .option('--out <path>', 'Write the rendered HTML report to this file with --format html')
    .option(
      '--domains <list>',
      'Comma-separated domains for a multi-domain scan, e.g. accessibility,sustainability',
    )
    .option('--config <path>', 'Path to an ariada config that adds or pins domains')
    .option(
      '--browser <name>',
      'Browser engine: chromium | firefox | webkit',
      'chromium',
    )
    .option(
      '--format <name>',
      'Output format: human | json | both | html',
      'human',
    )
    .option(
      '--severity-threshold <level>',
      'Minimum severity that triggers non-zero exit: minor | moderate | serious | critical',
      'moderate',
    )
    .option('--timeout-ms <ms>', 'Per-URL navigation timeout in milliseconds', parseTimeoutMs, 30_000)
    .action(async (urls: string[], opts: Record<string, unknown>) => {
      // The default is the full multi-domain scan over every registered domain.
      // `--domains` narrows it to a subset; `buildMultiDomainOptions` reads that
      // option and leaves it undefined (meaning "all domains") when absent.
      exitCodeHolder.code = await runMultiDomainScan(
        urls,
        buildMultiDomainOptions(opts),
        stdout,
        stderr,
      );
    });

  program
    .command('list-rules')
    .description('List every registered rule with WCAG SC and severity')
    .option('--format <name>', 'Output format: human | json', 'human')
    .option('--pack <name>', 'Filter to pack: checkout | banking | statement | all', 'all')
    .action(async (opts: Record<string, unknown>) => {
      const listOpts: ListRulesOptions = {};
      if (typeof opts['format'] === 'string') {
        listOpts.format = opts['format'] as 'human' | 'json';
      }
      if (typeof opts['pack'] === 'string') {
        listOpts.pack = opts['pack'] as 'checkout' | 'banking' | 'statement' | 'all';
      }
      exitCodeHolder.code = await runListRules(listOpts, stdout, stderr);
    });

  program
    .command('version')
    .description('Print CLI version + linked @ariada-org/* + Node version')
    .action(async () => {
      exitCodeHolder.code = await runVersion(stdout, stderr);
    });

  program
    .command('generate-statement')
    .description('Stub — see @ariada-org/statement-generator package (exit 4)')
    .action(() => {
      exitCodeHolder.code = runGenerateStatement(stdout);
    });

  program
    .command('estimate-penalty')
    .description('Stub — see @ariada-org/penalty-estimator package (exit 4)')
    .action(() => {
      exitCodeHolder.code = runEstimatePenalty(stdout);
    });

  const diff = program
    .command('diff')
    .description('Differential accessibility CI gate — classify, gate, inspect, explain, replay, exempt');

  diff
    .command('classify')
    .description('Classify head vs base scan as new / pre_existing / resolved')
    .requiredOption('--head <path>', 'Path to head ScanEvent JSON')
    .requiredOption('--base <path>', 'Path to base ScanEvent JSON')
    .option('--engine <name>', 'Classifier: stub | canonical (canonical = SaaS)', 'stub')
    .option('--out <path>', 'Write DiffResult JSON to file (stdout if omitted)')
    .action(async (opts: Record<string, unknown>) => {
      const o: Record<string, unknown> = {
        head: opts['head'],
        base: opts['base'],
      };
      if (typeof opts['engine'] === 'string') o['engine'] = opts['engine'];
      if (typeof opts['out'] === 'string') o['out'] = opts['out'];
      exitCodeHolder.code = await runDiffClassify(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        o as any,
        stdout,
        stderr,
      );
    });

  diff
    .command('gate')
    .description('Apply a BaselinePolicy to a DiffResult and produce a GateDecision')
    .requiredOption('--diff <path>', 'Path to DiffResult JSON')
    .option('--policy <path>', 'Path to BaselinePolicy JSON (default policy if omitted)')
    .option('--out <path>', 'Write GateDecision JSON to file')
    .action(async (opts: Record<string, unknown>) => {
      const o: Record<string, unknown> = { diff: opts['diff'] };
      if (typeof opts['policy'] === 'string') o['policy'] = opts['policy'];
      if (typeof opts['out'] === 'string') o['out'] = opts['out'];
      exitCodeHolder.code = await runDiffGate(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        o as any,
        stdout,
        stderr,
      );
    });

  diff
    .command('inspect <diff>')
    .description('Human-readable summary of a DiffResult')
    .action(async (diffPath: string) => {
      exitCodeHolder.code = await runDiffInspect({ diff: diffPath }, stdout, stderr);
    });

  diff
    .command('explain <decision>')
    .description('Explain the resolution chain that produced a GateDecision')
    .option('--why <fingerprint>', 'Narrow to the reason that includes this fingerprint')
    .action(async (decisionPath: string, opts: Record<string, unknown>) => {
      const o: Record<string, unknown> = { decision: decisionPath };
      if (typeof opts['why'] === 'string') o['why'] = opts['why'];
      exitCodeHolder.code = await runDiffExplain(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        o as any,
        stdout,
        stderr,
      );
    });

  diff
    .command('replay')
    .description('Verify a stored DiffResult re-validates and emit policy-version status')
    .requiredOption('--diff <path>', 'Path to stored DiffResult JSON')
    .option('--policy-version <hash>', 'Expected policy_version_hash (SaaS replay only)')
    .action(async (opts: Record<string, unknown>) => {
      const o: Record<string, unknown> = { diff: opts['diff'] };
      if (typeof opts['policyVersion'] === 'string') o['policyVersion'] = opts['policyVersion'];
      exitCodeHolder.code = await runDiffReplay(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        o as any,
        stdout,
        stderr,
      );
    });

  const exempt = diff
    .command('exempt')
    .description('Exemption management (SaaS dashboard hosts the canonical registry)');

  exempt
    .command('list')
    .description('List active exemptions (SaaS-hosted; OSS CLI prints a dashboard pointer)')
    .action(async () => {
      exitCodeHolder.code = await runDiffExempt({ action: 'list' }, stdout, stderr);
    });

  exempt
    .command('revoke <fingerprint>')
    .description('Revoke an exemption (SaaS dashboard hosts the registry)')
    .action(async (fp: string) => {
      exitCodeHolder.code = await runDiffExempt({ action: 'revoke', fingerprint: fp }, stdout, stderr);
    });

  return { program, exitCodeHolder };
}

/**
 * Main testable entry point: parses argv, dispatches to subcommand, returns
 * the resolved ExitCode. Never calls process.exit() so unit tests can run.
 */
export async function run(
  argv: readonly string[],
  options: RunOptions = {},
): Promise<ExitCode> {
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const { program, exitCodeHolder } = buildProgram(stdout, stderr);

  try {
    // commander expects ['node', 'script', ...args]; we receive only the user args.
    await program.parseAsync(['node', 'ariada', ...argv]);
    return exitCodeHolder.code;
  } catch (err) {
    // commander throws a CommanderError on --help, --version, parse failures.
    const e = err as { code?: string; exitCode?: number; message?: string };
    if (e.code === 'commander.helpDisplayed' || e.code === 'commander.help') {
      return EXIT_OK;
    }
    if (e.code === 'commander.version') {
      return EXIT_OK;
    }
    if (
      e.code === 'commander.missingArgument' ||
      e.code === 'commander.unknownCommand' ||
      e.code === 'commander.unknownOption' ||
      e.code === 'commander.invalidArgument' ||
      e.code === 'commander.missingMandatoryOptionValue' ||
      e.code === 'commander.optionMissingArgument'
    ) {
      emitError(
        new CliError('E_INVALID_OPTION', e.message ?? 'Argument parser rejected the invocation'),
        stderr,
      );
      return EXIT_INVALID_ARGS;
    }
    emitError(
      new CliError('E_INTERNAL', err instanceof Error ? err.message : String(err)),
      stderr,
    );
    return EXIT_RUNTIME_ERROR;
  }
}
