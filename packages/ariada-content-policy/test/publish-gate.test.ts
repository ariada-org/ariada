// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { describe, it, expect } from 'vitest';

import { evaluateContent, ossSurfaceProfile, builtinPacks } from '../src/index.js';

/**
 * Regression corpus for the publish-path content gate.
 *
 * The FAIL fixture is a SYNTHETIC internal-governance note. It reproduces the
 * *class* of content that reached the public repository on 2026-07-03 — an
 * internal note (no application numbers, no scientist codenames) that leaks the
 * internal-path taxonomy — using only the generic internal-path patterns that
 * already live in the public `no-secrets` rule-pack. It deliberately contains
 * NO real proprietary surface names and NO patent-portfolio framing, so the
 * fixture itself is not a leak. The gate must FAIL it; the deterministic
 * apps-only audit did not.
 */
const SYNTHETIC_INTERNAL_NOTE = [
  '# Internal note (not redistributed)',
  '',
  'This internal governance note is not intended for redistribution.',
  'References to product/plans/, grants/, patents/, or .claude/ must not ship',
  'in any public package.',
].join('\n');

/** A legitimate public rule-pack README must not trip the gate. */
const LEGITIMATE_PUBLIC_README = [
  '# @ariada-org/wcag-rules-extended',
  '',
  'WCAG 2.2 AA rule expressions as Commons work. Each rule cites its WCAG',
  'Success Criterion, the EN 301 549 clause, and the EAA Annex I section.',
  'See EN 301 549 clause 9.1.1.1 and WCAG 2.2 SC 1.4.3.',
].join('\n');

describe('publish-path content gate (closes the 2026-07-03 leak class)', () => {
  it('FAILS an internal governance note that reaches a public surface', () => {
    const decision = evaluateContent(
      SYNTHETIC_INTERNAL_NOTE,
      ossSurfaceProfile,
      builtinPacks,
    );
    expect(decision.result).toBe('fail');
  });

  it('PASSES a legitimate public rule-pack README (no false positive)', () => {
    const decision = evaluateContent(
      LEGITIMATE_PUBLIC_README,
      ossSurfaceProfile,
      builtinPacks,
    );
    expect(decision.result).not.toBe('fail');
  });
});
