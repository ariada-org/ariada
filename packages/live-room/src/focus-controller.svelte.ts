// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: Apache-2.0
//
// Live-focus controller — ported from stroyka's documentFocusController (React
// hook → Svelte 5 runes). It coordinates the "live focus" that draws the eye to
// each new finding's location in the subject WITHOUT fighting the user: after
// the first manual scroll/click/edit it downgrades from `follow` to `soft`, and
// it never steals an active text input. The reusable heart of the Live Room.

export type FocusMode = 'follow' | 'soft';

/** Where a finding lives in the subject. For a document: a page + rect. For a
 *  web page: a CSS selector / bounding box. Kept opaque so any auditor can use it. */
export interface FocusAnchor {
  readonly [k: string]: unknown;
}

export interface FocusTarget {
  anchor: FocusAnchor;
  behavior: 'scroll_into_view' | 'soft_pulse' | 'pin_until_next_action';
  reason: string;
}

export interface AuditFocusEvent {
  event_type: 'focus_requested' | 'highlight_added' | string;
  anchor?: FocusAnchor;
}

/** Create a live-focus controller. `isTextInputActive` lets the host protect an
 *  active editor from being scrolled away. Read `.mode`/`.target` in a template
 *  and they react. */
export function createFocusController(opts?: { isTextInputActive?: () => boolean }) {
  let mode = $state<FocusMode>('follow');
  let target = $state<FocusTarget | null>(null);

  function onAuditEvent(event: AuditFocusEvent): void {
    if (mode !== 'follow') return;
    if (opts?.isTextInputActive?.()) return; // never hijack active input
    if (event.event_type === 'focus_requested' && event.anchor) {
      target = { anchor: event.anchor, behavior: 'scroll_into_view', reason: 'new_finding' };
    } else if (event.event_type === 'highlight_added' && event.anchor && target === null) {
      target = { anchor: event.anchor, behavior: 'soft_pulse', reason: 'highlight' };
    }
  }

  return {
    get mode() { return mode; },
    get target() { return target; },
    /** call for every focus_requested / highlight_added audit event */
    onAuditEvent,
    /** call on any manual scroll/click/edit — downgrades to soft */
    onManualInteraction() { mode = 'soft'; },
    /** the "follow the audit" button */
    resumeFollow() { mode = 'follow'; },
    pauseFollow() { mode = 'soft'; },
    /** clear the current target (e.g. after the connector has been drawn) */
    clearTarget() { target = null; },
  };
}

export type FocusController = ReturnType<typeof createFocusController>;
