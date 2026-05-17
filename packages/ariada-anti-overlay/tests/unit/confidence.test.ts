// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect } from 'vitest';

import { computeConfidence, meetsFloor } from '../../src/confidence.js';
import accessibeIframe from '../../src/signatures/accessibe-iframe.js';
import accessibe from '../../src/signatures/accessibe.js';
import genericToolbar from '../../src/signatures/generic-toolbar.js';
import type { SignatureKind } from '../../src/types.js';

function kindsOf(...k: SignatureKind[]): Set<SignatureKind> {
  return new Set<SignatureKind>(k);
}

describe('confidence.rubric', () => {
  it('script-src alone → high', () => {
    expect(computeConfidence(accessibe, kindsOf('script-src'))).toBe('high');
  });

  it('iframe-src alone → high', () => {
    expect(computeConfidence(accessibe, kindsOf('iframe-src'))).toBe('high');
  });

  it('three non-network signatures → high', () => {
    expect(
      computeConfidence(accessibe, kindsOf('dom-id', 'class-prefix', 'global-js')),
    ).toBe('high');
  });

  it('two non-network signatures → medium', () => {
    expect(computeConfidence(accessibe, kindsOf('dom-id', 'class-prefix'))).toBe('medium');
  });

  it('one non-network signature → low', () => {
    expect(computeConfidence(accessibe, kindsOf('dom-id'))).toBe('low');
  });

  it('confidenceCap clamps high → medium for accessibe-iframe', () => {
    expect(computeConfidence(accessibeIframe, kindsOf('iframe-src'))).toBe('medium');
  });

  it('confidenceCap=low locks generic-toolbar even on attribute match', () => {
    expect(computeConfidence(genericToolbar, kindsOf('attribute'))).toBe('low');
  });

  it('empty kinds set → low (defensive)', () => {
    expect(computeConfidence(accessibe, kindsOf())).toBe('low');
  });

  it('meetsFloor: low passes "low" floor', () => {
    expect(meetsFloor('low', 'low')).toBe(true);
  });

  it('meetsFloor: low does not meet "medium" floor', () => {
    expect(meetsFloor('low', 'medium')).toBe(false);
  });

  it('meetsFloor: high meets "medium" floor', () => {
    expect(meetsFloor('high', 'medium')).toBe(true);
  });
});
