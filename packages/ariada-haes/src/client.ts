// SPDX-License-Identifier: EUPL-1.2
//
// HaesClient — orchestrates the append pipeline: pull the chain's tail
// hash from storage, build a signed entry, persist it, return the result.
//
// The client is storage-agnostic by construction. Reference impl ships an
// in-memory backend for tests and embedded use; production deployments
// inject a Postgres or HTTP backend implementing the same interface.

import { GENESIS_PREV_HASH, buildEntry } from './attest.js';
import type { Ed25519Keypair } from './crypto.js';
import {
  InMemoryStorage,
  type HaesStorageBackend,
} from './storage.js';
import type { AppendInput, AppendResult, HaesEntry } from './types.js';
import { verifyChain } from './verify.js';

/**
 *
 */
export interface HaesClientOptions {
  signingKey: Ed25519Keypair;
  storage?: HaesStorageBackend;
  tenantId?: string;
}

/**
 *
 */
export class HaesClient {
  private readonly storage: HaesStorageBackend;
  private readonly signingKey: Ed25519Keypair;
  private readonly tenantId: string | undefined;

  /**
   *
   */
  constructor(options: HaesClientOptions) {
    this.signingKey = options.signingKey;
    this.storage = options.storage ?? new InMemoryStorage();
    this.tenantId = options.tenantId;
  }

  /**
   * Append a fresh entry to the chain. The `payload.signing_key_id` field
   * MUST equal the client's signing key id; the caller supplies it so the
   * payload is self-describing under the canonical hash.
   */
  async append(input: AppendInput): Promise<AppendResult> {
    const tail = await this.storage.getLatestEntry();
    const prev = tail === null ? GENESIS_PREV_HASH : tail.entry_hash;
    const effectiveInput: AppendInput = {
      ...input,
      ...(this.tenantId !== undefined && input.tenant_id === undefined
        ? { tenant_id: this.tenantId }
        : {}),
    };
    const entry = buildEntry(effectiveInput, prev, this.signingKey);
    const persisted = await this.storage.append(entry);
    return { entry: persisted };
  }

  /**
   * Pull all entries from storage and verify the full chain end-to-end.
   * The caller supplies a key-resolution callback so multi-key chains can
   * be validated by passing in `keyId => raw32Bytes` lookups.
   */
  async verifyAll(
    resolveKey: (keyId: string) => Uint8Array | null,
  ): Promise<ReturnType<typeof verifyChain>> {
    const entries = await this.storage.getAllEntries();
    return verifyChain(entries, resolveKey);
  }

  /** Convenience: snapshot of every entry in append order. */
  async snapshot(): Promise<HaesEntry[]> {
    return this.storage.getAllEntries();
  }

  /** Size of the underlying chain. */
  async size(): Promise<number> {
    return this.storage.size();
  }
}
