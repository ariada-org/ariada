// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { readFile, writeFile } from 'node:fs/promises';

import {
  buildGateDecision,
  defaultPolicy,
  validateBaselinePolicy,
  validateDiffResult,
  type BaselinePolicy,
  type DiffResult,
} from '@ariada-org/diff-schema';

import { CliError, emitError } from '../../errors.js';
import {
  EXIT_OK,
  EXIT_VIOLATIONS,
  EXIT_INVALID_ARGS,
  EXIT_RUNTIME_ERROR,
  type ExitCode,
} from '../../exit-codes.js';

/**
 *
 */
export interface DiffGateOptions {
  diff: string;
  policy?: string;
  out?: string;
  decisionId?: string;
  decidedAt?: string;
}

async function loadJson<T>(path: string): Promise<T> {
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw) as T;
}

/**
 * Apply a BaselinePolicy to a DiffResult and produce a GateDecision.
 * Exit code mirrors the gate result: pass → 0, fail → 1, warn → 0
 * (warn does not block by default; consumers can pass --fail-on-warn).
 */
export async function runDiffGate(
  options: DiffGateOptions,
  stdout: NodeJS.WritableStream = process.stdout,
  stderr: NodeJS.WritableStream = process.stderr,
): Promise<ExitCode> {
  try {
    const diff = await loadJson<DiffResult>(options.diff);
    const diffValidation = validateDiffResult(diff);
    if (!diffValidation.valid) {
      emitError(
        new CliError(
          'E_INVALID_OPTION',
          `diff file invalid: ${diffValidation.errors.join(', ')}`,
        ),
        stderr,
      );
      return EXIT_INVALID_ARGS;
    }

    let policy: BaselinePolicy;
    if (options.policy) {
      const raw = await readFile(options.policy, 'utf8');
      const parsed = JSON.parse(raw) as unknown;
      const pv = validateBaselinePolicy(parsed);
      if (!pv.valid) {
        emitError(
          new CliError(
            'E_INVALID_OPTION',
            `policy file invalid: ${pv.errors.join(', ')}`,
          ),
          stderr,
        );
        return EXIT_INVALID_ARGS;
      }
      policy = parsed as BaselinePolicy;
    } else {
      policy = defaultPolicy();
    }

    const decision = buildGateDecision({
      diff,
      policy,
      decisionId: options.decisionId ?? `01HV${Date.now().toString(36).toUpperCase()}`,
      decidedAt: options.decidedAt ?? new Date().toISOString(),
    });

    const json = JSON.stringify(decision, null, 2);
    if (options.out) {
      await writeFile(options.out, json + '\n', 'utf8');
      stdout.write(`wrote ${options.out}\n`);
    } else {
      stdout.write(json + '\n');
    }

    if (decision.result === 'fail') return EXIT_VIOLATIONS;
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
