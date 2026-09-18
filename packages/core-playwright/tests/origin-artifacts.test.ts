// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from 'vitest';

import { artifactsFromAnswers } from '../src/origin-artifacts.js';

/**
 * The three states an origin file can be in, and why two of them look alike.
 *
 * A rule about `robots.txt` has to tell "it is not there" from "nobody asked".
 * The published scanner cannot: nothing ever fetched the file, so the analyzer
 * saw no content and reported every site as missing it — including this
 * project's own site, which serves one with a 200. The finding was independent
 * of the site, which is the definition of a finding that means nothing.
 *
 * These cases are about the decision alone, kept apart from the fetching,
 * because what they govern is what a report does NOT say. Over-reporting is the
 * failure that matters here: a site told to add a file it already has learns
 * that the tool is not reading its site.
 */
describe('artifactsFromAnswers', () => {
  it('a file that came back is carried as its content', () => {
    const out = artifactsFromAnswers(
      { status: 200, body: 'User-agent: *\nAllow: /' },
      { status: 404, body: '' },
    );
    expect(out?.robotsTxt).toBe('User-agent: *\nAllow: /');
  });

  it('a file the origin says is not there is empty rather than absent', () => {
    // The distinction the rules depend on: an empty string means somebody
    // looked and there was nothing. Leaving the field unset would mean nobody
    // looked, and the rule would then stay quiet about a genuine absence.
    const out = artifactsFromAnswers({ status: 404, body: '' }, { status: 404, body: '' });
    expect(out).toBeDefined();
    expect(out?.robotsTxt).toBe('');
    expect(out?.llmsTxt).toBe('');
  });

  it('a request that could not be made leaves the field unset', () => {
    const out = artifactsFromAnswers({ status: null, body: '' }, { status: 200, body: '# llms' });
    expect(out).toBeDefined();
    expect('robotsTxt' in (out ?? {})).toBe(false);
    expect(out?.llmsTxt).toBe('# llms');
  });

  it('neither could be asked, so there is nothing to report at all', () => {
    // Not an empty record: an empty record is indistinguishable from "asked,
    // and both are absent", which is the confusion the whole module exists to
    // prevent. Nothing means nothing was learned.
    expect(artifactsFromAnswers({ status: null, body: '' }, { status: null, body: '' })).toBeUndefined();
  });

  it('a redirect that was not followed to a body counts as not there', () => {
    // A 301 with no body is not the file. Treating any non-error status as
    // presence would carry an empty string as content and read as a file that
    // exists and says nothing — which is a different claim about the site.
    const out = artifactsFromAnswers({ status: 301, body: '' }, { status: 500, body: '' });
    expect(out?.robotsTxt).toBe('');
    expect(out?.llmsTxt).toBe('');
  });

  it('a server error is an answer about the request, not about the file', () => {
    // Deliberately the same treatment as 404 rather than as "could not ask":
    // the origin responded, so the scan reached it. What it means for the site
    // is that no agent-readable file is being served, which is what the rule
    // reports. The alternative — silence on every fifth-hundred — would hide
    // a broken origin behind an unknown.
    const out = artifactsFromAnswers({ status: 503, body: 'maintenance' }, { status: 200, body: 'x' });
    expect(out?.robotsTxt).toBe('');
  });
});
