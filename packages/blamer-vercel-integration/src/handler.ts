// SPDX-License-Identifier: EUPL-1.2
// Copyright Agonist Development AB — see NOTICE
import {
  BlamedApiClient,
  renderVercelComment,
} from '@ariada-org/blamer-api-client';
import type { HandleDeploymentResult, VercelDeploymentEvent, VercelIntegrationConfig } from './types.js';

// Re-export for external consumers that want just the config type
export type { VercelIntegrationConfig };

/** Thin Vercel REST API v9 client — posts comments and creates/updates checks. */
class VercelApiClient {
  readonly #baseUrl: string;
  readonly #token: string;

  constructor(baseUrl: string, token: string) {
    this.#baseUrl = baseUrl;
    this.#token = token;
  }

  #headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.#token}`,
      'Content-Type': 'application/json',
    };
  }

  async postDeploymentComment(deploymentId: string, text: string): Promise<{ id: string }> {
    const url = `${this.#baseUrl}/v1/deployments/${deploymentId}/comments`;
    const response = await fetch(url, {
      method: 'POST',
      headers: this.#headers(),
      body: JSON.stringify({ text }),
    });
    if (!response.ok) {
      throw new Error(`Vercel API error posting comment: HTTP ${response.status}`);
    }
    const body = (await response.json()) as { id: string };
    return { id: body.id };
  }

  async createCheck(
    deploymentId: string,
    name: string,
    blocking: boolean,
  ): Promise<{ id: string }> {
    const url = `${this.#baseUrl}/v1/deployments/${deploymentId}/checks`;
    const response = await fetch(url, {
      method: 'POST',
      headers: this.#headers(),
      body: JSON.stringify({ name, blocking }),
    });
    if (!response.ok) {
      throw new Error(`Vercel API error creating check: HTTP ${response.status}`);
    }
    const body = (await response.json()) as { id: string };
    return { id: body.id };
  }

  async updateCheck(
    deploymentId: string,
    checkId: string,
    conclusion: 'passed' | 'failed',
  ): Promise<void> {
    const url = `${this.#baseUrl}/v1/deployments/${deploymentId}/checks/${checkId}`;
    const response = await fetch(url, {
      method: 'PATCH',
      headers: this.#headers(),
      body: JSON.stringify({ conclusion }),
    });
    if (!response.ok) {
      throw new Error(`Vercel API error updating check: HTTP ${response.status}`);
    }
  }
}

/**
 * Handles a Vercel `deployment.succeeded` webhook event.
 *
 * Flow:
 *   1. Extract deployment metadata (repo, commit SHA)
 *   2. Build minimal inputs from diff metadata (real deployment resolves diff via GitHub OAuth)
 *   3. Call Blamer API
 *   4. Post Vercel deploy comment (plain text)
 *   5. Optionally create + complete a blocking check
 */
export async function handleDeployment(
  event: VercelDeploymentEvent,
  config: VercelIntegrationConfig,
): Promise<HandleDeploymentResult> {
  const deployment = event.payload.deployment;
  const deploymentId = deployment.id;
  const commitSha = deployment.meta?.githubCommitSha ?? 'unknown';
  const githubRepo =
    deployment.meta?.githubOrg && deployment.meta?.githubRepo
      ? `${deployment.meta.githubOrg}/${deployment.meta.githubRepo}`
      : 'unknown/repo';

  const vercel = new VercelApiClient(config.vercelApiBaseUrl, config.vercelAccessToken);
  const blamedClient = new BlamedApiClient({
    baseUrl: config.blamedApiBaseUrl,
    bearerToken: config.blamedApiToken,
    githubInstallationId: undefined,
    githubRepo: githubRepo,
    clientVersion: undefined,
  });

  // In production, the diff is resolved from the GitHub API using the OAuth
  // token stored at install time. For MVP, we use a representative single-hunk input
  // constructed from the commit metadata.
  const nowIso = new Date().toISOString();
  const inputs = [
    {
      code: `// Deployment ${deploymentId} at commit ${commitSha}`,
      diff_unified: `// Deployment ${deploymentId} at commit ${commitSha}`,
      language: 'typescript',
      file_path: 'deployment.meta',
      commit_metadata: {
        timestamp_utc: nowIso,
        git_author_email: '',
        commit_message: `Deployment ${deploymentId}`,
        prior_commit_timestamps: [] as string[],
      },
    },
  ];

  const reportResult = await blamedClient.getReport(deploymentId, 'deployment', githubRepo, inputs, {
    thresholdFraction: config.thresholdFraction,
  });

  // Build comment body from report (or error state)
  let commentBody: string;
  if (reportResult.ok) {
    commentBody = renderVercelComment(reportResult.value);
  } else {
    commentBody = `Blamer: attribution unavailable (${reportResult.error.kind}). See the project documentation for details.`;
  }

  const { id: commentId } = await vercel.postDeploymentComment(deploymentId, commentBody);

  // Optional blocking check
  let checkCreated = false;
  let checkConclusion: 'passed' | 'failed' | undefined;

  if (config.enableThresholdBlock && reportResult.ok) {
    const check = await vercel.createCheck(deploymentId, 'Blamer — authorship gate', true);
    const conclusion = reportResult.value.thresholdViolated ? 'failed' : 'passed';
    await vercel.updateCheck(deploymentId, check.id, conclusion);
    checkCreated = true;
    checkConclusion = conclusion;
  }

  return {
    deploymentId,
    commentId,
    commentBody,
    checkCreated,
    checkConclusion,
  };
}
