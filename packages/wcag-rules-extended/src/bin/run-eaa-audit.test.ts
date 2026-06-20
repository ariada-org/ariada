// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Unit tests for the run-eaa-audit CLI entry-point logic.
 *
 * These tests exercise the pure-logic helpers (argument parsing, report
 * shape building, exit-code mapping) without launching a real browser.
 * Browser-based integration is covered by the smoke commands described in
 * the EAA audit CLI documentation (manual / CI fixture-server invocations).
 */

import { describe, it, expect } from 'vitest';
import {
  parseArgs,
  buildReport,
  mapExitCode,
  VALID_IMPACT_LEVELS,
  type CliArgs,
  type ScanReport,
  type ByImpact,
} from './cli-helpers.js';

// ---------------------------------------------------------------------------
// parseArgs
// ---------------------------------------------------------------------------

describe('parseArgs', () => {
  it('returns defaults when only --site-url is provided', () => {
    const argv = ['--site-url', 'https://example.com'];
    const args = parseArgs(argv);
    expect(args.siteUrl).toBe('https://example.com');
    expect(args.pages).toStrictEqual(['/']);
    expect(args.failOn).toStrictEqual(['serious', 'critical']);
    expect(args.outDir).toBe('eaa-out');
    expect(args.emitStatement).toBe(false);
    expect(args.emitEvidence).toBe(true);
    expect(args.locale).toBe('en');
  });

  it('parses --url as an alias for --site-url', () => {
    const args = parseArgs(['--url', 'https://example.com']);
    expect(args.siteUrl).toBe('https://example.com');
  });

  it('parses --pages as comma-separated list', () => {
    const args = parseArgs(['--site-url', 'https://x.com', '--pages', '/,/about,/contact/']);
    expect(args.pages).toStrictEqual(['/', '/about', '/contact/']);
  });

  it('parses --fail-on as comma-separated impact levels', () => {
    const args = parseArgs(['--site-url', 'https://x.com', '--fail-on', 'critical,minor']);
    expect(args.failOn).toStrictEqual(['critical', 'minor']);
  });

  it('parses --out-dir', () => {
    const args = parseArgs(['--site-url', 'https://x.com', '--out-dir', '/tmp/out']);
    expect(args.outDir).toBe('/tmp/out');
  });

  it('parses --locale', () => {
    const args = parseArgs(['--site-url', 'https://x.com', '--locale', 'sv']);
    expect(args.locale).toBe('sv');
  });

  it('parses --emit-statement true', () => {
    const args = parseArgs(['--site-url', 'https://x.com', '--emit-statement', 'true']);
    expect(args.emitStatement).toBe(true);
  });

  it('parses --emit-evidence false', () => {
    const args = parseArgs(['--site-url', 'https://x.com', '--emit-evidence', 'false']);
    expect(args.emitEvidence).toBe(false);
  });

  it('throws on missing --site-url and --url', () => {
    expect(() => parseArgs([])).toThrow(/site-url/i);
  });

  it('throws on invalid impact level in --fail-on', () => {
    expect(() =>
      parseArgs(['--site-url', 'https://x.com', '--fail-on', 'serious,INVALID']),
    ).toThrow(/invalid.*fail-on/i);
  });

  it('throws on non-https URL', () => {
    expect(() => parseArgs(['--site-url', 'http://example.com'])).toThrow(/https/i);
  });

  it('allows localhost http for testing', () => {
    // localhost http:// is an allowed test exemption
    const args = parseArgs(['--site-url', 'http://localhost:9999']);
    expect(args.siteUrl).toBe('http://localhost:9999');
  });

  it('VALID_IMPACT_LEVELS contains exactly four levels', () => {
    expect(VALID_IMPACT_LEVELS).toStrictEqual(['minor', 'moderate', 'serious', 'critical']);
  });
});

// ---------------------------------------------------------------------------
// buildReport
// ---------------------------------------------------------------------------

describe('buildReport', () => {
  const mockByImpact: ByImpact = { critical: 0, serious: 0, moderate: 0, minor: 0 };

  it('sets verdict PASS when totalViolations is 0', () => {
    const report = buildReport({
      totalViolations: 0,
      byImpact: mockByImpact,
      perPage: [],
      scannerPackVersion: '0.1.0',
      failOn: ['serious', 'critical'],
      pagesScanned: 1,
    });
    expect(report.verdict).toBe('PASS');
  });

  it('sets verdict PASS when violations exist but not in fail-on levels', () => {
    const report = buildReport({
      totalViolations: 3,
      byImpact: { critical: 0, serious: 0, moderate: 2, minor: 1 },
      perPage: [],
      scannerPackVersion: '0.1.0',
      failOn: ['serious', 'critical'],
      pagesScanned: 1,
    });
    expect(report.verdict).toBe('PASS');
  });

  it('sets verdict FAIL when serious violation exists and serious is in fail-on', () => {
    const report = buildReport({
      totalViolations: 2,
      byImpact: { critical: 0, serious: 2, moderate: 0, minor: 0 },
      perPage: [],
      scannerPackVersion: '0.1.0',
      failOn: ['serious', 'critical'],
      pagesScanned: 1,
    });
    expect(report.verdict).toBe('FAIL');
  });

  it('sets verdict FAIL when critical violation exists', () => {
    const report = buildReport({
      totalViolations: 1,
      byImpact: { critical: 1, serious: 0, moderate: 0, minor: 0 },
      perPage: [],
      scannerPackVersion: '0.1.0',
      failOn: ['serious', 'critical'],
      pagesScanned: 1,
    });
    expect(report.verdict).toBe('FAIL');
  });

  it('preserves pagesScanned in output', () => {
    const report = buildReport({
      totalViolations: 0,
      byImpact: mockByImpact,
      perPage: [],
      scannerPackVersion: '0.1.0',
      failOn: [],
      pagesScanned: 3,
    });
    expect(report.pagesScanned).toBe(3);
  });

  it('includes scannerPackVersion in output', () => {
    const report = buildReport({
      totalViolations: 0,
      byImpact: mockByImpact,
      perPage: [],
      scannerPackVersion: '1.2.3',
      failOn: [],
      pagesScanned: 1,
    });
    expect(report.scannerPackVersion).toBe('1.2.3');
  });
});

// ---------------------------------------------------------------------------
// mapExitCode
// ---------------------------------------------------------------------------

describe('mapExitCode', () => {
  it('returns 0 for PASS verdict', () => {
    expect(mapExitCode('PASS')).toBe(0);
  });

  it('returns 1 for FAIL verdict', () => {
    expect(mapExitCode('FAIL')).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Type-shape sanity
// ---------------------------------------------------------------------------

describe('type shapes', () => {
  it('CliArgs has required siteUrl field', () => {
    const args: CliArgs = {
      siteUrl: 'https://example.com',
      pages: ['/'],
      failOn: ['serious', 'critical'],
      outDir: 'eaa-out',
      emitStatement: false,
      emitEvidence: true,
      locale: 'en',
    };
    expect(args.siteUrl).toBe('https://example.com');
  });

  it('ScanReport has all required fields', () => {
    const report: ScanReport = {
      verdict: 'PASS',
      totalViolations: 0,
      byImpact: { critical: 0, serious: 0, moderate: 0, minor: 0 },
      perPage: [],
      scannerPackVersion: '0.1.0',
      pagesScanned: 1,
      failOn: ['serious', 'critical'],
    };
    expect(report.verdict).toBe('PASS');
  });
});
