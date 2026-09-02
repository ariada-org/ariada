#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

/**
 * Structure + syntax validator for the WordPress plugin. This is the closest
 * this package gets to `php -l` / a PHPUnit suite without a PHP runtime —
 * neither is available in every environment that builds this monorepo (no
 * PHP interpreter, no wp-env/Docker WordPress instance). php-parser gives a
 * real PHP syntax check (a genuine parse, not a string search); the
 * structural assertions below then confirm the specific hooks and functions
 * the plugin depends on are actually declared, not just mentioned in a
 * comment.
 *
 * A full WordPress runtime end-to-end test (activation on a real wp-admin,
 * PHPUnit against WP_UnitTestCase, wp-env multisite) is out of reach here —
 * flagged in the package README rather than faked.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Engine } from 'php-parser';

// The directory is read from an argument when one is given, so this can be run
// against a deliberately-broken copy and shown to refuse it. A checker that has
// only ever seen the good tree is not known to check anything.
const root = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : resolve(new URL('..', import.meta.url).pathname);
const pluginPath = resolve(root, 'ariada-wordpress.php');
const plugin = readFileSync(pluginPath, 'utf8');
const readme = readFileSync(resolve(root, 'readme.txt'), 'utf8');

const failures = [];

function fail(message) {
  failures.push(message);
}

// --- Real syntax check (php-parser parses the file into an AST; a syntax
// error throws or records a parser error) --------------------------------
const parser = new Engine({
  parser: { extractDoc: false, suppressErrors: false },
  ast: { withPositions: true },
});

let ast;
try {
  ast = parser.parseCode(plugin, pluginPath);
} catch (err) {
  fail(`PHP syntax error: ${err instanceof Error ? err.message : String(err)}`);
}

// --- Structural walk: collect declared function names and the target of
// every add_action / register_activation_hook / register_rest_route /
// WP_CLI::add_command call, so assertions below check what the code
// actually DOES, not merely what text appears somewhere in the file. -----
const declaredFunctions = new Set();
const hookedActions = new Set();
let hasActivationHook = false;
let hasRestRouteRegistration = false;
let hasWpCliRegistration = false;

function walk(node) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) walk(item);
    return;
  }
  if (node.kind === 'function' && typeof node.name?.name === 'string') {
    declaredFunctions.add(node.name.name);
  }
  if (node.kind === 'call' && node.what?.kind === 'name') {
    const callee = node.what.name;
    const args = node.arguments ?? [];
    if (callee === 'add_action' && args[0]?.kind === 'string') {
      hookedActions.add(String(args[0].value));
    }
    if (callee === 'register_activation_hook') {
      hasActivationHook = true;
    }
    if (callee === 'register_rest_route') {
      hasRestRouteRegistration = true;
    }
  }
  // Static method calls (e.g. WP_CLI::add_command(...)) parse as a `call`
  // whose `what` is a `staticlookup` node, not a distinct "staticcall" kind.
  if (
    node.kind === 'call' &&
    node.what?.kind === 'staticlookup' &&
    node.what.what?.name === 'WP_CLI' &&
    node.what.offset?.name === 'add_command'
  ) {
    hasWpCliRegistration = true;
  }
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'position') continue;
    walk(node[key]);
  }
}

if (ast) walk(ast);

// --- Assertions -----------------------------------------------------------

for (const needle of [
  'Plugin Name: Ariada Site Accessibility Scan',
  'GPL-2.0-or-later',
]) {
  if (!plugin.includes(needle)) fail(`WordPress plugin missing "${needle}"`);
}

for (const fn of [
  'ariada_wp_cli_scan',
  'ariada_wp_hosted_scan',
  'ariada_wp_admin_menu',
  'ariada_wp_register_rest_routes',
  'ariada_wp_rest_get_report',
  'ariada_wp_activate',
  'ariada_wp_detect_capabilities',
  'ariada_wp_available_domains',
]) {
  if (!declaredFunctions.has(fn)) fail(`WordPress plugin missing function declaration: ${fn}()`);
}

if (!hookedActions.has('admin_menu')) fail('Plugin must register an admin_menu action');
if (!hookedActions.has('rest_api_init')) fail('Plugin must register a rest_api_init action for the REST route');
if (!hasActivationHook) fail('Plugin must register an activation hook (register_activation_hook)');
if (!hasRestRouteRegistration) fail('Plugin must call register_rest_route()');
if (!hasWpCliRegistration) fail('Plugin must register a WP_CLI command (WP_CLI::add_command)');

if (!plugin.includes("'ariada/v1'") && !plugin.includes('"ariada/v1"')) {
  fail('REST route must live under the ariada/v1 namespace');
}
if (!plugin.includes("'/report'") && !plugin.includes('"/report"')) {
  fail('REST route must expose /report');
}
if (!plugin.includes('manage_options')) {
  fail('REST route and admin page must require the manage_options capability');
}

// WP-CLI severity-threshold / domains flags and threshold-breach exit code.
if (!plugin.includes("assoc_args['severity-threshold']") && !plugin.includes('assoc_args["severity-threshold"]')) {
  fail('WP-CLI command must read --severity-threshold from assoc_args');
}
if (!plugin.includes("assoc_args['domains']") && !plugin.includes('assoc_args["domains"]')) {
  fail('WP-CLI command must read --domains from assoc_args');
}
if (!plugin.includes('exitCode')) {
  fail('Scan result must carry the underlying CLI exit code so WP-CLI can distinguish a threshold breach from a runtime error');
}

// Six real domain ids per @ariada-org/core-engine's domain-contract.
for (const domain of ['accessibility', 'privacy', 'security', 'sustainability', 'structured-data', 'ai-readiness']) {
  if (!plugin.includes(domain)) fail(`Plugin must reference the "${domain}" domain (available-domains list or settings checkbox)`);
}
if (!plugin.includes('domains[]')) {
  fail('Settings page must offer a multi-select (name="domains[]") for domain selection');
}

if (
  !readme.includes('local CLI mode') ||
  !readme.includes('hosted mode') ||
  !readme.includes('/wp-json/ariada/v1/report') ||
  !readme.includes('severity-threshold')
) {
  fail('readme.txt must document local/hosted runner modes, the REST endpoint, and the --severity-threshold flag');
}

if (failures.length > 0) {
  console.error(`FAIL wordpress-ariada structure (${failures.length} issue(s)):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log('PASS wordpress-ariada structure (syntax + hooks + REST + WP-CLI + domain config)');
