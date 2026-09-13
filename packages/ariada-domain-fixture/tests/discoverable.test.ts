// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// This package exists to be FOUND. It computes nothing and reports nothing;
// its whole job is to sit in a workspace under a conventional name so the
// scanner that looks for third-party domain packages has something to find, and
// so the acceptance suite for that scanner has something real to assert about.
//
// That makes its failure mode unusually quiet. If the name drifts, or the entry
// point in its manifest stops resolving, or an export stops satisfying the
// module contract, the scanner finds nothing — and finding nothing is exactly
// what it does on a workspace with no third-party domains. The acceptance suite
// then passes while testing nothing at all.
//
// So the last case here hands the real scanner the real package directory. Every
// case above it checks a part; that one checks that the parts still add up to a
// package that can be discovered.

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DOMAIN_PACKAGE_CONVENTION,
  dedupeDomainsById,
  isDomainModule,
  type DomainModule,
} from '@ariada-org/core-engine';
import { describe, expect, it } from 'vitest';

import fixtureDomainDefault, { fixtureDomain } from '../src/index.js';

const KOREN_PAKETA = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function manifest(): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(resolve(KOREN_PAKETA, 'package.json'), 'utf8')) as Record<
    string,
    unknown
  >;
}

describe('the name the scanner looks for', () => {
  it('matches the convention, as the engine spells it', async () => {
    // Compared against the exported pattern rather than a copy of it: a copy
    // would keep agreeing with itself after the convention changed.
    const { name } = await manifest();
    expect(DOMAIN_PACKAGE_CONVENTION.test(String(name))).toBe(true);
  });

  it('names an entry point, because the scanner imports whatever it names', async () => {
    const m = await manifest();
    expect(typeof m['main']).toBe('string');
  });
});

describe('the contract the scanner checks', () => {
  it('satisfies it, judged by the engine\'s own check and not by ours', () => {
    expect(isDomainModule(fixtureDomain)).toBe(true);
  });

  it('offers the same module by name and by default', () => {
    // Both are collected by the scanner, and two different objects with one id
    // would be de-duplicated into whichever came first — silently, and
    // differently depending on key order.
    expect(fixtureDomainDefault).toBe(fixtureDomain);
  });

  it('carries an identifier, a title and a version', () => {
    expect(fixtureDomain.id).toBe('fixture-domain');
    expect(fixtureDomain.title.length).toBeGreaterThan(0);
    expect(fixtureDomain.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('takes an identifier no built-in domain has', async () => {
    // It appears in the report grid beside the real ones. Sharing an id would
    // remove one of them by the deduplication rule, and the suite that relies on
    // this fixture would be asserting about a domain that is not there.
    const { discoverDomains } = await import('@ariada-org/core-engine');
    const vstroennye = discoverDomains({ includeBuiltins: true }).map((d) => d.id);
    expect(vstroennye).not.toContain(fixtureDomain.id);
  });
});

describe('doing nothing, on purpose and observably', () => {
  it('finds nothing to report', () => {
    expect(fixtureDomain.evaluate({} as never)).toEqual([]);
  });

  it('writes nothing into the sink it is handed', () => {
    // A fixture that quietly contributed features would corrupt every
    // acceptance run it takes part in, and the corruption would be attributed
    // to whatever real domain ran beside it.
    const zapisano: unknown[] = [];
    const sink = new Proxy(
      {},
      {
        get: () => (...args: unknown[]) => void zapisano.push(args),
        set: (_t, k, v) => (zapisano.push([k, v]), true),
      },
    ) as never;
    fixtureDomain.extractors.perElement?.({} as never, sink);
    fixtureDomain.extractors.perDocument?.({} as never, sink);
    expect(zapisano).toEqual([]);
  });

  it('survives being handed nothing at all where a snapshot belongs', () => {
    // The scanner's acceptance run gives every discovered domain the same
    // inputs. One that threw on an unexpected shape would fail the run for a
    // reason that has nothing to do with what is being tested.
    expect(() => fixtureDomain.extractors.perElement?.(undefined as never, undefined as never)).not.toThrow();
    expect(() => fixtureDomain.extractors.perDocument?.(undefined as never, undefined as never)).not.toThrow();
  });
});

describe('merging with the rest', () => {
  it('takes its place beside the built-in domains', async () => {
    const { discoverDomains } = await import('@ariada-org/core-engine');
    const vse = discoverDomains({ modules: [fixtureDomain] });
    expect(vse.map((d) => d.id)).toContain('fixture-domain');
  });

  it('is not doubled when it arrives twice', () => {
    const odin = dedupeDomainsById([fixtureDomain, fixtureDomain] as DomainModule[]);
    expect(odin).toHaveLength(1);
  });
});

describe('the whole point, checked whole', () => {
  it('is found by the real scanner pointed at the real workspace', async () => {
    // Everything above checks a part. This checks that the parts still add up:
    // the name, the entry point, the build behind it, and the exported shape.
    // If any of them drifts, the scanner returns nothing — which is precisely
    // what it returns on a workspace with no third-party domains, so the
    // acceptance suite for the scanner would pass while testing nothing.
    const { discoverDomains } = await import('@ariada-org/multi-domain');
    const koren_repozitoriya = resolve(KOREN_PAKETA, '..', '..');
    const naydennye = await discoverDomains({
      packageRoots: [koren_repozitoriya],
      includeBuiltins: false,
    });
    expect(naydennye.map((d) => d.id)).toContain('fixture-domain');
  });
});
