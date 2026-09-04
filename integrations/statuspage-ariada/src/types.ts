// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

// Read back from the compiled package left in this directory when its source
// went missing. The output was plain and unminified with its declarations
// beside it, so the types are the ones the original had; the reasoning is
// written fresh, because that is the part a compiler does not keep.

export const ARIADA_CLI_SCHEMA = 'https://ariada.org/schemas/cli-scan.v1.json';

/** What a scan amounted to, before it is translated into anyone else's words. */
export type AriadaStatus = 'pass' | 'partial' | 'fail';

/** What a status board shows. Three states, because a board with more is not read. */
export type StatusComponentState = 'operational' | 'degraded_performance' | 'major_outage';

/** Findings per severity, as the scanner counted them. */
export interface AriadaImpactCounts {
  readonly critical: number;
  readonly serious: number;
  readonly moderate: number;
  readonly minor: number;
}

/** The counts and their total, which must agree — see the parser. */
export interface AriadaSummary {
  readonly total: number;
  readonly byImpact: AriadaImpactCounts;
}

/** A scanner result after it has been checked, so nothing downstream re-checks it. */
export interface AriadaCliResult {
  readonly $schema: typeof ARIADA_CLI_SCHEMA;
  readonly url: string;
  readonly scanId?: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMs: number;
  readonly summary: AriadaSummary;
  readonly report: Readonly<Record<string, unknown>>;
  readonly exitCode: 0 | 1;
}
