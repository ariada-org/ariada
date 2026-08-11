// Component-level guards. This repo has no DOM test environment installed
// (no jsdom / happy-dom / @testing-library/svelte), so these tests do NOT mount
// the components. They compile every .svelte file with the real Svelte 5
// compiler — which catches syntax, rune and a11y defects — and assert the
// package's structural invariants: zero runtime dependencies, no Tailwind, no
// product names in the render layer.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { compile } from 'svelte/compiler';
import { describe, expect, it } from 'vitest';

const SRC = dirname(fileURLToPath(import.meta.url));
const COMPONENTS = readdirSync(SRC).filter((name) => name.endsWith('.svelte')).sort();
const SOURCES = Object.fromEntries(
  readdirSync(SRC)
    .filter((name) => name.endsWith('.svelte') || name.endsWith('.ts') || name.endsWith('.css'))
    .map((name) => [name, readFileSync(join(SRC, name), 'utf8')]),
);

describe('Svelte components', () => {
  it('ships the three shared components', () => {
    expect(COMPONENTS).toEqual(['AdminGrid.svelte', 'MetricChart.svelte', 'RowDetailDrawer.svelte']);
  });

  for (const name of COMPONENTS) {
    it(`compiles ${name} without errors or warnings`, () => {
      const result = compile(SOURCES[name] as string, {
        filename: name,
        generate: 'client',
        dev: false,
      });
      expect(result.warnings.map((w) => `${w.code}: ${w.message}`)).toEqual([]);
      expect(result.js.code.length).toBeGreaterThan(0);
    });

    it(`compiles ${name} for server-side rendering`, () => {
      const result = compile(SOURCES[name] as string, {
        filename: name,
        generate: 'server',
        dev: false,
      });
      expect(result.js.code.length).toBeGreaterThan(0);
    });
  }
});

describe('package invariants', () => {
  const allSources = Object.entries(SOURCES).filter(([name]) => !name.endsWith('.test.ts'));

  it('imports nothing outside the contract, AG Grid and Svelte itself', () => {
    const allowed = new Set(['@ariada-org/admin-surface', 'ag-grid-community', 'svelte']);
    const seen: string[] = [];
    for (const [name, source] of allSources) {
      // strip comments so a usage example in a doc block is not read as an import
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      for (const match of code.matchAll(/^\s*(?:import|export)[\s\S]*?from\s+'([^']+)'/gm)) {
        const specifier = match[1] as string;
        if (specifier.startsWith('./') || specifier.startsWith('../')) continue;
        seen.push(specifier);
        expect(allowed.has(specifier), `${name} imports ${specifier}`).toBe(true);
      }
    }
    // guard the guard: the scan must actually have found the external imports
    expect(new Set(seen)).toEqual(allowed);
  });

  it('has no React or component-library dependency', () => {
    for (const [name, source] of allSources) {
      expect(source, name).not.toMatch(/\bfrom\s+'(react|react-dom|antd|@ant-design\/[^']+)'/);
    }
  });

  it('the stylesheet is plain CSS — no Tailwind directive and no preprocessor', () => {
    const css = SOURCES['tokens.css'] as string;
    expect(css).not.toMatch(/@import\s+["']tailwindcss/);
    expect(css).not.toMatch(/@theme\b/);
    expect(css).not.toMatch(/@apply\b/);
    expect(css).toMatch(/--adm-primary:/);
  });

  it('namespaces every custom property so a consumer theme cannot collide', () => {
    const css = SOURCES['tokens.css'] as string;
    for (const match of css.matchAll(/^\s{2}(--[a-z0-9-]+):/gm)) {
      expect(match[1]).toMatch(/^--adm-/);
    }
  });

  it('carries no product name — a render layer draws whatever the contract declares', () => {
    for (const [name, source] of allSources) {
      if (name === 'format.ts') continue; // DEFAULT_WIKI holds the shared wiki host
      expect(source.toLowerCase(), name).not.toMatch(/\b(fap\.nu|fapnu|novostnik|projectology|smartcj|tradeexpert)\b/);
    }
  });
});
