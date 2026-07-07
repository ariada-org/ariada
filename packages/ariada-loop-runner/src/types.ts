// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import type { AgentProbability } from '@ariada-org/ai-authorship';
import type { ContentGateDecision } from '@ariada-org/content-policy';
import type { FindingWithFingerprint } from '@ariada-org/diff-schema';

/** Commit metadata attached to the change that triggered the content gate. */
export interface LoopCommitContext {
  sha: string;
  authorName: string;
  authorEmail: string;
  timestampUtc: string;
  message: string;
}

/** Inputs for one local loop run over one or more public-eligible files. */
export interface LoopRunnerInput {
  filePaths: string[];
  commit: LoopCommitContext;
}

/** Blamer output joined with the commit and author that introduced the finding. */
export interface LoopAttribution {
  findingFingerprint: string;
  commitSha: string;
  author: {
    name: string;
    emailHash: string;
  };
  posterior: AgentProbability[];
  confidence: number;
}

/** Reverter draft-PR plan; no patch is executed by the loop runner. */
export interface LoopRemediationPlan {
  branchName: string;
  prTitle: string;
  prBody: string;
  sourceFilePath: string;
  startLine: number;
  endLine: number;
}

/** Recorded fact other internal surfaces can consume. */
export interface LoopFact {
  kind: 'content-policy-loop-fact';
  verdict: 'fail';
  finding: FindingWithFingerprint;
  attribution: LoopAttribution;
  remediation: LoopRemediationPlan;
}

/** Persisted fact shape; versioned so readers can reject incompatible records. */
export interface RecordedLoopFact extends LoopFact {
  schemaVersion: 1;
}

/** Full loop-runner output: original gate verdict plus derived facts. */
export interface LoopRunnerResult {
  gate: LoopGateRunResult;
  facts: LoopFact[];
}

/** One file-level Clamper verdict. */
export interface LoopFileVerdict {
  filePath: string;
  decision: ContentGateDecision;
}

/** Aggregated Clamper run output local to loop-runner. */
export interface LoopGateRunResult {
  verdicts: LoopFileVerdict[];
  hasFailure: boolean;
}
