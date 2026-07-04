// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, relative } from 'node:path';

import { classifyOffline, locationToInput } from '@ariada-org/ai-authorship';
import {
  builtinPacks,
  evaluateContent,
  ossSurfaceProfile,
  type ContentFinding,
} from '@ariada-org/content-policy';
import {
  computeFindingFingerprint,
  type FindingWithFingerprint,
  type Severity,
} from '@ariada-org/diff-schema';
import {
  buildBranchName,
  buildFindingClusters,
  buildPrBody,
  buildPrTitle,
  type LocatedFinding,
} from '@ariada-org/reverter-adapter';

export type {
  LoopAttribution,
  LoopCommitContext,
  LoopFact,
  LoopFileVerdict,
  LoopGateRunResult,
  LoopRemediationPlan,
  LoopRunnerInput,
  LoopRunnerResult,
} from './types.js';
import type {
  LoopAttribution,
  LoopCommitContext,
  LoopFact,
  LoopGateRunResult,
  LoopRemediationPlan,
  LoopRunnerInput,
  LoopRunnerResult,
} from './types.js';

/**
 * Run the smallest self-regulating loop: Clamper fail -> Blamer attribution ->
 * Reverter draft remediation plan -> structured fact.
 */
export async function runSelfRegulatingLoop(input: LoopRunnerInput): Promise<LoopRunnerResult> {
  const gate = runContentGate(input.filePaths);
  if (!gate.hasFailure) return { gate, facts: [] };

  const facts: LoopFact[] = [];
  for (const verdict of gate.verdicts) {
    if (verdict.decision.result !== 'fail') continue;
    const sourceText = readFileSync(verdict.filePath, 'utf8');
    for (const finding of verdict.decision.findings.filter((f) => f.action === 'fail')) {
      const located = toLocatedFinding(finding, verdict.filePath);
      const attribution = attributeFinding({
        finding: located,
        sourceText,
        commit: input.commit,
      });
      const remediation = buildRemediationPlan(located, sourceText, input.commit.sha);
      if (!attribution || !remediation) continue;
      facts.push({
        kind: 'content-policy-loop-fact',
        verdict: 'fail',
        finding: located,
        attribution,
        remediation,
      });
    }
  }
  return { gate, facts };
}

function runContentGate(filePaths: string[]): LoopGateRunResult {
  const verdicts = filePaths.map((filePath) => ({
    filePath,
    decision: evaluateContent(readFileSync(filePath, 'utf8'), ossSurfaceProfile, builtinPacks),
  }));
  return {
    verdicts,
    hasFailure: verdicts.some((verdict) => verdict.decision.result === 'fail'),
  };
}

function toLocatedFinding(finding: ContentFinding, filePath: string): LocatedFinding {
  const sourceFilePath = publicPath(filePath);
  const sharedFinding = {
    ruleId: finding.ruleId,
    wcagSc: null,
    jurisdictionTags: ['content-policy'],
    severity: severityFromAction(finding.action),
    selector: `${sourceFilePath}:${finding.line}`,
  } satisfies Omit<FindingWithFingerprint, 'fingerprint'>;
  return {
    ...sharedFinding,
    fingerprint: computeFindingFingerprint(sharedFinding),
    sourceFilePath,
    startLine: finding.line,
    endLine: finding.line,
  };
}

function attributeFinding(input: {
  finding: LocatedFinding;
  sourceText: string;
  commit: LoopCommitContext;
}): LoopAttribution | undefined {
  const attributionInput = locationToInput(
    {
      file_path: input.finding.sourceFilePath ?? 'unknown',
      language: languageFromPath(input.finding.sourceFilePath ?? ''),
      line_start: input.finding.startLine ?? 1,
      line_end: input.finding.endLine ?? input.finding.startLine ?? 1,
      source_text: input.sourceText,
    },
    {
      timestamp_utc: input.commit.timestampUtc,
      git_author_email: sha256(input.commit.authorEmail),
      commit_message: input.commit.message,
      prior_commit_timestamps: [],
    },
  );
  const posterior = classifyOffline(attributionInput, () => new Date(input.commit.timestampUtc));
  if (!posterior.ok) return undefined;
  return {
    findingFingerprint: input.finding.fingerprint,
    commitSha: input.commit.sha,
    author: {
      name: input.commit.authorName,
      emailHash: sha256(input.commit.authorEmail),
    },
    posterior: posterior.value.posterior,
    confidence: posterior.value.confidence,
  };
}

function buildRemediationPlan(
  finding: LocatedFinding,
  sourceText: string,
  commitSha: string,
): LoopRemediationPlan | undefined {
  const cluster = buildFindingClusters([finding])[0];
  if (!cluster) return undefined;
  const originalLines = sliceLines(sourceText, cluster.startLine, cluster.endLine);
  const patchedLines =
    'Plan only: remove or rewrite the policy finding, then rerun the content gate.';
  return {
    branchName: buildBranchName(cluster, commitSha),
    prTitle: buildPrTitle(cluster),
    prBody: buildPrBody({
      cluster,
      tierUsed: 0,
      fixId: `loop-${finding.fingerprint.slice(0, 12)}`,
      diff: '',
      originalLines,
      patchedLines,
    }),
    sourceFilePath: cluster.sourceFilePath,
    startLine: cluster.startLine,
    endLine: cluster.endLine,
  };
}

function sliceLines(source: string, startLine: number, endLine: number): string {
  return source.split('\n').slice(Math.max(0, startLine - 1), endLine).join('\n');
}

function publicPath(path: string): string {
  const rel = relative(process.cwd(), path);
  return rel.startsWith('..') ? basename(path) : rel;
}

function languageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  if (ext === 'md') return 'md';
  if (ext === 'tsx') return 'tsx';
  if (ext === 'ts') return 'ts';
  if (ext === 'html') return 'html';
  return 'text';
}

function severityFromAction(action: ContentFinding['action']): Severity {
  return action === 'fail' ? 'serious' : action === 'warn' ? 'moderate' : 'minor';
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
