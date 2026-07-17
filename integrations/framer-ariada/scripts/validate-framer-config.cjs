'use strict';

const { existsSync, readFileSync } = require('node:fs');
const { join, resolve } = require('node:path');

const root = resolve(__dirname, '..');
const config = JSON.parse(readFileSync(join(root, 'framer.json'), 'utf8'));

for (const field of ['id', 'name', 'icon']) {
  if (typeof config[field] !== 'string' || config[field].trim() === '') {
    throw new Error(`framer.json ${field} must be a non-empty string`);
  }
}

if (!Array.isArray(config.modes) || !config.modes.includes('canvas')) {
  throw new Error('framer.json modes must include canvas');
}

if (!existsSync(join(root, 'public', config.icon.replace(/^\//, '')))) {
  throw new Error(`configured icon does not exist: ${config.icon}`);
}

if (!existsSync(join(root, 'src', 'plugin.jsx'))) {
  throw new Error('src/plugin.jsx is missing');
}
