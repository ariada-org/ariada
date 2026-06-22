// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { once } from 'node:events';

import { describe, expect, it } from 'vitest';

import { ariadaGulp, type VinylLike } from '../src/index.js';

describe('gulp-ariada', () => {
  it('annotates streamed HTML files with Ariada findings', async () => {
    const stream = ariadaGulp({
      scanner: () => [{ ruleId: 'image-alt', severity: 'serious', message: 'Image needs text.' }],
    });
    const output: VinylLike[] = [];
    stream.on('data', (file: VinylLike) => output.push(file));

    stream.end({ path: 'index.html', contents: Buffer.from('<img>') });
    await once(stream, 'finish');

    expect(output[0]?.ariadaFindings).toHaveLength(1);
  });
});
