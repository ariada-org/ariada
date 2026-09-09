// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

/**
 * Every third-party package the plugin imports must travel with it.
 *
 * The build classpath is wider than the IDE the plugin runs in: tooling the
 * build itself uses is visible to the compiler and to the tests, and absent at
 * runtime. Code written against something in that gap compiles, passes its
 * tests, and throws NoClassDefFoundError the first time a person uses the
 * feature — which is the worst order for a defect to be found in.
 *
 * That is not hypothetical here. The report reader was written against
 * com.google.gson, which satisfied the compiler and every test, and which no
 * jar in the IntelliJ IDEA 2024.2.5 distribution contains.
 *
 * So: read the imports out of the sources, drop the ones the platform and the
 * language provide, and require the rest to be inside the built archive.
 *
 * Usage: node scripts/check-bundled-deps.mjs
 */

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE_ROOT = 'src/main/java';
const DIST_DIR = 'build/distributions';

/** Provided by the language, the platform, or the plugin's own package. */
const PROVIDED = [
  /^java\./,
  /^javax\./,
  /^jdk\./,
  /^com\.intellij\./,
  /^org\.jetbrains\.annotations\./,
  /^org\.ariada\.jetbrains\./,
  /^kotlin\./,
];

function javaFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...javaFiles(path));
    else if (entry.endsWith('.java')) out.push(path);
  }
  return out;
}

function importedPackages() {
  const packages = new Set();
  for (const file of javaFiles(SOURCE_ROOT)) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const match = /^\s*import\s+(?:static\s+)?([\w.]+)\s*;/.exec(line);
      if (!match) continue;
      const imported = match[1];
      if (PROVIDED.some((p) => p.test(imported))) continue;
      // The package is everything up to the class name.
      packages.add(imported.split('.').slice(0, -1).join('.'));
    }
  }
  return [...packages].filter(Boolean).sort();
}

function archive() {
  if (!existsSync(DIST_DIR)) return null;
  const zip = readdirSync(DIST_DIR).find((f) => f.endsWith('.zip'));
  return zip ? join(DIST_DIR, zip) : null;
}

const needed = importedPackages();
if (needed.length === 0) {
  console.log('check-bundled-deps: OK — the plugin imports nothing beyond the platform.');
  process.exit(0);
}

const zip = archive();
if (!zip) {
  console.error('check-bundled-deps: cannot check — no built archive. Run `./gradlew buildPlugin` first.');
  process.exit(2);
}

const listing = execFileSync('unzip', ['-l', zip], { encoding: 'utf8' });
const jars = listing
  .split('\n')
  .map((line) => line.trim().split(/\s+/).pop())
  .filter((name) => name && name.endsWith('.jar'));

const contents = new Set();
for (const jar of jars) {
  const inner = execFileSync('sh', ['-c', `unzip -p ${JSON.stringify(zip)} ${JSON.stringify(jar)} > /tmp/ariada-dep-check.jar && unzip -l /tmp/ariada-dep-check.jar`], {
    encoding: 'utf8',
  });
  for (const line of inner.split('\n')) {
    const entry = line.trim().split(/\s+/).pop();
    if (entry && entry.endsWith('.class')) {
      contents.add(entry.slice(0, entry.lastIndexOf('/')).replaceAll('/', '.'));
    }
  }
}

const missing = needed.filter((pkg) => !contents.has(pkg));
for (const pkg of needed) {
  console.log(`  ${missing.includes(pkg) ? 'MISSING' : 'bundled'}  ${pkg}`);
}

if (missing.length > 0) {
  console.error(
    `check-bundled-deps: FAIL — ${missing.length} package(s) imported but not in the archive: ${missing.join(', ')}.\n` +
      'Declare them as `implementation(...)` so they ship with the plugin, or stop importing them.',
  );
  process.exit(1);
}
console.log(`check-bundled-deps: OK — ${needed.length} third-party package(s), all bundled.`);
