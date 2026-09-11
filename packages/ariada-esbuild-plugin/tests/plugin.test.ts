// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ariadaEsbuild, scanOutput, type HtmlScanner } from '../src/index.js';

describe('@ariada-org/esbuild-plugin', () => {
  it('scans emitted HTML files through the injected Ariada scanner', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ariada-esbuild-'));
    try {
      await mkdir(join(root, 'dist'), { recursive: true });
      await writeFile(join(root, 'dist', 'index.html'), '<main><img src="/hero.png"></main>', 'utf8');
      const scanner: HtmlScanner = ({ filePath }) => ({
        filePath,
        findings: [{ filePath, ruleId: 'image-alt', severity: 'serious', message: 'Image needs text.' }],
      });

      const results = await scanOutput(join(root, 'dist'), scanner);

      expect(results[0]?.findings).toHaveLength(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('orders the files it finds by comparison, not by code unit', async () => {
    // Без сравнителя `sort` идёт по кодовым единицам UTF-16, и заглавная буква
    // встаёт перед строчной: `B.html`, `a.html`. Порядок обхода тогда зависит
    // от регистра имён, а разбор качества считает голый `sort` ошибкой
    // надёжности — из-за неё эта перевозка дважды была отставлена.
    const root = await mkdtemp(join(tmpdir(), 'ariada-esbuild-order-'));
    try {
      await writeFile(join(root, 'B.html'), '<p>b</p>', 'utf8');
      await writeFile(join(root, 'a.html'), '<p>a</p>', 'utf8');

      const results = await scanOutput(root);

      expect(results.map((result) => result.filePath.split('/').pop())).toEqual([
        'a.html',
        'B.html',
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('surfaces findings as esbuild diagnostics', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ariada-esbuild-hook-'));
    const callbacks: Array<() => Promise<{ warnings?: unknown[]; errors?: unknown[] } | void>> = [];
    try {
      await writeFile(join(root, 'index.html'), '<input>', 'utf8');
      const plugin = ariadaEsbuild({
        outdir: root,
        scanner: ({ filePath }) => ({
          filePath,
          findings: [{ filePath, ruleId: 'form-field-name', severity: 'serious', message: 'Input needs a name.' }],
        }),
      });

      plugin.setup({
        initialOptions: { outdir: root },
        onEnd(callback) {
          callbacks.push(callback);
        },
      });

      const result = await callbacks[0]?.();

      expect(result?.errors).toHaveLength(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
