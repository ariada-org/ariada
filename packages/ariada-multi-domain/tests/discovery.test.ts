// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Tests for the Node-side filesystem discovery path in @ariada-org/multi-domain.
//
// The browser-portable engine (core-engine) handles built-in and config-supplied
// domains. This package adds the npm-convention filesystem path: scanning a
// workspace root's packages/ and node_modules/ directories for packages whose
// name matches the ariada-domain-* convention. These tests exercise that path
// using the ariada-domain-fixture package at the workspace root.
//
// Invariants under test:
//   - discoverDomains with packageRoots pointing at the workspace root discovers
//     every package in packages/ whose name matches the naming convention.
//   - The discovered domain appears in the returned list alongside built-ins.
//   - Results are de-duplicated by id when the same module appears via both
//     packageRoots and the modules config option.
//   - includeBuiltins: false scopes the result to filesystem-discovered domains.
//   - An empty or inaccessible root is skipped silently with no error.

import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { discoverDomains } from '../src/discovery.js';

// ---------------------------------------------------------------------------
// Workspace root — points to the monorepo root so discoverFromRoot scans
// packages/ and finds ariada-domain-fixture (which follows the naming
// convention and has a built dist/index.js).
// ---------------------------------------------------------------------------

// tests/ -> ariada-multi-domain/ -> packages/ -> adopta/ (3 levels up)
const WORKSPACE_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

describe('npm-convention filesystem discovery (packageRoots)', () => {
  it('discovers a package matching the ariada-domain-* convention under packages/', async () => {
    const domains = await discoverDomains({ packageRoots: [WORKSPACE_ROOT] });
    const ids = domains.map((d) => d.id);
    expect(ids).toContain('fixture-domain');
  });

  it('discovered domain appears alongside built-in domains when includeBuiltins is not set', async () => {
    const domains = await discoverDomains({ packageRoots: [WORKSPACE_ROOT] });
    const ids = domains.map((d) => d.id);
    expect(ids).toContain('accessibility');
    expect(ids).toContain('fixture-domain');
  });

  it('de-duplicates when the same domain id is supplied via both packageRoots and modules', async () => {
    // Simulate supplying fixture-domain both from the filesystem path AND
    // explicitly via modules (as config might do). Only one copy must survive.
    const { fixtureDomain } = await import(
      fileURLToPath(
        new URL(
          '../../../packages/ariada-domain-fixture/dist/index.js',
          import.meta.url,
        ),
      )
    );

    const domains = await discoverDomains({
      packageRoots: [WORKSPACE_ROOT],
      modules: [fixtureDomain],
    });

    const fixtureDomains = domains.filter((d) => d.id === 'fixture-domain');
    expect(fixtureDomains).toHaveLength(1);
  });

  it('returns only filesystem-discovered domains when includeBuiltins is false', async () => {
    const domains = await discoverDomains({
      packageRoots: [WORKSPACE_ROOT],
      includeBuiltins: false,
    });
    const ids = domains.map((d) => d.id);
    expect(ids).toContain('fixture-domain');
    expect(ids).not.toContain('accessibility');
  });

  it('skips an inaccessible root silently without throwing', async () => {
    await expect(
      discoverDomains({
        packageRoots: [join(WORKSPACE_ROOT, 'does-not-exist-xyz')],
      }),
    ).resolves.not.toThrow();
  });

  it('returns built-ins even when packageRoots contains no matching packages', async () => {
    // A root with no ariada-domain-* packages still returns the built-in domains.
    const domains = await discoverDomains({
      packageRoots: [join(WORKSPACE_ROOT, 'does-not-exist-xyz')],
    });
    const ids = domains.map((d) => d.id);
    expect(ids).toContain('accessibility');
  });
});
