// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';

import { DIAGNOSTIC_SEVERITY, mapSeverity } from '../../src/severity-mapper.js';

describe('severity-mapper', () => {
  it('critical → Error', () => {
    expect(mapSeverity('critical')).toBe(DIAGNOSTIC_SEVERITY.Error);
  });

  it('serious → Warning', () => {
    expect(mapSeverity('serious')).toBe(DIAGNOSTIC_SEVERITY.Warning);
  });

  it('moderate → Information', () => {
    expect(mapSeverity('moderate')).toBe(DIAGNOSTIC_SEVERITY.Information);
  });

  it('minor → Hint', () => {
    expect(mapSeverity('minor')).toBe(DIAGNOSTIC_SEVERITY.Hint);
  });
});
