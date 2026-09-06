// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/runner.js` and `dist/runner.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies
// are the compiled ones. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.
//
// THE READINESS TOKEN IS THE PART WORTH SEEING. When the runner serves the
// stories itself, each story is prepared with a token and the server is asked
// afterwards whether that token was reported ready. So a story that never
// rendered fails the run instead of contributing an empty scan — which would
// otherwise be a story with no findings, indistinguishable from a story with
// nothing wrong.
//
// A story's report directory is its position and a cleaned form of its
// identifier. Position first so the order on disk is the order they were
// scanned, and cleaned because a story identifier is written by whoever wrote
// the story and ends up as a directory name.
//
// The report directory is refused if it overlaps the served directory, since
// that directory is being served: reports would be published into the story site
// and read back on the next run.
//
// The report is written beside itself and renamed into place, and the server is
// closed in a `finally` whatever happened.

import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

import { normalizeOptions } from './config.js';
import { discoverStories } from './discovery.js';
import { emptySeverityCounts, hasFindingAtOrAbove } from './report.js';
import { scanRenderedStory } from './scanner.js';
import { startStaticStoryServer } from './server.js';
import type { AriadaSeverity, NormalizedStoryRunnerOptions, ParsedAriadaScan, StoryAriadaResult, StoryDescriptor, StoryRunnerOptions, StorybookAltAriadaReport } from './types.js';

type Discover = (options: NormalizedStoryRunnerOptions, baseUrl: string) => Promise<readonly StoryDescriptor[]>;
type Scan = (url: string, outputDir: string, timeoutMs: number) => Promise<ParsedAriadaScan>;

export interface RunnerDependencies {
  discover?: Discover;
  scan?: Scan;
  now?: () => Date;
}

export async function runStories(
  input: StoryRunnerOptions,
  dependencies: RunnerDependencies = {},
): Promise<StorybookAltAriadaReport> {
  const options = normalizeOptions(input);
  if (options.staticDir !== undefined && pathsOverlap(options.staticDir, options.reportDir)) {
    throw new Error('reportDir must not overlap staticDir');
  }
  await rm(options.reportDir, { recursive: true, force: true });
  await mkdir(resolve(options.reportDir, 'raw'), { recursive: true });
  const server = options.staticDir === undefined
    ? undefined
    : await startStaticStoryServer(options.staticDir, options.platform, options.timeoutMs);
  try {
    const baseUrl = server === undefined ? requiredBaseUrl(options) : server.origin + '/';
    const stories = await (dependencies.discover ?? discoverStories)(options, baseUrl);
    const scanner = dependencies.scan ?? scanRenderedStory;
    const results: StoryAriadaResult[] = [];
    for (const [index, story] of stories.entries()) {
      const prepared = server?.prepareStory(story);
      const scanStory = prepared?.story ?? story;
      const rawDir = resolve(options.reportDir, 'raw', safeSegment(story.id, index));
      const scan = await scanner(scanStory.url, rawDir, options.timeoutMs);
      if (prepared !== undefined && server !== undefined)
        server.assertReady(prepared.token);
      const failed = hasFindingAtOrAbove(scan.findings, options.failOn);
      results.push({
        platform: story.platform,
        id: story.id,
        title: story.title,
        url: story.url,
        rawReport: portable(relative(options.reportDir, resolve(rawDir, 'scan.json'))),
        cliExitCode: scan.exitCode,
        failed,
        findingCount: scan.findings.length,
        bySeverity: scan.bySeverity,
        analyzersRun: scan.analyzersRun,
        axTreeNodeCount: scan.axTreeNodeCount,
        findings: scan.findings,
      });
    }
    const bySeverity = emptySeverityCounts();
    for (const result of results) {
      for (const severity of Object.keys(bySeverity) as AriadaSeverity[]) {
        bySeverity[severity] += result.bySeverity[severity];
      }
    }
    const report: StorybookAltAriadaReport = {
      schemaVersion: '1.0.0',
      integration: '@ariada-integrations/storybook-alt-ariada',
      integrationVersion: '0.1.0',
      scannerContract: '@ariada-org/cli/runScan -> @ariada-org/core-playwright -> @ariada-org/rules-axe',
      generatedAt: (dependencies.now ?? (() => new Date()))().toISOString(),
      platform: options.platform,
      failOn: options.failOn,
      failed: results.some((result) => result.failed),
      storyCount: results.length,
      findingCount: results.reduce((total, result) => total + result.findingCount, 0),
      bySeverity,
      stories: results,
    };
    await atomicJson(resolve(options.reportDir, 'storybook-alt-ariada-report.json'), report);
    return report;
  }
  finally {
    await server?.close();
  }
}

function requiredBaseUrl(options: NormalizedStoryRunnerOptions): string {
  if (options.baseUrl === undefined) throw new Error('baseUrl is unavailable');
  return options.baseUrl;
}

function safeSegment(id: string, index: number): string {
  const segment = id.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100);
  return String(index + 1).padStart(4, '0') + '-' + (segment || 'story');
}

function portable(path: string): string {
  return path.split(sep).join('/');
}

function pathsOverlap(first: string, second: string): boolean {
  const a = resolve(first);
  const b = resolve(second);
  const fromA = relative(a, b);
  const fromB = relative(b, a);
  return (fromA === '' ||
    (!fromA.startsWith('..' + sep) && fromA !== '..' && !isAbsolute(fromA)) ||
    (!fromB.startsWith('..' + sep) && fromB !== '..' && !isAbsolute(fromB)));
}

async function atomicJson(path: string, value: unknown): Promise<void> {
  const temporary = path + '.tmp-' + process.pid;
  await writeFile(temporary, JSON.stringify(value, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
  await rename(temporary, path);
}
