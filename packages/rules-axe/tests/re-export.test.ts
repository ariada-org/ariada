// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// What this package is, and therefore what is worth testing about it.
//
// It holds no logic. The axe analyser moved to `@ariada-org/core-playwright`,
// and this package stayed behind as a re-export so that anything already
// installing `@ariada-org/rules-axe` keeps working. A published scanner
// resolves it by name; if the name stops arriving, a clean install of what we
// publish cannot run a scan at all.
//
// A package like that has exactly one property worth holding, and it is not
// "the analyser works" — that belongs to the package the analyser lives in.
// It is that the names still arrive, and arrive as the same objects. A
// re-export that has quietly become a re-implementation passes any test written
// about behaviour and fails the only thing this package promises.
//
// So the assertions are about identity, not output.

import * as source from '@ariada-org/core-playwright';
import { describe, expect, it } from 'vitest';

import * as reexport from '../src/index.js';

/** The names a consumer of this package is entitled to find. */
const PROMISED = ['createA11yAnalyzer', 'mapAxeImpact'] as const;

describe('the compatibility re-export of the axe analyser', () => {
  it.each(PROMISED)('still exports %s', (name) => {
    expect(reexport).toHaveProperty(name);
  });

  it.each(PROMISED)('exports %s as the very object the source package exports', (name) => {
    // Identity, deliberately, rather than a behavioural comparison. Two
    // functions that behave alike today drift apart silently; the same function
    // cannot.
    expect(reexport[name]).toBe(source[name]);
  });

  it.each(PROMISED)('exports %s as something callable', (name) => {
    expect(typeof reexport[name]).toBe('function');
  });

  it('adds nothing of its own', () => {
    // A compatibility shim that grows its own surface stops being one, and the
    // addition would live in the package with no home for it. Type-only exports
    // leave no runtime key, so this counts the runtime surface only.
    expect(Object.keys(reexport).sort()).toEqual([...PROMISED].sort());
  });
});
