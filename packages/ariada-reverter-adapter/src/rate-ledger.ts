// SPDX-License-Identifier: EUPL-1.2
// Copyright Agonist Development AB — see NOTICE
//
// In-memory rate ledger for the adapter.
// Tracks the number of fix-PRs opened per installation per UTC day.
// A production deployment would persist this in a database; the adapter
// accepts any implementation behind the RateLedger interface.

/** Abstraction over the per-org, per-day fix-PR counter. */
export interface RateLedger {
  /**
   * Record one fix-PR opened for the given installation on today's UTC date.
   * Returns the new daily total after incrementing.
   */
  increment(installationId: string): number;

  /**
   * Return the number of fix-PRs already opened today for the installation.
   */
  currentCount(installationId: string): number;
}

/**
 * Fully in-memory rate ledger — suitable for tests and serverless deployments
 * where state is scoped to one request/worker invocation.
 *
 * Production should substitute a persistent backend (e.g. database row with
 * a UTC-date composite key).
 */
export class InMemoryRateLedger implements RateLedger {
  readonly #counts = new Map<string, number>();

  #key(installationId: string): string {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    return `${installationId}:${today}`;
  }

  increment(installationId: string): number {
    const key = this.#key(installationId);
    const next = (this.#counts.get(key) ?? 0) + 1;
    this.#counts.set(key, next);
    return next;
  }

  currentCount(installationId: string): number {
    return this.#counts.get(this.#key(installationId)) ?? 0;
  }

  /**
   * Pre-seed the ledger for testing.
   * Sets the count for the given installation to `count` for today's date.
   */
  seedForTest(installationId: string, count: number): void {
    const key = this.#key(installationId);
    this.#counts.set(key, count);
  }
}
