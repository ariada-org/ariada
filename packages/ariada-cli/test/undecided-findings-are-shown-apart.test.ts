// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Guard: the summary tells what was found from what nobody could decide.
//
// The grid printed the count of findings and nothing else, so a cell reading
// "11 found" covered eleven confirmed failures and eleven items the analyser
// could not evaluate equally well. Those mean opposite things to whoever reads
// the line: one is a list of things to fix, the other a list of places to look.
//
// Measured on this project's own site with the published tool: eleven contrast
// findings, every one `needsReview` at a confidence of one half, printed as
// "11 found". All eleven pass when the ratio is computed in a browser.
//
// The undecided ones are still shown. Hiding them would be the opposite error,
// and two of those eleven came back at 4.88:1 against a threshold of 4.5 —
// close enough that a person should look.
//
// What is held:
//   1. a cell of only undecided findings says so, and does not say "found";
//   2. a cell of only decided findings still says "found";
//   3. a mixed cell says both counts;
//   4. an empty cell still says "pass";
//   5. the column is wide enough for the longest label it prints, so the table
//      does not break in the one place it is saying something unusual.
import { describe, expect, it } from 'vitest';

import type { MultiDomainReport } from '@ariada-org/core-engine';

import { renderMultiDomainReport } from '../src/subcommands/render-multi-domain-report.js';

/** A report with one site and one domain carrying the given findings. */
function reportWith(findings: unknown[]): MultiDomainReport {
  return {
    sites: ['https://one.example/'],
    domains: ['accessibility'],
    grid: { 'https://one.example/': { accessibility: findings } },
    interactions: [],
    crossSite: { systemic: [], divergence: [] },
  } as unknown as MultiDomainReport;
}

const decided = { ruleId: 'image-alt', severity: 'serious' };
const undecided = { ruleId: 'color-contrast', severity: 'serious', needsReview: true };

describe('the scan summary', () => {
  it('does not call an undecided finding a finding', () => {
    const out = renderMultiDomainReport(reportWith([undecided, undecided]));
    expect(out).toContain('2 to review');
    expect(out).not.toContain('2 found');
  });

  it('still says found for a decided one', () => {
    expect(renderMultiDomainReport(reportWith([decided]))).toContain('1 found');
  });

  it('says both when a cell holds both', () => {
    const out = renderMultiDomainReport(reportWith([decided, undecided, undecided]));
    expect(out).toContain('1 found, 2 to review');
  });

  it('says pass when there is nothing at all', () => {
    expect(renderMultiDomainReport(reportWith([]))).toContain('pass');
  });

  it('widens the column to fit the longest thing it prints', () => {
    const out = renderMultiDomainReport(reportWith([decided, undecided]));
    const row = out.split('\n').find((l) => l.includes('1 found, 1 to review'));
    const header = out.split('\n').find((l) => l.includes('accessibility'));
    expect(row).toBeDefined();
    expect(header).toBeDefined();
    // The cell must not run past the header's width: a row longer than its
    // header is a table that has come apart.
    expect(row!.length).toBeLessThanOrEqual(header!.length);
  });
});
