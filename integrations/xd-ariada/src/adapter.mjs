// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { spawn } from 'node:child_process';

export function renderXdSelectionHtml(selection, options = {}) {
  const normalized = normalizeSelection(selection);
  const title = options.title || normalized.name || 'Adobe XD Ariada export';
  const body = normalized.children.map((node) => renderNode(node)).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
html{background:#f3f5f8}
body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#111827}
.xd-artboard{position:relative;width:${normalized.width}px;height:${normalized.height}px;margin:24px auto;background:${normalized.background};box-shadow:0 16px 48px rgba(17,24,39,.18);overflow:hidden}
.xd-node{position:absolute;box-sizing:border-box}
.xd-text{margin:0;white-space:pre-wrap}
.xd-image{object-fit:cover;background:#d8dee8}
.xd-button{border:0;border-radius:4px;cursor:pointer}
</style>
</head>
<body>
<main class="xd-artboard" aria-label="${escapeHtml(title)}">
${body}
</main>
</body>
</html>
`;
}

export function normalizeSelection(selection) {
  const root = Array.isArray(selection?.children) ? selection : { children: selection?.nodes || [] };
  return {
    name: root.name || 'Ariada XD accessibility fixture',
    width: positiveNumber(root.width, 960),
    height: positiveNumber(root.height, 640),
    background: cssColor(root.background || firstFill(root), '#ffffff'),
    children: (root.children || []).map(normalizeNode),
  };
}

export function buildAriadaScanCommand({ cliPath, url, outputDir, threshold = 'minor', browser = 'chromium' }) {
  return [
    process.execPath,
    cliPath,
    'scan',
    url,
    '--format',
    'both',
    '--output-dir',
    outputDir,
    '--severity-threshold',
    threshold,
    '--browser',
    browser,
  ];
}

export async function writeHtmlExport(selection, outputPath) {
  await mkdir(resolve(outputPath, '..'), { recursive: true });
  const html = renderXdSelectionHtml(selection);
  await writeFile(outputPath, html, 'utf8');
  return html;
}

export async function serveDirectory(directory) {
  const root = resolve(directory);
  const server = createServer(async (request, response) => {
    try {
      const requested = request.url === '/' ? '/index.html' : request.url || '/index.html';
      const cleanName = basename(decodeURIComponent(requested.split('?')[0] || 'index.html'));
      const filePath = resolve(root, cleanName);
      const file = await import('node:fs/promises').then((fs) => fs.readFile(filePath));
      response.writeHead(200, { 'content-type': contentType(filePath) });
      response.end(file);
    } catch {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    }
  });

  await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  const address = server.address();
  return {
    server,
    url: `http://127.0.0.1:${address.port}/`,
  };
}

export async function invokeAriadaCli(command, options = {}) {
  const [bin, ...args] = command;
  return await new Promise((resolveRun) => {
    const child = spawn(bin, args, { cwd: options.cwd, env: process.env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('close', (status) => {
      resolveRun({ status: status ?? 1, stdout, stderr });
    });
  });
}

function normalizeNode(node) {
  const bounds = node.bounds || node.globalBounds || node;
  return {
    altText: node.altText || node.accessibilityLabel || '',
    background: cssColor(node.background || firstFill(node), 'transparent'),
    children: (node.children || []).map(normalizeNode),
    fill: cssColor(node.fill || node.color || firstFill(node), '#d8dee8'),
    fontSize: positiveNumber(node.fontSize || node.style?.fontSize, 16),
    height: positiveNumber(bounds.height, 1),
    interactive: Boolean(node.interactive || node.hasTapAction || /button|link|input|tab|menu|hotspot/i.test(node.name || '')),
    name: node.name || node.id || 'XD layer',
    text: node.text || node.characters || '',
    textColor: cssColor(node.textColor || node.style?.fill || node.style?.color, '#111827'),
    type: node.type || node.constructorName || 'Rectangle',
    width: positiveNumber(bounds.width, 1),
    x: number(bounds.x, 0),
    y: number(bounds.y, 0),
  };
}

function renderNode(node) {
  const style = `left:${node.x}px;top:${node.y}px;width:${node.width}px;height:${node.height}px;`;
  if (node.text || /text/i.test(node.type)) {
    return `<p class="xd-node xd-text" style="${style}color:${node.textColor};font-size:${node.fontSize}px;background:${node.background};">${escapeHtml(node.text || node.name)}</p>`;
  }
  if (/image|bitmap|photo/i.test(node.type)) {
    const alt = node.altText ? ` alt="${escapeHtml(node.altText)}"` : '';
    return `<img class="xd-node xd-image" style="${style}" src="${fixtureImageData()}"${alt}>`;
  }
  if (node.interactive) {
    return `<button class="xd-node xd-button" style="${style}background:${node.fill};color:${node.textColor};">${escapeHtml(node.name)}</button>`;
  }
  const children = node.children.map(renderNode).join('\n');
  return `<section class="xd-node" style="${style}background:${node.fill};" aria-label="${escapeHtml(node.name)}">${children}</section>`;
}

function firstFill(node) {
  const fill = Array.isArray(node?.fills) ? node.fills.find((item) => item && item.visible !== false) : undefined;
  return fill?.color || fill?.value;
}

function cssColor(value, fallback) {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const r = Math.round(channel(value.r ?? value.red) * 255);
    const g = Math.round(channel(value.g ?? value.green) * 255);
    const b = Math.round(channel(value.b ?? value.blue) * 255);
    const a = value.a ?? value.alpha;
    return typeof a === 'number' && a < 1 ? `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})` : `rgb(${r},${g},${b})`;
  }
  return fallback;
}

function channel(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return value > 1 ? Math.max(0, Math.min(255, value)) / 255 : Math.max(0, Math.min(1, value));
}

function positiveNumber(value, fallback) {
  const parsed = number(value, fallback);
  return parsed > 0 ? parsed : fallback;
}

function number(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function fixtureImageData() {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#cbd5e1"/><path d="M0 180 110 74l72 64 49-35 89 77z" fill="#64748b"/></svg>';
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.png')) return 'image/png';
  return 'text/plain; charset=utf-8';
}
