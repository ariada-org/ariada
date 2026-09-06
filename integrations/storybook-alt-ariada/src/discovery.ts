// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/discovery.js` and `dist/discovery.d.ts`. The source this
// was built from was never committed; the compiled output is `tsc` with the
// types stripped, so the shapes come back from the declaration file and the
// bodies are the compiled ones. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.
//
// TWO PLATFORMS ANSWER "WHAT STORIES ARE THERE" DIFFERENTLY: one serves a
// metadata document over HTTP, the other writes a manifest to disk. Both are
// read with a size ceiling, and the HTTP one is checked twice — the declared
// length and then the body actually received, because the declared length is
// whatever the other side chose to say.
//
// A STORY PATH MUST STAY ON THE SAME ORIGIN, AND IT IS CHECKED AFTER RESOLVING.
// A manifest is a file something else generated; a path beginning with two
// slashes is a different host wearing the shape of an absolute path, and a
// scanner pointed at it would be scanning somebody else's site under this
// report's name.
//
// Three refusals about the set as a whole, and each is a silent failure
// otherwise. No stories at all means the discovery worked and found an empty
// library — far more likely a wrong address, and reporting zero findings over
// zero stories is a green tick over nothing. More than ten thousand is a
// runaway. A duplicate identifier means one story's report would overwrite
// another's, and the count would still look right.
//
// The identifier is checked against a shape because it goes into a query string
// and into a filename.

import { readFile, stat } from 'node:fs/promises';

import type { NormalizedStoryRunnerOptions, StoryDescriptor } from './types.js';

const MAX_METADATA_BYTES = 5 * 1024 * 1024;

export async function discoverStories(
  options: NormalizedStoryRunnerOptions,
  baseUrl: string,
): Promise<readonly StoryDescriptor[]> {
  if (options.platform === 'ladle') {
    const response = await fetch(new URL('meta.json', baseUrl), {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(options.timeoutMs),
    });
    if (!response.ok) throw new Error('Ladle metadata request failed with HTTP ' + response.status);
    const length = Number(response.headers.get('content-length') ?? '0');
    if (Number.isFinite(length) && length > MAX_METADATA_BYTES) throw new Error('Ladle metadata exceeds 5 MB');
    const body = await response.arrayBuffer();
    if (body.byteLength > MAX_METADATA_BYTES) throw new Error('Ladle metadata exceeds 5 MB');
    return parseLadleMeta(new TextDecoder().decode(body), baseUrl);
  }
  const manifest = options.manifest;
  if (manifest === undefined) throw new Error('Histoire manifest is required');
  const info = await stat(manifest);
  if (!info.isFile() || info.size > MAX_METADATA_BYTES) throw new Error('Histoire manifest must be a file no larger than 5 MB');
  return parseHistoireManifest(await readFile(manifest, 'utf8'), baseUrl);
}

export function parseLadleMeta(text: string, baseUrl: string): readonly StoryDescriptor[] {
  const root = parseJsonRecord(text, 'Ladle metadata');
  const stories = record(root['stories'], '$.stories');
  const output = Object.entries(stories).map(([id, value]) => {
    assertId(id, 'Ladle story id');
    const story = record(value, '$.stories.' + id);
    const name = nonEmptyString(story['name'], '$.stories.' + id + '.name');
    const levels = stringArray(story['levels'], '$.stories.' + id + '.levels');
    const url = new URL(baseUrl);
    url.searchParams.set('story', id);
    url.searchParams.set('mode', 'preview');
    return {
      platform: 'ladle' as const,
      id,
      title: [...levels, name].filter(Boolean).join(' / '),
      url: url.href,
    };
  });
  return finalize(output, 'Ladle');
}

export function parseHistoireManifest(text: string, baseUrl: string): readonly StoryDescriptor[] {
  const root = parseJsonRecord(text, 'Histoire manifest');
  if (root['schemaVersion'] !== '1.0.0') throw new Error('Histoire manifest schemaVersion must be 1.0.0');
  if (!Array.isArray(root['stories'])) throw new Error('$.stories must be an array');
  const output = root['stories'].map((value, index) => {
    const story = record(value, '$.stories[' + index + ']');
    const id = nonEmptyString(story['id'], '$.stories[' + index + '].id');
    assertId(id, 'Histoire story id');
    const title = nonEmptyString(story['title'], '$.stories[' + index + '].title');
    const path = nonEmptyString(story['path'], '$.stories[' + index + '].path');
    if (!path.startsWith('/') || path.startsWith('//')) {
      throw new Error('Histoire story path must be a same-origin absolute path');
    }
    const url = new URL(path, baseUrl);
    if (url.origin !== new URL(baseUrl).origin) throw new Error('Histoire story path changed origin');
    return { platform: 'histoire' as const, id, title, url: url.href };
  });
  return finalize(output, 'Histoire');
}

function finalize(stories: StoryDescriptor[], platform: string): readonly StoryDescriptor[] {
  if (stories.length === 0) throw new Error(platform + ' exposed no stories');
  if (stories.length > 10_000) throw new Error(platform + ' exposed more than 10000 stories');
  const ids = new Set<string>();
  for (const story of stories) {
    if (ids.has(story.id)) throw new Error(platform + ' contains duplicate story id: ' + story.id);
    ids.add(story.id);
  }
  return Object.freeze(stories.sort((left, right) => left.id.localeCompare(right.id)));
}

function parseJsonRecord(text: string, label: string): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(text);
  }
  catch (error) {
    throw new Error(label + ' is not valid JSON', { cause: error });
  }
  return record(value, '$');
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(path + ' must be an object');
  return value as Record<string, unknown>;
}

function nonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(path + ' must be a non-empty string');
  return value;
}

function stringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) throw new Error(path + ' must be an array');
  return value.map((entry, index) => {
    if (typeof entry !== 'string') throw new Error(path + '[' + index + '] must be a string');
    return entry;
  });
}

function assertId(value: string, label: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/.test(value)) throw new Error(label + ' is invalid: ' + value);
}
