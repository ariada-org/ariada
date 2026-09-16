// SPDX-License-Identifier: EUPL-1.2
// Copyright Agonist Development AB — see NOTICE

/** Configuration for the GitHub App webhook handler. */
export interface GitHubAppConfig {
  /** Base URL for the Blamer attribution API. Override to http://localhost:3099 in tests. */
  blamedApiBaseUrl: string;
  /** Bearer token for authenticating with the Blamer API */
  blamedApiToken: string;
  /** Base URL for the GitHub API. Override to http://localhost:3099 in tests. */
  githubApiBaseUrl: string;
  /**
   * The GitHub App installation access token used to authenticate REST calls
   * for this installation. Minted per-installation by the caller (for example
   * from the app JWT via `POST /app/installations/{id}/access_tokens`) and
   * passed in — never hardcoded.
   */
  installationToken: string;
  /**
   * Secret shared with GitHub to verify inbound webhook signatures
   * (`X-Hub-Signature-256`). See {@link verifyWebhook}.
   */
  webhookSecret: string;
  /** Threshold for AI-authored fraction above which the check run fails (0–1) */
  thresholdFraction: number;
  /** Whether to enable the optional Vercel check-blocking gate */
  enableThresholdBlock: boolean;
}

/** A single file diff hunk extracted from a GitHub PR. */
export interface DiffHunk {
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  language: string;
}

/** GitHub check-run state machine */
export type CheckRunStatus = 'queued' | 'in_progress' | 'completed';
export type CheckRunConclusion = 'success' | 'failure' | 'neutral';

/** Payload for creating a GitHub check run. */
export interface CreateCheckRunPayload {
  owner: string;
  repo: string;
  name: string;
  headSha: string;
  status: CheckRunStatus;
  externalId?: string;
}

/** Payload for updating a completed GitHub check run. */
export interface UpdateCheckRunPayload {
  owner: string;
  repo: string;
  checkRunId: number;
  conclusion: CheckRunConclusion;
  summary: string;
}

/** Payload for posting a PR comment. */
export interface PostCommentPayload {
  owner: string;
  repo: string;
  issueNumber: number;
  body: string;
}

/** Result from GitHub check run creation. */
export interface CheckRunCreated {
  id: number;
  htmlUrl: string;
}

/** A processed pull_request webhook event — the subset this handler uses. */
export interface PullRequestEvent {
  action: 'opened' | 'synchronize' | 'reopened' | string;
  installation: {
    id: number;
  };
  repository: {
    full_name: string;
    owner: { login: string };
    name: string;
  };
  pull_request: {
    number: number;
    head: { sha: string };
  };
}

/** A processed installation webhook event. */
export interface InstallationEvent {
  action: 'created' | 'deleted' | string;
  installation: {
    id: number;
    account: { login: string; type: string };
  };
}
