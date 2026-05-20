// SPDX-License-Identifier: EUPL-1.2
//
// ScanEvent adapter — consumes a normalised location-reference plus the
// source-file text retrieved by the upstream scanner. Pure function: takes
// already-loaded file content and emits a single `AttributionInput`.

import type { AttributionInput, CommitMetadata } from '../types.js';

/** Normalised location reference produced by the upstream scanner. */
export interface LocationReference {
  file_path: string;
  language: string;
  line_start: number;
  line_end: number;
  /** Full source text of the referenced file. */
  source_text: string;
}

/**
 * Build an `AttributionInput` for the source lines `[line_start, line_end]`
 * (inclusive, 1-indexed). Lines outside the file range are silently
 * truncated; an empty extract is permitted (the lexical-entropy extractor
 * returns extraction_confidence = 0 on it).
 */
export function locationToInput(
  loc: LocationReference,
  commit_metadata: CommitMetadata,
): AttributionInput {
  const lines = loc.source_text.split('\n');
  const start = Math.max(1, loc.line_start) - 1;
  const end = Math.max(start, Math.min(lines.length, loc.line_end));
  const slice = lines.slice(start, end);
  return {
    code: slice.join('\n'),
    diff_unified: `@@ -${loc.line_start},${end - start} +${loc.line_start},${end - start} @@\n${slice.map((l) => ` ${l}`).join('\n')}`,
    language: loc.language,
    commit_metadata,
    file_path: loc.file_path,
  };
}
