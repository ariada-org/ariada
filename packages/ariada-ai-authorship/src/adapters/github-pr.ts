// SPDX-License-Identifier: EUPL-1.2
//
// GitHub-PR adapter — consumes a normalised payload that the upstream CI
// gate handler is expected to deliver. The shape is intentionally narrow to
// keep the adapter pure (no network calls); the upstream caller is the one
// that fetches the diff from the GitHub REST API.

import type { AttributionInput, CommitMetadata } from '../types.js';

import { diffToInputs } from './git-diff.js';

/** Normalised PR-event payload. */
export interface PullRequestPayload {
  pr_number: number;
  diff_unified: string;
  head_commit: CommitMetadata;
}

/** Convert a PR payload into per-hunk attribution inputs. */
export function prPayloadToInputs(
  payload: PullRequestPayload,
): AttributionInput[] {
  return diffToInputs(payload.diff_unified, payload.head_commit);
}
