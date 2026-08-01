// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Types for selecting the page sample that the EU public-sector monitoring
 * methodology prescribes.
 *
 * The methodology (Commission Implementing Decision (EU) 2018/1524, Annex I
 * point 3.2) does not say "audit some pages". It lists, by clause, which pages
 * must be in the sample. This package models those clauses directly so a report
 * can say which clause each page satisfies — an auditor's first question is not
 * "what did you find" but "why did you look there".
 */

/** The clause of Annex I point 3.2 a page is included under. */
export type SampleClause =
  /** (a) home, login, sitemap, contact, help and legal information pages. */
  | 'a-core-pages'
  /** (b) one page per type of service, and other primary uses, incl. search. */
  | 'b-service-pages'
  /** (c) the accessibility statement and the feedback mechanism. */
  | 'c-statement-feedback'
  /** (d) pages of substantially distinct appearance or content type. */
  | 'd-distinct-pages'
  /** (e) at least one relevant downloadable document per service type. */
  | 'e-documents'
  /** (f) any other page the monitoring body deems relevant. */
  | 'f-body-selected'
  /** (g) random pages, at least 10 % of the sample from (a) to (f). */
  | 'g-random';

/**
 * A page found while exploring a site, before any judgement about the sample.
 * Discovery is I/O and lives in the caller; selection is pure and lives here.
 */
export interface DiscoveredPage {
  /** Absolute URL as discovered. */
  url: string;
  /** Document title, when the discovering surface knows it. */
  title?: string | undefined;
  /** Visible text of the link that led here — often the only reliable signal. */
  linkText?: string | undefined;
  /** Response content type, e.g. `text/html`, `application/pdf`. */
  contentType?: string | undefined;
  /** Clicks from the home page. 0 is the home page itself. */
  depth?: number | undefined;
  /**
   * Whether the page continues a multi-step process (a form wizard, a checkout).
   * Point 3.3 requires that if a sampled page is a step in a process, every step
   * of that process is verified — so this cannot be inferred later.
   */
  processId?: string | undefined;
  /** Position of this page within its process, when known. */
  processStep?: number | undefined;
}

/** A page selected into the sample, with the reason it is there. */
export interface SampledPage {
  url: string;
  clause: SampleClause;
  /** Human-readable justification, written for the person reading the report. */
  reason: string;
  /** The role recognised for clause (a) and (c) pages, when one was. */
  role?: PageRole | undefined;
  processId?: string | undefined;
}

/** Roles the methodology names explicitly in clauses (a) and (c). */
export type PageRole =
  | 'home'
  | 'login'
  | 'sitemap'
  | 'contact'
  | 'help'
  | 'legal'
  | 'accessibility-statement'
  | 'feedback'
  | 'search'
  | 'document';

/** What the caller must tell the selector that it cannot work out itself. */
export interface SelectSampleOptions {
  /**
   * Seed for the random pages of clause (g). An audit sample has to be
   * reproducible — if it cannot be re-derived, its result cannot be checked by
   * anyone, including the body that produced it. So randomness is seeded and
   * the seed belongs in the report.
   */
  randomSeed: string;
  /**
   * Pages the monitoring body adds by judgement, clause (f). Empty by default:
   * the tool does not pretend to have an opinion the methodology reserves for a
   * human body.
   */
  bodySelectedUrls?: readonly string[] | undefined;
  /** Cap on the sample, for a caller with a budget. Applied after (a)-(f). */
  maxPages?: number | undefined;
}

/** The result: the sample, plus everything needed to defend it. */
export interface MonitoringSample {
  /** Pages to audit, in clause order. */
  pages: readonly SampledPage[];
  /** Clauses that found no page — an honest gap, not a silent omission. */
  unsatisfiedClauses: readonly SampleClause[];
  /** The seed used, so the same sample can be produced again. */
  randomSeed: string;
  /** Method the sample was built for. */
  method: 'in-depth' | 'simplified';
}
