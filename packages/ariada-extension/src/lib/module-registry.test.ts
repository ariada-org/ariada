// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import type { DomainModule } from '@ariada-org/core-engine';
import { describe, it, expect, beforeEach } from 'vitest';

import { ModuleRegistry, type LoadedModule } from './module-registry.js';

function makeModule(overrides: Partial<LoadedModule> = {}): LoadedModule {
  return {
    id: 'test-domain',
    module: null,
    source: 'built-in',
    trusted: true,
    displayName: 'Test Domain',
    version: '0.1.0',
    ...overrides,
  };
}

describe('ModuleRegistry', () => {
  let registry: ModuleRegistry;

  beforeEach(() => {
    registry = new ModuleRegistry();
  });

  it('starts empty', () => {
    expect(registry.size).toBe(0);
    expect(registry.getAll()).toEqual([]);
  });

  it('registers a module and returns it via getAll', () => {
    const mod = makeModule({ id: 'a11y' });
    registry.register(mod);
    expect(registry.size).toBe(1);
    expect(registry.getAll()).toContain(mod);
  });

  it('overwrites an existing module when re-registered with the same id', () => {
    const v1 = makeModule({ id: 'a11y', version: '0.1.0' });
    const v2 = makeModule({ id: 'a11y', version: '0.2.0' });
    registry.register(v1);
    registry.register(v2);
    expect(registry.size).toBe(1);
    expect(registry.getAll()[0]?.version).toBe('0.2.0');
  });

  it('unregisters a module by id and returns true', () => {
    registry.register(makeModule({ id: 'a11y' }));
    const removed = registry.unregister('a11y');
    expect(removed).toBe(true);
    expect(registry.has('a11y')).toBe(false);
  });

  it('returns false when unregistering an id that does not exist', () => {
    expect(registry.unregister('missing')).toBe(false);
  });

  it('getTrusted returns only modules where trusted is true', () => {
    registry.register(makeModule({ id: 'trusted', trusted: true }));
    registry.register(makeModule({ id: 'sandboxed', trusted: false, source: 'local-file' }));
    const trusted = registry.getTrusted();
    expect(trusted.map((m) => m.id)).toEqual(['trusted']);
  });

  it('getSandboxed returns only modules where trusted is false', () => {
    registry.register(makeModule({ id: 'trusted', trusted: true }));
    registry.register(makeModule({ id: 'sandboxed', trusted: false, source: 'local-file' }));
    const sandboxed = registry.getSandboxed();
    expect(sandboxed.map((m) => m.id)).toEqual(['sandboxed']);
  });

  it('getTrustedModules returns DomainModule objects for trusted modules only', () => {
    const realModule = {
      id: 'a11y',
      title: 'Accessibility',
      version: '0.1.0',
      extractors: { perElement: () => {}, perDocument: () => {} },
      evaluate: () => [],
    } as unknown as DomainModule;

    registry.register(makeModule({ id: 'with-impl', module: realModule, trusted: true }));
    registry.register(makeModule({ id: 'no-impl', module: null, trusted: true }));
    registry.register(makeModule({ id: 'sandboxed', module: null, trusted: false }));

    const modules = registry.getTrustedModules();
    expect(modules).toHaveLength(1);
    expect(modules[0]).toBe(realModule);
  });

  it('toPersistedModules excludes built-in modules', () => {
    registry.register(makeModule({ id: 'builtin', source: 'built-in' }));
    registry.register(makeModule({ id: 'cli', source: 'companion-cli', trusted: true }));
    registry.register(makeModule({ id: 'local', source: 'local-file', trusted: false }));

    const persisted = registry.toPersistedModules();
    const ids = persisted.map((p) => p.id);
    expect(ids).not.toContain('builtin');
    expect(ids).toContain('cli');
    expect(ids).toContain('local');
  });

  it('toPersistedModules round-trip preserves source and trust', () => {
    const cliModule = makeModule({ id: 'cli', source: 'companion-cli', trusted: true, version: '1.2.3' });
    registry.register(cliModule);
    const [persisted] = registry.toPersistedModules();
    expect(persisted?.source).toBe('companion-cli');
    expect(persisted?.trusted).toBe(true);
    expect(persisted?.version).toBe('1.2.3');
  });
});
