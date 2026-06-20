// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

// Content-policy types. A profile composes one or more rule-packs and evaluates
// a piece of text destined for a target surface, producing a GateDecision-shaped
// verdict (pass / warn / fail + reasons). The output contract mirrors the
// accessibility GateDecision so consumers and the dashboard read one shape.

/** Action taken when a rule matches — mirrors the a11y PolicyAction. */
export type PolicyAction = 'fail' | 'warn' | 'info';

/** Aggregate verdict — mirrors the a11y GateDecision result. */
export type GateResult = 'pass' | 'warn' | 'fail';

/**
 * One content rule, evaluated in one of two tiers:
 *
 * - **Deterministic tier:** `patterns` are case-insensitive regular-expression
 *   sources tested against each line. Fast, reproducible, free.
 * - **Semantic tier:** `prompt` is a natural-language instruction — the
 *   custom client filter authored in the dashboard (e.g. "Flag any mention of a
 *   competitor or an unreleased product name"). It is evaluated by an injected
 *   {@link SemanticEvaluator}; the engine itself never calls a model. A rule may
 *   carry both — the patterns act as a cheap pre-filter and the prompt as the
 *   contextual judge.
 *
 * The `semantic` flag is retained for back-compat; a non-empty `prompt` is the
 * real signal that a rule runs in the semantic tier.
 */
export interface ContentRule {
  id: string;
  description: string;
  action: PolicyAction;
  category: string;
  /** Regex sources (tested case-insensitive). Empty for a prompt-only rule. */
  patterns: string[];
  /** Natural-language filter instruction evaluated by the injected evaluator. */
  prompt?: string;
  /** Retained for back-compat; a non-empty `prompt` is the real semantic signal. */
  semantic?: boolean;
}

/** Which tier produced a finding. */
export type DetectionTier = 'deterministic' | 'semantic';

/** What the host hands the injected evaluator for one prompt rule. */
export interface SemanticRequest {
  /** The full text being judged (the evaluator splits lines itself if needed). */
  content: string;
  /** The prompt rule to judge against (its `prompt` is guaranteed non-empty). */
  rule: { id: string; prompt: string; category: string; action: PolicyAction };
}

/** One span the evaluator says violates the prompt. */
export interface SemanticHit {
  /** The offending text the evaluator identified. */
  matchedText: string;
  /** 1-based line where the span occurs. */
  line: number;
  /** Why it matched the prompt (surfaced in the finding). */
  reason?: string;
}

/**
 * The injected LLM seam. The engine stays a pure, zero-dependency,
 * no-network package; the host supplies the model: a host-supplied evaluator for
 * internal use, or a managed-API adapter for client runtime. The engine
 * never imports or calls a model directly (the no-metered-API constraint).
 */
export interface SemanticEvaluator {
  evaluate(req: SemanticRequest): Promise<SemanticHit[]>;
}

/** A reusable, composable set of rules (e.g. `no-secrets`, `oss-surface`). */
export interface RulePack {
  id: string;
  description: string;
  rules: ContentRule[];
}

/**
 * A profile selects which packs apply to a target surface and carries a
 * class-level allow-list of literal strings that are never flagged (e.g.
 * widely-known abbreviations). Allow-list wins over any rule match.
 */
export interface ContentProfile {
  id: string;
  surface: string;
  /** Pack ids composed in order; later packs can only add, not remove. */
  packs: string[];
  /** Literal strings exempt from all rules (case-insensitive). */
  allowlist?: string[];
}

/** One matched rule occurrence. */
export interface ContentFinding {
  ruleId: string;
  packId: string;
  action: PolicyAction;
  category: string;
  matchedText: string;
  line: number;
  /** Which tier produced this finding. */
  tier: DetectionTier;
  /** Stable content-span fingerprint (used by the reverter regression baseline). */
  fingerprint: string;
  /** For semantic findings: why the evaluator says it violates the prompt. */
  reason?: string;
}

/** A prompt rule that could not be judged because no evaluator was injected. */
export interface UnevaluatedRule {
  ruleId: string;
  prompt: string;
  reason: string;
}

/** GateDecision-shaped verdict (the reused output contract). */
export interface ContentGateDecision {
  result: GateResult;
  profileId: string;
  surface: string;
  findings: ContentFinding[];
  counts: { fail: number; warn: number; info: number; allowlisted: number };
  /**
   * Prompt rules present in the profile that ran in no tier because no
   * evaluator was injected. Non-empty means the verdict is INCOMPLETE — the
   * caller must treat a `pass` with unevaluated rules as "deterministic-clean,
   * semantic-unchecked", never as fully clean.
   */
  unevaluated?: UnevaluatedRule[];
}
