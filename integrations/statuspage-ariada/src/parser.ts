// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

// The scanner's answer, checked before anything is decided on it.
//
// This is stricter than it looks, and deliberately so: what comes out of here
// goes onto a public status board. A field of the wrong shape that travelled as
// `undefined` would show up as a component in the wrong state, which is a lie
// told to whoever is watching the board.
//
// Three of the checks are about agreement rather than shape — the total against
// the counts, the duration against the two timestamps, a non-zero exit against
// having found anything. Each catches a file that is internally impossible,
// which is what a truncated write or a hand-edited fixture looks like.

import { ValidationError } from './errors.js';
import {
  ARIADA_CLI_SCHEMA,
  type AriadaCliResult,
  type AriadaImpactCounts,
  type AriadaSummary,
} from './types.js';
import { assertNonEmptyString } from './validation.js';

function expectObject(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ValidationError(`${field} must be an object`, { field });
  }
  return value as Record<string, unknown>;
}

/**
 * Unknown keys are refused, not ignored. A misspelled field that is silently
 * dropped looks exactly like a field that had no effect, and the difference
 * matters when the thing it feeds is a status board.
 */
function expectExactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[],
  field: string,
): void {
  const allowed = new Set([...required, ...optional]);
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw new ValidationError(`${field} contains unknown field: ${unknown[0]}`, { field });
  }
  const missing = required.find((key) => !(key in value));
  if (missing !== undefined) {
    throw new ValidationError(`${field} is missing required field: ${missing}`, { field });
  }
}

function expectNonNegativeInteger(value: unknown, field: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new ValidationError(`${field} must be a non-negative integer`, { field });
  }
  return value as number;
}

/**
 * Canonical, not merely parseable. `Date.parse` accepts a great many things and
 * normalises them; requiring the round trip means two runs of the same scan
 * cannot disagree about what time it was.
 */
function expectTimestamp(value: unknown, field: string): { value: string; milliseconds: number } {
  const timestamp = assertNonEmptyString(value, field, 64);
  const milliseconds = Date.parse(timestamp);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== timestamp) {
    throw new ValidationError(`${field} must be a canonical ISO-8601 UTC timestamp`, { field });
  }
  return { value: timestamp, milliseconds };
}

function expectHttpUrl(value: unknown): string {
  const url = assertNonEmptyString(value, 'result.url');
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('unsupported protocol');
    }
  } catch (cause) {
    throw new ValidationError('result.url must be a valid HTTP or HTTPS URL', {
      field: 'result.url',
      cause,
    });
  }
  return url;
}

function parseSummary(value: unknown): AriadaSummary {
  const summary = expectObject(value, 'result.summary');
  expectExactKeys(summary, ['total', 'byImpact'], [], 'result.summary');

  const byImpact = expectObject(summary['byImpact'], 'result.summary.byImpact');
  expectExactKeys(byImpact, ['critical', 'serious', 'moderate', 'minor'], [], 'result.summary.byImpact');

  const counts: AriadaImpactCounts = {
    critical: expectNonNegativeInteger(byImpact['critical'], 'result.summary.byImpact.critical'),
    serious: expectNonNegativeInteger(byImpact['serious'], 'result.summary.byImpact.serious'),
    moderate: expectNonNegativeInteger(byImpact['moderate'], 'result.summary.byImpact.moderate'),
    minor: expectNonNegativeInteger(byImpact['minor'], 'result.summary.byImpact.minor'),
  };

  const total = expectNonNegativeInteger(summary['total'], 'result.summary.total');
  const counted = counts.critical + counts.serious + counts.moderate + counts.minor;
  if (total !== counted) {
    throw new ValidationError('result.summary.total must equal the sum of byImpact counts', {
      field: 'result.summary.total',
    });
  }

  return { total, byImpact: counts };
}

/** A scanner result, or a refusal naming the field that was wrong. */
export function parseAriadaCliResult(value: unknown): AriadaCliResult {
  const result = expectObject(value, 'result');
  expectExactKeys(
    result,
    ['$schema', 'url', 'startedAt', 'completedAt', 'durationMs', 'summary', 'report', 'exitCode'],
    ['scanId'],
    'result',
  );

  if (result['$schema'] !== ARIADA_CLI_SCHEMA) {
    throw new ValidationError(`result.$schema must equal ${ARIADA_CLI_SCHEMA}`, {
      field: 'result.$schema',
    });
  }

  const startedAt = expectTimestamp(result['startedAt'], 'result.startedAt');
  const completedAt = expectTimestamp(result['completedAt'], 'result.completedAt');
  const durationMs = expectNonNegativeInteger(result['durationMs'], 'result.durationMs');
  if (completedAt.milliseconds - startedAt.milliseconds !== durationMs) {
    throw new ValidationError('result.durationMs must match completedAt minus startedAt', {
      field: 'result.durationMs',
    });
  }

  const summary = parseSummary(result['summary']);

  const exitCode = result['exitCode'];
  if (exitCode !== 0 && exitCode !== 1) {
    throw new ValidationError('result.exitCode must be 0 or 1', { field: 'result.exitCode' });
  }
  // A run that stopped the build while finding nothing is not a result anyone
  // can act on; something between the scan and here has lost half of it.
  if (exitCode === 1 && summary.total === 0) {
    throw new ValidationError('result.exitCode 1 requires at least one finding', {
      field: 'result.exitCode',
    });
  }

  const report = expectObject(result['report'], 'result.report');
  const scanId =
    result['scanId'] === undefined
      ? undefined
      : assertNonEmptyString(result['scanId'], 'result.scanId', 256);

  const parsed: AriadaCliResult = {
    $schema: ARIADA_CLI_SCHEMA,
    url: expectHttpUrl(result['url']),
    startedAt: startedAt.value,
    completedAt: completedAt.value,
    durationMs,
    summary,
    report,
    exitCode,
  };

  return scanId === undefined ? parsed : { ...parsed, scanId };
}

/** As above, from the text on disk. */
export function parseAriadaCliJson(json: string): AriadaCliResult {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch (cause) {
    throw new ValidationError('Ariada input must be valid JSON', { field: 'input', cause });
  }
  return parseAriadaCliResult(value);
}
