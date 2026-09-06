// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/types.js` and `dist/types.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the one value
// is the compiled one. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.
//
// The report carries its own schema version, the integration's version, and the
// chain of packages the scan actually went through. It is written as a component
// artifact and read back later, possibly by a different version of this code —
// and a report that cannot say what produced it is a number without a source.

export const ARIADA_SEVERITIES = ['critical', 'serious', 'moderate', 'minor'] as const;

export type AriadaSeverity = (typeof ARIADA_SEVERITIES)[number];

export interface RenderedPageTarget {
  /** Directory inside a Bit capsule that is exposed on an ephemeral loopback server. */
  rootDir?: string;
  /** HTML document inside rootDir. */
  page?: string;
}

export interface AriadaBitOptions {
  /** Per-capsule report directory. Bit persists it as a component artifact. */
  reportDir?: string;
  /** Default rendered output for every component. */
  rendered?: RenderedPageTarget;
  /** Rendered-output overrides keyed by full id, id without version, or component name. */
  components?: Readonly<Record<string, RenderedPageTarget>>;
  /** Lowest severity returned to Bit as a component error. Defaults to serious. */
  failOn?: AriadaSeverity | false;
  /** Per-component browser navigation timeout. */
  timeoutMs?: number;
}

export interface NormalizedRenderedPageTarget {
  rootDir: string;
  page: string;
}

export interface NormalizedAriadaBitOptions {
  reportDir: string;
  rendered: NormalizedRenderedPageTarget;
  components: Readonly<Record<string, NormalizedRenderedPageTarget>>;
  failOn: AriadaSeverity | false;
  timeoutMs: number;
}

export interface AriadaFinding {
  id: string;
  domain: string;
  ruleId: string;
  severity: AriadaSeverity;
  message: string;
  selector: string;
  criterion?: string;
  wcagMapping?: readonly string[];
}

export interface ParsedAriadaScan {
  scanId: string;
  url: string;
  exitCode: 0 | 1;
  findings: readonly AriadaFinding[];
  bySeverity: Record<AriadaSeverity, number>;
  analyzersRun: readonly string[];
  axTreeNodeCount: number;
  raw: Record<string, unknown>;
}

export interface BitComponentAriadaReport {
  schemaVersion: '1.0.0';
  integration: '@ariada-integrations/bit-ariada';
  integrationVersion: '0.1.0';
  task: 'ariada.integrations/bit-ariada:AriadaAccessibility';
  scannerContract: '@ariada-org/cli/runScan -> @ariada-org/core-playwright -> @ariada-org/rules-axe';
  generatedAt: string;
  componentId: string;
  componentName: string;
  pageUrl: string;
  rawReport: string;
  failOn: AriadaSeverity | false;
  cliExitCode: 0 | 1;
  failed: boolean;
  findingCount: number;
  bySeverity: Record<AriadaSeverity, number>;
  analyzersRun: readonly string[];
  axTreeNodeCount: number;
  findings: readonly AriadaFinding[];
}
