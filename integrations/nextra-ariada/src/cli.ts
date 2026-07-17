#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/* eslint-disable jsdoc/require-jsdoc */

import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { access, mkdir, stat, writeFile } from 'node:fs/promises';
import { createServer, type Server, type ServerResponse } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildAriadaCliArgs, type AriadaNextraOptions, type SeverityThreshold } from './index.js';

export interface ScanOptions extends AriadaNextraOptions {
  projectRoot?: string;
  cli?: string;
  port?: number;
  url?: string;
  timeoutMs?: number;
  noFail?: boolean;
  logDir?: string;
}

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface ScanResult extends CommandResult {
  command: string;
  targetUrl: string;
  servedExport: boolean;
  finalExitCode: number;
}

export type CommandRunner = (command: string, args: readonly string[]) => Promise<CommandResult>;

const CONTENT_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
};

export async function scanNextraExport(
  options: ScanOptions = {},
  runner: CommandRunner = runCommand,
): Promise<ScanResult> {
  const projectRoot = resolve(options.projectRoot ?? process.cwd());
  const exportDir = resolve(projectRoot, options.exportDir ?? 'out');
  const outputDir = resolve(projectRoot, options.outputDir ?? 'ariada-output');
  const logDir = resolve(projectRoot, options.logDir ?? outputDir);

  let server: StaticServer | undefined;
  const targetUrl = options.url ?? (await startStaticServer(exportDir, options.port)).url;
  try {
    if (!options.url) {
      server = getActiveServer(targetUrl);
    }
    const cliOptions: AriadaNextraOptions = { outputDir };
    if (options.domains) cliOptions.domains = options.domains;
    if (options.failOn !== undefined) cliOptions.failOn = options.failOn;
    const args = buildAriadaCliArgs(targetUrl, cliOptions);
    if (options.timeoutMs) {
      args.push('--timeout-ms', String(options.timeoutMs));
    }
    const cli = options.cli ?? process.env['ARIADA_CLI'] ?? 'ariada';
    const result = await runner(cli, args);
    const command = [cli, ...args].join(' ');
    const finalExitCode = options.noFail && result.exitCode === 1 ? 0 : result.exitCode;
    await writeCommandEvidence(logDir, command, result, finalExitCode);
    return { ...result, command, targetUrl, servedExport: !options.url, finalExitCode };
  } finally {
    await server?.close();
  }
}

export async function runCli(argv: readonly string[]): Promise<number> {
  const [command, ...rest] = argv;
  if (command !== 'scan') {
    process.stderr.write('Usage: nextra-ariada scan [export-dir] [--cli ariada] [--output-dir ariada-output]\n');
    return 2;
  }

  const options = parseScanArgs(rest);
  try {
    const result = await scanNextraExport(options);
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    return result.finalExitCode;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 3;
  }
}

function parseScanArgs(argv: readonly string[]): ScanOptions {
  const options: ScanOptions = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value) continue;
    if (value === '--cli') options.cli = takeValue(argv, ++index, value);
    else if (value === '--domains') options.domains = takeValue(argv, ++index, value).split(',');
    else if (value === '--fail-on') options.failOn = takeValue(argv, ++index, value) as SeverityThreshold;
    else if (value === '--no-fail') options.noFail = true;
    else if (value === '--output-dir') options.outputDir = takeValue(argv, ++index, value);
    else if (value === '--port') options.port = Number.parseInt(takeValue(argv, ++index, value), 10);
    else if (value === '--timeout-ms') options.timeoutMs = Number.parseInt(takeValue(argv, ++index, value), 10);
    else if (value === '--url') options.url = takeValue(argv, ++index, value);
    else if (value.startsWith('--')) throw new Error(`Unknown option: ${value}`);
    else options.exportDir = value;
  }
  return options;
}

function takeValue(argv: readonly string[], index: number, flag: string): string {
  const value = argv[index];
  if (!value) throw new Error(`Missing value for ${flag}`);
  return value;
}

async function writeCommandEvidence(
  outputDir: string,
  command: string,
  result: CommandResult,
  finalExitCode: number,
): Promise<void> {
  await mkdir(outputDir, { recursive: true });
  await writeFile(
    join(outputDir, 'command.log'),
    `$ ${command}\n\n[stdout]\n${result.stdout}\n\n[stderr]\n${result.stderr}\n`,
    'utf8',
  );
  await writeFile(join(outputDir, 'command.exit'), `${finalExitCode}\n`, 'utf8');
}

function runCommand(command: string, args: readonly string[]): Promise<CommandResult> {
  return new Promise((resolveResult, reject) => {
    const child = spawn(command, [...args], { stdio: ['ignore', 'pipe', 'pipe'] });
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
      resolveResult({ exitCode: code ?? 3, stdout, stderr });
    });
  });
}

interface StaticServer {
  url: string;
  close: () => Promise<void>;
}

const activeServers = new Map<string, StaticServer>();

async function startStaticServer(rootDir: string, port = 0): Promise<StaticServer> {
  await assertDirectory(rootDir);
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
    const decoded = decodeURIComponent(path);
    const relativePath = decoded === '/' ? 'index.html' : decoded.slice(1);
    const candidate = resolve(rootDir, relativePath);
    if (!candidate.startsWith(`${rootDir}${sep}`) && candidate !== rootDir) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }
    void serveFile(candidate, response);
  });
  await new Promise<void>((resolveListen) => server.listen(port, '127.0.0.1', resolveListen));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not bind static export server');
  const handle = {
    url: `http://127.0.0.1:${address.port}/`,
    close: () => closeServer(server),
  };
  activeServers.set(handle.url, handle);
  return handle;
}

function getActiveServer(url: string): StaticServer | undefined {
  return activeServers.get(url);
}

async function assertDirectory(path: string): Promise<void> {
  const info = await stat(path);
  if (!info.isDirectory()) throw new Error(`Nextra export path is not a directory: ${path}`);
  await access(join(path, 'index.html'));
}

async function serveFile(path: string, response: ServerResponse): Promise<void> {
  try {
    const info = await stat(path);
    const filePath = info.isDirectory() ? join(path, 'index.html') : path;
    await access(filePath);
    response.writeHead(200, { 'content-type': CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream' });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolveClose, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolveClose();
    });
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const code = await runCli(process.argv.slice(2));
  process.exit(code);
}
