#!/usr/bin/env node
/**
 * Self-cert scan: run @ariada-org/wcag-rules-extended rules over our own
 * static site build (apps/ariada-web/dist/) and record results.
 *
 * Output: audits/self-cert/YYYY-MM-DD.{json,md}
 *
 * Per Delta 8.1 of the 2026-05-15 multi-feature shipment: «we pass our
 * own rules, last reviewed YYYY-MM-DD by AB».
 *
 * Sister script: scripts/self-cert-ariada-org.mjs (targets apps/ariada-org/dist).
 * Shared harness: scripts/lib/self-cert-harness.mjs.
 */

import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { runSelfCert } from './lib/self-cert-harness.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

runSelfCert({
  callerUrl: import.meta.url,
  distDir: join(REPO_ROOT, 'apps/ariada-web/dist'),
  outputBaseName: '',
  buildHint: 'pnpm --filter ariada-web build',
}).catch((e) => {
  console.error('Self-cert scan failed:', e);
  process.exit(1);
});
