// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
'use strict';

const { createReadStream } = require('node:fs');
const { mkdir, readFile, stat } = require('node:fs/promises');
const http = require('node:http');
const { extname, join, relative, resolve, sep } = require('node:path');
const { spawn } = require('node:child_process');

const DEFAULTS = {
  browser: 'chromium',
  domains: 'accessibility',
  enabled: true,
  failOnFindings: true,
  outputDir: 'ariada-output',
  publicDir: 'public',
  severityThreshold: 'moderate',
  timeoutMs: 30_000,
};

function registerHexoAriada(hexo, overrides = {}) {
  if (!hexo || !hexo.extend || !hexo.extend.filter) {
    throw new Error('hexo-ariada requires a Hexo instance with extend.filter.');
  }

  hexo.extend.filter.register('after_generate', async function ariadaAfterGenerate() {
    const config = resolveConfig(hexo, overrides);
    if (!config.enabled) return;
    const logger = getLogger(hexo);
    const summary = await runAriadaScan(config, logger);
    logger.info(`Ariada scan finished for ${summary.targetUrl} with ${summary.findingCount} finding(s).`);
  });
}

function resolveConfig(hexo, overrides = {}) {
  const userConfig = hexo.config && hexo.config.ariada ? hexo.config.ariada : {};
  const baseDir = resolve(hexo.base_dir || process.cwd());
  const config = { ...DEFAULTS, ...userConfig, ...overrides };
  const publicDir = resolve(baseDir, config.publicDir);
  const outputDir = resolve(baseDir, config.outputDir);
  return { ...config, baseDir, publicDir, outputDir };
}

async function runAriadaScan(config, logger = console) {
  await assertDirectory(config.publicDir);
  await mkdir(config.outputDir, { recursive: true });

  const server = config.targetUrl
    ? null
    : await createStaticServer(config.publicDir, config.port || 0);
  const targetUrl = config.targetUrl || server.url;

  try {
    const result = await runCli(targetUrl, config);
    const reportPath = join(config.outputDir, 'multi-domain-report.json');
    const findingCount = await countFindings(reportPath);
    if (findingCount > 0) {
      logger.warn(`Ariada reported ${findingCount} finding(s).`);
    }
    if (result.exitCode !== 0 && (config.failOnFindings || result.exitCode !== 1)) {
      throw new Error(`Ariada CLI exited with code ${result.exitCode}.\n${result.stderr}`.trim());
    }
    return { ...result, targetUrl, reportPath, findingCount };
  } finally {
    if (server) await server.close();
  }
}

async function assertDirectory(path) {
  const info = await stat(path);
  if (!info.isDirectory()) {
    throw new Error(`Ariada publicDir is not a directory: ${path}`);
  }
}

function runCli(targetUrl, config) {
  const args = buildCliArgs(targetUrl, config);
  const spawnCli = config.spawnCli || defaultSpawnCli;
  return spawnCli(config.command || 'npx', args, { cwd: config.baseDir });
}

function buildCliArgs(targetUrl, config) {
  const args = [
    '@ariada-org/cli',
    'scan',
    targetUrl,
    '--allow-private',
    '--browser',
    config.browser,
    '--domains',
    config.domains,
    '--format',
    'json',
    '--output-dir',
    config.outputDir,
    '--severity-threshold',
    config.severityThreshold,
    '--timeout-ms',
    String(config.timeoutMs),
  ];
  return args;
}

function defaultSpawnCli(command, args, options) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (exitCode) => resolvePromise({ exitCode, stdout, stderr }));
  });
}

async function countFindings(reportPath) {
  try {
    const report = JSON.parse(await readFile(reportPath, 'utf8'));
    let count = 0;
    for (const site of report.sites || []) {
      for (const domain of report.domains || []) {
        count += ((report.grid || {})[site] || {})[domain]?.length || 0;
      }
    }
    return count;
  } catch {
    return 0;
  }
}

function createStaticServer(rootDir, port) {
  const root = resolve(rootDir);
  const server = http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
      const filePath = safeResolve(root, requestUrl.pathname);
      const info = await stat(filePath);
      const finalPath = info.isDirectory() ? join(filePath, 'index.html') : filePath;
      response.setHeader('content-type', contentType(finalPath));
      createReadStream(finalPath).pipe(response);
    } catch {
      response.statusCode = 404;
      response.end('Not found');
    }
  });

  return new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject);
      const address = server.address();
      resolvePromise({
        url: `http://127.0.0.1:${address.port}/`,
        close: () => new Promise((resolveClose) => server.close(resolveClose)),
      });
    });
  });
}

function safeResolve(root, pathname) {
  const decoded = decodeURIComponent(pathname);
  const target = resolve(root, `.${decoded}`);
  const rel = relative(root, target);
  if (rel.startsWith('..') || rel.includes(`..${sep}`)) {
    throw new Error('Path escapes public root.');
  }
  return target;
}

function contentType(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.js') return 'text/javascript; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  return 'application/octet-stream';
}

function getLogger(hexo) {
  return hexo.log || { info() {}, warn() {} };
}

module.exports = {
  buildCliArgs,
  countFindings,
  createStaticServer,
  registerHexoAriada,
  resolveConfig,
  runAriadaScan,
};
