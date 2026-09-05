#!/usr/bin/env node
/**
 * Self-cert scan for ariada.org (apps/ariada-org/dist) using
 * @ariada-org/wcag-rules-extended in static happy-dom mode.
 *
 * Sister script to scripts/self-cert-scan.mjs (which targets
 * apps/ariada-web/dist). Output:
 *   audits/self-cert/YYYY-MM-DD-ariada-org.{json,md}
 *
 * Methodology mirrors self-cert-scan.mjs exactly so cross-site
 * comparison is apples-to-apples.
 *
 * Cross-tool baselines (axe-core via @axe-core/cli, pa11y) are
 * orchestrated separately: a cross-tool baseline was run in May 2026 against the
 * same site, and axe-core and pa11y agreed on the major findings.
 *
 * Shared harness: scripts/lib/self-cert-harness.mjs.
 */

import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { runSelfCert } from './lib/self-cert-harness.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

runSelfCert({
  callerUrl: import.meta.url,
  distDir: join(REPO_ROOT, 'apps/ariada-org/dist'),
  outputBaseName: 'ariada-org',
  buildHint: 'pnpm --filter ariada-org build',
  siteUrl: 'https://ariada.org/',
  titleSuffix: 'ariada.org',
  includeNodeTags: true,
  methodology: [
    'Static scan: each page loaded into happy-dom Window; all rule check',
    'functions from `@ariada-org/wcag-rules-extended` applied to candidate',
    'elements per rule selector. Violation recorded when AND-checks fail',
    'OR a none-check matches.',
    '',
    'Compared once against other tools: a May 2026 baseline ran',
    'axe-core and pa11y over the same site, and both agreed on the',
    'major findings. A statement-page honesty check ran with them.',
  ],
}).catch((e) => {
  console.error('Self-cert scan failed:', e);
  process.exit(1);
});
