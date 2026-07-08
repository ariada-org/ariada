// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { readFile } from 'node:fs/promises';
import { fetchLunacySelection, renderLayersToHtml, scanRenderedHtml } from './index.js';

const [command, inputPath] = process.argv.slice(2);

try {
  const selection = command === 'scan-file'
    ? JSON.parse(await readFile(required(inputPath, 'scan-file requires a JSON layer export path'), 'utf8'))
    : await fetchLunacySelection(process.env['ARIADA_LUNACY_API_URL']);
  const options = {
    outputDir: process.env['ARIADA_OUTPUT_DIR'] ?? 'ariada-output',
    severityThreshold: 'moderate'
  } as const;
  const exitCode = await scanRenderedHtml(
    renderLayersToHtml(selection),
    process.env['ARIADA_CLI_COMMAND'] ? { ...options, cliCommand: process.env['ARIADA_CLI_COMMAND'] } : options
  );
  process.exitCode = exitCode;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 3;
}

function required(value: string | undefined, message: string): string {
  if (!value) throw new Error(message);
  return value;
}
