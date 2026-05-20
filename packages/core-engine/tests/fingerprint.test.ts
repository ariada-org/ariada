// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';

import { fingerprint, fingerprintAsync } from '../src/fingerprint.js';

describe('fingerprint', () => {
  it('returns a 16-char hex string', () => {
    const fp = fingerprint({ ruleId: 'color-contrast', selector: 'p.low1' });
    expect(fp).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is deterministic for identical input', () => {
    const a = fingerprint({ ruleId: 'image-alt', selector: 'img#logo' });
    const b = fingerprint({ ruleId: 'image-alt', selector: 'img#logo' });
    expect(a).toBe(b);
  });

  it('differs when ruleId differs', () => {
    const a = fingerprint({ ruleId: 'image-alt', selector: 'img' });
    const b = fingerprint({ ruleId: 'color-contrast', selector: 'img' });
    expect(a).not.toBe(b);
  });

  it('differs when selector differs', () => {
    const a = fingerprint({ ruleId: 'image-alt', selector: 'img#a' });
    const b = fingerprint({ ruleId: 'image-alt', selector: 'img#b' });
    expect(a).not.toBe(b);
  });

  it('matches Web Crypto SubtleCrypto digest (sync == async)', async () => {
    const sync = fingerprint({ ruleId: 'image-alt', selector: 'img#logo' });
    const async = await fingerprintAsync({ ruleId: 'image-alt', selector: 'img#logo' });
    expect(sync).toBe(async);
  });

  it('matches the canonical sha256("color-contrast|p.low1") byte stream', () => {
    // Verifies stability against Node's createHash('sha256') output that the
    // pre-split implementation produced. SHA-256 of "color-contrast|p.low1"
    // truncated to 16 hex chars.
    expect(fingerprint({ ruleId: 'color-contrast', selector: 'p.low1' })).toBe('5af48d469c9b06de');
  });
});
