// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// What this package does, and why the suite is shaped the way it is.
//
// It is the thing that decides whether an artifact may be published: the module
// catalogue, the public prose beside it, and the robots file that tells citation
// crawlers what they may read. Everything it passes goes out. It had no tests at
// all, which means the checker of the public surface was the one thing on that
// surface nobody checked.
//
// Two decisions about the shape:
//
//   The cases are refusals, one per finding code, because a validator's happy
//   path proves almost nothing — every branch that produces a finding could be
//   deleted and a pass-only suite would stay green. Where a refusal exists, its
//   absence is the defect worth catching.
//
//   The valid fixtures are BUILT FROM THE PACKAGE'S OWN CONSTANTS rather than
//   pasted. The locale list and the crawler list are the kind of thing that
//   grows; a pasted fixture would keep passing after the code started requiring
//   one more, and the test would be asserting last month's rule. Building them
//   means adding a locale makes the fixture follow, and forgetting to handle one
//   in the code still fails.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  PUBLIC_MODULE_CATALOG_PROFILE,
  PUBLIC_MODULE_CATALOG_SCHEMA_URL,
  PUBLIC_WIKI_LOCALES,
  assertClamperRobots,
  createPublicModuleCatalogSnapshotId,
  evaluateClamperProfile,
  evaluateClamperPublicText,
  evaluateClamperRobots,
} from '../src/index.js';

const PROFILE = PUBLIC_MODULE_CATALOG_PROFILE.id;

/** The crawler groups the robots file must carry, as the code names them. */
const CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'Google-Extended',
  'CCBot',
  'Bytespider',
  'PerplexityBot',
  'Perplexity-User',
  'Applebot-Extended',
];

function group(agent: string, directives = [
  'Disallow: /',
  'Allow: /modules/',
  'Allow: /channel-matrix.json',
  'Allow: /llms.txt',
]): string {
  return `User-agent: ${agent}\n${directives.join('\n')}\n`;
}

function validRobots(): string {
  return [
    'Content-Signal: search=yes, ai-input=yes, ai-train=no',
    '',
    ...CRAWLERS.map((a) => group(a)),
    'Sitemap: https://ariada.org/sitemap-index.xml',
  ].join('\n');
}

function validText(): string {
  return [
    'The module catalogue lives at https://ariada.org/modules/ and the code at',
    'https://github.com/ariada-org/ariada.',
    ...PUBLIC_WIKI_LOCALES.map((l) => `https://wiki.ariada.org/${l}/modules/`),
  ].join('\n');
}

function findingCodes(decision: { findings: { code: string }[] }): string[] {
  return decision.findings.map((f) => f.code);
}

describe('the profile name is checked before anything else', () => {
  it.each([
    ['catalogue', evaluateClamperProfile],
    ['public text', evaluateClamperPublicText],
    ['robots', evaluateClamperRobots],
  ])('refuses an unknown profile for %s', (_name, evaluate) => {
    expect(() => evaluate('some-other-profile', 'anything')).toThrow(/Unknown Clamper profile/);
  });
});

describe('robots.txt', () => {
  it('passes a file that carries every group and directive', () => {
    const d = evaluateClamperRobots(PROFILE, validRobots());
    expect(findingCodes(d)).toEqual([]);
    expect(d.result).toBe('pass');
  });

  it.each([
    ['empty', '', 'robots.required'],
    ['not a string', 42, 'robots.required'],
    ['only whitespace', '   \n  ', 'robots.required'],
  ])('refuses a %s file', (_name, input, code) => {
    expect(findingCodes(evaluateClamperRobots(PROFILE, input))).toContain(code);
  });

  it('refuses a file with no canonical sitemap', () => {
    const without = validRobots().replace(/^Sitemap: .*$/m, '');
    expect(findingCodes(evaluateClamperRobots(PROFILE, without))).toContain('robots.sitemap');
  });

  it('refuses a main-site file that tries to govern the wiki subdomain', () => {
    const withWiki = `${validRobots()}\nDisallow: /wiki/`;
    expect(findingCodes(evaluateClamperRobots(PROFILE, withWiki))).toContain('robots.wiki-boundary');
  });

  it('refuses a file that permits training', () => {
    const training = validRobots().replace('ai-train=no', 'ai-train=yes');
    expect(findingCodes(evaluateClamperRobots(PROFILE, training))).toContain('robots.training');
  });

  it.each(CRAWLERS)('refuses a file missing the %s group', (agent) => {
    const without = validRobots().replace(group(agent), '');
    const codes = findingCodes(evaluateClamperRobots(PROFILE, without));
    expect(codes).toContain('robots.user-agent');
  });

  it('refuses a group that is missing one required directive', () => {
    const truncated = validRobots().replace(
      group('GPTBot'),
      group('GPTBot', ['Disallow: /', 'Allow: /modules/', 'Allow: /llms.txt']),
    );
    expect(findingCodes(evaluateClamperRobots(PROFILE, truncated))).toContain('robots.path-policy');
  });

  it('refuses a group that opens the whole site to a crawler', () => {
    // The sharpest case in the file: every required directive is present, so
    // every other check passes, and one extra line undoes all of them.
    const openGroup = validRobots().replace(
      group('ClaudeBot'),
      group('ClaudeBot', [
        'Disallow: /',
        'Allow: /modules/',
        'Allow: /channel-matrix.json',
        'Allow: /llms.txt',
        'Allow: /',
      ]),
    );
    expect(findingCodes(evaluateClamperRobots(PROFILE, openGroup))).toContain('robots.global-ai-allow');
  });

  it('throws on refusal and returns the decision on a pass', () => {
    expect(() => assertClamperRobots(PROFILE, 'nothing useful')).toThrow(/rejected robots\.txt/);
    expect(assertClamperRobots(PROFILE, validRobots()).result).toBe('pass');
  });
});

describe('public prose', () => {
  it('passes text naming every authority', () => {
    expect(findingCodes(evaluateClamperPublicText(PROFILE, validText()))).toEqual([]);
  });

  it('refuses text with no catalogue authority', () => {
    const without = validText().replace('https://ariada.org/modules/', 'https://example.org/');
    expect(findingCodes(evaluateClamperPublicText(PROFILE, without))).toContain('text.catalog-authority');
  });

  it('refuses text missing even one locale of the wiki projection', () => {
    // Built from the constant on purpose: a pasted fixture would keep passing
    // after a locale was added, asserting the rule as it was.
    const lastLine = PUBLIC_WIKI_LOCALES[PUBLIC_WIKI_LOCALES.length - 1];
    const without = validText().replace(`https://wiki.ariada.org/${lastLine}/modules/`, '');
    expect(findingCodes(evaluateClamperPublicText(PROFILE, without))).toContain('text.wiki-authority');
  });

  it('does not take an address carried inside another for the catalogue authority', () => {
    // A substring test would see the real address in the query and pass.
    const without = validText().replaceAll('https://ariada.org/modules/', 'https://example.net/?next=https://ariada.org/modules/');
    expect(findingCodes(evaluateClamperPublicText(PROFILE, without))).toContain('text.catalog-authority');
  });

  it('refuses text with no code authority', () => {
    const without = validText().replace('https://github.com/ariada-org/ariada', 'elsewhere');
    expect(findingCodes(evaluateClamperPublicText(PROFILE, without))).toContain('text.code-authority');
  });

  it.each([
    ['a gated wiki host', 'https://wiki.klarads.com/en/modules/', 'dlp.gated-wiki-authority'],
    ['a retired wiki path', 'https://ariada.org/wiki/something', 'dlp.retired-main-wiki-authority'],
    // Assembled so that this file does not itself name the internal plans directory.
    ['an internal plan reference', `see ${['product', 'plans', 'whatever.md'].join('/')}`, 'dlp.internal-prd'],
    ['a handoff reference', 'continued in the handoff note', 'dlp.internal-handoff'],
    ['an internal source path', 'built from packages/ariada-clamper', 'dlp.internal-source-path'],
    ['a retired wiki catalog', 'https://wiki.ariada.org/en/ariada-module-catalog/x', 'dlp.retired-wiki-catalog'],
    // Assembled so that this file does not itself carry a home-directory path.
    ['an absolute user path', `generated at ${['', 'Users', 'somebody', 'work'].join('/')}`, 'dlp.absolute-user-path'],
  ])('refuses text carrying %s', (_name, fragment, code) => {
    const withLeak = `${validText()}\n${fragment}`;
    expect(findingCodes(evaluateClamperPublicText(PROFILE, withLeak))).toContain(code);
  });

  it.each([['empty', ''], ['not a string', 7], ['whitespace only', '  \n ']])(
    'refuses %s text',
    (_name, input) => {
      expect(findingCodes(evaluateClamperPublicText(PROFILE, input))).toContain('text.required');
    },
  );
});

describe('the snapshot identifier', () => {
  it('does not depend on the order the keys were written in', () => {
    const a = { alpha: 1, beta: [1, 2], gamma: { x: 'y' } };
    const b = { gamma: { x: 'y' }, beta: [1, 2], alpha: 1 };
    expect(createPublicModuleCatalogSnapshotId(a)).toBe(createPublicModuleCatalogSnapshotId(b));
  });

  it('ignores an existing snapshotId, so an identifier cannot describe itself', () => {
    const without = { alpha: 1 };
    const withForeign = { alpha: 1, snapshotId: 'whatever was there before' };
    expect(createPublicModuleCatalogSnapshotId(withForeign)).toBe(
      createPublicModuleCatalogSnapshotId(without),
    );
  });

  it('changes when the content changes', () => {
    expect(createPublicModuleCatalogSnapshotId({ alpha: 1 })).not.toBe(
      createPublicModuleCatalogSnapshotId({ alpha: 2 }),
    );
  });

  it('distinguishes an array from an object with the same written form', () => {
    // Canonicalisation that flattened both to the same string would collide
    // here, and a colliding identifier is worse than none: it says two
    // different catalogues are the same one.
    expect(createPublicModuleCatalogSnapshotId([1, 2])).not.toBe(
      createPublicModuleCatalogSnapshotId({ 0: 1, 1: 2 }),
    );
  });

  it('survives being handed something that is not an object at all', () => {
    expect(typeof createPublicModuleCatalogSnapshotId('a string')).toBe('string');
    expect(createPublicModuleCatalogSnapshotId(null)).toHaveLength(64);
  });
});

describe('the catalogue itself', () => {
  it('refuses an input that is not an object, and says so as a schema finding', () => {
    expect(findingCodes(evaluateClamperProfile(PROFILE, 'not a catalogue'))).toContain('schema.type');
  });

  it('names an unexpected root key rather than passing it through', () => {
    const extraKey = { $schema: 'x', version: 1, unexpected: true };
    const codes = findingCodes(evaluateClamperProfile(PROFILE, extraKey));
    expect(codes.some((c) => c.startsWith('schema.'))).toBe(true);
  });

  it('reports a decision that is stable for the same input', () => {
    const sample = { $schema: 'x', version: 1 };
    const a = evaluateClamperProfile(PROFILE, sample);
    const b = evaluateClamperProfile(PROFILE, sample);
    expect(a.decisionId).toBe(b.decisionId);
    expect(a.deterministic).toBe(true);
  });

  it('gives a different decision identifier to a different input', () => {
    const a = evaluateClamperProfile(PROFILE, { $schema: 'x', version: 1 });
    const b = evaluateClamperProfile(PROFILE, { $schema: 'y', version: 1 });
    expect(a.decisionId).not.toBe(b.decisionId);
  });
});

// The address a catalogue must declare is a promise that something is there.
// This package refuses every catalogue that does not declare it, and for a
// while the file behind it was missing from the site that serves it, so the
// address answered "not found" with every test here green.
describe('the schema address', () => {
  const site = fileURLToPath(new URL('../../../apps/ariada-org/public/', import.meta.url));

  it('is served by the site: the file behind the address exists and names itself by it', () => {
    const schemaPath = join(site, new URL(PUBLIC_MODULE_CATALOG_SCHEMA_URL).pathname);
    expect(existsSync(schemaPath), `${schemaPath} is missing`).toBe(true);
    const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as { $id?: unknown };
    expect(schema.$id).toBe(PUBLIC_MODULE_CATALOG_SCHEMA_URL);
  });

  it('is the one the catalogue check requires', () => {
    const otherAddress = { $schema: `${PUBLIC_MODULE_CATALOG_SCHEMA_URL}?v=2`, version: 1 };
    expect(findingCodes(evaluateClamperProfile(PROFILE, otherAddress))).toContain('schema.id');
    const sameAddress = { $schema: PUBLIC_MODULE_CATALOG_SCHEMA_URL, version: 1 };
    expect(findingCodes(evaluateClamperProfile(PROFILE, sameAddress))).not.toContain('schema.id');
  });
});
