// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// The AG Grid theme for every Agonist admin surface. Kept in one place so a
// board can never bring its own grid skin — a profile changes CONTENT only.
import { themeQuartz } from 'ag-grid-community';
import type { Theme } from 'ag-grid-community';

export type AdminColorScheme = 'light' | 'dark';

export interface AdminGridThemeOptions {
  /** the ONE permitted visual knob, taken from the dashboard profile. */
  readonly accent?: string;
  readonly scheme?: AdminColorScheme;
  readonly fontFamily?: string;
}

export const DEFAULT_ACCENT = '#0d9488';
const DEFAULT_FONT = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const LIGHT = {
  headerBackgroundColor: '#fbfcfd',
  headerTextColor: '#475569',
  backgroundColor: '#ffffff',
  oddRowBackgroundColor: '#ffffff',
  borderColor: '#eef0f4',
  rowHoverColor: '#f8fafc',
  foregroundColor: '#0b1220',
} as const;

// A real cold neutral ramp, not an inversion of the light theme — the mistake
// that makes most dark modes look muddy. Matches tokens.css's dark scheme.
const DARK = {
  headerBackgroundColor: '#141924',
  headerTextColor: '#9aa5b6',
  backgroundColor: '#11151e',
  oddRowBackgroundColor: '#11151e',
  borderColor: '#1e2431',
  rowHoverColor: '#151b26',
  foregroundColor: '#e8ecf3',
} as const;

/** Build the shared grid theme. Only accent, scheme and font are configurable. */
export function createAdminGridTheme(options: AdminGridThemeOptions = {}): Theme {
  const palette = options.scheme === 'dark' ? DARK : LIGHT;
  return themeQuartz.withParams({
    accentColor: options.accent ?? DEFAULT_ACCENT,
    fontFamily: options.fontFamily ?? DEFAULT_FONT,
    fontSize: 13.5,
    headerFontWeight: 600,
    headerFontSize: 12.5,
    borderRadius: 8,
    wrapperBorderRadius: 14,
    cellHorizontalPadding: 10,
    ...palette,
  });
}
