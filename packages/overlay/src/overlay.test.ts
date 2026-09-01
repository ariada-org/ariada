// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';

// The overlay engine is plain JavaScript, shared verbatim with the standalone
// overlay package so the two cannot drift apart.
import { createOverlay } from './overlay.js';

describe('overlay layer lifecycle', () => {
  it('leaves exactly one layer in the page however many times it is created', () => {
    // The page script is injected again on every scan, and each injection is a
    // fresh module instance with no knowledge of the previous layer. Before
    // this was handled, three scans left three layers: the older ones kept
    // their connector lines painted while the panel's switches only reached
    // the newest, so turning lines off appeared to do nothing.
    createOverlay(document);
    createOverlay(document);
    createOverlay(document);

    expect(document.querySelectorAll('[data-ariada-overlay]')).toHaveLength(1);
  });

  it('removes its layer on destroy', () => {
    const overlay = createOverlay(document);
    expect(document.querySelectorAll('[data-ariada-overlay]')).toHaveLength(1);

    overlay.destroy();

    expect(document.querySelectorAll('[data-ariada-overlay]')).toHaveLength(0);
  });
});
