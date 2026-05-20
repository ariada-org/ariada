// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';

import { SNAPSHOT_SCHEMA_VERSION } from '../src/schema-version.js';
import {
  unifiedSnapshotSchema,
  snapshotSchemaVersion,
} from '../src/snapshot-schema.js';
import type { UnifiedSnapshot } from '../src/types.js';
import { validateSnapshot } from '../src/validators.js';

function fixtureSnapshot(over: Partial<UnifiedSnapshot> = {}): UnifiedSnapshot {
  return {
    scanId: 'scan-1',
    url: 'https://example.com',
    timestamp: 1_700_000_000_000,
    axTree: [],
    domOutline: [],
    perfMetrics: {},
    networkResources: [],
    timings: { navigationMs: 10, axTreeMs: 5, domMs: 3, totalMs: 18 },
    ...over,
  };
}

describe('unifiedSnapshotSchema — positive parses', () => {
  it('parses an empty-tree snapshot', () => {
    expect(unifiedSnapshotSchema.parse(fixtureSnapshot()).scanId).toBe('scan-1');
  });

  it('parses with populated axTree', () => {
    const snap = fixtureSnapshot({
      axTree: [
        {
          nodeId: '1',
          role: { type: 'role', value: 'button' },
          name: { type: 'computedString', value: 'Submit' },
        },
      ],
    });
    expect(unifiedSnapshotSchema.parse(snap).axTree).toHaveLength(1);
  });

  it('parses with domOutline + networkResources populated', () => {
    const snap = fixtureSnapshot({
      domOutline: [{ backendNodeId: 5, nodeName: 'BUTTON', selector: '.btn' }],
      networkResources: [{ url: 'https://example.com/a.js', status: 200, size: 1024 }],
    });
    expect(unifiedSnapshotSchema.parse(snap).domOutline).toHaveLength(1);
  });
});

describe('unifiedSnapshotSchema — negative parses', () => {
  it('rejects missing scanId', () => {
    const { scanId: _omitted, ...rest } = fixtureSnapshot();
    expect(() => unifiedSnapshotSchema.parse(rest)).toThrow();
  });

  it('rejects negative timings', () => {
    const snap = fixtureSnapshot({
      timings: { navigationMs: -1, axTreeMs: 0, domMs: 0, totalMs: 0 },
    });
    expect(() => unifiedSnapshotSchema.parse(snap)).toThrow();
  });

  it('rejects axTree with malformed node (empty nodeId)', () => {
    const snap = fixtureSnapshot({
      axTree: [{ nodeId: '' }],
    });
    expect(() => unifiedSnapshotSchema.parse(snap)).toThrow();
  });
});

describe('validateSnapshot helper', () => {
  it('returns typed snapshot on valid', () => {
    const snap = validateSnapshot(fixtureSnapshot());
    expect(snap.url).toBe('https://example.com');
  });

  it('throws on invalid', () => {
    expect(() => validateSnapshot({ scanId: 'x' })).toThrow();
  });
});

describe('schema version', () => {
  it('is 0.1 for v0.1.0 release', () => {
    expect(SNAPSHOT_SCHEMA_VERSION).toBe('0.1');
    expect(snapshotSchemaVersion).toBe('0.1');
  });
});
