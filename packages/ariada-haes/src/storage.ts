// SPDX-License-Identifier: EUPL-1.2
//
// Reference in-memory storage backend. Production deployments swap this for
// a Postgres-backed adapter (separate package) — the interface stays the
// same so consumers can choose at construction time.

import { GENESIS_PREV_HASH } from './attest.js';
import type { HaesEntry } from './types.js';

/**
 * Minimal interface every storage backend implements. Append must be atomic
 * + idempotent on duplicate `entry_id`. Range queries return entries in
 * ascending `entry_id` order.
 */
export interface HaesStorageBackend {
  append(entry: HaesEntry): Promise<HaesEntry>;
  getEntry(entryId: string): Promise<HaesEntry | null>;
  getLatestEntry(): Promise<HaesEntry | null>;
  getEntriesInRange(fromIso: string, toIso: string): Promise<HaesEntry[]>;
  getAllEntries(): Promise<HaesEntry[]>;
  size(): Promise<number>;
}

/**
 * In-memory backend — keeps an ordered array of entries plus a Map index
 * for O(1) idempotency checks.
 */
export class InMemoryStorage implements HaesStorageBackend {
  private readonly entries: HaesEntry[] = [];
  private readonly byId = new Map<string, HaesEntry>();

  /**
   *
   */
  async append(entry: HaesEntry): Promise<HaesEntry> {
    const existing = this.byId.get(entry.entry_id);
    if (existing !== undefined) {
      // Idempotent: identical entry_id returns the originally-stored entry.
      return existing;
    }
    const tail = this.entries[this.entries.length - 1];
    const expectedPrev = tail === undefined ? GENESIS_PREV_HASH : tail.entry_hash;
    if (entry.prev_hash !== expectedPrev) {
      throw new Error(
        `chain link mismatch: entry.prev_hash=${entry.prev_hash}, ` +
          `expected ${expectedPrev}`,
      );
    }
    if (tail !== undefined && entry.timestamp < tail.timestamp) {
      throw new Error(
        `monotonic timestamp violated: ${entry.timestamp} < ${tail.timestamp}`,
      );
    }
    this.entries.push(entry);
    this.byId.set(entry.entry_id, entry);
    return entry;
  }

  /**
   *
   */
  async getEntry(entryId: string): Promise<HaesEntry | null> {
    return this.byId.get(entryId) ?? null;
  }

  /**
   *
   */
  async getLatestEntry(): Promise<HaesEntry | null> {
    return this.entries[this.entries.length - 1] ?? null;
  }

  /**
   *
   */
  async getEntriesInRange(fromIso: string, toIso: string): Promise<HaesEntry[]> {
    return this.entries.filter((e) => e.timestamp >= fromIso && e.timestamp < toIso);
  }

  /**
   *
   */
  async getAllEntries(): Promise<HaesEntry[]> {
    return [...this.entries];
  }

  /**
   *
   */
  async size(): Promise<number> {
    return this.entries.length;
  }
}
