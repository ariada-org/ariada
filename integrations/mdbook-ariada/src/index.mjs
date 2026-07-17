#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SEVERITY_RANK = { minor: 1, moderate: 2, serious: 3, critical: 4 };

export async function listHtmlFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = resolve(root, entry.name);
    if (entry.isDirectory()) files.push(...await listHtmlFiles(fullPath));
    if (entry.isFile() && entry.name.endsWith('.html')) files.push(fullPath);
  }
  return files.sort();
}

export function buildScanCommand(options) {
  const cliBin = options.cliBin ?? process.env.ARIADA_CLI_BIN;
  const command = cliBin ?? 'npx';
  const prefix = cliBin ? [] : ['--yes', '@ariada-org/cli'];
  const args = [
    ...prefix,
    'scan',
    ...options.targets,
    '--severity-threshold',
    options.severityThreshold ?? 'serious',
    '--format',
    options.format ?? 'html',
    '--output-dir',
    options.outputDir ?? 'ariada-output',
  ];
  if (options.outputFile) args.push('--out', options.outputFile);
  if (options.domains) args.push('--domains', options.domains);
  return { command, args };
}

export async function scanMdBookOutput(options = {}, runner = runCommand) {
  const bookDir = resolve(options.bookDir ?? process.env.ARIADA_MDBOOK_BOOK_DIR ?? 'book');
  let htmlFiles;
  try {
    htmlFiles = await listHtmlFiles(bookDir);
  } catch {
    console.error(`mdbook-ariada: rendered HTML directory not found: ${bookDir}`);
    return 2;
  }
  if (htmlFiles.length === 0) {
    console.error(`mdbook-ariada: no rendered HTML files found under: ${bookDir}`);
    return 2;
  }

  const targets = htmlFiles.map((file) => pathToFileURL(file).href);
  const command = buildScanCommand({
    targets,
    cliBin: options.cliBin,
    domains: options.domains ?? process.env.ARIADA_DOMAINS,
    format: options.format ?? process.env.ARIADA_FORMAT ?? 'html',
    outputDir: options.outputDir ?? process.env.ARIADA_REPORT_DIR ?? 'ariada-output',
    outputFile: options.outputFile ?? process.env.ARIADA_REPORT_FILE,
    severityThreshold: options.severityThreshold ?? process.env.ARIADA_FAIL_ON_SEVERITY ?? 'serious',
  });
  return runner(command);
}

export function summarizeAriadaReport(payload, threshold = 'serious') {
  const findings = [];
  if (Array.isArray(payload?.report?.findings)) findings.push(...payload.report.findings);
  if (payload?.report?.findings && !Array.isArray(payload.report.findings)) {
    findings.push(...Object.values(payload.report.findings).flat());
  }
  for (const site of payload?.sites ?? []) {
    for (const domain of payload?.domains ?? []) {
      findings.push(...(payload?.grid?.[site]?.[domain] ?? []));
    }
  }
  const minRank = SEVERITY_RANK[threshold] ?? SEVERITY_RANK.serious;
  const blocking = findings.filter((finding) => {
    const rank = SEVERITY_RANK[finding?.severity] ?? SEVERITY_RANK.moderate;
    return rank >= minRank;
  });
  return { total: findings.length, blocking: blocking.length, shouldFail: blocking.length > 0 };
}

export async function runPreprocessor(argv, stdin, stdout, stderr) {
  if (argv[0] === 'supports') return argv[1] === 'html' ? 0 : 1;
  try {
    const input = await readStream(stdin);
    const parsed = JSON.parse(input);
    const book = Array.isArray(parsed) ? parsed[1] : parsed?.book;
    if (!book || typeof book !== 'object') throw new Error('missing mdBook book payload');
    stdout.write(`${JSON.stringify(book)}\n`);
    return 0;
  } catch (error) {
    stderr.write(`mdbook-ariada: invalid preprocessor input: ${error.message}\n`);
    return 2;
  }
}

export function parseScanArgs(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--book-dir') out.bookDir = argv[++index];
    else if (arg === '--output-dir') out.outputDir = argv[++index];
    else if (arg === '--output-file') out.outputFile = argv[++index];
    else if (arg === '--severity-threshold') out.severityThreshold = argv[++index];
    else if (arg === '--format') out.format = argv[++index];
    else if (arg === '--domains') out.domains = argv[++index];
    else if (arg === '--cli-bin') out.cliBin = argv[++index];
    else throw new Error(`unknown option: ${arg}`);
  }
  return out;
}

async function main(argv = process.argv.slice(2)) {
  if (argv[0] === 'scan') return scanMdBookOutput(parseScanArgs(argv.slice(1)));
  if (argv[0] === 'help' || argv[0] === '--help' || argv[0] === '-h') {
    process.stdout.write('Usage: mdbook-ariada scan [--book-dir book] [--output-dir ariada-output]\n');
    return 0;
  }
  return runPreprocessor(argv, process.stdin, process.stdout, process.stderr);
}

function runCommand({ command, args }) {
  return new Promise((resolveExit) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('exit', (code) => resolveExit(code ?? 3));
    child.on('error', (error) => {
      console.error(`mdbook-ariada: failed to run ${command}: ${error.message}`);
      resolveExit(3);
    });
  });
}

function readStream(stream) {
  return new Promise((resolveRead, rejectRead) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('end', () => resolveRead(Buffer.concat(chunks).toString('utf8')));
    stream.on('error', rejectRead);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => {
    process.exitCode = code;
  });
}
