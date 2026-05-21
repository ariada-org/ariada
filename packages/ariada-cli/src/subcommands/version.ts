// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { emitError, CliError } from '../errors.js';
import { EXIT_OK, EXIT_RUNTIME_ERROR, type ExitCode } from '../exit-codes.js';

interface PackageJsonLike {
  name?: string;
  version?: string;
}

/**
 * Best-effort read of a workspace package.json for version reporting.
 * Returns "unknown" if the file cannot be located (e.g., when running from
 * a single-file bundle in the future).
 */
async function readWorkspaceVersion(packageName: string): Promise<string> {
  try {
    // Resolve relative to this file's URL: dist/subcommands/version.js
    const here = dirname(fileURLToPath(import.meta.url));
    // Try common monorepo + npm layouts.
    const candidates = [
      // From dist/subcommands/version.js → ../../../<packageName>/package.json
      join(here, '..', '..', '..', packageName.replace('@ariada-org/', 'ariada-'), 'package.json'),
      join(here, '..', '..', '..', packageName.replace('@ariada-org/', ''), 'package.json'),
      // npm-published layout: node_modules/<packageName>/package.json
      join(here, '..', '..', '..', 'node_modules', packageName, 'package.json'),
    ];
    for (const candidate of candidates) {
      try {
        const raw = await readFile(candidate, 'utf8');
        const pkg = JSON.parse(raw) as PackageJsonLike;
        if (typeof pkg.version === 'string') return pkg.version;
      } catch {
        /* try next candidate */
      }
    }
  } catch {
    /* fall through */
  }
  return 'unknown';
}

async function readOwnVersion(): Promise<string> {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    // dist/subcommands/version.js → ../../package.json
    const raw = await readFile(join(here, '..', '..', 'package.json'), 'utf8');
    const pkg = JSON.parse(raw) as PackageJsonLike;
    return typeof pkg.version === 'string' ? pkg.version : 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Print the CLI version, peer @ariada-org/* dependency versions, and the Node version.
 * Output is intentionally machine-friendly (key=value lines) so it can be grepped.
 */
export async function runVersion(
  stdout: NodeJS.WritableStream = process.stdout,
  stderr: NodeJS.WritableStream = process.stderr,
): Promise<ExitCode> {
  try {
    const [own, coreEngine, corePlaywright, wcagRulesExtended] = await Promise.all([
      readOwnVersion(),
      readWorkspaceVersion('@ariada-org/core-engine'),
      readWorkspaceVersion('@ariada-org/core-playwright'),
      readWorkspaceVersion('@ariada-org/wcag-rules-extended'),
    ]);

    const lines = [
      `@ariada-org/cli ${own}`,
      `@ariada-org/core-engine ${coreEngine}`,
      `@ariada-org/core-playwright ${corePlaywright}`,
      `@ariada-org/wcag-rules-extended ${wcagRulesExtended}`,
      `node ${process.versions.node}`,
    ];
    stdout.write(`${lines.join('\n')}\n`);
    return EXIT_OK;
  } catch (err) {
    emitError(
      new CliError('E_INTERNAL', err instanceof Error ? err.message : String(err)),
      stderr,
    );
    return EXIT_RUNTIME_ERROR;
  }
}
