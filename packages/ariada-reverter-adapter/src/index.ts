// SPDX-License-Identifier: EUPL-1.2
// Copyright Agonist Development AB — see NOTICE
//
// Public entry point for the reverter adapter.

// GitHub-surface handler
export { handleCheckRunCompleted } from './handler-github.js';
export { applyDiffToContent } from './handler-github.js';
export type { HandleCheckRunResult, OpenedFixPr, ReverterGitHubConfig, CheckRunCompletedEvent, PullRequestEvent } from './types/github.js';

// Vercel-surface handler
export { handleDeploymentStatus } from './handler-vercel.js';
export type { HandleDeploymentStatusResult, ReverterVercelConfig, VercelDeploymentStatusEvent } from './types/vercel.js';

// Cascade client
export { CascadeClient, inferCascadeLanguage } from './cascade-client.js';
export type { CascadeClientOptions } from './cascade-client.js';
export type { CascadeFixRequest, CascadeFixResponse, ClusterFixOutcome, FindingCluster } from './types/cascade.js';

// Cluster builder
export {
  buildFindingClusters,
  buildBranchName,
  buildPrTitle,
  buildPrBody,
  buildRateLimitComment,
  MAX_CLUSTER_LINES,
  MAX_CLUSTERS_PER_SCAN,
} from './cluster.js';
export type { LocatedFinding } from './cluster.js';

// GitHub client
export { GitHubClient } from './github-client.js';

// Rate ledger
export { InMemoryRateLedger } from './rate-ledger.js';
export type { RateLedger } from './rate-ledger.js';
