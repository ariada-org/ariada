#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB)
// SPDX-License-Identifier: EUPL-1.2
//
// Keep the module catalog in the README true to the tree.
//
// The table lists every package, what it does, and which version of it is on
// the registry. Written by hand it goes stale the first time a package is added
// and nobody remembers the table exists — so it is derived instead, and a check
// fails when the file and the tree disagree.
//
//   node scripts/module-catalog.mjs --check   # fail if the README is stale
//   node scripts/module-catalog.mjs --fix     # rewrite the table
//
// Three things this is careful about, each because the careless version of it
// was written first and was wrong:
//
//   * The registry is someone else's server answering over a network. Its
//     answer is written into a tracked file, so only a string that is entirely
//     a version is accepted — an unanchored check lets `1.0.0 | <img …>`
//     through and puts it in the README.
//   * "Not published" and "could not ask" are different answers. A timeout
//     rendered as "source-only" asserts something nothing supports, and the
//     check then fails on the difference and tells the reader to write that
//     assertion into the file.
//   * A description is copied from a package.json into a public file. One that
//     calls itself internal, or names a product this repository does not talk
//     about, is a defect in the manifest; the table names it rather than
//     laundering it into the README.

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const START = '<!-- ariada-bus:catalog:start';
const END = '<!-- ariada-bus:catalog:end -->';
const REGISTRY = 'https://registry.npmjs.org';
const TIMEOUT_MS = 10_000;
const AT_ONCE = 8;

/** Wording that must not be copied from a manifest into a public file. */
const NOT_FOR_A_PUBLIC_FILE = [
  /\binternal\b/i,
  /\bproprietary\b/i,
  /\bclosed[- ]core\b/i,
  /\bblamer\b/i,
  /\bclamper\b/i,
  /\breverter\b/i,
  /\bdraculascan\b/i,
  /\bpatent\b/i,
];

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
      description: (manifest.description ?? '').replaceAll('|', '\\|').replaceAll(/\s+/gu, ' ').trim(),
      private: manifest.private === true,
    });
  }

  return packages.sort((a, b) => a.name.localeCompare(b.name));
}

/** Descriptions that should not be copied into the README, with the reason. */
export function unpublishableDescriptions(packages) {
  const found = [];
  for (const p of packages) {
    const matched = NOT_FOR_A_PUBLIC_FILE.find((re) => re.test(p.description));
    if (matched) found.push({ name: p.name, word: matched.source.replaceAll(/\\b|\[- \]/g, '') });
  }
  return found;
}

/** The published version, `null` when there is none, `undefined` when the
 *  registry could not be asked. The difference is the point. */
async function publishedVersion(name) {
  let response;
  try {
    response = await fetch(`${REGISTRY}/${name.replaceAll('/', '%2F')}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return undefined; // could not ask
  }
  if (response.status === 404) return null; // asked; not published
  if (!response.ok) return undefined;

  let body;
  try {
    body = await response.json();
  } catch {
    return undefined;
  }
  const version = body?.['dist-tags']?.latest;
  return typeof version === 'string' && /^\d+\.\d+\.\d+[\w.+-]*$/.test(version) ? version : null;
}

/** Ask about many at once, but not about all of them at once. */
async function askRegistry(packages) {
  const versions = new Map();
  const unknown = new Set();
  const askable = packages.filter((p) => !p.private);

  for (let i = 0; i < askable.length; i += AT_ONCE) {
    const batch = askable.slice(i, i + AT_ONCE);
    const answers = await Promise.all(batch.map((p) => publishedVersion(p.name)));
    for (const [j, answer] of answers.entries()) {
      const name = batch[j]?.name ?? '';
      if (answer === undefined) unknown.add(name);
      else if (answer !== null) versions.set(name, answer);
    }
  }

  return { versions, unknown };
}

/** The table, as it should read. */
export function render(packages, versions, unknown) {
  const published = packages.filter((p) => versions.get(p.name)).length;
  const eligible = packages.filter((p) => !p.private).length;

  const counted =
    unknown.size === 0
      ? `${packages.length} packages in the tree (${eligible} publish-eligible, ${published} published to npm, ${packages.length - published} source-only).`
      : `${packages.length} packages in the tree (${eligible} publish-eligible, ${published} published to npm). The registry could not be reached about ${unknown.size} of them.`;

  const lines = [
    '',
    '### Module catalog',
    '',
    `${counted} This table is generated from each package.json and the npm registry — it cannot go stale by hand.`,
    '',
    '| Package | Published (npm) | What it does |',
    '|---|---|---|',
  ];

  for (const p of packages) {
    const version = versions.get(p.name);
    const state = version ? `\`${version}\`` : unknown.has(p.name) ? 'unknown' : 'source-only';
    lines.push(`| [\`${p.name}\`](./packages/${p.dir}#readme) | ${state} | ${p.description} |`);
  }

  lines.push('');
  return lines.join('\n');
}

/** Replace what sits between the markers, leaving the rest of the file alone. */
export function splice(readme, table) {
  const from = readme.indexOf(START);
  const to = readme.indexOf(END);
  if (from === -1 || to === -1 || to < from) {
    throw new Error(`README has no catalog block — expected ${START} … ${END}`);
  }
  const closes = readme.indexOf('-->', from);
  if (closes === -1 || closes > to) {
    throw new Error('README catalog start marker is not closed — refusing to rewrite');
  }
  if (readme.indexOf(START, from + 1) !== -1) {
    throw new Error('README has more than one catalog block — refusing to rewrite');
  }
  return readme.slice(0, closes + 3) + table + readme.slice(to);
}

/** Everything above is testable on its own; this is the part that runs.
 *
 *  Kept behind a check for being the file that was invoked, because a script
 *  that does its work on import cannot be imported by a test — which is how
 *  the untested version of it reached a public repository. */
async function main() {
  const root = process.cwd();
  const mode = process.argv.includes('--fix') ? 'fix' : 'check';

  const packages = await readPackages(root);

  const unpublishable = unpublishableDescriptions(packages);
  if (unpublishable.length > 0) {
    console.error('These package descriptions would be copied into README.md and should not be:');
    for (const { name, word } of unpublishable) console.error(`  ${name} — mentions "${word}"`);
    console.error('Fix the description in the package.json rather than the table.');
    return 1;
  }

  const { versions, unknown } = await askRegistry(packages);

  const readmePath = join(root, 'README.md');
  const readme = await readFile(readmePath, 'utf8');
  const updated = splice(readme, render(packages, versions, unknown));

  if (mode === 'fix') {
    if (updated === readme) {
      console.log('module catalog already matches the tree');
    } else {
      await writeFile(readmePath, updated, 'utf8');
      console.log(`module catalog rewritten — ${packages.length} packages`);
    }
    return 0;
  }

  if (updated === readme) {
    console.log(
      `module catalog matches the tree — ${packages.length} packages` +
        (unknown.size > 0 ? `, ${unknown.size} unknown to the registry right now` : ''),
    );
    return 0;
  }

  // A difference the registry caused is not drift in the file.
  if (unknown.size > 0 && splice(readme, render(packages, versions, new Set())) === readme) {
    console.log(
      `module catalog matches the tree; the registry could not be reached about ${unknown.size} packages, so the published column was not compared`,
    );
    return 0;
  }

  console.error('The module catalog in README.md does not match the tree.');
  console.error('Run `node scripts/module-catalog.mjs --fix` and commit the result.');
  return 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exit(await main());
}
