// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: Apache-2.0
//
// The column header has two controls, and both used to answer only to a mouse.
//
// Sorting was a `span` with a click handler: no focus, no Enter, no Space. The
// help marker was a `span` with `role="note"` — announced as static text —
// opening on `mouseenter` and closing on `mouseleave`, so its content had no
// keyboard path at all. That is the first requirement in the standard we
// measure other people against, and it was failing in our own operator surface.
//
// The suite runs without a DOM (`environment: 'node'`), and adding one means
// touching the shared lockfile. So these tests drive the renderer against a
// small stand-in document instead — deliberately: a guard that read the source
// for the word "button" would pass on a button that opens nothing.

import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import { ADMIN_CELL_RENDERERS } from './renderers';

/** the smallest element that the renderer actually uses. */
interface FakeElement {
  tagName: string;
  type?: string;
  disabled?: boolean;
  className: string;
  textContent: string;
  title?: string;
  id: string;
  innerHTML: string;
  style: Record<string, string>;
  attrs: Map<string, string>;
  listeners: Map<string, ((event: unknown) => void)[]>;
  children: FakeElement[];
  classList: { add(name: string): void };
  setAttribute(name: string, value: string): void;
  getAttribute(name: string): string | null;
  removeAttribute(name: string): void;
  addEventListener(name: string, fn: (event: unknown) => void): void;
  append(...nodes: FakeElement[]): void;
  remove(): void;
  getBoundingClientRect(): { left: number; bottom: number };
  fire(name: string, event?: unknown): void;
}

function element(tagName: string): FakeElement {
  const el: FakeElement = {
    tagName: tagName.toUpperCase(),
    className: '',
    textContent: '',
    id: '',
    innerHTML: '',
    style: {},
    attrs: new Map(),
    listeners: new Map(),
    children: [],
    classList: {
      add(name) {
        el.className = `${el.className} ${name}`.trim();
      },
    },
    setAttribute(name, value) {
      el.attrs.set(name, value);
    },
    getAttribute(name) {
      return el.attrs.get(name) ?? null;
    },
    removeAttribute(name) {
      el.attrs.delete(name);
    },
    addEventListener(name, fn) {
      const list = el.listeners.get(name) ?? [];
      list.push(fn);
      el.listeners.set(name, list);
    },
    append(...nodes) {
      el.children.push(...nodes);
    },
    remove() {
      body.children = body.children.filter((c) => c !== el);
    },
    getBoundingClientRect() {
      return { left: 10, bottom: 20 };
    },
    fire(name, event = {}) {
      for (const fn of el.listeners.get(name) ?? []) fn(event);
    },
  };
  return el;
}

let body: FakeElement;
let ranee: { document?: unknown; window?: unknown };

beforeEach(() => {
  body = element('body');
  ranee = {
    document: (globalThis as Record<string, unknown>).document,
    window: (globalThis as Record<string, unknown>).window,
  };
  (globalThis as Record<string, unknown>).document = { createElement: element, body };
  (globalThis as Record<string, unknown>).window = { innerWidth: 1200 };
});

afterEach(() => {
  (globalThis as Record<string, unknown>).document = ranee.document;
  (globalThis as Record<string, unknown>).window = ranee.window;
});

function header(enableSorting = true) {
  // Through `unknown`: the renderer is declared against the grid library's own
  // component type, and the stand-in element below is deliberately not that
  // library's element — the suite runs without a DOM on purpose. Two shapes
  // that describe the same object without a shared declaration do not overlap,
  // and saying so here is better than teaching the renderer about the fake.
  const instance = new (ADMIN_CELL_RENDERERS.header as unknown as new () => {
    init(params: unknown): void;
    getGui(): FakeElement;
    destroy(): void;
  })();
  instance.init({
    displayName: 'Owed ratio',
    columnKey: 'owedRatio',
    enableSorting,
    progressSort: () => {},
    help: { description: 'What partners owe us.', formula: 'accepted / owed', wikiSlug: 'owed-ratio' },
  });
  const gui = instance.getGui();
  // Thrown rather than handed back as possibly-absent. The renderer's contract
  // is that a header has both controls; indexing says otherwise only because
  // indexing always does, and passing that uncertainty to eighteen assertions
  // would have each of them say "possibly undefined" about something whose
  // absence is the very defect they exist to catch. If it ever is absent, the
  // failure names it here.
  const [title, info] = gui.children;
  if (title === undefined || info === undefined) {
    throw new Error('the header rendered without its sort control or its help marker');
  }
  return { instance, gui, title, info };
}

describe('the column header answers to a keyboard', () => {
  it('sorts through a button rather than a span with a click handler', () => {
    const { title } = header(true);
    expect(title.tagName).toBe('BUTTON');
    expect(title.type).toBe('button');
  });

  it('leaves an unsortable heading as plain text', () => {
    // A button that does nothing is its own defect: it takes focus and rewards
    // it with silence.
    const { title } = header(false);
    expect(title.tagName).toBe('SPAN');
  });

  it('offers the help marker as a control, not as static text', () => {
    const { info } = header();
    expect(info.tagName).toBe('BUTTON');
    expect(info.getAttribute('role')).toBeNull();
    expect(info.getAttribute('aria-label')).toContain('partners owe us');
    expect(info.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens the help on focus, the way it opens on hover', () => {
    const { info } = header();
    expect(body.children).toHaveLength(0);
    info.fire('focus');
    expect(body.children).toHaveLength(1);
    expect(info.getAttribute('aria-expanded')).toBe('true');
    expect(info.getAttribute('aria-describedby')).toBe(body.children[0]?.id);
  });

  it('dismisses the help on Escape without moving focus away', () => {
    const { info } = header();
    info.fire('focus');
    expect(body.children).toHaveLength(1);
    info.fire('keydown', { key: 'Escape', stopPropagation: () => {} });
    expect(body.children).toHaveLength(0);
    expect(info.getAttribute('aria-expanded')).toBe('false');
    expect(info.getAttribute('aria-describedby')).toBeNull();
  });

  it('ignores other keys, so typing elsewhere does not close it', () => {
    const { info } = header();
    info.fire('focus');
    info.fire('keydown', { key: 'a', stopPropagation: () => {} });
    expect(body.children).toHaveLength(1);
  });

  it('toggles on click instead of only stopping the event', () => {
    const { info } = header();
    info.fire('click', { stopPropagation: () => {} });
    expect(body.children).toHaveLength(1);
    info.fire('click', { stopPropagation: () => {} });
    expect(body.children).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// The row actions, held for the first time.
//
// They were correct and nothing checked them: replacing one with a `span` left
// every case in this file green. That is the position the two header controls
// were in before somebody read them — correct, and one careless edit from not
// being — and the reason nothing existed is the ordinary one: a guard follows
// the defect rather than the risk, and these had never been broken.
//
// The last case is the one markup alone cannot give. A control can be a real
// button, carry a name, and still be wired to nothing; what makes it a control
// is that pressing it reaches the confirm.
// ---------------------------------------------------------------------------

function actions(row: Record<string, unknown>, requestConfirm?: (r: unknown) => void) {
  const instance = new (ADMIN_CELL_RENDERERS.actions as unknown as new () => {
    init(params: unknown): void;
    getGui(): FakeElement;
  })();
  instance.init({
    data: row,
    rowActions: [
      { key: 'approve', label: 'Approve', confirm: { reasonRequired: false }, endpoint: '/a' },
      { key: 'ban', label: 'Ban', danger: true, confirm: { reasonRequired: true }, endpoint: '/b' },
    ],
    requestConfirm,
  });
  return instance.getGui();
}

describe('the row actions are controls, not shapes that look like them', () => {
  it('renders each action as a real button with a type', () => {
    const gui = actions({ id: '1', status: 'pending' });
    expect(gui.children).toHaveLength(2);
    for (const child of gui.children) {
      expect(child.tagName).toBe('BUTTON');
      expect(child.type).toBe('button');
    }
  });

  it('gives each an accessible name, because the label is an icon', () => {
    // Without this the control is announced as "button" and nothing else, which
    // is the same silence as an unmarked one wearing a different coat.
    const gui = actions({ id: '1', status: 'pending' });
    expect(gui.children[0]?.getAttribute('aria-label')).toBe('Approve');
    expect(gui.children[1]?.getAttribute('aria-label')).toBe('Ban');
  });

  it('disables the action a row has already had', () => {
    const gui = actions({ id: '1', status: 'approved' });
    expect(gui.children[0]?.disabled).toBe(true);
    expect(gui.children[1]?.disabled).toBe(false);
  });

  it('marks the destructive one as such', () => {
    const gui = actions({ id: '1', status: 'pending' });
    expect(gui.children[1]?.className).toContain('adm-danger');
    expect(gui.children[0]?.className).not.toContain('adm-danger');
  });

  it('reaches the confirm when pressed, with the row and the action', () => {
    // The part a check on the markup would miss entirely.
    const zaprosy: { row: unknown; action: { key: string } }[] = [];
    const row = { id: '1', status: 'pending' };
    const gui = actions(row, (r) => zaprosy.push(r as { row: unknown; action: { key: string } }));
    gui.children[1]?.fire('click', { stopPropagation() {} });
    expect(zaprosy).toHaveLength(1);
    expect(zaprosy[0]?.action.key).toBe('ban');
    expect(zaprosy[0]?.row).toBe(row);
  });

  it('renders nothing at all for a row that is not there', () => {
    const gui = actions(undefined as unknown as Record<string, unknown>);
    expect(gui.children).toHaveLength(0);
  });
});
