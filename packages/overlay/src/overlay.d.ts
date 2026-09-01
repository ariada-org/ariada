// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Types for the vendored pluggable overlay (source is the @ariada-org/overlay
// package). Kept minimal — only what the content script uses.

/** Why a finding could not be drawn: it has no selector, the selector matched
 *  nothing, it describes the page as a whole, or the element has no box. */
export interface UndrawableFinding {
  i: number;
  why: 'no-selector' | 'not-found' | 'page-level' | 'no-box';
}

/** What the overlay managed to place, so the caller can mark the rest. */
export interface PlacementResult {
  drawn: number[];
  undrawable: UndrawableFinding[];
}

export interface OverlayInstance {
  show(findings: unknown[], painterId: string, options?: unknown): PlacementResult;
  setOptions(options: unknown): void;
  focus(index: number): void;
  repaint(): void;
  destroy(): void;
}

export interface Painter {
  id: string;
  label?: string;
  paint(...args: unknown[]): unknown;
}

export function registerPainter(painter: Painter): Painter;
export function getPainter(id: string): Painter | undefined;
export function painterIds(): string[];
export function createOverlay(doc?: Document): OverlayInstance;
