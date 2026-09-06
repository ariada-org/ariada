// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/output-target.js` and `dist/output-target.d.ts`. The
// source this was built from was never committed; the compiled output is `tsc`
// with the types stripped, so the shapes come back from the declaration file and
// the bodies are the compiled ones. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.
//
// ZERO SELECTED COMPONENTS IS AN ERROR, AND THE MESSAGE SAYS WHY: a build that
// scanned nothing and reported no findings is a green tick over an empty
// measurement, which is the exact failure this integration exists to prevent. A
// filter that matches nothing is a configuration mistake, not an empty library.
//
// THE OUTPUT IS WAITED FOR RATHER THAN ASSUMED. Stencil builds its targets in
// parallel, so the page this needs may not be written when this runs. The wait
// polls the compiler's own in-memory filesystem for a document that is complete
// — the closing tag, not merely a file — then commits it to disk and reads it
// back. Reading a half-written page would scan a document nobody will ever see.
//
// The report directory is refused if it overlaps the site output, because the
// site is being served: the report would be published to the pages under scan
// and read back on the next run.
//
// The harness directory is removed in a `finally`. It contains one generated
// page per component, and leaving it behind would publish scan fixtures into a
// deployable site.
//
// Two www targets with no explicit choice is an error rather than a guess. Which
// build gets scanned changes the answer, and picking silently means the report
// describes a site nobody asked about.

import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

import type { CompilerCtx, Config, JsonDocs, OutputTargetCustom } from '@stencil/core/internal';

import { normalizeOptions, pathsOverlap, resolveInside } from './config.js';
import { emptySeverityCounts, hasFindingAtOrAbove } from './report.js';
import { scanRenderedPage } from './scanner.js';
import { startStaticServer } from './server.js';
import type { AriadaSeverity, ComponentAriadaReport, NormalizedStencilAriadaOptions, StencilAriadaOptions, StencilAriadaReport } from './types.js';
import { collectComponentUsages, renderHarness } from './usages.js';

const PACKAGE_NAME = '@ariada-integrations/stencil-ariada';
const PACKAGE_VERSION = '0.1.0';

/** Create the production Stencil custom output target. */
export function stencilAriada(options: StencilAriadaOptions = {}): OutputTargetCustom {
  const normalized = normalizeOptions(options);
  return {
    type: 'custom',
    name: 'ariada:stencil',
    taskShouldRun: 'onBuildOnly',
    generator: async (config, compilerCtx, buildCtx, docs) => {
      if (buildCtx.hasError) return;
      await runStencilAriada(config, compilerCtx, docs as JsonDocs, buildCtx.components.map((component) => component.tagName), normalized);
    },
  } as unknown as OutputTargetCustom;
}

export async function runStencilAriada(
  config: Config,
  compilerCtx: CompilerCtx,
  docs: JsonDocs,
  buildTags: readonly string[],
  options: NormalizedStencilAriadaOptions,
): Promise<StencilAriadaReport> {
  const rootDir = resolve(config.rootDir ?? process.cwd());
  const www = selectWwwTarget(config, rootDir, options);
  const reportDir = resolveInside(rootDir, options.reportDir, 'reportDir');
  if (pathsOverlap(www.dir, reportDir))
    throw new Error('Stencil Ariada reportDir must not overlap the www output');
  const indexHtml = await waitForWwwIndex(compilerCtx, www.indexHtml, options.outputWaitMs);
  const usages = collectComponentUsages(docs, buildTags, options);
  if (usages.length === 0)
    throw new Error('Stencil Ariada selected zero components; refusing a false-green build');
  const harnessDir = join(www.dir, '__ariada');
  await rm(reportDir, { recursive: true, force: true });
  await rm(harnessDir, { recursive: true, force: true });
  await Promise.all([mkdir(reportDir, { recursive: true }), mkdir(harnessDir, { recursive: true })]);
  for (const usage of usages) {
    await writeFile(join(harnessDir, `${usage.tag}.html`), renderHarness(indexHtml, usage), 'utf8');
  }
  const server = await startStaticServer(www.dir);
  const componentReports: ComponentAriadaReport[] = [];
  try {
    for (const usage of usages) {
      const url = `${server.origin}/__ariada/${usage.tag}.html`;
      const rawDir = join(reportDir, 'raw', usage.tag);
      const scan = await scanRenderedPage(url, rawDir, options.timeoutMs);
      const failed = hasFindingAtOrAbove(scan.findings, options.failOn);
      const componentReport: ComponentAriadaReport = {
        tag: usage.tag,
        usageSource: usage.source,
        encapsulation: usage.encapsulation,
        url,
        rawReport: relative(reportDir, join(rawDir, 'scan.json')),
        cliExitCode: scan.exitCode,
        failed,
        findingCount: scan.findings.length,
        bySeverity: scan.bySeverity,
        analyzersRun: scan.analyzersRun,
        axTreeNodeCount: scan.axTreeNodeCount,
        findings: scan.findings,
      };
      componentReports.push(componentReport);
      await mkdir(join(reportDir, 'components'), { recursive: true });
      await writeJson(join(reportDir, 'components', `${usage.tag}.json`), componentReport);
    }
  }
  finally {
    await server.close();
    await rm(harnessDir, { recursive: true, force: true });
  }
  const bySeverity = emptySeverityCounts();
  for (const component of componentReports) {
    for (const severity of Object.keys(bySeverity) as AriadaSeverity[]) {
      bySeverity[severity] += component.bySeverity[severity];
    }
  }
  const report: StencilAriadaReport = {
    schemaVersion: '1.0.0',
    integration: PACKAGE_NAME,
    integrationVersion: PACKAGE_VERSION,
    scannerContract: '@ariada-org/cli/runScan -> @ariada-org/core-playwright -> @ariada-org/rules-axe',
    generatedAt: new Date().toISOString(),
    failOn: options.failOn,
    failed: componentReports.some((component) => component.failed),
    componentCount: componentReports.length,
    findingCount: componentReports.reduce((total, component) => total + component.findingCount, 0),
    bySeverity,
    components: componentReports,
  };
  await writeJson(join(reportDir, 'stencil-ariada-report.json'), report);
  config.logger?.info(`Stencil Ariada scanned ${report.componentCount} component(s), found ${report.findingCount}, report ${relative(rootDir, reportDir)}`);
  if (report.failed) {
    throw new Error(`Stencil Ariada gate failed at ${String(options.failOn)} severity; report: ${join(reportDir, 'stencil-ariada-report.json')}`);
  }
  return report;
}

function selectWwwTarget(
  config: Config,
  rootDir: string,
  options: NormalizedStencilAriadaOptions,
): { dir: string; indexHtml: string } {
  const targets = (config.outputTargets ?? []).filter((target) => target.type === 'www') as { dir?: string; indexHtml?: string }[];
  if (targets.length === 0)
    throw new Error('Stencil Ariada requires a configured www output target');
  let target;
  if (options.wwwDir !== undefined) {
    const selectedDir = resolveInside(rootDir, options.wwwDir, 'wwwDir');
    target = targets.find((candidate) => resolve(candidate.dir ?? join(rootDir, 'www')) === selectedDir);
    if (target === undefined)
      throw new Error(`Stencil Ariada wwwDir does not match a configured www target: ${options.wwwDir}`);
  }
  else if (targets.length === 1) {
    target = targets[0];
  }
  else {
    throw new Error('Stencil Ariada found multiple www targets; set wwwDir explicitly');
  }
  if (target === undefined)
    throw new Error('Stencil Ariada could not select a www target');
  const dir = resolve(target.dir ?? join(rootDir, 'www'));
  const rootRelative = relative(rootDir, dir);
  if (rootRelative === '..' || rootRelative.startsWith('../'))
    throw new Error('Stencil www output must remain inside rootDir');
  return { dir, indexHtml: resolve(target.indexHtml ?? join(dir, 'index.html')) };
}

async function waitForWwwIndex(compilerCtx: CompilerCtx, indexPath: string, timeoutMs: number): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const inMemory = await compilerCtx.fs.readFile(indexPath);
      if (typeof inMemory === 'string' && /<\/html>/i.test(inMemory)) {
        await compilerCtx.fs.commit();
        await access(indexPath);
        return await readFile(indexPath, 'utf8');
      }
    }
    catch (error) {
      lastError = error;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 25));
  }
  throw new Error(`Timed out waiting for Stencil www output: ${indexPath}`, { cause: lastError });
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
