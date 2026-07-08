#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { createReadStream, existsSync, readdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

const severityRank = new Map([
  ['minor', 1],
  ['moderate', 2],
  ['serious', 3],
  ['critical', 4],
]);

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
]);

export function parseArgs(argv) {
  const options = {
    targetDir: 'public',
    outputDir: 'ariada-output',
    ariadaCommand: 'npx',
    ariadaCommandArgs: ['-y', '@ariada-org/cli'],
    domains: 'accessibility,security,privacy,sustainability,structured-data,ai-readiness',
    browser: 'chromium',
    severityThreshold: 'moderate',
    timeoutMs: 30000,
    allowPrivate: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const value = argv[index + 1];
    if (token === '--target-dir') {
      options.targetDir = requireValue(token, value);
      index += 1;
    } else if (token === '--output-dir') {
      options.outputDir = requireValue(token, value);
      index += 1;
    } else if (token === '--ariada-command') {
      options.ariadaCommand = requireValue(token, value);
      options.ariadaCommandArgs = [];
      index += 1;
    } else if (token === '--domains') {
      options.domains = requireValue(token, value);
      index += 1;
    } else if (token === '--browser') {
      options.browser = requireValue(token, value);
      index += 1;
    } else if (token === '--severity-threshold') {
      options.severityThreshold = requireValue(token, value);
      index += 1;
    } else if (token === '--timeout-ms') {
      options.timeoutMs = Number(requireValue(token, value));
      index += 1;
    } else if (token === '--no-allow-private') {
      options.allowPrivate = false;
    } else if (token === '--help') {
      options.help = true;
    } else {
      throw new Error(`Unknown option: ${token}`);
    }
  }

  return options;
}

export function findEntryHtml(targetDir) {
  const root = resolve(targetDir);
  const preferred = join(root, 'index.html');
  if (existsSync(preferred)) return preferred;

  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) stack.push(path);
      if (entry.isFile() && entry.name.endsWith('.html')) return path;
    }
  }
  throw new Error(`No HTML files found under ${root}. Run hugo before hugo-ariada.`);
}

export function buildAriadaArgs(options, targetUrl) {
  return [
    ...options.ariadaCommandArgs,
    'scan',
    targetUrl,
    '--format',
    'both',
    '--output-dir',
    resolve(options.outputDir),
    '--browser',
    options.browser,
    '--severity-threshold',
    options.severityThreshold,
    '--timeout-ms',
    String(options.timeoutMs),
    '--domains',
    options.domains,
    ...(options.allowPrivate ? ['--allow-private'] : []),
  ];
}

export function countFindings(data, threshold = 'moderate') {
  const min = severityRank.get(threshold) ?? severityRank.get('moderate');
  const severities = [];
  collectSeverities(data, severities);
  return severities.filter((severity) => (severityRank.get(severity) ?? 0) >= min).length;
}

export function readReportSummary(outputDir, threshold = 'moderate') {
  for (const name of ['multi-domain-report.json', 'scan.json']) {
    const path = join(resolve(outputDir), name);
    if (existsSync(path)) {
      const data = JSON.parse(readFileSync(path, 'utf8'));
      return { path, total: countFindings(data, threshold) };
    }
  }
  return { path: null, total: 0 };
}

export async function runScanAgainstBuiltSite(options, runner = spawnRunner) {
  const entry = findEntryHtml(options.targetDir);
  const root = resolve(options.targetDir);
  const server = await serveDirectory(root);
  try {
    const targetUrl = `${server.url}/${relative(root, entry).split(sep).join('/')}`;
    const args = buildAriadaArgs(options, targetUrl);
    const completed = await runner(options.ariadaCommand, args);
    const summary = readReportSummary(options.outputDir, options.severityThreshold);
    return {
      command: [options.ariadaCommand, ...args],
      exitCode: completed.exitCode,
      stdout: completed.stdout,
      stderr: completed.stderr,
      targetUrl,
      reportPath: summary.path,
      totalFindings: summary.total,
      gateFailed: completed.exitCode === 1 || summary.total > 0,
    };
  } finally {
    await server.close();
  }
}

function collectSeverities(value, out) {
  if (Array.isArray(value)) {
    for (const item of value) collectSeverities(item, out);
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (typeof value.severity === 'string') out.push(value.severity.toLowerCase());
  if (typeof value.impact === 'string') out.push(value.impact.toLowerCase());
  for (const child of Object.values(value)) collectSeverities(child, out);
}

function requireValue(token, value) {
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${token}`);
  return value;
}

function spawnRunner(command, args) {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('close', (exitCode) => {
      resolvePromise({ exitCode: exitCode ?? 2, stdout, stderr });
    });
    child.on('error', (error) => {
      resolvePromise({ exitCode: 2, stdout, stderr: String(error.message ?? error) });
    });
  });
}

function serveDirectory(root) {
  const server = createServer((request, response) => {
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
    response.writeHead(200, { 'content-type': contentTypes.get(extname(fullPath)) ?? 'application/octet-stream' });
    createReadStream(fullPath).pipe(response);
  });

  return new Promise((resolvePromise) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolvePromise({
        url: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((closeResolve) => server.close(closeResolve)),
      });
    });
  });
}

function usage() {
  return `Usage: hugo-ariada [options]

Options:
  --target-dir <dir>            Built Hugo output directory, normally public
  --output-dir <dir>            Ariada output directory
  --ariada-command <command>    Scanner executable, default npx -y @ariada-org/cli
  --domains <csv>               Ariada domains to request from the shared CLI
  --browser <name>              Browser passed to Ariada CLI
  --severity-threshold <name>   Finding threshold that fails the gate
  --timeout-ms <number>         Scanner timeout
  --no-allow-private            Do not pass --allow-private to Ariada CLI
`;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(usage());
      process.exit(0);
    }
    const result = await runScanAgainstBuiltSite(options);
    process.stdout.write(JSON.stringify(result, null, 2));
    process.stdout.write('\n');
    process.exit(result.gateFailed ? 1 : result.exitCode);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(2);
  }
}
