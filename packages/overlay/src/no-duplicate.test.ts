// SPDX-License-Identifier: Apache-2.0

import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// The extension carried a byte-identical copy of this package for a while.
// Nothing broke while the two agreed; the moment one is edited the extension
// and the report render different things from the same findings. This fails
// if a copy comes back.
describe('the overlay lives in one place', () => {
  const root = join(import.meta.dirname, '..', '..', '..');
  it('has no second copy under packages/', () => {
    const copies: string[] = [];
    for (const pkg of readdirSync(join(root, 'packages'))) {
      if (pkg === 'overlay') continue;
      for (const rel of ['src/lib/overlay/painters.js', 'src/overlay/painters.js', 'src/painters.js']) {
        const p = join(root, 'packages', pkg, rel);
        if (existsSync(p)) copies.push(`packages/${pkg}/${rel}`);
      }
    }
    expect(copies).toEqual([]);
  });
});
