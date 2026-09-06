// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/config.js` and `dist/config.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies
// are the compiled ones.
//
// This module has since been released from that comparison.
//
// HOW IT IS HELD NOW. Thirteen behaviour tests written while the comparison
// still matched, then the reader split into the combinations that cannot be
// meant and the values that carry their own ranges. Twenty against a limit of
// fifteen.
//
// Checked against damage: let an unknown option through, allow an address and a
// directory at once, accept credentials in an address, pass a null byte in a
// path, or stop normalising the address — each fails a test that passes
// otherwise.
//
// The guarantee lives in `tests/scripts/recovered-storybook-alt-config.test.ts`,
// and the release is recorded in `tests/scripts/vypushchennye-iz-slicheniya.txt`.
//
// A running story server and a built directory are mutually exclusive rather
// than one falling back to the other. They are different things to have scanned
// — a live development server and a deployable build — and quietly preferring
// one would produce a report about something the caller did not ask for.
//
// The base address is normalised rather than merely validated: query and
// fragment are dropped and a trailing slash is added, because every story
// address is resolved against it. Left as given, `?theme=dark` on the base would
// silently apply to every story, and a base without its slash would drop its own
// last segment when a story address is resolved against it.
//
// Credentials in the address are refused. It is stored in the report and read
// back later, and a report is not a place to keep a password.

import { isAbsolute, resolve } from 'node:path';

import { ARIADA_SEVERITIES, STORY_PLATFORMS, } from './types.js';
import type { NormalizedStoryRunnerOptions, StoryRunnerOptions } from './types.js';

const OPTION_KEYS = new Set(['platform', 'baseUrl', 'staticDir', 'manifest', 'reportDir', 'failOn', 'timeoutMs']);

/**
 * The combinations that cannot be meant, refused before anything is normalised.
 *
 * Each of these produces a run that finishes if it is let through, which is why
 * they are refusals rather than warnings: an unknown key means a setting
 * somebody wrote is not in force and the report says nothing about it, and two
 * sources at once means the report names one of them and the reader believes it.
 */
function assertShape(input: StoryRunnerOptions): void {
  if (!isRecord(input)) throw new TypeError('Story runner options must be an object');
  for (const key of Object.keys(input)) {
    if (!OPTION_KEYS.has(key)) throw new TypeError('Unknown story runner option: ' + key);
  }
  if (!STORY_PLATFORMS.includes(input.platform)) {
    throw new TypeError('platform must be one of ' + STORY_PLATFORMS.join(', '));
  }
  if (input.baseUrl === undefined && input.staticDir === undefined) {
    throw new TypeError('baseUrl or staticDir is required');
  }
  if (input.baseUrl !== undefined && input.staticDir !== undefined) {
    throw new TypeError('baseUrl and staticDir are mutually exclusive');
  }
  if (input.platform === 'histoire' && input.manifest === undefined) {
    throw new TypeError('manifest is required for Histoire story discovery');
  }
}

/** The two values that carry their own ranges, checked together. */
function limits(input: StoryRunnerOptions): { failOn: NormalizedStoryRunnerOptions['failOn']; timeoutMs: number } {
  const failOn = input.failOn ?? 'serious';
  if (failOn !== false && !ARIADA_SEVERITIES.includes(failOn)) {
    throw new TypeError('failOn must be false or one of ' + ARIADA_SEVERITIES.join(', '));
  }
  const timeoutMs = input.timeoutMs ?? 30_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 120_000) {
    throw new TypeError('timeoutMs must be an integer between 1000 and 120000');
  }
  return { failOn, timeoutMs };
}

export function normalizeOptions(input: StoryRunnerOptions, cwd: string = process.cwd()): NormalizedStoryRunnerOptions {
  assertShape(input);
  const baseUrl = input.baseUrl === undefined ? undefined : normalizeHttpUrl(input.baseUrl);
  const staticDir = input.staticDir === undefined ? undefined : absolutePath(input.staticDir, cwd, 'staticDir');
  const manifest = input.manifest === undefined ? undefined : absolutePath(input.manifest, cwd, 'manifest');
  const reportDir = absolutePath(input.reportDir ?? '.ariada/storybook-alt', cwd, 'reportDir');
  const { failOn, timeoutMs } = limits(input);
  return Object.freeze({
    platform: input.platform,
    ...(baseUrl === undefined ? {} : { baseUrl }),
    ...(staticDir === undefined ? {} : { staticDir }),
    ...(manifest === undefined ? {} : { manifest }),
    reportDir,
    failOn,
    timeoutMs,
  });
}

function normalizeHttpUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  }
  catch {
    throw new TypeError('baseUrl must be an absolute HTTP(S) URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new TypeError('baseUrl must use HTTP(S)');
  if (url.username !== '' || url.password !== '') throw new TypeError('baseUrl must not contain credentials');
  url.hash = '';
  url.search = '';
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url.href;
}

function absolutePath(value: unknown, cwd: string, label: string): string {
  if (typeof value !== 'string' || value.trim() === '' || value.includes('\0')) {
    throw new TypeError(label + ' must be a non-empty filesystem path');
  }
  return isAbsolute(value) ? resolve(value) : resolve(cwd, value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
