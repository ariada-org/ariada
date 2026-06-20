// SPDX-License-Identifier: EUPL-1.2
//
// Stub smoke integration tests — verifies the smoke-stub.mjs script
// produces the correct exit code and summary output when run against
// the clamper fixture JSON files, WITHOUT requiring the ariada CLI.

import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(HERE, '..', '..');
// Find the monorepo root (4 levels up from this file)
const MONO_ROOT = join(HERE, '..', '..', '..', '..');
const FIXTURES = join(MONO_ROOT, 'packages', 'ariada-test-fixtures', 'fixtures');
const SMOKE_SCRIPT = join(PKG_ROOT, 'scripts', 'smoke-stub.mjs');

function runSmoke(headFile: string, baseFile: string) {
  return spawnSync(
    process.execPath,
    [SMOKE_SCRIPT, '--head', headFile, '--base', baseFile],
    { encoding: 'utf8', timeout: 10_000 },
  );
}

describe('smoke-stub.mjs script', () => {
  it('exists at the scripts directory', () => {
    expect(existsSync(SMOKE_SCRIPT)).toBe(true);
  });

  it('fixture files exist', () => {
    expect(existsSync(join(FIXTURES, 'head-scan-regression.json'))).toBe(true);
    expect(existsSync(join(FIXTURES, 'head-scan-clean.json'))).toBe(true);
    expect(existsSync(join(FIXTURES, 'base-scan.json'))).toBe(true);
    expect(existsSync(join(FIXTURES, 'vercel-dashboard-mock.html'))).toBe(true);
  });
});

describe('regression fixture: 3 new findings', () => {
  it('exits with code 1 (fail) when 3 new violations are present', () => {
    const result = runSmoke(
      join(FIXTURES, 'head-scan-regression.json'),
      join(FIXTURES, 'base-scan.json'),
    );
    expect(result.status).toBe(1);
  });

  it('reports FAIL result in stdout', () => {
    const result = runSmoke(
      join(FIXTURES, 'head-scan-regression.json'),
      join(FIXTURES, 'base-scan.json'),
    );
    expect(result.stdout).toContain('FAIL');
  });

  it('reports 3 new findings', () => {
    const result = runSmoke(
      join(FIXTURES, 'head-scan-regression.json'),
      join(FIXTURES, 'base-scan.json'),
    );
    expect(result.stdout).toContain('New:         3');
  });

  it('reports 27 pre-existing findings', () => {
    const result = runSmoke(
      join(FIXTURES, 'head-scan-regression.json'),
      join(FIXTURES, 'base-scan.json'),
    );
    expect(result.stdout).toContain('Pre-existing: 27');
  });

  it('includes WCAG 2.1 SC 1.4.3 in new findings detail', () => {
    const result = runSmoke(
      join(FIXTURES, 'head-scan-regression.json'),
      join(FIXTURES, 'base-scan.json'),
    );
    expect(result.stdout).toContain('WCAG 2.1 SC 1.4.3');
  });

  it('includes button-name finding detail', () => {
    const result = runSmoke(
      join(FIXTURES, 'head-scan-regression.json'),
      join(FIXTURES, 'base-scan.json'),
    );
    expect(result.stdout).toContain('button-name');
  });

  it('renders PR comment markdown with fail label', () => {
    const result = runSmoke(
      join(FIXTURES, 'head-scan-regression.json'),
      join(FIXTURES, 'base-scan.json'),
    );
    // The renderPrComment output includes the fail label
    expect(result.stdout).toContain('`fail`');
    expect(result.stdout).toContain('❌');
  });

  it('renders PR comment with summary table (gate status row)', () => {
    const result = runSmoke(
      join(FIXTURES, 'head-scan-regression.json'),
      join(FIXTURES, 'base-scan.json'),
    );
    // Rich Markdown table — SonarCloud/Codecov pattern
    expect(result.stdout).toContain('| Gate status |');
    expect(result.stdout).toContain('| New violations');
    expect(result.stdout).toContain('| Pre-existing');
  });
});

describe('clean fixture: 0 new findings', () => {
  it('exits with code 0 (pass) when 0 new violations are present', () => {
    const result = runSmoke(
      join(FIXTURES, 'head-scan-clean.json'),
      join(FIXTURES, 'base-scan.json'),
    );
    expect(result.status).toBe(0);
  });

  it('reports PASS result in stdout', () => {
    const result = runSmoke(
      join(FIXTURES, 'head-scan-clean.json'),
      join(FIXTURES, 'base-scan.json'),
    );
    expect(result.stdout).toContain('PASS');
  });

  it('reports 0 new findings', () => {
    const result = runSmoke(
      join(FIXTURES, 'head-scan-clean.json'),
      join(FIXTURES, 'base-scan.json'),
    );
    expect(result.stdout).toContain('New:         0');
  });

  it('reports 27 pre-existing findings (not blocking)', () => {
    const result = runSmoke(
      join(FIXTURES, 'head-scan-clean.json'),
      join(FIXTURES, 'base-scan.json'),
    );
    expect(result.stdout).toContain('Pre-existing: 27');
  });

  it('renders PR comment markdown with pass label', () => {
    const result = runSmoke(
      join(FIXTURES, 'head-scan-clean.json'),
      join(FIXTURES, 'base-scan.json'),
    );
    expect(result.stdout).toContain('`pass`');
    expect(result.stdout).toContain('✅');
  });

  it('renders PR comment with summary table for clean result', () => {
    const result = runSmoke(
      join(FIXTURES, 'head-scan-clean.json'),
      join(FIXTURES, 'base-scan.json'),
    );
    expect(result.stdout).toContain('| Gate status |');
    expect(result.stdout).toContain('| New violations');
  });
});

describe('missing arguments handling', () => {
  it('exits with code 2 when no arguments provided', () => {
    const result = spawnSync(process.execPath, [SMOKE_SCRIPT], {
      encoding: 'utf8',
      timeout: 5_000,
    });
    expect(result.status).toBe(2);
  });
});
