'use strict';

/* eslint-disable @typescript-eslint/no-require-imports */
/* global __dirname, require */

const { existsSync, readFileSync } = require('node:fs');
const { dirname, join, resolve } = require('node:path');

const manifestPath = resolve(__dirname, '../ariada-accessibility-check.sketchplugin/Contents/Sketch/manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const sketchRoot = dirname(manifestPath);

const requiredStringFields = ['name', 'description', 'author', 'version', 'identifier'];
for (const field of requiredStringFields) {
  if (typeof manifest[field] !== 'string' || manifest[field].trim() === '') {
    throw new Error(`manifest.${field} must be a non-empty string`);
  }
}

if (!Array.isArray(manifest.commands) || manifest.commands.length === 0) {
  throw new Error('manifest.commands must define at least one command');
}

for (const command of manifest.commands) {
  for (const field of ['name', 'identifier', 'script']) {
    if (typeof command[field] !== 'string' || command[field].trim() === '') {
      throw new Error(`command.${field} must be a non-empty string`);
    }
  }
  if (!existsSync(join(sketchRoot, command.script))) {
    throw new Error(`command script is missing: ${command.script}`);
  }
}

if (!manifest.menu || !Array.isArray(manifest.menu.items)) {
  throw new Error('manifest.menu.items must list command identifiers');
}

const commandIds = new Set(manifest.commands.map((command) => command.identifier));
for (const item of manifest.menu.items) {
  if (typeof item === 'string' && item !== '-' && !commandIds.has(item)) {
    throw new Error(`manifest.menu.items references unknown command: ${item}`);
  }
}
