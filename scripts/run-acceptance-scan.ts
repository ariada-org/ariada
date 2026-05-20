// SPDX-FileCopyrightText: 2025-2026 Alekszandr Bricskin (Agonist Development AB)
// SPDX-License-Identifier: EUPL-1.2
/**
 * Shim entry point for the acceptance-evidence scan campaign.
 *
 * The real implementation lives in tests/acceptance/lib/scan.ts where its
 * dependencies (playwright, @axe-core/playwright, @ariada-org/*) resolve from
 * the `@adopta/acceptance-evidence` workspace's `node_modules`.
 *
 * Why a shim: this file is the documented public entry point per the
 * acceptance-evidence task spec. Running tsx directly on this path from
 * the repo root would fail to resolve `playwright` because the root
 * package.json does not have it as a dependency (it lives in the workspace
 * that owns the scan logic). The shim re-execs tsx with cwd pinned to the
 * acceptance workspace so module resolution finds the right packages.
 *
 * Usage (from repo root):
 *   node --experimental-strip-types scripts/run-acceptance-scan.ts            # full campaign
 *   node --experimental-strip-types scripts/run-acceptance-scan.ts --single   # single-site smoke
 *
 * Or via the workspace directly (no Node TS flag needed):
 *   pnpm --filter @adopta/acceptance-evidence scan
 *   pnpm --filter @adopta/acceptance-evidence scan:single
 *
 * Or fully manually:
 *   cd tests/acceptance && pnpm exec tsx lib/scan.ts [--single]
 */
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const ACCEPTANCE_DIR = resolve(REPO_ROOT, 'tests/acceptance');
const SCAN_TS = resolve(ACCEPTANCE_DIR, 'lib/scan.ts');

// tsx lives in the acceptance workspace's node_modules/.bin.
const TSX_BIN = resolve(ACCEPTANCE_DIR, 'node_modules/.bin/tsx');
const child = spawn(TSX_BIN, [SCAN_TS, ...process.argv.slice(2)], {
  cwd: ACCEPTANCE_DIR,
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
