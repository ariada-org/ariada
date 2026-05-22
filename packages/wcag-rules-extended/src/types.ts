// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Public types for @ariada-org/wcag-rules-extended.
 *
 * Rule shape is axe-core-compatible but does not depend on axe-core types
 * directly. Consumers register rules via the standard
 * `axe.configure({ rules, checks })` mechanism — see README.
 *
 * @see https://github.com/dequelabs/axe-core/blob/develop/doc/API.md#api-name-axeconfigure
 */

/**
 * WCAG 2.2 Success Criterion identifier (e.g. "1.3.1", "2.4.7", "3.3.8").
 *
 * Authoritative list:
 *   https://www.w3.org/TR/WCAG22/#requirements-for-wcag-2-2
 */
export type WcagSuccessCriterion = string;

/**
 * EN 301 549 v3.2.1 clause reference (e.g. "9.1.3.1", "11.7", "12.1.1").
 *
 * Authoritative list:
 *   https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf
 */
export type En301549Clause = string;

/**
 * Conformance impact severity. Mirrors axe-core's impact taxonomy.
 *   - minor    : low-impact issue; many users unaffected.
 *   - moderate : some users blocked or confused.
 *   - serious  : major friction for users with disabilities.
 *   - critical : page fundamentally unusable for some users.
 */
export type Impact = 'minor' | 'moderate' | 'serious' | 'critical';

/**
 * EAA Annex I section reference. Annex I has 9 sections covering different
 * categories of products and services. See:
 *   https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32019L0882
 */
export type EaaAnnexISection =
  | 'I.1' // General — all products and services
  | 'I.2' // Self-service terminals (out of scope for this OSS package — software only)
  | 'I.3' // E-commerce services
  | 'I.4' // Banking services for consumers
  | 'I.5' // E-books and dedicated software
  | 'I.6' // Audiovisual media services
  | 'I.7'; // Other (transport, telephony, etc.)

/**
 * Rule metadata for IDE help / docs generation / catalogue dashboards.
 */
export interface RuleMetadata {
  /** Short human-readable description. */
  description: string;
  /** Imperative one-line instruction for fixers. */
  help: string;
  /** URL to the per-rule doc in this repo. */
  helpUrl: string;
  /** WCAG 2.2 SC numbers this rule addresses. At least one required. */
  wcag: WcagSuccessCriterion[];
  /** EN 301 549 v3.2.1 clauses cross-referenced. May be empty if rule is purely WCAG-derived. */
  en301549?: En301549Clause[];
  /** EAA Annex I section(s) targeted. */
  eaaAnnexI?: EaaAnnexISection[];
  /** Severity impact. */
  impact: Impact;
}

/**
 * Check function signature — receives a DOM node and returns true if the
 * check passes (no violation) or false if it fails (violation found).
 *
 * Compatible with axe-core's `CheckEvaluate` shape (synchronous variant).
 *
 * Implementations MUST be deterministic and side-effect free. They MUST
 * NOT query the network. They MUST NOT mutate the DOM.
 */
export type CheckEvaluate = (node: Element, options?: unknown) => boolean;

/**
 * Check definition registered via `axe.configure({ checks })`.
 */
export interface CheckDefinition {
  id: string;
  evaluate: CheckEvaluate;
  metadata?: {
    impact?: Impact;
    messages?: {
      pass?: string;
      fail?: string;
      incomplete?: string;
    };
  };
}

/**
 * Rule definition registered via `axe.configure({ rules })`.
 *
 * Mirrors axe-core rule shape:
 *   https://github.com/dequelabs/axe-core/blob/develop/doc/rule-development.md
 */
export interface RuleDefinition {
  /** Stable rule ID — convention: `ariada/<pack>/<short-name>`. */
  id: string;
  /** CSS selector identifying candidate elements. */
  selector: string;
  /** Optional refinement function — runs on each matched element. */
  matches?: (node: Element) => boolean;
  /** OR-checks: rule passes if any of these check IDs return true. */
  any: string[];
  /** AND-checks: rule passes only if all check IDs return true. */
  all: string[];
  /** Negative checks: rule fails if any of these check IDs return true. */
  none: string[];
  /** Tags for filtering — should include applicable WCAG SC tag. */
  tags: string[];
  /** Metadata. */
  metadata: RuleMetadata;
}

/**
 * A rule pack — collection of rules + checks bundled around a theme
 * (e-commerce checkout, accessibility statement, banking & Nordic locale).
 */
export interface RulePack {
  id: string;
  name: string;
  description: string;
  rules: RuleDefinition[];
  checks: CheckDefinition[];
}

/**
 * Supported UI locales for rule messages.
 * Nordic 4 + English baseline. Other EU locales may be added in future packs.
 */
export type Locale = 'en' | 'sv' | 'nb' | 'da' | 'fi';

/**
 * Localised message bundle for a single rule.
 */
export interface RuleMessages {
  description: string;
  help: string;
  pass: string;
  fail: string;
  incomplete?: string;
}

/**
 * Locale-keyed message bundle.
 */
export type LocaleBundle = Record<Locale, RuleMessages>;
