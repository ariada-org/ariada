// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/* eslint-disable jsdoc/require-jsdoc */

import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { createServer, type ServerResponse } from 'node:http';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export type AriadaSeverity = 'minor' | 'moderate' | 'serious' | 'critical';
export type AriadaCliFormat = 'human' | 'json' | 'both';

export interface VuePressAppLike {
  dir?: {
    source?: unknown;
    dest?: unknown;
  };
  options?: {
    source?: unknown;
    dest?: unknown;
  };
}

export interface VuePressPluginLike {
  name: string;
  onGenerated(app: VuePressAppLike): Promise<void>;
}

export interface AriadaCommand {
  command: string;
  args: string[];
  cwd: string;
  url: string;
}

export interface AriadaCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export type AriadaCommandRunner = (command: AriadaCommand) => Promise<AriadaCommandResult>;

export interface AriadaVuePressOptions {
  outputDir?: string;
  reportDir?: string;
  domains?: string[];
  format?: AriadaCliFormat;
  severityThreshold?: AriadaSeverity;
  timeoutMs?: number;
  failOnViolation?: boolean;
  cliCommand?: string;
  cliPath?: string;
  host?: string;
  port?: number;
  runner?: AriadaCommandRunner;
}

export interface AriadaVuePressScanInput {
  projectRoot?: string;
  outputDir: string;
}

export interface AriadaVuePressScanResult {
  outputDir: string;
  reportDir: string;
  url: string;
  command: string;
  args: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
}

export function ariadaVuePress(options: AriadaVuePressOptions = {}): VuePressPluginLike {
  return {
    name: 'vuepress-plugin-ariada',
    async onGenerated(app) {
      const outputDir = resolveVuePressOutputDir(app, options);
      const projectRoot = stringValue(app.dir?.source) ?? stringValue(app.options?.source);
      await runAriadaVuePressScan(
        projectRoot ? { projectRoot, outputDir } : { outputDir },
        options,
      );
    },
  };
}

export default ariadaVuePress;

export async function runAriadaVuePressScan(
  input: AriadaVuePressScanInput,
  options: AriadaVuePressOptions = {},
): Promise<AriadaVuePressScanResult> {
  const outputDir = resolve(input.outputDir);
  const reportDir = resolve(input.projectRoot ?? process.cwd(), options.reportDir ?? 'ariada-vuepress-report');
  await mkdir(reportDir, { recursive: true });

  const server = await serveStaticDirectory(outputDir, options);
  try {
    const command = buildAriadaCommand(server.url, reportDir, options);
    const runner = options.runner ?? spawnAriadaCommand;
    const result = await runner(command);
    await writeCommandEvidence(reportDir, command, result);

    if (result.exitCode > 1 || (result.exitCode === 1 && (options.failOnViolation ?? true))) {
      throw new Error(`Ariada VuePress gate failed with exit code ${result.exitCode}.`);
    }

    return {
      outputDir,
      reportDir,
      url: server.url,
      command: command.command,
      args: command.args,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } finally {
    await server.close();
  }
}

export function resolveVuePressOutputDir(
  app: VuePressAppLike,
  options: Pick<AriadaVuePressOptions, 'outputDir'> = {},
): string {
  if (options.outputDir) return resolve(options.outputDir);
  const dirDest = stringValue(app.dir?.dest);
  if (dirDest) return resolve(dirDest);
  const optionDest = stringValue(app.options?.dest);
  if (optionDest) return resolve(optionDest);
  const source = stringValue(app.dir?.source) ?? stringValue(app.options?.source) ?? process.cwd();
  return resolve(source, '.vuepress', 'dist');
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function buildAriadaCommand(
  url: string,
  reportDir: string,
  options: AriadaVuePressOptions,
): AriadaCommand {
  const domains = options.domains ?? ['accessibility'];
  const scanArgs = [
    'scan',
    url,
    '--domains',
    domains.join(','),
    '--format',
    options.format ?? 'both',
    '--output-dir',
    join(reportDir, 'ariada-output'),
    '--severity-threshold',
    options.severityThreshold ?? 'moderate',
    '--timeout-ms',
    String(options.timeoutMs ?? 30_000),
  ];

  if (options.cliPath) {
    return {
      command: process.execPath,
      args: [options.cliPath, ...scanArgs],
      cwd: reportDir,
      url,
    };
  }

  return {
    command: options.cliCommand ?? 'ariada',
    args: scanArgs,
    cwd: reportDir,
    url,
  };
}

async function writeCommandEvidence(
  reportDir: string,
  command: AriadaCommand,
  result: AriadaCommandResult,
): Promise<void> {
  const commandLine = [command.command, ...command.args].join(' ');
  const log = [
    `$ ${commandLine}`,
    '',
    '[stdout]',
    result.stdout.trimEnd(),
    '',
    '[stderr]',
    result.stderr.trimEnd(),
    '',
  ].join('\n');
  await mkdir(dirname(join(reportDir, 'command.log')), { recursive: true });
  await writeFile(join(reportDir, 'command.log'), log, 'utf8');
  await writeFile(join(reportDir, 'command.exit'), `${result.exitCode}\n`, 'utf8');
}

async function spawnAriadaCommand(command: AriadaCommand): Promise<AriadaCommandResult> {
  return await new Promise((resolvePromise, reject) => {
    const child = spawn(command.command, command.args, {
      cwd: command.cwd,
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
    child.on('error', reject);
    child.on('close', (code) => {
      resolvePromise({ exitCode: code ?? 1, stdout, stderr });
    });
  });
}

async function serveStaticDirectory(
  rootDir: string,
  options: Pick<AriadaVuePressOptions, 'host' | 'port'>,
): Promise<{ url: string; close: () => Promise<void> }> {
  const root = resolve(rootDir);
  const server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
      const filePath = resolveSafePath(root, requestUrl.pathname);
      await sendFile(filePath, response);
    } catch (error) {
      response.statusCode = error instanceof NotFoundError ? 404 : 500;
      response.end(error instanceof Error ? error.message : 'Server error');
    }
  });

  const host = options.host ?? '127.0.0.1';
  const port = options.port ?? 0;
  await new Promise<void>((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolveListen());
  });

  const address = server.address();
  if (typeof address !== 'object' || address === null) {
    throw new Error('Could not determine VuePress preview server address.');
  }

  return {
    url: `http://${host}:${address.port}/`,
    close: async () => {
      await new Promise<void>((resolveClose, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolveClose();
        });
      });
    },
  };
}

function resolveSafePath(root: string, pathname: string): string {
  const decoded = decodeURIComponent(pathname);
  const normalizedPath = normalize(decoded).replace(/^[/\\]+/, '');
  const candidate = resolve(root, normalizedPath);
  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) {
    throw new NotFoundError('Path escapes VuePress output directory.');
  }
  return candidate;
}

async function sendFile(candidate: string, response: ServerResponse): Promise<void> {
  let filePath = candidate;
  const metadata = await stat(filePath).catch(() => undefined);
  if (!metadata) throw new NotFoundError(`Missing file: ${pathToFileURL(filePath).href}`);
  if (metadata.isDirectory()) {
    filePath = join(filePath, 'index.html');
  }
  const fileMetadata = await stat(filePath).catch(() => undefined);
  if (!fileMetadata?.isFile()) throw new NotFoundError(`Missing file: ${pathToFileURL(filePath).href}`);

  response.setHeader('content-type', contentType(filePath));
  await new Promise<void>((resolvePipe, reject) => {
    createReadStream(filePath)
      .on('error', reject)
      .on('end', resolvePipe)
      .pipe(response);
  });
}

function contentType(filePath: string): string {
  const extension = extname(filePath);
  if (extension === '.html') return 'text/html; charset=utf-8';
  if (extension === '.css') return 'text/css; charset=utf-8';
  if (extension === '.js') return 'text/javascript; charset=utf-8';
  if (extension === '.svg') return 'image/svg+xml';
  if (extension === '.png') return 'image/png';
  return 'application/octet-stream';
}

class NotFoundError extends Error {}
