// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: Apache-2.0
//
// What this controller is for, and therefore what is worth asserting.
//
// It draws the auditor's eye to each new finding WITHOUT fighting them. Almost
// everything here is a rule about when NOT to move the view, and those rules are
// the ones with consequences: a controller that scrolls the page while somebody
// is typing does not merely annoy them, it moves the caret out of sight and can
// lose what they were writing. For a screen-reader user it moves focus out from
// under them entirely.
//
// So the cases are mostly refusals — after a manual interaction, during an
// active text input, for an event with no anchor, for a highlight arriving while
// a focus request is still unhandled. The one case about following is the
// smallest part of the file, which is the right proportion.
//
// WHAT THIS DOES NOT HOLD, and it matters. The controller's state is declared
// with runes, and the reactivity that makes a template redraw when the target
// changes is not observable from here: replacing the rune with a plain variable
// leaves every case below green, because the getters still return the current
// value. What is held is the LOGIC — when the target changes and when it must
// not. Whether the room actually redraws belongs to the consuming
// application's browser suite, and saying so here is cheaper than someone
// later reading eighteen green cases as coverage of something they do not
// cover.

import { describe, expect, it } from 'vitest';

import { createFocusController, type AuditFocusEvent } from './focus-controller.svelte.ts';

const YAKOR = { selector: 'main > h1' };
const DRUGOY = { selector: 'footer a' };

function sobytie(type: string, anchor?: Record<string, unknown>): AuditFocusEvent {
  return anchor === undefined ? { event_type: type } : { event_type: type, anchor };
}

describe('following the audit', () => {
  it('starts out following, with nothing to look at yet', () => {
    const c = createFocusController();
    expect(c.mode).toBe('follow');
    expect(c.target).toBeNull();
  });

  it('scrolls to a finding the audit asked to show', () => {
    const c = createFocusController();
    c.onAuditEvent(sobytie('focus_requested', YAKOR));
    expect(c.target).toEqual({
      anchor: YAKOR,
      behavior: 'scroll_into_view',
      reason: 'new_finding',
    });
  });

  it('pulses gently for a highlight rather than scrolling', () => {
    const c = createFocusController();
    c.onAuditEvent(sobytie('highlight_added', YAKOR));
    expect(c.target).toMatchObject({ behavior: 'soft_pulse', reason: 'highlight' });
  });

  it('lets a later request replace an earlier one', () => {
    const c = createFocusController();
    c.onAuditEvent(sobytie('focus_requested', YAKOR));
    c.onAuditEvent(sobytie('focus_requested', DRUGOY));
    expect(c.target?.anchor).toBe(DRUGOY);
  });
});

describe('not taking the view away from the person using it', () => {
  it('stops following after any manual interaction', () => {
    // One scroll of their own is a statement of intent, and it holds until they
    // say otherwise.
    const c = createFocusController();
    c.onManualInteraction();
    expect(c.mode).toBe('soft');
    c.onAuditEvent(sobytie('focus_requested', YAKOR));
    expect(c.target).toBeNull();
  });

  it('stays stopped across many events, not just the next one', () => {
    const c = createFocusController();
    c.onManualInteraction();
    for (let i = 0; i < 5; i += 1) c.onAuditEvent(sobytie('focus_requested', YAKOR));
    expect(c.target).toBeNull();
  });

  it('never moves the view while a text input is active', () => {
    // The sharpest rule in the file. Scrolling while somebody types moves the
    // caret out of sight and can lose what they were writing; for a
    // screen-reader user it moves focus out from under them.
    let pechatayut = true;
    const c = createFocusController({ isTextInputActive: () => pechatayut });
    c.onAuditEvent(sobytie('focus_requested', YAKOR));
    expect(c.target).toBeNull();

    pechatayut = false;
    c.onAuditEvent(sobytie('focus_requested', YAKOR));
    expect(c.target).not.toBeNull();
  });

  it('asks about the input every time rather than once at the start', () => {
    // A controller that read the answer once would obey a stale one for the
    // whole session, which is the same defect in slower motion.
    const otvety = [false, true, false];
    let i = 0;
    const c = createFocusController({ isTextInputActive: () => otvety[i++] ?? false });
    c.onAuditEvent(sobytie('focus_requested', YAKOR)); // not typing → moves
    expect(c.target?.anchor).toBe(YAKOR);
    c.clearTarget();
    c.onAuditEvent(sobytie('focus_requested', DRUGOY)); // typing → stays put
    expect(c.target).toBeNull();
    c.onAuditEvent(sobytie('focus_requested', DRUGOY)); // stopped → moves
    expect(c.target?.anchor).toBe(DRUGOY);
  });

  it('works without being told anything about text inputs', () => {
    const c = createFocusController();
    c.onAuditEvent(sobytie('focus_requested', YAKOR));
    expect(c.target).not.toBeNull();
  });
});

describe('a highlight does not displace a request', () => {
  it('ignores a highlight while something is already being shown', () => {
    // A stream of highlights would otherwise walk over the finding the auditor
    // was sent to look at, before they had a chance to look at it.
    const c = createFocusController();
    c.onAuditEvent(sobytie('focus_requested', YAKOR));
    c.onAuditEvent(sobytie('highlight_added', DRUGOY));
    expect(c.target?.anchor).toBe(YAKOR);
  });

  it('takes a highlight once the previous target has been dealt with', () => {
    const c = createFocusController();
    c.onAuditEvent(sobytie('focus_requested', YAKOR));
    c.clearTarget();
    c.onAuditEvent(sobytie('highlight_added', DRUGOY));
    expect(c.target?.anchor).toBe(DRUGOY);
  });
});

describe('events it does nothing with', () => {
  it.each([
    ['a focus request with no anchor', sobytie('focus_requested')],
    ['a highlight with no anchor', sobytie('highlight_added')],
    ['an event type it does not know', sobytie('finding_added', YAKOR)],
  ])('ignores %s', (_name, event) => {
    const c = createFocusController();
    c.onAuditEvent(event);
    expect(c.target).toBeNull();
  });
});

describe('the controls the room offers', () => {
  it('resumes following on request, and follows again from then on', () => {
    const c = createFocusController();
    c.onManualInteraction();
    c.resumeFollow();
    expect(c.mode).toBe('follow');
    c.onAuditEvent(sobytie('focus_requested', YAKOR));
    expect(c.target).not.toBeNull();
  });

  it('pauses on request, exactly as a manual interaction would', () => {
    const c = createFocusController();
    c.pauseFollow();
    expect(c.mode).toBe('soft');
    c.onAuditEvent(sobytie('focus_requested', YAKOR));
    expect(c.target).toBeNull();
  });

  it('clears what it was showing without changing whether it follows', () => {
    const c = createFocusController();
    c.onAuditEvent(sobytie('focus_requested', YAKOR));
    c.clearTarget();
    expect(c.target).toBeNull();
    expect(c.mode).toBe('follow');
  });

  it('gives every room its own controller', () => {
    // Two rooms on one page would otherwise share a mode, and pausing one would
    // stop the other.
    const a = createFocusController();
    const b = createFocusController();
    a.onManualInteraction();
    expect(b.mode).toBe('follow');
  });
});
