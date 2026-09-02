#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

// What this package must get right is agreement between files that cannot see
// each other: the package manifest declares a namespace and a plugin type, the
// source declares that namespace and the shape of the request it sends, and the
// host loads the one by the other. Renamed on one side only, the plugin stops
// loading with nothing here to say why.
//
// The directory is read from an argument when one is given, so this can be run
// against a deliberately-broken copy and shown to refuse it. A checker that has
// only ever seen the good tree is not known to check anything.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : resolve(import.meta.dirname, '..');

const composer = JSON.parse(readFileSync(resolve(root, 'composer.json'), 'utf8'));
const source = readFileSync(resolve(root, 'src/Plugin.php'), 'utf8');

const failures = [];

if (composer.type !== 'craft-plugin') {
  failures.push(`the package type must be craft-plugin, not ${composer.type}`);
}

// The namespace is written twice — once for the autoloader, once at the top of
// the file it loads. Agreeing is the whole job.
const declared = Object.keys(composer.autoload?.['psr-4'] ?? {})[0];
const inSource = source.match(/^namespace (.+);$/m)?.[1];
if (!declared) {
  failures.push('the manifest declares no namespace for the autoloader');
} else if (inSource === undefined) {
  failures.push('the source declares no namespace');
} else if (declared.replace(/\\+$/, '') !== inSource.replace(/\\+$/, '')) {
  failures.push(`namespace disagrees: the manifest says ${declared}, the source says ${inSource}`);
}

for (const method of ['renderedEntryUrl', 'scanRequest']) {
  if (!new RegExp(`function ${method}\\(`).test(source)) {
    failures.push(`the source must declare ${method}() — mentioning it is not declaring it`);
  }
}

// How a scan is attributed back to this integration. Renamed here and nowhere
// else, the scans keep working and stop being counted.
if (!source.includes("'craft.entry'")) {
  failures.push("the scan request must be attributed to craft.entry");
}

if (!source.includes("'accessibility'")) {
  failures.push('the scan request must ask for the accessibility domain');
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log('PASS craft-ariada structure');
