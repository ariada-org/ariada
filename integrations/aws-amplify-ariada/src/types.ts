// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/types.js` and `dist/types.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the two
// constants are the compiled ones. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.
//
// A target is one of two things and the type says so rather than leaving a
// nullable field for the reader to reason about: either a directory that will be
// served locally, or an address someone already has. Each carries where it came
// from — a build output, an address given explicitly, or the branch of a hosting
// service — because when a report is wrong the first question is which of the
// three was scanned.
//
// The resolved and the active forms differ in one respect: by the time it is
// active, a served directory also has the address it ended up on.

export const ARIADA_CLI_PACKAGE = "@ariada-org/cli";
export const ARIADA_CLI_VERSION = "0.1.0";

export type GateMode = "gate" | "report-only";
export type BrowserName = "chromium" | "firefox" | "webkit";
export type SeverityThreshold = "minor" | "moderate" | "serious" | "critical";

export interface IntegrationConfig {
  mode: GateMode;
  buildOutput?: string;
  targetUrl?: string;
  amplifyAppId?: string;
  amplifyBranch?: string;
  outputDir: string;
  browser: BrowserName;
  severityThreshold: SeverityThreshold;
  timeoutMs: number;
}

export type ResolvedTarget =
  | {
      kind: "build-output";
      source: "build-output";
      path: string;
    }
  | {
      kind: "url";
      source: "explicit-url" | "amplify-branch";
      url: string;
    };

export type ActiveTarget =
  | {
      kind: "build-output";
      source: "build-output";
      buildOutput: string;
      url: string;
    }
  | {
      kind: "url";
      source: "explicit-url" | "amplify-branch";
      url: string;
    };

export interface AriadaInvocationOptions {
  cwd: string;
  env: NodeJS.ProcessEnv;
}

export interface AriadaRunnerResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface AriadaRunner {
  run(args: readonly string[], options: AriadaInvocationOptions): Promise<AriadaRunnerResult>;
}

export interface AriadaImpactCounts {
  critical: number;
  serious: number;
  moderate: number;
  minor: number;
}

export interface AriadaScanJson {
  $schema: string;
  url: string;
  scanId?: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  summary: {
    total: number;
    byImpact: AriadaImpactCounts;
  };
  report: Record<string, unknown>;
  exitCode: 0 | 1;
}

export type DecisionOutcome = "pass" | "violations" | "error";

export interface GateDecision {
  mode: GateMode;
  outcome: DecisionOutcome;
  wouldBlock: boolean;
  processExitCode: number;
  reason: string;
}

export interface IntegrationResult {
  version: 1;
  mode: GateMode;
  target: ActiveTarget;
  outputDir: string;
  scanFile: string;
  cli: {
    package: typeof ARIADA_CLI_PACKAGE;
    version: typeof ARIADA_CLI_VERSION;
    args: readonly string[];
    exitCode: number;
    stdout: string;
    stderr: string;
  };
  scan: AriadaScanJson | null;
  decision: GateDecision;
}

export interface StaticServerHandle {
  url: string;
  close(): Promise<void>;
}

export type StaticServerFactory = (directory: string) => Promise<StaticServerHandle>;
