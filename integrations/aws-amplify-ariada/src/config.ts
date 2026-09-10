// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/config.js` and `dist/config.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies are
// the compiled ones. Checked with
// the rebuild check.
//
// FOUR SOURCES, AND THE ORDER IS THE WHOLE DESIGN: defaults, then the config
// file, then the environment, then the command line. Each layer is what somebody
// wrote more deliberately than the one before it, so the later wins.
//
// The environment layer reads the hosting service's own variables as fallbacks
// for the app identifier and branch, which is what lets this work in a build with
// no configuration at all — the platform has already said which site and which
// branch it is building.
//
// AN UNKNOWN KEY IN THE FILE IS AN ERROR RATHER THAN SOMETHING IGNORED. A
// misspelled setting that is silently dropped leaves someone convinced they have
// configured a gate that is not there, and this runs unattended where nobody
// will notice the difference. The same reasoning makes an unknown flag fatal,
// and makes a flag whose value looks like another flag fatal too, since that is
// a value someone forgot to type rather than an empty one they meant.
//
// The environment is passed through the same parser as the file, so a bad value
// is refused identically wherever it came from and there is one place where the
// allowed values are written down.
//
// A missing config file is only an error when the path was given explicitly. Not
// having one is the ordinary case; naming one that is not there is a mistake.
//
// Undefined entries are dropped before merging, so a layer that says nothing
// about a setting leaves the layer beneath it standing rather than erasing it.

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { BrowserName, GateMode, IntegrationConfig, SeverityThreshold } from "./types.js";

type ConfigValues = Partial<IntegrationConfig>;

export interface ParsedArguments {
  configPath?: string;
  overrides: ConfigValues;
  help: boolean;
}

export interface LoadedConfig {
  config: IntegrationConfig;
  help: boolean;
}

const MODES = new Set<string>(["gate", "report-only"]);
const BROWSERS = new Set<string>(["chromium", "firefox", "webkit"]);
const SEVERITIES = new Set<string>([
  "minor",
  "moderate",
  "serious",
  "critical",
]);
const CONFIG_KEYS = new Set<string>([
  "$schema",
  "mode",
  "buildOutput",
  "targetUrl",
  "amplifyAppId",
  "amplifyBranch",
  "outputDir",
  "browser",
  "severityThreshold",
  "timeoutMs",
]);
const DEFAULTS: IntegrationConfig = {
  mode: "gate",
  outputDir: ".ariada/amplify",
  browser: "chromium",
  severityThreshold: "moderate",
  timeoutMs: 30_000,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(object: Record<string, unknown>, key: string): string | undefined {
  const value = object[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${key} must be a non-empty string`);
  }
  return value.trim();
}

function parsePositiveInteger(value: unknown, key: string): number | undefined {
  if (value === undefined) return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${key} must be a positive integer`);
  }
  return parsed;
}

function parseMode(value: unknown, key: string): GateMode | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !MODES.has(value)) {
    throw new Error(`${key} must be gate or report-only`);
  }
  return value as GateMode;
}

function parseBrowser(value: unknown, key: string): BrowserName | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !BROWSERS.has(value)) {
    throw new Error(`${key} must be chromium, firefox, or webkit`);
  }
  return value as BrowserName;
}

function parseSeverity(value: unknown, key: string): SeverityThreshold | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !SEVERITIES.has(value)) {
    throw new Error(`${key} must be minor, moderate, serious, or critical`);
  }
  return value as SeverityThreshold;
}

function compact(values: ConfigValues): ConfigValues {
  return Object.fromEntries(Object.entries(values).filter((entry) => entry[1] !== undefined));
}

export function parseConfigObject(value: unknown): ConfigValues {
  if (!isRecord(value)) throw new Error("Config file must contain a JSON object");
  for (const key of Object.keys(value)) {
    if (!CONFIG_KEYS.has(key)) throw new Error(`Unknown config key: ${key}`);
  }
  return compact({
    mode: parseMode(value["mode"], "mode"),
    buildOutput: optionalString(value, "buildOutput"),
    targetUrl: optionalString(value, "targetUrl"),
    amplifyAppId: optionalString(value, "amplifyAppId"),
    amplifyBranch: optionalString(value, "amplifyBranch"),
    outputDir: optionalString(value, "outputDir"),
    browser: parseBrowser(value["browser"], "browser"),
    severityThreshold: parseSeverity(value["severityThreshold"], "severityThreshold"),
    timeoutMs: parsePositiveInteger(value["timeoutMs"], "timeoutMs"),
  });
}

function fromEnvironment(env: NodeJS.ProcessEnv): ConfigValues {
  const raw = {
    mode: env["ARIADA_MODE"],
    buildOutput: env["ARIADA_BUILD_OUTPUT"],
    targetUrl: env["ARIADA_TARGET_URL"],
    amplifyAppId: env["ARIADA_AMPLIFY_APP_ID"] ?? env["AWS_APP_ID"],
    amplifyBranch: env["ARIADA_AMPLIFY_BRANCH"] ?? env["AWS_BRANCH"],
    outputDir: env["ARIADA_OUTPUT_DIR"],
    browser: env["ARIADA_BROWSER"],
    severityThreshold: env["ARIADA_SEVERITY_THRESHOLD"],
    timeoutMs: env["ARIADA_TIMEOUT_MS"],
  };
  return parseConfigObject(raw);
}

function takeValue(argv: readonly string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

export function parseArguments(argv: readonly string[]): ParsedArguments {
  const raw: Record<string, string> = {};
  let configPath: string | undefined;
  let help = false;
  const flagToKey: Record<string, string> = {
    "--mode": "mode",
    "--build-output": "buildOutput",
    "--target-url": "targetUrl",
    "--amplify-app-id": "amplifyAppId",
    "--amplify-branch": "amplifyBranch",
    "--output-dir": "outputDir",
    "--browser": "browser",
    "--severity-threshold": "severityThreshold",
    "--timeout-ms": "timeoutMs",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--help" || flag === "-h") {
      help = true;
      continue;
    }
    if (flag === "--config") {
      configPath = takeValue(argv, index, flag);
      index += 1;
      continue;
    }
    const key = flag === undefined ? undefined : flagToKey[flag];
    if (key === undefined || flag === undefined) {
      throw new Error(`Unknown argument: ${flag ?? ""}`);
    }
    raw[key] = takeValue(argv, index, flag);
    index += 1;
  }
  return {
    ...(configPath === undefined ? {} : { configPath }),
    overrides: parseConfigObject(raw),
    help,
  };
}

async function readConfigFile(path: string, required: boolean): Promise<ConfigValues> {
  try {
    const source = await readFile(path, "utf8");
    return parseConfigObject(JSON.parse(source));
  }
  catch (error) {
    if (
      !required &&
      isRecord(error) &&
      "code" in error &&
      error["code"] === "ENOENT"
    ) {
      return {};
    }
    throw error;
  }
}

export async function loadConfig(
  argv: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): Promise<LoadedConfig> {
  const parsed = parseArguments(argv);
  const configPath = resolve(cwd, parsed.configPath ?? "ariada.config.json");
  const fileConfig = await readConfigFile(configPath, parsed.configPath !== undefined);
  const config = {
    ...DEFAULTS,
    ...fileConfig,
    ...fromEnvironment(env),
    ...parsed.overrides,
  };
  return { config, help: parsed.help };
}

export const HELP_TEXT = `Usage: amplify-ariada [options]

Options:
  --config <path>                 JSON config path (default: ariada.config.json)
  --mode <gate|report-only>       Build gate behavior
  --build-output <path>           Static build directory to serve and scan
  --target-url <url>              Already-live Amplify preview/branch URL
  --amplify-app-id <id>           Amplify app ID for default branch URL
  --amplify-branch <name>         Amplify branch DNS prefix
  --output-dir <path>             Ariada JSON artifact directory
  --browser <name>                chromium, firefox, or webkit
  --severity-threshold <level>    minor, moderate, serious, or critical
  --timeout-ms <number>           Navigation timeout in milliseconds
  -h, --help                      Show this help
`;
