#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB)
// SPDX-License-Identifier: EUPL-1.2
//
// Keep the module catalog in the README true to the tree.
//
// The table lists every package, what it does, and which version of it is on
// the registry. Written by hand it goes stale the first time a package is
// added and nobody remembers the table exists — so it is derived instead, from
// each package.json and from the registry itself, and a check in continuous
// integration fails when the file and the tree disagree.
//
//   node scripts/module-catalog.mjs --check   # fail if the README is stale
//   node scripts/module-catalog.mjs --fix     # rewrite the table
//
// The registry is asked over the network and may be unreachable. That is not a
// reason to fail: without it the table still says what each package is and
// simply cannot say which version is published, and `--check` compares only
// what it was able to establish.

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const START = '<!-- ariada-bus:catalog:start';
const END = '<!-- ariada-bus:catalog:end -->';
const REGISTRY = 'https://registry.npmjs.org';

/** Every package in the tree, in the order they will be listed. */
async function readPackages(root) {
  const entries = await readdir(join(root, 'packages'), { withFileTypes: true });
  const packages = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    let manifest;
    try {
      manifest = JSON.parse(await readFile(join(root, 'packages', entry.name, 'package.json'), 'utf8'));
    } catch {
      continue; // a directory without a manifest is not a package
    }
    packages.push({
      dir: entry.name,
      name: manifest.name ?? entry.name,
      description: (manifest.description ?? '').replaceAll('|', '\\|').trim(),
      private: manifest.private === true,
    });
  }

  return packages.sort((a, b) => a.name.localeCompare(b.name));
}

/** What the registry has, or null where it could not be asked. */
async function publishedVersion(name) {
  try {
    const response = await fetch(`${REGISTRY}/${name.replace('/', '%2F')}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const body = await response.json();
    const version = body?.['dist-tags']?.latest;
    // The registry is not ours and its answer is not trusted into the file.
    return typeof version === 'string' && /^\d+\.\d+\.\d+/.test(version) ? version : null;
  } catch {
    return null;
  }
}

/** The table, as it should read. */
function render(packages, versions, reachable) {
  const published = packages.filter((p) => versions.get(p.name)).length;
  const eligible = packages.filter((p) => !p.private).length;

  const counted = reachable
    ? `${packages.length} packages in the tree (${eligible} publish-eligible, ${published} published to npm, ${packages.length - published} source-only).`
    : `${packages.length} packages in the tree (${eligible} publish-eligible).`;

  const lines = [
    '',
    '### Module catalog',
    '',
    `${counted} This table is generated from each package.json${reachable ? ' plus the live npm registry' : ''} — it cannot go stale by hand.`,
    '',
    '| Package | Published (npm) | What it does |',
    '|---|---|---|',
  ];

  for (const p of packages) {
    const version = versions.get(p.name);
    const state = version ? `\`${version}\`` : reachable ? 'source-only' : '—';
    lines.push(`| [\`${p.name}\`](./packages/${p.dir}#readme) | ${state} | ${p.description} |`);
  }

  lines.push('');
  return lines.join('\n');
}

/** Replace what sits between the markers, leaving the rest of the file alone. */
function splice(readme, table) {
  const from = readme.indexOf(START);
  const to = readme.indexOf(END);
  if (from === -1 || to === -1 || to < from) {
    throw new Error(`README has no catalog block — expected ${START} … ${END}`);
  }
  const openEnd = readme.indexOf('-->', from) + 3;
  return readme.slice(0, openEnd) + table + readme.slice(to);
}

const root = process.cwd();
const mode = process.argv.includes('--fix') ? 'fix' : 'check';

const packages = await readPackages(root);
const versions = new Map();
let reachable = false;

for (const p of packages) {
  if (p.private) continue;
  const version = await publishedVersion(p.name);
  if (version) {
    versions.set(p.name, version);
    reachable = true;
  }
}

const readmePath = join(root, 'README.md');
const readme = await readFile(readmePath, 'utf8');
const updated = splice(readme, render(packages, versions, reachable));

if (mode === 'fix') {
  if (updated === readme) {
    console.log('module catalog already matches the tree');
  } else {
    await writeFile(readmePath, updated, 'utf8');
    console.log(`module catalog rewritten — ${packages.length} packages`);
  }
  process.exit(0);
}

if (updated === readme) {
  console.log(`module catalog matches the tree — ${packages.length} packages`);
  process.exit(0);
}

console.error('The module catalog in README.md does not match the tree.');
console.error('Run `node scripts/module-catalog.mjs --fix` and commit the result.');
process.exit(1);
