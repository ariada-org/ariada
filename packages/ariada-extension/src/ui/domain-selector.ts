// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Domain selector UI: renders a checklist of all active domain modules (built-in
// and user-added), with source badges for non-built-in modules, and per-column
// toggle checkboxes. Changing a checkbox notifies the caller without triggering
// a re-scan — only the grid visibility updates.

import type { LoadedModule } from '../lib/module-registry.js';

/** Callback invoked when the user toggles a domain column on or off. */
export type DomainToggleCallback = (domainId: string, enabled: boolean) => void;

/**
 * Render the domain selector checklist into a container element.
 *
 * Each row in the list carries:
 * - a checkbox to enable/disable the domain column in the grid
 * - the domain's display name
 * - a source badge for companion-CLI and local-file modules
 * - a warning annotation for sandboxed (untrusted) local-file modules
 *
 * The rendered checklist replaces any existing children of `container`.
 */
export function renderDomainSelector(
  container: HTMLElement,
  modules: readonly LoadedModule[],
  enabledIds: ReadonlySet<string>,
  onToggle: DomainToggleCallback,
): void {
  container.replaceChildren();

  for (const mod of modules) {
    const row = buildRow(mod, enabledIds.has(mod.id), onToggle);
    container.appendChild(row);
  }
}

function buildRow(
  mod: LoadedModule,
  checked: boolean,
  onToggle: DomainToggleCallback,
): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'domain-selector-row';
  row.dataset['domainId'] = mod.id;
  row.dataset['source'] = mod.source;

  // Checkbox
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.id = `domain-sel-${mod.id}`;
  cb.checked = checked;
  cb.addEventListener('change', () => onToggle(mod.id, cb.checked));

  // Label (the accessible name for the checkbox)
  const label = document.createElement('label');
  label.setAttribute('for', cb.id);
  label.className = 'domain-sel-name';
  label.textContent = mod.displayName;

  row.append(cb, label);

  // Source badge for non-built-in modules
  if (mod.source !== 'built-in') {
    const badge = document.createElement('span');
    badge.className = 'source-badge';
    badge.textContent = sourceBadgeText(mod);
    row.appendChild(badge);
  }

  // Untrusted module warning annotation
  if (!mod.trusted) {
    const warning = document.createElement('span');
    warning.className = 'untrusted-warning';
    warning.setAttribute('aria-label', 'Unreviewed local module — runs in a sandbox');
    warning.textContent = '⚠ Unreviewed local module';
    row.appendChild(warning);
  }

  return row;
}

function sourceBadgeText(mod: LoadedModule): string {
  switch (mod.source) {
    case 'companion-cli':
      return '✓ CLI';
    case 'local-file':
      return '⚠ local';
    default:
      return '';
  }
}
