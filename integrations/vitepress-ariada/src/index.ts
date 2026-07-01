// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/* eslint-disable jsdoc/require-jsdoc */

import { spawn } from 'node:child_process';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, readFile, readdir } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';

export type Severity = 'minor' | 'moderate' | 'serious' | 'critical';
export type CliRunner = (command: string, args: string[]) => Promise<CliProcessResult>;

export interface CliProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface AriadaVitePressOptions {
  siteRoot?: string;
  outDir?: string;
  outputDir?: string;
  cliCommand?: string;
  cliArgs?: string[];
  domains?: string[];
  browser?: 'chromium' | 'firefox' | 'webkit';
  format?: 'human' | 'json' | 'both';
  severityThreshold?: Severity;
  timeoutMs?: number;
  failOnViolations?: boolean;
  runner?: CliRunner;
}

export interface AriadaVitePressResult extends CliProcessResult {
  command: string[];
  targetUrl: string;
  outputDir: string;
  reportPath: string | null;
  totalFindings: number;
  gateFailed: boolean;
  runtimeFailed: boolean;
}

export interface VitePressConfigLike {
  root?: string;
  srcDir?: string;
  outDir?: string;
  buildEnd?: (siteConfig?: VitePressSiteConfigLike) => Promise<void> | void;
  vite?: {
    plugins?: unknown[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface VitePressSiteConfigLike {
  root?: string;
  srcDir?: string;
  outDir?: string;
  [key: string]: unknown;
}

export interface VitePluginLike {
  name: string;
  enforce: 'post';
  apply: 'build';
  closeBundle(): Promise<void>;
}

const severityRank: Record<Severity, number> = {
  minor: 1,
  moderate: 2,
  serious: 3,
  critical: 4,
};

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
]);

export function withAriada(
  config: VitePressConfigLike = {},
  options: AriadaVitePressOptions = {},
): VitePressConfigLike {
  const originalBuildEnd = config.buildEnd;

  return {
    ...config,
    async buildEnd(siteConfig?: VitePressSiteConfigLike) {
      await originalBuildEnd?.(siteConfig);
      const siteRoot = options.siteRoot ?? siteConfig?.root ?? config.root ?? process.cwd();
      const outDir = options.outDir ?? siteConfig?.outDir ?? config.outDir ?? join(siteRoot, '.vitepress', 'dist');
      const result = await runAriadaVitePressScan({ ...options, siteRoot, outDir });
      if (result.runtimeFailed) {
        throw new Error(`Ariada VitePress scan failed to run: ${result.stderr || result.stdout}`);
      }
      if (result.gateFailed && options.failOnViolations !== false) {
        throw new Error(`Ariada VitePress gate failed with ${result.totalFindings} finding(s).`);
      }
    },
  };
}

export function ariadaVitePress(options: AriadaVitePressOptions = {}): VitePluginLike {
  return {
    name: '@ariada-org/vitepress-ariada',
    enforce: 'post',
    apply: 'build',
    async closeBundle() {
      const result = await runAriadaVitePressScan(options);
      if (result.runtimeFailed) {
        throw new Error(`Ariada VitePress scan failed to run: ${result.stderr || result.stdout}`);
      }
      if (result.gateFailed && options.failOnViolations !== false) {
        throw new Error(`Ariada VitePress gate failed with ${result.totalFindings} finding(s).`);
      }
    },
  };
}

export async function runAriadaVitePressScan(
  options: AriadaVitePressOptions = {},
): Promise<AriadaVitePressResult> {
  const outDir = resolve(options.outDir ?? join(options.siteRoot ?? process.cwd(), '.vitepress', 'dist'));
  const outputDir = resolve(options.outputDir ?? join(outDir, 'ariada-output'));
  await mkdir(outputDir, { recursive: true });
  await assertHtmlOutput(outDir);

  const server = await serveDirectory(outDir);
  try {
    const command = options.cliCommand ?? 'npx';
    const args = buildAriadaCliArgs(options, server.url, outputDir);
    const runner = options.runner ?? spawnRunner;
    const completed = await runner(command, args);
    const report = await readReportSummary(outputDir, options.severityThreshold ?? 'moderate');
    return {
      ...completed,
      command: [command, ...args],
      targetUrl: server.url,
      outputDir,
      reportPath: report.path,
      totalFindings: report.total,
      gateFailed: completed.exitCode === 1 || report.total > 0,
      runtimeFailed: completed.exitCode >= 2,
    };
  } finally {
    await server.close();
  }
}

export function buildAriadaCliArgs(
  options: AriadaVitePressOptions,
  targetUrl: string,
  outputDir = resolve(options.outputDir ?? 'ariada-output'),
): string[] {
  const args = [
    ...(options.cliArgs ?? ['-y', '@ariada-org/cli']),
    'scan',
    targetUrl,
    '--format',
    options.format ?? 'both',
    '--output-dir',
    outputDir,
    '--browser',
    options.browser ?? 'chromium',
    '--severity-threshold',
    options.severityThreshold ?? 'moderate',
    '--timeout-ms',
    String(options.timeoutMs ?? 30_000),
  ];

  if (options.domains && options.domains.length > 0) {
    args.push('--domains', options.domains.join(','));
  }
  return args;
}

export async function readReportSummary(
  outputDir: string,
  threshold: Severity = 'moderate',
): Promise<{ path: string | null; total: number }> {
  for (const name of ['multi-domain-report.json', 'scan.json']) {
    const path = join(resolve(outputDir), name);
    if (existsSync(path)) {
      const data = JSON.parse(await readFile(path, 'utf8')) as unknown;
      return { path, total: countFindings(data, threshold) };
    }
  }
  return { path: null, total: 0 };
}

export function countFindings(data: unknown, threshold: Severity = 'moderate'): number {
  const severities: string[] = [];
  collectSeverities(data, severities);
  const minimum = severityRank[threshold];
  return severities.filter((severity) => severityRank[severity as Severity] >= minimum).length;
}

async function assertHtmlOutput(outDir: string): Promise<void> {
  const files = await listHtmlFiles(outDir);
  if (files.length === 0) {
    throw new Error(`No HTML files found under ${outDir}. Run vitepress build before the Ariada hook.`);
  }
}

async function listHtmlFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) files.push(...(await listHtmlFiles(fullPath)));
    if (entry.isFile() && entry.name.endsWith('.html')) files.push(fullPath);
  }
  return files.sort();
}

function collectSeverities(value: unknown, out: string[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectSeverities(item, out);
    return;
  }
  if (!value || typeof value !== 'object') return;

  const record = value as Record<string, unknown>;
  if (typeof record['severity'] === 'string') out.push(record['severity'].toLowerCase());
  if (typeof record['impact'] === 'string') out.push(record['impact'].toLowerCase());
  for (const child of Object.values(record)) collectSeverities(child, out);
}

function spawnRunner(command: string, args: string[]): Promise<CliProcessResult> {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('close', (exitCode) => {
      resolvePromise({ exitCode: exitCode ?? 2, stdout, stderr });
    });
    child.on('error', (error: Error) => {
      resolvePromise({ exitCode: 2, stdout, stderr: error.message });
    });
  });
}

function serveDirectory(rootInput: string): Promise<{ url: string; close: () => Promise<void> }> {
  const root = resolve(rootInput);
  const server: Server = createServer((request, response) => {
    const requestedPath = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
    const cleanPath = decodeURIComponent(requestedPath).replace(/^\/+/, '') || 'index.html';
    const fullPath = resolve(root, cleanPath);
    if (!fullPath.startsWith(`${root}${sep}`) && fullPath !== root) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }
    if (!existsSync(fullPath)) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }
    response.writeHead(200, {
      'content-type': contentTypes.get(extname(fullPath)) ?? 'application/octet-stream',
    });
    createReadStream(fullPath).pipe(response);
  });

  return new Promise((resolvePromise) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Unable to allocate local preview server port.');
      }
      resolvePromise({
        url: `http://127.0.0.1:${address.port}/`,
        close: () =>
          new Promise((closeResolve, closeReject) => {
            server.close((error) => {
              if (error) closeReject(error);
              else closeResolve();
            });
          }),
      });
    });
  });
}
