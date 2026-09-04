// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/types.d.ts`. The source this was built from was never
// committed. A types-only module compiles to nothing, so there is no module to
// compare it against — what holds it is that the modules importing it compile
// to the same output. Checked with `bash scripts/sverit-vosstanovlennoe.sh`.

export type AriadaSeverity = 'minor' | 'moderate' | 'serious' | 'critical';

/**
 * A finding as it might arrive.
 *
 * Every field is optional and the index signature is open, because this comes
 * out of a report written by a version of the scanner nobody here controls. A
 * mapper that insists on a shape stops working the day the shape moves.
 */
export interface AriadaFinding {
  id?: string;
  ruleId?: string;
  rule?: string;
  severity?: string;
  impact?: string;
  message?: string;
  description?: string;
  selector?: string;
  target?: string;
  page?: string;
  url?: string;
  wcag?: string | string[];
  en301549?: string | string[];
  remediation?: string;
  help?: string;
  fingerprint?: string;
  [key: string]: unknown;
}

/** A report as it might arrive, with the same openness and for the same reason. */
export interface AriadaReport {
  url?: string;
  reportUrl?: string;
  scanId?: string;
  status?: string;
  exitCode?: number;
  summary?: { total?: number; byImpact?: Record<string, number> };
  findings?: AriadaFinding[];
  violations?: AriadaFinding[];
  report?: { findings?: AriadaFinding[] | Record<string, AriadaFinding[]> };
  [key: string]: unknown;
}

/** One violation, in the shape the automation platform expects. */
export interface MakeViolationBundle {
  eventType: 'violation';
  violationId: string;
  fingerprint: string;
  scanId: string;
  reportUrl?: string;
  url?: string;
  page: string;
  ruleId: string;
  severity: AriadaSeverity;
  message: string;
  selector: string;
  wcag: string;
  en301549: string;
  remediation: string;
}

/** The end-of-scan event, in the same shape. */
export interface MakeScanCompletedBundle {
  eventType: 'scan_completed';
  scanId: string;
  reportUrl?: string;
  url?: string;
  status: string;
  passed: boolean;
  totalFindings: number;
  criticalCount: number;
  seriousCount: number;
  moderateCount: number;
  minorCount: number;
}
