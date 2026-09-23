// SPDX-License-Identifier: EUPL-1.2
// Copyright Agonist Development AB — see NOTICE
//
// GitHub-surface handler.
//
// Flow on check_run.completed:
//   1. Filter events: only "ariada-diff" app + conclusion "failure".
//   2. Extract findings from the check-run output (provided by caller).
//   3. Group findings into clusters.
//   4. For each cluster (up to maxPrsPerEvent):
//      a. Check rate ledger — if capped, post rate-limit comment and stop.
//      b. Fetch source file content from GitHub.
//      c. Call cascade endpoint.
//      d. Create branch + commit patch + open draft PR.
//   5. Return summary result.

import { CascadeClient, inferCascadeLanguage } from './cascade-client.js';
import type { LocatedFinding } from './cluster.js';
import { buildBranchName, buildFindingClusters, buildPrBody, buildPrTitle, buildRateLimitComment } from './cluster.js';
import { GitHubClient } from './github-client.js';
import type { RateLedger } from './rate-ledger.js';
import type { CheckRunCompletedEvent, HandleCheckRunResult, OpenedFixPr, ReverterGitHubConfig } from './types/github.js';

/** Default upgrade CTA URL when the cascade doesn't return one. */
const DEFAULT_UPGRADE_URL = 'https://example.com/pricing?ref=rate_limit';

/** The GitHub App slug this adapter listens for. */
const ARIADA_DIFF_APP_SLUG = 'ariada-diff';

/**
 * What became of one cluster.
 *
 * The caller needs to tell three endings apart, because each moves a different
 * counter: a pull request was opened, the installation is over its allowance and
 * owes a comment, or there was nothing to open and nobody to tell.
 */
type ClusterOutcome =
  | { kind: 'opened'; pr: OpenedFixPr }
  | { kind: 'rate-limited'; upgradeCta: string }
  | { kind: 'skipped' };

/** Everything one cluster needs that does not vary between clusters. */
interface ClusterContext {
  github: GitHubClient;
  cascade: CascadeClient;
  rateLedger: RateLedger;
  config: ReverterGitHubConfig;
  installationId: string;
  owner: string;
  repo: string;
  headSha: string;
  baseBranch: string;
}

/**
 * Take one cluster as far as a draft pull request, and report which ending it
 * reached.
 *
 * Every exit is a returned outcome rather than a mutated counter, so the loop
 * that calls this holds all the arithmetic in one place.
 */
async function openFixPrForCluster(
  cluster: ReturnType<typeof buildFindingClusters>[number],
  ctx: ClusterContext,
): Promise<ClusterOutcome> {
  if (ctx.rateLedger.currentCount(ctx.installationId) >= ctx.config.maxPrsPerEvent) {
    return { kind: 'rate-limited', upgradeCta: DEFAULT_UPGRADE_URL };
  }

  const sourceContent = await ctx.github.getFileContent(
    ctx.owner,
    ctx.repo,
    cluster.sourceFilePath,
    ctx.headSha,
  );
  // Cannot patch a file we cannot read — skip silently
  if (sourceContent === null) return { kind: 'skipped' };

  const language = inferCascadeLanguage(cluster.sourceFilePath);
  const outcome = await ctx.cascade.requestFix(cluster, sourceContent, language);

  if (outcome.status === 'rate_limited') {
    return { kind: 'rate-limited', upgradeCta: outcome.upgradeCta ?? DEFAULT_UPGRADE_URL };
  }
  // No fix available for this cluster — skip
  if (outcome.status !== 'ok' || !outcome.diff || !outcome.fixId) return { kind: 'skipped' };

  const patchedContent = applyDiffToContent(sourceContent, outcome.diff);
  const branchName = buildBranchName(cluster, ctx.headSha);
  const prBody = buildPrBody({
    cluster,
    tierUsed: outcome.tierUsed,
    fixId: outcome.fixId,
    diff: outcome.diff,
    originalLines: extractLinesFromContent(sourceContent, cluster.startLine, cluster.endLine),
    patchedLines: extractLinesFromContent(patchedContent, cluster.startLine, cluster.endLine),
    triggeredBy: 'github',
  });

  try {
    // Create branch, commit the patch, open the draft PR
    await ctx.github.createBranch(ctx.owner, ctx.repo, branchName, ctx.headSha);
    await ctx.github.commitFile(
      ctx.owner,
      ctx.repo,
      cluster.sourceFilePath,
      patchedContent,
      `fix(a11y): ${cluster.ruleId} in ${cluster.sourceFilePath} (reverter patch)`,
      branchName,
    );
    const pr = await ctx.github.openDraftPr(
      ctx.owner,
      ctx.repo,
      buildPrTitle(cluster),
      prBody,
      branchName,
      ctx.baseBranch,
    );
    ctx.rateLedger.increment(ctx.installationId);
    return { kind: 'opened', pr };
  } catch {
    // If PR opening fails, don't count it
    return { kind: 'skipped' };
  }
}

/**
 * Handle a `check_run.completed` webhook event from the ariada-diff GitHub App.
 *
 * @param event       - The parsed webhook payload.
 * @param findings    - Findings extracted from the check-run output by the caller.
 *                      The caller is responsible for parsing the check-run summary.
 * @param installationToken - GitHub installation token for this installation.
 * @param prNumber    - The PR number that triggered the check run (used for rate-limit comments).
 * @param config      - Handler configuration.
 * @param rateLedger  - Rate ledger tracking daily fix-PR count per installation.
 */
export async function handleCheckRunCompleted(
  event: CheckRunCompletedEvent,
  findings: LocatedFinding[],
  installationToken: string,
  prNumber: number | undefined,
  config: ReverterGitHubConfig,
  rateLedger: RateLedger,
): Promise<HandleCheckRunResult> {
  // Only act on the ariada-diff app's check runs that failed
  if (event.check_run.app.slug !== ARIADA_DIFF_APP_SLUG) {
    return { openedCount: 0, opened: [], rateLimitedCount: 0, rateLimitCommentPosted: false };
  }
  if (event.check_run.conclusion !== 'failure') {
    return { openedCount: 0, opened: [], rateLimitedCount: 0, rateLimitCommentPosted: false };
  }

  const installationId = String(event.installation?.id ?? 'unknown');
  const owner = event.repository.owner.login;
  const repo = event.repository.name;
  const headSha = event.check_run.head_sha;
  const baseBranch = event.repository.default_branch;

  const clusters = buildFindingClusters(findings);
  const toProcess = clusters.slice(0, config.maxPrsPerEvent);
  const remaining = clusters.length - toProcess.length;

  const github = new GitHubClient(installationToken, config.githubApiBaseUrl);
  const cascade = new CascadeClient({
    baseUrl: config.cascadeBaseUrl,
    bearerToken: installationToken,
    maxTier: config.maxTier,
  });

  const ctx: ClusterContext = {
    github,
    cascade,
    rateLedger,
    config,
    installationId,
    owner,
    repo,
    headSha,
    baseBranch,
  };

  const opened: OpenedFixPr[] = [];
  let rateLimitedCount = remaining;
  let rateLimitCommentPosted = false;

  for (const cluster of toProcess) {
    const outcome = await openFixPrForCluster(cluster, ctx);

    if (outcome.kind === 'opened') {
      opened.push(outcome.pr);
      continue;
    }
    if (outcome.kind !== 'rate-limited') continue;

    rateLimitedCount++;
    // Whichever cluster hits the ceiling first says so; the rest stay quiet,
    // because one comment per event is the whole point of the flag.
    if (!rateLimitCommentPosted && prNumber !== undefined) {
      await github.postIssueComment(
        owner,
        repo,
        prNumber,
        buildRateLimitComment(outcome.upgradeCta),
      );
      rateLimitCommentPosted = true;
    }
  }

  return {
    openedCount: opened.length,
    opened,
    rateLimitedCount,
    rateLimitCommentPosted,
  };
}

/**
 * Naively apply a unified diff to a string.
 * For the adapter's purposes, if the cascade returns a `patched_content` field
 * that is preferred. When only a diff is available, this function applies it
 * line-by-line. In production the closed backend returns full patched content.
 *
 * This implementation is intentionally minimal — the cascade endpoint always
 * returns `patched_content` for `status: 'ok'`.  This function exists as a
 * fallback and for tests that exercise the diff path.
 */
export function applyDiffToContent(original: string, diff: string): string {
  const src = original.split('\n');
  const out: string[] = [];
  let srcIdx = 0; // 0-based cursor into src

  for (const hunk of parseHunks(diff)) srcIdx = applyHunk(hunk, src, srcIdx, out);

  // Copy any remaining source after the last hunk.
  while (srcIdx < src.length) out.push(src[srcIdx++] ?? '');
  return out.join('\n');
}

/** One hunk: the 0-based source line it starts at, and the lines it declares. */
interface Hunk {
  oldStart: number;
  body: string[];
}

/**
 * The hunks a unified diff declares, in order.
 *
 * Anything before the first header is a file header and belongs to no hunk, so
 * it is dropped rather than applied.
 */
function parseHunks(diff: string): Hunk[] {
  const hunks: Hunk[] = [];
  let current: Hunk | undefined;

  for (const line of diff.split('\n')) {
    const header = line.match(/^@@ -(\d+)(?:,\d+)? \+\d+(?:,\d+)? @@/);
    if (header) {
      current = { oldStart: parseInt(header[1] ?? '1', 10) - 1, body: [] };
      hunks.push(current);
      continue;
    }
    if (current) current.body.push(line);
  }
  return hunks;
}

/**
 * Write one hunk into `out`, and report where it left the source cursor.
 *
 * A line whose first character names none of the four things a hunk may say
 * ends the hunk. That keeps a truncated or malformed tail from being emitted as
 * though it were content.
 */
function applyHunk(hunk: Hunk, src: string[], startIdx: number, out: string[]): number {
  let srcIdx = startIdx;

  // Copy untouched source lines up to the hunk start.
  while (srcIdx < hunk.oldStart && srcIdx < src.length) out.push(src[srcIdx++] ?? '');

  for (const line of hunk.body) {
    const tag = line[0];
    if (tag === '\\') continue; // "\ No newline at end of file"
    if (tag === ' ') { out.push(line.slice(1)); srcIdx++; }
    else if (tag === '-') { srcIdx++; }          // removed: skip in source
    else if (tag === '+') { out.push(line.slice(1)); } // added: emit only
    else break; // malformed / trailing — stop this hunk
  }
  return srcIdx;
}

/** Extract lines startLine..endLine (1-based, inclusive) from content. */
function extractLinesFromContent(content: string, startLine: number, endLine: number): string {
  const lines = content.split('\n');
  return lines.slice(startLine - 1, endLine).join('\n');
}
