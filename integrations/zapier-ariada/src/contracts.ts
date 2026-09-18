// SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB)
// SPDX-License-Identifier: EUPL-1.2

/** The severities Ariada reports, plus the one for anything it did not recognise. */
export type Severity = 'critical' | 'serious' | 'moderate' | 'minor' | 'unknown';

/**
 * A finding as it arrives, which is to say loosely.
 *
 * Every field is optional and several of them name the same thing twice —
 * `ruleId` or `rule`, `message` or `title`, `wcag` or `wcagSc`. That is not
 * indecision: reports reach this integration from more than one version of the
 * scanner and from a webhook a person configured by hand, and a mapper that
 * refuses the older spelling drops the report rather than the field.
 */
export interface AriadaFinding {
  id?: string;
  fingerprint?: string;
  ruleId?: string;
  rule?: string;
  title?: string;
  message?: string;
  description?: string;
  severity?: string;
  url?: string;
  page?: string;
  selector?: string;
  wcag?: string | string[];
  wcagSc?: string | string[];
  remediation?: string;
  help?: string;
  [key: string]: unknown;
}

/** A report, equally loosely: findings may arrive under either name. */
export interface AriadaReport {
  id?: string;
  scanId?: string;
  url?: string;
  reportUrl?: string;
  completedAt?: string;
  passed?: boolean;
  gate?: { passed?: boolean; [key: string]: unknown };
  findings?: AriadaFinding[];
  violations?: AriadaFinding[];
  [key: string]: unknown;
}

/** A finding as the platform receives it: every field present and a string. */
export interface ZapierViolation {
  id: string;
  fingerprint: string;
  scanId: string;
  ruleId: string;
  title: string;
  description: string;
  severity: Severity;
  url: string;
  selector: string;
  wcag: string;
  remediation: string;
  reportUrl: string;
}

/** One event per scan, carrying the gate result and the counts. */
export interface ZapierScanCompleted {
  id: string;
  scanId: string;
  url: string;
  reportUrl: string;
  passed: boolean;
  findingCount: number;
  criticalCount: number;
  completedAt: string;
}

export interface ZapierOperation {
  key: string;
  noun: string;
  display: { label: string; description: string };
  operation: Record<string, unknown>;
}

export interface ZapierAppDefinition {
  version: string;
  platformVersion: string;
  authentication: Record<string, unknown>;
  triggers: Record<string, ZapierOperation>;
  actions: Record<string, ZapierOperation>;
}
