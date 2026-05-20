// SPDX-License-Identifier: EUPL-1.2
//
// CLI exit-code constants (§3.8). The CI runner consumes these as the
// primary signal; the PR comment and SARIF artefact are secondary.

export const EXIT_GATE_PASS = 0;
export const EXIT_GATE_FAIL = 1;
export const EXIT_CONFIG_ERROR = 2;
export const EXIT_NETWORK_ERROR = 3;
export const EXIT_AUTH_ERROR = 4;
export const EXIT_RATE_LIMITED = 5;
export const EXIT_INTERNAL_ERROR = 10;

/**
 *
 */
export type ExitCode =
  | typeof EXIT_GATE_PASS
  | typeof EXIT_GATE_FAIL
  | typeof EXIT_CONFIG_ERROR
  | typeof EXIT_NETWORK_ERROR
  | typeof EXIT_AUTH_ERROR
  | typeof EXIT_RATE_LIMITED
  | typeof EXIT_INTERNAL_ERROR;

export const EXIT_CODE_LABELS: Record<ExitCode, string> = {
  [EXIT_GATE_PASS]: 'gate-pass',
  [EXIT_GATE_FAIL]: 'gate-fail',
  [EXIT_CONFIG_ERROR]: 'config-error',
  [EXIT_NETWORK_ERROR]: 'network-error',
  [EXIT_AUTH_ERROR]: 'auth-error',
  [EXIT_RATE_LIMITED]: 'rate-limited',
  [EXIT_INTERNAL_ERROR]: 'internal-error',
};

/** Reverse lookup from label to code. */
export function exitCodeFromLabel(label: string): ExitCode | undefined {
  for (const [code, lbl] of Object.entries(EXIT_CODE_LABELS)) {
    if (lbl === label) return Number(code) as ExitCode;
  }
  return undefined;
}
