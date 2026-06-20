// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

/**
 * Leaf-adapter seam contracts for the RLM (Recursive Language Model) evaluator.
 *
 * The recursive evaluator's `leaf` option accepts any {@link SemanticEvaluator}.
 * These two interfaces document the two concrete implementations that the host
 * is expected to supply — they are structural specifications, not wired
 * implementations. No network code, no model SDK, and no API key lives in this
 * package. The host supplies the model.
 *
 * ## Why two adapters?
 *
 * - **Internal/self-hosted use:** the `HostDispatchedLeaf` routes evaluation
 *   through the host's own dispatch mechanism — zero direct model-endpoint cost
 *   to the package, governed entirely by the host's infrastructure.
 * - **Client runtime:** the `ManagedApiLeaf` routes to a managed LLM endpoint
 *   whose key and configuration the *host application* supplies at construction
 *   time. The engine never touches the key.
 *
 * Both implement {@link SemanticEvaluator} and are therefore drop-in values for
 * the `leaf` argument of
 * {@link createRecursiveEvaluator}.
 *
 * @example
 * ```ts
 * // Internal/self-hosted use — host-supplied evaluator (no API key in this package):
 * const leaf: HostDispatchedLeaf = {
 *   kind: 'host-dispatched',
 *   evaluate: async (req) => {
 *     // Route through the host's dispatch mechanism.
 *     // Return the hits the evaluator reports.
 *     return hostDispatch(req);
 *   },
 * };
 *
 * // Client runtime — managed API (key supplied by host):
 * const leaf: ManagedApiLeaf = {
 *   kind: 'managed-api',
 *   evaluate: async (req) => {
 *     // Call the host-managed endpoint.  No key in this package.
 *     return callManagedEndpoint(hostApiKey, req);
 *   },
 * };
 *
 * const evaluator = createRecursiveEvaluator({ leaf });
 * ```
 */

import type { SemanticEvaluator, SemanticHit, SemanticRequest } from './types.js';

// Re-export for convenience so host code can import adapters from one place.
export type { SemanticEvaluator, SemanticHit, SemanticRequest };

// ---------------------------------------------------------------------------
// HostDispatchedLeaf — internal/self-hosted path (host's own dispatch mechanism)
// ---------------------------------------------------------------------------

/**
 * Leaf adapter for the internal/self-hosted path.
 *
 * The host implements `evaluate` by routing through **the host's dispatch
 * mechanism** — no model endpoint, SDK, or API key is present in this package.
 * The engine supplies the snippet and the rule prompt; the host-supplied
 * evaluator returns a list of {@link SemanticHit} objects.
 *
 * ### Responsibilities of the host implementation
 * - Select the appropriate model tier for the evaluation task.
 * - Format `req.rule.prompt + req.content` into an evaluator request that asks
 *   for JSON output of the shape `Array<{ matchedText: string; line: number;
 *   reason?: string }>`.
 * - Parse the evaluator's response and map it to `SemanticHit[]`.
 * - Surface errors as an empty array (never throw from `evaluate`); record
 *   failures in observability outside the engine.
 *
 * ### Constraints (enforced by the package purity rule)
 * - DO NOT import any LLM SDK inside this adapter's implementing module in
 *   the *package itself*. Implementations live in the host application.
 * - DO NOT store or forward any API key through this interface.
 * - The package has zero runtime dependencies beyond Node built-ins.
 *
 * @see {@link ManagedApiLeaf} for the client-runtime counterpart.
 */
export interface HostDispatchedLeaf extends SemanticEvaluator {
  /**
   * Discriminant tag — lets host code distinguish the two adapter kinds at
   * runtime without resorting to `instanceof` checks.
   */
  readonly kind: 'host-dispatched';

  /**
   * Evaluate a single snippet (`req.content`) against a prompt rule
   * (`req.rule`) and return the spans that violate it.
   *
   * The implementation routes through the host's dispatch mechanism; the engine
   * calls this method for each snippet that passes the prefilter (if any).
   *
   * @param req — snippet text + rule metadata (prompt, id, category, action).
   * @returns Array of matching spans (empty array if no violations found or on
   *   any internal error — the engine treats an empty result as "clean").
   */
  evaluate(req: SemanticRequest): Promise<SemanticHit[]>;
}

// ---------------------------------------------------------------------------
// ManagedApiLeaf — client-runtime path (host supplies the model endpoint)
// ---------------------------------------------------------------------------

/**
 * Leaf adapter for the client-runtime path.
 *
 * The host implements `evaluate` by calling a **managed LLM endpoint** whose
 * connection details (endpoint URL, API key, model name, retry policy) the
 * host supplies at construction time. The engine never reads or stores any
 * credential — the adapter is a pure interface contract.
 *
 * ### Responsibilities of the host implementation
 * - Hold the API key and endpoint configuration in a closure / constructor
 *   argument that is never accessible to the engine.
 * - Translate `req` into a chat-completion or text-generation request in
 *   whatever format the managed endpoint expects.
 * - Parse the response into `SemanticHit[]`.
 * - Apply rate-limiting, retry, and quota logic outside the engine.
 * - Return an empty array (never throw) when the endpoint is unavailable or
 *   returns an unexpected response; the engine records the un-evaluated
 *   remainder so a partial pass is never silently clean.
 *
 * ### Constraints (enforced by the package purity rule)
 * - DO NOT import any LLM SDK (`@anthropic-ai/sdk`, `openai`, etc.) from
 *   inside this interface's implementing module in the *package itself*.
 *   Implementations live in the host application, not in this package.
 * - The package has zero runtime dependencies beyond Node built-ins.
 *
 * @see {@link HostDispatchedLeaf} for the host-dispatched counterpart.
 */
export interface ManagedApiLeaf extends SemanticEvaluator {
  /**
   * Discriminant tag — lets host code distinguish the two adapter kinds at
   * runtime without resorting to `instanceof` checks.
   */
  readonly kind: 'managed-api';

  /**
   * Evaluate a single snippet (`req.content`) against a prompt rule
   * (`req.rule`) by calling a managed LLM endpoint.
   *
   * @param req — snippet text + rule metadata (prompt, id, category, action).
   * @returns Array of matching spans (empty array if clean or on error).
   */
  evaluate(req: SemanticRequest): Promise<SemanticHit[]>;
}

// ---------------------------------------------------------------------------
// Type-narrowing helpers
// ---------------------------------------------------------------------------

/**
 * Returns `true` when `leaf` is a {@link HostDispatchedLeaf}.
 * Useful in host code that receives a `SemanticEvaluator` and needs to branch
 * on the concrete adapter kind.
 */
export function isHostDispatchedLeaf(
  leaf: SemanticEvaluator,
): leaf is HostDispatchedLeaf {
  return (leaf as Partial<HostDispatchedLeaf>).kind === 'host-dispatched';
}

/**
 * Returns `true` when `leaf` is a {@link ManagedApiLeaf}.
 */
export function isManagedApiLeaf(leaf: SemanticEvaluator): leaf is ManagedApiLeaf {
  return (leaf as Partial<ManagedApiLeaf>).kind === 'managed-api';
}
