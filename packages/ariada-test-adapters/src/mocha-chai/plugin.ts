// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
// Maintainer: Alexander Brichkin (Agonist Development AB, Sweden, org.nr 559452-5726)
/**
 * Chai plugin that adds `expect(target).to.be.accessible()` and
 * `assert.isAccessible(target)` to Chai. Authored against the Chai 5 plugin
 * protocol (`chai.use(fn)` callback signature).
 */

import { assertAccessible } from '../internal/assert-accessible.js';
import type { RawScanTarget } from '../internal/normalise-target.js';
import type { ScanOptions, ScanResult } from '../internal/types.js';

/**
 * Minimal structural shapes we need from Chai's runtime. Declared here to
 * avoid a hard dependency on `chai` types at the type-check layer (the dep
 * stays a peer dep, optional).
 */
interface ChaiAssertion {
  _obj: unknown;
  assert(
    expression: boolean,
    message: string,
    negatedMessage: string,
    expected?: unknown,
    actual?: unknown,
  ): void;
}

interface ChaiAssertionConstructor {
  addMethod(name: string, fn: (this: ChaiAssertion, ...args: unknown[]) => unknown): void;
}

interface ChaiAssertNamespace {
  [key: string]: unknown;
}

interface ChaiStatic {
  Assertion: ChaiAssertionConstructor;
  assert: ChaiAssertNamespace;
}

/**
 * Chai plugin. Use via `chai.use(ariadaChai)` before any test using the
 * accessibility assertion runs.
 */
export const ariadaChai = (chai: ChaiStatic): void => {
  chai.Assertion.addMethod('accessible', async function (this: ChaiAssertion, ...args: unknown[]) {
    const options = (args[0] ?? undefined) as ScanOptions | undefined;
    const target = this._obj as RawScanTarget | ScanResult;
    const outcome = await assertAccessible(target, options);
    this.assert(
      outcome.pass,
      `expected target to be accessible — ${outcome.message}`,
      `expected target NOT to be accessible — none of the violation thresholds were met`,
      0,
      outcome.failingViolations.length,
    );
  });

  chai.assert['isAccessible'] = async (
    target: RawScanTarget | ScanResult,
    options?: ScanOptions,
  ): Promise<void> => {
    const outcome = await assertAccessible(target, options);
    if (!outcome.pass) {
      throw new Error(outcome.message);
    }
  };
};
