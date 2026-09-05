// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/types.d.ts`. A types-only module compiles to an empty
// one, so there is nothing to compare directly; what holds it is that every
// module importing it compiles to the same output as before, which it cannot do
// if a shape moved. Checked with `bash scripts/sverit-vosstanovlennoe.sh`.

export interface SauceManifest {
  schemaVersion: 1;
  runId: string;
  source: { url: string; commit?: string };
  capabilities: {
    browserName: string;
    platformName: string;
    browserVersion?: string;
    build?: string;
    name?: string;
    tags?: string[];
  };
  gate?: { maxFindings?: number };
}

export interface CdpTransport {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>;
}

export interface SauceSession {
  id: string;
  cdp: CdpTransport;
  close(): Promise<void>;
}

export interface SauceSessionFactory {
  create(manifest: SauceManifest): Promise<SauceSession>;
}

export interface AriadaFinding {
  id: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
  message: string;
  selector?: string;
}

export interface AriadaScanResult {
  status: 'passed' | 'failed' | 'error';
  findings: AriadaFinding[];
  passes: number;
  source: 'injected' | 'ariada';
}

export interface AriadaScanner {
  scan(input: { manifest: SauceManifest; session: SauceSession }): Promise<AriadaScanResult>;
}

export interface SauceLabsAriadaReport {
  schemaVersion: 1;
  integration: 'saucelabs-ariada';
  runId: string;
  sessionId: string;
  source: SauceManifest['source'];
  capabilities: SauceManifest['capabilities'];
  scan: AriadaScanResult;
  gate: {
    passed: boolean;
    maxFindings: number;
    findings: number;
    exitCode: 0 | 1 | 2;
    reasons: string[];
  };
}

export interface RunSauceLabsAriadaOptions {
  manifest: SauceManifest;
  sessionFactory: SauceSessionFactory;
  scanner: AriadaScanner;
  outputDir?: string;
}
