// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { readFile } from 'node:fs/promises';

import { buildAriadaInvocation, parseRecipeConfig } from './index.js';

async function main(): Promise<void> {
  const configPath = process.argv[2];
  if (!configPath) {
    throw new Error('Usage: ariada-whimsical <recipe.json>');
  }

  const recipe = parseRecipeConfig(await readFile(configPath, 'utf8'));
  const invocation = buildAriadaInvocation(recipe);
  console.log([invocation.command, ...invocation.args].join(' '));
  console.error(invocation.limitation);
}

await main();
