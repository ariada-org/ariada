// SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB)
// SPDX-License-Identifier: EUPL-1.2
//
// Measuring the SHAPE of work rather than its duration.
//
// Asking whether a detector backtracks catastrophically is a question about
// shape: multiply the input tenfold and see whether the time follows the input
// (about ten times) or its square (about a hundred). A ceiling between those
// two answers separates them on any machine, which is why the tests that used
// to assert "under 500 ms" now assert a ratio instead.
//
// A ratio is a quotient of two independently noisy numbers, and contention can
// only ever push an observation upward — a core taken by another process, a
// collection pausing the thread. So every measurement here is the cheapest of
// several, and every ratio is the cheapest of several attempts. Both are the
// same argument applied at two levels, and the second level is here because
// the first was not enough:
//
//   a single reading per side  → 20, 31 and 65 for code that had not changed
//   cheapest of nine per side  → 45.65 against a ceiling of 40, on a runner
//                                building several packages at once, which
//                                refused a commit for three days
//
// An attempt that already answers below the ceiling ends the loop, so an
// unloaded machine pays exactly what it paid before and only a suspicious
// reading buys a second look. Genuinely quadratic work returns about a hundred
// on every attempt, so nothing is weakened by repeating the question.

/** Time one call, in milliseconds. */
export type Izmeritel = (rabota: () => Promise<unknown>) => Promise<number>;

export interface Vopros<T> {
  /** Build the input at a given size. Called outside the timer. */
  postroit: (n: number) => T;
  /** The work being measured. */
  rabota: (vhod: T) => Promise<unknown>;
  /** The smaller size. */
  maloe: number;
  /** The larger size, conventionally ten times the smaller. */
  bolshoe: number;
  /** Stop as soon as an attempt lands below this. */
  porog?: number;
  /** How many independent attempts at most. */
  popytok?: number;
  /** Readings per side, of which the cheapest is kept. */
  raz?: number;
  /** Substituted by the tests that check this file itself. */
  izmerit?: Izmeritel;
}

/**
 * The ceiling every caller uses. Ten times the input costs about ten times as
 * much linearly and about a hundred times quadratically; forty sits between
 * the two and stays there on a slow machine.
 */
export const PREDEL = 40;

/**
 * A floor under the smaller measurement, so a very fast machine cannot divide
 * by something indistinguishable from zero.
 */
const POL_MS = 0.05;

/** Time one call with the high-resolution clock, in milliseconds. */
export const izmerit_chasami: Izmeritel = async (rabota) => {
  const start = process.hrtime.bigint();
  await rabota();
  return Number(process.hrtime.bigint() - start) / 1_000_000;
};

/** The cheapest of several readings of the same work at one size. */
async function deshevle_vsego<T>(
  vopros: Vopros<T>,
  razmer: number,
  raz: number,
  izmerit: Izmeritel,
): Promise<number> {
  let luchshee = Number.POSITIVE_INFINITY;
  for (let i = 0; i < raz; i += 1) {
    const vhod = vopros.postroit(razmer);
    luchshee = Math.min(luchshee, await izmerit(() => vopros.rabota(vhod)));
  }
  return luchshee;
}

/**
 * How much slower the larger input was than the smaller one, taken as the
 * cheapest ratio observed across attempts.
 */
export async function otnoshenie<T>(vopros: Vopros<T>): Promise<number> {
  const porog = vopros.porog ?? PREDEL;
  const popytok = vopros.popytok ?? 3;
  const raz = vopros.raz ?? 9;
  const izmerit = vopros.izmerit ?? izmerit_chasami;

  await deshevle_vsego(vopros, vopros.maloe, 1, izmerit); // warm the path

  let luchshee = Number.POSITIVE_INFINITY;
  for (let popytka = 0; popytka < popytok; popytka += 1) {
    const maloe = Math.max(await deshevle_vsego(vopros, vopros.maloe, raz, izmerit), POL_MS);
    const bolshoe = await deshevle_vsego(vopros, vopros.bolshoe, raz, izmerit);
    luchshee = Math.min(luchshee, bolshoe / maloe);
    if (luchshee < porog) break;
  }
  return luchshee;
}
