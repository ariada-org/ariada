// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  AzureSwaAriadaError,
  BROWSERS,
  MODES,
  SEVERITIES,
  runAzureSwaAriada,
  type Browser,
  type IntegrationMode,
  type IntegrationOptions,
  type Severity,
} from './index.js';

const HELP = `azure-swa-ariada

Usage:
  azure-swa-ariada [options]

Options:
  --config <path>                 JSON configuration file
  --preview-url <url>             Azure Static Web Apps deployed URL
  --build-output <path>           Directory for scan and integration reports
  --mode <gate|report>            Block or report threshold violations
  --severity-threshold <level>    minor, moderate, serious, or critical
  --browser <name>                chromium, firefox, or webkit
  --timeout-ms <number>           Ariada navigation timeout
  --ariada-command <path>         Ariada executable (default: ariada)
  -h, --help                      Show this help
`;

interface CliOptions extends IntegrationOptions {
  readonly configPath?: string;
  readonly help?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readValue(argv: readonly string[], index: number, flag: string): string {
  const value = argv[index + 1];
  // A flag where a value should be means the value was forgotten, not that the
  // next flag is the value.
  if (value === undefined || value.startsWith('--')) {
    throw new AzureSwaAriadaError('E_ARGUMENT_INVALID', `${flag} requires a value.`);
  }
  return value;
}

function parseEnum<T extends string>(value: string, allowed: readonly T[], flag: string): T {
  if (!(allowed as readonly string[]).includes(value)) {
    throw new AzureSwaAriadaError('E_ARGUMENT_INVALID', `${flag} must be one of: ${allowed.join(', ')}.`);
  }
  return value as T;
}

function parseTimeout(value: string): number {
  if (!/^\d+$/u.test(value)) {
    throw new AzureSwaAriadaError('E_ARGUMENT_INVALID', '--timeout-ms must be a positive integer.');
  }
  const timeoutMs = Number(value);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new AzureSwaAriadaError('E_ARGUMENT_INVALID', '--timeout-ms must be a positive integer.');
  }
  return timeoutMs;
}

/** The flags, as given. Nothing is defaulted here; that happens once, further in. */
export function parseCliArgs(argv: readonly string[]): CliOptions {
  const options: Record<string, unknown> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    switch (flag) {
      case '-h':
      case '--help':
        options['help'] = true;
        break;
      case '--config':
        options['configPath'] = readValue(argv, index, flag);
        index += 1;
        break;
      case '--preview-url':
        options['previewUrl'] = readValue(argv, index, flag);
        index += 1;
        break;
      case '--build-output':
        options['buildOutput'] = readValue(argv, index, flag);
        index += 1;
        break;
      case '--mode':
        options['mode'] = parseEnum<IntegrationMode>(readValue(argv, index, flag), MODES, flag);
        index += 1;
        break;
      case '--severity-threshold':
        options['severityThreshold'] = parseEnum<Severity>(readValue(argv, index, flag), SEVERITIES, flag);
        index += 1;
        break;
      case '--browser':
        options['browser'] = parseEnum<Browser>(readValue(argv, index, flag), BROWSERS, flag);
        index += 1;
        break;
      case '--timeout-ms':
        options['timeoutMs'] = parseTimeout(readValue(argv, index, flag));
        index += 1;
        break;
      case '--ariada-command':
        options['ariadaCommand'] = readValue(argv, index, flag);
        index += 1;
        break;
      default:
        throw new AzureSwaAriadaError('E_ARGUMENT_INVALID', `Unknown option: ${String(flag)}`);
    }
  }
  return options as CliOptions;
}

function optionalString(config: Record<string, unknown>, key: string): string | undefined {
  const value = config[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AzureSwaAriadaError('E_CONFIG_INVALID', `${key} must be a non-empty string.`);
  }
  return value;
}

/**
 * A key nobody recognises is refused rather than ignored: a misspelled setting
 * that is silently dropped looks exactly like a setting that had no effect.
 */
export function parseConfigJson(raw: string): IntegrationOptions {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AzureSwaAriadaError('E_CONFIG_INVALID', 'The configuration file is not valid JSON.');
  }
  if (!isRecord(parsed)) {
    throw new AzureSwaAriadaError('E_CONFIG_INVALID', 'The configuration file must contain an object.');
  }

  const allowedKeys = new Set([
    'previewUrl',
    'buildOutput',
    'mode',
    'severityThreshold',
    'browser',
    'timeoutMs',
    'ariadaCommand',
  ]);
  const unknownKey = Object.keys(parsed).find((key) => !allowedKeys.has(key));
  if (unknownKey !== undefined) {
    throw new AzureSwaAriadaError('E_CONFIG_INVALID', `Unknown configuration key: ${unknownKey}`);
  }

  const modeValue = optionalString(parsed, 'mode');
  const severityValue = optionalString(parsed, 'severityThreshold');
  const browserValue = optionalString(parsed, 'browser');
  const timeoutValue = parsed['timeoutMs'];
  if (timeoutValue !== undefined && (!Number.isSafeInteger(timeoutValue) || Number(timeoutValue) <= 0)) {
    throw new AzureSwaAriadaError('E_CONFIG_INVALID', 'timeoutMs must be a positive integer.');
  }

  return {
    ...(optionalString(parsed, 'previewUrl') === undefined
      ? {}
      : { previewUrl: optionalString(parsed, 'previewUrl') as string }),
    ...(optionalString(parsed, 'buildOutput') === undefined
      ? {}
      : { buildOutput: optionalString(parsed, 'buildOutput') as string }),
    ...(modeValue === undefined ? {} : { mode: parseEnum<IntegrationMode>(modeValue, MODES, 'mode') }),
    ...(severityValue === undefined
      ? {}
      : { severityThreshold: parseEnum<Severity>(severityValue, SEVERITIES, 'severityThreshold') }),
    ...(browserValue === undefined ? {} : { browser: parseEnum<Browser>(browserValue, BROWSERS, 'browser') }),
    ...(timeoutValue === undefined ? {} : { timeoutMs: Number(timeoutValue) }),
    ...(optionalString(parsed, 'ariadaCommand') === undefined
      ? {}
      : { ariadaCommand: optionalString(parsed, 'ariadaCommand') as string }),
  };
}

/**
 * Two is the caller's mistake, three is ours or the scanner's. A pipeline can
 * tell "you asked for something impossible" from "the scan did not happen"
 * without reading the message.
 */
function errorExitCode(error: AzureSwaAriadaError): number {
  return error.code.startsWith('E_ARGUMENT') ||
    error.code.startsWith('E_CONFIG') ||
    error.code.startsWith('E_PREVIEW') ||
    error.code.startsWith('E_BUILD')
    ? 2
    : 3;
}

/** Run once and return the code the process should exit with. Never throws. */
export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
  try {
    const cli = parseCliArgs(argv);
    if (cli.help === true) {
      process.stdout.write(HELP);
      return 0;
    }

    let config: IntegrationOptions = {};
    if (cli.configPath !== undefined) {
      config = parseConfigJson(await readFile(resolve(process.cwd(), cli.configPath), 'utf8'));
    }

    const { configPath: _configPath, help: _help, ...overrides } = cli;
    void _configPath;
    void _help;

    const result = await runAzureSwaAriada({ ...config, ...overrides });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return result.exitCode;
  } catch (error) {
    const normalized =
      error instanceof AzureSwaAriadaError
        ? error
        : new AzureSwaAriadaError('E_INTERNAL', error instanceof Error ? error.message : String(error));
    process.stderr.write(
      `${JSON.stringify({
        level: 'error',
        code: normalized.code,
        message: normalized.message,
        details: normalized.details,
      })}\n`,
    );
    return errorExitCode(normalized);
  }
}
