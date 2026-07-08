#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { createServer } from 'node:http';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { resolve, join, relative, extname } from 'node:path';
import { spawn } from 'node:child_process';

import {
  buildAriadaInvocation,
  isHttpUrl,
  summarizeScanEnvelope,
} from '../src/config.mjs';

const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function usage() {
  return `Usage: gitbook-ariada --target <published-url|export-dir> [options]

Options:
  --target <value>              GitBook published URL or exported HTML directory.
  --report-dir <path>           Output directory for @ariada-org/cli reports.
  --fail-on-severity <level>    minor | moderate | serious | critical.
  --format <name>               CLI format, defaults to json.
  --timeout-ms <ms>             Per URL navigation timeout.
  --cli <bin>                   CLI binary, defaults to npx @ariada-org/cli.
  --dry-run                     Print the generated command without running it.
`;
}

function parseArgs(argv) {
  const options = {
    target: process.env.GITBOOK_ARIADA_TARGET,
    reportDir: process.env.ARIADA_REPORT_DIR ?? 'ariada-output',
    severity: process.env.ARIADA_FAIL_ON_SEVERITY ?? 'serious',
    format: process.env.ARIADA_FORMAT ?? 'json',
    timeoutMs: Number.parseInt(process.env.ARIADA_TIMEOUT_MS ?? '30000', 10),
    cliBin: process.env.ARIADA_CLI ?? 'npx',
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[index];
    };

    if (arg === '--target') options.target = next();
    else if (arg === '--report-dir') options.reportDir = next();
    else if (arg === '--fail-on-severity' || arg === '--severity-threshold') options.severity = next();
    else if (arg === '--format') options.format = next();
    else if (arg === '--timeout-ms') options.timeoutMs = Number.parseInt(next(), 10);
    else if (arg === '--cli') options.cliBin = next();
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

async function startStaticServer(rootDir) {
  const root = resolve(rootDir);
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      const pathname = decodeURIComponent(url.pathname);
      const requested = resolve(join(root, pathname));
      const safe = requested === root || !relative(root, requested).startsWith('..');
      if (!safe) {
        response.writeHead(403);
        response.end('Forbidden');
        return;
      }

      let filePath = requested;
      const fileStat = await stat(filePath);
      if (fileStat.isDirectory()) filePath = join(filePath, 'index.html');
      response.writeHead(200, {
        'content-type': CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream',
      });
      createReadStream(filePath).pipe(response);
    } catch {
      response.writeHead(404);
      response.end('Not found');
    }
  });

  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', resolveListen);
  });

  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not start fixture server');
  return {
    url: `http://127.0.0.1:${address.port}/`,
    close: () => new Promise((resolveClose) => server.close(resolveClose)),
  };
}

function runCommand(command, args) {
  return new Promise((resolveRun) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('close', (code) => resolveRun(code ?? 1));
    child.on('error', (error) => {
      console.error(`GitBook Ariada: failed to start ${command}: ${error.message}`);
      resolveRun(2);
    });
  });
}

async function printSummary(reportDir, severity) {
  try {
    const reportPath = resolve(reportDir, 'scan.json');
    const payload = JSON.parse(await readFile(reportPath, 'utf8'));
    const summary = summarizeScanEnvelope(payload, severity);
    console.log(
      `GitBook Ariada: ${summary.total} finding(s), threshold ${severity}, failed=${summary.failed}`,
    );
    for (const finding of summary.findings.slice(0, 5)) {
      console.log(
        `- ${finding.ruleId ?? 'unknown'} [${finding.severity ?? 'unknown'}] ${finding.message ?? ''}`,
      );
    }
  } catch {
    console.log(`GitBook Ariada: no scan.json summary found in ${reportDir}`);
  }
}

async function main() {
  let server;
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      console.log(usage());
      return 0;
    }
    if (!options.target) {
      console.error(usage());
      return 2;
    }

    await mkdir(options.reportDir, { recursive: true });

    let targetUrl = options.target;
    let allowPrivate = false;
    if (!isHttpUrl(targetUrl)) {
      const local = await stat(targetUrl).catch(() => undefined);
      if (!local?.isDirectory()) throw new Error(`Target is not a URL or directory: ${targetUrl}`);
      server = await startStaticServer(targetUrl);
      targetUrl = server.url;
      allowPrivate = true;
      console.log(`GitBook Ariada: serving exported HTML from ${resolve(options.target)}`);
    }

    const invocation = buildAriadaInvocation({
      targetUrl,
      reportDir: options.reportDir,
      severity: options.severity,
      format: options.format,
      timeoutMs: options.timeoutMs,
      allowPrivate,
      cliBin: options.cliBin,
    });

    console.log(`GitBook Ariada: ${invocation.command} ${invocation.args.join(' ')}`);
    if (options.dryRun) return 0;

    const code = await runCommand(invocation.command, invocation.args);
    await printSummary(options.reportDir, options.severity);
    return code;
  } catch (error) {
    console.error(`GitBook Ariada: ${error instanceof Error ? error.message : String(error)}`);
    return 2;
  } finally {
    if (server) await server.close();
  }
}

process.exitCode = await main();
