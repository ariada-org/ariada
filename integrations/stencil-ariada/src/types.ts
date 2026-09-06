// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/types.js` and `dist/types.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the one value
// is the compiled one. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.
//
// Each component's report carries how it was encapsulated and where its usage
// markup came from. Both matter when a result is questioned later: a component
// in a shadow root is scanned through a boundary, and a usage that was inferred
// rather than configured is a guess about how the component is meant to be used.

export const ARIADA_SEVERITIES = ['critical', 'serious', 'moderate', 'minor'] as const;

export type AriadaSeverity = (typeof ARIADA_SEVERITIES)[number];

export interface StencilAriadaOptions {
  /** Directory, relative to Stencil rootDir, for consolidated and raw reports. */
  reportDir?: string;
  /** Select a specific configured www output directory. */
  wwwDir?: string;
  /** Lowest severity that fails the Stencil build. Defaults to serious. */
  failOn?: AriadaSeverity | false;
  /** Scan only these component tags. */
  include?: readonly string[];
  /** Do not scan these component tags. */
  exclude?: readonly string[];
  /** Explicit rendered HTML keyed by component tag. */
  usages?: Readonly<Record<string, string>>;
  /** Per-component browser navigation timeout. */
  timeoutMs?: number;
  /** Maximum wait for the parallel Stencil www target. */
  outputWaitMs?: number;
}

export interface NormalizedStencilAriadaOptions {
  reportDir: string;
  wwwDir?: string;
  failOn: AriadaSeverity | false;
  include: readonly string[];
  exclude: readonly string[];
  usages: Readonly<Record<string, string>>;
  timeoutMs: number;
  outputWaitMs: number;
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

export interface ComponentUsage {
  tag: string;
  html: string;
  source: string;
  encapsulation: 'shadow' | 'scoped' | 'none' | 'unknown';
}

export interface ComponentAriadaReport {
  tag: string;
  usageSource: string;
  encapsulation: ComponentUsage['encapsulation'];
  url: string;
  rawReport: string;
  cliExitCode: 0 | 1;
  failed: boolean;
  findingCount: number;
  bySeverity: Record<AriadaSeverity, number>;
  analyzersRun: readonly string[];
  axTreeNodeCount: number;
  findings: readonly AriadaFinding[];
}

export interface StencilAriadaReport {
  schemaVersion: '1.0.0';
  integration: '@ariada-integrations/stencil-ariada';
  integrationVersion: '0.1.0';
  scannerContract: '@ariada-org/cli/runScan -> @ariada-org/core-playwright -> @ariada-org/rules-axe';
  generatedAt: string;
  failOn: AriadaSeverity | false;
  failed: boolean;
  componentCount: number;
  findingCount: number;
  bySeverity: Record<AriadaSeverity, number>;
  components: readonly ComponentAriadaReport[];
}
