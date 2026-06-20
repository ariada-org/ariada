// SPDX-License-Identifier: EUPL-1.2
// Copyright Agonist Development AB — see NOTICE
//
// Types for the hosted remediation cascade endpoint.
// The closed backend service implements these contracts; this adapter treats
// the response as an opaque typed payload and forwards it to GitHub.

/** A group of findings sharing the same rule, source file, and WCAG criterion. */
export interface FindingCluster {
  /** Accessibility rule identifier, e.g. "color-contrast". */
  ruleId: string;
  /** WCAG success criterion number, e.g. "1.4.3". */
  wcagSc: string;
  /** Relative path to the source file within the repository. */
  sourceFilePath: string;
  /** The fingerprints of findings included in this cluster. */
  fingerprintHashes: string[];
  /** Start line of the contiguous block (1-based). */
  startLine: number;
  /** End line of the contiguous block (1-based). */
  endLine: number;
  /** Severity of the leading finding in the cluster. */
  severity: 'critical' | 'serious' | 'moderate' | 'minor';
}

/** Request body sent to the hosted cascade endpoint. */
export interface CascadeFixRequest {
  finding_cluster: FindingCluster;
  source_file: {
    path: string;
    content: string;
    language: 'html' | 'tsx' | 'ts' | 'jsx' | 'js' | 'css' | 'scss' | 'vue' | 'svelte' | 'astro';
  };
  options?: {
    dry_run?: boolean;
    max_tier?: 0 | 1 | 2 | 3;
    context?: Record<string, string>;
  };
}

/** Response body from the hosted cascade endpoint. */
export interface CascadeFixResponse {
  /** Stable identifier for the audit trail. */
  fix_id: string;
  status: 'ok' | 'no_fix_available' | 'needs_context' | 'rate_limited' | 'error';
  tier_used: 0 | 1 | 2 | 3;
  /** Unified diff string; null when no fix is available. */
  diff: string | null;
  /** Full patched file content; null when no fix is available. */
  patched_content: string | null;
  risk_level: 'safe' | 'needs-review';
  unresolved_todos: Array<{ marker: string; description: string }>;
  /** Present when status is "rate_limited". */
  upgrade_cta?: string;
}

/** Outcome from one cascade call, enriched with cluster context. */
export interface ClusterFixOutcome {
  cluster: FindingCluster;
  fixId: string | null;
  status: CascadeFixResponse['status'];
  tierUsed: CascadeFixResponse['tier_used'];
  diff: string | null;
  riskLevel: CascadeFixResponse['risk_level'];
  unresolvedTodos: CascadeFixResponse['unresolved_todos'];
  upgradeCta: string | undefined;
}
