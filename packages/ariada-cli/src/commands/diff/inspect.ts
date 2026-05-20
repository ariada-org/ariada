// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { readFile } from 'node:fs/promises';

import { validateDiffResult, type DiffResult } from '@ariada/diff-schema';

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
export interface DiffInspectOptions {
  diff: string;
}

/**
 * Human-readable summary of a DiffResult — used for quick CLI eyeball
 * inspection. The output is intentionally terse; downstream tooling
 * should consume the JSON envelope directly.
 */
export async function runDiffInspect(
  options: DiffInspectOptions,
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
    const lines = [
      `diff_id: ${diff.diff_id}`,
      `engine: ${diff.engine_info.classifier} (v${diff.engine_info.classifier_version})`,
      `computed_at: ${diff.computed_at}`,
      `head.scan_id: ${diff.head.scan_id}`,
      `base.scan_id: ${diff.base.scan_id}`,
      '',
      `counts:`,
      `  new:          ${diff.counts.new}`,
      `  pre_existing: ${diff.counts.pre_existing}`,
      `  resolved:     ${diff.counts.resolved}`,
      `  total_head:   ${diff.counts.total_head}`,
      `  total_base:   ${diff.counts.total_base}`,
    ];
    stdout.write(lines.join('\n') + '\n');
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
