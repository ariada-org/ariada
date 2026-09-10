#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/cli.js` and `dist/cli.d.ts`. The source this was built
// from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies
// are the compiled ones. Checked with
// the rebuild check.
//
// The argument parser is strict and takes no positionals, so a misspelled flag
// or a stray word is refused rather than becoming a scan under defaults nobody
// chose. That matters more here than in a terminal: this runs unattended inside
// a build service, where nobody reads the output of a run that passed.
//
// EVERY FAILURE THAT ESCAPES IS ONE LINE OF JSON WITH A CODE, not a stack trace.
// Build logs are read by machines as often as by people, and the two codes
// separate the two audiences — a wrong configuration is the pipeline author's,
// anything else is ours.
//
// The result file is written beside itself and renamed into place, and the
// half-written file is removed if that fails. A build step downstream reads this
// as soon as the process exits, and half a JSON document parses as nothing —
// which is better than half a result, but only if the leftover is not there to
// be read next time.
//
// The module runs itself only when it was started as a program, so the command
// can be imported and tested without executing a scan on import.

import { spawn } from "node:child_process";
import { mkdir, readFile, rename, rm, writeFile, } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { ConfigurationError, resolveConfiguration, runIntegration, } from "./index.js";
import type { AriadaInvocation, ConfigurationOverrides, Execute, ExecutionResult, IntegrationResult } from "./index.js";

interface ParsedCliArguments {
  readonly help: boolean;
  readonly overrides: ConfigurationOverrides;
  readonly configPath?: string;
}

const HELP = [
  "Usage: gcp-cloud-build-ariada [options]",
  "",
  "Required:",
  "  --url <http(s)-url>             Target URL (or ARIADA_URL)",
  "",
  "Options:",
  "  --config <path>                 JSON config file",
  "  --mode <gate|report-only>       Default: gate",
  "  --output-dir <path>             Default: ./ariada-output",
  "  --result-file <path>            Default: <output-dir>/cloud-build-result.json",
  "  --browser <name>                chromium | firefox | webkit",
  "  --severity-threshold <level>    minor | moderate | serious | critical",
  "  --timeout-ms <ms>               1..300000, default: 30000",
  "  --ariada-bin <path>             Default: ariada",
  "  -h, --help                      Show this help",
  "",
  "Precedence: flags > ARIADA_* environment > JSON config > defaults.",
].join("\n");

export function parseCliArguments(argv: readonly string[]): ParsedCliArguments {
  const { values } = parseArgs({
    args: [...argv],
    allowPositionals: false,
    strict: true,
    options: {
      config: { type: "string" },
      url: { type: "string" },
      mode: { type: "string" },
      "output-dir": { type: "string" },
      "result-file": { type: "string" },
      browser: { type: "string" },
      "severity-threshold": { type: "string" },
      "timeout-ms": { type: "string" },
      "ariada-bin": { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  const overrides: ConfigurationOverrides = {};
  if (values.url !== undefined) overrides.url = values.url;
  if (values.mode !== undefined) overrides.mode = values.mode;
  if (values["output-dir"] !== undefined) {
    overrides.outputDir = values["output-dir"];
  }
  if (values["result-file"] !== undefined) {
    overrides.resultFile = values["result-file"];
  }
  if (values.browser !== undefined) overrides.browser = values.browser;
  if (values["severity-threshold"] !== undefined) {
    overrides.severityThreshold = values["severity-threshold"];
  }
  if (values["timeout-ms"] !== undefined) {
    overrides.timeoutMs = values["timeout-ms"];
  }
  if (values["ariada-bin"] !== undefined) {
    overrides.ariadaExecutable = values["ariada-bin"];
  }
  const parsed = {
    help: values.help ?? false,
    overrides,
  };
  if (values.config === undefined) {
    return parsed;
  }
  return { ...parsed, configPath: values.config };
}

export const executeProcess: Execute = async (invocation: AriadaInvocation) => new Promise<ExecutionResult>((resolvePromise, reject) => {
  const child = spawn(invocation.command, [...invocation.args], {
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });
  child.once("error", reject);
  child.once("close", (exitCode, signal) => {
    resolvePromise({ exitCode, signal, stdout, stderr });
  });
});

async function readJson(path: string): Promise<unknown> {
  const source = await readFile(path, "utf8");
  return JSON.parse(source);
}

async function readConfig(path: string | undefined): Promise<unknown> {
  if (path === undefined) {
    return undefined;
  }
  const source = await readFile(path, "utf8");
  return JSON.parse(source);
}

async function writeResult(path: string, result: IntegrationResult): Promise<void> {
  const temporaryPath = path + ".tmp-" + String(process.pid);
  await mkdir(dirname(resolve(path)), { recursive: true });
  try {
    await writeFile(temporaryPath, JSON.stringify(result, null, 2) + "\n", "utf8");
    await rename(temporaryPath, path);
  }
  catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

function formatBoundaryError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return (JSON.stringify({
    schemaVersion: 1,
    integration: "gcp-cloud-build-ariada",
    level: "error",
    code: error instanceof ConfigurationError ? "E_CONFIG" : "E_ADAPTER",
    message,
  }) + "\n");
}

export async function main(argv: readonly string[] = process.argv.slice(2), env: NodeJS.ProcessEnv = process.env): Promise<number> {
  try {
    const parsed = parseCliArguments(argv);
    if (parsed.help) {
      process.stdout.write(HELP + "\n");
      return 0;
    }
    const config = resolveConfiguration({
      fileConfig: await readConfig(parsed.configPath),
      env,
      overrides: parsed.overrides,
    });
    const result = await runIntegration(config, {
      execute: executeProcess,
      readJson,
    });
    await writeResult(config.resultFile, result);
    process.stdout.write(JSON.stringify(result) + "\n");
    return result.processExitCode;
  }
  catch (error) {
    process.stderr.write(formatBoundaryError(error));
    return error instanceof ConfigurationError ? error.exitCode : 3;
  }
}

const isMain = process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  void main().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
