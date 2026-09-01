// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: Apache-2.0
//
// Built-in painters for @ariada-org/overlay. Each is a pluggable visual over the
// SAME resolved anchors — drop in your own to make anything fly. Registering a
// painter is the whole extension point: box outlines, connector lines to blocks,
// or a mascot (Dracula, Thumbelina, …) that flies element to element.
import { registerPainter } from './overlay.js';

// Exported because two things draw these findings: the overlay, live on the
// page, and the report, as a static file. They must agree, and the only way to
// be sure is for there to be one definition.
export const SEVERITY_COLOUR = { critical: '#e5484d', serious: '#ffb224', moderate: '#0ea5e9', minor: '#0ea5e9' };
export const DEFAULT_COLOUR = '#58a6ff';
export const sevColor = (s) => SEVERITY_COLOUR[s] || DEFAULT_COLOUR;

/** The outline the overlay draws, as plain style properties, so a static
 *  renderer can emit the same box without running a painter. */
export const boxStyle = (severity) => ({
  border: `2px solid ${sevColor(severity)}`,
  borderRadius: '3px',
  boxShadow: '0 0 0 1px rgba(0,0,0,.25)',
});
const NS = 'http://www.w3.org/2000/svg';
const mk = (tag, attrs) => {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) {
    e.setAttribute(k, attrs[k]);
  }
  return e;
};
/** hex (#rrggbb) → rgba string with the given alpha. */
const withAlpha = (hex, a) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

/** Outlined boxes on each failing element, coloured by severity. */
export const boxPainter = registerPainter({
  id: 'box',
  label: 'Boxes',
  paint(anchors, layer) {
    layer.innerHTML = '';
    for (const a of anchors) {
      const b = document.createElement('div');
      Object.assign(b.style, {
        position: 'fixed', left: `${a.rect.x}px`, top: `${a.rect.y}px`, width: `${a.rect.w}px`, height: `${a.rect.h}px`,
        border: `2px solid ${sevColor(a.finding.severity)}`, borderRadius: '3px', boxShadow: '0 0 0 1px rgba(0,0,0,.25)',
      });
      layer.appendChild(b);
    }
  },
});

/** Outlined boxes PLUS a numbered badge on each element, so the number on the
 *  page matches the numbered row in the panel's findings list — correspondence
 *  without a single cross-page line ("no stroyka"). Coloured by severity. */
export const numberedPainter = registerPainter({
  id: 'numbered',
  label: 'Numbered blocks',
  paint(anchors, layer, opts = {}) {
    layer.innerHTML = '';
    // One SVG under the badges carries all connector lines.
    const svg = mk('svg', {}); Object.assign(svg.style, { position: 'fixed', inset: '0', width: '100%', height: '100%' });
    layer.appendChild(svg);
    // A selection that matches nothing drawn is no selection. Honouring it
    // would dim every block on the page to emphasise one that is not there.
    const focus = anchors.some((a) => a.i === opts.focus) ? opts.focus : null;
    for (const a of anchors) {
      const state = blockState(a, { ...opts, focus });
      if (state.drawLine) drawConnector(svg, a, state);
      layer.appendChild(drawBox(a, state));
      layer.appendChild(drawBadge(a, state));
    }
  },
});

/** How one block is shown: its colour, whether it is the selected one, whether
 *  the selection is elsewhere (so it dims), and whether its line is drawn. */
function blockState(a, opts) {
  const focus = opts.focus ?? null;
  const isFocus = focus === a.i;
  const severity = a.finding.severity || 'unknown';
  const enabled = new Set(opts.lineSeverities || []);
  // Where this finding's row sits in the panel, as the panel measured it.
  // Absent when the row is scrolled out of the list.
  const rowY = opts.rowY?.[a.i];
  return {
    colour: sevColor(a.finding.severity),
    isFocus,
    dimmed: focus != null && !isFocus,
    rowY,
    // A line is drawn when its severity is switched on, this block's own
    // switch has not turned it off, AND its row is actually on screen.
    //
    // A line says "this row belongs to that element". With the row scrolled
    // away there is no row to say it about, and the line becomes a stroke
    // running off the edge of the page toward nothing — which reads as a
    // connection to something just out of frame. The box and the number still
    // mark the element; the line is the part that would be lying.
    //
    // Selecting a block emphasises it; it does not bring back a line the
    // reader has switched off — off means off.
    drawLine:
      typeof rowY === 'number' &&
      enabled.has(severity) &&
      !new Set(opts.disabled || []).has(a.i),
  };
}

function drawConnector(svg, a, { colour, isFocus, dimmed, rowY }) {
  // The line leaves the page at its right edge, level with the panel row it
  // belongs to, so it reads as continuing into that row.
  //
  // The overlay lives inside the page and cannot draw into the panel — that is
  // a separate browser surface. Where the line *leaves* is therefore all we
  // control, and it has to be aimed. It used to be placed by the formula
  // `80 + index * 22`, which assumed every row was twenty-two pixels tall and
  // that the list never scrolled. Neither holds: rows grow with their text,
  // and the list scrolls. So the lines ended at arbitrary heights and pointed
  // at nothing. The panel measures its own rows and sends their positions.
  const railX = window.innerWidth - 2;
  const ex = a.rect.x + a.rect.w, ey = a.rect.y + a.rect.h / 2;
  const cy = typeof rowY === 'number' ? rowY : ey;
  svg.appendChild(mk('path', {
    d: `M ${railX} ${cy} C ${railX - 140} ${cy}, ${ex + 120} ${ey}, ${ex} ${ey}`,
    fill: 'none', stroke: colour, 'stroke-width': isFocus ? '3' : '1.6',
    opacity: dimmed ? '0.12' : isFocus ? '1' : '0.7',
  }));
  svg.appendChild(mk('circle', { cx: ex, cy: ey, r: isFocus ? '5' : '3.5', fill: colour, opacity: dimmed ? '0.2' : '1' }));
}

function drawBox(a, { colour, isFocus, dimmed }) {
  const box = document.createElement('div');
  Object.assign(box.style, {
    position: 'fixed', left: `${a.rect.x}px`, top: `${a.rect.y}px`, width: `${a.rect.w}px`, height: `${a.rect.h}px`,
    border: `${isFocus ? 3 : 2}px solid ${colour}`, borderRadius: '3px', boxShadow: '0 0 0 1px rgba(0,0,0,.25)',
    background: isFocus ? withAlpha(colour, 0.1) : 'transparent', opacity: dimmed ? '0.25' : '1',
  });
  return box;
}

function drawBadge(a, { colour, isFocus, dimmed }) {
  const badge = document.createElement('div');
  badge.textContent = String(a.i + 1);
  Object.assign(badge.style, {
    position: 'fixed', left: `${a.rect.x - 11}px`, top: `${a.rect.y - 11}px`,
    minWidth: '22px', height: '22px', padding: '0 5px', boxSizing: 'border-box',
    background: colour, color: '#fff', font: '700 12px/22px system-ui,sans-serif', textAlign: 'center',
    borderRadius: '11px', boxShadow: '0 1px 4px rgba(0,0,0,.4)',
    opacity: dimmed ? '0.3' : '1', transform: isFocus ? 'scale(1.2)' : 'none', transformOrigin: 'center',
  });
  return badge;
}

/** Connector LINES from a right-edge rail to each block (+ box + dot). */
export const linePainter = registerPainter({
  id: 'line',
  label: 'Lines to blocks',
  paint(anchors, layer) {
    layer.innerHTML = '';
    const svg = mk('svg', {}); Object.assign(svg.style, { position: 'fixed', inset: '0', width: '100%', height: '100%' });
    const railX = window.innerWidth - 12;
    for (const [k, a] of anchors.entries()) {
      const c = sevColor(a.finding.severity);
      const cy = 64 + k * 24;
      const ex = a.rect.x + a.rect.w, ey = a.rect.y + a.rect.h / 2;
      svg.appendChild(mk('path', { d: `M ${railX} ${cy} C ${railX - 130} ${cy}, ${ex + 120} ${ey}, ${ex} ${ey}`, fill: 'none', stroke: c, 'stroke-width': '2', opacity: '.9' }));
      svg.appendChild(mk('rect', { x: a.rect.x, y: a.rect.y, width: a.rect.w, height: a.rect.h, fill: 'none', stroke: c, 'stroke-width': '2', rx: '3', opacity: '.6' }));
      svg.appendChild(mk('circle', { cx: ex, cy: ey, r: '4', fill: c }));
    }
    layer.appendChild(svg);
  },
});

/** A MASCOT that flies to the focused finding — the glyph is a parameter, so it
 *  can be Dracula, Thumbelina, or any future character. Fully abstract. */
export function makeMascotPainter({ id = 'mascot', label = 'Mascot', glyph = '🧛' } = {}) {
  let focusIdx = 0;
  return registerPainter({
    id, label, glyph,
    focus(i) { focusIdx = i; },
    paint(anchors, layer) {
      layer.innerHTML = '';
      if (!anchors.length) return;
      const a = anchors[Math.min(focusIdx, anchors.length - 1)];
      const c = sevColor(a.finding.severity);
      const svg = mk('svg', {}); Object.assign(svg.style, { position: 'fixed', inset: '0', width: '100%', height: '100%' });
      svg.appendChild(mk('rect', { x: a.rect.x, y: a.rect.y, width: a.rect.w, height: a.rect.h, fill: 'rgba(229,72,77,.12)', stroke: c, 'stroke-width': '3', rx: '4' }));
      layer.appendChild(svg);
      const m = document.createElement('div');
      m.textContent = glyph;
      Object.assign(m.style, {
        position: 'fixed', left: `${a.rect.x + a.rect.w / 2 - 18}px`, top: `${a.rect.y - 44}px`, fontSize: '34px',
        transition: 'left .55s cubic-bezier(.16,1,.3,1), top .55s cubic-bezier(.16,1,.3,1)',
        filter: 'drop-shadow(0 5px 9px rgba(0,0,0,.45))',
      });
      layer.appendChild(m);
    },
  });
}

// Ship two ready mascots to prove the abstraction: a vampire and a fairy.
export const draculaPainter = makeMascotPainter({ id: 'dracula', label: 'Dracula', glyph: '🧛' });
export const thumbelinaPainter = makeMascotPainter({ id: 'thumbelina', label: 'Thumbelina', glyph: '🧚' });
