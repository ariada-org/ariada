// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import {
  buildCheckPayload,
  buildScanRequest,
  type ScanSummary,
  type VercelCheckPayload,
  type VercelDeploymentReadyEvent,
} from './handler.js';
import { verifyVercelSignature } from './signature.js';
import { createVercelCheck, updateVercelCheck, type FetchLike } from './vercel-checks-client.js';

/**
 * Thrown when the incoming webhook's `x-vercel-signature` header does not
 * verify against the configured integration secret. The caller must treat
 * this as a 401/403 at the HTTP boundary and must not run the scan.
 */
export class WebhookAuthError extends Error {
  /** Builds the error with a fixed, non-sensitive message (never echoes the bad signature). */
  constructor() {
    super('Vercel webhook signature verification failed');
    this.name = 'WebhookAuthError';
  }
}

/** Input for {@link runVercelCheckIntegration}. */
export interface RunVercelCheckIntegrationInput {
  /** Raw (unparsed) request body, exactly as received — required for HMAC verification. */
  rawBody: string;
  /** The `x-vercel-signature` request header. */
  signatureHeader: string | undefined;
  /** The integration's webhook signing secret (Vercel Integration client secret). */
  webhookSecret: string;
  /** Vercel API token with `checks:write` scope for the installing team. */
  vercelToken: string;
  /** Runs the hosted Ariada scan surface; injected so this module has no direct network dependency. */
  runHostedScan: (
    request: ReturnType<typeof buildScanRequest>,
  ) => Promise<ScanSummary>;
  /** Injectable fetch implementation — never a real network call in tests. */
  fetchImpl: FetchLike;
}

/** Result of a completed {@link runVercelCheckIntegration} run. */
export interface RunVercelCheckIntegrationResult {
  checkId: string;
  payload: VercelCheckPayload;
}

/**
 * The full deployment-ready-to-check-payload path: verifies the webhook
 * signature, ignores non-`deployment.ready` events, runs the hosted scan,
 * and creates + updates the Vercel deployment check with the result.
 *
 * Returns `null` when the event type is not `deployment.ready` (nothing to
 * do — the Vercel Integration platform delivers other event types too, and
 * this integration only subscribes to `deployment.ready` per its manifest).
 */
export async function runVercelCheckIntegration(
  input: RunVercelCheckIntegrationInput,
): Promise<RunVercelCheckIntegrationResult | null> {
  const { rawBody, signatureHeader, webhookSecret, vercelToken, runHostedScan, fetchImpl } = input;

  if (!verifyVercelSignature(rawBody, signatureHeader, webhookSecret)) {
    throw new WebhookAuthError();
  }

  const event = JSON.parse(rawBody) as VercelDeploymentReadyEvent & { type: string };
  if (event.type !== 'deployment.ready') {
    return null;
  }

  const scanRequest = buildScanRequest(event);
  const { id: checkId } = await createVercelCheck(event.deployment.id, vercelToken, fetchImpl);

  const summary = await runHostedScan(scanRequest);
  const payload = buildCheckPayload(event, summary, scanRequest.failOnSeverity);
  await updateVercelCheck(event.deployment.id, checkId, payload, vercelToken, fetchImpl);

  return { checkId, payload };
}
