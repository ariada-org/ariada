// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/topology.js` and `dist/topology.d.ts`. The source this
// was built from was never committed; the compiled output is `tsc` with the
// types stripped, so the shapes come back from the declaration file and the
// bodies are the compiled ones. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.
//
// WHERE THE PACKAGE GLOBS COME FROM, AND WHY THREE PLACES. A workspace may
// declare them in its own configuration, or in the root manifest as a list, or
// in the root manifest as an object with a list inside. All three are in use in
// the wild, and reading only one would silently find no packages in a workspace
// that has plenty — which looks exactly like a workspace with nothing to scan.
//
// A negated glob is turned into an exclusion rather than searched for. Left as
// an include it would match nothing and quietly widen the scan to everything the
// author meant to leave out.
//
// TWO REFUSALS ARE DELIBERATE. No packages at all is an error, because a
// topology that found none is far more likely to be a misread configuration than
// an empty workspace. And two packages with the same name is an error, because
// everything downstream keys results by name, and the second would overwrite the
// first with nobody told.
//
// Path separators are normalised so a relative path reads the same on every
// machine; it goes into the report, and a report that differs by operating
// system cannot be compared with yesterday's.

import { glob, readFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';

export interface WorkspacePackage {
  name: string;
  path: string;
  relativePath: string;
  hasA11yScript: boolean;
}

export interface LernaTopology {
  root: string;
  patterns: string[];
  packages: WorkspacePackage[];
  a11yPackages: WorkspacePackage[];
}

export class TopologyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TopologyError';
  }
}

async function json(path: string): Promise<Record<string, unknown>> {
  try {
    const value = JSON.parse(await readFile(path, 'utf8'));
    if (value === null || typeof value !== 'object' || Array.isArray(value))
      throw new Error('root must be an object');
    return value as Record<string, unknown>;
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new TopologyError('Cannot parse ' + path + ': ' + message);
  }
}

function strings(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || entry.length === 0))
    return undefined;
  return value as string[];
}

function workspacePatterns(rootManifest: Record<string, unknown>, lerna: Record<string, unknown>): string[] {
  const configured = strings(lerna['packages']);
  if (configured !== undefined && configured.length > 0) return configured;
  const workspaces = rootManifest['workspaces'];
  const direct = strings(workspaces);
  if (direct !== undefined && direct.length > 0) return direct;
  if (workspaces !== null && typeof workspaces === 'object' && !Array.isArray(workspaces)) {
    const nested = strings((workspaces as Record<string, unknown>)['packages']);
    if (nested !== undefined && nested.length > 0) return nested;
  }
  throw new TopologyError('No package globs in lerna.json or root package.json workspaces');
}

export async function findWorkspaceRoot(start: string): Promise<string> {
  let current = resolve(start);
  for (;;) {
    try {
      await readFile(resolve(current, 'lerna.json'), 'utf8');
      return current;
    }
    catch (error) {
      const code = error !== null && typeof error === 'object' && 'code' in error ? String(error.code) : '';
      if (code !== 'ENOENT') throw error;
    }
    const parent = dirname(current);
    if (parent === current) throw new TopologyError('No lerna.json found from ' + resolve(start));
    current = parent;
  }
}

export async function readTopology(workspaceRoot: string): Promise<LernaTopology> {
  const root = resolve(workspaceRoot);
  const [lerna, rootManifest] = await Promise.all([
    json(resolve(root, 'lerna.json')),
    json(resolve(root, 'package.json'))
  ]);
  const patterns = workspacePatterns(rootManifest, lerna);
  const excludes = patterns.filter((pattern) => pattern.startsWith('!')).map((pattern) => pattern.slice(1) + '/package.json');
  const includes = patterns.filter((pattern) => !pattern.startsWith('!'));
  const manifests = new Set<string>();
  for (const pattern of includes) {
    for await (const match of glob(pattern.replace(/\/$/, '') + '/package.json', {
      cwd: root,
      exclude: ['**/node_modules/**', ...excludes]
    }))
      manifests.add(String(match));
  }
  const packages: WorkspacePackage[] = [];
  for (const manifestPath of [...manifests].sort()) {
    const manifest = await json(resolve(root, manifestPath));
    const name = manifest['name'];
    if (typeof name !== 'string' || name.length === 0)
      throw new TopologyError(manifestPath + ' has no package name');
    const scripts = manifest['scripts'];
    const hasA11yScript = scripts !== null && typeof scripts === 'object' && !Array.isArray(scripts) && typeof (scripts as Record<string, unknown>)['a11y'] === 'string';
    const path = dirname(resolve(root, manifestPath));
    packages.push({ name, path, relativePath: relative(root, path).split('\\').join('/'), hasA11yScript });
  }
  if (packages.length === 0) throw new TopologyError('Lerna topology contains no packages');
  const names = new Set<string>();
  for (const workspacePackage of packages) {
    if (names.has(workspacePackage.name)) throw new TopologyError('Duplicate package name ' + workspacePackage.name);
    names.add(workspacePackage.name);
  }
  return { root, patterns, packages, a11yPackages: packages.filter((item) => item.hasA11yScript) };
}
