// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/process.js` and `dist/process.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the body is
// the compiled one. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.
//
// Output is captured with a ceiling, and hitting it is a failure rather than a
// truncation. A scan that prints more than sixty-four megabytes has gone wrong
// in some way this cannot describe, and returning its first sixty-four
// megabytes as if they were the whole answer would hide that. The child is
// stopped and the error names the limit.
//
// A process killed by a signal is rejected with the signal named, rather than
// being reported as an exit code, because there is no exit code — reading the
// null as zero would turn a browser the operating system removed into a clean
// pass.
//
// No shell. The arguments come from a command line this package parsed, and a
// shell would give a page address a second reading it was never meant to have.

import { spawn } from "node:child_process";

export interface ProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

const MAX_CAPTURE_BYTES = 64 * 1024 * 1024;

export async function runProcess(
  command: string,
  args: readonly string[],
  options: { cwd: string; env?: NodeJS.ProcessEnv },
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      cwd: options.cwd,
      env: options.env ?? process.env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let captured = 0;
    let overflow: Error | undefined;
    const collect = (target: Buffer[], chunk: Buffer) => {
      captured += chunk.length;
      if (captured > MAX_CAPTURE_BYTES) {
        overflow ??= new Error(`Child output exceeded ${MAX_CAPTURE_BYTES} bytes`);
        child.kill("SIGTERM");
        return;
      }
      target.push(chunk);
    };
    child.stdout.on("data", (chunk: Buffer) => collect(stdout, chunk));
    child.stderr.on("data", (chunk: Buffer) => collect(stderr, chunk));
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (overflow) return reject(overflow);
      if (code === null) return reject(new Error(`Child terminated by signal ${signal ?? "unknown"}`));
      resolve({
        exitCode: code,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
  });
}
