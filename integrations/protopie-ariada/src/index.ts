// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { createReadStream } from 'node:fs';
import { access, readdir, readFile, stat } from 'node:fs/promises';
import { createServer, type ServerResponse } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { spawn } from 'node:child_process';

export type BrowserName = 'chromium' | 'firefox' | 'webkit';
export type OutputFormat = 'human' | 'json' | 'both';
export type SeverityThreshold = 'minor' | 'moderate' | 'serious' | 'critical';

export interface ProtoPieAriadaConfig {
  pieBundleDir?: string;
  hostDir?: string;
  targetUrl?: string;
  outputDir?: string;
  browser?: BrowserName;
  format?: OutputFormat;
  severityThreshold?: SeverityThreshold;
  timeoutMs?: number;
  domains?: string[];
  entryFile?: string;
}

export interface ProtoPieLayer {
  id: string;
  name: string;
  type: 'text' | 'image' | 'shape' | 'input' | 'hotspot';
  text?: string;
  width?: number;
  height?: number;
  visible?: boolean;
}

export interface ProtoPieScene {
  id: string;
  name: string;
  layers: ProtoPieLayer[];
}

export interface ProtoPieBundle {
  dir: string;
  pieFile?: string;
  manifestFile?: string;
  scenes: ProtoPieScene[];
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

export interface RunProtoPieScanOptions {
  cwd?: string;
  cliCommand?: string;
  runner?: CliRunner;
}

export interface ProtoPieScanResult extends RunnerResult {
  commandLine: string;
  targetUrl: string;
  servedHostDir?: string;
  bundle?: ProtoPieBundle;
}

const BROWSERS = new Set(['chromium', 'firefox', 'webkit']);
const FORMATS = new Set(['human', 'json', 'both']);
const THRESHOLDS = new Set(['minor', 'moderate', 'serious', 'critical']);
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'dist-cjs', 'coverage', 'scan-evidence']);

export function validateConfig(config: ProtoPieAriadaConfig): string[] {
  const errors: string[] = [];
  if (!config.targetUrl && !config.hostDir) {
    errors.push('Set targetUrl for ProtoPie Cloud/Player or hostDir for a representative hosted prototype fixture.');
  }
  if (config.targetUrl && config.hostDir) {
    errors.push('Use either targetUrl or hostDir as the scan target, not both.');
  }
  if (config.targetUrl && !/^https?:\/\/\S+$/iu.test(config.targetUrl)) {
    errors.push('targetUrl must be an http(s) URL because @ariada-org/cli scans browser URLs.');
  }
  if (config.browser && !BROWSERS.has(config.browser)) errors.push(`Unsupported browser: ${config.browser}.`);
  if (config.format && !FORMATS.has(config.format)) errors.push(`Unsupported format: ${config.format}.`);
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

export async function loadConfig(path: string): Promise<ProtoPieAriadaConfig> {
  const body = await readFile(path, 'utf8');
  return JSON.parse(body) as ProtoPieAriadaConfig;
}

export async function inspectProtoPieBundle(startDir: string): Promise<ProtoPieBundle> {
  const root = resolve(startDir);
  const markers: string[] = [];
  const scenes: ProtoPieScene[] = [];
  let pieFile: string | undefined;
  let manifestFile: string | undefined;

  async function visit(dir: string, depth: number): Promise<void> {
    if (depth > 4) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) await visit(full, depth + 1);
      } else if (entry.name.endsWith('.pie')) {
        pieFile = full;
        markers.push('.pie bundle marker');
      } else if (/manifest|prototype|scene/iu.test(entry.name) && entry.name.endsWith('.json')) {
        const parsed = await parseSceneJson(full);
        if (parsed.length > 0) {
          manifestFile ??= full;
          scenes.push(...parsed);
          markers.push(`${entry.name}:scene-json`);
        }
      }
    }
  }

  await visit(root, 0);
  if (!pieFile && !manifestFile) {
    throw new Error(`No ProtoPie fixture markers found under ${root}. Expected .pie or scene JSON metadata.`);
  }
  return { dir: root, ...(pieFile ? { pieFile } : {}), ...(manifestFile ? { manifestFile } : {}), scenes, markers };
}

export function summarizeStaticSurface(bundle: ProtoPieBundle): string[] {
  const lines: string[] = [];
  for (const scene of bundle.scenes) {
    const visibleLayers = scene.layers.filter((layer) => layer.visible !== false);
    const textCount = visibleLayers.filter((layer) => layer.type === 'text' || layer.type === 'input').length;
    const targetCount = visibleLayers.filter((layer) => {
      const w = layer.width ?? 0;
      const h = layer.height ?? 0;
      return layer.type === 'hotspot' || layer.type === 'input' || (w > 0 && h > 0 && (w < 44 || h < 44));
    }).length;
    lines.push(`${scene.name}: ${visibleLayers.length} visible layers, ${textCount} text/input layers, ${targetCount} target-size candidates`);
  }
  return lines;
}

export function buildAriadaCliArgs(targetUrl: string, config: ProtoPieAriadaConfig): string[] {
  const args = ['scan', targetUrl];
  args.push('--output-dir', resolve(config.outputDir ?? './ariada-output'));
  args.push('--browser', config.browser ?? 'chromium');
  args.push('--format', config.format ?? 'both');
  args.push('--severity-threshold', config.severityThreshold ?? 'moderate');
  args.push('--timeout-ms', String(config.timeoutMs ?? 30_000));
  if (config.domains && config.domains.length > 0) args.push('--domains', config.domains.join(','));
  return args;
}

export async function runProtoPieScan(
  config: ProtoPieAriadaConfig,
  options: RunProtoPieScanOptions = {},
): Promise<ProtoPieScanResult> {
  const errors = validateConfig(config);
  if (errors.length > 0) throw new Error(errors.join('\n'));

  const cwd = resolve(options.cwd ?? process.cwd());
  const command = options.cliCommand ?? process.env['ARIADA_CLI'] ?? 'ariada';
  const runner = options.runner ?? spawnCli;
  let closeServer: (() => Promise<void>) | undefined;
  let targetUrl = config.targetUrl;
  let servedHostDir: string | undefined;
  let bundle: ProtoPieBundle | undefined;

  try {
    if (config.pieBundleDir) {
      bundle = await inspectProtoPieBundle(resolve(cwd, config.pieBundleDir));
    }
    if (!targetUrl) {
      const hostRoot = resolve(cwd, config.hostDir ?? '.');
      const entryFile = config.entryFile ?? 'index.html';
      const entryPath = resolve(hostRoot, entryFile);
      if (!(await fileExists(entryPath))) throw new Error(`Missing ProtoPie host entry: ${entryPath}`);
      const served = await serveStatic(hostRoot);
      closeServer = served.close;
      servedHostDir = hostRoot;
      targetUrl = new URL(pathToUrlPath(entryFile), served.baseUrl).toString();
    }

    const args = buildAriadaCliArgs(targetUrl, config);
    const result = await runner({ command, args, cwd });
    return {
      ...result,
      commandLine: formatCommand(command, args),
      targetUrl,
      ...(servedHostDir ? { servedHostDir } : {}),
      ...(bundle ? { bundle } : {}),
    };
  } finally {
    await closeServer?.();
  }
}

async function parseSceneJson(path: string): Promise<ProtoPieScene[]> {
  const body = await readFile(path, 'utf8').catch(() => '');
  if (!body.trim()) return [];
  const parsed = JSON.parse(body) as {
    scenes?: ProtoPieScene[];
    scene?: ProtoPieScene;
    layers?: ProtoPieLayer[];
    id?: string;
    name?: string;
  };
  if (Array.isArray(parsed.scenes)) return parsed.scenes;
  if (parsed.scene) return [parsed.scene];
  if (Array.isArray(parsed.layers)) {
    return [{ id: parsed.id ?? 'scene', name: parsed.name ?? 'Scene', layers: parsed.layers }];
  }
  return [];
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
  if (!address || typeof address === 'string') throw new Error('Could not bind local ProtoPie host server.');
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

function contentType(filePath: string): string {
  switch (extname(filePath).toLowerCase()) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    default:
      return 'application/octet-stream';
  }
}

function pathToUrlPath(path: string): string {
  return path.split(/[\\/]/u).map(encodeURIComponent).join('/');
}

function formatCommand(command: string, args: string[]): string {
  return [command, ...args].map((part) => (/\s/u.test(part) ? JSON.stringify(part) : part)).join(' ');
}

async function spawnCli(invocation: RunnerInvocation): Promise<RunnerResult> {
  return new Promise((resolvePromise) => {
    const child = spawn(invocation.command, invocation.args, {
      cwd: invocation.cwd,
      shell: false,
      env: process.env,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('close', (code) => resolvePromise({ exitCode: code ?? 1, stdout, stderr }));
    child.on('error', (err) => resolvePromise({ exitCode: 3, stdout, stderr: `${stderr}${err.message}\n` }));
  });
}
