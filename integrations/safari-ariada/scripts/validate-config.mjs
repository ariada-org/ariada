#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const integrationDir = resolve(import.meta.dirname, '..');
const repoRoot = resolve(integrationDir, '..', '..');

// The config to read is chosen by the caller when one is named, so this can be
// pointed at a deliberately-broken file and shown to refuse it. A checker that
// has only ever seen good input is not known to check anything.
const configPath = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : resolve(integrationDir, 'config/safari-wrapper.json');

const config = JSON.parse(readFileSync(configPath, 'utf8'));
const required = [
  'appName',
  'bundleIdentifier',
  'extensionPackage',
  'webExtensionDir',
  'projectDir',
  'projectFile',
  'scheme',
];

const failures = [];

for (const key of required) {
  if (typeof config[key] !== 'string' || config[key].trim() === '') {
    failures.push(`config.${key} must be a non-empty string`);
  }
}

if (!/^[A-Za-z0-9.-]+$/.test(config.bundleIdentifier ?? '')) {
  failures.push('bundleIdentifier must use reverse-DNS-safe characters');
}

// The extension is not in every checkout of this repository. Absent, that is not
// a failure of this configuration — there is simply nothing here to compare it
// against, and calling it a failure sends somebody to fix a file that is right.
//
// Exit 2 is the convention here for "could not look", kept distinct from 1,
// which means "looked and found something".
const extensionPackagePath = resolve(repoRoot, 'packages/extension-chrome/package.json');
if (!existsSync(extensionPackagePath)) {
  console.log('CANNOT CHECK — packages/extension-chrome is not in this checkout.');
  console.log('This is not a pass: the parts that compare against it were skipped.');
  process.exit(2);
} else {
  const extensionPackage = JSON.parse(readFileSync(extensionPackagePath, 'utf8'));
  if (extensionPackage.name !== config.extensionPackage) {
    failures.push(`extension package mismatch: ${extensionPackage.name}`);
  }
  if (typeof extensionPackage.scripts?.build !== 'string') {
    failures.push('extension package must expose a build script');
  }
}

const webExtensionDir = resolve(integrationDir, config.webExtensionDir ?? '.');
const extensionSourceDir = resolve(repoRoot, 'packages/extension-chrome');
if (!webExtensionDir.startsWith(extensionSourceDir)) {
  failures.push('webExtensionDir must point at the existing extension package output');
}

const converter = spawnSync('xcrun', ['--find', 'safari-web-extension-converter'], {
  encoding: 'utf8',
});

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log('Safari wrapper config valid');
if (converter.status === 0) {
  console.log(`Converter: ${converter.stdout.trim()}`);
} else {
  console.log(`Converter unavailable: ${converter.stderr.trim()}`);
}

