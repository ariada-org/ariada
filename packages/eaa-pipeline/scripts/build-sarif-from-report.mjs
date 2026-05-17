#!/usr/bin/env node
// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * build-sarif-from-report.mjs
 *
 * Fallback SARIF 2.1.0 builder used by `.github/workflows/eaa-audit.yml`
 * when `bin/run-eaa-audit.mjs` (the rule-pack runtime) does not emit
 * `report.sarif` itself.  Reads `eaa-out/report.json` and writes
 * `eaa-out/report.sarif` conforming to:
 *
 *   - OASIS SARIF 2.1.0 spec
 *     https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html
 *   - GitHub code-scanning SARIF subset
 *     https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning
 *
 * Severity mapping (canonical per PRD §3.4):
 *   critical, serious  → "error"
 *   moderate           → "warning"
 *   minor              → "note"
 *
 * Result count cap: 25 000 results per run (GitHub policy).  When the
 * report exceeds the cap, this script truncates by impact priority
 * (critical → minor) and emits a `::warning::` annotation.
 *
 * Pure stdlib (Node ≥ 18).  No external dependencies, no network.
 *
 * Usage:
 *   node build-sarif-from-report.mjs <input-report.json> <output-report.sarif>
 *
 * Exit codes:
 *   0  success — SARIF written
 *   2  invalid input file (missing / not JSON)
 *   3  invalid report shape (missing required fields)
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const SARIF_RESULT_CAP = 25_000;
const SARIF_SCHEMA = 'https://json.schemastore.org/sarif-2.1.0.json';
const SARIF_VERSION = '2.1.0';
const PACK_NAME = '@ariada/wcag-rules-extended';
const PACK_HOMEPAGE =
  'https://github.com/ariada-org/ariada/tree/main/packages/wcag-rules-extended';

/**
 * @param {string} impact axe-core impact level
 * @returns {'error'|'warning'|'note'} SARIF result.level per PRD §3.4
 */
export function mapImpactToSarifLevel(impact) {
  switch (impact) {
    case 'critical':
    case 'serious':
      return 'error';
    case 'moderate':
      return 'warning';
    case 'minor':
      return 'note';
    default:
      return 'note';
  }
}

/**
 * Stable partial fingerprint for GitHub dedup.
 * Format: `<ruleId>/<urlHash>` per PRD §3.4.
 * @param {string} ruleId axe-core rule id
 * @param {string} url URL where the violation was found
 * @returns {string}
 */
export function buildPartialFingerprint(ruleId, url) {
  // Cheap stable hash — FNV-1a 32-bit; not cryptographic but adequate
  // for SARIF dedup, deterministic, no external deps.
  let hash = 0x811c9dc5;
  for (let i = 0; i < url.length; i += 1) {
    hash ^= url.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${ruleId}/${hash.toString(16)}`;
}

/**
 * @param {import('node:fs').PathLike} reportPath
 * @returns {object}
 */
function readReport(reportPath) {
  if (!existsSync(reportPath)) {
    console.error(`::error::input report.json not found at ${reportPath}`);
    process.exit(2);
  }
  let raw;
  try {
    raw = readFileSync(reportPath, 'utf8');
  } catch (err) {
    console.error(`::error::cannot read ${reportPath}: ${err.message}`);
    process.exit(2);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error(`::error::${reportPath} is not valid JSON: ${err.message}`);
    process.exit(2);
  }
}

const IMPACT_PRIORITY = { critical: 0, serious: 1, moderate: 2, minor: 3 };

/**
 * Build the full SARIF 2.1.0 log from a report.json shape.
 * @param {object} report
 * @returns {object}
 */
export function buildSarif(report) {
  if (!report || typeof report !== 'object') {
    console.error('::error::report is not an object');
    process.exit(3);
  }
  const perPage = Array.isArray(report.perPage) ? report.perPage : [];
  const packVersion =
    typeof report.scannerPackVersion === 'string'
      ? report.scannerPackVersion
      : '0.0.0';

  /** @type {Map<string, object>} */
  const rulesById = new Map();
  /** @type {Array<object>} */
  const allResults = [];

  for (const page of perPage) {
    const pageUrl = typeof page.url === 'string' ? page.url : '';
    const violations = Array.isArray(page.violations) ? page.violations : [];
    for (const v of violations) {
      const ruleId = typeof v.id === 'string' ? v.id : 'unknown';
      const impact = typeof v.impact === 'string' ? v.impact : 'minor';
      const description =
        typeof v.description === 'string' ? v.description : ruleId;
      const helpUrl = typeof v.helpUrl === 'string' ? v.helpUrl : '';
      const nodeCount =
        typeof v.nodeCount === 'number' && Number.isFinite(v.nodeCount)
          ? v.nodeCount
          : 0;

      if (!rulesById.has(ruleId)) {
        rulesById.set(ruleId, {
          id: ruleId,
          name: ruleId,
          shortDescription: { text: description.slice(0, 256) },
          fullDescription: { text: description },
          helpUri: helpUrl || PACK_HOMEPAGE,
          properties: {
            tags: ['accessibility', 'wcag', `impact-${impact}`],
          },
        });
      }

      allResults.push({
        ruleId,
        level: mapImpactToSarifLevel(impact),
        message: { text: description },
        locations: [
          {
            physicalLocation: {
              artifactLocation: { uri: pageUrl },
            },
          },
        ],
        properties: {
          impact,
          helpUrl,
          nodeCount,
        },
        partialFingerprints: {
          'rule/url': buildPartialFingerprint(ruleId, pageUrl),
        },
      });
    }
  }

  // Truncate to SARIF_RESULT_CAP by impact priority (critical → minor).
  let truncated = false;
  if (allResults.length > SARIF_RESULT_CAP) {
    truncated = true;
    allResults.sort((a, b) => {
      const pa = IMPACT_PRIORITY[a.properties.impact] ?? 99;
      const pb = IMPACT_PRIORITY[b.properties.impact] ?? 99;
      return pa - pb;
    });
    allResults.length = SARIF_RESULT_CAP;
    console.warn(
      `::warning::SARIF result count exceeds GitHub cap of ${SARIF_RESULT_CAP}; truncated by impact priority (critical → minor)`,
    );
  }

  return {
    $schema: SARIF_SCHEMA,
    version: SARIF_VERSION,
    runs: [
      {
        tool: {
          driver: {
            name: PACK_NAME,
            semanticVersion: packVersion,
            informationUri: PACK_HOMEPAGE,
            rules: Array.from(rulesById.values()),
          },
        },
        results: allResults,
        properties: {
          truncated,
          originalResultCount:
            allResults.length + (truncated ? 0 : 0) /* updated below */,
        },
      },
    ],
  };
}

/**
 * Validate SARIF document satisfies the GitHub code-scanning subset.
 * Returns array of human-readable errors; empty array on success.
 * @param {object} sarif
 * @returns {string[]}
 */
export function validateSarif(sarif) {
  /** @type {string[]} */
  const errors = [];
  if (!sarif || typeof sarif !== 'object') {
    errors.push('sarif is not an object');
    return errors;
  }
  if (sarif.version !== SARIF_VERSION) {
    errors.push(`version must be "${SARIF_VERSION}" (got: ${sarif.version})`);
  }
  if (typeof sarif.$schema !== 'string' || !sarif.$schema.includes('sarif')) {
    errors.push('$schema must be a SARIF schema URL');
  }
  if (!Array.isArray(sarif.runs) || sarif.runs.length === 0) {
    errors.push('runs[] must be a non-empty array');
    return errors;
  }
  for (const [i, run] of sarif.runs.entries()) {
    const driver = run?.tool?.driver;
    if (!driver) {
      errors.push(`runs[${i}].tool.driver missing`);
      continue;
    }
    if (typeof driver.name !== 'string' || !driver.name) {
      errors.push(`runs[${i}].tool.driver.name missing`);
    }
    if (!Array.isArray(driver.rules)) {
      errors.push(`runs[${i}].tool.driver.rules must be an array`);
    }
    if (!Array.isArray(run.results)) {
      errors.push(`runs[${i}].results must be an array`);
      continue;
    }
    if (run.results.length > SARIF_RESULT_CAP) {
      errors.push(
        `runs[${i}].results has ${run.results.length} entries; GitHub caps at ${SARIF_RESULT_CAP}`,
      );
    }
    for (const [j, r] of run.results.entries()) {
      if (!r || typeof r !== 'object') {
        errors.push(`runs[${i}].results[${j}] not an object`);
        continue;
      }
      if (typeof r.ruleId !== 'string') {
        errors.push(`runs[${i}].results[${j}].ruleId must be string`);
      }
      if (!['error', 'warning', 'note', 'none'].includes(r.level)) {
        errors.push(
          `runs[${i}].results[${j}].level must be one of error|warning|note|none (got: ${r.level})`,
        );
      }
      if (!r.message || typeof r.message.text !== 'string') {
        errors.push(`runs[${i}].results[${j}].message.text must be string`);
      }
      if (!Array.isArray(r.locations) || r.locations.length === 0) {
        errors.push(`runs[${i}].results[${j}].locations[] must be non-empty`);
      }
    }
  }
  return errors;
}

// CLI entry point — only run when invoked as a script, not when imported.
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const [, , inputArg, outputArg] = process.argv;
  if (!inputArg || !outputArg) {
    console.error(
      'usage: node build-sarif-from-report.mjs <report.json> <report.sarif>',
    );
    process.exit(2);
  }
  const inputPath = resolve(process.cwd(), inputArg);
  const outputPath = resolve(process.cwd(), outputArg);

  const report = readReport(inputPath);
  const sarif = buildSarif(report);
  const errs = validateSarif(sarif);
  if (errs.length > 0) {
    for (const e of errs) {
      console.error(`::error::SARIF validation: ${e}`);
    }
    process.exit(3);
  }
  writeFileSync(outputPath, JSON.stringify(sarif, null, 2));
  const totalResults = sarif.runs[0].results.length;
  const totalRules = sarif.runs[0].tool.driver.rules.length;
  console.log(
    `SARIF written: ${outputPath} (${totalRules} rules, ${totalResults} results)`,
  );
}
