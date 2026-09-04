// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

// Where the board's coordinates come from: the command line first, then the
// environment. The key is only ever read from the environment — a secret passed
// as an argument ends up in a process list and in a shell history.

import { ValidationError } from './errors.js';
import {
  assertApiKey,
  assertProviderIdentifier,
  normalizeStatuspageBaseUrl,
} from './validation.js';

export const DEFAULT_STATUSPAGE_BASE_URL = 'https://api.statuspage.io';

/** The variables, read-only, so nothing here can set one. */
export type Environment = Readonly<Record<string, string | undefined>>;

/** What a caller may say instead of what the environment says. */
export interface StatuspageConfigOverrides {
  pageId?: string;
  componentId?: string;
  baseUrl?: string;
}

/** Where to send the update, and — only when applying — what to sign it with. */
export interface StatuspageConfig {
  readonly pageId: string;
  readonly componentId: string;
  readonly baseUrl: string;
  readonly apiKey?: string;
}

/**
 * The key is required only when something will actually be sent. Planning a
 * change is useful without credentials, and demanding them for it would mean
 * nobody could see the plan before deciding to have any.
 */
export function parseStatuspageConfig(
  environment: Environment,
  overrides: StatuspageConfigOverrides = {},
  options: { readonly requireApiKey?: boolean } = {},
): StatuspageConfig {
  const pageId = assertProviderIdentifier(
    overrides.pageId ?? environment['STATUSPAGE_PAGE_ID'],
    'pageId',
  );
  const componentId = assertProviderIdentifier(
    overrides.componentId ?? environment['STATUSPAGE_COMPONENT_ID'],
    'componentId',
  );
  const baseUrl = normalizeStatuspageBaseUrl(
    overrides.baseUrl ?? environment['STATUSPAGE_BASE_URL'] ?? DEFAULT_STATUSPAGE_BASE_URL,
  );

  const rawApiKey = environment['STATUSPAGE_API_KEY'];
  if ((options.requireApiKey ?? false) && rawApiKey === undefined) {
    throw new ValidationError('STATUSPAGE_API_KEY is required for live updates', {
      field: 'STATUSPAGE_API_KEY',
    });
  }
  if (rawApiKey === undefined) {
    return { pageId, componentId, baseUrl };
  }
  return { pageId, componentId, baseUrl, apiKey: assertApiKey(rawApiKey) };
}
