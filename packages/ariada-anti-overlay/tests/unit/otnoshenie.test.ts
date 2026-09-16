// SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB)
// SPDX-License-Identifier: EUPL-1.2
//
// What this guards, and why it exists.
//
// The neighbouring tests decide by a ratio rather than by a duration, so that a
// slow machine moves both sides together and stops deciding anything. That is
// right, and it was not sufficient: on 2026-09-13 the ratio came back at 45.65
// against a ceiling of 40 for a detector nobody had touched. The same commit
// carried a passing result from the same workflow eight seconds earlier — the
// run that happened to get a quieter share of the runner. The red one refused
// the commit for three days with fifty-one transfers queued behind it.
//
// Contention can only ever make a reading slower, so the answer at both levels
// is to keep the cheapest observation. The readings per side already did that.
// The ratio did not, and a quotient of two noisy numbers is noisier than
// either.
//
// A repeat cannot be checked by running it on a loaded machine and hoping, so
// the clock is substituted here and the readings are dictated. Without the
// repeat, the first test below returns 45 and fails — which is the whole
// reason the measurement moved out of the test file it serves.

import { describe, expect, it } from 'vitest';

import { otnoshenie, type Izmeritel } from '../support/otnoshenie.js';

/**
 * A clock that reads from a script instead of from the machine.
 *
 * Runs out loudly rather than repeating its last value: a measurer that
 * silently keeps answering would let a test assert over readings it never
 * described.
 */
function po_scenariyu(chteniya: number[]): { izmerit: Izmeritel; ostalos: () => number } {
  let i = 0;
  const izmerit: Izmeritel = async (rabota) => {
    await rabota();
    const ms = chteniya[i];
    if (ms === undefined) throw new Error(`the script ran out after ${i} readings`);
    i += 1;
    return ms;
  };
  return { izmerit, ostalos: () => chteniya.length - i };
}

/** One reading per side, so the script reads as the attempts it describes. */
const vopros = (chteniya: number[], popytok = 3) => {
  const { izmerit, ostalos } = po_scenariyu(chteniya);
  return {
    zapros: {
      postroit: (n: number) => n,
      rabota: async () => undefined,
      maloe: 1_500,
      bolshoe: 15_000,
      raz: 1,
      popytok,
      izmerit,
    },
    ostalos,
  };
};

describe('the ratio is the cheapest attempt, not the first', () => {
  it('ignores an attempt that contention inflated', async () => {
    // Reading order: one warm-up, then small and large per attempt.
    //   warm-up 1 · attempt one 1 / 45 · attempt two 1 / 10
    // A single attempt answers 45 and refuses the commit. Two answer 10.
    const { zapros } = vopros([1, 1, 45, 1, 10]);
    expect(await otnoshenie(zapros)).toBeCloseTo(10);
  });

  it('stops as soon as an attempt answers below the ceiling', async () => {
    // An unloaded machine must pay exactly what it paid before the repeat was
    // added: warm-up plus one attempt, and nothing more.
    const { zapros, ostalos } = vopros([1, 1, 10, 999, 999, 999, 999]);
    expect(await otnoshenie(zapros)).toBeCloseTo(10);
    expect(ostalos()).toBe(4);
  });

  it('still reports quadratic work, which is red on every attempt', async () => {
    // The guard keeps its teeth: a detector that backtracks returns about a
    // hundred however many times it is asked.
    const { zapros } = vopros([1, 1, 110, 1, 98, 1, 104]);
    expect(await otnoshenie(zapros)).toBeGreaterThan(40);
  });

  it('does not divide by a measurement indistinguishable from zero', async () => {
    // A machine fast enough to read zero on the smaller side would otherwise
    // produce an infinite ratio and a failure that means nothing. The floor is
    // 0.05 ms, so 4 ms over it is 80.
    const { zapros } = vopros([0, 0, 4, 0, 4, 0, 4]);
    expect(await otnoshenie(zapros)).toBeCloseTo(80);
  });

  it('runs out loudly when asked for more readings than it was given', async () => {
    const { zapros } = vopros([1, 1], 3);
    await expect(otnoshenie(zapros)).rejects.toThrow(/ran out/);
  });
});
