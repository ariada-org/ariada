// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// This module has since been released from that comparison, and the sentence is
// on one line because the guard reads for it literally.
//
// HOW IT IS HELD NOW. While the comparison still matched, nine behaviour tests
// were written against the configuration check, and only then was it split into
// "which source was named" and "is each value one we can act on". It sat at
// twenty-two against a limit of fifteen.
//
// The tests were checked against damage. Stop refusing two sources at once,
// accept any address rather than an http one, drop the severity check, or
// return at the first complaint instead of collecting them — each fails a test
// that passes otherwise, and the last fails three.
//
// The guarantee lives in `tests/scripts/recovered-marvel-config.test.ts`, and
// the release is recorded in `tests/scripts/vypushchennye-iz-slicheniya.txt`.
import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer, type ServerResponse } from 'node:http';
import { extname, relative, resolve, sep } from 'node:path';

export type BrowserName = 'chromium' | 'firefox' | 'webkit';
export type OutputFormat = 'human' | 'json' | 'both';
export type SeverityThreshold = 'minor' | 'moderate' | 'serious' | 'critical';

export interface MarvelAriadaConfig {
  fixturePath?: string;
  apiEndpoint?: string;
  apiToken?: string;
  projectId?: string;
  shareUrl?: string;
  targetUrl?: string;
  workDir?: string;
  outputDir?: string;
  browser?: BrowserName;
  format?: OutputFormat;
  severityThreshold?: SeverityThreshold;
  timeoutMs?: number;
  domains?: string[];
}

export interface MarvelProject {
  id: string;
  name: string;
  shareUrl?: string;
  handoffUrl?: string;
  device?: string;
  updatedAt?: string;
}

export interface MarvelHotspot {
  label: string;
  targetScreenId?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface MarvelScreen {
  id: string;
  name: string;
  path?: string;
  width?: number;
  height?: number;
  background?: string;
  imageUrl?: string;
  htmlUrl?: string;
  text: string[];
  hotspots: MarvelHotspot[];
  handoff?: {
    colors?: string[];
    fonts?: string[];
    assetFormats?: string[];
  };
}

export interface MarvelExport {
  project: MarvelProject;
  screens: MarvelScreen[];
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

export interface RunMarvelScanOptions {
  cwd?: string;
  cliCommand?: string;
  runner?: CliRunner;
  fetchImpl?: typeof fetch;
}

export interface MarvelScanResult extends RunnerResult {
  commandLine: string;
  targetUrl: string;
  scanTargetPath?: string;
}

const BROWSERS = new Set(['chromium', 'firefox', 'webkit']);
const FORMATS = new Set(['human', 'json', 'both']);
const THRESHOLDS = new Set(['minor', 'moderate', 'serious', 'critical']);

/**
 * Which source was named, and whether it was named completely.
 *
 * Exactly one of the three is allowed. None leaves nothing to scan; two means
 * the report names one of them and the reader believes it — and neither mistake
 * shows up later, because both produce a run that finishes.
 */
function sourceErrors(config: MarvelAriadaConfig): string[] {
  const errors: string[] = [];
  const hasFixture = Boolean(config.fixturePath);
  const hasApi = Boolean(config.apiEndpoint || config.projectId || config.apiToken);
  const hasUrl = Boolean(config.targetUrl || config.shareUrl);
  const sourceCount = [hasFixture, hasApi, hasUrl].filter(Boolean).length;

  if (sourceCount === 0) {
    errors.push('Set fixturePath, targetUrl/shareUrl, or apiEndpoint + projectId + apiToken.');
  }
  if (sourceCount > 1) {
    errors.push('Use one Marvel source at a time: fixture, live URL, or API project.');
  }
  if (hasApi) {
    if (!config.apiEndpoint) errors.push('apiEndpoint is required for Marvel API scans.');
    if (!config.projectId) errors.push('projectId is required for Marvel API scans.');
    if (!config.apiToken) errors.push('apiToken or MARVEL_API_TOKEN is required for Marvel API scans.');
  }
  return errors;
}

/**
 * Whether each value that was given is one this can act on.
 *
 * Every complaint is collected rather than returned at the first: someone
 * fixing a configuration file wants the whole list, not one error per run.
 */
function valueErrors(config: MarvelAriadaConfig): string[] {
  const errors: string[] = [];
  for (const urlField of ['targetUrl', 'shareUrl', 'apiEndpoint'] as const) {
    const value = config[urlField];
    if (value && !/^https?:\/\/\S+$/iu.test(value)) {
      errors.push(`${urlField} must be an http(s) URL.`);
    }
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

export function validateConfig(config: MarvelAriadaConfig): string[] {
  return [...sourceErrors(config), ...valueErrors(config)];
}

export async function loadConfig(path: string): Promise<MarvelAriadaConfig> {
  const body = await readFile(path, 'utf8');
  return JSON.parse(body) as MarvelAriadaConfig;
}

export async function loadMarvelExport(
  config: MarvelAriadaConfig,
  options: { cwd?: string; fetchImpl?: typeof fetch } = {},
): Promise<MarvelExport> {
  const cwd = resolve(options.cwd ?? process.cwd());
  if (config.fixturePath) {
    const body = await readFile(resolve(cwd, config.fixturePath), 'utf8');
    return normalizeMarvelExport(JSON.parse(body));
  }

  if (!config.apiEndpoint || !config.projectId || !config.apiToken) {
    throw new Error('Marvel API export requires apiEndpoint, projectId, and apiToken.');
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(config.apiEndpoint, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${config.apiToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      query: marvelProjectQuery(),
      variables: { projectId: config.projectId },
    }),
  });
  if (!response.ok) {
    throw new Error(`Marvel API request failed: ${response.status} ${response.statusText}`);
  }
  return normalizeMarvelExport(await response.json());
}

export function normalizeMarvelExport(input: unknown): MarvelExport {
  const root = asRecord(input) ?? {};
  const data = asRecord(root['data']) ?? {};
  const projectRaw =
    asRecord(root['project']) ??
    asRecord(data['project']) ??
    asRecord(data['node']) ??
    asRecord(root['prototype']);
  if (!projectRaw) throw new Error('Marvel export fixture is missing a project object.');

  const screensRaw =
    asArray(root['screens']) ??
    asArray(projectRaw['screens']) ??
    asArray(asRecord(projectRaw['screens'])?.['nodes']) ??
    asArray(asRecord(projectRaw['screens'])?.['edges'])?.map((edge) => asRecord(edge)?.['node']);
  if (!screensRaw || screensRaw.length === 0) {
    throw new Error('Marvel export fixture is missing screens.');
  }

  const project: MarvelProject = {
    id: stringValue(projectRaw['id'], 'project'),
    name: stringValue(projectRaw['name'] ?? projectRaw['title'], 'Untitled Marvel prototype'),
    shareUrl: optionalString(projectRaw['shareUrl'] ?? projectRaw['share_url'] ?? projectRaw['url']),
    handoffUrl: optionalString(projectRaw['handoffUrl'] ?? projectRaw['handoff_url']),
    device: optionalString(projectRaw['device'] ?? projectRaw['platform']),
    updatedAt: optionalString(projectRaw['updatedAt'] ?? projectRaw['updated_at']),
  };

  const screens = screensRaw.map((screenLike, index) => {
    const screenRaw = asRecord(screenLike) ?? {};
    const handoffRaw = asRecord(screenRaw['handoff']) ?? {};
    const hotspotsRaw = asArray(screenRaw['hotspots']) ?? asArray(screenRaw['links']) ?? [];
    return {
      id: stringValue(screenRaw['id'], `screen-${index + 1}`),
      name: stringValue(screenRaw['name'] ?? screenRaw['title'], `Screen ${index + 1}`),
      path: optionalString(screenRaw['path'] ?? screenRaw['slug']),
      width: optionalNumber(screenRaw['width']),
      height: optionalNumber(screenRaw['height']),
      background: optionalString(screenRaw['background'] ?? screenRaw['backgroundColor']),
      imageUrl: optionalString(screenRaw['imageUrl'] ?? screenRaw['image_url'] ?? screenRaw['thumbnailUrl']),
      htmlUrl: optionalString(screenRaw['htmlUrl'] ?? screenRaw['html_url']),
      text: normalizeText(screenRaw['text'] ?? screenRaw['texts'] ?? screenRaw['copy']),
      hotspots: hotspotsRaw.map(normalizeHotspot),
      handoff: {
        colors: normalizeText(handoffRaw['colors'] ?? screenRaw['colors']),
        fonts: normalizeText(handoffRaw['fonts'] ?? screenRaw['fonts']),
        assetFormats: normalizeText(handoffRaw['assetFormats'] ?? handoffRaw['asset_formats']),
      },
    } satisfies MarvelScreen;
  });

  return { project, screens };
}

export async function materializeMarvelScanTarget(
  marvelExport: MarvelExport,
  outputPath: string,
): Promise<string> {
  const path = resolve(outputPath);
  await mkdir(resolve(path, '..'), { recursive: true });
  await writeFile(path, renderScanTarget(marvelExport), 'utf8');
  return path;
}

export function buildAriadaCliArgs(targetUrl: string, config: MarvelAriadaConfig): string[] {
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

export async function runMarvelScan(
  config: MarvelAriadaConfig,
  options: RunMarvelScanOptions = {},
): Promise<MarvelScanResult> {
  const mergedConfig = { ...config, apiToken: config.apiToken ?? process.env['MARVEL_API_TOKEN'] };
  const errors = validateConfig(mergedConfig);
  if (errors.length > 0) throw new Error(errors.join('\n'));

  const cwd = resolve(options.cwd ?? process.cwd());
  const command = options.cliCommand ?? process.env['ARIADA_CLI'] ?? 'ariada';
  const runner = options.runner ?? spawnCli;
  let closeServer: (() => Promise<void>) | undefined;
  let targetUrl = mergedConfig.targetUrl ?? mergedConfig.shareUrl;
  let scanTargetPath: string | undefined;

  try {
    if (!targetUrl) {
      const marvelExport = await loadMarvelExport(mergedConfig, { cwd, fetchImpl: options.fetchImpl });
      scanTargetPath = await materializeMarvelScanTarget(
        marvelExport,
        resolve(cwd, mergedConfig.workDir ?? './scan-evidence', 'marvel-scan-target.html'),
      );
      const served = await serveStatic(resolve(scanTargetPath, '..'));
      closeServer = served.close;
      targetUrl = new URL('/marvel-scan-target.html', served.baseUrl).toString();
    }

    const args = buildAriadaCliArgs(targetUrl, mergedConfig);
    const result = await runner({ command, args, cwd });
    return {
      ...result,
      commandLine: formatCommand(command, args),
      targetUrl,
      ...(scanTargetPath ? { scanTargetPath } : {}),
    };
  } finally {
    await closeServer?.();
  }
}

function renderScanTarget(marvelExport: MarvelExport): string {
  const { project, screens } = marvelExport;
  const screenCards = screens.map((screen, index) => renderScreen(screen, index)).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(project.name)} - Marvel Ariada scan target</title>
  <style>
    :root { font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #eef2f4; color: #17232e; }
    body { margin: 0; }
    main { max-width: 1120px; margin: 0 auto; padding: 32px 20px 44px; }
    header {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      align-items: end;
      border-bottom: 1px solid #cbd5dc;
      padding-bottom: 18px;
    }
    h1 { margin: 0 0 8px; font-size: 28px; line-height: 1.15; }
    p { margin: 0; line-height: 1.5; }
    .status { border: 1px solid #9fb0bd; border-radius: 8px; padding: 10px 12px; background: #fff; min-width: 220px; }
    .screens { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; margin-top: 24px; }
    article { background: #fff; border: 1px solid #cad4dc; border-radius: 8px; overflow: hidden; }
    .phone {
      aspect-ratio: 390 / 844;
      margin: 14px;
      border-radius: 22px;
      border: 8px solid #1b2630;
      overflow: hidden;
      background: var(--screen-bg);
      position: relative;
    }
    .phone h2 { margin: 36px 22px 8px; font-size: 25px; line-height: 1.12; color: var(--screen-fg); }
    .phone p { margin: 0 22px; color: var(--screen-muted); }
    .button {
      position: absolute;
      left: 32px;
      right: 32px;
      bottom: 42px;
      display: block;
      padding: 14px 18px;
      text-align: center;
      border-radius: 8px;
      background: var(--accent);
      color: var(--button-fg);
      font-weight: 700;
      text-decoration: none;
    }
    .meta { border-top: 1px solid #dbe3e8; padding: 12px 14px 14px; font-size: 14px; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    .chips span { border: 1px solid #bac8d0; border-radius: 999px; padding: 3px 8px; background: #f8fafb; }
    @media (max-width: 860px) { header, .screens { grid-template-columns: 1fr; display: grid; } }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>${escapeHtml(project.name)}</h1>
        <p>Marvel prototype handoff scan target generated from available API/export metadata.</p>
      </div>
      <div class="status" aria-label="Marvel export metadata">
        <strong>Project:</strong> ${escapeHtml(project.id)}<br>
        <strong>Device:</strong> ${escapeHtml(project.device ?? 'unknown')}<br>
        <strong>Screens:</strong> ${screens.length}
      </div>
    </header>
    <section class="screens" aria-label="Prototype screens">
${screenCards}
    </section>
  </main>
</body>
</html>
`;
}

function renderScreen(screen: MarvelScreen, index: number): string {
  const title = screen.text[0] ?? screen.name;
  const description = screen.text.slice(1, -1).join(' ') || `${screen.name} handoff data`;
  const cta = screen.text.at(-1) ?? 'Open screen';
  const colors = screen.handoff?.colors ?? [];
  const fonts = screen.handoff?.fonts ?? [];
  const bg = screen.background ?? colors[0] ?? '#ffffff';
  const dark = index === 2 || /^#0|^#1|^#2/iu.test(bg);
  const screenFg = dark ? '#f5f8f7' : '#17232e';
  const muted = dark ? '#c7d0d8' : '#5e6670';
  const accent = colors.find((color) => ![bg, screenFg].includes(color)) ?? (dark ? '#f26b5e' : '#0b7468');
  const buttonFg = dark ? '#101820' : '#ffffff';
  const chips = [...colors, ...fonts].slice(0, 5).map((item) => `<span>${escapeHtml(item)}</span>`).join('');
  const style = [
    `--screen-bg:${escapeAttribute(bg)}`,
    `--screen-fg:${screenFg}`,
    `--screen-muted:${muted}`,
    `--accent:${escapeAttribute(accent)}`,
    `--button-fg:${buttonFg}`,
  ].join(';');
  return `      <article id="${escapeAttribute(screen.id)}">
        <div class="phone" style="${style}">
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(description)}</p>
          <a class="button" href="#${escapeAttribute(screen.hotspots[0]?.targetScreenId ?? screen.id)}">${escapeHtml(cta)}</a>
        </div>
        <div class="meta">
          <strong>${escapeHtml(screen.name)}</strong>
          <div>${screen.width ?? 390} x ${screen.height ?? 844} · ${screen.hotspots.length} hotspot(s)</div>
          <div class="chips">${chips}</div>
        </div>
      </article>`;
}

function normalizeHotspot(input: unknown): MarvelHotspot {
  const raw = asRecord(input) ?? {};
  return {
    label: stringValue(raw['label'] ?? raw['name'] ?? raw['title'], 'Untitled hotspot'),
    targetScreenId: optionalString(raw['targetScreenId'] ?? raw['target_screen_id'] ?? raw['target']),
    x: optionalNumber(raw['x']),
    y: optionalNumber(raw['y']),
    width: optionalNumber(raw['width']),
    height: optionalNumber(raw['height']),
  };
}

function normalizeText(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.map((value) => String(value).trim()).filter(Boolean);
  }
  if (typeof input === 'string' && input.trim()) return [input.trim()];
  return [];
}

function asRecord(input: unknown): Record<string, unknown> | undefined {
  return input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : undefined;
}

function asArray(input: unknown): unknown[] | undefined {
  return Array.isArray(input) ? input : undefined;
}

function stringValue(input: unknown, fallback: string): string {
  return typeof input === 'string' && input.trim() ? input.trim() : fallback;
}

function optionalString(input: unknown): string | undefined {
  return typeof input === 'string' && input.trim() ? input.trim() : undefined;
}

function optionalNumber(input: unknown): number | undefined {
  return typeof input === 'number' && Number.isFinite(input) ? input : undefined;
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttribute(input: string): string {
  return escapeHtml(input).replaceAll('`', '&#96;');
}

function marvelProjectQuery(): string {
  return `query AriadaMarvelProject($projectId: ID!) {
  project(id: $projectId) {
    id
    name
    shareUrl
    handoffUrl
    device
    updatedAt
    screens {
      nodes {
        id
        name
        width
        height
        background
        imageUrl
        htmlUrl
        text
        colors
        fonts
        hotspots { label targetScreenId x y width height }
      }
    }
  }
}`;
}

async function serveStatic(root: string): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const safeRoot = resolve(root);
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const requested = url.pathname === '/' ? '/marvel-scan-target.html' : decodeURIComponent(url.pathname);
    const filePath = resolve(safeRoot, `.${requested}`);
    if (!isInside(safeRoot, filePath) || !(await fileExists(filePath))) {
      respond(res, 404, 'text/plain; charset=utf-8', 'not found');
      return;
    }
    res.writeHead(200, { 'content-type': contentType(filePath) });
    createReadStream(filePath).pipe(res);
  });
  await new Promise<void>((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolveListen());
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Unable to bind local Marvel scan server.');
  return {
    baseUrl: `http://127.0.0.1:${address.port}/`,
    close: () => new Promise((resolveClose, reject) => server.close((err) => (err ? reject(err) : resolveClose()))),
  };
}

async function spawnCli(invocation: RunnerInvocation): Promise<RunnerResult> {
  return new Promise((resolveResult) => {
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
    child.on('error', (err) => {
      resolveResult({ exitCode: 3, stdout, stderr: `${stderr}${err.message}\n` });
    });
    child.on('close', (code) => {
      resolveResult({ exitCode: code ?? 3, stdout, stderr });
    });
  });
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function isInside(root: string, child: string): boolean {
  const rel = relative(root, child);
  return rel === '' || (!rel.startsWith('..') && !rel.includes(`..${sep}`));
}

function contentType(path: string): string {
  switch (extname(path).toLowerCase()) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
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

function respond(res: ServerResponse, status: number, type: string, body: string): void {
  res.writeHead(status, { 'content-type': type });
  res.end(body);
}

function formatCommand(command: string, args: string[]): string {
  return [command, ...args].map(shellQuote).join(' ');
}

function shellQuote(value: string): string {
  return /^[\w./:@=-]+$/u.test(value) ? value : `'${value.replaceAll("'", "'\\''")}'`;
}
