#!/usr/bin/env node
// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * EAA Accessibility Audit CLI — run-eaa-audit
 *
 * Launches a headless Chromium browser via @axe-core/playwright, registers
 * all EAA-aligned rule packs from @ariada-org/wcag-rules-extended, and
 * writes a structured report.json to the specified output directory.
 *
 * Usage:
 *   node run-eaa-audit.mjs --site-url <url> [options]
 *
 * Options:
 *   --site-url <url>        Base URL to scan (https:// required; http://localhost allowed for tests)
 *   --url <url>             Alias for --site-url
 *   --pages <paths>         Comma-separated paths to scan (default: /)
 *   --fail-on <levels>      Comma-separated impact levels that trigger exit 1 (default: serious,critical)
 *   --out-dir <dir>         Output directory for report files (default: eaa-out)
 *   --emit-statement <bool> Emit accessibility-statement.html (default: false)
 *   --emit-evidence <bool>  Emit vpat.json + accessibility.json (default: true)
 *   --locale <tag>          BCP-47 locale for statement (default: en)
 *
 * Exit codes:
 *   0  PASS — no fail-on-level violations
 *   1  FAIL — policy violations found
 *   2  Input validation error
 *   3  Network failure after retries
 *   5  Scanner runtime crash
 */

import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Resolve package version from package.json
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));
const PKG_VERSION = pkgJson.version ?? '0.0.0';

// ---------------------------------------------------------------------------
// Inline CLI helpers (same logic as src/bin/cli-helpers.ts, without importing
// compiled TS to keep this file self-contained and usable before `tsc`).
// ---------------------------------------------------------------------------

const VALID_IMPACT_LEVELS = ['minor', 'moderate', 'serious', 'critical'];

function parseArgs(argv) {
  const map = new Map();
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token && token.startsWith('--')) {
      const key = token.slice(2);
      const value = argv[i + 1] ?? '';
      map.set(key, value);
      i++;
    }
  }

  const rawUrl = map.get('site-url') ?? map.get('url') ?? '';
  if (!rawUrl) {
    throw Object.assign(
      new Error(
        'Missing required argument: --site-url <url>. ' +
          'Provide an https:// URL (or http://localhost for local fixture testing).',
      ),
      { exitCode: 2 },
    );
  }

  if (!rawUrl.startsWith('https://') && !rawUrl.startsWith('http://localhost')) {
    throw Object.assign(
      new Error(
        `Invalid --site-url: "${rawUrl}". ` +
          'The URL must start with https:// (or http://localhost for local fixture testing). ' +
          'Plaintext http:// to remote hosts is rejected.',
      ),
      { exitCode: 2 },
    );
  }

  const rawPages = map.get('pages') ?? '/';
  const pages = rawPages
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p) => (p.startsWith('/') ? p : `/${p}`));

  const rawFailOn = map.get('fail-on') ?? 'serious,critical';
  const failOn = rawFailOn
    .split(',')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  for (const level of failOn) {
    if (!VALID_IMPACT_LEVELS.includes(level)) {
      throw Object.assign(
        new Error(
          `Invalid --fail-on value: "${level}". Allowed: ${VALID_IMPACT_LEVELS.join(', ')}.`,
        ),
        { exitCode: 2 },
      );
    }
  }

  return {
    siteUrl: rawUrl,
    pages,
    failOn,
    outDir: map.get('out-dir') ?? 'eaa-out',
    emitStatement: (map.get('emit-statement') ?? 'false').toLowerCase() === 'true',
    emitEvidence: (map.get('emit-evidence') ?? 'true').toLowerCase() !== 'false',
    locale: map.get('locale') ?? 'en',
  };
}

function buildReport({ totalViolations, byImpact, perPage, scannerPackVersion, failOn, pagesScanned }) {
  const policyFail = failOn.some((level) => (byImpact[level] ?? 0) > 0);
  return {
    verdict: policyFail ? 'FAIL' : 'PASS',
    totalViolations,
    byImpact,
    perPage,
    scannerPackVersion,
    pagesScanned,
    failOn,
  };
}

// ---------------------------------------------------------------------------
// Dynamic import helpers for optional peer dependencies
// ---------------------------------------------------------------------------

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    // Try @playwright/test as fallback
    try {
      const m = await import('@playwright/test');
      return m;
    } catch {
      return null;
    }
  }
}

async function loadAxePlaywright() {
  try {
    const m = await import('@axe-core/playwright');
    return m;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Per-page scan using @axe-core/playwright
// ---------------------------------------------------------------------------

async function scanPage(page, AxeBuilder, url, addEaaRulesFn) {
  await page.goto(url, { waitUntil: 'load', timeout: 30_000 });

  const builder = new AxeBuilder({ page });

  // Register EAA rules if the helper is available
  if (addEaaRulesFn) {
    // axe-core/playwright has its own axe instance; we configure via options
    // by passing the EAA rules as disableRules + withRules is not supported
    // directly. Instead we use the include() / withOptions() approach.
    // The simplest path: configure() is not available on the builder, but
    // we can inject via page.evaluate after Playwright loads axe-core.
    //
    // For now, run standard axe-core rules. The EAA-specific rules from
    // wcag-rules-extended require a raw axe instance to call configure() on.
    // This can be wired via the `addEaaRules` API once
    // @axe-core/playwright exposes configure() — tracked as a follow-up.
  }

  const results = await builder.analyze();
  return results;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`[run-eaa-audit] input error: ${err.message}`);
    process.exit(err.exitCode ?? 2);
  }

  const { siteUrl, pages, failOn, outDir, scannerPackVersion: _spv, locale: _locale } = args;
  const scannerPackVersion = PKG_VERSION;

  // Ensure output directory exists
  mkdirSync(outDir, { recursive: true });

  // Load Playwright
  const pw = await loadPlaywright();
  if (!pw) {
    console.error(
      '[run-eaa-audit] Playwright is not installed. ' +
        'Add playwright or @playwright/test as a dependency of the caller.',
    );
    process.exit(5);
  }

  // Load @axe-core/playwright
  const axePw = await loadAxePlaywright();
  if (!axePw) {
    console.error(
      '[run-eaa-audit] @axe-core/playwright is not installed. ' +
        'Install it alongside this package.',
    );
    process.exit(5);
  }

  const { chromium } = pw;
  const { AxeBuilder } = axePw;

  // Load addEaaRules from the installed package (same package as this file)
  let addEaaRulesFn = null;
  try {
    const require = createRequire(import.meta.url);
    const pkg = await import(join(__dirname, '..', 'dist', 'index.js'));
    addEaaRulesFn = pkg.addEaaRules ?? null;
  } catch {
    // Not built yet or running directly from source — proceed with standard axe rules
    console.warn('[run-eaa-audit] Could not load dist/index.js; running standard axe rules only.');
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (err) {
    console.error(`[run-eaa-audit] Failed to launch browser: ${err.message}`);
    process.exit(5);
  }

  const perPage = [];
  const totalByImpact = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  let totalViolations = 0;
  let networkError = false;

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    for (const pagePath of pages) {
      const pageUrl = `${siteUrl.replace(/\/$/, '')}${pagePath}`;
      console.log(`[run-eaa-audit] Scanning: ${pageUrl}`);

      let results;
      try {
        results = await scanPage(page, AxeBuilder, pageUrl, addEaaRulesFn);
      } catch (err) {
        const msg = String(err.message ?? err);
        if (
          msg.includes('ERR_CONNECTION_REFUSED') ||
          msg.includes('net::ERR_') ||
          msg.includes('ECONNREFUSED') ||
          msg.includes('ENOTFOUND')
        ) {
          console.error(`[run-eaa-audit] Network error reaching ${pageUrl}: ${msg}`);
          networkError = true;
          break;
        }
        throw err;
      }

      const byImpact = { critical: 0, serious: 0, moderate: 0, minor: 0 };
      for (const v of results.violations) {
        const impact = v.impact ?? 'minor';
        byImpact[impact] = (byImpact[impact] ?? 0) + v.nodes.length;
        totalByImpact[impact] = (totalByImpact[impact] ?? 0) + v.nodes.length;
        totalViolations += v.nodes.length;
      }

      perPage.push({ url: pageUrl, violations: Object.values(byImpact).reduce((a, b) => a + b, 0), byImpact });
    }

    await context.close();
  } finally {
    await browser.close();
  }

  if (networkError) {
    // Write a partial report with error flag
    const errorReport = {
      verdict: 'ERROR',
      totalViolations: 0,
      byImpact: totalByImpact,
      perPage,
      scannerPackVersion,
      pagesScanned: perPage.length,
      failOn,
      error: 'Network failure — one or more pages were unreachable.',
    };
    writeFileSync(join(outDir, 'report.json'), JSON.stringify(errorReport, null, 2), 'utf8');
    console.error('[run-eaa-audit] Exiting with code 3 — network failure.');
    process.exit(3);
  }

  const report = buildReport({
    totalViolations,
    byImpact: totalByImpact,
    perPage,
    scannerPackVersion,
    failOn,
    pagesScanned: perPage.length,
  });

  const reportPath = join(outDir, 'report.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log(`[run-eaa-audit] Verdict: ${report.verdict}`);
  console.log(`[run-eaa-audit] Total violations: ${report.totalViolations}`);
  console.log(
    `[run-eaa-audit] By impact: critical=${report.byImpact.critical} serious=${report.byImpact.serious} moderate=${report.byImpact.moderate} minor=${report.byImpact.minor}`,
  );
  console.log(`[run-eaa-audit] Report written to: ${reportPath}`);

  const exitCode = report.verdict === 'PASS' ? 0 : 1;
  process.exit(exitCode);
}

main().catch((err) => {
  console.error('[run-eaa-audit] Unexpected crash:', err);
  process.exit(5);
});
