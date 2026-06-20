// SPDX-License-Identifier: EUPL-1.2
// Tests for the in-memory rate ledger.
import { describe, it, expect } from 'vitest';
import { InMemoryRateLedger } from '../src/rate-ledger.js';

describe('InMemoryRateLedger', () => {
  it('starts at 0 for a new installation', () => {
    const ledger = new InMemoryRateLedger();
    expect(ledger.currentCount('inst_new')).toBe(0);
  });

  it('increment returns the new count', () => {
    const ledger = new InMemoryRateLedger();
    expect(ledger.increment('inst_a')).toBe(1);
    expect(ledger.increment('inst_a')).toBe(2);
  });

  it('currentCount reflects increments', () => {
    const ledger = new InMemoryRateLedger();
    ledger.increment('inst_b');
    ledger.increment('inst_b');
    expect(ledger.currentCount('inst_b')).toBe(2);
  });

  it('counters are isolated per installation', () => {
    const ledger = new InMemoryRateLedger();
    ledger.increment('inst_x');
    ledger.increment('inst_x');
    ledger.increment('inst_y');
    expect(ledger.currentCount('inst_x')).toBe(2);
    expect(ledger.currentCount('inst_y')).toBe(1);
  });

  it('seedForTest pre-seeds the count', () => {
    const ledger = new InMemoryRateLedger();
    ledger.seedForTest('inst_fixture', 5);
    expect(ledger.currentCount('inst_fixture')).toBe(5);
  });

  it('seedForTest allows triggering rate cap check at boundary', () => {
    const ledger = new InMemoryRateLedger();
    const maxPrs = 5;
    ledger.seedForTest('inst_fixture', maxPrs);
    // At the cap: currentCount == maxPrsPerEvent → should be blocked
    expect(ledger.currentCount('inst_fixture')).toBe(maxPrs);
  });

  it('increment after seedForTest adds to the seeded value', () => {
    const ledger = new InMemoryRateLedger();
    ledger.seedForTest('inst_c', 3);
    expect(ledger.increment('inst_c')).toBe(4);
    expect(ledger.currentCount('inst_c')).toBe(4);
  });
});
