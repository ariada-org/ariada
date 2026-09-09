// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/executors/a11y/schema.js` and its declaration. The
// source this was built from was never committed; the compiled output is `tsc`
// with the types stripped, so the shapes come back from the declaration file.
// Checked with `bash scripts/sverit-vosstanovlennoe.sh`.
//
// Only types live here, which is why the compiled module is empty. The shapes
// are what the executor's own schema file promises a workspace, so they are the
// contract rather than an implementation detail.

export type SeverityThreshold = 'minor' | 'moderate' | 'serious' | 'critical';

export interface A11yExecutorSchema {
  outputPath?: string;
  url?: string;
  reportDir?: string;
  severityThreshold?: SeverityThreshold;
  timeoutMs?: number;
  allowPrivate?: boolean;
  browser?: 'chromium';
}

export interface A11yExecutorResult {
  success: boolean;
  exitCode: number;
  findingCount: number;
  reportPath: string;
  ruleIds: string[];
}
