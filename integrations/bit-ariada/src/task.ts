// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/task.js` and `dist/task.d.ts`. The source this was built
// from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies
// are the compiled ones. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.
//
// ONE COMPONENT'S FAILURE DOES NOT STOP THE BUILD FOR THE REST. Each capsule is
// scanned in its own try, and a component that throws produces an error result
// and an evidence file rather than an exception that ends the run. A build of
// eighty components should not report seventy-nine as unknown because the
// eightieth has no rendered output.
//
// A FAILED GATE AND A BROKEN SCAN ARE MARKED DIFFERENTLY — `failed` against
// `error` — because they need different people. The first is an accessibility
// problem in a component; the second means nothing was measured, and the
// evidence file says what went wrong so it does not read as a clean result.
//
// The report directory is refused if it overlaps the rendered output, because
// the server serves that directory: writing the report inside it would publish
// the findings to the page being scanned, and on a rerun the scan would see its
// own last report.
//
// The scan and the server are injected with real defaults. That is the only way
// the task itself is testable — a real Bit build, a browser and a component
// capsule are three things a test cannot have.
//
// A component is looked up by full identifier, then without version, then by
// bare name, so a configuration written for one component keeps working when its
// version moves.

import { access, mkdir, rm, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

import type { BuildContext, BuildTask, BuiltTaskResult } from '@teambit/builder';

import { normalizeOptions, pathsOverlap, renderedTargetFor, resolveInside } from './config.js';
import { hasFindingAtOrAbove } from './report.js';
import { scanRenderedPage } from './scanner.js';
import { startStaticServer } from './server.js';
import type { StaticServer } from './server.js';
import type { AriadaBitOptions, BitComponentAriadaReport, NormalizedAriadaBitOptions, ParsedAriadaScan } from './types.js';

export interface AriadaTaskRuntime {
  scan(url: string, outputDir: string, timeoutMs: number): Promise<ParsedAriadaScan>;
  serve(rootDirectory: string): Promise<StaticServer>;
  now(): string;
}

const PACKAGE_NAME = '@ariada-integrations/bit-ariada';
const PACKAGE_VERSION = '0.1.0';
const ASPECT_ID = 'ariada.integrations/bit-ariada';
const TASK_NAME = 'AriadaAccessibility';

/** Native Bit BuildTask. Add it to an environment Pipeline after rendered output is produced. */
export class AriadaTask implements BuildTask {
  readonly aspectId = ASPECT_ID;
  readonly name = TASK_NAME;
  readonly description = 'Scan each rendered Bit component with the real Ariada accessibility scanner';
  readonly location = 'end';
  private readonly options: NormalizedAriadaBitOptions;
  private readonly runtime: AriadaTaskRuntime;

  constructor(options: AriadaBitOptions = {}, runtime: Partial<AriadaTaskRuntime> = {}) {
    this.options = normalizeOptions(options);
    this.runtime = {
      scan: runtime.scan ?? scanRenderedPage,
      serve: runtime.serve ?? startStaticServer,
      now: runtime.now ?? (() => new Date().toISOString()),
    };
  }

  async execute(context: BuildContext): Promise<BuiltTaskResult> {
    const componentsResults = [];
    for (const capsule of context.capsuleNetwork.originalSeedersCapsules) {
      const startTime = Date.now();
      const ids = componentIdentifiers(capsule.component.id);
      try {
        const report = await this.scanComponent(capsule.path, ids);
        const errors = report.failed
          ? [new Error(`Bit Ariada gate failed for ${report.componentId} at ${String(report.failOn)} severity`)]
          : [];
        componentsResults.push({
          component: capsule.component,
          errors,
          metadata: {
            status: report.failed ? 'failed' : 'passed',
            report: `${this.options.reportDir}/bit-ariada-report.json`,
            findingCount: report.findingCount,
            bySeverity: report.bySeverity,
            axTreeNodeCount: report.axTreeNodeCount,
          },
          startTime,
          endTime: Date.now(),
        });
      }
      catch (error) {
        const normalized = normalizeError(error);
        await this.writeErrorEvidence(capsule.path, ids[0] ?? 'unknown', normalized);
        componentsResults.push({
          component: capsule.component,
          errors: [normalized],
          metadata: { status: 'error', report: `${this.options.reportDir}/bit-ariada-error.json` },
          startTime,
          endTime: Date.now(),
        });
      }
    }
    return {
      componentsResults,
      artifacts: [
        {
          generatedBy: ASPECT_ID,
          name: 'ariada-accessibility-reports',
          description: 'Per-component Ariada JSON reports and raw scanner evidence',
          globPatterns: [`${this.options.reportDir.split(sep).join('/')}/**/*`],
        },
      ],
    } as unknown as BuiltTaskResult;
  }

  private async scanComponent(capsulePath: string, ids: readonly string[]): Promise<BitComponentAriadaReport> {
    const componentId = ids[0] ?? 'unknown';
    const componentName = ids.at(-1) ?? componentId;
    const target = renderedTargetFor(this.options, ids);
    const reportDir = resolveInside(capsulePath, this.options.reportDir, 'reportDir');
    const renderedRoot = resolveInside(capsulePath, target.rootDir, 'rendered.rootDir');
    const pagePath = resolveInside(renderedRoot, target.page, 'rendered.page');
    if (pathsOverlap(reportDir, renderedRoot)) {
      throw new Error('Bit Ariada reportDir must not overlap the rendered output root');
    }
    await access(pagePath);
    await rm(reportDir, { recursive: true, force: true });
    await mkdir(reportDir, { recursive: true });
    const server = await this.runtime.serve(renderedRoot);
    try {
      const page = relative(renderedRoot, pagePath).split(sep).map(encodeURIComponent).join('/');
      const pageUrl = `${server.origin}/${page}`;
      const rawDir = join(reportDir, 'raw');
      const scan = await this.runtime.scan(pageUrl, rawDir, this.options.timeoutMs);
      const report: BitComponentAriadaReport = {
        schemaVersion: '1.0.0',
        integration: PACKAGE_NAME,
        integrationVersion: PACKAGE_VERSION,
        task: `${ASPECT_ID}:${TASK_NAME}`,
        scannerContract: '@ariada-org/cli/runScan -> @ariada-org/core-playwright -> @ariada-org/rules-axe',
        generatedAt: this.runtime.now(),
        componentId,
        componentName,
        pageUrl,
        rawReport: 'raw/scan.json',
        failOn: this.options.failOn,
        cliExitCode: scan.exitCode,
        failed: hasFindingAtOrAbove(scan.findings, this.options.failOn),
        findingCount: scan.findings.length,
        bySeverity: scan.bySeverity,
        analyzersRun: scan.analyzersRun,
        axTreeNodeCount: scan.axTreeNodeCount,
        findings: scan.findings,
      };
      await writeJson(join(reportDir, 'bit-ariada-report.json'), report);
      return report;
    }
    finally {
      await server.close();
    }
  }

  private async writeErrorEvidence(capsulePath: string, componentId: string, error: Error): Promise<void> {
    const reportDir = resolveInside(capsulePath, this.options.reportDir, 'reportDir');
    await mkdir(reportDir, { recursive: true });
    await writeJson(join(reportDir, 'bit-ariada-error.json'), {
      schemaVersion: '1.0.0',
      integration: PACKAGE_NAME,
      integrationVersion: PACKAGE_VERSION,
      generatedAt: this.runtime.now(),
      componentId,
      status: 'error',
      error: { name: error.name, message: error.message },
    });
  }
}

export function createAriadaTask(options: AriadaBitOptions = {}): AriadaTask {
  return new AriadaTask(options);
}

function componentIdentifiers(id: unknown): string[] {
  const value = id as { toString?: () => string; toStringWithoutVersion?: () => string };
  const full = typeof value.toString === 'function' ? value.toString() : String(id);
  const withoutVersion = typeof value.toStringWithoutVersion === 'function'
    ? value.toStringWithoutVersion()
    : full.replace(/@[^/@]+$/, '');
  const name = withoutVersion.split('/').at(-1) ?? withoutVersion;
  return [...new Set([full, withoutVersion, name].filter((entry) => entry.length > 0))];
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
}
