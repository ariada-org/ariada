// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/cli.js` and `dist/cli.d.ts`. The source this was built
// from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies are
// the compiled ones.
//
// This file is released from that comparison, and is no longer held by the
// comparison with that module. The argument walk came out of the compiler as one
// long chain of equality tests, flat enough to fail the complexity limit
// standing on publication, so while the comparison was its only support the
// package could not travel.
//
// The nineteen behavioural checks in the tests beside it were written while the
// comparison still held, and are the guarantee now. The release is recorded; a divergence reported by
// the rebuild check on this package is expected.
//
// THREE OUTCOMES, KEPT APART ON PURPOSE. A misuse of the command returns 2 with
// the help text; a run that failed returns 3; and 0 or 1 are the scan's own
// answer — clean, or violations at the chosen severity. A caller scripting this
// can therefore tell "you typed it wrong" from "it broke" from "the page has
// problems", which one exit code for all failure cannot.
//
// A value that begins with a dash is refused as that flag's argument, because it
// is a flag someone forgot to give a value to rather than a value meaning
// something odd. Reading it as a value is how a command quietly scans the wrong
// thing.
//
// Naming both an exported file and an address is an error rather than a
// preference silently applied: they are two different scans, and guessing which
// was meant produces a report about the one the caller was not asking for.
//
// Only a summary is printed, not the findings. The full artefact is on disk and
// its path is in the output; a command whose standard output is megabytes of
// findings is one nobody can pipe anywhere.
//
// The streams and the scanner are parameters with real defaults, which is what
// lets the whole command be exercised without a browser and without touching the
// process's own output.

import type { BeehiivScanDependencies, BeehiivScanOptions } from './contracts.js';
import {
  actualCliScannerRuntime,
  scanBeehiivExport,
  scanBeehiivUrl
} from './scanner.js';

const VERSION = '0.1.0';

export const HELP = `Usage:
  beehiiv-ariada [options] <public-beehiiv-url>
  beehiiv-ariada [options] --html <exported-post.html>

Options:
  --html <path>                 Scan exported Beehiiv post HTML
  --output-dir <path>           Artifact directory (default: ariada-beehiiv-output)
  --allow-custom-domain         Permit an explicit non-beehiiv.com publication host
  --browser <name>              chromium | firefox | webkit
  --severity-threshold <level>  minor | moderate | serious | critical
  --timeout-ms <ms>             1000..120000 (default: 30000)
  -h, --help                    Show help
  -V, --version                 Show version
`;

interface CliIo {
  readonly stdout: NodeJS.WritableStream;
  readonly stderr: NodeJS.WritableStream;
}

interface ParsedCommand {
  readonly action: 'help' | 'version' | 'html' | 'url';
  readonly value?: string;
  readonly options: BeehiivScanOptions;
}

class CliUsageError extends Error {
  override readonly name = 'CliUsageError';
}

function requiredValue(argv: readonly string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith('-')) {
    throw new CliUsageError(`${flag} requires a value`);
  }
  return value;
}

function parseTimeout(value: string): number {
  if (!/^\d+$/.test(value)) {
    throw new CliUsageError('--timeout-ms requires an integer');
  }
  return Number(value);
}

const BOOLEAN_FLAGS: Record<string, string> = { '--allow-custom-domain': 'allowCustomDomain' };
const VALUE_FLAGS: Record<string, string> = {
  '--output-dir': 'outputDir',
  '--browser': 'browser',
  '--severity-threshold': 'severityThreshold',
};

/**
 * One argument, applied.
 *
 * Returns how many arguments it consumed, so the walk stays a walk: a flag that
 * takes a value eats two, and the caller does not have to know which is which.
 */
function applyArgument(
  argv: readonly string[],
  index: number,
  argument: string,
  options: Record<string, unknown>,
): { consumed: number; htmlPath?: string } {
  if (argument in BOOLEAN_FLAGS) {
    options[BOOLEAN_FLAGS[argument] as string] = true;
    return { consumed: 1 };
  }
  if (argument === '--html') {
    return { consumed: 2, htmlPath: requiredValue(argv, index, argument) };
  }
  if (argument in VALUE_FLAGS) {
    options[VALUE_FLAGS[argument] as string] = requiredValue(argv, index, argument);
    return { consumed: 2 };
  }
  if (argument === '--timeout-ms') {
    options.timeoutMs = parseTimeout(requiredValue(argv, index, argument));
    return { consumed: 2 };
  }
  // A misspelled flag that is skipped produces a scan with a default nobody
  // chose, and the report says nothing about it.
  throw new CliUsageError(`Unknown option: ${argument}`);
}

/** Which target was named, refusing the combinations that cannot both be meant. */
function targetFrom(htmlPath: string | undefined, positionals: readonly string[], options: Record<string, unknown>): ParsedCommand {
  if (htmlPath !== undefined) {
    if (positionals.length > 0) {
      throw new CliUsageError('--html and a public URL are mutually exclusive');
    }
    return { action: 'html', value: htmlPath, options };
  }
  if (positionals.length !== 1) {
    throw new CliUsageError('Provide exactly one public Beehiiv URL or --html path');
  }
  const publicUrl = positionals[0];
  if (publicUrl === undefined) {
    throw new CliUsageError('Missing public Beehiiv URL');
  }
  return { action: 'url', value: publicUrl, options };
}

function parseArguments(argv: readonly string[]): ParsedCommand {
  const options: Record<string, unknown> = {};
  const positionals: string[] = [];
  let htmlPath: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === undefined) continue;
    if (argument === '-h' || argument === '--help') return { action: 'help', options };
    if (argument === '-V' || argument === '--version') return { action: 'version', options };
    if (!argument.startsWith('-')) {
      positionals.push(argument);
      continue;
    }
    const applied = applyArgument(argv, index, argument, options);
    if (applied.htmlPath !== undefined) htmlPath = applied.htmlPath;
    index += applied.consumed - 1;
  }
  return targetFrom(htmlPath, positionals, options);
}

// What actually went wrong, not only that something did.
//
// A scan that dies because no browser is installed used to print `Ariada runtime
// failed` and nothing else: the runtime's own message went into the wrapper's
// `cause`, and only the wrapper's message was printed. That is the wrapper
// saying it wrapped something. The reader then has to reproduce the run to learn
// what — which is the work the message exists to save.
//
// Causes nest, so the chain is walked; four is past any depth this wraps to and
// stops a self-referential chain from spinning. A cause repeating the message
// above it adds nothing and is skipped.
function describeFailure(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }
  const parts: string[] = [error.message];
  let current: unknown = error.cause;
  for (let depth = 0; depth < 4 && current instanceof Error; depth += 1) {
    const message = current.message.trim();
    if (message && !parts.includes(message)) {
      parts.push(message);
    }
    current = current.cause;
  }
  // A non-Error cause still carries the reason often enough to be worth printing.
  if (current !== undefined && current !== null && !(current instanceof Error)) {
    const tail = String(current).trim();
    if (tail && !parts.includes(tail)) {
      parts.push(tail);
    }
  }
  return parts.join(': ');
}

export async function runBeehiivCli(
  argv: readonly string[],
  io: CliIo = { stdout: process.stdout, stderr: process.stderr },
  dependencies: BeehiivScanDependencies = { runtime: actualCliScannerRuntime }
): Promise<0 | 1 | 2 | 3> {
  try {
    const parsed = parseArguments(argv);
    if (parsed.action === 'help') {
      io.stdout.write(HELP);
      return 0;
    }
    if (parsed.action === 'version') {
      io.stdout.write(`${VERSION}\n`);
      return 0;
    }
    const value = parsed.value;
    if (value === undefined) {
      throw new CliUsageError('Missing scan target');
    }
    const result = parsed.action === 'html'
      ? await scanBeehiivExport(value, parsed.options, dependencies)
      : await scanBeehiivUrl(value, parsed.options, dependencies);
    io.stdout.write(`${JSON.stringify({
      source: result.source,
      artifactPath: result.artifactPath,
      exitCode: result.exitCode,
      summary: result.artifact.summary
    })}\n`);
    return result.exitCode;
  }
  catch (error) {
    if (error instanceof CliUsageError) {
      io.stderr.write(`${error.message}\n${HELP}`);
      return 2;
    }
    io.stderr.write(`${describeFailure(error)}\n`);
    return 3;
  }
}
