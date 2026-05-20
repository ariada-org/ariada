// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect } from 'vitest';

import {
  detectLanguage,
  diffToInputs,
  parseUnifiedDiff,
} from '../../src/adapters/git-diff.js';
import { sampleMetadata } from '../helpers.js';

const SAMPLE_DIFF = `diff --git a/src/a.ts b/src/a.ts
@@ -1,3 +1,5 @@
 unchanged
+added line one
+added line two
 still unchanged
diff --git a/src/b.py b/src/b.py
@@ -10,2 +10,3 @@
+def hello():
+    return 'hi'
`;

describe('git diff adapter', () => {
  it('detects language from extension', () => {
    expect(detectLanguage('src/foo.ts')).toBe('ts');
    expect(detectLanguage('src/foo.py')).toBe('py');
    expect(detectLanguage('src/foo.rs')).toBe('rust');
    expect(detectLanguage('Makefile')).toBe('unknown');
  });

  it('parses multi-hunk multi-file diff into two hunks', () => {
    const hunks = parseUnifiedDiff(SAMPLE_DIFF);
    expect(hunks).toHaveLength(2);
    expect(hunks[0]?.file_path).toBe('src/a.ts');
    expect(hunks[1]?.file_path).toBe('src/b.py');
    expect(hunks[0]?.added_lines).toEqual(['added line one', 'added line two']);
  });

  it('produces an AttributionInput per hunk', () => {
    const inputs = diffToInputs(SAMPLE_DIFF, sampleMetadata());
    expect(inputs).toHaveLength(2);
    expect(inputs[0]?.language).toBe('ts');
    expect(inputs[1]?.language).toBe('py');
  });

  it('returns empty array on empty diff', () => {
    expect(parseUnifiedDiff('')).toEqual([]);
    expect(diffToInputs('', sampleMetadata())).toEqual([]);
  });
});
