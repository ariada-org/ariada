// SPDX-License-Identifier: EUPL-1.2
export {
  diffToInputs,
  parseUnifiedDiff,
  detectLanguage,
} from './git-diff.js';
export {
  prPayloadToInputs,
  type PullRequestPayload,
} from './github-pr.js';
export {
  locationToInput,
  type LocationReference,
} from './scan-event.js';
