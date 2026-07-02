// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/* eslint-disable jsdoc/require-jsdoc */

export interface PenpotColor {
  color?: string;
  opacity?: number;
}

export interface PenpotShape {
  id: string;
  name?: string;
  type: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  characters?: string;
  fills?: PenpotColor[] | null;
  strokes?: PenpotColor[] | null;
  children?: PenpotShape[];
  role?: string;
}

export interface DesignCheck {
  shapeId: string;
  shapeName: string;
  ruleId: 'penpot-contrast-preview' | 'penpot-target-size-preview';
  severity: 'minor' | 'moderate' | 'serious';
  status: 'pass' | 'fail';
  message: string;
  value: string;
}

export interface ExportedPenpotSurface {
  html: string;
  checks: DesignCheck[];
  shapeCount: number;
}

const MIN_TARGET_SIZE = 24;
const DEFAULT_FOREGROUND = '#1f2937';
const DEFAULT_BACKGROUND = '#ffffff';

export function exportPenpotSelection(shapes: readonly PenpotShape[]): ExportedPenpotSurface {
  const flatShapes = flattenShapes(shapes);
  const checks = flatShapes.flatMap((shape) => evaluateShape(shape));
  const html = renderHtml(flatShapes, checks);
  return { html, checks, shapeCount: flatShapes.length };
}

export function flattenShapes(shapes: readonly PenpotShape[]): PenpotShape[] {
  const out: PenpotShape[] = [];
  for (const shape of shapes) {
    out.push(shape);
    if (shape.children && shape.children.length > 0) {
      out.push(...flattenShapes(shape.children));
    }
  }
  return out;
}

export function evaluateShape(shape: PenpotShape): DesignCheck[] {
  const checks: DesignCheck[] = [];
  if (isTextShape(shape)) {
    const foreground = firstColor(shape.fills, DEFAULT_FOREGROUND);
    const background = nearestBackground(shape);
    const ratio = contrastRatio(foreground, background);
    checks.push({
      shapeId: shape.id,
      shapeName: shape.name ?? shape.id,
      ruleId: 'penpot-contrast-preview',
      severity: ratio < 3 ? 'serious' : ratio < 4.5 ? 'moderate' : 'minor',
      status: ratio >= 4.5 ? 'pass' : 'fail',
      message:
        ratio >= 4.5
          ? 'Text contrast preview meets the 4.5:1 body text threshold.'
          : 'Text contrast preview is below the 4.5:1 body text threshold; export and scan with Ariada CLI.',
      value: `${ratio.toFixed(2)}:1`,
    });
  }
  if (isInteractiveShape(shape)) {
    const width = Number(shape.width ?? 0);
    const height = Number(shape.height ?? 0);
    const passes = width >= MIN_TARGET_SIZE && height >= MIN_TARGET_SIZE;
    checks.push({
      shapeId: shape.id,
      shapeName: shape.name ?? shape.id,
      ruleId: 'penpot-target-size-preview',
      severity: passes ? 'minor' : 'moderate',
      status: passes ? 'pass' : 'fail',
      message: passes
        ? 'Interactive target preview is at least 24 by 24 CSS pixels.'
        : 'Interactive target preview is smaller than 24 by 24 CSS pixels; export and scan with Ariada CLI.',
      value: `${width}x${height}`,
    });
  }
  return checks;
}

export function contrastRatio(foreground: string, background: string): number {
  const foregroundRgb = parseHexColor(foreground);
  const backgroundRgb = parseHexColor(background);
  const lighter = Math.max(relativeLuminance(foregroundRgb), relativeLuminance(backgroundRgb));
  const darker = Math.min(relativeLuminance(foregroundRgb), relativeLuminance(backgroundRgb));
  return (lighter + 0.05) / (darker + 0.05);
}

function renderHtml(shapes: readonly PenpotShape[], checks: readonly DesignCheck[]): string {
  const renderedShapes = shapes.map((shape) => renderShape(shape)).join('\n');
  const renderedChecks = checks
    .map(
      (check) =>
        `<li data-status="${escapeHtml(check.status)}"><strong>${escapeHtml(check.shapeName)}</strong>: ${escapeHtml(
          check.message,
        )} <code>${escapeHtml(check.value)}</code></li>`,
    )
    .join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ariada Penpot export fixture</title>
<style>
body{font:16px/1.45 system-ui,sans-serif;margin:0;color:#172033;background:#f5f7fa}
main{max-width:960px;margin:0 auto;padding:32px 20px}
.board{position:relative;min-height:360px;background:#fff;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden}
.shape{position:absolute;box-sizing:border-box;display:flex;align-items:center;justify-content:center;padding:4px}
.button{border:1px solid #334155;border-radius:6px}
.checks{margin-top:20px;background:#fff;border:1px solid #cbd5e1;border-radius:8px;padding:16px}
</style>
</head>
<body>
<main>
<h1>Ariada Penpot export fixture</h1>
<p>This HTML was generated from Penpot-like shape data and scanned by the shared @ariada-org CLI.</p>
<section class="board" aria-label="Exported Penpot selection">
${renderedShapes}
</section>
<section class="checks" aria-label="Design preview checks">
<h2>Design preview checks</h2>
<ul>${renderedChecks}</ul>
</section>
</main>
</body>
</html>
`;
}

function renderShape(shape: PenpotShape): string {
  const left = Math.max(0, Number(shape.x ?? 0));
  const top = Math.max(0, Number(shape.y ?? 0));
  const width = Math.max(1, Number(shape.width ?? 120));
  const height = Math.max(1, Number(shape.height ?? 32));
  const fill = firstColor(shape.fills, shape.type === 'text' ? 'transparent' : '#e2e8f0');
  const color = shape.type === 'text' ? firstColor(shape.fills, DEFAULT_FOREGROUND) : '#111827';
  const style = `left:${left}px;top:${top}px;width:${width}px;height:${height}px;background:${fill};color:${color}`;
  const label = escapeHtml(shape.characters ?? shape.name ?? shape.id);
  if (isInteractiveShape(shape)) {
    return `<button class="shape button" style="${style}" aria-label="${escapeHtml(shape.name ?? 'Penpot button')}">${label}</button>`;
  }
  if (isTextShape(shape)) {
    return `<p class="shape" style="${style};background:transparent">${label}</p>`;
  }
  return `<div class="shape" style="${style}" role="img" aria-label="${escapeHtml(shape.name ?? shape.type)}">${label}</div>`;
}

function isTextShape(shape: PenpotShape): boolean {
  return shape.type.toLowerCase() === 'text' || typeof shape.characters === 'string';
}

function isInteractiveShape(shape: PenpotShape): boolean {
  const name = `${shape.name ?? ''} ${shape.role ?? ''}`.toLowerCase();
  return /button|cta|link|input|control|hotspot|tap/.test(name);
}

function nearestBackground(shape: PenpotShape): string {
  if (shape.strokes && shape.strokes.length > 0) return firstColor(shape.strokes, DEFAULT_BACKGROUND);
  return DEFAULT_BACKGROUND;
}

function firstColor(colors: PenpotColor[] | null | undefined, fallback: string): string {
  const color = colors?.find((item) => typeof item.color === 'string' && item.color.length > 0)?.color;
  return color ?? fallback;
}

function parseHexColor(color: string): [number, number, number] {
  const normalized = color.trim().replace(/^#/, '');
  const hex =
    normalized.length === 3
      ? normalized
          .split('')
          .map((part) => `${part}${part}`)
          .join('')
      : normalized;
  if (!/^[\da-f]{6}$/i.test(hex)) return [0, 0, 0];
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

function relativeLuminance([red, green, blue]: [number, number, number]): number {
  const [r, g, b] = [red, green, blue].map((channel) => {
    const value = channel / 255;
    return value <= 0.039_28 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
