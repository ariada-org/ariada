// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect } from 'vitest';
import {
  renderGitHubComment,
  renderVercelComment,
  renderQuotaExceededComment,
  renderAuthErrorComment,
} from '../src/renderers.js';
import type { BlamedReport } from '../src/types.js';

function makeReport(overrides: Partial<BlamedReport> = {}): BlamedReport {
  return {
    subjectId: '42',
    subjectType: 'pull_request',
    repo: 'fixture/repo',
    generatedAt: '2026-06-16T10:00:00.000Z',
    diffMix: [
      { agent: 'copilot', linesAttributed: 68, fraction: 0.68 },
      { agent: 'cursor', linesAttributed: 20, fraction: 0.2 },
      { agent: 'human', linesAttributed: 12, fraction: 0.12 },
    ],
    violations: [],
    thresholdViolated: false,
    apiRequestId: 'req_test',
    ...overrides,
  };
}

describe('renderGitHubComment', () => {
  it('includes attribution table with required columns', () => {
    const md = renderGitHubComment(makeReport());
    expect(md).toContain('Agent');
    expect(md).toContain('Lines');
    expect(md).toContain('Confidence');
    expect(md).toContain('copilot');
    expect(md).toContain('68');
  });

  it('includes percentage as a number not only a colour', () => {
    const md = renderGitHubComment(makeReport());
    // Percentage expressed numerically
    expect(md).toMatch(/68\.0%|68%/);
  });

  it('includes audit report link when auditBaseUrl is supplied', () => {
    const md = renderGitHubComment(makeReport(), 'https://example.com');
    expect(md).toContain('https://example.com/audit/fixture/repo/42');
  });

  it('omits audit report link when no auditBaseUrl is configured', () => {
    const md = renderGitHubComment(makeReport());
    expect(md).not.toContain('/audit/');
  });

  it('shows threshold-violation note when violated', () => {
    const report = makeReport({
      thresholdViolated: true,
      triggeringFraction: 0.73,
    });
    const md = renderGitHubComment(report);
    expect(md).toContain('AI-authored fraction exceeds threshold');
    expect(md).toContain('73%');
  });

  it('does not show threshold note when not violated', () => {
    const md = renderGitHubComment(makeReport({ thresholdViolated: false }));
    expect(md).not.toContain('exceeds threshold');
  });

  it('shows top violations section when violations present', () => {
    const report = makeReport({
      violations: [
        {
          violationId: 'color-contrast',
          wcagCriterion: '1.4.3',
          impact: 'serious',
          codeLocation: { filePath: 'src/App.tsx', startLine: 10, endLine: 12 },
          attribution: {
            posterior: [
              { agent: 'copilot', probability: 0.85 },
              { agent: 'human', probability: 0.15 },
            ],
            confidence: 0.85,
            signal_contributions: [],
            classifier_version: '1.0',
            calibration_version: '1.0',
            inferred_at_utc: new Date().toISOString(),
            inference_mode: 'hosted' as const,
          },
        },
      ],
    });
    const md = renderGitHubComment(report);
    expect(md).toContain('Top violations');
    expect(md).toContain('1.4.3');
    expect(md).toContain('color-contrast');
  });
});

describe('renderVercelComment', () => {
  it('is plain text (no Markdown headings)', () => {
    const text = renderVercelComment(makeReport());
    expect(text).not.toMatch(/^#+\s/m);
    expect(text).not.toContain('**');
  });

  it('includes "Deployed diff:" with line count', () => {
    const text = renderVercelComment(makeReport());
    expect(text).toContain('Deployed diff:');
    expect(text).toContain('100 lines');
  });

  it('includes percentage breakdowns for at least two agents', () => {
    const text = renderVercelComment(makeReport());
    expect(text).toContain('68% copilot');
    expect(text).toContain('20% cursor');
  });

  it('includes audit report link when auditBaseUrl is supplied', () => {
    const text = renderVercelComment(makeReport(), 'https://example.com');
    expect(text).toContain('https://example.com/audit/fixture/repo/42');
  });

  it('omits audit report link when no auditBaseUrl is configured', () => {
    const text = renderVercelComment(makeReport());
    expect(text).not.toContain('/audit/');
  });

  it('shows threshold warning when violated', () => {
    const text = renderVercelComment(
      makeReport({ thresholdViolated: true, triggeringFraction: 0.88 }),
    );
    expect(text).toContain('Warning');
    expect(text).toContain('88%');
  });
});

describe('renderQuotaExceededComment', () => {
  it('contains "free-tier quota" and no attribution table', () => {
    const md = renderQuotaExceededComment('2026-07-01T00:00:00Z');
    expect(md).toContain('free-tier quota');
    expect(md).not.toContain('| Agent |');
    expect(md).not.toContain('violation');
  });

  it('contains the reset date when provided', () => {
    const md = renderQuotaExceededComment('2026-07-01T00:00:00Z');
    expect(md).toContain('2026');
  });

  it('gracefully handles undefined resetAt', () => {
    const md = renderQuotaExceededComment(undefined);
    expect(md).toContain('free-tier quota');
    expect(md).toContain('next billing period');
  });
});

describe('renderAuthErrorComment', () => {
  it('contains "authentication failed" and "reinstall"', () => {
    const md = renderAuthErrorComment();
    expect(md).toContain('authentication failed');
    expect(md).toContain('reinstall the GitHub App');
  });

  it('contains no attribution data', () => {
    const md = renderAuthErrorComment();
    expect(md).not.toContain('copilot');
    expect(md).not.toContain('| Agent |');
    expect(md).not.toContain('violation');
  });
});
