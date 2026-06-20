// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import type { PropertySnapshot } from '@ariada-org/core-engine';

/**
 * Messages exchanged between the side panel and the content script (relayed by
 * the background service worker). A discriminated union on `kind` keeps the
 * routing exhaustively type-checked.
 */
export type ExtensionMessage =
  | { kind: 'request_capture'; tabId: number }
  | { kind: 'capture_result'; snapshot: PropertySnapshot }
  | { kind: 'capture_error'; message: string };

/** The marker the content script answers to when asked to capture its DOM. */
export const CAPTURE_REQUEST = 'ariada:capture-request' as const;

/**
 * The marker the on-page launcher button sends to ask the worker to open the
 * report surface. Sent in direct response to a click, so the worker still holds
 * a user gesture and can call chrome.sidePanel.open / chrome.windows.create.
 */
export const OPEN_PANEL_REQUEST = 'ariada:open-panel' as const;
