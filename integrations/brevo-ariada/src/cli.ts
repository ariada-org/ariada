#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/cli.js` and `dist/cli.d.ts`. The source this was built
// from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies
// are the compiled ones. It is released from that comparison: the digest no
// longer has to match, and what holds this file now is the behaviour described
// in the tests beside it, written while the comparison
// still agreed, so it describes the code that ships rather than the intent
// behind it.
//
// THE API KEY IS NEVER A COMMAND-LINE VALUE. `--api-key-env` names an
// environment variable; the key itself is read from the environment. A key
// passed as an argument is visible to every other process on the machine
// through the process list, and it survives in shell history — neither of which
// the person typing it expects. The flag's value is checked against the shape of
// an environment variable name rather than used as given, so it cannot be bent
// into something else.
//
// EVERY OPTION IS CHECKED HERE RATHER THAN PASSED ALONG. The allowed names are a
// closed set; an unknown one is refused instead of ignored, because an ignored
// option is a request the caller believes was honoured. Repeating an option is
// refused for the same reason: last-wins is a silent choice between two things
// the caller asked for.
//
// THE EXIT CODES SEPARATE THREE DIFFERENT ANSWERS. The scan's own verdict comes
// back as 0 or 1 — the page passed the threshold, or it did not. A malformed
// invocation answers 2, and anything else that went wrong answers 3. A caller
// wiring this into a build can then tell "the page has problems" apart from "the
// command could not be run", which a single non-zero code would merge.

import type { BrevoScanInput, BrevoScanOptions } from './brevo.js';
import { scanBrevo } from './brevo.js';
import { type Severity } from './cli-scan.js';
import { type BrowserName } from './scanner.js';

const HELP = `Brevo Ariada scan recipe

Usage:
  brevo-ariada landing-url <public-url> [options]
  brevo-ariada campaign-webview-url <public-url> [options]
  brevo-ariada campaign-html <exported-html-path> [options]
  brevo-ariada campaign-api <campaign-id> [options]

Options:
  --browser <chromium|firefox|webkit>          Default: chromium
  --severity-threshold <minor|moderate|serious|critical>
                                               Default: moderate
  --timeout-ms <positive-integer>              Default: 30000
  --process-timeout-ms <positive-integer>      Default: timeout + 30000
  --output-dir <path>                          Keep cli-scan.v1 scan.json
  --api-key-env <environment-variable>         Default: BREVO_API_KEY
  --help

API keys are read from the environment and are never accepted as CLI values.
`;

class UsageError extends Error {
  override readonly name = 'UsageError';
}

interface ParsedArguments {
  readonly mode: string;
  readonly value: string;
  readonly flags: Map<string, string>;
}

const ALLOWED_FLAGS = new Set([
  '--browser',
  '--severity-threshold',
  '--timeout-ms',
  '--process-timeout-ms',
  '--output-dir',
  '--api-key-env',
]);

/**
 * The name of one option, in either spelling: `--name value` or `--name=value`.
 * Only the name — the value is read by the caller, because an unknown name has
 * to be refused before anything is read on its behalf.
 */
function flagNameAt(candidate: string | undefined): {
  readonly name: string;
  readonly inlineValue: string | undefined;
} {
  if (candidate === undefined || !candidate.startsWith('--')) {
    throw new UsageError(`Unexpected positional argument: ${candidate ?? ''}`);
  }
  const separator = candidate.indexOf('=');
  const name = separator === -1 ? candidate : candidate.slice(0, separator);
  const inlineValue = separator === -1 ? undefined : candidate.slice(separator + 1);
  if (!ALLOWED_FLAGS.has(name)) throw new UsageError(`Unknown option: ${name}`);
  return { name, inlineValue };
}

/**
 * Every option after the mode and its target. A repeat is refused rather than
 * resolved: last-wins is a silent choice between two things the caller asked
 * for, and the caller never learns which one was taken. That refusal comes
 * before the value is read, so a repeated option is named as repeated rather
 * than as missing its value.
 */
function flagsAt(args: readonly string[]): Map<string, string> {
  const flags = new Map<string, string>();
  for (let index = 2; index < args.length; index += 1) {
    const { name, inlineValue } = flagNameAt(args[index]);
    if (flags.has(name)) throw new UsageError(`Duplicate option: ${name}`);
    const next = inlineValue ?? args[index + 1];
    if (next === undefined || next.length === 0 || next.startsWith('--')) {
      throw new UsageError(`${name} requires a value`);
    }
    flags.set(name, next);
    if (inlineValue === undefined) index += 1;
  }
  return flags;
}

function parseArguments(args: readonly string[]): ParsedArguments {
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(HELP);
    throw new UsageError('__help__');
  }
  const mode = args[0];
  const value = args[1];
  if (
    mode === undefined ||
    value === undefined ||
    mode.startsWith('--') ||
    value.startsWith('--')
  ) {
    throw new UsageError('A mode and target value are required');
  }
  return { mode, value, flags: flagsAt(args) };
}

function browserAt(value: string | undefined): BrowserName | undefined {
  if (value === undefined) return undefined;
  if (value === 'chromium' || value === 'firefox' || value === 'webkit') return value;
  throw new UsageError('--browser must be chromium, firefox, or webkit');
}

function severityAt(value: string | undefined): Severity | undefined {
  if (value === undefined) return undefined;
  if (value === 'critical' || value === 'serious' || value === 'moderate' || value === 'minor') {
    return value;
  }
  throw new UsageError('--severity-threshold is invalid');
}

function positiveIntegerAt(value: string | undefined, name: string): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new UsageError(`${name} must be a positive integer`);
  }
  return parsed;
}

function apiKeyEnvironmentAt(value: string | undefined): string {
  const selected = value ?? 'BREVO_API_KEY';
  if (!/^[A-Z_][A-Z0-9_]*$/.test(selected)) {
    throw new UsageError('--api-key-env must name an uppercase environment variable');
  }
  return selected;
}

function inputAt(parsed: ParsedArguments): BrevoScanInput {
  if (parsed.mode === 'landing-url') return { kind: 'landing-url', url: parsed.value };
  if (parsed.mode === 'campaign-webview-url') {
    return { kind: 'campaign-webview-url', url: parsed.value };
  }
  if (parsed.mode === 'campaign-html') return { kind: 'campaign-html', path: parsed.value };
  if (parsed.mode === 'campaign-api') {
    const campaignId = positiveIntegerAt(parsed.value, 'campaign-id');
    if (campaignId === undefined) throw new UsageError('campaign-id is required');
    const environmentName = apiKeyEnvironmentAt(parsed.flags.get('--api-key-env'));
    const apiKey = process.env[environmentName];
    if (apiKey === undefined || apiKey.length === 0) {
      throw new UsageError(`${environmentName} is required for campaign-api mode`);
    }
    return { kind: 'campaign-api', campaignId, apiKey };
  }
  throw new UsageError(`Unknown mode: ${parsed.mode}`);
}

function optionsAt(parsed: ParsedArguments): BrevoScanOptions {
  const browser = browserAt(parsed.flags.get('--browser'));
  const severityThreshold = severityAt(parsed.flags.get('--severity-threshold'));
  const timeoutMs = positiveIntegerAt(parsed.flags.get('--timeout-ms'), '--timeout-ms');
  const processTimeoutMs = positiveIntegerAt(
    parsed.flags.get('--process-timeout-ms'),
    '--process-timeout-ms',
  );
  const outputDir = parsed.flags.get('--output-dir');
  return {
    ...(browser === undefined ? {} : { browser }),
    ...(severityThreshold === undefined ? {} : { severityThreshold }),
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
    ...(processTimeoutMs === undefined ? {} : { processTimeoutMs }),
    ...(outputDir === undefined ? {} : { outputDir }),
  };
}

async function main(args: readonly string[]): Promise<number> {
  try {
    const parsed = parseArguments(args);
    const result = await scanBrevo(inputAt(parsed), optionsAt(parsed));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result.gate.exitCode;
  } catch (error) {
    if (error instanceof UsageError && error.message === '__help__') return 0;
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    if (error instanceof UsageError) {
      process.stderr.write('Run brevo-ariada --help for usage.\n');
      return 2;
    }
    return 3;
  }
}

process.exitCode = await main(process.argv.slice(2));
