// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect, vi } from 'vitest';

import type { LoadedModule } from '../lib/module-registry.js';

import { renderDomainSelector } from './domain-selector.js';

function makeModule(overrides: Partial<LoadedModule> = {}): LoadedModule {
  return {
    id: 'accessibility',
    module: null,
    source: 'built-in',
    trusted: true,
    displayName: 'Accessibility',
    version: '0.1.0',
    ...overrides,
  };
}

describe('renderDomainSelector', () => {
  it('renders one row per module', () => {
    const container = document.createElement('div');
    const modules = [
      makeModule({ id: 'accessibility', displayName: 'Accessibility' }),
      makeModule({ id: 'privacy', displayName: 'Privacy' }),
    ];
    renderDomainSelector(container, modules, new Set(['accessibility', 'privacy']), vi.fn());
    const rows = container.querySelectorAll('.domain-selector-row');
    expect(rows).toHaveLength(2);
  });

  it('checks the checkbox for domains in the enabled set', () => {
    const container = document.createElement('div');
    renderDomainSelector(
      container,
      [makeModule({ id: 'accessibility' })],
      new Set(['accessibility']),
      vi.fn(),
    );
    const cb = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(cb?.checked).toBe(true);
  });

  it('leaves the checkbox unchecked for domains not in the enabled set', () => {
    const container = document.createElement('div');
    renderDomainSelector(
      container,
      [makeModule({ id: 'accessibility' })],
      new Set(), // empty — nothing enabled
      vi.fn(),
    );
    const cb = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(cb?.checked).toBe(false);
  });

  it('calls onToggle with the domain id and new state when a checkbox changes', () => {
    const container = document.createElement('div');
    const onToggle = vi.fn();
    renderDomainSelector(
      container,
      [makeModule({ id: 'privacy' })],
      new Set(['privacy']),
      onToggle,
    );
    const cb = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
    cb!.checked = false;
    cb!.dispatchEvent(new Event('change'));
    expect(onToggle).toHaveBeenCalledWith('privacy', false);
  });

  it('adds a source badge for companion-CLI modules', () => {
    const container = document.createElement('div');
    renderDomainSelector(
      container,
      [makeModule({ id: 'extra', source: 'companion-cli', trusted: true })],
      new Set(['extra']),
      vi.fn(),
    );
    const badge = container.querySelector('.source-badge');
    expect(badge?.textContent).toContain('CLI');
  });

  it('adds both a source badge and an untrusted warning for local-file modules', () => {
    const container = document.createElement('div');
    renderDomainSelector(
      container,
      [makeModule({ id: 'stub', source: 'local-file', trusted: false, displayName: 'Stub' })],
      new Set(['stub']),
      vi.fn(),
    );
    const badge = container.querySelector('.source-badge');
    const warning = container.querySelector('.untrusted-warning');
    expect(badge).not.toBeNull();
    expect(warning).not.toBeNull();
    expect(warning?.textContent).toContain('Unreviewed');
  });

  it('does not add a source badge for built-in modules', () => {
    const container = document.createElement('div');
    renderDomainSelector(
      container,
      [makeModule({ id: 'accessibility', source: 'built-in' })],
      new Set(['accessibility']),
      vi.fn(),
    );
    expect(container.querySelector('.source-badge')).toBeNull();
  });

  it('replaces existing children on each render call', () => {
    const container = document.createElement('div');
    const existing = document.createElement('p');
    existing.textContent = 'stale content';
    container.appendChild(existing);
    renderDomainSelector(
      container,
      [makeModule({ id: 'accessibility' })],
      new Set(),
      vi.fn(),
    );
    expect(container.querySelector('p')).toBeNull();
    expect(container.querySelectorAll('.domain-selector-row')).toHaveLength(1);
  });
});
