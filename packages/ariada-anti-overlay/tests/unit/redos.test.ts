// SPDX-License-Identifier: EUPL-1.2
//
// These tests used to decide by the clock, and one of them flickered.
//
// Each compared a measured duration against a ceiling — 500 ms, or 200 for the
// budget case. Run six times under coverage instrumentation, one of them failed
// once: not because the detector had changed, but because that run was slower.
// The failure then travelled onward as "this package cannot report coverage" on
// a published page, which is a statement about the package and was not true.
//
// What the first three are actually about is in their own names: resistance to
// catastrophic backtracking, which is a statement about the SHAPE of the work
// and not about milliseconds. That shape is measured by a ratio: multiply the
// input and see whether the time follows the input or its square. Both sides
// are measured in the same run, so a slow machine moves them together and stops
// deciding anything.
//
// The fourth was a stated product budget (95th percentile under 100 ms for a
// page up to a megabyte). A unit test on whatever machine happens to run it
// cannot hold that — it can only hold that the work scales with the page, which
// is what it now does. The absolute figure belongs to a benchmark on known
// hardware, and asserting it here made the number look verified when it was not.

import { describe, it, expect } from 'vitest';

import { detectOverlays } from '../../src/detect.js';

/**
 * Time one call, in milliseconds. The clock is the high-resolution one because
 * the ratios below are taken over short runs.
 */
async function izmerit(fn: () => Promise<unknown>): Promise<number> {
  const start = process.hrtime.bigint();
  await fn();
  return Number(process.hrtime.bigint() - start) / 1_000_000;
}

/**
 * The cheapest of several runs at one size.
 *
 * The minimum rather than the mean or a single reading, and the reason is the
 * whole reliability of this file: noise only ever makes a run SLOWER — another
 * process taking the core, a collection pausing the thread — so the smallest
 * observation is the closest thing to the cost of the work itself. A single
 * reading was tried first and reproduced the original problem in a new form:
 * under four parallel suites the ratio came back at 20, 31 and 65 for code that
 * had not changed, because one measurement of the pair had been descheduled.
 *
 * Nine runs and not five, and a threshold of forty rather than twenty, because
 * five was still not enough: the coverage sweep runs four packages at once and
 * the smaller measurement here is well under a millisecond, where a single
 * descheduling is the whole quantity. Forty still separates the two answers —
 * ten times the input costs about ten times as much linearly and about a
 * hundred times quadratically — and stops the verdict changing with the load.
 */
async function deshevle_vsego(stroit: () => string, raz = 9): Promise<number> {
  let luchshee = Number.POSITIVE_INFINITY;
  for (let i = 0; i < raz; i += 1) {
    const html = stroit();
    luchshee = Math.min(luchshee, await izmerit(() => detectOverlays({ html })));
  }
  return luchshee;
}

/**
 * Time the same shape of input at two sizes and return how much slower the
 * larger one was. A floor is applied to the smaller measurement so a very fast
 * machine cannot divide by something indistinguishable from zero.
 */
async function otnoshenie(
  postroit: (n: number) => string,
  maloe: number,
  bolshoe: number,
): Promise<number> {
  await deshevle_vsego(() => postroit(maloe), 1); // warm the path
  const t1 = Math.max(await deshevle_vsego(() => postroit(maloe)), 0.05);
  const t2 = await deshevle_vsego(() => postroit(bolshoe));
  return t2 / t1;
}

describe('redos resistance', () => {
  it('grows with adversarial nested-script input rather than with its square', async () => {
    const postroit = (n: number) => `<script src="${'a'.repeat(n * 50)}">${'</script>'.repeat(n)}`;
    // Ten times the input: linear work grows about tenfold, quadratic about a
    // hundredfold. Twenty sits between them and stays there on a slow machine.
    expect(await otnoshenie(postroit, 100, 1_000)).toBeLessThan(40);
  });

  it('grows with long flat HTML rather than with its square', async () => {
    const postroit = (n: number) => `<div>${'x '.repeat(n)}</div>`;
    const { vendorsDetected } = await detectOverlays({
      html: postroit(500_000),
    });
    expect(vendorsDetected).toEqual([]);
    expect(await otnoshenie(postroit, 50_000, 500_000)).toBeLessThan(40);
  });

  it('does not backtrack quadratically on repeated benign tokens', async () => {
    const postroit = (n: number) => `<script>${'var x = "acsb";'.repeat(n)}</script>`;
    expect(await otnoshenie(postroit, 2_000, 20_000)).toBeLessThan(40);
  });
});

describe('a page is processed in proportion to its size', () => {
  it('detects the vendor and scales with the page rather than with its square', async () => {
    const postroit = (n: number) =>
      `<html><head><script src="https://acsbapp.com/x.js"></script></head>` +
      `<body><p>${'lorem ipsum '.repeat(n)}</p></body></html>`;

    const stranica = postroit(15_000);
    expect(stranica.length).toBeLessThan(1_000_000);

    const { vendorsDetected } = await detectOverlays({ html: stranica });
    expect(vendorsDetected[0]?.vendor).toBe('accessibe');

    expect(await otnoshenie(postroit, 1_500, 15_000)).toBeLessThan(40);
  });
});
