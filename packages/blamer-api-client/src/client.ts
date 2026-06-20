// SPDX-License-Identifier: EUPL-1.2
// Copyright Agonist Development AB — see NOTICE
import type { AIAgentId, AttributionInput, AttributionPosterior } from '@ariada-org/ai-authorship';
import type {
  BlamedApiError,
  BlamedClientOptions,
  BlamedReport,
  BlamedResult,
  QuotaExceededPayload,
} from './types.js';

const DEFAULT_BASE_URL = process.env['BLAMER_API_URL'] ?? 'http://localhost:3099';
const DEFAULT_CLIENT_VERSION = '0.1.0';

/**
 * Low-level HTTP client for the Blamer attribution API.
 * Handles auth headers, error parsing, and Result wrapping.
 */
interface ResolvedOptions {
  baseUrl: string;
  bearerToken: string;
  githubInstallationId: string;
  githubRepo: string;
  clientVersion: string;
}

export class BlamedApiClient {
  readonly #options: ResolvedOptions;

  constructor(options: BlamedClientOptions) {
    this.#options = {
      baseUrl: options.baseUrl,
      bearerToken: options.bearerToken,
      githubInstallationId: options.githubInstallationId ?? '',
      githubRepo: options.githubRepo ?? '',
      clientVersion: options.clientVersion ?? DEFAULT_CLIENT_VERSION,
    };
  }

  /** Batch-attribute a list of diff hunks via the hosted Blamer API. */
  async attributeBatch(
    inputs: AttributionInput[],
  ): Promise<BlamedResult<AttributionPosterior[]>> {
    const url = `${this.#options.baseUrl}/v1/attribute`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.#options.bearerToken}`,
      'X-Client-Version': this.#options.clientVersion,
    };
    if (this.#options.githubInstallationId) {
      headers['X-GitHub-Installation-Id'] = this.#options.githubInstallationId;
    }
    if (this.#options.githubRepo) {
      headers['X-GitHub-Repo'] = this.#options.githubRepo;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          inputs,
          client_version: this.#options.clientVersion,
          options: { explain: true },
        }),
      });
    } catch (cause) {
      const error: BlamedApiError = {
        kind: 'network_error',
        message:
          cause instanceof Error
            ? cause.message
            : 'Network error contacting the Blamer API',
        resetAt: undefined,
        upgradeUrl: undefined,
        statusCode: undefined,
      };
      return { ok: false, error };
    }

    if (response.status === 401 || response.status === 403) {
      const error: BlamedApiError = {
        kind: 'auth_failed',
        message: 'Authentication failed. Please reinstall the GitHub App or contact your installation support.',
        resetAt: undefined,
        upgradeUrl: undefined,
        statusCode: response.status,
      };
      return { ok: false, error };
    }

    if (response.status === 402) {
      let payload: QuotaExceededPayload | undefined;
      try {
        payload = (await response.json()) as QuotaExceededPayload;
      } catch {
        // body not parseable — continue without payload fields
      }
      const error: BlamedApiError = {
        kind: 'quota_exceeded',
        message: 'free-tier quota (100 commits/month) exhausted',
        resetAt: payload?.reset_at ?? undefined,
        upgradeUrl: payload?.upgrade_url ?? undefined,
        statusCode: 402,
      };
      return { ok: false, error };
    }

    if (!response.ok) {
      const error: BlamedApiError = {
        kind: 'server_error',
        message: `Blamer API error: HTTP ${response.status}`,
        resetAt: undefined,
        upgradeUrl: undefined,
        statusCode: response.status,
      };
      return { ok: false, error };
    }

    let body: { results: AttributionPosterior[]; request_id?: string };
    try {
      body = (await response.json()) as typeof body;
    } catch {
      return {
        ok: false,
        error: {
          kind: 'server_error',
          message: 'Blamer API returned non-JSON response',
          resetAt: undefined,
          upgradeUrl: undefined,
          statusCode: undefined,
        },
      };
    }

    return { ok: true, value: body.results };
  }

  /** Retrieve a full BlamedReport by subject (PR or deployment). */
  async getReport(
    subjectId: string,
    subjectType: BlamedReport['subjectType'],
    repo: string,
    inputs: AttributionInput[],
    options?: { thresholdFraction?: number },
  ): Promise<BlamedResult<BlamedReport>> {
    const batchResult = await this.attributeBatch(inputs);
    if (!batchResult.ok) {
      return batchResult;
    }

    const posteriors = batchResult.value;
    const totalLines = posteriors.length;

    // Build the diffMix by weighting each line's contribution by the top-probability agent.
    // For each hunk posterior, the attributed agent is the one with the highest probability
    // in the sorted posterior array. This produces a per-line attribution count.
    const agentLineCounts = new Map<string, number>();
    for (const posteriorItem of posteriors) {
      // posterior is sorted descending by probability per the invariant
      const topEntry = posteriorItem.posterior[0];
      if (topEntry) {
        const current = agentLineCounts.get(topEntry.agent) ?? 0;
        agentLineCounts.set(topEntry.agent, current + 1);
      }
    }

    const diffMix = Array.from(agentLineCounts.entries()).map(([agent, lines]) => ({
      agent: agent as AIAgentId,
      linesAttributed: lines,
      fraction: totalLines > 0 ? lines / totalLines : 0,
    }));

    // Determine if the AI-authored fraction exceeds the threshold.
    // AI fraction = fraction of lines where a non-human agent had the highest probability.
    const aiAgents = diffMix.filter((m) => m.agent !== 'human');
    const totalAiFraction = aiAgents.reduce((sum, m) => sum + m.fraction, 0);
    const threshold = options?.thresholdFraction ?? 0.6;
    const thresholdViolated = totalAiFraction > threshold;

    const report: BlamedReport = {
      subjectId,
      subjectType,
      repo,
      generatedAt: new Date().toISOString(),
      diffMix,
      violations: [],
      thresholdViolated,
      triggeringFraction: thresholdViolated ? totalAiFraction : undefined,
      haesInclusionProof: undefined,
      apiRequestId: `req_${Date.now()}`,
    };

    return { ok: true, value: report };
  }
}

/** Convenience factory using environment variable convention. */
export function createBlamedClient(override?: Partial<BlamedClientOptions>): BlamedApiClient {
  return new BlamedApiClient({
    baseUrl: override?.baseUrl ?? DEFAULT_BASE_URL,
    bearerToken: override?.bearerToken ?? process.env['BLAMER_API_TOKEN'] ?? '',
    githubInstallationId: override?.githubInstallationId ?? process.env['BLAMER_GITHUB_INSTALLATION_ID'],
    githubRepo: override?.githubRepo ?? process.env['BLAMER_GITHUB_REPO'],
    clientVersion: override?.clientVersion ?? DEFAULT_CLIENT_VERSION,
  });
}
