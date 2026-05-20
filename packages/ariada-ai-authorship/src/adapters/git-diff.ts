// SPDX-License-Identifier: EUPL-1.2
//
// `git diff --unified` adapter. Parses a unified-diff string into one
// `AttributionInput` per hunk. Pure function — no I/O — so the caller is
// expected to have already produced the diff via their preferred git
// invocation.

import type { AttributionInput, CommitMetadata } from '../types.js';

interface ParsedHunk {
  file_path: string;
  added_lines: string[];
  hunk_header: string;
}

/** Parse a unified diff string into per-hunk records. */
export function parseUnifiedDiff(diff: string): ParsedHunk[] {
  const hunks: ParsedHunk[] = [];
  if (diff.length === 0) return hunks;
  const lines = diff.split('\n');
  let currentFile = '';
  let currentHunk: ParsedHunk | null = null;
  for (const ln of lines) {
    if (ln.startsWith('diff --git ')) {
      if (currentHunk !== null) {
        hunks.push(currentHunk);
        currentHunk = null;
      }
      const parts = ln.split(' ');
      const last = parts[parts.length - 1];
      if (last !== undefined) currentFile = last.replace(/^b\//u, '');
      continue;
    }
    if (ln.startsWith('+++ ')) {
      const after = ln.slice(4);
      currentFile = after.replace(/^b\//u, '');
      continue;
    }
    if (ln.startsWith('@@')) {
      if (currentHunk !== null) hunks.push(currentHunk);
      currentHunk = {
        file_path: currentFile,
        added_lines: [],
        hunk_header: ln,
      };
      continue;
    }
    if (currentHunk === null) continue;
    if (ln.startsWith('+') && !ln.startsWith('+++')) {
      currentHunk.added_lines.push(ln.slice(1));
    }
  }
  if (currentHunk !== null) hunks.push(currentHunk);
  return hunks;
}

/** Detect a language from a file path suffix. */
export function detectLanguage(filePath: string): string {
  const dot = filePath.lastIndexOf('.');
  if (dot < 0 || dot === filePath.length - 1) return 'unknown';
  const ext = filePath.slice(dot + 1).toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'ts';
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return 'js';
    case 'py':
      return 'py';
    case 'go':
      return 'go';
    case 'rs':
      return 'rust';
    case 'java':
      return 'java';
    case 'c':
    case 'cc':
    case 'cpp':
    case 'h':
    case 'hpp':
      return 'cpp';
    case 'rb':
      return 'rb';
    case 'php':
      return 'php';
    case 'kt':
      return 'kt';
    case 'swift':
      return 'swift';
    case 'cs':
      return 'cs';
    case 'scala':
      return 'scala';
    default:
      return ext;
  }
}

/**
 * Convert a parsed unified diff plus commit metadata into per-hunk
 * `AttributionInput` records.
 */
export function diffToInputs(
  diff: string,
  commit_metadata: CommitMetadata,
): AttributionInput[] {
  const hunks = parseUnifiedDiff(diff);
  return hunks.map((h) => ({
    code: h.added_lines.join('\n'),
    diff_unified: `${h.hunk_header}\n${h.added_lines.map((l) => `+${l}`).join('\n')}`,
    language: detectLanguage(h.file_path),
    commit_metadata,
    file_path: h.file_path,
  }));
}
