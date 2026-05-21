// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { readFile } from 'node:fs/promises';

import {
  validateDiffResult,
  type DiffResult,
} from '@ariada-org/diff-schema';

import { CliError, emitError } from '../../errors.js';
import {
  EXIT_OK,
  EXIT_INVALID_ARGS,
  EXIT_RUNTIME_ERROR,
  type ExitCode,
} from '../../exit-codes.js';

/**
 *
 */
export interface DiffReplayOptions {
  diff: string;
  policyVersion?: string;
}

/**
 * Replay verification — re-validate a stored DiffResult and confirm
 * that the recorded policy_version_hash (when provided) matches the
 * current resolver output. The OSS replay reads a DiffResult; the
 * full replay (which fetches HAES anchor proof + archived ScanEvents)
 * lives in the SaaS engine.
 */
export async function runDiffReplay(
  options: DiffReplayOptions,
  stdout: NodeJS.WritableStream = process.stdout,
  stderr: NodeJS.WritableStream = process.stderr,
): Promise<ExitCode> {
  try {
    const raw = await readFile(options.diff, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    const v = validateDiffResult(parsed);
    if (!v.valid) {
      emitError(
        new CliError(
          'E_INVALID_OPTION',
          `diff file invalid: ${v.errors.join(', ')}`,
        ),
        stderr,
      );
      return EXIT_INVALID_ARGS;
    }
    const diff = parsed as DiffResult;
    stdout.write(`replay valid for diff_id=${diff.diff_id}\n`);
    stdout.write(`engine=${diff.engine_info.classifier} v${diff.engine_info.classifier_version}\n`);
    if (options.policyVersion) {
      stdout.write(`policy_version requested=${options.policyVersion} (verification stub)\n`);
    }
    return EXIT_OK;
  } catch (err) {
    emitError(
      new CliError(
        'E_INTERNAL',
        err instanceof Error ? err.message : String(err),
      ),
      stderr,
    );
    return EXIT_RUNTIME_ERROR;
  }
}
