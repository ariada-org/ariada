// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Guard: the help text does not claim more coverage than the rules deliver.
//
// The published tool described its accessibility scan as the "full WCAG 2.2 AA
// rule set". Driven and counted: 46 registered rules referencing 23 distinct
// success criteria, against the 55 in WCAG 2.2 AA.
//
// Twenty-three is not a bad number. Most of the rest cannot be judged by a
// machine at all — no scanner can tell whether alternative text is meaningful,
// whether a heading describes its section, or whether an error message helps.
// A tool that claimed otherwise would be worse than one that covers twenty-three
// and says so.
//
// The word that was wrong is "full". It is a promise to whoever reads `--help`
// that they can stop looking, and that is the accusation accessibility tooling
// most often earns.
//
// WHAT THIS HOLDS. Not a number — a rule set grows and shrinks, and a guard
// pinned to 23 would go red for the right reasons and be deleted. It holds the
// relationship: the user-facing text may not use the language of completeness
// while the registered rules fall short of the standard they name.
import { describe, expect, it } from 'vitest';

import { buildProgram } from '../src/parser.js';

/** Every description string the parser exposes, top level and subcommands. */
function allDescriptions(): string[] {
  const sink = { write: () => true } as unknown as NodeJS.WritableStream;
  const { program } = buildProgram(sink, sink);
  return [
    program.description(),
    ...program.commands.map((c) => c.description()),
  ].filter((s): s is string => typeof s === 'string' && s.length > 0);
}

describe('what the help text claims about coverage', () => {
  it('never says a whole standard is covered', () => {
    // "full WCAG", "complete WCAG", "all of WCAG", "entire WCAG" — the shapes a
    // promise of completeness takes. Naming the standard is fine and necessary;
    // saying it is finished is not.
    const overclaim = /\b(full|complete|entire|all)\b[^.]{0,40}\bWCAG\b/i;
    for (const description of allDescriptions()) {
      expect(description, `overclaims coverage: ${description}`).not.toMatch(overclaim);
    }
  });

  it('still names the standards it tests against, so the text stays useful', () => {
    const joined = allDescriptions().join(' ');
    expect(joined).toMatch(/WCAG 2\.2/);
    expect(joined).toMatch(/EN 301 549/);
  });

  it('points the reader at where the real answer is', () => {
    // The honest version of a coverage claim is a way to look it up.
    expect(allDescriptions().join(' ')).toMatch(/list-rules/);
  });
});
