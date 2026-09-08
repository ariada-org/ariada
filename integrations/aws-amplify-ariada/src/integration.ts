// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/integration.js` and `dist/integration.d.ts`. The source
// this was built from was never committed; the compiled output is `tsc` with the
// types stripped, so the shapes come back from the declaration file and the
// bodies are the compiled ones. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.
//
// THE PREVIOUS REPORT IS DELETED BEFORE THE SCAN, NOT AFTER. If the scanner
// fails to write one, reading whatever is at that path would produce last run's
// findings under this run's name — a stale pass at exactly the moment something
// is broken. Removing it first makes that failure look like what it is.
//
// The report is only read when the exit code says one exists, so a broken run
// produces no findings rather than a parse error about a file never written.
//
// A FAILURE TO START THE SCANNER IS CARRIED, NOT THROWN. It becomes exit code 3
// with the reason attached, so the caller still receives a complete result
// saying what was attempted and why it did not happen. Throwing would leave the
// build with a stack trace and no record of the target, the arguments, or the
// mode.
//
// The server is closed in a `finally`, so a failure anywhere between opening it
// and returning does not leave a port held for the rest of the build.
//
// Every collaborator — the scanner, the server, the directory, the environment —
// is injectable with a real default, which is what makes this testable without a
// browser, a built site, or a scanner installed.

import { mkdir, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";

import { decideGate } from "./gate.js";
import { parseAriadaScanJson } from "./output.js";
import { SubprocessAriadaRunner } from "./runner.js";
import { serveDirectory } from "./static-server.js";
import { resolveTarget } from "./target.js";
import {
  ARIADA_CLI_PACKAGE,
  ARIADA_CLI_VERSION,
  type ActiveTarget,
  type AriadaRunner,
  type AriadaRunnerResult,
  type AriadaScanJson,
  type IntegrationConfig,
  type IntegrationResult,
  type StaticServerFactory,
  type StaticServerHandle,
} from "./types.js";

export interface IntegrationDependencies {
  runner?: AriadaRunner;
  staticServer?: StaticServerFactory;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function runAmplifyIntegration(
  config: IntegrationConfig,
  dependencies: IntegrationDependencies = {},
): Promise<IntegrationResult> {
  const cwd = dependencies.cwd ?? process.cwd();
  const outputDir = resolve(cwd, config.outputDir);
  const scanFile = resolve(outputDir, "scan.json");
  const resolvedTarget = resolveTarget(config, cwd);
  const runner = dependencies.runner ?? new SubprocessAriadaRunner();
  const staticServer = dependencies.staticServer ?? serveDirectory;
  let server: StaticServerHandle | undefined;
  let activeTarget: ActiveTarget;
  await mkdir(outputDir, { recursive: true });
  await rm(scanFile, { force: true });
  try {
    if (resolvedTarget.kind === "build-output") {
      server = await staticServer(resolvedTarget.path);
      activeTarget = {
        kind: "build-output",
        source: "build-output",
        buildOutput: resolvedTarget.path,
        url: server.url,
      };
    }
    else {
      activeTarget = resolvedTarget;
    }
    const args = [
      "scan",
      activeTarget.url,
      "--format",
      "json",
      "--output-dir",
      outputDir,
      "--browser",
      config.browser,
      "--severity-threshold",
      config.severityThreshold,
      "--timeout-ms",
      String(config.timeoutMs),
    ];
    let cliResult: AriadaRunnerResult;
    let integrationError: string | undefined;
    try {
      cliResult = await runner.run(args, {
        cwd,
        env: dependencies.env ?? process.env,
      });
    }
    catch (error) {
      integrationError = `Failed to invoke @ariada-org/cli: ${errorMessage(error)}`;
      cliResult = { exitCode: 3, stdout: "", stderr: integrationError };
    }
    let scan: AriadaScanJson | null = null;
    if (integrationError === undefined && (cliResult.exitCode === 0 || cliResult.exitCode === 1)) {
      try {
        scan = parseAriadaScanJson(await readFile(scanFile, "utf8"));
      }
      catch (error) {
        integrationError = `Failed to parse ${scanFile}: ${errorMessage(error)}`;
      }
    }
    return {
      version: 1,
      mode: config.mode,
      target: activeTarget,
      outputDir,
      scanFile,
      cli: {
        package: ARIADA_CLI_PACKAGE,
        version: ARIADA_CLI_VERSION,
        args,
        exitCode: cliResult.exitCode,
        stdout: cliResult.stdout,
        stderr: cliResult.stderr,
      },
      scan,
      decision: decideGate(config.mode, cliResult.exitCode, scan, integrationError),
    };
  }
  finally {
    await server?.close();
  }
}
