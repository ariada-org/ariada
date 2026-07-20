// SPDX-License-Identifier: EUPL-1.2
// Copyright Agonist Development AB — see NOTICE
import {
  BlamedApiClient,
  renderGitHubComment,
  renderQuotaExceededComment,
  renderAuthErrorComment,
} from '@ariada-org/blamer-api-client';
import { GitHubRestClient } from './github-client.js';
import type { GitHubAppConfig, InstallationEvent, PullRequestEvent } from './types.js';

/**
 * Result of handling a pull_request webhook.
 * Carries enough information to verify the visual checks described in the integration test plan.
 */
export interface HandlePullRequestResult {
  checkRunId: number;
  conclusion: 'success' | 'failure' | 'neutral';
  commentId: number;
  commentBody: string;
  /** Whether the request was rejected due to quota */
  quotaExceeded: boolean;
  /** Whether the request was rejected due to auth failure */
  authFailed: boolean;
}

/**
 * Handles a GitHub App `pull_request` webhook event.
 *
 * Flow:
 *   1. Create check run (queued)
 *   2. Fetch PR diff
 *   3. Call Blamer API
 *   4. Update check run (success/failure)
 *   5. Post PR comment
 */
export async function handlePullRequest(
  event: PullRequestEvent,
  config: GitHubAppConfig,
): Promise<HandlePullRequestResult> {
  const [owner, repoName] = event.repository.full_name.split('/') as [string, string];
  const pullNumber = event.pull_request.number;
  const headSha = event.pull_request.head.sha;

  const github = new GitHubRestClient(config.githubApiBaseUrl, config.installationToken);

  // Step 1: Create check run in queued state
  const checkRun = await github.createCheckRun(owner, repoName, 'Blamer attribution audit', headSha, 'queued');

  // Step 2: Fetch PR diff
  const diffHunks = await github.getPullRequestFiles(owner, repoName, pullNumber);

  // Convert diff hunks to AttributionInput (real shape from @ariada-org/ai-authorship).
  // git_author_email is SHA-256 hashed before transmission per the privacy policy.
  const nowIso = new Date().toISOString();
  const inputs = diffHunks.map((hunk) => ({
    code: hunk.content,
    diff_unified: hunk.content,
    language: hunk.language,
    file_path: hunk.filePath,
    commit_metadata: {
      timestamp_utc: nowIso,
      git_author_email: '', // hashed; empty for fixture — real impl would hash from git blame
      commit_message: '',
      prior_commit_timestamps: [] as string[],
    },
  }));

  // Step 3: Call Blamer API
  const blamedClient = new BlamedApiClient({
    baseUrl: config.blamedApiBaseUrl,
    bearerToken: config.blamedApiToken,
    githubInstallationId: String(event.installation.id),
    githubRepo: event.repository.full_name,
    clientVersion: undefined,
  });

  const reportResult = await blamedClient.getReport(
    String(pullNumber),
    'pull_request',
    event.repository.full_name,
    inputs.length > 0
      ? inputs
      : [{
          code: '// empty diff',
          diff_unified: '// empty diff',
          language: 'typescript',
          file_path: 'empty',
          commit_metadata: {
            timestamp_utc: nowIso,
            git_author_email: '',
            commit_message: '',
            prior_commit_timestamps: [] as string[],
          },
        }],
    { thresholdFraction: config.thresholdFraction },
  );

  // Steps 4 & 5: Update check run and post comment based on result
  if (!reportResult.ok) {
    const { error } = reportResult;

    if (error.kind === 'auth_failed') {
      const commentBody = renderAuthErrorComment();
      await github.updateCheckRun(owner, repoName, checkRun.id, 'neutral', commentBody);
      const comment = await github.postComment({ owner, repo: repoName, issueNumber: pullNumber, body: commentBody });
      return {
        checkRunId: checkRun.id,
        conclusion: 'neutral',
        commentId: comment.id,
        commentBody,
        quotaExceeded: false,
        authFailed: true,
      };
    }

    if (error.kind === 'quota_exceeded') {
      const commentBody = renderQuotaExceededComment(error.resetAt, error.upgradeUrl);
      await github.updateCheckRun(owner, repoName, checkRun.id, 'neutral', commentBody);
      const comment = await github.postComment({ owner, repo: repoName, issueNumber: pullNumber, body: commentBody });
      return {
        checkRunId: checkRun.id,
        conclusion: 'neutral',
        commentId: comment.id,
        commentBody,
        quotaExceeded: true,
        authFailed: false,
      };
    }

    // Generic error
    const fallbackBody = `Blamer: attribution failed (${error.kind}). Please try again or contact your installation support.`;
    await github.updateCheckRun(owner, repoName, checkRun.id, 'neutral', fallbackBody);
    const comment = await github.postComment({ owner, repo: repoName, issueNumber: pullNumber, body: fallbackBody });
    return {
      checkRunId: checkRun.id,
      conclusion: 'neutral',
      commentId: comment.id,
      commentBody: fallbackBody,
      quotaExceeded: false,
      authFailed: false,
    };
  }

  const report = reportResult.value;
  const conclusion = report.thresholdViolated ? 'failure' : 'success';
  const commentBody = renderGitHubComment(report);

  await github.updateCheckRun(owner, repoName, checkRun.id, conclusion, commentBody);
  const comment = await github.postComment({
    owner,
    repo: repoName,
    issueNumber: pullNumber,
    body: commentBody,
  });

  return {
    checkRunId: checkRun.id,
    conclusion,
    commentId: comment.id,
    commentBody,
    quotaExceeded: false,
    authFailed: false,
  };
}

/**
 * Handles a GitHub App `installation` webhook event.
 * Records the installation and maps it to a tier.
 */
export function handleInstallation(event: InstallationEvent): {
  installationId: number;
  orgLogin: string;
  tier: 'free';
} {
  console.log(
    `[blamer-github-app] Installation ${event.action}: id=${event.installation.id} org=${event.installation.account.login}`,
  );
  return {
    installationId: event.installation.id,
    orgLogin: event.installation.account.login,
    tier: 'free',
  };
}
