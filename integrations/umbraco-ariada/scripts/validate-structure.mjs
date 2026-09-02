#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

// What this package must get right is agreement between files that cannot see
// each other: the project declares a framework and a version, the service
// declares the shape of the request it sends, and the README tells a person
// which of those to expect. Nothing checks them against each other at build
// time, so they drift silently and the drift is found by whoever installs it.
//
// The directory is read from an argument when one is given, so this can be run
// against a deliberately-broken copy and shown to refuse it. A checker that has
// only ever seen the good tree is not known to check anything.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : resolve(import.meta.dirname, '..');

const project = readFileSync(resolve(root, 'Ariada.Umbraco.csproj'), 'utf8');
const service = readFileSync(resolve(root, 'src/AriadaScanService.cs'), 'utf8');
const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

const failures = [];
const value = (tag) => project.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))?.[1];

if (value('TargetFramework') !== 'net8.0') {
  failures.push(`project must target net8.0, not ${value('TargetFramework') ?? '(nothing)'}`);
}

if (!/PackageReference Include="Umbraco\.Cms\.Core"/.test(project)) {
  failures.push('project must reference Umbraco.Cms.Core');
}

// Two files carry the version. They are written by different hands at different
// times, which is the whole reason to compare them.
if (value('Version') !== manifest.version) {
  failures.push(
    `version disagrees: the project says ${value('Version')}, package.json says ${manifest.version}`,
  );
}

if (value('PackageLicenseExpression') !== manifest.license) {
  failures.push(
    `licence disagrees: the project says ${value('PackageLicenseExpression')}, package.json says ${manifest.license}`,
  );
}

// The request shape is the contract with the scanner. Its source string is how
// a scan is attributed back to this integration; renamed here and nowhere else,
// the scans keep working and stop being counted.
if (!/record AriadaScanRequest\(/.test(service)) {
  failures.push('the service must declare the AriadaScanRequest record');
}

if (!service.includes('"umbraco.content-app"')) {
  failures.push('the service must attribute its scans to umbraco.content-app');
}

if (!/Uri\.TryCreate\(/.test(service)) {
  failures.push('the service must reject a content URL it cannot resolve absolutely');
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log('PASS umbraco-ariada structure');
