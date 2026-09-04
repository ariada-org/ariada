// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

// Everything that has to be true of a string before it is put into a URL, a
// header, or a request body. Each check exists because the value comes from an
// environment variable or a command line — that is, from outside.

import { ValidationError } from './errors.js';

const PROVIDER_IDENTIFIER = /^[A-Za-z0-9_-]{1,128}$/u;

/**
 * Non-empty, and not padded. Surrounding whitespace is refused rather than
 * trimmed: a page identifier with a trailing newline is a copy-paste mistake,
 * and trimming it silently makes the next one harder to find.
 */
export function assertNonEmptyString(value: unknown, field: string, maximumLength = 2_048): string {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    throw new ValidationError(`${field} must be a non-empty string without surrounding whitespace`, {
      field,
    });
  }
  if (value.length > maximumLength) {
    throw new ValidationError(`${field} must be at most ${maximumLength} characters`, { field });
  }
  return value;
}

/**
 * An identifier that will be interpolated into a request path. Restricted to
 * characters that cannot change what that path means.
 */
export function assertProviderIdentifier(value: unknown, field: string): string {
  const identifier = assertNonEmptyString(value, field, 128);
  if (!PROVIDER_IDENTIFIER.test(identifier)) {
    throw new ValidationError(
      `${field} may contain only ASCII letters, numbers, underscores, and hyphens`,
      { field },
    );
  }
  return identifier;
}

/**
 * An origin and nothing more. A base address carrying a path, a query, or
 * credentials would be appended to rather than replaced, and the request would
 * go somewhere nobody wrote down.
 */
export function normalizeStatuspageBaseUrl(value: unknown): string {
  const raw = assertNonEmptyString(value, 'baseUrl', 2_048);
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch (cause) {
    throw new ValidationError('baseUrl must be a valid URL', { field: 'baseUrl', cause });
  }
  if (
    parsed.protocol !== 'https:' ||
    parsed.username !== '' ||
    parsed.password !== '' ||
    parsed.pathname !== '/' ||
    parsed.search !== '' ||
    parsed.hash !== ''
  ) {
    throw new ValidationError(
      'baseUrl must be an HTTPS origin without credentials, path, query, or fragment',
      { field: 'baseUrl' },
    );
  }
  return parsed.origin;
}

/** The key, checked for shape only — whether it works is the far end's answer. */
export function assertApiKey(value: unknown): string {
  return assertNonEmptyString(value, 'apiKey', 4_096);
}

/** A timeout that is a number of milliseconds and not, say, a number of minutes. */
export function assertTimeout(value: unknown): number {
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 120_000) {
    throw new ValidationError('timeoutMs must be an integer from 1 through 120000', {
      field: 'timeoutMs',
    });
  }
  return value as number;
}
