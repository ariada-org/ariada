#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  normalize,
  relative,
  resolve,
  sep,
} from 'node:path';
import { pathToFileURL } from 'node:url';

const STATUS_SCHEMA = 'https://ariada.org/schemas/bazel-ariada-status.v1.json';
const SEVERITIES = new Set(['minor', 'moderate', 'serious', 'critical']);
const MAX_CAPTURE_BYTES = 8 * 1024 * 1024;

function argumentError(message) {
  const error = new Error(message);
  error.exitCode = 2;
  return error;
}

function requireValue(argv, index, flag) {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith('--')) {
    throw argumentError(`${flag} requires a value`);
  }
  return value;
}

function actionRoot() {
  const bindir = process.env.BAZEL_BINDIR;
  if (bindir === undefined || isAbsolute(bindir)) return process.cwd();
  const segments = bindir.split(/[\\/]+/).filter(Boolean);
  const candidate = resolve(process.cwd(), ...segments.map(() => '..'));
  return resolve(candidate, bindir) === process.cwd() ? candidate : process.cwd();
}

function resolveActionPath(value) {
  return isAbsolute(value) ? resolve(value) : resolve(actionRoot(), value);
}

export function parseArguments(argv) {
  const values = new Map();
  const domains = [];
  let failOnFindings = false;
  const singleton = new Set([
    '--cli',
    '--input',
    '--result',
    '--status',
    '--label',
    '--entry-path',
    '--browser-cache',
    '--severity-threshold',
    '--timeout-ms',
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === '--fail-on-findings') {
      if (failOnFindings) throw argumentError('Duplicate argument: --fail-on-findings');
      failOnFindings = true;
      continue;
    }
    if (flag === '--domain') {
      domains.push(requireValue(argv, index, flag));
      index += 1;
      continue;
    }
    if (!singleton.has(flag)) throw argumentError(`Unknown argument: ${String(flag)}`);
    if (values.has(flag)) throw argumentError(`Duplicate argument: ${flag}`);
    values.set(flag, requireValue(argv, index, flag));
    index += 1;
  }

  for (const flag of ['--cli', '--input', '--result', '--status']) {
    if (!values.has(flag)) throw argumentError(`Missing required argument: ${flag}`);
  }
  const threshold = values.get('--severity-threshold') ?? 'moderate';
  if (!SEVERITIES.has(threshold)) throw argumentError(`Invalid severity threshold: ${threshold}`);
  const timeoutRaw = values.get('--timeout-ms') ?? '30000';
  if (!/^\d+$/.test(timeoutRaw)) throw argumentError('--timeout-ms must be an integer');
  const timeoutMs = Number(timeoutRaw);
  if (timeoutMs < 1 || timeoutMs > 300000) {
    throw argumentError('--timeout-ms must be between 1 and 300000');
  }
  const entryPath = values.get('--entry-path');
  if (entryPath !== undefined) validateEntryPath(entryPath);
  return {
    cli: resolveActionPath(values.get('--cli')),
    input: resolveActionPath(values.get('--input')),
    result: resolveActionPath(values.get('--result')),
    status: resolveActionPath(values.get('--status')),
    label: values.get('--label') ?? 'ariada_scan',
    entryPath,
    browserCache: values.get('--browser-cache'),
    severityThreshold: threshold,
    timeoutMs,
    domains: domains.length > 0 ? domains : ['accessibility'],
    failOnFindings,
  };
}

function validateEntryPath(entryPath) {
  if (entryPath.includes('\0') || isAbsolute(entryPath)) {
    throw argumentError('--entry-path must be a relative path');
  }
  const normalized = normalize(entryPath);
  if (normalized === '..' || normalized.startsWith(`..${sep}`)) {
    throw argumentError('--entry-path cannot escape the declared input');
  }
}

async function resolveSite(input, entryPath) {
  const canonicalInput = await realpath(input);
  const inputStat = await stat(canonicalInput);
  if (inputStat.isDirectory()) {
    const entry = entryPath ?? 'index.html';
    validateEntryPath(entry);
    return { root: canonicalInput, entry: entry.split(sep).join('/') };
  }
  if (!inputStat.isFile()) throw argumentError('--input must be a file or directory');
  if (entryPath !== undefined) {
    throw argumentError('--entry-path is only valid when --input is a directory');
  }
  return { root: dirname(canonicalInput), entry: basename(canonicalInput) };
}

function isWithin(root, candidate) {
  const nested = relative(root, candidate);
  return nested === '' || (!nested.startsWith('..') && !isAbsolute(nested));
}

function contentType(path) {
  return new Map([
    ['.css', 'text/css; charset=utf-8'],
    ['.gif', 'image/gif'],
    ['.html', 'text/html; charset=utf-8'],
    ['.ico', 'image/x-icon'],
    ['.jpeg', 'image/jpeg'],
    ['.jpg', 'image/jpeg'],
    ['.js', 'text/javascript; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'],
    ['.png', 'image/png'],
    ['.svg', 'image/svg+xml'],
    ['.webp', 'image/webp'],
  ]).get(extname(path).toLowerCase()) ?? 'application/octet-stream';
}

async function serveFile(root, requestPath, response, method) {
  let decoded;
  try {
    decoded = decodeURIComponent(requestPath);
  } catch {
    response.writeHead(400).end('Bad request');
    return;
  }
  const relativePath = decoded.replace(/^\/+/, '') || 'index.html';
  const candidate = resolve(root, relativePath);
  if (!isWithin(root, candidate)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  let canonical;
  try {
    canonical = await realpath(candidate);
    if (!isWithin(root, canonical)) throw new Error('outside root');
    const info = await lstat(canonical);
    if (!info.isFile()) throw new Error('not a file');
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Length': String(info.size),
      'Content-Security-Policy': "default-src 'self' data:; connect-src 'none'; object-src 'none'",
      'Content-Type': contentType(canonical),
      'X-Content-Type-Options': 'nosniff',
    });
    if (method === 'HEAD') response.end();
    else createReadStream(canonical).pipe(response);
  } catch {
    response.writeHead(404).end('Not found');
  }
}

async function startServer(site) {
  const server = createServer((request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end('Method not allowed');
      return;
    }
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    void serveFile(site.root, url.pathname, response, request.method);
  });
  await new Promise((accept, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', accept);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('Failed to bind loopback server');
  return {
    server,
    url: `http://127.0.0.1:${address.port}/${site.entry.split('/').map(encodeURIComponent).join('/')}`,
  };
}

function capture(stream, label) {
  return new Promise((resolveCapture, reject) => {
    let total = 0;
    const chunks = [];
    stream.on('data', (chunk) => {
      total += chunk.length;
      if (total > MAX_CAPTURE_BYTES) {
        reject(new Error(`${label} exceeded ${MAX_CAPTURE_BYTES} bytes`));
        return;
      }
      chunks.push(chunk);
    });
    stream.on('error', reject);
    stream.on('end', () => resolveCapture(Buffer.concat(chunks).toString('utf8')));
  });
}

async function invokeCli(options, url, outputDirectory, workingDirectory) {
  const args = [
    options.cli,
    'scan',
    url,
    '--domains',
    options.domains.join(','),
    '--output-dir',
    outputDirectory,
    '--format',
    'json',
    '--severity-threshold',
    options.severityThreshold,
    '--timeout-ms',
    String(options.timeoutMs),
    '--allow-private',
  ];
  const env = {
    ...process.env,
    HOME: workingDirectory,
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1',
    TMPDIR: workingDirectory,
  };
  for (const key of [
    'ARIADA_EVENT_BUS_TOKEN',
    'ARIADA_EVENT_BUS_URL',
    'ARIADA_EVENT_LOG',
    'ARIADA_TENANT_ID',
  ]) delete env[key];
  if (options.browserCache !== undefined) {
    env.PLAYWRIGHT_BROWSERS_PATH = resolveActionPath(options.browserCache);
  }
  const child = spawn(process.execPath, args, {
    cwd: workingDirectory,
    env,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stdoutPromise = capture(child.stdout, 'CLI stdout');
  const stderrPromise = capture(child.stderr, 'CLI stderr');
  const exitCode = await new Promise((accept, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => {
      if (signal !== null) reject(new Error(`Ariada CLI terminated by ${signal}`));
      else accept(code ?? 3);
    });
  });
  return {
    exitCode,
    stdout: await stdoutPromise,
    stderr: await stderrPromise,
  };
}

function summarizeReport(report) {
  let findings = 0;
  const rules = new Set();
  for (const site of Array.isArray(report.sites) ? report.sites : []) {
    for (const domain of Array.isArray(report.domains) ? report.domains : []) {
      const entries = report.grid?.[site]?.[domain];
      if (!Array.isArray(entries)) continue;
      findings += entries.length;
      for (const finding of entries) {
        if (typeof finding?.ruleId === 'string') rules.add(finding.ruleId);
      }
    }
  }
  return { findings, rules: [...rules].sort() };
}

async function atomicWrite(path, content) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  await writeFile(temporary, content);
  await rename(temporary, path);
}

async function writeFailureArtifacts(options, exitCode, message) {
  const status = {
    $schema: STATUS_SCHEMA,
    schemaVersion: 1,
    label: options?.label ?? 'ariada_scan',
    semanticExitCode: exitCode,
    actionExitCode: exitCode,
    findings: 0,
    rules: [],
    severityThreshold: options?.severityThreshold ?? 'moderate',
    domains: options?.domains ?? ['accessibility'],
    error: message,
  };
  if (options?.status !== undefined) {
    await atomicWrite(options.status, `${JSON.stringify(status, null, 2)}\n`);
  }
  if (options?.result !== undefined) {
    await atomicWrite(options.result, `${JSON.stringify({ error: message, exitCode }, null, 2)}\n`);
  }
}

export async function run(options) {
  const site = await resolveSite(options.input, options.entryPath);
  const workingDirectory = await mkdtemp(join(tmpdir(), 'ariada-bazel-'));
  const cliOutput = join(workingDirectory, 'cli-output');
  let server;
  try {
    await mkdir(cliOutput, { recursive: true });
    const listening = await startServer(site);
    server = listening.server;
    const cli = await invokeCli(options, listening.url, cliOutput, workingDirectory);
    if (cli.exitCode !== 0 && cli.exitCode !== 1) {
      const detail = cli.stderr.trim() || cli.stdout.trim() || `Ariada CLI exited ${cli.exitCode}`;
      await writeFailureArtifacts(options, cli.exitCode, detail);
      process.stderr.write(`ariada-bazel: Ariada CLI exit ${cli.exitCode}: ${detail}\n`);
      return cli.exitCode;
    }
    const sourceReport = join(cliOutput, 'multi-domain-report.json');
    const report = JSON.parse(await readFile(sourceReport, 'utf8'));
    const summary = summarizeReport(report);
    const actionExitCode = cli.exitCode === 1 && !options.failOnFindings ? 0 : cli.exitCode;
    await mkdir(dirname(options.result), { recursive: true });
    const temporaryResult = `${options.result}.tmp-${process.pid}`;
    await copyFile(sourceReport, temporaryResult);
    await rename(temporaryResult, options.result);
    await atomicWrite(options.status, `${JSON.stringify({
      $schema: STATUS_SCHEMA,
      schemaVersion: 1,
      label: options.label,
      semanticExitCode: cli.exitCode,
      actionExitCode,
      findings: summary.findings,
      rules: summary.rules,
      severityThreshold: options.severityThreshold,
      domains: options.domains,
    }, null, 2)}\n`);
    process.stdout.write(`ARIADA_BAZEL_RESULT ${JSON.stringify({
      label: options.label,
      semanticExitCode: cli.exitCode,
      actionExitCode,
      findings: summary.findings,
      rules: summary.rules,
    })}\n`);
    return actionExitCode;
  } finally {
    if (server !== undefined) {
      await new Promise((accept) => server.close(accept));
    }
    await rm(workingDirectory, { recursive: true, force: true });
  }
}

export async function main(argv) {
  let options;
  try {
    options = parseArguments(argv);
    return await run(options);
  } catch (error) {
    const exitCode = Number.isInteger(error?.exitCode) ? error.exitCode : 3;
    const message = error instanceof Error ? error.message : String(error);
    await writeFailureArtifacts(options, exitCode, message);
    process.stderr.write(`ariada-bazel: ${message}\n`);
    return exitCode;
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await main(process.argv.slice(2));
}
