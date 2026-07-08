// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/* eslint-disable jsdoc/require-jsdoc */

import { spawnSync } from 'node:child_process';

export type WhimsicalExportKind = 'html' | 'svg' | 'url';

export interface WhimsicalScanRecipe {
  exportPath?: string;
  publishedUrl?: string;
  format?: WhimsicalExportKind;
  reportPath?: string;
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

export type AriadaRunner = (invocation: AriadaCliInvocation) => AriadaRunResult;

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

export function buildAriadaInvocation(recipe: WhimsicalScanRecipe, command = 'ariada'): AriadaCliInvocation {
  const resolved = resolveWhimsicalTarget(recipe);
  const args = ['scan', resolved.target, '--format', 'json'];

  if (recipe.reportPath) {
    args.push('--output', recipe.reportPath);
  }

  if (resolved.format === 'svg') {
    args.push('--rules', 'color-contrast,text-size');
  }

  return {
    command,
    args,
    limitation: DESIGN_STAGE_LIMITATION,
  };
}

export function runAriadaForWhimsical(recipe: WhimsicalScanRecipe, runner: AriadaRunner = spawnAriada): AriadaRunResult {
  return runner(buildAriadaInvocation(recipe));
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
  const reportPath = optionalString(recipe['reportPath'], 'reportPath');

  if (exportPath) config.exportPath = exportPath;
  if (publishedUrl) config.publishedUrl = publishedUrl;
  if (format) config.format = format;
  if (reportPath) config.reportPath = reportPath;
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

function spawnAriada(invocation: AriadaCliInvocation): AriadaRunResult {
  const result = spawnSync(invocation.command, invocation.args, { encoding: 'utf8' });
  if (result.error) {
    throw result.error;
  }

  return {
    status: result.status ?? 1,
    stdout: result.stdout,
    stderr: [invocation.limitation, result.stderr].filter(Boolean).join('\n'),
  };
}
