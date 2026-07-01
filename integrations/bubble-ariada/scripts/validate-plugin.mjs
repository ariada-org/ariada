import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(await readFile(resolve(root, 'plugin/bubble-plugin.json'), 'utf8'));
const failures = [];

if (manifest.platform !== 'Bubble') failures.push('manifest.platform must be Bubble');
if (manifest.apiConnector?.method !== 'POST') failures.push('Ariada scan connector must POST');
if (!manifest.apiConnector?.url?.includes('/v1/scans')) failures.push('connector must target hosted scan API semantics');
if (!Array.isArray(manifest.actions) || manifest.actions.length !== 1) failures.push('exactly one scan action expected');

const action = manifest.actions?.[0] ?? {};
for (const key of ['url_to_scan']) {
 if (!action.inputs?.some((input) => input.key === key && input.required)) {
 failures.push(`action is missing required input ${key}`);
 }
}
for (const key of ['ok', 'findings_count', 'summary_text', 'findings_json', 'raw_json']) {
 if (!action.returnedValues?.some((value) => value.key === key)) {
 failures.push(`action is missing returned value ${key}`);
 }
}

if (failures.length > 0) {
 console.error(`Bubble plugin validation failed:\n- ${failures.join('\n- ')}`);
 process.exit(1);
}

console.log('PASS Bubble plugin scaffold describes hosted scan connector, action inputs, and returned values');
