// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { CliError, emitError } from '../../errors.js';
import {
  EXIT_OK,
  EXIT_UNIMPLEMENTED,
  EXIT_RUNTIME_ERROR,
  type ExitCode,
} from '../../exit-codes.js';

/**
 *
 */
export interface DiffExemptOptions {
  action: 'list' | 'revoke';
  fingerprint?: string;
}

/**
 * Exemption management — full lifecycle (file + approve + revoke +
 * DOM-drift invalidate) lives in the SaaS engine. The OSS CLI ships
 * stub list / revoke handlers that exit unimplemented and direct the
 * user to the SaaS dashboard.
 */
export async function runDiffExempt(
  options: DiffExemptOptions,
  stdout: NodeJS.WritableStream = process.stdout,
  stderr: NodeJS.WritableStream = process.stderr,
): Promise<ExitCode> {
  try {
    if (options.action === 'list') {
      stdout.write(
        'exemption registry is hosted in the SaaS dashboard; the OSS CLI ships no local registry\n',
      );
      return EXIT_OK;
    }
    if (options.action === 'revoke') {
      if (!options.fingerprint) {
        emitError(
          new CliError(
            'E_INVALID_OPTION',
            'revoke requires a finding fingerprint',
          ),
          stderr,
        );
        return EXIT_UNIMPLEMENTED;
      }
      stdout.write(
        `revocation is hosted in the SaaS dashboard for fingerprint=${options.fingerprint}; the OSS CLI cannot mutate exemptions\n`,
      );
      return EXIT_UNIMPLEMENTED;
    }
    emitError(
      new CliError(
        'E_INVALID_OPTION',
        `unknown exempt action: ${String(options.action)}`,
        { allowed: ['list', 'revoke'] },
      ),
      stderr,
    );
    return EXIT_UNIMPLEMENTED;
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
