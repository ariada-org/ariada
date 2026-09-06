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
// The behavioural checks in `tests/scripts/recovered-bit-config.test.ts` were
// written while the comparison still held, and are the guarantee now. The
// release is recorded in `tests/scripts/vypushchennye-iz-slicheniya.txt`; a
// divergence reported by `bash scripts/sverit-vosstanovlennoe.sh` on this
// package is expected.
//
// AN UNKNOWN OPTION IS AN ERROR RATHER THAN SOMETHING IGNORED. These options are
// written by hand in a workspace configuration, so a misspelling is the ordinary
// failure — and ignoring it means the setting somebody wrote has no effect and
// nothing says so. The same applies one level down, to the keys of a rendered
// target.
//
// EVERY PATH IS FORCED TO STAY INSIDE THE CAPSULE, AND IT IS CHECKED TWICE. Once
// as text, refusing an absolute path or one containing `..`, and again after
// resolving, because `a/../../b` is neither absolute nor obviously climbing
// until it is resolved. A component's build directory is somewhere a task can be
// pointed at by configuration, and the capsule boundary is the only thing
// between that and the rest of the machine.
//
// The result is frozen. These options travel to every component in a build, and
// a task that mutated them would change what later components are scanned with —
// silently, and differently depending on order.
//
// `failOn: false` is a real value rather than an omission: it means "report
// everything and fail nothing", which a workspace adopting this on an existing
// component library needs on the first day.

import { isAbsolute, relative, resolve } from 'node:path';

import { ARIADA_SEVERITIES, } from './types.js';
import type { AriadaBitOptions, AriadaSeverity, NormalizedAriadaBitOptions, NormalizedRenderedPageTarget, RenderedPageTarget } from './types.js';

const OPTION_KEYS = new Set(['reportDir', 'rendered', 'components', 'failOn', 'timeoutMs']);
const TARGET_KEYS = new Set(['rootDir', 'page']);

/**
 * The per-component targets, with every key checked before it is used as one.
 *
 * A key that carries surrounding whitespace, a null byte, or five hundred
 * characters is a key nobody typed on purpose, and taking it at face value puts
 * it into a path.
 */
function normalizeComponents(
  input: AriadaBitOptions['components'],
): Record<string, NormalizedRenderedPageTarget> {
  const components: Record<string, NormalizedRenderedPageTarget> = {};
  if (input === undefined) return components;
  if (!isRecord(input)) throw new TypeError('components must be an object keyed by Bit component id');
  for (const [key, value] of Object.entries(input)) {
    if (key.trim() !== key || key.length === 0 || key.length > 500 || key.includes('\0')) {
      throw new TypeError(`Invalid Bit component key: ${JSON.stringify(key)}`);
    }
    components[key] = normalizeRendered(value, `components.${key}`);
  }
  return components;
}

/** The threshold, where `false` means "do not fail on findings at all". */
function normalizeFailOn(input: AriadaBitOptions['failOn']): AriadaSeverity | false {
  const failOn = (input ?? 'serious') as AriadaSeverity | false;
  if (failOn !== false && !ARIADA_SEVERITIES.includes(failOn)) {
    throw new TypeError(`failOn must be false or one of ${ARIADA_SEVERITIES.join(', ')}`);
  }
  return failOn;
}

/** The timeout, in the range a page scan can plausibly need. */
function normalizeTimeout(input: AriadaBitOptions['timeoutMs']): number {
  const timeoutMs = input ?? 30_000;
  if (typeof timeoutMs !== 'number') throw new TypeError('timeoutMs must be a number');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 120_000) {
    throw new TypeError('timeoutMs must be an integer between 1000 and 120000');
  }
  return timeoutMs;
}

export function normalizeOptions(input: AriadaBitOptions = {}): NormalizedAriadaBitOptions {
  if (!isRecord(input)) throw new TypeError('Bit Ariada options must be an object');
  for (const key of Object.keys(input)) {
    if (!OPTION_KEYS.has(key)) throw new TypeError(`Unknown Bit Ariada option: ${key}`);
  }
  const reportDir = relativePath(input.reportDir ?? 'artifacts/ariada', 'reportDir', false);
  const rendered = normalizeRendered(input.rendered ?? {}, 'rendered');
  const components = normalizeComponents(input.components);
  const failOn = normalizeFailOn(input.failOn);
  const timeoutMs = normalizeTimeout(input.timeoutMs);
  return Object.freeze({
    reportDir,
    rendered,
    components: Object.freeze(components),
    failOn,
    timeoutMs,
  });
}

export function renderedTargetFor(
  options: NormalizedAriadaBitOptions,
  componentIds: readonly string[],
): NormalizedRenderedPageTarget {
  for (const id of componentIds) {
    const target = options.components[id];
    if (target !== undefined) return target;
  }
  return options.rendered;
}

export function resolveInside(root: string, candidate: string, label: string): string {
  const rootPath = resolve(root);
  const target = resolve(rootPath, candidate);
  const rel = relative(rootPath, target);
  if (rel === '..' || rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(rel)) {
    throw new Error(`${label} must remain inside the Bit component capsule`);
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

function normalizeRendered(value: RenderedPageTarget, label: string): NormalizedRenderedPageTarget {
  if (!isRecord(value)) throw new TypeError(`${label} must be an object`);
  for (const key of Object.keys(value)) {
    if (!TARGET_KEYS.has(key)) throw new TypeError(`Unknown ${label} option: ${key}`);
  }
  const target = value;
  return Object.freeze({
    rootDir: relativePath(target.rootDir ?? 'dist', `${label}.rootDir`, true),
    page: relativePath(target.page ?? 'index.html', `${label}.page`, false),
  });
}

function relativePath(value: unknown, label: string, allowDot: boolean): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.includes('\0')) {
    throw new TypeError(`${label} must be a non-empty relative path`);
  }
  if (isAbsolute(value)) throw new TypeError(`${label} must be relative to the Bit component capsule`);
  if (value.split(/[\\/]+/).includes('..')) throw new TypeError(`${label} must remain inside the Bit component capsule`);
  if (!allowDot && (value === '.' || value === './')) throw new TypeError(`${label} must name a child path`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
