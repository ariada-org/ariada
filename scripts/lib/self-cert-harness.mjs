#!/usr/bin/env node
/**
 * Shared self-cert scan harness — consumed by scripts/self-cert-*.mjs
 * wrappers. Each wrapper supplies a target-specific config; the harness
 * does the actual scan, JSON serialisation, and Markdown rendering.
 *
 * Methodology: static scan via happy-dom. Each HTML page in distDir
 * is loaded as a DOM tree; every rule from @ariada-org/wcag-rules-extended
 * is applied to candidate elements per its selector. A violation is
 * recorded when AND-checks fail OR a none-check matches.
 *
 * Limitation: STATIC scan. Interactive flows (form submission, keyboard
 * navigation, focus management on client-side route changes) require a
 * real browser engine and are tracked separately under audits/runtime-cert/.
 */

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, relative } from 'node:path';
import { createRequire } from 'node:module';

const __filename_self = fileURLToPath(import.meta.url);
const _selfReq = createRequire(__filename_self);

/**
 * Resolve happy-dom from the wcag-rules-extended package (it's a dev-dep there).
 * Returns the Window constructor.
 */
async function loadHappyDom(repoRoot) {
  const happyDomPath = _selfReq.resolve('happy-dom', {
    paths: [resolve(repoRoot, 'packages/wcag-rules-extended')],
  });
  const mod = await import(happyDomPath);
  return mod.Window;
}

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

async function scanFile(file, Window, allRules, allChecks, { includeNodeTags }) {
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
      if (!(anyPassed && allPassed && !noneFailed)) {
        failingNodes.push(node.tagName);
      }
    }

    if (failingNodes.length > 0) {
      const entry = {
        id: rule.id,
        wcag: rule.metadata.wcag,
        impact: rule.metadata.impact,
        nodeCount: failingNodes.length,
      };
      if (includeNodeTags) entry.nodeTags = failingNodes;
      violations.push(entry);
    }
  }
  return violations;
}

function renderMarkdown(r, { titleSuffix, includeNodeTags, methodology }) {
  const lines = [];
  lines.push(`# Self-cert audit${titleSuffix ? ' — ' + titleSuffix : ''} — ${r.runAt.slice(0, 10)}`);
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
  const siteLine = r.siteUrl
    ? `- Site: \`${r.siteScanned}\` (live: ${r.siteUrl})`
    : `- Site: \`${r.siteScanned}\``;
  lines.push(siteLine);
  lines.push(`- Run at: ${r.runAt}`);
  lines.push('');
  lines.push('## Per-page results');
  lines.push('');
  lines.push('| Page | Violations | Affected nodes |');
  lines.push('|------|-----------:|---------------:|');
  for (const p of r.perPage.slice().sort((a, b) => b.violationCount - a.violationCount)) {
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
      if (includeNodeTags) {
        lines.push('| Rule | WCAG | Impact | Nodes | Tags |');
        lines.push('|------|------|--------|------:|------|');
        for (const v of p.violations) {
          lines.push(`| \`${v.id}\` | ${v.wcag.join(', ')} | ${v.impact} | ${v.nodeCount} | ${(v.nodeTags ?? []).join(', ')} |`);
        }
      } else {
        lines.push('| Rule | WCAG | Impact | Nodes |');
        lines.push('|------|------|--------|------:|');
        for (const v of p.violations) {
          lines.push(`| \`${v.id}\` | ${v.wcag.join(', ')} | ${v.impact} | ${v.nodeCount} |`);
        }
      }
      lines.push('');
    }
  }
  lines.push('## Methodology');
  lines.push('');
  if (methodology && methodology.length) {
    for (const m of methodology) lines.push(m);
  } else {
    lines.push('Each page is loaded into a `happy-dom` Window. All rule check');
    lines.push('functions from `@ariada-org/wcag-rules-extended` are applied to');
    lines.push('candidate elements per rule selector. A violation is recorded');
    lines.push('when the rule\'s AND-checks fail OR a none-check matches.');
    lines.push('');
    lines.push('**Note:** this is a STATIC scan — it does not exercise interactive');
    lines.push('flows (form submission, keyboard navigation, focus management on');
    lines.push('client-side route changes). Those checks require a real browser');
    lines.push('engine and are tracked separately under `audits/runtime-cert/`.');
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * Run the self-cert harness against a target.
 *
 * @param {object} cfg
 * @param {string} cfg.callerUrl        — caller's `import.meta.url`. Used to
 *                                       locate the repository root relative to
 *                                       the caller's filesystem position. The
 *                                       wrapper script must pass `import.meta.url`
 *                                       so the harness resolves the audit + package
 *                                       directories correctly even when the wrapper
 *                                       is invoked from outside its own directory.
 * @param {string} cfg.distDir          — absolute path to the dist/ directory to scan
 * @param {string} cfg.outputBaseName   — output filename stem (date prefix appended).
 *                                       e.g. '' → '2026-05-21.json'; 'ariada-org' → '2026-05-21-ariada-org.json'
 * @param {string} cfg.buildHint        — text shown when distDir is missing,
 *                                       e.g. 'pnpm --filter ariada-web build'
 * @param {string} [cfg.siteUrl]        — public URL of the deployed site (optional)
 * @param {string} [cfg.titleSuffix]    — appended to Markdown H1 title (e.g. 'ariada.org')
 * @param {boolean} [cfg.includeNodeTags] — emit per-violation HTML element tags
 * @param {string[]} [cfg.methodology]  — override default Methodology section lines
 */
export async function runSelfCert(cfg) {
  const __dirname = dirname(fileURLToPath(cfg.callerUrl));
  const REPO_ROOT = resolve(__dirname, '..');
  const PACKAGE_DIR = join(REPO_ROOT, 'packages/wcag-rules-extended');
  const AUDITS_DIR = join(REPO_ROOT, 'audits/self-cert');

  if (!existsSync(AUDITS_DIR)) mkdirSync(AUDITS_DIR, { recursive: true });

  if (!existsSync(cfg.distDir)) {
    console.error(`ERROR: ${cfg.distDir} not found. Run ${cfg.buildHint} first.`);
    process.exit(2);
  }

  const Window = await loadHappyDom(REPO_ROOT);
  const pkgJson = JSON.parse(readFileSync(join(PACKAGE_DIR, 'package.json'), 'utf8'));
  const ariada = await import(join(PACKAGE_DIR, 'dist/index.js'));

  const allRules = ariada.allRules ?? [];
  const allChecks = new Map((ariada.allChecks ?? []).map((c) => [c.id, c.evaluate]));

  const files = listHtmlFiles(cfg.distDir);
  const relDist = relative(REPO_ROOT, cfg.distDir);
  console.log(`Scanning ${files.length} HTML page(s) in ${relDist}/...`);

  const perPage = [];
  let totalViolations = 0;
  let totalAffectedNodes = 0;

  for (const file of files) {
    const rel = relative(REPO_ROOT, file);
    const violations = await scanFile(file, Window, allRules, allChecks, { includeNodeTags: !!cfg.includeNodeTags });
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

  const today = new Date().toISOString().slice(0, 10);
  const report = {
    runAt: new Date().toISOString(),
    scannerVersion: pkgJson.version,
    scannerPackage: pkgJson.name,
    rulesCount: allRules.length,
    siteScanned: relDist,
    ...(cfg.siteUrl ? { siteUrl: cfg.siteUrl } : {}),
    pagesScanned: files.length,
    totalViolations,
    totalAffectedNodes,
    verdict: totalViolations === 0 ? 'PASS' : 'FAIL',
    perPage,
  };

  const fileStem = cfg.outputBaseName ? `${today}-${cfg.outputBaseName}` : today;
  const jsonPath = join(AUDITS_DIR, `${fileStem}.json`);
  const mdPath = join(AUDITS_DIR, `${fileStem}.md`);

  writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  writeFileSync(mdPath, renderMarkdown(report, {
    titleSuffix: cfg.titleSuffix,
    includeNodeTags: !!cfg.includeNodeTags,
    methodology: cfg.methodology,
  }));

  console.log(`\nVerdict: ${report.verdict}`);
  console.log(`  Total violations: ${totalViolations}`);
  console.log(`  Total affected nodes: ${totalAffectedNodes}`);
  console.log(`  Pages scanned: ${files.length}`);
  console.log(`\nReports written:`);
  console.log(`  ${jsonPath}`);
  console.log(`  ${mdPath}`);
}
