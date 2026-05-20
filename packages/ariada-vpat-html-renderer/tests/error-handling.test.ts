// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';

import { renderVpatHtml } from '../src/render-vpat-html.js';
import type { VpatReport } from '../src/types.js';

describe('renderVpatHtml — schema version pinning', () => {
  it('rejects schemaVersion "2.4" with descriptive error', () => {
    const stale = { schemaVersion: '2.4' } as unknown as VpatReport;
    expect(() => renderVpatHtml(stale)).toThrowError(/Unsupported VPAT schema version: 2\.4/);
  });

  it('rejects future schemaVersion "2.6"', () => {
    const future = { schemaVersion: '2.6' } as unknown as VpatReport;
    expect(() => renderVpatHtml(future)).toThrowError(/Expected 2\.5/);
  });

  it('rejects undefined input', () => {
    expect(() => renderVpatHtml(undefined as unknown as VpatReport)).toThrowError(TypeError);
  });

  it('rejects null input', () => {
    expect(() => renderVpatHtml(null as unknown as VpatReport)).toThrowError(TypeError);
  });
});
