// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/report.js` and `dist/report.d.ts`. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { AriadaScanResult, SauceLabsAriadaReport, SauceManifest } from './types.js';

/**
 * Build the report and decide its gate.
 *
 * Three exit codes rather than two: zero passed, one failed on findings, two
 * failed because the scan itself could not run. A run that never looked and a
 * run that looked and found things are different facts, and a pipeline that
 * treats them alike will retry the wrong one.
 *
 * @param manifest - the run's manifest
 * @param sessionId - the remote session
 * @param scan - what the scan returned
 * @returns the report
 */
export function buildReport(
  manifest: SauceManifest,
  sessionId: string,
  scan: AriadaScanResult,
): SauceLabsAriadaReport {
  const maxFindings = manifest.gate?.maxFindings ?? 0;
  const findings = scan.findings.length;
  const reasons =
    scan.status === 'error'
      ? ['Ariada scan infrastructure error']
      : findings > maxFindings
        ? [`${findings} findings exceed the limit of ${maxFindings}`]
        : [];
  const passed = reasons.length === 0 && scan.status === 'passed';
  return {
    schemaVersion: 1,
    integration: 'saucelabs-ariada',
    runId: manifest.runId,
    sessionId,
    source: manifest.source,
    capabilities: manifest.capabilities,
    scan,
    gate: {
      passed,
      maxFindings,
      findings,
      exitCode: passed ? 0 : scan.status === 'error' ? 2 : 1,
      reasons,
    },
  };
}

/**
 * The report as the summary a person reads in a pipeline.
 *
 * @param report - the report
 * @returns markdown
 */
export function renderMarkdown(report: SauceLabsAriadaReport): string {
  const status = report.gate.passed ? 'PASS' : 'FAIL';
  const reasons =
    report.gate.reasons.length === 0
      ? 'None'
      : report.gate.reasons.map((reason) => `- ${reason}`).join('\n');
  return `# Sauce Labs Ariada report\n\n- Gate: **${status}**\n- Run: \`${report.runId}\`\n- Session: \`${report.sessionId}\`\n- URL: ${report.source.url}\n- Findings: ${report.gate.findings}\n- Allowed findings: ${report.gate.maxFindings}\n\n## Gate reasons\n\n${reasons}\n`;
}

/**
 * Write the three artifacts a pipeline collects.
 *
 * The gate is written on its own as well as inside the report, so a step that
 * only needs the verdict does not have to parse the whole thing.
 *
 * @param outputDir - where to write
 * @param report - the report
 */
export async function writeArtifacts(
  outputDir: string,
  report: SauceLabsAriadaReport,
): Promise<void> {
  await mkdir(outputDir, { recursive: true });
  await writeFile(
    join(outputDir, 'saucelabs-ariada-report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );
  await writeFile(join(outputDir, 'saucelabs-ariada-report.md'), renderMarkdown(report), 'utf8');
  await writeFile(
    join(outputDir, 'saucelabs-ariada-gate.json'),
    `${JSON.stringify(report.gate, null, 2)}\n`,
    'utf8',
  );
}
