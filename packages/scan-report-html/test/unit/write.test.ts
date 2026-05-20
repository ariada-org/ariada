// SPDX-License-Identifier: EUPL-1.2
// SPDX-FileCopyrightText: 2026 Agonist Development AB
/**
 * Disk-write overload — `renderScanReport(input, { outputDir })`.
 *
 * Verifies the file is written, the path returned matches, and the bytes
 * field matches the actual on-disk length.
 */

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { renderScanReport } from '../../src/index.js';
import { FIXTURE_INPUT } from '../fixtures/findings.js';

let workDir: string;

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'ariada-scan-report-'));
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

describe('renderScanReport — disk-write overload', () => {
  it('writes scan-report.html under outputDir and returns the byte length', async () => {
    const result = await renderScanReport(FIXTURE_INPUT, { outputDir: workDir });
    expect(result.path).toBe(join(workDir, 'scan-report.html'));
    expect(result.bytes).toBeGreaterThan(0);

    const disk = await readFile(result.path, 'utf8');
    expect(Buffer.byteLength(disk, 'utf8')).toBe(result.bytes);
    expect(disk.startsWith('<!doctype html>')).toBe(true);
  });

  it('honours a custom filename when supplied', async () => {
    const result = await renderScanReport(FIXTURE_INPUT, {
      outputDir: workDir,
      filename: 'a11y.html',
    });
    expect(result.path).toBe(join(workDir, 'a11y.html'));
  });

  it('forwards render options (releaseBuild) to the writer', async () => {
    const result = await renderScanReport(FIXTURE_INPUT, {
      outputDir: workDir,
      render: { releaseBuild: false },
    });
    const disk = await readFile(result.path, 'utf8');
    expect(disk).toContain('cert-block hookpoint');
  });

  it('creates the outputDir when it does not exist', async () => {
    const nested = join(workDir, 'reports', '2026-05-19');
    const result = await renderScanReport(FIXTURE_INPUT, { outputDir: nested });
    expect(result.path).toBe(join(nested, 'scan-report.html'));
    const disk = await readFile(result.path, 'utf8');
    expect(disk.length).toBeGreaterThan(0);
  });
});
