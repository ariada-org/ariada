// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';

import { FPC_MAPPING, deriveFpcStatus } from '../src/fpc-mapping.js';
import type { VpatCriterion } from '../src/types.js';

function crit(id: string, status: VpatCriterion['status']): VpatCriterion {
  return { id, name: `SC ${id}`, level: 'A', status };
}

describe('deriveFpcStatus', () => {
  const withoutVision = FPC_MAPPING.find((e) => e.id === 'fpc-without-vision');
  if (withoutVision === undefined) {
    throw new Error('FPC_MAPPING missing fpc-without-vision');
  }

  it('returns "supports" when all mapped SCs support', () => {
    const criteria = withoutVision.wcagScIds.map((id) => crit(id, 'supports'));
    expect(deriveFpcStatus(withoutVision, criteria)).toBe('supports');
  });

  it('returns "does-not-support" when any mapped SC fails', () => {
    const criteria = [
      crit('1.1.1', 'does-not-support'),
      ...withoutVision.wcagScIds.slice(1).map((id) => crit(id, 'supports')),
    ];
    expect(deriveFpcStatus(withoutVision, criteria)).toBe('does-not-support');
  });

  it('returns "partially-supports" when no fail but at least one partial', () => {
    const criteria = [
      crit('1.1.1', 'partially-supports'),
      ...withoutVision.wcagScIds.slice(1).map((id) => crit(id, 'supports')),
    ];
    expect(deriveFpcStatus(withoutVision, criteria)).toBe('partially-supports');
  });

  it('returns "not-evaluated" when every mapped SC is not-evaluated', () => {
    const criteria = withoutVision.wcagScIds.map((id) => crit(id, 'not-evaluated'));
    expect(deriveFpcStatus(withoutVision, criteria)).toBe('not-evaluated');
  });

  it('returns "not-applicable" for empty mapping (e.g. without-speech)', () => {
    const withoutSpeech = FPC_MAPPING.find((e) => e.id === 'fpc-without-speech');
    if (withoutSpeech === undefined) {
      throw new Error('FPC_MAPPING missing fpc-without-speech');
    }
    expect(deriveFpcStatus(withoutSpeech, [])).toBe('not-applicable');
  });

  it('ignores criteria outside the FPC mapping set', () => {
    const criteria = [
      ...withoutVision.wcagScIds.map((id) => crit(id, 'supports')),
      crit('1.4.7', 'does-not-support'), // not in without-vision mapping
    ];
    expect(deriveFpcStatus(withoutVision, criteria)).toBe('supports');
  });
});
