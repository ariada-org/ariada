// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { EXIT_UNIMPLEMENTED, type ExitCode } from '../exit-codes.js';

/**
 * Stub for `ariada generate-statement`.
 *
 * Stubbed in v0.1 — exits 4 (EXIT_UNIMPLEMENTED). The full statement-generator
 * lives in the sibling `@ariada/statement-generator` package; wiring it
 * through the CLI is tracked as a public issue.
 */
export function runGenerateStatement(
  stdout: NodeJS.WritableStream = process.stdout,
): ExitCode {
  stdout.write(
    [
      'ariada generate-statement — not yet implemented (exit 4).',
      '',
      'See @ariada/statement-generator for the underlying library.',
      '',
      'Track progress: https://github.com/ariada-org/ariada/issues?q=label%3Astatement-generator',
      '',
    ].join('\n'),
  );
  return EXIT_UNIMPLEMENTED;
}
