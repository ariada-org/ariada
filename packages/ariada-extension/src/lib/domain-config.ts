// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { DOMAIN_PACKAGE_CONVENTION } from '@ariada-org/core-engine';

import type { DomainColumn, ModuleSource } from '../ui/report-grid.js';

/** A built-in domain and the human-readable label shown in the grid header. */
export interface BuiltInDomain {
  readonly id: string;
  readonly label: string;
}

/**
 * The built-in domains this panel can run, in the order the engine reports
 * them, with the labels the grid and the settings page display.
 *
 * Five, not six: transport security is left out, for the reason recorded
 * beside the gap below.
 */
export const BUILT_IN_DOMAINS: readonly BuiltInDomain[] = [
  { id: 'accessibility', label: 'Accessibility' },
  { id: 'privacy', label: 'Privacy' },
  // Security is intentionally absent: it decides solely from HTTP response
  // headers, which a page-context content script cannot read, so it would flag
  // every page falsely. The command-line tool runs it with real headers.
  { id: 'ai-readiness', label: 'AI readiness' },
  { id: 'structured-data', label: 'Structured data' },
  { id: 'sustainability', label: 'Sustainability' },
];

const BUILT_IN_IDS = new Set(BUILT_IN_DOMAINS.map((d) => d.id));
const BUILT_IN_LABEL = new Map(BUILT_IN_DOMAINS.map((d) => [d.id, d.label]));

/** A pluggable module the user added at runtime (config path or local file). */
export interface PluggableModule {
  readonly id: string;
  readonly label: string;
  readonly source: ModuleSource;
  readonly trusted: boolean;
  readonly version: string;
}

/** Result of validating a settings-page "add module" input. */
export type ModuleInputResult =
  | { ok: true; kind: 'npm' | 'local-file' }
  | { ok: false; reason: string };

/**
 * Validate a settings-page module input against the three loading paths.
 *
 * - An npm package name following the `ariada-domain-*` convention is accepted
 *   for the companion-CLI rebuild path.
 * - A local `.js`/`.mjs` file path is accepted for the sandboxed local-file path.
 * - An http/https URL is rejected: the Chrome Web Store Developer Program
 *   Policies prohibit fetching and executing remotely hosted code, so URL import
 *   of a domain module is never permitted.
 */
export function validateModuleInput(raw: string): ModuleInputResult {
  const value = raw.trim();
  if (value.length === 0) {
    return { ok: false, reason: 'Enter a package name or local file path.' };
  }
  if (/^https?:\/\//i.test(value)) {
    return {
      ok: false,
      reason:
        'Remote URL import is not allowed. Chrome Web Store policy prohibits fetching and executing remotely hosted code. Use a published ariada-domain-* package or a local file instead.',
    };
  }
  if (DOMAIN_PACKAGE_CONVENTION.test(value)) {
    return { ok: true, kind: 'npm' };
  }
  if (/\.(js|mjs)$/i.test(value)) {
    return { ok: true, kind: 'local-file' };
  }
  return {
    ok: false,
    reason:
      'Unrecognised module. Expected an ariada-domain-* npm package name or a path to a local .js/.mjs file.',
  };
}

/**
 * Build the ordered grid columns for a report's domain ids. Built-in ids resolve
 * to their canonical labels; any other id is looked up in the pluggable-module
 * list so its source and trust badge are carried through to the header.
 */
export function toColumns(
  domainIds: readonly string[],
  pluggables: readonly PluggableModule[],
): DomainColumn[] {
  const byId = new Map(pluggables.map((p) => [p.id, p]));
  return domainIds.map((id) => {
    if (BUILT_IN_IDS.has(id)) {
      return { id, label: BUILT_IN_LABEL.get(id) ?? id, source: 'built-in' as const };
    }
    const plug = byId.get(id);
    if (plug) {
      return { id, label: plug.label, source: plug.source, trusted: plug.trusted };
    }
    return { id, label: id, source: 'built-in' as const };
  });
}
