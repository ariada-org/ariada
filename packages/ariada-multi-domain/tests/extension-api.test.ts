// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect } from 'vitest';

import {
  JurisdictionRegistry,
  JurisdictionRegistryError,
  validatePluginShape,
} from '../src/extension-api.js';
import type { JurisdictionPlugin } from '../src/plugin.js';
import { sePlugin, dePlugin, euEaaPlugin } from '../src/plugins/index.js';

describe('JurisdictionRegistry', () => {
  it('registers a plugin and recovers it by code', () => {
    const registry = new JurisdictionRegistry();
    registry.register(sePlugin);
    expect(registry.get('SE')).toBe(sePlugin);
    expect(registry.size).toBe(1);
  });

  it('lists plugins in registration order', () => {
    const registry = new JurisdictionRegistry();
    registry.register(sePlugin);
    registry.register(dePlugin);
    registry.register(euEaaPlugin);
    const codes = registry.list().map((p) => p.jurisdictionCode);
    expect(codes).toEqual(['SE', 'DE-BFSG', 'EU-EAA']);
  });

  it('is idempotent on re-register with same rule pack version', () => {
    const registry = new JurisdictionRegistry();
    registry.register(sePlugin);
    expect(() => registry.register(sePlugin)).not.toThrow();
    expect(registry.size).toBe(1);
  });

  it('rejects re-register with a different rule pack version', () => {
    const registry = new JurisdictionRegistry();
    registry.register(sePlugin);
    const bumped: JurisdictionPlugin = { ...sePlugin, rulePackVersion: '0.2.0' };
    expect(() => registry.register(bumped)).toThrowError(JurisdictionRegistryError);
  });

  it('replace() swaps version explicitly', () => {
    const registry = new JurisdictionRegistry();
    registry.register(sePlugin);
    const bumped: JurisdictionPlugin = { ...sePlugin, rulePackVersion: '0.2.0' };
    registry.replace(bumped);
    expect(registry.get('SE')?.rulePackVersion).toBe('0.2.0');
  });

  it('unregister() removes the plugin', () => {
    const registry = new JurisdictionRegistry();
    registry.register(sePlugin);
    expect(registry.unregister('SE')).toBe(true);
    expect(registry.unregister('SE')).toBe(false);
    expect(registry.size).toBe(0);
  });

  it('clear() empties the registry', () => {
    const registry = new JurisdictionRegistry();
    registry.register(sePlugin);
    registry.register(dePlugin);
    registry.clear();
    expect(registry.size).toBe(0);
  });

  it('values() iterates over all plugins', () => {
    const registry = new JurisdictionRegistry();
    registry.register(sePlugin);
    registry.register(dePlugin);
    const collected = [...registry.values()];
    expect(collected).toHaveLength(2);
  });
});

describe('validatePluginShape', () => {
  it('accepts a well-formed plugin', () => {
    expect(() => validatePluginShape(sePlugin)).not.toThrow();
  });

  it('rejects non-object', () => {
    expect(() => validatePluginShape(null)).toThrowError(JurisdictionRegistryError);
    expect(() => validatePluginShape('not a plugin')).toThrowError(JurisdictionRegistryError);
  });

  it('rejects missing required string fields', () => {
    const bad = { ...sePlugin, jurisdictionCode: '' };
    expect(() => validatePluginShape(bad)).toThrowError(/jurisdictionCode/);
  });

  it('rejects when hint arrays are not arrays', () => {
    const bad = { ...sePlugin, tldHints: 'se' as unknown as string[] };
    expect(() => validatePluginShape(bad)).toThrowError(/tldHints/);
  });

  it('rejects when hint arrays contain non-string entries', () => {
    const bad = { ...sePlugin, metaHints: [42 as unknown as string] };
    expect(() => validatePluginShape(bad)).toThrowError(/metaHints/);
  });

  it('rejects when emitJurisdictionSubset is missing', () => {
    const { emitJurisdictionSubset: _omit, ...rest } = sePlugin;
    void _omit;
    expect(() => validatePluginShape(rest)).toThrowError(/emitJurisdictionSubset/);
  });
});
