// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/histoire.js` and `dist/histoire.d.ts`. The source this
// was built from was never committed; the compiled output is `tsc` with the
// types stripped, so the shape comes back from the declaration file and the body
// is the compiled one. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.
//
// This runs inside the story page and answers one question the scanner cannot
// answer for itself: has the story finished rendering. It marks the document
// with an attribute and, when it is in a frame, tells the page around it.
//
// TWO ANIMATION FRAMES, NOT ONE, AND THAT IS THE WHOLE TRICK. The first returns
// after the current paint is scheduled; the second returns after it has
// happened. Marking ready on the first would announce a story that is laid out
// but not yet drawn.
//
// The mark is emitted once, whichever of the three paths gets there first — the
// document finishing loading, the frames elapsing, or the framework's own
// rendered event. A second mark would tell a waiting scanner that a new story is
// ready when it is the same one.
//
// The message names its own origin rather than a wildcard, so a story in a frame
// speaks only to a page it shares an origin with.

const READY_ATTRIBUTE = 'data-ariada-storyloaded';

export function installHistoireAriada(): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  let emitted = false;
  const markReady = () => {
    if (emitted) return;
    emitted = true;
    document.documentElement.setAttribute(READY_ATTRIBUTE, 'true');
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'ariada:story-ready', href: window.location.href }, window.location.origin);
    }
  };
  const afterRender = () => {
    requestAnimationFrame(() => requestAnimationFrame(markReady));
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', afterRender, { once: true });
  }
  else {
    afterRender();
  }
  window.addEventListener('ariada:story-rendered', markReady, { once: true });
}

export default installHistoireAriada;
