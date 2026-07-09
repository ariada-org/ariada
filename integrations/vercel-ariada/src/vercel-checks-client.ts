// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import type { VercelCheckPayload } from './handler.js';

/**
 * Minimal fetch-shaped function signature so callers can inject a stub or a
 * real `fetch` without this module depending on a specific runtime global.
 */
export type FetchLike = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
  },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

const VERCEL_API_BASE = 'https://api.vercel.com';

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Creates a Vercel deployment check in the `running` state via the Vercel
 * Checks API (`POST /v1/deployments/{deploymentId}/checks`). Requires a
 * team-scoped Vercel API token with `checks:write` — see the integration
 * manifest `permissions` field.
 */
export async function createVercelCheck(
  deploymentId: string,
  token: string,
  fetchImpl: FetchLike,
): Promise<{ id: string }> {
  const response = await fetchImpl(`${VERCEL_API_BASE}/v1/deployments/${deploymentId}/checks`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      name: 'Ariada accessibility check',
      blocking: true,
      status: 'running',
    }),
  });

  if (!response.ok) {
    throw new Error(`Vercel Checks API create failed (${response.status})`);
  }

  const body = (await response.json()) as { id: string };
  return { id: body.id };
}

/**
 * Updates a previously-created check with its final conclusion via
 * `PATCH /v1/deployments/{deploymentId}/checks/{checkId}`.
 */
export async function updateVercelCheck(
  deploymentId: string,
  checkId: string,
  payload: VercelCheckPayload,
  token: string,
  fetchImpl: FetchLike,
): Promise<void> {
  const response = await fetchImpl(
    `${VERCEL_API_BASE}/v1/deployments/${deploymentId}/checks/${checkId}`,
    {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({
        name: payload.name,
        status: payload.status,
        conclusion: payload.conclusion,
        output: payload.output,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Vercel Checks API update failed (${response.status})`);
  }
}
