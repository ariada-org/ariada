#!/usr/bin/env node
/**
 * Self-cert scan for ariada.org (apps/ariada-org/dist) using
 * @ariada-org/wcag-rules-extended in static happy-dom mode.
 *
 * Sister script to scripts/self-cert-scan.mjs (which targets
 * apps/ariada-web/dist). Output lands at:
 *   audits/self-cert/2026-05-15-ariada-org.{json,md}
 *
 * Methodology mirrors self-cert-scan.mjs exactly so cross-site
 * comparison is apples-to-apples.
 *
 * Cross-tool baselines (axe-core via @axe-core/cli, pa11y) are
 * orchestrated separately — see docs/audits/2026-05-15-wcag-cross-tool-audit.md.
 */

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, relative } from 'node:path';
import { createRequire } from 'node:module';

const __filename_self = fileURLToPath(import.meta.url);
const _selfReq = createRequire(__filename_self);
const happyDomPath = _selfReq.resolve('happy-dom', {
  paths: [resolve(dirname(__filename_self), '../packages/wcag-rules-extended')],
});
const { Window } = await import(happyDomPath);

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const DIST_DIR = join(REPO_ROOT, 'apps/ariada-org/dist');
const AUDITS_DIR = join(REPO_ROOT, 'audits/self-cert');
const PACKAGE_DIR = join(REPO_ROOT, 'packages/wcag-rules-extended');

if (!existsSync(AUDITS_DIR)) mkdirSync(AUDITS_DIR, { recursive: true });

function listHtmlFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...listHtmlFiles(full));
    } else if (entry.endsWith('.html')) {
      out.push(full);
    }
  }
  return out;
}

async function scanFile(file, allRules, allChecks) {
  const window = new Window();
  const html = readFileSync(file, 'utf8');
  window.document.documentElement.innerHTML = html;
  const violations = [];

  for (const rule of allRules) {
    let candidates;
    try {
      candidates = window.document.querySelectorAll(rule.selector);
    } catch {
      continue;
    }
    const failingNodes = [];
    for (const node of candidates) {
      if (rule.matches && !rule.matches(node)) continue;
      let anyPassed = rule.any.length === 0;
      for (const cid of rule.any) {
        const fn = allChecks.get(cid);
        if (fn && fn(node)) {
          anyPassed = true;
          break;
        }
      }
      let allPassed = true;
      for (const cid of rule.all) {
        const fn = allChecks.get(cid);
        if (!fn || !fn(node)) {
          allPassed = false;
          break;
        }
      }
      let noneFailed = false;
      for (const cid of rule.none) {
        const fn = allChecks.get(cid);
        if (fn && fn(node)) {
          noneFailed = true;
          break;
        }
      }
      const passed = anyPassed && allPassed && !noneFailed;
      if (!passed) {
        failingNodes.push(node.tagName);
      }
    }
    if (failingNodes.length > 0) {
      violations.push({
        id: rule.id,
        wcag: rule.metadata.wcag,
        impact: rule.metadata.impact,
        nodeCount: failingNodes.length,
        nodeTags: failingNodes,
      });
    }
  }
  return violations;
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const pkgJson = JSON.parse(readFileSync(join(PACKAGE_DIR, 'package.json'), 'utf8'));
  const ariada = await import(join(PACKAGE_DIR, 'dist/index.js'));

  const allRules = ariada.allRules ?? [];
  const allChecks = new Map((ariada.allChecks ?? []).map((c) => [c.id, c.evaluate]));

  if (!existsSync(DIST_DIR)) {
    console.error(`ERROR: ${DIST_DIR} not found. Run pnpm --filter ariada-org build first.`);
    process.exit(2);
  }

  const files = listHtmlFiles(DIST_DIR);
  console.log(`Scanning ${files.length} HTML page(s) in apps/ariada-org/dist/...`);

  const perPage = [];
  let totalViolations = 0;
  let totalAffectedNodes = 0;

  for (const file of files) {
    const rel = relative(REPO_ROOT, file);
    const violations = await scanFile(file, allRules, allChecks);
    const nodeCount = violations.reduce((s, v) => s + v.nodeCount, 0);
    totalViolations += violations.length;
    totalAffectedNodes += nodeCount;
    perPage.push({
      page: rel,
      violationCount: violations.length,
      affectedNodes: nodeCount,
      violations,
    });
    process.stdout.write(`  ${violations.length === 0 ? '✓' : '✗'} ${rel} — ${violations.length} violation(s)\n`);
  }

  const report = {
    runAt: new Date().toISOString(),
    scannerVersion: pkgJson.version,
    scannerPackage: pkgJson.name,
    rulesCount: allRules.length,
    siteScanned: 'apps/ariada-org/dist',
    siteUrl: 'https://ariada.org/',
    pagesScanned: files.length,
    totalViolations,
    totalAffectedNodes,
    verdict: totalViolations === 0 ? 'PASS' : 'FAIL',
    perPage,
  };

  const jsonPath = join(AUDITS_DIR, `${today}-ariada-org.json`);
  const mdPath = join(AUDITS_DIR, `${today}-ariada-org.md`);

  writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  writeFileSync(mdPath, renderMarkdown(report));

  console.log(`\nVerdict: ${report.verdict}`);
  console.log(`  Total violations: ${totalViolations}`);
  console.log(`  Total affected nodes: ${totalAffectedNodes}`);
  console.log(`  Pages scanned: ${files.length}`);
  console.log(`\nReports written:`);
  console.log(`  ${jsonPath}`);
  console.log(`  ${mdPath}`);
}

function renderMarkdown(r) {
  const lines = [];
  lines.push(`# Self-cert audit — ariada.org — ${r.runAt.slice(0, 10)}`);
  lines.push('');
  lines.push(`> Self-attestation: ${r.scannerPackage}@${r.scannerVersion} run on ${r.siteScanned}.`);
  lines.push('> Reviewed and approved by Alexander Brichkin (Agonist Development AB).');
  lines.push('');
  lines.push(`**Verdict: ${r.verdict}**`);
  lines.push('');
  lines.push(`- Scanner: \`${r.scannerPackage}@${r.scannerVersion}\``);
  lines.push(`- Rules applied: ${r.rulesCount}`);
  lines.push(`- Pages scanned: ${r.pagesScanned}`);
  lines.push(`- Total violations: ${r.totalViolations}`);
  lines.push(`- Total affected nodes: ${r.totalAffectedNodes}`);
  lines.push(`- Site: \`${r.siteScanned}\` (live: ${r.siteUrl})`);
  lines.push(`- Run at: ${r.runAt}`);
  lines.push('');
  lines.push('## Per-page results');
  lines.push('');
  lines.push('| Page | Violations | Affected nodes |');
  lines.push('|------|-----------:|---------------:|');
  for (const p of r.perPage.sort((a, b) => b.violationCount - a.violationCount)) {
    lines.push(`| \`${p.page}\` | ${p.violationCount} | ${p.affectedNodes} |`);
  }
  lines.push('');
  if (r.totalViolations > 0) {
    lines.push('## Violation detail');
    lines.push('');
    for (const p of r.perPage) {
      if (p.violations.length === 0) continue;
      lines.push(`### ${p.page}`);
      lines.push('');
      lines.push('| Rule | WCAG | Impact | Nodes | Tags |');
      lines.push('|------|------|--------|------:|------|');
      for (const v of p.violations) {
        lines.push(`| \`${v.id}\` | ${v.wcag.join(', ')} | ${v.impact} | ${v.nodeCount} | ${(v.nodeTags ?? []).join(', ')} |`);
      }
      lines.push('');
    }
  }
  lines.push('## Methodology');
  lines.push('');
  lines.push('Static scan: each page loaded into happy-dom Window; all rule check');
  lines.push('functions from `@ariada-org/wcag-rules-extended` applied to candidate');
  lines.push('elements per rule selector. Violation recorded when AND-checks fail');
  lines.push('OR a none-check matches.');
  lines.push('');
  lines.push('Sister artefact: cross-tool comparison memo at');
  lines.push('`docs/audits/2026-05-15-wcag-cross-tool-audit.md` (axe-core baseline +');
  lines.push('pa11y baseline + statement-page honesty check).');
  lines.push('');
  return lines.join('\n');
}

main().catch((e) => {
  console.error('Self-cert scan failed:', e);
  process.exit(1);
});
