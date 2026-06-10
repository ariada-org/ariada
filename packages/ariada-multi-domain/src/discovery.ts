// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  DOMAIN_PACKAGE_CONVENTION,
  dedupeDomainsById,
  discoverDomains as discoverBuiltinAndConfig,
  isDomainModule,
  type DomainModule,
} from '@ariada-org/core-engine';

/**
 * Options for Node-side domain discovery. This is the full discovery surface: it
 * adds the filesystem-backed npm-convention path to the engine's built-in and
 * config paths, which is why it lives in this Node-capable package rather than in
 * the browser-portable engine.
 */
export interface DomainDiscoveryOptions {
  /**
   * Filesystem roots to scan for `ariada-domain-*` packages. Each root's
   * `packages/*` and `node_modules` are checked for packages whose name matches
   * the convention; every exported {@link DomainModule} is imported.
   */
  packageRoots?: readonly string[];
  /** Domains supplied directly by configuration. */
  modules?: readonly DomainModule[];
  /** Set false to skip the bundled built-in domains (default true). */
  includeBuiltins?: boolean;
}

/**
 * Discover every domain module to run: built-in domains, any `ariada-domain-*`
 * package found under the given roots, and config-supplied modules. The result
 * is de-duplicated by id, with built-in first, then filesystem, then config.
 */
export async function discoverDomains(
  opts: DomainDiscoveryOptions,
): Promise<DomainModule[]> {
  const fromPackages: DomainModule[] = [];
  if (opts.packageRoots) {
    for (const root of opts.packageRoots) {
      fromPackages.push(...(await discoverFromRoot(root)));
    }
  }

  // The engine resolves built-ins + config and applies the dedup rule; feed it
  // the filesystem-discovered modules ahead of config so a built-in still wins.
  return discoverBuiltinAndConfig({
    ...(opts.includeBuiltins !== undefined ? { includeBuiltins: opts.includeBuiltins } : {}),
    modules: dedupeDomainsById([...fromPackages, ...(opts.modules ?? [])]),
  });
}

/**
 * Find `ariada-domain-*` packages under a root. Both a `packages/*` workspace
 * layout and a flat `node_modules` layout are scanned; a package qualifies when
 * its `package.json` name matches the npm convention.
 */
async function discoverFromRoot(root: string): Promise<DomainModule[]> {
  const out: DomainModule[] = [];
  const searchDirs = [join(root, 'packages'), join(root, 'node_modules')];

  for (const dir of searchDirs) {
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const modules = await tryLoadDomainPackage(join(dir, entry));
      if (modules) out.push(...modules);
    }
  }

  return out;
}

/**
 * Load a package directory as a domain package when its name matches the npm
 * convention. Returns every exported {@link DomainModule} (default + named).
 */
async function tryLoadDomainPackage(pkgDir: string): Promise<DomainModule[] | undefined> {
  let pkgJsonRaw: string;
  try {
    pkgJsonRaw = await readFile(join(pkgDir, 'package.json'), 'utf8');
  } catch {
    return undefined;
  }

  let name: unknown;
  let mainEntry: unknown;
  try {
    const parsed = JSON.parse(pkgJsonRaw) as { name?: unknown; main?: unknown };
    name = parsed.name;
    mainEntry = parsed.main;
  } catch {
    return undefined;
  }

  if (typeof name !== 'string' || !DOMAIN_PACKAGE_CONVENTION.test(name)) return undefined;

  const entryRel = typeof mainEntry === 'string' ? mainEntry : 'dist/index.js';
  const entryUrl = pathToFileURL(join(pkgDir, entryRel)).href;

  let imported: Record<string, unknown>;
  try {
    imported = (await import(entryUrl)) as Record<string, unknown>;
  } catch {
    return undefined;
  }

  const modules: DomainModule[] = [];
  for (const value of Object.values(imported)) {
    if (isDomainModule(value)) modules.push(value);
  }
  return modules.length > 0 ? modules : undefined;
}
