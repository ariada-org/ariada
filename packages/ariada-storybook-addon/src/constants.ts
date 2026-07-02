// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

export const ADDON_ID = 'ariada/accessibility';
export const PANEL_ID = `${ADDON_ID}/panel`;
export const EVENTS = {
  scanRequested: `${ADDON_ID}/scan-requested`,
  scanCompleted: `${ADDON_ID}/scan-completed`,
} as const;
