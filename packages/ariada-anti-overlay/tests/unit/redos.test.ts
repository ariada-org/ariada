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
//
// How the ratio is taken — cheapest of several readings per side, cheapest of
// several attempts, and why both levels are needed — is in tests/support, with
// the readings that forced each one.

import { describe, it, expect } from 'vitest';

import { detectOverlays } from '../../src/detect.js';
import { otnoshenie, PREDEL } from '../support/otnoshenie.js';

/** How much slower a tenfold page is, measured on the detector itself. */
function vo_skolko_raz(postroit: (n: number) => string, maloe: number, bolshoe: number) {
  return otnoshenie({
    postroit,
    rabota: (html: string) => detectOverlays({ html }),
    maloe,
    bolshoe,
  });
}

describe('redos resistance', () => {
  it('grows with adversarial nested-script input rather than with its square', async () => {
    const postroit = (n: number) => `<script src="${'a'.repeat(n * 50)}">${'</script>'.repeat(n)}`;
    // Ten times the input: linear work grows about tenfold, quadratic about a
    // hundredfold. The ceiling sits between them and stays there on a slow
    // machine.
    expect(await vo_skolko_raz(postroit, 100, 1_000)).toBeLessThan(PREDEL);
  });

  it('grows with long flat HTML rather than with its square', async () => {
    const postroit = (n: number) => `<div>${'x '.repeat(n)}</div>`;
    const { vendorsDetected } = await detectOverlays({
      html: postroit(500_000),
    });
    expect(vendorsDetected).toEqual([]);
    expect(await vo_skolko_raz(postroit, 50_000, 500_000)).toBeLessThan(PREDEL);
  });

  it('does not backtrack quadratically on repeated benign tokens', async () => {
    const postroit = (n: number) => `<script>${'var x = "acsb";'.repeat(n)}</script>`;
    expect(await vo_skolko_raz(postroit, 2_000, 20_000)).toBeLessThan(PREDEL);
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

    expect(await vo_skolko_raz(postroit, 1_500, 15_000)).toBeLessThan(PREDEL);
  });
});
