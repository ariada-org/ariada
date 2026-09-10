// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/generators/init/schema.js` and its declaration. The
// source this was built from was never committed; the compiled output is `tsc`
// with the types stripped, so the shapes come back from the declaration file.
// Checked with the rebuild check.
//
// Only types, so the compiled module is empty. Everything here is optional but
// the project name: the generator's whole purpose is to infer the rest from a
// workspace that already knows it.

import type { SeverityThreshold } from '../../executors/a11y/schema.js';

export interface InitGeneratorSchema {
  project: string;
  targetName?: string;
  buildTarget?: string;
  outputPath?: string;
  url?: string;
  reportDir?: string;
  severityThreshold?: SeverityThreshold;
  timeoutMs?: number;
  allowPrivate?: boolean;
  force?: boolean;
}
