// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Chrome labels for the shared render layer. Defaults are English; a consumer
// passes its own locale strings. No product copy lives in this package.

export interface AdminSvelteI18n {
  /** quick-filter placeholder above the grid. */
  readonly searchPlaceholder?: string;
  /** header help popover link. */
  readonly learnMore?: string;
  /** row-action confirm popover. */
  readonly reasonRequiredPlaceholder?: string;
  readonly reasonOptionalPlaceholder?: string;
  readonly confirm?: string;
  readonly cancel?: string;
  /** row-operation drawer. */
  readonly detailTitle?: string;
  readonly parameters?: string;
  readonly edit?: string;
  readonly save?: string;
  readonly close?: string;
  /** chart empty state. */
  readonly noData?: string;
}

export type ResolvedAdminSvelteI18n = Required<AdminSvelteI18n>;

export const DEFAULT_I18N: ResolvedAdminSvelteI18n = Object.freeze({
  searchPlaceholder: 'Search the table…',
  learnMore: 'Learn more →',
  reasonRequiredPlaceholder: 'Reason (required, audit-logged)',
  reasonOptionalPlaceholder: 'Reason (optional)',
  confirm: 'Confirm',
  cancel: 'Cancel',
  detailTitle: 'Operation',
  parameters: 'Parameters',
  edit: 'Edit',
  save: 'Save',
  close: 'Close',
  noData: 'no data',
});

export function resolveI18n(overrides?: AdminSvelteI18n): ResolvedAdminSvelteI18n {
  return overrides ? { ...DEFAULT_I18N, ...stripUndefined(overrides) } : DEFAULT_I18N;
}

function stripUndefined(value: AdminSvelteI18n): Partial<ResolvedAdminSvelteI18n> {
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string') out[key] = entry;
  }
  return out as Partial<ResolvedAdminSvelteI18n>;
}
