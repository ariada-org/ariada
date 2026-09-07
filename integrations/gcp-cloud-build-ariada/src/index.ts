// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/index.js` and `dist/index.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies
// are the compiled ones. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.
//
// THREE LAYERS OF CONFIGURATION, AND THE ORDER IS THE WHOLE DESIGN: a command
// line argument beats an environment variable beats a file. A build service
// sets the environment, a repository holds the file, and a person overrides one
// value for one run — and each of the three is written by a different party, so
// which wins has to be decided rather than discovered.
//
// An unknown key in the file is refused rather than ignored. It is written by
// hand, so a misspelling is the ordinary mistake, and ignoring it means the
// setting somebody wrote does nothing and says nothing about it.
//
// THE RESULT FILE MAY NOT BE THE SCANNER'S OWN REPORT, AND THAT CHECK IS NOT
// PEDANTRY: both default under the same output directory, and a configuration
// that pointed one at the other would have this integration overwrite the
// evidence it is about to read.
//
// A GATE AND A REPORT ARE THE SAME RUN WITH DIFFERENT EXIT CODES. In report-only
// mode the process exits zero while `scanPassed` still records what was found —
// so a pipeline can adopt this without failing on day one, and the record does
// not lie about it afterwards.
//
// The scanner's exit code is classified rather than passed through raw, and a
// code outside its documented range becomes a runtime error with that fact
// recorded. An unrecognised number is not a verdict, and treating it as one
// would report an unknown failure as a specific one.
//
// The report is read only when the exit code says there is one to read, and it
// must agree with the process about that code. Two statements that cannot both
// be true are worth stopping for.

import { join, resolve } from "node:path";

export const ARIADA_CLI_PACKAGE = "@ariada-org/cli";
export const ARIADA_CLI_VERSION = "0.1.0";
export const ARIADA_SCAN_SCHEMA = "https://ariada.org/schemas/cli-scan.v1.json";

const BROWSERS = ["chromium", "firefox", "webkit"] as const;
const MODES = ["gate", "report-only"] as const;
const SEVERITIES = ["minor", "moderate", "serious", "critical"] as const;

export type Browser = (typeof BROWSERS)[number];
export type GateMode = (typeof MODES)[number];
export type Severity = (typeof SEVERITIES)[number];

export interface IntegrationConfig {
  readonly url: string;
  readonly mode: GateMode;
  readonly outputDir: string;
  readonly resultFile: string;
  readonly browser: Browser;
  readonly severityThreshold: Severity;
  readonly timeoutMs: number;
  readonly ariadaExecutable: string;
}

export interface ConfigurationOverrides {
  url?: string;
  mode?: string;
  outputDir?: string;
  resultFile?: string;
  browser?: string;
  severityThreshold?: string;
  timeoutMs?: string;
  ariadaExecutable?: string;
}

export interface ConfigurationLayers {
  readonly fileConfig?: unknown;
  readonly env?: NodeJS.ProcessEnv;
  readonly overrides?: ConfigurationOverrides;
}

export interface AriadaInvocation {
  readonly command: string;
  readonly args: readonly string[];
}

export interface ExecutionResult {
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly stdout: string;
  readonly stderr: string;
}

export type Execute = (invocation: AriadaInvocation) => Promise<ExecutionResult>;
export type ReadJson = (path: string) => Promise<unknown>;

export interface IntegrationDependencies {
  readonly execute: Execute;
  readonly readJson: ReadJson;
}

export interface AriadaScanReport {
  readonly $schema: typeof ARIADA_SCAN_SCHEMA;
  readonly exitCode: number;
  readonly [key: string]: unknown;
}

export type AriadaClassification = "passed" | "violations" | "invalid-arguments" | "runtime-error" | "unimplemented" | "precheck-failure";

export interface IntegrationResult {
  readonly schemaVersion: 1;
  readonly integration: "gcp-cloud-build-ariada";
  readonly mode: GateMode;
  readonly scanPassed: boolean;
  readonly gatePassed: boolean;
  readonly processExitCode: number;
  readonly target: {
    readonly url: string;
    readonly browser: Browser;
    readonly severityThreshold: Severity;
    readonly timeoutMs: number;
  };
  readonly ariada: {
    readonly package: typeof ARIADA_CLI_PACKAGE;
    readonly version: typeof ARIADA_CLI_VERSION;
    readonly exitCode: number | null;
    readonly effectiveExitCode: number;
    readonly classification: AriadaClassification;
    readonly reportPath: string;
    readonly report: AriadaScanReport | null;
  };
  readonly diagnostics: {
    readonly stdout: string;
    readonly stderr: string;
    readonly signal: NodeJS.Signals | null;
    readonly integrationError: string | null;
  };
}

const CONFIG_KEYS = new Set([
  "url",
  "mode",
  "outputDir",
  "resultFile",
  "browser",
  "severityThreshold",
  "timeoutMs",
  "ariadaExecutable",
]);

export class ConfigurationError extends Error {
  readonly exitCode = 2;
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

class ReportContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReportContractError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseFileConfig(value: unknown): Record<string, unknown> {
  if (value === undefined) {
    return {};
  }
  if (!isRecord(value)) {
    throw new ConfigurationError("Config file must contain a JSON object.");
  }
  for (const key of Object.keys(value)) {
    if (!CONFIG_KEYS.has(key)) {
      throw new ConfigurationError("Unknown config key: " + key);
    }
  }
  return value;
}

function requireNonEmptyString(value: unknown, field: string, fallback?: string): string {
  const candidate = value ?? fallback;
  if (typeof candidate !== "string" || candidate.trim().length === 0) {
    throw new ConfigurationError(field + " must be a non-empty string.");
  }
  return candidate;
}

function parseEnum<T extends string>(value: unknown, field: string, allowed: readonly T[], fallback: T): T {
  const candidate = value ?? fallback;
  if (typeof candidate !== "string" ||
    !allowed.includes(candidate as T)) {
    throw new ConfigurationError(field + " must be one of: " + allowed.join(", ") + ".");
  }
  return candidate as T;
}

function parseTimeout(value: unknown): number {
  const candidate = value ?? 30_000;
  const parsed = typeof candidate === "number"
    ? candidate
    : typeof candidate === "string" && /^\d+$/.test(candidate)
      ? Number(candidate)
      : Number.NaN;
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 300_000) {
    throw new ConfigurationError("timeoutMs must be an integer between 1 and 300000.");
  }
  return parsed;
}

function validateUrl(value: unknown): string {
  const candidate = requireNonEmptyString(value, "url");
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  }
  catch {
    throw new ConfigurationError("url must be a parseable http(s) URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ConfigurationError("url must use http or https.");
  }
  if (parsed.username.length > 0 || parsed.password.length > 0) {
    throw new ConfigurationError("url must not contain embedded credentials.");
  }
  return candidate;
}

function selectValue(override: unknown, environment: unknown, fileValue: unknown): unknown {
  return override ?? environment ?? fileValue;
}

export function resolveConfiguration(layers: ConfigurationLayers): IntegrationConfig {
  const file = parseFileConfig(layers.fileConfig);
  const env = layers.env ?? {};
  const overrides = layers.overrides ?? {};
  const outputDir = requireNonEmptyString(selectValue(overrides.outputDir, env["ARIADA_OUTPUT_DIR"], file["outputDir"]), "outputDir", "./ariada-output");
  const resultFile = requireNonEmptyString(selectValue(overrides.resultFile, env["ARIADA_RESULT_FILE"], file["resultFile"]), "resultFile", join(outputDir, "cloud-build-result.json"));
  if (resolve(resultFile) === resolve(outputDir, "scan.json")) {
    throw new ConfigurationError("resultFile must not overwrite Ariada's scan.json.");
  }
  return {
    url: validateUrl(selectValue(overrides.url, env["ARIADA_URL"], file["url"])),
    mode: parseEnum(selectValue(overrides.mode, env["ARIADA_MODE"], file["mode"]), "mode", MODES, "gate"),
    outputDir,
    resultFile,
    browser: parseEnum(selectValue(overrides.browser, env["ARIADA_BROWSER"], file["browser"]), "browser", BROWSERS, "chromium"),
    severityThreshold: parseEnum(selectValue(overrides.severityThreshold, env["ARIADA_SEVERITY_THRESHOLD"], file["severityThreshold"]), "severityThreshold", SEVERITIES, "moderate"),
    timeoutMs: parseTimeout(selectValue(overrides.timeoutMs, env["ARIADA_TIMEOUT_MS"], file["timeoutMs"])),
    ariadaExecutable: requireNonEmptyString(selectValue(overrides.ariadaExecutable, env["ARIADA_BIN"], file["ariadaExecutable"]), "ariadaExecutable", "ariada"),
  };
}

export function buildAriadaInvocation(config: IntegrationConfig): AriadaInvocation {
  return {
    command: config.ariadaExecutable,
    args: [
      "scan",
      config.url,
      "--browser",
      config.browser,
      "--severity-threshold",
      config.severityThreshold,
      "--timeout-ms",
      String(config.timeoutMs),
      "--format",
      "json",
      "--output-dir",
      config.outputDir,
    ],
  };
}

function parseReport(value: unknown, expectedExitCode: number): AriadaScanReport {
  if (!isRecord(value)) {
    throw new ReportContractError("scan.json must contain a JSON object.");
  }
  if (value["$schema"] !== ARIADA_SCAN_SCHEMA) {
    throw new ReportContractError("scan.json has an unsupported $schema value.");
  }
  if (value["exitCode"] !== expectedExitCode) {
    throw new ReportContractError("scan.json exitCode does not match the Ariada process exit code.");
  }
  return value as unknown as AriadaScanReport;
}

function classifyExitCode(exitCode: number): AriadaClassification {
  switch (exitCode) {
    case 0:
      return "passed";
    case 1:
      return "violations";
    case 2:
      return "invalid-arguments";
    case 3:
      return "runtime-error";
    case 4:
      return "unimplemented";
    case 5:
      return "precheck-failure";
    default:
      return "runtime-error";
  }
}

function normalizeExitCode(exitCode: number | null): number {
  if (exitCode !== null &&
    Number.isInteger(exitCode) &&
    exitCode >= 0 &&
    exitCode <= 5) {
    return exitCode;
  }
  return 3;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function runIntegration(config: IntegrationConfig, dependencies: IntegrationDependencies): Promise<IntegrationResult> {
  const invocation = buildAriadaInvocation(config);
  const reportPath = resolve(config.outputDir, "scan.json");
  let execution: ExecutionResult;
  let integrationError: string | null = null;
  try {
    execution = await dependencies.execute(invocation);
  }
  catch (error) {
    execution = {
      exitCode: null,
      signal: null,
      stdout: "",
      stderr: "",
    };
    integrationError =
      "Failed to invoke Ariada CLI: " + errorMessage(error);
  }
  const ariadaExitCode = execution.exitCode;
  let effectiveExitCode = normalizeExitCode(ariadaExitCode);
  let report: AriadaScanReport | null = null;
  if (integrationError === null &&
    (effectiveExitCode === 0 || effectiveExitCode === 1)) {
    try {
      report = parseReport(await dependencies.readJson(reportPath), effectiveExitCode);
    }
    catch (error) {
      effectiveExitCode = 3;
      integrationError =
        "Failed to read a valid Ariada scan report: " + errorMessage(error);
    }
  }
  else if (integrationError === null &&
    ariadaExitCode !== effectiveExitCode) {
    integrationError =
      "Ariada returned an exit code outside its documented 0-5 contract.";
  }
  const scanPassed = effectiveExitCode === 0;
  const gatePassed = config.mode === "report-only" || scanPassed;
  return {
    schemaVersion: 1,
    integration: "gcp-cloud-build-ariada",
    mode: config.mode,
    scanPassed,
    gatePassed,
    processExitCode: gatePassed ? 0 : effectiveExitCode,
    target: {
      url: config.url,
      browser: config.browser,
      severityThreshold: config.severityThreshold,
      timeoutMs: config.timeoutMs,
    },
    ariada: {
      package: ARIADA_CLI_PACKAGE,
      version: ARIADA_CLI_VERSION,
      exitCode: ariadaExitCode,
      effectiveExitCode,
      classification: classifyExitCode(effectiveExitCode),
      reportPath,
      report,
    },
    diagnostics: {
      stdout: execution.stdout,
      stderr: execution.stderr,
      signal: execution.signal,
      integrationError,
    },
  };
}
