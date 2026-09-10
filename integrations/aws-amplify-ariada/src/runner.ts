// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/runner.js` and `dist/runner.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies are
// the compiled ones. Checked with
// the rebuild check.
//
// The scanner is started as a child process rather than imported, so a crash in
// it is a exit code here instead of an exception that takes the build down with
// it. The entry point is resolved through the module system rather than guessed
// at from a directory, which keeps it working wherever the package is installed.
//
// A process ended by a signal has that said in its diagnostics rather than left
// to be inferred from an empty result, and a missing exit code becomes 3: an
// unrecognised ending is not a verdict.
//
// The entry point is a constructor argument with a real default, which is the
// only reason this is testable at all — a test cannot have a scanner installed.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import type { AriadaInvocationOptions, AriadaRunner, AriadaRunnerResult } from "./types.js";

function defaultCliEntry(): string {
  const moduleUrl = import.meta.resolve("@ariada-org/cli");
  return fileURLToPath(new URL("./bin.js", moduleUrl));
}

export class SubprocessAriadaRunner implements AriadaRunner {
  readonly #cliEntry: string;

  constructor(cliEntry: string = defaultCliEntry()) {
    this.#cliEntry = cliEntry;
  }

  run(args: readonly string[], options: AriadaInvocationOptions): Promise<AriadaRunnerResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [this.#cliEntry, ...args], {
        cwd: options.cwd,
        env: options.env,
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
        resolve({
          exitCode: exitCode ?? 3,
          stdout,
          stderr: signal === null ? stderr : `${stderr}ariada terminated by signal ${signal}\n`,
        });
      });
    });
  }
}
