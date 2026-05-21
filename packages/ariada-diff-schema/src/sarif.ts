// SPDX-License-Identifier: EUPL-1.2
//
// SARIF 2.1.0 emitter (§3.9). One `run` per DiffResult, one `result`
// per finding in `classification.new[]` only — pre-existing and resolved
// findings are not emitted to SARIF since they are not actionable for
// the typical SARIF consumer.
//
// Reference: OASIS SARIF Version 2.1.0 (2020-03-27).

import type { DiffResult, FindingWithFingerprint } from './diff-result.js';
import type { Severity } from './fingerprint.js';

/** SARIF severity level. */
type SarifLevel = 'error' | 'warning' | 'note' | 'none';

const SARIF_VERSION = '2.1.0';
const SARIF_SCHEMA_URI =
  'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json';
const TOOL_NAME = 'ariada-diff';
const TOOL_INFORMATION_URI = 'https://ariada.org/';

/**
 * Map ariada severity to SARIF level.
 *
 *   critical / serious → error
 *   moderate           → warning
 *   minor              → note
 */
function severityToLevel(severity: Severity): SarifLevel {
  switch (severity) {
    case 'critical':
    case 'serious':
      return 'error';
    case 'moderate':
      return 'warning';
    case 'minor':
      return 'note';
  }
}

interface SarifResult {
  ruleId: string;
  level: SarifLevel;
  message: { text: string };
  locations: Array<{
    physicalLocation: {
      artifactLocation: { uri: string };
    };
  }>;
  fingerprints: Record<string, string>;
  partialFingerprints: Record<string, string>;
}

interface SarifRun {
  tool: {
    driver: {
      name: string;
      version: string;
      informationUri: string;
      rules?: Array<{ id: string; name?: string }>;
    };
  };
  results: SarifResult[];
}

/**
 *
 */
export interface SarifDocument {
  $schema: string;
  version: string;
  runs: SarifRun[];
}

/**
 * Emit a SARIF 2.1.0 document from a DiffResult. Only `classification.new`
 * findings produce SARIF results; pre-existing + resolved are filtered out.
 */
export function emitSarif(diff: DiffResult): SarifDocument {
  const findings = diff.classification.new;
  const results: SarifResult[] = findings.map((f) => buildResult(f));
  const ruleIds = new Set<string>();
  for (const r of results) ruleIds.add(r.ruleId);
  // Default string sort uses UTF-16 code-unit ordering, which gives
  // byte-stable SARIF output across runs without invoking locale rules.
  const rules = [...ruleIds].sort().map((id) => ({ id }));

  const doc: SarifDocument = {
    $schema: SARIF_SCHEMA_URI,
    version: SARIF_VERSION,
    runs: [
      {
        tool: {
          driver: {
            name: TOOL_NAME,
            version: diff.engine_info.classifier_version,
            informationUri: TOOL_INFORMATION_URI,
            rules,
          },
        },
        results,
      },
    ],
  };
  return doc;
}

function buildResult(f: FindingWithFingerprint): SarifResult {
  return {
    ruleId: f.ruleId,
    level: severityToLevel(f.severity),
    message: {
      text: `Accessibility finding: ${f.ruleId}${f.wcagSc ? ` (WCAG ${f.wcagSc})` : ''} on selector \`${f.selector}\``,
    },
    locations: [
      {
        physicalLocation: {
          artifactLocation: {
            uri: `selector:${f.selector}`,
          },
        },
      },
    ],
    fingerprints: {
      'ariada/diff/v1': f.fingerprint,
    },
    partialFingerprints: {
      ruleId: f.ruleId,
      severity: f.severity,
    },
  };
}

/**
 * Validate that a value conforms to the minimum SARIF 2.1.0 shape this
 * package emits. This is a lightweight check; downstream consumers should
 * validate against the full OASIS schema for production use.
 */
export function validateSarifShape(input: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (typeof input !== 'object' || input === null) {
    return { valid: false, errors: ['root: expected object'] };
  }
  const o = input as Record<string, unknown>;
  if (o['version'] !== SARIF_VERSION) {
    errors.push(`version: expected '${SARIF_VERSION}'`);
  }
  if (typeof o['$schema'] !== 'string') {
    errors.push('$schema: expected string');
  }
  if (!Array.isArray(o['runs']) || o['runs'].length === 0) {
    errors.push('runs: expected non-empty array');
  }
  return { valid: errors.length === 0, errors };
}
