// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { EXIT_UNIMPLEMENTED, type ExitCode } from '../exit-codes.js';

/**
 * Stub for `ariada estimate-penalty`.
 *
 * Stubbed in v0.1 — exits 4 (EXIT_UNIMPLEMENTED). The full estimator
 * implementation lives in the sibling `@ariada/penalty-estimator` package;
 * wiring it through the CLI is tracked as a public issue.
 */
export function runEstimatePenalty(
  stdout: NodeJS.WritableStream = process.stdout,
): ExitCode {
  stdout.write(
    [
      'ariada estimate-penalty — not yet implemented (exit 4).',
      '',
      'See @ariada/penalty-estimator for the underlying library.',
      '',
      'Track progress: https://github.com/ariada-org/ariada/issues?q=label%3Apenalty-estimator',
      '',
    ].join('\n'),
  );
  return EXIT_UNIMPLEMENTED;
}
