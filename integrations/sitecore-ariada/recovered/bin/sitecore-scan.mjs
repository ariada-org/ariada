#!/usr/bin/env node
import { access, mkdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';

function usage() {
  return [
    'Usage: ariada-sitecore-scan --url <http(s)://url> --output-dir <directory>',
    '  [--severity-threshold minor|moderate|serious|critical]',
    '  [--timeout-ms <milliseconds>] [--allow-private true|false]',
    '  [--browser-executable <existing Chromium executable>]',
  ].join('\n');
}

function parseArguments(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return { help: true };
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined) throw new Error(`Invalid argument sequence near ${String(key)}.`);
    if (Object.hasOwn(values, key)) throw new Error(`Duplicate argument: ${key}`);
    values[key] = value;
  }
  const url = values['--url'];
  const outputDirectory = values['--output-dir'];
  if (url === undefined || outputDirectory === undefined) throw new Error('Both --url and --output-dir are required.');
  const parsedUrl = new URL(url);
  if (!['http:', 'https:'].includes(parsedUrl.protocol) || parsedUrl.username !== '' || parsedUrl.password !== '') {
    throw new Error('--url must be a credential-free absolute HTTP(S) URL.');
  }
  const severityThreshold = values['--severity-threshold'] ?? 'minor';
  if (!['minor', 'moderate', 'serious', 'critical'].includes(severityThreshold)) throw new Error('Invalid --severity-threshold.');
  const timeoutMs = Number.parseInt(values['--timeout-ms'] ?? '45000', 10);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 5000 || timeoutMs > 120000) throw new Error('--timeout-ms must be between 5000 and 120000.');
  const allowPrivateText = values['--allow-private'] ?? 'false';
  if (!['true', 'false'].includes(allowPrivateText)) throw new Error('--allow-private must be true or false.');
  const known = new Set(['--url', '--output-dir', '--severity-threshold', '--timeout-ms', '--allow-private', '--browser-executable']);
  for (const key of Object.keys(values)) if (!known.has(key)) throw new Error(`Unknown argument: ${key}`);
  return {
    help: false,
    url: parsedUrl.href,
    outputDirectory: resolve(outputDirectory),
    severityThreshold,
    timeoutMs,
    allowPrivate: allowPrivateText === 'true',
    browserExecutable: values['--browser-executable'],
  };
}

async function prepareExistingBrowser(executable) {
  await access(executable, constants.X_OK);
  const { chromium } = await import('playwright');
  const originalLaunch = chromium.launch.bind(chromium);
  chromium.launch = (launchOptions = {}) => originalLaunch({ ...launchOptions, executablePath: resolve(executable) });
  return { async cleanup() {} };
}

let browser;
try {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
  } else {
    await mkdir(options.outputDirectory, { recursive: true });
    if (options.browserExecutable !== undefined) browser = await prepareExistingBrowser(options.browserExecutable);
    const [{ runScan }, corePlaywright] = await Promise.all([
      import('@ariada-org/cli'),
      options.allowPrivate ? import('@ariada-org/core-playwright') : Promise.resolve(undefined),
    ]);
    const injectedScan = options.allowPrivate
      ? (url, scanOptions) => corePlaywright.scan(url, { ...scanOptions, allowPrivate: true })
      : undefined;
    const exitCode = await runScan(
      options.url,
      {
        outputDir: options.outputDirectory,
        browser: 'chromium',
        format: 'json',
        severityThreshold: options.severityThreshold,
        timeoutMs: options.timeoutMs,
      },
      process.stdout,
      process.stderr,
      injectedScan,
    );
    process.exitCode = exitCode;
  }
} catch (error) {
  process.stderr.write(`${JSON.stringify({ level: 'error', code: 'E_SITECORE_WRAPPER', message: error instanceof Error ? error.message : String(error) })}\n`);
  process.stderr.write(`${usage()}\n`);
  process.exitCode = 3;
} finally {
  await browser?.cleanup();
}
