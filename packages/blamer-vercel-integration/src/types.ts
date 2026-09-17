// SPDX-License-Identifier: EUPL-1.2
// Copyright Agonist Development AB — see NOTICE

/** Configuration for the Vercel Integration webhook handler. */
export interface VercelIntegrationConfig {
  /** Base URL for the Blamer attribution API */
  blamedApiBaseUrl: string;
  /** Bearer token for authenticating with the Blamer API */
  blamedApiToken: string;
  /** Base URL for the Vercel API. Override to http://localhost:3099 in tests. */
  vercelApiBaseUrl: string;
  /** Vercel API access token */
  vercelAccessToken: string;
  /**
   * The Vercel Integration client secret, used to verify inbound webhook
   * signatures (`x-vercel-signature`). See {@link verifyWebhook}.
   */
  webhookSecret: string;
  /** Threshold for AI-authored fraction above which the optional blocking check fails (0–1) */
  thresholdFraction: number;
  /** Whether to enable the optional blocking check (disabled by default) */
  enableThresholdBlock: boolean;
}

/** The subset of a Vercel deployment.succeeded webhook payload that this handler uses. */
export interface VercelDeploymentEvent {
  type: 'deployment.succeeded' | string;
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
    team?: { id: string };
    user?: { id: string };
  };
}

/** Result of handling a Vercel deployment webhook. */
export interface HandleDeploymentResult {
  deploymentId: string;
  commentId: string;
  commentBody: string;
  checkCreated: boolean;
  checkConclusion: 'passed' | 'failed' | undefined;
}
