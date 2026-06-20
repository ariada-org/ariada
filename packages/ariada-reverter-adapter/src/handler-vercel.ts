// SPDX-License-Identifier: EUPL-1.2
// Copyright Agonist Development AB — see NOTICE
//
// Vercel-surface handler.
//
// Flow on deployment_status (state == "ready"):
//   1. Extract deployment URL and GitHub commit SHA from the event.
//   2. If no GitHub commit SHA → skip (report-only mode, no fix-PR possible).
//   3. Fetch scan results from the deployment URL (caller supplies these as
//      LocatedFinding[], mirroring how the GitHub handler receives findings).
//   4. Filter out findings whose fingerprint is in the stored baseline.
//   5. Group remaining findings into clusters.
//   6. For each cluster (up to maxPrsPerEvent), call the cascade and open a
//      draft fix-PR against the GitHub commit SHA.

import type { VercelDeploymentStatusEvent, HandleDeploymentStatusResult, ReverterVercelConfig } from './types/vercel.js';
import type { LocatedFinding } from './cluster.js';
import type { RateLedger } from './rate-ledger.js';
import { buildBranchName, buildFindingClusters, buildPrBody, buildPrTitle } from './cluster.js';
import { CascadeClient, inferCascadeLanguage } from './cascade-client.js';
import { GitHubClient } from './github-client.js';

/**
 * Handle a Vercel `deployment_status` webhook event.
 *
 * @param event             - Parsed webhook payload.
 * @param findings          - Findings from scanning the deployment URL (caller responsibility).
 * @param installationToken - GitHub installation token (for opening fix-PRs).
 * @param config            - Handler configuration.
 * @param rateLedger        - Per-installation, per-day fix-PR counter.
 */
export async function handleDeploymentStatus(
  event: VercelDeploymentStatusEvent,
  findings: LocatedFinding[],
  installationToken: string,
  config: ReverterVercelConfig,
  rateLedger: RateLedger,
): Promise<HandleDeploymentStatusResult> {
  const status = event.payload.status;

  // Only act on "ready" deployments
  if (status !== 'ready') {
    return {
      acted: false,
      deploymentUrl: null,
      targetCommitSha: null,
      openedCount: 0,
      skippedNoGitHubCommit: false,
    };
  }

  const deployment = event.payload.deployment;
  const deploymentUrl = deployment.url;
  const commitSha = deployment.meta?.githubCommitSha;
  const githubOrg = deployment.meta?.githubOrg;
  const githubRepo = deployment.meta?.githubRepo;

  // If there's no linked GitHub commit, we cannot open a fix-PR
  if (!commitSha || !githubOrg || !githubRepo) {
    return {
      acted: true,
      deploymentUrl,
      targetCommitSha: null,
      openedCount: 0,
      skippedNoGitHubCommit: true,
    };
  }

  // Filter out baseline findings
  const netNewFindings = findings.filter(
    (f) => !config.baselineFingerprints.has(f.fingerprint),
  );

  const clusters = buildFindingClusters(netNewFindings);
  const toProcess = clusters.slice(0, config.maxPrsPerEvent);

  const installationId = `vercel-${deployment.id}`;
  const owner = githubOrg;
  const repo = githubRepo;

  const github = new GitHubClient(installationToken, config.githubApiBaseUrl);
  const cascade = new CascadeClient({
    baseUrl: config.cascadeBaseUrl,
    bearerToken: installationToken,
    maxTier: config.maxTier,
  });

  let openedCount = 0;

  for (const cluster of toProcess) {
    const currentCount = rateLedger.currentCount(installationId);
    if (currentCount >= config.maxPrsPerEvent) break;

    const sourceContent = await github.getFileContent(owner, repo, cluster.sourceFilePath, commitSha);
    if (sourceContent === null) continue;

    const language = inferCascadeLanguage(cluster.sourceFilePath);
    const outcome = await cascade.requestFix(cluster, sourceContent, language);

    if (outcome.status !== 'ok' || !outcome.diff || !outcome.fixId) continue;

    const { applyDiffToContent } = await import('./handler-github.js');
    const patchedContent = applyDiffToContent(sourceContent, outcome.diff);
    const originalLines = extractLinesFromContent(sourceContent, cluster.startLine, cluster.endLine);
    const patchedLines = extractLinesFromContent(patchedContent, cluster.startLine, cluster.endLine);

    const branchName = buildBranchName(cluster, commitSha);
    const prTitle = buildPrTitle(cluster);
    const prBody = buildPrBody({
      cluster,
      tierUsed: outcome.tierUsed,
      fixId: outcome.fixId,
      diff: outcome.diff,
      originalLines,
      patchedLines,
      triggeredBy: 'vercel',
      deploymentUrl,
    });

    try {
      const defaultBranch = deployment.meta?.githubCommitRef ?? 'main';
      await github.createBranch(owner, repo, branchName, commitSha);
      await github.commitFile(
        owner,
        repo,
        cluster.sourceFilePath,
        patchedContent,
        `fix(a11y): ${cluster.ruleId} in ${cluster.sourceFilePath} (reverter patch)`,
        branchName,
      );
      await github.openDraftPr(owner, repo, prTitle, prBody, branchName, defaultBranch);
      rateLedger.increment(installationId);
      openedCount++;
    } catch {
      // PR opening failure is non-fatal
    }
  }

  return {
    acted: true,
    deploymentUrl,
    targetCommitSha: commitSha,
    openedCount,
    skippedNoGitHubCommit: false,
  };
}

function extractLinesFromContent(content: string, startLine: number, endLine: number): string {
  return content.split('\n').slice(startLine - 1, endLine).join('\n');
}
