import type {
  AnalyzerContext,
  DomainAnalyzer,
  ElementTarget,
  Finding,
} from '@ariada-org/core-engine';
import { AxeBuilder } from '@axe-core/playwright';
import type { Page } from 'playwright';
import { ulid } from 'ulid';

import { mapAxeImpact } from './axe-severity.js';

interface AxeNode {
  target: Array<string | string[]>;
  html: string;
  failureSummary?: string;
}

interface AxeViolation {
  id: string;
  impact?: string | null;
  description?: string;
  help?: string;
  helpUrl?: string;
  tags?: string[];
  nodes: AxeNode[];
}

interface AxeResults {
  violations: AxeViolation[];
  /**
   * axe-core's needs-manual-review bucket — a candidate axe found but could not
   * auto-resolve (e.g. colour-contrast under a pseudo-element background). It
   * MUST be surfaced (flagged needs-review), not dropped, or whole rule classes
   * — contrast, link-in-text-block — vanish from the report.
   */
  incomplete: AxeViolation[];
}

/**
 *
 */
export interface CreateA11yAnalyzerOptions {
  version?: string;
  tags?: string[];
}

/**
 * Default a11y analyzer implementing the DomainAnalyzer interface.
 * Delegates rule evaluation to axe-core 4.x via @axe-core/playwright.
 */
export function createA11yAnalyzer(opts: CreateA11yAnalyzerOptions = {}): DomainAnalyzer {
  const version = opts.version ?? 'axe-core@4.x';
  const tags = opts.tags ?? [
    'wcag2a',
    'wcag2aa',
    'wcag21a',
    'wcag21aa',
    'wcag22aa',
    'best-practice',
  ];

  const analyzer: DomainAnalyzer = {
    domain: 'a11y',
    version,
    ruleIds: [],

    async analyze(ctx: AnalyzerContext): Promise<Finding[]> {
      const page = ctx.page as Page;
      const builder = new AxeBuilder({ page }).withTags(tags);
      const results = (await builder.analyze()) as AxeResults;
      return mapAxeResults(results, ctx.snapshot.scanId);
    },

    async analyzeElement(ctx: AnalyzerContext, target: ElementTarget): Promise<Finding[]> {
      const page = ctx.page as Page;
      const builder = new AxeBuilder({ page }).withTags(tags).include(target.selector);
      try {
        const results = (await builder.analyze()) as AxeResults;
        return mapAxeResults(results, ctx.snapshot.scanId);
      } catch {
        return [];
      }
    },
  };

  return analyzer;
}

/**
 * Map both axe-core result buckets into findings: definite `violations` and the
 * needs-manual-review `incomplete` bucket (flagged `needsReview`). Surfacing
 * `incomplete` is what recovers colour-contrast and link-in-text-block, which an
 * earlier violations-only mapper silently dropped. Exported so the mapping is
 * unit-testable without a live browser.
 */
export function mapAxeResults(
  results: { violations: AxeViolation[]; incomplete?: AxeViolation[] },
  scanId: string,
): Finding[] {
  return [
    ...mapViolations(results.violations, scanId, false),
    ...mapViolations(results.incomplete ?? [], scanId, true),
  ];
}

function mapViolations(violations: AxeViolation[], scanId: string, needsReview: boolean): Finding[] {
  const out: Finding[] = [];
  for (const v of violations) {
    const severity = mapAxeImpact(v.impact);
    const wcagMapping = extractWcag(v.tags ?? []);
    const criterion = wcagMapping[0];
    for (const node of v.nodes) {
      const selector = flattenTarget(node.target);
      out.push({
        id: ulid(),
        scanId,
        domain: 'a11y',
        ruleId: v.id,
        severity,
        element: { selector },
        message: v.help ?? v.description ?? v.id,
        ...(criterion !== undefined ? { criterion } : {}),
        ...(wcagMapping.length > 0 ? { wcagMapping } : {}),
        // Needs-review findings carry lower confidence than definite violations.
        confidence: needsReview ? 0.5 : 1,
        ...(needsReview ? { needsReview: true } : {}),
      });
    }
  }
  return out;
}

function flattenTarget(target: Array<string | string[]>): string {
  const flat: string[] = [];
  for (const t of target) {
    if (Array.isArray(t)) flat.push(t.join(' '));
    else flat.push(t);
  }
  return flat.join(' >>> ');
}

/**
 * Read the success criteria out of an axe rule's tags.
 *
 * Axe writes a criterion as run-together digits — `wcag412` for 4.1.2,
 * `wcag1410` for 1.4.10. Those digits were previously kept as-is, so every
 * finding from this analyzer carried the criterion "412", which matches nothing
 * in the criterion catalogue. Downstream that read as "no violations recorded
 * against 4.1.2", and the conformance report then declared the criterion
 * supported while the scan below it listed the violations.
 *
 * The first digit is the principle and the second the guideline — neither ever
 * exceeds nine — so everything after them is the criterion number. Tags with
 * fewer than three digits are conformance levels (`wcag2`, `wcag21`), not
 * criteria, and are skipped.
 */
function extractWcag(tags: string[]): string[] {
  const out: string[] = [];
  for (const t of tags) {
    const match = /^wcag(\d)(\d)(\d+)$/.exec(t);
    if (match) out.push(`${match[1]}.${match[2]}.${match[3]}`);
  }
  return out;
}
