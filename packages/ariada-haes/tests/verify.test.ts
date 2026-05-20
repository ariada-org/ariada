// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';

import { buildEntry, GENESIS_PREV_HASH } from '../src/attest.js';
import { generateEd25519Keypair, sha256Hex } from '../src/crypto.js';
import type { EntryPayload } from '../src/types.js';
import { verifyChain, verifyEntry } from '../src/verify.js';

function mkPayload(keyId: string, decision: EntryPayload['decision'] = 'shipped'): EntryPayload {
  return {
    model_id: 'openai:gpt-4o-2024-08-06',
    model_version: '2024-08-06',
    prompt_template_fingerprint: sha256Hex('tmpl'),
    input_redaction_profile: 'none',
    output_checksum: sha256Hex('out'),
    decision,
    signing_key_id: keyId,
  };
}

describe('verifyEntry', () => {
  it('accepts a freshly-built genesis entry', () => {
    const key = generateEd25519Keypair();
    const entry = buildEntry(
      { payload: mkPayload(key.keyId), timestamp: '2026-08-02T00:00:00.000Z', entry_id: 'A' },
      GENESIS_PREV_HASH,
      key,
    );
    const verdict = verifyEntry(entry, GENESIS_PREV_HASH, key.publicKeyRaw);
    expect(verdict.valid).toBe(true);
  });

  it('rejects entries whose prev_hash link does not match', () => {
    const key = generateEd25519Keypair();
    const entry = buildEntry(
      { payload: mkPayload(key.keyId), timestamp: '2026-08-02T00:00:00.000Z', entry_id: 'B' },
      GENESIS_PREV_HASH,
      key,
    );
    const verdict = verifyEntry(entry, 'f'.repeat(64), key.publicKeyRaw);
    expect(verdict.valid).toBe(false);
    expect(verdict.reason).toMatch(/prev_hash/);
  });

  it('rejects entries whose payload was mutated post-build', () => {
    const key = generateEd25519Keypair();
    const entry = buildEntry(
      { payload: mkPayload(key.keyId), timestamp: '2026-08-02T00:00:00.000Z', entry_id: 'C' },
      GENESIS_PREV_HASH,
      key,
    );
    const mutated = { ...entry, payload: { ...entry.payload, decision: 'blocked' as const } };
    const verdict = verifyEntry(mutated, GENESIS_PREV_HASH, key.publicKeyRaw);
    expect(verdict.valid).toBe(false);
    expect(verdict.reason).toMatch(/entry_hash mismatch/);
  });

  it('allows tag mutations without breaking verification', () => {
    const key = generateEd25519Keypair();
    const entry = buildEntry(
      { payload: mkPayload(key.keyId), timestamp: '2026-08-02T00:00:00.000Z', entry_id: 'D' },
      GENESIS_PREV_HASH,
      key,
    );
    const tagged = {
      ...entry,
      payload: { ...entry.payload, tags: { user_id: 'u_42' } },
    };
    const verdict = verifyEntry(tagged, GENESIS_PREV_HASH, key.publicKeyRaw);
    expect(verdict.valid).toBe(true);
  });

  it('rejects entries whose signature has been mutated', () => {
    const key = generateEd25519Keypair();
    const entry = buildEntry(
      { payload: mkPayload(key.keyId), timestamp: '2026-08-02T00:00:00.000Z', entry_id: 'E' },
      GENESIS_PREV_HASH,
      key,
    );
    const bad = entry.signature.value.replace(/^./, (c) => (c === 'a' ? 'b' : 'a'));
    const mutated = {
      ...entry,
      signature: { ...entry.signature, value: bad },
    };
    const verdict = verifyEntry(mutated, GENESIS_PREV_HASH, key.publicKeyRaw);
    expect(verdict.valid).toBe(false);
    expect(verdict.reason).toMatch(/signature|hash/i);
  });

  it('rejects entries signed by a different keypair', () => {
    const key = generateEd25519Keypair();
    const other = generateEd25519Keypair();
    const entry = buildEntry(
      { payload: mkPayload(key.keyId), timestamp: '2026-08-02T00:00:00.000Z', entry_id: 'F' },
      GENESIS_PREV_HASH,
      key,
    );
    const verdict = verifyEntry(entry, GENESIS_PREV_HASH, other.publicKeyRaw);
    expect(verdict.valid).toBe(false);
  });
});

describe('verifyChain', () => {
  it('accepts a multi-entry chain built monotonically', () => {
    const key = generateEd25519Keypair();
    const e1 = buildEntry(
      { payload: mkPayload(key.keyId), timestamp: '2026-08-02T00:00:00.000Z', entry_id: 'C1' },
      GENESIS_PREV_HASH,
      key,
    );
    const e2 = buildEntry(
      {
        payload: mkPayload(key.keyId, 'rewritten'),
        timestamp: '2026-08-02T00:00:01.000Z',
        entry_id: 'C2',
      },
      e1.entry_hash,
      key,
    );
    const e3 = buildEntry(
      {
        payload: mkPayload(key.keyId, 'blocked'),
        timestamp: '2026-08-02T00:00:02.000Z',
        entry_id: 'C3',
      },
      e2.entry_hash,
      key,
    );
    const verdict = verifyChain([e1, e2, e3], () => key.publicKeyRaw);
    expect(verdict.valid).toBe(true);
  });

  it('detects a single-byte mutation in the middle of the chain', () => {
    const key = generateEd25519Keypair();
    const e1 = buildEntry(
      { payload: mkPayload(key.keyId), timestamp: '2026-08-02T00:00:00.000Z', entry_id: 'M1' },
      GENESIS_PREV_HASH,
      key,
    );
    const e2 = buildEntry(
      { payload: mkPayload(key.keyId), timestamp: '2026-08-02T00:00:01.000Z', entry_id: 'M2' },
      e1.entry_hash,
      key,
    );
    const e3 = buildEntry(
      { payload: mkPayload(key.keyId), timestamp: '2026-08-02T00:00:02.000Z', entry_id: 'M3' },
      e2.entry_hash,
      key,
    );
    const tampered = { ...e2, payload: { ...e2.payload, model_id: 'evil:llm' } };
    const verdict = verifyChain([e1, tampered, e3], () => key.publicKeyRaw);
    expect(verdict.valid).toBe(false);
    expect(verdict.failed_entry_id).toBe('M2');
  });

  it('returns a clear reason when a signing key cannot be resolved', () => {
    const key = generateEd25519Keypair();
    const entry = buildEntry(
      { payload: mkPayload(key.keyId), timestamp: '2026-08-02T00:00:00.000Z', entry_id: 'U1' },
      GENESIS_PREV_HASH,
      key,
    );
    const verdict = verifyChain([entry], () => null);
    expect(verdict.valid).toBe(false);
    expect(verdict.reason).toMatch(/unknown signing_key_id/);
  });
});
