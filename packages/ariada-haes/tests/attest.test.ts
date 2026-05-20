// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';

import {
  AIAS_SCHEMA_VERSION,
  buildEntry,
  computeEntryHash,
  GENESIS_PREV_HASH,
  signEntryHash,
} from '../src/attest.js';
import {
  generateEd25519Keypair,
  hexToBytes,
  sha256Hex,
  verifyEd25519,
} from '../src/crypto.js';
import type { AppendInput, EntryPayload } from '../src/types.js';

function mkPayload(keyId: string, overrides: Partial<EntryPayload> = {}): EntryPayload {
  return {
    model_id: 'anthropic:claude-3-7-sonnet',
    model_version: '20250203',
    prompt_template_fingerprint: sha256Hex('template-v1'),
    input_redaction_profile: 'pii-strict-v2',
    output_checksum: sha256Hex('output-bytes'),
    decision: 'shipped',
    signing_key_id: keyId,
    ...overrides,
  };
}

describe('buildEntry / computeEntryHash', () => {
  it('produces an entry with all required fields populated', () => {
    const key = generateEd25519Keypair();
    const input: AppendInput = {
      payload: mkPayload(key.keyId),
      timestamp: '2026-08-02T12:34:56.789Z',
      entry_id: '01HZZZZZZZZZZZZZZZZZZZZZZZ',
    };
    const entry = buildEntry(input, GENESIS_PREV_HASH, key);
    expect(entry.entry_id).toBe('01HZZZZZZZZZZZZZZZZZZZZZZZ');
    expect(entry.timestamp).toBe('2026-08-02T12:34:56.789Z');
    expect(entry.prev_hash).toBe(GENESIS_PREV_HASH);
    expect(entry.entry_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(entry.signature.algorithm).toBe('Ed25519');
    expect(entry.signature.value).toMatch(/^[0-9a-f]{128}$/);
    expect(entry.schema_version).toBe(AIAS_SCHEMA_VERSION);
  });

  it('produces byte-identical entry_hash for identical input', () => {
    const key = generateEd25519Keypair();
    const input: AppendInput = {
      payload: mkPayload(key.keyId),
      timestamp: '2026-08-02T12:34:56.789Z',
      entry_id: 'TEST01',
    };
    const a = buildEntry(input, GENESIS_PREV_HASH, key);
    const b = buildEntry(input, GENESIS_PREV_HASH, key);
    expect(a.entry_hash).toBe(b.entry_hash);
  });

  it('changes entry_hash if any payload field changes (excluding tags)', () => {
    const key = generateEd25519Keypair();
    const baseInput: AppendInput = {
      payload: mkPayload(key.keyId),
      timestamp: '2026-08-02T12:34:56.789Z',
      entry_id: 'TEST02',
    };
    const a = buildEntry(baseInput, GENESIS_PREV_HASH, key);
    const b = buildEntry(
      { ...baseInput, payload: mkPayload(key.keyId, { decision: 'blocked' }) },
      GENESIS_PREV_HASH,
      key,
    );
    expect(a.entry_hash).not.toBe(b.entry_hash);
  });

  it('does NOT change entry_hash when tags are added (privacy / churn isolation)', () => {
    const key = generateEd25519Keypair();
    const input: AppendInput = {
      payload: mkPayload(key.keyId),
      timestamp: '2026-08-02T12:34:56.789Z',
      entry_id: 'TEST03',
    };
    const untagged = buildEntry(input, GENESIS_PREV_HASH, key);
    const tagged = buildEntry(
      {
        ...input,
        payload: { ...input.payload, tags: { user_id: 'u_42' } },
      },
      GENESIS_PREV_HASH,
      key,
    );
    expect(untagged.entry_hash).toBe(tagged.entry_hash);
  });

  it('rejects payload whose signing_key_id does not match the keypair', () => {
    const key = generateEd25519Keypair();
    const wrong = generateEd25519Keypair();
    const input: AppendInput = {
      payload: mkPayload(wrong.keyId),
      timestamp: '2026-08-02T12:34:56.789Z',
      entry_id: 'TEST04',
    };
    expect(() => buildEntry(input, GENESIS_PREV_HASH, key)).toThrow(/signing_key_id/);
  });

  it('rejects malformed chainPrevHash', () => {
    const key = generateEd25519Keypair();
    const input: AppendInput = {
      payload: mkPayload(key.keyId),
      timestamp: '2026-08-02T12:34:56.789Z',
      entry_id: 'TEST05',
    };
    expect(() => buildEntry(input, 'not-hex', key)).toThrow(/64 lowercase hex/);
  });

  it('signEntryHash produces a signature that verifies against the public key', () => {
    const key = generateEd25519Keypair();
    const fakeHash = sha256Hex('something');
    const sig = signEntryHash(fakeHash, key);
    expect(sig.algorithm).toBe('Ed25519');
    // 64 raw bytes → 128 hex chars
    expect(sig.value.length).toBe(128);
    const ok = verifyEd25519(key.publicKey, hexToBytes(fakeHash), hexToBytes(sig.value));
    expect(ok).toBe(true);
  });

  it('computeEntryHash is independent of the order of payload keys', () => {
    const key = generateEd25519Keypair();
    const a = computeEntryHash({
      entry_id: 'X',
      timestamp: '2026-01-01T00:00:00.000Z',
      prev_hash: GENESIS_PREV_HASH,
      schema_version: '1.0.0',
      payload: mkPayload(key.keyId),
    });
    const b = computeEntryHash({
      entry_id: 'X',
      timestamp: '2026-01-01T00:00:00.000Z',
      prev_hash: GENESIS_PREV_HASH,
      schema_version: '1.0.0',
      // Same fields, different declared order — must yield same hash.
      payload: {
        decision: 'shipped',
        signing_key_id: key.keyId,
        output_checksum: sha256Hex('output-bytes'),
        input_redaction_profile: 'pii-strict-v2',
        prompt_template_fingerprint: sha256Hex('template-v1'),
        model_version: '20250203',
        model_id: 'anthropic:claude-3-7-sonnet',
      },
    });
    expect(a).toBe(b);
  });
});
