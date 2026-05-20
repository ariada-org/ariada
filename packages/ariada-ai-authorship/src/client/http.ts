// SPDX-License-Identifier: EUPL-1.2
//
// Hosted-mode client — sends batched `AttributionInput` records to the
// hosted inference endpoint and parses the response into `AttributionPosterior`.
//
// The OSS reference implementation keeps the wire contract narrow and
// well-documented. It does NOT bundle credentials; the caller
// supplies a bearer token. The reference implementation also intentionally
// defers retry / backoff to the caller — that policy lives in a separate
// helper so it can be re-used by both single and batch entry points.

import {
  err,
  ok,
  type AttributionError,
  type AttributionInput,
  type AttributionPosterior,
  type Result,
} from '../types.js';

/** Configuration block accepted by the hosted client constructor. */
export interface HostedClientOptions {
  /** Full URL to the hosted attribute endpoint. */
  endpoint: string;
  /** Bearer token for the `Authorization` header. */
  api_key: string;
  /** Optional fetch override (lets tests inject a mock). */
  fetch_impl?: typeof fetch;
  /** Pinned client version sent in the request body. */
  client_version: string;
}

/** Wire-format response from the hosted endpoint. */
export interface HostedAttributeResponse {
  results: AttributionPosterior[];
  classifier_version: string;
  calibration_version: string;
  request_id: string;
}

/**
 * Submit a batch of attribution inputs to the hosted endpoint. Returns
 * either the parsed posteriors or a typed error.
 */
export async function hostedAttributeBatch(
  inputs: AttributionInput[],
  options: HostedClientOptions,
  explain = true,
): Promise<Result<AttributionPosterior[], AttributionError>> {
  if (inputs.length === 0) return ok([]);
  if (inputs.length > 256) {
    return err({
      kind: 'input_invalid',
      reason: 'batch size must be <= 256 per request',
    });
  }
  const fetchImpl = options.fetch_impl ?? fetch;
  const body = JSON.stringify({
    inputs,
    client_version: options.client_version,
    options: { explain },
  });
  let response: Response;
  try {
    response = await fetchImpl(options.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.api_key}`,
        'Content-Type': 'application/json',
      },
      body,
    });
  } catch (e) {
    return err({
      kind: 'hosted_unreachable',
      underlying: e instanceof Error ? e : new Error(String(e)),
    });
  }
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get('Retry-After') ?? '60');
    return err({
      kind: 'hosted_rate_limited',
      retry_after_seconds: Number.isFinite(retryAfter) ? retryAfter : 60,
    });
  }
  if (response.status === 410) {
    return err({
      kind: 'classifier_version_mismatch',
      expected: 'server-current',
      got: options.client_version,
    });
  }
  if (!response.ok) {
    let reason = `hosted endpoint returned HTTP ${response.status}`;
    try {
      const text = await response.text();
      if (text.length > 0) reason = `${reason}: ${text.slice(0, 256)}`;
    } catch {
      // Body was unreadable — keep the status-only reason.
    }
    if (response.status >= 500) {
      return err({
        kind: 'hosted_unreachable',
        underlying: new Error(reason),
      });
    }
    return err({ kind: 'input_invalid', reason });
  }
  let payload: HostedAttributeResponse;
  try {
    payload = (await response.json()) as HostedAttributeResponse;
  } catch (e) {
    return err({
      kind: 'hosted_unreachable',
      underlying: e instanceof Error ? e : new Error(String(e)),
    });
  }
  return ok(payload.results);
}
