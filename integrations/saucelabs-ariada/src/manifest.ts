// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/manifest.js` and `dist/manifest.d.ts`. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.

import type { SauceManifest } from './types.js';

/**
 * Check a manifest and hand back the same object.
 *
 * Every failure names the field, because this is read from a file somebody
 * wrote by hand in a pipeline configuration, and "invalid manifest" sends them
 * looking at all of it.
 *
 * @param input - the parsed file
 * @returns the same value, once it is known to be a manifest
 */
export function parseSauceManifest(input: unknown): SauceManifest {
  if (!input || typeof input !== 'object') throw new Error('Sauce manifest must be an object');
  const value = input as SauceManifest;
  const source = value.source;
  const capabilities = value.capabilities;
  if (value.schemaVersion !== 1) throw new Error('Sauce manifest schemaVersion must be 1');
  if (typeof value.runId !== 'string' || value.runId.length === 0)
    throw new Error('Sauce manifest runId is required');
  if (typeof source?.url !== 'string' || !/^https?:\/\/\S+$/u.test(source.url))
    throw new Error('Sauce manifest source.url must be an HTTP(S) URL');
  if (typeof capabilities?.browserName !== 'string' || typeof capabilities.platformName !== 'string')
    throw new Error('Sauce capabilities require browserName and platformName');
  const maxFindings = value.gate?.maxFindings;
  if (maxFindings !== undefined && (!Number.isInteger(maxFindings) || maxFindings < 0))
    throw new Error('gate.maxFindings must be a non-negative integer');
  return input as SauceManifest;
}
