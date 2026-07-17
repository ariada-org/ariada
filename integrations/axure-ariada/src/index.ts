// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { createReadStream } from 'node:fs';
import { access, readdir, readFile, stat } from 'node:fs/promises';
import { createServer, type ServerResponse } from 'node:http';
import { extname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

export type BrowserName = 'chromium' | 'firefox' | 'webkit';
export type OutputFormat = 'human' | 'json' | 'both';
export type SeverityThreshold = 'minor' | 'moderate' | 'serious' | 'critical';

export interface AxureAriadaConfig {
  publishDir?: string;
  targetUrl?: string;
  outputDir?: string;
  browser?: BrowserName;
  format?: OutputFormat;
  severityThreshold?: SeverityThreshold;
  timeoutMs?: number;
  domains?: string[];
  entryFile?: string;
}

export interface DiscoveredPublish {
  dir: string;
  entryFile: string;
  score: number;
  markers: string[];
}

export interface RunnerInvocation {
  command: string;
  args: string[];
  cwd?: string;
}

export interface RunnerResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export type CliRunner = (invocation: RunnerInvocation) => Promise<RunnerResult>;

export interface RunAxureScanOptions {
  cwd?: string;
  cliCommand?: string;
  runner?: CliRunner;
}

export interface AxureScanResult extends RunnerResult {
  commandLine: string;
  targetUrl: string;
  servedPublishDir?: string;
}

const BROWSERS = new Set(['chromium', 'firefox', 'webkit']);
const FORMATS = new Set(['human', 'json', 'both']);
const THRESHOLDS = new Set(['minor', 'moderate', 'serious', 'critical']);
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'scan-evidence', 'coverage']);

export function validateConfig(config: AxureAriadaConfig): string[] {
  const errors: string[] = [];
  if (!config.publishDir && !config.targetUrl) {
    errors.push('Set publishDir for a local Axure HTML export or targetUrl for an already hosted prototype.');
  }
  if (config.publishDir && config.targetUrl) {
    errors.push('Use either publishDir or targetUrl, not both.');
  }
  if (config.targetUrl && !/^https?:\/\/\S+$/iu.test(config.targetUrl)) {
    errors.push('targetUrl must be an http(s) URL because @ariada-org/cli scans browser URLs.');
  }
  if (config.browser && !BROWSERS.has(config.browser)) {
    errors.push(`Unsupported browser: ${config.browser}.`);
  }
  if (config.format && !FORMATS.has(config.format)) {
    errors.push(`Unsupported format: ${config.format}.`);
  }
  if (config.severityThreshold && !THRESHOLDS.has(config.severityThreshold)) {
    errors.push(`Unsupported severityThreshold: ${config.severityThreshold}.`);
  }
  if (config.timeoutMs !== undefined && (!Number.isInteger(config.timeoutMs) || config.timeoutMs <= 0)) {
    errors.push('timeoutMs must be a positive integer.');
  }
  if (config.domains?.some((domain) => domain.trim().length === 0)) {
    errors.push('domains must not contain empty values.');
  }
  return errors;
}

export async function loadConfig(path: string): Promise<AxureAriadaConfig> {
  const body = await readFile(path, 'utf8');
  return JSON.parse(body) as AxureAriadaConfig;
}

export async function findAxurePublishOutput(
  startDir: string,
  options: { maxDepth?: number; entryFile?: string } = {},
): Promise<DiscoveredPublish> {
  const root = resolve(startDir);
  const maxDepth = options.maxDepth ?? 4;
  const candidates: DiscoveredPublish[] = [];

  async function visit(dir: string, depth: number): Promise<void> {
    const discovered = await inspectPublishDir(dir, options.entryFile);
    if (discovered) candidates.push(discovered);
    if (depth >= maxDepth) return;

    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || SKIP_DIRS.has(entry.name)) continue;
      await visit(join(dir, entry.name), depth + 1);
    }
  }

  await visit(root, 0);
  candidates.sort((a, b) => b.score - a.score || a.dir.localeCompare(b.dir));
  const best = candidates[0];
  if (!best || best.score < 3) {
    throw new Error(
      `No Axure HTML publish output found under ${root}. Expected index.html plus Axure resource markers.`,
    );
  }
  return best;
}

export function buildAriadaCliArgs(targetUrl: string, config: AxureAriadaConfig): string[] {
  const args = ['scan', targetUrl];
  args.push('--output-dir', resolve(config.outputDir ?? './ariada-output'));
  args.push('--browser', config.browser ?? 'chromium');
  args.push('--format', config.format ?? 'both');
  args.push('--severity-threshold', config.severityThreshold ?? 'moderate');
  args.push('--timeout-ms', String(config.timeoutMs ?? 30_000));
  if (config.domains && config.domains.length > 0) {
    args.push('--domains', config.domains.join(','));
  }
  return args;
}

export async function runAxureScan(
  config: AxureAriadaConfig,
  options: RunAxureScanOptions = {},
): Promise<AxureScanResult> {
  const errors = validateConfig(config);
  if (errors.length > 0) throw new Error(errors.join('\n'));

  const cwd = resolve(options.cwd ?? process.cwd());
  const command = options.cliCommand ?? process.env['ARIADA_CLI'] ?? 'ariada';
  const runner = options.runner ?? spawnCli;
  let closeServer: (() => Promise<void>) | undefined;
  let targetUrl = config.targetUrl;
  let servedPublishDir: string | undefined;

  try {
    if (!targetUrl) {
      const publishRoot = resolve(cwd, config.publishDir ?? '.');
      const discovered = await findAxurePublishOutput(publishRoot, { entryFile: config.entryFile });
      const served = await serveStatic(discovered.dir);
      closeServer = served.close;
      servedPublishDir = discovered.dir;
      targetUrl = new URL(pathToUrlPath(discovered.entryFile), served.baseUrl).toString();
    }

    const args = buildAriadaCliArgs(targetUrl, config);
    const result = await runner({ command, args, cwd });
    return {
      ...result,
      commandLine: formatCommand(command, args),
      targetUrl,
      ...(servedPublishDir ? { servedPublishDir } : {}),
    };
  } finally {
    await closeServer?.();
  }
}

async function inspectPublishDir(dir: string, entryFile = 'index.html'): Promise<DiscoveredPublish | undefined> {
  const markers: string[] = [];
  const entry = join(dir, entryFile);
  if (!(await fileExists(entry))) return undefined;

  const markerPaths = [
    'resources/scripts/axure/axQuery.js',
    'resources/scripts/axure/events.js',
    'resources/css/axure_rp_page.css',
    'data/document.js',
  ];
  for (const marker of markerPaths) {
    if (await fileExists(join(dir, ...marker.split('/')))) markers.push(marker);
  }

  const html = await readFile(entry, 'utf8').catch(() => '');
  if (/axure|axshare|axure\.prototype|Generated by Axure/i.test(html)) {
    markers.push(`${entryFile}:axure-html-marker`);
  }

  const score = markers.length + (entryFile === 'index.html' ? 1 : 0);
  if (score === 0) return undefined;
  return { dir, entryFile, score, markers };
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function serveStatic(root: string): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const safeRoot = resolve(root);
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const requested = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const filePath = resolve(safeRoot, `.${requested}`);
    if (!filePath.startsWith(`${safeRoot}${sep}`) && filePath !== safeRoot) {
      send(res, 403, 'Forbidden');
      return;
    }
    try {
      const info = await stat(filePath);
      if (!info.isFile()) {
        send(res, 404, 'Not found');
        return;
      }
      res.writeHead(200, { 'content-type': contentType(filePath) });
      createReadStream(filePath).pipe(res);
    } catch {
      send(res, 404, 'Not found');
    }
  });

  await new Promise<void>((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolvePromise());
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not bind local Axure export server.');
  return {
    baseUrl: `http://127.0.0.1:${address.port}/`,
    close: () =>
      new Promise<void>((resolvePromise, reject) => {
        server.close((err) => (err ? reject(err) : resolvePromise()));
      }),
  };
}

function send(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
  res.end(body);
}

function contentType(path: string): string {
  switch (extname(path).toLowerCase()) {
    case '.css':
      return 'text/css; charset=utf-8';
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.png':
      return 'image/png';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

function pathToUrlPath(entryFile: string): string {
  return entryFile
    .split(/[\\/]+/u)
    .map((part) => encodeURIComponent(part))
    .join('/');
}

function formatCommand(command: string, args: string[]): string {
  return [command, ...args].map((part) => (/\s/u.test(part) ? JSON.stringify(part) : part)).join(' ');
}

async function spawnCli(invocation: RunnerInvocation): Promise<RunnerResult> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(invocation.command, invocation.args, {
      cwd: invocation.cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.once('error', reject);
    child.once('close', (code) => {
      resolvePromise({ exitCode: code ?? 1, stdout, stderr });
    });
  });
}

export function relativeToCwd(path: string, cwd = process.cwd()): string {
  const rel = relative(cwd, path);
  return rel.length > 0 ? rel : '.';
}
