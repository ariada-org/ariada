// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';

import { createCrossDomainDetector } from '../src/cross-domain.js';
import type {
  AnalyzerContext,
  ConflictSignature,
  Domain,
  DomainAnalyzer,
  Finding,
} from '../src/types.js';

function finding(domain: Domain, ruleId: string, selector: string): Finding {
  return {
    id: `${domain}-${ruleId}-${selector}`,
    scanId: 'scan-0',
    domain,
    ruleId,
    severity: 'serious',
    element: { selector },
    message: `${ruleId} on ${selector}`,
  };
}

function analyzerWithSignatures(
  domain: Domain,
  signatures: ConflictSignature[] = [],
): DomainAnalyzer {
  return {
    domain,
    version: '1',
    ruleIds: [],
    conflictSignatures: signatures,
    analyze: async (_: AnalyzerContext) => [],
  };
}

describe('CrossDomainDetector', () => {
  it('returns empty array when no signatures present', () => {
    const detector = createCrossDomainDetector([analyzerWithSignatures('a11y')]);
    const findings = new Map<Domain, readonly Finding[]>();
    findings.set('a11y', [finding('a11y', 'color-contrast', 'p.low')]);
    expect(detector.detect(findings, 'scan-1')).toEqual([]);
  });

  it('emits a cross finding when a signature matches', () => {
    const sig: ConflictSignature = {
      id: 'XD-TEST',
      domains: ['a11y', 'cwv'],
      describe: 'test only',
      match: (by) => {
        const a = by.get('a11y');
        return a && a.length > 0 ? [a[0]!] : undefined;
      },
    };
    const detector = createCrossDomainDetector([analyzerWithSignatures('a11y', [sig])]);
    const findings = new Map<Domain, readonly Finding[]>();
    findings.set('a11y', [finding('a11y', 'color-contrast', 'p.low')]);

    const out = detector.detect(findings, 'scan-1');
    expect(out).toHaveLength(1);
    expect(out[0]?.domain).toBe('cross');
    expect(out[0]?.conflictingDomains).toEqual(['a11y', 'cwv']);
    expect(out[0]?.participants).toHaveLength(1);
    expect(out[0]?.scanId).toBe('scan-1');
  });
});
