// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Drill-down projections over the two fact classes the Control Room summarises
// only as counts: the Clamper→Blamer→Reverter self-audit loop facts and the
// BUILT != PUBLISHED != live drift facts. Both fact classes travel through the
// snapshot as `unknown[]` (they are read from JSONL files written by other
// scripts, not typed at this boundary) so every field read here is defensive:
// a malformed or partial record degrades field-by-field to `null`, never
// throws and never fabricates a value.

import { deriveControlRoomView, type ControlRoomSnapshot, type LampStatus } from './index.js';

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

/** Readable projection of one persisted self-audit loop fact (see RecordedLoopFact in @ariada-org/loop-runner). */
export interface LoopFactSummary {
  ruleId: string | null;
  severity: string | null;
  selector: string | null;
  commitSha: string | null;
  authorName: string | null;
  confidence: number | null;
  prTitle: string | null;
  branchName: string | null;
}

/** Detail view for the self-audit loop drill-down page. */
export interface LoopDetailView {
  status: LampStatus;
  factCount: number;
  liveDeployDriftFacts: number | null;
  recentFacts: LoopFactSummary[];
}

function summariseLoopFact(raw: unknown): LoopFactSummary {
  const rec = asRecord(raw);
  const finding = asRecord(rec?.['finding']);
  const attribution = asRecord(rec?.['attribution']);
  const author = asRecord(attribution?.['author']);
  const remediation = asRecord(rec?.['remediation']);
  return {
    ruleId: asString(finding?.['ruleId']),
    severity: asString(finding?.['severity']),
    selector: asString(finding?.['selector']),
    commitSha: asString(attribution?.['commitSha']),
    authorName: asString(author?.['name']),
    confidence: asNumber(attribution?.['confidence']),
    prTitle: asString(remediation?.['prTitle']),
    branchName: asString(remediation?.['branchName']),
  };
}

/**
 * Derive the self-audit loop drill-down view. Reuses `deriveControlRoomView`
 * for the honesty-gated status + fact count (never re-derives that logic),
 * then projects the already-sliced `recentFacts` into readable summaries.
 */
export function deriveLoopDetail(snapshot: ControlRoomSnapshot | null | undefined): LoopDetailView {
  const view = deriveControlRoomView(snapshot);
  return {
    status: view.loop.status,
    factCount: view.loop.factCount,
    liveDeployDriftFacts: view.loop.liveDeployDriftFacts,
    recentFacts: view.loop.recentFacts.map(summariseLoopFact),
  };
}

/** Readable projection of one persisted live-deploy-drift fact (see LiveDeployDriftFact in @ariada-org/bus). */
export interface DriftFactSummary {
  surfaceId: string | null;
  currentBuildRef: string | null;
  liveRef: string | null;
  currentBuildHash: string | null;
  liveRenderedHash: string | null;
}

/** Detail view for the live-deploy-drift drill-down page. */
export interface DriftDetailView {
  status: LampStatus;
  driftFactCount: number;
  facts: DriftFactSummary[];
}

function summariseDriftFact(raw: unknown): DriftFactSummary {
  const rec = asRecord(raw);
  return {
    surfaceId: asString(rec?.['surfaceId']),
    currentBuildRef: asString(rec?.['currentBuildRef']),
    liveRef: asString(rec?.['liveRef']),
    currentBuildHash: asString(rec?.['currentBuildHash']),
    liveRenderedHash: asString(rec?.['liveRenderedHash']),
  };
}

/**
 * Derive the live-deploy-drift drill-down view directly from the raw
 * `bus.liveDeployDrift` array (the summary view does not carry it — only the
 * count). Honesty gate mirrors the loop tile: no count signal at all reads
 * 'unknown', a present zero reads 'ok', and any drift fact reads 'fail'.
 */
export function deriveDriftDetail(snapshot: ControlRoomSnapshot | null | undefined): DriftDetailView {
  const s: ControlRoomSnapshot = snapshot ?? {};
  const rawFacts = Array.isArray(s.bus?.liveDeployDrift) ? s.bus.liveDeployDrift : [];
  const facts = rawFacts.map(summariseDriftFact);
  const countField = s.bus?.liveDeployDriftFacts;
  if (countField === undefined) {
    return { status: 'unknown', driftFactCount: rawFacts.length, facts };
  }
  const driftFactCount = Number(countField);
  return { status: driftFactCount > 0 ? 'fail' : 'ok', driftFactCount, facts };
}
