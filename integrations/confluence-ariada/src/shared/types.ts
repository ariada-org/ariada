// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/shared/types.js` and `dist/shared/types.d.ts`. The source
// this was built from was never committed; the compiled output is `tsc` with the
// types stripped, so the shapes come back from the declaration file and the one
// value here is the compiled one. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.
//
// The severity list is a value rather than only a type because the normaliser
// has to check a string it was given at run time against it. Deriving the type
// from the list keeps the two from drifting: adding a severity in one place adds
// it in both, and there is no second list to forget.

export const SEVERITIES = ['critical', 'serious', 'moderate', 'minor'] as const;

export type Severity = (typeof SEVERITIES)[number];

export interface PageDescriptor {
  id: string;
  title: string;
  url: string;
  spaceId?: string;
  version?: number;
}

export interface Finding {
  ruleId: string;
  severity: Severity;
  message: string;
  selector?: string;
  helpUrl?: string;
  wcag: string[];
}

export interface ScanResult {
  schema: 'ariada-confluence.scan.v1';
  scanId: string;
  scannedAt: string;
  page: PageDescriptor;
  gate: {
    passed: boolean;
    threshold: Severity;
    total: number;
    byImpact: Record<Severity, number>;
  };
  findings: Finding[];
  reportUrl: string | null;
}

export interface ForgeClaims {
  app: {
    id: string;
    apiBaseUrl: string;
    installationId?: string;
  };
  context: {
    siteUrl?: string;
    extension: {
      type: string;
      content: {
        id: string;
        subtype?: string | null;
      };
      space?: {
        id?: string;
        key?: string;
      };
      location?: string;
    };
  };
  principal?: string;
}
