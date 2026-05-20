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
 * orchestrated separately — see docs/audits/2026-05-15-wcag-cross-tool-audit.md.
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
    'Sister artefact: cross-tool comparison memo at',
    '`docs/audits/2026-05-15-wcag-cross-tool-audit.md` (axe-core baseline +',
    'pa11y baseline + statement-page honesty check).',
  ],
}).catch((e) => {
  console.error('Self-cert scan failed:', e);
  process.exit(1);
});
