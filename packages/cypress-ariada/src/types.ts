// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

export type AriadaSeverity = 'minor' | 'moderate' | 'serious' | 'critical';
export type AriadaBrowser = 'chromium' | 'firefox' | 'webkit';
export type AriadaScanMode = 'ax-tree' | 'dom-fallback';

export interface AriadaScanOptions {
  severityThreshold?: AriadaSeverity;
  browser?: AriadaBrowser;
  timeoutMs?: number;
  outputDir?: string;
  failOnViolation?: boolean;
  logOnly?: boolean;
  taskTimeoutMs?: number;
}

export interface AriadaFinding {
  ruleId?: string;
  severity?: AriadaSeverity | string;
  message?: string;
  criterion?: string;
  element?: {
    selector?: string;
    role?: string;
    name?: string;
  };
}

export interface AriadaScanSummary {
  total: number;
  byImpact: Record<AriadaSeverity, number>;
}

export interface AriadaScanResult {
  url: string;
  exitCode: number;
  mode: AriadaScanMode;
  summary: AriadaScanSummary;
  findings: AriadaFinding[];
  blockingCount: number;
  message: string;
  outputDir: string;
}

export interface AriadaScanTaskPayload {
  url: string;
  options?: AriadaScanOptions;
}
