<!-- SPDX-FileCopyrightText: 2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->
# @ariada-org/monitoring-sample

Which pages to audit, according to the European Union's own monitoring methodology.

[![License: EUPL-1.2](https://img.shields.io/badge/license-EUPL--1.2-blue)](LICENSE)

When a public sector body in the EU is checked for accessibility, the pages that get
checked are not chosen freely. Commission Implementing Decision (EU) 2018/1524,
Annex I point 3.2, lists them clause by clause: the home, login, sitemap, contact,
help and legal pages; one page per type of service, including search; the
accessibility statement and the feedback mechanism; pages that look substantially
different; a downloadable document; pages the monitoring body picks; and at least
ten per cent chosen at random.

This package builds that sample from a set of discovered pages, and — this is the
part that matters in an audit — records which clause each page satisfies, and which
clauses it could not satisfy at all.

## Quick-start

```bash
npm install @ariada-org/monitoring-sample
```

```ts
import { selectInDepthSample } from '@ariada-org/monitoring-sample';

const sample = selectInDepthSample(discoveredPages, { randomSeed: 'audit-2026-08' });

for (const page of sample.pages) {
  console.log(page.clause, page.url, '—', page.reason);
}
console.log('clauses not satisfied:', sample.unsatisfiedClauses);
```

## What it does not do

**It does not crawl.** Discovery is I/O and belongs to the caller, so the same
selection runs unchanged in Node, in a browser and in an edge runtime. Give it a
list of pages; it decides which ones the methodology asks for.

**It does not invent the monitoring body's judgement.** Clause (f) — "any other
page deemed relevant by the monitoring body" — stays empty unless you pass URLs in.
A tool that guessed here would be claiming an opinion the methodology reserves for a
person.

**It does not hide what it could not find.** A site with no accessibility statement
produces a sample without one *and* an entry in `unsatisfiedClauses`. Returning a
shorter list silently would make the report look complete when it is not.

## Reproducibility

Clause (g) asks for random pages. An audit asks for a result someone else can
re-derive. Both are satisfied by seeding: the choice is arbitrary with respect to
the site, identical for the same seed, and the seed is returned in the sample so it
can go into the report.

## Languages

Pages are recognised from their address and the words that link to them, and those
words are in the language of the country being monitored — a German municipality
has no page called "contact", it has *Kontakt*. The vocabulary covers English,
Swedish, Norwegian, Danish, Finnish, German, French, Dutch, Spanish, Italian,
Polish and Portuguese, and matches through diacritics because URLs strip them.

Matching is conservative on purpose. A false positive puts the wrong page in the
sample and the report then claims to have checked something it did not; a false
negative shows up as an unsatisfied clause, which is visible and can be corrected.
Between the two, the visible failure is the better one.

## Processes

Point 3.3: if a sampled page is one step of a process, every step of that process is
verified. A checkout that is accessible on step one and impassable on step three is
an inaccessible checkout. Pass `processId` and `processStep` on your discovered
pages and the whole process comes along.

## Licence

EUPL-1.2. Copyright Agonist Development AB. See `LICENSE`.
