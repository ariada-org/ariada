#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const plugin = readFileSync(resolve(root, 'ariada-wordpress.php'), 'utf8');
const readme = readFileSync(resolve(root, 'readme.txt'), 'utf8');

for (const needle of [
  'Plugin Name: Ariada Site Accessibility Scan',
  'GPL-2.0-or-later',
  'ariada_wp_cli_scan',
  'ariada_wp_hosted_scan',
  'add_management_page',
  'WP_CLI::add_command',
]) {
  if (!plugin.includes(needle)) throw new Error(`WordPress plugin missing ${needle}`);
}

if (!readme.includes('local CLI mode') || !readme.includes('hosted mode')) {
  throw new Error('WordPress readme must document local and hosted runner modes');
}

console.log('PASS wordpress-ariada structure');
