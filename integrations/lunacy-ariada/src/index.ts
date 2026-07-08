// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join } from 'node:path';

export type Severity = 'minor' | 'moderate' | 'serious' | 'critical';

export interface LunacyLayer {
  _t?: string;
  children?: LunacyLayer[];
  fills?: Array<{ color?: string | Rgba; isEnabled?: boolean; visible?: boolean }>;
  frame?: { height?: number; width?: number; x?: number; y?: number };
  height?: number;
  id?: string;
  layers?: LunacyLayer[];
  name?: string;
  style?: { fills?: Array<{ color?: string | Rgba; isEnabled?: boolean; visible?: boolean }>; textColor?: string | Rgba };
  text?: string;
  textColor?: string | Rgba;
  type?: string;
  width?: number;
  x?: number;
  y?: number;
}

export interface Rgba {
  a?: number;
  b: number;
  g: number;
  r: number;
}

export interface ScanOptions {
  cliArgs?: string[];
  cliCommand?: string;
  outputDir?: string;
  severityThreshold?: Severity;
}

export function normalizeSelection(selection: unknown): LunacyLayer[] {
  if (Array.isArray(selection)) return selection.filter(isLayer);
  if (isLayer(selection) && Object.keys(selection).length > 0) return [selection];
  return [];
}

export function renderLayersToHtml(selection: unknown): string {
  const layers = flatten(normalizeSelection(selection));
  const body = layers.map(renderLayer).filter(Boolean).join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Ariada Lunacy scan target</title><style>body{margin:0;background:#fff;font-family:Arial,sans-serif}.canvas{position:relative;min-height:480px;padding:24px}.layer{position:absolute;box-sizing:border-box}</style></head><body><main class="canvas">${body || '<p>No selected Lunacy layers.</p>'}</main></body></html>`;
}

export function createAriadaCliArgs(url: string, options: ScanOptions = {}): string[] {
  return options.cliArgs ?? [
    '--yes',
    '@ariada-org/cli',
    'scan',
    url,
    '--format',
    'json',
    '--output-dir',
    options.outputDir ?? 'ariada-output',
    '--severity-threshold',
    options.severityThreshold ?? 'moderate'
  ];
}

export async function scanRenderedHtml(html: string, options: ScanOptions = {}): Promise<number> {
  const outputDir = options.outputDir ?? 'ariada-output';
  await mkdir(outputDir, { recursive: true });
  await writeFile(join(outputDir, 'lunacy-scan-target.html'), html, 'utf8');
  const server = createServer((_, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(html);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  try {
    return await runProcess(options.cliCommand ?? 'npx', createAriadaCliArgs(`http://127.0.0.1:${port}/`, { ...options, outputDir }));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

export async function fetchLunacySelection(apiUrl = 'http://localhost:31415'): Promise<LunacyLayer[]> {
  const response = await fetch(`${apiUrl.replace(/\/$/, '')}/getselected`);
  if (!response.ok) throw new Error(`Lunacy API returned ${response.status}`);
  return normalizeSelection(await response.json());
}

export function summarizeAriadaFindings(report: unknown): string[] {
  const findings = Array.isArray((report as { findings?: unknown })?.findings)
    ? (report as { findings: Array<Record<string, unknown>> }).findings
    : [];
  return findings.map((finding) => String(finding['ruleId'] ?? finding['id'] ?? 'ariada/unknown'));
}

function renderLayer(layer: LunacyLayer): string {
  const name = escapeHtml(layer.name ?? layer.id ?? 'Layer');
  const text = layer.text ? escapeHtml(layer.text) : name;
  const left = number(layer.x ?? layer.frame?.x);
  const top = number(layer.y ?? layer.frame?.y);
  const width = number(layer.width ?? layer.frame?.width, 120);
  const height = number(layer.height ?? layer.frame?.height, 32);
  const fill = cssColor(firstFill(layer), '#ffffff');
  const color = cssColor(layer.textColor ?? layer.style?.textColor, '#111111');
  const style = `left:${left}px;top:${top}px;width:${width}px;height:${height}px;background:${fill};color:${color}`;
  if (isText(layer)) return `<p class="layer" data-layer-id="${escapeHtml(layer.id ?? '')}" style="${style}">${text}</p>`;
  if (isTarget(layer)) return `<button class="layer" data-layer-id="${escapeHtml(layer.id ?? '')}" style="${style}">${name}</button>`;
  return `<div class="layer" data-layer-id="${escapeHtml(layer.id ?? '')}" aria-label="${name}" style="${style}"></div>`;
}

function flatten(layers: LunacyLayer[]): LunacyLayer[] {
  return layers.flatMap((layer) => [layer, ...flatten([...(layer.children ?? []), ...(layer.layers ?? [])])]);
}

function isLayer(value: unknown): value is LunacyLayer {
  return Boolean(value && typeof value === 'object');
}

function isText(layer: LunacyLayer): boolean {
  return layer._t === 'TEXT' || layer.type === 'Text' || typeof layer.text === 'string';
}

function isTarget(layer: LunacyLayer): boolean {
  return /button|control|hotspot|link|tap|target/i.test(layer.name ?? '');
}

function firstFill(layer: LunacyLayer): string | Rgba | undefined {
  return [...(layer.fills ?? []), ...(layer.style?.fills ?? [])].find((fill) => fill.visible !== false && fill.isEnabled !== false)?.color;
}

function cssColor(value: string | Rgba | undefined, fallback: string): string {
  if (!value) return fallback;
  if (typeof value === 'string') return value.startsWith('#') ? value.slice(0, 7) : value;
  const [r, g, b] = [value.r, value.g, value.b].map((channel) => Math.round(channel <= 1 ? channel * 255 : channel));
  return `rgb(${r} ${g} ${b})`;
}

function number(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
}

function runProcess(command: string, args: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
  });
}
