// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/config.js` and `dist/config.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies
// are the compiled ones.
//
// This file is released from that comparison, and is no longer held by the
// comparison with that module: it came out of the compiler flat enough to fail
// the complexity limit standing on publication, so while the comparison was its
// only support the package could not travel.
//
// The behavioural checks in `tests/scripts/recovered-stencil-config.test.ts` were
// written while the comparison still held, and are the guarantee now. The
// release is recorded in `tests/scripts/vypushchennye-iz-slicheniya.txt`; a
// divergence reported by `bash scripts/sverit-vosstanovlennoe.sh` on this
// package is expected.
//
// An unknown option is refused rather than ignored: these are written by hand in
// a build configuration, so a misspelling is the ordinary mistake, and ignoring
// it means the setting somebody wrote does nothing and says nothing.
//
// A tag that appears in both the include and exclude lists is refused rather
// than resolved by precedence. Either answer would be defensible and neither is
// what the author meant — they wrote two contradictory instructions, and picking
// one silently is how a component ends up unscanned for a year.
//
// Every path is checked as text and again after resolving, because `a/../../b`
// is neither absolute nor obviously climbing until it is resolved. A build
// configuration is a place a path can be pointed anywhere.
//
// Usage markup is capped at a megabyte per component: it is configuration rather
// than a document, and something that large is a mistake worth naming rather
// than serving.
//
// The result is frozen because it travels to every component in a build, and a
// step that mutated it would change what later components are scanned with,
// silently and by order.

import { isAbsolute, relative, resolve } from 'node:path';

import { ARIADA_SEVERITIES, } from './types.js';
import type { NormalizedStencilAriadaOptions, StencilAriadaOptions } from './types.js';

const OPTION_KEYS = new Set([
  'reportDir',
  'wwwDir',
  'failOn',
  'include',
  'exclude',
  'usages',
  'timeoutMs',
  'outputWaitMs',
]);
const TAG = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/;

/** The threshold, where `false` means "do not fail on findings at all". */
function normalizeFailOn(input: StencilAriadaOptions['failOn']): AriadaSeverity | false {
  const failOn = input ?? 'serious';
  if (failOn !== false && !ARIADA_SEVERITIES.includes(failOn)) {
    throw new TypeError(`failOn must be false or one of ${ARIADA_SEVERITIES.join(', ')}`);
  }
  return failOn;
}

/**
 * The two tag lists, refusing a tag that appears in both.
 *
 * Quietly picking one of the two would carry out something other than what was
 * written, and say nothing about it.
 */
function normalizeTagLists(
  includeInput: StencilAriadaOptions['include'],
  excludeInput: StencilAriadaOptions['exclude'],
): { include: readonly string[]; exclude: readonly string[] } {
  const include = tagArray(includeInput ?? [], 'include');
  const exclude = tagArray(excludeInput ?? [], 'exclude');
  const overlap = include.find((tag) => exclude.includes(tag));
  if (overlap !== undefined) {
    throw new TypeError(`Component cannot be both included and excluded: ${overlap}`);
  }
  return { include, exclude };
}

/**
 * The example markup per component, with each key checked as a tag before it is
 * used as one, and each document bounded.
 */
function normalizeUsages(input: StencilAriadaOptions['usages']): Record<string, string> {
  const usages: Record<string, string> = {};
  if (input === undefined) return usages;
  if (!isRecord(input)) throw new TypeError('usages must be an object keyed by component tag');
  for (const [tag, html] of Object.entries(input)) {
    assertTag(tag, 'usages');
    if (typeof html !== 'string' || html.trim().length === 0) {
      throw new TypeError(`Usage HTML for ${tag} must be a non-empty string`);
    }
    if (Buffer.byteLength(html) > 1_000_000) throw new TypeError(`Usage HTML for ${tag} exceeds 1 MB`);
    usages[tag] = html;
  }
  return usages;
}

export function normalizeOptions(input: StencilAriadaOptions = {}): NormalizedStencilAriadaOptions {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new TypeError('Stencil Ariada options must be an object');
  }
  for (const key of Object.keys(input)) {
    if (!OPTION_KEYS.has(key)) throw new TypeError(`Unknown Stencil Ariada option: ${key}`);
  }
  const reportDir = relativePath(input.reportDir ?? '.ariada/stencil', 'reportDir');
  const wwwDir = input.wwwDir === undefined ? undefined : relativePath(input.wwwDir, 'wwwDir');
  const failOn = normalizeFailOn(input.failOn);
  const { include, exclude } = normalizeTagLists(input.include, input.exclude);
  const usages = normalizeUsages(input.usages);
  const normalized = {
    reportDir,
    failOn,
    include,
    exclude,
    usages: Object.freeze(usages),
    timeoutMs: boundedInteger(input.timeoutMs ?? 30_000, 1_000, 120_000, 'timeoutMs'),
    outputWaitMs: boundedInteger(input.outputWaitMs ?? 30_000, 1_000, 120_000, 'outputWaitMs'),
    ...(wwwDir === undefined ? {} : { wwwDir }),
  };
  return Object.freeze(normalized);
}

export function resolveInside(root: string, candidate: string, label: string): string {
  const rootPath = resolve(root);
  const target = resolve(rootPath, candidate);
  const rel = relative(rootPath, target);
  if (rel === '..' || rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(rel)) {
    throw new Error(`${label} must remain inside Stencil rootDir`);
  }
  return target;
}

export function pathsOverlap(first: string, second: string): boolean {
  const a = resolve(first);
  const b = resolve(second);
  const fromA = relative(a, b);
  const fromB = relative(b, a);
  return fromA === '' || (!fromA.startsWith('..') && !isAbsolute(fromA)) || (!fromB.startsWith('..') && !isAbsolute(fromB));
}

export function assertTag(tag: string, label = 'component tag'): void {
  if (!TAG.test(tag)) throw new TypeError(`${label} contains an invalid custom-element tag: ${tag}`);
}

function relativePath(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.includes('\0')) {
    throw new TypeError(`${label} must be a non-empty relative path`);
  }
  if (isAbsolute(value)) throw new TypeError(`${label} must be relative to Stencil rootDir`);
  if (value.split(/[\\/]+/).includes('..')) throw new TypeError(`${label} must remain inside Stencil rootDir`);
  return value;
}

function tagArray(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array of component tags`);
  const unique = new Set<string>();
  for (const tag of value) {
    if (typeof tag !== 'string') throw new TypeError(`${label} must contain only strings`);
    assertTag(tag, label);
    unique.add(tag);
  }
  return Object.freeze([...unique].sort());
}

function boundedInteger(value: unknown, minimum: number, maximum: number, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new TypeError(`${label} must be an integer between ${minimum} and ${maximum}`);
  }
  return value as number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
