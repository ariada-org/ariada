// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { readFile } from 'node:fs/promises';

import {
  validateGateDecision,
  type GateDecision,
} from '@ariada/diff-schema';

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
export interface DiffExplainOptions {
  decision: string;
  why?: string;
}

/**
 * Explain a GateDecision — print the resolution chain that produced
 * each reason. If `--why <fingerprint>` is provided, narrow to the
 * reason that includes that finding.
 */
export async function runDiffExplain(
  options: DiffExplainOptions,
  stdout: NodeJS.WritableStream = process.stdout,
  stderr: NodeJS.WritableStream = process.stderr,
): Promise<ExitCode> {
  try {
    const raw = await readFile(options.decision, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    const v = validateGateDecision(parsed);
    if (!v.valid) {
      emitError(
        new CliError(
          'E_INVALID_OPTION',
          `decision file invalid: ${v.errors.join(', ')}`,
        ),
        stderr,
      );
      return EXIT_INVALID_ARGS;
    }
    const decision = parsed as GateDecision;
    const filtered = options.why
      ? decision.reasons.filter((r) =>
          r.sample_finding_ids.includes(options.why ?? ''),
        )
      : decision.reasons;
    const header = `decision ${decision.decision_id} → ${decision.result}`;
    const body = filtered
      .map(
        (r) =>
          `  [${r.classification}/${r.severity}] count=${r.count} action=${r.action} (${r.applied_rule.source}: ${r.applied_rule.reference})`,
      )
      .join('\n');
    stdout.write(`${header}\n${body || '  (no matching reasons)'}\n`);
    stdout.write(`\nrecommended_action: ${decision.recommended_action}\n`);
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
