// SPDX-License-Identifier: EUPL-1.2
//
// Canonical type definitions for the AI-authorship attribution surface.
//
// The shapes mirror the package public-API specification §3.2. They are the
// single source of truth for every downstream consumer:
//
//   * CI gate that routes findings to differential thresholds based on the
//     top-agent contract.
//   * Canonical-scoring engine that joins per-finding posteriors onto
//     per-domain aggregates.
//   * Transparency-anchor surface (Article 50) that canonicalises the
//     posterior, signs it, and appends to the Hash-Anchored Evidence Stream
//     via `@ariada-org/haes`.
//   * Reproducibility audits that depend on stable classifier and calibration
//     version pins.

/**
 * Closed set of known authoring agents. The initial release ships eight
 * named agents plus a literal "human" category and an "other" bucket that
 * captures unknown or future agents. The union is intentionally narrow so a
 * CI integrator can switch on the value without parsing free-text model
 * names. The agent registry is expected to grow in future minor versions.
 */
export type AIAgentId =
  | 'copilot'
  | 'cursor'
  | 'claude-code'
  | 'windsurf'
  | 'devin'
  | 'codewhisperer'
  | 'tabnine'
  | 'human'
  | 'other'
  | 'gpt-engineer';

/**
 * Canonical, version-stable list of every agent that MUST appear in every
 * posterior array. Length is fixed at 10 — invariant §3.3-2 «all-agents-
 * present».
 *
 * Order is the canonical declaration order (NOT the sort order in a
 * posterior; posteriors are sorted by probability descending per §3.3-3).
 */
export const ALL_AGENTS: ReadonlyArray<AIAgentId> = [
  'copilot',
  'cursor',
  'claude-code',
  'windsurf',
  'devin',
  'codewhisperer',
  'tabnine',
  'gpt-engineer',
  'human',
  'other',
] as const;

/** Per-hunk input to the attribution pipeline. Shape per the public-API specification §3.2. */
export interface AttributionInput {
  /** Per-hunk source code text (post-edit). */
  code: string;
  /** Per-hunk diff context (added + removed lines, surrounding 3 lines). */
  diff_unified: string;
  /** Programming language identifier — short, lowercase, BCP-47-ish (e.g. "ts", "py", "go"). */
  language: string;
  /** Commit metadata used by the edit-history-rhythm signal. */
  commit_metadata: CommitMetadata;
  /** Optional file path — informs language-specific signal weights. */
  file_path?: string;
}

/** Commit metadata fragment. `git_author_email` MUST be SHA-256-hashed before transmission to a hosted endpoint. */
export interface CommitMetadata {
  /** ISO 8601 UTC timestamp of the commit. */
  timestamp_utc: string;
  /** SHA-256-hex hash of the git author email. Plain emails are rejected by the hosted API. */
  git_author_email: string;
  /** Commit message body. */
  commit_message: string;
  /** Up to ten prior commit timestamps (ISO 8601 UTC) on the same branch. */
  prior_commit_timestamps: string[];
}

/** Enumerated signal names — exactly four signals per the public-API specification §3.1 ensemble surface. */
export type SignalName =
  | 'lexical_entropy'
  | 'ast_shape'
  | 'naming_cadence'
  | 'edit_history_rhythm';

/**
 * Canonical declaration order of ensemble signals. Length fixed at 4 —
 * invariant §3.3-6 «signal_contributions.length === 4».
 */
export const ALL_SIGNALS: ReadonlyArray<SignalName> = [
  'lexical_entropy',
  'ast_shape',
  'naming_cadence',
  'edit_history_rhythm',
] as const;

/**
 * Per-signal contribution in log-odds space. The sum of `contributions_per_agent`
 * across all signals plus a class prior produces the final logit per agent —
 * the softmax of which is the posterior.
 *
 * `extraction_confidence` reflects whether the signal could be reliably
 * extracted from the input (e.g. AST parse may have failed on malformed input,
 * lexical entropy on an empty hunk).
 */
export interface SignalContribution {
  signal_name: SignalName;
  contributions_per_agent: Record<AIAgentId, number>;
  raw_value: number;
  extraction_confidence: number;
}

/** One entry in the posterior distribution. */
export interface AgentProbability {
  agent: AIAgentId;
  probability: number;
}

/**
 * Inference mode for a posterior. Hosted mode talks to the remote inference
 * service; offline mode uses the bundled minimal classifier and caps
 * confidence at 0.6 per the public-API specification §3.3-5.
 */
export type InferenceMode = 'hosted' | 'offline';

/**
 * The primary contract surface of the package. Every downstream consumer
 * reads this shape — CI gates, dashboards, transparency reports, the
 * anchored-evidence chain.
 *
 * Invariants enforced by `tests/orchestrator/posterior.test.ts`:
 *
 *   1. `posterior` sums to 1.0 ± 1e-6.
 *   2. `posterior.length === ALL_AGENTS.length` (every agent present, zero
 *      probabilities included rather than omitted).
 *   3. `posterior` sorted by probability descending.
 *   4. `confidence ∈ [0, 1]`.
 *   5. When `inference_mode === 'offline'`, `confidence <= 0.6`.
 *   6. `signal_contributions.length === ALL_SIGNALS.length`.
 *   7. `classifier_version` and `calibration_version` are non-empty semver
 *      strings.
 */
export interface AttributionPosterior {
  posterior: AgentProbability[];
  confidence: number;
  signal_contributions: SignalContribution[];
  classifier_version: string;
  calibration_version: string;
  inferred_at_utc: string;
  inference_mode: InferenceMode;
}

/** Typed error union returned by every public entry-point via `Result<T, AttributionError>`. */
export type AttributionError =
  | { kind: 'input_invalid'; reason: string }
  | { kind: 'language_unsupported'; language: string }
  | { kind: 'hosted_unreachable'; underlying: Error }
  | { kind: 'hosted_rate_limited'; retry_after_seconds: number }
  | { kind: 'classifier_version_mismatch'; expected: string; got: string };

/**
 * Minimal `Result<T, E>` shape used in lieu of a direct `neverthrow`
 * dependency. The convention matches the wider monorepo so consumers can
 * pattern-match on `ok` without bringing a runtime dependency into the
 * commodity outer.
 */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

/** Convenience constructor for an Ok result. */
export function ok<T, E = never>(value: T): Result<T, E> {
  return { ok: true, value };
}

/** Convenience constructor for an Err result. */
export function err<E, T = never>(error: E): Result<T, E> {
  return { ok: false, error };
}
