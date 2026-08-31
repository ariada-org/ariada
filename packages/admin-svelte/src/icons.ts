// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: Apache-2.0
//
// Inline line icons. Row actions are icon buttons, not text buttons: the text
// form reserves ~46px per action and starves the data columns (the measured
// defect of the React build), while an icon needs 31px. Inline SVG keeps the
// package dependency-free — no icon library.

/** action key -> the inner path markup of a 24x24 stroke icon. */
export const ACTION_ICON_PATHS: Readonly<Record<string, string>> = Object.freeze({
  stop_trade: '<circle cx="12" cy="12" r="9"/><line x1="9.5" y1="15" x2="9.5" y2="9"/><line x1="14.5" y1="15" x2="14.5" y2="9"/>',
  hold: '<rect x="6" y="4.5" width="4" height="15" rx="1"/><rect x="14" y="4.5" width="4" height="15" rx="1"/>',
  pause_placement: '<rect x="6" y="4.5" width="4" height="15" rx="1"/><rect x="14" y="4.5" width="4" height="15" rx="1"/>',
  ban: '<circle cx="12" cy="12" r="9"/><line x1="5.6" y1="5.6" x2="18.4" y2="18.4"/>',
  disable: '<circle cx="12" cy="12" r="9"/><line x1="5.6" y1="5.6" x2="18.4" y2="18.4"/>',
  approve: '<path d="M4 12.5 9.5 18 20 6.5"/>',
  reject: '<path d="M18 6 6 18M6 6l12 12"/>',
  rescan: '<path d="M20 11a8 8 0 1 0-2.3 6"/><path d="M20 5v6h-6"/>',
  retry: '<path d="M4 13a8 8 0 1 1 2.3 5.6"/><path d="M4 19v-6h6"/>',
  promote: '<path d="M4 17 10 11l4 4 6-7"/><path d="M14 4h6v6"/>',
  create_task: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  scan: '<circle cx="11" cy="11" r="6"/><line x1="15.5" y1="15.5" x2="20" y2="20"/>',
  report: '<path d="M6 3h8l4 4v14H6z"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="15" y2="16"/>',
  plugin: '<path d="M14 4h6v6"/><line x1="20" y1="4" x2="11" y2="13"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
  remediate: '<path d="M4 20 14 10"/><path d="M15 3v4M13 5h4M19 9v3M17.5 10.5h3"/>',
});

const FALLBACK_ICON = '<circle cx="12" cy="12" r="9"/>';
const DEFAULT_ICON_SIZE = 14;

/**
 * A 24x24 stroke-icon SVG string for an action key (falls back to a dot).
 *
 * Both inputs are treated as coming from outside, because they do: a consumer
 * of this package passes them, and the result goes into markup. `size` is put
 * through a number, so a string carrying an attribute of its own cannot close
 * the tag and open another; and the key is looked up as an own property, so
 * `constructor` and its neighbours on the prototype cannot answer with a
 * function that would then be stringified into the drawing.
 */
export function actionIconSvg(key: string, size: number = DEFAULT_ICON_SIZE): string {
  const paths = Object.hasOwn(ACTION_ICON_PATHS, key) ? ACTION_ICON_PATHS[key] : FALLBACK_ICON;
  const px = Number.isFinite(Number(size))
    ? Math.min(512, Math.max(1, Math.round(Number(size))))
    : DEFAULT_ICON_SIZE;
  return `<svg width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}
