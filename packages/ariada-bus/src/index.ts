// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/** Mode for a typed reconciler run. */
export type ReconcileMode = 'check' | 'fix';

/** A target derived from one source fact. */
export interface ReconcileTarget<TSource> {
  id: string;
  path: string;
  current: string;
  render(source: TSource): string;
}

/** A file-backed target; current bytes are read from path during reconciliation. */
export type FileReconcileTarget<TSource> = Omit<ReconcileTarget<TSource>, 'current'>;

/** One target whose current bytes differ from its rendered bytes. */
export interface ReconcileDrift {
  id: string;
  path: string;
  expected: string;
  actual: string;
}

/** A write the caller may apply in fix mode. */
export interface ReconcileWrite {
  path: string;
  content: string;
}

/** Result of one source-to-target reconcile pass. */
export interface ReconcileResult {
  ok: boolean;
  mode: ReconcileMode;
  drift: ReconcileDrift[];
  writes: ReconcileWrite[];
}

/** Inputs for comparing a current local build against rendered live bytes. */
export interface LiveDeployComparison {
  surfaceId: string;
  currentBuild: string;
  liveRendered: string;
  currentBuildRef: string;
  liveRef: string;
}

/** Second bus fact class: a live rendered surface differs from current build bytes. */
export interface LiveDeployDriftFact {
  kind: 'live-deploy-drift';
  surfaceId: string;
  currentBuildRef: string;
  liveRef: string;
  currentBuildHash: string;
  liveRenderedHash: string;
}

/** Smallest generic check/fix contract: one typed source renders many targets. */
export function reconcileTargets<TSource>(
  source: TSource,
  targets: ReconcileTarget<TSource>[],
  options: { mode: ReconcileMode },
): ReconcileResult {
  const drift: ReconcileDrift[] = [];
  const writes: ReconcileWrite[] = [];

  for (const target of targets) {
    const expected = target.render(source);
    if (target.current === expected) continue;
    drift.push({
      id: target.id,
      path: target.path,
      expected,
      actual: target.current,
    });
    if (options.mode === 'fix') {
      writes.push({ path: target.path, content: expected });
    }
  }

  return {
    ok: options.mode === 'fix' || drift.length === 0,
    mode: options.mode,
    drift,
    writes,
  };
}

/** Reconcile file-backed targets by reading their current bytes first. */
export function reconcileFileTargets<TSource>(
  source: TSource,
  targets: FileReconcileTarget<TSource>[],
  options: { mode: ReconcileMode },
): ReconcileResult {
  return reconcileTargets(
    source,
    targets.map((target) => ({
      ...target,
      current: readFileSync(target.path, 'utf8'),
    })),
    options,
  );
}

/** Apply generated fix-mode writes to local files; returns the number of files written. */
export function applyReconcileWrites(writes: ReconcileWrite[]): number {
  for (const write of writes) {
    mkdirSync(dirname(write.path), { recursive: true });
    writeFileSync(write.path, write.content, 'utf8');
  }
  return writes.length;
}

/** Return a fact only when live rendered bytes drift from current build bytes. */
export function compareLiveDeploy(input: LiveDeployComparison): LiveDeployDriftFact | undefined {
  const currentBuildHash = sha256(input.currentBuild);
  const liveRenderedHash = sha256(input.liveRendered);
  if (currentBuildHash === liveRenderedHash) return undefined;
  return {
    kind: 'live-deploy-drift',
    surfaceId: input.surfaceId,
    currentBuildRef: input.currentBuildRef,
    liveRef: input.liveRef,
    currentBuildHash,
    liveRenderedHash,
  };
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
