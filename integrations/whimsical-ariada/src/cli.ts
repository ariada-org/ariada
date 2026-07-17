// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { readFile } from 'node:fs/promises';

import { parseRecipeConfig, runAriadaForWhimsical } from './index.js';

async function main(): Promise<void> {
  const configPath = process.argv[2];
  if (!configPath) {
    throw new Error('Usage: ariada-whimsical <recipe.json>');
  }

  const recipe = parseRecipeConfig(await readFile(configPath, 'utf8'));
  const result = await runAriadaForWhimsical(recipe);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(`${result.stderr}\n`);
  process.exitCode = result.status;
}

await main();
