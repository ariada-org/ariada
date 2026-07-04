// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve as resolvePath } from 'node:path';
import { promisify } from 'node:util';

import type { Finding, MultiDomainReport } from '@ariada-org/core-engine';
import {
  emitEn301549,
  emitVpat,
  type ReportMeta,
  type Violation,
} from '@ariada-org/evidence-emitter';

import { CliError, emitError } from '../errors.js';
import { EXIT_INVALID_ARGS, EXIT_OK, EXIT_RUNTIME_ERROR, type ExitCode } from '../exit-codes.js';

import { renderEvidenceHtml } from './render-evidence-html.js';

const execFileAsync = promisify(execFile);
type EvidenceFormat = 'vpat' | 'en301549';

/**
 * User-facing options for the evidence export command.
 */
export interface EvidenceExportOptions {
  format?: EvidenceFormat;
  out?: string;
}

/**
 * Payload passed to an optional detached signing/timestamp integration.
 */
export interface EvidenceSignaturePayload {
  commitSha: string;
  format: EvidenceFormat;
  artifact: string;
}

/**
 * Injected side-effect hooks; the default command path only reads Git locally.
 */
export interface EvidenceExportHooks {
  getHeadSha?: () => Promise<string>;
  /** Optional signing/timestamp hook. Tests inject it; the default path does no network I/O. */
  sign?: (payload: EvidenceSignaturePayload) => Promise<string | undefined>;
}

/**
 * Convert a saved MultiDomainReport into a Git-anchored VPAT or EN evidence file.
 */
export async function runEvidenceExport(
  inputPath: string,
  options: EvidenceExportOptions,
  stdout: NodeJS.WritableStream = process.stdout,
  stderr: NodeJS.WritableStream = process.stderr,
  hooks: EvidenceExportHooks = {},
): Promise<ExitCode> {
  const format = options.format ?? 'vpat';
  if (format !== 'vpat' && format !== 'en301549') {
    emitError(new CliError('E_INVALID_OPTION', `Unknown evidence format: ${format}`), stderr);
    return EXIT_INVALID_ARGS;
  }
  if (!options.out) {
    emitError(new CliError('E_INVALID_OPTION', 'Provide --out <path> for evidence output'), stderr);
    return EXIT_INVALID_ARGS;
  }

  try {
    const report = JSON.parse(await readFile(inputPath, 'utf8')) as MultiDomainReport;
    const commitSha = await (hooks.getHeadSha ?? readHeadSha)();
    const violations = findingsToViolations(report);
    const meta = buildMeta(report, commitSha);
    const emitted = format === 'vpat' ? emitVpat(violations, meta) : emitEn301549(violations, meta);
    const json = JSON.stringify(emitted, null, 2);
    const signature = await hooks.sign?.({ commitSha, format, artifact: json });
    const html = renderEvidenceHtml({
      format,
      commitSha,
      report,
      json,
      autoVerified: violations.length,
      manualReviewRequired: countManualReviewFindings(report),
      ...(signature !== undefined ? { signature } : {}),
    });
    const dest = resolvePath(options.out);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, html, 'utf8');
    stdout.write(`Wrote ${dest}\n`);
    return EXIT_OK;
  } catch (err) {
    emitError(
      new CliError('E_OUTPUT_WRITE', err instanceof Error ? err.message : String(err), {
        inputPath,
      }),
      stderr,
    );
    return EXIT_RUNTIME_ERROR;
  }
}

async function readHeadSha(): Promise<string> {
  const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' });
  return stdout.trim();
}

function buildMeta(report: MultiDomainReport, commitSha: string): ReportMeta {
  return {
    productName: 'Ariada scanned property set',
    productVersion: commitSha,
    evaluator: 'Ariada CLI evidence export',
    evaluationDate: '1970-01-01',
    scope: report.sites.join(', '),
    methodology:
      `Automated evidence export true at commit ${commitSha}. ` +
      'Auto-verified criteria come from machine-detected WCAG mappings. ' +
      'Manual review is required for criteria not covered by the scan input.',
  };
}

function findingsToViolations(report: MultiDomainReport): Violation[] {
  const violations: Violation[] = [];
  for (const finding of allFindings(report)) {
    if (finding.domain !== 'accessibility') continue;
    const wcag = wcagMappings(finding);
    if (wcag.length === 0) continue;
    violations.push({
      id: finding.ruleId,
      description: finding.message,
      help: finding.message,
      impact: finding.severity,
      wcag,
      en301549: enMappings(finding),
      nodeCount: 1,
      sampleSelectors: [finding.element.selector],
    });
  }
  return violations;
}

function allFindings(report: MultiDomainReport): Finding[] {
  const out: Finding[] = [];
  for (const site of report.sites) {
    for (const domain of report.domains) out.push(...(report.grid[site]?.[domain] ?? []));
  }
  return out;
}

function wcagMappings(finding: Finding): string[] {
  const direct = finding.wcagMapping ?? [];
  const regulatory =
    finding.regulatoryMapping?.filter((r) => r.framework === 'WCAG').map((r) => r.code) ?? [];
  return [...new Set([...direct, ...regulatory])];
}

function enMappings(finding: Finding): string[] {
  return (
    finding.regulatoryMapping?.filter((r) => r.framework === 'EN 301 549').map((r) => r.code) ?? []
  );
}

function countManualReviewFindings(report: MultiDomainReport): number {
  return allFindings(report).filter((finding) => wcagMappings(finding).length === 0).length;
}
