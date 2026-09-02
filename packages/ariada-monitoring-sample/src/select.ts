// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Building the page sample the monitoring methodology prescribes.
 *
 * Commission Implementing Decision (EU) 2018/1524, Annex I point 3.2 lists what
 * an in-depth monitoring sample must contain, clause by clause. This module
 * follows that list literally, records which clause each page satisfies, and
 * reports the clauses it could not satisfy instead of quietly returning a
 * shorter list. A sample that cannot explain itself is not evidence.
 *
 * Everything here is pure: no network, no filesystem, no clock. Discovery is the
 * caller's job, so the same selection runs unchanged in Node, in a browser and
 * in an edge runtime.
 */

import { classifyRole, isDocument } from './classify.js';
import type {
  DiscoveredPage,
  MonitoringSample,
  PageRole,
  SampleClause,
  SampledPage,
  SelectSampleOptions,
} from './types.js';

/**
 * A small deterministic generator. The methodology asks for random pages; an
 * audit asks for a result someone else can reproduce. Seeding satisfies both:
 * the choice is arbitrary with respect to the site, and identical given the
 * same seed, which is recorded in the sample.
 */
function seededOrder<T>(items: readonly T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const keyed = items.map((item, index) => {
    let x = (h ^ (index + 1)) >>> 0;
    x ^= x << 13;
    x >>>= 0;
    x ^= x >> 17;
    x ^= x << 5;
    x >>>= 0;
    return { item, key: x };
  });
  keyed.sort((a, b) => a.key - b.key);
  return keyed.map((k) => k.item);
}

/**
 * Reduce a URL to the form used for "is this the same page".
 *
 * Found by running against a real site: `https://ariada.org` and
 * `https://ariada.org/` are the same page, and so are `/accessibility` and
 * `/accessibility/`. Comparing raw strings put both members of each pair into
 * the sample, which inflates the count and makes the report claim to have
 * checked two pages where it checked one. Fragments and the common tracking
 * parameters are dropped for the same reason.
 */
function canonicalUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = '';
    for (const key of [...u.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|mc_cid|mc_eid)/i.test(key)) u.searchParams.delete(key);
    }
    let path = withoutTrailingSlashes(u.pathname);
    if (path === '') path = '/';
    u.pathname = path;
    return `${u.protocol}//${u.host}${u.pathname}${u.search}`;
  } catch {
    return withoutTrailingSlashes(raw);
  }
}

/**
 * Trailing slashes removed by walking back from the end.
 *
 * `/\/+$/` says the same thing and says it quadratically: on a string that is
 * nothing but slashes the engine retries from every position, so an address of
 * a few thousand of them costs seconds. Nobody types that; a scan target read
 * from a file or a query string is not typed.
 */
function withoutTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value[end - 1] === '/') end -= 1;
  return value.slice(0, end);
}

/** Clause identifiers, named once so the compiler catches a typo in a report. */
const CLAUSE_A = 'a-core-pages';
const CLAUSE_B = 'b-service-pages';
const CLAUSE_C = 'c-statement-feedback';
const CLAUSE_D = 'd-distinct-pages';
const CLAUSE_E = 'e-documents';
const CLAUSE_F = 'f-body-selected';
const CLAUSE_G = 'g-random';

/** Roles clause (a) enumerates. */
const CLAUSE_A_ROLES: readonly PageRole[] = ['home', 'login', 'sitemap', 'contact', 'help', 'legal'];
/** Roles clause (c) enumerates. */
const CLAUSE_C_ROLES: readonly PageRole[] = ['accessibility-statement', 'feedback'];

const ROLE_REASON: Record<PageRole, string> = {
  home: 'Home page — clause (a) names it first, and it is the entry point every visitor meets.',
  login: 'Login page — clause (a). A barrier here blocks the whole service, not one page.',
  sitemap: 'Sitemap page — clause (a).',
  contact: 'Contact page — clause (a).',
  help: 'Help page — clause (a).',
  legal: 'Legal information page — clause (a).',
  'accessibility-statement':
    'Accessibility statement — clause (c). The methodology puts it in the sample explicitly, so it is checked in every monitoring exercise.',
  feedback:
    'Feedback mechanism — clause (c). The statement must point at a way to report barriers; that route is itself audited.',
  search: 'Search functionality — clause (b) names it among the primary intended uses.',
  document: 'Downloadable document — clause (e).',
};

/** Group pages into buckets of "substantially distinct" shape, for clause (d). */
function distinctnessKey(page: DiscoveredPage): string {
  try {
    const u = new URL(page.url);
    const segments = u.pathname.split('/').filter(Boolean);
    // The first path segment is the crudest usable proxy for a section of a site:
    // /services/..., /news/..., /about/... A better signal would be the rendered
    // template, which the caller may know; when it does, it can pass pages that
    // are already grouped and this falls back to a stable no-op.
    return segments[0] ?? '(root)';
  } catch {
    return page.url;
  }
}

/**
 * Select the in-depth monitoring sample from the pages a caller discovered.
 *
 * @param discovered every page found while exploring the site
 * @param options seed for the random clause, and any pages the body added
 */
/**
 * The shared state a clause needs while the sample is being built. Each clause of
 * point 3.2 is a separate function below, so the code reads in the same order as
 * the text it implements and a reader can check one clause without holding the
 * others in their head.
 */
interface SelectionContext {
  readonly discovered: readonly DiscoveredPage[];
  readonly roleOf: ReadonlyMap<DiscoveredPage, PageRole | undefined>;
  readonly chosen: SampledPage[];
  readonly taken: Set<string>;
  readonly unsatisfied: SampleClause[];
  take(page: DiscoveredPage, clause: SampleClause, reason: string, role?: PageRole): void;
  firstWithRole(role: PageRole): DiscoveredPage | undefined;
  isFree(page: DiscoveredPage): boolean;
}

/** (a) home, login, sitemap, contact, help and legal information pages. */
function applyClauseA(ctx: SelectionContext): void {
  let found = 0;
  for (const role of CLAUSE_A_ROLES) {
    const page = ctx.firstWithRole(role);
    if (!page) continue;
    ctx.take(page, CLAUSE_A, ROLE_REASON[role], role);
    found += 1;
  }
  if (found === 0) ctx.unsatisfied.push(CLAUSE_A);
}

/**
 * (c) the accessibility statement and the feedback mechanism. Applied before (b)
 * so a statement page is never consumed as an ordinary service page.
 */
function applyClauseC(ctx: SelectionContext): void {
  let found = 0;
  for (const role of CLAUSE_C_ROLES) {
    const page = ctx.firstWithRole(role);
    if (!page) continue;
    ctx.take(page, CLAUSE_C, ROLE_REASON[role], role);
    found += 1;
  }
  if (found === 0) ctx.unsatisfied.push(CLAUSE_C);
}

/** (b) one page per type of service and other primary uses, including search. */
function applyClauseB(ctx: SelectionContext): void {
  const search = ctx.firstWithRole('search');
  if (search) ctx.take(search, CLAUSE_B, ROLE_REASON.search, 'search');

  const sections = new Map<string, DiscoveredPage>();
  for (const page of ctx.discovered) {
    if (!ctx.isFree(page) || isDocument(page)) continue;
    if (ctx.roleOf.get(page) !== undefined) continue;
    const key = distinctnessKey(page);
    if (!sections.has(key)) sections.set(key, page);
  }
  for (const [key, page] of sections) {
    ctx.take(
      page,
      CLAUSE_B,
      `One page representing the "${key}" area of the site — clause (b) asks for a page per type of service.`,
    );
  }
  if (!ctx.chosen.some((p) => p.clause === CLAUSE_B)) ctx.unsatisfied.push(CLAUSE_B);
}

/**
 * (d) examples of pages with a substantially distinct appearance or content. A
 * second page from a section already represented differs from the first in shape
 * more often than two pages of the same template do.
 */
function applyClauseD(ctx: SelectionContext): void {
  let found = 0;
  const seen = new Set<string>();
  for (const page of ctx.discovered) {
    if (found >= 3) break;
    if (!ctx.isFree(page) || isDocument(page)) continue;
    const key = distinctnessKey(page);
    if (seen.has(key)) continue;
    seen.add(key);
    ctx.take(
      page,
      CLAUSE_D,
      `A second page from "${key}" with a different shape from the one already sampled — clause (d).`,
    );
    found += 1;
  }
  if (found === 0) ctx.unsatisfied.push(CLAUSE_D);
}

/** (e) at least one relevant downloadable document, where applicable. */
function applyClauseE(ctx: SelectionContext): void {
  const doc = ctx.discovered.find((p) => isDocument(p) && ctx.isFree(p));
  if (doc) {
    ctx.take(doc, CLAUSE_E, ROLE_REASON.document, 'document');
    return;
  }
  // "where applicable" — a site with no documents does not fail this clause, but
  // the report should say so rather than leave the reader guessing.
  ctx.unsatisfied.push(CLAUSE_E);
}

/** (f) any other page the monitoring body deems relevant. Never guessed. */
function applyClauseF(ctx: SelectionContext, urls: readonly string[]): void {
  for (const url of urls) {
    const page = ctx.discovered.find((p) => p.url === url) ?? { url };
    ctx.take(page, CLAUSE_F, 'Added by the monitoring body — clause (f).');
  }
}

/**
 * Point 3.3: if a sampled page is one step of a process, every step of that
 * process is verified. A checkout that is accessible on step one and impassable
 * on step three is an inaccessible checkout.
 */
function applyProcessCompletion(ctx: SelectionContext): void {
  const ids = new Set(ctx.chosen.map((p) => p.processId).filter((id): id is string => !!id));
  for (const id of ids) {
    const steps = ctx.discovered
      .filter((p) => p.processId === id)
      .sort((a, b) => (a.processStep ?? 0) - (b.processStep ?? 0));
    for (const step of steps) {
      ctx.take(
        step,
        CLAUSE_B,
        `Step ${step.processStep ?? '?'} of process "${id}" — point 3.3 requires every step of a sampled process to be verified.`,
      );
    }
  }
}

/** (g) random pages amounting to at least 10 % of the sample from (a) to (f). */
function applyClauseG(ctx: SelectionContext, seed: string): void {
  const target = Math.ceil(ctx.chosen.length * 0.1);
  if (target === 0) return;
  const remaining = ctx.discovered.filter((p) => ctx.isFree(p) && !isDocument(p));
  let added = 0;
  for (const page of seededOrder(remaining, seed)) {
    if (added >= target) break;
    ctx.take(
      page,
      CLAUSE_G,
      'Randomly selected — clause (g) requires at least 10 % of the sample to be chosen at random.',
    );
    added += 1;
  }
  if (added < target) ctx.unsatisfied.push(CLAUSE_G);
}

/**
 * Select the in-depth monitoring sample from the pages a caller discovered.
 *
 * The clauses are applied in the order the methodology can be satisfied, not the
 * order it is printed: (c) runs before (b) so the accessibility statement is
 * never mistaken for an ordinary service page.
 *
 * @param discovered every page found while exploring the site
 * @param options seed for the random clause, and any pages the body added
 */
export function selectInDepthSample(
  discovered: readonly DiscoveredPage[],
  options: SelectSampleOptions,
): MonitoringSample {
  const chosen: SampledPage[] = [];
  const taken = new Set<string>();
  const unsatisfied: SampleClause[] = [];
  const roleOf = new Map<DiscoveredPage, PageRole | undefined>();
  for (const page of discovered) roleOf.set(page, classifyRole(page));

  const ctx: SelectionContext = {
    discovered,
    roleOf,
    chosen,
    taken,
    unsatisfied,
    take(page, clause, reason, role) {
      const key = canonicalUrl(page.url);
      if (taken.has(key)) return;
      taken.add(key);
      chosen.push({
        url: page.url,
        clause,
        reason,
        ...(role === undefined ? {} : { role }),
        ...(page.processId === undefined ? {} : { processId: page.processId }),
      });
    },
    firstWithRole: (role) => discovered.find((p) => roleOf.get(p) === role),
    isFree: (page) => !taken.has(canonicalUrl(page.url)),
  };

  applyClauseA(ctx);
  applyClauseC(ctx);
  applyClauseB(ctx);
  applyClauseD(ctx);
  applyClauseE(ctx);
  applyClauseF(ctx, options.bodySelectedUrls ?? []);
  applyProcessCompletion(ctx);
  applyClauseG(ctx, options.randomSeed);

  const capped =
    options.maxPages !== undefined && chosen.length > options.maxPages
      ? chosen.slice(0, options.maxPages)
      : chosen;

  return {
    pages: capped,
    unsatisfiedClauses: unsatisfied,
    randomSeed: options.randomSeed,
    method: 'in-depth',
  };
}

/**
 * Select the simplified-monitoring sample.
 *
 * Point 3.4 is deliberately loose: "a number of pages appropriate to the
 * estimated size and the complexity of the website shall be monitored in
 * addition to the home page". So the home page is mandatory and the rest scales
 * with the site. We take the square root of the discovered pages, which grows
 * with a site without turning a large one into a full crawl, and we say what we
 * did rather than pretending a number is prescribed.
 */
export function selectSimplifiedSample(
  discovered: readonly DiscoveredPage[],
  options: SelectSampleOptions,
): MonitoringSample {
  const chosen: SampledPage[] = [];
  const taken = new Set<string>();
  const unsatisfied: SampleClause[] = [];

  const home = discovered.find((p) => classifyRole(p) === 'home');
  if (home) {
    chosen.push({ url: home.url, clause: 'a-core-pages', reason: ROLE_REASON.home, role: 'home' });
    taken.add(canonicalUrl(home.url));
  } else {
    unsatisfied.push(CLAUSE_A);
  }

  const statement = discovered.find((p) => classifyRole(p) === 'accessibility-statement');
  if (statement && !taken.has(canonicalUrl(statement.url))) {
    chosen.push({
      url: statement.url,
      clause: 'c-statement-feedback',
      reason: ROLE_REASON['accessibility-statement'],
      role: 'accessibility-statement',
    });
    taken.add(canonicalUrl(statement.url));
  }

  const budget = Math.max(1, Math.ceil(Math.sqrt(discovered.length)));
  const rest = seededOrder(
    discovered.filter((p) => !taken.has(canonicalUrl(p.url)) && !isDocument(p)),
    options.randomSeed,
  );
  for (const page of rest) {
    if (chosen.length >= budget + 1) break;
    chosen.push({
      url: page.url,
      clause: 'g-random',
      reason:
        'Sampled in addition to the home page — point 3.4 asks for a number of pages appropriate to the size and complexity of the site.',
    });
    taken.add(canonicalUrl(page.url));
  }

  const capped =
    options.maxPages !== undefined && chosen.length > options.maxPages
      ? chosen.slice(0, options.maxPages)
      : chosen;

  return {
    pages: capped,
    unsatisfiedClauses: unsatisfied,
    randomSeed: options.randomSeed,
    method: 'simplified',
  };
}
