// SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB)
// SPDX-License-Identifier: EUPL-1.2
//
// The tool used to answer two different versions about itself: 0.3.0 to
// `ariada version` and 0.1.0 to `ariada --version`, because the flag carried a
// literal that stopped being true three releases earlier. The flag is the one
// everyone types and the one every bug report quotes, so the wrong answer was
// the one that travelled — a maintainer reading "0.1.0" would go looking at
// code that has not shipped since.
//
// What is held here is not the number. It is that the two ways of asking give
// the same answer, and that the answer is the manifest's.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { ownVersion } from '../src/own-version.js';

const manifest = JSON.parse(
  readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'),
) as { version: string };

describe('the version the tool reports about itself', () => {
  it('is the one in its manifest', () => {
    expect(ownVersion()).toBe(manifest.version);
  });

  it('is not a literal somebody has to remember to update', () => {
    // The failure this replaces: a hand-written string that was right once.
    // Reading the source rather than the value, because a literal that happens
    // to match today is the same defect as one that does not.
    const source = readFileSync(
      fileURLToPath(new URL('../src/parser.ts', import.meta.url)),
      'utf8',
    );
    expect(source).toMatch(/\.version\(ownVersion\(\)/);
    expect(source).not.toMatch(/\.version\('\d/);
  });

  it('says so rather than guessing when the manifest cannot be read', () => {
    // Not reachable from here without moving the file, but the contract is
    // that an unreadable manifest produces a word, not a plausible number.
    expect(ownVersion()).not.toBe('');
    expect(typeof ownVersion()).toBe('string');
  });
});
