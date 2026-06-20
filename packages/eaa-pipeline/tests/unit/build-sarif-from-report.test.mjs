// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Unit tests for build-sarif-from-report.mjs.
 *
 * Uses node:test (built-in since Node 18) so the test suite has no
 * external dependencies — runnable on any GitHub-hosted runner without
 * pnpm install. Verifies:
 *   - Severity mapping (critical/serious → error, moderate → warning, minor → note)
 *   - SARIF shape conforms to GitHub code-scanning subset
 *   - Validator catches malformed input
 *   - Result count cap at 25 000
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  mapImpactToSarifLevel,
  buildPartialFingerprint,
  buildSarif,
  validateSarif,
} from '../../scripts/build-sarif-from-report.mjs';

const SCRIPT = fileURLToPath(
  new URL('../../scripts/build-sarif-from-report.mjs', import.meta.url),
);

// Run the script as a child process so we can observe CLI exit codes without
// process.exit tearing down the test runner.
const runCli = (args, { reportJson } = {}) => {
  const dir = mkdtempSync(join(tmpdir(), 'eaa-sarif-'));
  try {
    let inputPath = args.input;
    if (reportJson !== undefined) {
      inputPath = join(dir, 'report.json');
      writeFileSync(inputPath, reportJson);
    }
    const outputPath = join(dir, 'report.sarif');
    const res = spawnSync(
      process.execPath,
      [SCRIPT, inputPath ?? join(dir, 'missing.json'), outputPath],
      { encoding: 'utf8' },
    );
    let sarif;
    try {
      sarif = JSON.parse(readFileSync(outputPath, 'utf8'));
    } catch {
      sarif = undefined;
    }
    return { status: res.status, stderr: res.stderr, stdout: res.stdout, sarif };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

test('mapImpactToSarifLevel: critical → error', () => {
  assert.equal(mapImpactToSarifLevel('critical'), 'error');
});

test('mapImpactToSarifLevel: serious → error', () => {
  assert.equal(mapImpactToSarifLevel('serious'), 'error');
});

test('mapImpactToSarifLevel: moderate → warning', () => {
  assert.equal(mapImpactToSarifLevel('moderate'), 'warning');
});

test('mapImpactToSarifLevel: minor → note', () => {
  assert.equal(mapImpactToSarifLevel('minor'), 'note');
});

test('mapImpactToSarifLevel: unknown → note (fallback)', () => {
  assert.equal(mapImpactToSarifLevel('weird'), 'note');
});

test('buildPartialFingerprint: deterministic for same input', () => {
  const a = buildPartialFingerprint('color-contrast', 'https://example.com/');
  const b = buildPartialFingerprint('color-contrast', 'https://example.com/');
  assert.equal(a, b);
});

test('buildPartialFingerprint: differs for different URL', () => {
  const a = buildPartialFingerprint('color-contrast', 'https://a.example/');
  const b = buildPartialFingerprint('color-contrast', 'https://b.example/');
  assert.notEqual(a, b);
});

test('buildPartialFingerprint: format is <ruleId>/<hex-hash>', () => {
  const fp = buildPartialFingerprint('color-contrast', 'https://example.com/');
  assert.match(fp, /^color-contrast\/[0-9a-f]+$/);
});

test('buildSarif: produces valid SARIF 2.1.0 envelope', () => {
  const report = {
    runAt: '2026-05-19T00:00:00.000Z',
    siteUrl: 'https://example.com',
    scannerPack: '@ariada-org/wcag-rules-extended',
    scannerPackVersion: '0.2.1',
    pagesScanned: 1,
    totalViolations: 1,
    totalsByImpact: { critical: 0, serious: 1, moderate: 0, minor: 0 },
    failOn: ['serious', 'critical'],
    verdict: 'FAIL',
    perPage: [
      {
        url: 'https://example.com/',
        violationCount: 1,
        counts: { critical: 0, serious: 1, moderate: 0, minor: 0 },
        violations: [
          {
            id: 'color-contrast',
            impact: 'serious',
            description: 'Elements must meet minimum colour contrast thresholds',
            helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/color-contrast',
            nodeCount: 4,
          },
        ],
      },
    ],
  };
  const sarif = buildSarif(report);
  assert.equal(sarif.version, '2.1.0');
  assert.ok(sarif.$schema.includes('sarif'));
  assert.equal(sarif.runs.length, 1);
  assert.equal(sarif.runs[0].tool.driver.name, '@ariada-org/wcag-rules-extended');
  assert.equal(sarif.runs[0].tool.driver.semanticVersion, '0.2.1');
  assert.equal(sarif.runs[0].results.length, 1);
  const r = sarif.runs[0].results[0];
  assert.equal(r.ruleId, 'color-contrast');
  assert.equal(r.level, 'error'); // serious → error
  assert.equal(r.properties.impact, 'serious'); // raw impact preserved
  assert.equal(r.locations[0].physicalLocation.artifactLocation.uri, 'https://example.com/');
});

test('buildSarif: rule deduplication across pages', () => {
  const report = {
    siteUrl: 'https://example.com',
    scannerPackVersion: '0.1.0',
    perPage: [
      {
        url: 'https://example.com/a',
        violations: [
          { id: 'color-contrast', impact: 'serious', description: 'contrast', helpUrl: '', nodeCount: 1 },
        ],
      },
      {
        url: 'https://example.com/b',
        violations: [
          { id: 'color-contrast', impact: 'serious', description: 'contrast', helpUrl: '', nodeCount: 2 },
        ],
      },
    ],
  };
  const sarif = buildSarif(report);
  // 1 rule definition, 2 result entries
  assert.equal(sarif.runs[0].tool.driver.rules.length, 1);
  assert.equal(sarif.runs[0].results.length, 2);
});

test('buildSarif: 25k truncation cap', () => {
  const violations = [];
  // 30k synthetic violations — minor (last impact priority)
  for (let i = 0; i < 30_000; i += 1) {
    violations.push({
      id: `rule-${i}`,
      impact: 'minor',
      description: `desc ${i}`,
      helpUrl: '',
      nodeCount: 1,
    });
  }
  // 100 critical — should win priority truncation
  for (let i = 0; i < 100; i += 1) {
    violations.push({
      id: `critical-${i}`,
      impact: 'critical',
      description: `crit ${i}`,
      helpUrl: '',
      nodeCount: 1,
    });
  }
  const report = {
    perPage: [{ url: 'https://x', violations }],
  };
  const sarif = buildSarif(report);
  assert.equal(sarif.runs[0].results.length, 25_000);
  // First result must be one of the 100 critical entries (priority sort).
  assert.equal(sarif.runs[0].results[0].level, 'error');
  assert.equal(sarif.runs[0].results[0].properties.impact, 'critical');
});

test('validateSarif: clean SARIF returns no errors', () => {
  const sarif = {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: { driver: { name: 'x', rules: [] } },
        results: [
          {
            ruleId: 'r',
            level: 'note',
            message: { text: 'm' },
            locations: [{ physicalLocation: { artifactLocation: { uri: 'https://x' } } }],
          },
        ],
      },
    ],
  };
  const errs = validateSarif(sarif);
  assert.deepEqual(errs, []);
});

test('validateSarif: detects wrong version', () => {
  const sarif = {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.0.0',
    runs: [{ tool: { driver: { name: 'x', rules: [] } }, results: [] }],
  };
  const errs = validateSarif(sarif);
  assert.ok(errs.some((e) => e.includes('2.1.0')));
});

test('validateSarif: detects invalid level', () => {
  const sarif = {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: { driver: { name: 'x', rules: [] } },
        results: [
          {
            ruleId: 'r',
            level: 'critical', // INVALID — must be error|warning|note|none
            message: { text: 'm' },
            locations: [{ physicalLocation: { artifactLocation: { uri: 'https://x' } } }],
          },
        ],
      },
    ],
  };
  const errs = validateSarif(sarif);
  assert.ok(errs.some((e) => e.includes('level must be')));
});

// ---------------------------------------------------------------------------
// Impact → SARIF level: full four-level mapping with raw impact preserved.
// ---------------------------------------------------------------------------

test('mapImpactToSarifLevel: all four axe levels map per policy', () => {
  assert.equal(mapImpactToSarifLevel('critical'), 'error');
  assert.equal(mapImpactToSarifLevel('serious'), 'error');
  assert.equal(mapImpactToSarifLevel('moderate'), 'warning');
  assert.equal(mapImpactToSarifLevel('minor'), 'note');
});

test('buildSarif: raw impact preserved in properties.impact for every level', () => {
  const report = {
    siteUrl: 'https://example.com',
    scannerPackVersion: '0.1.0',
    perPage: [
      {
        url: 'https://example.com/',
        violations: [
          { id: 'a', impact: 'critical', description: 'd', helpUrl: '', nodeCount: 1 },
          { id: 'b', impact: 'serious', description: 'd', helpUrl: '', nodeCount: 1 },
          { id: 'c', impact: 'moderate', description: 'd', helpUrl: '', nodeCount: 1 },
          { id: 'd', impact: 'minor', description: 'd', helpUrl: '', nodeCount: 1 },
        ],
      },
    ],
  };
  const results = buildSarif(report).runs[0].results;
  const byRule = Object.fromEntries(results.map((r) => [r.ruleId, r]));
  // SARIF level mapping…
  assert.equal(byRule.a.level, 'error');
  assert.equal(byRule.b.level, 'error');
  assert.equal(byRule.c.level, 'warning');
  assert.equal(byRule.d.level, 'note');
  // …and the raw axe impact survives unchanged alongside it.
  assert.equal(byRule.a.properties.impact, 'critical');
  assert.equal(byRule.b.properties.impact, 'serious');
  assert.equal(byRule.c.properties.impact, 'moderate');
  assert.equal(byRule.d.properties.impact, 'minor');
});

test('buildSarif: missing impact defaults to minor (→ note)', () => {
  const report = {
    perPage: [
      {
        url: 'https://x',
        violations: [{ id: 'r', description: 'd', helpUrl: '', nodeCount: 1 }],
      },
    ],
  };
  const r = buildSarif(report).runs[0].results[0];
  assert.equal(r.properties.impact, 'minor');
  assert.equal(r.level, 'note');
});

// ---------------------------------------------------------------------------
// Empty-results SARIF — a clean scan still produces a valid envelope.
// ---------------------------------------------------------------------------

test('buildSarif: empty perPage → valid SARIF with zero results', () => {
  const sarif = buildSarif({ siteUrl: 'https://x', perPage: [] });
  assert.equal(sarif.version, '2.1.0');
  assert.equal(sarif.runs[0].results.length, 0);
  assert.equal(sarif.runs[0].tool.driver.rules.length, 0);
  assert.equal(sarif.runs[0].properties.truncated, false);
  assert.equal(sarif.runs[0].properties.originalResultCount, 0);
  // A zero-result SARIF must still validate as a GitHub-acceptable document.
  assert.deepEqual(validateSarif(sarif), []);
});

test('buildSarif: pages with no violations array → zero results', () => {
  const sarif = buildSarif({
    perPage: [{ url: 'https://x' }, { url: 'https://y', violations: [] }],
  });
  assert.equal(sarif.runs[0].results.length, 0);
});

// ---------------------------------------------------------------------------
// Result-count cap: under-cap pass-through, exactly-at-cap, over-cap truncate.
// ---------------------------------------------------------------------------

const makeViolations = (count, impact) => {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    out.push({ id: `rule-${i}`, impact, description: `d ${i}`, helpUrl: '', nodeCount: 1 });
  }
  return out;
};

test('buildSarif: under cap passes through untruncated', () => {
  const sarif = buildSarif({
    perPage: [{ url: 'https://x', violations: makeViolations(10, 'serious') }],
  });
  assert.equal(sarif.runs[0].results.length, 10);
  assert.equal(sarif.runs[0].properties.truncated, false);
  assert.equal(sarif.runs[0].properties.originalResultCount, 10);
});

test('buildSarif: exactly at the 25 000 cap is NOT truncated', () => {
  const sarif = buildSarif({
    perPage: [{ url: 'https://x', violations: makeViolations(25_000, 'minor') }],
  });
  // Boundary: cap is a maximum, so exactly-at-cap passes through whole.
  assert.equal(sarif.runs[0].results.length, 25_000);
  assert.equal(sarif.runs[0].properties.truncated, false);
  assert.equal(sarif.runs[0].properties.originalResultCount, 25_000);
});

test('buildSarif: one over the cap truncates and records original count', () => {
  const sarif = buildSarif({
    perPage: [{ url: 'https://x', violations: makeViolations(25_001, 'minor') }],
  });
  assert.equal(sarif.runs[0].results.length, 25_000);
  assert.equal(sarif.runs[0].properties.truncated, true);
  assert.equal(sarif.runs[0].properties.originalResultCount, 25_001);
});

test('buildSarif: over-cap truncation keeps critical over minor (priority sort)', () => {
  const violations = [
    ...makeViolations(25_000, 'minor'),
    ...makeViolations(50, 'critical').map((v) => ({ ...v, id: `crit-${v.id}` })),
  ];
  const results = buildSarif({ perPage: [{ url: 'https://x', violations }] }).runs[0].results;
  assert.equal(results.length, 25_000);
  // All 50 critical entries must survive; none should be dropped in favour of minors.
  const criticalKept = results.filter((r) => r.properties.impact === 'critical').length;
  assert.equal(criticalKept, 50);
  assert.equal(results[0].properties.impact, 'critical');
});

test('buildSarif: over-cap emits ::warning:: annotation on stderr', () => {
  const original = console.warn;
  const messages = [];
  console.warn = (msg) => messages.push(msg);
  try {
    buildSarif({ perPage: [{ url: 'https://x', violations: makeViolations(25_001, 'minor') }] });
  } finally {
    console.warn = original;
  }
  assert.ok(messages.some((m) => m.includes('::warning::') && m.includes('25000')));
});

test('buildSarif: at-cap does NOT emit a truncation warning', () => {
  const original = console.warn;
  const messages = [];
  console.warn = (msg) => messages.push(msg);
  try {
    buildSarif({ perPage: [{ url: 'https://x', violations: makeViolations(25_000, 'minor') }] });
  } finally {
    console.warn = original;
  }
  assert.equal(messages.length, 0);
});

// ---------------------------------------------------------------------------
// validateSarif: cap, driver, and locations structural checks.
// ---------------------------------------------------------------------------

test('validateSarif: detects results array over the cap', () => {
  const sarif = {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: { driver: { name: 'x', rules: [] } },
        results: makeViolations(25_001, 'minor').map(() => ({
          ruleId: 'r',
          level: 'note',
          message: { text: 'm' },
          locations: [{ physicalLocation: { artifactLocation: { uri: 'https://x' } } }],
        })),
      },
    ],
  };
  const errs = validateSarif(sarif);
  assert.ok(errs.some((e) => e.includes('GitHub caps at 25000')));
});

test('validateSarif: detects missing driver', () => {
  const errs = validateSarif({
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [{ tool: {}, results: [] }],
  });
  assert.ok(errs.some((e) => e.includes('tool.driver missing')));
});

test('validateSarif: detects empty locations array', () => {
  const errs = validateSarif({
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: { driver: { name: 'x', rules: [] } },
        results: [{ ruleId: 'r', level: 'note', message: { text: 'm' }, locations: [] }],
      },
    ],
  });
  assert.ok(errs.some((e) => e.includes('locations[] must be non-empty')));
});

test('validateSarif: detects empty runs array', () => {
  const errs = validateSarif({
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [],
  });
  assert.ok(errs.some((e) => e.includes('runs[] must be a non-empty array')));
});

// ---------------------------------------------------------------------------
// buildSarif: rule shortDescription truncated to 256 chars; helpUri fallback.
// ---------------------------------------------------------------------------

test('buildSarif: rule shortDescription truncated to 256 chars', () => {
  const longDesc = 'x'.repeat(500);
  const sarif = buildSarif({
    perPage: [
      {
        url: 'https://x',
        violations: [{ id: 'r', impact: 'minor', description: longDesc, helpUrl: '', nodeCount: 1 }],
      },
    ],
  });
  const rule = sarif.runs[0].tool.driver.rules[0];
  assert.equal(rule.shortDescription.text.length, 256);
  // fullDescription keeps the whole string.
  assert.equal(rule.fullDescription.text.length, 500);
});

test('buildSarif: rule helpUri falls back to pack homepage when helpUrl empty', () => {
  const sarif = buildSarif({
    perPage: [
      {
        url: 'https://x',
        violations: [{ id: 'r', impact: 'minor', description: 'd', helpUrl: '', nodeCount: 1 }],
      },
    ],
  });
  // Anchor at the URL origin: an unanchored substring match would also accept
  // look-alike hosts such as `https://github.com.evil.test/ariada-org/ariada`.
  // The trailing slash is intentional — we do not anchor the end because
  // helpUri may carry an arbitrary path suffix (e.g., blob/main/README.md).
  // codeql[js/regex/missing-regexp-anchor]
  assert.match(
    sarif.runs[0].tool.driver.rules[0].helpUri,
    /^https:\/\/github\.com\/ariada-org\/ariada\//,
  );
});

test('buildSarif: missing scannerPackVersion defaults to 0.0.0', () => {
  const sarif = buildSarif({ perPage: [] });
  assert.equal(sarif.runs[0].tool.driver.semanticVersion, '0.0.0');
});

// ---------------------------------------------------------------------------
// CLI exit-code behaviour (run via subprocess — process.exit can't be tested
// in-process without killing the runner). These are local, no network.
// ---------------------------------------------------------------------------

test('CLI: valid report → exit 0 and writes SARIF', () => {
  const report = JSON.stringify({
    siteUrl: 'https://example.com',
    scannerPackVersion: '0.1.0',
    perPage: [
      {
        url: 'https://example.com/',
        violations: [
          { id: 'color-contrast', impact: 'serious', description: 'd', helpUrl: '', nodeCount: 1 },
        ],
      },
    ],
  });
  const { status, sarif } = runCli({}, { reportJson: report });
  assert.equal(status, 0);
  assert.equal(sarif.version, '2.1.0');
  assert.equal(sarif.runs[0].results.length, 1);
});

test('CLI: missing input file → exit 2', () => {
  const { status, stderr } = runCli({});
  assert.equal(status, 2);
  assert.match(stderr, /not found/);
});

test('CLI: non-JSON input → exit 2', () => {
  const { status, stderr } = runCli({}, { reportJson: 'not json at all {' });
  assert.equal(status, 2);
  assert.match(stderr, /not valid JSON/);
});

test('CLI: clean scan (no violations) → exit 0', () => {
  const report = JSON.stringify({ siteUrl: 'https://example.com', perPage: [] });
  const { status, sarif } = runCli({}, { reportJson: report });
  assert.equal(status, 0);
  assert.equal(sarif.runs[0].results.length, 0);
});
