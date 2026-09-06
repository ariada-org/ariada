// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/types.js` and `dist/types.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the two values
// are the compiled ones. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.
//
// Two story platforms rather than one, and every result records which it came
// from. They discover their stories differently and load them differently, so a
// result without its platform cannot be compared with another.

export const STORY_PLATFORMS = ['ladle', 'histoire'] as const;
export const ARIADA_SEVERITIES = ['critical', 'serious', 'moderate', 'minor'] as const;

export type StoryPlatform = (typeof STORY_PLATFORMS)[number];
export type AriadaSeverity = (typeof ARIADA_SEVERITIES)[number];

export interface StoryRunnerOptions {
  platform: StoryPlatform;
  baseUrl?: string;
  staticDir?: string;
  manifest?: string;
  reportDir?: string;
  failOn?: AriadaSeverity | false;
  timeoutMs?: number;
}

export interface NormalizedStoryRunnerOptions {
  platform: StoryPlatform;
  baseUrl?: string;
  staticDir?: string;
  manifest?: string;
  reportDir: string;
  failOn: AriadaSeverity | false;
  timeoutMs: number;
}

export interface StoryDescriptor {
  platform: StoryPlatform;
  id: string;
  title: string;
  url: string;
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

export interface StoryAriadaResult {
  platform: StoryPlatform;
  id: string;
  title: string;
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

export interface StorybookAltAriadaReport {
  schemaVersion: '1.0.0';
  integration: '@ariada-integrations/storybook-alt-ariada';
  integrationVersion: '0.1.0';
  scannerContract: '@ariada-org/cli/runScan -> @ariada-org/core-playwright -> @ariada-org/rules-axe';
  generatedAt: string;
  platform: StoryPlatform;
  failOn: AriadaSeverity | false;
  failed: boolean;
  storyCount: number;
  findingCount: number;
  bySeverity: Record<AriadaSeverity, number>;
  stories: readonly StoryAriadaResult[];
}
