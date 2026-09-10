// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/index.js` and `dist/index.d.ts`. Checked with
// the rebuild check.

import { scanWithAriada, type ScanResult } from './scan-adapter.js';

export interface TestControllerLike {
  eval<T>(fn: () => T): PromiseLike<T>;
  expect(value: unknown): { ok(message?: string): PromiseLike<unknown> };
}

export interface AriadaScanOptions {
  binary?: string;
  scan?: (url: string, binary?: string) => Promise<ScanResult>;
}

export type AriadaTestController<T extends TestControllerLike> = T & {
  ariadaScan(options?: AriadaScanOptions): Promise<ScanResult>;
};

/**
 * Scan whatever page the test is currently on, and assert the result.
 *
 * The address is taken from the browser rather than from the test's own idea of
 * where it went: after redirects and client-side routing those are different,
 * and scanning the second describes a page the test is not looking at.
 *
 * The assertion message carries the first ten findings, because a failure
 * reading only "Ariada found 34 issues" sends somebody hunting for a report
 * that was deleted with the temporary directory.
 *
 * @param testController - the test's controller
 * @param options - the executable, or a scanner to use instead
 * @returns the result
 */
export async function ariadaScan(
  testController: TestControllerLike,
  options: AriadaScanOptions = {},
): Promise<ScanResult> {
  const url = await testController.eval(() => globalThis.location.href);
  const result = await (options.scan ?? scanWithAriada)(url, options.binary);
  const summary = result.findings
    .slice(0, 10)
    .map((item) => `${item.domain}/${item.ruleId} (${item.severity}): ${item.message}`)
    .join('\n');
  await testController
    .expect(!result.policyFailed)
    .ok(`Ariada found ${result.findings.length} issue(s).${summary ? `\n${summary}` : ''}`);
  return result;
}

/**
 * The same controller, with one more method on it.
 *
 * A proxy rather than a copy, so everything the test framework put on the
 * controller keeps working — including whatever it adds in a later version.
 * Methods are bound to the original, because a controller that loses its own
 * `this` fails in ways that look like the test being wrong.
 *
 * @param testController - the test's controller
 * @param defaults - options every call inherits
 * @returns the controller, with `ariadaScan` on it
 */
export function bindAriadaScan<T extends TestControllerLike>(
  testController: T,
  defaults: AriadaScanOptions = {},
): AriadaTestController<T> {
  const action = (options: AriadaScanOptions = {}) =>
    ariadaScan(testController, { ...defaults, ...options });
  return new Proxy(testController, {
    get(target, property) {
      if (property === 'ariadaScan') return action;
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as AriadaTestController<T>;
}

export * from './scan-adapter.js';
