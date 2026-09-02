#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

// The end-to-end smoke run needs a PHP runtime and a container host, and says so
// loudly when it has neither. That leaves this extension with nothing that can
// be checked on an ordinary machine — so what is checked here is the part that
// breaks most often and needs neither: agreement between files that cannot see
// each other.
//
// A TYPO3 extension states the same facts in four places. The package manifest
// declares a namespace and an extension key; the classic manifest declares the
// version and the supported range; the module registration names a controller
// class by its fully-qualified name; the service wiring names the namespace
// again. Each is edited on its own occasion, and when one drifts the extension
// does not fail to build — it fails to load, in the host, at install time.
//
// The directory is read from an argument when one is given, so this can be run
// against a deliberately-broken copy and shown to refuse it. A checker that has
// only ever seen the good tree is not known to check anything.

import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : resolve(import.meta.dirname, '..');

const read = (relative) => readFileSync(resolve(root, relative), 'utf8');
const composer = JSON.parse(read('composer.json'));
const emconf = read('ext_emconf.php');
const modules = read('Configuration/Backend/Modules.php');
const services = read('Configuration/Services.yaml');

const failures = [];

if (composer.type !== 'typo3-cms-extension') {
  failures.push(`the package type must be typo3-cms-extension, not ${composer.type}`);
}

const namespace = Object.keys(composer.autoload?.['psr-4'] ?? {})[0]?.replace(/\\+$/, '');
if (!namespace) {
  failures.push('the manifest declares no namespace for the autoloader');
}

// Every class under Classes/ must sit in the namespace the autoloader will look
// for it under. One file moved is one class the host cannot find.
const classFiles = [];
const walk = (dir) => {
  for (const entry of readdirSync(resolve(root, dir), { withFileTypes: true })) {
    if (entry.isDirectory()) walk(`${dir}/${entry.name}`);
    else if (entry.name.endsWith('.php')) classFiles.push(`${dir}/${entry.name}`);
  }
};
walk('Classes');

if (classFiles.length === 0) {
  failures.push('there are no classes under Classes/');
}

for (const file of classFiles) {
  const declared = read(file).match(/^namespace (.+);$/m)?.[1];
  if (declared === undefined) {
    failures.push(`${file} declares no namespace`);
  } else if (namespace && !declared.startsWith(namespace)) {
    failures.push(`${file} is in ${declared}, outside the autoloaded ${namespace}`);
  }
}

// The extension key appears in the package manifest and in every reference to a
// file inside the extension. Renamed in one place, the labels resolve to nothing
// and the module shows up untitled.
const key = composer.extra?.['typo3/cms']?.['extension-key'];
if (!key) {
  failures.push('the manifest declares no extension key');
} else if (!modules.includes(`EXT:${key}/`)) {
  failures.push(`the module registration does not reference EXT:${key}/ for its labels`);
}

// Two manifests, two versions, written on different occasions.
const emconfVersion = emconf.match(/'version' => '([^']+)'/)?.[1];
if (!emconfVersion) {
  failures.push('the classic manifest declares no version');
}

// The module registration names a controller by class. The service wiring must
// know the same class, or the route resolves to something the container cannot
// build.
const routed = modules.match(/^use (.+);$/m)?.[1];
if (!routed) {
  failures.push('the module registration imports no controller class');
} else {
  if (!modules.includes(`${routed.split('\\').pop()}::class`)) {
    failures.push('the module registration imports a controller it does not route to');
  }
  if (!services.includes(routed)) {
    failures.push(`the service wiring does not mention ${routed}, so the route cannot be built`);
  }
}

if (namespace && !services.includes(namespace)) {
  failures.push(`the service wiring does not load the ${namespace} namespace`);
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log(`PASS typo3-ariada structure (${classFiles.length} class file(s), version ${emconfVersion})`);
