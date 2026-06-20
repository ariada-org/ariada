// SPDX-License-Identifier: EUPL-1.2
// Copyright Agonist Development AB — see NOTICE

/** Configuration for the Vercel-surface handler. */
export interface ReverterVercelConfig {
  /** Base URL for the cascade endpoint. */
  cascadeBaseUrl: string;
  /** Base URL for the GitHub REST API (used to open fix-PRs). */
  githubApiBaseUrl?: string;
  /** Max cascade tier allowed by the current plan. */
  maxTier: 0 | 1 | 2 | 3;
  /** Max fix-PRs to open per deployment event. */
  maxPrsPerEvent: number;
  /**
   * Fingerprints of findings already in the baseline.
   * Only findings whose fingerprint is NOT in this set trigger a fix-PR.
   */
  baselineFingerprints: ReadonlySet<string>;
}

/**
 * The subset of a Vercel deployment_status webhook payload used by this adapter.
 * Vercel sends this event when a deployment transitions to a new state.
 */
export interface VercelDeploymentStatusEvent {
  type: 'deployment_status' | string;
  payload: {
    deployment: {
      id: string;
      url: string;
      meta?: {
        githubCommitSha?: string;
        githubCommitRef?: string;
        githubOrg?: string;
        githubRepo?: string;
      };
    };
    status: 'ready' | 'error' | 'building' | 'initializing' | string;
    team?: { id: string };
    user?: { id: string };
  };
}

/** Result from handling a Vercel deployment_status event. */
export interface HandleDeploymentStatusResult {
  /** Whether the event was acted upon (only "ready" events trigger fix-PRs). */
  acted: boolean;
  /** The deployment URL that was scanned (null if event was skipped). */
  deploymentUrl: string | null;
  /** The commit SHA the fix-PRs target. */
  targetCommitSha: string | null;
  /** How many fix-PRs were opened. */
  openedCount: number;
  /** Whether the event was skipped because there is no linked GitHub commit. */
  skippedNoGitHubCommit: boolean;
}
