// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/process.js` and `dist/process.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies are
// the compiled ones. Checked with
// the rebuild check.
//
// EVERY BOUNDARY A CHILD PROCESS CAN CROSS IS NAMED IN THE REQUEST TYPE, and
// `shell: false` is one of them rather than an option — written as the literal
// `false`, so a caller cannot pass true. With a shell there is no arguments
// array, only a string, and every value in it becomes syntax.
//
// The output ceiling is enforced while reading rather than after. A scan that
// prints without stopping would otherwise be held whole in memory before anyone
// noticed, and the failure would arrive as an exhausted process rather than as
// an explanation. Past the limit the child is killed and the reason names the
// limit.
//
// The timer is the same idea in the other dimension, and it is unreferenced so
// that a finished run is not held open by its own deadline.
//
// One flag settles the race: a timeout, an output overrun, a spawn failure and a
// clean close can all arrive in any order, and only the first is the answer.
// Without it a killed process still reports its close, and a caller would see
// both a rejection and a result.

import { spawn } from 'node:child_process';

export interface ProcessRequest {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
  readonly shell: false;
  readonly timeoutMs: number;
  readonly outputLimitBytes: number;
}

export interface ProcessResult {
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly stdout: string;
  readonly stderr: string;
}

export type ProcessRunner = (request: ProcessRequest) => Promise<ProcessResult>;

export class ProcessBoundaryError extends Error {
  override readonly name = 'ProcessBoundaryError';
}

export const spawnProcess: ProcessRunner = async (request) =>
  await new Promise((resolve, reject) => {
    const child = spawn(request.command, [...request.args], {
      cwd: request.cwd,
      env: request.env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let outputBytes = 0;
    let settled = false;
    const clearTimer = () => {
      clearTimeout(timer);
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimer();
      child.kill('SIGKILL');
      reject(error);
    };
    const capture = (destination: Buffer[], chunk: unknown) => {
      if (settled) return;
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
      outputBytes += buffer.byteLength;
      if (outputBytes > request.outputLimitBytes) {
        fail(
          new ProcessBoundaryError(
            `Scanner process output exceeded ${request.outputLimitBytes} bytes`,
          ),
        );
        return;
      }
      destination.push(buffer);
    };
    child.stdout.on('data', (chunk: Buffer) => capture(stdout, chunk));
    child.stderr.on('data', (chunk: Buffer) => capture(stderr, chunk));
    child.once('error', (error: Error) => {
      fail(new ProcessBoundaryError(`Unable to start scanner process: ${error.message}`));
    });
    child.once('close', (exitCode, signal) => {
      if (settled) return;
      settled = true;
      clearTimer();
      resolve({
        exitCode,
        signal,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      });
    });
    const timer = setTimeout(() => {
      fail(new ProcessBoundaryError(`Scanner process exceeded ${request.timeoutMs} ms`));
    }, request.timeoutMs);
    timer.unref();
  });
