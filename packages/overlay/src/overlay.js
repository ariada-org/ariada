// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: Apache-2.0
//
// @ariada-org/overlay — a fully abstract in-page finding overlay. The engine
// only RESOLVES findings to live element rectangles and keeps them attached on
// scroll/resize; WHAT is drawn is a pluggable "painter" (boxes, connector lines,
// a flying mascot — Dracula, Thumbelina, anything). Painters are registered in a
// registry and loaded by id, so the visual is data/code you drop in, never
// hardcoded. Works in any page (content script, demo, DOM snapshot, proxy).

/**
 * @typedef {{selector:string, severity?:string, message?:string, rule?:string, wcag?:string[]}} Finding
 * @typedef {{finding:Finding, rect:{x:number,y:number,w:number,h:number}, i:number}} Anchor
 * @typedef {{ id:string, mount?:(layer:HTMLElement)=>void, paint:(anchors:Anchor[], layer:HTMLElement)=>void, clear?:(layer:HTMLElement)=>void }} Painter
 */

const REGISTRY = new Map();
/** Register a painter so it can be loaded by id — the plug point for any visual. */
export function registerPainter(painter) { REGISTRY.set(painter.id, painter); return painter; }
/**
 *
 */
export function getPainter(id) { return REGISTRY.get(id); }
/**
 *
 */
export function painterIds() { return [...REGISTRY.keys()]; }

/** Create an overlay bound to a document (the page, a snapshot iframe, etc.). */
export function createOverlay(doc = document) {
  // The page script is injected afresh on every scan, and each injection is a
  // new module instance that knows nothing of the previous one's layer. Left
  // alone, the old layers stay in the page with their lines still painted, and
  // the panel's switches — which only reach the newest instance — appear to do
  // nothing. Clearing them here is what the marker attribute is for.
  for (const stale of doc.querySelectorAll('[data-ariada-overlay]')) stale.remove();

  const layer = doc.createElement('div');
  layer.setAttribute('data-ariada-overlay', '');
  Object.assign(layer.style, {
    position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '2147483000',
  });
  doc.body.appendChild(layer);
  const view = doc.defaultView || window;

  let findings = [];
  let painter = null;
  // Per-paint options the panel controls live: which severities draw a
  // connector line, which individual findings have their line switched off,
  // and which finding is selected.
  //
  // `lineSeverities` is the set of severities whose lines are drawn. Absent
  // means none — off is off, including for the selected block, which is only
  // emphasised rather than exempted.
  let opts = { lineSeverities: [], disabled: [], focus: null };

  /** Why a finding could not be drawn on the page — the panel says this to the
   *  reader instead of leaving a block that silently points nowhere. */
  const NOT_DRAWN = {
    noSelector: 'no-selector',
    pageLevel: 'page-level',
    notFound: 'not-found',
    noBox: 'no-box',
  };

  function resolve() {
    const drawn = [];
    const undrawable = [];
    for (const [i, f] of findings.entries()) {
      if (!f.selector) { undrawable.push({ i, why: NOT_DRAWN.noSelector }); continue; }
      let el = null;
      try { el = doc.querySelector(f.selector); } catch { /* invalid selector */ }
      if (!el) { undrawable.push({ i, why: NOT_DRAWN.notFound }); continue; }
      // A finding about the page as a whole (':root', <html>, <body>) has no
      // particular element to point at: drawing it yields a rectangle over the
      // whole viewport, which reads as "all of this is broken". It keeps its
      // number so the page badges stay in step with the panel list.
      if (el === doc.documentElement || el === doc.body) { undrawable.push({ i, why: NOT_DRAWN.pageLevel }); continue; }
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) { undrawable.push({ i, why: NOT_DRAWN.noBox }); continue; }
      drawn.push({ finding: f, rect: { x: r.x, y: r.y, w: r.width, h: r.height }, i });
    }
    return { drawn, undrawable };
  }
  let raf = 0;
  function repaint() {
    if (!painter) return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => painter.paint(resolve().drawn, layer, opts));
  }
  const onMove = () => repaint();
  view.addEventListener('scroll', onMove, true);
  view.addEventListener('resize', onMove);

  return {
    /** show findings with a painter (by id or object) and optional draw options. */
    show(nextFindings, p, options) {
      findings = nextFindings || [];
      if (options) opts = { lineSeverities: [], disabled: [], focus: null, ...options };
      this.setPainter(p);
      // Tell the caller which findings actually landed on the page and why the
      // rest did not, so the panel can mark them rather than showing a number
      // that points at nothing.
      const { drawn, undrawable } = resolve();
      return { drawn: drawn.map((a) => a.i), undrawable };
    },
    /** update draw options live (severity switches, per-block off, selection). */
    setOptions(options) {
      opts = { lineSeverities: [], disabled: [], focus: null, ...options };
      repaint();
    },
    setPainter(p) {
      const next = typeof p === 'string' ? getPainter(p) : p;
      if (painter && painter.clear) painter.clear(layer);
      layer.innerHTML = '';
      painter = next || null;
      if (painter && painter.mount) painter.mount(layer);
      repaint();
    },
    focus(index) { if (painter && painter.focus) { painter.focus(index); repaint(); } },
    repaint,
    destroy() {
      if (painter && painter.clear) painter.clear(layer);
      view.removeEventListener('scroll', onMove, true);
      view.removeEventListener('resize', onMove);
      layer.remove();
    },
  };
}
