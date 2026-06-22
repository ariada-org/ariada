#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const source = await readFile(resolve(import.meta.dirname, '../ariada.el'), 'utf8');
const failures = [];
for (const token of [';;; ariada.el ---', 'Package-Requires:', '(defun ariada-scan', "(provide 'ariada)", 'ariada.el ends here']) {
  if (!source.includes(token)) failures.push(`missing ${token}`);
}
if (!source.includes('"scan" target "--format" "json"')) failures.push('scan command must call ariada scan with JSON output');

if (failures.length > 0) {
  console.error(`Emacs package validation failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('PASS Emacs package header and CLI wrapper validation');
