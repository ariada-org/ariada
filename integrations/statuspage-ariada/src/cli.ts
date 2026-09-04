// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

// The command line. Its default is to change nothing: print what would happen
// and stop. Sending requires saying so, and saying so requires a key that only
// the environment can supply.

import { readFile as readTextFile } from 'node:fs/promises';

import {
  parseStatuspageConfig,
  type Environment,
  type StatuspageConfig,
  type StatuspageConfigOverrides,
} from './config.js';
import { ProviderError, ValidationError } from './errors.js';
import {
  createStatusUpdatePlan,
  updateStatusComponent,
  type StatusUpdatePlanOptions,
} from './integration.js';
import { parseAriadaCliJson } from './parser.js';
import type { StatusBoardProvider } from './provider.js';
import { AtlassianStatuspageProvider } from './statuspage.js';
import { assertNonEmptyString } from './validation.js';

export const HELP_TEXT = `Usage: statuspage-ariada [options]

Consume an Ariada cli-scan.v1 JSON file and plan or apply a component update.
Dry-run is the default and performs no HTTP request.

Options:
  --input <path>          Ariada scan JSON path (or ARIADA_RESULT_PATH)
  --page-id <id>          Statuspage page ID (or STATUSPAGE_PAGE_ID)
  --component-id <id>     Statuspage component ID (or STATUSPAGE_COMPONENT_ID)
  --base-url <origin>     HTTPS Statuspage API origin
  --incident              Include a non-submitting regression incident payload
  --incident-name <name>  Override the incident name; requires --incident
  --apply                 Perform the component PATCH; requires STATUSPAGE_API_KEY
  --help                  Show this help
`;

/** Either help was asked for, or everything needed to act was supplied. */
export type CliConfig =
  | { readonly help: true }
  | {
      readonly help: false;
      readonly inputPath: string;
      readonly apply: boolean;
      readonly includeIncident: boolean;
      readonly incidentName?: string;
      readonly statuspage: StatuspageConfig;
    };

/** The seams: everything this command touches outside itself. */
export interface CliDependencies {
  readonly environment?: Environment;
  readonly readFile?: (path: string) => Promise<string>;
  readonly writeOut?: (message: string) => void;
  readonly writeError?: (message: string) => void;
  readonly providerFactory?: (options: {
    readonly apiKey: string;
    readonly baseUrl: string;
  }) => StatusBoardProvider;
}

interface ParsedArguments {
  help: boolean;
  apply: boolean;
  includeIncident: boolean;
  inputPath?: string;
  pageId?: string;
  componentId?: string;
  baseUrl?: string;
  incidentName?: string;
}

const FLAG_OPTIONS = {
  '--help': 'help',
  '--apply': 'apply',
  '--incident': 'includeIncident',
} as const;

const VALUE_OPTIONS = {
  '--input': 'inputPath',
  '--page-id': 'pageId',
  '--component-id': 'componentId',
  '--base-url': 'baseUrl',
  '--incident-name': 'incidentName',
} as const;

type FlagOption = keyof typeof FLAG_OPTIONS;
type ValueOption = keyof typeof VALUE_OPTIONS;

const isFlagOption = (argument: string): argument is FlagOption => argument in FLAG_OPTIONS;
const isValueOption = (argument: string): argument is ValueOption => argument in VALUE_OPTIONS;

/**
 * The value after an option, or a refusal. A flag standing where a value should
 * be is a forgotten value, not a value: `--page-id --apply` must not send an
 * update to a page called "--apply".
 */
function valueAfter(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new ValidationError(`${option} requires a value`, { field: option });
  }
  return value;
}

/**
 * Repeating an option is refused rather than resolved. Given the same flag
 * twice, whichever rule is chosen — first wins, last wins — half the people who
 * do it by accident get the other one.
 */
function parseArguments(argv: readonly string[]): ParsedArguments {
  const parsed: ParsedArguments = { help: false, apply: false, includeIncident: false };
  const seen = new Set<string>();

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === undefined) {
      continue;
    }
    if (seen.has(argument)) {
      throw new ValidationError(`Duplicate CLI option: ${argument}`, { field: argument });
    }
    seen.add(argument);

    if (isFlagOption(argument)) {
      parsed[FLAG_OPTIONS[argument]] = true;
      continue;
    }
    if (!isValueOption(argument)) {
      throw new ValidationError(`Unknown CLI option: ${argument}`, { field: argument });
    }

    parsed[VALUE_OPTIONS[argument]] = valueAfter(argv, index, argument);
    index += 1;
  }

  if (parsed.help && argv.length !== 1) {
    throw new ValidationError('--help cannot be combined with other options', { field: '--help' });
  }
  // Naming an incident that will not be filed is a request that quietly does
  // nothing, which is the shape worth refusing.
  if (parsed.incidentName !== undefined && !parsed.includeIncident) {
    throw new ValidationError('--incident-name requires --incident', { field: '--incident-name' });
  }

  return parsed;
}

/** The arguments and the environment, reconciled, or a refusal. */
export function parseCliConfig(argv: readonly string[], environment: Environment): CliConfig {
  const arguments_ = parseArguments(argv);
  if (arguments_.help) {
    return { help: true };
  }

  const inputPath = assertNonEmptyString(
    arguments_.inputPath ?? environment['ARIADA_RESULT_PATH'],
    'inputPath',
    4_096,
  );

  const overrides: StatuspageConfigOverrides = {};
  if (arguments_.pageId !== undefined) overrides.pageId = arguments_.pageId;
  if (arguments_.componentId !== undefined) overrides.componentId = arguments_.componentId;
  if (arguments_.baseUrl !== undefined) overrides.baseUrl = arguments_.baseUrl;

  const statuspage = parseStatuspageConfig(environment, overrides, {
    requireApiKey: arguments_.apply,
  });

  const config = {
    help: false as const,
    inputPath,
    apply: arguments_.apply,
    includeIncident: arguments_.includeIncident,
    statuspage,
  };

  return arguments_.incidentName === undefined
    ? config
    : { ...config, incidentName: arguments_.incidentName };
}

/**
 * Two for a caller's mistake, three for anything else — so a pipeline can tell
 * "you asked for something impossible" from "the board would not take it"
 * without reading the message.
 */
function serializeError(error: unknown): { exitCode: 2 | 3; output: string } {
  if (error instanceof ValidationError) {
    return {
      exitCode: 2,
      output: JSON.stringify({
        error: { code: error.code, message: error.message, field: error.field },
      }),
    };
  }
  if (error instanceof ProviderError) {
    return {
      exitCode: 3,
      output: JSON.stringify({
        error: {
          code: error.code,
          provider: error.provider,
          message: error.message,
          statusCode: error.statusCode,
        },
      }),
    };
  }
  return {
    exitCode: 3,
    output: JSON.stringify({
      error: {
        code: 'RUNTIME_ERROR',
        message: error instanceof Error ? error.message : 'Unexpected runtime error',
      },
    }),
  };
}

/** Run once and return the code the process should exit with. Never throws. */
export async function runCli(
  argv: readonly string[],
  dependencies: CliDependencies = {},
): Promise<0 | 2 | 3> {
  const environment = dependencies.environment ?? process.env;
  const readFile = dependencies.readFile ?? ((path: string) => readTextFile(path, 'utf8'));
  const writeOut =
    dependencies.writeOut ??
    ((message: string) => {
      process.stdout.write(message);
    });
  const writeError =
    dependencies.writeError ??
    ((message: string) => {
      process.stderr.write(message);
    });
  const providerFactory =
    dependencies.providerFactory ??
    ((options: { readonly apiKey: string; readonly baseUrl: string }) =>
      new AtlassianStatuspageProvider(options));

  try {
    const config = parseCliConfig(argv, environment);
    if (config.help) {
      writeOut(HELP_TEXT);
      return 0;
    }

    const input = parseAriadaCliJson(await readFile(config.inputPath));
    const regressionIncident = config.includeIncident
      ? config.incidentName === undefined
        ? true
        : { name: config.incidentName }
      : false;

    const planOptions: StatusUpdatePlanOptions = {
      pageId: config.statuspage.pageId,
      componentId: config.statuspage.componentId,
      regressionIncident,
    };

    if (!config.apply) {
      const plan = createStatusUpdatePlan(input, planOptions);
      writeOut(`${JSON.stringify({ mode: 'dry-run', plan }, null, 2)}\n`);
      return 0;
    }

    // Checked again rather than trusted from above: the configuration only
    // demands a key when `--apply` was seen, and this is the last place that
    // can tell whether it actually arrived.
    const apiKey = config.statuspage.apiKey;
    if (apiKey === undefined) {
      throw new ValidationError('STATUSPAGE_API_KEY is required for live updates', {
        field: 'STATUSPAGE_API_KEY',
      });
    }

    const provider = providerFactory({ apiKey, baseUrl: config.statuspage.baseUrl });
    const result = await updateStatusComponent(input, { ...planOptions, provider });
    writeOut(`${JSON.stringify({ mode: 'applied', result }, null, 2)}\n`);
    return 0;
  } catch (error) {
    const serialized = serializeError(error);
    writeError(`${serialized.output}\n`);
    return serialized.exitCode;
  }
}
