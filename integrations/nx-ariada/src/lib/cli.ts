// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/lib/cli.js` and `dist/lib/cli.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies
// are the compiled ones. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.
//
// THREE THINGS HERE ARE DELIBERATE AND NONE OF THEM IS OBVIOUS.
//
// Output is captured up to a limit. A scan that goes wrong can print a browser's
// entire log, and this text ends up in an error message; past a megabyte the
// tail is dropped rather than the process being allowed to grow without bound.
//
// The timeout is the caller's plus ten seconds, and it kills twice. The scanner
// has its own navigation timeout, so a hard kill at the same number would
// usually beat the scanner to its own error message and report a timeout where
// there was a real failure to describe. The extra ten seconds let it speak; the
// second kill is for when it does not.
//
// And the browser download is disabled for the child. Installing a browser in
// the middle of somebody's build, silently, is not this task's business.

import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

export interface CliProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

const MAX_CAPTURE_BYTES = 1024 * 1024;

function appendBounded(current: string, chunk: Buffer): string {
  const remaining = MAX_CAPTURE_BYTES - Buffer.byteLength(current, 'utf8');
  if (remaining <= 0) return current;
  return current + chunk.subarray(0, remaining).toString('utf8');
}

export async function resolveAriadaCli(): Promise<string> {
  const cliPath = resolve(__dirname, '..', '..', 'node_modules', '@ariada-org', 'cli', 'dist', 'bin.js');
  await access(cliPath);
  return cliPath;
}

export async function runAriadaCli(
  cliPath: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
): Promise<CliProcessResult> {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd,
      env: {
        ...process.env,
        PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1',
      },
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let forceTimer: NodeJS.Timeout | undefined;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      forceTimer = setTimeout(() => child.kill('SIGKILL'), 2_000);
      forceTimer.unref();
    }, timeoutMs + 10_000);
    child.stdout.on('data', (chunk: Buffer) => {
      stdout = appendBounded(stdout, chunk);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr = appendBounded(stderr, chunk);
    });
    child.once('error', (error) => {
      clearTimeout(timer);
      if (forceTimer !== undefined) clearTimeout(forceTimer);
      rejectRun(error);
    });
    child.once('close', (code) => {
      clearTimeout(timer);
      if (forceTimer !== undefined) clearTimeout(forceTimer);
      if (timedOut) {
        rejectRun(new Error(`Ariada CLI exceeded ${timeoutMs + 10_000}ms and was terminated`));
        return;
      }
      resolveRun({ exitCode: code ?? 3, stdout, stderr });
    });
  });
}
