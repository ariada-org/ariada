// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/cli-runner.js` and `dist/cli-runner.d.ts`. The source
// this was built from was never committed; the compiled output is `tsc` with the
// types stripped, so the shapes come back from the declaration file and the
// bodies are the compiled ones. Checked with
// the rebuild check.
//
// THE SCANNER IS LOOKED FOR IN THREE PLACES, IN THE ORDER THAT RESPECTS INTENT:
// an explicit path from the environment, then the layer path a serverless
// deployment mounts, then the local installation. The middle one is what makes
// this work in the environment it was written for, and the first exists so that
// environment can be overridden without editing code.
//
// EVERY LIMIT IS ENFORCED HERE RATHER THAN HOPED FOR, because this runs where
// nobody is watching and the platform's own limit is a hard stop with no
// diagnosis. The output buffer is bounded and exceeding it kills the child with
// a message naming the limit. The process timeout is the caller's plus a margin,
// so the scanner gets to report its own timeout before this one fires — the
// difference between "the page did not load" and "something ran too long".
//
// A process killed by a signal has that appended to its diagnostics rather than
// hidden, and its missing exit code becomes 3 — an unrecognised end is not a
// verdict.
//
// The temporary directory is removed in a `finally` whatever happened. A
// function that leaks directories fills a machine it does not own.
//
// The report is read only when the exit code says there is one, so a broken run
// produces no envelope rather than a parse error about a file that was never
// written.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { CliRunner } from "./types.js";

export interface CliProcessInvocation {
  file: string;
  args: readonly string[];
  environment: NodeJS.ProcessEnv;
  maxBufferBytes: number;
  timeoutMs: number;
}

export interface CliProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export type CliProcessExecutor = (invocation: CliProcessInvocation) => Promise<CliProcessResult>;

export interface CliRunnerDependencies {
  cleanupOutputDir?: (path: string) => Promise<void>;
  cliPath?: string;
  environment?: NodeJS.ProcessEnv;
  execute?: CliProcessExecutor;
  makeOutputDir?: () => Promise<string>;
  nodePath?: string;
  readReport?: (path: string) => Promise<string>;
}

const LAMBDA_LAYER_CLI = "/opt/nodejs/node_modules/@ariada-org/cli/dist/bin.js";
const DEFAULT_MAX_BUFFER_BYTES = 1_048_576;
const PROCESS_TIMEOUT_MARGIN_MS = 10_000;

function parsePositiveInteger(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function localCliPath(): string {
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  return resolve(packageRoot, "node_modules", "@ariada-org", "cli", "dist", "bin.js");
}

function resolveCliPath(environment: NodeJS.ProcessEnv): string {
  if (environment.ARIADA_CLI_PATH !== undefined) {
    return environment.ARIADA_CLI_PATH;
  }
  return existsSync(LAMBDA_LAYER_CLI) ? LAMBDA_LAYER_CLI : localCliPath();
}

async function makeTemporaryOutputDir(environment: NodeJS.ProcessEnv): Promise<string> {
  const root = environment.ARIADA_TMP_ROOT ?? tmpdir();
  await mkdir(root, { recursive: true });
  return mkdtemp(join(root, "ariada-"));
}

function executeProcess(invocation: CliProcessInvocation): Promise<CliProcessResult> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(invocation.file, [...invocation.args], {
      env: invocation.environment,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let bufferedBytes = 0;
    let settled = false;
    const finishWithError = (error: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      child.kill("SIGKILL");
      rejectPromise(error);
    };
    const collect = (target: Buffer[], chunk: Buffer) => {
      if (settled) {
        return;
      }
      bufferedBytes += chunk.byteLength;
      if (bufferedBytes > invocation.maxBufferBytes) {
        finishWithError(new Error(`Ariada CLI output exceeded ${invocation.maxBufferBytes} bytes`));
        return;
      }
      target.push(chunk);
    };
    const timer = setTimeout(() => {
      finishWithError(new Error(`Ariada CLI exceeded ${invocation.timeoutMs} ms`));
    }, invocation.timeoutMs);
    timer.unref();
    child.stdout.on("data", (chunk: Buffer) => {
      collect(stdoutChunks, chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      collect(stderrChunks, chunk);
    });
    child.on("error", (error) => {
      finishWithError(error);
    });
    child.on("close", (code, signal) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      const signalMessage = signal === null ? "" : `\nAriada CLI terminated by signal ${signal}`;
      resolvePromise({
        exitCode: code ?? 3,
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: `${Buffer.concat(stderrChunks).toString("utf8")}${signalMessage}`,
      });
    });
  });
}

export function createCliRunner(dependencies: CliRunnerDependencies = {}): CliRunner {
  const environment = {
    ...process.env,
    ...(dependencies.environment ?? {}),
  };
  const execute = dependencies.execute ?? executeProcess;
  const cleanupOutputDir = dependencies.cleanupOutputDir ??
    ((path: string) => rm(path, { force: true, recursive: true }));
  const makeOutputDir = dependencies.makeOutputDir ?? (() => makeTemporaryOutputDir(environment));
  const readReport = dependencies.readReport ?? ((path: string) => readFile(path, "utf8"));
  const cliPath = dependencies.cliPath ?? resolveCliPath(environment);
  const nodePath = dependencies.nodePath ?? process.execPath;
  const maxBufferBytes = parsePositiveInteger(environment.ARIADA_MAX_BUFFER_BYTES, DEFAULT_MAX_BUFFER_BYTES, "ARIADA_MAX_BUFFER_BYTES");
  return async (request) => {
    const outputDir = await makeOutputDir();
    try {
      const result = await execute({
        file: nodePath,
        args: [
          cliPath,
          "scan",
          request.url,
          "--browser",
          "chromium",
          "--format",
          "json",
          "--output-dir",
          outputDir,
          "--severity-threshold",
          request.severityThreshold,
          "--timeout-ms",
          String(request.timeoutMs),
        ],
        environment,
        maxBufferBytes,
        timeoutMs: request.timeoutMs + PROCESS_TIMEOUT_MARGIN_MS,
      });
      if (result.exitCode !== 0 && result.exitCode !== 1) {
        return { ...result, envelope: undefined };
      }
      const reportText = await readReport(join(outputDir, "scan.json"));
      const envelope = JSON.parse(reportText);
      return { ...result, envelope };
    }
    finally {
      await cleanupOutputDir(outputDir);
    }
  };
}
