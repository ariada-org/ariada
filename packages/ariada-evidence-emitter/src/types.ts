// SPDX-License-Identifier: EUPL-1.2
/**
 * Compliance evidence emitter types.
 *
 * Defines the normalized violation input shape and per-format output
 * shapes for VPAT 2.5 (US Section 508 / ITI), EN 301 549 v3.2.1 §11
 * Conformance Statement, and Swedish DOS-lagen (DIGG guidelines).
 *
 * Inputs are intentionally axe-core-compatible — see {@link Violation}.
 *
 * @see https://www.itic.org/policy/accessibility/vpat (VPAT 2.5 spec)
 * @see https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf
 * @see https://www.digg.se/digital-tillganglighet (DIGG guidelines)
 */

// NOTE — the four type aliases below are intentionally module-local (no
// `export` keyword). They are referenced by the Violation / En301549Row /
// VpatCriterion interfaces in this file but are not part of the public
// package surface (`src/index.ts` re-exports the interfaces, not these
// primitive aliases). Downstream consumers — including the workspace
// siblings `@ariada/wcag-rules-extended` (M1), `@ariada/penalty-estimator`
// (M3), and `@ariada/statement-generator` (M4) — either redeclare their
// own copies (M1 mirrors them in its own `src/types.ts`) or consume them
// transitively through `Violation.impact` / `Violation.wcag[]`. Removed
// `export` to stop knip flagging them as unused exports; the types still
// flow through the public interfaces. Closes Iter 8 / LX9 M5 gap.

/**
 * WCAG 2.2 Success Criterion identifier (e.g. "1.3.1", "2.4.7", "3.3.8").
 *
 * Authoritative list:
 *   https://www.w3.org/TR/WCAG22/#requirements-for-wcag-2-2
 */
type WcagSuccessCriterion = string;

/**
 * EN 301 549 v3.2.1 clause reference (e.g. "9.1.3.1", "11.7", "12.1.1").
 *
 * Authoritative list:
 *   https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf
 */
type En301549Clause = string;

/**
 * Conformance impact severity. Mirrors axe-core's impact taxonomy.
 *   - minor    : low-impact issue; many users unaffected.
 *   - moderate : some users blocked or confused.
 *   - serious  : major friction for users with disabilities.
 *   - critical : page fundamentally unusable for some users.
 */
type Impact = 'minor' | 'moderate' | 'serious' | 'critical';

/**
 * EAA Annex I section reference. Annex I has 9 sections covering different
 * categories of products and services. See:
 *   https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32019L0882
 */
type EaaAnnexISection =
  | 'I.1' // General — all products and services
  | 'I.2' // Self-service terminals (out of scope for this OSS package — software only)
  | 'I.3' // E-commerce services
  | 'I.4' // Banking services for consumers
  | 'I.5' // E-books and dedicated software
  | 'I.6' // Audiovisual media services
  | 'I.7'; // Other (transport, telephony, etc.)

/**
 * Normalized violation record.
 *
 * Subset of axe-core's `Result` shape — sufficient to populate VPAT,
 * EN 301 549 §11, and DOS-lagen statements. Extra axe-core fields
 * (e.g. `nodes[].failureSummary`) are ignored if present.
 */
export interface Violation {
  /** Rule ID — e.g. `ariada/checkout/payment-fieldset-grouping` or `color-contrast`. */
  id: string;
  /** Short human-readable description. */
  description: string;
  /** Imperative help text for fixers. */
  help: string;
  /** URL to per-rule documentation. */
  helpUrl?: string;
  /** Severity impact. */
  impact: Impact;
  /** WCAG 2.2 SC numbers this violation maps to. */
  wcag: WcagSuccessCriterion[];
  /** EN 301 549 v3.2.1 clauses cross-referenced. */
  en301549?: En301549Clause[];
  /** EAA Annex I sections targeted. */
  eaaAnnexI?: EaaAnnexISection[];
  /** Affected node count (defaults to 1 if omitted). */
  nodeCount?: number;
  /** Optional sample CSS selectors. */
  sampleSelectors?: string[];
}

/**
 * Metadata about the scanned product / report.
 */
export interface ReportMeta {
  /** Product / service name. */
  productName: string;
  /** Product version (semver / build tag / commit). */
  productVersion?: string;
  /** Evaluator name (organisation or person). */
  evaluator: string;
  /** Evaluator contact email / URL. */
  evaluatorContact?: string;
  /** ISO 8601 date of evaluation (YYYY-MM-DD). */
  evaluationDate: string;
  /** URL or scope description of pages assessed. */
  scope: string;
  /** Methodology summary (free text). */
  methodology?: string;
}

/**
 * VPAT 2.5 conformance level per criterion.
 *
 * @see https://www.itic.org/policy/accessibility/vpat
 */
export type VpatConformanceLevel =
  | 'Supports'
  | 'Partially Supports'
  | 'Does Not Support'
  | 'Not Applicable'
  | 'Not Evaluated';

/**
 * EN 301 549 §11 conformance status — three-state per clause.
 */
export type En301549Status =
  | 'conformant'
  | 'partially-conformant'
  | 'non-conformant'
  | 'not-applicable'
  | 'not-evaluated';

/**
 * DOS-lagen status — three-state aggregate per Swedish DIGG guidelines.
 *
 * @see https://www.digg.se/digital-tillganglighet
 */
export type DosLagenStatus =
  | 'helt-forenlig' // Fully compliant
  | 'delvis-forenlig' // Partially compliant
  | 'ej-forenlig'; // Non-compliant

/**
 * VPAT criterion row in §1194.22 / WCAG 2.x table.
 */
export interface VpatCriterion {
  /** WCAG SC reference (e.g. "1.1.1"). */
  criterion: string;
  /** Human-readable criterion name. */
  name: string;
  /** WCAG conformance level (A / AA / AAA). */
  level: 'A' | 'AA' | 'AAA';
  /** Per-criterion conformance level. */
  conformance: VpatConformanceLevel;
  /** Rationale / remarks (renders as table cell). */
  remarks: string;
}

/**
 * Top-level VPAT 2.5 output shape (JSON-serialisable).
 */
export interface VpatReport {
  /** Schema URI (for JSON validators). */
  $schema: 'https://schemas.ariada.org/vpat/2.5.json';
  /** Schema version tag. */
  schemaVersion: '2.5';
  /** Report metadata. */
  meta: ReportMeta;
  /** Applicable standards covered (e.g. WCAG 2.2 Level AA, EN 301 549 v3.2.1). */
  applicableStandards: string[];
  /** Per-criterion rows for WCAG 2.x table. */
  criteria: VpatCriterion[];
  /** Aggregate conformance summary. */
  summary: {
    total: number;
    supports: number;
    partiallySupports: number;
    doesNotSupport: number;
    notApplicable: number;
    notEvaluated: number;
  };
}

/**
 * EN 301 549 §11 clause row.
 */
export interface En301549Row {
  /** Clause (e.g. "11.1.1.1"). */
  clause: En301549Clause;
  /** Clause title. */
  title: string;
  /** WCAG SC mapping (if applicable). */
  wcag?: WcagSuccessCriterion[];
  /** Conformance status. */
  status: En301549Status;
  /** Number of detected issues mapped to this clause. */
  issueCount: number;
  /** Remarks. */
  remarks: string;
}

/**
 * EN 301 549 v3.2.1 §11 Conformance Statement output.
 */
export interface En301549Report {
  $schema: 'https://schemas.ariada.org/en301549/3.2.1.json';
  schemaVersion: '3.2.1';
  meta: ReportMeta;
  /** Per-clause statement rows (§11 software web). */
  clauses: En301549Row[];
  /** Aggregate per-status counts. */
  summary: {
    total: number;
    conformant: number;
    partiallyConformant: number;
    nonConformant: number;
    notApplicable: number;
    notEvaluated: number;
  };
}

/**
 * DOS-lagen accessibility statement output (JSON form per DIGG).
 *
 * Field names mirror Swedish official terminology so the JSON can be
 * rendered to the legally required statement page.
 */
export interface DosLagenReport {
  $schema: 'https://schemas.ariada.org/dos-lagen/2025.json';
  schemaVersion: '2025';
  meta: ReportMeta;
  /** Overall compliance label per DIGG aggregate. */
  efterlevnadsstatus: DosLagenStatus;
  /** Justification narrative — required when status != helt-forenlig. */
  efterlevnadsstatusMotivering: string;
  /** List of known non-conformance issues, in Swedish-statement format. */
  ickeForenligaInnehall: Array<{
    rubrik: string; // heading
    beskrivning: string; // description
    wcag: WcagSuccessCriterion[];
    en301549?: En301549Clause[];
    paverkadAnvandare: string; // affected users
    atgardsplan?: string; // remediation plan
    deadline?: string; // ISO date or text
  }>;
  /** Feedback contact details (required by DOS-lagen art. 7). */
  kontakt: {
    epost: string;
    url?: string;
    telefon?: string;
    organisation: string;
  };
  /** Enforcement procedure URL (DIGG). */
  tillsynUrl: string;
  /** Publication and last-revision dates (ISO). */
  publiceringsdatum: string;
  senasteRevision: string;
  /** Methodology summary. */
  utvarderingsmetod: string;
}