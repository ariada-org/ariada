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
  | { kind: 'capture_error'; message: string }
  | { kind: 'heal_result'; count: number; fixes: Array<{ rule: string; selector: string }> }
  | { kind: 'heal_error'; message: string }
  | { kind: 'highlight_request'; findings: Array<{ selector: string; severity?: string; message?: string; rule?: string }>; painter: string }
  | { kind: 'highlight_result'; count: number }
  | { kind: 'highlight_error'; message: string };

/** The marker the content script answers to when asked to capture its DOM. */
export const CAPTURE_REQUEST = 'ariada:capture-request' as const;

/**
 * The marker the content script answers to when asked to apply the tier-0
 * healed preview (the console's "open live in plugin" loop). Applying it a
 * second time toggles the fixes off (before/after).
 */
export const HEAL_REQUEST = 'ariada:heal-request' as const;
