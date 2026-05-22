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
import {
  mapImpactToSarifLevel,
  buildPartialFingerprint,
  buildSarif,
  validateSarif,
} from '../../scripts/build-sarif-from-report.mjs';

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
