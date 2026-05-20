// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';

import {
  buildInclusionProof,
  buildMerkleRoot,
  verifyInclusionProof,
} from '../src/anchor.js';
import { HaesClient } from '../src/client.js';
import { generateEd25519Keypair, sha256Hex } from '../src/crypto.js';
import { InMemoryStorage } from '../src/storage.js';
import type { EntryPayload } from '../src/types.js';

function payload(keyId: string, salt = ''): EntryPayload {
  return {
    model_id: 'local:llama-3.1-70b',
    model_version: 'q4_k_m',
    prompt_template_fingerprint: sha256Hex(`template${salt}`),
    input_redaction_profile: 'pii-strict-v2',
    output_checksum: sha256Hex(`output${salt}`),
    decision: 'shipped',
    signing_key_id: keyId,
  };
}

describe('HaesClient end-to-end', () => {
  it('appends a chain of entries that verifies clean end-to-end', async () => {
    const key = generateEd25519Keypair();
    const client = new HaesClient({ signingKey: key });
    const r1 = await client.append({ payload: payload(key.keyId, '1') });
    const r2 = await client.append({ payload: payload(key.keyId, '2') });
    const r3 = await client.append({ payload: payload(key.keyId, '3') });

    expect(r2.entry.prev_hash).toBe(r1.entry.entry_hash);
    expect(r3.entry.prev_hash).toBe(r2.entry.entry_hash);

    const verdict = await client.verifyAll(() => key.publicKeyRaw);
    expect(verdict.valid).toBe(true);
  });

  it('honours tenantId on the constructor for subsequent appends', async () => {
    const key = generateEd25519Keypair();
    const client = new HaesClient({ signingKey: key, tenantId: 'tenant_abc' });
    const r = await client.append({ payload: payload(key.keyId) });
    expect(r.entry.tenant_id).toBe('tenant_abc');
  });

  it('per-call tenant_id overrides the client default when provided', async () => {
    const key = generateEd25519Keypair();
    const client = new HaesClient({ signingKey: key, tenantId: 'tenant_abc' });
    const r = await client.append({
      payload: payload(key.keyId),
      tenant_id: 'tenant_xyz',
    });
    expect(r.entry.tenant_id).toBe('tenant_xyz');
  });

  it('is idempotent on duplicate entry_id', async () => {
    const key = generateEd25519Keypair();
    const storage = new InMemoryStorage();
    const client = new HaesClient({ signingKey: key, storage });
    await client.append({ payload: payload(key.keyId), entry_id: 'DUP01' });
    await client.append({ payload: payload(key.keyId), entry_id: 'DUP01' });
    expect(await storage.size()).toBe(1);
  });

  it('rejects monotonic-timestamp violations on append', async () => {
    const key = generateEd25519Keypair();
    const client = new HaesClient({ signingKey: key });
    await client.append({
      payload: payload(key.keyId, 'a'),
      timestamp: '2026-08-02T01:00:00.000Z',
      entry_id: 'T1',
    });
    await expect(
      client.append({
        payload: payload(key.keyId, 'b'),
        timestamp: '2026-08-02T00:00:00.000Z', // earlier than tail
        entry_id: 'T2',
      }),
    ).rejects.toThrow(/monotonic/);
  });

  it('produces a daily Merkle root over the appended entries that supports inclusion proofs', async () => {
    const key = generateEd25519Keypair();
    const client = new HaesClient({ signingKey: key });
    const N = 9;
    for (let i = 0; i < N; i++) {
      await client.append({ payload: payload(key.keyId, `i${i}`) });
    }
    const snapshot = await client.snapshot();
    const hashes = snapshot.map((e) => e.entry_hash);
    const root = buildMerkleRoot(hashes) as string;
    expect(root).toMatch(/^[0-9a-f]{64}$/);
    // Spot-check a few inclusion proofs.
    for (const idx of [0, 4, N - 1]) {
      const proof = buildInclusionProof(hashes, idx);
      expect(verifyInclusionProof(proof, root)).toBe(true);
    }
  });

  it('reports the correct size after a sequence of appends', async () => {
    const key = generateEd25519Keypair();
    const client = new HaesClient({ signingKey: key });
    expect(await client.size()).toBe(0);
    await client.append({ payload: payload(key.keyId, 'a') });
    await client.append({ payload: payload(key.keyId, 'b') });
    expect(await client.size()).toBe(2);
  });
});
