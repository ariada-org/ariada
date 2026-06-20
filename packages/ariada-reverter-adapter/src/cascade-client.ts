// SPDX-License-Identifier: EUPL-1.2
// Copyright Agonist Development AB — see NOTICE
//
// Typed HTTP client for the hosted remediation cascade endpoint.
// The base URL defaults to the REVERTER_CASCADE_URL environment variable,
// making it easy to redirect to a local mock server in tests.

import type { CascadeFixRequest, CascadeFixResponse, ClusterFixOutcome, FindingCluster } from './types/cascade.js';

/** Options for constructing the cascade client. */
export interface CascadeClientOptions {
  /** Base URL, e.g. "https://cascade.example.com" or "http://localhost:9001". */
  baseUrl: string;
  /** Bearer token for authenticating with the cascade endpoint. */
  bearerToken: string;
  /** Maximum tier allowed by the current plan. */
  maxTier: 0 | 1 | 2 | 3;
}

/**
 * Typed HTTP client for the hosted remediation cascade endpoint.
 * Uses the global `fetch` (Node 22+ built-in).
 */
export class CascadeClient {
  readonly #baseUrl: string;
  readonly #bearerToken: string;
  readonly #maxTier: 0 | 1 | 2 | 3;

  constructor(options: CascadeClientOptions) {
    this.#baseUrl = options.baseUrl.replace(/\/$/, '');
    this.#bearerToken = options.bearerToken;
    this.#maxTier = options.maxTier;
  }

  #headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.#bearerToken}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Request a fix for a single finding cluster.
   * Returns a `ClusterFixOutcome` regardless of the cascade status so callers
   * can build PR bodies and rate-limit comments uniformly.
   */
  async requestFix(
    cluster: FindingCluster,
    sourceFileContent: string,
    fileLanguage: CascadeFixRequest['source_file']['language'],
    context?: Record<string, string>,
  ): Promise<ClusterFixOutcome> {
    const body: CascadeFixRequest = {
      finding_cluster: cluster,
      source_file: {
        path: cluster.sourceFilePath,
        content: sourceFileContent,
        language: fileLanguage,
      },
      options: {
        max_tier: this.#maxTier,
        ...(context && { context }),
      },
    };

    const response = await fetch(`${this.#baseUrl}/v1/fix`, {
      method: 'POST',
      headers: this.#headers(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      // Treat non-2xx as an error outcome without throwing — callers handle gracefully
      return {
        cluster,
        fixId: null,
        status: 'error',
        tierUsed: 0,
        diff: null,
        riskLevel: 'needs-review',
        unresolvedTodos: [],
        upgradeCta: undefined,
      };
    }

    const payload = (await response.json()) as CascadeFixResponse;

    return {
      cluster,
      fixId: payload.fix_id ?? null,
      status: payload.status,
      tierUsed: payload.tier_used,
      diff: payload.diff,
      riskLevel: payload.risk_level,
      unresolvedTodos: payload.unresolved_todos,
      upgradeCta: payload.upgrade_cta,
    };
  }
}

/**
 * Infer the cascade source-language from a file path extension.
 * Unrecognised extensions fall back to 'html'.
 */
export function inferCascadeLanguage(
  filePath: string,
): CascadeFixRequest['source_file']['language'] {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, CascadeFixRequest['source_file']['language']> = {
    tsx: 'tsx',
    ts: 'ts',
    jsx: 'jsx',
    js: 'js',
    mjs: 'js',
    cjs: 'js',
    css: 'css',
    scss: 'scss',
    vue: 'vue',
    svelte: 'svelte',
    astro: 'astro',
    html: 'html',
    htm: 'html',
  };
  return map[ext] ?? 'html';
}
