// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/* eslint-disable @typescript-eslint/no-explicit-any */

import { exportPenpotSelection, type PenpotShape } from './shape-adapter.js';

declare const penpot:
  | {
      selection?: unknown[];
      ui: {
        open(title: string, path: string, options?: { width?: number; height?: number }): void;
        sendMessage(message: unknown): void;
        onMessage?: (message: unknown) => void;
      };
    }
  | undefined;

function readSelection(): PenpotShape[] {
  const selected = Array.isArray(penpot?.selection) ? penpot.selection : [];
  return selected.map((shape, index) => normalizeShape(shape, index));
}

function normalizeShape(value: unknown, index: number): PenpotShape {
  const shape = value && typeof value === 'object' ? (value as Record<string, any>) : {};
  const normalized: PenpotShape = {
    id: String(shape['id'] ?? `selection-${index + 1}`),
    name: typeof shape['name'] === 'string' ? shape['name'] : `Selection ${index + 1}`,
    type: typeof shape['type'] === 'string' ? shape['type'] : 'rect',
  };
  const optionalFields = {
    x: toNumber(shape['x']),
    y: toNumber(shape['y']),
    width: toNumber(shape['width']),
    height: toNumber(shape['height']),
  };
  if (optionalFields.x !== undefined) normalized.x = optionalFields.x;
  if (optionalFields.y !== undefined) normalized.y = optionalFields.y;
  if (optionalFields.width !== undefined) normalized.width = optionalFields.width;
  if (optionalFields.height !== undefined) normalized.height = optionalFields.height;
  if (typeof shape['characters'] === 'string') normalized.characters = shape['characters'];
  if (Array.isArray(shape['fills'])) normalized.fills = shape['fills'];
  if (Array.isArray(shape['strokes'])) normalized.strokes = shape['strokes'];
  if (typeof shape['role'] === 'string') normalized.role = shape['role'];
  if (Array.isArray(shape['children'])) {
    normalized.children = shape['children'].map((child: unknown, childIndex: number) =>
      normalizeShape(child, childIndex),
    );
  }
  return normalized;
}

function toNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function sendExport(): void {
  const selection = readSelection();
  const surface = exportPenpotSelection(selection);
  penpot?.ui.sendMessage({
    type: 'ariada-export',
    shapeCount: surface.shapeCount,
    checks: surface.checks,
    html: surface.html,
  });
}

penpot?.ui.open('Ariada Accessibility Evidence', './ui.html', { width: 520, height: 640 });
penpot?.ui.sendMessage({ type: 'ariada-ready' });
if (penpot?.ui) {
  penpot.ui.onMessage = (message: unknown) => {
    if (message && typeof message === 'object' && (message as { type?: unknown }).type === 'ariada-export-request') {
      sendExport();
    }
  };
}
