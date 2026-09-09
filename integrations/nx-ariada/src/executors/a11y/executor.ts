// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/executors/a11y/executor.js` and its declaration. The
// source this was built from was never committed; the compiled output is `tsc`
// with the types stripped, so the shapes come back from the declaration file
// and the bodies are the compiled ones. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.
//
// EVERY PATH IS CHECKED TWICE, BEFORE AND AFTER RESOLVING LINKS. A workspace
// configures where its report goes and what gets scanned, and either can be a
// symbolic link out of the workspace. Checking the name answers a question
// about the name; checking the real path answers the question that matters.
//
// A FAILING SCAN AND A BROKEN SCANNER ARE DIFFERENT ANSWERS. Exit 0 and 1 are
// the page's verdict and are passed through; anything else is the tool itself
// going wrong, and it returns exit 3 with the message rather than reporting a
// page as inaccessible. A task that reports a broken scanner as a failing page
// sends somebody to fix a page that is fine.
//
// The old report is removed before the scan rather than after. A scan that dies
// part-way leaves nothing to read, which is honest; leaving yesterday's report
// would let a build pass on a scan that never ran.

import { mkdir, realpath, rm } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

import type { ExecutorContext } from '@nx/devkit';

import { resolveAriadaCli, runAriadaCli } from '../../lib/cli.js';
import { createExecutorResult, readAriadaReport } from '../../lib/report.js';
import { serveDirectory } from '../../lib/static-server.js';
import type { StaticServerHandle } from '../../lib/static-server.js';

import type { A11yExecutorResult, A11yExecutorSchema } from './schema.js';

function resolveInsideWorkspace(workspaceRoot: string, value: string, label: string): string {
  const absolute = resolve(workspaceRoot, value);
  assertInsideWorkspace(workspaceRoot, absolute, label);
  return absolute;
}

function assertInsideWorkspace(workspaceRoot: string, absolute: string, label: string): void {
  const rel = relative(workspaceRoot, absolute);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`${label} must stay inside the Nx workspace: ${absolute}`);
  }
}

function validateSource(options: A11yExecutorSchema): void {
  if ((options.outputPath === undefined) === (options.url === undefined)) {
    throw new Error('Configure exactly one of outputPath or url');
  }
  if (options.url !== undefined) {
    const parsed = new URL(options.url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('url must use http or https');
    }
  }
}

export default async function a11yExecutor(
  options: A11yExecutorSchema,
  context: ExecutorContext,
): Promise<A11yExecutorResult> {
  validateSource(options);
  const workspaceRoot = await realpath(context.root);
  const projectName = context.projectName ?? 'workspace';
  const requestedReportDir = resolveInsideWorkspace(workspaceRoot, options.reportDir ?? `.ariada/${projectName}`, 'reportDir');
  await mkdir(requestedReportDir, { recursive: true });
  const reportDir = await realpath(requestedReportDir);
  assertInsideWorkspace(workspaceRoot, reportDir, 'reportDir');
  const reportPath = resolve(reportDir, 'multi-domain-report.json');
  await rm(reportPath, { force: true });
  const timeoutMs = options.timeoutMs ?? 30_000;
  const severityThreshold = options.severityThreshold ?? 'moderate';
  let staticServer: StaticServerHandle | undefined;
  try {
    const targetUrl =
      options.outputPath === undefined
        ? String(options.url)
        : await (async () => {
            const outputDirectory = await realpath(resolveInsideWorkspace(workspaceRoot, options.outputPath as string, 'outputPath'));
            assertInsideWorkspace(workspaceRoot, outputDirectory, 'outputPath');
            staticServer = await serveDirectory(outputDirectory);
            return staticServer.url;
          })();
    const cliArgs = [
      'scan',
      targetUrl,
      '--domains',
      'accessibility',
      '--format',
      'json',
      '--output-dir',
      reportDir,
      '--severity-threshold',
      severityThreshold,
      '--browser',
      options.browser ?? 'chromium',
      '--timeout-ms',
      String(timeoutMs),
    ];
    if (staticServer !== undefined || options.allowPrivate === true) cliArgs.push('--allow-private');
    const processResult = await runAriadaCli(await resolveAriadaCli(), cliArgs, workspaceRoot, timeoutMs);
    if (processResult.exitCode !== 0 && processResult.exitCode !== 1) {
      const details = processResult.stderr.trim() || processResult.stdout.trim() || 'no CLI output';
      console.error(`[ariada:nx] runtime failure (exit ${processResult.exitCode}): ${details}`);
      return {
        success: false,
        exitCode: processResult.exitCode,
        findingCount: 0,
        reportPath,
        ruleIds: [],
      };
    }
    const result = createExecutorResult(processResult.exitCode, reportPath, await readAriadaReport(reportPath));
    const status = result.success ? 'PASS' : 'FAIL';
    console.log(`[ariada:nx] ${status}: ${result.findingCount} finding(s), report ${relative(workspaceRoot, reportPath)}`);
    return result;
  } catch (error) {
    console.error(`[ariada:nx] ${error instanceof Error ? error.message : String(error)}`);
    return {
      success: false,
      exitCode: 3,
      findingCount: 0,
      reportPath,
      ruleIds: [],
    };
  } finally {
    await staticServer?.close();
  }
}
