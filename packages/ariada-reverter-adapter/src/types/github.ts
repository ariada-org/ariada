// SPDX-License-Identifier: EUPL-1.2
// Copyright Agonist Development AB — see NOTICE

/** Configuration for the GitHub-surface handler. */
export interface ReverterGitHubConfig {
  /**
   * Base URL for the GitHub REST API.
   * Set to http://localhost:NNNN in tests; leave undefined to use the default public endpoint.
   */
  githubApiBaseUrl?: string;
  /** Base URL for the cascade endpoint. Configurable via REVERTER_CASCADE_URL env var in tests. */
  cascadeBaseUrl: string;
  /** Max cascade tier allowed by the current plan (0 = deterministic only, 3 = full). */
  maxTier: 0 | 1 | 2 | 3;
  /** Max fix-PRs to open per trigger event. */
  maxPrsPerEvent: number;
}

/**
 * The subset of a GitHub check_run.completed webhook payload used by this adapter.
 * The action slug check lets the adapter ignore check runs from other tools.
 */
export interface CheckRunCompletedEvent {
  action: 'completed' | string;
  check_run: {
    id: number;
    name: string;
    conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'timed_out' | 'action_required' | string;
    head_sha: string;
    app: {
      slug: string;
    };
    check_suite: {
      id: number;
    };
    output?: {
      summary?: string | null;
    };
  };
  repository: {
    full_name: string;
    owner: { login: string };
    name: string;
    default_branch: string;
  };
  installation?: {
    id: number;
  };
}

/** The subset of a GitHub pull_request.opened/synchronize payload used here. */
export interface PullRequestEvent {
  action: 'opened' | 'synchronize' | 'reopened' | string;
  pull_request: {
    number: number;
    head: { sha: string; ref: string };
    base: { sha: string; ref: string };
  };
  repository: {
    full_name: string;
    owner: { login: string };
    name: string;
  };
  installation?: {
    id: number;
  };
}

/** A draft pull request opened by this adapter. */
export interface OpenedFixPr {
  /** PR number in the target repo. */
  number: number;
  /** Full URL to the PR on GitHub. */
  htmlUrl: string;
  /** The branch name used for this fix. */
  branchName: string;
  /** Always true — fix-PRs are always opened as drafts. */
  draft: true;
}

/** Result from handling one check_run.completed event. */
export interface HandleCheckRunResult {
  /** How many fix-PRs were opened. */
  openedCount: number;
  /** Fix-PRs that were opened. */
  opened: OpenedFixPr[];
  /** Clusters that hit the rate cap and were not opened. */
  rateLimitedCount: number;
  /** Whether the rate cap comment was posted. */
  rateLimitCommentPosted: boolean;
}
