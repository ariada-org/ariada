#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/run.js` and `dist/run.d.ts`. The source this was built
// from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies
// are the compiled ones.
//
// This file is released from that comparison, and is no longer held by the
// comparison with that module. The run came out of the compiler doing three jobs
// in one function — laying out directories, scanning each story, assembling the
// verdict — flat enough to fail the complexity limit standing on publication, so
// while the comparison was its only support the package could not travel.
//
// The twenty behavioural checks in the tests beside it were written while the
// comparison still held, and are the guarantee now. The release is recorded; a divergence reported by
// the rebuild check on this package is expected.
//
// WHAT THIS BRIDGE REFUSES TO CLAIM IS ITS WHOLE DESIGN, and the report says so
// in fields nobody has to be told to read: `chromaticNativePluginUsed: false`,
// `visualSnapshotsTakenByBridge: false`, and a visual gate whose evidence is
// named as `external-chromatic-cli-exit-code` or `not-provided`. This runs
// accessibility scans; it does not take visual snapshots, and a report that
// implied otherwise would be a claim about a service this code never called.
//
// So the visual gate has three conclusions rather than two. Without an exit code
// from the real tool it is `not_evaluated`, and the combined verdict is
// `not_evaluated` too — never `passed`. A bridge that reported "passed" for a
// check it never ran is the failure this whole file is arranged against.
//
// THE ACCESSIBILITY REPORT IS VALIDATED AGAINST WHAT WAS ASKED, not merely
// parsed: one site, and that site must be the story's own address; one domain,
// and it must be accessibility; a grid with exactly one entry. A report about
// some other page would otherwise pass silently under this story's name.
//
// And an exit code of one must be accompanied by findings at or above the
// threshold. Two statements that cannot both be true stop the run rather than
// being resolved in either direction.
//
// Output is removed before the run and again on any failure, so a partial run
// never leaves a report that reads as complete.
//
// NOTE, CARRIED OVER RATHER THAN FIXED: `loadStories` parses the manifest twice —
// once for the stories and once to count them. That is the original's own
// inefficiency; correcting it here would produce a different module and stop
// this being a recovery. Worth a separate change once this has landed.

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface BridgeDependencies {
  run(command: string, args: string[]): Promise<CommandResult>;
  read(location: string): Promise<string>;
  fetchText(location: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  ensureDir(path: string): Promise<void>;
  remove(path: string): Promise<void>;
}

export interface StoryTarget {
  id: string;
  title: string;
  name: string;
  previewUrl: string;
}

export interface BridgeOptions {
  manifest?: string;
  storyUrls?: readonly string[];
  previewBaseUrl?: string;
  outputDir: string;
  ariadaBinary?: string;
  severityThreshold?: 'minor' | 'moderate' | 'serious' | 'critical';
  allowPrivate?: boolean;
  chromaticExitCode?: number;
  chromaticBuildUrl?: string;
  chromaticProjectTokenPresent?: boolean;
}

export interface CanonicalStoryReport {
  schemaVersion: '1.0';
  kind: 'chromatic-ariada-story-report';
  story: StoryTarget;
  conclusion: 'passed' | 'failed';
  ariada: {
    exitCode: 0 | 1;
    findingCount: number;
    report: unknown;
  };
}

export interface CombinedBridgeReport {
  schemaVersion: '1.0';
  kind: 'chromatic-ariada-story-set-report';
  source: {
    kind: 'manifest' | 'preview-urls';
    location?: string;
    storyCount: number;
  };
  summary: {
    passedStoryCount: number;
    failedStoryCount: number;
    findingCount: number;
  };
  gates: {
    ariada: {
      conclusion: 'passed' | 'failed';
      exitCode: 0 | 1;
    };
    chromatic: {
      conclusion: 'passed' | 'failed' | 'not_evaluated';
      exitCode: number | null;
      evidence: 'external-chromatic-cli-exit-code' | 'not-provided';
      buildUrl?: string;
      projectTokenPresent: boolean;
    };
    combined: {
      conclusion: 'passed' | 'failed' | 'not_evaluated';
      exitCode: 0 | 1 | null;
    };
  };
  stories: Array<{
    story: StoryTarget;
    conclusion: 'passed' | 'failed';
    ariada: {
      exitCode: 0 | 1;
      findingCount: number;
    };
    reportPath: string;
  }>;
  execution: {
    ariadaInvocation: 'external-cli-per-story';
    ariadaDomains: ['accessibility'];
    acceptsAriadaExitOneAsFindings: true;
    chromaticNativePluginUsed: false;
    visualSnapshotsTakenByBridge: false;
  };
}

type Severity = 'minor' | 'moderate' | 'serious' | 'critical';

const severityRank: Record<Severity, number> = { minor: 1, moderate: 2, serious: 3, critical: 4 };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const isHttpLocation = (value: string): boolean => { try {
  const url = new URL(value);
  return url.protocol === 'http:' || url.protocol === 'https:';
}
catch {
  return false;
} };

function httpUrl(value: string, label: string, base?: string): string {
  let url: URL;
  try {
    url = base ? new URL(value, base) : new URL(value);
  }
  catch {
    throw new Error(`${label} is not a valid URL: ${value}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    throw new Error(`${label} must use http or https: ${value}`);
  return url.href;
}

function previewDirectoryUrl(value: string, label: string): string { const url = new URL(httpUrl(value, label)); if (!url.pathname.endsWith('/'))
  url.pathname += '/'; url.search = ''; url.hash = ''; return url.href; }

function manifestBase(options: BridgeOptions): string | undefined { if (options.previewBaseUrl)
  return previewDirectoryUrl(options.previewBaseUrl, '--preview-base-url'); if (options.manifest && isHttpLocation(options.manifest))
  return new URL('.', options.manifest).href; return undefined; }

function idFromUrl(previewUrl: string): string { const id = new URL(previewUrl).searchParams.get('id')?.trim(); if (!id)
  throw new Error('Story preview URL must include a non-empty id query parameter.'); return id; }

function normalizeDirectStory(previewUrl: string): StoryTarget { const normalized = httpUrl(previewUrl, 'Story preview URL'); const id = idFromUrl(normalized); return { id, title: id, name: id, previewUrl: normalized }; }

function normalizeManifestStory(value: unknown, base: string | undefined): StoryTarget {
  if (typeof value === 'string')
    return normalizeDirectStory(httpUrl(value, 'Manifest story URL', base));
  if (!isRecord(value) || typeof value['url'] !== 'string')
    throw new Error('Each manifest story must be a URL string or an object with a url.');
  const previewUrl = httpUrl(value['url'], 'Manifest story URL', base);
  const previewId = idFromUrl(previewUrl);
  const id = typeof value['id'] === 'string' && value['id'].trim() ? value['id'].trim() : previewId;
  if (id !== previewId)
    throw new Error(`Manifest story id ${id} does not match preview URL id ${previewId}.`);
  return { id, title: typeof value['title'] === 'string' && value['title'].trim() ? value['title'].trim() : id, name: typeof value['name'] === 'string' && value['name'].trim() ? value['name'].trim() : id, previewUrl };
}

function parseManifest(value: unknown, base: string | undefined): StoryTarget[] {
  if (!isRecord(value))
    throw new Error('Story manifest must be a JSON object.');
  if (Array.isArray(value['stories']))
    return value['stories'].map((story) => normalizeManifestStory(story, base));
  if (!isRecord(value['entries']))
    throw new Error('Manifest must contain stories[] or a Storybook entries object.');
  if (!base)
    throw new Error('A local Storybook index requires --preview-base-url for its served HTTP origin.');
  return Object.entries(value['entries']).flatMap(([key, item]) => {
    if (!isRecord(item))
      throw new Error(`Storybook entry ${key} must be an object.`);
    if (item['type'] === 'docs')
      return [];
    if (item['type'] !== 'story')
      throw new Error(`Storybook entry ${key} has an unsupported type.`);
    const id = typeof item['id'] === 'string' && item['id'].trim() ? item['id'].trim() : key.trim();
    const url = new URL('iframe.html', base);
    url.searchParams.set('id', id);
    url.searchParams.set('viewMode', 'story');
    return [{ id, title: typeof item['title'] === 'string' && item['title'].trim() ? item['title'].trim() : id, name: typeof item['name'] === 'string' && item['name'].trim() ? item['name'].trim() : id, previewUrl: url.href }];
  });
}

function validateStorySet(stories: StoryTarget[]): StoryTarget[] { if (!stories.length)
  throw new Error('Story set is empty.'); const ids = new Set<string>(); const urls = new Set<string>(); for (const story of stories) {
  if (!story.id.trim())
    throw new Error('Story id must not be empty.');
  if (ids.has(story.id))
    throw new Error(`Duplicate story id: ${story.id}`);
  if (urls.has(story.previewUrl))
    throw new Error(`Duplicate story preview URL: ${story.previewUrl}`);
  ids.add(story.id);
  urls.add(story.previewUrl);
} return [...stories].sort((a, b) => a.id.localeCompare(b.id)); }

const defaultDependencies: BridgeDependencies = {
  run: (command, args) => new Promise((resolveResult, reject) => { const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] }); let stdout = ''; let stderr = ''; child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8'); child.stdout.on('data', (chunk: string) => stdout += chunk); child.stderr.on('data', (chunk: string) => stderr += chunk); child.on('error', reject); child.on('close', (code) => resolveResult({ exitCode: code ?? 2, stdout, stderr })); }),
  read: (location) => readFile(location, 'utf8'), fetchText: async (location) => { const response = await fetch(location); if (!response.ok)
    throw new Error(`Manifest request failed with HTTP ${response.status}.`); return response.text(); },
  write: (path, content) => writeFile(path, content, 'utf8'), ensureDir: (path) => mkdir(path, { recursive: true }).then(() => undefined), remove: (path) => rm(path, { recursive: true, force: true }),
};

async function loadStories(options: BridgeOptions, dependencies: BridgeDependencies): Promise<{ stories: StoryTarget[]; source: CombinedBridgeReport['source'] }> {
  const direct = options.storyUrls ?? [];
  if (options.manifest && direct.length)
    throw new Error('Use either --manifest or --story-url, not both.');
  if (direct.length) {
    const stories = validateStorySet(direct.map(normalizeDirectStory));
    return { stories, source: { kind: 'preview-urls', storyCount: stories.length } };
  }
  if (!options.manifest)
    throw new Error('Provide --manifest or at least one --story-url.');
  let text: string;
  try {
    text = isHttpLocation(options.manifest) ? await dependencies.fetchText(options.manifest) : await dependencies.read(resolve(options.manifest));
  }
  catch (error) {
    throw new Error(`Could not read story manifest: ${String(error)}`);
  }
  try {
    return { stories: validateStorySet(parseManifest(JSON.parse(text), manifestBase(options))), source: { kind: 'manifest', location: options.manifest, storyCount: parseManifest(JSON.parse(text), manifestBase(options)).length } };
  }
  catch (error) {
    throw new Error(`Story manifest is not valid or supported: ${String(error)}`);
  }
}

function validateReport(value: unknown, expectedSite: string, threshold: Severity): { findingCount: number; thresholdFindingCount: number } {
  if (!isRecord(value) || !Array.isArray(value['sites']) || value['sites'].length !== 1 || typeof value['sites'][0] !== 'string' || httpUrl(value['sites'][0], 'Ariada report site') !== expectedSite || !Array.isArray(value['domains']) || value['domains'].length !== 1 || value['domains'][0] !== 'accessibility' || !isRecord(value['grid']) || Object.keys(value['grid']).length !== 1 || !Array.isArray(value['interactions']) || !isRecord(value['crossSite']) || !Array.isArray((value['crossSite'] as Record<string, unknown>)['systemic']) || !Array.isArray((value['crossSite'] as Record<string, unknown>)['divergence']))
    throw new Error('Ariada report is not canonical.');
  const site = value['sites'][0];
  const grid = (value['grid'] as Record<string, unknown>)[site];
  const findings = isRecord(grid) ? grid['accessibility'] : undefined;
  if (!Array.isArray(findings) || !findings.every(isRecord))
    throw new Error(`Ariada grid is malformed for ${site}/accessibility.`);
  let thresholdFindingCount = 0;
  for (const finding of findings) {
    const severity = finding['severity'];
    if (typeof severity !== 'string' || !(severity in severityRank))
      throw new Error('Ariada accessibility finding has an invalid severity.');
    if (severityRank[severity as Severity] >= severityRank[threshold])
      thresholdFindingCount++;
  }
  return { findingCount: findings.length, thresholdFindingCount };
}

function storyDirectoryName(id: string): string { return `${id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64) || 'story'}-${createHash('sha256').update(id).digest('hex').slice(0, 8)}`; }

function chromaticGate(options: BridgeOptions): CombinedBridgeReport['gates']['chromatic'] { const buildUrl = options.chromaticBuildUrl ? httpUrl(options.chromaticBuildUrl, '--chromatic-build-url') : undefined; if (options.chromaticExitCode === undefined)
  return { conclusion: 'not_evaluated', exitCode: null, evidence: 'not-provided', projectTokenPresent: options.chromaticProjectTokenPresent === true, ...(buildUrl ? { buildUrl } : {}) }; if (!Number.isInteger(options.chromaticExitCode) || options.chromaticExitCode < 0)
  throw new Error('--chromatic-exit-code must be a non-negative integer.'); return { conclusion: options.chromaticExitCode === 0 ? 'passed' : 'failed', exitCode: options.chromaticExitCode, evidence: 'external-chromatic-cli-exit-code', projectTokenPresent: options.chromaticProjectTokenPresent === true, ...(buildUrl ? { buildUrl } : {}) }; }

/**
 * Scan one story, keep its report, and say how it went.
 *
 * Split out of the run because the run was doing three jobs at once — laying out
 * directories, scanning each story, and assembling the combined verdict — and
 * only the middle one changes per story.
 */
async function scanOneStory(
  story: StoryTarget,
  context: {
    options: BridgeOptions;
    dependencies: BridgeDependencies;
    storiesDir: string;
    threshold: Severity;
  },
): Promise<{ report: CanonicalStoryReport; reportPath: string }> {
  const { options, dependencies, storiesDir, threshold } = context;
  const storyDir = resolve(storiesDir, storyDirectoryName(story.id));
  const ariadaDir = resolve(storyDir, 'ariada');
  const reportPath = resolve(storyDir, 'report.json');
  await dependencies.ensureDir(ariadaDir);

  const args = ['scan', story.previewUrl, '--domains', 'accessibility', '--format', 'json', '--severity-threshold', threshold, '--output-dir', ariadaDir];
  if (options.allowPrivate) args.push('--allow-private');
  const command = await dependencies.run(options.ariadaBinary ?? 'ariada', args);
  // Neither zero nor one is infrastructure failing, not a page with findings.
  if (command.exitCode !== 0 && command.exitCode !== 1)
    throw new Error(`Ariada infrastructure failed for ${story.id} with exit ${command.exitCode}: ${command.stderr.trim()}`);

  const raw = await readStoryReport(dependencies, ariadaDir, story.id);
  const counts = validateReport(raw, story.previewUrl, threshold);
  // Two statements that cannot both be true: the scanner said it found things,
  // the report carries none at or above the threshold.
  if (command.exitCode === 1 && counts.thresholdFindingCount === 0)
    throw new Error(`Ariada exit 1 for ${story.id} did not contain threshold findings.`);

  const report: CanonicalStoryReport = {
    schemaVersion: '1.0',
    kind: 'chromatic-ariada-story-report',
    story,
    conclusion: command.exitCode === 0 ? 'passed' : 'failed',
    ariada: { exitCode: command.exitCode, findingCount: counts.findingCount, report: raw },
  };
  await dependencies.write(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  return { report, reportPath };
}

/** The scanner's report, or a refusal naming the story it belongs to. */
async function readStoryReport(dependencies: BridgeDependencies, ariadaDir: string, storyId: string): Promise<unknown> {
  try {
    return JSON.parse(await dependencies.read(resolve(ariadaDir, 'multi-domain-report.json')));
  }
  catch (error) {
    throw new Error(`Ariada output is absent or unreadable for ${storyId}: ${String(error)}`);
  }
}

export async function runChromaticAriada(options: BridgeOptions, overrides: Partial<BridgeDependencies> = {}): Promise<CombinedBridgeReport> {
  const dependencies = { ...defaultDependencies, ...overrides };
  const outputDir = resolve(options.outputDir);
  const storiesDir = resolve(outputDir, 'stories');
  const combinedPath = resolve(outputDir, 'chromatic-ariada-report.json');
  await dependencies.ensureDir(outputDir);
  await dependencies.remove(storiesDir);
  await dependencies.remove(combinedPath);
  try {
    const loaded = await loadStories(options, dependencies);
    const threshold = options.severityThreshold ?? 'moderate';
    const reports: CanonicalStoryReport[] = [];
    const summaries: CombinedBridgeReport['stories'] = [];
    for (const story of loaded.stories) {
      const { report, reportPath } = await scanOneStory(story, {
        options, dependencies, storiesDir, threshold,
      });
      reports.push(report);
      summaries.push({
        story,
        conclusion: report.conclusion,
        ariada: { exitCode: report.ariada.exitCode, findingCount: report.ariada.findingCount },
        reportPath: relative(outputDir, reportPath).split('\\').join('/'),
      });
    }
    const failed = reports.filter((report) => report.conclusion === 'failed').length;
    const ariada = { conclusion: failed ? 'failed' : 'passed', exitCode: failed ? 1 : 0 } as CombinedBridgeReport['gates']['ariada'];
    const chromatic = chromaticGate(options);
    const combinedConclusion = ariada.conclusion === 'failed' || chromatic.conclusion === 'failed' ? 'failed' : chromatic.conclusion === 'passed' ? 'passed' : 'not_evaluated';
    const report: CombinedBridgeReport = { schemaVersion: '1.0', kind: 'chromatic-ariada-story-set-report', source: loaded.source, summary: { passedStoryCount: reports.length - failed, failedStoryCount: failed, findingCount: reports.reduce((sum, item) => sum + item.ariada.findingCount, 0) }, gates: { ariada, chromatic, combined: { conclusion: combinedConclusion, exitCode: combinedConclusion === 'not_evaluated' ? null : combinedConclusion === 'passed' ? 0 : 1 } }, stories: summaries, execution: { ariadaInvocation: 'external-cli-per-story', ariadaDomains: ['accessibility'], acceptsAriadaExitOneAsFindings: true, chromaticNativePluginUsed: false, visualSnapshotsTakenByBridge: false } };
    await dependencies.write(combinedPath, `${JSON.stringify(report, null, 2)}\n`);
    return report;
  }
  catch (error) {
    await dependencies.remove(storiesDir);
    await dependencies.remove(combinedPath);
    throw error;
  }
}

export function bridgeExitCode(report: CombinedBridgeReport): 0 | 1 { return report.gates.combined.exitCode ?? report.gates.ariada.exitCode; }

function parseArguments(argv: readonly string[]): BridgeOptions { const options: BridgeOptions = { outputDir: '.chromatic-ariada', storyUrls: [] }; const urls: string[] = []; const value = (i: number, flag: string): string => { const result = argv[i + 1]; if (!result || result.startsWith('--'))
  throw new Error(`${flag} requires a value.`); return result; }; for (let i = 0; i < argv.length; i++) {
  const flag = argv[i];
  switch (flag) {
    case '--manifest':
      options.manifest = value(i++, flag);
      break;
    case '--story-url':
      urls.push(value(i++, flag));
      break;
    case '--preview-base-url':
      options.previewBaseUrl = value(i++, flag);
      break;
    case '--output-dir':
      options.outputDir = value(i++, flag);
      break;
    case '--ariada-binary':
      options.ariadaBinary = value(i++, flag);
      break;
    case '--severity-threshold': {
      const severity = value(i++, flag);
      if (!(severity in severityRank))
        throw new Error('--severity-threshold must be minor, moderate, serious, or critical.');
      options.severityThreshold = severity as Severity;
      break;
    }
    case '--chromatic-exit-code': {
      const code = Number(value(i++, flag));
      if (!Number.isInteger(code) || code < 0)
        throw new Error('--chromatic-exit-code must be a non-negative integer.');
      options.chromaticExitCode = code;
      break;
    }
    case '--chromatic-build-url':
      options.chromaticBuildUrl = value(i++, flag);
      break;
    case '--allow-private':
      options.allowPrivate = true;
      break;
    case '--help':
      console.log('chromatic-ariada --manifest <index.json> [--preview-base-url <url>] [--output-dir <path>]');
      return options;
    default: throw new Error(`Unknown argument: ${String(flag)}`);
  }
} options.storyUrls = urls; return options; }

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href && !process.argv.includes('--help'))
  runChromaticAriada(parseArguments(process.argv.slice(2))).then((report) => { process.exitCode = bridgeExitCode(report); }).catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 2; });
