// SPDX-License-Identifier: EUPL-1.2
//
// Input validation tests — exercises `validateInput` so the error shape stays
// stable for downstream consumers.

import { describe, it, expect } from 'vitest';

import { attributeOffline, validateInput } from '../../src/index.js';
import { sampleInput, sampleMetadata, sha256 } from '../helpers.js';

describe('input validation', () => {
  it('rejects a raw (non-hashed) git_author_email', () => {
    const r = validateInput(
      sampleInput({
        commit_metadata: sampleMetadata({ git_author_email: 'dev@example.com' }),
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('input_invalid');
  });

  it('rejects a non-ISO timestamp', () => {
    const r = validateInput(
      sampleInput({
        commit_metadata: sampleMetadata({ timestamp_utc: 'yesterday' }),
      }),
    );
    expect(r.ok).toBe(false);
  });

  it('accepts a well-formed input', () => {
    const r = validateInput(
      sampleInput({
        commit_metadata: sampleMetadata({
          git_author_email: sha256('dev@example.com'),
        }),
      }),
    );
    expect(r.ok).toBe(true);
  });

  it('attributeOffline propagates validation errors', () => {
    const r = attributeOffline(
      sampleInput({
        commit_metadata: sampleMetadata({ git_author_email: 'oops' }),
      }),
    );
    expect(r.ok).toBe(false);
  });
});
