// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect } from 'vitest';

import { locationToInput } from '../../src/adapters/scan-event.js';
import { sampleMetadata } from '../helpers.js';

const SAMPLE_SOURCE = ['one', 'two', 'three', 'four', 'five'].join('\n');

describe('scan-event adapter', () => {
  it('extracts the referenced line slice', () => {
    const input = locationToInput(
      {
        file_path: 'src/x.ts',
        language: 'ts',
        line_start: 2,
        line_end: 4,
        source_text: SAMPLE_SOURCE,
      },
      sampleMetadata(),
    );
    expect(input.code).toBe('two\nthree\nfour');
    expect(input.language).toBe('ts');
    expect(input.file_path).toBe('src/x.ts');
  });

  it('truncates safely on out-of-range references', () => {
    const input = locationToInput(
      {
        file_path: 'src/x.ts',
        language: 'ts',
        line_start: 0,
        line_end: 99,
        source_text: SAMPLE_SOURCE,
      },
      sampleMetadata(),
    );
    expect(input.code.split('\n').length).toBeLessThanOrEqual(5);
  });
});
