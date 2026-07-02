#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const originalCwd = process.cwd();
const args = process.argv.slice(2);
const command = args[0] ?? '--help';

function run(cmd, cmdArgs, options = {}) {
  const result = spawnSync(cmd, cmdArgs, { stdio: 'inherit', ...options });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function realVsceMain() {
  const packageJsonPath = join(originalCwd, 'node_modules/@vscode/vsce/package.json');
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  return resolve(dirname(packageJsonPath), pkg.bin.vsce);
}

function vsceEnv() {
  const nodePath = join(originalCwd, 'node_modules');
  return { ...process.env, NODE_PATH: process.env.NODE_PATH ? `${nodePath}:${process.env.NODE_PATH}` : nodePath };
}

function hasOutFlag(argv) {
  return argv.some((arg) => arg === '-o' || arg === '--out' || arg.startsWith('--out='));
}

function hasDependencyModeFlag(argv) {
  return argv.some((arg) => arg === '--dependencies' || arg === '--no-dependencies');
}

function stageExtension() {
  run('pnpm', ['run', 'build'], { cwd: originalCwd });

  const sourcePackage = JSON.parse(readFileSync(join(originalCwd, 'package.json'), 'utf8'));
  const stage = mkdtempSync(join(tmpdir(), 'ariada-vscode-extension-'));
  for (const path of ['dist', 'README.md', 'CHANGELOG.md', 'LICENSE', 'NOTICE', 'icon.png', '.vscodeignore']) {
    cpSync(join(originalCwd, path), join(stage, path), { recursive: true });
  }
  symlinkSync(join(originalCwd, 'node_modules'), join(stage, 'node_modules'), 'dir');
  const manifest = {
    ...sourcePackage,
    name: 'ariada-accessibility',
    private: false,
  };
  delete manifest.devDependencies;
  delete manifest.files;
  delete manifest.scripts;
  writeFileSync(join(stage, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return stage;
}

if (command === 'package' || command === 'pack' || command === 'publish') {
  const stage = stageExtension();
  const stagedArgs = [...args];
  if ((command === 'package' || command === 'pack') && !hasOutFlag(stagedArgs)) {
    stagedArgs.push('--out', join(originalCwd, 'ariada-accessibility-0.1.0.vsix'));
  }
  if ((command === 'package' || command === 'pack') && !hasDependencyModeFlag(stagedArgs)) {
    stagedArgs.push('--no-dependencies');
  }
  try {
    run(process.execPath, [realVsceMain(), ...stagedArgs], { cwd: stage, env: vsceEnv() });
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
} else {
  run(process.execPath, [realVsceMain(), ...args], { cwd: originalCwd });
}
