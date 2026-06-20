// SPDX-License-Identifier: EUPL-1.2
// Copyright Agonist Development AB — see NOTICE
import type { AIAgentId, AttributionInput, AttributionPosterior } from '@ariada-org/ai-authorship';

/** A single accessibility violation with per-violation authorship attribution. */
export interface BlamedViolation {
  /** Violation identifier from axe-core or @ariada-org/wcag-rules-extended */
  violationId: string;
  /** WCAG 2.2 Success Criterion, e.g. "1.4.3" */
  wcagCriterion: string;
  /** Impact level matching axe-core scale */
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  /** File path and line range of the code hunk that introduced the violation */
  codeLocation: { filePath: string; startLine: number; endLine: number };
  /** Attribution posterior for the hunk at this code location */
  attribution: AttributionPosterior;
}

/** Top-level attribution report covering a pull request or deployment diff. */
export interface BlamedReport {
  /** PR number (as string) or deployment ID this report covers */
  subjectId: string;
  subjectType: 'pull_request' | 'deployment';
  /** Repository in owner/repo form */
  repo: string;
  /** ISO-8601 timestamp of report generation */
  generatedAt: string;

  /** Attribution mix across all hunks in the diff */
  diffMix: Array<{ agent: AIAgentId; linesAttributed: number; fraction: number }>;

  /** Violations with per-violation attribution; empty when no preview URL was scanned */
  violations: BlamedViolation[];

  /** Whether the configured AI-fraction threshold was violated */
  thresholdViolated: boolean;
  /** The AI-authored fraction that triggered the threshold, when violated */
  triggeringFraction: number | undefined;

  /**
   * Audit trail: HAES (Hash-Anchored Evidence Stream) Merkle inclusion proof
   * for EU AI Act Article 50 transparency export.
   * Base64-encoded JSON, verifiable via @ariada-org/haes.
   */
  haesInclusionProof: string | undefined;

  /** Request identifier from the Blamer API for debugging */
  apiRequestId: string;
}

/** Error categories returned by the Blamer attribution API. */
export type BlamedApiErrorKind =
  | 'quota_exceeded'
  | 'auth_failed'
  | 'invalid_input'
  | 'server_error'
  | 'network_error';

/** Structured error from the Blamer API client — uses undefined-inclusive optionals. */
export type BlamedApiError = {
  kind: BlamedApiErrorKind;
  message: string;
  /** ISO-8601 timestamp when the free-tier quota resets (only set for quota_exceeded) */
  resetAt: string | undefined;
  /** Upgrade URL shown to users on quota exhaustion */
  upgradeUrl: string | undefined;
  /** HTTP status code, when available */
  statusCode: number | undefined;
};

/** Discriminated union result from the Blamer client — mirrors the @ariada-org/ai-authorship Result type. */
export type BlamedResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: BlamedApiError };

/** Options passed to the Blamer API client. */
export interface BlamedClientOptions {
  /**
   * Base URL for the attribution API endpoint.
   * Set via BLAMER_API_URL environment variable; defaults to http://localhost:3099.
   * Override in tests with a local fixture server URL.
   */
  baseUrl: string;
  /**
   * Bearer token for authentication.
   * For GitHub App surfaces: the installation-scoped JWT.
   * For Vercel surfaces: the OAuth-derived per-team token.
   */
  bearerToken: string;
  /** Optional GitHub installation identifier for per-org tier resolution */
  githubInstallationId: string | undefined;
  /** Optional GitHub repo in owner/repo form */
  githubRepo: string | undefined;
  /** Client version sent in X-Client-Version header */
  clientVersion: string | undefined;
}

/** Input sent to the /v1/attribute endpoint matching the wire contract. */
export interface AttributeRequestBody {
  inputs: AttributionInput[];
  client_version: string;
  options: { explain: boolean };
}

/** Quota-exceeded payload from a 402 response. */
export interface QuotaExceededPayload {
  error: 'quota_exceeded';
  reset_at: string;
  upgrade_url: string;
}
