// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/* eslint-disable jsdoc/require-jsdoc */

import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { dirname, resolve } from 'node:path';

import { exportPenpotSelection, type ExportedPenpotSurface, type PenpotShape } from './shape-adapter.js';

export interface AriadaExportScanOptions {
  shapes: readonly PenpotShape[];
  outputDir: string;
  cliPath?: string;
  domains?: string;
  severityThreshold?: 'minor' | 'moderate' | 'serious' | 'critical';
}

export interface AriadaExportScanResult {
  surface: ExportedPenpotSurface;
  htmlPath: string;
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function scanPenpotExport(options: AriadaExportScanOptions): Promise<AriadaExportScanResult> {
  const outputDir = resolve(options.outputDir);
  const surface = exportPenpotSelection(options.shapes);
  const htmlPath = resolve(outputDir, 'penpot-export.html');
  await mkdir(dirname(htmlPath), { recursive: true });
  await writeFile(htmlPath, surface.html, 'utf8');

  const server = await serveHtml(surface.html);
  try {
    const url = `http://127.0.0.1:${server.port}/penpot-export.html`;
    const cliPath = resolve(options.cliPath ?? '../../packages/ariada-cli/dist/bin.js');
    const args = [
      cliPath,
      'scan',
      url,
      '--domains',
      options.domains ?? 'accessibility',
      '--format',
      'both',
      '--output-dir',
      resolve(outputDir, 'ariada-output'),
      '--severity-threshold',
      options.severityThreshold ?? 'moderate',
    ];
    const child = await runNode(args);
    return {
      surface,
      htmlPath,
      command: `node ${args.map(shellToken).join(' ')}`,
      exitCode: child.exitCode,
      stdout: child.stdout,
      stderr: child.stderr,
    };
  } finally {
    await server.close();
  }
}

interface ServedHtml {
  port: number;
  close(): Promise<void>;
}

function serveHtml(html: string): Promise<ServedHtml> {
  const server = createServer((request, response) => {
    if (request.url === '/penpot-export.html' || request.url === '/') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(html);
      return;
    }
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  });
  return new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Unable to allocate local evidence server port'));
        return;
      }
      resolvePromise({
        port: address.port,
        close: () => closeServer(server),
      });
    });
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolvePromise();
    });
  });
}

interface ChildResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

function runNode(args: readonly string[]): Promise<ChildResult> {
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.on('close', (code) => {
      resolvePromise({
        exitCode: code ?? 1,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      });
    });
  });
}

function shellToken(value: string): string {
  return /^[\w./:@-]+$/.test(value) ? value : JSON.stringify(value);
}
