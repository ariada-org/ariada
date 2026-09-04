// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/index.js` and `dist/index.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies
// are the compiled ones. Checked with `bash scripts/sverit-vosstanovlennoe.sh`.

export interface BrowserStackManifest {
  schemaVersion: '1.0';
  kind: 'browserstack-session-manifest';
  sessionId: string;
  browser: string;
  browserVersion?: string;
  os: string;
  osVersion?: string;
  url: string;
  cdp: 'available' | 'unavailable' | 'unknown';
  metadata?: Record<string, string>;
}

export interface BrowserStackRemoteSession {
  executeScript<T>(script: string, ...args: unknown[]): Promise<T>;
  executeCdpCommand?<T>(command: string, params?: Record<string, unknown>): Promise<T>;
}

export interface BrowserStackSessionBridge {
  executeScript<T>(script: string, ...args: unknown[]): Promise<T>;
  executeCdpCommand<T>(command: string, params?: Record<string, unknown>): Promise<T>;
  transport: 'cdp' | 'dom-fallback';
}

export interface AriadaFinding {
  ruleId: string;
  severity: 'minor' | 'moderate' | 'serious' | 'critical';
  message?: string;
}

export interface AriadaSessionScan {
  report: unknown;
  findings: AriadaFinding[];
}

export type BrowserStackAriadaScanner = (
  bridge: BrowserStackSessionBridge,
  manifest: BrowserStackManifest,
) => Promise<AriadaSessionScan>;

export interface BrowserStackAriadaReport {
  schemaVersion: '1.0';
  kind: 'browserstack-ariada-session-report';
  source: BrowserStackManifest;
  summary: { findingCount: number };
  gates: {
    ariada: { conclusion: 'passed' | 'failed'; exitCode: 0 | 1 };
    combined: { conclusion: 'passed' | 'failed'; exitCode: 0 | 1 };
  };
  artifacts: { reportPath: string };
  execution: {
    sessionIntegration: 'injected-remote-session';
    scanner: 'injected-ariada-scanner';
    transport: 'cdp' | 'dom-fallback';
    liveBrowserStackApiUsed: false;
  };
}

export interface BrowserStackAriadaOptions {
  manifest: BrowserStackManifest;
  session: BrowserStackRemoteSession;
  outputDir: string;
  scan: BrowserStackAriadaScanner;
  browserStackExitCode?: number;
}

export interface FileWriter {
  ensureDir(path: string): Promise<void>;
  write(path: string, content: string): Promise<void>;
}

const defaultWriter: FileWriter = {
  ensureDir: async (path: string) => {
    await import('node:fs/promises').then(({ mkdir }) => mkdir(path, { recursive: true }));
  },
  write: async (path: string, content: string) => {
    await import('node:fs/promises').then(({ writeFile }) => writeFile(path, content, 'utf8'));
  },
};

/**
 * Wrap a remote session so the caller need not ask whether it speaks the
 * browser protocol.
 *
 * A session without the protocol still answers scripts, so the bridge records
 * which of the two it is rather than refusing outright — and says so on the
 * report, because a scan through the fallback saw a different amount.
 *
 * @param session - the remote session
 * @returns the bridge, carrying which transport it settled on
 */
export function createBrowserStackBridge(
  session: BrowserStackRemoteSession,
): BrowserStackSessionBridge {
  const transport = session.executeCdpCommand ? 'cdp' : 'dom-fallback';
  return {
    executeScript: (script, ...args) => session.executeScript(script, ...args),
    executeCdpCommand: async (command, params) => {
      if (!session.executeCdpCommand)
        throw new Error('BrowserStack session does not expose CDP; use the DOM fallback.');
      return session.executeCdpCommand(command, params);
    },
    transport,
  };
}

/**
 * Scan one remote session and write the report beside it.
 *
 * The combined gate fails if either side failed: a session that the provider
 * itself marked failed is not a session whose accessibility result means
 * anything.
 *
 * @param options - the manifest, the session, where to write, and how to scan
 * @param writer - how files are written
 * @returns the report that was written
 */
export async function runBrowserStackAriada(
  options: BrowserStackAriadaOptions,
  writer: FileWriter = defaultWriter,
): Promise<BrowserStackAriadaReport> {
  if (
    options.manifest.kind !== 'browserstack-session-manifest' ||
    options.manifest.schemaVersion !== '1.0'
  ) {
    throw new Error('Unsupported BrowserStack manifest.');
  }
  if (!options.manifest.sessionId.trim() || !options.manifest.url.trim()) {
    throw new Error('BrowserStack manifest requires sessionId and url.');
  }
  const bridge = createBrowserStackBridge(options.session);
  const scan = await options.scan(bridge, options.manifest);
  const findingCount = scan.findings.length;
  const ariadaFailed = findingCount > 0;
  const browserStackFailed =
    options.browserStackExitCode !== undefined && options.browserStackExitCode !== 0;
  const reportPath = `sessions/${options.manifest.sessionId}/report.json`;
  const report: BrowserStackAriadaReport = {
    schemaVersion: '1.0',
    kind: 'browserstack-ariada-session-report',
    source: options.manifest,
    summary: { findingCount },
    gates: {
      ariada: {
        conclusion: ariadaFailed ? 'failed' : 'passed',
        exitCode: ariadaFailed ? 1 : 0,
      },
      combined: {
        conclusion: ariadaFailed || browserStackFailed ? 'failed' : 'passed',
        exitCode: ariadaFailed || browserStackFailed ? 1 : 0,
      },
    },
    artifacts: { reportPath },
    execution: {
      sessionIntegration: 'injected-remote-session',
      scanner: 'injected-ariada-scanner',
      transport: bridge.transport,
      liveBrowserStackApiUsed: false,
    },
  };
  const artifactPath = `${options.outputDir}/${reportPath}`;
  await writer.ensureDir(`${options.outputDir}/sessions/${options.manifest.sessionId}`);
  await writer.write(
    artifactPath,
    `${JSON.stringify({ ...report, scan: scan.report }, null, 2)}\n`,
  );
  await writer.write(
    `${options.outputDir}/browserstack-ariada-report.json`,
    `${JSON.stringify(report, null, 2)}\n`,
  );
  return report;
}

/**
 * The exit code a caller should use.
 *
 * @param report - the report
 * @returns zero when both gates passed
 */
export function browserStackAriadaExitCode(report: BrowserStackAriadaReport): 0 | 1 {
  return report.gates.combined.exitCode;
}
