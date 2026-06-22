// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const [scanPath, outPath] = process.argv.slice(2);
if (!scanPath || !outPath) {
  throw new Error('Usage: node emit-codequality.mjs <scan.json> <gl-code-quality-report.json>');
}

const payload = JSON.parse(await readFile(scanPath, 'utf8'));
const findings = Array.isArray(payload.report?.findings)
  ? payload.report.findings
  : Object.values(payload.report?.findings ?? {}).flat();

const issues = findings.map((finding, index) => ({
  type: 'issue',
  check_name: String(finding.ruleId ?? 'ariada-accessibility'),
  description: String(finding.message ?? 'Accessibility finding'),
  categories: ['Accessibility'],
  severity: String(finding.severity ?? 'moderate') === 'critical' ? 'critical' : 'major',
  fingerprint: `ariada-${payload.scanId ?? 'scan'}-${index}`,
  location: {
    path: String(finding.path ?? 'accessibility-scan'),
    lines: { begin: 1 },
  },
}));

await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, `${JSON.stringify(issues, null, 2)}\n`, 'utf8');
