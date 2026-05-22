// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Shared test plumbing for integration tests. Provides a deterministic fake
 * scanner so we can verify each adapter end-to-end without launching
 * Playwright (which is a separate package's responsibility).
 */

import { setScanner, type ScannerImpl } from '../../src/internal/run-scan.js';
import type { ScanResult, Violation } from '../../src/internal/types.js';

export const sampleContrastViolation: Violation = {
  ruleId: 'color-contrast',
  impact: 'serious',
  selector: '.price-label',
  message: 'contrast 2.1:1 below 4.5:1 threshold',
  wcag: ['1.4.3'],
};

export const sampleAriaViolation: Violation = {
  ruleId: 'aria-roles',
  impact: 'serious',
  selector: 'button[role="invalid-role"]',
  message: 'invalid ARIA role',
  wcag: ['4.1.2'],
};

export function makeFakeScanner(violations: Violation[]): ScannerImpl {
  return {
    scan: async (target) => {
      const identifier =
        target.kind === 'url'
          ? target.url
          : target.kind === 'page'
            ? target.page.url()
            : 'inline-html';
      const out: ScanResult = {
        violations,
        passes: 1,
        timestamp: new Date(0).toISOString(),
        durationMs: 5,
        target: { kind: target.kind, identifier },
      };
      return out;
    },
  };
}

export function installFakeScanner(violations: Violation[]): void {
  setScanner(makeFakeScanner(violations));
}

export function clearFakeScanner(): void {
  setScanner(null);
}
