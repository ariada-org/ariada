// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
// Author: Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
/**
 * `analyzeWithEaa(page, ruleIds)` — runs axe-core against the currently
 * loaded page using the @ariada-org/wcag-rules-extended rule pack (EAA config).
 *
 * Pipeline per call:
 *   1. Inject axe-core (canonical UMD bundle) into the page.
 *   2. Inject the bundled `eaa-bootstrap.ts` which calls
 *      `axe.configure({ rules, checks })` with our 31 rules. The bootstrap
 *      is bundled once per Node process by esbuild — closure-bound helper
 *      references (`looksLikePaymentRadio`, `cssEscape`, etc.) are inlined
 *      so they resolve inside the page realm.
 *   3. Call `axe.run(...)` with `runOnly: { type: 'rule', values: [...] }`
 *      via `page.evaluate`. Returns the standard `AxeResults` shape.
 *
 * Why not `@axe-core/playwright`?
 * `AxeBuilder` has no public hook for `axe.configure({ rules, checks })`
 * with custom rule and check definitions — only `withRules` / `withTags`
 * / `options`. So we bypass it and speak to axe directly.
 *
 * Author: MENDELEEV (Claude Opus 4.7), 2026-05-17.
 */

import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Page } from '@playwright/test';
import type { AxeResults } from 'axe-core';
import * as esbuild from 'esbuild';

import { allRules } from '../../../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BOOTSTRAP_ENTRY = resolve(__dirname, 'eaa-bootstrap.ts');

const require = createRequire(import.meta.url);
const AXE_SOURCE_PATH = require.resolve('axe-core/axe.min.js');

// One-shot caches — module is imported once per Node worker, so these
// effectively become per-worker singletons. Bundle cost ≈ 80-150 ms.
let cachedAxeSource: string | null = null;
let cachedBootstrap: string | null = null;

async function getAxeSource(): Promise<string> {
  if (cachedAxeSource === null) {
    cachedAxeSource = await readFile(AXE_SOURCE_PATH, 'utf8');
  }
  return cachedAxeSource;
}

async function getBootstrapBundle(): Promise<string> {
  if (cachedBootstrap === null) {
    const result = await esbuild.build({
      entryPoints: [BOOTSTRAP_ENTRY],
      bundle: true,
      write: false,
      format: 'iife',
      target: 'es2022',
      platform: 'browser',
      // Inline source maps would be nice for debugging but bloat the
      // payload sent to the page; leave them off for the standard run.
      sourcemap: false,
      // Keep names readable — helps when axe's `error.message` references
      // a check function name during failure triage.
      keepNames: true,
      // No external — every dependency of eaa-bootstrap is inlined.
      logLevel: 'silent',
    });
    if (result.errors.length > 0) {
      throw new Error(
        `esbuild failed to bundle eaa-bootstrap:\n${result.errors
          .map((error) => error.text)
          .join('\n')}`,
      );
    }
    cachedBootstrap = result.outputFiles[0]?.text ?? '';
    if (!cachedBootstrap) {
      throw new Error('esbuild produced an empty bootstrap bundle');
    }
  }
  return cachedBootstrap;
}

export interface AnalyzeOptions {
  /** Limit run to this subset of rule IDs (defaults to all 31 EAA rules). */
  ruleIds?: string[];
}

const ALL_RULE_IDS = allRules.map((r) => r.id);

/**
 * Configure and run axe-core inside the page, with the @ariada EAA rule
 * pack registered. Returns the standard `AxeResults` shape.
 */
export async function analyzeWithEaa(
  page: Page,
  options: AnalyzeOptions = {},
): Promise<AxeResults> {
  const axeSource = await getAxeSource();
  const bootstrap = await getBootstrapBundle();

  // Step 1: inject axe-core
  await page.addScriptTag({ content: axeSource });

  // Step 2: register the EAA rule pack
  await page.addScriptTag({ content: bootstrap });

  // Step 3: run
  const ruleIds = options.ruleIds && options.ruleIds.length > 0 ? options.ruleIds : ALL_RULE_IDS;

  const results = (await page.evaluate((runOnlyIds: string[]) => {
     
    const w = window as any;
    return w.axe.run(document, {
      runOnly: { type: 'rule', values: runOnlyIds },
    });
  }, ruleIds)) as AxeResults;

  return results;
}

/**
 * Convenience helper — returns true iff `ruleId` appears in
 * `results.violations`.
 */
export function ruleViolated(results: AxeResults, ruleId: string): boolean {
  return results.violations.some((v) => v.id === ruleId);
}

/**
 * Total count of incomplete + violations matching a rule id (useful when a
 * rule may legitimately report `incomplete` rather than `violations` for
 * a heuristic-driven check).
 */
export function ruleFiredAnywhere(results: AxeResults, ruleId: string): boolean {
  return (
    results.violations.some((v) => v.id === ruleId) ||
    results.incomplete.some((v) => v.id === ruleId)
  );
}
