// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { beforeEach, describe, expect, it } from 'vitest';

import { getPainter } from './overlay.js';
import { sevColor, boxStyle, DEFAULT_COLOUR } from './painters.js';

interface Anchor {
  finding: { severity: string };
  rect: { x: number; y: number; w: number; h: number };
  i: number;
}

const anchor = (i: number, severity = 'serious'): Anchor => ({
  finding: { severity },
  rect: { x: 10 * i, y: 10 * i, w: 40, h: 20 },
  i,
});

const paintInto = (anchors: Anchor[], opts: Record<string, unknown>): HTMLElement => {
  const layer = document.createElement('div');
  document.body.appendChild(layer);
  const painter = getPainter('numbered') as unknown as {
    paint: (a: Anchor[], l: HTMLElement, o: unknown) => void;
  };
  // A line is only drawn for a row the panel can see, so unless a test is
  // about that specifically, assume every row is on screen.
  const onScreen = Object.fromEntries(anchors.map((a) => [a.i, 100 + a.i * 40]));
  painter.paint(anchors, layer, { rowY: onScreen, ...opts });
  return layer;
};

const lineCount = (layer: HTMLElement): number => layer.querySelectorAll('path').length;
const dimmedCount = (layer: HTMLElement): number =>
  [...layer.querySelectorAll('div')].filter((el) => el.style.opacity === '0.25').length;

describe('numbered painter — when lines are drawn', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it('draws a line only for a severity that is switched on', () => {
    const anchors = [anchor(0, 'critical'), anchor(1, 'minor')];
    const layer = paintInto(anchors, { lineSeverities: ['critical'], disabled: [], focus: null });
    expect(lineCount(layer)).toBe(1);
  });

  it('draws nothing when every severity is switched off', () => {
    const layer = paintInto([anchor(0), anchor(1)], {
      lineSeverities: [],
      disabled: [],
      focus: null,
    });
    expect(lineCount(layer)).toBe(0);
  });

  it('keeps a selected block’s line off when its severity is off', () => {
    // Selecting a block emphasises it. It does not bring back a line the reader
    // has switched off — off means off.
    const layer = paintInto([anchor(0)], { lineSeverities: [], disabled: [], focus: 0 });
    expect(lineCount(layer)).toBe(0);
  });

  it('respects a single block’s own switch', () => {
    const layer = paintInto([anchor(0), anchor(1)], {
      lineSeverities: ['serious'],
      disabled: [1],
      focus: null,
    });
    expect(lineCount(layer)).toBe(1);
  });

  it('ignores a selection that matches nothing drawn', () => {
    // A page-level finding is listed but never drawn. Selecting it used to dim
    // every block on the page to emphasise one that was not there.
    const layer = paintInto([anchor(0), anchor(1)], {
      lineSeverities: ['serious'],
      disabled: [],
      focus: 7,
    });
    expect(dimmedCount(layer)).toBe(0);
    expect(lineCount(layer)).toBe(2);
  });
});

describe('numbered painter — where a line leaves the page', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it('leaves level with the row the panel reported', () => {
    const layer = paintInto([anchor(3)], {
      lineSeverities: ['serious'],
      disabled: [],
      focus: null,
      rowY: { 3: 412 },
    });
    const path = layer.querySelector('path');
    // The curve starts at the page's right edge, at the row's height.
    expect(path?.getAttribute('d')).toMatch(/^M \d+ 412 /);
  });

  it('draws no line at all when the row is scrolled out of the list', () => {
    // A line says "this row belongs to that element". With the row scrolled
    // away there is no row to say it about: the line became a stroke running
    // to the edge of the page toward nothing, which reads as a connection to
    // something just out of frame. The box and the number still mark the
    // element — the line is the part that would be lying.
    const layer = paintInto([anchor(3)], {
      lineSeverities: ['serious'],
      disabled: [],
      focus: null,
      rowY: {},
    });
    expect(lineCount(layer)).toBe(0);
    // The block itself is still drawn.
    expect(layer.querySelectorAll('div').length).toBeGreaterThan(0);
  });

  it('draws lines only for the rows that are on screen', () => {
    const layer = paintInto([anchor(0), anchor(1), anchor(2)], {
      lineSeverities: ['serious'],
      disabled: [],
      focus: null,
      rowY: { 0: 120, 2: 400 },
    });
    expect(lineCount(layer)).toBe(2);
  });
});

describe('the visual contract the report also uses', () => {
  it('gives each severity its own colour and falls back for unknown ones', () => {
    expect(sevColor('critical')).toBe('#e5484d');
    expect(sevColor('serious')).toBe('#ffb224');
    expect(sevColor('moderate')).toBe('#0ea5e9');
    expect(sevColor('nonsense')).toBe(DEFAULT_COLOUR);
  });

  it('describes the same outline the painter draws', () => {
    const style = boxStyle('critical');
    expect(style.border).toBe('2px solid #e5484d');
    expect(style.borderRadius).toBe('3px');
  });
});
