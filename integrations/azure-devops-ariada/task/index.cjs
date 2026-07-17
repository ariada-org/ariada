// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
'use strict';

const { spawn } = require('node:child_process');
const { mkdirSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');

function input(name, fallback = '') {
  const key = `INPUT_${name.replace(/[^A-Za-z0-9]/g, '').toUpperCase()}`;
  return process.env[key] || fallback;
}

function boolInput(name, fallback = false) {
  const raw = input(name, String(fallback)).toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}

function logIssue(type, message) {
  console.error(`##vso[task.logissue type=${type};]${message}`);
}

function complete(result, message) {
  console.log(`##vso[task.complete result=${result};]${message}`);
}

function buildCommand() {
  const targetUrl = input('targetUrl');
  if (!/^https?:\/\//.test(targetUrl)) {
    throw new Error('targetUrl must be an absolute http(s) URL.');
  }

  const outputDir = resolve(input('outputDir', './ariada-output'));
  mkdirSync(outputDir, { recursive: true });

  const cliPath = input('cliPath');
  const installCli = boolInput('installCli');
  const command = cliPath || (installCli ? 'npx' : 'ariada');
  const prefix = cliPath ? [] : installCli ? ['--yes', '@ariada-org/cli@latest'] : [];
  const args = [
    ...prefix,
    'scan',
    targetUrl,
    '--severity-threshold',
    input('failOnSeverity', 'serious'),
    '--format',
    input('format', 'json'),
    '--output-dir',
    outputDir,
    '--timeout-ms',
    input('timeoutMs', '30000'),
  ];
  return { command, args, outputDir };
}

async function run() {
  const { command, args, outputDir } = buildCommand();
  console.log(`Ariada Azure DevOps task running: ${command} ${args.join(' ')}`);
  const child = spawn(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });
  child.stdout.on('data', (chunk) => process.stdout.write(chunk));
  child.stderr.on('data', (chunk) => process.stderr.write(chunk));
  const exitCode = await new Promise((resolveExit) => {
    child.on('error', (error) => {
      logIssue('error', error instanceof Error ? error.message : String(error));
      resolveExit(127);
    });
    child.on('close', (code) => resolveExit(code ?? 1));
  });

  const scanJson = resolve(outputDir, 'scan.json');
  if (existsSync(scanJson)) {
    console.log(`##vso[task.uploadfile]${scanJson}`);
  } else {
    logIssue('warning', `Ariada did not produce ${scanJson}`);
  }
  console.log(`##vso[artifact.upload artifactname=ariada-output;]${outputDir}`);

  if (exitCode === 0) {
    complete('Succeeded', 'Ariada accessibility gate passed.');
  } else if (exitCode === 1) {
    logIssue('error', 'Ariada found violations at or above the configured severity.');
    complete('Failed', 'Ariada accessibility gate failed.');
  } else {
    logIssue('error', `Ariada CLI exited with code ${exitCode}.`);
    complete('Failed', 'Ariada accessibility gate could not complete.');
  }
  process.exitCode = exitCode;
}

run().catch((error) => {
  logIssue('error', error instanceof Error ? error.message : String(error));
  complete('Failed', 'Ariada accessibility gate configuration failed.');
  process.exitCode = 2;
});
