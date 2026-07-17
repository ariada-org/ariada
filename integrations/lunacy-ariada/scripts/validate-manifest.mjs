import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const manifestPath = resolve(dirname(new URL(import.meta.url).pathname), '../plugin.jsonc');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

for (const field of ['id', 'name', 'description', 'version', 'lifecycle']) {
  if (typeof manifest[field] !== 'string' || manifest[field].trim() === '') {
    throw new Error(`plugin.${field} must be a non-empty string`);
  }
}

if (manifest.lifecycle !== 'utility' && manifest.lifecycle !== 'Service') {
  throw new Error('plugin.lifecycle must be utility or Service');
}

if (!Array.isArray(manifest.commands) || manifest.commands.length === 0) {
  throw new Error('plugin.commands must define at least one command');
}

for (const command of manifest.commands) {
  for (const field of ['id', 'name', 'description', 'executable']) {
    if (typeof command[field] !== 'string' || command[field].trim() === '') {
      throw new Error(`command.${field} must be a non-empty string`);
    }
  }
  if (!Array.isArray(command.args) || command.args.length === 0) {
    throw new Error(`command.${command.id}.args must list the plugin entrypoint`);
  }
  if (!command.args.includes('dist/cli.js')) {
    throw new Error(`command.${command.id}.args must invoke dist/cli.js`);
  }
}

if (existsSync(join(dirname(manifestPath), 'dist')) && !existsSync(join(dirname(manifestPath), 'dist/cli.js'))) {
  throw new Error('dist exists but dist/cli.js is missing');
}
