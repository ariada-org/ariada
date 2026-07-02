#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderZeplinScanTarget } from './adapter.js';
import type { ZeplinSnapshot } from './types.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const REPO_ROOT = resolve(ROOT, '..', '..');

function value(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function load(path: string): Promise<ZeplinSnapshot> {
  return JSON.parse(await readFile(path, 'utf8')) as ZeplinSnapshot;
}

async function serve(html: string): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(html);
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Failed to bind fixture server');
  return { url: `http://127.0.0.1:${address.port}/`, close: () => new Promise((done, reject) => server.close((error) => (error ? reject(error) : done()))) };
}

async function runScan(url: string, outputDir: string): Promise<number> {
  await rm(outputDir, { force: true, recursive: true });
  const cli =
    [resolve(REPO_ROOT, 'packages', 'ariada-cli', 'dist', 'bin.js'), '/Users/pedro/adopta/packages/ariada-cli/dist/bin.js'].find((candidate) => existsSync(candidate)) ??
    resolve(REPO_ROOT, 'packages', 'ariada-cli', 'dist', 'bin.js');
  return new Promise((done) => {
    const child = spawn(process.execPath, [cli, 'scan', url, '--format', 'both', '--output-dir', outputDir], { stdio: 'inherit' });
    child.on('close', (code) => done(code ?? 3));
  });
}

const [command, snapshotArg, ...rest] = process.argv.slice(2);
if (!command || !snapshotArg) {
  console.error('Usage: ariada-zeplin <export-fixture|scan-fixture> <snapshot.json> [--out <path>] [--output-dir <path>]');
  process.exit(2);
}
const snapshot = await load(resolve(snapshotArg));
if (command === 'export-fixture') {
  const out = resolve(value(rest, '--out') ?? 'zeplin-ariada-fixture.html');
  await writeFile(out, renderZeplinScanTarget(snapshot), 'utf8');
  console.log(`Wrote ${out}`);
} else if (command === 'scan-fixture') {
  const server = await serve(renderZeplinScanTarget(snapshot));
  try {
    process.exitCode = await runScan(server.url, resolve(value(rest, '--output-dir') ?? 'ariada-output'));
  } finally {
    await server.close();
  }
} else {
  console.error(`Unknown command: ${command}`);
  process.exit(2);
}
