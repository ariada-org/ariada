// SPDX-License-Identifier: EUPL-1.2
// Copyright Agonist Development AB — see NOTICE
//
// What the fallback diff application does, pinned line by line.
//
// The remediation service returns whole patched content for an ordinary fix, so
// this path runs only when it returns a diff alone. That made it the one
// exported function of this package nothing exercised, and an unexercised
// function is one any rewrite may quietly change. These cases were taken from
// the behaviour as it stands, so a rewrite that alters it reddens here instead
// of reaching a customer's branch.
import { describe, it, expect } from 'vitest';

import { applyDiffToContent } from '../src/handler-github.js';

describe('applyDiffToContent', () => {
  it('replaces the line a hunk removes with the line it adds', () => {
    expect(applyDiffToContent('a\nb\nc\nd', '--- a/x\n+++ b/x\n@@ -2,1 +2,1 @@\n-b\n+B')).toBe(
      'a\nB\nc\nd',
    );
  });

  it('keeps context lines and copies the tail the diff never mentions', () => {
    expect(applyDiffToContent('one\ntwo\nthree\nfour', '@@ -2,2 +2,2 @@\n two\n-three\n+THREE')).toBe(
      'one\ntwo\nTHREE\nfour',
    );
  });

  it('applies every hunk, copying the untouched span between them', () => {
    expect(
      applyDiffToContent('l1\nl2\nl3\nl4\nl5\nl6', '@@ -1,1 +1,1 @@\n-l1\n+L1\n@@ -4,1 +4,1 @@\n-l4\n+L4'),
    ).toBe('L1\nl2\nl3\nL4\nl5\nl6');
  });

  it('adds without removing when the hunk only adds', () => {
    expect(applyDiffToContent('a\nb', '@@ -1,0 +1,1 @@\n+zero')).toBe('zero\na\nb');
  });

  it('ignores the marker git writes for a missing final newline', () => {
    expect(applyDiffToContent('a\nb', '@@ -2,1 +2,1 @@\n-b\n+B\n\\ No newline at end of file')).toBe(
      'a\nB',
    );
  });

  it('stops a hunk at the first line it cannot read, keeping what came before', () => {
    expect(applyDiffToContent('a\nb\nc', '@@ -1,1 +1,1 @@\n-a\n+A\ngarbage\n+ignored')).toBe(
      'A\nb\nc',
    );
  });

  it('returns the original when the diff declares no hunk', () => {
    expect(applyDiffToContent('x\ny', 'not a diff at all')).toBe('x\ny');
  });

  it('returns the original for an empty diff', () => {
    expect(applyDiffToContent('a\nb', '')).toBe('a\nb');
  });
});
