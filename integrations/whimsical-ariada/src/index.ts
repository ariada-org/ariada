// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/* eslint-disable jsdoc/require-jsdoc */

import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { basename, resolve } from 'node:path';

export type WhimsicalExportKind = 'html' | 'svg' | 'url';

export interface WhimsicalScanRecipe {
  exportPath?: string;
  publishedUrl?: string;
  format?: WhimsicalExportKind;
  outputDir?: string;
}

export interface AriadaCliInvocation {
  command: string;
  args: string[];
  limitation: string;
}

export interface AriadaRunResult {
  status: number;
  stdout: string;
  stderr: string;
}

export type AriadaRunner = (invocation: AriadaCliInvocation) => AriadaRunResult | Promise<AriadaRunResult>;

const DESIGN_STAGE_LIMITATION =
  'Whimsical has no first-party plugin SDK; this recipe scans exported HTML/SVG or a published board URL with Ariada design-determinable checks only.';

export function resolveWhimsicalTarget(recipe: WhimsicalScanRecipe): { target: string; format: WhimsicalExportKind } {
  if (recipe.publishedUrl) {
    return { target: recipe.publishedUrl, format: 'url' };
  }

  if (!recipe.exportPath) {
    throw new Error('Provide exportPath for a Whimsical HTML/SVG export or publishedUrl for a shared board.');
  }

  return { target: recipe.exportPath, format: recipe.format ?? inferExportKind(recipe.exportPath) };
}

export function buildAriadaInvocation(recipe: WhimsicalScanRecipe, command = 'ariada', targetUrl?: string): AriadaCliInvocation {
  const resolved = resolveWhimsicalTarget(recipe);
  const target = targetUrl ?? resolved.target;
  if (!isHttpUrl(target)) {
    throw new Error('Local Whimsical exports must be served over http(s) before invoking ariada scan.');
  }

  const args = ['scan', target, '--format', 'json', '--domains', 'accessibility'];

  if (recipe.outputDir) {
    args.push('--output-dir', recipe.outputDir);
  }

  if (isLoopbackUrl(target)) {
    args.push('--allow-private');
  }

  return {
    command,
    args,
    limitation: DESIGN_STAGE_LIMITATION,
  };
}

export async function runAriadaForWhimsical(recipe: WhimsicalScanRecipe, runner: AriadaRunner = spawnAriada): Promise<AriadaRunResult> {
  const resolved = resolveWhimsicalTarget(recipe);
  if (resolved.format === 'url') {
    return runner(buildAriadaInvocation(recipe));
  }

  return serveExport(resolved.target, (servedUrl) => runner(buildAriadaInvocation(recipe, 'ariada', servedUrl)));
}

export function inferExportKind(pathOrUrl: string): WhimsicalExportKind {
  const normalized = pathOrUrl.toLowerCase();
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) return 'url';
  if (normalized.endsWith('.svg')) return 'svg';
  if (normalized.endsWith('.html') || normalized.endsWith('.htm')) return 'html';
  throw new Error('Whimsical export must be an HTML file, SVG file, or published http(s) URL.');
}

export function parseRecipeConfig(input: string): WhimsicalScanRecipe {
  const parsed = JSON.parse(input) as unknown;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Whimsical recipe config must be a JSON object.');
  }

  const recipe = parsed as Record<string, unknown>;
  const config: WhimsicalScanRecipe = {};
  const exportPath = optionalString(recipe['exportPath'], 'exportPath');
  const publishedUrl = optionalString(recipe['publishedUrl'], 'publishedUrl');
  const format = optionalFormat(recipe['format']);
  const outputDir = optionalString(recipe['outputDir'], 'outputDir');

  if (exportPath) config.exportPath = exportPath;
  if (publishedUrl) config.publishedUrl = publishedUrl;
  if (format) config.format = format;
  if (outputDir) config.outputDir = outputDir;
  return config;
}

function optionalString(value: unknown, key: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${key} must be a non-empty string when set.`);
  }
  return value;
}

function optionalFormat(value: unknown): WhimsicalExportKind | undefined {
  if (value === undefined) return undefined;
  if (value === 'html' || value === 'svg' || value === 'url') return value;
  throw new Error('format must be one of: html, svg, url.');
}

async function spawnAriada(invocation: AriadaCliInvocation): Promise<AriadaRunResult> {
  return new Promise((resolveResult, reject) => {
    const child = spawn(invocation.command, invocation.args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = invocation.limitation;
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += `\n${chunk}`;
    });
    child.on('error', reject);
    child.on('close', (status) => {
      resolveResult({ status: status ?? 1, stdout, stderr });
    });
  });
}

async function serveExport<T>(exportPath: string, callback: (servedUrl: string) => T | Promise<T>): Promise<T> {
  const absolutePath = resolve(exportPath);
  const route = `/${encodeURIComponent(basename(absolutePath))}`;
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
    if (path !== route) {
      response.writeHead(404).end('Not found');
      return;
    }
    response.setHeader('content-type', contentTypeFor(absolutePath));
    createReadStream(absolutePath).pipe(response);
  });

  await listen(server);
  const address = server.address() as AddressInfo;
  try {
    return await callback(`http://127.0.0.1:${address.port}${route}`);
  } finally {
    await close(server);
  }
}

async function listen(server: Server): Promise<void> {
  await new Promise<void>((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
}

async function close(server: Server): Promise<void> {
  await new Promise<void>((resolveClose, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolveClose();
    });
  });
}

function contentTypeFor(path: string): string {
  if (path.toLowerCase().endsWith('.svg')) return 'image/svg+xml; charset=utf-8';
  return 'text/html; charset=utf-8';
}

function isHttpUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://');
}

function isLoopbackUrl(value: string): boolean {
  try {
    return new URL(value).hostname === '127.0.0.1';
  } catch {
    return false;
  }
}
